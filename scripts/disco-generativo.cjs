/**
 * La Forja — DISEÑO GENERATIVO con MAPA DE REGIONES sobre un DISCO (rueda /
 * disco cicloidal). El generativo congela el BORDE (rim/lóbulos) y el CUBO
 * central (barreno/eje) como sólido y aligera SOLO el alma → disco con rayos
 * orgánicos, superficies funcionales intactas, imprimible (self-support). GPU real.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots';

const DISCS = [
  { key: 'disco-r26', radius: 26, depth: 10, vf: 0.45, F: 1800 },
  { key: 'disco-r30', radius: 30, depth: 9, vf: 0.40, F: 2200 },
];

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const out = { discs: [], errs: [] };
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });

    for (const D of DISCS) {
      // disco = círculo radio R extruido depth
      await page.evaluate(({ radius }) => window.__forgeBrep.setSketch(s => ({ ...s, kind: 'circle', radius })), D);
      await page.waitForTimeout(400);
      const exId = await page.evaluate(() => (window.__forgeBrep.opsList.find(o => o.type === 'extrude') || {}).id);
      await page.evaluate(({ id, depth }) => window.__forgeBrep.updateOp(id, { depth }), { id: exId, depth: D.depth });
      await page.waitForTimeout(500);
      await page.waitForFunction('window.__forgeBrep.ready', { timeout: 20000 });

      // caras: tapas ±Z. Fija la de abajo, carga la de arriba (cortante → rayos).
      const faces = await page.evaluate(() => window.__forgeBrep.listFaces());
      const caps = faces.filter(f => Math.abs(f.normal[2]) > 0.8).sort((a, b) => a.center[2] - b.center[2]);
      if (caps.length < 2) throw new Error(`${D.key}: no encontré 2 tapas (caps=${caps.length})`);
      await page.evaluate(({ fix, load, F }) => {
        window.__forgeBrep.setFeaFixedFace(fix); window.__forgeBrep.setFeaLoadFace(load); window.__forgeBrep.setFeaLoad(F);
      }, { fix: caps[0].index, load: caps[caps.length - 1].index, F: D.F });
      await page.evaluate((vf) => window.__forgeBrep.setGenVolfrac(vf), D.vf);
      await page.waitForTimeout(200);

      // generativo con carga cortante en el plano del disco → el alma forma rayos.
      await page.evaluate(() => window.__forgeBrep.runGenerative([1, 0, 0]));
      await page.waitForFunction('window.__forgeBrep.genBusy === false && window.__forgeBrep.genResult !== null', { timeout: 120000 });
      await page.waitForTimeout(900);
      const gr = await page.evaluate(() => window.__forgeBrep.genResult);
      const shot = `${DIR}/generativo-${D.key}.png`;
      await page.screenshot({ path: shot, timeout: 30000 });
      out.discs.push({ key: D.key, vf: D.vf, nCells: gr && gr.nCells, kept: gr && gr.kept, voidPct: gr && gr.voidPct != null ? +gr.voidPct.toFixed(1) : null, loops: gr && gr.loops, shotKB: Math.round(fs.statSync(shot).size / 1024) });
      console.log(`✓ ${D.key}: ${gr ? gr.nCells : '?'} celdas, vaciado ${gr && gr.voidPct != null ? gr.voidPct.toFixed(0) : '?'}% → generativo-${D.key}.png`);
    }
    out.pass = out.discs.length === DISCS.length && errs.length === 0;
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('DISCO_SHOTS=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
