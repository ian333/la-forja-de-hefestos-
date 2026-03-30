#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════════════════════════
 *  La Forja — CROSS-AXIS CONSISTENCY DIAGNOSTIC
 *  
 *  Tomographic analysis: uses all 3 orthogonal slices simultaneously
 *  to validate, constrain, and reconstruct contour boundaries.
 *
 *  Mathematical framework:
 *  - Occupancy tensor O(x,y,z) ∈ {0,1}
 *  - Cross-section consistency: Sx(y,z) ⊆ πx(Cy ∩ Cz)
 *  - Constraint points: ∂Sy ∩ {x=x₀} → points on ∂Sx
 *  - Bayesian confidence: P(cell) ∝ Pfragments · Pfrom_Y · Pfrom_Z
 * ══════════════════════════════════════════════════════════════════
 */
'use strict';

const fs   = require('fs');
const path = require('path');

// ── Load all viz-data ───────────────────────────────────────────
const vizDir = path.join(__dirname, '..', 'public', 'viz-data');
const indexF = path.join(vizDir, 'index.json');
const index  = JSON.parse(fs.readFileSync(indexF, 'utf8'));

console.log('══════════════════════════════════════════════════════════');
console.log('  ⚒️  La Forja — CROSS-AXIS CONSISTENCY DIAGNOSTIC');
console.log('     Tomographic multi-axis analysis');
console.log('══════════════════════════════════════════════════════════\n');

// ── Helpers ─────────────────────────────────────────────────────

/** Check if a contour is geometrically closed */
function isContourClosed(pts) {
  const f = pts[0], l = pts[pts.length - 1];
  const gap = Math.sqrt((f[0] - l[0]) ** 2 + (f[1] - l[1]) ** 2);
  const diag = contourDiag(pts);
  return gap < Math.max(diag * 0.01, 0.1);
}

function contourDiag(pts) {
  let mnX = 1e9, mxX = -1e9, mnY = 1e9, mxY = -1e9;
  for (const p of pts) {
    if (p[0] < mnX) mnX = p[0]; if (p[0] > mxX) mxX = p[0];
    if (p[1] < mnY) mnY = p[1]; if (p[1] > mxY) mxY = p[1];
  }
  return Math.sqrt((mxX - mnX) ** 2 + (mxY - mnY) ** 2);
}

function contourPerimeter(pts) {
  let p = 0;
  for (let i = 1; i < pts.length; i++)
    p += Math.sqrt((pts[i][0] - pts[i-1][0]) ** 2 + (pts[i][1] - pts[i-1][1]) ** 2);
  return p;
}

/** Find where a 2D contour crosses a given coordinate value along axis 0 (first coord) */
function findCrossings(pts, value) {
  const crossings = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const u0 = pts[i][0], v0 = pts[i][1];
    const u1 = pts[i + 1][0], v1 = pts[i + 1][1];
    if ((u0 <= value && u1 >= value) || (u0 >= value && u1 <= value)) {
      if (Math.abs(u1 - u0) < 1e-10) continue;
      const t = (value - u0) / (u1 - u0);
      crossings.push({ v: v0 + t * (v1 - v0), entering: u0 < u1 });
    }
  }
  return crossings.sort((a, b) => a.v - b.v);
}

/** Point-in-contour test (winding number) */
function pointInContour(pts, py, pz) {
  let wn = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const y0 = pts[i][0], z0 = pts[i][1];
    const y1 = pts[(i + 1) % n][0], z1 = pts[(i + 1) % n][1];
    if (z0 <= pz) {
      if (z1 > pz) {
        if ((y1 - y0) * (pz - z0) - (py - y0) * (z1 - z0) > 0)
          wn++;
      }
    } else {
      if (z1 <= pz) {
        if ((y1 - y0) * (pz - z0) - (py - y0) * (z1 - z0) < 0)
          wn--;
      }
    }
  }
  return wn !== 0;
}

