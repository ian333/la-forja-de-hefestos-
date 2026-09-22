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
 *      con δ_máx = 70 % del venteo por defecto (REGLA DE HEFESTOS, ver `juicioFlecha`)
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
 * (120 mm → 0.056 mm FLASH; sin pilares exige ~169 mm → placa 176, con `factorVenteo: 1`;
 * con el 70 % de Hefestos pide ~190 → placa 196). PURO.
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
 *  asigna el proveedor de la base, sin dar la partición interna). Regla de Hefestos. */
export const EJECTOR_PLATE_FRAC = 0.28;
export const EJECTOR_PLATE_MIN_MM = 15;
/** Placa RETENEDORA (la que sujeta las cabezas de los pines) — misma nota. */
export const EJECTOR_RETAINER_FRAC = 0.20;
export const EJECTOR_RETAINER_MIN_MM = 12;
/** DESCANSO entre la sujeción inferior y la expulsora: donde viven los stop pins
 *  (§11, Fig 11.1: "ejector plate, ejector retainer plate, return pins, ejector pins,
 *  STOP PINS … housed between the rear clamp plate, support plate, and rails"). El
 *  libro no da el número: 4 mm es regla de Hefestos, heredado de `plateStackZ`. */
export const EJECTOR_REST_MM = 4;
/** HOLGURA al final de la carrera: acero que debe quedar entre la cara de la retenedora
 *  y la de soporte con los expulsores AFUERA. Regla de Hefestos, sin cita — razón: que el
 *  tope del ciclo sean los stop pins / el vástago de la máquina y NUNCA la placa de
 *  soporte (§11.3.8 advierte del daño cuando la máquina fuerza el paquete más allá de
 *  su recorrido libre). MEDIDO el costo de estos 2 mm: con 1 mm la tapa 1594C caería de
 *  caja 66 a 56 y el ensamble 1557BGY de 96 a 86 (menos acero, §12.1.3 "minimize the size
 *  of the mold"). Se dejan en 2 porque así NINGUNA pieza que hoy pasa el 3.2 cambia de
 *  caja — el arreglo toca solo los moldes que estaban rotos. Queda para que ian lo decida. */
export const EJECTOR_CLEARANCE_MM = 2;
/** MARGEN sobre la profundidad de la pieza para la carrera de expulsión. §4.3.2 pone
 *  E = profundidad de la pieza ("often"); estos 8 mm de más son regla de Hefestos —razón: que la
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
 *  of the molded part") + `EJECCION_MARGEN_MM` (regla de Hefestos). */
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

/* ═══════════════════════════════════════════════════════════════════════════════
 * LA FLECHA DE LA PLACA SOPORTE CONTRA EL VENTEO — REGLA DE HEFESTOS (ian, 2026-09-22)
 * ═══════════════════════════════════════════════════════════════════════════════
 * Lo que dice el libro (§12.1.2): la placa se juzga contra el ESPESOR DEL VENTEO — si al
 * inyectar se dobla más que el venteo, las mitades se abren una rendija y sale rebaba.
 * El libro da el LÍMITE (δ ≤ venteo), pero NO da cuánto margen guardar debajo de él.
 * Antes el optimizador elegía el acero mínimo con δ ≤ venteo a secas: MEDIDO (orden LA
 * CARRERA CABE), con una carga de prueba la base 396×296 salía al 96 % del venteo
 * (0.0191 / 0.020 mm) — pasaba de panzazo, sin margen para el desgaste de la partición
 * (§8.1.2: la rebaba la va comiendo) ni para una presión de un ciclo malo.
 *
 * REGLA DE HEFESTOS (el número no sale de Kazmer — decidido por ian el 2026-09-22,
 * pregunta 3 del ACTA R93: «default 70 como límite 85, me gusta como regla de Hefestos»):
 *   · POR DEFECTO la placa se dimensiona para doblarse ≤ 70 % del venteo;
 *   · TOPE DURO 85 %: entre 70 y 85 el molde ADVIERTE (pasa, pero sin el margen de
 *     siempre); arriba de 85 VIOLA aunque el libro todavía lo dejaría pasar.
 * Razón del número: δ ∝ 1/t³, así que el 70 % cuesta solo (1/0.7)^⅓ = 1.126× de espesor
 * requerido — casi siempre se absorbe en el mismo escalón de catálogo — y deja 30 % de la
 * rendija para desgaste y sobrepresión. UNA constante, UNA función de juicio
 * (`juicioFlecha`): la usan el dimensionador, el optimizador, el contrato estructural
 * (mold-contratos) y la fila de la estación 11. Nadie más teclea 0.70 ni 0.85.
 * ═══════════════════════════════════════════════════════════════════════════════ */
