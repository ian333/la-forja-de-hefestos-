/**
 * ⚒️ La Forja — 2D Sketch Operations (chamfer, fillet, offset)
 * ==============================================================
 * General-purpose polyline ops. Not gear-specific — any part that
 * exposes a closed 2D polyline can reuse these.
 *
 * All ops take/return `Point2D[]` in CCW order (positive shoelace area).
 *
 * Conventions
 * -----------
 *   - Polyline is implicitly closed: verts[n-1] connects back to verts[0].
 *   - CCW order preserved (signed area sign unchanged).
 *   - Ops cap the cut per corner at ~half the shorter neighbor edge to
 *     avoid self-overlap. If the radius/distance requested is too big for
 *     a given corner, that corner uses the cap.
 *   - `chamferPolygon` replaces each corner with 2 vertices (straight cut).
 *   - `filletPolygon` replaces each corner with `segments+1` arc samples.
 *
 * Math (for fillet)
 * -----------------
 *   Let θ = interior angle at corner B between edges BA and BC.
 *   Tangent distance along each edge (from B):   d = r / tan(θ/2)
 *   Arc center offset along angle bisector:       ρ = r / sin(θ/2)
 *   The arc is tangent to both edges and subtends (π − θ) at its center.
 */

import type { Point2D } from './cross-section';

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

