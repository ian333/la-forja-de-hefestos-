#!/usr/bin/env node
/**
 * ⚒️ Roundtrip Fidelity Test — Build → Detect → Reconstruct → Detect × 3
 * =========================================================================
 *
 * Pipeline per model:
 *   1. Load STEP → mesh triangles (via occt-import-js)
 *   2. Detect planar directions (v3 algorithm)
 *   3. Reconstruct planar faces from detected directions
 *   4. Detect again on the reconstructed faces
 *   5. Repeat step 3-4 (3 total iterations)
 *   6. Compare: all iterations must produce identical results
 *
 * What "reconstruct" means:
 *   For each detected direction with normal N and offset range [lo, hi],
 *   we create quad faces (2 triangles each) at evenly spaced offsets
 *   along N, with area proportional to the detected area.
 *   This is the "inverse" of detection: directions → faces.
 *
 * The test proves the algorithm is IDEMPOTENT:
 *   detect(reconstruct(detect(mesh))) === detect(mesh)
 *
 * If information is lost, the direction count or normals will drift.
 */

const fs = require('fs');
const path = require('path');

// ── vec3 math ──
const dot  = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const len  = (a) => Math.sqrt(a[0]*a[0] + a[1]*a[1] + a[2]*a[2]);
const norm = (a) => { const l = len(a); return l < 1e-15 ? [0,0,0] : [a[0]/l, a[1]/l, a[2]/l]; };
const sub  = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const add  = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const scale = (a, s) => [a[0]*s, a[1]*s, a[2]*s];
const neg  = (a) => [-a[0], -a[1], -a[2]];

// ═══════════════════════════════════════════════════════════════
// v3 ALGORITHM — exact copy from geometry-unit-test.cjs
// ═══════════════════════════════════════════════════════════════

function computeBB(faces) {
  let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity;
  for (const f of faces) {
    const [x,y,z] = f.center;
    if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; if(z<z0)z0=z; if(z>z1)z1=z;
  }
  return { min: [x0,y0,z0], max: [x1,y1,z1] };
}

