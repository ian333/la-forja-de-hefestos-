/**
 * L11 — SUPERFICIE DE PARTICIÓN COLOREADA POR ÁNGULO (la regla de 5° de §4.1.3)
 * ============================================================================
 * La lámina cubre TRES verificaciones del pliego, y las tres salen de la misma
 * geometría: la superficie de partición, su ángulo contra la dirección de
 * apertura, y la clasificación visible/oculta heredada de L21.
 *
 *   · V4.5 — §4.1.3 Parting Plane (Fig 4.8 · 4.9 · 4.10). LA COTA DURA, literal:
 *       "interlocking features on the parting plane should be inclined at least
 *        five degrees relative to the mold opening direction."
 *     Riesgos que el libro nombra si no se cumple: "any misalignment… will cause
 *     wear… or an outright impact" y "clamp tonnage… can cause the surfaces to
 *     lock together with extreme force, causing excessive stress."
 *     Métrica que pide la ficha: **% de área de partición por debajo de 5°**.
 *
 *   · V4.4 — §4.1.2 (Fig 4.7, bezel), literal y DESCRIPTIVO (el libro NO lo
 *     califica de bueno ni malo):
 *       "the parting line for the bezel is not in a single plane. Rather, the
 *        parting line follows the profile of the features on the side walls."
 *     Lo medible: la desviación de la línea sobre el eje de apertura. Es un
 *     driver de COSTO declarado en el cap. 3, no una violación.
 *
 *   · V4.6 — §4.1.4 Shut-Offs (Fig 4.11 · 4.12), literal:
 *       "Either location (or even any location in between) would likely be
 *        acceptable since the entire shelf is hidden from view."
 *     El libro dice EXPRESAMENTE que la posición no importa: el predicado es la
 *     VISIBILIDAD. Por eso esta lámina no propone dónde va el shut-off; pinta
 *     DÓNDE PUEDE VIVIR, cruzando la línea de partición con `visibilidad.ts`
 *     (la misma clasificación de L21). Sin esa entrada, V4.6 sale SIN CABLEAR:
 *     lo no medido no se pinta verde.
 *
 * ─── LA DEFINICIÓN DEL ÁNGULO ───────────────────────────────────────────────
 * El libro mide la inclinación del RASGO respecto a la dirección de apertura,
 * no la de su normal. Para un parche de normal n y apertura unitaria d:
 *
 *     θ = asin(|n·d|)      0° = parche PARALELO a la apertura (la pared que se
 *                              traba: el caso que §4.1.3 prohíbe)
 *                         90° = parche PERPENDICULAR (el plano de partición)
 *
 * Verificado analíticamente (ver scripts/mold-particion-angulo-test.cjs): un
 * cono de semiángulo α respecto al eje de apertura da θ = α EXACTO en toda su
 * superficie, y un plano perpendicular a la apertura da 90° en todas partes.
 *
 * ─── DE DÓNDE SALE LA SUPERFICIE (supuesto declarado) ───────────────────────
 * El motor no guarda la superficie de partición como entidad: `splitNoPlano`
 * (parting.ts) la construye como caras sueltas dentro de la cuchilla y las
 * consume en el booleano. Así que:
 *
 *   (a) si el llamador ENTREGA la superficie teselada, se usa tal cual y la
 *       lámina lo dice: origen = "motor".
 *   (b) si no, se DERIVA: se toma la línea de partición con `partingLoops`
 *       (la silueta en la dirección de apertura, el mismo trazado con que el
 *       motor parte el molde) y se extruye la FALDA reglada hacia afuera, en
 *       horizontal, perpendicular a la línea. Origen = "derivada-silueta", y
 *       la lámina lo declara en pantalla.
 *
 * ⚠ EL ANCHO DE LA FALDA IMPORTA y por eso se declara. En una falda reglada, el
 * ángulo crece al alejarse de la línea (el mismo desnivel se reparte en más
 * arco), así que el "% de área bajo 5°" DEPENDE del ancho. Por defecto se usa
 * 30 mm, que es el `marginMm` con el que `splitNoPlano` arma el bloque — una
 * constante del MOTOR, no del libro. Junto a esa métrica se reporta siempre la
 * que NO depende del ancho: el ángulo AL PIE DE LA LÍNEA (la falda en t=0), que
 * es donde las dos mitades realmente se tocan y se traban.
 *
 * PURO: sin OCCT, sin DOM. Devuelve un `Lamina` (SVG string) node-testeable.
 */
import type { Lamina } from './laminas-visuales';
import type { Visibilidad } from './visibilidad';
import { partingLoops } from './parting';

const RAD = 180 / Math.PI;
const ESC = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Misma paleta que el resto de las láminas del pliego (laminas-visuales.ts).
// Se replica aquí porque aquella `CSS` no está exportada y ese archivo es
// compartido: esta lámina no lo toca.
const CSS = `
  .bg{fill:#0b0f16}
  .tit{fill:#e9eef5;font:700 20px 'JetBrains Mono',monospace}
  .sub{fill:#8fa3bd;font:400 13px 'JetBrains Mono',monospace}
  .cita{fill:#c9a227;font:700 13px 'JetBrains Mono',monospace}
  .lbl{fill:#c3d0e0;font:400 12px 'JetBrains Mono',monospace}
  .lblSm{fill:#8fa3bd;font:400 10.5px 'JetBrains Mono',monospace}
  .ok{fill:#59d98c} .mal{fill:#ff5c5c} .warn{fill:#ffb347} .off{fill:#6b7a90}
`;

// ─────────────────────────────────────────────────────────────────────────────
// LAS COTAS — el 5° es del libro; TODO lo demás va etiquetado
// ─────────────────────────────────────────────────────────────────────────────

/** §4.1.3 LITERAL: "…should be inclined at least five degrees relative to the
 *  mold opening direction." Único número del libro en esta lámina. */
export const UMBRAL_INTERLOCK_DEG = 5;

/** Cortes de la escala FIJA. Solo el primero (5°) es criterio del libro; los
 *  demás son subdivisión de LECTURA (EXTENSIÓN DECLARADA) para que el mapa se
 *  pueda leer. Escala FIJA a propósito: Kazmer juzga por UMBRAL, y auto-escalar
 *  por percentiles destruiría el criterio (una pieza pésima se vería uniforme). */
export const CORTES_DEG = [UMBRAL_INTERLOCK_DEG, 10, 30, 60];
export const COLOR_BANDA = ['#d12f3f', '#e8802a', '#e8c62a', '#a8b234', '#59d98c'];
export const ETIQ_BANDA = ['<5°', '5-10°', '10-30°', '30-60°', '60-90°'];

/**
 * EPSILON DE REDONDEO — NO es un margen de diseño.
 *
 * §4.1.3 dice "at LEAST five degrees": un parche construido a 5.000° CUMPLE. Pero el
 * ángulo sale de asin(|n·d|/|n|) sobre un producto cruz, y ahí un valor exactamente
 * 5° aterriza 2 ULP por debajo (medido: 2.7e-15°). Con la comparación cruda, una
 * superficie diseñada justo en la cota salía roja por coma flotante.
 *
 * 1e-9° está SEIS órdenes por encima del ruido de la doble precisión y SEIS por debajo
 * de cualquier ángulo con sentido de manufactura: no relaja el criterio (un parche a
 * 4.999999° sigue reprobando), solo impide que el redondeo lo decida.
 */
export const EPS_ANG_DEG = 1e-9;

/** EXTENSIÓN DECLARADA: el libro no da umbral de planaridad (V4.4 es
 *  descriptivo). Se usa el MISMO corte con que `splitNoPlano` decide entre
 *  partición plana y cuchilla (`ext.zMax - ext.zMin < 0.05`): constante del
 *  MOTOR, citada como tal, jamás presentada como cota de Kazmer. */
export const TOL_PLANA_MM = 0.05;

/** EXTENSIÓN DECLARADA: ancho por defecto de la falda derivada = el `marginMm`
 *  por defecto de `splitNoPlano`. Constante del MOTOR. */
export const FALDA_MM_DEFECTO = 30;

