const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1800, height: 1100 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERR:', e.message));
  await page.goto('http://localhost:5001/math.html#complex/mobius', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);  // wait longer for Troika fonts
  await page.screenshot({ path: '/tmp/mobius-waited.png' });
  await b.close();
})();
