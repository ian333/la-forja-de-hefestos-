/**
 * fits.ts — TOLERANCIAS Y AJUSTES del molde, LITERALES del libro (NO inventar).
 * ============================================================================
 * Kazmer, *Injection Mold Design Engineering* + ANSI B4.1 "Preferred Limits and
 * Fits for Cylindrical Parts". Cada holgura/interferencia del ensamble sale de
 * aquí — no de un número mágico. Regla del proyecto: cotas LITERALES del libro.
 *
 *  · Pines eyectores/retorno ↔ barreno: holgura diametral 0.13 mm (§8.3.2),
 *    reamed, que ADEMÁS sirve de venteo (0.065 mm/lado).
 *  · Insertos/localización ↔ placa: ajuste de INTERFERENCIA (Tabla 12.1),
 *    λ = 0.001 · C · ∛D  [mm]   (Eq 12.29).
 *  · Step pins: hombro ≈ +1 mm Ø, largo ≈ 50 mm (§11).
 */

import { cteOf } from './materials';

// ════════════════════════════════════════════════════════════════════════════
//  FIT A TEMPERATURA — la realidad: el macho y el barreno DILATAN, distinto si son
//  materiales distintos. Un fit deslizante en frío se AGARROTA en caliente si el
//  macho dilata más que el barreno. Para MECANISMOS decide la luz de aceite/grasa.
//  Base física: L(T) = L₀·(1 + CTE·ΔT). Holgura diametral(T) = D_hole(T) − D_male(T).
// ════════════════════════════════════════════════════════════════════════════
export interface ThermalFit {
  deltaTC: number;
  clearanceColdMm: number;    // holgura diametral a 20 °C (ΔT=0)
  clearanceHotMm: number;     // a ΔT (+ = holgura, − = interferencia)
  deltaClearanceMm: number;   // cuánto se cerró (−) o abrió (+)
  binds: boolean;             // era holgura y se volvió interferencia → agarrota
  note: string;
}

/** Holgura/interferencia diametral a temperatura, con materiales por lado. ΔT en °C
 *  sobre 20 °C ref. Si el macho dilata más que el barreno, la holgura se cierra. */
export function fitAtTemp(
  hole: { diaMm: number; material?: string },
  male: { diaMm: number; material?: string },
  deltaTC: number,
): ThermalFit {
  const cold = hole.diaMm - male.diaMm;
  const holeHot = hole.diaMm * (1 + cteOf(hole.material) * 1e-6 * deltaTC);
  const maleHot = male.diaMm * (1 + cteOf(male.material) * 1e-6 * deltaTC);
  const hot = holeHot - maleHot;
  return {
    deltaTC,
    clearanceColdMm: +cold.toFixed(4), clearanceHotMm: +hot.toFixed(4),
    deltaClearanceMm: +(hot - cold).toFixed(4),
    binds: cold > 0.0001 && hot <= 0,
    note: `Ø${male.diaMm}${male.material ? `·${male.material}` : ''} en Ø${hole.diaMm}${hole.material ? `·${hole.material}` : ''} @ +${deltaTC}°C`,
  };
}

// ── §8.3.2 — holgura diametral pin↔barreno (deslizante + venteo) ──
export const EJECTOR_DIAM_CLEARANCE_MM = 0.13;         // 0.005 in, reamed

export interface PinFit { pinDiaMm: number; holeDiaMm: number; ventLandMm: number; note: string; }
/** Barreno para un pin eyector/retorno/blade: Ø + 0.13 mm (Kazmer §8.3.2). */
export function ejectorPinFit(pinDiaMm: number): PinFit {
  return {
    pinDiaMm, holeDiaMm: +(pinDiaMm + EJECTOR_DIAM_CLEARANCE_MM).toFixed(3),
    ventLandMm: EJECTOR_DIAM_CLEARANCE_MM / 2,
    note: `Ø${pinDiaMm}+0.13 reamed · deslizante + venteo (Kazmer §8.3.2)`,
  };
}

// ── Tabla 12.1 (ANSI B4.1) — coeficientes de ajuste de interferencia [mm] ──
//    λ = 0.001 · C · ∛D. Columnas: límites del BARRENO (female) y del MACHO (insert).
export type InterferenceFit = 'LN1' | 'LN2' | 'LN3' | 'FN1' | 'FN2' | 'FN3';
const C_TABLE: Record<InterferenceFit, { holeLo: number; holeHi: number; maleLo: number; maleHi: number }> = {
  LN1: { holeLo: 0, holeHi: 4.93, maleLo: 5.67, maleHi: 9.05 },   // localización-interferencia
  LN2: { holeLo: 0, holeHi: 7.84, maleLo: 8.59, maleHi: 13.52 },
  LN3: { holeLo: 0, holeHi: 7.84, maleLo: 13.67, maleHi: 18.60 },
  FN1: { holeLo: 0, holeHi: 4.93, maleLo: 14.34, maleHi: 17.73 }, // drive ligero (inserto típico)
  FN2: { holeLo: 0, holeHi: 7.84, maleLo: 23.47, maleHi: 28.41 },
  FN3: { holeLo: 0, holeHi: 7.84, maleLo: 32.30, maleHi: 37.24 },
};