export const REGLA_DE_HEFESTOS_FLECHA = {
  /** fracción del venteo a la que se DIMENSIONA la placa (por defecto) */
  defecto: 0.70,
  /** tope duro: arriba de esto el molde VIOLA */
  tope: 0.85,
  rotulo: 'regla de Hefestos',
} as const;

/** VENTEO DE LA PARTICIÓN — práctica del libro (cap 8; `ventDesign`: «0.02 partición»). El
 *  venteo de la E7 (`ventDesign.hSpecMm`) puede salir MÁS HONDO que esto cuando el aire lo
 *  pide (piezas grandes: medido 0.046–0.063 mm en las 4 piezas del plan) — pero la
 *  partición entera no se ventea a esa hondura, solo las ranuras. La placa se juzga contra
 *  la MÁS ESTRICTA de las dos, y ESA misma cifra la usan el dimensionador y el contrato. */
export const VENTEO_PARTICION_MM = 0.02;
/** La referencia de venteo contra la que se juzga la flecha (mm): la más estricta entre la
 *  práctica de la partición (0.02) y el venteo que especificó la E7. UNA verdad para el
 *  dimensionador (moldmachine) y para el contrato estructural. */
export function venteoDeReferenciaMm(hVentE7Mm?: number | null): number {
  return Number.isFinite(hVentE7Mm) && (hVentE7Mm as number) > 0 ? Math.min(hVentE7Mm as number, VENTEO_PARTICION_MM) : VENTEO_PARTICION_MM;
}

export interface JuicioFlecha {
  /** flecha / venteo, en % */
  usoPct: number;
  deltaMm: number; venteoMm: number;
  /** 70 % y 85 % del venteo, en mm */
  defectoMm: number; topeMm: number;
  /** CUMPLE ≤ 70 % · ADVIERTE 70–85 % · VIOLA > 85 % */
  estado: 'CUMPLE' | 'ADVIERTE' | 'VIOLA';
  /** δ > venteo: la rendija ya es más ancha que el venteo (rebaba segura, §12.1.2) */
  rebaba: boolean;
  texto: string;
}
/** EL JUICIO de la flecha contra el venteo — regla de Hefestos (ver arriba). Única fuente. */
export function juicioFlecha(deltaMm: number, venteoMm: number): JuicioFlecha {
  const R = REGLA_DE_HEFESTOS_FLECHA;
  const uso = venteoMm > 0 ? deltaMm / venteoMm : Infinity;
  const estado: JuicioFlecha['estado'] = uso <= R.defecto + 1e-9 ? 'CUMPLE' : uso <= R.tope + 1e-9 ? 'ADVIERTE' : 'VIOLA';
  const usoPct = +(uso * 100).toFixed(1);
  const rebaba = deltaMm > venteoMm;
  const texto = `se dobla ${deltaMm.toFixed(4)} mm = ${usoPct} % del venteo ${venteoMm.toFixed(3)} mm (${R.rotulo}: ≤ ${R.defecto * 100} % por defecto, tope ${R.tope * 100} %) → `
    + (estado === 'CUMPLE' ? 'con margen ✓'
      : estado === 'ADVIERTE' ? 'pasa SIN el margen de siempre (entre el defecto y el tope)'
        : rebaba ? 'REBABA: la rendija es más ancha que el venteo (§12.1.2)' : 'arriba del tope duro: poco margen para desgaste y sobrepresión');
  return { usoPct, deltaMm, venteoMm, defectoMm: +(R.defecto * venteoMm).toFixed(4), topeMm: +(R.tope * venteoMm).toFixed(4), estado, rebaba, texto };
}

