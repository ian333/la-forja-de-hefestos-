/**
 * LA MÁQUINA DE MOLDES — orquestador maestro de La Forja.
 * ========================================================
 * EL PRODUCTO que se cobra caro: el cliente trae su PIEZA y esta función
 * devuelve el MOLDE completo, cotizado y con veredicto de ingeniería.
 *
 *   moldMachine(spec) → {
 *     dfm,             ¿es moldeable? (Kazmer §2.3) — puerta 0
 *     recomendacion,   arquitectura + nº de cavidades ÓPTIMOS por economía
 *     variantes,       la rejilla evaluada (2/3-placas × 1/2/4/8/16 cav)
 *     insertos, base,  dimensiones de insertos + mold base estándar + acero
 *     cotizacion,      costeo DETALLADO §3.3 de la ganadora ($)
 *     costoPieza,      §3.4 (mold/material/proceso amortizados)
 *     breakEven,       cuándo cambiar de arquitectura
 *     veredicto,       viable + banderas + PRECIO SUGERIDO + entrega
 *     reporte,         hoja de ingeniería unificada para el cliente
 *   }
 *
 * Une los ~15 módulos Kazmer que ya viven en src/forja/mold/. PURO
 * (node-testeable): el análisis geométrico B-Rep (splitMold, planos) se
 * engancha aparte con la Shape; la máquina razona sobre las dimensiones.
 */
import { ABS_MG47, convergeVelocity, convergeVelocityTraced, pressureDropSegment, clampMetricTons, type MeltMaterial } from './filling';
import { checkDFM, type DFMPart, type DFMReport } from './dfm';
import { sizeInserts, selectMoldBase, selectMetal, type InsertSizing, type BaseSelection, type MoldMetal } from './moldbase';
import {
  estimateMoldCost, estimatePartCost, MACHINING_FACTOR, type CostInputs, type CostBreakdown, type PartCostBreakdown,
} from './moldcost-detailed';
import { heatToRemove, ABS_KAZMER } from './cooling';
import { designCoolingLines, type CoolingLineDesign } from './coolinglines';
import { ABS_EJECT, ejectionVector, effectiveArea, ejectorPinSizing, type EjectionVector } from './ejection';
import { optimizeSupportPlate, sizeCavityPlate, sizeCorePlate, venteoDeReferenciaMm, type PlateSizing, type CavityPlateSizing } from './platesizing';
import { machineRequirements, selectInjectionMachine, type MachineRequirements, type MachineSelection } from './machinesizing';
import { carreraDeApertura } from './threeplate';
import { designFeedSystem, estPartVolumeCc, FEED_MATERIALS, pressureDropRunner, runnerCoolingTimeS, shearRateRunner, reynolds, type FeedSystemDesign } from './feed';
import { shrinkageRecommendation, ABS_TAIT } from './shrinkage';
import { designGateProcess, gateFreezeCylS, type GateProcessDesign, type GateType } from './gating';
import { ventDesign } from './venting';

export type Arch = 'cold-2placas' | 'cold-3placas' | 'hot-runner';

/**
 * Producción anual ASUMIDA cuando la pieza no la declara — UNA sola cifra para el dictamen y para el
 * ciclo del molde (UNA SOLA VERDAD, 2026-09-09). Antes el dictamen asumía 200 000 y la hoja 100 000:
 * `nMin = ceil(Q·ciclo/(6000·3600))` daba 2 y 1 cavidades DE LA MISMA PIEZA en dos pantallas.
 */
export const Q_ANUAL_ASUMIDA = 100_000;

export interface MachineSpec {
  name: string;
  /** Geometría (mm/mm²/mm³). */
  Lmm: number; Wmm: number; Hmm: number;
  /** FORMA de la huella: 'round' = pieza de revolución (vaso, tapa, bote) → cavidad,
   *  inserto y núcleo REDONDOS (§12.3.2 hoop, el ejemplo del vaso del libro). Sin esto
   *  el molde salía siempre con cavidad CUADRADA: `packageToAssemblySpec` tenía
   *  `shape: 'rect'` hardcodeado aunque el camino redondo ya existía. */
  cavityShape?: 'rect' | 'round';
  surfaceMm2: number; volumeMm3: number; wallMm: number;
  /** Producción anual + horizonte total (piezas). */
  annualVolume: number; totalVolume?: number;
  /** Plástico (llave de PLASTICS). */
  plastic?: string;
  /** Acabado objetivo (SPI) sobre TODA la superficie (o desglose fino). */
  finish?: 'texture' | 'SPI B-3' | 'SPI A-3' | 'SPI A-1';
  /** Región de manufactura → tarifa de maquinado ($/h facturado). */
  machiningRateUSDh?: number;
  /** DFM: geometría declarada de la pieza (costillas, bosses, esquinas…). */
  dfm?: Partial<DFMPart>;
  /** Resina cargada/corrosiva (para el acero). */
  abrasive?: boolean; corrosive?: boolean; mirror?: boolean;
  /** Undercuts que exigen slide/core-pull. */
  undercuts?: Array<{ aProjMm2: number; strokeMm: number }>;
  /** El CLIENTE exige una alimentación (p.ej. Sony/LEGO piden colada caliente por
   *  calidad/sin regrind). Si se fija, la optimización se restringe a ella. */
  feedPref?: Arch;
  /** El CLIENTE exige un número de cavidades. Tabla 2.3 trae "Number of cavities
   *  per mold" con la advertencia de DOBLE NATURALEZA (§2.2.2): normalmente es un
   *  resultado intermedio del diseño, pero "some customers WILL provide these
   *  details as specifications that the mold designer must satisfy". Sin esto el
   *  motor siempre optimizaba y el cliente no podía imponer. */
  cavPref?: number;
  /** Margen de venta sobre el costo del molde (default 1.6 = 60 %). */
  margin?: number;
  /** Área proyectada REAL (mm²) desde dfm-mesh. Si se omite, se usa L×W (bbox). */
  projectedAreaMm2?: number;
  /** p_pack — presión de EMPAQUE en la cavidad (MPa), declarada en el intake. Sin ella, 50 MPa
   *  (`P_PACK_DEFECTO_MPA`, §5.5.3). Cierra el molde con ½·p_fill (gana la mayor) y de ese cierre
   *  salen placa de soporte, pilares y expulsión. Ver `presionesDelMolde`. */
  packMPa?: number;
  /** p_fill MEDIDA — `pMaxMPa` del solver FAN de la E5 (desde la boquilla). Sin ella, p_fill es la
   *  estimada (longitud de flujo ≈ largo) y la pantalla lo dice. Juzga colada, techo y máquina. */
  fillMPaFan?: number;
  /** EL BEBEDERO QUE SE CORTA (orden H · un veredicto): la colada de la E5 (`datumsColada`, colada.ts) — ⌀ de entrada, ⌀ de
   *  base, largo, modo y el caudal con el que la E5 la dimensionó. Con él la alimentación se JUZGA sobre ese cono (ΔP, t_c,
   *  volumen, γ̇, Re) en vez de diseñar otro, y en sprue DIRECTO la compuerta ES su base (§7.2.1). Sin él (el paso 4, antes
   *  del molde) el feed se diseña aquí como siempre. MEDIDO en la 1594C Box: el paquete juzgaba ⌀5.0→⌀11.94 × L 85.4 (⌀9.47
   *  con la p_fill del FAN) mientras la E5 corta ⌀5.0→⌀8.62 × L 69.2 — dos bebederos para el mismo molde. */
  bebederoCortado?: { diaTopMm: number; diaBaseMm: number; largoMm: number; modo: 'sprue-directo' | 'sprue+runner' | 'requiere-offset'; VdotCcS?: number };
  /** LA SECCIÓN MÁS GRUESA con su FORMA (orden H): la mide la lente ENFRIAMIENTO del Foco (§9.2.1 «consider the thickest
   *  section»). Un poste enfría como BARRA (Eq 9.6), una losa como PLACA (Eq 9.5); `tcS` es la que le toca a su forma. */
  seccionGruesa?: { mm: number; forma: 'barra' | 'placa'; tcS: number; barraS: number; placaS: number; lugares: number; anchoMm: number; regla: string };
  /** §10.3.1: topología de alabeo desde dfm-mesh. */
  warpageTopology?: { tipo: 'marco' | 'placa' | 'mixta'; solidFrac: number; interiorEmptyFrac: number };
  /** §10.1.7: quién firma la contracción (diseñador/moldeador/cliente/prototipo). */
  shrinkageResponsible?: string;
  /** §3.2.2: vetos no económicos que pueden tumbar al ganador. */
  vetos?: { cambioColorFrecuente?: boolean; paybackMaxMeses?: number; nota?: string };
}