/** PARÁMETRO DE CONSTRUCCIÓN declarado (no del libro): giro en planta a partir del cual
 *  la línea deja de tratarse como curva suave y la falda lleva JUNTA REDONDA. */
export const UMBRAL_ESQUINA_DEG = 20;

export type EstadoV = 'CUMPLE' | 'VIOLA' | 'MEDIDO' | 'SIN CABLEAR';

export interface MallaTri {
  positions: Float32Array | Float64Array | number[];
  indices: Uint32Array | number[];
}

/** Malla de trabajo en el MARCO DE APERTURA. Va en Float64 A PROPÓSITO: el ángulo
 *  sale de DIFERENCIAS de cota entre puntos vecinos de la línea, y ahí el eps de
 *  Float32 (~1e-5 mm sobre coordenadas de 150 mm) se amplifica. Medido: con la malla
 *  en Float32 el ángulo al pie erraba 7.3e-3° contra la fórmula cerrada; en Float64
 *  el error cae a 1e-12°. No cambia ningún veredicto a 5°, pero el gate ya no puede
 *  distinguir un error de mi código de uno de la representación. */
type MallaF64 = { positions: Float64Array; indices: Uint32Array };

export interface EntradaParticionAngulo {
  nombre: string;
  /** dirección de apertura del molde (se normaliza). Por defecto +Z, la del motor. */
  apertura?: [number, number, number];
  /** malla de la PIEZA: de aquí salen la silueta (V4.5), la planaridad (V4.4)
   *  y el cruce con visibilidad (V4.6). */
  pieza?: MallaTri;
  /** superficie de partición YA teselada, si el motor la entrega. Si falta, se DERIVA. */
  superficie?: MallaTri;
  /** clasificación visible/oculta heredada de L21 — `clasificarVisibilidad(pieza, …)`.
   *  DEBE venir de la MISMA malla `pieza` (los índices de triángulo se comparten). */
  visibilidad?: Visibilidad;
  /** ancho de la falda derivada, mm (ver el aviso del encabezado). */
  faldaMm?: number;
  /** anillos en que se subdivide la falda a lo ancho (más = mejor cuadratura del área). */
  faldaAnillos?: number;
  /** se pasan tal cual a `partingLoops` */
  weldMm?: number;
  epsNormal?: number;
}

export interface LoopInfo {
  esExterior: boolean;
  /** puntos en el MARCO DE APERTURA (+Z = apertura) */
  pts: Array<[number, number, number]>;
  perimetro3dMm: number;
  zMin: number; zMax: number;
  /** desviación de la línea SOBRE EL EJE DE APERTURA — la métrica de V4.4 */
  desviacionMm: number;
  /** por vértice: −1 sin cablear · 0 oculto · 1 frontera (silueta) · 2 visible */
  estadoVert: Int8Array;
  longOcultaMm: number; longFronteraMm: number; longVisibleMm: number;
}

export interface Veredicto { id: string; cita: string; estado: EstadoV; texto: string }

export interface ResultadoParticionAngulo {
  nombre: string;
  origen: 'motor' | 'derivada-silueta';
  aperturaUnit: [number, number, number];
  base: { e1: [number, number, number]; e2: [number, number, number]; w: [number, number, number] };
  /** superficie de partición en el MARCO DE APERTURA (+Z = apertura), en Float64 */
  superficie: MallaF64;
  /** ángulo θ = asin(|n·d|) por triángulo, en grados. NaN = triángulo degenerado.
   *  Float64: en Float32 el propio contenedor metía 1.2e-7° de error (medido). */
  degTri: Float64Array;
  areaTri: Float64Array;
  areaTotalMm2: number;
  areaPorBandaMm2: number[];
  /** área de triángulos degenerados (|n|≈0): NO se clasifica, y se declara */
  areaSinClasificarMm2: number;
  areaBajoUmbralMm2: number;
  pctBajoUmbral: number;
  minDeg: number;
  /** métrica INTRÍNSECA (no depende del ancho de la falda): el parche al PIE de
   *  la línea, segmento a segmento. Solo existe si la superficie se derivó. */
  linea: null | {
    degSeg: Float64Array; lenSeg: Float64Array; sSeg: Float64Array;
    zA: Float64Array; zB: Float64Array;
    longTotalMm: number; longBajoUmbralMm: number; pctBajoUmbral: number; minDeg: number;
  };
  /** la pieza en el marco de apertura, para dibujarla de contexto */
  piezaFrame: MallaF64 | null;
  loops: LoopInfo[];
  planaridad: { cableada: boolean; desviacionMm: number; plana: boolean };
  shutoff: {
    cableado: boolean; vistasDeclaradas: boolean; nVistas: number;
    longOcultaMm: number; longFronteraMm: number; longVisibleMm: number; longTotalMm: number;
    areaOcultaPiezaMm2: number; areaPiezaMm2: number;
  };
  faldaMm: number; faldaAnillos: number;
  supuestos: string[];
  avisos: string[];
  veredictos: Veredicto[];
}

// ─────────────────────────────────────────────────────────────────────────────
// GEOMETRÍA
// ─────────────────────────────────────────────────────────────────────────────

type V3 = [number, number, number];

/** Base ortonormal DERECHA (e1, e2, w) con w = apertura. Rotación pura (det=+1),
 *  así que preserva el sentido de las normales — crítico: `partingLoops`
 *  clasifica núcleo/cavidad por el signo de n_z. */
export function baseApertura(d: V3): { e1: V3; e2: V3; w: V3 } {
  const L = Math.hypot(d[0], d[1], d[2]) || 1;
  const w: V3 = [d[0] / L, d[1] / L, d[2] / L];
  const a: V3 = Math.abs(w[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const ad = a[0] * w[0] + a[1] * w[1] + a[2] * w[2];
  let x = a[0] - ad * w[0], y = a[1] - ad * w[1], z = a[2] - ad * w[2];
  const l1 = Math.hypot(x, y, z) || 1; x /= l1; y /= l1; z /= l1;
  const e1: V3 = [x, y, z];
  const e2: V3 = [w[1] * e1[2] - w[2] * e1[1], w[2] * e1[0] - w[0] * e1[2], w[0] * e1[1] - w[1] * e1[0]];
  return { e1, e2, w };
}

function aMarco(m: MallaTri, b: { e1: V3; e2: V3; w: V3 }): MallaF64 {
  const P = m.positions;
  const out = new Float64Array(P.length);
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2];
    out[i] = x * b.e1[0] + y * b.e1[1] + z * b.e1[2];
    out[i + 1] = x * b.e2[0] + y * b.e2[1] + z * b.e2[2];
    out[i + 2] = x * b.w[0] + y * b.w[1] + z * b.w[2];
  }
  return { positions: out, indices: Uint32Array.from(m.indices as ArrayLike<number>) };
}

/**
 * EL ÁNGULO DEL PARCHE contra la dirección de apertura (§4.1.3).
 * θ = asin(|n·d|/|n|) con d unitaria: 0° = paralelo a la apertura, 90° = normal a ella.
 */
export function anguloParcheDeg(n: V3, d: V3): number {
  const L = Math.hypot(n[0], n[1], n[2]);
  if (!(L > 1e-14)) return NaN;
  let c = Math.abs((n[0] * d[0] + n[1] * d[1] + n[2] * d[2]) / L);
  if (c > 1) c = 1;
  return Math.asin(c) * RAD;
}

/** banda de la escala FIJA (0 = <5°, la roja del libro) */
export function bandaDe(deg: number): number {
  let i = 0;
  while (i < CORTES_DEG.length && deg >= CORTES_DEG[i] - EPS_ANG_DEG) i++;
  return i;
}

/** el predicado del libro sobre un parche: ¿está POR DEBAJO de los 5° de §4.1.3? */
export function bajoUmbral(deg: number): boolean {
  return deg < UMBRAL_INTERLOCK_DEG - EPS_ANG_DEG;
}

