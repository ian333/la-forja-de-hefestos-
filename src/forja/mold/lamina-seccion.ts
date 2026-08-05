/**
 * L5 · SECCIÓN DEL MOLDE POR EL EJE DEL SPRUE (molde cerrado) — Fig 1.6 de Kazmer.
 * ============================================================================
 * La sección canónica del libro: *"Top and cross section views of a two-plate mold"*
 * (§1.3.2, Fig 1.6), con **achurado distinto por componente**, insertos, placas,
 * líneas de agua CORTADAS, colada y expulsores. De un vistazo se juzgan once
 * verificaciones que el libro reparte en cinco capítulos:
 *
 *   V1.1   §1.3.2 Fig 1.6 — la vista de nomenclatura (sin criterio bueno/malo)
 *   V4.7   §4.2.1 Fig 4.13 — altura del inserto ≥ 3·⌀ de la línea de agua
 *   V4.8   §4.2.2 Fig 4.14 — mejilla (cheek): 3·⌀ por lado vs. W_cheek = H_cavity
 *   V4.9   §4.2.3 Fig 4.15-4.16 — inserto redondo (torneable) vs. rectangular
 *   V9.1   §9.2.5 Fig 9.4 — profundidad de la línea de agua MEDIDA EN DIÁMETROS
 *   V11.2  §11.2.1-2 Fig 11.5-11.7 — vectores de expulsión y área efectiva
 *   V12.10 §12.2.4 Fig 12.18 — la regla del cheek otra vez (cortante y flexión)
 *   V12.14 §12.2.7 Fig 12.26 — carga del inserto de núcleo
 *   V12.15 §12.2.7 Fig 12.28 — interlock del núcleo esbelto contra la cavidad
 *   V12.18 §12.3.2 Fig 12.32 — proporciones de la cabeza del tornillo
 *   V13.4  §13.9 Fig 13.29 — split cavity: el cheek por tercera vez
 *
 * ═══ LO QUE ES LITERAL Y LO QUE ES EXTENSIÓN ════════════════════════════════
 * Ningún umbral de este archivo se inventó. Cada cota trae su § y su cita textual
 * en el punto donde se usa. Lo que el libro NO da queda marcado EXTENSIÓN
 * DECLARADA en el comentario Y en la propia lámina, y lo que todavía no se puede
 * medir sale como **SIN CABLEAR** — nunca verde.
 *
 * ═══ LA MÁQUINA DE CORTE ES REUSABLE (L6 y L7 la consumen) ══════════════════
 * `seccionarPorPlano(solidos, plano)` NO sabe nada de moldes: corta una lista de
 * sólidos (mallas de triángulos con normales salientes) por un plano y devuelve,
 * por sólido, los LAZOS CERRADOS de la sección con su área con signo, su bbox y
 * las aristas que hay que trazar. Con eso:
 *   · L6 (secuencia de apertura) = la MISMA lista de sólidos con `mover` distinto
 *     por pose (cada sólido lleva su desplazamiento) → cuatro llamadas, cuatro
 *     secciones, misma escala. No hace falta tocar el cortador.
 *   · L7 (detalle de compuerta) = la MISMA sección con otra ventana de encuadre
 *     (`ventana` en el dibujo) y otros sólidos en la lista (gate + runner).
 * El corte trabaja sobre MALLAS, así que sirve igual para el molde paramétrico de
 * aquí que para las mallas reales del kernel (`buildMoldParts`) o del cliente.
 */
import type { MoldAssemblySpec } from './mold-assembly';
import type { Lamina } from './laminas-visuales';
import {
  plateDefs, plateDepth, insertDims, cavityGrid, cavityFootprint,
  coolingCircuit, standardHoles, moldBoltSizing,
} from './mold-drawing-set';
import { plateStackZ } from './mold-plano-set';
import { coolingLineDia } from './moldbase';
import { sprueDesignFromCavity } from './feed';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export interface MallaSec {
  positions: ArrayLike<number>;
  indices: ArrayLike<number>;
}

/** El rol decide el ACHURADO (Fig 1.6 usa un patrón distinto por componente). */
export type RolSeccion = 'placa' | 'inserto' | 'componente' | 'moldeo' | 'agua' | 'colada';

export interface SolidoSeccion {
  id: string;
  nombre: string;
  rol: RolSeccion;
  malla: MallaSec;
  material?: string;
  /** desplazamiento al cortar — es lo que L6 usa para las poses de apertura */
  mover?: Vec3;
  /** orden de pintado (mayor = encima). Por defecto lo fija el rol. */
  orden?: number;
  /** nota corta para la leyenda */
  nota?: string;
}

export interface PlanoCorte {
  /** un punto del plano (mm) */
  p0: Vec3;
  /** normal (dirección de mirada; se normaliza) */
  n: Vec3;
  /** qué dirección va ARRIBA en la lámina (por defecto +Z) */
  arriba?: Vec3;
}

export interface LazoSeccion {
  /** vértices (u,v) del plano, en mm y en coordenadas de MUNDO proyectadas:
   *  con el corte estándar (n=+X, arriba=+Z) → u = Y de la máquina, v = Z. */
  pts: Vec2[];
  /** área CON SIGNO: positiva = contorno exterior, negativa = hueco */
  areaMm2: number;
}

export interface PiezaSeccionada {
  id: string; nombre: string; rol: RolSeccion; material?: string; nota?: string;
  orden: number;
  lazos: LazoSeccion[];
  /** suma de áreas con signo = área REAL de la sección de ese sólido */
  areaMm2: number;
  bbox: { u0: number; u1: number; v0: number; v1: number } | null;
  /** aristas a TRAZAR: las compartidas por dos lazos del mismo sólido (fruto de
   *  descomponerlo en cajas disjuntas) se suprimen — si no, la placa saldría con
   *  rayas donde no hay ninguna arista real. */
  bordes: Array<[number, number, number, number]>;
  /** cadenas que NO cerraron (malla abierta o no soldable). Se reportan, no se esconden. */
  abiertas: number;
  /** triángulos que caían ENTEROS en el plano de corte (tangencia; área nula) */
  coplanares: number;
  /** el plano no toca este sólido */
  vacio: boolean;
  /** distancia mínima |d| del sólido al plano (0 si lo corta) */
  distanciaMm: number;
  /** bbox de la PROYECCIÓN del sólido al plano (para el fantasma punteado) */
  sombra: { u0: number; u1: number; v0: number; v1: number } | null;
}

export interface Seccion {
  plano: { p0: Vec3; n: Vec3; u: Vec3; v: Vec3 };
  piezas: PiezaSeccionada[];
  /** Σ de las áreas de las piezas (con signo). Si los sólidos son disjuntos, es
   *  exactamente el área de la sección del ensamble. */
  areaTotalMm2: number;
  bbox: { u0: number; u1: number; v0: number; v1: number } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTRUCTORES DE MALLA (normales SALIENTES — el gate lo verifica por volumen)
// ─────────────────────────────────────────────────────────────────────────────

export interface Rect { x0: number; y0: number; x1: number; y1: number }

/** Caja alineada a ejes: 8 vértices, 12 triángulos, normales hacia AFUERA. */
export function mallaCaja(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): MallaSec {
  const P = [
    x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0,
    x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1,
  ];
  const I = [
    0, 3, 2, 0, 2, 1,   // −Z
    4, 5, 6, 4, 6, 7,   // +Z
    0, 1, 5, 0, 5, 4,   // −Y
    2, 3, 7, 2, 7, 6,   // +Y
    1, 2, 6, 1, 6, 5,   // +X
    3, 0, 4, 3, 4, 7,   // −X
  ];
  return { positions: P, indices: I };
}

/** Pega varias mallas en UNA (los sólidos compuestos por cajas disjuntas son un
 *  solo componente del molde: una placa con su asiento maquinado, por ejemplo). */
export function unirMallas(ms: MallaSec[]): MallaSec {
  const P: number[] = [], I: number[] = [];
  for (const m of ms) {
    const base = P.length / 3;
    for (let i = 0; i < m.positions.length; i++) P.push(m.positions[i]);
    for (let i = 0; i < m.indices.length; i++) I.push(base + m.indices[i]);
  }
  return { positions: P, indices: I };
}

/** Cilindro (o cono truncado si r1≠r0) con el eje en X, Y o Z.
 *  `fase` gira los facetados: con `fase=0` y `n` PAR hay vértices exactamente en
 *  el plano que pasa por el eje, y la sección es EXACTA (2·r·h). Con media faceta
 *  de fase, la sección exacta es 2·r·cos(π/n)·h — las dos son analíticas y el gate
 *  usa ambas (la primera prueba el caso degenerado plano-por-vértice, la segunda
 *  la interpolación sobre la arista). */
export function mallaCilindro(o: {
  eje: 'x' | 'y' | 'z';
  /** posición del eje en las OTRAS dos coordenadas (orden cíclico: x→(y,z), y→(z,x), z→(x,y)) */
  c1: number; c2: number;
  a0: number; a1: number;
  r: number; r1?: number; n?: number; fase?: number;
}): MallaSec {
  const n = Math.max(6, o.n ?? 48), fase = o.fase ?? 0;
  const rA = o.r, rB = o.r1 ?? o.r;
  const P: number[] = [], I: number[] = [];
  // mapea (eje, s, t) → (x,y,z) según el eje, manteniendo la terna derecha
  const map = (a: number, s: number, t: number): Vec3 =>
    o.eje === 'x' ? [a, s, t] : o.eje === 'y' ? [t, a, s] : [s, t, a];
  const push = (p: Vec3) => { P.push(p[0], p[1], p[2]); return P.length / 3 - 1; };
  const anillo = (a: number, r: number) => {
    const base = P.length / 3;
    for (let i = 0; i < n; i++) {
      const th = fase + (i / n) * 2 * Math.PI;
      push(map(a, o.c1 + r * Math.cos(th), o.c2 + r * Math.sin(th)));
    }
    return base;
  };
  const A = anillo(o.a0, rA), B = anillo(o.a1, rB);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    I.push(A + i, A + j, B + j, A + i, B + j, B + i);      // pared, normal hacia afuera
  }
  const cA = push(map(o.a0, o.c1, o.c2)), cB = push(map(o.a1, o.c1, o.c2));
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    I.push(cA, A + j, A + i);                              // tapa a0 (normal −eje)
    I.push(cB, B + i, B + j);                              // tapa a1 (normal +eje)
  }
  return { positions: P, indices: I };
}

/** Vaso de revolución: cilindro exterior ⌀de con fondo ARRIBA y boca ABAJO
 *  (la cáscara del vaso del libro tal como se moldea: la boca mira a la placa B).
 *  Sólido cerrado y válido: pared exterior + pared interior + corona de la boca +
 *  disco del fondo + techo interior. */
export function mallaVaso(o: {
  cx: number; cy: number; z0: number; z1: number;
  rExt: number; pared: number; n?: number; fase?: number;
}): MallaSec {
  const n = Math.max(8, o.n ?? 64), fase = o.fase ?? 0;
  const rInt = Math.max(0.01, o.rExt - o.pared), zTecho = o.z1 - o.pared;
  const P: number[] = [], I: number[] = [];
  const anillo = (r: number, z: number) => {
    const base = P.length / 3;
    for (let i = 0; i < n; i++) {
      const th = fase + (i / n) * 2 * Math.PI;
      P.push(o.cx + r * Math.cos(th), o.cy + r * Math.sin(th), z);
    }
    return base;
  };
  const each = (f: (i: number, j: number) => void) => { for (let i = 0; i < n; i++) f(i, (i + 1) % n); };
  const EA = anillo(o.rExt, o.z0), EB = anillo(o.rExt, o.z1);
  const IA = anillo(rInt, o.z0), IB = anillo(rInt, zTecho);
  each((i, j) => I.push(EA + i, EA + j, EB + j, EA + i, EB + j, EB + i));   // exterior (afuera)
  each((i, j) => I.push(IA + i, IB + i, IB + j, IA + i, IB + j, IA + j));   // interior (hacia el eje)
  each((i, j) => I.push(IA + i, IA + j, EA + j, IA + i, EA + j, EA + i));   // corona de la boca (−Z)
  const cT = P.length / 3; P.push(o.cx, o.cy, o.z1);
  each((i, j) => I.push(cT, EB + i, EB + j));                              // fondo exterior (+Z)
  const cI = P.length / 3; P.push(o.cx, o.cy, zTecho);
  each((i, j) => I.push(cI, IB + j, IB + i));                              // techo interior (−Z)
  return { positions: P, indices: I };
}

