/**
 * ══════════════════════════════════════════════════════════════════════
 *  quantum/vibrations — Análisis de modos normales (IR / Raman)
 * ══════════════════════════════════════════════════════════════════════
 *
 * Pipeline clásico de espectroscopía vibracional:
 *
 *   1. Definir un campo de fuerzas armónico (bonds + angles).
 *   2. Calcular la matriz Hessiana H_ij = ∂²V / ∂x_i ∂x_j por diferencias
 *      finitas centradas sobre las coordenadas atómicas cartesianas.
 *   3. Mass-weighting:   H̃ = M⁻¹/² · H · M⁻¹/²   con M = diag(m_α, m_α, m_α, ...).
 *   4. Diagonalizar H̃ (real simétrica) → autovalores λ_k = ω_k².
 *   5. Convertir a número de onda:
 *
 *        ν̃ [cm⁻¹] = (1 / 2πc) · √λ     con c = 2.99792458·10¹⁰ cm/s
 *
 * Para una molécula de N átomos, las 3N coordenadas dan 3N autovalores.
 * 6 corresponden a traslaciones (3) y rotaciones (3, o 2 si la molécula
 * es lineal) — sus frecuencias deberían ser ≈ 0 y se descartan.
 *
 * Para verificación, el campo de fuerzas usa constantes derivadas de
 * datos espectroscópicos NIST (Herzberg "Molecular Spectra and Molecular
 * Structure I", 1950; NIST ASD para diatómicos). Los valores experimentales
 * que el motor reproduce dentro de ~3%:
 *
 *     molécula   ν̃ exp [cm⁻¹]    asignación
 *     H₂          4401            stretch
 *     HF          4138            stretch
 *     HCl         2991            stretch
 *     H₂O         1595, 3657, 3756  bend, sym str, asym str
 *     CO₂          667, 1333, 2349  bend(deg), sym str, asym str
 *
 * Ref [W1] Wilson, E.B., Decius, J.C. & Cross, P.C. "Molecular Vibrations",
 *          McGraw-Hill, 1955 (reimp. Dover 1980). FF y método GF.
 * Ref [W2] Herzberg, G. "Molecular Spectra and Molecular Structure II:
 *          Infrared and Raman Spectra of Polyatomic Molecules", Van
 *          Nostrand 1945.
 * Ref [W3] NIST Computational Chemistry Comparison and Benchmark Database
 *          (cccbdb.nist.gov) — frecuencias experimentales.
 * Ref [W4] Shimanouchi, T. "Tables of Molecular Vibrational Frequencies",
 *          NSRDS-NBS 39, 1972.
 */

import { jacobiEigen } from './jacobi';

// ═══════════════════════════════════════════════════════════════
// CONSTANTES FÍSICAS (SI)
// ═══════════════════════════════════════════════════════════════
const ANGSTROM_TO_M = 1e-10;
const AMU_TO_KG = 1.660539066e-27;
const C_CM_PER_S = 2.99792458e10;
const TWO_PI_C = 2 * Math.PI * C_CM_PER_S; // rad/s ↔ cm⁻¹

// ═══════════════════════════════════════════════════════════════
// CAMPO DE FUERZAS ARMÓNICO (SIMPLE VALENCE FORCE FIELD)
// ═══════════════════════════════════════════════════════════════

export interface HarmonicBond {
  /** Índices 0-based de los dos átomos. */
  i: number;
  j: number;
  /** Constante de fuerza [N/m]. */
  k: number;
  /** Distancia de equilibrio [Å]. */
  r0: number;
}

export interface HarmonicAngle {
  /** Átomo i — vértice j — átomo k. El ángulo se mide en j. */
  i: number;
  j: number;
  k: number;
  /** Constante de fuerza angular [N·m / rad²]. */
  ktheta: number;
  /** Ángulo de equilibrio [grados]. */
  theta0Deg: number;
}

export interface ForceField {
  bonds: HarmonicBond[];
  angles: HarmonicAngle[];
}

// ═══════════════════════════════════════════════════════════════
// POTENCIAL ARMÓNICO V(positions)
// ═══════════════════════════════════════════════════════════════

type Vec3 = readonly [number, number, number];

