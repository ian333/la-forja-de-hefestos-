#!/usr/bin/env node
/**
 * Visual verification harness for the Math Lab modules.
 *
 * Mirrors scripts/physics-screenshots.cjs but targets math.html. Opens each
 * `live` module through the sidebar (via data-testid), waits for the canvas
 * to paint, captures a screenshot, and records console errors.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = '/tmp/math-screenshots';
fs.mkdirSync(OUT, { recursive: true });

const MODULES = [
  { name: 'tangent-plane', branchId: 'calc',    moduleId: 'tangent-plane' },
  { name: 'taylor',        branchId: 'calc',    moduleId: 'series' },
  { name: 'eigen-3d',      branchId: 'linalg',  moduleId: 'eigen-3d' },
  { name: 'mobius',        branchId: 'complex', moduleId: 'mobius' },
  { name: 'phase',         branchId: 'diffeq',  moduleId: 'phase-portrait' },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1800, height: 1100 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:5001/math.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  for (const t of MODULES) {
    const moduleSel = page.locator(`[data-testid="module-${t.moduleId}"]`);
    if ((await moduleSel.count()) === 0) {
      await page.locator(`[data-testid="branch-${t.branchId}"]`).click();
      await page.waitForTimeout(200);
    }
    await moduleSel.click();
    // Synchronize on the Suspense transition: wait for "compilando" to APPEAR
    // (the previous module is being torn down), then wait for it to disappear
    // (new module mounted). Otherwise we'd capture mid-transition.
    try {
      await page.waitForFunction(
        () => document.body.innerText.includes('compilando'),
        { timeout: 3000 },
      );
    } catch { /* already loaded — no transition needed */ }
    try {
      await page.waitForFunction(
        () => !document.body.innerText.includes('compilando') && !!document.querySelector('canvas'),
        { timeout: 30000 },
      );
    } catch (e) {
      console.log(`[warn] ${t.name} canvas didn't appear in 30s`);
    }
    await page.waitForTimeout(2500);

    const full = path.join(OUT, `${t.name}.png`);
    await page.screenshot({ path: full, fullPage: false, animations: 'disabled', timeout: 60000 });
    const viewport = path.join(OUT, `${t.name}-canvas.png`);
    await page.screenshot({
      path: viewport,
      clip: { x: 280, y: 62, width: 1178, height: 1038 },
      animations: 'disabled',
      timeout: 60000,
    });
    console.log(`[shot] ${t.name}`);
  }

  await browser.close();

  if (logs.length) {
    console.log('\n--- console issues ---');
    for (const l of logs.slice(0, 40)) console.log(l);
  } else {
    console.log('\n(no console issues)');
  }
})();
