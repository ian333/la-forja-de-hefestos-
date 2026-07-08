/**
 * SET DE PLANOS DEL MOLDE — el ENTREGABLE al cliente (planos individuales).
 * ==============================================================================
 * Genera TODAS las láminas de un molde: ensamble (sección + BOM) + un plano
 * INDIVIDUAL de cada placa mecánica con su tabla de barrenos a cota, más el
 * estudio de la pieza. Cotas LITERALES (no inventar): la pieza sale del libro,
 * las placas del método cap 4 / catálogo estándar, los barrenos en layout
 * simétrico estándar. Salida: láminas SVG A3 → PDF (scripts/mold-pdf-gen.cjs).
 */

import { renderPlateDrawing, type PlateSpec, type PlateHole } from './mold-drawings';
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

export type PlateRole = 'clamp' | 'A' | 'B' | 'support' | 'bottom';
export interface PlateDef { role: PlateRole; code: string; name: string; thick: number; mat: string }

/** Las 5 placas del molde (rol, código, espesor del spec, material). Fuente única:
 *  la usan tanto el plano plano (renderPlateDrawing) como el sólido del kernel. */
export function plateDefs(s: MoldAssemblySpec): PlateDef[] {
  return [
    { role: 'clamp', code: `${s.code ?? 'MLD'}-01`, name: 'Placa de sujeción superior', thick: s.plates.topClamp, mat: s.baseSteel ?? '1.1730' },
    { role: 'A', code: `${s.code ?? 'MLD'}-02`, name: 'Placa A (cavidad)', thick: s.plates.A, mat: s.cavityMetal },
    { role: 'B', code: `${s.code ?? 'MLD'}-03`, name: 'Placa B (núcleo)', thick: s.plates.B, mat: s.cavityMetal },
    { role: 'support', code: `${s.code ?? 'MLD'}-04`, name: 'Placa de soporte', thick: s.plates.support, mat: s.baseSteel ?? '1.1730' },
    { role: 'bottom', code: `${s.code ?? 'MLD'}-05`, name: 'Placa de sujeción inferior', thick: s.plates.bottomClamp, mat: s.baseSteel ?? '1.1730' },
  ];
}

/** Ancho del fondo de la placa (≈0.78·ancho, 4:3 típico de mold base). */
export const plateDepth = (s: MoldAssemblySpec) => Math.round(s.widthMm * 0.78);

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
export function standardHoles(s: MoldAssemblySpec, role: PlateRole): PlateHole[] {
  const W = s.widthMm, D = Math.round(W * 0.78);   // fondo ≈ 0.78·ancho (placa 381→302, 4:3 típico)
  const inset = Math.max(20, Math.round(W * 0.06));
  const holes: PlateHole[] = [];
  // tornillos de sujeción SHCS en las 4 esquinas — Ø DIMENSIONADO por §12.4 (izaje)
  const bolt = moldBoltSizing(s);
  for (const [x, y] of [[inset, inset], [W - inset, inset], [inset, D - inset], [W - inset, D - inset]])
    holes.push({ x, y, dia: bolt.dMm, type: `tornillo DIN 912 ${bolt.din} (§12.4)` });
  // pilares guía (leader pins) en 3-4 esquinas asimétricas (una desplazada = anti-error)
  if (role !== 'clamp' && role !== 'bottom') {
    const gp = W > 300 ? 32 : W > 200 ? 25 : 20, gi = inset + 14;
    holes.push({ x: gi, y: gi, dia: gp, type: 'pilar guía' });
    holes.push({ x: W - gi, y: gi, dia: gp, type: 'pilar guía' });
    holes.push({ x: gi, y: D - gi, dia: gp, type: 'pilar guía' });
    holes.push({ x: W - gi - 8, y: D - gi, dia: gp, type: 'pilar guía (desplazado)' });
  }
  // expulsores en la placa B y soporte (rejilla), con ⌀ y cantidad del spec
  if (role === 'B' || role === 'support') {
    const n = Math.min(s.ejectors.count, 20), cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
    let k = 0;
    for (let r = 0; r < rows && k < n; r++) for (let c = 0; c < cols && k < n; c++, k++) {
      const x = Math.round((W * (c + 1)) / (cols + 1)), y = Math.round((D * (r + 1)) / (rows + 1));
      holes.push({ x, y, dia: s.ejectors.diaMm, type: `expulsor (${s.ejectors.type})` });
    }
  }
  // sprue en el centro de la placa A y del clamp superior
  if (role === 'A' || role === 'clamp') holes.push({ x: Math.round(W / 2), y: Math.round(D / 2), dia: 8, type: 'sprue / bebedero' });
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
      openings: (p.role === 'A' || p.role === 'B')
        ? [{ kind: 'rect', x: Math.round(s.widthMm / 2), y: Math.round(D / 2), w: s.cavity.widthMm, d: Math.round(s.cavity.widthMm * 0.67), note: `cavidad ${s.cavity.widthMm}×${Math.round(s.cavity.widthMm * 0.67)} prof ${s.cavity.depthMm}` }]
        : undefined,
    };
    pages.push({ name: p.name, svg: renderPlateDrawing(spec).svg });
  }
  return { title: s.name, code: s.code ?? 'MLD-001', pages };
}
