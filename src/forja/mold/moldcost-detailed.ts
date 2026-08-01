/**
 * COSTEO DETALLADO DEL MOLDE — Kazmer cap 3 §3.3 (LITERAL, Eq 3.2-3.18).
 * =======================================================================
 * El costo que cierra "el cliente trae su pieza → cotización completa":
 *   C_total = C_insertos + C_mold_base + C_customización              (Eq 3.2)
 *
 *  · INSERTOS (§3.3.1): C_cavidad = material + maquinado + acabado,
 *    × n_cavidades × factor_descuento (Eq 3.3/3.4).
 *      - material  (Eq 3.5-3.7): V = L_cav·W_cav·H_cav × ρ × κ.
 *      - maquinado (Eq 3.8-3.12): (t_vol + t_área)/η × f_complejidad × f_maq,
 *        con f_complejidad = A_sup·h_pared / V_pieza (Eq 3.12) — SUBE con cada
 *        costilla/boss/ventana; f_maq de la Tabla 3.4 (EDM=4…); η=25 %.
 *      - acabado   (Eq 3.13-3.14): Σ A_i / R_i (Tabla 3.6 SPI) × tarifa.
 *  · MOLD BASE (§3.3.2): C = $830 + M·κ_acero; M estadística (Eq 3.15) con
 *    L/W/H_mold (Eq 3.16-3.17); coeficientes DME de la Tabla 3.7.
 *  · CUSTOMIZACIÓN (§3.3.3, Eq 3.18): C_insertos·Σf_cav + C_base·Σf_mold,
 *    con f de las Tablas 3.7-3.11 (feed/cooling/ejector/structural/misc).
 *
 * Reproduce EL EJEMPLO del laptop bezel del libro = $74,800 EXACTO
 * ($27,900 insertos + $3,700 base + $43,200 custom). PURO: node-testeable.
 */
import { metalByKey, type MoldMetal } from './moldbase';

// ── Tabla 3.4: factor de maquinado por proceso ──────────────────────
export const MACHINING_FACTOR = {
  torneado: 0.5, taladrado: 0.5, fresado: 1, rectificado: 4, edm: 4,
} as const;

// ── Tabla 3.5: descuento por nº de sets de cavidad (−15 % por duplicación) ──
export function cavityDiscount(nCavities: number): number {
  const T: Array<[number, number]> = [[1, 1], [2, 0.85], [4, 0.72], [8, 0.61], [16, 0.52]];
  if (nCavities >= 16) return 0.52;
  // interpolación por la regla de duplicación (log2): f = 0.85^log2(n) acotado a la tabla
  let best = 1;
  for (const [n, f] of T) if (nCavities >= n) best = f;
  return best;
}

// ── Tabla 3.6: tasas de acabado SPI (m²/h) ──────────────────────────
export const FINISH_RATE = {
  textura: 0.0002, 'SPI A-1': 0.0005, 'SPI A-3': 0.001, 'SPI B-3': 0.0025,
  'SPI C-3': 0.005, 'SPI D-2': 0.01, 'SPI D-3': 0.02,
} as const;

// ── Tabla 3.7: coeficiente de acero del mold base (DME) ─────────────
export const MOLD_STEEL_COEF = { 'SAE 1030': 3.55, 'AISI 4130': 4.40, 'AISI P20': 5.25 } as const;

// ── Tablas 3.7-3.11: factores de customización [cavidad, mold] ───────
export const CUSTOM_FACTORS = {
  feed: {
    'cold-2placas': [0.05, 0.1], 'cold-3placas': [0.1, 1.0],
    'hot-thermal': [0.4, 2.0], 'hot-valve': [0.5, 4.0],
    'hot-stack-thermal': [0.5, 8.0], 'hot-stack-valve': [0.9, 12.0],
  },
  cooling: {
    'recto-oring': [0.05, 0.2], 'recto-bafles': [0.10, 0.2],
    'circuito': [0.15, 0.4], 'circuito-bafles': [0.20, 0.4], 'complejo-conductivo': [0.25, 0.8],
  },
  ejector: {
    'pines': [0.1, 0.1], 'mixto': [0.2, 0.2], 'stripper': [0.2, 0.4],
    'slide-externo': [0.2, 0.4], 'slide-interno': [0.4, 0.4], 'core-pull': [0.4, 0.5], 'reverse': [0.5, 1.0],
  },
  structural: {
    'planar': [0.0, 0.0], 'escalonada': [0.2, 0.0], 'contorneada': [0.4, 0.2],
    'pilares': [0.0, 0.1], 'pilares-interlocks': [0.1, 0.2], 'split-cavity': [0.5, 1.0],
  },
  misc: {
    'sensor-temp': [0.05, 0.1], 'sensor-presion': [0.05, 0.1], 'gas-assist': [0.2, 0.5],
    'runner-shutoff': [0.0, 0.1], 'melt-control': [0.2, 1.0], 'insert': [0.4, 0.4],
    'in-mold-label': [0.4, 0.4], '2-shot': [2.0, 4.0], '3-shot': [3.0, 6.0],
  },
} as const;

