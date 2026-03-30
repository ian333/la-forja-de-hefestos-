/**
 * ⚒️ La Forja — GPU Cross-Section Engine
 * ========================================
 * Uses WebGL2 winding-number rendering + marching squares
 * to extract precise cross-section contours on ARBITRARY planes.
 *
 * Pipeline:
 * 1. Detect natural feature planes from mesh normals (normal clustering)
 * 2. For each plane: orthographic winding-number render on GPU
 * 3. Marching squares on the winding field → sub-pixel contours
 * 4. Entity fitting on clean contours → minimal lines + arcs + circles
 *
 * Why GPU?
 * - CPU mesh-plane intersection gives noisy polylines (tessellation artifacts)
 * - GPU winding-number rendering naturally produces clean binary fields
 * - Marching squares on the binary field gives gap-free, smooth contours
 * - Arbitrary plane orientation by rotating the camera — zero code change
 *
 * Precision: ~0.5 pixel at the chosen resolution
 *   1024×1024 on 100mm part → ~0.05mm precision
 *   2048×2048 on 100mm part → ~0.025mm precision
 */

import * as THREE from 'three';
import type { Point2D } from './cross-section';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface SlicePlane {
  /** A point on the plane (world coordinates) */
  origin: THREE.Vector3;
  /** Unit normal vector */
  normal: THREE.Vector3;
  /** Label for the UI (e.g. "Front", "XY +45°") */
  label: string;
  /** Axis hint for 2D coordinate mapping (optional) */
  axisHint?: 'X' | 'Y' | 'Z' | 'custom';
}

export interface GPUContour {
  /** 2D points in the plane's local coordinate system */
  points: Point2D[];
  /** Signed area (positive = CCW outer, negative = CW hole) */
  area: number;
  /** Is this an outer boundary? */
  isOuter: boolean;
}

export interface GPUSliceResult {
  plane: SlicePlane;
  contours: GPUContour[];
  /** Resolution used for rendering */
  resolution: number;
  /** World-space size per pixel */
  pixelSize: number;
  /** Processing time in ms */
  timeMs: number;
  /** Plane-local coordinate basis for 3D reconstruction:
   *  worldPos = planeOrigin + pt.x * uAxis + pt.y * vAxis */
  uAxis: THREE.Vector3;
  vAxis: THREE.Vector3;
  /** Origin for 2D→3D reconstruction (center of rendered region in world space) */
  planeOrigin: THREE.Vector3;
}

// ═══════════════════════════════════════════════════════════════
// Plane Detection from Mesh Normals
// ═══════════════════════════════════════════════════════════════

export interface DetectedPlane {
  normal: THREE.Vector3;
  offset: number;      // distance from origin along normal
  area: number;        // total face area with this normal
  label: string;
}

// ── Internal: reusable face data collection ──

interface FaceData { normal: THREE.Vector3; center: THREE.Vector3; area: number }

function collectFaces(meshes: THREE.Object3D): FaceData[] {
  const faces: FaceData[] = [];
  const _va = new THREE.Vector3(), _vb = new THREE.Vector3(), _vc = new THREE.Vector3();
  const _ab = new THREE.Vector3(), _ac = new THREE.Vector3(), _n = new THREE.Vector3();

  meshes.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geo = child.geometry as THREE.BufferGeometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    if (!posAttr) return;

    const idx = geo.getIndex();
    const triCount = idx ? idx.count / 3 : posAttr.count / 3;
    const wm = child.matrixWorld;

    for (let t = 0; t < triCount; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3;
      const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;

      _va.fromBufferAttribute(posAttr, i0).applyMatrix4(wm);
      _vb.fromBufferAttribute(posAttr, i1).applyMatrix4(wm);
      _vc.fromBufferAttribute(posAttr, i2).applyMatrix4(wm);

      _ab.subVectors(_vb, _va);
      _ac.subVectors(_vc, _va);
      _n.crossVectors(_ab, _ac);
      const area2 = _n.length();
      if (area2 < 1e-12) continue;

      const normal = _n.clone().divideScalar(area2);
      const center = new THREE.Vector3().addVectors(_va, _vb).add(_vc).divideScalar(3);
      faces.push({ normal, center, area: area2 * 0.5 });
    }
  });
  return faces;
}

/**
 * Detect the natural feature planes of a mesh by clustering face normals.
 * Returns axis-aligned planes + any significant angled planes.
 *
 * @deprecated Use detectPlanarDirections() for geometry-driven scanning.
 */
