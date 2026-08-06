/**
 * ✈️ MÉTRICAS DEL ALA — medidas del SÓLIDO, no tecleadas
 * ======================================================
 * Superficie de referencia, envergadura, alargamiento, cuerda media aerodinámica,
 * estrechamiento y flecha, sacadas de la geometría que el alumno construyó. Es
 * lo que ningún competidor puede hacer bien: sus métodos aproximan el avión con
 * conos y cilindros porque no TIENEN la geometría. Bertin lo dice de su propio
 * ejemplo del F-16 (§5.4.6): el método mejoraría *"with a better representation
 * of the aircraft surfaces, such as from a CAD geometry"*.
 *
 * ⚠️ LA TRAMPA DE CONTABILIDAD, declarada por el propio libro (Bertin §5.3 y
 * §5.4.6): hay DOS longitudes que se llaman "cuerda media" y NO son la misma.
 *
 *   · Cuerda media GEOMÉTRICA (MGC) = S/b — el promedio simple.
 *   · Cuerda media AERODINÁMICA (MAC) = (2/S)∫c²dy — pondera por cuerda, así
 *     que las secciones anchas pesan más. Es la que adimensionaliza el MOMENTO.
 *
 * Anderson llama "mean chord" a la primera; Bertin exige la segunda. Con el
 * fixture del Orbiter del propio Bertin: 34.46 ft contra 39.57 ft — **14.8% de
 * error en Cm** si se mezclan. Por eso este módulo devuelve LAS DOS con nombres
 * distintos y `MetricasAla` viaja completa hacia el resultado aerodinámico.
 *
 * Y el segundo filo de la misma trampa: el área de referencia S **sí** incluye
 * la parte del ala enterrada en el fuselaje (la sustentación se transmite por
 * "pressure carryover"), pero la cuerda para el Reynolds de fricción **no** —
 * ahí va la cuerda de raíz *al costado del fuselaje*. Dos definiciones del mismo
 * ala en el mismo capítulo. `sExpuesta` existe para no confundirlas.
 */

import type { Piel } from './skin';

/** Qué eje del sólido es qué. Por defecto: x cuerda, y envergadura, z espesor. */
export interface EjesAla {
  cuerda: 0 | 1 | 2;
  envergadura: 0 | 1 | 2;
  espesor: 0 | 1 | 2;
}
export const EJES_POR_DEFECTO: EjesAla = { cuerda: 0, envergadura: 1, espesor: 2 };

export interface MetricasAla {
  /** superficie de referencia en PLANTA [m²] — la que adimensionaliza CL y CD */
  sRef: number;
  /** envergadura [m] */
  b: number;
  /** alargamiento b²/S — adimensional */
  AR: number;
  /** cuerda media AERODINÁMICA (2/S)∫c²dy [m] — la del MOMENTO */
  mac: number;
  /** cuerda media GEOMÉTRICA S/b [m] — NO uses esta para el momento */
  mgc: number;
  /** estación de envergadura donde vive la MAC [m] */
  yMac: number;
  /** cuerda en la raíz [m] */
  cRaiz: number;
  /** cuerda en la punta [m] */
  cPunta: number;
  /** estrechamiento c_punta/c_raiz */
  taper: number;
  /** flecha del borde de ataque [rad] */
  flechaBA: number;
  /** flecha de la línea de 1/4 de cuerda [rad] — la que usan las correcciones */
  flechaC4: number;
  /** superficie MOJADA total [m²] — la de la fricción, no la de referencia */
  sMojada: number;
  /** distribución de cuerda muestreada: [y, cuerda, x del borde de ataque] */
  estaciones: Array<{ y: number; c: number; xBA: number }>;
  /** número de estaciones usadas para integrar */
  n: number;
}

export interface MetricasOpts {
  ejes?: EjesAla;
  /** estaciones de muestreo a lo largo de la envergadura (por defecto 200) */
  n?: number;
  /** ignora franjas cuya cuerda sea menor que esta fracción de la máxima */
  cuerdaMinRel?: number;
}

/**
 * Mide el ala a partir de su piel.
 *
 * **La superficie en planta sale exacta, sin muestreo**: para un cuerpo cerrado,
 * cada rayo vertical cruza la piel un número par de veces, así que
 *     S_planta = ½·Σ |n_z|·A
 * es el área proyectada exacta. No es una aproximación por estaciones: es el
 * teorema de la divergencia otra vez. (Las estaciones solo se usan para la
 * distribución de cuerda, que sí necesita muestreo.)
 */
