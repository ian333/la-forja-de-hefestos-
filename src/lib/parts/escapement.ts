/**
 * ⚒️ La Forja — Clock Escapement (deadbeat / Graham)
 * =============================================================================
 * The mechanism that makes a clock *tick*. A free pendulum loses energy to air
 * and bearing friction and would die out in minutes; the escapement couples the
 * pendulum to a weighted train so that each half-swing does three things
 * simultaneously:
 *
 *   1. the pallet's *locking face* holds the escape wheel still during most
 *      of the swing (no recoil — the defining property of the DEADBEAT escape;
 *      Graham, 1715);
 *   2. at the pendulum's zero crossing the locking face gives way to the
 *      pallet's *impulse face*, which lets the escape wheel advance by exactly
 *      one tooth (Δθ_e = 2π/N) and in doing so delivers a tiny forward impulse
 *      to the pendulum;
 *   3. the opposite pallet then drops down onto the next tooth, locking the
 *      wheel until the pendulum swings back.
 *
 * One full pendulum period T produces **two ticks** — one on the positive
 * zero-crossing and one on the negative. Therefore:
 *
 *     ω_escape = (2π / N) · (2 / T) = 4π / (N · T)      [rad / s]
 *
 * Period in the small-amplitude limit (simple pendulum):
 *
 *     T = 2π · √(L / g)
 *
 * At larger amplitudes the period lengthens via the classical series
 *
 *     T ≈ 2π·√(L/g) · [ 1 + (1/16)·A² + (11/3072)·A⁴ + … ]    A in radians.
 *
 * We implement both:  `simplePeriod(L, g)` gives the linearised value;
 * `pendulumPeriod(L, g, A)` includes the fourth-order correction which is the
 * interesting regime for real clocks (A ≈ 3°–6° ⇒ correction ~3·10⁻⁵).
 *
 * The pendulum swings according to
 *
 *     θ(t) = A · cos( 2π·t / T )                    (starts at +A at t = 0)
 *
 * Ticks fire at the zero-crossings t_k = (T/4)·(2k + 1), k = 0, 1, 2 …
 * Between ticks the escape wheel is locked (dead beat — no recoil). After the
 * k-th tick the wheel angle is
 *
 *     θ_e(t) = (2π / N) · ticksReleased(t),
 *     ticksReleased(t) = ⌊ (t / (T/2)) + 0.5 ⌋                (nearest half-period edge)
 *
 * The anchor tracks the pendulum with an optional gear ratio k_anchor (most
 * real escapements have k_anchor = 1 — anchor and pendulum share the same
 * crutch shaft).
 *
 * All kinematics are pure, synchronous functions of the input params.
 */

import {
  makeBox,
  makeCylinder,
  makeModule,
  makeOp,
  makePolygonExtrusion,
  type SdfModule,
  type SdfNode,
  type SdfOperation,
} from '../sdf-engine';
import { makeRevoluteJoint, type Joint } from '../joints';

// ─────────────────────────────────────────────────────────────
// Params
// ─────────────────────────────────────────────────────────────

export interface EscapementParams {
  /** Number of teeth on the escape wheel. Graham's classic is N = 30 (seconds wheel). */
  teethCount: number;
  /** Pitch (tip) radius of the escape wheel. */
  wheelRadius: number;
  /** Radial depth of each tooth (tip − valley). */
  toothDepth: number;
  /** Axial thickness of the escape wheel and anchor. */
  thickness: number;
  /** Pendulum length L (simple pendulum: from pivot to centre of bob). */
  pendulumLength: number;
  /** Gravitational acceleration g. Earth = 9.80665. */
  gravity: number;
  /** Pendulum amplitude A (rad). Small for a clock: 0.05 rad ≈ 2.9°. */
  amplitude: number;
  /** Anchor-to-pendulum angular ratio. Real clocks: k = 1. */
  anchorRatio: number;
  /** Radius of the pendulum bob. */
  bobRadius: number;
  /** Half-width of the pendulum rod. */
  rodHalfWidth: number;
  /** Pallet span — half-angle between the two pallets measured at the anchor pivot. */
  palletSpan: number;
  /** Anchor-arm length from pivot to each pallet tip. */
  anchorArm: number;
  /** Vertical distance from the escape-wheel centre to the anchor pivot. */
  anchorOffset: number;
  /** Time t (s) at which to evaluate the kinematics. */
  time: number;
  /** Vertex count for circle approximations. */
  circleResolution: number;
}

