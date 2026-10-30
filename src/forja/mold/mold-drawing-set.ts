/**
 * SET DE PLANOS DEL MOLDE — el ENTREGABLE al cliente (planos individuales).
 * ==============================================================================
 * Genera TODAS las láminas de un molde: ensamble (sección + BOM) + un plano
 * INDIVIDUAL de cada placa mecánica con su tabla de barrenos a cota, más el
 * estudio de la pieza. Cotas LITERALES (no inventar): la pieza sale del libro,
 * las placas del método cap 4 / catálogo estándar, los barrenos en layout
 * simétrico estándar. Salida: láminas SVG A3 → PDF (scripts/mold-pdf-gen.cjs).
 */

import { renderPlateDrawing, type PlateSpec, type PlateHole, type PlateOpening, type CoolingCircuit } from './mold-drawings';
import { moldAssemblyDrawing, renglonISO, TERMINOS_ISO, type MoldAssemblySpec, type ClaveTermino } from './mold-assembly';
// LOS PERNOS Y LOS INTERLOCKS EN LA BOM (orden K): mold-fasteners y mold-interlocks importan este módulo — el ciclo es SOLO
// de funciones (ninguno de los tres llama al otro al cargarse), así que ESM lo resuelve; medido en node (tsx) y en vite.
import { fastenerPlan, engagementLengthMm, plateYieldMPa } from './mold-fasteners';
import { resolveThread } from './mold-threads';
import { resolveHead } from './mold-heads';
import { planInterlocks } from './mold-interlocks';
import { moldMassKg, worstCaseScrewForce, selectMoldScrew } from './fasteners';
import { ventMaxThickness } from './venting';
import { sideActionDesign } from './sideactions';
import { ejectorPinFit, guideGeom, pillarClearanceFit } from './fits';   // holgura pin↔barreno 0.13mm (Kazmer §8.3.2); guía y pilar: las del sólido
import { ejectorHeadGeom } from './eject-layout';   // cabeza + contrataladro (§11.2.6 Fig 11.15 Det. D) — 1 fuente con el sólido
import { coolingDesign, PLASTICOS_A, ACEROS_MOLDE, PISO_MAQUINABLE_MM } from './cooling-design';   // el proceso §9.2 completo
import { estPartVolumeCc } from './feed';
import { ejectorPlateMm, ejectorRetainerMm } from './platesizing';   // las fracciones del paquete expulsor, en UN solo lugar

export interface DrawingPage { name: string; svg: string }
export interface MoldDrawingSet { title: string; code: string; pages: DrawingPage[] }

/** Filas de análisis de ingeniería (valores del libro, con § y veredicto). */
export interface AnalysisRow { grupo: string; param: string; valor: string; ref: string; ok?: boolean }

const esc = (s: string) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

/** Ancho de avance de Arial por carácter, en «em» (tabla de la fuente: dígitos 0.556, espacio 0.278, «i/l» 0.222, «m» 0.833,
 *  mayúsculas ~0.67…). Lo usa la hoja de análisis para PARTIR celdas antes de que se encimen; el juez es el navegador
 *  (getBBox), por eso se estima con 3 % de colchón y la negrita +7 %. */
const ANCHO_ARIAL: Record<string, number> = {
  ' ': 0.278, '.': 0.278, ',': 0.278, ':': 0.278, ';': 0.278, '·': 0.278, '|': 0.26, '/': 0.278, "'": 0.191, '’': 0.222, '"': 0.355,
  '(': 0.333, ')': 0.333, '[': 0.278, ']': 0.278, '-': 0.333, '–': 0.556, '—': 1, '%': 0.889, '×': 0.584, '=': 0.584, '+': 0.584,
  '<': 0.584, '>': 0.584, '≈': 0.584, '≤': 0.584, '≥': 0.584, '±': 0.584, '→': 1, '←': 1, '↔': 1, '✓': 0.8, '⚠': 1, '⌀': 0.7, 'ø': 0.611,
  '½': 0.834, '¼': 0.834, '°': 0.4, '§': 0.556, '«': 0.556, '»': 0.556, '#': 0.556, '&': 0.667, '*': 0.389, '~': 0.584, '△': 0.8,
  i: 0.222, l: 0.222, j: 0.222, í: 0.278, f: 0.278, t: 0.278, r: 0.333, m: 0.833, w: 0.722, k: 0.5, s: 0.5, c: 0.5, z: 0.5, v: 0.5, x: 0.5, y: 0.5,
  I: 0.278, J: 0.5, M: 0.833, W: 0.944, L: 0.556, F: 0.611, T: 0.611, Z: 0.611, E: 0.667, P: 0.667, S: 0.667, K: 0.667, X: 0.667, Y: 0.667, V: 0.667,
};
function anchoTexto(t: string, fs: number, bold: boolean): number {
  let w = 0;
  for (const ch of t) {
    const a = ANCHO_ARIAL[ch];
    w += a != null ? a : /[0-9]/.test(ch) ? 0.556 : /[A-ZÁÉÍÓÚÑÜ]/.test(ch) ? 0.722 : /[a-záéóúñü]/.test(ch) ? 0.556 : 0.7;
  }
  return w * fs * (bold ? 1.07 : 1) * 1.03;
}
/** Parte un texto en renglones de ancho ≤ maxW (mm): primero en « · » (los datos de la hoja vienen separados así), luego en
 *  espacios, y una palabra más ancha que la columna a corte duro. Nunca devuelve un renglón que se salga de su celda. */
function partirTexto(t: string, maxW: number, fs: number, bold: boolean): string[] {
  const s = String(t ?? '');
  if (!s.trim()) return [];
  if (anchoTexto(s, fs, bold) <= maxW) return [s];
  const lineas: string[] = []; let cur = '';
  const cierra = () => { if (cur.trim()) lineas.push(cur.trim()); cur = ''; };
  const pon = (pz: string) => { if (cur && anchoTexto(cur + pz, fs, bold) > maxW) cierra(); cur += pz; };
  for (const pieza of s.split(/(?<= · )/)) {
    if (anchoTexto(pieza, fs, bold) <= maxW) { pon(pieza); continue; }
    for (const palabra of pieza.split(/(?<= )/)) {
      if (anchoTexto(palabra, fs, bold) <= maxW) { pon(palabra); continue; }
      cierra();
      let acc = '';
      for (const ch of palabra) { if (acc && anchoTexto(acc + ch, fs, bold) > maxW) { lineas.push(acc); acc = ''; } acc += ch; }
      cur = acc;
    }
  }
  cierra();
  return lineas;
}

/** LÁMINA DE ANÁLISIS — la ingeniería del molde en una hoja (A3), agrupada por
 *  subsistema con su referencia al libro y veredicto. */
function analysisSheet(spec: MoldAssemblySpec, rows: AnalysisRow[]): string {
  const PW = 420, PH = 297, M = 10;
  const p: string[] = [];
  p.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${PW}mm" height="${PH}mm" viewBox="0 0 ${PW} ${PH}" font-family="Arial, sans-serif">`);
  p.push(`<rect width="${PW}" height="${PH}" fill="#fff"/><rect x="${M / 2}" y="${M / 2}" width="${PW - M}" height="${PH - M}" fill="none" stroke="#111" stroke-width="0.7"/>`);
  p.push(`<text x="${M + 4}" y="${M + 8}" font-size="5.5" font-weight="bold">HOJA DE ANÁLISIS DE INGENIERÍA</text>`);
  p.push(`<text x="${M + 4}" y="${M + 15}" font-size="3.2" fill="#555">${esc(spec.name)} · el molde como sistema de ecuaciones resuelto (Kazmer)</text>`);
  // LA HOJA SE LEE (orden J, 2026-10-29). Antes: 4 columnas de ancho fijo (46·92·60·40 = 238 mm de los 397 que tiene la A3)
  // y cada celda en UNA línea: el valor largo de la máquina («FCS HT-150SV (taller) · clamp … · abierto 447 de 1010 mm ✓») se
  // montaba sobre la columna REF/§ y la tabla de eyectores se salía por la derecha de la hoja (revisor Fable, G2; orden B).
  // Ahora la tabla ocupa el ancho útil y cada celda se PARTE en renglones (en « · » primero, luego en espacios) con el ancho
  // de Arial estimado por carácter; el renglón crece lo que pida su celda más alta. Si la tabla no cabe en la altura, el
  // interlineado baja hasta 3.3 mm (texto de 2.6–2.9 mm sigue legible) — nunca se monta un texto sobre otro.
  const x0 = M + 4, head = ['SUBSISTEMA', 'PARÁMETRO', 'VALOR', 'REF/§'];
  const tW = PW - M / 2 - 4 - x0;                              // 397: de x0 (14) al marco derecho (415) con 4 mm de aire
  const cols = [38, 104, tW - 38 - 104 - 46, 46];
  const fs = [2.9, 2.8, 2.8, 2.6], bold = [true, false, true, false];
  const cx = (i: number) => x0 + cols.slice(0, i).reduce((a, b) => a + b, 0);
  const celdas = rows.map((r, k) => [k === 0 || r.grupo !== rows[k - 1].grupo ? r.grupo : '', r.param,
    `${r.valor}${r.ok != null ? (r.ok ? '  ✓' : '  ⚠') : ''}`, r.ref].map((t, i) => partirTexto(t, cols[i] - 3, fs[i], bold[i])));
  const yTop = M + 24, yMax = PH - M - 9;                      // la leyenda del pie vive en PH − M − 4
  const headH = 6.4, pad = 2.1;
  let lineH = 3.6;
  const altoDe = (L: number) => headH + celdas.reduce((a, c) => a + Math.max(1, ...c.map((x) => x.length)) * L + pad, 0);
  while (altoDe(lineH) > yMax - yTop && lineH > 3.3) lineH = +(lineH - 0.1).toFixed(2);
  let y = yTop;
  p.push(`<rect x="${x0}" y="${y}" width="${tW}" height="${headH}" fill="#eef2f7" stroke="#111" stroke-width="0.3"/>`);
  head.forEach((h, i) => p.push(`<text x="${cx(i) + 1.5}" y="${y + 4.3}" font-size="3" font-weight="bold">${esc(h)}</text>`));
  y += headH;
  const color = ['#1a5fb4', '#111', '#111', '#666'];
  rows.forEach((r, k) => {
    const c = celdas[k], h = Math.max(1, ...c.map((x) => x.length)) * lineH + pad;
    p.push(`<rect x="${x0}" y="${y}" width="${tW}" height="${h.toFixed(2)}" fill="${r.ok === false ? '#fdecec' : 'none'}" stroke="#bbb" stroke-width="0.2"/>`);
    c.forEach((lineas, i) => lineas.forEach((t, j) => p.push(`<text x="${cx(i) + 1.5}" y="${(y + pad / 2 + lineH * (j + 0.78)).toFixed(2)}" font-size="${fs[i]}"${bold[i] ? ' font-weight="bold"' : ''}${color[i] !== '#111' ? ` fill="${color[i]}"` : ''}>${esc(t)}</text>`)));
    y += h;
  });
  p.push(`<text x="${x0}" y="${PH - M - 4}" font-size="2.6" fill="#888">Análisis reproducido del libro Kazmer «Injection Mold Design Engineering» · valores verificados contra los ejemplos resueltos · La Forja · GAIA</text>`);
  p.push(`</svg>`);
  return p.join('');
}

export type PlateRole = 'clamp' | 'A' | 'B' | 'support' | 'ejector' | 'ejector-ret' | 'bottom';
export interface PlateDef { role: PlateRole; code: string; name: string; thick: number; mat: string }

/** Las placas del molde (rol, código, espesor del spec, material). Fuente única:
 *  la usan tanto el plano plano (renderPlateDrawing) como el sólido del kernel. */
export function plateDefs(s: MoldAssemblySpec): PlateDef[] {
  return [
    { role: 'clamp', code: `${s.code ?? 'MLD'}-01`, name: 'Placa de sujeción superior', thick: s.plates.topClamp, mat: s.baseSteel ?? '1.1730' },
    { role: 'A', code: `${s.code ?? 'MLD'}-02`, name: 'Placa A (cavidad)', thick: s.plates.A, mat: s.cavityMetal },
    // STRIPPER (§11.3.4 Fig 11.19): "the stripper plate REPLACES the B plate and floats
    // between the A plate and the support plate" — mismo rol/zona del stack, otra función.
    { role: 'B', code: `${s.code ?? 'MLD'}-03`, name: s.ejectors.type === 'stripper' ? 'Placa STRIPPER (expulsa el anillo, flota)' : 'Placa B (núcleo)', thick: s.plates.B, mat: s.cavityMetal },
    { role: 'support', code: `${s.code ?? 'MLD'}-04`, name: 'Placa de soporte', thick: s.plates.support, mat: s.baseSteel ?? '1.1730' },
    // las fracciones del paquete expulsor las manda `platesizing` (una sola copia): la caja
    // ahora se DIMENSIONA con ellas (§4.3.2), y seis copias tecleadas = cinco que pueden mentir.
    { role: 'ejector-ret', code: `${s.code ?? 'MLD'}-05a`, name: 'Placa retenedora (cabezas)', thick: ejectorRetainerMm(s.plates.ejectorHousing), mat: s.baseSteel ?? '1.1730' },
    { role: 'ejector', code: `${s.code ?? 'MLD'}-05b`, name: 'Placa expulsora', thick: ejectorPlateMm(s.plates.ejectorHousing), mat: s.baseSteel ?? '1.1730' },
    { role: 'bottom', code: `${s.code ?? 'MLD'}-06`, name: 'Placa de sujeción inferior', thick: s.plates.bottomClamp, mat: s.baseSteel ?? '1.1730' },
  ];
}

