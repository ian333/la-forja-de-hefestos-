/**
 * ⚒️ Feature Consolidation Pipeline
 *
 * Converts raw fitted slices → deduplicated manufacturing features.
 *
 * Pipeline:
 *   1. Classify each contour (circle, polygon, complex)
 *   2. Cluster identical contours along each axis (same shape at different depths = 1 feature)
 *   3. Derive CNC operation parameters (type, diameter, depth range)
 *   4. Detect spatial patterns (rectangular/linear arrays of identical features)
 */

import type { FittedSlice, SketchEntity, SketchArc } from './sketch-fitting';
import type { Point2D } from './cross-section';
import type { VizFeature } from '@/components/ManufacturingTimeline';

// ── Types ──

export type FeatureType =
  | 'hole'           // Through-hole (circle, constant radius, spans full Z)
  | 'blind_hole'     // Blind hole (circle, partial depth)
  | 'counterbore'    // Stepped hole (two concentric circles at different depths)
  | 'pocket'         // Closed non-circular pocket
  | 'slot'           // Elongated pocket (width << length)
  | 'boss'           // Positive protrusion (circle)
  | 'revolution'     // Body of revolution (concentric circles on same axis)
  | 'rect_pocket'    // Rectangular pocket
  | 'freeform';      // Can't classify further

export interface ConsolidatedFeature {
  id: number;
  type: FeatureType;
  /** Primary axis normal to the feature's sketch plane */
  axis: 'X' | 'Y' | 'Z';
  /** Center position in 3D [x, y, z] */
  center3D: [number, number, number];
  /** Depth range along the primary axis [min, max] */
  depthRange: [number, number];
  /** Total depth of the feature (max - min) */
  depth: number;
  /** For circular features: diameter */
  diameter?: number;
  /** For circular features: radius */
  radius?: number;
  /** For rectangular: width × height */
  width?: number;
  height?: number;
  /** How many raw slices contributed to this feature */
  sliceCount: number;
  /** Representative contour entities (from the best-fitting slice) */
  entities: SketchEntity[];
  /** World-space basis for drawing the entities */
  uAxis: [number, number, number];
  vAxis: [number, number, number];
  planeOrigin: [number, number, number];
  /** Pattern group ID (features that form a rectangular/linear pattern) */
  patternGroupId?: number;
  /** Label for UI */
  label: string;
  /** Confidence 0..1 based on consistency across slices */
  confidence: number;
}

export interface ConsolidationResult {
  features: ConsolidatedFeature[];
  patterns: PatternGroup[];
  stats: {
    inputSlices: number;
    inputContours: number;
    outputFeatures: number;
    reductionRatio: number;
  };
}

export interface PatternGroup {
  id: number;
  type: 'linear' | 'rectangular' | 'circular';
  /** Feature IDs in this pattern */
  featureIds: number[];
  /** Count of instances */
  count: number;
  /** Spacing vector for linear/rectangular patterns */
  spacing?: [number, number, number];
}

// ── Internal types ──

interface ContourSignature {
  sliceIdx: number;
  contourIdx: number;
  axis: 'X' | 'Y' | 'Z';
  depth: number;
  /** Classification */
  cls: 'circle' | 'polygon' | 'complex';
  /** For circles: radius */
  radius?: number;
  /** Center in 2D slice coords */
  center2D: Point2D;
  /** Center in 3D world coords */
  center3D: [number, number, number];
  /** Bounding box width/height in slice coords */
  bbW: number;
  bbH: number;
  /** Number of corners (for polygons) */
  corners?: number;
  /** Entity count */
  entityCount: number;
  /** Angular span (for circles/arcs) */
  spanDeg?: number;
  /** Kasa fit error relative to radius */
  relError?: number;
}

// ── Kasa circle fit ──

