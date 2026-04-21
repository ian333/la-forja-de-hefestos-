const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(`pageerror: ${e.message}`));
  await page.goto('http://localhost:5001/physics.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const title = await page.title();
  const bodyText = await page.locator('body').innerText().catch(() => 'no body');
  console.log('TITLE:', title);
  console.log('BODY (first 800 chars):');
  console.log(bodyText.slice(0, 800));
  console.log('ERRORS:', errs.slice(0,10));
  await browser.close();
})();
