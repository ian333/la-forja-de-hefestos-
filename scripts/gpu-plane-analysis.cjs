/**
 * ⚒️ La Forja de Hefestos — GPU Plane Detection & Multi-Angle Analysis
 * ======================================================================
 * REAL TEST: Loads STEP files, detects feature planes from mesh normals,
 * slices on ARBITRARY planes (not just X/Y/Z), fits entities, and reports
 * concrete numbers for every plane detected.
 *
 * This is the Node.js equivalent of the GPU pipeline (gpu-cross-section.ts):
 * - detectPlanes() → ported to Node (pure math, no WebGL needed)
 * - Arbitrary-plane mesh intersection → CPU version of GPU winding render
 * - fitContour + reconstructionError → same algorithm
 *
 * Usage: node scripts/gpu-plane-analysis.cjs [specific-file.stp]
 */

const fs = require('fs');
const path = require('path');
const occtFactory = require('occt-import-js');

// ═══════════════════════════════════════════════════════════════
// Minimal polyfills (same as sketch-fit-step-test.cjs)
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
// 3D Vector math (no THREE.js dependency)
// ═══════════════════════════════════════════════════════════════

function v3(x, y, z) { return { x, y, z }; }
function v3add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function v3sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function v3scale(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
function v3dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function v3cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
function v3len(a) { return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z); }
function v3normalize(a) { const l = v3len(a); return l < 1e-15 ? v3(0, 0, 0) : v3scale(a, 1 / l); }
function v3neg(a) { return { x: -a.x, y: -a.y, z: -a.z }; }

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
// PLANE DETECTION — Port of gpu-cross-section.ts detectPlanes()
// ═══════════════════════════════════════════════════════════════

/**
 * Detect feature planes by clustering face normals.
 * Returns planes sorted by importance (face area).
 * 
 * This is the EXACT same algorithm as gpu-cross-section.ts,
 * ported to work without THREE.js.
 */
