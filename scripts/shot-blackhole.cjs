#!/usr/bin/env node
/**
 * Captures key scenes of the Blackhole Masterclass + the interactive simulator.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/tmp/blackhole-shots';
fs.mkdirSync(OUT, { recursive: true });

const MC_TARGETS = [
  { name: 'mc-00-cover', startIndex: 0, preStart: true },
  { name: 'mc-04-horizonte', startIndex: 3 },
  { name: 'mc-05-foton', startIndex: 4 },
  { name: 'mc-07-collapse', startIndex: 6 },
  { name: 'mc-09-lensing', startIndex: 8 },
  { name: 'mc-11-disk', startIndex: 10 },
  { name: 'mc-15-scale', startIndex: 14 },
  { name: 'mc-17-gargantua', startIndex: 16 },
  { name: 'mc-20-kerr', startIndex: 19 },
  { name: 'mc-22-tidal', startIndex: 21 },
  { name: 'mc-24-time', startIndex: 23 },
  { name: 'mc-27-hawking', startIndex: 26 },
];

const SIM_TARGETS = [
  { name: 'sim-gargantua', preset: 'gargantua' },
  { name: 'sim-cygnus',    preset: 'cygnus' },
  { name: 'sim-ton618',    preset: 'ton618' },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });

  // ── Masterclass scenes ───────────────────────────────────────────
  for (const t of MC_TARGETS) {
    const ctx = await browser.newContext({ viewport: { width: 1800, height: 1080 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('PAGEERR: ' + e.message.slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error') errs.push('ERR: ' + m.text().slice(0, 200)); });

    await page.goto('http://localhost:5001/masterclass.html?id=blackhole', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    if (!t.preStart) {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Empezar'));
        if (btn) btn.click();
      });
      await page.waitForTimeout(500);
      // Mute audio
      await page.evaluate(() => {
        const a = document.querySelector('audio');
        if (a) a.muted = true;
      });
      // Click the right chiclet
      await page.evaluate((idx) => {
        const chiclets = document.querySelectorAll('.flex.gap-1.mb-3 > button');
        if (chiclets[idx]) chiclets[idx].click();
      }, t.startIndex);
      await page.waitForTimeout(2500);
    }

    await page.screenshot({ path: `${OUT}/${t.name}.png` });
    console.log(`[OK] ${t.name} (${errs.length} errs)`);
    if (errs.length > 0) errs.slice(0, 3).forEach(e => console.log('     ', e));
    await ctx.close();
  }

  // ── Simulator screenshots ────────────────────────────────────────
  for (const t of SIM_TARGETS) {
    const ctx = await browser.newContext({ viewport: { width: 1800, height: 1080 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('PAGEERR: ' + e.message.slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error') errs.push('ERR: ' + m.text().slice(0, 200)); });

    await page.goto('http://localhost:5001/physics.html#astro/blackhole', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    if (t.preset) {
      await page.evaluate((preset) => {
        const btn = document.querySelector(`[data-testid="bh-preset-${preset}"]`);
        if (btn) btn.click();
      }, t.preset);
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: `${OUT}/${t.name}.png` });
    console.log(`[OK] ${t.name} (${errs.length} errs)`);
    if (errs.length > 0) errs.slice(0, 3).forEach(e => console.log('     ', e));
    await ctx.close();
  }

  await browser.close();
  console.log(`\nshots in ${OUT}`);
})();
