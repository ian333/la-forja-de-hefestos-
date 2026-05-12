#!/usr/bin/env node
/** Screenshot the Hook of the 3 new lesson modules: Eigen, Möbius, Phase. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = '/tmp/lessons-3';
fs.mkdirSync(OUT, { recursive: true });

const MODULES = [
  { name: 'eigen',  branchId: 'linalg',  moduleId: 'eigen-3d' },
  { name: 'mobius', branchId: 'complex', moduleId: 'mobius' },
  { name: 'phase',  branchId: 'diffeq',  moduleId: 'phase-portrait' },
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

    await page.goto('http://localhost:5001/math.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const mod = page.locator(`[data-testid="module-${t.moduleId}"]`);
    if ((await mod.count()) === 0) {
      await page.locator(`[data-testid="branch-${t.branchId}"]`).click();
      await page.waitForTimeout(300);
    }
    await mod.click();

    try {
      await page.waitForFunction(
        () => !document.body.innerText.includes('compilando') && !!document.querySelector('canvas'),
        { timeout: 25000 },
      );
    } catch { console.log(`[warn] ${t.name} did not render`); }
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(OUT, `${t.name}-hook.png`) });
    console.log(`[shot] ${t.name} ${errs.length ? '(' + errs.length + ' errs: ' + errs[0] + ')' : ''}`);
    await ctx.close();
  }

  await browser.close();
})();