function detectPlanes(geo, maxPlanes = 12, angleTolDeg = 10) {
  const angleTol = angleTolDeg * Math.PI / 180;
  const cosAngleTol = Math.cos(angleTol);

  const posAttr = geo.getAttribute('position');
  const idxAttr = geo.getIndex();
  if (!posAttr) return { clusters: [], planes: [] };

  const numTri = idxAttr ? idxAttr.count / 3 : posAttr.count / 3;

  // ── Collect all face normals + area ──
  const faces = [];
  let totalFaceArea = 0;

  for (let t = 0; t < numTri; t++) {
    const i0 = idxAttr ? idxAttr.getX(t * 3) : t * 3;
    const i1 = idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2;

    const a = v3(posAttr.getX(i0), posAttr.getY(i0), posAttr.getZ(i0));
    const b = v3(posAttr.getX(i1), posAttr.getY(i1), posAttr.getZ(i1));
    const c = v3(posAttr.getX(i2), posAttr.getY(i2), posAttr.getZ(i2));

    const ab = v3sub(b, a);
    const ac = v3sub(c, a);
    const cross = v3cross(ab, ac);
    const area2 = v3len(cross);
    if (area2 < 1e-12) continue;

    const normal = v3scale(cross, 1 / area2);
    const center = v3scale(v3add(v3add(a, b), c), 1 / 3);
    const area = area2 * 0.5;
    totalFaceArea += area;
    faces.push({ normal, center, area });
  }

  if (faces.length === 0) return { clusters: [], planes: [] };

  // ── Greedy angular clustering ──
  const clusters = []; // { normal, offset, area, offsets[], faceCount }

  for (const f of faces) {
    let bestCluster = null;
    let bestDot = -Infinity;

    for (const cl of clusters) {
      const d = Math.abs(v3dot(f.normal, cl.normal));
      if (d > cosAngleTol && d > bestDot) {
        bestDot = d;
        bestCluster = cl;
      }
    }

    const fOffset = v3dot(f.center, f.normal);

    if (bestCluster) {
      // Flip normal if needed for consistency
      if (v3dot(f.normal, bestCluster.normal) < 0) {
        f.normal = v3neg(f.normal);
      }
      // Area-weighted average normal
      const totalArea = bestCluster.area + f.area;
      bestCluster.normal = v3normalize(v3add(
        v3scale(bestCluster.normal, bestCluster.area),
        v3scale(f.normal, f.area)
      ));
      bestCluster.offset = (bestCluster.offset * bestCluster.area + fOffset * f.area) / totalArea;
      bestCluster.area = totalArea;
      bestCluster.offsets.push(fOffset);
      bestCluster.faceCount++;
    } else {
      clusters.push({
        normal: { ...f.normal },
        offset: fOffset,
        area: f.area,
        offsets: [fOffset],
        faceCount: 1,
      });
    }
  }

  // Sort by area (most important first)
  clusters.sort((a, b) => b.area - a.area);

  // ── Compute bounding box ──
  const bb = geo.boundingBox;
  const bbCenter = v3(
    (bb.min.x + bb.max.x) / 2,
    (bb.min.y + bb.max.y) / 2,
    (bb.min.z + bb.max.z) / 2,
  );
  const bbSize = v3(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
  const bbDiag = v3len(bbSize);

  // ── Generate planes from clusters ──
  const axisVecs = [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)];
  const axisNames = ['X', 'Y', 'Z'];
  const planes = [];
  const usedNormals = [];

  // Always include 3 axis-aligned center planes
  for (let ai = 0; ai < 3; ai++) {
    const n = axisVecs[ai];
    const off = v3dot(bbCenter, n);
    planes.push({
      normal: { ...n },
      offset: off,
      area: 0,
      label: `${axisNames[ai]} Center`,
      isAxis: true,
      angle: { pitch: 0, yaw: 0 },
    });
    usedNormals.push({ ...n });
  }

  // Add cluster-derived planes (may be angled!)
  for (const cl of clusters) {
    if (planes.length >= maxPlanes) break;

    // Skip if too similar to existing
    let tooSimilar = false;
    for (const used of usedNormals) {
      if (Math.abs(v3dot(cl.normal, used)) > Math.cos(angleTol * 0.5)) {
        // Boost existing plane's area
        const existing = planes.find(p =>
          Math.abs(v3dot(p.normal, cl.normal)) > Math.cos(angleTol * 0.5)
        );
        if (existing) existing.area += cl.area;
        tooSimilar = true;
        break;
      }
    }
    if (tooSimilar) continue;

    // Ensure consistent direction
    const n = { ...cl.normal };
    if (n.x + n.y + n.z < 0) {
      n.x = -n.x; n.y = -n.y; n.z = -n.z;
    }

    // Generate label
    let label;
    const isAxisAligned = false;
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    if (ax > 0.95) label = 'YZ';
    else if (ay > 0.95) label = 'XZ';
    else if (az > 0.95) label = 'XY';
    else {
      const pitch = Math.asin(Math.max(-1, Math.min(1, n.y))) * 180 / Math.PI;
      const yaw = Math.atan2(n.x, n.z) * 180 / Math.PI;
      label = `∠${Math.round(pitch)}°/${Math.round(yaw)}°`;
    }

    // Compute angle from each axis for display
    const angleX = Math.acos(Math.min(1, Math.abs(n.x))) * 180 / Math.PI;
    const angleY = Math.acos(Math.min(1, Math.abs(n.y))) * 180 / Math.PI;
    const angleZ = Math.acos(Math.min(1, Math.abs(n.z))) * 180 / Math.PI;

    // Offset range for depth slices
    const sorted = cl.offsets.sort((a, b) => a - b);
    const minOff = sorted[0];
    const maxOff = sorted[sorted.length - 1];
    const range = maxOff - minOff;

    planes.push({
      normal: n,
      offset: cl.offset,
      area: cl.area,
      label: `${label} mid`,
      isAxis: false,
      faceCount: cl.faceCount,
      offsetRange: range,
      angle: { fromX: angleX, fromY: angleY, fromZ: angleZ },
      normalVec: `(${n.x.toFixed(3)}, ${n.y.toFixed(3)}, ${n.z.toFixed(3)})`,
    });
    usedNormals.push({ ...n });

    // Add depth slices if range is large
    if (range > bbDiag * 0.1 && planes.length + 2 <= maxPlanes) {
      planes.push({
        normal: { ...n },
        offset: minOff + range * 0.25,
        area: cl.area * 0.5,
        label: `${label} 25%`,
        isAxis: false,
        isDepthSlice: true,
      });
      planes.push({
        normal: { ...n },
        offset: minOff + range * 0.75,
        area: cl.area * 0.5,
        label: `${label} 75%`,
        isAxis: false,
        isDepthSlice: true,
      });
    }
  }

  // Add axis depth slices
  for (let ai = 0; ai < 3; ai++) {
    const n = axisVecs[ai];
    const lo = ai === 0 ? bb.min.x : ai === 1 ? bb.min.y : bb.min.z;
    const hi = ai === 0 ? bb.max.x : ai === 1 ? bb.max.y : bb.max.z;
    const range = hi - lo;
    if (range < 1e-8) continue;
    if (planes.length + 2 <= maxPlanes) {
      planes.push({
        normal: { ...n },
        offset: lo + range * 0.25,
        area: 0,
        label: `${axisNames[ai]} 25%`,
        isAxis: true,
        isDepthSlice: true,
      });
      planes.push({
        normal: { ...n },
        offset: lo + range * 0.75,
        area: 0,
        label: `${axisNames[ai]} 75%`,
        isAxis: true,
        isDepthSlice: true,
      });
    }
  }

  return {
    clusters: clusters.slice(0, 20), // top 20 for display
    planes: planes.slice(0, maxPlanes),
    totalFaces: faces.length,
    totalFaceArea,
  };
}

