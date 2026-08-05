/**
 * LA MATRÍCULA DE MALLA — verificar geometría SIN MIRARLA.
 * ============================================================================
 * El ojo miente. En esta casa ya pasó: un devanado de caras invertido produjo un
 * render que "se veía bien" y lo único que lo cazó fue un VOLUMEN NEGATIVO por el
 * teorema de la divergencia. Este módulo convierte cada propiedad geométrica en
 * UN NÚMERO CON RESPUESTA CONOCIDA, y —más importante— en números que se
 * CONTRADICEN entre sí cuando la malla está rota.
 *
 * Los invariantes, y por qué cada uno vale:
 *
 *  1) EULER  χ = V − E + F  (conteo puro). Para una superficie cerrada orientable
 *     de género g: χ = 2 − 2g. Un solo entero delata agujeros, caras borradas,
 *     bordes colgantes o género equivocado. Esfera/cubo/taza ⇒ 2. Toro ⇒ 0.
 *     Doble toro ⇒ −2.
 *
 *  2) GAUSS-BONNET DISCRETO  Σ_v (2π − Σ ángulos incidentes) = 2π·χ.
 *     Es la COMPROBACIÓN CRUZADA de χ por una vía COMPLETAMENTE distinta:
 *     GEOMETRÍA (ángulos medidos con atan2) en vez de CONTEO. La igualdad es una
 *     identidad combinatoria exacta —sale de 3F = Σ_e valencia(e)— así que el
 *     único error admisible es el redondeo de punto flotante (~1e-13 rad). Si las
 *     dos vías no coinciden, la malla está rota (no-manifold, ángulos imposibles,
 *     conteo inconsistente). NO depende de ningún estimador de curvatura.
 *     Para mallas CON frontera se usa la versión con giro de borde:
 *       Σ_{v interior}(2π − Σθ) + Σ_{v frontera}(π − Σθ) = 2π·χ
 *     que también es exacta porque V_frontera + 3F = 2E cuando el borde son ciclos.
 *
 *  3) VOLUMEN CON SIGNO por divergencia. Negativo o cero ⇒ NORMALES AL REVÉS.
 *     (La idea ya vivía en scripts/mold-visibilidad-test.cjs `volumen()`.)
 *
 *  4) QUIRALIDAD (el invariante de SIGNO). La literatura de invariantes quirales
 *     —arXiv:1705.10768 "Reflection Invariant and Symmetry Detection",
 *     arXiv:1711.05866 "Structural Invariants of Chirality"— dice que los VALORES
 *     ABSOLUTOS de los invariantes quirales se conservan bajo traslación, rotación
 *     Y ESPEJO: sólo CAMBIA EL SIGNO al espejear. Aquí se implementa el camino de
 *     MOMENTOS DE ORDEN IMPAR en el marco propio:
 *
 *         Q = ∫ (x·e1)(x·e2)(x·e3) dV     con {e1,e2,e3} el marco principal
 *                                          ORDENADO por autovalor de covarianza
 *                                          y forzado a ser DERECHO (det = +1)
 *
 *     Justificación (por qué ESTE y no el determinante pelón de la base propia):
 *       · El determinante de la base de autovectores es SIEMPRE ±1 y su signo lo
 *         fija una convención arbitraria (v y −v son el mismo autovector), así que
 *         por sí solo no mide nada; y no tiende a 0 en un cuerpo aquiral.
 *       · Q sí es único: la ambigüedad que queda tras forzar el marco derecho es
 *         voltear DOS ejes a la vez, y eso multiplica Q por (−1)(−1) = +1.
 *       · Bajo rotación los ejes rotan con el cuerpo ⇒ Q invariante.
 *       · Bajo espejo M (det = −1): los ejes propios pasan a M·e_i, que forman un
 *         marco IZQUIERDO; al re-forzar el marco derecho se voltea UN eje ⇒
 *         Q' = −Q, con |Q'| = |Q| EXACTO. Justo lo que pide la literatura.
 *       · Si el cuerpo tiene plano de simetría, ese plano es perpendicular a un
 *         eje principal y el integrando es impar en esa coordenada ⇒ Q = 0.
 *         Aquiral ⇒ 0, y de forma CONTINUA (no un ±1 discreto).
 *     Se normaliza a adimensional: quiralidad = Q / (V·σ1·σ2·σ3), con σ_i las
 *     desviaciones principales. Así no cambia al escalar.
 *     Los momentos se calculan con la orientación NORMALIZADA (si el volumen con
 *     signo sale negativo se niegan todos los momentos), de modo que la quiralidad
 *     mide LA FORMA y el devanado lo mide `volumenConSigno`: dos invariantes
 *     independientes que no se tapan uno al otro.
 *
 *  5) TENSOR DE INERCIA del sólido (densidad 1) por descomposición en tetraedros
 *     con fórmula EXACTA de momentos baricéntricos. Sus autovalores I1≤I2≤I3 son
 *     invariantes bajo rotación y traslación, escalan como s⁵, y deben cumplir la
 *     desigualdad triangular I1+I2 ≥ I3 (todo sólido físico la cumple).
 *
 *  6) ÁREA y VOLUMEN con sus relaciones cerradas conocidas, más la desigualdad
 *     ISOPERIMÉTRICA A³ ≥ 36π·V²: si se viola, el área y el volumen NO describen
 *     el mismo cuerpo.
 *
 * PURO: sin dependencias, sin estado, sin reloj. Entra malla, sale matrícula.
 */

