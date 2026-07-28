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
  cavityFootprint, moldBoltSizing,
  insertDims,
  type DrawingPage, type AnalysisRow, type PlateDef } from './mold-drawing-set';
import { resolveThread, threadSurfaceMesh, plainShaftMesh, type Mesh as ThreadMesh } from './mold-threads';
import { resolveHead, headMesh, seatSpec, tipChamfer } from './mold-heads';
import { engagementLengthMm, plateYieldMPa, fastenerPlan } from './mold-fasteners';
import { pillarClearanceFit, guideGeom } from './fits';   // tolerancias LITERALES del libro (no inventar)
import { autoEjectionPlan } from './mold-ejection-auto';  // el CEREBRO §11: pin/blade/sleeve/STRIPPER desde la figura
// UNA fuente de verdad para el tamaño del inserto (§4.2.2): la misma que dimensiona la base
import { sizeInserts } from './moldbase';
import { planInterlocks } from './mold-interlocks';
import { generateDrawing } from '../brep/drawing';
import { partSheet4View, type IsoStyle } from '../brep/isoview';
import { dfmFromMesh } from './dfm-mesh';
import { planSideActions, planFromSpec, sideActionVerdicts, type SideActionPlan } from './mold-sideaction-gen';
import { sprueDesignFromCavity, estPartVolumeCc } from './feed';
import { layoutForGrid, flowTForSegs } from './feed-layouts';

// ── PALETA de materiales (idéntica al PDF): acero azul-gris, plástico ámbar ──
const STEEL: [number, number, number] = [150, 165, 185];
export const platePartStyle = (role: PlateDef['role']): IsoStyle =>
  role === 'A' || role === 'B'
    ? { color: STEEL, opacity: 0.6, edgeColor: '#18202c' }   // cavidad/núcleo: translúcida
    : { color: STEEL, edgeColor: '#12161c' };
export const PART_STYLE: IsoStyle = { color: [224, 122, 48], opacity: 0.55, edgeColor: '#5a2a10' };

/** Construye una PLACA como SÓLIDO del kernel: caja + apertura de cavidad (A/B) +
 *  barrenos estándar pasantes. `K` = módulo occt, `oc` = instancia activa. */
// POSICIONES de los PILARES DE SOPORTE (Kazmer §12.2.3): reducen la deflexión de placa,
// van DIRECTO bajo las zonas de fuerza de la cavidad PERO su ubicación CHOCA con los pines
// eyectores y el vástago KO — el libro dice AJUSTAR EL LAYOUT para librarlos. Esta función
// es la ÚNICA fuente: LEE los obstáculos (pines/return/KO/tornillos del housing) y coloca
// los pilares en el HUECO más cercano al centro que los libra → "todo se habla con todo".
// La usan el COMPONENTE (pilares-soporte) Y las holguras de las placas expulsoras.
export function supportPillarPositions(spec: MoldAssemblySpec, D: number): Array<{ x: number; y: number }> {
  // EL ESTUDIO MANDA: `optimizeSupportPlate` (§12.2, δ=F·L³/48EI) ya calculó CUÁNTOS pilares
  // se necesitan según la deflexión de la placa vs el venteo — y puede ser CERO (molde chico
  // y rígido NO los necesita). Antes la geometría clavaba 2 SIEMPRE, ignorando el cálculo
  // (feedback del user: "no está calculado el estrés → está mal"). Aquí respetamos el número.
  const nWanted = Math.max(0, Math.round(spec.supportPillars ?? 0));
  if (nWanted === 0) return [];                                  // la placa aguanta sola: sin pilares
  const W = spec.widthMm, pillarR = 20;
  const obstacles = standardHoles(spec, 'support').map((h) => ({ x: h.x, y: h.y, r: h.dia / 2 }));
  const clears = (x: number, y: number) => obstacles.every((o) => Math.hypot(x - o.x, y - o.y) >= pillarR + o.r + 3);
  const cx0 = W / 2, cy0 = D / 2;
  const cands: Array<{ x: number; y: number; d: number }> = [];
  for (let fx = 0.26; fx <= 0.74; fx += 0.02) for (const fy of [0.3, 0.42, 0.5, 0.58, 0.7]) {
    const x = Math.round(W * fx), y = Math.round(D * fy);
    if (x < 75 || x > W - 75) continue;                          // dentro de los rieles del housing
    if (clears(x, y)) cands.push({ x, y, d: Math.hypot(x - cx0, y - cy0) });   // libra pines+KO
  }
  cands.sort((a, b) => a.d - b.d);                               // los más cerca del centro (bajo la fuerza, §12.2.3)
  const chosen: Array<{ x: number; y: number }> = [];
  for (const c of cands) { if (chosen.every((k) => Math.hypot(c.x - k.x, c.y - k.y) > 55)) chosen.push({ x: c.x, y: c.y }); if (chosen.length >= nWanted) break; }
  return chosen;
}

export function buildPlateSolid(K: any, oc: any, spec: MoldAssemblySpec, def: PlateDef, detail: 'full' | 'blocks' = 'full', ext = 0, shaveMm = 0): { solid: any; drilled: number; holes: number } {
  const W = spec.widthMm, D = plateDepth(spec), t = def.thick;
  // ext = oreja de sujeción (Fig 1.4): la placa de los extremos SOBRESALE `ext` mm en
  // ±X (los DOS lados de montaje, no los cuatro) y lleva la RANURA DE SUJECIÓN fresada
  // ("toe clamps are inserted in SLOTS MILLED in the top and rear clamp plates").
  // shaveMm = rasurado ANTI-Z-FIGHT: décimas distintas por placa para que las caras
  // laterales de placas apiladas NO sean coplanares (el borde aserrado del render).
  const s = shaveMm;
  let solid = ext > 0
    ? K.transformShape(oc, K.makeBox(oc, W + 2 * ext - 2 * s, D - 2 * s, t), { translate: [-ext + s, s, 0] })
    : K.transformShape(oc, K.makeBox(oc, W - 2 * s, D - 2 * s, t), { translate: [s, s, 0] });
  if (ext > 0) {
    // clamp slot (Fig 1.4): ranura ANGOSTA a lo largo de Y en cada oreja, en la CARA
    // que toca la platina, con material SÓLIDO a ambos lados (antes era tan ancha que
    // la pared exterior de 3 mm parecía una aleta flotante — feedback del user).
    const land = Math.max(8, Math.round(ext * 0.3));            // hombro sólido exterior
    const sw = Math.max(10, Math.round(ext * 0.45));            // ancho de la ranura
    const sd = Math.max(6, Math.round(t * 0.35));               // profundidad
    const zSlot = def.role === 'clamp' ? t - sd : -0.5;
    for (const x0 of [-ext + land, W + ext - land - sw]) {
      try { solid = K.cut(oc, solid, K.transformShape(oc, K.makeBox(oc, sw, D + 2, sd + 0.5), { translate: [x0, -1, zSlot] })); } catch { /* ranura opcional */ }
    }
  }
  // La PLACA EXPULSORA vive DENTRO del housing (entre los rieles): más angosta que el
  // molde (Fig 1.4/1.5 — el housing en U deja verla por los costados abiertos).
  if (def.role === 'ejector' || def.role === 'ejector-ret') {
    solid = K.transformShape(oc, K.makeBox(oc, W - 130, D - 40, t), { translate: [65, 20, 0] });
    // LIBRAMIENTO de los SUPPORT PILLARS (Fig 1.6): las placas expulsoras SUBEN Y BAJAN
    // por los pilares ⌀40 (en W·0.35 y W·0.65) — sin este barreno el pilar y la placa
    // ocupan el mismo acero (imposible). Holgura REAL de fits.ts (no inventada).
    const pillarClearR = pillarClearanceFit(40).holeDiaMm / 2;   // ⌀40 + holgura del libro
    for (const pp of supportPillarPositions(spec, D)) {           // MISMA fuente que el componente
      try { solid = K.cut(oc, solid, K.makeCylinder(oc, pillarClearR, t + 2, { origin: [pp.x, pp.y, -1], dir: [0, 0, 1] })); }
      catch { /* holgura opcional (no aborta la placa) */ }
    }
  }
  // ── STRIPPER (§11.3.4): la "B" es el ANILLO EXPULSOR — sin bolsa de inserto, sin
  //    agua (flota); lleva el BORE deslizante que abraza el LAND del núcleo. El bore =
  //    ⌀ interior de la pieza (id.fx − 2·pared) + 0.10 de deslizamiento; el asiento del
  //    borde queda 0.6 HACIA ADENTRO del interior escalado = el "witness line offset"
  //    que el libro pide LITERAL (Fig 11.21: "mating location moved toward the interior
  //    of the core"). El agua del lado B se muda a la placa de SOPORTE (abajo).
  const isStripper = spec.ejectors.type === 'stripper';
  if (def.role === 'B' && isStripper) {
    // El anillo FLOTA en el tercio superior de su banda (Fig 11.19): placa = t−16 arriba;
    // los 16 mm de abajo = respaldo del inserto (anclado al soporte) + carrera del anillo.
    try { solid = K.transformShape(oc, K.makeBox(oc, W - 2 * s, D - 2 * s, t - 16), { translate: [s, s, 16] }); } catch { /* conserva la placa completa */ }
    const id0 = insertDims(spec);
    const boreDia = Math.max(6, id0.fx - 2 * id0.wall) + 0.10;
    for (const cell of cavityGrid(spec, D)) {
      try { solid = K.cut(oc, solid, K.makeCylinder(oc, boreDia / 2, t + 2, { origin: [cell.cx, cell.cy, -1], dir: [0, 0, 1] })); }
      catch { /* bore que falla no aborta la placa */ }
    }
  }
  if (def.role === 'support' && isStripper) {
    // el agua del lado núcleo corre AQUÍ (el stripper flota — no puede llevar agua):
    // línea a 2·⌀ bajo su cara superior, misma fuente coolingCircuit.
    try {
      const cc = coolingCircuit(spec, D);
      const r = cc.diaMm / 2, zc = t - 2 * cc.diaMm;
      const wtools = cc.segs.map((g) => g.y0 === g.y1
        ? K.makeCylinder(oc, r, Math.abs(g.x1 - g.x0) + 6, { origin: [Math.min(g.x0, g.x1) - 3, g.y0, zc], dir: [1, 0, 0] })
        : K.makeCylinder(oc, r, Math.abs(g.y1 - g.y0) + 6, { origin: [g.x0, Math.min(g.y0, g.y1) - 3, zc], dir: [0, 1, 0] }));
      for (const w of wtools) { if (w) { try { solid = K.cut(oc, solid, w); } catch { /* segmento */ } } }
    } catch { /* agua de soporte opcional */ }
  }
  if ((def.role === 'A' || def.role === 'B') && !(def.role === 'B' && isStripper)) {
    // BOLSA DEL INSERTO (pocket ciego desde la CARA DE PARTICIÓN): las placas A/B no
    // llevan la impresión — llevan la BOLSA que RECIBE el inserto (ifx×ify×Hc/Hk,
    // +0.5 de juego). Antes se abría la huella de la PIEZA (cw×cd×dep) y el inserto
    // interpenetraba `border` mm de acero por lado — mentira visible en rayos X.
    const id0 = insertDims(spec);
    const dep = Math.min((def.role === 'A' ? id0.Hc : id0.Hk) + 0.5, t - 3);
    const bw = id0.ifx + 0.5, bl = id0.ify + 0.5;
    for (const cell of cavityGrid(spec, D)) {
      try {
        const zTool = def.role === 'A' ? -1 : t - dep;           // origen del tool en Z local
        const tool = K.extrudePolygon(oc, [
          { x: cell.cx - bw / 2, y: cell.cy - bl / 2 }, { x: cell.cx + bw / 2, y: cell.cy - bl / 2 },
          { x: cell.cx + bw / 2, y: cell.cy + bl / 2 }, { x: cell.cx - bw / 2, y: cell.cy + bl / 2 },
        ], dep + 1, K.offsetPlane(K.PLANE_XY, zTool));
        solid = K.cut(oc, solid, tool);
      } catch { /* una cavidad que falla no aborta la placa */ }
    }
    // CANALES DE AGUA REALES — en TODO detalle, y ALINEADOS con el componente de agua
    // (misma fórmula que buildFunctionalParts, si no el tubo flota fuera del barreno).
    // A: a zAboveMm de la partición (LIBRA la impresión, Eq 9.22 desde la superficie
    // moldeante); B: a zBehindMm bajo la partición. Si el lado A no tiene línea
    // posible (zAboveMm undefined) NO se taladra — jamás agua dentro de la cavidad.
    try {
      const cc = coolingCircuit(spec, D);
      const r = cc.diaMm / 2;
      const zc = def.role === 'A'
        ? (cc.zAboveMm != null ? Math.min(cc.zAboveMm, t - r - 1) : null)
        : t - Math.min(spec.plates.B - r - 1, cc.zBehindMm);
      if (zc != null) {
        const wtools = cc.segs.map((g) => g.y0 === g.y1
          ? K.makeCylinder(oc, r, Math.abs(g.x1 - g.x0) + 6, { origin: [Math.min(g.x0, g.x1) - 3, g.y0, zc], dir: [1, 0, 0] })
          : K.makeCylinder(oc, r, Math.abs(g.y1 - g.y0) + 6, { origin: [g.x0, Math.min(g.y0, g.y1) - 3, zc], dir: [0, 1, 0] }));
        // SECUENCIAL, no compound: con la placa fina + el pocket del inserto, el cut
        // compuesto se rompía (y el try/catch se lo tragaba → sin barreno = agua en acero).
        for (const w of wtools) { if (w) { try { solid = K.cut(oc, solid, w); } catch { /* un segmento que falla no aborta los demás */ } } }
      }
    } catch { /* canal que falla se omite */ }
  }
  // barrenos: TODOS (los pasajes ⌀3 de los pines y las cabezas también existen — la
  // revisión placa-por-placa exige que cada componente tenga su barreno real).
  // OPTIMIZACIÓN: un SOLO cut con el compound de todas las brocas (30 cuts → 1);
  // si el compound falla, cae al taladro uno-por-uno.
  const list = standardHoles(spec, def.role);
  let drilled = 0;
  const tools: any[] = [];
  for (const h of list) {
    try { tools.push(K.makeCylinder(oc, h.dia / 2, t + 2, { origin: [h.x, h.y, -1], dir: [0, 0, 1] })); } catch { /* broca inválida */ }
  }
  // HEMBRA del interlock §12.2.5: bolsa CIEGA en la placa A, del MISMO plan que el
  // macho (fuente única `planInterlocks` — ver el comentario en el componente
  // 'interlocks'). Sin esta bolsa, al CERRAR la nariz del macho queda clavada dentro
  // del acero macizo de A: dos sólidos en el mismo espacio. Lo cazó el user viendo la
  // ANIMACIÓN de apertura. Ciega (no pasante): arranca en la cara de partición (z=0
  // local) y sube solo lo que entra la nariz.
  if (def.role === 'A') {
    try {
      const il = planInterlocks(spec);
      const dF = (il.diaMm ?? 19.05) + 0.4;                 // +0.4: la hembra RECIBE, no aprieta
      const depth = Math.min(t - 4, Math.max(8, Math.round((il.diaMm ?? 19) * 0.75)));
      for (const q of il.positions)
        tools.push(K.makeCylinder(oc, dF / 2, depth, { origin: [q.x, q.y, -0.5], dir: [0, 0, 1] }));
    } catch { /* sin datos de cavidad no hay interlock */ }
  }
  // ASIENTO del BUJE guía en A (Fig 1.5): el buje es un CASQUILLO de OD = ⌀pilar+8 pegado
  // a presión en A; el poste corre por su ID. El barreno estándar es ⌀pilar (para el POSTE)
  // — subdimensionado para el buje → el casquillo quedaba enterrado 45 cc en el acero de A
  // (lo midió el estudio de contacto por VOLUMEN). Barreno = OD del buje +0.4 (locacional).
  // Los BARRENOS GUÍA son ESCALONADOS (asiento del buje + contrataladro de la brida,
  // CONCÉNTRICOS) → se cortan SECUENCIALMENTE sobre el sólido, NO en el compound (meter
  // cilindros concéntricos traslapados en un solo cut de OCC corrompe el resultado y deja
  // la placa MACIZA → el poste quedaba enterrado 91 cc). guideGeom = misma fuente que el buje.
  if (def.role === 'A') {
    const gp = standardHoles(spec, 'A').filter((h) => /pilar/.test(h.type));
    for (const g of gp) {
      const G = guideGeom(g.dia);
      try { solid = K.cut(oc, solid, K.makeCylinder(oc, G.boreA_bushingMm / 2, t + 2, { origin: [g.x, g.y, -1], dir: [0, 0, 1] })); } catch { /* asiento del buje */ }
      try { solid = K.cut(oc, solid, K.makeCylinder(oc, G.cboreA_flangeMm / 2, G.flangeHMm + 2, { origin: [g.x, g.y, t - G.flangeHMm - 1], dir: [0, 0, 1] })); } catch { /* contrataladro de la brida */ }
    }
  }
  // ASIENTO del interlock en B: el CUERPO del macho (⌀dI, bodyH ≈ 1.6·dI) vive DENTRO de
  // B (revolvePolygon: cuerpo recto de zPart−bodyH a zPart). Sin este barreno el interlock
  // y B comparten acero — el estudio de contacto lo midió (20.8 mm). Barreno desde la CARA
  // de partición (z local = t) hacia abajo, holgura locacional +0.4 (RECIBE, no aprieta).
  if (def.role === 'B') {
    try {
      const il = planInterlocks(spec);
      const dI = il.diaMm ?? 19.05;
      const bodyH = Math.min(t - 4, Math.round(dI * 1.6));
      for (const q of il.positions)
        tools.push(K.makeCylinder(oc, (dI + 0.4) / 2, bodyH + 1, { origin: [q.x, q.y, t - bodyH - 0.5], dir: [0, 0, 1] }));
    } catch { /* sin datos de cavidad no hay interlock */ }
  }
  // CONTRATALADRO del HOMBRO del poste guía en B (Fig 1.5): el hombro (⌀nominal+6) se aloja
  // en la cara de atrás de B (z local 0). SECUENCIAL (concéntrico con el barreno del poste).
  // Sin él, hombro y B comparten acero (lo midió el estudio: B↔guias). guideGeom = 1 fuente.
  if (def.role === 'B') {
    const gp = standardHoles(spec, 'B').filter((h) => /pilar/.test(h.type));
    for (const g of gp) {
      const G = guideGeom(g.dia);
      try { solid = K.cut(oc, solid, K.makeCylinder(oc, G.cboreB_shoulderMm / 2, G.shoulderHMm + 1, { origin: [g.x, g.y, -0.5], dir: [0, 0, 1] })); } catch { /* contrataladro del hombro */ }
    }
  }
  // CONTRATALADRO de las CABEZAS de pines en la RETENEDORA (Fig 1.6): la cabeza (expulsor
  // ⌀+4, retorno ⌀16) se CAPTURA en la cara de atrás de la retenedora (z local 0). El pasaje
  // solo (⌀+0.5 / ⌀12) dejaba la cabeza enterrada → ejector-ret↔pines. Contrataladro
  // SECUENCIAL, mismas dims que el componente. +0.4 locacional (recibe la cabeza).
  if (def.role === 'ejector-ret') {
    const headH = Math.max(4, Math.min(6, t - 2));                              // = headH del componente (t = tRet)
    const rHeadH = Math.max(4, Math.round(spec.plates.ejectorHousing * 0.2) - 2);
    for (const h of standardHoles(spec, 'ejector-ret')) {
      const isRet = /retorno/.test(h.type);
      const cbDia = isRet ? 16 + 0.4 : spec.ejectors.diaMm + 4 + 0.4;
      const cbH = (isRet ? rHeadH : headH) + 1;
      try { solid = K.cut(oc, solid, K.makeCylinder(oc, cbDia / 2, cbH, { origin: [h.x, h.y, -0.5], dir: [0, 0, 1] })); } catch { /* contrataladro de cabeza */ }
    }
  }
  // CONTRATALADRO de la CABEZA del TORNILLO SHCS (⌀dk × k, DIN 912): avellanada a ras. La
  // cavidad se atornilla desde ARRIBA → cabeza en el CLAMP (top); el núcleo desde ABAJO de
  // la SUJECIÓN INFERIOR (§12.2.3: "support plate secured to the REAR CLAMP PLATE with
  // SHCS") → cabeza en la cara de abajo del bottom. Sin el contrataladro, la cabeza (dk)
  // comparte acero con la placa. dk/k de resolveHead (mismo que el componente).
  if (def.role === 'clamp' || def.role === 'bottom') {
    try {
      const half = def.role === 'clamp' ? 'cavity' : 'core';
      const hd = resolveHead('DIN912', resolveThread(fastenerPlan(spec, { half }).majorMm).major);
      const seatRole = def.role === 'clamp' ? 'clamp' : 'bottom';
      const z0 = def.role === 'clamp' ? t - hd.k - 0.5 : -0.5;                  // clamp: cabeza al TOP · bottom: cabeza en su cara de ABAJO
      for (const s of standardHoles(spec, seatRole).filter((h) => /tornillo/.test(h.type)))
        try { solid = K.cut(oc, solid, K.makeCylinder(oc, (hd.dk + 0.8) / 2, hd.k + 1.5, { origin: [s.x, s.y, z0], dir: [0, 0, 1] })); } catch { /* contrataladro de cabeza */ }
    } catch { /* sin plan de tornillería */ }
  }
  // ASIENTO del SPRUE BUSHING en el clamp (§1.3.1/§6.3.2): la brida del bushing (⌀34)
  // registra 2 mm en la cara superior del clamp — su caja ⌀+0.4, SECUENCIAL (concéntrica
  // con el barreno de la boquilla). Sin ella compartían acero (clamp↔anillo, 2.2k mm³).
  if (def.role === 'clamp') {
    const cx = spec.widthMm / 2, cyy = Math.round(D / 2);
    try { solid = K.cut(oc, solid, K.makeCylinder(oc, 17.2, 2.5 + 0.5, { origin: [cx, cyy, t - 2.5], dir: [0, 0, 1] })); } catch { /* caja del bushing */ }
  }
  try {
    if (tools.length) { solid = K.cut(oc, solid, K.makeCompound(oc, tools)); drilled = tools.length; }
  } catch {
    for (const h of list) {
      try { solid = K.drillHole(oc, solid, { x: h.x, y: h.y, diameter: h.dia, zTop: t, depth: t, through: true }); drilled++; }
      catch { /* barreno que no cabe: se omite */ }
    }
  }
  return { solid, drilled, holes: list.length };
}

