/** HERO del molde: full ISO + una vista con placas A/B ocultas para lucir los pines,
 *  el enfriamiento y la pieza. Uso: URL=… node …/mold-hero.cjs <outdir> */
const { chromium } = require('playwright');
(async () => {
  const url = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
  const dir = process.argv[2] || '/tmp/mr/hero';
  require('fs').mkdirSync(dir, { recursive: true });
  const b = await chromium.launch({ headless: false, args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('[data-testid="viewport-canvas"]', { timeout: 90000 });
  await p.waitForTimeout(Number(process.env.WAIT || 13000));
  await p.click('[data-testid="btn-fit"]').catch(() => {});
  await p.waitForTimeout(1500);
  await p.screenshot({ path: dir + '/1-full-iso.png' });

  // oculta las placas de acero exteriores + A/B para lucir el interior (pines/agua/pieza)
  for (const r of ['clamp', 'A', 'B', 'support', 'bottom']) await p.click(`[data-testid="mold-hide-${r}"]`).catch(() => {});
  await p.waitForTimeout(600);
  await p.click('[data-testid="btn-fit"]').catch(() => {});
  await p.waitForTimeout(1200);
  const vis = await p.$eval('[data-testid="mold-visible-count"]', (el) => el.textContent).catch(() => '?');
  console.log('interior visible:', vis);
  await p.screenshot({ path: dir + '/2-interior.png' });

  // sección del molde completo
  await p.click('[data-testid="mold-show-all"]').catch(() => {});
  await p.waitForTimeout(500);
  await p.click('[data-testid="btn-section-tool"]').catch(() => {});
  await p.waitForTimeout(1500);
  await p.screenshot({ path: dir + '/3-section.png' });
  console.log('SS →', dir);
  await b.close();
})().catch((e) => { console.log('SS_FATAL', String(e.stack || e).slice(0, 300)); process.exit(1); });
