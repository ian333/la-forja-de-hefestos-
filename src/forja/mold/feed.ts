/**
 * SISTEMA DE ALIMENTACIÓN (COLADA) — Kazmer cap 6 "Feed System Design"
 * =====================================================================
 * Runners fríos y CALIENTES: caída de presión por segmento (power-law en
 * conducto circular), volumen del sistema, y OPTIMIZACIÓN de diámetros
 * mínimos dado un ΔP máximo (Eq 6.8 + asignación proporcional Eq 6.9).
 * Verificado contra el hot-runner del laptop bezel (p.139-144).
 */
import type { MeltMaterial } from './filling';

export interface RunnerSegment {
  name: string;
  /** Largo del segmento (m). */
  L: number;
  /** Radio del conducto (m). */
  R: number;
  /** Caudal volumétrico por ESTE segmento (m³/s) — se divide en cada rama. */
  Vdot: number;
  /** Número de veces que aparece (ramas paralelas) — para el volumen total. */
  count?: number;
}

/** Eq (6.2): número de Reynolds del fundido en el runner (<2300 = laminar). */
export function reynolds(rhoKgM3: number, VdotM3s: number, muPaS: number, dMeters: number): number {
  return (4 * rhoKgM3 * VdotM3s) / (Math.PI * muPaS * dMeters);
}

/** Eq (6.4): tasa de corte en conducto circular γ̇ = 4·V̇/(π·R³). */
export const shearRateRunner = (VdotM3s: number, rMeters: number): number =>
  (4 * VdotM3s) / (Math.PI * Math.pow(rMeters, 3));

/** Eq (6.5): ΔP power-law de un segmento: (2kL/R)·[(3+1/n)·V̇/(π·R³)]^n  (Pa). */
export function pressureDropRunner(m: MeltMaterial, seg: RunnerSegment): number {
  return ((2 * m.k * seg.L) / seg.R) *
    Math.pow(((3 + 1 / m.n) * seg.Vdot) / (Math.PI * Math.pow(seg.R, 3)), m.n);
}

/** ΔP total del sistema (suma de la RUTA nozzle→gate, no de las ramas paralelas). */
export function feedPressureDrop(m: MeltMaterial, path: RunnerSegment[]): number {
  return path.reduce((p, s) => p + pressureDropRunner(m, s), 0);
}

/** Eq (6.6): volumen total del sistema (con multiplicidad de ramas) en m³. */
export function feedVolume(segments: RunnerSegment[]): number {
  return segments.reduce((v, s) => v + (s.count ?? 1) * s.L * Math.PI * s.R * s.R, 0);
}

/**
 * Eq (6.8): RADIO MÍNIMO de un segmento para no exceder ΔP_max:
 * R = [ (2kL/ΔP)^(1/n) · (3+1/n)·V̇/π ]^( 1/(3+1/n) )
 */
export function minRunnerRadius(m: MeltMaterial, L: number, VdotM3s: number, dPmaxPa: number): number {
  const a = Math.pow((2 * m.k * L) / dPmaxPa, 1 / m.n);
  const b = ((3 + 1 / m.n) * VdotM3s) / Math.PI;
  return Math.pow(a * b, 1 / (3 + 1 / m.n));
}

/**
 * OPTIMIZADOR del libro (§6.4.5): asigna ΔP_max proporcional a la longitud de
 * cada segmento de la ruta (Eq 6.9) y despeja el radio mínimo (Eq 6.8).
 */
export function optimizeFeedSystem(
  m: MeltMaterial, path: Array<Omit<RunnerSegment, 'R'>>, dPmaxPa: number,
): Array<RunnerSegment & { dPAllocPa: number }> {
  const Ltot = path.reduce((s, p) => s + p.L, 0);
  return path.map((p) => {
    const dPi = dPmaxPa * (p.L / Ltot);
    return { ...p, dPAllocPa: dPi, R: minRunnerRadius(m, p.L, p.Vdot, dPi) };
  });
}
