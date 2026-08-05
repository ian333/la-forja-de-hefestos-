/**
 * L6 · SECUENCIA DE APERTURA Y EXPULSIÓN — la MISMA sección de L5 en las poses del ciclo.
 * ============================================================================
 * El roster lo dice literal: L6 es *"la misma sección de L5 repetida en las poses del
 * ciclo: cerrado → parcialmente abierto → totalmente abierto → expulsores actuados"*, y
 * es *"la única [lámina] que valida correderas, núcleos móviles y auto-degating"*.
 * Por eso este archivo NO trae motor de sección propio: importa el de L5
 * (`seccionarPorPlano`, `solidosDeMolde`, `mallaCaja`…) y le agrega las tres cosas que
 * L5 no tiene: CINEMÁTICA, MECANISMOS y BARRIDO DE INTERFERENCIA.
 *
 * ═══ LO QUE JUZGA (y con qué cita) ══════════════════════════════════════════
 *   V11.1  §11.1  Fig 11.1-11.4 — las cuatro poses. El libro NO da criterio de ojo:
 *          la verificación real es *"colisiones e interferencias a lo largo del
 *          recorrido"*, y eso es lo que barre esta lámina.
 *   V11.8  §11.2.5 Fig 11.13 — pin contorneado: *"if the ejector pin is too short, then
 *          a gap will form between the top of the ejector pin and the opposite surface
 *          of the cavity insert. If this gap is larger than the thickness of a vent,
 *          then flash is likely to occur. Meanwhile, if the ejector pin is too long,
 *          then the pin will be compressed on mold closure."* → 0 ≤ hueco ≤ 0.02 mm
 *          (el espesor de venteo en el plano de partición, §8.2.3 V8.6: *"on the order
 *          of 0.02 mm"*).
 *   V11.14 §11.3.3 Fig 11.19-11.20 — stripper: *"uniform ejection forces that are nearly
 *          in-line with the friction force between the molding"*. Con pines se MIDE la
 *          cobertura del perímetro de empuje; el ensamble stripper NO está modelado ⇒
 *          SIN CABLEAR (nunca verde).
 *   V11.17 §11.4  Fig 11.24-11.26 — núcleo móvil: contacto en la CARA FRONTAL y holgura
 *          lateral, *"so that the entire clamping force of the actuation cylinder is
 *          applied to the window core"*.
 *   V11.18 §11.4  Fig 11.27-11.28 — corredera: el pin angular *"is limited to about 20
 *          degrees"* y el BLOQUE DE TALÓN contacta antes de que la presión cargue el pin.
 *   V7.7   §7.2.7 Fig 7.12-7.13 — tunnel gate: *"The motion of the core insert away from
 *          the cavity insert causes the tunnel gate to break at its junction with the
 *          molding."* Cotas duras: eje a 45° del plano de partición · cono con ángulo
 *          incluido ≥ 20° · gate a ≥ 3 diámetros de túnel del plano de partición.
 *   V6.1   §6.3  Tabla 6.1 — la carrera de apertura MEDIDA en la pose "fully open"
 *          (250 mm en tres placas vs 75 mm en dos placas) contra el daylight.
 *   V13.5  §13.2-13.10 — catálogo: *"SÍ como catálogo de vistas de sección que el molde
 *          debe poder producir"*. Se reporta qué mecanismos SÍ dibuja y cuáles NO.
 *
 * ═══ LO QUE ES LITERAL Y LO QUE ES EXTENSIÓN ════════════════════════════════
 * Ningún umbral se inventó: cada cota trae su § y su cita donde se usa. Lo que el libro
 * no da (holguras de modelado, alto del cuerpo de la corredera, calendario del cilindro
 * hidráulico, ventana de la pieza de demostración) va marcado EXTENSIÓN DECLARADA en el
 * código Y en la lámina. Lo que no se puede medir sale **SIN CABLEAR** en ámbar y TUMBA
 * el veredicto global — jamás verde.
 *
 * ═══ POR QUÉ EL BARRIDO ES EXACTO Y BARATO ══════════════════════════════════
 * Todos los movimientos del ciclo son TRASLACIONES CONTENIDAS EN EL PLANO DE CORTE
 * (apertura ‖ v, correderas ‖ u). Para una traslación t con t·n = 0, la sección del
 * sólido movido es la sección del sólido quieto TRASLADADA por (t·u, t·v) — exacto, sin
 * volver a cortar la malla. Así el barrido corre cientos de muestras a coste de polígono
 * y no de malla. El gate lo verifica contra el recorte COMPLETO (`mover` de L5) con
 * error 0, y verifica t·n = 0 para cada grupo cinemático.
 */
import type { MoldAssemblySpec } from './mold-assembly';
import type { Lamina } from './laminas-visuales';
import {
  seccionarPorPlano, solidosDeMolde, baseDelPlano,
  mallaCaja, mallaCilindro, unirMallas, mallaPlacaConBolsas,
  type SolidoSeccion, type MallaSec, type Vec2, type Vec3, type PlanoCorte,
  type RolSeccion, type Seccion, type PiezaSeccionada, type Rect, type EstadoV,
} from './lamina-seccion';
import { insertDims, cavityFootprint, cavityGrid, plateDepth, plateDefs, moldStackHeight } from './mold-drawing-set';
import { plateStackZ } from './mold-plano-set';
import { planSideAction, planFromSpec, type SideActionPlan } from './mold-sideaction-gen';
import { moldOpeningStrokeMm, OPEN_FACTOR, daylightNeededMm } from './threeplate';

// ─────────────────────────────────────────────────────────────────────────────
// COTAS DEL LIBRO — literales, con su § y su cita. NADA de esto se inventó.
// ─────────────────────────────────────────────────────────────────────────────

/** §8.2.3 (V8.6): venteo en el plano de partición *"on the order of 0.02 mm"*.
 *  §11.2.5 lo usa como UMBRAL: hueco del pin > espesor de venteo ⇒ rebaba. */
export const VENTEO_PARTICION_MM = 0.02;
/** §11.4: el pin angular *"is limited to about 20 degrees"*. */
export const ANGULO_PIN_MAX_DEG = 20;
/** §7.2.7: *"a nominal 45 degree angle should be maintained"* entre el eje del túnel
 *  y el plano de partición. */
export const TUNEL_ANGULO_DEG = 45;
/** §7.2.7: *"the tunnel gate should have an included taper angle of at least 20"*. */
export const TUNEL_TAPER_MIN_DEG = 20;
/** §7.2.7: *"the tunnel gate should be located at least three tunnel diameters off the
 *  parting plane"*. */
export const TUNEL_OFF_PARTING_DIAS = 3;
/** Tabla 6.1 (V6.1): *"the three-plate mold has a mold opening distance of 250 mm, much
 *  greater than the mold opening distance of 75 mm for the two-plate mold"*. Son los
 *  ANCLAS de contraste del libro, no umbrales: se citan junto a lo medido. */
export const TABLA_6_1 = { dosPlacasMm: 75, tresPlacasMm: 250 } as const;
/** EXTENSIÓN DECLARADA: holgura de la ranura del pin angular en su cara NO motriz. El
 *  libro da el ángulo y la longitud del pin (Eq 11.26), no la holgura de la ranura. */
export const HOLGURA_RANURA_MM = 0.5;

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

/** Grupo cinemático: todo sólido pertenece a uno y su movimiento sale del grupo. */
export type Grupo = 'fijo' | 'movil' | 'expulsor' | 'mecanismo';

export interface Mecanismo {
  id: string;
  tipo: 'corredera' | 'nucleo-movil';
  /** +1 = lado +u de la sección · −1 = lado −u */
  lado: 1 | -1;
  plan: SideActionPlan;
  /** carrera lateral necesaria (mm) — §11.3.7: S = penetración + 3 */
  carreraMm: number;
  /** φ del pin angular (°) — solo corredera */
  anguloDeg: number;
  /** recorrido de apertura en el que el pin angular termina de empujar (mm):
   *  d* = S / tan φ (el pin desengancha ahí). Solo corredera. */
  desengancheMm: number;
  /** ventana del recorrido en la que actúa el cilindro (mm) — solo núcleo móvil.
   *  EXTENSIÓN DECLARADA: el libro no da el calendario del hidráulico. */
  actuaDesdeMm: number; actuaHastaMm: number;
  /** avance lateral (mm) en función del recorrido de apertura */
  ley: (d: number) => number;
  /** geometría dibujada (mm, en el marco (u,v) de la sección, u relativo al centro) */
  geo: {
    uNariz0: number; uNariz1: number;      // la nariz que forma la ventana
    uCuerpo1: number;                      // fin del cuerpo
    uTalon1: number;                       // fin del bloque de talón (corredera)
    vAlto: number;                         // alto del cuerpo sobre la partición
    ventanaZ0: number; ventanaZ1: number;  // franja z de la ventana (absoluta)
    anchoWmm: number;                      // ancho ⟂ a la sección
    huecoTalonMm: number;                  // hueco talón↔respaldo con el molde CERRADO
    huecoFrontalMm: number;                // hueco de la cara frontal (núcleo móvil)
    holguraLateralMm: number;              // holgura lateral (núcleo móvil)
  };
}

export interface Pose {
  id: 'cerrado' | 'parcial' | 'abierto' | 'expulsado';
  nombre: string; porque: string; cita: string;
  aperturaMm: number; expulsionMm: number;
  /** recorrido acumulado (mm) sobre la trayectoria del ciclo */
  tMm: number;
}

export interface ParVigilado {
  a: string; b: string;
  /** máxima penetración de sección hallada en TODO el recorrido (mm²) */
  penetracionMaxMm2: number;
  /** recorrido acumulado donde ocurre esa penetración (mm) */
  tPenetracionMm: number | null;
  /** recorrido donde ARRANCA la penetración (bisección, mm) */
  tArranqueMm: number | null;
  /** holgura mínima (mm) medida exacta; null si nunca se acercaron a `CERCA_MM` */
  holguraMinMm: number | null;
  tHolguraMinMm: number | null;
  /** ¿se tocan (holgura 0) sin penetrar en algún punto? */
  contacto: boolean;
  estado: 'OK' | 'CONTACTO' | 'INTERFIERE';
}

export interface MedidasApertura {
  veredictos: VeredictoL6[];
  pares: ParVigilado[];
  /** pares EXCLUIDOS del barrido, con su razón (barrenos no restados en el modelo) */
  excluidos: Array<{ a: string; b: string; porque: string }>;
  datos: Record<string, number | string | null>;
  extensiones: string[];
  avisos: string[];
}

export interface VeredictoL6 {
  id: string; titulo: string; cita: string;
  estado: EstadoV;
  medido?: string; limite?: string;
  porque: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// GEOMETRÍA AUXILIAR — mallas que L5 no trae (prisma convexo y cono de eje libre)
// ─────────────────────────────────────────────────────────────────────────────

const cruz = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const punto3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm3 = (a: Vec3): Vec3 => { const L = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / L, a[1] / L, a[2] / L]; };
const mas = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const por = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];

/**
 * PRISMA de sección poligonal: el polígono vive en el plano (u,v) del corte y se
 * extruye a lo largo de la normal w. Con la terna derecha u×v=w, un polígono CCW en
 * (u,v) extruido de w0 a w1 sale con normales HACIA AFUERA (el gate lo verifica por
 * volumen con signo = área·(w1−w0) > 0).
 *
 * Es lo que permite dibujar una corredera con respaldo INCLINADO (la cara del talón,
 * que debe ser paralela al pin angular para que el contacto se mantenga durante la
 * apertura) sin salirse del cortador de mallas de L5.
 */
export function mallaPrisma(poly: Vec2[], w0: number, w1: number, base: { u: Vec3; v: Vec3; w: Vec3 }, origen: Vec3 = [0, 0, 0]): MallaSec {
  let A = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    A += p[0] * q[1] - q[0] * p[1];
  }
  const pts = A >= 0 ? poly : poly.slice().reverse();         // siempre CCW
  const n = pts.length;
  const P: number[] = [], I: number[] = [];
  const emit = (p: Vec2, w: number) => {
    const q = mas(mas(origen, por(base.u, p[0])), mas(por(base.v, p[1]), por(base.w, w)));
    P.push(q[0], q[1], q[2]); return P.length / 3 - 1;
  };
  const bot: number[] = [], top: number[] = [];
  for (const p of pts) bot.push(emit(p, w0));
  for (const p of pts) top.push(emit(p, w1));
  for (let i = 1; i + 1 < n; i++) { I.push(top[0], top[i], top[i + 1]); I.push(bot[0], bot[i + 1], bot[i]); }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    I.push(bot[i], bot[j], top[j]); I.push(bot[i], top[j], top[i]);
  }
  return { positions: P, indices: I };
}

/** Cono truncado de EJE LIBRE (p0→p1, radios r0→r1). `mallaCilindro` de L5 solo admite
 *  ejes X/Y/Z y el tunnel gate va a 45°, igual que el pin angular a 20°. Cortado por un
 *  plano que contiene su eje da el trapecio h·(r0+r1) — analítico, y el gate lo mide. */
export function mallaConoEje(p0: Vec3, p1: Vec3, r0: number, r1: number, n = 48, fase = 0): MallaSec {
  const ax = norm3([p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]);
  let ref: Vec3 = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const e1 = norm3(cruz(ref, ax)), e2 = cruz(ax, e1);
  const P: number[] = [], I: number[] = [];
  const anillo = (c: Vec3, r: number) => {
    const b = P.length / 3;
    for (let i = 0; i < n; i++) {
      const th = fase + (i / n) * 2 * Math.PI;
      const q = mas(c, mas(por(e1, r * Math.cos(th)), por(e2, r * Math.sin(th))));
      P.push(q[0], q[1], q[2]);
    }
    return b;
  };
  const A = anillo(p0, r0), B = anillo(p1, r1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    I.push(A + i, A + j, B + j, A + i, B + j, B + i);
  }
  const cA = P.length / 3; P.push(p0[0], p0[1], p0[2]);
  const cB = P.length / 3; P.push(p1[0], p1[1], p1[2]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    I.push(cA, A + j, A + i); I.push(cB, B + i, B + j);
  }
  return { positions: P, indices: I };
}

/**
 * Parte una malla en DOS por un plano z = zc, repartiendo TRIÁNGULOS ENTEROS.
 * Solo vale cuando ningún triángulo cruza el plano (es el caso de las líneas de agua:
 * cada cilindro vive entero arriba o abajo de la partición). Sirve para separar el
 * circuito de refrigeración en la mitad FIJA y la mitad MÓVIL sin volver a rutear —
 * cero números duplicados del ruteo de L5. El gate verifica que ningún triángulo lo
 * cruce y que las áreas de las dos partes sumen la del original.
 */
export function partirMallaPorZ(m: MallaSec, zc: number): { abajo: MallaSec; arriba: MallaSec; cruzan: number } {
  const P = m.positions, I = m.indices;
  const mk = () => ({ positions: [] as number[], indices: [] as number[], remap: new Map<number, number>() });
  const A = mk(), B = mk();
  let cruzan = 0;
  const push = (D: ReturnType<typeof mk>, vi: number) => {
    let k = D.remap.get(vi);
    if (k == null) { k = D.positions.length / 3; D.positions.push(P[3 * vi], P[3 * vi + 1], P[3 * vi + 2]); D.remap.set(vi, k); }
    return k;
  };
  for (let t = 0; t + 2 < I.length; t += 3) {
    const vs = [I[t], I[t + 1], I[t + 2]];
    const zs = vs.map((v) => P[3 * v + 2]);
    const arriba = zs.every((z) => z >= zc), abajo = zs.every((z) => z <= zc);
    if (!arriba && !abajo) { cruzan++; continue; }
    const D = arriba ? B : A;
    for (const v of vs) D.indices.push(push(D, v));
  }
  return { abajo: { positions: A.positions, indices: A.indices }, arriba: { positions: B.positions, indices: B.indices }, cruzan };
}

