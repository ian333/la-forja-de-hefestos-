/**
 * ⚒️ La Forja de Hefestos — Sketch Fitting Precision Test Suite
 * ================================================================
 * Tests the sketch fitting algorithm against synthetic shapes with
 * KNOWN geometry. Asserts that maxError < 0.01 for all shapes.
 *
 * This embeds the improved fitting algorithm (Kasa + Gauss-Newton
 * geometric refinement, projection onto circles, tighter tolerance).
 *
 * Usage: node scripts/sketch-fit-precision-test.cjs
 *
 * NOTE: Algorithm must be kept in sync with src/lib/sketch-fitting.ts
 */

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
// Core Fitting
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
  return {
    type: 'arc', center, radius,
    startAngle: sa, endAngle: ea,
    start: startPt, end: endPt,
    isFullCircle: Math.abs(sweep) > Math.PI * 1.95,
  };
}

function makeLine(start, end) {
  return { type: 'line', start: { ...start }, end: { ...end } };
}

function sweepAngle(arc) {
  let s = arc.endAngle - arc.startAngle;
  while (s > 2 * Math.PI) s -= 2 * Math.PI;
  while (s < -2 * Math.PI) s += 2 * Math.PI;
  return s;
}

function arcLength(arc) {
  return arc.radius * Math.abs(sweepAngle(arc));
}

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

  // Phase 0: Full circle test with geometric refinement
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

  // Phase 4: Snap endpoints — project onto circles for sub-tol precision
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

  // Phase 5: Detect constraints
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

  // Try arc/circle fit with Gauss-Newton geometric refinement
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

  // Try line fit
  let maxDev = 0, maxDevIdx = start;
  for (let i = start + 1; i < end; i++) {
    const d = pointToSegmentDist(pts[i], pts[start], pts[end]);
    if (d > maxDev) { maxDev = d; maxDevIdx = i; }
  }
  if (maxDev < tol) {
    if (dist(pts[start], pts[end]) < tol * 0.01) return [];
    return [makeLine(pts[start], pts[end])];
  }

  // Split
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
    if (curr.type === 'arc' && next.type === 'arc') {
      const t1 = Math.atan2(curr.end.y - curr.center.y, curr.end.x - curr.center.x) + Math.PI / 2;
      const t2 = Math.atan2(next.start.y - next.center.y, next.start.x - next.center.x) + Math.PI / 2;
      if (Math.abs(angleBetween(t1, t2)) < angleTol || Math.abs(angleBetween(t1, t2 + Math.PI)) < angleTol)
        constraints.push({ type: 'tangent', entities: [i, (i + 1) % entities.length] });
      if (dist(curr.center, next.center) < tol)
        constraints.push({ type: 'concentric', entities: [i, (i + 1) % entities.length] });
    }
    if (curr.type === 'line') {
      const a = lineAngle(curr.start, curr.end);
      if (Math.abs(Math.sin(a)) < Math.sin(angleTol))
        constraints.push({ type: 'horizontal', entities: [i] });
      if (Math.abs(Math.cos(a)) < Math.sin(angleTol))
        constraints.push({ type: 'vertical', entities: [i] });
    }
    if (curr.type === 'arc') {
      for (let j = i + 1; j < entities.length; j++) {
        if (entities[j].type === 'arc' && Math.abs(curr.radius - entities[j].radius) / Math.max(curr.radius, entities[j].radius) < 0.02)
          constraints.push({ type: 'equal_radius', entities: [i, j] });
      }
    }
    if (curr.type === 'line' && next.type === 'line') {
      const diff = Math.abs(angleBetween(lineAngle(curr.start, curr.end), lineAngle(next.start, next.end)));
      if (Math.abs(diff - Math.PI / 2) < angleTol)
        constraints.push({ type: 'perpendicular', entities: [i, (i + 1) % entities.length] });
      if (diff < angleTol || Math.abs(diff - Math.PI) < angleTol)
        constraints.push({ type: 'collinear', entities: [i, (i + 1) % entities.length] });
    }
  }
  return constraints;
}

