#!/usr/bin/env node
/**
 * ⚒️ Synthetic Geometry — Exact Plane Count Validation
 * =====================================================
 * Creates simple geometries where we KNOW the exact number of planar
 * directions, then validates detectPlanarDirections() against them.
 *
 * Progression:
 *   1. Cubo simple          → 3 dirs (X, Y, Z)
 *   2. Cubo con agujero     → 3 dirs (cylinder = filtered noise)
 *   3. Cubo con chamfer 45° → 4 dirs (+1 angled)
 *   4. Cubo con 2 chamfers  → 5 dirs
 *   5. Placa angulada       → 6 dirs
 *   6. Pieza tipo NIST      → ~8 dirs
 */

// ── Minimal vec3 math ──
function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function len(a) { return Math.sqrt(a[0]*a[0] + a[1]*a[1] + a[2]*a[2]); }
function norm(a) { const l = len(a); return l < 1e-15 ? [0,0,0] : [a[0]/l, a[1]/l, a[2]/l]; }
function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function scale(a, s) { return [a[0]*s, a[1]*s, a[2]*s]; }
function add(a, b) { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
function negate(a) { return [-a[0], -a[1], -a[2]]; }

// ═══════════════════════════════════════════════════════
// Geometry Builders — raw triangle arrays
// ═══════════════════════════════════════════════════════

/** Create a quad (2 triangles) from 4 corners (CCW winding) */
function quad(a, b, c, d) {
  return [
    { verts: [a, b, c] },
    { verts: [a, c, d] },
  ];
}

/** Box: 12 triangles, 6 faces, 3 unique normal directions */
function makeBox(sx, sy, sz, ox = 0, oy = 0, oz = 0) {
  const x0 = ox, y0 = oy, z0 = oz;
  const x1 = ox + sx, y1 = oy + sy, z1 = oz + sz;
  const tris = [];
  // +Z face
  tris.push(...quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]));
  // -Z face
  tris.push(...quad([x0,y1,z0],[x1,y1,z0],[x1,y0,z0],[x0,y0,z0]));
  // +Y face
  tris.push(...quad([x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0]));
  // -Y face
  tris.push(...quad([x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[x0,y0,z0]));
  // +X face
  tris.push(...quad([x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]));
  // -X face
  tris.push(...quad([x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[x0,y0,z0]));
  return tris;
}

/** Cylinder approximation: n-sided prism along Y axis */
function makeCylinder(r, h, segs, cx = 0, cy = 0, cz = 0) {
  const tris = [];
  for (let i = 0; i < segs; i++) {
    const a0 = (2 * Math.PI * i) / segs;
    const a1 = (2 * Math.PI * (i + 1)) / segs;
    const c0 = Math.cos(a0), s0 = Math.sin(a0);
    const c1 = Math.cos(a1), s1 = Math.sin(a1);
    const p0b = [cx + r*c0, cy,     cz + r*s0];
    const p1b = [cx + r*c1, cy,     cz + r*s1];
    const p0t = [cx + r*c0, cy + h, cz + r*s0];
    const p1t = [cx + r*c1, cy + h, cz + r*s1];
    // Side wall (2 tris per segment)
    tris.push({ verts: [p0b, p1b, p1t] });
    tris.push({ verts: [p0b, p1t, p0t] });
    // Top cap
    tris.push({ verts: [[cx, cy+h, cz], p0t, p1t] });
    // Bottom cap
    tris.push({ verts: [[cx, cy, cz], p1b, p0b] });
  }
  return tris;
}

/** Chamfer: a flat angled face cutting a box corner along Z edge */
function makeChamferZ(sx, sy, sz, chamSize, ox = 0, oy = 0, oz = 0) {
  // Start with a box, then replace the +X+Y corner with an angled face
  const tris = makeBox(sx, sy, sz, ox, oy, oz);
  
  // Add the 45° chamfer face (cuts the +X+Y corner along the Z length)
  const cx = ox + sx - chamSize; // where chamfer starts on X
  const cy = oy + sy - chamSize; // where chamfer starts on Y
  const x1 = ox + sx, y1 = oy + sy;
  const z0 = oz, z1 = oz + sz;
  
  // Chamfer face: from (x1, cy, z) to (cx, y1, z) — this is a 45° face
  tris.push(...quad(
    [x1, cy, z0], [x1, cy, z1], [cx, y1, z1], [cx, y1, z0]
  ));
  // Fill the gap faces (top side of chamfer)
  tris.push(...quad(
    [cx, y1, z0], [cx, y1, z1], [ox, y1, z1], [ox, y1, z0]
  ));
  // Fill the R side
  tris.push(...quad(
    [x1, oy, z0], [x1, oy, z1], [x1, cy, z1], [x1, cy, z0]
  ));
  
  return tris;
}

/** L-shaped profile extruded along Z — has 3 axis directions */
function makeLShape(w, h, t, depth) {
  const tris = [];
  // Bottom horizontal bar: box(w, t, depth)
  tris.push(...makeBox(w, t, depth, 0, 0, 0));
  // Left vertical bar: box(t, h-t, depth) sitting on top of bottom bar
  tris.push(...makeBox(t, h - t, depth, 0, t, 0));
  return tris;
}

/**
 * Hexagonal pocket in a plate:
 * Plate is a box, pocket is a 6-sided hole with 6 angled directions.
 * Total: 3 axis + 3 hex normals = 6 directions
 */
function makeHexPocketPlate(pw, ph, pt, hexR, hexDepth) {
  const tris = [];
  // Base plate
  tris.push(...makeBox(pw, pt, ph, 0, 0, 0));
  
  // Hex pocket walls (6 sides)
  const cx = pw / 2, cz = ph / 2;
  const y0 = pt - hexDepth, y1 = pt;
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    const a0 = (2 * Math.PI * i) / segs;
    const a1 = (2 * Math.PI * (i + 1)) / segs;
    const c0 = Math.cos(a0), s0 = Math.sin(a0);
    const c1 = Math.cos(a1), s1 = Math.sin(a1);
    const p0b = [cx + hexR*c0, y0, cz + hexR*s0];
    const p1b = [cx + hexR*c1, y0, cz + hexR*s1];
    const p0t = [cx + hexR*c0, y1, cz + hexR*s0];
    const p1t = [cx + hexR*c1, y1, cz + hexR*s1];
    // Wall faces (pointing inward)
    tris.push(...quad(p0b, p0t, p1t, p1b));
    // Bottom of pocket
    tris.push({ verts: [[cx, y0, cz], p1b, p0b] });
  }
  
  return tris;
}

