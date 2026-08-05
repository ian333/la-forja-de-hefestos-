/**
 * L19 — MAPA DE VON MISES EN SECCIÓN (Kazmer cap. 12 "Structural System Design")
 * =============================================================================
 * Cubre V12.2 (asimetría lado fijo ↔ lado móvil) · V12.12 (concentración alrededor
 * de los barrenos) · V12.1 (ruta de la carga) · V12.3 (de dónde sale el σ_limit).
 *
 * LO QUE EL LIBRO PIDE, LITERAL
 * -----------------------------
 * · §12.1.1 / Fig 12.2 "Von Mises stresses during molding" — mapa de color bajo
 *   150 MPa de presión de fundido. El lado estacionario está
 *     "[in] a state of pure compression so very little out of plane bending occurs"
 *   y el lado móvil
 *     "must transmit the load via both compressive and shear stresses, which will
 *      tend to result in significant plate bending."
 *   Límite formal (Ec. 12.1): σ_Mises < σ_limit.
 * · §12.2.6 / Fig 12.22-12.23 — un barreno a 1.5 diámetros de la cavidad con
 *   100 MPa aplicados da "maximum von Mises stress ... 340 MPa, which corresponds
 *   to a stress concentration factor of 3.4"; modelo K = 3.1 + 0.75·(Ø/H)^2.29. Y
 *   el hecho contraintuitivo: "a stress concentration of 3 results even when a hole
 *   is located far from the cavity surface."
 * · §12.1.1 / Fig 12.5 — σ_limit del P20 por FATIGA. Ver ERRATAS abajo.
 *
 * ERRATAS DEL LIBRO QUE ESTE MÓDULO DECLARA (apéndice de verificaciones-visuales.md)
 * ---------------------------------------------------------------------------------
 * · P20: el texto dice "approximately 450 MPa", Fig 12.5 rotula "Endurance = 456 MPa"
 *   y §9.2.5 calcula con 456. → SE USA 456 MPa (dos fuentes contra una).
 * · QC7: Fig 12.3 rotula "Yield = 420 MPa" y el texto de §12.1.1 dice "yield stress
 *   of 545 MPa" para el MISMO material. Inconsistencia real: se guardan LAS DOS y la
 *   lámina las imprime. Por defecto manda la prosa de §12.1.1 (545) porque es la
 *   sección que define σ_limit, y el 420 queda impreso al lado.
 * · El aluminio NO tiene límite de fatiga ("do not exhibit an endurance stress
 *   limit"): su σ_limit DEPENDE del nº de ciclos pedido (545 / 370 / 170 MPa a
 *   <1e3 / 1e4 / 1e6 ciclos, Fig 12.5). Sin nº de ciclos declarado, no hay σ_limit
 *   y la lámina lo dice — no lo inventa.
 *
 * EL MODELO (declarado, porque es APROXIMADO)
 * -------------------------------------------
 * El motor estructural que ya existe (`structural.ts` + `platesizing.ts`) resuelve
 * VIGAS y PLACAS (Ec. 12.5-12.11): da un número por placa, no un campo. Y `mold-fea.ts`
 * sí es FEA 3D real pero necesita el kernel OCCT y un sólido del molde vivo — no corre
 * en un módulo puro. Para pintar el mapa de la Fig 12.2 aquí se resuelve, DESDE CERO
 * y a la vista:
 *
 *   ELASTICIDAD LINEAL 2D EN LA SECCIÓN, elementos Q4 bilineales, 2×2 Gauss,
 *   DEFORMACIÓN PLANA (el molde es largo en la dirección perpendicular al corte),
 *   pequeños desplazamientos, acero isótropo E = 205 GPa (structural.ts) y ν = 0.30.
 *
 * SUPUESTOS que el modelo NO puede resolver — quedan SIN CABLEAR, nunca en verde:
 *   1. Las dos mitades se modelan LIGADAS en el plano de partición. No hay contacto
 *      unilateral ⇒ este modelo NO predice la APERTURA del plano de partición: eso
 *      es la L20 (§12.1.2 / Fig 12.6), aquí no se pinta.
 *   2. La fuerza de cierre de la máquina NO se aplica: sólo la presión de fundido
 *      sobre las paredes de la cavidad (que es la carga de la Fig 12.2).
 *   3. 2D: los efectos 3D (esquinas de la cavidad, rigidez fuera del plano) no están.
 *      La deformación plana es el lado CONSERVADOR para el confinamiento, no para σ.
 *   4. Sin precarga de tornillos, sin esfuerzo térmico, sin residual de temple.
 *   5. Sólo los barrenos con EJE PERPENDICULAR al plano de corte salen redondos y se
 *      miden. Los expulsores y tornillos (eje CONTENIDO en el corte) se declaran
 *      SIN CABLEAR en esta vista: su concentración se mide en planta (L1), no aquí.
 *
 * VERIFICACIÓN: `scripts/mold-vonmises-test.cjs` — NO contra el libro, contra
 * ELASTICIDAD ANALÍTICA: tracción uniaxial (vm = σ exacto), cortante puro (vm = √3·τ),
 * hidrostática, viga (σ = M·c/I), patch test, y sobre todo KIRSCH: placa infinita con
 * agujero a tracción ⇒ Kt = 3.0 EXACTO. Ese es el check que decide si V12.12 vale algo.
 *
 * PURO: sin DOM, sin kernel, sin reloj. Devuelve un `Lamina` (SVG string).
 */

import { vonMisesStress, principalStresses, type StressTensor } from '../../lib/formulas';
import { E_STEEL } from './structural';
import type { Lamina } from './laminas-visuales';

const ESC = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ═══════════════════════════════════════════════════════════════════════════
// 1. NÚMEROS DEL LIBRO — LITERALES, con su § (nada de aquí se inventa)
// ═══════════════════════════════════════════════════════════════════════════

/** E del acero de molde: 205 GPa = 205 000 MPa (structural.ts, §12.1.3 "todos ≈200 GPa"). */
export const E_ACERO_MPA = E_STEEL / 1e6;
/** ν del acero. EXTENSIÓN DECLARADA: el libro no lo da; 0.30 es el valor estándar. */
export const NU_ACERO = 0.30;

export interface LimiteMaterial {
  material: string;
  /** σ_limit en MPa, o null si el libro NO permite fijar uno sin más datos. */
  sigmaLimitMPa: number | null;
  cita: string;
  /** el conflicto literal entre figura y prosa, si lo hay (se imprime en la lámina) */
  errata?: string;
  /** true = el material NO tiene límite de fatiga (aluminio) */
  sinLimiteFatiga?: boolean;
}

/**
 * σ_limit por material. LITERAL de §12.1.1 / Fig 12.3 / Fig 12.5 / §9.2.5.
 * `ciclos` sólo importa para el aluminio, que NO tiene límite de fatiga.
 */
export function limiteMaterial(material: 'P20' | 'QC7', ciclos?: number): LimiteMaterial {
  if (material === 'P20') {
    return {
      material: 'P20 (1.2311)',
      sigmaLimitMPa: 456,
      cita: '§12.1.1 · Fig 12.5 "Endurance = 456 MPa" · §9.2.5 usa 456',
      errata: 'ERRATA: el texto de §12.1.1 dice "approximately 450 MPa"; Fig 12.5 rotula 456 y §9.2.5 calcula con 456 → se usa 456',
    };
  }
  // QC7 = aleación de aluminio. Fig 12.5: 545 MPa si <1000 ciclos · 370 a ~10 000 ·
  // 170 si se piden un millón. Y "[aluminum alloys] do not exhibit an endurance stress limit".
  const errata = 'ERRATA: Fig 12.3 rotula "Yield = 420 MPa" y §12.1.1 dice "yield stress of 545 MPa" para el MISMO QC7 — el libro no resuelve la contradicción';
  if (ciclos == null) {
    return {
      material: 'QC7 (aluminio)', sigmaLimitMPa: null, sinLimiteFatiga: true,
      cita: '§12.1.1 · Fig 12.5 — "do not exhibit an endurance stress limit"',
      errata: errata + ' · sin nº de CICLOS no hay σ_limit: el aluminio siempre falla con suficientes ciclos',
    };
  }
  const s = ciclos < 1000 ? 545 : ciclos <= 10000 ? 370 : 170;
  return {
    material: `QC7 (aluminio, ${ciclos.toExponential(0)} ciclos)`,
    sigmaLimitMPa: s, sinLimiteFatiga: true,
    cita: `§12.1.1 · Fig 12.5 — 545 MPa (<1e3) · 370 MPa (~1e4) · 170 MPa (1e6); aquí ${s} MPa`,
    errata,
  };
}

/** §12.2.6: K = 3.1 + 0.75·(Ø/H)^2.29. H = superficie de cavidad → CENTRO del barreno.
 *  (Con Ø/H = 1/1.5 da 3.396 ≈ el "3.4" publicado para el barreno "at 1.5 diameters".) */
export const kBarrenoLibro = (diaMm: number, HMm: number): number =>
  3.1 + 0.75 * Math.pow(diaMm / Math.max(1e-9, HMm), 2.29);

/** Presión de fundido de la Fig 12.2 (V12.2): 150 MPa. */
export const P_FUNDIDO_FIG122_MPA = 150;

// ═══════════════════════════════════════════════════════════════════════════
// 2. MALLA DE CUADRILÁTEROS
// ═══════════════════════════════════════════════════════════════════════════

export interface Malla2D {
  /** coordenadas nodales en mm, [x0,y0, x1,y1, ...] */
  xy: Float64Array;
  /** conectividad Q4 en orden ANTIHORARIO, [a,b,c,d, ...] */
  quads: Uint32Array;
  nNodos: number;
  nQuads: number;
}

/** Área con signo de un quad (positiva ⇔ antihorario). Es el check de validez de malla. */
export function areaQuadFirmada(m: Malla2D, e: number): number {
  const q = m.quads, xy = m.xy;
  let a = 0;
  for (let k = 0; k < 4; k++) {
    const i = q[4 * e + k], j = q[4 * e + ((k + 1) % 4)];
    a += xy[2 * i] * xy[2 * j + 1] - xy[2 * j] * xy[2 * i + 1];
  }
  return a / 2;
}

/**
 * PARTE la malla en dos cuerpos por la línea y = yCorte duplicando sus nodos.
 * Sin esto las dos mitades del molde quedan SOLDADAS y la presión de fundido se
 * cortocircuita por el acero del plano de partición: medido, la resultante que baja
 * a cada platina caía a 0.45·p·w_cavidad en vez de p·w. El molde real son DOS piezas
 * apretadas; aquí van SEPARADAS (sin contacto), que es el modelo de la Fig 12.2.
 */
export function partirMalla(m: Malla2D, yCorte: number): Malla2D {
  const xs = Array.from(m.xy);
  const quads = Uint32Array.from(m.quads);
  const dup = new Map<number, number>();
  for (let e = 0; e < m.nQuads; e++) {
    let yc = 0;
    for (let k = 0; k < 4; k++) yc += m.xy[2 * m.quads[4 * e + k] + 1];
    if (yc / 4 >= yCorte) continue;
    for (let k = 0; k < 4; k++) {
      const nd = quads[4 * e + k];
      if (Math.abs(m.xy[2 * nd + 1] - yCorte) > 1e-6) continue;
      let d = dup.get(nd);
      if (d === undefined) { d = xs.length / 2; xs.push(m.xy[2 * nd], m.xy[2 * nd + 1]); dup.set(nd, d); }
      quads[4 * e + k] = d;
    }
  }
  return { xy: Float64Array.from(xs), quads, nNodos: xs.length / 2, nQuads: m.nQuads };
}

/** Bordes DIRIGIDOS de la frontera (aparecen en un solo quad) con su normal EXTERIOR. */
export interface BordeLibre { a: number; b: number; nx: number; ny: number; largo: number; mx: number; my: number; }

export function bordesLibres(m: Malla2D): BordeLibre[] {
  const cuenta = new Map<number, { a: number; b: number; n: number }>();
  const key = (i: number, j: number) => (i < j ? i * 1e7 + j : j * 1e7 + i);
  for (let e = 0; e < m.nQuads; e++) {
    for (let k = 0; k < 4; k++) {
      const a = m.quads[4 * e + k], b = m.quads[4 * e + ((k + 1) % 4)];
      const kk = key(a, b);
      const prev = cuenta.get(kk);
      if (prev) prev.n++;
      else cuenta.set(kk, { a, b, n: 1 });
    }
  }
  const out: BordeLibre[] = [];
  for (const v of cuenta.values()) {
    if (v.n !== 1) continue;
    const ax = m.xy[2 * v.a], ay = m.xy[2 * v.a + 1], bx = m.xy[2 * v.b], by = m.xy[2 * v.b + 1];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    // quad ANTIHORARIO ⇒ la normal exterior de (a→b) es (dy, −dx)/L
    out.push({ a: v.a, b: v.b, nx: dy / L, ny: -dx / L, largo: L, mx: (ax + bx) / 2, my: (ay + by) / 2 });
  }
  return out;
}

