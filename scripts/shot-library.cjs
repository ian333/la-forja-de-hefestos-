#!/usr/bin/env node
/**
 * Captura /library.html con los 4 modes (solid/wireframe/edges/atom) en
 * 16x9 desktop. Verificación visual de la asset library.
 */
const { chromium } = require('playwright');

const PORT = 5001;
const URL = `http://localhost:${PORT}/library.html`;

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'],
  });

  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(`PAGE: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(`CONSOLE: ${m.text().substring(0, 200)}`);
  });

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Wait for Canvas mount
    await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 15000 });
    // Let the camera orbit settle a few seconds
    await page.waitForTimeout(3500);

    // Default mode is 'atom'
    const out1 = '_shots-phases/library-atom.png';
    await page.screenshot({ path: out1, fullPage: false });
    console.log(`✓ ${out1}`);

    // Switch to wireframe
    await page.click('button:has-text("wireframe")', { noWaitAfter: true });
    await page.waitForTimeout(1500);
    const out2 = '_shots-phases/library-wireframe.png';
    await page.screenshot({ path: out2, fullPage: false });
    console.log(`✓ ${out2}`);

    // Switch to solid
    await page.click('button:has-text("solid")', { noWaitAfter: true });
    await page.waitForTimeout(1500);
    const out3 = '_shots-phases/library-solid.png';
    await page.screenshot({ path: out3, fullPage: false });
    console.log(`✓ ${out3}`);

    // Switch to edges
    await page.click('button:has-text("edges")', { noWaitAfter: true });
    await page.waitForTimeout(1500);
    const out4 = '_shots-phases/library-edges.png';
    await page.screenshot({ path: out4, fullPage: false });
    console.log(`✓ ${out4}`);

    if (errors.length) {
      console.log(`\n⚠ ${errors.length} error(s):`);
      errors.slice(0, 8).forEach(e => console.log(`  ${e.substring(0, 240)}`));
    } else {
      console.log('\n✓ No console errors');
    }
  } catch (e) {
    console.log(`✗ ${e.message}`);
  } finally {
    await ctx.close();
    await browser.close();
  }
})();
