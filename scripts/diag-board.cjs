const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1800, height: 1080 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('ERR:', e.message));
  await page.goto('http://localhost:5001/masterclass.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Empezar'))?.click());
  await page.waitForTimeout(500);
  await page.evaluate(() => { const a = document.querySelector('audio'); if (a) a.muted = true; });
  // Single click to scene 02
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('siguiente'))?.click());
  await page.waitForTimeout(2000);
  const info = await page.evaluate(() => {
    const txt = document.querySelector('p')?.textContent?.slice(0, 80);
    const chalkboard = document.querySelector('[class*="chalkboard"], [style*="0F2A1F"]');
    return { subtitle: txt, hasChalkboard: !!chalkboard, allDivs: document.querySelectorAll('div').length };
  });
  console.log('DIAG:', JSON.stringify(info, null, 2));
  await page.screenshot({ path: '/tmp/diag-02.png' });
  await b.close();
})();
