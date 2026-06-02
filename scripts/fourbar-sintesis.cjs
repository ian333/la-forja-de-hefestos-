#!/usr/bin/env node
// fourbar-sintesis.cjs — VERIFICA el GATE DE VALIDEZ + la SÍNTESIS EXACTA de
// Freudenstein del Sintetizador de Mecanismos (cuatro-barras) VIA UI (clic real
// de Playwright), nunca llamando la matemática directo. Corre EN iangpu (GPU
// real via ANGLE). Screenshot a /tmp/forja-mech/sintesis.png.
//
// Chequeos:
//  1) carga sin pageerror; GPU real (no SwiftShader/llvmpipe).
//  2) GATE DE VALIDEZ visible: gate-grashof, gate-transmision, gate-rama con
//     clasificación crank-rocker/etc; valores coherentes con window.__fourbar.
//  3) SÍNTESIS: meter 3 puntos de precisión (input-pN-in/out), clic btn-sintetizar.
//  4) EXACTITUD (la prueba dura): leer las longitudes resultantes y el error que
//     la UI reporta; ADEMÁS recomputar el error INDEPENDIENTEMENTE — correr el
//     forward del four-bar sintetizado (leído de window.__fourbar.synth.lengths)
//     en los 3 θ2_i objetivo y comparar θ4 calculado vs los 3 θ4_i objetivo.
//     Freudenstein es EXACTO ⇒ error < 1e-9.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.MECH_URL || 'http://localhost:5002/forja-mecanismos.html';
const OUTDIR = process.env.OUTDIR || '/tmp/forja-mech';
fs.mkdirSync(OUTDIR, { recursive: true });
const SHOT = path.join(OUTDIR, 'sintesis.png');

const CHROME = process.env.CHROME || '/usr/bin/google-chrome-stable';
const num = (s) => { const m = (s || '').match(/-?[\d.]+(e-?\d+)?/i); return m ? parseFloat(m[0]) : NaN; };
const D2R = (d) => (d * Math.PI) / 180;

// ── Los 3 puntos de precisión que metemos por UI (grados) ──
// Provienen de un crank-rocker real {a1=4,a2=1,a3=3.5,a4=3} muestreado en
// θ2=40°,90°,150° (rama abierta) → la síntesis debe reconstruirlo y clavar los 3.
const PP = [
  { in: 40, out: 236.099 },
  { in: 90, out: 222.197 },
  { in: 150, out: 219.341 },
];

// ── Forward INDEPENDIENTE (reimplementado aquí; NO importa la matemática del
// repo) para verificar la exactitud de la síntesis sin confiar en la UI. ──
function freudensteinABC(p, th2) {
  const { ground: a1, crank: a2, rocker: a4, coupler: a3 } = p;
  const K1 = a1 / a2, K2 = a1 / a4;
  const K3 = (a2 * a2 - a3 * a3 + a4 * a4 + a1 * a1) / (2 * a2 * a4);
  const c2 = Math.cos(th2);
  return { A: c2 - K1 - K2 * c2 + K3, B: -2 * Math.sin(th2), C: K1 - (K2 + 1) * c2 + K3 };
}
function theta4Of(p, theta2, branch) {
  const { A, B, C } = freudensteinABC(p, theta2);
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t;
  if (Math.abs(A) < 1e-12) t = Math.abs(B) > 1e-12 ? -C / B : 0;
  else t = branch === 'open' ? (-B + sq) / (2 * A) : (-B - sq) / (2 * A);
  return 2 * Math.atan(t);
}
function angDelta(a, b) { let d = (a - b) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; }
function independentSynthError(lengths) {
  // lengths = {ground,crank,coupler,rocker} SIGNADAS (como las expone __fourbar.synth).
  let maxErr = 0; const errs = [];
  for (const q of PP) {
    const t2 = D2R(q.in), t4 = D2R(q.out);
    const o = theta4Of(lengths, t2, 'open'), c = theta4Of(lengths, t2, 'crossed');
    const cc = [];
    if (o !== null) cc.push(Math.abs(angDelta(o, t4)));
    if (c !== null) cc.push(Math.abs(angDelta(c, t4)));
    const e = cc.length ? Math.min(...cc) : Infinity;
    errs.push(e); maxErr = Math.max(maxErr, e);
  }
  return { maxErr, errs };
}

