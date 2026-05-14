const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1100 } });
  const page = await ctx.newPage();
  await page.goto('https://university.gaiaprime.com.mx/escuela.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/prod-escuela.png' });
  // Also screenshot the masterclass landing
  await page.goto('https://university.gaiaprime.com.mx/masterclass.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: '/tmp/prod-masterclass.png' });
  await b.close();
})();
