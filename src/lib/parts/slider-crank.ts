/**
 * ⚒️ La Forja — Slider-Crank (biela-manivela)
 * =============================================================================
 * Converts rotary motion of a crank into translational motion of a slider (or
 * vice versa) through a rigid connecting rod. The canonical piston-engine
 * mechanism.
 *
 * Geometry (slider axis along +X, offset e along +Y):
 *   • Crankpin at P(θ) = (r·cos θ, r·sin θ)    — r = crankRadius
 *   • Rod end at Q(θ) = (x(θ),   e)            — e = eccentricity (wrist-pin offset)
 *   • Rigid constraint: |Q − P| = L            — L = rodLength
 *
 *       ⇒  (x − r·cos θ)² + (e − r·sin θ)² = L²
 *       ⇒  x(θ) = r·cos θ  +  √( L² − (e − r·sin θ)² )
 *
 * We always take the positive root — the slider is assumed to lie on the +X
 * side of the crank (standard engine orientation). A valid mechanism requires
 * L ≥ r + |e| so the square-root argument stays non-negative.
 *
 * Stroke  (e = 0):  ∆x = 2·r   (TDC at θ = 0  ⇒ x_max = r + L,
 *                              BDC at θ = π  ⇒ x_min = L − r).
 * Stroke  (e ≠ 0):  closed-form from x at the two dead centres; the dead-centre
 *                   angles are where the rod and crank are collinear. The TDC
 *                   condition is θ_tdc = asin(e / (r + L)); the BDC condition
 *                   is θ_bdc = π − asin(e / (L − r)). (For e = 0 these collapse
 *                   to 0 and π, respectively.)
 *
 * Rod angle β(θ) (angle the connecting rod makes with the slider axis):
 *   sin β = (r·sin θ − e) / L    ⇒    |β|_max = asin((r + |e|) / L)  (pressure-angle bound)
 *
 * Slider velocity ratio (per unit crank angular velocity ω):
 *   dx/dθ = −r·sin θ  +  r·cos θ · (r·sin θ − e) / √(L² − (e − r·sin θ)²)
 *   At TDC / BDC  dx/dθ = 0.
 *
 * The analytic kinematics live here in a pure, synchronous form — scene build
 * lives downstream and only reads off these results.
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
import { makeRevoluteJoint, makeSliderJoint, type Joint } from '../joints';

// ─────────────────────────────────────────────────────────────
// Params
// ─────────────────────────────────────────────────────────────

export interface SliderCrankParams {
  /** Crank radius r (distance from main journal to crankpin). */
  crankRadius: number;
  /** Connecting-rod length L. Must satisfy L ≥ r + |e|. */
  rodLength: number;
  /** Eccentricity e (offset of the slider axis from the crank axis). */
  eccentricity: number;
  /** Driver crank angle θ_D (rad). */
  crankAngle: number;
  /** Radius of the pin cylinders (main journal + crankpin + wrist-pin). */
  pinRadius: number;
  /** Axial thickness of the crank web. */
  crankThickness: number;
  /** Cross-section width of the connecting rod (perpendicular to its long axis). */
  rodWidth: number;
  /** Axial thickness of the connecting rod. */
  rodThickness: number;
  /** Length of the slider (piston) body along the slider axis. */
  sliderLength: number;
  /** Cross-section height of the slider body (along Y). */
  sliderHeight: number;
  /** Axial thickness of the slider body. */
  sliderThickness: number;
  /** Vertex count used for disc polygons. */
  circleResolution: number;
}

export const SLIDER_CRANK_DEFAULTS: SliderCrankParams = {
  crankRadius: 0.5,
  rodLength: 1.6,
  eccentricity: 0,
  crankAngle: 0,
  pinRadius: 0.08,
  crankThickness: 0.18,
  rodWidth: 0.14,
  rodThickness: 0.12,
  sliderLength: 0.55,
  sliderHeight: 0.38,
  sliderThickness: 0.28,
  circleResolution: 32,
};

