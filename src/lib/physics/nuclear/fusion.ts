/**
 * ══════════════════════════════════════════════════════════════════════
 *  physics/nuclear/fusion — Reacciones termonucleares verificables
 * ══════════════════════════════════════════════════════════════════════
 *
 * Implementación numérica de:
 *
 *   1. Secciones eficaces de fusión σ(E) según los ajustes Padé de
 *      Bosch & Hale (1992) para las cuatro reacciones de interés
 *      energético:    D+T → α+n  ,  D+D → T+p  ,  D+D → ³He+n  ,
 *                     D+³He → α+p.
 *   2. Factor de penetración Coulomb (Gamow) por WKB:
 *
 *         P(E) = exp(-π η)     η = Z₁Z₂e² / (ℏv) = α·Z₁Z₂·√(μc²/(2E))
 *
 *      con la convención usual B_G = παZ₁Z₂√(2μc²) → P = exp(-B_G/√E).
 *      Para D-T: B_G = 34.3827 keV^(1/2).
 *   3. Reactividad maxwelliana ⟨σv⟩(T) — ajuste también Bosch-Hale:
 *
 *         ⟨σv⟩(T) = C₁·θ·√(ξ/(m_rc²·T³))·exp(-3ξ)
 *
 *      con θ definido por una racional en T y ξ = (B_G²/(4θ))^(1/3).
 *   4. Criterio de Lawson (1957): producto triple nτᴱT mínimo para
 *      ignición autosostenida en plasma confinado.
 *
 * Datos verificados contra:
 *   - σ_DT(64 keV) ≈ 5.0 barn (pico clásico)
 *   - ⟨σv⟩_DT(10 keV) ≈ 1.1·10⁻²² m³/s
 *   - Lawson DT (T≈14 keV) ≈ 3·10²¹ keV·s/m³
 *
 * Ref [F1] Bosch, H.-S. & Hale, G.M. "Improved formulas for fusion
 *          cross-sections and thermal reactivities", Nucl. Fusion 32(4),
 *          611-631 (1992). FUENTE PRIMARIA.
 * Ref [F2] Lawson, J.D. "Some criteria for a power producing thermonuclear
 *          reactor", Proc. Phys. Soc. B 70, 6 (1957). Criterio histórico.
 * Ref [F3] Atzeni, S. & Meyer-ter-Vehn, J. "The Physics of Inertial Fusion",
 *          Oxford 2004. Cap. 1: derivaciones de Gamow y Lawson.
 * Ref [F4] Krane, K.S. "Introductory Nuclear Physics", Wiley 1988. §14.6.
 */

// ═══════════════════════════════════════════════════════════════
// CONSTANTES FÍSICAS
// ═══════════════════════════════════════════════════════════════
const KEV_TO_J = 1.602176634e-16;          // 1 keV → J
const BARN_TO_M2 = 1e-28;                  // 1 barn → m²

// ═══════════════════════════════════════════════════════════════
// REACCIÓN: parámetros Bosch-Hale
// ═══════════════════════════════════════════════════════════════

export interface BoschHaleReaction {
  /** Etiqueta legible: "D-T", "D-D(n)", etc. */
  label: string;
  /** Q de la reacción [MeV]. */
  qMeV: number;
  /** Constante de Gamow B_G [keV^(1/2)]. */
  bg: number;
  /** Coeficientes Padé del S-factor: numerador A₁..A₅. */
  A: [number, number, number, number, number];
  /** Coeficientes Padé del S-factor: denominador B₁..B₄. */
  B: [number, number, number, number];
  /** Rango de validez en energía CM [keV]. */
  Erange: [number, number];
  /** Constante C₁ para ⟨σv⟩ Padé [cm³/s]. */
  C1: number;
  /** C₂..C₇ del ajuste de θ. */
  C2: number; C3: number; C4: number; C5: number; C6: number; C7: number;
  /** Masa reducida × c² del par [keV]. */
  mrc2: number;
  /** Rango de validez de ⟨σv⟩ en T [keV]. */
  Trange: [number, number];
}

// ────────────────────────────────────────────────────────────
// D + T → ⁴He + n     Q = 17.59 MeV   (Bosch-Hale Tabla VII)
// ────────────────────────────────────────────────────────────
export const DT: BoschHaleReaction = {
  label: 'D-T',
  qMeV: 17.59,
  bg: 34.3827,
  A: [6.927e4, 7.454e8, 2.050e6, 5.2002e4, 0],
  B: [6.38e1, -9.95e-1, 6.981e-5, 1.728e-4],
  Erange: [0.5, 550],
  C1: 1.17302e-9,
  C2: 1.51361e-2,
  C3: 7.51886e-2,
  C4: 4.60643e-3,
  C5: 1.35000e-2,
  C6: -1.06750e-4,
  C7: 1.36600e-5,
  mrc2: 1124656,
  Trange: [0.2, 100],
};

