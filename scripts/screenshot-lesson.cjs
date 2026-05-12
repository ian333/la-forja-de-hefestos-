#!/usr/bin/env node
/** Screenshot TangentPlane lesson at each step — hook → 6 steps → connect. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = '/tmp/lesson-screenshots';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1800, height: 1100 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errs.push(`error: ${m.text().slice(0, 300)}`); });

  await page.goto('http://localhost:5001/math.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Hook view (default after load)
  await page.screenshot({ path: path.join(OUT, '00-hook.png') });
  console.log('[shot] 00-hook');

  // Click "empezar →" 7 times: step1...step6, then connect
  const labels = ['01-step1', '02-step2', '03-step3', '04-step4', '05-step5', '06-step6', '07-connect'];
  for (const label of labels) {
    // Use locator with text — works for both "empezar →" and "siguiente →"
    const next = page.locator('button', { hasText: /empezar|siguiente/ }).first();
    if (await next.count() === 0) break;
    await next.click();
    await page.waitForTimeout(1500); // let state settle + surface re-render
    await page.screenshot({ path: path.join(OUT, `${label}.png`) });
    console.log(`[shot] ${label}`);
  }

  // Switch to sandbox tab
  await page.locator('button', { hasText: 'Sandbox' }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, '08-sandbox.png') });
  console.log('[shot] 08-sandbox');

  console.log('\n--- errors ---');
  for (const e of errs.slice(0, 20)) console.log(e);
  await browser.close();
})();
