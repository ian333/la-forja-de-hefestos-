/**
 * ⚒️ La Forja de Hefestos — Sketch Fitting Experiment
 * =====================================================
 * Takes raw contour points from CT-scan slices and fits them
 * into proper geometric entities: Lines + Arcs.
 *
 * Goal: Points → { lines, arcs, constraints } that can rebuild
 * the original geometry exactly.
 *
 * Usage: node scripts/sketch-fit-test.cjs [file.stp]
 */

const fs = require('fs');
const path = require('path');
const occtFactory = require('occt-import-js');

// ═══════════════════════════════════════════════════════════════
// Minimal Three.js polyfill (same as ct-scan-test.cjs)
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

/** A line segment between two 2D points */
class Line2D {
  constructor(start, end) {
    this.type = 'line';
    this.start = start;
    this.end = end;
  }
  get length() {
    return dist(this.start, this.end);
  }
  get angle() {
    return Math.atan2(this.end.y - this.start.y, this.end.x - this.start.x);
  }
  /** Distance from point p to this infinite line */
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

/** A circular arc defined by center, radius, start/end angles */
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
  get sweepAngle() {
    let sweep = this.endAngle - this.startAngle;
    // Normalize to [0, 2π)
    while (sweep < 0) sweep += 2 * Math.PI;
    while (sweep > 2 * Math.PI) sweep -= 2 * Math.PI;
    return sweep;
  }
  get isFullCircle() {
    return this.sweepAngle > Math.PI * 1.95;
  }
  get arcLength() {
    return this.radius * this.sweepAngle;
  }
  toString() {
    const deg = (a) => (a * 180 / Math.PI).toFixed(1);
    if (this.isFullCircle) return `Circle(c=${fmt(this.center)}, r=${this.radius.toFixed(3)})`;
    return `Arc(c=${fmt(this.center)}, r=${this.radius.toFixed(3)}, ${deg(this.startAngle)}°→${deg(this.endAngle)}°)`;
  }
}

// ═══════════════════════════════════════════════════════════════
// Sketch Constraints
// ═══════════════════════════════════════════════════════════════
class Constraint {
  constructor(type, entityIndices, params = {}) {
    this.type = type;           // 'tangent' | 'perpendicular' | 'collinear' | 'concentric' | 'equal_radius' | 'horizontal' | 'vertical' | 'coincident'
    this.entities = entityIndices;
    this.params = params;
  }
  toString() {
    return `${this.type}(${this.entities.join(', ')})`;
  }
}

// ═══════════════════════════════════════════════════════════════
// Patterns
// ═══════════════════════════════════════════════════════════════
class CircularPattern {
  constructor(center, count, features) {
    this.type = 'circular_pattern';
    this.center = center;
    this.count = count;
    this.features = features; // indices into feature array
    this.radius = 0;
    this.angleStep = 2 * Math.PI / count;
  }
  toString() {
    return `CircularPattern(c=${fmt(this.center)}, n=${this.count}, r=${this.radius.toFixed(2)})`;
  }
}

class LinearPattern {
  constructor(direction, spacing, count, features) {
    this.type = 'linear_pattern';
    this.direction = direction;
    this.spacing = spacing;
    this.count = count;
    this.features = features;
  }
  toString() {
    return `LinearPattern(dir=${fmt(this.direction)}, spacing=${this.spacing.toFixed(3)}, n=${this.count})`;
  }
}

class MirrorPattern {
  constructor(axisPoint, axisDir, featurePairs) {
    this.type = 'mirror';
    this.axisPoint = axisPoint;
    this.axisDir = axisDir;
    this.featurePairs = featurePairs;
  }
  toString() {
    return `Mirror(axis=${fmt(this.axisPoint)}→${fmt(this.axisDir)}, pairs=${this.featurePairs.length})`;
  }
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

/**
 * Fit a circle through 3 points. Returns null if collinear.
 */
function circleFrom3Points(p1, p2, p3) {
  const ax = p1.x, ay = p1.y;
  const bx = p2.x, by = p2.y;
  const cx = p3.x, cy = p3.y;

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-10) return null; // collinear

  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

  const center = { x: ux, y: uy };
  const radius = dist(center, p1);
  return { center, radius };
}

