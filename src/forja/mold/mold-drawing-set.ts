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
import { moldAssemblyDrawing, type MoldAssemblySpec } from './mold-assembly';
import { moldMassKg, worstCaseScrewForce, selectMoldScrew } from './fasteners';
import { ventMaxThickness } from './venting';
import { sideActionDesign } from './sideactions';
import { ejectorPinFit } from './fits';   // holgura pin↔barreno 0.13mm (Kazmer §8.3.2)

export interface DrawingPage { name: string; svg: string }
export interface MoldDrawingSet { title: string; code: string; pages: DrawingPage[] }

/** Filas de análisis de ingeniería (valores del libro, con § y veredicto). */
export interface AnalysisRow { grupo: string; param: string; valor: string; ref: string; ok?: boolean }

const esc = (s: string) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

/** LÁMINA DE ANÁLISIS — la ingeniería del molde en una hoja (A3), agrupada por
 *  subsistema con su referencia al libro y veredicto. */
function analysisSheet(spec: MoldAssemblySpec, rows: AnalysisRow[]): string {
  const PW = 420, PH = 297, M = 10;
  const p: string[] = [];
  p.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${PW}mm" height="${PH}mm" viewBox="0 0 ${PW} ${PH}" font-family="Arial, sans-serif">`);
  p.push(`<rect width="${PW}" height="${PH}" fill="#fff"/><rect x="${M / 2}" y="${M / 2}" width="${PW - M}" height="${PH - M}" fill="none" stroke="#111" stroke-width="0.7"/>`);
  p.push(`<text x="${M + 4}" y="${M + 8}" font-size="5.5" font-weight="bold">HOJA DE ANÁLISIS DE INGENIERÍA</text>`);
  p.push(`<text x="${M + 4}" y="${M + 15}" font-size="3.2" fill="#555">${esc(spec.name)} · el molde como sistema de ecuaciones resuelto (Kazmer)</text>`);
  const x0 = M + 4, cols = [46, 92, 60, 40], head = ['SUBSISTEMA', 'PARÁMETRO', 'VALOR', 'REF/§'];
  let y = M + 24; const rowH = 6.4;
  const cx = (i: number) => x0 + cols.slice(0, i).reduce((a, b) => a + b, 0);
  const tW = cols.reduce((a, b) => a + b, 0);
  p.push(`<rect x="${x0}" y="${y}" width="${tW}" height="${rowH}" fill="#eef2f7" stroke="#111" stroke-width="0.3"/>`);
  head.forEach((h, i) => p.push(`<text x="${cx(i) + 1.5}" y="${y + 4.3}" font-size="3" font-weight="bold">${esc(h)}</text>`));
  y += rowH;
  let lastGroup = '';
  for (const r of rows) {
    p.push(`<rect x="${x0}" y="${y}" width="${tW}" height="${rowH}" fill="${r.ok === false ? '#fdecec' : 'none'}" stroke="#bbb" stroke-width="0.2"/>`);
    if (r.grupo !== lastGroup) { p.push(`<text x="${cx(0) + 1.5}" y="${y + 4.3}" font-size="2.9" font-weight="bold" fill="#1a5fb4">${esc(r.grupo)}</text>`); lastGroup = r.grupo; }
    p.push(`<text x="${cx(1) + 1.5}" y="${y + 4.3}" font-size="2.8">${esc(r.param)}</text>`);
    p.push(`<text x="${cx(2) + 1.5}" y="${y + 4.3}" font-size="2.8" font-weight="bold">${esc(r.valor)}${r.ok != null ? (r.ok ? '  ✓' : '  ⚠') : ''}</text>`);
    p.push(`<text x="${cx(3) + 1.5}" y="${y + 4.3}" font-size="2.6" fill="#666">${esc(r.ref)}</text>`);
    y += rowH;
  }
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
    { role: 'ejector-ret', code: `${s.code ?? 'MLD'}-05a`, name: 'Placa retenedora (cabezas)', thick: Math.max(12, Math.round(s.plates.ejectorHousing * 0.2)), mat: s.baseSteel ?? '1.1730' },
    { role: 'ejector', code: `${s.code ?? 'MLD'}-05b`, name: 'Placa expulsora', thick: Math.max(15, Math.round(s.plates.ejectorHousing * 0.28)), mat: s.baseSteel ?? '1.1730' },
    { role: 'bottom', code: `${s.code ?? 'MLD'}-06`, name: 'Placa de sujeción inferior', thick: s.plates.bottomClamp, mat: s.baseSteel ?? '1.1730' },
  ];
}

