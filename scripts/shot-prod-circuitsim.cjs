#!/usr/bin/env node
/** Ojo en PROD: abre university physics.html → Electrónica → Simulador → cuenta presets. */
const { chromium } = require('playwright');
const fs = require('fs');
fs.mkdirSync('/tmp/prod-shots', { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1700, height: 1000 } })).newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  page.on('pageerror', e => logs.push('PAGEERROR ' + e.message));

  await page.goto('https://university.gaiaprime.com.mx/physics.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);

  // abrir rama electrónica → módulo simulador
  const br = page.locator('[data-testid="branch-electronica"]');
  if (await br.count()) { await br.click(); await page.waitForTimeout(400); }
  // localizar el módulo del simulador (id según registry)
  for (const id of ['circuit-sim', 'circuit-simulator', 'simulador']) {
    const m = page.locator(`[data-testid="module-${id}"]`);
    if (await m.count()) { await m.click(); console.log('módulo:', id); break; }
  }
  await page.waitForTimeout(2500);

  const botones = await page.locator('button').allInnerTexts();
  const presets = botones.filter(t => /divisor|filtro|rlc|rectificador|boost|forja/i.test(t));
  console.log('BOTONES DE PRESET ENCONTRADOS:', JSON.stringify(presets));
  await page.screenshot({ path: '/tmp/prod-shots/circuitsim.png', timeout: 30000 });
  console.log('shot guardado');
  await browser.close();
  console.log(logs.length ? 'ERRORES:\n' + logs.slice(0, 8).join('\n') : '(sin errores js)');
})();