/** Constructor incremental con fusión de nodos por coordenada (para pegar bloques). */
class Constructor {
  private mapa = new Map<string, number>();
  private xs: number[] = [];
  private q: number[] = [];
  private readonly tol: number;
  constructor(tolMm = 1e-6) { this.tol = tolMm; }
  nodo(x: number, y: number): number {
    const k = `${Math.round(x / this.tol)},${Math.round(y / this.tol)}`;
    const got = this.mapa.get(k);
    if (got !== undefined) return got;
    const id = this.xs.length / 2;
    this.xs.push(x, y);
    this.mapa.set(k, id);
    return id;
  }
  quad(a: number, b: number, c: number, d: number): void { this.q.push(a, b, c, d); }
  malla(): Malla2D {
    const m: Malla2D = {
      xy: Float64Array.from(this.xs), quads: Uint32Array.from(this.q),
      nNodos: this.xs.length / 2, nQuads: this.q.length / 4,
    };
    // seguro barato: si un quad quedó horario, se voltea (nunca debería pasar)
    for (let e = 0; e < m.nQuads; e++) {
      if (areaQuadFirmada(m, e) < 0) {
        const b = m.quads[4 * e + 1], d = m.quads[4 * e + 3];
        m.quads[4 * e + 1] = d; m.quads[4 * e + 3] = b;
      }
    }
    return m;
  }
}

/** Rectángulo estructurado nx×ny. */
export function mallaRect(x0: number, y0: number, x1: number, y1: number, nx: number, ny: number): Malla2D {
  const c = new Constructor();
  const px = (i: number) => x0 + ((x1 - x0) * i) / nx;
  const py = (j: number) => y0 + ((y1 - y0) * j) / ny;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    c.quad(c.nodo(px(i), py(j)), c.nodo(px(i + 1), py(j)), c.nodo(px(i + 1), py(j + 1)), c.nodo(px(i), py(j + 1)));
  }
  return c.malla();
}

/**
 * CUARTO DE ANILLO a ≤ r ≤ R, 0 ≤ θ ≤ π/2, con graduación GEOMÉTRICA en r
 * (elementos finos pegados al agujero). Es la malla del check de Kirsch: sobre el
 * borde r = R se aplica la tracción ANALÍTICA exacta, así que la solución de EF
 * debe converger al campo de Kirsch sin error de "placa finita".
 */
export function mallaAnularCuarto(a: number, R: number, nr: number, nt: number): Malla2D {
  const c = new Constructor(1e-9);
  const rr = (i: number) => a * Math.pow(R / a, i / nr);
  const tt = (j: number) => (Math.PI / 2) * (j / nt);
  const P = (i: number, j: number) => c.nodo(rr(i) * Math.cos(tt(j)), rr(i) * Math.sin(tt(j)));
  for (let j = 0; j < nt; j++) for (let i = 0; i < nr; i++) {
    c.quad(P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1));
  }
  return c.malla();
}

export interface BarrenoSpec {
  x: number; y: number; diaMm: number;
  tipo: 'agua' | 'expulsor' | 'tornillo' | 'otro';
  etiqueta?: string;
  /** true = el eje del barreno es PERPENDICULAR al plano de corte ⇒ sale redondo y se
   *  puede medir aquí. false = eje contenido en el corte ⇒ SIN CABLEAR en esta vista. */
  ejePerpendicular: boolean;
}

export interface SeccionSpec {
  anchoMm: number; altoMm: number;
  /** rectángulos VACÍOS (cavidad, bolsillo del expulsor). Deben caer sobre líneas de corte. */
  vacios: Array<{ x0: number; y0: number; x1: number; y1: number; nombre: string }>;
  barrenos: BarrenoSpec[];
  /** tamaño de elemento objetivo (mm) */
  hMm: number;
  /** divisiones mínimas por lado en los intervalos que contienen barreno (refina el anillo) */
  divBarreno?: number;
  /** líneas de corte extra (interfaces de placa) para que el dibujo las tenga */
  cortesX?: number[];
  cortesY?: number[];
  /** si true, los barrenos NO se abren (modelo de referencia para calcular K) */
  sinBarrenos?: boolean;
}

const uniqOrd = (v: number[], tol = 1e-6): number[] => {
  const s = [...v].sort((a, b) => a - b);
  const o: number[] = [];
  for (const x of s) if (!o.length || x - o[o.length - 1] > tol) o.push(x);
  return o;
};

/**
 * MALLA DE LA SECCIÓN: rectángulo con vacíos rectangulares y barrenos REDONDOS
 * ajustados al contorno (O-grid de rayos desde el centro del barreno). El dominio se
 * parte en bloques por producto tensorial de las líneas de corte; cada bloque es o una
 * rejilla plana, o un anillo de rayos si contiene un barreno. Los bloques comparten la
 * misma partición en sus lados ⇒ la malla es CONFORME al pegar por coordenada.
 */
export function mallaSeccion(s: SeccionSpec): { malla: Malla2D; barrenosMallados: BarrenoSpec[] } {
  const redondos = s.sinBarrenos ? [] : s.barrenos.filter((b) => b.ejePerpendicular);
  const margen = (b: BarrenoSpec) => Math.max(b.diaMm * 1.6, b.diaMm / 2 + 4);
  const xs = uniqOrd([0, s.anchoMm, ...(s.cortesX ?? []),
    ...s.vacios.flatMap((v) => [v.x0, v.x1]),
    ...redondos.flatMap((b) => [b.x - margen(b), b.x + margen(b)])]);
  const ys = uniqOrd([0, s.altoMm, ...(s.cortesY ?? []),
    ...s.vacios.flatMap((v) => [v.y0, v.y1]),
    ...redondos.flatMap((b) => [b.y - margen(b), b.y + margen(b)])]);

  // divisiones POR INTERVALO (no por bloque) ⇒ los lados compartidos casan exacto
  const divBar = s.divBarreno ?? 12;
  const tieneBarrenoX = (i: number) => redondos.some((b) => b.x > xs[i] && b.x < xs[i + 1]);
  const tieneBarrenoY = (j: number) => redondos.some((b) => b.y > ys[j] && b.y < ys[j + 1]);
  const nxs = xs.slice(0, -1).map((_, i) => Math.max(tieneBarrenoX(i) ? divBar : 1, Math.round((xs[i + 1] - xs[i]) / s.hMm)));
  const nys = ys.slice(0, -1).map((_, j) => Math.max(tieneBarrenoY(j) ? divBar : 1, Math.round((ys[j + 1] - ys[j]) / s.hMm)));

  const c = new Constructor(1e-6);
  const dentroVacio = (x: number, y: number) => s.vacios.some((v) => x > v.x0 && x < v.x1 && y > v.y0 && y < v.y1);

  for (let j = 0; j < ys.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i], x1 = xs[i + 1], y0 = ys[j], y1 = ys[j + 1];
    if (dentroVacio((x0 + x1) / 2, (y0 + y1) / 2)) continue;   // bloque hueco
    const nx = nxs[i], ny = nys[j];
    const bar = redondos.find((b) => b.x > x0 && b.x < x1 && b.y > y0 && b.y < y1);
    if (!bar) {
      const px = (k: number) => x0 + ((x1 - x0) * k) / nx;
      const py = (k: number) => y0 + ((y1 - y0) * k) / ny;
      for (let q = 0; q < ny; q++) for (let p = 0; p < nx; p++) {
        c.quad(c.nodo(px(p), py(q)), c.nodo(px(p + 1), py(q)), c.nodo(px(p + 1), py(q + 1)), c.nodo(px(p), py(q + 1)));
      }
      continue;
    }
    // ── O-GRID de RAYOS: cada nodo del contorno del bloque se une al agujero por
    //    su propio rayo desde el centro, con graduación geométrica en r.
    const a = bar.diaMm / 2;
    const holgura = Math.min(bar.x - x0, x1 - bar.x, bar.y - y0, y1 - bar.y);
    if (a >= holgura * 0.7) throw new Error(`barreno ⌀${bar.diaMm} no cabe en su bloque (holgura ${holgura.toFixed(1)} mm): separa las líneas de corte`);
    const contorno: Array<[number, number]> = [];
    for (let k = 0; k < nx; k++) contorno.push([x0 + ((x1 - x0) * k) / nx, y0]);
    for (let k = 0; k < ny; k++) contorno.push([x1, y0 + ((y1 - y0) * k) / ny]);
    for (let k = nx; k > 0; k--) contorno.push([x0 + ((x1 - x0) * k) / nx, y1]);
    for (let k = ny; k > 0; k--) contorno.push([x0, y0 + ((y1 - y0) * k) / ny]);
    const M = contorno.length;
    const nr = Math.max(6, Math.round(Math.max(nx, ny) * 1.2));
    const nodo = (k: number, l: number) => {
      const [bx, by] = contorno[k % M];
      const dx = bx - bar.x, dy = by - bar.y, Rk = Math.hypot(dx, dy);
      const r = a * Math.pow(Rk / a, l / nr);
      return c.nodo(bar.x + (dx / Rk) * r, bar.y + (dy / Rk) * r);
    };
    for (let k = 0; k < M; k++) for (let l = 0; l < nr; l++) {
      c.quad(nodo(k, l), nodo(k, l + 1), nodo(k + 1, l + 1), nodo(k + 1, l));
    }
  }
  return { malla: c.malla(), barrenosMallados: redondos };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. SOLVER — elasticidad lineal 2D, Q4 bilineal, 2×2 Gauss
// ═══════════════════════════════════════════════════════════════════════════

export type EstadoPlano = 'deformacion-plana' | 'esfuerzo-plano';

export interface Solucion2D {
  u: Float64Array;            // desplazamientos [ux0,uy0,...] en mm
  sxx: Float64Array; syy: Float64Array; sxy: Float64Array; szz: Float64Array;  // nodales, MPa
  vm: Float64Array;           // von Mises nodal, MPa
  s1: Float64Array;           // esfuerzo principal MÁXIMO nodal (tracción > 0), MPa
  tauMax: Float64Array;       // cortante máximo nodal, MPa
  vmElem: Float64Array;       // von Mises por elemento (media de sus 4 nodos), MPa
  areaElem: Float64Array;     // mm²
  iters: number; residuo: number; converge: boolean;
}

const G = 1 / Math.sqrt(3);
const GP: Array<[number, number]> = [[-G, -G], [G, -G], [G, G], [-G, G]];
const NAT: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
/** Extrapolación Gauss→nodo (bilineal en coords escaladas ×√3). Recuperación estándar. */
const EXTRAP: number[][] = NAT.map(([xi, eta]) => {
  const r = Math.sqrt(3) * xi, sN = Math.sqrt(3) * eta;
  return [((1 - r) * (1 - sN)) / 4, ((1 + r) * (1 - sN)) / 4, ((1 + r) * (1 + sN)) / 4, ((1 - r) * (1 + sN)) / 4];
});

function matrizD(EMPa: number, nu: number, estado: EstadoPlano): number[][] {
  if (estado === 'esfuerzo-plano') {
    const k = EMPa / (1 - nu * nu);
    return [[k, k * nu, 0], [k * nu, k, 0], [0, 0, (k * (1 - nu)) / 2]];
  }
  const k = EMPa / ((1 + nu) * (1 - 2 * nu));
  return [[k * (1 - nu), k * nu, 0], [k * nu, k * (1 - nu), 0], [0, 0, (k * (1 - 2 * nu)) / 2]];
}

/** dN/dx, dN/dy y detJ en (ξ,η) para el quad `e`. */
function gradN(m: Malla2D, e: number, xi: number, eta: number) {
  const dNxi = [-(1 - eta) / 4, (1 - eta) / 4, (1 + eta) / 4, -(1 + eta) / 4];
  const dNet = [-(1 - xi) / 4, -(1 + xi) / 4, (1 + xi) / 4, (1 - xi) / 4];
  let j11 = 0, j12 = 0, j21 = 0, j22 = 0;
  for (let k = 0; k < 4; k++) {
    const n = m.quads[4 * e + k], x = m.xy[2 * n], y = m.xy[2 * n + 1];
    j11 += dNxi[k] * x; j12 += dNxi[k] * y;
    j21 += dNet[k] * x; j22 += dNet[k] * y;
  }
  const det = j11 * j22 - j12 * j21;
  const dx = new Array(4), dy = new Array(4);
  for (let k = 0; k < 4; k++) {
    dx[k] = (j22 * dNxi[k] - j12 * dNet[k]) / det;
    dy[k] = (-j21 * dNxi[k] + j11 * dNet[k]) / det;
  }
  return { dx, dy, det };
}

