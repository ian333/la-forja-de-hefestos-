/**
 * La Forja — construye la pieza que GENERÓ el generador de mecanismos (evo-generar):
 * reductor cicloidal 16:1, autocentrado (garganta a 45° = el cono que eligió la
 * matemática), gap 0.69 (no se funde), imprimible en 1 pieza. GPU real.
 * (discos=3 por velocidad de build; el diseño completo lleva 5 para los 39 N·m.)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots';

// Genoma generado (champion del GA) → parámetros del builder
const CH = { lobes: 16, discs: 3, R: 21.4, Rr: 1.44, E: 0.39, T: 8.6, gap: 0.69, shaftD: 14.8, shaftBore: 7, outPins: 6, outPinD: 5 };

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const out = { shots: [], errs: [] };
  const shoot = async (name) => { const p = `${DIR}/${name}.png`; await page.screenshot({ path: p, timeout: 30000 }); out.shots.push(name); console.log(`✓ ${name}.png`); };
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', undefined, { timeout: 120000 });

    await page.evaluate((CH) => window.__forgeBrep.setSketch(s => ({ ...s, kind: 'gearbox', gearbox: { ...s.gearbox, ...CH } })), CH);
    const st = await page.waitForFunction(() => {
      const fb = window.__forgeBrep;
      if (fb && fb.error) return { error: String(fb.error).slice(0, 200) };
      const iv = fb && fb.invariants;
      if (iv && iv.n_faces && iv.n_faces > 30) return { built: true, n_faces: iv.n_faces, vol: iv.vol_kernel };
      return false;
    }, undefined, { timeout: 180000, polling: 1500 }).then(h => h.jsonValue()).catch((e) => ({ timeout: String(e).slice(0, 120) }));
    out.buildState = st;
    console.log('build:', JSON.stringify(st));
    await page.waitForTimeout(1500);

    await shoot('reductor-generado');
    await page.evaluate(() => window.__forgeBrep.setSection(true, 'y', 0));
    await page.waitForTimeout(1000);
    await shoot('reductor-generado-seccion');

    out.pass = out.shots.length === 2 && errs.length === 0;
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('GENERADO=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
