/**
 * SET DE PLANOS DEL MOLDE — motor compartido CLI + UI ("lo mismo con puros clicks").
 * ==============================================================================
 * Un solo motor que arma TODAS las láminas del molde (ensamble + análisis + cada
 * placa con planta acotada + 4 vistas a color + pieza), reutilizable desde:
 *   · el generador de PDF por línea de comandos (scripts/mold-pdf-gen.cjs), y
 *   · el navegador (MoldMachinePanel → botón GENERAR PLANOS → imprimir a PDF).
 * Las funciones que tocan el kernel reciben (K, oc) como parámetros → el módulo NO
 * importa OCCT (se mantiene puro-importable; el llamador pasa el kernel activo).
 *
 * Además mapea el paquete de la MÁQUINA DE MOLDES (MachineSpec → MoldPackage) a la
 * geometría de placas (MoldAssemblySpec), para que el cliente sólo suba su pieza y
 * obtenga el juego de planos completo, sin teclear cotas de molde.
 */
import type { MoldPackage } from './moldmachine';
import type { MoldAssemblySpec } from './mold-assembly';
import {
  moldDrawingSet, plateDefs, plateDepth, standardHoles, holeLegend, cavityGrid, coolingCircuit,
  type DrawingPage, type AnalysisRow, type PlateDef,
} from './mold-drawing-set';
import { generateDrawing } from '../brep/drawing';
import { partSheet4View, type IsoStyle } from '../brep/isoview';

// ── PALETA de materiales (idéntica al PDF): acero azul-gris, plástico ámbar ──
const STEEL: [number, number, number] = [150, 165, 185];
export const platePartStyle = (role: PlateDef['role']): IsoStyle =>
  role === 'A' || role === 'B'
    ? { color: STEEL, opacity: 0.6, edgeColor: '#18202c' }   // cavidad/núcleo: translúcida
    : { color: STEEL, edgeColor: '#12161c' };
export const PART_STYLE: IsoStyle = { color: [224, 122, 48], opacity: 0.55, edgeColor: '#5a2a10' };

/** Construye una PLACA como SÓLIDO del kernel: caja + apertura de cavidad (A/B) +
 *  barrenos estándar pasantes. `K` = módulo occt, `oc` = instancia activa. */
export function buildPlateSolid(K: any, oc: any, spec: MoldAssemblySpec, def: PlateDef, detail: 'full' | 'blocks' = 'full'): { solid: any; drilled: number; holes: number } {
  const W = spec.widthMm, D = plateDepth(spec), t = def.thick;
  let solid = K.makeBox(oc, W, D, t);
  if (def.role === 'A' || def.role === 'B') {
    const cw = spec.cavity.widthMm, cd = spec.cavity.lenMm ?? Math.round(cw * 0.67);
    // TODAS las cavidades del grid (multi-cavidad), círculo o caja
    for (const cell of cavityGrid(spec, D)) {
      try {
        const tool = spec.cavity.shape === 'round'
          ? K.makeCylinder(oc, cw / 2, t + 2, { origin: [cell.cx, cell.cy, -1], dir: [0, 0, 1] })
          : K.extrudePolygon(oc, [
            { x: cell.cx - cw / 2, y: cell.cy - cd / 2 }, { x: cell.cx + cw / 2, y: cell.cy - cd / 2 },
            { x: cell.cx + cw / 2, y: cell.cy + cd / 2 }, { x: cell.cx - cw / 2, y: cell.cy + cd / 2 },
          ], t + 2, K.offsetPlane(K.PLANE_XY, -1));
        solid = K.cut(oc, solid, tool);
      } catch { /* una cavidad que falla no aborta la placa */ }
    }
    // CANALES DE AGUA REALES (sólo en 'full' — es lo más caro en booleanas)
    if (detail === 'full') try {
      const cc = coolingCircuit(spec, D);
      const zc = Math.max(cc.diaMm, Math.min(t - cc.diaMm, t - cc.zBehindMm));
      for (const g of cc.segs) if (g.y0 === g.y1) {
        const len = Math.abs(g.x1 - g.x0) + 6;
        const tool = K.makeCylinder(oc, cc.diaMm / 2, len, { origin: [Math.min(g.x0, g.x1) - 3, g.y0, zc], dir: [1, 0, 0] });
        solid = K.cut(oc, solid, tool);
      }
    } catch { /* canal que falla se omite */ }
  }
  // barrenos: en 'blocks' sólo los grandes (pilares/tornillos ⌀≥10) para ir rápido
  const list = standardHoles(spec, def.role).filter((h) => detail === 'full' || h.dia >= 10);
  let drilled = 0;
  for (const h of list) {
    try { solid = K.drillHole(oc, solid, { x: h.x, y: h.y, diameter: h.dia, zTop: t, depth: t, through: true }); drilled++; }
    catch { /* barreno que no cabe: se omite */ }
  }
  return { solid, drilled, holes: list.length };
}

