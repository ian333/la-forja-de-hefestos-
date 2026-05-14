const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1800, height: 1080 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('ERR:', e.message));
  await page.goto('http://localhost:5001/masterclass.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Empezar'))?.click());
  await page.waitForTimeout(400);
  await page.evaluate(() => { const a = document.querySelector('audio'); if (a) a.muted = true; });
  // Jump to last scene (index 17)
  for (let k = 0; k < 17; k++) {
    await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('siguiente'))?.click());
    await page.waitForTimeout(120);
  }
  // Simulate audio end
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const a = document.querySelector('audio');
    if (a) a.dispatchEvent(new Event('ended'));
  });
  await page.waitForTimeout(2000);  // wait for fade-in
  await page.screenshot({ path: '/tmp/picker-end.png' });
  console.log('picker shot OK');
  await b.close();
})();
