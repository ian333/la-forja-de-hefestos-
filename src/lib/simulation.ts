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

export function computeSceneStats(root: SdfNode, densityKgPerCm3 = 0.00785): SceneStats {
  const prims = collectPrimitives(root);
  const types: Record<string, number> = {};
  let minB: [number, number, number] = [Infinity, Infinity, Infinity];
  let maxB: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  let totalVol = 0;

  for (const p of prims) {
    types[p.type] = (types[p.type] || 0) + 1;

    // Rough bounding box from position + params
    const r = Math.max(
      p.params.radius ?? 0,
      p.params.majorRadius ?? 0,
      (p.params.sizeX ?? 0) / 2,
      (p.params.height ?? 0) / 2,
      0.1,
    );
    for (let axis = 0; axis < 3; axis++) {
      const center = p.type === 'capsule'
        ? (([p.params.ax, p.params.ay, p.params.az][axis] ?? 0) + ([p.params.bx, p.params.by, p.params.bz][axis] ?? 0)) / 2
        : p.position[axis];
      minB[axis] = Math.min(minB[axis], center - r);
      maxB[axis] = Math.max(maxB[axis], center + r);
    }

    // Rough volume estimate per primitive (in scene units³)
    switch (p.type) {
      case 'sphere': totalVol += (4/3) * Math.PI * (p.params.radius ?? 1) ** 3; break;
      case 'box': totalVol += (p.params.sizeX ?? 1) * (p.params.sizeY ?? 1) * (p.params.sizeZ ?? 1); break;
      case 'cylinder': totalVol += Math.PI * (p.params.radius ?? 0.5) ** 2 * (p.params.height ?? 1); break;
      case 'torus': totalVol += 2 * Math.PI ** 2 * (p.params.majorRadius ?? 1) * (p.params.minorRadius ?? 0.25) ** 2; break;
      case 'capsule': {
        const a: [number,number,number] = [p.params.ax??0,p.params.ay??0,p.params.az??0];
        const b: [number,number,number] = [p.params.bx??0,p.params.by??1,p.params.bz??0];
        const l = Math.sqrt((b[0]-a[0])**2+(b[1]-a[1])**2+(b[2]-a[2])**2);
        const cr = p.params.radius ?? 0.02;
        totalVol += Math.PI * cr ** 2 * l + (4/3) * Math.PI * cr ** 3;
        break;
      }
    }
  }

  // Convert volume: scene units → cm (×10 scale)
  const volCm3 = totalVol * 1000; // 1 scene unit = 10cm → 1 unit³ = 1000cm³
  const massKg = volCm3 * densityKgPerCm3;

  return {
    totalParts: prims.length,
    primitiveTypes: types,
    boundingBox: { min: minB, max: maxB },
    estimatedVolumeCm3: Math.round(volCm3 * 100) / 100,
    estimatedMassKg: Math.round(massKg * 1000) / 1000,
  };
}
