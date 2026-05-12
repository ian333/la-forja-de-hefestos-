#!/usr/bin/env node
/**
 * Captura cada paso en momentos específicos donde la animación está en pico.
 * Para el paso 4 (oscilación Y de la silla): captura en t=0.25 (max up) y t=0.75 (max down).
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = '/tmp/lesson-animated';
fs.mkdirSync(OUT, { recursive: true });

// Each step's duration (ms) and "interesting" sample times (fraction of duration)
const STEPS = [
  { idx: 1, duration: 4500, samples: [0.05, 0.5, 0.95] },   // climb
  { idx: 2, duration: 5000, samples: [0.05, 0.25, 0.5, 0.75, 0.95] }, // orbit
  { idx: 3, duration: 4500, samples: [0.05, 0.5, 0.95] },   // saddle approach
  { idx: 4, duration: 5000, samples: [0.05, 0.25, 0.5, 0.75, 0.95] }, // Y oscillation
  { idx: 5, duration: 5500, samples: [0.05, 0.5, 0.95] },   // gradient descent
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1800, height: 1100 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errs.push(`error: ${m.text().slice(0, 300)}`); });

  await page.goto('http://localhost:5001/math.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Enter step 1
  await page.locator('button', { hasText: /empezar/ }).first().click();

  for (const step of STEPS) {
    const t0 = Date.now();
    // Capture at each sample time
    for (let i = 0; i < step.samples.length; i++) {
      const fraction = step.samples[i];
      const targetMs = Math.floor(fraction * step.duration);
      const elapsed = Date.now() - t0;
      const wait = Math.max(0, targetMs - elapsed);
      if (wait > 0) await page.waitForTimeout(wait);
      const label = `step${step.idx}-t${Math.floor(fraction * 100).toString().padStart(2, '0')}`;
      await page.screenshot({ path: path.join(OUT, `${label}.png`) });
    }
    // Wait until step animation fully ends (a bit past duration)
    const stepEnd = step.duration + 500;
    const elapsedFinal = Date.now() - t0;
    if (elapsedFinal < stepEnd) await page.waitForTimeout(stepEnd - elapsedFinal);
    console.log(`[step ${step.idx}] ${step.samples.length} samples`);
    // Advance to next step
    if (step.idx < STEPS.length) {
      await page.locator('button', { hasText: /siguiente/ }).first().click();
    }
  }

  console.log('\n--- errors ---');
  for (const e of errs.slice(0, 20)) console.log(e);
  await browser.close();
})();
