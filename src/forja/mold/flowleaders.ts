/**
 * FLOW LEADERS / DEFLECTORS — Kazmer §5.5.5 (Eq 5.30-5.34).
 * ==============================================================================
 * Cuando el gate no se puede recentrar, se VARÍA el espesor de pared para que el
 * fundido llegue a la vez a todas las regiones y no haga "race-tracking" (una
 * región se llena antes y atrapa gas). Regiones más gruesas = "flow leaders"
 * (aceleran); más delgadas = deflectores (frenan).
 *
 * Condición (Eq 5.30): ΔP_región = ΔP_referencia → llegan al mismo tiempo.
 * Velocidad deseada (Eq 5.32): v_región = v_ref · (L_región / L_ref).
 * Espesor balanceado (Eq 5.33): H_región = H · (L_región/L_ref) · √(μ_región/μ_ref).
 *
 * Reproduce el ejemplo del contenedor del libro (Fig 5.18): L_central 280 mm,
 * L_paredes 210 mm, pared nominal 2 mm → pared lateral 1.5 mm, v 75 %. PURO.
 */

/** Eq (5.33): espesor de la región para igualar la caída de presión (mm).
 *  Con misma viscosidad, es lineal en el cociente de longitudes de flujo. */
export function flowLeaderThickness(hNominalMm: number, lRegionMm: number, lRefMm: number, muRatio = 1): number {
  return hNominalMm * (lRegionMm / lRefMm) * Math.sqrt(muRatio);
}
/** Eq (5.32): velocidad deseada en la región relativa a la referencia (fracción). */
export const flowLeaderVelocityRatio = (lRegionMm: number, lRefMm: number): number => lRegionMm / lRefMm;

export interface FlowRegion { name: string; flowLenMm: number; thicknessMm: number }
export interface FlowLeaderRegion {
  name: string; flowLenMm: number;
  thicknessMm: number; velocityRatio: number;
  role: 'referencia' | 'leader' | 'deflector' | 'igual';
}
export interface FlowLeaderDesign {
  refName: string; refLenMm: number; nominalMm: number;
  regions: FlowLeaderRegion[]; maxThicknessVarPct: number; notas: string[];
}

/**
 * RESUELVE los espesores balanceados de todas las regiones: la referencia es la
 * de MAYOR longitud de flujo (la que manda el tiempo de llenado); las demás se
 * ajustan por Eq 5.33 para llegar a la vez. Avisa la variación de espesor
 * (§2.3.1: mantenerla mínima).
 */
export function designFlowLeaders(o: {
  nominalMm: number; regions: Array<{ name: string; flowLenMm: number }>; muRatio?: number;
}): FlowLeaderDesign {
  const ref = o.regions.reduce((a, b) => (b.flowLenMm > a.flowLenMm ? b : a));
  const mu = o.muRatio ?? 1;
  const regions: FlowLeaderRegion[] = o.regions.map((r) => {
    const h = +flowLeaderThickness(o.nominalMm, r.flowLenMm, ref.flowLenMm, mu).toFixed(3);
    const vr = +flowLeaderVelocityRatio(r.flowLenMm, ref.flowLenMm).toFixed(3);
    const role = r.name === ref.name ? 'referencia'
      : h > o.nominalMm + 1e-6 ? 'leader' : h < o.nominalMm - 1e-6 ? 'deflector' : 'igual';
    return { name: r.name, flowLenMm: r.flowLenMm, thicknessMm: h, velocityRatio: vr, role };
  });
  const thicks = regions.map((r) => r.thicknessMm);
  const maxVar = (Math.max(...thicks) - Math.min(...thicks)) / o.nominalMm * 100;
  const notas: string[] = [];
  if (maxVar > 25) notas.push(`variación de espesor ${maxVar.toFixed(0)}% > 25%: riesgo de rechupe/alabeo (§2.3.1) — mejor recentrar el gate o 3-placas/hot`);
  return {
    refName: ref.name, refLenMm: ref.flowLenMm, nominalMm: o.nominalMm,
    regions, maxThicknessVarPct: +maxVar.toFixed(1), notas,
  };
}
