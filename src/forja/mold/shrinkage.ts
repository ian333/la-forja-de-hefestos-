/**
 * CONTRACCIÓN Y pvT — Kazmer cap 10 "Shrinkage and Warpage"
 * ==========================================================
 * Ecuación de Tait de DOBLE DOMINIO (Eq 10.2-10.6): volumen específico
 * v(T,P) del polímero en estado sólido y fundido → contracción volumétrica
 * del ciclo (Eq 10.10-10.11) → contracción LINEAL isotrópica (Eq 10.13).
 * Verificado contra el ejemplo del bezel ABS (p.239-241): s = 0.31%.
 * ESTE es el "scale factor" REAL del molde (no un número inventado).
 */

export interface TaitCoeffs {
  /** Transición: T_t(P) = b5 + b6·P  (K, K/Pa). */
  b5: number; b6: number;
  /** Fundido: v0 = b1m + b2m·(T−b5); B = b3m·exp(−b4m·(T−b5)). */
  b1m: number; b2m: number; b3m: number; b4m: number;
  /** Sólido: idem con coeficientes s. */
  b1s: number; b2s: number; b3s: number; b4s: number;
  /** Semicristalinos (Eq 10.6); amorfos = 0. */
  b7?: number; b8?: number; b9?: number;
}

/** ABS Cycolac MG47 (Apéndice A / ejemplo p.239-240). Amorfo: vT=0. */
export const ABS_TAIT: TaitCoeffs = {
  b5: 370.6, b6: 2.3e-7,
  b1m: 9.83e-4, b2m: 6.51e-7, b3m: 1.33e8, b4m: 4.38e-3,
  b1s: 9.83e-4, b2s: 3.47e-7, b3s: 2.16e8, b4s: 4.14e-3,
};

const C = 0.0894;  // constante universal de Tait

/** Eq (10.2): temperatura de transición a la presión P. */
export const transitionT = (c: TaitCoeffs, pPa: number): number => c.b5 + c.b6 * pPa;

/** Eq (10.5): volumen específico v(T,P) en m³/kg (T en K, P en Pa). */
export function specificVolume(c: TaitCoeffs, tK: number, pPa: number): number {
  const melt = tK > transitionT(c, pPa);
  const v0 = (melt ? c.b1m : c.b1s) + (melt ? c.b2m : c.b2s) * (tK - c.b5);
  const B = (melt ? c.b3m : c.b3s) * Math.exp(-(melt ? c.b4m : c.b4s) * (tK - c.b5));
  const vT = (!melt && c.b7) ? c.b7 * Math.exp(c.b8! * (tK - transitionT(c, pPa)) - c.b9! * pPa) : 0;
  return v0 * (1 - C * Math.log(1 + pPa / B)) + vT;
}

/**
 * Contracción del CICLO (Eq 10.10-10.13): del estado de empaque (T_no_flow,
 * P_pack) al de uso (T_room, 0). Devuelve r_v y la contracción lineal s.
 */
export function shrinkage(
  c: TaitCoeffs,
  opts: { tNoFlowK: number; pPackPa: number; tUseK?: number },
): { vPack: number; vUse: number; rv: number; linear: number; moldScale: number } {
  const vPack = specificVolume(c, opts.tNoFlowK, opts.pPackPa);
  const vUse = specificVolume(c, opts.tUseK ?? 293, 0);
  const rv = vUse / vPack;
  const linear = 1 - Math.cbrt(rv);                 // Eq 10.13
  return { vPack, vUse, rv, linear, moldScale: 1 / (1 - linear) };
}
