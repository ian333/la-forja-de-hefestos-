/**
 * DFM DESDE LA MALLA — el LIBRO delimita qué figuras se pueden moldear y cuáles no.
 * Todo MEDIDO sobre la malla real (no declarado por el cliente) y contra las reglas
 * LITERALES de Kazmer §2.3 (cero inventos):
 *
 *   · §2.3.7 UNDERCUTS (Fig 2.7: ventana lateral, overhang, boss horizontal, snap):
 *     raster de columnas en la dirección de apertura ±Z; una columna con >2 cruces
 *     de superficie tiene material-hueco-material → NO sale con dos placas: pide
 *     side-action/lifter (§11.3). Un hueco RODEADO de material por los 4 costados
 *     y arriba/abajo = cavidad interna cerrada → NO MOLDEABLE por inyección.
 *   · §2.3.6 DRAFT (Tabla 2.14): ángulo de salida medido por triángulo,
 *     φ = asin(|n_z|) en caras laterales. "A minimum draft angle of 0.5° is usually
 *     necessary, with 1 to 2° commonly applied"; B-3/ABS → 1.5°; +1° por 20 μm
 *     de textura. Se reporta el % de área lateral con φ < mínimo.
 *   · §2.3.1 PARED UNIFORME: espesores medidos como intervalos sólidos por columna;
 *     "extreme differences … internal voids may be formed" → p95/nominal alto = ⚠.
 *
 * La dirección de apertura se asume +Z (la que fija el importador con su
 * auto-orientación §11). El raster es el MISMO barycéntrico del tallado.
 */
import type { AnalysisVerdict } from './mold-analysis';

export interface DfmMeshReport {
  moldable: 'si' | 'con-mecanismos' | 'no';
  verdicts: AnalysisVerdict[];
  undercut: { columnsPct: number; volumeMm3: number; enclosedVoids: boolean; regions: number };
  draft: { pctBelowMin: number; pctBelowTable: number; minDeg: number; tableDeg: number; lateralAreaMm2: number };
  wall: { nominalMm: number; p50Mm: number; p95Mm: number; ratio: number };
  /** relieve del núcleo (§11: la pieza debe ABRAZAR el núcleo B al abrir) medido en
   *  esta orientación vs volteada π sobre X — el importador decide el volteo con esto. */
  orient: { coreReliefAsIsMm: number; coreReliefFlippedMm: number; flipRecommended: boolean };
  /** área proyectada REAL de la pieza (columnas sólidas del raster, mm²) —
   *  descontando ventanas/huecos, a diferencia del bbox L×W. */
  projectedAreaMm2: number;
  /** §10.3.1: clasificación topológica para alabeo.
   *  'marco' = ventana interior >30% del bbox, bordes desacoplados (bezel).
   *  'placa' = sólida cerrada, pandea si (s_borde − s_centro) > 0.44·(h/W)².
   *  'mixta' = ni tan abierta ni tan cerrada. */
  warpageTopology: { tipo: 'marco' | 'placa' | 'mixta'; solidFrac: number; interiorEmptyFrac: number };
  /** GEOMETRÍA de cada región de undercut (coords locales de la pieza, min en 0):
   *  bbox XY + rango z del hueco + DIRECCIÓN DE JALE (votación de venteos laterales)
   *  — el insumo del GENERADOR de mecanismos §11.3.6-7. */
  regionsDetail: Array<{
    x0: number; x1: number; y0: number; y1: number;
    zLo: number; zHi: number; volMm3: number; cols: number;
    /** dirección lateral por la que ventea (unitaria en XY); null = sellada */
    dir: [number, number] | null;
  }>;
}

/** Tabla 2.14 (LITERAL): draft recomendado por acabado/resina. */
export const DRAFT_TABLE_2_14: Array<{ finish: string; resin: string; draftDeg: number }> = [
  { finish: 'SPI A-1', resin: 'Acrylic', draftDeg: 0.5 },
  { finish: 'SPI B-3', resin: 'ABS', draftDeg: 1.5 },
  { finish: 'Sand texture', resin: '20% GF PC', draftDeg: 2 },
  { finish: 'Leather texture', resin: 'Soft PVC', draftDeg: 4 },
  { finish: 'Leather texture', resin: 'ABS', draftDeg: 7.5 },
];
const DRAFT_MIN_DEG = 0.5;   // §2.3.6 "A minimum draft angle of 0.5° is usually necessary"

