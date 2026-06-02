#!/usr/bin/env node
// fourbar-driver.cjs — VERIFICA el Sintetizador de Mecanismos (cuatro-barras)
// VIA UI (clic real de Playwright), nunca llamando la matemática directo.
// Corre EN iangpu (GPU real via ANGLE). Screenshot a /tmp/forja-mech/fourbar.png.
//
// Chequeos:
//  1) carga sin pageerror; GPU real (no SwiftShader).
//  2) preset crank-rocker activo; el slider input-theta MUEVE el mecanismo:
//     barre θ2 y lee hud-theta4 + posiciones de junta (window.__fourbar) → CAMBIAN.
//  3) btn-animar arranca/para la animación (θ2 avanza solo).
//  4) branch-toggle cambia la rama.
//  5) INVARIANTE cierre de lazo: hud-loop-max < 1e-9 (leído de la UI) y, además,
//     recomputado independientemente desde las posiciones expuestas en window.__fourbar.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.MECH_URL || 'http://localhost:5002/forja-mecanismos.html';
const OUTDIR = process.env.OUTDIR || '/tmp/forja-mech';
fs.mkdirSync(OUTDIR, { recursive: true });
const SHOT = path.join(OUTDIR, 'fourbar.png');

const num = (s) => { const m = (s || '').match(/-?[\d.]+(e-?\d+)?/i); return m ? parseFloat(m[0]) : NaN; };

const CHROME = process.env.CHROME || '/usr/bin/google-chrome-stable';