/** Ancho del fondo de la placa (≈0.78·ancho, 4:3 típico de mold base). */
/** FONDO (Y) de las placas. Si el spec trae el `depthMm` REAL de la base estándar
 *  (§4.3: las bases son rectangulares, p.ej. 296×396) se usa ÉSE. El 0.78 es solo el
 *  respaldo para specs escritos a mano — no una regla del libro. */
export const plateDepth = (s: MoldAssemblySpec) => Math.round(s.depthMm ?? s.widthMm * 0.78);

/** Huella de la cavidad en planta: X e Y (⌀ para redonda). */
import { sizeInserts, guiaNominalMm } from './moldbase';
import { sprueDesignFromCavity } from './feed';

export function cavityFootprint(s: MoldAssemblySpec): { fx: number; fy: number; round: boolean } {
  const cav = s.cavity, round = cav.shape === 'round';
  return { fx: cav.widthMm, fy: round ? cav.widthMm : (cav.lenMm ?? Math.round(cav.widthMm * 0.67)), round };
}

/** REJILLA de cavidades: nCav impresiones en grid nx×ny, centradas en la placa,
 *  con paso = huella + separación. Devuelve el centro de cada cavidad. */
/** ROMPER EL CICLO (2026-07-16): `insertDims` vivía en `mold-plano-set.ts`, pero
 *  `mold-interlocks.ts` la necesita — y plano-set importa `planInterlocks` de interlocks.
 *  Ese ida-y-vuelta (plano-set → interlocks → plano-set) era una BOMBA LATENTE: el bundle
 *  reventaba con "Cannot access 'kn' before initialization" (TDZ) en cuanto un import
 *  nuevo cambiaba el orden de evaluación de los módulos. No se vio antes porque el orden
 *  viejo, por suerte, evaluaba primero al que tocaba.
 *  Aquí es su LUGAR: `insertDims` es geometría de REFERENCIA (como `cavityFootprint`, que
 *  ya vive aquí y de la que depende), no construcción de mallas. Y drawing-set no importa
 *  a plano-set ⇒ el ciclo desaparece en vez de esconderse. */
/** Dimensiones de los INSERTOS de molde (cavidad hembra / núcleo macho) derivadas de
 *  la HUELLA de la pieza. El inserto = bloque de acero con la impresión, que se asienta
 *  en su placa (A=cavidad, B=núcleo). La pared sale de la pieza (o se estima ~20% de la
 *  profundidad). border = orilla de acero alrededor de la impresión. */
export function insertDims(spec: MoldAssemblySpec) {
  const { fx, fy, round } = cavityFootprint(spec);
  const dep = spec.cavity.depthMm;
  // pared REAL de la pieza (T del libro) si viene en el spec; si no, ~20% de la prof.
  const wall = spec.cavity.wallMm ?? Math.max(1.2, Math.round(dep * 0.2 * 10) / 10);
  // ORILLA DEL INSERTO — UNA SOLA FUENTE DE VERDAD: `sizeInserts` de moldbase.ts, que
  // YA implementa §4.2.2 LITERAL (cheek = max(3·⌀_agua, profundidad); el libro verifica
  // los dos casos: bezel → gana enfriamiento, vaso → gana estructural).
  //
  // AQUÍ ESTABA EL BUG (2026-07-15, cazado con las COTAS 3D): este archivo DUPLICABA el
  // cálculo con `max(30, fx*0.19)` — una proporción INVENTADA, calibrada al revés para
  // dar ~45 en el bezel (2.4× los 19.05 del libro). O sea: `selectMoldBase` dimensionaba
  // la base con la fórmula BUENA (reservando el anillo de componentes con la holgura de
  // §4.3.2) mientras la GEOMETRÍA construía el inserto con la fórmula MALA, más grande →
  // no cabía en la reserva y 12/12 barrenos rompían el asiento. Dos caminos calculando
  // lo mismo distinto: el mismo patrón del estudio-vs-geometría de la tornillería.
  // Duplicar una regla del libro es peor que no tenerla: una de las dos copias miente.
  let border = sizeInserts({ Lmm: fx, Wmm: fy, depthMm: dep }).cheekMm;
  // …PERO acotada al PASO entre cavidades: en multi-cavidad los bloques vecinos NO
  // deben traslaparse (el bug de las "cajas cruzadas" que cachó el user).
  if ((spec.nCav ?? 1) > 1) {
    const pitchX = fx + Math.max(18, Math.round(fx * 0.35));
    const pitchY = fy + Math.max(18, Math.round(fy * 0.35));
    border = Math.max(6, Math.min(border, Math.floor((pitchX - fx) / 2) - 1, Math.floor((pitchY - fy) / 2) - 1));
  }
  const ifx = fx + 2 * border, ify = fy + 2 * border;
  const Hc = Math.min((spec.plates.A ?? 40) - 6, dep + 22);   // alto del inserto de cavidad (cabe en A)
  const Hk = Math.min((spec.plates.B ?? 40) - 6, dep + 26);   // alto del inserto de núcleo (cabe en B)
  return { fx, fy, dep, wall, border, ifx, ify, Hc, Hk, round };
}

// ── LA PLACA EXPULSORA y LOS RETURN PINS: UNA sola fuente (orden los-insertos-se-barrenan) ──
//  Estas dos cotas vivían en mold-plano-set.ts; los return pins y sus tres juegos de barrenos
//  las repetían a mano como `65 + 26` / `20 + 26`. Aquí, junto a `insertDims`/`cavityGrid`, es su
//  lugar: geometría de REFERENCIA que el componente Y sus barrenos leen del MISMO cálculo
//  (plano-set las re-exporta, así nadie importa al revés y el ciclo de módulos no aparece).
export const EXPULSORA_MARGEN_X_MM = 65;       // la expulsora vive ENTRE los rieles (Fig 1.4/1.5): 65 por lado en X
export const EXPULSORA_MARGEN_Y_MM = 20;       // y 20 por lado en Y
/** ⌀ del return pin (Fig 1.6) — el mismo para el vástago, la cabeza y todos sus barrenos. */
export const RETURN_PIN_DIA_MM = 12;
/** inset NOMINAL desde la esquina de la placa expulsora — el de siempre, cuando el inserto lo deja. */
export const RETURN_PIN_INSET_MM = 26;

export interface ReturnPinLayout {
  diaMm: number; rMm: number;
  /** las 4 posiciones (x,y) en coordenadas de la base */
  pts: Array<[number, number]>;
  insetXmm: number; insetYmm: number;
  /** claro MEDIDO de la superficie del pin al canto del inserto de núcleo (negativo = lo pisa) */
  claroAlInsertoMm: number;
  /** ¿quedó fuera del inserto con el claro que pide la regla? */
  libre: boolean;
  notas: string[];
}
/**
 * DÓNDE VAN LOS RETURN PINS — mirando el INSERTO, no solo la placa expulsora.
 * ---------------------------------------------------------------------------
 * MEDIDO (plan de inspección 2026-09-21, punto 2.4): con el inset fijo de 26 mm los 4 pines
 * de retorno CRUZABAN el inserto de núcleo — 15,000 mm³ · 5.3 mm en la carcasa 1594C Box y
 * 3,328 mm³ · 2.71 mm en la tapa. Un return pin atraviesa el paquete expulsor, el soporte y
 * la placa B para topar en la cara de A (Fig 1.6): jamás puede vivir DENTRO del inserto que
 * forma la pieza. Reglas de Hefestos (declaradas — el libro no da estas dos cotas):
 *   · ≥ 1·⌀ de la superficie del pin al canto del inserto (12 mm con ⌀12)
 *   · ≥ 1.5·⌀ del centro del pin al canto de la placa expulsora (18 mm) — queda acero para la cabeza
 * Se mueve por el eje que cueste menos y SOLO lo necesario; si ningún eje da el claro, se
 * DECLARA (`libre: false` + `notas`) y quien llame avisa: no se encima en silencio.
 */
/** El rectángulo que ocupan los insertos de núcleo (todas las cavidades) en la base. */
function insertoEnLaBase(s: MoldAssemblySpec, Dd: number) {
  const id = insertDims(s), cells = cavityGrid(s, Dd);
  return {
    id,
    x0: Math.min(...cells.map((c) => c.cx)) - id.ifx / 2, x1: Math.max(...cells.map((c) => c.cx)) + id.ifx / 2,
    y0: Math.min(...cells.map((c) => c.cy)) - id.ify / 2, y1: Math.max(...cells.map((c) => c.cy)) + id.ify / 2,
  };
}

/** Margen MÍNIMO de la placa expulsora al canto de la base en Y: 0 = a paño con la pila (el housing
 *  en U está ABIERTO por esos dos costados, Fig 1.4 — no hay riel contra el que chocar). Nunca sale
 *  de la pila. Regla de Hefestos: el libro no da el número; la razón es que la placa no sobresalga. */
export const EXPULSORA_MARGEN_Y_MIN_MM = 0;

export interface MargenesDeLaExpulsora {
  /** margen por lado, del canto de la base al canto de la placa expulsora (mm) */
  mxMm: number; myMm: number;
  /** cuánto CRECIÓ la placa en Y (total, los dos lados) respecto al nominal */
  crecioYmm: number;
  notas: string[];
}
/**
 * LA PLACA EXPULSORA CRECE PARA QUE QUEPAN LOS RETORNOS — decisión de ian (2026-09-22, pregunta 6
 * del ACTA R93: «sí» a «crece la expulsora»).
 * -------------------------------------------------------------------------------------------------
 * MEDIDO (orden LOS INSERTOS SE BARRENAN, punto 2.4 del inspector): en la carcasa 1594C Box y la tapa
 * 1594C Lid el return pin ⌀12 no cabe entre el canto de la expulsora y el del inserto — banda 16.5 y
 * 26 mm en Y, un ⌀12 pide 36 (1.5·⌀ a la expulsora + r + 1·⌀ al inserto). Se quedaban CRUZANDO el
 * inserto de núcleo (15,000 mm³ · 5.3 mm y 3,328 mm³ · 2.71 mm).
 * EN X NO SE PUEDE CRECER: la expulsora corre ENTRE los rieles del housing (Fig 1.4; 65 mm por lado
 * con rieles de 50) y el inserto ya es más ancho que la placa (banda −8 / −14.5 mm). EN Y SÍ: el
 * housing en U está abierto por esos costados. Así que el margen en Y baja SOLO lo necesario para
 * que el retorno libre el inserto con su claro; en la base donde ya cabía (1599HBK) nada cambia.
 * Si ni a paño con la pila cabe, el margen se queda en el mínimo y `returnPinLayout` lo DICE.
 */
export function expulsoraMargenes(s: MoldAssemblySpec, D?: number): MargenesDeLaExpulsora {
  const Dd = D ?? plateDepth(s);
  const mx = EXPULSORA_MARGEN_X_MM, my0 = EXPULSORA_MARGEN_Y_MM;
  const d = RETURN_PIN_DIA_MM, r = d / 2;
  const pide = 1.5 * d + r + d;               // centro a la expulsora (1.5·⌀) + r + claro al inserto (1·⌀) = 3·⌀
  const ins = insertoEnLaBase(s, Dd);
  // ¿ya cabe con los márgenes nominales? (mismo criterio que `returnPinLayout`: por X o por Y)
  const cEje = r + d, minInset = 1.5 * d;
  const clearX = Math.min(ins.x0 - cEje - mx, (s.widthMm - mx) - (ins.x1 + cEje));
  const clearY = Math.min(ins.y0 - cEje - my0, (Dd - my0) - (ins.y1 + cEje));
  const notas: string[] = [];
  if (clearX >= minInset || clearY >= minInset) return { mxMm: mx, myMm: my0, crecioYmm: 0, notas };
  // la banda de los DOS lados en Y manda el peor; margen = banda − lo que pide el pin, a mm entero hacia abajo
  const bandaY = Math.min(ins.y0, Dd - ins.y1);
  const myNecesario = Math.floor(bandaY - pide);
  const my = Math.max(EXPULSORA_MARGEN_Y_MIN_MM, Math.min(my0, myNecesario));
  if (my < my0)
    notas.push(`la placa expulsora CRECE en Y para que los retornos ⌀${d} libren el inserto ${ins.id.ifx}×${ins.id.ify}: margen ${my0} → ${my} mm por lado (placa ${s.widthMm - 2 * mx}×${Dd - 2 * my0} → ${s.widthMm - 2 * mx}×${Dd - 2 * my} mm) — decisión de ian 2026-09-22`);
  if (myNecesario < EXPULSORA_MARGEN_Y_MIN_MM)
    notas.push(`⚠ ni a paño con la pila cabe: la banda del canto de la base al inserto mide ${bandaY.toFixed(1)} mm en Y y un ⌀${d} pide ${pide} mm`);
  return { mxMm: mx, myMm: my, crecioYmm: 2 * (my0 - my), notas };
}

