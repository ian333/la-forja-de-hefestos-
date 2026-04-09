#!/usr/bin/env node
/**
 * ⚒️ La Forja — Barrido Continuo + Cross-Axis Correlation (CPU)
 * ================================================================
 * Dense sweep on all 3 axes using CPU mesh-plane intersection.
 * No WebGL. No 20 slices. CONTINUOUS sweep.
 *
 * Algoritmo (bisección adaptiva):
 *
 *   Sea f(t) = # contornos a profundidad t.
 *   f(t) es una función escalonada — constante entre vértices de la malla.
 *
 *   1. Muestreo inicial: N₀ = 16 puntos uniformes (O(N₀) slices)
 *   2. Para cada par consecutivo (tₐ, t_b):
 *      • f(tₐ) ≠ f(t_b) → TRANSICIÓN: bisectar hasta |t_b − tₐ| < ε
 *        ε = range · 10⁻⁵ (≈ 0.007mm para pieza de 680mm)
 *        Convergencia: ~17 iteraciones (log₂(range/ε))
 *      • f(tₐ) = f(t_b) y |t_b − tₐ| > guardWidth → subdividir para
 *        verificar que no haya transiciones ocultas (picos)
 *        guardWidth = range / 64
 *   3. Resultado: TODAS las transiciones localizadas a ±ε/2
 *      sin fijar ningún parámetro. El algoritmo determina cuántos
 *      slices necesita.
 *
 * Usage:
 *   node scripts/sweep-test.cjs <file.stp>
 */

'use strict';
const fs = require('fs');
const path = require('path');
const occtFactory = require('occt-import-js');

// ═══════════════════════════════════════════════════════════════
// Polyfills (minimal Three.js for Node)
// ═══════════════════════════════════════════════════════════════
class BufferAttribute {
  constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.count = array.length / itemSize; }
  getX(i) { return this.array[i * this.itemSize]; }
  getY(i) { return this.array[i * this.itemSize + 1]; }
  getZ(i) { return this.array[i * this.itemSize + 2]; }
}
class BufferGeometry {
  constructor() { this._attrs = {}; this._index = null; }
  setAttribute(n, a) { this._attrs[n] = a; }
  getAttribute(n) { return this._attrs[n]; }
  setIndex(a) { this._index = a; }
  getIndex() { return this._index; }
  computeBoundingBox() {}
}

// ═══════════════════════════════════════════════════════════════
// Vec3
// ═══════════════════════════════════════════════════════════════
const dot3 = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const cross3 = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const len3 = a => Math.sqrt(a[0]*a[0] + a[1]*a[1] + a[2]*a[2]);
const norm3 = a => { const l = len3(a); return l < 1e-15 ? [0,0,0] : [a[0]/l, a[1]/l, a[2]/l]; };
const sub3 = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const add3 = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const scale3 = (a, s) => [a[0]*s, a[1]*s, a[2]*s];

// ═══════════════════════════════════════════════════════════════
// Colors
// ═══════════════════════════════════════════════════════════════
const B = '\x1b[1m', D = '\x1b[2m', RS = '\x1b[0m';
const GR = '\x1b[32m', RD = '\x1b[31m', YE = '\x1b[33m', CY = '\x1b[36m', MG = '\x1b[35m';

// ═══════════════════════════════════════════════════════════════
// STEP Loader
// ═══════════════════════════════════════════════════════════════
async function loadStep(filePath, occt) {
  const data = fs.readFileSync(filePath);
  const result = occt.ReadStepFile(new Uint8Array(data), null);
  if (!result.success) return null;
  const allPos = [], allIdx = [];
  let offset = 0;
  for (const m of result.meshes) {
    const pos = new Float32Array(m.attributes.position.array);
    const idx = m.index ? new Uint32Array(m.index.array) : null;
    for (let i = 0; i < pos.length; i++) allPos.push(pos[i]);
    if (idx) for (let i = 0; i < idx.length; i++) allIdx.push(idx[i] + offset);
    else for (let i = 0; i < pos.length / 3; i++) allIdx.push(i + offset);
    offset += pos.length / 3;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(allPos), 3));
  geo.setIndex(new BufferAttribute(new Uint32Array(allIdx), 1));
  return geo;
}

