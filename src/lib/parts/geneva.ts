/**
 * ⚒️ La Forja — Geneva Drive (external, N-slot intermittent rotary mechanism)
 * =============================================================================
 * Converts continuous rotation on the driver (crank) shaft into step-wise
 * rotation of the driven (Maltese / Geneva) wheel: one full turn of the driver
 * advances the Geneva by 2π/N (one slot). Between engagements the Geneva is
 * held by the locking arc — in this library we model the kinematics and scene
 * geometry; the lock arc is represented implicitly through the zero-velocity
 * dwell region and a circular guard visible on the driver disc.
 *
 * Geometric constraint (external Geneva):
 *   sin(π/N) = a / C      (slot radial at entry is tangent to pin path)
 *   b        = C · cos(π/N)   (Geneva wheel outer radius)
 *   α        = arccos(a/C) = π/2 − π/N   (half-angle of the engagement arc of the driver)
 *
 * One driver revolution contains exactly ONE engagement window of half-width α
 * centered at θ_D = 0 (mod 2π). Engagement fraction = 2α/(2π) = 1/2 − 1/N.
 * Dwell fraction                                        = 1 − (1/2 − 1/N) = 1/2 + 1/N.
 *
 * Kinematics during engagement (θ_D ∈ [−α, +α]):
 *   Let p = (a·cos θ_D, a·sin θ_D) be the pin in driver frame.
 *   The slot aligns with vector (Geneva center → pin) = (a·cos θ_D − C, a·sin θ_D).
 *   Its world angle  β(θ_D) = atan2(a·sin θ_D, a·cos θ_D − C)
 *   Geneva angle     φ_G(θ_D) = β(θ_D) − π   (plus integer multiples of 2π/N per
 *   completed engagement).
 *
 * Between engagements the Geneva is parked at the "rest" position
 *   φ_G_rest(k) = −(2π/N)·(k + ½)   after the (k+1)-th engagement has completed.
 *
 * Rotation direction is opposite (driver CCW → Geneva CW) — this is an external
 * mesh, just like a gear pair.
 */

