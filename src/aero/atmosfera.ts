/**
 * ✈️ La Forja AERO — ATMÓSFERA ESTÁNDAR INTERNACIONAL (ISA)
 * =========================================================
 * El cimiento de todo cálculo aerodinámico: la ρ de L = ½·ρ·v²·S·CL vive aquí.
 * Modelo ISA (Anderson, Fundamentals of Aerodynamics, cap. 3; ISO 2533):
 *
 *   TROPOSFERA (0–11 km): la temperatura cae LINEAL con el gradiente a=−6.5 K/km
 *     T = T0 + a·h              con T0 = 288.15 K (15 °C al nivel del mar)
 *     p = p0·(T/T0)^(−g/(a·R))  el exponente −g/(a·R) = 5.2559 (hidrostática+gas ideal)
 *   ESTRATOSFERA BAJA (11–20 km): ISOTERMA a T = 216.65 K
 *     p = p11·exp(−g·(h−h11)/(R·T))
 *
 *   ρ = p/(R·T)   (gas ideal)      a_sonido = √(γ·R·T)   (γ=1.4 aire)
 *
 * Constantes exactas del estándar: p0=101325 Pa, R=287.053 J/(kg·K), g=9.80665.
 * El porqué físico: el aire pesa — cada capa carga las de arriba (dp = −ρ·g·dh);
 * con T(h) lineal la integral da la potencia 5.256. Nada es curva ajustada.
 */

export const ISA = {
  T0: 288.15,       // K — 15 °C al nivel del mar
  p0: 101325,       // Pa
  rho0: 1.225,      // kg/m³ (se deriva, se exporta por conveniencia)
  a: -0.0065,       // K/m — gradiente troposférico
  h11: 11000,       // m — tropopausa
  T11: 216.65,      // K — isoterma estratosférica
  R: 287.053,       // J/(kg·K) aire seco
  g: 9.80665,       // m/s²
  gamma: 1.4,
} as const;

export interface EstadoAtm { h: number; T: number; p: number; rho: number; aSonido: number }

/** Estado ISA a la altitud h (m), válido 0–20 km. */
export function atmosferaISA(h: number): EstadoAtm {
  if (h < 0 || h > 20000) throw new Error('atmosferaISA: válida de 0 a 20,000 m');
  const { T0, p0, a, h11, T11, R, g, gamma } = ISA;
  let T: number, p: number;
  if (h <= h11) {
    T = T0 + a * h;
    p = p0 * Math.pow(T / T0, -g / (a * R));
  } else {
    T = T11;
    const p11 = p0 * Math.pow(T11 / T0, -g / (a * R));
    p = p11 * Math.exp((-g * (h - h11)) / (R * T11));
  }
  const rho = p / (R * T);
  return { h, T, p, rho, aSonido: Math.sqrt(gamma * R * T) };
}

/** Presión dinámica q = ½·ρ·v² (Pa) — la moneda de la aerodinámica. */
export function presionDinamica(h: number, v: number): number {
  return 0.5 * atmosferaISA(h).rho * v * v;
}

/** Número de Mach a la altitud dada. */
export function mach(h: number, v: number): number {
  return v / atmosferaISA(h).aSonido;
}