/**
 * Least-squares circle fit for N points.
 * Uses algebraic fit: minimize Σ(x²+y²−2cx−2cy+c²−r²)²
 */
function fitCircle(points) {
  if (points.length < 3) return null;

  // Simple algebraic circle fit (Kasa method)
  let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0;
  let sumX3 = 0, sumY3 = 0, sumX2Y = 0, sumXY2 = 0;
  const n = points.length;

  for (const p of points) {
    sumX += p.x; sumY += p.y;
    sumX2 += p.x * p.x; sumY2 += p.y * p.y;
    sumXY += p.x * p.y;
    sumX3 += p.x * p.x * p.x; sumY3 += p.y * p.y * p.y;
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

  // Average radius
  let rSum = 0;
  for (const p of points) rSum += dist(p, center);
  const radius = rSum / n;

  // Compute fitting error
  let maxErr = 0, sumErr = 0;
  for (const p of points) {
    const err = Math.abs(dist(p, center) - radius);
    maxErr = Math.max(maxErr, err);
    sumErr += err;
  }

  return { center, radius, maxError: maxErr, avgError: sumErr / n };
}

/**
 * Compute local curvature at point i using 3-point circle.
 * Returns 1/radius (positive = CCW, negative = CW), 0 = straight.
 */
function localCurvature(pts, i) {
  const n = pts.length;
  const prev = pts[(i - 1 + n) % n];
  const curr = pts[i];
  const next = pts[(i + 1) % n];

  const circ = circleFrom3Points(prev, curr, next);
  if (!circ || circ.radius > 1e6) return 0; // effectively straight

  // Sign: positive if turning left (CCW)
  const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
  const v2 = { x: next.x - curr.x, y: next.y - curr.y };
  const sign = cross2D(v1, v2) >= 0 ? 1 : -1;

  return sign / circ.radius;
}

// ═══════════════════════════════════════════════════════════════
// CORE: Contour → Lines + Arcs
// ═══════════════════════════════════════════════════════════════

/**
 * Main fitting function: takes a closed contour (Point2D[])
 * and returns an array of Line2D and Arc2D entities.
 *
 * Algorithm:
 * 1. Compute local curvature at each point
 * 2. Segment points into groups of similar curvature
 * 3. For each group:
 *    - Near-zero curvature → fit line
 *    - Constant curvature → fit arc
 * 4. Snap endpoints for C0 continuity
 * 5. Detect and apply constraints
 */
function fitContour(pts, tolerance) {
  if (pts.length < 4) return { entities: [], constraints: [] };

  // Auto-scale tolerance to contour size
  const bbox = bboxOf(pts);
  const diag = Math.sqrt((bbox.maxX - bbox.minX) ** 2 + (bbox.maxY - bbox.minY) ** 2);
  const tol = tolerance || diag * 0.005; // 0.5% of bounding diagonal
  const curvTol = 0.3 / diag; // curvature tolerance relative to size

  const n = pts.length;

  // Step 1: Compute curvature at every point
  const kappa = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    kappa[i] = localCurvature(pts, i);
  }

  // Step 2: Smooth curvature (median filter, window=5)
  const smoothK = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const window = [];
    for (let w = -2; w <= 2; w++) {
      window.push(kappa[(i + w + n) % n]);
    }
    window.sort((a, b) => a - b);
    smoothK[i] = window[2]; // median
  }

  // Step 3: Segment by curvature changes
  // Each segment is a run of points with "similar" curvature
  const segments = []; // { start, end, avgCurvature, isLine }
  let segStart = 0;

  for (let i = 1; i <= n; i++) {
    const iMod = i % n;
    const atEnd = (i === n);

    // Check if curvature changed significantly
    let changed = atEnd;
    if (!atEnd) {
      const prevK = smoothK[(i - 1 + n) % n];
      const currK = smoothK[iMod];

      // Curvature change: either sign flip or magnitude jump
      if (Math.sign(prevK) !== Math.sign(currK) && Math.abs(prevK) > curvTol && Math.abs(currK) > curvTol) {
        changed = true;
      } else if (Math.abs(currK - prevK) > Math.max(Math.abs(prevK) * 0.5, curvTol * 2)) {
        changed = true;
      }
    }

    if (changed && i > segStart) {
      // Compute segment stats
      let sumK = 0, count = 0;
      for (let j = segStart; j < i; j++) {
        sumK += smoothK[j % n];
        count++;
      }
      const avgK = sumK / count;
      const isLine = Math.abs(avgK) < curvTol;

      segments.push({
        start: segStart,
        end: i - 1,  // inclusive index (mod n)
        count,
        avgCurvature: avgK,
        isLine,
      });
      segStart = i % n;
    }
  }

  // If segmentation failed (everything same curvature), make one segment
  if (segments.length === 0) {
    let sumK = 0;
    for (let i = 0; i < n; i++) sumK += smoothK[i];
    const avgK = sumK / n;
    segments.push({
      start: 0, end: n - 1, count: n,
      avgCurvature: avgK, isLine: Math.abs(avgK) < curvTol,
    });
  }

  // Step 4: Fit entities to each segment
  const entities = [];

  for (const seg of segments) {
    // Extract points for this segment
    const segPts = [];
    for (let i = seg.start; i !== ((seg.end + 1) % n); i = (i + 1) % n) {
      segPts.push(pts[i]);
      if (segPts.length > n + 1) break; // safety
    }
    segPts.push(pts[seg.end % n]); // ensure last point included
    // deduplicate last point if it wrapped
    if (segPts.length > 1 && dist(segPts[0], segPts[segPts.length - 1]) < tol * 0.1) {
      // don't double-add
    }

    if (segPts.length < 2) continue;

    if (seg.isLine) {
      // Fit a line: just use first and last point
      const start = segPts[0];
      const end = segPts[segPts.length - 1];
      if (dist(start, end) > tol * 0.5) {
        const line = new Line2D(start, end);

        // Verify: all intermediate points should be close to line
        let maxDev = 0;
        for (const p of segPts) {
          maxDev = Math.max(maxDev, line.distToPoint(p));
        }

        if (maxDev < tol * 3) {
          entities.push(line);
        } else {
          // Line doesn't fit well enough, try arc instead
          const arcResult = tryFitArc(segPts, tol);
          if (arcResult) entities.push(arcResult);
          else entities.push(line); // fallback
        }
      }
    } else {
      // Fit an arc
      const arcResult = tryFitArc(segPts, tol);
      if (arcResult) {
        entities.push(arcResult);
      } else {
        // Arc failed, fall back to line
        entities.push(new Line2D(segPts[0], segPts[segPts.length - 1]));
      }
    }
  }

  // Step 5: Snap endpoints for C0 continuity
  for (let i = 0; i < entities.length; i++) {
    const curr = entities[i];
    const next = entities[(i + 1) % entities.length];

    // Ensure curr.end == next.start
    const mid = lerp(getEnd(curr), getStart(next), 0.5);
    setEnd(curr, mid);
    setStart(next, mid);
  }

  // Step 6: Detect constraints
  const constraints = detectConstraints(entities, tol);

  return { entities, constraints };
}

