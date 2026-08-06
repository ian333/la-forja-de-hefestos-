/**
 * ✈️ La Forja AERO — ATMÓSFERA ESTÁNDAR INTERNACIONAL (ISA)
 * =========================================================
 * El cimiento de todo cálculo aerodinámico: la ρ de L = ½·ρ·v²·S·CL vive aquí.
 * Modelo ISA de 7 capas (ISO 2533 / U.S. Standard Atmosphere 1976), de 0 a
 * 84.852 km geopotenciales (≈86 km geométricos).
 *
 *   En cada capa la temperatura es LINEAL en la altitud geopotencial H:
 *     T = Tb + Lb·(H − Hb)
 *     p = pb·(T/Tb)^(−g/(Lb·R))     si Lb ≠ 0   (gradiente)
 *     p = pb·exp(−g·(H − Hb)/(R·T)) si Lb = 0   (isoterma)
 *
 *   ρ = p/(R·T)   (gas ideal)      a_sonido = √(γ·R·T)   (γ=1.4 aire)
 *
 * El porqué físico: el aire pesa — cada capa carga las de arriba (dp = −ρ·g·dh);
 * con T(H) lineal la integral da la potencia 5.256 de la troposfera. Nada es
 * curva ajustada.
 *
 * ⚠️ GEOPOTENCIAL vs GEOMÉTRICA — Anderson lo marca con "must" dos veces (§1.9).
 * El modelo ISA está definido sobre la altitud GEOPOTENCIAL H, que absorbe la
 * caída de g con la altura para poder usar g0 constante en la hidrostática. La
 * altitud que mide un avión es la GEOMÉTRICA z. No son la misma:
 *     H = r0·z/(r0 + z)      z = r0·H/(r0 − H)      r0 = 6,356,766 m
 * A 11 km difieren ~19 m (0.12 K); a 50 km, ~390 m. Ignorarlo es barato abajo y
 * caro arriba. `atmosferaISA` recibe H; `atmosferaISAz` recibe z. Elige a
 * conciencia — el nombre te obliga a saber cuál tienes.
 */

/** Radio efectivo de la Tierra del estándar [m] — define la conversión H↔z. */
export const R0_TIERRA = 6356766;

export const ISA = {
  T0: 288.15,       // K — 15 °C al nivel del mar
  p0: 101325,       // Pa
  rho0: 1.225,      // kg/m³ (se deriva, se exporta por conveniencia)
  a: -0.0065,       // K/m — gradiente troposférico (alias de CAPAS[0].L)
  h11: 11000,       // m — tropopausa
  T11: 216.65,      // K — isoterma estratosférica
  R: 287.053,       // J/(kg·K) aire seco (ISO 2533)
  g: 9.80665,       // m/s²
  gamma: 1.4,
  /** techo del modelo [m geopotenciales] */
  hMax: 84852,
} as const;

/**
 * Las 7 capas del estándar: altitud geopotencial base [m], gradiente [K/m] y
 * temperatura base [K]. Las presiones base se derivan por integración sucesiva
 * (abajo), no se copian de tabla: así no hay dos fuentes de verdad.
 */
export const CAPAS: ReadonlyArray<{ H: number; L: number; T: number }> = [
  { H: 0,     L: -0.0065, T: 288.15 },
  { H: 11000, L: 0.0,     T: 216.65 },
  { H: 20000, L: 0.001,   T: 216.65 },
  { H: 32000, L: 0.0028,  T: 228.65 },
  { H: 47000, L: 0.0,     T: 270.65 },
  { H: 51000, L: -0.0028, T: 270.65 },
  { H: 71000, L: -0.002,  T: 214.65 },
];

/** Presión en la base de cada capa [Pa], encadenada desde p0. */
const P_BASE: number[] = (() => {
  const { p0, R, g } = ISA;
  const out = [p0];
  for (let i = 0; i < CAPAS.length - 1; i++) {
    const { H, L, T } = CAPAS[i];
    const dH = CAPAS[i + 1].H - H;
    out.push(L === 0
      ? out[i] * Math.exp((-g * dH) / (R * T))
      : out[i] * Math.pow((T + L * dH) / T, -g / (L * R)));
  }
  return out;
})();

/** Altitud geométrica z [m] → geopotencial H [m]. */
export function geopotencial(z: number): number {
  return (R0_TIERRA * z) / (R0_TIERRA + z);
}

/** Altitud geopotencial H [m] → geométrica z [m]. */
export function geometrica(H: number): number {
  return (R0_TIERRA * H) / (R0_TIERRA - H);
}

export interface EstadoAtm {
  /** altitud GEOPOTENCIAL con la que se evaluó el modelo [m] */
  h: number;
  /** altitud GEOMÉTRICA equivalente [m] */
  z: number;
  T: number;
  p: number;
  rho: number;
  aSonido: number;
  /** índice de capa del estándar (0 = troposfera) */
  capa: number;
}

/**
 * Estado ISA a la altitud GEOPOTENCIAL H (m). Válido de 0 a 84,852 m.
 * Si lo que tienes es la altitud del altímetro (geométrica), usa `atmosferaISAz`.
 */
export function atmosferaISA(H: number): EstadoAtm {
  if (!(H >= 0) || H > ISA.hMax) {
    throw new Error(`atmosferaISA: H=${H} fuera del modelo (0 a ${ISA.hMax} m geopotenciales)`);
  }
  const { R, g, gamma } = ISA;
  let i = CAPAS.length - 1;
  for (let k = 0; k < CAPAS.length; k++) if (H >= CAPAS[k].H) i = k;
  const { H: Hb, L, T: Tb } = CAPAS[i];
  const pb = P_BASE[i];
  const T = Tb + L * (H - Hb);
  const p = L === 0
    ? pb * Math.exp((-g * (H - Hb)) / (R * Tb))
    : pb * Math.pow(T / Tb, -g / (L * R));
  return { h: H, z: geometrica(H), T, p, rho: p / (R * T), aSonido: Math.sqrt(gamma * R * T), capa: i };
}

/** Estado ISA a la altitud GEOMÉTRICA z (m) — la que marca el altímetro. */
export function atmosferaISAz(z: number): EstadoAtm {
  return atmosferaISA(geopotencial(z));
}

/** Presión dinámica q = ½·ρ·v² (Pa) — la moneda de la aerodinámica. */
export function presionDinamica(h: number, v: number): number {
  return 0.5 * atmosferaISA(h).rho * v * v;
}

/** Número de Mach a la altitud dada. */
export function mach(h: number, v: number): number {
  return v / atmosferaISA(h).aSonido;
}
