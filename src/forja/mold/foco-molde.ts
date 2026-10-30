/**
 * EL FOCO DEL MOLDE · LOS HALLAZGOS — el molde se escanea como Aloy escanea una máquina.
 * ============================================================================
 * ian (2026-10-06): «TENEMOS EL FOCO, MEJÓRALO PARA QUE TE AYUDE A IDENTIFICAR ERRORES».
 *
 * La revisión cruzada (2026-09-28) encontró tres defectos REALES que el inspector APROBABA, y los encontraron
 * agentes leyendo números, no el ojo. Las dos causas, medidas:
 *   1. el inspector medía contra el ROL entero (la caja de los 4 retornos juntos → «30.00» y «6.34» falsos);
 *   2. medía con la malla (penetración 1.16 mm) lo que la geometría exacta dice que es un cruce de 3.86 mm.
 *
 * Por eso este módulo:
 *   · parte cada rol en sus CUERPOS (componentes conexos de la malla) — un retorno es un retorno;
 *   · a todo cuerpo que es un cilindro alineado (agua, pines, retornos, guías, tornillos, interlocks, pilares)
 *     lo mide ANALÍTICAMENTE: distancia eje↔eje entre segmentos, menos los dos radios = acero que queda;
 *   · a la punta de cada pin la mide por RAYO contra el núcleo: si la punta queda dentro del acero, la piel
 *     que la cubre es un error (la broca se quedó corta);
 *   · cada hallazgo trae LUGAR 3D, el número, el límite, la regla y una frase en lenguaje natural.
 * Es UNA verdad: la escena dibuja estos hallazgos y el inspector los lee — la cota dibujada y el veredicto
 * salen del mismo número (fin de las tarjetas que se contradecían).
 *
 * Puro: sin React, sin three. Entra la lista de piezas del molde (posiciones + índices), sale la lista.
 */

export interface PiezaMolde {
  role: string;
  name?: string;
  positions: ArrayLike<number>;
  indices?: ArrayLike<number> | null;
}

export type Severidad = 'falla' | 'aviso';
export type TipoHallazgo = 'agua-atraviesa' | 'agua-sin-acero' | 'agua-justa' | 'piel-sobre-punta';

export interface Hallazgo {
  id: string;
  tipo: TipoHallazgo;
  sev: Severidad;
  /** el título corto, como la ficha de una máquina en Horizon */
  titulo: string;
  /** qué pasa físicamente, con el número de hoy contra el límite */
  frase: string;
  /** dónde: el punto 3D (marco del molde, mm) */
  lugar: [number, number, number];
  /** los dos extremos de la cota que lo mide (marco del molde) */
  cota: [[number, number, number], [number, number, number]];
  medido: number;
  limite: number;
  unidad: 'mm';
  regla: string;
  a: { role: string; cuerpo: number; nombre: string };
  b: { role: string; cuerpo: number; nombre: string };
  /** el MISMO problema en varios lugares (los 4 retornos, los 8 pines): una ficha, una marca por lugar.
   *  Siempre trae al menos uno (el propio). Los roles de cada lugar sirven para resaltarlos todos. */
  lugares: Array<{ lugar: [number, number, number]; cota: [[number, number, number], [number, number, number]]; nombre: string; roles: [string, string] }>;
}

export interface Cilindro {
  role: string; cuerpo: number; nombre: string;
  /** extremos del eje */
  p0: [number, number, number]; p1: [number, number, number];
  r: number;
  eje: 0 | 1 | 2;
}

type V3 = [number, number, number];

/* ─────────────────────────── cuerpos ─────────────────────────── */

/** Componentes conexos de una malla. Los vértices pueden venir duplicados por cara (sin soldar):
 *  se unen por índice Y por posición cuantizada a 1 µm. Devuelve, por cuerpo, su caja. */
