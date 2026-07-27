/**
 * registry.ts — EL BUS DE COMANDOS de La Forja (`ui.run('dominio.verbo', {…})`).
 * ============================================================================
 * El destilado (docs/forja-research/MOLDE-COMANDOS.md) dejaba de ser un catálogo
 * y pasa a ser VERDAD EJECUTABLE: un solo `run(id, params)` enruta el verbo a su
 * forjaFn. La UI, un agente o un test invocan el MISMO idioma.
 *
 * Hallazgo del test funcional (comando-test.cjs, 26/26): las firmas reales son
 * POSICIONALES (`clampForceN(p, a)`), no objetos. Este bus es el ADAPTADOR
 * named→posicional: el llamador pasa params con nombre (los del registro) y cada
 * comando los traduce a la llamada real. Ese es el trabajo que el catálogo no hacía.
 *
 * Cobertura v1: los 10 dominios de FÍSICA PURA (sin OCCT), verificados contra Kazmer.
 * Cobertura v2: el ORQUESTADOR `mold.machine` (spec→molde+cotización, PURO), `tech.choose`,
 * DFM de malla (`dfm.fromMesh`, `part.pickDrawAxis`) y GEOMETRÍA con `ctx.oc`
 * (`factory.generate`/`variant.analyze` arman su propia caja con `makeBox`). El infra
 * `needsOc` guarda los comandos que requieren el kernel (lanzan claro si falta `ctx.oc`).
 * Cobertura v3: el PIPELINE del curso (`curso.percha→escala→layout→parting→split→guias`)
 * vía un ALMACÉN DE HANDLES — el Shape OCCT no es JSON, así que los comandos devuelven un
 * handle opaco ('sh_7') y el bus guarda el shape; etapa N recibe el handle de N-1. Ciclo de
 * vida explícito con `shape.list/free/clear` (llaman `.delete()` para no llenar el heap wasm).
 */
import {
  ABS_MG47, shearRateNewtonian, shearRatePowerLaw, recommendedVelocity, viscosityPowerLaw,
  convergeVelocity, pressureDropSegment, fillingPressure, clampForceN, clampMetricTons, fillingReport,
  type MeltMaterial,
} from '../mold/filling';
import {
  reynolds, shearRateRunner, pressureDropRunner, feedPressureDrop, feedVolume, minRunnerRadius,
} from '../mold/feed';
import {
  GATE_TABLE, shearRateStrip, shearRateCyl, gateRadiusForShear, gateDropStripPL, gateDropCylNewt, gateDesign,
} from '../mold/gating';
import { ventMinThickness, ventMaxThickness, ventDesign } from '../mold/venting';
import { flowLeaderThickness, flowLeaderVelocityRatio, designFlowLeaders } from '../mold/flowleaders';
import {
  ABS_EJECT, ejectionForce, ejectionVector, ejectorPinSizing, type EjectionMaterial,
} from '../mold/ejection';
import { machineRequirements } from '../mold/machinesizing';
import { moldOpeningVelocity, threePlateLayout, compareFeedSystems } from '../mold/threeplate';
import { optimizeSupportPlate, snapToCommercialPlate, sizeCavityPlate } from '../mold/platesizing';
import { draftForFinish, checkDFM } from '../mold/dfm';
// ── v2: orquestador + tecnología + DFM de malla + geometría (needsOc) ──
import { moldMachine, type MachineSpec } from '../mold/moldmachine';
import { chooseMoldTechnology } from '../mold/moldtech';
import { dfmFromMesh } from '../mold/dfm-mesh';
import { pickDrawAxis } from '../mold/draw-axis';
import { moldFactory, analyzeVariant, type Architecture } from '../mold/factory';
import { makeBox, volume, tessellate } from '../brep/occt';
// ── v3: pipeline del curso (stateful, opera sobre shapes vivos) ──
import {
  insertarPercha, escalaContraccion, layoutDosCavidades, lineaParticion,
  toolingSplitCurso, toolingSplitCursoCarve, guiasCurso,
} from '../mold/curso-flow';
import { flanera } from '../mold/flanera';
import { autoEjectionPlan } from '../mold/mold-ejection-auto';   // cerebro de auto-eyección

