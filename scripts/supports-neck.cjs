const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'http://localhost:5002/forja-brep.html';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots/neck';
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
    // (1) soportes AISLADOS, super cerca → ver forma cuello+cuerpo
    await ev(() => window.__forgeBrep.isolateGbBody('soportes')); await page.waitForTimeout(800);
    await ev(() => window.__forgeBrep.orbitTo(20, 6, 42)); await page.waitForTimeout(500); await shot('n1-cerca');
    // (2) soportes + 2 discos (disco-2,3) cortado → ver que bridgean el hueco
    await ev(() => { window.__forgeBrep.toggleGbBody('disco-2'); window.__forgeBrep.toggleGbBody('disco-3'); window.__forgeBrep.setSection(true, 'x', 0); });
    await page.waitForTimeout(900);
    await ev(() => window.__forgeBrep.orbitTo(15, 8, 55)); await page.waitForTimeout(500); await shot('n2-discos-corte');
    await ev(() => window.__forgeBrep.orbitTo(60, 18, 48)); await page.waitForTimeout(500); await shot('n3-discos-corte2');
    console.log('NECK=' + JSON.stringify({ errs: errs.slice(0, 6) }));
  } catch (e) { console.log('NECK_FATAL=' + String(e).slice(0, 300)); }
  finally { await b.close().catch(() => {}); }
  process.exit(0);
})();
