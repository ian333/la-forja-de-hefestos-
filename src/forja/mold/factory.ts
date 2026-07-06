/**
 * FÁBRICA DE MOLDES — el generador "trae tu pieza, te damos el molde"
 * ====================================================================
 * Orquesta TODOS los módulos de Kazmer: dada una pieza (B-Rep) y sus
 * requisitos (material, producción anual), genera VARIANTES de arquitectura
 * de molde (2 placas fría / 3 placas / hot runner × 1/2/4/8 cavidades, con
 * side-actions si hay undercuts) y para cada una corre el ANÁLISIS COMPLETO:
 * llenado→clamp, colada optimizada, enfriamiento, contracción pvT, expulsión,
 * venteo, estructural, tornillería y COSTOS — y decide la mejor por economía.
 */
import { OC, Shape, volume } from '../brep/occt';
import { splitMold, shapeBBox, type SplitMoldOptions, type SplitMoldResult } from './mold';
import { fillingReport, convergeVelocity, pressureDropSegment, clampMetricTons, ABS_MG47, type MeltMaterial } from './filling';
import { optimizeFeedSystem, feedVolume } from './feed';
import { coolingReport, coolingTimePlate, ABS_KAZMER } from './cooling';
import { shrinkage, ABS_TAIT } from './shrinkage';
import { ejectionForce, ejectorPinSizing, effectiveArea, ABS_EJECT } from './ejection';
import { gateDesign, type GateType } from './gating';
import { ventDesign } from './venting';
import { plateBending, structuralReport, TON_N } from './structural';
import { moldMassKg, worstCaseScrewForce, selectMoldScrew } from './fasteners';
import { totalCost, costPerPart, type MoldOption } from './cost';
import { sideActionDesign } from './sideactions';

export interface PartSpec {
  name: string;
  /** Pieza B-Rep (una cavidad). */
  shape: Shape;
  /** Espesor de pared nominal (mm) y longitud de flujo (mm). */
  wallMm: number; flowLenMm: number;
  /** Área proyectada de UNA cavidad (mm²). */
  projAreaMm2: number;
  /** Undercuts que exigen side-action: área proyectada al movimiento + carrera. */
  undercuts?: Array<{ aProjMm2: number; strokeMm: number }>;
  /** Producción anual (piezas). */
  annualVolume: number;
}

export type Architecture = 'cold-2placas' | 'cold-3placas' | 'hot-runner';

export interface MoldVariant {
  arch: Architecture; cavities: number;
  analysis: {
    fillPressureMPa: number; clampTons: number; coolingS: number; shrinkagePct: number; moldScale: number;
    ejectForceN: number; pinCount: number; pinDiaMm: number;
    gates: string; vents: string; feedRunnersMm: number[]; feedVolCc: number;
    bendingMm: number; flashRisk: boolean; screwSize: string;
    sideActions: string[];
    moldCostUSD: number; partCostUSD: number; totalCostUSD: number;
  };
  report: string[];
}

/** Estimador de costo del molde (cap 3, simplificado por arquitectura y cavidades). */
function estimateMoldCost(arch: Architecture, cav: number, projAreaMm2: number, nSlides: number): number {
  const base = 8000 + projAreaMm2 * 0.12;                       // mold base + cavidad unitaria
  const perCav = 2500 + projAreaMm2 * 0.05;
  const archMult = arch === 'hot-runner' ? 2.2 : arch === 'cold-3placas' ? 1.45 : 1;
  return Math.round((base + perCav * cav) * archMult + nSlides * 6000);
}

