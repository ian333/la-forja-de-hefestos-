const { chromium } = require('playwright');
async function run(scene, url) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const start = Date.now();
  let firstFrame = null;
  page.on('console', m => {
    if (m.text().includes('first useFrame')) firstFrame = Date.now() - start;
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(20000);
  const st = await page.evaluate(() => window.__sceneTime);
  const elapsed = Date.now() - start;
  console.log(`${scene}: sceneTime=${st} after ${elapsed}ms (firstFrame=${firstFrame}ms)`);
  await browser.close();
}
(async () => {
  await run('NashM4', 'http://localhost:5001/preview-escena.html?scene=nash-m4&aspect=16x9&t=10');
  await run('Ostrom', 'http://localhost:5001/preview-escena.html?scene=ostrom&aspect=16x9&t=10');
})();
