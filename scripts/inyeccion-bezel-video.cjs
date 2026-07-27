/**
 * LA INYECCIÓN EN 3D v2 — el BEZEL del libro, con el fundido VIAJANDO.
 * ============================================================================
 * "AÑADE MÁS PARTÍCULAS O MÁS VECTORES, AÚN NO SE VE FLUIDO... preferiría que
 *  añadamos una figura más compleja" (user 2026-07-17). Dos upgrades:
 *
 * 1) LA PIEZA: el laptop bezel del libro — marco 240×160 con ventana 200×120,
 *    pared 1.5 mm, 7 costillas 1×10, 4 bosses ⌀6 (cotas del banco de piezas
 *    kazmer-parts-build + mold-machine-test; el material es el del ejemplo
 *    resuelto del cap 5: ABS Cycolac MG47, p.105-111). Construcción DECLARADA:
 *    placa 1.5 + costillas/bosses pasantes; sin draft ni filete (cambian el
 *    espesor local <0.2 mm y no tocan la física del llenado).
 *    Con UNA compuerta en el marco inferior los DOS frentes corren alrededor
 *    de la ventana y CHOCAN en el marco superior: la LÍNEA DE SOLDADURA emerge
 *    de la geometría, nadie la programa. (El libro alimenta este bezel con
 *    colada CALIENTE de varias caídas, p.139-144 — aquí UNA caída fría a
 *    propósito, para VER el recorrido completo y POR QUÉ el libro hace eso.)
 *
 * 2) EL FLUIDO: además del depósito por orden de llegada, TRAZADORAS que
 *    VIAJAN de verdad — parcelas de fundido que corren del bebedero al frente
 *    por el ÁRBOL DE ALIMENTACIÓN real (parent[] del Dijkstra de resistencia,
 *    flowlen.ts). Cada trazadora lleva ESTELA cuyo largo es dL/dR = H^(1+n):
 *    en pared gruesa la estela se ALARGA (corre fácil), en costilla de 1 mm se
 *    acorta — la velocidad se VE, no se rotula. Rezago por parcela: el chorro
 *    del bebedero se ve como chorro, no como un punto.
 *
 * Igual de honesto que v1: cuasiestático, Q cte, T_melt uniforme.
 * Uso: node --import tsx scripts/inyeccion-bezel-video.cjs <outdir> [--proof]
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

// ── mini-PNG + rampa (autocontenido, como v1) ────────────────────────────────
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
  const out = process.argv[2] || '/tmp/inybz';
  const proof = process.argv.includes('--proof');
  const NF = proof ? 3 : 360;
  fs.mkdirSync(out, { recursive: true });

  const oc = await require(cjsGlue)({ wasmBinary: fs.readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const K = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const FL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen.ts'));
  const FM = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen-mesh.ts'));
  const F = await import(path.join(ROOT, 'src', 'forja', 'mold', 'filling.ts'));
  const FD = await import(path.join(ROOT, 'src', 'forja', 'mold', 'feed.ts'));

  // ── EL BEZEL (cotas del banco de piezas del libro) ───────────────────────
  const WALL = 1.5;                       // pared del bezel (mold-machine-test)
  const outer = [{ x: 0, y: 0 }, { x: 240, y: 0 }, { x: 240, y: 160 }, { x: 0, y: 160 }];
  const win = [{ x: 20, y: 20 }, { x: 220, y: 20 }, { x: 220, y: 140 }, { x: 20, y: 140 }];
  let bz = K.extrudePolygonWithHoles(oc, outer, [win], WALL);
  const HTOT = WALL + 10;                 // costillas 1×10 sobre la placa (pasantes)
  for (let i = 0; i < 7; i++) {
    const x = 30 + i * 26;
    bz = K.fuse(oc, bz, K.extrudePolygon(oc, [{ x, y: 20 }, { x: x + 1, y: 20 }, { x: x + 1, y: 140 }, { x, y: 140 }], HTOT));
  }
  // bosses del banco: los izquierdos (30,·) tocan la costilla #1 y quedan unidos;
  // los derechos del banco (210,·) FLOTABAN en la ventana (el banco probaba
  // fillets, no conectividad — el voxelizado los delató: 3019 vóxeles sin camino
  // al gate). Cambio DECLARADO: se anclan a la costilla #7 (x=186), simétrico a
  // como los izquierdos tocan la #1. Una pieza desconectada no es pieza.
  for (const [cx, cy] of [[30, 30], [187, 30], [30, 130], [187, 130]]) {
    bz = K.fuse(oc, bz, K.makeCylinder(oc, 3, HTOT, { origin: [cx, cy, 0], dir: [0, 0, 1] }));
  }
  const volCc = K.volume(oc, bz) / 1000;
  const mesh = K.tessellate(oc, bz, 0.25, 0.25);
  const q = FM.solidFromMesh(mesh);
  // ── LA COLADA DEL LIBRO (p.139-144): sprue → manifold → DOS caídas ───────
  // "los canales son para distribuir" — el libro alimenta ESTE bezel con un
  // runner de DOS caídas: sprue R6, manifold R5, caídas R3.5 (los ⌀ EXACTOS del
  // ejemplo p.139-144). El libro lo lleva CALIENTE; aquí va FRÍA con los mismos
  // ⌀ — DECLARADO — para VER la distribución llenarse. Gargantas ⌀3 (típ . cap 6,
  // valor declarado). Con DOS compuertas, donde chocan sus frentes hay LÍNEA DE
  // SOLDADURA — y eso es exactamente lo que este video existe para enseñar.
  const GX = [60, 180];                   // las dos caídas, simétricas al centro
  const GY = 10;                          // sobre el marco inferior
  const SPRUE_Z0 = -26;
  const inFeed = (x, y, z) => {
    if (z >= 0) return false;
    if (z >= -26 && z <= -14 && (x - 120) ** 2 + (y - GY) ** 2 <= 36) return true;      // sprue R6
    if (x >= GX[0] && x <= GX[1] && (y - GY) ** 2 + (z + 11) ** 2 <= 25) return true;   // manifold R5
    for (const gx of GX) {
      if (z >= -11 && z <= -1.5 && (x - gx) ** 2 + (y - GY) ** 2 <= 12.25) return true; // caída R3.5
      if (z > -1.5 && (x - gx) ** 2 + (y - GY) ** 2 <= 2.25) return true;               // garganta ⌀3
    }
    return false;
  };
  const cell = 0.6;                       // resuelve la costilla de 1 mm (≤0.7×1)
  // volumen analítico de la colada (cilindros): para la contabilidad y sus checks
  const FEED_MM3 = Math.PI * (36 * 12 + 25 * 120 + 2 * 12.25 * 9.5 + 2 * 2.25 * 1.5);
  console.log(`BEZEL kernel: vol ${volCc.toFixed(2)} cc (libro: 27.5 · sin draft/filete) · bbox ${q.bbox.x1 - q.bbox.x0}×${q.bbox.y1 - q.bbox.y0}×${q.bbox.z1 - q.bbox.z0}`);

  const t0 = Date.now();
  const field = FL.measureFlowLength({
    x0: q.bbox.x0 - 2, y0: q.bbox.y0 - 2, z0: SPRUE_Z0 - 1, x1: q.bbox.x1 + 2, y1: q.bbox.y1 + 2, z1: q.bbox.z1 + 1,
    cellMm: cell, gateMm: { x: 120, y: GY, z: SPRUE_Z0 + 0.5 },       // el fundido ENTRA arriba del sprue
    inCavity: (x, y, z) => inFeed(x, y, z) || q.inside(x, y, z),
    // la GARGANTA de cada caída marca su id: el id se hereda por el árbol y donde
    // colindan ids distintos = LÍNEA DE SOLDADURA (computeWeldMask)
    rootOfMm: (x, y, z) => {
      if (z <= -1.6 || z >= 0) return -1;
      for (let g = 0; g < GX.length; g++) if ((x - GX[g]) ** 2 + (y - GY) ** 2 <= 2.25) return g;
      return -1;
    },
    // el volumen esperado es pieza + COLADA (suma analítica de los cilindros; los
    // traslapes sprue∩manifold∩caídas se comen ~0.5 cc — tolerancia del aviso)
    wallMm: WALL, meltN: 0.348,
    expectVolumeMm3: volCc * 1000 + FEED_MM3,
  });
  const front = FL.createFlowFront(field);
  console.log(`CAMPO: ${field.nx}×${field.ny}×${field.nz} celdas ${cell} mm · ${Date.now() - t0} ms · sin llenar ${field.unreachable}`);
  for (const w of field.warnings) console.log(`  AVISO: ${w}`);

  // ── LAS LÍNEAS DE SOLDADURA (el punto de todo esto) ──────────────────────
  const weldInfo = FL.computeWeldMask(field);
  let wSum = 0, wN = 0, wMinR = Infinity, wNearGateMid = Infinity;
  let wMidPt = null;                      // la soldadura más cercana al punto medio entre compuertas
  const weldPts = [];
  for (let t = 0; t < field.cavity.length; t++) {
    if (!weldInfo.weld[t]) continue;
    const i = t % field.nx, j = ((t - i) / field.nx) % field.ny, k = ((t - i) / field.nx - j) / field.ny;
    const x = field.x0 + (i + .5) * cell, y = field.y0 + (j + .5) * cell, z = field.z0 + (k + .5) * cell;
    if (z < 0) continue;                  // la soldadura que importa es EN LA PIEZA
    weldPts.push(t);
    wSum += x; wN++;
    if (weldInfo.weldR[t] < wMinR) wMinR = weldInfo.weldR[t];
    const d = Math.hypot(x - 120, y - GY);
    if (d < wNearGateMid) { wNearGateMid = d; wMidPt = { x, y, z, R: weldInfo.weldR[t] }; }
  }
  console.log(`SOLDADURA: ${wN} vóxeles en la pieza · x̄=${(wSum / Math.max(1, wN)).toFixed(0)} (esperado ≈120 por simetría) · la más cercana al punto medio entre compuertas: ${wNearGateMid.toFixed(1)} mm`);

  // ¿Y el AIRE? — el vóxel de MÁXIMA resistencia es lo ÚLTIMO que se llena: ahí
  // queda atrapado el aire ⇒ VENTEO. (Las soldaduras ya no se infieren de aquí:
  // se DETECTAN con computeWeldMask, que es lo que se pinta cian.)
  let trapT = -1, trapR = -1;
  for (let t = 0; t < field.cavity.length; t++) {
    if (field.cavity[t] && Number.isFinite(field.resistance[t]) && field.resistance[t] > trapR) { trapR = field.resistance[t]; trapT = t; }
  }
  const wi = trapT % field.nx, wj = ((trapT - wi) / field.nx) % field.ny, wk = ((trapT - wi) / field.nx - wj) / field.ny;
  const trap = { x: field.x0 + (wi + .5) * cell, y: field.y0 + (wj + .5) * cell, z: field.z0 + (wk + .5) * cell };
  console.log(`AIRE ATRAPADO (última llegada): (${trap.x.toFixed(0)}, ${trap.y.toFixed(0)}, ${trap.z.toFixed(1)}) — venteo va ahí`);

  // ── TRAZADORAS: parcelas que viajan por el árbol de alimentación real ────
  // blanco de cada parcela = un vóxel; su CAMINO = parent[] hasta el gate. La
  // parcela cabalga el frente por SU camino (pos donde R_camino = R_frente −
  // rezago) hasta aterrizar en su blanco; entonces toma el siguiente blanco.
  // El rezago escalona el chorro: el bebedero se ve como CHORRO, no un punto.
  const NTR = 6000;                       // "más partículas" — el chorro se ve DENSO
  const targets = [];
  for (let t = 0; t < field.cavity.length; t++) if (field.cavity[t] && Number.isFinite(field.resistance[t])) targets.push(t);
  // barajado determinista (hash dorado) para que los blancos salten por toda la pieza
  targets.sort((a, b) => ((a * 0.6180339887) % 1) - ((b * 0.6180339887) % 1));
  const pathOf = (t) => {                 // camino gate→t como cuartetos [x,y,z,R] (decimado ×2)
    const idxs = [];
    for (let cur = t; cur >= 0; cur = field.parent[cur]) idxs.push(cur);
    idxs.reverse();                       // parent[] camina blanco→gate; el camino va gate→blanco
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
  const tr = [];                          // estado por trazadora
  for (let i = 0; i < NTR; i++) {
    const t = targets[i % targets.length];
    tr.push({ k: i, path: pathOf(t), Rt: field.resistance[t], lag: 0.015 + 0.05 * ((i * 0.6180339887) % 1) });
  }
  let nextTarget = NTR;
  const posAt = (p, R) => {               // busca en el camino el punto con esa R (binaria)
    const n = p.length / 4;
    if (n === 0) return null;
    if (R <= p[3]) return [p[0], p[1], p[2]];
    if (R >= p[4 * (n - 1) + 3]) return [p[4 * (n - 1)], p[4 * (n - 1) + 1], p[4 * (n - 1) + 2]];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[4 * m + 3] <= R) lo = m; else hi = m; }
    const rA = p[4 * lo + 3], rB = p[4 * hi + 3], f = rB > rA ? (R - rA) / (rB - rA) : 0;
    return [p[4 * lo] + (p[4 * hi] - p[4 * lo]) * f, p[4 * lo + 1] + (p[4 * hi + 1] - p[4 * lo + 1]) * f, p[4 * lo + 2] + (p[4 * hi + 2] - p[4 * lo + 2]) * f];
  };

  // FÍSICA cap 5 + cap 6 para el HUD (ABS MG47, p.105-111 — la resina DE ESTE bezel)
  const melt = F.ABS_MG47, wallM = WALL / 1000;
  const vMean = F.convergeVelocity(melt, wallM);
  const gam = F.shearRatePowerLaw(vMean, wallM, melt.n);
  const mu = F.viscosityPowerLaw(melt, gam);
  const pAt = (Lmm) => F.pressureDropSegment(melt, Lmm / 1000, wallM, vMean) / 1e6;
  const tFillS = (field.maxFlowLenMm / 1000) / vMean;
  // la COLADA no es una placa: es conducto CIRCULAR — su ΔP es Eq 6.5 (feed.ts,
  // verificado contra el hot runner de ESTE bezel p.139-144), con NUESTROS largos
  // y los ⌀ del libro. Q sale de la conservación: volumen total / t de llenado.
  const Qtot = field.volumeMm3 / 1e9 / tFillS;                // m³/s
  const SEGS = [
    { name: 'sprue', L: 0.012, R: 0.006, Vdot: Qtot },
    { name: 'manifold', L: 0.060, R: 0.005, Vdot: Qtot / 2 }, // media rama por caída
    { name: 'caida', L: 0.0095, R: 0.0035, Vdot: Qtot / 2 },
  ];
  const dpFeedMPa = FD.feedPressureDrop(melt, SEGS) / 1e6;
  // L de la colada hasta la garganta (para separar colada|pieza en la curva):
  // promedio de flowLenMm sobre los vóxeles de garganta
  let thSum = 0, thN = 0;
  for (let t = 0; t < field.cavity.length; t++) {
    if (!field.cavity[t] || field.root[t] < 0 || !Number.isFinite(field.resistance[t])) continue;
    const i = t % field.nx, j = ((t - i) / field.nx) % field.ny, k = ((t - i) / field.nx - j) / field.ny;
    const z = field.z0 + (k + .5) * cell;
    if (z >= -1.6 && z < 0) { thSum += field.flowLenMm[t]; thN++; }
  }
  const L_THROAT = thN ? thSum / thN : 0;
  // ΔP total: mientras el frente va POR la colada, la fracción de Eq 6.5 recorrida;
  // ya en la pieza, colada completa + placas (Eq 5.22) sobre la L DENTRO de la pieza
  const pTotal = (Lmm) => Lmm <= L_THROAT
    ? dpFeedMPa * (Lmm / Math.max(1e-9, L_THROAT))
    : dpFeedMPa + pAt(Lmm - L_THROAT);
  console.log(`L máx ${field.maxFlowLenMm} mm (colada ${L_THROAT.toFixed(0)} + pieza ${(field.maxFlowLenMm - L_THROAT).toFixed(0)}) · t_llenado ${(tFillS * 1000).toFixed(0)} ms · ΔP máx ${pTotal(field.maxFlowLenMm).toFixed(1)} MPa = colada ${dpFeedMPa.toFixed(1)} (Eq 6.5) + pieza ${pAt(field.maxFlowLenMm - L_THROAT).toFixed(1)} (Eq 5.22)`);

  const fr = [];
  for (let f = 0; f <= NF; f++) fr.push(front.frontAt(f / NF));

  // ── el volumen (splats back-to-front + trazadoras ADITIVAS encima) ───────
  const VW = 1000, VH = 840;
  const cx0 = (q.bbox.x0 + q.bbox.x1) / 2, cy0 = (q.bbox.y0 + q.bbox.y1) / 2, cz0 = (SPRUE_Z0 + q.bbox.z1) / 2;
  const S = 3.1;                          // pieza 244 mm de ancho: cabe con aire
  const aguaY = [cy0 - 44, cy0, cy0 + 44];
  const renderVol = (thetaDeg, Rt) => {
    const th = (thetaDeg * Math.PI) / 180, cosT = Math.cos(th), sinT = Math.sin(th);
    const fb = new Float32Array(VW * VH * 3).fill(9);
    const proj = (x, y, z) => {
      const xr = (x - cx0) * cosT - (y - cy0) * sinT, yr = (x - cx0) * sinT + (y - cy0) * cosT;
      return { u: VW / 2 + (xr - yr) * S, v: VH / 2 + (xr + yr) * 1.55 - (z - cz0) * S, d: xr + yr + (z - cz0) * 0.35 };
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
        // rampa comprimida (arranca en ÁMBAR, no crema): el blanco de las trazadoras
        // debe TRONAR sobre el depósito también en los primeros cuadros
        const col = ramp(0.15 + 0.85 * u);
        splats.push([p.d, p.u, p.v, col[0], col[1], col[2], 0.14 + 0.42 * (1 - u)]);
      } else {
        splats.push([p.d, p.u, p.v, 46, 55, 76, 0.09]);   // fantasma: se debe VER la pieza que falta
      }
    }
    for (const lz of [-8, 20]) for (const ly of aguaY) {
      for (let x = q.bbox.x0 - 15; x <= q.bbox.x1 + 15; x += cell) {
        const p = proj(x, ly, lz);
        splats.push([p.d, p.u, p.v, 64, 156, 255, 0.35]);
      }
    }
    splats.sort((a, b) => a[0] - b[0]);
    // splat 3×3 con núcleo SUAVE — "se siguen viendo puntos" (user): el 2×2 duro
    // dejaba huecos entre vóxeles proyectados; el kernel con falda los funde en
    // superficie continua sin perder la textura del volumen.
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
    // LÍNEAS DE SOLDADURA: se ENCIENDEN cian cuando llega el SEGUNDO frente —
    // exactamente lo que pintan Moldflow/SolidWorks Plastics, saliendo del árbol.
    for (const t of weldPts) {
      if (weldInfo.weldR[t] > Rt) continue;                 // aún no chocan aquí
      const i = t % field.nx, j = ((t - i) / field.nx) % field.ny, k = ((t - i) / field.nx - j) / field.ny;
      const p = proj(field.x0 + (i + .5) * cell, field.y0 + (j + .5) * cell, field.z0 + (k + .5) * cell);
      const ui = p.u | 0, vi = p.v | 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const px = ui + dx, py = vi + dy;
        if (px < 0 || py < 0 || px >= VW || py >= VH) continue;
        const o = (py * VW + px) * 3;
        fb[o] += 55; fb[o + 1] += 190; fb[o + 2] += 235;    // cian aditivo: la cicatriz brilla
      }
    }
    // TRAZADORAS con estela — ADITIVAS (el fundido brilla; los picos revientan).
    // largo de estela en R fijo ⇒ largo en mm ∝ dL/dR = H^(1+n): grueso = larga.
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
      for (let e = 1; e <= 5; e++) {      // la estela (5 muestras hacia atrás)
        const pe = posAt(s.path, Math.min(Rme, s.Rt) - dR * e / 5);
        if (pe) add(pe[0], pe[1], pe[2], 2, 0.24 * (1 - e / 6));
      }
      add(head[0], head[1], head[2], 3, Rme < s.Rt ? 1.0 : 0.3);    // la cabeza (aterrizada = se apaga)
    }
    // el esqueleto del bloque
    const bx0 = q.bbox.x0 - 20, bx1 = q.bbox.x1 + 20, by0 = q.bbox.y0 - 20, by1 = q.bbox.y1 + 20, bz0 = SPRUE_Z0 - 4, bz1 = q.bbox.z1 + 12;
    const V0 = [[bx0, by0, bz0], [bx1, by0, bz0], [bx1, by1, bz0], [bx0, by1, bz0], [bx0, by0, bz1], [bx1, by0, bz1], [bx1, by1, bz1], [bx0, by1, bz1]];
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) {
      const pa = proj(...V0[a]), pb = proj(...V0[b]);
      for (let s = 0; s <= 260; s++) {
        const px = (pa.u + (pb.u - pa.u) * s / 260) | 0, py = (pa.v + (pb.v - pa.v) * s / 260) | 0;
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
  const serie = [];                       // telemetría por cuadro (se vuelca a JSON)
  for (let f = 0; f < NF; f++) {
    const frac = proof ? [0.12, 0.55, 0.97][f] : f / (NF - 1);
    // OJO proof: fr[] tiene NF+1 entradas — con NF=3 redondear frac·NF aplasta el
    // frente a 0 y el proof MIENTE (se vio: "12 % llenado · L 0.0"). Directo en proof.
    const st = proof ? front.frontAt(frac) : (fr[Math.round(frac * NF)] ?? front.frontAt(frac));
    // avanzar blancos: la parcela que ya aterrizó toma el SIGUIENTE (chorro continuo)
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
      pts.push(`${(1100 + fA * 740).toFixed(1)},${(700 - (pTotal(sA.lenMaxMm) / Math.max(1e-9, pTotal(field.maxFlowLenMm))) * 210).toFixed(1)}`);
    }
    const tMs = frac * tFillS * 1000;
    // marcadores: la PRIMERA soldadura (cuando los frentes de las 2 compuertas
    // chocan entre ellas) y el AIRE ATRAPADO al final
    let weldSvg = '';
    if (wMidPt && st.resistance >= wMidPt.R) {
      const wp = proj(wMidPt.x, wMidPt.y, wMidPt.z);
      const wx = 30 + wp.u, wy = 110 + wp.v;
      weldSvg += `<circle cx="${wx.toFixed(0)}" cy="${wy.toFixed(0)}" r="13" fill="none" stroke="#6fd9f2" stroke-width="2"/>` +
        `<text x="${(wx + 20).toFixed(0)}" y="${(wy + 5).toFixed(0)}" font-size="16" fill="#9fe8fa">frentes de las 2 COMPUERTAS chocan → LÍNEA DE SOLDADURA (cian)</text>`;
    }
    if (frac >= 0.93) {
      const tp = proj(trap.x, trap.y, trap.z);
      const tx = 30 + tp.u, ty = 110 + tp.v;
      weldSvg += `<circle cx="${tx.toFixed(0)}" cy="${ty.toFixed(0)}" r="13" fill="none" stroke="#ffffff" stroke-width="2"/>` +
        `<text x="${(tx + 20).toFixed(0)}" y="${(ty + 5).toFixed(0)}" font-size="16" fill="#eaf2ff">lo ÚLTIMO en llenar → AIRE ATRAPADO: venteo aquí</text>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="ui-monospace,Menlo,monospace">
<rect width="1920" height="1080" fill="#0b0f16"/>
<text x="60" y="56" font-size="30" fill="#eaf2ff">EL BEZEL DEL LIBRO — dos frentes CORREN por el marco y CHOCAN: la línea de soldadura EMERGE</text>
<text x="60" y="88" font-size="17" fill="#5d7290">bezel 240×160 pared 1.5 (banco Kazmer) · COLADA del libro p.139-144: sprue R6 → manifold R5 → 2 CAÍDAS R3.5 · ${(nVoxTot / 1000).toFixed(0)}k vóxeles · ${NTR} trazadoras · cámara lenta ${(15 / tFillS).toFixed(0)}×</text>
<image x="30" y="110" width="1000" height="840" href="data:image/png;base64,${b64V}"/>
${weldSvg}
<text x="60" y="975" font-size="16" fill="#5d7290">blanco = fundido VIAJANDO · CIAN = LÍNEA DE SOLDADURA (chocan frentes de compuertas distintas) · ámbar→morado = orden de llegada · gris = falta · azul = agua</text>
<text x="1100" y="150" font-size="21" fill="#8fa3bf">LO QUE SIENTE LA MÁQUINA</text>
<text x="1100" y="186" font-size="34" fill="#eaf2ff">t = ${tMs.toFixed(0)} ms</text>
<text x="1100" y="216" font-size="17" fill="#7ee0a0">llenado ${(frac * 100).toFixed(0)} % del volumen · L recorrida ${st.lenMaxMm.toFixed(1)} / ${field.maxFlowLenMm} mm</text>
<text x="1100" y="452" font-size="19" fill="#8fa3bf">ΔP en la compuerta (Eq 5.19) — sube al ALARGARSE el recorrido</text>
<polyline points="${pts.join(' ')}" fill="none" stroke="#f2c14e" stroke-width="3"/>
<line x1="1100" y1="700" x2="1840" y2="700" stroke="#2a3446"/>
<text x="1100" y="726" font-size="15" fill="#5d7290">0 ms</text>
<text x="1780" y="726" font-size="15" fill="#5d7290">${(tFillS * 1000).toFixed(0)} ms</text>
<text x="1100" y="760" font-size="22" fill="#f2c14e">ΔP = ${pTotal(st.lenMaxMm).toFixed(1)} / ${pTotal(field.maxFlowLenMm).toFixed(1)} MPa  (colada ${dpFeedMPa.toFixed(1)} + pieza)</text>
<text x="1100" y="810" font-size="16" fill="#5d7290">v̄ ${vMean.toFixed(2)} m/s (Eq 5.23) · γ̇ ${gam.toFixed(0)} 1/s (Eq 5.21) · μ ${mu.toFixed(0)} Pa·s · ABS MG47 (p.105-111)</text>
<text x="1100" y="836" font-size="16" fill="#5d7290">la colada REPARTE: cada caída alimenta ~la mitad y la L en pieza se parte</text>
<text x="1100" y="862" font-size="16" fill="#5d7290">en dos — el libro la lleva CALIENTE (p.139-144); fría AQUÍ para verla llenarse.</text>
<text x="60" y="1044" font-size="14" fill="#44506a">honesto: cuasiestático (frente por resistencia, sin inercia) · Q constante · T_melt uniforme · trazadoras = parcelas por el árbol de mínima resistencia (parent del Dijkstra) · sin draft/filete (&lt;0.2 mm) · render: iangpu (nice 10)</text>
</svg>`;
    fs.writeFileSync(path.join(out, `f${String(f).padStart(4, '0')}.svg`), svg);
    // TELEMETRÍA por cuadro — "añade más telemetría para que puedas VER errores
    // porque solo puedes ver imágenes" (user): números que un agente lee y checa.
    let moviendo = 0, aterrizadas = 0;
    for (const s of tr) { if (s.done || s.Rt <= st.resistance * (1 - s.lag)) aterrizadas++; else moviendo++; }
    let weldOn = 0;
    for (const t of weldPts) if (weldInfo.weldR[t] <= st.resistance) weldOn++;
    serie.push({
      f, frac: +frac.toFixed(4), tMs: +tMs.toFixed(1), LmaxMm: +st.lenMaxMm.toFixed(2),
      dPMPa: +pTotal(st.lenMaxMm).toFixed(2), trazMoviendo: moviendo, trazAterrizadas: aterrizadas,
      weldVoxEncendidos: weldOn,
    });
    if (f % 60 === 0) console.log(`  cuadro ${f}/${NF} · ${((Date.now() - tRender) / 1000).toFixed(0)} s`);
  }
  console.log(`${NF} SVG en ${((Date.now() - tRender) / 1000).toFixed(0)} s → ${out}`);

  // ── TELEMETRÍA GLOBAL + CHECKS (el gate corre AQUÍ, antes de gastar 4K) ──
  const rooted = { g0: 0, g1: 0, sinRoot: 0 };
  for (let t = 0; t < field.cavity.length; t++) {
    if (!field.cavity[t] || !Number.isFinite(field.resistance[t])) continue;
    const k = Math.floor(t / (field.nx * field.ny));
    if (field.z0 + (k + .5) * cell < 0) continue;             // solo la PIEZA
    if (field.root[t] === 0) rooted.g0++; else if (field.root[t] === 1) rooted.g1++; else rooted.sinRoot++;
  }
  const telem = {
    pieza: 'bezel-2caidas', cellMm: cell, nVox: nVoxTot,
    volKernelCc: +volCc.toFixed(2), volColadaCc: +(FEED_MM3 / 1000).toFixed(2),
    volVoxelCc: +(field.volumeMm3 / 1000).toFixed(2),
    // el voxel mide pieza + COLADA: se compara contra la suma (los traslapes de
    // los cilindros y el escalón de la rejilla dan el margen)
    errVolPct: +((100 * Math.abs(field.volumeMm3 - (volCc * 1000 + FEED_MM3))) / (volCc * 1000 + FEED_MM3)).toFixed(1),
    unreachable: field.unreachable,
    LmaxMm: field.maxFlowLenMm, dPmaxMPa: +pTotal(field.maxFlowLenMm).toFixed(1), dpColadaMPa: +dpFeedMPa.toFixed(1), tFillMs: +(tFillS * 1000).toFixed(0),
    gates: GX.map((x) => ({ x, y: GY })),
    volPorGate: rooted,
    weld: { vox: wN, xMedia: +(wSum / Math.max(1, wN)).toFixed(1), cercaMedioMm: +wNearGateMid.toFixed(1) },
    aireAtrapado: { x: +trap.x.toFixed(1), y: +trap.y.toFixed(1), z: +trap.z.toFixed(1) },
    serie,
  };
  fs.writeFileSync(path.join(out, 'telemetria.json'), JSON.stringify(telem, null, 1));
  const checks = {
    vol_cuadra: telem.errVolPct < 12,
    todo_llena: telem.unreachable === 0,
    hay_soldadura: wN > 0,
    soldadura_entre_compuertas: wNearGateMid < 10,            // el choque simétrico cae en x≈120
    soldadura_simetrica: Math.abs(telem.weld.xMedia - 120) < 20,
    gates_reparten: rooted.g0 > 0.3 * (rooted.g0 + rooted.g1) && rooted.g1 > 0.3 * (rooted.g0 + rooted.g1),
    dP_monotona: serie.every((s, i2) => i2 === 0 || s.dPMPa >= serie[i2 - 1].dPMPa - 1e-6),
    llenado_monotono: serie.every((s, i2) => i2 === 0 || s.frac >= serie[i2 - 1].frac),
    trazadoras_fluyen: serie.length < 5 || serie[Math.floor(serie.length / 2)].trazMoviendo > NTR * 0.2,
    trazadoras_aterrizan: serie.length < 5 || serie[serie.length - 1].trazAterrizadas > NTR * 0.5,
    soldadura_enciende_gradual: serie.length < 5 || (serie[0].weldVoxEncendidos === 0 && serie[serie.length - 1].weldVoxEncendidos >= wN * 0.9),
  };
  const pass = Object.values(checks).every(Boolean);
  console.log('TELEMETRIA=' + JSON.stringify({ ...telem, serie: `${serie.length} cuadros` }));
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  if (!pass && !proof) process.exit(2);                       // NO gastar raster+NVENC en un video roto
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
