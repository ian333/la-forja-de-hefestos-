/**
 * ⚒️ La Forja de Hefestos — CT CONTINUOUS SWEEP vs DISCRETE PLANES
 * ==================================================================
 * Answers the question: "Is continuous scanning better than discrete planes?"
 *
 * Two strategies compared:
 *
 * 1. DISCRETE (current): detectPlanes() → normal clustering → ~12 planes
 *    - Smart: finds planes where geometry EXISTS
 *    - But MISSES features between detected planes
 *
 * 2. CONTINUOUS (CT scan): sweep plane 0°→180° in small steps
 *    - Dumb: uniformly samples ALL orientations
 *    - But MISSES NOTHING — every angle is covered
 *    - Like a medical CT scanner
 *
 * The test sweeps at 1°, 2°, 5°, 10°, 30° and shows:
 *    - How many NEW contours appear vs discrete
 *    - How error changes with angular resolution
 *    - The convergence curve: where does more resolution stop helping?
 *
 * Usage: node scripts/ct-continuous-sweep.cjs [file.stp]
 *        node scripts/ct-continuous-sweep.cjs        (runs 1 example file)
 */

const fs = require('fs');
const path = require('path');
const occtFactory = require('occt-import-js');

// ═══════════════════════════════════════════════════════════════
// Polyfills
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
// 3D Vector math
// ═══════════════════════════════════════════════════════════════

function v3(x, y, z) { return { x, y, z }; }
function v3add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function v3sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function v3scale(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
function v3dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function v3cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
function v3len(a) { return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z); }
function v3normalize(a) { const l = v3len(a); return l < 1e-15 ? v3(0, 0, 0) : v3scale(a, 1 / l); }

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
// CONTINUOUS SWEEP — CT Scanner approach
// ═══════════════════════════════════════════════════════════════

/**
 * Generate plane normals by sweeping continuously.
 * 
 * Strategy: rotate a plane around the Y-axis from 0° to 180°.
 * At each angle θ, the plane normal is (sin θ, 0, cos θ).
 * This is EXACTLY what a CT scanner does.
 *
 * For full 3D coverage, we also add a second sweep axis (tilt around X).
 * A tilt of φ gives normal (sin θ · cos φ, sin φ, cos θ · cos φ).
 *
 * @param stepDeg - angular step in degrees
 * @param tiltSteps - number of tilt increments (0 = Y-rotation only, 1 = add ±45° tilt, etc.)
 * @returns Array of unique plane normals
 */
function generateSweepNormals(stepDeg, tiltSteps = 0) {
  const normals = [];
  const step = stepDeg * Math.PI / 180;
  
  // Primary sweep: rotate around Y axis (XZ plane rotation)
  // θ goes from 0° to 180° (beyond 180° gives the same planes, just flipped)
  for (let theta = 0; theta < Math.PI; theta += step) {
    const baseNx = Math.sin(theta);
    const baseNz = Math.cos(theta);
    
    // No tilt
    normals.push(v3normalize(v3(baseNx, 0, baseNz)));
    
    // Add tilted planes if requested
    if (tiltSteps > 0) {
      for (let ti = 1; ti <= tiltSteps; ti++) {
        const phi = (ti / (tiltSteps + 1)) * (Math.PI / 2); // 0 < phi < 90°
        const cosPhi = Math.cos(phi);
        const sinPhi = Math.sin(phi);
        // Tilt up
        normals.push(v3normalize(v3(baseNx * cosPhi, sinPhi, baseNz * cosPhi)));
        // Tilt down
        normals.push(v3normalize(v3(baseNx * cosPhi, -sinPhi, baseNz * cosPhi)));
      }
    }
  }
  
  // Always include pure axis normals
  const hasX = normals.some(n => Math.abs(n.x) > 0.999);
  const hasY = normals.some(n => Math.abs(n.y) > 0.999);
  const hasZ = normals.some(n => Math.abs(n.z) > 0.999);
  if (!hasX) normals.push(v3(1, 0, 0));
  if (!hasY) normals.push(v3(0, 1, 0));
  if (!hasZ) normals.push(v3(0, 0, 1));
  
  return normals;
}

