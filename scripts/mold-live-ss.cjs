/**
 * VER LO QUE VE EL CLIENTE — abre el MISMO sitio de producción en un navegador
 * headless con GPU, entra a La Máquina de Moldes (que sondea /mold-live.json, el
 * estado vivo compartido) y captura la pantalla. Como el estado es compartido, la
 * captura muestra lo MISMO que el cliente tiene enfrente. Cierra el loop: yo
 * cambio el molde (mold-live.sh) → capturo (esto) → veo el resultado → itero.
 *
 * Uso: URL=<forja-brep.html> node scripts/mold-live-ss.cjs [outPng]
 */
const { chromium } = require('playwright');
(async () => {
  const url = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
  const out = process.argv[2] || '/tmp/mr/live-view.png';
  require('fs').mkdirSync(require('path').dirname(out), { recursive: true });
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => { const t = m.text(); if (/mold-live|live|error/i.test(t)) console.log('  [console]', t.slice(0, 120)); });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid="tab-simulacion"]', { timeout: 90000 });
  await page.click('[data-testid="tab-simulacion"]');
  await page.waitForSelector('[data-testid="collapse-sim"]', { timeout: 20000 });
  if (!(await page.locator('[data-testid="btn-mold-machine"]').isVisible().catch(() => false))) await page.click('[data-testid="collapse-sim"]');
  await page.waitForSelector('[data-testid="btn-mold-machine"]', { state: 'visible', timeout: 20000 });
  await page.click('[data-testid="btn-mold-machine"]');
  await page.waitForSelector('[data-testid="mold-machine-view"]', { timeout: 20000 });
  // espera a que el poll de /mold-live.json aplique el estado vivo (hasta ~8s)
  await page.waitForFunction(() => !!document.querySelector('[data-testid="mm-live"]'), { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  // qué se está viendo: nombre de pieza, arquitectura, live badge
  const info = await page.evaluate(() => ({
    name: document.querySelector('[data-testid="mm-name"]')?.value,
    arch: document.querySelector('[data-testid="mm-arch"]')?.textContent?.trim(),
    live: !!document.querySelector('[data-testid="mm-live"]'),
    total: document.querySelector('[data-testid="mm-total"]')?.textContent?.trim(),
  }));
  console.log('VIENDO:', JSON.stringify(info));
  await page.screenshot({ path: out });
  console.log('SS →', out);
  await browser.close();
})().catch((e) => { console.log('SS_FATAL', String(e.stack || e).slice(0, 300)); process.exit(1); });