function classifyWarpageTopology(solid: Uint8Array, G: number, GY: number) {
  const margin = Math.max(1, Math.round(Math.min(G, GY) * 0.1));
  let interiorSolid = 0, interiorEmpty = 0;
  for (let i = margin; i < G - margin; i++) {
    for (let j = margin; j < GY - margin; j++) {
      if (solid[i * GY + j]) interiorSolid++; else interiorEmpty++;
    }
  }
  const interiorTotal = interiorSolid + interiorEmpty;
  const solidFrac = interiorTotal > 0 ? interiorSolid / interiorTotal : 1;
  const interiorEmptyFrac = interiorTotal > 0 ? interiorEmpty / interiorTotal : 0;
  const tipo = interiorEmptyFrac > 0.3 ? 'marco' as const
    : interiorEmptyFrac < 0.05 ? 'placa' as const
    : 'mixta' as const;
  return { tipo, solidFrac: +solidFrac.toFixed(3), interiorEmptyFrac: +interiorEmptyFrac.toFixed(3) };
}

export function dfmFromMesh(
  mesh: { positions: Float32Array | number[]; indices: Uint32Array | number[] },
  o?: { finish?: string; resin?: string; wallMm?: number },
): DfmMeshReport {
  const P = mesh.positions, I = mesh.indices;
  let mnx = 1e18, mny = 1e18, mnz = 1e18, mxx = -1e18, mxy = -1e18, mxz = -1e18;
  for (let i = 0; i < P.length; i += 3) {
    if (P[i] < mnx) mnx = P[i]; if (P[i] > mxx) mxx = P[i];
    if (P[i + 1] < mny) mny = P[i + 1]; if (P[i + 1] > mxy) mxy = P[i + 1];
    if (P[i + 2] < mnz) mnz = P[i + 2]; if (P[i + 2] > mxz) mxz = P[i + 2];
  }
  const LX = mxx - mnx || 1, WY = mxy - mny || 1;
  // raster ~0.8 mm de celda (acotado) — suficiente para ventanas/overhangs reales
  const G = Math.max(48, Math.min(160, Math.round(LX / 0.8)));
  const GY = Math.max(16, Math.round(G * WY / LX));
  const dxg = LX / G, dyg = WY / GY;
  const hits: number[][] = Array.from({ length: G * GY }, () => []);
  // DRAFT por área: laterales = |n_z| < sin(45°) (más vertical que 45° se considera
  // pared de salida; lo demás es cara superior/inferior que no roza al expulsar)
  let latArea = 0, areaBelowMin = 0, areaBelowTable = 0;
  const table = (o?.finish || o?.resin)
    ? DRAFT_TABLE_2_14.find((t) =>
      (!o?.finish || t.finish.toLowerCase().includes((o.finish || '').toLowerCase().replace('spi ', ''))) &&
      (!o?.resin || t.resin.toLowerCase() === (o.resin || '').toLowerCase()))
    : DRAFT_TABLE_2_14[1];                   // sin datos → B-3/ABS 1.5° (nuestro finish típico)
  const tableDeg = table?.draftDeg ?? 1.5;
  const sinMin = Math.sin(DRAFT_MIN_DEG * Math.PI / 180);
  const sinTab = Math.sin(tableDeg * Math.PI / 180);
  const SIN45 = Math.SQRT1_2;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ax = P[a] - mnx, ay = P[a + 1] - mny, az = P[a + 2] - mnz;
    const bx = P[b] - mnx, by = P[b + 1] - mny, bz = P[b + 2] - mnz;
    const cx = P[c] - mnx, cy = P[c + 1] - mny, cz = P[c + 2] - mnz;
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nzc = ux * vy - uy * vx;
    const a2 = Math.hypot(nx, ny, nzc);
    if (a2 < 1e-12) continue;
    const triArea = a2 / 2, nz = nzc / a2;
    if (Math.abs(nz) < SIN45) {
      latArea += triArea;
      if (Math.abs(nz) < sinMin) areaBelowMin += triArea;
      if (Math.abs(nz) < sinTab) areaBelowTable += triArea;
    }
    // cruces del rayo vertical: SOLO triángulos no verticales (un rayo ∥ a la cara
    // vertical no la cruza transversalmente)
    if (Math.abs(nz) < 1e-3) continue;
    const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) / dxg)), i1 = Math.min(G - 1, Math.ceil(Math.max(ax, bx, cx) / dxg));
    const j0 = Math.max(0, Math.floor(Math.min(ay, by, cy) / dyg)), j1 = Math.min(GY - 1, Math.ceil(Math.max(ay, by, cy) / dyg));
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-12) continue;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      // jitter irracional: los planos de piezas CAD caen EXACTO en centros de celda
      // (p.ej. pared en x=30.0) y el rayo rasante da conteos impares falsos
      const px = (i + 0.5031) * dxg, py = (j + 0.5047) * dyg;
      const w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den;
      const w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;                  // estricto: sin doble conteo de borde
      hits[j * G + i].push(az * w0 + bz * w1 + cz * w2);
    }
  }
  // por columna: ordenar cruces, dedup (~malla), pares sólidos, huecos intermedios
  const solid = new Uint8Array(G * GY);                          // 1 = tiene material
  const undercutCol = new Uint8Array(G * GY);
  const gapLo = new Float32Array(G * GY).fill(NaN);              // hueco intermedio (para voids)
  const gapHi = new Float32Array(G * GY).fill(NaN);
  const matTop = new Float32Array(G * GY).fill(NaN);             // techo/piso de material
  const matBot = new Float32Array(G * GY).fill(NaN);
  const colThick = new Float32Array(G * GY).fill(NaN);
  const bad = new Uint8Array(G * GY);                            // conteo impar = rayo rasante, NO confiable
  let volUnder = 0, nSolid = 0, nUnder = 0;
  const cellA = dxg * dyg;
  for (let n = 0; n < G * GY; n++) {
    const h = hits[n];
    if (h.length < 2) continue;
    h.sort((x, y) => x - y);
    const zs: number[] = [h[0]];
    for (let k = 1; k < h.length; k++) if (h[k] - zs[zs.length - 1] > 0.05) zs.push(h[k]);
    if (zs.length < 2) continue;
    if (zs.length % 2 === 1) { bad[n] = 1; zs.pop(); }           // rasante: se marca y NO decide venteos
    solid[n] = 1; nSolid++;
    matBot[n] = zs[0]; matTop[n] = zs[zs.length - 1];
    let tk = 0;
    for (let k = 0; k + 1 < zs.length; k += 2) tk += zs[k + 1] - zs[k];
    colThick[n] = tk;
    if (zs.length > 2) {                                         // material-hueco-material
      undercutCol[n] = 1; nUnder++;
      let g = 0;
      for (let k = 1; k + 1 < zs.length; k += 2) g += zs[k + 1] - zs[k];
      volUnder += g * cellA;
      gapLo[n] = zs[1]; gapHi[n] = zs[zs.length - 2];
    }
  }
  // REGIONES de undercut (flood fill 4-conexo) + ¿la región VENTEA lateralmente?
  // Un vecino ventea el hueco [lo,hi] si es no-sólido (aire) o si su material NO
  // cubre ese rango (el hueco escapa por arriba o por abajo del vecino). Una región
  // SIN ninguna columna que ventee = CAVIDAD INTERNA SELLADA → NO moldeable
  // (§2.3.7: ni un side-action la alcanza).
  let regions = 0, enclosedRegions = 0, enclosedCols = 0;
  const regionsDetail: DfmMeshReport['regionsDetail'] = [];
  {
    const seen = new Uint8Array(G * GY);
    for (let s = 0; s < G * GY; s++) {
      if (!undercutCol[s] || seen[s]) continue;
      regions++;
      const member: number[] = [];
      const stack = [s]; seen[s] = 1;
      while (stack.length) {
        const n = stack.pop()!;
        member.push(n);
        const i = n % G, j = (n / G) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= G || jj >= GY) continue;
          const m = jj * G + ii;
          if (undercutCol[m] && !seen[m]) { seen[m] = 1; stack.push(m); }
        }
      }
      // ¿ventea? + VOTACIÓN de la dirección de jale (cada columna que ventea vota
      // por el lado por el que escapa — la corredera §11.3.7 se retrae hacia allá)
      let vents = false;
      const votes = [0, 0, 0, 0];                              // +x, −x, +y, −y
      let ri0 = G, ri1 = 0, rj0 = GY, rj1 = 0, rzLo = 1e18, rzHi = -1e18, rvol = 0;
      for (const n of member) {
        const i = n % G, j = (n / G) | 0;
        if (i < ri0) ri0 = i; if (i > ri1) ri1 = i;
        if (j < rj0) rj0 = j; if (j > rj1) rj1 = j;
        const lo = gapLo[n], hi = gapHi[n];
        if (lo < rzLo) rzLo = lo; if (hi > rzHi) rzHi = hi;
        rvol += (hi - lo) * cellA;
        const dirs = [[1, 0, 0], [-1, 0, 1], [0, 1, 2], [0, -1, 3]] as const;
        for (const [di, dj, v] of dirs) {
          const ii = i + di, jj = j + dj;
          let venting = false;
          if (ii < 0 || jj < 0 || ii >= G || jj >= GY) venting = true;   // borde del grid = aire
          else {
            const m = jj * G + ii;
            if (undercutCol[m] || bad[m]) continue;            // el hueco continúa / rasante no decide
            if (!solid[m] || matTop[m] < hi - 0.05 || matBot[m] > lo + 0.05) venting = true;
          }
          if (venting) { vents = true; votes[v]++; }
        }
      }
      if (!vents) { enclosedRegions++; enclosedCols += member.length; }
      const best = votes.indexOf(Math.max(...votes));
      const dir: [number, number] | null = vents
        ? ([[1, 0], [-1, 0], [0, 1], [0, -1]] as Array<[number, number]>)[best]
        : null;
      regionsDetail.push({
        x0: +(ri0 * dxg).toFixed(1), x1: +((ri1 + 1) * dxg).toFixed(1),
        y0: +(rj0 * dyg).toFixed(1), y1: +((rj1 + 1) * dyg).toFixed(1),
        zLo: +(rzLo - mnz).toFixed(1), zHi: +(rzHi - mnz).toFixed(1),
        volMm3: Math.round(rvol), cols: member.length, dir,
      });
    }
    regionsDetail.sort((a, b) => b.volMm3 - a.volMm3);
  }
  // PARED §2.3.1: SOLO columnas interiores (erosión ×2) — las columnas de una pared
  // vertical miden su ALTURA en z (26 mm en una carcasa), no el espesor de sección;
  // el interior erosionado deja las losas (piso/techo/bosses) que sí son sección.
  const thicks: number[] = [];
  const ER = 2;
  for (let j = ER; j < GY - ER; j++) for (let i = ER; i < G - ER; i++) {
    const n = j * G + i;
    if (!solid[n] || Number.isNaN(colThick[n])) continue;
    let interior = true;
    for (let dj = -ER; dj <= ER && interior; dj++) for (let di = -ER; di <= ER; di++)
      if (!solid[(j + dj) * G + (i + di)]) { interior = false; break; }
    if (interior) thicks.push(colThick[n]);
  }
  // pieza tan chica que la erosión no deja nada → cae a todas las sólidas
  if (thicks.length < 16) for (let n = 0; n < G * GY; n++) if (solid[n] && !Number.isNaN(colThick[n])) thicks.push(colThick[n]);
  thicks.sort((x, y) => x - y);
  const p50 = thicks.length ? thicks[(thicks.length * 0.5) | 0] : 0;
  const p95 = thicks.length ? thicks[Math.min(thicks.length - 1, (thicks.length * 0.95) | 0)] : 0;
  const nominal = o?.wallMm ?? p50;
  const ratio = nominal > 0 ? p95 / nominal : 1;
  // ORIENTACIÓN §11: relieve del núcleo = cuánto SUBE el macho hacia la pieza.
  // tal-cual = media(matBot − z_min); volteada = media(z_max − matTop).
  let sumBot = 0, sumTop = 0, nCols = 0;
  for (let n = 0; n < G * GY; n++) {
    if (!solid[n] || bad[n]) continue;
    sumBot += matBot[n] - mnz; sumTop += mxz - matTop[n]; nCols++;
  }
  const reliefAsIs = nCols ? sumBot / nCols : 0;
  const reliefFlip = nCols ? sumTop / nCols : 0;
  const flipRecommended = reliefFlip > reliefAsIs * 1.15 + 0.5;
  const underPct = nSolid ? (nUnder / nSolid) * 100 : 0;
  const draftMinPct = latArea ? (areaBelowMin / latArea) * 100 : 0;
  const draftTabPct = latArea ? (areaBelowTable / latArea) * 100 : 0;
  const enclosedVoids = enclosedRegions > 0;
  // PISO DE RUIDO: una región de <3 columnas o <2 mm³ es artefacto del raster, no
  // un undercut (el embudo daba "con-mecanismos" por 1 columna/0 mm³)
  const underSignif = regionsDetail.some((r) => r.cols >= 3 && r.volMm3 >= 2);
  const moldable: DfmMeshReport['moldable'] = enclosedVoids ? 'no' : (underSignif ? 'con-mecanismos' : 'si');
  const verdicts: AnalysisVerdict[] = [
    {
      param: 'Undercuts (dos placas)',
      valor: nUnder === 0 ? 'ninguno' : `${nUnder} columnas (${underPct.toFixed(1)} % de la huella) · ${regions} región(es) · ${volUnder.toFixed(0)} mm³`,
      limite: 'sin material-hueco-material en la dirección de apertura',
      ok: nUnder === 0,
      ref: '§2.3.7 · Fig 2.7 · mecanismos §11.3',
    },
    ...(enclosedVoids ? [{
      param: 'Cavidad interna CERRADA',
      valor: `${enclosedRegions} región(es), ${enclosedCols} columnas sin salida lateral`,
      limite: 'imposible de moldear por inyección (ni side-action la alcanza)',
      ok: false,
      ref: '§2.3.7',
    }] : []),
    {
      param: `Draft mínimo (${DRAFT_MIN_DEG}°)`,
      valor: `${draftMinPct.toFixed(1)} % del área lateral bajo ${DRAFT_MIN_DEG}°`,
      limite: '"a minimum draft angle of 0.5° is usually necessary"',
      ok: draftMinPct < 5,
      ref: '§2.3.6',
    },
    {
      param: `Draft por acabado (${tableDeg}°)`,
      valor: `${draftTabPct.toFixed(1)} % del área lateral bajo ${tableDeg}°`,
      limite: `Tabla 2.14 (${table ? table.finish + ' · ' + table.resin : 'SPI B-3 · ABS'})`,
      ok: draftTabPct < 20,
      ref: 'Tabla 2.14',
    },
    {
      param: 'Pared uniforme',
      valor: `mediana ${p50.toFixed(1)} mm · p95 ${p95.toFixed(1)} mm (${ratio.toFixed(1)}× nominal ${nominal.toFixed(1)})`,
      limite: 'secciones gruesas → voids/sink ("internal voids may be formed")',
      ok: ratio <= 2,
      ref: '§2.3.1',
    },
  ];
  return {
    moldable, verdicts,
    undercut: { columnsPct: +underPct.toFixed(1), volumeMm3: Math.round(volUnder), enclosedVoids, regions },
    draft: { pctBelowMin: +draftMinPct.toFixed(1), pctBelowTable: +draftTabPct.toFixed(1), minDeg: DRAFT_MIN_DEG, tableDeg, lateralAreaMm2: Math.round(latArea) },
    wall: { nominalMm: +nominal.toFixed(2), p50Mm: +p50.toFixed(2), p95Mm: +p95.toFixed(2), ratio: +ratio.toFixed(2) },
    orient: { coreReliefAsIsMm: +reliefAsIs.toFixed(1), coreReliefFlippedMm: +reliefFlip.toFixed(1), flipRecommended },
    projectedAreaMm2: +(nSolid * cellA).toFixed(1),
    warpageTopology: classifyWarpageTopology(solid, G, GY),
    regionsDetail,
  };
}