/* ────────────────────────────────────────────────────────────────────────── */
/* Tipos                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export interface MallaEntrada {
  positions: ArrayLike<number>;
  /** si falta, se asume sopa de triángulos (0,1,2,3,…) */
  indices?: ArrayLike<number> | null;
}

export interface OpcionesMatricula {
  /**
   * Tolerancia ABSOLUTA de soldadura de vértices (mm). Por omisión
   * `tolRel · diagonal_bbox`. Las mallas que salen de teselar un STEP traen el
   * mismo punto repetido una vez por cara: sin soldar, χ no significa nada.
   */
  tol?: number;
  /** tolerancia RELATIVA a la diagonal del bbox (default 1e-6) */
  tolRel?: number;
  /** brecha relativa mínima entre autovalores para creerle al marco propio */
  gapEjes?: number;
}

export interface Inercia {
  /** autovalores del tensor de inercia del sólido (densidad 1), ordenados */
  I1: number; I2: number; I3: number;
  /** adimensionales e invariantes de escala */
  r21: number; r31: number;
  /** desigualdad triangular de un sólido físico: I1+I2 ≥ I3 */
  triangular: boolean;
  /** desviaciones principales σ_i (mm) — raíz de los autovalores de covarianza */
  sigma: [number, number, number];
  /** brecha relativa mínima entre σ consecutivas: si ~0, los ejes son ambiguos */
  gapRel: number;
  ejesDegenerados: boolean;
  /** el marco principal DERECHO (columnas e1,e2,e3), ordenado por σ ascendente */
  ejes: [number[], number[], number[]];
}

export interface Matricula {
  /* ── conteo y topología ────────────────────────────────────────────────── */
  /** vértices tal cual venían (antes de soldar) */
  Vcrudo: number;
  /** vértices ÚNICOS por posición, y realmente usados por algún triángulo */
  V: number;
  /** aristas no dirigidas únicas */
  E: number;
  /** triángulos no degenerados (los que cuentan para Euler) */
  F: number;
  /** triángulos tal cual venían */
  triangulos: number;
  chi: number;
  componentes: number;
  /** género total (suma sobre componentes). Sólo válido si `generoValido` */
  genero: number;
  generoValido: boolean;

  cerrada: boolean;
  /** el devanado de las caras es coherente entre vecinas (a→b vs b→a) */
  devanadoCoherente: boolean;
  manifold: boolean;
  bordesFrontera: number;
  bordesNoManifold: number;
  bordesMalOrientados: number;
  trianguloDegenerados: number;
  carasDuplicadas: number;
  verticesSoldados: number;
  verticesNoUsados: number;

  /* ── geometría ─────────────────────────────────────────────────────────── */
  areaTotal: number;
  volumenConSigno: number;
  volumenAbs: number;
  /** Σ_v defecto angular (rad). Debe valer 2π·χ */
  defectoTotal: number;
  /** defectoTotal / 2π — es χ medido por geometría */
  gaussBonnet: number;
  /** |defectoTotal − 2π·χ| en radianes */
  errorGaussBonnet: number;
  /** el mismo error relativo al presupuesto total de ángulos (π·F) */
  errorGaussBonnetRel: number;
  /** A³ / (36π·V²) ≥ 1 para cualquier cuerpo; = 1 sólo en la esfera */
  isoperimetrico: number;

  /* ── masa ──────────────────────────────────────────────────────────────── */
  centroide: [number, number, number];
  inercia: Inercia;

  /* ── quiralidad ────────────────────────────────────────────────────────── */
  /** Q/(V·σ1σ2σ3), adimensional. Espejo ⇒ mismo |·|, signo OPUESTO. 0 = aquiral */
  quiralidad: number;
  /** Q crudo = ∫(x·e1)(x·e2)(x·e3)dV (mm⁶) */
  quiralidadRaw: number;
  /** false si los ejes están degenerados: el signo NO es de fiar (se DECLARA) */
  quiralidadDeterminada: boolean;

  /* ── metadatos ─────────────────────────────────────────────────────────── */
  bbox: { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };
  diagonal: number;
  tol: number;
  nanEnPosiciones: number;
}

export interface Problema {
  codigo: string;
  gravedad: 'roto' | 'aviso';
  detalle: string;
}