export function returnPinLayout(s: MoldAssemblySpec, D?: number): ReturnPinLayout {
  const W = s.widthMm, Dd = D ?? plateDepth(s);
  // los márgenes de la expulsora YA crecidos si hacía falta (`expulsoraMargenes`): la placa, sus
  // barrenos y los retornos leen el MISMO número.
  const marg = expulsoraMargenes(s, Dd);
  const mx = marg.mxMm, my = marg.myMm;
  const d = RETURN_PIN_DIA_MM, r = d / 2;
  const claroInserto = d;                     // ≥ 1·⌀ de acero entre el pin y el inserto
  const minInset = 1.5 * d;                   // ≥ 1.5·⌀ del centro al canto de la expulsora
  const cEje = r + claroInserto;              // del CENTRO del pin al canto del inserto
  const ins = insertoEnLaBase(s, Dd), id = ins.id;
  const insX0 = ins.x0, insX1 = ins.x1, insY0 = ins.y0, insY1 = ins.y1;
  // inset MÁXIMO por eje que deja el pin fuera del inserto (los dos lados; manda el peor)
  const clearX = Math.min(insX0 - cEje - mx, (W - mx) - (insX1 + cEje));
  const clearY = Math.min(insY0 - cEje - my, (Dd - my) - (insY1 + cEje));
  const notas: string[] = [...marg.notas];
  let ix = RETURN_PIN_INSET_MM, iy = RETURN_PIN_INSET_MM;
  const fueraNominal = RETURN_PIN_INSET_MM <= clearX || RETURN_PIN_INSET_MM <= clearY;
  let libre = true;
  if (!fueraNominal) {
    if (clearX >= minInset) { ix = Math.min(RETURN_PIN_INSET_MM, clearX); notas.push(`retornos movidos en X: inset ${RETURN_PIN_INSET_MM} → ${ix.toFixed(1)} mm (el inserto ${id.ifx}×${id.ify} llegaba hasta x ${insX0.toFixed(0)})`); }
    else if (clearY >= minInset) { iy = Math.min(RETURN_PIN_INSET_MM, clearY); notas.push(`retornos movidos en Y: inset ${RETURN_PIN_INSET_MM} → ${iy.toFixed(1)} mm (el inserto ${id.ifx}×${id.ify} llegaba hasta y ${insY0.toFixed(0)})`); }
    else {
      libre = false;
      // LA BANDA que de verdad hay: del canto de la expulsora al canto del inserto, por eje. Un pin
      // ⌀d pide ahí minInset + r + claroInserto = 3·d. Se dice el número y el ⌀ que SÍ cabría, para
      // que la decisión (crecer la expulsora · achicar la orilla §4.2.2 · bajar el ⌀) sea de quien manda.
      const bandaX = insX0 - mx, bandaY = insY0 - my;
      const banda = Math.max(bandaX, bandaY);
      notas.push(`⚠ NO CABE un return pin ⌀${d} fuera del inserto ${id.ifx}×${id.ify}: la banda libre entre el canto de la expulsora y el canto del inserto mide ${bandaX.toFixed(1)} mm en X y ${bandaY.toFixed(1)} en Y, y un ⌀${d} pide ${(3 * d).toFixed(0)} (1.5·⌀ a la expulsora + r + 1·⌀ al inserto). Con esta banda cabría hasta ⌀${Math.max(0, banda / 3).toFixed(1)}. Se quedan en el inset nominal ${RETURN_PIN_INSET_MM} mm y CRUZAN el inserto${marg.crecioYmm > 0 ? ` (aun con la expulsora crecida ${marg.crecioYmm} mm en Y)` : ''}: base más grande, achicar la orilla del inserto (§4.2.2) o bajar el ⌀.`);
    }
  }
  const px0 = mx + ix, px1 = W - mx - ix, py0 = my + iy, py1 = Dd - my - iy;
  const pts: Array<[number, number]> = [[px0, py0], [px1, py0], [px0, py1], [px1, py1]];
  // claro MEDIDO (no supuesto): distancia del punto al rectángulo del inserto, menos el radio
  const claro = Math.min(...pts.map(([x, y]) => {
    const dx = Math.max(insX0 - x, 0, x - insX1), dy = Math.max(insY0 - y, 0, y - insY1);
    return Math.hypot(dx, dy) - r;
  }));
  return { diaMm: d, rMm: r, pts, insetXmm: +ix.toFixed(2), insetYmm: +iy.toFixed(2), claroAlInsertoMm: +claro.toFixed(2), libre: libre && claro >= claroInserto - 0.01, notas };
}

export function cavityGrid(s: MoldAssemblySpec, D: number): Array<{ cx: number; cy: number }> {
  const n = Math.max(1, s.nCav ?? 1);
  const nx = Math.max(1, Math.round(Math.sqrt(n))), ny = Math.ceil(n / nx);
  const { fx, fy } = cavityFootprint(s);
  const pitchX = fx + Math.max(18, Math.round(fx * 0.35)), pitchY = fy + Math.max(18, Math.round(fy * 0.35));
  const x0 = s.widthMm / 2 - ((nx - 1) * pitchX) / 2, y0 = D / 2 - ((ny - 1) * pitchY) / 2;
  const out: Array<{ cx: number; cy: number }> = [];
  let k = 0;
  for (let r = 0; r < ny && k < n; r++) for (let c = 0; c < nx && k < n; c++, k++)
    out.push({ cx: Math.round(x0 + c * pitchX), cy: Math.round(y0 + r * pitchY) });
  return out;
}

/**
 * LOS APAGONES (2026-10-24) — LAS DOS BÚSQUEDAS DE MATERIAL QUE CAÍAN EN SILENCIO.
 *  · ACERO: la clave viene de `MOLD_METALS` (moldbase.ts: 'P20', 'H13', 'Al QC-7', 'SS420', 'D2'…) y la tabla térmica
 *    `ACEROS_MOLDE` (cooling-design.ts) escribe el aluminio sin prefijo ('QC-7'). Con volumen < 5,000 la Máquina cotiza
 *    aluminio (`selectMetal` → prototipo → 'Al QC-7') y esta hoja calculaba el agua con P20 (k 32 contra 160) sin decirlo.
 *    Ahora se encuentra el QC-7 (y «AISI P20» = P20, la clave de los specs armados a mano), y una clave que NO tiene datos
 *    (SS420, D2, Cu 940, A6, S7, 1045, 4140, Al 7075-T6 hoy) REVIENTA con «material sin datos»
 *    en vez de caer a P20: el agua de un inoxidable no se diseña con la conductividad de otro acero.
 *  · PLÁSTICO: caía a 'PP' cuando el spec no traía resina; la resina del molde es la del intake y su default es ABS
 *    (`intake.material ?? 'ABS'`, useMoldStudio). Una resina fuera de `PLASTICOS_A` también revienta.
 */
export function aceroTermico(clave: string | undefined): { kWmC: number; sigmaEnduranceMPa: number } {
  const k = clave ?? 'P20';
  // el mismo acero con su prefijo de norma o de familia: «AISI P20» (los 21 specs a mano del repo) es P20; «Al QC-7» es QC-7
  const a = ACEROS_MOLDE[k] ?? ACEROS_MOLDE[k.replace(/^(AISI|Al)\s+/, '')];
  if (!a) throw new Error(`material sin datos: el acero «${k}» no tiene k ni límite de fatiga en ACEROS_MOLDE (§9.2.5) — no se cae a P20`);
  return a;
}
export function plasticoTermico(clave: string | undefined): (typeof PLASTICOS_A)[string] {
  const k = (clave ?? 'ABS').toUpperCase();
  const m = PLASTICOS_A[k];
  if (!m) throw new Error(`material sin datos: la resina «${k}» no está en PLASTICOS_A (Apéndice A) — no se cae a otra`);
  return m;
}

/**
 * ══ LA FUENTE ÚNICA DEL CIRCUITO DE AGUA (orden 2026-09-10 EL AGUA DICE DOS COSAS) ══
 * EL PROCESO §9.2 APLICADO AL MOLDE REAL — traduce el spec del ensamble a la
 * entrada de `coolingDesign` y devuelve, además del diseño, la BANDA en Y que
 * las líneas tienen que cubrir (la huella COMPLETA de la rejilla, no la de una
 * cavidad). El trazo, el plano, el reporte **y el 3D de la estación 8** leen esto.
 *
 * ANTES había DOS: la lámina FORZABA el ⌀ del porta-molde (`forceDiaMm: s.cooling.diaMm`)
 * y el 3D (`estacion8Dado`) dejaba que el caudal eligiera, con su propio t_c. El MISMO
 * molde salía con dos circuitos (carcasa 1594C: lámina ⌀9.53·H32·W64·t_c 21.7 s vs 3D
 * ⌀4.76·H19·W38.1·t_c 75.7 s). Un cliente que compare su plano con la vista 3D ve dos moldes.
 *
 * LAS DOS DECISIONES QUE LO CIERRAN (ian 2026-09-21):
 *  1) **manda el CAUDAL con piso maquinable** — §9.2.5 elige D por el caudal y DESPUÉS
 *     verifica que quepa; el piso 6.35 es del taller (ver `PISO_MAQUINABLE_MM`). Ya no se
 *     fuerza ningún ⌀: `s.cooling.diaMm` pasa a ser el ⌀ que ESTE motor eligió (lo escribe
 *     `packageToAssemblySpec`), no una entrada que compita con él.
 *  2) **el t_c es el de §9.2.1: el MÁXIMO sobre todas las secciones** — "the cycle time can
 *     be dominated by the cooling of the cold runners". La colada es parte del disparo
 *     (Eq 9.10 ya suma su volumen), así que su t_c también cuenta. El spec lo trae en
 *     `cooling.tcS`; si no viene, se cae a Eq 9.5 sobre la pared (lo de antes).
 */
export function coolingCircuitDesign(s: MoldAssemblySpec, D: number, o?: {
  /** CONTROL NEGATIVO del gate (lo usa `estacion8Dado`): sacar H/W de las reglas a propósito */
  hOverD?: number; wOverH?: number;
}) {
  const cells = cavityGrid(s, D), { fy } = cavityFootprint(s);
  const ys = cells.map((c) => c.cy);
  const bandY0 = Math.min(...ys) - fy / 2, bandY1 = Math.max(...ys) + fy / 2;
  const mat = plasticoTermico(s.plastic);
  const acero = aceroTermico(s.cavityMetal);
  // largo de línea DISPONIBLE = ancho de placa menos los cantos (el recorte fino
  // por barrenos se hace después, línea por línea)
  const edge = Math.max(16, Math.round(s.widthMm * 0.05));
  const cd = coolingDesign({
    // volumen REAL si el sólido lo trae; si no, el estimador de cascarón
    nCav: cells.length, partVolCc: s.cavity.volMm3 ? s.cavity.volMm3 / 1000 : estPartVolumeCc(s.cavity),
    runnerVolCc: s.cooling.runnerVolCc,
    thickestMm: s.cavity.wallMm ?? 2,
    rhoRTKgM3: mat.rhoRTKgM3, cpJkgC: mat.cpJkgC, alphaM2s: mat.alphaM2s,
    tMeltC: mat.tMeltC, tEjectC: mat.tEjectC, tCoolantC: mat.tCoolC,
    kMoldWmC: acero.kWmC, sigmaEnduranceMPa: acero.sigmaEnduranceMPa,
    bandMm: bandY1 - bandY0, lineLenMm: s.widthMm - 2 * edge,
    linesInSeries: 2, sides: 2,
    tcS: s.cooling.tcS,                       // §9.2.1: el máximo sobre TODAS las secciones
    pisoDiaMm: PISO_MAQUINABLE_MM,            // el caudal manda, con piso de taller
    hOverD: o?.hOverD, wOverH: o?.wOverH,
  });
  return { ...cd, bandY0, bandY1 };
}

/** CIRCUITO de enfriamiento en SERPENTÍN, AUTOMATIZADO desde la rejilla de
 *  cavidades: N canales rectos barrenados a lo ancho, cubriendo la banda de las
 *  impresiones, conectados en extremos alternos (cross-drill) y sellados con plugs;
 *  puertos IN/OUT en un extremo. Base para el diseño generativo de refrigeración. */
