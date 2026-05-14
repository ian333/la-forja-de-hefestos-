#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/tmp/econ-lab-shots';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1800, height: 1080 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 220)); });

  await page.goto('http://localhost:5001/econ-lab.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  await page.screenshot({ path: `${OUT}/01-lab-default.png` });

  // Click a different preset (Mercado de cherries)
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const target = btns.find(b => b.textContent?.includes('Mercado de cherries'));
    if (target) target.click();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/02-cherries-preset.png` });

  // Switch to cuadratic valuation
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const target = btns.find(b => b.textContent?.includes('q²'));
    if (target) target.click();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/03-quadratic.png` });

  console.log(`errs: ${errs.length}`);
  if (errs.length) console.log(errs.slice(0, 4).join('\n'));
  await browser.close();
})();
