/**
 * VER LO QUE VE EL CLIENTE — abre el MISMO sitio de producción; el poller de
 * sesión viva ARMA el molde con primitivas y lo pone en la escena 3D. Espera a que
 * construya, encuadra (Fit) y captura el viewport. Como el estado es compartido,
 * la captura = el molde que el cliente tiene enfrente. Uso: URL=<..> node … [out]
 */
const { chromium } = require('playwright');
(async () => {
  const url = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
  const out = process.argv[2] || '/tmp/mr/live-view.png';
  require('fs').mkdirSync(require('path').dirname(out), { recursive: true });
  const b = await chromium.launch({ headless: false, args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('console', (m) => { const t = m.text(); if (/mold|live|rebuild|solid|error/i.test(t)) console.log('  [c]', t.slice(0, 130)); });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('[data-testid="viewport-canvas"]', { timeout: 90000 });
  await p.waitForTimeout(Number(process.env.WAIT || 9000));   // poll (1.5s) + build del molde (~3-4s) + tesela
  await p.click('[data-testid="btn-fit"]').catch(() => {});   // encuadra el molde
  await p.waitForTimeout(1500);
  const estado = await p.evaluate(() => document.querySelector('[data-testid="doc-title"]')?.textContent || '').catch(() => '');
  console.log('DOC:', estado.slice(0, 80));
  await p.screenshot({ path: out });
  console.log('SS →', out);
  await b.close();
})().catch((e) => { console.log('SS_FATAL', String(e.stack || e).slice(0, 300)); process.exit(1); });