/** ángulos y áreas por triángulo, con la apertura ya alineada a +Z del marco */
function angulosYAreas(mesh: MallaF64) {
  const P = mesh.positions, I = mesh.indices;
  const nTri = Math.floor(I.length / 3);
  const deg = new Float64Array(nTri);
  const area = new Float64Array(nTri);
  const d: V3 = [0, 0, 1];
  for (let t = 0; t < nTri; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const n: V3 = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    area[t] = Math.hypot(n[0], n[1], n[2]) / 2;
    deg[t] = anguloParcheDeg(n, d);
  }
  return { deg, area };
}

/**
 * LA FALDA REGLADA desde la línea de partición (derivación declarada).
 *
 * Cada punto del lazo se desplaza HORIZONTALMENTE (perpendicular a la línea en
 * planta, hacia afuera) manteniendo SU cota: el mismo criterio con que
 * `splitNoPlano` tiende la falda del lazo al bloque, pero perpendicular a la
 * línea en vez de radial — la proyección radial se auto-interseca en siluetas
 * no convexas y METE ángulos falsos donde el radio va casi tangente al lazo.
 *
 * El ángulo del parche resulta del DESNIVEL de la línea: si sube dz sobre un
 * avance horizontal dh, el parche queda a θ = atan(dh/dz). Escalón vertical
 * (dh→0) ⇒ θ→0° ⇒ ROJO: la pared que §4.1.3 prohíbe.
 */
function faldaDeLoop(pts: V3[], anchoMm: number, anillos: number) {
  const n = pts.length;
  // orientación CCW en planta (para que la normal 2D (t_y,−t_x) salga HACIA AFUERA)
  let a2 = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a2 += p[0] * q[1] - q[0] * p[1];
  }
  const L = a2 >= 0 ? pts : pts.slice().reverse();

  // normal 2D por SEGMENTO
  const segN: Array<[number, number] | null> = [];
  for (let i = 0; i < n; i++) {
    const p = L[i], q = L[(i + 1) % n];
    const tx = q[0] - p[0], ty = q[1] - p[1];
    const l = Math.hypot(tx, ty);
    segN.push(l > 1e-9 ? [ty / l, -tx / l] : null);
  }
  // normal por VÉRTICE = promedio de los dos segmentos que lo tocan (dobla esquinas suaves)
  const vN: Array<[number, number] | null> = [];
  for (let i = 0; i < n; i++) {
    const p = segN[(i - 1 + n) % n], q = segN[i];
    let x = 0, y = 0;
    if (p) { x += p[0]; y += p[1]; }
    if (q) { x += q[0]; y += q[1]; }
    const l = Math.hypot(x, y);
    vN.push(l > 1e-9 ? [x / l, y / l] : null);
  }
  for (let pasada = 0; pasada < 2; pasada++) {
    for (let k = 0; k < n; k++) {
      const i = pasada === 0 ? k : n - 1 - k;
      if (vN[i]) continue;
      const j = pasada === 0 ? (i - 1 + n) % n : (i + 1) % n;
      if (vN[j]) vN[i] = vN[j];
    }
  }
  for (let i = 0; i < n; i++) if (!vN[i]) vN[i] = [1, 0];

  // ESQUINAS EN PLANTA. Con una sola normal promediada por vértice, un quiebre de 90°
  // en planta gira la generatriz 45° dentro de UN solo parche: sale una cuña enorme con
  // un ángulo que no es el de ninguno de los dos lados (se vio en el PNG del bezel, un
  // triángulo oliva más grande que el escalón rojo que debía dominar). En una esquina
  // CONVEXA el offset deja hueco, y lo que corresponde es una JUNTA REDONDA a la COTA
  // DEL VÉRTICE: plana, luego 90°, que es la verdad geométrica (una esquina redondeada
  // de la superficie de partición a altura constante es horizontal).
  // El umbral de 20° es PARÁMETRO DE CONSTRUCCIÓN declarado: por debajo, la línea se
  // trata como curva suave y la normal promediada converge a la superficie reglada.
  const esquina = new Uint8Array(n);
  const giro = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = segN[(i - 1 + n) % n], b = segN[i];
    if (!a || !b) continue;
    const cruz = a[0] * b[1] - a[1] * b[0];
    const punto = a[0] * b[0] + a[1] * b[1];
    const g = Math.atan2(cruz, punto);                     // >0 = convexa (deja hueco)
    giro[i] = g;
    if (g > UMBRAL_ESQUINA_DEG / RAD) esquina[i] = 1;
  }

  const pos: number[] = [], idx: number[] = [];
  const segDeTri: number[] = [], pieDeTri: number[] = [];
  const paso = anchoMm / anillos;
  const push = (p: V3) => { const b = pos.length / 3; pos.push(p[0], p[1], p[2]); return b; };
  const tri = (A: V3, B: V3, C: V3, seg: number, pie: number) => {
    const ia = push(A), ib = push(B), ic = push(C);
    idx.push(ia, ib, ic); segDeTri.push(seg); pieDeTri.push(pie);
  };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p = L[i], q = L[j];
    const na = (esquina[i] && segN[i]) ? segN[i]! : vN[i]!;
    const nb = (esquina[j] && segN[i]) ? segN[i]! : vN[j]!;
    for (let r = 0; r < anillos; r++) {
      const t0 = r * paso, t1 = (r + 1) * paso;
      const A: V3 = [p[0] + na[0] * t0, p[1] + na[1] * t0, p[2]];
      const B: V3 = [q[0] + nb[0] * t0, q[1] + nb[1] * t0, q[2]];
      const C: V3 = [q[0] + nb[0] * t1, q[1] + nb[1] * t1, q[2]];
      const D: V3 = [p[0] + na[0] * t1, p[1] + na[1] * t1, p[2]];
      // (A,B,C) es el triángulo INTERIOR del anillo — el que lleva la cota t0
      tri(A, B, C, i, r === 0 ? 1 : 0);
      tri(A, C, D, i, 0);
    }
  }
  // las JUNTAS de las esquinas convexas, a la cota del vértice (planas ⇒ 90°)
  let nEsq = 0;
  for (let i = 0; i < n; i++) {
    if (!esquina[i]) continue;
    const a = segN[(i - 1 + n) % n]!, p = L[i];
    const pasos = Math.max(2, Math.ceil((giro[i] * RAD) / 12));
    nEsq++;
    for (let k = 0; k < pasos; k++) {
      const g0 = (giro[i] * k) / pasos, g1 = (giro[i] * (k + 1)) / pasos;
      const d0: [number, number] = [a[0] * Math.cos(g0) - a[1] * Math.sin(g0), a[0] * Math.sin(g0) + a[1] * Math.cos(g0)];
      const d1: [number, number] = [a[0] * Math.cos(g1) - a[1] * Math.sin(g1), a[0] * Math.sin(g1) + a[1] * Math.cos(g1)];
      tri(p, [p[0] + d0[0] * anchoMm, p[1] + d0[1] * anchoMm, p[2]],
        [p[0] + d1[0] * anchoMm, p[1] + d1[1] * anchoMm, p[2]], i, 0);
    }
  }
  return {
    malla: { positions: Float64Array.from(pos), indices: Uint32Array.from(idx) },
    segDeTri: Int32Array.from(segDeTri),
    pieDeTri: Uint8Array.from(pieDeTri),
    lazoOrdenado: L,
    nEsquinas: nEsq,
  };
}

/** mapa clave-soldada → triángulos incidentes, con el MISMO redondeo que partingLoops */
function mapaVertTri(mesh: MallaF64, weld: number) {
  const P = mesh.positions, I = mesh.indices;
  const key = (x: number, y: number, z: number) =>
    `${Math.round(x / weld)},${Math.round(y / weld)},${Math.round(z / weld)}`;
  const m = new Map<string, number[]>();
  for (let t = 0; t < I.length / 3; t++) {
    for (let k = 0; k < 3; k++) {
      const v = I[t * 3 + k] * 3;
      const kk = key(P[v], P[v + 1], P[v + 2]);
      const arr = m.get(kk);
      if (arr) { if (arr[arr.length - 1] !== t) arr.push(t); } else m.set(kk, [t]);
    }
  }
  return { m, key };
}