function tryFitArc(segPts, tol) {
  if (segPts.length < 3) return null;

  const fit = fitCircle(segPts);
  if (!fit) return null;
  if (fit.maxError > tol * 5) return null;

  const { center, radius } = fit;
  const startPt = segPts[0];
  const endPt = segPts[segPts.length - 1];

  const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
  const endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);

  // Determine sweep direction from point ordering
  const midIdx = Math.floor(segPts.length / 2);
  const midPt = segPts[midIdx];
  const midAngle = Math.atan2(midPt.y - center.y, midPt.x - center.x);

  // Check if midpoint is between start and end going CCW
  let sweep = endAngle - startAngle;
  while (sweep < 0) sweep += 2 * Math.PI;
  let midSweep = midAngle - startAngle;
  while (midSweep < 0) midSweep += 2 * Math.PI;

  // If midpoint isn't in the sweep, we need the other direction
  if (midSweep > sweep) {
    // Go CW instead: swap and adjust
    return new Arc2D(center, radius, endAngle, startAngle, startPt, endPt);
  }

  return new Arc2D(center, radius, startAngle, endAngle, startPt, endPt);
}

function getStart(entity) {
  return entity.start;
}
function getEnd(entity) {
  return entity.end;
}
function setStart(entity, pt) {
  entity.start = { ...pt };
  if (entity.type === 'arc') {
    entity.startAngle = Math.atan2(pt.y - entity.center.y, pt.x - entity.center.x);
  }
}
function setEnd(entity, pt) {
  entity.end = { ...pt };
  if (entity.type === 'arc') {
    entity.endAngle = Math.atan2(pt.y - entity.center.y, pt.x - entity.center.x);
  }
}