/**
 * RESTA DE RECTÁNGULOS — descompone `base − huecos` en rectángulos DISJUNTOS.
 * Es lo que convierte "placa con asiento de inserto" en un sólido honesto (la
 * placa NO ocupa el volumen del asiento) sin necesidad de booleanas de malla.
 * La suma de áreas de los rectángulos devueltos es exactamente
 * área(base) − Σ área(base ∩ hueco) cuando los huecos son disjuntos entre sí.
 */
export function restarRects(base: Rect, huecos: Rect[]): Rect[] {
  const cl = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const xs = new Set([base.x0, base.x1]), ys = new Set([base.y0, base.y1]);
  const hs = huecos.filter((h) => h.x1 > base.x0 && h.x0 < base.x1 && h.y1 > base.y0 && h.y0 < base.y1);
  for (const h of hs) {
    xs.add(cl(h.x0, base.x0, base.x1)); xs.add(cl(h.x1, base.x0, base.x1));
    ys.add(cl(h.y0, base.y0, base.y1)); ys.add(cl(h.y1, base.y0, base.y1));
  }
  const X = [...xs].sort((a, b) => a - b), Y = [...ys].sort((a, b) => a - b);
  const out: Rect[] = [];
  for (let j = 0; j + 1 < Y.length; j++) {
    let corrida: Rect | null = null;
    for (let i = 0; i + 1 < X.length; i++) {
      const mx = (X[i] + X[i + 1]) / 2, my = (Y[j] + Y[j + 1]) / 2;
      const dentro = hs.some((h) => mx > h.x0 && mx < h.x1 && my > h.y0 && my < h.y1);
      if (dentro) { if (corrida) { out.push(corrida); corrida = null; } continue; }
      // fusiona celdas contiguas de la misma fila (menos cajas, mismo sólido)
      if (corrida && Math.abs(corrida.x1 - X[i]) < 1e-12) corrida.x1 = X[i + 1];
      else { if (corrida) out.push(corrida); corrida = { x0: X[i], y0: Y[j], x1: X[i + 1], y1: Y[j + 1] }; }
    }
    if (corrida) out.push(corrida);
  }
  return out;
}

/** Placa prismática con BOLSAS rectangulares (asientos de inserto, ventanas).
 *  Cada bolsa vale en su franja de Z; el resultado es una unión de cajas DISJUNTAS. */
export function mallaPlacaConBolsas(
  planta: Rect, z0: number, z1: number,
  bolsas: Array<{ rect: Rect; z0: number; z1: number }> = [],
): MallaSec {
  const cortes = new Set([z0, z1]);
  for (const b of bolsas) {
    if (b.z1 > z0 && b.z0 < z1) { cortes.add(Math.max(z0, b.z0)); cortes.add(Math.min(z1, b.z1)); }
  }
  const Z = [...cortes].sort((a, b) => a - b);
  const trozos: MallaSec[] = [];
  for (let k = 0; k + 1 < Z.length; k++) {
    const zm = (Z[k] + Z[k + 1]) / 2;
    const activos = bolsas.filter((b) => zm > b.z0 && zm < b.z1).map((b) => b.rect);
    for (const r of restarRects(planta, activos))
      trozos.push(mallaCaja(r.x0, r.y0, Z[k], r.x1, r.y1, Z[k + 1]));
  }
  return trozos.length ? unirMallas(trozos) : { positions: [], indices: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// LA MÁQUINA DE CORTE (reusable por L5, L6 y L7)
// ─────────────────────────────────────────────────────────────────────────────

const cruz = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const punto = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalizar = (a: Vec3): Vec3 => { const L = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / L, a[1] / L, a[2] / L]; };

/**
 * Base ortonormal del plano: `w` = normal (mirada), `v` = "arriba" de la lámina,
 * `u` = horizontal. Cumple u × v = w, así que el área con signo por la regla del
 * zapatero sale POSITIVA para los contornos exteriores.
 */
export function baseDelPlano(pl: PlanoCorte): { w: Vec3; u: Vec3; v: Vec3 } {
  const w = normalizar(pl.n);
  let arr = pl.arriba ?? [0, 0, 1];
  if (Math.abs(punto(normalizar(arr), w)) > 0.999) arr = [0, 1, 0];        // "arriba" paralelo a la mirada
  const d = punto(arr, w);
  const v = normalizar([arr[0] - d * w[0], arr[1] - d * w[1], arr[2] - d * w[2]]);
  const u = cruz(v, w);                                                     // u × v = w
  return { w, u, v };
}

/** Suelda vértices coincidentes: el encadenado de la sección es COMBINATORIO
 *  (cada punto se identifica por la arista o el vértice del que sale), y eso solo
 *  funciona si las caras vecinas comparten índice. Sin soldar, una malla de STL
 *  (tres vértices por triángulo) no cerraría ni un lazo. */
function soldar(P: ArrayLike<number>, I: ArrayLike<number>, off: Vec3, tol = 1e-4) {
  const nv = P.length / 3;
  const celdas = new Map<string, number[]>();
  const pos: number[] = [];
  const remap = new Int32Array(nv);
  for (let i = 0; i < nv; i++) {
    const x = P[3 * i] + off[0], y = P[3 * i + 1] + off[1], z = P[3 * i + 2] + off[2];
    const ci = Math.floor(x / tol), cj = Math.floor(y / tol), ck = Math.floor(z / tol);
    let hallado = -1;
    for (let di = -1; di <= 1 && hallado < 0; di++)
      for (let dj = -1; dj <= 1 && hallado < 0; dj++)
        for (let dk = -1; dk <= 1 && hallado < 0; dk++) {
          const arr = celdas.get(`${ci + di},${cj + dj},${ck + dk}`);
          if (!arr) continue;
          for (const q of arr)
            if (Math.abs(pos[3 * q] - x) <= tol && Math.abs(pos[3 * q + 1] - y) <= tol && Math.abs(pos[3 * q + 2] - z) <= tol) { hallado = q; break; }
        }
    if (hallado < 0) {
      hallado = pos.length / 3; pos.push(x, y, z);
      const k = `${ci},${cj},${ck}`; const a = celdas.get(k); if (a) a.push(hallado); else celdas.set(k, [hallado]);
    }
    remap[i] = hallado;
  }
  const idx = new Int32Array(I.length);
  for (let t = 0; t < I.length; t++) idx[t] = remap[I[t]];
  return { pos, idx };
}

interface Seg { ia: string; ib: string; pa: Vec2; pb: Vec2 }

/** Corta UNA malla por el plano y devuelve lazos cerrados en coordenadas (u,v). */
function cortarMalla(
  malla: MallaSec, off: Vec3, p0: Vec3, w: Vec3, u: Vec3, v: Vec3,
): { lazos: LazoSeccion[]; abiertas: number; coplanares: number; sombra: { u0: number; u1: number; v0: number; v1: number } | null; distancia: number; degeneradas: number } {
  const { pos, idx } = soldar(malla.positions, malla.indices, off);
  const nv = pos.length / 3;
  if (!nv) return { lazos: [], abiertas: 0, coplanares: 0, sombra: null, distancia: Infinity, degeneradas: 0 };
  const d = new Float64Array(nv);
  let escala = 1, su0 = Infinity, su1 = -Infinity, sv0 = Infinity, sv1 = -Infinity, dmin = Infinity;
  for (let i = 0; i < nv; i++) {
    const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
    d[i] = (x - p0[0]) * w[0] + (y - p0[1]) * w[1] + (z - p0[2]) * w[2];
    escala = Math.max(escala, Math.abs(x), Math.abs(y), Math.abs(z));
    dmin = Math.min(dmin, Math.abs(d[i]));
    const a = x * u[0] + y * u[1] + z * u[2], b = x * v[0] + y * v[1] + z * v[2];
    if (a < su0) su0 = a; if (a > su1) su1 = a; if (b < sv0) sv0 = b; if (b > sv1) sv1 = b;
  }
  const eps = 1e-9 * escala;
  const sg = (i: number) => (d[i] > eps ? 1 : d[i] < -eps ? -1 : 0);
  const proy = (x: number, y: number, z: number): Vec2 => [x * u[0] + y * u[1] + z * u[2], x * v[0] + y * v[1] + z * v[2]];

  const segs: Seg[] = [];
  let coplanares = 0;
  const nTri = Math.floor(idx.length / 3);
  for (let t = 0; t < nTri; t++) {
    const a = idx[3 * t], b = idx[3 * t + 1], c = idx[3 * t + 2];
    const sa = sg(a), sb = sg(b), sc = sg(c);
    if (sa > 0 && sb > 0 && sc > 0) continue;
    if (sa < 0 && sb < 0 && sc < 0) continue;
    if (sa === 0 && sb === 0 && sc === 0) { coplanares++; continue; }
    const ids: string[] = []; const pts: Vec2[] = [];
    const add = (id: string, x: number, y: number, z: number) => {
      if (ids.indexOf(id) >= 0) return;
      ids.push(id); pts.push(proy(x, y, z));
    };
    const vs = [a, b, c], ss = [sa, sb, sc];
    // ARISTA ENTERA EN EL PLANO: las DOS caras que la comparten la verían y la
    // emitirían con la MISMA orientación (sus normales apuntan al mismo lado del
    // plano) ⇒ el lazo se recorrería dos veces y el área saldría al doble. Medido:
    // un cilindro cortado por su eje con vértices sobre el plano daba 1200 mm² en
    // vez de 600. Se emite solo desde la cara del lado NEGATIVO: en un cruce real
    // hay exactamente una, y en una tangencia (las dos caras del mismo lado) o no
    // hay ninguna o las dos quedan como cadena abierta reportada, nunca área falsa.
    if (ss[0] * ss[1] * ss[2] === 0 && (sa + sb + sc) > 0 && [sa, sb, sc].filter((s) => s === 0).length === 2) continue;
    for (let k = 0; k < 3; k++)
      if (ss[k] === 0) add(`v${vs[k]}`, pos[3 * vs[k]], pos[3 * vs[k] + 1], pos[3 * vs[k] + 2]);
    for (let k = 0; k < 3; k++) {
      const i0 = vs[k], i1 = vs[(k + 1) % 3];
      if (ss[k] * ss[(k + 1) % 3] >= 0) continue;
      // interpolación CANÓNICA (siempre desde el índice menor) para que las dos
      // caras que comparten la arista produzcan el MISMO punto bit a bit
      const lo = Math.min(i0, i1), hi = Math.max(i0, i1);
      const tt = d[lo] / (d[lo] - d[hi]);
      add(`e${lo}_${hi}`,
        pos[3 * lo] + tt * (pos[3 * hi] - pos[3 * lo]),
        pos[3 * lo + 1] + tt * (pos[3 * hi + 1] - pos[3 * lo + 1]),
        pos[3 * lo + 2] + tt * (pos[3 * hi + 2] - pos[3 * lo + 2]));
    }
    if (ids.length !== 2) continue;              // toque en un punto, o cara coplanar
    // ORIENTACIÓN: el interior queda a la IZQUIERDA ⇒ tangente = w × n_cara.
    const ax = pos[3 * a], ay = pos[3 * a + 1], az = pos[3 * a + 2];
    const e1: Vec3 = [pos[3 * b] - ax, pos[3 * b + 1] - ay, pos[3 * b + 2] - az];
    const e2: Vec3 = [pos[3 * c] - ax, pos[3 * c + 1] - ay, pos[3 * c + 2] - az];
    const nt = cruz(e1, e2);
    const tg: Vec2 = [-punto(nt, v), punto(nt, u)];       // (w × n) proyectado a (u,v)
    const dir: Vec2 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]];
    const alineado = dir[0] * tg[0] + dir[1] * tg[1] >= 0;
    segs.push(alineado
      ? { ia: ids[0], ib: ids[1], pa: pts[0], pb: pts[1] }
      : { ia: ids[1], ib: ids[0], pa: pts[1], pb: pts[0] });
  }

  // TANGENCIAS: si una arista de la malla vive EXACTAMENTE en el plano y el sólido
  // solo la roza, las dos caras vecinas emiten el mismo segmento en sentidos
  // opuestos. Se cancelan (área nula) — mejor borrarlos que dejar que ensucien el
  // encadenado de los lazos de verdad.
  const porPar = new Map<string, number[]>();
  segs.forEach((s, i) => { const k = `${s.ia}|${s.ib}`; const a = porPar.get(k); if (a) a.push(i); else porPar.set(k, [i]); });
  const muertos = new Set<number>();
  for (const [k, arr] of porPar) {
    const [ia, ib] = k.split('|');
    const rev = porPar.get(`${ib}|${ia}`);
    if (!rev) continue;
    const n = Math.min(arr.length, rev.length);
    for (let i = 0; i < n; i++) { muertos.add(arr[i]); muertos.add(rev[i]); }
  }

  // ENCADENADO por identidad de punto (exacto, sin tolerancias)
  const salida = new Map<string, number[]>();
  segs.forEach((s, i) => { if (muertos.has(i)) return; const a = salida.get(s.ia); if (a) a.push(i); else salida.set(s.ia, [i]); });
  const usado = new Array(segs.length).fill(false);
  const lazos: LazoSeccion[] = [];
  let abiertas = 0, degeneradas = 0;
  for (let i = 0; i < segs.length; i++) {
    if (usado[i] || muertos.has(i)) continue;
    const pts: Vec2[] = [];
    let cur = i, cerrado = false;
    const idInicio = segs[i].ia;
    for (let guard = 0; guard <= segs.length + 1; guard++) {
      usado[cur] = true;
      pts.push(segs[cur].pa);
      const sig = (salida.get(segs[cur].ib) ?? []).find((k) => !usado[k]);
      if (sig == null) { cerrado = segs[cur].ib === idInicio; break; }
      cur = sig;
    }
    if (!cerrado) abiertas++;
    let A = 0;
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k], q = pts[(k + 1) % pts.length];
      A += p[0] * q[1] - q[0] * p[1];
    }
    A /= 2;
    if (pts.length < 3 || Math.abs(A) < 1e-9) { degeneradas++; continue; }
    lazos.push({ pts, areaMm2: A });
  }
  return {
    lazos, abiertas, coplanares, degeneradas,
    sombra: { u0: su0, u1: su1, v0: sv0, v1: sv1 },
    distancia: dmin,
  };
}

