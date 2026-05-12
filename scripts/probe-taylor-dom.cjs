#!/usr/bin/env node
/** Click Taylor, wait 10s, then dump DOM body text + check if Suspense resolved. */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(`[pageerror] ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error') errs.push(`[error] ${m.text().slice(0, 500)}`);
  });
  await page.goto('http://localhost:5001/math.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="branch-calc"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-testid="module-series"]').click();
  // wait LONG for slow shader compile
  await page.waitForTimeout(20000);
  const body = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log('--- body ---');
  console.log(body);
  console.log('--- errors ---');
  for (const e of errs.slice(0, 20)) console.log(e);
  await browser.close();
})();
