const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(`[PAGEERROR] ${e.message}`));
  page.on('console', m => {
    const t = m.text();
    if (t.includes('colormap') || t.includes('texture-') || t.includes('GPU stall') || t.includes('vite') || t.includes('Download') || t.includes('THREE\\.THREE')) return;
    console.log(`[${m.type()}] ${t.substring(0, 220)}`);
  });
  await page.goto('http://localhost:5001/preview-escena.html?scene=nash-m4&aspect=16x9&t=22', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 15000 });
  // Long wait: GLBs + useFrame iters
  await page.waitForTimeout(15000);
  const st = await page.evaluate(() => window.__sceneTime);
  console.log('sceneTime after 15s:', st);
  await page.screenshot({ path: '_shots-phases/nash-m4-DEBUG.png', timeout: 60000 });
  console.log('saved DEBUG screenshot');
  await browser.close();
})();
