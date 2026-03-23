/**
 * ⚒️ La Forja de Hefestos — Profile → SDF Converter
 * =====================================================
 * Takes the output of the CT-scan cross-section analyzer
 * and converts it into a parametric SDF scene tree.
 *
 * Pipeline:
 * 1. Simplify polygon contours (Douglas-Peucker)
 * 2. Detect standard shapes (circles → cylinders, rectangles → boxes)
 * 3. Generate SDF primitives with auto-variables
 * 4. Compose into a CSG tree (union of bodies - union of holes)
 */

import type { Point2D, DecomposedFeatures, DetectedFeature, TopoBand, CTScanResult, SliceAxis, Contour } from './cross-section';
import type { SdfNode, SdfPrimitive, SdfOperation } from './sdf-engine';
import {
  makeSphere,
  makeBox,
  makeCylinder,
  makeTorus,
  makeCone,
  makeOp,
  makeModule,
  makePolygonExtrusion,
} from './sdf-engine';
import type { GaiaVariable } from './gaia-variables';
import { createVariable } from './gaia-variables';

// ═══════════════════════════════════════════════════════════════
// Douglas-Peucker Polygon Simplification
// ═══════════════════════════════════════════════════════════════

/**
 * Simplify a 2D polygon using the Ramer–Douglas–Peucker algorithm.
 * @param points Polygon vertices
 * @param epsilon Tolerance (smaller = more detail)
 * @returns Simplified polygon
 */
export function simplifyPolygon(points: Point2D[], epsilon: number): Point2D[] {
  if (points.length <= 3) return points;

  // Find the point with the greatest distance from the line (first → last)
  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDist(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPolygon(points.slice(0, maxIdx + 1), epsilon);
    const right = simplifyPolygon(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  } else {
    return [first, last];
  }
}

function perpendicularDist(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  return Math.abs(dx * (a.y - p.y) - (a.x - p.x) * dy) / Math.sqrt(len2);
}

// ═══════════════════════════════════════════════════════════════
// Shape Detection (circle, rectangle, polygon)
// ═══════════════════════════════════════════════════════════════

type ShapeMatch =
  | { shape: 'circle'; cx: number; cy: number; radius: number }
  | { shape: 'rectangle'; cx: number; cy: number; width: number; height: number; angle: number }
  | { shape: 'polygon'; vertices: [number, number][] };

/**
 * Try to match a contour to a standard shape.
 * Checks circle first, then rectangle, falls back to polygon.
 */
function classifyContour(contour: Contour, simplifyEps: number): ShapeMatch {
  const { centroid, isCircular, circleRadius, points } = contour;

  // ── Circle check ──
  if (isCircular && circleRadius > 1e-6) {
    return { shape: 'circle', cx: centroid.x, cy: centroid.y, radius: circleRadius };
  }

  // ── Rectangle check ──
  const simplified = simplifyPolygon(points, simplifyEps);
  if (simplified.length === 4 || simplified.length === 5) {
    const rectMatch = tryMatchRectangle(simplified.length === 5 ? simplified.slice(0, 4) : simplified);
    if (rectMatch) return { shape: 'rectangle' as const, ...rectMatch };
  }

  // ── General polygon ──
  const polyPts = simplifyPolygon(points, simplifyEps);
  // Limit vertex count for GLSL performance (max 64 verts per polygon)
  const limited = polyPts.length > 64 ? simplifyPolygon(points, simplifyEps * 2) : polyPts;
  const finalPts = limited.length > 64 ? simplifyPolygon(points, simplifyEps * 4) : limited;

  return {
    shape: 'polygon',
    vertices: finalPts.map(p => [p.x, p.y] as [number, number]),
  };
}

/** Try to match 4 points as a rectangle (check right angles) */
function tryMatchRectangle(pts: Point2D[]): { cx: number; cy: number; width: number; height: number; angle: number } | null {
  if (pts.length !== 4) return null;

  // Check if all 4 angles are approximately 90°
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    const c = pts[(i + 2) % 4];
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };
    const dot = ab.x * bc.x + ab.y * bc.y;
    const lenA = Math.sqrt(ab.x ** 2 + ab.y ** 2);
    const lenB = Math.sqrt(bc.x ** 2 + bc.y ** 2);
    if (lenA < 1e-8 || lenB < 1e-8) return null;
    const cosAngle = Math.abs(dot / (lenA * lenB));
    if (cosAngle > 0.1) return null; // Not close enough to 90°
  }

  // Compute dimensions
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;
  const edge1 = Math.sqrt((pts[1].x - pts[0].x) ** 2 + (pts[1].y - pts[0].y) ** 2);
  const edge2 = Math.sqrt((pts[2].x - pts[1].x) ** 2 + (pts[2].y - pts[1].y) ** 2);
  const width = Math.max(edge1, edge2);
  const height = Math.min(edge1, edge2);
  const angle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);

  return { cx, cy, width, height, angle };
}