// ── Contexto: lo que un comando puede necesitar del mundo (OCCT, estado vivo) ──
export interface CommandCtx {
  oc?: unknown;                 // instancia OCCT (para comandos de geometría, v2)
}

export type CmdStatus = 'implementado' | 'parcial' | 'falta';

export interface Command {
  id: string;                   // 'clamp.force'
  domain: string;               // 'llenado'
  eq?: string;                  // 'Eq 5.29'
  status: CmdStatus;
  needsOc?: boolean;            // requiere ctx.oc
  summary: string;
  run: (params: Record<string, any>, ctx: CommandCtx) => any;
}

const REGISTRY = new Map<string, Command>();
const reg = (c: Command) => { REGISTRY.set(c.id, c); };

// material por defecto = ABS (el del banco Kazmer); overridable con params.m / params.material
const melt = (p: Record<string, any>): MeltMaterial => (p.m ?? p.material ?? ABS_MG47) as MeltMaterial;
const ejMat = (p: Record<string, any>): EjectionMaterial => (p.m ?? p.material ?? ABS_EJECT) as EjectionMaterial;

// ════════════════════════════════════════════════════════════════════════════
//  ALMACÉN DE HANDLES (v3) — el Shape OCCT NO es JSON: no puede cruzar la
//  frontera del bus. En vez del shape crudo, los comandos devuelven un HANDLE
//  opaco ('sh_7') y el bus guarda el shape aquí. Etapa N recibe el handle de la
//  etapa N-1 → el pipeline geométrico se vuelve componible por comando.
//  LIBERACIÓN EXPLÍCITA: el shape ocupa heap wasm; `shape.free`/`shape.clear`
//  llaman `.delete()` (si no, la pestaña se llena y revienta — como el fuse).
// ════════════════════════════════════════════════════════════════════════════
const SHAPES = new Map<string, { shape: any; meta: Record<string, any> }>();
let shapeSeq = 0;
function storeShape(shape: any, meta: Record<string, any> = {}): string {
  const id = `sh_${++shapeSeq}`;
  SHAPES.set(id, { shape, meta });
  return id;
}
function resolveShape(id: string): any {
  const e = SHAPES.get(id);
  if (!e) throw new Error(`shape '${id}' no existe — ¿lo liberaste, o es de otra sesión? (los handles son por-pestaña)`);
  return e.shape;
}
function freeShape(id: string): boolean {
  const e = SHAPES.get(id);
  if (!e) return false;
  try { e.shape?.delete?.(); } catch { /* ya liberado por el kernel */ }
  return SHAPES.delete(id);
}

// ════════════════════════════════════════════════════════════════════════════
//  REGISTRO — named params (los del doc) → llamada real (posicional/objeto)
// ════════════════════════════════════════════════════════════════════════════

// ── LLENADO (filling.ts) ──
reg({ id: 'fill.shearrate.newtonian', domain: 'llenado', eq: 'Eq 5.24', status: 'implementado',
  summary: 'γ̇ = 6v̄/H', run: (p) => shearRateNewtonian(p.vMean, p.hMeters) });
reg({ id: 'fill.shearrate.powerlaw', domain: 'llenado', eq: 'Eq 5.21', status: 'implementado',
  summary: 'γ̇ power-law', run: (p) => shearRatePowerLaw(p.vMean, p.hMeters, p.n) });
reg({ id: 'fill.velocity.recommended', domain: 'llenado', eq: 'Eq 5.23', status: 'implementado',
  summary: 'v̄ balance corte↔calor', run: (p) => recommendedVelocity(melt(p), p.muPaS) });
reg({ id: 'melt.viscosity', domain: 'llenado', eq: 'µ=k·γ̇^(n−1)', status: 'implementado',
  summary: 'viscosidad power-law', run: (p) => viscosityPowerLaw(melt(p), p.shearRate) });
