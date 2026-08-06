/**
 * EL CORTE VIVO — la LÓGICA (sin DOM, sin React, sin Canvas).
 * ============================================================================
 * "Esas vistas no me sirven de nada si no es en 3D e integrada a La Forja."
 *
 * Este módulo es la mitad testeable de `vista3d-corte.tsx`: arma el molde, mueve
 * el plano, triangula la CARA DEL CORTE y le pregunta las cotas a quien ya sabe
 * medirlas. NADA de lo que Kazmer juzga se reimplementa aquí:
 *
 *  · los SÓLIDOS del molde salen de `solidosDeMolde` (lamina-seccion.ts) — las
 *    mismas placas/insertos/agua/colada/expulsores que dibuja la lámina L5.
 *  · la SECCIÓN sale de `seccionarPorPlano` (el mismo motor de L5/L6/L7).
 *  · las COTAS y los VEREDICTOS salen de `medirSeccion` (§4.2.1, §4.2.2/§12.2.4,
 *    §9.2.5, §12.3.2). Aquí solo se le entrega la sección del plano ACTUAL.
 *
 * Lo único nuevo es geometría de presentación:
 *  · `tapaDeLazos` — triangula los lazos de la sección (contornos + huecos) para
 *    que la cara cortada se vea MACIZA. Sin esto un sólido recortado se ve hueco
 *    y parece un error (es la misma razón por la que `MoldSectionReveal` usa
 *    esténcil; aquí NO se puede: el Canvas del Estudio se crea sin buffer de
 *    esténcil (`gl={{ antialias:true, alpha:false }}`), así que la tapa se
 *    construye con la geometría REAL de la sección — que además la colorea por
 *    componente, que es lo que el achurado de L5 hace en 2D).
 *  · `sondaDelCorte` — qué componente hay bajo un punto de la cara del corte.
 *
 * REGLA DE LA CASA: lo no medido NUNCA se pinta como bueno. Si el plano no corta
 * un componente, su cota no existe (y `medirSeccion` la reporta SIN CABLEAR);
 * si el corte es HORIZONTAL (eje Z), las cotas de §4.2 no aplican y se dice.
 */
import { ShapeUtils, Vector2 } from 'three';

import type { MoldAssemblySpec } from './mold-assembly';
import { packageToAssemblySpec } from './mold-plano-set';
import { moldMachine } from './moldmachine';
import { cavityGrid, plateDepth } from './mold-drawing-set';
import { volumenArea, type Caja, type MallaSimple } from './estudio-vivo-datos';
import {
  solidosDeMolde, seccionarPorPlano, medirSeccion,
  type MallaSec, type MetaMolde, type PlanoCorte, type RolSeccion, type Seccion,
  type PiezaSeccionada, type MedidasSeccion, type EstadoV, type Vec3,
} from './lamina-seccion';

export type Eje = 'x' | 'y' | 'z';

/* ══════════════════════════════════════════════════════════════════════════ */
/* PALETA — el achurado de L5 se vuelve COLOR en 3D                           */
/* ══════════════════════════════════════════════════════════════════════════ */

/** `piel` = la superficie exterior del sólido · `corte` = la cara cortada (más
 *  clara: el acero recién fresado brilla, y así el corte se LEE como macizo) ·
 *  `linea` = las aristas de la sección. */
export const COLOR_ROL: Record<RolSeccion, { piel: string; corte: string; linea: string; opacidad: number }> = {
  placa:      { piel: '#39465c', corte: '#7e93b1', linea: '#cfe0f5', opacidad: 1 },
  inserto:    { piel: '#5b6f8c', corte: '#c2d8f2', linea: '#eaf3ff', opacidad: 1 },
  componente: { piel: '#8a6f21', corte: '#e8ca34', linea: '#ffe9a3', opacidad: 1 },
  moldeo:     { piel: '#c9701f', corte: '#ff9d4d', linea: '#ffd9b0', opacidad: 1 },
  agua:       { piel: '#1b6fa8', corte: '#2aa6e8', linea: '#bfe9ff', opacidad: 1 },
  colada:     { piel: '#9a8434', corte: '#e3c96a', linea: '#fff0b8', opacidad: 1 },
};

