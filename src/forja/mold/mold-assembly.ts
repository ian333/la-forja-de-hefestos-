/**
 * PLANO DE ENSAMBLE DEL MOLDE — cada pieza calculada es una pieza mecánica.
 * ==============================================================================
 * Toma las dimensiones RESUELTAS por los módulos (placas por deflexión, core por
 * §12.3, líneas de agua por §9.2, expulsores por §11.3) y arma la SECCIÓN de
 * ensamble + la LISTA DE MATERIALES (BOM) del molde completo, cada componente
 * trazable a su análisis. Usa el motor de planos (renderAssemblySection) con
 * cajetín ISO 7200. PURO: node-testeable (SVG string).
 */

import { renderAssemblySection, type StackComp, type AssemblyDrawing } from './mold-drawings';

export interface MoldAssemblySpec {
  name: string; code?: string;
  widthMm: number;                                  // ancho de la base (X en la sección)
  plates: { bottomClamp: number; ejectorHousing: number; support: number; B: number; A: number; topClamp: number };
  supportPillars?: number;
  cavity: { widthMm: number; depthMm: number };     // bolsa de cavidad (en la partición)
  cooling: { diaMm: number; plug?: string; insetMm: number };  // líneas de agua
  ejectors: { type: 'pin' | 'blade' | 'sleeve' | 'stripper'; diaMm: number; count: number };
  core: { diaMm?: number; widthMm?: number; material: string };   // ⌀ (cup) o ancho de bloque (marco/bezel)
  cavityMetal: string; baseSteel?: string;
  machine?: string; clampTons?: number;
  // MOVIMIENTO lateral (§11.3.6-8): undercut que exige corredera/core-pull.
  sideAction?: { aProjMm2: number; pMeltMPa: number; strokeMm: number; note?: string };
}

/** Construye la SECCIÓN de ensamble (plano medio) apilando las placas y colocando
 *  core, cavidad, pieza, líneas de agua y expulsores en sus cotas resueltas. */
