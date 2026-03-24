/**
 * ⚒️ La Forja de Hefestos — STEP Real-Parts Precision Test
 * ==========================================================
 * Loads ALL .stp files from models/step/, slices them across 3 axes,
 * fits contours using the IMPROVED algorithm (Gauss-Newton, analytical error),
 * and reports per-file + global precision metrics.
 *
 * This is THE definitive test: real industrial parts, real tessellation noise.
 *
 * Usage:
 *   node scripts/sketch-fit-step-test.cjs              # all files
 *   node scripts/sketch-fit-step-test.cjs path/to.stp  # specific file
 *
 * Algorithm must be kept in sync with src/lib/sketch-fitting.ts
 */

const fs = require('fs');
const path = require('path');
const occtFactory = require('occt-import-js');

// ═══════════════════════════════════════════════════════════════
// Minimal Three.js polyfill
// ═══════════════════════════════════════════════════════════════
class BufferAttribute {
  constructor(array, itemSize) {
    this.array = array; this.itemSize = itemSize; this.count = array.length / itemSize;
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
// Utility Functions
// ═══════════════════════════════════════════════════════════════

function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }
function lerp(a, b, t) { return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }; }
function cross2D(a, b) { return a.x * b.y - a.y * b.x; }

function angleBetween(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

function pointToSegmentDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-20) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function lineDistToPoint(start, end, p) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-12) return dist(p, start);
  return Math.abs(dy * p.x - dx * p.y + end.x * start.y - end.y * start.x) / len;
}

function lineAngle(start, end) { return Math.atan2(end.y - start.y, end.x - start.x); }
function lineLength(start, end) { return dist(start, end); }

// ═══════════════════════════════════════════════════════════════
// Circle Fitting (Kasa + Gauss-Newton Geometric Refinement)
// ═══════════════════════════════════════════════════════════════

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

