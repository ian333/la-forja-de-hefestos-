/**
 * SOPORTES FUNCIONALES print-in-place — la MATEMÁTICA. Puro (sin WASM), testeable.
 *
 * Tesis: en una caja impresa en una pieza NO usamos los soportes del slicer. Los
 * generamos NOSOTROS y les damos CUATRO trabajos a la vez:
 *   (1) sostener el voladizo durante la impresión,
 *   (2) MANTENER CENTRADO el disco en su leva mientras imprime,
 *   (3) ROMPERSE en el primer giro (frangibles, sin virutas, "el movimiento los despega"),
 *   (4) el VACÍO que dejan = el CANAL/laberinto por donde corre la grasa.
 *
 * Aquí está la física que dimensiona cada uno. Unidades: mm, N, MPa (=N/mm²), Pa·s.
 */

export type Material = 'PLA' | 'PETG' | 'ABS' | 'Nylon';
/** Cortante en el PLANO de capa (XY) — lo que un alma frangible debe vencer al romperse. */
const SHEAR_MPa: Record<Material, number> = { PLA: 28, PETG: 26, ABS: 24, Nylon: 30 };

// ───────────────────────────────────────────────────────────────────────────
// 1) CAMPO DE VOLADIZO — ¿qué cara necesita soporte?
// ───────────────────────────────────────────────────────────────────────────
/**
 * Inclinación de una cara respecto a la HORIZONTAL a partir de la z de su normal:
 *   β = acos(|n_z|).   Pared vertical n_z=0 → β=90° (auto-soportada).
 *   Techo horizontal n_z=±1 → β=0° (voladizo total).
 * Imprimible sin soporte si β ≥ β_crit (≈45°). Voladizo si la cara MIRA HACIA ABAJO
 * (n_z<0) y β < β_crit ⇔ −n_z > cos β_crit.
 */
export function faceTiltDeg(nz: number): number {
  return (Math.acos(Math.min(1, Math.abs(nz))) * 180) / Math.PI;
}
export function needsSupport(nz: number, critDeg = 45): boolean {
  return nz < 0 && faceTiltDeg(nz) < critDeg; // ⇔ −nz > cos(critDeg)
}

// ───────────────────────────────────────────────────────────────────────────
// 2) AUTO-PUENTE — el print-in-place se sostiene SOLO si hay pieza debajo y cerca
// ───────────────────────────────────────────────────────────────────────────
/**
 * Hueco vertical máximo que la 1ª capa puentea sin fundirse con la pieza de abajo:
 * el filamento cae (droop) δ antes de solidificar; si el hueco g > δ no se fusionan,
 * y si g no es enorme el puente no colapsa. δ≈1.5·capa para PLA con buen enfriamiento.
 * ⇒ g en [δ_min, g_max]. Por eso el stack de discos con gap 0.6 NO necesita soporte:
 * el disco de abajo ES el soporte. SÓLO es voladizo VERDADERO si NO hay pieza dentro
 * de g_max por debajo.
 */
export function maxSelfBridgeGap(material: Material, layer = 0.2): number {
  const k = material === 'PLA' ? 4.5 : material === 'PETG' ? 3.5 : 4.0; // capas puenteables
  return +(k * layer).toFixed(3); // PLA, capa 0.2 → ~0.9 mm
}
export function selfBridged(gapBelow: number, material: Material, layer = 0.2): boolean {
  const g = maxSelfBridgeGap(material, layer);
  return gapBelow > 0 && gapBelow <= g; // hay pieza debajo, lo bastante cerca para puentear
}
/** Longitud libre máxima de PUENTE horizontal sin soporte (sag aceptable). PLA ~8 mm. */
export function bridgeSpan(material: Material): number {
  return material === 'PLA' ? 8 : material === 'PETG' ? 6 : 5;
}

// ───────────────────────────────────────────────────────────────────────────
// 3) ALMA FRANGIBLE — se rompe en el PRIMER giro, aguanta la impresión
// ───────────────────────────────────────────────────────────────────────────
/** Fuerza para romper en cortante un alma de área A (mm²): F = τ·A. */
export function breakForce(material: Material, areaMm2: number): number {
  return +(SHEAR_MPa[material] * areaMm2).toFixed(2);
}
/** Área de alma para que rompa EXACTO a una fuerza objetivo. */
export function webAreaForForce(material: Material, force: number): number {
  return +(force / SHEAR_MPa[material]).toFixed(3);
}

