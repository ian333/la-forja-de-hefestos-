const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1700, height: 1000 } })).newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 150)));
  await page.goto('https://university.gaiaprime.com.mx/physics.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  await page.locator('[data-testid="branch-electronica"]').click().catch(() => {});
  await page.waitForTimeout(400);
  await page.locator('[data-testid="module-micro-corriente"]').click();
  await page.waitForTimeout(3500);
  for (const [exact, file] of [['🧲Bobina → campo', 'r2-bobina'], ['💡LED → luz', 'r5-led']]) {
    await page.getByRole('button', { name: exact.slice(2) }).click();   // texto exacto del tab
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `/tmp/micro-shots/${file}.png`, timeout: 30000 });
    console.log('shot', file);
  }
  await browser.close();
})();
