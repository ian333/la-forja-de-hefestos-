/**
 * CT-Scan Round-Trip Validator
 * ==============================
 * Validates the decomposition by checking:
 * Can we reconstruct the original geometry from the extracted features?
 *
 * Method: Compare cross-section areas at each slice height.
 *   Original mesh sliced at Z=val → area_original
 *   Reconstructed features covering Z=val → area_reconstructed
 *   If area_reconstructed ≈ area_original at all heights → decomposition is correct
 *
 * Usage: node scripts/ct-scan-validate.cjs [file.stp]
 */

const fs = require('fs');
const path = require('path');
const occtFactory = require('occt-import-js');

// ═══════════════════════════════════════════════════════════════
// Minimal Three.js polyfill (same as ct-scan-test.cjs)
// ═══════════════════════════════════════════════════════════════
class BufferAttribute {
  constructor(array, itemSize) {
    this.array = array;
    this.itemSize = itemSize;
    this.count = array.length / itemSize;
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
// Slicer (same as test script — extracted for clarity)
// ═══════════════════════════════════════════════════════════════

function getComp(attr, idx, comp) {
  switch (comp) { case 0: return attr.getX(idx); case 1: return attr.getY(idx); case 2: return attr.getZ(idx); default: return 0; }
}

function shoelaceArea(pts) {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function centroidOf(pts) {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  return { x: cx / pts.length, y: cy / pts.length };
}

function dist2D(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }

function circularityTest(pts, centroid) {
  if (pts.length < 6) return { isCircular: false, circleRadius: 0 };
  const dists = pts.map(p => dist2D(p, centroid));
  const avgR = dists.reduce((a, b) => a + b, 0) / dists.length;
  if (avgR < 1e-9) return { isCircular: false, circleRadius: 0 };
  const maxDev = Math.max(...dists.map(d => Math.abs(d - avgR)));
  return { isCircular: maxDev / avgR < 0.08, circleRadius: avgR };
}

function sliceMesh(geo, axis, value) {
  const posAttr = geo.getAttribute('position');
  const idxAttr = geo.getIndex();
  if (!posAttr) return { contours: [], totalArea: 0, beta0: 0, beta1: 0, eulerChar: 0, value };

  const numTri = idxAttr ? idxAttr.count / 3 : posAttr.count / 3;
  const axisIdx = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;
  const uIdx = axisIdx === 0 ? 1 : 0;
  const vIdx = axisIdx === 2 ? 1 : 2;
  const segments = [];

  for (let t = 0; t < numTri; t++) {
    const i0 = idxAttr ? idxAttr.getX(t * 3) : t * 3;
    const i1 = idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2;
    const d0 = getComp(posAttr, i0, axisIdx) - value;
    const d1 = getComp(posAttr, i1, axisIdx) - value;
    const d2 = getComp(posAttr, i2, axisIdx) - value;
    const verts = [
      { d: d0, u: getComp(posAttr, i0, uIdx), v: getComp(posAttr, i0, vIdx) },
      { d: d1, u: getComp(posAttr, i1, uIdx), v: getComp(posAttr, i1, vIdx) },
      { d: d2, u: getComp(posAttr, i2, uIdx), v: getComp(posAttr, i2, vIdx) },
    ];
    const pts = [];
    for (let e = 0; e < 3; e++) {
      const a = verts[e], b = verts[(e + 1) % 3];
      if ((a.d > 0) !== (b.d > 0)) {
        const tt = a.d / (a.d - b.d);
        pts.push({ x: a.u + tt * (b.u - a.u), y: a.v + tt * (b.v - a.v) });
      } else if (Math.abs(a.d) < 1e-12) {
        pts.push({ x: a.u, y: a.v });
      }
    }
    if (pts.length >= 2) segments.push([pts[0], pts[1]]);
  }

  if (segments.length === 0) return { contours: [], totalArea: 0, beta0: 0, beta1: 0, eulerChar: 0, value };

  // Chain into contours
  const EPS = 1e-6;
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
        if (!used.has(nb.idx)) { used.add(nb.idx); chain.push(nb.other); currentKey = nb.key; found = true; break; }
      }
      if (!found) break;
    }
    if (chain.length >= 3) {
      const area = shoelaceArea(chain);
      const centroid = centroidOf(chain);
      const circ = circularityTest(chain, centroid);
      contours.push({ points: chain, signedArea: area, area: Math.abs(area), centroid, isCircular: circ.isCircular, circleRadius: circ.circleRadius, isOuter: area > 0 });
    }
  }

