const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1800, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5001/masterclass.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Empezar'))?.click());
  await page.waitForTimeout(500);
  await page.evaluate(() => { const a = document.querySelector('audio'); if (a) a.muted = true; });
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('siguiente'))?.click());
  await page.waitForTimeout(6000);  // extra long wait — let all animations finish
  await page.screenshot({ path: '/tmp/chalkboard-shots/02-paradoja-LONG.png' });
  console.log('done');
  await b.close();
})();
