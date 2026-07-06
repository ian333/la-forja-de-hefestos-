/**
 * TORNILLERÍA DEL MOLDE — Kazmer §12.4 "Fasteners"
 * =================================================
 * Socket head cap screws (DIN 912): el peor caso del libro — el molde COLGADO
 * de UN solo tornillo durante la instalación, con choque de grúa (n_g=10) —
 * dimensiona el tornillo por tensión (σ_ult 800 MPa DIN/ISO). CONECTADO al
 * catálogo DIN real de La Forja (src/lib/parts/fasteners: DIN 912 con tamaños
 * y largos comerciales). Verificado: bezel 362 kg → 47 kN → ⌀8.65 → M10.
 */
import { SIZES, type MetricSize } from '../../lib/parts/fasteners/din';

export const SIGMA_ULT_DIN = 800e6;   // Pa, tornillos DIN/ISO estándar (§12.4.2)

/** Eq (12.32): capacidad a tensión F = σ_ult·π·D²/4 (N). */
export const screwTensileCapacity = (dM: number, sigmaPa = SIGMA_ULT_DIN): number =>
  sigmaPa * Math.PI * dM * dM / 4;

/** Masa del molde como bloque sólido de acero (peor caso del libro). */
export const moldMassKg = (hM: number, lM: number, wM: number, rho = 7800): number =>
  rho * hM * lM * wM;

/**
 * PEOR CASO (Fig 12.33): molde sostenido por UN tornillo, momento alrededor
 * del anillo de centrado: F = M·n_g·g·(L_COG/L_screw). n_g=10 por choque de grúa.
 */
export function worstCaseScrewForce(massKg: number, lCogM: number, lScrewM: number, nG = 10, g = 9.8): number {
  return massKg * nG * g * (lCogM / lScrewM);
}

/** Diámetro mínimo (despeja Eq 12.32) y SELECCIÓN del DIN 912 del catálogo. */
export function selectMoldScrew(fN: number, sigmaPa = SIGMA_ULT_DIN):
  { dMinMm: number; din912: MetricSize; report: string } {
  const dMin = Math.sqrt((4 * fN) / (Math.PI * sigmaPa)) * 1000;
  const pick = SIZES.find((s) => parseFloat(s.slice(1)) >= dMin) ?? SIZES[SIZES.length - 1];
  return {
    dMinMm: dMin, din912: pick,
    report: `F ${fN.toFixed(0)} N → ⌀mín ${dMin.toFixed(2)} mm → DIN 912 ${pick} (catálogo La Forja)`,
  };
}