export function detectPlanes(
  meshes: THREE.Object3D,
  maxPlanes = 12,
  angleTolDeg = 10,
): DetectedPlane[] {
  const angleTol = angleTolDeg * Math.PI / 180;
  const faces = collectFaces(meshes);
  if (faces.length === 0) return [];

  interface Cluster { normal: THREE.Vector3; offset: number; area: number; offsets: number[] }
  const clusters: Cluster[] = [];

  for (const f of faces) {
    let bestCluster: Cluster | null = null;
    let bestDot = -Infinity;
    for (const cl of clusters) {
      const d = Math.abs(f.normal.dot(cl.normal));
      if (d > Math.cos(angleTol) && d > bestDot) { bestDot = d; bestCluster = cl; }
    }
    const fOffset = f.center.dot(f.normal);
    if (bestCluster) {
      if (f.normal.dot(bestCluster.normal) < 0) f.normal.negate();
      const totalArea = bestCluster.area + f.area;
      bestCluster.normal.multiplyScalar(bestCluster.area).addScaledVector(f.normal, f.area).divideScalar(totalArea).normalize();
      bestCluster.offset = (bestCluster.offset * bestCluster.area + fOffset * f.area) / totalArea;
      bestCluster.area = totalArea;
      bestCluster.offsets.push(fOffset);
    } else {
      clusters.push({ normal: f.normal.clone(), offset: fOffset, area: f.area, offsets: [fOffset] });
    }
  }
  clusters.sort((a, b) => b.area - a.area);

  const bb = new THREE.Box3();
  meshes.traverse(c => { if (c instanceof THREE.Mesh) bb.expandByObject(c); });
  const bbCenter = bb.getCenter(new THREE.Vector3());

  const planes: DetectedPlane[] = [];
  for (let ai = 0; ai < 3; ai++) {
    const n = [new THREE.Vector3(1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,1)][ai];
    planes.push({ normal: n, offset: bbCenter.dot(n), area: 0, label: `${'XYZ'[ai]} Center` });
  }
  for (const cl of clusters) {
    if (planes.length >= maxPlanes) break;
    const dup = planes.some(p => Math.abs(p.normal.dot(cl.normal)) > Math.cos(angleTol * 0.5));
    if (dup) continue;
    const n = cl.normal.clone();
    if (n.x + n.y + n.z < 0) n.negate();
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    const label = ax > 0.95 ? 'YZ' : ay > 0.95 ? 'XZ' : az > 0.95 ? 'XY'
      : `∠${Math.round(Math.asin(n.y)*180/Math.PI)}°/${Math.round(Math.atan2(n.x,n.z)*180/Math.PI)}°`;
    planes.push({ normal: n, offset: cl.offset, area: cl.area, label: `${label} mid` });
  }
  return planes.slice(0, maxPlanes);
}

// ═══════════════════════════════════════════════════════════════
// Geometry-Driven Planar Direction Detection
// ═══════════════════════════════════════════════════════════════

export interface PlanarDirection {
  /** Unit normal of this planar surface group */
  normal: THREE.Vector3;
  /** Total face area with this normal */
  area: number;
  /** Percentage of total mesh area */
  areaPct: number;
  /** Number of triangles with this normal */
  faceCount: number;
  /** Offset range [min, max] along normal — where geometry exists */
  offsetRange: [number, number];
  /** Human-readable label */
  label: string;
  /** Is this axis-aligned (within 5°)? */
  isAxis: boolean;
}

/**
 * Detect ALL planar surface directions from a mesh (v3 — angular dispersion).
 *
 * Five-pass algorithm:
 * 1. CLUSTER face normals at 5° tolerance (area-weighted centroid)
 *    → tracks per-face normals + offsets for dispersion statistics
 * 2. COMPUTE per-cluster stats:
 *    - σ_θ: area-weighted angular RMS deviation from centroid (planarity)
 *    - σ_d: offset standard deviation along cluster normal (coplanarity)
 * 3. FILTER — keep only TRULY PLANAR clusters:
 *    (σ_θ < 1.5° AND σ_d/diag < 0.1%) OR areaPct > 3%
 * 4. MERGE at 10° with stable anchor → eliminates near-duplicates
 * 5. ENSURE X, Y, Z axes are always present
 *
 * Key insight — σ_θ (angular dispersion):
 *   Planar face:  all normals identical → σ_θ ≈ 0°
 *   Cylinder/fillet: normals span curvature → σ_θ > 2°
 *   This cleanly separates flat surfaces from tessellated curves.
 *
 * Typical results:
 *   Cube:            3 directions
 *   Cube + hole:     3 directions (cylinder filtered by σ_θ)
 *   Cube + chamfer:  4 directions (chamfer is truly planar)
 *   NIST CTC-02:     6 directions (not 338 from v2)
 */
