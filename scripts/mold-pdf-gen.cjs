/**
 * GENERADOR DE PDF DEL MOLDE — el entregable al cliente. Para cada uno de los 4
 * ejemplos del libro (cup/lid/jabonera/bezel) arma el SET de planos (ensamble +
 * plano individual de cada placa) y lo imprime a un PDF profesional A3 apaisado
 * multipágina (Chrome page.pdf). Cotas LITERALES del libro donde el libro las da;
 * mold base = placa comercial estándar. Corre en iangpu (playwright).
 */
const path = require('path');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { chromium } = require('playwright');

// ── kernel OCCT (para construir las piezas y proyectar iso + 3 vistas) ──
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!existsSync(cjsGlue)) {
  let s = readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  writeFileSync(cjsGlue, s);
}
const occtFactory = require(cjsGlue);
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));

// construye el SÓLIDO de la pieza moldeada de cada ejemplo (geometría del libro)
function buildPart(K, oc, key) {
  if (key === 'cup') {
    return K.revolvePolygon(oc, [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 58 }, { x: 28, y: 58 }, { x: 28, y: 3 }, { x: 0, y: 3 }], 360);
  }
  if (key === 'lid') {
    return K.revolvePolygon(oc, [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 8 }, { x: 41, y: 9 }, { x: 41, y: 11 }, { x: 38, y: 11 }, { x: 38, y: 2 }, { x: 0, y: 2 }], 360);
  }
  if (key === 'jabonera') {
    let b = K.makeBox(oc, 120, 80, 30);
    const faces = K.enumerateFaces(oc, b);
    let top = 0, mz = -1e9; faces.forEach((f, i) => { if (f.centroid && f.centroid[2] > mz) { mz = f.centroid[2]; top = i; } });
    b = K.shellSolid(oc, b, 2, [top]);
    return K.filletAllEdgesResilient(oc, b, 3).shape;
  }
  // bezel: marco 240×160 con ventana + 7 costillas + 4 bosses + draft
  const outer = [{ x: 0, y: 0 }, { x: 240, y: 0 }, { x: 240, y: 160 }, { x: 0, y: 160 }];
  const win = [{ x: 20, y: 20 }, { x: 220, y: 20 }, { x: 220, y: 140 }, { x: 20, y: 140 }];
  let bz = K.extrudePolygonWithHoles(oc, outer, [win], 10);
  for (let i = 0; i < 7; i++) { const x = 30 + i * 26; bz = K.fuse(oc, bz, K.extrudePolygon(oc, [{ x, y: 20 }, { x: x + 1, y: 20 }, { x: x + 1, y: 140 }, { x, y: 140 }], 10)); }
  for (const [cx, cy] of [[30, 30], [210, 30], [30, 130], [210, 130]]) bz = K.fuse(oc, bz, K.makeCylinder(oc, 3, 10, { origin: [cx, cy, 0], dir: [0, 0, 1] }));
  const fs = K.enumerateFaces(oc, bz); const vert = fs.map((f, i) => i).filter((i) => fs[i].normal && Math.abs(fs[i].normal[2]) < 0.3);
  return K.draftFaces(oc, bz, 1, [0, 0, 1], 0, vert.slice(0, 12));
}

// construye una PLACA como SÓLIDO del kernel: caja W×D×espesor + apertura de
// cavidad pasante (placas A/B) + barrenos estándar pasantes (mismos que el plano
// plano: standardHoles). Boolean por barreno con try/catch → si uno no cabe, se
// omite y la placa sigue (no aborta la lámina).
function buildPlate(K, DS, oc, spec, def) {
  const W = spec.widthMm, D = DS.plateDepth(spec), t = def.thick;
  let solid = K.makeBox(oc, W, D, t);
  // apertura de cavidad (pasante, rectangular) en placas A y B
  if (def.role === 'A' || def.role === 'B') {
    const cw = spec.cavity.widthMm, cd = Math.round(spec.cavity.widthMm * 0.67);
    const cx = W / 2, cy = D / 2;
    const rect = [
      { x: cx - cw / 2, y: cy - cd / 2 }, { x: cx + cw / 2, y: cy - cd / 2 },
      { x: cx + cw / 2, y: cy + cd / 2 }, { x: cx - cw / 2, y: cy + cd / 2 },
    ];
    try {
      const tool = K.extrudePolygon(oc, rect, t + 2, K.offsetPlane(K.PLANE_XY, -1));
      solid = K.cut(oc, solid, tool);
    } catch (e) { /* si la apertura falla, la placa queda sólida */ }
  }
  // barrenos estándar pasantes (SHCS, pilares guía, expulsores, sprue)
  const holes = DS.standardHoles(spec, def.role);
  let drilled = 0;
  for (const h of holes) {
    try { solid = K.drillHole(oc, solid, { x: h.x, y: h.y, diameter: h.dia, zTop: t, depth: t, through: true }); drilled++; }
    catch (e) { /* barreno que no cabe: se omite */ }
  }
  return { solid, drilled, holes: holes.length };
}

