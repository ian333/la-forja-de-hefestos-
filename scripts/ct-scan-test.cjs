/**
 * CT-Scan Test Script — Runs cross-section analysis on STEP files from Node.js
 * Usage: node scripts/ct-scan-test.cjs [file1.stp] [file2.stp] ...
 *        node scripts/ct-scan-test.cjs  (runs all nist_ctc files)
 */

const fs = require('fs');
const path = require('path');
const occtFactory = require('occt-import-js');

// ═══════════════════════════════════════════════════════════════
// Minimal Three.js BufferGeometry polyfill for Node.js
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
  constructor() {
    this._attributes = {};
    this._index = null;
    this.boundingBox = null;
  }
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
    this.boundingBox = {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    };
  }
  dispose() {}
}

// Make these available globally so our cross-section code finds them
global.THREE = { BufferAttribute, BufferGeometry };

// ═══════════════════════════════════════════════════════════════
// Port key functions from cross-section.ts (pure TypeScript → JS)
// ═══════════════════════════════════════════════════════════════

function getComp(attr, idx, comp) {
  switch (comp) {
    case 0: return attr.getX(idx);
    case 1: return attr.getY(idx);
    case 2: return attr.getZ(idx);
    default: return 0;
  }
}

function dist2D(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
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

function bboxOf(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

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
  if (!posAttr) return { contours: [], totalArea: 0, beta0: 0, beta1: 0, eulerChar: 0 };

  const numTri = idxAttr ? idxAttr.count / 3 : posAttr.count / 3;
  const axisIdx = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;

  // Map 3D axis to 2D: axis removed, remaining two become (u, v)
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
        const t2 = a.d / (a.d - b.d);
        pts.push({ x: a.u + t2 * (b.u - a.u), y: a.v + t2 * (b.v - a.v) });
      } else if (Math.abs(a.d) < 1e-12) {
        pts.push({ x: a.u, y: a.v });
      }
    }

    if (pts.length >= 2) {
      segments.push([pts[0], pts[1]]);
    }
  }

  if (segments.length === 0) {
    return { contours: [], totalArea: 0, beta0: 0, beta1: 0, eulerChar: 0 };
  }

  // Chain segments into closed contours
  const EPS = 1e-6;
  const used = new Set();
  const contours = [];

  function findKey(p) {
    return `${(p.x * 1e4) | 0},${(p.y * 1e4) | 0}`;
  }

  // Build adjacency map
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

    if (chain.length >= 3) {
      const area = shoelaceArea(chain);
      const centroid = centroidOf(chain);
      const bbox = bboxOf(chain);
      const circ = circularityTest(chain, centroid);
      const perimeter = chain.reduce((s, p, i) =>
        s + dist2D(p, chain[(i + 1) % chain.length]), 0);

      contours.push({
        points: chain,
        signedArea: area,
        area: Math.abs(area),
        centroid,
        bbox,
        perimeter,
        isCircular: circ.isCircular,
        circleRadius: circ.circleRadius,
      });
    }
  }

  const outerContours = contours.filter(c => c.signedArea > 0);
  const holeContours = contours.filter(c => c.signedArea < 0);
  const beta0 = outerContours.length;
  const beta1 = holeContours.length;
  const totalArea = outerContours.reduce((s, c) => s + c.area, 0);

  return {
    contours,
    totalArea,
    beta0,
    beta1,
    eulerChar: beta0 - beta1,
  };
}

