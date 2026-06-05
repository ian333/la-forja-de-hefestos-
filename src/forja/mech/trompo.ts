/**
 * TROMPO — la evolución 3D del disco cicloidal: dientes/caras CURVAS (no planas) para
 * repartir el contacto, auto-soportar la impresión y flotar. Dos matemáticas que el
 * usuario pidió, puras y testeables:
 *
 *  (1) TRANSMISIÓN de fuerza con dientes 3D: ¿se complica en axial + radial?
 *      Respuesta: el TORQUE sigue siendo tangencial×radio (no se complica). La curva 3D
 *      añade una fuerza AXIAL = F·sin(ψ). Si la curva es SIMÉTRICA (barril: mitad +ψ,
 *      mitad −ψ), las axiales se CANCELAN → empuje axial NETO = 0. Tienes el área 3D
 *      repartida y el auto-centrado, SIN complicar la transmisión. (Como un herringbone.)
 *
 *  (2) ESCALADO a diferentes tamaños (éste a 100 g): la macro-geometría escala con el
 *      tamaño (∝ R³ en masa) pero las features de IMPRESIÓN (holgura, fusión, boquilla,
 *      filete) NO escalan — son del proceso. El generador ajusta voladizos/tamaños y avisa
 *      el tamaño MÍNIMO imprimible (donde las holguras fijas dominan).
 *
 * Unidades: grados, N, mm, g. Sin WASM.
 */

// ───────────────────────────────────────────────────────────────────────────
// (1) Descomposición de la fuerza de contacto: tangencial (torque) · radial · AXIAL
// ───────────────────────────────────────────────────────────────────────────
export interface ContactForce { tangential: number; radial: number; axial: number; }
/**
 * Descompone la fuerza normal F_n de un contacto diente↔rodillo:
 *   α = ángulo de presión (en el plano XY, cicloidal);  ψ = inclinación AXIAL del diente
 *   (la curvatura 3D fuera del plano; ψ=0 ⇒ disco plano clásico).
 *   F_axial      = F_n·sin(ψ)                  (NUEVA con la curva)
 *   F_inplano    = F_n·cos(ψ)  →  tangencial = ·cos(α) (hace TORQUE),  radial = ·sin(α)
 */
export function decompose(Fn: number, pressureDeg: number, axialTiltDeg: number): ContactForce {
  const a = (pressureDeg * Math.PI) / 180, psi = (axialTiltDeg * Math.PI) / 180;
  const inPlane = Fn * Math.cos(psi);
  return {
    tangential: +(inPlane * Math.cos(a)).toFixed(5),
    radial: +(inPlane * Math.sin(a)).toFixed(5),
    axial: +(Fn * Math.sin(psi)).toFixed(5),
  };
}
/** TORQUE = tangencial × radio. NO se complica: sigue siendo tangencial×R. */
export function torque_Nm(tangential_N: number, R_mm: number): number {
  return +((tangential_N * R_mm) / 1000).toFixed(5);
}
/** Cuánto torque se "pierde" por inclinar el diente ψ: factor cos(ψ) (mínimo si ψ chico). */
export function torqueRetention(axialTiltDeg: number): number {
  return +Math.cos((axialTiltDeg * Math.PI) / 180).toFixed(4);
}
/**
 * Empuje AXIAL NETO de un conjunto de contactos (cada uno con su inclinación ψ_i y F_i).
 * Diente de UN cono (todos +ψ) → suma (hay que reaccionarlo). Diente SIMÉTRICO/barril
 * (mitad +ψ, mitad −ψ) → CANCELA (neto 0). Devuelve el neto y si está balanceado.
 */
export function netAxial(contacts: { Fn: number; tiltDeg: number }[]): { net_N: number; balanced: boolean; total_abs_N: number } {
  let net = 0, abs = 0;
  for (const c of contacts) { const ax = c.Fn * Math.sin((c.tiltDeg * Math.PI) / 180); net += ax; abs += Math.abs(ax); }
  return { net_N: +net.toFixed(5), balanced: Math.abs(net) < 1e-6 * Math.max(1, abs), total_abs_N: +abs.toFixed(5) };
}
/** Construye un diente BARRIL simétrico: n pares (+ψ,−ψ) con la misma F → axial neto 0. */
export function symmetricBarrel(Fn: number, tiltDeg: number, pairs = 3): { Fn: number; tiltDeg: number }[] {
  const out: { Fn: number; tiltDeg: number }[] = [];
  for (let i = 0; i < pairs; i++) { out.push({ Fn, tiltDeg: +tiltDeg }, { Fn, tiltDeg: -tiltDeg }); }
  return out;
}
/**
 * Ganancia de ÁREA de contacto por curvar el diente en 3D (el contacto deja de ser una
 * línea recta de largo L y pasa a un arco de medio-ángulo ψ): factor 1/cos(ψ) aprox.
 * Más área → menos presión (la carga se reparte), si flota no sube la fricción.
 */
