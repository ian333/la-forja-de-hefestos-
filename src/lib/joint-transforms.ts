/**
 * Joint Transforms — bakes drive values into module geometry.
 *
 * The SDF compiler / worker only know about primitive positions & rotations.
 * To make a joint's `drive` visually move geometry, we walk the joint graph
 * before compilation and rewrite the positions/rotations of primitives
 * inside each "driven" module.
 *
 * For each module B connected to A via a joint J(drive=θ), B's transform
 * is parent(A) × local(J, θ). Applied recursively.
 */

import * as THREE from 'three';
import {
  isPrimitive,
  isModule,
  isContainer,
  type SdfNode,
  type SdfPrimitive,
  type SdfOperation,
  type SdfModule,
} from './sdf-engine';
import type { Joint } from './joints';

// ─────────────────────────────────────────────────────────────
// Per-module transform (position + quaternion)
// ─────────────────────────────────────────────────────────────

interface Xform {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
}

function identity(): Xform {
  return { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
}

/** Compose two transforms: result = a ∘ b (apply b first, then a). */
function compose(a: Xform, b: Xform): Xform {
  const pos = b.pos.clone().applyQuaternion(a.quat).add(a.pos);
  const quat = a.quat.clone().multiply(b.quat);
  return { pos, quat };
}

/** Revolute joint local transform: rotate by `drive` rad around `axis` at `origin`. */
function localRevolute(origin: [number, number, number], axis: [number, number, number], drive: number): Xform {
  const ax = new THREE.Vector3(...axis).normalize();
  const q = new THREE.Quaternion().setFromAxisAngle(ax, drive);
  // T = translate(origin) · rotate(q) · translate(-origin)
  const o = new THREE.Vector3(...origin);
  const pos = o.clone().sub(o.clone().applyQuaternion(q));
  return { pos, quat: q };
}

/** Slider joint local transform: translate by drive * axis. */
function localSlider(axis: [number, number, number], drive: number): Xform {
  const ax = new THREE.Vector3(...axis).normalize().multiplyScalar(drive);
  return { pos: ax, quat: new THREE.Quaternion() };
}

/** Build moduleId → world transform map from the joint graph. */
export function computeModuleTransforms(joints: Joint[]): Map<string, Xform> {
  const transforms = new Map<string, Xform>();

  // Build adjacency: a → [{ joint, child: b }]
  const children = new Map<string, { joint: Joint; child: string }[]>();
  const hasParent = new Set<string>();
  for (const j of joints) {
    if (!children.has(j.a)) children.set(j.a, []);
    children.get(j.a)!.push({ joint: j, child: j.b });
    hasParent.add(j.b);
  }

  // Roots = modules that appear as `a` but never as `b`
  const roots = new Set<string>();
  for (const j of joints) if (!hasParent.has(j.a)) roots.add(j.a);

  // BFS from each root, composing transforms
  const visited = new Set<string>();
  const queue: string[] = [...roots];
  for (const r of roots) transforms.set(r, identity());

  while (queue.length) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue; // cycle safeguard
    visited.add(cur);
    const parentX = transforms.get(cur) ?? identity();
    for (const { joint, child } of children.get(cur) ?? []) {
      let local: Xform;
      switch (joint.type) {
        case 'rigid':   local = identity(); break;
        case 'revolute':local = localRevolute(joint.origin, joint.axis, joint.drive); break;
        case 'slider':  local = localSlider(joint.axis, joint.drive); break;
      }
      const childX = compose(parentX, local);
      transforms.set(child, childX);
      queue.push(child);
    }
  }

  return transforms;
}

// ─────────────────────────────────────────────────────────────
// Scene baking — apply transforms to primitives inside driven modules
// ─────────────────────────────────────────────────────────────

function applyXformToPrimitive(prim: SdfPrimitive, x: Xform): SdfPrimitive {
  // Capsule endpoints are absolute — rotate both
  if (prim.type === 'capsule') {
    const a = new THREE.Vector3(prim.params.ax ?? 0, prim.params.ay ?? 0, prim.params.az ?? 0)
      .applyQuaternion(x.quat).add(x.pos);
    const b = new THREE.Vector3(prim.params.bx ?? 0, prim.params.by ?? 1, prim.params.bz ?? 0)
      .applyQuaternion(x.quat).add(x.pos);
    return { ...prim, params: { ...prim.params, ax: a.x, ay: a.y, az: a.z, bx: b.x, by: b.y, bz: b.z } };
  }

  // Position: rotate then translate
  const p = new THREE.Vector3(...prim.position).applyQuaternion(x.quat).add(x.pos);
  // Rotation: compose quaternions
  const rEuler = prim.rotation ?? [0, 0, 0];
  const rQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rEuler[0], rEuler[1], rEuler[2], 'XYZ'));
  const combinedQ = x.quat.clone().multiply(rQuat);
  const newEuler = new THREE.Euler().setFromQuaternion(combinedQ, 'XYZ');

  return {
    ...prim,
    position: [p.x, p.y, p.z],
    rotation: [newEuler.x, newEuler.y, newEuler.z],
  };
}

function bakeNode(node: SdfNode, activeXform: Xform, transforms: Map<string, Xform>): SdfNode {
  if (isPrimitive(node)) {
    // Only bake if we're inside a driven module
    if (activeXform.pos.lengthSq() < 1e-20 && activeXform.quat.w >= 0.9999999) return node;
    return applyXformToPrimitive(node, activeXform);
  }

  if (isModule(node)) {
    const mx = transforms.get(node.id);
    const childX = mx ?? activeXform;
    const baked = node.children.map(c => bakeNode(c, childX, transforms));
    return { ...node, children: baked } as SdfModule;
  }

  // Operation (union/subtract/…): pass through active transform
  const op = node as SdfOperation;
  const baked = op.children.map(c => bakeNode(c, activeXform, transforms));
  return { ...op, children: baked };
}

/**
 * Produce a new scene where primitives inside driven modules have their
 * positions/rotations rewritten to reflect the joint drives. The compiler
 * and worker can then ignore joints entirely.
 */
export function bakeJointTransforms(scene: SdfOperation, joints: Joint[]): SdfOperation {
  if (joints.length === 0) return scene;
  const transforms = computeModuleTransforms(joints);
  if (transforms.size === 0) return scene;
  return bakeNode(scene, identity(), transforms) as SdfOperation;
}

// ─────────────────────────────────────────────────────────────
// Introspection helpers for UI
// ─────────────────────────────────────────────────────────────

/** Find all modules referenced by the scene (flat list). */
export function collectModules(node: SdfNode): SdfModule[] {
  const out: SdfModule[] = [];
  const walk = (n: SdfNode) => {
    if (isModule(n)) out.push(n);
    if (isContainer(n)) n.children.forEach(walk);
  };
  walk(node);
  return out;
}
