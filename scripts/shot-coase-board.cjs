#!/usr/bin/env node
// Captures Coase scenes with longer wait time so chalkboard animations finish.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/tmp/coase-board-shots';
fs.mkdirSync(OUT, { recursive: true });

const TARGETS = [
  { name: '05-costs',     startIndex: 4 },
  { name: '07-optimal',   startIndex: 6 },
  { name: '12-theorem',   startIndex: 11 },
];

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  for (const t of TARGETS) {
    const ctx = await browser.newContext({ viewport: { width: 1800, height: 1080 } });
    const page = await ctx.newPage();
    await page.goto('http://localhost:5001/masterclass.html?id=econ-02-coase', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
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
      await page.waitForTimeout(200);
    }
    // Long wait for chalkboard cascade animations (lines appear staggered)
    await page.waitForTimeout(8000);
    await page.screenshot({ path: `${OUT}/${t.name}.png` });
    console.log(`[shot] ${t.name}`);
    await ctx.close();
  }
  await browser.close();
})();
