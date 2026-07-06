/**
 * CAM · RANURA CIRCULAR (shoulder milling / 2D Adaptive Clearing) — libro Cimo cap 9.
 *
 * El libro maquina la ranura circular ⌀80×10mm al centro de la pieza con la MISMA
 * fresa ⌀40 del careado (ahorra cambio de herramienta), parámetros calculados A MANO:
 * n = 7878 RPM, vf = 7090 mm/min (fz 0.15 × z6 × n), carga radial óptima a_e = ⌀/3
 * = 13.33 mm, pasada axial ÚNICA de 10 mm (a_p máx de la fresa), SIEMPRE climb.
 *
 * Trayectoria: plunge al centro (la entrada helicoidal la cubre el cap 10) →
 * anillos concéntricos separados ≤ a_e, cada anillo en 2 semicírculos G2 (CW visto
 * desde +Z = CLIMB en pared interna con M3: el material queda a la IZQUIERDA del
 * avance) → el último anillo cae EXACTO en la pared (R − r_fresa).
 */
import type { FacingTool, ToolpathSegment } from './facing';
import { helicalEntry } from './bore';

export interface PocketCircle {
  cx: number; cy: number; // centro de la ranura (mm)
  radius: number;         // radio de la RANURA (pared terminada)
  zTop: number;           // cara superior del sólido (por donde entra la fresa)
  zBottom: number;        // fondo de la ranura
}

export interface PocketParams {
  optimalLoad: number;   // carga radial óptima a_e (libro: ⌀/3 = 13.33)
  safeZ: number;         // altura segura sobre zTop
  helicalPitch?: number; // cap 10: entrada en HÉLICE (mm/rev) en vez de plunge a pico
}

/** Anillos concéntricos + entrada por plunge. [] si la fresa no cabe en la ranura. */
export function generateCircularPocketToolpath(
  pocket: PocketCircle, tool: FacingTool, p: PocketParams,
): ToolpathSegment[] {
  const r = tool.diameter / 2;
  const rMax = pocket.radius - r;        // centro de fresa pegado a la pared
  if (rMax < -1e-9) return [];           // fresa más grande que la ranura
  const zCut = pocket.zBottom;           // pasada axial única (decisión del libro)
  const zSafe = pocket.zTop + p.safeZ;
  const { cx, cy } = pocket;
  const segs: ToolpathSegment[] = [];

  if (p.helicalPitch && rMax > 0.5) {
    // ENTRADA HELICOIDAL (cap 10): bajar en hélice de radio chico (≤ r y ≤ rMax)
    // — la fresa nunca entra a pico, la viruta evacúa y el filo no se quema.
    const rH = Math.min(r * 0.5, rMax);
    segs.push({ kind: 'rapid', from: [cx + rH, cy, zSafe], to: [cx + rH, cy, zSafe] });
    segs.push({ kind: 'plunge', from: [cx + rH, cy, zSafe], to: [cx + rH, cy, pocket.zTop] });
    segs.push(...helicalEntry(cx, cy, rH, pocket.zTop, zCut, p.helicalPitch));
  } else {
    segs.push({ kind: 'rapid', from: [cx, cy, zSafe], to: [cx, cy, zSafe] });
    segs.push({ kind: 'plunge', from: [cx, cy, zSafe], to: [cx, cy, zCut] });
  }

  // radios de anillo: k·a_e recortado a rMax; el último SIEMPRE es la pared exacta
  const rings: number[] = [];
  for (let rk = Math.min(p.optimalLoad, rMax); ; rk += p.optimalLoad) {
    if (rk >= rMax - 1e-9) { rings.push(rMax); break; }
    rings.push(rk);
  }

  let prev: [number, number, number] = [cx, cy, zCut];
  for (const rk of rings) {
    if (rk < 1e-9) continue;             // rMax=0: la fresa YA barrió todo con el plunge
    const east: [number, number, number] = [cx + rk, cy, zCut];
    const west: [number, number, number] = [cx - rk, cy, zCut];
    segs.push({ kind: 'cut', from: prev, to: east });                          // salida radial (engrane ≤ a_e)
    segs.push({ kind: 'cut', from: east, to: west, arc: { cx, cy, cw: true } }); // semicírculo CW (climb)
    segs.push({ kind: 'cut', from: west, to: east, arc: { cx, cy, cw: true } });
    prev = east;
  }
  segs.push({ kind: 'rapid', from: prev, to: [prev[0], prev[1], zSafe] });
  return segs;
}
