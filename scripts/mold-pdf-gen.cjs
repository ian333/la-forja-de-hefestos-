/**
 * GENERADOR DE PDF DEL MOLDE — el entregable al cliente. Para cada uno de los 4
 * ejemplos del libro (cup/lid/jabonera/bezel) arma el SET de planos (ensamble +
 * plano individual de cada placa) y lo imprime a un PDF profesional A3 apaisado
 * multipágina (Chrome page.pdf). Cotas LITERALES del libro donde el libro las da;
 * mold base = placa comercial estándar. Corre en iangpu (playwright).
 */
const path = require('path');
const { chromium } = require('playwright');

// ── los 4 ejemplos del libro (parte LITERAL; § citado en el ensamble) ──
const EXAMPLES = [
  { key: 'cup', spec: {
    name: 'Molde vaso (cup)', code: 'MLD-CUP', widthMm: 246,
    plates: { bottomClamp: 36, ejectorHousing: 66, support: 46, B: 66, A: 66, topClamp: 36 },
    cavity: { widthMm: 62, depthMm: 58 },                       // ⌀60 core (§12.3), alto 58 (§12.3)
    cooling: { diaMm: 6.35, plug: 'JP-251', insetMm: 40 },      // 6.35mm ×4 (§9.2)
    ejectors: { type: 'pin', diaMm: 4, count: 8 },
    core: { diaMm: 60, material: 'AISI P20' }, cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)',
    machine: 'clamp 400 kN (§11.2)', clampTons: 41,
  } },
  { key: 'lid', spec: {
    name: 'Molde tapa (lid)', code: 'MLD-LID', widthMm: 246,
    plates: { bottomClamp: 36, ejectorHousing: 66, support: 46, B: 56, A: 46, topClamp: 36 },
    cavity: { widthMm: 82, depthMm: 12 },                       // tapa con labio undercut (§11.3.5)
    cooling: { diaMm: 6.35, plug: 'JP-251', insetMm: 42 },
    ejectors: { type: 'stripper', diaMm: 6, count: 4 },         // stripper (§11.3.4) por el undercut
    core: { diaMm: 80, material: 'AISI P20' }, cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)',
    machine: 'stripper (§11.3.5)', clampTons: 41,
  } },
  { key: 'jabonera', spec: {
    name: 'Molde jabonera (box)', code: 'MLD-BOX', widthMm: 296,
    plates: { bottomClamp: 36, ejectorHousing: 66, support: 56, B: 76, A: 56, topClamp: 36 },
    cavity: { widthMm: 120, depthMm: 30 },                      // caja 120×80×30
    cooling: { diaMm: 7.94, plug: 'JP-352', insetMm: 50 },
    ejectors: { type: 'pin', diaMm: 5, count: 8 },
    core: { widthMm: 116, material: 'AISI P20' }, cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)',
    machine: 'clamp ~600 kN', clampTons: 61,
  } },
  { key: 'bezel', spec: {
    name: 'Molde bezel laptop', code: 'MLD-BEZEL', widthMm: 381,   // placa 381×302 (§12.2 LIBRO)
    plates: { bottomClamp: 36, ejectorHousing: 66, support: 120, B: 76, A: 56, topClamp: 36 }, // soporte 120 (§12 LIBRO)
    cavity: { widthMm: 248, depthMm: 10 },                       // cavidad 248×168 (§12.2 LIBRO)
    cooling: { diaMm: 9.53, plug: 'JP-352', insetMm: 70 },
    ejectors: { type: 'pin', diaMm: 2.23, count: 20 },          // 20 pines ⌀2.23 (§11.2.3 LIBRO)
    core: { widthMm: 248, material: 'AISI P20' }, cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)',
    machine: 'clamp 200 t / 1400 kN (§12/§11)', clampTons: 200,
  } },
];

(async () => {
  const DS = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-drawing-set.ts'));
  const outDir = process.env.OUT || '/tmp/mold-pdfs';
  require('fs').mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--headless=new'] });
  const ctx = await browser.newContext({ viewport: { width: 2400, height: 1720 }, deviceScaleFactor: 1 });   // idéntico al svg2png que renderiza completo
  const page = await ctx.newPage();

  for (const ex of EXAMPLES) {
    const set = DS.moldDrawingSet(ex.spec);
    // 1) rasteriza cada lámina con el.screenshot (WYSIWYG, sin recorte del A3)
    const pngs = [];
    for (const pg of set.pages) {
      await page.setContent('<body style="margin:0;background:#fff">' + pg.svg + '</body>');
      await page.waitForTimeout(120);
      const el = await page.$('svg');
      pngs.push((await el.screenshot()).toString('base64'));
    }
    // 2) compone el PDF con cada PNG a página A3 completa (object-fit contain → nada se corta)
    const html = `<!doctype html><html><head><meta charset="utf8"><style>
      @page { size: A3 landscape; margin: 0; }
      html,body { margin:0; padding:0; }
      .pg { page-break-after: always; width: 420mm; height: 297mm;
        background-repeat: no-repeat; background-position: center; background-size: contain; }
      .pg:last-child { page-break-after: auto; }
    </style></head><body>${pngs.map((b) => `<div class="pg" style="background-image:url(data:image/png;base64,${b})"></div>`).join('')}</body></html>`;
    await page.setContent(html, { waitUntil: 'networkidle' });
    const out = path.join(outDir, `plano-molde-${ex.key}.pdf`);
    await page.pdf({ path: out, format: 'A3', landscape: true, printBackground: true });
    console.log(`OK ${ex.key}: ${set.pages.length} láminas → ${out}`);
  }
  await browser.close();
  console.log('PDFS_OK');
})().catch((e) => { console.log('FATAL', String(e.stack || e).slice(0, 400)); process.exit(1); });
