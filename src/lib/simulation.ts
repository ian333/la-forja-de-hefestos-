/**
 * ⚒️ La Forja — Simulation Engine
 * ================================
 * Drives mechanical simulation: rotating wheels, moving chain links,
 * pedal cranking. Works by cloning the scene tree and mutating positions
 * per frame based on simulation parameters.
 *
 * Phase 1: Kinematic animation (rotation, translation)
 * Phase 2: Stress visualization (distance-based color overlay) — via shader
 */

import type { SdfNode, SdfPrimitive, SdfOperation } from './sdf-engine';
import { isPrimitive } from './sdf-engine';
import { evaluateSdf, type Vec3 } from './sdf-cpu';

// ═══════════════════════════════════════════════════════════════
// Simulation State
// ═══════════════════════════════════════════════════════════════

export interface SimulationState {
  running: boolean;
  speed: number;       // multiplier (1 = normal, 2 = fast)
  time: number;        // accumulated time in seconds
  mode: 'kinematic' | 'stress';
}

export function createSimState(): SimulationState {
  return { running: false, speed: 1, time: 0, mode: 'kinematic' };
}

// ═══════════════════════════════════════════════════════════════
// Kinematic Animation
// ═══════════════════════════════════════════════════════════════

/**
 * Tags for simulation — nodes with specific labels get animated.
 * We use the node label to identify what to animate:
 * - "Rueda" → wheels rotate
 * - chain spheres → orbit around sprocket paths
 * - cranks → rotate around bottom bracket
 */

function deepClone(node: SdfNode): SdfNode {
  if (isPrimitive(node)) {
    const p = node as SdfPrimitive;
    return {
      ...p,
      position: [...p.position] as [number, number, number],
      rotation: [...p.rotation] as [number, number, number],
      params: { ...p.params },
    };
  }
  const op = node as SdfOperation;
  return {
    ...op,
    children: op.children.map(c => deepClone(c)),
  };
}

/** Bicycle-specific animation — rotate wheels, crank chain, pedals */
export function animateBicycle(root: SdfNode, dt: number, speed: number): SdfNode {
  const clone = deepClone(root);
  const wheelSpeed = speed * 3; // rad/s
  const crankSpeed = speed * 2;

  function walk(node: SdfNode) {
    if (isPrimitive(node)) {
      const p = node as SdfPrimitive;
      const label = p.label.toLowerCase();

      // Wheels — rotate around their X axis (they're already rotated 90° around X)
      if (label === 'rueda') {
        // Add rotation around Z in the rotated frame (which is the wheel's spin axis)
        p.rotation[2] = (p.rotation[2] || 0) + wheelSpeed * dt;
      }
    } else {
      (node as SdfOperation).children.forEach(walk);
    }
  }

  walk(clone);

  // Animate chain: find chain spheres and move them along the chain path
  animateChain(clone, dt, crankSpeed);

  return clone;
}

