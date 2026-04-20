/**
 * ⚒️ La Forja — Planetary Gear Train (epicyclic, single stage)
 * =============================================================================
 * Three coaxial bodies share axis +Z:
 *   • Sun      — central external gear, S teeth
 *   • Ring     — internal (annular) gear, R teeth
 *   • Planets  — N external gears of P teeth each, carried by the arm
 * Plus one frame:
 *   • Carrier — rotates about the common axis, hosts N planet pins evenly
 *               spaced at angle 2π·k/N for k = 0 … N-1.
 *
 * Coaxial constraint:  R = S + 2·P          (sun ↔ planet ↔ ring all share axis)
 * Assembly (equal spacing): (R + S) mod N = 0
 *
 * Willis' equation (train value e from sun through planets to ring):
 *     (ω_ring − ω_carrier) / (ω_sun − ω_carrier) = −S / R
 *
 * Holding one member and driving another yields all three classical reductions:
 *   fixed=ring,   input=sun     : ω_carrier / ω_sun      = S / (S + R)
 *   fixed=ring,   input=carrier : ω_sun / ω_carrier      = (S + R) / S      (overdrive)
 *   fixed=sun,    input=carrier : ω_ring / ω_carrier     = (S + R) / R
 *   fixed=sun,    input=ring    : ω_carrier / ω_ring     = R / (S + R)
 *   fixed=carrier,input=sun     : ω_ring / ω_sun         = −S / R           (reverse)
 *   fixed=carrier,input=ring    : ω_sun / ω_ring         = −R / S
 *
 * Planet self-rotation about its own centre (world frame):
 *   ω_p = ω_carrier − (ω_sun − ω_carrier) · (S / P)
 * obtained from the external sun/planet mesh in the carrier frame
 * (external mesh reverses direction, ratio S/P by tooth counts).
 *
 * Everything here is a pure, synchronous function of the input params — ideal
 * for invariant tests. The scene build sits downstream and only reads the
 * geometry + angles this file produces.
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

export type PlanetaryMember = 'sun' | 'ring' | 'carrier';

export interface PlanetaryParams {
  /** Tooth count of the sun gear S. */
  sunTeeth: number;
  /** Tooth count of each planet gear P. */
  planetTeeth: number;
  /** Number of planets N (equally spaced). */
  planetCount: number;
  /** Gear module m (mm or unit per tooth). Sets the absolute scale. */
  module: number;
  /** Axial thickness shared by sun, planets, and ring. */
  thickness: number;
  /** Axial thickness of the carrier plate (thinner than gears). */
  carrierThickness: number;
  /** Radial thickness of the ring gear wall (outside R_pitch). */
  ringWallThickness: number;
  /** Planet-pin radius on the carrier. */
  pinRadius: number;
  /** Shaft bore as a fraction of the sun pitch radius. 0 = no bore. */
  boreFraction: number;
  /** Which body is grounded. */
  fixedMember: PlanetaryMember;
  /** Which body the drive angle is applied to (must differ from fixedMember). */
  inputMember: PlanetaryMember;
  /** Drive angle (rad) applied to the input member. */
  drive: number;
  /** Vertex count for circle approximations in polygon extrusions. */
  circleResolution: number;
}

export const PLANETARY_DEFAULTS: PlanetaryParams = {
  sunTeeth: 20,
  planetTeeth: 16,
  planetCount: 4,
  module: 0.05,
  thickness: 0.18,
  carrierThickness: 0.08,
  ringWallThickness: 0.12,
  pinRadius: 0.05,
  boreFraction: 0.35,
  fixedMember: 'ring',
  inputMember: 'sun',
  drive: 0,
  circleResolution: 48,
};

// ─────────────────────────────────────────────────────────────
// Derived geometry (pure)
// ─────────────────────────────────────────────────────────────

export interface PlanetaryDerived {
  /** Ring tooth count  R = S + 2P. */
  ringTeeth: number;
  /** Sun pitch radius   r_s = m·S/2. */
  sunPitchRadius: number;
  /** Planet pitch radius r_p = m·P/2. */
  planetPitchRadius: number;
  /** Ring pitch radius  r_r = m·R/2 (at the tip of the internal teeth). */
  ringPitchRadius: number;
  /** Carrier-arm length (sun axis to planet centre) = r_s + r_p. */
  carrierArmLength: number;
  /** True when (R + S) mod planetCount = 0  — planets can be equispaced. */
  equalSpacingAssemblable: boolean;
  /** True when planetCount ≥ 2 and planet gears physically fit without overlap. */
  planetsFit: boolean;
  /** Willis train value e = −S/R. */
  trainValue: number;
  /** Speed ratio ω_out / ω_input for the current fixed + input selection. */
  speedRatio: number;
  /** Which body is the output (the one that is neither fixed nor input). */
  outputMember: PlanetaryMember;
}

