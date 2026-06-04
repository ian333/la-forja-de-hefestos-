/**
 * ANÁLISIS POR CAPAS / corte interno: corte VERTICAL + mapa de voladizos para ver las
 * caras internas (caras de abajo de los discos) que desde afuera estaban tapadas. Y el
 * mismo corte en colores de cuerpo para inspeccionar el retenedor (axial). iangpu :5002.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const DIR = process.env.DIR || '/home/ian/Orkesta/la-forja/forja-shots/capas';

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=1680,1050'],
  });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  const out = { shots: {}, errs: [] };
  const ev = (fn, a) => page.evaluate(fn, a);
  const shot = async (tag) => { const p = `${DIR}/${tag}.png`; await page.screenshot({ path: p, timeout: 30000 }); out.shots[tag] = p; };
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });
    await page.waitForTimeout(700);
    await ev(() => window.__forgeBrep.applyGearbox());
    await page.waitForFunction('window.__forgeBrep.gbBodies && window.__forgeBrep.gbBodies.length > 0', { timeout: 40000 });
    await page.waitForTimeout(1600);

    // (A) CORTE VERTICAL + VOLADIZOS → ver las caras de abajo internas (rojo)
    await ev(() => { window.__forgeBrep.setShowOverhangs(true); window.__forgeBrep.setSection(true, 'x', 0); });
    await page.waitForTimeout(1400);
    await ev(() => window.__forgeBrep.setView('front')); await page.waitForTimeout(900);
    await shot('A1-voladizos-corte-front');
    await ev(() => window.__forgeBrep.setView('iso')); await page.waitForTimeout(900);
    await shot('A2-voladizos-corte-iso');

    // (B) CORTE en COLORES DE CUERPO (apago voladizos) → inspeccionar retenedor/axial
    await ev(() => window.__forgeBrep.setShowOverhangs(false)); await page.waitForTimeout(1000);
    await ev(() => window.__forgeBrep.setView('front')); await page.waitForTimeout(900);
    await shot('B1-cuerpos-corte-front');
    // acercar el corte fuera del centro para cruzar una leva + su disco (retenedor)
    await ev(() => window.__forgeBrep.setSectionOffset(0.12)); await page.waitForTimeout(700);
    await shot('B2-cuerpos-corte-leva');

    out.errs = errs.slice(0, 8);
  } catch (e) { out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { await browser.close().catch(() => {}); }
  fs.writeFileSync(`${DIR}/data.json`, JSON.stringify(out, null, 2));
  console.log('CAPAS=' + JSON.stringify({ errs: out.errs, fatal: out.fatal, shots: Object.keys(out.shots) }, null, 2));
  process.exit(0);
})();