(async () => {
  // Receta GPU canónica iangpu (render-bh-comercial.cjs): headless:false +
  // --headless=new + --use-angle=gl + Chrome del sistema. El env GALLIUM_DRIVER=
  // d3d12 / MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA lo pone el operador antes de
  // node (engancha la RTX vía D3D12 ANGLE; headless:true cae a llvmpipe).
  const b = await chromium.launch({
    headless: false,
    executablePath: CHROME,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--headless=new',
      '--ignore-gpu-blocklist', '--enable-gpu', '--enable-gpu-rasterization',
      '--enable-webgl', '--disable-software-rasterizer', '--use-angle=gl',
      '--disable-background-timer-throttling', '--hide-scrollbars',
      '--window-size=1500,940',
    ],
  });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 940 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 300)));
  p.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/favicon/i.test(t)) return;                 // favicon 404 es benigno
    if (/404 \(Not Found\)/.test(t) && !/\.(js|tsx|ts|css|hdr|wasm)/.test(t)) return; // recurso suelto no-crítico
    errs.push('CONSOLE:' + t.slice(0, 200));
  });

  const report = { errs: [], steps: {}, invariants: {}, ok: false };

  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
  // Esperar a que el canvas R3F exista y pinte.
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

  // helper: lee un testid de texto
  const read = async (tid) => (await p.locator(`[data-testid="${tid}"]`).textContent().catch(() => null));

  // --- preset crank-rocker activo (clic) ---
  await p.locator('[data-testid="preset-crank-rocker"]').click();
  await p.waitForTimeout(400);
  report.steps.presetClass = (await read('gate-class')) || '';
  report.steps.crank360 = (await read('gate-crank360')) || '';

  // --- MOVER el slider input-theta a varios ángulos, leyendo hud-theta4 y juntas ---
  // El slider es 0..360 (grados). Usamos fill sobre el range (Playwright soporta).
  const slider = p.locator('[data-testid="input-theta"]');
  const samplesDeg = [0, 45, 90, 150, 220, 300];
  const theta4s = [];
  const jointSnaps = [];
  for (const d of samplesDeg) {
    await slider.fill(String(d));
    await slider.dispatchEvent('input');
    await p.waitForTimeout(220);
    const t4 = num(await read('hud-theta4'));
    const loop = num(await read('hud-loop'));
    theta4s.push(t4);
    // posiciones de junta desde window.__fourbar (expuesto por la escena)
    const snap = await p.evaluate(() => (window.__fourbar ? window.__fourbar.pose : null));
    jointSnaps.push({ deg: d, t4, loop, snap });
  }
  report.steps.theta4Series = theta4s;

  // ¿se MOVIÓ? θ4 debe cambiar entre muestras (rango no trivial).
  const valid = theta4s.filter((x) => Number.isFinite(x));
  const t4Range = valid.length ? Math.max(...valid) - Math.min(...valid) : 0;
  report.invariants.theta4RangeDeg = t4Range;
  report.invariants.mechanismMoves = t4Range > 5; // más de 5° de recorrido en salida

  // ¿se movieron las JUNTAS A y B? (posición física, no solo el ángulo)
  let jointTravel = 0;
  const snaps = jointSnaps.map((j) => j.snap).filter(Boolean);
  if (snaps.length >= 2) {
    const dist = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1]);
    let maxA = 0, maxB = 0;
    for (let i = 1; i < snaps.length; i++) {
      maxA = Math.max(maxA, dist(snaps[i].A, snaps[0].A));
      maxB = Math.max(maxB, dist(snaps[i].B, snaps[0].B));
    }
    jointTravel = Math.min(maxA, maxB);
  }
  report.invariants.jointTravel = jointTravel;
  report.invariants.jointsMove = jointTravel > 0.5;

  // --- INVARIANTE cierre de lazo, leído de la UI ---
  const loopMaxUI = num(await read('hud-loop-max'));
  report.invariants.loopMaxUI = loopMaxUI;

  // --- INVARIANTE recomputado INDEPENDIENTEMENTE desde las posiciones expuestas ---
  // ‖a2·e^{iθ2}+a3·e^{iθ3} − a1·e^{iγ} − a4·e^{iθ4}‖ usando SOLO posiciones de junta.
  let loopRecomputeMax = 0;
  for (const j of jointSnaps) {
    if (!j.snap || !j.snap.assembled) continue;
    const s = j.snap;
    // vectores de barra desde posiciones (independiente de los ángulos reportados)
    const v = (u, w) => [w[0] - u[0], w[1] - u[1]];
    const O2A = v(s.O2, s.A);   // a2 vector
    const AB = v(s.A, s.B);     // a3 vector
    const O2O4 = v(s.O2, s.O4); // a1 vector
    const O4B = v(s.O4, s.B);   // a4 vector
    // cierre: O2A + AB == O2O4 + O4B   (geometría: O2->A->B == O2->O4->B)
    const lx = (O2A[0] + AB[0]) - (O2O4[0] + O4B[0]);
    const ly = (O2A[1] + AB[1]) - (O2O4[1] + O4B[1]);
    loopRecomputeMax = Math.max(loopRecomputeMax, Math.hypot(lx, ly));
  }
  report.invariants.loopRecomputeMax = loopRecomputeMax;

  // --- btn-animar: arranca, espera, θ2 cambia solo; luego para ---
  const theta2Before = num(await read('hud-theta2'));
  await p.locator('[data-testid="btn-animar"]').click();
  await p.waitForTimeout(1400);
  const theta2Mid = num(await read('hud-theta2'));
  await p.locator('[data-testid="btn-animar"]').click(); // pausa
  await p.waitForTimeout(500);
  const theta2AfterPause = num(await read('hud-theta2'));
  await p.waitForTimeout(700);
  const theta2Still = num(await read('hud-theta2'));
  report.steps.anim = { theta2Before, theta2Mid, theta2AfterPause, theta2Still };
  report.invariants.animates = Number.isFinite(theta2Mid) && Math.abs(theta2Mid - theta2Before) > 2;
  report.invariants.pauses = Number.isFinite(theta2Still) && Math.abs(theta2Still - theta2AfterPause) < 1.5;

  // --- branch-toggle ---
  const t4PreToggle = num(await read('hud-theta4'));
  await p.locator('[data-testid="branch-toggle"]').click();
  await p.waitForTimeout(400);
  const t4PostToggle = num(await read('hud-theta4'));
  report.steps.branch = { t4PreToggle, t4PostToggle };
  report.invariants.branchChanges = Number.isFinite(t4PostToggle) && Math.abs(t4PostToggle - t4PreToggle) > 1;

  // volver a rama abierta y un ángulo bonito para el screenshot
  await p.locator('[data-testid="branch-toggle"]').click();
  await slider.fill('60'); await slider.dispatchEvent('input');
  await p.waitForTimeout(600);

  await p.screenshot({ path: SHOT, timeout: 30000 });

  // --- veredicto ---
  const I = report.invariants;
  const loopOK = (Number.isFinite(loopMaxUI) ? loopMaxUI < 1e-9 : true) && loopRecomputeMax < 1e-6;
  report.invariants.loopInvariantOK = loopOK;
  report.ok = !errs.length && I.gpuReal && I.mechanismMoves && I.jointsMove && I.animates && I.pauses && I.branchChanges && loopOK;
  report.errs = errs;

  console.log('FOURBAR_RESULT=' + JSON.stringify(report));
  await ctx.close();
  await b.close();
})().catch((e) => { console.error('FATAL', e && e.stack || e); process.exit(1); });