/**
 * ARISTAS VISIBLES de un conjunto de lazos del MISMO sólido: se suprimen los
 * tramos recorridos DOS VECES en sentidos opuestos (el interior de una placa
 * partida en cajas disjuntas). Invariante: el borde visible de una caja partida
 * en N trozos tiene el mismo perímetro que la caja entera.
 */
export function bordesVisibles(lazos: LazoSeccion[], tol = 1e-6): Array<[number, number, number, number]> {
  interface Ar { t0: number; t1: number; sgn: number }
  const grupos = new Map<string, { ox: number; oy: number; dx: number; dy: number; arr: Ar[] }>();
  for (const L of lazos) {
    for (let k = 0; k < L.pts.length; k++) {
      const p = L.pts[k], q = L.pts[(k + 1) % L.pts.length];
      let dx = q[0] - p[0], dy = q[1] - p[1];
      const len = Math.hypot(dx, dy);
      if (len < tol) continue;
      dx /= len; dy /= len;
      let sgn = 1;
      if (dx < -tol || (Math.abs(dx) <= tol && dy < 0)) { dx = -dx; dy = -dy; sgn = -1; }
      const off = -dy * p[0] + dx * p[1];                     // distancia con signo al origen
      const key = `${Math.round(dx / 1e-6)},${Math.round(dy / 1e-6)},${Math.round(off / 1e-4)}`;
      let g = grupos.get(key);
      if (!g) { g = { ox: p[0], oy: p[1], dx, dy, arr: [] }; grupos.set(key, g); }
      const tA = (p[0] - g.ox) * g.dx + (p[1] - g.oy) * g.dy;
      const tB = (q[0] - g.ox) * g.dx + (q[1] - g.oy) * g.dy;
      g.arr.push({ t0: Math.min(tA, tB), t1: Math.max(tA, tB), sgn });
    }
  }
  /** unión de intervalos 1D (fusiona los contiguos: una arista partida en 3
   *  triángulos se dibuja como UNA línea, no como tres encimadas) */
  const unir = (xs: Array<[number, number]>): Array<[number, number]> => {
    const s = xs.slice().sort((a, b) => a[0] - b[0]); const r: Array<[number, number]> = [];
    for (const iv of s) {
      const last = r[r.length - 1];
      if (last && iv[0] <= last[1] + tol) last[1] = Math.max(last[1], iv[1]);
      else r.push([iv[0], iv[1]]);
    }
    return r;
  };
  const out: Array<[number, number, number, number]> = [];
  for (const g of grupos.values()) {
    for (const s of [1, -1]) {
      const mios = unir(g.arr.filter((a) => a.sgn === s).map((a) => [a.t0, a.t1] as [number, number]));
      const otros = unir(g.arr.filter((a) => a.sgn === -s).map((a) => [a.t0, a.t1] as [number, number]));
      for (const m of mios) {
        let trozos: Array<[number, number]> = [m];
        for (const o of otros) {
          const nuevos: Array<[number, number]> = [];
          for (const [t0, t1] of trozos) {
            if (o[1] <= t0 + tol || o[0] >= t1 - tol) { nuevos.push([t0, t1]); continue; }
            if (o[0] > t0 + tol) nuevos.push([t0, o[0]]);
            if (o[1] < t1 - tol) nuevos.push([o[1], t1]);
          }
          trozos = nuevos;
        }
        for (const [t0, t1] of trozos) {
          if (t1 - t0 < tol) continue;
          out.push([g.ox + g.dx * t0, g.oy + g.dy * t0, g.ox + g.dx * t1, g.oy + g.dy * t1]);
        }
      }
    }
  }
  return out;
}

const ORDEN_ROL: Record<RolSeccion, number> = { placa: 10, inserto: 20, moldeo: 30, colada: 40, componente: 50, agua: 60 };

/**
 * CORTA una lista de sólidos por un plano. Es la máquina que L5 dibuja, L6 llama
 * cuatro veces (una por pose, moviendo los sólidos) y L7 vuelve a llamar con la
 * ventana del gate.
 */
export function seccionarPorPlano(solidos: SolidoSeccion[], plano: PlanoCorte): Seccion {
  const { w, u, v } = baseDelPlano(plano);
  const piezas: PiezaSeccionada[] = [];
  let areaTotal = 0;
  let bb: Seccion['bbox'] = null;
  for (const s of solidos) {
    const r = cortarMalla(s.malla, s.mover ?? [0, 0, 0], plano.p0, w, u, v);
    let area = 0, u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const L of r.lazos) {
      area += L.areaMm2;
      for (const p of L.pts) {
        if (p[0] < u0) u0 = p[0]; if (p[0] > u1) u1 = p[0];
        if (p[1] < v0) v0 = p[1]; if (p[1] > v1) v1 = p[1];
      }
    }
    const vacio = r.lazos.length === 0;
    const bbox = vacio ? null : { u0, u1, v0, v1 };
    if (bbox) {
      bb = bb ? { u0: Math.min(bb.u0, u0), u1: Math.max(bb.u1, u1), v0: Math.min(bb.v0, v0), v1: Math.max(bb.v1, v1) } : { ...bbox };
    }
    areaTotal += area;
    piezas.push({
      id: s.id, nombre: s.nombre, rol: s.rol, material: s.material, nota: s.nota,
      orden: s.orden ?? ORDEN_ROL[s.rol],
      lazos: r.lazos, areaMm2: area, bbox,
      bordes: bordesVisibles(r.lazos),
      abiertas: r.abiertas, coplanares: r.coplanares,
      vacio, distanciaMm: vacio ? r.distancia : 0, sombra: r.sombra,
    });
  }
  piezas.sort((a, b) => a.orden - b.orden);
  return { plano: { p0: plano.p0, n: w, u, v }, piezas, areaTotalMm2: areaTotal, bbox: bb };
}

// ─────────────────────────────────────────────────────────────────────────────
// EL MOLDE EN LA SECCIÓN — sólidos con su rol, desde el paquete de la Máquina
// ─────────────────────────────────────────────────────────────────────────────

export interface MetaMolde {
  W: number; D: number; zPart: number;
  /** cotas del inserto resueltas por §4.2 (insertDims) */
  fx: number; fy: number; dep: number; wall: number; border: number;
  ifx: number; ify: number; Hc: number; Hk: number; round: boolean;
  diaAguaMm: number;
  /** el ⌀ que §4.2.1 ESTIMA por tamaño de pieza (Tabla 4.76→15.88 mm) — con el que
   *  `insertDims` dimensionó la mejilla. Si no coincide con el ruteado, la sección
   *  lo dice: son dos caminos calculando lo mismo distinto. */
  diaAguaEstimadoMm: number;
  /** el eje del sprue (mm) */
  xSprue: number; ySprue: number;
  eje: 'x' | 'y';
  /** líneas de agua que el plano corta, con el lado de la partición */
  lineasAgua: Array<{ u: number; v: number; lado: 'A' | 'B' }>;
  /** el tornillo elegido por §12.4 (para juzgar V12.18 sobre lo DIBUJADO) */
  tornillo: { din: string; dMm: number; cabezaDiaMm: number; cabezaAltoMm: number } | null;
  nCavCortadas: number;
  avisos: string[];
  /** todo lo que se modeló con un supuesto que el libro NO da */
  extensiones: string[];
}

/** Plano de corte por el EJE DEL SPRUE.
 *  El eje se elige por DATO, no por gusto: gana el plano que corte más impresiones
 *  y, a igualdad, el que corte TRANSVERSALMENTE las líneas de agua (que corren en
 *  X) — así el agua sale como círculos, que es como el libro la enseña (Fig 1.6). */
export function planoDelSprue(spec: MoldAssemblySpec, eje?: 'x' | 'y'): { plano: PlanoCorte; eje: 'x' | 'y'; xSprue: number; ySprue: number } {
  const D = plateDepth(spec);
  const cells = cavityGrid(spec, D);
  const nCav = Math.max(1, spec.nCav ?? 1);
  // el bebedero: en 1 cavidad cae en el centro de la impresión (§7.2 direct sprue
  // gate, que es lo que `standardHoles` barrena); en multi-cavidad, al centro del
  // molde con la colada saliendo hacia las impresiones.
  const xSprue = nCav === 1 ? cells[0].cx : spec.widthMm / 2;
  const ySprue = nCav === 1 ? cells[0].cy : D / 2;
  const cortaX = cells.filter((c) => Math.abs(c.cx - xSprue) < 1e-6).length;
  const cortaY = cells.filter((c) => Math.abs(c.cy - ySprue) < 1e-6).length;
  const usar = eje ?? (cortaX >= cortaY ? 'x' : 'y');
  // con n=+X → u=+Y, v=+Z (la lámina muestra el fondo del molde en horizontal)
  // con n=−Y → u=+X, v=+Z
  const plano: PlanoCorte = usar === 'x'
    ? { p0: [xSprue, 0, 0], n: [1, 0, 0], arriba: [0, 0, 1] }
    : { p0: [0, ySprue, 0], n: [0, -1, 0], arriba: [0, 0, 1] };
  return { plano, eje: usar, xSprue, ySprue };
}

/**
 * Los SÓLIDOS del molde cerrado, con su rol para el achurado.
 *
 * MODELO — lo que es geometría real y lo que es simplificación DECLARADA:
 *  · placas, rieles, paquete expulsor, insertos y asientos: cajas reales con las
 *    cotas que ya resolvieron §4.2 (`insertDims`) y el catálogo de base (§4.3).
 *    El asiento del inserto SÍ se resta de la placa (`mallaPlacaConBolsas`).
 *  · los BARRENOS chicos (pines, tornillos, bebedero) NO se restan de la placa:
 *    el componente se dibuja ENCIMA. El área de placa que reporta la sección es
 *    BRUTA — declarado, y nada se juzga con ella.
 *  · la impresión no se talla en el inserto: el MOLDEO se dibuja encima del
 *    inserto de cavidad y el macho encima del moldeo, que es exactamente lo que
 *    se ve en Fig 1.6.
 */