// ═══════════════════════════════════════════════════════════════
// ARBITRARY-PLANE MESH SLICING
// ═══════════════════════════════════════════════════════════════

/**
 * Compute orthonormal basis (U, V) for a plane with given normal.
 * U and V lie in the plane. Same as planeBasis() in gpu-cross-section.ts.
 */
function planeBasis(normal) {
  const n = v3normalize(normal);
  const up = Math.abs(n.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0);
  const u = v3normalize(v3cross(up, n));
  const v = v3normalize(v3cross(n, u));
  return { u, v };
}

/**
 * Slice a mesh with an ARBITRARY plane defined by (normal, offset).
 * Returns contours in the plane's local 2D coordinate system.
 *
 * This is the CPU equivalent of the GPU winding-number render.
 * The plane equation is: dot(position, normal) = offset
 */
function sliceArbitraryPlane(geo, planeNormal, planeOffset) {
  const posAttr = geo.getAttribute('position');
  const idxAttr = geo.getIndex();
  if (!posAttr) return { contours: [], basis: null };

  const numTri = idxAttr ? idxAttr.count / 3 : posAttr.count / 3;
  const n = v3normalize(planeNormal);
  const { u, v } = planeBasis(n);

  // Origin point on the plane
  const planeOrigin = v3scale(n, planeOffset);

  const segments = [];

  for (let t = 0; t < numTri; t++) {
    const i0 = idxAttr ? idxAttr.getX(t * 3) : t * 3;
    const i1 = idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2;

    const p0 = v3(posAttr.getX(i0), posAttr.getY(i0), posAttr.getZ(i0));
    const p1 = v3(posAttr.getX(i1), posAttr.getY(i1), posAttr.getZ(i1));
    const p2 = v3(posAttr.getX(i2), posAttr.getY(i2), posAttr.getZ(i2));

    // Signed distance from plane
    const d0 = v3dot(p0, n) - planeOffset;
    const d1 = v3dot(p1, n) - planeOffset;
    const d2 = v3dot(p2, n) - planeOffset;

    const verts = [
      { pos: p0, d: d0 },
      { pos: p1, d: d1 },
      { pos: p2, d: d2 },
    ];

    // Find intersection points
    const pts3D = [];
    for (let e = 0; e < 3; e++) {
      const a = verts[e], b = verts[(e + 1) % 3];
      if ((a.d > 0) !== (b.d > 0)) {
        const tt = a.d / (a.d - b.d);
        pts3D.push(v3add(a.pos, v3scale(v3sub(b.pos, a.pos), tt)));
      } else if (Math.abs(a.d) < 1e-12) {
        pts3D.push(a.pos);
      }
    }

    if (pts3D.length >= 2) {
      // Project onto plane's 2D coordinate system
      const rel0 = v3sub(pts3D[0], planeOrigin);
      const rel1 = v3sub(pts3D[1], planeOrigin);
      segments.push([
        { x: v3dot(rel0, u), y: v3dot(rel0, v) },
        { x: v3dot(rel1, u), y: v3dot(rel1, v) },
      ]);
    }
  }

  if (segments.length === 0) return { contours: [], basis: { u, v, origin: planeOrigin } };

  // Chain segments into contours (same algorithm)
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
      const area = shoelaceArea(chain);
      contours.push({ points: chain, area: Math.abs(area), signedArea: area });
    }
  }

  return { contours, basis: { u, v, origin: planeOrigin }, segmentCount: segments.length };
}

