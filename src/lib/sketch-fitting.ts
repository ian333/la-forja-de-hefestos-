/**
 * ⚒️ La Forja de Hefestos — Sketch Fitting v2
 * ==============================================
 * Recursive subdivision: contour points → Lines + Arcs + Constraints.
 *
 * Philosophy: "si no es una línea, es una curva, y esa curva es un círculo."
 * Everything in mechanical parts can be described with lines and arcs.
 *
 * Algorithm:
 *  Phase 0: Full circle test
 *  Phase 1: Open contour at max curvature discontinuity
 *  Phase 2: Recursive line+arc fitting (top-down subdivision)
 *  Phase 3: Post-merge adjacent collinear lines / same-center arcs
 *  Phase 4: Snap endpoints for C0 continuity
 *  Phase 5: Detect constraints (tangent, perpendicular, H/V, equal_radius)
 */

import type { Point2D, Contour, SliceAxis } from './cross-section';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface SketchLine {
  type: 'line';
  start: Point2D;
  end: Point2D;
}

export interface SketchArc {
  type: 'arc';
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
  start: Point2D;
  end: Point2D;
  isFullCircle: boolean;
}

export type SketchEntity = SketchLine | SketchArc;

export interface SketchConstraint {
  type: 'tangent' | 'perpendicular' | 'collinear' | 'horizontal' | 'vertical' | 'concentric' | 'equal_radius';
  entities: number[];
}

export interface SketchFitResult {
  entities: SketchEntity[];
  constraints: SketchConstraint[];
}

/** A fully fitted slice: axis + value + fitted contours */
export interface FittedSlice {
  axis: SliceAxis;
  value: number;
  contours: FittedContour[];
  /** Plane-local U axis in world space (from GPU pipeline). When present,
   *  3D reconstruction is: worldPos = planeOrigin + pt.x * uAxis + pt.y * vAxis */
  uAxis?: [number, number, number];
  /** Plane-local V axis in world space */
  vAxis?: [number, number, number];
  /** Origin of the 2D coordinate system in world space */
  planeOrigin?: [number, number, number];
}

export interface FittedContour {
  entities: SketchEntity[];
  constraints: SketchConstraint[];
  originalPoints: Point2D[];
  error: { maxError: number; avgError: number; coverage: number };
}

// ═══════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════

function dist(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function lerp(a: Point2D, b: Point2D, t: number): Point2D {
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

function cross2D(a: Point2D, b: Point2D): number {
  return a.x * b.y - a.y * b.x;
}

function angleBetween(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Distance from point p to line segment a→b */
function pointToSegmentDist(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-20) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** Perpendicular distance from p to infinite line through (start, end) */
function lineDistToPoint(start: Point2D, end: Point2D, p: Point2D): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-12) return dist(p, start);
  return Math.abs(dy * p.x - dx * p.y + end.x * start.y - end.y * start.x) / len;
}

function lineAngle(start: Point2D, end: Point2D): number {
  return Math.atan2(end.y - start.y, end.x - start.x);
}

function lineLength(start: Point2D, end: Point2D): number {
  return dist(start, end);
}

// ═══════════════════════════════════════════════════════════════
// Circle Fitting (Kasa algebraic method)
// ═══════════════════════════════════════════════════════════════

interface CircleFit {
  center: Point2D;
  radius: number;
  maxError: number;
  avgError: number;
}

function fitCircle(points: Point2D[]): CircleFit | null {
  if (points.length < 3) return null;

  let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0;
  let sumX3 = 0, sumY3 = 0, sumX2Y = 0, sumXY2 = 0;
  const n = points.length;

  for (const p of points) {
    sumX += p.x; sumY += p.y;
    sumX2 += p.x * p.x; sumY2 += p.y * p.y;
    sumXY += p.x * p.y;
    sumX3 += p.x ** 3; sumY3 += p.y ** 3;
    sumX2Y += p.x * p.x * p.y; sumXY2 += p.x * p.y * p.y;
  }

  const A = n * sumX2 - sumX * sumX;
  const B = n * sumXY - sumX * sumY;
  const C = n * sumY2 - sumY * sumY;
  const D = 0.5 * (n * sumX3 + n * sumXY2 - sumX * sumX2 - sumX * sumY2);
  const E = 0.5 * (n * sumX2Y + n * sumY3 - sumY * sumX2 - sumY * sumY2);

  const det = A * C - B * B;
  if (Math.abs(det) < 1e-12) return null;

  const cx = (D * C - B * E) / det;
  const cy = (A * E - B * D) / det;
  const center: Point2D = { x: cx, y: cy };

  let rSum = 0;
  for (const p of points) rSum += dist(p, center);
  const radius = rSum / n;

  let maxErr = 0, sumErr = 0;
  for (const p of points) {
    const err = Math.abs(dist(p, center) - radius);
    maxErr = Math.max(maxErr, err);
    sumErr += err;
  }

  return { center, radius, maxError: maxErr, avgError: sumErr / n };
}

/** 3-point circle (for curvature estimation) */
function circleFrom3Points(p1: Point2D, p2: Point2D, p3: Point2D): { center: Point2D; radius: number } | null {
  const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
  if (Math.abs(d) < 1e-10) return null;
  const ux = ((p1.x ** 2 + p1.y ** 2) * (p2.y - p3.y) + (p2.x ** 2 + p2.y ** 2) * (p3.y - p1.y) + (p3.x ** 2 + p3.y ** 2) * (p1.y - p2.y)) / d;
  const uy = ((p1.x ** 2 + p1.y ** 2) * (p3.x - p2.x) + (p2.x ** 2 + p2.y ** 2) * (p1.x - p3.x) + (p3.x ** 2 + p3.y ** 2) * (p2.x - p1.x)) / d;
  return { center: { x: ux, y: uy }, radius: dist({ x: ux, y: uy }, p1) };
}

// ═══════════════════════════════════════════════════════════════
// Geometric Circle Refinement (Gauss-Newton)
// ═══════════════════════════════════════════════════════════════

/** Solve 3×3 linear system Ax=b via Gaussian elimination with partial pivoting */
function solve3x3(A: number[][], b: number[]): number[] | null {
  const a = A.map(row => [...row]);
  const x = [...b];
  for (let col = 0; col < 3; col++) {
    let maxVal = Math.abs(a[col][col]), maxRow = col;
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(a[row][col]) > maxVal) { maxVal = Math.abs(a[row][col]); maxRow = row; }
    }
    if (maxVal < 1e-15) return null;
    if (maxRow !== col) { [a[col], a[maxRow]] = [a[maxRow], a[col]]; [x[col], x[maxRow]] = [x[maxRow], x[col]]; }
    for (let row = col + 1; row < 3; row++) {
      const f = a[row][col] / a[col][col];
      for (let j = col; j < 3; j++) a[row][j] -= f * a[col][j];
      x[row] -= f * x[col];
    }
  }
  const result = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let sum = x[i];
    for (let j = i + 1; j < 3; j++) sum -= a[i][j] * result[j];
    if (Math.abs(a[i][i]) < 1e-15) return null;
    result[i] = sum / a[i][i];
  }
  return result;
}

/**
 * Gauss-Newton geometric circle refinement.
 * Kasa is algebraic — this minimizes the TRUE geometric residual:
 * Σ (dist(pᵢ, center) - r)². Converges to sub-micron precision.
 */
function refineCircleGeometric(points: Point2D[], initial: CircleFit, maxIter = 25): CircleFit {
  let cx = initial.center.x, cy = initial.center.y, r = initial.radius;
  const n = points.length;
  for (let iter = 0; iter < maxIter; iter++) {
    let JtJ00 = 0, JtJ01 = 0, JtJ02 = 0;
    let JtJ11 = 0, JtJ12 = 0, JtJ22 = 0;
    let Jtr0 = 0, Jtr1 = 0, Jtr2 = 0;
    for (const p of points) {
      const dx = p.x - cx, dy = p.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1e-15) continue;
      const res = d - r;
      const j0 = -dx / d, j1 = -dy / d, j2 = -1;
      JtJ00 += j0 * j0; JtJ01 += j0 * j1; JtJ02 += j0 * j2;
      JtJ11 += j1 * j1; JtJ12 += j1 * j2; JtJ22 += j2 * j2;
      Jtr0 += j0 * res; Jtr1 += j1 * res; Jtr2 += j2 * res;
    }
    const delta = solve3x3(
      [[JtJ00, JtJ01, JtJ02], [JtJ01, JtJ11, JtJ12], [JtJ02, JtJ12, JtJ22]],
      [-Jtr0, -Jtr1, -Jtr2],
    );
    if (!delta) break;
    cx += delta[0]; cy += delta[1]; r += delta[2];
    if (Math.sqrt(delta[0] ** 2 + delta[1] ** 2 + delta[2] ** 2) < 1e-14) break;
  }
  r = Math.abs(r);
  let maxErr = 0, sumErr = 0;
  for (const p of points) {
    const err = Math.abs(dist(p, { x: cx, y: cy }) - r);
    maxErr = Math.max(maxErr, err);
    sumErr += err;
  }
  return { center: { x: cx, y: cy }, radius: r, maxError: maxErr, avgError: sumErr / n };
}

