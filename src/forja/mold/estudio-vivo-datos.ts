/**
 * EL ESTUDIO VIVO — la lógica PURA (sin DOM, sin React, sin three).
 * ============================================================================
 * Todo lo que la pantalla `EstudioVivo.tsx` necesita para decidir COLOR y NÚMERO
 * vive aquí, para que se pueda probar sin navegador. La pantalla es la piel.
 *
 * Dos reglas duras del proyecto quedan CODIFICADAS en este archivo, no en la piel:
 *
 *  1. **ESCALA DE COLOR FIJA.** Cada capa trae su dominio `dom` como CONSTANTE
 *     y sus marcas de leyenda. Nunca se auto-ajusta al dato: Kazmer juzga
 *     CONTANDO contornos (¿cuántas zonas pasan de 0.5°? ¿cuánta área supera 2×
 *     la pared nominal?), y una rampa que se re-normaliza con cada pieza borra
 *     ese criterio — dos piezas distintas se verían "igual de rojas".
 *     Lo que cae fuera del dominio se SATURA y la leyenda lo dice con ≤ / ≥.
 *
 *  2. **LO NO MEDIDO NO SE PINTA COMO BUENO.** `SIN_DATO` es GRIS, no verde ni
 *     azul (que serían el extremo "sano" de la rampa). Una columna sin material,
 *     una cara que no es lateral o un vóxel que el campo no alcanzó salen grises
 *     y el panel dice por qué.
 *
 * La banda de error de cada capa se DECLARA (`banda`) o se declara ausente
 * (`banda: null` → la pantalla imprime "sin banda"). Fingir precisión es peor
 * que no tenerla.
 */

/* ────────────────────────────────────────────────────────────────────────── */
/* Rampa de color                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export type RGB = [number, number, number];

/** Rampa fija de 6 paradas (azul noche → rojo). Legible sobre fondo #05070B. */
const PARADAS: Array<[number, RGB]> = [
  [0.0, [0.063, 0.137, 0.247]],
  [0.2, [0.122, 0.435, 0.698]],
  [0.4, [0.141, 0.690, 0.608]],
  [0.6, [0.624, 0.820, 0.298]],
  [0.8, [0.949, 0.694, 0.204]],
  [1.0, [0.878, 0.290, 0.184]],
];

/** GRIS de "no medido". Deliberadamente FUERA de la rampa: no se puede confundir
 *  con ningún valor bueno ni malo — es la ausencia de dato. */
export const SIN_DATO: RGB = [0.255, 0.282, 0.337];

/** t ∈ [0,1] → color de la rampa (fuera de rango se satura en los extremos). */
export function rampa(t: number): RGB {
  if (!Number.isFinite(t)) return SIN_DATO;
  const u = t <= 0 ? 0 : t >= 1 ? 1 : t;
  let i = 0;
  while (i < PARADAS.length - 2 && u > PARADAS[i + 1][0]) i++;
  const [a, ca] = PARADAS[i], [b, cb] = PARADAS[i + 1];
  const f = b === a ? 0 : (u - a) / (b - a);
  return [ca[0] + (cb[0] - ca[0]) * f, ca[1] + (cb[1] - ca[1]) * f, ca[2] + (cb[2] - ca[2]) * f];
}

const h2 = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0');
export function rampaHex(t: number): string {
  const c = rampa(t);
  return `#${h2(c[0])}${h2(c[1])}${h2(c[2])}`;
}
export function hexDe(c: RGB): string { return `#${h2(c[0])}${h2(c[1])}${h2(c[2])}`; }

