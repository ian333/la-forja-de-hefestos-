#!/usr/bin/env node
const { chromium } = require('playwright');

const TARGETS = [
  { name: 'home',         url: 'http://localhost:5001/math.html' },
  { name: 'tangent',      url: 'http://localhost:5001/math.html#calc/tangent-plane' },
  { name: 'mobius',       url: 'http://localhost:5001/math.html#complex/mobius' },
  { name: 'newton',       url: 'http://localhost:5001/math.html#complex/roots' },
  { name: 'conformal',    url: 'http://localhost:5001/math.html#complex/conformal' },
  { name: 'matrix3d',     url: 'http://localhost:5001/math.html#linalg/matrix-3d' },
  { name: 'rotations',    url: 'http://localhost:5001/math.html#linalg/rotations' },
  { name: 'pca',          url: 'http://localhost:5001/math.html#linalg/pca' },
];

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--no-sandbox'] });
  for (const t of TARGETS) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(`PAGEERR: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errs.push(`CONSOLE: ${m.text().slice(0, 300)}`); });

    await page.goto(t.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    const hasCanvas = await page.evaluate(() => !!document.querySelector('canvas'));
    const isBlack = await page.evaluate(() => {
      // Check if main content area is mostly empty
      const main = document.querySelector('main, section');
      if (!main) return 'no-main';
      return main.innerText.length < 5 ? 'mostly-empty' : 'has-text';
    });
    const stillCompiling = await page.evaluate(() => document.body.innerText.includes('compilando'));

    console.log(`[${t.name}]  canvas=${hasCanvas}  content=${isBlack}  compiling=${stillCompiling}`);
    if (errs.length) {
      console.log(`  errs: ${errs.slice(0, 3).join(' | ')}`);
    }
    await ctx.close();
  }
  await browser.close();
})();