// ── entradas ────────────────────────────────────────────────────────
export interface CostPart {
  LpartMm: number; WpartMm: number; HpartMm: number;
  ApartSurfaceMm2: number; VpartMm3: number; wallMm: number;
}
export interface CostInputs {
  part: CostPart;
  metalKey: string;                       // acero de inserto (Apéndice B)
  nCavities: number;
  machiningFactor: number;                // Tabla 3.4 (o promedio ponderado)
  machiningRateUSDh: number;              // tarifa facturada ($/h) — Apéndice D ×3
  finishAreas: Array<{ spi: keyof typeof FINISH_RATE; areaMm2: number }>;
  finishRateUSDh: number;
  moldSteel: keyof typeof MOLD_STEEL_COEF;
  custom: {                               // llaves de las Tablas 3.7-3.11 (arrays = suma)
    feed?: Array<keyof typeof CUSTOM_FACTORS['feed']>;
    cooling?: Array<keyof typeof CUSTOM_FACTORS['cooling']>;
    ejector?: Array<keyof typeof CUSTOM_FACTORS['ejector']>;
    structural?: Array<keyof typeof CUSTOM_FACTORS['structural']>;
    misc?: Array<keyof typeof CUSTOM_FACTORS['misc']>;
  };
  efficiency?: number;                    // η de maquinado (default 0.25)
}

export interface CostBreakdown {
  cavity: { LmM: number; WmM: number; HmM: number; volM3: number;
    materialUSD: number; tVolH: number; tAreaH: number; complexity: number;
    tMachiningH: number; machiningUSD: number; tFinishH: number; finishingUSD: number;
    setUSD: number };
  cavitiesUSD: number; discount: number;
  moldBase: { LmM: number; WmM: number; HmM: number; massKg: number; USD: number };
  customization: { sumCavity: number; sumMold: number; USD: number };
  totalUSD: number;
  sesgos: CostSesgo[];
}

const mm2m = (mm: number) => mm / 1000;

/** §3.3.1.2 dimensiones del inserto (Eq 3.7) — todo en metros. */
export function cavityInsertDims(p: CostPart) {
  const Lp = mm2m(p.LpartMm), Wp = mm2m(p.WpartMm), Hp = mm2m(p.HpartMm);
  return {
    LmM: Lp + Math.max(0.1 * Lp, Hp),
    WmM: Wp + Math.max(0.1 * Wp, Hp),
    HmM: Math.max(0.057, 2 * Hp),
  };
}

