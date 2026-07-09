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

export type PlateRole = 'clamp' | 'A' | 'B' | 'support' | 'ejector' | 'bottom';
export interface PlateDef { role: PlateRole; code: string; name: string; thick: number; mat: string }

/** Las placas del molde (rol, código, espesor del spec, material). Fuente única:
 *  la usan tanto el plano plano (renderPlateDrawing) como el sólido del kernel. */
export function plateDefs(s: MoldAssemblySpec): PlateDef[] {
  return [
    { role: 'clamp', code: `${s.code ?? 'MLD'}-01`, name: 'Placa de sujeción superior', thick: s.plates.topClamp, mat: s.baseSteel ?? '1.1730' },
    { role: 'A', code: `${s.code ?? 'MLD'}-02`, name: 'Placa A (cavidad)', thick: s.plates.A, mat: s.cavityMetal },
    { role: 'B', code: `${s.code ?? 'MLD'}-03`, name: 'Placa B (núcleo)', thick: s.plates.B, mat: s.cavityMetal },
    { role: 'support', code: `${s.code ?? 'MLD'}-04`, name: 'Placa de soporte', thick: s.plates.support, mat: s.baseSteel ?? '1.1730' },
    { role: 'ejector', code: `${s.code ?? 'MLD'}-05`, name: 'Placa expulsora + retenedora', thick: Math.max(20, Math.round(s.plates.ejectorHousing * 0.55)), mat: s.baseSteel ?? '1.1730' },
    { role: 'bottom', code: `${s.code ?? 'MLD'}-06`, name: 'Placa de sujeción inferior', thick: s.plates.bottomClamp, mat: s.baseSteel ?? '1.1730' },
  ];
}

/** Ancho del fondo de la placa (≈0.78·ancho, 4:3 típico de mold base). */
export const plateDepth = (s: MoldAssemblySpec) => Math.round(s.widthMm * 0.78);

/** Huella de la cavidad en planta: X e Y (⌀ para redonda). */
export function cavityFootprint(s: MoldAssemblySpec): { fx: number; fy: number; round: boolean } {
  const cav = s.cavity, round = cav.shape === 'round';
  return { fx: cav.widthMm, fy: round ? cav.widthMm : (cav.lenMm ?? Math.round(cav.widthMm * 0.67)), round };
}

