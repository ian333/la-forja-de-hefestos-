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
 *   3. ALOJAR LOS EXPULSORES: carrera del pin + placa retenedora (opcional — y HOY
 *      NADIE LA PASA: quien dimensiona por la carrera de expulsión es la CAJA
 *      (`sizeEjectorHousing`, §4.3.2), que vive DEBAJO de la placa de soporte. El
 *      reparto es ese: la caja aloja el recorrido, el soporte carga la flexión.)
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

/* ═══════════════════════════════════════════════════════════════════════════════
 * LA CAJA EXPULSORA — dimensión "C" de la Fig 4.22, §4.3.2 LITERAL
 * ═══════════════════════════════════════════════════════════════════════════════
 * *"The travel of the ejector plate should be selected to eject the part from the
 *  mold. Often, THE EJECTOR TRAVEL IS SET TO BE EQUAL TO THE DEPTH OF THE MOLDED
 *  PART. From the ejector travel, the height of the ejector housing, dimension
 *  'C', IS ASSIGNED by the mold base supplier."*  (§4.3.2, Fig 4.22)
 *
 * O sea: manda LA CARRERA y la caja se le asigna. El código lo tenía AL REVÉS —
 * `packageToAssemblySpec` clavaba C = 66 mm para cualquier pieza y la carrera salía
 * de restarle las placas del paquete expulsor:
 *      libre = 66 − 4 − max(15, 0.28·66) − max(12, 0.20·66) = 66 − 4 − 18 − 13 = 31 mm
 * MEDIDO (plan de inspección 2026-09-21, punto 3.2, 4 piezas reales): 3/4 NO cabían
 * — carcasa pedía 41.3, 1599HBK 43.5, 1557BGY 39.2 contra esos 31 mm. La retenedora
 * se metía 8 a 12 mm DENTRO de la placa de soporte en cada ciclo (video 35).
 *
 * Aquí viven las fracciones del paquete expulsor en UN solo lugar. Antes estaban
 * TECLEADAS EN SEIS SITIOS: `plateDefs` (0.20 y 0.28), `plateStackZ` (0.28), el
 * contrataladro de cabezas de `buildPlateSolid` (0.2), `cicloPortamoldesPieza` (0.20)
 * y DOS veces en `estudio-molde-datos` (0.28, además mal nombradas `retH`). Seis copias
 * de una proporción = cinco maneras de que el plano y el 3D dejen de ser el mismo molde.
 * Y aquí también vive el dimensionador que INVIERTE la relación: carrera → caja de catálogo.
 * ═══════════════════════════════════════════════════════════════════════════════ */

/** Placa EXPULSORA (la que empuja) como fracción de la caja — proporción de catálogo
 *  Meusburger/HASCO heredada del set de planos; NO sale del libro (§4.3.2 dice que la
 *  asigna el proveedor de la base, sin dar la partición interna). Declarada NUESTRA. */
export const EJECTOR_PLATE_FRAC = 0.28;
export const EJECTOR_PLATE_MIN_MM = 15;
/** Placa RETENEDORA (la que sujeta las cabezas de los pines) — misma nota. */
export const EJECTOR_RETAINER_FRAC = 0.20;
export const EJECTOR_RETAINER_MIN_MM = 12;
/** DESCANSO entre la sujeción inferior y la expulsora: donde viven los stop pins
 *  (§11, Fig 11.1: "ejector plate, ejector retainer plate, return pins, ejector pins,
 *  STOP PINS … housed between the rear clamp plate, support plate, and rails"). El
 *  libro no da el número: 4 mm es NUESTRO, heredado de `plateStackZ`. */