// ═══════════════════════════════════════════════════════════════
// Constraint Detection
// ═══════════════════════════════════════════════════════════════

function detectConstraints(entities, tol) {
  const constraints = [];
  const angleTol = 2 * Math.PI / 180; // 2 degrees

  for (let i = 0; i < entities.length; i++) {
    const curr = entities[i];
    const next = entities[(i + 1) % entities.length];

    // Tangent: smooth transition (tangent vectors aligned at junction)
    if (curr.type === 'line' && next.type === 'arc') {
      const lineAngle = curr.angle;
      const tangentAngle = Math.atan2(
        curr.end.y - next.center.y,
        curr.end.x - next.center.x
      ) + Math.PI / 2; // perpendicular to radius = tangent
      if (Math.abs(angleBetween(lineAngle, tangentAngle)) < angleTol ||
          Math.abs(angleBetween(lineAngle, tangentAngle + Math.PI)) < angleTol) {
        constraints.push(new Constraint('tangent', [i, (i + 1) % entities.length]));
      }
    }

    if (curr.type === 'arc' && next.type === 'line') {
      const tangentAngle = Math.atan2(
        curr.end.y - curr.center.y,
        curr.end.x - curr.center.x
      ) + Math.PI / 2;
      const lineAngle = next.angle;
      if (Math.abs(angleBetween(lineAngle, tangentAngle)) < angleTol ||
          Math.abs(angleBetween(lineAngle, tangentAngle + Math.PI)) < angleTol) {
        constraints.push(new Constraint('tangent', [i, (i + 1) % entities.length]));
      }
    }

    if (curr.type === 'arc' && next.type === 'arc') {
      // Tangent arcs: tangent directions at junction aligned
      const t1 = Math.atan2(curr.end.y - curr.center.y, curr.end.x - curr.center.x) + Math.PI / 2;
      const t2 = Math.atan2(next.start.y - next.center.y, next.start.x - next.center.x) + Math.PI / 2;
      if (Math.abs(angleBetween(t1, t2)) < angleTol ||
          Math.abs(angleBetween(t1, t2 + Math.PI)) < angleTol) {
        constraints.push(new Constraint('tangent', [i, (i + 1) % entities.length]));
      }

      // Concentric arcs: same center
      if (dist(curr.center, next.center) < tol) {
        constraints.push(new Constraint('concentric', [i, (i + 1) % entities.length]));
      }
    }

    // Horizontal / Vertical lines
    if (curr.type === 'line') {
      const angle = curr.angle;
      if (Math.abs(Math.sin(angle)) < Math.sin(angleTol)) {
        constraints.push(new Constraint('horizontal', [i]));
      }
      if (Math.abs(Math.cos(angle)) < Math.sin(angleTol)) {
        constraints.push(new Constraint('vertical', [i]));
      }
    }

    // Equal radius arcs
    if (curr.type === 'arc') {
      for (let j = i + 1; j < entities.length; j++) {
        if (entities[j].type === 'arc') {
          if (Math.abs(curr.radius - entities[j].radius) / Math.max(curr.radius, entities[j].radius) < 0.02) {
            constraints.push(new Constraint('equal_radius', [i, j]));
          }
        }
      }
    }

    // Perpendicular consecutive lines
    if (curr.type === 'line' && next.type === 'line') {
      const diff = Math.abs(angleBetween(curr.angle, next.angle));
      if (Math.abs(diff - Math.PI / 2) < angleTol) {
        constraints.push(new Constraint('perpendicular', [i, (i + 1) % entities.length]));
      }
    }

    // Collinear consecutive lines
    if (curr.type === 'line' && next.type === 'line') {
      const diff = Math.abs(angleBetween(curr.angle, next.angle));
      if (diff < angleTol || Math.abs(diff - Math.PI) < angleTol) {
        constraints.push(new Constraint('collinear', [i, (i + 1) % entities.length]));
      }
    }
  }

  return constraints;
}

