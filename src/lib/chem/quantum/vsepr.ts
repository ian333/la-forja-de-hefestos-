/**
 * ══════════════════════════════════════════════════════════════════════
 *  quantum/vsepr — Valence Shell Electron Pair Repulsion
 * ══════════════════════════════════════════════════════════════════════
 *
 * Predicción de geometría molecular desde el conteo de dominios de
 * electrones (pares enlazantes + pares libres) alrededor de un átomo
 * central. Las geometrías son resultado de minimizar la repulsión
 * electrón-electrón colocando los dominios lo más lejos posible sobre
 * la esfera unitaria.
 *
 * Notación de dominios (Gillespie):
 *     AX_n E_m  donde A = átomo central, X = par enlazante, E = par libre.
 *     n + m = "número estérico" → determina la GEOMETRÍA ELECTRÓNICA.
 *     n      = pares enlazantes  → determina la GEOMETRÍA MOLECULAR.
 *
 * Ángulos ideales (sin distorsión por pares libres):
 *     2 dominios → 180°  (lineal)
 *     3          → 120°  (trigonal plana)
 *     4          → 109.47° (tetraédrica)
 *     5          → 90/120° (trigonal bipiramidal)
 *     6          → 90°   (octaédrica)
 *
 * Distorsión por pares libres (regla de Bent / Gillespie):
 *     repulsión: lone-lone > lone-bond > bond-bond
 *     → el ángulo bond-bond se REDUCE en presencia de pares libres.
 *     Ej. H₂O: tetraédrica AX₂E₂, ideal 109.47°, experimental 104.52° → −4.95°.
 *     Ej. NH₃: tetraédrica AX₃E, ideal 109.47°, experimental 106.7° → −2.77°.
 *
 * Esta tabla NO es una "corrección ad hoc"; las correcciones empíricas se
 * tomaron de los compuestos prototipo medidos en NIST CCCBDB y aplican
 * sólo cuando el solicitante NO sobre-especifica el ángulo.
 *
 * Ref [V1] Gillespie, R.J. & Nyholm, R.S. "Inorganic stereochemistry",
 *          Q. Rev. Chem. Soc. 11, 339-380 (1957). Paper fundacional.
 * Ref [V2] Gillespie, R.J. & Hargittai, I. "The VSEPR Model of Molecular
 *          Geometry", Allyn & Bacon, 1991.
 * Ref [V3] Gillespie, R.J. "Fifty years of the VSEPR model", Coord. Chem.
 *          Rev. 252, 1315-1327 (2008).
 * Ref [V4] NIST CCCBDB experimental geometries (cccbdb.nist.gov).
 */

export type Vec3 = [number, number, number];

/** Forma molecular (sólo X's; las E's no se ven). */
export type Shape =
  | 'linear'
  | 'bent'
  | 'trigonal-planar'
  | 'trigonal-pyramidal'
  | 'tetrahedral'
  | 'trigonal-bipyramidal'
  | 'seesaw'
  | 't-shaped'
  | 'octahedral'
  | 'square-pyramidal'
  | 'square-planar';

export interface VseprResult {
  /** Geometría electrónica (incluye E's). */
  electronGeometry: 'linear' | 'trigonal-planar' | 'tetrahedral' | 'trigonal-bipyramidal' | 'octahedral';
  /** Geometría molecular (sólo X's visibles). */
  shape: Shape;
  /** Vectores unitarios para CADA par enlazante (longitud = bonds.length). */
  bondDirections: Vec3[];
  /** Vectores unitarios para CADA par libre (longitud = lonePairs.length). */
  lonePairDirections: Vec3[];
  /** Ángulo ideal entre bonds (antes de distorsión por LP). Grados. */
  idealAngleDeg: number;
  /** Ángulo realista (con compresión empírica por pares libres). Grados. */
  effectiveAngleDeg: number;
}

const DEG2RAD = Math.PI / 180;

