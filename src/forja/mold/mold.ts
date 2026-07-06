/**
 * MOTOR DE MOLDES — cap 6 "Introduction to Mold Design" (Advanced SOLIDWORKS)
 * =============================================================================
 * Pipeline PURO (node-testeable, sin UI) que automatiza el diseño de moldes de
 * inyección/fundición a partir de una pieza B-Rep:
 *
 *   1. draftAnalysis()      — el Draft Analysis del libro: clasifica caras en
 *                             positivas/negativas/requieren-draft vs el pull.
 *   2. (draftFaces)         — ya en occt.ts: aplica el ángulo de salida.
 *   3. scaleForShrinkage()  — el Scale tool: contracción alrededor del centroide.
 *   4. splitMold()          — método 2 del libro (core & cavity): bloque hasta el
 *                             plano de partición − pieza escalada, shut-offs que
 *                             cortan los puentes de las ventanas, y separación
 *                             en CAVITY PLATE (mayor) + MACHO (menor) + placa.
 *   5. splitMoldByPlane()   — método 1 del libro (split mold): molde de dos
 *                             mitades partido por un plano (jabonera Figs 6-1..6-13).
 *
 * Lecciones pagadas (2026-07-03, molde tapa/tina — NO re-descubrir):
 *   - El bloque debe PELLIZCAR la pieza (la pieza sobresale `pinch` mm del
 *     bloque): caras coincidentes (kiss) NO separan los cuerpos en el boolean.
 *   - Las VENTANAS pasantes de la pieza PUENTEAN cavity↔macho: cada una necesita
 *     su lámina shut-off cruzando el espesor de pared COMPLETO (ojo paredes
 *     inclinadas: la lámina debe cubrir todo el recorrido en XY del muro).
 *   - El cut() de OCCT puede devolver UN solid con N shells disjuntos:
 *     keepSolid() ya reconstruye por shell.
 */
import {
  OC, Shape, SketchPlane3D, PLANE_XY,
  makeBox, transformShape, cut, fuse, volume, massProperties,
  scaleShape, keepSolid, uniqueSubShapes, enumerateFaces, tessellate,
} from '../brep/occt';

export interface ShutOffBox { w: number; d: number; h: number; x: number; y: number; z: number; }

export interface SplitMoldOptions {
  /** Contracción del material (libro: 1.05 tapa, 1.1 plastic cover). */
  scale?: number;
  /** Bloque del molde (mold base). Si falta, se auto-dimensiona del bbox de la pieza. */
  block?: ShutOffBox;
  /** z del plano de partición (top del bloque de la cavity). Si falta: z máx de la pieza escalada − pinch. */
  zPart?: number;
  /** Pellizco: cuánto SOBRESALE la pieza del bloque en la partición (default 0.5). */
  pinch?: number;
  /** Láminas shut-off que cortan los puentes de las ventanas pasantes. */
  shutOffs?: ShutOffBox[];
  /** Espesor de la placa portacore (Fig 6-34: 30). */
  plateThickness?: number;
  /** Lado de la placa portacore respecto a la partición: 'above' (tina, core entra por arriba) | 'below' (tapa, entra por abajo). */
  coreSide?: 'above' | 'below';
  /** Margen XY del bloque auto (default 40 por lado). */
  margin?: number;
}

export interface SplitMoldResult {
  cavityPlate: Shape;
  corePlate: Shape;
  macho: Shape;
  zPart: number;
  bodies: number;                 // cuerpos tras el split (2+ = separó)
  vols: { pieza: number; piezaEscalada: number; cavity: number; macho: number; core: number; molde: number };
  report: string[];
}

/** bbox por teselado (suficiente para dimensionar bloques de molde). */
export function shapeBBox(oc: OC, shape: Shape): { min: [number, number, number]; max: [number, number, number] } {
  const mesh = tessellate(oc, shape, 0.5, 0.5);
  const p = mesh.positions;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (p[i + k] < min[k]) min[k] = p[i + k];
      if (p[i + k] > max[k]) max[k] = p[i + k];
    }
  }
  return { min, max };
}

const mkBoxAt = (oc: OC, b: ShutOffBox): Shape =>
  transformShape(oc, makeBox(oc, b.w, b.d, b.h), { translate: [b.x - b.w / 2, b.y - b.d / 2, b.z - b.h / 2] });

