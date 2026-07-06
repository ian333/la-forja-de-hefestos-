/**
 * La Forja — MATEMÁTICA del PRINT-IN-PLACE (el ladrillo).
 * =======================================================
 * Idea del fundador: círculo dentro de círculo dentro de círculo, separados por
 * el gap, = un BALERO, sí o sí. Es el caso MÁS SIMPLE de print-in-place porque
 * las superficies del gap son cilindros VERTICALES (eje = dirección de impresión
 * Z): cero voladizo, cero puente → de las 5 desigualdades del print-in-place,
 * SOLO importa la VENTANA DE HOLGURA radial.
 *
 * Módulo PURO (sin WASM, sin GPU): testeable en node. Es el cimiento de toda
 * junta de robot — un balero es la base de cualquier eje que gira.
 *
 * Física real (no curvas inventadas):
 *   ventana de holgura  g_weld < g < g_play   (FDM, por material)
 *   balero plano (journal):  p = W/(2 r L) ≤ p_adm ;  T_fric = μ·W·r
 */

// ─────────────────────────────────────────────────────────────────
// 1) VENTANA DE HOLGURA (la única desigualdad que importa para el balero)
// ─────────────────────────────────────────────────────────────────

/** Ventana de holgura FDM (mm): debajo de `weld` las capas se sueldan; arriba de
 *  `play` la junta baila; `sweet` es el punto probado (junta + canal de grasa). */
export interface GapWindow { weld: number; sweet: number; play: number; }

export const GAP: Record<string, GapWindow> = {
  PLA:  { weld: 0.18, sweet: 0.30, play: 0.50 },
  PETG: { weld: 0.25, sweet: 0.42, play: 0.60 },
  ABS:  { weld: 0.20, sweet: 0.35, play: 0.55 },
  TPU:  { weld: 0.30, sweet: 0.45, play: 0.70 },
};

export interface ClearanceCheck { g: number; mat: string; ok: boolean; reason: 'suelda' | 'baila' | 'ok'; window: GapWindow; }

/** ¿El gap `g` cae en la ventana del material? El corazón del print-in-place. */
export function clearance(g: number, mat = 'PLA'): ClearanceCheck {
  const w = GAP[mat] ?? GAP.PLA;
  const reason: ClearanceCheck['reason'] = g <= w.weld ? 'suelda' : g >= w.play ? 'baila' : 'ok';
  return { g, mat, ok: reason === 'ok', reason, window: w };
}

// ─────────────────────────────────────────────────────────────────
// 2) BALERO de círculos ANIDADOS (el experimento del fundador)
// ─────────────────────────────────────────────────────────────────

export interface Ring { k: number; inner: number; outer: number; }
export interface NestedBearing {
  rings: Ring[];
  outerR: number;
  gap: number;
  clearance: ClearanceCheck;
  /** nº de interfaces que GIRAN: los N−1 gaps entre anillos + el barreno (eje). */
  rotatingInterfaces: number;
  /** invariante: el gap medido entre cada par de anillos consecutivos (debe ser ≡ gap). */
  measuredGaps: number[];
}

/**
 * Balero print-in-place de `rings` anillos anidados, espesor `wall`, separados por
 * `gap` (default = sweet del material). Geometría EXACTA:
 *   anillo_k.inner = bore + (k−1)(wall+gap)
 *   anillo_k.outer = anillo_k.inner + wall
 *   gap entre anillo_k y anillo_{k+1} ≡ gap   ← cilindro vertical, sin soporte
 *   outerR = bore + N·wall + (N−1)·gap
 */
export function nestedBearing(opts: { bore: number; rings: number; wall: number; gap?: number; mat?: string; }): NestedBearing {
  const mat = opts.mat ?? 'PLA';
  const gap = opts.gap ?? (GAP[mat] ?? GAP.PLA).sweet;
  const { bore, wall } = opts;
  const rings: Ring[] = [];
  for (let k = 1; k <= opts.rings; k++) {
    const inner = bore + (k - 1) * (wall + gap);
    rings.push({ k, inner, outer: inner + wall });
  }
  const measuredGaps: number[] = [];
  for (let i = 0; i < rings.length - 1; i++) measuredGaps.push(rings[i + 1].inner - rings[i].outer);
  const outerR = rings[rings.length - 1].outer;
  return {
    rings, outerR, gap,
    clearance: clearance(gap, mat),
    rotatingInterfaces: opts.rings, // (rings−1) entre anillos + 1 del barreno/eje
    measuredGaps,
  };
}

// ─────────────────────────────────────────────────────────────────
// 3) FÍSICA del balero plano (journal) — carga y fricción
// ─────────────────────────────────────────────────────────────────

/** Presión admisible aproximada (MPa) del par deslizante plástico-plástico, dry. */
export const P_ADM: Record<string, number> = { PLA: 5, PETG: 7, ABS: 6, TPU: 2 };
/** Coef. de fricción seco aproximado del par plástico-plástico. */
export const MU_DRY: Record<string, number> = { PLA: 0.35, PETG: 0.30, ABS: 0.35, TPU: 0.5 };