reg({ id: 'fill.velocity.converge', domain: 'llenado', eq: 'p.105', status: 'implementado',
  summary: 'itera v̄→γ̇→µ→v̄', run: (p) => convergeVelocity(melt(p), p.hMeters, p.v0, p.iters) });
reg({ id: 'fill.pressuredrop.segment', domain: 'llenado', eq: 'Eq 5.22', status: 'implementado',
  summary: 'ΔP de un segmento', run: (p) => pressureDropSegment(melt(p), p.lMeters, p.hMeters, p.vMean) });
reg({ id: 'fill.pressure', domain: 'llenado', eq: 'Σ Eq 5.22', status: 'implementado',
  summary: 'ΔP total lay-flat', run: (p) => fillingPressure(melt(p), p.segments) });
reg({ id: 'fill.report', domain: 'llenado', eq: '§5', status: 'parcial',
  summary: 'v̄,γ̇,ΔP,F_clamp (packFactor escalar)',
  run: (p) => fillingReport(melt(p), { flowLengthM: p.flowLengthM, wallM: p.wallM, projectedAreaM2: p.projectedAreaM2, packFactor: p.packFactor }) });
reg({ id: 'clamp.force', domain: 'llenado', eq: 'Eq 5.29', status: 'implementado',
  summary: 'F = P·A', run: (p) => clampForceN(p.pCavityPa, p.aProjectedM2) });
reg({ id: 'clamp.tons', domain: 'llenado', eq: 'Eq 5.29', status: 'implementado',
  summary: 'F → ton métricas', run: (p) => clampMetricTons(p.pPa ?? p.pCavityPa, p.aM2 ?? p.aProjectedM2) });

// ── COLADA / runners (feed.ts) ──
reg({ id: 'runner.reynolds', domain: 'colada', eq: 'Eq 6.2', status: 'implementado',
  summary: 'Reynolds del runner', run: (p) => reynolds(p.rhoKgM3, p.VdotM3s, p.muPaS, p.dMeters) });
reg({ id: 'runner.shearrate', domain: 'colada', eq: 'Eq 6.4', status: 'implementado',
  summary: 'γ̇ del runner', run: (p) => shearRateRunner(p.VdotM3s, p.rMeters) });
reg({ id: 'runner.pressuredrop', domain: 'colada', eq: 'Eq 6.5', status: 'implementado',
  summary: 'ΔP power-law del runner', run: (p) => pressureDropRunner(melt(p), p.seg) });
reg({ id: 'feed.pressuredrop', domain: 'colada', eq: 'Σ Eq 6.5', status: 'implementado',
  summary: 'ΔP nozzle→gate', run: (p) => feedPressureDrop(melt(p), p.path) });
reg({ id: 'feed.volume', domain: 'colada', eq: 'Eq 6.6', status: 'implementado',
  summary: 'Σ count·L·πR² (desperdicio)', run: (p) => feedVolume(p.segments) });
reg({ id: 'runner.minradius', domain: 'colada', eq: 'Eq 6.8', status: 'implementado',
  summary: 'R mínimo para no exceder ΔP', run: (p) => minRunnerRadius(melt(p), p.L, p.VdotM3s, p.dPmaxPa) });

// ── GATES (gating.ts) ──
reg({ id: 'gate.types', domain: 'gates', eq: 'Tabla 7.1', status: 'implementado',
  summary: 'propiedades de un gate', run: (p) => (p.type ? (GATE_TABLE as any)[p.type] : GATE_TABLE) });
reg({ id: 'gate.shearrate.strip', domain: 'gates', eq: 'Tabla 7.2', status: 'implementado',
  summary: 'γ̇ = 6V̇/(Wh²)', run: (p) => shearRateStrip(p.VdotM3s, p.wM, p.hM) });
reg({ id: 'gate.shearrate.cyl', domain: 'gates', eq: 'Tabla 7.2', status: 'implementado',
  summary: 'γ̇ = 4V̇/(πR³)', run: (p) => shearRateCyl(p.VdotM3s, p.rM) });
