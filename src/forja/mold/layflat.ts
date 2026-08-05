/**
 * LAY-FLAT CON ARCOS Y PHANTOM GATES — el método gráfico de Kazmer (§5.5.4 · §5.5.5).
 * ============================================================================
 * Esta es LA VISTA A MANO del libro, y vale aunque ya tengamos simulación 3D
 * (`flowlen.ts`) por una razón sola: **hace auditable el resultado**. Sobre el
 * lay-flat, "el perímetro es más corto que la línea central" se ve de un vistazo;
 * en un mapa de colores 3D hay que creerle al solver.
 *
 * EL MÉTODO, LITERAL (§5.5.4 Predicting Filling Patterns, Fig 5.15-5.17):
 *   · "the sides of the container are 'cut' at the corners and the side walls folded
 *      down to make a lay flat. The gate location is next identified. The flow will
 *      emanate from the gate producing a circular melt front. As such, an arc may be
 *      drawn from the gate representing the position of the melt at a given point in
 *      time."
 *   · "the distance between arc is equal to the linear melt velocity times the time step."
 *   · "This can be accomplished by creating a 'phantom' gate and maintaining the same
 *      flow lengths from this 'phantom' gate as from the real gate. For each time step,
 *      the length of flow is increased and an arc of corresponding radius is drawn."
 *   · "Intersecting arcs corresponding to the same time step are then trimmed. The flow
 *      is advanced with more phantom gates added as needed until the flow throughout the
 *      entire lay flat is created."
 *
 * QUÉ ES UN PHANTOM GATE, EN GEOMETRÍA (y por qué el método de Kazmer es EXACTO):
 * el lay-flat despliega cada pared girándola sobre su bisagra con el fondo. Dos caras
 * unidas por una bisagra quedan CORRECTAMENTE desplegadas entre sí ⇒ una recta del
 * lay-flat que cruza una bisagra ES la geodésica (el camino real del fundido). Pero en
 * una ESQUINA (la arista vertical entre dos paredes) el desdoblado abre una cuña — ahí
 * el libro "corta". El fundido SÍ pasa por esa esquina, y su camino, dibujado en el
 * lay-flat, deja de ser recto. La corrección es una ISOMETRÍA: girar la compuerta
 * alrededor del vértice de la esquina por el ángulo de la cuña. Esa imagen de la
 * compuerta es EL PHANTOM GATE, y por construcción "mantiene las mismas longitudes de
 * flujo que la compuerta real" — que es palabra por palabra lo que pide el libro.
 * (Es el método clásico de "unfolding" para geodésicas sobre poliedros: exacto, no
 * aproximado, mientras la cara sea convexa.)
 *
 * RESISTENCIA ≠ DISTANCIA (§5.5.5, Eq 5.22 — el corazón de V5.5):
 * el frente NO avanza a la distancia, avanza a la MENOR CAÍDA DE PRESIÓN:
 *      ΔP ∝ L / H^(1+n)          (Eq 5.22, power-law entre placas)
 * Una pared GRUESA y LEJANA se llena ANTES que una DELGADA y CERCANA. Por eso los arcos
 * de este módulo son iso-RESISTENCIA (expresada en "mm equivalentes de pared nominal"),
 * no iso-distancia: en la zona delgada los arcos se aprietan, que es exactamente lo que
 * el libro dibuja en Fig 5.19 ("los arcos en la zona delgada se dibujan con radio menor").
 *
 * DOS MODELOS DE VELOCIDAD, los dos del libro, DECLARADOS:
 *   · 'libro-lineal'  → v ∝ H (Eq 5.32/5.33: v_región = v_ref·L_región/L_ref, y de ahí
 *     H_lateral = 2 mm × 210/280 = 1.5 mm, que es LA CIFRA de §5.5.5). Es el modelo con
 *     el que Kazmer construye Fig 5.18/5.19 a mano. DEFAULT: reproduce el libro literal.
 *   · 'eq5.22'        → v ∝ H^(1+n) (Eq 5.22 con el n del fundido). Es el modelo que ya
 *     usa el motor 3D `flowlen.ts`. Más duro con la pared delgada.
 * Se imprimen los dos en la lámina: ninguno se esconde.
 *
 * LO QUE ESTE MÓDULO **NO** MODELA (extensiones/limitaciones DECLARADAS, no se pintan
 * verdes en ningún lado):
 *   · REFRACCIÓN del camino al cambiar de espesor (Snell). El camino se optimiza sobre
 *     la familia de rutas de desdoblado (recto por tramo), igual que el método a mano.
 *   · DRAFT y FILETES: el desdoblado usa esquinas vivas. El libro TAMBIÉN acota 280 y
 *     210 sobre el lay-flat de esquinas vivas aunque Fig 5.15 diga "2° draft with 10 mm
 *     fillets". La corrección por filete se CALCULA y se imprime (no se aplica).
 *   · BASES NO CONVEXAS: un vértice reflejo hace que las paredes desdobladas se
 *     SOLAPEN. Se detecta y se avisa; el lay-flat de una base así no es fiable.
 *
 * PURO (sin three.js, sin DOM) → node-testeable y renderizable a PNG.
 */
import type { Lamina } from './laminas-visuales';
import { flowLeaderThickness, flowLeaderVelocityRatio } from './flowleaders';

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

const ESC = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Espejo local del CSS de `laminas-visuales.ts` (ahí es privado y NO se toca). */
const CSS = `
  .bg{fill:#0b0f16}
  .tit{fill:#e9eef5;font:700 20px 'JetBrains Mono',monospace}
  .sub{fill:#8fa3bd;font:400 13px 'JetBrains Mono',monospace}
  .cita{fill:#c9a227;font:700 13px 'JetBrains Mono',monospace}
  .lbl{fill:#c3d0e0;font:400 12px 'JetBrains Mono',monospace}
  .lblSm{fill:#8fa3bd;font:400 10.5px 'JetBrains Mono',monospace}
  .ok{fill:#59d98c} .mal{fill:#ff5c5c} .warn{fill:#ffb347}
`;

// ══════════════════════════════════════════════════════════════════════════════
// 0 · ISOMETRÍAS DEL PLANO (el álgebra de los phantom gates)
// ══════════════════════════════════════════════════════════════════════════════

/** p' = R(θ)·p + t, guardada como (cos, sin, tx, ty). */
export interface Iso { c: number; s: number; tx: number; ty: number }
export const ISO_ID: Iso = { c: 1, s: 0, tx: 0, ty: 0 };
export const isoAp = (m: Iso, p: Vec2): Vec2 =>
  [m.c * p[0] - m.s * p[1] + m.tx, m.s * p[0] + m.c * p[1] + m.ty];
/** A∘B (primero B, luego A) */
export const isoComp = (A: Iso, B: Iso): Iso => ({
  c: A.c * B.c - A.s * B.s, s: A.s * B.c + A.c * B.s,
  tx: A.c * B.tx - A.s * B.ty + A.tx, ty: A.s * B.tx + A.c * B.ty + A.ty,
});
export const isoInv = (m: Iso): Iso => {
  const c = m.c, s = -m.s;
  return { c, s, tx: -(c * m.tx - s * m.ty), ty: -(s * m.tx + c * m.ty) };
};
/** giro de θ alrededor de V — LA operación del phantom gate */
export const isoGiro = (V: Vec2, th: number): Iso => {
  const c = Math.cos(th), s = Math.sin(th);
  return { c, s, tx: V[0] - (c * V[0] - s * V[1]), ty: V[1] - (s * V[0] + c * V[1]) };
};

// ══════════════════════════════════════════════════════════════════════════════
// 1 · LA PIEZA Y SU DESDOBLADO
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Pieza prismática de pared delgada: polígono base + paredes verticales. Es la
 * familia del contenedor de Fig 5.15 (y de la mayoría de las cajas moldeadas).
 */
export interface PiezaLayFlat {
  nombre: string;
  /** polígono base en XY (mm). Se normaliza a CCW. Debe ser CONVEXO (se avisa si no). */
  base: Vec2[];
  /** altura de las paredes (mm) */
  alturaMm: number;
  /** pared nominal (mm) — la referencia de la resistencia */
  espesorNomMm: number;
  /** espesor del fondo (mm). Ausente = nominal */
  espesorFondoMm?: number;
  /** espesor por PARED, indexado por arista de la base (mm). Ausente = nominal */
  espesorParedMm?: number[];
  /** SOLO SE REPORTA (no se modela): salida de molde declarada */
  draftDeg?: number;
  /** SOLO SE REPORTA (no se modela): radio de filete en las esquinas */
  filetesMm?: number;
}

export interface CaraDesdoblada {
  id: string;
  tipo: 'fondo' | 'pared';
  /** índice de arista de la base (−1 para el fondo) */
  arista: number;
  /** polígono en el plano del lay-flat (mm) */
  poly: Vec2[];
  /** área del polígono desdoblado (shoelace) */
  areaMm2: number;
  /** área de la misma cara en 3D (analítica) — el invariante del desdoblado */
  area3dMm2: number;
  espesorMm: number;
}

