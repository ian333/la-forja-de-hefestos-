const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '..', '_shots-linalg');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message));

  await page.goto('http://localhost:5014/masterclass.html?id=linalg-esqueleto');
  await page.waitForTimeout(2500);
  await page.locator('button:has-text("Empezar")').click();
  await page.waitForTimeout(800);
  await page.locator('button:has-text("pausar")').click();
  // Scene 3 (matriz) — skip 2 from idx 0
  for (let k = 0; k < 2; k++) {
    await page.locator('button:has-text("siguiente")').click();
    await page.waitForTimeout(220);
  }
  await page.locator('button:has-text("continuar")').click();
  // Capture at different cycle phases to see the matrix morphing
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(OUT, '03-matriz-v2-a.png') });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(OUT, '03-matriz-v2-b.png') });
  await page.waitForTimeout(5500);
  await page.screenshot({ path: path.join(OUT, '03-matriz-v2-c.png') });
  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
