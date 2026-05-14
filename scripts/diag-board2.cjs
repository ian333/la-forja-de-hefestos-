const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1800, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5001/masterclass.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  
  // Direct fetch — does the browser see board in the JSON?
  const result = await page.evaluate(async () => {
    const resp = await fetch('/audio/masterclass/i/manifest.json');
    const m = await resp.json();
    return {
      scene1: m.scenes[1],
      hasBoard: 'board' in m.scenes[1],
      boardType: typeof m.scenes[1].board,
      isArray: Array.isArray(m.scenes[1].board),
      length: m.scenes[1].board?.length,
    };
  });
  console.log(JSON.stringify(result, null, 2));
  await b.close();
})();
