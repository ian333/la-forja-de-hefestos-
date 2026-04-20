/**
 * ══════════════════════════════════════════════════════════════════════
 * ⚗️  ChemLab — Cinética Química (motor numérico puro)
 * ══════════════════════════════════════════════════════════════════════
 *
 * Simulador determinista de reacciones basado en leyes clásicas.
 * SIN dependencias externas, SIN backend, SIN IA. Solo fórmulas.
 *
 * REFERENCIAS:
 *   [A1] Arrhenius, S. "Über die Reaktionsgeschwindigkeit bei der Inversion
 *        von Rohrzucker durch Säuren", Z. Phys. Chem. 4, 226–248 (1889).
 *   [A2] Atkins, P. & de Paula, J. "Physical Chemistry", 11th ed., OUP, 2018.
 *        Capítulo 17 (cinética química).
 *   [A3] Runge, C. "Über die numerische Auflösung von Differentialgleichungen",
 *        Math. Ann. 46, 167–178 (1895). Integrador clásico de 4º orden.
 *   [A4] Levenspiel, O. "Chemical Reaction Engineering", 3rd ed., Wiley, 1998.
 */

import { CONSTANTS } from './elements';

// ═══════════════════════════════════════════════════════════════
// 1. ECUACIÓN DE ARRHENIUS
// ═══════════════════════════════════════════════════════════════

/**
 * Constante de velocidad k(T) — Ref [A1] Arrhenius 1889
 *
 *   k = A · exp(-Ea / (R·T))
 *
 * @param A  Factor preexponencial (unidades dependen del orden total de la reacción)
 * @param Ea Energía de activación [J/mol]
 * @param T  Temperatura absoluta [K]
 * @returns  Constante de velocidad k
 */
export function arrhenius(A: number, Ea: number, T: number): number {
  return A * Math.exp(-Ea / (CONSTANTS.R * T));
}

/** Versión extendida con dependencia en T^n — Ref [A2] Atkins §17.8 */
export function arrheniusExtended(A: number, n: number, Ea: number, T: number): number {
  return A * Math.pow(T, n) * Math.exp(-Ea / (CONSTANTS.R * T));
}

// ═══════════════════════════════════════════════════════════════
// 2. ESTRUCTURA DE REACCIÓN
// ═══════════════════════════════════════════════════════════════

export interface Species {
  /** Coeficiente estequiométrico ν (positivo) */
  nu: number;
  /** Nombre de la especie química (p.ej. "H2", "O2", "H2O") */
  species: string;
  /** Orden de reacción (potencia en la ley de velocidad). Default = nu */
  order?: number;
}

export interface ReactionStep {
  /** Nombre legible del paso elemental */
  name?: string;
  /** Lado izquierdo: reactantes */
  reactants: Species[];
  /** Lado derecho: productos */
  products: Species[];
  /** Factor preexponencial de la reacción directa */
  A: number;
  /** Energía de activación directa [J/mol] */
  Ea: number;
  /** Si es reversible, parámetros de la reacción inversa */
  reversible?: boolean;
  A_rev?: number;
  Ea_rev?: number;
  /** Entalpía de reacción ΔH [J/mol] — para termodinámica opcional */
  deltaH?: number;
}

export type Concentrations = Record<string, number>;

// ═══════════════════════════════════════════════════════════════
// 3. LEY DE VELOCIDAD
// ═══════════════════════════════════════════════════════════════

/**
 * Velocidad neta de una reacción elemental — Ref [A4] Levenspiel §2.2
 *
 *   r = k_f · ∏ [reactivo_i]^orden_i  −  k_r · ∏ [producto_j]^orden_j
 *
 * Retorna cero si cualquier concentración se hace negativa (clamping).
 */
export function rateOf(step: ReactionStep, T: number, C: Concentrations): number {
  const kf = arrhenius(step.A, step.Ea, T);
  let rf = kf;
  for (const r of step.reactants) {
    const order = r.order ?? r.nu;
    const c = Math.max(0, C[r.species] ?? 0);
    rf *= Math.pow(c, order);
  }
  if (step.reversible && step.A_rev !== undefined && step.Ea_rev !== undefined) {
    const kr = arrhenius(step.A_rev, step.Ea_rev, T);
    let rr = kr;
    for (const p of step.products) {
      const order = p.order ?? p.nu;
      const c = Math.max(0, C[p.species] ?? 0);
      rr *= Math.pow(c, order);
    }
    return rf - rr;
  }
  return rf;
}

/**
 * Sistema de ODEs de balance de masa:
 *
 *   dC_i/dt = Σ (ν_prod,i − ν_reac,i) · r_reacción
 *
 * Ref [A2] Atkins §17.2, [A4] Levenspiel §2.3
 */
export function derivatives(
  steps: ReactionStep[],
  T: number,
  C: Concentrations,
): Concentrations {
  const dC: Concentrations = {};
  for (const s of Object.keys(C)) dC[s] = 0;
  for (const step of steps) {
    const r = rateOf(step, T, C);
    for (const reac of step.reactants) {
      dC[reac.species] = (dC[reac.species] ?? 0) - reac.nu * r;
    }
    for (const prod of step.products) {
      dC[prod.species] = (dC[prod.species] ?? 0) + prod.nu * r;
    }
  }
  return dC;
}

