/**
 * CAM · BORE (fresado helicoidal de barreno grande) — libro Cimo cap 10.
 *
 * El libro: el hueco central es el piloto de una rosca M36×4 → ⌀32. "With such a
 * diameter, it is impossible to use a drill bit; therefore, we have to create a
 * milling operation instead" → comando Bore (2D Operations): la fresa (la MISMA
 * ⌀... del careado si cabe) baja en HÉLICE pegada a la pared del barreno
 * (radio de hélice = R − r_fresa) con paso fino, y remata con un círculo
 * COMPLETO a fondo plano (limpia el escalón que deja la hélice). Todo en
 * G2 helicoidal (CW = climb en pared interna con M3).
 *
 * También exporta la ENTRADA HELICOIDAL genérica (cap 10: "helical movements" —
 * el plunge del cap 9 es la opción de novato): hélice de radio chico que baja
 * a zCut para que la ranura/cajera no entre a pico.
 */
import type { FacingTool, ToolpathSegment } from './facing';

export interface BoreHole {
  cx: number; cy: number;
  radius: number;  // radio del barreno TERMINADO
  zTop: number;    // cara de entrada
  zBottom: number; // fondo (pasante: cara inferior)
}

export interface BoreParams {
  pitch: number;   // bajada por vuelta de la hélice (mm/rev; típico 1-3)
  safeZ: number;
}

/** Hélice de bajada como pares de semicírculos G2 con Δz repartido por barrido. */
function helixDown(
  segs: ToolpathSegment[], cx: number, cy: number, r: number,
  z0: number, z1: number, pitch: number,
): [number, number, number] {
  // arranque en el este (cx+r, cy); cada semicírculo baja pitch/2
  let z = z0, east = true;
  while (z > z1 + 1e-9) {
    const zn = Math.max(z1, z - pitch / 2);
    const from: [number, number, number] = [east ? cx + r : cx - r, cy, z];
    const to: [number, number, number] = [east ? cx - r : cx + r, cy, zn];
    segs.push({ kind: 'cut', from, to, arc: { cx, cy, cw: true } });
    z = zn; east = !east;
  }
  return [east ? cx + r : cx - r, cy, z1];
}

export function generateBoreToolpath(
  hole: BoreHole, tool: FacingTool, p: BoreParams,
): ToolpathSegment[] {
  const r = tool.diameter / 2;
  const rH = hole.radius - r;              // hélice pegada a la pared
  if (rH < 0.05) return [];                // la fresa no cabe (o es taladro, no bore)
  const zSafe = hole.zTop + p.safeZ;
  const { cx, cy } = hole;
  const segs: ToolpathSegment[] = [];
  const start: [number, number, number] = [cx + rH, cy, zSafe];
  segs.push({ kind: 'rapid', from: start, to: start });
  segs.push({ kind: 'plunge', from: start, to: [cx + rH, cy, hole.zTop] }); // acercamiento en aire
  const end = helixDown(segs, cx, cy, rH, hole.zTop, hole.zBottom, p.pitch);
  // vuelta COMPLETA a fondo plano: borra el escalón helicoidal de la última vuelta
  const west: [number, number, number] = [2 * cx - end[0], cy, hole.zBottom];
  segs.push({ kind: 'cut', from: end, to: west, arc: { cx, cy, cw: true } });
  segs.push({ kind: 'cut', from: west, to: end, arc: { cx, cy, cw: true } });
  segs.push({ kind: 'rapid', from: end, to: [end[0], end[1], zSafe] });
  return segs;
}

/** Entrada helicoidal genérica para cajeras (sustituye el plunge del cap 9). */
export function helicalEntry(
  cx: number, cy: number, rHelix: number, zTop: number, zCut: number, pitch: number,
): ToolpathSegment[] {
  const segs: ToolpathSegment[] = [];
  const end = helixDown(segs, cx, cy, rHelix, zTop, zCut, pitch);
  // cerrar al centro para quedar donde arrancaba el plunge clásico
  segs.push({ kind: 'cut', from: end, to: [cx, cy, zCut] });
  return segs;
}
