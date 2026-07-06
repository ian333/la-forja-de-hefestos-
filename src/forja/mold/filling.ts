/**
 * ANÁLISIS DE LLENADO Y PRESIÓN — Kazmer cap 5 "Cavity Filling Analysis"
 * =======================================================================
 * Fórmulas reales verificadas contra los ejemplos resueltos del libro
 * (laptop bezel en ABS Cycolac MG47, p.105-111).
 */

export interface MeltMaterial {
  /** Viscosidad de referencia power-law k (Pa·s). ABS@239°C: 17,070. */
  k: number;
  /** Índice power-law n. ABS: 0.348. */
  n: number;
  /** Conductividad térmica del fundido κ (W/m°C). ABS: 0.19. */
  kappa: number;
  /** Temperatura de masa (°C) y de pared del molde (°C). */
  tMelt: number;
  tWall: number;
}
export const ABS_MG47: MeltMaterial = { k: 17070, n: 0.348, kappa: 0.19, tMelt: 239, tWall: 60 };

/** Eq (5.24): tasa de corte NEWTONIANA en pared γ̇ = 6·v̄/H  (1/s). */
export const shearRateNewtonian = (vMean: number, hMeters: number): number => (6 * vMean) / hMeters;

/** Eq (5.21): tasa de corte power-law γ̇ = 2(2+1/n)·v̄/H  (1/s). */
export const shearRatePowerLaw = (vMean: number, hMeters: number, n: number): number =>
  (2 * (2 + 1 / n) * vMean) / hMeters;

/**
 * Eq (5.23): velocidad de inyección RECOMENDADA (balance corte↔pérdida de calor):
 * v̄ = √( 5(T_melt−T_wall)·κ / (3μ) ), con μ la viscosidad al γ̇ actual → ITERAR.
 */
export function recommendedVelocity(m: MeltMaterial, muPaS: number): number {
  return Math.sqrt((5 * (m.tMelt - m.tWall) * m.kappa) / (3 * muPaS));
}

/** Viscosidad power-law μ(γ̇) = k·γ̇^(n−1). */
export const viscosityPowerLaw = (m: MeltMaterial, shearRate: number): number =>
  m.k * Math.pow(shearRate, m.n - 1);

/**
 * Iteración del libro (p.105): asumir v̄, calcular γ̇ (Eq 5.24), μ(γ̇), nueva v̄
 * (Eq 5.23)… hasta converger. Devuelve la velocidad de diseño.
 */
export function convergeVelocity(m: MeltMaterial, hMeters: number, v0 = 0.5, iters = 24): number {
  let v = v0;
  for (let i = 0; i < iters; i++) {
    const mu = viscosityPowerLaw(m, shearRateNewtonian(v, hMeters));
    v = recommendedVelocity(m, mu);
  }
  return v;
}

/**
 * Eq (5.22): CAÍDA DE PRESIÓN power-law en un segmento plano (flujo entre placas):
 * ΔP = (2·k·L/H) · [ 2(1+1/n)·v̄ / H ]^n     (Pa)
 * L=largo de flujo, H=espesor, v̄=velocidad media.
 */
export function pressureDropSegment(m: MeltMaterial, lMeters: number, hMeters: number, vMean: number): number {
  return ((2 * m.k * lMeters) / hMeters) * Math.pow((2 * (1 + 1 / m.n) * vMean) / hMeters, m.n);
}

/** Serie de segmentos (lay-flat del libro §5.5.2): ΔP total = Σ segmentos. */
export function fillingPressure(m: MeltMaterial, segments: Array<{ L: number; H: number; v: number }>): number {
  return segments.reduce((p, s) => p + pressureDropSegment(m, s.L, s.H, s.v), 0);
}

/**
 * Eq (5.29): TONELAJE DE CIERRE F_clamp = P_cavity × A_proyectada  (N).
 * Conservador: asume la presión de llenado en TODA la cavidad (el libro: el pico
 * real ocurre al inicio del empaque). 1 tonelada métrica = 9806.65 N.
 */
export function clampForceN(pCavityPa: number, aProjectedM2: number): number {
  return pCavityPa * aProjectedM2;
}
export const clampMetricTons = (pPa: number, aM2: number): number => clampForceN(pPa, aM2) / 9806.65;

/** Reporte de inyección completo de una cavidad. */
export function fillingReport(
  m: MeltMaterial,
  opts: { flowLengthM: number; wallM: number; projectedAreaM2: number; packFactor?: number },
): { vMean: number; shearRate: number; pressureMPa: number; clampTons: number; report: string[] } {
  const vMean = convergeVelocity(m, opts.wallM);
  const shearRate = shearRateNewtonian(vMean, opts.wallM);
  const p = pressureDropSegment(m, opts.flowLengthM, opts.wallM, vMean);
  const pack = opts.packFactor ?? 1.0;
  const clampTons = clampMetricTons(p * pack, opts.projectedAreaM2);
  return {
    vMean, shearRate, pressureMPa: p / 1e6, clampTons,
    report: [
      `v̄ diseño ${vMean.toFixed(2)} m/s · γ̇ ${shearRate.toFixed(0)} 1/s`,
      `ΔP llenado ${(p / 1e6).toFixed(1)} MPa (L=${opts.flowLengthM * 1000}mm, H=${opts.wallM * 1000}mm)`,
      `F_clamp ${clampTons.toFixed(1)} ton métricas (A_proy ${(opts.projectedAreaM2 * 1e6).toFixed(0)} mm²)`,
    ],
  };
}
