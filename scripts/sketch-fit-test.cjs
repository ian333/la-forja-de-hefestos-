/**
 * ⚒️ La Forja de Hefestos — Sketch Fitting v2
 * ==============================================
 * Recursive subdivision algorithm: contour points → Lines + Arcs.
 *
 * v2 improvements over v1:
 *  - Full circle pre-detection (53pts → 1 circle, not 26 lines)
 *  - Recursive line+arc fitting (like RDP but with arc test)
 *  - Post-merge pass (collinear lines, same-center arcs)
 *  - Better tolerance scaling
 *  - Signed sweep angles for correct arc direction
 *
 * Usage: node scripts/sketch-fit-test.cjs [file.stp]
 */

const fs = require('fs');
const path = require('path');
const occtFactory = require('occt-import-js');

// ═══════════════════════════════════════════════════════════════
// Minimal Three.js polyfill
// ═══════════════════════════════════════════════════════════════
class BufferAttribute {
  constructor(array, itemSize) {
    this.array = array;
    this.itemSize = itemSize;
    this.count = array.length / itemSize;
  }
  getX(i) { return this.array[i * this.itemSize]; }
  getY(i) { return this.array[i * this.itemSize + 1]; }
  getZ(i) { return this.array[i * this.itemSize + 2]; }
}

class BufferGeometry {
  constructor() { this._attributes = {}; this._index = null; this.boundingBox = null; }
  setAttribute(name, attr) { this._attributes[name] = attr; }
  getAttribute(name) { return this._attributes[name]; }
  setIndex(attr) { this._index = attr; }
  getIndex() { return this._index; }
  computeBoundingBox() {
    const pos = this._attributes.position;
    if (!pos) return;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    this.boundingBox = { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
  }
  dispose() {}
}

// ═══════════════════════════════════════════════════════════════
// Geometry Primitives
// ═══════════════════════════════════════════════════════════════

class Line2D {
  constructor(start, end) {
    this.type = 'line';
    this.start = start;
    this.end = end;
  }
  get length() { return dist(this.start, this.end); }
  get angle() { return Math.atan2(this.end.y - this.start.y, this.end.x - this.start.x); }
  distToPoint(p) {
    const dx = this.end.x - this.start.x;
    const dy = this.end.y - this.start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-12) return dist(p, this.start);
    return Math.abs(dy * p.x - dx * p.y + this.end.x * this.start.y - this.end.y * this.start.x) / len;
  }
  toString() {
    return `Line(${fmt(this.start)}→${fmt(this.end)}, L=${this.length.toFixed(3)})`;
  }
}

class Arc2D {
  constructor(center, radius, startAngle, endAngle, startPt, endPt) {
    this.type = 'arc';
    this.center = center;
    this.radius = radius;
    this.startAngle = startAngle;
    this.endAngle = endAngle;
    this.start = startPt;
    this.end = endPt;
  }
  /** Signed sweep: positive = CCW, negative = CW */
  get sweepAngle() {
    let s = this.endAngle - this.startAngle;
    while (s > 2 * Math.PI) s -= 2 * Math.PI;
    while (s < -2 * Math.PI) s += 2 * Math.PI;
    return s;
  }
  get isFullCircle() {
    return Math.abs(this.sweepAngle) > Math.PI * 1.95;
  }
  get arcLength() {
    return this.radius * Math.abs(this.sweepAngle);
  }
  toString() {
    const deg = (a) => (a * 180 / Math.PI).toFixed(1);
    if (this.isFullCircle) return `Circle(c=${fmt(this.center)}, r=${this.radius.toFixed(3)})`;
    return `Arc(c=${fmt(this.center)}, r=${this.radius.toFixed(3)}, ${deg(this.startAngle)}°→${deg(this.endAngle)}°, sweep=${deg(this.sweepAngle)}°)`;
  }
}

class Constraint {
  constructor(type, entityIndices, params = {}) {
    this.type = type;
    this.entities = entityIndices;
    this.params = params;
  }
  toString() { return `${this.type}(${this.entities.join(', ')})`; }
}

class CircularPattern {
  constructor(center, count, features) {
    this.type = 'circular_pattern';
    this.center = center;
    this.count = count;
    this.features = features;
    this.radius = 0;
    this.angleStep = 2 * Math.PI / count;
  }
  toString() { return `CircularPattern(c=${fmt(this.center)}, n=${this.count}, r=${this.radius.toFixed(2)})`; }
}

class LinearPattern {
  constructor(direction, spacing, count, features) {
    this.type = 'linear_pattern';
    this.direction = direction;
    this.spacing = spacing;
    this.count = count;
    this.features = features;
  }
  toString() { return `LinearPattern(dir=${fmt(this.direction)}, spacing=${this.spacing.toFixed(3)}, n=${this.count})`; }
}