/**
 * NIST-style part: box + chamfer + angled pocket + through hole
 * Should have: 3 axis + 1 chamfer + 2 pocket angles = ~6 planar directions
 */
function makeNistStylePart() {
  const tris = [];
  // Main body: 100×60×30
  tris.push(...makeBox(100, 30, 60, 0, 0, 0));
  
  // 45° chamfer on top-right edge (along Z)
  tris.push(...quad(
    [100, 20, 0], [100, 20, 60], [90, 30, 60], [90, 30, 0]
  ));
  
  // Angled pocket walls (30° from vertical on both sides)
  const a = 30 * Math.PI / 180;
  const ca = Math.cos(a), sa = Math.sin(a);
  // Left wall of pocket at 30°
  tris.push(...quad(
    [20,       10, 15],
    [20,       10, 45],
    [20+10*sa, 30, 45],
    [20+10*sa, 30, 15],
  ));
  // Right wall of pocket at -30°
  tris.push(...quad(
    [80-10*sa, 30, 15],
    [80-10*sa, 30, 45],
    [80,       10, 45],
    [80,       10, 15],
  ));
  
  // Through hole (cylinder, 36 segments) — should be filtered as noise
  tris.push(...makeCylinder(8, 30, 36, 50, 0, 30));
  
  return tris;
}

// ═══════════════════════════════════════════════════════
// Convert triangle list → face data for detectPlanarDirections
// ═══════════════════════════════════════════════════════