/** Z de cada placa en el stack (cota inferior). */
export function plateStackZ(spec: MoldAssemblySpec): Record<string, number> {
  const p = spec.plates;
  return {
    bottom: 0,
    ejector: p.bottomClamp + 4,
    'ejector-ret': p.bottomClamp + 4 + Math.max(15, Math.round(p.ejectorHousing * 0.28)),
    support: p.bottomClamp + p.ejectorHousing,
    B: p.bottomClamp + p.ejectorHousing + p.support,
    A: p.bottomClamp + p.ejectorHousing + p.support + p.B,
    clamp: p.bottomClamp + p.ejectorHousing + p.support + p.B + p.A,
  };
}

export interface MoldPart {
  /** llegada del frente por VÉRTICE (s) — redes de colada (Figs 6.13-6.17) */
  flowT?: Float32Array;
  /** duración total del llenado de la red (s) */
  flowTotalS?: number;
  /** puntos de GATE (x,y,z aplanados) — semillas del llenado de la(s) pieza(s) */
  gatesXYZ?: number[];
  role: string; name: string; material: string;
  positions: Float32Array; normals: Float32Array; indices: Uint32Array;
  color: string; opacity: number;
  bodies?: number;          // cuántos cuerpos componen el componente (como Fusion)
  features?: string[];      // "historia" de construcción (cómo se hizo)
  edges?: Float32Array;     // aristas (pares de puntos) — overlay CAD nítido
  /** CINEMÁTICA del componente móvil: al ABRIR el molde la corredera se retrae
   *  u = min(S, apertura·tanφ) en dir — la animación de apertura lo usa. */
  kin?: { dir: [number, number]; strokeMm: number; angleDeg: number };
}

type CarvedMesh = { positions: Float32Array; normals: Float32Array; indices: Uint32Array };

/** INSERTOS TALLADOS CON LA PIEZA REAL (heightfield) — la SEPARACIÓN A/B de verdad:
 *  la HEMBRA (A) se talla con la superficie SUPERIOR de la malla (la cavidad tiene
 *  la FORMA de la pieza) y el MACHO (B) con la INFERIOR. Sin booleanas de malla
 *  (frágiles): se rasteriza z_max/z_min en un grid y se construyen los insertos como
 *  mallas con faldón — rápido, robusto, y la partición queda en el plano correcto. */
export function carvedInserts(
  partMesh: { positions: Float32Array; indices: Uint32Array },
  cells: Array<{ cx: number; cy: number }>, zPart: number,
  ifx: number, ify: number, Hc: number, Hk: number,
): { cav: CarvedMesh; core: CarvedMesh } | null {
  const P = partMesh.positions, I = partMesh.indices;
  if (!P.length) return null;
  let mnx = 1e9, mny = 1e9, mnz = 1e9, mxx = -1e9, mxy = -1e9, mxz = -1e9;
  for (let i = 0; i < P.length; i += 3) {
    if (P[i] < mnx) mnx = P[i]; if (P[i] > mxx) mxx = P[i];
    if (P[i + 1] < mny) mny = P[i + 1]; if (P[i + 1] > mxy) mxy = P[i + 1];
    if (P[i + 2] < mnz) mnz = P[i + 2]; if (P[i + 2] > mxz) mxz = P[i + 2];
  }
  const pw = mxx - mnx, ph = mxy - mny;
  if (pw < 1 || ph < 1) return null;
  // rasteriza z_max/z_min de la pieza (coords locales, z desde su base = 0)
  // celda ~0.45 mm (acotada): con la celda de 0.8 mm el inserto salía ESCALONADO
  // tipo voxel — un inserto real maquinado es LISO (feedback user, carved-core-sup)
  const G = Math.max(96, Math.min(192, Math.round(pw / 0.45)));
  const nx = G, ny = Math.max(24, Math.round(G * ph / pw));
  const dxg = pw / nx, dyg = ph / ny;
  const zMax = new Float32Array(nx * ny).fill(NaN);
  const zMin = new Float32Array(nx * ny).fill(NaN);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ax = P[a] - mnx, ay = P[a + 1] - mny, az = P[a + 2] - mnz;
    const bx = P[b] - mnx, by = P[b + 1] - mny, bz = P[b + 2] - mnz;
    const cx2 = P[c] - mnx, cy2 = P[c + 1] - mny, cz = P[c + 2] - mnz;
    const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx2) / dxg)), i1 = Math.min(nx - 1, Math.ceil(Math.max(ax, bx, cx2) / dxg));
    const j0 = Math.max(0, Math.floor(Math.min(ay, by, cy2) / dyg)), j1 = Math.min(ny - 1, Math.ceil(Math.max(ay, by, cy2) / dyg));
    const den = (by - cy2) * (ax - cx2) + (cx2 - bx) * (ay - cy2);
    if (Math.abs(den) < 1e-12) continue;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = (i + 0.5) * dxg, py = (j + 0.5) * dyg;
      const w0 = ((by - cy2) * (px - cx2) + (cx2 - bx) * (py - cy2)) / den;
      const w1 = ((cy2 - ay) * (px - cx2) + (ax - cx2) * (py - cy2)) / den;
      const w2 = 1 - w0 - w1;
      if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
      const zv = az * w0 + bz * w1 + cz * w2;
      const n = j * nx + i;
      if (Number.isNaN(zMax[n]) || zv > zMax[n]) zMax[n] = zv;
      if (Number.isNaN(zMin[n]) || zv < zMin[n]) zMin[n] = zv;
    }
  }
  // ── PULIDO DEL HEIGHTFIELD (el inserto se MAQUINA liso, no queda voxelado) ──
  // 1) rellena huecos de raster (celda NaN con ≥5 vecinas definidas → promedio);
  // 2) 2 pasadas de blur 3×3 SOLO entre celdas definidas: alisa los escalones de
  //    las laderas sin mover la silueta (las celdas fuera de la pieza no entran).
  const polish = (Z: Float32Array) => {
    const at = (i: number, j: number) => (i < 0 || j < 0 || i >= nx || j >= ny) ? NaN : Z[j * nx + i];
    for (let pass = 0; pass < 3; pass++) {
      const fill = pass === 0;                       // pasada 0 = rellenar; 1-2 = alisar
      const out = new Float32Array(Z);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const n = j * nx + i, self = Z[n];
        if (fill === !Number.isNaN(self)) continue;  // fill: solo NaN · blur: solo definidas
        let s = 0, c = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const v = at(i + di, j + dj);
          if (!Number.isNaN(v)) { s += v; c++; }
        }
        if (fill) { if (c >= 5) out[n] = s / c; }
        else if (c > 1) out[n] = s / c;              // incluye self (peso uniforme)
      }
      Z.set(out);
    }
  };
  polish(zMax); polish(zMin);
  const buildSide = (side: 'cav' | 'core'): CarvedMesh => {
    const pos: number[] = [], idx: number[] = [];
    const H = side === 'cav' ? Hc : Hk;
    const zFlat = side === 'cav' ? zPart + H : zPart - H;
    for (const cell of cells) {
      const ox = cell.cx - pw / 2, oy = cell.cy - ph / 2;
      const bx0 = cell.cx - ifx / 2, by0 = cell.cy - ify / 2;
      const NX = nx + 2, NY = ny + 2;
      const base = pos.length / 3;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        let x: number, y: number, zv: number;
        if (i === 0 || j === 0 || i === NX - 1 || j === NY - 1) {
          x = i === 0 ? bx0 : i === NX - 1 ? bx0 + ifx : ox + (i - 1 + 0.5) * dxg;
          y = j === 0 ? by0 : j === NY - 1 ? by0 + ify : oy + (j - 1 + 0.5) * dyg;
          zv = zPart;                                          // el anillo del bloque toca la partición
        } else {
          x = ox + (i - 1 + 0.5) * dxg; y = oy + (j - 1 + 0.5) * dyg;
          const n = (j - 1) * nx + (i - 1);
          const s = side === 'cav' ? zMax[n] : zMin[n];
          zv = Number.isNaN(s) ? zPart : zPart + s;            // pieza apoyada en zPart
        }
        pos.push(x, y, zv);
      }
      const vid = (i: number, j: number) => base + j * NX + i;
      for (let j = 0; j + 1 < NY; j++) for (let i = 0; i + 1 < NX; i++) {
        if (side === 'cav') idx.push(vid(i, j), vid(i + 1, j), vid(i, j + 1), vid(i + 1, j), vid(i + 1, j + 1), vid(i, j + 1));
        else idx.push(vid(i, j), vid(i, j + 1), vid(i + 1, j), vid(i + 1, j), vid(i, j + 1), vid(i + 1, j + 1));
      }
      // cara plana exterior + faldón perimetral del bloque
      const f = pos.length / 3;
      pos.push(bx0, by0, zFlat, bx0 + ifx, by0, zFlat, bx0 + ifx, by0 + ify, zFlat, bx0, by0 + ify, zFlat);
      if (side === 'cav') idx.push(f, f + 2, f + 1, f, f + 3, f + 2);
      else idx.push(f, f + 1, f + 2, f, f + 2, f + 3);
      const ring = [[0, 0], [NX - 1, 0], [NX - 1, NY - 1], [0, NY - 1]];
      for (let e = 0; e < 4; e++) {
        const [i0r, j0r] = ring[e], [i1r, j1r] = ring[(e + 1) % 4];
        const va = vid(i0r, j0r), vb = vid(i1r, j1r), fa = f + e, fb = f + (e + 1) % 4;
        if (side === 'cav') idx.push(va, vb, fb, va, fb, fa);
        else idx.push(va, fb, vb, va, fa, fb);
      }
    }
    const positions = new Float32Array(pos);
    const indices = new Uint32Array(idx);
    const normals = new Float32Array(positions.length);
    for (let t = 0; t < indices.length; t += 3) {
      const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
      const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
      const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
      const nx2 = uy * vz - uz * vy, ny2 = uz * vx - ux * vz, nz2 = ux * vy - uy * vx;
      for (const q of [a, b, c]) { normals[q] += nx2; normals[q + 1] += ny2; normals[q + 2] += nz2; }
    }
    for (let i = 0; i < normals.length; i += 3) {
      const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
      normals[i] /= l; normals[i + 1] /= l; normals[i + 2] /= l;
    }
    return { positions, normals, indices };
  };
  return { cav: buildSide('cav'), core: buildSide('core') };
}

