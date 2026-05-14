const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '..', '_shots-fix');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 }).then(c => c.newPage());
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE ERROR:', m.text()); });

  await page.goto('http://localhost:5003/masterclass.html?id=calc-infinitesimal');
  await page.waitForTimeout(2500);
  await page.locator('button:has-text("Empezar")').click();
  await page.waitForTimeout(2200);
  // Jump to scene 17 (Maxwell) — index 16 → click 16 times
  for (let k = 0; k < 16; k++) {
    await page.locator('button:has-text("siguiente")').click();
    await page.waitForTimeout(180);
  }
  // Wait long enough for chalk reveals to finish
  await page.waitForTimeout(4500);

  const report = await page.evaluate(() => {
    const chalk = document.querySelector('.chalk-katex');
    if (!chalk) return { error: 'no .chalk-katex found' };
    const html = chalk.innerHTML.slice(0, 2000);
    const allSpans = chalk.querySelectorAll('span');
    const colorTally = {};
    allSpans.forEach(s => {
      const c = getComputedStyle(s).color;
      colorTally[c] = (colorTally[c] || 0) + 1;
    });
    const kats = chalk.querySelectorAll('.katex');
    return {
      katexCount: kats.length,
      spanCount: allSpans.length,
      colorTally,
      sampleHtml: html,
    };
  });
  console.log(JSON.stringify(report, null, 2).slice(0, 4000));

  await page.screenshot({ path: path.join(OUT, 'maxwell-zoom.png'), fullPage: false });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
