/** Verifica (1) pines en el RIM+costillas (no en el centro) y (2) el gizmo de MOVER.
 *  Uso: URL=… node …/mold-frame-move.cjs <outdir> */
const { chromium } = require('playwright');
(async () => {
  const url = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
  const dir = process.argv[2] || '/tmp/mr/fm';
  require('fs').mkdirSync(dir, { recursive: true });
  const b = await chromium.launch({ headless: false, args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('  [PAGEERR]', String(e).slice(0, 140)));
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('[data-testid="viewport-canvas"]', { timeout: 90000 });
  await p.waitForTimeout(Number(process.env.WAIT || 13000));
  // (1) PINES: mira solo pines + pieza para ver que van en el rim, no el centro
  for (const r of ['clamp', 'A', 'B', 'support', 'bottom', 'guias', 'agua-a', 'agua-b', 'inserto-cav', 'inserto-core', 'colada'])
    await p.click(`[data-testid="mold-hide-${r}"]`).catch(() => {});
  await p.click('[data-testid="btn-fit"]').catch(() => {});
  await p.waitForTimeout(1000);
  await p.screenshot({ path: dir + '/1-pins-frame.png' });

  // (2) MOVER: muestra todo, selecciona el inserto de núcleo, activa mover, arrastra
  await p.click('[data-testid="mold-show-all"]').catch(() => {});
  await p.waitForTimeout(400);
  await p.click('[data-testid="mold-part-inserto-core"]').catch(() => {});
  await p.click('[data-testid="mold-move-mode"]').catch(() => {});
  await p.waitForTimeout(900);
  const moveOn = await p.$eval('[data-testid="mold-move-mode"]', (el) => el.className.includes('on')).catch(() => false);
  console.log('modo mover activo =', moveOn);
  await p.click('[data-testid="btn-fit"]').catch(() => {});
  await p.waitForTimeout(800);
  await p.screenshot({ path: dir + '/2-move-gizmo.png' });
  console.log('SS →', dir);
  await b.close();
})().catch((e) => { console.log('SS_FATAL', String(e.stack || e).slice(0, 300)); process.exit(1); });
