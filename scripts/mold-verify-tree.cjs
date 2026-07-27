/**
 * VERIFICA aislar / ocultar / opacidad del árbol de componentes del molde (como Fusion).
 * Uso: URL=<prod>/forja-brep.html node /home/ian/Orkesta/la-forja/scripts/mold-verify-tree.cjs <outdir>
 */
const { chromium } = require('playwright');
(async () => {
  const url = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
  const dir = process.argv[2] || '/tmp/mr/tree';
  require('fs').mkdirSync(dir, { recursive: true });
  const b = await chromium.launch({ headless: false, args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('[data-testid="viewport-canvas"]', { timeout: 90000 });
  await p.waitForTimeout(Number(process.env.WAIT || 12000));
  await p.click('[data-testid="btn-fit"]').catch(() => {});
  await p.waitForTimeout(1200);

  const roles = await p.$$eval('[data-testid^="mold-part-"]', (els) => els.map((e) => e.getAttribute('data-testid').replace('mold-part-', ''))).catch(() => []);
  console.log('ROLES:', roles.join(', '));

  // AISLAR la placa A (cavidad)
  await p.click('[data-testid="mold-isolate-A"]').catch((e) => console.log('isolate fail', String(e).slice(0, 50)));
  await p.waitForTimeout(1000);
  let vis = await p.$eval('[data-testid="mold-visible-count"]', (el) => el.textContent).catch(() => '?');
  console.log('tras AISLAR A → visibles:', vis, '(esperado 1/6)');
  await p.click('[data-testid="btn-fit"]').catch(() => {});
  await p.waitForTimeout(800);
  await p.screenshot({ path: dir + '/1-isolate-A.png' });

  // MOSTRAR TODAS
  await p.click('[data-testid="mold-show-all"]').catch(() => {});
  await p.waitForTimeout(800);
  vis = await p.$eval('[data-testid="mold-visible-count"]', (el) => el.textContent).catch(() => '?');
  console.log('tras MOSTRAR TODAS → visibles:', vis, '(esperado 6/6)');

  // OCULTAR la placa clamp (sujeción, la de arriba) para ver adentro
  await p.click('[data-testid="mold-hide-clamp"]').catch(() => {});
  await p.waitForTimeout(800);
  vis = await p.$eval('[data-testid="mold-visible-count"]', (el) => el.textContent).catch(() => '?');
  console.log('tras OCULTAR clamp → visibles:', vis, '(esperado 5/6)');
  await p.screenshot({ path: dir + '/2-hide-clamp.png' });

  // OPACIDAD de la placa A al mínimo
  await p.click('[data-testid="mold-show-all"]').catch(() => {});
  await p.waitForTimeout(400);
  const slider = await p.$('[data-testid="mold-opacity-A"]');
  if (slider) { await slider.focus(); for (let i = 0; i < 16; i++) await p.keyboard.press('ArrowLeft'); }
  await p.waitForTimeout(800);
  await p.screenshot({ path: dir + '/3-opacity-A-min.png' });
  console.log('SS →', dir);
  await b.close();
})().catch((e) => { console.log('SS_FATAL', String(e.stack || e).slice(0, 300)); process.exit(1); });