export function analyzeVariant(oc: OC, part: PartSpec, arch: Architecture, cav: number, melt: MeltMaterial = ABS_MG47): MoldVariant {
  const R: string[] = [];
  const wallM = part.wallMm / 1000, flowM = part.flowLenMm / 1000;
  // 1. llenado + clamp (todas las cavidades proyectan)
  const v = convergeVelocity(melt, wallM);
  const dP = pressureDropSegment(melt, flowM, wallM, v);
  const clamp = clampMetricTons(dP, cav * part.projAreaMm2 * 1e-6);
  // 2. colada: caudal por cavidad ~ v̄·(sección de flujo); total al sprue
  const VdotCav = v * (part.projAreaMm2 * 1e-6 / (part.flowLenMm / 1000)) * wallM * 8;  // aprox orden 30-130 cc/s
  const Vdot = Math.min(200e-6, Math.max(30e-6, VdotCav));
  const path = arch === 'hot-runner'
    ? [{ name: 'sprue', L: 0.09, Vdot }, { name: 'manifold', L: 0.1 + 0.02 * cav, Vdot: Vdot / 2 }, { name: 'nozzle', L: 0.1, Vdot: Vdot / cav }]
    : arch === 'cold-3placas'
      ? [{ name: 'sprue', L: 0.05, Vdot }, { name: 'runner-plate', L: 0.06 + 0.02 * cav, Vdot: Vdot / 2 }, { name: 'drop', L: 0.03, Vdot: Vdot / cav }]
      : [{ name: 'sprue', L: 0.06, Vdot }, { name: 'runner', L: 0.05 + 0.015 * cav, Vdot: Vdot / 2 }];
  const feed = optimizeFeedSystem(melt, path, 30e6);
  const fVol = feedVolume(feed.map((f) => ({ ...f, count: f.name === 'sprue' ? 1 : Math.max(2, cav / 2) }))) * 1e6;
  // 3. enfriamiento (gobierna la pared) — el runner frío alarga el ciclo (cap 9)
  const cool = coolingReport([
    { name: 'pared', kind: 'plate', sizeMm: part.wallMm },
    ...(arch !== 'hot-runner' ? [{ name: 'runner', kind: 'rod' as const, sizeMm: Math.max(...feed.map((f) => f.R * 2000)) * 0.76 }] : []),
  ], ABS_KAZMER);
  // 4. contracción pvT REAL
  const sh = shrinkage(ABS_TAIT, { tNoFlowK: 405, pPackPa: 0.8 * dP });
  // 5. expulsión
  const bb = shapeBBox(oc, part.shape);
  const aEff = effectiveArea({ h: wallM, L: (bb.max[0] - bb.min[0]) / 1000, W: (bb.max[1] - bb.min[1]) / 1000, nWalls: 4, hWall: (bb.max[2] - bb.min[2]) / 1000 });
  const fEj = ejectionForce(ABS_EJECT, 1, aEff) * cav;
  const pins = ejectorPinSizing(ABS_EJECT, fEj, 10 * cav, wallM);
  // 6. gates + venteo
  const gt: GateType = arch === 'hot-runner' ? 'valve' : arch === 'cold-3placas' ? 'pin-point' : 'edge';
  const gate = gateDesign({ type: gt, wallMm: part.wallMm, VdotM3s: Vdot / cav, shearMaxS: 50000 });
  const vent = ventDesign({ VdotAirM3s: Vdot, lM: 0.01, wM: 0.01, lFlashM: 0.2e-3 });
  // 7. estructural + tornillos (molde crece con cavidades)
  const mw = 0.25 + 0.06 * Math.sqrt(cav), md = 0.25 + 0.04 * Math.sqrt(cav), mh = 0.35;
  const bend = plateBending(clamp * TON_N, mw * 0.6, mw * 0.7, 0.12);
  const screws = selectMoldScrew(worstCaseScrewForce(moldMassKg(mh, mw, md), mw / 2, mw / 3));
  // 8. side-actions
  const sa = (part.undercuts ?? []).map((u) => sideActionDesign({ aProjMm2: u.aProjMm2, pMeltMPa: dP / 1e6, strokeMm: u.strokeMm }));
  // 9. costos + decisión
  const moldCost = estimateMoldCost(arch, cav, part.projAreaMm2, sa.length * cav);
  const cycleS = cool.cycleCoolingS + 5;                        // + apertura/cierre/inyección
  const partCostMarginal = 0.02 + (0.5 * cycleS) / 60 / cav + (arch !== 'hot-runner' ? fVol * 1.05e-3 * 2.2 / 1000 / cav : 0);
  const opt: MoldOption = { name: `${arch}-${cav}cav`, fixedCost: moldCost, marginalCost: partCostMarginal, cavities: cav, cycleTimeS: cycleS };
  R.push(`ΔP ${(dP / 1e6).toFixed(1)} MPa · clamp ${clamp.toFixed(0)} ton · t_c ${cool.cycleCoolingS.toFixed(1)}s (${cool.governing})`);
  R.push(`contracción ${(sh.linear * 100).toFixed(2)}% → moldScale ${sh.moldScale.toFixed(4)} · F_eject ${fEj.toFixed(0)} N → ${10 * cav} pines ⌀${Math.max(3, Math.ceil(pins.dMinMm)).toFixed(0)}`);
  R.push(`gate ${gate.report}`);
  R.push(`feed: ${feed.map((f) => `${f.name} R${(f.R * 1000).toFixed(1)}`).join(' ')} · V ${fVol.toFixed(1)} cc ${arch !== 'hot-runner' ? '(DESPERDICIO por ciclo)' : '(sin desperdicio)'}`);
  R.push(`${vent.report} · flexión ${(bend.deflectionM * 1000).toFixed(3)}mm · tornillos ${screws.din912}`);
  sa.forEach((s) => R.push(`  side-action: ${s.report[1]}`));
  R.push(`COSTO: molde $${moldCost.toLocaleString()} + $${partCostMarginal.toFixed(3)}/pza → total $${Math.round(totalCost(opt, part.annualVolume)).toLocaleString()} @${part.annualVolume.toLocaleString()} pzas ($${costPerPart(opt, part.annualVolume).toFixed(3)}/pza)`);
  return {
    arch, cavities: cav,
    analysis: {
      fillPressureMPa: dP / 1e6, clampTons: clamp, coolingS: cool.cycleCoolingS,
      shrinkagePct: sh.linear * 100, moldScale: sh.moldScale,
      ejectForceN: fEj, pinCount: 10 * cav, pinDiaMm: Math.max(3, Math.ceil(pins.dMinMm)),
      gates: gate.report, vents: vent.report,
      feedRunnersMm: feed.map((f) => f.R * 1000), feedVolCc: fVol,
      bendingMm: bend.deflectionM * 1000, flashRisk: bend.deflectionM > 0.02e-3,
      screwSize: screws.din912, sideActions: sa.map((s) => s.type),
      moldCostUSD: moldCost, partCostUSD: costPerPart(opt, part.annualVolume), totalCostUSD: totalCost(opt, part.annualVolume),
    },
    report: R,
  };
}