export function coolingCircuit(s: MoldAssemblySpec, D: number): CoolingCircuit {
  const edge = Math.max(16, Math.round(s.widthMm * 0.05));
  // ══ EL TRAZO SALE DEL PROCESO §9.2, NO DE UNA REGLA SUELTA ══════════════
  // Antes: H = 4·D y W = 1.75·H, a secas. El 4·D es la regla ESTRUCTURAL
  // (Eq 9.22); a ⌀9.53 en P20 da 38 mm y VIOLA Eq 9.21 (H < k/1000 = 32 mm):
  // la línea queda tan honda que ella misma alarga el ciclo. Ahora se llama a
  // `coolingDesign`, que resuelve la cadena completa (t_c → Q̇ → V̇ → D → H →
  // W → n_lines) con el lazo cerrado y RECORTA H con la térmica.
  const cd = coolingCircuitDesign(s, D);
  // EL ⌀ LO ELIGE EL MOTOR, no el spec: antes esta línea decía `s.cooling.diaMm` y el motor
  // recibía ese mismo número como `forceDiaMm` — un lazo cerrado sobre sí mismo que hacía
  // ver «una fuente» lo que en realidad era el ⌀ del porta-molde imponiéndose al caudal.
  const dia = cd.diaMm;
  const H = Math.round(cd.hLineMm);
  const pitch = Math.round(cd.wLineMm);
  // BANDA A CUBRIR = la huella COMPLETA de la rejilla de cavidades, no la de UNA.
  // Con la huella de una sola cavidad el molde de 4 flaneras (cavidades de y=29 a
  // y=217) recibía una banda de 49..197 → el esquive la dejaba en UNA línea de
  // 124 mm para 4.6 kW. El calor vive donde están TODAS las impresiones.
  const yEdge = Math.max(14, Math.round(D * 0.08));
  const cyMid = D / 2;
  // el `guard` de las esquinas YA NO recorta la banda: los pilares son
  // obstáculos PUNTUALES y se esquivan uno por uno (abajo). Recortarlo global
  // dejaba 124×124 útiles en una placa de 246×246 → 1 línea para 4 cavidades.
  const yLo = Math.max(yEdge, Math.round(cd.bandY0));
  const yHi = Math.min(D - yEdge, Math.round(cd.bandY1));
  const span = yHi - yLo;
  // ── ESQUIVAR BARRENOS (feedback user: "el agua sigue chocando") ──
  // obstáculos = expulsores + pilares + KO + tornillos de las placas A/B; si un canal
  // pasa a menos de (r_canal + r_barreno + 3 mm) de un barreno dentro de su tramo X,
  // el canal se CORRE en Y al primer hueco libre.
  const obstacles: Array<{ x: number; y: number; r: number }> = [];
  for (const role of ['A', 'B'] as const)
    for (const h of standardHoles(s, role)) obstacles.push({ x: h.x, y: h.y, r: h.dia / 2 });
  const rLine = dia / 2;
  // §9.2.7 LITERAL: "at least HALF A COOLING DIAMETER between the surface of the
  // cooling line and the surface of any other mold component". Antes eran 3 mm
  // fijos: con ⌀15.9 el libro pide 7.95, o sea que el ruteador esquivaba con menos
  // de la mitad de la holgura exigida y el auditor lo cazaba después.
  const CLR = dia / 2;
  const xMin = edge, xMax = s.widthMm - edge, xMid = (xMin + xMax) / 2;
  /**
   * TRAMO LIBRE EN X A UNA ALTURA Y — el cambio de fondo. Antes se recortaba
   * TODA línea por el guard de las esquinas (donde viven los pilares guía), lo
   * que reducía la placa útil a 124×124 mm de 246×246. Los pilares son cuatro
   * puntos: una línea a media altura ni los roza. Aquí cada línea se estira
   * hasta el canto y sólo la recortan los barrenos que estorban A SU Y; si uno
   * cae en MEDIO (partiría el canal en dos), se devuelve null y la línea se
   * mueve en Y — que es lo que el esquive ya sabía hacer.
   */
  const xSpanAt = (y: number): { a: number; b: number } | null => {
    let a = xMin, b = xMax;
    for (const o of obstacles) {
      if (Math.abs(y - o.y) >= rLine + o.r + CLR) continue;         // no estorba a esta altura
      const lo = o.x - o.r - rLine - CLR, hi = o.x + o.r + rLine + CLR;
      if (hi <= xMid) a = Math.max(a, hi);                          // estorbo por la izquierda → arranca después
      else if (lo >= xMid) b = Math.min(b, lo);                     // por la derecha → termina antes
      else return null;                                             // en medio → partiría el canal
    }
    // REDONDEO DIRECCIONAL (la doctrina steel-safe del libro, §6.5.5/§4.2.1
    // aplicada al ruteo): el canal SE ENCOGE al redondear — arranque hacia
    // ARRIBA, final hacia ABAJO — nunca crece hacia el obstáculo. Con
    // `Math.round` en los dos extremos el canal podía comerse hasta 0.5 mm de
    // la holgura §9.2.7 y reprobar por centésimas: RPi4 medía 4.73 contra
    // 4.76 exigido, un déficit de 0.03 mm puramente de redondeo.
    return b - a >= 40 ? { a: Math.ceil(a), b: Math.floor(b) } : null;
  };
  // OFFSETS DEL ESQUIVE, proporcionales al paso (antes fijos a ±14 mm: con
  // líneas de ⌀15.9 y pilares de ⌀32 no alcanzaban y el canal se CAÍA, dejando
  // huecos de 112 y 160 mm — arriba del techo 2H de Eq 9.24, en silencio).
  const offs: number[] = [];
  for (let d = 2; d <= Math.max(16, Math.round(pitch / 2)); d += 2) offs.push(d, -d);
  /** coloca n canales uniformes en la banda y los esquiva; devuelve los que sobreviven */
  const colocar = (n: number): number[] => {
    const y: number[] = [];
    for (let i = 0; i < n; i++) y.push(n === 1 ? Math.round(cyMid) : Math.round(yLo + (i * span) / (n - 1)));
    for (let i = 0; i < y.length; i++) {
      if (xSpanAt(y[i])) continue;
      const lo = i > 0 ? y[i - 1] + dia + 4 : yEdge;
      const hi = i < y.length - 1 ? y[i + 1] - dia - 4 : D - yEdge;
      for (const off of offs) {
        const y2 = y[i] + off;
        if (y2 >= lo && y2 <= hi && xSpanAt(y2)) { y[i] = y2; break; }
      }
    }
    // canal que quedó partido por barrenos → se ELIMINA: mejor un canal menos
    // que un canal que perfora un tornillo.
    return y.filter((v) => xSpanAt(v));
  };
  let chY: number[] = [];
  if (span <= 4) {
    chY = [Math.round(cyMid)];                     // molde muy chico: UNA línea central
  } else {
    // los canales se reparten UNIFORMES en la banda, y son los suficientes para
    // que el paso resultante span/(n−1) NO se pase de W (Eq 9.24): huecos =
    // ceil(span/W). Con floor() salían 3 canales a 94 mm en una banda de 188.
    const need = Math.max(2, Math.ceil(span / pitch) + 1);
    // Si el esquive tira canales, se REPONEN: se pide uno más y se recoloca. Sin
    // esto, perder el canal de en medio dejaba el doble de paso sin avisar.
    for (let extra = 0; extra <= 4; extra++) {
      chY = colocar(need + extra);
      if (chY.length >= need) break;
    }
  }
  // NUNCA cero líneas: un molde sin agua no es molde. Barrido fino de TODA la
  // placa buscando la Y libre más cercana al centro de la pieza.
  if (!chY.length) {
    let best: number | null = null;
    for (let y = yEdge; y <= D - yEdge; y++)
      if (xSpanAt(y) && (best == null || Math.abs(y - cyMid) < Math.abs(best - cyMid))) best = y;
    chY = best != null ? [best] : [Math.round(cyMid)];   // último recurso: central (ruta manual)
  }
  chY.sort((a, b) => a - b);
  const nCh2 = chY.length;                                 // tras el esquive/drop
  // cada canal trae SU tramo (los de las filas de pilares son más cortos)
  const spanOf = chY.map((y) => xSpanAt(y) ?? { a: xMin, b: xMax });
  const segs: CoolingCircuit['segs'] = [];
  for (let i = 0; i < nCh2; i++) segs.push({ x0: spanOf[i].a, y0: chY[i], x1: spanOf[i].b, y1: chY[i] });
  // serpentín: cross-drill en extremo alterno. Con tramos DISTINTOS el barreno
  // transversal va donde los dos canales coinciden (el más corto manda).
  // ── Y EL CROSS-DRILL TAMBIÉN ESQUIVA (§9.2.7) ──
  // El esquive de arriba solo miraba los canales HORIZONTALES: los tramos
  // verticales de conexión se plantaban en el extremo del span sin verificar nada,
  // y ahí es justo donde viven los tornillos de las esquinas. De ahí salían los
  // críticos del auditor con canal x=19 / x=376 / x=471 contra pernos M8-M12: el
  // circuito "esquivado" chocaba por los tramos que nadie revisó.
  /** ¿el tramo VERTICAL en x, entre ya y yb, libra todos los obstáculos? */
  const verticalLibre = (x: number, ya: number, yb: number): boolean => {
    const lo = Math.min(ya, yb), hi = Math.max(ya, yb);
    for (const o of obstacles) {
      const hol = rLine + o.r + CLR;
      if (o.y < lo - hol || o.y > hi + hol) continue;              // fuera del tramo
      if (Math.abs(x - o.x) < hol) return false;
    }
    return true;
  };
  /** X del cross-drill: desde el extremo hacia adentro hasta encontrar tramo libre. */
  const crossX = (xExtremo: number, haciaDentro: number, ya: number, yb: number): number => {
    for (let d = 0; d <= 60; d += 2) {
      const x = xExtremo + haciaDentro * d;
      if (x < xMin || x > xMax) break;
      if (verticalLibre(x, ya, yb)) return Math.round(x);
    }
    return Math.round(xExtremo);                                    // sin hueco: se reporta, no se finge
  };
  const crossXs: number[] = [];
  for (let i = 0; i + 1 < nCh2; i++) {
    const derecha = i % 2 === 0;
    const x0 = derecha ? Math.min(spanOf[i].b, spanOf[i + 1].b) : Math.max(spanOf[i].a, spanOf[i + 1].a);
    const x = crossX(x0, derecha ? -1 : +1, chY[i], chY[i + 1]);
    crossXs.push(x);
    segs.push({ x0: x, y0: chY[i], x1: x, y1: chY[i + 1] });
  }
  const outX = (nCh2 - 1) % 2 === 0 ? spanOf[nCh2 - 1].b : spanOf[nCh2 - 1].a;   // extremo abierto del último canal
  const portEnds = new Set([`0:${spanOf[0].a}`, `${nCh2 - 1}:${outX}`]);
  const ports = [{ x: spanOf[0].a, y: chY[0], label: 'IN' }, { x: outX, y: chY[nCh2 - 1], label: 'OUT' }];
  // cada canal se barrena PASANTE a los dos cantos → se sella con plug salvo IN/OUT
  const plugs: CoolingCircuit['plugs'] = [];
  for (let i = 0; i < nCh2; i++) for (const x of [spanOf[i].a, spanOf[i].b])
    if (!portEnds.has(`${i}:${x}`)) plugs.push({ x, y: chY[i] });
  // LADO B (detrás del núcleo): la línea corre POR el respaldo del inserto, que §4.2.1
  // (Fig 4.13) dimensiona a 3·⌀ EXACTAMENTE para hospedarla. A 4·⌀ caía en la COSTURA
  // inserto/placa (lo midió el estudio de contacto). Eq 9.22 permite H ∈ [2D, 5D] → a
  // 2·⌀ queda CENTRADA en el respaldo con ~1⌀ de acero a cada lado. Fuente ÚNICA:
  // placa, inserto y componente leen este mismo número.
  const behind = Math.round(2 * dia);
  // ── LADO A: la impresión tallada SUBE depthMm sobre la partición — la línea A
  // debe LIBRARLA. Eq 9.22 mide H desde la SUPERFICIE MOLDEANTE, no desde la
  // partición: z_A = dep + H, acotada a caber en la placa A (ceja r+4 al tope).
  // Si ni librando la impresión cabe (dep + r + 3), el barreno recto es IMPOSIBLE
  // → zAboveMm undefined + aWarn (baffles §9.2.4 o engrosar A: el lazo generativo).
  const dep = s.cavity.depthMm, rr = dia / 2, tAp = s.plates.A;
  let zAbove: number | undefined = Math.min(dep + H, tAp - rr - 4);
  let aWarn: string | undefined;
  if (zAbove < dep + rr + 3) {
    zAbove = undefined;
    aWarn = `impresión ${dep} mm no deja línea recta en placa A de ${tAp} mm — baffles §9.2.4 o engrosar A`;
  } else if (zAbove - dep < 2 * dia) {
    aWarn = `H_eff lado A = ${Math.round(zAbove - dep)} mm < 2D (Eq 9.22 pide 2D–5D) — engrosar placa A`;
  }
  // el circuito se barrena en LOS DOS lados (cavidad y núcleo) → n_lines = 2·nCh2.
  // Si no llega a lo que pide el proceso, se DICE: es el veredicto del estudio.
  const faltan = cd.nPerSide - nCh2;
  // PASO REALMENTE LOGRADO — si el esquive no pudo respetar Eq 9.24 hay que
  // DECIRLO. Pasa cuando el campo de pines expulsores tapiza la huella (rejilla
  // de ⌀12 cada ~10 mm): NINGUNA Y deja pasar un barreno recto. Es justo el
  // conflicto que §9.2.7 anuncia ("limits the placement of other mold
  // components such as ejector pins and bolts") y cuya salida es §9.3.5.2:
  // baffles/bubblers, o mover los pines. Nunca un paso silenciosamente malo.
  const pasoReal = chY.length > 1 ? Math.max(...chY.slice(1).map((y, i) => y - chY[i])) : 0;
  const violaPaso = chY.length > 1 && pasoReal > 2 * cd.hLineMm + 2;
  const avisos = [
    ...cd.fallas,
    ...(faltan > 0 ? [`trazo ${nCh2}/${cd.nPerSide} líneas/lado (barrenos en medio)`] : []),
    ...(violaPaso ? [`paso real ${pasoReal} mm > 2H = ${(2 * cd.hLineMm).toFixed(0)} (Eq 9.24): los expulsores/barrenos tapizan la banda — §9.3.5.2 pide baffles o bubblers`] : []),
    ...(aWarn ? [aWarn] : []),
  ];
  // El rótulo del PLANO va corto (se desbordaba de la hoja A3 y se metía en la
  // tabla de barrenos). El detalle completo del proceso vive en `design`.
  return {
    diaMm: dia, zBehindMm: behind, zAboveMm: zAbove, aWarn, segs, ports, plugs, design: cd, avisos,
    note: `serpentín §9.2 · ⌀${dia} ${cd.plug} · ${nCh2} líneas/lado · H ${H} (B) / ${zAbove != null ? Math.round(zAbove) : '—'} (A) · paso ${pitch} · ${cd.qCoolingW.toFixed(0)} W @ t_c ${cd.tcS.toFixed(1)} s${avisos.length ? ' · ⚠ ' + avisos.length + ' aviso(s)' : ''}`,
  };
}