interface ArchCav {
  arch: Arch; nCav: number; factible: boolean;
  clampTons: number; moldUSD: number; partUSD: number; totalUSD: number;
  cost: CostBreakdown; part: PartCostBreakdown;
}

/**
 * DISEÑO FÍSICO — las simulaciones acopladas resueltas sobre la ganadora: el
 * molde como sistema de ecuaciones (enfriamiento + expulsión + placas + máquina),
 * cada una aterrizada en componente COMERCIAL. Es lo que el cliente compra: no un
 * dibujo, un molde óptimo maquinable con placas y plugs de catálogo.
 */
export interface DiseñoFisico {
  /** p_fill y la presión media de cavidad al LLENAR (½·p_fill) */
  fillMPa: number; cavityMPa: number;
  /** de dónde salió p_fill: 'FAN E5' o 'estimada' (longitud de flujo ≈ largo), con su rótulo */
  fillFuente: PresionesDelMolde['fillFuente']; fillRotulo: string;
  /** p_pack (MPa) y si la declaró el intake o es la de §5.5.3 */
  packMPa: number; packFuente: PresionesDelMolde['packFuente'];
  /** la presión de cavidad con la que se CIERRA y se dimensiona la estructura = max(½·p_fill, p_pack) */
  clampMPa: number; clampManda: PresionesDelMolde['manda'];
  /** §5.5.1: la velocidad y SU ESCALERA de convergencia (un número sin su
   *  convergencia no es auditable — el libro publica la escalera completa). */
  velocidad: { vMs: number; escalera: number[]; convergio: boolean; vueltas: number };
  /** §6.4: el feed como LAZO (ΔP asignado → si la colada domina el ciclo, bajar ⌀).
   *  Antes la Máquina solo etiquetaba la arquitectura y estimaba el volumen del
   *  runner con una proporción fabricada (partCc × 0.25). */
  alimentacion: FeedSystemDesign;
  /** cap 8: espesor de venteo entre el mínimo (aire) y el máximo (rebaba). */
  venteo: ReturnType<typeof ventDesign>;
  /** §10.1.6: la contracción como RANGO + la alarma de sobre-empaque (s ≤ 0). */
  contraccion: ReturnType<typeof shrinkageRecommendation>;
  /** §7.3: el gate como PROCESO de 5 pasos, con freeze-vs-empaque y el salto de nivel. */
  gate: GateProcessDesign;
  enfriamiento: { qCavidadJ: number; qTotalW: number; cicloS: number; lineas: CoolingLineDesign };
  expulsion: { aEffM2: number; vector: EjectionVector; pines: ReturnType<typeof ejectorPinSizing> };
  placas: { soporte: PlateSizing; soporteOpciones: PlateSizing[]; cavidad: CavityPlateSizing; nucleo: CavityPlateSizing };
  maquina: { requerimientos: MachineRequirements; seleccion: MachineSelection };
}

export interface MoldPackage {
  spec: MachineSpec;
  dfm: DFMReport;
  metal: { metal: MoldMetal; porQue: string[] };
  insertos: InsertSizing;
  variantes: ArchCav[];
  recomendacion: { arch: Arch; nCav: number; porQue: string[] };
  base: BaseSelection;
  cotizacion: CostBreakdown;
  costoPieza: PartCostBreakdown;
  breakEven: string[];
  diseno: DiseñoFisico;
  maquina: { nombre: string; ok: boolean; issues: string[] } | null;
  veredicto: { viable: boolean; banderas: string[]; precioMoldeUSD: number; costoPiezaUSD: number; entregaSemanas: number };
  reporte: string[];
}

/** Densidad del plástico (kg/m³) para masa/calor por ciclo. */
const PLASTIC_RHO: Record<string, number> = { ABS: 1050, PP: 905, PS: 1040, PC: 1200, PE: 950, PA: 1140, POM: 1410 };
/** T de no-flujo (°C) — Apéndice A, mismos valores que FEED_MATERIALS en feed.ts. */
const PLASTIC_TNOFLOW: Record<string, number> = { ABS: 132, PP: 176 };
/** γ̇ máx y difusividad — Apéndice A (mismos valores que FEED_MATERIALS). */
const PLASTIC_SHEARMAX: Record<string, number> = { ABS: 50000, PP: 100000 };
const PLASTIC_ALPHA: Record<string, number> = { ABS: 8.73e-8, PP: 8.15e-8 };
const PLASTIC_CP: Record<string, number> = { ABS: 2000, PP: 2100, PS: 1900, PC: 1250, PE: 2300, PA: 1700, POM: 1500 };

const FINISH_MAP: Record<string, { spi: 'texture' | 'SPI A-1' | 'SPI A-3' | 'SPI B-3' }['spi']> = {
  texture: 'SPI B-3', 'SPI B-3': 'SPI B-3', 'SPI A-3': 'SPI A-3', 'SPI A-1': 'SPI A-1',
};
// arquitectura → factores de customización §3.3 + parámetros §3.4
const ARCH_CUSTOM: Record<Arch, { feed: string; feedWaste: 'cold' | 'hot-long'; hotRunner: boolean }> = {
  'cold-2placas': { feed: 'cold-2placas', feedWaste: 'cold', hotRunner: false },
  'cold-3placas': { feed: 'cold-3placas', feedWaste: 'cold', hotRunner: false },
  'hot-runner': { feed: 'hot-thermal', feedWaste: 'hot-long', hotRunner: true },
};

/**
 * Factor presión MEDIA de cavidad / presión PICO de inyección. El clamp lo da la
 * presión media sobre el área proyectada, que es ~½ del pico en la compuerta por
 * el gradiente gate→frente de flujo (perfil ~triangular). Con esto el bezel da
 * ~194 t, en el rango del libro (cap 11: 143 t; cap 12 usa 200 t).
 */
const CAVITY_PRESSURE_FACTOR = 0.5;