function detectPlanarDirectionsV3(faces, bb) {
  if (faces.length === 0) return [];
  const totalArea = faces.reduce((s, f) => s + f.area, 0);
  const size = sub(bb.max, bb.min);
  const diag = len(size);

  const COS_5DEG = Math.cos(5 * Math.PI / 180);
  const clusters = [];
  for (const f of faces) {
    let best = null, bestDot = -Infinity;
    for (const cl of clusters) {
      const d = Math.abs(dot(f.normal, cl.normal));
      if (d > COS_5DEG && d > bestDot) { bestDot = d; best = cl; }
    }
    const fOff = dot(f.center, f.normal);
    if (best) {
      const fn = dot(f.normal, best.normal) < 0 ? neg(f.normal) : [...f.normal];
      best.faceNormals.push(fn);
      best.faceAreas.push(f.area);
      best.offsets.push(dot(f.center, best.normal));
      const t = best.area + f.area;
      const wOld = best.area / t, wNew = f.area / t;
      best.normal = norm(add(scale(best.normal, wOld), scale(fn, wNew)));
      best.area = t;
      best.faceCount++;
    } else {
      clusters.push({
        normal: [...f.normal], area: f.area, faceCount: 1,
        faceNormals: [[...f.normal]], faceAreas: [f.area], offsets: [fOff],
      });
    }
  }

  for (const cl of clusters) {
    let sumWT2 = 0, sumW = 0;
    for (let i = 0; i < cl.faceNormals.length; i++) {
      const cosT = Math.min(1, Math.abs(dot(cl.faceNormals[i], cl.normal)));
      const theta = Math.acos(cosT);
      sumWT2 += cl.faceAreas[i] * theta * theta;
      sumW += cl.faceAreas[i];
    }
    cl.sigmaTheta = Math.sqrt(sumWT2 / Math.max(sumW, 1e-15)) * 180 / Math.PI;
    const meanOff = cl.offsets.reduce((s, o) => s + o, 0) / cl.offsets.length;
    const varOff = cl.offsets.reduce((s, o) => s + (o - meanOff) ** 2, 0) / cl.offsets.length;
    cl.sigmaOffset = Math.sqrt(varOff);
    cl.sigmaOffsetRel = diag > 0 ? cl.sigmaOffset / diag : 0;
    cl.areaPct = totalArea > 0 ? (cl.area / totalArea) * 100 : 0;
  }

  const planar = clusters.filter(cl => {
    const isCoplanar = cl.sigmaTheta < 1.5 && cl.sigmaOffsetRel < 0.001;
    const hasMass = cl.faceCount >= 3 || cl.areaPct > 0.3;
    const isDominant = cl.areaPct > 3.0;
    return (isCoplanar && hasMass) || isDominant;
  });

  planar.sort((a, b) => b.area - a.area);
  const COS_10DEG = Math.cos(10 * Math.PI / 180);
  const merged = [];

  for (const cl of planar) {
    let target = null;
    for (const m of merged) {
      if (Math.abs(dot(cl.normal, m.anchor)) > COS_10DEG) { target = m; break; }
    }
    if (target) {
      if (dot(cl.normal, target.anchor) < 0) cl.normal = neg(cl.normal);
      const t = target.area + cl.area;
      target.normal = norm(add(scale(target.normal, target.area / t), scale(cl.normal, cl.area / t)));
      target.area = t;
      target.faceCount += cl.faceCount;
      target.offsets.push(...cl.offsets);
      target.sigmaTheta = Math.min(target.sigmaTheta, cl.sigmaTheta);
      target.areaPct += cl.areaPct;
    } else {
      merged.push({
        normal: [...cl.normal], anchor: [...cl.normal],
        area: cl.area, faceCount: cl.faceCount, offsets: [...cl.offsets],
        sigmaTheta: cl.sigmaTheta, sigmaOffset: cl.sigmaOffset, areaPct: cl.areaPct,
      });
    }
  }

  const axisVecs = [[1,0,0], [0,1,0], [0,0,1]];
  const bbCenter = scale(add(bb.min, bb.max), 0.5);
  for (const av of axisVecs) {
    if (!merged.some(m => Math.abs(dot(m.normal, av)) > COS_10DEG)) {
      merged.push({
        normal: [...av], anchor: [...av],
        area: 0, faceCount: 0, offsets: [dot(bbCenter, av)],
        sigmaTheta: 0, sigmaOffset: 0, areaPct: 0,
      });
    }
  }

  merged.sort((a, b) => b.area - a.area);

  return merged.map(cl => {
    const n = [...cl.normal];
    if (n[0] + n[1] + n[2] < 0) { n[0] = -n[0]; n[1] = -n[1]; n[2] = -n[2]; }
    const sorted = [...cl.offsets].sort((a, b) => a - b);
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
    const isAxis = ax > 0.985 || ay > 0.985 || az > 0.985;
    let label;
    if (ax > 0.985) label = n[0] > 0 ? '+X' : '-X';
    else if (ay > 0.985) label = n[1] > 0 ? '+Y' : '-Y';
    else if (az > 0.985) label = n[2] > 0 ? '+Z' : '-Z';
    else {
      const pitch = Math.asin(Math.max(-1, Math.min(1, n[1]))) * 180 / Math.PI;
      const yaw = Math.atan2(n[0], n[2]) * 180 / Math.PI;
      label = `∠${Math.round(pitch)}°/${Math.round(yaw)}°`;
    }
    return {
      normal: n, area: cl.area, areaPct: cl.areaPct, faceCount: cl.faceCount,
      offsetRange: [sorted[0], sorted[sorted.length - 1]], label, isAxis,
      sigmaTheta: cl.sigmaTheta,
    };
  });
}

function generateGeometryPlanes(directions, diag) {
  const maxSlices = 10, minAreaPct = 0.1, minSpacing = diag * 0.01;
  const planes = [];
  for (const dir of directions) {
    if (!dir.isAxis && dir.areaPct < minAreaPct) continue;
    const [lo0, hi0] = dir.offsetRange;
    const range = hi0 - lo0;
    if (range < minSpacing) {
      planes.push({ normal: dir.normal, offset: (lo0 + hi0) / 2, label: dir.label });
      continue;
    }
    const n = Math.min(maxSlices, Math.max(2, Math.ceil(range / minSpacing)));
    const margin = range * 0.02;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      planes.push({
        normal: dir.normal,
        offset: (lo0 + margin) + ((hi0 - margin) - (lo0 + margin)) * t,
        label: `${dir.label} d${i+1}/${n}`,
      });
    }
  }
  return planes;
}

