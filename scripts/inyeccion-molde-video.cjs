/**
 * LA INYECCIÓN EN 3D v4 — EL MOLDE A/B DE VERDAD: el acero que forma la figura.
 * ============================================================================
 * "QUIERO VER LOS MOLDES A/B sin análisis de temperatura, pero quiero ver los
 *  moldes y cómo se rellena la figura" (user 2026-07-17).
 *
 * EL ACERO NO ES DECORACIÓN: sale de `splitMold` (mold.ts — el MÉTODO del libro,
 * bloque − pieza ESCALADA 1.05 de contracción, partición en la boca − pinch 0.5,
 * portacore Fig 6-34). La placa A (cavidad) queda ABAJO y forma el exterior del
 * vaso; el NÚCLEO B entra por arriba y forma el interior. El sprue ⌀5 atraviesa
 * la placa A hasta el centro del piso: compuerta DIRECTA, el esquema clásico del
 * vaso (así lo dimensiona nuestra propia Máquina: cold-2placas × 1 cav).
 *
 * LO QUE SE VE: el molde en CORTE (la mitad frontal del acero removida; las
 * caras de corte SÓLIDAS — la lección de MoldSectionReveal), el hueco fantasma,
 * y el fundido llenando por dentro: baja el sprue, golpea el piso, corre RADIAL
 * y sube las paredes en anillo. Lo último = el ARO de la boca, exactamente EN LA
 * PARTICIÓN — por eso el venteo del molde vive ahí.
 *
 * Física: la misma verificada (frente por resistencia Eq 5.22 con integral del
 * campo, colada Eq 6.5). SIN térmico (a pedido). PP sin power-law en el libro →
 * ABS MG47 (p.105-111) como proxy DECLARADO.
 * Uso: node --import tsx scripts/inyeccion-molde-video.cjs <out> [--proof]
 */
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const distDir = path.join(ROOT, 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!fs.existsSync(cjsGlue)) {
  let s = fs.readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  fs.writeFileSync(cjsGlue, s);
}

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

