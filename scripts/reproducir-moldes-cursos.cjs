/**
 * REPRODUCIR LOS 3 MOLDES DE LOS CURSOS — como el libro, pero con los videos.
 * ============================================================================
 * "reproduce los 3 moldes" (user). Con el proceso destilado en
 * docs/forja-research/solidworks-mold-curso/, cada molde se reconstruye en
 * NUESTRO kernel con las cotas LITERALES del tutorial:
 *
 *  MOLDE 1 (percha, curso Alwis 2022): 2 cavidades — escala 1.015 (PP), copia
 *   rotada 180°, placas 350×630 alturas 145/90, guías ⌀35 (caja ⌀40×8) y
 *   bushings ⌀48 (caja ⌀54×10) en (±142, ±277).
 *  MOLDE 2 (clip+peine FAMILIA, curso Alwis 2023): escala 1.006 (ABS), bloque
 *   120×180 alturas 40/40, 4 interlocks de esquina 40×40 alto 10 con asiento
 *   −1 mm (Move Face) — los del tutorial, no el checkbox automático.
 *  MOLDE 3 (curso CIM 2018): NO modela molde — es el ESTUDIO Plastics sobre una
 *   carcasa. Se reproduce el estudio con nuestro motor: carcasa REAL (Hammond
 *   1591 base), colada con los DEFAULTS LITERALES del Channel Wizard (sprue
 *   SD 6.0 / runner RT 4.0 / gate GT 2.0), melt 260 °C / molde 60 °C, límite
 *   de máquina 100 MPa — su veredicto: 27.8 MPa (<66 %); el nuestro se mide.
 *
 * RECONSTRUCCIÓN DECLARADA: las SILUETAS de percha/clip/peine se modelan a
 * proporción del video (no hay planos de las piezas); side cores, drafts de
 * bolsillo y filetes de placa se OMITEN (los huecos #43: draft de modelado y
 * partición no plana). Las cotas del MOLDE sí son las del tutorial.
 *
 * ESTÉTICA: primera aplicación del modo ESTUDIO CLARO (mejoras 1-3 de
 * ESTETICA-SOLIDWORKS-NOTAS.md): fondo degradado claro, acero mate, paleta por
 * ROL (cavidad menta / núcleo salmón / pieza saturada), sombra de contacto.
 *
 * Salida: <out>/moldes-cursos.svg (1920×1080) + telemetría + VERIFY_RESULT.
 * Uso: node --import tsx scripts/reproducir-moldes-cursos.cjs <outdir>
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const distDir = path.join(ROOT, 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');

const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function pngRGB(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const chunk = (type, data) => {
    const t = Buffer.from(type), len = Buffer.alloc(4), crc = Buffer.alloc(4);
    len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// paleta por ROL (mold-palette embrión — ESTETICA-SOLIDWORKS-NOTAS.md §2.2)
const PAL = {
  fondoTop: [244, 246, 249], fondoBot: [201, 206, 214],
  acero: [168, 176, 192], cavidad: [154, 208, 178], nucleo: [232, 158, 152],
  piezaCoral: [235, 100, 80], piezaAmarilla: [240, 190, 40], piezaRoja: [210, 60, 50],
  colada: [235, 140, 50], sombra: [120, 126, 138],
};
const RAMP = [[255, 241, 200], [255, 176, 59], [219, 91, 46], [122, 30, 60], [56, 24, 84]];
const ramp = (u) => {
  const t = Math.max(0, Math.min(0.999, u)) * (RAMP.length - 1);
  const i = Math.floor(t), f = t - i, a = RAMP[i], b = RAMP[Math.min(RAMP.length - 1, i + 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
};

(async () => {
  const out = process.argv[2] || '/tmp/moldes-cursos';
  fs.mkdirSync(out, { recursive: true });
  const oc = await require(cjsGlue)({ wasmBinary: fs.readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const K = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const MD = await import(path.join(ROOT, 'src', 'forja', 'mold', 'mold.ts'));
  const FL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen.ts'));
  const FM = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen-mesh.ts'));
  const F = await import(path.join(ROOT, 'src', 'forja', 'mold', 'filling.ts'));
  const FD = await import(path.join(ROOT, 'src', 'forja', 'mold', 'feed.ts'));

  const cil = (r, h, o, dir = [0, 0, 1]) => K.makeCylinder(oc, r, h, { origin: o, dir });
  const caja = (w, d, h, at = [0, 0, 0]) => K.transformShape(oc, K.makeBox(oc, w, d, h), { translate: [at[0] - w / 2, at[1] - d / 2, at[2]] });
  const vol = (s) => K.volume(oc, s);
  const checks = {};

  // ══ MOLDE 1 — PERCHA, 2 CAVIDADES ══════════════════════════════════════
  // pieza (silueta DECLARADA a proporción): marco triangular 360×150 espesor
  // de banda 22, plano de espalda en z=0, grosor 10; gancho ⌀60 arriba
  // 300×110 (proporción DECLARADA achicada para que las 2 cavidades quepan en la
  // placa de 350 SIN encimarse — mi primer layout las cruzaba y la unión perdía 45 cc)
  const per = { W: 300, H: 110, band: 20, T: 10 };
  const outer = [
    { x: -per.W / 2, y: 0 }, { x: per.W / 2, y: 0 }, { x: 14, y: per.H }, { x: -14, y: per.H },
  ];
  const inner = [
    { x: -per.W / 2 + per.band * 2.4, y: per.band }, { x: per.W / 2 - per.band * 2.4, y: per.band },
    { x: 8, y: per.H - per.band * 1.4 }, { x: -8, y: per.H - per.band * 1.4 },
  ];
  let percha = K.extrudePolygonWithHoles(oc, outer, [inner], per.T);
  // gancho: aro ⌀60 banda 8 con abertura, arriba del marco
  const hookPts = [], hookIn = [];
  for (let a = -60; a <= 210; a += 15) {
    const r1 = 24, r2 = 17, cx = 0, cy = per.H + 19;
    hookPts.push({ x: cx + r1 * Math.cos((a * Math.PI) / 180), y: cy + r1 * Math.sin((a * Math.PI) / 180) });
    hookIn.unshift({ x: cx + r2 * Math.cos((a * Math.PI) / 180), y: cy + r2 * Math.sin((a * Math.PI) / 180) });
  }
  percha = K.fuse(oc, percha, K.extrudePolygon(oc, [...hookPts, ...hookIn], per.T));
  percha = K.fuse(oc, percha, caja(14, 26, per.T, [0, per.H + 2, 0]));  // cuello
  const vPercha = vol(percha);
  // escala 1.015 (PP — cota del curso) ANTES del layout (gotcha #2 del instructor)
  const perchaE = MD.scaleForShrinkage(oc, percha, 1.015);
  const vPerchaE = vol(perchaE);
  // layout 2 cavidades: copia ROTADA 180° (Move/Copy del curso), eje largo en Y
  // tras rotar ±90° la percha ocupa X∈[0, −(H+gancho)] — centros a ∓86 ⇒ las dos
  // bandas quedan en X∈[−167,−5] y [5,167]: SIN traslape (se verifica abajo)
  const cav1 = K.transformShape(oc, perchaE, { rotateAngle: Math.PI / 2, rotateAxis: { origin: [0, 0, 0], dir: [0, 0, 1] }, translate: [-5, 0, 0] });
  const cav2 = K.transformShape(oc, perchaE, { rotateAngle: -Math.PI / 2, rotateAxis: { origin: [0, 0, 0], dir: [0, 0, 1] }, translate: [5, 0, 0] });
  const vUnion = vol(K.fuse(oc, cav1, cav2));
  checks.m1_sin_traslape = Math.abs(vUnion - 2 * vol(cav1)) / (2 * vol(cav1)) < 0.005;
  // placas 350×630 (cotas del curso), alturas 145 (superior) / 90 (inferior)
  // pieza de espalda plana ⇒ impronta SOLO en la placa inferior (DECLARADO;
  // los side cores del curso se omiten)
  let placaInf1 = caja(350, 630, 90, [0, 0, -90]);
  const impronta = K.fuse(oc, K.transformShape(oc, cav1, { translate: [0, 0, -per.T * 1.015] }), K.transformShape(oc, cav2, { translate: [0, 0, -per.T * 1.015] }));
  placaInf1 = K.cut(oc, placaInf1, impronta);
  let placaSup1 = caja(350, 630, 145, [0, 0, 0]);
  // guías (cotas del curso): pines ⌀35 caja ⌀40×8 en inferior; bushings ⌀48 caja ⌀54×10 en superior; posiciones (±142, ±277)
  for (const sx of [1, -1]) for (const sy of [1, -1]) {
    const x = 142 * sx, y = 277 * sy;
    placaInf1 = K.cut(oc, placaInf1, K.fuse(oc, cil(17.5, 92, [x, y, -91]), cil(20, 8.2, [x, y, -90.1])));
    placaSup1 = K.cut(oc, placaSup1, K.fuse(oc, cil(24, 147, [x, y, -1]), cil(27, 10.2, [x, y, 134.9])));
  }
  const vImp = 350 * 630 * 90 - vol(placaInf1) - 4 * (Math.PI * 17.5 ** 2 * 90 + Math.PI * (20 ** 2 - 17.5 ** 2) * 8);
  checks.m1_impronta_conserva = Math.abs(vImp - 2 * vPerchaE) / (2 * vPerchaE) < 0.06;
  checks.m1_placas_separan = vol(placaInf1) > 0 && vol(placaSup1) > 0;
  console.log(`M1 percha: pieza ${(vPercha / 1000).toFixed(1)} cc → escalada ${(vPerchaE / 1000).toFixed(1)} cc · impronta ${(vImp / 1000).toFixed(1)} vs 2×pieza ${((2 * vPerchaE) / 1000).toFixed(1)} cc · placas ${(vol(placaSup1) / 1e6).toFixed(2)}/${(vol(placaInf1) / 1e6).toFixed(2)} L`);

  // ══ MOLDE 2 — CLIP + PEINE, FAMILIA ════════════════════════════════════
  const octo = (w, h, c) => [
    { x: -w / 2 + c, y: -h / 2 }, { x: w / 2 - c, y: -h / 2 }, { x: w / 2, y: -h / 2 + c }, { x: w / 2, y: h / 2 - c },
    { x: w / 2 - c, y: h / 2 }, { x: -w / 2 + c, y: h / 2 }, { x: -w / 2, y: h / 2 - c }, { x: -w / 2, y: -h / 2 + c },
  ];
  const clip = K.extrudePolygonWithHoles(oc, octo(62, 40, 10), [octo(44, 24, 7)], 4);   // marco del claw (proporción)
  // contorno CONTINUO (mi primera versión hacía reverse() de los dientes y el
  // polígono quedaba auto-intersecado: vol "3.67" pero el cut daba 0.0 — veneno)
  const NT = 9, TW2 = 78, spine = 8;
  const peineOut = [{ x: -TW2 / 2, y: spine }, { x: TW2 / 2, y: spine }, { x: TW2 / 2, y: 0 }];
  for (let i = NT; i >= 0; i--) {
    const x0 = -TW2 / 2 + (i * TW2) / NT;
    peineOut.push({ x: x0 + 2.6, y: 0 }, { x: x0 + 2.6, y: -22 }, { x: x0 + 1.3, y: -24 }, { x: x0, y: -22 }, { x: x0, y: 0 });
  }
  const peine = K.extrudePolygon(oc, peineOut, 3);
  const vClip = vol(clip), vPeine = vol(peine);
  const clipE = MD.scaleForShrinkage(oc, clip, 1.006), peineE = MD.scaleForShrinkage(oc, peine, 1.006);
  // layout familia dentro del bloque 120×180 (cotas del curso)
  const pClip = K.transformShape(oc, clipE, { translate: [0, 48, -4] });
  const pPeine = K.transformShape(oc, peineE, { rotateAngle: 0, translate: [0, -28, -3] });
  let nucleo = caja(120, 180, 40, [0, 0, -40]);
  nucleo = K.cut(oc, K.cut(oc, nucleo, pClip), pPeine);
  let cavidad = caja(120, 180, 40, [0, 0, 0]);
  // 4 interlocks de esquina del CURSO: croquis 40×40, alto 10, asiento −1 mm,
  // (draft 10° del curso OMITIDO — hueco #43: BRepOffsetAPI_DraftAngle sin envolver)
  for (const sx of [1, -1]) for (const sy of [1, -1]) {
    const cx = sx * (60 - 20), cy = sy * (90 - 20);
    // poste hundido 1 mm EN la placa: el fuse cara-a-cara perdía la placa
    // (quedaban 57.6 cc = SOLO postes); con mordida de volumen el booleano agarra
    nucleo = K.fuse(oc, nucleo, caja(40, 40, 10, [cx, cy, -1]));         // 9 efectivos sobre cara (asiento −1)
    cavidad = K.cut(oc, cavidad, caja(41, 41, 10.2, [cx, cy, -0.1]));    // caja con holgura
  }
  checks.m2_familia_impronta = (() => {
    const vN = 120 * 180 * 40 + 4 * 40 * 40 * 9 - (vol(pClip) + vol(pPeine));
    return Math.abs(vol(nucleo) - vN) / vN < 0.03;
  })();
  checks.m2_interlocks = vol(cavidad) < 120 * 180 * 40 - 4 * 40 * 40 * 9;
  console.log(`M2 familia: clip ${(vClip / 1000).toFixed(1)} cc + peine ${(vPeine / 1000).toFixed(1)} cc · núcleo ${(vol(nucleo) / 1000).toFixed(1)} cc (4 postes 40×40×9) · cavidad ${(vol(cavidad) / 1000).toFixed(1)} cc`);

  // ══ MOLDE 3 — ESTUDIO PLASTICS (carcasa Hammond + colada del wizard) ════
  const shape3 = K.importSTEP(oc, fs.readFileSync(path.join(ROOT, 'test-parts', 'inyeccion-reales', '1591BSBK.stp')));
  const solids3 = K.uniqueSubShapes(oc, shape3, oc.TopAbs_ShapeEnum.TopAbs_SOLID);
  let housing = null, best = 0;
  for (const s of solids3) { const v = vol(s); if (v > best) { best = v; housing = s; } }
  const qH = FM.solidFromMesh(K.tessellate(oc, housing, 0.3, 0.3));
  const hc = { x: (qH.bbox.x0 + qH.bbox.x1) / 2, y: (qH.bbox.y0 + qH.bbox.y1) / 2 };
  // colada con los DEFAULTS LITERALES del Channel Wizard: sprue SD 6.0 (largo 30,
  // comprimido del SL 50 — declarado) → runner RT 4.0 L 10 → gate GT 2.0 L 10
  const gate3 = { x: qH.bbox.x0 + 6, y: hc.y };
  const inFeed3 = (x, y, z) => {
    if (z >= qH.bbox.z0) return false;
    const zs = qH.bbox.z0;
    if (z > zs - 30 && z <= zs - 8 && (x - (gate3.x - 20)) ** 2 + (y - gate3.y) ** 2 <= 9) return true;   // sprue ⌀6
    if (z > zs - 8 && z <= zs - 4 && x >= gate3.x - 20 && x <= gate3.x && Math.abs(y - gate3.y) <= 2) return true; // runner RT4
    if (z > zs - 4 && z < zs && (x - gate3.x) ** 2 + (y - gate3.y) ** 2 <= 1) return true;               // gate GT2
    return false;
  };
  const wall3 = 2.09;
  const field3 = FL.measureFlowLength({
    x0: qH.bbox.x0 - 24, y0: qH.bbox.y0 - 2, z0: qH.bbox.z0 - 31, x1: qH.bbox.x1 + 2, y1: qH.bbox.y1 + 2, z1: qH.bbox.z1 + 1,
    cellMm: 0.9, gateMm: { x: gate3.x - 20, y: gate3.y, z: qH.bbox.z0 - 29 },
    inCavity: (x, y, z) => inFeed3(x, y, z) || qH.inside(x, y, z),
    wallMm: wall3, meltN: 0.348,
  });
  const front3 = FL.createFlowFront(field3);
  const vM3 = F.convergeVelocity(F.ABS_MG47, wall3 / 1000);
  const PC3 = (2 * F.ABS_MG47.k * Math.pow(2 * (1 + 1 / F.ABS_MG47.n) * vM3, F.ABS_MG47.n) * Math.pow(1e-3, -F.ABS_MG47.n)) / 1e6;
  const tF3 = field3.maxFlowLenMm / 1000 / vM3;
  const Q3 = field3.volumeMm3 / 1e9 / tF3;
  const dpFeed3 = FD.feedPressureDrop(F.ABS_MG47, [
    { name: 'sprue', L: 0.022, R: 0.003, Vdot: Q3 },
    { name: 'runner', L: 0.02, R: 0.002, Vdot: Q3 },
    { name: 'gate', L: 0.004, R: 0.001, Vdot: Q3 },
  ]) / 1e6;
  const dP3 = dpFeed3 + PC3 * field3.maxResistance;
  checks.m3_llena = field3.unreachable === 0;
  checks.m3_bajo_limite = dP3 < 100;
  console.log(`M3 estudio: carcasa ${(best / 1000).toFixed(1)} cc · L máx ${field3.maxFlowLenMm} mm · ΔP ${dP3.toFixed(1)} MPa (colada ${dpFeed3.toFixed(1)}) vs límite 100 — curso: 27.8 MPa`);

  // ══ RENDER — modo ESTUDIO CLARO (debut mejoras 1-3) ═════════════════════
  const VW = 296, VH = 236;
  const voxSurf = (q, SC) => {
    const pts = [];
    const nx = Math.ceil((q.bbox.x1 - q.bbox.x0) / SC), ny = Math.ceil((q.bbox.y1 - q.bbox.y0) / SC), nz = Math.ceil((q.bbox.z1 - q.bbox.z0) / SC);
    const inQ = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz &&
      q.inside(q.bbox.x0 + (i + .5) * SC, q.bbox.y0 + (j + .5) * SC, q.bbox.z0 + (k + .5) * SC);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (!inQ(i, j, k)) continue;
      if (inQ(i + 1, j, k) && inQ(i - 1, j, k) && inQ(i, j + 1, k) && inQ(i, j - 1, k) && inQ(i, j, k + 1) && inQ(i, j, k - 1)) continue;
      // normal cruda para el sombreado mate 3-tonos
      let lum = 0.86;
      if (!inQ(i, j, k + 1)) lum = 1.0; else if (!inQ(i + 1, j, k) || !inQ(i, j - 1, k)) lum = 0.92; else lum = 0.78;
      pts.push([q.bbox.x0 + (i + .5) * SC, q.bbox.y0 + (j + .5) * SC, q.bbox.z0 + (k + .5) * SC, lum]);
    }
    return pts;
  };
  const renderTile = (grupos, opts = {}) => {
    // grupos: [{shape|mesh:q, color, SC}] — modo estudio claro: fondo degradado,
    // sombreado mate 3 tonos, sombra de contacto
    const fb = new Float32Array(VW * VH * 3);
    for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) {
      const t = y / VH, o = (y * VW + x) * 3;
      for (let c = 0; c < 3; c++) fb[o + c] = PAL.fondoTop[c] + (PAL.fondoBot[c] - PAL.fondoTop[c]) * t;
    }
    let bb = { x0: 1e18, y0: 1e18, z0: 1e18, x1: -1e18, y1: -1e18, z1: -1e18 };
    const all = [];
    for (const g of grupos) {
      const q = g.q;
      bb = { x0: Math.min(bb.x0, q.bbox.x0), y0: Math.min(bb.y0, q.bbox.y0), z0: Math.min(bb.z0, q.bbox.z0), x1: Math.max(bb.x1, q.bbox.x1), y1: Math.max(bb.y1, q.bbox.y1), z1: Math.max(bb.z1, q.bbox.z1) };
      all.push({ pts: voxSurf(q, g.SC), color: g.color });
    }
    const th = (30 * Math.PI) / 180, cosT = Math.cos(th), sinT = Math.sin(th);
    const c0 = [(bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2, (bb.z0 + bb.z1) / 2];
    const pr = (x, y, z) => {
      const xr = (x - c0[0]) * cosT - (y - c0[1]) * sinT, yr = (x - c0[0]) * sinT + (y - c0[1]) * cosT;
      return { u: xr - yr, v: (xr + yr) * 0.5 - (z - c0[2]), d: xr + yr + (z - c0[2]) * 0.35 };
    };
    let uMin = 1e18, uMax = -1e18, vMin = 1e18, vMax = -1e18;
    for (const X of [bb.x0, bb.x1]) for (const Y of [bb.y0, bb.y1]) for (const Z of [bb.z0, bb.z1]) {
      const p = pr(X, Y, Z); uMin = Math.min(uMin, p.u); uMax = Math.max(uMax, p.u); vMin = Math.min(vMin, p.v); vMax = Math.max(vMax, p.v);
    }
    const S = Math.min((VW - 30) / (uMax - uMin), (VH - 44) / (vMax - vMin));
    const proj = (x, y, z) => {
      const p = pr(x, y, z);
      return { u: VW / 2 + (p.u - (uMax + uMin) / 2) * S, v: VH / 2 - 8 + (p.v - (vMax + vMin) / 2) * S, d: p.d };
    };
    // sombra de contacto (mejora 3): elipse difusa bajo el conjunto
    const g0 = proj(c0[0], c0[1], bb.z0);
    const rx = ((uMax - uMin) * S) / 2 * 0.85, ry = rx * 0.22, gy = g0.v + ((bb.z1 - bb.z0) * S) / 2 * 0.52 + 8;
    for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) {
      const dx = (x - VW / 2) / rx, dy = (y - gy) / ry;
      const e = dx * dx + dy * dy;
      if (e < 1.6) {
        const a = 0.22 * Math.max(0, 1 - e / 1.6);
        const o = (y * VW + x) * 3;
        for (let c = 0; c < 3; c++) fb[o + c] = fb[o + c] * (1 - a) + PAL.sombra[c] * a;
      }
    }
    const splats = [];
    for (const g of all) for (const [x, y, z, lum] of g.pts) {
      const p = proj(x, y, z);
      splats.push([p.d, p.u, p.v, g.color[0] * lum, g.color[1] * lum, g.color[2] * lum]);
    }
    splats.sort((a, b) => a[0] - b[0]);
    for (const [, u, v, r, g2, b2] of splats) {
      const ui = u | 0, vi = v | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const px = ui + dx, py = vi + dy;
        if (px < 0 || py < 0 || px >= VW || py >= VH) continue;
        const w = (dx === 0 && dy === 0) ? 0.95 : 0.45;
        const o = (py * VW + px) * 3;
        fb[o] = fb[o] * (1 - w) + r * w; fb[o + 1] = fb[o + 1] * (1 - w) + g2 * w; fb[o + 2] = fb[o + 2] * (1 - w) + b2 * w;
      }
    }
    const rgb = Buffer.alloc(VW * VH * 3);
    for (let t = 0; t < fb.length; t++) rgb[t] = Math.max(0, Math.min(255, fb[t]));
    return pngRGB(VW, VH, rgb).toString('base64');
  };
  const Q = (s) => FM.solidFromMesh(K.tessellate(oc, s, 0.5, 0.5));

  console.log('render M1…');
  const t11 = renderTile([{ q: Q(K.fuse(oc, cav1, cav2)), color: PAL.piezaCoral, SC: 2.2 }]);
  const t12 = renderTile([{ q: Q(placaInf1), color: PAL.nucleo, SC: 3.2 }]);
  const t13 = renderTile([{ q: Q(placaSup1), color: PAL.cavidad, SC: 3.2 }]);
  console.log('render M2…');
  const t21 = renderTile([{ q: Q(pClip), color: PAL.piezaAmarilla, SC: 0.9 }, { q: Q(pPeine), color: PAL.piezaRoja, SC: 0.9 }]);
  const t22 = renderTile([{ q: Q(nucleo), color: PAL.nucleo, SC: 1.4 }]);
  const t23 = renderTile([{ q: Q(cavidad), color: PAL.cavidad, SC: 1.4 }]);
  console.log('render M3…');
  // M3: tres etapas de llenado sobre lienzo claro (estilo Fill Time del curso)
  const tileFill = (frac) => {
    const st = front3.frontAt(frac);
    const pts = [];
    for (let k = 0; k < field3.nz; k++) for (let j = 0; j < field3.ny; j++) for (let i = 0; i < field3.nx; i++) {
      const t = (k * field3.ny + j) * field3.nx + i;
      if (!field3.cavity[t]) continue;
      const R = field3.resistance[t];
      pts.push([field3.x0 + (i + .5) * 0.9, field3.y0 + (j + .5) * 0.9, field3.z0 + (k + .5) * 0.9,
        Number.isFinite(R) && R <= st.resistance ? R / field3.maxResistance : -1]);
    }
    const fb = new Float32Array(VW * VH * 3);
    for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) {
      const t = y / VH, o = (y * VW + x) * 3;
      for (let c = 0; c < 3; c++) fb[o + c] = PAL.fondoTop[c] + (PAL.fondoBot[c] - PAL.fondoTop[c]) * t;
    }
    const th = (30 * Math.PI) / 180, cosT = Math.cos(th), sinT = Math.sin(th);
    const c0 = [(field3.x0 + field3.x0 + field3.nx * 0.9) / 2, (field3.y0 + field3.y0 + field3.ny * 0.9) / 2, (field3.z0 + field3.z0 + field3.nz * 0.9) / 2];
    const pr = (x, y, z) => {
      const xr = (x - c0[0]) * cosT - (y - c0[1]) * sinT, yr = (x - c0[0]) * sinT + (y - c0[1]) * cosT;
      return { u: xr - yr, v: (xr + yr) * 0.5 - (z - c0[2]), d: xr + yr + (z - c0[2]) * 0.35 };
    };
    let uMin = 1e18, uMax = -1e18, vMin = 1e18, vMax = -1e18;
    for (const [x, y, z] of [[field3.x0, field3.y0, field3.z0], [field3.x0 + field3.nx * 0.9, field3.y0 + field3.ny * 0.9, field3.z0 + field3.nz * 0.9]]) {
      for (const X of [field3.x0, field3.x0 + field3.nx * 0.9]) for (const Y of [field3.y0, field3.y0 + field3.ny * 0.9]) for (const Z of [field3.z0, field3.z0 + field3.nz * 0.9]) {
        const p = pr(X, Y, Z); uMin = Math.min(uMin, p.u); uMax = Math.max(uMax, p.u); vMin = Math.min(vMin, p.v); vMax = Math.max(vMax, p.v);
      }
    }
    const S = Math.min((VW - 24) / (uMax - uMin), (VH - 30) / (vMax - vMin));
    const proj = (x, y, z) => {
      const p = pr(x, y, z);
      return { u: VW / 2 + (p.u - (uMax + uMin) / 2) * S, v: VH / 2 + (p.v - (vMax + vMin) / 2) * S, d: p.d };
    };
    const splats = [];
    for (const [x, y, z, u] of pts) {
      const p = proj(x, y, z);
      // CAE sobre lienzo neutro (mejora 9): lo no llenado CAQUI mate, no invisible
      const col = u < 0 ? [190, 188, 172] : ramp(0.15 + 0.85 * u);
      splats.push([p.d, p.u, p.v, col[0], col[1], col[2], u < 0 ? 0.35 : 0.85]);
    }
    splats.sort((a, b) => a[0] - b[0]);
    for (const [, u2, v2, r, g2, b2, aA] of splats) {
      const ui = u2 | 0, vi = v2 | 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const px = ui + dx, py = vi + dy;
        if (px < 0 || py < 0 || px >= VW || py >= VH) continue;
        const o = (py * VW + px) * 3;
        fb[o] = fb[o] * (1 - aA) + r * aA; fb[o + 1] = fb[o + 1] * (1 - aA) + g2 * aA; fb[o + 2] = fb[o + 2] * (1 - aA) + b2 * aA;
      }
    }
    const rgb = Buffer.alloc(VW * VH * 3);
    for (let t = 0; t < fb.length; t++) rgb[t] = Math.max(0, Math.min(255, fb[t]));
    return pngRGB(VW, VH, rgb).toString('base64');
  };
  const t31 = tileFill(0.15), t32 = tileFill(0.55), t33 = tileFill(0.95);

  // ══ LA LÁMINA ═══════════════════════════════════════════════════════════
  const fila = (Y, titulo, sub, tiles, labels, stats) => {
    let s = `<text x="24" y="${Y}" font-size="19" fill="#1c2430" font-weight="bold">${titulo}</text>`;
    s += `<text x="24" y="${Y + 20}" font-size="12.5" fill="#5a6577">${sub}</text>`;
    tiles.forEach((t, i) => {
      const x = 24 + i * (VW + 14);
      s += `<image x="${x}" y="${Y + 30}" width="${VW}" height="${VH}" href="data:image/png;base64,${t}"/>`;
      s += `<rect x="${x}" y="${Y + 30}" width="${VW}" height="${VH}" fill="none" stroke="#b9c0cc" stroke-width="1"/>`;
      s += `<text x="${x + 6}" y="${Y + 44}" font-size="11.5" fill="#3c4656">${labels[i]}</text>`;
    });
    s += `<text x="${24 + 3 * (VW + 14) + 6}" y="${Y + 46}" font-size="12.5" fill="#1c2430" font-weight="bold">cotas del curso:</text>`;
    stats.forEach((ln, i) => { s += `<text x="${24 + 3 * (VW + 14) + 6}" y="${Y + 66 + i * 19}" font-size="12" fill="#44506a">${ln}</text>`; });
    return s;
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="ui-monospace,Menlo,monospace">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f9"/><stop offset="1" stop-color="#c9ced6"/></linearGradient></defs>
<rect width="1920" height="1080" fill="url(#bg)"/>
<text x="24" y="40" font-size="26" fill="#1c2430" font-weight="bold">LOS 3 MOLDES DE LOS CURSOS — reproducidos en La Forja (modo estudio claro, estreno)</text>
<text x="24" y="62" font-size="13" fill="#5a6577">proceso destilado de los videos (docs/forja-research/solidworks-mold-curso) → cotas LITERALES al kernel · siluetas de pieza a proporción DECLARADA · paleta por ROL: cavidad menta · núcleo salmón · pieza saturada</text>
${fila(92, 'MOLDE 1 · PERCHA — 2 cavidades (curso Alwis 2022)', 'escala 1.015 (PP) · copia rotada 180° · placas 350×630, alturas 145/90 · guías ⌀35 (caja ⌀40×8) + bushings ⌀48 (caja ⌀54×10) en (±142, ±277)',
    [t11, t12, t13], ['piezas escaladas (layout 2 cav)', 'placa NÚCLEO 90 mm (improntas + pines)', 'placa CAVIDAD 145 mm (bushings)'],
    ['escala 1.015 · placas 350×630', 'alturas 145 / 90 mm', 'guías (±142, ±277)', `impronta ${(vImp / 1000).toFixed(1)} cc ≈ 2×pieza ${((2 * vPerchaE) / 1000).toFixed(1)} cc ${checks.m1_impronta_conserva ? '✓' : '✗'}`, 'omitido (declarado): side cores,', 'drafts/filetes de bolsillo'])}
${fila(424, 'MOLDE 2 · CLIP + PEINE — familia (curso Alwis 2023)', 'escala 1.006 (ABS 0.6 %) · bloque 120×180, alturas 40/40 · 4 interlocks de ESQUINA 40×40 alto 10, asiento −1 mm (los del curso, no el checkbox)',
    [t21, t22, t23], ['piezas familia (clip + peine)', 'NÚCLEO 40 mm + 4 postes 40×40×9', 'CAVIDAD 40 mm + cajas (holgura)'],
    ['escala 1.006 · bloque 120×180', 'alturas 40 / 40 mm', 'interlocks 40×40 · asiento −1 mm', `conservación núcleo ${checks.m2_familia_impronta ? '✓' : '✗'} · postes ${checks.m2_interlocks ? '✓' : '✗'}`, 'omitido (declarado): draft 10°', 'de postes, partición ondulada (#43)'])}
${fila(756, 'MOLDE 3 · ESTUDIO DE LLENADO — carcasa (curso CIM 2018)', 'el curso NO modela molde: corre Plastics · aquí: carcasa REAL (Hammond 1591) + colada del wizard (sprue ⌀6 · runner RT4 · gate GT2) · nuestro motor flowlen',
    [t31, t32, t33], ['llenado 15 %', 'llenado 55 %', 'llenado 95 % (caqui = falta)'],
    ['colada: SD 6.0 / RT 4.0 / GT 2.0', 'melt 260 °C · molde 60 °C (curso)', `ΔP nuestro: ${dP3.toFixed(1)} MPa (colada ${dpFeed3.toFixed(1)})`, `límite máquina 100 MPa ${checks.m3_bajo_limite ? '✓ VIABLE' : '✗'}`, 'veredicto del curso: 27.8 MPa', `L máx ${field3.maxFlowLenMm} mm · muertos ${field3.unreachable}`])}
<text x="24" y="1066" font-size="12" fill="#5a6577">honesto: siluetas a proporción del video (sin planos de pieza) · cotas del MOLDE literales · huecos #43 declarados · kernel OCCT propio + flowlen Eq 5.22 · estética = mejoras 1-3 del análisis</text>
</svg>`;
  fs.writeFileSync(path.join(out, 'moldes-cursos.svg'), svg);
  const pass = Object.values(checks).every(Boolean);
  fs.writeFileSync(path.join(out, 'telemetria-moldes-cursos.json'), JSON.stringify({ fecha: '2026-07-18', checks, m1: { vPerchaE, vImp }, m2: { vClip, vPeine, nucleo: vol(nucleo), cavidad: vol(cavidad) }, m3: { dP3: +dP3.toFixed(1), dpFeed3: +dpFeed3.toFixed(1), Lmax: field3.maxFlowLenMm } }, null, 1));
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  if (!pass) process.exit(2);
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 600)); process.exit(1); });