// ─────────────────────────────────────────────────────────────────
// 4) PILA DE TUBOS con captura por JOROBA DE COSENO (el 1er sistema real)
// ─────────────────────────────────────────────────────────────────
// Tubo recto en tubo recto = gira PERO se desliza en Z (malo). La solución del
// fundador: abultar cada tubo en el centro con una curva → lo atrapa sin soldarlo
// y lo autocentra. Una ESFERA atraparía pero dejaría 3 giros (joystick). Una
// JOROBA DE COSENO (de revolución, solo varía con z) atrapa + autocentra + deja
// SOLO el giro sobre el eje. Todas las superficies suben la MISMA joroba → el gap
// se conserva. La pendiente de la joroba debe caber en el cono de impresión.

/** Joroba de coseno: 0 en z=0 y z=H, pico A en z=H/2 (de revolución). */
export function cosineHump(z: number, H: number, A: number): number {
  return (A * (1 - Math.cos((2 * Math.PI * z) / H))) / 2;
}
/** Pendiente |dr/dz| de la joroba en z (controla el voladizo de impresión). */
export function humpSlope(z: number, H: number, A: number): number {
  return Math.abs(A * (Math.PI / H) * Math.sin((2 * Math.PI * z) / H));
}

export interface TubeStack {
  H: number; layers: number; gap: number; bulge: number; tubes: number;
  baseRadii: number[];                       // radios base de las 2N superficies
  levels: { z: number; radii: number[] }[];  // radio de cada superficie por nivel
  surfaces: number;
  maxSlope: number;
  overhangDeg: number;
  buildable: boolean;        // pendiente máx ≤ tan(voladizo máx) → imprime sin aire
  axialPlayMm: number;       // gap/pendiente — cuánto desliza antes de topar (∞ = recto)
  captured: boolean;         // joroba>0 → atrapado (no se separa)
}

/**
 * Pila de `tubes` tubos anidados (barreno `bore`, pared `wall`, gap), altura `H`
 * en `layers` capas, abultados por una joroba de coseno de amplitud `bulge`.
 * Recto (bulge=0): se desliza en Z. Con joroba: atrapado + autocentrado + buildable
 * si la pendiente cabe en el cono.
 */
export function tubeStack(opts: { tubes: number; bore: number; wall?: number; walls?: number[]; H: number; layers: number; gap?: number; bulge?: number; mat?: string; maxOverhangDeg?: number; }): TubeStack {
  const mat = opts.mat ?? 'PLA';
  const gap = opts.gap ?? (GAP[mat] ?? GAP.PLA).sweet;
  const A = opts.bulge ?? 0;
  const maxOver = opts.maxOverhangDeg ?? 45;
  // pared POR barril (rol): eje grueso, cicloidal medio, aro de salida. O uniforme.
  const walls = opts.walls ?? Array(opts.tubes).fill(opts.wall ?? 2);
  // 2N superficies base: por tubo {inner, outer}, separadas por gap.
  const baseRadii: number[] = [];
  let r = opts.bore;
  for (let k = 0; k < opts.tubes; k++) { baseRadii.push(r); r += walls[k]; baseRadii.push(r); r += gap; }
  // niveles z (layers+1 cortes)
  const levels: TubeStack['levels'] = [];
  for (let i = 0; i <= opts.layers; i++) {
    const z = (opts.H * i) / opts.layers;
    const h = cosineHump(z, opts.H, A);
    levels.push({ z: +z.toFixed(2), radii: baseRadii.map((b) => +(b + h).toFixed(3)) });
  }
  let maxSlope = 0;
  for (let i = 0; i <= 400; i++) maxSlope = Math.max(maxSlope, humpSlope((opts.H * i) / 400, opts.H, A));
  const tanMax = Math.tan((maxOver * Math.PI) / 180);
  return {
    H: opts.H, layers: opts.layers, gap, bulge: A, tubes: opts.tubes,
    baseRadii, levels, surfaces: baseRadii.length,
    maxSlope: +maxSlope.toFixed(4),
    overhangDeg: +((Math.atan(maxSlope) * 180) / Math.PI).toFixed(1),
    buildable: maxSlope <= tanMax + 1e-9,
    axialPlayMm: A > 0 ? +(gap / maxSlope).toFixed(2) : Infinity,
    captured: A > 0,
  };
}

export interface JournalBearing {
  projectedArea: number;   // mm² = 2·r·L
  pressureMPa: number;     // p = W / area
  ok: boolean;             // p ≤ p_adm
  frictionTorqueNmm: number; // T = μ·W·r
}

/**
 * Balero plano cargado radialmente: `boreR` (radio del eje, mm), `length` (mm),
 * `loadN` (carga radial, N), material. p = W/(2·r·L); T_fric = μ·W·r.
 */
export function journalBearing(opts: { boreR: number; length: number; loadN: number; mat?: string; mu?: number; }): JournalBearing {
  const mat = opts.mat ?? 'PLA';
  const mu = opts.mu ?? (MU_DRY[mat] ?? 0.35);
  const area = 2 * opts.boreR * opts.length;              // mm²
  const pressureMPa = opts.loadN / area;                   // N/mm² = MPa
  return {
    projectedArea: area,
    pressureMPa,
    ok: pressureMPa <= (P_ADM[mat] ?? 5),
    frictionTorqueNmm: mu * opts.loadN * opts.boreR,        // N·mm
  };
}
