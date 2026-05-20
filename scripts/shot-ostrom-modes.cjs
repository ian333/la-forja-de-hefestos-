#!/usr/bin/env node
/**
 * Captura Ostrom en cada uno de los 4 modes (solid/wireframe/edges/atom)
 * para investigar visualmente qué pasa con el "doubling".
 *
 * Inyecta un MODE en window que SceneContent puede leer para overridear
 * el atom-style por default (vía localStorage).
 */
const { chromium } = require('playwright');

const PORT = 5001;
const T_SNAPSHOT = 4.0;  // bosque pleno
const MODES = ['atom', 'wireframe', 'edges', 'solid'];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'],
  });

  for (const mode of MODES) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await ctx.newPage();
    // Inject mode override before page load
    await page.addInitScript((m) => {
      try { localStorage.setItem('ostromMode', m); } catch (e) {}
    }, mode);
    const errors = [];
    page.on('console', m => {
      if (m.type() === 'error') errors.push(`CONSOLE: ${m.text().substring(0, 180)}`);
    });
    try {
      await page.goto(`http://localhost:${PORT}/preview-escena.html?scene=ostrom&aspect=16x9&t=${T_SNAPSHOT}`, {
        waitUntil: 'domcontentloaded', timeout: 30000,
      });
      await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 15000 });
      await page.waitForFunction(
        (target) => typeof (window).__sceneTime === 'number' && (window).__sceneTime >= target,
        T_SNAPSHOT,
        { timeout: 90000 },
      );
      await page.waitForTimeout(5000);
      const out = `_shots-phases/ostrom-mode-${mode}.png`;
      await page.screenshot({
        path: out,
        fullPage: false,
        timeout: 60000,
        animations: 'disabled',
        caret: 'hide',
      });
      console.log(`✓ ${out}${errors.length ? ` (${errors.length} errors)` : ''}`);
    } catch (e) {
      console.log(`✗ mode=${mode}: ${e.message.substring(0, 200)}`);
    } finally {
      await ctx.close();
    }
  }

  await browser.close();
})();
