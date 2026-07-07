/**
 * TAMAÑO DE PLACA — el espesor mínimo que aterriza en placa COMERCIAL (Kazmer cap
 * 12 §12.1 + cap 9 §9.2.5 + catálogo Meusburger/HASCO).
 * =================================================================================
 * "Un molde son ecuaciones a resolver": la placa de soporte es un sistema de
 * TRES restricciones acopladas, y su salida es una placa de CATÁLOGO (material
 * mínimo, maquinable). El espesor lo GOBIERNA la más exigente de:
 *
 *   1. DEFLEXIÓN (§12.1.2): bajo la presión de inyección la placa flexiona; si se
 *      abre más que el venteo (~0.02 mm) hay FLASH → t ≥ (F·L³·12 / (48·E·W·δ_máx))^⅓
 *   2. ALOJAR EL ENFRIAMIENTO (§9.2.5): la línea de agua va a ~2·Ø de la superficie
 *      y necesita ≥1·Ø de acero atrás → t ≥ prof_línea + 1.5·Ø
 *   3. ALOJAR LOS EXPULSORES: carrera del pin + placa retenedora (opcional)
 *
 * y como δ ∝ claro³, poner PILARES de soporte (que dividen el claro) adelgaza la
 * placa dramáticamente → menos material. El resolvedor busca la combinación
 * placa-comercial + nº de pilares de MÍNIMO acero. Reproduce el bezel del libro
 * (120 mm → 0.056 mm FLASH; sin pilares exige ~169 mm → placa 176). PURO.
 */

import { minPlateThickness, plateBending, E_STEEL, TON_N } from './structural';

export { E_STEEL, TON_N };

/** Espesores de placa ESTÁNDAR (mm) — serie métrica Meusburger/HASCO (F-plates). */
export const COMMERCIAL_PLATE_THK = [
  22, 27, 36, 46, 56, 66, 76, 86, 96, 106, 116, 126, 136, 146, 156,
  176, 196, 226, 256, 296, 346, 396, 446, 496, 546, 596, 696, 796,
];

/** El primer espesor de catálogo ≥ requerido (o null si excede el catálogo). */
export function snapToCommercialPlate(tMm: number): number | null {
  return COMMERCIAL_PLATE_THK.find((t) => t >= tMm) ?? null;
}

/** Restricción 1 — espesor mínimo por DEFLEXIÓN (despeja Eq 12.10-12.11). */
export function thicknessByDeflection(o: {
  clampTons: number; spanM: number; widthM: number; ventGapM?: number; ePa?: number;
}): number {
  const F = o.clampTons * TON_N;
  const dMax = o.ventGapM ?? 0.02e-3;               // venteo típico 0.02 mm (§8)
  return minPlateThickness(F, o.spanM, o.widthM, dMax, o.ePa ?? E_STEEL) * 1000;
}

/** Restricción 2 — espesor mínimo para ALOJAR la línea de enfriamiento (§9.2.5). */
export function thicknessByCooling(o: {
  lineDepthMm: number;                              // profundidad del CENTRO de la línea a la superficie (≈2·Ø)
  lineDiaMm: number;                                // Ø de la línea (del resolvedor de enfriamiento)
  steelBelowDia?: number;                           // acero mínimo bajo la línea, en Ø (§9.2.5: ≥1)
}): number {
  const below = o.steelBelowDia ?? 1;
  return o.lineDepthMm + o.lineDiaMm * (0.5 + below); // centro + radio + acero atrás
}

/** Restricción 3 — espesor para ALOJAR el sistema de expulsión (carrera + retenedora). */
export function thicknessByEjection(o: { strokeMm: number; retainerMm?: number }): number {
  return o.strokeMm + (o.retainerMm ?? 20);
}

/**
 * Efecto de PILARES de soporte: N pilares igualmente espaciados dividen el claro
 * en (N+1) tramos → δ ∝ (claro/(N+1))³, así que el espesor requerido cae ~×(N+1).
 * Devuelve el claro efectivo.
 */
export function spanWithPillars(spanM: number, nPillars: number): number {
  return spanM / (nPillars + 1);
}

export interface PlateSizing {
  tDeflectionMm: number; tCoolingMm: number; tEjectionMm: number;
  tRequiredMm: number; governs: 'deflexión' | 'enfriamiento' | 'expulsión';
  plateThkMm: number | null;                        // placa COMERCIAL elegida
  deflectionAtPlateMm: number;                      // deflexión real con esa placa
  ventGapMm: number; flashOk: boolean;
  nPillars: number;
  plateMassKg: number; pillarMassKg: number; steelMassKg: number;  // placa + pilares = total
  notas: string[];
}

/** Densidad del acero de molde (kg/m³). */
const RHO_STEEL = 7850;

/**
 * RESUELVE la placa de SOPORTE (puramente estructural, detrás del núcleo) para un
 * nº de pilares dado: gobierna la DEFLEXIÓN (o la carrera del expulsor si es más
 * exigente), aterriza en placa comercial y calcula la deflexión real y la masa
 * TOTAL de acero (placa + pilares). Los pilares son columnas a compresión:
 * cargan la flexión muchísimo mejor que una placa gruesa, por eso adelgazan la
 * placa y bajan el material total. (El enfriamiento cercano a la superficie vive
 * en la placa de CAVIDAD → `sizeCavityPlate`, no aquí.)
 */
