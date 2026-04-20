/**
 * ══════════════════════════════════════════════════════════════════════
 *  reactors — Modelos de reactores ideales: Batch, CSTR, PFR
 * ══════════════════════════════════════════════════════════════════════
 *
 * Tres arquetipos de reactor industrial:
 *
 *   BATCH   — sin flujo; la concentración cambia con el tiempo.
 *             dC_i/dt = Σ ν·r        (ecuación diferencial en t)
 *
 *   CSTR    — tanque con agitación perfecta y flujo continuo. Estado
 *             estacionario resuelve un sistema algebraico no lineal.
 *             En régimen transitorio: dC_i/dt = (C_i,in − C_i)/τ + Σ ν·r
 *             donde τ = V/Q (tiempo de residencia).
 *
 *   PFR     — reactor tubular; cada "rebanada" de fluido avanza axialmente
 *             sin mezclarse con las demás. Equivale a un batch evaluado
 *             sobre la coordenada espacial z = u·t.
 *             u · dC_i/dz = Σ ν·r    (ODE en z, no en t)
 *
 * Ref [R1] Fogler, H.S. "Elements of Chemical Reaction Engineering", 5th ed.,
 *          Prentice Hall, 2016. Capítulos 1-4 y 8.
 * Ref [R2] Levenspiel, O. "Chemical Reaction Engineering", 3rd ed.,
 *          Wiley, 1998.
 */

import type { ReactionStep, Concentrations } from './kinetics';
import { derivatives, rk4Step, rateOf } from './kinetics';
import type { OdeFn, StiffOptions } from './stiff-solver';
import { solveStiff } from './stiff-solver';
import type { ThermalContext } from './energy-balance';
import { temperatureDerivative, totalHeatCapacity } from './energy-balance';

// ═══════════════════════════════════════════════════════════════
// BATCH REACTOR
// ═══════════════════════════════════════════════════════════════

export interface BatchConfig {
  /** Isotérmico a esta T (si isothermal=true) o T inicial (si no) */
  T: number;
  /** Sistema energético — si se provee, el reactor no es isotérmico */
  thermal?: ThermalContext;
}

export interface BatchResult {
  t: number[];
  C: Record<string, number[]>;
  T: number[];                // trayectoria de T (constante si isotérmico)
  species: string[];
}

/**
 * Batch con stiff solver + opcional balance energético.
 */
export function simulateBatch(
  steps: ReactionStep[],
  C0: Concentrations,
  cfg: BatchConfig,
  tFinal: number,
  opts: StiffOptions = {},
): BatchResult {
  const species = Object.keys(C0);
  const hasThermal = !!cfg.thermal;
  const y0 = [...species.map((s) => C0[s])];
  if (hasThermal) y0.push(cfg.T);

  const f: OdeFn = (_t: number, y: number[]): number[] => {
    const C: Concentrations = {};
    for (let i = 0; i < species.length; i++) C[species[i]] = y[i];
    const T = hasThermal ? y[y.length - 1] : cfg.T;
    const dC = derivatives(steps, T, C);
    const out = species.map((s) => dC[s] ?? 0);
    if (hasThermal) out.push(temperatureDerivative(steps, T, C, cfg.thermal!));
    return out;
  };

  const res = solveStiff(f, 0, y0, tFinal, opts);
  const C: Record<string, number[]> = {};
  for (let i = 0; i < species.length; i++) {
    C[species[i]] = res.y.map((row) => row[i]);
  }
  const T = hasThermal
    ? res.y.map((row) => row[row.length - 1])
    : new Array(res.t.length).fill(cfg.T);

  return { t: res.t, C, T, species };
}

// ═══════════════════════════════════════════════════════════════
// CSTR — Continuous Stirred-Tank Reactor
// ═══════════════════════════════════════════════════════════════

export interface CstrConfig {
  /** Caudal volumétrico de entrada [L/s] */
  Q: number;
  /** Volumen del reactor [L] */
  V: number;
  /** Concentraciones en la corriente de entrada [mol/L] */
  feed: Concentrations;
  /** Temperatura de operación [K] */
  T: number;
  /** Balance térmico opcional */
  thermal?: ThermalContext;
  /** Temperatura de la corriente de entrada [K]. Default = T. */
  Tfeed?: number;
}

/**
 * Modelo CSTR transitorio:
 *   dC_i/dt = (C_i,feed − C_i) / τ  +  Σ ν_j · r_j
 *   τ = V / Q
 *
 * En régimen estacionario (dC/dt = 0) tenemos un sistema algebraico que
 * `cstrSteadyState` resuelve por iteración de punto fijo con amortiguamiento.
 */
export function simulateCstrTransient(
  steps: ReactionStep[],
  C0: Concentrations,
  cfg: CstrConfig,
  tFinal: number,
  opts: StiffOptions = {},
): BatchResult {
  const species = Object.keys(C0);
  const tau = cfg.V / cfg.Q;
  const hasThermal = !!cfg.thermal;
  const y0 = [...species.map((s) => C0[s])];
  if (hasThermal) y0.push(cfg.T);

  const f: OdeFn = (_t: number, y: number[]): number[] => {
    const C: Concentrations = {};
    for (let i = 0; i < species.length; i++) C[species[i]] = y[i];
    const T = hasThermal ? y[y.length - 1] : cfg.T;
    const dC = derivatives(steps, T, C);
    const out = species.map((s, i) => {
      const cFeed = cfg.feed[s] ?? 0;
      return (cFeed - y[i]) / tau + (dC[s] ?? 0);
    });
    if (hasThermal) {
      const Tfeed = cfg.Tfeed ?? cfg.T;
      const ctx = cfg.thermal!;
      // Término de flujo de calor por el caudal de entrada
      //   (ρCp·Q) · (Tfeed − T) / (ρCp·V) = (Tfeed − T) / τ
      // Simplificación: asumimos Cp_feed ≈ Cp_reactor (gas ideal mezclado).
      const dTreaction = temperatureDerivative(steps, T, C, ctx);
      const dTflow = (Tfeed - T) / tau;
      out.push(dTreaction + dTflow);
    }
    return out;
  };

  const res = solveStiff(f, 0, y0, tFinal, opts);
  const C: Record<string, number[]> = {};
  for (let i = 0; i < species.length; i++) {
    C[species[i]] = res.y.map((row) => row[i]);
  }
  const T = hasThermal
    ? res.y.map((row) => row[row.length - 1])
    : new Array(res.t.length).fill(cfg.T);
  return { t: res.t, C, T, species };
}

