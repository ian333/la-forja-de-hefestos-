/**
 * VIDEO 3D DEL CICLO COMPLETO — llenado + enfriamiento + tuberías, por molde.
 * ============================================================================
 * "faltan los videos 3d" (user). El ciclo ENTERO en 3D, con la física acoplada:
 *
 *  FASE 1 · LLENADO (cámara LENTA): el frente por resistencia (Eq 5.22) con
 *   trazadoras por el árbol de alimentación real — el motor del hito.
 *  FASE 2 · ENFRIAMIENTO (time-lapse): cada vóxel se enfría desde SU t de
 *   llegada con SU espesor local H-R:
 *     T(t) = Tw + (Tm−Tw)·exp(−(t−t_arr)/τ),  τ = t_c/ln((Tm−Tw)/(Te−Tw))
 *   con t_c = Eq 9.4 (placa) o rod (colada) — el modo dominante CALIBRADO al
 *   libro: T(t_arr)=Tm y T(t_arr+t_c)=Te exactos. Congelado (≤Te) = apagado.
 *  TUBERÍAS: las líneas del coolingCircuit (Eq 9.22/9.24) en azul, activas.
 *  El vóxel PEOR (grueso Y tardío) lleva crosshair: él manda el ciclo.
 *
 * ABS Kazmer §9.1 (α 8.69e-8 · 239/60/97.6 °C); PP percha → proxy DECLARADO.
 * Uso: node --import tsx scripts/ciclo-video.cjs <molde: percha|familia|carcasa> <outdir> [--proof]
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
const RAMP = [[255, 241, 200], [255, 176, 59], [219, 91, 46], [122, 30, 60], [56, 24, 84]];
const ramp = (u) => {
  const t = Math.max(0, Math.min(0.999, u)) * (RAMP.length - 1);
  const i = Math.floor(t), f = t - i, a = RAMP[i], b = RAMP[Math.min(RAMP.length - 1, i + 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
};
// rampa TÉRMICA (DOCTRINA-COLOR: caliente blanco-amarillo → rojo → morado → azul frío)
const termo = (TC, Tw, Tm) => {
  const u = Math.max(0, Math.min(1, (TC - Tw) / (Tm - Tw)));
  if (u > 0.75) { const v = (u - 0.75) / 0.25; return [255, 200 + 41 * v, 120 + 80 * v]; }
  if (u > 0.45) { const v = (u - 0.45) / 0.3; return [220 + 35 * v, 90 + 110 * v, 55 + 65 * v]; }
  if (u > 0.2) { const v = (u - 0.2) / 0.25; return [120 + 100 * v, 40 + 50 * v, 90 - 35 * v]; }
  const v = u / 0.2; return [40 + 80 * v, 60 - 20 * v, 140 - 50 * v];
};

(async () => {
  const MOLDE = process.argv[2] || 'carcasa';
  const out = process.argv[3] || `/tmp/cv-${MOLDE}`;
  const proof = process.argv.includes('--proof');
  const NF = proof ? 4 : 360, NFILL = proof ? 2 : 125;
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
  const mat = CO.ABS_KAZMER, melt = F.ABS_MG47;
  const caja = (w, d, h, at = [0, 0, 0]) => K.transformShape(oc, K.makeBox(oc, w, d, h), { translate: [at[0] - w / 2, at[1] - d / 2, at[2]] });
  const octo = (w, h, c) => [
    { x: -w / 2 + c, y: -h / 2 }, { x: w / 2 - c, y: -h / 2 }, { x: w / 2, y: -h / 2 + c }, { x: w / 2, y: h / 2 - c },
    { x: w / 2 - c, y: h / 2 }, { x: -w / 2 + c, y: h / 2 }, { x: -w / 2, y: h / 2 - c }, { x: -w / 2, y: -h / 2 + c },
  ];

  // ── geometría del molde pedido (las mismas de ciclo-completo-cursos) ─────
  let solid, wall, nombre, specSolid, gates, annual = 500000, proxy = false;
  if (MOLDE === 'percha') {
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
    specSolid = MD.scaleForShrinkage(oc, p, 1.015);
    const c1 = K.transformShape(oc, specSolid, { rotateAngle: Math.PI / 2, rotateAxis: { origin: [0, 0, 0], dir: [0, 0, 1] }, translate: [-5, 0, 0] });
    const c2 = K.transformShape(oc, specSolid, { rotateAngle: -Math.PI / 2, rotateAxis: { origin: [0, 0, 0], dir: [0, 0, 1] }, translate: [5, 0, 0] });
    solid = K.fuse(oc, c1, c2); wall = 10.15; nombre = 'PERCHA ×2 · molde del curso Alwis 2022'; gates = [{ x: -15, y: 0 }, { x: 15, y: 0 }]; annual = 60000; proxy = true;
  } else if (MOLDE === 'familia') {
    const clip = K.extrudePolygonWithHoles(oc, octo(62, 40, 10), [octo(44, 24, 7)], 4);
    const NT = 9, TW2 = 78, spine = 8;
    const po = [{ x: -TW2 / 2, y: spine }, { x: TW2 / 2, y: spine }, { x: TW2 / 2, y: 0 }];
    for (let i = NT; i >= 0; i--) {
      const x0 = -TW2 / 2 + (i * TW2) / NT;
      po.push({ x: x0 + 2.6, y: 0 }, { x: x0 + 2.6, y: -22 }, { x: x0 + 1.3, y: -24 }, { x: x0, y: -22 }, { x: x0, y: 0 });
    }
    const peine = K.extrudePolygon(oc, po, 3);
    const cE = MD.scaleForShrinkage(oc, clip, 1.006), pE = MD.scaleForShrinkage(oc, peine, 1.006);
    solid = K.fuse(oc, K.transformShape(oc, cE, { translate: [0, 48, 0] }), K.transformShape(oc, pE, { translate: [0, -28, 0] }));
    wall = 4; nombre = 'CLIP + PEINE familia · curso Alwis 2023'; specSolid = cE; gates = [{ x: 0, y: 31 }, { x: 0, y: -24 }];
  } else {
    const sh = K.importSTEP(oc, fs.readFileSync(path.join(ROOT, 'test-parts', 'inyeccion-reales', '1591BSBK.stp')));
    const solids = K.uniqueSubShapes(oc, sh, oc.TopAbs_ShapeEnum.TopAbs_SOLID);
    let best = 0;
    for (const s of solids) { const v = K.volume(oc, s); if (v > best) { best = v; solid = s; } }
    wall = 2.09; nombre = 'CARCASA Hammond 1591 · estudio curso CIM'; specSolid = solid; gates = null;
  }

  const q = FM.solidFromMesh(K.tessellate(oc, solid, 0.35, 0.35));
  const cx = (q.bbox.x0 + q.bbox.x1) / 2, cy = (q.bbox.y0 + q.bbox.y1) / 2;
  const zs = q.bbox.z0;
  const inFeed = gates
    ? (x, y, z) => {
      if (z >= zs) return false;
      const sx = (gates[0].x + gates[1].x) / 2, sy = (gates[0].y + gates[1].y) / 2;
      if (z > zs - 24 && z <= zs - 6 && (x - sx) ** 2 + (y - sy) ** 2 <= 9) return true;
      const a = gates[0], b = gates[1];
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      const tt = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / (L * L)));
      const px = a.x + tt * (b.x - a.x), py = a.y + tt * (b.y - a.y);
      if (z > zs - 8 && z <= zs - 3 && Math.hypot(x - px, y - py) <= 2.5) return true;
      for (const g of gates) if (z > zs - 3 && Math.hypot(x - g.x, y - g.y) <= 1.5) return true;
      return false;
    }
    : (x, y, z) => z < zs && z > zs - 24 && (x - cx) ** 2 + (y - cy) ** 2 <= 9;
  const gate0 = gates ? { x: (gates[0].x + gates[1].x) / 2, y: (gates[0].y + gates[1].y) / 2, z: zs - 23 } : { x: cx, y: cy, z: zs - 23 };
  const cell = Math.max(0.6, Math.min(1.1, wall * 0.45));
  const t0 = Date.now();
  const field = FL.measureFlowLength({
    x0: q.bbox.x0 - 2, y0: q.bbox.y0 - 2, z0: zs - 25, x1: q.bbox.x1 + 2, y1: q.bbox.y1 + 2, z1: q.bbox.z1 + 1,
    cellMm: cell, gateMm: gate0,
    inCavity: (x, y, z) => inFeed(x, y, z) || q.inside(x, y, z),
    wallMm: wall, meltN: melt.n,
  });
  const front = FL.createFlowFront(field);
  console.log(`CAMPO ${MOLDE}: ${field.nx}×${field.ny}×${field.nz} @${cell} · ${Date.now() - t0} ms · muertos ${field.unreachable}`);
  const vM = F.convergeVelocity(melt, wall / 1000);
  const tFill = field.maxFlowLenMm / 1000 / vM;

  // ── precomputar por vóxel: llegada, τ, t_listo ───────────────────────────
  const N = field.cavity.length;
  const lnFac = Math.log((mat.tMelt - mat.tCoolant) / (mat.tEject - mat.tCoolant));
  const tArr = new Float32Array(N).fill(NaN);
  const tau = new Float32Array(N);
  let tReadyMax = 0, peorT = -1;
  for (let t = 0; t < N; t++) {
    if (!field.cavity[t] || !Number.isFinite(field.resistance[t])) continue;
    const k = Math.floor(t / (field.nx * field.ny));
    const z = field.z0 + (k + .5) * cell;
    const H = field.thicknessMm[t];
    const tc = z < zs ? CO.coolingTimeRod(H / 1000, mat) : CO.coolingTimePlate(H / 1000, mat);
    tArr[t] = (field.resistance[t] / field.maxResistance) * tFill;
    tau[t] = tc / lnFac;
    const tr = tArr[t] + tc;
    if (tr > tReadyMax) { tReadyMax = tr; peorT = t; }
  }
  const pi = peorT % field.nx, pj = ((peorT - pi) / field.nx) % field.ny, pk = ((peorT - pi) / field.nx - pj) / field.ny;
  const peor = { x: field.x0 + (pi + .5) * cell, y: field.y0 + (pj + .5) * cell, z: field.z0 + (pk + .5) * cell, H: field.thicknessMm[peorT] };
  console.log(`t_llenado ${(tFill * 1000).toFixed(0)} ms · LISTO ${tReadyMax.toFixed(1)} s · peor H=${peor.H.toFixed(2)} mm`);

  // ── tuberías del libro ───────────────────────────────────────────────────
  const qS = FM.solidFromMesh(K.tessellate(oc, specSolid, 0.5, 0.5));
  const dimsS = [qS.bbox.x1 - qS.bbox.x0, qS.bbox.y1 - qS.bbox.y0, qS.bbox.z1 - qS.bbox.z0];
  let areaS = 0;
  { const mm = K.tessellate(oc, specSolid, 0.5, 0.5); const I = mm.indices, P = mm.positions;
    for (let t2 = 0; t2 < I.length; t2 += 3) {
      const a = I[t2] * 3, b = I[t2 + 1] * 3, c = I[t2 + 2] * 3;
      const u = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], v = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
      areaS += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
    } }
  const pkg = MM.moldMachine({ name: MOLDE, Lmm: dimsS[0], Wmm: dimsS[1], Hmm: dimsS[2], surfaceMm2: Math.round(areaS),
    volumeMm3: Math.round(K.volume(oc, specSolid)), wallMm: wall, annualVolume: annual, plastic: 'ABS', finish: 'SPI B-3' });
  const asm = PS.packageToAssemblySpec(pkg);
  const D = DS.plateDepth(asm);
  const agua = DS.coolingCircuit(asm, D);
  const yAgua = [...new Set((agua.segs ?? [])
    .filter((sg) => Math.abs((sg.x1 ?? 0) - (sg.x0 ?? 0)) > asm.widthMm * 0.3)
    .map((sg) => Math.round(sg.y0 ?? sg.y ?? 0)))].sort((a, b) => a - b).map((yy) => yy - D / 2 + cy);
  const zAguaB = zs - (agua.zBehindMm ?? 25);            // línea del lado B (bajo la impronta)
  const zAguaA = q.bbox.z1 + (agua.zBehindMm ?? 25) * 0.6; // lado A (arriba, aprox visual)

  // ── trazadoras (fase llenado) ────────────────────────────────────────────
  const NTR = 4000;
  const targets = [];
  for (let t = 0; t < N; t++) if (field.cavity[t] && Number.isFinite(field.resistance[t])) targets.push(t);
  targets.sort((a, b) => ((a * 0.6180339887) % 1) - ((b * 0.6180339887) % 1));
  const pathOf = (t) => {
    const idxs = [];
    for (let cur = t; cur >= 0; cur = field.parent[cur]) idxs.push(cur);
    idxs.reverse();
    const keep = [];
    for (let n = 0; n < idxs.length; n++) if (n % 2 === 0 || n === idxs.length - 1) keep.push(idxs[n]);
    const a = new Float32Array(keep.length * 4);
    for (let n = 0; n < keep.length; n++) {
      const cur = keep[n];
      const i = cur % field.nx, j = ((cur - i) / field.nx) % field.ny, k = ((cur - i) / field.nx - j) / field.ny;
      a[4 * n] = field.x0 + (i + .5) * cell; a[4 * n + 1] = field.y0 + (j + .5) * cell;
      a[4 * n + 2] = field.z0 + (k + .5) * cell; a[4 * n + 3] = field.resistance[cur];
    }
    return a;
  };
  const tr = [];
  for (let i = 0; i < NTR; i++) {
    const t = targets[i % targets.length];
    tr.push({ path: pathOf(t), Rt: field.resistance[t], lag: 0.015 + 0.05 * ((i * 0.6180339887) % 1) });
  }
  let nextTarget = NTR;
  const posAt = (p, R) => {
    const n = p.length / 4;
    if (n === 0) return null;
    if (R <= p[3]) return [p[0], p[1], p[2]];
    if (R >= p[4 * (n - 1) + 3]) return [p[4 * (n - 1)], p[4 * (n - 1) + 1], p[4 * (n - 1) + 2]];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[4 * m + 3] <= R) lo = m; else hi = m; }
    const rA = p[4 * lo + 3], rB = p[4 * hi + 3], f = rB > rA ? (R - rA) / (rB - rA) : 0;
    return [p[4 * lo] + (p[4 * hi] - p[4 * lo]) * f, p[4 * lo + 1] + (p[4 * hi + 1] - p[4 * lo + 1]) * f, p[4 * lo + 2] + (p[4 * hi + 2] - p[4 * lo + 2]) * f];
  };

  // ── render ───────────────────────────────────────────────────────────────
  const VW = 1000, VH = 840;
  const cx0 = cx, cy0 = cy, cz0 = (zs - 25 + q.bbox.z1) / 2;
  let uSpan = 0, vSpan = 0;
  { const th = 0, c = Math.cos(th), s2 = Math.sin(th); void c; void s2; }
  for (const X of [q.bbox.x0, q.bbox.x1]) for (const Y of [q.bbox.y0, q.bbox.y1]) {
    uSpan = Math.max(uSpan, Math.abs(X - cx0) + Math.abs(Y - cy0));
    vSpan = Math.max(vSpan, (Math.abs(X - cx0) + Math.abs(Y - cy0)) * 0.5 + (q.bbox.z1 - cz0));
  }
  const S = Math.min((VW - 60) / (2 * uSpan), (VH - 80) / (2 * vSpan)) * 0.98;
  const mkProj = (thetaDeg) => {
    const th = (thetaDeg * Math.PI) / 180, cosT = Math.cos(th), sinT = Math.sin(th);
    return (x, y, z) => {
      const xr = (x - cx0) * cosT - (y - cy0) * sinT, yr = (x - cx0) * sinT + (y - cy0) * cosT;
      return { u: VW / 2 + (xr - yr) * S, v: VH / 2 + (xr + yr) * 0.5 * S - (z - cz0) * S, d: xr + yr + (z - cz0) * 0.35 };
    };
  };
  const Tm = mat.tMelt, Tw = mat.tCoolant, Te = mat.tEject;
  const serie = [];
  const tRender = Date.now();
  const nVoxTot = front.nVox;
  const coolSpan = tReadyMax * 1.02 - tFill;
  for (let f = 0; f < NF; f++) {
    const enFill = f < NFILL;
    const tNow = enFill ? (f / (NFILL - 1)) * tFill : tFill + ((f - NFILL) / (NF - NFILL - 1)) * coolSpan;
    const Rt = enFill ? front.frontAt(f / (NFILL - 1)).resistance : field.maxResistance;
    if (enFill) {
      for (const s2 of tr) {
        let guard = 0;
        while (!s2.done && s2.Rt <= Rt * (1 - s2.lag) && guard++ < 50) {
          if (nextTarget >= targets.length * 3) { s2.done = true; break; }
          const t = targets[nextTarget++ % targets.length];
          if (field.resistance[t] > Rt * (1 - s2.lag)) { s2.path = pathOf(t); s2.Rt = field.resistance[t]; }
        }
      }
    }
    const proj = mkProj(-20 + 50 * (f / (NF - 1)));
    const fb = new Float32Array(VW * VH * 3).fill(9);
    const splats = [];
    let maxT = Tw, listos = 0, tot = 0;
    for (let k = 0; k < field.nz; k++) for (let j = 0; j < field.ny; j++) for (let i = 0; i < field.nx; i++) {
      const t = (k * field.ny + j) * field.nx + i;
      if (!field.cavity[t]) continue;
      const x = field.x0 + (i + .5) * cell, y = field.y0 + (j + .5) * cell, z = field.z0 + (k + .5) * cell;
      const p = proj(x, y, z);
      if (!Number.isFinite(field.resistance[t])) continue;
      tot++;
      if (enFill && field.resistance[t] > Rt) { splats.push([p.d, p.u, p.v, 46, 55, 76, 0.09]); continue; }
      const TC = tNow <= tArr[t] ? Tm : Tw + (Tm - Tw) * Math.exp(-(tNow - tArr[t]) / tau[t]);
      if (TC > maxT) maxT = TC;
      if (TC <= Te) listos++;
      const col = enFill ? ramp(0.15 + 0.85 * (field.resistance[t] / field.maxResistance)) : termo(TC, Tw, Tm);
      const frio = !enFill && TC <= Te;
      // congelado = SÓLIDO pizarra visible (con el dimming anterior la pieza fría
      // desaparecía en el fondo — el final del video quedaba NEGRO)
      const cc2 = frio ? [104, 122, 156] : col;
      splats.push([p.d, p.u, p.v, cc2[0], cc2[1], cc2[2], enFill ? 0.16 + 0.42 * (1 - field.resistance[t] / field.maxResistance) : (frio ? 0.42 : 0.5)]);
    }
    // tuberías (azules, PULSAN en enfriamiento)
    const pulso = enFill ? 0.35 : 0.55 + 0.25 * Math.sin(f * 0.5);
    for (const zA of [zAguaB, zAguaA]) for (const ya of yAgua) {
      for (let x = q.bbox.x0 - 12; x <= q.bbox.x1 + 12; x += cell) {
        const p = proj(x, ya, zA);
        splats.push([p.d, p.u, p.v, 64, 156, 255, pulso]);
      }
    }
    splats.sort((a, b) => a[0] - b[0]);
    const KW = [0.3, 0.62, 0.3];
    for (const [, u, v, rr, g, b, aA] of splats) {
      const ui = u | 0, vi = v | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const px = ui + dx, py = vi + dy;
        if (px < 0 || py < 0 || px >= VW || py >= VH) continue;
        const a2 = Math.min(1, aA * KW[dx + 1] * KW[dy + 1] * 2.2);
        const o = (py * VW + px) * 3;
        fb[o] = fb[o] * (1 - a2) + rr * a2; fb[o + 1] = fb[o + 1] * (1 - a2) + g * a2; fb[o + 2] = fb[o + 2] * (1 - a2) + b * a2;
      }
    }
    if (enFill) {
      const dR = field.maxResistance * 0.014;
      const add = (x, y, z, w, boost) => {
        const p = proj(x, y, z);
        const ui = p.u | 0, vi = p.v | 0;
        for (let dy = 0; dy < w; dy++) for (let dx = 0; dx < w; dx++) {
          const px = ui + dx, py = vi + dy;
          if (px < 0 || py < 0 || px >= VW || py >= VH) continue;
          const o = (py * VW + px) * 3;
          fb[o] += 235 * boost; fb[o + 1] += 214 * boost; fb[o + 2] += 168 * boost;
        }
      };
      for (const s2 of tr) {
        const Rme = Rt * (1 - s2.lag);
        if (Rme <= 0 || s2.done) continue;
        const head = posAt(s2.path, Math.min(Rme, s2.Rt));
        if (!head) continue;
        for (let e = 1; e <= 4; e++) {
          const pe = posAt(s2.path, Math.min(Rme, s2.Rt) - dR * e / 4);
          if (pe) add(pe[0], pe[1], pe[2], 2, 0.22 * (1 - e / 5));
        }
        add(head[0], head[1], head[2], 3, Rme < s2.Rt ? 1.0 : 0.3);
      }
    }
    const rgb = Buffer.alloc(VW * VH * 3);
    for (let t = 0; t < fb.length; t++) rgb[t] = Math.min(255, fb[t]);
    const b64 = pngRGB(VW, VH, rgb).toString('base64');
    // marcador del vóxel PEOR durante enfriamiento
    let marks = '';
    if (!enFill) {
      const wp = proj(peor.x, peor.y, peor.z);
      marks = `<circle cx="${(30 + wp.u).toFixed(0)}" cy="${(110 + wp.v).toFixed(0)}" r="12" fill="none" stroke="#ffffff" stroke-width="2"/>` +
        `<text x="60" y="150" font-size="16" fill="#eaf2ff">○ el vóxel que MANDA: H=${peor.H.toFixed(1)} mm y llega tarde — él decide el ciclo</text>`;
    }
    const fase = enFill ? `LLENADO (cámara lenta ${(15 * NFILL / NF / Math.max(1e-9, tFill)).toFixed(0)}×)` : `ENFRIAMIENTO (time-lapse ${(coolSpan / (15 * (NF - NFILL) / NF)).toFixed(0)}×)`;
    const reloj = tNow < 1.5 ? `${(tNow * 1000).toFixed(0)} ms` : `${tNow.toFixed(1)} s`;
    const pctListo = tot ? (100 * listos / tot) : 0;
    serie.push({ f, tNow: +tNow.toFixed(3), maxT: +maxT.toFixed(1), pctListo: +pctListo.toFixed(1) });
    // curva T_max
    const pts = serie.map((s3, i2) => `${(1100 + (i2 / (NF - 1)) * 740).toFixed(1)},${(700 - ((s3.maxT - Tw) / (Tm - Tw)) * 240).toFixed(1)}`).join(' ');
    const yTe = 700 - ((Te - Tw) / (Tm - Tw)) * 240;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="ui-monospace,Menlo,monospace">
<rect width="1920" height="1080" fill="#0b0f16"/>
<text x="60" y="56" font-size="30" fill="#eaf2ff">EL CICLO COMPLETO — ${nombre}</text>
<text x="60" y="88" font-size="17" fill="#5d7290">llenado (Eq 5.22) + enfriamiento por llegada+espesor (Eq 9.4 acoplada) + agua del libro (${yAgua.length}×⌀${agua.diaMm} · H=${agua.zBehindMm} · Eq 9.22/9.24) · ${(nVoxTot / 1000).toFixed(0)}k vóxeles${proxy ? ' · PP→proxy ABS DECLARADO' : ' · ABS'}</text>
<image x="30" y="110" width="1000" height="840" href="data:image/png;base64,${b64}"/>
${marks}
<text x="60" y="975" font-size="16" fill="#5d7290">${enFill ? 'ámbar→morado = orden de llegada · blanco = fundido VIAJANDO' : `color = TEMPERATURA (blanco-rojo caliente → morado → azul frío) · pizarra = ya CONGELÓ (≤ ${Te} °C)`} · azul = agua (Eq 9.22/9.24)</text>
<text x="1100" y="150" font-size="21" fill="#8fa3bf">FASE: ${fase}</text>
<text x="1100" y="186" font-size="34" fill="#eaf2ff">t = ${reloj}</text>
<text x="1100" y="216" font-size="17" fill="#7ee0a0">${enFill ? `llenado ${(100 * f / (NFILL - 1)).toFixed(0)} %` : `pieza CONGELADA: ${pctListo.toFixed(0)} % de vóxeles`}</text>
<text x="1100" y="452" font-size="19" fill="#8fa3bf">T máx del plástico — cae hasta T_eject ${Te} °C</text>
<polyline points="${pts}" fill="none" stroke="#f2c14e" stroke-width="3"/>
<line x1="1100" y1="${yTe.toFixed(0)}" x2="1840" y2="${yTe.toFixed(0)}" stroke="#7ee0a0" stroke-dasharray="6 5"/>
<text x="1846" y="${(yTe + 4).toFixed(0)}" font-size="13" fill="#7ee0a0">Te</text>
<line x1="1100" y1="700" x2="1840" y2="700" stroke="#2a3446"/>
<text x="1100" y="726" font-size="15" fill="#5d7290">0</text>
<text x="1750" y="726" font-size="15" fill="#5d7290">${tReadyMax.toFixed(0)} s</text>
<text x="1100" y="760" font-size="22" fill="#f2c14e">T máx = ${maxT.toFixed(0)} °C</text>
<text x="1100" y="810" font-size="16" fill="#5d7290">t_llenado ${(tFill * 1000).toFixed(0)} ms · LISTO PARA EXPULSAR: ${tReadyMax.toFixed(1)} s</text>
<text x="1100" y="836" font-size="16" fill="#5d7290">α ${mat.alpha} m²/s · Tm ${Tm} / Tw ${Tw} / Te ${Te} °C (ABS §9.1)</text>
<text x="1100" y="862" font-size="16" fill="#5d7290">t_c: placa Eq 9.4 · colada rod — con el ESPESOR LOCAL de cada vóxel</text>
<text x="60" y="1044" font-size="14" fill="#44506a">honesto: llenado cuasiestático · enfriamiento por modo dominante calibrado a Eq 9.4/rod con H local (T(t_arr)=Tm, T(t_arr+t_c)=Te) · sin FDM 3D del acero en este video · agua en su posición del circuito del libro · render: iangpu (nice 10)</text>
</svg>`;
    fs.writeFileSync(path.join(out, `f${String(f).padStart(4, '0')}.svg`), svg);
    if (f % 60 === 0) console.log(`  cuadro ${f}/${NF} · ${((Date.now() - tRender) / 1000).toFixed(0)} s`);
  }
  console.log(`${NF} SVG en ${((Date.now() - tRender) / 1000).toFixed(0)} s → ${out}`);
  const checks = {
    llena: field.unreachable === 0,
    tmax_llega_a_Te: Math.abs(serie[serie.length - 1].maxT - Te) < (Tm - Tw) * 0.06,
    t_decrece: serie.slice(NFILL + 1).every((s3, i2, arr) => i2 === 0 || s3.maxT <= arr[i2 - 1].maxT + 1e-6),
    congelado_sube: serie.slice(NFILL + 1).every((s3, i2, arr) => i2 === 0 || s3.pctListo >= arr[i2 - 1].pctListo - 1e-6),
    agua_presente: yAgua.length >= 1,
  };
  const pass = Object.values(checks).every(Boolean);
  fs.writeFileSync(path.join(out, 'telemetria.json'), JSON.stringify({ molde: MOLDE, tFillMs: +(tFill * 1000).toFixed(0), tReadyMaxS: +tReadyMax.toFixed(1), peor, agua: { n: yAgua.length, dia: agua.diaMm, H: agua.zBehindMm }, serie }, null, 1));
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  if (!pass && !proof) process.exit(2);
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 600)); process.exit(1); });
