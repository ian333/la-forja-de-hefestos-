/**
 * ⚒️ La Forja de Hefestos — Cross-Section Slicer
 * =================================================
 * Slice a triangulated mesh with a plane and extract
 * closed polygon contours. This is the foundation for
 * CT-scan feature recognition.
 *
 * Algorithm:
 * 1. For each triangle, compute signed distance of vertices to plane
 * 2. Where triangle straddles the plane → compute 2 intersection points
 * 3. Collect all segments and chain them into closed contours
 * 4. Classify contours as outer (CCW) or hole (CW) via signed area
 * 5. Compute Betti numbers: β₀ (components) and β₁ (holes)
 */

import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type SliceAxis = 'X' | 'Y' | 'Z';

export interface Point2D {
  x: number;
  y: number;
}

/** A closed polygon contour from the slice */
export interface Contour {
  points: Point2D[];
  /** Signed area: positive = CCW (outer), negative = CW (hole) */
  signedArea: number;
  /** Is this an outer boundary (CCW) or hole (CW)? */
  isOuter: boolean;
  /** Axis-aligned bounding box in 2D */
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  /** Area of the contour (absolute) */
  area: number;
  /** Perimeter of the contour */
  perimeter: number;
  /** Is it approximately circular? (<5% deviation from circle) */
  isCircular: boolean;
  /** Estimated radius if circular */
  circleRadius: number;
  /** Centroid */
  centroid: Point2D;
}

/** Result of slicing at one height */
export interface SliceResult {
  /** The axis and value used for slicing */
  axis: SliceAxis;
  value: number;
  /** All closed contours found */
  contours: Contour[];
  /** Betti numbers */
  beta0: number;  // number of outer contours (components)
  beta1: number;  // number of holes
  /** Total area (sum of outer - sum of holes) */
  totalArea: number;
  /** Centroid of all contours combined (area-weighted) */
  centroid: Point2D;
  /** Euler characteristic χ = β₀ - β₁ */
  eulerChar: number;
}

/** A band of constant topology between two slice heights */
export interface TopoBand {
  axis: SliceAxis;
  zStart: number;
  zEnd: number;
  /** Representative slice (from the middle of the band) */
  slice: SliceResult;
  /** Feature classification */
  featureType: 'extrusion' | 'revolution' | 'taper' | 'unknown';
  /** Outer contours for this band (the profile to extrude) */
  outerContours: Contour[];
  /** Holes for this band */
  holeContours: Contour[];
}

/** Full CT-scan result from one axis */
export interface CTScanResult {
  axis: SliceAxis;
  slices: SliceResult[];
  bands: TopoBand[];
  /** Range of the mesh along this axis */
  range: [number, number];
}

/** Final decomposition from all 3 axes cross-verified */
export interface DecomposedFeatures {
  /** Detected extrusion features */
  features: DetectedFeature[];
  /** Statistics */
  stats: {
    totalFeatures: number;
    extrusions: number;
    revolutions: number;
    holes: number;
    unknown: number;
    processingTimeMs: number;
  };
  /** The 3-axis CT scan data for inspection */
  scans: { X: CTScanResult; Y: CTScanResult; Z: CTScanResult };
}

export interface DetectedFeature {
  type: 'extrusion' | 'revolution' | 'hole' | 'pocket' | 'boss' | 'unknown';
  axis: SliceAxis;
  /** 3D position of the feature center */
  center: [number, number, number];
  /** Height/depth of the extrusion along the axis */
  height: number;
  /** Profile contour (2D polygon in the slice plane) */
  profile: Point2D[];
  /** Profile holes (inner contours) */
  holes: Point2D[][];
  /** For circular features: radius */
  radius?: number;
  /** Confidence 0-1 */
  confidence: number;
  /** Label for the UI */
  label: string;
}

// ═══════════════════════════════════════════════════════════════
// Core: Mesh-Plane Intersection → Segments → Contours
// ═══════════════════════════════════════════════════════════════