export function cuerposDe(p: PiezaMolde): Array<{ min: V3; max: V3; tris: number[] }> {
  const P = p.positions; const n = Math.floor(P.length / 3);
  if (!n) return [];
  const idx = p.indices && p.indices.length ? p.indices : Array.from({ length: n }, (_, i) => i);
  const parent = new Int32Array(n); for (let i = 0; i < n; i++) parent[i] = i;
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const unite = (a: number, b: number) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  const llave = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(P[i * 3] * 1000)},${Math.round(P[i * 3 + 1] * 1000)},${Math.round(P[i * 3 + 2] * 1000)}`;
    const j = llave.get(k); if (j === undefined) llave.set(k, i); else unite(i, j);
  }
  for (let t = 0; t + 2 < idx.length; t += 3) { unite(idx[t], idx[t + 1]); unite(idx[t], idx[t + 2]); }
  const grupos = new Map<number, { min: V3; max: V3; tris: number[] }>();
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const r = find(idx[t]);
    let g = grupos.get(r);
    if (!g) { g = { min: [1e18, 1e18, 1e18], max: [-1e18, -1e18, -1e18], tris: [] }; grupos.set(r, g); }
    g.tris.push(t);
    for (let c = 0; c < 3; c++) { const v = idx[t + c]; for (let k = 0; k < 3; k++) { const x = P[v * 3 + k]; if (x < g.min[k]) g.min[k] = x; if (x > g.max[k]) g.max[k] = x; } }
  }
  // orden estable: por x, luego y — «retorno 1» es siempre el mismo
  return [...grupos.values()].sort((a, b) => (a.min[0] - b.min[0]) || (a.min[1] - b.min[1]) || (a.min[2] - b.min[2]));
}

/** Los pedazos de malla de UNA pieza física (la cabeza y el vástago de un retorno vienen como cascarones
 *  separados): se agrupan los que se tocan. Devuelve, por cuerpo, el número de su pieza física (0..n−1),
 *  ordenado por x y luego y — así «el retorno 3» es el mismo en la escena, en la ficha y en el inspector. */
export function piezasFisicas(cs: Array<{ min: V3; max: V3 }>, tol = 0.05): number[] {
  const n = cs.length, par = cs.map((_, i) => i);
  const f = (x: number): number => (par[x] === x ? x : (par[x] = f(par[x])));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = cs[i], b = cs[j];
    let toca = true;
    for (let k = 0; k < 3; k++) if (a.min[k] > b.max[k] + tol || b.min[k] > a.max[k] + tol) { toca = false; break; }
    if (toca) par[f(i)] = f(j);
  }
  const raices = [...new Set(cs.map((_, i) => f(i)))];
  const caja = (r: number) => { const m: V3 = [1e18, 1e18, 1e18]; cs.forEach((c, i) => { if (f(i) === r) for (let k = 0; k < 3; k++) m[k] = Math.min(m[k], c.min[k]); }); return m; };
  const orden = raices.map((r) => ({ r, m: caja(r) })).sort((a, b) => (a.m[0] - b.m[0]) || (a.m[1] - b.m[1]));
  const num = new Map(orden.map((o, i) => [o.r, i]));
  return cs.map((_, i) => num.get(f(i))!);
}

/** Un cuerpo es un CILINDRO ALINEADO si dos lados de su caja son iguales (±6 %) y el tercero es el eje.
 *  Todo lo que barrena el molde lo es: agua, pines, retornos, guías, tornillos, interlocks, pilares. */
export function cilindroDeCaja(min: V3, max: V3): { eje: 0 | 1 | 2; r: number; p0: V3; p1: V3 } | null {
  const L = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  for (const e of [0, 1, 2] as const) {
    const [i, j] = [0, 1, 2].filter((k) => k !== e);
    const d = (L[i] + L[j]) / 2;
    if (d <= 0) continue;
    if (Math.abs(L[i] - L[j]) / d > 0.06) continue;
    if (L[e] < 0.5 * d) continue;                       // una moneda no es un barreno
    const c: V3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const p0 = c.slice() as V3, p1 = c.slice() as V3; p0[e] = min[e]; p1[e] = max[e];
    return { eje: e, r: d / 2, p0, p1 };
  }
  return null;
}

/* ─────────────────────────── geometría exacta ─────────────────────────── */

/** puntos más cercanos entre dos segmentos (Ericson, Real-Time Collision Detection §5.1.9) */
export function segSeg(p1: V3, q1: V3, p2: V3, q2: V3): { d: number; c1: V3; c2: V3 } {
  const d1 = [q1[0] - p1[0], q1[1] - p1[1], q1[2] - p1[2]], d2 = [q2[0] - p2[0], q2[1] - p2[1], q2[2] - p2[2]];
  const r = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  const cl = (x: number) => Math.max(0, Math.min(1, x));
  let s: number, t: number;
  if (a <= 1e-12 && e <= 1e-12) { s = t = 0; }
  else if (a <= 1e-12) { s = 0; t = cl(f / e); }
  else {
    const c = dot(d1, r);
    if (e <= 1e-12) { t = 0; s = cl(-c / a); }
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-12 ? cl((b * f - c * e) / den) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = cl(-c / a); } else if (t > 1) { t = 1; s = cl((b - c) / a); }
    }
  }
  const c1: V3 = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s];
  const c2: V3 = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t];
  return { d: Math.hypot(c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2]), c1, c2 };
}

/** Möller–Trumbore: distancia a lo largo del rayo, o null */
function rayoTri(o: V3, dir: V3, a: V3, b: V3, c: V3): number | null {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const p = [dir[1] * e2[2] - dir[2] * e2[1], dir[2] * e2[0] - dir[0] * e2[2], dir[0] * e2[1] - dir[1] * e2[0]];
  const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det, s = [o[0] - a[0], o[1] - a[1], o[2] - a[2]];
  const u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * inv; if (u < 0 || u > 1) return null;
  const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
  const v = (dir[0] * q[0] + dir[1] * q[1] + dir[2] * q[2]) * inv; if (v < 0 || u + v > 1) return null;
  const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
  return t > 1e-6 ? t : null;
}

/** todos los cruces de un rayo VERTICAL (sentido +z o −z) que sale de o con la malla de una pieza, ordenados */
export function crucesVerticales(p: PiezaMolde, o: V3, sentido: 1 | -1 = 1): number[] {
  const P = p.positions; const n = Math.floor(P.length / 3);
  const idx = p.indices && p.indices.length ? p.indices : Array.from({ length: n }, (_, i) => i);
  const out: number[] = []; const dir: V3 = [0, 0, sentido];
  const v = (i: number): V3 => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a = v(idx[t]), b = v(idx[t + 1]), c = v(idx[t + 2]);
    // descarte rápido: el rayo vertical solo toca triángulos cuya huella en XY contiene al origen
    if (Math.max(a[0], b[0], c[0]) < o[0] || Math.min(a[0], b[0], c[0]) > o[0]) continue;
    if (Math.max(a[1], b[1], c[1]) < o[1] || Math.min(a[1], b[1], c[1]) > o[1]) continue;
    if (sentido > 0 ? Math.max(a[2], b[2], c[2]) < o[2] : Math.min(a[2], b[2], c[2]) > o[2]) continue;
    const d = rayoTri(o, dir, a, b, c); if (d != null) out.push(d);
  }
  out.sort((x, y) => x - y);
  // dos triángulos que comparten arista dan el mismo cruce dos veces: se funden a 1 µm
  return out.filter((d, i) => i === 0 || d - out[i - 1] > 1e-3);
}

/* ─────────────────── el agua contra una malla (orden H) ─────────────────── */

type Tri = { a: V3; b: V3; c: V3; min: V3; max: V3 };
function triangulosDe(p: PiezaMolde): Tri[] {
  const P = p.positions; const n = Math.floor(P.length / 3);
  const idx = p.indices && p.indices.length ? p.indices : Array.from({ length: n }, (_, i) => i);
  const out: Tri[] = [];
  const v = (i: number): V3 => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a = v(idx[t]), b = v(idx[t + 1]), c = v(idx[t + 2]);
    out.push({ a, b, c, min: [Math.min(a[0], b[0], c[0]), Math.min(a[1], b[1], c[1]), Math.min(a[2], b[2], c[2])], max: [Math.max(a[0], b[0], c[0]), Math.max(a[1], b[1], c[1]), Math.max(a[2], b[2], c[2])] });
  }
  return out;
}
/** punto más cercano de un triángulo a un punto (Ericson §5.1.5) */
function ptTri(p: V3, a: V3, b: V3, c: V3): V3 {
  const sub = (x: V3, y: V3): V3 => [x[0] - y[0], x[1] - y[1], x[2] - y[2]];
  const dot = (x: V3, y: V3) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap); if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]]; }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp); if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]]; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return [b[0] + w * (c[0] - b[0]), b[1] + w * (c[1] - b[1]), b[2] + w * (c[2] - b[2])]; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w];
}
/** distancia EXACTA segmento ↔ triángulo (0 si se cruzan): la cota baja de la cápsula */
function segTri(p0: V3, p1: V3, t: Tri): number {
  const dir: V3 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]; const L = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const u: V3 = [dir[0] / L, dir[1] / L, dir[2] / L];
  const h = rayoTri(p0, u, t.a, t.b, t.c); if (h != null && h <= L) return 0;
  const dP = (q: V3) => { const c = ptTri(q, t.a, t.b, t.c); return Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]); };
  return Math.min(dP(p0), dP(p1), segSeg(p0, p1, t.a, t.b).d, segSeg(p0, p1, t.b, t.c).d, segSeg(p0, p1, t.c, t.a).d);
}
/** distancia de un punto al cilindro SÓLIDO finito (eje p0→p1, radio r, extremos planos) y su punto más cercano */
function aCilindro(q: V3, w: Cilindro): { d: number; c: V3 } {
  const ax: V3 = [w.p1[0] - w.p0[0], w.p1[1] - w.p0[1], w.p1[2] - w.p0[2]]; const L = Math.hypot(ax[0], ax[1], ax[2]) || 1;
  const u: V3 = [ax[0] / L, ax[1] / L, ax[2] / L];
  const v: V3 = [q[0] - w.p0[0], q[1] - w.p0[1], q[2] - w.p0[2]];
  const t = v[0] * u[0] + v[1] * u[1] + v[2] * u[2];
  const rad: V3 = [v[0] - t * u[0], v[1] - t * u[1], v[2] - t * u[2]]; const rho = Math.hypot(rad[0], rad[1], rad[2]);
  const tc = Math.max(0, Math.min(L, t)), rc = Math.min(rho, w.r);
  const k = rho > 1e-12 ? rc / rho : 0;
  const c: V3 = [w.p0[0] + u[0] * tc + rad[0] * k, w.p0[1] + u[1] * tc + rad[1] * k, w.p0[2] + u[2] * tc + rad[2] * k];
  return { d: Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]), c };
}
/** el acero entre un cilindro de agua y una malla: mín sobre los triángulos de la distancia al cilindro finito */
export function aceroCilindroMalla(w: Cilindro, tris: Tri[]): { acero: number; c1: V3; c2: V3 } | null {
  const lo: V3 = [Math.min(w.p0[0], w.p1[0]), Math.min(w.p0[1], w.p1[1]), Math.min(w.p0[2], w.p1[2])];
  const hi: V3 = [Math.max(w.p0[0], w.p1[0]), Math.max(w.p0[1], w.p1[1]), Math.max(w.p0[2], w.p1[2])];
  const M = w.r + 25;   // sólo interesa lo cercano: más allá de 25 mm de acero el par no decide nada
  const cand: Array<{ t: Tri; lb: number }> = [];
  for (const t of tris) {
    if (t.max[0] < lo[0] - M || t.min[0] > hi[0] + M || t.max[1] < lo[1] - M || t.min[1] > hi[1] + M || t.max[2] < lo[2] - M || t.min[2] > hi[2] + M) continue;
    cand.push({ t, lb: Math.max(0, segTri(w.p0, w.p1, t) - w.r) });
  }
  if (!cand.length) return null;
  cand.sort((x, y) => x.lb - y.lb);
  let mejor: { acero: number; c1: V3; c2: V3 } | null = null;
  const PHI = (Math.sqrt(5) - 1) / 2;
  const aurea = (f: (x: number) => number, a: number, b: number, n = 36): { x: number; v: number } => {
    let x1 = b - PHI * (b - a), x2 = a + PHI * (b - a), f1 = f(x1), f2 = f(x2);
    for (let i = 0; i < n; i++) { if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = b - PHI * (b - a); f1 = f(x1); } else { a = x1; x1 = x2; f1 = f2; x2 = a + PHI * (b - a); f2 = f(x2); } }
    const x = (a + b) / 2; return { x, v: f(x) };
  };
  for (const { t, lb } of cand) {
    if (mejor && lb >= mejor.acero) break;   // la cápsula es cota BAJA del cilindro: ningún triángulo que sigue puede ganar
    const e1: V3 = [t.b[0] - t.a[0], t.b[1] - t.a[1], t.b[2] - t.a[2]], e2: V3 = [t.c[0] - t.a[0], t.c[1] - t.a[1], t.c[2] - t.a[2]];
    const pt = (s: number, r: number): V3 => [t.a[0] + s * e1[0] + r * e2[0], t.a[1] + s * e1[1] + r * e2[1], t.a[2] + s * e1[2] + r * e2[2]];
    const interior = (s: number) => aurea((r) => aCilindro(pt(s, r), w).d, 0, 1 - s, 30);
    const ext = aurea((s) => interior(s).v, 0, 1, 30);
    const r = interior(ext.x).x, q = pt(ext.x, r), cc = aCilindro(q, w);
    if (!mejor || cc.d < mejor.acero) mejor = { acero: cc.d, c1: cc.c, c2: q };
  }
  return mejor;
}

/* ─────────────────────────── el escaneo ─────────────────────────── */

const ES_AGUA = (r: string) => /^agua-(A|B)-(linea|norte|sur|este|oeste|ext|cruce)/.test(r);
/** el baffle del macho (E6): un barreno de agua vertical que sube DENTRO del macho hacia la pieza (orden H: contra la cavidad) */
const ES_BAFFLE = (r: string) => /^agua-B-baffle$/.test(r);
/** lo que el agua NUNCA puede tocar: todo barreno que lleva otra cosa adentro */
const VECINOS_DEL_AGUA: Array<{ re: RegExp; nombre: (k: number, p: PiezaMolde) => string }> = [
  { re: /^pin-punta-\d+$/, nombre: (_k, p) => `la punta de ${idPin(p)}` },
  { re: /^pin-cuerpo-\d+$/, nombre: (_k, p) => `el cuerpo de ${idPin(p)}` },
  { re: /^pines-retorno$/, nombre: (k) => `el retorno ${k + 1}` },
  { re: /^guias$/, nombre: (k) => `la guía ${k + 1}` },
  { re: /^bujes$/, nombre: (k) => `el buje ${k + 1}` },
  { re: /^interlocks$/, nombre: (k) => `el interlock ${k + 1}` },
  { re: /^tornillos-(cav|core)$/, nombre: (k) => `el tornillo ${k + 1}` },
  { re: /^pilares-soporte$/, nombre: (k) => `el pilar ${k + 1}` },
];
function idPin(p: PiezaMolde): string {
  const m = (p.name ?? '').match(/([A-Z0-9-]+-EP-\d+)/);
  return m ? m[1] : p.role.replace(/^pin-(punta|cuerpo)-/, 'pin ');
}
const nombreAgua = (r: string) => 'la línea de agua ' + r.replace(/^agua-/, '');

export interface OpcionesFoco {
  /** acero mínimo entre el agua y cualquier barreno, como fracción del ⌀ del agua (la regla del juez del agua: ½·D) */
  fraccionAcero?: number;
  /** margen bajo el cual un «cumple» se vuelve AVISO (mm sobre el límite) */
  avisoMm?: number;
  /** piel de acero sobre una punta que ya cuenta (mm) — por debajo es ruido de malla */
  pielMinMm?: number;
}

export interface ParJusto {
  acero: number; limite: number; rA: number; rB: number;
  c1: [number, number, number]; c2: [number, number, number]; lugar: [number, number, number];
  roleA: string; roleB: string; nombreA: string; nombreB: string; ejeAgua: 0 | 1 | 2;
}
export interface ResultadoFoco {
  hallazgos: Hallazgo[];
  /** el par con MENOS acero contra su límite de todo el molde, aunque cumpla (el punto 3 de la inspección): agua↔barreno
   *  o, desde la orden H, agua↔cavidad (la cara de tu pieza) — gana el de menor margen sobre su ½·⌀ */
  masJusto: ParJusto | null;
  /** EL AGUA CONTRA LA CAVIDAD (orden H · un veredicto): §9.2.7 pide ½·⌀ «between the surface of the cooling line and the
   *  surface of ANY other mold component» y la cara que forma tu pieza es la de la cavidad. Antes el Foco no la medía (Kazmer,
   *  revisión de la película: «quizá el agua contra el plástico, que el Foco no revisó»). `pares` = líneas medidas contra ella. */
  cavidad: { pares: number; masJusto: ParJusto | null };
  /** lo que el escaneo identificó (para las etiquetas de máquina y para auditar la cobertura) */
  cilindros: Cilindro[];
  pares: number;
  ms: number;
}

/** EL ESCANEO: recorre el molde y devuelve los hallazgos, peores primero. */
export function escanearMolde(piezas: PiezaMolde[], o: OpcionesFoco = {}): ResultadoFoco {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const frac = o.fraccionAcero ?? 0.5, aviso = o.avisoMm ?? 0.5, pielMin = o.pielMinMm ?? 0.05;
  const hallazgos: Crudo[] = []; const cilindros: Cilindro[] = [];   // (los `lugares` los llena `agrupar`)

  // 1 · el agua y sus vecinos, como cilindros exactos
  const agua: Cilindro[] = [], vecinos: Cilindro[] = [];
  for (const p of piezas) {
    const esAgua = ES_AGUA(p.role);
    const v = VECINOS_DEL_AGUA.find((x) => x.re.test(p.role));
    if (!esAgua && !v) continue;
    const cs = cuerposDe(p), fis = piezasFisicas(cs);
    cs.forEach((c, k) => {
      const cil = cilindroDeCaja(c.min, c.max);
      if (!cil) return;
      const C: Cilindro = { role: p.role, cuerpo: fis[k], nombre: esAgua ? nombreAgua(p.role) : v!.nombre(fis[k], p), ...cil };
      cilindros.push(C); (esAgua ? agua : vecinos).push(C);
    });
  }
  let pares = 0; let masJusto: ParJusto | null = null;
  for (const w of agua) for (const m of vecinos) {
    pares++;
    const s = segSeg(w.p0, w.p1, m.p0, m.p1);
    const acero = s.d - w.r - m.r;
    const lim = frac * 2 * w.r;
    if (!masJusto || acero - lim < masJusto.acero - masJusto.limite) masJusto = {
      acero: +acero.toFixed(2), limite: +lim.toFixed(2), rA: w.r, rB: m.r, c1: s.c1, c2: s.c2,
      lugar: [(s.c1[0] + s.c2[0]) / 2, (s.c1[1] + s.c2[1]) / 2, (s.c1[2] + s.c2[2]) / 2],
      roleA: w.role, roleB: m.role, nombreA: w.nombre, nombreB: m.nombre, ejeAgua: w.eje };
    if (acero >= lim + aviso) continue;
    const lugar: V3 = [(s.c1[0] + s.c2[0]) / 2, (s.c1[1] + s.c2[1]) / 2, (s.c1[2] + s.c2[2]) / 2];
    const f = (x: number) => x.toFixed(2);
    const base = { lugar, cota: [s.c1, s.c2] as [V3, V3], limite: +lim.toFixed(2), unidad: 'mm' as const,
      regla: `la regla del agua: ≥ ½·⌀ de acero (${f(lim)} mm) entre el agua y cualquier barreno`,
      a: { role: w.role, cuerpo: w.cuerpo, nombre: w.nombre }, b: { role: m.role, cuerpo: m.cuerpo, nombre: m.nombre } };
    if (acero < 0) {
      hallazgos.push({ ...base, id: `agua×${w.role}×${m.role}#${m.cuerpo}`, tipo: 'agua-atraviesa', sev: 'falla', medido: +acero.toFixed(2),
        titulo: `El agua atraviesa ${m.nombre}`,
        frase: `${cap(w.nombre)} pasa a ${f(s.d)} mm del eje de ${m.nombre}: se meten ${f(-acero)} mm uno en otro. En la máquina es una fuga de agua y una pieza atorada. Pide ${f(lim)} mm de acero entre los dos.` });
    } else if (acero < lim) {
      hallazgos.push({ ...base, id: `agua×${w.role}×${m.role}#${m.cuerpo}`, tipo: 'agua-sin-acero', sev: 'falla', medido: +acero.toFixed(2),
        titulo: `Casi no queda acero junto a ${m.nombre}`,
        frase: `Entre ${w.nombre} y ${m.nombre} quedan ${f(acero)} mm de acero; el mínimo es ${f(lim)}. Con la presión del agua y el calor, esa pared se agrieta.` });
    } else {
      hallazgos.push({ ...base, id: `agua×${w.role}×${m.role}#${m.cuerpo}`, tipo: 'agua-justa', sev: 'aviso', medido: +acero.toFixed(2),
        titulo: `Pasa de panzazo junto a ${m.nombre}`,
        frase: `Entre ${w.nombre} y ${m.nombre} quedan ${f(acero)} mm de acero contra ${f(lim)} de mínimo: cumple por ${f(acero - lim)} mm.` });
    }
  }

  // 1b · EL AGUA CONTRA LA CAVIDAD (orden H) — cada línea (y el baffle del macho, que es la que más se le acerca) contra la
  // malla de TU pieza, que es la cara de la cavidad. El agua NO es una cápsula: es un cilindro de extremo PLANO (la broca
  // termina en su cara), y la distancia se mide contra ese cilindro finito — con cápsula, el baffle ⌀9.53 que termina 5.24 mm
  // bajo el ápice saldría con 0.48 mm de acero falsos. Exacto: por triángulo, la cota baja de la cápsula descarta, y en los que
  // quedan se minimiza la distancia al cilindro (convexa sobre el triángulo) por sección áurea anidada.
  let paresCav = 0, masJustoCav: ParJusto | null = null;
  const pz = piezas.find((p) => p.role === 'pieza');
  if (pz) {
    const aguaCav: Cilindro[] = [...agua];
    for (const p of piezas) {
      if (!ES_BAFFLE(p.role)) continue;
      const cs = cuerposDe(p), fis = piezasFisicas(cs);
      cs.forEach((c, k) => { const cil = cilindroDeCaja(c.min, c.max); if (cil) aguaCav.push({ role: p.role, cuerpo: fis[k], nombre: 'el baffle del macho', ...cil }); });
    }
    const tris = triangulosDe(pz);
    for (const w of aguaCav) {
      const m = aceroCilindroMalla(w, tris);
      if (!m) continue;
      paresCav++;
      const lim = frac * 2 * w.r, acero = m.acero;
      const par: ParJusto = { acero: +acero.toFixed(2), limite: +lim.toFixed(2), rA: 0, rB: 0, c1: m.c1, c2: m.c2,
        lugar: [(m.c1[0] + m.c2[0]) / 2, (m.c1[1] + m.c2[1]) / 2, (m.c1[2] + m.c2[2]) / 2],
        roleA: w.role, roleB: 'pieza', nombreA: w.nombre, nombreB: 'la cavidad (la cara de tu pieza)', ejeAgua: w.eje };
      if (!masJustoCav || acero - lim < masJustoCav.acero - masJustoCav.limite) masJustoCav = par;
      if (!masJusto || acero - lim < masJusto.acero - masJusto.limite) masJusto = par;
      if (acero >= lim + aviso) continue;
      const f = (x: number) => x.toFixed(2);
      const base = { lugar: par.lugar, cota: [m.c1, m.c2] as [V3, V3], limite: +lim.toFixed(2), unidad: 'mm' as const,
        regla: `§9.2.7: ≥ ½·⌀ de acero (${f(lim)} mm) entre el agua y la cara de la cavidad`,
        a: { role: w.role, cuerpo: w.cuerpo, nombre: w.nombre }, b: { role: 'pieza', cuerpo: 0, nombre: 'la cavidad' } };
      const id = `agua×${w.role}×pieza`;
      // la distancia a un cilindro SÓLIDO no es negativa: si se tocan sale ~0 (la sección áurea deja 1e-9), no 0 exacto —
      // el par de control lo cazó («entra 2 mm» salía «sin acero 0.00»). Bajo 0.01 mm es que se tocan.
      if (acero < 0.01) hallazgos.push({ ...base, id, tipo: 'agua-atraviesa', sev: 'falla', medido: +acero.toFixed(2),
        titulo: 'El agua entra a la cavidad',
        frase: `${cap(w.nombre)} toca la cara de tu pieza: el agua saldría por la cavidad. Pide ${f(lim)} mm de acero entre las dos.` });
      else if (acero < lim) hallazgos.push({ ...base, id, tipo: 'agua-sin-acero', sev: 'falla', medido: +acero.toFixed(2),
        titulo: 'Casi no queda acero entre el agua y tu pieza',
        frase: `Entre ${w.nombre} y la cara de tu pieza quedan ${f(acero)} mm de acero; el mínimo es ${f(lim)}. Con la presión de inyección y el calor esa pared se agrieta y el agua llega al plástico.` });
      else hallazgos.push({ ...base, id, tipo: 'agua-justa', sev: 'aviso', medido: +acero.toFixed(2),
        titulo: 'Pasa de panzazo junto a la cavidad',
        frase: `Entre ${w.nombre} y la cara de tu pieza quedan ${f(acero)} mm de acero contra ${f(lim)} de mínimo: cumple por ${f(acero - lim)} mm.` });
    }
  }

  // 2 · la piel de acero sobre cada punta (la broca que se quedó corta)
  const nucleo = piezas.find((p) => p.role === 'nucleo');
  if (nucleo) for (const p of piezas) {
    if (!/^pin-punta-\d+$/.test(p.role)) continue;
    const c = cuerposDe(p)[0]; if (!c) continue;
    const cx = (c.min[0] + c.max[0]) / 2, cy = (c.min[1] + c.max[1]) / 2, zt = c.max[2];
    // JUSTO DEBAJO de la punta: ahí debería haber AIRE (el barreno que acompaña al pin). Si el punto cae dentro
    // del acero (cruces impares hacia arriba), la broca terminó antes que el pin: la piel es lo que hay entre el
    // techo del barreno y la punta (el primer cruce hacia ABAJO). Medido así en la tapa: 156.8 − 155.94 = 0.86.
    const o: V3 = [cx + 1e-4, cy + 2e-4, zt - 0.02];
    if (crucesVerticales(nucleo, o, 1).length % 2 === 1) {
      const abajo = crucesVerticales(nucleo, o, -1);
      const piel = (abajo.length ? abajo[0] : 0) + 0.02;
      if (piel < pielMin) continue;
      const id = idPin(p), zb = zt - piel;
      hallazgos.push({ id: `piel×${p.role}`, tipo: 'piel-sobre-punta', sev: 'falla', medido: +piel.toFixed(2), limite: 0, unidad: 'mm',
        titulo: `${id} empuja contra acero`,
        frase: `La broca del núcleo se quedó corta: el barreno termina ${piel.toFixed(2)} mm antes que la punta de ${id}, y esos ${piel.toFixed(2)} mm de pin están metidos en acero sin barrenar. Así el pin no entra al molde; el barreno tiene que llegar hasta la cara del macho.`,
        lugar: [cx, cy, zb + piel / 2], cota: [[cx, cy, zb], [cx, cy, zt]],
        regla: 'la punta del pin termina en la cara del macho y su barreno la acompaña hasta ahí',
        a: { role: p.role, cuerpo: 0, nombre: `la punta de ${id}` }, b: { role: 'nucleo', cuerpo: 0, nombre: 'el núcleo' } });
    }
  }

  // un mismo par (agua × pieza física) puede salir por dos cascarones: se queda el PEOR
  const unicos = new Map<string, Crudo>();
  for (const h of hallazgos) { const o = unicos.get(h.id); if (!o || h.medido < o.medido) unicos.set(h.id, h); }
  const finales = agrupar([...unicos.values()]);
  const peso = (h: Hallazgo) => (h.sev === 'falla' ? 0 : 1) * 1e6 + (h.tipo === 'agua-atraviesa' || h.tipo === 'piel-sobre-punta' ? 0 : 1e3) + h.medido;
  finales.sort((a, b) => peso(a) - peso(b));
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { hallazgos: finales, masJusto, cavidad: { pares: paresCav, masJusto: masJustoCav }, cilindros, pares, ms: Math.round(t1 - t0) };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** el español contrae: «a el» → «al», «de el» → «del» */
const es = (s: string) => s.replace(/\b([Aa]) el\b/g, '$1l').replace(/\b([Dd])e el\b/g, '$1el');