/** Abertura(s) de cavidad de una placa A/B — CONSCIENTE de la pieza (círculo/caja
 *  con huella REAL) y MULTI-CAVIDAD (una abertura por impresión del grid). */
export function cavityOpenings(s: MoldAssemblySpec, D: number): PlateOpening[] {
  const cav = s.cavity, { fx, fy, round } = cavityFootprint(s);
  const cells = cavityGrid(s, D);
  const note = round ? `cavidad ⌀${cav.widthMm} · prof ${cav.depthMm}` : `cavidad ${fx}×${fy} · prof ${cav.depthMm}`;
  return cells.map((c, i) => round
    ? { kind: 'circle', x: c.cx, y: c.cy, dia: cav.widthMm, note: i === 0 ? note : undefined }
    : { kind: 'rect', x: c.cx, y: c.cy, w: fx, d: fy, note: i === 0 ? note : undefined });
}

/** Altura total del stack de placas (mm). */
export const moldStackHeight = (s: MoldAssemblySpec) =>
  s.plates.bottomClamp + s.plates.ejectorHousing + s.plates.support + s.plates.B + s.plates.A + s.plates.topClamp;

/** TORNILLERÍA DEL MOLDE (Kazmer §12.4, Fig 12.33) — dimensiona los tornillos de
 *  IZAJE por el peor caso (molde colgado de un tornillo + choque de grúa n_g=10).
 *  Masa del stack real; brazo l_COG = media altura; l_tornillo = 0.75·l_COG (razón
 *  del libro 0.15/0.2). Reproduce el bezel del libro (362 kg → 47 kN → M10). NO
 *  inventa: masa y brazos salen de la geometría del molde. */
export function moldBoltSizing(s: MoldAssemblySpec): {
  Hmm: number; massKg: number; forceN: number; din: string; dMinMm: number; dMm: number;
} {
  const D = plateDepth(s), Hmm = moldStackHeight(s);
  const massKg = moldMassKg(Hmm / 1000, s.widthMm / 1000, D / 1000);
  const lCog = Hmm / 1000 / 2;
  const forceN = worstCaseScrewForce(massKg, lCog, 0.75 * lCog);   // razón 0.15/0.2 del libro
  const sel = selectMoldScrew(forceN);
  return { Hmm, massKg, forceN, din: sel.din912, dMinMm: sel.dMinMm, dMm: parseFloat(sel.din912.slice(1)) };
}

/** FILAS DE INGENIERÍA CALCULADAS (no hardcode): tornillería §12.4 + geometría de
 *  las líneas de enfriamiento §9.2.5-6. Se anexan a la hoja de análisis del molde
 *  para que CADA barreno tenga propósito y número. */
export function moldEngineeringRows(s: MoldAssemblySpec): AnalysisRow[] {
  const b = moldBoltSizing(s);
  // LA HOJA DE ANÁLISIS LEE LA FUENTE ÚNICA. Antes cotizaba H = 4·D y W = 7·D a secas: para
  // la carcasa imprimía «⌀9.53 · H 38.1 · W 66.7» mientras el trazo de la MISMA hoja dibujaba
  // H 32 (Eq 9.21 recorta a k/1000) y el 3D dibujaba H 19. Tres números para una sola cosa.
  const cdRows = coolingCircuitDesign(s, plateDepth(s));
  const dia = cdRows.diaMm, depth = +cdRows.hLineMm.toFixed(1), pitch = +cdRows.wLineMm.toFixed(1);
  const rows: AnalysisRow[] = [
    { grupo: 'Tornillería §12.4', param: 'masa del molde (stack real)', valor: `${b.massKg.toFixed(0)} kg`, ref: `${b.Hmm}×${s.widthMm}×${plateDepth(s)} mm` },
    { grupo: 'Tornillería §12.4', param: 'fuerza peor caso (izaje, n_g=10)', valor: `${(b.forceN / 1000).toFixed(1)} kN`, ref: 'Fig 12.33', ok: true },
    { grupo: 'Tornillería §12.4', param: 'tornillo de sujeción (Ø mín → DIN 912)', valor: `${b.din} (⌀mín ${b.dMinMm.toFixed(1)} mm) · por revisar contra el taller`, ref: 'Eq 12.32' },
    { grupo: 'Enfriamiento §9.2', param: 'línea de agua (plug DME, ⌀ por caudal §9.2.5 con piso maquinable)', valor: `${cdRows.plug} · ⌀${dia} mm`, ref: '§9.2.4 · Tabla 9.2', ok: true },
    { grupo: 'Enfriamiento §9.2', param: `profundidad a la cavidad H = ${(depth / dia).toFixed(1)}·D (2D<H<5D, recortada por Eq 9.21)`, valor: `${depth} mm`, ref: 'Eqs 9.21/9.22', ok: depth >= 2 * dia - 1e-6 && depth <= cdRows.hLineMaxMm + 1e-6 },
    { grupo: 'Enfriamiento §9.2', param: 'paso entre líneas W ∈ [H, 2H]', valor: `${pitch} mm (${cdRows.nPerSide}/lado)`, ref: 'Eq 9.24', ok: pitch >= depth - 1 && pitch <= 2 * depth + 1 },
    // UN VEREDICTO (orden H): con el molde hecho, los dos renglones de arriba se REEMPLAZAN por lo que barrena la E6 (abajo):
    // la misma hoja decía «W 50.8 ✓» (diseño) y el dictamen «paso real 58.3 = 2.47·H ✗» (acero). Un número por criterio.
  ];
  if (s.aguaE6) {
    const w = s.aguaE6, nRows = rows.length;
    rows.splice(nRows - 2, 2,
      { grupo: 'Enfriamiento §9.2', param: 'profundidad a la cavidad H (2D<H<5D) · lo que barrena la E6', valor: `${w.profundidades.map((p) => `${p.que} ${p.hMm.toFixed(1)} mm = ${(p.hMm / dia).toFixed(2)}·D`).join(' · ')} (diseño ${depth})`, ref: 'Eqs 9.21/9.22', ok: w.profundidades.every((p) => p.hMm >= 2 * dia - 1e-6 && p.hMm <= 5 * dia + 1e-6) },
      { grupo: 'Enfriamiento §9.2', param: 'paso entre líneas W ∈ [H, 2H] · el REAL de la serpentina B', valor: `${w.pasoMm.toFixed(1)} mm = ${(w.pasoMm / w.pasoDe).toFixed(2)}·H (H ${w.pasoDe.toFixed(1)}; diseño ${pitch})`, ref: 'Eq 9.24', ok: w.pasoMm >= w.pasoDe - 1e-6 && w.pasoMm <= 2 * w.pasoDe + 1e-6 });
  }
  // EXPULSIÓN §11.2.6 — la CABEZA CAPTURADA: sin esto las hojas decían «aloj. cabeza
  // ⌀+3 PASANTE» (la cabeza se cae) y nadie la retenía. Fig 11.15 Det. D.
  if (s.ejectors.type !== 'stripper') {
    const tRet = plateDefs(s).find((p) => p.role === 'ejector-ret')?.thick ?? 12;
    const hd = ejectorHeadGeom(s.ejectors.diaMm, tRet);
    rows.push(
      { grupo: 'Expulsión §11.2.6', param: `cabeza del pin ⌀${hd.diaMm} × ${hd.thickMm} — contrataladro CIEGO en la retenedora`,
        valor: `⌀${hd.boreDiaMm} × prof ${hd.boreDepthMm} desde la cara inferior (${plateDefs(s).find((p) => p.role === 'ejector-ret')?.code ?? '05a'})`, ref: 'Fig 11.15 Det. D', ok: hd.boreDepthMm < tRet },
      { grupo: 'Expulsión §11.2.6', param: 'pasaje del cuerpo (holgura de barrenado)',
        valor: `⌀${hd.pasajeDiaMm} = cuerpo ⌀${s.ejectors.diaMm} + 0.5 · pasante en expulsora y retenedora`, ref: '§11.2.6', ok: true },
      { grupo: 'Expulsión §11.2.6', param: 'la cabeza queda CAPTURADA',
        valor: `cabeza ⌀${hd.diaMm} > pasaje ⌀${hd.pasajeDiaMm} de la expulsora — la respalda al empujar y el contrataladro la jala al retroceder`, ref: 'Fig 1.6 · Fig 11.15', ok: hd.diaMm > hd.pasajeDiaMm },
    );
    // LA TABLA DE EYECTORES (orden LOS BOTADORES CON NOMBRE): cada pin con su id y su largo; la llave si difieren
    const tb = s.ejectors.tabla;
    if (tb?.length) {
      const ls = tb.map((f) => f.largoMm), distintos = new Set(ls.map((l) => l.toFixed(2))).size;
      rows.push(
        { grupo: 'Expulsión §11.2.6', param: `tabla de eyectores: ${tb.length} pines con NOMBRE (R37)`,
          valor: tb.map((f) => `${f.id} L${f.largoMm}`).join(' · '), ref: '§11.2.6 · §11.1.7', ok: true },
        { grupo: 'Expulsión §11.2.6', param: distintos > 1 ? `${distintos} largos distintos → KEYED + etiquetados` : 'un solo largo (el libro lo prefiere)',
          valor: distintos > 1
            ? `LLAVE: plano en la cabeza a ${s.ejectors.llave?.planoAlEjeMm ?? '—'} mm del eje (regla de Hefestos) · id grabado en la cabeza Y junto a su barreno en la retenedora`
            : 'sin llave · id grabado en la cabeza y junto a su barreno en la retenedora',
          ref: '§11.2.6', ok: distintos === 1 || !!s.ejectors.llave },
      );
    }
  }
  // VENTEO §8 — el aire tiene que salir o quema/short-shot. Máx antes de rebaba
  //   por la LEY del land (geometría real, defaults del libro); práctica en partición.
  const hMax = ventMaxThickness(0.8e-3) * 1000;   // land de escape 0.8 mm
  rows.push(
    { grupo: 'Venteo §8', param: 'profundidad en la partición (práctica)', valor: '0.02 mm', ref: '§8.2', ok: true },
    { grupo: 'Venteo §8', param: 'máx antes de rebaba (land 0.8 mm)', valor: `${hMax.toFixed(3)} mm`, ref: 'Eq 8.x', ok: true },
    { grupo: 'Venteo §8', param: 'canal de escape detrás del land', valor: '0.4 mm × 6 mm', ref: '§8.2' },
  );
  // ALIMENTACIÓN §6-7 — colada CALIENTE (manifold + drops) vs FRÍA (bebedero+canales)
  if (s.feed === 'hot-runner') {
    const n = s.nCav ?? 1, zonas = Math.max(2, n + 1);   // 1 manifold + 1/drop
    rows.push(
      { grupo: 'Colada caliente §6', param: 'manifold (distribución balanceada)', valor: `H13 · ${zonas} zonas calefactoras`, ref: '§6.4', ok: true },
      { grupo: 'Colada caliente §6', param: 'boquillas calientes (una por cavidad)', valor: `${n} drops · termopar/zona`, ref: '§6.4', ok: true },
      { grupo: 'Colada caliente §6', param: 'colada de desecho (regrind)', valor: '0 % (sin bebedero ni canales)', ref: '§6.1', ok: true },
      { grupo: 'Colada caliente §6', param: 'por qué', valor: 'ciclo corto + material bajo a alto volumen', ref: '§3.4' },
    );
  } else {
    rows.push(
      { grupo: 'Colada fría §7', param: 'alimentación', valor: s.feed === 'cold-3placas' ? '3 placas (compuerta automática)' : (s.nCav ?? 1) === 1 ? '2 placas · sprue directo a la pieza (sin canales, §7.2.1)' : `2 placas (bebedero + canales a ${s.nCav} cavidades)`, ref: '§7', ok: true },
      { grupo: 'Colada fría §7', param: 'colada de desecho (regrind)', valor: '~20-25 % del disparo', ref: '§7.1' },
    );
  }
  // MOVIMIENTOS §11.3.6-8 — undercut lateral que exige corredera/core-pull
  if (s.sideAction) {
    const sa = sideActionDesign(s.sideAction);
    rows.push(
      { grupo: 'Movimientos §11.3.6', param: `retención del undercut (${s.sideAction.aProjMm2} mm² × ${s.sideAction.pMeltMPa} MPa)`, valor: `${(sa.forceN / 1000).toFixed(1)} kN`, ref: 'Eq 11.13', ok: true },
      { grupo: 'Movimientos §11.3.6', param: 'mecanismo (por carrera)', valor: sa.type === 'slide' ? 'corredera (slide)' : 'core-pull hidráulico', ref: '§11.3.6', ok: true },
      sa.type === 'slide'
        ? { grupo: 'Movimientos §11.3.7', param: `angle pin ${sa.anglePin!.phiDeg}° · carrera ${s.sideAction.strokeMm} mm`, valor: `L ${sa.anglePin!.totalLenMm.toFixed(0)} mm (contacto ${sa.anglePin!.contactLenMm.toFixed(0)} + encastre 25)`, ref: '§11.3.7', ok: true }
        : { grupo: 'Movimientos §11.3.6', param: `cilindro hidráulico (bore ⌀${sa.boreMm!.toFixed(0)} mm)`, valor: `estándar ⌀${sa.stdBoreMm} mm · carrera ${s.sideAction.strokeMm} mm`, ref: '§11.3.6', ok: true },
    );
    if (s.sideAction.note) rows.push({ grupo: 'Movimientos §11.3.6', param: 'nota', valor: s.sideAction.note, ref: '§11.3' });
  }
  return rows;
}