// ═══════════════════════════════════════════════════════════════
// Pattern Detection
// ═══════════════════════════════════════════════════════════════

/**
 * Given a set of features (with centers and radii), detect:
 * - Circular patterns (N features equally spaced on a circle)
 * - Linear patterns (N features equally spaced along a line)
 * - Mirror symmetry
 */
function detectPatterns(features) {
  const patterns = [];

  // Group similar features (same type + similar radius)
  const groups = groupSimilarFeatures(features);

  for (const group of groups) {
    if (group.length < 3) continue;

    // Try circular pattern
    const circPat = tryCircularPattern(group);
    if (circPat) {
      patterns.push(circPat);
      continue;
    }

    // Try linear pattern
    const linPat = tryLinearPattern(group);
    if (linPat) {
      patterns.push(linPat);
      continue;
    }
  }

  // Try mirror on all features
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

  // Compute centroid of all centers
  const cx = group.reduce((s, f) => s + f.center[0], 0) / group.length;
  const cy = group.reduce((s, f) => s + f.center[1], 0) / group.length;

  // Check if all features are at same distance from centroid
  const dists = group.map(f => Math.sqrt((f.center[0] - cx) ** 2 + (f.center[1] - cy) ** 2));
  const avgDist = dists.reduce((a, b) => a + b, 0) / dists.length;

  if (avgDist < 1) return null; // too small to be a pattern

  const maxDev = Math.max(...dists.map(d => Math.abs(d - avgDist)));
  if (maxDev / avgDist > 0.05) return null; // not on a circle

  // Check if angles are equally spaced
  const angles = group.map(f => Math.atan2(f.center[1] - cy, f.center[0] - cx));
  angles.sort((a, b) => a - b);

  const expectedStep = (2 * Math.PI) / group.length;
  let isEquallySpaced = true;

  for (let i = 0; i < angles.length; i++) {
    const next = (i + 1) % angles.length;
    let gap = angles[next] - angles[i];
    if (gap < 0) gap += 2 * Math.PI;
    if (Math.abs(gap - expectedStep) / expectedStep > 0.10) {
      isEquallySpaced = false;
      break;
    }
  }

  if (!isEquallySpaced) return null;

  const pat = new CircularPattern(
    { x: cx, y: cy },
    group.length,
    group.map(f => f._idx)
  );
  pat.radius = avgDist;
  return pat;
}

function tryLinearPattern(group) {
  if (group.length < 3) return null;

  // Sort by X, check if Y is constant and X spacing is uniform
  const sorted = [...group].sort((a, b) => a.center[0] - b.center[0]);
  const spacings = [];
  for (let i = 1; i < sorted.length; i++) {
    spacings.push(dist(
      { x: sorted[i].center[0], y: sorted[i].center[1] },
      { x: sorted[i-1].center[0], y: sorted[i-1].center[1] }
    ));
  }
  const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
  const maxDev = Math.max(...spacings.map(s => Math.abs(s - avgSpacing)));

  if (maxDev / avgSpacing > 0.10) return null;

  const dir = {
    x: sorted[sorted.length-1].center[0] - sorted[0].center[0],
    y: sorted[sorted.length-1].center[1] - sorted[0].center[1]
  };
  const dirLen = Math.sqrt(dir.x ** 2 + dir.y ** 2);
  dir.x /= dirLen;
  dir.y /= dirLen;

  return new LinearPattern(dir, avgSpacing, group.length, group.map(f => f._idx));
}