export function buildMoldStack(s: MoldAssemblySpec): { comps: StackComp[]; partings: Array<{ z: number; label: string }> } {
  const W = s.widthMm, hw = W / 2;
  const p = s.plates;
  // cotas Z (de abajo hacia arriba)
  const z = { bc0: 0, bc1: p.bottomClamp };
  const eh0 = z.bc1, eh1 = eh0 + p.ejectorHousing;
  const su0 = eh1, su1 = su0 + p.support;
  const b0 = su1, b1 = b0 + p.B;
  const a0 = b1, a1 = a0 + p.A;
  const tc0 = a1, tc1 = tc0 + p.topClamp;
  const parting = b1;                                // partición A|B
  const rail = Math.min(35, W * 0.16);               // ancho de riel del housing

  const comps: StackComp[] = [];
  let id = 1;
  const full = (name: string, z0: number, z1: number, material: string): StackComp =>
    ({ id: id++, name, qty: 1, material, rects: [{ x0: -hw, z0, x1: hw, z1 }] });

  comps.push(full('Placa de sujeción inferior', z.bc0, z.bc1, s.baseSteel ?? '1730 (C45)'));
  // housing del expulsor: 2 rieles + paquete expulsor flotante en medio
  comps.push({ id: id++, name: 'Rieles (spacer)', qty: 2, material: s.baseSteel ?? '1730',
    rects: [{ x0: -hw, z0: eh0, x1: -hw + rail, z1: eh1 }, { x0: hw - rail, z0: eh0, x1: hw, z1: eh1 }] });
  comps.push({ id: id++, name: 'Placa expulsora + retenedora', qty: 1, material: s.baseSteel ?? '1730',
    rects: [{ x0: -hw + rail + 4, z0: eh0 + 4, x1: hw - rail - 4, z1: eh0 + p.ejectorHousing * 0.55 }] });
  comps.push(full('Placa de soporte', su0, su1, s.baseSteel ?? '1730'));
  comps.push(full('Placa B (núcleo)', b0, b1, s.cavityMetal));
  comps.push(full('Placa A (cavidad)', a0, a1, s.cavityMetal));
  comps.push(full('Placa de sujeción superior', tc0, tc1, s.baseSteel ?? '1730'));

  // core insert (sube de la placa B a la partición): ⌀ para pieza redonda (cup)
  // o bloque de ancho dado para marco (bezel). El marco deja la abertura central.
  const cr = (s.core.widthMm ?? s.core.diaMm ?? 0) / 2;
  const coreName = s.core.widthMm ? 'Inserto de núcleo (marco)' : 'Inserto de núcleo (core)';
  comps.push({ id: id++, name: coreName, qty: 1, material: s.core.material,
    rects: [{ x0: -cr, z0: su1, x1: cr, z1: parting }] });
  // cavidad insert (bolsa en A) + la PIEZA moldeada (plástico, sólido)
  const cvw = s.cavity.widthMm / 2;
  comps.push({ id: id++, name: 'PIEZA moldeada (plástico)', qty: 1, material: 'ABS', solid: true,
    rects: [{ x0: -cvw, z0: parting, x1: cvw, z1: parting + s.cavity.depthMm }] });

  // líneas de enfriamiento (círculos cortados) en A y en B, a ±inset
  const water: StackComp = { id: id++, name: `Líneas de agua ${s.cooling.plug ?? ''}`.trim(), qty: 4, material: `plug ⌀${s.cooling.diaMm}mm`, rects: [], circles: [
    { x: -s.cooling.insetMm, z: parting + 16, dia: s.cooling.diaMm, note: '⌀' + s.cooling.diaMm },
    { x: s.cooling.insetMm, z: parting + 16, dia: s.cooling.diaMm },
    { x: -s.cooling.insetMm, z: parting - 16, dia: s.cooling.diaMm },
    { x: s.cooling.insetMm, z: parting - 16, dia: s.cooling.diaMm },
  ] };
  comps.push(water);

  // expulsores (suben del paquete expulsor a la partición)
  const er = s.ejectors.diaMm / 2, exs = [-W * 0.19, 0, W * 0.19];
  comps.push({ id: id++, name: `Expulsor (${s.ejectors.type}) ⌀${s.ejectors.diaMm}`, qty: s.ejectors.count, material: '1.2842 templado',
    rects: exs.map((x) => ({ x0: x - er, z0: eh0 + p.ejectorHousing * 0.55, x1: x + er, z1: parting })) });

  // MOVIMIENTO lateral (§11.3.6-8): corredera + talón + perno inclinado (angle pin)
  // en el costado +X, a la altura de la pieza. El perno (fijo al lado A) cama la
  // corredera hacia AFUERA al abrir el molde: por eso su punta baja hacia +X.
  if (s.sideAction) {
    const cvw2 = s.cavity.widthMm / 2, depth = s.cavity.depthMm;
    const slideLen = Math.min(Math.max(28, (hw - cvw2) * 0.5), 60);
    const sx0 = cvw2, sx1 = cvw2 + slideLen, sz0 = parting, sz1 = parting + depth + 4;
    const phi = (20 * Math.PI) / 180, tan = Math.tan(phi);
    const zBot = parting + 4, zTop = tc0 + p.topClamp * 0.7;
    const xBot = cvw2 + slideLen * 0.6, xTop = xBot - (zTop - zBot) * tan;   // arriba más adentro, punta afuera
    comps.push({ id: id++, name: 'Corredera (slide)', qty: 1, material: '1.2312 templado', tint: '#d7e6f7',
      rects: [{ x0: sx0, z0: sz0, x1: sx1, z1: sz1 }],
      lines: [{ x0: xTop, z0: zTop, x1: xBot, z1: zBot, widthMm: 12, note: 'angle pin 20°' }] });
    comps.push({ id: id++, name: 'Talón + gib (heel block)', qty: 1, material: '1.2312 templado', tint: '#e9eff7',
      rects: [{ x0: cvw2 + slideLen * 0.35, z0: sz1, x1: Math.min(sx1 + 10, hw), z1: a1 }] });
  }

  const partings = [{ z: parting, label: 'LÍNEA DE PARTICIÓN A|B' }];
  return { comps, partings };
}

/** Genera el PLANO de ensamble (SVG A3, sección + BOM + notas de análisis). */
export function moldAssemblyDrawing(s: MoldAssemblySpec): AssemblyDrawing {
  const { comps, partings } = buildMoldStack(s);
  const notes = [
    `Molde de inyección · base ${s.widthMm} mm · máquina ${s.machine ?? '—'}${s.clampTons ? ` (${s.clampTons.toFixed(0)} t)` : ''}`,
    `Placa de soporte ${s.plates.support} mm${s.supportPillars ? ` + ${s.supportPillars} pilares` : ''} (deflexión < venteo, §12.1)`,
    `Núcleo ${s.core.widthMm ? `${s.core.widthMm}mm (marco)` : `⌀${s.core.diaMm}`} ${s.core.material} (hoop/deflexión §12.3) · agua ${s.cooling.plug ?? ''} ⌀${s.cooling.diaMm} (§9.2)`,
    `Expulsión ${s.ejectors.count}× ${s.ejectors.type} ⌀${s.ejectors.diaMm} (§11.3)`,
  ];
  return renderAssemblySection(comps, {
    code: s.code ?? 'MLD-001', name: s.name, extra: 'ENSAMBLE · MOLDE DE INYECCIÓN',
    notes, partings, sectionLabel: 'SECCIÓN A-A (plano medio)',
  });
}