/**
 * Estado estacionario del CSTR: corre la transitoria por un tiempo largo
 * (10·τ por defecto) y toma el valor asintótico. Robusto contra
 * multiplicidad al elegir bien C0.
 */
export function cstrSteadyState(
  steps: ReactionStep[],
  cfg: CstrConfig,
  C0?: Concentrations,
  opts: StiffOptions = {},
): { C: Concentrations; T: number; conversion: Record<string, number> } {
  const tau = cfg.V / cfg.Q;
  const initial = C0 ?? { ...cfg.feed };
  const traj = simulateCstrTransient(steps, initial, cfg, 10 * tau, opts);
  const last = traj.t.length - 1;
  const C: Concentrations = {};
  for (const sp of traj.species) C[sp] = traj.C[sp][last];
  const T = traj.T[last];
  const conversion: Record<string, number> = {};
  for (const sp of Object.keys(cfg.feed)) {
    const cf = cfg.feed[sp];
    if (cf > 0) conversion[sp] = (cf - (C[sp] ?? 0)) / cf;
  }
  return { C, T, conversion };
}

// ═══════════════════════════════════════════════════════════════
// PFR — Plug-Flow Reactor
// ═══════════════════════════════════════════════════════════════

export interface PfrConfig {
  /** Caudal volumétrico [L/s] */
  Q: number;
  /** Volumen total del reactor [L] */
  V: number;
  /** Concentraciones en z=0 [mol/L] */
  inlet: Concentrations;
  /** Temperatura de entrada [K] */
  T: number;
  /** Balance térmico opcional */
  thermal?: ThermalContext;
}

export interface PfrResult {
  /** Coordenada volumétrica 0 → V (proporcional al tiempo de residencia) */
  V: number[];
  /** Tiempo de residencia equivalente t = V/Q */
  t: number[];
  C: Record<string, number[]>;
  T: number[];
  species: string[];
}

/**
 * PFR: ODE en V (volumen acumulado). Equivalente matemáticamente a un batch
 * evaluado en τ = V/Q. Muy útil cuando Q varía o para diseño de longitud.
 *
 *   dF_i/dV = ν · r         donde F_i = Q · C_i es flujo molar
 *   Asumiendo Q constante:  dC_i/dV = ν · r / Q
 */
export function simulatePfr(
  steps: ReactionStep[],
  cfg: PfrConfig,
  opts: StiffOptions = {},
): PfrResult {
  const species = Object.keys(cfg.inlet);
  const hasThermal = !!cfg.thermal;
  const y0 = [...species.map((s) => cfg.inlet[s])];
  if (hasThermal) y0.push(cfg.T);

  const f: OdeFn = (_V: number, y: number[]): number[] => {
    const C: Concentrations = {};
    for (let i = 0; i < species.length; i++) C[species[i]] = y[i];
    const T = hasThermal ? y[y.length - 1] : cfg.T;
    const dC = derivatives(steps, T, C);
    const out = species.map((s) => (dC[s] ?? 0) / cfg.Q);
    if (hasThermal) {
      const dT = temperatureDerivative(steps, T, C, cfg.thermal!);
      out.push(dT / cfg.Q);
    }
    return out;
  };

  const res = solveStiff(f, 0, y0, cfg.V, opts);
  const C: Record<string, number[]> = {};
  for (let i = 0; i < species.length; i++) {
    C[species[i]] = res.y.map((row) => row[i]);
  }
  const T = hasThermal
    ? res.y.map((row) => row[row.length - 1])
    : new Array(res.t.length).fill(cfg.T);
  const tResidence = res.t.map((v) => v / cfg.Q);
  return { V: res.t, t: tResidence, C, T, species };
}

// ═══════════════════════════════════════════════════════════════
// Métricas estándar de reactor
// ═══════════════════════════════════════════════════════════════

/** Conversión de una especie: X = (C_feed − C_out) / C_feed */
export function conversion(Cfeed: number, Cout: number): number {
  if (Cfeed <= 0) return 0;
  return Math.max(0, Math.min(1, (Cfeed - Cout) / Cfeed));
}

/** Selectividad: moles del producto deseado / moles del no deseado */
export function selectivity(Cdesired: number, Cundesired: number): number {
  if (Cundesired <= 0) return Infinity;
  return Cdesired / Cundesired;
}

/** Rendimiento: moles producto / moles reactivo alimentado */
export function yield_(Cproducto: number, CreactivoFeed: number, nuP = 1, nuR = 1): number {
  if (CreactivoFeed <= 0) return 0;
  return (Cproducto * nuR) / (CreactivoFeed * nuP);
}

// Keep rk4Step accessible for comparison tests
export { rk4Step };
export type { ReactionStep, Concentrations };
