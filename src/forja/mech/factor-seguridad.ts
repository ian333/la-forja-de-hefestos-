/**
 * FACTOR DE SEGURIDAD — lo que faltaba. Dos dominios:
 *
 * (1) CLEARANCE anti-fusión (print-in-place): el gap del MODELO no es el gap real impreso.
 *     Las paredes CRECEN (~overExtrude por lado: squish, die-swell, sobre-extrusión). El gap
 *     efectivo = gap_modelo − 2·crecimiento. Y debe quedar con margen sobre g_min de fusión:
 *       SF_fusión = gap_efectivo / g_min.   SF≈1 = se funde con cualquier variación (= lo que
 *     le pasó al usuario). Objetivo SF ≥ 1.5. ⇒ gap_modelo ≥ SF·g_min + 2·crecimiento.
 *
 * (2) ESTRUCTURAL: el esfuerzo admisible = resistencia / SF. σ_real ≤ σ_límite/SF. SF de
 *     diseño 2–3 para piezas mecánicas de PLA. SF_real = resistencia / σ_real.
 *
 * Puro, testeable. mm, MPa, N.
 */

// ── Realidad de impresión FDM ──
export const PRINT = {
  lineWidth: 0.4,            // mm
  overExtrudePerSide: 0.12,  // mm que crece la pared por lado (calibrable; 0.05 afinado, 0.2 crudo)
  fusionGapMin: 0.30,        // mm umbral de soldadura con ventilador (printsim fanOn)
};
export const PLA_STRENGTH = { tensileMPa: 50, shearMPa: 28 }; // PLA típico

// ── (1) Clearance anti-fusión ──
/** Gap REAL impreso = gap del modelo − 2·crecimiento de pared. */
export function effectiveGap(modelGap: number, overPerSide = PRINT.overExtrudePerSide): number {
  return +(modelGap - 2 * overPerSide).toFixed(4);
}
/** SF contra la fusión = gap efectivo / g_min. <1 funde; ≥1.5 seguro. */
export function fusionSF(modelGap: number, gMin = PRINT.fusionGapMin, overPerSide = PRINT.overExtrudePerSide): number {
  return +(effectiveGap(modelGap, overPerSide) / gMin).toFixed(3);
}
/** Gap del MODELO requerido para un SF objetivo (despeja). */
export function requiredModelGap(targetSF = 1.5, gMin = PRINT.fusionGapMin, overPerSide = PRINT.overExtrudePerSide): number {
  return +(targetSF * gMin + 2 * overPerSide).toFixed(3);
}
export function fusionVerdict(modelGap: number, targetSF = 1.5): { effectiveGap: number; sf: number; safe: boolean; requiredGap: number } {
  const sf = fusionSF(modelGap);
  return { effectiveGap: effectiveGap(modelGap), sf, safe: sf >= targetSF, requiredGap: requiredModelGap(targetSF) };
}

// ── (2) Estructural ──
/** Esfuerzo admisible = resistencia / SF. */
export function allowableStress(strengthMPa: number, SF: number): number { return +(strengthMPa / SF).toFixed(3); }
/** SF real conseguido = resistencia / esfuerzo aplicado. */
export function structuralSF(actualMPa: number, strengthMPa: number): number { return +(strengthMPa / Math.max(1e-6, actualMPa)).toFixed(2); }
export function structVerdict(actualMPa: number, mode: 'tensile' | 'shear', targetSF = 2): { allowable: number; sf: number; safe: boolean } {
  const strength = mode === 'shear' ? PLA_STRENGTH.shearMPa : PLA_STRENGTH.tensileMPa;
  const sf = structuralSF(actualMPa, strength);
  return { allowable: allowableStress(strength, targetSF), sf, safe: sf >= targetSF };
}

// ── Evaluar la caja completa contra los factores de seguridad ──
export interface SfInput {
  gaps: { name: string; modelGap: number }[];      // interfaces print-in-place
  stresses: { name: string; mpa: number; mode: 'tensile' | 'shear' }[]; // esfuerzos de diseño
  targetPrintSF?: number; targetStructSF?: number;
}
export function evaluateSafety(inp: SfInput) {
  const tP = inp.targetPrintSF ?? 1.5, tS = inp.targetStructSF ?? 2;
  const fusion = inp.gaps.map((g) => ({ name: g.name, modelGap: g.modelGap, ...fusionVerdict(g.modelGap, tP) }));
  const struct = inp.stresses.map((s) => ({ name: s.name, mpa: s.mpa, mode: s.mode, ...structVerdict(s.mpa, s.mode, tS) }));
  const worstFusion = fusion.reduce((m, f) => (f.sf < m.sf ? f : m), fusion[0]);
  const worstStruct = struct.reduce((m, s) => (s.sf < m.sf ? s : m), struct[0]);
  return {
    targetPrintSF: tP, targetStructSF: tS,
    fusion, struct,
    worstFusion: { name: worstFusion?.name, sf: worstFusion?.sf, safe: worstFusion?.safe },
    worstStruct: { name: worstStruct?.name, sf: worstStruct?.sf, safe: worstStruct?.safe },
    recommendedGap: requiredModelGap(tP),
    allSafe: fusion.every((f) => f.safe) && struct.every((s) => s.safe),
  };
}