export const EJECTOR_REST_MM = 4;
/** HOLGURA al final de la carrera: acero que debe quedar entre la cara de la retenedora
 *  y la de soporte con los expulsores AFUERA. Regla NUESTRA, sin cita — razón: que el
 *  tope del ciclo sean los stop pins / el vástago de la máquina y NUNCA la placa de
 *  soporte (§11.3.8 advierte del daño cuando la máquina fuerza el paquete más allá de
 *  su recorrido libre). MEDIDO el costo de estos 2 mm: con 1 mm la tapa 1594C caería de
 *  caja 66 a 56 y el ensamble 1557BGY de 96 a 86 (menos acero, §12.1.3 "minimize the size
 *  of the mold"). Se dejan en 2 porque así NINGUNA pieza que hoy pasa el 3.2 cambia de
 *  caja — el arreglo toca solo los moldes que estaban rotos. Queda para que ian lo decida. */
export const EJECTOR_CLEARANCE_MM = 2;
/** MARGEN sobre la profundidad de la pieza para la carrera de expulsión. §4.3.2 pone
 *  E = profundidad de la pieza ("often"); estos 8 mm de más son NUESTROS —razón: que la
 *  pieza no solo se despegue sino que LIBRE el macho y caiga— y ya estaban tecleados en
 *  `ForgeBRepStudio` y en `estacion10Dado`. Aquí quedan en un solo lugar. */
export const EJECCION_MARGEN_MM = 8;

/** Espesor de la placa EXPULSORA para una caja de altura `housingMm`. */
export const ejectorPlateMm = (housingMm: number): number =>
  Math.max(EJECTOR_PLATE_MIN_MM, Math.round(housingMm * EJECTOR_PLATE_FRAC));
/** Espesor de la placa RETENEDORA para una caja de altura `housingMm`. */
export const ejectorRetainerMm = (housingMm: number): number =>
  Math.max(EJECTOR_RETAINER_MIN_MM, Math.round(housingMm * EJECTOR_RETAINER_FRAC));
/** CARRERA LIBRE que queda dentro de una caja de altura `housingMm`: lo que la
 *  retenedora puede subir antes de tocar la placa de soporte. */
export const carreraLibreEnCaja = (housingMm: number): number =>
  +(housingMm - EJECTOR_REST_MM - ejectorPlateMm(housingMm) - ejectorRetainerMm(housingMm)).toFixed(1);

/** CARRERA DE EXPULSIÓN pedida por la pieza (mm) — §4.3.2 ("often … equal to the depth
 *  of the molded part") + `EJECCION_MARGEN_MM` declarado nuestro. */
export const carreraDeExpulsionMm = (alturaPiezaMm: number): number =>
  +(Math.max(0, alturaPiezaMm || 0) + EJECCION_MARGEN_MM).toFixed(1);

export interface EjectorHousingSizing {
  carreraMm: number; holguraMm: number;
  /** altura cerrada mínima que exige la carrera, ANTES de aterrizar en catálogo */
  tRequiredMm: number;
  /** la caja de CATÁLOGO elegida (null = excede la serie comercial) */
  housingMm: number | null;
  ejectorMm: number; retainerMm: number; restMm: number;
  /** carrera que de verdad queda libre con esa caja (≥ carrera + holgura) */
  carreraLibreMm: number;
  cabe: boolean; notas: string[];
}

/**
 * DIMENSIONA LA CAJA EXPULSORA POR LA CARRERA (§4.3.2, Fig 4.22).
 * Forma cerrada: como las dos placas son fracciones de la caja,
 *      C ≥ (carrera + holgura + descanso) / (1 − 0.28 − 0.20)
 * pero los PISOS (15 y 12 mm) rompen la proporción en cajas chicas, así que el
 * resultado se VERIFICA recorriendo la serie comercial con las fórmulas reales y se
 * devuelve la primera caja donde `carreraLibreEnCaja` alcanza de verdad. Medir en vez
 * de confiar en el despeje es la diferencia entre un número y un molde que abre.
 */