/** Project point onto circle circumference (closest point) */
function projectOntoCircle(pt: Point2D, center: Point2D, radius: number): Point2D {
  const dx = pt.x - center.x, dy = pt.y - center.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-15) return { x: center.x + radius, y: center.y };
  return { x: center.x + (dx / d) * radius, y: center.y + (dy / d) * radius };
}

// ═══════════════════════════════════════════════════════════════
// Exact Geometric Intersections (for zero-error C0 continuity)
// ═══════════════════════════════════════════════════════════════

/** Line-line intersection of infinite lines through (p1→p1+d1) and (p2→p2+d2) */
function lineLineIntersection(p1: Point2D, d1: Point2D, p2: Point2D, d2: Point2D): Point2D | null {
  const det = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(det) < 1e-12) return null;
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const t = (dx * d2.y - dy * d2.x) / det;
  return { x: p1.x + t * d1.x, y: p1.y + t * d1.y };
}

/** Line-circle intersection: parametric line p+t*d vs circle (center,r) */
function lineCircleIntersection(p: Point2D, d: Point2D, center: Point2D, radius: number): Point2D[] {
  const ox = p.x - center.x, oy = p.y - center.y;
  const a = d.x * d.x + d.y * d.y;
  if (a < 1e-20) return [];
  const b = 2 * (ox * d.x + oy * d.y);
  const c = ox * ox + oy * oy - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < -1e-9) return [];
  const sq = Math.sqrt(Math.max(0, disc));
  const t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a);
  return [
    { x: p.x + t1 * d.x, y: p.y + t1 * d.y },
    { x: p.x + t2 * d.x, y: p.y + t2 * d.y },
  ];
}

/** Circle-circle intersection: returns 0-2 points */
function circleCircleIntersection(c1: Point2D, r1: number, c2: Point2D, r2: number): Point2D[] {
  const dx = c2.x - c1.x, dy = c2.y - c1.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > r1 + r2 + 1e-9 || d < Math.abs(r1 - r2) - 1e-9 || d < 1e-12) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  const h = h2 > 0 ? Math.sqrt(h2) : 0;
  const mx = c1.x + a * dx / d, my = c1.y + a * dy / d;
  return [
    { x: mx + h * dy / d, y: my - h * dx / d },
    { x: mx - h * dy / d, y: my + h * dx / d },
  ];
}

/**
 * Compute the exact shared point between two entities at their junction.
 * Uses geometric intersection (line-line / line-circle / circle-circle)
 * for mathematically precise C0 continuity.
 *
 * @param maxDrift  Absolute distance limit — intersection points farther
 *                  than this from the midpoint are rejected (defaults to Infinity).
 *                  Should be set to a fraction of the contour diagonal to
 *                  prevent endpoints from shooting far outside the model.
 */
function computeSharedPoint(prev: SketchEntity, next: SketchEntity, maxDrift = Infinity): Point2D {
  const pEnd = getEnd(prev);
  const nStart = getStart(next);
  const mid = lerp(pEnd, nStart, 0.5);

  // Shared guard: computed point must be within maxDrift of midpoint
  const ok = (pt: Point2D) => dist(pt, mid) < maxDrift;

  if (prev.type === 'line' && next.type === 'line') {
    const d1 = { x: prev.end.x - prev.start.x, y: prev.end.y - prev.start.y };
    const d2 = { x: next.end.x - next.start.x, y: next.end.y - next.start.y };
    const pt = lineLineIntersection(prev.start, d1, next.start, d2);
    if (pt && ok(pt)) return pt;
    return mid;
  }

  if (prev.type === 'line' && next.type === 'arc' && !next.isFullCircle) {
    const d = { x: prev.end.x - prev.start.x, y: prev.end.y - prev.start.y };
    const pts = lineCircleIntersection(prev.start, d, next.center, next.radius).filter(ok);
    if (pts.length > 0) return pts.reduce((best, p) => dist(p, mid) < dist(best, mid) ? p : best);
    const proj = projectOntoCircle(mid, next.center, next.radius);
    return ok(proj) ? proj : mid;
  }

  if (prev.type === 'arc' && !prev.isFullCircle && next.type === 'line') {
    const d = { x: next.end.x - next.start.x, y: next.end.y - next.start.y };
    const pts = lineCircleIntersection(next.start, d, prev.center, prev.radius).filter(ok);
    if (pts.length > 0) return pts.reduce((best, p) => dist(p, mid) < dist(best, mid) ? p : best);
    const proj = projectOntoCircle(mid, prev.center, prev.radius);
    return ok(proj) ? proj : mid;
  }

  if (prev.type === 'arc' && !prev.isFullCircle && next.type === 'arc' && !next.isFullCircle) {
    if (dist(prev.center, next.center) < 1e-6 && Math.abs(prev.radius - next.radius) < 1e-6) {
      return projectOntoCircle(mid, prev.center, prev.radius);
    }
    const pts = circleCircleIntersection(prev.center, prev.radius, next.center, next.radius).filter(ok);
    if (pts.length > 0) return pts.reduce((best, p) => dist(p, mid) < dist(best, mid) ? p : best);
    const target = prev.radius >= next.radius ? prev : next;
    const proj = projectOntoCircle(mid, target.center, target.radius);
    return ok(proj) ? proj : mid;
  }

  if (prev.type === 'arc' && !prev.isFullCircle) return projectOntoCircle(mid, prev.center, prev.radius);
  if (next.type === 'arc' && !next.isFullCircle) return projectOntoCircle(mid, next.center, next.radius);
  return mid;
}

/** Local curvature at point i (signed: positive = CCW) */
function localCurvature(pts: Point2D[], i: number): number {
  const n = pts.length;
  const prev = pts[(i - 1 + n) % n];
  const curr = pts[i];
  const next = pts[(i + 1) % n];
  const circ = circleFrom3Points(prev, curr, next);
  if (!circ || circ.radius > 1e6) return 0;
  const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
  const v2 = { x: next.x - curr.x, y: next.y - curr.y };
  const sign = cross2D(v1, v2) >= 0 ? 1 : -1;
  return sign / circ.radius;
}

// ═══════════════════════════════════════════════════════════════
// CORE: Recursive Subdivision Fitting
// ═══════════════════════════════════════════════════════════════