/** LA FÁBRICA: genera la familia de variantes y las ordena por costo total. */
export function moldFactory(oc: OC, part: PartSpec, opts: { archs?: Architecture[]; cavityOptions?: number[] } = {}):
  { variants: MoldVariant[]; best: MoldVariant; summary: string[] } {
  const archs = opts.archs ?? ['cold-2placas', 'cold-3placas', 'hot-runner'];
  const cavs = opts.cavityOptions ?? [1, 2, 4, 8];
  const variants: MoldVariant[] = [];
  for (const a of archs) for (const c of cavs) variants.push(analyzeVariant(oc, part, a, c));
  variants.sort((x, y) => x.analysis.totalCostUSD - y.analysis.totalCostUSD);
  const summary = variants.map((v, i) =>
    `${i === 0 ? '★' : ' '} ${v.arch} ×${v.cavities}: molde $${v.analysis.moldCostUSD.toLocaleString()} · $${v.analysis.partCostUSD.toFixed(3)}/pza · clamp ${v.analysis.clampTons.toFixed(0)}t · ciclo ${v.analysis.coolingS.toFixed(1)}s${v.analysis.sideActions.length ? ` · ${v.analysis.sideActions.length} side-actions` : ''}`);
  return { variants, best: variants[0], summary };
}
