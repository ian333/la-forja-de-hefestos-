// Verify phase-aware scenes — gimbal (10/11/12) and quaternion (13/14).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '..', '_shots-phases');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message));

  await page.goto('http://localhost:5017/masterclass.html?id=linalg-esqueleto');
  await page.waitForTimeout(2500);
  await page.locator('button:has-text("Empezar")').click();
  await page.waitForTimeout(800);
  await page.locator('button:has-text("pausar")').click();

  // Scene 10 — euler-rotacion (skip 9 from idx 0)
  for (let k = 0; k < 9; k++) {
    await page.locator('button:has-text("siguiente")').click();
    await page.waitForTimeout(200);
  }
  await page.locator('button:has-text("continuar")').click();
  await page.waitForTimeout(4000);
  await page.locator('button:has-text("pausar")').click();
  await page.screenshot({ path: path.join(OUT, '10-euler-axis.png') });
  console.log('10-euler-axis.png ✓');

  // Scene 11 — euler-angles
  await page.locator('button:has-text("siguiente")').click();
  await page.waitForTimeout(220);
  await page.locator('button:has-text("continuar")').click();
  await page.waitForTimeout(5000);
  await page.locator('button:has-text("pausar")').click();
  await page.screenshot({ path: path.join(OUT, '11-euler-angles.png') });
  console.log('11-euler-angles.png ✓');

  // Scene 12 — gimbal-lock (capture multiple frames to catch the lock moment)
  await page.locator('button:has-text("siguiente")').click();
  await page.waitForTimeout(220);
  await page.locator('button:has-text("continuar")').click();
  // Wait for pitch to reach 90° — cycle is 5s with hold near apex
  await page.waitForTimeout(2200);
  await page.locator('button:has-text("pausar")').click();
  await page.screenshot({ path: path.join(OUT, '12-gimbal-lock-a.png') });
  await page.locator('button:has-text("continuar")').click();
  await page.waitForTimeout(2500);
  await page.locator('button:has-text("pausar")').click();
  await page.screenshot({ path: path.join(OUT, '12-gimbal-lock-b.png') });
  console.log('12-gimbal-lock.png ✓');

  // Scene 13 — hamilton (i, j, k axes visible + formula card)
  await page.locator('button:has-text("siguiente")').click();
  await page.waitForTimeout(220);
  await page.locator('button:has-text("continuar")').click();
  await page.waitForTimeout(4500);
  await page.locator('button:has-text("pausar")').click();
  await page.screenshot({ path: path.join(OUT, '13-hamilton-ijk.png') });
  console.log('13-hamilton-ijk.png ✓');

  // Scene 14 — cover-doble (trail emphasized)
  await page.locator('button:has-text("siguiente")').click();
  await page.waitForTimeout(220);
  await page.locator('button:has-text("continuar")').click();
  await page.waitForTimeout(6000);
  await page.locator('button:has-text("pausar")').click();
  await page.screenshot({ path: path.join(OUT, '14-cover-doble.png') });
  console.log('14-cover-doble.png ✓');

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
