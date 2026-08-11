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
  return convergeVelocityTraced(m, hMeters, v0, iters).v;
}

/**
 * La MISMA convergencia, pero AUDITABLE — §5.5.1 publica la escalera completa
 * (0.5 → 0.69 → 0.77 → 0.80 → 0.82 m/s) porque un número sin su convergencia no se
 * puede revisar. Devolver solo el último valor escondía dos cosas: si convergió de
 * verdad, y cuántas vueltas costó.
 */
export function convergeVelocityTraced(
  m: MeltMaterial, hMeters: number, v0 = 0.5, iters = 24, tol = 1e-4,
): { v: number; escalera: number[]; convergio: boolean; vueltas: number } {
  let v = v0;
  const escalera: number[] = [v];
  let convergio = false, vueltas = iters;
  for (let i = 0; i < iters; i++) {
    const mu = viscosityPowerLaw(m, shearRateNewtonian(v, hMeters));
    const next = recommendedVelocity(m, mu);
    escalera.push(next);
    if (Math.abs(next - v) < tol) { v = next; convergio = true; vueltas = i + 1; break; }
    v = next;
  }
  return { v, escalera, convergio, vueltas };
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

/* ══════════════════════════════════════════════════════════════════════════ */
/* CROSS-WLF — el modelo de viscosidad estándar de la industria (§5.3.3)      */
/* ══════════════════════════════════════════════════════════════════════════ */
/**
 * η(γ̇, T, p) = η₀ / (1 + (η₀γ̇/τ*)^(1−n))          Eq (5.8)
 * η₀(T,p)    = D1 · exp[ −A1(T − T*) / (A2 + (T − T*)) ]   Eq (5.9)
 * T*(p)      = D2 + D3·p                                    Eq (5.10)
 * A2         = A3 + D3·p                                    Eq (5.11)
 *
 * Por qué importa: el power law describe bien el CORTE ALTO, pero a corte bajo
 * predice viscosidad infinita. El Cross-WLF acota con el "límite newtoniano" η₀ —
 * y ese régimen es justo el del FRENTE FRÍO y el de las zonas donde el fundido
 * casi se detiene. Con power law solo, el llenado miente ahí.
 *
 * Coeficientes: Apéndice A del libro, LITERALES (no ajustados, no inventados).
 */
export interface CrossWLF {
  nombre: string;
  n: number;            // índice power-law del régimen de corte alto
  tauStarPa: number;    // τ* — el esfuerzo donde deja de ser newtoniano
  D1: number;           // Pa·s
  D2K: number;          // K
  D3KPerPa: number;     // K/Pa (0 en todos los del libro: sin dependencia de presión)
  A1: number;
  A2K: number;          // K (51.6 en todos: la constante clásica del WLF)
  eta0RefPaS: number;   // η₀ tabulado a la T de mid-range (cruce de validación)
  tMidC: number;        // temperatura de masa de mid-range (°C)
}
/** ABS Cycolac MG47 — Apéndice A, p. 392. La MISMA resina del bezel del libro. */
export const ABS_CROSS: CrossWLF = {
  nombre: 'ABS (Cycolac MG47)',
  n: 0.247, tauStarPa: 9.97e4, D1: 1.93e13, D2K: 373.15, D3KPerPa: 0,
  A1: 31.4, A2K: 51.6, eta0RefPaS: 2210, tMidC: 239,
};
/** PP Dow Inspire 702 — Apéndice A, p. 393. */
export const PP_CROSS: CrossWLF = {
  nombre: 'PP (Dow Inspire 702)',
  n: 0.378, tauStarPa: 5.30e3, D1: 1.99e14, D2K: 263.15, D3KPerPa: 0,
  A1: 30.02, A2K: 51.6, eta0RefPaS: 9070, tMidC: 220,
};

/** η₀(T, p) — Eqs (5.9)–(5.11). T en °C, p en Pa. */
export function eta0CrossWLF(m: CrossWLF, tC: number, pPa = 0): number {
  const T = tC + 273.15;
  const Tstar = m.D2K + m.D3KPerPa * pPa;
  const A2 = m.A2K + m.D3KPerPa * pPa;
  return m.D1 * Math.exp(-(m.A1 * (T - Tstar)) / (A2 + (T - Tstar)));
}

/** η(γ̇, T, p) — Eq (5.8). LA función que la industria usa. */
export function viscosityCrossWLF(m: CrossWLF, shearRate: number, tC: number, pPa = 0): number {
  const e0 = eta0CrossWLF(m, tC, pPa);
  if (shearRate <= 0) return e0;
  return e0 / (1 + Math.pow((e0 * shearRate) / m.tauStarPa, 1 - m.n));
}

/**
 * El LAZO de §5.5.1 resuelto con Cross-WLF (no con power law): v depende de η y η
 * de v. El libro lo hace a mano para el bezel y converge a 0.82 m/s pasando por
 * 0.5 → 0.69 → 0.77 → 0.80. Aquí sale igual, iterando.
 */
export function convergeVelocityCross(
  m: CrossWLF, kappaWmC: number, tWallC: number, hMeters: number,
  v0 = 0.5, iters = 40,
): { vMs: number; escalera: number[]; convergio: boolean; vueltas: number; muFinalPaS: number } {
  let v = v0; const escalera = [v]; let convergio = false, vueltas = 0, mu = 0;
  for (let i = 0; i < iters; i++) {
    const gamma = shearRateNewtonian(v, hMeters);          // Eq (5.24), como el libro
    mu = viscosityCrossWLF(m, gamma, m.tMidC);
    const vNext = Math.sqrt((5 * (m.tMidC - tWallC) * kappaWmC) / (3 * mu));
    escalera.push(+vNext.toFixed(4));
    vueltas = i + 1;
    if (Math.abs(vNext - v) < 1e-3) { v = vNext; convergio = true; break; }
    v = vNext;
  }
  return { vMs: +v.toFixed(4), escalera, convergio, vueltas, muFinalPaS: +mu.toFixed(1) };
}