// ─────────────────────────────────────────────────────────────────────────────
// POLÍGONOS: intersección EXACTA por franjas y distancia mínima
// ─────────────────────────────────────────────────────────────────────────────

interface Arista { x0: number; y0: number; x1: number; y1: number }

const aristasDe = (lz: Vec2[][]): Arista[] => {
  const out: Arista[] = [];
  for (const L of lz) for (let i = 0; i < L.length; i++) {
    const p = L[i], q = L[(i + 1) % L.length];
    if (p[0] !== q[0] || p[1] !== q[1]) out.push({ x0: p[0], y0: p[1], x1: q[0], y1: q[1] });
  }
  return out;
};

/** intervalos [y0,y1] que el conjunto ocupa en la vertical x=xm (regla par-impar),
 *  con la arista que produjo cada cruce para poder evaluarlos en otro x */
function intervalos(ars: Arista[], xm: number): Array<{ y: number; a: Arista }> {
  const cs: Array<{ y: number; a: Arista }> = [];
  for (const a of ars) {
    const lo = Math.min(a.x0, a.x1), hi = Math.max(a.x0, a.x1);
    if (!(lo < xm && xm < hi)) continue;
    const t = (xm - a.x0) / (a.x1 - a.x0);
    cs.push({ y: a.y0 + t * (a.y1 - a.y0), a });
  }
  cs.sort((p, q) => p.y - q.y);
  return cs;
}
const yEn = (a: Arista, x: number) => a.y0 + ((x - a.x0) / (a.x1 - a.x0)) * (a.y1 - a.y0);

/**
 * ÁREA DE INTERSECCIÓN EXACTA de dos conjuntos de polígonos (par-impar), por
 * descomposición en franjas verticales: se cortan las x de todos los vértices y de
 * todos los cruces arista-arista; dentro de cada franja la estructura de intervalos es
 * constante y el largo de solape es LINEAL en x, así que el área de la franja es
 * exactamente ancho × largo(medio) (regla del trapecio, exacta para lineales).
 * Devuelve además los trapecios, que la lámina pinta en rojo donde hay choque.
 */
export function interseccionPoligonos(A: Vec2[][], B: Vec2[][]): { areaMm2: number; trapecios: Vec2[][] } {
  const ea = aristasDe(A), eb = aristasDe(B);
  if (!ea.length || !eb.length) return { areaMm2: 0, trapecios: [] };
  const bb = (e: Arista[]) => e.reduce((r, a) => ({
    x0: Math.min(r.x0, a.x0, a.x1), x1: Math.max(r.x1, a.x0, a.x1),
    y0: Math.min(r.y0, a.y0, a.y1), y1: Math.max(r.y1, a.y0, a.y1),
  }), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity });
  const BA = bb(ea), BB = bb(eb);
  if (BA.x1 <= BB.x0 || BB.x1 <= BA.x0 || BA.y1 <= BB.y0 || BB.y1 <= BA.y0) return { areaMm2: 0, trapecios: [] };
  const xLo = Math.max(BA.x0, BB.x0), xHi = Math.min(BA.x1, BB.x1);
  const xs = new Set<number>([xLo, xHi]);
  const dentro = (x: number) => x > xLo && x < xHi;
  for (const e of [...ea, ...eb]) { if (dentro(e.x0)) xs.add(e.x0); if (dentro(e.x1)) xs.add(e.x1); }
  for (const p of ea) for (const q of eb) {
    const d = (p.x1 - p.x0) * (q.y1 - q.y0) - (p.y1 - p.y0) * (q.x1 - q.x0);
    if (Math.abs(d) < 1e-14) continue;
    const t = ((q.x0 - p.x0) * (q.y1 - q.y0) - (q.y0 - p.y0) * (q.x1 - q.x0)) / d;
    const s = ((q.x0 - p.x0) * (p.y1 - p.y0) - (q.y0 - p.y0) * (p.x1 - p.x0)) / d;
    if (t < 0 || t > 1 || s < 0 || s > 1) continue;
    const x = p.x0 + t * (p.x1 - p.x0);
    if (dentro(x)) xs.add(x);
  }
  const X = [...xs].sort((a, b) => a - b);
  let area = 0; const traps: Vec2[][] = [];
  for (let i = 0; i + 1 < X.length; i++) {
    const xa = X[i], xb = X[i + 1], w = xb - xa;
    if (w <= 1e-12) continue;
    const xm = (xa + xb) / 2;
    const ca = intervalos(ea, xm), cb = intervalos(eb, xm);
    if (ca.length < 2 || cb.length < 2) continue;
    for (let k = 0; k + 1 < ca.length; k += 2) {
      for (let j = 0; j + 1 < cb.length; j += 2) {
        const lo = ca[k].y > cb[j].y ? ca[k] : cb[j];
        const hi = ca[k + 1].y < cb[j + 1].y ? ca[k + 1] : cb[j + 1];
        const h = hi.y - lo.y;
        if (h <= 1e-12) continue;
        area += w * h;
        traps.push([[xa, yEn(lo.a, xa)], [xb, yEn(lo.a, xb)], [xb, yEn(hi.a, xb)], [xa, yEn(hi.a, xa)]]);
      }
    }
  }
  return { areaMm2: area, trapecios: traps };
}

/** distancia mínima segmento-segmento (2D) */
function distSeg(a: Arista, b: Arista): number {
  const d1x = a.x1 - a.x0, d1y = a.y1 - a.y0, d2x = b.x1 - b.x0, d2y = b.y1 - b.y0;
  const rx = a.x0 - b.x0, ry = a.y0 - b.y0;
  const A = d1x * d1x + d1y * d1y, B = d1x * d2x + d1y * d2y, C = d2x * d2x + d2y * d2y;
  const D = d1x * rx + d1y * ry, E = d2x * rx + d2y * ry;
  const den = A * C - B * B;
  let s = 0, t = 0;
  if (den > 1e-14) { s = Math.min(1, Math.max(0, (B * E - C * D) / den)); }
  t = C > 1e-14 ? Math.min(1, Math.max(0, (B * s + E) / C)) : 0;
  s = A > 1e-14 ? Math.min(1, Math.max(0, (B * t - D) / A)) : 0;
  const px = a.x0 + s * d1x - (b.x0 + t * d2x), py = a.y0 + s * d1y - (b.y0 + t * d2y);
  return Math.hypot(px, py);
}