/**
 * ORDEN DE PINTADO de las tapas — es EL MISMO `ORDEN_ROL` con el que
 * `seccionarPorPlano` ordena las piezas (placa 10 · inserto 20 · moldeo 30 ·
 * colada 40 · componente 50 · agua 60), y aquí se vuelve DESEMPATE DE PROFUNDIDAD.
 *
 * Hace falta porque las tapas son COPLANARES por construcción: `solidosDeMolde`
 * NO resta los barrenos chicos de las placas ("el componente se dibuja ENCIMA"),
 * así que el pin de expulsión y la placa ocupan el MISMO plano en el corte. Sin
 * desempate, el z-buffer alterna entre los dos por pixel: el pin sale moteado
 * (z-fighting), que fue exactamente lo que se vio en la primera captura.
 */
export const ORDEN_TAPA: Record<RolSeccion, number> = {
  placa: 10, inserto: 20, moldeo: 30, colada: 40, componente: 50, agua: 60,
};

export const COLOR_ESTADO: Record<EstadoV, string> = {
  CUMPLE: '#59d98c', ADVIERTE: '#ffb347', VIOLA: '#ff5c5c', 'SIN CABLEAR': '#8fa3bd',
};

/** las láminas del pliego que este corte cubre cuando el plano cae donde toca */
export const LAMINAS_CUBIERTAS = [
  { id: 'L5', que: 'sección por el eje del sprue', como: 'eje X/Y con el corte en el bebedero' },
  { id: 'L7', que: 'detalle de la compuerta', como: 'el mismo plano, acercando la entrada' },
  { id: 'L9', que: 'núcleo con su enfriamiento', como: 'el corte cruza las líneas de agua del lado B' },
  { id: 'L18', que: 'térmico en sección', como: 'PENDIENTE: el campo T no está cableado a esta vista' },
  { id: 'L19', que: 'von Mises en sección', como: 'PENDIENTE: el campo σ no está cableado a esta vista' },
];

/* ══════════════════════════════════════════════════════════════════════════ */
/* EL SPEC — de lo que el Estudio tenga a mano a un MoldAssemblySpec           */
/* ══════════════════════════════════════════════════════════════════════════ */

export interface SpecResuelto {
  asm: MoldAssemblySpec;
  /** de dónde salió (se muestra: un molde inventado no se pinta como dato) */
  origen: string;
  /** supuesto que hubo que meter porque el Estudio no lo pasó (o null) */
  supuesto: string | null;
}

const esAssembly = (s: any) => !!s && typeof s === 'object' && typeof s.widthMm === 'number' && !!s.plates && !!s.cavity;
const esPaquete = (s: any) => !!s && typeof s === 'object' && !!s.diseno && !!s.base && !!s.recomendacion;
const esMachine = (s: any) => !!s && typeof s === 'object' && typeof s.Lmm === 'number' && typeof s.volumeMm3 === 'number';

/**
 * Acepta lo que el Estudio traiga: el spec de ensamble ya resuelto, el paquete
 * completo de la Máquina, el spec de entrada de `moldMachine`, o NADA — en cuyo
 * caso se arma uno desde la caja y la malla, DECLARANDO el supuesto (la pared
 * nominal no se puede adivinar de una bbox).
 */
