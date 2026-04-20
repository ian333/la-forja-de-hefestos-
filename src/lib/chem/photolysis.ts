/**
 * ══════════════════════════════════════════════════════════════════════
 *  photolysis — Fotólisis atmosférica (J values dependientes del tiempo)
 * ══════════════════════════════════════════════════════════════════════
 *
 * En la atmósfera, muchas reacciones clave son fotolíticas:
 *     O₃ + hν → O(¹D) + O₂       (formación de OH, el "detergente" atmosférico)
 *     NO₂ + hν → NO + O(³P)      (clave para formación de ozono troposférico)
 *     HCHO + hν → H + HCO        (fotólisis de formaldehído)
 *
 * La constante de velocidad J depende de la posición solar, la opacidad
 * atmosférica, y de la reacción específica (cross-section × yield cuántico
 * integrados sobre λ).
 *
 * Aquí implementamos J values representativos del Master Chemical
 * Mechanism (MCMv3.3.1) y del IUPAC evaluation — parametrizaciones
 * empíricas de la forma:
 *     J = l · cos(z)^m · exp(-n · sec(z))
 * donde l, m, n son coeficientes tabulados por reacción.
 *
 * Esta parametrización (Saunders et al. 2003) reproduce los J values
 * calculados con TUV (radiative transfer completo) con error <5% para
 * z < 85° y cubre las reacciones atmosféricas más importantes.
 *
 * Ref [P1] Saunders, S.M. et al. "Protocol for the development of the
 *          Master Chemical Mechanism, MCMv3 (Part A): Tropospheric
 *          degradation of non-aromatic volatile organic compounds",
 *          Atmos. Chem. Phys. 3, 161-180 (2003).
 * Ref [P2] Jenkin, M.E. et al. "The MCM: a protocol for the development
 *          of next-generation tropospheric chemical mechanisms",
 *          Geosci. Model Dev. 8, 1873-1893 (2015).
 * Ref [P3] IUPAC Task Group on Atmospheric Chemical Kinetic Data
 *          Evaluation, http://iupac.pole-ether.fr/
 */

import { solarPosition, julianDay } from './solar';

// ═══════════════════════════════════════════════════════════════
// Parametrización Saunders et al. 2003
// J = l · cos(z)^m · exp(-n·sec(z))
// ═══════════════════════════════════════════════════════════════

export interface JParam {
  /** Nombre de la reacción fotolítica, notación MCM */
  name: string;
  /** Reacción legible */
  reaction: string;
  /** Coeficientes l, m, n para J = l·cos(z)^m·exp(-n·sec(z)), J en s⁻¹ */
  l: number;
  m: number;
  n: number;
  /** Comentario / fuente */
  note?: string;
}

/**
 * Calcula J value instantáneo dado ángulo zenital.
 * Retorna 0 si el sol está bajo el horizonte (z > 90°).
 */
export function jValue(param: JParam, zenithRad: number): number {
  if (zenithRad >= Math.PI / 2) return 0;
  const cosZ = Math.cos(zenithRad);
  if (cosZ <= 0) return 0;
  const secZ = 1 / cosZ;
  return param.l * Math.pow(cosZ, param.m) * Math.exp(-param.n * secZ);
}

// ═══════════════════════════════════════════════════════════════
// BASE DE DATOS — MCM/IUPAC values
// ═══════════════════════════════════════════════════════════════
// Coeficientes tomados de Saunders 2003 Tabla 2 y Jenkin 2015 Tabla S3.

