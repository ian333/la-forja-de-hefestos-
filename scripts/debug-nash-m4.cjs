const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const seen = new Set();
  page.on('console', m => {
    const t = m.text();
    if (t.includes('colormap')) return;
    if (!seen.has(t)) {
      seen.add(t);
      console.log(`[${m.type()}] ${t.substring(0, 240)}`);
    }
  });
  page.on('pageerror', e => console.log(`[PAGEERROR] ${e.message}`));
  await page.goto('http://localhost:5001/preview-escena.html?scene=nash-m4&aspect=16x9&t=20', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 15000 });
  await page.waitForTimeout(8000);
  const info = await page.evaluate(() => ({
    sceneTime: window.__sceneTime,
    canvasW: document.querySelector('canvas')?.width,
    canvasH: document.querySelector('canvas')?.height,
  }));
  console.log('info:', JSON.stringify(info));
  await browser.close();
})();