/** Leyenda de propósito de los barrenos de una placa (agrupa por tipo → "N× tipo").
 *  Da SENTIDO a cada barreno del plano (el cliente ve para qué es cada uno). */
export function holeLegend(holes: PlateHole[]): string[] {
  const groups = new Map<string, { n: number; dia: number }>();
  for (const h of holes) {
    const key = (h.type ?? 'barreno');
    const g = groups.get(key) ?? { n: 0, dia: h.dia };
    g.n++; groups.set(key, g);
  }
  return [...groups.entries()].map(([type, g]) => `${g.n}× ${type} ⌀${g.dia}`);
}

/** Barrenos estándar de una placa según su rol (layout simétrico, cantidades/⌀
 *  del spec resuelto — no inventa la pieza, especifica componentes estándar). */
/** Posiciones de expulsores bajo UNA cavidad: círculo de pernos si es redonda,
 *  rejilla dentro de la huella si es caja. */
/** Expulsores de un MARCO (bezel): NO en el centro (ahí está la ventana, sin material),
 *  sino en el RIM perimetral (las 4 paredes) + una fila en las COSTILLAS transversales.
 *  Reproduce el layout del libro (Kazmer Fig 11.7): pines sobre secciones sólidas. */
function frameEjectorPositions(cx: number, cy: number, fx: number, fy: number, frameMm: number, ribs: number, n: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const hx = fx / 2 - frameMm / 2, hy = fy / 2 - frameMm / 2;   // línea media del rim
  // 1) COSTILLAS: un pin en la x de cada costilla, sobre el rim inferior (fórmula del libro).
  const nRib = Math.min(ribs, Math.max(0, n - 4));
  for (let i = 0; i < nRib; i++) {
    const rx = -fx / 2 + frameMm + ((i + 1) * (fx - 2 * frameMm)) / (ribs + 1);
    pts.push([Math.round(cx + rx), Math.round(cy - hy)]);
  }
  // 2) RIM PERIMETRAL: el resto repartido por longitud de arco en las 4 paredes.
  const rem = Math.max(0, n - pts.length);
  const per = 4 * (hx + hy);
  for (let i = 0; i < rem; i++) {
    let d = (((i + 0.5) / rem) * per) % per;                    // recorre der→arriba→izq→abajo
    let x: number, y: number;
    if (d < 2 * hy) { x = hx; y = -hy + d; }                    // pared derecha (abajo→arriba)
    else if (d < 2 * hy + 2 * hx) { x = hx - (d - 2 * hy); y = hy; }        // pared superior
    else if (d < 4 * hy + 2 * hx) { x = -hx; y = hy - (d - 2 * hy - 2 * hx); }  // pared izquierda
    else { x = -hx + (d - 4 * hy - 2 * hx); y = -hy; }          // pared inferior
    pts.push([Math.round(cx + x), Math.round(cy + y)]);
  }
  return pts;
}

/** `keepOutMm` = distancia mínima del CENTRO del pin a la pared moldeante — §11.2.5
 *  LITERAL: 1⌀ de acero entre el barreno y la superficie de cavidad, o sea
 *  keepOut = ⌀pin + ½⌀barreno (+1 mm de guarda por el redondeo de posiciones).
 *  El margen fijo (12 %) IGNORABA el pin: con ⌀12 en una huella chica, el barreno
 *  quedaba a 2.9 mm del muro (carcasa) y en el benchy lo CORTABA (−0.6 mm). */
function ejectorPositions(cx: number, cy: number, fx: number, fy: number, round: boolean, n: number, frame?: { frameMm: number; ribs: number }, keepOutMm = 0): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  if (frame && !round && frame.frameMm > 0) return frameEjectorPositions(cx, cy, fx, fy, frame.frameMm, frame.ribs, n);
  if (round) {
    // el radio del círculo de pines respeta el acero contra la pared del pocket
    const rMax = fx / 2 - keepOutMm;
    const r = Math.max(0, Math.min(Math.max(5, (fx / 2) * 0.55), rMax));
    for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n - Math.PI / 2; pts.push([Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))]); }
  } else {
    // rejilla nx×ny DISTRIBUIDA por la huella: margen 12 % O el acero §11.2.5,
    // el que sea MAYOR (el 12 % solo reparte; el acero es regla dura del libro).
    const nx = Math.max(1, Math.round(Math.sqrt(n))), ny = Math.ceil(n / nx);
    const mx = Math.min(Math.max(fx * 0.12, keepOutMm), fx / 2);
    const my = Math.min(Math.max(fy * 0.12, keepOutMm), fy / 2);
    let k = 0;
    for (let r = 0; r < ny && k < n; r++) for (let c = 0; c < nx && k < n; c++, k++) {
      const px = nx === 1 ? cx : cx - fx / 2 + mx + (c * (fx - 2 * mx)) / (nx - 1);
      const py = ny === 1 ? cy : cy - fy / 2 + my + (r * (fy - 2 * my)) / (ny - 1);
      pts.push([Math.round(px), Math.round(py)]);
    }
  }
  return pts;
}

/** keepOut §11.2.5 para un pin dado: 1⌀ de acero + ½ barreno + 1 mm de guarda. */
function ejectorKeepOutMm(pinDiaMm: number): number {
  return pinDiaMm + ejectorPinFit(pinDiaMm).holeDiaMm / 2 + 1;
}

/** Posiciones de expulsores de UNA celda: por AGARRE si el spec las trae
 *  (§11.2.5 Fig 11.11, de gripEjectorLayout — relativas al centro de la huella),
 *  si no la rejilla/círculo/rim de siempre. UNA función para los DOS call sites
 *  (B/support y ejector/ejector-ret): si divergen, pasajes y cabezas desalinean. */
function ejectorCellPositions(s: MoldAssemblySpec, cell: { cx: number; cy: number }, fx: number, fy: number, round: boolean, perCav: number, frame?: { frameMm: number; ribs: number }): Array<[number, number]> {
  const grip = s.ejectors.positions;
  if (grip?.length) return grip.map((p) => [Math.round(cell.cx + p.x), Math.round(cell.cy + p.y)]);
  return ejectorPositions(cell.cx, cell.cy, fx, fy, round, perCav, frame, ejectorKeepOutMm(s.ejectors.diaMm));
}

/** ⌀ de los PILARES DE SOPORTE (Fig 1.6). Regla de Hefestos: el libro resuelve el bezel con ⌀37.5 y ⌀50 (§12.2.3 p.316-317)
 *  y no da un ⌀ por tamaño de base; 40 es el que el molde arma desde siempre. Una constante: el sólido, sus holguras en las
 *  placas expulsoras, las láminas y la BOM leen ESTE número. */
export const PILAR_SOPORTE_DIA_MM = 40;
// POSICIONES de los PILARES DE SOPORTE (Kazmer §12.2.3): reducen la deflexión de placa,
// van DIRECTO bajo las zonas de fuerza de la cavidad PERO su ubicación CHOCA con los pines
// eyectores y el vástago KO — el libro dice AJUSTAR EL LAYOUT para librarlos. Esta función
// es la ÚNICA fuente: LEE los obstáculos (pines/return/KO/tornillos del housing) y coloca
// los pilares en el HUECO más cercano al centro que los libra → "todo se habla con todo".
// La usan el COMPONENTE (pilares-soporte), las holguras de las placas expulsoras y — desde la orden J (2026-10-29) — las
// LÁMINAS y la BOM: vivía en mold-plano-set.ts (que la re-exporta) y el papel no la podía leer sin un import circular; por eso
// los 3 pilares de la carcasa existían en el acero y en ninguna lámina.
export function supportPillarPositions(spec: MoldAssemblySpec, D: number): Array<{ x: number; y: number }> {
  // EL ESTUDIO MANDA: `optimizeSupportPlate` (§12.2, δ=F·L³/48EI) ya calculó CUÁNTOS pilares
  // se necesitan según la deflexión de la placa vs el venteo — y puede ser CERO (molde chico
  // y rígido NO los necesita). Antes la geometría clavaba 2 SIEMPRE, ignorando el cálculo
  // (feedback del user: "no está calculado el estrés → está mal"). Aquí respetamos el número.
  const nWanted = Math.max(0, Math.round(spec.supportPillars ?? 0));
  if (nWanted === 0) return [];                                  // la placa aguanta sola: sin pilares
  const W = spec.widthMm, pillarR = PILAR_SOPORTE_DIA_MM / 2;
  const obstacles = standardHoles(spec, 'support').map((h) => ({ x: h.x, y: h.y, r: h.dia / 2 }));
  const clears = (x: number, y: number) => obstacles.every((o) => Math.hypot(x - o.x, y - o.y) >= pillarR + o.r + 3);
  const cx0 = W / 2, cy0 = D / 2;
  const cands: Array<{ x: number; y: number; d: number }> = [];
  for (let fx = 0.26; fx <= 0.74; fx += 0.02) for (const fy of [0.3, 0.42, 0.5, 0.58, 0.7]) {
    const x = Math.round(W * fx), y = Math.round(D * fy);
    if (x < 75 || x > W - 75) continue;                          // dentro de los rieles del housing
    if (clears(x, y)) cands.push({ x, y, d: Math.hypot(x - cx0, y - cy0) });   // libra pines+KO
  }
  cands.sort((a, b) => a.d - b.d);                               // los más cerca del centro (bajo la fuerza, §12.2.3)
  const chosen: Array<{ x: number; y: number }> = [];
  for (const c of cands) { if (chosen.every((k) => Math.hypot(c.x - k.x, c.y - k.y) > 55)) chosen.push({ x: c.x, y: c.y }); if (chosen.length >= nWanted) break; }
  return chosen;
}

/**
 * DÓNDE VAN LOS BARRENOS KO — el vástago expulsor de la máquina pasa por la sujeción inferior y EMPUJA LA PLACA EXPULSORA.
 * -------------------------------------------------------------------------------------------------------------------
 * MEDIDO (revisor Fable, orden E, y de nuevo la orden J en la app, 2026-10-29): en la 1594C Box (base 246) los dos KO salían
 * a x = 123 ± 60 = 63 y 183, pero la expulsora vive ENTRE los rieles, de x = 65 a 181 (116 mm): la lámina 12 los acotaba en
 * X = −2.00 y X = 118.00, fuera de la placa. El vástago de la máquina habría empujado el aire junto al riel, no la placa.
 * El PATRÓN es el de siempre (dos flanqueando el centro cuando la colada es central, uno al centro si no); lo nuevo es que
 * cada KO cae DENTRO de la expulsora REAL (`expulsoraMargenes`, la misma placa que se barrena) y no pisa lo que ya vive ahí:
 *   · su centro a ≥ 1·⌀ del canto de la expulsora (½⌀ de acero entre el barreno y el canto) — regla de Hefestos: el libro da
 *     «½ del diámetro de cada componente» como holgura en la partición (§4.3.2); aquí se aplica igual contra el canto.
 *   · ≥ 3 mm de acero contra cada contrataladro de cabeza de pin y cada retorno (la guarda de `supportPillarPositions`).
 * El offset nominal (60) NO es del libro ni de la máquina: el patrón KO de la HT-150SV es «SIN DATO» (docs/MAQUINA-DEL-TALLER.md:
 * se lee en la platina móvil) y Kazmer §11.3.8 manda "confirm the location(s), diameter, and thread of the knock-out rods with
 * the molder". Por eso solo se ACORTA lo necesario (de 1 en 1 mm) y, si ningún par cabe, va uno al centro — el vástago central
 * es "quite common" (§12.2.3). Fuente ÚNICA de las tres placas que lo barrenan (soporte, sujeción inferior, expulsora).
 */