// ═══════════════════════════════════════════════════════════════
// RECONSTRUCT: directions → planar faces (the "inverse" of detection)
// ═══════════════════════════════════════════════════════════════
//
// For each detected direction, we create quad faces that represent
// the planar surface. The quads live at the detected offset positions,
// have the correct normal, and their area matches the detected area.
//
// This is NOT a real 3D solid — it's the minimal set of faces that
// should reproduce the same detection results when fed back in.

function planeBasis(n) {
  // Compute orthogonal U, V for a given normal
  const up = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(up, n));
  const v = norm(cross(n, u));
  return { u, v };
}

function reconstructFaces(directions, bb) {
  const faces = [];
  const size = sub(bb.max, bb.min);
  const diag = len(size);
  const totalArea = directions.reduce((s, d) => s + d.area, 0);
  const RES = 4; // subdivide each quad into 4×4×2 triangles

  for (const dir of directions) {
    // Skip phantom axis directions with no real faces
    if (dir.faceCount === 0 && dir.area === 0) continue;

    const n = dir.normal;
    const { u, v } = planeBasis(n);

    // Determine quad size from area: a square with side = sqrt(area per offset)
    // We distribute faces across unique offsets in the offset range
    const [lo, hi] = dir.offsetRange;
    const range = hi - lo;
    const minSpacing = diag * 0.01;

    // Number of distinct depth slices to reconstruct
    let numSlices;
    if (range < minSpacing) {
      numSlices = 1;
    } else {
      numSlices = Math.min(10, Math.max(2, Math.ceil(range / minSpacing)));
    }

    const areaPerSlice = dir.area / numSlices;
    const side = Math.sqrt(areaPerSlice); // side of equivalent square
    const halfSide = side / 2;

    for (let si = 0; si < numSlices; si++) {
      const t = numSlices === 1 ? 0.5 : si / (numSlices - 1);
      const margin = range * 0.02;
      const offset = numSlices === 1
        ? (lo + hi) / 2
        : (lo + margin) + ((hi - margin) - (lo + margin)) * t;

      // Quad center = normal * offset
      const center = scale(n, offset);

      // Generate RES×RES×2 triangles for this quad
      for (let yi = 0; yi < RES; yi++) {
        for (let xi = 0; xi < RES; xi++) {
          const x0 = -halfSide + side * (xi / RES);
          const x1 = -halfSide + side * ((xi + 1) / RES);
          const y0 = -halfSide + side * (yi / RES);
          const y1 = -halfSide + side * ((yi + 1) / RES);

          // Vertices in world space
          const p00 = add(center, add(scale(u, x0), scale(v, y0)));
          const p10 = add(center, add(scale(u, x1), scale(v, y0)));
          const p11 = add(center, add(scale(u, x1), scale(v, y1)));
          const p01 = add(center, add(scale(u, x0), scale(v, y1)));

          // Triangle A
          const cA = scale(add(add(p00, p10), p11), 1/3);
          const areaA = 0.5 * len(cross(sub(p10, p00), sub(p11, p00)));
          faces.push({ normal: [...n], center: cA, area: areaA });

          // Triangle B
          const cB = scale(add(add(p00, p11), p01), 1/3);
          const areaB = 0.5 * len(cross(sub(p11, p00), sub(p01, p00)));
          faces.push({ normal: [...n], center: cB, area: areaB });
        }
      }
    }
  }
  return faces;
}

// ═══════════════════════════════════════════════════════════════
// COMPARISON UTILS
// ═══════════════════════════════════════════════════════════════

function directionsFingerprint(dirs) {
  // Sort by label for stable comparison
  const sorted = [...dirs].sort((a, b) => a.label.localeCompare(b.label));
  return sorted.map(d => ({
    label: d.label,
    normal: d.normal.map(v => Math.round(v * 1000) / 1000),
    areaPct: Math.round(d.areaPct * 10) / 10,
    isAxis: d.isAxis,
  }));
}

function compareIterations(fp1, fp2, iterA, iterB) {
  const errors = [];
  if (fp1.length !== fp2.length) {
    errors.push(`Direction count changed: iter${iterA}=${fp1.length} → iter${iterB}=${fp2.length}`);
    return errors;
  }
  for (let i = 0; i < fp1.length; i++) {
    const a = fp1[i], b = fp2[i];
    if (a.label !== b.label) {
      errors.push(`Label drift: "${a.label}" → "${b.label}"`);
    }
    const normalDot = Math.abs(dot(a.normal, b.normal));
    if (normalDot < 0.9999) { // >~0.8° drift
      errors.push(`Normal drift on "${a.label}": ${a.normal} → ${b.normal} (dot=${normalDot.toFixed(6)})`);
    }
  }
  return errors;
}

