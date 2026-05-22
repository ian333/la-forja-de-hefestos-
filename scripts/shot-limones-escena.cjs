#!/usr/bin/env node
/**
 * Captures the Limones Cap1 Escena1 preview at key timestamps,
 * in both 9:16 (mobile) and 16:9 (desktop).
 */
const { chromium } = require('playwright');

const PORT = 5183;
const URL_DESKTOP = `http://localhost:${PORT}/preview-escena.html?aspect=16x9`;
const URL_MOBILE  = `http://localhost:${PORT}/preview-escena.html?aspect=9x16`;

const TIMESTAMPS = [
  { t: 1.5,  label: 't01-quietud' },
  { t: 4.0,  label: 't04-precio-aparece' },
  { t: 6.0,  label: 't06-precio-hold' },
  { t: 8.5,  label: 't08-tachando' },
  { t: 10.5, label: 't10-nuevo-precio' },
  { t: 13.5, label: 't13-push-in' },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'],
  });

  // Desktop 16:9
  for (const ts of TIMESTAMPS) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(`PAGE: ${e.message}`));
    page.on('console', m => {
      if (m.type() === 'error') errors.push(`CONSOLE: ${m.text().substring(0, 200)}`);
    });
    try {
      await page.goto(URL_DESKTOP, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // Esperar a que el Canvas montse Y el clock interno haya avanzado
      await page.waitForFunction(() => typeof (window).__sceneTime === 'number', { timeout: 15000 });
      await page.waitForFunction(
        (target) => (window).__sceneTime >= target,
        ts.t,
        { timeout: 90000 },
      );
      const out = `_shots-phases/limones-escena01-16x9-${ts.label}.png`;
      await page.screenshot({ path: out, fullPage: false });
      console.log(`✓ ${out}`);
      if (errors.length) {
        console.log(`  ⚠ ${errors.length} error(s)`);
        errors.slice(0, 2).forEach(e => console.log(`    ${e.substring(0, 200)}`));
      }
    } catch (e) {
      console.log(`✗ 16x9 ${ts.label}: ${e.message}`);
    } finally {
      await ctx.close();
    }
  }

  // Mobile 9:16
  for (const ts of TIMESTAMPS) {
    const ctx = await browser.newContext({ viewport: { width: 540, height: 960 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(`PAGE: ${e.message}`));
    page.on('console', m => {
      if (m.type() === 'error') errors.push(`CONSOLE: ${m.text().substring(0, 200)}`);
    });
    try {
      await page.goto(URL_MOBILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(() => typeof (window).__sceneTime === 'number', { timeout: 15000 });
      await page.waitForFunction(
        (target) => (window).__sceneTime >= target,
        ts.t,
        { timeout: 90000 },
      );
      const out = `_shots-phases/limones-escena01-9x16-${ts.label}.png`;
      await page.screenshot({ path: out, fullPage: false });
      console.log(`✓ ${out}`);
      if (errors.length) {
        console.log(`  ⚠ ${errors.length} error(s)`);
        errors.slice(0, 2).forEach(e => console.log(`    ${e.substring(0, 200)}`));
      }
    } catch (e) {
      console.log(`✗ 9x16 ${ts.label}: ${e.message}`);
    } finally {
      await ctx.close();
    }
  }

  await browser.close();
  console.log('\nDone.');
})();
