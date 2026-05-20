#!/usr/bin/env node
/**
 * Captures Ostrom Tragedia at key timestamps (bosque pleno, harvesting, colapso).
 */
const { chromium } = require('playwright');

const PORT = 5001;
const URL = `http://localhost:${PORT}/preview-escena.html?scene=ostrom&aspect=16x9`;

const TIMESTAMPS = [
  { t: 2.0,  label: 't02-bosque-pleno' },
  { t: 10.0, label: 't10-llegan-cosechadores' },
  { t: 18.0, label: 't18-medio-colapso' },
  { t: 28.0, label: 't28-casi-vacio' },
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
    page.on('pageerror', e => errors.push(`PAGE: ${e.message}`));
    page.on('console', m => {
      if (m.type() === 'error') errors.push(`CONSOLE: ${m.text().substring(0, 200)}`);
    });
    try {
      await page.goto(`${URL}&t=${ts.t}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 15000 });
      // Espera a que el sceneTime supere el target
      await page.waitForFunction(
        (target) => typeof (window).__sceneTime === 'number' && (window).__sceneTime >= target,
        ts.t,
        { timeout: 90000 },
      );
      // Espera larga para que GLBs preloaden y la escena pinte frames
      await page.waitForTimeout(5000);
      const out = `_shots-phases/ostrom-${ts.label}.png`;
      // page.screenshot() espera fonts.ready que nunca cierra con canvas animado;
      // capturar via fullPage:false + caretHide para evitar el wait.
      await page.screenshot({
        path: out,
        fullPage: false,
        timeout: 60000,
        animations: 'disabled',
        caret: 'hide',
      });
      console.log(`✓ ${out}`);
      if (errors.length) {
        const head = errors.slice(0, 3).map(e => '    ' + e.substring(0, 180)).join('\n');
        console.log(`  ⚠ ${errors.length} error(s)\n${head}`);
      }
    } catch (e) {
      console.log(`✗ ${ts.label}: ${e.message}`);
    } finally {
      await ctx.close();
    }
  }
  await browser.close();
})();
