/**
 * ⚒️ La Forja — STL Export via Marching Cubes
 * ============================================
 * Evaluates the SDF on a 3D grid and polygonizes the zero-isosurface
 * using classic Marching Cubes. Outputs binary STL for download.
 *
 * This runs on the CPU (TypeScript). For the bicycle scene it takes
 * ~1-3 seconds at resolution 128. Resolution 256 gives print-quality.
 */

import type { SdfNode, SdfPrimitive, SdfOperation } from './sdf-engine';
import { isPrimitive } from './sdf-engine';

// ═══════════════════════════════════════════════════════════════
// CPU SDF Evaluator (mirrors GLSL but in JS)
// ═══════════════════════════════════════════════════════════════

type V3 = [number, number, number];

function len(v: V3): number { return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); }
function sub(a: V3, b: V3): V3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a: V3, b: V3): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

function rotX(a: number, p: V3): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0], c * p[1] + s * p[2], -s * p[1] + c * p[2]];
}
function rotY(a: number, p: V3): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * p[0] - s * p[2], p[1], s * p[0] + c * p[2]];
}
function rotZ(a: number, p: V3): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * p[0] + s * p[1], -s * p[0] + c * p[1], p[2]];
}

function sdSphere(p: V3, r: number): number { return len(p) - r; }

function sdBox(p: V3, b: V3): number {
  const q: V3 = [Math.abs(p[0]) - b[0], Math.abs(p[1]) - b[1], Math.abs(p[2]) - b[2]];
  return len([Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)]) + Math.min(Math.max(q[0], Math.max(q[1], q[2])), 0);
}

function sdCylinder(p: V3, r: number, h: number): number {
  const dx = Math.sqrt(p[0] * p[0] + p[2] * p[2]) - r;
  const dy = Math.abs(p[1]) - h;
  return Math.min(Math.max(dx, dy), 0) + Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2);
}

function sdTorus(p: V3, R: number, r: number): number {
  const q0 = Math.sqrt(p[0] * p[0] + p[2] * p[2]) - R;
  return Math.sqrt(q0 * q0 + p[1] * p[1]) - r;
}

function sdCone(p: V3, r: number, h: number): number {
  h = Math.max(h, 0.001);
  const qx = r / h, qy = -1;
  const wx = Math.sqrt(p[0] * p[0] + p[2] * p[2]), wy = p[1] - h;
  const t = Math.max(0, Math.min(1, (wx * h * qx + wy * h * qy) / (h * h * (qx * qx + qy * qy))));
  const ax = wx - h * qx * t, ay = wy - h * qy * t;
  const t2 = Math.max(0, Math.min(1, wx / (h * qx)));
  const bx = wx - h * qx * t2, by = wy - h;
  const k = Math.sign(h * qy);
  const d = Math.min(ax * ax + ay * ay, bx * bx + by * by);
  const s = Math.max(k * (wx * h * qy - wy * h * qx), k * (wy - h * qy));
  return Math.sqrt(d) * Math.sign(s);
}

function sdCapsule(p: V3, a: V3, b: V3, r: number): number {
  const pa = sub(p, a);
  const ba = sub(b, a);
  const h = Math.max(0, Math.min(1, dot(pa, ba) / dot(ba, ba)));
  return len(sub(pa, [ba[0] * h, ba[1] * h, ba[2] * h])) - r;
}

function opSmoothUnion(d1: number, d2: number, k: number): number {
  const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (d2 - d1) / k));
  return d2 * (1 - h) + d1 * h - k * h * (1 - h);
}