/**
 * Construye direcciones VSEPR para un átomo central con `bonds` pares
 * enlazantes y `lonePairs` pares libres.
 *
 * `bonds + lonePairs` = número estérico ∈ [2, 6]. Para casos > 6 (algunos
 * complejos de transición) este modelo simple no aplica.
 */
export function vsepr(bonds: number, lonePairs: number): VseprResult {
  const steric = bonds + lonePairs;
  if (steric < 2 || steric > 6) {
    throw new Error(`VSEPR fuera de rango: bonds=${bonds} lonePairs=${lonePairs} → steric=${steric}`);
  }
  if (bonds < 1) {
    throw new Error(`Necesita al menos 1 par enlazante; recibí ${bonds}`);
  }

  switch (steric) {
    case 2: return resolveSteric2(bonds);
    case 3: return resolveSteric3(bonds, lonePairs);
    case 4: return resolveSteric4(bonds, lonePairs);
    case 5: return resolveSteric5(bonds, lonePairs);
    case 6: return resolveSteric6(bonds, lonePairs);
    default: throw new Error(`unreachable`);
  }
}

// ═══════════════════════════════════════════════════════════════
// STERIC 2 — Lineal (CO₂, BeH₂, HCN central)
// ═══════════════════════════════════════════════════════════════
function resolveSteric2(bonds: number): VseprResult {
  // 180°. Dos dominios en ±X. Si lps=1 (AXE, raro: HC=O en alguna canónica),
  // el bond ocupa una posición y el LP la opuesta.
  const dirs: Vec3[] = [[1, 0, 0], [-1, 0, 0]];
  return {
    electronGeometry: 'linear',
    shape: 'linear',
    bondDirections: dirs.slice(0, bonds),
    lonePairDirections: dirs.slice(bonds),
    idealAngleDeg: 180,
    effectiveAngleDeg: 180,
  };
}

// ═══════════════════════════════════════════════════════════════
// STERIC 3 — Trigonal plana (BF₃, formaldehyde C central) / Bent (SO₂)
// ═══════════════════════════════════════════════════════════════
function resolveSteric3(bonds: number, lonePairs: number): VseprResult {
  // Tres dominios en 120° en el plano XY.
  const r3 = Math.sqrt(3) / 2;
  const all: Vec3[] = [
    [1, 0, 0],
    [-0.5,  r3, 0],
    [-0.5, -r3, 0],
  ];
  if (lonePairs === 0) {
    return {
      electronGeometry: 'trigonal-planar',
      shape: 'trigonal-planar',
      bondDirections: all,
      lonePairDirections: [],
      idealAngleDeg: 120,
      effectiveAngleDeg: 120,
    };
  }
  // AX₂E → bent (~119° por compresión). Ej. SO₂ exp = 119.3° (CCCBDB).
  return {
    electronGeometry: 'trigonal-planar',
    shape: 'bent',
    bondDirections: all.slice(0, bonds),
    lonePairDirections: all.slice(bonds),
    idealAngleDeg: 120,
    effectiveAngleDeg: 119,
  };
}

// ═══════════════════════════════════════════════════════════════
// STERIC 4 — Tetraédrica (CH₄) / Piramidal (NH₃) / Bent (H₂O)
// ═══════════════════════════════════════════════════════════════
function resolveSteric4(bonds: number, lonePairs: number): VseprResult {
  // Vértices de tetraedro regular inscrito en el cubo.
  // Ángulo interno tet = arccos(-1/3) = 109.4712°.
  const t: Vec3[] = [
    [ 1,  1,  1],
    [ 1, -1, -1],
    [-1,  1, -1],
    [-1, -1,  1],
  ].map(normalize) as Vec3[];

  // Compresión empírica por pares libres (NIST CCCBDB).
  let eff = 109.47;
  let shape: Shape = 'tetrahedral';
  if (lonePairs === 1) { shape = 'trigonal-pyramidal'; eff = 106.7; } // NH₃
  if (lonePairs === 2) { shape = 'bent'; eff = 104.5; }               // H₂O
  if (lonePairs === 3) { shape = 'linear'; eff = 180; }               // HF, etc.

  return {
    electronGeometry: 'tetrahedral',
    shape,
    bondDirections: t.slice(0, bonds),
    lonePairDirections: t.slice(bonds),
    idealAngleDeg: 109.47,
    effectiveAngleDeg: eff,
  };
}

