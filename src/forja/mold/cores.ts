/**
 * ANÁLISIS Y DISEÑO DE CORES — Kazmer §12.3 (el macho que forma el interior).
 * ==============================================================================
 * El core es la pieza más solicitada del molde: la contracción del plástico lo
 * abraza (cap 11) Y la presión del fundido lo comprime y lo flexiona. "Un molde
 * son ecuaciones a resolver": si el core deflecta de más, la pieza sale fuera de
 * tolerancia; si el esfuerzo supera el límite de fatiga, el core se raja. Tres
 * análisis acoplados, cada uno del libro con su ejemplo resuelto:
 *
 *  · COMPRESIÓN AXIAL (§12.3.1): la presión sobre la cara del core comprime las
 *    paredes → σ = P·φ_top²/(φ_ext²−φ_int²) [Eq 12.19]; ε=σ/E; δ_ax=ε·H
 *  · HOOP compresivo (§12.3.2): la presión aprieta las paredes de un core hueco →
 *    σ_hoop = P·φ/(2·h) [Eq 12.20]; espesor mín h>P·φ/(2·σ_lim) [Eq 12.21];
 *    Ø interno máx φ_int<φ·(1−P/σ_lim) [Eq 12.22]
 *  · DEFLEXIÓN por flexión (§12.3.3): la asimetría de presión flexiona el core →
 *    δ = ΔP·φ·H⁴/(8EI) [Eq 12.25], I=π/64·(φ_ext⁴−φ_int⁴) [Eq 12.26];
 *    interlock al lado fijo lo baja a ~10 %.
 *
 * Reproduce el cup del libro EXACTO: axial 216 MPa/δ 0.06mm; hoop 240 MPa,
 * Ø_int máx 31mm (fatiga QC7) vs 38mm (sobrepresión); I 5.1e-7, δ_flex 0.03mm.
 * PURO: node-testeable. Límites de material de MOLD_METALS (Apéndice B).
 */

import { metalByKey, type MoldMetal } from './moldbase';

export const E_STEEL_PA = 205e9;

// ── §12.3.1 COMPRESIÓN AXIAL ──────────────────────────────────────────
/** Eq (12.19): esfuerzo compresivo medio en las paredes = P·A_top/A_pared (MPa). */
export function axialStress(pMPa: number, phiTopMm: number, phiOuterMm: number, phiInnerMm: number): number {
  return (pMPa * phiTopMm * phiTopMm) / (phiOuterMm * phiOuterMm - phiInnerMm * phiInnerMm);
}
/** Deflexión axial por compresión de las paredes: δ = (σ/E)·H (mm). */
export function axialDeflectionMm(sigmaMPa: number, hCoreMm: number, eSteelPa = E_STEEL_PA): number {
  return (sigmaMPa * 1e6 / eSteelPa) * hCoreMm;
}

// ── §12.3.2 HOOP COMPRESIVO ───────────────────────────────────────────
/** Eq (12.20): esfuerzo hoop por la presión del fundido = P·φ/(2·h) (MPa). */
export function hoopStress(pMPa: number, phiCoreMm: number, hWallMm: number): number {
  return (pMPa * phiCoreMm) / (2 * hWallMm);
}
/** Eq (12.21): espesor MÍNIMO de pared para no exceder σ_limit (mm). */
export function minWallThickness(pMPa: number, phiCoreMm: number, sigmaLimitMPa: number): number {
  return (pMPa * phiCoreMm) / (2 * sigmaLimitMPa);
}
/** Eq (12.22): Ø interno MÁXIMO del core para no exceder σ_limit (mm). */
export function maxInnerDiameter(phiCoreMm: number, pMPa: number, sigmaLimitMPa: number): number {
  return phiCoreMm * (1 - pMPa / sigmaLimitMPa);
}

// ── §12.3.3 DEFLEXIÓN POR FLEXIÓN ─────────────────────────────────────
/** Eq (12.26): momento de inercia de un core hueco (m⁴). φ en mm. */
export function coreInertiaM4(phiOuterMm: number, phiInnerMm: number): number {
  const o = phiOuterMm / 1000, i = phiInnerMm / 1000;
  return (Math.PI / 64) * (Math.pow(o, 4) - Math.pow(i, 4));
}
/** Eq (12.25): deflexión lateral del core por asimetría de presión ΔP (mm).
 *  Interlock al lado fijo (Fig 12.28) reduce la deflexión a ~10 %. */
export function coreBendingMm(o: {
  dPMPa: number; phiOuterMm: number; phiInnerMm: number; heightMm: number;
  eSteelPa?: number; interlocked?: boolean;
}): number {
  const E = o.eSteelPa ?? E_STEEL_PA;
  const I = coreInertiaM4(o.phiOuterMm, o.phiInnerMm);
  const dM = (o.dPMPa * 1e6 * (o.phiOuterMm / 1000) * Math.pow(o.heightMm / 1000, 4)) / (8 * E * I);
  return dM * 1000 * (o.interlocked ? 0.1 : 1);
}

