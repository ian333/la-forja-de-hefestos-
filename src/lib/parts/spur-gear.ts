/**
 * ⚒️ La Forja — Spur Gear (parametric SdfModule)
 * ================================================
 * Consumes an involute sketch (2D) and extrudes it to a 3D SdfModule
 * with a central bore. One gear = one editable sketch + extrude + bore,
 * mirroring the classical Fusion workflow.
 *
 *   SpurGearParams (GearSketchParams + { thickness, boreDiameter, center, phase })
 *       → buildSpurGear() → SdfModule { body = extrude(sketch) − bore }
 *
 * The gear's axis of rotation is world Z. The gear lies flat in the world XY
 * plane, extruded symmetrically by ± thickness/2 along Z.
 */

import {
  makeCylinder,
  makeOp,
  makeModule,
  makePolygonExtrusion,
  type SdfModule,
  type SdfNode,
  type SdfOperation,
} from '../sdf-engine';
import {
  GEAR_SKETCH_DEFAULTS,
  buildGearSketchAsPairs,
  deriveGearGeometry,
  type GearSketchParams,
} from './involute-gear-sketch';

export interface SpurGearParams extends GearSketchParams {
  /** Axial thickness (world Z). */
  thickness: number;
  /** Central through-hole (shaft) diameter. Set 0 to omit. */
  boreDiameter: number;
  /** World X of the gear center. */
  centerX: number;
  /** World Y of the gear center. */
  centerY: number;
  /**
   * Rotational phase (rad) baked into the sketch.
   * For mesh alignment in a gear pair, the driven gear needs a half-tooth
   * offset; this is where we apply it.
   */
  phase: number;
  /** # of circular lightening holes distributed on a pitch circle in the web. */
  lighteningHoles?: number;
  /** Radius of each lightening hole (sketch units). */
  lighteningHoleRadius?: number;
  /** Center radius of the lightening-hole ring (sketch units). */
  lighteningHoleCenterRadius?: number;
}

export const SPUR_GEAR_DEFAULTS: SpurGearParams = {
  ...GEAR_SKETCH_DEFAULTS,
  thickness: 0.5,
  boreDiameter: 0.3,
  centerX: 0,
  centerY: 0,
  phase: 0,
};

/**
 * Build the gear as an SdfModule: extruded polygon body minus an axial bore.
 * The `rotation` field of the sketch is set to `phase` (physics-level phase),
 * so animating a joint around Z on top of this module adds more rotation.
 */
export function buildSpurGear(
  params: SpurGearParams = SPUR_GEAR_DEFAULTS,
  label = 'Spur Gear',
): SdfModule {
  const sketchParams: GearSketchParams = { ...params, rotation: params.phase };
  const verts = buildGearSketchAsPairs(sketchParams);

  const body = makePolygonExtrusion(
    verts,
    params.thickness,
    [params.centerX, params.centerY, 0],
    [0, 0, 0],
    `${label} — body`,
  );

  const mod = makeModule(label);

  // Collect cutouts (bore + lightening holes) to subtract from the body.
  const cutouts: SdfNode[] = [];

  if (params.boreDiameter > 0) {
    // Cylinder's default axis is Y (sdCylinder uses p.xz radial, p.y axial).
    // To align with world Z, rotate +π/2 around X.
    // Slight axial overshoot prevents coplanar-face artifacts in subtract.
    const bore = makeCylinder(
      [params.centerX, params.centerY, 0],
      params.boreDiameter / 2,
      params.thickness * 1.1,
    );
    bore.rotation = [Math.PI / 2, 0, 0];
    bore.label = `${label} — bore`;
    cutouts.push(bore);
  }

  const nHoles = params.lighteningHoles ?? 0;
  const rHole = params.lighteningHoleRadius ?? 0;
  const rCenter = params.lighteningHoleCenterRadius ?? 0;
  if (nHoles >= 3 && rHole > 0 && rCenter > 0) {
    for (let i = 0; i < nHoles; i++) {
      const theta = params.phase + (2 * Math.PI * i) / nHoles;
      const hx = params.centerX + rCenter * Math.cos(theta);
      const hy = params.centerY + rCenter * Math.sin(theta);
      const hole = makeCylinder([hx, hy, 0], rHole, params.thickness * 1.1);
      hole.rotation = [Math.PI / 2, 0, 0];
      hole.label = `${label} — lightening ${i + 1}`;
      cutouts.push(hole);
    }
  }

  if (cutouts.length > 0) {
    const cutUnion =
      cutouts.length === 1 ? cutouts[0] : makeOp('union', cutouts);
    const solid = makeOp('subtract', [body, cutUnion]);
    solid.label = label;
    mod.children = [solid];
  } else {
    mod.children = [body];
  }

  return mod;
}

/** Helper: full root scene with a single gear. Useful for unit visualization. */
export function buildSpurGearScene(params?: SpurGearParams): SdfOperation {
  const mod = buildSpurGear(params);
  const root = makeOp('union', [mod]);
  root.label = 'Scene';
  return root;
}

/**
 * Convenience — derived geometry the consumer cares about.
 * Re-exported so a UI panel can show "pitch radius = X" without importing two files.
 */
export function spurGearGeometry(p: SpurGearParams) {
  return deriveGearGeometry(p);
}
