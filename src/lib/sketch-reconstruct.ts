/**
 * ⚒️ La Forja de Hefestos — 3D Reconstruction from Fitted Sketches
 * ==================================================================
 * Takes fitted 2D sketch profiles (lines + arcs + circles) from cross-section
 * slices and reconstructs a 3D mesh by extruding profiles between consecutive
 * planes in the same direction.
 *
 * Algorithm:
 *  1. Group slices by direction (cluster similar normals)
 *  2. Within each group, sort by depth (offset along normal)
 *  3. Identify "bands" of consecutive slices with similar profiles
 *  4. For each band: SketchEntity[] → THREE.Shape → THREE.ExtrudeGeometry
 *  5. Position in 3D using plane basis vectors
 *
 * The result is a THREE.Group that can be added to the scene directly.
 */

import * as THREE from 'three';
import type { FittedSlice, FittedContour, SketchEntity, SketchArc } from './sketch-fitting';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface ReconstructionResult {
  /** Root group containing all extruded meshes */
  group: THREE.Group;
  /** Per-band metadata for UI */
  bands: BandInfo[];
  /** Timing */
  timeMs: number;
  /** Warnings */
  warnings: string[];
}

export interface BandInfo {
  /** Direction label (e.g. "Z", "X+30°") */
  directionLabel: string;
  /** Normal vector of this direction group */
  normal: [number, number, number];
  /** Depth range [min, max] along normal */
  depthRange: [number, number];
  /** Number of contours in this band */
  contourCount: number;
  /** Number of entities in the profile */
  entityCount: number;
  /** Reference to the THREE.Mesh for selection/highlighting */
  mesh: THREE.Mesh;
}

// ═══════════════════════════════════════════════════════════════
// Direction grouping
// ═══════════════════════════════════════════════════════════════

interface DirectionGroup {
  normal: THREE.Vector3;
  label: string;
  slices: { slice: FittedSlice; depth: number }[];
}

/**
 * Group slices by similar normal direction.
 * Two slices belong to the same group if their normals are within 5°.
 */
function groupByDirection(slices: FittedSlice[]): DirectionGroup[] {
  const groups: DirectionGroup[] = [];
  const COS_THRESHOLD = Math.cos(5 * Math.PI / 180); // 5° tolerance

  for (const slice of slices) {
    // Derive normal from axis or plane basis
    const normal = sliceNormal(slice);
    const depth = sliceDepth(slice, normal);

    // Find matching group
    let found = false;
    for (const g of groups) {
      if (Math.abs(g.normal.dot(normal)) > COS_THRESHOLD) {
        g.slices.push({ slice, depth });
        found = true;
        break;
      }
    }

    if (!found) {
      groups.push({
        normal: normal.clone(),
        label: normalLabel(normal),
        slices: [{ slice, depth }],
      });
    }
  }

  // Sort each group by depth
  for (const g of groups) {
    g.slices.sort((a, b) => a.depth - b.depth);
  }

  return groups;
}

function sliceNormal(s: FittedSlice): THREE.Vector3 {
  if (s.uAxis && s.vAxis) {
    const u = new THREE.Vector3(...s.uAxis);
    const v = new THREE.Vector3(...s.vAxis);
    return new THREE.Vector3().crossVectors(u, v).normalize();
  }
  // Fallback: use axis
  switch (s.axis) {
    case 'X': return new THREE.Vector3(1, 0, 0);
    case 'Y': return new THREE.Vector3(0, 1, 0);
    case 'Z': return new THREE.Vector3(0, 0, 1);
  }
}

function sliceDepth(s: FittedSlice, normal: THREE.Vector3): number {
  if (s.planeOrigin) {
    return new THREE.Vector3(...s.planeOrigin).dot(normal);
  }
  return s.value;
}

function normalLabel(n: THREE.Vector3): string {
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
  if (ax > 0.95) return n.x > 0 ? '+X' : '-X';
  if (ay > 0.95) return n.y > 0 ? '+Y' : '-Y';
  if (az > 0.95) return n.z > 0 ? '+Z' : '-Z';
  return `(${n.x.toFixed(2)},${n.y.toFixed(2)},${n.z.toFixed(2)})`;
}

// ═══════════════════════════════════════════════════════════════
// Profile similarity — detect bands of consistent profiles
// ═══════════════════════════════════════════════════════════════

