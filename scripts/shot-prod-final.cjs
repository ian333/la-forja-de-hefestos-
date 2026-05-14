const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('https://university.gaiaprime.com.mx/masterclass.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Empezar'))?.click());
  await page.waitForTimeout(300);
  await page.evaluate(() => { const a = document.querySelector('audio'); if (a) a.muted = true; });
  // Jump to motor scene (index 14)
  for (let k = 0; k < 14; k++) {
    await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('siguiente'))?.click());
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(3500);
  await page.screenshot({ path: '/tmp/prod-motor-chalk.png' });
  console.log('done');
  await b.close();
})();