function kasaCircleFit(entities: SketchEntity[]): { cx: number; cy: number; r: number; relErr: number; spanDeg: number } | null {
  // Collect all arc/circle endpoints + centers
  const pts: Point2D[] = [];
  let totalSpan = 0;

  for (const e of entities) {
    if (e.type === 'arc') {
      pts.push(e.start, e.end);
      const span = e.isFullCircle ? 360 :
        ((e.endAngle - e.startAngle + 2 * Math.PI) % (2 * Math.PI)) * 180 / Math.PI;
      totalSpan += span;
    } else {
      pts.push(e.start, e.end);
    }
  }

  if (pts.length < 3) return null;

  // Check if all entities are arcs with similar radius
  const arcs = entities.filter((e): e is SketchArc => e.type === 'arc');
  if (arcs.length === 0) return null;

  // Use the arc centers directly (more accurate than Kasa fit from endpoints)
  const radii = arcs.map(a => a.radius);
  const avgR = radii.reduce((s, r) => s + r, 0) / radii.length;
  const maxRDev = Math.max(...radii.map(r => Math.abs(r - avgR)));

  if (maxRDev > avgR * 0.05) return null; // Radii too inconsistent

  const cx = arcs.reduce((s, a) => s + a.center.x, 0) / arcs.length;
  const cy = arcs.reduce((s, a) => s + a.center.y, 0) / arcs.length;
  const maxCDev = Math.max(...arcs.map(a => Math.hypot(a.center.x - cx, a.center.y - cy)));

  return {
    cx, cy,
    r: avgR,
    relErr: Math.max(maxRDev / avgR, maxCDev / avgR),
    spanDeg: totalSpan,
  };
}

// ── Classify a contour ──

function classifyContour(
  slice: FittedSlice,
  contourIdx: number,
  sliceIdx: number,
): ContourSignature | null {
  const contour = slice.contours[contourIdx];
  if (!contour || contour.entities.length === 0) return null;

  const ents = contour.entities;
  const uAxis = slice.uAxis ?? [1, 0, 0];
  const vAxis = slice.vAxis ?? [0, 1, 0];
  const origin = slice.planeOrigin ?? [0, 0, 0];

  // Bounding box from entity endpoints
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const e of ents) {
    for (const p of [e.start, e.end]) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  const bbW = maxX - minX;
  const bbH = maxY - minY;

  // Center in 2D
  const cx2D = (minX + maxX) / 2;
  const cy2D = (minY + maxY) / 2;

  // Convert to 3D
  const center3D: [number, number, number] = [
    origin[0] + cx2D * uAxis[0] + cy2D * vAxis[0],
    origin[1] + cx2D * uAxis[1] + cy2D * vAxis[1],
    origin[2] + cx2D * uAxis[2] + cy2D * vAxis[2],
  ];

  // Try circle fit
  const cf = kasaCircleFit(ents);

  if (cf && cf.relErr < 0.05 && cf.spanDeg > 300) {
    // Convert circle center to 3D
    const c3D: [number, number, number] = [
      origin[0] + cf.cx * uAxis[0] + cf.cy * vAxis[0],
      origin[1] + cf.cx * uAxis[1] + cf.cy * vAxis[1],
      origin[2] + cf.cx * uAxis[2] + cf.cy * vAxis[2],
    ];
    return {
      sliceIdx, contourIdx, axis: slice.axis, depth: slice.value,
      cls: 'circle', radius: cf.r,
      center2D: { x: cf.cx, y: cf.cy },
      center3D: c3D, bbW, bbH,
      entityCount: ents.length,
      spanDeg: cf.spanDeg,
      relError: cf.relErr,
    };
  }

  // Count lines (= corners of polygon)
  const lines = ents.filter(e => e.type === 'line');
  if (lines.length >= 3) {
    return {
      sliceIdx, contourIdx, axis: slice.axis, depth: slice.value,
      cls: 'polygon', corners: lines.length,
      center2D: { x: cx2D, y: cy2D },
      center3D, bbW, bbH,
      entityCount: ents.length,
    };
  }

  return {
    sliceIdx, contourIdx, axis: slice.axis, depth: slice.value,
    cls: 'complex',
    center2D: { x: cx2D, y: cy2D },
    center3D, bbW, bbH,
    entityCount: ents.length,
  };
}

// ── Cluster identical contours along an axis ──

