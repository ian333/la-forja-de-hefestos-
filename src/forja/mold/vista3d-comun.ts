/**
 * VISTAS 3D DE CAMPO — lo PURO que comparten `vista3d-alabeo` y `vista3d-agua`.
 * ============================================================================
 * "Esas vistas no me sirven de nada si no es en 3D e integrada a La Forja."
 * (operador, tres veces). Las láminas L17 (alabeo) y L10 (circuito de agua) son
 * imágenes planas de fenómenos TRIDIMENSIONALES; estas dos vistas los ponen en el
 * espacio, dentro del Estudio Vivo, girables y consultables a dedo.
 *
 * Aquí vive lo que se puede probar SIN navegador:
 *  · las ESCALAS DE COLOR FIJAS con su leyenda y el lado del riesgo DECLARADO
 *    (misma regla dura que `estudio-vivo-datos.ts`: auto-escalar destruye el
 *    criterio de Kazmer, que se juzga CONTANDO contornos);
 *  · `specDeEnsamble`, que consigue el `MoldAssemblySpec` de la pieza — reusando
 *    la MISMA cadena que ya usa el Estudio Vivo para su capa térmica
 *    (`moldMachine` → `packageToAssemblySpec`), para que las dos pantallas no
 *    puedan discrepar sobre qué molde es;
 *  · `encajar`, que mete la composición de una vista dentro de la caja de la
 *    pieza. Es NECESARIO: el Estudio encuadra la cámara a `cajaDe(malla)`, y el
 *    molde de agua mide 4× la pieza — sin esto la cámara quedaría DENTRO del
 *    acero. La escala aplicada se IMPRIME; las cotas siguen en mm REALES.
 */
import { moldMachine } from './moldmachine';
import { packageToAssemblySpec } from './mold-plano-set';
import type { MoldAssemblySpec } from './mold-assembly';
import { volumenArea, type Caja, type MallaSimple } from './estudio-vivo-datos';

/* ────────────────────────────────────────────────────────────────────────── */
/* Contrato de las vistas                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/** Una lectura de sonda: lo que la vista reporta al panel del Estudio. */
export interface LecturaVista3D {
  titulo: string; valor: string; nota?: string; seccion: string;
}