/**
 * Slice a BufferGeometry with a plane at `value` along `axis`.
 * Returns closed contours in the 2D coordinate system of the slice plane.
 *
 * For axis='Z' at value=5: plane is z=5, contours are in (x,y)
 * For axis='Y' at value=3: plane is y=3, contours are in (x,z)
 * For axis='X' at value=2: plane is x=2, contours are in (y,z)
 */
export function sliceMesh(
  geo: THREE.BufferGeometry,
  axis: SliceAxis,
  value: number,
): SliceResult {
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const index = geo.getIndex();
  if (!posAttr) return emptySlice(axis, value);

  const triCount = index ? index.count / 3 : posAttr.count / 3;
  const axisIdx = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;
  // The two other axes (the 2D plane we project onto)
  const u = axis === 'X' ? 1 : 0;  // Y or X
  const v = axis === 'X' ? 2 : axis === 'Y' ? 2 : 1; // Z or Z or Y

  // Step 1: Collect all intersection segments
  const segments: [Point2D, Point2D][] = [];
  const EPS = 1e-8;

  for (let t = 0; t < triCount; t++) {
    const i0 = index ? index.getX(t * 3) : t * 3;
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;

    // Signed distance to the slice plane for each vertex
    const s0 = getComp(posAttr, i0, axisIdx) - value;
    const s1 = getComp(posAttr, i1, axisIdx) - value;
    const s2 = getComp(posAttr, i2, axisIdx) - value;

    // Count vertices on each side
    const above = +(s0 > EPS) + +(s1 > EPS) + +(s2 > EPS);
    const below = +(s0 < -EPS) + +(s1 < -EPS) + +(s2 < -EPS);

    // If all on one side, skip
    if (above === 3 || below === 3) continue;
    if (above === 0 && below === 0) continue; // coplanar, skip

    // Find the two intersection points
    const pts: Point2D[] = [];
    const verts = [
      { s: s0, i: i0 },
      { s: s1, i: i1 },
      { s: s2, i: i2 },
    ];

    // Check each edge
    for (let e = 0; e < 3; e++) {
      const a = verts[e];
      const b = verts[(e + 1) % 3];

      // Skip if both on same side
      if ((a.s > EPS && b.s > EPS) || (a.s < -EPS && b.s < -EPS)) continue;

      // Vertex exactly on the plane
      if (Math.abs(a.s) <= EPS && Math.abs(b.s) <= EPS) continue; // edge on plane
      if (Math.abs(a.s) <= EPS) {
        pts.push({
          x: getComp(posAttr, a.i, u),
          y: getComp(posAttr, a.i, v),
        });
        continue;
      }
      if (Math.abs(b.s) <= EPS) continue; // will be picked up from the other edge

      // Interpolate
      const t_param = a.s / (a.s - b.s);
      pts.push({
        x: getComp(posAttr, a.i, u) + t_param * (getComp(posAttr, b.i, u) - getComp(posAttr, a.i, u)),
        y: getComp(posAttr, a.i, v) + t_param * (getComp(posAttr, b.i, v) - getComp(posAttr, a.i, v)),
      });
    }

    if (pts.length >= 2) {
      segments.push([pts[0], pts[1]]);
    }
  }

  if (segments.length === 0) return emptySlice(axis, value);

  // Step 2: Chain segments into closed contours
  const contours = chainSegments(segments);

  // Step 3: Analyze contours
  const analyzedContours = contours.map(analyzeContour);

  // Classify outer/hole
  const outers = analyzedContours.filter(c => c.isOuter);
  const holes = analyzedContours.filter(c => !c.isOuter);

  const beta0 = outers.length;
  const beta1 = holes.length;
  const totalArea = outers.reduce((s, c) => s + c.area, 0)
                  - holes.reduce((s, c) => s + c.area, 0);

  // Area-weighted centroid
  let cx = 0, cy = 0, totalW = 0;
  for (const c of analyzedContours) {
    const w = c.area * (c.isOuter ? 1 : -1);
    cx += c.centroid.x * w;
    cy += c.centroid.y * w;
    totalW += w;
  }
  if (Math.abs(totalW) > 1e-10) { cx /= totalW; cy /= totalW; }

  return {
    axis,
    value,
    contours: analyzedContours,
    beta0,
    beta1,
    totalArea,
    centroid: { x: cx, y: cy },
    eulerChar: beta0 - beta1,
  };
}