reg({ id: 'gate.minradius', domain: 'gates', eq: '§7.3', status: 'implementado',
  summary: 'R = ∛(4V̇/πγ̇max)', run: (p) => gateRadiusForShear(p.VdotM3s, p.shearMax) });
reg({ id: 'gate.pressuredrop.strip', domain: 'gates', eq: 'Tabla 7.3', status: 'implementado',
  summary: 'ΔP strip power-law', run: (p) => gateDropStripPL(melt(p), p.L, p.W, p.H, p.Vdot) });
reg({ id: 'gate.pressuredrop.cyl', domain: 'gates', eq: 'Tabla 7.3', status: 'implementado',
  summary: 'ΔP cilíndrico newtoniano', run: (p) => gateDropCylNewt(p.muPaS, p.L, p.R, p.Vdot) });
reg({ id: 'gate.design', domain: 'gates', eq: '§7.3.1-2', status: 'implementado',
  summary: 'espesor + veredicto',
  run: (p) => gateDesign({ type: p.type, wallMm: p.wallMm, VdotM3s: p.VdotM3s, shearMaxS: p.shearMaxS, widthMm: p.widthMm }) });

// ── VENTEO (venting.ts) ──
reg({ id: 'vent.minThickness', domain: 'venteo', eq: '§8', status: 'implementado',
  summary: 'profundidad mín (que salga aire)', run: (p) => ventMinThickness(p.VdotAirM3s, p.lM, p.wM, p.dPPa) });
reg({ id: 'vent.maxThickness', domain: 'venteo', eq: '§8.2', status: 'implementado',
  summary: 'profundidad máx sin rebaba', run: (p) => ventMaxThickness(p.lFlashM, p.muMeltPaS, p.rampPaS, p.tFlashS) });
reg({ id: 'vent.design', domain: 'venteo', eq: '§8', status: 'implementado',
  summary: 'min+max+spec del venteo', run: (p) => ventDesign({ VdotAirM3s: p.VdotAirM3s, lM: p.lM, wM: p.wM, lFlashM: p.lFlashM }) });

// ── BALANCEO de paredes (flowleaders.ts) ──
reg({ id: 'flowleader.velocityratio', domain: 'balanceo', eq: 'Eq 5.32', status: 'implementado',
  summary: 'lR/lRef', run: (p) => flowLeaderVelocityRatio(p.lRegionMm, p.lRefMm) });
reg({ id: 'flowleader.thickness', domain: 'balanceo', eq: 'Eq 5.33', status: 'implementado',
  summary: 'engrosado del leader', run: (p) => flowLeaderThickness(p.hNominalMm, p.lRegionMm, p.lRefMm, p.muRatio) });
reg({ id: 'flowleader.design', domain: 'balanceo', eq: '§5.5.5', status: 'implementado',
  summary: 'balanceo de regiones', run: (p) => designFlowLeaders({ nominalMm: p.nominalMm, regions: p.regions, muRatio: p.muRatio }) });

// ── EXPULSIÓN (ejection.ts) ──
reg({ id: 'ejection.force.scalar', domain: 'expulsión', eq: 'Eq 11.7', status: 'implementado',
  summary: 'F = µ·cos(draft)·σ·A', run: (p) => ejectionForce(ejMat(p), p.draftDeg, p.aEffM2) });
reg({ id: 'ejection.vector.solve', domain: 'expulsión', eq: 'Fig 11.5', status: 'implementado',
  summary: 'balance Newton con peso g',
  run: (p) => ejectionVector(ejMat(p), { aEffM2: p.aEffM2, draftDeg: p.draftDeg, massKg: p.massKg, volM3: p.volM3, ejectAxis: p.ejectAxis, gravityDir: p.gravityDir, g: p.g }) });
reg({ id: 'ejectorpin.size', domain: 'expulsión', eq: 'Eq 11.10/11.12', status: 'implementado',
  summary: 'Ø mín del pin (fatiga+cortante)', run: (p) => ejectorPinSizing(ejMat(p), p.fEjectN, p.nPins, p.wallM, p.sigmaFatiguePa) });
