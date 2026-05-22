#!/usr/bin/env node
/**
 * Captura los 25 LimonesEscena en un timestamp representativo (t=5)
 * para análisis visual rápido de paleta, distorsión, cámara.
 */
const { chromium } = require('playwright');

const PORT = 5001;
const T = 5.0;
const SCENES = Array.from({ length: 25 }, (_, i) => String(i + 1).padStart(2, '0'));

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'],
  });

  for (const id of SCENES) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => {
      if (m.type() === 'error') errors.push(`${m.text().substring(0, 120)}`);
    });
    try {
      const url = `http://localhost:${PORT}/preview-escena.html?scene=${id}&aspect=16x9&t=${T}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 15000 });
      await page.waitForTimeout(4500);
      const out = `_shots-phases/limones-${id}.png`;
      await page.screenshot({
        path: out, fullPage: false, timeout: 60000,
        animations: 'disabled', caret: 'hide',
      });
      console.log(`✓ ${id}${errors.length ? ` (${errors.length} err)` : ''}`);
    } catch (e) {
      console.log(`✗ ${id}: ${e.message.substring(0, 120)}`);
    } finally {
      await ctx.close();
    }
  }
  await browser.close();
})();
