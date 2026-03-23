/**
 * ⚒️ La Forja de Hefestos — Reverse Engineering Engine
 * =====================================================
 * Decompose imported CAD models (STEP/IGES/BREP) into parametric SDF
 * primitives with auto-generated variables. This is "Feature Recognition"
 * — the inverse of CAD modeling.
 *
 * Pipeline:
 * 1. Import STEP → OpenCASCADE WASM → triangulated meshes with B-Rep faces
 * 2. For each mesh: analyze bounding box + normals + curvature
 * 3. Fit SDF primitives: box, cylinder, sphere, cone
 * 4. Build CSG tree with boolean operations
 * 5. Auto-generate named variables for all dimensions
 *
 * Surface detection via geometric analysis:
 * - Planar face: all normals parallel → Box candidate
 * - Cylindrical face: normals converge on axis → Cylinder candidate
 * - Spherical face: normals converge on point → Sphere candidate
 * - Conical face: normals converge but angle varies → Cone candidate
 * - Toroidal face: normals follow torus pattern → Torus candidate
 */

import * as THREE from 'three';
import type { ImportedModel, ImportedMesh, DecomposedComponent } from './step-import';
import { decomposeAssembly } from './step-import';
import {
  type SdfNode,
  type SdfPrimitive,
  type SdfOperation,
  type SdfModule,
  makeSphere,
  makeBox,
  makeCylinder,
  makeTorus,
  makeCone,
  makeOp,
  makeModule,
} from './sdf-engine';
import {
  type GaiaVariable,
  createVariable,
} from './gaia-variables';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type DetectedPrimitiveType = 'box' | 'cylinder' | 'sphere' | 'cone' | 'torus' | 'unknown';

export interface DetectedPrimitive {
  type: DetectedPrimitiveType;
  confidence: number;      // 0–1
  center: [number, number, number];
  rotation: [number, number, number];
  params: Record<string, number>;
  label: string;
  /** The source mesh or face group this was detected from */
  sourceTriCount: number;
  /** Bounding box of the source geometry */
  bbox: { min: THREE.Vector3; max: THREE.Vector3; size: THREE.Vector3 };
}