reg({ id: 'ejection.plan', domain: 'expulsión', eq: '§11.2-5', status: 'implementado',
  summary: 'AUTO: figura → tipo (pin/stripper/sleeve) + fuerza + dimensionado',
  run: (p) => autoEjectionPlan({ kind: p.kind, Lmm: p.Lmm, Wmm: p.Wmm, Hmm: p.Hmm, wallMm: p.wallMm, draftDeg: p.draftDeg, round: p.round, boss: p.boss, rib: p.rib }, p.material ?? 'ABS') });

// ── MÁQUINA (machinesizing.ts) ──
reg({ id: 'machine.requirements', domain: 'máquina', eq: 'Eq 5.29+shot', status: 'implementado',
  summary: 'clamp+shot+presión+expulsión',
  run: (p) => machineRequirements({ projectedAreaM2: p.projectedAreaM2, cavityPressureMPa: p.cavityPressureMPa, partVolumeCc: p.partVolumeCc, nCav: p.nCav, runnerVolumeCc: p.runnerVolumeCc, fillPressureMPa: p.fillPressureMPa, ejectionForceN: p.ejectionForceN, clampSF: p.clampSF, pressureSF: p.pressureSF }) });

// ── 3 PLACAS (threeplate.ts) ──
reg({ id: 'mold.openingVelocity', domain: '3placas', eq: 'Tabla 6.1', status: 'implementado',
  summary: 'v = 184+13·log10(F)', run: (p) => moldOpeningVelocity(p.clampTons) });
reg({ id: 'threeplate.layout', domain: '3placas', eq: '§6.3.2', status: 'implementado',
  summary: 'stack + particiones A-B/A-X',
  run: (p) => threePlateLayout({ partHeightMm: p.partHeightMm, clampTons: p.clampTons, openFactorAB: p.openFactorAB, plates: p.plates }) });
reg({ id: 'feed.compare', domain: '3placas', eq: 'Tabla 6.1', status: 'implementado',
  summary: '2 vs 3 placas', run: (p) => compareFeedSystems({ twoPlate: p.twoPlate, threePlate: p.threePlate, clampTons: p.clampTons }) });

// ── PLACAS (platesizing.ts) ──
reg({ id: 'plate.snap', domain: 'placas', eq: 'catálogo', status: 'implementado',
  summary: 'espesor comercial ≥ t', run: (p) => snapToCommercialPlate(p.tMm) });
reg({ id: 'plate.support', domain: 'placas', eq: 'deflexión+pilares', status: 'implementado',
  summary: 'placa soporte óptima',
  run: (p) => optimizeSupportPlate({ clampTons: p.clampTons, spanM: p.spanM, widthM: p.widthM, ventGapM: p.ventGapM, ejectStrokeMm: p.ejectStrokeMm, maxPillars: p.maxPillars, pillarDiaMm: p.pillarDiaMm, pillarHeightMm: p.pillarHeightMm, ePa: p.ePa }) });
reg({ id: 'plate.cavity', domain: 'placas', eq: '3·Ø detrás', status: 'implementado',
  summary: 'espesor placa cavidad', run: (p) => sizeCavityPlate({ cavityDepthMm: p.cavityDepthMm, lineDiaMm: p.lineDiaMm, steelBehindDia: p.steelBehindDia }) });

// ── DFM (dfm.ts) ──
reg({ id: 'draft.forFinish', domain: 'dfm', eq: 'Tabla 2.14', status: 'implementado',
  summary: 'µm textura → draft recomendado', run: (p) => draftForFinish(p.roughnessUm) });
reg({ id: 'dfm.check', domain: 'dfm', eq: 'puerta 0', status: 'implementado',
  summary: 'moldeabilidad de la pieza',
  run: (p) => checkDFM(p as any) });   // DFMPart: {nominalWallMm, surface{roughnessUm}, draftDeg?, ribs?, …}
