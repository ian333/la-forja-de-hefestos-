/**
 * LA INYECCIÓN EN 3D v3 — EL MOLDE FAMILIA: vaso + tapa en UN molde.
 * ============================================================================
 * "ahora haz el del vaso, hay un molde sencillo con 2 figuras me parece"
 * (user 2026-07-17). Las 2 figuras del kernel que EMBONAN por una sola cota
 * (tupperRecipe ⌀140×65 + lidRecipe ⌀140.6×12, tupper.ts) en un molde familia
 * de colada fría: sprue al centro → runner a las DOS cavidades.
 *
 * LA LECCIÓN DE ESTE VIDEO (la que el molde familia trae de fábrica):
 * la TAPA es más corta y su recorrido es menor ⇒ TERMINA de llenar antes que el
 * vaso. Desde ese instante la tapa SOBRE-EMPACA (flash, sobrepeso) mientras el
 * vaso sigue llenando — el problema clásico del molde familia, y la razón de que
 * §6.4.5 BALANCEE los runners (Eq 6.8/6.9: adelgazar la rama de la cavidad
 * rápida para frenarla). El HUD muestra las dos barras de avance y calcula la
 * rama balanceada con la Eq 6.8 del libro.
 *
 * SOLDADURAS DE UNA COMPUERTA: cada pieza se alimenta por UN punto del borde ⇒
 * el frente ABRAZA el cilindro y se reencuentra del lado opuesto. computeWeldMask
 * ahora también detecta ese caso (vecinos con L de recorrido MUY distinta) y la
 * costura se enciende cian en el momento del encuentro.
 *
 * MATERIAL: las piezas son PP (tupper real). El libro NO da power-law del PP —
 * el flujo corre con la resina del ejemplo resuelto (ABS MG47, p.105-111) como
 * PROXY DECLARADO en pantalla. Nada inventado: falta el dato, se dice.
 *
 * Honesto: cuasiestático, Q cte, T_melt uniforme. Colada fría R4/R3/⌀3 (típicos
 * cap 6, declarados). Uso: node --import tsx scripts/inyeccion-vaso-video.cjs <out> [--proof]
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
  const out = process.argv[2] || '/tmp/inyvz';
  const proof = process.argv.includes('--proof');
  const NF = proof ? 3 : 360;
  fs.mkdirSync(out, { recursive: true });

  const oc = await require(cjsGlue)({ wasmBinary: fs.readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const K = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const TL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'timeline.ts'));
  const TP = await import(path.join(ROOT, 'src', 'forja', 'mold', 'parts', 'tupper.ts'));
  const FL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen.ts'));
  const FM = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen-mesh.ts'));
  const F = await import(path.join(ROOT, 'src', 'forja', 'mold', 'filling.ts'));
  const FD = await import(path.join(ROOT, 'src', 'forja', 'mold', 'feed.ts'));

  // ── LAS DOS FIGURAS (kernel): el vaso y SU tapa ──────────────────────────
  const P = TP.TUPPER_DEFAULT;
  const WALL = P.wallMm;                                    // 1.2 — la MISMA pared en las dos
  const rV = TL.rebuild(K, oc, TP.tupperRecipe().timeline);
  const rT = TL.rebuild(K, oc, TP.lidRecipe().timeline);
  if (!rV.shape || !rT.shape) { console.error('sin sólido'); process.exit(1); }
  const volVcc = rV.measure.volumeMm3 / 1000, volTcc = rT.measure.volumeMm3 / 1000;
  const qV = FM.solidFromMesh(K.tessellate(oc, rV.shape, 0.25, 0.25));
  const qT = FM.solidFromMesh(K.tessellate(oc, rT.shape, 0.25, 0.25));
  const cV = { x: (qV.bbox.x0 + qV.bbox.x1) / 2, y: (qV.bbox.y0 + qV.bbox.y1) / 2 };
  const cT = { x: (qT.bbox.x0 + qT.bbox.x1) / 2, y: (qT.bbox.y0 + qT.bbox.y1) / 2 };
  const RV = (qV.bbox.x1 - qV.bbox.x0) / 2, RT = (qT.bbox.x1 - qT.bbox.x0) / 2;
  // cavidades lado a lado, sprue al CENTRO del molde (simetría del cap 6)
  const VX = -(RV + 42), TX = RT + 42;
  console.log(`VASO kernel ⌀${(2 * RV).toFixed(1)}×${qV.bbox.z1.toFixed(0)} · ${volVcc.toFixed(2)} cc | TAPA ⌀${(2 * RT).toFixed(1)}×${qT.bbox.z1.toFixed(0)} · ${volTcc.toFixed(2)} cc (PP · flujo con ABS MG47 como PROXY declarado)`);

  // ── LA COLADA FRÍA (típicos cap 6, declarados): sprue R4 → runner R3 → ⌀3 ─
  // compuerta al borde del PISO de cada pieza — 4 mm adentro del radio: el draft
  // (1.5° × 65 mm) angosta la base del vaso ~1.7 mm y una garganta al radio pelón
  // quedaría MEDIO en el acero
  const GATE = [{ x: VX + RV - 4, y: 0 }, { x: TX - RT + 4, y: 0 }];
  const SPRUE_Z0 = -20;
  const inFeed = (x, y, z) => {
    if (z >= 0) return false;
    if (z >= -20 && z <= -8 && x * x + y * y <= 16) return true;                          // sprue R4
    if (x >= GATE[0].x && x <= GATE[1].x && y * y + (z + 5) ** 2 <= 9) return true;       // runner R3
    for (const g of GATE) {
      if (z >= -5 && z <= -1.5 && (x - g.x) ** 2 + y * y <= 9) return true;               // bajada R3
      if (z > -1.5 && (x - g.x) ** 2 + y * y <= 2.25) return true;                        // garganta ⌀3
    }
    return false;
  };
  const FEED_MM3 = Math.PI * (16 * 12 + 9 * (GATE[1].x - GATE[0].x) + 2 * 9 * 3.5 + 2 * 2.25 * 1.5);
  const cell = 0.6;                       // pared 1.2 = 2 celdas: sin esto el cascarón infla ~15 %
  const inPieza = (x, y, z) => {
    if (x < 0) return qV.inside(x - VX + cV.x, y + cV.y, z);
    return qT.inside(x - TX + cT.x, y + cT.y, z);
  };

  const t0 = Date.now();
  const field = FL.measureFlowLength({
    x0: VX - RV - 3, y0: -RV - 3, z0: SPRUE_Z0 - 1, x1: TX + RT + 3, y1: RV + 3, z1: qV.bbox.z1 + 1,
    cellMm: cell, gateMm: { x: 0, y: 0, z: SPRUE_Z0 + 0.5 },
    inCavity: (x, y, z) => inFeed(x, y, z) || inPieza(x, y, z),
    rootOfMm: (x, y, z) => {
      if (z <= -1.6 || z >= 0) return -1;
      for (let g = 0; g < GATE.length; g++) if ((x - GATE[g].x) ** 2 + y * y <= 2.25) return g;
      return -1;
    },
    wallMm: WALL, meltN: 0.348, expectVolumeMm3: (volVcc + volTcc) * 1000 + FEED_MM3,
  });
  const front = FL.createFlowFront(field);
  console.log(`CAMPO: ${field.nx}×${field.ny}×${field.nz} celdas ${cell} mm · ${Date.now() - t0} ms · sin llenar ${field.unreachable}`);
  for (const w of field.warnings) console.log(`  AVISO: ${w}`);

  // ── SOLDADURAS DE UNA COMPUERTA: el frente se reencuentra tras abrazar ───
  // el cilindro (ΔL entre vecinos > 25 mm = llegaron por caminos opuestos)
  const weldInfo = FL.computeWeldMask(field, { sameGateDeltaLMm: 25 });
  const weldPts = [];
  const weldStats = [{ n: 0, minR: Infinity, pt: null }, { n: 0, minR: Infinity, pt: null }];
  for (let t = 0; t < field.cavity.length; t++) {
    if (!weldInfo.weld[t]) continue;
    const i = t % field.nx, j = ((t - i) / field.nx) % field.ny, k = ((t - i) / field.nx - j) / field.ny;
    const x = field.x0 + (i + .5) * cell, z = field.z0 + (k + .5) * cell;
    if (z < 0) continue;
    weldPts.push(t);
    const g = x < 0 ? 0 : 1;
    weldStats[g].n++;
    if (weldInfo.weldR[t] < weldStats[g].minR) {
      weldStats[g].minR = weldInfo.weldR[t];
      weldStats[g].pt = { x, y: field.y0 + (j + .5) * cell, z, R: weldInfo.weldR[t] };
    }
  }
  console.log(`SOLDADURA vaso: ${weldStats[0].n} vóxeles (1ª en ${weldStats[0].pt ? weldStats[0].pt.x.toFixed(0) + ',' + weldStats[0].pt.y.toFixed(0) : '—'}) · tapa: ${weldStats[1].n}`);
  // la costura debe caer del lado OPUESTO a la compuerta (y≈0, x al otro lado)

  // ── el problema del MOLDE FAMILIA: cuándo termina cada figura ────────────
  const perRoot = [{ vox: 0, maxR: 0 }, { vox: 0, maxR: 0 }];
  for (let t = 0; t < field.cavity.length; t++) {
    if (!field.cavity[t] || !Number.isFinite(field.resistance[t]) || field.root[t] < 0) continue;
    const k = Math.floor(t / (field.nx * field.ny));
    if (field.z0 + (k + .5) * cell < 0) continue;
    const g = field.root[t];
    perRoot[g].vox++;
    if (field.resistance[g === 0 || g === 1 ? t : t] > perRoot[g].maxR) perRoot[g].maxR = field.resistance[t];
  }
  // trampa de aire por cavidad = el vóxel de max resistencia de cada root
  const traps = [null, null];
  for (let t = 0; t < field.cavity.length; t++) {
    if (!field.cavity[t] || !Number.isFinite(field.resistance[t]) || field.root[t] < 0) continue;
    const g = field.root[t];
    if (Math.abs(field.resistance[t] - perRoot[g].maxR) < 1e-9) {
      const i = t % field.nx, j = ((t - i) / field.nx) % field.ny, k = ((t - i) / field.nx - j) / field.ny;
      traps[g] = { x: field.x0 + (i + .5) * cell, y: field.y0 + (j + .5) * cell, z: field.z0 + (k + .5) * cell };
    }
  }

  // ── TRAZADORAS (6000) por el árbol real ──────────────────────────────────
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

  // ── FÍSICA cap 5 + 6 (ABS MG47 como PROXY del PP — declarado) ────────────
  const melt = F.ABS_MG47, wallM = WALL / 1000;
  const vMean = F.convergeVelocity(melt, wallM);
  const gam = F.shearRatePowerLaw(vMean, wallM, melt.n);
  const mu = F.viscosityPowerLaw(melt, gam);
  const pAt = (Lmm) => F.pressureDropSegment(melt, Lmm / 1000, wallM, vMean) / 1e6;
  const tFillS = (field.maxFlowLenMm / 1000) / vMean;
  const Qtot = field.volumeMm3 / 1e9 / tFillS;
  const L_RAMA = (GATE[1].x - GATE[0].x) / 2 / 1000;        // media rama del runner (m)
  const SEGS = [
    { name: 'sprue', L: 0.012, R: 0.004, Vdot: Qtot },
    { name: 'runner', L: L_RAMA, R: 0.003, Vdot: Qtot / 2 },
    { name: 'bajada', L: 0.0035, R: 0.003, Vdot: Qtot / 2 },
  ];
  const dpFeedMPa = FD.feedPressureDrop(melt, SEGS) / 1e6;
  let thSum = 0, thN = 0;
  for (let t = 0; t < field.cavity.length; t++) {
    if (!field.cavity[t] || field.root[t] < 0 || !Number.isFinite(field.resistance[t])) continue;
    const i = t % field.nx, k = Math.floor(t / (field.nx * field.ny));
    const z = field.z0 + (k + .5) * cell;
    if (z >= -1.6 && z < 0) { thSum += field.flowLenMm[t]; thN++; }
  }
  const L_THROAT = thN ? thSum / thN : 0;
  // ΔP de PIEZA por la INTEGRAL DEL CAMPO, no por una L de placa: Eq 5.22 dice
  // ΔP = 2k·[2(1+1/n)v̄]^n · ∫dL/H^(1+n) — y esa integral ES la resistencia del
  // Dijkstra (por eso el race tracking del cordón de la esquina, que ALARGA la L
  // pero ABARATA el paso, queda contado BIEN y no sobreestimado).
  const PCOEF = (2 * melt.k * Math.pow(2 * (1 + 1 / melt.n) * vMean, melt.n) * Math.pow(1e-3, -melt.n)) / 1e6;
  let rthSum = 0, rthN = 0;
  for (let t = 0; t < field.cavity.length; t++) {
    if (!field.cavity[t] || field.root[t] < 0 || !Number.isFinite(field.resistance[t])) continue;
    const k = Math.floor(t / (field.nx * field.ny));
    const z = field.z0 + (k + .5) * cell;
    if (z >= -1.6 && z < 0) { rthSum += field.resistance[t]; rthN++; }
  }
  const R_THROAT = rthN ? rthSum / rthN : 0;
  const pTotalR = (R) => dpFeedMPa * Math.min(1, R / Math.max(1e-9, R_THROAT)) + PCOEF * Math.max(0, R - R_THROAT);
  // BALANCEO §6.4.5 (Eq 6.8): la tapa termina antes ⇒ su rama debe FRENARLA.
  // ΔP faltante en la rama de la tapa = ΔP(pieza vaso) − ΔP(pieza tapa); el radio
  // que la absorbe sale de Eq 6.8 con el gasto de ESA rama. Estimación declarada.
  const dPpV = PCOEF * Math.max(0, perRoot[0].maxR - R_THROAT), dPpT = PCOEF * Math.max(0, perRoot[1].maxR - R_THROAT);
  const dpRamaActual = (FD.pressureDropRunner(melt, SEGS[1]) + FD.pressureDropRunner(melt, SEGS[2])) / 1e6;
  const rBal = FD.minRunnerRadius(melt, L_RAMA + 0.0035, Qtot / 2, (dpRamaActual + (dPpV - dPpT)) * 1e6) * 1000;
  console.log(`FAMILIA: ΔP pieza vaso ${dPpV.toFixed(1)} vs tapa ${dPpT.toFixed(1)} MPa → rama de tapa balanceada (Eq 6.8): R ${rBal.toFixed(2)} mm (actual 3.00)`);
  console.log(`L máx ${field.maxFlowLenMm} mm (colada ${L_THROAT.toFixed(0)}) · t_llenado ${(tFillS * 1000).toFixed(0)} ms · ΔP máx ${pTotalR(field.maxResistance).toFixed(1)} MPa = colada ${dpFeedMPa.toFixed(1)} + pieza ∫dL/H^(1+n) del campo`);

  const fr = [];
  for (let f = 0; f <= NF; f++) fr.push(front.frontAt(f / NF));

  // ── el volumen (splats suaves + soldadura cian + trazadoras aditivas) ────
  const VW = 1000, VH = 840;
  const cx0 = (VX - RV + TX + RT) / 2, cy0 = 0, cz0 = (SPRUE_Z0 + qV.bbox.z1) / 2;
  const S = 2.15;                                           // molde ancho: 2 cavidades
  const aguaY = [-52, 0, 52];
  const renderVol = (thetaDeg, Rt) => {
    const th = (thetaDeg * Math.PI) / 180, cosT = Math.cos(th), sinT = Math.sin(th);
    const fb = new Float32Array(VW * VH * 3).fill(9);
    const proj = (x, y, z) => {
      const xr = (x - cx0) * cosT - (y - cy0) * sinT, yr = (x - cx0) * sinT + (y - cy0) * cosT;
      return { u: VW / 2 + (xr - yr) * S, v: VH / 2 + (xr + yr) * 1.15 - (z - cz0) * S, d: xr + yr + (z - cz0) * 0.35 };
    };
    const splats = [];
    for (let k = 0; k < field.nz; k++) for (let j = 0; j < field.ny; j++) for (let i = 0; i < field.nx; i++) {
      const t = (k * field.ny + j) * field.nx + i;
      if (!field.cavity[t]) continue;
      const x = field.x0 + (i + .5) * cell, y = field.y0 + (j + .5) * cell, z = field.z0 + (k + .5) * cell;
      const p = proj(x, y, z);
      const R = field.resistance[t];
      if (Number.isFinite(R) && R <= Rt) {
        const u = R / Math.max(1e-9, field.maxResistance);
        const col = ramp(0.15 + 0.85 * u);
        splats.push([p.d, p.u, p.v, col[0], col[1], col[2], 0.14 + 0.42 * (1 - u)]);
      } else {
        splats.push([p.d, p.u, p.v, 46, 55, 76, 0.09]);
      }
    }
    for (const lz of [-8, qV.bbox.z1 + 8]) for (const ly of aguaY) {
      for (let x = VX - RV - 12; x <= TX + RT + 12; x += cell) {
        const p = proj(x, ly, lz);
        splats.push([p.d, p.u, p.v, 64, 156, 255, 0.35]);
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
    for (const t of weldPts) {
      if (weldInfo.weldR[t] > Rt) continue;
      const i = t % field.nx, j = ((t - i) / field.nx) % field.ny, k = ((t - i) / field.nx - j) / field.ny;
      const p = proj(field.x0 + (i + .5) * cell, field.y0 + (j + .5) * cell, field.z0 + (k + .5) * cell);
      const ui = p.u | 0, vi = p.v | 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const px = ui + dx, py = vi + dy;
        if (px < 0 || py < 0 || px >= VW || py >= VH) continue;
        const o = (py * VW + px) * 3;
        fb[o] += 55; fb[o + 1] += 190; fb[o + 2] += 235;
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
    const bx0 = VX - RV - 16, bx1 = TX + RT + 16, by0 = -RV - 16, by1 = RV + 16, bz0 = SPRUE_Z0 - 4, bz1 = qV.bbox.z1 + 12;
    const V0 = [[bx0, by0, bz0], [bx1, by0, bz0], [bx1, by1, bz0], [bx0, by1, bz0], [bx0, by0, bz1], [bx1, by0, bz1], [bx1, by1, bz1], [bx0, by1, bz1]];
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) {
      const pa = proj(...V0[a]), pb = proj(...V0[b]);
      for (let s2 = 0; s2 <= 260; s2++) {
        const px = (pa.u + (pb.u - pa.u) * s2 / 260) | 0, py = (pa.v + (pb.v - pa.v) * s2 / 260) | 0;
        if (px < 0 || py < 0 || px >= VW || py >= VH) continue;
        const o = (py * VW + px) * 3;
        fb[o] = Math.max(fb[o], 52); fb[o + 1] = Math.max(fb[o + 1], 64); fb[o + 2] = Math.max(fb[o + 2], 86);
      }
    }
    const rgb = Buffer.alloc(VW * VH * 3);
    for (let t = 0; t < fb.length; t++) rgb[t] = Math.min(255, fb[t]);
    return { rgb, proj };
  };

  // ── los cuadros ──────────────────────────────────────────────────────────
  const tRender = Date.now();
  const nVoxTot = front.nVox;
  const serie = [];
  // por-cavidad: vóxeles llenos a una Rt (barras del molde familia). Un escaneo
  // por cuadro sería 22M celdas × 360: se ordena UNA vez y se busca binario.
  const rSorted = [[], []];
  for (let t = 0; t < field.cavity.length; t++) {
    if (!field.cavity[t] || field.root[t] < 0 || !Number.isFinite(field.resistance[t])) continue;
    const k = Math.floor(t / (field.nx * field.ny));
    if (field.z0 + (k + .5) * cell < 0) continue;
    rSorted[field.root[t]].push(field.resistance[t]);
  }
  const rS = rSorted.map((a) => Float64Array.from(a).sort());
  const fillOf = (g, Rt) => {
    const a = rS[g];
    let lo = 0, hi = a.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= Rt) lo = m + 1; else hi = m; }
    return lo / Math.max(1, a.length);
  };
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
    const theta = -18 + 84 * frac;
    const { rgb, proj } = renderVol(theta, st.resistance);
    const b64V = pngRGB(VW, VH, rgb).toString('base64');
    const pts = [];
    for (let g2 = 0; g2 <= Math.round(frac * 120); g2++) {
      const fA = g2 / 120, sA = proof ? front.frontAt(fA) : fr[Math.round(fA * NF)];
      pts.push(`${(1100 + fA * 740).toFixed(1)},${(700 - (pTotalR(sA.resistance) / Math.max(1e-9, pTotalR(field.maxResistance))) * 210).toFixed(1)}`);
    }
    const tMs = frac * tFillS * 1000;
    const fV = fillOf(0, st.resistance), fT = fillOf(1, st.resistance);
    // marcadores: 1ª soldadura de cada pieza + trampas de aire al final
    let marks = '';
    for (const g of [0, 1]) {
      const wp0 = weldStats[g].pt;
      if (wp0 && st.resistance >= wp0.R) {
        const wp = proj(wp0.x, wp0.y, wp0.z);
        marks += `<circle cx="${(30 + wp.u).toFixed(0)}" cy="${(110 + wp.v).toFixed(0)}" r="12" fill="none" stroke="#6fd9f2" stroke-width="2"/>`;
        if (g === 0) marks += `<text x="60" y="168" font-size="15" fill="#9fe8fa">○ cian = 1ª SOLDADURA de cada pieza (el frente rodeó el núcleo y se reencontró)</text>`;
      }
    }
    if (frac >= 0.93) for (const g of [0, 1]) {
      if (!traps[g]) continue;
      const tp = proj(traps[g].x, traps[g].y, traps[g].z);
      marks += `<circle cx="${(30 + tp.u).toFixed(0)}" cy="${(110 + tp.v).toFixed(0)}" r="12" fill="none" stroke="#ffffff" stroke-width="2"/>`;
    }
    if (frac >= 0.93) marks += `<text x="60" y="140" font-size="16" fill="#eaf2ff">○ blanco = lo ÚLTIMO de cada pieza (aire atrapado → venteo)</text>`;
    const tapaLista = fT >= 0.999;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="ui-monospace,Menlo,monospace">
<rect width="1920" height="1080" fill="#0b0f16"/>
<text x="60" y="56" font-size="30" fill="#eaf2ff">EL MOLDE FAMILIA — vaso y tapa en UN molde: la tapa TERMINA ANTES, y eso es un problema</text>
<text x="60" y="88" font-size="17" fill="#5d7290">2 figuras del kernel (⌀${(2 * RV).toFixed(0)}×${qV.bbox.z1.toFixed(0)} + ⌀${(2 * RT).toFixed(0)}×${qT.bbox.z1.toFixed(0)}, PP · flujo: ABS MG47 PROXY declarado) · colada fría R4/R3/⌀3 · ${(nVoxTot / 1000).toFixed(0)}k vóxeles · ${NTR} trazadoras · ${(15 / tFillS).toFixed(0)}×</text>
<image x="30" y="110" width="1000" height="840" href="data:image/png;base64,${b64V}"/>
${marks}
<text x="60" y="975" font-size="16" fill="#5d7290">blanco = fundido VIAJANDO · CIAN = SOLDADURA (el frente se reencuentra tras abrazar el núcleo) · ámbar→morado = orden de llegada · azul = agua</text>
<text x="1100" y="150" font-size="21" fill="#8fa3bf">LO QUE SIENTE LA MÁQUINA</text>
<text x="1100" y="186" font-size="34" fill="#eaf2ff">t = ${tMs.toFixed(0)} ms</text>
<text x="1100" y="216" font-size="17" fill="#7ee0a0">llenado ${(frac * 100).toFixed(0)} % del tiro · L recorrida ${st.lenMaxMm.toFixed(1)} / ${field.maxFlowLenMm} mm</text>
<text x="1100" y="266" font-size="19" fill="#8fa3bf">LAS DOS FIGURAS NO LLEGAN JUNTAS (el problema del molde familia)</text>
<text x="1100" y="296" font-size="16" fill="#c9d6ea">VASO ${(100 * fV).toFixed(0).padStart(3)} %</text>
<rect x="1210" y="284" width="500" height="12" fill="#1b2334"/>
<rect x="1210" y="284" width="${(500 * fV).toFixed(0)}" height="12" fill="#f2a24e"/>
<text x="1100" y="322" font-size="16" fill="${tapaLista ? '#ff7b6b' : '#c9d6ea'}">TAPA ${(100 * fT).toFixed(0).padStart(3)} %${tapaLista ? ' ← LLENA: ya SOBRE-EMPACA (flash)' : ''}</text>
<rect x="1210" y="310" width="500" height="12" fill="#1b2334"/>
<rect x="1210" y="310" width="${(500 * fT).toFixed(0)}" height="12" fill="${tapaLista ? '#ff7b6b' : '#6fd9f2'}"/>
<text x="1100" y="356" font-size="15" fill="#5d7290">§6.4.5 BALANCEO (Eq 6.8): para que lleguen JUNTAS, la rama de la tapa</text>
<text x="1100" y="378" font-size="15" fill="#5d7290">debe adelgazar a R ${rBal.toFixed(2)} mm (hoy R 3.00) — frenar a la rápida</text>
<text x="1100" y="452" font-size="19" fill="#8fa3bf">ΔP en la máquina — colada (Eq 6.5) + pieza (Eq 5.22)</text>
<polyline points="${pts.join(' ')}" fill="none" stroke="#f2c14e" stroke-width="3"/>
<line x1="1100" y1="700" x2="1840" y2="700" stroke="#2a3446"/>
<text x="1100" y="726" font-size="15" fill="#5d7290">0 ms</text>
<text x="1780" y="726" font-size="15" fill="#5d7290">${(tFillS * 1000).toFixed(0)} ms</text>
<text x="1100" y="760" font-size="22" fill="#f2c14e">ΔP = ${pTotalR(st.resistance).toFixed(1)} / ${pTotalR(field.maxResistance).toFixed(1)} MPa  (colada ${dpFeedMPa.toFixed(1)} + pieza ∫campo)</text>
<text x="1100" y="810" font-size="16" fill="#5d7290">v̄ ${vMean.toFixed(2)} m/s (Eq 5.23) · γ̇ ${gam.toFixed(0)} 1/s (Eq 5.21) · μ ${mu.toFixed(0)} Pa·s · proxy ABS MG47</text>
<text x="1100" y="836" font-size="16" fill="#5d7290">cada pieza con UNA compuerta al borde: el frente rodea el núcleo y</text>
<text x="1100" y="862" font-size="16" fill="#5d7290">se SUELDA del lado opuesto — la costura cian, como Moldflow</text>
<text x="60" y="1044" font-size="14" fill="#44506a">honesto: cuasiestático (frente por resistencia, sin inercia) · Q constante · T_melt uniforme · PP sin power-law en el libro → flujo con ABS MG47 (p.105-111) DECLARADO · colada fría R4/R3/⌀3 típicos cap 6 · render: iangpu (nice 10)</text>
</svg>`;
    fs.writeFileSync(path.join(out, `f${String(f).padStart(4, '0')}.svg`), svg);
    let moviendo = 0, aterrizadas = 0;
    for (const s of tr) { if (s.done || s.Rt <= st.resistance * (1 - s.lag)) aterrizadas++; else moviendo++; }
    let weldOn = 0;
    for (const t of weldPts) if (weldInfo.weldR[t] <= st.resistance) weldOn++;
    serie.push({
      f, frac: +frac.toFixed(4), tMs: +tMs.toFixed(1), LmaxMm: +st.lenMaxMm.toFixed(2),
      dPMPa: +pTotalR(st.resistance).toFixed(2), fillVaso: +fV.toFixed(4), fillTapa: +fT.toFixed(4),
      trazMoviendo: moviendo, trazAterrizadas: aterrizadas, weldVoxEncendidos: weldOn,
    });
    if (f % 60 === 0) console.log(`  cuadro ${f}/${NF} · ${((Date.now() - tRender) / 1000).toFixed(0)} s`);
  }
  console.log(`${NF} SVG en ${((Date.now() - tRender) / 1000).toFixed(0)} s → ${out}`);

  // ── TELEMETRÍA + CHECKS (gate ANTES del raster) ──────────────────────────
  const volVoxPieza = (perRoot[0].vox + perRoot[1].vox) * cell ** 3;
  let tapaEndCount = 0, allCount = 0;
  for (let t = 0; t < field.cavity.length; t++) {
    if (!field.cavity[t] || !Number.isFinite(field.resistance[t])) continue;
    allCount++;
    if (field.resistance[t] <= perRoot[1].maxR) tapaEndCount++;
  }
  const telem = {
    pieza: 'familia-vaso-tapa', cellMm: cell, nVox: nVoxTot,
    volKernelCc: +(volVcc + volTcc).toFixed(2), volColadaCc: +(FEED_MM3 / 1000).toFixed(2),
    volVoxelCc: +(field.volumeMm3 / 1000).toFixed(2),
    errVolPct: +((100 * Math.abs(field.volumeMm3 - ((volVcc + volTcc) * 1000 + FEED_MM3))) / ((volVcc + volTcc) * 1000 + FEED_MM3)).toFixed(1),
    unreachable: field.unreachable,
    LmaxMm: field.maxFlowLenMm, dPmaxMPa: +pTotalR(field.maxResistance).toFixed(1), dpColadaMPa: +dpFeedMPa.toFixed(1),
    tFillMs: +(tFillS * 1000).toFixed(0),
    familia: {
      volVasoCc: +volVcc.toFixed(2), volTapaCc: +volTcc.toFixed(2),
      voxVaso: perRoot[0].vox, voxTapa: perRoot[1].vox,
      dPpiezaVaso: +dPpV.toFixed(1), dPpiezaTapa: +dPpT.toFixed(1),
      ramaBalanceadaMm: +rBal.toFixed(2),
      // exacto sobre el CAMPO (no muestreado por cuadros): fracción del tiro
      // llenada cuando la tapa alcanza su último vóxel
      tapaTerminaEnFrac: +(tapaEndCount / Math.max(1, allCount)).toFixed(4),
    },
    weld: { voxVaso: weldStats[0].n, voxTapa: weldStats[1].n, primeraVaso: weldStats[0].pt, primeraTapa: weldStats[1].pt },
    aireVaso: traps[0], aireTapa: traps[1],
    serie,
  };
  fs.writeFileSync(path.join(out, 'telemetria.json'), JSON.stringify(telem, null, 1));
  const checks = {
    vol_cuadra: telem.errVolPct < 12,
    todo_llena: telem.unreachable === 0,
    dos_cavidades_alimentadas: perRoot[0].vox > 1000 && perRoot[1].vox > 1000,
    vox_por_cavidad_cuadra: Math.abs(perRoot[0].vox * cell ** 3 - volVcc * 1000) / (volVcc * 1000) < 0.15
      && Math.abs(perRoot[1].vox * cell ** 3 - volTcc * 1000) / (volTcc * 1000) < 0.15,
    // el hecho físico: la tapa alcanza su último vóxel ANTES que el vaso (su R
    // máxima es menor). El tamaño del desbalance lo dice dPpieza vaso vs tapa.
    tapa_termina_antes: perRoot[1].maxR < perRoot[0].maxR * 0.995,
    soldadura_en_ambas: weldStats[0].n > 20 && weldStats[1].n > 20,
    // la costura NO es "una línea en y=0": es el arco/Y donde el fundido del piso
    // alcanza al que rodeó la pared. El check honesto: LEJOS de su compuerta.
    soldadura_lejos_de_su_gate: !!weldStats[0].pt && Math.hypot(weldStats[0].pt.x - GATE[0].x, weldStats[0].pt.y) > RV * 0.7
      && !!weldStats[1].pt && Math.hypot(weldStats[1].pt.x - GATE[1].x, weldStats[1].pt.y) > RT * 0.7,
    balanceo_frena: rBal < 3.0,
    dP_monotona: serie.every((s, i2) => i2 === 0 || s.dPMPa >= serie[i2 - 1].dPMPa - 1e-6),
    llenado_monotono: serie.every((s, i2) => i2 === 0 || s.frac >= serie[i2 - 1].frac),
    barras_monotonas: serie.every((s, i2) => i2 === 0 || (s.fillVaso >= serie[i2 - 1].fillVaso - 1e-9 && s.fillTapa >= serie[i2 - 1].fillTapa - 1e-9)),
    trazadoras_fluyen: serie.length < 5 || serie[Math.floor(serie.length / 2)].trazMoviendo > NTR * 0.2,
    soldadura_enciende_gradual: serie.length < 5 || (serie[0].weldVoxEncendidos === 0 && serie[serie.length - 1].weldVoxEncendidos >= (weldStats[0].n + weldStats[1].n) * 0.9),
  };
  const pass = Object.values(checks).every(Boolean);
  console.log('TELEMETRIA=' + JSON.stringify({ ...telem, serie: `${serie.length} cuadros` }));
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  if (!pass && !proof) process.exit(2);
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
