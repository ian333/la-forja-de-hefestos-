#!/usr/bin/env node
/**
 * Probe the actual TangentPlane state during animation to verify keyframes
 * are interpolating. Polls the store every 200ms during step 4.
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1800, height: 1100 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') console.log(`error: ${m.text().slice(0, 300)}`); });

  await page.goto('http://localhost:5001/math.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Helper: read the input slider values (px, py) from the DOM
  const readState = async () => {
    return await page.evaluate(() => {
      // Find sliders in the sandbox tab. Switch first.
      const xSliders = Array.from(document.querySelectorAll('input[type="range"]'));
      // We can't switch tab without disturbing state. Instead, read the
      // 3D point position from our React state via window hook.
      // Fallback: parse the value displayed in the rendered formula
      const text = document.body.innerText;
      const xMatch = text.match(/x₀\s*=\s*(-?\d+\.?\d*)/);
      const yMatch = text.match(/y₀\s*=\s*(-?\d+\.?\d*)/);
      return { x: xMatch?.[1], y: yMatch?.[1] };
    });
  };

  // Enter step 1 → 2 → 3 → 4
  await page.locator('button', { hasText: /empezar/ }).first().click();
  await page.waitForTimeout(5500); // step 1
  await page.locator('button', { hasText: /siguiente/ }).first().click();
  await page.waitForTimeout(5500); // step 2
  await page.locator('button', { hasText: /siguiente/ }).first().click();
  await page.waitForTimeout(5500); // step 3
  await page.locator('button', { hasText: /siguiente/ }).first().click();

  // Now in step 4 — poll state every 250ms for 6 seconds
  console.log('STEP 4 — poll state every 250ms (Y oscillation expected: 0 → +1.7 → 0 → -1.7 → 0)');
  const t0 = Date.now();
  while (Date.now() - t0 < 6000) {
    const elapsed = Date.now() - t0;
    const s = await readState();
    console.log(`t=${elapsed.toString().padStart(4)}ms  x=${s.x ?? '?'}  y=${s.y ?? '?'}`);
    await page.waitForTimeout(250);
  }

  await browser.close();
})();
