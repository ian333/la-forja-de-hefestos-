/**
 * EL GENERADOR ESCRIBE RECETA, NO MALLA — el vuelco que pidió el user ("debe haber
 * libertad para editarlo yo como usuario").
 *
 * Antes: buildMoldParts llamaba primitivas del kernel y escupía triángulos + un log de
 * texto. El molde nacía SIN historia porque se saltaba el flujo humano.
 * Ahora: la Máquina redacta la MISMA secuencia que haría una persona en el Part Studio
 * (croquizar el contorno → extruir el espesor → barrenar → abrir el asiento), y la
 * receta es el entregable. `rebuild()` la vuelve sólido; el usuario edita cualquier
 * paso y se re-evalúa.
 *
 * Cada paso lleva `why` con su cita del libro: si el usuario cambia una cota, merece
 * saber qué regla está tocando.
 */
import type { MoldAssemblySpec } from './mold-assembly';
import { plateDefs, plateDepth, standardHoles } from './mold-drawing-set';
import { plateStackZ } from './mold-plano-set';
import { insertDims } from './mold-drawing-set';
import { fastenerPlan } from './mold-fasteners';
import type { Component, Feature } from './timeline';

/** RECETA de una placa: lo que un humano teclearía, paso por paso. */
export function plateRecipe(spec: MoldAssemblySpec, role: 'A' | 'B'): Component {
  const defs = plateDefs(spec);
  const def = defs.find((d) => d.role === role);
  const thick = def?.thick ?? 56;
  const z = plateStackZ(spec)[role] ?? 0;
  const W = spec.widthMm, D = plateDepth(spec);
  const plan = fastenerPlan(spec, { half: role === 'A' ? 'cavity' : 'core' });
  const ins = insertDims(spec);

  const tl: Feature[] = [
    { id: 'sk-contorno', type: 'sketch-rect', label: `Croquis · contorno ${W}×${D}`,
      params: { cx: W / 2, cy: D / 2, w: W, h: D, z },
      why: 'Kazmer cap.4: la placa toma el tamaño del mold base estándar (Eq 4.1-4.3)' },
    { id: 'ex-espesor', type: 'extrude', label: `Extruir · espesor ${thick} mm`,
      params: { distance: thick, op: 'new' },
      why: role === 'A'
        ? '§9.2.5: el espesor de la cavidad lo manda el enfriamiento (la línea de agua debe librar la impresión)'
        : '§12.1: el espesor del núcleo lo manda la deflexión bajo presión de fundido' },
  ];

  // barrenos de tornillo — el Ø sale del ESTUDIO (§12.4), no de una heurística
  const screws = standardHoles(spec, role === 'A' ? 'clamp' : 'bottom').filter((h) => /tornillo/.test(h.type));
  if (screws.length) {
    tl.push({ id: 'br-tornillos', type: 'holes',
      label: `Barrenos · ${screws.length}× tornillo ⌀${plan.tapDrillMm} (${plan.desig})`,
      params: { at: screws.map((h) => ({ x: h.x, y: h.y })), dia: plan.tapDrillMm, zTop: z + thick, depth: thick, through: false },
      why: `§12.4 Fig 12.33: ${plan.desig} porque un solo tornillo debe aguantar ${plan.perBoltKN} kN al izar (n_g=10)` });
  }

  // asiento del inserto (la bolsa donde entra el tallado)
  const seatW = role === 'A' ? ins.ifx : ins.ifx, seatH = role === 'A' ? ins.ify : ins.ify;
  const seatDepth = role === 'A' ? ins.Hc : ins.Hk;
  if (seatW > 0 && seatDepth > 0) {
    tl.push({ id: 'bolsa-inserto', type: 'pocket',
      label: `Bolsa · asiento del inserto ${Math.round(seatW)}×${Math.round(seatH)}×${Math.round(seatDepth)}`,
      params: { cx: W / 2, cy: D / 2, w: seatW, h: seatH, z: role === 'A' ? z : z + thick - seatDepth, depth: seatDepth },
      why: '§4.2: el inserto se maquina aparte y se asienta en la placa (acero caro solo donde hay figura)' });
  }

  return { name: `Placa ${role} (${role === 'A' ? 'cavidad' : 'núcleo'})`, role,
    material: role === 'A' ? (spec.cavityMetal ?? 'AISI P20') : (spec.core?.material ?? 'AISI P20'), timeline: tl };
}

/** la receta COMPLETA del molde (por ahora las dos placas moldeantes). */
export function moldRecipe(spec: MoldAssemblySpec): Component[] {
  return [plateRecipe(spec, 'A'), plateRecipe(spec, 'B')];
}