/** distancia mínima entre dos conjuntos de polígonos (0 si se tocan o penetran) */
export function distanciaPoligonos(A: Vec2[][], B: Vec2[][]): number {
  const ea = aristasDe(A), eb = aristasDe(B);
  let best = Infinity;
  for (const p of ea) for (const q of eb) { const d = distSeg(p, q); if (d < best) best = d; if (best === 0) return 0; }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// EL MOLDE DE L6 = el de L5 + cavidad tallada + mecanismos + tunnel gate
// ─────────────────────────────────────────────────────────────────────────────

export interface VentanaDemo {
  /** lado de la sección: +1 (=+u) o −1 */
  lado: 1 | -1;
  /** ancho de la ventana ⟂ al plano de corte (mm) */
  anchoMm: number;
  /** alto de la ventana (mm) y su arranque medido desde la partición (mm) */
  altoMm: number; desdeMm: number;
  /** el cliente exige cilindro (⇒ core pull §11.3.7) en vez de corredera */
  hidraulico?: boolean;
}

export interface OpcionesApertura {
  spec: MoldAssemblySpec;
  eje?: 'x' | 'y';
  /** ventanas (undercuts) de la pieza; cada una genera su mecanismo por §11.3.7 */
  ventanas?: VentanaDemo[];
  /** alimentación por TUNNEL GATE (§7.2.7) en vez de bebedero directo */
  tunnel?: boolean;
  /** error de longitud del pin contorneado (mm): >0 pin LARGO, <0 pin CORTO (V11.8) */
  errPinMm?: number;
  /** hueco talón↔respaldo con el molde cerrado (mm). §11.4 exige CONTACTO (0). */
  huecoTalonMm?: number;
  /** hueco de la cara FRONTAL del núcleo móvil (mm). §11.4 exige contacto (0). */
  huecoFrontalMm?: number;
  /** desvío DELIBERADO de la ley de la corredera (°) — control positivo del gate:
   *  si la corredera no avanza d·tanφ, el pin angular penetra su ranura. */
  desvioLeyDeg?: number;
  /** offset del túnel al plano de partición, en diámetros (default 3 = mínimo del libro) */
  tunelOffDias?: number;
  /** daylight de la máquina para V6.1 */
  maquina?: { nombre: string; minDaylightMm: number; maxDaylightMm: number } | null;
  ancho?: number; alto?: number;
}

export interface MetaApertura {
  spec: MoldAssemblySpec;
  plano: PlanoCorte;
  base: { u: Vec3; v: Vec3; w: Vec3 };
  eje: 'x' | 'y';
  cx: number; cy: number; zPart: number;
  /** u del centro de la impresión en el marco de la sección */
  uCentro: number;
  id: ReturnType<typeof insertDims>;
  machoHmm: number;
  /** carreras del ciclo */
  aperturaTotalMm: number; aperturaGeomMm: number; aperturaLibroMm: number;
  expulsionMm: number; expulsionDisponibleMm: number;
  grupos: Map<string, Grupo>;
  mecanismos: Mecanismo[];
  tunel: { diaMm: number; offMm: number; anguloDeg: number; taperDeg: number; uJ: number; vJ: number; uR: number; vR: number } | null;
  errPinMm: number;
  /** pared donde vive el pin contorneado (0 = no cupo) y donde vive el tunnel gate */
  ladoPin: 1 | -1 | 0; ladoTunel: 1 | -1 | null;
  stackMm: number;
  extensiones: string[];
  avisos: string[];
  /** pares excluidos del barrido con su razón */
  excluidos: Array<{ a: string; b: string; porque: string }>;
}

/** rect en el marco (u,w) del corte → Rect del mundo (x,y), centrado en (cx,cy) */
function rectUW(eje: 'x' | 'y', cx: number, cy: number, u0: number, u1: number, w0: number, w1: number): Rect {
  return eje === 'x'
    ? { x0: cx + w0, y0: cy + u0, x1: cx + w1, y1: cy + u1 }
    : { x0: cx + u0, y0: cy - w1, x1: cx + u1, y1: cy - w0 };
}

/**
 * PIEZA DE DEMOSTRACIÓN con VENTANAS en la pared lateral (Fig 2.7: *"a window in a side
 * wall"*). La ventana es un rasgo DECLARADO de la pieza (dato del cliente), no una cota
 * del libro. Las cotas nominales (huella, profundidad, pared) son las que ya resolvió
 * §4.2 (`insertDims`), así que el macho que construye L5 encaja exacto en el interior.
 */
export function mallaPiezaConVentanas(o: {
  eje: 'x' | 'y'; fx: number; fy: number; dep: number; wall: number;
  ventanas: Array<{ lado: 1 | -1; anchoMm: number; z0: number; z1: number }>;
}): MallaSec {
  const planta = rectUW(o.eje, 0, 0, -o.fy / 2, o.fy / 2, -o.fx / 2, o.fx / 2);
  const bolsas: Array<{ rect: Rect; z0: number; z1: number }> = [
    { rect: rectUW(o.eje, 0, 0, -o.fy / 2 + o.wall, o.fy / 2 - o.wall, -o.fx / 2 + o.wall, o.fx / 2 - o.wall), z0: 0, z1: o.dep - o.wall },
  ];
  for (const v of o.ventanas) {
    const u0 = v.lado > 0 ? o.fy / 2 - o.wall : -o.fy / 2;
    bolsas.push({ rect: rectUW(o.eje, 0, 0, u0, u0 + o.wall, -v.anchoMm / 2, v.anchoMm / 2), z0: v.z0, z1: v.z1 });
  }
  return mallaPlacaConBolsas(planta, 0, o.dep, bolsas);
}

/**
 * LOS SÓLIDOS DE L6. Parte de `solidosDeMolde` (L5) y aplica cuatro cambios, TODOS
 * declarados:
 *  1) la bolsa de la IMPRESIÓN se talla en el inserto de cavidad (L5 lo dibuja macizo
 *     con el moldeo encima). Sin tallarla, cualquier mecanismo que entre a la cavidad
 *     daría interferencia FALSA y el barrido no serviría para nada.
 *  2) el alojamiento de cada mecanismo se talla en el inserto y en la placa A.
 *  3) las líneas de agua se parten en mitad FIJA y mitad MÓVIL (se separan al abrir).
 *  4) se agregan: pin CONTORNEADO §11.2.5, corredera + pin angular + talón §11.4,
 *     núcleo móvil §11.4 y, si se pide, runner + tunnel gate §7.2.7 en vez de bebedero.
 */
export function solidosApertura(o: OpcionesApertura): { solidos: SolidoSeccion[]; meta: MetaApertura } {
  const spec = o.spec;
  const D = plateDepth(spec), W = spec.widthMm;
  const id = insertDims(spec);
  const { round } = cavityFootprint(spec);
  const z = plateStackZ(spec);
  const defs = plateDefs(spec);
  const grosor = (rol: string) => defs.find((d) => d.role === rol)?.thick ?? 0;
  const zPart = z.A;
  const cells = cavityGrid(spec, D);
  const ext: string[] = [];
  const avisos: string[] = [];
  const excluidos: MetaApertura['excluidos'] = [];

  const ventanas = (o.ventanas ?? []).filter((v) => !round);
  if ((o.ventanas ?? []).length && round)
    avisos.push('la pieza es de revolución: las ventanas laterales se ignoran (el modelo de cáscara redonda no las talla)');

  // ── la pieza: con ventanas si hay mecanismos ──
  const zv = (v: VentanaDemo) => ({ z0: v.desdeMm, z1: v.desdeMm + v.altoMm });
  const mallaPieza = ventanas.length
    ? mallaPiezaConVentanas({
      eje: o.eje ?? 'x', fx: id.fx, fy: id.fy, dep: id.dep, wall: id.wall,
      ventanas: ventanas.map((v) => ({ lado: v.lado, anchoMm: v.anchoMm, ...zv(v) })),
    })
    : undefined;

  const L5 = solidosDeMolde(spec, { eje: o.eje, mallaPieza });
  const plano = L5.plano;
  const base = baseDelPlano(plano);
  const eje = L5.meta.eje;
  const cx = cells[0].cx, cy = cells[0].cy;
  const uCentro = eje === 'x' ? cy : cx;
  const machoH = Math.max(0, id.dep - id.wall);
  ext.push(...L5.meta.extensiones);
  avisos.push(...L5.meta.avisos);

  // ── MECANISMOS (§11.3.7 / §11.4): uno por ventana, el plan lo elige el estudio ──
  const mecanismos: Mecanismo[] = [];
  for (let i = 0; i < ventanas.length; i++) {
    const v = ventanas[i];
    const { z0, z1 } = zv(v);
    // la región del undercut en el marco del planificador: x = eje de jale, y = ⟂
    const plan = v.hidraulico
      ? planFromSpec({ aProjMm2: v.anchoMm * v.altoMm, pMeltMPa: 200, strokeMm: +(id.wall + 3).toFixed(1), hydraulic: true }, v.altoMm, { fx: id.wall, fy: v.anchoMm })
      : planSideAction({ x0: 0, x1: id.wall, y0: -v.anchoMm / 2, y1: v.anchoMm / 2, zLo: z0, zHi: z1, volMm3: Math.round(id.wall * v.anchoMm * v.altoMm), cols: 9, dir: [1, 0] }, { pMeltMPa: 200 });
    if (!plan) continue;
    const S = plan.strokeMm;
    const phi = plan.angleDeg;
    const uPart = id.fy / 2;                                   // cara exterior de la pieza
    const cuerpo = plan.unit?.bodyLmm ?? 30;                   // catálogo (corredera) / §11.3.7 envelope (core pull)
    const talon = plan.unit?.heelLmm ?? 0;
    // el cuerpo tiene que TAPAR la franja de la ventana: si no, la nariz sobresale del
    // alojamiento y choca contra el inserto (interferencia FALSA por mal modelado).
    const altoCuerpo = Math.max(plan.unit?.bodyHmm ?? 0, v.desdeMm + v.altoMm + 3, 18);
    const esCorredera = plan.kind === 'slide';
    if (!plan.unit && esCorredera) ext.push('el cuerpo de la corredera se dibuja de 30 mm (§11.3.7 envelope): el libro no da la geometría del cuerpo');
    if (!esCorredera) ext.push(`núcleo móvil: cuerpo ${cuerpo} mm y alto ${altoCuerpo} mm son geometría DECLARADA (el libro da la fuerza Eq 11.24 y el bore Eq 11.25, no el bloque)`);
    const desenganche = esCorredera ? S / Math.tan((phi * Math.PI) / 180) : 0;
    const a0 = 0, a1 = Math.max(1e-6, id.dep);                 // EXTENSIÓN: calendario del cilindro
    if (!esCorredera) ext.push(`el cilindro del núcleo móvil se modela retrayendo linealmente entre 0 y ${a1.toFixed(0)} mm de apertura: el libro NO da el calendario del hidráulico`);
    const desvio = esCorredera ? (o.desvioLeyDeg ?? 0) : 0;
    const tanReal = Math.tan(((phi + desvio) * Math.PI) / 180);
    mecanismos.push({
      id: esCorredera ? `corredera${i}` : `nucleo-movil${i}`,
      tipo: esCorredera ? 'corredera' : 'nucleo-movil',
      lado: v.lado, plan, carreraMm: S, anguloDeg: phi, desengancheMm: desenganche,
      actuaDesdeMm: a0, actuaHastaMm: a1,
      ley: esCorredera
        ? (d: number) => Math.min(Math.max(0, d), desenganche) * tanReal
        : (d: number) => S * Math.min(1, Math.max(0, (d - a0) / (a1 - a0))),
      geo: {
        uNariz0: uPart - id.wall, uNariz1: uPart,
        uCuerpo1: uPart + cuerpo, uTalon1: uPart + cuerpo + talon,
        vAlto: altoCuerpo, ventanaZ0: zPart + z0, ventanaZ1: zPart + z1,
        anchoWmm: Math.max(v.anchoMm, plan.unit?.bodyWmm ?? v.anchoMm + 10),
        huecoTalonMm: o.huecoTalonMm ?? 0,
        huecoFrontalMm: o.huecoFrontalMm ?? 0,
        holguraLateralMm: 1,
      },
    });
  }
  if (mecanismos.some((m) => m.tipo === 'corredera'))
    ext.push(`la ranura del pin angular lleva ${HOLGURA_RANURA_MM} mm de holgura en la cara NO motriz (el libro no la da)`);
  if (mecanismos.some((m) => m.tipo === 'nucleo-movil'))
    ext.push('la holgura lateral del núcleo móvil se modela en 1 mm: §11.4 exige que EXISTA (contacto solo en la cara frontal) pero no da el número');

  // ── talla de la cavidad y de los alojamientos ──
  const S: SolidoSeccion[] = [];
  const bolsasCav: Array<{ rect: Rect; z0: number; z1: number }> = [];
  const bolsasA: Array<{ rect: Rect; z0: number; z1: number }> = [];
  const HOLGURA_ALOJ = 1;                                       // EXTENSIÓN DECLARADA
  ext.push(`el alojamiento del mecanismo se talla con ${HOLGURA_ALOJ} mm de holgura al cuerpo (el libro no da la holgura del gib)`);
  for (const c of cells) {
    if (!round) bolsasCav.push({ rect: rectUW(eje, c.cx, c.cy, -id.fy / 2, id.fy / 2, -id.fx / 2, id.fx / 2), z0: zPart, z1: zPart + id.dep });
    for (const m of mecanismos) {
      const uFin = Math.max(m.geo.uTalon1, m.geo.uCuerpo1 + m.carreraMm) + HOLGURA_ALOJ;
      const u0 = m.lado > 0 ? id.fy / 2 : -uFin;
      const u1 = m.lado > 0 ? uFin : -id.fy / 2;
      const wHalf = m.geo.anchoWmm / 2 + HOLGURA_ALOJ;
      const zTop = zPart + m.geo.vAlto + HOLGURA_ALOJ;
      const uIns = id.ify / 2;                                  // borde del inserto
      const uSeat = uIns + 0.5;                                 // borde del asiento en A (L5: +0.5 por lado)
      const cortar = (a: number, b: number) => (m.lado > 0 ? [Math.max(u0, a), Math.min(u1, b)] : [Math.max(u0, -b), Math.min(u1, -a)]);
      const [ci0, ci1] = cortar(0, uIns);
      if (ci1 > ci0) bolsasCav.push({ rect: rectUW(eje, c.cx, c.cy, ci0, ci1, -wHalf, wHalf), z0: zPart, z1: zTop });
      const [ca0, ca1] = cortar(uSeat, 1e6);
      if (ca1 > ca0) bolsasA.push({ rect: rectUW(eje, c.cx, c.cy, ca0, ca1, -wHalf, wHalf), z0: zPart, z1: zTop });
    }
  }

  // ── reconstrucción de los sólidos tocados ──
  const asientoA = cells.map((c) => ({
    rect: { x0: c.cx - (id.ifx + 1) / 2, y0: c.cy - (id.ify + 1) / 2, x1: c.cx + (id.ifx + 1) / 2, y1: c.cy + (id.ify + 1) / 2 },
    z0: zPart, z1: zPart + id.Hc,
  }));
  const cavPlanta = (c: { cx: number; cy: number }): Rect => ({ x0: c.cx - id.ifx / 2, y0: c.cy - id.ify / 2, x1: c.cx + id.ifx / 2, y1: c.cy + id.ify / 2 });
  const grupos = new Map<string, Grupo>();
  const FIJO = ['p-clamp', 'p-A', 'i-cav', 'tornillos'];
  const MOVIL = ['p-bottom', 'p-riel', 'p-support', 'p-B', 'i-core'];
  const EXPULSOR = ['p-ejector', 'p-ejector-ret', 'pines', 'moldeo', 'colada'];

  for (const s of L5.solidos) {
    if (s.id === 'agua') continue;                             // se parte más abajo
    if (s.id === 'colada' && o.tunnel) continue;               // lo reemplaza el runner + túnel
    if (s.id === 'i-cav' && bolsasCav.length) {
      S.push({ ...s, malla: unirMallas(cells.map((c) => mallaPlacaConBolsas(cavPlanta(c), zPart, zPart + id.Hc, bolsasCav))) });
    } else if (s.id === 'p-A' && bolsasA.length) {
      S.push({ ...s, malla: mallaPlacaConBolsas({ x0: 0, y0: 0, x1: W, y1: D }, z.A, z.A + grosor('A'), [...asientoA, ...bolsasA]) });
    } else S.push({ ...s });
    grupos.set(s.id, FIJO.includes(s.id) ? 'fijo' : EXPULSOR.includes(s.id) ? 'expulsor' : 'movil');
  }
  if (bolsasCav.length) ext.push('L6 TALLA la bolsa de la impresión (y el alojamiento del mecanismo) en el inserto de cavidad; L5 lo dibuja macizo con el moldeo encima');

  // ── agua: se parte por la partición para que cada mitad viaje con la suya ──
  const agua = L5.solidos.find((s) => s.id === 'agua');
  let aguaCruzan = 0;
  if (agua) {
    const p = partirMallaPorZ(agua.malla, zPart);
    aguaCruzan = p.cruzan;
    if (p.abajo.indices.length) { S.push({ ...agua, id: 'agua-B', nombre: `${agua.nombre} · mitad móvil`, malla: p.abajo }); grupos.set('agua-B', 'movil'); }
    if (p.arriba.indices.length) { S.push({ ...agua, id: 'agua-A', nombre: `${agua.nombre} · mitad fija`, malla: p.arriba }); grupos.set('agua-A', 'fijo'); }
    if (p.cruzan) avisos.push(`${p.cruzan} triángulo(s) del circuito de agua cruzan la partición: no se pudieron repartir por mitad`);
  }

  // ── PIN CONTORNEADO §11.2.5 (Fig 11.13) ──
  // "the ejector pin is aligned with one side of the rib or wall, and then contoured to
  //  push on the top surface of the feature". Se alinea con la cara INTERIOR de la pared
  //  (la del macho) y sobresale hacia la mejilla: parte de su cara empuja el plástico y
  //  parte hace SHUT-OFF contra el inserto de cavidad — que es de donde sale el criterio
  //  dual del libro (hueco → rebaba · pin largo → se comprime al cerrar).
  // Se coloca en la pared LIBRE de mecanismo: donde hay corredera o núcleo móvil, lo que
  // hay encima de la partición es el alojamiento del mecanismo, no el inserto de cavidad,
  // y el criterio del libro (hueco CONTRA EL INSERTO DE CAVIDAD) no aplicaría.
  // REPARTO DE LAS DOS PAREDES QUE CORTA EL PLANO. Solo hay dos, y las pelean tres
  // rasgos: mecanismo (lo manda el cliente), tunnel gate y pin contorneado. Se reparten
  // en ese orden y lo que no alcanza pared se DECLARA (nunca se encima en silencio).
  const errPin = o.errPinMm ?? 0;
  const dPin = spec.ejectors.diaMm;
  const ocupado = new Set<number>(mecanismos.map((m) => m.lado));
  const ladoTunel: 1 | -1 | null = o.tunnel ? (!ocupado.has(1) ? 1 : !ocupado.has(-1) ? -1 : 1) : null;
  if (ladoTunel) {
    if (ocupado.has(ladoTunel)) avisos.push('el tunnel gate cae en la MISMA pared que un mecanismo: en el molde real van en paredes distintas o a distinto ancho');
    ocupado.add(ladoTunel);
  }
  const ladoPin: 1 | -1 | 0 = !ocupado.has(-1) ? -1 : !ocupado.has(1) ? 1 : 0;
  if (ladoPin === 0) avisos.push('las dos paredes que corta el plano ya llevan mecanismo o compuerta: no queda pared libre para el pin contorneado de §11.2.5 (V11.8 sale SIN CABLEAR)');
  if (ladoPin !== 0) {
    const uPinI = ladoPin * (id.fy / 2 - id.wall);
    const uPinO = uPinI + ladoPin * dPin;
    const pinMallas = cells.map((c) => {
      const r = rectUW(eje, c.cx, c.cy, Math.min(uPinI, uPinO), Math.max(uPinI, uPinO), -dPin / 2, dPin / 2);
      return mallaCaja(r.x0, r.y0, z.ejector, r.x1, r.y1, zPart + errPin);
    });
    S.push({
      id: 'pin-contorneado', nombre: `Pin CONTORNEADO §11.2.5 ${dPin}×${dPin} mm`, rol: 'componente',
      material: '1.2842 templado', nota: `cara a ${errPin === 0 ? 'ras' : `${errPin > 0 ? '+' : ''}${errPin} mm`} de la partición`,
      malla: unirMallas(pinMallas), orden: 55,
    });
    grupos.set('pin-contorneado', 'expulsor');
    ext.push('el pin contorneado se modela de sección CUADRADA (el contorno real sigue la cara de la pared): lo que se mide es su CARA, no su perfil');
  }

  // ── MECANISMOS: sólidos ──
  // ORIGEN del marco (u,v,w): el punto del plano de corte con u=v=0. Sin esto los
  // prismas y conos salen a w=0 del ORIGEN DEL MUNDO y el plano (que está en
  // x=x_sprue) no los toca — se dibujarían vacíos.
  const orig: Vec3 = por(base.w, punto3(plano.p0, base.w));
  for (const m of mecanismos) {
    const L = m.lado, g = m.geo;
    const uu = (x: number) => L * x + uCentro;                  // u absoluto en la sección
    const wN0 = -m.plan.coreWmm / 2, wN1 = m.plan.coreWmm / 2;  // nariz = ancho de la ventana
    const w0 = -g.anchoWmm / 2, w1 = g.anchoWmm / 2;            // cuerpo
    const tanPhi = Math.tan((m.anguloDeg * Math.PI) / 180);
    const vTop = zPart + g.vAlto;
    const poly = (pts: Vec2[], a = w0, b = w1) => mallaPrisma(pts, a, b, base, orig);
    // NARIZ: llena EXACTAMENTE la ventana de la pared (contacto con el macho, sin
    // penetrar el moldeo) — solo en la franja z de la ventana.
    const hf = g.huecoFrontalMm;
    const nariz = poly([[uu(g.uNariz0 + hf), g.ventanaZ0], [uu(g.uNariz1), g.ventanaZ0], [uu(g.uNariz1), g.ventanaZ1], [uu(g.uNariz0 + hf), g.ventanaZ1]], wN0, wN1);
    if (m.tipo === 'corredera') {
      // El pin angular DIVERGE HACIA ABAJO Y HACIA AFUERA (Fig 11.27): su punta, la baja,
      // es la que está más lejos del centro. Solo con ese sentido la apertura empuja la
      // corredera AFUERA: un punto de la corredera va a (u+s, v−d) y la cara de la ranura,
      // paralela al pin, se queda quieta ⟺ s = d·tan φ. Es la ley del mecanismo, y el
      // barrido la verifica: si s no vale d·tan φ, el pin PENETRA su propia ranura.
      const respaldoTop = g.uCuerpo1 - g.vAlto * tanPhi;
      const pinD = m.plan.unit?.pinDiaMm ?? 10;
      const rEff = (pinD / 2) / Math.cos((m.anguloDeg * Math.PI) / 180);   // semiancho en u
      const uPinBase = g.uNariz1 + (g.uCuerpo1 - g.uNariz1) * 0.45;        // eje del pin en la partición
      const holguraRanura = HOLGURA_RANURA_MM;                             // EXTENSIÓN DECLARADA
      // ranura: cara MOTRIZ (la de afuera) en contacto con el pin; holgura por dentro
      const slotBot1 = uPinBase + rEff, slotBot0 = uPinBase - rEff - holguraRanura;
      const slotTop1 = slotBot1 - g.vAlto * tanPhi, slotTop0 = slotBot0 - g.vAlto * tanPhi;
      const bloques: MallaSec[] = [nariz];
      bloques.push(poly([[uu(g.uNariz1), zPart], [uu(slotBot0), zPart], [uu(slotTop0), vTop], [uu(g.uNariz1), vTop]]));
      bloques.push(poly([[uu(slotBot1), zPart], [uu(g.uCuerpo1), zPart], [uu(respaldoTop), vTop], [uu(slotTop1), vTop]]));
      S.push({
        id: m.id, nombre: `Corredera ${m.plan.unit?.code ?? ''} §11.4 (gib + talón)`.replace('  ', ' '),
        rol: 'componente', material: '1.2311 + gib bronce', nota: `carrera ${m.carreraMm} mm · φ ${m.anguloDeg}°`,
        malla: unirMallas(bloques), orden: 56,
      });
      grupos.set(m.id, 'mecanismo');
      // PIN ANGULAR: su PUNTA se coloca para que salga de la ranura EXACTAMENTE cuando la
      // corredera completó su carrera: v_punta = v_tope − S/tan φ. Ni antes (carrera corta)
      // ni después (seguiría levantando y penetraría la ranura).
      const vTip = vTop - m.desengancheMm;
      const vPin1 = zPart + g.vAlto + 18;
      const uAx = (v: number) => uPinBase - (v - zPart) * tanPhi;
      const pin0 = mas(orig, mas(por(base.u, uu(uAx(vTip))), por(base.v, vTip)));
      const pin1 = mas(orig, mas(por(base.u, uu(uAx(vPin1))), por(base.v, vPin1)));
      S.push({
        id: `${m.id}-pin`, nombre: `Pin angular φ ${m.anguloDeg}° ⌀${pinD} (Eq 11.26 L=${m.plan.pinContactMm ?? '—'}+25)`,
        rol: 'componente', material: '1.2842 templado', nota: `desengancha a ${m.desengancheMm.toFixed(1)} mm de apertura`,
        malla: mallaConoEje(pin0, pin1, pinD / 2, pinD / 2, 48), orden: 57,
      });
      grupos.set(`${m.id}-pin`, 'fijo');
      // BLOQUE DE TALÓN: cara paralela al pin, con el hueco declarado al respaldo. El
      // hueco se especifica PERPENDICULAR a la cara (así se mide una holgura entre caras),
      // así que el corrimiento en u vale h/cos φ.
      const h = g.huecoTalonMm;
      const hU = h / Math.cos((m.anguloDeg * Math.PI) / 180);
      const t0 = uu(g.uCuerpo1 + hU), t1 = uu(g.uTalon1 + hU);
      const tTop0 = uu(g.uCuerpo1 + hU - g.vAlto * tanPhi);
      S.push({
        id: `${m.id}-talon`, nombre: `Bloque de talón §11.4 (hueco ${h.toFixed(2)} mm)`, rol: 'componente',
        material: '1.2379', nota: h === 0 ? 'CONTACTO con el respaldo' : 'hueco: la presión carga el pin',
        malla: mallaPrisma([[t0, zPart], [t1, zPart], [t1, vTop], [tTop0, vTop]], w0, w1, base, orig), orden: 56,
      });
      grupos.set(`${m.id}-talon`, 'fijo');
    } else {
      // NÚCLEO MÓVIL (§11.4 Fig 11.24-11.26): la CARA FRONTAL contra el macho y HOLGURA
      // lateral; lo mueve un cilindro (Eq 11.25), no la apertura del molde.
      S.push({
        id: m.id, nombre: `Núcleo móvil §11.4 (cilindro ⌀${m.plan.boreMm ?? '—'} mm, Eq 11.25)`, rol: 'componente',
        material: '1.2343', nota: `F ${m.plan.forceKN} kN (Eq 11.24) · carrera ${m.carreraMm} mm`,
        malla: unirMallas([
          nariz,
          poly([[uu(g.uNariz1), zPart], [uu(g.uCuerpo1), zPart], [uu(g.uCuerpo1), vTop], [uu(g.uNariz1), vTop]]),
        ]), orden: 56,
      });
      grupos.set(m.id, 'mecanismo');
    }
  }

  // ── TUNNEL GATE §7.2.7 (Fig 7.11-7.13) ──
  let tunel: MetaApertura['tunel'] = null;
  if (ladoTunel) {
    const LT = ladoTunel;
    const dT = Math.max(0.4, id.wall / 2);                       // §7.3.2: gate delgado = ½ de la pared
    const offD = o.tunelOffDias ?? TUNEL_OFF_PARTING_DIAS;
    const offMm = offD * dT;
    const ang = TUNEL_ANGULO_DEG, taper = TUNEL_TAPER_MIN_DEG;
    // junta con la pieza: en la cara exterior de la pared, un ⌀ arriba de la partición.
    // El centro de la tapa del cono se corre r·sen45° hacia afuera para que el disco
    // quede TANGENTE a la cara de la pieza: se tocan (el gate nace del moldeo) sin que el
    // modelo reporte una penetración que no existe.
    const O: Vec3 = por(base.w, punto3(plano.p0, base.w));
    const uWall = uCentro + LT * (id.fy / 2);
    const sen = Math.sin((ang * Math.PI) / 180);
    const uJ = uWall + LT * (dT / 2) * sen, vJ = zPart + dT;
    const vR = zPart + offMm;                                    // eje del runner
    const dv = Math.max(dT, vR - vJ);
    const uR = uJ + LT * (dv / Math.tan((ang * Math.PI) / 180));
    const L = Math.hypot(uR - uJ, vR - vJ);
    const rR = dT / 2 + L * Math.tan((taper * Math.PI) / 360);
    const pJ = mas(O, mas(por(base.u, uJ), por(base.v, vJ)));
    const pR = mas(O, mas(por(base.u, uR), por(base.v, vR)));
    S.push({
      id: 'gate-tunel', nombre: `Tunnel gate §7.2.7 ⌀${dT.toFixed(2)} → ${(2 * rR).toFixed(2)} mm`, rol: 'colada',
      material: spec.plastic ?? 'ABS', nota: `${ang}° · taper ${taper}° · ${offD.toFixed(2)}⌀ de la partición`,
      malla: mallaConoEje(pJ, pR, dT / 2, rR, 48), orden: 45,
    });
    grupos.set('gate-tunel', 'fijo');
    const rRun = Math.max(rR * 1.15, dT);
    const runW = 0.5 * Math.min(W, D);
    S.push({
      id: 'runner', nombre: `Runner frío ⌀${(2 * rRun).toFixed(1)} mm (§6.4)`, rol: 'colada', material: spec.plastic ?? 'ABS',
      nota: 'el runner queda en el inserto de CAVIDAD (Fig 7.13)',
      malla: eje === 'x'
        ? mallaCilindro({ eje: 'x', c1: uR, c2: vR, a0: cx - runW / 2, a1: cx + runW / 2, r: rRun, n: 40 })
        : mallaCilindro({ eje: 'y', c1: vR, c2: uR, a0: cy - runW / 2, a1: cy + runW / 2, r: rRun, n: 40 }),
      orden: 45,
    });
    grupos.set('runner', 'fijo');
    tunel = { diaMm: dT, offMm, anguloDeg: ang, taperDeg: taper, uJ, vJ, uR, vR };
    ext.push('la expulsión de la colada del lado A (Fig 7.13 la deja en el inserto de cavidad) NO está modelada: hace falta su propio paquete');
  }

  // ── CARRERAS DEL CICLO ──
  // GEOMÉTRICA (forma cerrada): lo que hay que bajar para que el material moldeado de la
  // mitad móvil libre TODO lo que está arriba de la partición = altura de la pieza sobre
  // la partición + largo de la colada que viaja con ella.
  const molde = S.filter((s) => grupos.get(s.id) === 'expulsor' && (s.rol === 'moldeo' || s.rol === 'colada'));
  let vTopMovil = zPart;
  for (const s of molde) {
    const P = s.malla.positions;
    for (let i = 0; i < P.length; i += 3) {
      const p: Vec3 = [P[i], P[i + 1], P[i + 2]];
      vTopMovil = Math.max(vTopMovil, punto3(p, base.v));
    }
  }
  const aperturaGeom = +(vTopMovil - zPart).toFixed(6);
  const aperturaLibro = moldOpeningStrokeMm(id.dep);             // §6.3.2: 2-3 × altura de pieza
  const aperturaTotal = Math.max(aperturaGeom, aperturaLibro);
  const expulsion = machoH;                                      // libra el macho (mínimo geométrico)
  const dispon = z.support - (z['ejector-ret'] + grosor('ejector-ret'));
  ext.push('la carrera de expulsión se comanda en el MÍNIMO geométrico (= alto del macho): el libro no da regla de carrera de expulsores');

  // ── pares EXCLUIDOS del barrido: barrenos que el modelo de L5 NO resta ──
  const bore = (a: string, bs: string[], porque: string) => { for (const b of bs) excluidos.push({ a, b, porque }); };
  bore('colada', ['p-A', 'p-clamp', 'i-cav'], 'el barreno del bebedero no se resta de las placas (declarado en L5): el componente se dibuja encima');
  bore('pines', ['p-B', 'p-support', 'p-riel', 'i-core', 'p-bottom'], 'el barreno del expulsor no se resta de las placas (declarado en L5)');
  bore('pin-contorneado', ['p-B', 'p-support', 'p-riel', 'i-core', 'p-bottom'], 'el barreno del expulsor no se resta de las placas (declarado en L5)');
  bore('tornillos', ['p-clamp', 'p-A'], 'el barreno del tornillo no se resta de las placas (declarado en L5)');
  for (const gid of ['agua-A', 'agua-B']) bore(gid, ['p-A', 'p-B', 'i-cav', 'i-core', 'p-clamp', 'p-support'], 'la línea de agua es un barreno: no se resta del acero');
  // La impresión REDONDA no se puede tallar con bolsas rectangulares, así que en ese
  // caso el inserto de cavidad se queda MACIZO (convención de L5, Fig 1.6) y todo lo que
  // vive dentro de la impresión —el moldeo y el macho— lo traslapa por construcción. Se
  // excluye SOLO eso: el pin contorneado contra el inserto sigue vigilado, que es el par
  // del que sale V11.8.
  if (round) bore('i-cav', ['moldeo', 'i-core'], 'la impresión REDONDA no se talla en el inserto (L5 lo dibuja macizo con el moldeo encima): sin bolsa, el par daría interferencia falsa');
  for (const m of mecanismos.filter((x) => x.tipo === 'corredera')) {
    bore(`${m.id}-pin`, ['i-cav', 'p-A', 'p-clamp'], 'el barreno del pin angular en la mitad fija no se resta de las placas');
  }

  const meta: MetaApertura = {
    spec, plano, base, eje, cx, cy, zPart, uCentro, id, machoHmm: machoH,
    aperturaTotalMm: aperturaTotal, aperturaGeomMm: aperturaGeom, aperturaLibroMm: aperturaLibro,
    expulsionMm: expulsion, expulsionDisponibleMm: dispon,
    grupos, mecanismos, tunel, errPinMm: errPin, ladoPin, ladoTunel, stackMm: moldStackHeight(spec),
    extensiones: ext, avisos, excluidos,
  };
  void aguaCruzan;
  return { solidos: S, meta };
}

// ─────────────────────────────────────────────────────────────────────────────
// CINEMÁTICA
// ─────────────────────────────────────────────────────────────────────────────

/** Desplazamiento (mm, mundo) de cada sólido para (apertura d, expulsión e).
 *  TODOS los vectores cumplen t·n = 0 (viven en el plano de corte) — el gate lo exige. */
export function cinematica(meta: MetaApertura, d: number, e: number): Map<string, Vec3> {
  const { base } = meta;
  const abajo = por(base.v, -d);
  const expul = por(base.v, -d + e);
  const out = new Map<string, Vec3>();
  for (const [idS, g] of meta.grupos) {
    if (g === 'fijo') out.set(idS, [0, 0, 0]);
    else if (g === 'movil') out.set(idS, abajo);
    else if (g === 'expulsor') out.set(idS, expul);
  }
  for (const m of meta.mecanismos) {
    const s = m.ley(d);
    out.set(m.id, mas(abajo, por(base.u, m.lado * s)));
  }
  return out;
}

/** Las POSES del ciclo (Fig 11.1-11.4). El hito de la pose intermedia NO se elige a
 *  gusto: es el último "suelte" geométrico por debajo de la carrera total (la pieza
 *  librando el inserto de cavidad, o el mecanismo terminando su carrera). */
export function posesDelCiclo(meta: MetaApertura): Pose[] {
  const dTot = meta.aperturaTotalMm, e = meta.expulsionMm;
  const hitos: Array<{ d: number; que: string }> = [];
  if (meta.id.dep > 0 && meta.id.dep < dTot) hitos.push({ d: meta.id.dep, que: 'la pieza libra el inserto de cavidad (d = H_pieza)' });
  for (const m of meta.mecanismos) {
    const dm = m.tipo === 'corredera' ? m.desengancheMm : m.actuaHastaMm;
    if (dm > 0 && dm < dTot) hitos.push({ d: dm, que: m.tipo === 'corredera' ? `el pin angular desengancha (d = S/tan φ = ${dm.toFixed(1)} mm)` : `el cilindro terminó de retraer el núcleo móvil` });
  }
  const hito = hitos.length ? hitos.reduce((a, b) => (b.d > a.d ? b : a)) : { d: dTot / 2, que: 'medio recorrido (no hay hito geométrico por debajo de la carrera total)' };
  return [
    { id: 'cerrado', nombre: 'CERRADO', porque: 'inyección: aquí se juzgan huecos y contactos (V11.8, V11.17, V11.18)', cita: '§11.1 Fig 11.4', aperturaMm: 0, expulsionMm: 0, tMm: 0 },
    { id: 'parcial', nombre: 'PARCIALMENTE ABIERTO', porque: hito.que, cita: '§11.1 Fig 11.1 · §7.2.7 Fig 7.13', aperturaMm: hito.d, expulsionMm: 0, tMm: hito.d },
    { id: 'abierto', nombre: 'TOTALMENTE ABIERTO', porque: `carrera ${meta.aperturaTotalMm.toFixed(1)} mm = max(geométrica ${meta.aperturaGeomMm.toFixed(1)}, §6.3.2 ${meta.aperturaLibroMm.toFixed(1)})`, cita: '§6.3 Tabla 6.1', aperturaMm: dTot, expulsionMm: 0, tMm: dTot },
    { id: 'expulsado', nombre: 'EXPULSORES ACTUADOS', porque: `carrera ${e.toFixed(1)} mm = alto del macho`, cita: '§11.1 Fig 11.2', aperturaMm: dTot, expulsionMm: e, tMm: dTot + e },
  ];
}

/** (d, e) en función del recorrido acumulado t del ciclo */
export const estadoEn = (meta: MetaApertura, t: number): { d: number; e: number } => ({
  d: Math.min(t, meta.aperturaTotalMm), e: Math.max(0, t - meta.aperturaTotalMm),
});

// ─────────────────────────────────────────────────────────────────────────────
// BARRIDO DE INTERFERENCIA
// ─────────────────────────────────────────────────────────────────────────────

export interface PiezaPlana {
  id: string; rol: RolSeccion; nombre: string; nota?: string;
  orden: number;
  lazos: Vec2[][]; bordes: Array<[number, number, number, number]>;
  bbox: { u0: number; u1: number; v0: number; v1: number } | null;
  areaMm2: number;
}

/** la sección del molde CERRADO, aplanada a polígonos (se traslada, no se recorta) */
export function seccionPlana(solidos: SolidoSeccion[], plano: PlanoCorte): { piezas: PiezaPlana[]; sec: Seccion } {
  const sec = seccionarPorPlano(solidos, plano);
  const piezas = sec.piezas.map((p: PiezaSeccionada) => ({
    id: p.id, rol: p.rol, nombre: p.nombre, nota: p.nota, orden: p.orden,
    lazos: p.lazos.map((L) => L.pts.map((q) => [q[0], q[1]] as Vec2)),
    bordes: p.bordes, bbox: p.bbox, areaMm2: p.areaMm2,
  }));
  return { piezas, sec };
}

const trasladar = (p: PiezaPlana, du: number, dv: number): PiezaPlana => ({
  ...p,
  lazos: p.lazos.map((L) => L.map((q) => [q[0] + du, q[1] + dv] as Vec2)),
  bordes: p.bordes.map((b) => [b[0] + du, b[1] + dv, b[2] + du, b[3] + dv] as [number, number, number, number]),
  bbox: p.bbox ? { u0: p.bbox.u0 + du, u1: p.bbox.u1 + du, v0: p.bbox.v0 + dv, v1: p.bbox.v1 + dv } : null,
});

/** desplazamiento (du,dv) de un sólido en el plano, para (d,e) */
export function despPlano(meta: MetaApertura, idS: string, d: number, e: number): [number, number] {
  const t = cinematica(meta, d, e).get(idS) ?? [0, 0, 0];
  return [punto3(t, meta.base.u), punto3(t, meta.base.v)];
}

/** posición de todas las piezas en una pose */
export function piezasEn(meta: MetaApertura, piezas: PiezaPlana[], d: number, e: number): PiezaPlana[] {
  const mov = cinematica(meta, d, e);
  return piezas.map((p) => {
    const t = mov.get(p.id) ?? [0, 0, 0];
    return trasladar(p, punto3(t, meta.base.u), punto3(t, meta.base.v));
  });
}

const CERCA_MM = 30;          // debajo de esto se mide la holgura EXACTA
export const TOL_PENETRACION_MM2 = 1e-6;

/**
 * BARRIDO: todos los pares de sólidos con MOVIMIENTO RELATIVO (grupos distintos),
 * menos los pares EXCLUIDOS por barreno no restado, muestreados a lo largo de TODO el
 * recorrido (apertura + expulsión), con bisección para el arranque de la penetración.
 */
export function barrerRecorrido(meta: MetaApertura, piezas: PiezaPlana[], nMuestras = 200): { pares: ParVigilado[]; muestras: number[] } {
  const vivos = piezas.filter((p) => p.lazos.length);
  const tTot = meta.aperturaTotalMm + meta.expulsionMm;
  const ts = new Set<number>([0, tTot]);
  for (let i = 1; i < nMuestras; i++) ts.add((i / nMuestras) * tTot);
  for (const p of posesDelCiclo(meta)) ts.add(p.tMm);
  for (const m of meta.mecanismos) { ts.add(Math.min(tTot, m.desengancheMm)); ts.add(Math.min(tTot, m.actuaHastaMm)); }
  ts.add(Math.min(tTot, meta.id.dep));
  const T = [...ts].filter((t) => t >= 0 && t <= tTot).sort((a, b) => a - b);

  const exc = new Set(meta.excluidos.map((e) => [e.a, e.b].sort().join('|')));
  const pares: ParVigilado[] = [];
  const dp = (idS: string, t: number) => { const { d, e } = estadoEn(meta, t); return despPlano(meta, idS, d, e); };

  for (let i = 0; i < vivos.length; i++) for (let j = i + 1; j < vivos.length; j++) {
    const A = vivos[i], B = vivos[j];
    const ga = meta.grupos.get(A.id), gb = meta.grupos.get(B.id);
    if (!ga || !gb) continue;
    const mecA = meta.mecanismos.find((m) => m.id === A.id), mecB = meta.mecanismos.find((m) => m.id === B.id);
    if (ga === gb && !mecA && !mecB) continue;                       // sin movimiento relativo
    if (ga === gb && mecA && mecB && mecA.lado === mecB.lado) continue;
    if (exc.has([A.id, B.id].sort().join('|'))) continue;
    let pen = 0, tPen: number | null = null, hMin = Infinity, tH = 0, contacto = false;
    const pene = (t: number) => {
      const [au, av] = dp(A.id, t), [bu, bv] = dp(B.id, t);
      const pa = trasladar(A, au, av), pb = trasladar(B, bu, bv);
      if (!pa.bbox || !pb.bbox) return { a: 0, dist: Infinity };
      const dx = Math.max(pa.bbox.u0 - pb.bbox.u1, pb.bbox.u0 - pa.bbox.u1, 0);
      const dy = Math.max(pa.bbox.v0 - pb.bbox.v1, pb.bbox.v0 - pa.bbox.v1, 0);
      const dbb = Math.hypot(dx, dy);
      if (dbb > CERCA_MM) return { a: 0, dist: Infinity };
      const a = interseccionPoligonos(pa.lazos, pb.lazos).areaMm2;
      return { a, dist: a > TOL_PENETRACION_MM2 ? 0 : distanciaPoligonos(pa.lazos, pb.lazos) };
    };
    for (const t of T) {
      const r = pene(t);
      if (r.a > pen) { pen = r.a; tPen = t; }
      if (r.dist < hMin) { hMin = r.dist; tH = t; }
      if (r.a <= TOL_PENETRACION_MM2 && r.dist <= 1e-9) contacto = true;
    }
    let tArr: number | null = null;
    if (pen > TOL_PENETRACION_MM2 && tPen != null) {
      // bisección: primer t con penetración, entre la última muestra limpia y tPen
      let lo = 0, hi = tPen;
      for (const t of T) if (t < tPen && pene(t).a <= TOL_PENETRACION_MM2) lo = t;
      for (let k = 0; k < 40; k++) {
        const m = (lo + hi) / 2;
        if (pene(m).a > TOL_PENETRACION_MM2) hi = m; else lo = m;
      }
      tArr = hi;
    }
    const estado: ParVigilado['estado'] = pen > TOL_PENETRACION_MM2 ? 'INTERFIERE' : contacto ? 'CONTACTO' : 'OK';
    if (estado === 'OK' && !Number.isFinite(hMin)) continue;         // nunca se acercaron: no ensucia
    pares.push({
      a: A.id, b: B.id, penetracionMaxMm2: +pen.toFixed(6), tPenetracionMm: tPen,
      tArranqueMm: tArr, holguraMinMm: Number.isFinite(hMin) ? +hMin.toFixed(6) : null,
      tHolguraMinMm: Number.isFinite(hMin) ? tH : null, contacto, estado,
    });
  }
  pares.sort((a, b) => (b.penetracionMaxMm2 - a.penetracionMaxMm2) || ((a.holguraMinMm ?? 1e9) - (b.holguraMinMm ?? 1e9)));
  return { pares, muestras: T };
}

// ─────────────────────────────────────────────────────────────────────────────
// VEREDICTOS
// ─────────────────────────────────────────────────────────────────────────────

const buscar = (ps: PiezaPlana[], idS: string) => ps.find((p) => p.id === idS) ?? null;

/** v del borde INFERIOR de una pieza sobre la vertical u (mínimo cruce) — para medir
 *  huecos entre caras con SIGNO, que es lo que pide §11.2.5 (un hueco de 0.05 mm no se
 *  puede leer de un área de intersección sin saber sobre qué ancho se reparte). */
function vInferiorEn(p: PiezaPlana | null, u: number): number {
  if (!p) return NaN;
  let best = NaN;
  for (const L of p.lazos) for (let i = 0; i < L.length; i++) {
    const a = L[i], b = L[(i + 1) % L.length];
    if ((a[0] - u) * (b[0] - u) > 0 || a[0] === b[0]) continue;
    const y = a[1] + ((u - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
    if (Number.isNaN(best) || y < best) best = y;
  }
  return best;
}

/** u extremo de una pieza dentro de una franja v, mirando hacia `lado` (+1 = el mayor u
 *  hacia afuera ⇒ devolvemos el MENOR, que es la cara que mira al centro). */
function extremoU(p: PiezaPlana | null, v0: number, v1: number, lado: 1 | -1, haciaCentro: boolean): number {
  if (!p) return NaN;
  let best = NaN;
  const mejor = (lado > 0) === haciaCentro ? Math.min : Math.max;
  for (const L of p.lazos) for (const q of L) {
    if (q[1] < v0 - 1e-9 || q[1] > v1 + 1e-9) continue;
    best = Number.isNaN(best) ? q[0] : mejor(best, q[0]);
  }
  return best;
}

export function medirApertura(meta: MetaApertura, piezas: PiezaPlana[], pares: ParVigilado[], o: OpcionesApertura): MedidasApertura {
  const V: VeredictoL6[] = [];
  const datos: MedidasApertura['datos'] = {};
  const cerrado = piezasEn(meta, piezas, 0, 0);
  const par = (a: string, b: string) => pares.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a)) ?? null;
  const interfieren = pares.filter((p) => p.estado === 'INTERFIERE');

  // ── V11.1 · las cuatro poses + interferencia a lo largo del recorrido ──
  datos.paresVigilados = pares.length;
  datos.paresInterfieren = interfieren.length;
  datos.paresExcluidos = meta.excluidos.length;
  V.push({
    id: 'V11.1', titulo: 'Cuatro poses del ciclo + interferencia a lo largo del RECORRIDO', cita: '§11.1 · Fig 11.1-11.4',
    estado: interfieren.length ? 'VIOLA' : 'CUMPLE',
    medido: `${pares.length} pares vigilados en ${(meta.aperturaTotalMm + meta.expulsionMm).toFixed(0)} mm de recorrido · ${interfieren.length} chocan`,
    limite: 'penetración de sección = 0 en TODO el recorrido',
    porque: (interfieren.length
      ? `chocan: ${interfieren.slice(0, 3).map((p) => `${p.a}↔${p.b} ${p.penetracionMaxMm2.toFixed(2)} mm² desde ${(p.tArranqueMm ?? 0).toFixed(1)} mm`).join(' · ')}. `
      : 'ninguna pareja con movimiento relativo se penetra en el barrido. ')
      + 'El libro publica Fig 11.1-11.4 SIN criterio de ojo (son descriptivas); lo verificable es justo esto: '
      + `colisiones a lo largo del recorrido. Quedan EXCLUIDOS ${meta.excluidos.length} pares por barrenos que el modelo no resta (se listan al pie).`,
  });

  // ── V11.8 · pin contorneado: hueco contra el inserto de cavidad ──
  const pinP = buscar(cerrado, 'pin-contorneado'), cavP = buscar(cerrado, 'i-cav');
  if (pinP && cavP && pinP.lazos.length && cavP.lazos.length && pinP.bbox) {
    // el hueco se mide DONDE HACE SHUT-OFF: en la mitad del pin que cae sobre la mejilla
    // del inserto (la otra mitad empuja plástico). Distancia CON SIGNO cara a cara:
    // positiva = hueco (rebaba si pasa el venteo) · negativa = pin largo (se comprime).
    const uWall = meta.uCentro + meta.ladoPin * (meta.id.fy / 2);
    const uMid = (Math.max(pinP.bbox.u0, Math.min(uWall, pinP.bbox.u1)) + (meta.ladoPin > 0 ? pinP.bbox.u1 : pinP.bbox.u0)) / 2;
    const vCav = vInferiorEn(cavP, uMid);
    const hueco = vCav - pinP.bbox.v1;
    const inter = interseccionPoligonos(pinP.lazos, cavP.lazos).areaMm2;
    datos.huecoPinMm = +hueco.toFixed(6);
    datos.penetracionPinMm2 = +inter.toFixed(6);
    datos.venteoMm = VENTEO_PARTICION_MM;
    const est: EstadoV = hueco < -1e-9 ? 'VIOLA' : hueco > VENTEO_PARTICION_MM ? 'VIOLA' : 'CUMPLE';
    V.push({
      id: 'V11.8', titulo: 'Pin contorneado: hueco contra el inserto de cavidad vs. espesor de venteo', cita: '§11.2.5 Fig 11.13 · §8.2.3 Fig 8.6',
      estado: est,
      medido: hueco < 0 ? `pin LARGO ${Math.abs(hueco).toFixed(3)} mm (se comprime al cerrar)` : `hueco ${hueco.toFixed(3)} mm`,
      limite: `0 ≤ hueco ≤ ${VENTEO_PARTICION_MM} mm (venteo en la partición, §8.2.3)`,
      porque: hueco < 0
        ? '"if the ejector pin is too long, then the pin will be compressed on mold closure. With repeated ejection cycles, the pin can fatigue and buckle." La penetración la caza el barrido en la pose CERRADA.'
        : hueco > VENTEO_PARTICION_MM
          ? '"if the ejector pin is too short, then a gap will form … If this gap is larger than the thickness of a vent, then flash is likely to occur."'
          : 'la cara del pin queda a ras del inserto de cavidad: ni rebaba ni compresión. Mitigación del libro si se sale: enfoque steel-safe con ajuste de longitud.',
    });
  } else {
    V.push({
      id: 'V11.8', titulo: 'Pin contorneado: hueco contra el inserto de cavidad', cita: '§11.2.5 Fig 11.13',
      estado: 'SIN CABLEAR',
      porque: meta.ladoPin === 0
        ? 'las dos paredes que corta el plano ya llevan mecanismo o compuerta: no queda pared donde poner el pin contorneado de Fig 11.13, y sin él no hay hueco pin↔inserto que medir. En el molde real el pin va en otra pared (otra sección).'
        : 'el plano de corte no cortó el pin contorneado o el inserto de cavidad',
    });
  }

  // ── V11.14 · stripper ──
  const molP = buscar(cerrado, 'moldeo');
  let cobertura: number | null = null;
  if (molP && pinP && molP.bbox && pinP.bbox && meta.ladoPin !== 0) {
    // cuánto del perímetro de empuje (las dos paredes que cruza el corte) toca el pin
    const uPared = meta.uCentro + meta.ladoPin * (meta.id.fy / 2);
    const a = Math.min(uPared, uPared - meta.ladoPin * meta.id.wall), b = Math.max(uPared, uPared - meta.ladoPin * meta.id.wall);
    const solape = Math.max(0, Math.min(pinP.bbox.u1, b) - Math.max(pinP.bbox.u0, a));
    const anchoBoca = 2 * meta.id.wall;                       // las DOS paredes del corte
    cobertura = anchoBoca > 0 ? solape / anchoBoca : null;
    datos.coberturaEmpuje = cobertura != null ? +cobertura.toFixed(3) : null;
  }
  V.push({
    id: 'V11.14', titulo: 'Stripper plate: fuerzas de expulsión alineadas con la fricción en TODO el perímetro', cita: '§11.3.3 · Fig 11.19-11.20',
    estado: 'SIN CABLEAR',
    medido: cobertura != null ? `con pines: cobertura del perímetro de empuje ${(cobertura * 100).toFixed(0)} % (medida en la sección)` : undefined,
    porque: `este molde expulsa con ${meta.spec.ejectors.type} ⌀${meta.spec.ejectors.diaMm} (§11.2). El ensamble stripper de §11.3.3 es OTRO molde `
      + '(placa stripper en la partición, el núcleo la atraviesa) y NO está construido, así que la virtud que promete el libro — '
      + '"uniform ejection forces that are nearly in-line with the friction force between the molding" — no se puede afirmar aquí. No se pinta verde.',
  });

  // ── V11.17 · núcleo móvil: contacto frontal + holgura lateral ──
  const nm = meta.mecanismos.find((m) => m.tipo === 'nucleo-movil');
  if (nm) {
    const nP = buscar(cerrado, nm.id), coreP = buscar(cerrado, 'i-core');
    // FRONTAL: la cara del núcleo que mira al centro vs. la cara del macho, medidas
    // AMBAS dentro de la franja de la ventana (fuera de ella el bloque descansa en la
    // partición y la distancia sería 0 por apoyo, no por sellado).
    const uN = extremoU(nP, nm.geo.ventanaZ0, nm.geo.ventanaZ1, nm.lado, true);
    const uM = extremoU(coreP, nm.geo.ventanaZ0, nm.geo.ventanaZ1, nm.lado, false);
    const dFrente = Math.abs(uN - uM);
    const dLat = nP && cavP ? distanciaPoligonos(nP.lazos, cavP.lazos) : NaN;
    datos.nucleoFrenteMm = +dFrente.toFixed(4); datos.nucleoLateralMm = +dLat.toFixed(4);
    const okF = Math.abs(dFrente) <= 1e-6, okL = dLat > 1e-6;
    V.push({
      id: 'V11.17', titulo: 'Núcleo móvil: contacto en la cara FRONTAL y holgura lateral', cita: '§11.4 · Fig 11.24-11.26',
      estado: okF && okL ? 'CUMPLE' : 'VIOLA',
      medido: `frontal ${dFrente.toFixed(3)} mm (contra el macho) · lateral ${dLat.toFixed(3)} mm (contra el inserto de cavidad) · cilindro ⌀${nm.plan.boreMm ?? '—'} mm para ${nm.plan.forceKN} kN`,
      limite: 'frontal = 0 (contacto) · lateral > 0 (holgura)',
      porque: okF && okL
        ? 'el contacto ocurre en la cara frontal y los costados libran, "so that the entire clamping force of the actuation cylinder is applied to the window core" (§11.4). '
        : `${okF ? '' : 'el núcleo NO cierra contra la cara frontal. '}${okL ? '' : 'topa por los costados: el cilindro no sella la ventana. '}`,
    });
  } else {
    V.push({
      id: 'V11.17', titulo: 'Núcleo móvil para la ventana', cita: '§11.4 · Fig 11.24-11.26', estado: 'SIN CABLEAR',
      porque: meta.mecanismos.length
        ? 'este molde resuelve sus undercuts con corredera de pin angular (§11.3.7 la prefiere cuando la carrera cabe en catálogo): no hay núcleo móvil que juzgar'
        : 'la pieza no declara undercuts: no hay núcleo móvil en este molde',
    });
  }

  // ── V11.18 · corredera: φ ≤ 20° y el talón contacta primero ──
  const co = meta.mecanismos.find((m) => m.tipo === 'corredera');
  if (co) {
    const cP = buscar(cerrado, co.id), tP = buscar(cerrado, `${co.id}-talon`), pP = buscar(cerrado, `${co.id}-pin`);
    // el ángulo se MIDE sobre el pin dibujado: su eje entre la partición y su punta
    let angMed = NaN;
    if (pP && pP.bbox) {
      const dv = pP.bbox.v1 - pP.bbox.v0;
      // el ancho de la sección del pin = ⌀/cos φ + dv·tan φ  ⇒ se despeja midiendo la
      // inclinación del par de aristas más largas
      let mejor = 0, ang = NaN;
      for (const L of pP.lazos) for (let i = 0; i < L.length; i++) {
        const a = L[i], b = L[(i + 1) % L.length];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len > mejor) { mejor = len; ang = Math.abs(Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI); }
      }
      angMed = ang > 90 ? 180 - ang : ang;
      void dv;
    }
    const hueco = cP && tP ? distanciaPoligonos(cP.lazos, tP.lazos) : NaN;
    const holguraPin = cP && pP ? distanciaPoligonos(cP.lazos, pP.lazos) : NaN;
    datos.anguloPinDeg = +angMed.toFixed(3); datos.huecoTalonMm = +hueco.toFixed(4); datos.holguraRanuraMm = +holguraPin.toFixed(4);
    const okAng = angMed <= ANGULO_PIN_MAX_DEG + 1e-9;
    const okTalon = Math.abs(hueco) <= 1e-6;
    V.push({
      id: 'V11.18', titulo: 'Corredera: ángulo del pin ≤ 20° y el bloque de talón contacta primero', cita: '§11.4 · Fig 11.27-11.28',
      estado: okAng && okTalon ? 'CUMPLE' : 'VIOLA',
      medido: `φ medido en el dibujo ${angMed.toFixed(2)}° · hueco talón↔respaldo ${hueco.toFixed(3)} mm · carrera ${co.carreraMm} mm (Eq 11.26: L=${co.plan.pinContactMm}+25 mm)`,
      limite: `φ ≤ ${ANGULO_PIN_MAX_DEG}° · hueco del talón = 0`,
      porque: (okAng ? '' : `φ ${angMed.toFixed(1)}° pasa el límite: el pin angular "is limited to about 20 degrees" o se agarrota. `)
        + (okTalon
          ? 'el talón toca el respaldo con el molde cerrado: la presión de inyección la reacciona el BLOQUE, no el pin. '
          : `quedan ${hueco.toFixed(2)} mm de hueco: la corredera puede correrse y CARGAR EL PIN ANGULAR con la presión de inyección. `)
        + `El barrido verifica además la ley del mecanismo: si la corredera no avanza exactamente d·tan φ, el pin penetra su ranura (par ${co.id}↔pin).`,
    });
  } else {
    V.push({
      id: 'V11.18', titulo: 'Corredera con pin angular', cita: '§11.4 · Fig 11.27-11.28', estado: 'SIN CABLEAR',
      porque: meta.mecanismos.length
        ? 'este molde resuelve su undercut con núcleo móvil ACTUADO (§11.3.7: lo que lleva cilindro es core pull, no corredera)'
        : 'la pieza no declara undercuts: no hay corredera en este molde',
    });
  }

  // ── V7.7 · tunnel gate: las tres cotas + la rotura ──
  if (meta.tunel) {
    const t = meta.tunel;
    const gP = buscar(cerrado, 'gate-tunel');
    // el ÁNGULO y el TAPER se miden sobre el cono dibujado, no sobre la intención
    let angMed = NaN, taperMed = NaN;
    const dJ = t.vR - meta.zPart;                    // eje del runner sobre la partición
    if (gP && gP.lazos.length) {
      // el trapecio del cono: los DOS lados largos son las generatrices, a ±taper/2 del
      // eje. El eje es su bisectriz y el taper incluido su diferencia — ambos MEDIDOS
      // sobre lo dibujado, no sobre la intención.
      const L = gP.lazos.reduce((a, b) => (b.length > a.length ? b : a));
      const lados = L.map((p, i) => ({ a: p, b: L[(i + 1) % L.length] }))
        .map((s) => ({ ...s, len: Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) }))
        .sort((x, y) => y.len - x.len);
      const norma = (s: { a: Vec2; b: Vec2 }) => {
        let x = (Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]) * 180) / Math.PI;
        while (x < 0) x += 180; while (x >= 180) x -= 180; return x;
      };
      const a1 = norma(lados[0]), a2 = norma(lados[1]);
      const bis = (a1 + a2) / 2;
      angMed = Math.min(bis, 180 - bis);
      taperMed = Math.abs(a1 - a2);
      if (taperMed > 90) taperMed = 180 - taperMed;
    }
    const offEnD = dJ / t.diaMm;
    datos.tunelAnguloDeg = +angMed.toFixed(3); datos.tunelTaperDeg = +taperMed.toFixed(3); datos.tunelOffDias = +offEnD.toFixed(3);
    const okA = Math.abs(angMed - TUNEL_ANGULO_DEG) < 0.5;
    const okT = taperMed >= TUNEL_TAPER_MIN_DEG - 1e-6;
    const okO = offEnD >= TUNEL_OFF_PARTING_DIAS - 1e-9;
    const rot = par('gate-tunel', 'moldeo');
    // el AUTO-DEGATING se mide: con el molde apenas abierto (Fig 7.13) la colada tiene
    // que estar SEPARÁNDOSE de la pieza — y sin arrastrarla (penetración 0 en todo el
    // recorrido). Un solo número: la separación en la pose parcial.
    const pParcial = posesDelCiclo(meta)[1];
    const abierto = piezasEn(meta, piezas, pParcial.aperturaMm, 0);
    const gA = buscar(abierto, 'gate-tunel'), mA = buscar(abierto, 'moldeo');
    const sep = gA && mA ? distanciaPoligonos(gA.lazos, mA.lazos) : NaN;
    datos.gateSeparaMm = +sep.toFixed(3);
    const rompe = (!rot || rot.penetracionMaxMm2 <= TOL_PENETRACION_MM2) && sep > 0;
    V.push({
      id: 'V7.7', titulo: 'Tunnel gate: 45° · taper ≥ 20° · ≥ 3⌀ de la partición · y que ROMPA al abrir', cita: '§7.2.7 · Fig 7.12-7.13',
      estado: okA && okT && okO && rompe ? 'CUMPLE' : 'VIOLA',
      medido: `eje ${angMed.toFixed(1)}° · taper incluido ${taperMed.toFixed(1)}° · gate a ${offEnD.toFixed(2)}⌀ (${dJ.toFixed(2)} mm) de la partición · separación colada↔pieza en la pose parcial ${sep.toFixed(2)} mm`,
      limite: `45° · ≥ ${TUNEL_TAPER_MIN_DEG}° · ≥ ${TUNEL_OFF_PARTING_DIAS}⌀`,
      porque: `"a nominal 45 degree angle should be maintained"; "the tunnel gate should have an included taper angle of at least 20"; `
        + `"the tunnel gate should be located at least three tunnel diameters off the parting plane". `
        + (rompe
          ? 'Y el barrido confirma el auto-degating: "the motion of the core insert away from the cavity insert causes the tunnel gate to break at its junction with the molding" — la colada se queda en el lado fijo y la pieza se va con el macho sin arrastrarla.'
          : 'PERO el barrido detecta que la pieza ARRASTRA el gate al bajar: no hay degatado limpio.'),
    });
  } else {
    V.push({
      id: 'V7.7', titulo: 'Tunnel gate: la sección cerrada vs. abierta', cita: '§7.2.7 · Fig 7.12-7.13', estado: 'SIN CABLEAR',
      porque: 'este molde alimenta por BEBEDERO DIRECTO (§6.3.1): no hay tunnel gate que romper. El auto-degating de §7.2.7 solo se puede juzgar con el gate modelado.',
    });
  }

  // ── V6.1 · carrera de apertura medida contra el daylight ──
  const need = daylightNeededMm(meta.stackMm, meta.aperturaTotalMm);
  datos.aperturaGeomMm = +meta.aperturaGeomMm.toFixed(2);
  datos.aperturaLibroMm = +meta.aperturaLibroMm.toFixed(2);
  datos.aperturaTotalMm = +meta.aperturaTotalMm.toFixed(2);
  datos.stackMm = meta.stackMm; datos.daylightNecesarioMm = need;
  const maq = o.maquina ?? null;
  const cabe = maq ? need <= maq.maxDaylightMm && meta.stackMm >= maq.minDaylightMm : null;
  V.push({
    id: 'V6.1', titulo: 'Carrera de apertura en la pose "fully open" vs. daylight', cita: '§6.3 · Tabla 6.1 · §4.3.3 Fig 4.24',
    estado: maq ? (cabe ? 'CUMPLE' : 'VIOLA') : 'SIN CABLEAR',
    medido: `carrera ${meta.aperturaTotalMm.toFixed(1)} mm (geométrica ${meta.aperturaGeomMm.toFixed(1)} = H_pieza + colada; §6.3.2 pide ${OPEN_FACTOR}×H = ${meta.aperturaLibroMm.toFixed(1)}) · stack ${meta.stackMm} → daylight necesario ${need} mm`
      + (maq ? ` · ${maq.nombre} [${maq.minDaylightMm}, ${maq.maxDaylightMm}]` : ''),
    limite: maq ? `${maq.minDaylightMm} ≤ stack y stack+carrera ≤ ${maq.maxDaylightMm} mm` : 'sin máquina no hay banda contra la cual medir',
    porque: `Tabla 6.1: "the three-plate mold has a mold opening distance of ${TABLA_6_1.tresPlacasMm} mm, much greater than the mold opening distance of ${TABLA_6_1.dosPlacasMm} mm for the two-plate mold. This larger mold opening distance is undesirable since it adds to the mold opening and closing time". `
      + (maq ? (cabe ? 'Este molde abre dentro del daylight de la máquina seleccionada.' : 'La máquina seleccionada NO lo admite abierto: el molde cierra pero no abre.')
        : 'No se pasó máquina: la carrera está medida pero NO comparada contra daylight — no cuenta como cumplida.'),
  });

  // ── carrera de expulsión disponible (hallazgo del barrido, §11.1) ──
  datos.expulsionMm = +meta.expulsionMm.toFixed(2);
  datos.expulsionDisponibleMm = +meta.expulsionDisponibleMm.toFixed(2);
  const okStroke = meta.expulsionMm <= meta.expulsionDisponibleMm + 1e-9;
  V.push({
    id: 'V11.1b', titulo: 'Carrera del paquete expulsor vs. hueco del housing', cita: '§11.1 · Fig 11.2',
    estado: okStroke ? 'CUMPLE' : 'VIOLA',
    medido: `necesaria ${meta.expulsionMm.toFixed(1)} mm (alto del macho) · disponible ${meta.expulsionDisponibleMm.toFixed(1)} mm (retenedora → placa de soporte)`,
    limite: 'carrera necesaria ≤ hueco libre del housing',
    porque: okStroke
      ? 'el paquete expulsor tiene recorrido para librar el macho sin tocar la placa de soporte.'
      : `faltan ${(meta.expulsionMm - meta.expulsionDisponibleMm).toFixed(1)} mm: para librar el macho el paquete tendría que atravesar la placa de soporte. `
        + 'Lo caza el barrido como choque placa expulsora ↔ placa de soporte, y es exactamente el tipo de colisión que Fig 11.1-11.4 no muestran pero el recorrido sí.',
  });

  // ── V13.5 · catálogo de secciones de mecanismos avanzados ──
  const dibuja = ['paquete expulsor §11.2'];
  if (meta.ladoPin !== 0) dibuja.push('pin contorneado §11.2.5');
  if (co) dibuja.push('corredera + pin angular + talón §11.4');
  if (nm) dibuja.push('núcleo móvil actuado §11.4');
  if (meta.tunel) dibuja.push('tunnel gate / auto-degating §7.2.7');
  const noDibuja = ['coinyección §13.2', 'gas assist §13.3', 'insert/lost core §13.5-13.6', 'blow §13.7', 'core-back §13.8', 'stack §13.9.3', 'IML §13.9.5', 'núcleo colapsable §13.9.2', 'desenrosque §13.10'];
  datos.mecanismosDibujados = dibuja.length; datos.mecanismosPendientes = noDibuja.length;
  V.push({
    id: 'V13.5', titulo: 'Catálogo: qué secciones de mecanismo SÍ produce este CAD', cita: '§13.2-13.10',
    estado: 'ADVIERTE',
    medido: `${dibuja.length} mecanismos en sección: ${dibuja.join(' · ')}`,
    limite: `faltan ${noDibuja.length}: ${noDibuja.slice(0, 4).join(' · ')}…`,
    porque: 'el libro presenta estas figuras SIN criterio de bueno/malo: valen como catálogo de vistas que el molde debe poder producir. '
      + 'Mientras falten mecanismos del catálogo, esta verificación no puede ir verde.',
  });

  return { veredictos: V, pares, excluidos: meta.excluidos, datos, extensiones: meta.extensiones, avisos: meta.avisos };
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
  .lblXs{fill:#8fa3bd;font:400 9.5px 'JetBrains Mono',monospace}
  .cot{fill:#e9eef5;font:700 11px 'JetBrains Mono',monospace}
  .pose{fill:#e9eef5;font:700 12.5px 'JetBrains Mono',monospace}
`;

const PALETA: Record<RolSeccion, { base: string; linea: string; solido?: boolean }> = {
  placa: { base: '#161e2b', linea: '#7d90ab' },
  inserto: { base: '#20293a', linea: '#a9c2de' },
  componente: { base: '#2b2513', linea: '#d7b23c' },
  moldeo: { base: '#ff9d4d', linea: '#ffd0a0', solido: true },
  agua: { base: '#2aa6e8', linea: '#bfe9ff', solido: true },
  colada: { base: '#e3c96a', linea: '#fff0b8', solido: true },
};
const COLOR_ESTADO: Record<EstadoV, string> = { CUMPLE: '#59d98c', ADVIERTE: '#ffb347', VIOLA: '#ff5c5c', 'SIN CABLEAR': '#8fa3bd' };

/**
 * LÁMINA L6 — la sección del molde en las 3-4 poses del ciclo, con el barrido de
 * interferencia debajo. Devuelve el mismo objeto `Lamina` que el resto del pliego.
 */
export function laminaApertura(o: OpcionesApertura): Lamina & {
  medidas: MedidasApertura; meta: MetaApertura; poses: Pose[]; piezas: PiezaPlana[];
} {
  const W = o.ancho ?? 1560, H = o.alto ?? 1180;
  const { solidos, meta } = solidosApertura(o);
  const { piezas } = seccionPlana(solidos, meta.plano);
  const poses = posesDelCiclo(meta);
  const { pares } = barrerRecorrido(meta, piezas);
  const med = medirApertura(meta, piezas, pares, o);

  // ── encuadre común a las 4 poses (misma escala, misma ventana) ──
  const PADL = 18, TOPP = 108, ALTOP = 664, GAP = 10;
  const TIT = 34, MAIN = 470, DETY = TIT + MAIN + 8, DETH = 116;
  const WP = Math.floor((W - 2 * PADL - 3 * GAP) / 4);
  let bu0 = Infinity, bu1 = -Infinity, bv0 = Infinity, bv1 = -Infinity;
  const porPose = poses.map((p) => piezasEn(meta, piezas, p.aperturaMm, p.expulsionMm));
  for (const lote of porPose) for (const p of lote) {
    if (!p.bbox) continue;
    bu0 = Math.min(bu0, p.bbox.u0); bu1 = Math.max(bu1, p.bbox.u1);
    bv0 = Math.min(bv0, p.bbox.v0); bv1 = Math.max(bv1, p.bbox.v1);
  }
  const anchoMm = (bu1 - bu0) || 1, altoMm = (bv1 - bv0) || 1;
  const k = Math.min((WP - 16) / (anchoMm * 1.02), (MAIN - 10) / (altoMm * 1.02));

  // ── FOCO del detalle: el rasgo chico que a escala de lámina no se lee (un tunnel
  //    gate de ⌀1.25 mm son 1.5 px). Se elige por DATO, no por gusto: manda el gate,
  //    luego el mecanismo, luego el pin contorneado.
  // `sigue` dice en qué marco se encuadra el detalle: con el gate (FIJO) se ve a la pieza
  // irse y romperlo; con un mecanismo hay que ir en la mitad MÓVIL, que es donde el pin
  // angular saliendo y la corredera retrayéndose se ven como movimiento relativo.
  const foco: { u: number; v: number; r: number; tit: string; sigue: 'fijo' | 'movil' } | null = meta.tunel
    ? { u: (meta.tunel.uJ + meta.tunel.uR) / 2, v: (meta.tunel.vJ + meta.tunel.vR) / 2, r: Math.max(5, 3 * meta.tunel.offMm), tit: `DETALLE tunnel gate §7.2.7 · ⌀${meta.tunel.diaMm.toFixed(2)} mm`, sigue: 'fijo' }
    : meta.mecanismos.length
      ? (() => {
        const m = meta.mecanismos[0];
        return { u: meta.uCentro + m.lado * (m.geo.uNariz1 + m.geo.uCuerpo1) / 2, v: meta.zPart + m.geo.vAlto / 2, r: Math.max(12, (m.geo.uTalon1 - m.geo.uNariz0) * 0.62), tit: `DETALLE ${m.tipo} §11.4`, sigue: 'movil' as const };
      })()
      : meta.ladoPin !== 0
        ? { u: meta.uCentro + meta.ladoPin * (meta.id.fy / 2 - meta.id.wall / 2), v: meta.zPart, r: Math.max(8, 1.6 * meta.spec.ejectors.diaMm), tit: 'DETALLE pin contorneado §11.2.5', sigue: 'movil' as const }
        : null;

  // ── achurado por rol (uno por componente, como Fig 1.6) ──
  const defs: string[] = [];
  const relleno = new Map<string, string>();
  const ANG = [45, -45, 25, -25, 65, -65, 35, -35, 55, -55, 30, -30, 60, -60, 50, -50, 40];
  const tinte = (hex: string, f: number) => '#' + [1, 3, 5].map((j) => {
    const v = Math.min(255, Math.round(parseInt(hex.slice(j, j + 2), 16) * (1 + f)));
    return v.toString(16).padStart(2, '0');
  }).join('');
  piezas.forEach((p, i) => {
    const pal = PALETA[p.rol];
    if (pal.solido) { relleno.set(p.id, pal.base); return; }
    const pid = `hx6_${i}`;
    relleno.set(p.id, `url(#${pid})`);
    const paso = (p.rol === 'placa' ? 7 : p.rol === 'inserto' ? 5.5 : 4) + (i % 3) * 1.2;
    defs.push(`<pattern id="${pid}" width="${paso}" height="${paso}" patternUnits="userSpaceOnUse" patternTransform="rotate(${ANG[i % ANG.length]})">`
      + `<rect width="${paso}" height="${paso}" fill="${tinte(pal.base, 0.16 * (i % 3))}"/>`
      + `<line x1="0" y1="0" x2="0" y2="${paso}" stroke="${pal.linea}" stroke-width="0.85" opacity="${0.5 + 0.14 * (i % 3)}"/></pattern>`);
  });
  defs.push('<pattern id="choque" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
    + '<rect width="6" height="6" fill="#ff5c5c" fill-opacity="0.30"/><line x1="0" y1="0" x2="0" y2="6" stroke="#ff5c5c" stroke-width="1.6"/></pattern>');

  // ── los 4 paneles de pose ──
  const cuerpo: string[] = [];
  poses.forEach((pose, ip) => {
    const x0 = PADL + ip * (WP + GAP);
    const cxp = x0 + WP / 2, cyp = TOPP + TIT + MAIN / 2;
    const X = (u: number) => cxp + (u - (bu0 + bu1) / 2) * k;
    const Y = (v: number) => cyp - (v - (bv0 + bv1) / 2) * k;
    cuerpo.push(`<rect x="${x0}" y="${TOPP}" width="${WP}" height="${ALTOP}" fill="#0d1320" stroke="#26314a" stroke-width="1" rx="3"/>`);
    cuerpo.push(`<text class="pose" x="${x0 + 8}" y="${TOPP + 17}">${ip + 1}. ${ESC(pose.nombre)}</text>`);
    cuerpo.push(`<text class="lblXs" style="fill:#c9a227" x="${x0 + 8}" y="${TOPP + 30}">apertura ${pose.aperturaMm.toFixed(1)} · expulsión ${pose.expulsionMm.toFixed(1)} mm · ${ESC(pose.cita)}</text>`);
    const lote = porPose[ip];
    for (const p of lote) {
      if (!p.lazos.length) continue;
      const d = p.lazos.map((L) => 'M' + L.map((q) => `${X(q[0]).toFixed(2)},${Y(q[1]).toFixed(2)}`).join('L') + 'Z').join('');
      cuerpo.push(`<path d="${d}" fill="${relleno.get(p.id)}" fill-rule="evenodd"/>`);
      const bs = p.bordes.map((b) => `M${X(b[0]).toFixed(2)},${Y(b[1]).toFixed(2)}L${X(b[2]).toFixed(2)},${Y(b[3]).toFixed(2)}`).join('');
      cuerpo.push(`<path d="${bs}" fill="none" stroke="${PALETA[p.rol].linea}" stroke-width="${p.rol === 'placa' ? 0.7 : 1}" opacity="0.95"/>`);
    }
    // CHOQUES en esta pose, pintados donde ocurren
    const idx = new Map(lote.map((p) => [p.id, p]));
    let choques = 0;
    for (const pr of pares) {
      if (pr.estado !== 'INTERFIERE') continue;
      const A = idx.get(pr.a), B = idx.get(pr.b);
      if (!A || !B) continue;
      const r = interseccionPoligonos(A.lazos, B.lazos);
      if (r.areaMm2 <= TOL_PENETRACION_MM2) continue;
      choques++;
      for (const q of r.trapecios)
        cuerpo.push(`<path d="M${q.map((t) => `${X(t[0]).toFixed(2)},${Y(t[1]).toFixed(2)}`).join('L')}Z" fill="url(#choque)" stroke="#ff5c5c" stroke-width="0.8"/>`);
    }
    // línea de partición de cada mitad
    const yFija = Y(meta.zPart), yMovil = Y(meta.zPart - pose.aperturaMm);
    cuerpo.push(`<line x1="${x0 + 4}" y1="${yFija.toFixed(1)}" x2="${x0 + WP - 4}" y2="${yFija.toFixed(1)}" stroke="#c9a227" stroke-width="0.9" stroke-dasharray="9 4 2 4" opacity="0.75"/>`);
    if (pose.aperturaMm > 0.01) {
      cuerpo.push(`<line x1="${x0 + 4}" y1="${yMovil.toFixed(1)}" x2="${x0 + WP - 4}" y2="${yMovil.toFixed(1)}" stroke="#c9a227" stroke-width="0.9" stroke-dasharray="9 4 2 4" opacity="0.45"/>`);
      // cota de la apertura
      const xc = x0 + 22;
      cuerpo.push(`<line x1="${xc}" y1="${yFija.toFixed(1)}" x2="${xc}" y2="${yMovil.toFixed(1)}" stroke="#59d98c" stroke-width="1.1"/>`
        + `<path d="M${xc},${yFija.toFixed(1)} l-3,6.5 l6,0 Z" fill="#59d98c"/><path d="M${xc},${yMovil.toFixed(1)} l-3,-6.5 l6,0 Z" fill="#59d98c"/>`
        + `<rect x="${xc + 3}" y="${((yFija + yMovil) / 2 - 34).toFixed(1)}" width="13" height="68" fill="#0b0f16" fill-opacity="0.85" rx="2"/>`
        + `<text class="cot" style="fill:#59d98c" transform="translate(${xc + 13},${((yFija + yMovil) / 2).toFixed(1)}) rotate(-90)" text-anchor="middle">apertura ${pose.aperturaMm.toFixed(1)}</text>`);
    }
    if (pose.expulsionMm > 0.01) {
      const yE0 = Y(meta.zPart - pose.aperturaMm), yE1 = Y(meta.zPart - pose.aperturaMm + pose.expulsionMm);
      const xe = x0 + WP - 26;
      cuerpo.push(`<line x1="${xe}" y1="${yE0.toFixed(1)}" x2="${xe}" y2="${yE1.toFixed(1)}" stroke="#ff9d4d" stroke-width="1.1"/>`
        + `<path d="M${xe},${yE1.toFixed(1)} l-3,6.5 l6,0 Z" fill="#ff9d4d"/>`
        + `<rect x="${xe - 16}" y="${((yE0 + yE1) / 2 - 32).toFixed(1)}" width="13" height="64" fill="#0b0f16" fill-opacity="0.85" rx="2"/>`
        + `<text class="cot" style="fill:#ff9d4d" transform="translate(${xe - 6},${((yE0 + yE1) / 2).toFixed(1)}) rotate(-90)" text-anchor="middle">expulsión ${pose.expulsionMm.toFixed(1)}</text>`);
    }
    // ── recuadro de DETALLE (mismo instante, otra escala) ──
    if (foco) {
      const dx0 = x0 + 8, dy0 = TOPP + DETY, dw = WP - 16, dh = DETH;
      const kz = Math.min(dw / (2 * foco.r * 1.05), dh / (2 * foco.r * 1.05 * (dh / dw)));
      const [sgU, sgV] = foco.sigue === 'movil' ? despPlano(meta, 'p-B', pose.aperturaMm, pose.expulsionMm) : [0, 0];
      const fu = foco.u + sgU, fv = foco.v + sgV;
      const rv = (dh / 2) / kz;
      const DX = (u: number) => dx0 + dw / 2 + (u - fu) * kz;
      const DY = (v: number) => dy0 + dh / 2 - (v - fv) * kz;
      const cid = `clipd${ip}`;
      cuerpo.push(`<clipPath id="${cid}"><rect x="${dx0}" y="${dy0}" width="${dw}" height="${dh}"/></clipPath>`);
      cuerpo.push(`<rect x="${dx0}" y="${dy0}" width="${dw}" height="${dh}" fill="#0a0e17" stroke="none"/>`);
      const g: string[] = [];
      for (const p of lote) {
        if (!p.lazos.length || !p.bbox) continue;
        if (p.bbox.u1 < fu - foco.r || p.bbox.u0 > fu + foco.r || p.bbox.v1 < fv - rv || p.bbox.v0 > fv + rv) continue;
        const d = p.lazos.map((L) => 'M' + L.map((q) => `${DX(q[0]).toFixed(2)},${DY(q[1]).toFixed(2)}`).join('L') + 'Z').join('');
        g.push(`<path d="${d}" fill="${relleno.get(p.id)}" fill-rule="evenodd"/>`);
        const bs = p.bordes.map((b) => `M${DX(b[0]).toFixed(2)},${DY(b[1]).toFixed(2)}L${DX(b[2]).toFixed(2)},${DY(b[3]).toFixed(2)}`).join('');
        g.push(`<path d="${bs}" fill="none" stroke="${PALETA[p.rol].linea}" stroke-width="1.1" opacity="0.95"/>`);
      }
      g.push(`<line x1="${dx0}" y1="${DY(meta.zPart).toFixed(1)}" x2="${dx0 + dw}" y2="${DY(meta.zPart).toFixed(1)}" stroke="#c9a227" stroke-width="0.8" stroke-dasharray="8 4 2 4" opacity="0.7"/>`);
      cuerpo.push(`<g clip-path="url(#${cid})">${g.join('')}</g>`);
      cuerpo.push(`<rect x="${dx0}" y="${dy0}" width="${dw}" height="${dh}" fill="none" stroke="#3a4a66" stroke-width="1"/>`);
      const tt = `${foco.tit} · ×${(kz / k).toFixed(1)}${foco.sigue === 'movil' ? ' · encuadre en la mitad MÓVIL' : ' · encuadre en la mitad FIJA'}`;
      cuerpo.push(`<rect x="${dx0 + 1}" y="${dy0 + 2}" width="${Math.min(dw - 2, tt.length * 5.72 + 8)}" height="13" fill="#0b0f16" fill-opacity="0.88" rx="2"/>`);
      cuerpo.push(`<text class="lblXs" style="fill:#c9a227" x="${dx0 + 5}" y="${dy0 + 12}">${ESC(tt.length > Math.floor((dw - 10) / 5.72) ? tt.slice(0, Math.floor((dw - 10) / 5.72) - 1) + '…' : tt)}</text>`);
    }

    const nCar = Math.floor((WP - 16) / 5.72);        // JetBrains Mono 9.5px ≈ 5.72 px/car
    const crudo = `${choques ? `✗ ${choques} CHOQUE(S) · ` : ''}${pose.porque}`;
    const l1 = crudo.length <= nCar ? crudo : crudo.slice(0, Math.max(1, crudo.lastIndexOf(' ', nCar)));
    const l2raw = crudo.slice(l1.length).trim();
    const l2 = l2raw.length <= nCar ? l2raw : l2raw.slice(0, nCar - 1) + '…';
    cuerpo.push(`<text class="lblXs" style="fill:${choques ? '#ff5c5c' : '#8fa3bd'}" x="${x0 + 8}" y="${TOPP + ALTOP - 20}">${ESC(l1)}</text>`);
    if (l2) cuerpo.push(`<text class="lblXs" style="fill:${choques ? '#ff5c5c' : '#8fa3bd'}" x="${x0 + 8}" y="${TOPP + ALTOP - 8}">${ESC(l2)}</text>`);
  });

  // barra de escala (una sola: las 4 poses comparten escala)
  const escMm = anchoMm > 200 ? 50 : 20;
  const ex0 = PADL + 8, ey = TOPP + ALTOP + 16;
  cuerpo.push(`<line x1="${ex0}" y1="${ey}" x2="${ex0 + escMm * k}" y2="${ey}" stroke="#8fa3bd" stroke-width="1.4"/>`
    + `<line x1="${ex0}" y1="${ey - 4}" x2="${ex0}" y2="${ey + 4}" stroke="#8fa3bd" stroke-width="1.4"/>`
    + `<line x1="${ex0 + escMm * k}" y1="${ey - 4}" x2="${ex0 + escMm * k}" y2="${ey + 4}" stroke="#8fa3bd" stroke-width="1.4"/>`
    + `<text class="lblSm" x="${ex0 + escMm * k + 8}" y="${ey + 4}">${escMm} mm · las 4 poses comparten escala y encuadre</text>`);

  // ── leyenda de componentes (sin ella no se sabe qué es cada achurado) ──
  const LEY_Y = TOPP + ALTOP + 34;
  const vivas = piezas.filter((p) => p.lazos.length);
  const porFila = Math.ceil(vivas.length / 2);
  const anchoCel = Math.floor((W - 2 * PADL) / porFila);
  vivas.forEach((p, i) => {
    const fx0 = PADL + (i % porFila) * anchoCel, fy0 = LEY_Y + Math.floor(i / porFila) * 15;
    cuerpo.push(`<rect x="${fx0}" y="${fy0 - 8}" width="13" height="9" fill="${relleno.get(p.id)}" stroke="${PALETA[p.rol].linea}" stroke-width="0.6"/>`);
    const nm = p.id;
    cuerpo.push(`<text class="lblXs" x="${fx0 + 17}" y="${fy0}">${ESC(nm.length > Math.floor((anchoCel - 20) / 5.72) ? nm.slice(0, Math.floor((anchoCel - 20) / 5.72) - 1) + '…' : nm)}</text>`);
  });

  // ── el BARRIDO: holgura de cada par a lo largo del recorrido ──
  const GY0 = LEY_Y + 46, GH = 150, GX0 = PADL + 62, GX1 = W - PADL - 268;
  const tTot = meta.aperturaTotalMm + meta.expulsionMm;
  const graf: string[] = [];
  const interes = pares.filter((p) => p.estado !== 'OK' || (p.holguraMinMm != null && p.holguraMinMm < 8)).slice(0, 9);
  // el rango se RECORTA a ±8 mm: con una penetración de 50 mm equivalentes, el cero
  // quedaría pegado al techo y las holguras finas (0.5-2 mm) no se leerían. Declarado.
  const yMax = 8, yMin = -8;
  const GX = (t: number) => GX0 + (t / (tTot || 1)) * (GX1 - GX0);
  const GY = (y: number) => GY0 + GH - ((y - yMin) / (yMax - yMin)) * GH;
  graf.push(`<rect x="${GX0}" y="${GY0}" width="${GX1 - GX0}" height="${GH}" fill="#0d1320" stroke="#26314a" stroke-width="1"/>`);
  graf.push(`<rect x="${GX0}" y="${GY(0).toFixed(1)}" width="${GX1 - GX0}" height="${(GY0 + GH - GY(0)).toFixed(1)}" fill="#ff5c5c" fill-opacity="0.10"/>`);
  graf.push(`<line x1="${GX0}" y1="${GY(0).toFixed(1)}" x2="${GX1}" y2="${GY(0).toFixed(1)}" stroke="#ff5c5c" stroke-width="1" stroke-dasharray="4 3"/>`);
  graf.push(`<text class="lblXs" style="fill:#ff5c5c" x="${GX0 - 58}" y="${(GY(0) + 3).toFixed(1)}">0 = contacto</text>`);
  graf.push(`<text class="lblXs" x="${GX0 - 58}" y="${(GY(yMax) + 9).toFixed(1)}">${yMax} mm</text>`);
  graf.push(`<text class="lblXs" style="fill:#ff5c5c" x="${GX0 - 58}" y="${(GY(yMin) - 2).toFixed(1)}">−8 mm</text>`);
  const NS = 160;
  const COLS = ['#59d98c', '#5bc8ff', '#c9a227', '#ff9d4d', '#c58fff', '#7fe3c4', '#ff7ab6', '#9fb3cc', '#e0e6ef'];
  interes.forEach((pr, i) => {
    const pts: string[] = [];
    for (let s = 0; s <= NS; s++) {
      const t = (s / NS) * tTot;
      const { d, e } = estadoEn(meta, t);
      const A = buscar(piezas, pr.a), B = buscar(piezas, pr.b);
      if (!A || !B) break;
      const [au, av] = despPlano(meta, pr.a, d, e), [bu, bv] = despPlano(meta, pr.b, d, e);
      const pa = trasladar(A, au, av), pb = trasladar(B, bu, bv);
      const ar = interseccionPoligonos(pa.lazos, pb.lazos).areaMm2;
      const y = ar > TOL_PENETRACION_MM2 ? -Math.sqrt(ar) : Math.min(yMax, distanciaPoligonos(pa.lazos, pb.lazos));
      pts.push(`${GX(t).toFixed(1)},${GY(Math.min(yMax, Math.max(yMin, y))).toFixed(1)}`);
    }
    graf.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${COLS[i % COLS.length]}" stroke-width="1.4" opacity="0.95"/>`);
    const ly = GY0 + 12 + i * 12.4;
    graf.push(`<line x1="${GX1 + 10}" y1="${ly - 3}" x2="${GX1 + 24}" y2="${ly - 3}" stroke="${COLS[i % COLS.length]}" stroke-width="2"/>`);
    const et = `${pr.a}↔${pr.b} ${pr.estado === 'INTERFIERE' ? `✗ ${pr.penetracionMaxMm2.toFixed(2)} mm²` : pr.estado === 'CONTACTO' ? '· contacto' : `· mín ${(pr.holguraMinMm ?? 0).toFixed(2)} mm`}`;
    graf.push(`<text class="lblXs" style="fill:${pr.estado === 'INTERFIERE' ? '#ff5c5c' : '#c3d0e0'}" x="${GX1 + 28}" y="${ly}">${ESC(et.length > 41 ? et.slice(0, 40) + '…' : et)}</text>`);
  });
  for (const p of poses) {
    graf.push(`<line x1="${GX(p.tMm).toFixed(1)}" y1="${GY0}" x2="${GX(p.tMm).toFixed(1)}" y2="${GY0 + GH}" stroke="#e9eef5" stroke-width="0.6" stroke-dasharray="3 3" opacity="0.5"/>`);
    graf.push(`<text class="lblXs" style="fill:#e9eef5" x="${(GX(p.tMm) + 3).toFixed(1)}" y="${GY0 + GH - 4}">${p.id}</text>`);
  }
  graf.push(`<text class="lblSm" style="fill:#c3d0e0" x="${GX0}" y="${GY0 - 6}">BARRIDO DEL RECORRIDO — holgura de cada par vigilado en función del recorrido acumulado (0 → ${tTot.toFixed(0)} mm). Debajo de 0: penetración, en −√(área de sección). Escala recortada a ±8 mm.</text>`);

  // ── veredictos en tres columnas ──
  const VY0 = GY0 + GH + 26;
  const colW = Math.floor((W - 2 * PADL - 2 * 14) / 3);
  const panel: string[] = [];
  const CH = Math.floor(colW / 6.05);
  const rec = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1) + '…');
  const parte = (s: string, n: number, max: number) => {
    const out: string[] = []; let r = s;
    while (r.length && out.length < max) {
      if (r.length <= n) { out.push(r); break; }
      let c = r.lastIndexOf(' ', n); if (c < n * 0.6) c = n;
      out.push(r.slice(0, c)); r = r.slice(c).trim();
    }
    if (r.length > n && out.length === max) out[max - 1] = rec(out[max - 1] + ' ' + r, n);
    return out;
  };
  const cols: string[][] = [[], [], []];
  const alturas = [0, 0, 0];
  med.veredictos.forEach((v) => {
    const ic = alturas.indexOf(Math.min(...alturas));
    const lineas: Array<{ t: string; c: string; b?: boolean }> = [];
    lineas.push({ t: `${v.id}  ${v.estado}`, c: COLOR_ESTADO[v.estado], b: true });
    for (const t of parte(v.titulo, CH, 2)) lineas.push({ t, c: '#c3d0e0' });
    if (v.medido) for (const t of parte('· ' + v.medido, CH, 3)) lineas.push({ t, c: '#e9eef5' });
    if (v.limite) for (const t of parte('límite: ' + v.limite, CH, 2)) lineas.push({ t, c: '#8fa3bd' });
    for (const t of parte(v.porque, CH, 4)) lineas.push({ t, c: '#7d90ab' });
    cols[ic].push(JSON.stringify({ lineas, col: COLOR_ESTADO[v.estado] }));
    alturas[ic] += lineas.length * 11.6 + 9;
  });
  cols.forEach((cc, ic) => {
    const x = PADL + ic * (colW + 14);
    let y = VY0;
    for (const raw of cc) {
      const { lineas, col } = JSON.parse(raw) as { lineas: Array<{ t: string; c: string; b?: boolean }>; col: string };
      panel.push(`<rect x="${x}" y="${(y - 10).toFixed(1)}" width="3" height="${(lineas.length * 11.6).toFixed(1)}" fill="${col}"/>`);
      for (const L of lineas) {
        panel.push(`<text class="lblXs" style="fill:${L.c}${L.b ? ';font-weight:700' : ''}" x="${x + 9}" y="${y.toFixed(1)}">${ESC(L.t)}</text>`);
        y += 11.6;
      }
      y += 9;
    }
  });

  // ── pie ──
  const sinCablear = med.veredictos.filter((v) => v.estado === 'SIN CABLEAR').map((v) => v.id);
  const viola = med.veredictos.filter((v) => v.estado === 'VIOLA').map((v) => v.id);
  const CHP = Math.floor((W - 2 * PADL) / 6.05);
  const pie: string[] = [];
  let fy = VY0 + Math.max(...alturas) + 14;
  const linea = (txt: string, color: string) => { pie.push(`<text class="lblXs" style="fill:${color}" x="${PADL}" y="${fy}">${ESC(rec(txt, CHP))}</text>`); fy += 12.4; };
  linea(`VEREDICTO ${viola.length ? `ROJO (${viola.join(' · ')})` : sinCablear.length ? `ÁMBAR — hay SIN CABLEAR: ${sinCablear.join(' · ')}` : 'VERDE'}`
    + ` · lo no medido NO cuenta como cumplido`, viola.length ? '#ff5c5c' : sinCablear.length ? '#ffb347' : '#59d98c');
  linea(`PARES EXCLUIDOS DEL BARRIDO (${med.excluidos.length}) — barrenos que el modelo NO resta: `
    + [...new Set(med.excluidos.map((e) => `${e.a}↔${e.b}`))].slice(0, 8).join(' · ') + (med.excluidos.length > 8 ? ' …' : ''), '#8fa3bd');
  const ext = [...new Set(med.extensiones)];
  for (const t of parte('EXTENSIONES DECLARADAS (el libro no las da): ' + ext.join(' · '), CHP, 5)) linea(t, '#8fa3bd');
  if (med.avisos.length) linea('AVISOS: ' + med.avisos.join(' · '), '#ffb347');

  const HH = Math.round(Math.max(H, fy + 16));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${HH}" viewBox="0 0 ${W} ${HH}">