interface ProfileBand {
  /** Representative slice (best quality / most entities) */
  representative: FittedSlice;
  /** Outer contour index in the representative slice */
  contourIndex: number;
  /** All slice indices in this band */
  sliceIndices: number[];
  /** Depth range */
  minDepth: number;
  maxDepth: number;
}

/**
 * For a direction group, identify bands of consecutive slices
 * that have similar outer profiles (same number of contours,
 * similar entity count and bounding box).
 */
function identifyBands(group: DirectionGroup): ProfileBand[] {
  const bands: ProfileBand[] = [];
  if (group.slices.length === 0) return bands;

  // For each slice, compute a profile signature
  const signatures = group.slices.map((s, i) => ({
    index: i,
    depth: s.depth,
    contourCount: s.slice.contours.length,
    entityCount: s.slice.contours.reduce((sum, c) => sum + c.entities.length, 0),
    // For each outer contour, store entity count as a fingerprint
    contourFingerprints: s.slice.contours.map(c => ({
      entityCount: c.entities.length,
      hasCircle: c.entities.some(e => e.type === 'arc' && (e as SketchArc).isFullCircle),
      lineCount: c.entities.filter(e => e.type === 'line').length,
      arcCount: c.entities.filter(e => e.type === 'arc').length,
    })),
  }));

  // Simple banding: group consecutive slices with same number of contours
  // and similar entity count (within 20%)
  let bandStart = 0;
  while (bandStart < signatures.length) {
    const ref = signatures[bandStart];
    let bandEnd = bandStart;

    for (let j = bandStart + 1; j < signatures.length; j++) {
      const cur = signatures[j];
      if (cur.contourCount !== ref.contourCount) break;
      // Allow some variation in entity count (recursiveFit might produce slightly different counts)
      const entRatio = Math.max(cur.entityCount, ref.entityCount) /
                       Math.max(1, Math.min(cur.entityCount, ref.entityCount));
      if (entRatio > 1.5) break;
      bandEnd = j;
    }

    // For each contour in the representative (pick the slice with most entities)
    let bestIdx = bandStart;
    let bestEnts = ref.entityCount;
    for (let j = bandStart; j <= bandEnd; j++) {
      if (signatures[j].entityCount > bestEnts) {
        bestEnts = signatures[j].entityCount;
        bestIdx = j;
      }
    }

    const repSlice = group.slices[bestIdx].slice;
    const sliceIndices: number[] = [];
    for (let j = bandStart; j <= bandEnd; j++) sliceIndices.push(j);

    // Create a band for each contour in the representative
    for (let ci = 0; ci < repSlice.contours.length; ci++) {
      bands.push({
        representative: repSlice,
        contourIndex: ci,
        sliceIndices,
        minDepth: group.slices[bandStart].depth,
        maxDepth: group.slices[bandEnd].depth,
      });
    }

    bandStart = bandEnd + 1;
  }

  return bands;
}

// ═══════════════════════════════════════════════════════════════
// Entity → THREE.Shape conversion
// ═══════════════════════════════════════════════════════════════

/** Arc segments for THREE.Path approximation */
const ARC_SEGMENTS = 32;

/**
 * Convert fitted sketch entities to a THREE.Shape (closed path).
 * Returns null if the entities can't form a valid profile.
 */
function entitiesToShape(contour: FittedContour): THREE.Shape | null {
  const entities = contour.entities;
  if (entities.length === 0) return null;

  // Single full circle → use THREE.Shape circle
  if (entities.length === 1 && entities[0].type === 'arc' && entities[0].isFullCircle) {
    const arc = entities[0] as SketchArc;
    const shape = new THREE.Shape();
    shape.absarc(arc.center.x, arc.center.y, arc.radius, 0, Math.PI * 2, false);
    return shape;
  }

  const shape = new THREE.Shape();

  // Start from first entity
  const first = entities[0];
  shape.moveTo(first.start.x, first.start.y);

  for (const e of entities) {
    if (e.type === 'line') {
      shape.lineTo(e.end.x, e.end.y);
    } else if (e.type === 'arc') {
      const arc = e as SketchArc;
      if (arc.isFullCircle) {
        // Full circle embedded in a chain (shouldn't happen, but handle it)
        shape.absarc(arc.center.x, arc.center.y, arc.radius, 0, Math.PI * 2, false);
      } else {
        // Determine if CW or CCW from sweep direction
        const sweep = arc.endAngle - arc.startAngle;
        const clockwise = sweep < 0;
        shape.absarc(
          arc.center.x, arc.center.y, arc.radius,
          arc.startAngle, arc.endAngle,
          clockwise,
        );
      }
    }
  }

  // Close the shape
  shape.closePath();

  return shape;
}

