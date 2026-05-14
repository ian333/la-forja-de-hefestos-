#!/usr/bin/env node
/**
 * Captures each scene of the Masterclass.
 * Uses muted audio + skip-controls so we don't actually play sound,
 * but trigger the visual scene switching.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/tmp/masterclass-shots';
fs.mkdirSync(OUT, { recursive: true });

// Which scene IDs correspond to which visualization
const TARGETS = [
  { name: '00-cover',  startIndex: 0,  preStart: true },
  { name: '01-void',   startIndex: 0,  preStart: false },
  { name: '05-cplane', startIndex: 4,  preStart: false },
  { name: '07-mobius', startIndex: 6,  preStart: false },
  { name: '10-newton', startIndex: 9,  preStart: false },
  { name: '13-conformal', startIndex: 12, preStart: false },
  { name: '15-motor',  startIndex: 14, preStart: false },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });

  for (const t of TARGETS) {
    const ctx = await browser.newContext({ viewport: { width: 1800, height: 1080 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)); });

    await page.goto('http://localhost:5001/masterclass.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    if (!t.preStart) {
      // Click "Empezar"
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Empezar'));
        if (btn) btn.click();
      });
      await page.waitForTimeout(500);
      // Mute the audio element so we don't trigger real playback
      await page.evaluate(() => {
        const a = document.querySelector('audio');
        if (a) a.muted = true;
      });
      // Click chiclet to jump to the target scene
      await page.evaluate((i) => {
        const bar = document.querySelectorAll('[title]');
        // The chiclet buttons have title attribute set to scene.id; advancement uses index
        // Simpler: just click "siguiente" N times
        return i;
      }, t.startIndex);
      for (let k = 0; k < t.startIndex; k++) {
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('siguiente'));
          if (btn) btn.click();
        });
        await page.waitForTimeout(120);
      }
    }

    // Let animation breathe
    await page.waitForTimeout(2800);
    await page.screenshot({ path: `${OUT}/${t.name}.png` });
    console.log(`[shot] ${t.name} ${errs.length ? '(errs: ' + errs.slice(0, 2).join(' | ').slice(0, 250) + ')' : 'OK'}`);
    await ctx.close();
  }
  await browser.close();
})();
