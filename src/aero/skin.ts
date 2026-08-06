/**
 * ✈️ LA PIEL — del sólido del kernel a los paneles del aire
 * =========================================================
 * El puente que faltaba. El Estudio Viento anterior sacaba la forma del
 * BOUNDING BOX; aquí la fuerza se integra sobre la superficie REAL que el
 * alumno construyó, triángulo por triángulo.
 *
 * Anderson §1.5 es explícito: TODA fuerza aerodinámica sobre un cuerpo son dos
 * manos y ninguna más — la presión p (⊥ a la piel) y el cortante τ (∥ a la
 * piel), integrados sobre toda la superficie (ec. 1.7-1.8):
 *
 *     R = ∮ (−p·n̂ + τ·t̂) dS
 *
 * Este módulo entrega los `dS` con su `n̂`, y la integral. Nada más y nada menos.
 *
 * ⚠️ EL INVARIANTE QUE LO VALIDA: en un cuerpo CERRADO, ∮n̂ dS = 0 (divergencia
 * de un campo constante). Si la piel no cierra, la integral de presión trae un
 * término espurio p∞·∮n̂ dS que NO se cancela — y el resultado es basura con
 * pinta de número. Por eso `cierre` viaja en la piel y `integrarPresion` avisa.
 * Anderson lo dice al revés en el Problema 2.1: trabajar con Cp en vez de p
 * cancela sola la presión ambiente... **siempre que el cuerpo esté cerrado**.
 *
 * Segundo invariante, gratis: el teorema de la divergencia da el volumen
 * V = ⅓∮ r·n̂ dS, que se cruza contra el volumen EXACTO del kernel. Si ambos
 * coinciden, la teselación y las normales están bien. Es el mismo estilo de
 * verificación contra invariantes del kernel que usan las lecciones.
 */

import type { TessellatedMesh } from '@/forja/brep/occt';

export type Vec3 = readonly [number, number, number];

export interface Panel {
  /** centroide del triángulo, en METROS */
  c: Vec3;
  /** normal unitaria SALIENTE */
  n: Vec3;
  /** área del triángulo, en m² */
  area: number;
  /** índice ESTABLE de la cara B-Rep de la que salió (mismo que enumerateFaces) */
  faceId: number;
}

export interface Piel {
  paneles: Panel[];
  /** superficie total mojada [m²] */
  areaTotal: number;
  /** ∮n̂ dS — debe ser ~0 en un cuerpo cerrado. Es el verificador de la piel. */
  cierre: Vec3;
  /** |cierre| / areaTotal — adimensional. Bajo `TOL_CIERRE` la piel es utilizable. */
  cierreRelativo: number;
  /** volumen por divergencia ⅓∮r·n̂ dS [m³] — se cruza contra el kernel */
  volumen: number;
  /** true si la piel cierra lo bastante para integrar presión con confianza */
  cerrada: boolean;
}

/** Una piel con este cierre relativo o menos es utilizable para integrar. */
export const TOL_CIERRE = 1e-6;

/** Escala por defecto: el kernel trabaja en MILÍMETROS, la aerodinámica en METROS. */
export const MM_A_M = 1e-3;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): number => Math.sqrt(dot(a, a));

export interface PielOpts {
  /** factor de unidades del sólido a metros (por defecto mm→m) */
  escala?: number;
  /** descarta triángulos degenerados por debajo de esta área relativa */
  areaMinRel?: number;
}

/**
 * Malla teselada del kernel → paneles con normal y área.
 *
 * La normal se calcula del PRODUCTO CRUZ de los lados, no se promedia de las
 * normales por vértice: para integrar fuerzas hace falta la normal de la
 * FACETA y su área exacta, no una normal suavizada para sombreado.
 * El sentido (saliente) lo hereda del orden de los índices que fija el kernel.
 */