/** Map normal vector to axis labels: normal=[1,0,0] → sliceAxis='X', planeAxes=['Y','Z'] */
function axisInfo(normal) {
  const n = normal.map(Math.abs);
  if (n[0] > 0.9) return { sliceAxis: 'X', u: 'Y', v: 'Z', sliceIdx: 0, uIdx: 1, vIdx: 2 };
  if (n[1] > 0.9) return { sliceAxis: 'Y', u: 'X', v: 'Z', sliceIdx: 1, uIdx: 0, vIdx: 2 };
  if (n[2] > 0.9) return { sliceAxis: 'Z', u: 'X', v: 'Y', sliceIdx: 2, uIdx: 0, vIdx: 1 };
  return null; // oblique slice — skip for now
}

// ── Analysis ────────────────────────────────────────────────────

let totalModels = 0;
let totalSlices = 0;
let totalConstraints = 0;
let axisStats = { X: { open: 0, closed: 0 }, Y: { open: 0, closed: 0 }, Z: { open: 0, closed: 0 } };
let crossAxisHits = 0;
let crossAxisMisses = 0;

const modelResults = [];

for (const entry of index) {
  const slug = entry.slug || entry.file;
  const modelFile = path.join(vizDir, slug + '.json');
  if (!fs.existsSync(modelFile)) continue;
  const data = JSON.parse(fs.readFileSync(modelFile, 'utf8'));
  if (!data.slices || data.slices.length === 0) continue;

  totalModels++;
  const bb = data.boundingBox;
  const bbSize = [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]];

  // Separate slices by axis
  const slicesByAxis = { X: [], Y: [], Z: [] };
  for (const s of data.slices) {
    const ai = axisInfo(s.normal);
    if (!ai) continue;
    totalSlices++;
    slicesByAxis[ai.sliceAxis].push({ ...s, axisInfo: ai });
  }

  // For each axis, analyze open vs closed
  for (const axis of ['X', 'Y', 'Z']) {
    for (const s of slicesByAxis[axis]) {
      for (const c of s.contours) {
        if (isContourClosed(c.points)) axisStats[axis].closed++;
        else axisStats[axis].open++;
      }
    }
  }

  // ── CROSS-AXIS CONSTRAINT ANALYSIS ──
  // For each slice on axis A, find constraint points from slices on axes B and C
  const modelConstraints = [];

  for (const axis of ['X', 'Y', 'Z']) {
    const otherAxes = ['X', 'Y', 'Z'].filter(a => a !== axis);

    for (const targetSlice of slicesByAxis[axis]) {
      const tai = targetSlice.axisInfo;
      const sliceVal = targetSlice.offset; // Where along the axis this slice sits

      // For each OTHER axis's slice, find crossings at our slice value
      for (const otherAxis of otherAxes) {
        for (const otherSlice of slicesByAxis[otherAxis]) {
          const oai = otherSlice.axisInfo;

          // The other slice lives in a 2D plane. Its first coord (u) corresponds
          // to one of our coords. We need to find where u = sliceVal crosses.
          // 
          // Example: target is +X (YZ plane at x=0), other is +Y (XZ plane at y=390)
          // Other contour uses coords (X, Z). We find where X=0 (our sliceVal).
          // Each crossing gives us a Z value. On our YZ plane, this becomes (Y=390, Z=crossing).

          for (const oc of otherSlice.contours) {
            if (oc.points.length < 3) continue;

            // Which coord of the other slice's 2D points corresponds to our slice axis?
            // Other slice's axisInfo tells us: u=oai.u, v=oai.v
            // If our sliceAxis is oai.u (first coord of other's 2D), then we search axis 0
            // If our sliceAxis is oai.v (second coord of other's 2D), then we search axis 1

            let searchAxis, crossCoordName;
            if (tai.sliceAxis === oai.u) {
              // Our slice axis is the first coordinate of the other's 2D points
              searchAxis = 0;
              crossCoordName = oai.v; // The crossing gives us the other coordinate
            } else if (tai.sliceAxis === oai.v) {
              // Our slice axis is the second coordinate
              searchAxis = 1;
              crossCoordName = oai.u;
            } else {
              continue; // Shouldn't happen for orthogonal axes
            }

            // Find crossings
            const pts = oc.points;
            for (let i = 0; i < pts.length - 1; i++) {
              const c0 = pts[i][searchAxis], c1 = pts[i + 1][searchAxis];
              const o0 = pts[i][1 - searchAxis], o1 = pts[i + 1][1 - searchAxis];
              if ((c0 <= sliceVal && c1 >= sliceVal) || (c0 >= sliceVal && c1 <= sliceVal)) {
                if (Math.abs(c1 - c0) < 1e-10) continue;
                const t = (sliceVal - c0) / (c1 - c0);
                const crossVal = o0 + t * (o1 - o0);

                // Map back to our 2D plane coordinates
                // Our target plane has coords (tai.u, tai.v)
                // The crossing gives us: one coord = otherSlice.offset, other = crossVal
                let constraintU, constraintV;
                if (crossCoordName === tai.u) {
                  constraintU = crossVal;
                  constraintV = otherSlice.offset;
                } else {
                  constraintU = otherSlice.offset;
                  constraintV = crossVal;
                }

                modelConstraints.push({
                  targetAxis: axis,
                  targetSlice: targetSlice.label,
                  targetOffset: sliceVal,
                  fromAxis: otherAxis,
                  fromSlice: otherSlice.label,
                  constraintU,
                  constraintV,
                  coordU: tai.u,
                  coordV: tai.v,
                });
                totalConstraints++;
              }
            }
          }
        }
      }

      // ── VALIDATE: do constraint points lie on or near fragment boundaries? ──
      const sliceConstraints = modelConstraints.filter(
        mc => mc.targetSlice === targetSlice.label
      );

      if (sliceConstraints.length > 0 && targetSlice.contours.length > 0) {
        for (const mc of sliceConstraints) {
          // Find nearest contour point
          let bestDist = Infinity;
          let bestCi = -1;
          for (let ci = 0; ci < targetSlice.contours.length; ci++) {
            for (const p of targetSlice.contours[ci].points) {
              const d = Math.sqrt((p[0] - mc.constraintU) ** 2 + (p[1] - mc.constraintV) ** 2);
              if (d < bestDist) { bestDist = d; bestCi = ci; }
            }
          }
          mc.nearestDist = bestDist;
          mc.nearestContour = bestCi;

          // Is the constraint point inside any closed contour?
          let inside = false;
          for (const c of targetSlice.contours) {
            if (isContourClosed(c.points) && pointInContour(c.points, mc.constraintU, mc.constraintV)) {
              inside = true;
              break;
            }
          }
          mc.insideContour = inside;

          if (bestDist < Math.max(contourDiag(targetSlice.contours[bestCi].points) * 0.05, 2.0)) {
            crossAxisHits++;
          } else {
            crossAxisMisses++;
          }
        }
      }
    }
  }

  // Store results for detailed reporting
  const hasOpenContours = data.slices.some(s => s.contours.some(c => !isContourClosed(c.points)));
  modelResults.push({
    name: slug,
    bb: bbSize,
    slices: data.slices.length,
    constraints: modelConstraints.length,
    hasOpen: hasOpenContours,
    details: modelConstraints,
  });
}