// ─────────────────────────────────────────────────────────────────────────────
// EL ANÁLISIS
// ─────────────────────────────────────────────────────────────────────────────

export function analizarParticionAngulo(inp: EntradaParticionAngulo): ResultadoParticionAngulo {
  const supuestos: string[] = [];
  const avisos: string[] = [];
  const d0: V3 = inp.apertura ?? [0, 0, 1];
  const base = baseApertura(d0);
  const weld = inp.weldMm ?? 1e-3;
  const faldaMm = inp.faldaMm ?? FALDA_MM_DEFECTO;
  const faldaAnillos = Math.max(1, Math.round(inp.faldaAnillos ?? 6));

  const piezaFrame = inp.pieza ? aMarco(inp.pieza, base) : null;

  // ── LOS LAZOS (línea de partición) ────────────────────────────────────────
  const loops: LoopInfo[] = [];
  let extIdx = -1;
  if (piezaFrame) {
    // partingLoops solo INDEXA `positions` (ArrayLike<number>); su firma pide
    // Float32Array|number[] y el marco va en Float64 — el cast es puro tipado.
    const r = partingLoops(
      { positions: piezaFrame.positions as unknown as number[], indices: piezaFrame.indices },
      { weldMm: weld, epsNormal: inp.epsNormal });
    for (const w of r.warnings) avisos.push(`partingLoops: ${w}`);
    r.loops.forEach((L) => {
      const pts = L.pts as V3[];
      let per = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        per += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      }
      loops.push({
        esExterior: L.esExterior, pts, perimetro3dMm: per,
        zMin: L.zMin, zMax: L.zMax, desviacionMm: L.zMax - L.zMin,
        estadoVert: new Int8Array(pts.length).fill(-1),
        longOcultaMm: 0, longFronteraMm: 0, longVisibleMm: 0,
      });
    });
    extIdx = loops.findIndex((L) => L.esExterior);
  }

  // ── LA SUPERFICIE ─────────────────────────────────────────────────────────
  let origen: 'motor' | 'derivada-silueta';
  let superficie: MallaF64;
  let segDeTri: Int32Array | null = null;
  let pieDeTri: Uint8Array | null = null;
  let lazoOrdenado: V3[] | null = null;

  if (inp.superficie) {
    origen = 'motor';
    superficie = aMarco(inp.superficie, base);
    supuestos.push('la superficie de partición la ENTREGÓ el motor: se colorea tal cual, sin derivar nada');
  } else if (extIdx >= 0) {
    origen = 'derivada-silueta';
    const f = faldaDeLoop(loops[extIdx].pts, faldaMm, faldaAnillos);
    superficie = f.malla; segDeTri = f.segDeTri; pieDeTri = f.pieDeTri; lazoOrdenado = f.lazoOrdenado;
    supuestos.push(
      `SUPERFICIE DERIVADA (el motor no la guarda: splitNoPlano la consume en la cuchilla): silueta por partingLoops, ` +
      `${loops[extIdx].pts.length} pts + falda reglada ⊥ a la línea de ${faldaMm} mm (marginMm de splitNoPlano) en ${faldaAnillos} anillos`);
    supuestos.push(
      'el % de ÁREA bajo 5° depende del ancho de falda (el ángulo crece al alejarse de la línea); la métrica ' +
      'independiente del ancho es el ángulo AL PIE DE LA LÍNEA, que también se reporta');
    if (f.nEsquinas > 0) supuestos.push(
      `${f.nEsquinas} quiebre(s) en planta >${UMBRAL_ESQUINA_DEG}° van con JUNTA REDONDA a la cota del vértice: plana, 90°, sin trabe ` +
      '(es la esquina del acero, no una medición de la pieza)');
  } else {
    origen = 'derivada-silueta';
    superficie = { positions: new Float64Array(0), indices: new Uint32Array(0) };
    avisos.push('sin superficie del motor y sin lazo de partición: no hay nada que colorear');
  }

  const { deg, area } = angulosYAreas(superficie);
  const areaPorBandaMm2 = new Array(COLOR_BANDA.length).fill(0);
  let areaTotal = 0, areaSinClas = 0, areaBajo = 0, minDeg = Infinity;
  for (let t = 0; t < deg.length; t++) {
    areaTotal += area[t];
    if (!Number.isFinite(deg[t])) { areaSinClas += area[t]; continue; }
    areaPorBandaMm2[bandaDe(deg[t])] += area[t];
    if (bajoUmbral(deg[t])) areaBajo += area[t];
    if (deg[t] < minDeg) minDeg = deg[t];
  }
  const pctBajoUmbral = areaTotal > 0 ? (areaBajo / areaTotal) * 100 : 0;
  if (areaSinClas > 0) avisos.push(`${areaSinClas.toExponential(2)} mm² en triángulos degenerados: SIN CLASIFICAR (no cuentan como verdes)`);

  // ── LA MÉTRICA INTRÍNSECA: el parche AL PIE de la línea ───────────────────
  let linea: ResultadoParticionAngulo['linea'] = null;
  if (segDeTri && pieDeTri && lazoOrdenado) {
    const nSeg = lazoOrdenado.length;
    const degSeg = new Float64Array(nSeg).fill(NaN);
    const lenSeg = new Float64Array(nSeg);
    const sSeg = new Float64Array(nSeg + 1);
    const zA = new Float64Array(nSeg), zB = new Float64Array(nSeg);
    for (let t = 0; t < deg.length; t++) if (pieDeTri[t]) degSeg[segDeTri[t]] = deg[t];
    let s = 0;
    for (let i = 0; i < nSeg; i++) {
      const p = lazoOrdenado[i], q = lazoOrdenado[(i + 1) % nSeg];
      lenSeg[i] = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
      zA[i] = p[2]; zB[i] = q[2];
      sSeg[i] = s; s += lenSeg[i];
    }
    sSeg[nSeg] = s;
    let lTot = 0, lBajo = 0, mn = Infinity;
    for (let i = 0; i < nSeg; i++) {
      if (!Number.isFinite(degSeg[i])) continue;
      lTot += lenSeg[i];
      if (bajoUmbral(degSeg[i])) lBajo += lenSeg[i];
      if (degSeg[i] < mn) mn = degSeg[i];
    }
    linea = {
      degSeg, lenSeg, sSeg, zA, zB,
      longTotalMm: lTot, longBajoUmbralMm: lBajo,
      pctBajoUmbral: lTot > 0 ? (lBajo / lTot) * 100 : 0,
      minDeg: Number.isFinite(mn) ? mn : NaN,
    };
  }

  // ── V4.4 · PLANARIDAD ─────────────────────────────────────────────────────
  const planaridad = extIdx >= 0
    ? { cableada: true, desviacionMm: loops[extIdx].desviacionMm, plana: loops[extIdx].desviacionMm < TOL_PLANA_MM }
    : { cableada: false, desviacionMm: NaN, plana: false };

  // ── V4.6 · DÓNDE PUEDE VIVIR EL SHUT-OFF (cruce con visibilidad.ts / L21) ──
  const vis = inp.visibilidad;
  const shutoff = {
    cableado: false, vistasDeclaradas: false, nVistas: 0,
    longOcultaMm: 0, longFronteraMm: 0, longVisibleMm: 0, longTotalMm: 0,
    areaOcultaPiezaMm2: NaN, areaPiezaMm2: NaN,
  };
  if (vis && piezaFrame && loops.length) {
    const nTriPieza = Math.floor(piezaFrame.indices.length / 3);
    if (vis.fracMaxTri.length !== nTriPieza) {
      avisos.push(`la visibilidad trae ${vis.fracMaxTri.length} triángulos y la pieza ${nTriPieza}: NO son la misma malla — V4.6 queda SIN CABLEAR`);
    } else {
      shutoff.cableado = true;
      shutoff.vistasDeclaradas = vis.vistasDeclaradas;
      shutoff.nVistas = vis.vistas.length;
      shutoff.areaPiezaMm2 = vis.areaTotalMm2;
      let oculta = 0;
      for (let t = 0; t < nTriPieza; t++) if (vis.fracMaxTri[t] === 0) oculta += vis.areaTri[t];
      shutoff.areaOcultaPiezaMm2 = oculta;

      const { m, key } = mapaVertTri(piezaFrame, weld);
      for (const L of loops) {
        for (let i = 0; i < L.pts.length; i++) {
          const p = L.pts[i];
          const tris = m.get(key(p[0], p[1], p[2]));
          if (!tris || !tris.length) { L.estadoVert[i] = -1; continue; }
          let mx = -Infinity, mn = Infinity;
          for (const t of tris) { const f = vis.fracMaxTri[t]; if (f > mx) mx = f; if (f < mn) mn = f; }
          // 0 OCULTA: ninguna cara que toca la línea se ve — §4.1.4, el shut-off es libre
          // 1 FRONTERA: la línea corre por la SILUETA (una cara se ve, la otra no)
          // 2 VISIBLE: la línea cruza superficie que el usuario ve — el testigo se ve
          L.estadoVert[i] = mx === 0 ? 0 : mn === 0 ? 1 : 2;
        }
        for (let i = 0; i < L.pts.length; i++) {
          const a = L.pts[i], b = L.pts[(i + 1) % L.pts.length];
          const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
          const ea = L.estadoVert[i], eb = L.estadoVert[(i + 1) % L.pts.length];
          if (ea < 0 || eb < 0) continue;                       // sin cablear: no cuenta
          const e = Math.max(ea, eb);                            // el peor de los extremos
          if (e === 0) L.longOcultaMm += len;
          else if (e === 1) L.longFronteraMm += len;
          else L.longVisibleMm += len;
        }
        shutoff.longOcultaMm += L.longOcultaMm;
        shutoff.longFronteraMm += L.longFronteraMm;
        shutoff.longVisibleMm += L.longVisibleMm;
        shutoff.longTotalMm += L.perimetro3dMm;
      }
      if (!vis.vistasDeclaradas) {
        supuestos.push('las vistas de uso NO vienen del cliente: manda el supuesto de la taza de visibilidad.ts (hemisferio superior + costados, sin la base)');
      }
    }
  }

  // ── LOS VEREDICTOS ────────────────────────────────────────────────────────
  const veredictos: Veredicto[] = [];
  if (areaTotal <= 0) {
    veredictos.push({ id: 'V4.5', cita: '§4.1.3 · Fig 4.8-4.10', estado: 'SIN CABLEAR', texto: 'sin superficie de partición: no hay ángulo que medir' });
  } else if (areaBajo > 0) {
    veredictos.push({
      id: 'V4.5', cita: '§4.1.3 · Fig 4.8-4.10', estado: 'VIOLA',
      texto: `${pctBajoUmbral.toFixed(2)} % del área (${areaBajo.toFixed(1)} mm²) bajo 5° · parche más tumbado ${minDeg.toFixed(2)}°` +
        (linea ? ` · al pie: ${linea.pctBajoUmbral.toFixed(2)} % de la línea` : ''),
    });
  } else {
    veredictos.push({
      id: 'V4.5', cita: '§4.1.3 · Fig 4.8-4.10', estado: 'CUMPLE',
      texto: `0 % del área bajo 5° · parche más tumbado ${minDeg.toFixed(2)}°` +
        (linea ? ` · mínimo al pie de la línea ${linea.minDeg.toFixed(2)}°` : ''),
    });
  }
  veredictos.push(planaridad.cableada
    ? {
      id: 'V4.4', cita: '§4.1.2 · Fig 4.7', estado: 'MEDIDO',
      texto: `Δz sobre el eje de apertura ${planaridad.desviacionMm.toFixed(3)} mm → ` +
        `${planaridad.plana ? 'PLANA' : 'NO PLANA'} · §4.1.2 DESCRIBE, no califica: driver de costo (cap. 3)`,
    }
    : { id: 'V4.4', cita: '§4.1.2 · Fig 4.7', estado: 'SIN CABLEAR', texto: 'sin malla de la pieza no hay línea de partición que medir' });
  if (!shutoff.cableado) {
    veredictos.push({
      id: 'V4.6', cita: '§4.1.4 · Fig 4.11-4.12', estado: 'SIN CABLEAR',
      texto: 'falta la clasificación de L21 (visibilidad.ts): sin ese dato NO se pinta ninguna zona libre',
    });
  } else if (shutoff.longVisibleMm > 0) {
    veredictos.push({
      id: 'V4.6', cita: '§4.1.4 · Fig 4.11-4.12', estado: 'VIOLA',
      texto: `${shutoff.longVisibleMm.toFixed(1)} mm de línea cruzan superficie que el usuario VE: ningún shut-off sirve ahí`,
    });
  } else if (shutoff.longOcultaMm > 0) {
    veredictos.push({
      id: 'V4.6', cita: '§4.1.4 · Fig 4.11-4.12', estado: 'CUMPLE',
      texto: `${shutoff.longOcultaMm.toFixed(1)} mm de línea OCULTA — "the entire shelf is hidden from view": cualquier ubicación sirve`,
    });
  } else {
    veredictos.push({
      id: 'V4.6', cita: '§4.1.4 · Fig 4.11-4.12', estado: 'MEDIDO',
      texto: `la línea corre por la SILUETA (${shutoff.longFronteraMm.toFixed(1)} mm): el testigo cae en el canto · zona libre ${shutoff.areaOcultaPiezaMm2.toFixed(0)} mm²`,
    });
  }

  return {
    nombre: inp.nombre, origen, aperturaUnit: base.w, base,
    superficie, degTri: deg, areaTri: area, areaTotalMm2: areaTotal,
    areaPorBandaMm2, areaSinClasificarMm2: areaSinClas, areaBajoUmbralMm2: areaBajo,
    pctBajoUmbral, minDeg: Number.isFinite(minDeg) ? minDeg : NaN,
    linea, piezaFrame, loops, planaridad, shutoff,
    faldaMm, faldaAnillos, supuestos, avisos, veredictos,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LA LÁMINA
// ─────────────────────────────────────────────────────────────────────────────

// La LÍNEA se pinta con tonos FUERA de la rampa de bandas: con el verde #59d98c de la
// banda 60-90° encima de una falda toda verde, la línea desaparecía (se vio en el PNG de
// la taza). Además va con halo oscuro para leerse sobre cualquier fondo.
const COL_LINEA = ['#25f0c0', '#ffd24d', '#ff4d6d'];        // oculta · frontera · visible
const HALO_LINEA = '#05080d';
const ETIQ_LINEA = ['oculta: shut-off libre', 'frontera/silueta', 'visible: deja testigo'];

/** vista oblicua fija, mirando desde arriba: +Z (la apertura) queda ARRIBA en la lámina */
const VISTA: V3 = [-0.62, -0.62, -0.48];

function proyeccion(box: { x: number; y: number; w: number; h: number }, pts: Float64Array[]) {
  const L = Math.hypot(VISTA[0], VISTA[1], VISTA[2]);
  const w: V3 = [VISTA[0] / L, VISTA[1] / L, VISTA[2] / L];
  const dz = w[2];
  let vx = -dz * w[0], vy = -dz * w[1], vz = 1 - dz * w[2];
  const lv = Math.hypot(vx, vy, vz) || 1; vx /= lv; vy /= lv; vz /= lv;
  const v: V3 = [vx, vy, vz];
  const u: V3 = [v[1] * w[2] - v[2] * w[1], v[2] * w[0] - v[0] * w[2], v[0] * w[1] - v[1] * w[0]];
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const P of pts) for (let i = 0; i < P.length; i += 3) {
    const su = P[i] * u[0] + P[i + 1] * u[1] + P[i + 2] * u[2];
    const sv = P[i] * v[0] + P[i + 1] * v[1] + P[i + 2] * v[2];
    if (su < u0) u0 = su; if (su > u1) u1 = su;
    if (sv < v0) v0 = sv; if (sv > v1) v1 = sv;
  }
  if (!Number.isFinite(u0)) { u0 = -1; u1 = 1; v0 = -1; v1 = 1; }
  const k = Math.min(box.w / ((u1 - u0) || 1), box.h / ((v1 - v0) || 1)) * 0.92;
  const cx = box.x + box.w / 2 - ((u0 + u1) / 2) * k;
  const cy = box.y + box.h / 2 + ((v0 + v1) / 2) * k;
  const px = (x: number, y: number, z: number): [number, number] =>
    [cx + (x * u[0] + y * u[1] + z * u[2]) * k, cy - (x * v[0] + y * v[1] + z * v[2]) * k];
  const dep = (x: number, y: number, z: number) => x * w[0] + y * w[1] + z * w[2];
  return { px, dep, u, v, w, k };
}