export function detectPlanarDirections(meshes: THREE.Object3D): PlanarDirection[] {
  const faces = collectFaces(meshes);
  if (faces.length === 0) return [];

  const totalArea = faces.reduce((s, f) => s + f.area, 0);

  // Bounding box diagonal for relative thresholds
  const bb = new THREE.Box3();
  meshes.traverse(c => { if (c instanceof THREE.Mesh) bb.expandByObject(c); });
  const diag = bb.getSize(new THREE.Vector3()).length();

  // ── Pass 1: Cluster face normals (5° tolerance) ──
  // Wider than v2's 2° — this captures curvature within each cluster,
  // enabling the σ_θ filter to distinguish planar from curved.
  const COS_5DEG = Math.cos(5 * Math.PI / 180);

  interface Cluster5 {
    normal: THREE.Vector3;
    area: number;
    faceCount: number;
    faceNormals: THREE.Vector3[];
    faceAreas: number[];
    offsets: number[];
    sigmaTheta: number;       // degrees
    sigmaOffset: number;      // world units
    sigmaOffsetRel: number;   // ratio to diagonal
    areaPct: number;
  }

  const clusters: Cluster5[] = [];
  const _tmpN = new THREE.Vector3();

  for (const f of faces) {
    let best: Cluster5 | null = null;
    let bestDot = -Infinity;
    for (const cl of clusters) {
      const d = Math.abs(f.normal.dot(cl.normal));
      if (d > COS_5DEG && d > bestDot) { bestDot = d; best = cl; }
    }
    const fOff = f.center.dot(f.normal);
    if (best) {
      const fn = f.normal.clone();
      if (fn.dot(best.normal) < 0) fn.negate();
      best.faceNormals.push(fn);
      best.faceAreas.push(f.area);
      best.offsets.push(f.center.dot(best.normal)); // project onto cluster normal
      const t = best.area + f.area;
      _tmpN.copy(best.normal).multiplyScalar(best.area).addScaledVector(fn, f.area).divideScalar(t).normalize();
      best.normal.copy(_tmpN);
      best.area = t;
      best.faceCount++;
    } else {
      clusters.push({
        normal: f.normal.clone(),
        area: f.area,
        faceCount: 1,
        faceNormals: [f.normal.clone()],
        faceAreas: [f.area],
        offsets: [fOff],
        sigmaTheta: 0,
        sigmaOffset: 0,
        sigmaOffsetRel: 0,
        areaPct: 0,
      });
    }
  }

  // ── Pass 2: Compute planarity stats ──
  for (const cl of clusters) {
    // σ_θ: area-weighted angular RMS deviation from centroid normal
    let sumWT2 = 0, sumW = 0;
    for (let i = 0; i < cl.faceNormals.length; i++) {
      const cosTheta = Math.min(1, Math.abs(cl.faceNormals[i].dot(cl.normal)));
      const theta = Math.acos(cosTheta);
      sumWT2 += cl.faceAreas[i] * theta * theta;
      sumW += cl.faceAreas[i];
    }
    cl.sigmaTheta = Math.sqrt(sumWT2 / Math.max(sumW, 1e-15)) * 180 / Math.PI;

    // σ_d: offset standard deviation (coplanarity)
    const meanOff = cl.offsets.reduce((s, o) => s + o, 0) / cl.offsets.length;
    const varOff = cl.offsets.reduce((s, o) => s + (o - meanOff) ** 2, 0) / cl.offsets.length;
    cl.sigmaOffset = Math.sqrt(varOff);
    cl.sigmaOffsetRel = diag > 0 ? cl.sigmaOffset / diag : 0;
    cl.areaPct = totalArea > 0 ? (cl.area / totalArea) * 100 : 0;
  }

  // ── Pass 3: Filter — keep TRULY PLANAR ──
  //
  // Planar surface:  σ_θ < 1.5° AND σ_d/diag < 0.1% AND (count ≥ 3 OR area > 0.3%)
  // Dominant feature: areaPct > 3% (keep regardless — it's a major face)
  // Everything else:  curved surface tessellation noise → discard
  const planar = clusters.filter(cl => {
    const isCoplanar = cl.sigmaTheta < 1.5 && cl.sigmaOffsetRel < 0.001;
    const hasMass = cl.faceCount >= 3 || cl.areaPct > 0.3;
    const isDominant = cl.areaPct > 3.0;
    return (isCoplanar && hasMass) || isDominant;
  });

  // ── Pass 4: Merge at 10° with stable anchor ──
  planar.sort((a, b) => b.area - a.area);
  const COS_10DEG = Math.cos(10 * Math.PI / 180);

  interface MergedCluster {
    normal: THREE.Vector3;
    anchor: THREE.Vector3;
    area: number;
    faceCount: number;
    offsets: number[];
    sigmaTheta: number;
    areaPct: number;
  }
  const merged: MergedCluster[] = [];

  for (const cl of planar) {
    let target: MergedCluster | null = null;
    for (const m of merged) {
      if (Math.abs(cl.normal.dot(m.anchor)) > COS_10DEG) { target = m; break; }
    }
    if (target) {
      if (cl.normal.dot(target.anchor) < 0) cl.normal.negate();
      const t = target.area + cl.area;
      _tmpN.copy(target.normal).multiplyScalar(target.area).addScaledVector(cl.normal, cl.area).divideScalar(t).normalize();
      target.normal.copy(_tmpN);
      target.area = t;
      target.faceCount += cl.faceCount;
      target.offsets.push(...cl.offsets);
      target.sigmaTheta = Math.min(target.sigmaTheta, cl.sigmaTheta);
      target.areaPct += cl.areaPct;
    } else {
      merged.push({
        normal: cl.normal.clone(),
        anchor: cl.normal.clone(),
        area: cl.area,
        faceCount: cl.faceCount,
        offsets: [...cl.offsets],
        sigmaTheta: cl.sigmaTheta,
        areaPct: cl.areaPct,
      });
    }
  }

  // ── Pass 5: Ensure axis directions (X, Y, Z) are always present ──
  const axisVecs = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
  ];
  const center = bb.getCenter(new THREE.Vector3());
  for (const av of axisVecs) {
    if (!merged.some(m => Math.abs(m.normal.dot(av)) > COS_10DEG)) {
      merged.push({
        normal: av.clone(),
        anchor: av.clone(),
        area: 0,
        faceCount: 0,
        offsets: [center.dot(av)],
        sigmaTheta: 0,
        areaPct: 0,
      });
    }
  }

  merged.sort((a, b) => b.area - a.area);

  // ── Build result with offset ranges and labels ──
  return merged.map(cl => {
    const n = cl.normal.clone();
    if (n.x + n.y + n.z < 0) n.negate();

    const sorted = [...cl.offsets].sort((a, b) => a - b);
    const minOff = sorted[0];
    const maxOff = sorted[sorted.length - 1];

    const COS_AXIS = 0.985; // cos(10°)
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    const isAxis = ax > COS_AXIS || ay > COS_AXIS || az > COS_AXIS;
    let label: string;
    if (ax > COS_AXIS) label = n.x > 0 ? '+X' : '-X';
    else if (ay > COS_AXIS) label = n.y > 0 ? '+Y' : '-Y';
    else if (az > COS_AXIS) label = n.z > 0 ? '+Z' : '-Z';
    else {
      const pitch = Math.asin(Math.max(-1, Math.min(1, n.y))) * 180 / Math.PI;
      const yaw = Math.atan2(n.x, n.z) * 180 / Math.PI;
      label = `∠${Math.round(pitch)}°/${Math.round(yaw)}°`;
    }

    return {
      normal: n,
      area: cl.area,
      areaPct: totalArea > 0 ? (cl.area / totalArea) * 100 : 0,
      faceCount: cl.faceCount,
      offsetRange: [minOff, maxOff] as [number, number],
      label,
      isAxis,
    };
  });
}

