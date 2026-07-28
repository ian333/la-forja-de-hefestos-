/**
 * TRANSFERENCIA POR CAPAS — plástico → placa(s) de acero → refrigerante.
 * LA BASE del cálculo térmico del molde (aquí es donde "el análisis se hace
 * pesado" y donde el FDM viejo estaba MAL: la transferencia plástico→metal).
 *
 * Física de las bases:
 *  · INTERFAZ de 2 materiales en el FDM 1D: conductancia por MEDIA ARMÓNICA
 *      g = 1 / ( dxᵢ/(2kᵢ) + dxᵢ₊₁/(2kᵢ₊₁) )
 *    (promediar k aritmético o usar un solo α = flujo MAL en la unión — el
 *     bug clásico de los FDM ingenuos multicapa).
 *  · TEMPERATURA DE CONTACTO (2 semiespacios, t→0⁺): efusividad b = √(kρCp)
 *      T_contacto = (b_p·T_p + b_m·T_m)/(b_p + b_m)
 *    ABS(239°)+P20(60°): b=643 vs 11,186 → el acero apenas sube ~10 °C.
 *  · RÉGIMEN PERMANENTE: cadena de resistencias en serie
 *      R = Σ Hᵢ/kᵢ + 1/h_c        (Eq 9.18-9.21 + Eq 9.7 con h_c≈1000)
 *  · Todo material del Apéndice A/B LITERAL. Nota de consistencia: la α
 *    impresa del ABS (8.73e-8) = k/(ρ_FUNDIDO·Cp) = 0.19/(930·2340) ✓.
 */

export interface ThermalMat { k: number; rho: number; cp: number }
/** Apéndice A/B (literal): ABS Cycolac MG47 y aceros del molde. */
export const TM_ABS_MELT: ThermalMat = { k: 0.19, rho: 930, cp: 2340 };   // α=8.73e-8 ✓ impreso
export const TM_P20: ThermalMat = { k: 32, rho: 7820, cp: 500 };           // α=8.18e-6 ✓ impreso
export const TM_ALUM_QC7: ThermalMat = { k: 142, rho: 2800, cp: 864 };     // Apéndice B.1

export const effusivity = (m: ThermalMat) => Math.sqrt(m.k * m.rho * m.cp);

/** Temperatura de CONTACTO instantánea entre dos semiespacios (t→0⁺). */
export function contactTemperature(mp: ThermalMat, Tp: number, mm: ThermalMat, Tm: number): number {
  const bp = effusivity(mp), bm = effusivity(mm);
  return (bp * Tp + bm * Tm) / (bp + bm);
}

export interface Layer { mat: ThermalMat; thickMm: number; cells: number; T0: number }

/**
 * FDM 1D MULTICAPA explícito. Izquierda: ADIABÁTICA (línea central del
 * plástico — se modela MEDIA pared, simetría). Derecha: CONVECTIVA al
 * refrigerante (Eq 9.7, h_c W/m²°C). dt automático estable (0.4× el límite).
 */
export function makeLayeredFDM(layers: Layer[], hC: number, tCoolant: number) {
  const dx: number[] = [], k: number[] = [], C: number[] = [];
  let T: number[] = [];
  const layerOf: number[] = [];
  layers.forEach((L, li) => {
    const d = L.thickMm / 1000 / L.cells;
    for (let i = 0; i < L.cells; i++) {
      dx.push(d); k.push(L.mat.k); C.push(L.mat.rho * L.mat.cp); T.push(L.T0); layerOf.push(li);
    }
  });
  const n = T.length;
  // conductancias de interfaz (MEDIA ARMÓNICA — el corazón del multicapa)
  const g: number[] = [];
  for (let i = 0; i < n - 1; i++) g.push(1 / (dx[i] / (2 * k[i]) + dx[i + 1] / (2 * k[i + 1])));
  // dt estable: min sobre celdas de C·dx / Σg
  let dt = Infinity;
  for (let i = 0; i < n; i++) {
    const gl = i > 0 ? g[i - 1] : 0;
    const gr = i < n - 1 ? g[i] : hC;                    // borde derecho ve h_c
    dt = Math.min(dt, (C[i] * dx[i]) / (gl + gr));
  }
  dt *= 0.4;
  let t = 0;
  const step = () => {
    const Tn = T.slice();
    for (let i = 0; i < n; i++) {
      let q = 0;
      if (i > 0) q += g[i - 1] * (T[i - 1] - T[i]);
      if (i < n - 1) q += g[i] * (T[i + 1] - T[i]);
      else q += hC * (tCoolant - T[i]);                  // Robin: convección al agua
      Tn[i] = T[i] + (dt / (C[i] * dx[i])) * q;
    }
    T = Tn; t += dt;
  };
  const runUntil = (pred: () => boolean, maxS = 3600) => { while (!pred() && t < maxS) step(); return t; };
  return {
    step, runUntil, dt,
    get t() { return t; },
    get T() { return T; },
    /** T de línea central del plástico (celda 0 — borde adiabático). */
    get Tcenter() { return T[0]; },
    /** T EN la interfaz entre capa li y li+1 — por CONTINUIDAD DE FLUJO:
     *  ponderada con las conductancias de media celda (2k/dx) de cada lado.
     *  (El promedio simple de centros NO es la interfaz: a 20 ms daba 78.9°
     *   contra los 69.7° de efusividades — el lector estaba mal, no el FDM.) */
    interfaceT(li: number) {
      const a = layerOf.lastIndexOf(li), b = layerOf.indexOf(li + 1);
      const wa = 2 * k[a] / dx[a], wb = 2 * k[b] / dx[b];
      return (wa * T[a] + wb * T[b]) / (wa + wb);
    },
    /** flujo al refrigerante (W/m²) — para validar contra la cadena de R. */
    get fluxOut() { return hC * (T[n - 1] - tCoolant); },
  };
}

/** RÉGIMEN PERMANENTE por cadena de resistencias (el cierre analítico):
 *  q = (T_fuente − T_cool) / ( Σ Hᵢ/kᵢ + 1/h_c ). */
export function steadyFluxChain(tSource: number, tCoolant: number, layers: Array<{ thickMm: number; k: number }>, hC: number): number {
  const R = layers.reduce((r, L) => r + (L.thickMm / 1000) / L.k, 0) + 1 / hC;
  return (tSource - tCoolant) / R;
}
