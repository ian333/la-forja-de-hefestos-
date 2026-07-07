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
  }, analysis: [
    { grupo: 'DFM', param: 'moldeabilidad de la pieza', valor: 'OK', ref: '§2.3' },
    { grupo: 'Llenado', param: 'presión de cierre (área proy × P)', valor: '400 kN (41 t)', ref: '§11.2', ok: true },
    { grupo: 'Núcleo', param: 'hoop compresivo ⌀60 (P 80 MPa)', valor: '240 MPa', ref: '§12.3.2', ok: true },
    { grupo: 'Núcleo', param: 'Ø interno máx (fatiga QC7)', valor: '31 mm', ref: '§12.3.2' },
    { grupo: 'Núcleo', param: 'compresión axial', valor: '216 MPa · δ 0.06 mm', ref: '§12.3.1', ok: true },
    { grupo: 'Núcleo', param: 'deflexión por flexión', valor: '0.03 mm', ref: '§12.3.3', ok: true },
    { grupo: 'Expulsión', param: 'fuerza de expulsión (A_eff 526 mm²)', valor: '1 800 N', ref: '§11.2.2', ok: true },
    { grupo: 'Expulsión', param: '8 pines (cortante gobierna)', valor: '⌀4 mm', ref: '§11.2.3' },
    { grupo: 'Enfriamiento', param: 'calor/línea → caudal', valor: '260 W → 6.2e-5 m³/s (1 GPM)', ref: '§9.2.3', ok: true },
    { grupo: 'Enfriamiento', param: 'plug DME (turbulento Re>4000)', valor: 'JP-251 ⌀6.35 mm', ref: '§9.2.4', ok: true },
    { grupo: 'Máquina', param: 'inyectora seleccionada', valor: 'clase 50 t', ref: '§4.3.3', ok: true },
  ] },
  { key: 'lid', spec: {
    name: 'Molde tapa (lid)', code: 'MLD-LID', widthMm: 246,
    plates: { bottomClamp: 36, ejectorHousing: 66, support: 46, B: 56, A: 46, topClamp: 36 },
    cavity: { widthMm: 82, depthMm: 12 },                       // tapa con labio undercut (§11.3.5)
    cooling: { diaMm: 6.35, plug: 'JP-251', insetMm: 42 },
    ejectors: { type: 'stripper', diaMm: 6, count: 4 },         // stripper (§11.3.4) por el undercut
    core: { diaMm: 80, material: 'AISI P20' }, cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)',
    machine: 'stripper (§11.3.5)', clampTons: 41,
  }, analysis: [
    { grupo: 'Expulsión', param: 'undercut elástico ε = δ/L (δ1/L77)', valor: '1.3 % < 2 % cedencia', ref: '§11.3.5', ok: true },
    { grupo: 'Expulsión', param: 'cortante en el undercut', valor: '1.7 MPa < 22 (½·cedencia)', ref: '§11.3.5', ok: true },
    { grupo: 'Expulsión', param: 'fuerza de expulsión del undercut', valor: '1 200 N', ref: '§11.3.5', ok: true },
    { grupo: 'Expulsión', param: 'método (fuerza uniforme, in-line)', valor: 'stripper plate', ref: '§11.3.4', ok: true },
    { grupo: 'Enfriamiento', param: 'plug DME', valor: 'JP-251 ⌀6.35 mm', ref: '§9.2' },
    { grupo: 'Máquina', param: 'inyectora seleccionada', valor: 'clase 50 t', ref: '§4.3.3', ok: true },
  ] },
  { key: 'jabonera', spec: {
    name: 'Molde jabonera (box)', code: 'MLD-BOX', widthMm: 296,
    plates: { bottomClamp: 36, ejectorHousing: 66, support: 56, B: 76, A: 56, topClamp: 36 },
    cavity: { widthMm: 120, depthMm: 30 },                      // caja 120×80×30
    cooling: { diaMm: 7.94, plug: 'JP-352', insetMm: 50 },
    ejectors: { type: 'pin', diaMm: 5, count: 8 },
    core: { widthMm: 116, material: 'AISI P20' }, cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)',
    machine: 'clamp ~600 kN', clampTons: 61,
  }, analysis: [
    { grupo: 'DFM', param: 'caja 120×80×30, pared 2 mm', valor: 'OK', ref: '§2.3' },
    { grupo: 'Llenado', param: 'presión de cierre', valor: '~600 kN (61 t)', ref: '§11.2', ok: true },
    { grupo: 'Expulsión', param: '8 pines en la periferia', valor: '⌀5 mm', ref: '§11.2.3' },
    { grupo: 'Enfriamiento', param: 'plug DME', valor: 'JP-352 ⌀7.94 mm', ref: '§9.2', ok: true },
    { grupo: 'Cores esbeltos', param: 'método por Ø (Tabla 9.3)', valor: 'baffle (12-75 mm)', ref: '§9.3.5', ok: true },
    { grupo: 'Máquina', param: 'inyectora seleccionada', valor: 'clase 90 t', ref: '§4.3.3', ok: true },
  ] },
  { key: 'bezel', spec: {
    name: 'Molde bezel laptop', code: 'MLD-BEZEL', widthMm: 381,   // placa 381×302 (§12.2 LIBRO)
    plates: { bottomClamp: 36, ejectorHousing: 66, support: 120, B: 76, A: 56, topClamp: 36 }, // soporte 120 (§12 LIBRO)
    cavity: { widthMm: 248, depthMm: 10 },                       // cavidad 248×168 (§12.2 LIBRO)
    cooling: { diaMm: 9.53, plug: 'JP-352', insetMm: 70 },
    ejectors: { type: 'pin', diaMm: 2.23, count: 20 },          // 20 pines ⌀2.23 (§11.2.3 LIBRO)
    core: { widthMm: 248, material: 'AISI P20' }, cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)',
    machine: 'clamp 200 t / 1400 kN (§12/§11)', clampTons: 200,
  }, analysis: [
    { grupo: 'DFM', param: 'moldeabilidad (7 costillas + draft)', valor: 'OK', ref: '§2.3' },
    { grupo: 'Llenado', param: 'presión de llenado (pared 1.5 mm)', valor: '83.2 MPa', ref: '§5.5.2', ok: true },
    { grupo: 'Llenado', param: 'presión de cierre', valor: '1 400 kN (200 t)', ref: '§11.2', ok: true },
    { grupo: 'Expulsión', param: 'fuerza de expulsión (A_eff 1.3e-3 m²)', valor: '4 700 N', ref: '§11.2.2', ok: true },
    { grupo: 'Expulsión', param: '20 pines (cortante gobierna)', valor: '⌀2.23 mm', ref: '§11.2.3', ok: true },
    { grupo: 'Estructura', param: 'placa de soporte 120 mm SIN pilares', valor: 'δ 0.056 mm > venteo → FLASH', ref: '§12.1.2', ok: false },
    { grupo: 'Estructura', param: '→ con pilares de soporte', valor: 'δ < 0.02 mm', ref: '§12.1', ok: true },
    { grupo: 'Flow leaders', param: 'balance de llenado (evita race-track)', valor: 'espesor H·(L/Lref)', ref: '§5.5.5' },
    { grupo: 'Enfriamiento', param: 'plug DME', valor: 'JP-352 ⌀9.53 mm', ref: '§9.2', ok: true },
    { grupo: 'Máquina', param: 'inyectora (cierre gobierna)', valor: 'clase 250 t', ref: '§4.3.3', ok: true },
  ] },
];

(async () => {
  const DS = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-drawing-set.ts'));
  const outDir = process.env.OUT || '/tmp/mold-pdfs';
  require('fs').mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--headless=new'] });
  const ctx = await browser.newContext({ viewport: { width: 2400, height: 1720 }, deviceScaleFactor: 1 });   // idéntico al svg2png que renderiza completo
  const page = await ctx.newPage();

  for (const ex of EXAMPLES) {
    const set = DS.moldDrawingSet(ex.spec, ex.analysis);
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