export const J_PARAMS: Record<string, JParam> = {
  // Ozono — caminos O(¹D) y O(³P)
  J1: { name: 'J1', reaction: 'O3 + hν → O(¹D) + O2',
        l: 6.073e-5, m: 1.743, n: 0.474,
        note: 'Produce O(¹D) que forma OH; crítica para capacidad oxidativa' },
  J2: { name: 'J2', reaction: 'O3 + hν → O(³P) + O2',
        l: 4.775e-4, m: 0.298, n: 0.080 },

  // Peróxido de hidrógeno
  J3: { name: 'J3', reaction: 'H2O2 + hν → 2 OH',
        l: 1.041e-5, m: 0.723, n: 0.279 },

  // NO2 — clave para ozono troposférico
  J4: { name: 'J4', reaction: 'NO2 + hν → NO + O(³P)',
        l: 1.165e-2, m: 0.244, n: 0.267,
        note: 'La fotólisis primaria en química de smog' },

  // NO3
  J5: { name: 'J5', reaction: 'NO3 + hν → NO + O2',
        l: 2.485e-2, m: 0.168, n: 0.108 },
  J6: { name: 'J6', reaction: 'NO3 + hν → NO2 + O(³P)',
        l: 1.747e-1, m: 0.155, n: 0.125 },

  // HONO, HNO3
  J7: { name: 'J7', reaction: 'HONO + hν → OH + NO',
        l: 2.644e-3, m: 0.261, n: 0.288 },
  J8: { name: 'J8', reaction: 'HNO3 + hν → OH + NO2',
        l: 9.312e-7, m: 1.230, n: 0.307 },

  // Formaldehído
  J11: { name: 'J11', reaction: 'HCHO + hν → CO + H2 (molecular)',
         l: 4.642e-5, m: 0.762, n: 0.353 },
  J12: { name: 'J12', reaction: 'HCHO + hν → HCO + H (radical)',
         l: 6.853e-5, m: 0.477, n: 0.323 },

  // Acetaldehído, acetona
  J13: { name: 'J13', reaction: 'CH3CHO + hν → CH3 + HCO',
         l: 7.344e-6, m: 1.202, n: 0.417 },
  J21: { name: 'J21', reaction: 'CH3COCH3 + hν → CH3CO + CH3',
         l: 7.649e-6, m: 0.682, n: 0.279 },

  // Peróxidos orgánicos
  J41: { name: 'J41', reaction: 'CH3OOH + hν → CH3O + OH',
         l: 7.649e-6, m: 0.682, n: 0.279 },
};

/** Lista ordenada para UI / iteración */
export const J_LIST: JParam[] = Object.values(J_PARAMS);

// ═══════════════════════════════════════════════════════════════
// Evaluación temporal
// ═══════════════════════════════════════════════════════════════

/**
 * J value dado fecha local + ubicación.
 * Útil para simulación diurna: J(t) varía con hora del día y estación.
 */
export function jValueAt(
  paramOrName: JParam | string,
  year: number,
  month: number,
  day: number,
  hourLocal: number,
  minuteLocal: number,
  latDeg: number,
  lonDeg: number,
  utcOffsetHours: number,
): number {
  const param = typeof paramOrName === 'string' ? J_PARAMS[paramOrName] : paramOrName;
  if (!param) return 0;
  const hourUT = hourLocal + minuteLocal / 60 - utcOffsetHours;
  const jd = julianDay(year, month, day, hourUT);
  const sun = solarPosition(jd, latDeg, lonDeg);
  return jValue(param, sun.zenith);
}

/**
 * Función de rate que se puede enchufar a una ReactionStep de nuestro motor.
 * Se invoca con (t, T, C) durante la integración y modula la k base por
 * el factor solar actual.
 *
 * Implementamos la fotólisis como reacción con "A" mágica: usamos la
 * forma k = jValue(...) directamente; la Ea=0 y la dependencia con T
 * viene sólo del yield cuántico (típicamente débil, ignorada aquí).
 *
 * Para integrarla al motor cinético, envolvemos en un adaptador que
 * devuelve k(t) en lugar de constante.
 */
export interface PhotolysisStep {
  name: string;
  /** Nombre del parámetro J (key en J_PARAMS) */
  jKey: string;
  /** Reactantes (normalmente una sola especie fotolítica) */
  reactants: { species: string; nu: number; order?: number }[];
  /** Productos */
  products: { species: string; nu: number }[];
  /** Yield cuántico adicional (factor multiplicativo, default 1) */
  phi?: number;
}

/**
 * Computa J(t) para una ubicación fija y todo un día completo, muestreado
 * cada Δt minutos. Útil para graficar el ciclo diurno de fotólisis.
 */
export function diurnalJ(
  paramOrName: JParam | string,
  year: number,
  month: number,
  day: number,
  latDeg: number,
  lonDeg: number,
  utcOffsetHours: number,
  dtMinutes = 15,
): { t: number[]; J: number[] } {
  const param = typeof paramOrName === 'string' ? J_PARAMS[paramOrName] : paramOrName;
  const t: number[] = [];
  const J: number[] = [];
  if (!param) return { t, J };
  for (let mins = 0; mins <= 24 * 60; mins += dtMinutes) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    t.push(mins / 60);
    J.push(jValueAt(param, year, month, day, h, m, latDeg, lonDeg, utcOffsetHours));
  }
  return { t, J };
}
