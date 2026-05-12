#!/usr/bin/env node
/** Quick smoke test — load each page and dump runtime errors + screenshot. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/tmp/debug-pages';
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: 'cad',     url: 'http://localhost:5001/' },
  { name: 'math',    url: 'http://localhost:5001/math.html' },
  { name: 'physics', url: 'http://localhost:5001/physics.html' },
  { name: 'lab',     url: 'http://localhost:5001/lab.html' },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

  for (const p of PAGES) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(`[pageerror] ${e.message}`));
    page.on('console', m => {
      if (m.type() === 'error') errs.push(`[console.error] ${m.text()}`);
    });
    try {
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2500);
    } catch (e) {
      errs.push(`[goto] ${e.message}`);
    }
    await page.screenshot({ path: path.join(OUT, `${p.name}.png`), fullPage: false });
    console.log(`\n=== ${p.name} (${p.url}) ===`);
    if (errs.length === 0) console.log('  (no errors)');
    else errs.slice(0, 20).forEach(l => console.log('  ' + l));
    await page.close();
  }

  await browser.close();
})();