export function sizeEjectorHousing(o: { carreraMm: number; holguraMm?: number }): EjectorHousingSizing {
  const holgura = o.holguraMm ?? EJECTOR_CLEARANCE_MM;
  const carrera = Math.max(0, o.carreraMm || 0);
  const pide = carrera + holgura + EJECTOR_REST_MM;
  const tRequired = +(pide / (1 - EJECTOR_PLATE_FRAC - EJECTOR_RETAINER_FRAC)).toFixed(1);
  const housing = COMMERCIAL_PLATE_THK.find((c) => carreraLibreEnCaja(c) >= carrera + holgura) ?? null;
  const notas: string[] = [];
  if (!housing) notas.push(`la carrera ${carrera.toFixed(1)} mm pide una caja > ${COMMERCIAL_PLATE_THK[COMMERCIAL_PLATE_THK.length - 1]} mm: paquete expulsor a medida o expulsión en dos etapas (§11.3.9)`);
  const c = housing ?? tRequired;
  const libre = carreraLibreEnCaja(c);
  return {
    carreraMm: +carrera.toFixed(1), holguraMm: holgura, tRequiredMm: tRequired,
    housingMm: housing, ejectorMm: ejectorPlateMm(c), retainerMm: ejectorRetainerMm(c), restMm: EJECTOR_REST_MM,
    carreraLibreMm: libre, cabe: libre >= carrera, notas,
  };
}

/** PLACAS DE SUJECIÓN (superior e inferior), mm. Literal de catálogo, y el libro dice
 *  por qué NO hay ecuación que las dimensione: §12.1.1 — *"For most molds, the cavity
 *  inserts are directly supported by the top clamp plate and the stationary platen. As
 *  such, the cavity inserts are generally in a state of PURE COMPRESSION so very little
 *  out of plane bending occurs."* La flexión la cargan el núcleo y la placa de SOPORTE
 *  (`sizeSupportPlate`), no las sujeciones: sin criterio de deflexión no hay nada que
 *  despejar, y queda el espesor de catálogo (36 = talla Meusburger, ya en la serie). */
export const CLAMP_PLATE_MM = 36;

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

