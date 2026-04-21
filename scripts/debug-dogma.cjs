#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1800, height: 1100 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:5001/physics.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('[data-testid="branch-bio"]').click());
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('[data-testid="module-central-dogma"]').click());
  await page.waitForTimeout(500);

  for (const preset of ['synth', 'insulin-b', 'tp53-r175', 'brca1']) {
    await page.evaluate((id) => document.querySelector(`[data-testid="preset-${id}"]`).click(), preset);
    await page.waitForTimeout(10000);
    const txt = await page.evaluate(() => {
      const asides = document.querySelectorAll('aside');
      return asides[asides.length - 1]?.innerText ?? '';
    });
    // Extract key fields.
    const phase = (txt.match(/fase\s*=\s*(\w+)/) || [])[1] || '?';
    console.log(`\n=== ${preset} ===`);
    const progressLines = txt.split('\n').filter(l =>
      l.match(/(mRNA|proteína|aminoácido)/) || l.match(/^[AUGC]{3}$/)
    );
    console.log(progressLines.slice(0, 8).join('\n'));
    fs.mkdirSync('/tmp/physics-screenshots/central-dogma', { recursive: true });
    await page.screenshot({
      path: `/tmp/physics-screenshots/central-dogma/debug-${preset}.png`,
      clip: { x: 280, y: 62, width: 1178, height: 1038 },
    });
  }

  // Read the HUD (top-left of canvas) which shows phase + elapsed.
  const hud = await page.evaluate(() => {
    const hud = document.querySelector('.font-mono.text-\\[11px\\]');
    return hud ? hud.innerText : null;
  });
  console.log('\nHUD:', hud);

  await browser.close();
  console.log('\n--- errors ---');
  for (const l of logs) if (l.includes('error') || l.includes('Error') || l.includes('pageerror')) console.log(l);
})();
