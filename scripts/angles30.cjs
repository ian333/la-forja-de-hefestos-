/**
 * 30+ ÁNGULOS INTERNOS: quita la brida + hembra, enciende el movimiento, corta en
 * sección, y orbita la cámara — lejos y cerca — capturando el mecanismo moviéndose
 * desde muchos ángulos (lo que el usuario exigió). iangpu :5002, GPU real.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const DIR = process.env.DIR || '/home/ian/Orkesta/la-forja/forja-shots/a30';

(async () => {
  fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=1280,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  const out = { n: 0, errs: [] };
  const ev = (fn, a) => page.evaluate(fn, a);
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });
    await page.waitForTimeout(700);
    await ev(() => window.__forgeBrep.applyGearbox());
    await page.waitForFunction('window.__forgeBrep.gbBodies && window.__forgeBrep.gbBodies.length > 0', { timeout: 40000 });
    await page.waitForTimeout(1500);
    // quitar BRIDA + hembra, encender MOVIMIENTO, CORTAR
    await ev(() => { window.__forgeBrep.toggleGbBody('salida'); window.__forgeBrep.toggleGbBody('hembra'); });
    await ev(() => window.__forgeBrep.setGbMotion(true));
    await page.waitForFunction('window.__forgeBrep.gbMotionInfo && window.__forgeBrep.gbMotionInfo.ready', { timeout: 30000 });
    await ev(() => window.__forgeBrep.setSection(true, 'x', 0));
    await page.waitForTimeout(1200);

    let n = 0;
    const grab = async (az, el, r) => { await ev(({ az, el, r }) => window.__forgeBrep.orbitTo(az, el, r), { az, el, r }); await page.waitForTimeout(280); await page.screenshot({ path: `${DIR}/a${String(n).padStart(2, '0')}.png`, timeout: 30000 }); n++; };
    // LEJOS: 24 ángulos alrededor, elevación variando
    for (let i = 0; i < 24; i++) await grab(i * 15, 12 + (i % 3) * 12, 155);
    // CERCA: 12 ángulos, más metido (zoom in al mecanismo)
    for (let i = 0; i < 12; i++) await grab(i * 30, 20, 80);
    out.n = n; out.errs = errs.slice(0, 8);
  } catch (e) { out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { await browser.close().catch(() => {}); }
  console.log('A30=' + JSON.stringify(out, null, 2));
  process.exit(0);
})();