export interface StressMethod {
  metodo: 'deflexión-pura' | 'yield/f' | 'peor-caso';
  f?: number;
  sigmaLimitMPa?: number;
  cita: string;
}
export interface PlateSizing {
  tDeflectionMm: number; tCoolingMm: number; tEjectionMm: number;
  tRequiredMm: number; governs: 'deflexión' | 'enfriamiento' | 'expulsión';
  plateThkMm: number | null;                        // placa COMERCIAL elegida
  deflectionAtPlateMm: number;                      // deflexión real con esa placa
  ventGapMm: number; flashOk: boolean;
  nPillars: number;
  plateMassKg: number; pillarMassKg: number; steelMassKg: number;  // placa + pilares = total
  /** §12.1.1: qué método se usó para el esfuerzo admisible (NUNCA los dos a la vez). */
  stressMethod: StressMethod;
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
    steelMassKg: +(plateMass + pillarMass).toFixed(1),
    stressMethod: { metodo: 'deflexión-pura', cita: '§12.1.2 — el criterio es δ ≤ venteo, no σ ≤ σ_limit' },
    notas,
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

/**
 * RESUELVE la placa del NÚCLEO (retenedora B) desde SU PROPIO inserto — §4.2.1 (Fig 4.13):
 * la altura del inserto de núcleo "de la cara TRASERA a la partición" = prof del núcleo BAJO
 * la partición + 3·Ø de la línea de enfriamiento. En piezas donde el macho SOBRESALE hacia la
 * cavidad (vaso, caja), la prof bajo-partición ≈ 0 → placa B = 3·Ø (el macho vive ARRIBA, en
 * la región de A). NO es el cálculo de CAVIDAD (esa lleva la prof completa de la pieza).
 * Copiar B de A (como estaba) viola §4.2.1: cada placa se dimensiona a SU inserto.
 */
export function sizeCorePlate(o: {
  coreBelowPartingMm?: number; lineDiaMm: number; steelBehindDia?: number;
}): CavityPlateSizing {
  const below = o.coreBelowPartingMm ?? 0;
  const behind = (o.steelBehindDia ?? 3) * o.lineDiaMm;   // 3·Ø detrás de la superficie moldeante del núcleo
  const tReq = below + behind;
  const governs = below >= behind ? 'cavidad' : 'enfriamiento';
  const plate = snapToCommercialPlate(tReq);
  const notas: string[] = [];
  if (!plate) notas.push(`placa de núcleo ${tReq.toFixed(0)} mm excede el catálogo: inserto o base custom`);
  return {
    cavityDepthMm: below, coolingBehindMm: +behind.toFixed(1),
    tRequiredMm: +tReq.toFixed(1), governs, plateThkMm: plate, notas,
  };
}

export interface PlateOptimum {
  best: PlateSizing;
  options: PlateSizing[];                            // por nº de pilares
}

/**
 * OPTIMIZA los pilares — POLÍTICA DEL LIBRO §12.1.3 + §12.2.3
 * ===========================================================
 * El criterio es MINIMIZAR EL TAMAÑO DEL MOLDE, y los pilares son una de las dos
 * herramientas para lograrlo. §12.1.3 literal: "the repeated use of very large and
 * thick plates can result in an overly heavy and expensive mold with a stack height
 * that limits the availability of molding machines. For this reason, the mold
 * designer should seek to MINIMIZE THE SIZE OF THE MOLD through appropriate analysis
 * and careful specification of plate thicknesses AND SUPPORT STRUCTURES SUCH AS
 * PILLARS and interlocks."
 *
 * Y §12.2.3 muestra el proceso: mete el pilar, y si la deflexión no alcanza AGRANDA
 * el pilar (Ø37.5 → Ø50 en el bezel) — nunca lo quita. Al cerrar el ejemplo:
 * "the thickness of the B plate and/or support plate could be slightly reduced while
 * still meeting the deflection requirement" — o sea, con pilar la placa ADELGAZA.
 *
 * ⚠ CAMBIO DE POLÍTICA (2026-07-31): antes se ordenaba por MENOS PILARES primero
 * (simplicidad de taller). El contrato §12.2.3 midió el costo de esa política en el
 * vaso del libro: 0 pilares pedía placa de 126 mm y 287.5 kg de acero, contra 4
 * pilares con placa de 27 mm y 63.4 kg — 4.5× más acero Y peor deflexión (0.0184 vs
 * 0.0150 mm). La opción elegida estaba DOMINADA EN AMBOS EJES. El libro es ley: se
 * ordena por acero total, que es la traducción directa de "minimize the size".
 *
 * ÚNICA excepción, también del libro: el pilar ÚNICO Y CENTRAL es antipatrón —
 * "will not greatly reduce the deflection… since the majority of the plate bending
 * will occur due to the loading on the left and right sides", y además choca con el
 * vástago de expulsión central de la máquina. Se desempata en su contra.
 */
export function optimizeSupportPlate(o: {
  clampTons: number; spanM: number; widthM: number; ventGapM?: number;
  ejectStrokeMm?: number;
  maxPillars?: number; pillarDiaMm?: number; pillarHeightMm?: number; ePa?: number;
}): PlateOptimum {
  const maxP = o.maxPillars ?? 4;
  const options: PlateSizing[] = [];
  for (let n = 0; n <= maxP; n++) options.push(sizeSupportPlate({ ...o, nPillars: n }));
  // válidas: sin flash y con placa de catálogo
  const valid = options.filter((s) => s.flashOk && s.plateThkMm != null);
  // §12.1.3 minimizar el TAMAÑO del molde = menos acero total (placa + pilares);
  // a empate, el pilar único central pierde (§12.2.3 antipatrón).
  const antipatron = (s: PlateSizing) => (s.nPillars === 1 ? 1 : 0);
  const best = (valid.length ? valid : options).sort(
    (a, b) => a.steelMassKg - b.steelMassKg || antipatron(a) - antipatron(b),
  )[0];
  return { best, options };
}