function shoelaceArea(pts) {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

// ═══════════════════════════════════════════════════════════════
// Sketch Fitting (same as other tests — copied for standalone)
// ═══════════════════════════════════════════════════════════════

function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }
function lineAngle(s, e) { return Math.atan2(e.y - s.y, e.x - s.x); }
function lineLength(s, e) { return dist(s, e); }

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

function fitCircle(points) {
  if (points.length < 3) return null;
  let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0;
  let sumX3 = 0, sumY3 = 0, sumX2Y = 0, sumXY2 = 0;
  const n = points.length;
  for (const p of points) {
    sumX += p.x; sumY += p.y;
    sumX2 += p.x * p.x; sumY2 += p.y * p.y; sumXY += p.x * p.y;
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
  const a = A.map(r => [...r]); const x = [...b];
  for (let col = 0; col < 3; col++) {
    let mv = Math.abs(a[col][col]), mr = col;
    for (let r = col + 1; r < 3; r++) { if (Math.abs(a[r][col]) > mv) { mv = Math.abs(a[r][col]); mr = r; } }
    if (mv < 1e-15) return null;
    if (mr !== col) { [a[col], a[mr]] = [a[mr], a[col]]; [x[col], x[mr]] = [x[mr], x[col]]; }
    for (let r = col + 1; r < 3; r++) { const f = a[r][col] / a[col][col]; for (let j = col; j < 3; j++) a[r][j] -= f * a[col][j]; x[r] -= f * x[col]; }
  }
  const res = [0, 0, 0];
  for (let i = 2; i >= 0; i--) { let s = x[i]; for (let j = i + 1; j < 3; j++) s -= a[i][j] * res[j]; if (Math.abs(a[i][i]) < 1e-15) return null; res[i] = s / a[i][i]; }
  return res;
}

function refineCircleGeometric(points, initial, maxIter = 25) {
  let cx = initial.center.x, cy = initial.center.y, r = initial.radius;
  const n = points.length;
  for (let iter = 0; iter < maxIter; iter++) {
    let J00 = 0, J01 = 0, J02 = 0, J11 = 0, J12 = 0, J22 = 0;
    let r0 = 0, r1 = 0, r2 = 0;
    for (const p of points) {
      const dx = p.x - cx, dy = p.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1e-15) continue;
      const res = d - r;
      const j0 = -dx / d, j1 = -dy / d, j2 = -1;
      J00 += j0 * j0; J01 += j0 * j1; J02 += j0 * j2;
      J11 += j1 * j1; J12 += j1 * j2; J22 += j2 * j2;
      r0 += j0 * res; r1 += j1 * res; r2 += j2 * res;
    }
    const delta = solve3x3([[J00, J01, J02], [J01, J11, J12], [J02, J12, J22]], [-r0, -r1, -r2]);
    if (!delta) break;
    cx += delta[0]; cy += delta[1]; r += delta[2];
    if (Math.sqrt(delta[0] ** 2 + delta[1] ** 2 + delta[2] ** 2) < 1e-14) break;
  }
  r = Math.abs(r);
  let maxErr = 0, sumErr = 0;
  for (const p of points) { const err = Math.abs(dist(p, { x: cx, y: cy }) - r); maxErr = Math.max(maxErr, err); sumErr += err; }
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

// ═══════════════════════════════════════════════════════════════
// fitContour — minimal version (same algo as sketch-fitting.ts)
// ═══════════════════════════════════════════════════════════════

function fitContour(points, tolerance) {
  if (!tolerance) tolerance = 0.5;
  const n = points.length;
  if (n < 3) return { entities: [], constraints: [] };
  const perim = points.reduce((s, p, i) => s + (i < n - 1 ? dist(p, points[i + 1]) : dist(p, points[0])), 0);
  const diag = perim / Math.PI;
  const tol = tolerance || Math.max(0.001, diag * 0.0001);
  const circFit = fitCircle(points);
  if (circFit) {
    const refined = refineCircleGeometric(points, circFit);
    let maxD = 0;
    for (const p of points) maxD = Math.max(maxD, Math.abs(dist(p, refined.center) - refined.radius));
    if (maxD < tol * 2) {
      const projected = points.map(p => projectOntoCircle(p, refined.center, refined.radius));
      return {
        entities: [{ type: 'arc', center: refined.center, radius: refined.radius, startAngle: 0, endAngle: 2 * Math.PI, start: projected[0], end: projected[0], isFullCircle: true }],
        constraints: [],
      };
    }
  }
  // Segmented fitting
  const entities = [], constraints = [];
  const angles = points.map((p, i) => {
    const prev = points[(i - 1 + n) % n], next = points[(i + 1) % n];
    const a1 = Math.atan2(p.y - prev.y, p.x - prev.x);
    const a2 = Math.atan2(next.y - p.y, next.x - p.x);
    return Math.abs(angleBetween(a1, a2));
  });
  const corners = [0];
  const cornerThreshold = 0.15;
  for (let i = 0; i < n; i++) {
    if (angles[i] > cornerThreshold && i !== 0) corners.push(i);
  }
  if (corners.length < 2) corners.push(Math.floor(n / 2));

  for (let ci = 0; ci < corners.length; ci++) {
    const from = corners[ci];
    const to = corners[(ci + 1) % corners.length];
    const segment = [];
    if (from <= to) { for (let i = from; i <= to; i++) segment.push(points[i]); }
    else { for (let i = from; i < n; i++) segment.push(points[i]); for (let i = 0; i <= to; i++) segment.push(points[i]); }
    if (segment.length < 2) continue;

    // Try arc fit
    if (segment.length >= 5) {
      const mid = Math.floor(segment.length / 2);
      const c3 = circleFrom3Points(segment[0], segment[mid], segment[segment.length - 1]);
      if (c3) {
        const refined = refineCircleGeometric(segment, c3);
        let maxD = 0;
        for (const p of segment) maxD = Math.max(maxD, Math.abs(dist(p, refined.center) - refined.radius));
        if (maxD < tol * 3) {
          const s = segment[0], e = segment[segment.length - 1];
          const sa = Math.atan2(s.y - refined.center.y, s.x - refined.center.x);
          const ea = Math.atan2(e.y - refined.center.y, e.x - refined.center.x);
          entities.push({ type: 'arc', center: refined.center, radius: refined.radius, startAngle: sa, endAngle: ea, start: projectOntoCircle(s, refined.center, refined.radius), end: projectOntoCircle(e, refined.center, refined.radius), isFullCircle: false });
          continue;
        }
      }
    }

    // Line fit
    const s = segment[0], e = segment[segment.length - 1];
    let maxD = 0;
    for (const p of segment) maxD = Math.max(maxD, lineDistToPoint(s, e, p));
    if (maxD < tol * 2) {
      entities.push({ type: 'line', start: s, end: e });
    } else {
      // Split into sub-segments
      const half = Math.floor(segment.length / 2);
      entities.push({ type: 'line', start: segment[0], end: segment[half] });
      entities.push({ type: 'line', start: segment[half], end: segment[segment.length - 1] });
    }
  }

  // Constraints
  for (let i = 0; i < entities.length; i++) {
    const cur = entities[i], next = entities[(i + 1) % entities.length];
    const ep = cur.type === 'line' ? cur.end : cur.end;
    const sp = next.type === 'line' ? next.start : next.start;
    if (dist(ep, sp) < tol * 5) {
      constraints.push({ type: 'coincident', entityA: i, entityB: (i + 1) % entities.length, pointA: 'end', pointB: 'start' });
    }
  }

  return { entities, constraints };
}

function reconstructionError(originalPts, entities, tol) {
  if (entities.length === 0 || originalPts.length === 0) return { maxError: Infinity, avgError: Infinity, coverage: 0 };
  let maxE = 0, sumE = 0, covered = 0;
  for (const pt of originalPts) {
    let minD = Infinity;
    for (const ent of entities) {
      let d;
      if (ent.type === 'line') {
        d = pointToSegmentDist(pt, ent.start, ent.end);
      } else {
        const dd = dist(pt, ent.center);
        d = Math.abs(dd - ent.radius);
      }
      if (d < minD) minD = d;
    }
    maxE = Math.max(maxE, minD);
    sumE += minD;
    if (minD < (tol || 0.5)) covered++;
  }
  return { maxError: maxE, avgError: sumE / originalPts.length, coverage: covered / originalPts.length };
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
// MAIN — The real test
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
  files = files.filter(f => /\.(stp|step)$/i.test(f));

  console.log('═'.repeat(80));
  console.log('⚒️  La Forja — GPU PLANE DETECTION & MULTI-ANGLE ANALYSIS');
  console.log('   Real STEP files → Plane Detection → Arbitrary-Angle Slicing → Fitting');
  console.log('═'.repeat(80));
  console.log();

  // Global accumulators
  const globalStats = {
    files: 0,
    totalFaces: 0,
    totalClusters: 0,
    totalPlanes: 0,
    axisPlanes: 0,
    angledPlanes: 0,
    totalContours: 0,
    totalEntities: 0,
    totalLines: 0,
    totalArcs: 0,
    totalCircles: 0,
    worstErr: 0,
    sumAvgErr: 0,
    errSamples: 0,
    pass01: 0,
    pass001: 0,
    angledContours: 0,
    angledEntities: 0,
    angledWorstErr: 0,
    angledPass01: 0,
    angledPass001: 0,
    angledErrSamples: 0,
  };

  for (const file of files) {
    const relPath = path.relative(modelsDir, file);
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📐 ${relPath}`);
    console.log(`${'─'.repeat(80)}`);

    let meshes;
    try {
      meshes = await loadStepFile(file);
    } catch (err) {
      console.log(`  ❌ SKIP: ${err.message}`);
      continue;
    }
    if (meshes.length === 0) {
      console.log('  ❌ SKIP: no meshes');
      continue;
    }

    const merged = mergeGeometries(meshes);
    const bb = merged.boundingBox;
    const size = v3(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
    const diag = v3len(size);

    // ── STEP 1: Detect planes ──
    const { clusters, planes, totalFaces, totalFaceArea } = detectPlanes(merged, 12, 10);

    console.log(`  📦 Bounding box: ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} mm  (diag: ${diag.toFixed(2)})`);
    console.log(`  🔺 Triangles: ${totalFaces}  |  Total face area: ${totalFaceArea.toFixed(1)} mm²`);
    console.log(`  📊 Normal clusters found: ${clusters.length}`);
    console.log();

    // Show top clusters
    console.log('  ┌─ NORMAL CLUSTERS (top 10 by area) ─────────────────────────────────');
    for (let ci = 0; ci < Math.min(10, clusters.length); ci++) {
      const cl = clusters[ci];
      const n = cl.normal;
      const pct = (cl.area / totalFaceArea * 100).toFixed(1);
      const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
      let type;
      if (ax > 0.95) type = '≈ X-axis';
      else if (ay > 0.95) type = '≈ Y-axis';
      else if (az > 0.95) type = '≈ Z-axis';
      else {
        const pitch = Math.asin(Math.max(-1, Math.min(1, n.y))) * 180 / Math.PI;
        const yaw = Math.atan2(n.x, n.z) * 180 / Math.PI;
        type = `ANGLED ∠${Math.round(pitch)}°/${Math.round(yaw)}°`;
      }
      console.log(`  │  #${ci + 1}  Normal=(${n.x.toFixed(3)}, ${n.y.toFixed(3)}, ${n.z.toFixed(3)})  ` +
        `Area=${cl.area.toFixed(1)}mm² (${pct}%)  Faces=${cl.faceCount}  ${type}`);
    }
    if (clusters.length > 10) console.log(`  │  ... +${clusters.length - 10} more clusters`);
    console.log('  └' + '─'.repeat(70));
    console.log();

    // ── Show detected planes ──
    const axisCount = planes.filter(p => p.isAxis).length;
    const angledCount = planes.filter(p => !p.isAxis).length;

    console.log(`  🎯 DETECTED PLANES: ${planes.length} total (${axisCount} axis-aligned, ${angledCount} angled)`);
    console.log('  ┌─ PLANE LIST ──────────────────────────────────────────────────────');
    for (let pi = 0; pi < planes.length; pi++) {
      const p = planes[pi];
      const n = p.normal;
      const tag = p.isAxis ? '📏' : '📐';
      const depthTag = p.isDepthSlice ? ' [depth]' : '';
      const normalStr = `(${n.x.toFixed(3)}, ${n.y.toFixed(3)}, ${n.z.toFixed(3)})`;
      const extraInfo = p.normalVec ? `  Normal=${p.normalVec}` : '';
      console.log(`  │  ${tag} #${pi + 1}  "${p.label}"${depthTag}  offset=${p.offset.toFixed(2)}  area=${p.area.toFixed(1)}mm²${extraInfo}`);
    }
    console.log('  └' + '─'.repeat(70));
    console.log();

    globalStats.files++;
    globalStats.totalFaces += totalFaces;
    globalStats.totalClusters += clusters.length;
    globalStats.totalPlanes += planes.length;
    globalStats.axisPlanes += axisCount;
    globalStats.angledPlanes += angledCount;

    // ── STEP 2: Slice on each detected plane ──
    console.log('  🔪 SLICING RESULTS PER PLANE:');
    const tol = Math.max(0.001, diag * 0.0001);

    for (let pi = 0; pi < planes.length; pi++) {
      const p = planes[pi];
      const { contours, segmentCount } = sliceArbitraryPlane(merged, p.normal, p.offset);

      if (contours.length === 0) {
        console.log(`     #${pi + 1} "${p.label}" → 0 contours (${segmentCount || 0} segments, no closed loops)`);
        continue;
      }

      // Fit each contour
      let planeEntities = 0, planeLines = 0, planeArcs = 0, planeCircles = 0;
      let planeMaxErr = 0, planeAvgErr = 0, planeFitCount = 0;
      let planePass01 = 0, planePass001 = 0;
      let planePts = 0;

      for (const c of contours) {
        if (c.points.length < 6) continue;
        const { entities } = fitContour(c.points, tol);
        if (entities.length === 0) continue;
        const err = reconstructionError(c.points, entities, tol);

        planeEntities += entities.length;
        planeLines += entities.filter(e => e.type === 'line').length;
        planeArcs += entities.filter(e => e.type === 'arc' && !e.isFullCircle).length;
        planeCircles += entities.filter(e => e.type === 'arc' && e.isFullCircle).length;
        planePts += c.points.length;

        if (isFinite(err.maxError)) {
          planeMaxErr = Math.max(planeMaxErr, err.maxError);
          planeAvgErr += err.avgError;
          planeFitCount++;
          if (err.maxError < 0.1) planePass01++;
          if (err.maxError < 0.01) planePass001++;
        }
      }

      const avgE = planeFitCount > 0 ? planeAvgErr / planeFitCount : 0;
      const errIcon = planeMaxErr < 0.01 ? '✅' : planeMaxErr < 0.1 ? '🟡' : '🔴';
      const tag = p.isAxis ? '' : ' 📐ANGLED';

      console.log(`     #${pi + 1} "${p.label}"${tag} → ${contours.length}c ${planePts}pts → ${planeEntities}e (${planeLines}L ${planeArcs}A ${planeCircles}⊙) | ${errIcon} maxE=${planeMaxErr.toFixed(4)} avgE=${avgE.toFixed(4)}`);

      // Accumulate
      globalStats.totalContours += contours.length;
      globalStats.totalEntities += planeEntities;
      globalStats.totalLines += planeLines;
      globalStats.totalArcs += planeArcs;
      globalStats.totalCircles += planeCircles;
      globalStats.worstErr = Math.max(globalStats.worstErr, planeMaxErr);
      globalStats.sumAvgErr += planeAvgErr;
      globalStats.errSamples += planeFitCount;
      globalStats.pass01 += planePass01;
      globalStats.pass001 += planePass001;

      if (!p.isAxis) {
        globalStats.angledContours += contours.length;
        globalStats.angledEntities += planeEntities;
        globalStats.angledWorstErr = Math.max(globalStats.angledWorstErr, planeMaxErr);
        globalStats.angledErrSamples += planeFitCount;
        globalStats.angledPass01 += planePass01;
        globalStats.angledPass001 += planePass001;
      }
    }

    merged.dispose();
  }

  // ═══ GLOBAL SUMMARY ═══
  console.log();
  console.log('═'.repeat(80));
  console.log('📊 RESUMEN GLOBAL — DETECCIÓN DE PLANOS & ANÁLISIS MULTI-ÁNGULO');
  console.log('═'.repeat(80));
  console.log();
  console.log(`  📁 Archivos STEP:        ${globalStats.files}`);
  console.log(`  🔺 Triángulos totales:    ${globalStats.totalFaces}`);
  console.log(`  📊 Clusters de normales:  ${globalStats.totalClusters} (promedio ${(globalStats.totalClusters / globalStats.files).toFixed(1)}/pieza)`);
  console.log();
  console.log(`  🎯 PLANOS DETECTADOS:`);
  console.log(`     Total:                 ${globalStats.totalPlanes}`);
  console.log(`     Axis-aligned (X/Y/Z):  ${globalStats.axisPlanes}`);
  console.log(`     ANGULADOS:             ${globalStats.angledPlanes} ← NUEVA CAPACIDAD`);
  console.log(`     Promedio por pieza:    ${(globalStats.totalPlanes / globalStats.files).toFixed(1)}`);
  console.log();
  console.log(`  🔪 CORTES:`);
  console.log(`     Contornos totales:     ${globalStats.totalContours}`);
  console.log(`     Entidades totales:     ${globalStats.totalEntities} (${globalStats.totalLines}L ${globalStats.totalArcs}A ${globalStats.totalCircles}⊙)`);
  console.log();

  const gAvg = globalStats.errSamples > 0 ? globalStats.sumAvgErr / globalStats.errSamples : 0;
  const gP01 = globalStats.errSamples > 0 ? (globalStats.pass01 / globalStats.errSamples * 100).toFixed(1) : '0';
  const gP001 = globalStats.errSamples > 0 ? (globalStats.pass001 / globalStats.errSamples * 100).toFixed(1) : '0';

  console.log(`  🎯 PRECISIÓN GLOBAL:`);
  console.log(`     Max error:             ${globalStats.worstErr.toFixed(6)}`);
  console.log(`     Avg error:             ${gAvg.toFixed(6)}`);
  console.log(`     Contornos <0.1:        ${gP01}% (${globalStats.pass01}/${globalStats.errSamples})`);
  console.log(`     Contornos <0.01:       ${gP001}% (${globalStats.pass001}/${globalStats.errSamples})`);
  console.log();

  // Angled-only stats
  if (globalStats.angledErrSamples > 0) {
    const aP01 = (globalStats.angledPass01 / globalStats.angledErrSamples * 100).toFixed(1);
    const aP001 = (globalStats.angledPass001 / globalStats.angledErrSamples * 100).toFixed(1);
    console.log(`  📐 PLANOS ANGULADOS (solo):`);
    console.log(`     Contornos:             ${globalStats.angledContours}`);
    console.log(`     Entidades:             ${globalStats.angledEntities}`);
    console.log(`     Max error:             ${globalStats.angledWorstErr.toFixed(6)}`);
    console.log(`     Contornos <0.1:        ${aP01}% (${globalStats.angledPass01}/${globalStats.angledErrSamples})`);
    console.log(`     Contornos <0.01:       ${aP001}% (${globalStats.angledPass001}/${globalStats.angledErrSamples})`);
    console.log();
  } else {
    console.log(`  📐 PLANOS ANGULADOS: Ninguno detectado en estas piezas (geometría primariamente axis-aligned)`);
    console.log();
  }

  console.log('═'.repeat(80));
  console.log('💡 NOTA: Estos resultados usan CPU mesh-plane intersection.');
  console.log('   La versión GPU (winding-number render) produce contornos MÁS LIMPIOS');
  console.log('   porque no sufre de ruido de teselación en los bordes.');
  console.log('═'.repeat(80));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
