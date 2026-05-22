const { chromium } = require('playwright');
const url = process.argv[2];
const t = parseFloat(process.argv[3] || '8');
const fullUrl = `${url}&t=${t}`;
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(`PAGEERR: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning') {
      errors.push(`${m.type().toUpperCase()}: ${m.text().substring(0, 400)}`);
    }
  });
  page.on('response', r => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  console.log(`-> Loading ${fullUrl}`);
  await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('-> DOM loaded, waiting for __sceneTime...');
  try {
    await page.waitForFunction(() => typeof window.__sceneTime === 'number', { timeout: 30000 });
    console.log('-> __sceneTime set, taking screenshot');
  } catch (e) {
    console.log(`-> TIMEOUT waiting __sceneTime: ${e.message}`);
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/prod-shot.png', fullPage: false });
  console.log('--- console/errors ---');
  errors.forEach(e => console.log(e));
  await browser.close();
})();