function trisToFaces(tris) {
  const faces = [];
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  
  for (const tri of tris) {
    const [va, vb, vc] = tri.verts;
    const ab = sub(vb, va);
    const ac = sub(vc, va);
    const n = cross(ab, ac);
    const area2 = len(n);
    if (area2 < 1e-12) continue;
    
    const normal = norm(n);
    const center = [(va[0]+vb[0]+vc[0])/3, (va[1]+vb[1]+vc[1])/3, (va[2]+vb[2]+vc[2])/3];
    faces.push({ normal, center, area: area2 * 0.5 });
    
    for (const v of [va, vb, vc]) {
      if (v[0] < minX) minX = v[0];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
      if (v[2] < minZ) minZ = v[2];
      if (v[2] > maxZ) maxZ = v[2];
    }
  }
  
  const bb = { min: [minX,minY,minZ], max: [maxX,maxY,maxZ] };
  const size = sub(bb.max, bb.min);
  const diag = len(size);
  
  return { faces, bb, size, diag };
}

// ═══════════════════════════════════════════════════════
// Exact port of detectPlanarDirections (same as geometry-planes-test.cjs)
// ═══════════════════════════════════════════════════════

function detectPlanarDirections(faces, bb) {
  if (faces.length === 0) return [];

  const totalArea = faces.reduce((s, f) => s + f.area, 0);
  const COS_2DEG = Math.cos(2 * Math.PI / 180);

  const tightClusters = [];

  for (const f of faces) {
    let best = null;
    let bestDot = -Infinity;
    for (const cl of tightClusters) {
      const d = Math.abs(dot(f.normal, cl.normal));
      if (d > COS_2DEG && d > bestDot) { bestDot = d; best = cl; }
    }
    const fOff = dot(f.center, f.normal);
    if (best) {
      if (dot(f.normal, best.normal) < 0) f.normal = negate(f.normal);
      const t = best.area + f.area;
      const wOld = best.area / t;
      const wNew = f.area / t;
      best.normal = norm(add(scale(best.normal, wOld), scale(f.normal, wNew)));
      best.area = t;
      best.faceCount++;
      best.offsets.push(fOff);
    } else {
      tightClusters.push({
        normal: [...f.normal], area: f.area, faceCount: 1, offsets: [fOff],
      });
    }
  }

  const MIN_FACES = 4;
  const MIN_AREA_FRAC = 0.001;
  const planarClusters = tightClusters.filter(
    cl => cl.faceCount >= MIN_FACES || cl.area > totalArea * MIN_AREA_FRAC,
  );

  // Sort by area so largest anchors
  const COS_5DEG = Math.cos(5 * Math.PI / 180);
  planarClusters.sort((a, b) => b.area - a.area);
  const merged = [];

  for (const cl of planarClusters) {
    let target = null;
    for (const m of merged) {
      if (Math.abs(dot(cl.normal, m.anchor)) > COS_5DEG) { target = m; break; }
    }
    if (target) {
      if (dot(cl.normal, target.anchor) < 0) cl.normal = negate(cl.normal);
      const t = target.area + cl.area;
      const wOld = target.area / t;
      const wNew = cl.area / t;
      target.normal = norm(add(scale(target.normal, wOld), scale(cl.normal, wNew)));
      target.area = t;
      target.faceCount += cl.faceCount;
      target.offsets.push(...cl.offsets);
    } else {
      merged.push({
        normal: [...cl.normal],
        anchor: [...cl.normal],
        area: cl.area,
        faceCount: cl.faceCount,
        offsets: [...cl.offsets],
      });
    }
  }

  // Ensure axis directions always present
  const axisVecs = [[1,0,0], [0,1,0], [0,0,1]];
  const bbCenter = scale(add(bb.min, bb.max), 0.5);
  for (const av of axisVecs) {
    const hasAxis = merged.some(m => Math.abs(dot(m.normal, av)) > COS_5DEG);
    if (!hasAxis) {
      merged.push({
        normal: [...av], anchor: [...av],
        area: 0, faceCount: 0, offsets: [dot(bbCenter, av)],
      });
    }
  }

  merged.sort((a, b) => b.area - a.area);

  const COS_10DEG = 0.985;
  return merged.map(cl => {
    const n = [...cl.normal];
    if (n[0] + n[1] + n[2] < 0) { n[0] = -n[0]; n[1] = -n[1]; n[2] = -n[2]; }

    const sorted = cl.offsets.sort((a, b) => a - b);
    const minOff = sorted[0];
    const maxOff = sorted[sorted.length - 1];

    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
    const isAxis = ax > COS_10DEG || ay > COS_10DEG || az > COS_10DEG;
    let label;
    if (ax > COS_10DEG) label = n[0] > 0 ? '+X' : '-X';
    else if (ay > COS_10DEG) label = n[1] > 0 ? '+Y' : '-Y';
    else if (az > COS_10DEG) label = n[2] > 0 ? '+Z' : '-Z';
    else {
      const pitch = Math.asin(Math.max(-1, Math.min(1, n[1]))) * 180 / Math.PI;
      const yaw = Math.atan2(n[0], n[2]) * 180 / Math.PI;
      label = `∠${Math.round(pitch)}°/${Math.round(yaw)}°`;
    }

    return {
      normal: n, area: cl.area,
      areaPct: totalArea > 0 ? (cl.area / totalArea) * 100 : 0,
      faceCount: cl.faceCount,
      offsetRange: [minOff, maxOff],
      label, isAxis,
    };
  });
}