export function koLayout(s: MoldAssemblySpec, D?: number): { diaMm: number; pts: Array<[number, number]>; offMm: number; notas: string[] } {
  const W = s.widthMm, Dd = D ?? plateDepth(s);
  const diaMm = Math.max(20, Math.round(W * 0.055)), r = diaMm / 2;
  const cx = W / 2, cy = Dd / 2;
  const mg = expulsoraMargenes(s, Dd);
  const x0 = mg.mxMm, x1 = W - mg.mxMm, y0 = mg.myMm, y1 = Dd - mg.myMm;
  // lo que ya vive en la expulsora: el contrataladro de la cabeza de cada pin (el más ancho de sus barrenos) y los retornos
  const obst: Array<{ x: number; y: number; r: number }> = [];
  const cells = cavityGrid(s, Dd);
  if (s.ejectors.type !== 'stripper') {
    const { fx, fy, round } = cavityFootprint(s);
    const perCav = Math.max(1, Math.round(s.ejectors.count / Math.max(1, cells.length)));
    const frame = s.cavity.frameMm ? { frameMm: s.cavity.frameMm, ribs: s.cavity.ribs ?? 0 } : undefined;
    const tRet = plateDefs(s).find((p) => p.role === 'ejector-ret')?.thick ?? 12;
    const rCabeza = ejectorHeadGeom(s.ejectors.diaMm, tRet).boreDiaMm / 2;
    for (const cell of cells) for (const [x, y] of ejectorCellPositions(s, cell, fx, fy, round, perCav, frame)) obst.push({ x, y, r: rCabeza });
  }
  const rp = returnPinLayout(s, Dd);
  for (const [x, y] of rp.pts) obst.push({ x, y, r: rp.diaMm / 2 });
  const cabe = (x: number, y: number) => x - x0 >= diaMm && x1 - x >= diaMm && y - y0 >= diaMm && y1 - y >= diaMm;
  const libre = (x: number, y: number) => obst.every((o) => Math.hypot(x - o.x, y - o.y) >= r + o.r + 3);
  const notas: string[] = [];
  if (s.feed === 'hot-runner' || cells.length === 1) {
    const offNom = Math.max(60, diaMm);
    for (let off = offNom; off >= diaMm; off -= 1) {
      const pts: Array<[number, number]> = [[Math.round(cx - off), Math.round(cy)], [Math.round(cx + off), Math.round(cy)]];
      if (pts.every(([x, y]) => cabe(x, y) && libre(x, y))) {
        if (off < offNom) notas.push(`KO a ±${off} del centro (no ±${offNom}): la expulsora mide ${x1 - x0} mm entre los rieles y el KO ⌀${diaMm} debe caer dentro con ½⌀ de acero al canto (regla de Hefestos)`);
        return { diaMm, pts, offMm: off, notas };
      }
    }
    notas.push(`ningún par de KO ⌀${diaMm} cabe en la expulsora de ${x1 - x0} mm sin pisar pines ni retornos: va UNO al centro (§12.2.3, «quite common»)`);
  }
  const c: [number, number] = [Math.round(cx), Math.round(cy)];
  if (!cabe(...c) || !libre(...c)) notas.push(`⚠ el KO central ⌀${diaMm} pisa un pin o un retorno, o no deja ½⌀ al canto: confirmar el patrón KO con el moldeador (§11.3.8)`);
  return { diaMm, pts: [c], offMm: 0, notas };
}

/**
 * @param o.lamina  true SOLO desde el generador de LÁMINAS. Añade los rasgos que el
 *   plano debe COTAR pero que el sólido corta aparte: hoy, el contrataladro CIEGO de la
 *   cabeza en la retenedora. No se mete en la lista que consume `buildPlateSolid` porque
 *   ésa se barrena en UN compound, y meter dos cilindros CONCÉNTRICOS traslapados en un
 *   solo cut de OCC corrompe el resultado y deja la placa MACIZA (ya pagado con el
 *   asiento del buje guía: el poste quedaba enterrado 91 cc). El sólido corta ese mismo
 *   contrataladro SECUENCIALMENTE, con las mismas medidas de `ejectorHeadGeom`.
 */
export function standardHoles(s: MoldAssemblySpec, role: PlateRole, o?: { lamina?: boolean }): PlateHole[] {
  const W = s.widthMm, D = plateDepth(s);
  const inset = Math.max(20, Math.round(W * 0.06));
  const holes: PlateHole[] = [];
  const bolt = moldBoltSizing(s), scrDia = bolt.dMm + 1;   // barreno de HOLGURA (M + 1)

  // TORNILLOS de sujeción — REGLA DURA: un tornillo NUNCA cruza la LÍNEA DE
  // PARTICIÓN (el molde ABRE ahí; un perno pinaría las mitades cerradas). Por eso
  // hay DOS grupos independientes que no comparten eje a través del parting:
  //   · MITAD CAVIDAD (clamp + A): sujeta el lado fijo, atornillado desde arriba.
  //   · MITAD NÚCLEO (B + soporte + bottom): sujeta el lado móvil por los RIELES,
  //     esquivando las placas EXPULSORAS que VIAJAN (Fig 1.4).
  // Los dos grupos se INTERLEAVAN para NUNCA compartir eje XY (si coincidieran,
  // juntos harían el bore continuo de nuevo): CAVIDAD en esquinas + medios
  // horizontales; NÚCLEO en los rieles laterales a Y intermedios (cuartos).
  if (role === 'clamp' || role === 'A') {                     // MITAD CAVIDAD (sobre la partición)
    const p: [number, number][] = [[inset, inset], [W - inset, inset], [inset, D - inset], [W - inset, D - inset]];
    if (W > 250) p.push([Math.round(W / 2), inset], [Math.round(W / 2), D - inset]);   // medios de los bordes CORTOS
    for (const [x, y] of p) holes.push({ x, y, dia: scrDia, type: `tornillo ${bolt.din} · mitad cavidad (⌀${scrDia})` });
  }
  if (role === 'B' || role === 'support' || role === 'bottom') {   // MITAD NÚCLEO (bajo la partición)
    const railX = Math.max(24, Math.round(W * 0.065));        // eje del riel (fuera de las placas expulsoras)
    const ys = D > 250 ? [Math.round(D * 0.28), Math.round(D / 2), Math.round(D * 0.72)] : [Math.round(D * 0.3), Math.round(D * 0.7)];
    for (const x of [railX, W - railX]) for (const y of ys)
      holes.push({ x, y, dia: scrDia, type: `tornillo ${bolt.din} · mitad núcleo (⌀${scrDia})` });
  }

  // PILARES GUÍA en las 4 esquinas — SOLO placas que los cruzan (A y B). Asimétrico.
  if (role === 'A' || role === 'B') {
    const gp = guiaNominalMm(W), gi = inset + Math.round(gp / 2) + 4, G = guideGeom(gp);
    for (const [dx, dy, t] of [[gi, gi, ''], [W - gi, gi, ''], [gi, D - gi, ''], [W - gi - 10, D - gi, ' (desplazado)']] as Array<[number, number, string]>) {
      // EN LA LÁMINA, LO QUE EL SÓLIDO BARRENA (orden J, 2026-10-29). La tabla decía «pilar guía ⌀25 PASANTE» en A y en B,
      // pero `buildPlateSolid` corta en A el ASIENTO DEL BUJE (⌀ buje + 0.4) con el contrataladro de su brida, y en B el
      // contrataladro del hombro del poste (Fig 1.5, `guideGeom`): quien barrenara A a ⌀25 no metería el buje de ⌀33.
      // Las medidas salen de `guideGeom` — la misma fuente que el sólido y que la BOM. El 3D sigue leyendo «pilar guía».
      // (rótulos CORTOS: la columna TIPO se corta en el canto de la hoja — medido: 8 textos fuera en A con el rótulo largo; el
      //  ⌀ y la profundidad ya van en sus columnas, la medida del buje/brida/hombro en la BOM y en `guideGeom`)
      const td = t ? ' despl.' : '';
      if (o?.lamina && role === 'A') {
        holes.push({ x: dx, y: dy, dia: G.boreA_bushingMm, type: `asiento buje guía ⌀${gp}${td}` });
        holes.push({ x: dx, y: dy, dia: G.cboreA_flangeMm, depth: G.flangeHMm + 1, type: 'brida del buje · cara sup.' });
      } else if (o?.lamina && role === 'B') {
        holes.push({ x: dx, y: dy, dia: gp, type: `poste guía ⌀${gp}${td}` });
        holes.push({ x: dx, y: dy, dia: G.cboreB_shoulderMm, depth: G.shoulderHMm + 0.5, type: 'hombro del poste · cara inf.' });
      } else holes.push({ x: dx, y: dy, dia: gp, type: `pilar guía${t}` });
    }
  }

  // EXPULSORES bajo CADA cavidad (placa B y soporte) — en la huella REAL, conteo
  // coherente (perCav × nCav ≈ ejectors.count).
  if (role === 'B' || role === 'support') {
    const cells = cavityGrid(s, D), { fx, fy, round } = cavityFootprint(s);
    const perCav = Math.max(1, Math.round(s.ejectors.count / Math.max(1, cells.length)));
    const frame = s.cavity.frameMm ? { frameMm: s.cavity.frameMm, ribs: s.cavity.ribs ?? 0 } : undefined;
    // barreno del expulsor: Ø + 0.13mm (deslizante + venteo, Kazmer §8.3.2) — NO exacto.
    // STRIPPER (§11.3.4): NO hay pines — el anillo empuja el perímetro; cero barrenos.
    const ejHole = ejectorPinFit(s.ejectors.diaMm).holeDiaMm;
    if (s.ejectors.type !== 'stripper')
      for (const cell of cells) for (const [x, y] of ejectorCellPositions(s, cell, fx, fy, round, perCav, frame))
        holes.push({ x, y, dia: ejHole, type: `expulsor (${s.ejectors.type})` });
    // HOLGURA de los RETURN PINS: bajan del paquete y CRUZAN soporte+B para topar en la
    // cara de A. Ajuste deslizante REAL 0.13mm (fits.ts), no 1mm inventado. La POSICIÓN sale
    // de `returnPinLayout` (mira el inserto): antes era `65+26` a mano y los barrenos se
    // quedaban donde ya no está el pin en cuanto el inserto lo empuja.
    const rp = returnPinLayout(s, D), rpHole = ejectorPinFit(rp.diaMm).holeDiaMm;
    for (const [x, y] of rp.pts)
      holes.push({ x, y, dia: rpHole, type: 'holgura pin de retorno (0.13mm)' });
  }

  // ALIMENTACIÓN por cavidad (placa A + clamp): CALIENTE → boquilla (drop); FRÍA →
  // bebedero central (1 cav) o compuerta por cavidad (multi). Nunca bebedero en hot.
  if (role === 'A' || role === 'clamp') {
    const cells = cavityGrid(s, D);
    if (s.feed === 'hot-runner') {
      for (const c of cells) holes.push({ x: c.cx, y: c.cy, dia: Math.max(4, Math.round(s.cavity.widthMm * 0.05)), type: 'boquilla caliente (drop §6)' });
    } else if (cells.length === 1) {
      // El barreno del bebedero lo dicta EL DISEÑO del sprue (Eq 6.8 + taper
      // §6.3.1), no un ⌀8 fijo: base del cono + holgura. Misma fuente que la
      // geometría del fundido (sprueDesignFromCavity) — consistencia forzada.
      const pd = plateDefs(s);
      const Lsprue = (pd.find((d) => d.role === 'clamp')?.thick ?? 36) + (pd.find((d) => d.role === 'A')?.thick ?? 56) + 6 - s.cavity.depthMm;
      const fd = sprueDesignFromCavity(s.plastic, s.cavity, Lsprue);
      // UN VEREDICTO (orden H): con molde, el ⌀ de base es el del bebedero que CORTA la E5 (`s.bebedero`), no este diseño propio
      holes.push({ x: cells[0].cx, y: cells[0].cy, dia: Math.ceil((s.bebedero?.diaBaseMm ?? 2 * fd.rBaseMm) + 0.6), type: 'bebedero (sprue cónico §6.3.1)' });
    } else {
      for (const c of cells) holes.push({ x: c.cx, y: c.cy, dia: 3, type: 'compuerta (gate)' });
    }
  }

  // PLACA EXPULSORA + RETENEDORA: la CABEZA queda CAPTURADA entre las dos (Fig 1.6 ·
  // §11.2.6 Fig 11.15 Det. D) + pines de RETORNO en 4 esquinas (regresan el paquete).
  //
  // ANTES (cazado el 2026-09-21 leyendo las hojas): la EXPULSORA barrenaba ⌀+3 PASANTE
  // con el rótulo «aloj. cabeza de expulsor» — un pasante más ancho que la cabeza NO la
  // aloja: la cabeza se cae por ahí. Y la RETENEDORA («placa retenedora (cabezas)») solo
  // traía ⌀+0.5 pasante: ninguna de las dos placas capturaba nada. Ahora, literal:
  //   · RETENEDORA (arriba del paquete): pasaje del CUERPO ⌀+0.5 (§11.2.6) + CONTRATALADRO
  //     CIEGO de la cabeza desde su cara INFERIOR (Fig 11.15 Det. D) — es el que "pulls the
  //     head of the ejector pin away from the parting plane when the ejector system is
  //     reversed". Mismas medidas que el contrataladro que el sólido YA corta.
  //   · EXPULSORA (abajo): pasante al ⌀ del CUERPO — más angosto que la cabeza, así que la
  //     respalda al empujar y la cabeza no puede salirse hacia abajo.
  if (role === 'ejector' || role === 'ejector-ret') {
    const cells = cavityGrid(s, D), { fx, fy, round } = cavityFootprint(s);
    const perCav = Math.max(1, Math.round(s.ejectors.count / Math.max(1, cells.length)));
    const frame = s.cavity.frameMm ? { frameMm: s.cavity.frameMm, ribs: s.cavity.ribs ?? 0 } : undefined;
    const tRet = plateDefs(s).find((p) => p.role === 'ejector-ret')?.thick ?? 12;
    const hd = ejectorHeadGeom(s.ejectors.diaMm, tRet);
    // LOS BOTADORES CON NOMBRE (2026-09-22): §11.2.6 "key and label each ejector pin AND MATCHING
    // LOCATION ON THE EJECTOR RETAINER PLATE" — cada barreno de la retenedora lleva el id de SU pin y su
    // largo (el renglón k de la tabla = la posición k del agarre). Con varias cavidades se añade «·Cn».
    const tabla = s.ejectors.tabla, llave = s.ejectors.llave;
    if (s.ejectors.type !== 'stripper')   // stripper: sin pines → sin alojamientos de cabeza
      for (let ci = 0; ci < cells.length; ci++) {
        const cell = cells[ci];
        ejectorCellPositions(s, cell, fx, fy, round, perCav, frame).forEach(([x, y], k) => {
          const f = tabla?.[k];
          const tag = f ? `${f.id}${cells.length > 1 ? `·C${ci + 1}` : ''}` : undefined;
          holes.push({ x, y, dia: hd.pasajeDiaMm,
            type: `pasaje de expulsor · ⌀ CUERPO +0.5 (§11.2.6)`,
            note: role === 'ejector' ? `más angosto que la cabeza ⌀${hd.diaMm}: la respalda`
              : f && o?.lamina ? `L ${f.largoMm}` : undefined,
            tag: role === 'ejector-ret' && o?.lamina ? tag : undefined });
          if (role === 'ejector-ret' && o?.lamina)
            holes.push({ x, y, dia: hd.boreDiaMm, depth: hd.boreDepthMm,
              type: 'aloj. CIEGO de cabeza de expulsor (contrataladro)',
              note: (llave ? `LLAVE: plano a ${llave.planoAlEjeMm} del eje (§11.2.6) · ` : '')
                + `desde la cara INFERIOR · cabeza ⌀${hd.diaMm}×${hd.thickMm} (Fig 11.15 Det. D)`,
              tag });
        });
      }
    // pines de retorno en las esquinas de la PLACA EXPULSORA real (más angosta que el
    // molde: vive dentro del housing en U, Fig 1.4) — no en las esquinas del molde, y FUERA
    // del inserto de núcleo (`returnPinLayout`: una sola fuente para pin y barrenos).
    const rp2 = returnPinLayout(s, D);
    for (const [x, y] of rp2.pts)
      holes.push({ x, y, dia: rp2.diaMm, type: 'pin de retorno' });
  }

  // BARRENO(S) KO para el vástago expulsor de la máquina. NO puede ir en el eje de
  // la COLADA (para colada caliente el drop baja por el centro): el vástago la
  // embestiría. Si el centro está ocupado por alimentación → DOS KO simétricos
  // flanqueando el centro (patrón estándar de la inyectora), si no, 1 al centro.
  if (role === 'support' || role === 'bottom' || role === 'ejector') {
    const ko = koLayout(s, D);
    for (const [x, y] of ko.pts) holes.push({ x, y, dia: ko.diaMm, type: 'barreno KO (vástago expulsor)' });
  }

  // La HEMBRA del interlock NO se coloca aquí: la coloca `planInterlocks` (fuente
  // ÚNICA) y la consume `buildPlateSolid`. Intenté ponerla aquí y la colocación quedó
  // DUPLICADA → divergió TRES veces seguidas contra el macho: (1) copié la regla de
  // §4.2.2 en vez de usar sizeInserts (2.4 mm), (2) usé cav.widthMm en vez de
  // cavityFootprint (20 mm), (3) esquivé solo los tornillos de A mientras el macho
  // esquivaba los de clamp+bottom. Tres capas del MISMO pecado. La lección no es
  // "copiar con cuidado" — es NO COPIAR.
  return holes;
}


