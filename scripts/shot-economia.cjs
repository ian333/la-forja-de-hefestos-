#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/tmp/economia-shots';
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

  await page.goto('http://localhost:5001/economia.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  await page.screenshot({ path: `${OUT}/01-top.png` });

  await page.evaluate(() => window.scrollBy(0, 950));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/02-manifesto.png` });

  await page.evaluate(() => window.scrollBy(0, 950));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/03-block-mercados-fallan.png` });

  await page.evaluate(() => window.scrollBy(0, 1400));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/04-bloque-juegos.png` });

  // Full page
  await page.screenshot({ path: `${OUT}/full.png`, fullPage: true });

  console.log(`errs: ${errs.length}`);
  if (errs.length) console.log(errs.slice(0, 4).join('\n'));
  console.log('out:', OUT);
  await browser.close();
})();
