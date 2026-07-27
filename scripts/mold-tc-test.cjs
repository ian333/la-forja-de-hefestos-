/**
 * GATE del mapa t_c LOCAL + CONSEJO GENERATIVO de agua:
 *   1. pieza 12/2 mm → t_c_max/t_c_min = (12/2)² = 36 EXACTO (Eq 9.5, t∝h²)
 *      y t_c(12mm) == coolingTimePlate(0.012) al decimal
 *   2. colores: pared gruesa ROJA, delgada AZUL
 *   3. consejo: hot spot EN el patrón → ✓ cubierto; PROFUNDO → BAFFLE §9.3.5.2
 *      con marcador; DESALINEADO lateral → MOVER línea
 * Uso: node --import tsx scripts/mold-tc-test.cjs
 */
const path = require('path');

const bezel = {
  name: 'Molde bezel laptop', code: 'MLD-BEZEL', widthMm: 381,
  plates: { bottomClamp: 36, ejectorHousing: 66, support: 120, B: 76, A: 56, topClamp: 36 },
  cavity: { widthMm: 240, depthMm: 10, shape: 'rect', lenMm: 160, wallMm: 1.5, frameMm: 20, ribs: 7 },
  cooling: { diaMm: 6.35, plug: 'JP-251', insetMm: 70 },
  ejectors: { type: 'pin', diaMm: 3, count: 20 },
  core: { widthMm: 240, material: 'AISI P20' },
  cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)', clampTons: 200, feed: 'hot-runner', nCav: 1,
};

let fails = 0;
const check = (name, cond, detail) => {
  console.log(` ${cond ? '✓' : '❌'} ${name} — ${detail}`);
  if (!cond) fails++;
};

function twoBoxMesh() {
  const pos = []; const idx = [];
  const box = (x0, x1, y0, y1, z0, z1) => {
    const base = pos.length / 3;
    const v = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
    for (const p of v) pos.push(...p);
    for (const t of [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[2,3,7],[2,7,6],[1,2,6],[1,6,5],[3,0,4],[3,4,7]]) idx.push(base + t[0], base + t[1], base + t[2]);
  };
  box(0, 20, 0, 30, 0, 12);
  box(20, 40, 0, 30, 0, 2);
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

(async () => {
  const TC = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-tc-map.ts'));
  const CO = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'cooling.ts'));
  const DS = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-drawing-set.ts'));

  const mesh = twoBoxMesh();
  const map = TC.tcLocalMap(mesh);
  console.log(`map: hot ${map.hot.thMm} mm @(${map.hot.xMm},${map.hot.yMm}) t_c=${map.hot.tcS}s · rango [${map.tcMinS}..${map.tcMaxS}] s`);
  const ratio = map.tcMaxS / map.tcMinS;
  check('t_c máx/mín = (12/2)² = 36 (Eq 9.5, t∝h²)', Math.abs(ratio - 36) < 2, `${ratio.toFixed(1)}×`);
  const tcBook = CO.coolingTimePlate(0.012, CO.ABS_KAZMER);
  check('t_c(12 mm) == coolingTimePlate del libro', Math.abs(map.tcMaxS - tcBook) < 0.05, `${map.tcMaxS} vs ${tcBook.toFixed(2)} s`);
  check('el hot spot vive en la zona GRUESA (x<20)', map.hot.xMm < 20, `x=${map.hot.xMm}`);

  // sondas INTERIORES (la malla de prueba solo tiene vértices en esquinas =
  // columnas de borde, que la erosión rellena con la mediana a propósito)
  const probe = { positions: new Float32Array([0, 0, 0, 10, 15, 12, 30, 15, 2]) };   // ancla en el origen de la pieza
  const colors = TC.paintTcColors(probe, map);
  check('pared GRUESA pintada ROJA (r>0.8)', colors[3] > 0.8, `r=${colors[3].toFixed(2)}`);
  check('pared DELGADA pintada AZUL (b>0.8)', colors[8] > 0.8, `b=${colors[8].toFixed(2)}`);

  // ── CONSEJO: tres casos contra el patrón real del bezel ──
  const cc = DS.coolingCircuit(bezel, DS.plateDepth(bezel));
  const ys = [...new Set(cc.segs.filter((g) => g.y0 === g.y1).map((g) => g.y0))].sort((a, b) => a - b);
  const zPart = 36 + 66 + 120 + 76;
  const cellY = DS.plateDepth(bezel) / 2, cellX = bezel.widthMm / 2;
  const fake = (hotX, hotY, zMid, th = 3) => ({
    ...map, pw: 240, ph: 160,
    hot: { xMm: hotX - (cellX - 120), yMm: hotY - (cellY - 80), thMm: th, tcS: 8, zMidMm: zMid },
  });
  // (a) EN una línea, superficial → cubierto
  const near = TC.waterAdvice(bezel, fake(cellX, ys[0], 2));
  console.log(`\ncerca: ${near.suggestion}`);
  check('hot spot EN el patrón → cubierto ✓', near.rows[1].ok === true && !near.marker, near.rows[1].valor);
  // (b) PROFUNDO → BAFFLE con marcador: pieza ALTA (60 mm) en placa A de 56 → NO
  // hay línea A posible (el propio circuito lo avisa) y la B queda a >Rcov en z
  const tallSpec = { ...bezel, cavity: { ...bezel.cavity, depthMm: 60 } };
  const ccT = DS.coolingCircuit(tallSpec, DS.plateDepth(tallSpec));
  console.log(`\npieza alta: línea A = ${ccT.zAboveMm ?? 'IMPOSIBLE (aviso del circuito)'}`);
  const deep = TC.waterAdvice(tallSpec, fake(cellX, ys[0], 40, 12));
  console.log(`profundo: ${deep.suggestion}`);
  check('núcleo PROFUNDO (sin línea A) → BAFFLE §9.3.5.2 + marcador 3D', /BAFFLE/.test(deep.suggestion) && !!deep.marker, deep.suggestion);
  // (c) DESALINEADO lateral (lejos en y, superficial) → MOVER línea
  const far = TC.waterAdvice(bezel, fake(cellX, ys[ys.length - 1] + 70, 2));
  console.log(`lateral: ${far.suggestion}`);
  check('desalineación LATERAL → MOVER/AGREGAR línea', /MOVER/.test(far.suggestion), far.suggestion);

  console.log(fails ? `\n❌ ${fails} checks fallaron` : '\n✓ t_c LOCAL + CONSEJO DE AGUA calzan con el libro (Eq 9.5 · Eq 9.22/9.24 · §9.3.5.2)');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', e); process.exit(1); });