export function solidosDeMolde(spec: MoldAssemblySpec, o?: {
  eje?: 'x' | 'y';
  /** malla REAL de la pieza (mm). Si viene, el moldeo se corta de ella. */
  mallaPieza?: MallaSec;
  /** centro de la malla de la pieza en su propio sistema (por defecto, su bbox) */
}): { solidos: SolidoSeccion[]; meta: MetaMolde; plano: PlanoCorte } {
  const W = spec.widthMm, D = plateDepth(spec);
  const z = plateStackZ(spec);
  const defs = plateDefs(spec);
  const grosor = (rol: string) => defs.find((d) => d.role === rol)?.thick ?? 0;
  const zPart = z.A;                                   // tope de B = base de A
  const id = insertDims(spec);
  const { round } = cavityFootprint(spec);
  const cells = cavityGrid(spec, D);
  const cc = coolingCircuit(spec, D);
  const { plano, eje, xSprue, ySprue } = planoDelSprue(spec, o?.eje);
  const acero = spec.baseSteel ?? '1.1730 (C45)';
  const extensiones: string[] = [];
  const avisos: string[] = [...(cc.avisos ?? [])];
  const S: SolidoSeccion[] = [];
  const planta: Rect = { x0: 0, y0: 0, x1: W, y1: D };

  // ── PLACAS (§1.3.1 Fig 1.4: el stack de un molde de dos placas) ──
  S.push({ id: 'p-bottom', nombre: 'Placa de sujeción inferior', rol: 'placa', material: acero,
    malla: mallaCaja(0, 0, z.bottom, W, D, z.bottom + grosor('bottom')) });

  // RIELES del housing en U. El spec NO dice de qué lado corren los risers: se
  // modelan en los costados que la sección cruza (EXTENSIÓN DECLARADA) — es la
  // orientación de Fig 1.4, donde el paquete expulsor se ve flotando entre ellos.
  const rail = Math.min(35, W * 0.16);
  extensiones.push(`rieles del housing a ${rail.toFixed(0)} mm en los dos costados que cruza la sección (el spec no fija la orientación del riser)`);
  const zEH0 = z.bottom + grosor('bottom'), zEH1 = z.support;
  S.push({ id: 'p-riel', nombre: 'Rieles del housing (spacer)', rol: 'placa', material: acero,
    malla: unirMallas(
      eje === 'x'
        ? [mallaCaja(0, 0, zEH0, W, rail, zEH1), mallaCaja(0, D - rail, zEH0, W, D, zEH1)]
        : [mallaCaja(0, 0, zEH0, rail, D, zEH1), mallaCaja(W - rail, 0, zEH0, W, D, zEH1)]) });

  const mEj = 8;   // el paquete expulsor no toca los rieles
  const pkRect: Rect = eje === 'x'
    ? { x0: mEj, y0: rail + 4, x1: W - mEj, y1: D - rail - 4 }
    : { x0: rail + 4, y0: mEj, x1: W - rail - 4, y1: D - mEj };
  S.push({ id: 'p-ejector', nombre: 'Placa expulsora', rol: 'placa', material: acero,
    malla: mallaCaja(pkRect.x0, pkRect.y0, z.ejector, pkRect.x1, pkRect.y1, z.ejector + grosor('ejector')) });
  S.push({ id: 'p-ejector-ret', nombre: 'Placa retenedora (cabezas)', rol: 'placa', material: acero,
    malla: mallaCaja(pkRect.x0, pkRect.y0, z['ejector-ret'], pkRect.x1, pkRect.y1, z['ejector-ret'] + grosor('ejector-ret')) });
  S.push({ id: 'p-support', nombre: 'Placa de soporte', rol: 'placa', material: acero,
    malla: mallaCaja(0, 0, z.support, W, D, z.support + grosor('support')) });

  // ASIENTOS de inserto (§4.2): la bolsa es 0.5 mm más grande por lado, como la
  // que talla `buildMoldParts` en el kernel — misma cota, un solo criterio.
  const bolsaB = cells.map((c) => ({ rect: { x0: c.cx - (id.ifx + 1) / 2, y0: c.cy - (id.ify + 1) / 2, x1: c.cx + (id.ifx + 1) / 2, y1: c.cy + (id.ify + 1) / 2 }, z0: zPart - id.Hk, z1: zPart }));
  const bolsaA = cells.map((c) => ({ rect: { x0: c.cx - (id.ifx + 1) / 2, y0: c.cy - (id.ify + 1) / 2, x1: c.cx + (id.ifx + 1) / 2, y1: c.cy + (id.ify + 1) / 2 }, z0: zPart, z1: zPart + id.Hc }));
  S.push({ id: 'p-B', nombre: 'Placa B (núcleo)', rol: 'placa', material: spec.cavityMetal,
    malla: mallaPlacaConBolsas(planta, z.B, z.B + grosor('B'), bolsaB) });
  S.push({ id: 'p-A', nombre: 'Placa A (cavidad)', rol: 'placa', material: spec.cavityMetal,
    malla: mallaPlacaConBolsas(planta, z.A, z.A + grosor('A'), bolsaA) });
  S.push({ id: 'p-clamp', nombre: 'Placa de sujeción superior', rol: 'placa', material: acero,
    malla: mallaCaja(0, 0, z.clamp, W, D, z.clamp + grosor('clamp')) });

  // ── INSERTOS (§4.2.3 Fig 4.15-4.16) ──
  S.push({ id: 'i-cav', nombre: `Inserto de CAVIDAD (${round ? 'redondo §4.2.3' : 'rectangular §4.2.3'})`, rol: 'inserto', material: spec.cavityMetal,
    nota: `${id.ifx}×${id.ify}×${id.Hc} mm`,
    malla: unirMallas(cells.map((c) => mallaCaja(c.cx - id.ifx / 2, c.cy - id.ify / 2, zPart, c.cx + id.ifx / 2, c.cy + id.ify / 2, zPart + id.Hc))) });

  // NÚCLEO = bloque bajo la partición + el MACHO que sube a la cavidad. El macho
  // deja la pared de la pieza: su ancho es la huella menos 2 paredes y su altura
  // la profundidad menos el espesor del fondo. Es la geometría nominal del spec
  // (la talla real la hace el kernel con la malla del cliente).
  const machoW = Math.max(1, id.fx - 2 * id.wall), machoD = Math.max(1, id.fy - 2 * id.wall);
  const machoH = Math.max(0, id.dep - id.wall);
  const nucleo: MallaSec[] = [];
  for (const c of cells) {
    nucleo.push(mallaCaja(c.cx - id.ifx / 2, c.cy - id.ify / 2, zPart - id.Hk, c.cx + id.ifx / 2, c.cy + id.ify / 2, zPart));
    if (machoH > 0) {
      nucleo.push(round
        ? mallaCilindro({ eje: 'z', c1: c.cx, c2: c.cy, a0: zPart, a1: zPart + machoH, r: machoW / 2, n: 64 })
        : mallaCaja(c.cx - machoW / 2, c.cy - machoD / 2, zPart, c.cx + machoW / 2, c.cy + machoD / 2, zPart + machoH));
    }
  }
  S.push({ id: 'i-core', nombre: 'Inserto de NÚCLEO (macho)', rol: 'inserto', material: spec.core.material,
    nota: `${id.ifx}×${id.ify}×${id.Hk} mm + macho ${machoH.toFixed(0)} mm`, malla: unirMallas(nucleo) });

  // ── MOLDEO ──
  const moldeos: MallaSec[] = [];
  if (o?.mallaPieza) {
    // la malla del cliente, centrada en cada impresión y asentada en la partición
    const P = o.mallaPieza.positions;
    let bx0 = Infinity, by0 = Infinity, bz0 = Infinity, bx1 = -Infinity, by1 = -Infinity, bz1 = -Infinity;
    for (let i = 0; i < P.length; i += 3) {
      bx0 = Math.min(bx0, P[i]); bx1 = Math.max(bx1, P[i]);
      by0 = Math.min(by0, P[i + 1]); by1 = Math.max(by1, P[i + 1]);
      bz0 = Math.min(bz0, P[i + 2]); bz1 = Math.max(bz1, P[i + 2]);
    }
    for (const c of cells) {
      const off: Vec3 = [c.cx - (bx0 + bx1) / 2, c.cy - (by0 + by1) / 2, zPart - bz0];
      const pos = new Float64Array(P.length);
      for (let i = 0; i < P.length; i += 3) { pos[i] = P[i] + off[0]; pos[i + 1] = P[i + 1] + off[1]; pos[i + 2] = P[i + 2] + off[2]; }
      moldeos.push({ positions: pos, indices: o.mallaPieza.indices });
    }
  } else {
    for (const c of cells) {
      moldeos.push(round
        ? mallaVaso({ cx: c.cx, cy: c.cy, z0: zPart, z1: zPart + id.dep, rExt: id.fx / 2, pared: id.wall, n: 64 })
        : mallaPlacaConBolsas({ x0: c.cx - id.fx / 2, y0: c.cy - id.fy / 2, x1: c.cx + id.fx / 2, y1: c.cy + id.fy / 2 },
          zPart, zPart + id.dep,
          [{ rect: { x0: c.cx - machoW / 2, y0: c.cy - machoD / 2, x1: c.cx + machoW / 2, y1: c.cy + machoD / 2 }, z0: zPart, z1: zPart + machoH }]));
    }
  }
  S.push({ id: 'moldeo', nombre: 'MOLDEO (pieza de plástico)', rol: 'moldeo', material: spec.plastic ?? 'ABS',
    nota: o?.mallaPieza ? 'malla real del cliente' : 'cáscara nominal del spec', malla: unirMallas(moldeos) });

  // ── LÍNEAS DE AGUA (§9.2) — se cortan del circuito REAL ya ruteado ──
  const rAgua = cc.diaMm / 2;
  const zB = zPart - Math.min(grosor('B') - rAgua - 1, cc.zBehindMm);
  const zA = cc.zAboveMm != null ? zPart + Math.min(cc.zAboveMm, grosor('A') - rAgua - 1) : null;
  const aguas: MallaSec[] = [];
  const lineasAgua: MetaMolde['lineasAgua'] = [];
  for (const seg of cc.segs) {
    const horiz = Math.abs(seg.y1 - seg.y0) < 1e-9;
    for (const zz of [zB, ...(zA != null ? [zA] : [])]) {
      aguas.push(horiz
        ? mallaCilindro({ eje: 'x', c1: seg.y0, c2: zz, a0: Math.min(seg.x0, seg.x1), a1: Math.max(seg.x0, seg.x1), r: rAgua, n: 48 })
        : mallaCilindro({ eje: 'y', c1: zz, c2: seg.x0, a0: Math.min(seg.y0, seg.y1), a1: Math.max(seg.y0, seg.y1), r: rAgua, n: 48 }));
      // ¿la corta el plano? (para las cotas de profundidad §9.2.5)
      const dEje = eje === 'x'
        ? (horiz ? 0 : Math.abs(seg.x0 - xSprue))
        : (horiz ? Math.abs(seg.y0 - ySprue) : 0);
      const dentro = horiz
        ? (eje === 'x' ? xSprue >= Math.min(seg.x0, seg.x1) && xSprue <= Math.max(seg.x0, seg.x1) : dEje < rAgua)
        : (eje === 'y' ? ySprue >= Math.min(seg.y0, seg.y1) && ySprue <= Math.max(seg.y0, seg.y1) : dEje < rAgua);
      if (dentro && (horiz ? (eje === 'x') : (eje === 'y')))
        lineasAgua.push({ u: eje === 'x' ? seg.y0 : seg.x0, v: zz, lado: zz > zPart ? 'A' : 'B' });
    }
  }
  if (aguas.length) S.push({ id: 'agua', nombre: `Líneas de agua ⌀${cc.diaMm} ${spec.cooling.plug ?? ''}`.trim(), rol: 'agua',
    material: `plug ${spec.cooling.plug ?? '—'}`, nota: `${cc.segs.length} tramos · H_B ${cc.zBehindMm} mm`, malla: unirMallas(aguas) });

  // ── COLADA (§6.3.1: bebedero cónico) ──
  const Lclamp = grosor('clamp'), LA = grosor('A');
  const zTapa = z.clamp + Lclamp;
  const zPie = Math.max(zPart, zPart + id.dep);        // en 1 cav el sprue entra por el fondo de la pieza
  const fd = sprueDesignFromCavity(spec.plastic, spec.cavity, Lclamp + LA + 6 - spec.cavity.depthMm);
  if (spec.feed !== 'hot-runner' && zTapa > zPie) {
    S.push({ id: 'colada', nombre: 'Bebedero (sprue) §6.3.1', rol: 'colada', material: spec.plastic ?? 'ABS',
      nota: `⌀ ${(2 * fd.rTopMm).toFixed(1)} → ${(2 * fd.rBaseMm).toFixed(1)} mm`,
      malla: mallaCilindro({ eje: 'z', c1: xSprue, c2: ySprue, a0: zPie, a1: zTapa, r: fd.rBaseMm, r1: fd.rTopMm, n: 48 }) });
  }

  // ── EXPULSORES (§11.2) — posiciones del mismo colocador que taladra las placas ──
  const pines = standardHoles(spec, 'B').filter((h) => /expulsor/.test(h.type));
  if (pines.length) {
    const rp = spec.ejectors.diaMm / 2;
    const zPin0 = z.ejector;                            // el pin apoya en la placa expulsora
    S.push({ id: 'pines', nombre: `Expulsores ${spec.ejectors.type} ⌀${spec.ejectors.diaMm}`, rol: 'componente',
      material: '1.2842 templado', nota: `${pines.length} pines`,
      malla: unirMallas(pines.map((h) => mallaCilindro({ eje: 'z', c1: h.x, c2: h.y, a0: zPin0, a1: zPart, r: rp, n: 32 }))) });
    extensiones.push('la CABEZA del pin no se modela (el libro da el ⌀ del pin y el barreno, no la geometría de la cabeza)');
  }

  // ── TORNILLOS (§12.3.2 Fig 12.32) — las proporciones SÍ son del libro:
  //    "altura de cabeza = diámetro de rosca; diámetro de cabeza ≈ 150 % del de rosca".
  //    Lo que el libro NO da es cuánto entra el tornillo en la placa A: se modela
  //    con 2·d de rosca (EXTENSIÓN DECLARADA) — no se juzga nada con ese número.
  const bolt = moldBoltSizing(spec);
  const cabezaDia = 1.5 * bolt.dMm, cabezaAlto = bolt.dMm;
  const tornillos = standardHoles(spec, 'clamp').filter((h) => /tornillo/.test(h.type));
  if (tornillos.length) {
    const zTop = z.clamp + Lclamp;
    const zFin = z.A + Math.max(0, LA - 2 * bolt.dMm);
    const ms: MallaSec[] = [];
    for (const h of tornillos) {
      ms.push(mallaCilindro({ eje: 'z', c1: h.x, c2: h.y, a0: zTop - cabezaAlto, a1: zTop, r: cabezaDia / 2, n: 32 }));
      ms.push(mallaCilindro({ eje: 'z', c1: h.x, c2: h.y, a0: zFin, a1: zTop - cabezaAlto, r: bolt.dMm / 2, n: 32 }));
    }
    S.push({ id: 'tornillos', nombre: `Tornillos ${bolt.din} (§12.3.2)`, rol: 'componente', material: '12.9',
      nota: `cabeza ⌀${cabezaDia.toFixed(1)} × ${cabezaAlto.toFixed(1)} mm`, malla: unirMallas(ms) });
    extensiones.push(`el tornillo entra ${(2 * bolt.dMm).toFixed(0)} mm (2·d) en la placa A: el libro da las proporciones de la CABEZA, no el agarre`);
  }

  const meta: MetaMolde = {
    W, D, zPart, fx: id.fx, fy: id.fy, dep: id.dep, wall: id.wall, border: id.border,
    ifx: id.ifx, ify: id.ify, Hc: id.Hc, Hk: id.Hk, round,
    diaAguaMm: cc.diaMm, diaAguaEstimadoMm: coolingLineDia(Math.max(id.fx, id.fy)),
    xSprue, ySprue, eje, lineasAgua,
    tornillo: tornillos.length ? { din: bolt.din, dMm: bolt.dMm, cabezaDiaMm: cabezaDia, cabezaAltoMm: cabezaAlto } : null,
    nCavCortadas: cells.filter((c) => Math.abs((eje === 'x' ? c.cx - xSprue : c.cy - ySprue)) < 1e-6).length,
    avisos, extensiones,
  };
  return { solidos: S, meta, plano };
}