// Exact port of generateGeometryPlanes
function generateGeometryPlanes(directions, diag) {
  const maxDepthSlices = 10;
  const minAreaPct = 0.1;
  const minSpacing = diag * 0.01;
  const planes = [];

  for (const dir of directions) {
    if (!dir.isAxis && dir.areaPct < minAreaPct) continue;
    const [minOff, maxOff] = dir.offsetRange;
    const range = maxOff - minOff;

    if (range < minSpacing) {
      planes.push({ normal: dir.normal, offset: (minOff + maxOff) / 2, label: dir.label });
      continue;
    }

    const idealSlices = Math.ceil(range / minSpacing);
    const numSlices = Math.min(maxDepthSlices, Math.max(2, idealSlices));
    const margin = range * 0.02;
    const lo = minOff + margin;
    const hi = maxOff - margin;

    for (let i = 0; i < numSlices; i++) {
      const t = numSlices === 1 ? 0.5 : i / (numSlices - 1);
      planes.push({
        normal: dir.normal,
        offset: lo + (hi - lo) * t,
        label: `${dir.label} d${i + 1}/${numSlices}`,
      });
    }
  }
  return planes;
}

// ═══════════════════════════════════════════════════════
// Test Runner
// ═══════════════════════════════════════════════════════

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const BOLD = '\x1b[1m';
const DIM  = '\x1b[2m';
const RST  = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const CYAN  = '\x1b[36m';
const YELLOW = '\x1b[33m';

let totalTests = 0;
let passed = 0;

function assert(ok, msg) {
  totalTests++;
  if (ok) { passed++; console.log(`    ${PASS} ${msg}`); }
  else { console.log(`    ${FAIL} ${msg}`); }
  return ok;
}

function assertExact(val, expected, msg) {
  return assert(val === expected, `${msg}: expected ${expected}, got ${val}`);
}

function assertRange(val, min, max, msg) {
  return assert(val >= min && val <= max, `${msg}: expected ${min}-${max}, got ${val}`);
}

function hasDirection(dirs, nx, ny, nz, tolDeg = 10) {
  const cosT = Math.cos(tolDeg * Math.PI / 180);
  return dirs.some(d => Math.abs(dot(d.normal, [nx, ny, nz])) > cosT);
}

