/**
 * Hace click en PLAY y captura la escena después de que arranque el audio.
 */
const { chromium } = require('playwright');
const t = parseFloat(process.argv[2] || '4');
const PORT = 5183;
const url = `http://localhost:${PORT}/preview-escena.html?aspect=16x9`;
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(`ERR: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error') console.log(`CON: ${m.text().substring(0, 200)}`);
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  // Click the play button
  // Click any button (PLAY overlay)
  await page.evaluate(() => {
    const btn = document.querySelector('button');
    if (btn) btn.click();
  });
  await page.waitForTimeout(t * 1000);
  // Mute audio for screenshot context (we just want visual confirmation)
  const sceneTime = await page.evaluate(() => window.__sceneTime || 0);
  console.log('sceneTime:', sceneTime);
  const out = `_shots-phases/clickplay-t${t.toFixed(1)}.png`;
  await page.screenshot({ path: out, fullPage: false });
  console.log(`✓ ${out}`);
  await browser.close();
})();