export interface Coherencia {
  ok: boolean;
  /** true si además de coherente la malla es un sólido cerrado bien orientado */
  solidoSano: boolean;
  problemas: Problema[];
  resumen: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Soldadura de vértices                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Suelda vértices coincidentes dentro de `tol` con rejilla espacial hash de celda
 * `tol` y sondeo de las 27 celdas vecinas (dos puntos a distancia ≤ tol siempre
 * caen en celdas adyacentes, así que el sondeo es COMPLETO — no es una
 * cuantización ingenua que parte pares a caballo de una frontera de celda).
 * Determinista: gana como representante el primer vértice en orden de entrada.
 */
function soldar(P: ArrayLike<number>, n: number, tol: number): { mapa: Int32Array; px: Float64Array; nUnicos: number } {
  const mapa = new Int32Array(n).fill(-1);
  const px = new Float64Array(n * 3);
  let nUnicos = 0;
  if (tol <= 0) {
    for (let i = 0; i < n; i++) { mapa[i] = i; px[i * 3] = P[i * 3]; px[i * 3 + 1] = P[i * 3 + 1]; px[i * 3 + 2] = P[i * 3 + 2]; }
    return { mapa, px, nUnicos: n };
  }
  const inv = 1 / tol;
  const celdas = new Map<number, number[]>();
  const clave = (a: number, b: number, c: number) =>
    (Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)) | 0;
  const t2 = tol * tol;
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    const cx = Math.floor(x * inv), cy = Math.floor(y * inv), cz = Math.floor(z * inv);
    let hit = -1;
    for (let dx = -1; dx <= 1 && hit < 0; dx++) for (let dy = -1; dy <= 1 && hit < 0; dy++) for (let dz = -1; dz <= 1 && hit < 0; dz++) {
      const lista = celdas.get(clave(cx + dx, cy + dy, cz + dz));
      if (!lista) continue;
      for (let k = 0; k < lista.length; k++) {
        const u = lista[k];
        const ddx = px[u * 3] - x, ddy = px[u * 3 + 1] - y, ddz = px[u * 3 + 2] - z;
        if (ddx * ddx + ddy * ddy + ddz * ddz <= t2) { hit = u; break; }
      }
    }
    if (hit >= 0) { mapa[i] = hit; continue; }
    const u = nUnicos++;
    px[u * 3] = x; px[u * 3 + 1] = y; px[u * 3 + 2] = z;
    mapa[i] = u;
    const k = clave(cx, cy, cz);
    const lista = celdas.get(k);
    if (lista) lista.push(u); else celdas.set(k, [u]);
  }
  return { mapa, px, nUnicos };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Álgebra: Jacobi simétrico 3×3                                              */
/* ────────────────────────────────────────────────────────────────────────── */

/** Autovalores/autovectores de una simétrica 3×3 por rotaciones de Jacobi.
 *  Devuelve valores y vectores COLUMNA (vec[j] = autovector j). */
export function jacobi3(M: number[][]): { valores: number[]; vectores: number[][] } {
  const a = [[M[0][0], M[0][1], M[0][2]], [M[1][0], M[1][1], M[1][2]], [M[2][0], M[2][1], M[2][2]]];
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const pares: Array<[number, number]> = [[0, 1], [0, 2], [1, 2]];
  const escala = Math.abs(a[0][0]) + Math.abs(a[1][1]) + Math.abs(a[2][2]) + 1e-300;
  for (let sweep = 0; sweep < 60; sweep++) {
    const off = Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2]);
    if (off <= 1e-17 * escala) break;
    for (const [p, q] of pares) {
      if (Math.abs(a[p][q]) <= 1e-19 * escala) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const sg = theta >= 0 ? 1 : -1;
      const t = sg / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) {
        const akp = a[k][p], akq = a[k][q];
        a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p][k], aqk = a[q][k];
        a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k][p], vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return { valores: [a[0][0], a[1][1], a[2][2]], vectores: [[v[0][0], v[1][0], v[2][0]], [v[0][1], v[1][1], v[2][1]], [v[0][2], v[1][2], v[2][2]]] };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Momentos exactos de un poliedro                                            */
/* ────────────────────────────────────────────────────────────────────────── */

export interface Momentos {
  /** volumen con signo */
  m0: number;
  /** ∫x_a dV */
  m1: number[];
  /** ∫x_a x_b dV (6 comps: xx,yy,zz,xy,xz,yz) */
  m2: number[];
  /** ∫x_a x_b x_c dV (10 comps, ver ORD3) */
  m3: number[];
}

/** orden canónico de los 10 momentos de tercer orden */
const ORD3: Array<[number, number, number]> = [
  [0, 0, 0], [1, 1, 1], [2, 2, 2],
  [0, 0, 1], [0, 0, 2], [1, 1, 0], [1, 1, 2], [2, 2, 0], [2, 2, 1],
  [0, 1, 2],
];
/** tabla 3×3×3 → índice en ORD3 (el momento es simétrico en sus 3 índices) */
const TABLA3 = (() => {
  const t = new Int8Array(27).fill(-1);
  for (let k = 0; k < 10; k++) {
    const [a, b, c] = ORD3[k];
    for (const [x, y, z] of [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]]) t[x * 9 + y * 3 + z] = k;
  }
  return t;
})();
function m3get(m3: number[], a: number, b: number, c: number): number {
  return m3[TABLA3[a * 9 + b * 3 + c]];
}