function runTest(name, tris, checks) {
  console.log(`\n  ${BOLD}${CYAN}═══ ${name} ═══${RST}`);
  
  const { faces, bb, size, diag } = trisToFaces(tris);
  const dirs = detectPlanarDirections(faces, bb);
  const planes = generateGeometryPlanes(dirs, diag);
  
  console.log(`    ${DIM}${faces.length} tris | ${size.map(v => v.toFixed(1)).join('×')} | diag=${diag.toFixed(1)}${RST}`);
  console.log(`    ${YELLOW}Directions: ${dirs.length} (${dirs.filter(d=>d.isAxis).length} axis + ${dirs.filter(d=>!d.isAxis).length} angled)${RST}`);
  console.log(`    ${YELLOW}Total planes: ${planes.length}${RST}`);
  
  // Print all directions (should be small for synthetic)
  for (let i = 0; i < dirs.length; i++) {
    const d = dirs[i];
    const slices = planes.filter(p => Math.abs(dot(p.normal, d.normal)) > 0.99).length;
    console.log(`    ${DIM}  ${String(i+1).padStart(2)}. ${d.label.padEnd(14)} ${d.faceCount.toString().padStart(4)} faces  ${d.areaPct.toFixed(1).padStart(5)}% → ${slices} slices${RST}`);
  }
  
  // Run checks
  checks(dirs, planes, faces);
  
  // Check no dupes within 5°
  let dupes = 0;
  for (let i = 0; i < dirs.length; i++) {
    for (let j = i + 1; j < dirs.length; j++) {
      if (Math.abs(dot(dirs[i].normal, dirs[j].normal)) > Math.cos(5 * Math.PI / 180)) dupes++;
    }
  }
  assert(dupes === 0, `No duplicate normals within 5° (found ${dupes})`);
  
  // Every direction with enough area should have slices
  const filtered = dirs.filter(d => d.isAxis || d.areaPct >= 0.1);
  const withSlices = new Set();
  for (const p of planes) {
    for (const d of filtered) {
      if (Math.abs(dot(p.normal, d.normal)) > 0.99) { withSlices.add(d.label); break; }
    }
  }
  assert(withSlices.size === filtered.length,
    `All ${filtered.length} filtered dirs have slices (got ${withSlices.size})`);
}

// ═══════════════════════════════════════════════════════
// TEST CASES
// ═══════════════════════════════════════════════════════

console.log(`${BOLD}${GREEN}${'═'.repeat(60)}${RST}`);
console.log(`${BOLD}${GREEN}⚒️  SYNTHETIC GEOMETRY — Exact Plane Count Validation${RST}`);
console.log(`${BOLD}${GREEN}${'═'.repeat(60)}${RST}`);

// ── TEST 1: Simple Box ──
runTest('1. Cubo simple (100×60×30)', makeBox(100, 60, 30), (dirs, planes) => {
  assertExact(dirs.length, 3, 'Exactly 3 directions (X, Y, Z)');
  assert(hasDirection(dirs, 1, 0, 0), 'Has X direction');
  assert(hasDirection(dirs, 0, 1, 0), 'Has Y direction');
  assert(hasDirection(dirs, 0, 0, 1), 'Has Z direction');
  assert(dirs.every(d => d.isAxis), 'All directions are axis-aligned');
  assert(planes.length > 0 && planes.length < 462, `Planes reasonable (got ${planes.length})`);
});

// ── TEST 2: Box with through hole (cylinder should be filtered) ──
const boxWithHole = [
  ...makeBox(100, 60, 30),
  ...makeCylinder(10, 60, 36, 50, 0, 15), // through hole Y-axis, 36 segments
];
runTest('2. Cubo con agujero pasante (36 seg)', boxWithHole, (dirs, planes) => {
  assertExact(dirs.length, 3, 'Still 3 directions (cylinder noise filtered)');
  assert(hasDirection(dirs, 1, 0, 0), 'Has X direction');
  assert(hasDirection(dirs, 0, 1, 0), 'Has Y direction');
  assert(hasDirection(dirs, 0, 0, 1), 'Has Z direction');
  const angledCount = dirs.filter(d => !d.isAxis).length;
  assertExact(angledCount, 0, 'No angled directions (all cylinder noise)');
});

// ── TEST 3: Box with 45° chamfer ──
const boxChamfer = makeChamferZ(100, 60, 80, 15);
runTest('3. Cubo con chamfer 45°', boxChamfer, (dirs, planes) => {
  // Should have X, Y, Z + one 45° direction
  assertRange(dirs.length, 3, 5, 'Directions between 3-5');
  assert(hasDirection(dirs, 1, 0, 0), 'Has X direction');
  assert(hasDirection(dirs, 0, 1, 0), 'Has Y direction');
  assert(hasDirection(dirs, 0, 0, 1), 'Has Z direction');
  // 45° chamfer normal ≈ (-0.707, 0.707, 0) or similar
  const s = Math.SQRT1_2;
  const hasChamfer = hasDirection(dirs, -s, s, 0, 15) || hasDirection(dirs, s, -s, 0, 15);
  assert(hasChamfer, 'Has ~45° chamfer direction');
});

