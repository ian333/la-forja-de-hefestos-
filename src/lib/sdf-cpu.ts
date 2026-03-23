/**
 * ⚒️ La Forja — CPU SDF Evaluator
 * =================================
 * TypeScript mirror of the GLSL SDF library.
 * Used for:
 *   - Face selection (click → ray march → normal → sketch plane)
 *   - Object picking
 *   - CPU-side distance queries
 */

import type { SdfNode, SdfOperation, SdfPrimitive } from './sdf-engine';
import { isPrimitive } from './sdf-engine';

// ═══════════════════════════════════════════════════════════
// Vec3 Helpers
// ═══════════════════════════════════════════════════════════

export type Vec3 = [number, number, number];

export const v3sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const v3add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const v3scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const v3dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const v3len = (a: Vec3): number => Math.sqrt(v3dot(a, a));
export const v3normalize = (a: Vec3): Vec3 => {
  const l = v3len(a);
  return l > 1e-12 ? v3scale(a, 1 / l) : [0, 1, 0];
};

// ═══════════════════════════════════════════════════════════
// Rotation (matches GLSL rotX/rotY/rotZ exactly)
// ═══════════════════════════════════════════════════════════

function rotX(a: number, p: Vec3): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0], c * p[1] - s * p[2], s * p[1] + c * p[2]];
}
function rotY(a: number, p: Vec3): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
}
function rotZ(a: number, p: Vec3): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]];
}

// ═══════════════════════════════════════════════════════════
// SDF Primitives (mirrors GLSL_LIB)
// ═══════════════════════════════════════════════════════════

function sdSphere(p: Vec3, r: number): number {
  return v3len(p) - r;
}

function sdBox(p: Vec3, b: Vec3): number {
  const q: Vec3 = [Math.abs(p[0]) - b[0], Math.abs(p[1]) - b[1], Math.abs(p[2]) - b[2]];
  const outside = v3len([Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)]);
  const inside = Math.min(Math.max(q[0], Math.max(q[1], q[2])), 0);
  return outside + inside;
}

function sdCylinder(p: Vec3, r: number, h: number): number {
  const dx = Math.abs(Math.sqrt(p[0] * p[0] + p[2] * p[2])) - r;
  const dy = Math.abs(p[1]) - h;
  return Math.min(Math.max(dx, dy), 0) + Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2);
}

function sdTorus(p: Vec3, t: [number, number]): number {
  const qx = Math.sqrt(p[0] * p[0] + p[2] * p[2]) - t[0];
  return Math.sqrt(qx * qx + p[1] * p[1]) - t[1];
}

function sdCone(p: Vec3, r: number, h: number): number {
  h = Math.max(h, 0.001);
  const qx = r / h, qy = -1.0;
  const wx = Math.sqrt(p[0] * p[0] + p[2] * p[2]), wy = p[1] - h;
  const dotqq = qx * qx + qy * qy;
  // Project onto cone edge
  const t1 = Math.max(0, Math.min(1, (wx * qx + wy * qy) / dotqq));
  const ax = wx - qx * t1, ay = wy - qy * t1;
  const t2 = Math.max(0, Math.min(1, wx / qx));
  const bx = wx - qx * t2, by = wy + t2; // wy - qy*1 = wy+1
  const k = Math.sign(qy);
  const d = Math.min(ax * ax + ay * ay, bx * bx + by * by);
  const s = Math.max(k * (wx * qy - wy * qx), k * (wy - qy));
  return Math.sqrt(d) * Math.sign(s);
}

// ═══════════════════════════════════════════════════════════
// Scene Evaluator
// ═══════════════════════════════════════════════════════════

