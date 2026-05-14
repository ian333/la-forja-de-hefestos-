#!/usr/bin/env node
/**
 * Captures each scene type of the Akerlof masterclass.
 * Mutes audio, jumps via "siguiente" clicks.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/tmp/masterclass-econ-shots';
fs.mkdirSync(OUT, { recursive: true });

const TARGETS = [
  { name: '00-cover',           startIndex: 0,  preStart: true  },
  { name: '02-void-akerlof',    startIndex: 2,  preStart: false },
  { name: '03-market-grid',     startIndex: 3,  preStart: false },
  { name: '05-asymmetric-info', startIndex: 5,  preStart: false },
  { name: '06-collapse-early',  startIndex: 6,  preStart: false },
  { name: '08-collapse-late',   startIndex: 8,  preStart: false },
  { name: '16-nobel',           startIndex: 16, preStart: false },
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
    page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 220)); });

    await page.goto('http://localhost:5001/masterclass.html?id=econ-01-limones', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    if (!t.preStart) {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Empezar'));
        if (btn) btn.click();
      });
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        const a = document.querySelector('audio');
        if (a) a.muted = true;
      });
      for (let k = 0; k < t.startIndex; k++) {
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('siguiente'));
          if (btn) btn.click();
        });
        await page.waitForTimeout(140);
      }
    }

    // Let animation settle, especially for quality-collapse which has a long cycle
    await page.waitForTimeout(t.name.includes('collapse-late') ? 6500 : 3000);
    await page.screenshot({ path: `${OUT}/${t.name}.png` });
    console.log(`[shot] ${t.name} ${errs.length ? '(' + errs.length + ' errs: ' + errs.slice(0, 2).join(' | ').slice(0, 280) + ')' : 'OK'}`);
    await ctx.close();
  }
  await browser.close();
  console.log('\nout:', OUT);
})();