class MirrorPattern {
  constructor(axisPoint, axisDir, featurePairs) {
    this.type = 'mirror';
    this.axisPoint = axisPoint;
    this.axisDir = axisDir;
    this.featurePairs = featurePairs;
  }
  toString() { return `Mirror(axis=${fmt(this.axisPoint)}→${fmt(this.axisDir)}, pairs=${this.featurePairs.length})`; }
}

// ═══════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════

function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }
function fmt(p) { return `(${p.x.toFixed(2)},${p.y.toFixed(2)})`; }
function lerp(a, b, t) { return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }; }
function cross2D(a, b) { return a.x * b.y - a.y * b.x; }

function angleBetween(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Distance from point p to line segment a→b */
function pointToSegmentDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-20) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/**
 * Least-squares circle fit (Kasa algebraic method).
 * Returns { center, radius, maxError, avgError } or null.
 */
function fitCircle(points) {
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
  const center = { x: cx, y: cy };

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

/** Compute 3-point circle (for curvature estimation) */
function circleFrom3Points(p1, p2, p3) {
  const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
  if (Math.abs(d) < 1e-10) return null;
  const ux = ((p1.x ** 2 + p1.y ** 2) * (p2.y - p3.y) + (p2.x ** 2 + p2.y ** 2) * (p3.y - p1.y) + (p3.x ** 2 + p3.y ** 2) * (p1.y - p2.y)) / d;
  const uy = ((p1.x ** 2 + p1.y ** 2) * (p3.x - p2.x) + (p2.x ** 2 + p2.y ** 2) * (p1.x - p3.x) + (p3.x ** 2 + p3.y ** 2) * (p2.x - p1.x)) / d;
  return { center: { x: ux, y: uy }, radius: dist({ x: ux, y: uy }, p1) };
}

/** Local curvature at point i (signed: positive = CCW) */
function localCurvature(pts, i) {
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
// CORE v2: Recursive Subdivision Fitting
// ═══════════════════════════════════════════════════════════════

/**
 * Main fitting function v2.
 *
 * Algorithm:
 *  Phase 0: Full circle test
 *  Phase 1: Open contour at max curvature discontinuity
 *  Phase 2: Recursive line+arc fitting (top-down subdivision)
 *  Phase 3: Post-merge adjacent entities
 *  Phase 4: Snap endpoints for C0 continuity
 *  Phase 5: Detect constraints
 */
function fitContour(pts, tolerance) {
  if (pts.length < 3) return { entities: [], constraints: [] };

  // ── Pre-process: remove near-duplicate consecutive points ──
  const cleaned = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (dist(pts[i], cleaned[cleaned.length - 1]) > 1e-6) {
      cleaned.push(pts[i]);
    }
  }
  // Remove last if same as first (closed contour)
  if (cleaned.length > 2 && dist(cleaned[0], cleaned[cleaned.length - 1]) < 1e-6) {
    cleaned.pop();
  }
  if (cleaned.length < 3) return { entities: [], constraints: [] };

  const n = cleaned.length;
  const bbox = bboxOf(cleaned);
  const diag = Math.sqrt((bbox.maxX - bbox.minX) ** 2 + (bbox.maxY - bbox.minY) ** 2);
  const tol = tolerance || Math.max(0.1, diag * 0.002);

  // ── Phase 0: Full circle test ──
  const circleFit = fitCircle(cleaned);
  if (circleFit && circleFit.maxError < tol * 0.5) {
    if (circleFit.radius < diag * 2) {
      const arc = new Arc2D(
        circleFit.center, circleFit.radius,
        0, 2 * Math.PI,
        cleaned[0], cleaned[0]
      );
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

  // Rotate array so we start at the "corner"
  const openPts = [];
  for (let i = 0; i < n; i++) openPts.push(cleaned[(openIdx + i) % n]);

  // ── Phase 2: Recursive subdivision ──
  const entities = recursiveFit(openPts, 0, openPts.length - 1, tol, 0);

  // ── Phase 3: Post-merge ──
  const merged = mergeEntities(entities, tol);

  // ── Phase 4: Snap endpoints for C0 continuity ──
  for (let i = 0; i < merged.length; i++) {
    const curr = merged[i];
    const next = merged[(i + 1) % merged.length];
    if (!curr || !next) continue;
    const mid = lerp(getEnd(curr), getStart(next), 0.5);
    setEnd(curr, mid);
    setStart(next, mid);
  }

  // ── Phase 5: Detect constraints ──
  const constraints = detectConstraints(merged, tol);

  return { entities: merged, constraints };
}

/**
 * Recursive fit on open polyline pts[start..end].
 * Tries arc first (prefers curves over lines for mechanical parts),
 * then line, then splits at max chord-deviation point.
 */
function recursiveFit(pts, start, end, tol, depth) {
  const count = end - start + 1;
  if (count <= 1) return [];
  if (count === 2) {
    if (dist(pts[start], pts[end]) < tol * 0.01) return [];
    return [new Line2D({ ...pts[start] }, { ...pts[end] })];
  }

  // ── Try arc/circle fit (≥ 3 points) ──
  const sub = [];
  for (let i = start; i <= end; i++) sub.push(pts[i]);
  const circFit = fitCircle(sub);

  if (circFit && circFit.maxError < tol) {
    const chordLen = dist(pts[start], pts[end]);
    const isCloseLoop = chordLen < tol * 2;

    if (isCloseLoop && count >= 6) {
      // Full or near-full circle
      return [new Arc2D(
        circFit.center, circFit.radius,
        0, 2 * Math.PI,
        pts[start], pts[start]
      )];
    }

    // Check sweep is meaningful (> 5°) and radius isn't absurdly large
    const sa = Math.atan2(pts[start].y - circFit.center.y, pts[start].x - circFit.center.x);
    const ea = Math.atan2(pts[end].y - circFit.center.y, pts[end].x - circFit.center.x);
    const midIdx = Math.floor((start + end) / 2);
    const ma = Math.atan2(pts[midIdx].y - circFit.center.y, pts[midIdx].x - circFit.center.x);

    const sweep = computeSweep(sa, ea, ma);
    const sweepDeg = Math.abs(sweep) * 180 / Math.PI;

    if (sweepDeg > 5 && circFit.radius < chordLen * 10) {
      return [new Arc2D(
        circFit.center, circFit.radius,
        sa, sa + sweep,
        { ...pts[start] }, { ...pts[end] }
      )];
    }
  }

  // ── Try line fit (max deviation from chord) ──
  let maxDev = 0, maxDevIdx = start;
  for (let i = start + 1; i < end; i++) {
    const d = pointToSegmentDist(pts[i], pts[start], pts[end]);
    if (d > maxDev) { maxDev = d; maxDevIdx = i; }
  }

  if (maxDev < tol) {
    if (dist(pts[start], pts[end]) < tol * 0.01) return [];
    return [new Line2D({ ...pts[start] }, { ...pts[end] })];
  }

  // ── Split at max deviation point ──
  if (depth > 30) return [new Line2D({ ...pts[start] }, { ...pts[end] })];

  const left = recursiveFit(pts, start, maxDevIdx, tol, depth + 1);
  const right = recursiveFit(pts, maxDevIdx, end, tol, depth + 1);
  return [...left, ...right];
}

/**
 * Compute signed sweep from startAngle to endAngle ensuring
 * midAngle is within the sweep.
 * Returns positive (CCW) or negative (CW).
 */
function computeSweep(startAngle, endAngle, midAngle) {
  // CCW sweep
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

/**
 * Post-merge: combine adjacent collinear lines and same-center arcs.
 */
function mergeEntities(entities, tol) {
  if (entities.length < 2) return [...entities];

  let changed = true;
  let result = [...entities];

  while (changed) {
    changed = false;
    const next = [result[0]];

    for (let i = 1; i < result.length; i++) {
      const prev = next[next.length - 1];
      const curr = result[i];

      // ── Merge collinear lines ──
      if (prev.type === 'line' && curr.type === 'line') {
        const mergedLine = new Line2D(prev.start, curr.end);
        const midDev = mergedLine.distToPoint(prev.end);
        if (midDev < tol * 0.5 && mergedLine.length > 0.01) {
          next[next.length - 1] = mergedLine;
          changed = true;
          continue;
        }
      }

      // ── Merge same-center arcs ──
      if (prev.type === 'arc' && curr.type === 'arc') {
        const centerDist = dist(prev.center, curr.center);
        const radiusDiff = Math.abs(prev.radius - curr.radius);
        if (centerDist < tol && radiusDiff < tol * 0.5) {
          const avgCenter = lerp(prev.center, curr.center, 0.5);
          const avgRadius = (prev.radius + curr.radius) / 2;
          const combinedSweep = prev.sweepAngle + curr.sweepAngle;
          const mergedArc = new Arc2D(
            avgCenter, avgRadius,
            prev.startAngle, prev.startAngle + combinedSweep,
            prev.start, curr.end
          );
          next[next.length - 1] = mergedArc;
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

function getStart(e) { return e.start; }
function getEnd(e) { return e.end; }
function setStart(e, pt) {
  e.start = { ...pt };
  if (e.type === 'arc' && !e.isFullCircle) {
    e.startAngle = Math.atan2(pt.y - e.center.y, pt.x - e.center.x);
  }
}
function setEnd(e, pt) {
  e.end = { ...pt };
  if (e.type === 'arc' && !e.isFullCircle) {
    e.endAngle = Math.atan2(pt.y - e.center.y, pt.x - e.center.x);
  }
}

// ═══════════════════════════════════════════════════════════════
// Constraint Detection
// ═══════════════════════════════════════════════════════════════

function detectConstraints(entities, tol) {
  const constraints = [];
  const angleTol = 2 * Math.PI / 180; // 2°

  for (let i = 0; i < entities.length; i++) {
    const curr = entities[i];
    const next = entities[(i + 1) % entities.length];

    // ── Tangent line→arc ──
    if (curr.type === 'line' && next.type === 'arc') {
      const lineAngle = curr.angle;
      const tangentAngle = Math.atan2(curr.end.y - next.center.y, curr.end.x - next.center.x) + Math.PI / 2;
      if (Math.abs(angleBetween(lineAngle, tangentAngle)) < angleTol ||
          Math.abs(angleBetween(lineAngle, tangentAngle + Math.PI)) < angleTol) {
        constraints.push(new Constraint('tangent', [i, (i + 1) % entities.length]));
      }
    }

    // ── Tangent arc→line ──
    if (curr.type === 'arc' && next.type === 'line') {
      const tangentAngle = Math.atan2(curr.end.y - curr.center.y, curr.end.x - curr.center.x) + Math.PI / 2;
      const lineAngle = next.angle;
      if (Math.abs(angleBetween(lineAngle, tangentAngle)) < angleTol ||
          Math.abs(angleBetween(lineAngle, tangentAngle + Math.PI)) < angleTol) {
        constraints.push(new Constraint('tangent', [i, (i + 1) % entities.length]));
      }
    }

    // ── Tangent arc→arc ──
    if (curr.type === 'arc' && next.type === 'arc') {
      const t1 = Math.atan2(curr.end.y - curr.center.y, curr.end.x - curr.center.x) + Math.PI / 2;
      const t2 = Math.atan2(next.start.y - next.center.y, next.start.x - next.center.x) + Math.PI / 2;
      if (Math.abs(angleBetween(t1, t2)) < angleTol ||
          Math.abs(angleBetween(t1, t2 + Math.PI)) < angleTol) {
        constraints.push(new Constraint('tangent', [i, (i + 1) % entities.length]));
      }
      if (dist(curr.center, next.center) < tol) {
        constraints.push(new Constraint('concentric', [i, (i + 1) % entities.length]));
      }
    }

    // ── H/V lines ──
    if (curr.type === 'line') {
      if (Math.abs(Math.sin(curr.angle)) < Math.sin(angleTol))
        constraints.push(new Constraint('horizontal', [i]));
      if (Math.abs(Math.cos(curr.angle)) < Math.sin(angleTol))
        constraints.push(new Constraint('vertical', [i]));
    }

    // ── Equal radius arcs ──
    if (curr.type === 'arc') {
      for (let j = i + 1; j < entities.length; j++) {
        if (entities[j].type === 'arc') {
          if (Math.abs(curr.radius - entities[j].radius) / Math.max(curr.radius, entities[j].radius) < 0.02) {
            constraints.push(new Constraint('equal_radius', [i, j]));
          }
        }
      }
    }

    // ── Perpendicular lines ──
    if (curr.type === 'line' && next.type === 'line') {
      const diff = Math.abs(angleBetween(curr.angle, next.angle));
      if (Math.abs(diff - Math.PI / 2) < angleTol)
        constraints.push(new Constraint('perpendicular', [i, (i + 1) % entities.length]));
    }

    // ── Collinear lines ──
    if (curr.type === 'line' && next.type === 'line') {
      const diff = Math.abs(angleBetween(curr.angle, next.angle));
      if (diff < angleTol || Math.abs(diff - Math.PI) < angleTol)
        constraints.push(new Constraint('collinear', [i, (i + 1) % entities.length]));
    }
  }

  return constraints;
}

// ═══════════════════════════════════════════════════════════════
// Pattern Detection
// ═══════════════════════════════════════════════════════════════

function detectPatterns(features) {
  const patterns = [];
  const groups = groupSimilarFeatures(features);

  for (const group of groups) {
    if (group.length < 3) continue;
    const circPat = tryCircularPattern(group);
    if (circPat) { patterns.push(circPat); continue; }
    const linPat = tryLinearPattern(group);
    if (linPat) { patterns.push(linPat); continue; }
  }

  const mirror = tryMirrorDetection(features);
  if (mirror) patterns.push(mirror);

  return patterns;
}

function groupSimilarFeatures(features) {
  const groups = [];
  const used = new Set();
  for (let i = 0; i < features.length; i++) {
    if (used.has(i)) continue;
    const group = [{ ...features[i], _idx: i }];
    used.add(i);
    for (let j = i + 1; j < features.length; j++) {
      if (used.has(j)) continue;
      if (features[i].type === features[j].type &&
          features[i].radius && features[j].radius &&
          Math.abs(features[i].radius - features[j].radius) / features[i].radius < 0.05) {
        group.push({ ...features[j], _idx: j });
        used.add(j);
      }
    }
    if (group.length >= 2) groups.push(group);
  }
  return groups;
}

function tryCircularPattern(group) {
  if (group.length < 3) return null;
  const cx = group.reduce((s, f) => s + f.center[0], 0) / group.length;
  const cy = group.reduce((s, f) => s + f.center[1], 0) / group.length;
  const dists = group.map(f => Math.sqrt((f.center[0] - cx) ** 2 + (f.center[1] - cy) ** 2));
  const avgDist = dists.reduce((a, b) => a + b, 0) / dists.length;
  if (avgDist < 1) return null;
  const maxDev = Math.max(...dists.map(d => Math.abs(d - avgDist)));
  if (maxDev / avgDist > 0.05) return null;

  const angles = group.map(f => Math.atan2(f.center[1] - cy, f.center[0] - cx));
  angles.sort((a, b) => a - b);
  const expectedStep = (2 * Math.PI) / group.length;
  for (let i = 0; i < angles.length; i++) {
    const next = (i + 1) % angles.length;
    let gap = angles[next] - angles[i];
    if (gap <= 0) gap += 2 * Math.PI;
    if (Math.abs(gap - expectedStep) / expectedStep > 0.15) return null;
  }

  const pat = new CircularPattern({ x: cx, y: cy }, group.length, group.map(f => f._idx));
  pat.radius = avgDist;
  return pat;
}

function tryLinearPattern(group) {
  if (group.length < 3) return null;
  const sorted = [...group].sort((a, b) => a.center[0] - b.center[0]);
  const spacings = [];
  for (let i = 1; i < sorted.length; i++) {
    spacings.push(dist(
      { x: sorted[i].center[0], y: sorted[i].center[1] },
      { x: sorted[i - 1].center[0], y: sorted[i - 1].center[1] }
    ));
  }
  const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
  const maxDev = Math.max(...spacings.map(s => Math.abs(s - avgSpacing)));
  if (maxDev / avgSpacing > 0.10) return null;

  const dir = {
    x: sorted[sorted.length - 1].center[0] - sorted[0].center[0],
    y: sorted[sorted.length - 1].center[1] - sorted[0].center[1]
  };
  const dirLen = Math.sqrt(dir.x ** 2 + dir.y ** 2);
  dir.x /= dirLen; dir.y /= dirLen;
  return new LinearPattern(dir, avgSpacing, group.length, group.map(f => f._idx));
}

function tryMirrorDetection(features) {
  if (features.length < 2) return null;
  const cx = features.reduce((s, f) => s + f.center[0], 0) / features.length;
  const cy = features.reduce((s, f) => s + f.center[1], 0) / features.length;
  const pairs = [];
  const used = new Set();
  for (let i = 0; i < features.length; i++) {
    if (used.has(i)) continue;
    const fi = features[i];
    const mirroredX = 2 * cx - fi.center[0];
    for (let j = i + 1; j < features.length; j++) {
      if (used.has(j)) continue;
      const fj = features[j];
      if (fi.type === fj.type &&
          Math.abs(fj.center[0] - mirroredX) < Math.abs(cx) * 0.05 + 1 &&
          Math.abs(fj.center[1] - fi.center[1]) < Math.abs(cy) * 0.05 + 1) {
        pairs.push([i, j]);
        used.add(i); used.add(j);
        break;
      }
    }
  }
  if (pairs.length >= 2) {
    return new MirrorPattern({ x: cx, y: cy }, { x: 0, y: 1 }, pairs);
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// Reconstruction Error
// ═══════════════════════════════════════════════════════════════

function reconstructionError(originalPts, entities, tol) {
  if (entities.length === 0) return { maxError: Infinity, avgError: Infinity, coverage: 0 };

  const reconstructed = sampleEntities(entities, Math.max(200, originalPts.length * 3));
  if (reconstructed.length === 0) return { maxError: Infinity, avgError: Infinity, coverage: 0 };

  let sumErr = 0, maxErr = 0, covered = 0;
  const coverageThreshold = tol || 1;

  for (const orig of originalPts) {
    let minDist = Infinity;
    for (const rec of reconstructed) {
      const d = dist(orig, rec);
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

function sampleEntities(entities, totalSamples) {
  const points = [];
  const totalLength = entities.reduce((s, e) => {
    if (e.type === 'line') return s + e.length;
    if (e.type === 'arc') return s + Math.max(e.arcLength, 0.01);
    return s;
  }, 0);

  if (totalLength < 1e-10) return points;

  for (const entity of entities) {
    const len = entity.type === 'line' ? entity.length : Math.max(entity.arcLength, 0.01);
    const n = Math.max(2, Math.round(totalSamples * len / totalLength));

    if (entity.type === 'line') {
      for (let i = 0; i <= n; i++) {
        points.push(lerp(entity.start, entity.end, i / n));
      }
    } else if (entity.type === 'arc') {
      const sweep = entity.sweepAngle;
      for (let i = 0; i <= n; i++) {
        const angle = entity.startAngle + sweep * (i / n);
        points.push({
          x: entity.center.x + entity.radius * Math.cos(angle),
          y: entity.center.y + entity.radius * Math.sin(angle),
        });
      }
    }
  }
  return points;
}

// ═══════════════════════════════════════════════════════════════
// Slicer
// ═══════════════════════════════════════════════════════════════

function bboxOf(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function shoelaceArea(pts) {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function centroidOf(pts) {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  return { x: cx / pts.length, y: cy / pts.length };
}

function circularityTest(pts, centroid) {
  if (pts.length < 6) return { isCircular: false, circleRadius: 0 };
  const dists = pts.map(p => dist(p, centroid));
  const avgR = dists.reduce((a, b) => a + b, 0) / dists.length;
  if (avgR < 1e-9) return { isCircular: false, circleRadius: 0 };
  const maxDev = Math.max(...dists.map(d => Math.abs(d - avgR)));
  return { isCircular: maxDev / avgR < 0.08, circleRadius: avgR };
}

function getComp(attr, idx, comp) {
  return comp === 0 ? attr.getX(idx) : comp === 1 ? attr.getY(idx) : attr.getZ(idx);
}

function sliceMesh(geo, axis, value) {
  const posAttr = geo.getAttribute('position');
  const idxAttr = geo.getIndex();
  if (!posAttr) return { contours: [], totalArea: 0 };
  const numTri = idxAttr ? idxAttr.count / 3 : posAttr.count / 3;
  const axisIdx = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;
  const uIdx = axisIdx === 0 ? 1 : 0;
  const vIdx = axisIdx === 2 ? 1 : 2;
  const segments = [];
  for (let t = 0; t < numTri; t++) {
    const i0 = idxAttr ? idxAttr.getX(t * 3) : t * 3;
    const i1 = idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2;
    const d0 = getComp(posAttr, i0, axisIdx) - value;
    const d1 = getComp(posAttr, i1, axisIdx) - value;
    const d2 = getComp(posAttr, i2, axisIdx) - value;
    const verts = [
      { d: d0, u: getComp(posAttr, i0, uIdx), v: getComp(posAttr, i0, vIdx) },
      { d: d1, u: getComp(posAttr, i1, uIdx), v: getComp(posAttr, i1, vIdx) },
      { d: d2, u: getComp(posAttr, i2, uIdx), v: getComp(posAttr, i2, vIdx) },
    ];
    const pts = [];
    for (let e = 0; e < 3; e++) {
      const a = verts[e], b = verts[(e + 1) % 3];
      if ((a.d > 0) !== (b.d > 0)) {
        const tt = a.d / (a.d - b.d);
        pts.push({ x: a.u + tt * (b.u - a.u), y: a.v + tt * (b.v - a.v) });
      } else if (Math.abs(a.d) < 1e-12) {
        pts.push({ x: a.u, y: a.v });
      }
    }
    if (pts.length >= 2) segments.push([pts[0], pts[1]]);
  }
  if (segments.length === 0) return { contours: [], totalArea: 0 };

  const used = new Set();
  const contours = [];
  function findKey(p) { return `${(p.x * 1e4) | 0},${(p.y * 1e4) | 0}`; }
  const adjMap = new Map();
  for (let i = 0; i < segments.length; i++) {
    const [a, b] = segments[i];
    const ka = findKey(a), kb = findKey(b);
    if (!adjMap.has(ka)) adjMap.set(ka, []);
    if (!adjMap.has(kb)) adjMap.set(kb, []);
    adjMap.get(ka).push({ idx: i, other: b, key: kb });
    adjMap.get(kb).push({ idx: i, other: a, key: ka });
  }
  for (let start = 0; start < segments.length; start++) {
    if (used.has(start)) continue;
    used.add(start);
    const chain = [segments[start][0], segments[start][1]];
    let currentKey = findKey(segments[start][1]);
    const startKey = findKey(segments[start][0]);
    let safety = segments.length + 10;
    while (currentKey !== startKey && safety-- > 0) {
      const neighbors = adjMap.get(currentKey) || [];
      let found = false;
      for (const nb of neighbors) {
        if (!used.has(nb.idx)) {
          used.add(nb.idx);
          chain.push(nb.other);
          currentKey = nb.key;
          found = true;
          break;
        }
      }
      if (!found) break;
    }
    if (chain.length >= 3) {
      const area = shoelaceArea(chain);
      const centroid = centroidOf(chain);
      const bb = bboxOf(chain);
      const circ = circularityTest(chain, centroid);
      contours.push({
        points: chain,
        signedArea: area,
        area: Math.abs(area),
        centroid,
        bbox: bb,
        isCircular: circ.isCircular,
        circleRadius: circ.circleRadius,
        perimeter: chain.reduce((s, p, i) => s + dist(p, chain[(i + 1) % chain.length]), 0),
      });
    }
  }
  return { contours, totalArea: contours.filter(c => c.signedArea > 0).reduce((s, c) => s + c.area, 0) };
}

// ═══════════════════════════════════════════════════════════════
// STEP Loader
// ═══════════════════════════════════════════════════════════════

async function loadStepFile(filePath) {
  const occt = await occtFactory();
  const fileData = fs.readFileSync(filePath);
  const result = occt.ReadStepFile(new Uint8Array(fileData), null);
  if (!result.success) throw new Error(`Failed to parse: ${filePath}`);
  const meshes = [];
  for (let mi = 0; mi < result.meshes.length; mi++) {
    const m = result.meshes[mi];
    const positions = new Float32Array(m.attributes.position.array);
    const indices = m.index ? new Uint32Array(m.index.array) : null;
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    if (indices) geo.setIndex(new BufferAttribute(indices, 1));
    geo.computeBoundingBox();
    meshes.push({ name: m.name || `Mesh_${mi}`, geometry: geo });
  }
  return meshes;
}

function mergeGeometries(meshes) {
  const allPos = [], allIdx = [];
  let offset = 0;
  for (const m of meshes) {
    const pos = m.geometry.getAttribute('position');
    const idx = m.geometry.getIndex();
    for (let i = 0; i < pos.count; i++) allPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (idx) for (let i = 0; i < idx.count; i++) allIdx.push(idx.array[i] + offset);
    else for (let i = 0; i < pos.count; i++) allIdx.push(i + offset);
    offset += pos.count;
  }
  const merged = new BufferGeometry();
  merged.setAttribute('position', new BufferAttribute(new Float32Array(allPos), 3));
  merged.setIndex(new BufferAttribute(new Uint32Array(allIdx), 1));
  merged.computeBoundingBox();
  return merged;
}

// ═══════════════════════════════════════════════════════════════
// Main Test
// ═══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const modelsDir = path.join(__dirname, '..', 'models', 'step');

  let files;
  if (args.length > 0) {
    files = args.map(a => path.resolve(a));
  } else {
    const nistDir = path.join(modelsDir, 'NIST-PMI-STEP-Files', 'AP203 geometry only');
    files = fs.readdirSync(nistDir)
      .filter(f => f.endsWith('.stp') && f.includes('nist_ctc'))
      .sort()
      .slice(0, 3) // first 3 NIST CTC files
      .map(f => path.join(nistDir, f));
  }

  console.log(`\n🔧 Sketch Fitting v2 — ${files.length} archivos\n`);

  let globalCircles = 0, globalArcs = 0, globalLines = 0;
  let globalOrigPts = 0, globalEntities = 0;
  let globalContours = 0;

  for (const file of files) {
    const name = path.basename(file, '.stp');
    console.log('═'.repeat(70));
    console.log(`📐 ${name}`);
    console.log('═'.repeat(70));

    const meshes = await loadStepFile(file);
    const merged = mergeGeometries(meshes);
    const bb = merged.boundingBox;
    const sizeX = bb.max.x - bb.min.x;
    const sizeY = bb.max.y - bb.min.y;
    const sizeZ = bb.max.z - bb.min.z;
    const diag = Math.sqrt(sizeX ** 2 + sizeY ** 2 + sizeZ ** 2);
    console.log(`  Size: ${sizeX.toFixed(1)} × ${sizeY.toFixed(1)} × ${sizeZ.toFixed(1)}  (diag=${diag.toFixed(1)})\n`);

    const axes = ['Z', 'X', 'Y'];
    const sizes = [sizeZ, sizeX, sizeY];
    const mins = [bb.min.z, bb.min.x, bb.min.y];

    let totalContours = 0, totalEntities = 0, totalConstraints = 0;
    let totalOrigPoints = 0;
    let worstError = 0, sumAvgError = 0, errorSamples = 0;
    let fileCircles = 0, fileArcs = 0, fileLines = 0;

    for (let ai = 0; ai < 3; ai++) {
      const axis = axes[ai];
      const lo = mins[ai];
      const range = sizes[ai];
      const numSlices = 10;
      console.log(`  📐 Eje ${axis} — ${numSlices} cortes:`);

      for (let si = 0; si < numSlices; si++) {
        const t = (si + 0.5) / numSlices;
        const val = lo + range * 0.01 + t * range * 0.98;
        const result = sliceMesh(merged, axis, val);
        if (result.contours.length === 0) continue;

        for (const contour of result.contours) {
          if (contour.points.length < 6) continue;
          totalContours++;
          totalOrigPoints += contour.points.length;

          const tol = Math.max(0.1, diag * 0.002);
          const { entities, constraints } = fitContour(contour.points, tol);

          totalEntities += entities.length;
          totalConstraints += constraints.length;

          const err = reconstructionError(contour.points, entities, tol);
          if (isFinite(err.maxError)) worstError = Math.max(worstError, err.maxError);
          if (isFinite(err.avgError)) { sumAvgError += err.avgError; errorSamples++; }

          const lines = entities.filter(e => e.type === 'line').length;
          const arcs = entities.filter(e => e.type === 'arc' && !e.isFullCircle).length;
          const fullCircles = entities.filter(e => e.type === 'arc' && e.isFullCircle).length;

          fileLines += lines; fileArcs += arcs; fileCircles += fullCircles;

          const tangents = constraints.filter(c => c.type === 'tangent').length;
          const perps = constraints.filter(c => c.type === 'perpendicular').length;
          const horiz = constraints.filter(c => c.type === 'horizontal').length;
          const vert = constraints.filter(c => c.type === 'vertical').length;
          const eqRad = constraints.filter(c => c.type === 'equal_radius').length;

          const reductionPct = ((1 - entities.length / contour.points.length) * 100).toFixed(0);

          if (entities.length > 0 && contour.area > 10) {
            const areaStr = contour.area > 1000 ? `${(contour.area / 1000).toFixed(1)}K` : contour.area.toFixed(0);
            console.log(`    ${axis}=${val.toFixed(1)} | ${contour.points.length}pts → ${entities.length} entities (${lines}L ${arcs}A${fullCircles > 0 ? ' ' + fullCircles + '⊙' : ''}) ${reductionPct}% | err: avg=${err.avgError.toFixed(3)} max=${err.maxError.toFixed(3)} cov=${(err.coverage * 100).toFixed(0)}% | ${constraints.length}c (${tangents}T ${perps}⊥ ${horiz}H ${vert}V ${eqRad}=R) | area=${areaStr}`);

            // Print detail for small contours or first few
            if (totalContours <= 3 || entities.length <= 4) {
              for (const e of entities) console.log(`      ${e.toString()}`);
              if (constraints.length > 0)
                console.log(`      Constraints: ${constraints.map(c => c.toString()).join(', ')}`);
            }
          }
        }
      }
      console.log();
    }

    const avgErr = errorSamples > 0 ? sumAvgError / errorSamples : 0;
    console.log(`  📊 RESUMEN ${name}:`);
    console.log(`     Contornos: ${totalContours}`);
    console.log(`     Puntos: ${totalOrigPoints} → ${totalEntities} entities (${((1 - totalEntities / totalOrigPoints) * 100).toFixed(0)}% reducción)`);
    console.log(`     Desglose: ${fileLines}L + ${fileArcs}A + ${fileCircles}⊙`);
    console.log(`     Constraints: ${totalConstraints}`);
    console.log(`     Error: avg=${avgErr.toFixed(4)}, worst=${worstError.toFixed(4)}`);
    console.log();

    globalLines += fileLines; globalArcs += fileArcs; globalCircles += fileCircles;
    globalOrigPts += totalOrigPoints; globalEntities += totalEntities;
    globalContours += totalContours;
  }

  // ═══ Pattern detection on first file ═══
  console.log('═'.repeat(70));
  console.log('🔄 PATTERN DETECTION TEST');
  console.log('═'.repeat(70));

  const mesh0 = await loadStepFile(files[0]);
  const fullGeo = mergeGeometries(mesh0);
  const bbf = fullGeo.boundingBox;

  const sZ = bbf.max.z - bbf.min.z;
  let bestHoles = [];
  let bestZ = 0;

  for (let t = 0.1; t <= 0.9; t += 0.1) {
    const zVal = bbf.min.z + sZ * t;
    const sr = sliceMesh(fullGeo, 'Z', zVal);
    const holes = sr.contours.filter(c => c.isCircular && c.area < 5000);
    if (holes.length > bestHoles.length) {
      bestHoles = holes;
      bestZ = zVal;
    }
  }

  console.log(`\n  Best Z=${bestZ.toFixed(1)}: ${bestHoles.length} circular contours`);

  if (bestHoles.length >= 3) {
    const pseudoFeatures = bestHoles.map((c, i) => ({
      type: 'hole',
      center: [c.centroid.x, c.centroid.y, bestZ],
      radius: c.circleRadius,
      _idx: i,
    }));

    const patterns = detectPatterns(pseudoFeatures);
    console.log(`  Patterns detectados: ${patterns.length}`);
    for (const p of patterns) console.log(`    ${p.toString()}`);

    if (patterns.length === 0 && bestHoles.length >= 2) {
      console.log(`  Debug — holes:`);
      for (const h of bestHoles.slice(0, 10)) {
        console.log(`    c=(${h.centroid.x.toFixed(1)},${h.centroid.y.toFixed(1)}), r=${h.circleRadius.toFixed(2)}, area=${h.area.toFixed(1)}`);
      }
    }
  }

  // ═══ Global summary ═══
  console.log('\n' + '═'.repeat(70));
  console.log('📊 GLOBAL SUMMARY');
  console.log('═'.repeat(70));
  console.log(`  Contours: ${globalContours}`);
  console.log(`  Points: ${globalOrigPts} → ${globalEntities} entities (${((1 - globalEntities / globalOrigPts) * 100).toFixed(0)}% reduction)`);
  console.log(`  Breakdown: ${globalLines}L + ${globalArcs}A + ${globalCircles}⊙`);
  console.log('═'.repeat(70));
  console.log('✅ Sketch fitting v2 complete');
  console.log('═'.repeat(70));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
