/**
 * ⚒️ La Forja de Hefestos — Feature Recognition
 * =================================================
 * Converts raw sketch entities (lines, arcs, circles) from the
 * CT-scan pipeline into high-level CAD operations.
 *
 * Philosophy:
 *   "32K lines + 9K arcs + 3K circles" → "15 operations"
 *
 * Pipeline:
 *   1. Group entities into closed profiles (loops)
 *   2. Classify each profile: Hole | Slot | Pocket | Boss | Keyhole | Freeform
 *   3. Cluster identical profiles across slices → extrusion depth
 *   4. Detect patterns: linear/circular arrays
 *   5. Output a feature tree (like Fusion's timeline)
 */

import type { SketchEntity, SketchLine, SketchArc, SketchConstraint, FittedContour } from './sketch-fitting';
import type { Point2D } from './cross-section';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type ProfileType =
  | 'circle'      // single full circle
  | 'slot'        // oblong: 2 arcs (semicircles) + 2 parallel lines
  | 'rect'        // rectangle (4 lines, H/V)
  | 'fillet_rect' // rectangle with corner radii
  | 'keyhole'     // circle + narrow slot
  | 'polygon'     // closed polygon of lines only
  | 'freeform';   // mixed entities, complex shape

/** A closed 2D profile made of sketch entities */
export interface Profile {
  /** Profile type classification */
  type: ProfileType;
  /** Entities forming this profile (in loop order) */
  entities: SketchEntity[];
  /** Centroid of the profile */
  centroid: Point2D;
  /** Bounding box */
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  /** Approximate area */
  area: number;
  /** For circles: radius */
  radius?: number;
  /** For slots: width and length */
  slotWidth?: number;
  slotLength?: number;
  /** For rects: width and height, and optional corner radius */
  rectWidth?: number;
  rectHeight?: number;
  cornerRadius?: number;
  /** Is this a hole (negative volume) or boss (positive)? */
  isHole: boolean;
}

export type FeatureType =
  | 'hole'            // circular through or blind hole
  | 'counterbore'     // stepped concentric circles
  | 'countersink'     // tapered hole
  | 'slot'            // oblong slot
  | 'rectangular_pocket'
  | 'fillet_pocket'   // pocket with corner radii
  | 'keyhole'
  | 'boss'            // protruding feature
  | 'pattern_linear'  // array of identical features
  | 'pattern_circular'
  | 'extrude_base'    // the main body
  | 'freeform_pocket'
  | 'text_engrave';   // text features (like the NIST logo)

/** A high-level manufacturing feature */
export interface CadFeature {
  type: FeatureType;
  /** Human-readable label */
  label: string;
  /** 3D position [x, y, z] */
  position: [number, number, number];
  /** Extrusion direction normal */
  normal: [number, number, number];
  /** Depth of the feature */
  depth: number;
  /** Profile that defines this feature's cross-section */
  profile: Profile;
  /** For patterns: child features in the pattern */
  children?: CadFeature[];
  /** For patterns: count */
  count?: number;
  /** Parameters (diameter, width, height, radius, etc.) */
  params: Record<string, number>;
  /** Confidence 0-1 */
  confidence: number;
}