export function contactAreaGain(axialTiltDeg: number): number {
  return +(1 / Math.cos((axialTiltDeg * Math.PI) / 180)).toFixed(4);
}

// ───────────────────────────────────────────────────────────────────────────
// (2) ESCALADO a diferentes tamaños — éste a 100 g
// ───────────────────────────────────────────────────────────────────────────
export interface GbScaleParams { R: number; T: number; E: number; Rr: number; shaftD: number; shaftBore: number; lobes: number; discs: number; }
/** Features de IMPRESIÓN que NO escalan (son del proceso, mm fijos). */
export const PRINT_FIXED = { gap: 0.6, fusionGap: 0.3, nozzle: 0.4, filletMin: 0.4, selfSupportDeg: 45 };
/**
 * Factor de escala para una masa objetivo (la masa ∝ escala³ a densidad fija). Escala
 * SÓLO la macro-geometría; las holguras de impresión quedan fijas.
 */
export function scaleForMass(base: { massG: number; params: GbScaleParams }, targetMassG: number): number {
  return Math.cbrt(targetMassG / base.massG);
}
export function paramsAtScale(p: GbScaleParams, s: number): GbScaleParams {
  return {
    R: +(p.R * s).toFixed(3), T: +(p.T * s).toFixed(3), E: +(p.E * s).toFixed(3), Rr: +(p.Rr * s).toFixed(3),
    shaftD: +(p.shaftD * s).toFixed(3), shaftBore: +(p.shaftBore * s).toFixed(3),
    lobes: p.lobes, discs: p.discs, // topología NO escala
  };
}
/**
 * ¿Imprime a esta escala? Las holguras fijas (gap 0.6, fusión 0.3, boquilla 0.4) NO escalan;
 * al achicar la pieza dominan. Checa que las features mínimas sigan ≥ ~2·boquilla y que la
 * holgura no se coma el muñón. Avisa el voladizo y la masa resultante.
 */
export function printabilityAtScale(p: GbScaleParams, s: number, baseMassG = 320.7): {
  scale: number; massG: number; envMmDia: number; heightMm: number;
  rollerOK: boolean; lobeTipOK: boolean; camOverGapOK: boolean; printable: boolean; limiting: string;
} {
  const sp = paramsAtScale(p, s);
  const lobeTip = (2 * Math.PI * sp.R / (sp.lobes + 1)) * 0.35; // ancho aprox de un lóbulo
  const camR = sp.shaftD / 2 + sp.E;
  const rollerOK = sp.Rr >= 2 * PRINT_FIXED.nozzle;            // rodillo imprimible
  const lobeTipOK = lobeTip >= 2 * PRINT_FIXED.nozzle;          // punta del lóbulo imprimible
  const camOverGapOK = camR > 4 * PRINT_FIXED.gap;             // muñón no dominado por la holgura
  const massG = +(baseMassG * s * s * s).toFixed(1);          // ley cúbica desde la masa REAL
  const printable = rollerOK && lobeTipOK && camOverGapOK;
  const limiting = !rollerOK ? 'rodillo < 2·boquilla' : !lobeTipOK ? 'lóbulo < 2·boquilla' : !camOverGapOK ? 'muñón dominado por holgura' : 'ok';
  return {
    scale: +s.toFixed(4), massG, envMmDia: +(2 * (sp.R + sp.Rr + 4 * s)).toFixed(1), heightMm: +(sp.discs * sp.T + (sp.discs - 1) * PRINT_FIXED.gap + sp.T * 1.2).toFixed(1),
    rollerOK, lobeTipOK, camOverGapOK, printable, limiting,
  };
}
/** Tamaño MÍNIMO imprimible (barre escala hacia abajo hasta que una feature fija lo impide). */
export function minPrintable(p: GbScaleParams, base: { massG: number; params: GbScaleParams }): { minScale: number; minMassG: number; limiting: string } {
  let last = { scale: 1, massG: base.massG, limiting: 'ok' };
  for (let s = 1; s >= 0.2; s -= 0.01) {
    const r = printabilityAtScale(p, s, base.massG);
    if (!r.printable) return { minScale: +(s + 0.01).toFixed(3), minMassG: last.massG, limiting: r.limiting };
    last = { scale: s, massG: r.massG, limiting: r.limiting };
  }
  return { minScale: 0.2, minMassG: last.massG, limiting: 'ok' };
}
