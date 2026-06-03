/**
 * La Forja — capturas del DISEÑO GENERATIVO en la UI (varias piezas).
 * Construye cada pieza, fija + carga caras, corre el generativo y screenshotea
 * la estructura óptima vaciada. Corre en iangpu (GPU real).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots';

// piezas: rect w×h extruido L (eje viga = Z). fija cap z≈0, carga cap z≈L transversal.
const PIECES = [
  { key: 'voladizo', w: 20, h: 20, L: 70, vf: 0.35, F: 1500 },
  { key: 'mensula', w: 40, h: 16, L: 44, vf: 0.40, F: 2000 },
  { key: 'columna', w: 28, h: 28, L: 64, vf: 0.30, F: 1200 },
];

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const out = { pieces: [], errs: [] };
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });

    for (const P of PIECES) {
      // construir viga rect w×h extruida L
      await page.evaluate(({ w, h }) => window.__forgeBrep.setSketch(s => ({ ...s, kind: 'rect', width: w, height: h })), P);
      await page.waitForTimeout(400);
      const exId = await page.evaluate(() => (window.__forgeBrep.opsList.find(o => o.type === 'extrude') || {}).id);
      await page.evaluate(({ id, L }) => window.__forgeBrep.updateOp(id, { depth: L }), { id: exId, L: P.L });
      await page.waitForTimeout(500);
      await page.waitForFunction('window.__forgeBrep.ready', { timeout: 20000 });
      // caras cap ±Z
      const faces = await page.evaluate(() => window.__forgeBrep.listFaces());
      const caps = faces.filter(f => Math.abs(f.normal[2]) > 0.8).sort((a, b) => a.center[2] - b.center[2]);
      await page.evaluate(({ fix, load, F }) => {
        window.__forgeBrep.setFeaFixedFace(fix); window.__forgeBrep.setFeaLoadFace(load); window.__forgeBrep.setFeaLoad(F);
      }, { fix: caps[0].index, load: caps[caps.length - 1].index, F: P.F });
      await page.evaluate((vf) => window.__forgeBrep.setGenVolfrac(vf), P.vf);
      await page.waitForTimeout(200);
      // correr generativo (carga transversal)
      await page.evaluate(() => window.__forgeBrep.runGenerative([0, -1, 0]));
      await page.waitForFunction('window.__forgeBrep.genBusy === false && window.__forgeBrep.genResult !== null', { timeout: 90000 });
      await page.waitForTimeout(900);
      const gr = await page.evaluate(() => window.__forgeBrep.genResult);
      const shot = `${DIR}/generativo-${P.key}.png`;
      await page.screenshot({ path: shot, timeout: 30000 });
      out.pieces.push({ key: P.key, vf: P.vf, nCells: gr && gr.nCells, kept: gr && gr.kept, voidPct: gr && +gr.voidPct.toFixed(1), loops: gr && gr.loops, shotKB: Math.round(fs.statSync(shot).size / 1024) });
      console.log(`✓ ${P.key}: ${gr ? gr.nCells : '?'} celdas, vaciado ${gr ? gr.voidPct.toFixed(0) : '?'}%, ${gr ? gr.loops : '?'} loops → generativo-${P.key}.png`);
    }
    out.pass = out.pieces.length === PIECES.length && errs.length === 0;
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('GEN_SHOTS=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