<style>${CSS}</style><defs>${defs.join('')}</defs>
<rect class="bg" width="${W}" height="${HH}"/>
<text class="tit" x="${PADL}" y="32">SECUENCIA DE APERTURA Y EXPULSIÓN · LA MISMA SECCIÓN EN LAS POSES DEL CICLO</text>
<text class="sub" style="font:700 14px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PADL}" y="54">${ESC(rec(o.spec.name, 46))} · base ${o.spec.widthMm}×${plateDepth(o.spec)} mm · corte ⟂ ${meta.eje.toUpperCase()} · ${meta.mecanismos.length ? meta.mecanismos.map((m) => m.tipo).join(' + ') : 'sin mecanismos laterales'} · ${meta.tunel ? 'tunnel gate §7.2.7' : 'bebedero directo §6.3.1'}</text>
<text class="cita" x="${PADL}" y="73">§11.1 Fig 11.1-11.4 · §11.2.5 Fig 11.13 · §11.4 Fig 11.24-11.28 · §7.2.7 Fig 7.12-7.13 · §6.3 Tabla 6.1 · §13.2-13.10</text>
<text class="lblSm" x="${PADL}" y="90">carrera de apertura ${meta.aperturaTotalMm.toFixed(1)} mm (geométrica H_pieza+colada = ${meta.aperturaGeomMm.toFixed(1)}) · expulsión ${meta.expulsionMm.toFixed(1)} mm · ${med.pares.length} pares vigilados a lo largo de ${(meta.aperturaTotalMm + meta.expulsionMm).toFixed(0)} mm · ${med.pares.filter((p) => p.estado === 'INTERFIERE').length} choques</text>
${cuerpo.join('')}
${graf.join('')}
${panel.join('')}
${pie.join('')}
</svg>`;

  return {
    id: 'L6-apertura-expulsion',
    titulo: `Secuencia de apertura y expulsión — ${o.spec.name}`,
    cita: '§11.1 Fig 11.1-11.4 · §11.2.5 Fig 11.13 · §11.3.3 Fig 11.19 · §11.4 Fig 11.24-11.28 · §7.2.7 Fig 7.12-7.13 · §6.3 Tabla 6.1 · §13.2-13.10',
    queMirar: '¿las cuatro poses son la MISMA sección con la mitad móvil desplazada (misma escala y encuadre)? ¿alguna zona sale achurada en ROJO — ahí chocan dos componentes? ¿la curva del barrido de algún par baja de 0 antes de terminar el recorrido? ¿el hueco del pin contorneado cabe en el espesor de venteo? ¿el talón toca el respaldo con el molde cerrado y el pin angular mide ≤ 20°? ¿lo que está en gris dice SIN CABLEAR en vez de fingir verde?',
    svg, medidas: med, meta, poses, piezas,
  };
}