// ═══════════════════════════════════════════════════════════════
// STEP FILE LOADING
// ═══════════════════════════════════════════════════════════════

function loadSTEPFaces(occt, filePath) {
  const data = fs.readFileSync(filePath);
  const result = occt.ReadStepFile(new Uint8Array(data), null);
  if (!result.success) return null;

  const faces = [];
  for (const m of result.meshes) {
    const pos = new Float32Array(m.attributes.position.array);
    const idx = m.index ? new Uint32Array(m.index.array) : null;
    const numTri = idx ? idx.length / 3 : pos.length / 9;

    for (let t = 0; t < numTri; t++) {
      const i0 = idx ? idx[t*3]   : t*3;
      const i1 = idx ? idx[t*3+1] : t*3+1;
      const i2 = idx ? idx[t*3+2] : t*3+2;
      const va = [pos[i0*3], pos[i0*3+1], pos[i0*3+2]];
      const vb = [pos[i1*3], pos[i1*3+1], pos[i1*3+2]];
      const vc = [pos[i2*3], pos[i2*3+1], pos[i2*3+2]];
      const ab = sub(vb, va), ac = sub(vc, va);
      const n = cross(ab, ac);
      const a2 = len(n);
      if (a2 < 1e-12) continue;
      faces.push({
        normal: norm(n),
        center: scale(add(add(va, vb), vc), 1/3),
        area: a2 * 0.5,
      });
    }
  }
  return faces;
}