/* ═══════════════════════════════════════════════════════════════════════════════
 * LAS DOS PRESIONES CON NOMBRE (orden 2026-10-24-b · juez C, disputa D2 · decisión que ian
 * delegó a los expertos el 2026-10-24)
 * ═══════════════════════════════════════════════════════════════════════════════
 * Hasta hoy el molde entero se dimensionaba con UNA presión: la de LLENADO estimada con la
 * longitud de flujo ≈ largo de la pieza, sin piso. MEDIDO en la 1594C Box (node, pared 3.2):
 * p_fill 8.6 MPa → cavidad ½·8.6 = 4.3 MPa → cierre 3.1 t → la hoja decía «clamp 2.3 % de 150 t»
 * y la placa de soporte se calculaba para 4.3 MPa (22 mm + 1 pilar). El propio contrato
 * `llenado-tonelaje` cita §5.5.3: *"molders will generally use packing pressures in the vicinity
 * of 50 MPa"* — y solo ADVERTÍA. Con ese mismo cierre de 3 t salía ✗ FUERZA (F_eject / clamp).
 *
 *   · p_pack — presión de EMPAQUE/sostenimiento en la cavidad. ENTRADA del intake, 50 MPa por
 *     defecto (§5.5.3), editable. Cierra el molde junto con la de llenado: Eq 5.29 sobre el área
 *     proyectada con la MAYOR de las dos (§5.5.3: «el tonelaje se calcula en llenado Y en empaque,
 *     gana el mayor»). De ese cierre salen la placa de soporte, los pilares y la expulsión.
 *   · p_fill — presión de LLENADO. El `pMaxMPa` del solver FAN de la E5 cuando el que llama lo
 *     trae (`spec.fillMPaFan`); si no, la estimada aquí (longitud de flujo ≈ largo), y se DICE.
 *     Juzga el presupuesto de la colada (§6.2.2), el techo de llenado (§5.1) y la presión de la
 *     inyectora (§4.3.3).
 * ═══════════════════════════════════════════════════════════════════════════════ */
/** p_pack por defecto (MPa) — Kazmer §5.5.3 literal: "in the vicinity of 50 MPa". Editable en el intake. */
export const P_PACK_DEFECTO_MPA = 50;

export interface PresionesDelMolde {
  /** p_fill (MPa) — la presión de LLENADO que juzga colada, techo y máquina */
  fillMPa: number;
  fillFuente: 'FAN E5' | 'estimada';
  /** el rótulo para pantalla: de dónde salió p_fill */
  fillRotulo: string;
  /** presión MEDIA de cavidad durante el llenado = ½·p_fill (perfil triangular, ver CAVITY_PRESSURE_FACTOR) */
  cavityMPa: number;
  /** p_pack (MPa) — declarada en el intake o la de §5.5.3 */
  packMPa: number;
  packFuente: 'declarada' | 'por defecto §5.5.3';
  /** la presión de cavidad que CIERRA el molde = max(½·p_fill, p_pack) — Eq 5.29 / §5.5.3 */
  clampMPa: number;
  /** qué fase manda el cierre */
  manda: 'empaque' | 'llenado';
  vTrace: ReturnType<typeof convergeVelocityTraced>;
}

/** Las dos presiones de una pieza (puro). UNA función: la usan el cierre de cada variante y el diseño físico. */
export function presionesDelMolde(spec: MachineSpec, melt: MeltMaterial): PresionesDelMolde {
  const wallM = spec.wallMm / 1000, flowM = spec.Lmm / 1000;   // longitud de flujo ≈ largo (aprox)
  const vTrace = convergeVelocityTraced(melt, wallM);
  const fan = Number.isFinite(spec.fillMPaFan) && (spec.fillMPaFan as number) > 0 ? (spec.fillMPaFan as number) : null;
  const fillMPa = fan ?? pressureDropSegment(melt, flowM, wallM, vTrace.v) / 1e6;
  const declarada = Number.isFinite(spec.packMPa) && (spec.packMPa as number) >= 0;
  const packMPa = declarada ? (spec.packMPa as number) : P_PACK_DEFECTO_MPA;
  const cavityMPa = fillMPa * CAVITY_PRESSURE_FACTOR;
  const clampMPa = Math.max(cavityMPa, packMPa);
  return {
    fillMPa, fillFuente: fan != null ? 'FAN E5' : 'estimada',
    fillRotulo: fan != null ? 'medida por el solver de llenado (FAN, E5)' : 'estimada (longitud de flujo ≈ largo)',
    cavityMPa, packMPa, packFuente: declarada ? 'declarada' : 'por defecto §5.5.3',
    clampMPa, manda: packMPa >= cavityMPa ? 'empaque' : 'llenado', vTrace,
  };
}

/** Presión de llenado + clamp por cavidad (filling.ts, puro). El cierre va con la MAYOR de
 *  ½·p_fill y p_pack (Eq 5.29, §5.5.3) — antes solo con la de llenado, sin piso. */
function clampFor(spec: MachineSpec, melt: MeltMaterial, nCav: number): { dPMPa: number; clampTons: number } {
  const pr = presionesDelMolde(spec, melt);
  const projAreaM2 = nCav * areaProyectadaMm2(spec) * 1e-6;
  const clamp = clampMetricTons(pr.clampMPa * 1e6, projAreaM2);
  return { dPMPa: pr.fillMPa, clampTons: clamp };
}

/** EL ÁREA PROYECTADA de UNA cavidad (mm²) con la que se cierra el molde (Eq 5.29) — orden H, cambio 5. La real del raster
 *  (`projectedAreaMm2`, dfm-mesh) cuando la hay; si no, L×W y se dice. ANTES el cierre usaba L×W siempre mientras el contrato
 *  `llenado-area-proyectada` imprimía «descuento ya aplicado ✓»: en la 1594C Box 7,021 contra 7,029 mm² (0.1 %); en una pieza
 *  con ventanas el cierre sobreestimaba sin decirlo (§3.4.3: «the true required clamp tonnage is likely less»). UNA función:
 *  la usan el cierre de cada variante y la máquina. */
