#!/usr/bin/env node
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = '/tmp/complex-shots';
fs.mkdirSync(OUT, { recursive: true });

const MODULES = [
  { name: 'mobius',    branchId: 'complex', moduleId: 'mobius' },
  { name: 'newton',    branchId: 'complex', moduleId: 'roots' },
  { name: 'conformal', branchId: 'complex', moduleId: 'conformal' },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--no-sandbox'],
  });

  for (const t of MODULES) {
    const ctx = await browser.newContext({ viewport: { width: 1800, height: 1100 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errs.push(`error: ${m.text().slice(0, 200)}`); });

    // Use the new hash routing to jump directly
    await page.goto(`http://localhost:5001/math.html#${t.branchId}/${t.moduleId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    try {
      await page.waitForFunction(
        () => !document.body.innerText.includes('compilando') && !!document.querySelector('canvas'),
        { timeout: 25000 },
      );
    } catch { console.log(`[warn] ${t.name} timeout`); }
    await page.waitForTimeout(3000);

    await page.screenshot({ path: path.join(OUT, `${t.name}.png`) });
    console.log(`[shot] ${t.name} ${errs.length ? '(' + errs.length + ' errs: ' + errs[0] + ')' : 'OK'}`);
    await ctx.close();
  }

  await browser.close();
})();