// ═══════════════════════════════════════════════════════════════
// Segment Chaining → Closed Contours
// ═══════════════════════════════════════════════════════════════

function chainSegments(segments: [Point2D, Point2D][]): Point2D[][] {
  if (segments.length === 0) return [];

  const EPS = 1e-6;
  const used = new Array(segments.length).fill(false);
  const contours: Point2D[][] = [];

  // Hash function for point lookup
  function key(p: Point2D): string {
    return `${Math.round(p.x / EPS) * EPS},${Math.round(p.y / EPS) * EPS}`;
  }

  // Build adjacency: endpoint → list of segment indices
  const adj = new Map<string, number[]>();
  for (let i = 0; i < segments.length; i++) {
    const k0 = key(segments[i][0]);
    const k1 = key(segments[i][1]);
    if (!adj.has(k0)) adj.set(k0, []);
    if (!adj.has(k1)) adj.set(k1, []);
    adj.get(k0)!.push(i);
    adj.get(k1)!.push(i);
  }

  for (let start = 0; start < segments.length; start++) {
    if (used[start]) continue;
    used[start] = true;

    const chain: Point2D[] = [segments[start][0], segments[start][1]];
    let closed = false;

    // Extend from the end
    for (let iter = 0; iter < segments.length + 10; iter++) {
      const last = chain[chain.length - 1];
      const first = chain[0];

      // Check if closed
      if (chain.length > 2 && dist2D(last, first) < EPS * 10) {
        closed = true;
        break;
      }

      const k = key(last);
      const candidates = adj.get(k);
      if (!candidates) break;

      let found = false;
      for (const ci of candidates) {
        if (used[ci]) continue;
        const seg = segments[ci];
        const p0 = seg[0], p1 = seg[1];
        if (dist2D(p0, last) < EPS * 10) {
          used[ci] = true;
          chain.push(p1);
          found = true;
          break;
        }
        if (dist2D(p1, last) < EPS * 10) {
          used[ci] = true;
          chain.push(p0);
          found = true;
          break;
        }
      }
      if (!found) break;
    }

    if (closed && chain.length >= 3) {
      contours.push(chain);
    }
  }

  return contours;
}

// ═══════════════════════════════════════════════════════════════
// Contour Analysis
// ═══════════════════════════════════════════════════════════════

function analyzeContour(points: Point2D[]): Contour {
  const n = points.length;
  if (n < 3) {
    return {
      points, signedArea: 0, isOuter: true, area: 0, perimeter: 0,
      bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      isCircular: false, circleRadius: 0,
      centroid: { x: 0, y: 0 },
    };
  }

  // Signed area (shoelace formula)
  let sArea = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sArea += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  sArea /= 2;

  // Centroid
  let cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross = points[i].x * points[j].y - points[j].x * points[i].y;
    cx += (points[i].x + points[j].x) * cross;
    cy += (points[i].y + points[j].y) * cross;
  }
  const a6 = 6 * sArea;
  if (Math.abs(a6) > 1e-10) { cx /= a6; cy /= a6; }
  else {
    cx = points.reduce((s, p) => s + p.x, 0) / n;
    cy = points.reduce((s, p) => s + p.y, 0) / n;
  }

  // Perimeter
  let perim = 0;
  for (let i = 0; i < n; i++) {
    perim += dist2D(points[i], points[(i + 1) % n]);
  }

  // AABB
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }

  // Circularity test: compare with a perfect circle
  const area = Math.abs(sArea);
  const idealRadius = Math.sqrt(area / Math.PI);
  let maxDeviation = 0;
  for (const p of points) {
    const r = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
    maxDeviation = Math.max(maxDeviation, Math.abs(r - idealRadius));
  }
  const isCircular = idealRadius > 1e-6 && (maxDeviation / idealRadius) < 0.08;

  return {
    points,
    signedArea: sArea,
    isOuter: sArea > 0,
    area,
    perimeter: perim,
    bbox: { minX, minY, maxX, maxY },
    isCircular,
    circleRadius: isCircular ? idealRadius : 0,
    centroid: { x: cx, y: cy },
  };
}

