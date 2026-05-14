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
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE ERROR:', m.text()); });

  await page.goto('http://localhost:5011/masterclass.html?id=linalg-esqueleto');
  await page.waitForTimeout(2500);
  await page.locator('button:has-text("Empezar")').click();
  await page.waitForTimeout(800);
  await page.locator('button:has-text("pausar")').click();

  const SCENES = [
    { skip: 2, name: '03-matriz',     wait: 9000 },
    { skip: 1, name: '04-columnas',   wait: 10000 },
    { skip: 1, name: '05-determinante', wait: 9000 },
    { skip: 2, name: '07-eigenvector', wait: 8000 },
    { skip: 2, name: '09-esqueleto',   wait: 9000 },
    { skip: 1, name: '10-euler',       wait: 10000 },
    { skip: 2, name: '12-gimbal',      wait: 11000 },
    { skip: 1, name: '13-hamilton',    wait: 11000 },
    { skip: 1, name: '14-cover',       wait: 13000 },
    { skip: 1, name: '15-datos',       wait: 11000 },
    { skip: 1, name: '16-covarianza',  wait: 9000 },
    { skip: 1, name: '17-aplicaciones', wait: 12000 },
    { skip: 1, name: '18-cierre',      wait: 16000 },
  ];

  for (const sc of SCENES) {
    for (let k = 0; k < sc.skip; k++) {
      await page.locator('button:has-text("siguiente")').click();
      await page.waitForTimeout(200);
    }
    await page.locator('button:has-text("continuar")').click();
    await page.waitForTimeout(sc.wait);
    await page.locator('button:has-text("pausar")').click();
    await page.screenshot({ path: path.join(OUT, `${sc.name}.png`) });
    console.log(`${sc.name}.png ✓`);
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