// ═══════════════════════════════════════════════════════════════
// Feature → SDF Node conversion
// ═══════════════════════════════════════════════════════════════

/**
 * Convert a detected feature to an SDF primitive node.
 */
function featureToSdfNode(
  feature: DetectedFeature,
  vars: GaiaVariable[],
  prefix: string,
): SdfNode {
  const { type, axis, center, height, profile, holes, radius, label } = feature;

  // Rotation to align with the feature axis
  // Our polygon is in XY plane, extruded along Z
  // If feature axis is Y → rotate π/2 around X
  // If feature axis is X → rotate π/2 around Y
  const rotation: [number, number, number] = axisRotation(axis);

  // ── Circular features → use cylinder/torus for better quality ──
  if ((type === 'revolution' || type === 'hole') && radius && radius > 1e-6) {
    const varR = createVariable(`${prefix}_radio`, String(radius), {
      min: 0.01, max: radius * 5, group: prefix,
    });
    const varH = createVariable(`${prefix}_altura`, String(height), {
      min: 0.01, max: height * 5, group: prefix,
    });
    vars.push(varR, varH);

    // If it has a concentric hole, use a torus
    if (holes.length === 1) {
      const holeContour = holes[0];
      // Estimate inner radius from hole contour
      const holeCx = holeContour.reduce((s, p) => s + p.x, 0) / holeContour.length;
      const holeCy = holeContour.reduce((s, p) => s + p.y, 0) / holeContour.length;
      const innerR = holeContour.reduce((s, p) =>
        s + Math.sqrt((p.x - holeCx) ** 2 + (p.y - holeCy) ** 2), 0) / holeContour.length;

      if (Math.abs(radius - innerR) > 0.01) {
        // Thick ring → subtract inner cylinder from outer cylinder
        const outer = makeCylinder(center, radius, height);
        outer.rotation = rotation;
        outer.label = `${label} (ext)`;

        const inner = makeCylinder(center, innerR, height + 0.002);
        inner.rotation = rotation;
        inner.label = `${label} (int)`;

        return makeOp('subtract', [outer, inner]);
      }
    }

    const cyl = makeCylinder(center, radius, height);
    cyl.rotation = rotation;
    cyl.label = label;
    return cyl;
  }

  // ── Rectangular profile → box ──
  if (type === 'extrusion' && profile.length >= 3) {
    const simplified = simplifyPolygon(profile, getSimplifyEps(profile));
    if (simplified.length === 4 || simplified.length === 5) {
      const rect = tryMatchRectangle(simplified.length === 5 ? simplified.slice(0, 4) : simplified);
      if (rect) {
        const varW = createVariable(`${prefix}_ancho`, String(rect.width), {
          min: 0.01, max: rect.width * 5, group: prefix,
        });
        const varD = createVariable(`${prefix}_prof`, String(rect.height), {
          min: 0.01, max: rect.height * 5, group: prefix,
        });
        const varH = createVariable(`${prefix}_altura`, String(height), {
          min: 0.01, max: height * 5, group: prefix,
        });
        vars.push(varW, varD, varH);

        // Map the 2D rectangle center + height back to 3D
        const box3DCenter = map2DTo3D(rect.cx, rect.cy, axis, (center[axisIdx(axis)]));
        const size3D = mapSizeTo3D(rect.width, rect.height, height, axis);
        const box = makeBox(box3DCenter, size3D);
        box.label = label;
        return box;
      }
    }
  }

  // ── General polygon extrusion ──
  // Simplify profile for GLSL performance
  const eps = getSimplifyEps(profile);
  let simplified = simplifyPolygon(profile, eps);
  if (simplified.length > 48) simplified = simplifyPolygon(profile, eps * 3);
  if (simplified.length > 48) simplified = simplifyPolygon(profile, eps * 6);
  if (simplified.length < 3) simplified = profile.slice(0, Math.min(profile.length, 48));

  const verts2D = simplified.map(p => [p.x, p.y] as [number, number]);

  const varH = createVariable(`${prefix}_altura`, String(height), {
    min: 0.01, max: height * 5, group: prefix,
  });
  vars.push(varH);

  const poly = makePolygonExtrusion(verts2D, height, center, rotation, label);

  // If there are holes, subtract them
  if (holes.length > 0) {
    const holePrims: SdfNode[] = [];
    for (let hi = 0; hi < holes.length; hi++) {
      const holeProfile = holes[hi];
      const holeCx = holeProfile.reduce((s, p) => s + p.x, 0) / holeProfile.length;
      const holeCy = holeProfile.reduce((s, p) => s + p.y, 0) / holeProfile.length;
      const holeR = holeProfile.reduce((s, p) =>
        s + Math.sqrt((p.x - holeCx) ** 2 + (p.y - holeCy) ** 2), 0) / holeProfile.length;

      // Try circular hole
      const maxDev = holeProfile.reduce((mx, p) => {
        const r = Math.sqrt((p.x - holeCx) ** 2 + (p.y - holeCy) ** 2);
        return Math.max(mx, Math.abs(r - holeR));
      }, 0);

      const holeCenter = map2DTo3D(holeCx, holeCy, axis, center[axisIdx(axis)]);

      if (holeR > 1e-6 && (maxDev / holeR) < 0.1) {
        // Circular hole → cylinder
        const holeCyl = makeCylinder(holeCenter, holeR, height + 0.01);
        holeCyl.rotation = rotation;
        holeCyl.label = `Agujero ${hi + 1}`;
        holePrims.push(holeCyl);
      } else {
        // Polygon hole
        const holeSimp = simplifyPolygon(holeProfile, eps);
        const holeVerts = holeSimp.map(p => [p.x, p.y] as [number, number]);
        holePrims.push(makePolygonExtrusion(holeVerts, height + 0.01, center, rotation, `Agujero ${hi + 1}`));
      }
    }

    return makeOp('subtract', [poly, ...holePrims.length === 1 ? holePrims : [makeOp('union', holePrims)]]);
  }

  return poly;
}