reg({ id: 'dfm.fromMesh', domain: 'dfm', eq: '§2', status: 'implementado',
  summary: 'veredicto moldeable desde malla',
  run: (p) => dfmFromMesh(p.mesh, p.o ?? { finish: p.finish, resin: p.resin, wallMm: p.wallMm }) });
reg({ id: 'part.pickDrawAxis', domain: 'dfm', eq: 'orientación', status: 'implementado',
  summary: 'eje de desmoldeo que minimiza undercuts',
  run: (p) => pickDrawAxis(p.mesh, { wallMm: p.wallMm }) });

// ── TECNOLOGÍA (moldtech.ts) ──
reg({ id: 'tech.choose', domain: 'tecnología', eq: '§12', status: 'implementado',
  summary: 'undercuts/roscas → tecnología de molde',
  run: (p) => chooseMoldTechnology({
    externalUndercut: p.externalUndercut, internalThread: p.internalThread,
    fullyAestheticSurface: p.fullyAestheticSurface, sideUndercut: p.sideUndercut,
    internalCollapsible: p.internalCollapsible }) });

// ── ORQUESTADOR (moldmachine.ts) — LA ANTORCHA: spec del cliente → molde completo ──
reg({ id: 'mold.machine', domain: 'orquestador', eq: 'cap 4-12', status: 'implementado',
  summary: 'spec numérico → molde + cotización + máquina + precio',
  run: (p) => moldMachine({
    name: p.name ?? 'pieza', Lmm: p.Lmm, Wmm: p.Wmm, Hmm: p.Hmm,
    cavityShape: p.cavityShape, surfaceMm2: p.surfaceMm2, volumeMm3: p.volumeMm3, wallMm: p.wallMm,
    annualVolume: p.annualVolume, totalVolume: p.totalVolume, plastic: p.plastic, finish: p.finish,
    machiningRateUSDh: p.machiningRateUSDh, dfm: p.dfm, abrasive: p.abrasive, corrosive: p.corrosive,
    mirror: p.mirror, undercuts: p.undercuts, margin: p.margin,
  } as MachineSpec) });

// ── FÁBRICA (factory.ts) — GEOMETRÍA (needsOc): arma la caja de dims y barre variantes ──
const buildPart = (p: Record<string, any>, ctx: CommandCtx) => {
  const oc = ctx.oc as any;
  const shape = makeBox(oc, p.Lmm, p.Wmm, p.Hmm);     // el comando construye su propia geometría
  return { name: p.name ?? 'pieza', shape, wallMm: p.wallMm, flowLenMm: p.flowLenMm,
    projAreaMm2: p.projAreaMm2 ?? p.Lmm * p.Wmm, annualVolume: p.annualVolume, undercuts: p.undercuts } as any;
};
reg({ id: 'factory.generate', domain: 'orquestador', eq: 'factory', status: 'implementado', needsOc: true,
  summary: 'barre arch×cav y elige la más barata',
  run: (p, ctx) => moldFactory(ctx.oc as any, buildPart(p, ctx), { archs: p.archs, cavityOptions: p.cavityOptions }) });
reg({ id: 'variant.analyze', domain: 'orquestador', eq: 'factory', status: 'implementado', needsOc: true,
  summary: 'analiza UNA variante arch/cav',
  run: (p, ctx) => analyzeVariant(ctx.oc as any, buildPart(p, ctx), (p.arch ?? 'cold-2placas') as Architecture, p.cav ?? 1) });

// ── PRODUCTO: la flanera (flanera.ts) — vaso PP de revolución → handle ──
reg({ id: 'part.flanera', domain: 'producto', eq: 'revolución', status: 'implementado', needsOc: true,
  summary: 'vaso de flanera PP paramétrico (Ø/H/pared) → handle',
  run: (p, ctx) => { const r = flanera(ctx.oc as any, { rimDia: p.rimDia, baseDia: p.baseDia, height: p.height, wall: p.wall, lipWidth: p.lipWidth, lipThk: p.lipThk, bottomThk: p.bottomThk });
    return { shapeId: storeShape(r.shape, { vol: r.volMm3, stage: 'flanera' }), volMm3: r.volMm3, draftDeg: r.draftDeg, report: r.report }; } });

