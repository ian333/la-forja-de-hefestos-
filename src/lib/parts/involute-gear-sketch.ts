/**
 * ⚒️ La Forja — Involute Gear Sketch
 * =====================================
 * Pure 2D parametric sketch of a spur-gear tooth profile.
 * This is the *editable sketch* — like opening a sketch on a plane in Fusion:
 * you twiddle params, you get a new closed polyline of Point2D vertices.
 *
 * Downstream, `spur-gear.ts` extrudes this polyline into an SdfModule.
 *
 * Conventions
 * -----------
 *   - Sketch plane: XY. Tooth axis of rotation = Z (out of the page).
 *   - Units: the same as `module` (typically mm). 1 sketch unit = 1 mm.
 *   - CCW vertex order (positive shoelace area).
 *
 * Math
 * ----
 *   Standard involute with module m and pressure angle α:
 *     pitchRadius     rp = m · Z / 2
 *     baseRadius      rb = rp · cos(α)
 *     addendumRadius  ra = rp + m · ka            (ka = addendumCoef,  typ 1)
 *     dedendumRadius  rf = rp − m · kd            (kd = dedendumCoef,  typ 1.25)
 *     invα            = tan(α) − α                 (involute function)
 *     ψb              = π/(2Z) + invα              (half tooth angle at base circle)
 *
 *   Involute curve (right flank, anchored at φ0 on the base circle):
 *     x(t) = rb · (cos(t + φ0) +  t · sin(t + φ0))
 *     y(t) = rb · (sin(t + φ0) −  t · cos(t + φ0))
 *     with t ∈ [t_start, t_max] where
 *       t_max   = √((ra/rb)² − 1)
 *       t_start = √((max(rb, rf)/rb)² − 1)          (= 0 if rf ≤ rb)
 *
 *   Left flank is the reflection of the right flank across the tooth axis
 *   (the ray from origin at angle θ_center).
 */

import type { Point2D } from '../cross-section';
import { filletPolygon } from '../sketch-ops';

// ─────────────────────────────────────────────────────────────
// Params
// ─────────────────────────────────────────────────────────────

export interface GearSketchParams {
  /** Gear module m (sketch-unit per tooth-pair of arc-length). Typ 0.5–3. */
  module: number;
  /** Number of teeth Z. Integer ≥ 8 for clean involute without undercut. */
  teethCount: number;
  /** Pressure angle α in radians. Typ 20° = 0.34906585. */
  pressureAngle: number;
  /** Addendum coefficient ka. Standard full-depth tooth: 1.0. */
  addendumCoef: number;
  /** Dedendum coefficient kd. Standard: 1.25. */
  dedendumCoef: number;
  /** Samples along each involute flank (more = smoother, heavier SDF). */
  profileResolution: number;
  /** Samples along each addendum/root arc. */
  arcResolution: number;
  /** Phase offset for the whole gear (rad). Used for mesh alignment. */
  rotation: number;
  /**
   * Fillet radius applied to every sharp corner of the tooth profile
   * (tip corners, root corners, radial-drop transitions). In physical units
   * (same as module). 0 = sharp profile. Typical: 0.1·m … 0.3·m.
   *
   * The fillet is clamped per-corner so arcs never self-overlap. On gears
   * with tight tooth roots, the effective radius at the root will be smaller
   * than requested.
   */
  filletRadius?: number;
  /** Arc subdivisions per filleted corner. Default 4. */
  filletSegments?: number;
}

export const GEAR_SKETCH_DEFAULTS: GearSketchParams = {
  module: 1.0,
  teethCount: 20,
  pressureAngle: (20 * Math.PI) / 180,
  addendumCoef: 1.0,
  dedendumCoef: 1.25,
  profileResolution: 8,
  arcResolution: 4,
  rotation: 0,
  filletRadius: 0,
  filletSegments: 4,
};

/** Hard physical limits. Outside these, the involute degenerates. */
export const GEAR_SKETCH_LIMITS: Record<
  keyof Pick<GearSketchParams, 'module' | 'teethCount' | 'pressureAngle' | 'addendumCoef' | 'dedendumCoef'>,
  [number, number]
> = {
  module: [0.1, 10],
  teethCount: [6, 200],
  pressureAngle: [(14 * Math.PI) / 180, (30 * Math.PI) / 180],
  addendumCoef: [0.5, 1.5],
  dedendumCoef: [0.9, 1.8],
};

// ─────────────────────────────────────────────────────────────
// Derived geometry
// ─────────────────────────────────────────────────────────────

export interface GearGeometry {
  pitchRadius: number;
  baseRadius: number;
  addendumRadius: number;
  dedendumRadius: number;
  toothAngle: number;        // 2π / Z
  pitchHalfAngle: number;    // ψp = π/(2Z)
  baseHalfAngle: number;     // ψb = ψp + inv(α)
  /** Involute function inv(α) = tan(α) − α. */
  invAlpha: number;
  /** Starting t parameter along the involute (0 if rf ≤ rb). */
  tStart: number;
  /** Ending t parameter along the involute (at addendum). */
  tEnd: number;
  /** True iff dedendum is below base circle (common for small Z). */
  hasRadialDrop: boolean;
}