export interface CargaPresion { a: number; b: number; pMPa: number }
export interface CargaTraccion { a: number; b: number; t: (x: number, y: number) => [number, number] }

export function resolverElasticidad2D(m: Malla2D, o: {
  EMPa?: number; nu?: number; estado: EstadoPlano;
  /** ux/uy = ese GDL queda prescrito; uxVal/uyVal = a qué valor (0 por defecto) */
  fijos: Array<{ nodo: number; ux?: boolean; uy?: boolean; uxVal?: number; uyVal?: number }>;
  presiones?: CargaPresion[];
  tracciones?: CargaTraccion[];
  /** 'spr' (por defecto, Zienkiewicz-Zhu) o 'extrapolacion' (bilineal Gauss→nodo) */
  recuperacion?: Recuperacion;
  tol?: number; maxIter?: number;
}): Solucion2D {
  const EMPa = o.EMPa ?? E_ACERO_MPA, nu = o.nu ?? NU_ACERO;
  const D = matrizD(EMPa, nu, o.estado);
  const n = 2 * m.nNodos;
  const filas: Array<Map<number, number>> = Array.from({ length: n }, () => new Map<number, number>());
  const f = new Float64Array(n);
  const add = (i: number, j: number, v: number) => { if (v !== 0) filas[i].set(j, (filas[i].get(j) ?? 0) + v); };

  // ── ensamble
  const areaElem = new Float64Array(m.nQuads);
  for (let e = 0; e < m.nQuads; e++) {
    const ke = new Float64Array(64);
    let area = 0;
    for (const [xi, eta] of GP) {
      const { dx, dy, det } = gradN(m, e, xi, eta);
      area += det;
      // B (3×8)
      const B = [new Float64Array(8), new Float64Array(8), new Float64Array(8)];
      for (let k = 0; k < 4; k++) {
        B[0][2 * k] = dx[k]; B[1][2 * k + 1] = dy[k];
        B[2][2 * k] = dy[k]; B[2][2 * k + 1] = dx[k];
      }
      const DB = [new Float64Array(8), new Float64Array(8), new Float64Array(8)];
      for (let r = 0; r < 3; r++) for (let cI = 0; cI < 8; cI++) {
        DB[r][cI] = D[r][0] * B[0][cI] + D[r][1] * B[1][cI] + D[r][2] * B[2][cI];
      }
      for (let a2 = 0; a2 < 8; a2++) for (let b2 = 0; b2 < 8; b2++) {
        ke[8 * a2 + b2] += (B[0][a2] * DB[0][b2] + B[1][a2] * DB[1][b2] + B[2][a2] * DB[2][b2]) * det;
      }
    }
    areaElem[e] = area;
    const dof: number[] = [];
    for (let k = 0; k < 4; k++) { const nd = m.quads[4 * e + k]; dof.push(2 * nd, 2 * nd + 1); }
    for (let a2 = 0; a2 < 8; a2++) for (let b2 = 0; b2 < 8; b2++) add(dof[a2], dof[b2], ke[8 * a2 + b2]);
  }

  // ── cargas de presión (normal exterior del borde a→b de un quad ANTIHORARIO)
  for (const p of o.presiones ?? []) {
    const ax = m.xy[2 * p.a], ay = m.xy[2 * p.a + 1], bx = m.xy[2 * p.b], by = m.xy[2 * p.b + 1];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    const nxo = dy / L, nyo = -dx / L;         // normal EXTERIOR
    const tx = -p.pMPa * nxo, ty = -p.pMPa * nyo;   // presión empuja HACIA ADENTRO
    f[2 * p.a] += (tx * L) / 2; f[2 * p.a + 1] += (ty * L) / 2;
    f[2 * p.b] += (tx * L) / 2; f[2 * p.b + 1] += (ty * L) / 2;
  }
  // ── tracciones arbitrarias (2 puntos de Gauss sobre el borde)
  for (const c2 of o.tracciones ?? []) {
    const ax = m.xy[2 * c2.a], ay = m.xy[2 * c2.a + 1], bx = m.xy[2 * c2.b], by = m.xy[2 * c2.b + 1];
    const L = Math.hypot(bx - ax, by - ay);
    for (const g of [-G, G]) {
      const Na = (1 - g) / 2, Nb = (1 + g) / 2;
      const [tx, ty] = c2.t(ax * Na + bx * Nb, ay * Na + by * Nb);
      const w = (L / 2) * 1;   // peso 1 por punto en [-1,1]
      f[2 * c2.a] += Na * tx * w; f[2 * c2.a + 1] += Na * ty * w;
      f[2 * c2.b] += Nb * tx * w; f[2 * c2.b + 1] += Nb * ty * w;
    }
  }

  // ── Dirichlet (fila/columna a identidad, con valor prescrito al lado derecho)
  const fijo = new Uint8Array(n);
  const val = new Float64Array(n);
  for (const r of o.fijos) {
    if (r.ux) { fijo[2 * r.nodo] = 1; val[2 * r.nodo] = r.uxVal ?? 0; }
    if (r.uy) { fijo[2 * r.nodo + 1] = 1; val[2 * r.nodo + 1] = r.uyVal ?? 0; }
  }
  // nodos HUÉRFANOS (sin elemento — los deja `partirMalla` al duplicar): su GDL no
  // existe en la física, pero dejaría la matriz singular. Se fijan y se olvidan.
  for (let i = 0; i < n; i++) if (!(Math.abs(filas[i].get(i) ?? 0) > 0)) { fijo[i] = 1; val[i] = 0; }
  for (let i = 0; i < n; i++) {
    if (fijo[i]) continue;
    for (const [j, v] of filas[i]) if (fijo[j] && val[j] !== 0) f[i] -= v * val[j];
  }
  for (let i = 0; i < n; i++) {
    if (fijo[i]) { filas[i].clear(); filas[i].set(i, 1); f[i] = val[i]; }
    else for (const j of [...filas[i].keys()]) if (fijo[j]) filas[i].delete(j);
  }

  // ── CSR + CG precondicionado (IC(0) con respaldo Jacobi)
  const { u, iters, residuo, converge } = cgResuelve(filas, f, o.tol ?? 1e-10, o.maxIter ?? 40000);

  // ── recuperación de esfuerzos (ver `recuperaEsfuerzos`)
  const { sxx: sxxR, syy: syyR, sxy: sxyR } = recuperaEsfuerzos(m, u, D, o.recuperacion ?? 'spr');
  const sxx = sxxR, syy = syyR, sxy = sxyR;
  const szz = new Float64Array(m.nNodos), vm = new Float64Array(m.nNodos), s1 = new Float64Array(m.nNodos);
  const tauMax = new Float64Array(m.nNodos);
  for (let i = 0; i < m.nNodos; i++) {
    // DEFORMACIÓN PLANA: σzz = ν(σxx+σyy) (ε_zz = 0). ESFUERZO PLANO: σzz = 0.
    szz[i] = o.estado === 'deformacion-plana' ? nu * (sxx[i] + syy[i]) : 0;
    const T: StressTensor = [sxx[i], syy[i], szz[i], sxy[i], 0, 0];
    vm[i] = vonMisesStress(T);
    const pr = principalStresses(T);
    s1[i] = Math.max(pr[0], pr[1], pr[2]);
    tauMax[i] = (Math.max(pr[0], pr[1], pr[2]) - Math.min(pr[0], pr[1], pr[2])) / 2;
  }
  const vmElem = new Float64Array(m.nQuads);
  for (let e = 0; e < m.nQuads; e++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += vm[m.quads[4 * e + k]];
    vmElem[e] = s / 4;
  }
  return { u, sxx, syy, sxy, szz, vm, s1, tauMax, vmElem, areaElem, iters, residuo, converge };
}

export type Recuperacion = 'spr' | 'extrapolacion';

/**
 * RECUPERACIÓN DE ESFUERZOS — de los puntos de Gauss al nodo.
 *
 * `extrapolacion`: la clásica bilineal Gauss→nodo (×√3) + promedio nodal. Sirve,
 *   pero en un nodo de FRONTERA que sólo toca UN elemento (justo el borde de un
 *   barreno) extrapola desde 4 puntos de un solo elemento y se queda ~1 % corta.
 *   Medido contra Kirsch: 1.34 % → 1.12 % → 0.68 % al refinar. Converge, pero lento.
 * `spr` (Zienkiewicz-Zhu 1992, el estándar): en el parche de elementos que rodea al
 *   nodo se ajusta por mínimos cuadrados un polinomio a los valores en los PUNTOS DE
 *   GAUSS — que para el Q4 son los puntos SUPERCONVERGENTES del esfuerzo — y se
 *   evalúa en el nodo. En la frontera el parche se agranda a los vecinos de vecinos
 *   para que la evaluación sea interpolación y no extrapolación ciega.
 *   Ambos son EXACTOS para campos de esfuerzo constante (tracción, cortante,
 *   hidrostática): el gate lo comprueba, así que el cambio no relaja nada.
 */
function recuperaEsfuerzos(m: Malla2D, u: Float64Array, D: number[][], modo: Recuperacion) {
  // esfuerzos en los 4 puntos de Gauss de cada elemento + sus coordenadas
  const gs = new Float64Array(m.nQuads * 4 * 3);
  const gx = new Float64Array(m.nQuads * 4), gy = new Float64Array(m.nQuads * 4);
  for (let e = 0; e < m.nQuads; e++) {
    for (let g = 0; g < 4; g++) {
      const [xi, eta] = GP[g];
      const { dx, dy } = gradN(m, e, xi, eta);
      let exx = 0, eyy = 0, gxy = 0, X = 0, Y = 0;
      const N = [((1 - xi) * (1 - eta)) / 4, ((1 + xi) * (1 - eta)) / 4, ((1 + xi) * (1 + eta)) / 4, ((1 - xi) * (1 + eta)) / 4];
      for (let k = 0; k < 4; k++) {
        const nd = m.quads[4 * e + k], ux = u[2 * nd], uy = u[2 * nd + 1];
        exx += dx[k] * ux; eyy += dy[k] * uy; gxy += dy[k] * ux + dx[k] * uy;
        X += N[k] * m.xy[2 * nd]; Y += N[k] * m.xy[2 * nd + 1];
      }
      const b = (e * 4 + g) * 3;
      gs[b] = D[0][0] * exx + D[0][1] * eyy + D[0][2] * gxy;
      gs[b + 1] = D[1][0] * exx + D[1][1] * eyy + D[1][2] * gxy;
      gs[b + 2] = D[2][0] * exx + D[2][1] * eyy + D[2][2] * gxy;
      gx[e * 4 + g] = X; gy[e * 4 + g] = Y;
    }
  }
  const sxx = new Float64Array(m.nNodos), syy = new Float64Array(m.nNodos), sxy = new Float64Array(m.nNodos);

  if (modo === 'extrapolacion') {
    const cuenta = new Float64Array(m.nNodos);
    for (let e = 0; e < m.nQuads; e++) for (let k = 0; k < 4; k++) {
      const nd = m.quads[4 * e + k];
      for (let g = 0; g < 4; g++) {
        const b = (e * 4 + g) * 3;
        sxx[nd] += EXTRAP[k][g] * gs[b]; syy[nd] += EXTRAP[k][g] * gs[b + 1]; sxy[nd] += EXTRAP[k][g] * gs[b + 2];
      }
      cuenta[nd]++;
    }
    for (let i = 0; i < m.nNodos; i++) { const c = Math.max(1, cuenta[i]); sxx[i] /= c; syy[i] /= c; sxy[i] /= c; }
    return { sxx, syy, sxy };
  }

  // nodo → elementos que lo tocan
  const cnt = new Int32Array(m.nNodos + 1);
  for (let e = 0; e < m.nQuads; e++) for (let k = 0; k < 4; k++) cnt[m.quads[4 * e + k] + 1]++;
  for (let i = 0; i < m.nNodos; i++) cnt[i + 1] += cnt[i];
  const off = Int32Array.from(cnt), elemDe = new Int32Array(cnt[m.nNodos]);
  for (let e = 0; e < m.nQuads; e++) for (let k = 0; k < 4; k++) elemDe[off[m.quads[4 * e + k]]++] = e;

  const bordeNodo = new Uint8Array(m.nNodos);
  for (const b of bordesLibres(m)) { bordeNodo[b.a] = 1; bordeNodo[b.b] = 1; }

  const patch: number[] = [];
  for (let i = 0; i < m.nNodos; i++) {
    patch.length = 0;
    for (let p = cnt[i]; p < cnt[i + 1]; p++) patch.push(elemDe[p]);
    // en la frontera (o con parche pobre) se agranda: vecinos de los vecinos
    if (bordeNodo[i] || patch.length < 3) {
      const set = new Set(patch);
      for (const e of [...set]) for (let k = 0; k < 4; k++) {
        const nd = m.quads[4 * e + k];
        for (let p = cnt[nd]; p < cnt[nd + 1]; p++) set.add(elemDe[p]);
      }
      patch.length = 0; for (const e of set) patch.push(e);
    }
    const xi0 = m.xy[2 * i], yi0 = m.xy[2 * i + 1];
    // escala del parche (condicionamiento)
    let h = 0;
    for (const e of patch) for (let g = 0; g < 4; g++) h = Math.max(h, Math.hypot(gx[e * 4 + g] - xi0, gy[e * 4 + g] - yi0));
    h = h || 1;
    // mínimos cuadrados de p = c0 + c1·X + c2·Y  (X,Y normalizados)
    const A = [0, 0, 0, 0, 0, 0, 0, 0, 0];       // 3×3 simétrica
    const rhs = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; // 3 componentes × 3 coef
    let np = 0;
    for (const e of patch) for (let g = 0; g < 4; g++) {
      const X = (gx[e * 4 + g] - xi0) / h, Y = (gy[e * 4 + g] - yi0) / h;
      const P = [1, X, Y];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) A[3 * r + c] += P[r] * P[c];
      const b = (e * 4 + g) * 3;
      for (let comp = 0; comp < 3; comp++) for (let r = 0; r < 3; r++) rhs[comp][r] += P[r] * gs[b + comp];
      np++;
    }
    let ok = np >= 4;
    const sol3: number[][] = [];
    if (ok) {
      for (let comp = 0; comp < 3 && ok; comp++) {
        const s = resuelve3x3(A, rhs[comp]);
        if (!s) ok = false; else sol3.push(s);
      }
    }
    if (ok) { sxx[i] = sol3[0][0]; syy[i] = sol3[1][0]; sxy[i] = sol3[2][0]; }
    else if (np > 0) {
      // respaldo: promedio simple de los Gauss del parche
      let a = 0, b2 = 0, c = 0, k = 0;
      for (const e of patch) for (let g = 0; g < 4; g++) { const b = (e * 4 + g) * 3; a += gs[b]; b2 += gs[b + 1]; c += gs[b + 2]; k++; }
      sxx[i] = a / k; syy[i] = b2 / k; sxy[i] = c / k;
    }
    // np === 0 ⇒ nodo HUÉRFANO (lo deja `partirMalla`): no tiene física, queda en 0.
  }
  return { sxx, syy, sxy };
}