// ────────────────────────────────────────────────────────────
// D + D → ³He + n     Q = 3.27 MeV    (rama "n")
// ────────────────────────────────────────────────────────────
export const DDn: BoschHaleReaction = {
  label: 'D-D(n)',
  qMeV: 3.27,
  bg: 31.3970,
  A: [5.3701e4, 3.3027e2, -1.2706e-1, 2.9327e-5, -2.5151e-9],
  B: [0, 0, 0, 0],
  Erange: [0.5, 4900],
  C1: 5.43360e-12,
  C2: 5.85778e-3,
  C3: 7.68222e-3,
  C4: 0,
  C5: -2.96400e-6,
  C6: 0,
  C7: 0,
  mrc2: 937814,
  Trange: [0.2, 100],
};

// ────────────────────────────────────────────────────────────
// D + D → T + p       Q = 4.03 MeV    (rama "p")
// ────────────────────────────────────────────────────────────
export const DDp: BoschHaleReaction = {
  label: 'D-D(p)',
  qMeV: 4.03,
  bg: 31.3970,
  A: [5.5576e4, 2.1054e2, -3.2638e-2, 1.4987e-6, 1.8181e-10],
  B: [0, 0, 0, 0],
  Erange: [0.5, 5000],
  C1: 5.65718e-12,
  C2: 3.41267e-3,
  C3: 1.99167e-3,
  C4: 0,
  C5: 1.05060e-5,
  C6: 0,
  C7: 0,
  mrc2: 937814,
  Trange: [0.2, 100],
};

// ────────────────────────────────────────────────────────────
// D + ³He → ⁴He + p   Q = 18.35 MeV
// ────────────────────────────────────────────────────────────
export const DHe3: BoschHaleReaction = {
  label: 'D-³He',
  qMeV: 18.35,
  bg: 68.7508,
  A: [5.7501e6, 2.5226e3, 4.5566e1, 0, 0],
  B: [-3.1995e-3, -8.5530e-6, 5.9014e-8, 0],
  Erange: [0.3, 900],
  C1: 5.51036e-10,
  C2: 6.41918e-3,
  C3: -2.02896e-3,
  C4: -1.91080e-5,
  C5: 1.35776e-4,
  C6: 0,
  C7: 0,
  mrc2: 1124572,
  Trange: [0.5, 190],
};

export const FUSION_CATALOG: BoschHaleReaction[] = [DT, DDn, DDp, DHe3];

// ═══════════════════════════════════════════════════════════════
// SECCIÓN EFICAZ σ(E)  —  E en keV (CM), σ en milibarns
// ═══════════════════════════════════════════════════════════════

/**
 * S-factor Padé (B-H eq. 8):  S(E) = Pa_num(E) / Pa_den(E).
 */
function sFactor(E: number, r: BoschHaleReaction): number {
  const [A1, A2, A3, A4, A5] = r.A;
  const [B1, B2, B3, B4] = r.B;
  const num = A1 + E * (A2 + E * (A3 + E * (A4 + E * A5)));
  const den = 1 + E * (B1 + E * (B2 + E * (B3 + E * B4)));
  return num / den;
}

/**
 * Sección eficaz total de fusión [milibarns].
 *
 *   σ(E) = S(E) / (E · exp(B_G / √E))                      (B-H eq. 9)
 *
 * E es energía en el centro de masas, no en el laboratorio.
 */
export function sigmaMb(E_keV: number, r: BoschHaleReaction = DT): number {
  if (E_keV <= 0) return 0;
  const S = sFactor(E_keV, r);
  const gamow = Math.exp(r.bg / Math.sqrt(E_keV));
  return S / (E_keV * gamow);
}

/** σ(E) en barns (1 barn = 1000 mb). */
export function sigmaBarn(E_keV: number, r: BoschHaleReaction = DT): number {
  return sigmaMb(E_keV, r) / 1000;
}

/** σ(E) en m² (SI). */
export function sigmaM2(E_keV: number, r: BoschHaleReaction = DT): number {
  return sigmaBarn(E_keV, r) * BARN_TO_M2;
}

// ═══════════════════════════════════════════════════════════════
// FACTOR DE GAMOW (penetración WKB)
// ═══════════════════════════════════════════════════════════════

/**
 * Probabilidad relativa de tunelamiento Coulomb:
 *   P(E) = exp(-B_G / √E)                  E en keV
 *
 * No es un coeficiente absoluto sino el factor exponencial dominante.
 * Refleja la transparencia de la barrera coulombiana.
 */