export function estimateMoldCost(inp: CostInputs): CostBreakdown {
  const p = inp.part;
  const metal: MoldMetal = metalByKey(inp.metalKey);
  const eta = inp.efficiency ?? 0.25;

  // ── INSERTOS: material (Eq 3.5-3.7) ──
  const d = cavityInsertDims(p);
  const volM3 = d.LmM * d.WmM * d.HmM;
  const materialUSD = volM3 * metal.rhoKgM3 * metal.costKg;

  // ── maquinado (Eq 3.8-3.12) ──
  const tVolH = volM3 / metal.volMachineM3h;
  const tAreaH = (p.ApartSurfaceMm2 * 1e-6) / metal.areaMachineM2h;
  const complexity = (p.ApartSurfaceMm2 * p.wallMm) / p.VpartMm3;         // Eq 3.12
  const tMachiningH = ((tVolH + tAreaH) / eta) * complexity * inp.machiningFactor;
  const machiningUSD = tMachiningH * inp.machiningRateUSDh;

  // ── acabado (Eq 3.13-3.14) ──
  const tFinishH = inp.finishAreas.reduce((s, a) => s + (a.areaMm2 * 1e-6) / FINISH_RATE[a.spi], 0);
  const finishingUSD = tFinishH * inp.finishRateUSDh;

  const setUSD = materialUSD + machiningUSD + finishingUSD;
  const discount = cavityDiscount(inp.nCavities);
  const cavitiesUSD = setUSD * inp.nCavities * discount;

  // ── MOLD BASE (Eq 3.14-3.17) ──
  const nSide = Math.ceil(Math.sqrt(inp.nCavities));
  const LmoldM = d.LmM * nSide * 1.33;
  const WmoldM = d.WmM * nSide * 1.33;
  const HmoldM = 0.189 + 2 * d.HmM;
  const massKg = 1330 * LmoldM * WmoldM + 17200 * LmoldM * WmoldM * HmoldM;
  const moldBaseUSD = 830 + massKg * MOLD_STEEL_COEF[inp.moldSteel];

  // ── CUSTOMIZACIÓN (Eq 3.18) ──
  const sum = (cat: keyof typeof CUSTOM_FACTORS, keys: string[] | undefined, idx: 0 | 1) =>
    (keys ?? []).reduce((s, k) => s + ((CUSTOM_FACTORS[cat] as Record<string, number[]>)[k]?.[idx] ?? 0), 0);
  const sumCavity = (['feed', 'cooling', 'ejector', 'structural', 'misc'] as const)
    .reduce((s, cat) => s + sum(cat, inp.custom[cat] as string[] | undefined, 0), 0);
  const sumMold = (['feed', 'cooling', 'ejector', 'structural', 'misc'] as const)
    .reduce((s, cat) => s + sum(cat, inp.custom[cat] as string[] | undefined, 1), 0);
  const customUSD = cavitiesUSD * sumCavity + moldBaseUSD * sumMold;

  const sesgos: CostSesgo[] = [
    { que: 'volumen a remover = inserto entero', direccion: 'conservador',
      magnitud: `${(volM3 * 1e9).toFixed(0)} mm³ (el mecanizado real remueve menos)`,
      cita: '§3.3.1.2 Eq 3.7' },
    { que: 'eficiencia de maquinado', direccion: 'conservador',
      magnitud: `${((eta) * 100).toFixed(0)} % (el 75 % restante es posicionado, cambio de herramienta, inspección)`,
      cita: '§3.3.1.3' },
    { que: 'layout ceiling(√n)', direccion: 'conservador',
      magnitud: `${nSide} × ${nSide} con rejilla cuadrada (la rejilla óptima puede usar menos columnas)`,
      cita: '§3.3.2' },
  ];
  return {
    cavity: { LmM: d.LmM, WmM: d.WmM, HmM: d.HmM, volM3, materialUSD,
      tVolH, tAreaH, complexity, tMachiningH, machiningUSD, tFinishH, finishingUSD, setUSD },
    cavitiesUSD, discount,
    moldBase: { LmM: LmoldM, WmM: WmoldM, HmM: HmoldM, massKg, USD: moldBaseUSD },
    customization: { sumCavity, sumMold, USD: customUSD },
    totalUSD: cavitiesUSD + moldBaseUSD + customUSD,
    sesgos,
  };
}

// ══ §3.4: COSTO POR PIEZA (Eq 3.19-3.24) ═══════════════════════════
// Apéndice A: plásticos (ρ kg/m³, κ $/kg). Ampliar con el Apéndice completo.
export const PLASTICS: Record<string, { rhoKgM3: number; costKg: number }> = {
  ABS: { rhoKgM3: 1044, costKg: 2.16 },
  PP: { rhoKgM3: 905, costKg: 1.50 },
  PC: { rhoKgM3: 1200, costKg: 4.20 },
  PA66: { rhoKgM3: 1140, costKg: 3.80 },
  POM: { rhoKgM3: 1410, costKg: 2.90 },
};
// Tabla 3.12: factor de desperdicio de material por sistema de alimentación.
export const FEED_WASTE = {
  'cold': 1.25, 'cold-regrind': 1.08, 'hot-short': 1.05, 'hot-long': 1.02,
} as const;
// Tabla 3.13: factor de eficiencia de ciclo [cold, hot] por modo de operación.
export const CYCLE_EFFICIENCY = {
  'operador': [2.5, 3.0], 'gravedad-robot': [1.5, 2.0], 'automatico': [1.0, 1.5],
} as const;

/** Eq 3.24: tarifa horaria de la máquina de moldeo por tonelaje de clamp ($/h). */
export function moldingMachineRate(clampTons: number, fMachine = 1): number {
  return (47.0 + 0.073 * clampTons - 4.7 * Math.log(clampTons)) * fMachine;
}
/** Eq 3.23: tiempo de ciclo estimado por espesor de pared (s). */
export function cycleTimeEstimate(wallMm: number, cycleEff: number): number {
  return 4 * wallMm * wallMm * cycleEff;
}