// ═══════════════════════════════════════════════════════════════
// CT-Scan: Multi-height slicing + topology analysis
// ═══════════════════════════════════════════════════════════════

/**
 * Perform a CT-scan on a mesh along a single axis.
 * Slices at N heights, detects topology changes, and segments into bands.
 */
export function ctScanAxis(
  geo: THREE.BufferGeometry,
  axis: SliceAxis,
  numSlices = 120,
): CTScanResult {
  // Compute range along this axis
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const axisIdx = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;
  const lo = axisIdx === 0 ? bb.min.x : axisIdx === 1 ? bb.min.y : bb.min.z;
  const hi = axisIdx === 0 ? bb.max.x : axisIdx === 1 ? bb.max.y : bb.max.z;
  const range: [number, number] = [lo, hi];
  const span = hi - lo;

  if (span < 1e-8) return { axis, slices: [], bands: [], range };

  // Slice at uniform heights (with small margin inside)
  const margin = span * 0.005;
  const slices: SliceResult[] = [];
  for (let i = 0; i < numSlices; i++) {
    const t = (i + 0.5) / numSlices;
    const z = lo + margin + t * (span - 2 * margin);
    slices.push(sliceMesh(geo, axis, z));
  }

  // Detect topology bands: group consecutive slices with same β₀, β₁
  const bands: TopoBand[] = [];
  let bandStart = 0;

  for (let i = 1; i <= slices.length; i++) {
    const changed = i === slices.length ||
      slices[i].beta0 !== slices[bandStart].beta0 ||
      slices[i].beta1 !== slices[bandStart].beta1 ||
      (i > 0 && !contoursMatch(slices[i - 1], slices[i]));

    if (changed) {
      const midIdx = Math.floor((bandStart + i - 1) / 2);
      const midSlice = slices[midIdx];
      const outers = midSlice.contours.filter(c => c.isOuter);
      const holes = midSlice.contours.filter(c => !c.isOuter);

      // Classify feature type
      let featureType: TopoBand['featureType'] = 'extrusion';
      if (outers.length === 1 && outers[0].isCircular && holes.length === 0) {
        featureType = 'revolution';
      } else if (outers.length === 1 && outers[0].isCircular && holes.length === 1 && holes[0].isCircular) {
        featureType = 'revolution';
      }

      bands.push({
        axis,
        zStart: slices[bandStart].value,
        zEnd: slices[i - 1].value,
        slice: midSlice,
        featureType,
        outerContours: outers,
        holeContours: holes,
      });

      bandStart = i;
    }
  }

  return { axis, slices, bands, range };
}

/**
 * Check if two consecutive slices have approximately matching contour shapes.
 * Uses area comparison (Hausdorff is expensive, area ratio is fast).
 */
function contoursMatch(a: SliceResult, b: SliceResult): boolean {
  if (a.beta0 !== b.beta0 || a.beta1 !== b.beta1) return false;
  if (a.totalArea < 1e-10 && b.totalArea < 1e-10) return true;
  if (a.totalArea < 1e-10 || b.totalArea < 1e-10) return false;

  const ratio = a.totalArea / b.totalArea;
  return ratio > 0.90 && ratio < 1.10; // 10% tolerance
}

// ═══════════════════════════════════════════════════════════════
// Full 3-Axis CT-Scan → Feature Decomposition
// ═══════════════════════════════════════════════════════════════

/**
 * Perform full 3-axis CT-scan and decompose into features.
 * Each axis scan is cross-verified with the others.
 */
