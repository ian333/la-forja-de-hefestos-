const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=gl', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5001/masterclass.html?id=econ-18-duflo&render=1&deterministic=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__renderClockReady === true, { timeout: 45000 });
  for (const [name, t] of [['p2', 42], ['p4', 78]]) {
    await page.evaluate((tt) => window.renderAt(tt), t);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await new Promise(r => setTimeout(r, 250));
    await page.screenshot({ path: `/tmp/duflo-v4-${name}.png`, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
    console.log(`${name}`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
