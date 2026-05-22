#!/usr/bin/env node
/**
 * Captura UNA escena en UN timestamp. Más rápido y confiable.
 * Uso: node scripts/shot-one.cjs <aspect> <time>
 *   aspect: 16x9 | 9x16
 *   time: seconds (default 5)
 */
const { chromium } = require('playwright');
const aspect = process.argv[2] || '16x9';
const t = parseFloat(process.argv[3] || '5');
const PORT = 5183;
const url = `http://localhost:${PORT}/preview-escena.html?aspect=${aspect}&t=${t}`;
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
  // Scene starts at t=N already (via query param). Wait 1.5s real for animations to settle.
  await page.waitForTimeout(1500);
  const out = `_shots-phases/oneshot-${aspect}-t${t.toFixed(1)}.png`;
  await page.screenshot({ path: out, fullPage: false });
  console.log(`✓ ${out}`);
  await browser.close();
})();