export function deriveGearGeometry(p: GearSketchParams): GearGeometry {
  const rp = (p.module * p.teethCount) / 2;
  const rb = rp * Math.cos(p.pressureAngle);
  const ra = rp + p.module * p.addendumCoef;
  const rf = rp - p.module * p.dedendumCoef;
  const invAlpha = Math.tan(p.pressureAngle) - p.pressureAngle;
  const psiP = Math.PI / (2 * p.teethCount);
  const psiB = psiP + invAlpha;
  const rInvoluteStart = Math.max(rb, rf);
  const tStart = Math.sqrt(Math.max(0, (rInvoluteStart / rb) ** 2 - 1));
  const tEnd = Math.sqrt(Math.max(0, (ra / rb) ** 2 - 1));
  return {
    pitchRadius: rp,
    baseRadius: rb,
    addendumRadius: ra,
    dedendumRadius: rf,
    toothAngle: (2 * Math.PI) / p.teethCount,
    pitchHalfAngle: psiP,
    baseHalfAngle: psiB,
    invAlpha,
    tStart,
    tEnd,
    hasRadialDrop: rf < rb,
  };
}

// ─────────────────────────────────────────────────────────────
// Primitives — involute point, polar point, reflect
// ─────────────────────────────────────────────────────────────

/** Right-flank involute point, anchored on base circle at angle φ0. */
function involutePoint(rb: number, phi0: number, t: number): Point2D {
  const c = Math.cos(t + phi0);
  const s = Math.sin(t + phi0);
  return { x: rb * (c + t * s), y: rb * (s - t * c) };
}

function polar(r: number, theta: number): Point2D {
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
}

/** Reflect (p) across the ray from origin at angle γ. */
function reflectAcrossRay(p: Point2D, gamma: number): Point2D {
  const c = Math.cos(2 * gamma);
  const s = Math.sin(2 * gamma);
  return { x: p.x * c + p.y * s, y: p.x * s - p.y * c };
}

// ─────────────────────────────────────────────────────────────
// Tooth profile builder
// ─────────────────────────────────────────────────────────────

/**
 * Build one tooth cycle in CCW order, starting at the root midpoint that
 * precedes this tooth and ending at the root midpoint that follows it.
 *
 * Vertex count per tooth ≈ 2·arcRes (roots) + 2·profRes (flanks) + arcRes (addendum) + 2 (radial drops).
 */
function buildToothVertices(
  g: GearGeometry,
  thetaCenter: number,
  profileRes: number,
  arcRes: number,
): Point2D[] {
  const out: Point2D[] = [];
  const half = g.toothAngle / 2;
  const rb = g.baseRadius;
  const rf = g.dedendumRadius;
  const rInvStart = Math.max(rb, rf);

  // Right flank anchor on base circle: φ0_r = θc − ψb
  const phi0Right = thetaCenter - g.baseHalfAngle;
  const rightInvStart = involutePoint(rb, phi0Right, g.tStart);
  const rightInvEnd = involutePoint(rb, phi0Right, g.tEnd);
  const leftInvStart = reflectAcrossRay(rightInvStart, thetaCenter);
  const leftInvEnd = reflectAcrossRay(rightInvEnd, thetaCenter);

  // Analytical (unwrapped) angular positions — avoid atan2 wrap-around for
  // teeth near θ = ±π. These come directly from the involute formula:
  //   angle(t) = φ0 + t − atan(t)
  // and its reflection across θ_center.
  const invAtEnd = g.tEnd - Math.atan(g.tEnd);         // angular offset at r=ra
  const invAtStart = g.tStart - Math.atan(g.tStart);   // 0 if tStart=0
  const rightRootAngle = thetaCenter - g.baseHalfAngle + invAtStart;
  const leftRootAngle = thetaCenter + g.baseHalfAngle - invAtStart;
  const addendumStartAngle = thetaCenter - g.baseHalfAngle + invAtEnd;
  const addendumEndAngle = thetaCenter + g.baseHalfAngle - invAtEnd;

  // ── Root arc (leading half: from prev-tooth-end midpoint up to right flank root entry) ──
  // Midpoint between teeth on root circle is at thetaCenter − half.
  const rootStartAngle = thetaCenter - half;
  for (let i = 0; i < arcRes; i++) {
    const u = i / arcRes;
    const a = rootStartAngle + u * (rightRootAngle - rootStartAngle);
    out.push(polar(rf, a));
  }

  // ── Radial drop from root to involute start (only if rInvStart > rf, i.e. rb > rf) ──
  if (g.hasRadialDrop) {
    // Land at (rInvStart, rightRootAngle) — this is rightInvStart itself.
    out.push({ x: rightInvStart.x, y: rightInvStart.y });
  } else {
    // Involute meets root circle directly.
    void rInvStart;
  }

  // ── Right flank involute (rb/rf → ra) ──
  // If we already pushed rightInvStart above, skip its duplicate at i=0.
  const skipFirst = g.hasRadialDrop ? 1 : 0;
  for (let i = skipFirst; i <= profileRes; i++) {
    const t = g.tStart + (i / profileRes) * (g.tEnd - g.tStart);
    out.push(involutePoint(rb, phi0Right, t));
  }

  // ── Addendum arc across the top of the tooth ──
  for (let i = 1; i < arcRes; i++) {
    const u = i / arcRes;
    const a = addendumStartAngle + u * (addendumEndAngle - addendumStartAngle);
    out.push(polar(g.addendumRadius, a));
  }

  // ── Left flank involute (ra → rb/rf), in reverse direction ──
  for (let i = 0; i <= profileRes; i++) {
    const t = g.tEnd - (i / profileRes) * (g.tEnd - g.tStart);
    const rightPt = involutePoint(rb, phi0Right, t);
    out.push(reflectAcrossRay(rightPt, thetaCenter));
  }

  // ── Radial drop from involute-start back to root (mirror side) ──
  if (g.hasRadialDrop) {
    out.push(polar(rf, leftRootAngle));
  }

  // ── Root arc (trailing half: from left flank root exit to tooth-pair midpoint) ──
  const rootEndAngle = thetaCenter + half;
  for (let i = 1; i <= arcRes; i++) {
    const u = i / arcRes;
    const a = leftRootAngle + u * (rootEndAngle - leftRootAngle);
    out.push(polar(rf, a));
  }

  return out;
}