/** Restricción 1 — espesor mínimo por DEFLEXIÓN (despeja Eq 12.10-12.11). */
export function thicknessByDeflection(o: {
  clampTons: number; spanM: number; widthM: number; ventGapM?: number; ePa?: number;
}): number {
  const F = o.clampTons * TON_N;
  const dMax = o.ventGapM ?? VENTEO_PARTICION_MM * 1e-3;   // venteo de la partición 0.02 mm (cap 8)
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
  ventGapMm: number;
  /** δ ≤ venteo — el LÍMITE del libro (§12.1.2); la rendija no pasa del venteo */
  flashOk: boolean;
  /** el juicio con margen — REGLA DE HEFESTOS (≤ 70 % por defecto, tope 85 %) */
  hefestos: JuicioFlecha;
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
  /** fracción del venteo a la que se dimensiona (default: REGLA DE HEFESTOS 0.70; 1 = el límite
   *  pelón del libro, para reproducir sus ejemplos) */
  factorVenteo?: number;
}): PlateSizing {
  const nPillars = o.nPillars ?? 0;
  const ventGap = o.ventGapM ?? VENTEO_PARTICION_MM * 1e-3;
  const factor = o.factorVenteo ?? REGLA_DE_HEFESTOS_FLECHA.defecto;
  const spanEff = spanWithPillars(o.spanM, nPillars);
  // se DESPEJA el espesor para la flecha OBJETIVO (factor·venteo), no para el venteo a secas:
  // así el acero mínimo que sale ya trae el margen de Hefestos (δ ∝ 1/t³ → ×1.126 de t con 0.70).
  const tDefl = thicknessByDeflection({ clampTons: o.clampTons, spanM: spanEff, widthM: o.widthM, ventGapM: ventGap * factor, ePa: o.ePa });
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
  const hefestos = juicioFlecha(+(deflM * 1000).toFixed(4), +(ventGap * 1000).toFixed(3));
  if (!flashOk) notas.push(`deflexión ${(deflM * 1e3).toFixed(3)} mm > venteo ${(ventGap * 1e3).toFixed(3)} → FLASH: subir placa o pilares`);
  else if (hefestos.estado !== 'CUMPLE') notas.push(`${hefestos.texto}: subir placa o pilares`);
  const plateMass = (plate ?? tReq) / 1000 * o.spanM * o.widthM * RHO_STEEL;
  const pd = (o.pillarDiaMm ?? 30) / 1000, ph = (o.pillarHeightMm ?? 80) / 1000;
  const pillarMass = nPillars * Math.PI * (pd / 2) ** 2 * ph * RHO_STEEL;
  if (nPillars > 0) notas.push(`${nPillars} pilar(es) de soporte — deben caber en el layout de expulsores`);
  return {
    tDeflectionMm: +tDefl.toFixed(1), tCoolingMm: 0, tEjectionMm: +tEject.toFixed(1),
    tRequiredMm: +tReq.toFixed(1), governs, plateThkMm: plate,
    deflectionAtPlateMm: +(deflM * 1000).toFixed(4), ventGapMm: +(ventGap * 1000).toFixed(3), flashOk, hefestos,
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
  /** qué escalón de la regla de Hefestos alcanzó la elegida: 'defecto' (≤ 70 %), 'tope' (≤ 85 %,
   *  ninguna opción daba el 70) o 'ninguna' (ni el tope: el molde lo DICE en `best.notas`) */
  escalon: 'defecto' | 'tope' | 'ninguna';
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
  factorVenteo?: number;
}): PlateOptimum {
  const maxP = o.maxPillars ?? 4;
  const options: PlateSizing[] = [];
  for (let n = 0; n <= maxP; n++) options.push(sizeSupportPlate({ ...o, nPillars: n }));
  // §12.1.3 minimizar el TAMAÑO del molde = menos acero total (placa + pilares);
  // a empate, el pilar único central pierde (§12.2.3 antipatrón).
  const antipatron = (s: PlateSizing) => (s.nPillars === 1 ? 1 : 0);
  const porAcero = (a: PlateSizing, b: PlateSizing) => a.steelMassKg - b.steelMassKg || antipatron(a) - antipatron(b);
  // REGLA DE HEFESTOS en escalones: primero el acero mínimo que se dobla ≤ 70 % del venteo; si
  // ninguna opción de catálogo lo da, el acero mínimo ≤ 85 % (el tope) — y si ni eso, la que MENOS
  // se dobla, con el aviso escrito. Antes el filtro era `flashOk` (δ ≤ venteo, cero margen).
  const conCatalogo = options.filter((s) => s.plateThkMm != null);
  const defecto = conCatalogo.filter((s) => s.hefestos.estado === 'CUMPLE').sort(porAcero);
  const tope = conCatalogo.filter((s) => s.hefestos.estado !== 'VIOLA').sort(porAcero);
  let best: PlateSizing, escalon: PlateOptimum['escalon'];
  if (defecto.length) { best = defecto[0]; escalon = 'defecto'; }
  else if (tope.length) {
    best = tope[0]; escalon = 'tope';
    best.notas.push(`ninguna opción de 0–${maxP} pilares se dobla ≤ ${REGLA_DE_HEFESTOS_FLECHA.defecto * 100} % del venteo con placa de catálogo: se elige la de menos acero dentro del tope ${REGLA_DE_HEFESTOS_FLECHA.tope * 100} % (regla de Hefestos)`);
  } else {
    best = [...(conCatalogo.length ? conCatalogo : options)].sort((a, b) => a.deflectionAtPlateMm - b.deflectionAtPlateMm)[0]; escalon = 'ninguna';
    best.notas.push(`⚠ NINGUNA opción de 0–${maxP} pilares queda dentro del tope ${REGLA_DE_HEFESTOS_FLECHA.tope * 100} % del venteo (regla de Hefestos): la que menos se dobla va al ${best.hefestos.usoPct} % — más pilares, placa a medida o base más rígida`);
  }
  return { best, options, escalon };
}
