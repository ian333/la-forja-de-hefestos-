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
import { ABS_MG47, convergeVelocity, pressureDropSegment, clampMetricTons, type MeltMaterial } from './filling';
import { checkDFM, type DFMPart, type DFMReport } from './dfm';
import { sizeInserts, selectMoldBase, selectMetal, checkMachine, MACHINES, type InsertSizing, type BaseSelection, type MoldMetal } from './moldbase';
import {
  estimateMoldCost, estimatePartCost, MACHINING_FACTOR, type CostInputs, type CostBreakdown, type PartCostBreakdown,
} from './moldcost-detailed';

export type Arch = 'cold-2placas' | 'cold-3placas' | 'hot-runner';

export interface MachineSpec {
  name: string;
  /** Geometría (mm/mm²/mm³). */
  Lmm: number; Wmm: number; Hmm: number;
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
  /** Margen de venta sobre el costo del molde (default 1.6 = 60 %). */
  margin?: number;
}

interface ArchCav {
  arch: Arch; nCav: number; factible: boolean;
  clampTons: number; moldUSD: number; partUSD: number; totalUSD: number;
  cost: CostBreakdown; part: PartCostBreakdown;
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
  maquina: { nombre: string; ok: boolean; issues: string[] } | null;
  veredicto: { viable: boolean; banderas: string[]; precioMoldeUSD: number; costoPiezaUSD: number; entregaSemanas: number };
  reporte: string[];
}

const FINISH_MAP: Record<string, { spi: 'texture' | 'SPI A-1' | 'SPI A-3' | 'SPI B-3' }['spi']> = {
  texture: 'SPI B-3', 'SPI B-3': 'SPI B-3', 'SPI A-3': 'SPI A-3', 'SPI A-1': 'SPI A-1',
};
// arquitectura → factores de customización §3.3 + parámetros §3.4
const ARCH_CUSTOM: Record<Arch, { feed: string; feedWaste: 'cold' | 'hot-long'; hotRunner: boolean }> = {
  'cold-2placas': { feed: 'cold-2placas', feedWaste: 'cold', hotRunner: false },
  'cold-3placas': { feed: 'cold-3placas', feedWaste: 'cold', hotRunner: false },
  'hot-runner': { feed: 'hot-thermal', feedWaste: 'hot-long', hotRunner: true },
};

/** Presión de llenado + clamp por cavidad (filling.ts, puro). */
function clampFor(spec: MachineSpec, melt: MeltMaterial, nCav: number): { dPMPa: number; clampTons: number } {
  const wallM = spec.wallMm / 1000, flowM = spec.Lmm / 1000;   // longitud de flujo ≈ largo (aprox)
  const v = convergeVelocity(melt, wallM);
  const dP = pressureDropSegment(melt, flowM, wallM, v);
  const projAreaM2 = nCav * (spec.Lmm * spec.Wmm) * 1e-6;      // área proyectada = L×W por cavidad
  const clamp = clampMetricTons(dP * 0.8, projAreaM2);         // presión de empaque ≈ 0.8·ΔP
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
  const archs: Arch[] = ['cold-2placas', 'cold-3placas', 'hot-runner'];
  const cavs = [1, 2, 4, 8, 16];
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

  // ── compatibilidad de máquina (la mejor que aguante el clamp) ──
  const stackMm = base.plateAmm + base.plateBmm + 120;
  const maq = pickMachine(base, stackMm, win);

  // ── break-even: por qué NO otra arquitectura ──
  const alt = variantes.find((v) => v.arch !== win.arch) ?? variantes[1];
  const be = breakEvenReport(win, alt, totalQty);

  // ── VEREDICTO ──
  const banderas: string[] = [];
  if (dfm.errors > 0) banderas.push(`DFM: ${dfm.errors} error(es) de diseño de pieza — corregir antes de cortar acero`);
  if (win.cost.cavity.complexity > 3) banderas.push(`pieza muy compleja (${win.cost.cavity.complexity.toFixed(1)}): maquinado por EDM domina el costo`);
  if (throughputForzado) banderas.push(`el volumen anual exige >16 cavidades (ciclo ${win.part.cycleTimeS.toFixed(0)}s) — considerar 2 moldes o ciclo más corto`);
  if (!maq?.ok) banderas.push('ninguna máquina del catálogo calza limpio — verificar tie bars/daylight/clamp');
  const margin = spec.margin ?? 1.6;
  const precioMolde = Math.round(win.cost.totalUSD * margin);
  const entregaSemanas = Math.ceil(win.cost.cavity.tMachiningH / 40) + (win.arch === 'hot-runner' ? 4 : 2) + 2;
  const viable = dfm.errors === 0 && Number.isFinite(win.cost.totalUSD) && win.cost.totalUSD > 0;

  const reporte = buildReport(spec, dfm, metal, win, base, maq, precioMolde, entregaSemanas, be, complexity, machiningFactor);

  return {
    spec, dfm, metal, insertos, variantes,
    recomendacion: { arch: win.arch, nCav: win.nCav, porQue: [
      `mínimo costo TOTAL @ ${totalQty.toLocaleString()} pzas: molde $${Math.round(win.cost.totalUSD).toLocaleString()} + $${win.partUSD.toFixed(3)}/pza`,
      `${win.arch === 'hot-runner' ? 'hot runner amortiza el molde caro con material/ciclo bajos a alto volumen' : 'cold runner: molde barato gana cuando el volumen no paga la colada caliente'}`,
    ] },
    base, cotizacion: win.cost, costoPieza: win.part, breakEven: be, maquina: maq,
    veredicto: { viable, banderas, precioMoldeUSD: precioMolde, costoPiezaUSD: win.partUSD, entregaSemanas },
    reporte,
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

function pickMachine(base: BaseSelection, stackMm: number, win: ArchCav) {
  const shotCc = win.nCav * 30;                              // aprox por cavidad
  for (const m of [...MACHINES].sort((a, b) => a.clampTons - b.clampTons)) {
    if (m.clampTons < win.clampTons) continue;
    const chk = checkMachine({ wmm: base.base.wmm, lmm: base.base.lmm, stackMm, shotCc, clampNeedTons: win.clampTons }, m);
    if (chk.ok) return { nombre: m.name, ok: true, issues: [] as string[] };
  }
  const big = MACHINES[MACHINES.length - 1];
  const chk = checkMachine({ wmm: base.base.wmm, lmm: base.base.lmm, stackMm, shotCc, clampNeedTons: win.clampTons }, big);
  return { nombre: big.name, ok: false, issues: chk.issues };
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

function buildReport(spec: MachineSpec, dfm: DFMReport, metal: { metal: MoldMetal; porQue: string[] }, win: ArchCav, base: BaseSelection, maq: { nombre: string; ok: boolean } | null, precioMolde: number, semanas: number, be: string[], complexity: number, mf: number): string[] {
  const $ = (x: number) => '$' + Math.round(x).toLocaleString('en-US');
  const c = win.cost;
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
    `╠── DECISIÓN ECONÓMICA ───────────────────────────────────────────`,
    ...be.map((s) => `║ ${s}`),
    `╠── ENTREGA ──────────────────────────────────────────────────────`,
    `║ ${semanas} semanas (maquinado ${win.cost.cavity.tMachiningH.toFixed(0)}h · complejidad ${complexity.toFixed(2)} · f_maq ${mf})`,
    `╚═════════════════════════════════════════════════════════════════`,
  ];
}