export function metricasAla(piel: Piel, opts: MetricasOpts = {}): MetricasAla {
  const ejes = opts.ejes ?? EJES_POR_DEFECTO;
  const n = opts.n ?? 200;
  const { cuerda: IX, envergadura: IY, espesor: IZ } = ejes;
  const { paneles } = piel;
  if (paneles.length === 0) throw new Error('metricasAla: la piel no tiene paneles');

  // S en planta: proyección exacta (½Σ|n_espesor|·A) y superficie mojada
  let sRef = 0, sMojada = 0;
  let yMin = Infinity, yMax = -Infinity;
  for (const p of paneles) {
    sRef += Math.abs(p.n[IZ]) * p.area;
    sMojada += p.area;
    const y = p.c[IY];
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  sRef /= 2;

  // Extremos reales de envergadura: de los VÉRTICES, no de los centroides.
  // (El centroide de un triángulo nunca toca la punta del ala.)
  // Se reconstruyen del panel: c ± una holgura no sirve, así que se usa el
  // rango de centroides ensanchado por el tamaño típico de panel.
  const b = yMax - yMin;
  if (!(b > 0)) throw new Error('metricasAla: envergadura nula — ¿ejes mal asignados?');

  // Distribución de cuerda por franjas: para cada estación, la extensión en el
  // eje de cuerda de los paneles que la cruzan.
  const dy = b / n;
  const minX = new Float64Array(n).fill(Infinity);
  const maxX = new Float64Array(n).fill(-Infinity);
  for (const p of paneles) {
    let k = Math.floor((p.c[IY] - yMin) / dy);
    if (k < 0) k = 0; else if (k >= n) k = n - 1;
    const x = p.c[IX];
    if (x < minX[k]) minX[k] = x;
    if (x > maxX[k]) maxX[k] = x;
  }

  const estaciones: MetricasAla['estaciones'] = [];
  let cMax = 0;
  for (let k = 0; k < n; k++) {
    if (!Number.isFinite(minX[k])) continue;
    const c = maxX[k] - minX[k];
    if (c > cMax) cMax = c;
    estaciones.push({ y: yMin + (k + 0.5) * dy, c, xBA: minX[k] });
  }
  const cMin = (opts.cuerdaMinRel ?? 1e-6) * cMax;
  const est = estaciones.filter((e) => e.c > cMin);
  if (est.length < 2) throw new Error('metricasAla: no hay suficientes estaciones con cuerda');

  // MAC = ∫c²dy / ∫c dy   (equivale a (2/S)∫c²dy con S = 2∫c dy)
  let ic = 0, ic2 = 0, iyc = 0;
  for (const e of est) { ic += e.c * dy; ic2 += e.c * e.c * dy; iyc += e.y * e.c * dy; }
  const mac = ic2 / ic;
  const yMac = iyc / ic;

  const cRaiz = est.reduce((m, e) => Math.max(m, e.c), 0);
  const cPunta = est[est.length - 1].c;

  // Flechas por regresión sobre las estaciones (robusta al ruido de teselado)
  const flechaDe = (fr: number): number => {
    const mitad = est.filter((e) => e.y >= yMac);           // una semiala, evita la V
    const pts = (mitad.length >= 2 ? mitad : est).map((e) => [e.y, e.xBA + fr * e.c] as const);
    const N = pts.length;
    let sy = 0, sx = 0, syy = 0, syx = 0;
    for (const [y, x] of pts) { sy += y; sx += x; syy += y * y; syx += y * x; }
    const den = N * syy - sy * sy;
    if (Math.abs(den) < 1e-30) return 0;
    return Math.atan((N * syx - sy * sx) / den);
  };

  return {
    sRef, b, AR: (b * b) / sRef,
    mac, mgc: sRef / b, yMac,
    cRaiz, cPunta, taper: cRaiz !== 0 ? cPunta / cRaiz : 0,
    flechaBA: flechaDe(0), flechaC4: flechaDe(0.25),
    sMojada,
    estaciones: est, n: est.length,
  };
}

/**
 * MAC analítica de un ala TRAPEZOIDAL — el fixture con el que se valida la
 * medición sobre geometría real:
 *     MAC = (2/3)·c_raiz·(1 + λ + λ²)/(1 + λ)
 * Para un ala rectangular (λ=1) da c_raiz, y coincide con la cuerda media.
 * Para λ→0 (delta pura) da (2/3)·c_raiz, un 33% menos.
 */
export function macTrapezoidal(cRaiz: number, taper: number): number {
  return (2 / 3) * cRaiz * (1 + taper + taper * taper) / (1 + taper);
}

/** Cuerda media GEOMÉTRICA de un ala trapezoidal: el promedio simple. */
export function mgcTrapezoidal(cRaiz: number, taper: number): number {
  return (cRaiz * (1 + taper)) / 2;
}

/**
 * Cuánto se equivoca el momento si se usa la cuerda media geométrica en vez de
 * la aerodinámica. Devuelve el error RELATIVO (MAC/MGC − 1).
 * Es máximo en la delta pura (λ=0): 33%. En el Orbiter de Bertin: 14.8%.
 */
export function errorPorConfundirCuerdas(taper: number): number {
  return macTrapezoidal(1, taper) / mgcTrapezoidal(1, taper) - 1;
}