export function planetaryGeometry(p: PlanetaryParams): PlanetaryDerived {
  if (p.sunTeeth < 6) {
    throw new Error(`Planetary sunTeeth must be ≥ 6 (got ${p.sunTeeth})`);
  }
  if (p.planetTeeth < 4) {
    throw new Error(`Planetary planetTeeth must be ≥ 4 (got ${p.planetTeeth})`);
  }
  if (p.planetCount < 2) {
    throw new Error(`Planetary planetCount must be ≥ 2 (got ${p.planetCount})`);
  }
  if (p.fixedMember === p.inputMember) {
    throw new Error(`Planetary inputMember (${p.inputMember}) must differ from fixedMember (${p.fixedMember})`);
  }

  const S = p.sunTeeth;
  const P = p.planetTeeth;
  const R = S + 2 * P;
  const m = p.module;
  const sunPitchRadius = (m * S) / 2;
  const planetPitchRadius = (m * P) / 2;
  const ringPitchRadius = (m * R) / 2;
  const carrierArmLength = sunPitchRadius + planetPitchRadius;

  const equalSpacingAssemblable = (R + S) % p.planetCount === 0;

  // Geometric fit: two adjacent planets must not overlap. Chord between neighbour
  // centres must exceed 2·planetPitchRadius (plus addendum margin — we use pitch
  // radii as the fit bound since the detailed tooth geometry is abstracted).
  const chord = 2 * carrierArmLength * Math.sin(Math.PI / p.planetCount);
  const planetsFit = chord > 2 * planetPitchRadius + 1e-12;

  const trainValue = -S / R;

  // Speed ratio ω_out / ω_input. Derived from Willis with the held member at 0.
  const speedRatio = computeSpeedRatio(p.fixedMember, p.inputMember, S, R);
  const outputMember: PlanetaryMember = ((): PlanetaryMember => {
    for (const m of ['sun', 'ring', 'carrier'] as PlanetaryMember[]) {
      if (m !== p.fixedMember && m !== p.inputMember) return m;
    }
    throw new Error('unreachable');
  })();

  return {
    ringTeeth: R,
    sunPitchRadius,
    planetPitchRadius,
    ringPitchRadius,
    carrierArmLength,
    equalSpacingAssemblable,
    planetsFit,
    trainValue,
    speedRatio,
    outputMember,
  };
}

function computeSpeedRatio(
  fixed: PlanetaryMember,
  input: PlanetaryMember,
  S: number,
  R: number,
): number {
  // Solve Willis with ω_fixed = 0 and ω_input = 1.
  //   (ω_r − ω_c) · R = −S · (ω_s − ω_c)   ⇔  S·ω_s + R·ω_r = (S + R)·ω_c
  const sum = S + R;
  if (fixed === 'ring') {
    // ω_r = 0 ⇒ ω_c = S·ω_s / (S+R).
    if (input === 'sun') return S / sum;            // output = carrier
    if (input === 'carrier') return sum / S;        // output = sun
  }
  if (fixed === 'sun') {
    // ω_s = 0 ⇒ ω_c = R·ω_r / (S+R).
    if (input === 'ring') return R / sum;           // output = carrier
    if (input === 'carrier') return sum / R;        // output = ring
  }
  if (fixed === 'carrier') {
    // ω_c = 0 ⇒ ω_r = −S·ω_s / R.
    if (input === 'sun') return -S / R;             // output = ring
    if (input === 'ring') return -R / S;            // output = sun
  }
  throw new Error(`unreachable: fixed=${fixed} input=${input}`);
}

// ─────────────────────────────────────────────────────────────
// Kinematics — convert drive on the input member to ALL three angles
// ─────────────────────────────────────────────────────────────

export interface PlanetaryKinematics {
  /** Absolute angle of the sun gear (rad). */
  sunAngle: number;
  /** Absolute angle of the carrier arm (rad). */
  carrierAngle: number;
  /** Absolute angle of the ring gear (rad). */
  ringAngle: number;
  /** Self-rotation of every planet gear in world frame (rad) — same for all N planets. */
  planetAngle: number;
  /** World-frame centres of the N planet pivots, in order k = 0 … N-1. */
  planetCentres: [number, number][];
  /** Output member's absolute angle (equals whichever of sun/ring/carrier is the output). */
  outputAngle: number;
}

