/**
 * Live collision detection between SdfModules.
 *
 * Strategy (fast, fast-enough for interactive scrubbing):
 *   1. AABB per module (bounding sphere of each child primitive, unioned).
 *   2. AABB overlap test — skip non-overlapping pairs.
 *   3. For overlapping pairs, sample a sparse 3D grid inside the overlap box.
 *      Collision = exists point where SDF_a(p) < ε AND SDF_b(p) < ε.
 *
 * Cost: O(pairs × grid³) — with few modules (< 20) and grid=6 (216 samples)
 * this is tens of thousands of SDF evals per frame. Fine on CPU during
 * scrub. If perf drops, bump grid=4 or early-exit on first hit.
 */

import {
  isPrimitive,
  isContainer,
  type SdfNode,
  type SdfOperation,
  type SdfModule,
} from './sdf-engine';
import { evaluateSdf, type Vec3 } from './sdf-cpu';

interface AABB {
  min: Vec3;
  max: Vec3;
}

const INF = Number.POSITIVE_INFINITY;

function expandAabb(a: AABB, p: Vec3, r: number): void {
  a.min[0] = Math.min(a.min[0], p[0] - r);
  a.min[1] = Math.min(a.min[1], p[1] - r);
  a.min[2] = Math.min(a.min[2], p[2] - r);
  a.max[0] = Math.max(a.max[0], p[0] + r);
  a.max[1] = Math.max(a.max[1], p[1] + r);
  a.max[2] = Math.max(a.max[2], p[2] + r);
}

/** Bounding radius from a primitive's params (conservative). */
function primRadius(prim: SdfNode): number {
  if (!isPrimitive(prim)) return 0;
  const p = prim.params;
  switch (prim.type) {
    case 'sphere':   return (p.radius ?? 1);
    case 'box':      return Math.hypot((p.sizeX ?? 1), (p.sizeY ?? 1), (p.sizeZ ?? 1)) * 0.5;
    case 'cylinder': return Math.hypot(p.radius ?? 0.5, (p.height ?? 1) * 0.5);
    case 'torus':    return (p.majorRadius ?? 1) + (p.minorRadius ?? 0.25);
    case 'cone':     return Math.hypot(p.radius ?? 0.5, p.height ?? 1);
    case 'capsule': {
      const dx = (p.bx ?? 0) - (p.ax ?? 0);
      const dy = (p.by ?? 1) - (p.ay ?? 0);
      const dz = (p.bz ?? 0) - (p.az ?? 0);
      return Math.hypot(dx, dy, dz) * 0.5 + (p.radius ?? 0.05);
    }
    default: return 0;
  }
}

function primCenter(prim: SdfNode): Vec3 {
  if (!isPrimitive(prim)) return [0, 0, 0];
  if (prim.type === 'capsule') {
    const p = prim.params;
    return [((p.ax ?? 0) + (p.bx ?? 0)) / 2,
            ((p.ay ?? 0) + (p.by ?? 1)) / 2,
            ((p.az ?? 0) + (p.bz ?? 0)) / 2];
  }
  return [...prim.position] as Vec3;
}

function aabbOfNode(node: SdfNode): AABB {
  const a: AABB = { min: [INF, INF, INF], max: [-INF, -INF, -INF] };
  const walk = (n: SdfNode) => {
    if (isPrimitive(n)) {
      expandAabb(a, primCenter(n), primRadius(n));
    } else if (isContainer(n)) {
      n.children.forEach(walk);
    }
  };
  walk(node);
  return a;
}

function aabbOverlap(a: AABB, b: AABB): AABB | null {
  const min: Vec3 = [
    Math.max(a.min[0], b.min[0]),
    Math.max(a.min[1], b.min[1]),
    Math.max(a.min[2], b.min[2]),
  ];
  const max: Vec3 = [
    Math.min(a.max[0], b.max[0]),
    Math.min(a.max[1], b.max[1]),
    Math.min(a.max[2], b.max[2]),
  ];
  if (min[0] > max[0] || min[1] > max[1] || min[2] > max[2]) return null;
  return { min, max };
}

/** Treat a module as a union of its descendants for SDF evaluation. */
function evalModule(mod: SdfModule, point: Vec3): number {
  let best = 1000;
  for (const c of mod.children) {
    const d = evaluateSdf(c, point);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Returns the set of module-id pairs that currently interpenetrate.
 *
 * Skips rigid-joined modules (they're allowed to share surfaces by design —
 * e.g. a bolt head resting on a plate).
 */
export function detectCollisions(
  scene: SdfOperation,
  modules: SdfModule[],
  rigidPairs: Set<string>, // key: "id1|id2" sorted
  grid = 6,
  eps = 1e-3,
): Set<string> {
  // Unused but kept to signal "this function is module-aware, not scene-wide".
  void scene;

  const colliding = new Set<string>();
  if (modules.length < 2) return colliding;

  // Precompute AABBs
  const aabbs = modules.map(m => aabbOfNode(m));

  for (let i = 0; i < modules.length; i++) {
    for (let j = i + 1; j < modules.length; j++) {
      const mi = modules[i], mj = modules[j];
      const pairKey = mi.id < mj.id ? `${mi.id}|${mj.id}` : `${mj.id}|${mi.id}`;
      if (rigidPairs.has(pairKey)) continue; // allow intentional contact

      const ov = aabbOverlap(aabbs[i], aabbs[j]);
      if (!ov) continue;

      // Sample the overlap volume
      let hit = false;
      for (let xi = 0; xi < grid && !hit; xi++) {
        const tx = (xi + 0.5) / grid;
        const px = ov.min[0] + (ov.max[0] - ov.min[0]) * tx;
        for (let yi = 0; yi < grid && !hit; yi++) {
          const ty = (yi + 0.5) / grid;
          const py = ov.min[1] + (ov.max[1] - ov.min[1]) * ty;
          for (let zi = 0; zi < grid && !hit; zi++) {
            const tz = (zi + 0.5) / grid;
            const pz = ov.min[2] + (ov.max[2] - ov.min[2]) * tz;
            const p: Vec3 = [px, py, pz];
            const da = evalModule(mi, p);
            if (da > eps) continue;
            const db = evalModule(mj, p);
            if (db > eps) continue;
            hit = true;
          }
        }
      }

      if (hit) {
        colliding.add(mi.id);
        colliding.add(mj.id);
      }
    }
  }

  return colliding;
}

/** Keys for all rigid-joined pairs. */
export function rigidPairKeys(joints: Array<{ type: string; a: string; b: string }>): Set<string> {
  const s = new Set<string>();
  for (const j of joints) {
    if (j.type !== 'rigid') continue;
    const k = j.a < j.b ? `${j.a}|${j.b}` : `${j.b}|${j.a}`;
    s.add(k);
  }
  return s;
}