/**
 * Generate SlicePlanes from geometry-detected directions with adaptive depth slicing.
 *
 * For each detected planar direction, generates depth slices through the
 * actual geometry extent. The number of slices per direction is adaptive:
 * - More slices for larger features (longer depth range)
 * - Minimum 1, maximum `maxDepthSlices` per direction
 * - Depth spacing = max(range / maxDepthSlices, minSpacing)
 *
 * Total planes = Σ(slices per direction) — determined by geometry, NOT a fixed grid.
 */
export function generateGeometryPlanes(
  meshes: THREE.Object3D,
  opts?: {
    /** Maximum depth slices per direction (default: 10) */
    maxDepthSlices?: number;
    /** Minimum area percentage to include direction (default: 0.1) */
    minAreaPct?: number;
  },
): SlicePlane[] {
  const maxDepthSlices = opts?.maxDepthSlices ?? 10;
  const minAreaPct = opts?.minAreaPct ?? 0.1;

  const directions = detectPlanarDirections(meshes);
  if (directions.length === 0) return [];

  // Get bounding box for minimum spacing
  const bb = new THREE.Box3();
  meshes.traverse(c => { if (c instanceof THREE.Mesh) bb.expandByObject(c); });
  const diag = bb.getSize(new THREE.Vector3()).length();
  const minSpacing = diag * 0.01; // No slices closer than 1% of diagonal

  const planes: SlicePlane[] = [];

  for (const dir of directions) {
    // Skip very small directions (unless axis-aligned — always include those)
    if (!dir.isAxis && dir.areaPct < minAreaPct) continue;

    const [minOff, maxOff] = dir.offsetRange;
    const range = maxOff - minOff;

    if (range < minSpacing) {
      // Narrow range — single slice at the center
      planes.push({
        origin: dir.normal.clone().multiplyScalar((minOff + maxOff) / 2),
        normal: dir.normal.clone(),
        label: `${dir.label}`,
      });
      continue;
    }

    // Adaptive: number of slices based on range vs spacing
    const idealSlices = Math.ceil(range / minSpacing);
    const numSlices = Math.min(maxDepthSlices, Math.max(2, idealSlices));

    const margin = range * 0.02;
    const lo = minOff + margin;
    const hi = maxOff - margin;

    for (let i = 0; i < numSlices; i++) {
      const t = numSlices === 1 ? 0.5 : i / (numSlices - 1);
      const offset = lo + (hi - lo) * t;
      planes.push({
        origin: dir.normal.clone().multiplyScalar(offset),
        normal: dir.normal.clone(),
        label: `${dir.label} d${i + 1}/${numSlices}`,
      });
    }
  }

  return planes;
}

// ═══════════════════════════════════════════════════════════════
// GPU Winding Number Renderer
// ═══════════════════════════════════════════════════════════════

const WIND_VERT = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const WIND_FRAG = /* glsl */ `
precision highp float;
out vec4 fragColor;
void main() {
  // +1 for front faces (entering solid), -1 for back faces (exiting)
  fragColor = vec4(gl_FrontFacing ? 1.0 : -1.0, 0.0, 0.0, 1.0);
}
`;

/**
 * Compute a plane basis (U, V) from a normal vector.
 * U and V are orthonormal and lie in the plane.
 */
function planeBasis(normal: THREE.Vector3): { u: THREE.Vector3; v: THREE.Vector3 } {
  const n = normal.clone().normalize();
  const up = Math.abs(n.y) < 0.9
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(up, n).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  return { u, v };
}

/**
 * GPU-render the winding number field for a mesh cross-section on an
 * arbitrary plane. Returns the winding field as a Float32Array (one value per pixel).
 */
