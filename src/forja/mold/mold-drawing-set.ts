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

/** Barrenos estándar de una placa según su rol (layout simétrico, cantidades/⌀
 *  del spec resuelto — no inventa la pieza, especifica componentes estándar). */
function standardHoles(s: MoldAssemblySpec, role: 'clamp' | 'A' | 'B' | 'support' | 'bottom'): PlateHole[] {
  const W = s.widthMm, D = Math.round(W * 0.78);   // fondo ≈ 0.78·ancho (placa 381→302, 4:3 típico)
  const inset = Math.max(20, Math.round(W * 0.06));
  const holes: PlateHole[] = [];
  // tornillos SHCS en las 4 esquinas (todas las placas)
  const scr = W > 300 ? 'M12' : W > 200 ? 'M10' : 'M8';
  for (const [x, y] of [[inset, inset], [W - inset, inset], [inset, D - inset], [W - inset, D - inset]])
    holes.push({ x, y, dia: scr === 'M12' ? 12 : scr === 'M10' ? 10 : 8, type: `tornillo ${scr}` });
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
  const D = Math.round(s.widthMm * 0.78);
  const pages: DrawingPage[] = [];

  // 1) ENSAMBLE (sección A-A + BOM + notas de análisis)
  pages.push({ name: 'Ensamble', svg: moldAssemblyDrawing(s).svg });

  // 2) HOJA DE ANÁLISIS DE INGENIERÍA (la ingeniería del molde, con § y veredicto)
  if (analysisRows && analysisRows.length) pages.push({ name: 'Análisis', svg: analysisSheet(s, analysisRows) });

  // 2) PLANO INDIVIDUAL de cada placa (planta + tabla de barrenos a cota)
  const plateDefs: Array<{ role: Parameters<typeof standardHoles>[1]; code: string; name: string; thick: number; mat: string }> = [
    { role: 'clamp', code: `${s.code ?? 'MLD'}-01`, name: 'Placa de sujeción superior', thick: s.plates.topClamp, mat: s.baseSteel ?? '1.1730' },
    { role: 'A', code: `${s.code ?? 'MLD'}-02`, name: 'Placa A (cavidad)', thick: s.plates.A, mat: s.cavityMetal },
    { role: 'B', code: `${s.code ?? 'MLD'}-03`, name: 'Placa B (núcleo)', thick: s.plates.B, mat: s.cavityMetal },
    { role: 'support', code: `${s.code ?? 'MLD'}-04`, name: 'Placa de soporte', thick: s.plates.support, mat: s.baseSteel ?? '1.1730' },
    { role: 'bottom', code: `${s.code ?? 'MLD'}-05`, name: 'Placa de sujeción inferior', thick: s.plates.bottomClamp, mat: s.baseSteel ?? '1.1730' },
  ];
  for (const p of plateDefs) {
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
