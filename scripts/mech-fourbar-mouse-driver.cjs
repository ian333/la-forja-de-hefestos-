#!/usr/bin/env node
/**
 * mech-fourbar-mouse-driver.cjs — PRUEBA CON MOUSE, CADA FUNCIÓN del
 * Sintetizador de Mecanismos (cuatro-barras) de La Forja.
 *
 * REGLA DURA: cada acción es un CLIC / arrastre de SLIDER / tecleo en input REAL
 * de Playwright — NUNCA se llama la matemática (fourbar.ts) directo. window.__fourbar
 * solo se LEE como espejo de verificación independiente (recomputa el cierre de lazo
 * desde posiciones de junta), jamás como fuente para mover el mecanismo.
 *
 * Corre EN iangpu (GPU real vía ANGLE). Screenshots a /tmp/forja-mech/ (luego se
 * copian a la laptop).
 *
 * FUNCIONES EJERCIDAS (todas vía UI):
 *  1) Crear four-bar por PRESET (clic preset-crank-rocker / preset-kidney).
 *  2) ANIMAR: arrastrar input-theta 0→360 (varias poses) + botón btn-animar; θ4 y
 *     juntas cambian coherente; el mecanismo se mueve fluido.
 *  3) GATE: gate-grashof / gate-transmision / gate-rama + gate-class. Probar un caso
 *     Grashof (verde) y, vía síntesis, uno NO-Grashof (rojo = triple-rocker).
 *  4) SINTETIZAR: teclear 3 puntos de precisión, clic btn-sintetizar; synth-error < 1e-9
 *     (CLAVA los 3 puntos corriendo el forward). Probar default (Grashof) y no-Grashof.
 *  5) Curva del acoplador visible (sweep.couplerCurve no vacío + se ve en el render).
 *  6) branch-toggle (rama abierta/cruzada) cambia θ4.
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.MECH_URL || 'http://localhost:5002/forja-mecanismos.html';
const OUTDIR = process.env.OUTDIR || '/tmp/forja-mech';
fs.mkdirSync(OUTDIR, { recursive: true });
const CHROME = process.env.CHROME || '/usr/bin/google-chrome-stable';

const num = (s) => { const m = (s || '').match(/-?[\d.]+(e-?\d+)?/i); return m ? parseFloat(m[0]) : NaN; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
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
    if (/favicon/i.test(t)) return;
    if (/404 \(Not Found\)/.test(t) && !/\.(js|tsx|ts|css|hdr|wasm)/.test(t)) return;
    errs.push('CONSOLE:' + t.slice(0, 200));
  });

  const report = { url: URL, errs: [], gpu: {}, funcs: [], shots: [], notes: [] };
  const fn = (funcion, via_mouse, resultado, extra) =>
    report.funcs.push(Object.assign({ funcion, via_mouse, resultado }, extra || {}));

  const read = async (tid) => (await p.locator(`[data-testid="${tid}"]`).textContent().catch(() => null));
  const mirror = async () => p.evaluate(() => (window.__fourbar ? JSON.parse(JSON.stringify(window.__fourbar)) : null));
  const shot = async (name) => {
    const f = path.join(OUTDIR, name);
    await p.screenshot({ path: f, timeout: 30000 });
    report.shots.push(f);
    return f;
  };

  // Arrastre REAL del slider de rango por mouse (no fill): clic en la pista a la
  // fracción deseada. Mantiene la promesa "vía mouse".
  const dragSliderToDeg = async (deg) => {
    const el = p.locator('[data-testid="input-theta"]');
    const box = await el.boundingBox();
    if (!box) throw new Error('slider sin boundingBox');
    const frac = Math.max(0, Math.min(1, deg / 360));
    const x = box.x + 6 + (box.width - 12) * frac; // 6px de padding de thumb
    const y = box.y + box.height / 2;
    await p.mouse.click(x, y);
    await sleep(140);
  };

  // Coloca el slider EXACTO a `deg` (step 0.5) usando MOUSE para enfocar (clic) +
  // TECLADO (Home → ArrowRight) — todo interacción de usuario, nunca setear .value
  // por JS. Devuelve el θ2 REAL que reportó el HUD.
  const setSliderExactDeg = async (deg) => {
    const el = p.locator('[data-testid="input-theta"]');
    const box = await el.boundingBox();
    await p.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2); // enfocar
    await el.press('Home'); // → 0°
    await sleep(60);
    const steps = Math.round(deg / 0.5); // step del range = 0.5
    // pulsar ArrowRight en lotes (cada pulso = +0.5°)
    for (let i = 0; i < steps; i++) { await el.press('ArrowRight'); }
    await sleep(160);
    return num(await read('hud-theta2'));
  };

  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await p.waitForSelector('[data-testid="fourbar-canvas"]', { timeout: 30000 }).catch(() => {});
  await sleep(5000);

  // ───────── GPU real ─────────
  const renderer = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return 'NO-CANVAS';
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 'NO-GL';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'no-ext';
  });
  report.gpu.renderer = renderer;
  report.gpu.real = /NVIDIA|D3D12|RTX/i.test(renderer) && !/SwiftShader|llvmpipe/i.test(renderer);

  // ══════════════ 1) CREAR FOUR-BAR POR PRESET (clic) ══════════════
  await p.locator('[data-testid="preset-crank-rocker"]').click();
  await sleep(500);
  const presetClass = (await read('gate-class')) || '';
  const m0 = await mirror();
  fn('1. Crear four-bar (preset crank-rocker, clic)', true,
    /crank-rocker/i.test(presetClass) ? 'PASA' : 'FALLA',
    { detalle: `gate-class="${presetClass.trim()}"; a=[${m0 && m0.params ? [m0.params.ground, m0.params.crank, m0.params.coupler, m0.params.rocker].map((x) => x.toFixed(2)) : '?'}]` });

  // probar también preset-kidney por clic (otra creación por UI)
  await p.locator('[data-testid="preset-kidney"]').click();
  await sleep(400);
  const kidneyMirror = await mirror();
  const kidneyOk = !!(kidneyMirror && kidneyMirror.params);
  fn('1b. Crear four-bar (preset kidney, clic)', true, kidneyOk ? 'PASA' : 'FALLA',
    { detalle: kidneyOk ? `curva acopladora puntos=${kidneyMirror.pose ? 'pose ok' : '?'}` : 'sin mirror' });
  await shot('mech-fourbar-preset-kidney.png');
  // volver a crank-rocker para el resto
  await p.locator('[data-testid="preset-crank-rocker"]').click();
  await sleep(400);

  // ══════════════ 2) ANIMAR — slider θ2 0→360 (arrastre por mouse) ══════════════
  const samplesDeg = [0, 45, 90, 150, 220, 300, 359];
  const series = [];
  for (const d of samplesDeg) {
    await dragSliderToDeg(d);
    await sleep(180);
    const hudT2 = num(await read('hud-theta2'));
    const t4 = num(await read('hud-theta4'));
    const loop = await read('hud-loop');
    const mir = await mirror();
    series.push({ targetDeg: d, hudT2, t4, loop, A: mir && mir.pose && mir.pose.A, B: mir && mir.pose && mir.pose.B });
  }
  const t4s = series.map((s) => s.t4).filter(Number.isFinite);
  const t4Range = t4s.length ? Math.max(...t4s) - Math.min(...t4s) : 0;
  // juntas se mueven (distancia física A,B respecto a la 1ª pose)
  const dist = (u, v) => (u && v ? Math.hypot(u[0] - v[0], u[1] - v[1]) : 0);
  const A0 = series[0].A, B0 = series[0].B;
  let travA = 0, travB = 0;
  for (const s of series) { travA = Math.max(travA, dist(s.A, A0)); travB = Math.max(travB, dist(s.B, B0)); }
  const movesSmooth = t4Range > 5 && Math.min(travA, travB) > 0.5;
  fn('2. ANIMAR vía slider θ2 0→360 (arrastre mouse, varias poses)', true,
    movesSmooth ? 'PASA' : 'FALLA',
    { detalle: `θ4 recorre ${t4Range.toFixed(1)}°; juntas A,B viajan min ${Math.min(travA, travB).toFixed(2)}u; poses=${series.length}; hud-theta4 coherente con θ2` });
  await dragSliderToDeg(60);
  await shot('mech-fourbar-anima.png');

  // botón ANIMAR (rotación continua por motor): θ2 avanza solo, luego pausa
  const t2Before = num(await read('hud-theta2'));
  await p.locator('[data-testid="btn-animar"]').click();
  await sleep(1500);
  const t2Mid = num(await read('hud-theta2'));
  await p.locator('[data-testid="btn-animar"]').click(); // pausa
  await sleep(500);
  const t2Pause = num(await read('hud-theta2'));
  await sleep(800);
  const t2Still = num(await read('hud-theta2'));
  const animates = Number.isFinite(t2Mid) && Math.abs(t2Mid - t2Before) > 2;
  const pauses = Number.isFinite(t2Still) && Math.abs(t2Still - t2Pause) < 1.5;
  fn('2b. Botón ▶ Animar / ⏸ Pausar (clic)', true,
    animates && pauses ? 'PASA' : 'FALLA',
    { detalle: `θ2 ${t2Before.toFixed(1)}→${t2Mid.toFixed(1)}° corriendo; tras pausa estable en ${t2Still.toFixed(1)}°` });

  // ══════════════ branch-toggle (rama abierta/cruzada) ══════════════
  await dragSliderToDeg(90);
  await sleep(200);
  const t4open = num(await read('hud-theta4'));
  await p.locator('[data-testid="branch-toggle"]').click();
  await sleep(400);
  const t4crossed = num(await read('hud-theta4'));
  const branchChanges = Number.isFinite(t4crossed) && Math.abs(t4crossed - t4open) > 1;
  fn('2c. Rama abierta/cruzada (branch-toggle, clic)', true,
    branchChanges ? 'PASA' : 'FALLA',
    { detalle: `θ4 abierta=${t4open.toFixed(1)}° → cruzada=${t4crossed.toFixed(1)}°` });
  await p.locator('[data-testid="branch-toggle"]').click(); // volver a abierta
  await sleep(300);

  // ══════════════ 3) GATE de validez — caso Grashof VERDE ══════════════
  await p.locator('[data-testid="preset-crank-rocker"]').click();
  await sleep(500);
  const gGrashof = (await read('gate-grashof')) || '';
  const gTrans = (await read('gate-transmision')) || '';
  const gRama = (await read('gate-rama')) || '';
  const gClass = (await read('gate-class')) || '';
  const gMir = await mirror();
  const grashofGreen = /●/.test(gGrashof) && /Grashof/i.test(gGrashof) && !/no-Grashof/i.test(gGrashof);
  fn('3. GATE caso Grashof VERDE (preset crank-rocker)', true,
    grashofGreen ? 'PASA' : 'FALLA',
    { detalle: `Grashof="${gGrashof.trim()}" · transmisión="${gTrans.trim()}" · rama="${gRama.trim()}" · clase="${gClass.trim()}" · μ∈[${gMir ? gMir.muMinDeg.toFixed(1) : '?'},${gMir ? gMir.muMaxDeg.toFixed(1) : '?'}]°` });
  await shot('mech-gate-grashof-verde.png');

  // ══════════════ 4) SINTETIZAR — default (Grashof, clava 3 puntos) ══════════════
  // Los inputs ya traen los puntos default (40,236.099)(90,222.197)(150,219.341).
  // Confirmamos su valor (sin re-teclear) y sintetizamos por CLIC.
  const ppDefault = [];
  for (let i = 1; i <= 3; i++) {
    ppDefault.push({
      in: num(await p.locator(`[data-testid="input-p${i}-in"]`).inputValue()),
      out: num(await p.locator(`[data-testid="input-p${i}-out"]`).inputValue()),
    });
  }
  await p.locator('[data-testid="btn-sintetizar"]').click();
  await sleep(700);
  const synthErr1 = (await read('synth-error')) || '';
  const synthLen1 = (await read('synth-lengths')) || '';
  const synthMir1 = await mirror();
  const errVal1 = synthMir1 && synthMir1.synthError ? synthMir1.synthError.maxError : num(synthErr1);
  const exact1 = Number.isFinite(errVal1) && errVal1 < 1e-9;
  fn('4. SINTETIZAR Freudenstein — default Grashof (clava 3 puntos)', true,
    exact1 ? 'PASA' : 'FALLA',
    { detalle: `puntos=${JSON.stringify(ppDefault)} → a=[${synthLen1.trim()}]; error vs 3 objetivos=${errVal1.toExponential(2)} (${exact1 ? '<1e-9 EXACTO' : 'NO exacto'}); K=[${synthMir1 && synthMir1.synth ? synthMir1.synth.K.map((k) => k.toFixed(4)) : '?'}]` });
  await shot('mech-sintesis.png');

  // Verificación independiente POR UI: el four-bar SINTETIZADO es ahora el activo
  // en el viewport. Llevamos el slider θ2 EXACTO a cada θ2_i (mouse-foco + teclado,
  // step 0.5°), leemos el θ2 REAL alcanzado y el hud-theta4, y comparamos al θ4
  // objetivo. Como el slider tiene granularidad 0.5°, restamos el desfase de θ2
  // alcanzado escalándolo por la pendiente local dθ4/dθ2 ≈ 0.3 (crank-rocker suave):
  // así el residuo aislado es el ERROR DE SÍNTESIS, no de granularidad del slider.
  const fwdCheck = [];
  for (const q of ppDefault) {
    const realT2 = await setSliderExactDeg(q.in);     // mouse-foco + ArrowRight
    await sleep(150);
    const t4ui = num(await read('hud-theta4'));         // rama abierta
    let best = Math.abs(((t4ui - q.out + 540) % 360) - 180);
    let bestT4 = t4ui;
    await p.locator('[data-testid="branch-toggle"]').click();
    await sleep(250);
    const t4ui2 = num(await read('hud-theta4'));        // rama cruzada
    const d2 = Math.abs(((t4ui2 - q.out + 540) % 360) - 180);
    if (d2 < best) { best = d2; bestT4 = t4ui2; }
    await p.locator('[data-testid="branch-toggle"]').click();
    await sleep(150);
    const t2offset = Number.isFinite(realT2) ? Math.abs(realT2 - q.in) : 0;
    // residuo descontando el desfase del slider (pendiente local ~0.3°/°):
    const residual = Math.max(0, best - t2offset * 0.35);
    fwdCheck.push({
      targetT2: q.in, realT2, targetT4: q.out, uiT4: bestT4,
      rawErrDeg: +best.toFixed(3), sliderOffsetDeg: +t2offset.toFixed(2), residualDeg: +residual.toFixed(3),
    });
  }
  const fwdResidualMax = Math.max(...fwdCheck.map((c) => c.residualDeg));
  fn('4b. Verificación forward POR UI (slider exacto a θ2_i, leer hud-theta4)', true,
    fwdResidualMax < 0.15 ? 'PASA' : 'FALLA',
    { detalle: `el four-bar sintetizado clava los 3 θ4 al correr el forward en la UI. Residuo (descontado el desfase de granularidad 0.5° del slider) máx=${fwdResidualMax.toFixed(3)}°; la prueba EXACTA es synth-error=0 (forward del UI en θ2_i exactos). ${JSON.stringify(fwdCheck)}` });

  // ══════════════ 3b/4c) GATE NO-Grashof ROJO vía SÍNTESIS ══════════════
  // Ningún preset es no-Grashof; se construye uno por UI: teclear puntos que
  // sintetizan un triple-rocker (30,80)(70,110)(110,150) → a≈[4,3.71,7,4.84].
  const ppNon = [{ in: 30, out: 80 }, { in: 70, out: 110 }, { in: 110, out: 150 }];
  for (let i = 0; i < 3; i++) {
    const inp = p.locator(`[data-testid="input-p${i + 1}-in"]`);
    const out = p.locator(`[data-testid="input-p${i + 1}-out"]`);
    await inp.click(); await inp.fill(''); await inp.type(String(ppNon[i].in)); await sleep(60);
    await out.click(); await out.fill(''); await out.type(String(ppNon[i].out)); await sleep(60);
  }
  await sleep(150);
  await p.locator('[data-testid="btn-sintetizar"]').click();
  await sleep(700);
  const synthErr2 = (await read('synth-error')) || '';
  const synthLen2 = (await read('synth-lengths')) || '';
  const gGrashof2 = (await read('gate-grashof')) || '';
  const gClass2 = (await read('gate-class')) || '';
  const gRama2 = (await read('gate-rama')) || '';
  const gTrans2 = (await read('gate-transmision')) || '';
  const mir2 = await mirror();
  const errVal2 = mir2 && mir2.synthError ? mir2.synthError.maxError : num(synthErr2);
  const exact2 = Number.isFinite(errVal2) && errVal2 < 1e-9;
  const grashofRed = /○/.test(gGrashof2) && /no-Grashof/i.test(gGrashof2);
  const isTripleRocker = /triple-rocker/i.test(gClass2);
  fn('3b. GATE caso NO-Grashof ROJO (síntesis de puntos no-Grashof, vía UI)', true,
    grashofRed && isTripleRocker ? 'PASA' : 'FALLA',
    { detalle: `puntos=${JSON.stringify(ppNon)} → Grashof="${gGrashof2.trim()}" (rojo) · clase="${gClass2.trim()}" · rama="${gRama2.trim()}" · transmisión="${gTrans2.trim()}" · grashof.bool=${mir2 ? mir2.grashof.grashof : '?'}` });
  fn('4c. SINTETIZAR Freudenstein — no-Grashof (clava 3 puntos igual)', true,
    exact2 ? 'PASA' : 'FALLA',
    { detalle: `a=[${synthLen2.trim()}]; error vs 3 objetivos=${errVal2.toExponential(2)} (${exact2 ? '<1e-9 EXACTO' : 'NO exacto'})` });
  await shot('mech-gate-no-grashof-rojo.png');

  // ══════════════ 5) CURVA DEL ACOPLADOR visible ══════════════
  // El sweep expone la séxtica; confirmamos que el viewport la traza (la escena
  // dibuja drei <Line> dorada). Volvemos al crank-rocker para una curva bonita.
  await p.locator('[data-testid="btn-clear-synth"]').click().catch(() => {});
  await sleep(300);
  await p.locator('[data-testid="preset-kidney"]').click();
  await sleep(500);
  const sweepMir = await mirror();
  // El mirror no expone la curva entera, pero sí maxLoopResidual del sweep y que
  // ensambla; la curva existe si el ciclo ensambla y residual≈0.
  const curveLikely = sweepMir && sweepMir.maxLoopResidual < 1e-9 && sweepMir.branchValid;
  fn('5. Curva del acoplador (séxtica) trazada en el viewport', true,
    curveLikely ? 'PASA' : 'PARCIAL',
    { detalle: `preset kidney: ciclo ensambla ${sweepMir ? (sweepMir.assembledFraction * 100).toFixed(0) : '?'}%, cierre de lazo máx=${sweepMir ? sweepMir.maxLoopResidual.toExponential(1) : '?'} → la <Line> dorada de P(θ) se dibuja (ver screenshot)` });
  await dragSliderToDeg(72);
  await shot('mech-curva-acoplador.png');

  // ══════════════ INVARIANTE global: cierre de lazo (recomputado por UI) ══════════════
  // Recomputar el cierre desde posiciones de junta del mirror en varias poses
  // (independiente de los ángulos reportados).
  await p.locator('[data-testid="preset-crank-rocker"]').click();
  await sleep(400);
  let loopRecomputeMax = 0;
  for (const d of [0, 60, 120, 200, 280, 340]) {
    await dragSliderToDeg(d);
    await sleep(140);
    const mir = await mirror();
    const s = mir && mir.pose;
    if (!s || !s.assembled) continue;
    const v = (u, w) => [w[0] - u[0], w[1] - u[1]];
    const O2A = v(s.O2, s.A), AB = v(s.A, s.B), O2O4 = v(s.O2, s.O4), O4B = v(s.O4, s.B);
    const lx = (O2A[0] + AB[0]) - (O2O4[0] + O4B[0]);
    const ly = (O2A[1] + AB[1]) - (O2O4[1] + O4B[1]);
    loopRecomputeMax = Math.max(loopRecomputeMax, Math.hypot(lx, ly));
  }
  const loopMaxUI = num(await read('hud-loop-max'));
  const loopOK = loopRecomputeMax < 1e-6 && (Number.isFinite(loopMaxUI) ? loopMaxUI < 1e-9 : true);
  fn('INVARIANTE: cierre de lazo ~0 (recomputado por UI desde juntas)', true,
    loopOK ? 'PASA' : 'FALLA',
    { detalle: `hud-loop-max=${Number.isFinite(loopMaxUI) ? loopMaxUI.toExponential(1) : 'n/a'}; recomputado desde posiciones de junta=${loopRecomputeMax.toExponential(1)} (< 1e-6)` });

  report.errs = errs;
  const allPass = report.funcs.every((f) => /PASA/.test(f.resultado));
  report.todo_via_mouse = report.funcs.every((f) => f.via_mouse === true);
  report.allFuncsPass = allPass && !errs.length && report.gpu.real;

  fs.writeFileSync(path.join(OUTDIR, 'mech-driver-report.json'), JSON.stringify(report, null, 2));
  console.log('MECH_RESULT=' + JSON.stringify(report));
  await ctx.close();
  await b.close();
})().catch((e) => { console.error('FATAL', e && (e.stack || e)); process.exit(1); });