function ctScanAxis(geo, axis, numSlices) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const axisIdx = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;
  const keys = ['x', 'y', 'z'];
  const lo = bb.min[keys[axisIdx]];
  const hi = bb.max[keys[axisIdx]];
  const range = hi - lo;

  const EPS = range * 0.001;
  const slices = [];

  for (let i = 0; i < numSlices; i++) {
    const t = (i + 0.5) / numSlices;
    const val = lo + EPS + t * (range - 2 * EPS);
    const result = sliceMesh(geo, axis, val);
    slices.push({ value: val, ...result });
  }

  // Detect topology bands
  const bands = [];
  let bandStart = 0;
  for (let i = 1; i <= numSlices; i++) {
    const prev = slices[i - 1];
    const curr = i < numSlices ? slices[i] : null;

    const sameTopology = curr &&
      curr.beta0 === prev.beta0 &&
      curr.beta1 === prev.beta1 &&
      (prev.totalArea < 1e-12 || Math.abs(curr.totalArea / prev.totalArea - 1) < 0.10);

    if (!sameTopology || i === numSlices) {
      const representative = slices[Math.floor((bandStart + i - 1) / 2)];

      const outerContours = representative.contours.filter(c => c.signedArea > 0);
      const holeContours = representative.contours.filter(c => c.signedArea < 0);

      let featureType = 'unknown';
      if (outerContours.length === 1 && outerContours[0].isCircular && holeContours.length === 0)
        featureType = 'revolution';
      else if (outerContours.length > 0 && holeContours.length === 0)
        featureType = 'extrusion';
      else if (holeContours.length > 0)
        featureType = 'extrusion+holes';

      bands.push({
        zStart: slices[bandStart].value,
        zEnd: slices[i - 1].value,
        sliceCount: i - bandStart,
        slice: representative,
        featureType,
        outerContours,
        holeContours,
      });
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
    maxDim = Math.max(maxDim,
      Math.abs(f.center[0]), Math.abs(f.center[1]), Math.abs(f.center[2]),
      f.height, f.radius ?? 0);
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
        const dx = merged.center[0] - next.center[0];
        const dy = merged.center[1] - next.center[1];
        const dz = merged.center[2] - next.center[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const rSimilar = merged.radius && next.radius
          ? Math.abs(merged.radius - next.radius) / Math.max(merged.radius, next.radius) < 0.20
          : true;

        if (dist < mergeDist * 2 && rSimilar) {
          const axi = merged.axis === 'X' ? 0 : merged.axis === 'Y' ? 1 : 2;
          const lo = Math.min(
            merged.center[axi] - merged.height / 2,
            next.center[axi] - next.height / 2,
          );
          const hi = Math.max(
            merged.center[axi] + merged.height / 2,
            next.center[axi] + next.height / 2,
          );
          const newCenter = [...merged.center];
          newCenter[axi] = (lo + hi) / 2;
          merged = {
            ...merged,
            center: newCenter,
            height: hi - lo,
            confidence: Math.min(1.0, merged.confidence + 0.05),
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

  // Phase 2: Cross-axis merge
  const sorted2 = [...phase1].sort((a, b) => b.confidence - a.confidence);
  const kept = [];
  const used = new Set();

  for (let i = 0; i < sorted2.length; i++) {
    if (used.has(i)) continue;
    const fi = sorted2[i];

    for (let j = i + 1; j < sorted2.length; j++) {
      if (used.has(j)) continue;
      const fj = sorted2[j];

      const dx = fi.center[0] - fj.center[0];
      const dy = fi.center[1] - fj.center[1];
      const dz = fi.center[2] - fj.center[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

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

function decomposeBySlicing(geo, numSlices = 100) {
  const t0 = performance.now();
  const scanX = ctScanAxis(geo, 'X', numSlices);
  const scanY = ctScanAxis(geo, 'Y', numSlices);
  const scanZ = ctScanAxis(geo, 'Z', numSlices);

  const features = [];
  const scans = [scanZ, scanY, scanX];

  for (const scan of scans) {
    for (const band of scan.bands) {
      if (band.outerContours.length === 0) continue;
      const height = band.zEnd - band.zStart;
      if (height < 1e-6) continue;
      const midZ = (band.zStart + band.zEnd) / 2;

      for (const outer of band.outerContours) {
        const center3D = contourCenterTo3D(outer.centroid, scan.axis, midZ);
        features.push({
          type: outer.isCircular ? 'revolution' : 'extrusion',
          axis: scan.axis,
          center: center3D,
          height,
          profile: outer.points,
          holes: band.holeContours.map(h => h.points),
          radius: outer.isCircular ? outer.circleRadius : undefined,
          confidence: outer.isCircular ? 0.85 : 0.70,
          label: outer.isCircular
            ? `${scan.axis}-Cilindro r=${outer.circleRadius.toFixed(2)}`
            : `${scan.axis}-Extrusión ${outer.area.toFixed(2)}u²`,
        });
      }

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

  const deduped = deduplicateFeatures(features);
  const elapsed = performance.now() - t0;

  return {
    features: deduped,
    stats: {
      totalFeatures: deduped.length,
      extrusions: deduped.filter(f => f.type === 'extrusion').length,
      revolutions: deduped.filter(f => f.type === 'revolution').length,
      holes: deduped.filter(f => f.type === 'hole' || f.type === 'pocket').length,
      unknown: deduped.filter(f => f.type === 'unknown').length,
      rawBeforeDedup: features.length,
      processingTimeMs: elapsed,
    },
    scans: { X: scanX, Y: scanY, Z: scanZ },
  };
}

// ═══════════════════════════════════════════════════════════════
// STEP File Loader → BufferGeometry
// ═══════════════════════════════════════════════════════════════

async function loadStepFile(filePath) {
  const occt = await occtFactory();
  const fileData = fs.readFileSync(filePath);
  const buffer = new Uint8Array(fileData);
  const result = occt.ReadStepFile(buffer, null);

  if (!result.success) {
    throw new Error(`Failed to parse STEP file: ${filePath}`);
  }

  const meshes = [];
  for (let mi = 0; mi < result.meshes.length; mi++) {
    const m = result.meshes[mi];
    const positions = new Float32Array(m.attributes.position.array);
    const indices = m.index ? new Uint32Array(m.index.array) : null;

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    if (indices) {
      geo.setIndex(new BufferAttribute(indices, 1));
    }
    geo.computeBoundingBox();

    const triCount = indices ? indices.length / 3 : positions.length / 9;
    meshes.push({ name: m.name || `Mesh_${mi}`, geometry: geo, triCount });
  }

  return { meshes, meshCount: result.meshes.length };
}

// ═══════════════════════════════════════════════════════════════
// Analysis & Reporting
// ═══════════════════════════════════════════════════════════════

function analyzeFile(filePath, meshes) {
  const name = path.basename(filePath, path.extname(filePath));
  const isAssembly = meshes.length > 1;

  console.log('\n' + '═'.repeat(70));
  console.log(`🩻 CT-SCAN: ${name}`);
  console.log(`   Meshes: ${meshes.length}  |  Ensamble: ${isAssembly ? 'SÍ' : 'NO'}`);
  console.log('═'.repeat(70));

  // Per-component analysis (for assemblies)
  if (isAssembly) {
    console.log('\n📦 ANÁLISIS PER-COMPONENTE:');
    console.log('─'.repeat(60));

    for (const mesh of meshes) {
      const bb = mesh.geometry.boundingBox;
      const sx = bb.max.x - bb.min.x;
      const sy = bb.max.y - bb.min.y;
      const sz = bb.max.z - bb.min.z;

      const decomp = decomposeBySlicing(mesh.geometry, 60);

      console.log(`\n  [${mesh.name}]  △${mesh.triCount}  Size: ${sx.toFixed(1)}×${sy.toFixed(1)}×${sz.toFixed(1)}`);
      console.log(`    Antes dedup: ${decomp.stats.rawBeforeDedup}  →  Después: ${decomp.stats.totalFeatures}`);
      console.log(`    Ext: ${decomp.stats.extrusions}  Rev: ${decomp.stats.revolutions}  Holes: ${decomp.stats.holes}  Unk: ${decomp.stats.unknown}  (${decomp.stats.processingTimeMs.toFixed(0)}ms)`);

      // Band summary per axis
      for (const ax of ['X', 'Y', 'Z']) {
        const scan = decomp.scans[ax];
        const filled = scan.slices.filter(s => s.totalArea > 0).length;
        console.log(`    ${ax}: ${scan.bands.length} bandas, ${filled}/${scan.slices.length} cortes, rango [${scan.range[0].toFixed(2)}..${scan.range[1].toFixed(2)}]`);
      }

      // Top 10 features
      if (decomp.features.length > 0) {
        const top = decomp.features.slice(0, 10);
        for (const f of top) {
          const r = f.radius ? `r=${f.radius.toFixed(2)}` : '';
          console.log(`      ${f.type.padEnd(10)} ${f.axis} h=${f.height.toFixed(2).padStart(7)} ${r.padEnd(10)} c=(${f.center.map(v => v.toFixed(1)).join(',')}) ${(f.confidence * 100).toFixed(0)}% ${f.label}`);
        }
        if (decomp.features.length > 10)
          console.log(`      ... +${decomp.features.length - 10} más`);
      }
    }
  }

  // Merged analysis
  console.log('\n🔬 ANÁLISIS GLOBAL (merged):');
  console.log('─'.repeat(60));

  // Merge all meshes into one geometry
  const allPositions = [];
  const allIndices = [];
  let vertexOffset = 0;

  for (const mesh of meshes) {
    const pos = mesh.geometry.getAttribute('position');
    const idx = mesh.geometry.getIndex();

    for (let i = 0; i < pos.count; i++) {
      allPositions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    }
    if (idx) {
      for (let i = 0; i < idx.count; i++) allIndices.push(idx.array[i] + vertexOffset);
    } else {
      for (let i = 0; i < pos.count; i++) allIndices.push(i + vertexOffset);
    }
    vertexOffset += pos.count;
  }

  const mergedGeo = new BufferGeometry();
  mergedGeo.setAttribute('position', new BufferAttribute(new Float32Array(allPositions), 3));
  mergedGeo.setIndex(new BufferAttribute(new Uint32Array(allIndices), 1));
  mergedGeo.computeBoundingBox();

  const bb = mergedGeo.boundingBox;
  const sx = bb.max.x - bb.min.x;
  const sy = bb.max.y - bb.min.y;
  const sz = bb.max.z - bb.min.z;
  console.log(`  BBox: [${bb.min.x.toFixed(2)}, ${bb.min.y.toFixed(2)}, ${bb.min.z.toFixed(2)}] → [${bb.max.x.toFixed(2)}, ${bb.max.y.toFixed(2)}, ${bb.max.z.toFixed(2)}]`);
  console.log(`  Tamaño: ${sx.toFixed(2)} × ${sy.toFixed(2)} × ${sz.toFixed(2)}`);

  const decomp = decomposeBySlicing(mergedGeo, 100);

  console.log(`\n  ✅ Before dedup: ${decomp.stats.rawBeforeDedup}  →  After dedup: ${decomp.stats.totalFeatures}`);
  console.log(`     Extrusiones: ${decomp.stats.extrusions}`);
  console.log(`     Revoluciones: ${decomp.stats.revolutions}`);
  console.log(`     Agujeros: ${decomp.stats.holes}`);
  console.log(`     Desconocidos: ${decomp.stats.unknown}`);
  console.log(`     Tiempo: ${decomp.stats.processingTimeMs.toFixed(0)}ms`);

  // Axis detail
  for (const ax of ['X', 'Y', 'Z']) {
    const scan = decomp.scans[ax];
    const filled = scan.slices.filter(s => s.totalArea > 0).length;
    console.log(`\n  📐 Eje ${ax}: ${scan.bands.length} bandas, ${filled}/${scan.slices.length} cortes`);
    console.log(`     Rango: [${scan.range[0].toFixed(3)} .. ${scan.range[1].toFixed(3)}]`);

    for (let bi = 0; bi < Math.min(scan.bands.length, 15); bi++) {
      const b = scan.bands[bi];
      const h = (b.zEnd - b.zStart).toFixed(2);
      console.log(`     Band[${bi}] z=${b.zStart.toFixed(2)}..${b.zEnd.toFixed(2)} h=${h} ${b.featureType.padEnd(16)} β0=${b.slice.beta0} β1=${b.slice.beta1} area=${b.slice.totalArea.toFixed(1)} outers=${b.outerContours.length} holes=${b.holeContours.length}${b.outerContours.some(c => c.isCircular) ? ' ●' : ''}`);
    }
    if (scan.bands.length > 15) console.log(`     ... +${scan.bands.length - 15} más bandas`);
  }

  // Feature table
  console.log('\n  📋 TODOS LOS FEATURES:');
  console.log('  ' + '─'.repeat(55));
  for (let i = 0; i < decomp.features.length; i++) {
    const f = decomp.features[i];
    const r = f.radius ? `r=${f.radius.toFixed(2)}` : '';
    console.log(`  [${String(i).padStart(2)}] ${f.type.padEnd(10)} ${f.axis} h=${f.height.toFixed(2).padStart(7)} ${r.padEnd(10)} c=(${f.center.map(v => v.toFixed(1)).join(', ')}) ${(f.confidence * 100).toFixed(0)}%  ${f.label}`);
  }

  // Cross-axis verification
  console.log('\n  🔄 VERIFICACIÓN INTER-EJES:');
  const circByAxis = { X: 0, Y: 0, Z: 0 };
  for (const f of decomp.features) {
    if (f.radius && f.radius > 0.01) circByAxis[f.axis]++;
  }
  console.log(`     Circulares: X=${circByAxis.X} Y=${circByAxis.Y} Z=${circByAxis.Z}`);

  const buckets = new Map();
  for (const f of decomp.features) {
    const key = `${Math.round(f.center[0])},${Math.round(f.center[1])},${Math.round(f.center[2])}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(f);
  }
  const multiAxis = [...buckets.entries()].filter(([, v]) => {
    const axes = new Set(v.map(f => f.axis));
    return axes.size > 1;
  });
  console.log(`     Multi-eje locations: ${multiAxis.length}`);
  for (const [pos, feats] of multiAxis.slice(0, 8)) {
    console.log(`       ${pos}: ${feats.map(f => `${f.axis}:${f.type}`).join(' + ')}`);
  }

  console.log('\n' + '═'.repeat(70) + '\n');
  return decomp;
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
    // Default: run on all AP203 geometry-only NIST-CTC files
    const nistDir = path.join(modelsDir, 'NIST-PMI-STEP-Files', 'AP203 geometry only');
    if (fs.existsSync(nistDir)) {
      files = fs.readdirSync(nistDir)
        .filter(f => f.endsWith('.stp') && f.includes('nist_ctc'))
        .sort()
        .map(f => path.join(nistDir, f));
    } else {
      // Fallback: any .stp in models/step
      files = fs.readdirSync(modelsDir)
        .filter(f => f.endsWith('.stp') || f.endsWith('.step'))
        .slice(0, 5)
        .map(f => path.join(modelsDir, f));
    }
  }

  console.log(`\n🔧 CT-Scan Test — ${files.length} archivos\n`);

  const results = [];

  for (const file of files) {
    try {
      console.log(`⏳ Cargando ${path.basename(file)}...`);
      const { meshes, meshCount } = await loadStepFile(file);
      console.log(`   ✓ ${meshCount} meshes cargados`);
      const decomp = analyzeFile(file, meshes);
      results.push({ file: path.basename(file), decomp, success: true });
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      results.push({ file: path.basename(file), success: false, error: err.message });
    }
  }

  // Summary table
  console.log('\n' + '═'.repeat(70));
  console.log('📊 RESUMEN COMPARATIVO');
  console.log('═'.repeat(70));
  console.log(`${'Archivo'.padEnd(35)} ${'Features'.padStart(8)} ${'Ext'.padStart(5)} ${'Rev'.padStart(5)} ${'Holes'.padStart(6)} ${'Raw→'.padStart(6)} ${'ms'.padStart(6)}`);
  console.log('─'.repeat(70));

  for (const r of results) {
    if (r.success) {
      const s = r.decomp.stats;
      console.log(`${r.file.padEnd(35)} ${String(s.totalFeatures).padStart(8)} ${String(s.extrusions).padStart(5)} ${String(s.revolutions).padStart(5)} ${String(s.holes).padStart(6)} ${String(s.rawBeforeDedup).padStart(6)} ${s.processingTimeMs.toFixed(0).padStart(6)}`);
    } else {
      console.log(`${r.file.padEnd(35)} ERROR: ${r.error}`);
    }
  }
  console.log('═'.repeat(70));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