export function asmDelEstudio(spec: any | null, caja: Caja, malla: MallaSimple, nombre = 'pieza'): SpecResuelto {
  if (esAssembly(spec)) return { asm: spec as MoldAssemblySpec, origen: 'spec de ensamble que ya traía el Estudio', supuesto: null };
  if (esPaquete(spec)) return { asm: packageToAssemblySpec(spec), origen: 'paquete de la Máquina de Moldes (moldMachine)', supuesto: null };
  if (esMachine(spec)) return { asm: packageToAssemblySpec(moldMachine(spec)), origen: 'spec de la Máquina que traía el Estudio', supuesto: null };

  const L = +(caja.x1 - caja.x0).toFixed(1), W = +(caja.y1 - caja.y0).toFixed(1), H = +(caja.z1 - caja.z0).toFixed(1);
  const va = volumenArea(malla);
  // pared nominal: de una bbox NO se deduce. Se usa 2 mm y se DECLARA — con ella
  // se dimensionan inserto y mejilla, así que el número no puede ir escondido.
  const paredSupuesta = 2;
  const asm = packageToAssemblySpec(moldMachine({
    name: nombre, Lmm: L, Wmm: W, Hmm: H,
    surfaceMm2: Math.round(va.areaMm2), volumeMm3: Math.round(va.volumeMm3),
    wallMm: paredSupuesta, plastic: 'ABS', annualVolume: 500_000,
  } as any));
  return {
    asm, origen: `molde derivado de la caja de la pieza (${L}×${W}×${H} mm)`,
    supuesto: `pared nominal ${paredSupuesta} mm SUPUESTA (el Estudio no pasó spec): con ella se dimensionaron inserto y mejilla`,
  };
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* EL MUNDO — el molde una sola vez, para que mover el corte no lo reconstruya */
/* ══════════════════════════════════════════════════════════════════════════ */

export interface Rango { min: number; max: number }

export interface MundoCorte {
  asm: MoldAssemblySpec;
  origen: string;
  supuesto: string | null;
  solidos: ReturnType<typeof solidosDeMolde>['solidos'];
  meta: MetaMolde;
  /** extensión del ENSAMBLE en cada eje (mm, coordenadas del molde) */
  rangos: Record<Eje, Rango>;
  /** dónde cae, en t∈[0,1], el plano del sprue (= la lámina L5) por eje */
  tSprue: Record<Eje, number>;
  /** centros de las IMPRESIONES (§4.2 `cavityGrid`) y su t por eje. En multi-
   *  cavidad el plano del sprue puede no cortar NINGUNA (el bebedero va al centro
   *  del molde y las impresiones alrededor): con esto la vista puede mandar al
   *  operador a una impresión de verdad en vez de dejarlo mirando acero. */
  impresiones: Array<{ cx: number; cy: number }>;
  tImpresiones: { x: number[]; y: number[] };
  /** por qué el corte del sprue puede verse "vacío" (o null si no aplica) */
  aviso: string | null;
  /** molde → coordenadas de la PIEZA que el Estudio ya tiene en escena.
   *  Con esto el moldeo cae EXACTAMENTE encima de la pieza del Estudio. */
  desfase: Vec3;
  nTriMoldeo: number;
  nTriMolde: number;
}

function rangoDe(solidos: MundoCorte['solidos'], k: 0 | 1 | 2): Rango {
  let min = Infinity, max = -Infinity;
  for (const s of solidos) {
    const P = s.malla.positions;
    for (let i = k; i < P.length; i += 3) { const v = P[i]; if (v < min) min = v; if (v > max) max = v; }
  }
  return Number.isFinite(min) ? { min, max } : { min: 0, max: 1 };
}

function bboxMalla(m: MallaSec) {
  const P = m.positions;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    if (P[i] < x0) x0 = P[i]; if (P[i] > x1) x1 = P[i];
    if (P[i + 1] < y0) y0 = P[i + 1]; if (P[i + 1] > y1) y1 = P[i + 1];
    if (P[i + 2] < z0) z0 = P[i + 2]; if (P[i + 2] > z1) z1 = P[i + 2];
  }
  return { x0, y0, z0, x1, y1, z1 };
}

