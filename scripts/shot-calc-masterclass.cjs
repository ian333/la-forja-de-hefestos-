// Screenshot harness for the Cálculo masterclass.
// Captures the start screen + each cinematic scene by manually advancing idx.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', '_shots-calc');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
  page.on('console', m => {
    const t = m.type();
    if (t === 'error') console.error('CONSOLE ERROR:', m.text());
  });

  await page.goto('http://localhost:5002/masterclass.html?id=calc-infinitesimal');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, '00-start.png') });
  console.log('00-start.png ✓');

  // Click "Empezar la clase"
  await page.locator('button:has-text("Empezar")').click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, '01-flecha.png') });
  console.log('01-flecha.png ✓');

  // Advance through scenes via "siguiente" button
  const SCENES = ['02-newton', '03-tangente', '06-vuelta', '09-taylor-pregunta', '12-dimension', '15-campo', '18-cierre'];
  for (let s = 0; s < SCENES.length; s++) {
    // Pause audio first (we don't need to listen — just visual check)
    const skipCount = s === 0 ? 1 : (s === 1 ? 1 : s === 2 ? 3 : s === 3 ? 3 : s === 4 ? 3 : s === 5 ? 3 : 3);
    for (let k = 0; k < skipCount; k++) {
      await page.locator('button:has-text("siguiente")').click();
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(2200);
    await page.screenshot({ path: path.join(OUT, `0${s+2}-${SCENES[s]}.png`) });
    console.log(`0${s+2}-${SCENES[s]}.png ✓`);
  }

  await browser.close();
  console.log(`\nDone. Shots in: ${OUT}`);
})().catch(e => { console.error(e); process.exit(1); });