export interface ReverseEngineeredModel {
  /** SDF scene tree representing the detected features */
  scene: SdfOperation;
  /** Auto-generated variables for all detected dimensions */
  variables: GaiaVariable[];
  /** List of detected primitives with their confidence */
  detectedPrimitives: DetectedPrimitive[];
  /** Statistics */
  stats: {
    totalComponents: number;
    detectedFeatures: number;
    unknownFeatures: number;
    averageConfidence: number;
    processingTimeMs: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// Geometry Analysis Utilities
// ═══════════════════════════════════════════════════════════════

/** Extract triangle positions from a geometry within a face range */
function extractFaceTriangles(
  geo: THREE.BufferGeometry,
  firstTri: number,
  lastTri: number,
): Float32Array {
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const index = geo.getIndex();
  const triCount = lastTri - firstTri + 1;
  const points = new Float32Array(triCount * 9); // 3 verts × 3 comps

  for (let t = 0; t < triCount; t++) {
    const triIdx = firstTri + t;
    for (let v = 0; v < 3; v++) {
      const vi = index ? index.getX(triIdx * 3 + v) : triIdx * 3 + v;
      points[t * 9 + v * 3 + 0] = posAttr.getX(vi);
      points[t * 9 + v * 3 + 1] = posAttr.getY(vi);
      points[t * 9 + v * 3 + 2] = posAttr.getZ(vi);
    }
  }
  return points;
}

/** Compute normal for a triangle from 3 positions */
function triNormal(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3): THREE.Vector3 {
  const ab = new THREE.Vector3().subVectors(p1, p0);
  const ac = new THREE.Vector3().subVectors(p2, p0);
  return ab.cross(ac).normalize();
}

/** Compute the bounding box of a point array */
function computeBBox(points: Float32Array): { min: THREE.Vector3; max: THREE.Vector3; size: THREE.Vector3; center: THREE.Vector3 } {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

  for (let i = 0; i < points.length; i += 3) {
    min.x = Math.min(min.x, points[i]);
    min.y = Math.min(min.y, points[i + 1]);
    min.z = Math.min(min.z, points[i + 2]);
    max.x = Math.max(max.x, points[i]);
    max.y = Math.max(max.y, points[i + 1]);
    max.z = Math.max(max.z, points[i + 2]);
  }

  const size = new THREE.Vector3().subVectors(max, min);
  const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
  return { min, max, size, center };
}

/** Compute normals for all triangles in a geometry */
function computeTriNormals(geo: THREE.BufferGeometry): THREE.Vector3[] {
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const index = geo.getIndex();
  const triCount = index ? index.count / 3 : posAttr.count / 3;
  const normals: THREE.Vector3[] = [];

  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();

  for (let t = 0; t < triCount; t++) {
    const i0 = index ? index.getX(t * 3) : t * 3;
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;

    p0.set(posAttr.getX(i0), posAttr.getY(i0), posAttr.getZ(i0));
    p1.set(posAttr.getX(i1), posAttr.getY(i1), posAttr.getZ(i1));
    p2.set(posAttr.getX(i2), posAttr.getY(i2), posAttr.getZ(i2));

    normals.push(triNormal(p0, p1, p2));
  }

  return normals;
}

/** Compute what fraction of normals are aligned with the given axis direction */
function normalAlignment(normals: THREE.Vector3[], axis: THREE.Vector3, threshold = 0.95): number {
  let aligned = 0;
  for (const n of normals) {
    if (Math.abs(n.dot(axis)) > threshold) aligned++;
  }
  return aligned / normals.length;
}

/** Compute the principal axis of a set of normals (the direction with most normal variance) */
function principalNormalAxis(normals: THREE.Vector3[]): THREE.Vector3 {
  // Simple approach: compute the normal that's most "spread" — the axis perpendicular to most normals
  // For a cylinder: normals fan out radially, the axis is perpendicular to all of them
  // Compute covariance matrix of normals and find the eigenvector with smallest eigenvalue
  
  const N = normals.length;
  if (N === 0) return new THREE.Vector3(0, 1, 0);

  // Mean normal
  const mean = new THREE.Vector3();
  for (const n of normals) mean.add(n);
  mean.divideScalar(N);

  // Covariance matrix (3×3 symmetric)
  let cxx = 0, cxy = 0, cxz = 0, cyy = 0, cyz = 0, czz = 0;
  for (const n of normals) {
    const dx = n.x - mean.x, dy = n.y - mean.y, dz = n.z - mean.z;
    cxx += dx * dx; cxy += dx * dy; cxz += dx * dz;
    cyy += dy * dy; cyz += dy * dz; czz += dz * dz;
  }
  cxx /= N; cxy /= N; cxz /= N; cyy /= N; cyz /= N; czz /= N;

  // Power iteration to find dominant eigenvector (max variance direction)
  let v = new THREE.Vector3(1, 1, 1).normalize();
  for (let iter = 0; iter < 20; iter++) {
    const nx = cxx * v.x + cxy * v.y + cxz * v.z;
    const ny = cxy * v.x + cyy * v.y + cyz * v.z;
    const nz = cxz * v.x + cyz * v.y + czz * v.z;
    v.set(nx, ny, nz);
    const len = v.length();
    if (len < 1e-10) break;
    v.divideScalar(len);
  }

  return v;
}

/** Estimate if points lie on a sphere. Returns {center, radius, error} */
function fitSphere(points: Float32Array): { center: THREE.Vector3; radius: number; error: number } {
  const bbox = computeBBox(points);
  const c = bbox.center;
  
  // Average distance from center = estimated radius
  let sumDist = 0;
  let count = 0;
  for (let i = 0; i < points.length; i += 3) {
    const dx = points[i] - c.x;
    const dy = points[i + 1] - c.y;
    const dz = points[i + 2] - c.z;
    sumDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
    count++;
  }
  const radius = sumDist / count;

  // Error: standard deviation of distances from center
  let sumErr = 0;
  for (let i = 0; i < points.length; i += 3) {
    const dx = points[i] - c.x;
    const dy = points[i + 1] - c.y;
    const dz = points[i + 2] - c.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    sumErr += (dist - radius) * (dist - radius);
  }
  const error = Math.sqrt(sumErr / count) / radius; // normalized error

  return { center: c, radius, error };
}

/** Estimate if points lie on a cylinder. Returns {center, axis, radius, height, error} */
function fitCylinder(
  points: Float32Array,
  normals: THREE.Vector3[],
): { center: THREE.Vector3; axis: THREE.Vector3; radius: number; height: number; error: number } {
  const bbox = computeBBox(points);
  
  // The axis of the cylinder is perpendicular to the normals (smallest eigenvalue)
  // For cylindrical faces, normals all point radially outward
  // The principal normal axis IS the axis direction most normals live in plane perpendicular to
  const normalAxis = principalNormalAxis(normals);
  
  // Try all 3 principal axes and pick the one where projecting points onto the plane
  // perpendicular to that axis gives the most circular distribution
  const axes = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
    normalAxis,
  ];

  let bestAxis = new THREE.Vector3(0, 1, 0);
  let bestError = Infinity;
  let bestRadius = 0;
  let bestCenter2D = { x: 0, y: 0 };

  for (const testAxis of axes) {
    // Project points onto plane perpendicular to testAxis
    // Use the axis with the best circular fit
    const up = testAxis;
    const right = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    
    // Find orthogonal basis
    if (Math.abs(up.x) < 0.9) {
      right.crossVectors(up, new THREE.Vector3(1, 0, 0)).normalize();
    } else {
      right.crossVectors(up, new THREE.Vector3(0, 1, 0)).normalize();
    }
    fwd.crossVectors(up, right).normalize();

    // Project all points into 2D (right, fwd) plane
    const proj2D: { x: number; y: number }[] = [];
    let cx = 0, cy = 0;
    for (let i = 0; i < points.length; i += 3) {
      const p = new THREE.Vector3(points[i], points[i + 1], points[i + 2]);
      const x = p.dot(right);
      const y = p.dot(fwd);
      proj2D.push({ x, y });
      cx += x;
      cy += y;
    }
    cx /= proj2D.length;
    cy /= proj2D.length;

    // Average distance from center in 2D = radius
    let sumR = 0;
    for (const p of proj2D) {
      sumR += Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
    }
    const r = sumR / proj2D.length;

    // Error: normalized std dev
    let sumE = 0;
    for (const p of proj2D) {
      const d = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
      sumE += (d - r) * (d - r);
    }
    const err = r > 0.001 ? Math.sqrt(sumE / proj2D.length) / r : Infinity;

    if (err < bestError) {
      bestError = err;
      bestAxis = up.clone();
      bestRadius = r;
      bestCenter2D = { x: cx, y: cy };
    }
  }

  // Height = extent along the axis
  let minProj = Infinity, maxProj = -Infinity;
  for (let i = 0; i < points.length; i += 3) {
    const p = new THREE.Vector3(points[i], points[i + 1], points[i + 2]);
    const proj = p.dot(bestAxis);
    minProj = Math.min(minProj, proj);
    maxProj = Math.max(maxProj, proj);
  }
  const height = maxProj - minProj;
  const axisCenter = (minProj + maxProj) / 2;

  // Reconstruct 3D center from 2D center + axis center
  const right2 = new THREE.Vector3();
  const fwd2 = new THREE.Vector3();
  if (Math.abs(bestAxis.x) < 0.9) {
    right2.crossVectors(bestAxis, new THREE.Vector3(1, 0, 0)).normalize();
  } else {
    right2.crossVectors(bestAxis, new THREE.Vector3(0, 1, 0)).normalize();
  }
  fwd2.crossVectors(bestAxis, right2).normalize();

  const center = new THREE.Vector3()
    .addScaledVector(bestAxis, axisCenter)
    .addScaledVector(right2, bestCenter2D.x)
    .addScaledVector(fwd2, bestCenter2D.y);

  return { center, axis: bestAxis, radius: bestRadius, height, error: bestError };
}

// ═══════════════════════════════════════════════════════════════
// Feature Detection — Analyze a single mesh/component
// ═══════════════════════════════════════════════════════════════

/**
 * Analyze a single mesh and detect what geometric primitive it most
 * likely represents. Uses bounding box analysis + normal distribution.
 */
function detectPrimitive(mesh: ImportedMesh, scale: number): DetectedPrimitive {
  const geo = mesh.geometry;
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;

  if (!posAttr || posAttr.count < 3) {
    return makeUnknown(mesh, scale);
  }

  const bbox = new THREE.Box3();
  geo.computeBoundingBox();
  bbox.copy(geo.boundingBox!);

  const size = bbox.getSize(new THREE.Vector3()).multiplyScalar(scale);
  const center = bbox.getCenter(new THREE.Vector3()).multiplyScalar(scale);
  const maxDim = Math.max(size.x, size.y, size.z);
  const minDim = Math.min(size.x, size.y, size.z);
  const index = geo.getIndex();
  const triCount = index ? index.count / 3 : posAttr.count / 3;

  // Get all triangle normals
  const normals = computeTriNormals(geo);

  // Get all positions as Float32Array
  const allPoints = new Float32Array(posAttr.count * 3);
  for (let i = 0; i < posAttr.count; i++) {
    allPoints[i * 3 + 0] = posAttr.getX(i) * scale;
    allPoints[i * 3 + 1] = posAttr.getY(i) * scale;
    allPoints[i * 3 + 2] = posAttr.getZ(i) * scale;
  }

  const bboxResult = { min: bbox.min.clone().multiplyScalar(scale), max: bbox.max.clone().multiplyScalar(scale), size };

  // ── Test 1: Is it a Box? ──
  // Boxes have normals aligned with exactly 3 axes (±X, ±Y, ±Z)
  // and the bounding box is tight (aspect ratios don't matter)
  {
    const axisX = new THREE.Vector3(1, 0, 0);
    const axisY = new THREE.Vector3(0, 1, 0);
    const axisZ = new THREE.Vector3(0, 0, 1);

    const alignX = normalAlignment(normals, axisX, 0.92);
    const alignY = normalAlignment(normals, axisY, 0.92);
    const alignZ = normalAlignment(normals, axisZ, 0.92);
    const totalAligned = alignX + alignY + alignZ;

    // A perfect box: 100% of normals aligned with axes
    // Allow some fillets/chamfers: >85% aligned
    if (totalAligned > 0.85 && triCount <= 500) {
      return {
        type: 'box',
        confidence: Math.min(totalAligned, 1),
        center: [center.x, center.y, center.z],
        rotation: [0, 0, 0],
        params: { sizeX: size.x, sizeY: size.y, sizeZ: size.z },
        label: mesh.name || 'Caja detectada',
        sourceTriCount: triCount,
        bbox: bboxResult,
      };
    }
  }

  // ── Test 2: Is it a Sphere? ──
  // Spheres have normals pointing radially outward from center
  // and all points are equidistant from center
  {
    const sphereResult = fitSphere(allPoints);
    // Good sphere: error < 3% and bounding box is roughly cubic
    const sizeRatio = minDim / maxDim;
    if (sphereResult.error < 0.03 && sizeRatio > 0.85) {
      return {
        type: 'sphere',
        confidence: Math.max(0, 1 - sphereResult.error * 10),
        center: [sphereResult.center.x, sphereResult.center.y, sphereResult.center.z],
        rotation: [0, 0, 0],
        params: { radius: sphereResult.radius },
        label: mesh.name || 'Esfera detectada',
        sourceTriCount: triCount,
        bbox: bboxResult,
      };
    }
  }

  // ── Test 3: Is it a Cylinder? ──
  // Cylinders have normals in a plane (radial), and one axis has consistent extent
  {
    const cylResult = fitCylinder(allPoints, normals);
    if (cylResult.error < 0.05 && cylResult.radius > 0.001) {
      // Determine rotation from the detected axis
      const axis = cylResult.axis;
      const rotation = axisToEuler(axis);

      return {
        type: 'cylinder',
        confidence: Math.max(0, 1 - cylResult.error * 8),
        center: [cylResult.center.x, cylResult.center.y, cylResult.center.z],
        rotation,
        params: { radius: cylResult.radius, height: cylResult.height },
        label: mesh.name || 'Cilindro detectado',
        sourceTriCount: triCount,
        bbox: bboxResult,
      };
    }
  }

  // ── Test 4: Is it a Cone? ──
  // Cones are like cylinders but with varying radius along the axis
  {
    const cylResult = fitCylinder(allPoints, normals);
    // If cylinder fit is moderate but not great, might be a cone
    if (cylResult.error > 0.05 && cylResult.error < 0.15) {
      // Check if radius varies linearly along the axis
      const axis = cylResult.axis;
      let minH = Infinity, maxH = -Infinity;
      const radii: { h: number; r: number }[] = [];

      for (let i = 0; i < allPoints.length; i += 3) {
        const p = new THREE.Vector3(allPoints[i], allPoints[i + 1], allPoints[i + 2]);
        const h = p.dot(axis);
        const proj = axis.clone().multiplyScalar(h);
        const radial = p.clone().sub(cylResult.center).sub(proj);
        const r = radial.length();
        radii.push({ h, r });
        minH = Math.min(minH, h);
        maxH = Math.max(maxH, h);
      }

      // Fit linear regression: r = a*h + b
      const height = maxH - minH;
      if (height > 0.001) {
        const n = radii.length;
        let sumH = 0, sumR = 0, sumHR = 0, sumHH = 0;
        for (const { h, r } of radii) {
          sumH += h; sumR += r; sumHR += h * r; sumHH += h * h;
        }
        const a = (n * sumHR - sumH * sumR) / (n * sumHH - sumH * sumH);
        
        // Significat slope → cone
        if (Math.abs(a) > 0.05) {
          const rBase = sumR / n; // average radius
          const rotation = axisToEuler(axis);
          return {
            type: 'cone',
            confidence: 0.65,
            center: [cylResult.center.x, cylResult.center.y, cylResult.center.z],
            rotation,
            params: { radius: rBase, height },
            label: mesh.name || 'Cono detectado',
            sourceTriCount: triCount,
            bbox: bboxResult,
          };
        }
      }
    }
  }

  // ── Test 5: Could it be a Torus? ──
  // Torus has a "donut hole" — the bounding box aspect ratio is close to square in two axes
  // and there's a characteristic ring pattern in the point distribution
  {
    const sortedDims = [size.x, size.y, size.z].sort((a, b) => b - a);
    const flatness = sortedDims[2] / sortedDims[0]; // smallest / largest
    const squareness = sortedDims[1] / sortedDims[0]; // middle / largest
    
    // Torus: two large dims similar, one small dim
    if (squareness > 0.7 && flatness < 0.5 && flatness > 0.05) {
      // Determine which axis is the "thin" one (minor axis of torus)
      const dims = [
        { axis: 'y', size: size.x, idx: 0 },
        { axis: 'y', size: size.y, idx: 1 },
        { axis: 'z', size: size.z, idx: 2 },
      ].sort((a, b) => a.size - b.size);
      
      const minorRadius = dims[0].size / 2;
      const majorRadius = (dims[1].size + dims[2].size) / 4 - minorRadius;

      if (majorRadius > minorRadius * 1.5) {
        return {
          type: 'torus',
          confidence: 0.55,
          center: [center.x, center.y, center.z],
          rotation: [0, 0, 0],
          params: { majorRadius, minorRadius },
          label: mesh.name || 'Toroide detectado',
          sourceTriCount: triCount,
          bbox: bboxResult,
        };
      }
    }
  }

  // ── Fallback: best-fit box ──
  return makeUnknown(mesh, scale);
}

function makeUnknown(mesh: ImportedMesh, scale: number): DetectedPrimitive {
  const geo = mesh.geometry;
  geo.computeBoundingBox();
  const bbox = geo.boundingBox!;
  const size = bbox.getSize(new THREE.Vector3()).multiplyScalar(scale);
  const center = bbox.getCenter(new THREE.Vector3()).multiplyScalar(scale);
  const index = geo.getIndex();
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const triCount = index ? index.count / 3 : (posAttr?.count ?? 0) / 3;

  return {
    type: 'unknown',
    confidence: 0.2,
    center: [center.x, center.y, center.z],
    rotation: [0, 0, 0],
    params: { sizeX: size.x, sizeY: size.y, sizeZ: size.z },
    label: mesh.name || 'Componente',
    sourceTriCount: triCount,
    bbox: {
      min: bbox.min.clone().multiplyScalar(scale),
      max: bbox.max.clone().multiplyScalar(scale),
      size,
    },
  };
}

/** Convert an axis vector to Euler XYZ rotation */
function axisToEuler(axis: THREE.Vector3): [number, number, number] {
  // Default SDF cylinder is along Y axis
  const defaultAxis = new THREE.Vector3(0, 1, 0);
  if (axis.dot(defaultAxis) > 0.999) return [0, 0, 0];
  if (axis.dot(defaultAxis) < -0.999) return [Math.PI, 0, 0];

  const quat = new THREE.Quaternion().setFromUnitVectors(defaultAxis, axis.clone().normalize());
  const euler = new THREE.Euler().setFromQuaternion(quat, 'XYZ');
  return [euler.x, euler.y, euler.z];
}

// ═══════════════════════════════════════════════════════════════
// Main Reverse Engineering Pipeline
// ═══════════════════════════════════════════════════════════════

/**
 * Reverse engineer an imported CAD model into parametric SDF primitives.
 *
 * @param model - The imported model from STEP/IGES/BREP
 * @returns A reconstructed SDF scene + auto-generated variables
 */
export function reverseEngineerModel(model: ImportedModel): ReverseEngineeredModel {
  const t0 = performance.now();

  // Determine the model's scale factor (matching step-import auto-scale)
  const bbox = new THREE.Box3().setFromObject(model.threeGroup);
  const size = bbox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  let scale = 1;
  if (maxDim > 100) scale = 10 / maxDim;
  else if (maxDim < 0.1) scale = 5 / maxDim;

  // Analyze each mesh independently
  const detected: DetectedPrimitive[] = [];
  for (const mesh of model.meshes) {
    if (!mesh.geometry.getAttribute('position')) continue;
    const prim = detectPrimitive(mesh, scale);
    detected.push(prim);
  }

  // Convert detected primitives to SDF nodes
  const sdfNodes: SdfNode[] = [];
  const variables: GaiaVariable[] = [];
  let varIdx = 0;

  for (let i = 0; i < detected.length; i++) {
    const det = detected[i];
    const name = sanitizeName(det.label || `part${i + 1}`);
    const prefix = `${name}`;

    let node: SdfPrimitive;
    switch (det.type) {
      case 'box':
        node = makeBox(det.center as [number, number, number],
          [det.params.sizeX, det.params.sizeY, det.params.sizeZ]);
        node.label = det.label;
        variables.push(
          createDimVar(`${prefix}_ancho`, det.params.sizeX, 'Ancho (X)', node.id, 'sizeX', ++varIdx),
          createDimVar(`${prefix}_alto`, det.params.sizeY, 'Alto (Y)', node.id, 'sizeY', ++varIdx),
          createDimVar(`${prefix}_prof`, det.params.sizeZ, 'Prof. (Z)', node.id, 'sizeZ', ++varIdx),
        );
        break;

      case 'sphere':
        node = makeSphere(det.center as [number, number, number], det.params.radius);
        node.label = det.label;
        variables.push(
          createDimVar(`${prefix}_radio`, det.params.radius, 'Radio', node.id, 'radius', ++varIdx),
        );
        break;

      case 'cylinder':
        node = makeCylinder(det.center as [number, number, number], det.params.radius, det.params.height);
        node.label = det.label;
        node.rotation = det.rotation;
        variables.push(
          createDimVar(`${prefix}_radio`, det.params.radius, 'Radio', node.id, 'radius', ++varIdx),
          createDimVar(`${prefix}_altura`, det.params.height, 'Altura', node.id, 'height', ++varIdx),
        );
        break;

      case 'cone':
        node = makeCone(det.center as [number, number, number], det.params.radius, det.params.height);
        node.label = det.label;
        node.rotation = det.rotation;
        variables.push(
          createDimVar(`${prefix}_radio`, det.params.radius, 'Radio', node.id, 'radius', ++varIdx),
          createDimVar(`${prefix}_altura`, det.params.height, 'Altura', node.id, 'height', ++varIdx),
        );
        break;

      case 'torus':
        node = makeTorus(det.center as [number, number, number], det.params.majorRadius, det.params.minorRadius);
        node.label = det.label;
        variables.push(
          createDimVar(`${prefix}_Rmajor`, det.params.majorRadius, 'R Mayor', node.id, 'majorRadius', ++varIdx),
          createDimVar(`${prefix}_Rmenor`, det.params.minorRadius, 'R Menor', node.id, 'minorRadius', ++varIdx),
        );
        break;

      default:
        // Unknown → approximate as a box from bounding box
        node = makeBox(det.center as [number, number, number],
          [det.params.sizeX ?? 1, det.params.sizeY ?? 1, det.params.sizeZ ?? 1]);
        node.label = `${det.label} (≈)`;
        variables.push(
          createDimVar(`${prefix}_ancho`, det.params.sizeX ?? 1, 'Ancho ≈', node.id, 'sizeX', ++varIdx),
          createDimVar(`${prefix}_alto`, det.params.sizeY ?? 1, 'Alto ≈', node.id, 'sizeY', ++varIdx),
          createDimVar(`${prefix}_prof`, det.params.sizeZ ?? 1, 'Prof ≈', node.id, 'sizeZ', ++varIdx),
        );
        break;
    }

    // Add position variables
    variables.push(
      createPosVar(`${prefix}_x`, det.center[0], 'Pos X', node.id, ++varIdx),
      createPosVar(`${prefix}_y`, det.center[1], 'Pos Y', node.id, ++varIdx),
      createPosVar(`${prefix}_z`, det.center[2], 'Pos Z', node.id, ++varIdx),
    );

    sdfNodes.push(node);
  }

  // Build the scene tree
  // If we have many primitives, group them into a module
  const scene = makeOp('union', sdfNodes);

  const elapsed = performance.now() - t0;
  const unknowns = detected.filter(d => d.type === 'unknown').length;
  const avgConf = detected.length > 0
    ? detected.reduce((s, d) => s + d.confidence, 0) / detected.length
    : 0;

  return {
    scene,
    variables,
    detectedPrimitives: detected,
    stats: {
      totalComponents: model.meshes.length,
      detectedFeatures: detected.length - unknowns,
      unknownFeatures: unknowns,
      averageConfidence: avgConf,
      processingTimeMs: elapsed,
    },
  };
}

/**
 * Reverse engineer with assembly decomposition — creates SDF modules
 * for each named component in the STEP assembly.
 */
export function reverseEngineerAssembly(model: ImportedModel): ReverseEngineeredModel {
  const t0 = performance.now();
  const components = decomposeAssembly(model);

  // Determine scale
  const bbox = new THREE.Box3().setFromObject(model.threeGroup);
  const size = bbox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  let scale = 1;
  if (maxDim > 100) scale = 10 / maxDim;
  else if (maxDim < 0.1) scale = 5 / maxDim;

  const allDetected: DetectedPrimitive[] = [];
  const allVariables: GaiaVariable[] = [];
  const modules: SdfNode[] = [];
  let varIdx = 0;

  // Group by leaf components (components with meshes)
  const leafComponents = components.filter(c => c.meshCount > 0);

  for (const comp of leafComponents) {
    const modName = sanitizeName(comp.name);
    const mod = makeModule(modName);
    const children: SdfNode[] = [];

    for (const meshIdx of comp.meshIndices) {
      const mesh = model.meshes[meshIdx];
      if (!mesh || !mesh.geometry.getAttribute('position')) continue;

      const det = detectPrimitive(mesh, scale);
      det.label = `${modName}_${det.type}`;
      allDetected.push(det);

      const prefix = sanitizeName(det.label);
      let node: SdfPrimitive;

      switch (det.type) {
        case 'box':
          node = makeBox(det.center as [number, number, number],
            [det.params.sizeX, det.params.sizeY, det.params.sizeZ]);
          node.label = det.label;
          allVariables.push(
            createDimVar(`${prefix}_ancho`, det.params.sizeX, 'Ancho', node.id, 'sizeX', ++varIdx),
            createDimVar(`${prefix}_alto`, det.params.sizeY, 'Alto', node.id, 'sizeY', ++varIdx),
            createDimVar(`${prefix}_prof`, det.params.sizeZ, 'Prof', node.id, 'sizeZ', ++varIdx),
          );
          break;

        case 'sphere':
          node = makeSphere(det.center as [number, number, number], det.params.radius);
          node.label = det.label;
          allVariables.push(
            createDimVar(`${prefix}_radio`, det.params.radius, 'Radio', node.id, 'radius', ++varIdx),
          );
          break;

        case 'cylinder':
          node = makeCylinder(det.center as [number, number, number], det.params.radius, det.params.height);
          node.label = det.label;
          node.rotation = det.rotation;
          allVariables.push(
            createDimVar(`${prefix}_radio`, det.params.radius, 'Radio', node.id, 'radius', ++varIdx),
            createDimVar(`${prefix}_altura`, det.params.height, 'Altura', node.id, 'height', ++varIdx),
          );
          break;

        case 'cone':
          node = makeCone(det.center as [number, number, number], det.params.radius, det.params.height);
          node.label = det.label;
          node.rotation = det.rotation;
          allVariables.push(
            createDimVar(`${prefix}_radio`, det.params.radius, 'Radio', node.id, 'radius', ++varIdx),
            createDimVar(`${prefix}_altura`, det.params.height, 'Altura', node.id, 'height', ++varIdx),
          );
          break;

        case 'torus':
          node = makeTorus(det.center as [number, number, number], det.params.majorRadius, det.params.minorRadius);
          node.label = det.label;
          allVariables.push(
            createDimVar(`${prefix}_Rmajor`, det.params.majorRadius, 'R Mayor', node.id, 'majorRadius', ++varIdx),
            createDimVar(`${prefix}_Rmenor`, det.params.minorRadius, 'R Menor', node.id, 'minorRadius', ++varIdx),
          );
          break;

        default:
          node = makeBox(det.center as [number, number, number],
            [det.params.sizeX ?? 1, det.params.sizeY ?? 1, det.params.sizeZ ?? 1]);
          node.label = `${det.label} (≈)`;
          allVariables.push(
            createDimVar(`${prefix}_ancho`, det.params.sizeX ?? 1, '≈Ancho', node.id, 'sizeX', ++varIdx),
            createDimVar(`${prefix}_alto`, det.params.sizeY ?? 1, '≈Alto', node.id, 'sizeY', ++varIdx),
            createDimVar(`${prefix}_prof`, det.params.sizeZ ?? 1, '≈Prof', node.id, 'sizeZ', ++varIdx),
          );
          break;
      }

      children.push(node);
    }

    if (children.length > 0) {
      mod.children = children;
      modules.push(mod);
    }
  }

  const scene = makeOp('union', modules.length > 0 ? modules : []);

  const elapsed = performance.now() - t0;
  const unknowns = allDetected.filter(d => d.type === 'unknown').length;
  const avgConf = allDetected.length > 0
    ? allDetected.reduce((s, d) => s + d.confidence, 0) / allDetected.length
    : 0;

  return {
    scene,
    variables: allVariables,
    detectedPrimitives: allDetected,
    stats: {
      totalComponents: leafComponents.length,
      detectedFeatures: allDetected.length - unknowns,
      unknownFeatures: unknowns,
      averageConfidence: avgConf,
      processingTimeMs: elapsed,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_áéíóúñÁÉÍÓÚÑ ]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 30)
    .toLowerCase()
    || 'pieza';
}

function createDimVar(
  name: string,
  value: number,
  description: string,
  primId: string,
  paramKey: string,
  _idx: number,
): GaiaVariable {
  return createVariable(name, value.toFixed(4), {
    group: 'Rev. Engineering',
    unit: 'mm',
    description,
    source: 'auto',
    linkedPrimId: primId,
    linkedParamKey: paramKey,
  });
}

function createPosVar(
  name: string,
  value: number,
  description: string,
  primId: string,
  _idx: number,
): GaiaVariable {
  return createVariable(name, value.toFixed(4), {
    group: 'Posiciones',
    unit: 'mm',
    description: `${description}`,
    source: 'auto',
    linkedPrimId: primId,
  });
}