// ═══════════════════════════════════════════════════════════════
// Bounding box
// ═══════════════════════════════════════════════════════════════
function computeBB(geo) {
  const pos = geo.getAttribute('position');
  let x0 = Infinity, y0 = Infinity, z0 = Infinity;
  let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  return { min: [x0, y0, z0], max: [x1, y1, z1] };
}

// ═══════════════════════════════════════════════════════════════
// Mesh-Plane Intersection (CPU)
// ═══════════════════════════════════════════════════════════════
function planeBasis(n) {
  const up = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm3(cross3(up, n));
  const v = norm3(cross3(n, u));
  return { u, v };
}

function sliceMesh(geo, normal, offset) {
  const pos = geo.getAttribute('position');
  const idx = geo.getIndex();
  if (!pos) return { contours: [] };
  const numTri = idx ? idx.count / 3 : pos.count / 3;
  const N = normal;
  const { u, v } = planeBasis(N);
  const segments = [];

  for (let t = 0; t < numTri; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    const verts = [];
    for (const ii of [i0, i1, i2]) {
      const p3 = [pos.getX(ii), pos.getY(ii), pos.getZ(ii)];
      verts.push({ sd: dot3(p3, N) - offset, u: dot3(p3, u), v: dot3(p3, v) });
    }
    const pts = [];
    for (let e = 0; e < 3; e++) {
      const a = verts[e], b = verts[(e + 1) % 3];
      if ((a.sd > 0) !== (b.sd > 0)) {
        const tt = a.sd / (a.sd - b.sd);
        pts.push({ x: a.u + tt * (b.u - a.u), y: a.v + tt * (b.v - a.v) });
      } else if (Math.abs(a.sd) < 1e-12) {
        pts.push({ x: a.u, y: a.v });
      }
    }
    if (pts.length >= 2) segments.push([pts[0], pts[1]]);
  }
  if (segments.length === 0) return { contours: [] };
  return chainSegments(segments);
}

