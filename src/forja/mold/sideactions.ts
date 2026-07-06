/**
 * MOLDES CON MOVIMIENTO — Kazmer §11.3.6-11.3.8 (core pulls, slides, retorno)
 * ============================================================================
 * Los UNDERCUTS (ventanas laterales, bosses horizontales, snap fingers — cap
 * 2.3.7) exigen insertos MÓVILES: core pulls actuados (hidráulico) o SLIDES
 * con angle pin (el mecanismo clásico: el pin inclinado del lado A mueve la
 * corredera al abrir el molde). Verificado contra el ejemplo del bezel:
 * 44 kN, cilindro ⌀75 mm, angle pin 35+25 mm.
 */

/** Eq (11.24): fuerza para SOSTENER el core pull: F = P_melt × A_proyectada (N). */
export const corePullForce = (pMeltPa: number, aProjM2: number): number => pMeltPa * aProjM2;

/** Eq (11.25): diámetro del cilindro hidráulico D = √(4F/(π·P_fluido))  (m). */
export const hydraulicBore = (fN: number, pFluidPa: number): number =>
  Math.sqrt((4 * fN) / (Math.PI * pFluidPa));

/** Cilindros estándar (pulgadas comerciales → mm) para redondear hacia arriba. */
export const STD_BORES_MM = [38.1, 50.8, 63.5, 82.55, 101.6, 127];
export const pickStdBore = (dMm: number): number =>
  STD_BORES_MM.find((b) => b >= dMm) ?? STD_BORES_MM[STD_BORES_MM.length - 1];

/**
 * Eq (11.26): SLIDE con angle pin: carrera S = L_contacto·sin(φ). El ángulo φ
 * se limita a ~20° (fricción/atoramiento). Devuelve el diseño del pin.
 */
export function anglePinDesign(strokeMm: number, phiDeg = 20, engagementMm = 25):
  { phiDeg: number; contactLenMm: number; totalLenMm: number; ok: boolean } {
  const contact = strokeMm / Math.sin((phiDeg * Math.PI) / 180);
  return { phiDeg, contactLenMm: contact, totalLenMm: contact + engagementMm, ok: phiDeg <= 20 };
}

/**
 * Diseño COMPLETO de una acción lateral: dado el undercut (área proyectada al
 * movimiento, presión de fusión, carrera necesaria), decide slide (si la
 * carrera es corta) o core pull hidráulico, con dimensiones.
 */
export function sideActionDesign(o: {
  aProjMm2: number; pMeltMPa: number; strokeMm: number; pHydraulicMPa?: number;
}): { forceN: number; type: 'slide' | 'core-pull'; anglePin?: ReturnType<typeof anglePinDesign>; boreMm?: number; stdBoreMm?: number; report: string[] } {
  const F = corePullForce(o.pMeltMPa * 1e6, o.aProjMm2 * 1e-6);
  // regla práctica: slides para carreras cortas (≤ ~25mm — el angle pin crece 3× la carrera)
  if (o.strokeMm <= 25) {
    const pin = anglePinDesign(o.strokeMm);
    return {
      forceN: F, type: 'slide', anglePin: pin,
      report: [
        `undercut: F retención ${F.toFixed(0)} N (heel block la provee, no el pin)`,
        `SLIDE: angle pin ${pin.phiDeg}° · contacto ${pin.contactLenMm.toFixed(0)} mm + encastre 25 → L ${pin.totalLenMm.toFixed(0)} mm · carrera ${o.strokeMm} mm`,
      ],
    };
  }
  const bore = hydraulicBore(F, (o.pHydraulicMPa ?? 10) * 1e6) * 1000;
  const std = pickStdBore(bore);
  return {
    forceN: F, type: 'core-pull', boreMm: bore, stdBoreMm: std,
    report: [
      `undercut: F ${F.toFixed(0)} N a ${o.pMeltMPa} MPa sobre ${o.aProjMm2} mm²`,
      `CORE PULL hidráulico: bore ⌀${bore.toFixed(0)} mm → estándar ⌀${std} mm · carrera ${o.strokeMm} mm`,
    ],
  };
}

/** Retorno temprano con resortes (§11.3.8): compresión ≤40% del largo libre,
 *  soporte central si L_libre > 4·D; fuerza de retorno ~¼ de la de expulsión. */
export function springReturnCheck(freeLenMm: number, diaMm: number, compressMm: number):
  { maxCompressMm: number; needsSupportPin: boolean; ok: boolean } {
  const maxC = 0.4 * freeLenMm;
  return { maxCompressMm: maxC, needsSupportPin: freeLenMm > 4 * diaMm, ok: compressMm <= maxC };
}