export function decomposeBySlicing(
  geo: THREE.BufferGeometry,
  numSlices = 100,
): DecomposedFeatures {
  const t0 = performance.now();

  // Scan from all 3 axes
  const scanX = ctScanAxis(geo, 'X', numSlices);
  const scanY = ctScanAxis(geo, 'Y', numSlices);
  const scanZ = ctScanAxis(geo, 'Z', numSlices);

  const features: DetectedFeature[] = [];

  // Process each axis — detect main body extrusion + holes
  const scans = [scanZ, scanY, scanX]; // Z first (most common extrusion direction)

  for (const scan of scans) {
    for (const band of scan.bands) {
      if (band.outerContours.length === 0) continue;

      const height = band.zEnd - band.zStart;
      if (height < 1e-6) continue;

      const midZ = (band.zStart + band.zEnd) / 2;

      // Main body: the outer contours
      for (const outer of band.outerContours) {
        const center3D = contourCenterTo3D(outer.centroid, scan.axis, midZ);
        const label = outer.isCircular
          ? `${scan.axis}-Cilindro r=${outer.circleRadius.toFixed(2)}`
          : `${scan.axis}-Extrusión ${outer.area.toFixed(2)}u²`;

        features.push({
          type: outer.isCircular ? 'revolution' : 'extrusion',
          axis: scan.axis,
          center: center3D,
          height,
          profile: outer.points,
          holes: band.holeContours.map(h => h.points),
          radius: outer.isCircular ? outer.circleRadius : undefined,
          confidence: outer.isCircular ? 0.85 : 0.70,
          label,
        });
      }

      // Holes: inner contours (typically drilled holes)
      for (const hole of band.holeContours) {
        const center3D = contourCenterTo3D(hole.centroid, scan.axis, midZ);

        features.push({
          type: hole.isCircular ? 'hole' : 'pocket',
          axis: scan.axis,
          center: center3D,
          height,
          profile: hole.points,
          holes: [],
          radius: hole.isCircular ? hole.circleRadius : undefined,
          confidence: hole.isCircular ? 0.90 : 0.65,
          label: hole.isCircular
            ? `Agujero ⌀${(hole.circleRadius * 2).toFixed(2)}`
            : `Pocket ${hole.area.toFixed(2)}u²`,
        });
      }
    }
  }

  // Deduplicate features detected from multiple axes
  const deduped = deduplicateFeatures(features);

  const elapsed = performance.now() - t0;
  const extrusions = deduped.filter(f => f.type === 'extrusion').length;
  const revolutions = deduped.filter(f => f.type === 'revolution').length;
  const holes = deduped.filter(f => f.type === 'hole' || f.type === 'pocket').length;
  const unknown = deduped.filter(f => f.type === 'unknown').length;

  return {
    features: deduped,
    stats: {
      totalFeatures: deduped.length,
      extrusions,
      revolutions,
      holes,
      unknown,
      processingTimeMs: elapsed,
    },
    scans: { X: scanX, Y: scanY, Z: scanZ },
  };
}

// ═══════════════════════════════════════════════════════════════
// Feature Deduplication (cross-axis verification)
// ═══════════════════════════════════════════════════════════════

/**
 * When scanning from 3 axes, the same feature (e.g. a through-hole)
 * may be detected from multiple axes. We keep the detection with
 * highest confidence and merge duplicates.
 *
 * Deduplication strategy:
 * 1. Same-axis merging: consecutive bands with same contour type → merge into one taller feature
 * 2. Cross-axis merging: features at same 3D location from different axes → boost confidence
 * 3. Distance threshold is proportional to feature size (not a fixed constant)
 */