/**
 * For each sweep normal, generate depth-sampling offsets through the part.
 * 
 * @param normal - plane normal
 * @param geo - merged geometry with boundingBox
 * @param depthSlices - number of depth slices per direction
 * @returns Array of offsets
 */
function generateDepthOffsets(normal, bb, depthSlices) {
  // Project bounding box corners onto the normal to find the min/max extent
  const corners = [
    v3(bb.min.x, bb.min.y, bb.min.z), v3(bb.max.x, bb.min.y, bb.min.z),
    v3(bb.min.x, bb.max.y, bb.min.z), v3(bb.max.x, bb.max.y, bb.min.z),
    v3(bb.min.x, bb.min.y, bb.max.z), v3(bb.max.x, bb.min.y, bb.max.z),
    v3(bb.min.x, bb.max.y, bb.max.z), v3(bb.max.x, bb.max.y, bb.max.z),
  ];
  
  let minProj = Infinity, maxProj = -Infinity;
  for (const c of corners) {
    const p = v3dot(c, normal);
    if (p < minProj) minProj = p;
    if (p > maxProj) maxProj = p;
  }
  
  const range = maxProj - minProj;
  if (range < 1e-8) return [minProj];
  
  // Slightly inset to avoid edge artifacts
  const margin = range * 0.02;
  const lo = minProj + margin;
  const hi = maxProj - margin;
  
  const offsets = [];
  if (depthSlices <= 1) {
    offsets.push((lo + hi) / 2);
  } else {
    for (let i = 0; i < depthSlices; i++) {
      offsets.push(lo + (hi - lo) * i / (depthSlices - 1));
    }
  }
  return offsets;
}

// ═══════════════════════════════════════════════════════════════
// DISCRETE DETECTION — Same as gpu-plane-analysis.cjs
// ═══════════════════════════════════════════════════════════════