/**
 * Convert a contour to a THREE.Path for holes (inner contours).
 */
function contourToHolePath(contour: FittedContour): THREE.Path | null {
  const entities = contour.entities;
  if (entities.length === 0) return null;

  if (entities.length === 1 && entities[0].type === 'arc' && entities[0].isFullCircle) {
    const arc = entities[0] as SketchArc;
    const path = new THREE.Path();
    path.absarc(arc.center.x, arc.center.y, arc.radius, 0, Math.PI * 2, true); // CW for holes
    return path;
  }

  const path = new THREE.Path();
  const first = entities[0];
  path.moveTo(first.start.x, first.start.y);

  for (const e of entities) {
    if (e.type === 'line') {
      path.lineTo(e.end.x, e.end.y);
    } else if (e.type === 'arc') {
      const arc = e as SketchArc;
      const sweep = arc.endAngle - arc.startAngle;
      const clockwise = sweep < 0;
      path.absarc(
        arc.center.x, arc.center.y, arc.radius,
        arc.startAngle, arc.endAngle,
        clockwise,
      );
    }
  }

  path.closePath();
  return path;
}

// ═══════════════════════════════════════════════════════════════
// Extrusion + 3D positioning
// ═══════════════════════════════════════════════════════════════

/**
 * Build a rotation matrix that transforms local Z → the given normal direction.
 * The local XY plane will correspond to the slice plane.
 */
function buildPlaneMatrix(
  slice: FittedSlice,
  normal: THREE.Vector3,
  depthOffset: number,
): THREE.Matrix4 {
  const mat = new THREE.Matrix4();

  if (slice.uAxis && slice.vAxis && slice.planeOrigin) {
    // Use the actual plane basis from GPU rendering
    const u = new THREE.Vector3(...slice.uAxis);
    const v = new THREE.Vector3(...slice.vAxis);
    const n = new THREE.Vector3().crossVectors(u, v).normalize();
    const origin = new THREE.Vector3(...slice.planeOrigin);

    // Matrix columns: u, v, n (local X, Y, Z)
    mat.set(
      u.x, v.x, n.x, origin.x,
      u.y, v.y, n.y, origin.y,
      u.z, v.z, n.z, origin.z,
      0,   0,   0,   1,
    );
  } else {
    // Fallback: axis-aligned
    const origin = new THREE.Vector3();
    switch (slice.axis) {
      case 'X': origin.set(depthOffset, 0, 0); break;
      case 'Y': origin.set(0, depthOffset, 0); break;
      case 'Z': origin.set(0, 0, depthOffset); break;
    }

    const up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(normal.dot(up)) > 0.99) {
      up.set(0, 0, 1);
    }
    const right = new THREE.Vector3().crossVectors(up, normal).normalize();
    const trueUp = new THREE.Vector3().crossVectors(normal, right);

    mat.set(
      right.x, trueUp.x, normal.x, origin.x,
      right.y, trueUp.y, normal.y, origin.y,
      right.z, trueUp.z, normal.z, origin.z,
      0,       0,        0,        1,
    );
  }

  return mat;
}

// ═══════════════════════════════════════════════════════════════
// Main reconstruction function
// ═══════════════════════════════════════════════════════════════

const EXTRUDE_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x6699cc,
  metalness: 0.3,
  roughness: 0.6,
  transparent: true,
  opacity: 0.85,
  side: THREE.DoubleSide,
});

const HOLE_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xcc4444,
  metalness: 0.2,
  roughness: 0.7,
  transparent: true,
  opacity: 0.6,
  side: THREE.DoubleSide,
});

/**
 * Reconstruct a 3D mesh from fitted sketch slices.
 * 
 * @param slices The fitted slices from the GPU scan pipeline
 * @param opts Configuration
 * @returns ReconstructionResult with the THREE.Group and metadata
 */