export interface LayFlat {
  pieza: PiezaLayFlat;
  base: Vec2[];                 // base normalizada a CCW
  m: number;                    // nº de aristas
  H: number;
  caras: CaraDesdoblada[];      // [0]=fondo, [k+1]=pared k
  /** normal exterior de cada arista de la base (unitaria) */
  normal: Vec2[];
  /** ángulo de la CUÑA que abre el corte en cada vértice (rad) = π − ángulo interior */
  gap: number[];
  bbox: { u0: number; v0: number; u1: number; v1: number };
  areaDesdobladaMm2: number;
  area3dMm2: number;
  errAreaPct: number;
  convexa: boolean;
  avisos: string[];
  /** proyecta un punto 3D de la superficie al plano del lay-flat */
  aPlano(p3: Vec3, tolMm?: number): { cara: number; uv: Vec2 } | null;
}

const shoelace = (p: Vec2[]) => {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const j = (i + 1) % p.length; a += p[i][0] * p[j][1] - p[j][0] * p[i][1]; }
  return a / 2;
};

/**
 * EL DESDOBLADO — "the sides of the container are 'cut' at the corners and the side
 * walls folded down to make a lay flat" (§5.5.4).
 *
 * El fondo se queda quieto; cada pared gira sobre SU bisagra (la arista de la base) y
 * cae al plano por FUERA. El giro es una isometría ⇒ el área y todas las distancias
 * DENTRO de cada cara se conservan EXACTAMENTE (es el invariante que verifica el gate).
 */
export function desdoblar(p: PiezaLayFlat): LayFlat {
  const avisos: string[] = [];
  let base = p.base.map((q) => [q[0], q[1]] as Vec2);
  if (shoelace(base) < 0) base = base.slice().reverse();
  const m = base.length;
  const H = p.alturaMm;

  // normales EXTERIORES: para un polígono CCW, n̂ = (ê.y, −ê.x)
  const normal: Vec2[] = [];
  const largo: number[] = [];
  for (let k = 0; k < m; k++) {
    const A = base[k], B = base[(k + 1) % m];
    const ex = B[0] - A[0], ey = B[1] - A[1];
    const L = Math.hypot(ex, ey) || 1;
    largo.push(L);
    normal.push([ey / L, -ex / L]);
  }

  // convexidad + cuña del corte en cada vértice v (entre la pared v−1 y la pared v)
  let convexa = true;
  const gap: number[] = [];
  for (let v = 0; v < m; v++) {
    const na = normal[(v - 1 + m) % m], nb = normal[v];
    const th = Math.atan2(na[0] * nb[1] - na[1] * nb[0], na[0] * nb[0] + na[1] * nb[1]);
    gap.push(th);
    if (th < -1e-9) convexa = false;
  }
  if (!convexa) avisos.push('la base NO es convexa: las paredes desdobladas se SOLAPAN — el lay-flat de esta pieza no es fiable (limitación declarada del método a mano)');

  const hNom = p.espesorNomMm;
  const caras: CaraDesdoblada[] = [];
  const areaBase = shoelace(base);
  caras.push({
    id: 'fondo', tipo: 'fondo', arista: -1, poly: base,
    areaMm2: Math.abs(areaBase), area3dMm2: Math.abs(areaBase),
    espesorMm: p.espesorFondoMm ?? hNom,
  });
  for (let k = 0; k < m; k++) {
    const A = base[k], B = base[(k + 1) % m], n = normal[k];
    const poly: Vec2[] = [A, B, [B[0] + H * n[0], B[1] + H * n[1]], [A[0] + H * n[0], A[1] + H * n[1]]];
    caras.push({
      id: `pared-${k}`, tipo: 'pared', arista: k, poly,
      areaMm2: Math.abs(shoelace(poly)), area3dMm2: largo[k] * H,
      espesorMm: p.espesorParedMm?.[k] ?? hNom,
    });
  }

  const areaDes = caras.reduce((s, c) => s + c.areaMm2, 0);
  const area3d = caras.reduce((s, c) => s + c.area3dMm2, 0);
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (const c of caras) for (const q of c.poly) {
    if (q[0] < u0) u0 = q[0]; if (q[0] > u1) u1 = q[0];
    if (q[1] < v0) v0 = q[1]; if (q[1] > v1) v1 = q[1];
  }

  const lf: LayFlat = {
    pieza: p, base, m, H, caras, normal, gap,
    bbox: { u0, v0, u1, v1 },
    areaDesdobladaMm2: areaDes, area3dMm2: area3d,
    errAreaPct: area3d > 0 ? Math.abs(areaDes - area3d) / area3d * 100 : 0,
    convexa, avisos,
    aPlano(p3, tolMm = 1e-6) {
      const [x, y, z] = p3;
      // ¿fondo? (z ≈ 0 y dentro del polígono)
      if (Math.abs(z) <= Math.max(tolMm, 1e-9) && dentroPoly([x, y], base)) return { cara: 0, uv: [x, y] };
      // ¿alguna pared? (proyección sobre la arista, 0 ≤ z ≤ H)
      let best: { cara: number; uv: Vec2; d: number } | null = null;
      for (let k = 0; k < m; k++) {
        const A = base[k], B = base[(k + 1) % m], L = largo[k];
        const ex = (B[0] - A[0]) / L, ey = (B[1] - A[1]) / L;
        const s = (x - A[0]) * ex + (y - A[1]) * ey;
        const perp = Math.abs((x - A[0]) * normal[k][0] + (y - A[1]) * normal[k][1]);
        if (s < -tolMm || s > L + tolMm) continue;
        const dz = z < 0 ? -z : z > H ? z - H : 0;
        const d = Math.hypot(perp, dz);
        const zc = Math.max(0, Math.min(H, z));
        const uv: Vec2 = [A[0] + s * ex + zc * normal[k][0], A[1] + s * ey + zc * normal[k][1]];
        if (!best || d < best.d) best = { cara: k + 1, uv, d };
      }
      if (best && best.d <= Math.max(tolMm, 1e-6)) return { cara: best.cara, uv: best.uv };
      return null;
    },
  };
  return lf;
}

/** dentro de un polígono CONVEXO (o casi): mismo signo en todos los productos cruz */
function dentroPoly(q: Vec2, poly: Vec2[], tol = 1e-9): boolean {
  let pos = 0, neg = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const cr = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
    if (cr > tol) pos++; else if (cr < -tol) neg++;
  }
  return pos === 0 || neg === 0;
}

// ══════════════════════════════════════════════════════════════════════════════
// 2 · RUTAS DE DESDOBLADO Y PHANTOM GATES
// ══════════════════════════════════════════════════════════════════════════════

export type Modelo = 'libro-lineal' | 'eq5.22';
/** índice power-law del ABS MG47 (Eq 5.22) — el mismo que usa `flowlen.ts` */
export const N_ABS_MG47 = 0.348;
/** exponente de la resistencia: ΔP ∝ L/H^p */
export const expModelo = (mo: Modelo, n = N_ABS_MG47) => (mo === 'eq5.22' ? 1 + n : 1);

export interface CompuertaLayFlat {
  nombre: string;
  /** cara del lay-flat donde entra el fundido */
  cara: number;
  /** posición en el plano del lay-flat (mm) */
  uv: Vec2;
  /** punto 3D original, si se dio */
  p3?: Vec3;
  /** de dónde salió esta posición (para que la lámina lo declare) */
  origen: string;
}

/** una arista compartida entre dos caras, en el marco de la cara DESTINO */
interface Cruce { a: Vec2; b: Vec2 }

export interface Ruta {
  /** caras recorridas, de la del gate a la de destino */
  caras: number[];
  /** el GATE (real o PHANTOM) expresado en el marco de la cara destino */
  fuente: Vec2;
  /** true si hubo al menos una esquina ⇒ la fuente es un phantom gate */
  fantasma: boolean;
  /** vértices de esquina atravesados (para etiquetar el phantom) */
  esquinas: number[];
  aristas: Cruce[];
  /** inv[i]: marco de la cara destino → marco lay-flat de caras[i] */
  inv: Iso[];
  /** ¿pasa por el fondo? (para separar "centerline" de "perímetro") */
  porFondo: boolean;
}

/** vecinos de una cara: [caraVecina, isometría marco→marcoVecino, arista en el marco vecino, vérticeEsquina|−1] */
function vecinos(lf: LayFlat, f: number): Array<{ g: number; M: Iso; e: Cruce; esquina: number }> {
  const out: Array<{ g: number; M: Iso; e: Cruce; esquina: number }> = [];
  const { base, m, H, normal } = lf;
  if (f === 0) {
    for (let k = 0; k < m; k++) {
      out.push({ g: k + 1, M: ISO_ID, e: { a: base[k], b: base[(k + 1) % m] }, esquina: -1 });
    }
    return out;
  }
  const k = f - 1;
  // bisagra con el fondo: las dos caras YA están bien desdobladas entre sí ⇒ identidad
  out.push({ g: 0, M: ISO_ID, e: { a: base[k], b: base[(k + 1) % m] }, esquina: -1 });
  // esquina hacia la pared k+1 (vértice k+1)
  {
    const v = (k + 1) % m, V = base[v], nb = normal[v];
    out.push({ g: v + 1, M: isoGiro(V, lf.gap[v]), e: { a: V, b: [V[0] + H * nb[0], V[1] + H * nb[1]] }, esquina: v });
  }
  // esquina hacia la pared k−1 (vértice k)
  {
    const v = k, V = base[v], na = normal[(v - 1 + m) % m];
    out.push({ g: ((v - 1 + m) % m) + 1, M: isoGiro(V, -lf.gap[v]), e: { a: V, b: [V[0] + H * na[0], V[1] + H * na[1]] }, esquina: v });
  }
  return out;
}