export function renderWindingField(
  renderer: THREE.WebGLRenderer,
  meshSource: THREE.Object3D,
  plane: SlicePlane,
  resolution = 2048,
): {
  field: Float32Array;
  width: number;
  height: number;
  uAxis: THREE.Vector3;
  vAxis: THREE.Vector3;
  planeOrigin: THREE.Vector3;
  pixelSize: number;
  halfW: number;
  halfH: number;
} {
  const { u: uAxis, v: vAxis } = planeBasis(plane.normal);

  // ── Ensure all world matrices are up-to-date (parent → children) ──
  meshSource.updateMatrixWorld(true);

  // ── Compute mesh bounding box projected onto the plane ──
  const bb = new THREE.Box3();
  meshSource.traverse((child) => {
    if (child instanceof THREE.Mesh) bb.expandByObject(child);
  });

  if (bb.isEmpty()) {
    return {
      field: new Float32Array(0), width: 0, height: 0,
      uAxis, vAxis, planeOrigin: plane.origin.clone(),
      pixelSize: 0, halfW: 0, halfH: 0,
    };
  }

  // Project all 8 AABB corners onto the plane axes
  const corners: THREE.Vector3[] = [];
  for (let i = 0; i < 8; i++) {
    corners.push(new THREE.Vector3(
      i & 1 ? bb.max.x : bb.min.x,
      i & 2 ? bb.max.y : bb.min.y,
      i & 4 ? bb.max.z : bb.min.z,
    ));
  }

  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  let minN = Infinity, maxN = -Infinity;
  for (const c of corners) {
    const rel = c.clone().sub(plane.origin);
    const pu = rel.dot(uAxis);
    const pv = rel.dot(vAxis);
    const pn = rel.dot(plane.normal);
    minU = Math.min(minU, pu); maxU = Math.max(maxU, pu);
    minV = Math.min(minV, pv); maxV = Math.max(maxV, pv);
    minN = Math.min(minN, pn); maxN = Math.max(maxN, pn);
  }

  const rangeU = maxU - minU;
  const rangeV = maxV - minV;
  const rangeN = maxN - minN;

  if (rangeU < 1e-8 || rangeV < 1e-8 || rangeN < 1e-8) {
    return {
      field: new Float32Array(0), width: 0, height: 0,
      uAxis, vAxis, planeOrigin: plane.origin.clone(),
      pixelSize: 0, halfW: 0, halfH: 0,
    };
  }

  // Add 5% padding
  const pad = Math.max(rangeU, rangeV) * 0.05;
  const halfW = (rangeU + 2 * pad) / 2;
  const halfH = (rangeV + 2 * pad) / 2;
  const centerU = (minU + maxU) / 2;
  const centerV = (minV + maxV) / 2;

  // Pixel size
  const maxRange = Math.max(halfW * 2, halfH * 2);
  const pixelSize = maxRange / resolution;

  // ── Set up orthographic camera looking along -normal ──
  // Camera is behind the plane (on the -normal side), looking toward +normal
  // Far clip at the slice plane → only count crossings between camera and plane
  const D = rangeN + pad * 2;
  const halfDepth = D / 2 + pad;       // distance from camera to the slice plane
  const cameraPos = plane.origin.clone()
    .addScaledVector(uAxis, centerU)
    .addScaledVector(vAxis, centerV)
    .addScaledVector(plane.normal, -halfDepth);

  // Far clip MUST stop at the slice plane so front-face winding from the
  // camera side accumulates +1 for entering the solid, but the matching
  // back-face exit (on the far side) is clipped away.  That gives
  // winding > 0 for pixels inside the solid at the slice plane.
  const camera = new THREE.OrthographicCamera(
    -halfW, halfW, halfH, -halfH,
    0.001,
    halfDepth + pixelSize,   // stop RIGHT at the slice plane (+ 1 px margin)
  );
  camera.position.copy(cameraPos);
  camera.up.copy(vAxis);
  const lookTarget = cameraPos.clone().addScaledVector(plane.normal, 1);
  camera.lookAt(lookTarget);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  // ── Create render scene with winding material ──
  const windingMaterial = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: WIND_VERT,
    fragmentShader: WIND_FRAG,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });

  const renderScene = new THREE.Scene();
  let triCount = 0;
  meshSource.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const m = new THREE.Mesh(child.geometry, windingMaterial);
      m.matrixWorld.copy(child.matrixWorld);
      m.matrixAutoUpdate = false;
      m.matrixWorldAutoUpdate = false;  // prevent render() from overwriting our matrixWorld
      renderScene.add(m);
      const geo = child.geometry;
      triCount += geo.index ? geo.index.count / 3 : (geo.getAttribute('position')?.count ?? 0) / 3;
    }
  });

  // ── Float render target ──
  const rt = new THREE.WebGLRenderTarget(resolution, resolution, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });

  // ── Render ──
  const prevRT = renderer.getRenderTarget();
  const prevClearColor = renderer.getClearColor(new THREE.Color());
  const prevClearAlpha = renderer.getClearAlpha();
  const prevAutoClear = renderer.autoClear;

  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = true;
  renderer.clear(true, true, true);
  renderer.render(renderScene, camera);

  // ── Read back ──
  const buf = new Float32Array(resolution * resolution * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, resolution, resolution, buf);

  // Extract just the R channel (winding number)
  const field = new Float32Array(resolution * resolution);
  let nonZeroCount = 0;
  let minVal = Infinity, maxVal = -Infinity;
  for (let i = 0; i < field.length; i++) {
    field[i] = buf[i * 4]; // R channel
    if (Math.abs(field[i]) > 0.01) nonZeroCount++;
    if (field[i] < minVal) minVal = field[i];
    if (field[i] > maxVal) maxVal = field[i];
  }
  if (nonZeroCount === 0) {
    console.warn(`[renderWindingField] ALL ZERO winding field! ${plane.label}, res=${resolution}, farClip=${halfDepth + pixelSize}, rangeN=${rangeN.toFixed(3)}, tris=${triCount}, camN=${cameraPos.dot(plane.normal).toFixed(3)}`);
  } else {
    console.log(`[renderWindingField] ${plane.label}: ${nonZeroCount} non-zero px (${(nonZeroCount / field.length * 100).toFixed(1)}%), range=[${minVal.toFixed(2)}, ${maxVal.toFixed(2)}]`);
  }

  // ── Restore renderer state ──
  renderer.setRenderTarget(prevRT);
  renderer.setClearColor(prevClearColor, prevClearAlpha);
  renderer.autoClear = prevAutoClear;

  // Cleanup
  rt.dispose();
  windingMaterial.dispose();
  renderScene.clear();

  // Plane origin for 2D→3D mapping (center of the rendered region)
  const planeOriginForMapping = plane.origin.clone()
    .addScaledVector(uAxis, centerU)
    .addScaledVector(vAxis, centerV);

  return {
    field, width: resolution, height: resolution,
    uAxis, vAxis, planeOrigin: planeOriginForMapping,
    pixelSize, halfW, halfH,
  };
}

