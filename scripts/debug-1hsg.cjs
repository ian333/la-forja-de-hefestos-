#!/usr/bin/env node
/**
 * Debug-only: open protein-viewer, click only HIV protease, and dump
 * (a) any console errors, (b) the R3F scene structure, and (c) whether
 * the canvas actually has visible pixels in its center.
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1800, height: 1100 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));

  await page.goto('http://localhost:5001/physics.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.locator('[data-testid="branch-bio"]').click();
  await page.waitForTimeout(200);
  await page.locator('[data-testid="module-protein-viewer"]').click();
  await page.waitForFunction(() => !document.body.innerText.includes('compilando') && !!document.querySelector('canvas'), { timeout: 15000 });
  // Click ONLY HIV protease directly as the first preset.
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="preset-hiv-protease"]');
    if (el) el.click();
  });
  await page.waitForTimeout(6000);

  // Probe canvas pixel buffer at the center.
  const probe = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return { err: 'no canvas' };
    const w = c.width, h = c.height;
    // We re-draw the webgl canvas to a 2D canvas to read pixels
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const ctx = off.getContext('2d');
    ctx.drawImage(c, 0, 0);
    const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    const px = ctx.getImageData(cx, cy, 1, 1).data;
    let sum = 0, counted = 0;
    const step = 32;
    for (let y = step; y < h; y += step) {
      for (let x = step; x < w; x += step) {
        const d = ctx.getImageData(x, y, 1, 1).data;
        sum += d[0] + d[1] + d[2];
        counted++;
      }
    }
    return { w, h, centerPx: [px[0], px[1], px[2], px[3]], avgBrightness: sum / counted };
  });
  console.log('canvas probe:', JSON.stringify(probe));

  console.log('\n--- protein-scene logs ---');
  for (const l of logs) if (l.includes('ProteinScene') || l.includes('pageerror') || l.toLowerCase().includes('error')) console.log(l);
  console.log('\n--- all (last 80) ---');
  for (const l of logs.slice(-80)) console.log(l);
  await browser.close();
})();