/** PLANES de partes móviles §11.3.6-7 para el spec/malla — calculados UNA vez y
 *  compartidos entre las placas (canal maquinado) y el kit (cuerpos). */
export function computeSideActionPlans(spec: MoldAssemblySpec, partMesh?: { positions: Float32Array; indices: Uint32Array }): { plans: SideActionPlan[]; pw: number; ph: number } {
  let plans: SideActionPlan[] = [];
  let pw = 0, ph = 0;
  if (partMesh && partMesh.positions.length) {
    try {
      const P = partMesh.positions;
      let mnx = 1e18, mny = 1e18, mxx = -1e18, mxy = -1e18;
      for (let i = 0; i < P.length; i += 3) {
        if (P[i] < mnx) mnx = P[i]; if (P[i] > mxx) mxx = P[i];
        if (P[i + 1] < mny) mny = P[i + 1]; if (P[i + 1] > mxy) mxy = P[i + 1];
      }
      pw = mxx - mnx; ph = mxy - mny;
      const dfm = dfmFromMesh(partMesh, { wallMm: spec.cavity.wallMm });
      plans = planSideActions(dfm.regionsDetail, { pMeltMPa: spec.sideAction?.pMeltMPa ?? 200 }).plans;
    } catch { /* sin plan no hay mecanismos */ }
  } else if (spec.sideAction) {
    const foot = cavityFootprint(spec);
    // alto de cara ≈ profundidad de la pieza (el bezel del libro: núcleo 22×10 con dep 10)
    plans = [planFromSpec(spec.sideAction, Math.max(8, Math.min(16, spec.cavity.depthMm)), foot)];
    pw = foot.fx; ph = foot.fy;
  }
  return { plans, pw, ph };
}

/** MARCOS de colocación del mecanismo: por plan × celda EXTERIOR (una celda con
 *  vecina en la dirección de jale NO tiene salida — §11.3.7 layout). Coordenadas
 *  de MUNDO en el plano de partición. */
export function mecFrames(spec: MoldAssemblySpec, sa: { plans: SideActionPlan[]; pw: number; ph: number }) {
  const D = plateDepth(spec);
  const cells = cavityGrid(spec, D);
  const id = insertDims(spec);
  const out: Array<{
    plan: SideActionPlan; planIdx: number; cell: { cx: number; cy: number };
    alongX: boolean; sgn: number;
    rx0: number; rx1: number; ry0: number; ry1: number;      // región en mundo
    innerU: number; vC: number; bodyW: number; bodyHup: number; railW: number; insHalf: number;
  }> = [];
  let skipped = 0;
  for (let pi = 0; pi < sa.plans.length; pi++) {
    const p = sa.plans[pi];
    const [dx, dy] = p.dir;
    const alongX = Math.abs(dx) > Math.abs(dy);
    const sgn = alongX ? Math.sign(dx) : Math.sign(dy);
    for (const c of cells) {
      // EXTERIOR: sin celda vecina en la dirección de jale (±paso, misma transversal)
      const hasNeighbor = cells.some((o) => o !== c
        && Math.abs((alongX ? o.cy : o.cx) - (alongX ? c.cy : c.cx)) < 2
        && Math.sign((alongX ? o.cx : o.cy) - (alongX ? c.cx : c.cy)) === sgn);
      if (hasNeighbor) { skipped++; continue; }
      const ox = c.cx - sa.pw / 2, oy = c.cy - sa.ph / 2;
      const r = p.region;
      const rx0 = ox + r.x0, rx1 = ox + r.x1, ry0 = oy + r.y0, ry1 = oy + r.y1;
      const innerU = alongX ? (sgn > 0 ? rx1 : rx0) : (sgn > 0 ? ry1 : ry0);
      const vC = alongX ? (ry0 + ry1) / 2 : (rx0 + rx1) / 2;
      out.push({
        plan: p, planIdx: pi, cell: c, alongX, sgn, rx0, rx1, ry0, ry1, innerU, vC,
        bodyW: p.unit?.bodyWmm ?? p.coreWmm + 14,
        bodyHup: p.unit?.bodyHmm ?? Math.max(12, p.region.zHi + 4),
        railW: p.unit?.railWmm ?? 7,
        insHalf: alongX ? id.ifx / 2 : id.ify / 2,
      });
    }
  }
  return { frames: out, skipped };
}

/** COMPONENTES FUNCIONALES del molde — lo que lo hace un MOLDE DE INYECCIÓN y no
 *  una pila de placas: columnas guía, PINES EYECTORES, LÍNEAS DE ENFRIAMIENTO, la
 *  PIEZA en la cavidad y el BEBEDERO/colada. Cada grupo = un componente aislable.
 *  Todo con primitivas baratas (cilindros/cajas, cero booleanas) → rápido en vivo.
 *  Las posiciones NO se inventan: salen de standardHoles / coolingCircuit / cavityGrid
 *  (las MISMAS que dimensionan los PDFs, verificadas contra Kazmer). */