/** Ø aparente de un inserto rectangular = media geométrica de sus lados (Ej. 12.29). */
export const apparentDia = (aMm: number, bMm: number): number => Math.sqrt(aMm * bMm);

/** Ajuste de INTERFERENCIA inserto↔placa (Tabla 12.1). Devuelve la sobredimensión
 *  diametral del macho y del barreno + la interferencia resultante [mm]. */
export function interferenceFit(apparentDiaMm: number, fit: InterferenceFit = 'FN1') {
  const c = C_TABLE[fit], cube = Math.cbrt(apparentDiaMm), k = 0.001 * cube;
  const male = { lowerMm: +(k * c.maleLo).toFixed(4), upperMm: +(k * c.maleHi).toFixed(4) };
  const hole = { lowerMm: +(k * c.holeLo).toFixed(4), upperMm: +(k * c.holeHi).toFixed(4) };
  return {
    fit, apparentDiaMm,
    maleOversize: male, holeOversize: hole,
    interferenceMm: { min: +(male.lowerMm - hole.upperMm).toFixed(4), max: +(male.upperMm - hole.lowerMm).toFixed(4) },
    note: `${fit} · λ=0.001·C·∛${apparentDiaMm.toFixed(1)} (Kazmer Tabla 12.1)`,
  };
}

// ── Pilar de soporte ↔ placa expulsora ──
//    La expulsora NO se guía en el pilar (lleva sus propios guías) → barreno de
//    HOLGURA suelto para que deslice sin agarrotarse. No es un ajuste de precisión.
export const PILLAR_SLIDE_CLEARANCE_MM = 1.0;          // diametral (la placa libra el pilar)
export function pillarClearanceFit(pillarDiaMm: number) {
  return {
    pillarDiaMm, holeDiaMm: pillarDiaMm + PILLAR_SLIDE_CLEARANCE_MM,
    note: `Ø${pillarDiaMm}+${PILLAR_SLIDE_CLEARANCE_MM} · la expulsora LIBRA el pilar (guiada aparte)`,
  };
}

// ── Poste guía ↔ buje (leader pin ↔ bushing): localización deslizante de precisión ──
//    ANSI B4.1 clearance/location fit (LC/RC). H7/g6 ≈ 0.02–0.05 mm diametral en
//    este rango. Se alinean las mitades A/B → ajuste JUSTO, no suelto.
export const LEADER_PIN_CLEARANCE_MM = 0.03;
export function leaderPinFit(pinDiaMm: number) {
  return { pinDiaMm, bushingBoreMm: +(pinDiaMm + LEADER_PIN_CLEARANCE_MM).toFixed(3),
    note: `Ø${pinDiaMm}+0.03 · localización H7/g6 (alinea A/B)` };
}

// ── SISTEMA GUÍA COMPLETO (poste + buje + TODOS sus barrenos): UNA fuente de verdad ──
//    Regla dura (Kazmer + feedback del user 2026-07-23): un barreno y lo que entra en él
//    NUNCA miden lo mismo — o hay holgura o hay interferencia, jamás ⌀=⌀. Aquí sale TODO
//    el sistema guía de un solo cálculo → el componente y su barreno SIEMPRE consistentes:
//      · poste desliza en el buje  → buje ID = poste + 0.03 (H7/g6, sistema de barreno-base)
//      · buje se asienta en A       → barreno A = buje OD + 0.4 (locacional, RECIBE)
//      · hombro del poste (en B)     → CONTRATALADRO = hombro + 0.4
//      · brida del buje (top de A)   → CONTRATALADRO = brida + 0.4
//    `pinNomMm` = ⌀ nominal del pilar (lo que da standardHoles). El poste real es −0.6.
export const GUIDE_SEAT_CLEARANCE_MM = 0.4;
export function guideGeom(pinNomMm: number) {
  const loc = GUIDE_SEAT_CLEARANCE_MM;
  const pinDiaMm = +(pinNomMm - 0.6).toFixed(2);
  return {
    pinNomMm, pinDiaMm,
    shoulderDiaMm: pinNomMm + 6, shoulderHMm: 6,                 // hombro de retención (en B)
    bushingODMm: pinNomMm + 8,
    bushingIDMm: +(pinDiaMm + LEADER_PIN_CLEARANCE_MM).toFixed(2), // ID del buje = poste + 0.03
    flangeDiaMm: pinNomMm + 12, flangeHMm: 5,                    // brida del buje (top de A)
    boreA_bushingMm: +(pinNomMm + 8 + loc).toFixed(2),           // asiento del buje en A
    cboreA_flangeMm: +(pinNomMm + 12 + loc).toFixed(2),          // contrataladro de la brida (top A)
    cboreB_shoulderMm: +(pinNomMm + 6 + loc).toFixed(2),         // contrataladro del hombro (bottom B)
    note: `poste Ø${pinDiaMm} → buje ID Ø${+(pinDiaMm + LEADER_PIN_CLEARANCE_MM).toFixed(2)} (H7/g6) · barreno ≠ componente`,
  };
}