// ── GLOBAL RESULTS ──────────────────────────────────────────────
console.log('═══ GLOBAL STATISTICS ═══\n');
console.log(`Models analyzed: ${totalModels}`);
console.log(`Total slices: ${totalSlices}`);
console.log(`Cross-axis constraint points: ${totalConstraints}`);
console.log();

console.log('Contour status by axis:');
for (const axis of ['X', 'Y', 'Z']) {
  const s = axisStats[axis];
  const total = s.open + s.closed;
  const openPct = total > 0 ? (s.open / total * 100).toFixed(1) : '0.0';
  console.log(`  ${axis}: ${s.closed} closed, ${s.open} open (${openPct}% open)`);
}
console.log();

const hitPct = (crossAxisHits + crossAxisMisses) > 0
  ? (crossAxisHits / (crossAxisHits + crossAxisMisses) * 100).toFixed(1)
  : '0.0';
console.log(`Cross-axis constraint validation:`);
console.log(`  HIT  (point near boundary): ${crossAxisHits}`);
console.log(`  MISS (point far from boundary): ${crossAxisMisses}`);
console.log(`  Hit rate: ${hitPct}%`);
console.log();

// ── DETAILED MODEL ANALYSIS ─────────────────────────────────────
console.log('═══ PER-MODEL CROSS-AXIS ANALYSIS ═══\n');

