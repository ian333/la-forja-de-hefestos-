/**
 * REVISIÓN PLACA POR PLACA: aísla cada componente del molde y lo captura desde
 * VARIOS ÁNGULOS (ISO/FRE/SUP) para inspección a resolución completa. Al final,
 * 3 tomas del ensamble completo. Uso: URL=… node …/mold-review-plates.cjs <outdir>
 */
const { chromium } = require('playwright');
(async () => {
  const url = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
  const dir = process.argv[2] || '/tmp/mr/rev';
  require('fs').mkdirSync(dir, { recursive: true });
  const b = await chromium.launch({ headless: false, args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer'] });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('[data-testid="viewport-canvas"]', { timeout: 90000 });
  // espera ACTIVA a que el árbol del molde exista (build wasm en browser ≈ 25-60 s
  // con TODOS los barrenos: compile wasm frío + ~100 booleanas)
  await p.waitForFunction(() => document.querySelectorAll('[data-testid^="mold-part-"]').length > 3, null, { timeout: 150000 }).catch(() => {});
  await p.waitForTimeout(1500);

  const roles = await p.$$eval('[data-testid^="mold-part-"]', (els) => els.map((e) => e.getAttribute('data-testid').replace('mold-part-', ''))).catch(() => []);
  console.log('componentes:', roles.join(','));
  const canvas = await p.$('[data-testid="viewport-canvas"]');

  const shot = async (label, view) => {
    if (view) await p.click(`text=${view}`, { timeout: 1500 }).catch(() => {});
    await p.waitForTimeout(900);
    const box = await canvas.boundingBox();
    await p.screenshot({ path: `${dir}/${label}.png`, clip: box });
  };
  const viewBtn = async (v) => { // ISO/SUP/FRE de la barra HUD
    await p.$$eval('[data-testid="hud-view"] button', (bs, vv) => { const b2 = bs.find((x) => x.textContent.trim() === vv); if (b2) b2.click(); }, v).catch(() => {});
    await p.waitForTimeout(1100);
  };

  for (const r of roles) {
    await p.click(`[data-testid="mold-isolate-${r}"]`).catch(() => {});
    await p.waitForTimeout(400);
    await p.click('[data-testid="btn-fit"]').catch(() => {});
    await p.waitForTimeout(1100);
    const box = await canvas.boundingBox();
    await p.screenshot({ path: `${dir}/${r}-iso.png`, clip: box });
    await viewBtn('FRE');
    await p.screenshot({ path: `${dir}/${r}-fre.png`, clip: box });
    await viewBtn('SUP');
    await p.screenshot({ path: `${dir}/${r}-sup.png`, clip: box });
    await viewBtn('ISO');
    console.log('  ✓', r);
  }
  // ensamble completo desde 3 ángulos
  await p.click('[data-testid="mold-show-all"]').catch(() => {});
  await p.waitForTimeout(600);
  await p.click('[data-testid="btn-fit"]').catch(() => {});
  await p.waitForTimeout(1100);
  const box = await canvas.boundingBox();
  await p.screenshot({ path: `${dir}/_full-iso.png`, clip: box });
  await viewBtn('FRE'); await p.screenshot({ path: `${dir}/_full-fre.png`, clip: box });
  await viewBtn('SUP'); await p.screenshot({ path: `${dir}/_full-sup.png`, clip: box });
  console.log('SS →', dir);
  await b.close();
})().catch((e) => { console.log('SS_FATAL', String(e.stack || e).slice(0, 300)); process.exit(1); });