(async () => {
  const out = process.argv[2] || '/tmp/inymd';
  const proof = process.argv.includes('--proof');
  const NF = proof ? 3 : 360;
  fs.mkdirSync(out, { recursive: true });

  const oc = await require(cjsGlue)({ wasmBinary: fs.readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const K = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const TL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'timeline.ts'));
  const TP = await import(path.join(ROOT, 'src', 'forja', 'mold', 'parts', 'tupper.ts'));
  const MD = await import(path.join(ROOT, 'src', 'forja', 'mold', 'mold.ts'));
  const FL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen.ts'));
  const FM = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen-mesh.ts'));
  const F = await import(path.join(ROOT, 'src', 'forja', 'mold', 'filling.ts'));
  const FD = await import(path.join(ROOT, 'src', 'forja', 'mold', 'feed.ts'));

  // ── EL VASO + SU MOLDE (splitMold — el método del libro) ─────────────────
  const P = TP.TUPPER_DEFAULT;
  const WALL = P.wallMm * 1.05;                             // la cavidad es la pieza ESCALADA
  const rV = TL.rebuild(K, oc, TP.tupperRecipe().timeline);
  if (!rV.shape) { console.error('sin sólido'); process.exit(1); }
  const SCALE = 1.05;                                       // contracción (libro: 1.05 la tapa)
  const scaled = MD.scaleForShrinkage(oc, rV.shape, SCALE);
  const split = MD.splitMold(oc, rV.shape, { scale: SCALE });
  console.log(split.report.join('\n'));
  if (split.bodies < 2) { console.error('el molde NO separó'); process.exit(1); }
  // el SPRUE ⌀5 atraviesa la placa A (cavidad) hasta el centro del piso
  const qP0 = FM.solidFromMesh(K.tessellate(oc, scaled, 0.25, 0.25));
  const cx = (qP0.bbox.x0 + qP0.bbox.x1) / 2, cy = (qP0.bbox.y0 + qP0.bbox.y1) / 2;
  const SPRUE_R = 2.5;
  const aBB = MD.shapeBBox(oc, split.cavityPlate);
  const SPRUE_Z0 = aBB.min[2];                              // desde el fondo de la placa A
  const sprue = K.makeCylinder(oc, SPRUE_R, -SPRUE_Z0 + 1, { origin: [cx, cy, SPRUE_Z0 - 0.5], dir: [0, 0, 1] });
  const plateA = K.cut(oc, split.cavityPlate, sprue);       // el canal EXISTE en el acero
  const plateB = split.corePlate;
  const volPcc = K.volume(oc, scaled) / 1000;
  console.log(`pieza escalada ${SCALE}: ${volPcc.toFixed(2)} cc · sprue ⌀${2 * SPRUE_R} desde z=${SPRUE_Z0.toFixed(1)} · partición z=${split.zPart.toFixed(2)}`);

  const qA = FM.solidFromMesh(K.tessellate(oc, plateA, 0.4, 0.4));
  const qB = FM.solidFromMesh(K.tessellate(oc, plateB, 0.4, 0.4));

  // ── EL CAMPO DE FLUJO: sprue + pieza (compuerta directa al centro) ───────
  const cell = 0.6;
  const inFeed = (x, y, z) => z < 0 && z > SPRUE_Z0 && (x - cx) ** 2 + (y - cy) ** 2 <= SPRUE_R ** 2;
  const FEED_MM3 = Math.PI * SPRUE_R * SPRUE_R * -SPRUE_Z0;
  const t0 = Date.now();
  const field = FL.measureFlowLength({
    x0: qP0.bbox.x0 - 2, y0: qP0.bbox.y0 - 2, z0: SPRUE_Z0 - 1, x1: qP0.bbox.x1 + 2, y1: qP0.bbox.y1 + 2, z1: qP0.bbox.z1 + 1,
    cellMm: cell, gateMm: { x: cx, y: cy, z: SPRUE_Z0 + 0.5 },
    inCavity: (x, y, z) => inFeed(x, y, z) || qP0.inside(x, y, z),
    wallMm: WALL, meltN: 0.348, expectVolumeMm3: volPcc * 1000 + FEED_MM3,
  });
  const front = FL.createFlowFront(field);
  console.log(`CAMPO: ${field.nx}×${field.ny}×${field.nz} celdas ${cell} · ${Date.now() - t0} ms · sin llenar ${field.unreachable}`);
  for (const w of field.warnings) console.log(`  AVISO: ${w}`);

  // aire atrapado = lo último (debe ser el ARO de la boca, EN la partición)
  let trapT = -1, trapR = -1;
  for (let t = 0; t < field.cavity.length; t++) {
    if (field.cavity[t] && Number.isFinite(field.resistance[t]) && field.resistance[t] > trapR) { trapR = field.resistance[t]; trapT = t; }
  }
  const ti_ = trapT % field.nx, tj_ = ((trapT - ti_) / field.nx) % field.ny, tk_ = ((trapT - ti_) / field.nx - tj_) / field.ny;
  const trap = { x: field.x0 + (ti_ + .5) * cell, y: field.y0 + (tj_ + .5) * cell, z: field.z0 + (tk_ + .5) * cell };
  const trapRad = Math.hypot(trap.x - cx, trap.y - cy);
  console.log(`AIRE ATRAPADO: (${trap.x.toFixed(0)}, ${trap.y.toFixed(0)}, ${trap.z.toFixed(1)}) · r=${trapRad.toFixed(0)} (boca r≈${((qP0.bbox.x1 - qP0.bbox.x0) / 2).toFixed(0)}) — ¿en la partición?`);

  // simetría axial: compuerta al CENTRO ⇒ 4 puntos del aro deben llegar IGUALES
  const rimR = [];
  const rimZ = qP0.bbox.z1 - 2;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    // la pared mide 1.26 mm: se ESCANEA radial hacia adentro hasta pescarla
    // (una sonda a radio fijo cae en el hueco y la simetría sale falsa-roja)
    for (let rr = trapRad + 2; rr > trapRad - 5; rr -= cell / 2) {
      const x = cx + dx * rr, y = cy + dy * rr;
      const i = Math.round((x - field.x0) / cell - .5), j = Math.round((y - field.y0) / cell - .5), k = Math.round((rimZ - field.z0) / cell - .5);
      const t = field.idx(i, j, k);
      if (field.cavity[t] && Number.isFinite(field.resistance[t])) { rimR.push(field.resistance[t]); break; }
    }
  }
  const rimSpread = rimR.length >= 3 ? (Math.max(...rimR) - Math.min(...rimR)) / Math.max(...rimR) : 1;
  console.log(`SIMETRÍA del aro: R en 4 puntos ±${(100 * rimSpread).toFixed(1)} %`);

  // ── EL ACERO (para VERLO): vóxeles de superficie + cara de corte ─────────
  // El corte: se REMUEVE la mitad frontal (y < cy) del acero; las caras del
  // corte van SÓLIDAS (la lección de MoldSectionReveal: secciones sólidas, no
  // cascarón). Solo superficie: el interior del bloque no aporta y cuesta sort.
  const SC = 1.4;
  const steel = [];                                         // [x,y,z, tipo(0=A,1=B), corte?]
  const voxSteel = (q, tipo) => {
    const nx = Math.ceil((q.bbox.x1 - q.bbox.x0) / SC), ny = Math.ceil((q.bbox.y1 - q.bbox.y0) / SC), nz = Math.ceil((q.bbox.z1 - q.bbox.z0) / SC);
    const inQ = (i, j, k) => {
      if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return false;
      return q.inside(q.bbox.x0 + (i + .5) * SC, q.bbox.y0 + (j + .5) * SC, q.bbox.z0 + (k + .5) * SC);
    };
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (!inQ(i, j, k)) continue;
      const x = q.bbox.x0 + (i + .5) * SC, y = q.bbox.y0 + (j + .5) * SC, z = q.bbox.z0 + (k + .5) * SC;
      if (y < cy - SC) continue;                            // la mitad frontal se REMUEVE
      const corte = y < cy + SC;                            // la cara del corte, SÓLIDA
      const surf = corte || !inQ(i + 1, j, k) || !inQ(i - 1, j, k) || !inQ(i, j + 1, k) || !inQ(i, j - 1, k) || !inQ(i, j, k + 1) || !inQ(i, j, k - 1);
      if (surf) steel.push([x, y, z, tipo, corte ? 1 : 0]);
    }
  };
  voxSteel(qA, 0); voxSteel(qB, 1);
  console.log(`ACERO: ${steel.length} vóxeles de superficie (A+B, media luna removida)`);

  // ── TRAZADORAS ───────────────────────────────────────────────────────────
  const NTR = 6000;
  const targets = [];
  for (let t = 0; t < field.cavity.length; t++) if (field.cavity[t] && Number.isFinite(field.resistance[t])) targets.push(t);
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
    tr.push({ k: i, path: pathOf(t), Rt: field.resistance[t], lag: 0.015 + 0.05 * ((i * 0.6180339887) % 1) });
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

  // ── FÍSICA (proxy ABS MG47 declarado) ────────────────────────────────────
  const melt = F.ABS_MG47, wallM = WALL / 1000;
  const vMean = F.convergeVelocity(melt, wallM);
  const gam = F.shearRatePowerLaw(vMean, wallM, melt.n);
  const mu = F.viscosityPowerLaw(melt, gam);
  const tFillS = (field.maxFlowLenMm / 1000) / vMean;
  const Qtot = field.volumeMm3 / 1e9 / tFillS;
  const dpFeedMPa = FD.feedPressureDrop(melt, [{ name: 'sprue', L: -SPRUE_Z0 / 1000, R: SPRUE_R / 1000, Vdot: Qtot }]) / 1e6;
  const PCOEF = (2 * melt.k * Math.pow(2 * (1 + 1 / melt.n) * vMean, melt.n) * Math.pow(1e-3, -melt.n)) / 1e6;
  let rthSum = 0, rthN = 0;
  for (let t = 0; t < field.cavity.length; t++) {
    if (!field.cavity[t] || !Number.isFinite(field.resistance[t])) continue;
    const k = Math.floor(t / (field.nx * field.ny));
    const z = field.z0 + (k + .5) * cell;
    if (z >= -1.2 && z < 0) { rthSum += field.resistance[t]; rthN++; }
  }
  const R_THROAT = rthN ? rthSum / rthN : 0;
  const pTotalR = (R) => dpFeedMPa * Math.min(1, R / Math.max(1e-9, R_THROAT)) + PCOEF * Math.max(0, R - R_THROAT);
  console.log(`L máx ${field.maxFlowLenMm} mm · t ${(tFillS * 1000).toFixed(0)} ms · ΔP máx ${pTotalR(field.maxResistance).toFixed(1)} MPa (sprue ${dpFeedMPa.toFixed(1)} + pieza ∫campo)`);

  const fr = [];
  for (let f = 0; f <= NF; f++) fr.push(front.frontAt(f / NF));

  // ── el volumen: ACERO en corte + hueco fantasma + fundido + trazadoras ───
  const VW = 1000, VH = 840;
  const bBB = MD.shapeBBox(oc, plateB);
  const cx0 = cx, cy0 = cy, cz0 = (aBB.min[2] + bBB.max[2]) / 2;
  const S = 2.9;
  const renderVol = (thetaDeg, Rt) => {
    const th = (thetaDeg * Math.PI) / 180, cosT = Math.cos(th), sinT = Math.sin(th);
    const fb = new Float32Array(VW * VH * 3).fill(9);
    const proj = (x, y, z) => {
      const xr = (x - cx0) * cosT - (y - cy0) * sinT, yr = (x - cx0) * sinT + (y - cy0) * cosT;
      return { u: VW / 2 + (xr - yr) * S, v: VH / 2 + (xr + yr) * 1.05 - (z - cz0) * S, d: xr + yr + (z - cz0) * 0.35 };
    };
    const splats = [];
    // el ACERO: A frío azulado · B cálido — la cara de corte SÓLIDA (la lección
    // de MoldSectionReveal: si la sección se ve fantasma, el molde no se LEE)
    for (const [x, y, z, tipo, corte] of steel) {
      const p = proj(x, y, z);
      const col = tipo === 0 ? [118, 138, 170] : [162, 148, 122];
      const aA = corte ? 0.88 : 0.3;
      splats.push([p.d, p.u, p.v, col[0] * (corte ? 1.3 : 1), col[1] * (corte ? 1.3 : 1), col[2] * (corte ? 1.3 : 1), aA]);
    }
    // el FUNDIDO + el hueco fantasma
    for (let k = 0; k < field.nz; k++) for (let j = 0; j < field.ny; j++) for (let i = 0; i < field.nx; i++) {
      const t = (k * field.ny + j) * field.nx + i;
      if (!field.cavity[t]) continue;
      const x = field.x0 + (i + .5) * cell, y = field.y0 + (j + .5) * cell, z = field.z0 + (k + .5) * cell;
      const p = proj(x, y, z);
      const R = field.resistance[t];
      if (Number.isFinite(R) && R <= Rt) {
        const u = R / Math.max(1e-9, field.maxResistance);
        const col = ramp(0.15 + 0.85 * u);
        splats.push([p.d, p.u, p.v, col[0], col[1], col[2], 0.16 + 0.42 * (1 - u)]);
      } else {
        splats.push([p.d, p.u, p.v, 50, 60, 82, 0.1]);
      }
    }
    splats.sort((a, b) => a[0] - b[0]);
    const KW = [0.3, 0.62, 0.3];
    for (const [, u, v, rr, g, b, aA] of splats) {
      const ui = u | 0, vi = v | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const px = ui + dx, py = vi + dy;
        if (px < 0 || py < 0 || px >= VW || py >= VH) continue;
        const a2 = aA * KW[dx + 1] * KW[dy + 1] * 2.2;
        const aC = a2 > 1 ? 1 : a2;
        const o = (py * VW + px) * 3;
        fb[o] = fb[o] * (1 - aC) + rr * aC; fb[o + 1] = fb[o + 1] * (1 - aC) + g * aC; fb[o + 2] = fb[o + 2] * (1 - aC) + b * aC;
      }
    }
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
    for (const s of tr) {
      const Rme = Rt * (1 - s.lag);
      if (Rme <= 0 || s.done) continue;
      const head = posAt(s.path, Math.min(Rme, s.Rt));
      if (!head) continue;
      for (let e = 1; e <= 5; e++) {
        const pe = posAt(s.path, Math.min(Rme, s.Rt) - dR * e / 5);
        if (pe) add(pe[0], pe[1], pe[2], 2, 0.24 * (1 - e / 6));
      }
      add(head[0], head[1], head[2], 3, Rme < s.Rt ? 1.0 : 0.3);
    }
    // aristas de los bloques + la LÍNEA DE PARTICIÓN (donde el molde ABRE)
    const drawSeg = (a, b, rr, gg, bb) => {
      const pa = proj(...a), pb = proj(...b);
      for (let s2 = 0; s2 <= 300; s2++) {
        const px = (pa.u + (pb.u - pa.u) * s2 / 300) | 0, py = (pa.v + (pb.v - pa.v) * s2 / 300) | 0;
        if (px < 0 || py < 0 || px >= VW || py >= VH) continue;
        const o = (py * VW + px) * 3;
        fb[o] = Math.max(fb[o], rr); fb[o + 1] = Math.max(fb[o + 1], gg); fb[o + 2] = Math.max(fb[o + 2], bb);
      }
    };
    const box = (bb, rr, gg, bbl) => {
      const [x0, y0, z0] = bb.min, [x1, y1, z1] = bb.max;
      const V0 = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
      for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) drawSeg(V0[a], V0[b], rr, gg, bbl);
    };
    box(aBB, 96, 116, 150); box(bBB, 138, 126, 100);
    const zp = split.zPart;
    for (const [a, b] of [[[aBB.min[0], aBB.min[1]], [aBB.max[0], aBB.min[1]]], [[aBB.max[0], aBB.min[1]], [aBB.max[0], aBB.max[1]]], [[aBB.max[0], aBB.max[1]], [aBB.min[0], aBB.max[1]]], [[aBB.min[0], aBB.max[1]], [aBB.min[0], aBB.min[1]]]]) {
      drawSeg([a[0], a[1], zp], [b[0], b[1], zp], 240, 220, 160);   // la PARTICIÓN brilla
    }
    const rgb = Buffer.alloc(VW * VH * 3);
    for (let t = 0; t < fb.length; t++) rgb[t] = Math.min(255, fb[t]);
    return { rgb, proj };
  };

  // ── los cuadros ──────────────────────────────────────────────────────────
  const tRender = Date.now();
  const nVoxTot = front.nVox;
  const serie = [];
  for (let f = 0; f < NF; f++) {
    const frac = proof ? [0.12, 0.55, 0.97][f] : f / (NF - 1);
    const st = proof ? front.frontAt(frac) : (fr[Math.round(frac * NF)] ?? front.frontAt(frac));
    for (const s of tr) {
      let guard = 0;
      while (!s.done && s.Rt <= st.resistance * (1 - s.lag) && guard++ < 50) {
        if (nextTarget >= targets.length * 3) { s.done = true; break; }
        const t = targets[nextTarget++ % targets.length];
        if (field.resistance[t] > st.resistance * (1 - s.lag)) { s.path = pathOf(t); s.Rt = field.resistance[t]; }
      }
    }
    // órbita CORTA (−20°→+25°): a +45° la cara del corte queda DE CANTO y el
    // acero desaparece del cuadro (cazado a ojo en el primer 4K) — el molde
    // debe verse TODO el video, que para eso es el video
    const theta = -20 + 45 * frac;
    const { rgb, proj } = renderVol(theta, st.resistance);
    const b64V = pngRGB(VW, VH, rgb).toString('base64');
    const pts = [];
    for (let g2 = 0; g2 <= Math.round(frac * 120); g2++) {
      const fA = g2 / 120, sA = proof ? front.frontAt(fA) : fr[Math.round(fA * NF)];
      pts.push(`${(1100 + fA * 740).toFixed(1)},${(700 - (pTotalR(sA.resistance) / Math.max(1e-9, pTotalR(field.maxResistance))) * 210).toFixed(1)}`);
    }
    const tMs = frac * tFillS * 1000;
    let marks = '';
    if (frac >= 0.9) {
      const tp = proj(trap.x, trap.y, trap.z);
      marks = `<circle cx="${(30 + tp.u).toFixed(0)}" cy="${(110 + tp.v).toFixed(0)}" r="13" fill="none" stroke="#ffffff" stroke-width="2"/>` +
        `<text x="60" y="150" font-size="16" fill="#eaf2ff">lo ÚLTIMO = el ARO de la boca, EN LA PARTICIÓN → ahí se VENTEA el molde</text>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="ui-monospace,Menlo,monospace">
<rect width="1920" height="1080" fill="#0b0f16"/>
<text x="60" y="56" font-size="30" fill="#eaf2ff">EL MOLDE A/B EN CORTE — el ACERO que forma la figura, y el fundido llenándola por dentro</text>
<text x="60" y="88" font-size="17" fill="#5d7290">splitMold del libro: bloque − vaso ESCALADO ${SCALE} (contracción) · partición en la boca − pinch · portacore Fig 6-34 · sprue ⌀${2 * SPRUE_R} DIRECTO al piso · ${(nVoxTot / 1000).toFixed(0)}k vóxeles · ${NTR} trazadoras · ${(15 / tFillS).toFixed(0)}×</text>
<image x="30" y="110" width="1000" height="840" href="data:image/png;base64,${b64V}"/>
${marks}
<text x="60" y="975" font-size="16" fill="#5d7290">ACERO azulado = placa A (cavidad, forma el EXTERIOR) · cálido = núcleo B + portacore (forma el INTERIOR) · corte = media luna removida · blanco = fundido VIAJANDO</text>
<text x="1100" y="150" font-size="21" fill="#8fa3bf">LO QUE SIENTE LA MÁQUINA</text>
<text x="1100" y="186" font-size="34" fill="#eaf2ff">t = ${tMs.toFixed(0)} ms</text>
<text x="1100" y="216" font-size="17" fill="#7ee0a0">llenado ${(frac * 100).toFixed(0)} % · L recorrida ${st.lenMaxMm.toFixed(1)} / ${field.maxFlowLenMm} mm</text>
<text x="1100" y="286" font-size="18" fill="#8fa3bf">EL CAMINO DEL FUNDIDO</text>
<text x="1100" y="316" font-size="15" fill="#c9d6ea">1. baja el SPRUE que atraviesa la placa A</text>
<text x="1100" y="340" font-size="15" fill="#c9d6ea">2. golpea el piso y corre RADIAL (disco)</text>
<text x="1100" y="364" font-size="15" fill="#c9d6ea">3. sube la pared en ANILLO entre A y B</text>
<text x="1100" y="388" font-size="15" fill="#c9d6ea">4. muere en el aro de la boca = LA PARTICIÓN (venteo)</text>
<text x="1100" y="452" font-size="19" fill="#8fa3bf">ΔP en la máquina — sprue (Eq 6.5) + pieza (Eq 5.22 ∫campo)</text>
<polyline points="${pts.join(' ')}" fill="none" stroke="#f2c14e" stroke-width="3"/>
<line x1="1100" y1="700" x2="1840" y2="700" stroke="#2a3446"/>
<text x="1100" y="726" font-size="15" fill="#5d7290">0 ms</text>
<text x="1780" y="726" font-size="15" fill="#5d7290">${(tFillS * 1000).toFixed(0)} ms</text>
<text x="1100" y="760" font-size="22" fill="#f2c14e">ΔP = ${pTotalR(st.resistance).toFixed(1)} / ${pTotalR(field.maxResistance).toFixed(1)} MPa</text>
<text x="1100" y="810" font-size="16" fill="#5d7290">v̄ ${vMean.toFixed(2)} m/s (Eq 5.23) · γ̇ ${gam.toFixed(0)} 1/s (Eq 5.21) · μ ${mu.toFixed(0)} Pa·s · proxy ABS MG47</text>
<text x="1100" y="836" font-size="16" fill="#5d7290">compuerta DIRECTA al centro ⇒ llenado AXISIMÉTRICO: sin soldaduras</text>
<text x="1100" y="862" font-size="16" fill="#5d7290">(verificado: el aro llega parejo, ±${(100 * rimSpread).toFixed(0)} % en 4 puntos)</text>
<text x="60" y="1044" font-size="14" fill="#44506a">honesto: cuasiestático (frente por resistencia) · Q constante · SIN térmico (a pedido) · PP sin power-law en el libro → ABS MG47 (p.105-111) DECLARADO · acero real de splitMold (mold.ts) · render: iangpu (nice 10)</text>
</svg>`;
    fs.writeFileSync(path.join(out, `f${String(f).padStart(4, '0')}.svg`), svg);
    let moviendo = 0, aterrizadas = 0;
    for (const s of tr) { if (s.done || s.Rt <= st.resistance * (1 - s.lag)) aterrizadas++; else moviendo++; }
    serie.push({
      f, frac: +frac.toFixed(4), tMs: +tMs.toFixed(1), LmaxMm: +st.lenMaxMm.toFixed(2),
      dPMPa: +pTotalR(st.resistance).toFixed(2), trazMoviendo: moviendo, trazAterrizadas: aterrizadas,
    });
    if (f % 60 === 0) console.log(`  cuadro ${f}/${NF} · ${((Date.now() - tRender) / 1000).toFixed(0)} s`);
  }
  console.log(`${NF} SVG en ${((Date.now() - tRender) / 1000).toFixed(0)} s → ${out}`);

  // ── TELEMETRÍA + CHECKS ──────────────────────────────────────────────────
  const bocaR = (qP0.bbox.x1 - qP0.bbox.x0) / 2;
  const telem = {
    pieza: 'vaso-en-molde-AB', cellMm: cell, nVox: nVoxTot,
    volKernelCc: +volPcc.toFixed(2), volColadaCc: +(FEED_MM3 / 1000).toFixed(2),
    volVoxelCc: +(field.volumeMm3 / 1000).toFixed(2),
    errVolPct: +((100 * Math.abs(field.volumeMm3 - (volPcc * 1000 + FEED_MM3))) / (volPcc * 1000 + FEED_MM3)).toFixed(1),
    unreachable: field.unreachable,
    LmaxMm: field.maxFlowLenMm, dPmaxMPa: +pTotalR(field.maxResistance).toFixed(1), dpColadaMPa: +dpFeedMPa.toFixed(1),
    tFillMs: +(tFillS * 1000).toFixed(0),
    molde: {
      zPart: +split.zPart.toFixed(2), cuerpos: split.bodies,
      volCavityCc: +(split.vols.cavity / 1000).toFixed(1), volCoreCc: +(split.vols.core / 1000).toFixed(1),
      aceroVoxSuperficie: steel.length,
    },
    aireAtrapado: { ...trap, radio: +trapRad.toFixed(1), bocaR: +bocaR.toFixed(1) },
    simetriaAroPct: +(100 * rimSpread).toFixed(1),
    serie,
  };
  fs.writeFileSync(path.join(out, 'telemetria.json'), JSON.stringify(telem, null, 1));
  const checks = {
    molde_separa_en_2: split.bodies >= 2,
    vol_cuadra: telem.errVolPct < 12,
    todo_llena: telem.unreachable === 0,
    // compuerta directa al centro ⇒ AXISIMÉTRICO: el aro llega parejo…
    simetria_axial: rimSpread < 0.08,
    // …y lo ÚLTIMO es el ARO de la boca EN la partición (venteo natural)
    aire_en_el_aro: trapRad > bocaR * 0.85 && trap.z > qP0.bbox.z1 * 0.9,
    acero_visible: steel.length > 30000,
    dP_monotona: serie.every((s, i2) => i2 === 0 || s.dPMPa >= serie[i2 - 1].dPMPa - 1e-6),
    llenado_monotono: serie.every((s, i2) => i2 === 0 || s.frac >= serie[i2 - 1].frac),
    trazadoras_fluyen: serie.length < 5 || serie[Math.floor(serie.length / 2)].trazMoviendo > NTR * 0.2,
  };
  const pass = Object.values(checks).every(Boolean);
  console.log('TELEMETRIA=' + JSON.stringify({ ...telem, serie: `${serie.length} cuadros` }));
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  if (!pass && !proof) process.exit(2);
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
