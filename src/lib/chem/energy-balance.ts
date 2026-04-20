/**
 * ══════════════════════════════════════════════════════════════════════
 *  energy-balance — Balance energético acoplado a cinética
 * ══════════════════════════════════════════════════════════════════════
 *
 * Reacción exotérmica en un reactor cerrado:
 *
 *   d[C_i]/dt = Σ ν_{ij} · r_j(T, C)               (masa)
 *      dT/dt = (Σ (−ΔH_j) · r_j − UA·(T−T_amb)) /  (ρ·Cp)
 *              ─────────────────────────────────────
 *                  calor generado           pérdida
 *
 * Esto acopla composición ↔ temperatura. Es el origen de:
 *   - Runaway thermal (reactores fuera de control)
 *   - Multiplicidad de estados estacionarios (CSTR adiabático)
 *   - Ignición (combustión autosostenida)
 *
 * Ref [E1] Fogler, H.S. "Elements of Chemical Reaction Engineering", 5th ed.,
 *          Prentice Hall, 2016. Capítulos 11-13.
 * Ref [E2] Froment, G.F. & Bischoff, K.B. "Chemical Reactor Analysis and
 *          Design", 3rd ed., Wiley, 2010.
 */

import type { ReactionStep, Concentrations } from './kinetics';
import { rateOf } from './kinetics';
import type { OdeFn } from './stiff-solver';
import { solveStiff, type StiffOptions } from './stiff-solver';

// ═══════════════════════════════════════════════════════════════
// Propiedades térmicas del sistema
// ═══════════════════════════════════════════════════════════════

export interface ThermalSpecies {
  /** Capacidad calorífica molar a presión constante [J/(mol·K)] */
  Cp: number;
  /** Para cálculo de Cp variable con T: Cp(T) = Cp + Cp_T·T (opcional) */
  Cp_T?: number;
}

export interface ThermalContext {
  /** Capacidades caloríficas por especie [J/(mol·K)] */
  species: Record<string, ThermalSpecies>;
  /** Volumen del reactor [L] — para pasar de concentraciones a moles */
  volume: number;
  /** Coeficiente de transferencia de calor global · área [W/K].
   *  UA=0 → adiabático (sin pérdidas).
   *  UA→∞ → isotérmico perfecto. */
  UA: number;
  /** Temperatura ambiente o del refrigerante [K] */
  Tamb: number;
}

/**
 * Capacidad calorífica efectiva del sistema [J/K]:
 *   C_total(T) = V · Σ_i C_i · Cp_i(T)
 *
 * Nota: C_i en mol/L, V en L → mol totales · Cp(J/mol·K) = J/K.
 */
export function totalHeatCapacity(
  C: Concentrations,
  ctx: ThermalContext,
  T: number,
): number {
  let Ctotal = 0;
  for (const sp of Object.keys(C)) {
    const therm = ctx.species[sp];
    if (!therm) continue;
    const Cp = therm.Cp + (therm.Cp_T ?? 0) * T;
    Ctotal += C[sp] * ctx.volume * Cp;
  }
  return Ctotal;
}

/**
 * Derivada térmica acoplada:
 *   dT/dt = [Σ_j (−ΔH_j · r_j · V) − UA·(T−T_amb)] / C_total
 *
 * donde r_j es la velocidad de la reacción j [mol/(L·s)] y ΔH_j en J/mol.
 */
export function temperatureDerivative(
  steps: ReactionStep[],
  T: number,
  C: Concentrations,
  ctx: ThermalContext,
): number {
  let Qgen = 0;
  for (const step of steps) {
    if (step.deltaH === undefined) continue;
    const r = rateOf(step, T, C);              // mol/(L·s)
    Qgen += -step.deltaH * r * ctx.volume;     // J/s (ΔH<0 exotérmica → Q>0)
  }
  const Qloss = ctx.UA * (T - ctx.Tamb);       // W = J/s
  const Ctot = totalHeatCapacity(C, ctx, T);
  if (Ctot <= 0) return 0;
  return (Qgen - Qloss) / Ctot;
}