export function areaProyectadaMm2(spec: MachineSpec): number {
  return spec.projectedAreaMm2 != null && spec.projectedAreaMm2 > 0 ? spec.projectedAreaMm2 : spec.Lmm * spec.Wmm;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * EL BEBEDERO QUE SE CORTA (orden H · un veredicto, cambio 3)
 * ═══════════════════════════════════════════════════════════════════════════════
 * El paquete numérico DISEÑA un bebedero (`designFeedSystem`: el ⌀ por el ΔP asignado de §6.4.5, largo = placa A + clamp de
 * 1") y la E5 CORTA otro (`datumsColada`: largo del stack real, ⌀ por Eq 6.8 con el taper de extracción). El dictamen juzgaba
 * el primero y el acero llevaba el segundo. Con `spec.bebederoCortado` la alimentación se JUZGA sobre el cono de la E5 con las
 * MISMAS ecuaciones del feed (Eq 6.5 ΔP power-law con el radio medio, Eq 9.6 para su t_c, Eq 6.4 γ̇ en la entrada, Eq 6.2 Re,
 * cono truncado para el volumen) — no se rediseña: el lazo §6.4.7 ya no corre porque el acero ya se cortó; si con él chocan
 * presión y ciclo, el conflicto se REPORTA (§1.2, lo arbitra el humano). */
function alimentacionDelBebederoCortado(base: FeedSystemDesign, b: NonNullable<MachineSpec['bebederoCortado']>, material: string, nCav: number, partCc: number): FeedSystemDesign {
  const m = FEED_MATERIALS[material] ?? FEED_MATERIALS.ABS;
  const mm = m as unknown as MeltMaterial;
  // EL CAUDAL es el de la PIEZA (V/t_llenado, el MISMO del feed diseñado, de la compuerta y de la columna ①): de la E5 se toma la
  // GEOMETRÍA que cortó, no el caudal con que la dimensionó. MEDIDO en la app (1594C Box): la E5 dimensionó con el volumen de su
  // rejilla de la E4, y con ESE caudal la caída salía 3.3 MPa contra 10.8 con el de la pieza — el ✓ habría sido del caudal, no
  // del bebedero. Si los dos difieren más de 25 % se DICE (el ⌀ de la E5 pudo salir chico; en la Box lo gobierna el taper).
  const Vdot = (base.VdotCcS as number) * 1e-6;
  const vE5 = b.VdotCcS;
  const avisoCaudal = vE5 != null && Math.abs(vE5 - base.VdotCcS) > 0.25 * base.VdotCcS
    ? ` · ⚠ la E5 lo dimensionó con ${vE5.toFixed(1)} cc/s contra ${base.VdotCcS.toFixed(1)} cc/s de la pieza (el volumen de su rejilla): su ⌀ de diseño pudo salir chico`
    : '';
  const L = b.largoMm / 1000, rTop = b.diaTopMm / 2000, rBase = b.diaBaseMm / 2000, rMean = (rTop + rBase) / 2;
  const dPMPa = pressureDropRunner(mm, { name: 'sprue', L, R: rMean, Vdot }) / 1e6;
  const tcSprueS = runnerCoolingTimeS(m.alpha, 2 * rBase, m.tMelt, m.tCool, m.tEject);
  const volCc = ((Math.PI * L) / 3) * (rTop * rTop + rTop * rBase + rBase * rBase) * 1e6;
  const shear = shearRateRunner(Vdot, rTop);
  const re = reynolds(m.rhoMeltKgM3, Vdot, 100, 2 * rMean);
  const pctRegrind = (volCc / (partCc * nCav)) * 100;
  const dpMal = dPMPa > base.limDPMPa, cicloMal = tcSprueS > base.tcPartS;
  const conflicto = dpMal && cicloMal
    ? `§6.4.7 (ciclo) CHOCA con §6.2.2 (presión) en el bebedero que CORTA la E5 (⌀${b.diaTopMm.toFixed(2)}→⌀${b.diaBaseMm.toFixed(2)} · L ${b.largoMm.toFixed(1)}): `
      + `cuesta ΔP ${dPMPa.toFixed(1)} > ${base.limDPMPa.toFixed(2)} MPa Y su colada tarda ${tcSprueS.toFixed(1)} s > ${base.tcPartS.toFixed(1)} s de la pared. `
      + `Engrosarlo baja la presión y alarga el ciclo; adelgazarlo hace lo contrario (p.149: «can be reduced albeit with a higher pressure drop»). Lo arbitra el humano §1.2`
    : null;
  const notas: string[] = [];
  if (dpMal) notas.push(`ΔP ${dPMPa.toFixed(1)} > ${base.limDPMPa.toFixed(1)} MPa §6.2.2`);
  if (pctRegrind > base.limPct) notas.push(`volumen ${pctRegrind.toFixed(1)} % > ${base.limPct} % §6.2.3`);
  if (cicloMal) notas.push('la colada domina el ciclo §6.4.7');
  if (shear > base.shearMax) notas.push(`γ̇ ${Math.round(shear)} > ${base.shearMax} 1/s §7.1.4`);
  return {
    ...base,
    diaBaseMm: b.diaBaseMm, diaTopMm: b.diaTopMm, sprueLenMm: b.largoMm,
    dPMPa, volCc, pctRegrind, tcSprueS, shear, re, VdotCcS: Vdot * 1e6,
    iteraciones: [{ paso: 1, diaBaseMm: b.diaBaseMm, dPMPa, tcSprueS,
      accion: `el bebedero que CORTA la E5 (colada.ts, ${b.modo}): se JUZGA, no se rediseña — ⌀${b.diaTopMm.toFixed(2)}→⌀${b.diaBaseMm.toFixed(2)} × L ${b.largoMm.toFixed(1)} mm a ${(Vdot * 1e6).toFixed(1)} cc/s`
        + (b.modo === 'sprue-directo' ? '' : ' (el runner y la compuerta de la E5 no entran en esta caída: sólo el bebedero)') + avisoCaudal }],
    conflicto, notas, ok: notas.length === 0 && !conflicto,
  };
}

/** LA COMPUERTA DEL SPRUE DIRECTO (§7.2.1, orden H): «the sprue gate itself is the interface… it has no length, there is no
 *  pressure drop». En el molde que corta la E5 la compuerta es la BASE del bebedero (⌀ = 2·rBase), no el edge gate de la
 *  pared que el paquete suponía por arquitectura (en la 1594C Box: edge 3.2 mm, freeze 8.33 s). Su freeze es el de un
 *  cilindro (Tabla 7.4, `gateFreezeCylS`) — el MISMO número que imprime la E6 («⌀8.62 → empaca 19.99 s»). */
function compuertaDelBebederoCortado(base: GateProcessDesign, b: NonNullable<MachineSpec['bebederoCortado']>, VdotM3s: number, alphaM2s: number, melt: MeltMaterial, tNoFlowC: number): GateProcessDesign {
  const dM = b.diaBaseMm / 1000;
  const freezeS = gateFreezeCylS(alphaM2s, dM, melt.tMelt, melt.tWall, tNoFlowC);
  const shear = shearRateRunner(VdotM3s, dM / 2);
  const freezeCorto = freezeS < base.tPackNeededS;
  return {
    ...base, type: 'sprue', agrandable: false,
    thicknessMm: +b.diaBaseMm.toFixed(3), widthMm: null, thicknessSteelSafeMm: +b.diaBaseMm.toFixed(2),
    shear, dPMPa: 0, freezeS, freezeCorto, dpVeredicto: '§7.2.1: la compuerta del sprue directo no tiene largo — sin caída propia',
    escalaTipo: null,
    iteraciones: [
      { paso: 1, que: 'tipo sprue (directo)', accion: `§7.2.1 la base del bebedero de la E5 (⌀${b.diaBaseMm.toFixed(2)}) ES la compuerta: «directly abuts» la base cerrada de la pieza` },
      { paso: 5, que: `freeze ${freezeS.toFixed(2)} s vs empaque necesario ${base.tPackNeededS.toFixed(2)} s`,
        accion: freezeCorto ? '§7.1.5 la base del bebedero congela ANTES de terminar el empaque' : '§7.3.4 la base del bebedero aguanta el empaque ✓' },
    ],
    ok: shear <= base.shearMax && !freezeCorto,
  };
}
export function moldMachine(spec: MachineSpec): MoldPackage {
  const melt = ABS_MG47;
  const plastic = spec.plastic ?? 'ABS';
  const machRate = spec.machiningRateUSDh ?? 100;             // EE.UU. por defecto (Apéndice D ×3)
  const spi = FINISH_MAP[spec.finish ?? 'SPI B-3'];

  // ── PUERTA 0: DFM (¿moldeable?) ──
  const dfm = checkDFM({ nominalWallMm: spec.wallMm, surface: { roughnessUm: 12 }, ...(spec.dfm ?? {}) });

  // ── acero + insertos (Kazmer cap 4) ──
  const metal = selectMetal({
    produccionAnual: spec.annualVolume, resinaAbrasiva: spec.abrasive, resinaCorrosiva: spec.corrosive,
    pulidoEspejo: spec.mirror, prototipo: spec.annualVolume < 5000,
  });
  const insertos = sizeInserts({ Lmm: spec.Lmm, Wmm: spec.Wmm, depthMm: spec.Hmm });

  // ── OPTIMIZACIÓN arch × cavidades por COSTO TOTAL @ volumen ──
  const complexity = (spec.surfaceMm2 * spec.wallMm) / spec.volumeMm3;
  const machiningFactor = complexity > 2.5 ? MACHINING_FACTOR.edm : complexity > 1.5 ? 2 : MACHINING_FACTOR.fresado;
  const totalQty = spec.totalVolume ?? spec.annualVolume;
  // el cliente puede EXIGIR la alimentación (colada caliente por calidad); si no,
  // se optimiza sobre las tres arquitecturas por costo total.
  const archs: Arch[] = spec.feedPref ? [spec.feedPref] : ['cold-2placas', 'cold-3placas', 'hot-runner'];
  // Igual que feedPref: si el cliente IMPONE la cavitación (§2.2.2 Tabla 2.3), la
  // optimización se restringe a ella; si no, se barre el catálogo.
  const cavs = spec.cavPref ? [spec.cavPref] : [1, 2, 4, 8, 16];
  const HORAS_ANO = 6000;                                     // molder típico 2-3 turnos
  const todas: ArchCav[] = [];
  for (const arch of archs) for (const nCav of cavs) {
    const ac = ARCH_CUSTOM[arch];
    // el cierre con el piso de empaque (orden 2026-10-24-b) ALIMENTA también la tarifa de máquina de Eq 3.24
    // (UN tonelaje). MEDIDO: a 3.1 t la fórmula extrapolaba (47 + 0.073·T − 4.7·ln T sube cuando T → 0: 41.9 $/h,
    // más cara que una de 50 t); a 35.8 t da 32.8 $/h → 1594C Box $1.009 → $0.903/pza, cubo $0.436 → $0.391/pza.
    const { clampTons } = clampFor(spec, melt, nCav);
    const cost = estimateMoldCost(buildCostInputs(spec, metal.metal.key, nCav, machiningFactor, machRate, spi, arch));
    const part = estimatePartCost(cost.totalUSD, totalQty, {
      VpartMm3: spec.volumeMm3, plastic: plastic as any, feedWaste: ac.feedWaste,
      nCavities: nCav, clampTons, wallMm: spec.wallMm, cycleMode: 'automatico', hotRunner: ac.hotRunner,
    });
    todas.push({ arch, nCav, factible: false, clampTons, moldUSD: cost.totalUSD, partUSD: part.partUSD, totalUSD: cost.totalUSD + totalQty * part.partUSD, cost, part });
  }
  // RESTRICCIÓN DE THROUGHPUT (§3.4): con ciclo t, 1 cavidad hace HORAS_ANO·3600/t
  // piezas/año — el molde DEBE tener suficientes cavidades para el volumen anual.
  const nMin = (v: ArchCav) => Math.ceil((spec.annualVolume * v.part.cycleTimeS) / (HORAS_ANO * 3600));
  for (const v of todas) v.factible = v.nCav >= nMin(v);
  const variantes = todas.slice().sort((a, b) => a.totalUSD - b.totalUSD);   // las 15, por costo
  const factibles = variantes.filter((v) => v.factible);
  const win = factibles[0] ?? variantes[variantes.length - 1];  // mejor factible, o la de más cav
  const throughputForzado = !factibles.length;               // ni 16 cav alcanzan → bandera

  // ── mold base estándar de la ganadora ──
  const nSide = Math.max(1, Math.round(Math.sqrt(win.nCav)));
  const base = selectMoldBase(insertos, { nx: nSide, ny: Math.ceil(win.nCav / nSide) });

  // ── DISEÑO FÍSICO: el molde como sistema de ecuaciones acopladas, resuelto de
  //    punta a punta sobre la ganadora (enfriamiento → expulsión → placas → máquina) ──
  const diseno = physicalDesign(spec, win, base, insertos, melt, plastic);
  const sel = diseno.maquina.seleccion;
  const maq = { nombre: sel.machine?.name ?? '—', ok: sel.ok, issues: sel.issues };

  // ── break-even: por qué NO otra arquitectura ──
  const alt = variantes.find((v) => v.arch !== win.arch) ?? variantes[1];
  const be = breakEvenReport(win, alt, totalQty);

  // ── VEREDICTO ──
  const banderas: string[] = [];
  if (dfm.errors > 0) banderas.push(`DFM: ${dfm.errors} error(es) de diseño de pieza — corregir antes de cortar acero`);
  if (win.cost.cavity.complexity > 3) banderas.push(`pieza muy compleja (${win.cost.cavity.complexity.toFixed(1)}): maquinado por EDM domina el costo`);
  if (throughputForzado) banderas.push(`el volumen anual exige >16 cavidades (ciclo ${win.part.cycleTimeS.toFixed(0)}s) — considerar 2 moldes o ciclo más corto`);
  // ⚠ EL VEREDICTO NO MIRABA LA MÁQUINA (2026-08-07) — el bug de contabilidad otra vez:
  // `selectInjectionMachine` calcula las cinco restricciones de §4.3.3 con su cita y las
  // deja EXACTAS en `issues`, y `viable` solo miraba DFM y costo. Medido con una cubeta
  // 300×300×250: el molde NO ABRE (stack 570 + carrera 625 = 1195 > 950 de daylight),
  // pide 1130 t en una máquina de 500, y el disparo es 518 % del barril — y salía
  // `viable: true`, cotizado en $3 M, bajo una bandera que solo decía "verificar".
  // `sel.ok` es la señal correcta: solo es true si pasan las cinco restricciones DURAS;
  // las advertencias blandas (shot <25 %, risers) viven en el otro brazo y no lo apagan.
  if (!maq?.ok) banderas.push(`NINGUNA inyectora del catálogo admite este molde (§4.3.3): ${maq.issues.join(' · ')}`);
  const margin = spec.margin ?? 1.6;
  const precioMolde = Math.round(win.cost.totalUSD * margin);
  const entregaSemanas = Math.ceil(win.cost.cavity.tMachiningH / 40) + (win.arch === 'hot-runner' ? 4 : 2) + 2;
  const viable = dfm.errors === 0 && Number.isFinite(win.cost.totalUSD) && win.cost.totalUSD > 0 && !!maq?.ok;

  const reporte = buildReport(spec, dfm, metal, win, base, maq, precioMolde, entregaSemanas, be, complexity, machiningFactor, diseno);

  return {
    spec, dfm, metal, insertos, variantes,
    recomendacion: { arch: win.arch, nCav: win.nCav, porQue: [
      `mínimo costo TOTAL @ ${totalQty.toLocaleString()} pzas: molde $${Math.round(win.cost.totalUSD).toLocaleString()} + $${win.partUSD.toFixed(3)}/pza`,
      `${win.arch === 'hot-runner' ? 'hot runner amortiza el molde caro con material/ciclo bajos a alto volumen' : 'cold runner: molde barato gana cuando el volumen no paga la colada caliente'}`,
    ] },
    base, cotizacion: win.cost, costoPieza: win.part, breakEven: be, diseno, maquina: maq,
    veredicto: { viable, banderas, precioMoldeUSD: precioMolde, costoPiezaUSD: win.partUSD, entregaSemanas },
    reporte,
  };
}

/**
 * RESUELVE el diseño físico de punta a punta sobre la ganadora: enfriamiento (Q →
 * caudal → plug comercial), expulsión (vector con peso/gravedad + pines),
 * placas (soporte por deflexión + pilares óptimos + cavidad) y máquina
 * (cierre+shot+presión+expulsión → inyectora). Cada ecuación aterriza en un
 * componente de catálogo. PURO.
 */
function physicalDesign(spec: MachineSpec, win: ArchCav, base: BaseSelection, insertos: InsertSizing, melt: MeltMaterial, plastic: string): DiseñoFisico {
  const nCav = win.nCav;
  const wallM = spec.wallMm / 1000;
  // LAS DOS PRESIONES (orden 2026-10-24-b): la MISMA función que cerró cada variante (`clampFor`).
  const pr = presionesDelMolde(spec, melt);
  const vTrace = pr.vTrace;
  const v = vTrace.v;
  const fillMPa = pr.fillMPa, cavityMPa = pr.cavityMPa;  // media ≈ ½ del pico

  // ── ALIMENTACIÓN (§6.4, LAZO): ΔP asignado → ⌀; si la colada domina el ciclo,
  //    regresar y bajar el ⌀ (§6.4.7). El conflicto §6.4.7↔§6.2.2 se REPORTA, no
  //    se resuelve en silencio (§1.2: la importancia relativa la juzga el humano). ──
  const partCcReal = estPartVolumeCc({
    shape: spec.cavityShape, widthMm: spec.Wmm, lenMm: spec.Lmm,
    depthMm: spec.Hmm, wallMm: spec.wallMm,
  });
  // el sprue va de la cara de la boquilla al plano de partición: clamp + placa A
  const sprueLenMm = base.plateAmm + 25.4;                       // 25.4 = clamp de 1", estándar de las bases
  const feedDiseñado = designFeedSystem({
    material: plastic === 'ABS' ? 'ABS' : 'PP', partVolumeCc: partCcReal,
    partWallMm: spec.wallMm, sprueLenMm, nCav, fillMPa,
    hotRunner: win.arch === 'hot-runner',
  });
  // UN BEBEDERO (orden H): con el molde hecho, el que se juzga es el que la E5 CORTA (límite de ΔP y t_c de la pared, del
  // diseñado: la misma p_fill y la misma pared). En colada caliente no hay bebedero frío que juzgar: se queda el diseñado.
  const alimentacion = spec.bebederoCortado && win.arch !== 'hot-runner'
    ? alimentacionDelBebederoCortado(feedDiseñado, spec.bebederoCortado, plastic === 'ABS' ? 'ABS' : 'PP', nCav, partCcReal)
    : feedDiseñado;

  // ── VENTEO (cap 8): el aire desplazado ≈ el volumen inyectado (§8.2.1) y cada
  //    venteo se dimensiona para TODO el flujo local, no para el flujo dividido
  //    entre venteos (§8.2.3: dividir NO es conservador). ──
  const venteo = ventDesign({
    VdotAirM3s: (partCcReal * 1e-6) / 1,                          // t_llenado = 1 s, convención del libro
    lM: 0.01, wM: 0.01, lFlashM: 0.2e-3,
  });

  // ── CONTRACCIÓN (§10.1.6): rango, no número. Y la alarma que un optimizador
  //    rompería por diseño: s ≤ 0 no es precisión, es una pieza que no expulsa. ──
  const contraccion = shrinkageRecommendation({
    // el NOMINAL a p_pack (la MISMA presión que cierra el molde, juez C D2); el rango, literal de §10.1.6
    tait: ABS_TAIT, fillMPa, packMPa: pr.packMPa,
    tNoFlowC: PLASTIC_TNOFLOW[plastic] ?? 132,
    tMeltC: melt.tMelt,
  });

  // ── GATE (§7.3, proceso de 5 pasos): el tipo lo sugiere la arquitectura
  //    (2 placas → edge manual · 3 placas → pin-point · caliente → thermal-sprue),
  //    y el lazo ajusta dimensiones. El freeze puede reprobar lo que ya pasó
  //    corte y presión (§7.1.5), y el ajuste puede escalar al TIPO DE MOLDE. ──
  const GATE_POR_ARCH: Record<Arch, GateType> = {
    'cold-2placas': 'edge', 'cold-3placas': 'pin-point', 'hot-runner': 'thermal-sprue',
  };
  const gateSupuesto = designGateProcess({
    type: GATE_POR_ARCH[win.arch], wallMm: spec.wallMm,
    VdotM3s: (partCcReal * 1e-6) / 1, shearMaxS: PLASTIC_SHEARMAX[plastic] ?? 50000,
    melt, alphaM2s: PLASTIC_ALPHA[plastic] ?? 8.73e-8,
    tMeltC: melt.tMelt, tCoolC: melt.tWall, tNoFlowC: PLASTIC_TNOFLOW[plastic] ?? 132,
    tPackNeededS: alimentacion.tcPartS,   // Eq 9.5 de la pared, ya calculada por el feed: UNA fuente
  });
  // la compuerta del molde que SÍ se corta (orden H): en sprue directo es la base del bebedero de la E5 (§7.2.1)
  const gate = spec.bebederoCortado?.modo === 'sprue-directo' && win.arch !== 'hot-runner'
    ? compuertaDelBebederoCortado(gateSupuesto, spec.bebederoCortado, (alimentacion.VdotCcS as number) * 1e-6,
      PLASTIC_ALPHA[plastic] ?? 8.73e-8, melt, PLASTIC_TNOFLOW[plastic] ?? 132)
    : gateSupuesto;

  // ── ENFRIAMIENTO: calor por ciclo → caudal → Ø turbulento → plug DME ──
  const rho = PLASTIC_RHO[plastic] ?? 1050, cp = PLASTIC_CP[plastic] ?? 2000;
  const massKg = spec.volumeMm3 * 1e-9 * rho;                   // masa por cavidad
  const qCavJ = heatToRemove(massKg, cp, ABS_KAZMER);           // J por cavidad por ciclo
  const cicloS = win.part.cycleTimeS;
  const qTotalW = (qCavJ * nCav) / cicloS;                      // W a disipar (todas las cavidades)
  const lineLenM = 2 * (base.base.wmm + base.base.lmm) / 1000;  // circuito perimetral aprox
  const lineas = designCoolingLines({ qTotalW, nLines: Math.max(1, nCav), lineLenM, dTallowC: 1, dPmaxPa: 100e3 });

  // ── EXPULSIÓN: vector con peso real + dimensionado de pines ──
  const aEffM2 = effectiveArea({ h: wallM, L: spec.Lmm / 1000, W: spec.Wmm / 1000 });
  const draft = Math.max(1, spec.dfm?.draftDeg ?? 1);
  const vector = ejectionVector(ABS_EJECT, { aEffM2, draftDeg: draft, massKg: massKg * nCav });
  const pines = ejectorPinSizing(ABS_EJECT, vector.fEjectN, Math.max(4, 4 * nCav), wallM);

  // ── PLACAS: soporte por deflexión (+pilares óptimos) + cavidad por enfriamiento ──
  const spanM = (Math.min(base.base.wmm, base.base.lmm) / 1000) * 0.6;   // claro entre rieles
  const widthM = Math.max(base.base.wmm, base.base.lmm) / 1000;
  // El venteo contra el que se dimensiona la placa es EL MISMO que juzga el contrato estructural
  // (`venteoDeReferenciaMm`: la más estricta entre la práctica 0.02 de la partición y el venteo de
  // la E7) — antes aquí caía el default 0.02 y el contrato miraba el de la E7: dos verdades. Con la
  // flecha objetivo al 70 % (regla de Hefestos, dentro de `sizeSupportPlate`).
  // LA CARGA (orden 2026-10-24-b): `win.clampTons` ya es max(½·p_fill, p_pack)·A_proy (Eq 5.29). Antes
  // era ½·p_fill a secas: la 1594C Box se dimensionaba para 4.3 MPa (3.1 t) y salía 22 mm + 1 pilar; a los
  // 50 MPa de §5.5.3 esa misma placa de 36 sin pilares se dobla 0.120 mm = 6 venteos de 0.02.
  const soporte = optimizeSupportPlate({ clampTons: win.clampTons, spanM, widthM, maxPillars: 4, ventGapM: venteoDeReferenciaMm(venteo.hSpecMm) * 1e-3 });
  // §4.2.1: la placa cavidad = prof + 3·⌀ de la línea REAL. DEBE usar el ⌀ de `lineas`
  // (designCoolingLines, física §9.2.4) — NO el estimado preliminar de sizeInserts, o la
  // placa queda demasiado fina para la línea real → el lado A NO cabe y solo enfría B.
  const realCoolDiaMm = lineas.plug?.diaMm ?? lineas.dMinMm ?? insertos.coolingDiaMm;
  const cavidad = sizeCavityPlate({ cavityDepthMm: spec.Hmm, lineDiaMm: realCoolDiaMm });
  // Placa B (retenedora del NÚCLEO) desde SU inserto (§4.2.1), NO copiada de la cavidad. El
  // macho sobresale a la cavidad → prof bajo-partición ≈ 0 → placa B ≈ 3·⌀ de la línea.
  const nucleo = sizeCorePlate({ lineDiaMm: realCoolDiaMm });

  // ── MÁQUINA: cuatro restricciones → inyectora comercial ──
  const projAreaM2 = nCav * areaProyectadaMm2(spec) * 1e-6;     // la MISMA área que cerró cada variante (orden H, cambio 5)
  const partCc = spec.volumeMm3 * 1e-3;
  const requerimientos = machineRequirements({
    // el cierre de la máquina con la MISMA presión que la estructura: max(½·p_fill, p_pack), Eq 5.29.
    // Antes iba ½·p_fill a secas (4.3 MPa en la 1594C Box → «2.3 % de 150 t»).
    projectedAreaM2: projAreaM2, cavityPressureMPa: pr.clampMPa,
    // volumen REAL de la colada (§6.2.3), no la proporción fabricada partCc×0.25
    partVolumeCc: partCc, nCav, runnerVolumeCc: alimentacion.volCc,
    fillPressureMPa: fillMPa, ejectionForceN: vector.fEjectN,
  });
  // altura de cierre = placas A+B + soporte + (2 placas de sujeción ~60 + housing
  //  del expulsor ~140): estimado realista de shut height del stack del mold base
  // ⚠ 2026-09-21: la caja expulsora ya NO es 66 fijo (`sizeEjectorHousing`, §4.3.2), así que
  // estos 200 dejaron de ser un techo garantizado — con una pieza muy honda (caja ≥ 130) el
  // estimado se queda CORTO y el daylight se juzgaría optimista. Hoy la geometría real da
  // 2×36 + caja ≤ 178 en las 4 piezas del plan, así que sigue conservador; y el semáforo
  // `daylight` de estudio-molde-datos ya IMPRIME la diferencia contra el stack geométrico
  // ("el juicio es CONSERVADOR/OPTIMISTA por N mm"). La verdad única del stack es otra orden.
  const stackMm = base.plateAmm + base.plateBmm + (soporte.best.plateThkMm ?? 60) + 200;
  // la máquina no solo tiene que CERRARLO: tiene que ABRIRLO lo suficiente para sacar la
  // pieza Y SU COLADA (§6.3.2 · Tabla 6.1: 264 + 75 = 339). Hasta 2026-09-21 aquí iba
  // `moldOpeningStrokeMm(spec.Hmm)` = 2.5·H a secas, que solo cuenta la pieza: el mismo §
  // pide además que la carrera alcance para *"the removal of the feed system"*, y en las
  // 4 piezas del plan de inspección el bebedero medía 58-87 mm (más que la pieza entera).
  // `sprueLenMm` va de la cara de la boquilla al plano de partición y la pieza ocupa H de
  // ese tramo ⇒ lo que sobresale SOBRE la pieza es `sprueLenMm − H`.
  const openStrokeMm = carreraDeApertura({
    alturaPiezaMm: spec.Hmm,
    coladaMm: win.arch === 'hot-runner' ? 0 : Math.max(0, sprueLenMm - spec.Hmm),
  }).mm;
  const seleccion = selectInjectionMachine(requerimientos, { wmm: base.base.wmm, lmm: base.base.lmm, stackMm, openStrokeMm });

  return {
    fillMPa: +fillMPa.toFixed(1), cavityMPa: +cavityMPa.toFixed(1),
    fillFuente: pr.fillFuente, fillRotulo: pr.fillRotulo,
    packMPa: +pr.packMPa.toFixed(1), packFuente: pr.packFuente,
    clampMPa: +pr.clampMPa.toFixed(1), clampManda: pr.manda,
    velocidad: { vMs: v, escalera: vTrace.escalera, convergio: vTrace.convergio, vueltas: vTrace.vueltas },
    alimentacion, venteo, contraccion, gate,
    enfriamiento: { qCavidadJ: +qCavJ.toFixed(0), qTotalW: +qTotalW.toFixed(0), cicloS: +cicloS.toFixed(1), lineas },
    expulsion: { aEffM2, vector, pines },
    placas: { soporte: soporte.best, soporteOpciones: soporte.options, cavidad, nucleo },
    maquina: { requerimientos, seleccion },
  };
}

function buildCostInputs(spec: MachineSpec, metalKey: string, nCav: number, machiningFactor: number, machRate: number, spi: 'texture' | 'SPI A-1' | 'SPI A-3' | 'SPI B-3', arch: Arch): CostInputs {
  const custom: CostInputs['custom'] = {
    feed: [ARCH_CUSTOM[arch].feed as any],
    cooling: ['circuito'], ejector: (spec.undercuts?.length ? ['mixto', 'slide-externo'] : ['mixto']) as any,
    structural: ['pilares-interlocks'], misc: ['sensor-presion'],
  };
  return {
    part: { LpartMm: spec.Lmm, WpartMm: spec.Wmm, HpartMm: spec.Hmm, ApartSurfaceMm2: spec.surfaceMm2, VpartMm3: spec.volumeMm3, wallMm: spec.wallMm },
    metalKey, nCavities: nCav, machiningFactor, machiningRateUSDh: machRate,
    finishAreas: [{ spi: spi === 'texture' ? 'SPI B-3' : spi, areaMm2: spec.surfaceMm2 }], finishRateUSDh: 50,
    moldSteel: 'AISI P20', custom,
  };
}

function breakEvenReport(win: ArchCav, alt: ArchCav, qty: number): string[] {
  const dFixed = alt.cost.totalUSD - win.cost.totalUSD;
  const dMarg = win.partUSD - alt.partUSD;
  const be = dMarg > 0 ? dFixed / dMarg : Infinity;
  return [
    `elegida ${win.arch}×${win.nCav} vs ${alt.arch}×${alt.nCav}`,
    Number.isFinite(be) && be > 0
      ? `cruce en ${Math.round(be).toLocaleString()} pzas — por debajo la elegida gana; el volumen dado (${qty.toLocaleString()}) confirma la decisión`
      : `la elegida domina en costo fijo Y marginal — sin cruce`,
  ];
}

function buildReport(spec: MachineSpec, dfm: DFMReport, metal: { metal: MoldMetal; porQue: string[] }, win: ArchCav, base: BaseSelection, maq: { nombre: string; ok: boolean } | null, precioMolde: number, semanas: number, be: string[], complexity: number, mf: number, d: DiseñoFisico): string[] {
  const $ = (x: number) => '$' + Math.round(x).toLocaleString('en-US');
  const c = win.cost;
  const cl = d.enfriamiento.lineas, sp = d.placas.soporte, ev = d.expulsion.vector, ms = d.maquina.seleccion;
  const kgBase = d.placas.soporteOpciones[0]?.steelMassKg ?? sp.steelMassKg;
  return [
    `╔══ COTIZACIÓN DE MOLDE · La Forja ═══════════════════════════════`,
    `║ PIEZA: ${spec.name} · ${spec.Lmm}×${spec.Wmm}×${spec.Hmm} mm · pared ${spec.wallMm} mm · ${spec.plastic ?? 'ABS'}`,
    `║ VOLUMEN: ${spec.annualVolume.toLocaleString()} pzas/año`,
    `╠── VIABILIDAD (DFM §2.3) ────────────────────────────────────────`,
    `║ DFM ${dfm.score}/100 · ${dfm.errors} error(es) · ${dfm.warns} aviso(s)`,
    ...dfm.resumen.slice(1, 4).map((s) => `║   ${s}`),
    `╠── RECOMENDACIÓN ────────────────────────────────────────────────`,
    `║ ARQUITECTURA: ${win.arch.toUpperCase()} × ${win.nCav} cavidad(es)`,
    `║ ACERO INSERTO: ${metal.metal.key} (DIN ${metal.metal.din}) — ${metal.porQue[0].slice(0, 70)}`,
    `║ MOLD BASE: ${base.base.wmm}×${base.base.lmm} mm estándar · máquina ${maq?.nombre ?? '—'}${maq?.ok ? ' ✓' : ' ⚠'}`,
    `╠── COTIZACIÓN (Kazmer §3.3) ─────────────────────────────────────`,
    `║ Insertos:       ${$(c.cavitiesUSD)}  (material ${$(c.cavity.materialUSD)} + maq ${$(c.cavity.machiningUSD)} + acabado ${$(c.cavity.finishingUSD)})`,
    `║ Mold base:      ${$(c.moldBase.USD)}  (${c.moldBase.massKg.toFixed(0)} kg)`,
    `║ Customización:  ${$(c.customization.USD)}`,
    `║ ────────────────────────────`,
    `║ COSTO DEL MOLDE: ${$(c.totalUSD)}   →   PRECIO SUGERIDO: ${$(precioMolde)}`,
    `╠── COSTO POR PIEZA (§3.4) ───────────────────────────────────────`,
    `║ molde/pza $${win.part.moldPerPart.toFixed(3)} + material $${win.part.materialPerPart.toFixed(3)} + proceso $${win.part.processPerPart.toFixed(3)} → $${win.part.partUSD.toFixed(3)}/pza (ciclo ${win.part.cycleTimeS.toFixed(1)}s)`,
    `╠── DISEÑO FÍSICO · el molde como ecuaciones resueltas ───────────`,
    `║ LLENADO: p_fill ${d.fillMPa} MPa (${d.fillRotulo}) · cavidad ${d.cavityMPa} MPa · EMPAQUE p_pack ${d.packMPa} MPa (${d.packFuente}) → cierra con ${d.clampMPa} MPa (manda el ${d.clampManda})`,
    `║ ENFRIAMIENTO: ${d.enfriamiento.qTotalW} W → ${(cl.flowM3s * 1e6).toFixed(0)} cm³/s · Ø ${cl.dMinMm.toFixed(1)}-${cl.dMaxMm.toFixed(1)} mm → plug ${cl.plug?.dme ?? '—'} (${cl.plug?.diaMm ?? '—'} mm) · Re ${cl.reAtPlug.toFixed(0)} ${cl.turbulento ? 'turbulento ✓' : '⚠ laminar'} · ${cl.controller ?? '—'}`,
    `║ EXPULSIÓN: F_eject ${ev.fEjectN.toFixed(0)} N (σ ${(ev.sigmaPa / 1e6).toFixed(1)} MPa · peso ${ev.weightN.toFixed(1)} N g=${ev.gUsed}) → ${d.expulsion.pines.dMinMm.toFixed(2)} mm/pin (cortante gobierna)`,
    `║ PLACAS: soporte ${sp.plateThkMm ?? '—'} mm ${sp.nPillars > 0 ? `+ ${sp.nPillars} pilar(es)` : 'sin pilares'} (δ ${sp.deflectionAtPlateMm} mm = ${sp.hefestos.usoPct} % del venteo ${sp.flashOk ? (sp.hefestos.estado === 'CUMPLE' ? 'ok' : `⚠ ${sp.hefestos.estado} regla de Hefestos`) : '⚠ FLASH'}, ${sp.steelMassKg} kg vs ${kgBase.toFixed(0)} sin pilares) · cavidad ${d.placas.cavidad.plateThkMm ?? '—'} mm (${d.placas.cavidad.governs})`,
    `║ MÁQUINA: ${ms.machine?.name ?? '—'} ${ms.ok ? '✓' : '⚠'} · clamp ${d.maquina.requerimientos.clampNeedTons.toFixed(0)} t (util ${ms.clampUtilPct}%) · shot ${ms.shotPct}% del barril${ms.issues.length ? ' · ' + ms.issues[0].slice(0, 40) : ''}`,
    `╠── DECISIÓN ECONÓMICA ───────────────────────────────────────────`,
    ...be.map((s) => `║ ${s}`),
    `╠── ENTREGA ──────────────────────────────────────────────────────`,
    `║ ${semanas} semanas (maquinado ${win.cost.cavity.tMachiningH.toFixed(0)}h · complejidad ${complexity.toFixed(2)} · f_maq ${mf})`,
    `╚═════════════════════════════════════════════════════════════════`,
  ];
}