export function buildFunctionalParts(K: any, oc: any, spec: MoldAssemblySpec, partMesh?: { positions: Float32Array; indices: Uint32Array }, sa?: { plans: SideActionPlan[]; pw: number; ph: number },
  realSolids?: { cav: any; core: any; piece?: any; zPartSplit: number }): MoldPart[] {
  if (!sa) sa = computeSideActionPlans(spec, partMesh);
  const D = plateDepth(spec);
  const z = plateStackZ(spec);
  const defs = plateDefs(spec);
  const thick = (role: string) => defs.find((d) => d.role === role)?.thick ?? 20;
  const out: MoldPart[] = [];
  const push = (role: string, name: string, material: string, shapes: any[], color: string, opacity: number, features?: string[], kin?: MoldPart['kin'], tol = 0.6) => {
    const ok = shapes.filter(Boolean);
    if (!ok.length) return;
    try {
      const comp = ok.length === 1 ? ok[0] : K.makeCompound(oc, ok);
      // tol = tolerancia CORDAL de la teselación. Para pares con holguras chicas (pared
      // 1.2 mm, fits 0.13-0.4) las facetas a 0.6 se INTERPENETRAN hasta ~1.2 mm aunque
      // los sólidos reales no se toquen → el estudio de contacto reporta acero compartido
      // FALSO (lo cazó la nube: banda roja envolviendo TODA la pared del vaso). Esos
      // pares se teselan fino (0.15) y el artefacto colapsa.
      const m = K.tessellate(oc, comp, tol, tol);
      out.push({ role, name, material, positions: m.positions, normals: m.normals, indices: m.indices, color, opacity, bodies: ok.length, features, kin });
    } catch { /* grupo que falla se omite */ }
  };
  const cyl = (r: number, h: number, origin: [number, number, number], dir: [number, number, number]) => {
    try { return h > 0.2 && r > 0.2 ? K.makeCylinder(oc, r, h, { origin, dir }) : null; } catch { return null; }
  };

  const zPart = z.A;                       // línea de partición = tope de B = base de A
  const tB = thick('B'), tA = thick('A'), tEj = thick('ejector');

  // 1) COLUMNAS GUÍA — 4 postes de acero que alinean y unen las mitades A/B.
  {
    const gp = standardHoles(spec, 'A').filter((h) => /pilar/.test(h.type));
    const h = tB + tA;
    // POSTES (leader pins, Fig 1.5): montados en B, sobresalen de la partición y
    // entran a los BUJES; cabeza con hombro en la base.
    // TODO el sistema guía sale de guideGeom(⌀nominal) → componente y barreno consistentes.
    const pinShapes: any[] = [];
    for (const g of gp) {
      const G = guideGeom(g.dia);
      pinShapes.push(cyl(G.pinDiaMm / 2, h * 0.92, [g.x, g.y, z.B], [0, 0, 1]));            // poste = nominal − 0.6
      pinShapes.push(cyl(G.shoulderDiaMm / 2, G.shoulderHMm, [g.x, g.y, z.B], [0, 0, 1]));  // hombro (va en contrataladro de B)
    }
    push('guias', `Postes guía (${gp.length})`, 'acero rectificado 1.2510', pinShapes, '#d7deea', 1,
      [`${gp.length} postes ⌀${gp[0] ? guideGeom(gp[0].dia).pinDiaMm : '—'} con hombro`, 'montados en B (Fig 1.5)', guideGeom(gp[0]?.dia ?? 20).note]);
    // BUJES guía (guide bushings, Fig 1.5): casquillos en A que RECIBEN los postes.
    const bushShapes: any[] = [];
    for (const g of gp) {
      try {
        const G = guideGeom(g.dia);
        let tube = K.makeCylinder(oc, G.bushingODMm / 2, tA * 0.75, { origin: [g.x, g.y, z.A + tA * 0.25], dir: [0, 0, 1] });
        tube = K.cut(oc, tube, K.makeCylinder(oc, G.bushingIDMm / 2, tA, { origin: [g.x, g.y, z.A], dir: [0, 0, 1] }));   // ID = poste + 0.03 (H7/g6)
        bushShapes.push(tube);
        bushShapes.push(cyl(G.flangeDiaMm / 2, G.flangeHMm, [g.x, g.y, z.A + tA - G.flangeHMm], [0, 0, 1]));   // brida (va en contrataladro de A)
      } catch { /* buje opcional */ }
    }
    push('bujes', `Bujes guía (${gp.length})`, 'bronce/acero templado', bushShapes, '#b98d5a', 1,
      ['casquillos que RECIBEN los postes (Fig 1.5)', 'brida en contrataladro de A', 'ajuste H7/g6 con el poste (ID = poste+0.03)']);
  }

  // 1b) TORNILLOS ENSAMBLADOS (SHCS DIN 912) con CUERDA REAL — el barreno ya existe;
  //     esto es el PERNO metido: cabeza cilíndrica con hexágono interior + vástago
  //     ROSCADO helicoidal (thread.ts, perfil ISO 68-1). Cavidad se atornilla desde
  //     ARRIBA (cabeza en el clamp, rosca baja a A); núcleo desde ABAJO (cabeza en
  //     el bottom, rosca sube a B). La rosca se construye UNA vez por largo y se
  //     reusa por transform (cara — no un sweep helicoidal por tornillo).
  try {
    const zTopMold = z.clamp + thick('clamp');   // cara superior del molde
    // EL ESTUDIO MANDA SOBRE LA GEOMETRÍA (nunca al revés): el Ø sale de fastenerPlan
    // (§12.4 Fig 12.33 + engrane FED-STD-H28), no de una heurística aparte. Antes el
    // molde se armaba con moldBoltSizing y el panel mostraba OTRO tornillo — números
    // decorativos que no mandaban sobre lo que se fabrica.
    const plan = fastenerPlan(spec, { half: 'cavity' });
    const ts = resolveThread(plan.majorMm);                   // rosca REAL (datos ISO 68-1)
    // CABEZA POR NORMA (mold-heads): dk/k/sw de la tabla DIN 912 verificada + hueco
    // Allen + chaflán de canto. Antes se armaba con 4 ops de OCCT y proporciones
    // INVENTADAS (headH = round(0.9·d) cuando ISO 4762 manda k = d EXACTO).
    const hd = resolveHead('DIN912', ts.major);
    const headH = hd.k;
    // ENGRANE POR CARGA (no punta arbitraria): la longitud roscada = engrane que el
    // libro/física exige (FED-STD-H28) — el AGARRE depende de esto, no de la punta.
    const engage = engagementLengthMm(ts, plateYieldMPa(spec));
    // MALLA del perno +Z: cabeza [0..headH] + caña LISA [headH..headH+smooth] + hilo
    // ROSCADO solo en el ENGRANE [.. +engage] (así es un tornillo real: rosca donde
    // AGARRA, caña donde pasa por la holgura). Ultraliviano y correcto.
    const meshMerge = (a: ThreadMesh, b: ThreadMesh, dz: number): ThreadMesh => {
      const pos = new Float32Array(a.positions.length + b.positions.length);
      const nor = new Float32Array(pos.length), idx = new Uint32Array(a.indices.length + b.indices.length);
      pos.set(a.positions); nor.set(a.normals); idx.set(a.indices);
      const av = a.positions.length / 3, ao = a.positions.length;
      for (let i = 0; i < b.positions.length; i += 3) {
        pos[ao + i] = b.positions[i]; pos[ao + i + 1] = b.positions[i + 1]; pos[ao + i + 2] = b.positions[i + 2] + dz;
        nor[ao + i] = b.normals[i]; nor[ao + i + 1] = b.normals[i + 1]; nor[ao + i + 2] = b.normals[i + 2];
      }
      for (let k = 0; k < b.indices.length; k++) idx[a.indices.length + k] = b.indices[k] + av;
      return { positions: pos, normals: nor, indices: idx };
    };
    // headMesh crece +Z DESDE su cara de apoyo; el perno local tiene la cara SUPERIOR
    // en z=0 y crece hacia la punta → espejo z→k−z (el espejo invierte el giro de las
    // caras, así que también se voltea el índice o las normales salen para adentro).
    const flipZ = (m: ThreadMesh, c: number): ThreadMesh => {
      const positions = new Float32Array(m.positions), normals = new Float32Array(m.normals);
      for (let i = 0; i < positions.length; i += 3) { positions[i + 2] = c - m.positions[i + 2]; normals[i + 2] = -m.normals[i + 2]; }
      const indices = new Uint32Array(m.indices);
      for (let k = 0; k < indices.length; k += 3) { const t = indices[k + 1]; indices[k + 1] = indices[k + 2]; indices[k + 2] = t; }
      return { positions, normals, indices };
    };
    // nPhi bajo A PROPÓSITO: la cabeza mide ⌀16 sobre un molde de 390 mm — a esa escala
    // 28 gajos ya se ven redondos. Se calcula UNA vez y se reusa en los 12 pernos.
    const headLocal = flipZ(headMesh(hd, 0, { nPhi: 28 }), hd.k);
    const boltMesh = (L: number): ThreadMesh => {
      const eng = Math.min(L, engage);                        // rosca = engrane (o todo si es corto)
      const smoothLen = Math.max(0, L - eng);
      let m: ThreadMesh = headLocal;
      if (smoothLen > 0.5) m = meshMerge(m, plainShaftMesh(ts.major / 2, 0, smoothLen), headH);   // caña lisa al Ø mayor
      m = meshMerge(m, threadSurfaceMesh(ts, eng), headH + smoothLen);                            // hilo en el engrane (chaflán ISO 4753)
      return m;
    };
    // DOS buffers: los de la cavidad viajan CON la placa A al abrir, los del núcleo se
    // quedan. Antes era UN solo componente con las dos mitades ⇒ la animación no podía
    // mover unos sí y otros no: al abrir, los de cavidad se quedaban plantados en el
    // hueco y parecían amarrar A con B ("como que los tornillos atornillan la placa a y
    // b? wuuuuuut" — user 2026-07-15). Un componente por mitad = cada quien con su placa.
    type Acc = { pos: number[]; nor: number[]; idx: number[] };
    const mkAcc = (): Acc => ({ pos: [], nor: [], idx: [] });
    const accCav = mkAcc(), accCore = mkAcc();
    const addBolt = (acc: Acc, m: ThreadMesh, flip: boolean, tx: number, ty: number, tz: number) => {
      const base = acc.pos.length / 3, P = m.positions, N = m.normals;
      for (let i = 0; i < P.length; i += 3) {
        let x = P[i], y = P[i + 1], zz = P[i + 2], nx = N[i], ny = N[i + 1], nz = N[i + 2];
        if (flip) { y = -y; zz = -zz; ny = -ny; nz = -nz; }
        acc.pos.push(x + tx, y + ty, zz + tz); acc.nor.push(nx, ny, nz);
      }
      for (let k = 0; k < m.indices.length; k++) acc.idx.push(m.indices[k] + base);
    };
    const cavPos = standardHoles(spec, 'clamp').filter((h) => /tornillo/.test(h.type));
    const corPos = standardHoles(spec, 'bottom').filter((h) => /tornillo/.test(h.type));
    // `boltMesh(L)` devuelve un perno de headH + L (la cabeza va aparte), así que el
    // ESPACIO que ocupa es cabeza + caña: hay que descontar headH o el perno se pasa de
    // largo. Sin descontarlo cruzaba la partición 14 mm — lo cazó el gate midiendo la
    // MALLA, no la intención del código.
    const cavLen = Math.max(10, thick('clamp') + tA - 6 - headH);
    // NÚCLEO — Kazmer §12.2.3 LITERAL: "the support plate is secured to the REAR CLAMP
    // PLATE with socket head cap screws". El tornillo largo entra desde ABAJO de la
    // sujeción inferior (cabeza en contrataladro de su cara de abajo), sube POR DENTRO
    // de los RIELES (railX está dentro del riel — acero con barreno, no el hueco), cruza
    // el soporte y ROSCA en B por `engage`. Antes la cabeza quedaba ENTERRADA en la cara
    // inferior del soporte, flotando en el hueco donde VIAJA la expulsora ("esos
    // tornillos están dentro del metal, no veo por dónde meterlos" — user, con razón).
    const corLen = Math.max(10, spec.plates.bottomClamp + spec.plates.ejectorHousing + thick('support') + engage - headH);
    // cabezas AVELLANADAS a ras: cavidad desde ARRIBA (rot 180°, cabeza en el clamp);
    // núcleo desde ABAJO de la sujeción. Ninguno cruza la partición: A y B se separan
    // CADA ciclo — un tornillo entre ellas impediría abrir el molde.
    if (cavPos.length) { const m = boltMesh(cavLen); for (const p of cavPos) addBolt(accCav, m, true, p.x, p.y, zTopMold); }
    if (corPos.length) { const m = boltMesh(corLen); for (const p of corPos) addBolt(accCore, m, false, p.x, p.y, 0); }
    // ESTUDIO de tornillería (nivel manual de avión: cada número justificado)
    const planOf = (half: 'cavity' | 'core'): string[] => {
      try {
        const pc = fastenerPlan(spec, { half });
        return [
          `CARGA §12.4: ${pc.totalKN} kN (peor caso ×SF2) repartida · ${pc.perBoltKN} kN/tornillo / ${pc.capacityKN} kN cap = ${pc.utilPct}% util`,
          `ENGRANE por carga: ${engage} mm roscado (FED-STD-H28, placa Sy ${pc.plateSyMPa} MPa) — el AGARRE, no la punta`,
          `par de apriete ${pc.torqueNm} N·m · broca piloto ⌀${ts.tapDrillMm} · área esf ${ts.stressAreaMm2} mm²`,
          `alternativas: ${pc.alternatives.map((a) => `${a.count}×${a.desig}`).join(' · ')} (varias formas de repartir)`,
        ];
      } catch { return []; }
    };
    const comunes = [
      `cuerda ISO 68-1 REAL: ${ts.desig} · Ø menor ${ts.minor} · primitivo ${ts.pitchDia} · ${ts.hand}`,
      `cabeza ${hd.desig}: ⌀${hd.dk}×${hd.k} · Allen s${hd.sw} · asiento ${seatSpec(hd).kind} ⌀${seatSpec(hd).dia} (${hd.rule})`,
      `chaflán de punta ISO 4753: ${tipChamfer(ts.major, ts.pitch).kind} hasta ⌀${tipChamfer(ts.major, ts.pitch).toDia} (entra al barreno)`,
    ];
    // 'tornillos-cav' lleva el sufijo que la animación reconoce como lado A: al abrir,
    // suben CON su placa (van atornillados a ella). Los del núcleo se quedan con B.
    if (accCav.idx.length) out.push({
      role: 'tornillos-cav', name: `Tornillos ${ts.desig} · lado CAVIDAD (${cavPos.length}) · cuerda REAL`,
      material: `${hd.desig} clase 12.9`,
      positions: new Float32Array(accCav.pos), normals: new Float32Array(accCav.nor), indices: new Uint32Array(accCav.idx),
      color: '#5b6472', opacity: 1, bodies: cavPos.length,
      features: [...comunes, ...planOf('cavity'),
        `sujeción superior → placa A: z[${(zTopMold - cavLen).toFixed(0)}..${zTopMold.toFixed(0)}] · NO cruza la partición (z=${z.A})`],
    });
    if (accCore.idx.length) out.push({
      role: 'tornillos-core', name: `Tornillos ${ts.desig} · lado NÚCLEO (${corPos.length}) · cuerda REAL`,
      material: `${hd.desig} clase 12.9`,
      positions: new Float32Array(accCore.pos), normals: new Float32Array(accCore.nor), indices: new Uint32Array(accCore.idx),
      color: '#5b6472', opacity: 1, bodies: corPos.length,
      features: [...comunes, ...planOf('core'),
        `soporte → placa B: z[${z.support.toFixed(0)}..${(z.support + corLen).toFixed(0)}] · libra el hueco del expulsor (z<${z.support}) y NO cruza la partición (z=${z.A})`],
    });
  } catch { /* tornillos opcionales (no rompen el molde) */ }

  // 1b) INTERLOCKS §12.2.5 — EL AUTOCENTRADO. Al cerrar, la nariz CÓNICA del macho
  //     (que vive en B) entra en la hembra (bolsa ciega en A) y ARRASTRA las mitades a
  //     su sitio: el error de maquinado se corrige en el ARMADO, no exigiendo precisión
  //     imposible en cada barreno. Los 5° de §4.1.3 son los que permiten esa "búsqueda"
  //     — a 0° se traban con la fuerza de cierre en vez de centrarse.
  try {
    const il = planInterlocks(spec);
    const zPart = z.A;
    const dI = il.diaMm ?? 19.05;
    const rB = dI / 2;
    const noseH = Math.max(6, Math.round(dI * 0.6));            // nariz que sobresale a A
    const tan5 = Math.tan((il.angleDeg * Math.PI) / 180);
    const rNose = Math.max(1.5, rB - noseH * tan5);              // se angosta al subir → entra
    // perfil de REVOLUCIÓN (media sección, x = RADIO, y = ALTURA): cuerpo recto en B +
    // nariz cónica cruzando la partición. Es lo ÚNICO que debe cruzarla: los tornillos no.
    // ⚠ PLANO: `revolvePolygon` gira alrededor del eje V del plano. Con el PLANE_XY por
    // defecto eso es el eje Y del MUNDO → el perfil salía acostado y a z[-10..10] en vez
    // de en la partición (z=298). Con PLANE_XZ (u=X → radio, v=Z → altura) el eje de giro
    // ES Z y la pieza queda de pie donde debe. Lo cazó el bbox del componente.
    const bodyH = Math.min(thick('B') - 4, Math.round(dI * 1.6));
    const prof = [
      { x: 0.001, y: zPart - bodyH },                            // ~0: el eje (0 exacto degenera el wire)
      { x: rB, y: zPart - bodyH },
      { x: rB, y: zPart },                                       // hasta el plano de partición
      { x: rNose, y: zPart + noseH },                            // nariz cónica 5° → autocentra
      { x: 0.001, y: zPart + noseH },
    ];
    // LA HEMBRA se corta AQUÍ, del MISMO plan que el macho. Intenté colocarla aparte en
    // `standardHoles` y divergió TRES veces seguidas (regla copiada 2.4 mm · insumo
    // distinto 20 mm · otra lista de obstáculos). La lección no fue "copiar con cuidado":
    // fue NO COPIAR. Un solo `il` manda macho, hembra y auditoría.
    const femalePockets = il.positions.map((q) => ({ x: q.x, y: q.y, dia: +(dI + 0.4).toFixed(2) }));

    const acc = { pos: [] as number[], nor: [] as number[], idx: [] as number[] };
    for (const q of il.positions) {
      const one = K.tessellate(oc, K.revolvePolygon(oc, prof, 360, K.PLANE_XZ), 0.35, 0.35);
      const base = acc.pos.length / 3;
      for (let i = 0; i < one.positions.length; i += 3) {
        acc.pos.push(one.positions[i] + q.x, one.positions[i + 1] + q.y, one.positions[i + 2]);
        acc.nor.push(one.normals[i], one.normals[i + 1], one.normals[i + 2]);
      }
      for (let k = 0; k < one.indices.length; k++) acc.idx.push(one.indices[k] + base);
    }
    if (acc.idx.length) out.push({
      role: 'interlocks', name: `Interlocks ${il.desig} (${il.positions.length}) · AUTOCENTRADO`,
      material: 'S7 templado', color: '#c98f3f', opacity: 1, bodies: il.positions.length,
      positions: new Float32Array(acc.pos), normals: new Float32Array(acc.nor), indices: new Uint32Array(acc.idx),
      features: [
        `§12.2.5: macho PASANTE en B (${bodyH} mm) + nariz cónica ${noseH} mm que entra a la hembra CIEGA de A`,
        `§4.1.3: nariz a ${il.angleDeg}° (⌀${dI}→⌀${(rNose * 2).toFixed(1)}) — a 0° la fuerza de cierre los TRABA en vez de centrar`,
        `Eq 12.18: F=½·P·⌀·H = ${il.fLateralN} N → τ ${il.tauMPa}/${il.limitMPa} MPa (S7) ${il.ok ? '✓' : '✗'}`,
        il.benefit,
        `posiciones (corridas para librar la tornillería): ${il.positions.map((q) => `(${q.x},${q.y})`).join(' ')}`,
      ],
    });
  } catch { /* sin datos de cavidad el interlock no aplica */ }

  // 2) PINES EYECTORES — empujan la pieza fuera del núcleo; de la placa expulsora a
  //    la superficie del núcleo (línea de partición). Ø y conteo del spec resuelto.
  //    STRIPPER (§11.3.4): NO hay pines — el ANILLO (placa B convertida) empuja todo el
  //    perímetro del rim con esfuerzo uniforme; la pared de 1.2 mm no se perfora.
  if (spec.ejectors.type !== 'stripper') {
    const ep = standardHoles(spec, 'B').filter((h) => /expulsor/.test(h.type));
    const tRet = Math.max(12, Math.round(spec.plates.ejectorHousing * 0.2));
    const zRetBot = z['ejector-ret'] ?? (z.ejector + tEj);   // fondo de la placa retenedora
    const h = zPart - zRetBot;                               // vástago: retenedora → partición
    // CABEZA del pin (Fig 1.6): flange ⌀+3 mm CAPTURADA en la placa retenedora — sin
    // ella el pin se saldría al empujar (bug cazado: eran varillas peladas §11.3.1).
    const headR = spec.ejectors.diaMm / 2 + 2, headH = Math.max(4, Math.min(6, tRet - 2));
    const shapes: any[] = [];
    for (const e of ep) {
      shapes.push(cyl(e.dia / 2, h, [e.x, e.y, zRetBot], [0, 0, 1]));          // vástago
      shapes.push(cyl(headR, headH, [e.x, e.y, zRetBot], [0, 0, 1]));         // cabeza en la retenedora
    }
    push('pines', `Pines eyectores (${ep.length}) · ⌀${spec.ejectors.diaMm} + cabeza`, '1.2842 templado (nitrurado)',
      shapes, '#caa23f', 1,
      [`${ep.length} pines ⌀${spec.ejectors.diaMm} mm con cabeza ⌀${(headR * 2).toFixed(0)} (Fig 1.6)`, `largo ${h} mm`, spec.cavity.frameMm ? 'en rim + costillas del marco' : 'bajo la huella']);
  }

  // 2b) RETURN PINS (Fig 1.6): 4 en las esquinas del PAQUETE EXPULSOR. Al CERRAR el molde,
  //     la cara de la placa A los empuja y RESETEA el paquete → los expulsores se retraen.
  //     Sin ellos el molde CHOCA al cerrar (expulsores salidos). Los barrenos ya existen en
  //     la expulsora/retenedora (standardHoles 'pin de retorno'); su holgura en soporte+B abajo.
  {
    const W2 = spec.widthMm, rpx = 65 + 26, rpy = 20 + 26, rpr = 6;   // ⌀12, esquinas del paquete
    const zRetBot = z['ejector-ret'] ?? (z.ejector + Math.max(15, Math.round(spec.plates.ejectorHousing * 0.28)));
    // STRIPPER: las varillas empujan el FONDO del anillo (que flota en el tercio superior
    // de su banda: fondo = z.B + 16), no llegan a la partición.
    const hRet = (spec.ejectors.type === 'stripper' ? zPart - tB + 16 : zPart) - zRetBot;
    const rHeadH = Math.max(4, Math.round(spec.plates.ejectorHousing * 0.2) - 2);
    const rshapes: any[] = [];
    for (const [x, y] of [[rpx, rpy], [W2 - rpx, rpy], [rpx, D - rpy], [W2 - rpx, D - rpy]] as [number, number][]) {
      rshapes.push(cyl(rpr, hRet, [x, y, zRetBot], [0, 0, 1]));       // vástago hasta la partición
      rshapes.push(cyl(rpr + 2, rHeadH, [x, y, zRetBot], [0, 0, 1])); // cabeza capturada en la retenedora
    }
    push('pines-retorno', 'Return pins (4) · ⌀12', '1.2842 templado', rshapes, '#8fa0b8', 1,
      ['4 return pins en las esquinas del paquete expulsor', 'la cara de A los empuja al CERRAR → resetea', 'sin ellos el molde choca (Fig 1.6)']);
  }

  // 3) LÍNEAS DE ENFRIAMIENTO — serpentín ⌀ real (§9.2), ruteado en los HUECOS entre
  //    filas de cavidades. Una malla en A (tras la cavidad) y otra en B (tras el núcleo).
  {
    const cc = coolingCircuit(spec, D), r = cc.diaMm / 2;
    const circuit = (zc: number) => cc.segs.map((g) => g.y0 === g.y1
      ? cyl(r, Math.abs(g.x1 - g.x0), [Math.min(g.x0, g.x1), g.y0, zc], [1, 0, 0])
      : cyl(r, Math.abs(g.y1 - g.y0), [g.x0, Math.min(g.y0, g.y1), zc], [0, 1, 0]));
    const plug = spec.cooling.plug ? ` · plug ${spec.cooling.plug}` : '';
    // profundidad del LIBRO (Eq 9.22, H desde la SUPERFICIE MOLDEANTE): B a zBehindMm
    // bajo la partición; A a zAboveMm (= impresión + H) — LIBRA la cavidad tallada.
    const HcoolB = Math.min(tB - r - 1, cc.zBehindMm);
    const coolFeatB = [`⌀${cc.diaMm} mm · serpentín`, `prof ${cc.zBehindMm} mm (4D, Eq 9.22)`, `IN/OUT + ${cc.plugs.length} tapones`];
    if (cc.zAboveMm != null) {
      const zA = Math.min(cc.zAboveMm, tA - r - 1);
      const coolFeatA = [`⌀${cc.diaMm} mm · serpentín`, `alt ${Math.round(zA)} mm sobre partición (impresión ${spec.cavity.depthMm} + H, Eq 9.22)`,
        ...(cc.aWarn ? [`⚠ ${cc.aWarn}`] : []), `IN/OUT + ${cc.plugs.length} tapones`];
      push('agua-a', `Enfriamiento placa A · ⌀${cc.diaMm}${plug}`, `agua (${cc.ports.length} puertos)`, circuit(zPart + zA), '#31b6e8', 1, coolFeatA, undefined, 0.2);
    } else {
      push('agua-a', `Enfriamiento placa A · ⚠ SIN LÍNEA RECTA`, 'requiere baffles §9.2.4', [], '#31b6e8', 1,
        [cc.aWarn ?? 'impresión demasiado alta para la placa A', 'el lazo generativo debe ENGROSAR la placa A']);
    }
    const strip = spec.ejectors.type === 'stripper';
    const zB2 = strip ? zPart - tB - 2 * cc.diaMm : zPart - HcoolB;   // stripper: línea en el SOPORTE (el anillo flota)
    push('agua-b', `Enfriamiento ${strip ? 'placa de SOPORTE (bajo el stripper)' : 'placa B'} · ⌀${cc.diaMm}${plug}`, 'agua', circuit(zB2), '#1f8fc4', 1, coolFeatB, undefined, 0.2);
  }

  // 4) EL MOLDE MISMO — INSERTO DE CAVIDAD (hembra) en A + INSERTO DE NÚCLEO (macho)
  //    en B + la PIEZA (shell) en el hueco. Esto es lo que de verdad forma la pieza:
  //    la hembra da la cara exterior, el macho el interior, y el gap = las paredes.
  {
    const id = insertDims(spec);
    const cells = cavityGrid(spec, D);
    const box = (w: number, l: number, h: number, cx: number, cy: number, z0: number) =>
      K.transformShape(oc, K.makeBox(oc, w, l, h), { translate: [cx - w / 2, cy - l / 2, z0] });
    const cavS: any[] = [], coreS: any[] = [], partS: any[] = [];
    for (const c of cells) {
      try {
        // INSERTO DE CAVIDAD (hembra): bloque en A con la BOLSA de la pieza (impresión exterior).
        let cav = box(id.ifx, id.ify, id.Hc, c.cx, c.cy, zPart);
        const pocket = id.round
          ? K.makeCylinder(oc, id.fx / 2, id.dep + 0.5, { origin: [c.cx, c.cy, zPart - 0.25], dir: [0, 0, 1] })
          : box(id.fx, id.fy, id.dep + 0.5, c.cx, c.cy, zPart - 0.25);
        cav = K.cut(oc, cav, pocket);
        cavS.push(cav);
        // INSERTO DE NÚCLEO (macho): bloque en B + BOSS que llena el interior de la pieza.
        let core = box(id.ifx, id.ify, id.Hk, c.cx, c.cy, zPart - id.Hk);
        const bw = Math.max(2, id.fx - 2 * id.wall), bl = Math.max(2, id.fy - 2 * id.wall), bh = Math.max(1, id.dep - id.wall);
        const bossCore = id.round
          ? K.makeCylinder(oc, bw / 2, bh, { origin: [c.cx, c.cy, zPart], dir: [0, 0, 1] })
          : box(bw, bl, bh, c.cx, c.cy, zPart);
        core = K.fuse(oc, core, bossCore);
        coreS.push(core);
        // PIEZA (shell): exterior − macho = las paredes reales de la pieza.
        let part = id.round
          ? K.makeCylinder(oc, id.fx / 2, id.dep, { origin: [c.cx, c.cy, zPart], dir: [0, 0, 1] })
          : box(id.fx, id.fy, id.dep, c.cx, c.cy, zPart);
        const bossPart = id.round
          ? K.makeCylinder(oc, bw / 2, bh, { origin: [c.cx, c.cy, zPart], dir: [0, 0, 1] })
          : box(bw, bl, bh, c.cx, c.cy, zPart);
        part = K.cut(oc, part, bossPart);
        partS.push(part);
      } catch { /* una impresión que falla no aborta las demás */ }
    }
    // INSERTOS — PRIORIDAD: el SÓLIDO REAL de la pieza partido con splitMold (la FIGURA
    // ES la cavidad). Los insertos llegan como SÓLIDOS (no malla) en el marco local de
    // splitMold (centrados en el origen, boca arriba en zPartSplit) → aquí se ESPEJAN al
    // marco del molde (mirrorShape 'xy' + traslado a la partición z.A + celda) y, YA en el
    // marco de ensamble, se TALADRAN sus holguras (guías, agua, pines, colada) con las
    // MISMAS posiciones que las placas. Así el inserto es DRILLABLE como cualquier placa:
    // nadie comparte acero con lo que lo atraviesa. Si no hay sólido, malla tallada o tubo.
    if (realSolids) {
      const { cav, core, piece, zPartSplit } = realSolids;
      const C = zPart + zPartSplit;                        // z_ensamble = C − z_local
      // ESPEJO en Z SIN reflexión (una reflexión invierte la orientación del sólido → las
      // booleanas de OCC se vuelven locas y "fugan" la broca). El vaso es AXISIMÉTRICO, así
      // que una ROTACIÓN de 180° sobre X a z=C/2 da el MISMO z→C−z conservando orientación.
      const place = (s: any, cell: { cx: number; cy: number }) => K.transformShape(oc, s, { translate: [cell.cx, cell.cy, 0], rotateAngle: Math.PI, rotateAxis: { origin: [0, 0, C / 2], dir: [1, 0, 0] } });
      // brocas VERTICALES pasantes (cubren todo el z del inserto) y CANALES horizontales de agua
      const vCyl = (x: number, y: number, rad: number) => { try { return K.makeCylinder(oc, rad, tA + tB + 200, { origin: [x, y, zPart - (tB + 100)], dir: [0, 0, 1] }); } catch { return null; } };
      const cc = coolingCircuit(spec, D), rw = cc.diaMm / 2 + 0.4;
      const waterTools = (zc: number) => cc.segs.map((g) => { try {
        return g.y0 === g.y1
          ? K.makeCylinder(oc, rw, Math.abs(g.x1 - g.x0) + 8, { origin: [Math.min(g.x0, g.x1) - 4, g.y0, zc], dir: [1, 0, 0] })
          : K.makeCylinder(oc, rw, Math.abs(g.y1 - g.y0) + 8, { origin: [g.x0, Math.min(g.y0, g.y1) - 4, zc], dir: [0, 1, 0] });
      } catch { return null; } });
      const guides = standardHoles(spec, 'A').filter((h) => /pilar/.test(h.type));
      const eps = standardHoles(spec, 'B').filter((h) => /expulsor/.test(h.type));
      const feed = standardHoles(spec, 'A').filter((h) => /boquilla|bebedero|compuerta/.test(h.type));
      const W2 = spec.widthMm, rpx = 65 + 26, rpy = 20 + 26;
      const rets: [number, number][] = [[rpx, rpy], [W2 - rpx, rpy], [rpx, D - rpy], [W2 - rpx, D - rpy]];
      // UN SOLO cut con el COMPOUND de todas las brocas (patrón PROBADO de buildPlateSolid;
      // los cuts secuenciales acumulaban invalidez y "fugaban" la broca fusionándola).
      const cutAll = (s: any, tools: any[]) => { const ok = tools.filter(Boolean); if (!ok.length) return s; try { return K.cut(oc, s, ok.length === 1 ? ok[0] : K.makeCompound(oc, ok)); } catch { return s; } };
      const drillCav = (s: any) => {                       // cavidad (placa A): guías + colada + agua A
        const tools: any[] = [];
        for (const g of guides) tools.push(vCyl(g.x, g.y, g.dia / 2 + 4.4));      // OD del buje (holgura)
        for (const f of feed) tools.push(vCyl(f.x, f.y, f.dia / 2 + 0.3));        // bebedero/colada
        if (cc.zAboveMm != null) tools.push(...waterTools(zPart + Math.min(cc.zAboveMm, tA - cc.diaMm / 2 - 1)));
        return cutAll(s, tools);
      };
      const drillCore = (s: any) => {                      // núcleo (placa B): pines + return + guías + agua B
        const tools: any[] = [];
        for (const e of eps) tools.push(vCyl(e.x, e.y, e.dia / 2 + 0.2));         // pin eyector + holgura §8.3.2
        for (const [x, y] of rets) tools.push(vCyl(x, y, 6 + 0.2));              // return pin ⌀12
        for (const g of guides) tools.push(vCyl(g.x, g.y, g.dia / 2 + 4.4));
        if (spec.ejectors.type !== 'stripper') tools.push(...waterTools(zPart - Math.min(tB - cc.diaMm / 2 - 1, cc.zBehindMm)));
        return cutAll(s, tools);
      };
      const _tI = performance.now();
      // FINO (0.15): cav/macho/pieza están separados por la PARED (1.2 mm) — a 0.6 las
      // facetas se interpenetran y el estudio de contacto reporta colisión FALSA.
      push('inserto-cav', `Inserto de cavidad · FIGURA REAL (sólido taladrado) ×${cells.length}`, spec.cavityMetal ?? 'AISI P20',
        cells.map((c) => drillCav(place(cav, c))), '#7d90ad', 0.6,
        ['HEMBRA del sólido real (splitMold)', 'holguras de guías/colada/agua TALADRADAS en el sólido — nadie comparte acero'], undefined, 0.3);
      push('inserto-core', `Inserto de núcleo · FIGURA REAL (sólido taladrado) ×${cells.length}`, spec.core?.material ?? 'AISI P20',
        cells.map((c) => drillCore(place(core, c))), '#6b7e9a', 1,
        ['MACHO del sólido real (splitMold)', 'holguras de pines/return/guías/agua TALADRADAS en el sólido'], undefined, 0.3);
      if (piece) push('pieza', `Pieza moldeada ×${cells.length} (vaso real, alineado)`, 'plástico (PP/ABS)',
        cells.map((c) => place(piece, c)), '#eb9438', 0.95, ['el vaso real, mismo transform que los insertos → sin interpenetración'], undefined, 0.3);
      console.log('PERF insertos-reales (drill+tess)', Math.round(performance.now() - _tI), 'ms');
    } else {
    const carved = partMesh ? carvedInserts(partMesh, cells, zPart, id.ifx, id.ify, id.Hc, id.Hk) : null;
    if (carved) {
      out.push({ role: 'inserto-cav', name: `Inserto de cavidad · TALLADO con la pieza ×${cells.length}`, material: spec.cavityMetal ?? 'AISI P20',
        positions: carved.cav.positions, normals: carved.cav.normals, indices: carved.cav.indices, color: '#7d90ad', opacity: 0.6,
        bodies: cells.length, features: ['HEMBRA tallada: superficie superior de la malla real', `bloque ${id.ifx}×${id.ify}×${id.Hc} mm`, 'la cavidad ES la pieza'] });
      out.push({ role: 'inserto-core', name: `Inserto de núcleo · TALLADO con la pieza ×${cells.length}`, material: spec.core?.material ?? 'AISI P20',
        positions: carved.core.positions, normals: carved.core.normals, indices: carved.core.indices, color: '#6b7e9a', opacity: 1,
        bodies: cells.length, features: ['MACHO tallado: superficie inferior de la malla real', `bloque ${id.ifx}×${id.ify}×${id.Hk} mm`, 'partición en el plano de apoyo'] });
    } else {
      push('inserto-cav', `Inserto de cavidad · hembra ×${cells.length}`, spec.cavityMetal ?? 'AISI P20', cavS, '#7d90ad', 0.5,
        [`bloque ${id.ifx}×${id.ify}×${id.Hc} mm`, `bolsa (impresión) ${id.fx}×${id.fy}×${id.dep} mm`, 'da la cara exterior de la pieza']);
      push('inserto-core', `Inserto de núcleo · macho ×${cells.length}`, spec.core?.material ?? 'AISI P20', coreS, '#6b7e9a', 1,
        [`bloque ${id.ifx}×${id.ify}×${id.Hk} mm`, `macho (llena el interior)`, 'da la cara interior de la pieza']);
    }
    }   /* cierra el else de realInserts */
    if (realSolids?.piece) {
      /* la pieza ya se empujó ALINEADA arriba (mismo transform que los insertos) */
    } else if (partMesh && partMesh.positions.length) {
      // LA FIGURA REAL (malla del STL decimada): centrada en la cavidad, piso en la partición
      const P = partMesh.positions, I2 = partMesh.indices;
      let mnx = 1e9, mny = 1e9, mnz = 1e9, mxx = -1e9, mxy = -1e9;
      for (let i = 0; i < P.length; i += 3) {
        if (P[i] < mnx) mnx = P[i]; if (P[i] > mxx) mxx = P[i];
        if (P[i + 1] < mny) mny = P[i + 1]; if (P[i + 1] > mxy) mxy = P[i + 1];
        if (P[i + 2] < mnz) mnz = P[i + 2];
      }
      // una copia de la malla por CADA cavidad del grid
      const nV = P.length / 3, nCells = cells.length;
      const pos = new Float32Array(P.length * nCells);
      const I2rep = new Uint32Array(I2.length * nCells);
      cells.forEach((c0, ci) => {
        const ox = c0.cx - (mnx + mxx) / 2, oy = c0.cy - (mny + mxy) / 2, oz = zPart - mnz;
        for (let i = 0; i < P.length; i += 3) {
          pos[ci * P.length + i] = P[i] + ox;
          pos[ci * P.length + i + 1] = P[i + 1] + oy;
          pos[ci * P.length + i + 2] = P[i + 2] + oz;
        }
        for (let t = 0; t < I2.length; t++) I2rep[ci * I2.length + t] = I2[t] + ci * nV;
      });
      // normales planas acumuladas por vértice
      const nor = new Float32Array(pos.length);
      for (let t = 0; t < I2rep.length; t += 3) {
        const a = I2rep[t] * 3, b = I2rep[t + 1] * 3, c = I2rep[t + 2] * 3;
        const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
        const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
        const nx2 = uy * vz - uz * vy, ny2 = uz * vx - ux * vz, nz2 = ux * vy - uy * vx;
        for (const q of [a, b, c]) { nor[q] += nx2; nor[q + 1] += ny2; nor[q + 2] += nz2; }
      }
      for (let i = 0; i < nor.length; i += 3) {
        const l = Math.hypot(nor[i], nor[i + 1], nor[i + 2]) || 1;
        nor[i] /= l; nor[i + 1] /= l; nor[i + 2] /= l;
      }
      out.push({ role: 'pieza', name: `Pieza moldeada ×${nCells} (figura REAL del STL)`, material: 'plástico (ABS/PP)',
        positions: pos, normals: nor, indices: I2rep, color: '#eb9438', opacity: 0.95,
        bodies: nCells, features: ['malla real del STL (decimada)', `${(I2.length / 3).toLocaleString()} tris × ${nCells} cavidades`, 'una copia por impresión'] });
    } else {
      push('pieza', `Pieza moldeada ×${cells.length}`, 'plástico (ABS/PP)', partS, '#eb9438', 0.92,
        [`${id.fx}×${id.fy}×${id.dep} mm · pared ${id.wall} mm`, 'shell = exterior − macho', `${cells.length} impresión(es)`]);
    }
  }

  // 5) BEBEDERO / COLADA — alimentación (§6-7): caliente = drops por cavidad; fría =
  //    bebedero central. Del clamp superior a la línea de partición.
  {
    const feed = standardHoles(spec, 'A').filter((h) => /boquilla|bebedero|compuerta/.test(h.type));
    const topZ = z.clamp + thick('clamp');
    const hot = spec.feed === 'hot-runner';
    const boxAt = (w: number, l: number, hh: number, x0: number, y0: number, z0: number) => {
      try { return K.transformShape(oc, K.makeBox(oc, w, l, hh), { translate: [x0, y0, z0] }); } catch { return null; }
    };
    if (hot && feed.length) {
      // COLADA CALIENTE REAL (§6.3.3, Figs 6.11-6.12): sprue caliente → MANIFOLD →
      // boquillas concéntricas por drop; THRUST PADS de titanio transmiten la fuerza
      // al clamp "transfiriendo un mínimo de calor"; AIR GAP alrededor (el manifold
      // FLOTA y desliza sobre las boquillas al expandirse térmicamente).
      // manifold DELGADO (Fig 6.11), ALTO en el clamp, ACOTADO a NO asomarse por el
      // tope (bug cazado: se asomaba 3.2 mm + parecía bloque grueso). thrust pad
      // queda ENTRE el manifold y la cara del clamp — nunca la perfora.
      const MB = 22;                                                            // sección de la barra (más fina)
      const padH = 6, padGap = 1.5;
      const zM = Math.min(z.clamp + 14, topZ - MB / 2 - padH - padGap);         // eje del manifold, tope adentro
      const bodies: any[] = [];
      const cx = spec.widthMm / 2;
      const rows = [...new Set(feed.map((f) => f.y))].sort((a, b) => a - b);
      for (const y of rows) {
        const xs = feed.filter((f) => f.y === y).map((f) => f.x);
        const x0 = Math.min(...xs, cx) - 25, x1 = Math.max(...xs, cx) + 25;
        bodies.push(boxAt(x1 - x0, MB, MB, x0, y - MB / 2, zM - MB / 2));       // barra por fila
      }
      if (rows.length > 1)                                                      // espina central = manifold "H"
        bodies.push(boxAt(MB, rows[rows.length - 1] - rows[0], MB, cx - MB / 2, rows[0], zM - MB / 2));
      bodies.push(cyl(8, topZ - zM, [cx, D / 2, zM], [0, 0, 1]));               // hot sprue bushing
      for (const f of feed) {
        bodies.push(cyl(6, zM - MB / 2 - (zPart + 8), [f.x, f.y, zPart + 8], [0, 0, 1]));     // cuerpo de boquilla
        bodies.push(cyl(3, 8, [f.x, f.y, zPart], [0, 0, 1]));                                  // punta (gate térmico §7.2.8)
        bodies.push(cyl(7, padH, [f.x, f.y, zM + MB / 2], [0, 0, 1]));                         // thrust pad Ti (bajo el tope)
      }
      push('colada', `Colada CALIENTE §6.3.3 · manifold ${rows.length > 1 ? '"H"' : 'recto'} + ${feed.length} boquillas`,
        'H13 calef. · pads de titanio', bodies, '#d8543a', 1,
        [`${feed.length + 2} zonas de calefacción (sprue + manifold + boquillas)`,
          'AIR GAP alrededor — el manifold flota y DESLIZA sobre las boquillas (expansión térmica)',
          'thrust pads de TITANIO → fuerza al clamp con mínimo calor (Fig 6.12)',
          '~20 % menos ciclo y scrap que colada fría (§6.3.3)', 'gate térmico §7.2.8 concéntrico']);
    } else {
      const cells2 = cavityGrid(spec, D);
      if (cells2.length > 1) {
        // ══ LA INTEGRACIÓN: red de canales REAL sobre la rejilla del molde ══
        // sprue centro → primarios → secundarios → gates de borde al RIM de
        // cada vaso, con reparto por RED DE RESISTENCIAS y flujo animable
        // (flowT por vértice). Los vasos llenan desde SU gate (gatesXYZ).
        const rimR = (spec.cavity.widthMm / 2) * 1.015;   // rim escalado (contracción)
        const net = layoutForGrid(cells2, {
          centerX: spec.widthMm / 2, centerY: D / 2, zPart, sprueTopZ: topZ + 6,
          rimRmm: rimR, partVolCc: estPartVolumeCc(spec.cavity), material: spec.plastic,
        });
        const meltG: any[] = [];
        for (const sg of net.segs) {
          const ddx = sg.b[0] - sg.a[0], ddy = sg.b[1] - sg.a[1], ddz = sg.b[2] - sg.a[2];
          const L = Math.hypot(ddx, ddy, ddz);
          if (L < 0.3) continue;
          const axis = { origin: sg.a as [number, number, number], dir: [ddx / L, ddy / L, ddz / L] as [number, number, number] };
          try {
            meltG.push(sg.level === 'sprue'
              ? K.makeCone(oc, sg.rMm, sg.rMm * 0.6, L, axis)
              : K.makeCylinder(oc, sg.rMm, L, axis));
          } catch { /* segmento degenerado: se omite */ }
        }
        let meshFlow: Float32Array | undefined;
        let partCol: any = null;
        try { partCol = K.makeCompound(oc, meltG); } catch { partCol = meltG[0]; }
        push('colada', `Colada FRÍA en rejilla ${cells2.length} cav · red ${net.segs.length} segmentos`,
          `${spec.plastic ?? 'PP'} fundido`, [partCol], '#ffb347', 0.95,
          net.rows.map((r) => `${r.k}: ${r.v} [${r.ref}]`));
        const cp = out[out.length - 1];
        if (cp && cp.positions?.length) {
          cp.flowT = flowTForSegs(cp.positions, net.segs);
          cp.flowTotalS = net.totalFillS;
          cp.gatesXYZ = net.cavities.flatMap((c) => [c.gx, c.gy, c.gz]);
        }
      } else {
      // COLADA FRÍA REAL (§6.3.1 + cap 7): el sprue CÓNICO diseñado por el libro —
      // (1 cavidad: sprue directo — el caso clásico de la flanera)
      // Eq 6.8 (radio por ΔP asignado) + taper de extracción + chequeos completos
      // (γ̇ Tabla 7.2, Re Eq 6.2, t_c §6.4.7, regrind Eq 6.6, freeze Tabla 7.4).
      // El FUNDIDO se VE (ámbar) y sus números viajan en la historia del árbol.
      // El cono NACE en la base cerrada de la pieza (zPart + depth), NO en la
      // partición: nacer en zPart lo metía POR DENTRO del macho — esa era la
      // colisión pendiente inserto-core↔colada (45.8 mm³) del estudio.
      const zGate = zPart + spec.cavity.depthMm;
      const Lsprue = (topZ + 6) - zGate;                      // hasta la boca del bushing
      const fd = sprueDesignFromCavity(spec.plastic, spec.cavity, Lsprue);
      const melt = feed.map((f) => {
        try {
          return K.makeCone(oc, fd.rBaseMm - 0.05, fd.rTopMm - 0.05, Lsprue, { origin: [f.x, f.y, zGate], dir: [0, 0, 1] });
        } catch { return cyl(Math.max(2.5, f.dia / 2), Lsprue, [f.x, f.y, zGate], [0, 0, 1]); }
      });
      push('colada', `Colada FRÍA §6.3.1 · sprue cónico ⌀${(2 * fd.rTopMm).toFixed(1)}→⌀${(2 * fd.rBaseMm).toFixed(1)}`,
        `${spec.plastic ?? 'PP'} fundido`, melt, '#ffb347', 0.95,
        fd.rows.map((r) => `${r.warn ? '⚠ ' : ''}${r.k}: ${r.v} [${r.ref}]`));
      }
    }
  }

  // 5b) PARTES MÓVILES §11.3.6-7 — BIEN APLICADAS (Figs 11.24-11.28): la corredera
  //     corre en el CANAL maquinado de las placas (que buildMoldParts corta), montada
  //     sobre el gib BAJO la partición; el perno vive en su INSERTO; el talón lleva
  //     la CARA INCLINADA real (boolean con caja rotada). Solo celdas EXTERIORES
  //     (una celda con vecina en la dirección de jale no tiene salida).
  if (sa && sa.plans.length) {
    const { frames, skipped } = mecFrames(spec, sa);
    const boxAt2 = (w: number, l: number, hh: number, x0: number, y0: number, z0: number) => {
      try { return w > 0.2 && l > 0.2 && hh > 0.2 ? K.transformShape(oc, K.makeBox(oc, w, l, hh), { translate: [x0, y0, z0] }) : null; } catch { return null; }
    };
    const GIB = 6;                                             // la corredera monta 6 mm bajo la partición
    for (let pi = 0; pi < sa.plans.length; pi++) {
      const p = sa.plans[pi];
      const fs = frames.filter((f) => f.planIdx === pi);
      if (!fs.length) continue;
      // EL ESTUDIO VETA: región fuera de alcance (F>100 kN) → SOLO el núcleo
      // insertado (el acero que forma el feature existe igual) + la advertencia
      // split cavity §13.9.1 — NADA de actuadores monstruo colgados del molde.
      if (p.feasible === false) {
        const noses: any[] = [];
        for (const f of fs) {
          const r = p.region;
          const nz0 = zPart + Math.max(0, r.zLo - 1), nzH = (r.zHi - r.zLo) + 2;
          try { noses.push(K.transformShape(oc, K.makeBox(oc, f.rx1 - f.rx0 + 1, f.ry1 - f.ry0 + 1, nzH), { translate: [f.rx0 - 0.5, f.ry0 - 0.5, nz0] })); } catch { /* */ }
        }
        push(`mecanismo-${pi + 1}`, `Núcleo insertado ${pi + 1} · ✗ REQUIERE SPLIT CAVITY §13.9.1 (F=${p.forceKN} kN)`,
          'P20 (pieza atrapada)', noses, '#c94f4f', 1, p.notes);
        continue;
      }
      // TRES componentes con la CINEMÁTICA del libro (Fig 11.28): lo MÓVIL (nariz+
      // cuerpo, desliza con kin), la BASE (placa+rieles, atornillada a B: estática)
      // y lo FIJO AL LADO A (perno+inserto+talón: SUBE al abrir y el perno se SALE
      // del barreno de la corredera — así es como el mecanismo funciona de verdad).
      const mov: any[] = [], bas: any[] = [], fij: any[] = [];
      for (const f of fs) {
        const { alongX, sgn, bodyW, bodyHup, insHalf } = f;
        const r = p.region;
        const u = p.unit;                                       // unidad PRECARGADA del catálogo
        // helpers u/v → x/y (u = eje de jale)
        const XY = (uu: number, v: number): [number, number] => alongX ? [uu, v] : [v, uu];
        const cellU = alongX ? f.cell.cx : f.cell.cy;
        const plateEdge = sgn > 0 ? (alongX ? spec.widthMm : D) : 0;
        // NARIZ: exacta a la región medida (forma la ventana/feature)
        const nz0 = zPart + Math.max(0, r.zLo - 1), nzH = (r.zHi - r.zLo) + 2;
        mov.push(boxAt2(f.rx1 - f.rx0 + 1, f.ry1 - f.ry0 + 1, nzH, f.rx0 - 0.5, f.ry0 - 0.5, nz0));
        // CUERPO de la unidad: largo del catálogo, ACOTADO a que el talón quepa en la placa
        const heelL = u?.heelLmm ?? 18, baseT = u?.baseTmm ?? GIB, railW = f.railW;
        const wantOuter = f.innerU + sgn * (u?.bodyLmm ?? (insHalf + 30 - Math.abs(f.innerU - cellU)));
        const maxOuter = sgn > 0 ? plateEdge - 4 - heelL - 4 : 4 + heelL + 4;
        const outerU = sgn > 0 ? Math.min(wantOuter, maxOuter) : Math.max(wantOuter, maxOuter);
        const u0 = Math.min(f.innerU, outerU), uL = Math.abs(outerU - f.innerU);
        const [bx, by] = XY(u0, f.vC - bodyW / 2);
        mov.push(boxAt2(alongX ? uL : bodyW, alongX ? bodyW : uL, baseT + bodyHup, bx, by, zPart - baseT));
        // BASE + RIELES de la unidad: la base se EXTIENDE la carrera S hacia afuera —
        // el tramo de riel VACÍO enseña por dónde va a DESLIZAR la corredera
        const baseOut = sgn > 0 ? Math.min(outerU + sgn * p.strokeMm, plateEdge - 2) : Math.max(outerU + sgn * p.strokeMm, 2);
        const bu0 = Math.min(f.innerU, baseOut), buL = Math.abs(baseOut - f.innerU);
        const [px0, py0] = XY(bu0, f.vC - bodyW / 2 - railW - 1.5);
        bas.push(boxAt2(alongX ? buL : bodyW + 2 * railW + 3, alongX ? bodyW + 2 * railW + 3 : buL, baseT - 1, px0, py0, zPart - baseT));
        for (const side of [-1, 1]) {                           // rieles con 1.5 mm de CLARO visible
          const [gx, gy] = XY(bu0, f.vC + side * (bodyW / 2 + 1.5) - (side < 0 ? railW : 0));
          bas.push(boxAt2(alongX ? buL : railW, alongX ? railW : buL, baseT + 6, gx, gy - (alongX ? 0 : 0), zPart - baseT));
        }
        const bodyCU = u0 + uL / 2;                            // centro del cuerpo en u
        // DRIVER: perno angular (slide de catálogo) vs CILINDRO (slide hidráulico / core
        // pull). El slide hidráulico usa la MISMA corredera+rieles (arriba) + cilindro.
        if (p.kind === 'slide' && !p.hydraulic) {
          const ang = p.angleDeg * Math.PI / 180, si = Math.sin(ang), co = Math.cos(ang);
          const Lpin = (p.pinTotalMm ?? 60);
          const pinR = (u?.pinDiaMm ?? 10) / 2;
          // PERNO: entra al cuerpo abajo y sube INCLINADO hacia afuera; el tope
          // termina en su INSERTO (bloque que lo orienta, Fig 11.28)
          const [px, py] = XY(bodyCU, f.vC);
          const dirV: [number, number, number] = alongX ? [sgn * si, 0, co] : [0, sgn * si, co];
          fij.push(cyl(pinR, Lpin, [px, py, zPart - baseT + 2], dirV));
          const tipU = bodyCU + sgn * si * Lpin, tipZ = zPart - baseT + 2 + co * Lpin;
          const [ix, iy] = XY(tipU, f.vC);
          fij.push(boxAt2(alongX ? 14 : 20, alongX ? 20 : 14, 12, ix - (alongX ? 7 : 10), iy - (alongX ? 10 : 7), tipZ - 6));
          // HEEL BLOCK con CARA INCLINADA real (caja − caja rotada φ): pega en la
          // espalda del cuerpo y da la fuerza lateral (el perno NO carga, §11.3.7)
          try {
            const heelW = bodyW + 16, heelH = baseT + bodyHup + 16;
            const hU0 = Math.min(outerU + sgn * 4, outerU + sgn * (4 + heelL));   // esquina u mínima
            const [hx0, hy0] = XY(hU0, f.vC - heelW / 2);
            let heel = K.makeBox(oc, alongX ? heelL : heelW, alongX ? heelW : heelL, heelH);
            heel = K.transformShape(oc, heel, { translate: [hx0, hy0, zPart - baseT] });
            // bisagra: cara INTERIOR del talón (la que ve al cuerpo) a 35% de altura;
            // el cortador (caja grande del lado del cuerpo, sobre la bisagra) se rota φ
            // para que la cara quede inclinada como la espalda de la corredera
            const hinge = outerU + sgn * 4, zH = zPart - baseT + heelH * 0.35;
            const [ax, ay] = XY(hinge, f.vC);
            const cutSpanU = 70, cutSpanV = heelW + 8;
            const [ox2, oy2] = XY(Math.min(hinge, hinge - sgn * cutSpanU), f.vC - cutSpanV / 2);
            let cutter = K.makeBox(oc, alongX ? cutSpanU : cutSpanV, alongX ? cutSpanV : cutSpanU, 90);
            cutter = K.transformShape(oc, cutter, { translate: [ox2, oy2, zH] });          // 1º a su lugar
            cutter = K.transformShape(oc, cutter, {                                        // 2º rotar sobre la bisagra (mundo)
              translate: [0, 0, 0],
              rotateAngle: (alongX ? 1 : -1) * sgn * ang,
              rotateAxis: { origin: [ax, ay, zH], dir: alongX ? [0, 1, 0] : [1, 0, 0] },
            });
            heel = K.cut(oc, heel, cutter);
            fij.push(heel);
          } catch { /* talón que falla se omite */ }
        } else {
          // CORE PULL HIDRÁULICO (Fig 11.26): cilindro fuera del molde + vástago + riser
          const bore = p.boreMm ?? 60;
          const plateEdge = alongX ? (sgn > 0 ? spec.widthMm : 0) : (sgn > 0 ? D : 0);
          const cylU = plateEdge + sgn * (14 + bore * 0.55);
          const [ccx, ccy] = XY(cylU, f.vC);
          bas.push(cyl(bore / 2, bore * 1.1, [alongX ? ccx - sgn * bore * 0.55 : ccx, alongX ? ccy : ccy - sgn * bore * 0.55, zPart + bodyHup / 2].map((v, i) => (i < 2 ? v : v)) as any, alongX ? [sgn, 0, 0] : [0, sgn, 0]));
          const rodL = Math.max(4, Math.abs(cylU - (bodyCU + sgn * uL / 2)) - bore * 0.55);
          const [rx2, ry2] = XY(bodyCU + sgn * uL / 2, f.vC);
          mov.push(cyl(Math.max(4, bore / 6), rodL, [rx2, ry2, zPart + bodyHup / 2], alongX ? [sgn, 0, 0] : [0, sgn, 0]));
          const [qx, qy] = XY(plateEdge + sgn * 2, f.vC - (alongX ? 12 : bore / 2));
          bas.push(boxAt2(alongX ? bore * 0.6 : 24, alongX ? 24 : bore * 0.6, 10, qx - (alongX && sgn < 0 ? bore * 0.6 : 0), qy - (!alongX && sgn < 0 ? bore * 0.6 : 0), zPart - GIB - 10));
        }
      }
      // ESTUDIOS del mecanismo (cada fila con su ecuación) + advertencia de layout
      const pitch = (Math.abs(p.dir[0]) > 0 ? cavityFootprint(spec).fx : cavityFootprint(spec).fy);
      const rows = sideActionVerdicts(p, { pitchMm: Math.round(pitch + Math.max(18, pitch * 0.35)) });
      const notes = rows.map((v) => `${v.ok ? '✓' : '⚠'} ${v.param}: ${v.valor} — ${v.limite} [${v.ref}]`);
      if (skipped > 0) notes.push(`⚠ ${skipped} celda(s) interior(es) SIN mecanismo (no hay salida): reorientar back-to-back o fila única (§11.3.7)`);
      const nm = p.hydraulic
        ? `Corredera HIDRÁULICA ${pi + 1} · bore ⌀${p.boreMm} mm · S=${p.strokeMm} mm (§11.3.6)`
        : p.kind === 'slide'
          ? `Corredera ${pi + 1} · unidad ${p.unit?.code ?? '—'} · S=${p.strokeMm} mm (§11.3.7)`
          : `Core pull ${pi + 1} · ${p.forceKN} kN · bore ${p.boreMm} mm (§11.3.6)`;
      // MÓVIL (desliza con kin) + BASE (atornillada a B: estática) + FIJO AL LADO A
      // (perno+inserto+talón: SUBE al abrir — el perno se SALE del barreno, Fig 11.27-28)
      push(`mecanismo-${pi + 1}`, nm, p.kind === 'slide' ? `unidad ${p.unit?.code} · P20` : 'núcleo P20 (vástago)',
        mov, '#e07b39', 1, notes, { dir: p.dir, strokeMm: p.strokeMm, angleDeg: p.angleDeg });
      push(`mecanismo-${pi + 1}-base`, `Base+gibs ${pi + 1} (atornillada a B)`, 'gib de bronce',
        bas, '#b0813f', 1, ['placa base + 2 rieles con claro de 1.5 mm', 'el tramo VACÍO del riel = la carrera S', 'dowels + tornillos a la placa B (Fig 11.28)']);
      if (fij.filter(Boolean).length) {
        push(`mecanismo-${pi + 1}-fijo`, p.kind === 'slide' ? `Perno+inserto+talón ${pi + 1} (lado A)` : `Cilindro ${pi + 1}`,
          p.kind === 'slide' ? 'perno templado · talón P20' : 'hidráulico',
          fij, '#d98f56', 1, ['atornillado al LADO A: SUBE con la apertura',
            'el perno SE SALE del barreno de la corredera (así actúa, Fig 11.27-28)',
            'el talón da la fuerza lateral solo en CERRADO']);
      }
    }
  }

  // 6) HOUSING DE EXPULSIÓN ABIERTO (Fig 1.4/1.5): RIELES (risers) a los costados —
  //    la placa expulsora se VE por los lados abiertos, como en el libro.
  {
    const W = spec.widthMm, bc = spec.plates.bottomClamp, eh = spec.plates.ejectorHousing;
    const boxAt = (w: number, l: number, h: number, x0: number, y0: number, z0: number) => {
      try { return K.transformShape(oc, K.makeBox(oc, w, l, h), { translate: [x0, y0, z0] }); } catch { return null; }
    };
    // Los TORNILLOS del núcleo (§12.2.3: desde abajo de la sujeción) SUBEN POR DENTRO
    // de los rieles → cada riel lleva sus barrenos pasantes (railX cae dentro del riel).
    const railScrews = standardHoles(spec, 'bottom').filter((h) => /tornillo/.test(h.type));
    const railWithHoles = (x0: number) => {
      let rail = boxAt(50 - 0.3, D - 0.6, eh, x0, 0.3, bc);
      for (const s of railScrews) {
        if (s.x < x0 || s.x > x0 + 50) continue;                 // solo los que caen en ESTE riel
        try { rail = K.cut(oc, rail, K.makeCylinder(oc, s.dia / 2, eh + 2, { origin: [s.x, s.y, bc - 1], dir: [0, 0, 1] })); } catch { /* barreno de riel */ }
      }
      return rail;
    };
    push('rieles', 'Rieles del housing (2)', spec.baseSteel ?? '1.1730',
      [railWithHoles(0.3), railWithHoles(W - 50)], '#8a97ab', 0.95,
      ['housing en "U" (Fig 1.4)', `2 rieles 50×${D}×${eh} mm`, 'la expulsora corre entre ellos', 'barrenos pasantes de la tornillería del núcleo (§12.2.3)']);
    // SUPPORT PILLARS (Fig 1.6): postes que evitan que la placa de soporte flexione.
    const pillarPos = supportPillarPositions(spec, D);            // MISMA fuente que las holguras
    push('pilares-soporte', `Support pillars (${pillarPos.length})`, spec.baseSteel ?? '1.1730',
      pillarPos.map((pp) => cyl(20, eh, [pp.x, pp.y, bc], [0, 0, 1])), '#b9c2d0', 1,
      ['⌀40 mm, cruzan el housing', 'resisten la deflexión de la placa de soporte (§12.2.3)', 'ubicados en el HUECO que libra pines+KO (todo se habla con todo)']);
  }

  // 7) ANILLO CENTRADOR (⌀100 estándar del libro §1.3.1) + SPRUE BUSHING al centro
  //    de la placa de sujeción superior — orientan el molde con la platina fija.
  {
    const W = spec.widthMm, topZ = z.clamp + thick('clamp');
    let ring: any = null;
    try {
      ring = K.makeCylinder(oc, 50, 10, { origin: [W / 2, D / 2, topZ], dir: [0, 0, 1] });
      ring = K.cut(oc, ring, K.makeCylinder(oc, 20, 12, { origin: [W / 2, D / 2, topZ - 1], dir: [0, 0, 1] }));
    } catch { ring = null; }
    // El SPRUE BUSHING lleva el CANAL del bebedero POR DENTRO (§6.3.2: el sprue cónico
    // corre a través del bushing hasta la partición) — antes era un cilindro MACIZO y la
    // colada lo "atravesaba" compartiendo acero (estudio de contacto: colada↔anillo).
    let bushing: any = null;
    try {
      bushing = K.makeCylinder(oc, 17, 8, { origin: [W / 2, D / 2, topZ - 2], dir: [0, 0, 1] });
      bushing = K.cut(oc, bushing, K.makeCylinder(oc, 4.5, 12, { origin: [W / 2, D / 2, topZ - 3], dir: [0, 0, 1] }));
    } catch { bushing = cyl(17, 8, [W / 2, D / 2, topZ - 2], [0, 0, 1]); }
    push('anillo', 'Anillo centrador ⌀100 + sprue bushing', 'acero 1.7131',
      [ring, bushing], '#4e5a6e', 1,
      ['⌀100 mm (estándar del libro §1.3.1)', 'orienta el molde en la platina fija', 'el sprue bushing acopla la boquilla — canal ⌀9 por dentro (§6.3.2)']);
  }

  return out;
}

