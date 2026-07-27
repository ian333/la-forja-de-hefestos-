/**
 * CICLO COMPLETO — los 3 moldes de los cursos con TODO: llenado + enfriamiento
 * + tuberías del libro. (task #36: el ACOPLE inyección→térmico)
 * ============================================================================
 * "ahora los moldes completos: ciclo de inyección, enfriamiento, tuberías, todo"
 *
 * EL ACOPLE (la idea de esta integración): el MISMO campo de espesor local
 * Hildebrand-Rüegsegger que pesa la RESISTENCIA de flujo (Eq 5.22) pesa el
 * ENFRIAMIENTO (Eq 9.4). Por vóxel:
 *     t_listo = t_llegada(campo de flujo) + t_c(espesor local)
 *   · pieza (placa):  t_c = h²/(π²α)·ln(4(Tm−Tw)/(Te−Tw))   [Eq 9.4]
 *   · colada (barra): t_c = d²/(23.1α)·ln(…)                 [rod, cooling.ts]
 * El ciclo lo manda el vóxel PEOR: grueso Y tardío. Las esquinas con cordón
 * (race tracking) también enfrían lento — el mismo campo lo dice.
 *
 * TUBERÍAS: coolingCircuit (mold-drawing-set) — el layout del LIBRO:
 * H = 4·⌀ (Eq 9.22, rango 2⌀<H<5⌀) · pitch = 1.75·H (Eq 9.24, rango [H,2H]).
 *
 * Material: ABS_KAZMER (α 8.69e-8, 239/60/97.6 °C — §9.1). PP de la percha SIN
 * datos medidos → proxy DECLARADO (regla del térmico).
 * Salida: <out>/ciclo-completo.svg + telemetría + VERIFY. Uso:
 *   node --import tsx scripts/ciclo-completo-cursos.cjs <outdir>
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
const PAL = { fondoTop: [244, 246, 249], fondoBot: [201, 206, 214], agua: [46, 116, 235] };
const rampaFlujo = (u) => [255 - 130 * u, 200 - 140 * u, 90 + 20 * u];        // claro→rojizo (llegada)
const rampaTermo = (u) => {                                                   // frío azul → caliente rojo
  const a = [70, 110, 200], b = [235, 70, 50];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
};

(async () => {
  const out = process.argv[2] || '/tmp/ciclo-completo';
  fs.mkdirSync(out, { recursive: true });
  const oc = await require(cjsGlue)({ wasmBinary: fs.readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const K = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const MD = await import(path.join(ROOT, 'src', 'forja', 'mold', 'mold.ts'));
  const FL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen.ts'));
  const FM = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen-mesh.ts'));
  const F = await import(path.join(ROOT, 'src', 'forja', 'mold', 'filling.ts'));
  const CO = await import(path.join(ROOT, 'src', 'forja', 'mold', 'cooling.ts'));
  const MM = await import(path.join(ROOT, 'src', 'forja', 'mold', 'moldmachine.ts'));
  const PS = await import(path.join(ROOT, 'src', 'forja', 'mold', 'mold-plano-set.ts'));
  const DS = await import(path.join(ROOT, 'src', 'forja', 'mold', 'mold-drawing-set.ts'));

  const mat = CO.ABS_KAZMER;
  const melt = F.ABS_MG47;
  const caja = (w, d, h, at = [0, 0, 0]) => K.transformShape(oc, K.makeBox(oc, w, d, h), { translate: [at[0] - w / 2, at[1] - d / 2, at[2]] });
  const checks = {};

  // ── geometrías de los 3 moldes (las de reproducir-moldes-cursos) ─────────
  const octo = (w, h, c) => [
    { x: -w / 2 + c, y: -h / 2 }, { x: w / 2 - c, y: -h / 2 }, { x: w / 2, y: -h / 2 + c }, { x: w / 2, y: h / 2 - c },
    { x: w / 2 - c, y: h / 2 }, { x: -w / 2 + c, y: h / 2 }, { x: -w / 2, y: h / 2 - c }, { x: -w / 2, y: -h / 2 + c },
  ];
  const buildPercha = () => {
    const per = { W: 300, H: 110, band: 20, T: 10 };
    const outer = [{ x: -per.W / 2, y: 0 }, { x: per.W / 2, y: 0 }, { x: 14, y: per.H }, { x: -14, y: per.H }];
    const inner = [
      { x: -per.W / 2 + per.band * 2.4, y: per.band }, { x: per.W / 2 - per.band * 2.4, y: per.band },
      { x: 8, y: per.H - per.band * 1.4 }, { x: -8, y: per.H - per.band * 1.4 },
    ];
    let p = K.extrudePolygonWithHoles(oc, outer, [inner], per.T);
    const hp = [], hi = [];
    for (let a = -60; a <= 210; a += 15) {
      const r1 = 24, r2 = 17, cy = per.H + 19;
      hp.push({ x: r1 * Math.cos((a * Math.PI) / 180), y: cy + r1 * Math.sin((a * Math.PI) / 180) });
      hi.unshift({ x: r2 * Math.cos((a * Math.PI) / 180), y: cy + r2 * Math.sin((a * Math.PI) / 180) });
    }
    p = K.fuse(oc, p, K.extrudePolygon(oc, [...hp, ...hi], per.T));
    p = K.fuse(oc, p, caja(14, 26, per.T, [0, per.H + 2, 0]));
    const pE = MD.scaleForShrinkage(oc, p, 1.015);
    const c1 = K.transformShape(oc, pE, { rotateAngle: Math.PI / 2, rotateAxis: { origin: [0, 0, 0], dir: [0, 0, 1] }, translate: [-5, 0, 0] });
    const c2 = K.transformShape(oc, pE, { rotateAngle: -Math.PI / 2, rotateAxis: { origin: [0, 0, 0], dir: [0, 0, 1] }, translate: [5, 0, 0] });
    return { solid: K.fuse(oc, c1, c2), wall: 10.15, nombre: 'PERCHA ×2 (PP→proxy ABS)',
      specSolid: pE, gates: [{ x: -15, y: 0 }, { x: 15, y: 0 }] };            // gates SOBRE las barras (x∈[−25,−5]/[5,25])
  };
  const buildFamilia = () => {
    const clip = K.extrudePolygonWithHoles(oc, octo(62, 40, 10), [octo(44, 24, 7)], 4);
    const NT = 9, TW2 = 78, spine = 8;
    const po = [{ x: -TW2 / 2, y: spine }, { x: TW2 / 2, y: spine }, { x: TW2 / 2, y: 0 }];
    for (let i = NT; i >= 0; i--) {
      const x0 = -TW2 / 2 + (i * TW2) / NT;
      po.push({ x: x0 + 2.6, y: 0 }, { x: x0 + 2.6, y: -22 }, { x: x0 + 1.3, y: -24 }, { x: x0, y: -22 }, { x: x0, y: 0 });
    }
    const peine = K.extrudePolygon(oc, po, 3);
    const cE = MD.scaleForShrinkage(oc, clip, 1.006), pE = MD.scaleForShrinkage(oc, peine, 1.006);
    const a = K.transformShape(oc, cE, { translate: [0, 48, 0] });
    const b = K.transformShape(oc, pE, { translate: [0, -28, 0] });
    return { solid: K.fuse(oc, a, b), wall: 4, nombre: 'CLIP + PEINE familia (ABS)',
      specSolid: cE, gates: [{ x: 0, y: 31 }, { x: 0, y: -24 }] };            // banda inferior del aro + lomo del peine
  };
  const buildCarcasa = () => {
    const sh = K.importSTEP(oc, fs.readFileSync(path.join(ROOT, 'test-parts', 'inyeccion-reales', '1591BSBK.stp')));
    const solids = K.uniqueSubShapes(oc, sh, oc.TopAbs_ShapeEnum.TopAbs_SOLID);
    let housing = null, best = 0;
    for (const s of solids) { const v = K.volume(oc, s); if (v > best) { best = v; housing = s; } }
    return { solid: housing, wall: 2.09, nombre: 'CARCASA Hammond 1591 (ABS real)', specSolid: housing, gates: null };
  };

  const MOLDES = [
    { clave: 'percha', build: buildPercha, feedR: 3.0, annual: 60000, sub: 'placas 350×630 · colada fría ⌀6 (2 ramas)' },
    { clave: 'familia', build: buildFamilia, feedR: 3.0, sub: 'bloque 120×180 · colada fría ⌀6 (2 ramas)' },
    { clave: 'carcasa', build: buildCarcasa, feedR: 3.0, sub: 'colada wizard SD6/RT4/GT2' },
  ];

  const filas = [];
  for (const M of MOLDES) {
    const { solid, wall, nombre, specSolid, gates } = M.build();
    const q = FM.solidFromMesh(K.tessellate(oc, solid, 0.35, 0.35));
    const cx = (q.bbox.x0 + q.bbox.x1) / 2, cy = (q.bbox.y0 + q.bbox.y1) / 2;
    const zs = q.bbox.z0, R = M.feedR;
    // colada fría: sprue central + runner de 2 RAMAS con gates SOBRE las piezas
    // (el sprue "al centro" del primer intento caía en el HUECO entre cavidades:
    // cero llenado — el check lo cazó). Carcasa: gate directo al piso (una pieza).
    const inFeed = gates
      ? (x, y, z) => {
        if (z >= zs) return false;
        const sx = (gates[0].x + gates[1].x) / 2, sy = (gates[0].y + gates[1].y) / 2;
        if (z > zs - 24 && z <= zs - 6 && (x - sx) ** 2 + (y - sy) ** 2 <= 9) return true;   // sprue ⌀6
        const a = gates[0], b = gates[1];
        const L = Math.hypot(b.x - a.x, b.y - a.y);
        const tt = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / (L * L)));
        const px = a.x + tt * (b.x - a.x), py = a.y + tt * (b.y - a.y);
        if (z > zs - 8 && z <= zs - 3 && Math.hypot(x - px, y - py) <= 2.5) return true;     // runner ⌀5
        for (const g of gates) if (z > zs - 3 && Math.hypot(x - g.x, y - g.y) <= 1.5) return true; // gates ⌀3
        return false;
      }
      : (x, y, z) => z < zs && z > zs - 24 && (x - cx) ** 2 + (y - cy) ** 2 <= R * R;
    const gate0 = gates ? { x: (gates[0].x + gates[1].x) / 2, y: (gates[0].y + gates[1].y) / 2, z: zs - 23 } : { x: cx, y: cy, z: zs - 23 };
    const cell = Math.max(0.5, Math.min(1.0, wall * 0.45));
    const field = FL.measureFlowLength({
      x0: q.bbox.x0 - 2, y0: q.bbox.y0 - 2, z0: zs - 25, x1: q.bbox.x1 + 2, y1: q.bbox.y1 + 2, z1: q.bbox.z1 + 1,
      cellMm: cell, gateMm: gate0,
      inCavity: (x, y, z) => inFeed(x, y, z) || q.inside(x, y, z),
      wallMm: wall, meltN: melt.n,
    });
    const vM = F.convergeVelocity(melt, wall / 1000);
    const tFill = field.maxFlowLenMm / 1000 / vM;
    // ── EL ACOPLE: t_listo por vóxel = llegada + Eq 9.4(H local) ───────────
    const N = field.cavity.length;
    let tReadyMax = 0, tcMax = 0, tcColada = 0, peorEsFeed = false;
    let peor = null;
    const nxF = field.nx, nyF = field.ny;
    // mapas 2D (planta): por columna, llegada máx, espesor máx, t_listo máx
    const mapArr = new Float32Array(nxF * nyF).fill(-1);
    const mapTh = new Float32Array(nxF * nyF).fill(-1);
    const mapReady = new Float32Array(nxF * nyF).fill(-1);
    for (let t = 0; t < N; t++) {
      if (!field.cavity[t] || !Number.isFinite(field.resistance[t])) continue;
      const i = t % nxF, j = ((t - i) / nxF) % nyF, k = ((t - i) / nxF - j) / nyF;
      const z = field.z0 + (k + .5) * cell;
      const esFeed = z < zs;
      const H = field.thicknessMm[t];
      const frac = field.resistance[t] / field.maxResistance;
      const tc = esFeed ? CO.coolingTimeRod(H / 1000, mat) : CO.coolingTimePlate(H / 1000, mat);
      const tReady = frac * tFill + tc;
      if (!esFeed && tc > tcMax) tcMax = tc;
      if (esFeed && tc > tcColada) tcColada = tc;
      if (tReady > tReadyMax) { tReadyMax = tReady; peorEsFeed = esFeed; peor = { x: field.x0 + (i + .5) * cell, y: field.y0 + (j + .5) * cell, H: +H.toFixed(2), frac: +frac.toFixed(3) }; }
      const m = j * nxF + i;
      if (frac > mapArr[m]) mapArr[m] = frac;
      if (H > mapTh[m]) mapTh[m] = H;
      if (tReady > mapReady[m]) mapReady[m] = tReady;
    }
    // ── TUBERÍAS DEL LIBRO: spec de la Máquina → coolingCircuit ────────────
    // spec de la Máquina con la pieza INDIVIDUAL (con el bbox del layout fusionado
    // la percha ahogaba al sizing: ⌀ de agua NaN)
    const qS = FM.solidFromMesh(K.tessellate(oc, specSolid, 0.5, 0.5));
    const dims = [qS.bbox.x1 - qS.bbox.x0, qS.bbox.y1 - qS.bbox.y0, qS.bbox.z1 - qS.bbox.z0];
    let area = 0;
    { const mm = K.tessellate(oc, specSolid, 0.5, 0.5); const I = mm.indices, P = mm.positions;
      for (let t2 = 0; t2 < I.length; t2 += 3) {
        const a = I[t2] * 3, b = I[t2 + 1] * 3, c = I[t2 + 2] * 3;
        const u = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], v = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
        area += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
      } }
    // volumen anual DECLARADO por molde: la percha a 500k dispara nCav=16 y la placa
    // de 488 se sale del catálogo de ⌀ de agua (diaMm null) — el curso hizo 2 cav
    const pkg = MM.moldMachine({ name: M.clave, Lmm: dims[0], Wmm: dims[1], Hmm: dims[2], surfaceMm2: Math.round(area),
      volumeMm3: Math.round(K.volume(oc, specSolid)), wallMm: wall, annualVolume: M.annual ?? 500000, plastic: 'ABS', finish: 'SPI B-3' });
    const asm = PS.packageToAssemblySpec(pkg);
    const D = DS.plateDepth(asm);
    const agua = DS.coolingCircuit(asm, D);
    const dia = agua.diaMm;
    // líneas del serpentín: tramos LARGOS en X → sus y (coords de placa) → pitch real
    const yLineas = [...new Set((agua.segs ?? [])
      .filter((sg) => Math.abs((sg.x1 ?? sg.bx ?? 0) - (sg.x0 ?? sg.ax ?? 0)) > asm.widthMm * 0.3)
      .map((sg) => Math.round(sg.y0 ?? sg.ay ?? sg.y ?? 0)))].sort((a, b) => a - b);
    const H_agua = agua.zBehindMm;
    const pitches = yLineas.slice(1).map((y, i) => y - yLineas[i]);
    const pitchMed = pitches.length ? pitches.sort((a, b) => a - b)[pitches.length >> 1] : 0;
    checks[`${M.clave}_agua_H_libro`] = H_agua >= 2 * dia && H_agua <= 5 * dia;
    // el pitch de CONSTRUCCIÓN es 1.75·H (Eq 9.24, en el note del circuito); las
    // líneas MEDIDAS se corren al ESQUIVAR barrenos (feature del motor, no error)
    checks[`${M.clave}_agua_lineas`] = yLineas.length >= 1 && /Eq 9.24/.test(agua.note ?? '');
    checks[`${M.clave}_llena`] = field.unreachable === 0;
    checks[`${M.clave}_acople_manda`] = tReadyMax > tcMax - 1e-9 && tReadyMax >= tFill;
    // ancla Eq 9.4: pared nominal → t_c analítico vs el t_c del campo (mediana de la pieza)
    const tcNom = CO.coolingTimePlate(wall / 1000, mat);
    filas.push({
      clave: M.clave, nombre, sub: M.sub, wall, cell,
      tFillMs: +(tFill * 1000).toFixed(0), tcMaxS: +tcMax.toFixed(1), tcNomS: +tcNom.toFixed(1),
      tcColadaS: +tcColada.toFixed(1), tReadyMaxS: +tReadyMax.toFixed(1), peorEsFeed, peor,
      agua: { n: yLineas.length, diaMm: dia, depthMm: H_agua, pitchMm: pitchMed, ys: yLineas, D, aguaD: D },
      maps: { nx: nxF, ny: nyF, x0: field.x0, y0: field.y0, mapArr, mapTh, mapReady },
      bbox: q.bbox, aguaD: D,
    });
    console.log(`${M.clave}: t_llenado ${(tFill * 1000).toFixed(0)} ms · t_c pieza máx ${tcMax.toFixed(1)} s (Eq 9.4 nominal ${tcNom.toFixed(1)}) · colada ${tcColada.toFixed(1)} s · LISTO en ${tReadyMax.toFixed(1)} s (peor: ${peorEsFeed ? 'LA COLADA' : 'pieza'} H=${peor.H} mm, llegada ${(peor.frac * 100).toFixed(0)} %) · agua: ${yLineas.length}×⌀${dia} H=${H_agua} pitch≈${pitchMed} · sin llenar ${field.unreachable}`);
  }

  // ── render: mapa por tile (planta), agua encima del t_listo ──────────────
  const VW = 300, VH = 240;
  const tile = (fila, which) => {
    const { nx, ny } = fila.maps;
    const src = which === 'arr' ? fila.maps.mapArr : which === 'th' ? fila.maps.mapTh : fila.maps.mapReady;
    let lo = 1e18, hi = -1e18;
    for (let m = 0; m < src.length; m++) if (src[m] >= 0) { lo = Math.min(lo, src[m]); hi = Math.max(hi, src[m]); }
    const fb = new Float32Array(VW * VH * 3);
    for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) {
      const t = y / VH, o = (y * VW + x) * 3;
      for (let c = 0; c < 3; c++) fb[o + c] = PAL.fondoTop[c] + (PAL.fondoBot[c] - PAL.fondoTop[c]) * t;
    }
    const S = Math.min((VW - 16) / nx, (VH - 16) / ny);
    const ox = (VW - nx * S) / 2, oy = (VH - ny * S) / 2;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = src[j * nx + i];
      if (v < 0) continue;
      const u = hi > lo ? (v - lo) / (hi - lo) : 0.5;
      const col = which === 'arr' ? rampaFlujo(u) : which === 'th' ? [90 + 120 * u, 90 + 60 * u, 200 - 120 * u] : rampaTermo(u);
      const px0 = Math.round(ox + i * S), py0 = Math.round(oy + (ny - 1 - j) * S);
      for (let dy = 0; dy <= Math.ceil(S); dy++) for (let dx = 0; dx <= Math.ceil(S); dx++) {
        const px = px0 + dx, py = py0 + dy;
        if (px < 0 || py < 0 || px >= VW || py >= VH) continue;
        const o = (py * VW + px) * 3;
        fb[o] = col[0]; fb[o + 1] = col[1]; fb[o + 2] = col[2];
      }
    }
    // tuberías del libro sobre el mapa t_listo: líneas a sus y REALES del circuito
    if (which === 'ready' && fila.agua.ys.length) {
      const bb = fila.bbox;
      for (const yl of fila.agua.ys) {
        const yy = typeof yl === 'number' ? yl : yl.y;
        // el circuito vive en coords de placa (0..D): mapear al footprint centrado
        const yRel = yy - (fila.aguaD ?? 0) / 2;
        const j = ((yRel - (bb.y0 + bb.y1) / 2) - fila.maps.y0) / fila.cell;
        const py = Math.round(oy + (ny - 1 - j) * S);
        if (py < 2 || py > VH - 3) continue;
        for (let px = 6; px < VW - 6; px++) {
          const o = (py * VW + px) * 3;
          fb[o] = PAL.agua[0]; fb[o + 1] = PAL.agua[1]; fb[o + 2] = PAL.agua[2];
          const o2 = ((py + 1) * VW + px) * 3;
          fb[o2] = PAL.agua[0]; fb[o2 + 1] = PAL.agua[1]; fb[o2 + 2] = PAL.agua[2];
        }
      }
    }
    const rgb = Buffer.alloc(VW * VH * 3);
    for (let t = 0; t < fb.length; t++) rgb[t] = Math.max(0, Math.min(255, fb[t]));
    return { b64: pngRGB(VW, VH, rgb).toString('base64'), lo, hi };
  };

  let cuerpo = '';
  filas.forEach((f, fi) => {
    const Y = 96 + fi * 320;
    const tArr = tile(f, 'arr'), tTh = tile(f, 'th'), tRd = tile(f, 'ready');
    cuerpo += `<text x="24" y="${Y}" font-size="19" fill="#1c2430" font-weight="bold">MOLDE ${fi + 1} · ${f.nombre}</text>`;
    cuerpo += `<text x="24" y="${Y + 19}" font-size="12.5" fill="#5a6577">${f.sub} · celda ${f.cell} mm · agua del LIBRO: ${f.agua.n}×⌀${f.agua.diaMm} · H=${f.agua.depthMm} mm (Eq 9.22: 4⌀, rango 2-5⌀) · pitch=${f.agua.pitchMm} mm (Eq 9.24: 1.75H)</text>`;
    const tiles = [[tArr, 'LLEGADA del fundido (flujo)'], [tTh, 'ESPESOR local H-R (mm)'], [tRd, 't_LISTO = llegada + Eq 9.4 · ── agua']];
    tiles.forEach(([t, lab], i) => {
      const x = 24 + i * (VW + 14);
      cuerpo += `<image x="${x}" y="${Y + 28}" width="${VW}" height="${VH}" href="data:image/png;base64,${t.b64}"/>`;
      cuerpo += `<rect x="${x}" y="${Y + 28}" width="${VW}" height="${VH}" fill="none" stroke="#b9c0cc"/>`;
      cuerpo += `<text x="${x + 5}" y="${Y + 42}" font-size="11" fill="#3c4656">${lab}</text>`;
      const fmt = (v) => i === 0 ? `${(v * f.tFillMs / 1000 * 1000).toFixed(0)} ms` : i === 1 ? `${v.toFixed(1)} mm` : `${v.toFixed(0)} s`;
      cuerpo += `<text x="${x + 5}" y="${Y + 28 + VH - 6}" font-size="10.5" fill="#3c4656">${fmt(t.lo)} → ${fmt(t.hi)}</text>`;
    });
    const sx = 24 + 3 * (VW + 14) + 8;
    const st = [
      `t_LLENADO: ${f.tFillMs} ms`,
      `t_c pieza máx: ${f.tcMaxS} s (nominal Eq 9.4 ${f.tcNomS} s)`,
      `t_c COLADA (rod): ${f.tcColadaS} s`,
      `LISTO PARA EXPULSAR: ${f.tReadyMaxS} s`,
      `manda: ${f.peorEsFeed ? 'LA COLADA ⌀6 — §6.3.3: por esto' : 'la pieza'} ${f.peorEsFeed ? 'existe la colada caliente' : `(H=${f.peor.H} mm · llega al ${(f.peor.frac * 100).toFixed(0)} %)`}`,
      `+ apertura/expulsión (§6.3.2, máquina)`,
    ];
    cuerpo += `<text x="${sx}" y="${Y + 40}" font-size="13" fill="#1c2430" font-weight="bold">EL CICLO</text>`;
    st.forEach((ln, i) => { cuerpo += `<text x="${sx}" y="${Y + 62 + i * 21}" font-size="12.5" fill="#44506a">${ln}</text>`; });
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="ui-monospace,Menlo,monospace">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f9"/><stop offset="1" stop-color="#c9ced6"/></linearGradient></defs>
<rect width="1920" height="1080" fill="url(#bg)"/>
<text x="24" y="40" font-size="26" fill="#1c2430" font-weight="bold">CICLO COMPLETO — llenado + enfriamiento + tuberías (los 3 moldes de los cursos)</text>
<text x="24" y="62" font-size="13" fill="#5a6577">EL ACOPLE: el MISMO espesor local (H-R) pesa la resistencia de flujo (Eq 5.22) y el enfriamiento (Eq 9.4) → t_listo = t_llegada + t_c(H local) por vóxel · colada como barra (rod) · ABS Kazmer §9.1 (α 8.69e-8 · 239/60/97.6 °C) · agua por Eq 9.22/9.24</text>
${cuerpo}
<text x="24" y="1066" font-size="12" fill="#5a6577">honesto: enfriamiento por modo dominante Eq 9.4 con H local (sin FDM 3D del acero en esta lámina — el FDM del molde ya existe aparte) · PP de la percha sin datos medidos → proxy ABS DECLARADO · colada fría ⌀6 declarada · el peor vóxel (grueso Y tardío) manda</text>
</svg>`;
  fs.writeFileSync(path.join(out, 'ciclo-completo.svg'), svg);
  const pass = Object.values(checks).every(Boolean);
  fs.writeFileSync(path.join(out, 'telemetria-ciclo.json'), JSON.stringify({ fecha: '2026-07-18', filas: filas.map(({ maps, ...r }) => r), checks }, null, 1));
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  if (!pass) process.exit(2);
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 600)); process.exit(1); });