/**
 * TODAS las rutas de desdoblado desde la cara de la compuerta, con su phantom gate.
 * Cada ruta = una secuencia de caras sin repetir; su `fuente` es la imagen del gate
 * en el marco de la última cara — "maintaining the same flow lengths from this
 * 'phantom' gate as from the real gate" (§5.5.4), pero calculado, no dibujado a ojo.
 */
export function rutasDesdoblado(lf: LayFlat, gate: CompuertaLayFlat, maxCaras = 4): Ruta[] {
  const out: Ruta[] = [];
  type Est = { caras: number[]; Ms: Iso[]; aristas: Cruce[]; fuente: Vec2; esquinas: number[] };
  const inicial: Est = { caras: [gate.cara], Ms: [], aristas: [], fuente: gate.uv, esquinas: [] };
  const cerrar = (e: Est) => {
    // C_i = M_{n−1}∘…∘M_i (marco de caras[i] → marco destino); inv[i] = C_i^{−1}
    const n = e.caras.length;
    const C: Iso[] = new Array(n);
    C[n - 1] = ISO_ID;
    for (let i = n - 2; i >= 0; i--) C[i] = isoComp(C[i + 1], e.Ms[i]);
    out.push({
      caras: e.caras.slice(), fuente: e.fuente, fantasma: e.esquinas.length > 0,
      esquinas: e.esquinas.slice(), aristas: e.aristas.slice(),
      inv: C.map(isoInv), porFondo: e.caras.includes(0),
    });
  };
  const rec = (e: Est) => {
    cerrar(e);
    if (e.caras.length >= maxCaras) return;
    const f = e.caras[e.caras.length - 1];
    for (const vn of vecinos(lf, f)) {
      if (e.caras.includes(vn.g)) continue;
      rec({
        caras: [...e.caras, vn.g],
        Ms: [...e.Ms, vn.M],
        aristas: [...e.aristas.map((c) => ({ a: isoAp(vn.M, c.a), b: isoAp(vn.M, c.b) })), vn.e],
        fuente: isoAp(vn.M, e.fuente),
        esquinas: vn.esquina >= 0 ? [...e.esquinas, vn.esquina] : e.esquinas.slice(),
      });
    }
  };
  rec(inicial);
  return out;
}

export interface Llegada {
  /** longitud de flujo GEOMÉTRICA recorrida (mm) */
  LgeoMm: number;
  /** RESISTENCIA en mm equivalentes de pared nominal (ΔP·h_nom^p/k) — el orden REAL */
  LeqMm: number;
  ruta: Ruta | null;
  /**
   * El camino real DIBUJADO SOBRE EL LAY-FLAT, un tramo por cara.
   * Va partido a propósito: al cruzar un CORTE de esquina, el punto de salida de una
   * pared y el de entrada de la siguiente son EL MISMO punto de la pieza, pero el
   * desdoblado los separó al abrir la cuña. Dibujarlo como una sola polilínea recta
   * (lo que hacía antes) miente: pintaba la diagonal por dentro de la pared en vez del
   * recorrido por el labio. Los pares que hay que volver a coser están en `costuras`.
   */
  camino: Vec2[][];
  /** pares de puntos que el corte separó (mismo punto de la pieza, dos sitios del plano) */
  costuras: Array<[Vec2, Vec2]>;
  /** longitud recorrida dentro de cada cara de la ruta (mm) */
  tramos: number[];
}

const VACIO: Llegada = { LgeoMm: Infinity, LeqMm: Infinity, ruta: null, camino: [], costuras: [], tramos: [] };