/** Resuelve A(3×3 simétrica, fila-mayor)·x = b por eliminación. null si es singular. */
function resuelve3x3(A: number[], b: number[]): number[] | null {
  const M = [[A[0], A[1], A[2], b[0]], [A[3], A[4], A[5], b[1]], [A[6], A[7], A[8], b[2]]];
  const esc = Math.max(...M.flat().map(Math.abs)) || 1;
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12 * esc) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k];
    }
  }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
}

// ── álgebra lineal: CSR + CG precondicionado ────────────────────────────────
// (Se implementa aquí y NO se reusa `SparseSym`/`sparseCG` de brep/fea.ts porque
//  esa matriz vive en Map<number,number> por fila: el producto matriz-vector itera
//  Maps y a 20-40k GDL el gate tardaría minutos. Misma física, otra estructura.)
function cgResuelve(filas: Array<Map<number, number>>, f: Float64Array, tol: number, maxIter: number) {
  const n = filas.length;
  const ptr = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) ptr[i + 1] = ptr[i] + filas[i].size;
  const idx = new Int32Array(ptr[n]), val = new Float64Array(ptr[n]);
  for (let i = 0; i < n; i++) {
    const cols = [...filas[i].keys()].sort((a, b) => a - b);
    let p = ptr[i];
    for (const j of cols) { idx[p] = j; val[p] = filas[i].get(j)!; p++; }
  }
  const matvec = (x: Float64Array, y: Float64Array) => {
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let p = ptr[i]; p < ptr[i + 1]; p++) s += val[p] * x[idx[p]];
      y[i] = s;
    }
  };
  const ic = factorIC0(n, ptr, idx, val);
  const diagInv = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let d = 1;
    for (let p = ptr[i]; p < ptr[i + 1]; p++) if (idx[p] === i) d = val[p];
    diagInv[i] = 1 / (Math.abs(d) > 1e-300 ? d : 1);
  }
  const prec = ic
    ? (r: Float64Array, z: Float64Array) => aplicaIC0(ic, r, z)
    : (r: Float64Array, z: Float64Array) => { for (let i = 0; i < n; i++) z[i] = r[i] * diagInv[i]; };

  const u = new Float64Array(n), r = Float64Array.from(f), z = new Float64Array(n);
  const p2 = new Float64Array(n), Ap = new Float64Array(n);
  let nf = 0; for (let i = 0; i < n; i++) nf += f[i] * f[i];
  nf = Math.sqrt(nf) || 1;
  prec(r, z);
  p2.set(z);
  let rz = 0; for (let i = 0; i < n; i++) rz += r[i] * z[i];
  let it = 0, res = 1;
  for (; it < maxIter; it++) {
    matvec(p2, Ap);
    let pAp = 0; for (let i = 0; i < n; i++) pAp += p2[i] * Ap[i];
    if (Math.abs(pAp) < 1e-300) break;
    const al = rz / pAp;
    for (let i = 0; i < n; i++) { u[i] += al * p2[i]; r[i] -= al * Ap[i]; }
    let nr = 0; for (let i = 0; i < n; i++) nr += r[i] * r[i];
    res = Math.sqrt(nr) / nf;
    if (res < tol) { it++; break; }
    prec(r, z);
    let rz2 = 0; for (let i = 0; i < n; i++) rz2 += r[i] * z[i];
    const be = rz2 / rz; rz = rz2;
    for (let i = 0; i < n; i++) p2[i] = z[i] + be * p2[i];
  }
  return { u, iters: it, residuo: res, converge: res < tol * 10 };
}