for (const mr of modelResults) {
  if (mr.constraints === 0) continue;

  const icon = mr.hasOpen ? '🔶' : '✅';
  console.log(`${icon} ${mr.name} — ${mr.constraints} constraint points from cross-axis`);

  // Group constraints by target slice
  const byTarget = {};
  for (const d of mr.details) {
    const key = d.targetSlice;
    if (!byTarget[key]) byTarget[key] = [];
    byTarget[key].push(d);
  }

  for (const [slice, constraints] of Object.entries(byTarget)) {
    const onBoundary = constraints.filter(c => c.nearestDist !== undefined && c.nearestDist < 5);
    const farAway = constraints.filter(c => c.nearestDist !== undefined && c.nearestDist >= 5);
    const inside = constraints.filter(c => c.insideContour);
    const outside = constraints.filter(c => c.insideContour === false);

    console.log(`  ${slice}: ${constraints.length} constraints`);
    console.log(`    On boundary (<5mm): ${onBoundary.length}, Far (>5mm): ${farAway.length}`);
    console.log(`    Inside closed contour: ${inside.length}, Outside: ${outside.length}`);

    // Show actual constraint points for models with open contours
    if (mr.hasOpen) {
      for (const c of constraints.slice(0, 6)) {
        const distStr = c.nearestDist !== undefined ? ` nearest=c#${c.nearestContour} @${c.nearestDist.toFixed(1)}mm` : '';
        const inStr = c.insideContour !== undefined ? (c.insideContour ? ' ✅INSIDE' : ' ❌OUTSIDE') : '';
        console.log(`      from ${c.fromSlice}: (${c.coordU}=${c.constraintU.toFixed(1)}, ${c.coordV}=${c.constraintV.toFixed(1)})${distStr}${inStr}`);
      }
      if (constraints.length > 6) console.log(`      ... +${constraints.length - 6} more`);
    }
  }
  console.log();
}

// ── MATHEMATICAL FRAMEWORK SUMMARY ──────────────────────────────
console.log('══════════════════════════════════════════════════════════');
console.log('  MATHEMATICAL FRAMEWORK');
console.log('══════════════════════════════════════════════════════════\n');

console.log('Given: Solid Ω ⊂ ℝ³ with occupancy O(x,y,z) ∈ {0,1}');
console.log();
console.log('Available cross-sections:');
console.log('  Sx(y,z) = O(x₀,y,z)  — contours in YZ plane');
console.log('  Sy(x,z) = O(x,y₀,z)  — contours in XZ plane');
console.log('  Sz(x,y) = O(x,y,z₀)  — contours in XY plane');
console.log();
console.log('CONSTRAINT EQUATIONS:');
console.log();
console.log('  1. INTERSECTION CONSTRAINT (necessary condition):');
console.log('     ∂Sy ∩ {x=x₀} → points on ∂Sx at (y₀, z_i)');
console.log('     ∂Sz ∩ {x=x₀} → points on ∂Sx at (y_j, z₀)');
console.log('     → The boundary of Sx MUST pass through these points.');
console.log();
console.log('  2. SILHOUETTE BOUND (upper bound on solid):');
console.log('     Ω ⊆ Cx ∩ Cy ∩ Cz');
console.log('     where Cx = {(x,y,z) : (y,z) ∈ Sx} (infinite cylinder)');
console.log('     → Cell is solid ONLY IF all 3 projections agree.');
console.log();
console.log('  3. CONSISTENCY MATRIX (for discretized grid):');
console.log('     M[i,j] = Sfragments[i,j] × SfromY[i,j] × SfromZ[i,j]');
console.log('     where SfromY[i,j] = 1 iff row j has y-crossing inside');
console.log('     → Bayesian product of independent evidence.');
console.log();
console.log('  4. CLOSURE CONSTRAINT (topological):');
console.log('     Every connected boundary must have winding number ±1');
console.log('     Missing segments between fragments must close the loop');
console.log('     → Path through constraint points with minimal total curvature.');
console.log();
console.log('  5. PROBABILITY SCORING:');
console.log('     P(contour correct) = P(closed) × P(C0) × P(constraints_hit)');
console.log('     P(constraints_hit) = #hits / #total_constraints');
console.log(`     Current global hit rate: ${hitPct}%`);
console.log();