// ═══════════════════════════════════════════════════════════════
// ODE acoplada: y = [C_1, ..., C_n, T]
// ═══════════════════════════════════════════════════════════════

import { derivatives } from './kinetics';

export function buildCoupledOde(
  steps: ReactionStep[],
  species: string[],
  ctx: ThermalContext,
): OdeFn {
  return (_t: number, y: number[]): number[] => {
    const C: Concentrations = {};
    for (let i = 0; i < species.length; i++) C[species[i]] = y[i];
    const T = y[y.length - 1];
    const dC = derivatives(steps, T, C);
    const dT = temperatureDerivative(steps, T, C, ctx);
    const out = species.map((s) => dC[s] ?? 0);
    out.push(dT);
    return out;
  };
}

/**
 * Simulación acoplada masa-energía con stiff solver adaptativo.
 * Produce trayectoria de concentraciones + temperatura.
 */
export interface CoupledTrajectory {
  t: number[];
  C: Record<string, number[]>;
  T: number[];
  species: string[];
  steps: number;
  rejected: number;
}

export function simulateCoupled(
  steps: ReactionStep[],
  C0: Concentrations,
  T0: number,
  ctx: ThermalContext,
  tFinal: number,
  opts: StiffOptions = {},
): CoupledTrajectory {
  const species = Object.keys(C0);
  const y0 = [...species.map((s) => C0[s]), T0];
  const f = buildCoupledOde(steps, species, ctx);
  const res = solveStiff(f, 0, y0, tFinal, opts);

  const C: Record<string, number[]> = {};
  for (let i = 0; i < species.length; i++) {
    C[species[i]] = res.y.map((row) => row[i]);
  }
  const T = res.y.map((row) => row[row.length - 1]);
  return { t: res.t, C, T, species, steps: res.steps, rejected: res.rejected };
}

// ═══════════════════════════════════════════════════════════════
// Elevación adiabática (formula de libro)
// ═══════════════════════════════════════════════════════════════

/**
 * Elevación adiabática teórica para reacción única batch:
 *   ΔT_ad = (−ΔH) · C_reactivo_limit / (Σ C_i · Cp_i)
 *
 * Para validación contra la simulación acoplada (UA=0).
 * Ref [E1] Fogler §11.3.
 */
export function adiabaticTemperatureRise(
  deltaH: number,
  limitingReactantConc: number,
  C0: Concentrations,
  ctx: ThermalContext,
  T0 = 298,
): number {
  const Ctot = totalHeatCapacity(C0, ctx, T0);
  if (Ctot <= 0) return 0;
  return (-deltaH * limitingReactantConc * ctx.volume) / Ctot;
}

// ═══════════════════════════════════════════════════════════════
// Base de datos de Cp (25 °C, gas ideal — aproximación)
// ═══════════════════════════════════════════════════════════════
// Ref [E1] Fogler Apéndice D. Valores a 298 K; para rigor debe usarse
// polinomio NASA de 7 términos — pendiente si hace falta.

export const CP_REF: Record<string, ThermalSpecies> = {
  H2:   { Cp: 28.84 },
  O2:   { Cp: 29.38 },
  N2:   { Cp: 29.12 },
  H2O:  { Cp: 33.58 },         // vapor; líquido es 75.3
  H2O2: { Cp: 47.32 },
  NH3:  { Cp: 35.65 },
  CO:   { Cp: 29.14 },
  CO2:  { Cp: 37.13 },
  CH4:  { Cp: 35.31 },
  CH3OH:{ Cp: 45.8 },
  HCl:  { Cp: 29.14 },
  NaOH: { Cp: 59.54 },         // sólido
  NaCl: { Cp: 50.5 },          // sólido
  NO2:  { Cp: 37.18 },
  N2O5: { Cp: 84.1 },          // gas
  SO2:  { Cp: 39.87 },
  SO3:  { Cp: 50.67 },
  C2H4: { Cp: 42.9 },
  C2H6: { Cp: 52.5 },
};