// ── CURSO (curso-flow.ts) — PIPELINE geométrico por handles (v3) ──
//    Cada etapa consume el handle de la anterior y devuelve uno nuevo + resumen JSON.
reg({ id: 'curso.percha', domain: 'curso', eq: 'PROCESO-0', status: 'implementado', needsOc: true,
  summary: 'modela la percha real → handle',
  run: (p, ctx) => { const r = insertarPercha(ctx.oc as any);
    return { shapeId: storeShape(r.shape, { vol: r.volMm3, stage: 'percha' }), volMm3: r.volMm3, report: r.report }; } });
reg({ id: 'curso.escala', domain: 'curso', eq: '§4', status: 'implementado', needsOc: true,
  summary: 'escala por contracción (×1.015) un handle',
  run: (p, ctx) => { const r = escalaContraccion(ctx.oc as any, resolveShape(p.shape), p.factor ?? 1.015);
    return { shapeId: storeShape(r.shape, { vol: r.volDespues, stage: 'escala' }), volAntes: r.volAntes, volDespues: r.volDespues, report: r.report }; } });
reg({ id: 'curso.layout', domain: 'curso', eq: '§10', status: 'implementado', needsOc: true,
  summary: 'acomoda 2 cavidades → 2 handles',
  run: (p, ctx) => { const r = layoutDosCavidades(ctx.oc as any, resolveShape(p.shape));
    return { shapeIds: r.cuerpos.map((s, i) => storeShape(s, { stage: `cuerpo${i + 1}` })), sinTraslape: (r as any).sinTraslape, volTotal: (r as any).volTotal, report: r.report }; } });
reg({ id: 'curso.parting', domain: 'curso', eq: 'Parting Lines', status: 'implementado', needsOc: true,
  summary: 'detecta la línea de partición (gate del curso)',
  run: (p, ctx) => { const bodies = (p.bodies as string[]).map(resolveShape);
    const r = lineaParticion(ctx.oc as any, bodies); return { ok: (r as any).ok, nVertices: (r as any).nVertices, report: r.report }; } });
reg({ id: 'curso.split', domain: 'curso', eq: 'Tooling Split', status: 'implementado', needsOc: true,
  summary: 'parte núcleo/cavidad (plano→handles · curvo→mallas)',
  run: (p, ctx) => {
    const bodies = (p.bodies as string[]).map(resolveShape);
    try {                                                       // 1º intenta PLANO (devuelve shapes → handles)
      const r = toolingSplitCurso(ctx.oc as any, bodies);
      return { mode: 'plano', cavityId: storeShape(r.cavityPlate, { stage: 'cavity' }), coreId: storeShape(r.corePlate, { stage: 'core' }), vols: (r as any).vols, report: r.report };
    } catch {                                                    // partición CURVA → heightfield (mallas, no shapes)
      const c = toolingSplitCursoCarve(ctx.oc as any, bodies);
      return { mode: 'carve', dims: c.dims, deltaZ: (c as any).deltaZ, cavVerts: c.cavMesh.positions.length / 3, coreVerts: c.coreMesh.positions.length / 3, report: (c as any).report, nota: 'partición CURVA → mallas; véelas en la UI (no hay shape que encadenar a curso.guias)' };
    }
  } });
reg({ id: 'curso.guias', domain: 'curso', eq: '§Guías', status: 'implementado', needsOc: true,
  summary: 'bushings/pernos guía en cavity+core (requiere split PLANO)',
  run: (p, ctx) => { const r = guiasCurso(ctx.oc as any, resolveShape(p.cavity), resolveShape(p.core), p.opts);
    return { cavityId: storeShape(r.cavity, { stage: 'cavity+guias' }), coreId: storeShape(r.core, { stage: 'core+guias' }), volQuitadoCav: r.volQuitadoCav, volQuitadoCore: r.volQuitadoCore, report: r.report }; } });