(async () => {
  const b = await chromium.launch({
    headless: false,
    executablePath: CHROME,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--headless=new',
      '--ignore-gpu-blocklist', '--enable-gpu', '--enable-gpu-rasterization',
      '--enable-webgl', '--disable-software-rasterizer', '--use-angle=gl',
      '--disable-background-timer-throttling', '--hide-scrollbars',
      '--window-size=1500,1000',
    ],
  });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 300)));
  p.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/favicon/i.test(t)) return;
    if (/404 \(Not Found\)/.test(t) && !/\.(js|tsx|ts|css|hdr|wasm)/.test(t)) return;
    errs.push('CONSOLE:' + t.slice(0, 200));
  });

  const report = { errs: [], gate: {}, synth: {}, invariants: {}, gate_ok: false, sintesis_ok: false };

  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await p.waitForSelector('[data-testid="fourbar-canvas"]', { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(5000);

  // --- GPU real ---
  const renderer = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return 'NO-CANVAS';
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 'NO-GL';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'no-ext';
  });
  report.invariants.renderer = renderer;
  report.invariants.gpuReal = /NVIDIA|D3D12|RTX/i.test(renderer) && !/SwiftShader|llvmpipe/i.test(renderer);

  const read = async (tid) => (await p.locator(`[data-testid="${tid}"]`).textContent().catch(() => null));
  const cls = async (tid) => (await p.locator(`[data-testid="${tid}"]`).getAttribute('class').catch(() => '')) || '';

  // ───────────────── 1) GATE DE VALIDEZ (preset crank-rocker) ─────────────────
  await p.locator('[data-testid="preset-crank-rocker"]').click();
  await p.waitForTimeout(500);

  report.gate.grashofText = (await read('gate-grashof')) || '';
  report.gate.grashofClass = await cls('gate-grashof');
  report.gate.classText = (await read('gate-class')) || '';
  report.gate.transmisionText = (await read('gate-transmision')) || '';
  report.gate.transmisionClass = await cls('gate-transmision');
  report.gate.ramaText = (await read('gate-rama')) || '';
  report.gate.ramaClass = await cls('gate-rama');

  // Espejo de invariantes desde window.__fourbar (sin confiar solo en el texto).
  const gmir = await p.evaluate(() => {
    const f = window.__fourbar; if (!f) return null;
    return { grashof: f.grashof, muMinDeg: f.muMinDeg, muMaxDeg: f.muMaxDeg, branchValid: f.branchValid, assembledFraction: f.assembledFraction };
  });
  report.gate.mirror = gmir;

  // El gate es coherente: crank-rocker es Grashof, clasificado, rama válida,
  // y los tres pills se renderizan con su clase good/bad.
  const grashofGood = report.gate.grashofClass.includes('good') && (gmir ? gmir.grashof.grashof : false);
  const classCrankRocker = /crank-rocker/i.test(report.gate.classText);
  const transmisionRendered = /pill/.test(report.gate.transmisionClass);
  const ramaGood = report.gate.ramaClass.includes('good') && (gmir ? gmir.branchValid : false);
  report.gate_ok = grashofGood && classCrankRocker && transmisionRendered && ramaGood && (gmir != null);
  report.invariants.gateGrashofGood = grashofGood;
  report.invariants.gateClassCrankRocker = classCrankRocker;
  report.invariants.gateRamaGood = ramaGood;

  // ───────────────── 2) SÍNTESIS DE FREUDENSTEIN (vía UI) ─────────────────
  // Meter los 3 puntos de precisión en los inputs.
  for (let i = 0; i < 3; i++) {
    const inSel = p.locator(`[data-testid="input-p${i + 1}-in"]`);
    const outSel = p.locator(`[data-testid="input-p${i + 1}-out"]`);
    await inSel.fill(String(PP[i].in));
    await inSel.dispatchEvent('input');
    await outSel.fill(String(PP[i].out));
    await outSel.dispatchEvent('input');
  }
  await p.waitForTimeout(300);

  // Clic SINTETIZAR.
  await p.locator('[data-testid="btn-sintetizar"]').click();
  await p.waitForTimeout(900);

  // Leer longitudes + error que la UI reporta.
  report.synth.lengthsText = (await read('synth-lengths')) || '';
  report.synth.errorText = (await read('synth-error')) || '';
  report.synth.errorClass = await cls('synth-error');
  report.synth.failText = (await read('synth-fail')) || '';

  // Espejo: longitudes SIGNADAS + error desde window.__fourbar.synth.
  const smir = await p.evaluate(() => {
    const f = window.__fourbar; if (!f || !f.synth) return null;
    return { ok: f.synth.ok, K: f.synth.K, lengths: f.synth.lengths, reason: f.synth.reason, uiError: f.synthError ? f.synthError.maxError : null };
  });
  report.synth.mirror = smir;

  // ───────────────── 3) EXACTITUD INDEPENDIENTE (la prueba dura) ─────────────────
  // Recomputar el forward del four-bar SINTETIZADO (longitudes signadas tal cual
  // las expone la app) en los 3 θ2_i y comparar θ4 vs objetivo. Las longitudes
  // de __fourbar.synth.lengths están en ESCALA del operador (a1=4); el forward
  // es invariante a escala, así que se usan directo.
  let independent = { maxErr: NaN, errs: [] };
  if (smir && smir.ok && smir.lengths) {
    independent = independentSynthError(smir.lengths);
  }
  report.synth.independentMaxError = independent.maxErr;
  report.synth.independentErrors = independent.errs;
  report.synth.uiReportedError = smir ? smir.uiError : null;

  const synthBuilt = !!(smir && smir.ok && smir.lengths);
  const uiErrOK = smir && Number.isFinite(smir.uiError) && smir.uiError < 1e-9;
  const indepErrOK = Number.isFinite(independent.maxErr) && independent.maxErr < 1e-9;
  report.sintesis_ok = synthBuilt && uiErrOK && indepErrOK && !errs.length;
  report.invariants.synthBuilt = synthBuilt;
  report.invariants.uiErrOK = uiErrOK;
  report.invariants.indepErrOK = indepErrOK;

  // El four-bar sintetizado quedó EN EL VIEWPORT: mueve el slider para confirmar
  // que el mecanismo construido responde (cierre de lazo ~0 en otro θ2).
  const slider = p.locator('[data-testid="input-theta"]');
  await slider.fill('70'); await slider.dispatchEvent('input');
  await p.waitForTimeout(500);
  const loopAt70 = num(await read('hud-loop'));
  report.invariants.loopAt70 = loopAt70;
  report.invariants.builtInViewport = Number.isFinite(loopAt70) && loopAt70 < 1e-9;

  await p.screenshot({ path: SHOT, timeout: 30000 });

  report.errs = errs;
  console.log('SINTESIS_RESULT=' + JSON.stringify(report));
  await ctx.close();
  await b.close();
})().catch((e) => { console.error('FATAL', e && e.stack || e); process.exit(1); });