/** Signed area via shoelace. Positive ⇔ CCW. */
export function signedArea(verts: Point2D[]): number {
  let a = 0;
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const p = verts[i];
    const q = verts[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function vec(a: Point2D, b: Point2D): Point2D {
  return { x: b.x - a.x, y: b.y - a.y };
}
function len(v: Point2D): number {
  return Math.hypot(v.x, v.y);
}
function normalize(v: Point2D): Point2D {
  const l = len(v);
  return l < 1e-18 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
}

/**
 * Interior angle at corner B between edges BA (incoming) and BC (outgoing).
 * Returns θ ∈ (0, π]. For a straight segment (collinear), returns π.
 */
function interiorAngle(A: Point2D, B: Point2D, C: Point2D): number {
  const ba = normalize(vec(B, A));
  const bc = normalize(vec(B, C));
  if (len(ba) === 0 || len(bc) === 0) return Math.PI;
  const cos = Math.max(-1, Math.min(1, ba.x * bc.x + ba.y * bc.y));
  return Math.acos(cos);
}

// ─────────────────────────────────────────────────────────────
// Chamfer (straight cut)
// ─────────────────────────────────────────────────────────────

export interface ChamferOptions {
  /**
   * Minimum interior-angle change (rad) below which a corner is skipped.
   * A corner with θ ≈ π is collinear — no cut needed.
   * Default: 5° (0.087 rad) from π.
   */
  angleThreshold?: number;
}

/**
 * Cut each corner with a straight segment of `distance` along each edge.
 * The `distance` is clamped to at most 49% of the shorter adjacent edge
 * so the chamfered corners never overlap.
 *
 * If `angleThreshold` is exceeded (corner nearly straight), the corner is
 * left untouched (no extra vertices).
 *
 * Complexity: O(n).
 */
export function chamferPolygon(
  verts: Point2D[],
  distance: number,
  opts: ChamferOptions = {},
): Point2D[] {
  if (distance <= 0 || verts.length < 3) return verts.slice();
  const threshold = opts.angleThreshold ?? (5 * Math.PI) / 180;
  const n = verts.length;
  const out: Point2D[] = [];

  for (let i = 0; i < n; i++) {
    const A = verts[(i - 1 + n) % n];
    const B = verts[i];
    const C = verts[(i + 1) % n];

    const ba = vec(B, A);
    const bc = vec(B, C);
    const la = len(ba);
    const lc = len(bc);
    if (la < 1e-12 || lc < 1e-12) {
      out.push(B);
      continue;
    }

    const theta = interiorAngle(A, B, C);
    // Skip near-collinear corners (θ close to π)
    if (Math.PI - theta < threshold) {
      out.push(B);
      continue;
    }

    const d = Math.min(distance, 0.49 * la, 0.49 * lc);
    const uba = { x: ba.x / la, y: ba.y / la };
    const ubc = { x: bc.x / lc, y: bc.y / lc };

    // Entry: d along BA from B. Exit: d along BC from B.
    out.push({ x: B.x + uba.x * d, y: B.y + uba.y * d });
    out.push({ x: B.x + ubc.x * d, y: B.y + ubc.y * d });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Fillet (arc replacing corner)
// ─────────────────────────────────────────────────────────────

export interface FilletOptions {
  /** Number of sub-segments per arc. Higher = smoother, heavier. Default 6. */
  segments?: number;
  /** Skip corners with (π − θ) below this (rad). Default 5°. */
  angleThreshold?: number;
  /**
   * Max radius as a fraction of the shorter adjacent edge. Prevents overlap
   * when the requested radius is too big. Default 0.49.
   */
  edgeCapFraction?: number;
  /**
   * If true, only fillet convex corners (left turns in CCW). If false,
   * fillet both convex and concave. Default false.
   */
  convexOnly?: boolean;
}

/**
 * Replace each corner with a circular arc tangent to both adjacent edges.
 * Per-corner radius is capped so the arc never overshoots an adjacent edge.
 *
 * Returns a new CCW polyline. Vertex count grows by ~(segments × n) in the
 * worst case, but collinear corners are skipped.
 *
 * Complexity: O(n · segments).
 */
export function filletPolygon(
  verts: Point2D[],
  radius: number,
  opts: FilletOptions = {},
): Point2D[] {
  if (radius <= 0 || verts.length < 3) return verts.slice();
  const segments = Math.max(1, Math.floor(opts.segments ?? 6));
  const threshold = opts.angleThreshold ?? (5 * Math.PI) / 180;
  const cap = opts.edgeCapFraction ?? 0.49;
  const convexOnly = opts.convexOnly ?? false;

  const n = verts.length;
  const out: Point2D[] = [];

  for (let i = 0; i < n; i++) {
    const A = verts[(i - 1 + n) % n];
    const B = verts[i];
    const C = verts[(i + 1) % n];

    const ba = vec(B, A);
    const bc = vec(B, C);
    const la = len(ba);
    const lc = len(bc);
    if (la < 1e-12 || lc < 1e-12) {
      out.push(B);
      continue;
    }

    const theta = interiorAngle(A, B, C);
    if (Math.PI - theta < threshold) {
      out.push(B);
      continue;
    }

    // Determine convex vs concave via cross product of AB × BC (z component).
    // Positive cross with CCW polygon = convex (left turn).
    const abx = B.x - A.x, aby = B.y - A.y;
    const bcx = C.x - B.x, bcy = C.y - B.y;
    const cross = abx * bcy - aby * bcx;
    const isConvex = cross > 0;
    if (convexOnly && !isConvex) {
      out.push(B);
      continue;
    }

    const tanHalf = Math.tan(theta / 2);
    if (tanHalf < 1e-12) {
      out.push(B);
      continue;
    }

    // Desired tangent distance
    const dWant = radius / tanHalf;
    const dMax = cap * Math.min(la, lc);
    const d = Math.min(dWant, dMax);
    const rEff = d * tanHalf;

    // Tangent points on each edge
    const uba = { x: ba.x / la, y: ba.y / la };
    const ubc = { x: bc.x / lc, y: bc.y / lc };
    const p1: Point2D = { x: B.x + uba.x * d, y: B.y + uba.y * d };
    const p2: Point2D = { x: B.x + ubc.x * d, y: B.y + ubc.y * d };

    // Arc center: along angle bisector (away from B for convex, toward for concave)
    const bisx = uba.x + ubc.x;
    const bisy = uba.y + ubc.y;
    const blen = Math.hypot(bisx, bisy);
    if (blen < 1e-12) {
      // 180° — no fillet
      out.push(B);
      continue;
    }
    // Bisector unit vector points INTO the polygon for convex corners.
    const ubis = { x: bisx / blen, y: bisy / blen };
    const rho = rEff / Math.sin(theta / 2);
    // For convex (left turn CCW): arc center is OUTSIDE the convex corner
    // but ON THE INTERIOR of the polygon — i.e., along +bisector from B.
    // For concave: same formula; bisector points outward, center goes inward
    // away from the corner. Both cases use +bisector from B.
    const center: Point2D = { x: B.x + ubis.x * rho, y: B.y + ubis.y * rho };

    // Sweep arc from p1 → p2 around center, going the short way (|da| < π).
    // |da| equals (π − θ) regardless of convex/concave: the arc is tangent
    // to both edges and subtends the supplement of the interior angle.
    const a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
    const a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
    let da = a2 - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da <= -Math.PI) da += 2 * Math.PI;
    const expectedMag = Math.PI - theta;
    if (Math.abs(Math.abs(da) - expectedMag) > 1e-6) {
      // Numerical pathology — keep the sharp corner rather than emit garbage.
      out.push(B);
      continue;
    }
    // `isConvex` is informational; no sign flip needed (both use short sweep).
    void isConvex;

    for (let k = 0; k <= segments; k++) {
      const t = k / segments;
      const a = a1 + da * t;
      out.push({
        x: center.x + rEff * Math.cos(a),
        y: center.y + rEff * Math.sin(a),
      });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Diagnostic — count "sharp" corners (for tests / heuristics)
// ─────────────────────────────────────────────────────────────

export function countSharpCorners(
  verts: Point2D[],
  thresholdRad: number = (170 * Math.PI) / 180,
): number {
  const n = verts.length;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const A = verts[(i - 1 + n) % n];
    const B = verts[i];
    const C = verts[(i + 1) % n];
    if (len(vec(B, A)) < 1e-12 || len(vec(B, C)) < 1e-12) continue;
    const theta = interiorAngle(A, B, C);
    if (theta < thresholdRad) count++;
  }
  return count;
}
