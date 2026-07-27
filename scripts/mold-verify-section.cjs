/**
 * VERIFICA el molde en la escena viva: (1) árbol de componentes visible,
 * (2) título del documento = nombre del molde, (3) SECCIÓN interactiva (flecha)
 * corta el molde y deja ver adentro — NO la película full-screen.
 * Uso: URL=<prod>/forja-brep.html node scripts/mold-verify-section.cjs <outdir>
 */
const { chromium } = require('playwright');
(async () => {
  const url = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
  const dir = process.argv[2] || '/tmp/mr/sec';
  require('fs').mkdirSync(dir, { recursive: true });
  const b = await chromium.launch({ headless: false, args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('console', (m) => { const t = m.text(); if (/mold|live|section|solid|error/i.test(t)) console.log('  [c]', t.slice(0, 120)); });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('[data-testid="viewport-canvas"]', { timeout: 90000 });
  await p.waitForTimeout(Number(process.env.WAIT || 12000));   // poll + build del molde + tesela
  await p.click('[data-testid="btn-fit"]').catch(() => {});
  await p.waitForTimeout(1500);

  const doc = await p.evaluate(() => document.querySelector('[data-testid="doc-title"]')?.textContent || '').catch(() => '');
  const treeVis = await p.$('[data-testid="mold-parts-list"]').then((e) => !!e).catch(() => false);
  const nParts = await p.$$eval('[data-testid^="mold-part-"]', (els) => els.length).catch(() => 0);
  console.log('DOC:', doc.slice(0, 70), '| tree:', treeVis, '| parts:', nParts);
  await p.screenshot({ path: dir + '/1-tree.png' });

  // enciende la SECCIÓN interactiva (botón de la barra de vista, arriba)
  await p.click('[data-testid="btn-section-tool"]').catch((e) => console.log('  section click fail', String(e).slice(0, 60)));
  await p.waitForTimeout(1800);
  const secOn = await p.$eval('[data-testid="btn-section-tool"]', (el) => el.className.includes('on')).catch(() => false);
  const movie = await p.$('div[style*="z-index: 10000"], div[style*="zIndex: 10000"]').then((e) => !!e).catch(() => false);
  console.log('SECTION on:', secOn, '| movie-overlay (debe ser false):', movie);
  await p.screenshot({ path: dir + '/2-section.png' });

  // arrastra la flecha del corte para barrer el plano
  const canvas = await p.$('[data-testid="viewport-canvas"]');
  const box = await canvas.boundingBox();
  await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6, { steps: 12 });
  await p.mouse.up();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: dir + '/3-section-swept.png' });
  console.log('SS →', dir);
  await b.close();
})().catch((e) => { console.log('SS_FATAL', String(e.stack || e).slice(0, 300)); process.exit(1); });