export function sizeSupportPlate(o: {
  clampTons: number; spanM: number; widthM: number; ventGapM?: number;
  ejectStrokeMm?: number;
  nPillars?: number; pillarDiaMm?: number; pillarHeightMm?: number; ePa?: number;
}): PlateSizing {
  const nPillars = o.nPillars ?? 0;
  const ventGap = o.ventGapM ?? 0.02e-3;
  const spanEff = spanWithPillars(o.spanM, nPillars);
  const tDefl = thicknessByDeflection({ clampTons: o.clampTons, spanM: spanEff, widthM: o.widthM, ventGapM: ventGap, ePa: o.ePa });
  const tEject = o.ejectStrokeMm != null ? thicknessByEjection({ strokeMm: o.ejectStrokeMm }) : 0;
  const tReq = Math.max(tDefl, tEject);
  const governs = tReq === tDefl ? 'deflexión' : 'expulsión';
  const plate = snapToCommercialPlate(tReq);
  const notas: string[] = [];
  if (!plate) notas.push(`espesor requerido ${tReq.toFixed(0)} mm excede el catálogo (máx ${COMMERCIAL_PLATE_THK.at(-1)}): placa a medida o más pilares`);
  // deflexión real con la placa comercial elegida (Eq 12.10 con el claro efectivo)
  const F = o.clampTons * TON_N;
  const H = (plate ?? tReq) / 1000;
  const deflM = plateBending(F, spanEff, o.widthM, H, o.ePa ?? E_STEEL).deflectionM;
  const flashOk = deflM <= ventGap;
  if (!flashOk) notas.push(`deflexión ${(deflM * 1e3).toFixed(3)} mm > venteo ${(ventGap * 1e3).toFixed(3)} → FLASH: subir placa o pilares`);
  const plateMass = (plate ?? tReq) / 1000 * o.spanM * o.widthM * RHO_STEEL;
  const pd = (o.pillarDiaMm ?? 30) / 1000, ph = (o.pillarHeightMm ?? 80) / 1000;
  const pillarMass = nPillars * Math.PI * (pd / 2) ** 2 * ph * RHO_STEEL;
  if (nPillars > 0) notas.push(`${nPillars} pilar(es) de soporte — deben caber en el layout de expulsores`);
  return {
    tDeflectionMm: +tDefl.toFixed(1), tCoolingMm: 0, tEjectionMm: +tEject.toFixed(1),
    tRequiredMm: +tReq.toFixed(1), governs, plateThkMm: plate,
    deflectionAtPlateMm: +(deflM * 1000).toFixed(4), ventGapMm: +(ventGap * 1000).toFixed(3), flashOk,
    nPillars, plateMassKg: +plateMass.toFixed(1), pillarMassKg: +pillarMass.toFixed(2),
    steelMassKg: +(plateMass + pillarMass).toFixed(1), notas,
  };
}

export interface CavityPlateSizing {
  cavityDepthMm: number; coolingBehindMm: number;
  tRequiredMm: number; governs: 'cavidad' | 'enfriamiento';
  plateThkMm: number | null; notas: string[];
}

/**
 * RESUELVE la placa de CAVIDAD/NÚCLEO: debe contener la profundidad de la pieza y
 * BAJO ella enterrar la línea de agua con acero suficiente (§4.2.1/§9.2.5: 3·Ø
 * detrás de la superficie). t = prof_pieza + 3·Ø_línea, a placa comercial. Para
 * piezas planas GOBIERNA el enfriamiento; para hondas, la profundidad.
 */
export function sizeCavityPlate(o: {
  cavityDepthMm: number; lineDiaMm: number; steelBehindDia?: number;
}): CavityPlateSizing {
  const behind = (o.steelBehindDia ?? 3) * o.lineDiaMm;   // 3·Ø detrás de la superficie
  const tReq = o.cavityDepthMm + behind;
  const governs = o.cavityDepthMm >= behind ? 'cavidad' : 'enfriamiento';
  const plate = snapToCommercialPlate(tReq);
  const notas: string[] = [];
  if (!plate) notas.push(`placa de cavidad ${tReq.toFixed(0)} mm excede el catálogo: inserto o base custom`);
  return {
    cavityDepthMm: o.cavityDepthMm, coolingBehindMm: +behind.toFixed(1),
    tRequiredMm: +tReq.toFixed(1), governs, plateThkMm: plate, notas,
  };
}

export interface PlateOptimum {
  best: PlateSizing;
  options: PlateSizing[];                            // por nº de pilares
}

/**
 * OPTIMIZA el nº de pilares para MÍNIMO material: prueba 0..maxPillars, y elige
 * la placa comercial más delgada válida con menos acero. Pilares = menos claro =
 * placa más fina; el óptimo es el de menor masa que no da flash y usa catálogo.
 */
export function optimizeSupportPlate(o: {
  clampTons: number; spanM: number; widthM: number; ventGapM?: number;
  ejectStrokeMm?: number;
  maxPillars?: number; pillarDiaMm?: number; pillarHeightMm?: number; ePa?: number;
}): PlateOptimum {
  const maxP = o.maxPillars ?? 4;
  const options: PlateSizing[] = [];
  for (let n = 0; n <= maxP; n++) options.push(sizeSupportPlate({ ...o, nPillars: n }));
  // válidas: sin flash y con placa de catálogo; mínimo acero; a empate, menos pilares
  const valid = options.filter((s) => s.flashOk && s.plateThkMm != null);
  const best = (valid.length ? valid : options).sort(
    (a, b) => a.steelMassKg - b.steelMassKg || a.nPillars - b.nPillars,
  )[0];
  return { best, options };
}