export const ESCAPEMENT_DEFAULTS: EscapementParams = {
  teethCount: 30,
  wheelRadius: 0.4,
  toothDepth: 0.08,
  thickness: 0.04,
  pendulumLength: 0.994,        // seconds pendulum at g = 9.80665 ⇒ T = 2π·√(L/g) = 2.000 s
  gravity: 9.80665,
  amplitude: 0.05,              // ~2.9°
  anchorRatio: 1.0,
  bobRadius: 0.06,
  rodHalfWidth: 0.01,
  palletSpan: 0.14,
  anchorArm: 0.52,
  anchorOffset: 0.56,
  time: 0,
  circleResolution: 48,
};

// ─────────────────────────────────────────────────────────────
// Period helpers
// ─────────────────────────────────────────────────────────────

/** Small-amplitude (linearised) period  T₀ = 2π·√(L/g). */
export function simplePeriod(length: number, gravity: number): number {
  return 2 * Math.PI * Math.sqrt(length / gravity);
}

/**
 * Pendulum period with amplitude correction up to O(A⁴):
 *   T(A) = T₀ · (1 + A²/16 + 11·A⁴/3072)
 * Exact to ~1 ppm for A up to ~30°; dominates over the linearised value at
 * the amplitudes real clocks use.
 */
export function pendulumPeriod(length: number, gravity: number, amplitude: number): number {
  const A = amplitude;
  const T0 = simplePeriod(length, gravity);
  return T0 * (1 + (A * A) / 16 + (11 * A * A * A * A) / 3072);
}

// ─────────────────────────────────────────────────────────────
// Derived geometry
// ─────────────────────────────────────────────────────────────

export interface EscapementDerived {
  /** Angular step between consecutive teeth, 2π/N. */
  toothAngle: number;
  /** Period T₀ (small-amplitude). */
  periodSimple: number;
  /** Period T including the fourth-order amplitude correction. */
  period: number;
  /** Escape wheel angular velocity, time-averaged: ω = (2π/N)·(2/T). */
  escapeAngularVelocity: number;
  /** Tooth tip radius r_tip (= wheelRadius). */
  tipRadius: number;
  /** Tooth root radius r_root = r_tip − toothDepth. */
  rootRadius: number;
  /** True when palletSpan is at least wide enough to bridge two teeth (> π/N). */
  palletBridgesTwoTeeth: boolean;
}

export function escapementGeometry(p: EscapementParams): EscapementDerived {
  if (p.teethCount < 6) {
    throw new Error(`Escapement teethCount must be ≥ 6 (got ${p.teethCount})`);
  }
  if (p.pendulumLength <= 0) {
    throw new Error(`Escapement pendulumLength must be > 0 (got ${p.pendulumLength})`);
  }
  if (p.gravity <= 0) {
    throw new Error(`Escapement gravity must be > 0 (got ${p.gravity})`);
  }
  if (p.amplitude <= 0 || p.amplitude > Math.PI / 3) {
    throw new Error(`Escapement amplitude must be in (0, π/3] (got ${p.amplitude})`);
  }
  const toothAngle = (2 * Math.PI) / p.teethCount;
  const periodSimple = simplePeriod(p.pendulumLength, p.gravity);
  const period = pendulumPeriod(p.pendulumLength, p.gravity, p.amplitude);
  const escapeAngularVelocity = (2 * toothAngle) / period;
  return {
    toothAngle,
    periodSimple,
    period,
    escapeAngularVelocity,
    tipRadius: p.wheelRadius,
    rootRadius: p.wheelRadius - p.toothDepth,
    palletBridgesTwoTeeth: p.palletSpan > Math.PI / p.teethCount,
  };
}

// ─────────────────────────────────────────────────────────────
// Kinematics t → (pendulumAngle, anchorAngle, escapeAngle, ticks)
// ─────────────────────────────────────────────────────────────

export interface EscapementKinematics {
  /** Pendulum angle θ_p(t) = A·cos(2π·t/T). */
  pendulumAngle: number;
  /** Anchor angle = anchorRatio · pendulumAngle. */
  anchorAngle: number;
  /** Ticks released since t = 0 (nearest-half-period rounding). */
  ticksReleased: number;
  /** Escape wheel angle = ticksReleased · toothAngle. */
  escapeAngle: number;
  /** Time within the current half-period ∈ [0, T/2). */
  phaseInHalfPeriod: number;
  /** Which pallet is currently locking (true = entry = +X side, false = exit). */
  entryPalletLocking: boolean;
  /**
   * Pendulum angular velocity ω_p(t) = −A·(2π/T)·sin(2π·t/T).
   * Exposed separately because impulse-delivery diagnostics rely on it.
   */
  pendulumVelocity: number;
}

