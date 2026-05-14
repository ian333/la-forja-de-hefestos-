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

  await page.goto('http://localhost:5021/masterclass.html?id=linalg-esqueleto');
  await page.waitForTimeout(2500);
  await page.locator('button:has-text("Empezar")').click();
  await page.waitForTimeout(800);
  await page.locator('button:has-text("pausar")').click();

  // Helper: advance N times, play, wait, pause, screenshot
  async function capture(skip, name, wait) {
    for (let k = 0; k < skip; k++) {
      await page.locator('button:has-text("siguiente")').click();
      await page.waitForTimeout(200);
    }
    await page.locator('button:has-text("continuar")').click();
    await page.waitForTimeout(wait);
    await page.locator('button:has-text("pausar")').click();
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log(`${name}.png ✓`);
  }

  // Scenes 03, 04, 05, 06 (MatrixCube)
  await capture(2, '03-matriz', 6000);
  await capture(1, '04-columnas', 6000);
  await capture(1, '05-determinante', 8000);
  await capture(1, '06-todo-rota', 6000);

  // Scenes 07, 08, 09 (Eigenvector)
  await capture(1, '07-eigenvector-only', 6000);
  await capture(1, '08-eigen-equation', 6000);
  await capture(1, '09-esqueleto-lambdas', 6000);

  // Scenes 15, 16, 17 (PCA)
  // Skip from 9 to 15 → 6 clicks
  await capture(6, '15-datos-only-cloud', 5000);
  await capture(1, '16-axes-revealing', 8000);
  await capture(1, '17-applications', 5000);

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