/** cómo se llama un grupo de vecinos del agua (el rol sin su número) */
const PLURAL: Array<[RegExp, string, string]> = [
  [/^pines-retorno$/, 'retorno', 'retornos'], [/^interlocks$/, 'interlock', 'interlocks'], [/^guias$/, 'guía', 'guías'], [/^bujes$/, 'buje', 'bujes'],
  [/^tornillos-(cav|core)$/, 'tornillo', 'tornillos'], [/^pilares-soporte$/, 'pilar', 'pilares'],
  [/^pin-cuerpo-\d+$/, 'cuerpo de botador', 'cuerpos de botador'], [/^pin-punta-\d+$/, 'punta de botador', 'puntas de botador'],
];
const familia = (role: string) => role.replace(/-\d+$/, '');
const plural = (role: string, n: number) => { const f = PLURAL.find(([re]) => re.test(role)); return f ? (n === 1 ? f[1] : f[2]) : role; };

/** UN problema, VARIOS lugares → una ficha. Se agrupa por qué pasa (tipo) y contra qué (la familia del vecino). */
type Crudo = Omit<Hallazgo, 'lugares'>;
function agrupar(hs: Crudo[]): Hallazgo[] {
  const grupos = new Map<string, Crudo[]>();
  for (const h of hs) {
    const k = `${h.tipo}|${h.tipo === 'piel-sobre-punta' ? 'pin' : familia(h.b.role)}`;
    (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(h);
  }
  const out: Hallazgo[] = [];
  for (const g of grupos.values()) {
    g.sort((x, y) => x.medido - y.medido);
    const peor = g[0];
    const lugares = g.map((h) => ({ lugar: h.lugar, cota: h.cota, nombre: h.b.nombre, roles: [h.a.role, h.b.role] as [string, string] }));
    if (g.length === 1) { out.push({ ...peor, titulo: es(peor.titulo), frase: es(peor.frase), lugares }); continue; }
    if (peor.b.role === 'pieza') {   // contra la cavidad (orden H): una cara, varias líneas
      out.push({ ...peor, id: `${peor.tipo}|pieza`, titulo: `${peor.titulo} (${g.length} líneas)`, frase: es(peor.frase) + ` Es la más justa de ${g.length} líneas.`, lugares });
      continue;
    }
    const cuerpos = new Set(g.map((h) => `${h.b.role}#${h.b.cuerpo}`)).size;
    const quien = plural(peor.b.role, cuerpos);
    const cruces = g.length > cuerpos ? ` (${g.length} cruces)` : '';
    const titulo = peor.tipo === 'piel-sobre-punta' ? `${g.length} botadores empujan contra acero`
      : peor.tipo === 'agua-atraviesa' ? `El agua atraviesa ${cuerpos} ${quien}${cruces}`
      : peor.tipo === 'agua-sin-acero' ? `Casi no queda acero junto a ${cuerpos} ${quien}`
      : `Pasa de panzazo junto a ${cuerpos} ${quien}`;
    const iguales = g.every((h) => Math.abs(h.medido - peor.medido) < 0.02);
    const frase = es(peor.frase) + (iguales ? ` Pasa igual en los ${g.length} lugares.` : ` Es el peor de ${g.length} lugares (el mejor: ${g[g.length - 1].medido.toFixed(2)} mm).`);
    out.push({ ...peor, id: `${peor.tipo}|${familia(peor.b.role)}`, titulo, frase, lugares });
  }
  return out;
}
