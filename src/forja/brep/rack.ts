/**
 * ⚒️ La Forja — CREMALLERA (rack) — el engrane de radio infinito
 * ==============================================================
 * Cuando el radio de un engrane tiende a infinito, la involuta tiende a una
 * RECTA: los flancos de una cremallera son líneas a exactamente el ángulo de
 * presión (20°, ISO 53). Por eso el par piñón-cremallera engrana perfecto: la
 * recta es la involuta límite. Convierte rotación ↔ traslación (dirección,
 * elevadores, CNC de banda).
 *
 * Geometría (ISO 53, perfil básico):
 *   paso p = π·m          addendum a = m        dedendum b = 1.25·m
 *   espesor del diente EN LA LÍNEA DE PASO = p/2 (igual al hueco)
 *   flancos a α = 20° de la vertical
 *   cresta  w_top  = p/2 − 2·a·tanα      raíz  w_root = p/2 + 2·b·tanα
 *
 * v = m·Z_piñón·ω/2 (velocidad de la cremallera por vuelta del piñón:
 * avance por vuelta = p·Z = π·m·Z, el perímetro primitivo del piñón).
 */

import type { OC, Shape, Pt2 } from './occt';
import { extrudePolygon } from './occt';

export const RACK_PRESSURE_DEG = 20;

export interface RackSpec { m: number; teeth: number; width: number; baseH?: number }

/** Perfil 2D cerrado (CCW) de la cremallera: banda base + Z dientes trapezoidales. */
export function rackProfile(m: number, teeth: number, baseH = 1.5 * m): Pt2[] {
  const p = Math.PI * m;
  const a = m, b = 1.25 * m;
  const tanA = Math.tan((RACK_PRESSURE_DEG * Math.PI) / 180);
  const hT = a + b;                       // altura total del diente (2.25·m)
  const wTop = p / 2 - 2 * a * tanA;      // cresta
  const wRoot = p / 2 + 2 * b * tanA;     // raíz
  const L = teeth * p;
  // CCW: piso izquierda→derecha, sube el costado derecho, y la cara dentada
  // se recorre derecha→izquierda (cada diente: raíz→cresta→cresta→raíz).
  const pts: Pt2[] = [
    { x: 0, y: -baseH }, { x: L, y: -baseH }, { x: L, y: 0 },
  ];
  for (let k = teeth - 1; k >= 0; k--) {
    const c = k * p + p / 2;              // centro del diente k
    pts.push({ x: c + wRoot / 2, y: 0 });
    pts.push({ x: c + wTop / 2, y: hT });
    pts.push({ x: c - wTop / 2, y: hT });
    pts.push({ x: c - wRoot / 2, y: 0 });
  }
  pts.push({ x: 0, y: 0 });
  return pts;
}

/** Área analítica del perfil: banda + Z trapecios. Para verificar el kernel. */
export function rackArea(m: number, teeth: number, baseH = 1.5 * m): number {
  const p = Math.PI * m;
  const a = m, b = 1.25 * m;
  const tanA = Math.tan((RACK_PRESSURE_DEG * Math.PI) / 180);
  const wTop = p / 2 - 2 * a * tanA;
  const wRoot = p / 2 + 2 * b * tanA;
  return teeth * p * baseH + teeth * ((a + b) * (wTop + wRoot)) / 2;
}

/** Área por fórmula del polígono (shoelace) — cross-check independiente. */
export function shoelace(pts: Pt2[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[(i + 1) % pts.length];
    s += pts[i].x * q.y - q.x * pts[i].y;
  }
  return Math.abs(s) / 2;
}

/** Cremallera SÓLIDA: el perfil extruido `width` mm (ancho de cara). */
export function makeRack(oc: OC, spec: RackSpec): Shape {
  return extrudePolygon(oc, rackProfile(spec.m, spec.teeth, spec.baseH), spec.width);
}