function evalNode(node: SdfNode, p: V3): number {
  if (isPrimitive(node)) {
    const pr = node as SdfPrimitive;
    const params = pr.params;

    if (pr.type === 'capsule') {
      const a: V3 = [params.ax ?? 0, params.ay ?? 0, params.az ?? 0];
      const b: V3 = [params.bx ?? 0, params.by ?? 1, params.bz ?? 0];
      return sdCapsule(p, a, b, params.radius ?? 0.02);
    }

    let lp = sub(p, pr.position);
    const rot = pr.rotation || [0, 0, 0];
    if (rot[0] !== 0 || rot[1] !== 0 || rot[2] !== 0) {
      lp = rotZ(rot[2], rotY(rot[1], rotX(rot[0], lp)));
    }

    switch (pr.type) {
      case 'sphere': return sdSphere(lp, params.radius ?? 1);
      case 'box': return sdBox(lp, [(params.sizeX ?? 1) * 0.5, (params.sizeY ?? 1) * 0.5, (params.sizeZ ?? 1) * 0.5]);
      case 'cylinder': return sdCylinder(lp, params.radius ?? 0.5, (params.height ?? 1) * 0.5);
      case 'torus': return sdTorus(lp, params.majorRadius ?? 1, params.minorRadius ?? 0.25);
      case 'cone': return sdCone(lp, params.radius ?? 0.5, params.height ?? 1);
      default: return 1000;
    }
  }

  const op = node as SdfOperation;
  if (op.children.length === 0) return 1000;
  if (op.children.length === 1) return evalNode(op.children[0], p);

  let result = evalNode(op.children[0], p);
  for (let i = 1; i < op.children.length; i++) {
    const d = evalNode(op.children[i], p);
    switch (op.type) {
      case 'union': result = Math.min(result, d); break;
      case 'subtract': result = Math.max(result, -d); break;
      case 'intersect': result = Math.max(result, d); break;
      case 'smoothUnion': result = opSmoothUnion(result, d, op.smoothness); break;
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// Marching Cubes
// ═══════════════════════════════════════════════════════════════

// Edge table & tri table (classic MC lookup tables)
// Compressed edge table — 256 entries
const EDGE_TABLE = [
  0x0,0x109,0x203,0x30a,0x406,0x50f,0x605,0x70c,0x80c,0x905,0xa0f,0xb06,0xc0a,0xd03,0xe09,0xf00,
  0x190,0x99,0x393,0x29a,0x596,0x49f,0x795,0x69c,0x99c,0x895,0xb9f,0xa96,0xd9a,0xc93,0xf99,0xe90,
  0x230,0x339,0x33,0x13a,0x636,0x73f,0x435,0x53c,0xa3c,0xb35,0x83f,0x936,0xe3a,0xf33,0xc39,0xd30,
  0x3a0,0x2a9,0x1a3,0xaa,0x7a6,0x6af,0x5a5,0x4ac,0xbac,0xaa5,0x9af,0x8a6,0xfaa,0xea3,0xda9,0xca0,
  0x460,0x569,0x663,0x76a,0x66,0x16f,0x265,0x36c,0xc6c,0xd65,0xe6f,0xf66,0x86a,0x963,0xa69,0xb60,
  0x5f0,0x4f9,0x7f3,0x6fa,0x1f6,0xff,0x3f5,0x2fc,0xdfc,0xcf5,0xfff,0xef6,0x9fa,0x8f3,0xbf9,0xaf0,
  0x650,0x759,0x453,0x55a,0x256,0x35f,0x55,0x15c,0xe5c,0xf55,0xc5f,0xd56,0xa5a,0xb53,0x859,0x950,
  0x7c0,0x6c9,0x5c3,0x4ca,0x3c6,0x2cf,0x1c5,0xcc,0xfcc,0xec5,0xdcf,0xcc6,0xbca,0xac3,0x9c9,0x8c0,
  0x8c0,0x9c9,0xac3,0xbca,0xcc6,0xdcf,0xec5,0xfcc,0xcc,0x1c5,0x2cf,0x3c6,0x4ca,0x5c3,0x6c9,0x7c0,
  0x950,0x859,0xb53,0xa5a,0xd56,0xc5f,0xf55,0xe5c,0x15c,0x55,0x35f,0x256,0x55a,0x453,0x759,0x650,
  0xaf0,0xbf9,0x8f3,0x9fa,0xef6,0xfff,0xcf5,0xdfc,0x2fc,0x3f5,0xff,0x1f6,0x6fa,0x7f3,0x4f9,0x5f0,
  0xb60,0xa69,0x963,0x86a,0xf66,0xe6f,0xd65,0xc6c,0x36c,0x265,0x16f,0x66,0x76a,0x663,0x569,0x460,
  0xca0,0xda9,0xea3,0xfaa,0x8a6,0x9af,0xaa5,0xbac,0x4ac,0x5a5,0x6af,0x7a6,0xaa,0x1a3,0x2a9,0x3a0,
  0xd30,0xc39,0xf33,0xe3a,0x936,0x83f,0xb35,0xa3c,0x53c,0x435,0x73f,0x636,0x13a,0x33,0x339,0x230,
  0xe90,0xf99,0xc93,0xd9a,0xa96,0xb9f,0x895,0x99c,0x69c,0x795,0x49f,0x596,0x29a,0x393,0x99,0x190,
  0xf00,0xe09,0xd03,0xc0a,0xb06,0xa0f,0x905,0x80c,0x70c,0x605,0x50f,0x406,0x30a,0x203,0x109,0x0
];

// Tri table — each entry is up to 15 edge indices, -1 terminated
const TRI_TABLE: number[][] = [
  [-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],
  [-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],
  [-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],
  [-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],
  [-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],
  [-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],
  [-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],
  [-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],
  [-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],
  [-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],
  [-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],
  [-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],
  [-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],
  [-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],
  [-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],
  [-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],[-1],
];

// We'll build the real tri table at module load from the canonical data
// Using Paul Bourke's canonical MC tables
function initTriTable() {
  const T = TRI_TABLE;
  T[0x01]=[0,8,3];T[0x02]=[0,1,9];T[0x03]=[1,8,3,9,8,1];T[0x04]=[1,2,10];T[0x05]=[0,8,3,1,2,10];
  T[0x06]=[9,2,10,0,2,9];T[0x07]=[2,8,3,2,10,8,10,9,8];T[0x08]=[3,11,2];T[0x09]=[0,11,2,8,11,0];
  T[0x0a]=[1,9,0,2,3,11];T[0x0b]=[1,11,2,1,9,11,9,8,11];T[0x0c]=[3,10,1,11,10,3];
  T[0x0d]=[0,10,1,0,8,10,8,11,10];T[0x0e]=[3,9,0,3,11,9,11,10,9];T[0x0f]=[9,8,10,10,8,11];
  T[0x10]=[4,7,8];T[0x11]=[4,3,0,7,3,4];T[0x12]=[0,1,9,8,4,7];T[0x13]=[4,1,9,4,7,1,7,3,1];
  T[0x14]=[1,2,10,8,4,7];T[0x15]=[3,4,7,3,0,4,1,2,10];T[0x16]=[9,2,10,9,0,2,8,4,7];
  T[0x17]=[2,10,9,2,9,7,2,7,3,7,9,4];T[0x18]=[8,4,7,3,11,2];T[0x19]=[11,4,7,11,2,4,2,0,4];
  T[0x1a]=[9,0,1,8,4,7,2,3,11];T[0x1b]=[4,7,11,9,4,11,9,11,2,9,2,1];
  T[0x1c]=[3,10,1,3,11,10,7,8,4];T[0x1d]=[1,11,10,1,4,11,1,0,4,7,11,4];
  T[0x1e]=[4,7,8,9,0,11,9,11,10,11,0,3];T[0x1f]=[4,7,11,4,11,9,9,11,10];
  T[0x20]=[9,5,4];T[0x21]=[9,5,4,0,8,3];T[0x22]=[0,5,4,1,5,0];T[0x23]=[8,5,4,8,3,5,3,1,5];
  T[0x24]=[1,2,10,9,5,4];T[0x25]=[3,0,8,1,2,10,4,9,5];T[0x26]=[5,2,10,5,4,2,4,0,2];
  T[0x27]=[2,10,5,3,2,5,3,5,4,3,4,8];T[0x28]=[9,5,4,2,3,11];T[0x29]=[0,11,2,0,8,11,4,9,5];
  T[0x2a]=[0,5,4,0,1,5,2,3,11];T[0x2b]=[2,1,5,2,5,8,2,8,11,4,8,5];
  T[0x2c]=[10,3,11,10,1,3,9,5,4];T[0x2d]=[4,9,5,0,8,1,8,10,1,8,11,10];
  T[0x2e]=[5,4,0,5,0,11,5,11,10,11,0,3];T[0x2f]=[5,4,8,5,8,10,10,8,11];
  T[0x30]=[9,7,8,5,7,9];T[0x31]=[9,3,0,9,5,3,5,7,3];T[0x32]=[0,7,8,0,1,7,1,5,7];
  T[0x33]=[1,5,3,3,5,7];T[0x34]=[9,7,8,9,5,7,10,1,2];T[0x35]=[10,1,2,9,5,0,5,3,0,5,7,3];
  T[0x36]=[8,0,2,8,2,5,8,5,7,10,5,2];T[0x37]=[2,10,5,2,5,3,3,5,7];
  T[0x38]=[7,9,5,7,8,9,3,11,2];T[0x39]=[9,5,7,9,7,2,9,2,0,2,7,11];
  T[0x3a]=[2,3,11,0,1,8,1,7,8,1,5,7];T[0x3b]=[11,2,1,11,1,7,7,1,5];
  T[0x3c]=[9,5,8,8,5,7,10,1,3,10,3,11];T[0x3d]=[5,7,0,5,0,9,7,11,0,1,0,10,11,10,0];
  T[0x3e]=[11,10,0,11,0,3,10,5,0,8,0,7,5,7,0];T[0x3f]=[11,10,5,7,11,5];
  T[0x40]=[10,6,5];T[0x41]=[0,8,3,5,10,6];T[0x42]=[9,0,1,5,10,6];T[0x43]=[1,8,3,1,9,8,5,10,6];
  T[0x44]=[1,6,5,2,6,1];T[0x45]=[1,6,5,1,2,6,3,0,8];T[0x46]=[9,6,5,9,0,6,0,2,6];
  T[0x47]=[5,9,8,5,8,2,5,2,6,3,2,8];T[0x48]=[2,3,11,10,6,5];T[0x49]=[11,0,8,11,2,0,10,6,5];
  T[0x4a]=[0,1,9,2,3,11,5,10,6];T[0x4b]=[5,10,6,1,9,2,9,11,2,9,8,11];
  T[0x4c]=[6,3,11,6,5,3,5,1,3];T[0x4d]=[0,8,11,0,11,5,0,5,1,5,11,6];
  T[0x4e]=[3,11,6,0,3,6,0,6,5,0,5,9];T[0x4f]=[6,5,9,6,9,11,11,9,8];
  T[0x50]=[5,10,6,4,7,8];T[0x51]=[4,3,0,4,7,3,6,5,10];T[0x52]=[1,9,0,5,10,6,8,4,7];
  T[0x53]=[10,6,5,1,9,7,1,7,3,7,9,4];T[0x54]=[6,1,2,6,5,1,4,7,8];
  T[0x55]=[1,2,5,5,2,6,3,0,4,3,4,7];T[0x56]=[8,4,7,9,0,5,0,6,5,0,2,6];
  T[0x57]=[7,3,9,7,9,4,3,2,9,5,9,6,2,6,9];T[0x58]=[3,11,2,7,8,4,10,6,5];
  T[0x59]=[5,10,6,4,7,2,4,2,0,2,7,11];T[0x5a]=[0,1,9,4,7,8,2,3,11,5,10,6];
  T[0x5b]=[9,2,1,9,11,2,9,4,11,7,11,4,5,10,6];T[0x5c]=[8,4,7,3,11,5,3,5,1,5,11,6];
  T[0x5d]=[5,1,11,5,11,6,1,0,11,7,11,4,0,4,11];T[0x5e]=[0,5,9,0,6,5,0,3,6,11,6,3,8,4,7];
  T[0x5f]=[6,5,9,6,9,11,4,7,9,7,11,9];
  T[0x60]=[10,4,9,6,4,10];T[0x61]=[4,10,6,4,9,10,0,8,3];T[0x62]=[10,0,1,10,6,0,6,4,0];
  T[0x63]=[8,3,1,8,1,6,8,6,4,6,1,10];T[0x64]=[1,4,9,1,2,4,2,6,4];
  T[0x65]=[3,0,8,1,2,9,2,4,9,2,6,4];T[0x66]=[0,2,4,4,2,6];T[0x67]=[8,3,2,8,2,4,4,2,6];
  T[0x68]=[10,4,9,10,6,4,11,2,3];T[0x69]=[0,8,2,2,8,11,4,9,10,4,10,6];
  T[0x6a]=[3,11,2,0,1,6,0,6,4,6,1,10];T[0x6b]=[6,4,1,6,1,10,4,8,1,2,1,11,8,11,1];
  T[0x6c]=[9,6,4,9,3,6,9,1,3,11,6,3];T[0x6d]=[8,11,1,8,1,0,11,6,1,9,1,4,6,4,1];
  T[0x6e]=[3,11,6,3,6,0,0,6,4];T[0x6f]=[6,4,8,11,6,8];
  T[0x70]=[7,10,6,7,8,10,8,9,10];T[0x71]=[0,7,3,0,10,7,0,9,10,6,7,10];
  T[0x72]=[10,6,7,1,10,7,1,7,8,1,8,0];T[0x73]=[10,6,7,10,7,1,1,7,3];
  T[0x74]=[1,2,6,1,6,8,1,8,9,8,6,7];T[0x75]=[2,6,9,2,9,1,6,7,9,0,9,3,7,3,9];
  T[0x76]=[7,8,0,7,0,6,6,0,2];T[0x77]=[7,3,2,6,7,2];
  T[0x78]=[2,3,11,10,6,8,10,8,9,8,6,7];T[0x79]=[2,0,7,2,7,11,0,9,7,6,7,10,9,10,7];
  T[0x7a]=[1,8,0,1,7,8,1,10,7,6,7,10,2,3,11];T[0x7b]=[11,2,1,11,1,7,10,6,1,6,7,1];
  T[0x7c]=[8,9,6,8,6,7,9,1,6,11,6,3,1,3,6];T[0x7d]=[0,9,1,11,6,7];
  T[0x7e]=[7,8,0,7,0,6,3,11,0,11,6,0];T[0x7f]=[7,11,6];
  T[0x80]=[7,6,11];T[0x81]=[3,0,8,11,7,6];T[0x82]=[0,1,9,11,7,6];T[0x83]=[8,1,9,8,3,1,11,7,6];
  T[0x84]=[10,1,2,6,11,7];T[0x85]=[1,2,10,3,0,8,6,11,7];T[0x86]=[2,9,0,2,10,9,6,11,7];
  T[0x87]=[6,11,7,2,10,3,10,8,3,10,9,8];T[0x88]=[7,2,3,6,2,7];T[0x89]=[7,0,8,7,6,0,6,2,0];
  T[0x8a]=[2,7,6,2,3,7,0,1,9];T[0x8b]=[1,6,2,1,8,6,1,9,8,8,7,6];
  T[0x8c]=[10,7,6,10,1,7,1,3,7];T[0x8d]=[10,7,6,1,7,10,1,8,7,1,0,8];
  T[0x8e]=[0,3,7,0,7,10,0,10,9,6,10,7];T[0x8f]=[7,6,10,7,10,8,8,10,9];
  T[0x90]=[6,8,4,11,8,6];T[0x91]=[3,6,11,3,0,6,0,4,6];T[0x92]=[8,6,11,8,4,6,9,0,1];
  T[0x93]=[9,4,6,9,6,3,9,3,1,11,3,6];T[0x94]=[6,8,4,6,11,8,2,10,1];
  T[0x95]=[1,2,10,3,0,11,0,6,11,0,4,6];T[0x96]=[4,11,8,4,6,11,0,2,9,2,10,9];
  T[0x97]=[10,9,3,10,3,2,9,4,3,11,3,6,4,6,3];T[0x98]=[8,2,3,8,4,2,4,6,2];
  T[0x99]=[0,4,2,4,6,2];T[0x9a]=[1,9,0,2,3,4,2,4,6,4,3,8];T[0x9b]=[1,9,4,1,4,2,2,4,6];
  T[0x9c]=[8,1,3,8,6,1,8,4,6,6,10,1];T[0x9d]=[10,1,0,10,0,6,6,0,4];
  T[0x9e]=[4,6,3,4,3,8,6,10,3,0,3,9,10,9,3];T[0x9f]=[10,9,4,6,10,4];
  T[0xa0]=[4,9,5,7,6,11];T[0xa1]=[0,8,3,4,9,5,11,7,6];T[0xa2]=[5,0,1,5,4,0,7,6,11];
  T[0xa3]=[11,7,6,8,3,4,3,5,4,3,1,5];T[0xa4]=[9,5,4,10,1,2,7,6,11];
  T[0xa5]=[6,11,7,1,2,10,0,8,3,4,9,5];T[0xa6]=[7,6,11,5,4,10,4,2,10,4,0,2];
  T[0xa7]=[3,4,8,3,5,4,3,2,5,10,5,2,11,7,6];T[0xa8]=[7,2,3,7,6,2,5,4,9];
  T[0xa9]=[9,5,4,0,8,6,0,6,2,6,8,7];T[0xaa]=[3,6,2,3,7,6,1,5,0,5,4,0];
  T[0xab]=[6,2,8,6,8,7,2,1,8,4,8,5,1,5,8];T[0xac]=[9,5,4,10,1,6,1,7,6,1,3,7];
  T[0xad]=[1,6,10,1,7,6,1,0,7,8,7,0,9,5,4];T[0xae]=[4,0,10,4,10,5,0,3,10,6,10,7,3,7,10];
  T[0xaf]=[7,6,10,7,10,8,5,4,10,4,8,10];
  T[0xb0]=[6,9,5,6,11,9,11,8,9];T[0xb1]=[3,6,11,0,6,3,0,5,6,0,9,5];
  T[0xb2]=[0,11,8,0,5,11,0,1,5,5,6,11];T[0xb3]=[6,11,3,6,3,5,5,3,1];
  T[0xb4]=[1,2,10,9,5,11,9,11,8,11,5,6];T[0xb5]=[0,11,3,0,6,11,0,9,6,5,6,9,1,2,10];
  T[0xb6]=[11,8,5,11,5,6,8,0,5,10,5,2,0,2,5];T[0xb7]=[6,11,3,6,3,5,2,10,3,10,5,3];
  T[0xb8]=[5,8,9,5,2,8,5,6,2,3,8,2];T[0xb9]=[9,5,6,9,6,0,0,6,2];
  T[0xba]=[1,5,8,1,8,0,5,6,8,3,8,2,6,2,8];T[0xbb]=[1,5,6,2,1,6];
  T[0xbc]=[1,3,6,1,6,10,3,8,6,5,6,9,8,9,6];T[0xbd]=[10,1,0,10,0,6,9,5,0,5,6,0];
  T[0xbe]=[0,3,8,5,6,10];T[0xbf]=[10,5,6];
  T[0xc0]=[11,5,10,7,5,11];T[0xc1]=[11,5,10,11,7,5,8,3,0];T[0xc2]=[5,11,7,5,10,11,1,9,0];
  T[0xc3]=[10,7,5,10,11,7,9,8,1,8,3,1];T[0xc4]=[11,1,2,11,7,1,7,5,1];
  T[0xc5]=[0,8,3,1,2,7,1,7,5,7,2,11];T[0xc6]=[9,7,5,9,2,7,9,0,2,2,11,7];
  T[0xc7]=[7,5,2,7,2,11,5,9,2,3,2,8,9,8,2];T[0xc8]=[2,5,10,2,3,5,3,7,5];
  T[0xc9]=[8,2,0,8,5,2,8,7,5,10,2,5];T[0xca]=[9,0,1,5,10,3,5,3,7,3,10,2];
  T[0xcb]=[9,8,2,9,2,1,8,7,2,10,2,5,7,5,2];T[0xcc]=[1,3,5,3,7,5];
  T[0xcd]=[0,8,7,0,7,1,1,7,5];T[0xce]=[9,0,3,9,3,5,5,3,7];T[0xcf]=[9,8,7,5,9,7];
  T[0xd0]=[5,8,4,5,10,8,10,11,8];T[0xd1]=[5,0,4,5,11,0,5,10,11,11,3,0];
  T[0xd2]=[0,1,9,8,4,10,8,10,11,10,4,5];T[0xd3]=[10,11,4,10,4,5,11,3,4,9,4,1,3,1,4];
  T[0xd4]=[2,5,1,2,8,5,2,11,8,4,5,8];T[0xd5]=[0,4,11,0,11,3,4,5,11,2,11,1,5,1,11];
  T[0xd6]=[0,2,5,0,5,9,2,11,5,4,5,8,11,8,5];T[0xd7]=[9,4,5,2,11,3];
  T[0xd8]=[2,5,10,3,5,2,3,4,5,3,8,4];T[0xd9]=[5,10,2,5,2,4,4,2,0];
  T[0xda]=[3,10,2,3,5,10,3,8,5,4,5,8,0,1,9];T[0xdb]=[5,10,2,5,2,4,1,9,2,9,4,2];
  T[0xdc]=[8,4,5,8,5,3,3,5,1];T[0xdd]=[0,4,5,1,0,5];T[0xde]=[8,4,5,8,5,3,9,0,5,0,3,5];
  T[0xdf]=[9,4,5];
  T[0xe0]=[4,11,7,4,9,11,9,10,11];T[0xe1]=[0,8,3,4,9,7,9,11,7,9,10,11];
  T[0xe2]=[1,10,11,1,11,4,1,4,0,7,4,11];T[0xe3]=[3,1,4,3,4,8,1,10,4,7,4,11,10,11,4];
  T[0xe4]=[4,11,7,9,11,4,9,2,11,9,1,2];T[0xe5]=[9,7,4,9,11,7,9,1,11,2,11,1,0,8,3];
  T[0xe6]=[11,7,4,11,4,2,2,4,0];T[0xe7]=[11,7,4,11,4,2,8,3,4,3,2,4];
  T[0xe8]=[2,9,10,2,7,9,2,3,7,7,4,9];T[0xe9]=[9,10,7,9,7,4,10,2,7,8,7,0,2,0,7];
  T[0xea]=[3,7,10,3,10,2,7,4,10,1,10,0,4,0,10];T[0xeb]=[1,10,2,8,7,4];
  T[0xec]=[4,9,1,4,1,7,7,1,3];T[0xed]=[4,9,1,4,1,7,0,8,1,8,7,1];
  T[0xee]=[4,0,3,7,4,3];T[0xef]=[4,8,7];
  T[0xf0]=[9,10,8,10,11,8];T[0xf1]=[3,0,9,3,9,11,11,9,10];T[0xf2]=[0,1,10,0,10,8,8,10,11];
  T[0xf3]=[3,1,10,11,3,10];T[0xf4]=[1,2,11,1,11,9,9,11,8];T[0xf5]=[3,0,9,3,9,11,1,2,9,2,11,9];
  T[0xf6]=[0,2,11,8,0,11];T[0xf7]=[3,2,11];T[0xf8]=[2,3,8,2,8,10,10,8,9];
  T[0xf9]=[9,10,2,0,9,2];T[0xfa]=[2,3,8,2,8,10,0,1,8,1,10,8];T[0xfb]=[1,10,2];
  T[0xfc]=[1,3,8,9,1,8];T[0xfd]=[0,9,1];T[0xfe]=[0,3,8];
}
initTriTable();

// Edge vertex pairs (for interpolation)
const EDGE_VERTS: [number, number][] = [
  [0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]
];

// Cube corner offsets
const CORNER_OFFSETS: V3[] = [
  [0,0,0],[1,0,0],[1,1,0],[0,1,0],
  [0,0,1],[1,0,1],[1,1,1],[0,1,1]
];

function lerp3(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function cross(a: V3, b: V3): V3 {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}

function normalize(v: V3): V3 {
  const l = len(v) || 1;
  return [v[0]/l, v[1]/l, v[2]/l];
}

export interface MarchingCubesResult {
  triangles: Float32Array; // x,y,z triples (3 verts per tri)
  normals: Float32Array;
  triCount: number;
}

/**
 * Run marching cubes on the SDF.
 * @param scene - root SDF node
 * @param res - grid resolution per axis (64, 128, 256)
 * @param bounds - [min, max] world-space AABB
 * @param onProgress - optional progress callback (0-1)
 */
export function marchingCubes(
  scene: SdfNode,
  res = 128,
  bounds: [V3, V3] = [[-1.2, -0.2, -0.5], [1.2, 1.4, 0.5]],
  onProgress?: (pct: number) => void,
): MarchingCubesResult {
  const [bMin, bMax] = bounds;
  const step: V3 = [
    (bMax[0] - bMin[0]) / res,
    (bMax[1] - bMin[1]) / res,
    (bMax[2] - bMin[2]) / res,
  ];

  // Evaluate grid
  const grid = new Float32Array((res + 1) * (res + 1) * (res + 1));
  const idx = (x: number, y: number, z: number) => x + (res + 1) * (y + (res + 1) * z);

  for (let z = 0; z <= res; z++) {
    if (onProgress) onProgress(z / res * 0.6);
    for (let y = 0; y <= res; y++) {
      for (let x = 0; x <= res; x++) {
        const p: V3 = [
          bMin[0] + x * step[0],
          bMin[1] + y * step[1],
          bMin[2] + z * step[2],
        ];
        grid[idx(x, y, z)] = evalNode(scene, p);
      }
    }
  }

  // Extract triangles
  const tris: number[] = [];
  for (let z = 0; z < res; z++) {
    if (onProgress) onProgress(0.6 + (z / res) * 0.4);
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        // 8 corner values
        const vals: number[] = [];
        const corners: V3[] = [];
        for (let c = 0; c < 8; c++) {
          const cx = x + CORNER_OFFSETS[c][0];
          const cy = y + CORNER_OFFSETS[c][1];
          const cz = z + CORNER_OFFSETS[c][2];
          vals.push(grid[idx(cx, cy, cz)]);
          corners.push([
            bMin[0] + cx * step[0],
            bMin[1] + cy * step[1],
            bMin[2] + cz * step[2],
          ]);
        }

        // Build case index
        let cubeIndex = 0;
        for (let c = 0; c < 8; c++) {
          if (vals[c] < 0) cubeIndex |= (1 << c);
        }
        if (EDGE_TABLE[cubeIndex] === 0) continue;

        // Interpolate edge vertices
        const edgeVerts: V3[] = new Array(12);
        const edges = EDGE_TABLE[cubeIndex];
        for (let e = 0; e < 12; e++) {
          if (edges & (1 << e)) {
            const [v0, v1] = EDGE_VERTS[e];
            const t = vals[v0] / (vals[v0] - vals[v1]);
            edgeVerts[e] = lerp3(corners[v0], corners[v1], t);
          }
        }

        // Emit triangles
        const row = TRI_TABLE[cubeIndex];
        for (let i = 0; i < row.length; i += 3) {
          if (row[i] === -1) break;
          tris.push(
            ...edgeVerts[row[i]],
            ...edgeVerts[row[i + 1]],
            ...edgeVerts[row[i + 2]],
          );
        }
      }
    }
  }

  const triCount = tris.length / 9;
  const triangles = new Float32Array(tris);
  const normals = new Float32Array(triCount * 3);

  // Compute face normals
  for (let i = 0; i < triCount; i++) {
    const o = i * 9;
    const v0: V3 = [triangles[o], triangles[o+1], triangles[o+2]];
    const v1: V3 = [triangles[o+3], triangles[o+4], triangles[o+5]];
    const v2: V3 = [triangles[o+6], triangles[o+7], triangles[o+8]];
    const n = normalize(cross(sub(v1, v0), sub(v2, v0)));
    normals[i * 3] = n[0];
    normals[i * 3 + 1] = n[1];
    normals[i * 3 + 2] = n[2];
  }

  return { triangles, normals, triCount };
}

// ═══════════════════════════════════════════════════════════════
// Binary STL Writer
// ═══════════════════════════════════════════════════════════════

export function toSTL(result: MarchingCubesResult, scaleMM = 100): ArrayBuffer {
  const { triangles, normals, triCount } = result;
  // Binary STL: 80-byte header + 4-byte tri count + 50 bytes per triangle
  const buf = new ArrayBuffer(84 + triCount * 50);
  const view = new DataView(buf);

  // Header — "La Forja de Hefestos — F-Rep STL Export"
  const header = 'La Forja de Hefestos - F-Rep STL Export';
  for (let i = 0; i < Math.min(header.length, 80); i++) {
    view.setUint8(i, header.charCodeAt(i));
  }
  view.setUint32(80, triCount, true);

  for (let i = 0; i < triCount; i++) {
    const off = 84 + i * 50;
    // Normal
    view.setFloat32(off, normals[i * 3], true);
    view.setFloat32(off + 4, normals[i * 3 + 1], true);
    view.setFloat32(off + 8, normals[i * 3 + 2], true);
    // 3 vertices (scale to mm)
    for (let v = 0; v < 3; v++) {
      const ti = i * 9 + v * 3;
      view.setFloat32(off + 12 + v * 12, triangles[ti] * scaleMM, true);
      view.setFloat32(off + 12 + v * 12 + 4, triangles[ti + 1] * scaleMM, true);
      view.setFloat32(off + 12 + v * 12 + 8, triangles[ti + 2] * scaleMM, true);
    }
    // Attribute byte count
    view.setUint16(off + 48, 0, true);
  }

  return buf;
}

/** Trigger STL download in the browser */
export function downloadSTL(scene: SdfNode, filename = 'forja-export.stl', res = 128) {
  const result = marchingCubes(scene, res);
  const buf = toSTL(result);
  const blob = new Blob([buf], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return result.triCount;
}
