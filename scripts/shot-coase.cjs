#!/usr/bin/env node
/**
 * Captures the new Coase masterclass scenes.
 * Mutes audio, jumps via 'siguiente' clicks.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/tmp/coase-shots';
fs.mkdirSync(OUT, { recursive: true });

const TARGETS = [
  { name: '00-cover',         startIndex: 0,  preStart: true  },
  { name: '04-paper-void',    startIndex: 3,  preStart: false },
  { name: '05-costs-flow',    startIndex: 4,  preStart: false },
  { name: '06-decision',      startIndex: 5,  preStart: false },
  { name: '07-optimal-size',  startIndex: 6,  preStart: false },
  { name: '12-theorem',       startIndex: 11, preStart: false },
  { name: '13-externality',   startIndex: 12, preStart: false },
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

    await page.goto('http://localhost:5001/masterclass.html?id=econ-02-coase', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2800);

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
        await page.waitForTimeout(150);
      }
    }

    await page.waitForTimeout(9000);
    await page.screenshot({ path: `${OUT}/${t.name}.png` });
    console.log(`[shot] ${t.name} ${errs.length ? '(' + errs.length + ' errs: ' + errs.slice(0, 2).join(' | ').slice(0, 280) + ')' : 'OK'}`);
    await ctx.close();
  }
  await browser.close();
  console.log('\nout:', OUT);
})();