// ───────────────────────────────────────────────────────────────────────────
// 4) CENTRADO frangible — espigas bore↔leva que rompen al primer giro
// ───────────────────────────────────────────────────────────────────────────
export interface CenteringInput {
  outputTorqueNm: number; // par de salida de diseño
  ratio: number;          // = lóbulos (par de ENTRADA = Tout/ratio)
  camRadius: number;      // radio de la leva (mm) — brazo de palanca del motor
  discMassG: number;      // masa de UN disco (carga de impresión a sostener)
  material: Material;
  spokes?: number;        // nº de espigas de centrado (default 3)
  spokeH?: number;        // alto axial de cada espiga (mm) (default 1)
}
/**
 * Las espigas mantienen el disco concéntrico en su leva mientras imprime; al arrancar,
 * el motor (par de entrada en el radio de la leva) las cizalla. Diseño correcto ⇔
 *   F_rompe < F_motor  (rompen al primer giro)  Y  F_rompe ≫ F_impresión (aguantan).
 * Devuelve el espesor de espiga que pone F_rompe al 25% del F_motor (margen 4×).
 */
export function centeringSpokes(inp: CenteringInput) {
  const spokes = inp.spokes ?? 3;
  const spokeH = inp.spokeH ?? 1;
  const Tin = (inp.outputTorqueNm / inp.ratio) * 1000;     // N·mm (entrada)
  const Fmotor = Tin / inp.camRadius;                       // N tangencial disponible
  const Fprint = (inp.discMassG / 1000) * 9.81;             // N (peso del disco)
  const Ftarget = Fmotor * 0.25;                            // rompe al 25% del motor
  const areaTotal = webAreaForForce(inp.material, Ftarget); // mm² de TODAS las espigas
  const tSpoke = +Math.max(0.4, areaTotal / (spokes * spokeH)).toFixed(3); // ≥1 boquilla
  const Fbreak = breakForce(inp.material, spokes * tSpoke * spokeH);
  return {
    spokes, spokeThickness: tSpoke, spokeHeight: spokeH,
    Fmotor: +Fmotor.toFixed(2), Fprint: +Fprint.toFixed(3), Fbreak,
    shearsOnFirstTurn: Fbreak < Fmotor,
    holdsDuringPrint: Fbreak > Fprint * 8, // margen amplio sobre el peso
  };
}

// ───────────────────────────────────────────────────────────────────────────
// 5) NERVIOS de soporte + CANALES de grasa (el vacío entre nervios)
// ───────────────────────────────────────────────────────────────────────────
/** nº de nervios radiales para que el arco libre entre ellos no exceda el puente. */
export function ribCount(radius: number, material: Material): number {
  const arc = bridgeSpan(material);
  return Math.max(3, Math.ceil((2 * Math.PI * radius) / arc));
}
/**
 * Canal de grasa entre nervios. Grasa NLGI-2 = plástico de Bingham (esfuerzo de
 * fluencia τ_y). Para que FLUYA bajo el bombeo del excéntrico, el esfuerzo cortante
 * en la pared debe vencer τ_y: τ_pared = ΔP·w/(2L) ≥ τ_y ⇒ ancho mínimo
 *   w_min = 2·L·τ_y / ΔP.  El excéntrico bombea con ΔP ≈ (par/área·radio).
 */
export function greaseChannel(opts: { channelW: number; channelL: number; pumpPressurePa: number; yieldPa?: number }) {
  const tauY = opts.yieldPa ?? 300;                         // NLGI-2 típico ~200-400 Pa
  // w_min[m] = 2·L[m]·τ_y/ΔP ⇒ w_min[mm] = 2·L[mm]·τ_y/ΔP (los ×1000 se cancelan).
  const wMin = +((2 * opts.channelL * tauY) / Math.max(1, opts.pumpPressurePa)).toFixed(4); // mm
  return { wMin, flows: opts.channelW >= wMin, yieldPa: tauY };
}

