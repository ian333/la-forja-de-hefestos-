const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('ERR:', e.message));
  
  // 1) Verify scroll on /escuela.html now works
  await page.goto('https://university.gaiaprime.com.mx/escuela.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const scrollResult = await page.evaluate(() => {
    const before = window.scrollY;
    window.scrollTo({ top: 1500, behavior: 'instant' });
    return { before, after: window.scrollY, scrollHeight: document.body.scrollHeight };
  });
  console.log('SCROLL TEST:', JSON.stringify(scrollResult));
  
  // 2) Masterclass: jump to end + screenshot picker
  await page.goto('https://university.gaiaprime.com.mx/masterclass.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Empezar'))?.click());
  await page.waitForTimeout(400);
  await page.evaluate(() => { const a = document.querySelector('audio'); if (a) a.muted = true; });
  for (let k = 0; k < 17; k++) {
    await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('siguiente'))?.click());
    await page.waitForTimeout(110);
  }
  await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('audio')?.dispatchEvent(new Event('ended')));
  await page.waitForTimeout(2200);
  await page.screenshot({ path: '/tmp/prod-picker-final.png' });
  console.log('picker prod shot OK');
  await b.close();
})();