// ═══════════════════════════════════════════════════════════════
// Marching Squares — extract contours from the winding field
// ═══════════════════════════════════════════════════════════════

interface MarchSegment {
  a: Point2D;
  b: Point2D;
}

/**
 * Marching squares with sub-pixel linear interpolation.
 * Extracts the boundary between winding > 0 (inside) and ≤ 0 (outside).
 */
function marchingSquares(
  field: Float32Array,
  w: number,
  h: number,
  halfW: number,
  halfH: number,
): MarchSegment[] {
  const segments: MarchSegment[] = [];
  const threshold = 0.5;

  // Convert pixel coordinates to plane-local world coordinates.
  // The camera's right axis = -uAxis (Three.js lookAt convention),
  // so pixel-x increases in -u direction → negate to get u-space coords.
  function toWorld(px: number, py: number): Point2D {
    return {
      x: -(px / w - 0.5) * 2 * halfW,
      y: (py / h - 0.5) * 2 * halfH,
    };
  }

  // Get value at grid point (clamped)
  function val(ix: number, iy: number): number {
    ix = Math.max(0, Math.min(w - 1, ix));
    iy = Math.max(0, Math.min(h - 1, iy));
    return field[iy * w + ix];
  }

  // Interpolate between two adjacent grid points
  function interp(x0: number, y0: number, v0: number, x1: number, y1: number, v1: number): Point2D {
    if (Math.abs(v0 - v1) < 1e-10) {
      return toWorld((x0 + x1) * 0.5, (y0 + y1) * 0.5);
    }
    const t = (threshold - v0) / (v1 - v0);
    const tc = Math.max(0, Math.min(1, t));
    return toWorld(x0 + tc * (x1 - x0), y0 + tc * (y1 - y0));
  }

  // Standard 16-case lookup table
  for (let iy = 0; iy < h - 1; iy++) {
    for (let ix = 0; ix < w - 1; ix++) {
      const v00 = val(ix, iy);          // bottom-left
      const v10 = val(ix + 1, iy);      // bottom-right
      const v11 = val(ix + 1, iy + 1);  // top-right
      const v01 = val(ix, iy + 1);      // top-left

      const c = ((v00 > threshold ? 1 : 0))
              | ((v10 > threshold ? 1 : 0) << 1)
              | ((v11 > threshold ? 1 : 0) << 2)
              | ((v01 > threshold ? 1 : 0) << 3);

      if (c === 0 || c === 15) continue;

      // Edge midpoints (interpolated)
      const bottom = interp(ix, iy, v00, ix + 1, iy, v10);
      const right  = interp(ix + 1, iy, v10, ix + 1, iy + 1, v11);
      const top    = interp(ix + 1, iy + 1, v11, ix, iy + 1, v01);
      const left   = interp(ix, iy + 1, v01, ix, iy, v00);

      switch (c) {
        case 1:  segments.push({ a: left, b: bottom }); break;
        case 2:  segments.push({ a: bottom, b: right }); break;
        case 3:  segments.push({ a: left, b: right }); break;
        case 4:  segments.push({ a: right, b: top }); break;
        case 5:  segments.push({ a: left, b: top }, { a: bottom, b: right }); break; // saddle
        case 6:  segments.push({ a: bottom, b: top }); break;
        case 7:  segments.push({ a: left, b: top }); break;
        case 8:  segments.push({ a: top, b: left }); break;
        case 9:  segments.push({ a: top, b: bottom }); break;
        case 10: segments.push({ a: top, b: right }, { a: left, b: bottom }); break; // saddle
        case 11: segments.push({ a: top, b: right }); break;
        case 12: segments.push({ a: right, b: left }); break;
        case 13: segments.push({ a: right, b: bottom }); break;
        case 14: segments.push({ a: bottom, b: left }); break;
      }
    }
  }

  return segments;
}