const countBodies = (oc: OC, s: Shape): number => {
  const solids = uniqueSubShapes(oc, s, oc.TopAbs_ShapeEnum.TopAbs_SOLID);
  if (solids.length > 1) return solids.length;
  const shells = uniqueSubShapes(oc, s, oc.TopAbs_ShapeEnum.TopAbs_SHELL);
  return Math.max(1, shells.length);
};

/**
 * DRAFT ANALYSIS (Fig 6-17): clasifica las caras PLANAS de la pieza contra la
 * dirección de desmoldeo. verde=positiva, rojo=negativa, amarillo=requiere
 * (paredes casi verticales), neutral=tapas ⊥ pull, curved=no plana (el libro
 * las revisa aparte).
 */
export function draftAnalysis(
  oc: OC, shape: Shape,
  pullDir: [number, number, number] = [0, 0, 1],
  minAngleDeg = 1,
): { positive: number[]; negative: number[]; requiresDraft: number[]; neutral: number[]; curved: number[] } {
  const faces = enumerateFaces(oc, shape);
  const sinMin = Math.sin((minAngleDeg * Math.PI) / 180);
  const out = { positive: [] as number[], negative: [] as number[], requiresDraft: [] as number[], neutral: [] as number[], curved: [] as number[] };
  for (const f of faces) {
    const n = (f as { normal?: [number, number, number] }).normal;
    if (!n || f.kind !== 'plane') { out.curved.push(f.index); continue; }
    const dot = n[0] * pullDir[0] + n[1] * pullDir[1] + n[2] * pullDir[2];
    if (Math.abs(dot) > 0.94) out.neutral.push(f.index);            // tapa/base (>70° del muro)
    else if (dot > sinMin) out.positive.push(f.index);              // abre hacia el pull
    else if (dot < -sinMin) out.negative.push(f.index);             // draft negativo
    else out.requiresDraft.push(f.index);                           // casi vertical: amarillo
  }
  return out;
}

/** SCALE tool (Fig 6-18): contracción uniforme alrededor del centroide. */
export function scaleForShrinkage(oc: OC, shape: Shape, factor: number): Shape {
  const com = massProperties(oc, shape, 1).centerOfMass as [number, number, number];
  return scaleShape(oc, shape, factor, com);
}

/**
 * MÉTODO 2 del libro — molde CORE & CAVITY (tapa de carburador / plastic cover):
 * bloque hasta el plano de partición − pieza escalada → shut-offs → separar.
 */
