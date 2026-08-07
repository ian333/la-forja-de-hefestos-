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
import { optimizeSupportPlate, sizeCavityPlate, sizeCorePlate, type PlateSizing, type CavityPlateSizing } from './platesizing';
import { machineRequirements, selectInjectionMachine, type MachineRequirements, type MachineSelection } from './machinesizing';
import { moldOpeningStrokeMm } from './threeplate';
import { designFeedSystem, estPartVolumeCc, type FeedSystemDesign } from './feed';
import { shrinkageRecommendation, ABS_TAIT } from './shrinkage';
import { designGateProcess, type GateProcessDesign, type GateType } from './gating';
import { ventDesign } from './venting';

export type Arch = 'cold-2placas' | 'cold-3placas' | 'hot-runner';

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
  fillMPa: number; cavityMPa: number;
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

/** Presión de llenado + clamp por cavidad (filling.ts, puro). */
function clampFor(spec: MachineSpec, melt: MeltMaterial, nCav: number): { dPMPa: number; clampTons: number } {
  const wallM = spec.wallMm / 1000, flowM = spec.Lmm / 1000;   // longitud de flujo ≈ largo (aprox)
  const vTrace = convergeVelocityTraced(melt, wallM);
  const v = vTrace.v;
  const dP = pressureDropSegment(melt, flowM, wallM, v);
  const projAreaM2 = nCav * (spec.Lmm * spec.Wmm) * 1e-6;      // área proyectada = L×W por cavidad
  const clamp = clampMetricTons(dP * CAVITY_PRESSURE_FACTOR, projAreaM2);
  return { dPMPa: dP / 1e6, clampTons: clamp };
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
  const wallM = spec.wallMm / 1000, flowM = spec.Lmm / 1000;
  const vTrace = convergeVelocityTraced(melt, wallM);
  const v = vTrace.v;
  const fillPa = pressureDropSegment(melt, flowM, wallM, v);
  const fillMPa = fillPa / 1e6, cavityMPa = fillMPa * CAVITY_PRESSURE_FACTOR;  // media ≈ ½ del pico

  // ── ALIMENTACIÓN (§6.4, LAZO): ΔP asignado → ⌀; si la colada domina el ciclo,
  //    regresar y bajar el ⌀ (§6.4.7). El conflicto §6.4.7↔§6.2.2 se REPORTA, no
  //    se resuelve en silencio (§1.2: la importancia relativa la juzga el humano). ──
  const partCcReal = estPartVolumeCc({
    shape: spec.cavityShape, widthMm: spec.Wmm, lenMm: spec.Lmm,
    depthMm: spec.Hmm, wallMm: spec.wallMm,
  });
  // el sprue va de la cara de la boquilla al plano de partición: clamp + placa A
  const sprueLenMm = base.plateAmm + 25.4;                       // 25.4 = clamp de 1", estándar de las bases
  const alimentacion = designFeedSystem({
    material: plastic === 'ABS' ? 'ABS' : 'PP', partVolumeCc: partCcReal,
    partWallMm: spec.wallMm, sprueLenMm, nCav, fillMPa,
    hotRunner: win.arch === 'hot-runner',
  });

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
    tait: ABS_TAIT, fillMPa,
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
  const gate = designGateProcess({
    type: GATE_POR_ARCH[win.arch], wallMm: spec.wallMm,
    VdotM3s: (partCcReal * 1e-6) / 1, shearMaxS: PLASTIC_SHEARMAX[plastic] ?? 50000,
    melt, alphaM2s: PLASTIC_ALPHA[plastic] ?? 8.73e-8,
    tMeltC: melt.tMelt, tCoolC: melt.tWall, tNoFlowC: PLASTIC_TNOFLOW[plastic] ?? 132,
    tPackNeededS: alimentacion.tcPartS,   // Eq 9.5 de la pared, ya calculada por el feed: UNA fuente
  });

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
  const soporte = optimizeSupportPlate({ clampTons: win.clampTons, spanM, widthM, maxPillars: 4 });
  // §4.2.1: la placa cavidad = prof + 3·⌀ de la línea REAL. DEBE usar el ⌀ de `lineas`
  // (designCoolingLines, física §9.2.4) — NO el estimado preliminar de sizeInserts, o la
  // placa queda demasiado fina para la línea real → el lado A NO cabe y solo enfría B.
  const realCoolDiaMm = lineas.plug?.diaMm ?? lineas.dMinMm ?? insertos.coolingDiaMm;
  const cavidad = sizeCavityPlate({ cavityDepthMm: spec.Hmm, lineDiaMm: realCoolDiaMm });
  // Placa B (retenedora del NÚCLEO) desde SU inserto (§4.2.1), NO copiada de la cavidad. El
  // macho sobresale a la cavidad → prof bajo-partición ≈ 0 → placa B ≈ 3·⌀ de la línea.
  const nucleo = sizeCorePlate({ lineDiaMm: realCoolDiaMm });

  // ── MÁQUINA: cuatro restricciones → inyectora comercial ──
  const projAreaM2 = nCav * spec.Lmm * spec.Wmm * 1e-6;
  const partCc = spec.volumeMm3 * 1e-3;
  const requerimientos = machineRequirements({
    projectedAreaM2: projAreaM2, cavityPressureMPa: cavityMPa,
    // volumen REAL de la colada (§6.2.3), no la proporción fabricada partCc×0.25
    partVolumeCc: partCc, nCav, runnerVolumeCc: alimentacion.volCc,
    fillPressureMPa: fillMPa, ejectionForceN: vector.fEjectN,
  });
  // altura de cierre = placas A+B + soporte + (2 placas de sujeción ~60 + housing
  //  del expulsor ~140): estimado realista de shut height del stack del mold base
  const stackMm = base.plateAmm + base.plateBmm + (soporte.best.plateThkMm ?? 60) + 200;
  // la máquina no solo tiene que CERRARLO: tiene que ABRIRLO 2-3 alturas de pieza
  // para que salga del núcleo y caiga (§6.3.2 · Tabla 6.1: 264 + 75 = 339).
  const openStrokeMm = moldOpeningStrokeMm(spec.Hmm);
  const seleccion = selectInjectionMachine(requerimientos, { wmm: base.base.wmm, lmm: base.base.lmm, stackMm, openStrokeMm });

  return {
    fillMPa: +fillMPa.toFixed(1), cavityMPa: +cavityMPa.toFixed(1),
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
    `║ LLENADO: ${d.fillMPa} MPa · cavidad ${d.cavityMPa} MPa`,
    `║ ENFRIAMIENTO: ${d.enfriamiento.qTotalW} W → ${(cl.flowM3s * 1e6).toFixed(0)} cm³/s · Ø ${cl.dMinMm.toFixed(1)}-${cl.dMaxMm.toFixed(1)} mm → plug ${cl.plug?.dme ?? '—'} (${cl.plug?.diaMm ?? '—'} mm) · Re ${cl.reAtPlug.toFixed(0)} ${cl.turbulento ? 'turbulento ✓' : '⚠ laminar'} · ${cl.controller ?? '—'}`,
    `║ EXPULSIÓN: F_eject ${ev.fEjectN.toFixed(0)} N (σ ${(ev.sigmaPa / 1e6).toFixed(1)} MPa · peso ${ev.weightN.toFixed(1)} N g=${ev.gUsed}) → ${d.expulsion.pines.dMinMm.toFixed(2)} mm/pin (cortante gobierna)`,
    `║ PLACAS: soporte ${sp.plateThkMm ?? '—'} mm ${sp.nPillars > 0 ? `+ ${sp.nPillars} pilar(es)` : 'sin pilares'} (δ ${sp.deflectionAtPlateMm} mm ${sp.flashOk ? 'ok' : '⚠ FLASH'}, ${sp.steelMassKg} kg vs ${kgBase.toFixed(0)} sin pilares) · cavidad ${d.placas.cavidad.plateThkMm ?? '—'} mm (${d.placas.cavidad.governs})`,
    `║ MÁQUINA: ${ms.machine?.name ?? '—'} ${ms.ok ? '✓' : '⚠'} · clamp ${d.maquina.requerimientos.clampNeedTons.toFixed(0)} t (util ${ms.clampUtilPct}%) · shot ${ms.shotPct}% del barril${ms.issues.length ? ' · ' + ms.issues[0].slice(0, 40) : ''}`,
    `╠── DECISIÓN ECONÓMICA ───────────────────────────────────────────`,
    ...be.map((s) => `║ ${s}`),
    `╠── ENTREGA ──────────────────────────────────────────────────────`,
    `║ ${semanas} semanas (maquinado ${win.cost.cavity.tMachiningH.toFixed(0)}h · complejidad ${complexity.toFixed(2)} · f_maq ${mf})`,
    `╚═════════════════════════════════════════════════════════════════`,
  ];
}
