#!/usr/bin/env node
/**
 * Per-preset visual verification for the Solar System module.
 * Screenshots every preset in /src/lib/physics/presets.ts after enough
 * simulation time that trails are visible.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = '/tmp/physics-screenshots/solar';
fs.mkdirSync(OUT, { recursive: true });

const PRESETS = [
  'sun-earth',
  'sun-earth-moon',
  'inner',
  'full',
  'binary',
  'figure-8',
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

  await page.goto('http://localhost:5001/physics.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Open the solar system module
  if ((await page.locator('[data-testid="module-solar-system"]').count()) === 0) {
    await page.locator('[data-testid="branch-astro"]').click();
    await page.waitForTimeout(200);
  }
  await page.locator('[data-testid="module-solar-system"]').click();
  await page.waitForFunction(
    () => !document.body.innerText.includes('compilando') && !!document.querySelector('canvas'),
    { timeout: 15000 },
  );

  for (const pid of PRESETS) {
    // Select preset
    await page.locator(`[data-testid="preset-${pid}"]`).click();
    // Let the simulation rip so trails actually accumulate
    await page.waitForTimeout(5000);
    const shot = path.join(OUT, `${pid}.png`);
    await page.screenshot({ path: shot, clip: { x: 280, y: 62, width: 1178, height: 1038 }, animations: 'disabled', timeout: 60000 });
    console.log(`[shot] solar/${pid}`);
  }

  await browser.close();
  if (logs.length) {
    console.log('\n--- console issues ---');
    for (const l of logs.slice(0, 40)) console.log(l);
  } else {
    console.log('\n(no console issues)');
  }
})();
