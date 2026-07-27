/**
 * CAPTURA LAS COTAS 3D EN VIVO — abre el sitio de producción, espera a que el poller
 * arme el molde, prende el botón 📐 y fotografía. El texto de las cotas es DOM, así que
 * se puede LEER del screenshot: ése es justo el punto ("más información en pantalla
 * para poder analizar").
 * Uso: [URL=..] [SOFT=1] node scripts/mold-cotas-ss.cjs <outdir> [etiqueta]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const url = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
  const dir = process.argv[2] || '/tmp/cotas-ss';
  const tag = process.argv[3] || 'molde';
  fs.mkdirSync(dir, { recursive: true });
  const soft = process.env.SOFT === '1';
  const b = await chromium.launch({ headless: soft ? true : false,
    args: soft ? ['--no-sandbox'] : ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer'] });
  const ctx = await b.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('[data-testid="viewport-canvas"]', { timeout: 90000 });
  await p.waitForSelector('[data-testid="mold-parts-head"]', { timeout: Number(process.env.WAIT || 90000) });
  console.log('✓ el molde vivo está armado');

  // prender COTAS (click del DOM: la tesela bloquea el hilo y el click de Playwright
  // expira esperando "estable" — ver mold-fastener-ss)
  await p.$eval('[data-testid="mold-cotas-toggle"]', (el) => el.click());
  await p.waitForFunction(() => !!document.querySelector('[data-testid="mold-cotas-overlay"]'), { timeout: 25000 });
  await p.waitForTimeout(1500);

  const cotas = await p.$$eval('[data-testid="mold-cotas-overlay"] > div', (ds) =>
    ds.map((d) => ({ t: d.innerText, hidden: d.style.display === 'none' })).filter((x) => x.t));
  console.log(`\nCOTAS EN PANTALLA (${cotas.length}):`);
  for (const c of cotas) console.log(`  ${c.hidden ? '(oculta) ' : ''}${c.t}`);
  const malas = cotas.filter((c) => /✗/.test(c.t));
  console.log(malas.length ? `\n⚠ ${malas.length} COTA(S) NO CUADRAN` : `\n✓ todas las cotas visibles cuadran con el sólido`);

  const f1 = path.join(dir, `${tag}-cotas.png`);
  await p.screenshot({ path: f1, timeout: 40000 });
  // encuadrar para verlas sobre el molde completo
  await p.$eval('[data-testid="btn-fit"]', (el) => el.click()).catch(() => {});
  await p.waitForTimeout(1200);
  const f2 = path.join(dir, `${tag}-cotas-fit.png`);
  await p.screenshot({ path: f2, timeout: 40000 });
  if (errs.length) console.log('⚠ errores de página:', errs.slice(0, 3).join(' | '));
  console.log(`\nSS → ${f1}\n     ${f2}`);
  await b.close();
})().catch((e) => { console.log('SS_FATAL', String(e.stack || e).slice(0, 400)); process.exit(1); });