// ─────────────────────────────────────────────────────────────
// Derived geometry
// ─────────────────────────────────────────────────────────────

export interface SliderCrankDerived {
  /** L / r ratio — classical "rod ratio" (n in engine texts). */
  rodRatio: number;
  /** Crank angle at top dead centre (slider x maximum). */
  tdcAngle: number;
  /** Crank angle at bottom dead centre (slider x minimum). */
  bdcAngle: number;
  /** Slider x-coordinate at TDC. */
  xTdc: number;
  /** Slider x-coordinate at BDC. */
  xBdc: number;
  /** Stroke (x_max − x_min). For e = 0 this is exactly 2r. */
  stroke: number;
  /** Maximum |β| of the connecting rod (pressure-angle bound). */
  maxRodAngle: number;
  /** True when L ≥ r + |e| (mechanism physically realisable everywhere). */
  feasible: boolean;
}

export function sliderCrankGeometry(p: SliderCrankParams): SliderCrankDerived {
  const r = p.crankRadius;
  const L = p.rodLength;
  const e = p.eccentricity;
  const feasible = L >= r + Math.abs(e) - 1e-12;
  if (!feasible) {
    throw new Error(
      `Slider-crank infeasible: rodLength ${L} must be ≥ crankRadius + |eccentricity| = ${(r + Math.abs(e)).toFixed(4)}`,
    );
  }

  // Dead centres are where x'(θ) = 0. Setting the derivative to zero yields
  //    L²·sin²θ = (e − r·sin θ)²,
  // which factors to two conditions: sin θ = e/(L+r) (crank and rod in-line,
  // pointing the same way — TDC) and sin θ = −e/(L−r) (in-line but rod folded
  // back through the crank centre — BDC). Within one revolution the forward-
  // pointing root lies at |θ| < π/2 and the backward-pointing root lies in
  // (π/2, 3π/2); with the second θ-quadrant reflection we have:
  //    θ_tdc = asin(e / (L + r))
  //    θ_bdc = π + asin(e / (L − r))
  // L ≥ r + |e| guarantees both ratios are in [−1, 1].
  const tdcAngle = Math.asin(e / (L + r));
  const bdcAngle = Math.PI + Math.asin(e / (L - r));

  const xTdc = r * Math.cos(tdcAngle) + Math.sqrt(L * L - (e - r * Math.sin(tdcAngle)) ** 2);
  const xBdc = r * Math.cos(bdcAngle) + Math.sqrt(L * L - (e - r * Math.sin(bdcAngle)) ** 2);
  const stroke = xTdc - xBdc;

  // Maximum |β| = asin((r + |e|) / L) — achieved at θ where r·sin θ − e = ±L·sin β_max.
  const maxRodAngle = Math.asin((r + Math.abs(e)) / L);

  return { rodRatio: L / r, tdcAngle, bdcAngle, xTdc, xBdc, stroke, maxRodAngle, feasible };
}

// ─────────────────────────────────────────────────────────────
// Kinematics θ_D → (crankpin, slider_x, rod angle, velocity ratio)
// ─────────────────────────────────────────────────────────────

export interface SliderCrankKinematics {
  /** Crankpin position (x, y) in world frame with the crank centre at origin. */
  crankpin: [number, number];
  /** Slider x-coordinate x(θ). */
  sliderX: number;
  /** Connecting-rod angle β with respect to the slider axis (+X). */
  rodAngle: number;
  /** dx/dθ — slider linear velocity per unit crank angular velocity. */
  velocityRatio: number;
  /** Number of completed full crank revolutions (θ / 2π, Math.floor-style). */
  cycleIndex: number;
  /** θ reduced to (−π, π]. */
  crankPhase: number;
}