/** Complete feature decomposition result */
export interface FeatureDecomposition {
  features: CadFeature[];
  stats: {
    totalFeatures: number;
    holes: number;
    slots: number;
    pockets: number;
    bosses: number;
    patterns: number;
    freeform: number;
    processingTimeMs: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// Utility
// ═══════════════════════════════════════════════════════════════

function dist(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function centroidOf(pts: Point2D[]): Point2D {
  let sx = 0, sy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; }
  return { x: sx / pts.length, y: sy / pts.length };
}

function bboxOf(pts: Point2D[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function entityPoints(e: SketchEntity): Point2D[] {
  if (e.type === 'line') return [e.start, e.end];
  if (e.isFullCircle) {
    const pts: Point2D[] = [];
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      pts.push({ x: e.center.x + e.radius * Math.cos(a), y: e.center.y + e.radius * Math.sin(a) });
    }
    return pts;
  }
  // Arc: sample
  const pts: Point2D[] = [];
  const sw = e.endAngle - e.startAngle;
  const n = Math.max(8, Math.ceil(Math.abs(sw) * 16 / Math.PI));
  for (let i = 0; i <= n; i++) {
    const a = e.startAngle + sw * (i / n);
    pts.push({ x: e.center.x + e.radius * Math.cos(a), y: e.center.y + e.radius * Math.sin(a) });
  }
  return pts;
}

/** Shoelace formula for signed area */
function signedArea(pts: Point2D[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

// ═══════════════════════════════════════════════════════════════
// Phase 1: Group entities into closed profiles
// ═══════════════════════════════════════════════════════════════

function getStart(e: SketchEntity): Point2D { return e.start; }
function getEnd(e: SketchEntity): Point2D { return e.end; }

/**
 * Given a flat list of entities from a single contour's fitContour result,
 * build one or more closed loops (profiles).
 * Typically fitContour already returns a single loop, so this just validates.
 */
export function groupIntoProfiles(entities: SketchEntity[], outerArea: number): Profile[] {
  if (entities.length === 0) return [];

  // Single full circle → profile directly
  if (entities.length === 1 && entities[0].type === 'arc' && entities[0].isFullCircle) {
    const c = entities[0] as SketchArc;
    return [{
      type: 'circle',
      entities: [c],
      centroid: { ...c.center },
      bbox: { minX: c.center.x - c.radius, minY: c.center.y - c.radius, maxX: c.center.x + c.radius, maxY: c.center.y + c.radius },
      area: Math.PI * c.radius * c.radius,
      radius: c.radius,
      isHole: outerArea > 0, // if outer contour is positive, a contained circle is a hole
    }];
  }

  // Collect all points for centroid/bbox
  const allPts: Point2D[] = [];
  for (const e of entities) allPts.push(...entityPoints(e));
  const cent = centroidOf(allPts);
  const bb = bboxOf(allPts);
  const area = Math.abs(signedArea(allPts));

  // Classify the entity set
  const profile = classifyProfile(entities, cent, bb, area, outerArea);
  return [profile];
}

// ═══════════════════════════════════════════════════════════════
// Phase 2: Classify each profile
// ═══════════════════════════════════════════════════════════════

function classifyProfile(
  entities: SketchEntity[],
  centroid: Point2D,
  bbox: ReturnType<typeof bboxOf>,
  area: number,
  outerArea: number,
): Profile {
  const lines = entities.filter(e => e.type === 'line') as SketchLine[];
  const arcs = entities.filter(e => e.type === 'arc') as SketchArc[];
  const fullCircles = arcs.filter(a => a.isFullCircle);
  const partialArcs = arcs.filter(a => !a.isFullCircle);

  const isHole = outerArea > area * 0.5; // contained within a larger profile

  const base = { entities, centroid, bbox, area, isHole };

  // ── SLOT: 2 semicircular arcs + 2 parallel lines ──
  if (partialArcs.length === 2 && lines.length === 2 && fullCircles.length === 0) {
    const a1 = partialArcs[0], a2 = partialArcs[1];
    const rd = Math.abs(a1.radius - a2.radius) / Math.max(a1.radius, a2.radius);
    const sw1 = Math.abs(a1.endAngle - a1.startAngle);
    const sw2 = Math.abs(a2.endAngle - a2.startAngle);
    // Both arcs are roughly semicircles (sweep > 140°)
    if (rd < 0.15 && sw1 > 2.4 && sw2 > 2.4) {
      const slotWidth = (a1.radius + a2.radius);  // diameter
      const slotLength = dist(a1.center, a2.center) + slotWidth;
      return { ...base, type: 'slot', slotWidth, slotLength };
    }
  }

  // ── RECTANGLE: 4 lines, roughly H/V, all perpendicular ──
  if (lines.length >= 4 && partialArcs.length === 0 && fullCircles.length === 0) {
    const w = bbox.maxX - bbox.minX;
    const h = bbox.maxY - bbox.minY;
    const hvLines = lines.filter(l => {
      const dx = Math.abs(l.end.x - l.start.x);
      const dy = Math.abs(l.end.y - l.start.y);
      const len = dist(l.start, l.end);
      return len > 0.001 && (dx / len < 0.05 || dy / len < 0.05);
    });
    if (hvLines.length >= 4 && lines.length <= 6) {
      return { ...base, type: 'rect', rectWidth: w, rectHeight: h };
    }
  }

  // ── FILLET RECT: lines (H/V) + small corner arcs ──
  if (lines.length >= 4 && partialArcs.length >= 2) {
    const w = bbox.maxX - bbox.minX;
    const h = bbox.maxY - bbox.minY;
    const maxDim = Math.max(w, h);
    // Corner arcs should be small relative to the rect
    const smallArcs = partialArcs.filter(a => a.radius < maxDim * 0.3);
    const hvLines = lines.filter(l => {
      const dx = Math.abs(l.end.x - l.start.x);
      const dy = Math.abs(l.end.y - l.start.y);
      const len = dist(l.start, l.end);
      return len > 0.001 && (dx / len < 0.1 || dy / len < 0.1);
    });
    if (hvLines.length >= 4 && smallArcs.length >= 2) {
      const avgCornerR = smallArcs.reduce((s, a) => s + a.radius, 0) / smallArcs.length;
      return { ...base, type: 'fillet_rect', rectWidth: w, rectHeight: h, cornerRadius: avgCornerR };
    }
  }

  // ── POLYGON: all lines ──
  if (lines.length >= 3 && partialArcs.length === 0 && fullCircles.length === 0) {
    return { ...base, type: 'polygon' };
  }

  // ── FREEFORM: anything else ──
  return { ...base, type: 'freeform' };
}

// ═══════════════════════════════════════════════════════════════
// Phase 3: Cluster identical profiles across slices → Features 
// ═══════════════════════════════════════════════════════════════

interface SlicedProfile {
  profile: Profile;
  sliceNormal: [number, number, number];
  sliceOffset: number;
  planeLabel: string;
}

/**
 * Profile similarity metric.
 * Returns 0 for identical profiles, higher for different.
 * Compares: type, centroid distance, dimensions.
 */
function profileSimilarity(a: Profile, b: Profile): number {
  if (a.type !== b.type) return Infinity;
  const cdist = dist(a.centroid, b.centroid);
  const areaRatio = Math.abs(a.area - b.area) / Math.max(a.area, b.area, 1e-12);

  if (a.type === 'circle' && b.type === 'circle') {
    return cdist + Math.abs((a.radius ?? 0) - (b.radius ?? 0)) * 10 + areaRatio * 100;
  }
  if ((a.type === 'slot' && b.type === 'slot')) {
    return cdist + Math.abs((a.slotWidth ?? 0) - (b.slotWidth ?? 0)) * 5
      + Math.abs((a.slotLength ?? 0) - (b.slotLength ?? 0)) * 5;
  }
  if ((a.type === 'rect' || a.type === 'fillet_rect') && (b.type === 'rect' || b.type === 'fillet_rect')) {
    const wDiff = Math.abs((a.rectWidth ?? 0) - (b.rectWidth ?? 0));
    const hDiff = Math.abs((a.rectHeight ?? 0) - (b.rectHeight ?? 0));
    return cdist + (wDiff + hDiff) * 5;
  }
  return cdist + areaRatio * 100;
}

/**
 * Two profiles are "same feature" if they share the same direction,
 * and their 2D shape is near-identical (just at different offsets).
 */
function isSameFeature(a: SlicedProfile, b: SlicedProfile, tol: number): boolean {
  // Must be same direction
  const n1 = a.sliceNormal, n2 = b.sliceNormal;
  const dotN = Math.abs(n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2]);
  if (dotN < 0.99) return false;
  return profileSimilarity(a.profile, b.profile) < tol;
}

/**
 * Cluster sliced profiles into features.
 * Profiles with same type, same centroid (in 2D), same shape
 * at consecutive offsets → one extruded feature.
 */
export function clusterIntoFeatures(
  slicedProfiles: SlicedProfile[],
  diag: number,
): CadFeature[] {
  const tol = diag * 0.05;  // 5% of diagonal for "same position" tolerance
  const used = new Set<number>();
  const features: CadFeature[] = [];

  for (let i = 0; i < slicedProfiles.length; i++) {
    if (used.has(i)) continue;
    const sp = slicedProfiles[i];
    used.add(i);

    // Find all matching profiles in the same direction
    const group: SlicedProfile[] = [sp];
    for (let j = i + 1; j < slicedProfiles.length; j++) {
      if (used.has(j)) continue;
      if (isSameFeature(sp, slicedProfiles[j], tol)) {
        group.push(slicedProfiles[j]);
        used.add(j);
      }
    }

    // Compute depth from offset range
    const offsets = group.map(g => g.sliceOffset).sort((a, b) => a - b);
    const depth = offsets[offsets.length - 1] - offsets[0];
    const midOffset = (offsets[0] + offsets[offsets.length - 1]) / 2;

    // 3D position from 2D centroid + offset along normal
    const n = sp.sliceNormal;
    const c = sp.profile.centroid;
    // We need to re-project from 2D back to 3D — use plane basis
    // For now, approximate with the normal direction for the offset component
    const pos: [number, number, number] = [
      n[0] * midOffset,
      n[1] * midOffset,
      n[2] * midOffset,
    ];

    const feat = profileToFeature(sp.profile, pos, n, depth, group.length);
    features.push(feat);
  }

  return features;
}

function profileToFeature(
  profile: Profile,
  position: [number, number, number],
  normal: [number, number, number],
  depth: number,
  sliceCount: number,
): CadFeature {
  const params: Record<string, number> = {};
  let type: FeatureType;
  let label: string;
  const confidence = Math.min(1, 0.5 + sliceCount * 0.1);

  switch (profile.type) {
    case 'circle':
      if (profile.isHole) {
        type = 'hole';
        params.diameter = (profile.radius ?? 0) * 2;
        params.depth = depth;
        label = `⊙ Hole ø${params.diameter.toFixed(2)}mm`;
      } else {
        type = 'boss';
        params.diameter = (profile.radius ?? 0) * 2;
        params.height = depth;
        label = `Boss ø${params.diameter.toFixed(2)}mm`;
      }
      break;

    case 'slot':
      type = 'slot';
      params.width = profile.slotWidth ?? 0;
      params.length = profile.slotLength ?? 0;
      params.depth = depth;
      label = `Slot ${params.width.toFixed(1)}×${params.length.toFixed(1)}mm`;
      break;

    case 'rect':
      type = profile.isHole ? 'rectangular_pocket' : 'boss';
      params.width = profile.rectWidth ?? 0;
      params.height = profile.rectHeight ?? 0;
      params.depth = depth;
      label = profile.isHole
        ? `Pocket ${params.width.toFixed(1)}×${params.height.toFixed(1)}mm`
        : `Boss ${params.width.toFixed(1)}×${params.height.toFixed(1)}mm`;
      break;

    case 'fillet_rect':
      type = profile.isHole ? 'fillet_pocket' : 'boss';
      params.width = profile.rectWidth ?? 0;
      params.height = profile.rectHeight ?? 0;
      params.cornerRadius = profile.cornerRadius ?? 0;
      params.depth = depth;
      label = profile.isHole
        ? `Fillet Pocket ${params.width.toFixed(1)}×${params.height.toFixed(1)}mm R${params.cornerRadius.toFixed(1)}`
        : `Boss ${params.width.toFixed(1)}×${params.height.toFixed(1)}mm`;
      break;

    default:
      type = profile.isHole ? 'freeform_pocket' : 'boss';
      params.depth = depth;
      label = profile.isHole
        ? `Freeform Pocket`
        : `Freeform Boss`;
      break;
  }

  return { type, label, position, normal, depth, profile, params, confidence };
}

// ═══════════════════════════════════════════════════════════════
// Phase 4: Pattern Detection
// ═══════════════════════════════════════════════════════════════

/**
 * Detect linear and circular patterns among features of the same type+params.
 * Groups like "8 holes ø5mm in a circle" → Pattern feature.
 */
export function detectPatterns(features: CadFeature[], tol: number): CadFeature[] {
  const result: CadFeature[] = [];
  const used = new Set<number>();

  // Group by type + matching params
  const groups = new Map<string, number[]>();
  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const key = `${f.type}|${Object.entries(f.params).filter(([k]) => k !== 'depth').map(([k, v]) => `${k}=${v.toFixed(2)}`).join(',')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  }

  for (const [, indices] of groups) {
    if (indices.length < 3) {
      for (const i of indices) result.push(features[i]);
      continue;
    }

    // Check for circular pattern: all features equidistant from a center
    const fts = indices.map(i => features[i]);
    const positions = fts.map(f => ({ x: f.position[0], y: f.position[1] }));
    const cent = centroidOf(positions);
    const radii = positions.map(p => dist(p, cent));
    const avgR = radii.reduce((s, r) => s + r, 0) / radii.length;
    const radDev = radii.reduce((s, r) => s + Math.abs(r - avgR), 0) / radii.length;

    if (avgR > tol && radDev < avgR * 0.1 && indices.length >= 3) {
      // Circular pattern detected!
      const pattern: CadFeature = {
        type: 'pattern_circular',
        label: `Circular Pattern ×${indices.length} (${fts[0].label})`,
        position: [cent.x, cent.y, fts[0].position[2]],
        normal: fts[0].normal,
        depth: fts[0].depth,
        profile: fts[0].profile,
        children: fts,
        count: indices.length,
        params: { ...fts[0].params, patternRadius: avgR, count: indices.length },
        confidence: 0.8,
      };
      for (const i of indices) used.add(i);
      result.push(pattern);
      continue;
    }

    // Check for linear pattern: sorted positions form even spacing
    const sorted = [...fts].sort((a, b) => {
      const dx = a.position[0] - b.position[0];
      return Math.abs(dx) > tol ? dx : a.position[1] - b.position[1];
    });
    const spacings: number[] = [];
    for (let j = 1; j < sorted.length; j++) {
      spacings.push(dist(
        { x: sorted[j].position[0], y: sorted[j].position[1] },
        { x: sorted[j - 1].position[0], y: sorted[j - 1].position[1] },
      ));
    }
    const avgSpacing = spacings.reduce((s, v) => s + v, 0) / spacings.length;
    const spacingDev = spacings.reduce((s, v) => s + Math.abs(v - avgSpacing), 0) / spacings.length;

    if (avgSpacing > tol && spacingDev < avgSpacing * 0.15) {
      const pattern: CadFeature = {
        type: 'pattern_linear',
        label: `Linear Pattern ×${indices.length} (${fts[0].label})`,
        position: sorted[0].position,
        normal: fts[0].normal,
        depth: fts[0].depth,
        profile: fts[0].profile,
        children: sorted,
        count: indices.length,
        params: { ...fts[0].params, spacing: avgSpacing, count: indices.length },
        confidence: 0.7,
      };
      for (const i of indices) used.add(i);
      result.push(pattern);
      continue;
    }

    // No pattern, just output all individually
    for (const i of indices) result.push(features[i]);
  }

  // Add remaining features
  for (let i = 0; i < features.length; i++) {
    if (!used.has(i)) continue; // already added
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// Phase 5: Outer contour detection → Extrude base
// ═══════════════════════════════════════════════════════════════

/**
 * Find the largest contour in all slices — that's the "base body" extrusion.
 */
function findBaseExtrusion(slicedProfiles: SlicedProfile[]): CadFeature | null {
  let largest: SlicedProfile | null = null;
  for (const sp of slicedProfiles) {
    if (!largest || sp.profile.area > largest.profile.area) {
      largest = sp;
    }
  }
  if (!largest) return null;

  // The base has the max area; collect all matching slices
  const n = largest.sliceNormal;
  const baseSlices = slicedProfiles.filter(sp =>
    sp.profile.area > largest!.profile.area * 0.8 &&
    Math.abs(n[0]*sp.sliceNormal[0]+n[1]*sp.sliceNormal[1]+n[2]*sp.sliceNormal[2]) > 0.99,
  );

  const offsets = baseSlices.map(s => s.sliceOffset).sort((a, b) => a - b);
  const depth = offsets.length > 1 ? offsets[offsets.length - 1] - offsets[0] : 0;

  return {
    type: 'extrude_base',
    label: `Base Body (${largest.profile.type})`,
    position: [0, 0, 0],
    normal: [...n],
    depth,
    profile: largest.profile,
    params: { width: largest.profile.bbox.maxX - largest.profile.bbox.minX, height: largest.profile.bbox.maxY - largest.profile.bbox.minY, depth },
    confidence: 0.95,
  };
}

// ═══════════════════════════════════════════════════════════════
// Main: Full Pipeline
// ═══════════════════════════════════════════════════════════════

export interface FittedSliceData {
  planeNormal: [number, number, number];
  planeOffset: number;
  planeLabel: string;
  contours: Array<{
    entities: SketchEntity[];
    area: number;
  }>;
}

/**
 * Run the full feature recognition pipeline:
 *   fitted contours → profiles → features → patterns
 */
export function recognizeFeatures(
  slices: FittedSliceData[],
  diag: number,
): FeatureDecomposition {
  const t0 = performance.now();

  // Phase 1+2: Build profiles from every contour in every slice
  const slicedProfiles: SlicedProfile[] = [];

  // Find the largest contour area to identify which are "outer" vs "hole"
  let maxContourArea = 0;
  for (const sl of slices) {
    for (const c of sl.contours) {
      if (c.area > maxContourArea) maxContourArea = c.area;
    }
  }

  for (const sl of slices) {
    for (const c of sl.contours) {
      const profiles = groupIntoProfiles(c.entities, maxContourArea);
      for (const p of profiles) {
        slicedProfiles.push({
          profile: p,
          sliceNormal: sl.planeNormal,
          sliceOffset: sl.planeOffset,
          planeLabel: sl.planeLabel,
        });
      }
    }
  }

  // Separate base body vs features
  const base = findBaseExtrusion(slicedProfiles);
  const nonBase = base
    ? slicedProfiles.filter(sp => sp.profile.area < (base.profile.area * 0.8))
    : slicedProfiles;

  // Phase 3: Cluster into features
  const rawFeatures = clusterIntoFeatures(nonBase, diag);

  // Phase 4: Detect patterns
  const patternFeatures = detectPatterns(rawFeatures, diag * 0.02);

  // Combine
  const allFeatures: CadFeature[] = [];
  if (base) allFeatures.push(base);
  allFeatures.push(...patternFeatures);

  // Stats
  let holes = 0, slots = 0, pockets = 0, bosses = 0, patterns = 0, freeform = 0;
  for (const f of allFeatures) {
    switch (f.type) {
      case 'hole': case 'counterbore': case 'countersink': holes++; break;
      case 'slot': slots++; break;
      case 'rectangular_pocket': case 'fillet_pocket': pockets++; break;
      case 'boss': case 'extrude_base': bosses++; break;
      case 'pattern_linear': case 'pattern_circular': patterns++; break;
      default: freeform++; break;
    }
  }

  return {
    features: allFeatures,
    stats: {
      totalFeatures: allFeatures.length,
      holes, slots, pockets, bosses, patterns, freeform,
      processingTimeMs: performance.now() - t0,
    },
  };
}