/** Z de cada placa en el stack (cota inferior). */
export function plateStackZ(spec: MoldAssemblySpec): Record<string, number> {
  const p = spec.plates;
  return {
    bottom: 0,
    ejector: p.bottomClamp + 4,
    support: p.bottomClamp + p.ejectorHousing,
    B: p.bottomClamp + p.ejectorHousing + p.support,
    A: p.bottomClamp + p.ejectorHousing + p.support + p.B,
    clamp: p.bottomClamp + p.ejectorHousing + p.support + p.B + p.A,
  };
}

export interface MoldPart {
  role: string; name: string; material: string;
  positions: Float32Array; normals: Float32Array; indices: Uint32Array;
  color: string; opacity: number;
}

/** El molde como COMPONENTES separados (una malla por placa) — para el árbol de
 *  La Forja: aislar / ocultar / opacidad, como Fusion/SolidWorks. Cada placa se
 *  construye con las primitivas y se posiciona en su cota Z. */
export function buildMoldParts(K: any, oc: any, spec: MoldAssemblySpec, detail: 'full' | 'blocks' = 'blocks'): MoldPart[] {
  const z = plateStackZ(spec);
  const STEEL = '#9aa6ba', CAV = '#7f93b0';
  const out: MoldPart[] = [];
  for (const def of plateDefs(spec)) {
    try {
      const { solid } = buildPlateSolid(K, oc, spec, def, detail);
      const z0 = z[def.role] ?? 0;
      const placed = z0 ? K.transformShape(oc, solid, { translate: [0, 0, z0] }) : solid;
      const m = K.tessellate(oc, placed, detail === 'full' ? 0.25 : 0.45, 0.5);
      const isCav = def.role === 'A' || def.role === 'B';
      out.push({ role: def.role, name: def.name, material: def.mat, positions: m.positions, normals: m.normals, indices: m.indices, color: isCav ? CAV : STEEL, opacity: isCav ? 0.55 : 1 });
    } catch { /* placa que falla se omite */ }
  }
  return out;
}

/** ENSAMBLE del molde como SÓLIDO 3D — apila las placas (cada una construida con
 *  las primitivas del kernel: makeBox/cut/makeCylinder) en su cota Z y las junta en
 *  un compound. Se construye DENTRO de La Forja (browser), sin STEP. `detail`:
 *  'full' = cavidades+agua+expulsores en A/B; 'blocks' = placas con sólo aberturas
 *  (mucho más rápido para el visor en vivo). */
export function buildMoldAssembly(K: any, oc: any, spec: MoldAssemblySpec, detail: 'full' | 'blocks' = 'full'): any {
  const p = spec.plates;
  const zBase: Record<string, number> = {
    bottom: 0,
    ejector: p.bottomClamp + 4,
    support: p.bottomClamp + p.ejectorHousing,
    B: p.bottomClamp + p.ejectorHousing + p.support,
    A: p.bottomClamp + p.ejectorHousing + p.support + p.B,
    clamp: p.bottomClamp + p.ejectorHousing + p.support + p.B + p.A,
  };
  const shapes: any[] = [];
  for (const def of plateDefs(spec)) {
    try {
      const { solid } = buildPlateSolid(K, oc, spec, def, detail);
      const z0 = zBase[def.role] ?? 0;
      shapes.push(z0 ? K.transformShape(oc, solid, { translate: [0, 0, z0] }) : solid);
    } catch { /* una placa que falla no aborta el ensamble */ }
  }
  return K.makeCompound(oc, shapes);
}

/** 4 vistas (3 ortográficas HLR + isométrico sombreado a color) de un sólido. */
export function fourViewSheet(K: any, oc: any, solid: any, meta: { name: string; code?: string; material?: string }, style: IsoStyle, deflLin = 0.2, legend: string[] = []): string {
  const mesh = K.tessellate(oc, solid, deflLin, 0.4);
  const edges = K.enumerateEdgesGeom(oc, solid).map((e: any) => ({ polyline: e.polyline, kind: e.kind }));
  const three = generateDrawing({ positions: mesh.positions, indices: mesh.indices, edges }, { ...meta, units: 'mm' });
  return partSheet4View(three.svg,
    { positions: mesh.positions, indices: mesh.indices, normals: mesh.normals, edges },
    { ...meta, units: 'mm' }, style, legend);
}

/** ARMA TODAS las láminas del molde (ensamble + análisis + placas con 4 vistas +
 *  pieza opcional). Es el motor único: el CLI y la UI llaman aquí. */
