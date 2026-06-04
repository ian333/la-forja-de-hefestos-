const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'http://localhost:5002/forja-brep.html';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots/sup2';
(async () => {
  fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR, { recursive: true });
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer', '--window-size=1280,1000'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  const ev = (fn, a) => page.evaluate(fn, a);
  const shot = (t) => page.screenshot({ path: `${DIR}/${t}.png`, timeout: 30000 });
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });
    await page.waitForTimeout(700);
    await ev(() => window.__forgeBrep.applyGearbox());
    await page.waitForFunction('window.__forgeBrep.gbBodies && window.__forgeBrep.gbBodies.length>0', { timeout: 40000 });
    await page.waitForTimeout(1600);
    // AISLAR los soportes → verlos solos
    await ev(() => window.__forgeBrep.isolateGbBody('soportes')); await page.waitForTimeout(900);
    await ev(() => window.__forgeBrep.orbitTo(28, 22, 115)); await page.waitForTimeout(500); await shot('s1-iso');
    await ev(() => window.__forgeBrep.orbitTo(0, 80, 120)); await page.waitForTimeout(500); await shot('s2-top');
    await ev(() => window.__forgeBrep.orbitTo(18, 6, 62)); await page.waitForTimeout(500); await shot('s3-near');
    // EN CONTEXTO: discos + soportes, sin hembra/brida, CORTADO → pilares en los huecos
    await ev(() => { window.__forgeBrep.showAllGbBodies(); window.__forgeBrep.toggleGbBody('hembra'); window.__forgeBrep.toggleGbBody('salida'); window.__forgeBrep.setSection(true, 'x', 0); });
    await page.waitForTimeout(1000);
    await ev(() => window.__forgeBrep.orbitTo(20, 10, 95)); await page.waitForTimeout(500); await shot('s4-contexto-corte');
    console.log('SUP2=' + JSON.stringify({ errs: errs.slice(0, 6) }));
  } catch (e) { console.log('SUP2_FATAL=' + String(e).slice(0, 300)); }
  finally { await b.close().catch(() => {}); }
  process.exit(0);
})();