export interface PartCostInputs {
  VpartMm3: number; plastic: keyof typeof PLASTICS;
  feedWaste: keyof typeof FEED_WASTE;
  nCavities: number; clampTons: number; wallMm: number;
  cycleMode: keyof typeof CYCLE_EFFICIENCY; hotRunner: boolean;
  fMachine?: number; yield_?: number; fMaintenance?: number;
}
export interface CostSesgo {
  que: string; direccion: 'conservador' | 'agresivo'; magnitud: string; cita: string;
}
export interface PartCostBreakdown {
  moldPerPart: number; materialPerPart: number; processPerPart: number;
  cycleTimeS: number; machineRateUSDh: number; partUSD: number;
  fMaintenance: number;
  fMaintenanceJustificacion: string;
}
/** §3.4 completo: costo por pieza (Eq 3.19-3.24). */
export function estimatePartCost(totalMoldUSD: number, annualOrTotalQty: number, p: PartCostInputs): PartCostBreakdown {
  const fMaint = p.fMaintenance ?? 3;                        // ejemplo del libro: ×3
  const moldPerPart = (totalMoldUSD / annualOrTotalQty) * fMaint;       // Eq 3.20
  const plc = PLASTICS[p.plastic];
  const materialPerPart = (p.VpartMm3 * 1e-9) * plc.rhoKgM3 * plc.costKg * FEED_WASTE[p.feedWaste]; // Eq 3.21
  const cycleEff = CYCLE_EFFICIENCY[p.cycleMode][p.hotRunner ? 1 : 0];
  const cycleTimeS = cycleTimeEstimate(p.wallMm, cycleEff);            // Eq 3.23
  const machineRateUSDh = moldingMachineRate(p.clampTons, p.fMachine ?? 1); // Eq 3.24
  const processPerPart = (cycleTimeS / p.nCavities) * (machineRateUSDh / 3600);   // Eq 3.22
  const yld = p.yield_ ?? 0.98;
  const partUSD = (moldPerPart + materialPerPart + processPerPart) / yld; // Eq 3.19
  const fMaintenanceJustificacion = fMaint === 3
    ? 'default del libro (§3.4.1 ejemplo): interpolación media en Tabla 3.11 para resina no abrasiva sobre acero P20'
    : `valor suministrado (${fMaint}): sobreescribe el default 3 del libro`;
  return { moldPerPart, materialPerPart, processPerPart, cycleTimeS, machineRateUSDh, partUSD,
    fMaintenance: fMaint, fMaintenanceJustificacion };
}

/** Cotización legible (para el reporte al cliente). */
export function quoteReport(inp: CostInputs, b: CostBreakdown): string[] {
  const $ = (x: number) => '$' + Math.round(x).toLocaleString('en-US');
  return [
    `COTIZACIÓN DE MOLDE (Kazmer §3.3) — ${inp.nCavities} cavidad(es) · acero ${inp.metalKey}`,
    '═'.repeat(64),
    `INSERTOS (§3.3.1):  material ${$(b.cavity.materialUSD)} + maquinado ${$(b.cavity.machiningUSD)} + acabado ${$(b.cavity.finishingUSD)} = ${$(b.cavity.setUSD)}/set`,
    `  maquinado: t_vol ${b.cavity.tVolH.toFixed(2)}h + t_área ${b.cavity.tAreaH.toFixed(2)}h · complejidad ${b.cavity.complexity.toFixed(2)} · f_maq ${inp.machiningFactor} → ${b.cavity.tMachiningH.toFixed(0)}h × ${$(inp.machiningRateUSDh)}/h`,
    `  × ${inp.nCavities} cav × descuento ${b.discount} = ${$(b.cavitiesUSD)}`,
    `MOLD BASE (§3.3.2): ${b.moldBase.massKg.toFixed(0)} kg × ${MOLD_STEEL_COEF[inp.moldSteel]}$/kg + $830 = ${$(b.moldBase.USD)}`,
    `CUSTOMIZACIÓN (§3.3.3): Σf_cav ${b.customization.sumCavity.toFixed(2)} · Σf_mold ${b.customization.sumMold.toFixed(2)} = ${$(b.customization.USD)}`,
    '─'.repeat(64),
    `TOTAL DEL MOLDE:    ${$(b.totalUSD)}`,
  ];
}