/** Ancho del fondo de la placa (≈0.78·ancho, 4:3 típico de mold base). */
/** FONDO (Y) de las placas. Si el spec trae el `depthMm` REAL de la base estándar
 *  (§4.3: las bases son rectangulares, p.ej. 296×396) se usa ÉSE. El 0.78 es solo el
 *  respaldo para specs escritos a mano — no una regla del libro. */
export const plateDepth = (s: MoldAssemblySpec) => Math.round(s.depthMm ?? s.widthMm * 0.78);

/** Huella de la cavidad en planta: X e Y (⌀ para redonda). */
import { sizeInserts } from './moldbase';
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

/** CIRCUITO de enfriamiento en SERPENTÍN, AUTOMATIZADO desde la rejilla de
 *  cavidades: N canales rectos barrenados a lo ancho, cubriendo la banda de las
 *  impresiones, conectados en extremos alternos (cross-drill) y sellados con plugs;
 *  puertos IN/OUT en un extremo. Base para el diseño generativo de refrigeración. */
export function coolingCircuit(s: MoldAssemblySpec, D: number): CoolingCircuit {
  const dia = s.cooling.diaMm;
  const edge = Math.max(16, Math.round(s.widthMm * 0.05));
  // PROFUNDIDAD y PASO POR EL LIBRO (Kazmer §9.2, reproducido en kazmer-bezel-mold.cjs):
  //   Eq 9.22:  H (línea → cavidad) = 4·D,  con 2D < H < 5D.
  //   Eq 9.24:  W (paso entre líneas) ∈ [H, 2H]; el libro usa 1.75·H para el bezel.
  const H = Math.round(4 * dia);
  const pitch = Math.round(1.75 * H);
  // LIBRAR LOS PILARES GUÍA de las esquinas (mismo cálculo que standardHoles).
  const inset = Math.max(20, Math.round(s.widthMm * 0.06));
  const gp = s.widthMm > 300 ? 32 : s.widthMm > 200 ? 25 : 20;
  const gi = inset + Math.round(gp / 2) + 4;
  const guard = gi + Math.round(gp / 2) + Math.ceil(dia / 2) + 6;
  const xL = Math.max(edge, guard), xR = s.widthMm - Math.max(edge, guard);
  // N LÍNEAS PARALELAS (en X) repartidas en D con el PASO del libro (no un ruteo inventado).
  //   nLines = floor(span / W) + 1   — igual que kazmer-bezel-mold.cjs.
  // los canales cubren la BANDA DE LA PIEZA ± medio paso (el calor vive ahí; §9.2.6
  // "cooling line pitch across the mold cavity") — no toda la placa (los flancos
  // lejanos solo chocan con tornillos/pilares del borde sin quitar calor).
  const yEdge = Math.max(14, Math.round(D * 0.08));
  const { fy: fyPart } = cavityFootprint(s);
  const cyMid = D / 2;
  // la banda se ACOTA a la zona segura en Y (lejos del marco de pilares/tornillos,
  // mismo guard que en X): en moldes chicos "pieza ± paso/2" caía sobre las filas
  // de tornillos y el esquive ELIMINABA todas las líneas → molde SIN agua (bug carcasa).
  const yLo = Math.max(yEdge, guard, Math.round(cyMid - fyPart / 2 - pitch / 2));
  const yHi = Math.min(D - yEdge, D - guard, Math.round(cyMid + fyPart / 2 + pitch / 2));
  const span = yHi - yLo;
  let chY: number[] = [];
  if (span <= 4) {
    chY = [Math.round(cyMid)];                     // molde muy chico: UNA línea central
  } else {
    const nCh = Math.max(2, Math.floor(span / pitch) + 1);
    for (let i = 0; i < nCh; i++) chY.push(Math.round(yLo + (i * span) / (nCh - 1)));
  }
  // ── ESQUIVAR BARRENOS (feedback user: "el agua sigue chocando") ──
  // obstáculos = expulsores + pilares + KO + tornillos de las placas A/B; si un canal
  // pasa a menos de (r_canal + r_barreno + 3 mm) de un barreno dentro de su tramo X,
  // el canal se CORRE en Y al primer hueco libre (±2..±14 mm), respetando el orden.
  {
    const obstacles: Array<{ x: number; y: number; r: number }> = [];
    for (const role of ['A', 'B'] as const)
      for (const h of standardHoles(s, role)) obstacles.push({ x: h.x, y: h.y, r: h.dia / 2 });
    const rLine = dia / 2;
    const clearOf = (y: number) => obstacles.every((o) =>
      o.x < xL - o.r || o.x > xR + o.r || Math.abs(y - o.y) >= rLine + o.r + 3);
    for (let i = 0; i < chY.length; i++) {
      if (clearOf(chY[i])) continue;
      const lo = i > 0 ? chY[i - 1] + dia + 4 : yEdge;
      const hi = i < chY.length - 1 ? chY[i + 1] - dia - 4 : D - yEdge;
      for (const off of [2, -2, 4, -4, 6, -6, 8, -8, 10, -10, 12, -12, 14, -14]) {
        const y2 = chY[i] + off;
        if (y2 >= lo && y2 <= hi && clearOf(y2)) { chY[i] = y2; break; }
      }
    }
    // canal sin salida (rodeado de barrenos) → se ELIMINA: mejor un canal menos
    // que un canal que perfora un tornillo (el serpentín se re-teje con los demás).
    chY = chY.filter((y) => clearOf(y));
    // NUNCA cero líneas: un molde sin agua no es molde. Barrido fino de TODA la
    // banda segura buscando la Y libre más cercana al centro de la pieza.
    if (!chY.length) {
      let best: number | null = null;
      for (let y = Math.max(yEdge, guard); y <= D - Math.max(yEdge, guard); y++)
        if (clearOf(y) && (best == null || Math.abs(y - cyMid) < Math.abs(best - cyMid))) best = y;
      chY = best != null ? [best] : [Math.round(cyMid)];   // último recurso: central (ruta manual)
    }
  }
  const nCh2 = chY.length;                                 // tras el esquive/drop
  const segs: CoolingCircuit['segs'] = [];
  for (let i = 0; i < nCh2; i++) segs.push({ x0: xL, y0: chY[i], x1: xR, y1: chY[i] });   // canal recto (a lo ancho)
  for (let i = 0; i + 1 < nCh2; i++)                                                      // serpentín: cross-drill en extremo alterno
    segs.push({ x0: i % 2 === 0 ? xR : xL, y0: chY[i], x1: i % 2 === 0 ? xR : xL, y1: chY[i + 1] });
  const outX = (nCh2 - 1) % 2 === 0 ? xR : xL;                                            // extremo abierto del último canal
  const portEnds = new Set([`0:${xL}`, `${nCh2 - 1}:${outX}`]);
  const ports = [{ x: xL, y: chY[0], label: 'IN' }, { x: outX, y: chY[nCh2 - 1], label: 'OUT' }];
  // cada canal se barrena PASANTE a los dos cantos → se sella con plug salvo IN/OUT
  const plugs: CoolingCircuit['plugs'] = [];
  for (let i = 0; i < nCh2; i++) for (const x of [xL, xR])
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
  return { diaMm: dia, zBehindMm: behind, zAboveMm: zAbove, aWarn, segs, ports, plugs, note: `serpentín §9.2 · ⌀${dia} · prof B ${H} / A ${zAbove != null ? `${Math.round(zAbove)} (libra impresión de ${dep})` : '— SIN LÍNEA'} (Eq 9.22 desde la sup. moldeante) · paso ${pitch} (∈[H,2H], Eq 9.24) · ${nCh2} líneas (esquiva barrenos) · plug ${s.cooling.plug ?? '—'}${aWarn ? ' · ⚠ ' + aWarn : ''}` };
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
  const dia = s.cooling.diaMm, depth = +(dia * 4).toFixed(1), pitch = +(dia * 7).toFixed(1);   // Eq 9.22: H=4D · Eq 9.24: W=1.75H=7D
  const rows: AnalysisRow[] = [
    { grupo: 'Tornillería §12.4', param: 'masa del molde (stack real)', valor: `${b.massKg.toFixed(0)} kg`, ref: `${b.Hmm}×${s.widthMm}×${plateDepth(s)} mm` },
    { grupo: 'Tornillería §12.4', param: 'fuerza peor caso (izaje, n_g=10)', valor: `${(b.forceN / 1000).toFixed(1)} kN`, ref: 'Fig 12.33', ok: true },
    { grupo: 'Tornillería §12.4', param: 'tornillo de sujeción (Ø mín → DIN 912)', valor: `${b.din} (⌀mín ${b.dMinMm.toFixed(1)} mm)`, ref: 'Eq 12.32', ok: true },
    { grupo: 'Enfriamiento §9.2', param: 'línea de agua (plug DME)', valor: `${s.cooling.plug} · ⌀${dia} mm`, ref: '§9.2.4', ok: true },
    { grupo: 'Enfriamiento §9.2', param: 'profundidad a la cavidad H = 4·D (2D<H<5D)', valor: `${depth} mm`, ref: 'Eq 9.22', ok: true },
    { grupo: 'Enfriamiento §9.2', param: 'paso entre líneas W ∈ [H, 2H]', valor: `${pitch} mm`, ref: 'Eq 9.24', ok: true },
  ];
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
      { grupo: 'Colada fría §7', param: 'alimentación', valor: s.feed === 'cold-3placas' ? '3 placas (compuerta automática)' : '2 placas (bebedero + canales)', ref: '§7', ok: true },
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

function ejectorPositions(cx: number, cy: number, fx: number, fy: number, round: boolean, n: number, frame?: { frameMm: number; ribs: number }): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  if (frame && !round && frame.frameMm > 0) return frameEjectorPositions(cx, cy, fx, fy, frame.frameMm, frame.ribs, n);
  if (round) {
    const r = Math.max(5, (fx / 2) * 0.55);
    for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n - Math.PI / 2; pts.push([Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))]); }
  } else {
    // rejilla nx×ny DISTRIBUIDA por TODA la huella (no apiñada al centro): margen
    // 12% del borde → los pines cubren el ~76% de la cara, que es lo que expulsa parejo.
    const nx = Math.max(1, Math.round(Math.sqrt(n))), ny = Math.ceil(n / nx);
    const mx = fx * 0.12, my = fy * 0.12;
    let k = 0;
    for (let r = 0; r < ny && k < n; r++) for (let c = 0; c < nx && k < n; c++, k++) {
      const px = nx === 1 ? cx : cx - fx / 2 + mx + (c * (fx - 2 * mx)) / (nx - 1);
      const py = ny === 1 ? cy : cy - fy / 2 + my + (r * (fy - 2 * my)) / (ny - 1);
      pts.push([Math.round(px), Math.round(py)]);
    }
  }
  return pts;
}