function bboxOf(pts: Point2D[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Compute signed sweep from startAngle to endAngle ensuring
 * midAngle is within the sweep.
 */
function computeSweep(startAngle: number, endAngle: number, midAngle: number): number {
  let sweepCCW = endAngle - startAngle;
  while (sweepCCW <= 0) sweepCCW += 2 * Math.PI;

  let midCCW = midAngle - startAngle;
  while (midCCW <= 0) midCCW += 2 * Math.PI;

  if (midCCW <= sweepCCW) {
    return sweepCCW; // CCW path contains midpoint
  } else {
    return -(2 * Math.PI - sweepCCW); // CW path
  }
}

function makeArc(center: Point2D, radius: number, sa: number, ea: number, startPt: Point2D, endPt: Point2D): SketchArc {
  return {
    type: 'arc',
    center, radius,
    startAngle: sa, endAngle: ea,
    start: startPt, end: endPt,
    isFullCircle: false, // Only set explicitly in Phase 0 or Phase 3 wrap-around
  };
}

function makeLine(start: Point2D, end: Point2D): SketchLine {
  return { type: 'line', start: { ...start }, end: { ...end } };
}

function sweepAngle(arc: SketchArc): number {
  let s = arc.endAngle - arc.startAngle;
  while (s > 2 * Math.PI) s -= 2 * Math.PI;
  while (s < -2 * Math.PI) s += 2 * Math.PI;
  return s;
}

function arcLength(arc: SketchArc): number {
  return arc.radius * Math.abs(sweepAngle(arc));
}

/**
 * Main fitting function v2.
 */
export function fitContour(pts: Point2D[], tolerance?: number): SketchFitResult {
  if (pts.length < 3) return { entities: [], constraints: [] };

  // ── Pre-process: remove near-duplicate consecutive points ──
  const cleaned: Point2D[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (dist(pts[i], cleaned[cleaned.length - 1]) > 1e-6) {
      cleaned.push(pts[i]);
    }
  }
  // Track whether the contour explicitly closes (last ≈ first)
  let explicitlyClosed = false;
  if (cleaned.length > 2 && dist(cleaned[0], cleaned[cleaned.length - 1]) < 1e-6) {
    cleaned.pop();
    explicitlyClosed = true;
  }
  if (cleaned.length < 3) return { entities: [], constraints: [] };

  const n = cleaned.length;
  const bbox = bboxOf(cleaned);
  const diag = Math.sqrt((bbox.maxX - bbox.minX) ** 2 + (bbox.maxY - bbox.minY) ** 2);
  // Tolerance: proportional to model size. Mechanical parts have manufacturing
  // precision ~0.01mm; tessellated STEP meshes have chord error ~diag/1000.
  // We use diag*0.002 — generous enough for tessellated arcs but precise for lines.
  const tol = tolerance ?? Math.max(0.001, diag * 0.002);

  // ── Open contour detection ──
  // If the first and last point are far apart, this is an OPEN contour
  // (partial cross-section boundary). For open contours we must NOT:
  //  - Rearrange points circularly (Phase 1 open-point selection)
  //  - Merge wrap-around arcs (Phase 3b)
  //  - Force C0 closure across the gap (Phase 4 wrap-around + Phase 4b)
  // A contour is CLOSED if:
  //  1. The last point was a near-duplicate of the first (explicitly closed), OR
  //  2. After dedup, the first→last gap is comparable to normal inter-point spacing.
  //     (For a closed ring of N points, the closure gap ≈ one normal segment.)
  //     Open contours have closure gap >> typical spacing.
  const closureDist = dist(cleaned[0], cleaned[cleaned.length - 1]);
  let avgSpacing = 0;
  for (let i = 1; i < cleaned.length; i++) {
    avgSpacing += dist(cleaned[i - 1], cleaned[i]);
  }
  avgSpacing /= Math.max(1, cleaned.length - 1);
  const isOpen = !explicitlyClosed && closureDist > Math.max(avgSpacing * 3, diag * 0.01);

  // ── Phase 0: Full circle test (Kasa + Gauss-Newton geometric refinement) ──
  // Adaptive tolerance: tessellated circles have chord error ≈ R·(1 − cos(π/N))
  // where N = number of polygon vertices. Capped at 2% of contour diagonal.
  // CRITICAL: verify that points actually span ~360° of the circle.
  // Open arcs (90°, 180°) also pass circle-fit-error tests, so we must
  // check that the angular span covers essentially the full circumference.
  const kasaFit0 = fitCircle(cleaned);
  if (!isOpen && kasaFit0 && kasaFit0.radius < diag * 2) {
    const circleFit = refineCircleGeometric(cleaned, kasaFit0);
    // Re-check radius after refinement — Gauss-Newton can blow up degenerate cases
    if (circleFit.radius < diag * 2) {
      const chordErr = circleFit.radius * (1 - Math.cos(Math.PI / Math.max(6, n)));
      const circleTol = Math.min(Math.max(tol, chordErr * 2.5), diag * 0.02);
      const relErr = circleFit.maxError / Math.max(circleFit.radius, 1e-12);
      if (circleFit.maxError < circleTol || (relErr < 0.02 && circleFit.maxError < diag * 0.01)) {
        // Verify angular span: points must cover > 355° of arc.
        // Compute individual angular steps (including closing edge last→first).
        // The largest gap between consecutive points is the "break" in the arc.
        // For a true full circle, all steps are roughly uniform.
        const cx = circleFit.center.x, cy = circleFit.center.y;
        let prevAngle = Math.atan2(cleaned[0].y - cy, cleaned[0].x - cx);
        let maxAngStep = 0;
        for (let i = 1; i <= n; i++) {
          const pt = cleaned[i % n]; // wraps back to first point
          const a = Math.atan2(pt.y - cy, pt.x - cx);
          let da = a - prevAngle;
          while (da > Math.PI) da -= 2 * Math.PI;
          while (da < -Math.PI) da += 2 * Math.PI;
          const absDA = Math.abs(da);
          if (absDA > maxAngStep) maxAngStep = absDA;
          prevAngle = a;
        }
        // Angular span = 360° minus the largest gap (if gap is significantly above average)
        const avgStep = (2 * Math.PI) / n;
        const gapRad = maxAngStep > avgStep * 1.5 ? maxAngStep : 0;
        const spanDeg = (360 - gapRad * 180 / Math.PI);
        if (spanDeg > 355) {
          const startPt = projectOntoCircle(cleaned[0], circleFit.center, circleFit.radius);
          const arc = makeArc(circleFit.center, circleFit.radius, 0, 2 * Math.PI, startPt, startPt);
          arc.isFullCircle = true;
          return { entities: [arc], constraints: [] };
        }
      }
    }
  }

  // ── Phase 1: Find best "open" point ──
  // For OPEN contours, use natural point ordering (openIdx = 0).
  // For CLOSED contours on near-complete arcs, curvature-based open-point
  // detection fails because ALL points have the same curvature.
  // Instead, use the largest angular gap between consecutive points.
  let openIdx = 0;
  let useAngularGap = false;

  if (!isOpen && kasaFit0 && kasaFit0.radius < diag * 2) {
    const circFitForGap = refineCircleGeometric(cleaned, kasaFit0);
    const gapRelErr = circFitForGap.maxError / Math.max(circFitForGap.radius, 1e-12);
    // If points lie on a circle (low error) but it wasn't a full circle,
    // find the gap by looking for the largest angular jump between consecutive points
    if (gapRelErr < 0.05) {  // points are roughly circular
      const cx = circFitForGap.center.x, cy = circFitForGap.center.y;
      const angles: number[] = [];
      for (let i = 0; i < n; i++) {
        angles.push(Math.atan2(cleaned[i].y - cy, cleaned[i].x - cx));
      }
      let maxGap = -1;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        let gap = angles[j] - angles[i];
        while (gap > Math.PI) gap -= 2 * Math.PI;
        while (gap < -Math.PI) gap += 2 * Math.PI;
        const absGap = Math.abs(gap);
        if (absGap > maxGap) {
          maxGap = absGap;
          openIdx = j;
        }
      }
      // Only use angular gap if it's significantly larger than average spacing
      const avgSpacing = (2 * Math.PI) / n;
      if (maxGap > avgSpacing * 2) {
        useAngularGap = true;
      }
    }
  }

  if (!isOpen && !useAngularGap) {
    const kappa = new Float64Array(n);
    for (let i = 0; i < n; i++) kappa[i] = localCurvature(cleaned, i);
    let maxJump = -1;
    for (let i = 0; i < n; i++) {
      const jump = Math.abs(kappa[i] - kappa[(i + 1) % n]);
      if (jump > maxJump) { maxJump = jump; openIdx = (i + 1) % n; }
    }
  }

  const openPts: Point2D[] = [];
  for (let i = 0; i < n; i++) openPts.push(cleaned[(openIdx + i) % n]);

  // ── Phase 2: Corner-aware segmented fitting ──
  // Instead of recursively subdividing the entire contour (which creates
  // hundreds of tiny segments at tessellation stair-steps), we first detect
  // genuine corner points (sharp angle changes), split at those corners,
  // and fit each segment as a SINGLE entity (line or arc).
  // Only if a segment can't be fit as one entity do we fall back to recursion.
  const cornerIndices = detectCorners(openPts, tol);
  const breakPts = [0, ...cornerIndices, openPts.length - 1];
  // Dedupe + sort
  const uniqueBreaks = [...new Set(breakPts)].sort((a, b) => a - b);

  const entities: SketchEntity[] = [];
  for (let s = 0; s < uniqueBreaks.length - 1; s++) {
    const segStart = uniqueBreaks[s];
    const segEnd = uniqueBreaks[s + 1];
    if (segEnd - segStart < 1) continue;
    entities.push(...fitSegment(openPts, segStart, segEnd, tol, diag));
  }

  // ── Phase 3: Post-merge + arc→circle upgrade ──
  let merged = mergeEntities(entities, tol);

  // NOTE: No 350°→full-circle promotion. Only Phase 0 decides if the
  // entire contour is a circle. This prevents ghost full-circles
  // coexisting with other entities in the chain.

  // ── Phase 3c: Promote runs of consecutive small lines → arcs ──
  // After recursiveFit, many genuine arcs get split into 4-20 tiny lines
  // because individual sub-segments were within line tolerance. This pass
  // sweeps a sliding window over the entity chain, collecting runs of 3+
  // adjacent lines, and tries to fit them as a single arc.
  merged = promoteLinesToArcs(merged, tol, diag);

  // ── Phase 3d: Demote small arcs → lines ──
  // Arcs with very small sweep (< 20°) that can be well-approximated by
  // a straight line are just corners, not real arcs.
  merged = demoteSmallArcs(merged, tol);

  // ── Phase 3e: Promote consecutive arcs → circles ──
  // Chains of arcs with similar center/radius that together span > 340°
  // are clearly holes — promote to a single full circle.
  merged = promoteArcsToCircles(merged, tol);

  // ── Phase 3b: Wrap-around merge — first+last arcs with same center ──
  // Skip for open contours — no wrap-around topology.
  if (!isOpen && merged.length >= 2) {
    const first = merged[0], last = merged[merged.length - 1];
    if (first.type === 'arc' && last.type === 'arc') {
      const cd = dist(first.center, last.center);
      const rd = Math.abs(first.radius - last.radius);
      if (cd < tol * 2 && rd < tol * 2) {
        const ac = lerp(first.center, last.center, 0.5);
        const ar = (first.radius + last.radius) / 2;
        const cs = sweepAngle(last) + sweepAngle(first);
        if (Math.abs(cs) > Math.PI * 1.94 && merged.length === 2) {
          // Full circle ONLY when these are the only two entities
          const circle = makeArc(ac, ar, 0, 2 * Math.PI, last.start, last.start);
          circle.isFullCircle = true;
          merged = [circle];
        } else if (Math.abs(cs) > 0.1) {
          const combinedArc = makeArc(ac, ar, last.startAngle, last.startAngle + cs, last.start, first.end);
          merged = [combinedArc, ...merged.slice(1, -1)];
        }
      }
    }
  }

  // ── Phase 4: Exact shared endpoints via geometric intersection ──
  // Uses line-line / line-circle / circle-circle for zero-error C0.
  // driftLimit: max distance an intersection point may drift from the midpoint
  // of the gap. 20% of the contour diagonal prevents near-parallel line
  // intersections from shooting endpoints far outside the model.
  const driftLimit = diag * 0.20;
  for (let i = 0; i < merged.length; i++) {
    const curr = merged[i];
    // For open contours, don't wrap around (last → first)
    const isWrapAround = (i === merged.length - 1);
    if (isOpen && isWrapAround) continue;
    const next = merged[(i + 1) % merged.length];
    if (!curr || !next || curr === next) continue; // skip self-reference (single entity)
    if (curr.type === 'arc' && curr.isFullCircle) continue;
    if (next.type === 'arc' && next.isFullCircle) continue;
    const gap = dist(getEnd(curr), getStart(next));
    // Interior: skip only if clearly separate topology. Wrap-around: ALWAYS close.
    if (!isWrapAround && gap > Math.max(tol * 100, diag * 0.05)) continue;
    if (gap < 1e-12) continue; // already exact
    const shared = computeSharedPoint(curr, next, driftLimit);
    setEnd(curr, shared);
    setStart(next, shared);
  }

  // ── Phase 4b: Guarantee closure — force last.end === first.start ──
  // Skip for open contours — they have no closure by definition.
  if (!isOpen && merged.length >= 2) {
    const first = merged[0];
    const last = merged[merged.length - 1];
    const canClose = !(first.type === 'arc' && first.isFullCircle) &&
                     !(last.type === 'arc' && last.isFullCircle);
    if (canClose) {
      const closureGap = dist(getEnd(last), getStart(first));
      if (closureGap > 1e-12) {
        const shared = computeSharedPoint(last, first, driftLimit);
        setEnd(last, shared);
        setStart(first, shared);
      }
    }
  }

  // ── Phase 4c: Clamp all endpoints to contour bounding box + margin ──
  // Prevents lines/arcs from extending far beyond the actual model geometry
  // when geometric intersections (line-line on near-parallel edges etc.) push
  // endpoints out.
  const bboxMargin = diag * 0.10; // 10% of contour diagonal
  const clampX = (v: number) => Math.max(bbox.minX - bboxMargin, Math.min(bbox.maxX + bboxMargin, v));
  const clampY = (v: number) => Math.max(bbox.minY - bboxMargin, Math.min(bbox.maxY + bboxMargin, v));
  for (const ent of merged) {
    if (ent.type === 'arc' && ent.isFullCircle) continue;
    const s = getStart(ent);
    const e = getEnd(ent);
    setStart(ent, { x: clampX(s.x), y: clampY(s.y) });
    setEnd(ent,   { x: clampX(e.x), y: clampY(e.y) });
  }

  // ── Phase 4d: Proportional precision snap ──
  // Mechanical parts have "nice" numbers. A radius of 31.684 should be 31.7.
  // The snap grid is proportional to the largest dimension:
  //   maxDim ~ 100  → grid = 0.1
  //   maxDim ~ 10   → grid = 0.01
  //   maxDim ~ 1000 → grid = 1.0
  // This ensures numerical precision scales with part size.
  merged = snapEntities(merged, diag);

  // ── Phase 4e: Post-snap C0 repair ──
  // Snapping independently re-projects each arc's endpoints onto its own
  // snapped circle/radius, breaking shared C0 points. This pass forces
  // consecutive entities to share an exact midpoint of their post-snap gap.
  for (let i = 0; i < merged.length; i++) {
    const isWrap = (i === merged.length - 1);
    if (isOpen && isWrap) continue;
    const curr = merged[i];
    const next = merged[(i + 1) % merged.length];
    if (!curr || !next || curr === next) continue;
    if (curr.type === 'arc' && curr.isFullCircle) continue;
    if (next.type === 'arc' && next.isFullCircle) continue;
    const gap = dist(getEnd(curr), getStart(next));
    if (gap > 0 && gap < Math.max(tol * 100, diag * 0.02)) {
      const shared = lerp(getEnd(curr), getStart(next), 0.5);
      setEnd(curr, shared);
      setStart(next, shared);
    }
  }

  // ── Phase 5: Detect constraints ──
  const constraints = detectConstraints(merged, tol);

  return { entities: merged, constraints };
}

// ═══════════════════════════════════════════════════════════════
// Phase 4d: Proportional Precision Snap
// ═══════════════════════════════════════════════════════════════

/**
 * Compute a "smart" snap grid proportional to the reference dimension.
 * The grid is 10^(floor(log10(refDim)) - 3), so:
 *   refDim ~ 100  → grid = 0.1     (4.999 → 5.0)
 *   refDim ~ 10   → grid = 0.01    (1.998 → 2.0)
 *   refDim ~ 1000 → grid = 1.0     (999.3 → 999.0)
 *   refDim ~ 1    → grid = 0.001
 */
function snapGrid(refDim: number): number {
  if (refDim < 1e-9) return 0;
  const order = Math.pow(10, Math.floor(Math.log10(refDim)));
  return order / 1000;
}

/** Round a value to the nearest grid step. */
function snapValue(v: number, grid: number): number {
  if (grid < 1e-15) return v;
  return Math.round(v / grid) * grid;
}

/** Snap a point's coordinates to the grid. */
function snapPoint(p: Point2D, grid: number): Point2D {
  return { x: snapValue(p.x, grid), y: snapValue(p.y, grid) };
}

/**
 * Post-processing pass: round all numeric values (coordinates, radii,
 * angles) to a precision grid proportional to the contour diagonal.
 *
 * This makes 31.684171 → 31.7, 4.999873 → 5.0, etc.
 * Arcs whose center drifts are re-projected so start/end stay on circle.
 */
function snapEntities(entities: SketchEntity[], diag: number): SketchEntity[] {
  const grid = snapGrid(diag);
  if (grid < 1e-15) return entities;

  return entities.map(e => {
    if (e.type === 'line') {
      return makeLine(snapPoint(e.start, grid), snapPoint(e.end, grid));
    }
    if (e.type === 'arc') {
      const center = snapPoint(e.center, grid);
      const radius = snapValue(e.radius, grid);

      if (e.isFullCircle) {
        // For full circles, re-project the start point onto snapped circle
        const sp = projectOntoCircle(e.start, center, radius);
        const arc = makeArc(center, radius, 0, 2 * Math.PI, sp, sp);
        arc.isFullCircle = true;
        return arc;
      }

      // If sweep is essentially 360° but flag wasn't set, set it now
      const origSweepFull = Math.abs(e.endAngle - e.startAngle);
      if (origSweepFull > 2 * Math.PI * 0.986) { // >355° (matches Phase 0)
        const sp = projectOntoCircle(e.start, center, radius);
        const arc = makeArc(center, radius, 0, 2 * Math.PI, sp, sp);
        arc.isFullCircle = true;
        return arc;
      }

      // For arcs, re-project start/end onto snapped circle to maintain C0
      const startPt = projectOntoCircle(e.start, center, radius);
      const endPt = projectOntoCircle(e.end, center, radius);

      // Recompute angles from snapped center
      const sa = Math.atan2(startPt.y - center.y, startPt.x - center.x);
      const ea = Math.atan2(endPt.y - center.y, endPt.x - center.x);

      // Preserve original sweep direction
      const origSweep = sweepAngle(e);
      let newSweep = ea - sa;
      // Adjust to match sign of original sweep
      while (Math.sign(origSweep) > 0 && newSweep < 0) newSweep += 2 * Math.PI;
      while (Math.sign(origSweep) < 0 && newSweep > 0) newSweep -= 2 * Math.PI;
      // If sweep direction flipped (e.g. 359° → 1°), recalculate
      if (Math.abs(newSweep) < 0.01 && Math.abs(origSweep) > Math.PI) {
        newSweep = Math.sign(origSweep) * 2 * Math.PI;
      }

      return makeArc(center, radius, sa, sa + newSweep, startPt, endPt);
    }
    return e;
  });
}

// ═══════════════════════════════════════════════════════════════
// Arc Trajectory Verification
// ═══════════════════════════════════════════════════════════════

/**
 * Verify that the predicted arc actually traces through the real data.
 *
 * The circle fit only checks radial distance (points near the circle).
 * But an arc from startAngle through sweep can go "the wrong way around"
 * and miss the data entirely. This function samples N points along the
 * predicted arc and checks each one has a nearby data point — confirming
 * the arc path actually follows the data trajectory.
 */
function verifyArcTrajectory(
  center: Point2D,
  radius: number,
  startAngle: number,
  sweep: number,
  dataPts: Point2D[],
  tol: number,
): boolean {
  // Sample enough points along the arc (1 per ~15°, minimum 5)
  const nSamples = Math.max(5, Math.ceil(Math.abs(sweep) * 180 / Math.PI / 15));

  for (let i = 0; i <= nSamples; i++) {
    const t = i / nSamples;
    const angle = startAngle + sweep * t;
    const arcPt: Point2D = {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    };

    // Find nearest data point
    let minDist = Infinity;
    for (const dp of dataPts) {
      const d = dist(arcPt, dp);
      if (d < minDist) minDist = d;
      if (d < tol) break; // early exit — close enough
    }

    // If any predicted arc sample is far from ALL data → arc path is wrong
    if (minDist > tol * 3) return false;
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════
// Corner Detection
// ═══════════════════════════════════════════════════════════════

/**
 * Detect genuine corner indices in a polyline using windowed direction
 * analysis. The windowed approach smooths out tessellation zigzag noise
 * so only real geometric angle changes are detected.
 *
 * Returns sorted array of point indices where the contour has a sharp turn.
 */
function detectCorners(pts: Point2D[], tol: number): number[] {
  const n = pts.length;
  if (n < 10) return [];

  // Adaptive window: needs to be big enough to smooth out tessellation noise
  // ~5% of contour, clamped [4, 60]
  const w = Math.max(4, Math.min(60, Math.floor(n * 0.05)));

  // Compute windowed angle change at each interior point
  const angleChanges: number[] = new Array(n).fill(0);
  for (let i = w; i < n - w; i++) {
    const bx = pts[i].x - pts[i - w].x;
    const by = pts[i].y - pts[i - w].y;
    const fx = pts[i + w].x - pts[i].x;
    const fy = pts[i + w].y - pts[i].y;
    const bLen = Math.sqrt(bx * bx + by * by);
    const fLen = Math.sqrt(fx * fx + fy * fy);
    if (bLen < 1e-12 || fLen < 1e-12) continue;
    angleChanges[i] = Math.abs(angleBetween(
      Math.atan2(by, bx),
      Math.atan2(fy, fx),
    ));
  }

  // Threshold: 35° — only genuine corners, not fillet curves
  // A fillet with ~45° bend over many points will have each point's
  // windowed angle be much less than 35° because the bend is gradual.
  // A real corner (line→line) concentrates the angle change sharply.
  const thresh = 35 * Math.PI / 180;

  // Collect candidates above threshold
  const candidates: { idx: number; angle: number }[] = [];
  for (let i = w; i < n - w; i++) {
    if (angleChanges[i] > thresh) {
      candidates.push({ idx: i, angle: angleChanges[i] });
    }
  }

  // Non-maximum suppression: keep sharpest within (3×window) radius
  candidates.sort((a, b) => b.angle - a.angle);
  const suppressionRadius = w * 3;
  const corners: number[] = [];
  for (const c of candidates) {
    let tooClose = false;
    for (const existing of corners) {
      if (Math.abs(c.idx - existing) < suppressionRadius) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) corners.push(c.idx);
  }

  corners.sort((a, b) => a - b);
  return corners;
}

// ═══════════════════════════════════════════════════════════════
// Segment-Wise Fitting (between corners)
// ═══════════════════════════════════════════════════════════════

/**
 * Fit a segment of points (between two corners) as a SINGLE entity
 * when possible.  Tries line first, then arc.  Only falls back to
 * recursiveFit if neither single-entity shape covers the data.
 */
function fitSegment(
  pts: Point2D[],
  start: number,
  end: number,
  tol: number,
  diag: number,
): SketchEntity[] {
  const count = end - start + 1;
  if (count <= 1) return [];
  if (count === 2) {
    if (dist(pts[start], pts[end]) < tol * 0.01) return [];
    return [makeLine(pts[start], pts[end])];
  }

  // Estimate tessellation step size from median consecutive distance.
  // This adaptive noise floor ensures staircase quantization doesn't
  // prevent arc detection.
  const edgeLengths: number[] = [];
  for (let i = start; i < end; i++) {
    edgeLengths.push(dist(pts[i], pts[i + 1]));
  }
  edgeLengths.sort((a, b) => a - b);
  const medianEdge = edgeLengths[Math.floor(edgeLengths.length / 2)] || tol;
  // Arc tolerance: max of 2×tol and 2×median edge (covers tessellation noise)
  const arcTol = Math.max(tol * 2, medianEdge * 1.5);

  // ── 1) Try single line ──
  let maxDev = 0;
  for (let i = start + 1; i < end; i++) {
    maxDev = Math.max(maxDev, pointToSegmentDist(pts[i], pts[start], pts[end]));
  }
  if (maxDev < tol) {
    if (dist(pts[start], pts[end]) < tol * 0.01) return [];
    return [makeLine(pts[start], pts[end])];
  }

  // ── 2) Try single arc ──
  const sub: Point2D[] = [];
  for (let i = start; i <= end; i++) sub.push(pts[i]);
  const kasaFit = fitCircle(sub);
  if (kasaFit) {
    const circFit = refineCircleGeometric(sub, kasaFit);
    // Corners already isolated transitions, so this segment SHOULD be
    // a single arc if it's curved at all. Use the adaptive arcTol.
    // EXCEPTION: for near-complete arcs (>340°), tighten tolerance to prevent
    // oval/egg shapes from becoming false circles. Use base tol instead of arcTol.
    if (circFit.maxError < arcTol && circFit.radius < diag * 5) {
      const sa = Math.atan2(pts[start].y - circFit.center.y, pts[start].x - circFit.center.x);
      let sweepAcc = 0, prevA = sa;
      for (let i = start + 1; i <= end; i++) {
        const a = Math.atan2(pts[i].y - circFit.center.y, pts[i].x - circFit.center.x);
        let da = a - prevA;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        sweepAcc += da;
        prevA = a;
      }
      if (sweepAcc > 2 * Math.PI) sweepAcc = 2 * Math.PI;
      if (sweepAcc < -2 * Math.PI) sweepAcc = -2 * Math.PI;

      const sweepDeg = Math.abs(sweepAcc) * 180 / Math.PI;
      const sagitta = circFit.radius * (1 - Math.cos(Math.abs(sweepAcc) / 2));

      // For near-full-circle arcs (>340° sweep), apply the base tol:
      // if Phase 0 already rejected this as not-a-full-circle, we should
      // not allow a relaxed arcTol to make it one via a different code path.
      const effectiveTol = sweepDeg > 340 ? tol : arcTol;

      // Accept arc if: sweep > 3°, sagitta > tol (genuinely curved),
      // radius-to-chord is sane (not a "line on giant circle"),
      // sagitta must be significantly larger than line deviation
      // (prevents straight-line segments with tiny noise from becoming arcs),
      // and trajectory verified against real data
      const chordLen = dist(pts[start], pts[end]);
      const radiusSane = chordLen < tol || circFit.radius < chordLen * 5 || sweepDeg > 45;
      // Arc must explain significantly more curvature than a line would miss.
      // If line deviation is close to tolerance, the "arc" is really just a noisy line.
      const arcWorthIt = sagitta > maxDev * 0.8;
      if (sweepDeg > 3 && sagitta > tol && radiusSane && arcWorthIt &&
          circFit.maxError < effectiveTol &&
          verifyArcTrajectory(circFit.center, circFit.radius, sa, sweepAcc, sub, effectiveTol)) {
        const startPt = projectOntoCircle(pts[start], circFit.center, circFit.radius);
        const endPt = projectOntoCircle(pts[end], circFit.center, circFit.radius);
        return [makeArc(circFit.center, circFit.radius, sa, sa + sweepAcc, startPt, endPt)];
      }
    }
  }

  // ── 3) Neither fits as single entity — fall back to recursive subdivision ──
  // Use recursiveFit with the adaptive arcTol to handle staircase data.
  // The recursion depth is naturally bounded by segment size.
  return recursiveFit(pts, start, end, arcTol, 0, diag);
}

/**
 * Recursive fit on open polyline pts[start..end].
 * @param diag contour bounding-box diagonal — used to cap degenerate arc radii
 */
function recursiveFit(pts: Point2D[], start: number, end: number, tol: number, depth: number, diag = Infinity): SketchEntity[] {
  const count = end - start + 1;
  if (count <= 1) return [];
  if (count === 2) {
    if (dist(pts[start], pts[end]) < tol * 0.01) return [];
    return [makeLine(pts[start], pts[end])];
  }

  // ── 1) Compute line deviation FIRST — prefer lines over arcs ──
  let maxDev = 0, maxDevIdx = start;
  for (let i = start + 1; i < end; i++) {
    const d = pointToSegmentDist(pts[i], pts[start], pts[end]);
    if (d > maxDev) { maxDev = d; maxDevIdx = i; }
  }

  // If all points are within tolerance of the line → it IS a line, done.
  if (maxDev < tol) {
    if (dist(pts[start], pts[end]) < tol * 0.01) return [];
    return [makeLine(pts[start], pts[end])];
  }

  // ── 2) Try arc/circle fit (only when line doesn't fit) ──
  const sub: Point2D[] = [];
  for (let i = start; i <= end; i++) sub.push(pts[i]);
  const kasaFit = fitCircle(sub);

  if (kasaFit) {
    const circFit = refineCircleGeometric(sub, kasaFit);
    if (circFit.maxError < tol) {
      const chordLen = dist(pts[start], pts[end]);
      const radiusToChord = circFit.radius / Math.max(chordLen, 1e-12);

      // Adaptive tolerance ONLY for closed-loop circle detection
      const arcChordErr = circFit.radius * (1 - Math.cos(Math.PI / Math.max(6, count)));
      const closeLoopTol = Math.min(Math.max(tol, arcChordErr * 2.5), diag * 0.02);
      const isCloseLoop = chordLen < closeLoopTol * 2;

      if (isCloseLoop && count >= 6) {
        const sa0 = Math.atan2(pts[start].y - circFit.center.y, pts[start].x - circFit.center.x);
        let sweepLoop = 0, prevALoop = sa0;
        for (let i = start + 1; i <= end; i++) {
          const a = Math.atan2(pts[i].y - circFit.center.y, pts[i].x - circFit.center.x);
          let da = a - prevALoop;
          while (da > Math.PI) da -= 2 * Math.PI;
          while (da < -Math.PI) da += 2 * Math.PI;
          sweepLoop += da;
          prevALoop = a;
        }
        if (Math.abs(sweepLoop) > 2 * Math.PI) sweepLoop = Math.sign(sweepLoop) * 2 * Math.PI;

        // For near-complete arcs (>340° sweep), tighten tolerance:
        // if Phase 0 already rejected this, don't accept it via a more
        // generous tolerance. This prevents egg/oval shapes from becoming circles.
        const loopSweepDeg = Math.abs(sweepLoop) * 180 / Math.PI;
        const baseTol = Math.max(0.001, diag * 0.002);
        if (loopSweepDeg > 340 && circFit.maxError > baseTol) {
          // Fall through — don't accept as closed-loop arc
        } else if (verifyArcTrajectory(circFit.center, circFit.radius, sa0, sweepLoop, sub, tol)) {
          // ── Trajectory verify even for closed loops ──
          const startPtL = projectOntoCircle(pts[start], circFit.center, circFit.radius);
          const endPtL = projectOntoCircle(pts[end], circFit.center, circFit.radius);
          return [makeArc(circFit.center, circFit.radius, sa0, sa0 + sweepLoop, startPtL, endPtL)];
        }
      }

      const sa = Math.atan2(pts[start].y - circFit.center.y, pts[start].x - circFit.center.x);

      // Monotone angular walk
      let sweepAccum = 0, prevAngle = sa;
      for (let i = start + 1; i <= end; i++) {
        const a = Math.atan2(pts[i].y - circFit.center.y, pts[i].x - circFit.center.x);
        let da = a - prevAngle;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        sweepAccum += da;
        prevAngle = a;
      }
      if (sweepAccum > 2 * Math.PI) sweepAccum = 2 * Math.PI;
      if (sweepAccum < -2 * Math.PI) sweepAccum = -2 * Math.PI;

      const sweep = sweepAccum;
      const sweepDeg = Math.abs(sweep) * 180 / Math.PI;

      // Accept arc only if:
      //  - sweep > 5°  (not a degenerate sliver)
      //  - sagitta > tol  (genuinely curved — a line can't cover it)
      //  - radius < 5× diagonal (sanity cap)
      //  - for near-full-circle sweeps (>340°), apply base tolerance to prevent
      //    egg/oval shapes from becoming circles via generous arcTol
      //  - TRAJECTORY VERIFIED: sampled arc points match real data points
      const sagitta = circFit.radius * (1 - Math.cos(Math.abs(sweep) / 2));
      const baseTolArc = Math.max(0.001, diag * 0.002);
      const nearFullCircle = sweepDeg > 340 && circFit.maxError > baseTolArc;
      if (sweepDeg > 5 && sagitta > tol && circFit.radius < diag * 5 && !nearFullCircle) {
        if (verifyArcTrajectory(circFit.center, circFit.radius, sa, sweep, sub, tol)) {
          const startPt = projectOntoCircle(pts[start], circFit.center, circFit.radius);
          const endPt = projectOntoCircle(pts[end], circFit.center, circFit.radius);
          return [makeArc(circFit.center, circFit.radius, sa, sa + sweep, startPt, endPt)];
        }
      }
    }
  }

  // ── 3) Neither line nor arc fits — split at max deviation and recurse ──
  if (depth > 50) return [makeLine(pts[start], pts[end])];

  const left = recursiveFit(pts, start, maxDevIdx, tol, depth + 1, diag);
  const right = recursiveFit(pts, maxDevIdx, end, tol, depth + 1, diag);
  return [...left, ...right];
}

// ═══════════════════════════════════════════════════════════════
// Post-Merge
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Phase 3c: Lines → Arc Promotion
// ═══════════════════════════════════════════════════════════════

/**
 * Sweep over entities, find runs of 3+ consecutive lines, and try to
 * replace each run with a single arc.  Uses endpoints of the lines
 * as sample points for circle fitting.
 */
function promoteLinesToArcs(entities: SketchEntity[], tol: number, diag: number): SketchEntity[] {
  if (entities.length < 3) return entities;

  const result: SketchEntity[] = [];
  let i = 0;

  while (i < entities.length) {
    // Try to start a run of consecutive lines
    if (entities[i].type !== 'line') {
      result.push(entities[i]);
      i++;
      continue;
    }

    // Find the end of this line run
    let runEnd = i;
    while (runEnd + 1 < entities.length && entities[runEnd + 1].type === 'line') {
      runEnd++;
    }

    const runLen = runEnd - i + 1;
    if (runLen < 3) {
      // Too few lines to form an arc — keep as-is
      for (let j = i; j <= runEnd; j++) result.push(entities[j]);
      i = runEnd + 1;
      continue;
    }

    // Collect all endpoints of this line run as sample points
    const samplePts: Point2D[] = [entities[i].start];
    for (let j = i; j <= runEnd; j++) samplePts.push(entities[j].end);

    // ── Guard: if a straight line already fits the entire run, SKIP promotion ──
    // This prevents converting nearly-straight edges into huge-radius arcs.
    const runStart = samplePts[0];
    const runEndPt = samplePts[samplePts.length - 1];
    let maxLineDev = 0;
    for (let k = 1; k < samplePts.length - 1; k++) {
      maxLineDev = Math.max(maxLineDev, pointToSegmentDist(samplePts[k], runStart, runEndPt));
    }
    if (maxLineDev < tol * 1.5) {
      // A straight line covers the run — don't promote to arc
      for (let j = i; j <= runEnd; j++) result.push(entities[j]);
      i = runEnd + 1;
      continue;
    }

    // Try circle fit on these points
    const arcTol = tol * 2; // slightly relaxed for promotion
    const fit = fitCircle(samplePts);
    if (fit && fit.radius < diag * 2) {
      const refined = refineCircleGeometric(samplePts, fit);
      if (refined.maxError < arcTol && refined.radius < diag * 2) {
        // Verify trajectory
        const sa = Math.atan2(samplePts[0].y - refined.center.y, samplePts[0].x - refined.center.x);
        let sweepAcc = 0, prevA = sa;
        for (let k = 1; k < samplePts.length; k++) {
          const a = Math.atan2(samplePts[k].y - refined.center.y, samplePts[k].x - refined.center.x);
          let da = a - prevA;
          while (da > Math.PI) da -= 2 * Math.PI;
          while (da < -Math.PI) da += 2 * Math.PI;
          sweepAcc += da;
          prevA = a;
        }
        if (sweepAcc > 2 * Math.PI) sweepAcc = 2 * Math.PI;
        if (sweepAcc < -2 * Math.PI) sweepAcc = -2 * Math.PI;

        const sweepDeg = Math.abs(sweepAcc) * 180 / Math.PI;
        const sagittaP = refined.radius * (1 - Math.cos(Math.abs(sweepAcc) / 2));

        if (sweepDeg > 10 && sagittaP > tol && refined.radius < diag * 5 &&
            verifyArcTrajectory(refined.center, refined.radius, sa, sweepAcc, samplePts, arcTol)) {
          // Success! Replace entire run with one arc
          const startPt = projectOntoCircle(samplePts[0], refined.center, refined.radius);
          const endPt = projectOntoCircle(samplePts[samplePts.length - 1], refined.center, refined.radius);
          result.push(makeArc(refined.center, refined.radius, sa, sa + sweepAcc, startPt, endPt));
          i = runEnd + 1;
          continue;
        }
      }
    }

    // Arc fit failed — try smaller sub-runs within this line run
    // Use a greedy approach: try the longest arc from position i, shrink if needed
    let consumed = false;
    for (let tryEnd = runEnd; tryEnd >= i + 2; tryEnd--) {
      const subPts: Point2D[] = [entities[i].start];
      for (let j = i; j <= tryEnd; j++) subPts.push(entities[j].end);

      const subFit = fitCircle(subPts);
      if (!subFit || subFit.radius > diag * 2) continue;
      const subRefined = refineCircleGeometric(subPts, subFit);
      if (subRefined.maxError > arcTol) continue;

      const sa2 = Math.atan2(subPts[0].y - subRefined.center.y, subPts[0].x - subRefined.center.x);
      let sweep2 = 0, prev2 = sa2;
      for (let k = 1; k < subPts.length; k++) {
        const a = Math.atan2(subPts[k].y - subRefined.center.y, subPts[k].x - subRefined.center.x);
        let da = a - prev2;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        sweep2 += da;
        prev2 = a;
      }
      if (sweep2 > 2 * Math.PI) sweep2 = 2 * Math.PI;
      if (sweep2 < -2 * Math.PI) sweep2 = -2 * Math.PI;

      const sDeg = Math.abs(sweep2) * 180 / Math.PI;
      const sagittaSub = subRefined.radius * (1 - Math.cos(Math.abs(sweep2) / 2));

      // Sub-run also requires line-doesn't-fit guard
      let subMaxLineDev = 0;
      for (let k = 1; k < subPts.length - 1; k++) {
        subMaxLineDev = Math.max(subMaxLineDev, pointToSegmentDist(subPts[k], subPts[0], subPts[subPts.length - 1]));
      }
      if (subMaxLineDev < tol * 1.5) continue; // line fits — skip arc

      if (sDeg > 10 && sagittaSub > tol && subRefined.radius < diag * 5 &&
          verifyArcTrajectory(subRefined.center, subRefined.radius, sa2, sweep2, subPts, arcTol)) {
        const sp = projectOntoCircle(subPts[0], subRefined.center, subRefined.radius);
        const ep = projectOntoCircle(subPts[subPts.length - 1], subRefined.center, subRefined.radius);
        result.push(makeArc(subRefined.center, subRefined.radius, sa2, sa2 + sweep2, sp, ep));
        i = tryEnd + 1;
        consumed = true;
        break;
      }
    }

    if (!consumed) {
      // Could not form any arc — keep original lines
      result.push(entities[i]);
      i++;
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// Phase 3d: Demote Small Arcs → Lines
// ═══════════════════════════════════════════════════════════════

/**
 * Arcs with very small sweep angle that can be well-approximated by a
 * straight line are really just corners. Replace them with lines.
 */
function demoteSmallArcs(entities: SketchEntity[], tol: number): SketchEntity[] {
  return entities.map(e => {
    if (e.type !== 'arc' || e.isFullCircle) return e;
    const sw = Math.abs(sweepAngle(e));
    const swDeg = sw * 180 / Math.PI;
    const chordLen = dist(e.start, e.end);
    const sagitta = e.radius * (1 - Math.cos(sw / 2));

    // Rule 1: Small sweep (< 20°) with negligible sagitta → line
    if (swDeg < 20 && (sagitta < tol * 2 || chordLen < tol)) {
      return makeLine(e.start, e.end);
    }

    // Rule 2: Huge radius / tiny chord — "almost straight line on giant circle"
    // e.g. radius=380 chord=45 sweep=7° — this is a line with fitting noise.
    // If radius > 5× chord and sweep < 45°, it's a line.
    if (chordLen > tol * 0.1 && e.radius > chordLen * 5 && swDeg < 45) {
      return makeLine(e.start, e.end);
    }

    return e;
  });
}

// ═══════════════════════════════════════════════════════════════
// Phase 3e: Promote Consecutive Arcs → Circles
// ═══════════════════════════════════════════════════════════════

/**
 * Chains of 2+ consecutive arcs with similar center and radius whose
 * combined sweep exceeds 340° are circular holes — promote to full circle.
 * Also promotes a SINGLE arc with sweep > 340°.
 */
function promoteArcsToCircles(entities: SketchEntity[], tol: number): SketchEntity[] {
  const result: SketchEntity[] = [];
  let i = 0;

  while (i < entities.length) {
    const e = entities[i];
    if (e.type !== 'arc' || e.isFullCircle) {
      result.push(e);
      i++;
      continue;
    }

    // Single arc > 355° → circle (matches Phase 0 angular span threshold)
    if (Math.abs(sweepAngle(e)) * 180 / Math.PI > 355) {
      const circle = makeArc(e.center, e.radius, 0, 2 * Math.PI, e.start, e.start);
      circle.isFullCircle = true;
      result.push(circle);
      i++;
      continue;
    }

    // Try to collect a chain of arcs with similar center/radius
    let chainEnd = i;
    let totalSweep = Math.abs(sweepAngle(e));
    let sumCx = e.center.x, sumCy = e.center.y, sumR = e.radius;
    let count = 1;

    for (let j = i + 1; j < entities.length; j++) {
      const next = entities[j];
      if (next.type !== 'arc' || next.isFullCircle) break;
      const avgCx = sumCx / count, avgCy = sumCy / count, avgR = sumR / count;
      const cd = dist(next.center, { x: avgCx, y: avgCy });
      const rd = Math.abs(next.radius - avgR);
      // Centers and radii must be close (proportional to average radius)
      // Tightened to 5% to prevent false circle promotions on curved surfaces.
      const maxCD = Math.max(tol * 3, avgR * 0.05);
      const maxRD = Math.max(tol * 3, avgR * 0.05);
      if (cd > maxCD || rd > maxRD) break;
      chainEnd = j;
      totalSweep += Math.abs(sweepAngle(next));
      sumCx += next.center.x; sumCy += next.center.y; sumR += next.radius;
      count++;
    }

    // Check if the chain (including wrap-around through other entities)
    // spans enough of a circle
    const totalDeg = totalSweep * 180 / Math.PI;
    if (totalDeg > 350 && count >= 2) {
      // Fit a circle through all the start/end points
      const chainPts: Point2D[] = [];
      for (let j = i; j <= chainEnd; j++) {
        chainPts.push(entities[j].start);
        chainPts.push(entities[j].end);
      }
      const fit = fitCircle(chainPts);
      if (fit) {
        const refined = refineCircleGeometric(chainPts, fit);
        const avgCenter = refined.center;
        const avgRadius = refined.radius;
        const sp = projectOntoCircle(chainPts[0], avgCenter, avgRadius);
        const circle = makeArc(avgCenter, avgRadius, 0, 2 * Math.PI, sp, sp);
        circle.isFullCircle = true;
        result.push(circle);
        i = chainEnd + 1;
        continue;
      }
    }

    // Not enough sweep — keep originals
    result.push(entities[i]);
    i++;
  }

  return result;
}

function mergeEntities(entities: SketchEntity[], tol: number): SketchEntity[] {
  if (entities.length < 2) return [...entities];

  let changed = true;
  let result = [...entities];

  while (changed) {
    changed = false;
    const next: SketchEntity[] = [result[0]];

    for (let i = 1; i < result.length; i++) {
      const prev = next[next.length - 1];
      const curr = result[i];

      // Merge collinear lines
      if (prev.type === 'line' && curr.type === 'line') {
        const mergedLine = makeLine(prev.start, curr.end);
        const midDev = lineDistToPoint(prev.start, curr.end, prev.end);
        if (midDev < tol * 0.8 && lineLength(prev.start, curr.end) > 0.001) {
          next[next.length - 1] = mergedLine;
          changed = true;
          continue;
        }
      }

      // Merge same-center arcs
      if (prev.type === 'arc' && curr.type === 'arc') {
        const centerDist = dist(prev.center, curr.center);
        const radiusDiff = Math.abs(prev.radius - curr.radius);
        if (centerDist < tol * 0.3 && radiusDiff < tol * 0.3) {
          const avgCenter = lerp(prev.center, curr.center, 0.5);
          const avgRadius = (prev.radius + curr.radius) / 2;
          const combinedSweep = sweepAngle(prev) + sweepAngle(curr);
          const newArc = makeArc(
            avgCenter, avgRadius,
            prev.startAngle, prev.startAngle + combinedSweep,
            prev.start, curr.end,
          );
          next[next.length - 1] = newArc;
          changed = true;
          continue;
        }
      }

      next.push(curr);
    }
    result = next;
  }

  return result;
}

function getStart(e: SketchEntity): Point2D { return e.start; }
function getEnd(e: SketchEntity): Point2D { return e.end; }

function setStart(e: SketchEntity, pt: Point2D) {
  e.start = { ...pt };
  if (e.type === 'arc' && !e.isFullCircle) {
    const raw = Math.atan2(pt.y - e.center.y, pt.x - e.center.x);
    // Pick the angle representation closest to the old startAngle
    // to preserve sweep direction across the ±π boundary
    let best = raw, bestDiff = Math.abs(raw - e.startAngle);
    for (const c of [raw + 2 * Math.PI, raw - 2 * Math.PI]) {
      if (Math.abs(c - e.startAngle) < bestDiff) { best = c; bestDiff = Math.abs(c - e.startAngle); }
    }
    e.startAngle = best;
  }
}

function setEnd(e: SketchEntity, pt: Point2D) {
  e.end = { ...pt };
  if (e.type === 'arc' && !e.isFullCircle) {
    const raw = Math.atan2(pt.y - e.center.y, pt.x - e.center.x);
    // Pick the angle representation closest to the old endAngle
    // to preserve sweep direction across the ±π boundary
    let best = raw, bestDiff = Math.abs(raw - e.endAngle);
    for (const c of [raw + 2 * Math.PI, raw - 2 * Math.PI]) {
      if (Math.abs(c - e.endAngle) < bestDiff) { best = c; bestDiff = Math.abs(c - e.endAngle); }
    }
    e.endAngle = best;
  }
}

// ═══════════════════════════════════════════════════════════════
// Constraint Detection
// ═══════════════════════════════════════════════════════════════

function detectConstraints(entities: SketchEntity[], tol: number): SketchConstraint[] {
  const constraints: SketchConstraint[] = [];
  const angleTol = 2 * Math.PI / 180;

  for (let i = 0; i < entities.length; i++) {
    const curr = entities[i];
    const next = entities[(i + 1) % entities.length];

    // Tangent line→arc
    if (curr.type === 'line' && next.type === 'arc') {
      const la = lineAngle(curr.start, curr.end);
      const ta = Math.atan2(curr.end.y - next.center.y, curr.end.x - next.center.x) + Math.PI / 2;
      if (Math.abs(angleBetween(la, ta)) < angleTol || Math.abs(angleBetween(la, ta + Math.PI)) < angleTol)
        constraints.push({ type: 'tangent', entities: [i, (i + 1) % entities.length] });
    }

    // Tangent arc→line
    if (curr.type === 'arc' && next.type === 'line') {
      const ta = Math.atan2(curr.end.y - curr.center.y, curr.end.x - curr.center.x) + Math.PI / 2;
      const la = lineAngle(next.start, next.end);
      if (Math.abs(angleBetween(la, ta)) < angleTol || Math.abs(angleBetween(la, ta + Math.PI)) < angleTol)
        constraints.push({ type: 'tangent', entities: [i, (i + 1) % entities.length] });
    }

    // Tangent arc→arc
    if (curr.type === 'arc' && next.type === 'arc') {
      const t1 = Math.atan2(curr.end.y - curr.center.y, curr.end.x - curr.center.x) + Math.PI / 2;
      const t2 = Math.atan2(next.start.y - next.center.y, next.start.x - next.center.x) + Math.PI / 2;
      if (Math.abs(angleBetween(t1, t2)) < angleTol || Math.abs(angleBetween(t1, t2 + Math.PI)) < angleTol)
        constraints.push({ type: 'tangent', entities: [i, (i + 1) % entities.length] });
      if (dist(curr.center, next.center) < tol)
        constraints.push({ type: 'concentric', entities: [i, (i + 1) % entities.length] });
    }

    // H/V lines
    if (curr.type === 'line') {
      const a = lineAngle(curr.start, curr.end);
      if (Math.abs(Math.sin(a)) < Math.sin(angleTol))
        constraints.push({ type: 'horizontal', entities: [i] });
      if (Math.abs(Math.cos(a)) < Math.sin(angleTol))
        constraints.push({ type: 'vertical', entities: [i] });
    }

    // Equal radius arcs
    if (curr.type === 'arc') {
      for (let j = i + 1; j < entities.length; j++) {
        const ej = entities[j];
        if (ej.type === 'arc') {
          if (Math.abs(curr.radius - ej.radius) / Math.max(curr.radius, ej.radius) < 0.02)
            constraints.push({ type: 'equal_radius', entities: [i, j] });
        }
      }
    }

    // Perpendicular lines
    if (curr.type === 'line' && next.type === 'line') {
      const diff = Math.abs(angleBetween(lineAngle(curr.start, curr.end), lineAngle(next.start, next.end)));
      if (Math.abs(diff - Math.PI / 2) < angleTol)
        constraints.push({ type: 'perpendicular', entities: [i, (i + 1) % entities.length] });
    }

    // Collinear lines
    if (curr.type === 'line' && next.type === 'line') {
      const diff = Math.abs(angleBetween(lineAngle(curr.start, curr.end), lineAngle(next.start, next.end)));
      if (diff < angleTol || Math.abs(diff - Math.PI) < angleTol)
        constraints.push({ type: 'collinear', entities: [i, (i + 1) % entities.length] });
    }
  }

  return constraints;
}

// ═══════════════════════════════════════════════════════════════
// Reconstruction Error (analytical point-to-entity distance)
// ═══════════════════════════════════════════════════════════════

/** Analytical distance from point to an arc (projects onto arc span or closest endpoint) */
function pointToArcDist(p: Point2D, arc: SketchArc): number {
  const dx = p.x - arc.center.x, dy = p.y - arc.center.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const circleDist = Math.abs(d - arc.radius);
  if (arc.isFullCircle) return circleDist;

  // Check if point's angle falls within the arc angular span
  const angle = Math.atan2(dy, dx);
  const sa = arc.startAngle;
  const sw = sweepAngle(arc);

  let relAngle = angle - sa;
  if (sw >= 0) {
    while (relAngle < 0) relAngle += 2 * Math.PI;
    while (relAngle > 2 * Math.PI) relAngle -= 2 * Math.PI;
    if (relAngle <= sw + 1e-9) return circleDist;
  } else {
    while (relAngle > 0) relAngle -= 2 * Math.PI;
    while (relAngle < -2 * Math.PI) relAngle += 2 * Math.PI;
    if (relAngle >= sw - 1e-9) return circleDist;
  }
  // Outside arc span — distance to nearest endpoint
  return Math.min(dist(p, arc.start), dist(p, arc.end));
}

/** Analytical distance from a point to any sketch entity */
export function pointToEntityDist(p: Point2D, entity: SketchEntity): number {
  if (entity.type === 'line') return pointToSegmentDist(p, entity.start, entity.end);
  return pointToArcDist(p, entity);
}

export function reconstructionError(
  originalPts: Point2D[],
  entities: SketchEntity[],
  tol?: number,
): { maxError: number; avgError: number; coverage: number } {
  if (entities.length === 0) return { maxError: Infinity, avgError: Infinity, coverage: 0 };

  let sumErr = 0, maxErr = 0, covered = 0;
  const coverageThreshold = tol ?? 1;

  for (const orig of originalPts) {
    let minDist = Infinity;
    for (const e of entities) {
      const d = pointToEntityDist(orig, e);
      if (d < minDist) minDist = d;
    }
    sumErr += minDist;
    maxErr = Math.max(maxErr, minDist);
    if (minDist < coverageThreshold) covered++;
  }

  return {
    maxError: maxErr,
    avgError: sumErr / originalPts.length,
    coverage: covered / originalPts.length,
  };
}

// ═══════════════════════════════════════════════════════════════
// Batch: fit all contours from a set of slices
// ═══════════════════════════════════════════════════════════════

/**
 * Fit sketch entities for an array of contours.
 * Uses `requestAnimationFrame` yielding to keep the UI responsive.
 */
export function fitContoursSync(contours: Contour[], tolerance?: number): FittedContour[] {
  const results: FittedContour[] = [];

  for (const contour of contours) {
    if (contour.points.length < 6) continue;
    const { entities, constraints } = fitContour(contour.points, tolerance);
    const error = reconstructionError(contour.points, entities, tolerance);
    results.push({
      entities,
      constraints,
      originalPoints: contour.points,
      error,
    });
  }

  return results;
}

/**
 * Async version that yields every N contours to keep UI responsive.
 */
export async function fitContoursAsync(
  contours: Contour[],
  tolerance?: number,
  onProgress?: (done: number, total: number) => void,
): Promise<FittedContour[]> {
  const results: FittedContour[] = [];
  const BATCH_SIZE = 5; // fit 5 contours, then yield

  for (let i = 0; i < contours.length; i++) {
    const contour = contours[i];
    if (contour.points.length < 6) continue;

    const { entities, constraints } = fitContour(contour.points, tolerance);
    const error = reconstructionError(contour.points, entities, tolerance);
    results.push({ entities, constraints, originalPoints: contour.points, error });

    // Yield to event loop every BATCH_SIZE
    if ((i + 1) % BATCH_SIZE === 0) {
      onProgress?.(i + 1, contours.length);
      await new Promise(r => setTimeout(r, 0));
    }
  }

  onProgress?.(contours.length, contours.length);
  return results;
}
