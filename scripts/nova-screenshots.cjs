#!/usr/bin/env node
/** QA visual de la tienda NOVA gaiaprime. Apunta al preview (default iangpu:4173). */
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.NOVA_URL || 'http://100.65.173.85:4173';
const OUT = '/tmp/nova-shots';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const logs = [];

  // desktop
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`[error] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(`${BASE}/nova.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600); // reveals + fuentes
  await page.screenshot({ path: `${OUT}/1-hero.png` });
  console.log('✓ hero');
  await page.locator('#catalogo').scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/2-catalogo.png` });
  console.log('✓ catálogo');
  // agregar kit + abrir carrito
  await page.locator('button:has-text("Agregar kit +")').first().click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/3-carrito.png` });
  console.log('✓ carrito');

  // móvil
  const mob = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  await mob.goto(`${BASE}/nova.html`, { waitUntil: 'networkidle' });
  await mob.waitForTimeout(1500);
  await mob.screenshot({ path: `${OUT}/4-movil-hero.png` });
  console.log('✓ móvil hero');

  if (logs.length) { console.log('--- errores ---'); logs.forEach((l) => console.log(l)); }
  else console.log('sin errores de consola');
  await browser.close();
})();