export function pielDeMalla(mesh: TessellatedMesh, opts: PielOpts = {}): Piel {
  const s = opts.escala ?? MM_A_M;
  const { positions, indices, faceIds } = mesh;
  const nTri = indices.length / 3;
  const paneles: Panel[] = [];
  let areaTotal = 0;
  let cx = 0, cy = 0, cz = 0;   // ∮n dS
  let vol6 = 0;                 // 6·V acumulado

  const areasCrudas: number[] = new Array(nTri);
  let areaMax = 0;
  const p = (i: number): Vec3 => [positions[3 * i] * s, positions[3 * i + 1] * s, positions[3 * i + 2] * s];

  for (let t = 0; t < nTri; t++) {
    const a = p(indices[3 * t]), b = p(indices[3 * t + 1]), c = p(indices[3 * t + 2]);
    const cr = cross(sub(b, a), sub(c, a));
    const two = norm(cr);
    areasCrudas[t] = two / 2;
    if (areasCrudas[t] > areaMax) areaMax = areasCrudas[t];
  }
  const areaMin = (opts.areaMinRel ?? 1e-12) * areaMax;

  for (let t = 0; t < nTri; t++) {
    const area = areasCrudas[t];
    if (!(area > areaMin)) continue;             // degenerado: aporta 0 y ensucia la normal
    const ia = indices[3 * t], ib = indices[3 * t + 1], ic = indices[3 * t + 2];
    const a = p(ia), b = p(ib), c = p(ic);
    const cr = cross(sub(b, a), sub(c, a));
    const inv = 1 / (2 * area);
    const n: Vec3 = [cr[0] * inv, cr[1] * inv, cr[2] * inv];
    const cen: Vec3 = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    paneles.push({ c: cen, n, area, faceId: faceIds[t] });
    areaTotal += area;
    cx += n[0] * area; cy += n[1] * area; cz += n[2] * area;
    vol6 += dot(a, cr);                          // Σ a·(b−a)×(c−a) = 6V
  }

  const cierre: Vec3 = [cx, cy, cz];
  const cierreRelativo = areaTotal > 0 ? norm(cierre) / areaTotal : Infinity;
  return {
    paneles, areaTotal, cierre, cierreRelativo,
    volumen: vol6 / 6,
    cerrada: cierreRelativo < TOL_CIERRE,
  };
}

export interface ReferenciaAero {
  /** superficie de referencia S [m²] con la que se adimensionaliza */
  sRef: number;
  /** longitud de referencia para el momento [m] — la MAC, no la cuerda media */
  cRef: number;
  /** punto respecto al que se toma el momento [m] */
  puntoMomento: Vec3;
  /** ángulo de ataque [rad] — define hacia dónde apunta "sustentación" */
  alpha: number;
  /** ángulo de derrape [rad] */
  beta?: number;
}

export interface CargasAero {
  /** fuerza total en ejes cuerpo [N] */
  F: Vec3;
  /** momento respecto a `puntoMomento` en ejes cuerpo [N·m] */
  M: Vec3;
  /** sustentación [N] — ⊥ al viento */
  L: number;
  /** arrastre [N] — ∥ al viento */
  D: number;
  CL: number;
  CD: number;
  /** momento de cabeceo adimensional */
  Cm: number;
  /**
   * ⚠️ Las cantidades de referencia viajan CON el resultado. Anderson §1.5:
   * *"you must always know what reference quantities the particular data are
   * based upon"*. Un CL sin su S es un dato corrupto — y Anderson y Bertin usan
   * longitudes de referencia distintas para el momento (cuerda media vs MAC):
   * mezclarlas mete 14.8% de error en Cm.
   */
  ref: ReferenciaAero;
  /** advertencia si la piel no cerraba (el resultado NO es confiable) */
  aviso: string | null;
}

/** Versor del viento incidente a partir de α y β (eje x hacia atrás del cuerpo). */
export function direccionViento(alpha: number, beta = 0): Vec3 {
  return [Math.cos(alpha) * Math.cos(beta), Math.sin(beta), Math.sin(alpha) * Math.cos(beta)];
}

/**
 * Integra la presión sobre la piel: F = −∮ p·n̂ dS  (Anderson ec. 1.7).
 *
 * Se trabaja con Cp y no con p: sobre un cuerpo cerrado la presión ambiente se
 * cancela sola (Σ n̂·dS = 0) y el resultado no depende de p∞. Si la piel NO
 * cierra, esa cancelación no ocurre — por eso se emite `aviso` en vez de
 * devolver un número bonito y falso.
 *
 * @param cp Cp por panel, en el MISMO orden que `piel.paneles`
 * @param q  presión dinámica ½ρV² [Pa]
 */
