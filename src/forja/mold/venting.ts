/**
 * VENTEO — Kazmer cap 8 "Venting"
 * ================================
 * El aire desplazado por el plástico DEBE salir o quema la pieza (diesel
 * effect). Espesor MÍNIMO del venteo por flujo viscoso del aire (Eq 8.1-8.2)
 * y MÁXIMO por flash tolerable (Eq 8.3-8.4) + tabla 8.1 de handbooks + los
 * 3 tipos de ubicación (periferia/knit-lines/dead-pockets). Verificado:
 * h_min=0.06mm, h_max=0.4·L_flash (p.190-191).
 */

export const MU_AIR = 1.8e-5;          // Pa·s aire a temperatura ambiente

/** Eq (8.2): espesor mínimo del venteo: h = ∛(12·μ_air·V̇·L / (ΔP·W))  (m). */
export function ventMinThickness(VdotAirM3s: number, lM: number, wM: number, dPPa = 0.1e6): number {
  return Math.cbrt((12 * MU_AIR * VdotAirM3s * lM) / (dPPa * wM));
}

/** Eq (8.4): presión del fundido al solidificar el flash: P = rampa × t_flash. */
export const meltPressureAtVent = (rampPaS: number, tFlashS: number): number => rampPaS * tFlashS;

/** Eq (8.3): espesor máximo (flash tolerable): h = √(12μ/(P·t))·L_flash  (m). */
export function ventMaxThickness(lFlashM: number, muMeltPaS = 10, rampPaS = 100e6, tFlashS = 0.003): number {
  const P = meltPressureAtVent(rampPaS, tFlashS);
  return Math.sqrt((12 * muMeltPaS) / (P * tFlashS)) * lFlashM;
}

/** Tabla 8.1: espesores recomendados por handbooks (mm). */
export const VENT_TABLE_MM = {
  lowViscosity:  { materials: 'PP, PA, POM, PE',      glanvill: 0.08, rosato: 0.1, menges: 0.015 },
  medViscosity:  { materials: 'PS, ABS, PC, PMMA',    glanvill: 0.2,  rosato: 0.3, menges: 0.03 },
};

/** Diseño del venteo: mínimo/máximo + veredicto + práctica del libro (≤0.02 partición). */
export function ventDesign(o: { VdotAirM3s: number; lM: number; wM: number; lFlashM: number }):
  { hMinMm: number; hMaxMm: number; hSpecMm: number; feasible: boolean; report: string } {
  const hMin = ventMinThickness(o.VdotAirM3s, o.lM, o.wM) * 1000;
  const hMax = ventMaxThickness(o.lFlashM) * 1000;
  const hSpec = Math.min(Math.max(hMin, 0.02), hMax);   // práctica: 0.02 partición, dentro de [min,max]
  return {
    hMinMm: hMin, hMaxMm: hMax, hSpecMm: hSpec, feasible: hMin <= hMax,
    report: `venteo: h ∈ [${hMin.toFixed(3)}, ${hMax.toFixed(3)}] mm → especificar ${hSpec.toFixed(3)} mm ${hMin <= hMax ? '✓' : '⚠ imposible: más venteos o más anchos'}`,
  };
}