// ═══════════════════════════════════════════════════════════════
// Segment Chaining → Closed Contours
// ═══════════════════════════════════════════════════════════════

function dist2D(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function shoelaceArea(pts: Point2D[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function chainMarchSegments(segments: MarchSegment[], eps: number): GPUContour[] {
  if (segments.length === 0) return [];

  // Hash-based adjacency map
  const scale = 1 / eps;
  function key(p: Point2D): string {
    return `${Math.round(p.x * scale)},${Math.round(p.y * scale)}`;
  }

  const adj = new Map<string, { idx: number; other: Point2D; otherKey: string }[]>();

  for (let i = 0; i < segments.length; i++) {
    const ka = key(segments[i].a);
    const kb = key(segments[i].b);
    if (!adj.has(ka)) adj.set(ka, []);
    if (!adj.has(kb)) adj.set(kb, []);
    adj.get(ka)!.push({ idx: i, other: segments[i].b, otherKey: kb });
    adj.get(kb)!.push({ idx: i, other: segments[i].a, otherKey: ka });
  }

  const used = new Set<number>();
  const contours: GPUContour[] = [];

  for (let start = 0; start < segments.length; start++) {
    if (used.has(start)) continue;
    used.add(start);

    const chain: Point2D[] = [segments[start].a, segments[start].b];
    let currentKey = key(segments[start].b);
    const startKey = key(segments[start].a);

    let safety = segments.length + 10;
    while (currentKey !== startKey && safety-- > 0) {
      const neighbors = adj.get(currentKey);
      if (!neighbors) break;
      let found = false;
      for (const nb of neighbors) {
        if (!used.has(nb.idx)) {
          used.add(nb.idx);
          chain.push(nb.other);
          currentKey = nb.otherKey;
          found = true;
          break;
        }
      }
      if (!found) break;
    }

    // Only keep closed contours with enough points
    if (chain.length >= 4 && dist2D(chain[0], chain[chain.length - 1]) < eps * 20) {
      const area = shoelaceArea(chain);
      const absArea = Math.abs(area);

      // Skip tiny contours (noise)
      if (absArea < eps * eps * 10) continue;

      contours.push({
        points: chain,
        area,
        isOuter: area > 0,
      });
    }
  }

  return contours;
}

// ═══════════════════════════════════════════════════════════════
// Contour Simplification (Douglas-Peucker)
// ═══════════════════════════════════════════════════════════════

function perpDist(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-20) return dist2D(p, a);
  return Math.abs(dx * (a.y - p.y) - (a.x - p.x) * dy) / Math.sqrt(len2);
}

function simplifyContour(pts: Point2D[], epsilon: number): Point2D[] {
  if (pts.length <= 3) return pts;

  let maxDist = 0, maxIdx = 0;
  const first = pts[0], last = pts[pts.length - 1];

  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], first, last);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }

  if (maxDist > epsilon) {
    const left = simplifyContour(pts.slice(0, maxIdx + 1), epsilon);
    const right = simplifyContour(pts.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

// ═══════════════════════════════════════════════════════════════
// Main GPU Slice Function
// ═══════════════════════════════════════════════════════════════

/**
 * GPU-accelerated cross-section extraction.
 *
 * @param renderer Three.js WebGLRenderer (shared with main viewport)
 * @param meshSource The imported mesh (THREE.Group or Mesh)
 * @param plane The slice plane definition
 * @param resolution Render resolution (default 2048)
 * @returns Precise contours in the plane's local 2D coordinates
 */
export function gpuSlice(
  renderer: THREE.WebGLRenderer,
  meshSource: THREE.Object3D,
  plane: SlicePlane,
  resolution = 2048,
): GPUSliceResult {
  const t0 = performance.now();

  const { field, width, height, uAxis, vAxis, planeOrigin, pixelSize, halfW, halfH } =
    renderWindingField(renderer, meshSource, plane, resolution);

  if (width === 0 || height === 0) {
    return {
      plane, contours: [], resolution, pixelSize: 0,
      timeMs: performance.now() - t0, uAxis: new THREE.Vector3(), vAxis: new THREE.Vector3(),
      planeOrigin: plane.origin.clone(),
    };
  }

  // ── Force a 2-pixel zero border on the winding field ──
  // This ensures marching squares always finds an outside→inside boundary,
  // even when the cross-section fills the entire viewport (e.g. thin sheet
  // models viewed face-on → winding = 1 everywhere → case-15 skipped).
  const BORDER = 2;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (row < BORDER || row >= height - BORDER || col < BORDER || col >= width - BORDER) {
        field[row * width + col] = 0;
      }
    }
  }

  // ── Marching squares → segments → contours ──
  const segments = marchingSquares(field, width, height, halfW, halfH);
  const eps = pixelSize * 0.5;
  const rawContours = chainMarchSegments(segments, eps);

  // ── Simplify contours (remove redundant marching-squares points) ──
  const simplifyEps = pixelSize * 0.3; // sub-pixel simplification
  const contours: GPUContour[] = rawContours.map(c => ({
    ...c,
    points: simplifyContour(c.points, simplifyEps),
  })).filter(c => c.points.length >= 4);

  return {
    plane,
    contours,
    resolution,
    pixelSize,
    timeMs: performance.now() - t0,
    uAxis,
    vAxis,
    planeOrigin,
  };
}

