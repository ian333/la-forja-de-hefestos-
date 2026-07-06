#!/usr/bin/env node
/**
 * Captura las 3 escenas del Microscopio de la corriente para QA visual.
 * Usa el preview del dist en :5001. SwiftShader es suficiente para juzgar
 * composición/color (no para 4K).
 */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/tmp/micro-shots';
fs.mkdirSync(OUT, { recursive: true });

const TABS = [
  { name: 'resistencia', label: 'Resistencia' },
  { name: 'bobina', label: 'Bobina' },
  { name: 'led', label: 'LED' },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1700, height: 1000 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`[error] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:5001/physics.html#electronica/micro-corriente', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // si el hash-route no funcionó, navegar por sidebar
  if (!(await page.locator('text=Resistencia → calor').count())) {
    const branch = page.locator('[data-testid="branch-electronica"]');
    if (await branch.count()) { await branch.click(); await page.waitForTimeout(300); }
    const mod = page.locator('[data-testid="module-micro-corriente"]');
    if (await mod.count()) { await mod.click(); }
    await page.waitForTimeout(1500);
  }

  for (const t of TABS) {
    await page.locator(`button:has-text("${t.label}")`).first().click();
    await page.waitForTimeout(3500); // dejar que la simulación caliente / fluya
    await page.screenshot({ path: `${OUT}/${t.name}.png`, timeout: 30000 });
    console.log(`✓ ${t.name}.png`);
  }

  // variante: resistencia con voltaje alto (la red al rojo)
  await page.locator('button:has-text("Resistencia")').first().click();
  await page.waitForTimeout(500);
  const slider = page.locator('input[type=range]').first();
  await slider.evaluate((el) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, '4');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/resistencia-4V.png`, timeout: 30000 });
  console.log('✓ resistencia-4V.png');

  if (logs.length) { console.log('--- console errors ---'); logs.forEach((l) => console.log(l)); }
  else console.log('sin errores de consola');
  await browser.close();
})();