function deduplicateFeatures(features: DetectedFeature[]): DetectedFeature[] {
  if (features.length <= 1) return features;

  // Compute a global size metric for scaling the merge distance
  let maxDim = 1;
  for (const f of features) {
    maxDim = Math.max(maxDim,
      Math.abs(f.center[0]), Math.abs(f.center[1]), Math.abs(f.center[2]),
      f.height, f.radius ?? 0);
  }
  // Merge distance: ~5% of the largest dimension
  const mergeDist = maxDim * 0.05;

  // ── Phase 1: Same-axis merge (consecutive bands with same shape) ──
  // Group by axis and type
  const byAxisType = new Map<string, DetectedFeature[]>();
  for (const f of features) {
    const key = `${f.axis}:${f.type}`;
    if (!byAxisType.has(key)) byAxisType.set(key, []);
    byAxisType.get(key)!.push(f);
  }

  const phase1: DetectedFeature[] = [];
  for (const [, group] of byAxisType) {
    // Sort by center along the feature axis
    const sorted = [...group].sort((a, b) => {
      const ai = a.axis === 'X' ? 0 : a.axis === 'Y' ? 1 : 2;
      return a.center[ai] - b.center[ai];
    });

    let i = 0;
    while (i < sorted.length) {
      const base = sorted[i];
      let merged = { ...base };
      let j = i + 1;

      // Try to absorb subsequent features that are spatially adjacent & similar
      while (j < sorted.length) {
        const next = sorted[j];
        const dx = merged.center[0] - next.center[0];
        const dy = merged.center[1] - next.center[1];
        const dz = merged.center[2] - next.center[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const rSimilar = merged.radius && next.radius
          ? Math.abs(merged.radius - next.radius) / Math.max(merged.radius, next.radius) < 0.20
          : true;

        // Merge if close + similar shape
        if (dist < mergeDist * 2 && rSimilar) {
          // Extend height to cover both
          const axi = merged.axis === 'X' ? 0 : merged.axis === 'Y' ? 1 : 2;
          const lo = Math.min(
            merged.center[axi] - merged.height / 2,
            next.center[axi] - next.height / 2,
          );
          const hi = Math.max(
            merged.center[axi] + merged.height / 2,
            next.center[axi] + next.height / 2,
          );
          const newCenter: [number, number, number] = [...merged.center];
          newCenter[axi] = (lo + hi) / 2;
          merged = {
            ...merged,
            center: newCenter,
            height: hi - lo,
            confidence: Math.min(1.0, merged.confidence + 0.05),
            // Keep the larger profile
            profile: merged.profile.length >= next.profile.length ? merged.profile : next.profile,
            holes: merged.holes.length >= next.holes.length ? merged.holes : next.holes,
          };
          j++;
        } else {
          break;
        }
      }

      phase1.push(merged);
      i = j;
    }
  }

  // ── Phase 2: Cross-axis merge ──
  const sorted = [...phase1].sort((a, b) => b.confidence - a.confidence);
  const kept: DetectedFeature[] = [];
  const used = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(i)) continue;
    const fi = sorted[i];

    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(j)) continue;
      const fj = sorted[j];

      const dx = fi.center[0] - fj.center[0];
      const dy = fi.center[1] - fj.center[1];
      const dz = fi.center[2] - fj.center[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Same type (flexible matching for related types)
      const compatible =
        fi.type === fj.type ||
        (fi.type === 'hole' && fj.type === 'pocket') ||
        (fi.type === 'pocket' && fj.type === 'hole') ||
        (fi.type === 'revolution' && fj.type === 'hole') ||
        (fi.type === 'hole' && fj.type === 'revolution');

      const rSimilar = fi.radius && fj.radius
        ? Math.abs(fi.radius - fj.radius) / Math.max(fi.radius, fj.radius) < 0.20
        : true;

      if (compatible && dist < mergeDist && rSimilar) {
        used.add(j);
        fi.confidence = Math.min(1.0, fi.confidence + 0.1);
      }
    }

    kept.push(fi);
  }

  return kept;
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function getComp(attr: THREE.BufferAttribute, idx: number, comp: number): number {
  switch (comp) {
    case 0: return attr.getX(idx);
    case 1: return attr.getY(idx);
    case 2: return attr.getZ(idx);
    default: return 0;
  }
}

function dist2D(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function emptySlice(axis: SliceAxis, value: number): SliceResult {
  return {
    axis, value, contours: [], beta0: 0, beta1: 0,
    totalArea: 0, centroid: { x: 0, y: 0 }, eulerChar: 0,
  };
}

/** Convert a 2D contour centroid back to 3D given the slice axis */
function contourCenterTo3D(
  c: Point2D,
  axis: SliceAxis,
  sliceValue: number,
): [number, number, number] {
  switch (axis) {
    case 'X': return [sliceValue, c.x, c.y];
    case 'Y': return [c.x, sliceValue, c.y];
    case 'Z': return [c.x, c.y, sliceValue];
  }
}