export function planetaryKinematics(p: PlanetaryParams): PlanetaryKinematics {
  const g = planetaryGeometry(p);
  const S = p.sunTeeth;
  const R = g.ringTeeth;
  const P = p.planetTeeth;
  const sum = S + R;

  // Solve all three angles. One is held at 0, one is set to `drive`, and the
  // third is derived from Willis: S·θ_s + R·θ_r = (S+R)·θ_c.
  let sunAngle = 0;
  let ringAngle = 0;
  let carrierAngle = 0;

  const theta = p.drive;
  if (p.fixedMember === 'ring') {
    ringAngle = 0;
    if (p.inputMember === 'sun') {
      sunAngle = theta;
      carrierAngle = (S * sunAngle) / sum;
    } else {
      // input = carrier
      carrierAngle = theta;
      sunAngle = (sum * carrierAngle) / S;
    }
  } else if (p.fixedMember === 'sun') {
    sunAngle = 0;
    if (p.inputMember === 'ring') {
      ringAngle = theta;
      carrierAngle = (R * ringAngle) / sum;
    } else {
      // input = carrier
      carrierAngle = theta;
      ringAngle = (sum * carrierAngle) / R;
    }
  } else {
    // fixed = carrier
    carrierAngle = 0;
    if (p.inputMember === 'sun') {
      sunAngle = theta;
      ringAngle = (-S * sunAngle) / R;
    } else {
      // input = ring
      ringAngle = theta;
      sunAngle = (-R * ringAngle) / S;
    }
  }

  // Planet self-rotation in world frame.
  //   ω_p − ω_c = −(ω_s − ω_c) · (S / P)   (external sun/planet mesh in carrier frame)
  const planetAngle = carrierAngle - (sunAngle - carrierAngle) * (S / P);

  const planetCentres: [number, number][] = [];
  for (let k = 0; k < p.planetCount; k++) {
    const a = carrierAngle + (2 * Math.PI * k) / p.planetCount;
    planetCentres.push([
      g.carrierArmLength * Math.cos(a),
      g.carrierArmLength * Math.sin(a),
    ]);
  }

  const outputAngle =
    g.outputMember === 'sun' ? sunAngle
    : g.outputMember === 'ring' ? ringAngle
    : carrierAngle;

  return { sunAngle, carrierAngle, ringAngle, planetAngle, planetCentres, outputAngle };
}

// ─────────────────────────────────────────────────────────────
// Scene build — sun disc, N planet discs, ring annulus, carrier plate
// ─────────────────────────────────────────────────────────────

export interface PlanetaryBuild {
  sun: SdfModule;
  planets: SdfModule;
  ring: SdfModule;
  carrier: SdfModule;
  joints: Joint[];
  rootOp: SdfOperation;
  geometry: PlanetaryDerived;
  kinematics: PlanetaryKinematics;
  params: PlanetaryParams;
}

function circleVerts(cx: number, cy: number, r: number, n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return out;
}