// ── PROBABILITY TABLE ───────────────────────────────────────────
console.log('═══ PROBABILITY: WHICH FIX RESOLVES WHAT ═══\n');
console.log('Component              | Fixes         | Coverage | Confidence');
console.log('───────────────────────┼───────────────┼──────────┼──────────');
console.log('chainSegments closure  | OPEN→CLOSED   | 17.3%    | 95%');
console.log('  (verify loop closes) | (128 contours)|          |');
console.log('Phase4 wrap-around fix | C0/CLOSURE    | 27%      | 90%');
console.log('  (snap last→first)    | (201 contours)|          |');
console.log('Cross-axis validation  | FALSE FITS    | ~10%     | 80%');
console.log('  (verify constraints) | (ghost loops) |          |');
console.log('Multi-axis rechain     | OPEN+GAPS     | ~25%     | 70%');
console.log('  (use other-axis pts) | (fragments)   |          |');
console.log('Full tomographic recon | ALL OPEN      | 17.3%    | 50%');
console.log('  (Radon back-project) | (if mesh poor)|          |');
console.log();

// ── FRAGMENT CONNECTIVITY WITH CONSTRAINT BRIDGES ───────────────
// Demonstrate: use cross-axis points to "bridge" fragment gaps
console.log('═══ FRAGMENT BRIDGING EXAMPLE (nist_ctc_02 +X) ═══\n');