  // Net area: sum of signed areas. Outer = positive, holes = negative.
  // BUT: axis mapping can flip winding. Use absolute net area.
  const netSignedArea = contours.reduce((s, c) => s + c.signedArea, 0);
  // If net is negative, the axis mapping flipped the winding — re-classify
  const flip = netSignedArea < 0;
  for (const c of contours) {
    c.isOuter = flip ? c.signedArea < 0 : c.signedArea > 0;
  }
  const outerContours = contours.filter(c => c.isOuter);
  const holeContours = contours.filter(c => !c.isOuter);
  const beta0 = outerContours.length;
  const beta1 = holeContours.length;
  const totalArea = Math.abs(netSignedArea);

  return { contours, totalArea, beta0, beta1, eulerChar: beta0 - beta1, value };
}

// ═══════════════════════════════════════════════════════════════
// CT-Scan + Feature Extraction (same algorithm as cross-section.ts)
// ═══════════════════════════════════════════════════════════════

function ctScanAxis(geo, axis, numSlices) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const axisIdx = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;
  const keys = ['x', 'y', 'z'];
  const lo = bb.min[keys[axisIdx]];
  const hi = bb.max[keys[axisIdx]];
  const range = hi - lo;
  const EPS = range * 0.005;
  const slices = [];

  for (let i = 0; i < numSlices; i++) {
    const t = (i + 0.5) / numSlices;
    const val = lo + EPS + t * (range - 2 * EPS);
    slices.push(sliceMesh(geo, axis, val));
  }

  // Bands
  const bands = [];
  let bandStart = 0;
  for (let i = 1; i <= numSlices; i++) {
    const prev = slices[i - 1];
    const curr = i < numSlices ? slices[i] : null;
    const sameTopology = curr &&
      curr.beta0 === prev.beta0 && curr.beta1 === prev.beta1 &&
      (prev.totalArea < 1e-10 || Math.abs(curr.totalArea / prev.totalArea - 1) < 0.10);
    if (!sameTopology || i === numSlices) {
      const rep = slices[Math.floor((bandStart + i - 1) / 2)];
      const outers = rep.contours.filter(c => c.signedArea > 0);
      const holes = rep.contours.filter(c => c.signedArea < 0);
      let featureType = 'extrusion';
      if (outers.length === 1 && outers[0].isCircular && holes.length === 0) featureType = 'revolution';
      bands.push({ axis, zStart: slices[bandStart].value, zEnd: slices[i - 1].value, slice: rep, featureType, outerContours: outers, holeContours: holes });
      bandStart = i;
    }
  }
  return { axis, range: [lo, hi], slices, bands };
}

function contourCenterTo3D(c2d, axis, axisVal) {
  switch (axis) {
    case 'X': return [axisVal, c2d.x, c2d.y];
    case 'Y': return [c2d.x, axisVal, c2d.y];
    case 'Z': return [c2d.x, c2d.y, axisVal];
  }
}

