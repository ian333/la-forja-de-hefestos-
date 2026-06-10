#!/usr/bin/env node
/** Captura el Banco de Trabajo NOVA: cada receta + un estado "encendido". */
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/tmp/banco-shots';
fs.mkdirSync(OUT, { recursive: true });

const RECETAS = ['Luz nocturna automática', 'Alarma de sobre-temperatura', 'Dimmer (control de brillo)', 'Probador de pilas'];

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`[error] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:5002/physics.html#electronica/banco', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (!(await page.locator('text=Banco de trabajo').count()) && !(await page.locator('text=Luz nocturna').count())) {
    const b = page.locator('[data-testid="branch-electronica"]'); if (await b.count()) { await b.click(); await page.waitForTimeout(300); }
    const mod = page.locator('[data-testid="module-banco"]'); if (await mod.count()) await mod.click();
    await page.waitForTimeout(1200);
  }

  for (let i = 0; i < RECETAS.length; i++) {
    await page.locator(`button:has-text("${RECETAS[i]}")`).first().click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${i}-${RECETAS[i].split(' ')[0].toLowerCase()}.png` });
    console.log(`✓ ${RECETAS[i]}`);
  }

  // luz nocturna en modo NOCHE (sensor tapado → LED prendido)
  await page.locator('button:has-text("Luz nocturna")').first().click();
  await page.waitForTimeout(400);
  const slider = page.locator('input[type=range]').first();
  await slider.evaluate((el) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, '0'); el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/led-encendido.png` });
  console.log('✓ luz nocturna ENCENDIDA');

  if (logs.length) { console.log('--- errores ---'); logs.forEach((l) => console.log(l)); } else console.log('sin errores de consola');
  await browser.close();
})();
