const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1800, height: 1080 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('ERR:', e.message));
  await page.goto('http://localhost:5001/masterclass.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Empezar'))?.click());
  await page.waitForTimeout(300);
  await page.evaluate(() => { const a = document.querySelector('audio'); if (a) a.muted = true; });
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('siguiente'))?.click());
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const w320 = document.querySelector('[class*="w-[320px]"]');
    const katex = document.querySelectorAll('.katex');
    return {
      w320Exists: !!w320,
      w320Width: w320 ? w320.getBoundingClientRect().width : 0,
      katexCount: katex.length,
      katexFirst: katex[0] ? katex[0].outerHTML.slice(0, 200) : 'none',
    };
  });
  console.log(JSON.stringify(r, null, 2));
  await b.close();
})();
