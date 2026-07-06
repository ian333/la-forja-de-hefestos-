/**
 * SISTEMA ESTRUCTURAL — Kazmer cap 12 "Structural System Design"
 * ================================================================
 * Compresión de placas (Eq 12.5-12.7), corte perimetral (Eq 12.8-12.9) y
 * FLEXIÓN de placa como viga con carga central (Eq 12.10-12.11, conservadora
 * ~2× vs FEA distribuido — el propio libro lo dice). La deflexión manda: si
 * las placas se abren >0.02mm (venteo), hay FLASH. Verificado contra los
 * ejemplos del molde bezel (p.307-311).
 */

export const TON_N = 9807;             // 1 tonelada métrica en N (el libro usa 9807)
export const E_STEEL = 205e9;          // módulo del acero (todas las aleaciones ~igual)

/** Eq (12.5-12.7): compresión uniforme σ=F/A, ε=σ/E, δ=ε·L. */
export function plateCompression(fN: number, aM2: number, lM: number, ePa = E_STEEL):
  { sigmaPa: number; strain: number; deflectionM: number } {
  const sigmaPa = fN / aM2;
  const strain = sigmaPa / ePa;
  return { sigmaPa, strain, deflectionM: strain * lM };
}

/** Eq (12.9): área de corte perimetral de la cavidad = perímetro × altura efectiva. */
export function shearArea(wCavM: number, lCavM: number, hEffM: number): number {
  return (2 * wCavM + 2 * lCavM) * hEffM;
}
/** Eq (12.8): esfuerzo cortante τ = F/A_shear. */
export const shearStress = (fN: number, aShearM2: number): number => fN / aShearM2;

/** Eq (12.11): inercia de sección rectangular I = W·H³/12. */
export const rectInertia = (wM: number, hM: number): number => (wM * hM ** 3) / 12;

/**
 * Eq (12.10): DEFLEXIÓN por flexión, viga con carga central (conservadora 2×):
 * δ = F·L³/(48·E·I). L = claro libre (entre rieles del ejector housing).
 */
export function plateBending(fN: number, spanM: number, wM: number, hM: number, ePa = E_STEEL):
  { inertiaM4: number; deflectionM: number } {
  const I = rectInertia(wM, hM);
  return { inertiaM4: I, deflectionM: (fN * spanM ** 3) / (48 * ePa * I) };
}

/** Espesor H mínimo para que δ_bending ≤ δ_max (despeja Eq 12.10-12.11). */
export function minPlateThickness(fN: number, spanM: number, wM: number, deltaMaxM: number, ePa = E_STEEL): number {
  return Math.cbrt((fN * spanM ** 3 * 12) / (48 * ePa * wM * deltaMaxM));
}

/** Reporte estructural del molde: compresión + corte + flexión + veredicto flash. */
export function structuralReport(o: {
  clampTons: number; moldWM: number; moldDM: number; stackLM: number;
  cavWM: number; cavLM: number; hEffShearM: number; bendSpanM: number; bendWM: number; bendHM: number;
}): { rows: string[]; flashRisk: boolean } {
  const F = o.clampTons * TON_N;
  const comp = plateCompression(F, o.moldWM * o.moldDM, o.stackLM);
  const tau = shearStress(F, shearArea(o.cavWM, o.cavLM, o.hEffShearM));
  const bend = plateBending(F, o.bendSpanM, o.bendWM, o.bendHM);
  const flashRisk = bend.deflectionM > 0.02e-3;
  return {
    rows: [
      `compresión: σ ${(comp.sigmaPa / 1e6).toFixed(1)} MPa · δ ${(comp.deflectionM * 1000).toFixed(3)} mm`,
      `corte perimetral: τ ${(tau / 1e6).toFixed(1)} MPa (límite P20 fatiga 456)`,
      `flexión: δ ${(bend.deflectionM * 1000).toFixed(3)} mm (venteo 0.02 — ${flashRisk ? '⚠ FLASH' : 'ok'})`,
    ],
    flashRisk,
  };
}
