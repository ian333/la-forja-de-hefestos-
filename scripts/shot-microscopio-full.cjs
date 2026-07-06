#!/usr/bin/env node
/** QA visual COMPLETO del Microscopio: las 5 vistas, en prod. */
const { chromium } = require('playwright');
const fs = require('fs');
fs.mkdirSync('/tmp/micro-shots', { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1700, height: 1000 } })).newPage();
  const logs = [];
  page.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') logs.push('ERR ' + m.text().slice(0, 120)); });

  await page.goto('https://university.gaiaprime.com.mx/physics.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  const br = page.locator('[data-testid="branch-electronica"]');
  if (await br.count()) { await br.click(); await page.waitForTimeout(400); }
  await page.locator('[data-testid="module-micro-corriente"]').click();
  await page.waitForTimeout(4000);

  const tabs = [['Resistencia', 'r1-resistencia'], ['Bobina', 'r2-bobina'], ['Capacitor', 'r3-capacitor'], ['MOSFET', 'r4-mosfet'], ['LED', 'r5-led']];
  for (const [tab, file] of tabs) {
    const b = page.locator('button', { hasText: tab });
    if (await b.count()) {
      await b.first().click();
      await page.waitForTimeout(4500);   // deja que autoRotate dé ángulo y la sim corra
      await page.screenshot({ path: `/tmp/micro-shots/${file}.png`, timeout: 30000 });
      console.log('shot', tab);
    } else console.log('NO TAB', tab);
  }
  await browser.close();
  console.log(logs.length ? 'ERRORES:\n' + [...new Set(logs)].slice(0, 8).join('\n') : '(sin errores js)');
})();
