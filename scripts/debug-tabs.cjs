const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1700, height: 1000 } })).newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 200)));
  await page.goto('https://university.gaiaprime.com.mx/physics.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  await page.locator('[data-testid="branch-electronica"]').click().catch(() => {});
  await page.waitForTimeout(400);
  await page.locator('[data-testid="module-micro-corriente"]').click();
  await page.waitForTimeout(3500);
  for (const tab of ['Resistencia', 'Bobina', 'Capacitor', 'MOSFET', 'LED']) {
    const loc = page.locator('button', { hasText: tab });
    const n = await loc.count();
    const texts = await loc.allInnerTexts();
    console.log(`"${tab}": ${n} matches →`, JSON.stringify(texts.map(t => t.slice(0, 40))));
  }
  // click bobina y verificar la clase del botón después
  const b = page.locator('button', { hasText: 'Bobina' }).first();
  await b.click();
  await page.waitForTimeout(1500);
  console.log('tras click Bobina, className:', (await b.getAttribute('class'))?.slice(0, 60));
  const hud = await page.locator('text=Biot-Savart').count();
  console.log('HUD de bobina presente:', hud);
  await browser.close();
})();