// ─────────────────────────────────────────────────────────────────────────────
// COTAS Y VEREDICTOS — todo se MIDE sobre los lazos de la sección
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoV = 'CUMPLE' | 'ADVIERTE' | 'VIOLA' | 'SIN CABLEAR';

export interface VeredictoSeccion {
  id: string; titulo: string; cita: string;
  estado: EstadoV;
  medido?: string; limite?: string;
  porque: string;
}

export interface CotaSeccion {
  id: string; texto: string; ref: string;
  /** vertical: dos alturas v a la misma u · horizontal: dos u a la misma v */
  tipo: 'v' | 'h';
  a: number; b: number;    // los dos extremos (v si tipo='v', u si tipo='h')
  en: number;              // la coordenada de la línea de cota
  /** hacia qué lado se saca la línea de cota (+1 derecha/arriba, −1 izquierda/abajo) */
  lado: 1 | -1;
  estado: EstadoV;
}

export interface MedidasSeccion {
  cotas: CotaSeccion[];
  veredictos: VeredictoSeccion[];
  /** lo medido, crudo, para el gate */
  datos: Record<string, number | string | null>;
}

const pieza = (sec: Seccion, id: string) => sec.piezas.find((p) => p.id === id) ?? null;

/** distancia mínima de un punto al CONTORNO de una pieza seccionada (mm) */
function distAlContorno(p: PiezaSeccionada, q: Vec2): number {
  let best = Infinity;
  for (const L of p.lazos) {
    for (let k = 0; k < L.pts.length; k++) {
      const a = L.pts[k], b = L.pts[(k + 1) % L.pts.length];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const L2 = dx * dx + dy * dy;
      let t = L2 > 0 ? ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2 : 0;
      t = Math.max(0, Math.min(1, t));
      best = Math.min(best, Math.hypot(q[0] - (a[0] + t * dx), q[1] - (a[1] + t * dy)));
    }
  }
  return best;
}

/**
 * LAS COTAS QUE EL LIBRO JUZGA, medidas sobre la sección (no sobre el spec):
 * altura de inserto, mejilla y profundidad de cavidad. Si un dato no se puede
 * medir sobre la sección, el veredicto es SIN CABLEAR — jamás verde.
 */