/** Move chain link spheres along the chain run path */
function animateChain(root: SdfNode, dt: number, speed: number) {
  if (!isPrimitive(root)) {
    const op = root as SdfOperation;
    // Chain spheres have radius ~0.005 and are labeled 'Esfera'
    // We identify them by small radius
    let chainLinks: SdfPrimitive[] = [];
    op.children.forEach(child => {
      if (isPrimitive(child)) {
        const p = child as SdfPrimitive;
        if (p.type === 'sphere' && (p.params.radius ?? 1) < 0.01) {
          // Small sphere = likely chain link
          // Only if y position ~ 0.35 (chain height) and not a pedal
          const y = p.position[1];
          if (Math.abs(y - 0.35) < 0.05 || Math.abs(y - 0.338) < 0.05) {
            chainLinks.push(p);
          }
        }
      }
    });

    // Move chain links along X axis (back and forth within sprocket range)
    chainLinks.forEach(link => {
      link.position[0] += Math.sin(speed * dt * 10 + link.position[0] * 20) * 0.001;
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// Stress Visualization Shader Snippet
// ═══════════════════════════════════════════════════════════════

/**
 * Returns extra GLSL code for stress-colored rendering.
 * Replaces the material color based on distance from centroid (simplified von Mises).
 * In a real FEA this would use actual stress tensors — this is a heatmap approximation
 * for visual purposes that highlights thin sections and contact zones.
 */
export const STRESS_GLSL = `
// Stress visualization overlay
vec3 stressColor(float dist) {
  // Near-surface tension (thin walls = high stress)
  float stress = 1.0 / (1.0 + abs(dist) * 50.0);
  // Blue (low) → Green → Yellow → Red (high)
  vec3 low = vec3(0.1, 0.2, 0.8);
  vec3 mid = vec3(0.1, 0.8, 0.2);
  vec3 high = vec3(0.9, 0.2, 0.1);
  return stress < 0.5
    ? mix(low, mid, stress * 2.0)
    : mix(mid, high, (stress - 0.5) * 2.0);
}
`;

// ═══════════════════════════════════════════════════════════════
// Scene Statistics (for simulation info panel)
// ═══════════════════════════════════════════════════════════════

export interface SceneStats {
  totalParts: number;
  primitiveTypes: Record<string, number>;
  boundingBox: { min: [number, number, number]; max: [number, number, number] };
  estimatedVolumeCm3: number;
  estimatedMassKg: number;
}

function collectPrimitives(node: SdfNode): SdfPrimitive[] {
  if (isPrimitive(node)) return [node as SdfPrimitive];
  return (node as SdfOperation).children.flatMap(collectPrimitives);
}

// ── Unit convention ─────────────────────────────────────────────
// 1 scene unit = 1 mm. This matches the variable system: auto-created
// dimension variables (box1_ancho, etc.) carry the raw param value and are
// labeled 'mm' (PARAM_LABELS in gaia-variables.ts). So a box param of 1 == 1 mm.
//   1 mm³ = 1e-3 cm³  →  volume_cm3 = volume_units³ * 1e-3
const MM3_PER_UNIT3 = 1;       // 1 unit³ = 1 mm³
const CM3_PER_MM3 = 1e-3;      // 1 mm³ = 0.001 cm³

/**
 * Loose bounding box of the scene, derived from primitive params. This is only
 * used to bound the voxel sampling grid, so over-estimating is safe.
 */
function looseBoundingBox(prims: SdfPrimitive[]): { min: Vec3; max: Vec3 } {
  let minB: Vec3 = [Infinity, Infinity, Infinity];
  let maxB: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of prims) {
    const r = Math.max(
      p.params.radius ?? 0,
      (p.params.majorRadius ?? 0) + (p.params.minorRadius ?? 0),
      (p.params.sizeX ?? 0) / 2,
      (p.params.sizeY ?? 0) / 2,
      (p.params.sizeZ ?? 0) / 2,
      (p.params.height ?? 0) / 2,
      0.1,
    );
    if (p.type === 'capsule') {
      const cr = p.params.radius ?? 0.05;
      for (let axis = 0; axis < 3; axis++) {
        const a = [p.params.ax, p.params.ay, p.params.az][axis] ?? 0;
        const b = [p.params.bx, p.params.by, p.params.bz][axis] ?? 0;
        minB[axis] = Math.min(minB[axis], Math.min(a, b) - cr);
        maxB[axis] = Math.max(maxB[axis], Math.max(a, b) + cr);
      }
      continue;
    }
    for (let axis = 0; axis < 3; axis++) {
      const center = p.position[axis] ?? 0;
      minB[axis] = Math.min(minB[axis], center - r);
      maxB[axis] = Math.max(maxB[axis], center + r);
    }
  }
  if (!isFinite(minB[0])) { minB = [0, 0, 0]; maxB = [0, 0, 0]; }
  return { min: minB, max: maxB };
}

/**
 * Volume of the *boolean-resolved* solid, in scene units³, by voxel occupancy.
 * Samples the compiled SDF tree (evaluateSdf already applies union/subtract/
 * intersect/smoothUnion correctly), so a subtraction REMOVES volume and an
 * overlapping union is NOT double-counted. Returns units³.
 */
function voxelVolumeUnits3(root: SdfNode, bbox: { min: Vec3; max: Vec3 }, res = 72): number {
  const raw: Vec3 = [
    bbox.max[0] - bbox.min[0],
    bbox.max[1] - bbox.min[1],
    bbox.max[2] - bbox.min[2],
  ];
  // Pad proportionally (3% of the largest extent) so surface voxels aren't
  // clipped while keeping cells tight to the solid (better volume convergence).
  const pad = Math.max(raw[0], raw[1], raw[2], 1e-4) * 0.03;
  const min: Vec3 = [bbox.min[0] - pad, bbox.min[1] - pad, bbox.min[2] - pad];
  const max: Vec3 = [bbox.max[0] + pad, bbox.max[1] + pad, bbox.max[2] + pad];
  const ext: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  if (ext[0] <= 0 || ext[1] <= 0 || ext[2] <= 0) return 0;

  const cell: Vec3 = [ext[0] / res, ext[1] / res, ext[2] / res];
  const cellVol = cell[0] * cell[1] * cell[2];

  let inside = 0;
  for (let i = 0; i < res; i++) {
    const x = min[0] + (i + 0.5) * cell[0];
    for (let j = 0; j < res; j++) {
      const y = min[1] + (j + 0.5) * cell[1];
      for (let k = 0; k < res; k++) {
        const z = min[2] + (k + 0.5) * cell[2];
        if (evaluateSdf(root, [x, y, z]) < 0) inside++;
      }
    }
  }
  return inside * cellVol;
}

export function computeSceneStats(root: SdfNode, densityKgPerCm3 = 0.00785): SceneStats {
  const prims = collectPrimitives(root);
  const types: Record<string, number> = {};
  for (const p of prims) types[p.type] = (types[p.type] || 0) + 1;

  const bbox = looseBoundingBox(prims);

  // Volume via SDF voxelization — honors booleans automatically.
  const volUnits3 = prims.length > 0 ? voxelVolumeUnits3(root, bbox) : 0;
  const volCm3 = volUnits3 * MM3_PER_UNIT3 * CM3_PER_MM3; // units³ → mm³ → cm³
  const massKg = volCm3 * densityKgPerCm3;

  // Keep ~4 significant figures: small (sub-cm³) parts otherwise round to a flat
  // value and boolean deltas (a drilled hole) vanish from the status bar.
  return {
    totalParts: prims.length,
    primitiveTypes: types,
    boundingBox: { min: bbox.min, max: bbox.max },
    estimatedVolumeCm3: round4sig(volCm3),
    estimatedMassKg: round4sig(massKg),
  };
}

/** Round to 4 significant figures (keeps precision across magnitudes). */
function round4sig(x: number): number {
  if (!isFinite(x) || x === 0) return 0;
  const mag = Math.ceil(Math.log10(Math.abs(x)));
  const factor = Math.pow(10, 4 - mag);
  return Math.round(x * factor) / factor;
}