import {
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

export interface GenevaParams {
  /** Number of radial slots on the Geneva wheel. Must be ≥ 3. */
  slotCount: number;
  /** Distance from the driver axis to the pin. All other dimensions scale from this. */
  crankRadius: number;
  /** Radius of the pin (small cylinder riding in the slot). */
  pinRadius: number;
  /** Width of each radial slot. Must be ≥ 2·pinRadius to accept the pin. */
  slotWidth: number;
  /** Depth of each slot (from rim toward Geneva center). Default: wheel radius minus a margin. */
  slotDepth: number;
  /** Axial thickness of both wheels. */
  thickness: number;
  /** Drive angle θ_D applied to the crank (rad). */
  drive: number;
  /** Resolution (vertex count) of circular outlines in SDF polygons. */
  circleResolution: number;
}

export const GENEVA_DEFAULTS: GenevaParams = {
  slotCount: 4,
  crankRadius: 1.0,
  pinRadius: 0.12,
  slotWidth: 0.28,
  slotDepth: 0.65,
  thickness: 0.35,
  drive: 0,
  circleResolution: 32,
};

// ─────────────────────────────────────────────────────────────
// Derived geometry (pure, synchronous — ideal for invariant tests)
// ─────────────────────────────────────────────────────────────

export interface GenevaDerived {
  /** Center distance C between driver axis and Geneva axis. */
  centerDistance: number;
  /** Outer radius b of the Geneva wheel. */
  wheelRadius: number;
  /** Half-angle α of engagement on the driver (α = π/2 − π/N). */
  engagementHalfAngle: number;
  /** Fraction of one driver revolution during which the pin is engaged. */
  engagementFraction: number;
  /** Fraction during which the Geneva is locked (idle). */
  dwellFraction: number;
  /** Driver angle advance per engagement window (= 2·α). */
  engagementArc: number;
  /** Geneva angle advance per engagement (= 2π/N, magnitude). */
  slotAngle: number;
}

export function genevaGeometry(p: GenevaParams): GenevaDerived {
  if (p.slotCount < 3) {
    throw new Error(`Geneva slotCount must be ≥ 3 (got ${p.slotCount})`);
  }
  const centerDistance = p.crankRadius / Math.sin(Math.PI / p.slotCount);
  const wheelRadius = centerDistance * Math.cos(Math.PI / p.slotCount);
  const alpha = Math.PI / 2 - Math.PI / p.slotCount;
  return {
    centerDistance,
    wheelRadius,
    engagementHalfAngle: alpha,
    engagementFraction: 0.5 - 1 / p.slotCount,
    dwellFraction: 0.5 + 1 / p.slotCount,
    engagementArc: 2 * alpha,
    slotAngle: (2 * Math.PI) / p.slotCount,
  };
}

// ─────────────────────────────────────────────────────────────
// Kinematic law θ_G(θ_D)
// ─────────────────────────────────────────────────────────────

export interface GenevaKinematics {
  /** Whether the pin is currently inside a slot. */
  engaged: boolean;
  /** Integer engagement index — how many engagements have completed so far (Math.round-based). */
  cycleIndex: number;
  /** θ_D − 2π·cycleIndex — phase relative to the nearest engagement center. */
  localPhase: number;
  /** Geneva absolute angle φ_G (rad). */
  drivenAngle: number;
}

export function genevaKinematics(p: GenevaParams): GenevaKinematics {
  const g = genevaGeometry(p);
  const alpha = g.engagementHalfAngle;
  const slot = g.slotAngle;
  const C = g.centerDistance;
  const a = p.crankRadius;

  // Nearest engagement center is at θ_D = 2π·k.
  const k = Math.round(p.drive / (2 * Math.PI));
  const localPhase = p.drive - 2 * Math.PI * k;

  // Dwell position: before engagement k the Geneva is at +slot/2 · sign(-localPhase),
  // after engagement k it is at −slot/2 · sign(-localPhase). In terms of k alone:
  //   rest_before_k = slot/2 − slot·k   (Geneva waiting to receive engagement k)
  //   rest_after_k  = −slot/2 − slot·k  (Geneva has received engagement k)
  // which is consistent with rest_before_(k+1) = rest_after_k.
  if (Math.abs(localPhase) >= alpha) {
    const sign = localPhase > 0 ? -1 : +1; // past engagement k → "after"; before → "before"
    return {
      engaged: false,
      cycleIndex: k,
      localPhase,
      drivenAngle: -slot * k + (sign * slot) / 2,
    };
  }

  // Engaged — compute β and unwrap delta = β − π into (−π, π].
  const px = a * Math.cos(localPhase);
  const py = a * Math.sin(localPhase);
  const beta = Math.atan2(py, px - C);
  let delta = beta - Math.PI;
  if (delta <= -Math.PI) delta += 2 * Math.PI;
  if (delta > Math.PI) delta -= 2 * Math.PI;

  return {
    engaged: true,
    cycleIndex: k,
    localPhase,
    drivenAngle: -slot * k + delta,
  };
}

// ─────────────────────────────────────────────────────────────
// Scene build (SDF modules + revolute joints)
// ─────────────────────────────────────────────────────────────

export interface GenevaBuild {
  driver: SdfModule;
  geneva: SdfModule;
  joints: Joint[];
  rootOp: SdfOperation;
  geometry: GenevaDerived;
  kinematics: GenevaKinematics;
  params: GenevaParams;
}

function circleVerts(
  cx: number,
  cy: number,
  r: number,
  n: number,
  phase = 0,
): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = phase + (2 * Math.PI * i) / n;
    out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return out;
}

/**
 * Geneva wheel 2D cross-section: start from a regular polygon (outer circle),
 * then carve N radial slots by replacing the vertices on each slot-centered
 * side with two parallel cuts going inward. We take the algorithmic shortcut
 * of generating the polygon as a series of arc-segments interrupted by slot
 * rectangles — cleaner to read than CSG on extrusions.
 *
 * Geneva at rest before engagement 0 has its first slot pointing at the driver
 * (+X direction in its local frame). We generate vertices CCW.
 */