// ═══════════════════════════════════════════════════════════════
// Reconstruction Error (analytical point-to-entity distance)
// ═══════════════════════════════════════════════════════════════

function pointToArcDist(p, arc) {
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
  // Outside arc span — use distance to nearest endpoint
  return Math.min(dist(p, arc.start), dist(p, arc.end));
}

function pointToEntityDist(p, entity) {
  if (entity.type === 'line') return pointToSegmentDist(p, entity.start, entity.end);
  return pointToArcDist(p, entity);
}

function reconstructionError(originalPts, entities, tol) {
  if (entities.length === 0) return { maxError: Infinity, avgError: Infinity, coverage: 0 };
  let sumErr = 0, maxErr = 0, covered = 0;
  const coverageThreshold = tol || 1;
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
  return { maxError: maxErr, avgError: sumErr / originalPts.length, coverage: covered / originalPts.length };
}

// ═══════════════════════════════════════════════════════════════
// SHAPE GENERATORS — generate Point2D arrays for known geometries
// ═══════════════════════════════════════════════════════════════

/** Generate points on a perfect circle */
function genCircle(cx, cy, r, nPts = 200) {
  const pts = [];
  for (let i = 0; i < nPts; i++) {
    const a = (i / nPts) * 2 * Math.PI;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/** Generate points on a perfect rectangle */
function genRectangle(cx, cy, w, h, ptsPerSide = 50) {
  const pts = [];
  const hw = w / 2, hh = h / 2;
  // Bottom edge: left to right
  for (let i = 0; i < ptsPerSide; i++) pts.push({ x: cx - hw + w * (i / ptsPerSide), y: cy - hh });
  // Right edge: bottom to top
  for (let i = 0; i < ptsPerSide; i++) pts.push({ x: cx + hw, y: cy - hh + h * (i / ptsPerSide) });
  // Top edge: right to left
  for (let i = 0; i < ptsPerSide; i++) pts.push({ x: cx + hw - w * (i / ptsPerSide), y: cy + hh });
  // Left edge: top to bottom
  for (let i = 0; i < ptsPerSide; i++) pts.push({ x: cx - hw, y: cy + hh - h * (i / ptsPerSide) });
  return pts;
}

/** Generate rounded rectangle (4 sides + 4 corner arcs) */
function genRoundedRect(cx, cy, w, h, r, ptsPerSide = 40, ptsPerArc = 20) {
  const pts = [];
  const hw = w / 2 - r, hh = h / 2 - r;
  // Bottom edge
  for (let i = 0; i <= ptsPerSide; i++) pts.push({ x: cx - hw + 2 * hw * (i / ptsPerSide), y: cy - hh - r });
  // Bottom-right arc
  for (let i = 1; i <= ptsPerArc; i++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * (i / ptsPerArc);
    pts.push({ x: cx + hw + r * Math.cos(a), y: cy - hh + r * Math.sin(a) });
  }
  // Right edge
  for (let i = 1; i <= ptsPerSide; i++) pts.push({ x: cx + hw + r, y: cy - hh + 2 * hh * (i / ptsPerSide) });
  // Top-right arc
  for (let i = 1; i <= ptsPerArc; i++) {
    const a = 0 + (Math.PI / 2) * (i / ptsPerArc);
    pts.push({ x: cx + hw + r * Math.cos(a), y: cy + hh + r * Math.sin(a) });
  }
  // Top edge
  for (let i = 1; i <= ptsPerSide; i++) pts.push({ x: cx + hw - 2 * hw * (i / ptsPerSide), y: cy + hh + r });
  // Top-left arc
  for (let i = 1; i <= ptsPerArc; i++) {
    const a = Math.PI / 2 + (Math.PI / 2) * (i / ptsPerArc);
    pts.push({ x: cx - hw + r * Math.cos(a), y: cy + hh + r * Math.sin(a) });
  }
  // Left edge
  for (let i = 1; i <= ptsPerSide; i++) pts.push({ x: cx - hw - r, y: cy + hh - 2 * hh * (i / ptsPerSide) });
  // Bottom-left arc
  for (let i = 1; i < ptsPerArc; i++) {
    const a = Math.PI + (Math.PI / 2) * (i / ptsPerArc);
    pts.push({ x: cx - hw + r * Math.cos(a), y: cy - hh + r * Math.sin(a) });
  }
  return pts;
}

/** Generate L-shape (6 lines) */
function genLShape(ptsPerSide = 30) {
  const pts = [];
  // Outer L: 0,0 → 60,0 → 60,25 → 25,25 → 25,50 → 0,50 → 0,0
  const corners = [
    { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 25 },
    { x: 25, y: 25 }, { x: 25, y: 50 }, { x: 0, y: 50 },
  ];
  for (let s = 0; s < corners.length; s++) {
    const a = corners[s], b = corners[(s + 1) % corners.length];
    for (let i = 0; i < ptsPerSide; i++) {
      const t = i / ptsPerSide;
      pts.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    }
  }
  return pts;
}

/** Generate a semicircle + diameter line */
function genSemicircle(cx, cy, r, nPtsArc = 100, nPtsLine = 50) {
  const pts = [];
  // Arc from 0 to π
  for (let i = 0; i <= nPtsArc; i++) {
    const a = (i / nPtsArc) * Math.PI;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  // Line from (-r,0) back to (r,0)
  for (let i = 1; i < nPtsLine; i++) {
    const t = i / nPtsLine;
    pts.push({ x: cx - r + 2 * r * t, y: cy });
  }
  return pts;
}

/** Generate a slot shape (2 semicircles + 2 lines) */
function genSlot(cx, cy, length, r, nPtsArc = 40, nPtsLine = 30) {
  const pts = [];
  const halfL = length / 2 - r;
  // Bottom line: left to right
  for (let i = 0; i <= nPtsLine; i++) pts.push({ x: cx - halfL + 2 * halfL * (i / nPtsLine), y: cy - r });
  // Right semicircle
  for (let i = 1; i <= nPtsArc; i++) {
    const a = -Math.PI / 2 + Math.PI * (i / nPtsArc);
    pts.push({ x: cx + halfL + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  // Top line: right to left
  for (let i = 1; i <= nPtsLine; i++) pts.push({ x: cx + halfL - 2 * halfL * (i / nPtsLine), y: cy + r });
  // Left semicircle
  for (let i = 1; i < nPtsArc; i++) {
    const a = Math.PI / 2 + Math.PI * (i / nPtsArc);
    pts.push({ x: cx - halfL + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/** Generate a quarter-circle arc + two straight edges (pie slice) */
function genQuarterPie(cx, cy, r, nPtsArc = 60, nPtsLine = 20) {
  const pts = [];
  // Arc from 0 to π/2
  for (let i = 0; i <= nPtsArc; i++) {
    const a = (i / nPtsArc) * Math.PI / 2;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  // Line from (cx, cy+r) to center
  for (let i = 1; i <= nPtsLine; i++) pts.push({ x: cx, y: cy + r - r * (i / nPtsLine) });
  // Line from center to (cx+r, cy)
  for (let i = 1; i < nPtsLine; i++) pts.push({ x: cx + r * (i / nPtsLine), y: cy });
  return pts;
}

/** Generate hexagon */
function genHexagon(cx, cy, r, ptsPerSide = 25) {
  const pts = [];
  for (let s = 0; s < 6; s++) {
    const a1 = (s / 6) * 2 * Math.PI;
    const a2 = ((s + 1) / 6) * 2 * Math.PI;
    const p1 = { x: cx + r * Math.cos(a1), y: cy + r * Math.sin(a1) };
    const p2 = { x: cx + r * Math.cos(a2), y: cy + r * Math.sin(a2) };
    for (let i = 0; i < ptsPerSide; i++) {
      const t = i / ptsPerSide;
      pts.push({ x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) });
    }
  }
  return pts;
}

/** Generate noisy circle (simulates tessellation error) */
function genNoisyCircle(cx, cy, r, noise, nPts = 200) {
  const pts = [];
  for (let i = 0; i < nPts; i++) {
    const a = (i / nPts) * 2 * Math.PI;
    const rn = r + (Math.random() - 0.5) * 2 * noise;
    pts.push({ x: cx + rn * Math.cos(a), y: cy + rn * Math.sin(a) });
  }
  return pts;
}

// ═══════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════

const TARGET_MAX_ERROR = 0.01;
let passed = 0, failed = 0, totalTests = 0;

function runTest(name, pts, expectedEntities, opts = {}) {
  totalTests++;
  const targetErr = opts.targetMaxError ?? TARGET_MAX_ERROR;
  const tol = opts.tolerance;

  const { entities, constraints } = fitContour(pts, tol);
  const err = reconstructionError(pts, entities, targetErr);

  const lines = entities.filter(e => e.type === 'line').length;
  const arcs = entities.filter(e => e.type === 'arc' && !e.isFullCircle).length;
  const circles = entities.filter(e => e.type === 'arc' && e.isFullCircle).length;

  const ok = err.maxError < targetErr && isFinite(err.maxError);
  const entityCountOk = expectedEntities === null || entities.length === expectedEntities;

  const status = ok ? '✅' : '❌';
  const entityStatus = entityCountOk ? '' : ` ⚠ expected ${expectedEntities} entities, got ${entities.length}`;

  console.log(`  ${status} ${name}`);
  console.log(`     ${pts.length}pts → ${entities.length}e (${lines}L ${arcs}A ${circles}⊙) | ${constraints.length} constraints`);
  console.log(`     maxErr=${err.maxError.toFixed(6)} avgErr=${err.avgError.toFixed(6)} cov=${(err.coverage * 100).toFixed(1)}%${entityStatus}`);

  if (ok) {
    passed++;
  } else {
    failed++;
    console.log(`     ⛔ FAIL: maxError ${err.maxError.toFixed(6)} > target ${targetErr}`);
    // Print first few entities for debugging
    for (const e of entities.slice(0, 5)) {
      if (e.type === 'line') {
        console.log(`       Line(${e.start.x.toFixed(3)},${e.start.y.toFixed(3)} → ${e.end.x.toFixed(3)},${e.end.y.toFixed(3)}, L=${lineLength(e.start, e.end).toFixed(3)})`);
      } else {
        const deg = (a) => (a * 180 / Math.PI).toFixed(1);
        console.log(`       Arc(c=${e.center.x.toFixed(3)},${e.center.y.toFixed(3)} r=${e.radius.toFixed(3)} ${deg(e.startAngle)}°→${deg(e.endAngle)}° full=${e.isFullCircle})`);
      }
    }
  }

  return { ok, err, entities, constraints };
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

function main() {
  console.log('═'.repeat(70));
  console.log('⚒️  La Forja — Sketch Fitting Precision Test Suite');
  console.log(`Target: maxError < ${TARGET_MAX_ERROR}`);
  console.log('═'.repeat(70));
  console.log();

  // ── 1. Perfect Circle ──
  console.log('── 1. CIRCLES ──');
  runTest('Circle R=25 centered at (50,50)', genCircle(50, 50, 25, 200), 1);
  runTest('Circle R=5 centered at (0,0)', genCircle(0, 0, 5, 100), 1);
  runTest('Circle R=100 centered at (100,100)', genCircle(100, 100, 100, 400), 1);
  runTest('Small circle R=1', genCircle(10, 10, 1, 60), 1);
  console.log();

  // ── 2. Rectangles ──
  console.log('── 2. RECTANGLES ──');
  runTest('Rectangle 50×30', genRectangle(0, 0, 50, 30, 50), 4);
  runTest('Square 20×20', genRectangle(25, 25, 20, 20, 40), 4);
  runTest('Tall rectangle 10×80', genRectangle(0, 0, 10, 80, 60), 4);
  runTest('Wide rectangle 100×5', genRectangle(50, 0, 100, 5, 80), 4);
  console.log();

  // ── 3. Rounded Rectangles ──
  console.log('── 3. ROUNDED RECTANGLES ──');
  runTest('Rounded rect 60×40 R=5', genRoundedRect(0, 0, 60, 40, 5), 8);
  runTest('Rounded rect 30×30 R=3', genRoundedRect(15, 15, 30, 30, 3), 8);
  runTest('Rounded rect 100×20 R=8', genRoundedRect(50, 10, 100, 20, 8), null);
  console.log();

  // ── 4. L-Shapes ──
  console.log('── 4. L-SHAPES ──');
  runTest('L-shape (6 edges)', genLShape(30), 6);
  runTest('L-shape fine (60 pts/side)', genLShape(60), 6);
  console.log();

  // ── 5. Semicircles ──
  console.log('── 5. SEMICIRCLES ──');
  runTest('Semicircle R=20', genSemicircle(0, 0, 20, 100, 50), null);
  runTest('Semicircle R=50', genSemicircle(50, 50, 50, 200, 80), null);
  console.log();

  // ── 6. Slots ──
  console.log('── 6. SLOTS ──');
  runTest('Slot L=40 R=8', genSlot(0, 0, 40, 8, 40, 30), null);
  runTest('Slot L=80 R=15', genSlot(40, 20, 80, 15, 60, 50), null);
  console.log();

  // ── 7. Pie Slices ──
  console.log('── 7. PIE SLICES ──');
  runTest('Quarter pie R=30', genQuarterPie(0, 0, 30, 60, 20), null);
  runTest('Quarter pie R=10', genQuarterPie(10, 10, 10, 40, 15), null);
  console.log();

  // ── 8. Hexagons ──
  console.log('── 8. HEXAGONS ──');
  runTest('Hexagon R=20', genHexagon(0, 0, 20, 25), 6);
  runTest('Hexagon R=50', genHexagon(50, 50, 50, 40), 6);
  console.log();

  // ── 9. Noisy Shapes (simulating tessellation) ──
  console.log('── 9. NOISY (simulating tessellation) ──');
  runTest('Noisy circle R=25 noise=0.005', genNoisyCircle(50, 50, 25, 0.005, 200), 1, { targetMaxError: 0.02 });
  runTest('Noisy circle R=25 noise=0.001', genNoisyCircle(50, 50, 25, 0.001, 200), 1);
  console.log();

  // ── 10. Edge Cases ──
  console.log('── 10. EDGE CASES ──');
  // Triangle with points along edges
  const triPts = [];
  const triCorners = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 8.66 }];
  for (let s = 0; s < 3; s++) {
    const a = triCorners[s], b = triCorners[(s + 1) % 3];
    for (let i = 0; i < 30; i++) triPts.push(lerp(a, b, i / 30));
  }
  runTest('Triangle (90 pts)', triPts, 3);
  // Very thin ellipse-like closed shape (nearly collinear)
  const thinShape = [];
  for (let i = 0; i < 100; i++) {
    const a = (i / 100) * 2 * Math.PI;
    thinShape.push({ x: 50 * Math.cos(a), y: 0.1 * Math.sin(a) });
  }
  runTest('Thin ellipse 100×0.2 (non-arc geometry)', thinShape, null, { targetMaxError: 0.05 });
  console.log();

  // ═══ SUMMARY ═══
  console.log('═'.repeat(70));
  console.log(`📊 RESULTS: ${passed}/${totalTests} passed, ${failed} failed`);
  console.log(`   Target: maxError < ${TARGET_MAX_ERROR}`);
  if (failed === 0) {
    console.log('   🎉 ALL TESTS PASSED — precision target achieved!');
  } else {
    console.log(`   ⚠️  ${failed} test(s) need attention`);
  }
  console.log('═'.repeat(70));

  process.exit(failed > 0 ? 1 : 0);
}

main();
