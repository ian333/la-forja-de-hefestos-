#!/usr/bin/env node
/** Hit math.html, click Taylor, capture full console + any pageerror. */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  const events = [];
  page.on('pageerror', e => events.push(`[pageerror] ${e.message}\n${e.stack ?? ''}`));
  page.on('console', m => {
    const t = m.type();
    events.push(`[${t}] ${m.text().slice(0, 500)}`);
  });

  await page.goto('http://localhost:5001/math.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);

  // Click on the Series Taylor module
  await page.locator('[data-testid="branch-calc"]').click().catch(() => {});
  await page.waitForTimeout(300);
  await page.locator('[data-testid="module-series"]').click().catch(() => {});
  await page.waitForTimeout(5000);

  console.log('--- events ---');
  for (const e of events.slice(0, 50)) console.log(e);

  await browser.close();
})();