function clusterContours(sigs: ContourSignature[]): ContourSignature[][] {
  const used = new Set<number>();
  const clusters: ContourSignature[][] = [];

  for (let i = 0; i < sigs.length; i++) {
    if (used.has(i)) continue;
    const a = sigs[i];
    const cluster = [a];
    used.add(i);

    for (let j = i + 1; j < sigs.length; j++) {
      if (used.has(j)) continue;
      const b = sigs[j];
      if (a.axis !== b.axis) continue;
      if (a.cls !== b.cls) continue;

      if (a.cls === 'circle' && b.cls === 'circle') {
        // Same circle: similar radius and similar center (projected onto the 2D plane)
        const rTol = Math.max(a.radius! * 0.03, 0.01);
        const cTol = Math.max(a.radius! * 0.05, 0.05);
        if (Math.abs(a.radius! - b.radius!) > rTol) continue;

        // Compare 3D center position (ignoring the axis component)
        const axIdx = a.axis === 'X' ? 0 : a.axis === 'Y' ? 1 : 2;
        const dc = Math.hypot(
          ...([0, 1, 2].filter(k => k !== axIdx).map(k => a.center3D[k] - b.center3D[k])) as [number, number],
        );
        if (dc > cTol) continue;

        cluster.push(b);
        used.add(j);
      } else if (a.cls === 'polygon' && b.cls === 'polygon') {
        // Same polygon: same corner count, similar size and position
        if (a.corners !== b.corners) continue;
        const sizeTol = Math.max(a.bbW * 0.05, 0.1);
        if (Math.abs(a.bbW - b.bbW) > sizeTol || Math.abs(a.bbH - b.bbH) > sizeTol) continue;

        const axIdx = a.axis === 'X' ? 0 : a.axis === 'Y' ? 1 : 2;
        const dc = Math.hypot(
          ...([0, 1, 2].filter(k => k !== axIdx).map(k => a.center3D[k] - b.center3D[k])) as [number, number],
        );
        if (dc > sizeTol) continue;

        cluster.push(b);
        used.add(j);
      } else if (a.cls === 'complex' && b.cls === 'complex') {
        // Same complex: similar bounding box and position
        const sizeTol = Math.max(a.bbW * 0.05, 0.1);
        if (Math.abs(a.bbW - b.bbW) > sizeTol || Math.abs(a.bbH - b.bbH) > sizeTol) continue;

        const axIdx = a.axis === 'X' ? 0 : a.axis === 'Y' ? 1 : 2;
        const dc = Math.hypot(
          ...([0, 1, 2].filter(k => k !== axIdx).map(k => a.center3D[k] - b.center3D[k])) as [number, number],
        );
        if (dc > sizeTol) continue;

        cluster.push(b);
        used.add(j);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

// ── Convert cluster → ConsolidatedFeature ──

function clusterToFeature(
  cluster: ContourSignature[],
  slices: FittedSlice[],
  featureId: number,
): ConsolidatedFeature {
  const first = cluster[0];
  const depths = cluster.map(c => c.depth).sort((a, b) => a - b);
  const depthMin = depths[0];
  const depthMax = depths[depths.length - 1];

  // Pick the slice with the most entities as "representative"
  const bestSig = cluster.reduce((best, c) =>
    c.entityCount >= best.entityCount ? c : best, cluster[0]);
  const bestSlice = slices[bestSig.sliceIdx];
  const bestContour = bestSlice.contours[bestSig.contourIdx];

  const base: ConsolidatedFeature = {
    id: featureId,
    type: 'freeform',
    axis: first.axis,
    center3D: first.center3D,
    depthRange: [depthMin, depthMax],
    depth: depthMax - depthMin,
    sliceCount: cluster.length,
    entities: bestContour.entities,
    uAxis: bestSlice.uAxis ?? [1, 0, 0],
    vAxis: bestSlice.vAxis ?? [0, 1, 0],
    planeOrigin: bestSlice.planeOrigin ?? [0, 0, 0],
    label: '',
    confidence: Math.min(1, cluster.length / 3),
  };

  if (first.cls === 'circle' && first.radius) {
    base.radius = first.radius;
    base.diameter = first.radius * 2;
    base.type = cluster.length >= 3 ? 'hole' : 'blind_hole';
    base.label = `${base.type === 'hole' ? 'Hole' : 'Blind Hole'} ⊙ ø${base.diameter.toFixed(3)}`;
  } else if (first.cls === 'polygon') {
    base.width = first.bbW;
    base.height = first.bbH;
    const aspect = Math.max(first.bbW, first.bbH) / Math.min(first.bbW, first.bbH);
    if (aspect > 3) {
      base.type = 'slot';
      base.label = `Slot ${first.bbW.toFixed(1)}×${first.bbH.toFixed(1)}`;
    } else {
      base.type = 'rect_pocket';
      base.label = `Pocket ${first.bbW.toFixed(1)}×${first.bbH.toFixed(1)}`;
    }
  } else {
    base.width = first.bbW;
    base.height = first.bbH;
    base.type = 'pocket';
    base.label = `Feature ${first.bbW.toFixed(1)}×${first.bbH.toFixed(1)}`;
  }

  if (base.depth > 0.001) {
    base.label += ` ↧${base.depth.toFixed(2)}`;
  }

  return base;
}

// ── Detect counterbores (concentric circles at same position, different radii/depths) ──

function detectCounterbores(features: ConsolidatedFeature[]): void {
  const circles = features.filter(f => f.type === 'hole' || f.type === 'blind_hole');

  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const a = circles[i];
      const b = circles[j];
      if (a.axis !== b.axis) continue;

      // Same position (ignoring axis component)?
      const axIdx = a.axis === 'X' ? 0 : a.axis === 'Y' ? 1 : 2;
      const dc = Math.hypot(
        ...([0, 1, 2].filter(k => k !== axIdx).map(k => a.center3D[k] - b.center3D[k])) as [number, number],
      );

      if (dc > 0.1) continue;
      if (!a.radius || !b.radius) continue;
      if (Math.abs(a.radius - b.radius) < 0.01) continue; // Same radius = same feature

      // Different radii at same position = counterbore
      const outer = a.radius > b.radius ? a : b;
      const inner = a.radius > b.radius ? b : a;

      // The outer one is the counterbore step
      outer.type = 'counterbore';
      outer.label = `Counterbore ⊙ ø${outer.diameter!.toFixed(3)} (inner ø${inner.diameter!.toFixed(3)})`;
    }
  }
}

// ── Detect patterns (groups of identical features at regular spacing) ──

function detectPatterns(features: ConsolidatedFeature[]): PatternGroup[] {
  const patterns: PatternGroup[] = [];
  let patternId = 0;
  const assigned = new Set<number>();

  // Group by type + axis + similar radius/size
  const groups: Map<string, ConsolidatedFeature[]> = new Map();

  for (const f of features) {
    const key = f.type === 'hole' || f.type === 'blind_hole' || f.type === 'counterbore'
      ? `${f.axis}_circle_${f.radius?.toFixed(2)}`
      : `${f.axis}_${f.type}_${f.width?.toFixed(1)}_${f.height?.toFixed(1)}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }

  for (const [, group] of groups) {
    if (group.length < 2) continue;
    if (group.every(f => assigned.has(f.id))) continue;

    const unassigned = group.filter(f => !assigned.has(f.id));
    if (unassigned.length < 2) continue;

    // Check for regular spacing
    const axIdx = unassigned[0].axis === 'X' ? 0 : unassigned[0].axis === 'Y' ? 1 : 2;
    const crossAxes = [0, 1, 2].filter(k => k !== axIdx);

    // Sort by first cross-axis position
    unassigned.sort((a, b) => a.center3D[crossAxes[0]] - b.center3D[crossAxes[0]]);

    const pg: PatternGroup = {
      id: patternId++,
      type: unassigned.length === 2 ? 'linear' : 'rectangular',
      featureIds: unassigned.map(f => f.id),
      count: unassigned.length,
    };

    // Calculate spacing if features are uniformly spaced
    if (unassigned.length >= 2) {
      const dx = unassigned[1].center3D[0] - unassigned[0].center3D[0];
      const dy = unassigned[1].center3D[1] - unassigned[0].center3D[1];
      const dz = unassigned[1].center3D[2] - unassigned[0].center3D[2];
      pg.spacing = [dx, dy, dz];
    }

    for (const f of unassigned) {
      f.patternGroupId = pg.id;
      assigned.add(f.id);
    }

    patterns.push(pg);
  }

  return patterns;
}

// ── Cross-axis dedup: remove features seen from X/Y that are really Z features ──

function crossAxisDedup(features: ConsolidatedFeature[]): ConsolidatedFeature[] {
  // A cylinder (hole) viewed from Z is a circle.
  // Viewed from X or Y it appears as a rectangle with height = depth.
  // The Z-axis circle is the "real" feature; X/Y rects are just cross-sections.

  // Strategy: for each Z circle feature, check if there are X/Y features
  // at the same 3D position that are just the silhouette.
  const circles = features.filter(f =>
    f.axis === 'Z' && (f.type === 'hole' || f.type === 'blind_hole' || f.type === 'counterbore'),
  );

  const toRemove = new Set<number>();

  for (const circ of circles) {
    // Find X/Y features at same position
    for (const f of features) {
      if (f.axis === 'Z') continue;
      if (toRemove.has(f.id)) continue;

      // Is this feature at the same 3D position as the circle?
      const dc = Math.hypot(
        circ.center3D[0] - f.center3D[0],
        circ.center3D[1] - f.center3D[1],
        circ.center3D[2] - f.center3D[2],
      );

      // Rough position match: within the circle's diameter
      if (dc > (circ.diameter ?? 1) * 2) continue;

      // The cross-section of a cylinder from a perpendicular axis
      // has bb height ≈ cylinder depth and bb width ≈ diameter
      if (!f.width || !f.height) continue;
      const dim = circ.diameter ?? 0;
      const dep = circ.depth;

      const wMatch = Math.abs(f.width - dim) < dim * 0.3 || Math.abs(f.height - dim) < dim * 0.3;
      const dMatch = Math.abs(f.width - dep) < dep * 0.3 || Math.abs(f.height - dep) < dep * 0.3;

      if (wMatch && dMatch) {
        toRemove.add(f.id);
      }
    }
  }

  return features.filter(f => !toRemove.has(f.id));
}

// ── Filter trivial contours (tiny debris from mesh tessellation) ──

function isSignificant(sig: ContourSignature, diag: number): boolean {
  const minSize = diag * 0.005; // 0.5% of diagonal
  return sig.bbW > minSize || sig.bbH > minSize;
}

// ── Main consolidation entry point ──

export function consolidateFeatures(
  slices: FittedSlice[],
  boundingBoxDiag: number,
): ConsolidationResult {
  // Step 1: Classify all contours
  const sigs: ContourSignature[] = [];
  let totalContours = 0;

  for (let si = 0; si < slices.length; si++) {
    const slice = slices[si];
    for (let ci = 0; ci < slice.contours.length; ci++) {
      totalContours++;
      const sig = classifyContour(slice, ci, si);
      if (sig && isSignificant(sig, boundingBoxDiag)) {
        sigs.push(sig);
      }
    }
  }

  // Step 2: Cluster identical contours along each axis
  const clusters = clusterContours(sigs);

  // Step 3: Convert clusters → features
  let featureId = 0;
  const features: ConsolidatedFeature[] = clusters.map(cluster =>
    clusterToFeature(cluster, slices, featureId++),
  );

  // Step 4: Detect counterbores
  detectCounterbores(features);

  // Step 5: Cross-axis dedup
  const deduped = crossAxisDedup(features);

  // Step 6: Detect patterns
  const patterns = detectPatterns(deduped);

  // Re-index feature IDs
  deduped.forEach((f, i) => { f.id = i; });

  return {
    features: deduped,
    patterns,
    stats: {
      inputSlices: slices.length,
      inputContours: totalContours,
      outputFeatures: deduped.length,
      reductionRatio: totalContours / Math.max(1, deduped.length),
    },
  };
}

// ── Convert to VizFeature for existing UI ──

export function toVizFeatures(result: ConsolidationResult): VizFeature[] {
  const { features, patterns } = result;

  return features.map(f => {
    const isInPattern = f.patternGroupId != null;
    const pattern = isInPattern
      ? patterns.find(p => p.id === f.patternGroupId)
      : null;

    // Map our type to VizFeature type
    const typeMap: Record<FeatureType, string> = {
      hole: 'hole',
      blind_hole: 'hole',
      counterbore: 'hole',
      pocket: 'freeform_pocket',
      slot: 'slot',
      boss: 'circle',
      revolution: 'revolution',
      rect_pocket: 'rect_pocket',
      freeform: 'freeform_pocket',
    };

    const params: Record<string, number> = {};
    if (f.diameter) params.diameter = f.diameter;
    if (f.width) params.width = f.width;
    if (f.height) params.height = f.height;
    if (f.depth > 0.001) params.depth = f.depth;

    return {
      type: typeMap[f.type] ?? 'freeform_pocket',
      label: f.label,
      params,
      normal: f.axis === 'X' ? [1, 0, 0] : f.axis === 'Y' ? [0, 1, 0] : [0, 0, 1],
      centroid: { x: f.center3D[0], y: f.center3D[1] },
      depth: f.depth,
      confidence: f.confidence,
      sliceCount: f.sliceCount,
      count: pattern ? pattern.count : undefined,
    };
  });
}