export function reconstructFromSlices(
  slices: FittedSlice[],
  opts?: {
    /** Minimum extrusion depth (default: auto from slice spacing) */
    minDepth?: number;
    /** Mesh detail for curved profiles (default: 1) */
    curveSegments?: number;
    /** Whether to attempt hole subtraction (default: true) */
    subtractHoles?: boolean;
  },
): ReconstructionResult {
  const t0 = performance.now();
  const warnings: string[] = [];
  const group = new THREE.Group();
  group.name = 'Reconstruction';
  const bands: BandInfo[] = [];

  if (slices.length === 0) {
    return { group, bands, timeMs: 0, warnings: ['No slices provided'] };
  }

  const curveSegments = opts?.curveSegments ?? 1;
  const subtractHoles = opts?.subtractHoles ?? true;

  // Step 1: Group slices by direction
  const dirGroups = groupByDirection(slices);
  console.log(`[Reconstruct] ${dirGroups.length} direction groups from ${slices.length} slices`);

  for (const dg of dirGroups) {
    // Step 2: Identify bands within this direction group
    const profileBands = identifyBands(dg);
    
    for (const band of profileBands) {
      const contour = band.representative.contours[band.contourIndex];
      if (!contour || contour.entities.length === 0) continue;

      // Step 3: Convert entities to THREE.Shape
      const shape = entitiesToShape(contour);
      if (!shape) {
        warnings.push(`Failed to create shape for band at depth ${band.minDepth.toFixed(2)}-${band.maxDepth.toFixed(2)}`);
        continue;
      }

      // Determine extrusion depth
      let depth: number;
      if (band.sliceIndices.length === 1) {
        // Single slice — use minimum depth or estimate from bounding box
        const bb = computeContourBBox(contour);
        depth = opts?.minDepth ?? Math.max(bb.width, bb.height) * 0.1;
        depth = Math.max(depth, 0.1); // At least 0.1 units
      } else {
        depth = band.maxDepth - band.minDepth;
        if (depth < 0.01) depth = 0.1; // Avoid zero-thickness
      }

      // Step 4: Check for holes (other contours that might be inner loops)
      // A contour is a "hole" if its bounding box is fully contained in this contour's bbox
      // and it has fewer entities (simpler shape inside a complex one)
      if (subtractHoles && band.representative.contours.length > 1) {
        const mainBB = computeContourBBox(contour);
        for (let ci = 0; ci < band.representative.contours.length; ci++) {
          if (ci === band.contourIndex) continue;
          const otherContour = band.representative.contours[ci];
          const otherBB = computeContourBBox(otherContour);
          
          // Check if other is inside main
          if (otherBB.minX > mainBB.minX && otherBB.maxX < mainBB.maxX &&
              otherBB.minY > mainBB.minY && otherBB.maxY < mainBB.maxY) {
            const holePath = contourToHolePath(otherContour);
            if (holePath) {
              shape.holes.push(holePath);
            }
          }
        }
      }

      // Step 5: Create ExtrudeGeometry
      try {
        const extrudeSettings: THREE.ExtrudeGeometryOptions = {
          depth,
          bevelEnabled: false,
          curveSegments: Math.max(12, curveSegments * 12),
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const mesh = new THREE.Mesh(geometry, EXTRUDE_MATERIAL.clone());
        mesh.name = `Band_${dg.label}_d${band.minDepth.toFixed(1)}`;

        // Step 6: Position in 3D
        // The ExtrudeGeometry creates the shape in XY and extrudes along +Z.
        // We need to transform so Z → normal direction and XY → the slice plane.
        const mat = buildPlaneMatrix(band.representative, dg.normal, band.minDepth);
        mesh.applyMatrix4(mat);

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        bands.push({
          directionLabel: dg.label,
          normal: dg.normal.toArray() as [number, number, number],
          depthRange: [band.minDepth, band.maxDepth],
          contourCount: band.sliceIndices.length,
          entityCount: contour.entities.length,
          mesh,
        });
      } catch (err) {
        warnings.push(`Extrude failed for ${dg.label} d=${band.minDepth.toFixed(2)}: ${err}`);
      }
    }
  }

  const timeMs = performance.now() - t0;
  console.log(`[Reconstruct] Done: ${bands.length} bands, ${group.children.length} meshes in ${timeMs.toFixed(0)}ms`);

  return { group, bands, timeMs, warnings };
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function computeContourBBox(contour: FittedContour): {
  minX: number; minY: number; maxX: number; maxY: number;
  width: number; height: number;
} {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of contour.entities) {
    for (const pt of [e.start, e.end]) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
    // For arcs, also check the center ± radius for tighter bbox
    if (e.type === 'arc') {
      const arc = e as SketchArc;
      minX = Math.min(minX, arc.center.x - arc.radius);
      maxX = Math.max(maxX, arc.center.x + arc.radius);
      minY = Math.min(minY, arc.center.y - arc.radius);
      maxY = Math.max(maxY, arc.center.y + arc.radius);
    }
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
