/**
 * ⚒️ La Forja — Sketch Engine
 * ============================
 * 2D sketch data model + conversion to 3D SDF primitives via extrusion.
 * Implements the classic CAD workflow: sketch on plane → extrude → solid body.
 */

export type SketchPlane = 'XY' | 'XZ' | 'YZ';

export interface SketchRect {
  kind: 'rect';
  id: string;
  cx: number;     // center x in sketch 2D coords
  cy: number;     // center y in sketch 2D coords
  width: number;
  height: number;
}

export interface SketchCircle {
  kind: 'circle';
  id: string;
  cx: number;
  cy: number;
  radius: number;
}

export type SketchShape = SketchRect | SketchCircle;

// ── Plane metadata ──

export const PLANE_LABELS: Record<SketchPlane, string> = {
  'XY': 'Plano XY (Frente)',
  'XZ': 'Plano XZ (Arriba)',
  'YZ': 'Plano YZ (Lateral)',
};

export const PLANE_COLORS: Record<SketchPlane, string> = {
  'XY': '#4488ff',
  'XZ': '#44ff88',
  'YZ': '#ff4488',
};

export const PLANE_AXES: Record<SketchPlane, [string, string]> = {
  'XY': ['X', 'Y'],
  'XZ': ['X', 'Z'],
  'YZ': ['Y', 'Z'],
};

// ── Extrude: Sketch 2D shape → 3D SDF primitive ──

/**
 * Convert a 2D rectangle sketch + extrude distance → 3D Box parameters.
 * The box starts at the sketch plane (optionally offset along its normal)
 * and extends along the plane normal by `distance`.
 */
export function extrudeRect(
  rect: SketchRect,
  plane: SketchPlane,
  distance: number,
  offset = 0,
): { type: 'box'; position: [number, number, number]; rotation: [number, number, number]; params: Record<string, number> } {
  let position: [number, number, number];
  let params: Record<string, number>;
  const rotation: [number, number, number] = [0, 0, 0];

  switch (plane) {
    case 'XY': // sketch X→worldX, sketch Y→worldY, extrude along +Z
      position = [rect.cx, rect.cy, offset + distance / 2];
      params = { sizeX: rect.width, sizeY: rect.height, sizeZ: distance };
      break;
    case 'XZ': // sketch X→worldX, sketch Y→worldZ, extrude along +Y
      position = [rect.cx, offset + distance / 2, rect.cy];
      params = { sizeX: rect.width, sizeY: distance, sizeZ: rect.height };
      break;
    case 'YZ': // sketch X→worldY, sketch Y→worldZ, extrude along +X
      position = [offset + distance / 2, rect.cx, rect.cy];
      params = { sizeX: distance, sizeY: rect.width, sizeZ: rect.height };
      break;
  }

  return { type: 'box', position, rotation, params };
}

/**
 * Convert a 2D circle sketch + extrude distance → 3D Cylinder parameters.
 * Cylinder axis is rotated to match the extrude direction (plane normal).
 */
export function extrudeCircle(
  circle: SketchCircle,
  plane: SketchPlane,
  distance: number,
  offset = 0,
): { type: 'cylinder'; position: [number, number, number]; rotation: [number, number, number]; params: Record<string, number> } {
  let position: [number, number, number];
  let rotation: [number, number, number] = [0, 0, 0];

  switch (plane) {
    case 'XY': // extrude along Z → rotate cylinder (default Y-axis) to Z-axis
      position = [circle.cx, circle.cy, offset + distance / 2];
      rotation = [Math.PI / 2, 0, 0];
      break;
    case 'XZ': // extrude along Y → default cylinder orientation
      position = [circle.cx, offset + distance / 2, circle.cy];
      break;
    case 'YZ': // extrude along X → rotate cylinder to X-axis
      position = [offset + distance / 2, circle.cx, circle.cy];
      rotation = [0, 0, Math.PI / 2];
      break;
  }

  return {
    type: 'cylinder',
    position,
    rotation,
    params: { radius: circle.radius, height: distance },
  };
}