// ── PALETA de materiales (SolidWorks-style: acero azul-gris, plástico ámbar) ──
const STEEL = [150, 165, 185];         // acero de mold base
const platePartStyle = (role) => (role === 'A' || role === 'B')
  ? { color: STEEL, opacity: 0.6, edgeColor: '#18202c' }   // cavidad/núcleo: TRANSLÚCIDA (se ve la cavidad)
  : { color: STEEL, edgeColor: '#12161c' };                // resto: acero opaco
const PART_STYLE = { color: [224, 122, 48], opacity: 0.55, edgeColor: '#5a2a10' };  // plástico moldeado ámbar translúcido

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
  const K = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const DRAW = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'drawing.ts'));
  const ISO = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'isoview.ts'));
  const oc = await occtFactory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  K._setActiveOCCT(oc);
  const outDir = process.env.OUT || '/tmp/mold-pdfs';
  require('fs').mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--headless=new'] });
  const ctx = await browser.newContext({ viewport: { width: 2400, height: 1720 }, deviceScaleFactor: 1 });   // idéntico al svg2png que renderiza completo
  const page = await ctx.newPage();

  // helper: 4 vistas (3 ortográficas HLR + isométrico sombreado a color) de un sólido
  const fourView = (solid, meta, style, deflLin = 0.15, legend = []) => {
    const mesh = K.tessellate(oc, solid, deflLin, 0.4);
    const edges = K.enumerateEdgesGeom(oc, solid).map((e) => ({ polyline: e.polyline, kind: e.kind }));
    const three = DRAW.generateDrawing({ positions: mesh.positions, indices: mesh.indices, edges }, meta);
    const svg = ISO.partSheet4View(three.svg,
      { positions: mesh.positions, indices: mesh.indices, normals: mesh.normals, edges }, meta, style, legend);
    return { svg, tri: mesh.triangleCount, views: three.views.map((v) => v.key).join('/') };
  };

  for (const ex of EXAMPLES) {
    const set = DS.moldDrawingSet(ex.spec, ex.analysis);
    // las láminas planas de placa vienen tras Ensamble (+ Análisis) — las intercalamos
    // con su lámina de 4 vistas a color (cada placa: planta acotada + 3 vistas + iso).
    const defs = DS.plateDefs(ex.spec);
    const head = set.pages.slice(0, set.pages.length - defs.length);   // Ensamble, Análisis
    const flatPlans = set.pages.slice(set.pages.length - defs.length); // planos planos, en orden de defs
    const pages = [...head];
    defs.forEach((def, i) => {
      pages.push(flatPlans[i]);   // planta acotada + tabla de barrenos (para el maquinista)
      try {
        const { solid, drilled, holes } = buildPlate(K, DS, oc, ex.spec, def);
        const meta = { name: def.name, code: def.code, material: def.mat, units: 'mm' };
        const legend = DS.holeLegend(DS.standardHoles(ex.spec, def.role));
        const fv = fourView(solid, meta, platePartStyle(def.role), 0.2, legend);
        pages.push({ name: `${def.name} · 4 vistas`, svg: fv.svg });
        console.log(`  placa ${def.role}: ${drilled}/${holes} barrenos · 4 vistas (${fv.views}, ${fv.tri} tri)${def.role === 'A' || def.role === 'B' ? ' · TRANSLÚCIDA' : ''}`);
      } catch (e) { console.log(`  placa ${def.role} SIN 4 vistas: ${String(e.message || e).slice(0, 120)}`); }
    });
    set.pages = pages;
    // LÁMINA DE LA PIEZA MOLDEADA: 4 vistas + iso ÁMBAR TRANSLÚCIDO (plástico)
    try {
      const solid = buildPart(K, oc, ex.key);
      const meta = { name: ex.spec.name, code: ex.spec.code, material: 'ABS', units: 'mm' };
      const fv = fourView(solid, meta, PART_STYLE, 0.1);   // partSheet4View ya antepone "PIEZA · "
      set.pages.push({ name: 'Pieza moldeada · 4 vistas', svg: fv.svg });
      console.log(`  pieza ${ex.key}: 4 vistas ámbar translúcido (${fv.views}, ${fv.tri} tri)`);
    } catch (e) { console.log(`  pieza ${ex.key} SIN vistas: ${String(e.message || e).slice(0, 100)}`); }
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
