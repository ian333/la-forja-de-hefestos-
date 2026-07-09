/**
 * MANEJA la UII real por CLICKS para verificar el botón GENERAR PLANOS:
 * abre el Studio → 🏭 LA MÁQUINA → 📐 GENERAR PLANOS → confirma que se abre la
 * ventana imprimible con las láminas (SVG + DESPIECE) y CERO errores de consola.
 * "Lo mismo con puros clicks" — verificado a ojo del navegador.
 */
const { chromium } = require('playwright');
(async () => {
  const PORT = process.env.PORT || '5001';
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  // ignora ruido benigno: assets 404, doc vacío al arrancar (sin sólido aún)
  const benign = (t) => /Failed to load resource|status of 404|REBUILD_ERR|favicon/i.test(t);
  page.on('console', (m) => { if (m.type() === 'error' && !benign(m.text())) errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => { if (!benign(String(e.message))) errors.push('PAGEERR ' + String(e.message).slice(0, 160)); });

  const target = process.env.URL || `http://localhost:${PORT}/forja-brep.html`;
  console.log('· destino:', target);
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid="tab-simulacion"]', { timeout: 90000 });
  console.log('· Studio cargado, voy a la pestaña SIMULACIÓN');
  await page.click('[data-testid="tab-simulacion"]');
  // la sección Simulación viene colapsada por defecto → expandir
  await page.waitForSelector('[data-testid="collapse-sim"]', { timeout: 20000 });
  if (!(await page.locator('[data-testid="btn-mold-machine"]').isVisible().catch(() => false))) {
    await page.click('[data-testid="collapse-sim"]');
  }
  await page.waitForSelector('[data-testid="btn-mold-machine"]', { state: 'visible', timeout: 20000 });
  await page.locator('[data-testid="btn-mold-machine"]').scrollIntoViewIfNeeded().catch(() => {});
  console.log('· abro LA MÁQUINA');
  await page.click('[data-testid="btn-mold-machine"]');
  // activa UNDERCUT LATERAL → corredera en los planos (§11.3.6)
  await page.waitForSelector('[data-testid="mm-undercut"]', { timeout: 20000 });
  await page.check('[data-testid="mm-undercut"]');
  console.log('· undercut lateral activado (corredera)');
  await page.waitForSelector('[data-testid="mm-planos"]', { timeout: 20000 });
  console.log('· panel abierto, click GENERAR PLANOS');

  const [popup] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 60000 }),
    page.click('[data-testid="mm-planos"]'),
  ]);
  console.log('· ventana de planos abierta, espero las láminas…');
  await popup.waitForFunction(() => document.querySelectorAll('svg').length >= 5, { timeout: 180000 });
  const svgCount = await popup.evaluate(() => document.querySelectorAll('svg').length);
  const hasDespiece = await popup.evaluate(() => document.body.innerHTML.includes('DESPIECE DE BARRENOS'));
  const hasTornilleria = await popup.evaluate(() => document.body.innerHTML.includes('Tornillería'));
  const hasCorredera = await popup.evaluate(() => document.body.innerHTML.includes('Corredera (slide)'));
  const hasMovimientos = await popup.evaluate(() => document.body.innerHTML.includes('Movimientos'));
  await popup.screenshot({ path: '/tmp/mr/click-popup.png', fullPage: false }).catch(() => {});

  console.log(`RESULT svgs=${svgCount} despiece=${hasDespiece} tornilleria=${hasTornilleria} corredera=${hasCorredera} movimientos=${hasMovimientos} consoleErrors=${errors.length}`);
  if (errors.length) console.log('ERRORS:', errors.slice(0, 6).join(' || '));
  const ok = svgCount >= 5 && hasDespiece && hasTornilleria && hasCorredera && hasMovimientos && errors.length === 0;
  console.log(ok ? 'CLICK_FLOW_OK' : 'CLICK_FLOW_ISSUE');
  await browser.close();
  process.exit(ok ? 0 : 2);
})().catch((e) => { console.log('DRIVE_FATAL', String(e.stack || e).slice(0, 400)); process.exit(1); });