export function medirSeccion(sec: Seccion, meta: MetaMolde, spec: MoldAssemblySpec, o?: {
  /** F_eject y A_eff del diseño físico, si el paquete de la Máquina viaja */
  expulsion?: { fEjectN: number; aEffM2: number } | null;
}): MedidasSeccion {
  const cotas: CotaSeccion[] = [];
  const V: VeredictoSeccion[] = [];
  const datos: MedidasSeccion['datos'] = {};
  const D3 = 3 * meta.diaAguaMm;                     // §4.2.1/§4.2.2: tres ⌀ de línea
  const cav = pieza(sec, 'i-cav'), core = pieza(sec, 'i-core'), mol = pieza(sec, 'moldeo');
  const agua = pieza(sec, 'agua'), torn = pieza(sec, 'tornillos');

  // ── V1.1 · la vista de nomenclatura ────────────────────────────────────────
  const conCorte = sec.piezas.filter((p) => !p.vacio);
  V.push({
    id: 'V1.1', titulo: 'Sección de nomenclatura (Fig 1.6)', cita: '§1.3.2 · Fig 1.6',
    estado: conCorte.length >= 6 ? 'CUMPLE' : 'ADVIERTE',
    medido: `${conCorte.length} componentes cortados, cada uno con su achurado`,
    porque: 'el libro publica esta vista SIN criterio de bueno/malo: es nomenclatura. Se exige que cada componente se distinga por su achurado.',
  });

  // ── V4.7 · ALTURA DEL INSERTO (§4.2.1 Fig 4.13) ────────────────────────────
  // "the minimum height dimension between the molded part and the top or bottom
  //  surface of the insert is typically three times the diameter of the cooling line"
  if (cav?.bbox && core?.bbox && mol?.bbox) {
    const hA = cav.bbox.v1 - mol.bbox.v1;            // del techo de la pieza al lomo del inserto A
    const hB = mol.bbox.v0 - core.bbox.v0;           // de la cara baja de la pieza al lomo del inserto B
    datos.hInsertoA = +hA.toFixed(3); datos.hInsertoB = +hB.toFixed(3); datos.limite3D = +D3.toFixed(3);
    const peor = Math.min(hA, hB);
    cotas.push({ id: 'hA', texto: `H_ins A ${hA.toFixed(1)}`, ref: '§4.2.1 ≥ 3⌀', tipo: 'v', a: mol.bbox.v1, b: cav.bbox.v1, en: cav.bbox.u1, lado: 1, estado: hA >= D3 ? 'CUMPLE' : 'VIOLA' });
    cotas.push({ id: 'hB', texto: `H_ins B ${hB.toFixed(1)}`, ref: '§4.2.1 ≥ 3⌀', tipo: 'v', a: core.bbox.v0, b: mol.bbox.v0, en: core.bbox.u1, lado: 1, estado: hB >= D3 ? 'CUMPLE' : 'VIOLA' });
    // ¿la línea de agua del lado A vive DENTRO del inserto de cavidad? Si el
    // inserto es más bajo que la línea, el agua enfría la PLACA, no el inserto —
    // que es justo la falla que §4.2.1 previene con los 3·⌀.
    const fuera = agua && cav.bbox ? meta.lineasAgua.filter((l) => l.lado === 'A' && l.v > cav.bbox!.v1).length : 0;
    datos.aguaAfueraDelInserto = fuera;
    V.push({
      id: 'V4.7', titulo: 'Altura del inserto ≥ 3·⌀ de la línea de agua', cita: '§4.2.1 · Fig 4.13',
      estado: peor >= D3 ? 'CUMPLE' : 'VIOLA',
      medido: `A ${hA.toFixed(1)} mm · B ${hB.toFixed(1)} mm`, limite: `≥ ${D3.toFixed(1)} mm (3 × ⌀${meta.diaAguaMm})`,
      porque: (peor >= D3
        ? '"the minimum height dimension between the molded part and the … surface of the insert is typically three times the diameter of the cooling line". '
        : `el lado ${hA < hB ? 'A' : 'B'} deja ${peor.toFixed(1)} mm de acero entre la superficie moldeante y el lomo del inserto. `)
        + (fuera ? `${fuera} línea(s) del lado A caen ARRIBA del lomo del inserto: enfrían la placa, no el inserto. ` : '')
        + `El límite usa el ⌀ REALMENTE ruteado (⌀${meta.diaAguaMm}, §9.2), no el ⌀ que §4.2.1 ESTIMA por tamaño (⌀${meta.diaAguaEstimadoMm}), con el que se dimensionó el inserto.`,
    });
  } else {
    V.push({ id: 'V4.7', titulo: 'Altura del inserto', cita: '§4.2.1 · Fig 4.13', estado: 'SIN CABLEAR', porque: 'la sección no cortó inserto y moldeo a la vez' });
  }

  // ── V4.8 / V12.10 / V13.4 · LA MEJILLA (cheek) ─────────────────────────────
  // §4.2.2: "length and width allowances of three cooling line diameters per side
  //          are typical" · "the thickness of the side wall … should equal the
  //          depth of the mold cavity"
  // §12.2.4: "the width of the cheek, Wcheek, should be equal to the height of the
  //          mold cavity, Hcavity" (y el análisis muestra que basta 0.73·Hcavity:
  //          la regla práctica YA trae factor de seguridad)
  if (cav?.bbox && mol?.bbox) {
    const izq = mol.bbox.u0 - cav.bbox.u0, der = cav.bbox.u1 - mol.bbox.u1;
    const cheek = Math.min(izq, der);
    const hCav = mol.bbox.v1 - meta.zPart;            // profundidad de cavidad MEDIDA
    const exigido = Math.max(D3, hCav);
    const manda = hCav > D3 ? 'estructural (W_cheek = H_cavity)' : 'enfriamiento (3·⌀ por lado)';
    datos.cheekMm = +cheek.toFixed(3); datos.hCavidadMm = +hCav.toFixed(3);
    datos.cheekExigidoMm = +exigido.toFixed(3); datos.cheekManda = manda;
    cotas.push({ id: 'cheek', texto: `W_cheek ${cheek.toFixed(1)}`, ref: '§4.2.2 · §12.2.4', tipo: 'h', a: cav.bbox.u0, b: mol.bbox.u0, en: meta.zPart + Math.min(hCav, cav.bbox.v1 - meta.zPart) / 2, lado: 1, estado: cheek >= exigido ? 'CUMPLE' : 'VIOLA' });
    cotas.push({ id: 'hcav', texto: `H_cavity ${hCav.toFixed(1)}`, ref: '§12.2.4', tipo: 'v', a: meta.zPart, b: mol.bbox.v1, en: mol.bbox.u1, lado: 1, estado: 'CUMPLE' });
    const est: EstadoV = cheek >= exigido ? 'CUMPLE' : (cheek >= 0.73 * hCav && cheek >= D3 ? 'ADVIERTE' : 'VIOLA');
    V.push({
      id: 'V4.8/V12.10/V13.4', titulo: 'Mejilla (cheek): 3·⌀ por lado vs. W_cheek = H_cavity', cita: '§4.2.2 · §12.2.4 · §13.9',
      estado: est, medido: `${cheek.toFixed(1)} mm (izq ${izq.toFixed(1)} · der ${der.toFixed(1)})`,
      limite: `≥ ${exigido.toFixed(1)} mm — manda ${manda}`,
      porque: est === 'CUMPLE'
        ? `H_cavity ${hCav.toFixed(1)} vs 3⌀ ${D3.toFixed(1)}: ${manda}. El libro repite esta regla en §4.2.2, §12.2.4 y §13.9.`
        : est === 'ADVIERTE'
          ? `cheek ${cheek.toFixed(1)} < ${exigido.toFixed(1)} pero > 0.73·H_cavity (${(0.73 * hCav).toFixed(1)}): el análisis de §12.2.4 todavía aguanta, la regla práctica ya no`
          : `cheek ${cheek.toFixed(1)} < ${exigido.toFixed(1)}: pared lateral por debajo de la regla del libro (y ${cheek < 0.73 * hCav ? 'también del análisis 0.73·H_cavity' : 'de la regla práctica'})`,
    });
  } else {
    V.push({ id: 'V4.8/V12.10/V13.4', titulo: 'Mejilla (cheek)', cita: '§4.2.2 · §12.2.4 · §13.9', estado: 'SIN CABLEAR', porque: 'sin inserto y moldeo en la misma sección no hay mejilla que medir' });
  }

  // ── V4.9 · inserto redondo vs. rectangular ─────────────────────────────────
  V.push({
    id: 'V4.9', titulo: `Inserto ${meta.round ? 'REDONDO (torneable)' : 'RECTANGULAR'}`, cita: '§4.2.3 · Fig 4.15-4.16',
    estado: 'ADVIERTE',
    medido: `${meta.ifx}×${meta.ify} ${spec.cavityMetal}, huella ${meta.fx}×${meta.fy}`,
    porque: meta.round
      ? 'taza: "the allowance in the radial dimension may not be sufficient to withstand the pressures exerted on the side wall by the melt" — el libro no da número, lo resuelve la mejilla (V4.8)'
      : 'bezel: "the thickness of the surrounding cheek may not allow for sufficient cooling around the periphery … while also providing space for other mold components"',
  });

  // ── V9.1 · PROFUNDIDAD DE LA LÍNEA DE AGUA EN DIÁMETROS ────────────────────
  // Fig 9.4 rotula exactamente dos puntos: Hline = 1D → σ = 3.3·Pmelt · Hline = 4D
  // → σ = 2.6·Pmelt. Entre medias NO se interpola: el factor sale de la gráfica.
  if (agua && !agua.vacio && mol && !mol.vacio && meta.lineasAgua.length) {
    // los centros son los EJES de las líneas que el plano corta transversalmente
    // (no el centroide del lazo: un canal cortado a lo largo daría un centroide que
    // no es su eje y H mediría otra cosa). H se mide EN EL PLANO — declarado.
    const centros: Vec2[] = meta.lineasAgua.map((l) => [l.u, l.v]);
    const hs = centros.map((c) => distAlContorno(mol, c));
    const hMin = hs.length ? Math.min(...hs) : NaN;
    const enD = hMin / meta.diaAguaMm;
    datos.aguaHminMm = +hMin.toFixed(3); datos.aguaHenD = +enD.toFixed(3); datos.aguaCortadas = centros.length;
    const factor = Math.abs(enD - 1) < 0.05 ? '3.3·P_melt (Fig 9.4)' : Math.abs(enD - 4) < 0.05 ? '2.6·P_melt (Fig 9.4)' : null;
    const est: EstadoV = !Number.isFinite(enD) ? 'SIN CABLEAR' : enD >= 2 && enD <= 5 ? 'CUMPLE' : 'VIOLA';
    if (centros.length) {
      // se acota la línea MÁS CERCANA a la pieza (la que manda) y, si hay varias
      // empatadas, la de más a la derecha: así la cota sale al aire libre
      const hMinR = Math.min(...hs);
      const cand = centros.filter((_, i) => hs[i] <= hMinR + 1e-6);
      const c = cand.reduce((a, b) => (a[0] >= b[0] ? a : b));
      const vRef = c[1] > meta.zPart ? mol.bbox!.v1 : mol.bbox!.v0;
      cotas.push({ id: 'hagua', texto: `H_line ${hMin.toFixed(1)} = ${enD.toFixed(2)}⌀`, ref: '§9.2.5 Eq 9.22', tipo: 'v', a: Math.min(c[1], vRef), b: Math.max(c[1], vRef), en: c[0], lado: 1, estado: est });
    }
    V.push({
      id: 'V9.1', titulo: 'Profundidad de la línea de agua, medida en DIÁMETROS', cita: '§9.2.5 · Fig 9.4 · Eq 9.22',
      estado: est, medido: `${hMin.toFixed(1)} mm = ${enD.toFixed(2)}·⌀ (${centros.length} líneas cortadas)`,
      limite: '2·⌀ < H < 5·⌀ (Eq 9.22)',
      porque: `"the magnitude of the stress increases as the cooling line approaches the mold wall". ` +
        (factor ? `A esta profundidad Fig 9.4 rotula σ = ${factor}. `
          : 'El factor de concentración NO se interpola: Fig 9.4 solo rotula 1⌀ → 3.3·P_melt y 4⌀ → 2.6·P_melt, y sale de la gráfica, no de la imagen. ') +
        (est === 'VIOLA' && enD < 2 && (2 - enD) * meta.diaAguaMm <= 1
          ? `El déficit son ${((2 - enD) * meta.diaAguaMm).toFixed(2)} mm: el trazo pide 2·⌀ = ${(2 * meta.diaAguaMm).toFixed(2)} y lo redondea a ${hMin.toFixed(0)} con Math.round. En el PISO de Eq 9.22 el redondeo tiene que ir hacia ARRIBA (steel-safe), como ya se hace con los extremos de los canales.`
          : ''),
    });
  } else {
    V.push({ id: 'V9.1', titulo: 'Profundidad de la línea de agua', cita: '§9.2.5 · Fig 9.4', estado: 'SIN CABLEAR', porque: 'el plano del sprue no cortó ninguna línea de agua' });
  }

  // ── V11.2 · fuerza de expulsión y área efectiva ────────────────────────────
  if (o?.expulsion) {
    datos.fEjectN = Math.round(o.expulsion.fEjectN);
    datos.aEffMm2 = Math.round(o.expulsion.aEffM2 * 1e6);
    V.push({
      id: 'V11.2', titulo: 'Fuerza de expulsión y área efectiva', cita: '§11.2.1-2 · Fig 11.5-11.7',
      estado: 'ADVIERTE',
      medido: `F_eject ${(o.expulsion.fEjectN / 1000).toFixed(1)} kN sobre A_eff ${(o.expulsion.aEffM2 * 1e6).toFixed(0)} mm²`,
      porque: 'Fig 11.5-11.7 son BASE GEOMÉTRICA de las Ecs. 11.1-11.2, sin juicio bueno/malo. Lo visual es la ELECCIÓN de secciones representativas: Fig 11.7 enseña que sumar solo dos secciones sería insuficiente en una pieza con costillas — esta sección es UNA sola, así que no basta por sí misma.',
    });
  } else {
    V.push({ id: 'V11.2', titulo: 'Fuerza de expulsión y área efectiva', cita: '§11.2.1-2 · Fig 11.5-11.7', estado: 'SIN CABLEAR', porque: 'pásale el diseño físico (pkg.diseno.expulsion) para dibujar los vectores' });
  }

  // ── V12.14 · carga del inserto de núcleo ───────────────────────────────────
  V.push({
    id: 'V12.14', titulo: 'Carga del inserto de núcleo', cita: '§12.2.7 · Fig 12.25-12.27',
    estado: 'SIN CABLEAR',
    porque: 'el libro AVISA contra creerle a esta misma imagen: "a more robust design may be provided by assuming that the cooling insert provides no support", aunque en la vista parezca que lo sostiene. La deflexión del núcleo no está cableada a esta lámina — no se pinta verde.',
  });

  // ── V12.15 · interlock del núcleo esbelto ──────────────────────────────────
  if (core?.bbox && mol?.bbox) {
    const machoH = mol.bbox.v1 - meta.zPart - meta.wall;
    const machoW = Math.max(1, meta.fy - 2 * meta.wall);
    const esbeltez = machoH / machoW;
    datos.machoAltoMm = +machoH.toFixed(2); datos.machoAnchoMm = +machoW.toFixed(2); datos.esbeltez = +esbeltez.toFixed(3);
    V.push({
      id: 'V12.15', titulo: 'Interlock del núcleo esbelto contra la cavidad', cita: '§12.2.7 · Fig 12.28',
      estado: 'SIN CABLEAR',
      medido: `macho ${machoH.toFixed(1)} × ${machoW.toFixed(1)} mm → esbeltez L/D ${esbeltez.toFixed(2)}`,
      porque: 'el apoyo del extremo libre del núcleo NO está modelado en el molde (ni el kernel lo genera todavía): es presencia/ausencia y hoy no se puede afirmar. El premio que promete el libro si se interconecta: "reduces the lateral deflection of the pin to approximately 10 % of the deflection for a pin that is supported on only one end".',
    });
  }

  // ── V12.18 · proporciones de la cabeza del tornillo ────────────────────────
  // "altura de cabeza = diámetro de rosca; diámetro de cabeza ≈ 150 % del diámetro
  //  de rosca" — se mide sobre lo DIBUJADO, no sobre la intención.
  if (torn && !torn.vacio && meta.tornillo) {
    // el lazo más ancho es la cabeza; el más angosto, el vástago
    let anchoMax = 0, anchoMin = Infinity, altoCabeza = 0;
    for (const L of torn.lazos) {
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (const p of L.pts) { u0 = Math.min(u0, p[0]); u1 = Math.max(u1, p[0]); v0 = Math.min(v0, p[1]); v1 = Math.max(v1, p[1]); }
      const anch = u1 - u0;
      if (anch > anchoMax) { anchoMax = anch; altoCabeza = v1 - v0; }
      anchoMin = Math.min(anchoMin, anch);
    }
    const rel = anchoMax / anchoMin, relAlto = altoCabeza / anchoMin;
    datos.tornCabezaDia = +anchoMax.toFixed(3); datos.tornVastagoDia = +anchoMin.toFixed(3);
    datos.tornCabezaAlto = +altoCabeza.toFixed(3);
    const ok = Math.abs(rel - 1.5) < 0.02 && Math.abs(relAlto - 1) < 0.02;
    V.push({
      id: 'V12.18', titulo: 'Proporciones de la cabeza del tornillo', cita: '§12.3.2 · Fig 12.32',
      estado: ok ? 'CUMPLE' : 'VIOLA',
      medido: `⌀cabeza/⌀rosca ${rel.toFixed(3)} · alto/⌀rosca ${relAlto.toFixed(3)} (${meta.tornillo.din})`,
      limite: '⌀cabeza = 1.5·d · alto = d',
      porque: ok ? 'medido sobre la sección dibujada, no sobre la intención'
        : 'la cabeza dibujada no respeta la proporción del libro',
    });
  } else {
    V.push({
      id: 'V12.18', titulo: 'Proporciones de la cabeza del tornillo', cita: '§12.3.2 · Fig 12.32', estado: 'SIN CABLEAR',
      porque: 'el plano del sprue no corta ningún tornillo de sujeción en este molde (los de la mitad cavidad están en las esquinas)',
    });
  }
  return { cotas, veredictos: V, datos };
}

