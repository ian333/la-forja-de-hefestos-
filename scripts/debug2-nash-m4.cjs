const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', m => {
    const t = m.text();
    if (t.includes('colormap') || t.includes('texture-')) return;
    console.log(`[${m.type()}] ${t.substring(0, 280)}`);
  });
  page.on('pageerror', e => console.log(`[PAGEERROR] ${e.message}\n${e.stack?.substring(0, 500)}`));
  await page.goto('http://localhost:5001/preview-escena.html?scene=nash-m4&aspect=16x9&t=20', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(15000);
  const info = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    return {
      sceneTime: window.__sceneTime ?? 'undefined',
      hasCanvas: !!c,
      canvasDisplay: c ? getComputedStyle(c).display : 'no canvas',
      canvasOpacity: c ? getComputedStyle(c).opacity : 'no canvas',
      rootChildren: document.getElementById('root')?.children.length ?? 'no root',
    };
  });
  console.log('---INFO---', JSON.stringify(info, null, 2));
  await browser.close();
})();
