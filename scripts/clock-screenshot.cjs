#!/usr/bin/env node
/**
 * Quick visual verification: open the mechanical clock panel, scrub to
 * t = 3723 s, capture a screenshot to /tmp/clock-verification.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/tmp/clock-verification';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(`[error] ${m.text()}`); });
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  const url = process.env.URL || 'http://localhost:5001/';
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Open omnibar, search, click.
  const input = page.locator('input[placeholder*="Buscar"]').first();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Control+K');
    if (await input.isVisible({ timeout: 1500 }).catch(() => false)) break;
  }
  await input.click();
  await input.pressSequentially('mechanical clock', { delay: 20 });
  await page.getByText('Mechanical clock (capstone)').click();
  await page.waitForTimeout(1500);

  await page.screenshot({ path: `${OUT}/clock-t0.png`, fullPage: false });

  // Scrub to t = 3723.
  const timeSlider = page.getByTestId('time-slider');
  await timeSlider.evaluate((el, v) => {
    const input = el;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, 3723);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/clock-t3723.png`, fullPage: false });

  console.log('screenshots →', OUT);
  if (logs.length) console.log('logs:\n' + logs.join('\n'));
  await browser.close();
})();
