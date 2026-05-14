const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1800, height: 1080 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERR:', e.message));
  page.on('console', m => console.log(m.type().toUpperCase()+':', m.text().slice(0, 200)));
  await page.goto('http://localhost:5001/masterclass.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Empezar'))?.click());
  await page.waitForTimeout(300);
  await page.evaluate(() => { const a = document.querySelector('audio'); if (a) a.muted = true; });
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('siguiente'))?.click());
  await page.waitForTimeout(1500);
  // Inspect: find chalkboard children
  const info = await page.evaluate(() => {
    const root = document.getElementById('root');
    // Look for the 380px div
    const w380 = document.querySelectorAll('[class*="w-[380px]"]');
    // Look for Chalkboard's wood frame
    const wood = document.querySelectorAll('[style*="5d3a1f"]');
    return {
      w380Count: w380.length,
      woodCount: wood.length,
      rootHTML_first200: root?.innerHTML?.slice(0, 400),
    };
  });
  console.log('INFO:', JSON.stringify(info, null, 2));
  await b.close();
})();