// ═══════════════════════════════════════════════════════════════
// 4. INTEGRADOR RK4 — Runge-Kutta 4º orden
// ═══════════════════════════════════════════════════════════════
// Ref [A3] Runge 1895. Error local O(dt⁵), global O(dt⁴).

function scale(C: Concentrations, s: number): Concentrations {
  const out: Concentrations = {};
  for (const k of Object.keys(C)) out[k] = (C[k] ?? 0) * s;
  return out;
}

function add(a: Concentrations, b: Concentrations): Concentrations {
  const out: Concentrations = { ...a };
  for (const k of Object.keys(b)) out[k] = (out[k] ?? 0) + (b[k] ?? 0);
  return out;
}

/**
 * Avanza un paso RK4 del sistema de ODEs químicas.
 * El clamping a [0, ∞) se aplica al final para preservar significado físico.
 */
export function rk4Step(
  steps: ReactionStep[],
  T: number,
  C: Concentrations,
  dt: number,
): Concentrations {
  const k1 = derivatives(steps, T, C);
  const k2 = derivatives(steps, T, add(C, scale(k1, dt / 2)));
  const k3 = derivatives(steps, T, add(C, scale(k2, dt / 2)));
  const k4 = derivatives(steps, T, add(C, scale(k3, dt)));
  const next: Concentrations = {};
  for (const k of Object.keys(C)) {
    const incr = (dt / 6) * ((k1[k] ?? 0) + 2 * (k2[k] ?? 0) + 2 * (k3[k] ?? 0) + (k4[k] ?? 0));
    next[k] = Math.max(0, (C[k] ?? 0) + incr);
  }
  return next;
}

/**
 * Simula N pasos y retorna la trayectoria completa { t[], C[species][] }.
 * Útil para graficar concentración vs. tiempo.
 */
export interface Trajectory {
  t: number[];                        // tiempos [s]
  C: Record<string, number[]>;        // species → serie temporal
  species: string[];
  T: number;                          // temperatura usada
  dt: number;
}

export function simulate(
  steps: ReactionStep[],
  T: number,
  C0: Concentrations,
  dt: number,
  nSteps: number,
): Trajectory {
  const species = Object.keys(C0);
  const traj: Trajectory = {
    t: [0],
    C: Object.fromEntries(species.map((s) => [s, [C0[s]]])),
    species,
    T,
    dt,
  };
  let C = { ...C0 };
  for (let i = 1; i <= nSteps; i++) {
    C = rk4Step(steps, T, C, dt);
    traj.t.push(i * dt);
    for (const s of species) traj.C[s].push(C[s] ?? 0);
  }
  return traj;
}

// ═══════════════════════════════════════════════════════════════
// 5. BALANCE / VERIFICACIÓN
// ═══════════════════════════════════════════════════════════════

/**
 * Verifica balance de masa/átomos en una reacción elemental.
 * Descompone cada fórmula en (elemento → cantidad) y suma ν_i por lado.
 * Retorna {} si está balanceada, o un dict con discrepancias.
 */
export function atomBalance(step: ReactionStep): Record<string, number> {
  const decompose = (formula: string): Record<string, number> => {
    const out: Record<string, number> = {};
    const tokens = formula.match(/([A-Z][a-z]?)(\d*)/g) ?? [];
    for (const tok of tokens) {
      if (!tok) continue;
      const m = tok.match(/([A-Z][a-z]?)(\d*)/);
      if (!m) continue;
      const sym = m[1];
      const n = m[2] ? parseInt(m[2], 10) : 1;
      out[sym] = (out[sym] ?? 0) + n;
    }
    return out;
  };
  const totals: Record<string, number> = {};
  for (const r of step.reactants) {
    const atoms = decompose(r.species);
    for (const [el, n] of Object.entries(atoms)) {
      totals[el] = (totals[el] ?? 0) - n * r.nu;
    }
  }
  for (const p of step.products) {
    const atoms = decompose(p.species);
    for (const [el, n] of Object.entries(atoms)) {
      totals[el] = (totals[el] ?? 0) + n * p.nu;
    }
  }
  // Devolver solo elementos con discrepancia
  const out: Record<string, number> = {};
  for (const [el, n] of Object.entries(totals)) {
    if (Math.abs(n) > 1e-9) out[el] = n;
  }
  return out;
}

/**
 * Constante de equilibrio K_eq a temperatura T a partir de ΔG = ΔH − T·ΔS.
 * Aproximación sencilla: K = exp(-ΔG / RT). Usada en modo educativo.
 */
export function keqFromGibbs(deltaH: number, deltaS: number, T: number): number {
  const dG = deltaH - T * deltaS;
  return Math.exp(-dG / (CONSTANTS.R * T));
}

// ═══════════════════════════════════════════════════════════════
// 6. FORMATEO
// ═══════════════════════════════════════════════════════════════

/** Convierte una reacción a su forma textual:  "2 H2 + O2 → 2 H2O" */
export function reactionToString(step: ReactionStep): string {
  const side = (list: Species[]) =>
    list
      .map((s) => (s.nu === 1 ? s.species : `${s.nu} ${s.species}`))
      .join(' + ');
  const arrow = step.reversible ? ' ⇌ ' : ' → ';
  return side(step.reactants) + arrow + side(step.products);
}

/** Subíndices unicode — "H2O" → "H₂O" para mostrar en UI */
export function formatFormula(formula: string): string {
  const subs: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  };
  return formula.replace(/\d/g, (d) => subs[d] ?? d);
}