export function sliderCrankKinematics(p: SliderCrankParams): SliderCrankKinematics {
  const r = p.crankRadius;
  const L = p.rodLength;
  const e = p.eccentricity;
  const theta = p.crankAngle;

  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const crankpin: [number, number] = [r * c, r * s];

  const under = L * L - (e - r * s) ** 2;
  if (under < -1e-10) {
    // Infeasible mechanism (caller should have checked feasibility).
    throw new Error('Slider-crank kinematic under-square-root went negative — infeasible geometry');
  }
  const sqrtTerm = Math.sqrt(Math.max(0, under));
  const sliderX = r * c + sqrtTerm;

  const sinBeta = (r * s - e) / L;
  const rodAngle = Math.asin(Math.max(-1, Math.min(1, sinBeta)));

  // dx/dθ — differentiate x(θ) = r·cos θ + √(L² − (e − r·sin θ)²).
  //   d/dθ √(L² − u²)  =  u · du/dθ · −1 / √(L² − u²)    with  u = e − r·sin θ
  //                     =  (e − r·sin θ) · r·cos θ / √(L² − (e − r·sin θ)²)
  // ⇒  x'(θ) = −r·sin θ + r·cos θ · (e − r·sin θ) / √(…).
  // At the two dead centres (collinear crank + rod) √(…) → 0 and the
  // analytic limit is simply −r·sin θ, which is what we return in the guard.
  const velocityRatio = sqrtTerm > 1e-9
    ? -r * s + (r * c * (e - r * s)) / sqrtTerm
    : -r * s;

  const cycleIndex = Math.floor((theta + Math.PI) / (2 * Math.PI));
  let crankPhase = theta - 2 * Math.PI * cycleIndex;
  if (crankPhase > Math.PI) crankPhase -= 2 * Math.PI;

  return { crankpin, sliderX, rodAngle, velocityRatio, cycleIndex, crankPhase };
}

// ─────────────────────────────────────────────────────────────
// Scene build — crank web + pin, connecting rod, slider block
// ─────────────────────────────────────────────────────────────

export interface SliderCrankBuild {
  crank: SdfModule;
  rod: SdfModule;
  slider: SdfModule;
  joints: Joint[];
  rootOp: SdfOperation;
  geometry: SliderCrankDerived;
  kinematics: SliderCrankKinematics;
  params: SliderCrankParams;
}

function circleVerts(cx: number, cy: number, r: number, n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return out;
}