export function standardHoles(s: MoldAssemblySpec, role: PlateRole): PlateHole[] {
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
    const gp = W > 300 ? 32 : W > 200 ? 25 : 20, gi = inset + Math.round(gp / 2) + 4;
    for (const [dx, dy, t] of [[gi, gi, ''], [W - gi, gi, ''], [gi, D - gi, ''], [W - gi - 10, D - gi, ' (desplazado)']])
      holes.push({ x: dx, y: dy, dia: gp, type: `pilar guía${t}` });
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
      for (const cell of cells) for (const [x, y] of ejectorPositions(cell.cx, cell.cy, fx, fy, round, perCav, frame))
        holes.push({ x, y, dia: ejHole, type: `expulsor (${s.ejectors.type})` });
    // HOLGURA de los RETURN PINS (⌀12): bajan del paquete y CRUZAN soporte+B para topar
    // en la cara de A. Ajuste deslizante REAL 0.13mm (fits.ts), no 1mm inventado.
    const rpHole = ejectorPinFit(12).holeDiaMm, rx = 65 + 26, ry = 20 + 26;
    for (const [x, y] of [[rx, ry], [W - rx, ry], [rx, D - ry], [W - rx, D - ry]])
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
      holes.push({ x: cells[0].cx, y: cells[0].cy, dia: Math.ceil(2 * fd.rBaseMm + 0.6), type: 'bebedero (sprue cónico §6.3.1)' });
    } else {
      for (const c of cells) holes.push({ x: c.cx, y: c.cy, dia: 3, type: 'compuerta (gate)' });
    }
  }

  // PLACA EXPULSORA + RETENEDORA: aloja la CABEZA de cada expulsor (barreno de la
  // cabeza) + pines de RETORNO en 4 esquinas (regresan el paquete al cerrar).
  if (role === 'ejector' || role === 'ejector-ret') {
    const cells = cavityGrid(s, D), { fx, fy, round } = cavityFootprint(s);
    const perCav = Math.max(1, Math.round(s.ejectors.count / Math.max(1, cells.length)));
    const frame = s.cavity.frameMm ? { frameMm: s.cavity.frameMm, ribs: s.cavity.ribs ?? 0 } : undefined;
    if (s.ejectors.type !== 'stripper')   // stripper: sin pines → sin alojamientos de cabeza
      for (const cell of cells) for (const [x, y] of ejectorPositions(cell.cx, cell.cy, fx, fy, round, perCav, frame))
        holes.push({ x, y, dia: role === 'ejector' ? s.ejectors.diaMm + 3 : s.ejectors.diaMm + 0.5,
          type: role === 'ejector' ? 'aloj. cabeza de expulsor' : 'pasaje de expulsor' });
    // pines de retorno en las esquinas de la PLACA EXPULSORA real (más angosta que el
    // molde: vive dentro del housing en U, Fig 1.4) — no en las esquinas del molde.
    const rx = 65 + 26, ry = 20 + 26;
    for (const [x, y] of [[rx, ry], [W - rx, ry], [rx, D - ry], [W - rx, D - ry]])
      holes.push({ x, y, dia: 12, type: 'pin de retorno' });
  }

  // BARRENO(S) KO para el vástago expulsor de la máquina. NO puede ir en el eje de
  // la COLADA (para colada caliente el drop baja por el centro): el vástago la
  // embestiría. Si el centro está ocupado por alimentación → DOS KO simétricos
  // flanqueando el centro (patrón estándar de la inyectora), si no, 1 al centro.
  if (role === 'support' || role === 'bottom' || role === 'ejector') {
    const koDia = Math.max(20, Math.round(W * 0.055));
    const feedAtCenter = s.feed === 'hot-runner' || (cavityGrid(s, D).length === 1);
    if (feedAtCenter) {
      const off = Math.max(60, koDia);
      holes.push({ x: Math.round(W / 2 - off), y: Math.round(D / 2), dia: koDia, type: 'barreno KO (vástago expulsor)' });
      holes.push({ x: Math.round(W / 2 + off), y: Math.round(D / 2), dia: koDia, type: 'barreno KO (vástago expulsor)' });
    } else {
      holes.push({ x: Math.round(W / 2), y: Math.round(D / 2), dia: koDia, type: 'barreno KO (vástago expulsor)' });
    }
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


/** Genera el SET completo de planos del molde (ensamble + análisis + placas). */
export function moldDrawingSet(s: MoldAssemblySpec, analysisRows?: AnalysisRow[]): MoldDrawingSet {
  const D = plateDepth(s);
  const pages: DrawingPage[] = [];

  // 1) ENSAMBLE (sección A-A + BOM + notas de análisis)
  pages.push({ name: 'Ensamble', svg: moldAssemblyDrawing(s).svg });

  // 2) HOJA DE ANÁLISIS DE INGENIERÍA (§ + veredicto) + filas CALCULADAS
  //    (tornillería §12.4 + geometría de enfriamiento §9.2) anexadas siempre.
  const allRows = [...(analysisRows ?? []), ...moldEngineeringRows(s)];
  if (allRows.length) pages.push({ name: 'Análisis', svg: analysisSheet(s, allRows) });

  // 3) PLANO INDIVIDUAL de cada placa (planta + tabla de barrenos a cota)
  for (const p of plateDefs(s)) {
    const spec: PlateSpec = {
      code: p.code, name: p.name, material: p.mat,
      wmm: s.widthMm, dmm: D, thickMm: p.thick,
      holes: standardHoles(s, p.role),
      openings: (p.role === 'A' || p.role === 'B') ? cavityOpenings(s, D) : undefined,
      cooling: (p.role === 'A' || p.role === 'B') ? coolingCircuit(s, D) : undefined,
    };
    pages.push({ name: p.name, svg: renderPlateDrawing(spec).svg });
  }
  return { title: s.name, code: s.code ?? 'MLD-001', pages };
}
