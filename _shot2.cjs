const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=gl', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error('ERR:', e.message));
  await page.goto('http://localhost:5001/masterclass.html?id=econ-18-duflo&render=1&deterministic=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__renderClockReady === true, { timeout: 20000 });
  // Phases medio: 0→7, 1→22, 2→40, 3→60, 4→78, 5→95
  for (const [name, t] of [['p1', 22], ['p2', 40], ['p3', 60], ['p4', 78], ['p5', 95]]) {
    await page.evaluate((tt) => window.renderAt(tt), t);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await new Promise(r => setTimeout(r, 200));
    await page.screenshot({ path: `/tmp/duflo-v2-${name}.png`, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
    console.log(`${name}`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