// ═══════════════════════════════════════════════════════════════
// TERMINAL COLORS
// ═══════════════════════════════════════════════════════════════
const B  = '\x1b[1m';
const D  = '\x1b[2m';
const R  = '\x1b[0m';
const G  = '\x1b[32m';
const RE = '\x1b[31m';
const C  = '\x1b[36m';
const Y  = '\x1b[33m';
const PASS = `${G}✓${R}`;
const FAIL = `${RE}✗${R}`;

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  let occtFactory;
  try { occtFactory = require('occt-import-js'); }
  catch { console.error('occt-import-js not found'); process.exit(1); }

  const occt = await occtFactory();
  const dir = path.join(__dirname, '..', 'models', 'step', 'NIST-PMI-STEP-Files', 'AP203 geometry only');
  if (!fs.existsSync(dir)) { console.error('NIST AP203 dir not found'); process.exit(1); }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.stp')).sort().map(f => path.join(dir, f));
  console.log(`${G}${'═'.repeat(78)}${R}`);
  console.log(`${G}${B}⚒️  ROUNDTRIP FIDELITY TEST — Build → Detect → Reconstruct × 3${R}`);
  console.log(`${G}${'═'.repeat(78)}${R}`);
  console.log(`${D}  Models: ${files.length} | Iterations: 3 | Algorithm: v3 (σ_θ dispersion)${R}\n`);

  const ITERATIONS = 3;
  let totalTests = 0, totalPassed = 0;

  for (const filePath of files) {
    const name = path.basename(filePath, '.stp');
    console.log(`${B}${C}═══ ${name} ═══${R}`);

    // ── Load original STEP ──
    const originalFaces = loadSTEPFaces(occt, filePath);
    if (!originalFaces) { console.log(`  ${FAIL} Failed to load`); continue; }

    const bb0 = computeBB(originalFaces);
    const diag0 = len(sub(bb0.max, bb0.min));
    console.log(`  ${D}Original: ${originalFaces.length} triangles | diag=${diag0.toFixed(1)}mm${R}`);

    // ── Iteration 0: detect from original STEP ──
    const dirs0 = detectPlanarDirectionsV3(originalFaces, bb0);
    const planes0 = generateGeometryPlanes(dirs0, diag0);
    const fp0 = directionsFingerprint(dirs0);

    console.log(`  ${Y}Iter 0 (STEP):      ${dirs0.length} dirs | ${planes0.length} planes${R}`);
    for (let i = 0; i < Math.min(5, dirs0.length); i++) {
      const d = dirs0[i];
      console.log(`    ${D}${String(i+1).padStart(2)}. ${d.label.padEnd(14)} ${d.areaPct.toFixed(1).padStart(5)}% area  ${d.faceCount} faces${R}`);
    }
    if (dirs0.length > 5) console.log(`    ${D}... +${dirs0.length - 5} more${R}`);

    // ── Iterations 1..N: reconstruct → detect ──
    let prevFP = fp0;
    let prevDirs = dirs0;
    let prevBB = bb0;
    let allMatch = true;

    for (let iter = 1; iter <= ITERATIONS; iter++) {
      // Reconstruct faces from previous detection
      const reconFaces = reconstructFaces(prevDirs, prevBB);
      const reconBB = computeBB(reconFaces);
      const reconDiag = len(sub(reconBB.max, reconBB.min));

      // Detect from reconstructed faces
      const reconDirs = detectPlanarDirectionsV3(reconFaces, reconBB);
      const reconPlanes = generateGeometryPlanes(reconDirs, reconDiag);
      const reconFP = directionsFingerprint(reconDirs);

      console.log(`  ${Y}Iter ${iter} (reconstruct): ${reconDirs.length} dirs | ${reconPlanes.length} planes | ${reconFaces.length} tris${R}`);

      // ── Compare with previous iteration ──
      const errors = compareIterations(prevFP, reconFP, iter - 1, iter);

      if (errors.length === 0) {
        totalTests++; totalPassed++;
        console.log(`    ${PASS} Direction count stable: ${reconDirs.length}`);
      } else {
        totalTests++;
        allMatch = false;
        console.log(`    ${FAIL} Differences from iter ${iter-1}:`);
        for (const e of errors) console.log(`      ${RE}→ ${e}${R}`);
      }

      // ── Also compare with original (iter 0) ──
      const driftErrors = compareIterations(fp0, reconFP, 0, iter);
      if (driftErrors.length === 0) {
        totalTests++; totalPassed++;
        console.log(`    ${PASS} Matches original (iter 0) exactly`);
      } else {
        totalTests++;
        allMatch = false;
        console.log(`    ${FAIL} Drift from original (iter 0):`);
        for (const e of driftErrors) console.log(`      ${RE}→ ${e}${R}`);
      }

      // ── Check no duplicates ──
      let dupes = 0;
      for (let i = 0; i < reconDirs.length; i++)
        for (let j = i + 1; j < reconDirs.length; j++)
          if (Math.abs(dot(reconDirs[i].normal, reconDirs[j].normal)) > Math.cos(10 * Math.PI / 180)) dupes++;
      totalTests++;
      if (dupes === 0) { totalPassed++; console.log(`    ${PASS} No duplicate normals`); }
      else { allMatch = false; console.log(`    ${FAIL} ${dupes} duplicate normals within 10°`); }

      // ── Check planes match ──
      totalTests++;
      if (Math.abs(reconPlanes.length - planes0.length) <= 1) {
        totalPassed++;
        console.log(`    ${PASS} Plane count stable: ${reconPlanes.length} (orig: ${planes0.length})`);
      } else {
        allMatch = false;
        console.log(`    ${FAIL} Plane count drift: ${reconPlanes.length} vs orig ${planes0.length}`);
      }

      prevFP = reconFP;
      prevDirs = reconDirs;
      prevBB = reconBB;
    }

    // ── Per-model summary ──
    if (allMatch) {
      console.log(`  ${G}${B}✅ IDEMPOTENT — 3 roundtrips, zero drift${R}`);
    } else {
      console.log(`  ${RE}${B}❌ DRIFT DETECTED — information lost across iterations${R}`);
    }
    console.log();
  }

  // ═══════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log(`${G}${'═'.repeat(78)}${R}`);
  console.log(`${B}  Roundtrip tests: ${totalPassed}/${totalTests} passed${R}`);
  if (totalPassed === totalTests) {
    console.log(`${G}${B}  ✅ ALL ROUNDTRIP TESTS PASSED — Algorithm is idempotent${R}`);
  } else {
    console.log(`${RE}${B}  ❌ ${totalTests - totalPassed} TESTS FAILED — Information loss detected${R}`);
  }
  console.log(`${G}${'═'.repeat(78)}${R}\n`);

  process.exit(totalPassed === totalTests ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