// ─────────────────────────────────────────────────────────────────────────────
// LA LÁMINA
// ─────────────────────────────────────────────────────────────────────────────

const ESC = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `
  .bg{fill:#0b0f16}
  .tit{fill:#e9eef5;font:700 20px 'JetBrains Mono',monospace}
  .sub{fill:#8fa3bd;font:400 13px 'JetBrains Mono',monospace}
  .cita{fill:#c9a227;font:700 13px 'JetBrains Mono',monospace}
  .lbl{fill:#c3d0e0;font:400 12px 'JetBrains Mono',monospace}
  .lblSm{fill:#8fa3bd;font:400 10.5px 'JetBrains Mono',monospace}
  .cot{fill:#e9eef5;font:700 11px 'JetBrains Mono',monospace}
  .ok{fill:#59d98c} .mal{fill:#ff5c5c} .warn{fill:#ffb347} .nn{fill:#8fa3bd}
`;

/** color base y patrón de achurado por componente (Fig 1.6: uno distinto cada uno).
 *  `solido` = se rellena macizo en vez de achurarse: es la convención de dibujo
 *  para secciones DELGADAS (la pared del vaso mide 3 mm; a cualquier escala de
 *  hoja un achurado ahí no se lee). El plástico y el agua van macizos. */
const PALETA: Record<RolSeccion, { base: string; linea: string; solido?: boolean }> = {
  placa: { base: '#161e2b', linea: '#7d90ab' },
  inserto: { base: '#20293a', linea: '#a9c2de' },
  componente: { base: '#2b2513', linea: '#d7b23c' },
  moldeo: { base: '#ff9d4d', linea: '#ffd0a0', solido: true },
  agua: { base: '#2aa6e8', linea: '#bfe9ff', solido: true },
  colada: { base: '#e3c96a', linea: '#fff0b8', solido: true },
};
const COLOR_ESTADO: Record<EstadoV, string> = { CUMPLE: '#59d98c', ADVIERTE: '#ffb347', VIOLA: '#ff5c5c', 'SIN CABLEAR': '#8fa3bd' };

export interface OpcionesLamina {
  spec: MoldAssemblySpec;
  /** malla real de la pieza (opcional) */
  mallaPieza?: MallaSec;
  eje?: 'x' | 'y';
  /** diseño físico de la Máquina (pkg.diseno.expulsion) para V11.2 */
  expulsion?: { fEjectN: number; aEffM2: number } | null;
  ancho?: number; alto?: number;
}

/**
 * LÁMINA L5 — la sección del molde cerrado por el eje del sprue.
 * Devuelve el mismo objeto `Lamina` que `laminas-visuales.ts` (id/titulo/cita/
 * queMirar/svg) para que el visor y el ojo de los agentes la traten igual.
 */
