// Focused shots: SurfaceScene tangent plane + Chalkboard LaTeX color.
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
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE ERROR:', m.text()); });

  await page.goto('http://localhost:5008/masterclass.html?id=calc-infinitesimal');
  await page.waitForTimeout(2500);
  await page.locator('button:has-text("Empezar")').click();
  await page.waitForTimeout(2200);
  // Skip to scene 12 (calc/surface — "12-dimension")
  for (let k = 0; k < 11; k++) {
    await page.locator('button:has-text("siguiente")').click();
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(2800);
  await page.screenshot({ path: path.join(OUT, '12-dimension.png') });
  console.log('12-dimension.png ✓');

  // Scene 13 — plano tangente (richer LaTeX on chalk)
  await page.locator('button:has-text("siguiente")').click();
  await page.waitForTimeout(2800);
  await page.screenshot({ path: path.join(OUT, '13-plano-tangente.png') });
  console.log('13-plano-tangente.png ✓');

  // Scene 14 — gradiente (gradient descent formula)
  await page.locator('button:has-text("siguiente")').click();
  await page.waitForTimeout(2800);
  await page.screenshot({ path: path.join(OUT, '14-gradiente.png') });
  console.log('14-gradiente.png ✓');

  // Skip to scene 17 — Maxwell equations (LaTeX-heavy)
  for (let k = 0; k < 3; k++) {
    await page.locator('button:has-text("siguiente")').click();
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(2800);
  await page.screenshot({ path: path.join(OUT, '17-maxwell.png') });
  console.log('17-maxwell.png ✓');

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