export function escapementKinematics(p: EscapementParams): EscapementKinematics {
  const g = escapementGeometry(p);
  const T = g.period;
  const omega = (2 * Math.PI) / T;
  const pendulumAngle = p.amplitude * Math.cos(omega * p.time);
  const anchorAngle = p.anchorRatio * pendulumAngle;
  const pendulumVelocity = -p.amplitude * omega * Math.sin(omega * p.time);

  // Ticks: count half-periods that have elapsed, rounded to the nearest edge.
  // A positive time exactly at t = T/4 (the first zero-crossing) is the first
  // tick, so we shift by +0.5 before flooring.
  const halfPeriods = p.time / (T / 2);
  const ticksReleased = Math.floor(halfPeriods + 0.5);
  const escapeAngle = ticksReleased * g.toothAngle;

  const phaseInHalfPeriod = ((p.time % (T / 2)) + T / 2) % (T / 2);

  // Entry pallet (right-hand, +X side) is the one locking when the pendulum
  // is in the negative half of its cycle (between the first and second tick).
  // Tick counter is even ⇒ entry locking; odd ⇒ exit locking.
  const entryPalletLocking = ticksReleased % 2 === 0;

  return {
    pendulumAngle,
    anchorAngle,
    ticksReleased,
    escapeAngle,
    phaseInHalfPeriod,
    entryPalletLocking,
    pendulumVelocity,
  };
}

// ─────────────────────────────────────────────────────────────
// Scene build — escape wheel + anchor + pendulum
// ─────────────────────────────────────────────────────────────

export interface EscapementBuild {
  escapeWheel: SdfModule;
  anchor: SdfModule;
  pendulum: SdfModule;
  joints: Joint[];
  rootOp: SdfOperation;
  geometry: EscapementDerived;
  kinematics: EscapementKinematics;
  params: EscapementParams;
}

/**
 * Escape-wheel cross-section: a star polygon with N triangular teeth, root at
 * r_root, tip at r_tip. The tooth faces are straight radii (sawtooth profile,
 * leading edge advances in the direction of rotation).
 */
function escapeWheelVerts(p: EscapementParams, g: EscapementDerived): [number, number][] {
  const out: [number, number][] = [];
  const N = p.teethCount;
  const rTip = g.tipRadius;
  const rRoot = g.rootRadius;
  for (let i = 0; i < N; i++) {
    // Leading (radial) edge — at angle i·dθ the tooth TIP sits, then we drop
    // straight down to the root at angle (i + 1/2)·dθ. (Sawtooth pointing in
    // the −θ direction, wheel rotates CCW, the pallet catches the leading
    // face.)
    const tipA = (2 * Math.PI * i) / N;
    const rootA = (2 * Math.PI * (i + 0.5)) / N;
    out.push([rTip * Math.cos(tipA), rTip * Math.sin(tipA)]);
    out.push([rRoot * Math.cos(rootA), rRoot * Math.sin(rootA)]);
  }
  return out;
}