export function buildMoldLaminas(
  K: any, oc: any, spec: MoldAssemblySpec, analysisRows?: AnalysisRow[], partSolid?: any,
): DrawingPage[] {
  const set = moldDrawingSet(spec, analysisRows);
  const defs = plateDefs(spec);
  const head = set.pages.slice(0, set.pages.length - defs.length);      // Ensamble, Análisis
  const flatPlans = set.pages.slice(set.pages.length - defs.length);    // planos planos, orden de defs
  const pages: DrawingPage[] = [...head];
  defs.forEach((def, i) => {
    pages.push(flatPlans[i]);                                           // planta acotada + tabla
    try {
      const { solid } = buildPlateSolid(K, oc, spec, def);
      const legend = holeLegend(standardHoles(spec, def.role));
      const svg = fourViewSheet(K, oc, solid, { name: def.name, code: def.code, material: def.mat }, platePartStyle(def.role), 0.2, legend);
      pages.push({ name: `${def.name} · 4 vistas`, svg });
    } catch { /* placa sin 4 vistas: sigue el set */ }
  });
  if (partSolid) {
    try {
      const svg = fourViewSheet(K, oc, partSolid, { name: spec.name, code: spec.code, material: 'ABS' }, PART_STYLE, 0.1);
      pages.push({ name: 'Pieza moldeada · 4 vistas', svg });
    } catch { /* pieza sin vistas */ }
  }
  return pages;
}

/** Documento HTML imprimible (A3 apaisado) con todas las láminas → el navegador
 *  lo abre y llama print() → PDF. "Lo mismo con puros clicks". */
export function laminasToPrintHTML(pages: DrawingPage[], title = 'Planos del molde · La Forja'): string {
  const style = `@page{size:A3 landscape;margin:0}html,body{margin:0;padding:0;background:#fff}` +
    `.pg{page-break-after:always;width:420mm;height:297mm;display:flex;align-items:center;justify-content:center;overflow:hidden}` +
    `.pg:last-child{page-break-after:auto}.pg svg{width:100%;height:100%}`;
  const body = pages.map((p) => `<div class="pg">${p.svg}</div>`).join('');
  return `<!doctype html><html><head><meta charset="utf8"><title>${title}</title><style>${style}</style></head>` +
    `<body>${body}<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script></body></html>`;
}

/** MAPEA el paquete de la Máquina de Moldes (pieza del cliente → molde óptimo) a la
 *  geometría de placas para los planos. Toma cotas RESUELTAS (base comercial,
 *  espesores por deflexión/enfriamiento, plug DME, pines) — no inventa. */
export function packageToAssemblySpec(pkg: MoldPackage): MoldAssemblySpec {
  const s = pkg.spec, d = pkg.diseno, base = pkg.base.base;
  const support = Math.round(d.placas.soporte.plateThkMm ?? 46);
  const cavPlate = Math.round(d.placas.cavidad.plateThkMm ?? 56);
  const line = d.enfriamiento.lineas;
  const nCav = pkg.recomendacion.nCav;
  const win = pkg.variantes.find((v) => v.arch === pkg.recomendacion.arch && v.nCav === nCav);
  const code = 'MLD-' + (s.name || 'PIEZA').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return {
    name: `Molde ${s.name}`, code,
    widthMm: Math.round(base.wmm) || Math.round(s.Lmm * 1.6),
    plates: {
      bottomClamp: 36, ejectorHousing: 66,
      support, B: cavPlate, A: cavPlate, topClamp: 36,
    },
    supportPillars: d.placas.soporte.nPillars,
    cavity: { widthMm: Math.round(s.Lmm), lenMm: Math.round(s.Wmm), depthMm: Math.round(s.Hmm), shape: 'rect' },
    // ⌀ de agua con PISO maquinable (~6.35 mm mínimo real); nunca el ⌀ físico
    // diminuto de piezas chicas (inmaquinable). Plug DME estándar por defecto.
    cooling: { diaMm: Math.max(6.35, +(line.plug?.diaMm ?? line.dMinMm).toFixed(2)), plug: line.plug?.dme ?? 'JP-251', insetMm: Math.round((base.wmm || s.Lmm) * 0.15) },
    ejectors: { type: 'pin', diaMm: +Math.max(2, d.expulsion.pines.dMinMm).toFixed(2), count: Math.max(4, 4 * nCav) },
    core: { widthMm: Math.round(s.Lmm), material: pkg.metal.metal.key },
    cavityMetal: pkg.metal.metal.key, baseSteel: '1.1730 (C45)',
    machine: pkg.maquina?.nombre, clampTons: win ? Math.round(win.clampTons) : undefined,
    feed: pkg.recomendacion.arch, nCav,            // colada caliente/fría + nº de cavidades (drops)
    // undercut lateral del cliente → MOVIMIENTO (§11.3.6-8): presión de fusión REAL del diseño
    sideAction: s.undercuts?.[0]
      ? { aProjMm2: s.undercuts[0].aProjMm2, pMeltMPa: Math.round(d.fillMPa || d.cavityMPa || 80), strokeMm: s.undercuts[0].strokeMm, note: 'undercut lateral del cliente' }
      : undefined,
  };
}
