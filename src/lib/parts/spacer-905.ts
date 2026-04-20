/**
 * ⚒️ Spacer 827-9999-905 — parametric forward feature
 * ====================================================
 * Reference drawing: models/step/NIST-D2MI-Models/827-9999-905.pdf
 * Material: Aluminum 6061-T6, chromate conversion (MIL-DTL-5541 Class 1A Type II)
 *
 * Geometry (2 features, revolved around Y axis):
 *   F1 — stepped outer body (union of flange + shaft cylinders)
 *   F2 — stepped axial bore (union of counterbore + through-bore), subtracted
 *
 * Units are inches throughout (matches PDF). 1 unit = 1 inch.
 * Default values are the nominal midpoints of each tolerance band.
 */
import {
  makeCylinder,
  makeOp,
  makeModule,
  type SdfOperation,
  type SdfModule,
} from '../sdf-engine';

export interface Spacer905Params {
  /** Outer diameter of the flange (large end). Tolerance: .214–.224 */
  flangeOD: number;
  /** Axial length of the flange. Reference dim .085 */
  flangeLength: number;
  /** Outer diameter of the shaft (long slim portion). Tolerance: .156–.166 */
  shaftOD: number;
  /** Axial length of the shaft. Reference dim .910 */
  shaftLength: number;
  /** Large counterbore diameter at the flange end. Tolerance: .164–.167 */
  counterboreDiameter: number;
  /** Counterbore depth from flange face. Dim .075 ±.015 */
  counterboreDepth: number;
  /** Through-bore diameter (blind, per note 6). Tolerance: .139–.142 */
  throughBoreDiameter: number;
  /**
   * Blind-bore depth measured from the counterbore step.
   * Note 6 forbids breakthrough — we leave ~0.02" of material at the shaft tip.
   */
  throughBoreDepth: number;
}

export const SPACER_905_DEFAULTS: Spacer905Params = {
  flangeOD: 0.219,
  flangeLength: 0.085,
  shaftOD: 0.161,
  shaftLength: 0.910,
  counterboreDiameter: 0.1655,
  counterboreDepth: 0.075,
  throughBoreDiameter: 0.1405,
  // total part length = .085 + .910 = .995; counterbore eats .075; leave .02 at tip
  throughBoreDepth: 0.995 - 0.075 - 0.02,
};

/**
 * Build the shouldered spacer as a single subtract-operation module.
 * The body axis is Y (matches SDF cylinder convention).
 * The flange sits at Y=0 (flange face), shaft extends in +Y.
 */
export function buildSpacer905(params: Spacer905Params = SPACER_905_DEFAULTS): SdfModule {
  const totalLen = params.flangeLength + params.shaftLength;

  // ── F1: outer body (flange + shaft) ──
  const flange = makeCylinder(
    [0, params.flangeLength / 2, 0],
    params.flangeOD / 2,
    params.flangeLength,
  );
  flange.label = 'Flange OD';

  const shaft = makeCylinder(
    [0, params.flangeLength + params.shaftLength / 2, 0],
    params.shaftOD / 2,
    params.shaftLength,
  );
  shaft.label = 'Shaft OD';

  const outerBody = makeOp('union', [flange, shaft]);
  outerBody.label = 'F1 — OD revolve';

  // ── F2: stepped bore (counterbore + through-bore), drilled from flange face ──
  // Slight axial overlap + overshoot beyond flange face prevents coplanar-face
  // artifacts in the SDF subtract (otherwise the boolean leaves a paper-thin
  // skin at exact depth boundaries).
  const eps = 0.002;

  const counterbore = makeCylinder(
    [0, params.counterboreDepth / 2 - eps, 0],
    params.counterboreDiameter / 2,
    params.counterboreDepth + eps * 2,
  );
  counterbore.label = 'Counterbore (blind)';

  const throughBoreStart = params.counterboreDepth;
  const throughBore = makeCylinder(
    [0, throughBoreStart + params.throughBoreDepth / 2, 0],
    params.throughBoreDiameter / 2,
    params.throughBoreDepth,
  );
  throughBore.label = 'Through-bore (blind per note 6)';

  const boreStack = makeOp('union', [counterbore, throughBore]);
  boreStack.label = 'F2 — ID counterbore';

  // ── Final body = outer − bore ──
  const body = makeOp('subtract', [outerBody, boreStack]);
  body.label = 'Spacer 827-9999-905';

  const mod = makeModule('Spacer 827-9999-905');
  mod.children = [body];
  // Bounds hint for camera framing: totalLen along Y, flangeOD/2 radial.
  void totalLen;
  return mod;
}

/** Build a root SdfOperation scene containing the spacer module. */
export function buildSpacer905Scene(params?: Spacer905Params): SdfOperation {
  const mod = buildSpacer905(params);
  const root = makeOp('union', [mod]);
  root.label = 'Scene';
  return root;
}