/**
 * L11 · LA LÁMINA. Tres paneles:
 *   izquierda  — la superficie de partición en vista oblicua, coloreada por banda
 *                de ángulo (escala FIJA anclada al 5°), con la pieza de contexto
 *                y la línea de partición pintada por su estado de visibilidad.
 *   arriba-der — área por banda (la métrica de V4.5, en barras).
 *   abajo-der  — el perfil z(s) de la línea (V4.4), coloreado por la MISMA banda:
 *                se ve de un vistazo qué escalón produce cada parche rojo.
 */
export function laminaParticionAngulo(r: ResultadoParticionAngulo): Lamina {
  const W = 1000, H = 760, PAD = 46;
  const ANCHO_UTIL = W - 2 * PAD;
  const VIS = { x: PAD, y: 132, w: 592, h: 420 };
  const CX0 = 664, CW = W - PAD - CX0;
  const CH1 = { x: CX0, y: 140, w: CW, h: 180 };
  const CH2 = { x: CX0, y: 340, w: CW, h: 212 };
  const Y_LEG = 574, Y_VER = 602, Y_PIE = 656, Y_SUP = 686;

  const f1 = (x: number) => x.toFixed(1);
  /** recorte por ANCHO REAL: JetBrains Mono es monoespaciada (avance ≈ 0.6·em), así que
   *  el presupuesto de caracteres se calcula, no se adivina. Sin esto el texto se salía
   *  del cuadro por la derecha — se vio en el PNG. */
  const cupo = (px: number, fontPx: number) => Math.max(8, Math.floor(px / (fontPx * 0.6)));
  const cortar = (s: string, px: number, fontPx: number) =>
    s.length <= cupo(px, fontPx) ? s : s.slice(0, cupo(px, fontPx) - 1) + '…';
  /** parte en palabras: un SUPUESTO no se recorta — si no cabe, se envuelve. Recortarlo
   *  sería esconder justo la letra chica que hace honesta la lámina. */
  const envolver = (s: string, px: number, fontPx: number) => {
    const max = cupo(px, fontPx), out: string[] = [];
    let cur = '';
    for (const w of s.split(' ')) {
      if (cur && (cur + ' ' + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
    }
    if (cur) out.push(cur);
    return out;
  };

  // ── PANEL 3D ──────────────────────────────────────────────────────────────
  const nubes: Float64Array[] = [r.superficie.positions];
  if (r.piezaFrame) nubes.push(r.piezaFrame.positions);
  const pr = proyeccion(VIS, nubes);
  /** El pintor por sí solo NO basta para la línea de partición: la línea vive sobre la
   *  arista que comparten pieza y falda, así que cualquier orden la deja medio borrada
   *  por el relleno de la cara vecina (se vio en el PNG: la línea aparecía como un
   *  hilo y el tramo de atrás se colaba encima de la pieza). Se resuelve como en L21:
   *  un Z-BUFFER de la escena y la línea encima, dibujando solo lo que de verdad se ve. */
  type Trazo = { z: number; svg: string };
  const trazos: Trazo[] = [];
  let spanEscena = 1;
  {
    let z0 = Infinity, z1 = -Infinity;
    for (const P of nubes) for (let i = 0; i < P.length; i += 3) {
      const d = pr.dep(P[i], P[i + 1], P[i + 2]);
      if (d < z0) z0 = d; if (d > z1) z1 = d;
    }
    if (Number.isFinite(z0) && z1 > z0) spanEscena = z1 - z0;
  }
  const RB = 3;                                            // mm→px: celda del z-buffer
  const rw = Math.max(1, Math.ceil(VIS.w / RB)), rh = Math.max(1, Math.ceil(VIS.h / RB));
  const zbuf = new Float64Array(rw * rh).fill(Infinity);

  const pintarMalla = (m: MallaF64, colorDe: (t: number, nx: number, ny: number, nz: number, nl: number) => string) => {
    const P = m.positions, I = m.indices;
    for (let t = 0; t < I.length / 3; t++) {
      const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz) || 1;
      const col = colorDe(t, nx, ny, nz, nl);
      const A: V3 = [P[a], P[a + 1], P[a + 2]], B: V3 = [P[b], P[b + 1], P[b + 2]], C: V3 = [P[c], P[c + 1], P[c + 2]];
      // El algoritmo del pintor ordena por profundidad de un solo punto: con un triángulo
      // MUY hondo (una pared de 2 triángulos de 90 mm de alto) su centroide queda detrás
      // de cosas que en pantalla tapa, y la falda se dibujaba ENCIMA de la pieza (se vio
      // en el PNG del corte inclinado). Se parte en 4 mientras su rango de profundidad
      // pase del 20 % de la escena, hasta 2 niveles: el pintor vuelve a ser válido y
      // en una malla normal no se subdivide nada.
      const emitir = (p: V3, q: V3, s2: V3, nivel: number) => {
        const dp = pr.dep(p[0], p[1], p[2]), dq = pr.dep(q[0], q[1], q[2]), ds = pr.dep(s2[0], s2[1], s2[2]);
        const qa = pr.px(p[0], p[1], p[2]), qb = pr.px(q[0], q[1], q[2]), qc = pr.px(s2[0], s2[1], s2[2]);
        // ...y solo si además es GRANDE en pantalla: un triángulo de 3 px no puede
        // producir un error de orden visible, y subdividirlo solo infla el SVG
        const lado = Math.max(Math.max(qa[0], qb[0], qc[0]) - Math.min(qa[0], qb[0], qc[0]),
          Math.max(qa[1], qb[1], qc[1]) - Math.min(qa[1], qb[1], qc[1]));
        if (nivel < 2 && lado > 10 && Math.max(dp, dq, ds) - Math.min(dp, dq, ds) > 0.20 * spanEscena) {
          const m1: V3 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
          const m2: V3 = [(q[0] + s2[0]) / 2, (q[1] + s2[1]) / 2, (q[2] + s2[2]) / 2];
          const m3: V3 = [(s2[0] + p[0]) / 2, (s2[1] + p[1]) / 2, (s2[2] + p[2]) / 2];
          emitir(p, m1, m3, nivel + 1); emitir(m1, q, m2, nivel + 1);
          emitir(m3, m2, s2, nivel + 1); emitir(m1, m2, m3, nivel + 1);
          return;
        }
        trazos.push({
          z: (dp + dq + ds) / 3,
          svg: `<path d="M${f1(qa[0])} ${f1(qa[1])}L${f1(qb[0])} ${f1(qb[1])}L${f1(qc[0])} ${f1(qc[1])}Z" fill="${col}" stroke="${col}" stroke-width="0.5"/>`,
        });
      };
      emitir(A, B, C, 0);
      const pa = pr.px(P[a], P[a + 1], P[a + 2]), pb = pr.px(P[b], P[b + 1], P[b + 2]), pc = pr.px(P[c], P[c + 1], P[c + 2]);
      const da = pr.dep(P[a], P[a + 1], P[a + 2]), db = pr.dep(P[b], P[b + 1], P[b + 2]), dc = pr.dep(P[c], P[c + 1], P[c + 2]);
      // z-buffer en celdas (baricéntrico, gana el más cercano)
      const ax = (pa[0] - VIS.x) / RB, ay = (pa[1] - VIS.y) / RB;
      const bx = (pb[0] - VIS.x) / RB, by = (pb[1] - VIS.y) / RB;
      const cx = (pc[0] - VIS.x) / RB, cy = (pc[1] - VIS.y) / RB;
      const e = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(e) < 1e-12) continue;
      const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), i1 = Math.min(rw - 1, Math.ceil(Math.max(ax, bx, cx)));
      const j0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), j1 = Math.min(rh - 1, Math.ceil(Math.max(ay, by, cy)));
      for (let jy = j0; jy <= j1; jy++) for (let ix = i0; ix <= i1; ix++) {
        const qx = ix + 0.5, qy = jy + 0.5;
        const l0 = ((bx - qx) * (cy - qy) - (by - qy) * (cx - qx)) / e;
        const l1 = ((cx - qx) * (ay - qy) - (cy - qy) * (ax - qx)) / e;
        const l2 = 1 - l0 - l1;
        if (l0 < -1e-9 || l1 < -1e-9 || l2 < -1e-9) continue;
        const d = l0 * da + l1 * db + l2 * dc;
        const k = jy * rw + ix;
        if (d < zbuf[k]) zbuf[k] = d;
      }
    }
  };

  if (r.piezaFrame) {
    const Lz: V3 = [0.30, 0.42, 0.86];
    const ll = Math.hypot(Lz[0], Lz[1], Lz[2]);
    pintarMalla(r.piezaFrame, (_t, nx, ny, nz, nl) => {
      const lam = Math.max(0, (nx * Lz[0] + ny * Lz[1] + nz * Lz[2]) / (nl * ll));
      const s = 0.42 + 0.58 * lam;
      return `rgb(${Math.round(52 * s)},${Math.round(70 * s)},${Math.round(96 * s)})`;
    });
  }
  pintarMalla(r.superficie, (t) => Number.isFinite(r.degTri[t]) ? COLOR_BANDA[bandaDe(r.degTri[t])] : '#6b7a90');
  trazos.sort((a, b) => b.z - a.z);                        // lo lejano primero
  const escena = trazos.map((t) => t.svg).join('');

  // la línea de partición ENCIMA, pero solo donde el z-buffer dice que se ve.
  // Tolerancia = la variación de profundidad que cabe en una celda (no un número mágico).
  const tolZ = 2.5 * RB / (pr.k || 1);
  const seVe = (p: V3) => {
    const q = pr.px(p[0], p[1], p[2]);
    const ix = Math.floor((q[0] - VIS.x) / RB), jy = Math.floor((q[1] - VIS.y) / RB);
    if (ix < 0 || jy < 0 || ix >= rw || jy >= rh) return false;
    const df = zbuf[jy * rw + ix];
    return !Number.isFinite(df) || pr.dep(p[0], p[1], p[2]) <= df + tolZ;
  };
  const lineas: string[] = [], halos: string[] = [];
  for (const L of r.loops) {
    for (let i = 0; i < L.pts.length; i++) {
      const a = L.pts[i], b = L.pts[(i + 1) % L.pts.length];
      const md: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      if (!seVe(a) && !seVe(b) && !seVe(md)) continue;     // tramo tapado por la pieza
      const ea = L.estadoVert[i], eb = L.estadoVert[(i + 1) % L.pts.length];
      const e = ea < 0 || eb < 0 ? -1 : Math.max(ea, eb);
      const col = e < 0 ? '#6b7a90' : COL_LINEA[e];
      const pa = pr.px(a[0], a[1], a[2]), pb = pr.px(b[0], b[1], b[2]);
      const gw = L.esExterior ? 2.6 : 1.8;
      const g = `x1="${f1(pa[0])}" y1="${f1(pa[1])}" x2="${f1(pb[0])}" y2="${f1(pb[1])}"`;
      halos.push(`<line ${g} stroke="${HALO_LINEA}" stroke-width="${gw + 2.6}" stroke-linecap="round"/>`);
      lineas.push(`<line ${g} stroke="${col}" stroke-width="${gw}" stroke-linecap="round"/>`);
    }
  }

  // ── CHART 1 · ÁREA POR BANDA ──────────────────────────────────────────────
  const maxB = Math.max(1e-9, ...r.areaPorBandaMm2);
  const bh = 22, bgap = 8, wBar = CW - 104;
  const barras = COLOR_BANDA.map((c, i) => {
    const y = CH1.y + 26 + i * (bh + bgap);
    const pct = r.areaTotalMm2 > 0 ? (r.areaPorBandaMm2[i] / r.areaTotalMm2) * 100 : 0;
    // ancho mínimo VISIBLE para una banda no vacía: con escala lineal, un 0.7 % de área
    // roja (que YA es una violación de §4.1.3) desaparecía del gráfico
    const wpx = r.areaPorBandaMm2[i] <= 0 ? 0 : Math.max(5, (r.areaPorBandaMm2[i] / maxB) * wBar);
    return `<text class="lblSm" x="${CH1.x}" y="${y + 15}" style="fill:${c}">${ESC(ETIQ_BANDA[i])}</text>`
      + (wpx > 0 ? `<rect x="${CH1.x + 52}" y="${y}" width="${wpx.toFixed(1)}" height="${bh}" fill="${c}"/>` : '')
      + `<text class="lblSm" x="${CH1.x + 56 + wpx}" y="${y + 15}">${pct.toFixed(pct > 0 && pct < 0.1 ? 3 : 1)} %</text>`;
  }).join('');

  // ── CHART 2 · PERFIL z(s) DE LA LÍNEA (V4.4) ──────────────────────────────
  let perfil: string;
  const ext = r.loops.find((L) => L.esExterior);
  if (ext && r.linea) {
    const li = r.linea;
    const sTot = li.sSeg[li.sSeg.length - 1] || 1;
    const dz = ext.zMax - ext.zMin;
    const mgn = Math.max(dz * 0.14, 1);
    const z0 = ext.zMin - mgn, z1 = ext.zMax + mgn;
    const gx = CH2.x + 6, gy = CH2.y + 34, gw = CW - 12, gh = CH2.h - 66;
    const X = (s: number) => gx + (s / sTot) * gw;
    const Y = (z: number) => gy + gh - ((z - z0) / ((z1 - z0) || 1)) * gh;
    const segs: string[] = [];
    for (let i = 0; i < li.degSeg.length; i++) {
      const col = Number.isFinite(li.degSeg[i]) ? COLOR_BANDA[bandaDe(li.degSeg[i])] : '#6b7a90';
      segs.push(`<line x1="${f1(X(li.sSeg[i]))}" y1="${f1(Y(li.zA[i]))}" x2="${f1(X(li.sSeg[i + 1]))}" y2="${f1(Y(li.zB[i]))}" stroke="${col}" stroke-width="2.2"/>`);
    }
    perfil = `<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" fill="#111825" stroke="#22304a"/>`
      + `<line x1="${gx}" y1="${f1(Y(ext.zMin))}" x2="${gx + gw}" y2="${f1(Y(ext.zMin))}" stroke="#3a4a60" stroke-width="1" stroke-dasharray="4 4"/>`
      + `<line x1="${gx}" y1="${f1(Y(ext.zMax))}" x2="${gx + gw}" y2="${f1(Y(ext.zMax))}" stroke="#3a4a60" stroke-width="1" stroke-dasharray="4 4"/>`
      + segs.join('')
      + `<line x1="${gx + gw - 12}" y1="${f1(Y(ext.zMin))}" x2="${gx + gw - 12}" y2="${f1(Y(ext.zMax))}" stroke="#c9a227" stroke-width="1.4"/>`
      + `<text class="cita" style="font:700 11px 'JetBrains Mono',monospace" x="${gx + 5}" y="${gy - 5}">Δz ${ext.desviacionMm.toFixed(3)} mm</text>`
      + `<text class="lblSm" x="${gx}" y="${gy + gh + 14}">s = 0</text>`
      + `<text class="lblSm" x="${gx + gw - 60}" y="${gy + gh + 14}">${sTot.toFixed(0)} mm</text>`;
  } else {
    perfil = `<rect x="${CH2.x + 6}" y="${CH2.y + 34}" width="${CW - 12}" height="${CH2.h - 66}" fill="#111825" stroke="#22304a" stroke-dasharray="5 4"/>`
      + `<text class="off" style="font:700 12px 'JetBrains Mono',monospace" x="${CH2.x + 22}" y="${CH2.y + 96}">SIN CABLEAR</text>`
      + `<text class="lblSm" x="${CH2.x + 22}" y="${CH2.y + 114}">no hay línea de partición trazada</text>`
      + `<text class="lblSm" x="${CH2.x + 22}" y="${CH2.y + 129}">(la superficie vino sin su lazo)</text>`;
  }

  // ── LEYENDAS ──────────────────────────────────────────────────────────────
  const yLeg = Y_LEG;
  const legBanda = COLOR_BANDA.map((c, i) =>
    `<rect x="${PAD + i * 66}" y="${yLeg}" width="66" height="10" fill="${c}"/>`
    + `<text class="lblSm" x="${PAD + i * 66}" y="${yLeg - 4}">${ESC(ETIQ_BANDA[i])}</text>`).join('');
  // las etiquetas de la línea se colocan por ANCHO MEDIDO, no con un paso fijo: con paso
  // fijo se encimaban entre sí y la tercera se salía del cuadro (se vio en el PNG)
  let xl = PAD + 5 * 66 + 24;
  const legLinea = COL_LINEA.map((c, i) => {
    const et = ETIQ_LINEA[i];
    const s = `<line x1="${xl}" y1="${yLeg + 5}" x2="${xl + 22}" y2="${yLeg + 5}" stroke="${c}" stroke-width="3"/>`
      + `<text class="lblSm" x="${xl + 27}" y="${yLeg + 9}">${ESC(et)}</text>`;
    xl += 27 + et.length * 6.3 + 16;
    return s;
  }).join('');

  // ── VEREDICTOS ────────────────────────────────────────────────────────────
  const clsDe = (e: EstadoV) => e === 'CUMPLE' ? 'ok' : e === 'VIOLA' ? 'mal' : e === 'MEDIDO' ? 'warn' : 'off';
  const icoDe = (e: EstadoV) => e === 'CUMPLE' ? '✓' : e === 'VIOLA' ? '✗' : e === 'MEDIDO' ? '●' : '○';
  const vers = r.veredictos.map((v, i) => {
    const linea = `${icoDe(v.estado)} ${v.id} [${v.estado}] ${v.cita} · ${v.texto}`;
    return `<text class="${clsDe(v.estado)}" style="font:700 10.5px 'JetBrains Mono',monospace" x="${PAD}" y="${Y_VER + i * 16}">`
      + `${ESC(cortar(linea, ANCHO_UTIL, 10.5))}</text>`;
  }).join('');

  // DOS líneas de pie, no una: metidas en una sola, el recorte por ancho se comía
  // justo el estado de L21 — la información que decide si V4.6 vale algo.
  const pieA = `área de partición ${r.areaTotalMm2.toFixed(0)} mm² · origen ${r.origen === 'motor' ? 'MOTOR' : `DERIVADA (falda ${r.faldaMm} mm / ${r.faldaAnillos} anillos)`}`
    + (r.linea ? ` · al pie de la línea: mín ${r.linea.minDeg.toFixed(2)}°, ${r.linea.pctBajoUmbral.toFixed(2)} % de su longitud bajo 5°` : '');
  const pieB = r.shutoff.cableado
    ? `L21: ${r.shutoff.nVistas} vista(s) ${r.shutoff.vistasDeclaradas ? 'DECLARADAS por el cliente' : 'SUPUESTAS (taza)'} · zona libre para el shut-off: ${r.shutoff.areaOcultaPiezaMm2.toFixed(0)} mm² ocultos de ${r.shutoff.areaPiezaMm2.toFixed(0)} mm²`
    : 'L21 NO conectada — V4.6 sin medir: esta lámina no pinta ninguna zona libre para el shut-off';
  const supLineas: string[] = [];
  for (const t of r.supuestos) for (const l of envolver('⚠ supuesto: ' + t, ANCHO_UTIL, 10)) supLineas.push(l);
  const sup = supLineas.slice(0, 6).map((l, i) =>
    `<text class="lblSm" style="font:400 10px 'JetBrains Mono',monospace" x="${PAD}" y="${Y_SUP + i * 12}">${ESC(l)}</text>`).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS}</style><rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PAD}" y="34">SUPERFICIE DE PARTICIÓN · ÁNGULO CONTRA LA APERTURA</text>