// ───────────────────────────────────────────────────────────────────────────
// 6) DISEÑO completo de los soportes funcionales de la caja
// ───────────────────────────────────────────────────────────────────────────
export interface GearboxLite {
  lobes: number; discs: number; R: number; Rr: number; E: number;
  T: number; gap: number; shaftD: number;
}
export function designFunctionalSupports(gb: GearboxLite, outputTorqueNm: number, material: Material) {
  const camRadius = gb.shaftD / 2 + gb.E;
  // masa de un disco ≈ (área anular del bounding × T × densidad). Aprox conservador.
  const discVolMm3 = Math.PI * (gb.R * 0.85) ** 2 * gb.T;   // ~85% del círculo (lóbulos)
  const density = material === 'PLA' ? 1.24e-3 : 1.05e-3;   // g/mm³
  const discMassG = discVolMm3 * density;

  const centering = centeringSpokes({
    outputTorqueNm, ratio: gb.lobes, camRadius, discMassG, material,
  });
  const ribsOuter = ribCount(gb.R, material);
  // bombeo del excéntrico: ΔP ≈ Tin / (A_disco · E)
  const Tin = (outputTorqueNm / gb.lobes); // N·m
  const pumpPa = (Tin) / (Math.PI * (gb.R / 1000) ** 2 * (gb.E / 1000)); // Pa (orden de magnitud)
  const channel = greaseChannel({ channelW: gb.gap, channelL: gb.R, pumpPressurePa: pumpPa });

  const selfBridge = maxSelfBridgeGap(material);
  return {
    material, camRadius: +camRadius.toFixed(3), discMassG: +discMassG.toFixed(2),
    // (A) el stack se auto-puentea: el gap < gMax ⇒ no necesita soporte entre discos
    interDiscSelfBridged: selfBridged(gb.gap, material),
    maxSelfBridgeGap: selfBridge,
    // (B) centrado frangible (rompe al primer giro, aguanta impresión)
    centering,
    // (C) nervios + canal de grasa
    ribsOuter,
    greaseChannel: channel,
    // veredicto: el sistema de soportes es correcto si centra+rompe+puentea+fluye
    valid: centering.shearsOnFirstTurn && centering.holdsDuringPrint && selfBridged(gb.gap, material),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// 7) FLOR DE PHI — repartir los soportes por el ÁNGULO ÁUREO (137.5°) para que
//    NINGUNO estorbe al otro (filotaxis de Vogel, como las semillas del girasol).
//    El chaflán de 45° auto-soporta la ORILLA del disco; el casquete central que
//    todavía vuela se llena de esta flor de árboles frangibles, esquivando el
//    eje y los pernos de salida. El ángulo áureo garantiza que dos árboles NUNCA
//    se alineen radialmente → empaque cuasi-uniforme (Ridley) → no se enciman.
// ───────────────────────────────────────────────────────────────────────────
/** Ángulo áureo = 360°·(2−φ) = 137.5077…°  (φ = (1+√5)/2). */
export const GOLDEN_ANGLE_DEG = 360 * (2 - (1 + Math.sqrt(5)) / 2);

export interface PhylloPoint { x: number; y: number; r: number; theta: number; }
export interface PhylloField {
  points: PhylloPoint[];
  count: number;
  minSpacing: number;   // separación mínima entre dos árboles (prueba: ninguno estorba)
  goldenDeg: number;
}
/**
 * Reparte hasta `n` puntos por FILOTAXIS DE VOGEL en el anillo [rMin, rMax]:
 *   r_k = sqrt(rMin² + (rMax²−rMin²)·(k−0.5)/n)   → densidad de ÁREA uniforme
 *   θ_k = k · 137.5°                              → ángulo áureo (nunca se alinean)
 * Descarta los que caen dentro de algún `keepOut` (círculos de radio r: eje, pernos
 * de salida). Devuelve la separación mínima como PRUEBA de no-interferencia.
 */
export function phyllotaxisField(opts: {
  n: number; rMin: number; rMax: number;
  keepOut?: { x: number; y: number; r: number }[];
}): PhylloField {
  const ga = (GOLDEN_ANGLE_DEG * Math.PI) / 180;
  const n = Math.max(0, Math.floor(opts.n));
  const span = Math.max(0, opts.rMax ** 2 - opts.rMin ** 2);
  const pts: PhylloPoint[] = [];
  for (let k = 1; k <= n; k++) {
    const r = Math.sqrt(opts.rMin ** 2 + (span * (k - 0.5)) / n);
    const theta = k * ga;
    const x = r * Math.cos(theta), y = r * Math.sin(theta);
    if (opts.keepOut?.some((o) => Math.hypot(x - o.x, y - o.y) < o.r)) continue;
    pts.push({ x: +x.toFixed(4), y: +y.toFixed(4), r: +r.toFixed(4), theta });
  }
  let minSpacing = Infinity;
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      minSpacing = Math.min(minSpacing, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
  return {
    points: pts, count: pts.length,
    minSpacing: pts.length > 1 ? +minSpacing.toFixed(4) : Infinity,
    goldenDeg: +GOLDEN_ANGLE_DEG.toFixed(5),
  };
}
/** nº de árboles para una separación objetivo `targetMm` en el anillo (≈ área/celda). */
export function phylloCountForSpacing(rMin: number, rMax: number, targetMm: number): number {
  const area = Math.PI * Math.max(0, rMax ** 2 - rMin ** 2);
  return Math.max(0, Math.round(area / (targetMm * targetMm)));
}