/** LOS PERNOS DEL MOLDE (orden K, 2026-10-30): rosca, cabeza y largo BAJO LA CABEZA (el nominal de ISO 4762) de cada mitad
 *  — la MISMA cuenta con que `buildFunctionalParts` arma el perno (malla y B-Rep) y con la que la BOM lo pide. Antes la
 *  cuenta vivía solo dentro del armador del 3D: la lámina no tenía cómo decir el largo. Una fuente, dos clientes.
 *  (La rosca de las DOS mitades es la de la mitad cavidad: así la arma el 3D — `fastenerPlan(spec, { half: 'cavity' })`.) */
export function pernosDelMolde(s: MoldAssemblySpec) {
  const defs = plateDefs(s), thick = (r: string) => defs.find((d) => d.role === r)?.thick ?? 20;
  const ts = resolveThread(fastenerPlan(s, { half: 'cavity' }).majorMm);
  const hd = resolveHead('DIN912', ts.major);
  const engage = engagementLengthMm(ts, plateYieldMPa(s));
  return {
    ts, hd, engage,
    // cavidad: desde ARRIBA, de la cara de la sujeción superior a 6 mm antes de la partición (no la cruza)
    cavidad: { largoMm: Math.max(10, thick('clamp') + thick('A') - 6 - hd.k), cant: standardHoles(s, 'clamp').filter((h) => /tornillo/.test(h.type)).length },
    // núcleo: desde ABAJO de la sujeción inferior, por los rieles y el soporte, y rosca en B lo que pide el engrane (§12.2.3)
    nucleo: { largoMm: Math.max(10, s.plates.bottomClamp + s.plates.ejectorHousing + thick('support') + engage - hd.k), cant: standardHoles(s, 'bottom').filter((h) => /tornillo/.test(h.type)).length },
  };
}
/** el término ISO 12165 de cada placa (para el título suplementario de su lámina) */
const TERMINO_DE_PLACA: Record<PlateRole, ClaveTermino> = { clamp: 'sujecion', A: 'placaA', B: 'placaB', support: 'soporte', 'ejector-ret': 'retenedora', ejector: 'expulsora', bottom: 'sujecion' };

/** Genera el SET completo de planos del molde (ensamble + análisis + placas). */
export function moldDrawingSet(s: MoldAssemblySpec, analysisRows?: AnalysisRow[]): MoldDrawingSet {
  const D = plateDepth(s);
  const pages: DrawingPage[] = [];

  // LO QUE EL CORTE A-A NO VE PERO EL ACERO SÍ TRAE (orden J, 2026-10-29). Medido en la 1594C Box: 3 pilares de soporte
  // (orden B, z 36→132 bajo la cavidad) en el 3D y en NINGUNA lámina ni renglón de BOM; las placas expulsora y retenedora
  // salían SIN el barreno de holgura por donde suben y bajan (el sólido sí lo corta: `buildPlateSolid`). Los postes y bujes
  // guía tampoco tenían renglón. Todo sale de las MISMAS fuentes que el sólido: `supportPillarPositions` (colocadas, no las
  // pedidas), `PILAR_SOPORTE_DIA_MM`, `pillarClearanceFit`, `guiaNominalMm` + `guideGeom`.
  const pil = supportPillarPositions(s, D), Lpil = s.plates.ejectorHousing;
  const pilHolgura = pillarClearanceFit(PILAR_SOPORTE_DIA_MM).holeDiaMm;
  const gp = guiaNominalMm(s.widthMm), G = guideGeom(gp);
  // CON NOMBRE ISO (orden K): cada renglón lleva el término de ISO 12165 (español + inglés) y la norma del tipo. Y entran las
  // piezas que el STEP ya trae y la BOM no: retornos, pernos (largo de `pernosDelMolde`), interlocks y el anillo de centrado.
  const iso = (k: ClaveTermino, detalle: string, cant: number, material: string) => { const r = renglonISO(k, detalle); return { nombre: r.es, cant, material, en: r.en, norma: r.norma }; };
  const rp = returnPinLayout(s, D), pz = pernosDelMolde(s);
  let il: ReturnType<typeof planInterlocks> | null = null;
  try { il = planInterlocks(s); } catch { il = null; }
  const piezas = [
    ...(pil.length ? [iso('pilar', `⌀${PILAR_SOPORTE_DIA_MM} × ${Lpil}`, pil.length, s.baseSteel ?? '1.1730')] : []),
    iso('poste', `⌀${gp} × ${+((s.plates.A + s.plates.B) * 0.92).toFixed(1)}`, 4, '1.2510 rectificado'),
    iso('buje', `⌀${gp} (OD ${G.bushingODMm})`, 4, 'bronce/acero templ.'),
    iso('retorno', `⌀${rp.diaMm}`, rp.pts.length, '1.2842 templado'),
    ...(pz.cavidad.cant ? [iso('tornillo', `M${pz.ts.major} × ${+pz.cavidad.largoMm.toFixed(1)} · lado fijo`, pz.cavidad.cant, 'clase 12.9')] : []),
    ...(pz.nucleo.cant ? [iso('tornillo', `M${pz.ts.major} × ${+pz.nucleo.largoMm.toFixed(1)} · lado móvil`, pz.nucleo.cant, 'clase 12.9')] : []),
    ...(il && il.positions.length ? [iso('interlock', `⌀${il.diaMm ?? '—'}`, il.positions.length, 'S7 templado')] : []),
    // el ⌀100 del anillo es el del libro (§1.3.1) — el MISMO literal con que `buildFunctionalParts` lo arma
    iso('anillo', '⌀100', 1, '1.7131'),
  ];
  const conPilares = (role: PlateDef['role']): PlateHole[] => {
    if (role === 'ejector' || role === 'ejector-ret')
      return pil.map((q) => ({ x: q.x, y: q.y, dia: pilHolgura, type: 'holgura del pilar de soporte' }));   // la placa corre por él (Fig 1.6)
    // (la columna TIPO de la tabla se corta en el canto de la hoja: el ⌀ va en su columna y el texto corto)
    if (role === 'support' || role === 'bottom')
      return pil.map((q) => ({ x: q.x, y: q.y, dia: PILAR_SOPORTE_DIA_MM, apoyo: true, type: `pilar de soporte L${Lpil} §12.2.3` }));
    return [];
  };

  // 1) ENSAMBLE (sección A-A + BOM + notas de análisis)
  pages.push({ name: 'Ensamble', svg: moldAssemblyDrawing(s, { piezas }).svg });

  // 2) HOJA DE ANÁLISIS DE INGENIERÍA (§ + veredicto) + filas CALCULADAS
  //    (tornillería §12.4 + geometría de enfriamiento §9.2) anexadas siempre.
  const allRows = [...(analysisRows ?? []), ...moldEngineeringRows(s)];
  if (allRows.length) pages.push({ name: 'Análisis', svg: analysisSheet(s, allRows) });

  // 3) PLANO INDIVIDUAL de cada placa (planta + tabla de barrenos a cota)
  // La EXPULSORA y la RETENEDORA no miden lo que la base: viven entre los rieles, con los márgenes de
  // `expulsoraMargenes` (que CRECEN en Y cuando los retornos no caben — ian 2026-09-22). Su lámina se
  // acota a SU tamaño y sus barrenos a SU esquina; antes salían dibujadas a W×D de la base.
  const mgE = expulsoraMargenes(s, D);
  for (const p of plateDefs(s)) {
    const exp = p.role === 'ejector' || p.role === 'ejector-ret';
    const ox = exp ? mgE.mxMm : 0, oy = exp ? mgE.myMm : 0;
    const spec: PlateSpec = {
      code: p.code, name: p.name, material: p.mat, en: TERMINOS_ISO[TERMINO_DE_PLACA[p.role]].en, cajetin: s.cajetin,
      wmm: s.widthMm - 2 * ox, dmm: D - 2 * oy, thickMm: p.thick,
      holes: [...standardHoles(s, p.role, { lamina: true }), ...conPilares(p.role)].map((h) => (exp ? { ...h, x: h.x - ox, y: h.y - oy } : h)),
      openings: (p.role === 'A' || p.role === 'B') ? cavityOpenings(s, D) : undefined,
      cooling: (p.role === 'A' || p.role === 'B') ? coolingCircuit(s, D) : undefined,
    };
    pages.push({ name: p.name, svg: renderPlateDrawing(spec).svg });
  }
  return { title: s.name, code: s.code ?? 'MLD-001', pages };
}