// ═══════════════════════════════════════════════════════════════
// STERIC 5 — Trigonal bipiramidal (PCl₅) y derivados
// ═══════════════════════════════════════════════════════════════
function resolveSteric5(bonds: number, lonePairs: number): VseprResult {
  // 3 ecuatoriales a 120° + 2 axiales en ±z.
  // Los pares libres prefieren posiciones ECUATORIALES (más espacio).
  const r3 = Math.sqrt(3) / 2;
  // Orden: 3 ecuatoriales primero (preferencia de LPs), luego 2 axiales.
  const slots: Vec3[] = [
    [1, 0, 0],
    [-0.5,  r3, 0],
    [-0.5, -r3, 0],
    [0, 0,  1],
    [0, 0, -1],
  ];

  let shape: Shape = 'trigonal-bipyramidal';
  if (lonePairs === 1) shape = 'seesaw';
  if (lonePairs === 2) shape = 't-shaped';
  if (lonePairs === 3) shape = 'linear';

  // LPs ocupan los primeros `lonePairs` slots (ecuatoriales preferidos);
  // bonds toman el resto. Suma garantizada = bonds + lonePairs = 5.
  return {
    electronGeometry: 'trigonal-bipyramidal',
    shape,
    bondDirections: slots.slice(lonePairs, lonePairs + bonds),
    lonePairDirections: slots.slice(0, lonePairs),
    idealAngleDeg: 90,
    effectiveAngleDeg: 90,
  };
}

// ═══════════════════════════════════════════════════════════════
// STERIC 6 — Octaédrica (SF₆) y derivados
// ═══════════════════════════════════════════════════════════════
function resolveSteric6(bonds: number, lonePairs: number): VseprResult {
  const all: Vec3[] = [
    [ 1, 0, 0], [-1, 0, 0],
    [0,  1, 0], [0, -1, 0],
    [0, 0,  1], [0, 0, -1],
  ];

  let shape: Shape = 'octahedral';
  if (lonePairs === 1) shape = 'square-pyramidal'; // BrF₅
  if (lonePairs === 2) shape = 'square-planar';    // XeF₄ — LPs en trans

  // Para LP=2 colocar los pares libres en posiciones TRANS (mínima repulsión).
  let lp: Vec3[] = [];
  let bd: Vec3[] = [];
  if (lonePairs === 2) {
    lp = [all[4], all[5]]; // ±z
    bd = [all[0], all[1], all[2], all[3]];
  } else {
    lp = all.slice(0, lonePairs);
    bd = all.slice(lonePairs);
  }

  return {
    electronGeometry: 'octahedral',
    shape,
    bondDirections: bd.slice(0, bonds),
    lonePairDirections: lp,
    idealAngleDeg: 90,
    effectiveAngleDeg: 90,
  };
}

// ═══════════════════════════════════════════════════════════════
// Utilidades
// ═══════════════════════════════════════════════════════════════

function normalize(v: number[]): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

/** Ángulo entre dos vectores (en grados). */
export function angleBetween(a: Vec3, b: Vec3): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const la = Math.hypot(...a);
  const lb = Math.hypot(...b);
  const cos = Math.max(-1, Math.min(1, dot / (la * lb)));
  return Math.acos(cos) / DEG2RAD;
}

/** Aplicar un offset radial uniforme a las direcciones bond. */
export function placeAtoms(center: Vec3, dirs: Vec3[], bondLengths: number[]): Vec3[] {
  if (dirs.length !== bondLengths.length) {
    throw new Error(`placeAtoms: dirs.length=${dirs.length} ≠ bondLengths.length=${bondLengths.length}`);
  }
  return dirs.map((d, i) => [
    center[0] + d[0] * bondLengths[i],
    center[1] + d[1] * bondLengths[i],
    center[2] + d[2] * bondLengths[i],
  ] as Vec3);
}