/**
 * Momentos de orden 0..3 del sólido delimitado por la malla, EXACTOS para un
 * poliedro: se descompone en tetraedros (origen, v0, v1, v2) con volumen con
 * signo y se integran los monomios con la fórmula baricéntrica cerrada
 * ∫ λ0^a λ1^b λ2^c λ3^d dV = 6V·a!b!c!d!/(a+b+c+d+3)!
 * (nada de cuadratura: es álgebra exacta hasta el redondeo).
 */
const PAR2: Array<[number, number]> = [[0, 0], [1, 1], [2, 2], [0, 1], [0, 2], [1, 2]];
const PAR2A = Int8Array.from(PAR2.map((q) => q[0]));
const PAR2B = Int8Array.from(PAR2.map((q) => q[1]));
const ORD3A = Int8Array.from(ORD3.map((q) => q[0]));
const ORD3B = Int8Array.from(ORD3.map((q) => q[1]));
const ORD3C = Int8Array.from(ORD3.map((q) => q[2]));

export function momentosDeMalla(P: ArrayLike<number>, I: ArrayLike<number>, nI: number): Momentos {
  let m0 = 0;
  const m1 = [0, 0, 0];
  const m2 = [0, 0, 0, 0, 0, 0];            // xx yy zz xy xz yz
  const m3 = new Array(10).fill(0);
  // p0 = ORIGEN (aporta 0 a S, A y B), así que las sumas corren sólo sobre p1,p2,p3
  const q = new Float64Array(9);            // p1,p2,p3
  const S = new Float64Array(3);
  const A = new Float64Array(9);
  const B = new Float64Array(27);
  for (let t = 0; t < nI; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    q[0] = P[a]; q[1] = P[a + 1]; q[2] = P[a + 2];
    q[3] = P[b]; q[4] = P[b + 1]; q[5] = P[b + 2];
    q[6] = P[c]; q[7] = P[c + 1]; q[8] = P[c + 2];
    const v6 = q[0] * (q[4] * q[8] - q[5] * q[7])
      - q[1] * (q[3] * q[8] - q[5] * q[6])
      + q[2] * (q[3] * q[7] - q[4] * q[6]);
    if (v6 === 0) continue;
    const V = v6 / 6;
    // S[a] = Σ_i p_i[a] ; A[a][b] = Σ_i p_i[a]p_i[b] ; B[a][b][c] = Σ_i p_i[a]p_i[b]p_i[c]
    for (let x = 0; x < 3; x++) S[x] = q[x] + q[3 + x] + q[6 + x];
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++)
      A[x * 3 + y] = q[x] * q[y] + q[3 + x] * q[3 + y] + q[6 + x] * q[6 + y];
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++)
      B[x * 9 + y * 3 + z] = q[x] * q[y] * q[z] + q[3 + x] * q[3 + y] * q[3 + z] + q[6 + x] * q[6 + y] * q[6 + z];
    m0 += V;
    m1[0] += V * S[0] / 4; m1[1] += V * S[1] / 4; m1[2] += V * S[2] / 4;
    const c2 = V / 20, c3 = V / 120;
    for (let k = 0; k < 6; k++) {
      const x = PAR2A[k], y = PAR2B[k];
      m2[k] += c2 * (S[x] * S[y] + A[x * 3 + y]);
    }
    for (let k = 0; k < 10; k++) {
      const x = ORD3A[k], y = ORD3B[k], z = ORD3C[k];
      m3[k] += c3 * (S[x] * S[y] * S[z] + A[x * 3 + y] * S[z] + A[y * 3 + z] * S[x] + A[x * 3 + z] * S[y] + 2 * B[x * 9 + y * 3 + z]);
    }
  }
  return { m0, m1, m2, m3 };
}

/** momentos EXACTOS de una unión de cajas alineadas a ejes (referencia analítica) */
export function momentosDeCajas(cajas: Array<[number, number, number, number, number, number]>): Momentos {
  const m1 = [0, 0, 0], m2 = [0, 0, 0, 0, 0, 0], m3 = new Array(10).fill(0);
  let m0 = 0;
  const pares2: Array<[number, number]> = [[0, 0], [1, 1], [2, 2], [0, 1], [0, 2], [1, 2]];
  for (const cj of cajas) {
    const lo = [cj[0], cj[1], cj[2]], hi = [cj[3], cj[4], cj[5]];
    // ∫ x^k dx sobre [lo,hi]
    const J = (d: number, k: number) => (Math.pow(hi[d], k + 1) - Math.pow(lo[d], k + 1)) / (k + 1);
    const vol = J(0, 0) * J(1, 0) * J(2, 0);
    m0 += vol;
    for (let d = 0; d < 3; d++) {
      const e = [0, 0, 0]; e[d] = 1;
      m1[d] += J(0, e[0]) * J(1, e[1]) * J(2, e[2]);
    }
    for (let k = 0; k < 6; k++) {
      const e = [0, 0, 0]; e[pares2[k][0]]++; e[pares2[k][1]]++;
      m2[k] += J(0, e[0]) * J(1, e[1]) * J(2, e[2]);
    }
    for (let k = 0; k < 10; k++) {
      const e = [0, 0, 0]; for (const d of ORD3[k]) e[d]++;
      m3[k] += J(0, e[0]) * J(1, e[1]) * J(2, e[2]);
    }
  }
  return { m0, m1, m2, m3 };
}