export interface CoreDesign {
  metal: string;
  hoop: { sigmaMPa: number; okFatiga: boolean; hMinMm: number };
  innerMaxMm: { fatiga: number; sobrepresion: number; gobierna: number; govBy: 'fatiga' | 'sobrepresión' };
  axial: { sigmaMPa: number; strainPct: number; deflMm: number; okFatiga: boolean };
  bending: { inertiaM4: number; deflMm: number; interlocked: boolean; slenderness: number };
  ok: boolean; notas: string[];
}

/**
 * RESUELVE el diseño estructural de un core hueco: hoop + axial + flexión contra
 * los límites del material, con Ø interno máximo (fatiga cíclica vs sobrepresión
 * de un cañonazo a presión máxima) y recomendación de interlock si es esbelto.
 */
export function designCore(o: {
  meltPressureMPa: number;                 // presión de fundido (llenado/empaque)
  dPAroundMPa?: number;                    // asimetría de presión alrededor del core (flexión)
  phiOuterMm: number; phiInnerMm: number; heightMm: number;
  phiTopMm?: number;                       // Ø de la cara cargada (default = exterior)
  metalKey?: string;                       // MOLD_METALS (default P20)
  overPressureMPa?: number;                // cañonazo a presión máx de máquina (default 200)
  interlocked?: boolean;
}): CoreDesign {
  const m: MoldMetal = metalByKey(o.metalKey ?? 'P20');
  const notas: string[] = [];
  const P = o.meltPressureMPa, dP = o.dPAroundMPa ?? 0.5 * P;   // §12.3.3: ~50% de la de llenado (core corto)
  const hWall = (o.phiOuterMm - o.phiInnerMm) / 2;
  const overP = o.overPressureMPa ?? 200;

  // ── HOOP ──
  const sigmaHoop = hoopStress(P, o.phiOuterMm, hWall);
  const okHoop = sigmaHoop < m.fatigueLimitMPa;
  const hMin = minWallThickness(P, o.phiOuterMm, m.fatigueLimitMPa);
  if (!okHoop) notas.push(`hoop ${sigmaHoop.toFixed(0)} MPa ≥ fatiga ${m.fatigueLimitMPa} de ${m.key}: engrosar pared (h ≥ ${hMin.toFixed(1)}mm) o material más fuerte`);

  // ── Ø interno máximo: el MENOR entre fatiga cíclica y cedencia por sobrepresión ──
  const innerFatiga = maxInnerDiameter(o.phiOuterMm, P, m.fatigueLimitMPa);
  const innerOver = maxInnerDiameter(o.phiOuterMm, overP, m.yieldMPa);
  const gov = Math.min(innerFatiga, innerOver);
  const govBy = innerFatiga <= innerOver ? 'fatiga' : 'sobrepresión';
  if (o.phiInnerMm > gov) notas.push(`Ø interno ${o.phiInnerMm}mm > máx ${gov.toFixed(0)}mm (gobierna ${govBy}): reducir el barreno de agua`);

  // ── AXIAL ──
  const sigmaAx = axialStress(P, o.phiTopMm ?? o.phiOuterMm, o.phiOuterMm, o.phiInnerMm);
  const eAx = sigmaAx * 1e6 / (m.modulusMPa * 1e6);
  const deflAx = axialDeflectionMm(sigmaAx, o.heightMm, m.modulusMPa * 1e6);
  const okAx = sigmaAx < m.fatigueLimitMPa;
  if (!okAx) notas.push(`axial ${sigmaAx.toFixed(0)} MPa ≥ fatiga ${m.fatigueLimitMPa}: acero más duro o pared más gruesa`);

  // ── FLEXIÓN ──
  const I = coreInertiaM4(o.phiOuterMm, o.phiInnerMm);
  const deflBend = coreBendingMm({ dPMPa: dP, phiOuterMm: o.phiOuterMm, phiInnerMm: o.phiInnerMm, heightMm: o.heightMm, eSteelPa: m.modulusMPa * 1e6, interlocked: o.interlocked });
  const slender = o.heightMm / o.phiOuterMm;
  if (slender > 5 && !o.interlocked) notas.push(`core ESBELTO (L/Ø ${slender.toFixed(1)}): interlockar al lado fijo (δ→10%) o compuerta central; la flexión es self-reinforcing (§12.3.3)`);

  const ok = okHoop && okAx && o.phiInnerMm <= gov;
  return {
    metal: m.key,
    hoop: { sigmaMPa: +sigmaHoop.toFixed(1), okFatiga: okHoop, hMinMm: +hMin.toFixed(1) },
    innerMaxMm: { fatiga: +innerFatiga.toFixed(1), sobrepresion: +innerOver.toFixed(1), gobierna: +gov.toFixed(1), govBy },
    axial: { sigmaMPa: +sigmaAx.toFixed(1), strainPct: +(eAx * 100).toFixed(3), deflMm: +deflAx.toFixed(3), okFatiga: okAx },
    bending: { inertiaM4: I, deflMm: +deflBend.toFixed(3), interlocked: !!o.interlocked, slenderness: +slender.toFixed(1) },
    ok, notas,
  };
}
