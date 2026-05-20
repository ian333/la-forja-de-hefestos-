#!/usr/bin/env node
/**
 * Screenshots de Acemoglu Nogales en 4 timestamps clave del reveal.
 */
const { chromium } = require('playwright');

const PORT = 5001;
const URL = `http://localhost:${PORT}/preview-escena.html?scene=acemoglu&aspect=16x9`;

const TIMESTAMPS = [
  { t: 3.0,  label: 't03-quietud' },
  { t: 7.0,  label: 't07-wall-reveal' },
  { t: 16.0, label: 't16-arizona-llena' },
  { t: 26.0, label: 't26-contraste-completo' },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'],
  });

  for (const ts of TIMESTAMPS) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => {
      if (m.type() === 'error') errors.push(`CONSOLE: ${m.text().substring(0, 180)}`);
    });
    try {
      await page.goto(`${URL}&t=${ts.t}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 15000 });
      await page.waitForFunction(
        (target) => typeof (window).__sceneTime === 'number' && (window).__sceneTime >= target,
        ts.t,
        { timeout: 90000 },
      );
      await page.waitForTimeout(5000);
      const out = `_shots-phases/acemoglu-${ts.label}.png`;
      await page.screenshot({
        path: out, fullPage: false, timeout: 60000,
        animations: 'disabled', caret: 'hide',
      });
      console.log(`✓ ${out}${errors.length ? ` (${errors.length} errors)` : ''}`);
    } catch (e) {
      console.log(`✗ ${ts.label}: ${e.message.substring(0, 200)}`);
    } finally {
      await ctx.close();
    }
  }
  await browser.close();
})();
