const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '..', '_shots-escuela');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1.2 }).then(c => c.newPage());
  await page.goto('http://localhost:5002/escuela.html');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, 'escuela-top.png') });
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'escuela-masterclasses.png') });
  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