// ── TEST 4: L-shape (only axis-aligned faces) ──
runTest('4. Perfil L (solo caras axiales)', makeLShape(80, 60, 15, 50), (dirs) => {
  assertExact(dirs.length, 3, 'Exactly 3 directions (all axis-aligned)');
  assert(dirs.every(d => d.isAxis), 'All directions are axis-aligned');
});

// ── TEST 5: Hexagonal pocket plate ──
runTest('5. Placa con pocket hexagonal', makeHexPocketPlate(120, 80, 20, 25, 10), (dirs) => {
  // Hex pocket has 6 sides → 3 unique normal pairs (opposing sides parallel)
  // Plus 3 axis from the plate = 3 axis + 3 hex = 6 directions
  assert(hasDirection(dirs, 1, 0, 0), 'Has X');
  assert(hasDirection(dirs, 0, 1, 0), 'Has Y');
  assert(hasDirection(dirs, 0, 0, 1), 'Has Z');
  const angledDirs = dirs.filter(d => !d.isAxis);
  assertRange(angledDirs.length, 2, 4, 'Hex pocket creates 2-4 angled directions');
  assertRange(dirs.length, 5, 7, 'Total 5-7 directions');
});

// ── TEST 6: NIST-style complex part ──
runTest('6. Pieza tipo NIST (chamfer + pocket angulado + agujero)', makeNistStylePart(), (dirs) => {
  assert(hasDirection(dirs, 1, 0, 0), 'Has X');
  assert(hasDirection(dirs, 0, 1, 0), 'Has Y');
  assert(hasDirection(dirs, 0, 0, 1), 'Has Z');
  
  // 45° chamfer + 2 angled pocket walls + cylinder (filtered)
  const angledDirs = dirs.filter(d => !d.isAxis);
  assertRange(angledDirs.length, 1, 5, 'Has 1-5 angled directions');
  assertRange(dirs.length, 4, 8, 'Total 4-8 directions');
  
  // Cylinder (36 segments) should NOT create 36 directions
  assert(dirs.length < 20, `Not flooded by cylinder noise (got ${dirs.length})`);
});

// ── TEST 7: Verify planes scaling ──
console.log(`\n  ${BOLD}${CYAN}═══ 7. Verificación de escalado ═══${RST}`);

const simple = trisToFaces(makeBox(100, 60, 30));
const simpleDirs = detectPlanarDirections(simple.faces, simple.bb);
const simplePlanes = generateGeometryPlanes(simpleDirs, simple.diag);

const complex = trisToFaces(makeNistStylePart());
const complexDirs = detectPlanarDirections(complex.faces, complex.bb);
const complexPlanes = generateGeometryPlanes(complexDirs, complex.diag);

console.log(`    ${DIM}Simple box: ${simpleDirs.length} dirs → ${simplePlanes.length} planes${RST}`);
console.log(`    ${DIM}Complex part: ${complexDirs.length} dirs → ${complexPlanes.length} planes${RST}`);

assert(complexPlanes.length > simplePlanes.length,
  `Complex part gets MORE planes than simple (${complexPlanes.length} > ${simplePlanes.length})`);
assert(simplePlanes.length < 50, `Simple box: very few planes (${simplePlanes.length})`);

// ═══════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════

console.log(`\n${BOLD}${GREEN}${'═'.repeat(60)}${RST}`);
console.log(`${BOLD}  Tests: ${passed}/${totalTests} passed${RST}`);
if (passed === totalTests) {
  console.log(`${BOLD}${GREEN}  ✅ ALL TESTS PASSED${RST}`);
} else {
  console.log(`${BOLD}${RED}  ❌ ${totalTests - passed} TESTS FAILED${RST}`);
  // List failures
}
console.log(`${BOLD}${GREEN}${'═'.repeat(60)}${RST}\n`);

process.exit(passed === totalTests ? 0 : 1);
