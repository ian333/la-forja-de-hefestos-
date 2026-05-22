const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', m => {
    const t = m.text();
    if (t.includes('colormap') || t.includes('texture-') || t.includes('vite') || t.includes('GPU stall')) return;
    console.log(`[${m.type()}] ${t.substring(0, 280)}`);
  });
  page.on('pageerror', e => console.log(`[PAGEERROR] ${e.message}`));
  await page.goto('http://localhost:5001/preview-escena.html?scene=ostrom&aspect=16x9&t=10', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(8000);
  const info = await page.evaluate(() => ({
    sceneTime: window.__sceneTime ?? 'undefined',
  }));
  console.log('--- OSTROM INFO ---', JSON.stringify(info));
  await browser.close();
})();