export function integrarPresion(
  piel: Piel, cp: ArrayLike<number>, q: number, ref: ReferenciaAero,
): CargasAero {
  const { paneles } = piel;
  if (cp.length !== paneles.length) {
    throw new Error(`integrarPresion: cp tiene ${cp.length} valores y la piel ${paneles.length} paneles`);
  }
  let Fx = 0, Fy = 0, Fz = 0, Mx = 0, My = 0, Mz = 0;
  for (let i = 0; i < paneles.length; i++) {
    const { n, area, c } = paneles[i];
    const f = -cp[i] * q * area;               // dF = −Cp·q·n̂·dS
    const fx = f * n[0], fy = f * n[1], fz = f * n[2];
    Fx += fx; Fy += fy; Fz += fz;
    const r = sub(c, ref.puntoMomento);
    Mx += r[1] * fz - r[2] * fy;
    My += r[2] * fx - r[0] * fz;
    Mz += r[0] * fy - r[1] * fx;
  }
  const w = direccionViento(ref.alpha, ref.beta ?? 0);
  const D = Fx * w[0] + Fy * w[1] + Fz * w[2];        // proyección sobre el viento
  // sustentación: componente ⊥ al viento en el plano vertical del cuerpo
  const lz: Vec3 = [-Math.sin(ref.alpha), 0, Math.cos(ref.alpha)];
  const L = Fx * lz[0] + Fy * lz[1] + Fz * lz[2];
  const qS = q * ref.sRef;
  return {
    F: [Fx, Fy, Fz], M: [Mx, My, Mz], L, D,
    CL: qS !== 0 ? L / qS : 0,
    CD: qS !== 0 ? D / qS : 0,
    Cm: qS !== 0 && ref.cRef !== 0 ? My / (qS * ref.cRef) : 0,
    ref,
    aviso: piel.cerrada ? null
      : `La piel NO cierra (∮n·dS/S = ${piel.cierreRelativo.toExponential(2)} > ${TOL_CIERRE}). ` +
        `La presión ambiente no se cancela y estas fuerzas NO son confiables. ` +
        `Revisa que el sólido esté cerrado antes de creerle al resultado.`,
  };
}

/**
 * Integra el cortante: F = ∮ τ·t̂ dS, con t̂ la dirección del flujo proyectada
 * sobre cada panel (Anderson ec. 1.8). El τ por panel lo entrega el modelo de
 * capa límite; aquí solo se suma sobre la geometría real.
 */
export function integrarCortante(
  piel: Piel, tau: ArrayLike<number>, ref: ReferenciaAero,
): { F: Vec3; D: number; CDf: number; q: number } {
  const { paneles } = piel;
  if (tau.length !== paneles.length) {
    throw new Error(`integrarCortante: tau tiene ${tau.length} valores y la piel ${paneles.length} paneles`);
  }
  const w = direccionViento(ref.alpha, ref.beta ?? 0);
  let Fx = 0, Fy = 0, Fz = 0;
  for (let i = 0; i < paneles.length; i++) {
    const { n, area } = paneles[i];
    // t̂ = componente del viento tangente al panel, normalizada
    const wn = dot(w, n);
    const t: Vec3 = [w[0] - wn * n[0], w[1] - wn * n[1], w[2] - wn * n[2]];
    const m = norm(t);
    if (m < 1e-12) continue;                    // panel ⊥ al flujo: sin dirección tangente
    const f = (tau[i] * area) / m;
    Fx += f * t[0]; Fy += f * t[1]; Fz += f * t[2];
  }
  const D = Fx * w[0] + Fy * w[1] + Fz * w[2];
  return { F: [Fx, Fy, Fz], D, CDf: 0, q: 0 };
}

/** Agrupa los paneles por cara B-Rep — para pintar o para reportar por cara. */
export function porCara(piel: Piel): Map<number, number[]> {
  const m = new Map<number, number[]>();
  piel.paneles.forEach((p, i) => {
    const arr = m.get(p.faceId);
    if (arr) arr.push(i); else m.set(p.faceId, [i]);
  });
  return m;
}