/**
 * Arma el molde CERRADO alrededor de la malla real de la pieza.
 * El eje del sprue lo elige `planoDelSprue` POR DATO (no se le impone el eje de
 * corte: el molde es UNO y el plano lo recorre; imponerle el eje cambiaría la
 * orientación de los rieles cada vez que el operador cambia de vista, y eso ya
 * no sería el mismo molde).
 */
export function construirMundo(spec: any | null, caja: Caja, malla: MallaSimple, nombre = 'pieza'): MundoCorte {
  const { asm, origen, supuesto } = asmDelEstudio(spec, caja, malla, nombre);
  const mallaPieza: MallaSec = { positions: malla.positions, indices: malla.indices };
  const { solidos, meta } = solidosDeMolde(asm, { mallaPieza });

  const rangos: Record<Eje, Rango> = { x: rangoDe(solidos, 0), y: rangoDe(solidos, 1), z: rangoDe(solidos, 2) };
  const tDe = (e: Eje, v: number) => {
    const r = rangos[e]; const d = r.max - r.min;
    return d > 0 ? Math.max(0, Math.min(1, (v - r.min) / d)) : 0.5;
  };

  // registro con la pieza que el Estudio YA tiene en escena: el moldeo del molde
  // se construyó centrado en las impresiones; se corre el molde entero para que
  // caiga sobre la pieza (así el corte se ve donde el operador está mirando).
  const mol = solidos.find((s) => s.id === 'moldeo');
  const bm = mol ? bboxMalla(mol.malla) : null;
  const desfase: Vec3 = bm
    ? [(caja.x0 + caja.x1) / 2 - (bm.x0 + bm.x1) / 2, (caja.y0 + caja.y1) / 2 - (bm.y0 + bm.y1) / 2, caja.z0 - bm.z0]
    : [0, 0, 0];

  const cells = cavityGrid(asm, plateDepth(asm));
  const aviso = meta.nCavCortadas === 0 && cells.length > 1
    ? `molde de ${cells.length} impresiones: el plano del sprue pasa por el CENTRO del molde (${meta.xSprue}, ${meta.ySprue}) y NO corta ninguna impresión. Las impresiones están en x = ${cells.map((c) => c.cx).join(', ')} mm. Mueve el corte hasta una de ellas para ver cavidad, núcleo y pieza.`
    : null;

  return {
    asm, origen, supuesto, solidos, meta, rangos,
    tSprue: { x: tDe('x', meta.xSprue), y: tDe('y', meta.ySprue), z: tDe('z', meta.zPart) },
    impresiones: cells,
    tImpresiones: { x: cells.map((c) => tDe('x', c.cx)), y: cells.map((c) => tDe('y', c.cy)) },
    aviso,
    desfase,
    nTriMoldeo: mol ? Math.floor(mol.malla.indices.length / 3) : 0,
    nTriMolde: solidos.reduce((a, s) => a + Math.floor(s.malla.indices.length / 3), 0),
  };
}

/** coordenada (mm, sistema del molde) del corte para un t∈[0,1] */
export function corteEn(mundo: MundoCorte, eje: Eje, t: number): number {
  const r = mundo.rangos[eje];
  return r.min + Math.max(0, Math.min(1, t)) * (r.max - r.min);
}

/** El plano del corte. Las bases (u,v) son las MISMAS de la lámina L5:
 *  eje X → u=+Y, v=+Z · eje Y → u=+X, v=+Z · eje Z (planta) → u=+X, v=+Y. */
export function planoDelCorte(eje: Eje, c: number): PlanoCorte {
  if (eje === 'x') return { p0: [c, 0, 0], n: [1, 0, 0], arriba: [0, 0, 1] };
  if (eje === 'y') return { p0: [0, c, 0], n: [0, -1, 0], arriba: [0, 0, 1] };
  return { p0: [0, 0, c], n: [0, 0, 1], arriba: [0, 1, 0] };
}