export function laminaSeccionSprue(o: OpcionesLamina): Lamina & { medidas: MedidasSeccion; seccion: Seccion; meta: MetaMolde } {
  const W = o.ancho ?? 1080, H = o.alto ?? 760;
  const { solidos, meta, plano } = solidosDeMolde(o.spec, { eje: o.eje, mallaPieza: o.mallaPieza });
  const sec = seccionarPorPlano(solidos, plano);
  const med = medirSeccion(sec, meta, o.spec, { expulsion: o.expulsion ?? null });

  // ── encuadre ──
  const PADL = 46, DIBW = 648, TOP = 106, BOT = 104;
  const PX = PADL + DIBW + 18;                       // panel derecho
  const ANCHO_PANEL = W - PX - 8;
  const CHARS = Math.floor(ANCHO_PANEL / 6.35);      // JetBrains Mono 10.5px ≈ 6.35 px/car
  const CHARS_PIE = Math.floor((W - 2 * PADL) / 6.35);
  const rec = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1) + '…');
  const bb = sec.bbox ?? { u0: 0, u1: meta.D, v0: 0, v1: 100 };
  const anchoMm = (bb.u1 - bb.u0) || 1, altoMm = (bb.v1 - bb.v0) || 1;
  const k = Math.min((DIBW - PADL) / (anchoMm * 1.02), (H - TOP - BOT) / (altoMm * 1.02));
  const cx = PADL + DIBW / 2 - 8, cy = TOP + (H - TOP - BOT) / 2;
  const X = (u: number) => cx + (u - (bb.u0 + bb.u1) / 2) * k;
  const Y = (v: number) => cy - (v - (bb.v0 + bb.v1) / 2) * k;

  // ── defs: un ACHURADO PROPIO por componente (Fig 1.6) ──
  // El libro distingue los componentes por el patrón, no por el color: aquí cambia
  // el ÁNGULO, el PASO y el tono con el índice, para que dos vecinos nunca compartan
  // achurado. Las secciones delgadas (plástico, agua) van macizas: un achurado de
  // 3 mm de ancho no se lee ni en la hoja ni en la pantalla.
  const defs: string[] = [];
  const relleno = new Map<string, string>();
  // ángulos TODOS diagonales (nada de 0° ni 90°): un achurado casi vertical sobre un
  // pin de 10 mm deja el componente prácticamente sin rayas y parece hueco
  const ANG = [45, -45, 25, -25, 65, -65, 35, -35, 55, -55, 30, -30, 60, -60, 50];
  /** aclara un hex un pelo, para que dos componentes del mismo rol no se confundan */
  const tinte = (hex: string, f: number) => '#' + [1, 3, 5].map((k) => {
    const v = Math.min(255, Math.round(parseInt(hex.slice(k, k + 2), 16) * (1 + f)));
    return v.toString(16).padStart(2, '0');
  }).join('');
  sec.piezas.forEach((p, i) => {
    const pal = PALETA[p.rol];
    if (pal.solido) { relleno.set(p.id, pal.base); return; }
    const pid = `hx${i}`;
    relleno.set(p.id, `url(#${pid})`);
    const paso = (p.rol === 'placa' ? 8 : p.rol === 'inserto' ? 6 : 4.5) + (i % 3) * 1.5;
    const ang = ANG[i % ANG.length];
    defs.push(`<pattern id="${pid}" width="${paso}" height="${paso}" patternUnits="userSpaceOnUse" patternTransform="rotate(${ang})">`
      + `<rect width="${paso}" height="${paso}" fill="${tinte(pal.base, 0.16 * (i % 3))}"/>`
      + `<line x1="0" y1="0" x2="0" y2="${paso}" stroke="${pal.linea}" stroke-width="0.9" opacity="${0.5 + 0.14 * (i % 3)}"/></pattern>`);
  });

  // ── el dibujo, por orden de pintado ──
  const cuerpo: string[] = [];
  const globos: string[] = [];
  const puestos: Vec2[] = [];
  let nGlobo = 0;
  const numero = new Map<string, number>();
  /** ¿el punto cae DENTRO del lazo? (rayo horizontal) — un globo mal puesto miente */
  const dentro = (L: LazoSeccion, q: Vec2) => {
    let c = false;
    for (let i = 0, j = L.pts.length - 1; i < L.pts.length; j = i++) {
      const a = L.pts[i], b = L.pts[j];
      if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  };
  for (const p of sec.piezas) {
    if (p.vacio) continue;
    numero.set(p.id, ++nGlobo);
    const d = p.lazos.map((L) => 'M' + L.pts.map((q) => `${X(q[0]).toFixed(2)},${Y(q[1]).toFixed(2)}`).join('L') + 'Z').join('');
    cuerpo.push(`<path d="${d}" fill="${relleno.get(p.id)}" fill-rule="evenodd"/>`);
    const bordes = p.bordes.map((b) => `M${X(b[0]).toFixed(2)},${Y(b[1]).toFixed(2)}L${X(b[2]).toFixed(2)},${Y(b[3]).toFixed(2)}`).join('');
    cuerpo.push(`<path d="${bordes}" fill="none" stroke="${PALETA[p.rol].linea}" stroke-width="${p.rol === 'placa' ? 0.9 : 1.2}" opacity="0.95"/>`);
    // GLOBO de referencia a la leyenda. Se pone DENTRO del componente en el punto
    // de mayor holgura; si el componente es demasiado delgado para alojarlo (la
    // pared del vaso mide 3 mm), sale afuera con línea de referencia. Un globo
    // puesto "cerca" sería una etiqueta mintiendo sobre qué señala.
    const L = p.lazos.reduce((a, b) => (Math.abs(b.areaMm2) > Math.abs(a.areaMm2) ? b : a), p.lazos[0]);
    if (L && Math.abs(L.areaMm2) > 40) {
      let lu = Infinity, lv = Infinity, ru = -Infinity, rv = -Infinity;
      for (const q of L.pts) { lu = Math.min(lu, q[0]); lv = Math.min(lv, q[1]); ru = Math.max(ru, q[0]); rv = Math.max(rv, q[1]); }
      let mejor: Vec2 | null = null, holgura = 0;
      for (let i = 1; i <= 9; i++) for (let j = 1; j <= 9; j++) {
        const g: Vec2 = [lu + ((ru - lu) * i) / 10, lv + ((rv - lv) * j) / 10];
        if (!dentro(L, g)) continue;
        const h = distAlContorno(p, g) * k;
        if (h > holgura) { holgura = h; mejor = g; }
      }
      const libre = (x: number, y: number) => !puestos.some((q) => Math.hypot(q[0] - x, q[1] - y) < 19);
      let gx = 0, gy = 0, guia = '';
      if (mejor && holgura >= 9.5 && libre(X(mejor[0]), Y(mejor[1]))) { gx = X(mejor[0]); gy = Y(mejor[1]); }
      else {
        // afuera, arriba del componente, con línea de referencia a su borde. Se
        // apunta al PRIMER CUARTO y no al centro: el centro de la impresión es el
        // eje del sprue, y ahí el globo del moldeo caía encima del bebedero.
        const px0 = X(lu + (ru - lu) * 0.25);
        let cand = [0, 22, -22, 44, -44, 66, -66].map((dx) => [px0 + dx, Y(rv) - 13] as Vec2).find((q) => libre(q[0], q[1]));
        if (!cand) cand = [px0, Y(rv) - 13];
        gx = cand[0]; gy = cand[1];
        guia = `<line x1="${gx.toFixed(1)}" y1="${(gy + 7).toFixed(1)}" x2="${px0.toFixed(1)}" y2="${Y(rv).toFixed(1)}" stroke="${PALETA[p.rol].linea}" stroke-width="0.7" opacity="0.8"/>`;
      }
      puestos.push([gx, gy]);
      globos.push(guia + `<circle cx="${gx.toFixed(1)}" cy="${gy.toFixed(1)}" r="7.5" fill="#0b0f16" fill-opacity="0.8" stroke="${PALETA[p.rol].linea}" stroke-width="0.8"/>`
        + `<text class="cot" style="fill:${PALETA[p.rol].linea}" x="${gx.toFixed(1)}" y="${(gy + 3.8).toFixed(1)}" text-anchor="middle">${nGlobo}</text>`);
    }
  }

  // línea de partición (§1.3.2: el molde ABRE aquí)
  const yPart = Y(meta.zPart);
  cuerpo.push(`<line x1="${(X(bb.u0) - 24).toFixed(1)}" y1="${yPart.toFixed(1)}" x2="${(X(bb.u1) + 10).toFixed(1)}" y2="${yPart.toFixed(1)}" stroke="#c9a227" stroke-width="1.1" stroke-dasharray="10 4 2 4" opacity="0.9"/>`);
  cuerpo.push(`<rect x="${(X(bb.u0) + 2).toFixed(1)}" y="${(yPart - 15).toFixed(1)}" width="92" height="12" fill="#0b0f16" fill-opacity="0.82" rx="2"/>`
    + `<text class="lblSm" style="fill:#c9a227" x="${(X(bb.u0) + 5).toFixed(1)}" y="${(yPart - 5.5).toFixed(1)}">PARTICIÓN A|B</text>`);
  // eje del sprue (línea de centro dash-dot, convención de dibujo)
  const uSprue = meta.eje === 'x' ? meta.ySprue : meta.xSprue;
  cuerpo.push(`<line x1="${X(uSprue).toFixed(1)}" y1="${(TOP - 8).toFixed(1)}" x2="${X(uSprue).toFixed(1)}" y2="${(H - BOT + 8).toFixed(1)}" stroke="#e3c96a" stroke-width="0.7" stroke-dasharray="14 5 3 5" opacity="0.5"/>`);
  // barra de escala (una lámina sin escala no se puede medir a ojo)
  const escMm = anchoMm > 200 ? 50 : 20, ex0 = PADL + 4, ey = H - BOT + 2;
  cuerpo.push(`<line x1="${ex0}" y1="${ey}" x2="${ex0 + escMm * k}" y2="${ey}" stroke="#8fa3bd" stroke-width="1.4"/>`
    + `<line x1="${ex0}" y1="${ey - 4}" x2="${ex0}" y2="${ey + 4}" stroke="#8fa3bd" stroke-width="1.4"/>`
    + `<line x1="${ex0 + escMm * k}" y1="${ey - 4}" x2="${ex0 + escMm * k}" y2="${ey + 4}" stroke="#8fa3bd" stroke-width="1.4"/>`
    + `<text class="lblSm" x="${ex0 + escMm * k / 2}" y="${ey - 7}" text-anchor="middle">${escMm} mm</text>`);

  // ── cotas (con chip de fondo: si no, el número se pierde en el achurado) ──
  const cotas: string[] = [];
  const flecha = (x: number, y: number, dir: number, vertical: boolean) => vertical
    ? `<path d="M${x.toFixed(1)},${y.toFixed(1)} l-3,${dir * 6.5} l6,0 Z" fill="#e9eef5"/>`
    : `<path d="M${x.toFixed(1)},${y.toFixed(1)} l${dir * 6.5},-3 l0,6 Z" fill="#e9eef5"/>`;
  // las líneas de cota que se encimarían se CORREN hacia afuera (dos cotas
  // superpuestas no se leen, y una cota que no se lee no cota)
  const usadas: Array<{ x: number; y0: number; y1: number }> = [];
  for (const c of med.cotas) {
    const col = COLOR_ESTADO[c.estado];
    if (c.tipo === 'v') {
      const y1 = Y(c.a), y2 = Y(c.b);
      const yLo = Math.min(y1, y2) - 46, yHi = Math.max(y1, y2) + 46;   // + el largo del rótulo
      let xc = X(c.en) + c.lado * 20;
      for (let g = 0; g < 8; g++) {
        if (!usadas.some((q) => Math.abs(q.x - xc) < 24 && q.y1 > yLo && q.y0 < yHi)) break;
        xc += c.lado * 26;
      }
      usadas.push({ x: xc, y0: yLo, y1: yHi });
      const ancho = c.texto.length * 6.7 + 6;
      cotas.push(`<line x1="${X(c.en).toFixed(1)}" y1="${y1.toFixed(1)}" x2="${xc.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="${col}" stroke-width="0.5" opacity="0.65"/>`
        + `<line x1="${X(c.en).toFixed(1)}" y1="${y2.toFixed(1)}" x2="${xc.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="0.5" opacity="0.65"/>`
        + `<line x1="${xc.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${xc.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="1"/>`
        + flecha(xc, y1, 1, true) + flecha(xc, y2, -1, true)
        + `<rect x="${(xc + c.lado * 4 - (c.lado > 0 ? 0 : 13)).toFixed(1)}" y="${((y1 + y2) / 2 - ancho / 2).toFixed(1)}" width="13" height="${ancho.toFixed(1)}" fill="#0b0f16" fill-opacity="0.82" rx="2"/>`
        + `<text class="cot" style="fill:${col}" transform="translate(${(xc + c.lado * 4 + (c.lado > 0 ? 10 : -3)).toFixed(1)},${((y1 + y2) / 2).toFixed(1)}) rotate(-90)" text-anchor="middle">${ESC(c.texto)}</text>`);
    } else {
      const yc = Y(c.en);
      const x1 = X(c.a), x2 = X(c.b);
      const ancho = c.texto.length * 6.7 + 6;
      cotas.push(`<line x1="${x1.toFixed(1)}" y1="${yc.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${yc.toFixed(1)}" stroke="${col}" stroke-width="1"/>`
        + flecha(x1, yc, 1, false) + flecha(x2, yc, -1, false)
        + `<rect x="${((x1 + x2) / 2 - ancho / 2).toFixed(1)}" y="${(yc - 17).toFixed(1)}" width="${ancho.toFixed(1)}" height="13" fill="#0b0f16" fill-opacity="0.82" rx="2"/>`
        + `<text class="cot" style="fill:${col}" x="${((x1 + x2) / 2).toFixed(1)}" y="${(yc - 7).toFixed(1)}" text-anchor="middle">${ESC(c.texto)}</text>`);
    }
  }

  // ── panel derecho: leyenda + veredictos ──
  const panel: string[] = [];
  let py = TOP - 12;
  panel.push(`<text class="lbl" style="font-weight:700" x="${PX}" y="${py}">COMPONENTES · achurado propio (Fig 1.6)</text>`);
  py += 15;
  for (const p of sec.piezas) {
    if (p.vacio) continue;
    panel.push(`<rect x="${PX}" y="${(py - 8).toFixed(1)}" width="15" height="9.5" fill="${relleno.get(p.id)}" stroke="${PALETA[p.rol].linea}" stroke-width="0.6"/>`);
    panel.push(`<text class="lblSm" style="fill:#8fa3bd" x="${PX + 19}" y="${py}">${numero.get(p.id)}</text>`);
    panel.push(`<text class="lblSm" x="${PX + 34}" y="${py}">${ESC(rec(p.nombre + (p.nota ? ` · ${p.nota}` : ''), CHARS - 6))}</text>`);
    py += 12.6;
  }
  py += 10;
  panel.push(`<text class="lbl" style="font-weight:700" x="${PX}" y="${py}">LO QUE ESTA LÁMINA JUZGA</text>`);
  py += 14;
  for (const v of med.veredictos) {
    const col = COLOR_ESTADO[v.estado];
    panel.push(`<circle cx="${PX + 4}" cy="${(py - 3.5).toFixed(1)}" r="3.4" fill="${col}"/>`);
    panel.push(`<text class="lblSm" style="fill:${col};font-weight:700" x="${PX + 12}" y="${py}">${ESC(v.id)} ${ESC(v.estado)}</text>`);
    py += 11.4;
    panel.push(`<text class="lblSm" x="${PX + 12}" y="${py}">${ESC(rec(v.titulo, CHARS - 2))}</text>`);
    py += 11.4;
    if (v.medido) { panel.push(`<text class="lblSm" style="fill:#c3d0e0" x="${PX + 12}" y="${py}">${ESC(rec('· ' + v.medido + (v.limite ? `  [${v.limite}]` : ''), CHARS - 2))}</text>`); py += 11.4; }
    py += 2.5;
  }

  // ── pie: qué mirar + extensiones declaradas ──
  const sinCablear = med.veredictos.filter((v) => v.estado === 'SIN CABLEAR').map((v) => v.id);
  const pie: string[] = [];
  let fy = H - BOT + 30;
  const LIN = 13;
  // EL HALLAZGO con la cita literal del libro: es lo que hace accionable la lámina
  // (en el panel solo cabe el número; el porqué, con su §, va aquí, en dos renglones).
  const peor = med.veredictos.find((v) => v.estado === 'VIOLA') ?? med.veredictos.find((v) => v.estado === 'ADVIERTE');
  if (peor) {
    const txt = `${peor.estado} ${peor.id} (${peor.cita}): ${peor.porque}`;
    let corte = txt.length > CHARS_PIE ? txt.lastIndexOf(' ', CHARS_PIE) : txt.length;
    if (corte < CHARS_PIE * 0.6) corte = CHARS_PIE;
    for (const t of [txt.slice(0, corte), txt.slice(corte).trim()]) {
      if (!t) continue;
      pie.push(`<text class="lblSm" style="fill:${COLOR_ESTADO[peor.estado]}" x="${PADL}" y="${fy}">${ESC(rec(t, CHARS_PIE))}</text>`);
      fy += LIN;
    }
  }
  pie.push(`<text class="lblSm" style="fill:#c3d0e0" x="${PADL}" y="${fy}">${ESC(rec('MEDIDO SOBRE LA SECCIÓN (no sobre el spec): altura de inserto · mejilla · profundidad de cavidad · profundidad del agua en ⌀ (del EJE a la superficie moldeante, en el plano) · cabeza del tornillo', CHARS_PIE))}</text>`);
  fy += LIN;
  pie.push(`<text class="lblSm" style="fill:${sinCablear.length ? '#ffb347' : '#59d98c'}" x="${PADL}" y="${fy}">${ESC(rec(`SIN CABLEAR — no cuenta como cumplido: ${sinCablear.length ? sinCablear.join(' · ') : 'ninguna'}`, CHARS_PIE))}</text>`);
  fy += LIN;
  const ext = meta.extensiones.concat([
    'los barrenos de pin/tornillo/bebedero NO se restan de la placa (el componente va encima): el área de placa es BRUTA',
    o.mallaPieza ? 'moldeo = malla REAL del cliente' : 'moldeo = cáscara nominal del spec (huella × profundidad × pared)',
  ]);
  pie.push(`<text class="lblSm" style="fill:#8fa3bd" x="${PADL}" y="${fy}">${ESC(rec('EXTENSIONES DECLARADAS (el libro no las da): ' + ext.join(' · '), CHARS_PIE))}</text>`);
  if (meta.avisos.length) {
    fy += LIN;
    pie.push(`<text class="lblSm" style="fill:#ffb347" x="${PADL}" y="${fy}">${ESC(rec('AVISOS DEL CIRCUITO §9.2: ' + meta.avisos.join(' · '), CHARS_PIE))}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS}</style><defs>${defs.join('')}</defs>
<rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PADL}" y="34">SECCIÓN POR EL EJE DEL SPRUE · MOLDE CERRADO</text>
<text class="sub" style="font:700 14px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PADL}" y="55">${ESC(rec(o.spec.name, 40))} · ${o.spec.nCav ?? 1} cav · base ${meta.W}×${meta.D} mm · corte ⟂ ${meta.eje.toUpperCase()} en ${(meta.eje === 'x' ? meta.xSprue : meta.ySprue).toFixed(0)} mm</text>
<text class="cita" x="${PADL}" y="74">§1.3.2 · Fig 1.6 "Top and cross section views of a two-plate mold" — achurado distinto por componente</text>
<text class="lblSm" x="${PADL}" y="90">área de la sección ${sec.areaTotalMm2.toFixed(0)} mm² · ${sec.piezas.filter((p) => !p.vacio).length}/${sec.piezas.length} componentes cortados · ${meta.nCavCortadas} impresión(es) en el plano · ⌀agua ${meta.diaAguaMm} mm</text>
${cuerpo.join('')}
${globos.join('')}
${cotas.join('')}
${panel.join('')}
${pie.join('')}
</svg>`;

  return {
    id: 'L5-seccion-sprue',
    titulo: `Sección por el eje del sprue — ${o.spec.name}`,
    cita: '§1.3.2 Fig 1.6 · §4.2.1 Fig 4.13 · §4.2.2 Fig 4.14 · §9.2.5 Fig 9.4 · §12.2.4 Fig 12.18 · §12.3.2 Fig 12.32',
    queMirar: '¿cada componente tiene SU achurado y se distingue del vecino? ¿la cota de altura de inserto llega a 3·⌀ de la línea de agua? ¿la mejilla iguala la profundidad de cavidad (o los 3·⌀ si esa manda)? ¿las líneas de agua salen cortadas y a 2-5⌀ de la superficie moldeante? ¿lo que está en gris dice SIN CABLEAR en vez de fingir verde?',
    svg, medidas: med, seccion: sec, meta,
  };
}
