const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox', '--use-angle=gl', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--enable-gpu-rasterization',
    ],
  });
  const ctx = await browser.newContext({ viewport: { width: 2160, height: 3840 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error('PAGE ERR:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE:', m.text().slice(0, 300)); });
  // Cargar como masterclass + render mode + deterministic mode
  await page.goto('http://localhost:5001/masterclass.html?id=econ-18-duflo&render=1&deterministic=1', { waitUntil: 'networkidle' });
  // Esperar render clock ready
  await page.waitForFunction(() => window.__renderClockReady === true, { timeout: 20000 });
  // Avanzar a phase 2 (RCT): start=14.3+16.0=30.3s, midpoint ~37s
  for (const [name, t] of [['p0-pregunta', 5], ['p1-mito', 22], ['p2-rct', 37], ['p3-kenya', 60], ['p4-mexico', 80], ['p5-cierre', 95]]) {
    await page.evaluate((tt) => window.renderAt(tt), t);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: `/tmp/duflo-${name}.png`, type: 'png', clip: { x: 0, y: 0, width: 2160, height: 3840 } });
    console.log(`${name} at t=${t}s captured`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
