/**
 * CAJA DE VELOCIDADES cicloidal multi-disco — la física que la hace DURABLE en
 * plástico e impresa en UNA pieza. Puro (sin WASM), testeable.
 *
 * El problema real (no la holgura): un eje de plástico que resista N engranes
 * internos sin romperse. Solución de ingeniería, verificada aquí:
 *  1) BALANCE: N discos fasados a 360/N° → la fuerza excéntrica neta sobre el eje
 *     ≈ 0 → el eje ve TORSIÓN pura (sobrevive), no flexión (se rompe).
 *  2) El eje es la ENTRADA = lado rápido = BAJO par → poco esfuerzo en el eje.
 *  3) El torque ALTO va al anillo de pernos = la BASE masiva (el "hembra").
 *  4) N discos REPARTEN la carga → esfuerzo en cada perno /N → el plástico aguanta.
 */

export type Material = 'PLA' | 'PETG' | 'ABS' | 'Nylon';
// resistencia a TRACCIÓN impresa (MPa) y factor de adhesión entre capas (Z<XY).
const MAT: Record<Material, { tensile: number; layerZ: number; note: string }> = {
  PLA: { tensile: 50, layerZ: 0.5, note: 'rígido pero FRÁGIL — mal para impacto/torsión sostenida' },
  PETG: { tensile: 45, layerZ: 0.55, note: 'tenaz, buena adhesión de capa' },
  ABS: { tensile: 40, layerZ: 0.5, note: 'tenaz; warping al imprimir' },
  Nylon: { tensile: 50, layerZ: 0.6, note: 'EL MEJOR: tenaz, autolubricante, fatiga' },
};

/** Fases de los N discos para balancear el eje (360/N). */
export function discPhases(n: number): number[] {
  return Array.from({ length: n }, (_, i) => (360 * i) / n);
}

/** BALANCE del eje: suma vectorial de las excéntricas de N discos fasados.
 *  residual ≈ 0 ⇒ el eje NO ve flexión neta (solo torsión) ⇒ sobrevive. */
export function eccentricBalance(n: number): { residualFraction: number; balanced: boolean } {
  let sx = 0, sy = 0;
  for (const ph of discPhases(n)) { sx += Math.cos((ph * Math.PI) / 180); sy += Math.sin((ph * Math.PI) / 180); }
  const residual = Math.hypot(sx, sy) / n;
  return { residualFraction: +residual.toFixed(6), balanced: residual < 1e-6 };
}

/** Cortante de torsión en eje hueco (MPa). T en N·mm; D,d en mm. τ = T/Wp. */
export function shaftTorsionStress(T: number, D: number, d: number): number {
  const Wp = (Math.PI * (D ** 4 - d ** 4)) / (16 * D);   // módulo polar (mm³)
  return T / Wp;
}

export interface GearboxDesign {
  lobes: number;          // lóbulos por disco (= reducción de la etapa)
  discs: number;          // nº de discos (balance + reparto)
  shaftD: number;         // ⌀ exterior del eje (mm)
  shaftBore: number;      // ⌀ interior del eje (hueco) (mm)
  pinCircleR: number;     // radio del anillo de pernos (mm)
  outPinR: number;        // radio de cada perno de SALIDA (mm)
  outPinCount: number;    // nº de pernos de salida
}
export interface GearboxLoad { outputTorqueNm: number; material: Material; }

export function analyzeGearbox(d: GearboxDesign, load: GearboxLoad) {
  const bal = eccentricBalance(d.discs);
  const ratio = d.lobes;                          // 1 etapa multi-disco: ratio = lóbulos
  const Tout = load.outputTorqueNm * 1000;        // N·mm
  const Tin = Tout / ratio;                        // el eje es la ENTRADA (bajo par)
  // EJE: torsión por el par de entrada; el bending neto ≈ 0 si está balanceado.
  const tauShaft = shaftTorsionStress(Tin, d.shaftD, d.shaftBore);
  // PERNOS DE SALIDA: llevan Tout repartido en (discos × pernos) a radio Rout.
  const Rout = d.pinCircleR * 0.55;
  const Fpin = Tout / (Rout * d.outPinCount * d.discs);   // fuerza tangencial / perno
  const tauPin = Fpin / (Math.PI * d.outPinR ** 2);       // cortante en el perno
  const m = MAT[load.material];
  const allowable = 0.6 * m.tensile * m.layerZ;           // cortante efectivo (penaliza capa Z)
  return {
    ratio, balanced: bal.balanced, residual: bal.residualFraction,
    torqueShareFactor: d.discs,
    shaftStressMPa: +tauShaft.toFixed(2), pinStressMPa: +tauPin.toFixed(2),
    allowableShearMPa: +allowable.toFixed(2),
    shaftOk: tauShaft < allowable, pinOk: tauPin < allowable,
    survives: bal.balanced && tauShaft < allowable && tauPin < allowable,
    material: load.material, note: m.note,
  };
}
