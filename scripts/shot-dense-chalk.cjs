const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '..', '_shots-fix');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message));

  await page.goto('http://localhost:5008/masterclass.html?id=calc-infinitesimal');
  await page.waitForTimeout(2500);
  await page.locator('button:has-text("Empezar")').click();
  // Pause immediately so we can drive the scene index
  await page.waitForTimeout(800);
  await page.locator('button:has-text("pausar")').click();

  const SCENES_TO_CAPTURE = [
    { skip: 3, name: '04-h-cero', wait: 12000 },     // limit table
    { skip: 1, name: '05-funciones', wait: 12000 },  // derivative catalog
    { skip: 2, name: '07-riemann', wait: 14000 },    // Riemann
    { skip: 3, name: '10-taylor-formula', wait: 12000 },  // Taylor
    { skip: 7, name: '17-maxwell', wait: 14000 },    // Maxwell
    { skip: 1, name: '18-cierre', wait: 16000 },     // closing
  ];

  for (const sc of SCENES_TO_CAPTURE) {
    for (let k = 0; k < sc.skip; k++) {
      await page.locator('button:has-text("siguiente")').click();
      await page.waitForTimeout(180);
    }
    // Resume to let the timing kick in, then pause again
    await page.locator('button:has-text("continuar")').click();
    await page.waitForTimeout(sc.wait);
    await page.locator('button:has-text("pausar")').click();
    await page.screenshot({ path: path.join(OUT, `${sc.name}.png`) });
    console.log(`${sc.name}.png ✓`);
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