function detectPlanesDiscrete(geo, maxPlanes = 12, angleTolDeg = 10) {
  const angleTol = angleTolDeg * Math.PI / 180;
  const cosAngleTol = Math.cos(angleTol);
  const posAttr = geo.getAttribute('position');
  const idxAttr = geo.getIndex();
  if (!posAttr) return [];

  const numTri = idxAttr ? idxAttr.count / 3 : posAttr.count / 3;
  const faces = [];

  for (let t = 0; t < numTri; t++) {
    const i0 = idxAttr ? idxAttr.getX(t * 3) : t * 3;
    const i1 = idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2;
    const a = v3(posAttr.getX(i0), posAttr.getY(i0), posAttr.getZ(i0));
    const b = v3(posAttr.getX(i1), posAttr.getY(i1), posAttr.getZ(i1));
    const c = v3(posAttr.getX(i2), posAttr.getY(i2), posAttr.getZ(i2));
    const ab = v3sub(b, a), ac = v3sub(c, a);
    const cross = v3cross(ab, ac);
    const area2 = v3len(cross);
    if (area2 < 1e-12) continue;
    const normal = v3scale(cross, 1 / area2);
    const center = v3scale(v3add(v3add(a, b), c), 1 / 3);
    faces.push({ normal, center, area: area2 * 0.5 });
  }

  // Greedy clustering
  const clusters = [];
  for (const f of faces) {
    let bestCluster = null, bestDot = -Infinity;
    for (const cl of clusters) {
      const d = Math.abs(v3dot(f.normal, cl.normal));
      if (d > cosAngleTol && d > bestDot) { bestDot = d; bestCluster = cl; }
    }
    const fOffset = v3dot(f.center, f.normal);
    if (bestCluster) {
      if (v3dot(f.normal, bestCluster.normal) < 0) {
        f.normal = v3scale(f.normal, -1);
      }
      const totalArea = bestCluster.area + f.area;
      bestCluster.normal = v3normalize(v3add(v3scale(bestCluster.normal, bestCluster.area), v3scale(f.normal, f.area)));
      bestCluster.offset = (bestCluster.offset * bestCluster.area + fOffset * f.area) / totalArea;
      bestCluster.area = totalArea;
      bestCluster.offsets.push(fOffset);
    } else {
      clusters.push({ normal: { ...f.normal }, offset: fOffset, area: f.area, offsets: [fOffset] });
    }
  }
  clusters.sort((a, b) => b.area - a.area);

  // Generate planes
  const bb = geo.boundingBox;
  const bbCenter = v3((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2);
  const bbDiag = v3len(v3(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z));
  
  const planes = [];
  const usedNormals = [];
  const axisVecs = [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)];
  
  // Axis center planes
  for (const n of axisVecs) {
    planes.push({ normal: { ...n }, offset: v3dot(bbCenter, n) });
    usedNormals.push({ ...n });
  }
  
  // Cluster planes
  for (const cl of clusters) {
    if (planes.length >= maxPlanes) break;
    let skip = false;
    for (const used of usedNormals) {
      if (Math.abs(v3dot(cl.normal, used)) > Math.cos(angleTol * 0.5)) { skip = true; break; }
    }
    if (skip) continue;
    
    const n = { ...cl.normal };
    if (n.x + n.y + n.z < 0) { n.x = -n.x; n.y = -n.y; n.z = -n.z; }
    planes.push({ normal: n, offset: cl.offset });
    usedNormals.push({ ...n });
    
    // Depth slices
    const sorted = cl.offsets.sort((a, b) => a - b);
    const range = sorted[sorted.length - 1] - sorted[0];
    if (range > bbDiag * 0.1 && planes.length + 2 <= maxPlanes) {
      planes.push({ normal: { ...n }, offset: sorted[0] + range * 0.25 });
      planes.push({ normal: { ...n }, offset: sorted[0] + range * 0.75 });
    }
  }
  
  // Axis depth slices
  for (let ai = 0; ai < 3; ai++) {
    const n = axisVecs[ai];
    const lo = [bb.min.x, bb.min.y, bb.min.z][ai];
    const hi = [bb.max.x, bb.max.y, bb.max.z][ai];
    if (hi - lo > 1e-8 && planes.length + 2 <= maxPlanes) {
      planes.push({ normal: { ...n }, offset: lo + (hi - lo) * 0.25 });
      planes.push({ normal: { ...n }, offset: lo + (hi - lo) * 0.75 });
    }
  }
  
  return planes;
}

// ═══════════════════════════════════════════════════════════════
// MESH-PLANE SLICER
// ═══════════════════════════════════════════════════════════════

function planeBasis(normal) {
  const n = v3normalize(normal);
  const up = Math.abs(n.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0);
  const u = v3normalize(v3cross(up, n));
  const v = v3normalize(v3cross(n, u));
  return { u, v };
}

function slicePlane(geo, planeNormal, planeOffset) {
  const posAttr = geo.getAttribute('position');
  const idxAttr = geo.getIndex();
  if (!posAttr) return { contours: [], segments: 0 };

  const numTri = idxAttr ? idxAttr.count / 3 : posAttr.count / 3;
  const n = v3normalize(planeNormal);
  const { u, v } = planeBasis(n);
  const planeOrigin = v3scale(n, planeOffset);

  const segments = [];

  for (let t = 0; t < numTri; t++) {
    const i0 = idxAttr ? idxAttr.getX(t * 3) : t * 3;
    const i1 = idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2;

    const p0 = v3(posAttr.getX(i0), posAttr.getY(i0), posAttr.getZ(i0));
    const p1 = v3(posAttr.getX(i1), posAttr.getY(i1), posAttr.getZ(i1));
    const p2 = v3(posAttr.getX(i2), posAttr.getY(i2), posAttr.getZ(i2));

    const d0 = v3dot(p0, n) - planeOffset;
    const d1 = v3dot(p1, n) - planeOffset;
    const d2 = v3dot(p2, n) - planeOffset;

    const verts = [{ pos: p0, d: d0 }, { pos: p1, d: d1 }, { pos: p2, d: d2 }];
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
      const rel0 = v3sub(pts3D[0], planeOrigin);
      const rel1 = v3sub(pts3D[1], planeOrigin);
      segments.push([
        { x: v3dot(rel0, u), y: v3dot(rel0, v) },
        { x: v3dot(rel1, u), y: v3dot(rel1, v) },
      ]);
    }
  }

  if (segments.length === 0) return { contours: [], segments: 0 };

  // Chain segments into contours
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
      let area = 0;
      for (let i = 0; i < chain.length; i++) {
        const a = chain[i], b = chain[(i + 1) % chain.length];
        area += a.x * b.y - b.x * a.y;
      }
      contours.push({ points: chain, area: Math.abs(area / 2) });
    }
  }

  return { contours, segments: segments.length };
}

