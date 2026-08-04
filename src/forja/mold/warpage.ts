/**
 * ALABEO — §10.3, las DOS formas del libro (Ec. 10.17 a 10.20).
 * ============================================================================
 * El defecto que mata la pieza, y el que menos se predice con un número suelto:
 * "the dimensional changes due to warpage can far exceed the shrinkage" (§10.3).
 * Kazmer lo parte en dos causas con FORMAS DISTINTAS — y por eso es la
 * verificación más visual del libro:
 *
 *  1. A TRAVÉS DEL ESPESOR (Fig 10.14) — CURVATURA. Un lado del molde más
 *     caliente que el otro ⇒ ese lado contrae más ⇒ la pieza se abarquilla.
 *       R = 2·h / (s_core − s_cavity)              (Ec. 10.17)
 *       δ = W · sin(W / R)                          (Ec. 10.18)   W = centro→borde
 *     Lo brutal del ejemplo del libro: **2 °C** de diferencia entre núcleo y
 *     cavidad dan **1.6 mm** de alabeo en el bezel — MÁS que la contracción
 *     total de borde a borde (0.8 mm). Ese es el argumento entero para exigir
 *     un circuito de agua parejo.
 *
 *  2. A TRAVÉS DEL ÁREA (Fig 10.15) — PANDEO. En una pieza de compuerta
 *     central el empaque cae del centro al borde ⇒ el borde contrae más. Si la
 *     pieza es un ÁREA CERRADA no puede acomodarlo en el plano y PANDEA:
 *       (s_edge − s_center) > 0.44 · (h/W)²         (Ec. 10.19)
 *       δ = √(W² − {W·[1 − (s_edge − s_center)]}²)  (Ec. 10.20)
 *     §10.3.1 es explícito en que esto solo aplica a un ÁREA CERRADA: "When the
 *     molding consists of a single closed area, the material within the molding
 *     is in continuous contact such that any non-uniform shrinkage and stresses
 *     across the part may only be resolved through out of plane distortion".
 *     Un MARCO con ventana está desacoplado: no pandea.
 *
 * ERRATA DEL LIBRO (verificada aquí): en el ejemplo de la Ec. 10.18 el
 * denominador impreso es "1050 mm" pero el R calculado dos líneas arriba es
 * 9050 mm. Con 9050 sale el 1.6 mm publicado (120·sin(120/9050) = 1.59); con
 * 1050 saldrían 13.7 mm. El typo es el 1050.
 *
 * PURO → node-testeable. Ambas ecuaciones verificadas contra sus ejemplos.
 */
import { shrinkage, type TaitCoeffs } from './shrinkage';

export interface AlabeoEspesor {
  sCorePct: number; sCavityPct: number;
  /** radio de curvatura (mm) — Infinity si no hay gradiente */
  radiusMm: number;
  /** flecha fuera de plano del centro al borde (mm) — Ec. 10.18 */
  deltaMm: number;
  /** contracción absoluta de borde a borde, para comparar (el libro lo hace) */
  contraccionTotalMm: number;
  /** el alabeo SUPERA a la contracción total (la alarma del libro) */
  superaContraccion: boolean;
}

/**
 * Alabeo por gradiente A TRAVÉS DEL ESPESOR (Ec. 10.17-10.18).
 * `tCoreC`/`tCavityC` son las temperaturas del PLÁSTICO junto a cada inserto al
 * final del empaque — la diferencia entre ellas es lo único que importa
 * ("not sensitive to the overall temperature… but only to the temperature
 * gradient through the thickness").
 */