export function gamowPenetration(E_keV: number, r: BoschHaleReaction = DT): number {
  if (E_keV <= 0) return 0;
  return Math.exp(-r.bg / Math.sqrt(E_keV));
}

/**
 * Energía del "pico de Gamow" — máximo del producto
 *   exp(-B_G/√E) · exp(-E/kT)
 * para una distribución térmica a temperatura T [keV].
 *
 *   E_G = (B_G · T / 2)^(2/3)              (Atzeni-Meyer §1.2)
 */
export function gamowPeak(T_keV: number, r: BoschHaleReaction = DT): number {
  return Math.pow((r.bg * T_keV) / 2, 2 / 3);
}

// ═══════════════════════════════════════════════════════════════
// REACTIVIDAD MAXWELLIANA  ⟨σv⟩(T)  —  ajuste Bosch-Hale
// ═══════════════════════════════════════════════════════════════

/**
 * ⟨σv⟩(T) en m³/s, T en keV. Bosch-Hale eq. 12.
 */
export function sigmaV(T_keV: number, r: BoschHaleReaction = DT): number {
  if (T_keV <= 0) return 0;
  const numerador = T_keV * (r.C2 + T_keV * (r.C4 + T_keV * r.C6));
  const denominador = 1 + T_keV * (r.C3 + T_keV * (r.C5 + T_keV * r.C7));
  const theta = T_keV / (1 - numerador / denominador);
  const xi = Math.pow((r.bg * r.bg) / (4 * theta), 1 / 3);
  const cm3PerSec =
    r.C1 *
    theta *
    Math.sqrt(xi / (r.mrc2 * T_keV * T_keV * T_keV)) *
    Math.exp(-3 * xi);
  // Convertir cm³/s → m³/s (1 cm³ = 10⁻⁶ m³).
  return cm3PerSec * 1e-6;
}

// ═══════════════════════════════════════════════════════════════
// CRITERIO DE LAWSON
// ═══════════════════════════════════════════════════════════════

/**
 * Producto triple mínimo nτᴱT para ignición DT autosostenida en plasma
 * confinado (Lawson 1957, formulación moderna):
 *
 *   n τᴱ T  ≥  12 T² k_B / ( ⟨σv⟩ E_α )
 *
 * con E_α = 3.5 MeV (energía del α que se queda calentando el plasma) y
 * factor 12 = 3·k_B/(⟨σv⟩) en unidades naturales. Retornamos el producto
 * en keV·s/m³ — el "lower bound" para que la potencia de fusión iguale
 * las pérdidas Bremsstrahlung + transporte.
 *
 * En T = 14 keV: tripletoLawson(14) ≈ 3·10²¹ keV·s/m³.
 *
 * Esta es la fórmula "tripleta" estándar; la original (1957) usaba sólo
 * nτᴱ y daba ~10²⁰ s/m³ a T fija.
 */
export function lawsonTripleProduct(T_keV: number, r: BoschHaleReaction = DT): number {
  const eAlphaKev = 3500; // 3.5 MeV → keV
  const sv = sigmaV(T_keV, r); // m³/s
  if (sv === 0) return Infinity;
  // Triple producto nτᴱT en keV·s/m³:
  //   nτᴱT = 12·T² / (⟨σv⟩·E_α)
  // dim: [keV²] / ([m³/s]·[keV]) = keV·s/m³  ✓
  return (12 * T_keV * T_keV) / (sv * eAlphaKev);
}

/**
 * Energía de Coulomb a tocarse dos núcleos puntuales (clásico):
 *   E_C = Z₁Z₂e² / (4πε₀ r_eff)
 * con r_eff ≈ R_a + R_b ≈ 1.2·(A_a^(1/3)+A_b^(1/3)) fm.
 *
 * Es un orden de magnitud típico ~1 MeV para hidrógeno-hidrógeno.
 * Demuestra POR QUÉ se necesita tunelamiento: T_quasi-clásico requeriría
 * ~10¹⁰ K cuando el sol opera a ~10⁷ K. El factor de Gamow rescata la
 * fusión estelar.
 */
export function coulombBarrierKeV(Z1: number, Z2: number, A1: number, A2: number): number {
  const r_fm = 1.2 * (Math.cbrt(A1) + Math.cbrt(A2));
  // E_C en MeV = 1.44·Z₁Z₂/r_fm (porque e²/(4πε₀) = 1.44 MeV·fm).
  return 1.44 * Z1 * Z2 / r_fm * 1000; // en keV
}

/** Energía liberada por reacción en julios. */
export function qJoules(r: BoschHaleReaction): number {
  return r.qMeV * 1000 * KEV_TO_J;
}
