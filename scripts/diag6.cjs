const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1800, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5001/masterclass.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Empezar'))?.click());
  await page.waitForTimeout(300);
  await page.evaluate(() => { const a = document.querySelector('audio'); if (a) a.muted = true; });
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('siguiente'))?.click());
  await page.waitForTimeout(3500);
  const r = await page.evaluate(() => {
    const w320 = document.querySelector('[class*="w-[320px]"]');
    const flex1 = document.querySelector('[class*="flex-1"][class*="relative h-full"]');
    const w320Rect = w320 ? w320.getBoundingClientRect() : null;
    const flex1Rect = flex1 ? flex1.getBoundingClientRect() : null;
    return {
      flex1Rect: flex1Rect && { x: flex1Rect.x, y: flex1Rect.y, w: flex1Rect.width, h: flex1Rect.height },
      w320Rect: w320Rect && { x: w320Rect.x, y: w320Rect.y, w: w320Rect.width, h: w320Rect.height },
      w320Display: w320 ? window.getComputedStyle(w320).display : null,
      w320Visibility: w320 ? window.getComputedStyle(w320).visibility : null,
    };
  });
  console.log(JSON.stringify(r, null, 2));
  await b.close();
})();