export function buildPlanetary(params: PlanetaryParams = PLANETARY_DEFAULTS): PlanetaryBuild {
  const g = planetaryGeometry(params);
  const k = planetaryKinematics(params);
  const t = params.thickness;

  // ── Sun: disc at origin, rotated by sunAngle.
  const sunDisc = makePolygonExtrusion(
    circleVerts(0, 0, g.sunPitchRadius, params.circleResolution),
    t,
    [0, 0, 0],
    [0, 0, k.sunAngle],
    'Sun — disc',
  );
  const sunChildren: SdfNode[] = [sunDisc];
  if (params.boreFraction > 0) {
    const boreR = params.boreFraction * g.sunPitchRadius;
    const bore = makeCylinder([0, 0, 0], boreR, t * 1.4);
    bore.rotation = [Math.PI / 2, 0, 0];
    bore.label = 'Sun — bore';
    const cut = makeOp('subtract', [makeOp('union', [sunDisc]), bore]);
    cut.label = 'Sun — bore cut';
    sunChildren.length = 0;
    sunChildren.push(cut);
  }
  const sunUnion = makeOp('union', sunChildren);
  sunUnion.label = 'Sun — union';
  const sun = makeModule('Sun');
  sun.children = [sunUnion];

  // ── Planets: one disc per planet, centred at its pivot, rotated by planetAngle.
  const planetNodes: SdfNode[] = [];
  for (let i = 0; i < params.planetCount; i++) {
    const [px, py] = k.planetCentres[i];
    const disc = makePolygonExtrusion(
      circleVerts(0, 0, g.planetPitchRadius, params.circleResolution),
      t,
      [px, py, 0],
      [0, 0, k.planetAngle],
      `Planet ${i + 1} — disc`,
    );
    planetNodes.push(disc);
  }
  const planetsUnion = makeOp('union', planetNodes.length > 0 ? planetNodes : [makeOp('union', [])]);
  planetsUnion.label = 'Planets — union';
  const planets = makeModule('Planets');
  planets.children = [planetsUnion];

  // ── Ring: annulus, outer radius r_r + ringWallThickness, inner radius r_r.
  //    Rendered as (outer cylinder) − (inner cylinder). The ring is rotated by
  //    ringAngle around +Z via its cylinder rotation (we approximate rotation
  //    by rotating the cylinder's own Euler; since a cylinder is axisymmetric,
  //    visual rotation appears as the angular position of any fiducial mark;
  //    rotation is preserved in the joint metadata regardless.)
  const ringOuterR = g.ringPitchRadius + params.ringWallThickness;
  const ringInnerR = g.ringPitchRadius;
  const ringOuter = makeCylinder([0, 0, 0], ringOuterR, t);
  ringOuter.rotation = [Math.PI / 2, 0, k.ringAngle];
  ringOuter.label = 'Ring — outer';
  const ringInner = makeCylinder([0, 0, 0], ringInnerR, t * 1.4);
  ringInner.rotation = [Math.PI / 2, 0, 0];
  ringInner.label = 'Ring — inner void';
  const ringAnnulus = makeOp('subtract', [ringOuter, ringInner]);
  ringAnnulus.label = 'Ring — annulus';
  const ring = makeModule('Ring');
  ring.children = [ringAnnulus];

  // ── Carrier: thin plate from 0 to r_arm + planet-pin margin, rotated by
  //    carrierAngle; plus one pin cylinder per planet.
  const carrierThk = params.carrierThickness;
  const carrierPlate = makeCylinder([0, 0, -t * 0.6], g.carrierArmLength + params.pinRadius * 2.2, carrierThk);
  carrierPlate.rotation = [Math.PI / 2, 0, k.carrierAngle];
  carrierPlate.label = 'Carrier — plate';
  const carrierNodes: SdfNode[] = [carrierPlate];
  for (let i = 0; i < params.planetCount; i++) {
    const [px, py] = k.planetCentres[i];
    const pin = makeCylinder([px, py, 0], params.pinRadius, t * 1.1);
    pin.rotation = [Math.PI / 2, 0, 0];
    pin.label = `Carrier — pin ${i + 1}`;
    carrierNodes.push(pin);
  }
  const carrierUnion = makeOp('union', carrierNodes);
  carrierUnion.label = 'Carrier — union';
  const carrier = makeModule('Carrier');
  carrier.children = [carrierUnion];

  // ── Joints
  const groundId = 'ground';
  const joints: Joint[] = [];
  joints.push(makeRevoluteJoint(groundId, sun.id, [0, 0, 0], [0, 0, 1],
    { drive: k.sunAngle, label: 'Sun revolute' }));
  joints.push(makeRevoluteJoint(groundId, ring.id, [0, 0, 0], [0, 0, 1],
    { drive: k.ringAngle, label: 'Ring revolute' }));
  joints.push(makeRevoluteJoint(groundId, carrier.id, [0, 0, 0], [0, 0, 1],
    { drive: k.carrierAngle, label: 'Carrier revolute' }));
  for (let i = 0; i < params.planetCount; i++) {
    const [px, py] = k.planetCentres[i];
    joints.push(makeRevoluteJoint(
      carrier.id,
      planets.id,
      [px, py, 0],
      [0, 0, 1],
      { drive: k.planetAngle, label: `Planet ${i + 1} revolute` },
    ));
  }

  const children: SdfNode[] = [sun, planets, carrier, ring];
  const rootOp = makeOp('union', children);
  rootOp.label = 'Planetary gear train';

  return {
    sun,
    planets,
    ring,
    carrier,
    joints,
    rootOp,
    geometry: g,
    kinematics: k,
    params,
  };
}

export function buildPlanetaryScene(params?: PlanetaryParams): SdfOperation {
  return buildPlanetary(params).rootOp;
}

// ─────────────────────────────────────────────────────────────
// Willis residual — closure for invariant checks
// ─────────────────────────────────────────────────────────────

/**
 * Residual of Willis' equation given current angles.
 *    S·θ_s + R·θ_r − (S + R)·θ_c  should be 0 (up to floating-point noise).
 * Exposed as its own function so invariant tests can grade any (θ_s, θ_r, θ_c)
 * triple — not just the ones produced by our kinematics solver.
 */
export function planetaryWillisResidual(
  sunTeeth: number,
  planetTeeth: number,
  sunAngle: number,
  ringAngle: number,
  carrierAngle: number,
): number {
  const R = sunTeeth + 2 * planetTeeth;
  return sunTeeth * sunAngle + R * ringAngle - (sunTeeth + R) * carrierAngle;
}
