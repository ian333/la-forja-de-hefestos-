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
  const sweep = ea - sa;
  return {
    type: 'arc',
    center, radius,
    startAngle: sa, endAngle: ea,
    start: startPt, end: endPt,
    isFullCircle: Math.abs(sweep) > Math.PI * 1.95,
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
  if (cleaned.length > 2 && dist(cleaned[0], cleaned[cleaned.length - 1]) < 1e-6) {
    cleaned.pop();
  }
  if (cleaned.length < 3) return { entities: [], constraints: [] };

  const n = cleaned.length;
  const bbox = bboxOf(cleaned);
  const diag = Math.sqrt((bbox.maxX - bbox.minX) ** 2 + (bbox.maxY - bbox.minY) ** 2);
  const tol = tolerance ?? Math.max(0.001, diag * 0.0001);

  // ── Phase 0: Full circle test (Kasa + Gauss-Newton geometric refinement) ──
  // Adaptive tolerance: tessellated circles have chord error ≈ R·(1 − cos(π/N))
  // where N = number of polygon vertices. Capped at 2% of contour diagonal.
  const kasaFit0 = fitCircle(cleaned);
  if (kasaFit0 && kasaFit0.radius < diag * 2) {
    const circleFit = refineCircleGeometric(cleaned, kasaFit0);
    const chordErr = circleFit.radius * (1 - Math.cos(Math.PI / Math.max(6, n)));
    const circleTol = Math.min(Math.max(tol, chordErr * 2.5), diag * 0.02);
    const relErr = circleFit.maxError / Math.max(circleFit.radius, 1e-12);
    if (circleFit.maxError < circleTol || (relErr < 0.03 && circleFit.maxError < diag * 0.01)) {
      const arc = makeArc(circleFit.center, circleFit.radius, 0, 2 * Math.PI, cleaned[0], cleaned[0]);
      return { entities: [arc], constraints: [] };
    }
  }

  // ── Phase 1: Find best "open" point ──
  const kappa = new Float64Array(n);
  for (let i = 0; i < n; i++) kappa[i] = localCurvature(cleaned, i);

  let maxJump = -1, openIdx = 0;
  for (let i = 0; i < n; i++) {
    const jump = Math.abs(kappa[i] - kappa[(i + 1) % n]);
    if (jump > maxJump) { maxJump = jump; openIdx = (i + 1) % n; }
  }

  const openPts: Point2D[] = [];
  for (let i = 0; i < n; i++) openPts.push(cleaned[(openIdx + i) % n]);

  // ── Phase 2: Recursive subdivision ──
  const entities = recursiveFit(openPts, 0, openPts.length - 1, tol, 0, diag);

  // ── Phase 3: Post-merge + arc→circle upgrade ──
  let merged = mergeEntities(entities, tol);

  // Upgrade arcs with sweep ≥ 350° → full circle
  for (const e of merged) {
    if (e.type === 'arc' && !e.isFullCircle && Math.abs(sweepAngle(e)) > Math.PI * 1.94) {
      e.isFullCircle = true;
      e.endAngle = e.startAngle + 2 * Math.PI;
      e.end = { ...e.start };
    }
  }

  // Wrap-around merge: first+last arcs with same center → circle
  if (merged.length >= 2) {
    const first = merged[0], last = merged[merged.length - 1];
    if (first.type === 'arc' && last.type === 'arc') {
      const cd = dist(first.center, last.center);
      const rd = Math.abs(first.radius - last.radius);
      if (cd < tol * 2 && rd < tol * 2) {
        const ac = lerp(first.center, last.center, 0.5);
        const ar = (first.radius + last.radius) / 2;
        const cs = sweepAngle(last) + sweepAngle(first);
        if (Math.abs(cs) > Math.PI * 1.94) {
          // Full circle
          const circle = makeArc(ac, ar, 0, 2 * Math.PI, last.start, last.start);
          merged = [circle, ...merged.slice(1, -1)];
        } else if (Math.abs(cs) > 0.1) {
          const combinedArc = makeArc(ac, ar, last.startAngle, last.startAngle + cs, last.start, first.end);
          merged = [combinedArc, ...merged.slice(1, -1)];
        }
      }
    }
  }

  // ── Phase 4: Snap endpoints — project onto circles for sub-tol precision ──
  for (let i = 0; i < merged.length; i++) {
    const curr = merged[i];
    const next = merged[(i + 1) % merged.length];
    if (!curr || !next) continue;
    const gap = dist(getEnd(curr), getStart(next));
    if (gap > tol * 20) continue; // skip topology gaps
    let mid = lerp(getEnd(curr), getStart(next), 0.5);
    // Project shared point onto arc circumference when applicable
    if (curr.type === 'arc' && !curr.isFullCircle) {
      mid = projectOntoCircle(mid, curr.center, curr.radius);
    } else if (next.type === 'arc' && !next.isFullCircle) {
      mid = projectOntoCircle(mid, next.center, next.radius);
    }
    setEnd(curr, mid);
    setStart(next, mid);
  }

  // ── Phase 5: Detect constraints ──
  const constraints = detectConstraints(merged, tol);

  return { entities: merged, constraints };
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

  // ── Try arc/circle fit with Gauss-Newton geometric refinement ──
  const sub: Point2D[] = [];
  for (let i = start; i <= end; i++) sub.push(pts[i]);
  const kasaFit = fitCircle(sub);

  if (kasaFit) {
    const circFit = refineCircleGeometric(sub, kasaFit);
    if (circFit.maxError < tol) {
      const chordLen = dist(pts[start], pts[end]);
      // Adaptive tolerance ONLY for closed-loop circle detection
      const arcChordErr = circFit.radius * (1 - Math.cos(Math.PI / Math.max(6, count)));
      const closeLoopTol = Math.min(Math.max(tol, arcChordErr * 2.5), diag * 0.02);
      const isCloseLoop = chordLen < closeLoopTol * 2;

      if (isCloseLoop && count >= 6) {
        return [makeArc(circFit.center, circFit.radius, 0, 2 * Math.PI, pts[start], pts[start])];
      }

      const sa = Math.atan2(pts[start].y - circFit.center.y, pts[start].x - circFit.center.x);
      const ea = Math.atan2(pts[end].y - circFit.center.y, pts[end].x - circFit.center.x);
      const midIdx = Math.floor((start + end) / 2);
      const ma = Math.atan2(pts[midIdx].y - circFit.center.y, pts[midIdx].x - circFit.center.x);

      const sweep = computeSweep(sa, ea, ma);
      const sweepDeg = Math.abs(sweep) * 180 / Math.PI;

      if (sweepDeg > 5 && circFit.radius < chordLen * 10 && circFit.radius < diag * 2) {
        // Project endpoints onto the fitted circle for exact placement
        const startPt = projectOntoCircle(pts[start], circFit.center, circFit.radius);
        const endPt = projectOntoCircle(pts[end], circFit.center, circFit.radius);
        return [makeArc(circFit.center, circFit.radius, sa, sa + sweep, startPt, endPt)];
      }
    }
  }

  // ── Try line fit ──
  let maxDev = 0, maxDevIdx = start;
  for (let i = start + 1; i < end; i++) {
    const d = pointToSegmentDist(pts[i], pts[start], pts[end]);
    if (d > maxDev) { maxDev = d; maxDevIdx = i; }
  }

  if (maxDev < tol) {
    if (dist(pts[start], pts[end]) < tol * 0.01) return [];
    return [makeLine(pts[start], pts[end])];
  }

  // ── Split at max deviation ──
  if (depth > 50) return [makeLine(pts[start], pts[end])];

  const left = recursiveFit(pts, start, maxDevIdx, tol, depth + 1, diag);
  const right = recursiveFit(pts, maxDevIdx, end, tol, depth + 1, diag);
  return [...left, ...right];
}

// ═══════════════════════════════════════════════════════════════
// Post-Merge
// ═══════════════════════════════════════════════════════════════

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
        if (midDev < tol * 0.3 && lineLength(prev.start, curr.end) > 0.001) {
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
