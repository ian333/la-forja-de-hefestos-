/**
 * ANÁLISIS DE VOLADIZOS visual + multi-vista (lo que pidió el usuario: no cantar
 * victoria sin ver). Enciende el mapa de voladizos sobre la caja y la captura desde
 * iso/top/front/right/left. Corre en iangpu (GPU) contra el dev server :5002.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const DIR = process.env.DIR || '/home/ian/Orkesta/la-forja/forja-shots/voladizos';

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
    // encender el mapa de VOLADIZOS (rojo = necesita soporte)
    await ev(() => window.__forgeBrep.setShowOverhangs(true));
    await page.waitForTimeout(1500);
    out.printReport = await ev(() => window.__forgeBrep.printReport);

    for (const v of ['iso', 'top', 'front', 'right', 'bottom']) {
      await ev((vv) => window.__forgeBrep.setView(vv), v);
      await page.waitForTimeout(900);
      await shot(`voladizos-${v}`);
    }
    out.errs = errs.slice(0, 8);
  } catch (e) { out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { await browser.close().catch(() => {}); }
  fs.writeFileSync(`${DIR}/data.json`, JSON.stringify(out, null, 2));
  console.log('OVERHANG=' + JSON.stringify({ printReport: out.printReport, errs: out.errs, fatal: out.fatal }, null, 2));
  process.exit(0);
})();