/** momentos CENTRALES (trasladados al centroide) a partir de los crudos */
export function centrar(m: Momentos): { g: number[]; mu2: number[][]; mu3: number[] } {
  const g = [m.m1[0] / m.m0, m.m1[1] / m.m0, m.m1[2] / m.m0];
  const M2 = (a: number, b: number) => {
    const k = [[0, 3, 4], [3, 1, 5], [4, 5, 2]][a][b];
    return m.m2[k];
  };
  const mu2: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) mu2[a][b] = M2(a, b) - m.m0 * g[a] * g[b];
  const mu3 = new Array(10).fill(0);
  for (let k = 0; k < 10; k++) {
    const [a, b, c] = ORD3[k];
    mu3[k] = m3get(m.m3, a, b, c) - g[c] * M2(a, b) - g[b] * M2(a, c) - g[a] * M2(b, c) + 2 * m.m0 * g[a] * g[b] * g[c];
  }
  return { g, mu2, mu3 };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* LA MATRÍCULA                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export function matriculaDeMalla(malla: MallaEntrada, opts: OpcionesMatricula = {}): Matricula {
  const P = malla.positions;
  const nV = Math.floor(P.length / 3);
  const I: ArrayLike<number> = malla.indices && malla.indices.length
    ? malla.indices
    : Uint32Array.from({ length: nV }, (_, i) => i);
  const nI = Math.floor(I.length / 3) * 3;

  // bbox y NaN
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, nan = 0;
  for (let i = 0; i < nV; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) { nan++; continue; }
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z;
    if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z;
  }
  if (!Number.isFinite(x0)) { x0 = y0 = z0 = x1 = y1 = z1 = 0; }
  const diagonal = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
  const tolRel = opts.tolRel ?? 1e-6;
  const tol = opts.tol ?? Math.max(tolRel * diagonal, 0);

  const { mapa, px, nUnicos } = soldar(P, nV, tol);

  /* ── triángulos: degenerados, duplicados, y la lista soldada ───────────── */
  const tri: number[] = [];
  let degen = 0;
  const vistos = new Set<string>();
  let dup = 0;
  for (let t = 0; t < nI; t += 3) {
    const a = mapa[I[t]], b = mapa[I[t + 1]], c = mapa[I[t + 2]];
    if (a === b || b === c || a === c) { degen++; continue; }
    const k = [a, b, c].slice().sort((u, w) => u - w).join(',');
    if (vistos.has(k)) dup++; else vistos.add(k);
    tri.push(a, b, c);
  }
  const F = tri.length / 3;

  /* ── aristas: valencia y coherencia de devanado ────────────────────────── */
  const MUL = 2097152; // 2^21: soporta hasta 2M vértices sin perder exactitud
  const val = new Map<number, number>();
  const dir = new Map<number, number>(); // +1 por cada mitad min→max, −1 por max→min
  const usado = new Uint8Array(nUnicos);
  for (let t = 0; t < tri.length; t += 3) {
    const v = [tri[t], tri[t + 1], tri[t + 2]];
    usado[v[0]] = 1; usado[v[1]] = 1; usado[v[2]] = 1;
    for (let e = 0; e < 3; e++) {
      const a = v[e], b = v[(e + 1) % 3];
      const lo = a < b ? a : b, hi = a < b ? b : a;
      const k = lo * MUL + hi;
      val.set(k, (val.get(k) ?? 0) + 1);
      dir.set(k, (dir.get(k) ?? 0) + (a === lo ? 1 : -1));
    }
  }
  const E = val.size;
  let bordesFrontera = 0, bordesNoManifold = 0, bordesMalOrientados = 0;
  for (const [k, n] of val) {
    if (n === 1) bordesFrontera++;
    else if (n > 2) bordesNoManifold++;
    else if (dir.get(k) !== 0) bordesMalOrientados++;   // n===2 con las dos mitades en el mismo sentido
  }
  let V = 0;
  for (let i = 0; i < nUnicos; i++) if (usado[i]) V++;
  const verticesNoUsados = nUnicos - V;

  /* ── componentes conexas (union-find sobre vértices usados) ────────────── */
  const padre = new Int32Array(nUnicos);
  for (let i = 0; i < nUnicos; i++) padre[i] = i;
  const find = (i: number): number => { while (padre[i] !== i) { padre[i] = padre[padre[i]]; i = padre[i]; } return i; };
  for (let t = 0; t < tri.length; t += 3) {
    const a = find(tri[t]), b = find(tri[t + 1]), c = find(tri[t + 2]);
    if (a !== b) padre[b] = a;
    const a2 = find(tri[t]), c2 = find(tri[t + 2]);
    if (a2 !== c2) padre[c2] = a2;
  }
  const raices = new Set<number>();
  for (let i = 0; i < nUnicos; i++) if (usado[i]) raices.add(find(i));
  const componentes = raices.size;

  const chi = V - E + F;
  const cerrada = bordesFrontera === 0 && bordesNoManifold === 0 && F > 0;
  const devanadoCoherente = bordesMalOrientados === 0;
  const manifold = bordesNoManifold === 0;
  const generoBruto = (2 * componentes - chi) / 2;
  const generoValido = cerrada && devanadoCoherente && Number.isInteger(generoBruto) && generoBruto >= 0;

  /* ── área y GAUSS-BONNET (geometría: ángulos por atan2) ────────────────── */
  // frontera de un vértice = toca alguna arista de valencia 1
  const enFrontera = new Uint8Array(nUnicos);
  if (bordesFrontera > 0) {
    for (const [k, n] of val) {
      if (n !== 1) continue;
      const hi = k % MUL, lo = (k - hi) / MUL;
      enFrontera[lo] = 1; enFrontera[hi] = 1;
    }
  }
  const sumAng = new Float64Array(nUnicos);
  let areaTotal = 0;
  // ángulo en un vértice con atan2(|u×v|, u·v): estable también en ángulos rasantes
  // (acos(u·v/|u||v|) pierde todos los dígitos cerca de 0 y de π).
  const ang = (ux: number, uy: number, uz: number, vx: number, vy: number, vz: number) =>
    Math.atan2(Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx), ux * vx + uy * vy + uz * vz);
  for (let t = 0; t < tri.length; t += 3) {
    const ia = tri[t] * 3, ib = tri[t + 1] * 3, ic = tri[t + 2] * 3;
    const ax = px[ia], ay = px[ia + 1], az = px[ia + 2];
    const bx = px[ib], by = px[ib + 1], bz = px[ib + 2];
    const cx = px[ic], cy = px[ic + 1], cz = px[ic + 2];
    const ux = bx - ax, uy = by - ay, uz = bz - az;   // a→b
    const wx = cx - ax, wy = cy - ay, wz = cz - az;   // a→c
    areaTotal += Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) / 2;
    sumAng[tri[t]] += ang(ux, uy, uz, wx, wy, wz);
    sumAng[tri[t + 1]] += ang(-ux, -uy, -uz, cx - bx, cy - by, cz - bz);
    sumAng[tri[t + 2]] += ang(-wx, -wy, -wz, bx - cx, by - cy, bz - cz);
  }
  let defectoTotal = 0;
  for (let i = 0; i < nUnicos; i++) {
    if (!usado[i]) continue;
    defectoTotal += (enFrontera[i] ? Math.PI : 2 * Math.PI) - sumAng[i];
  }
  const gaussBonnet = defectoTotal / (2 * Math.PI);
  const errorGaussBonnet = Math.abs(defectoTotal - 2 * Math.PI * chi);
  const errorGaussBonnetRel = errorGaussBonnet / Math.max(Math.PI * F, 1e-300);

  /* ── momentos, volumen, inercia, quiralidad ────────────────────────────── */
  const cru = momentosDeMalla(px, tri, tri.length);
  const volumenConSigno = cru.m0;
  const volumenAbs = Math.abs(volumenConSigno);
  // La quiralidad debe medir LA FORMA, no el devanado: si el volumen con signo es
  // negativo se NORMALIZA la orientación negando todos los momentos. Así el
  // devanado lo denuncia `volumenConSigno` y sólo eso, sin contaminar el resto.
  const sgn = volumenConSigno < 0 ? -1 : 1;
  const m: Momentos = sgn > 0 ? cru
    : { m0: -cru.m0, m1: cru.m1.map((x) => -x), m2: cru.m2.map((x) => -x), m3: cru.m3.map((x) => -x) };

  let centroide: [number, number, number] = [0, 0, 0];
  let inercia: Inercia = {
    I1: 0, I2: 0, I3: 0, r21: NaN, r31: NaN, triangular: false,
    sigma: [0, 0, 0], gapRel: 0, ejesDegenerados: true,
    ejes: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  };
  let quiralidad = 0, quiralidadRaw = 0, quiralidadDeterminada = false;

  if (m.m0 > 0) {
    const { g, mu2, mu3 } = centrar(m);
    centroide = [g[0], g[1], g[2]];
    // covarianza (autovectores = ejes principales; los de inercia son los mismos)
    const eig = jacobi3(mu2);
    const orden = [0, 1, 2].sort((a, b) => eig.valores[a] - eig.valores[b]);   // σ ascendente
    const lam = orden.map((k) => Math.max(eig.valores[k], 0));
    const ejes = orden.map((k) => eig.vectores[k].slice());
    // MARCO DERECHO: det = +1. Es lo que hace única a Q (voltear DOS ejes no la
    // cambia; voltear UNO —lo que obliga el espejo— le cambia el signo).
    const det = ejes[0][0] * (ejes[1][1] * ejes[2][2] - ejes[1][2] * ejes[2][1])
      - ejes[0][1] * (ejes[1][0] * ejes[2][2] - ejes[1][2] * ejes[2][0])
      + ejes[0][2] * (ejes[1][0] * ejes[2][1] - ejes[1][1] * ejes[2][0]);
    if (det < 0) ejes[2] = ejes[2].map((x) => -x);
    const sigma: [number, number, number] = [Math.sqrt(lam[0] / m.m0), Math.sqrt(lam[1] / m.m0), Math.sqrt(lam[2] / m.m0)];
    // inercia = tr(mu2)·Id − mu2  ⇒ mismos ejes, autovalores tr−λ (orden invertido)
    const tr = lam[0] + lam[1] + lam[2];
    const Is = [tr - lam[2], tr - lam[1], tr - lam[0]].sort((a, b) => a - b);
    const gapRel = Math.min(
      (sigma[1] - sigma[0]) / Math.max(sigma[2], 1e-300),
      (sigma[2] - sigma[1]) / Math.max(sigma[2], 1e-300),
    );
    const gapMin = opts.gapEjes ?? 1e-4;
    inercia = {
      I1: Is[0], I2: Is[1], I3: Is[2],
      r21: Is[1] / Math.max(Is[0], 1e-300), r31: Is[2] / Math.max(Is[0], 1e-300),
      triangular: Is[0] + Is[1] >= Is[2] * (1 - 1e-9),
      sigma, gapRel, ejesDegenerados: gapRel < gapMin,
      ejes: [ejes[0], ejes[1], ejes[2]],
    };
    // Q = μ3 : e1⊗e2⊗e3
    let Q = 0;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++)
      Q += m3get(mu3, a, b, c) * ejes[0][a] * ejes[1][b] * ejes[2][c];
    quiralidadRaw = Q;
    const den = m.m0 * sigma[0] * sigma[1] * sigma[2];
    quiralidad = den > 0 ? Q / den : 0;
    quiralidadDeterminada = !inercia.ejesDegenerados;
  }

  const isoperimetrico = volumenAbs > 0
    ? Math.pow(areaTotal, 3) / (36 * Math.PI * volumenAbs * volumenAbs)
    : Infinity;

  return {
    Vcrudo: nV, V, E, F, triangulos: Math.floor(nI / 3),
    chi, componentes, genero: generoBruto, generoValido,
    cerrada, devanadoCoherente, manifold,
    bordesFrontera, bordesNoManifold, bordesMalOrientados,
    trianguloDegenerados: degen, carasDuplicadas: dup,
    verticesSoldados: nV - nUnicos, verticesNoUsados,
    areaTotal, volumenConSigno, volumenAbs,
    defectoTotal, gaussBonnet, errorGaussBonnet, errorGaussBonnetRel,
    isoperimetrico,
    centroide, inercia,
    quiralidad, quiralidadRaw, quiralidadDeterminada,
    bbox: { x0, y0, z0, x1, y1, z1 }, diagonal, tol, nanEnPosiciones: nan,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* ¿Se contradicen los invariantes entre sí?                                  */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * COHERENCIA: no dice "esta malla es bonita", dice "estos números NO PUEDEN ser
 * todos ciertos a la vez" y POR QUÉ. Cada regla enfrenta dos vías independientes.
 */
export function coherente(m: Matricula, o: { tolGB?: number } = {}): Coherencia {
  const p: Problema[] = [];
  const tolGB = o.tolGB ?? Math.max(1e-9, 1e-13 * Math.max(m.F, 1));

  if (m.nanEnPosiciones > 0)
    p.push({ codigo: 'NAN', gravedad: 'roto', detalle: `${m.nanEnPosiciones} vértices con coordenada no finita` });

  // (1) conteo vs geometría — la comprobación cruzada de χ
  if (m.errorGaussBonnet > tolGB)
    p.push({
      codigo: 'EULER-vs-GAUSS', gravedad: 'roto',
      detalle: `Σdefectos/2π = ${m.gaussBonnet.toFixed(6)} pero V−E+F = ${m.chi} `
        + `(Δ=${m.errorGaussBonnet.toExponential(2)} rad > ${tolGB.toExponential(1)}): el conteo y la geometría no describen la misma superficie`,
    });

  // (2) grietas y no-manifold
  if (m.bordesFrontera > 0)
    p.push({ codigo: 'GRIETA', gravedad: 'roto', detalle: `${m.bordesFrontera} aristas con UNA sola cara: la superficie está abierta (no encierra volumen)` });
  if (m.bordesNoManifold > 0)
    p.push({ codigo: 'NO-MANIFOLD', gravedad: 'roto', detalle: `${m.bordesNoManifold} aristas con 3+ caras: no es una superficie` });
  if (m.bordesMalOrientados > 0)
    p.push({ codigo: 'DEVANADO', gravedad: 'roto', detalle: `${m.bordesMalOrientados} aristas con las dos mitades en el MISMO sentido: hay caras con el devanado invertido` });

  // (3) signo del volumen (normales al revés) — sólo tiene sentido si cierra
  if (m.cerrada && m.devanadoCoherente && m.volumenConSigno <= 0)
    p.push({ codigo: 'VOLUMEN-SIGNO', gravedad: 'roto', detalle: `volumen con signo = ${m.volumenConSigno.toExponential(4)} ≤ 0: las normales apuntan HACIA ADENTRO (o la malla está espejeada)` });

  // (4) 2E = 3F: identidad obligatoria en una malla cerrada de triángulos
  if (m.cerrada && 2 * m.E !== 3 * m.F)
    p.push({ codigo: 'ARISTAS', gravedad: 'roto', detalle: `2E=${2 * m.E} ≠ 3F=${3 * m.F} en una malla que dice ser cerrada` });

  // (5) género
  if (m.cerrada && m.devanadoCoherente && !m.generoValido)
    p.push({ codigo: 'GENERO', gravedad: 'roto', detalle: `género = (2·${m.componentes} − ${m.chi})/2 = ${m.genero} no es entero ≥ 0` });

  // (6) isoperimétrica: A³ ≥ 36πV² para CUALQUIER cuerpo (igualdad sólo en la esfera)
  if (m.cerrada && m.volumenAbs > 0 && m.isoperimetrico < 1 - 1e-9)
    p.push({ codigo: 'ISOPERIMETRICO', gravedad: 'roto', detalle: `A³/(36πV²) = ${m.isoperimetrico.toFixed(6)} < 1: imposible — el área y el volumen no son del mismo cuerpo` });

  // (7) el tensor de inercia tiene que ser el de un sólido
  if (m.cerrada && m.volumenAbs > 0 && !m.inercia.triangular)
    p.push({ codigo: 'INERCIA', gravedad: 'roto', detalle: `I1+I2 = ${(m.inercia.I1 + m.inercia.I2).toExponential(4)} < I3 = ${m.inercia.I3.toExponential(4)}: ningún sólido real puede` });

  // (8) avisos: no rompen la matrícula pero explican de dónde salen los números
  if (m.carasDuplicadas > 0)
    p.push({ codigo: 'CARAS-DUPLICADAS', gravedad: 'aviso', detalle: `${m.carasDuplicadas} triángulos repiten el mismo trío de vértices` });
  if (m.trianguloDegenerados > 0)
    p.push({ codigo: 'DEGENERADOS', gravedad: 'aviso', detalle: `${m.trianguloDegenerados} triángulos colapsados (2 vértices soldados al mismo punto): excluidos del conteo` });
  if (m.verticesNoUsados > 0)
    p.push({ codigo: 'HUERFANOS', gravedad: 'aviso', detalle: `${m.verticesNoUsados} vértices sin ningún triángulo` });
  if (m.cerrada && m.volumenAbs > 0 && m.inercia.ejesDegenerados)
    p.push({ codigo: 'EJES-DEGENERADOS', gravedad: 'aviso', detalle: `brecha entre σ = ${m.inercia.gapRel.toExponential(2)}: los ejes principales son ambiguos, el SIGNO de la quiralidad NO está determinado (se declara, no se mide)` });

  const rotos = p.filter((x) => x.gravedad === 'roto');
  const ok = rotos.length === 0;
  return {
    ok,
    solidoSano: ok && m.cerrada && m.devanadoCoherente && m.volumenConSigno > 0,
    problemas: p,
    resumen: ok
      ? `coherente · χ=${m.chi} g=${m.generoValido ? m.genero : '?'} V=${m.volumenConSigno.toFixed(2)} mm³`
      : rotos.map((x) => x.codigo).join(' + '),
  };
}

/** una línea legible en consola (ASCII, sin LaTeX) */
export function lineaMatricula(m: Matricula): string {
  return `chi=${String(m.chi).padStart(4)} g=${m.generoValido ? String(m.genero).padStart(2) : ' ?'} `
    + `V/E/F=${m.V}/${m.E}/${m.F} GB=${m.gaussBonnet.toFixed(9)} (err ${m.errorGaussBonnet.toExponential(1)} rad) `
    + `vol=${m.volumenConSigno.toFixed(3)} area=${m.areaTotal.toFixed(3)} `
    + `I=[${m.inercia.I1.toExponential(4)},${m.inercia.I2.toExponential(4)},${m.inercia.I3.toExponential(4)}] `
    + `q=${m.quiralidad.toExponential(3)}${m.quiralidadDeterminada ? '' : '(?)'}`;
}