function solve3x3(A, b) {
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

function refineCircleGeometric(points, initial, maxIter = 25) {
  let cx = initial.center.x, cy = initial.center.y, r = initial.radius;
  const n = points.length;
  for (let iter = 0; iter < maxIter; iter++) {
    let JtJ00 = 0, JtJ01 = 0, JtJ02 = 0, JtJ11 = 0, JtJ12 = 0, JtJ22 = 0;
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

function projectOntoCircle(pt, center, radius) {
  const dx = pt.x - center.x, dy = pt.y - center.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-15) return { x: center.x + radius, y: center.y };
  return { x: center.x + (dx / d) * radius, y: center.y + (dy / d) * radius };
}

function circleFrom3Points(p1, p2, p3) {
  const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
  if (Math.abs(d) < 1e-10) return null;
  const ux = ((p1.x ** 2 + p1.y ** 2) * (p2.y - p3.y) + (p2.x ** 2 + p2.y ** 2) * (p3.y - p1.y) + (p3.x ** 2 + p3.y ** 2) * (p1.y - p2.y)) / d;
  const uy = ((p1.x ** 2 + p1.y ** 2) * (p3.x - p2.x) + (p2.x ** 2 + p2.y ** 2) * (p1.x - p3.x) + (p3.x ** 2 + p3.y ** 2) * (p2.x - p1.x)) / d;
  return { center: { x: ux, y: uy }, radius: dist({ x: ux, y: uy }, p1) };
}

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
// Core Fitting (synced with sketch-fitting.ts)
// ═══════════════════════════════════════════════════════════════

function bboxOf(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function computeSweep(startAngle, endAngle, midAngle) {
  let sweepCCW = endAngle - startAngle;
  while (sweepCCW <= 0) sweepCCW += 2 * Math.PI;
  let midCCW = midAngle - startAngle;
  while (midCCW <= 0) midCCW += 2 * Math.PI;
  if (midCCW <= sweepCCW) return sweepCCW;
  return -(2 * Math.PI - sweepCCW);
}

function makeArc(center, radius, sa, ea, startPt, endPt) {
  const sweep = ea - sa;
  return { type: 'arc', center, radius, startAngle: sa, endAngle: ea, start: startPt, end: endPt, isFullCircle: Math.abs(sweep) > Math.PI * 1.95 };
}
function makeLine(start, end) { return { type: 'line', start: { ...start }, end: { ...end } }; }

function sweepAngle(arc) {
  let s = arc.endAngle - arc.startAngle;
  while (s > 2 * Math.PI) s -= 2 * Math.PI;
  while (s < -2 * Math.PI) s += 2 * Math.PI;
  return s;
}
function arcLength(arc) { return arc.radius * Math.abs(sweepAngle(arc)); }

function fitContour(pts, tolerance) {
  if (pts.length < 3) return { entities: [], constraints: [] };
  const cleaned = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (dist(pts[i], cleaned[cleaned.length - 1]) > 1e-6) cleaned.push(pts[i]);
  }
  if (cleaned.length > 2 && dist(cleaned[0], cleaned[cleaned.length - 1]) < 1e-6) cleaned.pop();
  if (cleaned.length < 3) return { entities: [], constraints: [] };
  const n = cleaned.length;
  const bbox = bboxOf(cleaned);
  const diag = Math.sqrt((bbox.maxX - bbox.minX) ** 2 + (bbox.maxY - bbox.minY) ** 2);
  const tol = tolerance ?? Math.max(0.001, diag * 0.0001);

  // Phase 0: Full circle with geometric refinement
  const kasaFit0 = fitCircle(cleaned);
  if (kasaFit0 && kasaFit0.radius < diag * 2) {
    const circleFit = refineCircleGeometric(cleaned, kasaFit0);
    if (circleFit.maxError < tol) {
      const arc = makeArc(circleFit.center, circleFit.radius, 0, 2 * Math.PI, cleaned[0], cleaned[0]);
      return { entities: [arc], constraints: [] };
    }
  }

  // Phase 1: Open at max curvature discontinuity
  const kappa = new Float64Array(n);
  for (let i = 0; i < n; i++) kappa[i] = localCurvature(cleaned, i);
  let maxJump = -1, openIdx = 0;
  for (let i = 0; i < n; i++) {
    const jump = Math.abs(kappa[i] - kappa[(i + 1) % n]);
    if (jump > maxJump) { maxJump = jump; openIdx = (i + 1) % n; }
  }
  const openPts = [];
  for (let i = 0; i < n; i++) openPts.push(cleaned[(openIdx + i) % n]);

  // Phase 2: Recursive subdivision
  const entities = recursiveFit(openPts, 0, openPts.length - 1, tol, 0);

  // Phase 3: Post-merge
  const merged = mergeEntities(entities, tol);

  // Phase 4: Snap endpoints
  for (let i = 0; i < merged.length; i++) {
    const curr = merged[i];
    const next = merged[(i + 1) % merged.length];
    if (!curr || !next) continue;
    const gap = dist(getEnd(curr), getStart(next));
    if (gap > tol * 20) continue;
    let mid = lerp(getEnd(curr), getStart(next), 0.5);
    if (curr.type === 'arc' && !curr.isFullCircle) {
      mid = projectOntoCircle(mid, curr.center, curr.radius);
    } else if (next.type === 'arc' && !next.isFullCircle) {
      mid = projectOntoCircle(mid, next.center, next.radius);
    }
    setEnd(curr, mid);
    setStart(next, mid);
  }

  // Phase 5: Constraints
  const constraints = detectConstraints(merged, tol);
  return { entities: merged, constraints };
}

function recursiveFit(pts, start, end, tol, depth) {
  const count = end - start + 1;
  if (count <= 1) return [];
  if (count === 2) {
    if (dist(pts[start], pts[end]) < tol * 0.01) return [];
    return [makeLine(pts[start], pts[end])];
  }
  const sub = [];
  for (let i = start; i <= end; i++) sub.push(pts[i]);
  const kasaFit = fitCircle(sub);
  if (kasaFit) {
    const circFit = refineCircleGeometric(sub, kasaFit);
    if (circFit.maxError < tol) {
      const chordLen = dist(pts[start], pts[end]);
      const isCloseLoop = chordLen < tol * 2;
      if (isCloseLoop && count >= 6) {
        return [makeArc(circFit.center, circFit.radius, 0, 2 * Math.PI, pts[start], pts[start])];
      }
      const sa = Math.atan2(pts[start].y - circFit.center.y, pts[start].x - circFit.center.x);
      const ea = Math.atan2(pts[end].y - circFit.center.y, pts[end].x - circFit.center.x);
      const midIdx = Math.floor((start + end) / 2);
      const ma = Math.atan2(pts[midIdx].y - circFit.center.y, pts[midIdx].x - circFit.center.x);
      const sweep = computeSweep(sa, ea, ma);
      const sweepDeg = Math.abs(sweep) * 180 / Math.PI;
      if (sweepDeg > 5 && circFit.radius < chordLen * 10) {
        const startPt = projectOntoCircle(pts[start], circFit.center, circFit.radius);
        const endPt = projectOntoCircle(pts[end], circFit.center, circFit.radius);
        return [makeArc(circFit.center, circFit.radius, sa, sa + sweep, startPt, endPt)];
      }
    }
  }
  let maxDev = 0, maxDevIdx = start;
  for (let i = start + 1; i < end; i++) {
    const d = pointToSegmentDist(pts[i], pts[start], pts[end]);
    if (d > maxDev) { maxDev = d; maxDevIdx = i; }
  }
  if (maxDev < tol) {
    if (dist(pts[start], pts[end]) < tol * 0.01) return [];
    return [makeLine(pts[start], pts[end])];
  }
  if (depth > 50) return [makeLine(pts[start], pts[end])];
  const left = recursiveFit(pts, start, maxDevIdx, tol, depth + 1);
  const right = recursiveFit(pts, maxDevIdx, end, tol, depth + 1);
  return [...left, ...right];
}

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
      if (prev.type === 'line' && curr.type === 'line') {
        const mergedLine = makeLine(prev.start, curr.end);
        const midDev = lineDistToPoint(prev.start, curr.end, prev.end);
        if (midDev < tol * 0.3 && lineLength(prev.start, curr.end) > 0.001) {
          next[next.length - 1] = mergedLine;
          changed = true;
          continue;
        }
      }
      if (prev.type === 'arc' && curr.type === 'arc') {
        const centerDist = dist(prev.center, curr.center);
        const radiusDiff = Math.abs(prev.radius - curr.radius);
        if (centerDist < tol * 0.3 && radiusDiff < tol * 0.3) {
          const avgCenter = lerp(prev.center, curr.center, 0.5);
          const avgRadius = (prev.radius + curr.radius) / 2;
          const combinedSweep = sweepAngle(prev) + sweepAngle(curr);
          const newArc = makeArc(avgCenter, avgRadius, prev.startAngle, prev.startAngle + combinedSweep, prev.start, curr.end);
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

function getStart(e) { return e.start; }
function getEnd(e) { return e.end; }
function setStart(e, pt) {
  e.start = { ...pt };
  if (e.type === 'arc' && !e.isFullCircle) {
    const raw = Math.atan2(pt.y - e.center.y, pt.x - e.center.x);
    let best = raw, bestDiff = Math.abs(raw - e.startAngle);
    for (const c of [raw + 2 * Math.PI, raw - 2 * Math.PI]) {
      if (Math.abs(c - e.startAngle) < bestDiff) { best = c; bestDiff = Math.abs(c - e.startAngle); }
    }
    e.startAngle = best;
  }
}
function setEnd(e, pt) {
  e.end = { ...pt };
  if (e.type === 'arc' && !e.isFullCircle) {
    const raw = Math.atan2(pt.y - e.center.y, pt.x - e.center.x);
    let best = raw, bestDiff = Math.abs(raw - e.endAngle);
    for (const c of [raw + 2 * Math.PI, raw - 2 * Math.PI]) {
      if (Math.abs(c - e.endAngle) < bestDiff) { best = c; bestDiff = Math.abs(c - e.endAngle); }
    }
    e.endAngle = best;
  }
}

function detectConstraints(entities, tol) {
  const constraints = [];
  const angleTol = 2 * Math.PI / 180;
  for (let i = 0; i < entities.length; i++) {
    const curr = entities[i];
    const next = entities[(i + 1) % entities.length];
    if (curr.type === 'line' && next.type === 'arc') {
      const la = lineAngle(curr.start, curr.end);
      const ta = Math.atan2(curr.end.y - next.center.y, curr.end.x - next.center.x) + Math.PI / 2;
      if (Math.abs(angleBetween(la, ta)) < angleTol || Math.abs(angleBetween(la, ta + Math.PI)) < angleTol)
        constraints.push({ type: 'tangent', entities: [i, (i + 1) % entities.length] });
    }
    if (curr.type === 'arc' && next.type === 'line') {
      const ta = Math.atan2(curr.end.y - curr.center.y, curr.end.x - curr.center.x) + Math.PI / 2;
      const la = lineAngle(next.start, next.end);
      if (Math.abs(angleBetween(la, ta)) < angleTol || Math.abs(angleBetween(la, ta + Math.PI)) < angleTol)
        constraints.push({ type: 'tangent', entities: [i, (i + 1) % entities.length] });
    }
    if (curr.type === 'line') {
      const a = lineAngle(curr.start, curr.end);
      if (Math.abs(Math.sin(a)) < Math.sin(angleTol)) constraints.push({ type: 'horizontal', entities: [i] });
      if (Math.abs(Math.cos(a)) < Math.sin(angleTol)) constraints.push({ type: 'vertical', entities: [i] });
    }
    if (curr.type === 'line' && next.type === 'line') {
      const diff = Math.abs(angleBetween(lineAngle(curr.start, curr.end), lineAngle(next.start, next.end)));
      if (Math.abs(diff - Math.PI / 2) < angleTol)
        constraints.push({ type: 'perpendicular', entities: [i, (i + 1) % entities.length] });
    }
  }
  return constraints;
}

// ═══════════════════════════════════════════════════════════════
// Analytical Reconstruction Error (same as sketch-fitting.ts)
// ═══════════════════════════════════════════════════════════════

function pointToArcDist(p, arc) {
  const dx = p.x - arc.center.x, dy = p.y - arc.center.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const circleDist = Math.abs(d - arc.radius);
  if (arc.isFullCircle) return circleDist;
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
  return Math.min(dist(p, arc.start), dist(p, arc.end));
}

function pointToEntityDist(p, entity) {
  if (entity.type === 'line') return pointToSegmentDist(p, entity.start, entity.end);
  return pointToArcDist(p, entity);
}

function reconstructionError(originalPts, entities) {
  if (entities.length === 0) return { maxError: Infinity, avgError: Infinity, coverage: 0 };
  let sumErr = 0, maxErr = 0, covered = 0;
  for (const orig of originalPts) {
    let minDist = Infinity;
    for (const e of entities) {
      const d = pointToEntityDist(orig, e);
      if (d < minDist) minDist = d;
    }
    sumErr += minDist;
    maxErr = Math.max(maxErr, minDist);
    if (minDist < 0.1) covered++;
  }
  return { maxError: maxErr, avgError: sumErr / originalPts.length, coverage: covered / originalPts.length };
}

// ═══════════════════════════════════════════════════════════════
// Slicer (from cross-section.ts)
// ═══════════════════════════════════════════════════════════════

function shoelaceArea(pts) {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function getComp(attr, idx, comp) {
  return comp === 0 ? attr.getX(idx) : comp === 1 ? attr.getY(idx) : attr.getZ(idx);
}

function sliceMesh(geo, axis, value) {
  const posAttr = geo.getAttribute('position');
  const idxAttr = geo.getIndex();
  if (!posAttr) return { contours: [] };
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
  if (segments.length === 0) return { contours: [] };

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
    if (chain.length >= 6) {
      contours.push({ points: chain, area: Math.abs(shoelaceArea(chain)) });
    }
  }
  return { contours };
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
// Collect STEP files
// ═══════════════════════════════════════════════════════════════

function collectStepFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...collectStepFiles(full));
    else if (/\.(stp|step)$/i.test(e.name)) files.push(full);
  }
  return files;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const modelsDir = path.join(__dirname, '..', 'models', 'step');

  let files;
  if (args.length > 0) {
    files = args.map(a => path.resolve(a));
  } else {
    files = collectStepFiles(modelsDir).sort();
  }

  // Skip .prt, .sat files (only .stp/.step)
  files = files.filter(f => /\.(stp|step)$/i.test(f));

  console.log('═'.repeat(72));
  console.log('⚒️  La Forja — STEP Real-Parts Precision Test');
  console.log(`   ${files.length} archivos STEP | Algoritmo: Gauss-Newton + analytical error`);
  console.log('═'.repeat(72));
  console.log();

  const NUM_SLICES = 8; // per axis
  const globalStats = {
    files: 0, contours: 0, entities: 0, lines: 0, arcs: 0, circles: 0, constraints: 0,
    origPts: 0, worstErr: 0, sumAvgErr: 0, errSamples: 0,
    pass01: 0, pass001: 0, totalContoursFitted: 0,
  };

  const fileResults = [];

  for (const file of files) {
    const name = path.basename(file);
    const relPath = path.relative(modelsDir, file);
    process.stdout.write(`  📐 ${relPath}...`);

    let meshes;
    try {
      meshes = await loadStepFile(file);
    } catch (err) {
      console.log(` ❌ SKIP (${err.message})`);
      continue;
    }

    if (meshes.length === 0) {
      console.log(' ❌ SKIP (no meshes)');
      continue;
    }

    const merged = mergeGeometries(meshes);
    const bb = merged.boundingBox;
    const sizeX = bb.max.x - bb.min.x;
    const sizeY = bb.max.y - bb.min.y;
    const sizeZ = bb.max.z - bb.min.z;
    const diag = Math.sqrt(sizeX ** 2 + sizeY ** 2 + sizeZ ** 2);

    const fileStats = {
      name: relPath, contours: 0, entities: 0, lines: 0, arcs: 0, circles: 0,
      constraints: 0, origPts: 0, worstErr: 0, sumAvgErr: 0, errSamples: 0,
      pass01: 0, pass001: 0,
    };

    const axes = ['X', 'Y', 'Z'];
    const mins = [bb.min.x, bb.min.y, bb.min.z];
    const sizes = [sizeX, sizeY, sizeZ];

    for (let ai = 0; ai < 3; ai++) {
      const axis = axes[ai];
      const lo = mins[ai];
      const range = sizes[ai];

      for (let si = 0; si < NUM_SLICES; si++) {
        const t = (si + 0.5) / NUM_SLICES;
        const val = lo + range * 0.01 + t * range * 0.98;
        const result = sliceMesh(merged, axis, val);
        if (result.contours.length === 0) continue;

        for (const contour of result.contours) {
          if (contour.points.length < 6) continue;

          const { entities, constraints } = fitContour(contour.points);
          if (entities.length === 0) continue;

          const err = reconstructionError(contour.points, entities);

          fileStats.contours++;
          fileStats.origPts += contour.points.length;
          fileStats.entities += entities.length;
          fileStats.constraints += constraints.length;
          fileStats.lines += entities.filter(e => e.type === 'line').length;
          fileStats.arcs += entities.filter(e => e.type === 'arc' && !e.isFullCircle).length;
          fileStats.circles += entities.filter(e => e.type === 'arc' && e.isFullCircle).length;

          if (isFinite(err.maxError)) {
            fileStats.worstErr = Math.max(fileStats.worstErr, err.maxError);
            fileStats.sumAvgErr += err.avgError;
            fileStats.errSamples++;
            if (err.maxError < 0.1) fileStats.pass01++;
            if (err.maxError < 0.01) fileStats.pass001++;
          }
        }
      }
    }

    const avgErr = fileStats.errSamples > 0 ? fileStats.sumAvgErr / fileStats.errSamples : 0;
    const passRate01 = fileStats.errSamples > 0 ? (fileStats.pass01 / fileStats.errSamples * 100).toFixed(0) : '0';
    const passRate001 = fileStats.errSamples > 0 ? (fileStats.pass001 / fileStats.errSamples * 100).toFixed(0) : '0';
    const reduction = fileStats.origPts > 0 ? ((1 - fileStats.entities / fileStats.origPts) * 100).toFixed(0) : '0';
    const errColor = fileStats.worstErr < 0.01 ? '✅' : fileStats.worstErr < 0.1 ? '🟡' : '🔴';

    console.log(` ${errColor} ${fileStats.contours}c → ${fileStats.entities}e (${fileStats.lines}L ${fileStats.arcs}A ${fileStats.circles}⊙) | ${reduction}% | maxE=${fileStats.worstErr.toFixed(4)} avgE=${avgErr.toFixed(4)} | <0.1:${passRate01}% <0.01:${passRate001}%`);

    fileResults.push(fileStats);

    // Accumulate globals
    globalStats.files++;
    globalStats.contours += fileStats.contours;
    globalStats.entities += fileStats.entities;
    globalStats.lines += fileStats.lines;
    globalStats.arcs += fileStats.arcs;
    globalStats.circles += fileStats.circles;
    globalStats.constraints += fileStats.constraints;
    globalStats.origPts += fileStats.origPts;
    globalStats.worstErr = Math.max(globalStats.worstErr, fileStats.worstErr);
    globalStats.sumAvgErr += fileStats.sumAvgErr;
    globalStats.errSamples += fileStats.errSamples;
    globalStats.pass01 += fileStats.pass01;
    globalStats.pass001 += fileStats.pass001;

    merged.dispose();
  }

  // ═══ GLOBAL SUMMARY ═══
  const gAvg = globalStats.errSamples > 0 ? globalStats.sumAvgErr / globalStats.errSamples : 0;
  const gPass01 = globalStats.errSamples > 0 ? (globalStats.pass01 / globalStats.errSamples * 100).toFixed(1) : '0';
  const gPass001 = globalStats.errSamples > 0 ? (globalStats.pass001 / globalStats.errSamples * 100).toFixed(1) : '0';
  const gReduction = globalStats.origPts > 0 ? ((1 - globalStats.entities / globalStats.origPts) * 100).toFixed(0) : '0';

  console.log();
  console.log('═'.repeat(72));
  console.log('📊 RESUMEN GLOBAL — PIEZAS REALES');
  console.log('═'.repeat(72));
  console.log(`  Archivos STEP:    ${globalStats.files}`);
  console.log(`  Contornos:        ${globalStats.contours}`);
  console.log(`  Puntos orig:      ${globalStats.origPts} → ${globalStats.entities} entidades (${gReduction}% reducción)`);
  console.log(`  Desglose:         ${globalStats.lines}L + ${globalStats.arcs}A + ${globalStats.circles}⊙`);
  console.log(`  Constraints:      ${globalStats.constraints}`);
  console.log();
  console.log(`  🎯 PRECISIÓN:`);
  console.log(`     Max error global:  ${globalStats.worstErr.toFixed(6)}`);
  console.log(`     Avg error global:  ${gAvg.toFixed(6)}`);
  console.log(`     Contornos <0.1:    ${gPass01}% (${globalStats.pass01}/${globalStats.errSamples})`);
  console.log(`     Contornos <0.01:   ${gPass001}% (${globalStats.pass001}/${globalStats.errSamples})`);
  console.log();

  // Worst 5 files
  const sorted = fileResults.filter(f => f.errSamples > 0).sort((a, b) => b.worstErr - a.worstErr);
  if (sorted.length > 0) {
    console.log('  🔴 Top 5 peor precisión:');
    for (const f of sorted.slice(0, 5)) {
      const avg = f.errSamples > 0 ? f.sumAvgErr / f.errSamples : 0;
      console.log(`     ${f.name}: maxE=${f.worstErr.toFixed(4)} avgE=${avg.toFixed(4)} (${f.contours}c, ${f.entities}e)`);
    }
    console.log();
  }

  // Best 5 files
  if (sorted.length > 0) {
    console.log('  ✅ Top 5 mejor precisión:');
    for (const f of sorted.slice(-5).reverse()) {
      const avg = f.errSamples > 0 ? f.sumAvgErr / f.errSamples : 0;
      console.log(`     ${f.name}: maxE=${f.worstErr.toFixed(4)} avgE=${avg.toFixed(4)} (${f.contours}c, ${f.entities}e)`);
    }
    console.log();
  }

  console.log('═'.repeat(72));
  const ok = globalStats.worstErr < 0.1;
  if (ok) {
    console.log('🎉 RESULTADO: ACEPTABLE — todas las piezas reales se ajustan con error < 0.1');
  } else {
    console.log(`⚠️  RESULTADO: max error ${globalStats.worstErr.toFixed(4)} — el error de teselación limita la precisión`);
  }
  console.log('═'.repeat(72));

  process.exit(ok ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