// ═══════════════════════════════════════════════════════════════
// Main: Convert DecomposedFeatures → SDF Scene
// ═══════════════════════════════════════════════════════════════

export interface ProfileToSdfResult {
  scene: SdfOperation;
  variables: GaiaVariable[];
  featureCount: number;
  warnings: string[];
}

/**
 * Convert the CT-scan decomposition into a full SDF scene.
 * Groups features by type into modules.
 */
export function decompositionToScene(
  decomp: DecomposedFeatures,
  modelName = 'Pieza',
): ProfileToSdfResult {
  const vars: GaiaVariable[] = [];
  const warnings: string[] = [];

  if (decomp.features.length === 0) {
    warnings.push('No se detectaron features en la pieza');
    return {
      scene: makeOp('union', []),
      variables: vars,
      featureCount: 0,
      warnings,
    };
  }

  // Select the best axis (the one with fewest, most meaningful bands)
  const bestAxis = selectBestAxis(decomp);

  // Get features for this axis (positive features first, then holes)
  const posFeatures = decomp.features.filter(f =>
    f.axis === bestAxis && (f.type === 'extrusion' || f.type === 'revolution' || f.type === 'boss')
  );
  const negFeatures = decomp.features.filter(f =>
    f.axis === bestAxis && (f.type === 'hole' || f.type === 'pocket')
  );

  // If no features from best axis (weird), fall back to all
  const positives = posFeatures.length > 0 ? posFeatures : decomp.features.filter(f =>
    f.type === 'extrusion' || f.type === 'revolution' || f.type === 'boss'
  );
  const negatives = negFeatures.length > 0 ? negFeatures : decomp.features.filter(f =>
    f.type === 'hole' || f.type === 'pocket'
  );

  // Convert positive features to SDF nodes
  const bodyNodes: SdfNode[] = [];
  for (let i = 0; i < positives.length; i++) {
    const prefix = `${modelName}_cuerpo${i + 1}`;
    try {
      const node = featureToSdfNode(positives[i], vars, prefix);
      bodyNodes.push(node);
    } catch (e) {
      warnings.push(`Error convirtiendo cuerpo ${i + 1}: ${e}`);
    }
  }

  // Convert holes/pockets to SDF nodes
  const holeNodes: SdfNode[] = [];
  for (let i = 0; i < negatives.length; i++) {
    const prefix = `${modelName}_agujero${i + 1}`;
    try {
      const node = featureToSdfNode(negatives[i], vars, prefix);
      holeNodes.push(node);
    } catch (e) {
      warnings.push(`Error convirtiendo agujero ${i + 1}: ${e}`);
    }
  }

  // Build CSG tree: union of bodies - union of holes
  let scene: SdfOperation;
  if (bodyNodes.length === 0 && holeNodes.length === 0) {
    scene = makeOp('union', []);
  } else if (holeNodes.length === 0) {
    scene = makeOp('union', bodyNodes);
  } else if (bodyNodes.length === 0) {
    scene = makeOp('union', holeNodes);
  } else {
    const body = bodyNodes.length === 1 ? bodyNodes[0] : makeOp('union', bodyNodes);
    const holes = holeNodes.length === 1 ? holeNodes[0] : makeOp('union', holeNodes);
    scene = makeOp('subtract', [body, holes]);
  }

  return {
    scene,
    variables: vars,
    featureCount: positives.length + negatives.length,
    warnings,
  };
}

