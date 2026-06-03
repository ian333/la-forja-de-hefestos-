/**
 * La Forja — VERIFICACIÓN del FEA-MIENTRAS-DISEÑAS (incremental + warm-start) en la VIGA.
 * =====================================================================================
 * Cantilever L=100×b=10×h=20 mm, Aluminio 6061. Cara z=0 empotrada; carga transversal.
 * Analítico: σ = M·c/I = F·L·(h/2)/(b·h³/12). Para F=200 N → 30 MPa (lineal en F).
 *
 * Comprueba la Rebanada 1 del live-FEA:
 *  #1 warm = frío   : re-solve a 200 N (warm desde 400) == solve frío a 200 N.
 *  #2 analítico     : σ(200) en la banda de σ=Mc/I.
 *  #3 linealidad    : σ(400) ≈ 2·σ(200).
 *  #4 velocidad     : el re-solve incremental usa MENOS iteraciones que el frío (warm-start) y es rápido (ms).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const SHOT = process.env.SHOT || '/home/ian/Orkesta/la-forja/forja-shots/fea-live.png';
const L = 100, b = 10, h = 20, F = 200;
const I = (b * h ** 3) / 12, sigmaAnalytic = (F * L * (h / 2)) / I; // 30 MPa

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const out = { sigmaAnalytic, errs: [] };
  const R = () => page.evaluate(() => window.__forgeBrep.feaResult);
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });
    // viga: rect b×h, extrude depth=L
    await page.evaluate(({ b, h }) => window.__forgeBrep.setSketch(s => ({ ...s, kind: 'rect', width: b, height: h })), { b, h });
    await page.waitForTimeout(400);
    const exId = await page.evaluate(() => (window.__forgeBrep.opsList.find(o => o.type === 'extrude') || {}).id);
    await page.evaluate(({ id, L }) => window.__forgeBrep.updateOp(id, { depth: L }), { id: exId, L });
    await page.waitForTimeout(600);
    await page.waitForFunction('window.__forgeBrep.ready', { timeout: 30000 });
    await page.selectOption('[data-testid="select-material"]', 'alu').catch(() => {});
    await page.waitForTimeout(300);
    // caras cap ±Z
    const faces = await page.evaluate(() => window.__forgeBrep.listFaces());
    const caps = faces.filter(f => Math.abs(f.normal[2]) > 0.8).sort((a, b) => a.center[2] - b.center[2]);
    if (caps.length < 2) throw new Error('no hay 2 caras ±Z');
    await page.evaluate(({ fix, load, F }) => {
      window.__forgeBrep.setFeaFixedFace(fix); window.__forgeBrep.setFeaLoadFace(load); window.__forgeBrep.setFeaLoad(F);
    }, { fix: caps[0].index, load: caps[caps.length - 1].index, F });
    await page.waitForTimeout(300);

    // ── SOLVE FRÍO a 200 N (crea la sesión) — medimos el wall-clock COMPLETO ──
    const tc0 = Date.now();
    await page.evaluate(() => window.__forgeBrep.runFEADir([0, -1, 0]));
    await page.waitForFunction('window.__forgeBrep.feaBusy === false && window.__forgeBrep.feaReady === true', { timeout: 90000 });
    const tCold = Date.now() - tc0; // incluye mallar+clasificar+ensamblar+solve (lo caro)
    await page.waitForTimeout(300);
    const cold = await R();
    out.sessionReady = await page.evaluate(() => window.__forgeBrep.feaSessionReady);
    out.cold = { vm: cold.maxVonMises_MPa, iters: cold.iterations, conv: cold.converged, wallMs: tCold };

    // ── LIVE paso CHICO 200→210 (warm-start brilla: u casi no se mueve) ──
    await page.evaluate(() => window.__forgeBrep.feaLiveSetLoad(210));
    await page.waitForTimeout(300);
    const r210 = await R(); const ms210 = await page.evaluate(() => window.__forgeBrep.feaLiveMs);
    out.live210 = { vm: r210.maxVonMises_MPa, iters: r210.iterations, conv: r210.converged, ms: ms210 };

    // ── LIVE a 400 N (×2) → linealidad ──
    await page.evaluate(() => window.__forgeBrep.feaLiveSetLoad(400));
    await page.waitForTimeout(300);
    const r400 = await R();
    out.live400 = { vm: r400.maxVonMises_MPa, iters: r400.iterations, conv: r400.converged };

    // ── LIVE de vuelta a 200 N → debe == frío (warm no cambia la respuesta) ──
    await page.evaluate(() => window.__forgeBrep.feaLiveSetLoad(200));
    await page.waitForTimeout(300);
    const r200 = await R(); const ms200 = await page.evaluate(() => window.__forgeBrep.feaLiveMs);
    out.live200 = { vm: r200.maxVonMises_MPa, iters: r200.iterations, conv: r200.converged, ms: ms200 };

    await page.screenshot({ path: SHOT, timeout: 30000 });
    out.shotBytes = fs.statSync(SHOT).size;

    const band = (v, t) => v > 0.5 * t && v < 2.2 * t;
    out.checks = {
      session_creada: out.sessionReady === true,                                          // la sesión se cacheó
      analitico_200: band(out.cold.vm, sigmaAnalytic),                                     // #2 σ≈Mc/I
      linealidad_400: Math.abs(out.live400.vm / out.cold.vm - 2) < 0.05,                   // #3 2×carga→2×σ
      warm_igual_frio: Math.abs(out.live200.vm - out.cold.vm) / out.cold.vm < 0.005,       // #1 warm==frío
      warmstart_acelera_paso_chico: out.live210.iters < out.cold.iters,                    // #4a warm-start corta iters en paso chico
      live_mucho_mas_rapido: out.live210.ms != null && out.live210.ms < tCold * 0.5,       // #4b re-solve incremental ≪ frío (no re-malla)
      todo_converge: out.cold.conv && out.live210.conv && out.live400.conv && out.live200.conv,
      sin_errores: errs.length === 0,
    };
    out.speedup = out.live210.ms != null ? +(tCold / out.live210.ms).toFixed(1) : null;
    out.pass = Object.values(out.checks).every(Boolean);
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('FEA_LIVE=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