function shoelaceArea(pts) {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function chainSegments(segments) {
  const used = new Set();
  const contours = [];
  const key = p => `${(p.x * 1e4) | 0},${(p.y * 1e4) | 0}`;
  const adj = new Map();
  for (let i = 0; i < segments.length; i++) {
    const [a, b] = segments[i];
    const ka = key(a), kb = key(b);
    if (!adj.has(ka)) adj.set(ka, []);
    if (!adj.has(kb)) adj.set(kb, []);
    adj.get(ka).push({ idx: i, other: b, key: kb });
    adj.get(kb).push({ idx: i, other: a, key: ka });
  }
  for (let start = 0; start < segments.length; start++) {
    if (used.has(start)) continue;
    used.add(start);
    const chain = [segments[start][0], segments[start][1]];
    let curKey = key(segments[start][1]);
    const startKey = key(segments[start][0]);
    let safety = segments.length + 10;
    while (curKey !== startKey && safety-- > 0) {
      const nbs = adj.get(curKey) || [];
      let found = false;
      for (const nb of nbs) {
        if (!used.has(nb.idx)) {
          used.add(nb.idx);
          chain.push(nb.other);
          curKey = nb.key;
          found = true;
          break;
        }
      }
      if (!found) break;
    }
    if (chain.length >= 4) {
      const area = shoelaceArea(chain);
      contours.push({ points: chain, area });
    }
  }
  return { contours };
}

// ═══════════════════════════════════════════════════════════════
// Contour signature
// ═══════════════════════════════════════════════════════════════
function contourSig(contour, normal, offset) {
  const pts = contour.points;
  if (pts.length < 3) return null;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let cx = 0, cy = 0;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;

  const absArea = Math.abs(contour.area);

  // Perimeter
  let perim = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    perim += Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  }
  const circ = perim > 0 ? (4 * Math.PI * absArea) / (perim ** 2) : 0;

  // Reconstruct 3D world: worldPos = cx*u + cy*v + offset*normal
  const { u, v } = planeBasis(normal);
  const world = [
    cx * u[0] + cy * v[0] + offset * normal[0],
    cx * u[1] + cy * v[1] + offset * normal[1],
    cx * u[2] + cy * v[2] + offset * normal[2],
  ];

  return {
    cx, cy, area: absArea, circ, nPts: pts.length,
    bbox: { minX, minY, maxX, maxY },
    w: maxX - minX, h: maxY - minY,
    world,
    isHole: contour.area < 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// ADAPTIVE SWEEP — bisección recursiva, cero parámetros
// ═══════════════════════════════════════════════════════════════
//
// Derivación:
//   Sea f(t) = # contornos a profundidad t (función escalonada).
//   Queremos encontrar TODOS los puntos de discontinuidad t_k
//   donde f(t_k⁻) ≠ f(t_k⁺).
//
//   Fase 1 — Muestreo inicial uniforme (N₀ = 16 muestras):
//     Garantiza capturar transiciones separadas por > range/15.
//
//   Fase 2 — Bisección adaptiva:
//     Para cada par consecutivo (tₐ, t_b):
//       Si f(tₐ) ≠ f(t_b): hay transición → bisectar.
//         t_mid = (tₐ + t_b) / 2    (punto medio, como Newton pero sin derivada)
//         Convergencia: |t_b - tₐ| < ε  donde  ε = range · 10⁻⁵
//         Esto da precisión de ~0.01mm para piezas de 1m.
//       Si f(tₐ) = f(t_b) y |t_b - tₐ| > guardWidth:
//         Verificar que no haya transiciones ocultas (picos).
//         guardWidth = range / 64  — ningún intervalo sin verificar > 1.5% del rango.
//
//   Resultado: error de localización → 0 sin fijar # de slices.
//   El algoritmo determina el mínimo necesario.
//
function sweepAxis(geo, axis, bb) {
  const normal = axis === 'X' ? [1, 0, 0] : axis === 'Y' ? [0, 1, 0] : [0, 0, 1];
  const idx = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;
  const lo = bb.min[idx], hi = bb.max[idx];
  const range = hi - lo;
  const margin = range * 0.02;
  const start = lo + margin;
  const end = hi - margin;
  const effectiveRange = end - start;

  // ── Auto-derived parameters ──
  // ε: convergence tolerance  —  range·10⁻⁵, floor at 1e-6
  const eps = Math.max(effectiveRange * 1e-5, 1e-6);
  // guardWidth: max unchecked stable interval  —  range/64
  const guardWidth = effectiveRange / 64;

  // ── Comparison: count + relative area delta ──
  // Topology changes (count) trigger bisection immediately.
  // For same-count slices, compare total cross-section area.
  // On smooth curves (cylinder along X) area varies gradually
  // → delta per guard interval < threshold.
  // On real steps (shoulder, pocket bottom) area jumps abruptly
  // → delta >> threshold, bisection converges to exact position.
  const AREA_DELTA_THRESHOLD = 0.05; // 5% relative change

  function areDifferent(sLo, sHi) {
    if (sLo.count !== sHi.count) return 'count';
    if (sLo.count === 0) return false;
    const maxA = Math.max(sLo.totalArea, sHi.totalArea);
    if (maxA < 1e-10) return false;
    if (Math.abs(sHi.totalArea - sLo.totalArea) / maxA > AREA_DELTA_THRESHOLD) return 'shape';
    return false;
  }

  // Memoized slicer
  const cache = new Map();
  let sliceCount = 0;
  function doSlice(depth) {
    const qd = Math.round(depth / eps) * eps;
    if (cache.has(qd)) return cache.get(qd);
    const result = sliceMesh(geo, normal, qd);
    const sigs = result.contours
      .map(c => contourSig(c, normal, qd))
      .filter(s => s !== null);
    const totalArea = sigs.reduce((s, c) => s + c.area, 0);
    const entry = { depth: qd, count: sigs.length, contours: sigs, totalArea };
    cache.set(qd, entry);
    sliceCount++;
    return entry;
  }

  // ── Phase 1: Coarse uniform scan ──
  const N0 = 16;
  const coarse = [];
  for (let i = 0; i < N0; i++) {
    const t = i / (N0 - 1);
    coarse.push(doSlice(start + effectiveRange * t));
  }

  // ── Phase 2: Adaptive refinement (iterative — no stack overflow) ──
  const transitions = [];
  let maxBisections = 0;

  // Work queue: pairs to refine  [{sLo, sHi, depth}]
  const queue = [];
  for (let i = 0; i < coarse.length - 1; i++) {
    queue.push({ sLo: coarse[i], sHi: coarse[i + 1], depth: 0 });
  }

  while (queue.length > 0) {
    const { sLo, sHi, depth } = queue.pop();
    const width = sHi.depth - sLo.depth;

    const diff = areDifferent(sLo, sHi);
    if (diff) {
      // Transition detected — bisect to convergence
      if (width < eps || depth > 50) {
        transitions.push({
          boundary: (sLo.depth + sHi.depth) / 2,
          from: sLo.depth, to: sHi.depth,
          fc: sLo.count, tc: sHi.count,
          dc: sHi.count - sLo.count,
          reason: diff,
          bisections: depth,
        });
        if (depth > maxBisections) maxBisections = depth;
        continue;
      }
      const mid = doSlice((sLo.depth + sHi.depth) / 2);
      // Guard: if quantisation collapsed mid to an endpoint, converge
      if (mid.depth <= sLo.depth || mid.depth >= sHi.depth) {
        transitions.push({
          boundary: (sLo.depth + sHi.depth) / 2,
          from: sLo.depth, to: sHi.depth,
          fc: sLo.count, tc: sHi.count,
          dc: sHi.count - sLo.count,
          reason: diff,
          bisections: depth,
        });
        if (depth > maxBisections) maxBisections = depth;
        continue;
      }
      queue.push({ sLo: mid, sHi, depth: depth + 1 });
      queue.push({ sLo, sHi: mid, depth: depth + 1 });
    } else {
      // Stable interval — verify no hidden transitions if too wide
      if (width > guardWidth && depth < 50) {
        const mid = doSlice((sLo.depth + sHi.depth) / 2);
        if (mid.depth > sLo.depth && mid.depth < sHi.depth) {
          queue.push({ sLo: mid, sHi, depth: depth + 1 });
          queue.push({ sLo, sHi: mid, depth: depth + 1 });
        }
      }
    }
  }

  // Collect all samples sorted by depth
  const samples = [...cache.values()].sort((a, b) => a.depth - b.depth);

  return { axis, samples, transitions, sliceCount, eps, maxBisections };
}

// ═══════════════════════════════════════════════════════════════
// Cross-axis correlation
// ═══════════════════════════════════════════════════════════════
function crossCorrelate(sweeps, diag) {
  const TOL = diag * 0.02;

  // Collect all contour world positions by axis
  const byAxis = { X: [], Y: [], Z: [] };
  for (const sw of Object.values(sweeps)) {
    for (const sample of sw.samples) {
      for (const c of sample.contours) {
        byAxis[sw.axis].push({ ...c, depth: sample.depth });
      }
    }
  }

  const rawFeatures = [];

  // Z-contours know worldX, worldY. Check X and Y sweeps.
  for (const zc of byAxis.Z) {
    const wx = zc.world[0], wy = zc.world[1];
    const xHits = byAxis.X.filter(xc => Math.abs(xc.world[1] - wy) < TOL);
    const yHits = byAxis.Y.filter(yc => Math.abs(yc.world[0] - wx) < TOL);

    const axes = new Set(['Z']);
    if (xHits.length > 0) axes.add('X');
    if (yHits.length > 0) axes.add('Y');

    if (axes.size >= 2) {
      rawFeatures.push({
        world: [wx, wy, zc.depth],
        corr: axes.size,
        axes: [...axes],
        area: zc.area,
        circ: zc.circ,
        isHole: zc.isHole,
        xTypes: xHits.length,
        yTypes: yHits.length,
      });
    }
  }

  // X↔Y pairs not covered by Z
  const zKeys = new Set(rawFeatures.map(f => `${Math.round(f.world[0] / TOL)},${Math.round(f.world[1] / TOL)}`));
  for (const xc of byAxis.X) {
    const wy = xc.world[1], wz = xc.world[2];
    const yHits = byAxis.Y.filter(yc => Math.abs(yc.world[2] - wz) < TOL);
    if (yHits.length > 0) {
      const wx = yHits[0].world[0];
      const key = `${Math.round(wx / TOL)},${Math.round(wy / TOL)}`;
      if (!zKeys.has(key)) {
        rawFeatures.push({
          world: [wx, wy, wz],
          corr: 2, axes: ['X', 'Y'],
          area: xc.area, circ: xc.circ, isHole: xc.isHole,
          xTypes: 1, yTypes: yHits.length,
        });
      }
    }
  }

  // Deduplicate
  const used = new Set();
  const features = [];
  for (let i = 0; i < rawFeatures.length; i++) {
    if (used.has(i)) continue;
    const group = [rawFeatures[i]];
    used.add(i);
    for (let j = i + 1; j < rawFeatures.length; j++) {
      if (used.has(j)) continue;
      const dx = rawFeatures[i].world[0] - rawFeatures[j].world[0];
      const dy = rawFeatures[i].world[1] - rawFeatures[j].world[1];
      if (Math.sqrt(dx * dx + dy * dy) < TOL * 2) {
        group.push(rawFeatures[j]);
        used.add(j);
      }
    }
    group.sort((a, b) => b.corr - a.corr);
    const best = { ...group[0] };
    best.depthCount = group.length;
    const allAxes = new Set();
    const depths = [];
    for (const g of group) { for (const a of g.axes) allAxes.add(a); depths.push(g.world[2]); }
    best.axes = [...allAxes];
    best.corr = allAxes.size;
    best.area = Math.max(...group.map(g => g.area));
    best.depthRange = depths.length > 0 ? [Math.min(...depths), Math.max(...depths)] : null;
    features.push(best);
  }

  return features.sort((a, b) => (b.corr - a.corr) || (b.area - a.area));
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// Run a single file and return structured result
// ═══════════════════════════════════════════════════════════════
async function runOne(stepFile, occt, verbose) {
  const t0 = Date.now();
  const geo = await loadStep(stepFile, occt);
  if (!geo) return null;
  const loadMs = Date.now() - t0;

  const bb = computeBB(geo);
  const diag = len3(sub3(bb.max, bb.min));

  const sweeps = {};
  let totalSlices = 0;
  for (const axis of ['X', 'Y', 'Z']) {
    sweeps[axis] = sweepAxis(geo, axis, bb);
    totalSlices += sweeps[axis].sliceCount;
  }
  const sweepMs = Date.now() - t0 - loadMs;

  const features = crossCorrelate(sweeps, diag);

  let totalTransitions = 0;
  let countTrans = 0;
  let shapeTrans = 0;
  for (const axis of ['X', 'Y', 'Z']) {
    for (const tr of sweeps[axis].transitions) {
      totalTransitions++;
      if (tr.reason === 'shape') shapeTrans++;
      else countTrans++;
    }
  }

  const result = {
    file: path.basename(stepFile),
    diag: diag.toFixed(1),
    slices: totalSlices,
    xTrans: sweeps.X.transitions.length,
    yTrans: sweeps.Y.transitions.length,
    zTrans: sweeps.Z.transitions.length,
    totalTrans: totalTransitions,
    countTrans,
    shapeTrans,
    features: features.length,
    triple: features.filter(f => f.corr === 3).length,
    double: features.filter(f => f.corr === 2).length,
    loadMs,
    sweepMs,
    totalMs: Date.now() - t0,
  };

  if (verbose) {
    console.log(`\n${B}⚒️  La Forja — Barrido Adaptivo (bisección recursiva)${RS}`);
    console.log(`${D}   File: ${path.basename(stepFile)}${RS}`);
    console.log(`${D}   Loaded in ${loadMs}ms, Diagonal: ${diag.toFixed(1)}mm${RS}`);
    console.log();

    for (const axis of ['X', 'Y', 'Z']) {
      const sw = sweeps[axis];
      const totalContours = sw.samples.reduce((s, sa) => s + sa.count, 0);
      const maxC = Math.max(...sw.samples.map(s => s.count), 0);
      console.log(`${B}${axis}-sweep${RS}: ${sw.sliceCount} slices, ${totalContours} contours, max=${maxC}/slice, ${sw.transitions.length} trans, ε=${sw.eps.toFixed(4)}, bisections=${sw.maxBisections}`);
      for (const tr of sw.transitions) {
        const tag = tr.dc !== 0 ? (tr.dc > 0 ? `${GR}+${tr.dc}${RS}` : `${RD}${tr.dc}${RS}`) : `${YE}shape${RS}`;
        const prec = (tr.to - tr.from);
        const reasonTag = tr.reason === 'shape' ? ` ${MG}Δarea${RS}` : '';
        console.log(`  ${D}@ ${tr.boundary.toFixed(4)} [±${(prec/2).toFixed(4)}]: ${tr.fc}→${tr.tc} (${tag})${reasonTag} ${prec < sw.eps * 2 ? `${GR}converged${RS}` : ''}${RS}`);
      }
    }

    console.log(`\n${CY}${B}═══ Cross-Axis Correlation ═══${RS}`);
    console.log(`${GR}Triple (3 axes):${RS} ${result.triple}`);
    console.log(`${YE}Double (2 axes):${RS} ${result.double}`);
    console.log(`Total unique: ${features.length}`);
    for (let i = 0; i < Math.min(features.length, 30); i++) {
      const f = features[i];
      const stars = f.corr === 3 ? `${GR}★★★${RS}` : `${YE}★★${RS}`;
      const hole = f.isHole ? `${D}hole${RS}` : `${MG}boss${RS}`;
      const zStr = f.depthRange ? `z=[${f.depthRange[0].toFixed(1)},${f.depthRange[1].toFixed(1)}]` : '';
      const typeGuess = f.circ > 0.85 ? 'circle' : f.area > diag * diag * 0.01 ? 'pocket' : 'feature';
      console.log(`  ${stars} #${(i+1).toString().padStart(2)} ${typeGuess.padEnd(10)} (${f.world[0].toFixed(1)}, ${f.world[1].toFixed(1)}) area=${f.area.toFixed(0).padStart(7)} ${hole} ${zStr} d=${f.depthCount}`);
    }
    if (features.length > 30) console.log(`  ${D}... +${features.length - 30} more${RS}`);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// Collect STEP files from args (files, dirs, or glob-like)
// ═══════════════════════════════════════════════════════════════
function collectFiles(args) {
  const files = [];
  for (const a of args) {
    if (/\.(stp|step)$/i.test(a)) {
      files.push(a);
    } else {
      // Treat as directory — recurse for .stp files
      try {
        const stat = fs.statSync(a);
        if (stat.isDirectory()) {
          const walk = (dir) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
              if (entry.isDirectory()) walk(path.join(dir, entry.name));
              else if (/\.(stp|step)$/i.test(entry.name)) files.push(path.join(dir, entry.name));
            }
          };
          walk(a);
        }
      } catch (_) { /* not a dir */ }
    }
  }
  return files;
}

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const filteredArgs = args.filter(a => a !== '--verbose' && a !== '-v');
  const files = collectFiles(filteredArgs);

  if (files.length === 0) {
    console.error('Usage: node scripts/sweep-test.cjs <file.stp|dir> [...] [--verbose]');
    process.exit(1);
  }

  const occt = await occtFactory();
  const batch = files.length > 1;

  if (batch) {
    console.log(`\n${B}⚒️  La Forja — Batch Sweep (${files.length} models)${RS}\n`);
  }

  const results = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const name = path.basename(f).replace(/\.(stp|step)$/i, '');
    if (batch) process.stdout.write(`  [${i+1}/${files.length}] ${name}...`);
    try {
      const r = await runOne(f, occt, !batch && verbose);
      if (r) {
        results.push(r);
        if (batch) console.log(` ${GR}✓${RS} ${r.totalTrans} trans, ${r.features} feat, ${r.totalMs}ms`);
      } else {
        if (batch) console.log(` ${RD}✗ load failed${RS}`);
      }
    } catch (err) {
      if (batch) console.log(` ${RD}✗ ${err.message}${RS}`);
    }
  }

  if (!batch) {
    // Single file — already printed by runOne with verbose
    const r = results[0];
    if (r) {
      console.log(`\nTotal: ${r.totalTrans} boundaries (${r.countTrans} count + ${r.shapeTrans} shape) from ${r.slices} slices`);
      console.log(`Features: ${r.features} (${r.triple}★★★ + ${r.double}★★)`);
      console.log(`${B}Time: ${r.totalMs}ms (${r.loadMs}ms load + ${r.sweepMs}ms sweep)${RS}`);
    }
    return;
  }

  // ── Batch summary table ──
  console.log(`\n${B}${CY}${'═'.repeat(120)}${RS}`);
  console.log(`${B}${CY}  BATCH SUMMARY — ${results.length}/${files.length} models${RS}`);
  console.log(`${B}${CY}${'═'.repeat(120)}${RS}`);

  // Header
  const hdr = [
    'Model'.padEnd(38),
    'Diag'.padStart(7),
    'Slices'.padStart(7),
    'X'.padStart(4), 'Y'.padStart(4), 'Z'.padStart(4),
    'Total'.padStart(6),
    'Cnt'.padStart(4), 'Shp'.padStart(4),
    'Feat'.padStart(5),
    '★★★'.padStart(4), '★★'.padStart(4),
    'ms'.padStart(7),
  ].join(' │ ');
  console.log(`${D}${hdr}${RS}`);
  console.log(`${D}${'─'.repeat(120)}${RS}`);

  let totSlices = 0, totTrans = 0, totFeat = 0, totMs = 0;
  for (const r of results) {
    totSlices += r.slices; totTrans += r.totalTrans; totFeat += r.features; totMs += r.totalMs;
    const row = [
      r.file.replace(/\.(stp|step)$/i, '').padEnd(38),
      r.diag.padStart(7),
      String(r.slices).padStart(7),
      String(r.xTrans).padStart(4),
      String(r.yTrans).padStart(4),
      String(r.zTrans).padStart(4),
      String(r.totalTrans).padStart(6),
      String(r.countTrans).padStart(4),
      String(r.shapeTrans).padStart(4),
      String(r.features).padStart(5),
      String(r.triple).padStart(4),
      String(r.double).padStart(4),
      String(r.totalMs).padStart(7),
    ].join(' │ ');
    const color = r.shapeTrans > 0 ? MG : '';
    console.log(`${color}${row}${RS}`);
  }
  console.log(`${D}${'─'.repeat(120)}${RS}`);
  console.log(`${B}TOTAL: ${results.length} models, ${totSlices} slices, ${totTrans} transitions, ${totFeat} features, ${totMs}ms${RS}`);
  console.log(`${D}Average: ${(totSlices/results.length).toFixed(0)} slices/model, ${(totTrans/results.length).toFixed(1)} trans/model, ${(totMs/results.length).toFixed(0)}ms/model${RS}`);
}

main().catch(err => { console.error(err); process.exit(1); });