/** MONTAJE en la inyectora: BRIDAS (clamps) que sujetan las placas de sujeción del
 *  molde a las PLATINAS de la máquina + las dos platinas (fija arriba / móvil abajo).
 *  Así el molde se ve "instalado". Todo con primitivas (cajas + tornillos). */
export function buildMountParts(K: any, oc: any, spec: MoldAssemblySpec): MoldPart[] {
  const W = spec.widthMm, D = plateDepth(spec), z = plateStackZ(spec);
  const defs = plateDefs(spec);
  const thick = (r: string) => defs.find((d) => d.role === r)?.thick ?? 36;
  const out: MoldPart[] = [];
  const push = (role: string, name: string, material: string, shapes: any[], color: string, opacity: number) => {
    const ok = shapes.filter(Boolean);
    if (!ok.length) return;
    try {
      const comp = ok.length === 1 ? ok[0] : K.makeCompound(oc, ok);
      const m = K.tessellate(oc, comp, 0.6, 0.6);
      out.push({ role, name, material, positions: m.positions, normals: m.normals, indices: m.indices, color, opacity });
    } catch { /* omite */ }
  };
  const box = (w: number, l: number, h: number, cx: number, cy: number, z0: number) =>
    K.transformShape(oc, K.makeBox(oc, w, l, h), { translate: [cx - w / 2, cy - l / 2, z0] });

  const topZ = z.clamp + thick('clamp');   // cara superior del molde
  const botZ = 0;                           // cara inferior
  const ext = Math.max(28, Math.round(W * 0.09));   // = CLAMP_EXT (la oreja que sobresale)
  // Las bridas NO se modelan como bloques: el libro (Fig 1.4) monta con RANURAS
  // fresadas en las placas de sujeción ("clamp slots") — ya van talladas en la placa.

  // PLATINAS de la máquina (contexto, semiopacas, ocultas por defecto).
  const pw = W + 2 * ext + 120, pl = D + 120, pt = 46, gap = 40;
  push('platina-fija', 'Platina FIJA (inyección)', 'acero máquina', [box(pw, pl, pt, W / 2, D / 2, topZ + gap)], '#5a6472', 0.5,
    ['platina de inyección', 'contra la placa de sujeción superior']);
  push('platina-movil', 'Platina MÓVIL (expulsión)', 'acero máquina', [box(pw, pl, pt, W / 2, D / 2, botZ - gap - pt)], '#5a6472', 0.5,
    ['platina móvil (lado expulsión)', 'contra la placa de sujeción inferior']);
  return out;
}

