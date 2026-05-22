const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, bypassCSP: true });
  const page = await ctx.newPage();
  let mountCount = 0;
  page.on('console', m => {
    const t = m.text();
    if (t.includes('colormap') || t.includes('texture-') || t.includes('GPU stall')) return;
    if (t.includes('MOUNT')) mountCount++;
    console.log(`[${m.type()}] ${t.substring(0, 200)}`);
  });
  page.on('pageerror', e => console.log(`[PAGEERROR] ${e.message}`));
  page.on('requestfailed', r => console.log(`[REQFAIL] ${r.url()} ${r.failure()?.errorText}`));
  await page.goto('http://localhost:5001/preview-escena.html?scene=nash-m4&aspect=16x9&t=20', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(12000);
  const info = await page.evaluate(() => ({ st: window.__sceneTime ?? null }));
  console.log('mountCount:', mountCount, 'sceneTime:', info.st);
  await browser.close();
})();