export function alabeoPorEspesor(c: TaitCoeffs, o: {
  wallMm: number;
  /** semiancho: del CENTRO al borde (el libro usa 120 mm en un bezel de 240) */
  halfWidthMm: number;
  tCoreC: number; tCavityC: number; pPackPa: number;
}): AlabeoEspesor {
  const sCore = shrinkage(c, { tNoFlowK: o.tCoreC + 273.15, pPackPa: o.pPackPa }).linear;
  const sCav = shrinkage(c, { tNoFlowK: o.tCavityC + 273.15, pPackPa: o.pPackPa }).linear;
  const ds = sCore - sCav;
  const radius = Math.abs(ds) > 1e-12 ? (2 * o.wallMm) / Math.abs(ds) : Infinity;
  const delta = Number.isFinite(radius) ? Math.abs(o.halfWidthMm * Math.sin(o.halfWidthMm / radius)) : 0;
  const total = sCav * 2 * o.halfWidthMm;              // contracción absoluta borde a borde
  return {
    sCorePct: +(sCore * 100).toFixed(4), sCavityPct: +(sCav * 100).toFixed(4),
    radiusMm: +radius.toFixed(0), deltaMm: +delta.toFixed(2),
    contraccionTotalMm: +total.toFixed(2), superaContraccion: delta > total,
  };
}

export interface AlabeoArea {
  sCenterPct: number; sEdgePct: number;
  /** el lado izquierdo de Ec. 10.19 */
  deltaS: number;
  /** el umbral 0.44·(h/W)² */
  umbral: number;
  pandea: boolean;
  /** flecha si pandea (mm) — Ec. 10.20. CONSERVADORA: ver `advertencia`. */
  deltaMm: number;
  /** §10.3.1: un MARCO no pandea aunque cumpla el criterio */
  aplica: boolean;
  nota: string;
  /** LA ADVERTENCIA DEL PROPIO LIBRO sobre este número (§10.3.1, tras el ejemplo
   *  de la tapa): con P_borde = 0 MPa la contracción del borde sale mucho más
   *  alta que en la práctica, así que δ SOBREESTIMA. Se reporta SIEMPRE junto al
   *  número — un estimado conservador presentado como predicción es una mentira. */
  advertencia: string;
}

/**
 * Alabeo por gradiente A TRAVÉS DEL ÁREA = PANDEO (Ec. 10.19-10.20).
 * `topologia`: solo un ÁREA CERRADA pandea. Con 'marco' el criterio se evalúa
 * igual (para poder mostrarlo) pero se declara NO APLICABLE — §10.3.1.
 */
export function alabeoPorArea(c: TaitCoeffs, o: {
  wallMm: number; halfWidthMm: number;
  tC: number; pCenterPa: number; pEdgePa: number;
  topologia?: 'marco' | 'placa' | 'mixta';
}): AlabeoArea {
  const sCenter = shrinkage(c, { tNoFlowK: o.tC + 273.15, pPackPa: o.pCenterPa }).linear;
  const sEdge = shrinkage(c, { tNoFlowK: o.tC + 273.15, pPackPa: o.pEdgePa }).linear;
  const ds = sEdge - sCenter;
  const umbral = 0.44 * (o.wallMm / o.halfWidthMm) ** 2;
  const cumple = ds > umbral;
  const W = o.halfWidthMm;
  const delta = cumple ? Math.sqrt(Math.max(0, W * W - (W * (1 - ds)) ** 2)) : 0;
  const aplica = o.topologia !== 'marco';
  return {
    sCenterPct: +(sCenter * 100).toFixed(4), sEdgePct: +(sEdge * 100).toFixed(4),
    deltaS: +ds.toFixed(6), umbral: +umbral.toFixed(6),
    pandea: cumple && aplica, deltaMm: aplica ? +delta.toFixed(2) : 0, aplica,
    nota: !aplica
      ? '§10.3.1: es un MARCO (área abierta) — el material NO está en contacto continuo, así que la contracción despareja se acomoda EN EL PLANO y no pandea'
      : cumple
        ? 'ÁREA CERRADA con Δs sobre el umbral: "may only be resolved through out of plane distortion"'
        : 'área cerrada pero Δs bajo el umbral: no pandea',
    advertencia: o.pEdgePa <= 0
      ? 'δ SOBREESTIMA — el libro lo dice de su propio ejemplo: "it is somewhat unlikely that the lid would warp and very unlikely that the lid would warp to this extent… the analysis assumed that the pressure at the edge was 0 MPa and did not pack out at all". Es cota conservadora, NO predicción'
      : 'δ es cota conservadora (§10.3.1): asume que el borde no re-empaca',
  };
}