export function buildEscapement(params: EscapementParams = ESCAPEMENT_DEFAULTS): EscapementBuild {
  const g = escapementGeometry(params);
  const k = escapementKinematics(params);

  // ── Escape wheel: star polygon, rotated by escapeAngle.
  const wheelVerts = escapeWheelVerts(params, g);
  const wheelBody = makePolygonExtrusion(
    wheelVerts,
    params.thickness,
    [0, 0, 0],
    [0, 0, k.escapeAngle],
    'Escape wheel — teeth',
  );
  const wheelUnion = makeOp('union', [wheelBody]);
  wheelUnion.label = 'Escape wheel — union';
  const escapeWheel = makeModule('Escape wheel');
  escapeWheel.children = [wheelUnion];

  // ── Anchor: yoke of length 2·anchorArm with two pallets at ±palletSpan.
  // Modelled as a rotated box (the crutch) plus two small pallet blocks.
  const anchorPivot: [number, number, number] = [0, params.anchorOffset, 0];
  const arm = params.anchorArm;
  const yoke = makeBox(anchorPivot, [arm * 2, params.rodHalfWidth * 2, params.thickness]);
  yoke.rotation = [0, 0, k.anchorAngle];
  yoke.label = 'Anchor — yoke';

  const palletSize: [number, number, number] = [
    params.wheelRadius * 0.06,
    params.wheelRadius * 0.12,
    params.thickness * 1.2,
  ];
  // Pallets are placed at angles ±palletSpan from the anchor's local +X axis,
  // on a circle of radius anchorArm from the anchor pivot; then the whole
  // anchor frame is rotated by anchorAngle.
  const lPx = anchorPivot[0] + arm * Math.cos(Math.PI - params.palletSpan + k.anchorAngle);
  const lPy = anchorPivot[1] + arm * Math.sin(Math.PI - params.palletSpan + k.anchorAngle);
  const rPx = anchorPivot[0] + arm * Math.cos(params.palletSpan + k.anchorAngle);
  const rPy = anchorPivot[1] + arm * Math.sin(params.palletSpan + k.anchorAngle);
  const leftPallet = makeBox([lPx, lPy, 0], palletSize);
  leftPallet.rotation = [0, 0, k.anchorAngle];
  leftPallet.label = 'Anchor — left pallet';
  const rightPallet = makeBox([rPx, rPy, 0], palletSize);
  rightPallet.rotation = [0, 0, k.anchorAngle];
  rightPallet.label = 'Anchor — right pallet';

  const anchorUnion = makeOp('union', [yoke, leftPallet, rightPallet]);
  anchorUnion.label = 'Anchor — union';
  const anchor = makeModule('Anchor');
  anchor.children = [anchorUnion];

  // ── Pendulum: a thin rod hanging from the anchor pivot, with a bob at the
  // bottom. The whole unit rotates by pendulumAngle about the pivot.
  const L = params.pendulumLength;
  // Rod as a polygon extrusion along −Y from the pivot, length L, width rodHalfWidth.
  const rw = params.rodHalfWidth;
  const rodVerts: [number, number][] = [
    [-rw, 0],
    [rw, 0],
    [rw, -L],
    [-rw, -L],
  ];
  const rod = makePolygonExtrusion(
    rodVerts,
    params.thickness * 0.6,
    anchorPivot,
    [0, 0, k.pendulumAngle],
    'Pendulum — rod',
  );

  // Bob position: rotated by pendulumAngle about the anchor pivot, at distance L.
  const bobLocal: [number, number] = [0, -L];
  const cosP = Math.cos(k.pendulumAngle);
  const sinP = Math.sin(k.pendulumAngle);
  const bobX = anchorPivot[0] + bobLocal[0] * cosP - bobLocal[1] * sinP;
  const bobY = anchorPivot[1] + bobLocal[0] * sinP + bobLocal[1] * cosP;
  const bob = makeCylinder([bobX, bobY, 0], params.bobRadius, params.thickness * 1.4);
  bob.rotation = [Math.PI / 2, 0, 0];
  bob.label = 'Pendulum — bob';

  const pendulumUnion = makeOp('union', [rod, bob]);
  pendulumUnion.label = 'Pendulum — union';
  const pendulum = makeModule('Pendulum');
  pendulum.children = [pendulumUnion];

  // ── Joints
  const groundId = 'ground';
  const joints: Joint[] = [
    makeRevoluteJoint(groundId, escapeWheel.id, [0, 0, 0], [0, 0, 1],
      { drive: k.escapeAngle, label: 'Escape wheel revolute' }),
    makeRevoluteJoint(groundId, anchor.id, anchorPivot, [0, 0, 1],
      { drive: k.anchorAngle, label: 'Anchor revolute' }),
    makeRevoluteJoint(groundId, pendulum.id, anchorPivot, [0, 0, 1],
      { drive: k.pendulumAngle, label: 'Pendulum revolute' }),
  ];

  const children: SdfNode[] = [escapeWheel, anchor, pendulum];
  const rootOp = makeOp('union', children);
  rootOp.label = 'Clock escapement';

  return {
    escapeWheel,
    anchor,
    pendulum,
    joints,
    rootOp,
    geometry: g,
    kinematics: k,
    params,
  };
}

export function buildEscapementScene(params?: EscapementParams): SdfOperation {
  return buildEscapement(params).rootOp;
}
