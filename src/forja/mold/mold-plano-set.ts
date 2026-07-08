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
  moldDrawingSet, plateDefs, plateDepth, standardHoles, holeLegend,
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
export function buildPlateSolid(K: any, oc: any, spec: MoldAssemblySpec, def: PlateDef): { solid: any; drilled: number; holes: number } {
  const W = spec.widthMm, D = plateDepth(spec), t = def.thick;
  let solid = K.makeBox(oc, W, D, t);
  if (def.role === 'A' || def.role === 'B') {
    const cx = W / 2, cy = D / 2;
    try {
      let tool;
      if (spec.cavity.shape === 'round') {
        tool = K.makeCylinder(oc, spec.cavity.widthMm / 2, t + 2, { origin: [cx, cy, -1], dir: [0, 0, 1] });
      } else {
        const cw = spec.cavity.widthMm, cd = spec.cavity.lenMm ?? Math.round(cw * 0.67);
        tool = K.extrudePolygon(oc, [
          { x: cx - cw / 2, y: cy - cd / 2 }, { x: cx + cw / 2, y: cy - cd / 2 },
          { x: cx + cw / 2, y: cy + cd / 2 }, { x: cx - cw / 2, y: cy + cd / 2 },
        ], t + 2, K.offsetPlane(K.PLANE_XY, -1));
      }
      solid = K.cut(oc, solid, tool);
    } catch { /* si la apertura falla, la placa queda sólida */ }
  }
  const list = standardHoles(spec, def.role);
  let drilled = 0;
  for (const h of list) {
    try { solid = K.drillHole(oc, solid, { x: h.x, y: h.y, diameter: h.dia, zTop: t, depth: t, through: true }); drilled++; }
    catch { /* barreno que no cabe: se omite */ }
  }
  return { solid, drilled, holes: list.length };
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
