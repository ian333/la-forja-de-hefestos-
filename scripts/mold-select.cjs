/** Verifica que SELECCIONAR un componente en el árbol lo RESALTA en 3D (dorado).
 *  Uso: URL=… node …/mold-select.cjs <outdir> */
const { chromium } = require('playwright');
(async () => {
  const url = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
  const dir = process.argv[2] || '/tmp/mr/sel';
  require('fs').mkdirSync(dir, { recursive: true });
  const b = await chromium.launch({ headless: false, args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('[data-testid="viewport-canvas"]', { timeout: 90000 });
  await p.waitForTimeout(Number(process.env.WAIT || 13000));
  // oculta placas para ver el inserto, luego SELECCIONA el inserto de núcleo
  for (const r of ['clamp', 'A', 'B', 'support', 'bottom', 'agua-a', 'agua-b', 'pines', 'guias']) await p.click(`[data-testid="mold-hide-${r}"]`).catch(() => {});
  await p.click('[data-testid="btn-fit"]').catch(() => {});
  await p.waitForTimeout(1000);
  await p.screenshot({ path: dir + '/1-before-select.png' });
  // clic en el NODO del componente (no en los botones) → resalta en 3D
  await p.click('[data-testid="mold-part-inserto-core"] .fb-feat-body strong').catch(() => p.click('[data-testid="mold-part-inserto-core"]').catch(() => {}));
  await p.waitForTimeout(900);
  const active = await p.$eval('[data-testid="mold-part-inserto-core"]', (el) => el.className.includes('active')).catch(() => false);
  console.log('nodo inserto-core .active =', active);
  await p.screenshot({ path: dir + '/2-selected.png' });
  console.log('SS →', dir);
  await b.close();
})().catch((e) => { console.log('SS_FATAL', String(e.stack || e).slice(0, 300)); process.exit(1); });