export function evaluateSdf(node: SdfNode, point: Vec3): number {
  if (isPrimitive(node)) {
    const prim = node as SdfPrimitive;

    // Capsule is special — uses absolute endpoints
    if (prim.type === 'capsule') {
      const pr = prim.params;
      const a: Vec3 = [pr.ax ?? 0, pr.ay ?? 0, pr.az ?? 0];
      const b: Vec3 = [pr.bx ?? 0, pr.by ?? 1, pr.bz ?? 0];
      const pa = v3sub(point, a);
      const ba = v3sub(b, a);
      const h = Math.max(0, Math.min(1, v3dot(pa, ba) / v3dot(ba, ba)));
      return v3len(v3sub(pa, v3scale(ba, h))) - (pr.radius ?? 0.05);
    }

    // Transform point into object space
    let p = v3sub(point, prim.position as Vec3);
    const rot = prim.rotation || [0, 0, 0];
    if (rot[0] !== 0 || rot[1] !== 0 || rot[2] !== 0) {
      p = rotZ(rot[2], rotY(rot[1], rotX(rot[0], p)));
    }

    const pr = prim.params;
    switch (prim.type) {
      case 'sphere':
        return sdSphere(p, pr.radius ?? 1);
      case 'box':
        return sdBox(p, [(pr.sizeX ?? 1) * 0.5, (pr.sizeY ?? 1) * 0.5, (pr.sizeZ ?? 1) * 0.5]);
      case 'cylinder':
        return sdCylinder(p, pr.radius ?? 0.5, (pr.height ?? 1) * 0.5);
      case 'torus':
        return sdTorus(p, [pr.majorRadius ?? 1, pr.minorRadius ?? 0.25]);
      case 'cone':
        return sdCone(p, pr.radius ?? 0.5, Math.max(pr.height ?? 1, 0.001));
      default:
        return 1000;
    }
  }

  // Operation node
  const op = node as SdfOperation;
  if (op.children.length === 0) return 1000;

  let result = evaluateSdf(op.children[0], point);
  for (let i = 1; i < op.children.length; i++) {
    const d = evaluateSdf(op.children[i], point);
    switch (op.type) {
      case 'union':
        result = Math.min(result, d);
        break;
      case 'subtract':
        result = Math.max(result, -d);
        break;
      case 'intersect':
        result = Math.max(result, d);
        break;
      case 'smoothUnion': {
        const k = op.smoothness;
        const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (d - result) / k));
        result = d * (1 - h) + result * h - k * h * (1 - h);
        break;
      }
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════
// Normal (central differences, 6-tap)
// ═══════════════════════════════════════════════════════════

export function evaluateNormal(node: SdfNode, point: Vec3): Vec3 {
  const h = 0.001;
  const dx =
    evaluateSdf(node, [point[0] + h, point[1], point[2]]) -
    evaluateSdf(node, [point[0] - h, point[1], point[2]]);
  const dy =
    evaluateSdf(node, [point[0], point[1] + h, point[2]]) -
    evaluateSdf(node, [point[0], point[1] - h, point[2]]);
  const dz =
    evaluateSdf(node, [point[0], point[1], point[2] + h]) -
    evaluateSdf(node, [point[0], point[1], point[2] - h]);
  return v3normalize([dx, dy, dz]);
}

// ═══════════════════════════════════════════════════════════
// CPU Ray March
// ═══════════════════════════════════════════════════════════

export interface RayHit {
  hit: boolean;
  t: number;
  position: Vec3;
  normal: Vec3;
}

export function cpuRayMarch(
  scene: SdfNode,
  ro: Vec3,
  rd: Vec3,
  maxSteps = 128,
  maxDist = 200,
): RayHit {
  let t = 0;
  for (let i = 0; i < maxSteps; i++) {
    const p: Vec3 = v3add(ro, v3scale(rd, t));
    const d = evaluateSdf(scene, p);
    if (Math.abs(d) < 0.001 * (1 + t * 0.01)) {
      const pos = v3add(ro, v3scale(rd, t));
      const normal = evaluateNormal(scene, pos);
      return { hit: true, t, position: pos, normal };
    }
    t += d;
    if (t > maxDist) break;
  }
  return { hit: false, t: 0, position: [0, 0, 0], normal: [0, 1, 0] };
}

// ═══════════════════════════════════════════════════════════
// Face Plane Detection
// ═══════════════════════════════════════════════════════════

export type FacePlane = 'XY' | 'XZ' | 'YZ';

export interface FaceInfo {
  plane: FacePlane;
  position: Vec3;
  normal: Vec3;
  /** Distance from origin along the plane-normal axis */
  offset: number;
}

/**
 * Snaps a surface normal to the nearest axis-aligned plane.
 *
 * normal along ±X → face perpendicular to X → sketch on YZ
 * normal along ±Y → face perpendicular to Y → sketch on XZ
 * normal along ±Z → face perpendicular to Z → sketch on XY
 */
export function detectFace(normal: Vec3, position: Vec3): FaceInfo {
  const abs = [Math.abs(normal[0]), Math.abs(normal[1]), Math.abs(normal[2])];
  const maxIdx = abs[0] > abs[1] ? (abs[0] > abs[2] ? 0 : 2) : abs[1] > abs[2] ? 1 : 2;

  const planes: FacePlane[] = ['YZ', 'XZ', 'XY'];
  const plane = planes[maxIdx];
  const offset = position[maxIdx];

  return { plane, position, normal, offset };
}