/** intersección segmento(p,q) × segmento(a,b) → {t sobre pq, u sobre ab} o null */
function cruzar(p: Vec2, q: Vec2, a: Vec2, b: Vec2): { t: number; u: number } | null {
  const rx = q[0] - p[0], ry = q[1] - p[1];
  const sx = b[0] - a[0], sy = b[1] - a[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;               // paralelos
  const t = ((a[0] - p[0]) * sy - (a[1] - p[1]) * sx) / den;
  const u = ((a[0] - p[0]) * ry - (a[1] - p[1]) * rx) / den;
  return { t, u };
}

/** evalúa UNA ruta en el punto P (marco de la cara destino) */
function evalRuta(lf: LayFlat, r: Ruta, P: Vec2, p: number, hNomP: number): Llegada {
  const S = r.fuente;
  const len = Math.hypot(P[0] - S[0], P[1] - S[1]);
  const TOL = 1e-7;
  const ts: number[] = [];
  const puntos: Vec2[] = [];
  let prev = 0;
  for (const e of r.aristas) {
    const x = cruzar(S, P, e.a, e.b);
    if (!x) return VACIO;
    if (x.u < -TOL || x.u > 1 + TOL) return VACIO;      // se sale de la arista compartida
    if (x.t < -TOL || x.t > 1 + TOL) return VACIO;
    if (x.t < prev - TOL) return VACIO;                 // el orden de cruce no cuadra
    prev = Math.max(prev, x.t);
    ts.push(Math.max(0, Math.min(1, x.t)));
    puntos.push([S[0] + (P[0] - S[0]) * x.t, S[1] + (P[1] - S[1]) * x.t]);
  }
  const bordes = [0, ...ts, 1];
  let costo = 0;
  const tramos: number[] = [];
  for (let i = 0; i < r.caras.length; i++) {
    const sub = len * (bordes[i + 1] - bordes[i]);
    tramos.push(sub);
    costo += sub / Math.pow(lf.caras[r.caras[i]].espesorMm, p);
  }
  // ── el camino EN EL LAY-FLAT, cara por cara ────────────────────────────────
  // OJO: el punto de cruce X_i vive en la arista COMPARTIDA, y esa arista NO es el
  // mismo segmento en los dos marcos (la isometría de esquina solo fija el VÉRTICE).
  // Por eso cada tramo se lleva a SU marco: inv[i] para el que sale, inv[i+1] para el
  // que entra. Donde los dos no coinciden, ahí está el CORTE del lay-flat.
  const camino: Vec2[][] = [];
  const costuras: Array<[Vec2, Vec2]> = [];
  let ini: Vec2 = isoAp(r.inv[0], S);
  for (let i = 0; i < puntos.length; i++) {
    const sale = isoAp(r.inv[i], puntos[i]);
    const entra = isoAp(r.inv[i + 1], puntos[i]);
    camino.push([ini, sale]);
    if (Math.hypot(sale[0] - entra[0], sale[1] - entra[1]) > 1e-9) costuras.push([sale, entra]);
    ini = entra;
  }
  camino.push([ini, P]);
  return { LgeoMm: len, LeqMm: costo * hNomP, ruta: r, camino, costuras, tramos };
}

export interface SolverLayFlat {
  lf: LayFlat;
  gate: CompuertaLayFlat;
  modelo: Modelo;
  p: number;
  rutasPorCara: Ruta[][];
  /** costo (mm-eq) en cada vértice cónico de la base */
  costoVertice: number[];
  /** llegada del fundido a un punto de una cara */
  en(P: Vec2, cara: number): Llegada;
  /** llegada al punto más barato entre las caras que contienen a P */
  enPunto(P: Vec2): Llegada & { cara: number };
  /** solo por rutas que pasan por el fondo (la "línea central" de §5.5.5) */
  enVia(P: Vec2, cara: number, via: 'min' | 'fondo' | 'perimetro'): Llegada;
  caraDe(P: Vec2): number;
}

/**
 * EL SOLVER: mínimo sobre las rutas de desdoblado + los VÉRTICES CÓNICOS.
 *
 * El vértice de la base donde se juntan fondo + 2 paredes suma 90+90+90 = 270° < 360°:
 * es un punto CÓNICO, y por ahí el frente puede "doblar la esquina" sin cruzar ninguna
 * arista dentro de su extensión. Esas zonas de sombra las cubre una fuente secundaria
 * puesta EN el vértice con el costo con el que el fundido llegó ahí (dos pasadas de
 * relajación). Cada candidato corresponde a un camino REAL sobre la superficie, así que
 * el mínimo nunca sale por debajo de la geodésica verdadera.
 */
export function solverLayFlat(lf: LayFlat, gate: CompuertaLayFlat, o?: {
  modelo?: Modelo; meltN?: number; maxCaras?: number;
}): SolverLayFlat {
  const modelo = o?.modelo ?? 'libro-lineal';
  const p = expModelo(modelo, o?.meltN ?? N_ABS_MG47);
  const hNomP = Math.pow(lf.pieza.espesorNomMm, p);
  const todas = rutasDesdoblado(lf, gate, o?.maxCaras ?? 4);
  const rutasPorCara: Ruta[][] = lf.caras.map(() => []);
  for (const r of todas) rutasPorCara[r.caras[r.caras.length - 1]].push(r);

  const carasDeVertice = (v: number): number[] =>
    [0, v + 1, ((v - 1 + lf.m) % lf.m) + 1];

  const costoVertice = new Array(lf.m).fill(Infinity);
  const conos: Array<Array<{ V: Vec2; costo: number; v: number }>> = lf.caras.map(() => []);

  const soloRutas = (P: Vec2, cara: number): Llegada => {
    let best = VACIO;
    for (const r of rutasPorCara[cara]) {
      const l = evalRuta(lf, r, P, p, hNomP);
      if (l.LeqMm < best.LeqMm) best = l;
    }
    return best;
  };
  // dos pasadas: los vértices se alimentan entre sí (una esquina puede alcanzarse
  // doblando por otra)
  for (let pase = 0; pase < 2; pase++) {
    for (let v = 0; v < lf.m; v++) {
      const V = lf.base[v];
      let best = Infinity;
      for (const f of carasDeVertice(v)) {
        const l = soloRutas(V, f);
        if (l.LeqMm < best) best = l.LeqMm;
        for (const c of conos[f]) {
          if (c.v === v) continue;
          const d = Math.hypot(V[0] - c.V[0], V[1] - c.V[1]) / Math.pow(lf.caras[f].espesorMm, p) * hNomP;
          if (c.costo + d < best) best = c.costo + d;
        }
      }
      costoVertice[v] = best;
    }
    for (const c of conos) c.length = 0;
    for (let v = 0; v < lf.m; v++) {
      if (!Number.isFinite(costoVertice[v])) continue;
      for (const f of carasDeVertice(v)) conos[f].push({ V: lf.base[v], costo: costoVertice[v], v });
    }
  }

  const en = (P: Vec2, cara: number): Llegada => {
    let best = soloRutas(P, cara);
    for (const c of conos[cara]) {
      const dist = Math.hypot(P[0] - c.V[0], P[1] - c.V[1]);
      const Leq = c.costo + dist / Math.pow(lf.caras[cara].espesorMm, p) * hNomP;
      if (Leq < best.LeqMm) best = { LgeoMm: dist, LeqMm: Leq, ruta: null, camino: [[c.V, P]], costuras: [], tramos: [dist] };
    }
    return best;
  };
  const caraDe = (P: Vec2): number => {
    for (let f = 0; f < lf.caras.length; f++) if (dentroPoly(P, lf.caras[f].poly, 1e-9)) return f;
    return -1;
  };
  return {
    lf, gate, modelo, p, rutasPorCara, costoVertice, en, caraDe,
    enPunto(P) {
      const f = caraDe(P);
      if (f < 0) return { ...VACIO, cara: -1 };
      return { ...en(P, f), cara: f };
    },
    enVia(P, cara, via) {
      if (via === 'min') return en(P, cara);
      let best = VACIO;
      for (const r of rutasPorCara[cara]) {
        if (via === 'fondo' && !r.porFondo) continue;
        if (via === 'perimetro' && r.porFondo) continue;
        const l = evalRuta(lf, r, P, p, hNomP);
        if (l.LeqMm < best.LeqMm) best = l;
      }
      return best;
    },
  };
}

/**
 * Los phantom gates que el método necesita, listos para dibujar y etiquetar.
 * Un phantom sirve a TODAS las rutas que doblan por las MISMAS esquinas (una bisagra
 * no mueve la fuente), así que se identifican por la lista de esquinas, no por la cara
 * de destino: es el mismo "gate imaginario" del libro para todo ese sector.
 */
export function phantomGates(s: SolverLayFlat): Array<{
  pos: Vec2; esquinas: number[]; nEsquinas: number; caras: string[];
}> {
  const vistos = new Map<string, { pos: Vec2; esquinas: number[]; nEsquinas: number; caras: string[] }>();
  for (const lista of s.rutasPorCara) for (const r of lista) {
    if (!r.fantasma) continue;
    const key = r.esquinas.join('>');
    const cara = s.lf.caras[r.caras[r.caras.length - 1]].id;
    const ya = vistos.get(key);
    if (ya) { if (!ya.caras.includes(cara)) ya.caras.push(cara); continue; }
    vistos.set(key, { pos: r.fuente, esquinas: r.esquinas, nEsquinas: r.esquinas.length, caras: [cara] });
  }
  return [...vistos.values()].sort((a, b) => a.nEsquinas - b.nEsquinas);
}

// ══════════════════════════════════════════════════════════════════════════════
// 3 · EL CAMPO Y LOS ARCOS
// ══════════════════════════════════════════════════════════════════════════════

export interface CampoLayFlat {
  u0: number; v0: number; du: number; nu: number; nv: number;
  /** resistencia en mm-equivalentes (NaN fuera del lay-flat) */
  Leq: Float32Array;
  /** longitud geométrica recorrida (NaN fuera) */
  Lgeo: Float32Array;
  cara: Int16Array;
  /** máximo del campo = EL ÚLTIMO PUNTO EN LLENARSE */
  maxLeqMm: number;
  maxLgeoMm: number;
  maxUV: Vec2;
  maxCara: number;
  /** distancia del último punto al BORDE LIBRE (el labio de la pieza = la partición) */
  maxDistBordeMm: number;
  /** clasificación del cierre: en el borde (venteable) o en el interior (trampa) */
  cierre: 'borde' | 'interior';
  /** celdas donde el campo hace CRESTA = donde se juntan dos frentes (línea de soldadura) */
  soldadura: Uint8Array;
  nSoldadura: number;
}

/**
 * Muestrea el campo de resistencia sobre el lay-flat.
 * `du` por defecto ata la rejilla al tamaño de la pieza (≈450 celdas en la diagonal):
 * EXTENSIÓN DECLARADA — el libro no da resolución porque dibuja a mano.
 */
export function campoLayFlat(s: SolverLayFlat, o?: { duMm?: number; umbralSoldadura?: number }): CampoLayFlat {
  const { bbox } = s.lf;
  const diag = Math.hypot(bbox.u1 - bbox.u0, bbox.v1 - bbox.v0);
  const du = o?.duMm ?? Math.max(0.4, diag / 450);
  const nu = Math.ceil((bbox.u1 - bbox.u0) / du) + 1;
  const nv = Math.ceil((bbox.v1 - bbox.v0) / du) + 1;
  const Leq = new Float32Array(nu * nv).fill(NaN);
  const Lgeo = new Float32Array(nu * nv).fill(NaN);
  const cara = new Int16Array(nu * nv).fill(-1);
  let maxLeq = -Infinity, maxLgeo = 0, maxUV: Vec2 = [bbox.u0, bbox.v0], maxCara = -1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const P: Vec2 = [bbox.u0 + i * du, bbox.v0 + j * du];
    const f = s.caraDe(P);
    const t = j * nu + i;
    if (f < 0) continue;
    const l = s.en(P, f);
    if (!Number.isFinite(l.LeqMm)) continue;
    cara[t] = f; Leq[t] = l.LeqMm; Lgeo[t] = l.LgeoMm;
    if (l.LeqMm > maxLeq) { maxLeq = l.LeqMm; maxLgeo = l.LgeoMm; maxUV = P; maxCara = f; }
  }

  // ── LÍNEA DE SOLDADURA = la CRESTA del campo ────────────────────────────────
  // En un campo de distancia el gradiente vale (h_nom/h)^p en todos lados MENOS donde
  // dos frentes se juntan: ahí el campo hace pico y la diferencia central se desploma.
  // Umbral 0.72 = EXTENSIÓN DECLARADA (el libro no da número: dibuja dónde chocan los
  // arcos). Con 0.72 se marcan choques de más de ~87° entre frentes.
  const umb = o?.umbralSoldadura ?? 0.72;
  const soldadura = new Uint8Array(nu * nv);
  let nSold = 0;
  for (let j = 1; j < nv - 1; j++) for (let i = 1; i < nu - 1; i++) {
    const t = j * nu + i;
    if (cara[t] < 0) continue;
    const E = Leq[t + 1], W = Leq[t - 1], N = Leq[t + nu], S = Leq[t - nu];
    if (!Number.isFinite(E) || !Number.isFinite(W) || !Number.isFinite(N) || !Number.isFinite(S)) continue;
    const gx = (E - W) / (2 * du), gy = (N - S) / (2 * du);
    const esperado = Math.pow(s.lf.pieza.espesorNomMm / s.lf.caras[cara[t]].espesorMm, s.p);
    if (Math.hypot(gx, gy) < umb * esperado) { soldadura[t] = 1; nSold++; }
  }

  // ── ¿el último punto cierra en un BORDE LIBRE o en el INTERIOR? ─────────────
  // El único borde libre del lay-flat es el LABIO de la pieza (z = H): las cuñas del
  // corte NO son borde, son la misma esquina cortada. Un cierre en el labio se ventea
  // en la partición (§8.2.2); uno en el interior es trampa de gas (§5.5.4).
  const dB = distBordeLibre(s.lf, maxUV, maxCara);
  return {
    u0: bbox.u0, v0: bbox.v0, du, nu, nv, Leq, Lgeo, cara,
    maxLeqMm: maxLeq, maxLgeoMm: maxLgeo, maxUV, maxCara,
    maxDistBordeMm: dB,
    cierre: dB <= 2 * du ? 'borde' : 'interior',
    soldadura, nSoldadura: nSold,
  };
}

/** distancia al labio de la pieza (el borde LIBRE del lay-flat) */
export function distBordeLibre(lf: LayFlat, P: Vec2, cara: number): number {
  if (cara <= 0) return Infinity;                        // el fondo no toca el labio
  const k = cara - 1, n = lf.normal[k], A = lf.base[k];
  const z = (P[0] - A[0]) * n[0] + (P[1] - A[1]) * n[1];
  return lf.H - z;
}