// ── SHAPE — ciclo de vida de los handles (v3) ──
reg({ id: 'shape.list', domain: 'shape', status: 'implementado',
  summary: 'lista los handles vivos + su meta',
  run: () => Array.from(SHAPES.entries()).map(([id, e]) => ({ id, meta: e.meta })) });
reg({ id: 'shape.meta', domain: 'shape', status: 'implementado',
  summary: 'meta de un handle', run: (p) => SHAPES.get(p.id)?.meta ?? null });
reg({ id: 'shape.volume', domain: 'shape', status: 'implementado', needsOc: true,
  summary: 'volumen real (mm³) de un handle', run: (p, ctx) => volume(ctx.oc as any, resolveShape(p.id)) });
reg({ id: 'shape.mesh', domain: 'shape', status: 'implementado', needsOc: true,
  summary: 'tesela un handle → {positions, indices} para previsualizar',
  run: (p, ctx) => { const m = tessellate(ctx.oc as any, resolveShape(p.id), p.deflection ?? 0.5, p.deflection ?? 0.5);
    return { positions: Array.from(m.positions as any), indices: Array.from(m.indices as any) }; } });
reg({ id: 'shape.free', domain: 'shape', status: 'implementado',
  summary: 'libera 1+ handles (.delete() en wasm)',
  run: (p) => { const ids: string[] = p.ids ?? (p.id ? [p.id] : []); const freed = ids.filter(freeShape); return { freed, n: freed.length }; } });
reg({ id: 'shape.clear', domain: 'shape', status: 'implementado',
  summary: 'libera TODOS los handles (higiene de memoria)',
  run: () => { const ids = Array.from(SHAPES.keys()); ids.forEach(freeShape); return { freed: ids.length }; } });

// ════════════════════════════════════════════════════════════════════════════
//  API DEL BUS
// ════════════════════════════════════════════════════════════════════════════

/** Invoca un comando por id con params nombrados. Lanza si no existe / es hueso / falta oc. */
export function run(id: string, params: Record<string, any> = {}, ctx: CommandCtx = {}): any {
  const cmd = REGISTRY.get(id);
  if (!cmd) {
    const near = list().filter((c) => c.id.startsWith(id.split('.')[0])).map((c) => c.id).slice(0, 6);
    throw new Error(`comando desconocido: '${id}'${near.length ? ` — ¿quisiste ${near.join(', ')}?` : ''}`);
  }
  if (cmd.status === 'falta') throw new Error(`'${id}' es un hueso pelón (status=falta): aún no implementado`);
  if (cmd.needsOc && !ctx.oc) throw new Error(`'${id}' requiere OCCT — pásalo en ctx.oc`);
  return cmd.run(params, ctx);
}

/** ¿existe el comando? */
export function has(id: string): boolean { return REGISTRY.has(id); }

/** Metadatos de un comando (sin ejecutarlo). */
export function describe(id: string): Omit<Command, 'run'> | null {
  const c = REGISTRY.get(id); if (!c) return null;
  const { run: _run, ...meta } = c; return meta;
}

/** Catálogo (para que un agente descubra el vocabulario). Filtra por dominio/status. */
export function list(filter?: { domain?: string; status?: CmdStatus }): Array<Omit<Command, 'run'>> {
  let cs = Array.from(REGISTRY.values());
  if (filter?.domain) cs = cs.filter((c) => c.domain === filter.domain);
  if (filter?.status) cs = cs.filter((c) => c.status === filter.status);
  return cs.map(({ run: _r, ...m }) => m).sort((a, b) => a.id.localeCompare(b.id));
}

/** Resumen del registro (dominios, conteo por status). */
export function stats() {
  const all = Array.from(REGISTRY.values());
  const byStatus = all.reduce((o, c) => ((o[c.status] = (o[c.status] ?? 0) + 1), o), {} as Record<string, number>);
  const domains = [...new Set(all.map((c) => c.domain))].sort();
  return { total: all.length, byStatus, domains };
}

export const forjaCommands = { run, has, describe, list, stats };