function tryMirrorDetection(features) {
  // Try mirror about X=cx and Y=cy
  if (features.length < 2) return null;

  const cx = features.reduce((s, f) => s + f.center[0], 0) / features.length;
  const cy = features.reduce((s, f) => s + f.center[1], 0) / features.length;

  // Try vertical mirror: X=cx
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
        used.add(i);
        used.add(j);
        break;
      }
    }
  }

  if (pairs.length >= 2) {
    return new MirrorPattern(
      { x: cx, y: cy },
      { x: 0, y: 1 },
      pairs
    );
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// Reconstruction Error Metric
// ═══════════════════════════════════════════════════════════════

/**
 * Given original contour points and fitted entities, compute
 * how well the fit reconstructs the original.
 * Returns: { maxError, avgError, coverage }
 */
function reconstructionError(originalPts, entities) {
  if (entities.length === 0) return { maxError: Infinity, avgError: Infinity, coverage: 0 };

  // Sample points along all entities to create reconstructed contour
  const reconstructed = sampleEntities(entities, originalPts.length * 2);

  // For each original point, find closest point on reconstruction
  let sumErr = 0, maxErr = 0, covered = 0;

  for (const orig of originalPts) {
    let minDist = Infinity;
    for (const rec of reconstructed) {
      const d = dist(orig, rec);
      if (d < minDist) minDist = d;
    }
    sumErr += minDist;
    maxErr = Math.max(maxErr, minDist);
    if (minDist < 1) covered++; // within 1 unit
  }

  return {
    maxError: maxErr,
    avgError: sumErr / originalPts.length,
    coverage: covered / originalPts.length,
  };
}

/**
 * Sample N points along a sequence of entities.
 */
function sampleEntities(entities, totalSamples) {
  const points = [];
  const totalLength = entities.reduce((s, e) => {
    if (e.type === 'line') return s + e.length;
    if (e.type === 'arc') return s + e.arcLength;
    return s;
  }, 0);

  for (const entity of entities) {
    const len = entity.type === 'line' ? entity.length : entity.arcLength;
    const n = Math.max(2, Math.round(totalSamples * len / totalLength));

    if (entity.type === 'line') {
      for (let i = 0; i <= n; i++) {
        points.push(lerp(entity.start, entity.end, i / n));
      }
    } else if (entity.type === 'arc') {
      let sweep = entity.endAngle - entity.startAngle;
      while (sweep < 0) sweep += 2 * Math.PI;
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
// Slicer (reused from ct-scan-test.cjs, minimal)
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
  switch (comp) {
    case 0: return attr.getX(idx);
    case 1: return attr.getY(idx);
    case 2: return attr.getZ(idx);
    default: return 0;
  }
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

  // Chain segments
  const EPS = 1e-6;
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
      .slice(0, 3) // 3 files for now
      .map(f => path.join(nistDir, f));
  }

  console.log(`\n🔧 Sketch Fitting Test — ${files.length} archivos\n`);

  for (const file of files) {
    const name = path.basename(file, '.stp');
    console.log('═'.repeat(70));
    console.log(`📐 ${name}`);
    console.log('═'.repeat(70));

    const meshes = await loadStepFile(file);

    // Merge all geometries
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

    const bb = merged.boundingBox;
    const sizeX = bb.max.x - bb.min.x;
    const sizeY = bb.max.y - bb.min.y;
    const sizeZ = bb.max.z - bb.min.z;
    console.log(`  Size: ${sizeX.toFixed(1)} × ${sizeY.toFixed(1)} × ${sizeZ.toFixed(1)}\n`);

    // Take some representative slices and fit each contour
    const axes = ['Z', 'X', 'Y'];
    const sizes = [sizeZ, sizeX, sizeY];
    const mins = [bb.min.z, bb.min.x, bb.min.y];

    let totalContours = 0;
    let totalEntities = 0;
    let totalConstraints = 0;
    let totalOrigPoints = 0;
    let totalReconPoints = 0;
    let worstError = 0;
    let sumAvgError = 0;
    let errorSamples = 0;

    for (let ai = 0; ai < 3; ai++) {
      const axis = axes[ai];
      const lo = mins[ai];
      const range = sizes[ai];

      // Take 10 evenly-spaced slices
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

          const { entities, constraints } = fitContour(contour.points);

          totalEntities += entities.length;
          totalConstraints += constraints.length;

          // Compute reconstruction error
          const err = reconstructionError(contour.points, entities);
          worstError = Math.max(worstError, err.maxError);
          sumAvgError += err.avgError;
          errorSamples++;

          // Count entity types
          const lines = entities.filter(e => e.type === 'line').length;
          const arcs = entities.filter(e => e.type === 'arc').length;
          const fullCircles = entities.filter(e => e.type === 'arc' && e.isFullCircle).length;

          // Constraint types
          const tangents = constraints.filter(c => c.type === 'tangent').length;
          const perps = constraints.filter(c => c.type === 'perpendicular').length;
          const horiz = constraints.filter(c => c.type === 'horizontal').length;
          const vert = constraints.filter(c => c.type === 'vertical').length;
          const eqRad = constraints.filter(c => c.type === 'equal_radius').length;

          const reductionPct = ((1 - entities.length / contour.points.length) * 100).toFixed(0);

          // Show if interesting
          if (entities.length > 0 && contour.area > 10) {
            const areaStr = contour.area > 1000 ? `${(contour.area / 1000).toFixed(1)}K` : contour.area.toFixed(0);
            totalReconPoints += entities.length;
            console.log(`    ${axis}=${val.toFixed(1)} | ${contour.points.length}pts → ${entities.length} entities (${lines}L ${arcs}A${fullCircles > 0 ? ' '+fullCircles+'⊙' : ''}) ${reductionPct}% reducción | err: avg=${err.avgError.toFixed(3)} max=${err.maxError.toFixed(3)} cov=${(err.coverage*100).toFixed(0)}% | ${constraints.length} constraints (${tangents}T ${perps}⊥ ${horiz}H ${vert}V ${eqRad}=R) | area=${areaStr}`);

            // Print entity detail for first interesting contour per axis
            if (totalContours <= 5 || entities.length <= 8) {
              for (const e of entities) {
                console.log(`      ${e.toString()}`);
              }
              if (constraints.length > 0) {
                console.log(`      Constraints: ${constraints.map(c => c.toString()).join(', ')}`);
              }
            }
          }
        }
      }
      console.log();
    }

    // Summary
    console.log(`  📊 RESUMEN ${name}:`);
    console.log(`     Contornos analizados: ${totalContours}`);
    console.log(`     Puntos originales: ${totalOrigPoints} → ${totalEntities} entities (${((1 - totalEntities / totalOrigPoints) * 100).toFixed(0)}% reducción)`);
    console.log(`     Constraints detectados: ${totalConstraints}`);
    console.log(`     Error reconstrucción: avg=${(sumAvgError / Math.max(1, errorSamples)).toFixed(4)}, worst=${worstError.toFixed(4)}`);
    console.log();
  }

  // ═══ Pattern detection on features ═══
  console.log('═'.repeat(70));
  console.log('🔄 PATTERN DETECTION TEST');
  console.log('═'.repeat(70));

  // Use the first file to test pattern detection on features from CT-scan
  const mesh0 = await loadStepFile(files[0]);
  const allP = [], allI = [];
  let off = 0;
  for (const m of mesh0) {
    const pos = m.geometry.getAttribute('position');
    const idx = m.geometry.getIndex();
    for (let i = 0; i < pos.count; i++) allP.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (idx) for (let i = 0; i < idx.count; i++) allI.push(idx.array[i] + off);
    else for (let i = 0; i < pos.count; i++) allI.push(i + off);
    off += pos.count;
  }
  const fullGeo = new BufferGeometry();
  fullGeo.setAttribute('position', new BufferAttribute(new Float32Array(allP), 3));
  fullGeo.setIndex(new BufferAttribute(new Uint32Array(allI), 1));
  fullGeo.computeBoundingBox();

  // Do a Z-slice at mid-height to get holes for pattern detection
  const bbf = fullGeo.boundingBox;
  const midZ = (bbf.min.z + bbf.max.z) / 2;
  const sliceResult = sliceMesh(fullGeo, 'Z', midZ);

  // Build pseudo-features from contours with holes
  const holeContours = sliceResult.contours.filter(c => c.signedArea < 0 && c.isCircular);
  console.log(`\n  Z=${midZ.toFixed(1)}: ${sliceResult.contours.length} contornos, ${holeContours.length} agujeros circulares`);

  if (holeContours.length >= 3) {
    const pseudoFeatures = holeContours.map((c, i) => ({
      type: 'hole',
      center: [c.centroid.x, c.centroid.y, midZ],
      radius: c.circleRadius,
      _idx: i,
    }));

    const patterns = detectPatterns(pseudoFeatures);
    console.log(`  Patterns detectados: ${patterns.length}`);
    for (const p of patterns) {
      console.log(`    ${p.toString()}`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ Sketch fitting experiment complete');
  console.log('═'.repeat(70));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
