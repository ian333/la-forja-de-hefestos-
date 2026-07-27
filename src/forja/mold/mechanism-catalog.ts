/**
 * CATÁLOGO DE MECANISMOS PRECARGADOS — como la industria real: las correderas no se
 * diseñan desde cero, se COMPRAN como unidades estándar (DME/PCS/HASCO venden "slide
 * units" por carrera y tamaño de cara). La Forja precarga unidades paramétricas y el
 * generador ELIGE la más chica que cumple — "podrán seguir diseñando, pero ya habrá
 * mecanismos precargados" (user, 2026-07-13).
 *
 * Del más SIMPLE hacia arriba:
 *   1. corredera con perno inclinado (esta tabla) — §11.3.7
 *   2. core pull hidráulico (cuando la carrera/cara excede el catálogo) — §11.3.6
 *   3. (siguientes: lifter interno §13.9, núcleo desenroscable §13.9.2 — ya analizado
 *      en mold-unscrewing)
 *
 * Dimensiones = proporciones de unidades comerciales típicas; el perno respeta
 * φ ≤ 20° (límite del libro) y la carrera máx por unidad sale de su largo de cuerpo
 * (el pie en T debe seguir agarrado al riel con la corredera AFUERA).
 */

export interface SlideUnit {
  code: string;
  strokeMaxMm: number;                   // carrera máxima con el pie aún guiado
  faceWMaxMm: number; faceHMaxMm: number;   // cara máxima del núcleo que forma
  bodyWmm: number; bodyLmm: number; bodyHmm: number;
  pinDiaMm: number; angleDeg: number;
  railWmm: number; baseTmm: number;      // riel lateral y placa base (gib)
  heelLmm: number;
}

export const SLIDE_UNITS: SlideUnit[] = [
  { code: 'CU-25', strokeMaxMm: 12, faceWMaxMm: 25, faceHMaxMm: 16, bodyWmm: 34, bodyLmm: 42, bodyHmm: 18, pinDiaMm: 8, angleDeg: 20, railWmm: 7, baseTmm: 6, heelLmm: 14 },
  { code: 'CU-40', strokeMaxMm: 18, faceWMaxMm: 40, faceHMaxMm: 25, bodyWmm: 52, bodyLmm: 60, bodyHmm: 25, pinDiaMm: 10, angleDeg: 20, railWmm: 9, baseTmm: 8, heelLmm: 18 },
  { code: 'CU-60', strokeMaxMm: 25, faceWMaxMm: 60, faceHMaxMm: 38, bodyWmm: 76, bodyLmm: 85, bodyHmm: 34, pinDiaMm: 12, angleDeg: 20, railWmm: 11, baseTmm: 10, heelLmm: 22 },
  { code: 'CU-90', strokeMaxMm: 30, faceWMaxMm: 90, faceHMaxMm: 55, bodyWmm: 108, bodyLmm: 120, bodyHmm: 46, pinDiaMm: 16, angleDeg: 20, railWmm: 14, baseTmm: 12, heelLmm: 28 },
];

/** La unidad MÁS CHICA que cumple carrera y cara; null = fuera de catálogo
 *  (→ core pull hidráulico a la medida, §11.3.6). */
export function pickSlideUnit(coreWmm: number, coreHmm: number, strokeMm: number): SlideUnit | null {
  for (const u of SLIDE_UNITS)
    if (strokeMm <= u.strokeMaxMm && coreWmm <= u.faceWMaxMm && coreHmm <= u.faceHMaxMm) return u;
  return null;
}