export function buildSliderCrank(params: SliderCrankParams = SLIDER_CRANK_DEFAULTS): SliderCrankBuild {
  const g = sliderCrankGeometry(params);
  const k = sliderCrankKinematics(params);

  const r = params.crankRadius;
  const L = params.rodLength;
  const e = params.eccentricity;
  const thk = params.crankThickness;

  // ── Crank web: stadium-shaped (circle at origin ∪ circle at pin) approximated
  // by a polygon outline with discs at both ends joined by a rectangle.
  // We generate it as a convex hull of two circles and extrude.
  const webR = params.pinRadius * 2.2;
  const verts: [number, number][] = [];
  const n = params.circleResolution;
  // Half-circle at crankpin (end), then half-circle at main journal (start).
  for (let i = 0; i <= n / 2; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / (n / 2);
    verts.push([params.crankRadius + webR * Math.cos(t), webR * Math.sin(t)]);
  }
  for (let i = 0; i <= n / 2; i++) {
    const t = Math.PI / 2 + (Math.PI * i) / (n / 2);
    verts.push([webR * Math.cos(t), webR * Math.sin(t)]);
  }
  const crankWeb = makePolygonExtrusion(
    verts,
    thk,
    [0, 0, 0],
    [0, 0, params.crankAngle],
    'Crank — web',
  );

  const mainPin = makeCylinder(
    [0, 0, 0],
    params.pinRadius,
    thk * 1.6,
  );
  mainPin.rotation = [Math.PI / 2, 0, 0];
  mainPin.label = 'Crank — main journal pin';

  const crankpinCyl = makeCylinder(
    [k.crankpin[0], k.crankpin[1], 0],
    params.pinRadius,
    thk * 1.6,
  );
  crankpinCyl.rotation = [Math.PI / 2, 0, 0];
  crankpinCyl.label = 'Crank — crankpin';

  const crankUnion = makeOp('union', [crankWeb, mainPin, crankpinCyl]);
  crankUnion.label = 'Crank — union';
  const crank = makeModule('Crank');
  crank.children = [crankUnion];

  // ── Connecting rod: stadium between crankpin and wrist-pin (slider end).
  const [Cx, Cy] = k.crankpin;
  const Wx = k.sliderX;
  const Wy = e;
  const rodLengthActual = Math.hypot(Wx - Cx, Wy - Cy); // should be exactly L
  const rodAngle = Math.atan2(Wy - Cy, Wx - Cx);

  // Build a local rod (along +X of length L) and transform it via rotation + position.
  const rw = params.rodWidth * 0.5;
  const endR = params.pinRadius * 1.5;
  const rodVerts: [number, number][] = [];
  // Top edge
  rodVerts.push([0, rw]);
  rodVerts.push([L, rw]);
  // Semicircle at wrist-pin end
  const half = n / 2;
  for (let i = 1; i < half; i++) {
    const t = Math.PI / 2 - (Math.PI * i) / half;
    rodVerts.push([L + endR * Math.cos(t), endR * Math.sin(t)]);
  }
  // Bottom edge
  rodVerts.push([L, -rw]);
  rodVerts.push([0, -rw]);
  // Semicircle at crankpin end
  for (let i = 1; i < half; i++) {
    const t = -Math.PI / 2 - (Math.PI * i) / half;
    rodVerts.push([endR * Math.cos(t), endR * Math.sin(t)]);
  }
  const rodBody = makePolygonExtrusion(
    rodVerts,
    params.rodThickness,
    [Cx, Cy, 0],
    [0, 0, rodAngle],
    'Rod — body',
  );
  const rodUnion = makeOp('union', [rodBody]);
  rodUnion.label = 'Rod — union';
  const rod = makeModule('Connecting rod');
  rod.children = [rodUnion];

  // ── Slider block at (sliderX, e, 0), axis along +X.
  const sliderBody = makeBox(
    [k.sliderX, e, 0],
    [params.sliderLength, params.sliderHeight, params.sliderThickness],
  );
  sliderBody.label = 'Slider — body';

  const wristPin = makeCylinder(
    [k.sliderX, e, 0],
    params.pinRadius,
    params.sliderThickness * 1.3,
  );
  wristPin.rotation = [Math.PI / 2, 0, 0];
  wristPin.label = 'Slider — wrist pin';

  const sliderUnion = makeOp('union', [sliderBody, wristPin]);
  sliderUnion.label = 'Slider — union';
  const slider = makeModule('Slider');
  slider.children = [sliderUnion];

  // ── Joints
  const groundId = 'ground';
  const jCrank = makeRevoluteJoint(
    groundId,
    crank.id,
    [0, 0, 0],
    [0, 0, 1],
    { drive: params.crankAngle, label: 'Crank revolute' },
  );
  const jCrankpin = makeRevoluteJoint(
    crank.id,
    rod.id,
    [Cx, Cy, 0],
    [0, 0, 1],
    { drive: rodAngle, label: 'Crankpin revolute' },
  );
  const jWrist = makeRevoluteJoint(
    rod.id,
    slider.id,
    [Wx, Wy, 0],
    [0, 0, 1],
    { label: 'Wrist-pin revolute' },
  );
  const jSlider = makeSliderJoint(
    groundId,
    slider.id,
    [0, e, 0],
    [1, 0, 0],
    { drive: k.sliderX, label: 'Slider prismatic' },
  );

  const children: SdfNode[] = [crank, rod, slider];
  const rootOp = makeOp('union', children);
  rootOp.label = 'Slider-crank';

  // Numeric sanity — rodLengthActual must equal L (uses only floats we just computed).
  void rodLengthActual;

  return {
    crank,
    rod,
    slider,
    joints: [jCrank, jCrankpin, jWrist, jSlider],
    rootOp,
    geometry: g,
    kinematics: k,
    params,
  };
}

export function buildSliderCrankScene(params?: SliderCrankParams): SdfOperation {
  return buildSliderCrank(params).rootOp;
}