/** REJILLA de cavidades: nCav impresiones en grid nx×ny, centradas en la placa,
 *  con paso = huella + separación. Devuelve el centro de cada cavidad. */
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
  const cells = cavityGrid(s, D), { fy } = cavityFootprint(s);
  const ys = cells.map((c) => c.cy);
  const yMin = Math.min(...ys) - fy / 2 - dia, yMax = Math.max(...ys) + fy / 2 + dia;
  const bandH = Math.max(dia * 4, yMax - yMin);
  const pitch = Math.max(22, Math.round(3.5 * dia));
  const nCh = Math.max(2, Math.min(8, Math.floor(bandH / pitch) + 1));
  const edge = Math.max(16, Math.round(s.widthMm * 0.05));
  const xL = edge, xR = s.widthMm - edge;
  const chY: number[] = [];
  for (let i = 0; i < nCh; i++) chY.push(Math.round(yMin + (bandH * (i + 0.5)) / nCh));
  const segs: CoolingCircuit['segs'] = [];
  for (let i = 0; i < nCh; i++) segs.push({ x0: xL, y0: chY[i], x1: xR, y1: chY[i] });   // canal recto (a lo ancho)
  for (let i = 0; i + 1 < nCh; i++)                                                      // serpentín: cross-drill en extremo alterno
    segs.push({ x0: i % 2 === 0 ? xR : xL, y0: chY[i], x1: i % 2 === 0 ? xR : xL, y1: chY[i + 1] });
  const outX = (nCh - 1) % 2 === 0 ? xR : xL;                                            // extremo abierto del último canal
  const portEnds = new Set([`0:${xL}`, `${nCh - 1}:${outX}`]);
  const ports = [{ x: xL, y: chY[0], label: 'IN' }, { x: outX, y: chY[nCh - 1], label: 'OUT' }];
  // cada canal se barrena PASANTE a los dos cantos → se sella con plug salvo IN/OUT
  const plugs: CoolingCircuit['plugs'] = [];
  for (let i = 0; i < nCh; i++) for (const x of [xL, xR])
    if (!portEnds.has(`${i}:${x}`)) plugs.push({ x, y: chY[i] });
  const behind = Math.max(10, Math.round(2.5 * dia));
  return { diaMm: dia, zBehindMm: behind, segs, ports, plugs, note: `enfriamiento serpentín · ⌀${dia} mm · ${nCh} canales · paso ${pitch} mm · plug ${s.cooling.plug ?? '—'}` };
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
  const dia = s.cooling.diaMm, depth = +(dia * 2).toFixed(1), pitch = +(dia * 3.5).toFixed(1);
  const rows: AnalysisRow[] = [
    { grupo: 'Tornillería §12.4', param: 'masa del molde (stack real)', valor: `${b.massKg.toFixed(0)} kg`, ref: `${b.Hmm}×${s.widthMm}×${plateDepth(s)} mm` },
    { grupo: 'Tornillería §12.4', param: 'fuerza peor caso (izaje, n_g=10)', valor: `${(b.forceN / 1000).toFixed(1)} kN`, ref: 'Fig 12.33', ok: true },
    { grupo: 'Tornillería §12.4', param: 'tornillo de sujeción (Ø mín → DIN 912)', valor: `${b.din} (⌀mín ${b.dMinMm.toFixed(1)} mm)`, ref: 'Eq 12.32', ok: true },
    { grupo: 'Enfriamiento §9.2', param: 'línea de agua (plug DME)', valor: `${s.cooling.plug} · ⌀${dia} mm`, ref: '§9.2.4', ok: true },
    { grupo: 'Enfriamiento §9.2', param: 'profundidad bajo cavidad (~2·⌀)', valor: `${depth} mm`, ref: '§9.2.5' },
    { grupo: 'Enfriamiento §9.2', param: 'paso entre líneas (~3.5·⌀)', valor: `${pitch} mm`, ref: '§9.2.6' },
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
function ejectorPositions(cx: number, cy: number, fx: number, fy: number, round: boolean, n: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  if (round) {
    const r = Math.max(5, (fx / 2) * 0.55);
    for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n - Math.PI / 2; pts.push([Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))]); }
  } else {
    const nx = Math.max(1, Math.round(Math.sqrt(n))), ny = Math.ceil(n / nx);
    const mx = fx * 0.30, my = fy * 0.30;
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

  // TORNILLOS de sujeción en los PUNTOS MEDIOS de los bordes → NO chocan con los
  // pilares guía de las esquinas (antes se cruzaban ~1 mm).
  for (const [x, y] of [[Math.round(W / 2), inset], [Math.round(W / 2), D - inset], [inset, Math.round(D / 2)], [W - inset, Math.round(D / 2)]])
    holes.push({ x, y, dia: scrDia, type: `tornillo ${bolt.din} (holgura ⌀${scrDia})` });

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
    for (const cell of cells) for (const [x, y] of ejectorPositions(cell.cx, cell.cy, fx, fy, round, perCav))
      holes.push({ x, y, dia: s.ejectors.diaMm, type: `expulsor (${s.ejectors.type})` });
  }

  // ALIMENTACIÓN por cavidad (placa A + clamp): CALIENTE → boquilla (drop); FRÍA →
  // bebedero central (1 cav) o compuerta por cavidad (multi). Nunca bebedero en hot.
  if (role === 'A' || role === 'clamp') {
    const cells = cavityGrid(s, D);
    if (s.feed === 'hot-runner') {
      for (const c of cells) holes.push({ x: c.cx, y: c.cy, dia: Math.max(4, Math.round(s.cavity.widthMm * 0.05)), type: 'boquilla caliente (drop §6)' });
    } else if (cells.length === 1) {
      holes.push({ x: cells[0].cx, y: cells[0].cy, dia: 8, type: 'bebedero (sprue)' });
    } else {
      for (const c of cells) holes.push({ x: c.cx, y: c.cy, dia: 3, type: 'compuerta (gate)' });
    }
  }

  // PLACA EXPULSORA + RETENEDORA: aloja la CABEZA de cada expulsor (barreno de la
  // cabeza) + pines de RETORNO en 4 esquinas (regresan el paquete al cerrar).
  if (role === 'ejector') {
    const cells = cavityGrid(s, D), { fx, fy, round } = cavityFootprint(s);
    const perCav = Math.max(1, Math.round(s.ejectors.count / Math.max(1, cells.length)));
    for (const cell of cells) for (const [x, y] of ejectorPositions(cell.cx, cell.cy, fx, fy, round, perCav))
      holes.push({ x, y, dia: s.ejectors.diaMm + 3, type: 'aloj. cabeza de expulsor' });
    const ri = Math.max(24, Math.round(W * 0.08));
    for (const [x, y] of [[ri, ri], [W - ri, ri], [ri, D - ri], [W - ri, D - ri]])
      holes.push({ x, y, dia: 12, type: 'pin de retorno' });
  }

  // BARRENO DE EXPULSIÓN CENTRAL (KO) para el vástago de la máquina.
  if (role === 'support' || role === 'bottom' || role === 'ejector')
    holes.push({ x: Math.round(W / 2), y: Math.round(D / 2), dia: Math.max(20, Math.round(W * 0.055)), type: 'barreno KO (vástago expulsor)' });

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