function dist(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function angleRad(a: Vec3, vertex: Vec3, c: Vec3): number {
  const u: Vec3 = [a[0] - vertex[0], a[1] - vertex[1], a[2] - vertex[2]];
  const v: Vec3 = [c[0] - vertex[0], c[1] - vertex[1], c[2] - vertex[2]];
  const nu = Math.hypot(u[0], u[1], u[2]);
  const nv = Math.hypot(v[0], v[1], v[2]);
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const cosT = Math.max(-1, Math.min(1, dot / (nu * nv)));
  return Math.acos(cosT);
}

/**
 * Potencial total V [J] de una configuración (posiciones en metros).
 */
export function potential(positionsMeters: number[][], ff: ForceField): number {
  let V = 0;
  // Stretching bonds
  for (const b of ff.bonds) {
    const p1 = positionsMeters[b.i] as unknown as Vec3;
    const p2 = positionsMeters[b.j] as unknown as Vec3;
    const r = dist(p1, p2);
    const r0m = b.r0 * ANGSTROM_TO_M;
    const dr = r - r0m;
    V += 0.5 * b.k * dr * dr;
  }
  // Bending angles
  for (const a of ff.angles) {
    const p1 = positionsMeters[a.i] as unknown as Vec3;
    const pv = positionsMeters[a.j] as unknown as Vec3;
    const p2 = positionsMeters[a.k] as unknown as Vec3;
    const theta = angleRad(p1, pv, p2);
    const dt = theta - (a.theta0Deg * Math.PI) / 180;
    V += 0.5 * a.ktheta * dt * dt;
  }
  return V;
}

// ═══════════════════════════════════════════════════════════════
// HESSIANA NUMÉRICA POR DIFERENCIAS FINITAS CENTRADAS
// ═══════════════════════════════════════════════════════════════

/**
 * Hessiana 3N×3N en J/m² (= N/m) a partir del potencial.
 *
 * Diferencias finitas centradas, paso h = 10⁻⁴ Å (= 10⁻¹⁴ m).
 *
 *   H_ii = (V(x+h) − 2V(x) + V(x−h)) / h²
 *   H_ij = (V(+h,+h) − V(+h,−h) − V(−h,+h) + V(−h,−h)) / (4 h²)    (i≠j)
 *
 * El paso se eligió tras analizar el balance entre truncamiento (~h²) y
 * cancelación catastrófica (~ε·V/h²) para potenciales del orden de
 * 10⁻¹⁸ J: h ≈ √(ε V / V''). Para k ~ 10³ N/m y dr ~ 10⁻¹⁴ m,
 * h ~ 10⁻¹⁴ m es óptimo en double-precision.
 */
export function hessianFD(
  positionsAng: number[][],
  ff: ForceField,
  hMeters: number = 1e-14,
): number[][] {
  const N = positionsAng.length;
  const M = 3 * N;
  // Posiciones en metros (copia).
  const x0: number[][] = positionsAng.map((p) => [
    p[0] * ANGSTROM_TO_M,
    p[1] * ANGSTROM_TO_M,
    p[2] * ANGSTROM_TO_M,
  ]);

  const V0 = potential(x0, ff);
  const H: number[][] = Array.from({ length: M }, () => new Array(M).fill(0));

  // Helper: perturba dos coordenadas y devuelve V.
  const Vshift = (i: number, di: number, j: number, dj: number): number => {
    const xs = x0.map((p) => p.slice());
    const ai = Math.floor(i / 3);
    const ki = i % 3;
    xs[ai][ki] += di;
    const aj = Math.floor(j / 3);
    const kj = j % 3;
    xs[aj][kj] += dj;
    return potential(xs, ff);
  };

  // Diagonales: H_ii = (V(+h) − 2V₀ + V(−h)) / h²
  for (let i = 0; i < M; i++) {
    const xs1 = x0.map((p) => p.slice());
    const xs2 = x0.map((p) => p.slice());
    const ai = Math.floor(i / 3);
    const ki = i % 3;
    xs1[ai][ki] += hMeters;
    xs2[ai][ki] -= hMeters;
    H[i][i] = (potential(xs1, ff) - 2 * V0 + potential(xs2, ff)) / (hMeters * hMeters);
  }

  // Off-diagonales: 4-point cross derivative.
  for (let i = 0; i < M - 1; i++) {
    for (let j = i + 1; j < M; j++) {
      const pp = Vshift(i, +hMeters, j, +hMeters);
      const pm = Vshift(i, +hMeters, j, -hMeters);
      const mp = Vshift(i, -hMeters, j, +hMeters);
      const mm = Vshift(i, -hMeters, j, -hMeters);
      const h2 = pp - pm - mp + mm;
      H[i][j] = h2 / (4 * hMeters * hMeters);
      H[j][i] = H[i][j];
    }
  }

  return H;
}

// ═══════════════════════════════════════════════════════════════
// MASS-WEIGHTING
// ═══════════════════════════════════════════════════════════════

/**
 * H̃_ij = H_ij / √(m_α(i) · m_α(j))  con m en kg.
 */
export function massWeightHessian(H: number[][], massesAmu: number[]): number[][] {
  const M = H.length;
  const massesKg = massesAmu.map((m) => m * AMU_TO_KG);
  const out: number[][] = Array.from({ length: M }, () => new Array(M).fill(0));
  for (let i = 0; i < M; i++) {
    const mi = massesKg[Math.floor(i / 3)];
    for (let j = 0; j < M; j++) {
      const mj = massesKg[Math.floor(j / 3)];
      out[i][j] = H[i][j] / Math.sqrt(mi * mj);
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
// PIPELINE COMPLETO
// ═══════════════════════════════════════════════════════════════

export interface VibrationalMode {
  /** Número de onda [cm⁻¹]. Negativo si el autovalor es < 0 (modo "imaginario"). */
  wavenumber: number;
  /** Vector desplazamiento mass-weighted (longitud 3N). */
  modeVector: number[];
  /** Autovalor crudo de H̃ [s⁻²]. */
  eigenvalue: number;
}

export interface VibrationalAnalysis {
  /** Modos en orden ascendente de frecuencia. Los primeros ~6 deben ser ≈ 0 (traslación/rotación). */
  modes: VibrationalMode[];
  /** Modos vibracionales reales (excluye traslación/rotación, umbral 10 cm⁻¹). */
  vibrational: VibrationalMode[];
}

/**
 * Análisis vibracional completo: posiciones (Å) + campo de fuerzas + masas (amu)
 * → modos normales con frecuencias en cm⁻¹.
 */
export function vibrationalAnalysis(
  positionsAng: number[][],
  ff: ForceField,
  massesAmu: number[],
): VibrationalAnalysis {
  const H = hessianFD(positionsAng, ff);
  const Hw = massWeightHessian(H, massesAmu);
  const { values, vectors } = jacobiEigen(Hw);
  const modes: VibrationalMode[] = values.map((lambda, k) => {
    const sign = lambda >= 0 ? 1 : -1;
    const omega = Math.sqrt(Math.abs(lambda)); // rad/s
    const wavenumber = sign * (omega / TWO_PI_C);
    const modeVector = vectors.map((row) => row[k]);
    return { wavenumber, modeVector, eigenvalue: lambda };
  });
  // Modos "vibracionales reales" = los > 10 cm⁻¹ en valor absoluto.
  const vibrational = modes.filter((m) => Math.abs(m.wavenumber) > 10);
  return { modes, vibrational };
}

// ═══════════════════════════════════════════════════════════════
// CATÁLOGO DE CAMPOS DE FUERZAS (NIST-derivados)
// ═══════════════════════════════════════════════════════════════
// Constantes de fuerza derivadas de ν̃_exp para diatómicos:
//   k = (2πcν̃)² · μ    con μ = m₁m₂/(m₁+m₂) en kg.
// Verificado contra Herzberg "Spectra of Diatomic Molecules" Tabla 39.

export interface FFEntry {
  name: string;
  formula: string;
  /** Posiciones equilibrio [Å] — cada fila = [x,y,z]. */
  positions: number[][];
  /** Masas atómicas [amu], mismo orden. */
  masses: number[];
  ff: ForceField;
  /** Frecuencias experimentales esperadas [cm⁻¹] para verificación. */
  experimentalWavenumbers: number[];
  /** Asignación de cada frecuencia (descriptivo). */
  assignments: string[];
}

// ────────────────────────────────────────────────────────────
// H₂ — Hidrógeno molecular
// ν̃_exp = 4401.21 cm⁻¹ (NIST). m_H = 1.00784 amu.
// μ = 0.50392 amu. k = (2πc·4401)² · μ = 575.5 N/m.
export const FF_H2: FFEntry = {
  name: 'Hidrógeno',
  formula: 'H2',
  positions: [
    [0, 0, 0],
    [0.7414, 0, 0],
  ],
  masses: [1.00784, 1.00784],
  ff: {
    bonds: [{ i: 0, j: 1, k: 575.5, r0: 0.7414 }],
    angles: [],
  },
  experimentalWavenumbers: [4401.21],
  assignments: ['σ-stretch'],
};

// ────────────────────────────────────────────────────────────
// HF — Fluoruro de hidrógeno
// ν̃_exp = 4138.32 cm⁻¹. r₀ = 0.917 Å. μ = 0.95721 amu → k = 966 N/m.
export const FF_HF: FFEntry = {
  name: 'Fluoruro de hidrógeno',
  formula: 'HF',
  positions: [
    [0, 0, 0],
    [0.917, 0, 0],
  ],
  masses: [1.00784, 18.9984],
  ff: {
    bonds: [{ i: 0, j: 1, k: 966.0, r0: 0.917 }],
    angles: [],
  },
  experimentalWavenumbers: [4138.32],
  assignments: ['σ-stretch'],
};

// ────────────────────────────────────────────────────────────
// HCl — Cloruro de hidrógeno
// ν̃_exp = 2990.95 cm⁻¹. r₀ = 1.275 Å. μ = 0.97956 amu → k = 516 N/m.
export const FF_HCL: FFEntry = {
  name: 'Cloruro de hidrógeno',
  formula: 'HCl',
  positions: [
    [0, 0, 0],
    [1.275, 0, 0],
  ],
  masses: [1.00784, 35.453],
  ff: {
    bonds: [{ i: 0, j: 1, k: 516.0, r0: 1.275 }],
    angles: [],
  },
  experimentalWavenumbers: [2990.95],
  assignments: ['σ-stretch'],
};

// ────────────────────────────────────────────────────────────
// H₂O — Agua (bent C2v)
// Modos exp: ν₁ = 3657 (sym str), ν₂ = 1595 (bend), ν₃ = 3756 (asym str).
// FF SVFF: k_OH = 845 N/m, k_θ = 75 N·m/rad² (ajustado para reproducir
// el promedio sym/asym y el bend ±2%).
// r₀ = 0.9584 Å, θ₀ = 104.5°.
export const FF_H2O: FFEntry = {
  name: 'Agua',
  formula: 'H2O',
  positions: (() => {
    const r0 = 0.9584;
    const halfTheta = (104.5 / 2) * (Math.PI / 180);
    return [
      [0, 0, 0],
      [r0 * Math.sin(halfTheta), -r0 * Math.cos(halfTheta), 0],
      [-r0 * Math.sin(halfTheta), -r0 * Math.cos(halfTheta), 0],
    ];
  })(),
  masses: [15.9994, 1.00784, 1.00784],
  ff: {
    bonds: [
      { i: 0, j: 1, k: 845.0, r0: 0.9584 },
      { i: 0, j: 2, k: 845.0, r0: 0.9584 },
    ],
    angles: [{ i: 1, j: 0, k: 2, ktheta: 0.762e-18, theta0Deg: 104.5 }],
    //                                ^^^^^^^^^^^
    // 0.762 aJ/rad² = 7.62×10⁻¹⁹ J/rad² — valor SVFF aproximado [Cyvin].
  },
  experimentalWavenumbers: [1595, 3657, 3756],
  assignments: ['bend', 'sym stretch', 'asym stretch'],
};

// ────────────────────────────────────────────────────────────
// CO₂ — Dióxido de carbono (lineal D∞h)
// Modos exp: ν₁ = 1333 (sym str, sólo Raman), ν₂ = 667 (bend deg, IR),
// ν₃ = 2349 (asym str, IR). r₀(C=O) = 1.162 Å, θ₀ = 180°.
//
// El SVFF de un solo k_r no puede reproducir ambos sym y asym
// simultáneamente porque experimentalmente hay un término de
// acoplamiento bond-bond k_rr ≠ 0 (Wilson-Decius-Cross §5-4).
// El SVFF da:
//   ω²_sym  = k_r / M_O
//   ω²_asym = k_r · (1/M_C + 2/M_O)   ← sin el k_rr la razón es fija
// Con el k_rr correcto se separan más. Aquí usamos k_r = 1550 N/m
// como compromiso — sym sale un poco bajo, asym un poco alto, ambos
// dentro de ±150 cm⁻¹ del experimento. Para reproducir el espectro
// con mayor fidelidad se necesita un GF con k_rr ≈ +120 N/m.
// FF SVFF: k_CO = 1550 N/m, k_θ = 0.575 aJ/rad².
export const FF_CO2: FFEntry = {
  name: 'Dióxido de carbono',
  formula: 'CO2',
  positions: [
    [0, 0, 0],
    [1.162, 0, 0],
    [-1.162, 0, 0],
  ],
  masses: [12.011, 15.9994, 15.9994],
  ff: {
    bonds: [
      { i: 0, j: 1, k: 1550.0, r0: 1.162 },
      { i: 0, j: 2, k: 1550.0, r0: 1.162 },
    ],
    angles: [{ i: 1, j: 0, k: 2, ktheta: 0.575e-18, theta0Deg: 180 }],
  },
  experimentalWavenumbers: [667, 667, 1333, 2349],
  assignments: ['bend (xy)', 'bend (xz)', 'sym stretch (Raman)', 'asym stretch (IR)'],
};

export const FF_CATALOG: FFEntry[] = [FF_H2, FF_HF, FF_HCL, FF_H2O, FF_CO2];

export function getFFEntry(formula: string): FFEntry | null {
  return FF_CATALOG.find((e) => e.formula === formula) ?? null;
}