<text class="sub" style="font:700 14px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PAD}" y="55">${ESC(cortar(r.nombre, ANCHO_UTIL, 14))}</text>
<text class="cita" x="${PAD}" y="74">§4.1.3 Fig 4.8-4.10 (V4.5) · §4.1.2 Fig 4.7 (V4.4) · §4.1.4 Fig 4.11-4.12 (V4.6)</text>
<text class="cita" style="font:700 11.5px 'JetBrains Mono',monospace" x="${PAD}" y="91">"interlocking features on the parting plane should be inclined at least five degrees relative to the mold opening direction"</text>
<text class="lblSm" x="${PAD}" y="107">escala FIJA anclada al 5° del libro · 10/30/60° son subdivisión de LECTURA, no criterio (auto-escalar por percentiles destruiría el umbral)</text>
<text class="lblSm" x="${PAD}" y="121">0° = parche PARALELO a la apertura (la pared que se traba) · 90° = perpendicular (el plano de partición) · apertura = [${r.aperturaUnit.map((c) => c.toFixed(3)).join(', ')}]</text>
<rect x="${VIS.x}" y="${VIS.y}" width="${VIS.w}" height="${VIS.h}" fill="#0e141f" stroke="#1c2637"/>
${escena}${halos.join('')}${lineas.join('')}
<text class="lblSm" x="${VIS.x + 8}" y="${VIS.y + 16}">vista oblicua · la apertura apunta ARRIBA en la lámina</text>
<text class="lbl" style="font:700 12px 'JetBrains Mono',monospace" x="${CH1.x}" y="${CH1.y + 4}">ÁREA POR BANDA · V4.5</text>
<text class="lblSm" x="${CH1.x}" y="${CH1.y + 18}">% del área de la superficie de partición</text>
${barras}
<text class="lbl" style="font:700 12px 'JetBrains Mono',monospace" x="${CH2.x}" y="${CH2.y + 4}">PERFIL z(s) DE LA LÍNEA · V4.4</text>
<text class="lblSm" x="${CH2.x}" y="${CH2.y + 18}">cota sobre el eje de apertura</text>
${perfil}
${legBanda}${legLinea}
${vers}
<text class="lblSm" x="${PAD}" y="${Y_PIE}">${ESC(cortar(pieA, ANCHO_UTIL, 10.5))}</text>
<text class="${r.shutoff.cableado ? 'lblSm' : 'off'}" style="font:${r.shutoff.cableado ? '400' : '700'} 10.5px 'JetBrains Mono',monospace" x="${PAD}" y="${Y_PIE + 14}">${ESC(cortar(pieB, ANCHO_UTIL, 10.5))}</text>
${sup}
</svg>`;

  return {
    id: 'particion-angulo',
    titulo: `Superficie de partición por ángulo — ${r.nombre}`,
    cita: '§4.1.3 · Fig 4.8-4.10 (V4.5) · §4.1.2 Fig 4.7 (V4.4) · §4.1.4 Fig 4.11-4.12 (V4.6)',
    queMirar:
      '¿hay parches ROJOS en la superficie de partición? Cada uno es un rasgo entrelazado por debajo de 5°: al cerrar, ' +
      'cualquier desalineación lo desgasta o lo golpea, y el tonelaje de cierre puede TRABAR las mitades. ' +
      'Mira el perfil z(s): el rojo siempre coincide con un ESCALÓN de la línea (ahí se pide loft/draft, Fig 4.10). ' +
      'Y en la línea: verde = zona oculta donde el shut-off es libre (§4.1.4); rojo = la línea cruza superficie que el usuario ve.',
    svg,
  };
}