// ═══════════════════════════════════════════════════════════════
// Full Pipeline: Geometry-Driven Planes → GPU slice → Fit entities
// ═══════════════════════════════════════════════════════════════

export interface GPUFittedPlane {
  plane: SlicePlane;
  sliceResult: GPUSliceResult;
  /** Entity fitting results per contour */
  contours: {
    entities: import('./sketch-fitting').SketchEntity[];
    constraints: import('./sketch-fitting').SketchConstraint[];
    originalPoints: Point2D[];
    error: { maxError: number; avgError: number; coverage: number };
  }[];
  /** Total entity count for this plane */
  entityCount: number;
}

/**
 * ⚒️ Geometry-Driven GPU Scanner Pipeline:
 *
 * 1. Detect ALL significant planar directions from mesh normals
 *    (2° tight cluster → filter noise → 5° merge)
 * 2. Generate adaptive depth slices per direction
 * 3. GPU winding-number render for each plane
 * 4. Marching squares → sub-pixel contours
 * 5. Entity fitting → minimal lines + arcs + circles
 *
 * The number of planes is determined by the GEOMETRY, not a fixed grid.
 * A simple plate might produce 30 planes; a complex machined part 500+.
 * This replaces the previous 462 brute-force sweep which was:
 *   - Overkill for simple parts (hundreds of empty planes)
 *   - Insufficient for complex parts (missed angled features)
 */
export async function gpuFitPipeline(
  renderer: THREE.WebGLRenderer,
  meshSource: THREE.Object3D,
  opts?: {
    resolution?: number;
    /** Max depth slices per direction (default: 10) */
    maxDepthSlices?: number;
    /** Minimum area percentage to include a direction (default: 0.1) */
    minAreaPct?: number;
    onProgress?: (done: number, total: number, label: string) => void;
  },
): Promise<GPUFittedPlane[]> {
  // Dynamic import to avoid circular deps
  const { fitContour, reconstructionError } = await import('./sketch-fitting');

  const resolution = opts?.resolution ?? 2048;

  // ── Step 1: Generate geometry-driven planes ──
  opts?.onProgress?.(0, 1, 'Detecting geometry planes...');

  const slicePlanes = generateGeometryPlanes(meshSource, {
    maxDepthSlices: opts?.maxDepthSlices,
    minAreaPct: opts?.minAreaPct,
  });

  if (slicePlanes.length === 0) return [];

  // ── Step 2: GPU slice each plane ──
  const results: GPUFittedPlane[] = [];

  // Compute global bounding box for tolerance
  const bb = new THREE.Box3();
  let meshCount = 0;
  meshSource.traverse(c => { if (c instanceof THREE.Mesh) { bb.expandByObject(c); meshCount++; } });
  const diag = bb.getSize(new THREE.Vector3()).length();
  const tol = Math.max(0.001, diag * 0.0001);

  console.log(`[gpuFitPipeline] meshCount=${meshCount}, diag=${diag.toFixed(2)}, bb=[${bb.min.toArray().map(v=>v.toFixed(2))}, ${bb.max.toArray().map(v=>v.toFixed(2))}], planes=${slicePlanes.length}`);

  if (meshCount === 0) {
    console.warn('[gpuFitPipeline] No THREE.Mesh found in meshSource! Children:', meshSource.children.map(c => c.type));
    return [];
  }

  for (let pi = 0; pi < slicePlanes.length; pi++) {
    const plane = slicePlanes[pi];
    opts?.onProgress?.(pi, slicePlanes.length, `GPU slice: ${plane.label}`);

    const sliceResult = gpuSlice(renderer, meshSource, plane, resolution);
    if (sliceResult.contours.length === 0) {
      if (pi === 0) console.log(`[gpuFitPipeline] Plane 0 (${plane.label}): 0 contours, pixelSize=${sliceResult.pixelSize.toFixed(6)}`);
      continue;
    }

    // ── Step 3: Fit entities to each contour ──
    const fittedContours: GPUFittedPlane['contours'] = [];

    for (const contour of sliceResult.contours) {
      if (contour.points.length < 6) continue;

      const { entities, constraints } = fitContour(contour.points, tol);
      if (entities.length === 0) continue;

      const error = reconstructionError(contour.points, entities, tol);
      fittedContours.push({
        entities,
        constraints,
        originalPoints: contour.points,
        error,
      });
    }

    if (fittedContours.length > 0) {
      results.push({
        plane,
        sliceResult,
        contours: fittedContours,
        entityCount: fittedContours.reduce((s, c) => s + c.entities.length, 0),
      });
    }

    // Yield to keep UI responsive
    if (pi % 2 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  opts?.onProgress?.(slicePlanes.length, slicePlanes.length, 'Done');
  return results;
}