/** curvas de nivel (marching squares) — LOS ARCOS del método */
export function arcos(c: CampoLayFlat, nivel: number): Array<[Vec2, Vec2]> {
  const segs: Array<[Vec2, Vec2]> = [];
  const X = (i: number) => c.u0 + i * c.du, Y = (j: number) => c.v0 + j * c.du;
  const lerp = (a: Vec2, b: Vec2, va: number, vb: number): Vec2 => {
    const t = (nivel - va) / (vb - va);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  for (let j = 0; j < c.nv - 1; j++) for (let i = 0; i < c.nu - 1; i++) {
    const t00 = j * c.nu + i, t10 = t00 + 1, t01 = t00 + c.nu, t11 = t01 + 1;
    const v00 = c.Leq[t00], v10 = c.Leq[t10], v11 = c.Leq[t11], v01 = c.Leq[t01];
    if (!Number.isFinite(v00) || !Number.isFinite(v10) || !Number.isFinite(v11) || !Number.isFinite(v01)) continue;
    const p00: Vec2 = [X(i), Y(j)], p10: Vec2 = [X(i + 1), Y(j)], p11: Vec2 = [X(i + 1), Y(j + 1)], p01: Vec2 = [X(i), Y(j + 1)];
    const code = (v00 > nivel ? 1 : 0) | (v10 > nivel ? 2 : 0) | (v11 > nivel ? 4 : 0) | (v01 > nivel ? 8 : 0);
    if (code === 0 || code === 15) continue;
    const A = () => lerp(p00, p10, v00, v10);   // abajo
    const B = () => lerp(p10, p11, v10, v11);   // derecha
    const C = () => lerp(p01, p11, v01, v11);   // arriba
    const D = () => lerp(p00, p01, v00, v01);   // izquierda
    switch (code) {
      case 1: case 14: segs.push([D(), A()]); break;
      case 2: case 13: segs.push([A(), B()]); break;
      case 3: case 12: segs.push([D(), B()]); break;
      case 4: case 11: segs.push([B(), C()]); break;
      case 6: case 9: segs.push([A(), C()]); break;
      case 7: case 8: segs.push([C(), D()]); break;
      case 5: segs.push([D(), A()]); segs.push([B(), C()]); break;
      case 10: segs.push([A(), B()]); segs.push([C(), D()]); break;
    }
  }
  return segs;
}

// ══════════════════════════════════════════════════════════════════════════════
// 4 · LAS COTAS DE V5.4 (Fig 5.18) Y EL VEREDICTO DE RACE-TRACKING (V5.3)
// ══════════════════════════════════════════════════════════════════════════════

export interface CotaFlujo {
  nombre: string;
  cita: string;
  /** punto de destino en el plano del lay-flat */
  destino: Vec2;
  caraDestino: number;
  via: 'min' | 'fondo' | 'perimetro';
  /** cifra LITERAL del libro para cruzar (mm), si la hay */
  libroMm?: number;
}

export interface CotaMedida extends CotaFlujo {
  LgeoMm: number; LeqMm: number; camino: Vec2[][]; costuras: Array<[Vec2, Vec2]>;
  hay: boolean; tramos: number[];
  errVsLibroPct?: number;
}

export function medirCotas(s: SolverLayFlat, cotas: CotaFlujo[]): CotaMedida[] {
  return cotas.map((c) => {
    const l = s.enVia(c.destino, c.caraDestino, c.via);
    const hay = Number.isFinite(l.LeqMm);
    return {
      ...c, hay, LgeoMm: l.LgeoMm, LeqMm: l.LeqMm, camino: l.camino, costuras: l.costuras, tramos: l.tramos,
      errVsLibroPct: hay && c.libroMm != null ? Math.abs(l.LgeoMm - c.libroMm) / c.libroMm * 100 : undefined,
    };
  });
}

export interface VeredictoRace {
  /** longitud (mm-eq) al MISMO destino por el perímetro y por la línea central */
  LperimetroMm: number;
  LcenterlineMm: number;
  destino: Vec2;
  race: boolean;
  /** la cota geométrica del libro: profundidad > ½ · ancho de la pared de la compuerta */
  profMm: number; anchoMm: number; cotaGeom: boolean;
  /** ¿todas las paredes y el fondo tienen el espesor nominal? */
  uniforme: boolean;
  /** ¿coinciden las dos formas de decirlo? Solo tiene sentido si `uniforme`:
   *  la cota H > W/2 es geometría PURA y no sabe de espesores; en cuanto §5.5.5
   *  adelgaza una pared deja de aplicar — corregir por espesor es justamente lo que
   *  hace que la geometría siga diciendo "race" y la física ya no. */
  coherente: boolean;
}

/**
 * V5.3 — RACE-TRACKING. La regla LITERAL de §5.5.4:
 *   "race-tracking… can occur when the length of flow around the perimeter of the
 *    molding is less than the length of flow across the center-line of the part"
 * y la razón que el libro da para SU contenedor:
 *   "race-tracking occurred because the 60 mm depth of the container is more than
 *    one-half the 100 mm width of the container."
 * Las dos se evalúan y se CRUZAN: para una caja las dos son la MISMA desigualdad
 * (W/2 + L + W/2 < H + L + H ⟺ W < 2H ⟺ H > W/2), y que el motor lo reproduzca es
 * el invariante analítico que verifica el gate.
 */
export function veredictoRace(s: SolverLayFlat, destino: Vec2, caraDestino: number): VeredictoRace {
  const per = s.enVia(destino, caraDestino, 'perimetro');
  const cen = s.enVia(destino, caraDestino, 'fondo');
  const k = s.gate.cara - 1;
  const A = s.lf.base[k], B = s.lf.base[(k + 1) % s.lf.m];
  const ancho = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const race = per.LeqMm < cen.LeqMm;
  const cotaGeom = s.lf.H > ancho / 2;
  const hNom = s.lf.pieza.espesorNomMm;
  const uniforme = s.lf.caras.every((c) => Math.abs(c.espesorMm - hNom) < 1e-9);
  return {
    LperimetroMm: per.LeqMm, LcenterlineMm: cen.LeqMm, destino,
    race, profMm: s.lf.H, anchoMm: ancho, cotaGeom, uniforme, coherente: race === cotaGeom,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 5 · EL CONTENEDOR DE FIG 5.15 (el ejemplo canónico del capítulo)
// ══════════════════════════════════════════════════════════════════════════════

/** Cifras LITERALES del libro que esta lámina reproduce (nunca se hardcodean como
 *  resultado: se usan para CRUZAR contra lo que sale del desdoblado). */
export const LIBRO_CONTENEDOR = {
  /** Fig 5.15 "Container for prediction of fill patterns": 100 × 160 × 60 mm */
  anchoMm: 100, largoMm: 160, profMm: 60,
  /** Fig 5.15: "2° draft with 10 mm fillets" */
  draftDeg: 2, filetesMm: 10,
  /** §5.5.5: "a nominal of 2 mm" → pared lateral "1.5 mm" */
  paredNomMm: 2, paredLateralMm: 1.5,
  /** Fig 5.18 "Lay flat showing flow lengths" */
  LcenterlineMm: 280, LsideWallsMm: 210,
  /** V5.5: velocidad en las paredes laterales = 75 % de la de la línea central */
  vLateralFrac: 0.75,
  /** V5.6: el remedio cuesta +10 % de presión de inyección */
  presionExtraPct: 10,
} as const;

/**
 * El contenedor de Fig 5.15. `lateralMm` permite el par del libro:
 * uniforme (Fig 5.17, MALO) vs. paredes laterales de 1.5 mm (Fig 5.19, BUENO).
 */
export function contenedorKazmer(o?: { lateralMm?: number; nombre?: string }): PiezaLayFlat {
  const L = LIBRO_CONTENEDOR;
  const lat = o?.lateralMm ?? L.paredNomMm;
  return {
    nombre: o?.nombre ?? `contenedor Fig 5.15 · ${L.anchoMm}×${L.largoMm}×${L.profMm} mm`,
    base: [[0, 0], [L.anchoMm, 0], [L.anchoMm, L.largoMm], [0, L.largoMm]],
    alturaMm: L.profMm,
    espesorNomMm: L.paredNomMm,
    espesorFondoMm: L.paredNomMm,
    // aristas 1 y 3 son las LARGAS (160 mm) = "the side walls" que §5.5.5 adelgaza
    espesorParedMm: [L.paredNomMm, lat, L.paredNomMm, lat],
    draftDeg: L.draftDeg, filetesMm: L.filetesMm,
  };
}

/**
 * LA COMPUERTA DEL EJEMPLO — INFERENCIA DECLARADA, no cifra literal.
 *
 * El texto que tenemos NO dice dónde está el gate; da tres hechos:
 *   (1) Fig 5.18: L_centerline = 280 mm   (2) Fig 5.18: L_side_walls = 210 mm
 *   (3) §5.5.4: hay race-tracking "because the 60 mm depth… is more than one-half
 *       the 100 mm width".
 * Con la compuerta en el CENTRO DEL LABIO de una pared corta (la de 100 mm) los tres
 * salen exactos y a la vez:
 *   · centerline = 60 (bajar la pared) + 160 (cruzar el fondo) + 60 (subir la opuesta) = 280 ✓
 *   · side walls = 50 (labio hasta la esquina) + 160 (labio de la pared larga)      = 210 ✓
 *     y llega justo a "the far corners of the adjacent side walls" (§5.5.5)          ✓
 *   · al MISMO destino (centro del labio opuesto): perímetro 50+160+50 = 260 < 280
 *     ⟺ W < 2H ⟺ H > W/2 ⟺ 60 > 50, que es TEXTUAL la razón del libro             ✓
 * Tres cifras independientes de una sola hipótesis. Queda DECLARADO en la lámina.
 */
export function compuertaContenedor(lf: LayFlat, paredIdx = 0): CompuertaLayFlat {
  const k = paredIdx, A = lf.base[k], B = lf.base[(k + 1) % lf.m], n = lf.normal[k];
  const uv: Vec2 = [(A[0] + B[0]) / 2 + lf.H * n[0], (A[1] + B[1]) / 2 + lf.H * n[1]];
  return {
    nombre: 'compuerta (centro del labio de la pared corta)',
    cara: k + 1, uv,
    p3: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, lf.H],
    origen: 'INFERIDA de Fig 5.18 (280 y 210 mm) + §5.5.4 (60 > 100/2) — no es cifra literal',
  };
}

/** Las dos cotas de Fig 5.18 sobre una caja de 4 lados con el gate en el labio. */
export function cotasContenedor(lf: LayFlat, gate: CompuertaLayFlat): CotaFlujo[] {
  if (lf.m !== 4 || gate.cara === 0) return [];
  const k = gate.cara - 1;
  const op = (k + 2) % 4;                       // pared opuesta
  const A = lf.base[op], B = lf.base[(op + 1) % 4], n = lf.normal[op];
  const centroLabioOp: Vec2 = [(A[0] + B[0]) / 2 + lf.H * n[0], (A[1] + B[1]) / 2 + lf.H * n[1]];
  // "the far corners of the adjacent side walls": la esquina lejana de la pared k+1
  const lat = (k + 1) % 4;
  const V = lf.base[(lat + 1) % 4], nl = lf.normal[lat];
  const esquinaLejana: Vec2 = [V[0] + lf.H * nl[0], V[1] + lf.H * nl[1]];
  return [
    {
      nombre: 'L_centerline', cita: '§5.5.5 · Fig 5.18', destino: centroLabioOp,
      caraDestino: op + 1, via: 'fondo', libroMm: LIBRO_CONTENEDOR.LcenterlineMm,
    },
    {
      nombre: 'L_side_walls', cita: '§5.5.5 · Fig 5.18', destino: esquinaLejana,
      caraDestino: lat + 1, via: 'perimetro', libroMm: LIBRO_CONTENEDOR.LsideWallsMm,
    },
  ];
}

/**
 * §5.5.5 — el remedio: "the pressure drop across the center-line should equal the
 * pressure drop around the perimeter". Con Eq 5.33 (`flowleaders.ts`, μ igual):
 *      H_lateral = H_nom · L_side/L_center = 2 mm · 210/280 = 1.5 mm   (LITERAL)
 * Se calcula TAMBIÉN la versión con Eq 5.22 (H ∝ L^{1/(1+n)}) y se declara cuál es
 * cuál: el libro usa la lineal, el motor 3D usa la power-law.
 */
export function remedioFlowLeader(hNomMm: number, LsideMm: number, LcenterMm: number, n = N_ABS_MG47) {
  return {
    hLibroMm: +flowLeaderThickness(hNomMm, LsideMm, LcenterMm).toFixed(4),
    vFrac: +flowLeaderVelocityRatio(LsideMm, LcenterMm).toFixed(4),
    hEq522Mm: +(hNomMm * Math.pow(LsideMm / LcenterMm, 1 / (1 + n))).toFixed(4),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 6 · LA LÁMINA
// ══════════════════════════════════════════════════════════════════════════════

const BANDA = ['#2b5f8f', '#2f7ba0', '#33959d', '#3aa47f', '#68a544', '#a8b234', '#d8a52c', '#e8802a', '#e35434', '#d12f3f'];

/** parte un texto en renglones de ≤n caracteres, sin cortar palabras */
function partir(s: string, n: number): string[] {
  const out: string[] = []; let cur = '';
  for (const w of s.split(/\s+/)) {
    if (cur && (cur + ' ' + w).length > n) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Lo que el motor 3D (`flowlen.ts`, vóxeles del hueco A/B) mide sobre LA MISMA pieza.
 * Se cruzan DOS cosas distintas y se dicen por separado:
 *   · `LsideWallsMm` — L a la esquina lejana de la pared lateral, la cota que Fig 5.18
 *     acota en 210 mm. Es el cruce ROBUSTO: el camino corre por pared plana.
 *   · `LmaxMm` — la L máxima del motor. OJO: el motor pesa por RESISTENCIA y su espesor
 *     local (esfera inscrita) lee de MÁS en las uniones a 90°, así que su camino se
 *     desvía por las esquinas y esa L sale INFLADA. Se imprime con su `nota`; NUNCA se
 *     pinta verde.
 */
export interface Motor3D {
  celdaMm: number;
  LsideWallsMm: number;
  LmaxMm?: number;
  volumenCc?: number;
  /** diagnóstico de por qué LmaxMm no cuadra (si no cuadra) */
  nota?: string;
  avisos?: string[];
}

export function laminaLayFlat(s: SolverLayFlat, o?: {
  nombre?: string;
  campo?: CampoLayFlat;
  cotas?: CotaMedida[];
  /** null / ausente ⇒ la lámina dice SIN CABLEAR (jamás verde por omisión) */
  motor3d?: Motor3D | null;
  nArcos?: number;
}): Lamina {
  const lf = s.lf;
  const nombre = o?.nombre ?? lf.pieza.nombre;
  const campo = o?.campo ?? campoLayFlat(s);
  const cotas = o?.cotas ?? medirCotas(s, cotasContenedor(lf, s.gate));
  const nArcos = o?.nArcos ?? 12;
  const W = 1080, H = 760, PAD = 46;
  const PX0 = PAD, PY0 = 112, PW = 660, PH = 566;      // panel del dibujo
  const CX0 = PX0 + PW + 22;                            // columna de números

  // ── encuadre: el lay-flat + los phantom gates que caigan cerca ──────────────
  const fan = phantomGates(s);
  const diag = Math.hypot(lf.bbox.u1 - lf.bbox.u0, lf.bbox.v1 - lf.bbox.v0);
  let e0 = lf.bbox.u0, e1 = lf.bbox.u1, f0 = lf.bbox.v0, f1 = lf.bbox.v1;
  let fuera = 0;
  for (const g of fan) {
    const dx = Math.max(lf.bbox.u0 - g.pos[0], g.pos[0] - lf.bbox.u1, 0);
    const dy = Math.max(lf.bbox.v0 - g.pos[1], g.pos[1] - lf.bbox.v1, 0);
    if (Math.hypot(dx, dy) > 0.14 * diag) { fuera++; continue; }
    e0 = Math.min(e0, g.pos[0] - 6); e1 = Math.max(e1, g.pos[0] + 6);
    f0 = Math.min(f0, g.pos[1] - 6); f1 = Math.max(f1, g.pos[1] + 6);
  }
  // margen: sin él el gate y las etiquetas quedan pegados al filo del panel
  const mrg = 0.035 * Math.max(e1 - e0, f1 - f0);
  e0 -= mrg; e1 += mrg; f0 -= mrg; f1 += mrg;
  // GIRO de encuadre: el lay-flat de un contenedor sale apaisado o vertical según la
  // pieza; el panel es fijo. Se gira 90° cuando así se aprovecha más papel — es una
  // decisión de dibujo, no toca ni un número.
  const girar = ((e1 - e0) - (f1 - f0)) * (PW - PH) < 0;
  const dw = girar ? f1 - f0 : e1 - e0, dh = girar ? e1 - e0 : f1 - f0;
  const k = Math.min(PW / dw, PH / dh);
  const ox = PX0 + (PW - dw * k) / 2, oy = PY0 + (PH - dh * k) / 2;
  // sin giro: +u a la derecha, +v hacia ARRIBA. Con giro: +v a la derecha, +u hacia ABAJO.
  const X = (u: number, v: number) => (girar ? ox + (v - f0) * k : ox + (u - e0) * k);
  const Y = (u: number, v: number) => (girar ? oy + (u - e0) * k : oy + (f1 - v) * k);
  const pt = (p: Vec2) => `${X(p[0], p[1]).toFixed(1)},${Y(p[0], p[1]).toFixed(1)}`;
  const px = (p: Vec2) => X(p[0], p[1]), py = (p: Vec2) => Y(p[0], p[1]);

  // ── caras: fondo y paredes ──────────────────────────────────────────────────
  const hNom = lf.pieza.espesorNomMm;
  const caras = lf.caras.map((c) => {
    const delgada = c.espesorMm < hNom - 1e-9, gruesa = c.espesorMm > hNom + 1e-9;
    const fill = c.tipo === 'fondo' ? '#141c28' : delgada ? '#1c2436' : gruesa ? '#24303f' : '#18212f';
    return `<polygon points="${c.poly.map(pt).join(' ')}" fill="${fill}" stroke="#2c3a50" stroke-width="1"/>`;
  }).join('');

  // labio (borde LIBRE = la partición, donde SÍ se puede ventear) en verde tenue
  const labios = lf.caras.filter((c) => c.tipo === 'pared').map((c) =>
    `<line x1="${px(c.poly[2]).toFixed(1)}" y1="${py(c.poly[2]).toFixed(1)}" x2="${px(c.poly[3]).toFixed(1)}" y2="${py(c.poly[3]).toFixed(1)}" stroke="#59d98c" stroke-width="2.2" opacity="0.6"/>`).join('');
  // bisagras (pliegues) punteadas
  const pliegues = lf.base.map((A, i) => {
    const B = lf.base[(i + 1) % lf.m];
    return `<line x1="${px(A).toFixed(1)}" y1="${py(A).toFixed(1)}" x2="${px(B).toFixed(1)}" y2="${py(B).toFixed(1)}" stroke="#6db3f2" stroke-width="1.2" stroke-dasharray="5 4" opacity="0.75"/>`;
  }).join('');
  // los CORTES de esquina: la cuña que abre el desdoblado
  const cortes = lf.base.map((V, v) => {
    const na = lf.normal[(v - 1 + lf.m) % lf.m], nb = lf.normal[v];
    const a: Vec2 = [V[0] + lf.H * na[0], V[1] + lf.H * na[1]];
    const b: Vec2 = [V[0] + lf.H * nb[0], V[1] + lf.H * nb[1]];
    return `<path d="M ${pt(a)} L ${pt(V)} L ${pt(b)}" fill="none" stroke="#c9a227" stroke-width="1.1" stroke-dasharray="2 3" opacity="0.8"/>`;
  }).join('');

  // ── LOS ARCOS ───────────────────────────────────────────────────────────────
  const dArco = campo.maxLeqMm / nArcos;
  const arcosSVG: string[] = [];
  for (let a = 1; a <= nArcos; a++) {
    const nivel = a * dArco;
    const segs = arcos(campo, nivel);
    if (!segs.length) continue;
    const col = BANDA[Math.min(BANDA.length - 1, Math.floor((a - 1) / nArcos * BANDA.length))];
    const d = segs.map(([p, q]) => `M${pt(p)}L${pt(q)}`).join('');
    arcosSVG.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="${a === nArcos ? 2.2 : 1.4}" opacity="0.95"/>`);
  }

  // ── línea de soldadura (la cresta del campo) ────────────────────────────────
  const sold: string[] = [];
  for (let j = 0; j < campo.nv; j++) for (let i = 0; i < campo.nu; i++) {
    const t = j * campo.nu + i;
    if (!campo.soldadura[t]) continue;
    const q: Vec2 = [campo.u0 + i * campo.du, campo.v0 + j * campo.du];
    sold.push(`<rect x="${(px(q) - 1.4).toFixed(1)}" y="${(py(q) - 1.4).toFixed(1)}" width="2.8" height="2.8" fill="#ff5c5c" opacity="0.75"/>`);
  }

  // ── cotas de flujo (V5.4): el camino real, tramo por tramo ─────────────────
  // Va PARTIDO en los cortes de esquina y las dos orillas se cosen con una grapa fina:
  // así se ve que el recorrido por el labio son 50 + 160 mm y no una diagonal por
  // dentro de la pared. Pintarlo de corrido era mentira geométrica.
  const COLC = ['#ffb347', '#6db3f2'];
  const cotasSVG = cotas.map((c, i) => {
    if (!c.hay || !c.camino.length) return '';
    const col = COLC[i % COLC.length];
    const plano = c.camino.flat();
    // la etiqueta va a media altura del tramo MÁS LARGO: en el tramo corto se salía del
    // panel y se encimaba con la marca del último punto en llenarse
    let iL = 0;
    for (let j = 1; j < c.camino.length; j++) if ((c.tramos[j] ?? 0) > (c.tramos[iL] ?? 0)) iL = j;
    const tr0 = c.camino[iL];
    const mid: Vec2 = [(tr0[0][0] + tr0[1][0]) / 2, (tr0[0][1] + tr0[1][1]) / 2];
    return c.camino.map((tr) => `<polyline points="${tr.map(pt).join(' ')}" fill="none" stroke="${col}" stroke-width="2.6" stroke-dasharray="9 4"/>`).join('')
      + c.costuras.map(([a, b]) => `<line x1="${px(a).toFixed(1)}" y1="${py(a).toFixed(1)}" x2="${px(b).toFixed(1)}" y2="${py(b).toFixed(1)}" stroke="${col}" stroke-width="1" stroke-dasharray="2 3" opacity="0.55"/>`).join('')
      + plano.map((p) => `<circle cx="${px(p).toFixed(1)}" cy="${py(p).toFixed(1)}" r="2.6" fill="${col}"/>`).join('')
      + `<text class="lblSm" style="fill:${col};font:700 11.5px 'JetBrains Mono',monospace" text-anchor="middle" x="${px(mid).toFixed(1)}" y="${(py(mid) - 8).toFixed(1)}">${ESC(c.nombre)} = ${c.LgeoMm.toFixed(0)} mm</text>`;
  }).join('');

  // ── gate real + phantom gates ───────────────────────────────────────────────
  const gx = px(s.gate.uv), gy = py(s.gate.uv);
  const gateSVG = `<circle cx="${gx.toFixed(1)}" cy="${gy.toFixed(1)}" r="7" fill="#c9a227"/>`
    + `<circle cx="${gx.toFixed(1)}" cy="${gy.toFixed(1)}" r="12" fill="none" stroke="#c9a227" stroke-width="1.4"/>`
    + `<text class="cita" x="${(gx + 15).toFixed(1)}" y="${(gy + 4).toFixed(1)}">GATE</text>`;
  const fanSVG = fan.map((g) => {
    const ax = px(g.pos), ay = py(g.pos);
    if (ax < PX0 - 20 || ax > PX0 + PW + 20 || ay < PY0 - 20 || ay > PY0 + PH + 20) return '';
    const izq = ax > PX0 + PW * 0.6;
    return `<circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="6" fill="none" stroke="#c9a227" stroke-width="1.6" stroke-dasharray="3 2.5"/>`
      + `<circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="1.8" fill="#c9a227" opacity="0.8"/>`
      + `<text class="lblSm" style="fill:#c9a227" text-anchor="${izq ? 'end' : 'start'}" x="${(ax + (izq ? -9 : 9)).toFixed(1)}" y="${(ay + 3.5).toFixed(1)}">phantom esq ${g.esquinas.join('+')}</text>`;
  }).join('');

  // ── el último punto en llenarse ─────────────────────────────────────────────
  const mx = px(campo.maxUV), my = py(campo.maxUV);
  const trampa = campo.cierre === 'interior';
  // el rótulo va ARRIBA de la marca y centrado (a un lado se encimaba con la cota de
  // la línea central), y se recorta al panel para que no se salga por el filo
  const anchoTxt = (trampa ? 13 : 30) * 6.6;
  const mtx = Math.max(PX0 + anchoTxt / 2, Math.min(PX0 + PW - anchoTxt / 2, mx));
  const mAnc = `text-anchor="middle" x="${mtx.toFixed(1)}"`;
  const ultimoSVG = trampa
    ? `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="11" fill="none" stroke="#ff5c5c" stroke-width="2.6"/>`
      + `<line x1="${(mx - 6).toFixed(1)}" y1="${(my - 6).toFixed(1)}" x2="${(mx + 6).toFixed(1)}" y2="${(my + 6).toFixed(1)}" stroke="#ff5c5c" stroke-width="2.6"/>`
      + `<line x1="${(mx + 6).toFixed(1)}" y1="${(my - 6).toFixed(1)}" x2="${(mx - 6).toFixed(1)}" y2="${(my + 6).toFixed(1)}" stroke="#ff5c5c" stroke-width="2.6"/>`
      + `<text class="mal" style="font:700 11.5px 'JetBrains Mono',monospace" ${mAnc} y="${(my - 17).toFixed(1)}">TRAMPA DE GAS</text>`
    : `<path d="M ${mx.toFixed(1)} ${(my - 10).toFixed(1)} L ${(mx + 9).toFixed(1)} ${(my + 6).toFixed(1)} L ${(mx - 9).toFixed(1)} ${(my + 6).toFixed(1)} Z" fill="none" stroke="#59d98c" stroke-width="2.4"/>`
      + `<text class="ok" style="font:700 11.5px 'JetBrains Mono',monospace" ${mAnc} y="${(my - 17).toFixed(1)}">CIERRA EN EL LABIO → VENTEABLE</text>`;

  // ── la columna de números ───────────────────────────────────────────────────
  const cot0 = cotas.find((c) => c.nombre === 'L_centerline');
  const cot1 = cotas.find((c) => c.nombre === 'L_side_walls');
  const race = cot0 ? veredictoRace(s, cot0.destino, cot0.caraDestino) : null;
  const rem = cot0 && cot1 && cot0.hay && cot1.hay
    ? remedioFlowLeader(hNom, cot1.LgeoMm, cot0.LgeoMm) : null;

  const L: string[] = [];
  let cy = PY0 + 6;
  const fila = (txt: string, cls = 'lbl', dy = 16, extra = '') => {
    L.push(`<text class="${cls}" ${extra} x="${CX0}" y="${cy}">${ESC(txt)}</text>`); cy += dy;
  };
  const tit = (txt: string) => {
    cy += 6;
    L.push(`<text class="lbl" style="font:700 12px 'JetBrains Mono',monospace;fill:#e9eef5" x="${CX0}" y="${cy}">${ESC(txt)}</text>`);
    cy += 17;
  };

  tit('DESDOBLADO');
  fila(`caras ${lf.caras.length} · cortes ${lf.m} · cuña ${(lf.gap[0] * 180 / Math.PI).toFixed(1)}°`, 'lblSm', 13);
  fila(`área desdoblada ${lf.areaDesdobladaMm2.toFixed(0)} mm² = área 3D (err ${lf.errAreaPct.toExponential(1)} %)`, 'lblSm', 13);
  fila(`espesor: fondo ${lf.caras[0].espesorMm.toFixed(2)} · paredes ${lf.caras.slice(1).map((c) => c.espesorMm.toFixed(2)).join('/')} mm`, 'lblSm', 13);
  for (const t of partir(`compuerta: ${s.gate.origen}`, 47)) fila(t, 'lblSm', 12);

  tit('LONGITUDES DE FLUJO · V5.4 Fig 5.18');
  for (const c of cotas) {
    if (!c.hay) { fila(`${c.nombre}: SIN CABLEAR`, 'warn', 15); continue; }
    const lib = c.libroMm != null ? `  [libro ${c.libroMm}]` : '';
    fila(`${c.nombre} = ${c.LgeoMm.toFixed(1)} mm${lib}`, 'lbl', 15);
    if (c.errVsLibroPct != null) {
      fila(`   err vs libro ${c.errVsLibroPct.toFixed(3)} %`, c.errVsLibroPct < 0.5 ? 'ok' : 'mal', 15);
    }
  }
  if (cot0?.hay && cot1?.hay) {
    fila(`L_eq (resistencia): ${cot0.LeqMm.toFixed(1)} / ${cot1.LeqMm.toFixed(1)} mm-eq`, 'lblSm', 15);
  }

  tit('RACE-TRACKING · V5.3 §5.5.4');
  if (!race) fila('SIN CABLEAR (no hay cota de línea central)', 'warn', 15);
  else {
    fila(`al MISMO destino (centro del labio opuesto):`, 'lblSm', 14);
    fila(`  perímetro  ${race.LperimetroMm.toFixed(1)} mm-eq`, 'lbl', 15);
    fila(`  centerline ${race.LcenterlineMm.toFixed(1)} mm-eq`, 'lbl', 15);
    fila(race.race ? '⇒ RACE-TRACKING (perímetro < centerline)' : '⇒ SIN race-tracking (perímetro ≥ centerline)',
      race.race ? 'mal' : 'ok', 16, `style="font:700 12px 'JetBrains Mono',monospace"`);
    fila(`cota geométrica: H ${race.profMm} ${race.cotaGeom ? '>' : '≤'} W/2 ${(race.anchoMm / 2).toFixed(0)} mm`,
      race.uniforme && race.cotaGeom ? 'mal' : race.uniforme ? 'ok' : 'lblSm', 14);
    if (race.uniforme) {
      fila(`las dos formas ${race.coherente ? 'COINCIDEN' : 'SE CONTRADICEN'}`, race.coherente ? 'lblSm' : 'mal', 15);
    } else {
      // la cota H>W/2 es geometría pura: no sabe de espesores. Marcarla en rojo aquí
      // sería mentir — §5.5.5 corrige por ESPESOR, no moviendo la caja.
      for (const t of partir('la cota geométrica NO APLICA con espesor variable: §5.5.5 corrige por pared, no por forma', 47)) fila(t, 'lblSm', 12);
      cy += 3;
    }
  }

  tit('ÚLTIMO EN LLENARSE');
  fila(`${lf.caras[campo.maxCara]?.id ?? '—'} · ${campo.maxDistBordeMm.toFixed(1)} mm bajo el labio`, 'lblSm', 14);
  fila(`L_eq ${campo.maxLeqMm.toFixed(1)} mm-eq · L_geo ${campo.maxLgeoMm.toFixed(1)} mm`, 'lbl', 15);
  fila(trampa ? '⇒ TRAMPA DE GAS (cierra en el INTERIOR)' : '⇒ cierra en el LABIO → venteable §8.2.2',
    trampa ? 'mal' : 'ok', 16, `style="font:700 12px 'JetBrains Mono',monospace"`);

  tit('REMEDIO §5.5.5 · flow leaders');
  if (rem) {
    fila(`h_lat = ${hNom} × ${cot1!.LgeoMm.toFixed(0)}/${cot0!.LgeoMm.toFixed(0)} = ${rem.hLibroMm.toFixed(2)} mm  [libro ${LIBRO_CONTENEDOR.paredLateralMm}]`, 'lbl', 15);
    fila(`v_lateral = ${(rem.vFrac * 100).toFixed(0)} % de v_centerline  [libro ${(LIBRO_CONTENEDOR.vLateralFrac * 100).toFixed(0)} %]`, 'lblSm', 14);
    fila(`Eq 5.22 (n=${N_ABS_MG47}) daría ${rem.hEq522Mm.toFixed(2)} mm — EXTENSIÓN`, 'lblSm', 15);
  } else fila('SIN CABLEAR (faltan las dos cotas)', 'warn', 15);

  tit('CRUCE CON EL MOTOR 3D · flowlen.ts');
  const m3 = o?.motor3d;
  if (m3 && cot1?.hay) {
    const d = Math.abs(m3.LsideWallsMm - cot1.LgeoMm) / cot1.LgeoMm * 100;
    fila(`L_side_walls vóxel ${m3.LsideWallsMm.toFixed(1)} mm (celda ${m3.celdaMm})`, 'lbl', 15);
    fila(`lay-flat ${cot1.LgeoMm.toFixed(1)} mm → Δ ${d.toFixed(2)} %`, d < 1.5 ? 'ok' : 'mal', 15);
    if (m3.LmaxMm != null) fila(`L_max vóxel ${m3.LmaxMm.toFixed(0)} mm vs lay-flat ${campo.maxLgeoMm.toFixed(0)} mm`, 'warn', 14);
    if (m3.nota) for (const t of partir(m3.nota, 46)) fila(`  ${t}`, 'lblSm', 12);
  } else if (m3) {
    fila('SIN CABLEAR — hay motor 3D pero falta la cota que cruzar', 'warn', 15);
  } else {
    fila('SIN CABLEAR — no se corrió el motor 3D', 'warn', 15);
  }

  const modeloTxt = s.modelo === 'libro-lineal'
    ? 'v ∝ H (Eq 5.32/5.33, con el que el libro saca 1.5 mm)'
    : `v ∝ H^(1+n) con n=${N_ABS_MG47} (Eq 5.22, el del motor 3D)`;
  const rFil = lf.pieza.filetesMm ?? 0;
  // el pie se ARMA y se parte solo: si se escribe a mano, la línea se sale del papel
  const pieTxt = [
    '— — pliegue (cruzarlo recto YA es el camino real)',
    '· · · corte de esquina (ahí hace falta el phantom gate)',
    'labio verde = borde libre, venteable en la partición',
    'EXTENSIONES DECLARADAS: sin refracción del camino al cambiar de espesor',
    rFil ? `esquinas VIVAS (los filetes de ${rFil} mm acortarían ${(2 * (2 * rFil - Math.PI * rFil / 2)).toFixed(1)} mm la línea central; el libro tampoco los descuenta)` : 'esquinas VIVAS, como en el libro',
    lf.pieza.draftDeg ? `draft ${lf.pieza.draftDeg}° (+${(lf.H / Math.cos(lf.pieza.draftDeg * Math.PI / 180) - lf.H).toFixed(2)} mm de pared) no se aplica` : '',
    'soldadura = cresta a 0.72·|∇| (el libro no da número)',
    `rejilla ${campo.du.toFixed(2)} mm`,
    lf.avisos.length ? '⚠ ' + lf.avisos.join(' · ') : 'base convexa ✓',
    `${fan.length} phantom gates (${fuera} fuera del encuadre)`,
    girar ? 'encuadre girado 90°' : 'encuadre sin girar',
  ].filter(Boolean).join(' · ');
  const pie = partir(pieTxt, 152).slice(0, 4)
    .map((t, i) => `<text class="lblSm" x="${PAD}" y="${H - 51 + i * 15}">${ESC(t)}</text>`).join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS}</style><rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PAD}" y="32">LAY-FLAT CON ARCOS Y PHANTOM GATES · el método a mano</text>
<text class="sub" style="font:700 13.5px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PAD}" y="52">${ESC(nombre)}</text>
<text class="cita" x="${PAD}" y="70">§5.5.4 Fig 5.15-5.17 (cortar esquinas, abatir paredes, arcos) · §5.5.5 Fig 5.18-5.19 (longitudes y flow leaders)</text>
<text class="lblSm" x="${PAD}" y="85">arcos a paso CONSTANTE de ${dArco.toFixed(1)} mm-eq — "the distance between arc is equal to the linear melt velocity times the time step"</text>
<text class="lblSm" x="${PAD}" y="97">el arco es de iso-RESISTENCIA, no de iso-distancia: ${ESC(modeloTxt)}</text>
<rect x="${PX0 - 6}" y="${PY0 - 6}" width="${PW + 12}" height="${PH + 12}" fill="#0d131c" stroke="#1c2634"/>
<clipPath id="panel"><rect x="${PX0 - 6}" y="${PY0 - 6}" width="${PW + 12}" height="${PH + 12}"/></clipPath>
<g clip-path="url(#panel)">
${caras}${pliegues}${cortes}${labios}
${arcosSVG.join('')}
${sold.join('')}
${cotasSVG}
${ultimoSVG}
${fanSVG}${gateSVG}
</g>
${L.join('\n')}
${pie}
</svg>`;

  return {
    id: 'layflat',
    titulo: `Lay-flat con arcos y phantom gates — ${nombre}`,
    cita: '§5.5.4 · Fig 5.15-5.17 · §5.5.5 · Fig 5.18-5.19',
    queMirar: '¿EL PERÍMETRO ES MÁS CORTO QUE LA LÍNEA CENTRAL? Eso es race-tracking y se ve de un vistazo: los arcos llegan a las esquinas lejanas de las paredes largas antes que al centro de la pared opuesta. Y ¿dónde CIERRA el último arco? En el labio = venteable; en medio de una pared = trampa de gas (§5.5.4: "difficult to vent… the trapped air will likely combust").',
    svg,
  };
}
