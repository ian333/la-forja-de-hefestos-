/**
 * La Forja — Joints (Assembly Kinematics)
 * =========================================
 * Joints live parallel to the SDF tree: they don't affect geometry
 * evaluation, they describe how two `SdfModule`s move relative to each
 * other. The UI (graph editor + scrubber) reads this list; the compiler
 * reads the `drive` values and applies a rigid transform to the `b` side
 * of each joint when evaluating the child module's SDF.
 *
 * v1 supports rigid / revolute / slider — covers ~85% of real assemblies.
 * Cylindrical / planar / ball come later.
 */

export type JointType = 'rigid' | 'revolute' | 'slider';

export type Vec3 = [number, number, number];

interface JointBase {
  id: string;
  type: JointType;
  label: string;
  /** Parent component (grounded side). Module id. */
  a: string;
  /** Child component (moves relative to `a`). Module id. */
  b: string;
  /** Anchor point in world coords at assembly time. */
  origin: Vec3;
}

export interface RigidJoint extends JointBase {
  type: 'rigid';
}

export interface RevoluteJoint extends JointBase {
  type: 'revolute';
  /** Rotation axis (unit vector). */
  axis: Vec3;
  /** Optional limits in radians. Omit = unbounded. */
  limits?: { min: number; max: number };
  /** Current drive value (rad). Default 0. */
  drive: number;
}

export interface SliderJoint extends JointBase {
  type: 'slider';
  /** Translation axis (unit vector). */
  axis: Vec3;
  /** Optional limits in scene units. Omit = unbounded. */
  limits?: { min: number; max: number };
  /** Current drive value (scene units). Default 0. */
  drive: number;
}

export type Joint = RigidJoint | RevoluteJoint | SliderJoint;

// ═══════════════════════════════════════════════════════════════
// Factories
// ═══════════════════════════════════════════════════════════════

let _jid = 0;
function jid(): string { return `jt${++_jid}`; }

export function makeRigidJoint(a: string, b: string, origin: Vec3 = [0, 0, 0], label = 'Rígido'): RigidJoint {
  return { id: jid(), type: 'rigid', label, a, b, origin };
}

export function makeRevoluteJoint(
  a: string, b: string, origin: Vec3, axis: Vec3,
  opts: { limits?: { min: number; max: number }; drive?: number; label?: string } = {},
): RevoluteJoint {
  return {
    id: jid(), type: 'revolute',
    label: opts.label ?? 'Bisagra',
    a, b, origin, axis: normalize3(axis),
    limits: opts.limits,
    drive: opts.drive ?? 0,
  };
}

export function makeSliderJoint(
  a: string, b: string, origin: Vec3, axis: Vec3,
  opts: { limits?: { min: number; max: number }; drive?: number; label?: string } = {},
): SliderJoint {
  return {
    id: jid(), type: 'slider',
    label: opts.label ?? 'Lineal',
    a, b, origin, axis: normalize3(axis),
    limits: opts.limits,
    drive: opts.drive ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

export function normalize3(v: Vec3): Vec3 {
  const L = Math.hypot(v[0], v[1], v[2]);
  if (L < 1e-9) return [1, 0, 0];
  return [v[0] / L, v[1] / L, v[2] / L];
}

/** Clamp a drive value against the joint's limits (no-op if none). */
export function clampDrive(joint: RevoluteJoint | SliderJoint, value: number): number {
  if (!joint.limits) return value;
  return Math.max(joint.limits.min, Math.min(joint.limits.max, value));
}

/**
 * Summarize a joint in one line. Used by the AI panel.
 */
export function describeJoint(j: Joint): string {
  switch (j.type) {
    case 'rigid':
      return `${j.label}: ${j.a} ↔ ${j.b} (rígido)`;
    case 'revolute':
      return `${j.label}: ${j.a} ↔ ${j.b} (revolute, drive=${j.drive.toFixed(3)} rad)`;
    case 'slider':
      return `${j.label}: ${j.a} ↔ ${j.b} (slider, drive=${j.drive.toFixed(3)})`;
  }
}