/** Normaliza un valor a [0,1] dentro del dominio FIJO de la capa. NaN pasa como NaN. */
export function norm(v: number, dom: [number, number]): number {
  if (!Number.isFinite(v)) return NaN;
  return (v - dom[0]) / (dom[1] - dom[0] || 1);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Las capas                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export type CapaId = 'forma' | 'espesor' | 'draft' | 'visible' | 'flujo' | 'termico';

export interface MarcaLeyenda { v: number; et: string; /** umbral DURO del libro */ dura?: boolean }

export interface DefCapa {
  id: CapaId;
  nombre: string;
  icono: string;
  /** qué mide, en una línea que el operador pueda leer de un vistazo */
  que: string;
  unidad: string;
  /** el § del libro que la manda (Kazmer) */
  seccion: string;
  /** DOMINIO FIJO de la escala de color. Constante — nunca se ajusta al dato. */
  dom: [number, number];
  marcas: MarcaLeyenda[];
  /** banda de error conocida, o null = "sin banda" (se imprime tal cual) */
  banda: string | null;
  /** true = valores ALTOS son el riesgo (espesor, flujo, T); false = BAJOS (draft).
   *  La pantalla lo IMPRIME: sin esto el rojo se lee siempre como "malo", y en draft
   *  el rojo es lo BUENO (mucho ángulo de salida) — leer la rampa al revés es peor
   *  que no verla. */
  altoEsRiesgo: boolean;
  /** advertencia sobre CÓMO se mide (no sobre el error): la trampa de interpretación
   *  que la imagen no puede contar sola. null = no hay. */
  advertencia: string | null;
  /** por qué puede salir gris */
  porqueGris: string;
  /** el motor que la calcula (para que la pantalla no invente autoría) */
  motor: string;
}

export const CAPAS: DefCapa[] = [
  {
    id: 'forma', nombre: 'FORMA', icono: '◻', que: 'la malla cruda, sin análisis encima',
    unidad: '—', seccion: '—', dom: [0, 1], marcas: [], banda: null, altoEsRiesgo: false,
    advertencia: null,
    porqueGris: 'no hay capa activa: el color es el material neutro',
    motor: 'stl.ts · parseSTL',
  },
  {
    id: 'espesor', nombre: 'ESPESOR DE PARED', icono: '▤',
    que: 'espesor de plástico por columna en la dirección de apertura (+Z)',
    unidad: 'mm', seccion: '§2.3.1 (Fig 2.2)', dom: [0, 6],
    marcas: [
      { v: 0, et: '0' }, { v: 1.5, et: '1.5 pared típica' },
      { v: 3, et: '3.0 = 2× nominal', dura: true }, { v: 4.5, et: '4.5' }, { v: 6, et: '≥ 6' },
    ],
    banda: 'raster de columnas de 0.8 mm de celda: el espesor se cuantiza a ±0.8 mm en planta; en Z es exacto (cruces del rayo)',
    altoEsRiesgo: true,
    advertencia: "⚠ el mapa mide POR COLUMNA en +Z (Fig 2.2): en una pared VERTICAL la columna recorre toda la altura, así que el número es la ALTURA de esa pared, no su calibre. El calibre se lee en las caras que miran a +Z/−Z (fondo, tapas, costillas).",
    porqueGris: 'columna sin material (el rayo vertical no cruzó la pieza ahí)',
    motor: 'dfm-mesh.ts · dfmFromMesh().thickMap',
  },
  {
    id: 'draft', nombre: 'ÁNGULO DE SALIDA', icono: '◺',
    que: 'draft mínimo por columna, φ = asin(|n_z|) sobre caras laterales',
    unidad: '°', seccion: '§2.3.6 · Tabla 2.14', dom: [0, 5],
    marcas: [
      { v: 0, et: '0° pared vertical' },
      { v: 0.5, et: '0.5° mínimo del libro', dura: true },
      { v: 1.5, et: '1.5° B-3/ABS (Tabla 2.14)', dura: true },
      { v: 3, et: '3°' }, { v: 5, et: '≥ 5°' },
    ],
    banda: 'ángulo EXACTO por triángulo (asin de la normal); la cuantización es de la celda de 0.8 mm al agregar por columna, y se guarda el PEOR',
    altoEsRiesgo: false,
    advertencia: "⚠ el ángulo se mide contra la dirección de apertura +Z FIJA. Si la pieza va volteada en el molde, el veredicto cambia — usa el botón VOLTEAR y vuelve a leer.",
    porqueGris: 'la columna no tiene cara lateral (|n_z| ≥ sin 45°): arriba/abajo no rozan al expulsar',
    motor: 'dfm-mesh.ts · dfmFromMesh().draftMap',
  },
  {
    id: 'visible', nombre: 'LO QUE VE EL USUARIO', icono: '👁',
    que: 'fracción de área del triángulo visible desde alguna vista de uso (z-buffer)',
    unidad: 'fracción', seccion: '§4.1.2 · §7.1.3 · §11.2.5', dom: [0, 1],
    marcas: [
      { v: 0, et: '0 = oculta (aquí van gate y expulsores)', dura: true },
      { v: 0.5, et: '0.5 medio tapada' },
      { v: 1, et: '1 = a la vista (nada de marcas)', dura: true },
    ],
    banda: 'z-buffer ortográfico: el error es de 1 píxel del buffer ≈ L/res mm en planta; la fracción por triángulo es un conteo exacto de píxeles ganados',
    altoEsRiesgo: true,
    advertencia: "⚠ las vistas de uso son el SUPUESTO DE LA TAZA (hemisferio superior + cuatro costados, sin la cara de asiento), no una declaración del cliente. Si el cliente declara las suyas, mandan las suyas.",
    porqueGris: 'no aplica: todos los triángulos reciben fracción (0 es un DATO, no ausencia)',
    motor: 'visibilidad.ts · clasificarVisibilidad().fracMaxTri',
  },
  {
    id: 'flujo', nombre: 'LONGITUD DE FLUJO', icono: '≈',
    que: 'camino que recorre el fundido desde la compuerta hasta ese punto',
    unidad: 'mm', seccion: '§5.5.5 · §7.2', dom: [0, 150],
    marcas: [
      { v: 0, et: '0 = la compuerta' }, { v: 50, et: '50' }, { v: 100, et: '100' },
      { v: 150, et: '≥ 150 (último en llenar)', dura: true },
    ],
    banda: 'la trae el propio campo: si la celda no resuelve la pared, el campo lo AVISA y el número es de una pared engordada (ver la barra de verificación)',
    altoEsRiesgo: true,
    advertencia: "⚠ una sola compuerta, colocada por `defaultGate` en el punto más cercano al centro sobre la partición. Otra compuerta da otro campo: esto NO es el estudio de llenado final.",
    porqueGris: 'vóxel que la compuerta no alcanzó (aire, o pared que se perdió entre celdas)',
    motor: 'flowlen.ts · measureFlowLength (Dijkstra sobre resistencia power-law)',
  },
  {
    id: 'termico', nombre: 'CAMPO TÉRMICO', icono: '🌡',
    que: 'temperatura del plástico por columna en régimen cíclico',
    unidad: '°C', seccion: '§9.1 · §9.2', dom: [60, 260],
    marcas: [
      { v: 60, et: '60 refrigerante' }, { v: 97.6, et: '97.6 T_eject ABS', dura: true },
      { v: 160, et: '160' }, { v: 239, et: '239 T_melt ABS', dura: true }, { v: 260, et: '≥ 260' },
    ],
    banda: null,   // se sustituye en vivo por resuelveLaPared(): si la celda no cabe en la pared, NO hay banda, hay una MEZCLA
    altoEsRiesgo: true,
    advertencia: "⚠ la pieza se ubica en la placa mapeando su caja contra la HUELLA de la cavidad en el grid (afín, bbox→bbox). Correcto para una pieza centrada en su bolsa; aproximado si la bolsa trae holgura asimétrica.",
    porqueGris: 'columna fuera de la huella de la cavidad (ahí lo que hay es acero, no pieza)',
    motor: 'mold-thermal-fdm.ts · createThermalSim + computeSteady',
  },
];

export const capaDe = (id: CapaId): DefCapa => CAPAS.find((c) => c.id === id) ?? CAPAS[0];

/* ────────────────────────────────────────────────────────────────────────── */
/* Malla: caja, volteo, spec                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export interface MallaSimple { positions: Float32Array | number[]; indices: Uint32Array | number[] }

export interface Caja { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }

export function cajaDe(m: MallaSimple): Caja {
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
 * VOLTEAR la pieza π sobre X (y→−y, z→−z) y re-anclar en el mismo origen.
 * Es la operación que decide el importador (§11: la pieza debe ABRAZAR el núcleo B
 * al abrir) y la que hace que TODA la pantalla se recalcule: el raster de espesor,
 * el draft y los undercuts se miden en la dirección de apertura +Z, así que voltear
 * NO es cosmético — cambia el veredicto.
 *
 * EL DEVANADO NO SE TOCA. La parte lineal de esta transformación es diag(1,−1,−1) y
 * su determinante es +1: es una ROTACIÓN propia, no una reflexión. Mi primera versión
 * invertía b↔c "por si acaso" y el resultado fue que TODAS las normales quedaron
 * mirando hacia adentro — la barra de verificación lo cazó al instante (VOLUMEN-SIGNO:
 * volumen con signo = −1.7036e+4 ≤ 0, carcasa RPi4, 2026-08-06). Ese es exactamente el
 * trabajo de la matrícula: no dejar pasar una malla rota disfrazada de imagen bonita.
 */
export function voltearMalla(m: MallaSimple): MallaSimple {
  const P = m.positions, I = m.indices;
  const c = cajaDe(m);
  const out = new Float32Array(P.length);
  for (let i = 0; i < P.length; i += 3) {
    out[i] = P[i];
    out[i + 1] = c.y0 + c.y1 - P[i + 1];
    out[i + 2] = c.z0 + c.z1 - P[i + 2];
  }
  const idx = I instanceof Uint32Array ? I.slice() : new Uint32Array(I);
  return { positions: out, indices: idx };
}

/** Volumen (mm³) y área (mm²) por el teorema de la divergencia — el mismo criterio
 *  que usa `revisar-modelo.meshVolumeArea`; se repite aquí para no acoplar la
 *  pantalla al camino largo de revisión. */
export function volumenArea(m: MallaSimple): { volumeMm3: number; areaMm2: number } {
  const P = m.positions, I = m.indices;
  let vol6 = 0, area2 = 0;
  for (let t = 0; t + 2 < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ax = P[a], ay = P[a + 1], az = P[a + 2];
    const bx = P[b], by = P[b + 1], bz = P[b + 2];
    const cx = P[c], cy = P[c + 1], cz = P[c + 2];
    vol6 += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    area2 += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  }
  return { volumeMm3: Math.abs(vol6) / 6, areaMm2: area2 / 2 };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Muestreo de los mapas                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

/** Un mapa por COLUMNA del raster de dfm-mesh (coords de MUNDO: x0/y0 son el min real). */
export interface MapaColumna { nx: number; ny: number; sx: number; sy: number; x0: number; y0: number }

/** Valor del mapa de columnas en (x,y) mm de mundo. NaN = sin dato (se pinta gris). */
export function muestraColumna(m: MapaColumna, datos: Float32Array, x: number, y: number): number {
  const i = Math.floor((x - m.x0) / m.sx), j = Math.floor((y - m.y0) / m.sy);
  if (i < 0 || j < 0 || i >= m.nx || j >= m.ny) return NaN;
  return datos[j * m.nx + i];
}

/**
 * Valor del mapa de columnas TOLERANTE al borde: los vértices de la malla caen
 * JUSTO sobre la superficie, y media pared cae del lado de afuera de la celda. Sin
 * esta búsqueda en anillo, la pieza salía con un moteado gris en todo el contorno —
 * y ese gris NO era "no medido", era el borde de la rejilla. Se declara el radio
 * usado para que la lectura no finja ser puntual cuando no lo fue.
 */
export function muestraColumnaCerca(
  m: MapaColumna, datos: Float32Array, x: number, y: number,
  /** cuál es el PEOR caso de esta magnitud: 'max' para espesor (grueso = riesgo),
   *  'min' para draft (poco ángulo = riesgo). El anillo nunca suaviza a favor. */
  peor: 'max' | 'min' = 'max', radio = 2,
): { v: number; anillo: number } {
  const i0 = Math.floor((x - m.x0) / m.sx), j0 = Math.floor((y - m.y0) / m.sy);
  for (let r = 0; r <= radio; r++) {
    let mejor = NaN;
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (r > 0 && Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;   // solo el anillo
      const i = i0 + di, j = j0 + dj;
      if (i < 0 || j < 0 || i >= m.nx || j >= m.ny) continue;
      const v = datos[j * m.nx + i];
      if (!Number.isFinite(v)) continue;
      if (!Number.isFinite(mejor) || (peor === 'max' ? v > mejor : v < mejor)) mejor = v;
    }
    if (Number.isFinite(mejor)) return { v: mejor, anillo: r };
  }
  return { v: NaN, anillo: -1 };
}

/** El campo de vóxeles de flowlen (lo que `measureFlowLength` devuelve). */
export interface CampoVox {
  nx: number; ny: number; nz: number; cellMm: number;
  x0: number; y0: number; z0: number;
  idx(i: number, j: number, k: number): number;
}

/**
 * Valor finito más cercano del campo de vóxeles (los vértices caen EN la superficie,
 * o sea medio vóxel fuera del hueco). Devuelve el radio en el que lo halló.
 *
 * `agrega`: 'min' para la longitud de flujo (el camino más corto desde la compuerta);
 * 'max' para el espesor local. `ceroEsVacio` es OBLIGATORIO para el espesor: los
 * vóxeles que NO son hueco traen thickness = 0, que es un número perfectamente finito
 * y perfectamente falso. Sin este filtro, el anillo agarraba un 0 del acero vecino y
 * la sonda imprimía "espesor local 0.00 mm" y un L/t inventado — un número con cara de
 * dato. Medido en la carcasa RPi4 (2026-08-06).
 */
export function muestraVox(
  f: CampoVox, arr: Float32Array, x: number, y: number, z: number,
  o?: { agrega?: 'min' | 'max'; ceroEsVacio?: boolean; radio?: number },
): { v: number; anillo: number } {
  const agrega = o?.agrega ?? 'min';
  const radio = o?.radio ?? 2;
  const i0 = Math.floor((x - f.x0) / f.cellMm);
  const j0 = Math.floor((y - f.y0) / f.cellMm);
  const k0 = Math.floor((z - f.z0) / f.cellMm);
  for (let r = 0; r <= radio; r++) {
    let mejor = NaN;
    for (let dk = -r; dk <= r; dk++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (r > 0 && Math.max(Math.abs(di), Math.abs(dj), Math.abs(dk)) !== r) continue;
      const i = i0 + di, j = j0 + dj, k = k0 + dk;
      if (i < 0 || j < 0 || k < 0 || i >= f.nx || j >= f.ny || k >= f.nz) continue;
      const v = arr[f.idx(i, j, k)];
      if (!Number.isFinite(v)) continue;
      if (o?.ceroEsVacio && v <= 0) continue;
      if (!Number.isFinite(mejor) || (agrega === 'min' ? v < mejor : v > mejor)) mejor = v;
    }
    if (Number.isFinite(mejor)) return { v: mejor, anillo: r };
  }
  return { v: NaN, anillo: -1 };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* La huella térmica: dónde vive la pieza dentro de la placa                   */
/* ────────────────────────────────────────────────────────────────────────── */

export interface Huella { x0: number; y0: number; x1: number; y1: number; celdas: number }

/**
 * LA HUELLA de UNA cavidad dentro del grid del molde, por inundación 4-conexa sobre
 * el mapa de espesor `thGrid` (celdas con plástico). Se toma la componente MÁS GRANDE:
 * con varias cavidades el bbox global abarcaría las dos y el mapeo pieza→placa se
 * partiría a la mitad.
 *
 * ⚠ DECLARADO: esto ubica la pieza en coords de PLACA sin suponer dónde puso el
 * generador la cavidad. El mapeo resultante es afín (bbox→bbox) — correcto para
 * una pieza centrada en su bolsa, aproximado si la bolsa trae holgura asimétrica.
 */
export function huellaDeGrid(g: { nx: number; ny: number; cellMm: number; thMm: Float32Array }): Huella | null {
  const { nx, ny, cellMm, thMm } = g;
  const visto = new Uint8Array(nx * ny);
  let mejor: Huella | null = null;
  const pila: number[] = [];
  for (let s = 0; s < nx * ny; s++) {
    if (visto[s] || !(thMm[s] > 0)) continue;
    pila.length = 0; pila.push(s); visto[s] = 1;
    let i0 = nx, j0 = ny, i1 = -1, j1 = -1, n = 0;
    while (pila.length) {
      const p = pila.pop() as number;
      const i = p % nx, j = (p - i) / nx;
      n++;
      if (i < i0) i0 = i; if (i > i1) i1 = i;
      if (j < j0) j0 = j; if (j > j1) j1 = j;
      const vec = [i > 0 ? p - 1 : -1, i < nx - 1 ? p + 1 : -1, j > 0 ? p - nx : -1, j < ny - 1 ? p + nx : -1];
      for (const q of vec) if (q >= 0 && !visto[q] && thMm[q] > 0) { visto[q] = 1; pila.push(q); }
    }
    if (!mejor || n > mejor.celdas) {
      mejor = { x0: i0 * cellMm, y0: j0 * cellMm, x1: (i1 + 1) * cellMm, y1: (j1 + 1) * cellMm, celdas: n };
    }
  }
  return mejor;
}

/** Mapea un punto de la PIEZA (mm de la malla) al frame de PLACA del campo térmico. */
export function piezaAPlaca(h: Huella, caja: Caja, x: number, y: number): { x: number; y: number } {
  const u = (x - caja.x0) / ((caja.x1 - caja.x0) || 1);
  const v = (y - caja.y0) / ((caja.y1 - caja.y0) || 1);
  return { x: h.x0 + u * (h.x1 - h.x0), y: h.y0 + v * (h.y1 - h.y0) };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Colores por vértice                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Construye el buffer de color (3 floats por vértice) a partir de una función de
 * valor. `valorEn(v)` devuelve el valor físico del vértice v, o NaN → GRIS.
 * Devuelve además el histograma de saturación, que es lo que permite decir en la
 * leyenda cuánta superficie se salió del dominio fijo (en vez de esconderlo).
 */
export function coloresDesde(
  nVerts: number, dom: [number, number], valorEn: (v: number) => number,
): { colores: Float32Array; nSinDato: number; nBajo: number; nAlto: number } {
  const col = new Float32Array(nVerts * 3);
  let nSinDato = 0, nBajo = 0, nAlto = 0;
  for (let v = 0; v < nVerts; v++) {
    const val = valorEn(v);
    let c: RGB;
    if (!Number.isFinite(val)) { c = SIN_DATO; nSinDato++; }
    else {
      if (val < dom[0]) nBajo++; else if (val > dom[1]) nAlto++;
      c = rampa(norm(val, dom));
    }
    col[v * 3] = c[0]; col[v * 3 + 1] = c[1]; col[v * 3 + 2] = c[2];
  }
  return { colores: col, nSinDato, nBajo, nAlto };
}

/** Color plano (la capa FORMA: material neutro, sin fingir análisis). */
export function coloresPlanos(nVerts: number, c: RGB): Float32Array {
  const col = new Float32Array(nVerts * 3);
  for (let v = 0; v < nVerts; v++) { col[v * 3] = c[0]; col[v * 3 + 1] = c[1]; col[v * 3 + 2] = c[2]; }
  return col;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Formato                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export function num(v: number, d = 2): string {
  return Number.isFinite(v) ? v.toFixed(d) : '—';
}

/** Piezas del banco que la pantalla ofrece. Todas son STL REALES de `test-parts/`. */
export const PIEZAS: Array<{ id: string; nombre: string; ruta: string; nota: string }> = [
  { id: 'rpi4', nombre: 'carcasa RPi4', ruta: 'test-parts/rpi4-bottom.stl', nota: 'pared 1.5 mm, con ventanas — la pieza de referencia del banco' },
  { id: 'ttc', nombre: 'caja TTC', ruta: 'test-parts/ttc-box-a.stl', nota: 'caja cerrada: contraste de espesor entre fondo y costillas' },
  { id: 'tapa', nombre: 'tapa médica', ruta: 'test-parts/screw-cap-medical.stl', nota: 'revolución con rosca: el draft se lee de un vistazo' },
  { id: 'phone', nombre: 'phone holder', ruta: 'test-parts/phone-holder.stl', nota: 'malla ligera (1.4k triángulos): recálculo casi instantáneo' },
  { id: 'embudo', nombre: 'embudo 130', ruta: 'test-parts/funnel-130.stl', nota: 'cono profundo: el flujo recorre mucho desde la compuerta' },
];