// ─────────────────────────────────────────────────────────────
// Public API — full closed polyline for the gear sketch
// ─────────────────────────────────────────────────────────────

export function buildGearSketch(
  params: GearSketchParams = GEAR_SKETCH_DEFAULTS,
): Point2D[] {
  const g = deriveGearGeometry(params);
  const verts: Point2D[] = [];
  for (let k = 0; k < params.teethCount; k++) {
    const thetaCenter = params.rotation + k * g.toothAngle;
    const toothVerts = buildToothVertices(
      g,
      thetaCenter,
      params.profileResolution,
      params.arcResolution,
    );
    // Avoid duplicating the last point of prev tooth with the first of this one.
    if (verts.length > 0) toothVerts.shift();
    verts.push(...toothVerts);
  }
  // Dedup the wrap-around seam (first ≈ last).
  if (verts.length > 1) {
    const first = verts[0];
    const last = verts[verts.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-9) verts.pop();
  }
  // Apply fillet to all sharp corners (tip + root transitions). Arc sub-points
  // inside the addendum/root/radial arcs are near-collinear and get skipped by
  // the default angle threshold in `filletPolygon`.
  const r = params.filletRadius ?? 0;
  if (r > 0) {
    return filletPolygon(verts, r, {
      segments: params.filletSegments ?? 4,
      // Cap tighter than the default so the fillet never eats past the base
      // circle or the next arc sample. 0.49 = default; 0.3 gives margin on
      // narrow root valleys.
      edgeCapFraction: 0.3,
    });
  }
  return verts;
}

/** Convenience: return sketch as `[x,y][]` suitable for `makePolygonExtrusion`. */
export function buildGearSketchAsPairs(
  params: GearSketchParams = GEAR_SKETCH_DEFAULTS,
): [number, number][] {
  return buildGearSketch(params).map((p) => [p.x, p.y]);
}

// ─────────────────────────────────────────────────────────────
// Invariants — pure functions over the sketch & params
// ─────────────────────────────────────────────────────────────

/** Shoelace signed area. Positive = CCW. */
export function sketchSignedArea(verts: Point2D[]): number {
  let a = 0;
  for (let i = 0; i < verts.length; i++) {
    const j = (i + 1) % verts.length;
    a += verts[i].x * verts[j].y - verts[j].x * verts[i].y;
  }
  return a / 2;
}

/** All vertices must lie within [rf, ra] radially (± slack). */
export function sketchRadialBounds(verts: Point2D[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const p of verts) {
    const r = Math.hypot(p.x, p.y);
    if (r < min) min = r;
    if (r > max) max = r;
  }
  return { min, max };
}

/**
 * Z-fold rotational symmetry test: rotating the vertex ring by 2π/Z
 * should map each vertex onto another vertex of the ring. We check
 * Hausdorff distance (max min-distance) is below tol.
 */
export function sketchRotationalSymmetryError(verts: Point2D[], teethCount: number): number {
  const step = (2 * Math.PI) / teethCount;
  const c = Math.cos(step);
  const s = Math.sin(step);
  let maxErr = 0;
  for (const p of verts) {
    const rx = c * p.x - s * p.y;
    const ry = s * p.x + c * p.y;
    let minD = Infinity;
    for (const q of verts) {
      const d = Math.hypot(rx - q.x, ry - q.y);
      if (d < minD) minD = d;
    }
    if (minD > maxErr) maxErr = minD;
  }
  return maxErr;
}