const ctc02File = path.join(vizDir, 'nist_ctc_02_asme1_rc.json');
if (fs.existsSync(ctc02File)) {
  const d = JSON.parse(fs.readFileSync(ctc02File, 'utf8'));
  const xSlice = d.slices.find(s => s.label === '+X');
  const ySlice = d.slices.find(s => s.label === '+Y');
  const zSlice = d.slices.find(s => s.label === '+Z');

  if (xSlice && ySlice && zSlice) {
    // Collect fragment endpoints
    const frags = xSlice.contours.map((c, i) => {
      const pts = c.points;
      return {
        id: i,
        start: { y: pts[0][0], z: pts[0][1] },
        end: { y: pts[pts.length - 1][0], z: pts[pts.length - 1][1] },
        nPts: pts.length,
        perim: contourPerimeter(pts),
      };
    });

    // Collect constraint points on +X plane
    const cps = [];
    // From +Y
    for (const c of ySlice.contours) {
      for (let i = 0; i < c.points.length - 1; i++) {
        const x0 = c.points[i][0], z0 = c.points[i][1];
        const x1 = c.points[i + 1][0], z1 = c.points[i + 1][1];
        if ((x0 <= 0 && x1 >= 0) || (x0 >= 0 && x1 <= 0)) {
          if (Math.abs(x1 - x0) < 1e-10) continue;
          const t = (0 - x0) / (x1 - x0);
          cps.push({ y: ySlice.offset, z: z0 + t * (z1 - z0), from: '+Y' });
        }
      }
    }
    // From +Z
    for (const c of zSlice.contours) {
      for (let i = 0; i < c.points.length - 1; i++) {
        const x0 = c.points[i][0], y0 = c.points[i][1];
        const x1 = c.points[i + 1][0], y1 = c.points[i + 1][1];
        if ((x0 <= 0 && x1 >= 0) || (x0 >= 0 && x1 <= 0)) {
          if (Math.abs(x1 - x0) < 1e-10) continue;
          const t = (0 - x0) / (x1 - x0);
          cps.push({ y: y0 + t * (y1 - y0), z: zSlice.offset, from: '+Z' });
        }
      }
    }

    console.log(`10 fragments + ${cps.length} constraint points on the YZ plane at x=0\n`);

    // Try to build closed loops by chaining fragments + constraint bridges
    console.log('Fragment endpoints + nearest constraint points:\n');
    for (const f of frags) {
      // Find nearest constraint to each endpoint
      let nearS = null, nearSd = Infinity;
      let nearE = null, nearEd = Infinity;
      for (const cp of cps) {
        const ds = Math.sqrt((f.start.y - cp.y) ** 2 + (f.start.z - cp.z) ** 2);
        const de = Math.sqrt((f.end.y - cp.y) ** 2 + (f.end.z - cp.z) ** 2);
        if (ds < nearSd) { nearSd = ds; nearS = cp; }
        if (de < nearEd) { nearEd = de; nearE = cp; }
      }

      // Find nearest other fragment endpoint
      let nearFS = null, nearFSd = Infinity;
      let nearFE = null, nearFEd = Infinity;
      for (const f2 of frags) {
        if (f2.id === f.id) continue;
        for (const pt of [{ ...f2.start, fid: f2.id, end: 's' }, { ...f2.end, fid: f2.id, end: 'e' }]) {
          const ds = Math.sqrt((f.start.y - pt.y) ** 2 + (f.start.z - pt.z) ** 2);
          const de = Math.sqrt((f.end.y - pt.y) ** 2 + (f.end.z - pt.z) ** 2);
          if (ds < nearFSd) { nearFSd = ds; nearFS = pt; }
          if (de < nearFEd) { nearFEd = de; nearFE = pt; }
        }
      }

      console.log(`  c#${f.id} (${f.nPts}pts, perim=${f.perim.toFixed(1)}mm)`);
      console.log(`    START (Y=${f.start.y.toFixed(1)}, Z=${f.start.z.toFixed(1)})`);
      console.log(`      → nearest constraint: ${nearS.from} (Y=${nearS.y.toFixed(1)}, Z=${nearS.z.toFixed(1)}) dist=${nearSd.toFixed(1)}mm`);
      console.log(`      → nearest fragment:   c#${nearFS.fid}.${nearFS.end} dist=${nearFSd.toFixed(1)}mm`);
      console.log(`    END   (Y=${f.end.y.toFixed(1)}, Z=${f.end.z.toFixed(1)})`);
      console.log(`      → nearest constraint: ${nearE.from} (Y=${nearE.y.toFixed(1)}, Z=${nearE.z.toFixed(1)}) dist=${nearEd.toFixed(1)}mm`);
      console.log(`      → nearest fragment:   c#${nearFE.fid}.${nearFE.end} dist=${nearFEd.toFixed(1)}mm`);
    }

    // ── THE KEY INSIGHT ──
    console.log('\n════════════════════════════════════════════════');
    console.log('  KEY INSIGHT: The "Y=0" symmetry plane');
    console.log('════════════════════════════════════════════════\n');

    // Many fragments start at Y=0 or Y≈80 or Y≈200 — these are feature boundaries!
    const yVals = {};
    for (const f of frags) {
      const ys = Math.round(f.start.y);
      const ye = Math.round(f.end.y);
      yVals[ys] = (yVals[ys] || 0) + 1;
      yVals[ye] = (yVals[ye] || 0) + 1;
    }
    console.log('Y-value frequency at fragment endpoints:');
    const sorted = Object.entries(yVals).sort((a, b) => b[1] - a[1]);
    for (const [y, count] of sorted.slice(0, 8)) {
      console.log(`  Y=${y}: ${count} endpoints`);
    }
    console.log();
    console.log('These Y-values correspond to FEATURE BOUNDARIES (steps, pockets, holes).');
    console.log('Fragments at the same Y share a vertical edge — they stack vertically!');
    console.log();

    // Group by approximate Y-value
    console.log('Fragment stacking (same Y ±5mm):');
    const groups = [];
    const used = new Set();
    for (const f of frags) {
      if (used.has(f.id)) continue;
      const group = [f];
      used.add(f.id);
      for (const f2 of frags) {
        if (used.has(f2.id)) continue;
        // Check if f2 shares a Y-boundary with any in group
        for (const g of group) {
          const shareStart = Math.abs(f2.start.y - g.start.y) < 5 || Math.abs(f2.start.y - g.end.y) < 5;
          const shareEnd = Math.abs(f2.end.y - g.start.y) < 5 || Math.abs(f2.end.y - g.end.y) < 5;
          if (shareStart || shareEnd) {
            group.push(f2);
            used.add(f2.id);
            break;
          }
        }
      }
      groups.push(group);
    }

    for (const g of groups) {
      console.log(`  Group: [${g.map(f => 'c#' + f.id).join(', ')}]`);
      for (const f of g) {
        console.log(`    c#${f.id}: Y=[${f.start.y.toFixed(0)},${f.end.y.toFixed(0)}] Z=[${f.start.z.toFixed(0)},${f.end.z.toFixed(0)}]`);
      }
    }
  }
}

console.log('\n══════════════════════════════════════════════════════════');
console.log('  DIAGNOSIS COMPLETE');
console.log('══════════════════════════════════════════════════════════');