function deduplicateFeatures(features) {
  if (features.length <= 1) return features;
  let maxDim = 1;
  for (const f of features) {
    maxDim = Math.max(maxDim, Math.abs(f.center[0]), Math.abs(f.center[1]), Math.abs(f.center[2]), f.height, f.radius ?? 0);
  }
  const mergeDist = maxDim * 0.05;

  // Phase 1: Same-axis merge
  const byAxisType = new Map();
  for (const f of features) {
    const key = `${f.axis}:${f.type}`;
    if (!byAxisType.has(key)) byAxisType.set(key, []);
    byAxisType.get(key).push(f);
  }
  const phase1 = [];
  for (const [, group] of byAxisType) {
    const sorted = [...group].sort((a, b) => {
      const ai = a.axis === 'X' ? 0 : a.axis === 'Y' ? 1 : 2;
      return a.center[ai] - b.center[ai];
    });
    let i = 0;
    while (i < sorted.length) {
      let merged = { ...sorted[i] };
      let j = i + 1;
      while (j < sorted.length) {
        const next = sorted[j];
        const dx = merged.center[0] - next.center[0]; const dy = merged.center[1] - next.center[1]; const dz = merged.center[2] - next.center[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const rSimilar = merged.radius && next.radius ? Math.abs(merged.radius - next.radius) / Math.max(merged.radius, next.radius) < 0.20 : true;
        if (dist < mergeDist * 2 && rSimilar) {
          const axi = merged.axis === 'X' ? 0 : merged.axis === 'Y' ? 1 : 2;
          const lo = Math.min(merged.center[axi] - merged.height / 2, next.center[axi] - next.height / 2);
          const hi = Math.max(merged.center[axi] + merged.height / 2, next.center[axi] + next.height / 2);
          const newCenter = [...merged.center];
          newCenter[axi] = (lo + hi) / 2;
          merged = { ...merged, center: newCenter, height: hi - lo, confidence: Math.min(1.0, merged.confidence + 0.05),
            profile: merged.profile.length >= next.profile.length ? merged.profile : next.profile,
            holes: merged.holes.length >= next.holes.length ? merged.holes : next.holes };
          j++;
        } else { break; }
      }
      phase1.push(merged);
      i = j;
    }
  }

  // Phase 2: Cross-axis merge
  const sorted2 = [...phase1].sort((a, b) => b.confidence - a.confidence);
  const kept = []; const usedSet = new Set();
  for (let i = 0; i < sorted2.length; i++) {
    if (usedSet.has(i)) continue;
    const fi = sorted2[i];
    for (let j = i + 1; j < sorted2.length; j++) {
      if (usedSet.has(j)) continue;
      const fj = sorted2[j];
      const dx = fi.center[0] - fj.center[0]; const dy = fi.center[1] - fj.center[1]; const dz = fi.center[2] - fj.center[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const compatible = fi.type === fj.type || (fi.type === 'hole' && fj.type === 'pocket') || (fi.type === 'pocket' && fj.type === 'hole') || (fi.type === 'revolution' && fj.type === 'hole') || (fi.type === 'hole' && fj.type === 'revolution');
      const rSimilar = fi.radius && fj.radius ? Math.abs(fi.radius - fj.radius) / Math.max(fi.radius, fj.radius) < 0.20 : true;
      if (compatible && dist < mergeDist && rSimilar) { usedSet.add(j); fi.confidence = Math.min(1.0, fi.confidence + 0.1); }
    }
    kept.push(fi);
  }
  return kept;
}

/**
 * IMPROVED DECOMPOSITION: Envelope + Subtractive Features
 * =========================================================
 * Instead of treating each band as a feature, we:
 *
 * 1. ENVELOPE: Find the max-area outer contour → extrude across full range
 *    This is the MAIN BODY and covers ~100% of slices.
 *
 * 2. PROFILE STEPS: Where the outer contour changes, that's a step/shelf.
 *    We find continuous ranges where the profile is smaller → subtract.
 *
 * 3. HOLES: Through-holes and blind holes are subtracted from the body.
 *    A hole is a contour that appears as β₁>0 across a range of slices.
 *
 * This produces: body MINUS steps MINUS holes ≈ original part
 */
function decomposeBySlicing(geo, numSlices = 100) {
  const t0 = performance.now();
  const scanX = ctScanAxis(geo, 'X', numSlices);
  const scanY = ctScanAxis(geo, 'Y', numSlices);
  const scanZ = ctScanAxis(geo, 'Z', numSlices);
  const features = [];
  const scans = { X: scanX, Y: scanY, Z: scanZ };

  for (const axis of ['Z', 'Y', 'X']) {
    const scan = scans[axis];
    if (scan.slices.length === 0) continue;
    const axIdx = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;

    // ── 1. Find the envelope (max-area slice) ──
    let maxAreaSlice = null, maxArea = 0, maxAreaIdx = 0;
    for (let i = 0; i < scan.slices.length; i++) {
      if (scan.slices[i].totalArea > maxArea) {
        maxArea = scan.slices[i].totalArea;
        maxAreaSlice = scan.slices[i];
        maxAreaIdx = i;
      }
    }
    if (!maxAreaSlice || maxArea < 1e-6) continue;

    // Find the full range where material exists (totalArea > 0)
    let rangeStart = 0, rangeEnd = scan.slices.length - 1;
    while (rangeStart < scan.slices.length && scan.slices[rangeStart].totalArea < 1e-6) rangeStart++;
    while (rangeEnd >= 0 && scan.slices[rangeEnd].totalArea < 1e-6) rangeEnd--;
    if (rangeStart > rangeEnd) continue;

    const zLo = scan.slices[rangeStart].value;
    const zHi = scan.slices[rangeEnd].value;
    const fullHeight = zHi - zLo;
    if (fullHeight < 1e-6) continue;

    // The envelope outer contour is the one from the max-area slice
    const envelopeOuters = maxAreaSlice.contours.filter(c => c.isOuter);
    if (envelopeOuters.length === 0) continue;

    // Use the LARGEST outer contour as the main body profile
    const mainProfile = envelopeOuters.sort((a, b) => b.area - a.area)[0];
    const midZ = (zLo + zHi) / 2;
    const bodyCenter = contourCenterTo3D(mainProfile.centroid, axis, midZ);

    features.push({
      type: mainProfile.isCircular ? 'revolution' : 'extrusion',
      axis,
      center: bodyCenter,
      height: fullHeight,
      profile: mainProfile.points,
      holes: [],
      radius: mainProfile.isCircular ? mainProfile.circleRadius : undefined,
      confidence: 0.95,
      label: `${axis}-Cuerpo principal ${mainProfile.area.toFixed(0)}u² h=${fullHeight.toFixed(1)}`,
      profileArea: mainProfile.area,
      holeArea: 0,
    });

    // ── 2. Detect holes that persist across multiple slices ──
    // For each slice, collect hole contours, then track them across slices.
    // A "tracked hole" is a hole that appears in consecutive slices at ~same position.
    const holeTracker = []; // { centroid, radius, startIdx, endIdx, isCircular, profile, area }

    for (let si = rangeStart; si <= rangeEnd; si++) {
      const slice = scan.slices[si];
      const holes = slice.contours.filter(c => !c.isOuter && c.area > mainProfile.area * 0.001);

      for (const hole of holes) {
        // Try to attach to an existing tracked hole
        let attached = false;
        for (const th of holeTracker) {
          if (th.endIdx >= si - 2) { // Allow 1-slice gap
            const dx = hole.centroid.x - th.centroid.x;
            const dy = hole.centroid.y - th.centroid.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const rSim = th.radius > 0 && hole.circleRadius > 0
              ? Math.abs(th.radius - hole.circleRadius) / Math.max(th.radius, hole.circleRadius) < 0.25
              : true;
            const areaSim = Math.abs(th.area - hole.area) / Math.max(th.area, hole.area) < 0.30;
            if (dist < Math.max(th.radius || 5, 5) * 1.5 && (rSim || areaSim)) {
              th.endIdx = si;
              if (hole.area > th.area) { th.profile = hole.points; th.area = hole.area; }
              if (hole.isCircular && hole.circleRadius > th.radius) { th.radius = hole.circleRadius; th.isCircular = true; }
              attached = true;
              break;
            }
          }
        }
        if (!attached) {
          holeTracker.push({
            centroid: { ...hole.centroid },
            radius: hole.isCircular ? hole.circleRadius : Math.sqrt(hole.area / Math.PI),
            startIdx: si,
            endIdx: si,
            isCircular: hole.isCircular,
            profile: hole.points,
            area: hole.area,
          });
        }
      }
    }

    // Convert tracked holes to features (only holes spanning > 1 slice)
    for (const th of holeTracker) {
      const sliceSpan = th.endIdx - th.startIdx;
      if (sliceSpan < 1) continue; // Skip single-slice noise
      const hZlo = scan.slices[th.startIdx].value;
      const hZhi = scan.slices[th.endIdx].value;
      const hHeight = hZhi - hZlo;
      if (hHeight < 1e-6) continue;
      const hMidZ = (hZlo + hZhi) / 2;
      const hCenter = contourCenterTo3D(th.centroid, axis, hMidZ);

      features.push({
        type: th.isCircular ? 'hole' : 'pocket',
        axis,
        center: hCenter,
        height: hHeight,
        profile: th.profile,
        holes: [],
        radius: th.isCircular ? th.radius : undefined,
        confidence: Math.min(0.95, 0.60 + sliceSpan * 0.02),
        label: th.isCircular
          ? `Agujero ⌀${(th.radius * 2).toFixed(2)} h=${hHeight.toFixed(1)}`
          : `Pocket ${th.area.toFixed(0)}u² h=${hHeight.toFixed(1)}`,
        profileArea: th.area,
        holeArea: 0,
      });
    }

    // ── 3. Detect profile steps (outer contour shrinks in sections) ──
    // Compare each slice's outer area to the envelope area.
    // Where it's significantly smaller → that range is a "step" subtraction.
    let stepStart = -1;
    let stepMinArea = Infinity;
    let stepProfile = null;

    for (let si = rangeStart; si <= rangeEnd + 1; si++) {
      const sliceArea = si <= rangeEnd ? scan.slices[si].totalArea : mainProfile.area;
      const isStep = sliceArea < mainProfile.area * 0.85 && sliceArea > 1e-6;

      if (isStep && stepStart < 0) {
        stepStart = si;
        stepMinArea = sliceArea;
        stepProfile = scan.slices[si].contours.filter(c => c.isOuter).sort((a, b) => b.area - a.area)[0];
      } else if (isStep) {
        if (sliceArea < stepMinArea) {
          stepMinArea = sliceArea;
          stepProfile = scan.slices[si].contours.filter(c => c.isOuter).sort((a, b) => b.area - a.area)[0];
        }
      } else if (stepStart >= 0) {
        // End of step — record the area reduction as a subtraction feature
        const sZlo = scan.slices[stepStart].value;
        const sZhi = scan.slices[Math.min(si, rangeEnd)].value;
        const sHeight = sZhi - sZlo;
        if (sHeight > fullHeight * 0.01 && stepProfile) {
          const areaDiff = mainProfile.area - stepMinArea;
          const sMidZ = (sZlo + sZhi) / 2;
          const sCenter = contourCenterTo3D(stepProfile.centroid, axis, sMidZ);
          // The "step" reduces the profile — model it as a pocket
          features.push({
            type: 'pocket',
            axis,
            center: sCenter,
            height: sHeight,
            profile: stepProfile.points, // Approximate
            holes: [],
            radius: undefined,
            confidence: 0.60,
            label: `Step -${areaDiff.toFixed(0)}u² h=${sHeight.toFixed(1)}`,
            profileArea: areaDiff,
            holeArea: 0,
          });
        }
        stepStart = -1;
        stepMinArea = Infinity;
        stepProfile = null;
      }
    }
  }

  const deduped = deduplicateFeatures(features);
  return { features: deduped, rawCount: features.length, scans, time: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════
// ROUND-TRIP VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Evaluate what area a single feature would produce at a given
 * slice value on a given axis.
 *
 * A feature covers a range along its own axis:
 *   [center[axIdx] - height/2, center[axIdx] + height/2]
 *
 * If we're slicing along the SAME axis and the slice value falls
 * within that range, the feature contributes its profile area.
 *
 * If we're slicing along a DIFFERENT axis, the feature contributes
 * a cross-sectional area that depends on the shape — for now we
 * approximate using the feature's bounding box.
 */
function featureAreaAtSlice(feature, sliceAxis, sliceVal) {
  const axIdx = feature.axis === 'X' ? 0 : feature.axis === 'Y' ? 1 : 2;
  const sliceAxIdx = sliceAxis === 'X' ? 0 : sliceAxis === 'Y' ? 1 : 2;

  if (feature.axis === sliceAxis) {
    // Same axis: check if slice falls within feature range
    const lo = feature.center[axIdx] - feature.height / 2;
    const hi = feature.center[axIdx] + feature.height / 2;
    if (sliceVal >= lo && sliceVal <= hi) {
      return feature.profileArea || feature.profile.reduce((s, p, i) => {
        const next = feature.profile[(i + 1) % feature.profile.length];
        return s + (p.x * next.y - next.x * p.y);
      }, 0) / 2;
    }
    return 0;
  }

  // Different axis: approximate. A cylinder of radius R along axis A,
  // sliced along axis B, gives a rectangular cross-section if the slice
  // passes through it. For now, just return 0 (we only validate same-axis).
  return 0;
}

/**
 * Compute the "reconstructed area" at each slice height for a given axis,
 * using only the features extracted from that axis.
 */
function reconstructedAreas(features, axis, sliceValues) {
  const axisFeatures = features.filter(f => f.axis === axis);
  const positive = axisFeatures.filter(f => f.type === 'extrusion' || f.type === 'revolution' || f.type === 'boss');
  const negative = axisFeatures.filter(f => f.type === 'hole' || f.type === 'pocket');

  return sliceValues.map(val => {
    let area = 0;
    for (const f of positive) {
      area += featureAreaAtSlice(f, axis, val);
    }
    for (const f of negative) {
      area -= featureAreaAtSlice(f, axis, val);
    }
    return Math.max(0, area);
  });
}

/**
 * Full round-trip validation for one axis:
 *   - Original slice areas (from mesh)
 *   - Reconstructed slice areas (from features)
 *   - Comparison metrics
 */
function validateAxis(geo, features, axis, numSlices = 80) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const axIdx = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;
  const keys = ['x', 'y', 'z'];
  const lo = bb.min[keys[axIdx]];
  const hi = bb.max[keys[axIdx]];
  const range = hi - lo;
  const margin = range * 0.005;

  const sliceValues = [];
  for (let i = 0; i < numSlices; i++) {
    const t = (i + 0.5) / numSlices;
    sliceValues.push(lo + margin + t * (range - 2 * margin));
  }

  // Original areas
  const origAreas = sliceValues.map(val => {
    const result = sliceMesh(geo, axis, val);
    return result.totalArea;
  });

  // Reconstructed areas
  const recoAreas = reconstructedAreas(features, axis, sliceValues);

  // Metrics
  let totalOrigArea = 0, totalRecoArea = 0;
  let sumAbsError = 0, sumRelError = 0, maxRelError = 0;
  let coveredSlices = 0, totalNonEmpty = 0;
  const perSlice = [];

  for (let i = 0; i < numSlices; i++) {
    const orig = origAreas[i];
    const reco = recoAreas[i];
    totalOrigArea += orig;
    totalRecoArea += reco;

    if (orig > 1e-6) {
      totalNonEmpty++;
      const relErr = Math.abs(orig - reco) / orig;
      sumAbsError += Math.abs(orig - reco);
      sumRelError += relErr;
      maxRelError = Math.max(maxRelError, relErr);
      if (reco > orig * 0.01) coveredSlices++;
    }

    perSlice.push({ z: sliceValues[i], orig, reco, ratio: orig > 1e-6 ? reco / orig : (reco > 0 ? Infinity : 1) });
  }

  const avgRelError = totalNonEmpty > 0 ? sumRelError / totalNonEmpty : 0;
  const coverage = totalNonEmpty > 0 ? coveredSlices / totalNonEmpty : 1;
  const volumeRatio = totalOrigArea > 0 ? totalRecoArea / totalOrigArea : 0;

  return {
    axis,
    numSlices,
    totalNonEmpty,
    coveredSlices,
    coverage,
    volumeRatio,
    avgRelError,
    maxRelError,
    totalOrigArea,
    totalRecoArea,
    perSlice,
  };
}

// ═══════════════════════════════════════════════════════════════
// STEP Loader
// ═══════════════════════════════════════════════════════════════

async function loadStepFile(filePath) {
  const occt = await occtFactory();
  const fileData = fs.readFileSync(filePath);
  const result = occt.ReadStepFile(new Uint8Array(fileData), null);
  if (!result.success) throw new Error(`Failed to parse STEP: ${filePath}`);

  const allPos = [], allIdx = [];
  let vOff = 0;
  for (let mi = 0; mi < result.meshes.length; mi++) {
    const m = result.meshes[mi];
    const pos = m.attributes.position.array;
    for (let i = 0; i < pos.length; i++) allPos.push(pos[i]);
    if (m.index) {
      for (let i = 0; i < m.index.array.length; i++) allIdx.push(m.index.array[i] + vOff);
    } else {
      for (let i = 0; i < pos.length / 3; i++) allIdx.push(i + vOff);
    }
    vOff += pos.length / 3;
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(allPos), 3));
  geo.setIndex(new BufferAttribute(new Uint32Array(allIdx), 1));
  geo.computeBoundingBox();
  return geo;
}

// ═══════════════════════════════════════════════════════════════
// Visual: ASCII area comparison chart
// ═══════════════════════════════════════════════════════════════

function printAreaChart(validation, maxWidth = 60) {
  const { perSlice, axis } = validation;
  const maxArea = Math.max(...perSlice.map(s => Math.max(s.orig, s.reco)), 1);

  console.log(`\n  📊 Area comparison — Eje ${axis}:`);
  console.log(`  ${'Z'.padStart(8)}  ${'Original'.padEnd(maxWidth / 2)}  Reconstruido`);
  console.log(`  ${'─'.repeat(8)}  ${'─'.repeat(maxWidth / 2)}  ${'─'.repeat(maxWidth / 2)}`);

  // Sample every N slices to fit in terminal
  const step = Math.max(1, Math.floor(perSlice.length / 30));
  for (let i = 0; i < perSlice.length; i += step) {
    const s = perSlice[i];
    const barsOrig = Math.max(0, Math.round((s.orig / maxArea) * (maxWidth / 2 - 1)));
    const barsReco = Math.max(0, Math.round((s.reco / maxArea) * (maxWidth / 2 - 1)));

    const origBar = '█'.repeat(barsOrig) + ' '.repeat(maxWidth / 2 - 1 - barsOrig);
    const recoBar = '▓'.repeat(barsReco) + ' '.repeat(maxWidth / 2 - 1 - barsReco);
    const marker = s.orig > 1e-6 && Math.abs(s.ratio - 1) < 0.15 ? ' ✓' :
                   s.orig > 1e-6 && s.reco < 1e-6 ? ' ✗' :
                   s.orig > 1e-6 ? ' ~' : '';

    console.log(`  ${s.z.toFixed(2).padStart(8)}  ${origBar}  ${recoBar}${marker}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const modelsDir = path.join(__dirname, '..', 'models', 'step');

  let files;
  if (args.length > 0) {
    files = args.map(a => path.resolve(a));
  } else {
    const nistDir = path.join(modelsDir, 'NIST-PMI-STEP-Files', 'AP203 geometry only');
    files = fs.readdirSync(nistDir)
      .filter(f => f.endsWith('.stp') && f.includes('nist_ctc'))
      .sort()
      .map(f => path.join(nistDir, f));
  }

  console.log(`\n🔬 CT-Scan Round-Trip Validation — ${files.length} archivos\n`);

  const allResults = [];

  for (const file of files) {
    const name = path.basename(file, path.extname(file));
    console.log('═'.repeat(70));
    console.log(`🩻 Validando: ${name}`);
    console.log('═'.repeat(70));

    try {
      const geo = await loadStepFile(file);
      const bb = geo.boundingBox;
      const sx = bb.max.x - bb.min.x, sy = bb.max.y - bb.min.y, sz = bb.max.z - bb.min.z;
      console.log(`  Tamaño: ${sx.toFixed(1)} × ${sy.toFixed(1)} × ${sz.toFixed(1)}`);

      // Decompose
      const decomp = decomposeBySlicing(geo, 100);
      console.log(`  Features: ${decomp.features.length} (raw: ${decomp.rawCount}) en ${decomp.time.toFixed(0)}ms`);

      // Validate each axis
      const results = {};
      for (const axis of ['X', 'Y', 'Z']) {
        const axisFeatures = decomp.features.filter(f => f.axis === axis);
        const posFeats = axisFeatures.filter(f => f.type === 'extrusion' || f.type === 'revolution' || f.type === 'boss');
        const negFeats = axisFeatures.filter(f => f.type === 'hole' || f.type === 'pocket');
        console.log(`\n  Eje ${axis}: ${posFeats.length} positivos, ${negFeats.length} negativos (${axisFeatures.length} total)`);

        const v = validateAxis(geo, decomp.features, axis, 60);
        results[axis] = v;

        console.log(`    Coverage:     ${(v.coverage * 100).toFixed(1)}% (${v.coveredSlices}/${v.totalNonEmpty} slices cubiertas)`);
        console.log(`    Vol ratio:    ${(v.volumeRatio * 100).toFixed(1)}% (reconstruido/original)`);
        console.log(`    Avg rel err:  ${(v.avgRelError * 100).toFixed(1)}%`);
        console.log(`    Max rel err:  ${(v.maxRelError * 100).toFixed(1)}%`);
        console.log(`    Area orig:    ${v.totalOrigArea.toFixed(0)}`);
        console.log(`    Area reco:    ${v.totalRecoArea.toFixed(0)}`);

        // Print chart for best axis
        printAreaChart(v, 50);

        // Find the worst slices
        const worst = v.perSlice
          .filter(s => s.orig > 1e-6)
          .sort((a, b) => Math.abs(a.ratio - 1) - Math.abs(b.ratio - 1))
          .reverse()
          .slice(0, 5);
        if (worst.length > 0) {
          console.log(`\n    ⚠️  Peores cortes (mayor error):`);
          for (const w of worst) {
            console.log(`       z=${w.z.toFixed(2)}  orig=${w.orig.toFixed(1)}  reco=${w.reco.toFixed(1)}  ratio=${w.ratio.toFixed(3)}`);
          }
        }
      }

      // Select best axis (same logic as profile-to-sdf.ts)
      let bestAxis = 'Z', bestScore = -Infinity;
      for (const axis of ['Z', 'Y', 'X']) {
        const scan = decomp.scans[axis];
        const nonEmpty = scan.bands.filter(b => b.outerContours.length > 0);
        const totalArea = scan.slices.reduce((s, sl) => s + sl.totalArea, 0);
        const score = totalArea / Math.max(1, nonEmpty.length);
        if (score > bestScore) { bestScore = score; bestAxis = axis; }
      }

      console.log(`\n  🏆 Mejor eje: ${bestAxis} (vol ratio: ${(results[bestAxis].volumeRatio * 100).toFixed(1)}%, coverage: ${(results[bestAxis].coverage * 100).toFixed(1)}%)`);

      // DIAGNOSIS: What's missing?
      console.log(`\n  🔍 DIAGNÓSTICO:`);
      const bestV = results[bestAxis];
      if (bestV.volumeRatio < 0.5) {
        console.log(`    ❌ La reconstrucción cubre menos del 50% del volumen original`);
        console.log(`    → Los features NO son suficientes para recrear la pieza`);
      } else if (bestV.volumeRatio < 0.8) {
        console.log(`    ⚠️  La reconstrucción cubre ${(bestV.volumeRatio * 100).toFixed(0)}% — falta ~${((1 - bestV.volumeRatio) * 100).toFixed(0)}%`);
      } else if (bestV.volumeRatio < 0.95) {
        console.log(`    ✅ Buena cobertura (${(bestV.volumeRatio * 100).toFixed(0)}%), pero faltan detalles menores`);
      } else if (bestV.volumeRatio <= 1.05) {
        console.log(`    ✅✅ Excelente: ${(bestV.volumeRatio * 100).toFixed(1)}% cobertura — reconstrucción prácticamente perfecta`);
      } else {
        console.log(`    ⚠️  Sobre-estimación: ${(bestV.volumeRatio * 100).toFixed(0)}% — hay features superpuestos`);
      }

      // Count uncovered slices
      const uncovered = bestV.perSlice.filter(s => s.orig > 1e-6 && s.reco < s.orig * 0.01);
      if (uncovered.length > 0) {
        console.log(`    ${uncovered.length} cortes sin cobertura (de ${bestV.totalNonEmpty}):`);
        for (const u of uncovered.slice(0, 5)) {
          console.log(`       z=${u.z.toFixed(2)} area_orig=${u.orig.toFixed(1)} — no está cubierto por ningún feature`);
        }
      }

      allResults.push({ name, results, decomp, bestAxis, success: true });
    } catch (err) {
      console.error(`  ❌ Error: ${err.message}`);
      allResults.push({ name, success: false, error: err.message });
    }
    console.log('');
  }

  // ═══ FINAL SUMMARY TABLE ═══
  console.log('\n' + '═'.repeat(80));
  console.log('📊 RESUMEN DE VALIDACIÓN ROUND-TRIP');
  console.log('═'.repeat(80));
  console.log(`${'Archivo'.padEnd(30)} ${'Eje'.padStart(3)} ${'Vol%'.padStart(6)} ${'Cover%'.padStart(7)} ${'AvgErr'.padStart(7)} ${'MaxErr'.padStart(7)} ${'Features'.padStart(8)} ${'Diagnóstico'.padStart(15)}`);
  console.log('─'.repeat(80));

  for (const r of allResults) {
    if (r.success) {
      const v = r.results[r.bestAxis];
      const diag = v.volumeRatio > 0.95 && v.volumeRatio < 1.05 ? '✅ EXCELENTE' :
                   v.volumeRatio > 0.80 ? '⚠️  BUENO' :
                   v.volumeRatio > 0.50 ? '⚠️  PARCIAL' : '❌ FALLA';
      console.log(`${r.name.padEnd(30)} ${r.bestAxis.padStart(3)} ${(v.volumeRatio * 100).toFixed(1).padStart(6)} ${(v.coverage * 100).toFixed(1).padStart(7)} ${(v.avgRelError * 100).toFixed(1).padStart(7)} ${(v.maxRelError * 100).toFixed(1).padStart(7)} ${String(r.decomp.features.length).padStart(8)} ${diag}`);
    } else {
      console.log(`${r.name.padEnd(30)} ERROR: ${r.error}`);
    }
  }
  console.log('═'.repeat(80));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
