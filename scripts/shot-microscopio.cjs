#!/usr/bin/env node
/** QA visual del Microscopio en PROD: tabs capacitor y mosfet. */
const { chromium } = require('playwright');
const fs = require('fs');
fs.mkdirSync('/tmp/prod-shots', { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1700, height: 1000 } })).newPage();
  const logs = [];
  page.on('pageerror', e => logs.push('PAGEERROR ' + e.message));

  await page.goto('https://university.gaiaprime.com.mx/physics.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);

  const br = page.locator('[data-testid="branch-electronica"]');
  if (await br.count()) { await br.click(); await page.waitForTimeout(400); }
  const mod = page.locator('[data-testid="module-micro-corriente"]');
  if (!(await mod.count())) { console.log('NO ENCONTRÉ module-micro-corriente'); await browser.close(); return; }
  await mod.click();
  await page.waitForTimeout(3500);

  for (const [tab, file] of [['Capacitor', 'micro-capacitor'], ['MOSFET', 'micro-mosfet']]) {
    const b = page.locator('button', { hasText: tab });
    if (await b.count()) {
      await b.first().click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `/tmp/prod-shots/${file}.png`, timeout: 30000 });
      console.log('shot', tab);
    } else console.log('NO HAY TAB', tab);
  }
  await browser.close();
  console.log(logs.length ? 'ERRORES:\n' + logs.slice(0, 6).join('\n') : '(sin errores js)');
})();
