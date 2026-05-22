/**
 * Captura el preview SIN ?t=N para ver el PLAY button.
 */
const { chromium } = require('playwright');
const aspect = process.argv[2] || '16x9';
const PORT = 5183;
const url = `http://localhost:${PORT}/preview-escena.html?aspect=${aspect}`;
const viewport = aspect === '16x9' ? { width: 1600, height: 900 } : { width: 540, height: 960 };
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'] });
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  const out = `_shots-phases/playbutton-${aspect}.png`;
  await page.screenshot({ path: out, fullPage: false });
  console.log(`✓ ${out}`);
  await browser.close();
})();
