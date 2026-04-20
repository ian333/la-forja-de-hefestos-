// Headless screenshot of La Forja BrainView.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();

  page.on('console', (m) => console.log('[browser]', m.type(), m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('requestfailed', (r) => console.log('[reqfail]', r.url(), r.failure()?.errorText));

  const url = process.argv[2] || 'http://127.0.0.1:5001/brain.html';
  console.log('→', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(4000); // let Three.js tick a few frames
  await page.screenshot({ path: '/tmp/brain_01_module.png' });
  console.log('saved /tmp/brain_01_module.png');

  const clicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find((b) => /real\s*·\s*PCA/i.test(b.textContent || ''));
    if (btn) { btn.click(); return true; }
    return false;
  });
  console.log('PCA toggle clicked:', clicked);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/brain_02_pca.png' });
  console.log('saved /tmp/brain_02_pca.png');

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