export interface PropsVista3D {
  malla: MallaSimple;
  caja: Caja;
  /** el `MoldAssemblySpec` del Estudio. null ⇒ la vista lo deriva de la malla. */
  spec: any | null;
  /** el control de la vista, 0..1 (exageración · recorrido del refrigerante) */
  t: number;
  onLectura?: (l: LecturaVista3D) => void;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Escalas de color FIJAS                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

export interface MarcaEsc { v: number; et: string; /** umbral DURO del libro */ dura?: boolean }

export interface Escala {
  titulo: string;
  unidad: string;
  /** DOMINIO FIJO — constante, jamás ajustado al dato. */
  dom: [number, number];
  marcas: MarcaEsc[];
  /**
   * Dónde vive el RIESGO en la rampa. `'separacion'` es un caso real y distinto:
   * en ΔT núcleo↔cavidad ningún extremo es malo por sí solo — lo que hace daño
   * es que los dos lados NO tengan el mismo color (2 °C dan 1.6 mm de alabeo).
   * Sin decirlo, el rojo se lee siempre como "malo" y el criterio se invierte.
   */
  riesgo: 'alto' | 'bajo' | 'separacion';
  notaRiesgo: string;
  /** por qué algo puede salir GRIS (= no medido, nunca "bueno") */
  porqueGris: string;
}

/** |u_z| del alabeo. Anclada a los DOS números del ejemplo del bezel (§10.3.1):
 *  la contracción total de borde a borde (0.8 mm) y el alabeo que la SUPERA (1.6). */
export const ESC_DESPLAZAMIENTO: Escala = {
  titulo: 'DESPLAZAMIENTO FUERA DE PLANO |u_z|', unidad: 'mm', dom: [0, 3],
  marcas: [
    { v: 0, et: '0 = no se mueve' },
    { v: 0.8, et: '0.8 = contracción TOTAL del bezel (§10.3.1)', dura: true },
    { v: 1.6, et: '1.6 = δ del ejemplo del libro (Ec. 10.18)', dura: true },
    { v: 3, et: '≥ 3' },
  ],
  riesgo: 'alto',
  notaRiesgo: 'RIESGO = el extremo ROJO. El libro alarma cuando δ SUPERA a la contracción total: "the dimensional changes due to warpage can far exceed the shrinkage".',
  porqueGris: 'vértice sin campo de desplazamiento (no ocurre: el campo cubre toda la malla)',
};

/** ΔT de cada mitad del molde respecto a la media núcleo/cavidad. */
export const ESC_DT_MOLDE: Escala = {
  titulo: 'ΔT de cada mitad respecto a la media', unidad: '°C', dom: [-3, 3],
  marcas: [
    { v: -3, et: '−3' },
    { v: -1, et: '−1 = la mitad FRÍA del ejemplo (132 °C)', dura: true },
    { v: 0, et: '0 = las dos mitades iguales (lo que se busca)' },
    { v: 1, et: '+1 = la mitad CALIENTE del ejemplo (134 °C)', dura: true },
    { v: 3, et: '≥ +3' },
  ],
  riesgo: 'separacion',
  notaRiesgo: 'RIESGO = que las dos mitades NO tengan el MISMO color. Ningún extremo es malo solo: 2 °C de SEPARACIÓN ya dan 1.6 mm de alabeo (Ec. 10.17-10.18).',
  porqueGris: 'mitad sin temperatura declarada',
};

/** Contracción lineal s(r) del centro al borde (el gradiente que PANDEA). */
export const ESC_CONTRACCION: Escala = {
  titulo: 'contracción lineal s(r), centro → borde', unidad: '%', dom: [0, 1],
  marcas: [
    { v: 0, et: '0 = no contrae' },
    { v: 0.31, et: '0.31 % = el bezel ABS del libro (p. 239-241)', dura: true },
    { v: 0.5, et: '0.5 %' },
    { v: 1, et: '≥ 1 %' },
  ],
  riesgo: 'separacion',
  notaRiesgo: 'RIESGO = la SEPARACIÓN centro↔borde. Si (s_borde − s_centro) pasa 0.44·(h/W)² el área cerrada ya no lo acomoda en el plano y PANDEA (Ec. 10.19).',
  porqueGris: 'radio fuera del semiancho W del criterio',
};

/** ΔT ACUMULADO del refrigerante a lo largo del circuito (el argumento de Fig 9.12). */
export const ESC_AGUA: Escala = {
  titulo: 'ΔT ACUMULADO del refrigerante', unidad: '°C', dom: [0, 5],
  marcas: [
    { v: 0, et: '0 = entrada (IN)' },
    { v: 1, et: '1.0 = ΔT de diseño de UNA línea (Eq 9.13)', dura: true },
    { v: 3, et: '3.0' },
    { v: 5, et: '≥ 5 — la última cavidad enfría PEOR (Fig 9.12)', dura: true },
  ],
  riesgo: 'alto',
  notaRiesgo: 'RIESGO = el extremo ROJO. Eq 9.13 dimensiona el caudal para ≤1 °C POR LÍNEA; un serpentín de N líneas EN SERIE acumula N veces esa subida, y la última impresión recibe agua ya caliente.',
  porqueGris: 'tramo sin calor asignado (no pasa por debajo de ninguna impresión)',
};

/* ────────────────────────────────────────────────────────────────────────── */
/* Rótulos: tipos, envoltura y MEDIDA (puros — los usa el encuadre)           */
/* ────────────────────────────────────────────────────────────────────────── */

export interface LineaRotulo {
  txt: string;
  color?: string;
  /** 700 = destacado (títulos, umbrales duros) */
  peso?: number;
  /** tamaño relativo (1 = cuerpo) */
  sz?: number;
}

/** métrica del canvas de rótulo (px de textura) — una sola fuente para dibujar y medir */
export const ROTULO_PX = 26;
export const ROTULO_PAD = 18;
/** avance de la mono (JetBrains Mono ≈ 0.6 em). Aproximación DECLARADA: se usa
 *  solo para ESTIMAR el alto del sprite al encuadrar, no para dibujar. */
const AVANCE = 0.6;

/**
 * ENVOLVER a `max` caracteres. NO es cosmética: el sprite tiene ANCHO fijo en
 * unidades de mundo, así que un renglón de 130 caracteres encoge la letra a la
 * mitad y la tarjeta deja de leerse. La primera corrida del arnés lo mostró: las
 * leyendas salieron ilegibles justo porque sus renglones eran los más largos.
 */
export function envolver(l: LineaRotulo, max: number): LineaRotulo[] {
  if (l.txt.length <= max) return [l];
  const sangria = /^\s/.test(l.txt) ? '   ' : '';
  const out: LineaRotulo[] = [];
  let cur = '';
  for (const p of l.txt.trim().split(/\s+/)) {
    if (cur && (cur + ' ' + p).length > max) { out.push({ ...l, txt: cur }); cur = sangria + p; }
    else cur = cur ? `${cur} ${p}` : (out.length ? sangria + p : (/^\s/.test(l.txt) ? '  ' : '') + p);
  }
  if (cur) out.push({ ...l, txt: cur });
  return out;
}

/**
 * Medida del rótulo en px de textura. La usa el ENCUADRE: sin ella, el alto del
 * sprite se estimaba a ojo y la tarjeta se salía del cuadro (pasó en la segunda
 * corrida: la tarjeta del agua quedó cortada arriba).
 */
export function medidaRotulo(lineas: LineaRotulo[], max = 999): { w: number; h: number; alto: (ancho: number) => number } {
  const ls = lineas.flatMap((l) => envolver(l, max));
  let w = 0, h = 0;
  for (const l of ls) {
    const sz = ROTULO_PX * (l.sz ?? 1);
    w = Math.max(w, l.txt.length * AVANCE * sz);
    h += sz * 1.45;
  }
  const W = Math.max(64, w + ROTULO_PAD * 2), H = Math.max(32, h + ROTULO_PAD * 2);
  return { w: W, h: H, alto: (ancho: number) => (ancho * H) / W };
}

/** Los renglones de la LEYENDA de una escala. Aquí (y no en la piel) para que el
 *  encuadre pueda MEDIRLA antes de dibujarla. `cab` = cuántos renglones ocupa el
 *  encabezado (la barra de rampa se alinea con las marcas, que van después). */
export function lineasLeyenda(e: Escala, max = 52): { cab: LineaRotulo[]; marcas: LineaRotulo[]; pie: LineaRotulo[] } {
  const cab = [
    { txt: `ESCALA FIJA · ${e.titulo} [${e.unidad}]`, color: '#c9a227', peso: 700, sz: 0.9 },
    { txt: `dominio ${e.dom[0]} – ${e.dom[1]} ${e.unidad} — CONSTANTE, no se ajusta a la pieza`, color: '#8fa3bd', sz: 0.74 },
  ].flatMap((l) => envolver(l as LineaRotulo, max));
  const marcas = e.marcas.map<LineaRotulo>((m) => ({
    txt: `   ${m.et}${m.dura ? '  ◂ umbral' : ''}`,
    color: m.dura ? '#e9eef5' : '#8fa3bd', peso: m.dura ? 700 : 400, sz: 0.78,
  }));
  const pie: LineaRotulo[] = [
    ...envolver({ txt: e.notaRiesgo, color: '#ffb347', peso: 700, sz: 0.74 }, max),
    ...envolver({ txt: `gris = NO MEDIDO (${e.porqueGris})`, color: '#8b93a3', sz: 0.7 }, max),
  ];
  return { cab, marcas, pie };
}

/** Alto (en unidades de mundo) que ocupará la leyenda de `e` dibujada a `ancho`. */
export function altoLeyenda(e: Escala, ancho: number, max = 52): number {
  const { cab, marcas, pie } = lineasLeyenda(e, max);
  return medidaRotulo([...cab, ...marcas, ...pie]).alto(ancho);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Utilidades numéricas                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Escalón 1-2-5 (el de los instrumentos). Se usa para el FACTOR DE EXAGERACIÓN:
 * un factor "×23.7382" se lee como un número calculado a la medida del dato y
 * huele a truco; "×20" se lee como lo que es, una elección declarada.
 */
export function escalon125(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

export function fmt(v: number, d = 2): string {
  return Number.isFinite(v) ? v.toFixed(d) : '—';
}

/** Caja vacía a la que se le pueden ir metiendo puntos. */
export interface CajaViva { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }
export const cajaVacia = (): CajaViva => ({ x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity });
export function meter(c: CajaViva, x: number, y: number, z: number): void {
  if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x;
  if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
  if (z < c.z0) c.z0 = z; if (z > c.z1) c.z1 = z;
}

export interface Encaje {
  escala: number;
  /** posición del grupo hijo (se aplica DESPUÉS de la escala, en coords de padre) */
  offset: [number, number, number];
  /** el centro de la composición, en sus PROPIAS coordenadas */
  centro: [number, number, number];
  /** texto para imprimir: nunca una escala implícita */
  nota: string;
}

/**
 * Mete la composición `dentro` en la caja `destino` (uniforme, centrada).
 *
 * POR QUÉ EXISTE: el Estudio Vivo encuadra la cámara con `cajaDe(malla)` — la
 * caja de la PIEZA. La vista del agua dibuja el MOLDE, que mide 3-5× eso: sin
 * encajar, la cámara nace dentro del acero y no se ve nada. La escala aplicada
 * se IMPRIME en el rótulo y las cotas siguen diciendo milímetros REALES.
 */
export function encajar(dentro: CajaViva, destino: Caja, llenado = 0.85): Encaje {
  const dx = dentro.x1 - dentro.x0, dy = dentro.y1 - dentro.y0, dz = dentro.z1 - dentro.z0;
  const tx = destino.x1 - destino.x0, ty = destino.y1 - destino.y0, tz = destino.z1 - destino.z0;
  // POR LA DIAGONAL, no por el lado mayor. El encuadre del Estudio pone la cámara
  // a ~2.06·r con fov 38° ⇒ el alto visible en el objetivo es ~1.41·r. Ajustar
  // por el lado mayor sólo garantiza el encuadre INICIAL: en la vista isométrica
  // las extensiones en X e Y también caen sobre el vertical de pantalla, y los
  // rótulos son sprites (su alto NO se acorta al girar). Con el lado mayor la
  // tarjeta del agua se salía por arriba; con la diagonal, la composición cabe
  // dentro de la esfera visible A CUALQUIER ÁNGULO DE ÓRBITA.
  const dmax = Math.hypot(dx, dy, dz), tmax = 1.41 * Math.max(tx, ty, tz);
  const k = Number.isFinite(dmax) && dmax > 1e-9 && tmax > 1e-9 ? (llenado * tmax) / dmax : 1;
  const cx = (dentro.x0 + dentro.x1) / 2, cy = (dentro.y0 + dentro.y1) / 2, cz = (dentro.z0 + dentro.z1) / 2;
  const dcx = (destino.x0 + destino.x1) / 2, dcy = (destino.y0 + destino.y1) / 2, dcz = (destino.z0 + destino.z1) / 2;
  return {
    escala: k, centro: [cx, cy, cz], offset: [dcx, dcy, dcz],
    nota: Math.abs(k - 1) < 0.02
      ? 'dibujado a escala 1:1 dentro de la caja de la pieza'
      : `dibujado a escala 1:${fmt(1 / k, 2)} para caber en el encuadre de la pieza — LAS COTAS SON REALES (mm de molde)`,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* El spec del ensamble                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export interface SpecDerivado {
  spec: MoldAssemblySpec;
  /** de dónde salió: el del Estudio, o derivado aquí (se DECLARA, no se finge) */
  origen: 'del Estudio' | 'derivado de la malla';
  nota: string;
}

const esAssemblySpec = (s: any): s is MoldAssemblySpec =>
  !!s && typeof s === 'object' && !!s.plates && !!s.cooling && !!s.cavity && typeof s.widthMm === 'number';

/**
 * Consigue el `MoldAssemblySpec`. Si el Estudio ya trae uno, se USA tal cual
 * (una sola fuente de verdad). Si no, se deriva con la MISMA cadena que el
 * Estudio usa para su capa térmica — copiada de `EstudioVivo.tsx`, no
 * reinventada, para que las dos pantallas describan el MISMO molde.
 */
export function specDeEnsamble(
  spec: any | null, malla: MallaSimple, caja: Caja,
  o?: { nombre?: string; paredMm?: number; plastico?: string; warpageTopology?: any; projectedAreaMm2?: number },
): SpecDerivado {
  if (esAssemblySpec(spec)) return { spec, origen: 'del Estudio', nota: 'el `MoldAssemblySpec` lo trae el Estudio: esta vista NO inventa molde' };
  // un paquete de la Máquina (moldMachine) también sirve
  if (spec && typeof spec === 'object' && (spec as any).diseno && (spec as any).base) {
    try {
      return { spec: packageToAssemblySpec(spec as any), origen: 'del Estudio', nota: 'paquete de la Máquina convertido con `packageToAssemblySpec`' };
    } catch { /* cae al derivado */ }
  }
  const va = volumenArea(malla);
  const entrada = {
    name: o?.nombre ?? 'pieza',
    Lmm: +(caja.x1 - caja.x0).toFixed(1), Wmm: +(caja.y1 - caja.y0).toFixed(1), Hmm: +(caja.z1 - caja.z0).toFixed(1),
    surfaceMm2: Math.round(va.areaMm2), volumeMm3: Math.round(va.volumeMm3),
    wallMm: o?.paredMm && o.paredMm > 0 ? o.paredMm : 2,
    plastic: o?.plastico ?? 'ABS', annualVolume: 500_000,
    projectedAreaMm2: o?.projectedAreaMm2,
    warpageTopology: o?.warpageTopology,
  } as any;
  return {
    spec: packageToAssemblySpec(moldMachine(entrada)),
    origen: 'derivado de la malla',
    nota: 'el Estudio no pasó spec: se derivó con `moldMachine` + `packageToAssemblySpec` (la MISMA cadena de la capa térmica)',
  };
}
