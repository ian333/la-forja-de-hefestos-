#!/usr/bin/env node
/**
 * Open each math module in its OWN browser context — no module-switching
 * races. Slower but truthful to what the real user sees.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = '/tmp/math-screenshots-iso';
fs.mkdirSync(OUT, { recursive: true });

const MODULES = [
  { name: 'tangent-plane', branchId: 'calc',    moduleId: 'tangent-plane' },
  { name: 'derivative',    branchId: 'calc',    moduleId: 'derivative-1d' },
  { name: 'integral',      branchId: 'calc',    moduleId: 'integral-area' },
  { name: 'taylor',        branchId: 'calc',    moduleId: 'series' },
  { name: 'vector-fields', branchId: 'calc',    moduleId: 'vector-fields' },
  { name: 'eigen-3d',      branchId: 'linalg',  moduleId: 'eigen-3d' },
  { name: 'mobius',        branchId: 'complex', moduleId: 'mobius' },
  { name: 'phase',         branchId: 'diffeq',  moduleId: 'phase-portrait' },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox'],
  });

  for (const t of MODULES) {
    const ctx = await browser.newContext({ viewport: { width: 1800, height: 1100 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(`pageerror: ${e.message}`));
    page.on('console', m => {
      if (m.type() === 'error') errs.push(`error: ${m.text().slice(0, 200)}`);
    });

    await page.goto('http://localhost:5001/math.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    if (t.moduleId !== 'tangent-plane') {
      const branchSel = page.locator(`[data-testid="branch-${t.branchId}"]`);
      const modSel    = page.locator(`[data-testid="module-${t.moduleId}"]`);
      if ((await modSel.count()) === 0) {
        await branchSel.click();
        await page.waitForTimeout(300);
      }
      await modSel.click();
    }

    try {
      await page.waitForFunction(
        () => !document.body.innerText.includes('compilando') && !!document.querySelector('canvas'),
        { timeout: 30000 },
      );
    } catch { console.log(`[warn] ${t.name} timeout`); }
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: path.join(OUT, `${t.name}-canvas.png`),
      clip: { x: 280, y: 62, width: 1178, height: 1038 },
    });
    console.log(`[shot] ${t.name} ${errs.length ? '(' + errs.length + ' errs)' : ''}`);
    await ctx.close();
  }

  await browser.close();
})();