export function splitMold(oc: OC, pieza: Shape, opts: SplitMoldOptions = {}): SplitMoldResult {
  const report: string[] = [];
  const scale = opts.scale ?? 1.05;
  const pinch = opts.pinch ?? 0.5;
  const plateT = opts.plateThickness ?? 30;
  const vPieza = volume(oc, pieza);
  const scaled = scaleForShrinkage(oc, pieza, scale);
  const vEsc = volume(oc, scaled);
  const bb = shapeBBox(oc, scaled);
  const zPart = opts.zPart ?? (bb.max[2] - pinch);
  const margin = opts.margin ?? 40;
  const block: ShutOffBox = opts.block ?? {
    w: (bb.max[0] - bb.min[0]) + 2 * margin,
    d: (bb.max[1] - bb.min[1]) + 2 * margin,
    h: (zPart - bb.min[2]) + margin,
    x: (bb.max[0] + bb.min[0]) / 2,
    y: (bb.max[1] + bb.min[1]) / 2,
    z: (zPart + (bb.min[2] - margin)) / 2,
  };
  // Bloque AUTO: su top queda en zPart (la pieza sobresale pinch). Un bloque
  // EXPLÍCITO del caller se respeta tal cual (la tapa pone la partición ABAJO).
  if (!opts.block) {
    const topZ = block.z + block.h / 2;
    if (Math.abs(topZ - zPart) > 1e-9) {
      const bottom = block.z - block.h / 2;
      block.h = zPart - bottom; block.z = (zPart + bottom) / 2;
    }
  }
  report.push(`bloque ${block.w}×${block.d}×${block.h.toFixed(2)} @(${block.x},${block.y},${block.z.toFixed(3)}) · partición z=${zPart.toFixed(4)} · escala ${scale}`);
  let molde = cut(oc, mkBoxAt(oc, block), scaled);
  for (const so of opts.shutOffs ?? []) {
    molde = cut(oc, molde, mkBoxAt(oc, so));
    report.push(`shut-off ${so.w}×${so.d}×${so.h} @(${so.x},${so.y},${so.z})`);
  }
  const vMolde = volume(oc, molde);
  const bodies = countBodies(oc, molde);
  report.push(`molde ${vMolde.toFixed(3)} mm³ · cuerpos: ${bodies}`);
  if (bodies < 2) report.push('⚠ PUENTE: cavity y macho siguen conectados — faltan shut-offs (ventanas pasantes / pared inclinada no cubierta)');
  const cavityPlate = keepSolid(oc, molde, 'largest');
  const macho = keepSolid(oc, molde, 'smallest');
  // placa portacore (Fig 6-34): descansa en la partición, ancho del bloque
  const side = opts.coreSide ?? 'above';
  const plateZ = side === 'above' ? zPart + plateT / 2 : zPart - plateT / 2;
  const plate = mkBoxAt(oc, { w: block.w, d: block.d, h: plateT, x: block.x, y: block.y, z: plateZ });
  const corePlate = fuse(oc, macho, plate);
  const vols = {
    pieza: vPieza, piezaEscalada: vEsc,
    cavity: volume(oc, cavityPlate), macho: volume(oc, macho), core: volume(oc, corePlate), molde: vMolde,
  };
  report.push(`cavity ${vols.cavity.toFixed(3)} · macho ${vols.macho.toFixed(3)} · core(+placa ${plateT}) ${vols.core.toFixed(3)}`);
  return { cavityPlate, corePlate, macho, zPart, bodies, vols, report };
}

/**
 * MÉTODO 1 del libro — SPLIT MOLD (Figs 6-6..6-13, jabonera): bloque − pieza
 * escalada, partido por un plano z=zSplit en placa superior e inferior.
 */
export function splitMoldByPlane(
  oc: OC, pieza: Shape,
  opts: { scale?: number; block?: ShutOffBox; zSplit?: number; margin?: number } = {},
): { top: Shape; bottom: Shape; vols: { top: number; bottom: number; molde: number }; report: string[] } {
  const report: string[] = [];
  const scaled = scaleForShrinkage(oc, pieza, opts.scale ?? 1.05);
  const bb = shapeBBox(oc, scaled);
  const margin = opts.margin ?? 40;
  const block: ShutOffBox = opts.block ?? {
    w: (bb.max[0] - bb.min[0]) + 2 * margin, d: (bb.max[1] - bb.min[1]) + 2 * margin,
    h: (bb.max[2] - bb.min[2]) + 2 * margin,
    x: (bb.max[0] + bb.min[0]) / 2, y: (bb.max[1] + bb.min[1]) / 2, z: (bb.max[2] + bb.min[2]) / 2,
  };
  const zSplit = opts.zSplit ?? (bb.min[2] + bb.max[2]) / 2;   // línea de partición: mitad de la pieza
  const molde = cut(oc, mkBoxAt(oc, block), scaled);
  const big = Math.max(block.w, block.d) + 20;
  const blockTop = block.z + block.h / 2, blockBot = block.z - block.h / 2;
  const top = cut(oc, molde, mkBoxAt(oc, { w: big, d: big, h: zSplit - blockBot, x: block.x, y: block.y, z: (zSplit + blockBot) / 2 }));
  const bottom = cut(oc, molde, mkBoxAt(oc, { w: big, d: big, h: blockTop - zSplit, x: block.x, y: block.y, z: (zSplit + blockTop) / 2 }));
  const vols = { top: volume(oc, top), bottom: volume(oc, bottom), molde: volume(oc, molde) };
  report.push(`split z=${zSplit.toFixed(3)} · top ${vols.top.toFixed(1)} + bottom ${vols.bottom.toFixed(1)} = ${(vols.top + vols.bottom).toFixed(1)} (molde ${vols.molde.toFixed(1)})`);
  return { top, bottom, vols, report };
}