/** El molde como COMPONENTES separados — para el árbol de La Forja: aislar / ocultar
 *  / opacidad, como Fusion/SolidWorks. PLACAS (con cavidad ciega + barrenos) MÁS los
 *  componentes funcionales (pines, agua, guías, pieza, colada). Todo con primitivas. */
export function buildMoldParts(K: any, oc: any, spec: MoldAssemblySpec, detail: 'full' | 'blocks' = 'blocks', partMesh?: { positions: Float32Array; indices: Uint32Array },
  realSolids?: { cav: any; core: any; piece?: any; zPartSplit: number }): MoldPart[] {
  const z = plateStackZ(spec);
  // COLOR PROPIO por placa (para diferenciarlas como en Fusion) — tonos de acero
  // distinguibles; A/B (cavidad/núcleo) quedan translúcidas para ver adentro.
  const PLATE_TINT: Record<string, string> = {
    clamp: '#8ea2c6', A: '#9784c2',
    // El ANILLO STRIPPER es el protagonista de la expulsión: dorado brillante
    // (familia del paquete expulsor) para que se distinga de las placas quietas
    // — si se ve azul-acero como una placa más, la expulsión no se entiende.
    B: spec.ejectors?.type === 'stripper' ? '#f2c14e' : '#5fa8c4',
    support: '#9aa6ba', ejector: '#c39457', 'ejector-ret': '#d4b06a', bottom: '#7f95a8',
  };
  const STEEL = '#8a97ab';
  const out: MoldPart[] = [];
  const CLAMP_EXT = Math.max(28, Math.round(spec.widthMm * 0.09));   // oreja de sujeción (sobresale)
  // PLANES de partes móviles UNA vez: las placas cortan el CANAL de la corredera
  // ("the A plate, cavity insert, B plate, and core insert all required modifications
  //  to accommodate the moving core" — §11.3.6) y el kit usa los mismos marcos.
  const sa = computeSideActionPlans(spec, partMesh);
  const saFrames = sa.plans.length ? mecFrames(spec, sa).frames : [];
  let plateIdx = 0;
  for (const def of plateDefs(spec)) {
    try {
      const ext = (def.role === 'clamp' || def.role === 'bottom') ? CLAMP_EXT : 0;
      const shave = 0.06 * (1 + (plateIdx++ % 4));   // 0.06-0.24 mm: invisible, mata la coplanaridad
      let { solid } = buildPlateSolid(K, oc, spec, def, detail, ext, shave);
      // ASIENTO DEL INSERTO en A/B: bolsa rectangular donde cae el bloque de acero del
      // molde (hembra/macho). Contiene a la cavidad chica de buildPlateSolid. A abre
      // hacia la partición (base local 0); B hacia la partición (tope local t).
      if (def.role === 'A' || def.role === 'B') {
        const id = insertDims(spec), t = def.thick, H = def.role === 'A' ? id.Hc : id.Hk;
        const zc = def.role === 'A' ? -1 : t - H;
        for (const c of cavityGrid(spec, plateDepth(spec))) {
          try {
            const seat = K.transformShape(oc, K.makeBox(oc, id.ifx + 1, id.ify + 1, H + 1), { translate: [c.cx - (id.ifx + 1) / 2, c.cy - (id.ify + 1) / 2, zc] });
            solid = K.cut(oc, solid, seat);
          } catch { /* asiento que falla se omite */ }
        }
        // CANAL DE LA CORREDERA (§11.3.6-7): A abre el túnel completo del mecanismo
        // (del borde del inserto al canto de la placa); B lleva la bolsa del GIB
        // (6 mm bajo la partición) donde corre la corredera.
        for (const f of saFrames) {
          try {
            const chW = f.bodyW + 2 * f.railW + 12;   // aloja cuerpo + rieles + claro
            const plateEdge = f.alongX ? spec.widthMm : plateDepth(spec);
            const cellU = f.alongX ? f.cell.cx : f.cell.cy;
            const uStart = cellU + f.sgn * (f.insHalf - 6);
            const uEnd = f.sgn > 0 ? plateEdge + 2 : -2;
            const u0 = Math.min(uStart, uEnd), uL = Math.abs(uEnd - uStart);
            const x0 = f.alongX ? u0 : f.vC - chW / 2;
            const y0 = f.alongX ? f.vC - chW / 2 : u0;
            const zc2 = def.role === 'A' ? -1 : t - 6.5;
            const hh = def.role === 'A' ? f.bodyHup + 2.5 : 7.5;
            const canal = K.transformShape(oc, K.makeBox(oc, f.alongX ? uL : chW, f.alongX ? chW : uL, hh), { translate: [x0, y0, zc2] });
            solid = K.cut(oc, solid, canal);
          } catch { /* canal que falla se omite */ }
        }
      }
      const z0 = z[def.role] ?? 0;
      const placed = z0 ? K.transformShape(oc, solid, { translate: [0, 0, z0] }) : solid;
      // deflexión FINA: con el cut compuesto (muchos barrenos por cara) la malla gruesa
      // deja las aristas largas ASERRADAS (dientes en los bordes de las placas).
      const m = K.tessellate(oc, placed, 0.15, 0.3);
      // ARISTAS como líneas (look CAD): definen los bordes nítidos y matan el aliasing
      // de las paredes delgadas (ranuras/orejas) vistas de canto.
      let edges: Float32Array | undefined;
      try {
        const segs: number[] = [];
        for (const eg of K.enumerateEdgesGeom(oc, placed, 20))
          for (let i = 0; i + 1 < eg.polyline.length; i++) segs.push(...eg.polyline[i], ...eg.polyline[i + 1]);
        edges = new Float32Array(segs);
      } catch { /* overlay opcional */ }
      const isCav = def.role === 'A' || def.role === 'B';
      // "Historia" del componente (cómo se hizo la placa) — como Fusion.
      const nHoles = standardHoles(spec, def.role).length;
      const feats = [`Base: caja ${spec.widthMm}×${plateDepth(spec)}×${def.thick} mm`];
      if (ext > 0) feats.push(`Oreja ±${ext} mm + RANURA de sujeción fresada (clamp slot, Fig 1.4)`);
      if (isCav) { const id = insertDims(spec); feats.push(`Asiento de inserto: ${id.ifx}×${id.ify}×${def.role === 'A' ? id.Hc : id.Hk} mm`); }
      if (nHoles) feats.push(`Barrenos: ${nHoles} (pilares/tornillos/expulsores/KO)`);
      // Placas de cavidad/núcleo translúcidas (dejan ver pines/agua/pieza); acero opaco.
      // OPACAS las placas de acero (opacity<1 => transparent+depthWrite:false => las
      // paredes de los barrenos se pintan ENCIMA de las caras y parecen postes fantasma).
      out.push({ role: def.role, name: def.name, material: def.mat, positions: m.positions, normals: m.normals, indices: m.indices, color: PLATE_TINT[def.role] ?? STEEL, opacity: isCav ? 0.4 : 1, bodies: 1, features: feats, edges });
    } catch (e) { console.warn('MOLD_PLATE_FAIL', def.role, String(e).slice(0, 120)); /* placa que falla se omite */ }
  }
  // Componentes funcionales: lo que lo hace un MOLDE (pines, enfriamiento, guías, pieza, colada).
  try { out.push(...buildFunctionalParts(K, oc, spec, partMesh, sa, realSolids)); } catch { /* si fallan, al menos quedan las placas */ }
  // Montaje en la inyectora: bridas + platinas (fija/móvil).
  try { out.push(...buildMountParts(K, oc, spec)); } catch { /* opcional */ }
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
  const cavPlate = Math.round(d.placas.cavidad.plateThkMm ?? 56);   // placa A = inserto de CAVIDAD (§4.2.1)
  const corePlate = Math.round(d.placas.nucleo?.plateThkMm ?? cavPlate);   // placa B = inserto de NÚCLEO (§4.2.1), NO copiada de A
  const line = d.enfriamiento.lineas;
  const nCav = pkg.recomendacion.nCav;
  const win = pkg.variantes.find((v) => v.arch === pkg.recomendacion.arch && v.nCav === nCav);
  const code = 'MLD-' + (s.name || 'PIEZA').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return {
    name: `Molde ${s.name}`, code,
    // EJES (§4.3): `selectMoldBase` dimensiona wmm ↔ el ANCHO de la pieza (Wmm) y
    // lmm ↔ su LARGO (Lmm). La geometría pone `cavity.widthMm = s.Lmm` sobre X ⇒ X
    // aloja el LARGO ⇒ a X le toca **lmm**, y al fondo (Y) le toca **wmm**.
    // Estaban CRUZADOS: X recibía wmm (el lado corto) y el inserto largo no cabía —
    // el embudo metía 260.4 mm de inserto en 296 mm de placa (18 mm de pared) cuando
    // el libro ya había elegido 396 para ese lado. Cazado con las COTAS 3D.
    widthMm: Math.round(base.lmm || base.wmm) || Math.round(s.Lmm * 1.6),
    depthMm: Math.round(base.wmm || base.lmm) || Math.round(s.Wmm * 1.6),
    plates: {
      bottomClamp: 36, ejectorHousing: 66,
      support, B: corePlate, A: cavPlate, topClamp: 36,
    },
    supportPillars: d.placas.soporte.nPillars,
    // LA FORMA LA MANDA LA PIEZA, no el default. Estaba `shape: 'rect'` HARDCODEADO: el
    // camino redondo YA existía (`cavityFootprint` lo lee, el ejemplo del VASO del libro
    // lo usa) pero la Máquina jamás lo prendía ⇒ un tupper redondo ⌀140 salía con cavidad
    // CUADRADA de 140×140. "eso es un cuadrado" (user 2026-07-15, haciendo zoom).
    cavity: {
      widthMm: Math.round(s.Lmm), lenMm: Math.round(s.Wmm), depthMm: Math.round(s.Hmm),
      shape: s.cavityShape ?? 'rect',
      wallMm: s.wallMm,
      volMm3: s.volumeMm3,        // volumen REAL del sólido → masa del disparo (Eq 9.10)
    },
    // LA RESINA VIAJA CON EL MOLDE: sin esto el campo térmico no sabe de qué es la pieza
    // y corría ABS en silencio para todo. No se cae por defecto: se DECLARA (ThermalSim.material).
    plastic: s.plastic,
    // ⌀ de agua con PISO maquinable (~6.35 mm mínimo real); nunca el ⌀ físico
    // diminuto de piezas chicas (inmaquinable). Plug DME estándar por defecto.
    cooling: { diaMm: Math.max(6.35, +(line.plug?.diaMm ?? line.dMinMm).toFixed(2)), plug: line.plug?.dme ?? 'JP-251', insetMm: Math.round((base.wmm || s.Lmm) * 0.15) },
    // EL CEREBRO DECIDE EL TIPO (§11.2-5, autoEjectionPlan): un vaso PP de pared delgada
    // pide STRIPPER (empuja TODO el perímetro, esfuerzo uniforme — los pines la perforan);
    // una caja pide pines. Antes el pipeline clavaba 'pin' SIEMPRE, ignorando al cerebro.
    ejectors: (() => {
      try {
        // VASO = redondo + pared DELGADA (≤2) + hondo (H ≥ 0.35·lado). La flanera (Ø80·H40·
        // pared 1.2) es vaso → STRIPPER; el Tupper (caja rect) es box → PINES. La primera
        // heurística (H > lado/2) clasificó la flanera 40/80 como CAJA → el cerebro le puso
        // 63 pines y la placa B tardaba 25 s taladrándolos (cazado con PERF logs).
        const esVaso = s.cavityShape === 'round' && (s.wallMm ?? 2) <= 2 && s.Hmm >= 0.35 * Math.min(s.Lmm, s.Wmm);
        const plan = autoEjectionPlan({ kind: esVaso ? 'cup' : 'box', Lmm: s.Lmm, Wmm: s.Wmm, Hmm: s.Hmm, wallMm: s.wallMm ?? 2, draftDeg: s.dfm?.draftDeg ?? 2, round: s.cavityShape === 'round' }, s.plastic ?? 'ABS');
        return { type: plan.type as 'pin' | 'blade' | 'sleeve' | 'stripper', diaMm: plan.pinDiaMm ?? +Math.max(2, d.expulsion.pines.dMinMm).toFixed(2), count: plan.nPins ?? Math.max(4, 4 * nCav) };
      } catch { return { type: 'pin' as const, diaMm: +Math.max(2, d.expulsion.pines.dMinMm).toFixed(2), count: Math.max(4, 4 * nCav) }; }
    })(),
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
