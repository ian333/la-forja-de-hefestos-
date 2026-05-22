#!/usr/bin/env node
/**
 * Screenshot generalizado: cualquier escena (01/02/03/...) en cualquier aspect/timestamp.
 * Uso: node scripts/shot-scene.cjs <scene> <aspect> <time>
 */
const { chromium } = require('playwright');
const scene = process.argv[2] || '01';
const aspect = process.argv[3] || '16x9';
const t = parseFloat(process.argv[4] || '5');
const PORT = 5183;
const url = `http://localhost:${PORT}/preview-escena.html?scene=${scene}&aspect=${aspect}&t=${t}`;
const viewport = aspect === '16x9' ? { width: 1600, height: 900 } : { width: 540, height: 960 };
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'],
  });
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(`ERR: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error') console.log(`CON: ${m.text().substring(0, 200)}`);
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.__sceneTime === 'number', { timeout: 60000 });
  await page.waitForTimeout(1800);
  const out = `_shots-phases/esc${scene}-${aspect}-t${t.toFixed(1)}.png`;
  await page.screenshot({ path: out, fullPage: false });
  console.log(`OK ${out}`);
  await browser.close();
})();