// ═══════════════════════════════════════════════════════════════
// FITTING + ERROR (simplified but same algorithm)
// ═══════════════════════════════════════════════════════════════

function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }

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
  return { center, radius: rSum / n };
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

function refineCircle(points, initial, maxIter = 25) {
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
  return { center: { x: cx, y: cy }, radius: Math.abs(r) };
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

function angleBetween(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
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

/**
 * Fit contours and compute reconstruction error.
 * Returns { maxError, avgError, entities, lines, arcs, circles }
 */
function fitAndMeasure(contours, tolerance) {
  let totalEntities = 0, totalLines = 0, totalArcs = 0, totalCircles = 0;
  let worstErr = 0, sumAvgErr = 0, fitCount = 0;
  let pass01 = 0, pass001 = 0;
  let totalPts = 0;

  for (const c of contours) {
    if (c.points.length < 6) continue;
    totalPts += c.points.length;
    const pts = c.points;
    const n = pts.length;
    const perim = pts.reduce((s, p, i) => s + (i < n - 1 ? dist(p, pts[i + 1]) : dist(p, pts[0])), 0);
    const tol = tolerance || Math.max(0.001, perim / Math.PI * 0.0001);

    const entities = [];

    // Try full circle
    const circFit = fitCircle(pts);
    if (circFit) {
      const refined = refineCircle(pts, circFit);
      let maxD = 0;
      for (const p of pts) maxD = Math.max(maxD, Math.abs(dist(p, refined.center) - refined.radius));
      if (maxD < tol * 2) {
        entities.push({ type: 'circle', center: refined.center, radius: refined.radius });
        totalCircles++;
        totalEntities++;
        // Compute error
        let maxE = 0, sumE = 0;
        for (const p of pts) { const e = Math.abs(dist(p, refined.center) - refined.radius); maxE = Math.max(maxE, e); sumE += e; }
        worstErr = Math.max(worstErr, maxE);
        sumAvgErr += sumE / n;
        fitCount++;
        if (maxE < 0.1) pass01++;
        if (maxE < 0.01) pass001++;
        continue;
      }
    }

    // Segmented fitting with corner detection
    const angles = pts.map((p, i) => {
      const prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n];
      const a1 = Math.atan2(p.y - prev.y, p.x - prev.x);
      const a2 = Math.atan2(next.y - p.y, next.x - p.x);
      return Math.abs(angleBetween(a1, a2));
    });
    const corners = [0];
    for (let i = 1; i < n; i++) if (angles[i] > 0.15) corners.push(i);
    if (corners.length < 2) corners.push(Math.floor(n / 2));

    for (let ci = 0; ci < corners.length; ci++) {
      const from = corners[ci];
      const to = corners[(ci + 1) % corners.length];
      const segment = [];
      if (from <= to) { for (let i = from; i <= to; i++) segment.push(pts[i]); }
      else { for (let i = from; i < n; i++) segment.push(pts[i]); for (let i = 0; i <= to; i++) segment.push(pts[i]); }
      if (segment.length < 2) continue;

      // Try arc
      if (segment.length >= 5) {
        const mid = Math.floor(segment.length / 2);
        const c3 = circleFrom3Points(segment[0], segment[mid], segment[segment.length - 1]);
        if (c3) {
          const refined = refineCircle(segment, c3);
          let maxD = 0;
          for (const p of segment) maxD = Math.max(maxD, Math.abs(dist(p, refined.center) - refined.radius));
          if (maxD < tol * 3) {
            entities.push({ type: 'arc', center: refined.center, radius: refined.radius });
            totalArcs++;
            totalEntities++;
            continue;
          }
        }
      }
      entities.push({ type: 'line', start: segment[0], end: segment[segment.length - 1] });
      totalLines++;
      totalEntities++;
    }

    // Compute reconstruction error
    if (entities.length > 0) {
      let maxE = 0, sumE = 0;
      for (const pt of pts) {
        let minD = Infinity;
        for (const ent of entities) {
          let d;
          if (ent.type === 'line') d = pointToSegmentDist(pt, ent.start, ent.end);
          else d = Math.abs(dist(pt, ent.center) - ent.radius);
          if (d < minD) minD = d;
        }
        maxE = Math.max(maxE, minD);
        sumE += minD;
      }
      worstErr = Math.max(worstErr, maxE);
      sumAvgErr += sumE / n;
      fitCount++;
      if (maxE < 0.1) pass01++;
      if (maxE < 0.01) pass001++;
    }
  }

  return {
    entities: totalEntities,
    lines: totalLines,
    arcs: totalArcs,
    circles: totalCircles,
    maxError: worstErr,
    avgError: fitCount > 0 ? sumAvgErr / fitCount : 0,
    pass01,
    pass001,
    fitCount,
    totalPts,
  };
}

// ═══════════════════════════════════════════════════════════════
// SWEEP RUNNER — Runs a given set of planes and aggregates results
// ═══════════════════════════════════════════════════════════════

function runSweep(geo, planes, tolerance) {
  let totalContours = 0;
  let totalSegments = 0;
  let allContours = [];

  for (const plane of planes) {
    const { contours, segments } = slicePlane(geo, plane.normal, plane.offset);
    totalContours += contours.length;
    totalSegments += segments;
    for (const c of contours) allContours.push(c);
  }

  const fit = fitAndMeasure(allContours, tolerance);

  return {
    planes: planes.length,
    segments: totalSegments,
    contours: totalContours,
    ...fit,
  };
}

// ═══════════════════════════════════════════════════════════════
// MAIN
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

async function main() {
  const args = process.argv.slice(2);
  const modelsDir = path.join(__dirname, '..', 'models', 'step');

  let files;
  if (args.length > 0) {
    files = args.map(a => path.resolve(a));
  } else {
    // Select representative files (not all 36 — too slow for continuous sweep)
    const allFiles = collectStepFiles(modelsDir).sort();
    // Pick a few representative: D2MI (simple), CTC/FTC (complex), STC (PMI)
    const picks = [
      '827-9999-904 rev c.stp',  // NIST D2MI: clean machined part
      '827-9999-906.stp',        // NIST D2MI: another shape
      '827-9999-908.stp',        // NIST D2MI: complex
      'nist_ctc_01_asme1_ap242-e1.stp',  // CTC: composite test case
      'nist_ftc_09_asme1_ap242-e1.stp',  // FTC: features test
    ];
    files = [];
    for (const pick of picks) {
      const found = allFiles.find(f => f.endsWith(pick));
      if (found) files.push(found);
    }
    if (files.length === 0) {
      // Fallback: just use first 3
      files = allFiles.slice(0, 3);
    }
  }

  files = files.filter(f => /\.(stp|step)$/i.test(f));

  console.log('═'.repeat(90));
  console.log('⚒️  La Forja — CT CONTINUOUS SWEEP vs DISCRETE PLANES');
  console.log('   ¿Es mejor escanear continuo que con ángulos predefinidos?');
  console.log('═'.repeat(90));
  console.log();
  console.log('ESTRATEGIAS:');
  console.log('  📌 DISCRETE  = detectPlanes() → clustering de normales → ~12 planos');
  console.log('  🔄 CONTINUOUS = barrido CT 0°→180° cada N grados × M profundidades');
  console.log();

  // Angular resolutions to test
  const sweepConfigs = [
    { stepDeg: 30, depthSlices: 3,  tilt: 0, label: '30° × 3d' },
    { stepDeg: 10, depthSlices: 5,  tilt: 0, label: '10° × 5d' },
    { stepDeg: 5,  depthSlices: 5,  tilt: 0, label: '5° × 5d' },
    { stepDeg: 5,  depthSlices: 10, tilt: 0, label: '5° × 10d' },
    { stepDeg: 2,  depthSlices: 5,  tilt: 0, label: '2° × 5d' },
    { stepDeg: 2,  depthSlices: 10, tilt: 0, label: '2° × 10d' },
    { stepDeg: 1,  depthSlices: 10, tilt: 0, label: '1° × 10d' },
    { stepDeg: 5,  depthSlices: 5,  tilt: 2, label: '5° × 5d +tilt' },
    { stepDeg: 2,  depthSlices: 5,  tilt: 2, label: '2° × 5d +tilt' },
  ];

  // Global accumulators per config
  const globalResults = {};
  const globalDiscrete = { planes: 0, contours: 0, entities: 0, maxErr: 0, sumAvg: 0, samples: 0, pass01: 0, pass001: 0, timeMs: 0 };
  for (const cfg of sweepConfigs) {
    globalResults[cfg.label] = { planes: 0, contours: 0, entities: 0, maxErr: 0, sumAvg: 0, samples: 0, pass01: 0, pass001: 0, timeMs: 0 };
  }

  for (const file of files) {
    const relPath = path.relative(modelsDir, file);
    console.log(`\n${'─'.repeat(90)}`);
    console.log(`📐 ${relPath}`);
    console.log(`${'─'.repeat(90)}`);

    let meshes;
    try {
      meshes = await loadStepFile(file);
    } catch (err) {
      console.log(`  ❌ SKIP: ${err.message}`);
      continue;
    }
    if (meshes.length === 0) { console.log('  ❌ SKIP: no meshes'); continue; }

    const merged = mergeGeometries(meshes);
    const bb = merged.boundingBox;
    const diag = v3len(v3(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z));
    const tol = Math.max(0.001, diag * 0.0001);

    const posAttr = merged.getAttribute('position');
    const idxAttr = merged.getIndex();
    const triCount = idxAttr ? idxAttr.count / 3 : posAttr.count / 3;
    const sizeStr = `${(bb.max.x - bb.min.x).toFixed(1)} × ${(bb.max.y - bb.min.y).toFixed(1)} × ${(bb.max.z - bb.min.z).toFixed(1)}`;
    console.log(`  📦 ${sizeStr} mm  |  🔺 ${triCount} triangles  |  diag: ${diag.toFixed(1)} mm`);
    console.log();

    // ── Discrete baseline ──
    const t0 = Date.now();
    const discretePlanes = detectPlanesDiscrete(merged, 12, 10);
    const discreteResult = runSweep(merged, discretePlanes, tol);
    const discreteTime = Date.now() - t0;

    console.log(`  📌 DISCRETE (${discretePlanes.length} planes): ${discreteResult.contours}c → ${discreteResult.entities}e (${discreteResult.lines}L ${discreteResult.arcs}A ${discreteResult.circles}⊙) | maxE=${discreteResult.maxError.toFixed(4)} avgE=${discreteResult.avgError.toFixed(4)} | ${discreteResult.pass001}/${discreteResult.fitCount}<0.01 | ${discreteTime}ms`);

    globalDiscrete.planes += discretePlanes.length;
    globalDiscrete.contours += discreteResult.contours;
    globalDiscrete.entities += discreteResult.entities;
    globalDiscrete.maxErr = Math.max(globalDiscrete.maxErr, discreteResult.maxError);
    globalDiscrete.sumAvg += discreteResult.avgError * discreteResult.fitCount;
    globalDiscrete.samples += discreteResult.fitCount;
    globalDiscrete.pass01 += discreteResult.pass01;
    globalDiscrete.pass001 += discreteResult.pass001;
    globalDiscrete.timeMs += discreteTime;

    // ── Continuous sweeps ──
    console.log();
    console.log('  🔄 CONTINUOUS SWEEPS:');
    console.log('  ┌──────────────────┬─────────┬──────────┬──────────┬───────────┬──────────┬──────────┬────────┐');
    console.log('  │ Config           │ Planes  │ Contours │ Entities │ maxError  │ avgError │ <0.01    │ Time   │');
    console.log('  ├──────────────────┼─────────┼──────────┼──────────┼───────────┼──────────┼──────────┼────────┤');

    for (const cfg of sweepConfigs) {
      const normals = generateSweepNormals(cfg.stepDeg, cfg.tilt);
      
      // Generate planes: each normal × depth slices
      const planes = [];
      for (const normal of normals) {
        const offsets = generateDepthOffsets(normal, bb, cfg.depthSlices);
        for (const off of offsets) {
          planes.push({ normal, offset: off });
        }
      }

      const t1 = Date.now();
      const result = runSweep(merged, planes, tol);
      const sweepTime = Date.now() - t1;

      const errIcon = result.maxError < 0.01 ? '✅' : result.maxError < 0.1 ? '🟡' : '🔴';
      const pctPass = result.fitCount > 0 ? `${result.pass001}/${result.fitCount}` : '-';
      
      console.log(`  │ ${cfg.label.padEnd(16)} │ ${String(planes.length).padStart(7)} │ ${String(result.contours).padStart(8)} │ ${String(result.entities).padStart(8)} │ ${errIcon} ${result.maxError.toFixed(4).padStart(7)} │ ${result.avgError.toFixed(4).padStart(8)} │ ${pctPass.padStart(8)} │ ${String(sweepTime + 'ms').padStart(6)} │`);

      const g = globalResults[cfg.label];
      g.planes += planes.length;
      g.contours += result.contours;
      g.entities += result.entities;
      g.maxErr = Math.max(g.maxErr, result.maxError);
      g.sumAvg += result.avgError * result.fitCount;
      g.samples += result.fitCount;
      g.pass01 += result.pass01;
      g.pass001 += result.pass001;
      g.timeMs += sweepTime;
    }

    console.log('  └──────────────────┴─────────┴──────────┴──────────┴───────────┴──────────┴──────────┴────────┘');

    merged.dispose();
  }

  // ═══ GLOBAL COMPARISON ═══
  console.log();
  console.log('═'.repeat(90));
  console.log('📊 COMPARACIÓN GLOBAL — DISCRETE vs CONTINUOUS');
  console.log('═'.repeat(90));
  console.log();

  console.log('┌──────────────────┬─────────┬──────────┬──────────┬───────────┬──────────┬──────────┬────────┐');
  console.log('│ Strategy         │ Planes  │ Contours │ Entities │ maxError  │ avgError │ <0.01    │ Time   │');
  console.log('├──────────────────┼─────────┼──────────┼──────────┼───────────┼──────────┼──────────┼────────┤');

  const dAvg = globalDiscrete.samples > 0 ? globalDiscrete.sumAvg / globalDiscrete.samples : 0;
  const dPct = globalDiscrete.samples > 0 ? `${(globalDiscrete.pass001 / globalDiscrete.samples * 100).toFixed(0)}%` : '-';
  console.log(`│ 📌 DISCRETE      │ ${String(globalDiscrete.planes).padStart(7)} │ ${String(globalDiscrete.contours).padStart(8)} │ ${String(globalDiscrete.entities).padStart(8)} │    ${globalDiscrete.maxErr.toFixed(4).padStart(7)} │ ${dAvg.toFixed(4).padStart(8)} │ ${dPct.padStart(8)} │ ${String(globalDiscrete.timeMs + 'ms').padStart(6)} │`);
  
  console.log('├──────────────────┼─────────┼──────────┼──────────┼───────────┼──────────┼──────────┼────────┤');

  for (const cfg of sweepConfigs) {
    const g = globalResults[cfg.label];
    const avg = g.samples > 0 ? g.sumAvg / g.samples : 0;
    const pct = g.samples > 0 ? `${(g.pass001 / g.samples * 100).toFixed(0)}%` : '-';
    const icon = g.maxErr < 0.01 ? '✅' : g.maxErr < 0.1 ? '🟡' : '🔴';
    console.log(`│ 🔄 ${cfg.label.padEnd(14)} │ ${String(g.planes).padStart(7)} │ ${String(g.contours).padStart(8)} │ ${String(g.entities).padStart(8)} │ ${icon} ${g.maxErr.toFixed(4).padStart(7)} │ ${avg.toFixed(4).padStart(8)} │ ${pct.padStart(8)} │ ${String(g.timeMs + 'ms').padStart(6)} │`);
  }

  console.log('└──────────────────┴─────────┴──────────┴──────────┴───────────┴──────────┴──────────┴────────┘');

  // ═══ ANALYSIS ═══
  console.log();
  console.log('═'.repeat(90));
  console.log('🔬 ANÁLISIS');
  console.log('═'.repeat(90));
  console.log();
  
  // Best continuous result
  let bestLabel = '', bestMax = Infinity;
  for (const cfg of sweepConfigs) {
    const g = globalResults[cfg.label];
    if (g.maxErr < bestMax) { bestMax = g.maxErr; bestLabel = cfg.label; }
  }
  
  const improvement = globalDiscrete.maxErr > 0 ? ((globalDiscrete.maxErr - bestMax) / globalDiscrete.maxErr * 100).toFixed(1) : '0';
  const contourRatio = globalDiscrete.contours > 0 ? (globalResults[bestLabel].contours / globalDiscrete.contours).toFixed(1) : '-';

  console.log(`  Discrete maxError:    ${globalDiscrete.maxErr.toFixed(6)}`);
  console.log(`  Best continuous:      ${bestMax.toFixed(6)} (${bestLabel})`);
  console.log(`  Mejora en maxError:   ${improvement}%`);
  console.log(`  Ratio contornos:      ${contourRatio}x más con continuo`);
  console.log();
  console.log('  CONCLUSIÓN:');
  if (bestMax < globalDiscrete.maxErr * 0.5) {
    console.log('  ✅ CONTINUO es SIGNIFICATIVAMENTE mejor — captura features que el discreto pierde.');
    console.log('     El error baja porque cada contorno se corta en SU ángulo natural,');
    console.log('     no en un ángulo aproximado del cluster más cercano.');
  } else if (bestMax < globalDiscrete.maxErr * 0.9) {
    console.log('  🟡 CONTINUO es moderadamente mejor.');
    console.log('     Más contornos = más datos, pero el error residual es de teselación.');
  } else {
    console.log('  ⚠️ La diferencia es pequeña en estas piezas.');
    console.log('     El error dominante es la teselación del mesh, no la selección de ángulo.');
    console.log('     GPU winding-number rendering es lo que realmente eliminará ese error.');
  }
  console.log();
  console.log('  💡 Para ERROR → 0 se necesitan AMBAS cosas:');
  console.log('     1. Barrido continuo → no perder ningún feature');
  console.log('     2. GPU rendering   → eliminar ruido de teselación');
  console.log('     3. Alta resolución → 2048×2048 o más por corte');
  console.log();
  console.log('  📐 El barrido continuo a 1° con 10 profundidades = ~1800 cortes/pieza');
  console.log('     En GPU a 2048² cada uno tarda ~1ms → 1.8 segundos total.');
  console.log('     Un CT médico tarda 15-30 segundos. Nosotros: <2 seg en el browser.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