/** de (u,v) del plano a un punto 3D en coordenadas del MOLDE */
export function uv3d(plano: Seccion['plano'], u: number, v: number): Vec3 {
  const d = plano.p0[0] * plano.n[0] + plano.p0[1] * plano.n[1] + plano.p0[2] * plano.n[2];
  return [
    u * plano.u[0] + v * plano.v[0] + d * plano.n[0],
    u * plano.u[1] + v * plano.v[1] + d * plano.n[1],
    u * plano.u[2] + v * plano.v[2] + d * plano.n[2],
  ];
}

/** de un punto 3D (coordenadas del molde) a (u,v) del plano */
export function xyz2uv(plano: Seccion['plano'], p: Vec3): [number, number] {
  return [
    p[0] * plano.u[0] + p[1] * plano.u[1] + p[2] * plano.u[2],
    p[0] * plano.v[0] + p[1] * plano.v[1] + p[2] * plano.v[2],
  ];
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* LA CARA DEL CORTE — lazos → triángulos (si no, se ve hueca)                 */
/* ══════════════════════════════════════════════════════════════════════════ */

export interface TapaGeom {
  /** vértices 3D en coordenadas del MOLDE (x,y,z aplanados) */
  positions: Float32Array;
  indices: Uint32Array;
  /** aristas de la sección (pares de puntos 3D aplanados) */
  bordes: Float32Array;
  /** lazos que no se pudieron triangular (se reportan, no se esconden) */
  falladas: number;
  areaMm2: number;
}

/** ¿el punto cae dentro del polígono? (cruce de rayo horizontal) */
function dentroDeLazo(pts: Array<[number, number]>, q: [number, number]): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/** ¿el punto cae en el MATERIAL de la pieza seccionada? (regla par-impar sobre
 *  TODOS sus lazos: un punto dentro de un hueco cruza dos veces ⇒ afuera) */
export function dentroDePieza(p: PiezaSeccionada, u: number, v: number): boolean {
  let dentro = false;
  for (const L of p.lazos) if (dentroDeLazo(L.pts as Array<[number, number]>, [u, v])) dentro = !dentro;
  return dentro;
}

/**
 * Triangula los lazos de UNA pieza seccionada: los de área positiva son
 * contornos y los de área negativa son huecos, que se asignan al contorno más
 * chico que los contiene (un barreno pertenece a la placa que lo aloja, no a la
 * primera que lo encierre).
 */
export function tapaDeLazos(p: PiezaSeccionada, plano: Seccion['plano']): TapaGeom | null {
  if (p.vacio || !p.lazos.length) return null;
  const ext = p.lazos.filter((L) => L.areaMm2 > 0);
  const hue = p.lazos.filter((L) => L.areaMm2 < 0);
  if (!ext.length) return null;

  const pos: number[] = [];
  const idx: number[] = [];
  let falladas = 0;
  let area = 0;

  // hueco → contorno más pequeño que lo contiene
  const dueño = hue.map((h) => {
    let mejor = -1, mejorA = Infinity;
    for (let i = 0; i < ext.length; i++) {
      const A = Math.abs(ext[i].areaMm2);
      if (A < mejorA && dentroDeLazo(ext[i].pts as Array<[number, number]>, h.pts[0] as [number, number])) { mejor = i; mejorA = A; }
    }
    return mejor;
  });

  ext.forEach((L, i) => {
    const contorno = L.pts.map((q) => new Vector2(q[0], q[1]));
    const huecos = hue.filter((_, k) => dueño[k] === i).map((h) => h.pts.map((q) => new Vector2(q[0], q[1])));
    let caras: number[][] = [];
    try {
      caras = ShapeUtils.triangulateShape(contorno, huecos);
    } catch {
      falladas++;
      return;
    }
    if (!caras.length) { falladas++; return; }
    const todos = contorno.concat(...huecos);
    const base = pos.length / 3;
    for (const q of todos) {
      const P = uv3d(plano, q.x, q.y);
      pos.push(P[0], P[1], P[2]);
    }
    for (const f of caras) idx.push(base + f[0], base + f[1], base + f[2]);
    area += L.areaMm2;
  });
  for (const h of hue) area += h.areaMm2;

  const B: number[] = [];
  for (const b of p.bordes) {
    const A = uv3d(plano, b[0], b[1]), C = uv3d(plano, b[2], b[3]);
    B.push(A[0], A[1], A[2], C[0], C[1], C[2]);
  }

  if (!idx.length) return null;
  return {
    positions: new Float32Array(pos), indices: new Uint32Array(idx),
    bordes: new Float32Array(B), falladas, areaMm2: area,
  };
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* LAS COTAS — se las pide a quien ya sabe medirlas (medirSeccion)             */
/* ══════════════════════════════════════════════════════════════════════════ */

/**
 * Las líneas de agua que ESTE plano corta transversalmente. `MetaMolde` trae las
 * del plano del sprue; al mover el corte hay que volver a preguntarlo o §9.2.5
 * mediría sobre ejes que ya no están ahí.
 *
 * Un canal cortado TRANSVERSALMENTE deja un círculo: el lazo mide ⌀ de ancho y
 * de alto. Cortado a lo largo deja un rectángulo largo — y ese NO es un eje, por
 * eso se descarta (medirle H daría un número que no es la profundidad de nada).
 */
export function lineasDelPlano(sec: Seccion, diaMm: number, zPart: number, eje: Eje): MetaMolde['lineasAgua'] {
  const agua = sec.piezas.find((p) => p.id === 'agua');
  if (!agua || agua.vacio) return [];
  const out: MetaMolde['lineasAgua'] = [];
  for (const L of agua.lazos) {
    if (L.areaMm2 <= 0) continue;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const q of L.pts) { u0 = Math.min(u0, q[0]); u1 = Math.max(u1, q[0]); v0 = Math.min(v0, q[1]); v1 = Math.max(v1, q[1]); }
    const w = u1 - u0, h = v1 - v0;
    const redondo = Math.abs(w - h) < 0.25 * diaMm && Math.abs(w - diaMm) < 0.35 * diaMm;
    if (!redondo) continue;
    const u = (u0 + u1) / 2, v = (v0 + v1) / 2;
    // en el corte horizontal (planta) v es Y, no Z: el lado A|B no se puede decir
    out.push({ u, v, lado: eje === 'z' ? 'B' : (v > zPart ? 'A' : 'B') });
  }
  return out;
}

export interface MedidasDelCorte {
  medidas: MedidasSeccion | null;
  /** por qué NO hay cotas (nunca se pintan verdes por omisión) */
  razon: string | null;
}

/**
 * Las cotas del libro sobre el plano ACTUAL. En el corte HORIZONTAL (eje Z) las
 * reglas de §4.2.1/§4.2.2/§9.2.5 no aplican: todas miden ALTURAS (v = Z) y en
 * planta v es Y. Se dice y no se dibuja nada — gris con su razón.
 */
export function medidasDelCorte(sec: Seccion, mundo: MundoCorte, eje: Eje): MedidasDelCorte {
  if (eje === 'z') {
    return {
      medidas: null,
      razon: 'las cotas de §4.2.1 (altura de inserto), §4.2.2/§12.2.4 (mejilla) y §9.2.5 (profundidad del agua) se miden en ALTURA sobre un corte VERTICAL. Este es un corte en PLANTA: aquí no hay alturas que medir. Cambia a eje X o Y.',
    };
  }
  const meta2: MetaMolde = {
    ...mundo.meta,
    eje,
    // el macho se mide a lo ancho del plano: con el corte por X se ve fy, con el
    // corte por Y se ve fx (V12.15 usa `meta.fy` como ancho del macho)
    fy: eje === 'x' ? mundo.meta.fy : mundo.meta.fx,
    lineasAgua: lineasDelPlano(sec, mundo.meta.diaAguaMm, mundo.meta.zPart, eje),
    nCavCortadas: sec.piezas.find((p) => p.id === 'moldeo')?.vacio === false ? 1 : 0,
  };
  return { medidas: medirSeccion(sec, meta2, mundo.asm), razon: null };
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* LA SONDA — qué componente hay bajo el dedo, sobre la cara del corte         */
/* ══════════════════════════════════════════════════════════════════════════ */

export interface Lectura { titulo: string; valor: string; nota?: string; seccion: string }

/** el componente de MÁS ARRIBA en el orden de pintado que contiene (u,v) */
export function sondaDelCorte(sec: Seccion, u: number, v: number): PiezaSeccionada | null {
  let mejor: PiezaSeccionada | null = null;
  for (const p of sec.piezas) {
    if (p.vacio) continue;
    if (!dentroDePieza(p, u, v)) continue;
    if (!mejor || p.orden >= mejor.orden) mejor = p;
  }
  return mejor;
}

const n2 = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');

/** §del libro que le toca a cada componente del corte */
const SECCION_ROL: Record<string, string> = {
  'p-bottom': '§1.3.1 · Fig 1.4', 'p-riel': '§1.3.1 · Fig 1.4', 'p-ejector': '§11.1', 'p-ejector-ret': '§11.1',
  'p-support': '§12.2.5', 'p-B': '§4.2.1', 'p-A': '§4.2.1', 'p-clamp': '§1.3.1',
  'i-cav': '§4.2.1-3 · Fig 4.13-4.16', 'i-core': '§4.2.1-3 · Fig 4.13-4.16',
  moldeo: '§2.3 · §1.3.2 Fig 1.6', agua: '§9.2 · §9.2.5 Fig 9.4', colada: '§6.3.1',
  pines: '§11.2', tornillos: '§12.3.2 · Fig 12.32',
};

/**
 * La LECTURA de la sonda: qué es, cuánto mide EN ESTE CORTE y qué cota del libro
 * le toca. Si la cota de ese componente no se pudo medir, se dice — no se calla.
 */
export function lecturaDeSonda(p: PiezaSeccionada, med: MedidasSeccion | null, mundo: MundoCorte, razonSinCotas: string | null): Lectura {
  const d = med?.datos ?? {};
  const seccion = SECCION_ROL[p.id] ?? '§1.3.2 · Fig 1.6';
  const nota: string[] = [];
  if (p.material) nota.push(`material ${p.material}`);
  if (p.nota) nota.push(p.nota);

  if (p.id === 'i-cav' && d.hInsertoA != null) nota.push(`H_ins A ${n2(+d.hInsertoA)} mm vs mínimo 3·⌀ = ${n2(+(d.limite3D ?? 0))} mm (§4.2.1)`);
  else if (p.id === 'i-core' && d.hInsertoB != null) nota.push(`H_ins B ${n2(+d.hInsertoB)} mm vs mínimo 3·⌀ = ${n2(+(d.limite3D ?? 0))} mm (§4.2.1)`);
  else if (p.id === 'moldeo' && d.hCavidadMm != null) nota.push(`profundidad de cavidad ${n2(+d.hCavidadMm)} mm · mejilla exigida ${n2(+(d.cheekExigidoMm ?? 0))} mm (manda ${d.cheekManda})`);
  else if (p.id === 'agua') {
    if (d.aguaHminMm != null) nota.push(`H_line ${n2(+d.aguaHminMm)} mm = ${n2(+(d.aguaHenD ?? 0), 2)}·⌀ (Eq 9.22 pide 2⌀ < H < 5⌀)`);
    else nota.push('este plano no corta ninguna línea TRANSVERSALMENTE: sin eje que medir, §9.2.5 no aplica aquí');
  } else if (p.id === 'tornillos' && d.tornCabezaDia != null) nota.push(`⌀cabeza ${n2(+d.tornCabezaDia)} / ⌀rosca ${n2(+(d.tornVastagoDia ?? 0))} mm (§12.3.2 pide 1.5×)`);
  if (razonSinCotas) nota.push(razonSinCotas);
  if (mundo.supuesto) nota.push(`⚠ ${mundo.supuesto}`);

  return {
    titulo: p.nombre,
    valor: `${n2(Math.abs(p.areaMm2), 0)} mm² de sección`,
    nota: nota.join(' · '),
    seccion,
  };
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* EL CORTE COMPLETO — lo que la vista dibuja y el arnés lee                   */
/* ══════════════════════════════════════════════════════════════════════════ */

export interface CorteVivo {
  eje: Eje;
  t: number;
  /** coordenada del plano (mm, sistema del molde) */
  c: number;
  plano: PlanoCorte;
  sec: Seccion;
  tapas: Array<{ pieza: PiezaSeccionada; geom: TapaGeom }>;
  med: MedidasDelCorte;
  /** ms que costó cortar + triangular (el arnés lo lee: "instantáneo" se mide) */
  ms: number;
  cortadas: number;
  areaMm2: number;
  falladas: number;
  abiertas: number;
  /** triángulos que caían ENTEROS en el plano (tangencia). Deben quedar en 0:
   *  una cara tangente no define sección y deja la tapa agujereada. */
  coplanares: number;
  /** cuánto hubo que correr el plano para salir de la tangencia (mm, declarado) */
  corrimientoMm: number;
}

/**
 * EL CORTE en una posición.
 *
 * TANGENCIA: si el plano cae EXACTAMENTE sobre una cara (pasa de verdad — el
 * molde de 4 impresiones de la tapa pone el bebedero en x=123 y la bolsa del
 * inserto termina en x=123.0 clavado), esos triángulos caen enteros en el plano:
 * `cortarMalla` los cuenta como `coplanares` y NO emite lazo, así que la tapa
 * sale AGUJEREADA justo ahí y la piel parpadea (se vio en la captura de la tapa
 * médica). Una cara tangente no define sección: el plano se corre una centésima
 * de milímetro y se DECLARA el corrimiento — no se esconde.
 */
export function cortar(mundo: MundoCorte, eje: Eje, t: number): CorteVivo {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const c0 = corteEn(mundo, eje, t);
  const cuenta = (s: Seccion) => s.piezas.reduce((a, p) => a + p.coplanares, 0);
  let c = c0;
  let plano = planoDelCorte(eje, c);
  let sec = seccionarPorPlano(mundo.solidos, plano);
  let corrimiento = 0;
  if (cuenta(sec) > 0) {
    const r = mundo.rangos[eje];
    corrimiento = Math.max(0.01, (r.max - r.min) * 1e-5);
    c = c0 + corrimiento;
    plano = planoDelCorte(eje, c);
    sec = seccionarPorPlano(mundo.solidos, plano);
  }
  const tapas: CorteVivo['tapas'] = [];
  let falladas = 0, abiertas = 0;
  for (const p of sec.piezas) {
    abiertas += p.abiertas;
    const g = tapaDeLazos(p, sec.plano);
    if (g) { tapas.push({ pieza: p, geom: g }); falladas += g.falladas; }
    else if (!p.vacio) falladas++;
  }
  const med = medidasDelCorte(sec, mundo, eje);
  return {
    eje, t, c, plano, sec, tapas, med,
    ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0),
    cortadas: sec.piezas.filter((p) => !p.vacio).length,
    areaMm2: sec.areaTotalMm2, falladas, abiertas,
    coplanares: cuenta(sec), corrimientoMm: +corrimiento.toFixed(4),
  };
}
