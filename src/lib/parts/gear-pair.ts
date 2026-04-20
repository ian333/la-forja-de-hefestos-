/**
 * ⚒️ La Forja — Gear Pair (meshed involute spur gears)
 * ======================================================
 * Two spur gears sharing the same `module` and `pressureAngle`, placed at
 * center-distance C = m·(z₁+z₂)/2, with driven gear 2 phase-aligned so that
 * a tooth SPACE of gear 2 faces a tooth TIP of gear 1 at rest.
 *
 *   Kinematic law:  ω₁ · z₁ = −ω₂ · z₂   (opposite directions on external mesh)
 *   ⇒  angle₂(θ) = phase₂ − θ · z₁ / z₂
 *
 *  `phase2Base`  = π − π/z₂  so that at drive=0, gear 2 has a root (tooth space)
 *                  pointing at −X (toward gear 1), interleaving with gear 1's
 *                  tooth tip pointing at +X.
 *
 * The `buildGearPair` function returns the two modules, the joint list that
 * describes the revolute joints (for the joint graph / animation pipeline),
 * the root SdfOperation (union of both gears, ready to feed the viewport),
 * and the derived geometry for downstream invariant checks.
 */

import {
  makeModule,
  makeOp,
  type SdfModule,
  type SdfOperation,
} from '../sdf-engine';
import {
  makeRevoluteJoint,
  type Joint,
} from '../joints';
import {
  buildSpurGear,
  SPUR_GEAR_DEFAULTS,
  spurGearGeometry,
  type SpurGearParams,
} from './spur-gear';

export interface GearPairParams {
  /** Teeth on driving gear (gear 1). */
  teeth1: number;
  /** Teeth on driven gear (gear 2). */
  teeth2: number;
  /** Shared module (unit of pitch). */
  module: number;
  /** Shared pressure angle (rad). */
  pressureAngle: number;
  /** Shared addendum coefficient ka. */
  addendumCoef: number;
  /** Shared dedendum coefficient kd. */
  dedendumCoef: number;
  /** Axial thickness (common to both gears — can be split later). */
  thickness: number;
  /** Shaft bore diameter as a fraction of pitch radius (0 = no bore). */
  boreFraction: number;
  /** Mesh sampling resolution. */
  profileResolution: number;
  /** Root/addendum arc sampling. */
  arcResolution: number;
  /** Driving angle (rad) applied to gear 1. Gear 2 follows via the ratio. */
  drive: number;
  /**
   * Fillet radius applied to every sharp corner of BOTH gears' tooth profiles
   * (tip & root). 0 = sharp. Typical: 0.1·m … 0.3·m. Clamped per-corner.
   */
  filletRadius?: number;
  /** Arc subdivisions per filleted corner. Default 4. */
  filletSegments?: number;
  /** # of lightening holes (same config applied to both gears' webs). */
  lighteningHoles?: number;
  /** Radius of each lightening hole in mm (sketch units). */
  lighteningHoleRadius?: number;
  /** Input torque on gear 1 shaft (N·mm). */
  torque?: number;
  /** Material key (MATERIAL_DATABASE). Default 'acero_1045'. */
  materialKey?: string;
}

export const GEAR_PAIR_DEFAULTS: GearPairParams = {
  teeth1: 20,
  teeth2: 40,
  module: 1.0,
  pressureAngle: (20 * Math.PI) / 180,
  addendumCoef: 1.0,
  dedendumCoef: 1.25,
  thickness: 0.5,
  boreFraction: 0.3,
  profileResolution: 8,
  arcResolution: 4,
  drive: 0,
  filletRadius: 0,
  filletSegments: 4,
  lighteningHoles: 0,
  lighteningHoleRadius: 0,
  // 3 N·m in N·mm — calibrated so the default m=1.0 · b≈5mm · Z=20 · acero-1045 pair
  // has SF ≈ 2.9 at rest (headroom for the lightening optimizer to work).
  torque: 3_000,
  materialKey: 'acero_1045',
};

export interface GearPairDerived {
  /** Theoretical center distance C = m·(z₁+z₂)/2. */
  centerDistance: number;
  /** Gear ratio z₁ / z₂ (sign-positive scalar; direction is opposite). */
  gearRatio: number;
  /** Phase of gear 2 at drive=0 (rad). */
  phase2Base: number;
  /** Total pitch radii. */
  pitchRadius1: number;
  pitchRadius2: number;
  /** Effective current rotation angles. */
  angle1: number;
  angle2: number;
}

export function gearPairGeometry(p: GearPairParams): GearPairDerived {
  const centerDistance = (p.module * (p.teeth1 + p.teeth2)) / 2;
  const gearRatio = p.teeth1 / p.teeth2;
  const phase2Base = Math.PI - Math.PI / p.teeth2;
  return {
    centerDistance,
    gearRatio,
    phase2Base,
    pitchRadius1: (p.module * p.teeth1) / 2,
    pitchRadius2: (p.module * p.teeth2) / 2,
    angle1: p.drive,
    angle2: phase2Base - p.drive * gearRatio,
  };
}

export interface GearPairBuild {
  gear1: SdfModule;
  gear2: SdfModule;
  joints: Joint[];
  rootOp: SdfOperation;
  geometry: GearPairDerived;
  /** The params that were used (normalized). */
  params: GearPairParams;
  /** SpurGearParams for each gear — useful for introspection / UI. */
  spurParams1: SpurGearParams;
  spurParams2: SpurGearParams;
}