interface IC0 { n: number; ptr: Int32Array; idx: Int32Array; val: Float64Array; diag: Float64Array }
/** Cholesky incompleto sin relleno sobre el patrón de tril(K). null si hay breakdown. */
function factorIC0(n: number, ptr: Int32Array, idx: Int32Array, val: Float64Array): IC0 | null {
  const lp = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) {
    let c = 0;
    for (let p = ptr[i]; p < ptr[i + 1]; p++) if (idx[p] < i) c++;
    lp[i + 1] = lp[i] + c;
  }
  const li = new Int32Array(lp[n]), lv = new Float64Array(lp[n]), diag = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let p = lp[i];
    for (let q = ptr[i]; q < ptr[i + 1]; q++) if (idx[q] < i) { li[p] = idx[q]; lv[p] = val[q]; p++; }
  }
  const pos = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    for (let p = lp[i]; p < lp[i + 1]; p++) pos[li[p]] = p;
    let dii = 0;
    for (let q = ptr[i]; q < ptr[i + 1]; q++) if (idx[q] === i) dii = val[q];
    for (let p = lp[i]; p < lp[i + 1]; p++) {
      const j = li[p];
      let s = lv[p];
      for (let q = lp[j]; q < lp[j + 1]; q++) {
        const k = li[q], pk = pos[k];
        if (pk >= 0) s -= lv[pk] * lv[q];
      }
      lv[p] = s / diag[j];
    }
    let acc = dii;
    for (let p = lp[i]; p < lp[i + 1]; p++) acc -= lv[p] * lv[p];
    if (!(acc > 1e-300)) { for (let p = lp[i]; p < lp[i + 1]; p++) pos[li[p]] = -1; return null; }
    diag[i] = Math.sqrt(acc);
    for (let p = lp[i]; p < lp[i + 1]; p++) pos[li[p]] = -1;
  }
  return { n, ptr: lp, idx: li, val: lv, diag };
}
function aplicaIC0(ic: IC0, r: Float64Array, z: Float64Array): void {
  const { n, ptr, idx, val, diag } = ic;
  for (let i = 0; i < n; i++) {
    let s = r[i];
    for (let p = ptr[i]; p < ptr[i + 1]; p++) s -= val[p] * z[idx[p]];
    z[i] = s / diag[i];
  }
  for (let i = n - 1; i >= 0; i--) {
    z[i] /= diag[i];
    for (let p = ptr[i]; p < ptr[i + 1]; p++) z[idx[p]] -= val[p] * z[i];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. KIRSCH ANALÍTICO — la vara con la que se mide V12.12
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Placa INFINITA con agujero circular de radio `a` bajo tracción uniaxial σ en x.
 * (Kirsch 1898; Timoshenko & Goodier §35.) Devuelve el tensor en polares.
 * En r = a: σθθ = σ(1 − 2cos2θ) ⇒ +3σ en θ=90° (Kt = 3.0 EXACTO) y −σ en θ=0.
 */
export function kirschPolar(sigma: number, a: number, r: number, th: number):
  { srr: number; stt: number; srt: number } {
  const c2 = Math.cos(2 * th), s2 = Math.sin(2 * th);
  const a2 = (a * a) / (r * r), a4 = a2 * a2;
  return {
    srr: (sigma / 2) * (1 - a2) + (sigma / 2) * (1 - 4 * a2 + 3 * a4) * c2,
    stt: (sigma / 2) * (1 + a2) - (sigma / 2) * (1 + 3 * a4) * c2,
    srt: -(sigma / 2) * (1 + 2 * a2 - 3 * a4) * s2,
  };
}

/** Tracción exacta de Kirsch sobre un borde circular de radio r (normal = e_r). */
export function kirschTraccion(sigma: number, a: number, x: number, y: number): [number, number] {
  const r = Math.hypot(x, y), th = Math.atan2(y, x);
  const { srr, srt } = kirschPolar(sigma, a, r, th);
  const c = Math.cos(th), s = Math.sin(th);
  return [srr * c - srt * s, srr * s + srt * c];
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. EL MODELO DE LA SECCIÓN DEL MOLDE
// ═══════════════════════════════════════════════════════════════════════════

export interface PlacasSeccion {
  bottomClamp: number; ejectorHousing: number; support: number;
  B: number; A: number; topClamp: number;
}

export interface ModeloSeccion {
  nombre: string;
  /** ancho del molde en el corte (mm) */
  anchoMm: number;
  placas: PlacasSeccion;
  /** ancho del riel del ejector housing (mm) — el claro libre es ancho − 2·riel */
  rielMm: number;
  /** cavidad: ancho y espesor del bolsillo, centrado en x y APOYADO en el plano de partición */
  cavidadAnchoMm: number;
  cavidadEspesorMm: number;
  pFundidoMPa: number;
  barrenos: BarrenoSpec[];
  material: 'P20' | 'QC7';
  ciclos?: number;
  hMallaMm?: number;
  divBarreno?: number;
  /** notas de procedencia de los datos que NO son literales del libro */
  procedencia: string[];
}

export interface BarrenoMedido {
  etiqueta: string; tipo: string; x: number; y: number; diaMm: number;
  /** distancia superficie de cavidad → CENTRO del barreno (mm) */
  HMm: number;
  /** H en múltiplos del diámetro (el eje de la Fig 12.23) */
  HenDiametros: number;
  /** K medido por EF = máx σ_vm en el borde del barreno / σ_vm en ese punto SIN barreno */
  kFEM: number;
  sigmaMaxMPa: number;
  sigmaNominalMPa: number;
  /** el modelo del libro §12.2.6 para contraste (no para sustituir la medición) */
  kLibro: number;
  lado: 'fijo' | 'móvil';
  /** true si σ_nominal es tan bajo que K queda mal condicionado (hueco cerca de la
   *  fibra neutra): el número que importa ahí es σ_max, no el cociente. */
  nominalDebil: boolean;
}

/**
 * Estado de flexión de la placa portante de un lado — la prueba LITERAL de V12.2.
 * σxx(y) sobre el espesor de la placa a media luz se parte, por mínimos cuadrados
 * PESADOS POR ÁREA sobre los elementos de una franja, en:
 *   MEMBRANA = σxx promedio (compresión pura ⇒ negativo y sin flexión)
 *   FLEXIÓN  = amplitud en la fibra extrema (el "out of plane bending" del libro)
 * Es una INTEGRAL, no un muestreo puntual: no depende de dónde cayeron los nodos.
 */
export interface FibrasLado {
  /** rango en y de la placa portante (mm) y x de la franja */
  y0: number; y1: number; xFranja: number; anchoFranjaMm: number;
  membranaMPa: number;
  /** amplitud de flexión en la fibra extrema (MPa) */
  flexionMPa: number;
  /** σxx en la fibra inferior y superior según el ajuste (MPa) */
  sxxInfMPa: number; sxxSupMPa: number;
  /** σyy medio de la franja: la COMPRESIÓN que baja hacia la platina (negativo) */
  compresionYYMPa: number;
  nElem: number;
}

export interface CampoVonMises {
  modelo: ModeloSeccion;
  malla: Malla2D;
  sol: Solucion2D;
  /** y del plano de partición (mm) */
  yParticion: number;
  /** interfaces de placa en y (mm), para dibujarlas */
  yPlacas: Array<{ y: number; nombre: string }>;
  vacios: Array<{ x0: number; y0: number; x1: number; y1: number; nombre: string }>;
  limite: LimiteMaterial;
  /** σ_vm máximo CONVERGENTE (fuera de los discos singulares de las esquinas vivas) */
  sigmaMaxMPa: number;
  sigmaMaxEn: [number, number];
  /** pico EN las esquinas vivas del bolsillo: SINGULARIDAD, NO converge con la malla */
  sigmaEsquinaMPa: number;
  rSingularidadMm: number;
  esquinas: Array<[number, number]>;
  /** % del ÁREA de la sección con σ_vm > σ_limit (null si no hay σ_limit) */
  pctSobreLimite: number | null;
  areaExcluidaMm2: number;
  lados: Record<'fijo' | 'móvil', {
    sigmaMaxMPa: number; sigma1MaxMPa: number; tauMaxMPa: number;
    sigmaMediaMPa: number; pctSobreLimite: number | null; areaMm2: number;
    fibras: FibrasLado;
  }>;
  /** σ_vm máx móvil / fijo */
  asimetria: number;
  /** amplitud de flexión móvil / fijo — el discriminador literal de §12.1.1 */
  asimetriaFlexion: number;
  barrenos: BarrenoMedido[];
  /** lo que esta lámina NO calcula y por lo tanto NO puede aprobar */
  sinCablear: string[];
  msSolver: number;
}

/**
 * Arma la sección, la resuelve DOS veces (con barrenos y sin barrenos) y mide.
 * El segundo solve es la referencia para K: K = σ_vm máx en el borde del barreno
 * dividido entre el σ_vm que habría EN ESE MISMO PUNTO si el barreno no existiera.
 * Esa es la definición de libro de factor de concentración — no un ajuste.
 */
export function campoVonMises(mod: ModeloSeccion): CampoVonMises {
  const t0 = Date.now();
  const P = mod.placas;
  const W = mod.anchoMm;
  const yBC = P.bottomClamp;
  const yEH = yBC + P.ejectorHousing;
  const ySup = yEH + P.support;
  const yPart = ySup + P.B;
  const yA = yPart + P.A;
  const H = yA + P.topClamp;

  const cavX0 = (W - mod.cavidadAnchoMm) / 2, cavX1 = (W + mod.cavidadAnchoMm) / 2;
  const vacios = [
    { x0: mod.rielMm, y0: yBC, x1: W - mod.rielMm, y1: yEH, nombre: 'bolsillo del expulsor' },
    { x0: cavX0, y0: yPart, x1: cavX1, y1: yPart + mod.cavidadEspesorMm, nombre: 'cavidad' },
  ];
  const cortesY = [yBC, yEH, ySup, yPart, yPart + mod.cavidadEspesorMm, yA];
  const spec: SeccionSpec = {
    anchoMm: W, altoMm: H, vacios, barrenos: mod.barrenos,
    hMm: mod.hMallaMm ?? 7, divBarreno: mod.divBarreno ?? 12,
    cortesX: [mod.rielMm, W - mod.rielMm, cavX0, cavX1], cortesY,
  };
  const cruda = mallaSeccion(spec);
  const malla = partirMalla(cruda.malla, yPart);       // dos cuerpos, no uno soldado
  const barrenosMallados = cruda.barrenosMallados;
  const sol = resolver(malla, mod, vacios[1], H, yPart);

  // referencia SIN barrenos (misma geometría, agujeros cerrados)
  const refCruda = mallaSeccion({ ...spec, sinBarrenos: true });
  const ref = { malla: partirMalla(refCruda.malla, yPart) };
  const solRef = resolver(ref.malla, mod, vacios[1], H, yPart);

  // ── SINGULARIDAD DECLARADA: las esquinas VIVAS del bolsillo de cavidad son un
  //    ángulo re-entrante ⇒ el esfuerzo ahí NO converge (crece al refinar la malla).
  //    Igual las 4 esquinas del bolsillo del expulsor. Medido: el pico crece sin parar
  //    al refinar (543 → 664 MPa de h=10 a h=4.5 mm) mientras TODO lo demás converge.
  //    Se apartan en discos DECLARADOS y se reportan por separado: pintar ese pico como
  //    si fuera un dato sería exactamente la mentira que este pliego existe para cazar.
  const yCavTecho = yPart + mod.cavidadEspesorMm;
  const esquinas: Array<[number, number]> = vacios.flatMap((v) =>
    [[v.x0, v.y0], [v.x1, v.y0], [v.x0, v.y1], [v.x1, v.y1]] as Array<[number, number]>);
  const rSing = Math.max(20, 3 * (mod.hMallaMm ?? 7));
  const singular = (x: number, y: number) => esquinas.some((e) => Math.hypot(x - e[0], y - e[1]) < rSing);

  const lim = limiteMaterial(mod.material, mod.ciclos);
  const sl = lim.sigmaLimitMPa;

  let sigmaMax = 0, sigmaMaxEn: [number, number] = [0, 0], sigmaEsq = 0;
  for (let i = 0; i < malla.nNodos; i++) {
    const x = malla.xy[2 * i], y = malla.xy[2 * i + 1];
    if (singular(x, y)) { sigmaEsq = Math.max(sigmaEsq, sol.vm[i]); continue; }
    if (sol.vm[i] > sigmaMax) { sigmaMax = sol.vm[i]; sigmaMaxEn = [x, y]; }
  }

  const acc = {
    fijo: { s: 0, s1: 0, tau: 0, sum: 0, area: 0, over: 0 },
    'móvil': { s: 0, s1: 0, tau: 0, sum: 0, area: 0, over: 0 },
  } as Record<'fijo' | 'móvil', { s: number; s1: number; tau: number; sum: number; area: number; over: number }>;
  let areaTot = 0, areaOver = 0, areaExcl = 0;
  for (let e = 0; e < malla.nQuads; e++) {
    let xc = 0, yc = 0;
    for (let k = 0; k < 4; k++) { xc += malla.xy[2 * malla.quads[4 * e + k]]; yc += malla.xy[2 * malla.quads[4 * e + k] + 1]; }
    xc /= 4; yc /= 4;
    const A = sol.areaElem[e];
    if (singular(xc, yc)) { areaExcl += A; continue; }
    const lado: 'fijo' | 'móvil' = yc >= yPart ? 'fijo' : 'móvil';
    const a2 = acc[lado];
    a2.area += A; a2.sum += sol.vmElem[e] * A;
    areaTot += A;
    if (sl != null && sol.vmElem[e] > sl) { a2.over += A; areaOver += A; }
    for (let k = 0; k < 4; k++) {
      const nd = malla.quads[4 * e + k];
      a2.s = Math.max(a2.s, sol.vm[nd]);
      a2.s1 = Math.max(a2.s1, sol.s1[nd]);
      a2.tau = Math.max(a2.tau, sol.tauMax[nd]);
    }
  }

  // ── LA PRUEBA LITERAL DE V12.2: flexión de la placa portante de cada lado.
  //    fijo  = paquete A + top clamp, del techo de cavidad a la platina.
  //    móvil = soporte + B, del techo del bolsillo del expulsor al piso de cavidad.
  //    La franja se coloca cerca de media luz PERO en la columna más limpia de
  //    barrenos (si cruzara un barreno mediría el agujero, no la placa).
  const xm = franjaLimpia(W, mod.barrenos);
  const anchoFranja = 16;
  const fibrasMovil = descomponeFranja(malla, sol, xm, anchoFranja, yEH, yPart, singular);
  const fibrasFijo = descomponeFranja(malla, sol, xm, anchoFranja, yCavTecho, H, singular);

  const lados = {
    fijo: {
      sigmaMaxMPa: acc.fijo.s, sigma1MaxMPa: acc.fijo.s1, tauMaxMPa: acc.fijo.tau,
      sigmaMediaMPa: acc.fijo.sum / Math.max(1e-9, acc.fijo.area),
      pctSobreLimite: sl == null ? null : (100 * acc.fijo.over) / Math.max(1e-9, acc.fijo.area),
      areaMm2: acc.fijo.area, fibras: fibrasFijo,
    },
    'móvil': {
      sigmaMaxMPa: acc['móvil'].s, sigma1MaxMPa: acc['móvil'].s1, tauMaxMPa: acc['móvil'].tau,
      sigmaMediaMPa: acc['móvil'].sum / Math.max(1e-9, acc['móvil'].area),
      pctSobreLimite: sl == null ? null : (100 * acc['móvil'].over) / Math.max(1e-9, acc['móvil'].area),
      areaMm2: acc['móvil'].area, fibras: fibrasMovil,
    },
  };

  // ── K por barreno (medido, no ajustado)
  const medidos: BarrenoMedido[] = barrenosMallados.map((b) => {
    const a = b.diaMm / 2;
    let smax = 0;
    for (let i = 0; i < malla.nNodos; i++) {
      const dx = malla.xy[2 * i] - b.x, dy = malla.xy[2 * i + 1] - b.y;
      if (Math.abs(Math.hypot(dx, dy) - a) < a * 0.02) smax = Math.max(smax, sol.vm[i]);
    }
    // σ nominal = el campo SIN barreno en ese punto, por ajuste lineal local (suave:
    // tomar el nodo más cercano hacía saltar K un ±8 % al cambiar la malla).
    const nom = ajusteLocal(ref.malla, solRef.vm, b.x, b.y, Math.max(2 * b.diaMm, 2.2 * (mod.hMallaMm ?? 7)));
    // distancia a la SUPERFICIE de cavidad más cercana (techo, piso o costados del bolsillo)
    const dx0 = Math.max(cavX0 - b.x, 0, b.x - cavX1);
    const dyTecho = b.y >= yCavTecho ? b.y - yCavTecho : b.y <= yPart ? yPart - b.y : 0;
    const HH = Math.max(Math.hypot(dx0, dyTecho), 1e-6);
    return {
      etiqueta: b.etiqueta ?? b.tipo, tipo: b.tipo, x: b.x, y: b.y, diaMm: b.diaMm,
      HMm: HH, HenDiametros: HH / b.diaMm,
      kFEM: smax / Math.max(1e-9, nom), sigmaMaxMPa: smax, sigmaNominalMPa: nom,
      kLibro: kBarrenoLibro(b.diaMm, HH),
      lado: b.y >= yPart ? 'fijo' : 'móvil',
      nominalDebil: nom < 0.15 * Math.max(1e-9, sigmaMax),
    };
  });

  const noPerp = mod.barrenos.filter((b) => !b.ejePerpendicular);
  const sinCablear = [
    `esquinas VIVAS del bolsillo: SINGULARIDAD (pico ${sigmaEsq.toFixed(0)} MPa que CRECE al refinar) — apartadas en un disco de ${rSing.toFixed(0)} mm y NO usadas en el veredicto; el molde real lleva radio ahí`,
    'las dos mitades van SEPARADAS y SIN CONTACTO en el plano de partición: el modelo no transmite el apriete de cierre ni predice la APERTURA del plano — eso es la L20 (§12.1.2), aquí NO se mide',
    'fuerza de cierre de la máquina: no aplicada (sólo la presión de fundido de la Fig 12.2)',
    'esfuerzo térmico, precarga de tornillos y residual de temple: fuera del modelo',
    'efectos 3D (esquinas de la cavidad, rigidez fuera del plano): la sección es 2D en deformación plana',
  ];
  if (noPerp.length) {
    sinCablear.push(`${noPerp.length} barreno(s) con eje CONTENIDO en el corte (${[...new Set(noPerp.map((b) => b.tipo))].join(', ')}): no salen redondos en esta vista ⇒ su K NO se mide aquí (va en planta, L1)`);
  }

  return {
    modelo: mod, malla, sol, yParticion: yPart,
    yPlacas: [
      { y: yBC, nombre: 'clamp inferior' }, { y: yEH, nombre: 'housing' },
      { y: ySup, nombre: 'soporte' }, { y: yPart, nombre: 'PARTICIÓN' },
      { y: yA, nombre: 'placa A' },
    ],
    vacios, limite: lim,
    sigmaMaxMPa: sigmaMax, sigmaMaxEn,
    sigmaEsquinaMPa: sigmaEsq, rSingularidadMm: rSing, esquinas,
    pctSobreLimite: sl == null ? null : (100 * areaOver) / Math.max(1e-9, areaTot),
    areaExcluidaMm2: areaExcl,
    lados, asimetria: lados['móvil'].sigmaMaxMPa / Math.max(1e-9, lados.fijo.sigmaMaxMPa),
    asimetriaFlexion: Math.abs(fibrasMovil.flexionMPa) / Math.max(1e-9, Math.abs(fibrasFijo.flexionMPa)),
    barrenos: medidos, sinCablear, msSolver: Date.now() - t0,
  };
}

/**
 * Resuelve la sección: DOS cuerpos separados en el plano de partición.
 *  · lado FIJO  (y > yPart): la presión de fundido empuja el TECHO y los COSTADOS
 *    del bolsillo de cavidad; reacciona la platina fija (uy = 0 en y = H).
 *  · lado MÓVIL (y < yPart): la presión empuja HACIA ABAJO la huella de la cavidad
 *    sobre su cara de partición; reacciona la platina móvil (uy = 0 en y = 0).
 * Cada cuerpo lleva su propia ancla en x (un solo nodo) para quitar el modo rígido.
 * Con esto la resultante que baja a cada platina es EXACTAMENTE p·w_cavidad, y eso
 * se verifica en el gate (equilibrio global).
 */
function resolver(m: Malla2D, mod: ModeloSeccion, cav: { x0: number; y0: number; x1: number; y1: number },
  H: number, yPart: number): Solucion2D {
  const libres = bordesLibres(m);
  const enCav = (b: BordeLibre) =>
    b.mx >= cav.x0 - 1e-6 && b.mx <= cav.x1 + 1e-6 && b.my >= cav.y0 - 1e-6 && b.my <= cav.y1 + 1e-6;
  const presiones: CargaPresion[] = libres.filter(enCav).map((b) => ({ a: b.a, b: b.b, pMPa: mod.pFundidoMPa }));
  const fijos: Array<{ nodo: number; ux?: boolean; uy?: boolean }> = [];
  let anclaAbajo = -1, dAbajo = Infinity, anclaArriba = -1, dArriba = Infinity;
  for (let i = 0; i < m.nNodos; i++) {
    const x = m.xy[2 * i], y = m.xy[2 * i + 1];
    const d = Math.abs(x - mod.anchoMm / 2);
    if (y < 1e-6) { fijos.push({ nodo: i, uy: true }); if (d < dAbajo) { dAbajo = d; anclaAbajo = i; } }
    if (y > H - 1e-6) { fijos.push({ nodo: i, uy: true }); if (d < dArriba) { dArriba = d; anclaArriba = i; } }
  }
  if (anclaAbajo >= 0) fijos.push({ nodo: anclaAbajo, ux: true });
  if (anclaArriba >= 0) fijos.push({ nodo: anclaArriba, ux: true });
  return resolverElasticidad2D(m, { estado: 'deformacion-plana', fijos, presiones, tol: 1e-11, maxIter: 60000 });
}

/**
 * Resultante vertical ∫σyy dx sobre la LÍNEA horizontal y = yc: se corta cada elemento
 * con la línea y se integra σyy (interpolado a los dos puntos de corte) por la longitud
 * del segmento. Es una INTEGRAL DE LÍNEA de verdad — promediar una franja de elementos
 * sesgaba hasta 2 % donde la malla no viene en filas parejas (los anillos de barreno).
 * Es el check de EQUILIBRIO GLOBAL del modelo: debe dar −p·w_cavidad en CUALQUIER y.
 */
export function resultanteYY(m: Malla2D, sol: Solucion2D, yc: number): number {
  let R = 0;
  for (let e = 0; e < m.nQuads; e++) {
    let xa = Infinity, xb = -Infinity, sa = 0, sb = 0;
    for (let k = 0; k < 4; k++) {
      const p = m.quads[4 * e + k], q = m.quads[4 * e + ((k + 1) % 4)];
      const y0 = m.xy[2 * p + 1], y1 = m.xy[2 * q + 1];
      // regla SEMIABIERTA [y0, y1): si la línea cae justo sobre una fila de nodos, sólo
      // cuenta el elemento de ARRIBA. Sin esto la sección se contaba DOS veces (medido:
      // 2× el valor exacto en los cortes que caían sobre línea de malla).
      if (!((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc))) continue;
      const t = (yc - y0) / (y1 - y0);
      const x = m.xy[2 * p] + t * (m.xy[2 * q] - m.xy[2 * p]);
      const s = sol.syy[p] + t * (sol.syy[q] - sol.syy[p]);
      if (x < xa) { xa = x; sa = s; }
      if (x > xb) { xb = x; sb = s; }
    }
    if (xb > xa) R += ((sa + sb) / 2) * (xb - xa);
  }
  return R;
}

/** La x cerca de media luz que más lejos queda de cualquier barreno (franja limpia). */
function franjaLimpia(W: number, barrenos: BarrenoSpec[]): number {
  let mejor = W / 2, mejorD = -1;
  for (let x = W * 0.3; x <= W * 0.7; x += 0.5) {
    let d = Infinity;
    for (const b of barrenos) d = Math.min(d, Math.abs(x - b.x) - b.diaMm / 2);
    // se prefiere lejos de barrenos y, a igualdad, cerca del centro
    const score = d - 0.02 * Math.abs(x - W / 2);
    if (score > mejorD) { mejorD = score; mejor = x; }
  }
  return mejor;
}

/**
 * Descompone σxx(y) de una placa en MEMBRANA + FLEXIÓN por mínimos cuadrados
 * pesados por área sobre los elementos de la franja [x±w/2] × [y0,y1].
 * σxx ≈ m + f·(y−ȳ)/c  con c = semi-espesor ⇒ f es la amplitud en la fibra extrema.
 */
function descomponeFranja(m: Malla2D, sol: Solucion2D, xc: number, w: number, y0: number, y1: number,
  excluir: (x: number, y: number) => boolean): FibrasLado {
  const ys: number[] = [], ss: number[] = [], ws: number[] = [];
  let syyA = 0, areaYY = 0;
  for (let e = 0; e < m.nQuads; e++) {
    let x = 0, y = 0, s = 0, sy = 0;
    for (let k = 0; k < 4; k++) {
      const nd = m.quads[4 * e + k];
      x += m.xy[2 * nd]; y += m.xy[2 * nd + 1]; s += sol.sxx[nd]; sy += sol.syy[nd];
    }
    x /= 4; y /= 4; s /= 4; sy /= 4;
    if (Math.abs(x - xc) > w / 2 || y < y0 || y > y1 || excluir(x, y)) continue;
    ys.push(y); ss.push(s); ws.push(sol.areaElem[e]);
    syyA += sy * sol.areaElem[e]; areaYY += sol.areaElem[e];
  }
  const cYY = areaYY > 0 ? syyA / areaYY : 0;
  const base: FibrasLado = { y0, y1, xFranja: xc, anchoFranjaMm: w, membranaMPa: 0, flexionMPa: 0, sxxInfMPa: 0, sxxSupMPa: 0, compresionYYMPa: cYY, nElem: ys.length };
  if (ys.length < 4) return base;
  let A = 0, ybar = 0;
  for (let i = 0; i < ys.length; i++) { A += ws[i]; ybar += ys[i] * ws[i]; }
  ybar /= A;
  const c = (y1 - y0) / 2;
  let Sww = 0, Sw = 0, Sq = 0, Sy = 0;
  for (let i = 0; i < ys.length; i++) {
    const t = (ys[i] - ybar) / c;
    Sw += ws[i]; Sww += ws[i] * t; Sq += ws[i] * t * t;
    Sy += ws[i] * ss[i];
  }
  let Syt = 0;
  for (let i = 0; i < ys.length; i++) Syt += ws[i] * ss[i] * ((ys[i] - ybar) / c);
  // sistema 2×2: [Sw Sww; Sww Sq]·[m;f] = [Sy; Syt]
  const det = Sw * Sq - Sww * Sww;
  if (Math.abs(det) < 1e-12) return base;
  const mem = (Sy * Sq - Syt * Sww) / det;
  const fl = (Sw * Syt - Sww * Sy) / det;
  return { ...base, membranaMPa: mem, flexionMPa: fl, sxxInfMPa: mem - fl, sxxSupMPa: mem + fl };
}

/**
 * Muestrea un campo nodal en (x,y) con un AJUSTE LINEAL local por mínimos cuadrados
 * sobre los nodos dentro de `R`. Se usa para leer el campo de referencia (sin barreno)
 * y las fibras de flexión: tomar el nodo más cercano hacía saltar los cocientes hasta
 * ±8 % con sólo cambiar el tamaño de malla — o sea, medía la malla, no la física.
 * Si el radio no junta suficientes nodos, se agranda hasta lograrlo.
 */
export function ajusteLocal(m: Malla2D, campo: Float64Array, x: number, y: number, R: number): number {
  for (let intento = 0; intento < 6; intento++) {
    const r = R * Math.pow(1.6, intento);
    const A = [0, 0, 0, 0, 0, 0, 0, 0, 0], b = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < m.nNodos; i++) {
      const dx = m.xy[2 * i] - x, dy = m.xy[2 * i + 1] - y;
      if (dx * dx + dy * dy > r * r) continue;
      const P = [1, dx / r, dy / r];
      for (let p = 0; p < 3; p++) { for (let q = 0; q < 3; q++) A[3 * p + q] += P[p] * P[q]; b[p] += P[p] * campo[i]; }
      n++;
    }
    if (n < 6) continue;
    const s = resuelve3x3(A, b);
    if (s) return s[0];
  }
  // respaldo: nodo más cercano
  let best = Infinity, v = 0;
  for (let i = 0; i < m.nNodos; i++) {
    const d = (m.xy[2 * i] - x) ** 2 + (m.xy[2 * i + 1] - y) ** 2;
    if (d < best) { best = d; v = campo[i]; }
  }
  return v;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. LA LÁMINA
// ═══════════════════════════════════════════════════════════════════════════

const CSS_L19 = `
  .bg{fill:#0b0f16}
  .tit{fill:#e9eef5;font:700 19px 'JetBrains Mono',monospace}
  .sub{fill:#8fa3bd;font:400 12px 'JetBrains Mono',monospace}
  .cita{fill:#c9a227;font:700 12px 'JetBrains Mono',monospace}
  .lbl{fill:#c3d0e0;font:400 11.5px 'JetBrains Mono',monospace}
  .lblSm{fill:#8fa3bd;font:400 10px 'JetBrains Mono',monospace}
  .num{fill:#e9eef5;font:700 12.5px 'JetBrains Mono',monospace}
  .ok{fill:#59d98c} .mal{fill:#ff5c5c} .warn{fill:#ffb347}
`;

/**
 * ESCALA FIJA anclada al σ_limit — NO se auto-escala por percentiles.
 * 10 bandas de 0.1·σ_limit + una banda de DESBORDE (> σ_limit) en rojo plano.
 * Dos diseños con el mismo material son comparables píxel a píxel; ése es el
 * requisito explícito de V12.2 ("escala de color fija ... para poder comparar").
 */
export const N_BANDAS = 10;
const RAMPA: Array<[number, number, number]> = [
  [0.07, 0.13, 0.32], [0.09, 0.24, 0.55], [0.10, 0.40, 0.72], [0.11, 0.57, 0.72],
  [0.16, 0.70, 0.55], [0.36, 0.78, 0.34], [0.70, 0.82, 0.20], [0.93, 0.72, 0.15],
  [0.96, 0.50, 0.11], [0.86, 0.25, 0.13],
];
const DESBORDE = '#ff2b3d';
const hex = (c: [number, number, number]) =>
  '#' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
/** banda 0..N_BANDAS-1 para σ/σ_limit; N_BANDAS = desborde. */
export function bandaDe(sigma: number, sigmaLimit: number): number {
  const t = sigma / sigmaLimit;
  if (t >= 1) return N_BANDAS;
  return Math.max(0, Math.min(N_BANDAS - 1, Math.floor(t * N_BANDAS)));
}
export const colorBanda = (b: number): string => (b >= N_BANDAS ? DESBORDE : hex(RAMPA[b]));

export interface OpcLaminaVM {
  /** banda al 95 % de σ_max (GCI de Roache · ASME V&V 20). Si falta, la lámina lo DICE:
   *  un número de simulación sin incertidumbre no es un resultado, es una opinión con
   *  decimales. La calcula el llamador con TRES mallas refinadas a la misma razón. */
  banda95MPa?: number;
  /** false ⇒ la banda es INDICATIVA, no garantía (fuera del rango asintótico) */
  enRangoAsintotico?: boolean;
}

export function laminaVonMises(c: CampoVonMises, o: OpcLaminaVM = {}): Lamina {
  const W = 1080, H = 760;
  const PADX = 38, TOP = 124;
  const anchoDib = 462, altoDib = 470;
  const mod = c.modelo;
  const Hsec = mod.placas.bottomClamp + mod.placas.ejectorHousing + mod.placas.support
    + mod.placas.B + mod.placas.A + mod.placas.topClamp;
  const k = Math.min(anchoDib / mod.anchoMm, altoDib / Hsec);
  const ox = PADX + (anchoDib - mod.anchoMm * k) / 2;
  const oy = TOP;
  const px = (x: number) => ox + x * k;
  const py = (y: number) => oy + (Hsec - y) * k;      // y del molde hacia ARRIBA

  const lim = c.limite;
  // Sin σ_limit no hay escala fija posible: la lámina lo DICE y pinta en gris.
  const sl = lim.sigmaLimitMPa;
  const paths: string[][] = Array.from({ length: N_BANDAS + 1 }, () => []);
  const m = c.malla;
  for (let e = 0; e < m.nQuads; e++) {
    const b = sl == null ? -1 : bandaDe(c.sol.vmElem[e], sl);
    const d: string[] = [];
    for (let q = 0; q < 4; q++) {
      const n = m.quads[4 * e + q];
      d.push(`${px(m.xy[2 * n]).toFixed(1)},${py(m.xy[2 * n + 1]).toFixed(1)}`);
    }
    paths[b < 0 ? 0 : b].push(`M${d[0]}L${d[1]}L${d[2]}L${d[3]}Z`);
  }
  const campo = paths.map((p, b) => p.length
    ? `<path d="${p.join('')}" fill="${sl == null ? '#33415a' : colorBanda(b)}" stroke="none"/>` : '').join('');

  // barrenos: círculo + su K medido
  const barr = c.barrenos.map((b) => {
    const r = Math.max(2.4, (b.diaMm / 2) * k);
    const col = b.kFEM >= 3 ? '#ff9f43' : '#e9eef5';
    return `<circle cx="${px(b.x).toFixed(1)}" cy="${py(b.y).toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${col}" stroke-width="1.4"/>`
      + `<circle cx="${px(b.x).toFixed(1)}" cy="${py(b.y).toFixed(1)}" r="${(r * 2.6).toFixed(1)}" fill="none" stroke="${col}" stroke-width="0.7" stroke-dasharray="2 3" opacity="0.55"/>`;
  }).join('');

  // contornos: cavidad, bolsillo, interfaces de placa, plano de partición
  const rect = (v: { x0: number; y0: number; x1: number; y1: number }, st: string, extra = '') =>
    `<rect x="${px(v.x0).toFixed(1)}" y="${py(v.y1).toFixed(1)}" width="${((v.x1 - v.x0) * k).toFixed(1)}" height="${((v.y1 - v.y0) * k).toFixed(1)}" fill="none" stroke="${st}" stroke-width="1.2" ${extra}/>`;
  const contornos = c.vacios.map((v) => rect(v, '#6f819b')).join('')
    + c.yPlacas.map((p) => p.nombre === 'PARTICIÓN'
      ? `<line x1="${px(0).toFixed(1)}" y1="${py(p.y).toFixed(1)}" x2="${px(mod.anchoMm).toFixed(1)}" y2="${py(p.y).toFixed(1)}" stroke="#c9a227" stroke-width="1.5" stroke-dasharray="7 4"/>`
      : `<line x1="${px(0).toFixed(1)}" y1="${py(p.y).toFixed(1)}" x2="${px(mod.anchoMm).toFixed(1)}" y2="${py(p.y).toFixed(1)}" stroke="#46566e" stroke-width="0.8" opacity="0.7"/>`).join('')
    + `<rect x="${px(0).toFixed(1)}" y="${py(Hsec).toFixed(1)}" width="${(mod.anchoMm * k).toFixed(1)}" height="${(Hsec * k).toFixed(1)}" fill="none" stroke="#8fa3bd" stroke-width="1.4"/>`;

  // apoyos de platina (rayado) arriba y abajo
  const rayado = (yy: number, arriba: boolean) => {
    const out: string[] = [];
    for (let x = 0; x <= mod.anchoMm; x += 14) {
      const X = px(x), Y = py(yy);
      out.push(`<line x1="${X.toFixed(1)}" y1="${Y.toFixed(1)}" x2="${(X - 6).toFixed(1)}" y2="${(Y + (arriba ? -7 : 7)).toFixed(1)}" stroke="#5c6f8a" stroke-width="1"/>`);
    }
    return out.join('');
  };

  // flechas de presión dentro de la cavidad (la carga que manda, V12.1)
  const cav = c.vacios.find((v) => v.nombre === 'cavidad')!;
  const flechas: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const x = cav.x0 + ((cav.x1 - cav.x0) * i) / 6;
    const yc = (cav.y0 + cav.y1) / 2;
    flechas.push(`<line x1="${px(x).toFixed(1)}" y1="${py(yc).toFixed(1)}" x2="${px(x).toFixed(1)}" y2="${(py(cav.y1) - 7).toFixed(1)}" stroke="#6db3f2" stroke-width="1.3"/>`);
    flechas.push(`<line x1="${px(x).toFixed(1)}" y1="${py(yc).toFixed(1)}" x2="${px(x).toFixed(1)}" y2="${(py(cav.y0) + 7).toFixed(1)}" stroke="#6db3f2" stroke-width="1.3"/>`);
  }

  // ── barra de escala FIJA (bajo el dibujo, con las notas de lectura encima)
  const bx = PADX, by = TOP + altoDib + 76, bw = anchoDib, bh = 14;
  const cell = bw / (N_BANDAS + 1);
  const escala = Array.from({ length: N_BANDAS + 1 }, (_, b) =>
    `<rect x="${(bx + b * cell).toFixed(1)}" y="${by}" width="${(cell + 0.5).toFixed(1)}" height="${bh}" fill="${sl == null ? '#33415a' : colorBanda(b)}"/>`).join('')
    + (sl == null ? `<text class="warn" x="${bx}" y="${by + bh + 13}">SIN σ_limit ⇒ SIN ESCALA: el campo va en gris, no se aprueba nada</text>`
      : [0, 2, 4, 6, 8, 10].map((b) =>
        `<text class="lblSm" x="${(bx + b * cell).toFixed(1)}" y="${by + bh + 12}">${((b / N_BANDAS) * sl).toFixed(0)}</text>`).join('')
      + `<text class="lblSm" text-anchor="end" x="${(bx + bw).toFixed(1)}" y="${by + bh + 12}">MPa</text>`
      + `<text class="lblSm" text-anchor="end" x="${(bx + bw).toFixed(1)}" y="${by - 4}">&gt; σ_limit</text>`
      + `<text class="lblSm" x="${bx}" y="${by - 4}">ESCALA FIJA a σ_limit · 10 bandas de ${(sl / 10).toFixed(0)} MPa · NO auto-escalada</text>`);

  // ── notas de lectura del dibujo (DEBAJO del dibujo, nunca encima)
  const yNota = TOP + altoDib + 12;
  const notas = [
    `rojo punteado = esquina VIVA: SINGULARIDAD, pico ${c.sigmaEsquinaMPa.toFixed(0)} MPa que CRECE al refinar`,
    'franja blanca = donde se mide compresión vs flexión de la placa portante',
    'anillos naranja = barrenos con su K medido · flechas = presión de fundido',
    'rayado arriba y abajo = apoyo de platina (uy = 0, deslizante en x)',
  ].map((t, i) => `<text class="${i === 0 ? 'mal' : 'lblSm'}" style="font:400 10px 'JetBrains Mono',monospace" x="${PADX}" y="${yNota + i * 13}">${ESC(t)}</text>`).join('');

  // ── panel derecho
  const RX = PADX + anchoDib + 32;
  const RW = W - RX - 24;
  const L: string[] = [];
  let yy = TOP + 4;
  const row = (t: string, cls = 'lbl', dy = 16) => { L.push(`<text class="${cls}" x="${RX}" y="${yy}">${t}</text>`); yy += dy; };
  const num = (n: number | null, d = 1) => (n == null ? '—' : n.toFixed(d));
  const CHARS = Math.floor(RW / 6.02);      // ancho útil en caracteres a 10 px mono

  row('V12.2 · ASIMETRÍA LADO FIJO ↔ LADO MÓVIL', 'cita', 19);
  row('"[the stationary side is] generally in a state of pure', 'lblSm', 11.5);
  row('compression so very little out of plane bending occurs"; el móvil', 'lblSm', 11.5);
  row('"must transmit the load via both compressive and shear stresses', 'lblSm', 11.5);
  row('... significant plate bending."  §12.1.1', 'lblSm', 15);

  const f = c.lados.fijo, mv = c.lados['móvil'];
  const cabecera = ['', 'FIJO', 'MÓVIL'];
  const filas: Array<[string, string, string]> = [
    ['σ_vm max  [MPa]', num(f.sigmaMaxMPa), num(mv.sigmaMaxMPa)],
    ['σ1 max (TRACCIÓN)', num(f.sigma1MaxMPa), num(mv.sigma1MaxMPa)],
    ['τ max     [MPa]', num(f.tauMaxMPa), num(mv.tauMaxMPa)],
    ['σ_vm media [MPa]', num(f.sigmaMediaMPa), num(mv.sigmaMediaMPa)],
    ['% área > σ_limit', num(f.pctSobreLimite, 2), num(mv.pctSobreLimite, 2)],
    ['COMPRESIÓN σyy', num(f.fibras.compresionYYMPa), num(mv.fibras.compresionYYMPa)],
    ['FLEXIÓN ±σxx', num(Math.abs(f.fibras.flexionMPa)), num(Math.abs(mv.fibras.flexionMPa))],
  ];
  L.push(`<text class="lblSm" x="${RX}" y="${yy}">${cabecera[0]}</text>`
    + `<text class="lblSm" x="${RX + 235}" y="${yy}">${cabecera[1]}</text>`
    + `<text class="lblSm" x="${RX + 345}" y="${yy}">${cabecera[2]}</text>`);
  yy += 15;
  for (const r of filas) {
    L.push(`<text class="lbl" x="${RX}" y="${yy}">${ESC(r[0])}</text>`
      + `<text class="num" x="${RX + 235}" y="${yy}">${r[1]}</text>`
      + `<text class="num" x="${RX + 345}" y="${yy}">${r[2]}</text>`);
    yy += 16;
  }
  yy += 3;
  const flexOK = c.asimetriaFlexion > 3;
  row(flexOK
    ? `✓ el libro se REPRODUCE: el lado móvil FLEXIONA ${c.asimetriaFlexion.toFixed(1)}× más que el fijo`
    : `⚠ la asimetría del libro NO aparece aquí (flexión móvil/fijo = ${c.asimetriaFlexion.toFixed(2)})`,
    flexOK ? 'ok' : 'warn', 14);
  row(`fijo: compresión ${num(f.fibras.compresionYYMPa)} MPa con sólo ±${num(Math.abs(f.fibras.flexionMPa))} de flexión.`, 'lblSm', 12);
  row(`móvil: la placa de soporte puentea el bolsillo ⇒ ±${num(Math.abs(mv.fibras.flexionMPa))} MPa de fibra`, 'lblSm', 12);
  row(`(${num(mv.fibras.sxxInfMPa)} abajo / ${num(mv.fibras.sxxSupMPa)} arriba: cambia de signo = flexión pura).`, 'lblSm', 20);

  row('V12.12 · CONCENTRACIÓN ALREDEDOR DE LOS BARRENOS', 'cita', 17);
  row('§12.2.6: "a stress concentration of 3 results even when a', 'lblSm', 12);
  row('hole is located far from the cavity surface."', 'lblSm', 16);
  L.push(`<text class="lblSm" x="${RX}" y="${yy}">barreno</text>`
    + `<text class="lblSm" x="${RX + 180}" y="${yy}">H/⌀</text>`
    + `<text class="lblSm" x="${RX + 245}" y="${yy}">K medido</text>`
    + `<text class="lblSm" x="${RX + 335}" y="${yy}">K §12.2.6</text>`
    + `<text class="lblSm" x="${RX + 440}" y="${yy}">σmax</text>`);
  yy += 15;
  // un renglón por barreno DISTINTO (los simétricos se agrupan)
  const vistos = new Map<string, { b: BarrenoMedido; n: number }>();
  for (const b of c.barrenos) {
    const k2 = `${b.tipo}|${b.diaMm}|${b.HenDiametros.toFixed(2)}|${b.kFEM.toFixed(2)}`;
    const g = vistos.get(k2);
    if (g) g.n++; else vistos.set(k2, { b, n: 1 });
  }
  for (const { b, n } of [...vistos.values()].slice(0, 7)) {
    const alto = sl != null && b.sigmaMaxMPa > sl;
    L.push(`<text class="lbl" x="${RX}" y="${yy}">${ESC(b.etiqueta)} ⌀${b.diaMm}${n > 1 ? ` ×${n}` : ''}</text>`
      + `<text class="num" x="${RX + 180}" y="${yy}">${b.HenDiametros.toFixed(2)}</text>`
      + `<text class="num" x="${RX + 245}" y="${yy}">${b.nominalDebil ? '~' : ''}${b.kFEM.toFixed(2)}</text>`
      + `<text class="lbl" x="${RX + 335}" y="${yy}">${b.kLibro.toFixed(2)}</text>`
      + `<text class="${alto ? 'mal' : 'num'}" x="${RX + 440}" y="${yy}">${b.sigmaMaxMPa.toFixed(0)}</text>`);
    yy += 15;
  }
  if (!c.barrenos.length) row('sin barrenos redondos en este corte — nada que medir', 'warn', 15);
  yy += 4;
  row('K medido = σ_vm máx en el borde / σ_vm SIN el barreno (2º solve). Depende del', 'lblSm', 11.5);
  row('ESTADO local: uniaxial ⇒ 3.0 exacto (Kirsch, verificado en el gate), equibiaxial', 'lblSm', 11.5);
  row('⇒ 2.0; por eso el LEJOS no da 3. K §12.2.6 va de CONTRASTE (otra geometría).', 'lblSm', 16);

  row('LO QUE ESTA LÁMINA NO MIDE — NO cuenta como cumplido', 'warn', 15);
  for (const s of c.sinCablear) {
    for (const w of envuelve(`· ${s}`, CHARS)) row(ESC(w), 'lblSm', 11);
  }
  yy += 5;
  if (lim.errata) for (const w of envuelve(lim.errata, CHARS)) row(ESC(w), 'lblSm', 11);
    // BARRA DE ERROR del entregable (arnés GCI · ASME V&V 20). Un número de simulación
    // sin incertidumbre no es un resultado: es una opinión con decimales. La banda la
    // calcula el llamador con tres mallas refinadas a la MISMA razón (verif-gci) y se
    // imprime PEGADA al número. Si no la pasan, se dice que no la hay — no se finge.
    const bandaTxt = o.banda95MPa != null
      ? ` ± ${o.banda95MPa.toFixed(0)}${o.enRangoAsintotico === false ? ' (indic.)' : ''}`
      : ' [sin banda: 1 malla]';

  const veredicto = sl == null
    ? `SIN VEREDICTO: ${ESC(lim.material)} no tiene σ_limit sin nº de ciclos declarado (§12.1.1)`
    : c.pctSobreLimite! > 0
      ? `✗ σ_max ${c.sigmaMaxMPa.toFixed(0)}${bandaTxt} MPa > σ_limit ${sl} MPa · ${c.pctSobreLimite!.toFixed(2)} % del área REBASA (Ec. 12.1)`
      : `✓ σ_max ${c.sigmaMaxMPa.toFixed(0)} MPa < σ_limit ${sl} MPa — Ec. 12.1 se cumple con ${(sl / Math.max(1e-9, c.sigmaMaxMPa)).toFixed(2)}× de margen`;
  const clsVer = sl == null ? 'warn' : c.pctSobreLimite! > 0 ? 'mal' : 'ok';

  // los DISCOS de singularidad (esquinas vivas) y la franja donde se mide la flexión
  const discos = c.esquinas.map((e) =>
    `<circle cx="${px(e[0]).toFixed(1)}" cy="${py(e[1]).toFixed(1)}" r="${(c.rSingularidadMm * k).toFixed(1)}" fill="none" stroke="#ff2b3d" stroke-width="1" stroke-dasharray="4 4" opacity="0.75"/>`).join('');
  const fr = c.lados['móvil'].fibras, frF = c.lados.fijo.fibras;
  const franja = [fr, frF].map((z) =>
    `<rect x="${px(z.xFranja - z.anchoFranjaMm / 2).toFixed(1)}" y="${py(z.y1).toFixed(1)}" width="${(z.anchoFranjaMm * k).toFixed(1)}" height="${((z.y1 - z.y0) * k).toFixed(1)}" fill="#ffffff" opacity="0.06" stroke="#e9eef5" stroke-width="0.7" stroke-dasharray="3 3"/>`).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS_L19}</style><rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PADX}" y="30">MAPA DE VON MISES EN SECCIÓN — ${ESC(mod.nombre)}</text>
<text class="cita" x="${PADX}" y="49">§12.1.1 · Fig 12.2 "Von Mises stresses during molding" · presión de fundido ${mod.pFundidoMPa} MPa · σ_limit ${sl ?? '—'} MPa</text>
<text class="lblSm" x="${PADX}" y="64">σ_limit: ${ESC(lim.cita)}</text>
<text class="lblSm" x="${PADX}" y="78">MODELO: elasticidad lineal 2D en DEFORMACIÓN PLANA · ${m.nQuads} elementos Q4 · 2×2 Gauss · E=${E_ACERO_MPA / 1000} GPa ν=${NU_ACERO} · APROXIMADO, NO es FEA 3D</text>
<text class="lblSm" x="${PADX}" y="92">verificado contra elasticidad ANALÍTICA (Kirsch Kt=3.0 · viga M·c/I · tracción y cortante puros): scripts/mold-vonmises-test.cjs</text>
<text class="${clsVer}" style="font:700 13px 'JetBrains Mono',monospace" x="${PADX}" y="110">${veredicto}</text>
${campo}
${contornos}
${franja}
${rayado(Hsec, true)}${rayado(0, false)}
${flechas.join('')}
${barr}
${discos}
<text class="lbl" x="${(px(mod.anchoMm) - 128).toFixed(1)}" y="${(py(Hsec) + 13).toFixed(1)}">platina FIJA (apoyo)</text>
<text class="lbl" x="${(px(0) + 5).toFixed(1)}" y="${(py(0) - 7).toFixed(1)}">platina MÓVIL (apoyo)</text>
<text class="cita" x="${(px(0) + 4).toFixed(1)}" y="${(py(c.yParticion) - 4).toFixed(1)}">partición</text>
${notas}
${escala}
${L.join('\n')}
</svg>`;

  return {
    id: 'vonmises',
    titulo: `Von Mises en sección — ${mod.nombre}`,
    cita: '§12.1.1 · Fig 12.2 · §12.2.6 · Fig 12.22-12.23',
    queMirar: 'Compara los DOS lados del mismo molde con la MISMA escala (anclada a σ_limit, no auto-escalada): arriba, el lado fijo va respaldado por la platina y baja la carga a COMPRESIÓN; abajo, la placa de soporte puentea el bolsillo del expulsor y FLEXIONA — la tabla mide cuántas veces más. Y mira los anillos de cada barreno: la concentración medida es el cociente contra el mismo campo SIN el barreno.',
    svg,
  };
}

/** Corta un texto en líneas de ~n caracteres (sin partir palabras). */
function envuelve(s: string, n: number): string[] {
  const w = s.split(' '), out: string[] = [];
  let cur = '';
  for (const x of w) {
    if ((cur + ' ' + x).trim().length > n) { out.push(cur.trim()); cur = '  ' + x; }
    else cur += ' ' + x;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. EL CASO DEL LIBRO — el molde del bezel (§12.1.1, p. 307-311)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sección del molde del BEZEL con las cotas LITERALES que el propio repo ya
 * verifica en `scripts/mold-structural-test.cjs` contra las p.307-311:
 *   ancho 381 mm · paquete 403 mm · inserto de cavidad 248 × 168 mm ·
 *   claro entre rieles 215.9 mm · B + soporte = 120 mm.
 * Todo lo demás va marcado como EXTENSIÓN DECLARADA en `procedencia`.
 */
export function seccionBezelLibro(o?: { pFundidoMPa?: number; hMallaMm?: number; divBarreno?: number }): ModeloSeccion {
  const W = 381, claro = 215.9;
  const riel = (W - claro) / 2;                 // 82.55 mm
  // El libro da B+soporte = 120 y el paquete total 403; el REPARTO entre las 6
  // placas no lo da: se propone y se declara.
  const placas: PlacasSeccion = { bottomClamp: 36, ejectorHousing: 116, support: 46, B: 74, A: 96, topClamp: 35 };
  const yPart = placas.bottomClamp + placas.ejectorHousing + placas.support + placas.B;
  const espCav = 12;
  const dia = 10;
  // §9.2.5: la línea de agua va a ~2·⌀ de la superficie. Aquí se colocan a
  // H = 1.5·⌀ del lado de cavidad (el caso EXACTO de §12.2.6 → K libro 3.40) y a
  // H = 2.5·⌀ del lado de núcleo, más un barreno LEJOS para el hecho contraintuitivo.
  const barrenos: BarrenoSpec[] = [];
  for (const dx of [-90, -30, 30, 90]) {
    barrenos.push({ x: W / 2 + dx, y: yPart + espCav + 1.5 * dia, diaMm: dia, tipo: 'agua', ejePerpendicular: true, etiqueta: `agua cav ${dx > 0 ? '+' : ''}${dx}` });
  }
  for (const dx of [-60, 0, 60]) {
    barrenos.push({ x: W / 2 + dx, y: yPart - 2.5 * dia, diaMm: dia, tipo: 'agua', ejePerpendicular: true, etiqueta: `agua núcleo ${dx > 0 ? '+' : ''}${dx}` });
  }
  barrenos.push({ x: W / 2, y: yPart + espCav + 62, diaMm: dia, tipo: 'agua', ejePerpendicular: true, etiqueta: 'agua LEJOS' });
  // expulsores y tornillos: su eje es VERTICAL = contenido en este corte ⇒ SIN CABLEAR
  barrenos.push({ x: W / 2 - 40, y: yPart - 40, diaMm: 8, tipo: 'expulsor', ejePerpendicular: false, etiqueta: 'expulsor' });
  barrenos.push({ x: W / 2 + 40, y: yPart - 40, diaMm: 8, tipo: 'expulsor', ejePerpendicular: false, etiqueta: 'expulsor' });

  return {
    nombre: 'molde del bezel (Kazmer §12.1.1, p.307-311)',
    anchoMm: W, placas, rielMm: riel,
    cavidadAnchoMm: 248, cavidadEspesorMm: espCav,
    pFundidoMPa: o?.pFundidoMPa ?? P_FUNDIDO_FIG122_MPA,
    barrenos, material: 'P20',
    hMallaMm: o?.hMallaMm ?? 7, divBarreno: o?.divBarreno ?? 12,
    procedencia: [
      'LITERAL §12.1.1 p.307-311: ancho 381 mm · paquete 403 mm · cavidad 248×168 mm · claro entre rieles 215.9 mm (8.5 in) · B+soporte 120 mm',
      'LITERAL V12.2 / Fig 12.2: presión de fundido 150 MPa',
      'LITERAL §12.1.1 / Fig 12.5 / §9.2.5: σ_limit P20 = 456 MPa (fatiga)',
      'EXTENSIÓN DECLARADA: reparto del paquete de 403 mm entre las 6 placas (el libro sólo fija B+soporte = 120)',
      'EXTENSIÓN DECLARADA: cavidad modelada como bolsillo rectangular 248 × 12 mm sobre el plano de partición (la forma del bezel no cambia la ruta de carga que juzga V12.2)',
      'EXTENSIÓN DECLARADA: ⌀10 mm de línea de agua y su profundidad (§9.2.5 da "~2·⌀"; se usa 1.5·⌀ del lado de cavidad para reproducir el caso de §12.2.6)',
      'EXTENSIÓN DECLARADA: ν = 0.30 del acero (el libro no lo da)',
    ],
  };
}
