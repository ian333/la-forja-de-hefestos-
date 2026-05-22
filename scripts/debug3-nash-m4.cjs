const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(`[PAGEERROR] ${e.message}`));
  await page.goto('http://localhost:5001/preview-escena.html?scene=nash-m4&aspect=16x9&t=20', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(10000);
  // Sample pixel center
  const px = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return 'no canvas';
    const ctx = c.getContext('webgl2') || c.getContext('webgl');
    if (!ctx) return 'no webgl';
    const pixels = new Uint8Array(4);
    ctx.readPixels(c.width / 2, c.height / 2, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);
    return Array.from(pixels);
  });
  console.log('center pixel RGBA:', px);
  // Check if any HTML elements report scene content
  const time = await page.evaluate(() => window.__sceneTime);
  console.log('sceneTime:', time);
  // Sample 9 points spread across canvas
  const grid = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return 'no canvas';
    const ctx = c.getContext('webgl2') || c.getContext('webgl');
    if (!ctx) return 'no webgl';
    const samples = [];
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        const px = Math.floor((c.width * x) / 4);
        const py = Math.floor((c.height * y) / 4);
        const pixels = new Uint8Array(4);
        ctx.readPixels(px, py, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);
        samples.push(`(${x},${y})=[${pixels[0]},${pixels[1]},${pixels[2]}]`);
      }
    }
    return samples.join(' ');
  });
  console.log('grid:', grid);
  await browser.close();
})();