/**
 * Build the full gear-pair scene.
 *
 * Gear 1 is centered at the origin, axis +Z.
 * Gear 2 is centered at (C, 0, 0), axis +Z.
 * Both revolute joints are relative to a synthetic ground module id `ground`.
 */
export function buildGearPair(
  params: GearPairParams = GEAR_PAIR_DEFAULTS,
): GearPairBuild {
  const geom = gearPairGeometry(params);

  const nHoles = params.lighteningHoles ?? 0;
  const rHole = params.lighteningHoleRadius ?? 0;
  const holeCenterRadius = (pitchR: number): number => {
    // Place holes halfway between bore radius and dedendum radius.
    const rBore = (params.boreFraction > 0 ? params.boreFraction * pitchR : 0);
    const rDed = pitchR - params.module * params.dedendumCoef;
    return 0.5 * (rBore + rDed);
  };

  const spurParams1: SpurGearParams = {
    ...SPUR_GEAR_DEFAULTS,
    module: params.module,
    pressureAngle: params.pressureAngle,
    addendumCoef: params.addendumCoef,
    dedendumCoef: params.dedendumCoef,
    teethCount: params.teeth1,
    profileResolution: params.profileResolution,
    arcResolution: params.arcResolution,
    rotation: 0,
    thickness: params.thickness,
    boreDiameter:
      params.boreFraction > 0 ? params.boreFraction * geom.pitchRadius1 * 2 : 0,
    centerX: 0,
    centerY: 0,
    phase: geom.angle1,
    filletRadius: params.filletRadius ?? 0,
    filletSegments: params.filletSegments ?? 4,
    lighteningHoles: nHoles,
    lighteningHoleRadius: rHole,
    lighteningHoleCenterRadius: nHoles >= 3 && rHole > 0 ? holeCenterRadius(geom.pitchRadius1) : 0,
  };

  const spurParams2: SpurGearParams = {
    ...SPUR_GEAR_DEFAULTS,
    module: params.module,
    pressureAngle: params.pressureAngle,
    addendumCoef: params.addendumCoef,
    dedendumCoef: params.dedendumCoef,
    teethCount: params.teeth2,
    profileResolution: params.profileResolution,
    arcResolution: params.arcResolution,
    rotation: 0,
    thickness: params.thickness,
    boreDiameter:
      params.boreFraction > 0 ? params.boreFraction * geom.pitchRadius2 * 2 : 0,
    centerX: geom.centerDistance,
    centerY: 0,
    phase: geom.angle2,
    filletRadius: params.filletRadius ?? 0,
    filletSegments: params.filletSegments ?? 4,
    lighteningHoles: nHoles,
    lighteningHoleRadius: rHole,
    lighteningHoleCenterRadius: nHoles >= 3 && rHole > 0 ? holeCenterRadius(geom.pitchRadius2) : 0,
  };

  const gear1 = buildSpurGear(spurParams1, 'Gear 1 (driver)');
  const gear2 = buildSpurGear(spurParams2, 'Gear 2 (driven)');

  const groundId = 'ground';
  const joint1 = makeRevoluteJoint(
    groundId,
    gear1.id,
    [0, 0, 0],
    [0, 0, 1],
    { drive: geom.angle1, label: 'Gear 1 revolute' },
  );
  const joint2 = makeRevoluteJoint(
    groundId,
    gear2.id,
    [geom.centerDistance, 0, 0],
    [0, 0, 1],
    { drive: geom.angle2, label: 'Gear 2 revolute' },
  );

  const rootOp = makeOp('union', [gear1, gear2]);
  rootOp.label = 'Gear Pair';

  return {
    gear1,
    gear2,
    joints: [joint1, joint2],
    rootOp,
    geometry: geom,
    params,
    spurParams1,
    spurParams2,
  };
}

/** Return only the root scene (convenience for viewport wiring). */
export function buildGearPairScene(params?: GearPairParams): SdfOperation {
  return buildGearPair(params).rootOp;
}

// ─────────────────────────────────────────────────────────────
// Invariants — pure functions over the derived geometry
// ─────────────────────────────────────────────────────────────

/** Expected angle of gear 2 given the drive angle and gear counts. */
export function expectedGear2Angle(p: GearPairParams): number {
  return Math.PI - Math.PI / p.teeth2 - p.drive * (p.teeth1 / p.teeth2);
}

/**
 * Contact ratio (mesh continuity).
 * For a standard external involute mesh with no profile shift:
 *   ε = (√(ra1² − rb1²) + √(ra2² − rb2²) − C·sin(α)) / (π·m·cos(α))
 * Values in (1, ~2) for a working mesh; < 1 is chattering.
 */
export function contactRatio(p: GearPairParams): number {
  const m = p.module;
  const a = p.pressureAngle;
  const rp1 = (m * p.teeth1) / 2;
  const rp2 = (m * p.teeth2) / 2;
  const rb1 = rp1 * Math.cos(a);
  const rb2 = rp2 * Math.cos(a);
  const ra1 = rp1 + m * p.addendumCoef;
  const ra2 = rp2 + m * p.addendumCoef;
  const C = rp1 + rp2;
  const num =
    Math.sqrt(ra1 * ra1 - rb1 * rb1) +
    Math.sqrt(ra2 * ra2 - rb2 * rb2) -
    C * Math.sin(a);
  return num / (Math.PI * m * Math.cos(a));
}