function buildGenevaWheelVerts(
  p: GenevaParams,
  g: GenevaDerived,
): [number, number][] {
  const { slotCount: N, slotWidth: w, slotDepth: d } = p;
  const R = g.wheelRadius;
  // Half-angle subtended by the slot mouth on the rim: 2·asin((w/2)/R)
  const slotHalf = Math.asin((w / 2) / R);
  const arcSteps = Math.max(2, Math.floor(p.circleResolution / N));

  const out: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const slotCenter = i * ((2 * Math.PI) / N); // first slot at angle 0
    // Arc from previous slot's trailing edge to this slot's leading edge.
    const arcStart = slotCenter - (2 * Math.PI) / N + slotHalf;
    const arcEnd = slotCenter - slotHalf;
    for (let j = 0; j <= arcSteps; j++) {
      const t = arcStart + ((arcEnd - arcStart) * j) / arcSteps;
      out.push([R * Math.cos(t), R * Math.sin(t)]);
    }
    // Now the slot itself: into the wheel along the slot-center direction.
    // Leading rim point:  R·(cos(slotCenter − slotHalf), …)
    // Inner point:        (R − d)·(cos(slotCenter), sin(slotCenter)) ± half-width perpendicular.
    const cx = Math.cos(slotCenter);
    const cy = Math.sin(slotCenter);
    const nx = -cy; // unit perpendicular (90° CCW)
    const ny = cx;
    const innerR = Math.max(0.05, R - d);
    // Go to inner-leading corner: innerR along (cx,cy) + (w/2) in −perpendicular direction.
    out.push([innerR * cx - (w / 2) * nx, innerR * cy - (w / 2) * ny]);
    // Inner-trailing corner:   innerR along (cx,cy) + (w/2) in +perpendicular direction.
    out.push([innerR * cx + (w / 2) * nx, innerR * cy + (w / 2) * ny]);
    // Back out to trailing rim corner — the arc of the next iteration starts there.
  }
  return out;
}

export function buildGeneva(params: GenevaParams = GENEVA_DEFAULTS): GenevaBuild {
  const g = genevaGeometry(params);
  const k = genevaKinematics(params);

  // ── Driver: disc of radius a + ε, with a pin at radius a in the direction of θ_D.
  // Driver module contains a single union operation (polygon disc ∪ pin cylinder);
  // this mirrors the spur-gear structure that the SDF renderer is tuned for.
  const driverRadius = params.crankRadius * 1.05;
  const driverDisc = makePolygonExtrusion(
    circleVerts(0, 0, driverRadius, params.circleResolution),
    params.thickness,
    [0, 0, 0],
    [0, 0, params.drive],
    'Driver — disc',
  );
  // Pin in the driver frame: rotate position by params.drive around Z.
  const cosD = Math.cos(params.drive);
  const sinD = Math.sin(params.drive);
  const pinX = params.crankRadius * cosD;
  const pinY = params.crankRadius * sinD;
  const pin = makeCylinder(
    [pinX, pinY, params.thickness * 0.5],
    params.pinRadius,
    params.thickness * 1.1,
  );
  pin.rotation = [Math.PI / 2, 0, 0];
  pin.label = 'Driver — pin';

  const driverUnion = makeOp('union', [driverDisc, pin]);
  driverUnion.label = 'Driver — union';
  const driver = makeModule('Geneva driver');
  driver.children = [driverUnion];

  // ── Geneva wheel: polygon with N slots, translated to (C,0) and rotated by drivenAngle.
  const wheelVerts = buildGenevaWheelVerts(params, g);
  const wheelBody = makePolygonExtrusion(
    wheelVerts,
    params.thickness,
    [g.centerDistance, 0, 0],
    [0, 0, k.drivenAngle],
    'Geneva wheel — body',
  );
  const wheelUnion = makeOp('union', [wheelBody]);
  wheelUnion.label = 'Geneva wheel — union';
  const geneva = makeModule('Geneva wheel');
  geneva.children = [wheelUnion];

  // ── Joints
  const groundId = 'ground';
  const jDriver = makeRevoluteJoint(
    groundId,
    driver.id,
    [0, 0, 0],
    [0, 0, 1],
    { drive: params.drive, label: 'Driver revolute' },
  );
  const jGeneva = makeRevoluteJoint(
    groundId,
    geneva.id,
    [g.centerDistance, 0, 0],
    [0, 0, 1],
    { drive: k.drivenAngle, label: 'Geneva revolute' },
  );

  const children: SdfNode[] = [driver, geneva];
  const rootOp = makeOp('union', children);
  rootOp.label = 'Geneva Drive';

  return {
    driver,
    geneva,
    joints: [jDriver, jGeneva],
    rootOp,
    geometry: g,
    kinematics: k,
    params,
  };
}

export function buildGenevaScene(params?: GenevaParams): SdfOperation {
  return buildGeneva(params).rootOp;
}