/**
 * Select the best primary axis for decomposition.
 * Prefers the axis with fewest topology bands (simplest decomposition).
 */
function selectBestAxis(decomp: DecomposedFeatures): SliceAxis {
  const axes: SliceAxis[] = ['Z', 'Y', 'X'];
  let bestAxis: SliceAxis = 'Z';
  let bestScore = -Infinity;

  for (const axis of axes) {
    const scan = decomp.scans[axis];
    const nonEmptyBands = scan.bands.filter(b => b.outerContours.length > 0);
    // Score: prefer fewer bands (simpler), prefer more total area (more material captured)
    const totalArea = scan.slices.reduce((s, sl) => s + sl.totalArea, 0);
    const bandCount = Math.max(1, nonEmptyBands.length);
    const score = totalArea / bandCount;

    if (score > bestScore) {
      bestScore = score;
      bestAxis = axis;
    }
  }

  return bestAxis;
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

/** Get a reasonable simplify epsilon based on the contour size */
function getSimplifyEps(points: Point2D[]): number {
  if (points.length < 3) return 0.01;
  let maxDim = 0;
  for (const p of points) {
    maxDim = Math.max(maxDim, Math.abs(p.x), Math.abs(p.y));
  }
  // ~1% of the bounding dimension, at least 0.001
  return Math.max(maxDim * 0.01, 0.001);
}

function axisIdx(axis: SliceAxis): number {
  return axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;
}

/**
 * Map axis-aligned rotation for polygon extrusion.
 * Polygon is in XY plane, extruded along Z (local).
 * We need to rotate so that local Z aligns with the feature axis.
 */
function axisRotation(axis: SliceAxis): [number, number, number] {
  switch (axis) {
    case 'Z': return [0, 0, 0];             // Already aligned
    case 'Y': return [-Math.PI / 2, 0, 0];  // Rotate -90° around X
    case 'X': return [0, Math.PI / 2, 0];   // Rotate 90° around Y
  }
}

/**
 * Map a 2D point (from the slice plane) + slice value → 3D position.
 */
function map2DTo3D(u: number, v: number, axis: SliceAxis, sliceVal: number): [number, number, number] {
  switch (axis) {
    case 'Z': return [u, v, sliceVal];
    case 'Y': return [u, sliceVal, v];
    case 'X': return [sliceVal, u, v];
  }
}

/**
 * Map 2D size (width, depth) + height → 3D size array for a box.
 */
function mapSizeTo3D(width: number, depth: number, height: number, axis: SliceAxis): [number, number, number] {
  switch (axis) {
    case 'Z': return [width, depth, height];
    case 'Y': return [width, height, depth];
    case 'X': return [height, width, depth];
  }
}
