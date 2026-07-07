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

/** Genera el SET completo de planos del molde (ensamble + placas individuales). */
export function moldDrawingSet(s: MoldAssemblySpec): MoldDrawingSet {
  const D = Math.round(s.widthMm * 0.78);
  const pages: DrawingPage[] = [];

  // 1) ENSAMBLE (sección A-A + BOM + notas de análisis)
  pages.push({ name: 'Ensamble', svg: moldAssemblyDrawing(s).svg });

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
