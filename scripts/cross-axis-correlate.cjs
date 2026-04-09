#!/usr/bin/env node
/**
 * ⚒️ La Forja — Cross-Axis Correlation v2
 * ==========================================
 * Reads existing viz-data JSON, maps contour centroids to 3D world coords,
 * then cross-references across axes to find corroborated features.
 *
 * Coordinate mapping (from planeBasis + dot projection):
 *   X-normal [1,0,0]: u=(0,0,-1)  v=(0,1,0)  → cx=-worldZ, cy=worldY
 *   Y-normal [0,1,0]: u=(0,0,-1)  v=(1,0,0)  → cx=-worldZ, cy=worldX
 *   Z-normal [0,0,1]: u=(1,0,0)   v=(0,1,0)  → cx=worldX,  cy=worldY
 *
 * Usage:
 *   node scripts/cross-axis-correlate.cjs [viz-data.json]
 *   node scripts/cross-axis-correlate.cjs   (runs all models)
 */

'use strict';
const fs = require('fs');
const path = require('path');

const RS = '\x1b[0m', B = '\x1b[1m', D = '\x1b[2m';
const RD = '\x1b[31m', GR = '\x1b[32m', YE = '\x1b[33m', BL = '\x1b[34m', MG = '\x1b[35m', CY = '\x1b[36m';

// ═══════════════════════════════════════════════════════════════
// Vector math
// ═══════════════════════════════════════════════════════════════
function cross(a, b) {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
function normalize(v) {
  const len = Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2);
  if (len > 0) { v[0] /= len; v[1] /= len; v[2] /= len; }
  return v;
}

// ═══════════════════════════════════════════════════════════════
// planeBasis — identical to gpu-cross-section.ts & feature-decomp-test.cjs
// ═══════════════════════════════════════════════════════════════
function planeBasis(normal) {
  const n = [...normal];
  normalize(n);
  const up = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = cross(up, n); normalize(u);
  const v = cross(n, u);  normalize(v);
  return { u, v };
}

// ═══════════════════════════════════════════════════════════════
// 2D contour centroid → 3D world position
// ═══════════════════════════════════════════════════════════════
// The contour 2D coords are: pt.x = dot(worldPos, u), pt.y = dot(worldPos, v)
// And: offset = dot(worldPos, normal)
// So:  worldPos = pt.x * u + pt.y * v + offset * normal
function toWorld3D(cx, cy, normal, offset) {
  const { u, v } = planeBasis(normal);
  return [
    cx * u[0] + cy * v[0] + offset * normal[0],
    cx * u[1] + cy * v[1] + offset * normal[1],
    cx * u[2] + cy * v[2] + offset * normal[2],
  ];
}

function profileWorld(p) {
  return toWorld3D(p.centroid.x, p.centroid.y, p.normal, p.offset);
}

function axisOf(normal) {
  if (Math.abs(normal[0]) > 0.9) return 'X';
  if (Math.abs(normal[1]) > 0.9) return 'Y';
  if (Math.abs(normal[2]) > 0.9) return 'Z';
  return null;
}

// ═══════════════════════════════════════════════════════════════
// Sweep topology — track contour count changes
// ═══════════════════════════════════════════════════════════════
function analyzeSweep(slices, axis) {
  const axSlices = slices.filter(s => axisOf(s.normal) === axis).sort((a, b) => a.offset - b.offset);
  const transitions = [];
  for (let i = 1; i < axSlices.length; i++) {
    const prev = axSlices[i-1], curr = axSlices[i];
    const dc = curr.contours.length - prev.contours.length;
    if (dc !== 0) {
      transitions.push({
        from: prev.offset, to: curr.offset,
        fc: prev.contours.length, tc: curr.contours.length, dc,
      });
    }
  }
  return { count: axSlices.length, transitions, slices: axSlices };
}

// ═══════════════════════════════════════════════════════════════
// Cross-axis correlation engine
// ═══════════════════════════════════════════════════════════════
function crossCorrelate(profiles, diagonal) {
  const TOL = diagonal * 0.015;

  // Enrich profiles with 3D world coords
  const enriched = profiles.map(p => {
    const ax = axisOf(p.normal);
    if (!ax) return null;
    const w = profileWorld(p);
    return { ...p, ax, w };
  }).filter(Boolean);

  const byAxis = { X: [], Y: [], Z: [] };
  for (const e of enriched) byAxis[e.ax].push(e);

  const features = [];

  // Strategy: for each Z-profile, check if X and Y sweeps see something at same XY
  for (const zp of byAxis.Z) {
    // Z-profile knows X,Y precisely; Z varies with offset
    const wx = zp.w[0], wy = zp.w[1];

    // X-sweep profiles know Y,Z precisely. Match on Y.
    const xHits = byAxis.X.filter(xp => Math.abs(xp.w[1] - wy) < TOL);
    // Y-sweep profiles know X,Z precisely. Match on X.
    const yHits = byAxis.Y.filter(yp => Math.abs(yp.w[0] - wx) < TOL);

    const corr = (xHits.length > 0 ? 1 : 0) + (yHits.length > 0 ? 1 : 0) + 1;

    if (corr >= 2) {
      features.push({
        wx, wy,
        zOffsets: [zp.offset],
        type: zp.type, area: zp.area, isHole: zp.isHole,
        corr,
        xHits: xHits.map(h => ({ offset: h.offset, type: h.type, area: h.area })),
        yHits: yHits.map(h => ({ offset: h.offset, type: h.type, area: h.area })),
      });
    }
  }

  // Also find X↔Y matches not covered by Z
  const zCovered = new Set(features.map(f => `${Math.round(f.wx/TOL)},${Math.round(f.wy/TOL)}`));
  for (const xp of byAxis.X) {
    const wy = xp.w[1], wz = xp.w[2];
    const yHits = byAxis.Y.filter(yp => Math.abs(yp.w[2] - wz) < TOL);
    if (yHits.length > 0) {
      const wx = yHits[0].w[0];
      const key = `${Math.round(wx/TOL)},${Math.round(wy/TOL)}`;
      if (!zCovered.has(key)) {
        features.push({
          wx, wy, wz,
          type: xp.type, area: xp.area, isHole: xp.isHole,
          corr: 2, source: 'XY-only',
          xHits: [{ offset: xp.offset, type: xp.type, area: xp.area }],
          yHits: yHits.map(h => ({ offset: h.offset, type: h.type, area: h.area })),
          zOffsets: [],
        });
      }
    }
  }

  // Deduplicate by proximity
  const merged = [];
  const used = new Set();
  for (let i = 0; i < features.length; i++) {
    if (used.has(i)) continue;
    const group = [features[i]];
    used.add(i);
    for (let j = i+1; j < features.length; j++) {
      if (used.has(j)) continue;
      const dx = features[i].wx - features[j].wx;
      const dy = features[i].wy - features[j].wy;
      if (Math.sqrt(dx*dx + dy*dy) < TOL * 2) {
        group.push(features[j]);
        used.add(j);
      }
    }
    group.sort((a, b) => b.corr - a.corr);
    const best = { ...group[0] };
    best.depthCount = group.length;
    const allZ = new Set();
    for (const g of group) for (const z of (g.zOffsets || [])) allZ.add(z);
    best.zRange = allZ.size > 0 ? [Math.min(...allZ), Math.max(...allZ)] : null;
    merged.push(best);
  }

  return merged.sort((a, b) => (b.corr - a.corr) || (b.area - a.area));
}

// ═══════════════════════════════════════════════════════════════
// Model analysis
// ═══════════════════════════════════════════════════════════════
function analyzeModel(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const slug = path.basename(filePath, '.json');
  const diag = data.diagonal;
  const bb = data.boundingBox;
  const profiles = data.profiles || [];
  const slices = data.slices || [];
  const declaredFeatures = data.features || [];

  console.log(`\n${B}⚒️  ${slug}${RS}`);
  console.log(`${D}   BBox: X[${bb.min[0].toFixed(0)},${bb.max[0].toFixed(0)}] Y[${bb.min[1].toFixed(0)},${bb.max[1].toFixed(0)}] Z[${bb.min[2].toFixed(0)},${bb.max[2].toFixed(0)}]  diag=${diag.toFixed(0)}${RS}`);

  // ── Sweep topology ──
  console.log(`\n${CY}── Sweep Topology ──${RS}`);
  for (const axis of ['X', 'Y', 'Z']) {
    const sw = analyzeSweep(slices, axis);
    const counts = sw.slices.map(s => s.contours.length);
    const sum = counts.reduce((a, b) => a + b, 0);
    const max = Math.max(...counts, 0);
    console.log(`   ${B}${axis}${RS}: ${sw.count} slices, ${sum} contours, max=${max}/slice, ${sw.transitions.length} transitions`);
    for (const t of sw.transitions) {
      const tag = t.dc > 0 ? `${GR}+${t.dc}${RS}` : `${RD}${t.dc}${RS}`;
      console.log(`     ${D}@ ${t.from.toFixed(1)}→${t.to.toFixed(1)}: ${t.fc}→${t.tc} (${tag})${RS}`);
    }
  }

  // ── Cross-axis ──
  console.log(`\n${CY}── Cross-Axis Correlation ──${RS}`);
  const features = crossCorrelate(profiles, diag);
  const triple = features.filter(f => f.corr === 3).length;
  const double = features.filter(f => f.corr === 2).length;
  console.log(`   ${profiles.length} profiles → ${GR}${triple} triple${RS}, ${YE}${double} double${RS}, ${features.length} total unique`);

  for (let i = 0; i < Math.min(features.length, 25); i++) {
    const f = features[i];
    const stars = f.corr === 3 ? `${GR}★★★${RS}` : `${YE}★★${RS}`;
    const hole = f.isHole ? `${D}hole${RS}` : `${MG}boss${RS}`;
    const zStr = f.zRange ? `z=[${f.zRange[0].toFixed(0)},${f.zRange[1].toFixed(0)}]` : '';
    console.log(`   ${stars} #${(i+1).toString().padStart(2)} ${f.type.padEnd(14)} (${f.wx.toFixed(1)}, ${f.wy.toFixed(1)}) area=${f.area.toFixed(0).padStart(7)} ${hole} ${zStr} d=${f.depthCount}`);
    if (f.xHits.length > 0 || f.yHits.length > 0) {
      const xt = f.xHits.map(h => h.type).filter((v,i,a) => a.indexOf(v)===i).join(',');
      const yt = f.yHits.map(h => h.type).filter((v,i,a) => a.indexOf(v)===i).join(',');
      console.log(`       ${D}X→[${xt}] Y→[${yt}]${RS}`);
    }
  }
  if (features.length > 25) console.log(`   ${D}... and ${features.length - 25} more${RS}`);

  // ── vs declared ──
  // Feature centroids are in 2D plane coords (same as profiles).
  // Convert declared features to 3D world, then match against corroborated features.
  // Problem: declared features don't always have offset. Instead, match via the
  // profiles that were corroborated — if a profile's 2D centroid matches a declared
  // feature's centroid (same axis), it's a hit.

  const TOL = diag * 0.015;
  const flat = [];
  for (const f of declaredFeatures) {
    if (f.children) {
      for (const c of f.children) {
        // Inherit parent normal if child doesn't have one
        if (!c.normal && f.normal) c.normal = f.normal;
        flat.push(c);
      }
    } else {
      flat.push(f);
    }
  }
  const withCent = flat.filter(f => f.centroid);

  // Build set of corroborated profile positions in 3D world
  const corrWorld = [];
  for (const feat of features) {
    corrWorld.push([feat.wx, feat.wy, feat.wz || 0]);
  }

  // Also index all corroborated profile source data (from the cross-correlation input)
  // The corroborated features came from profiles → we have their 2D centroids per axis
  const corrProfiles = new Set();
  for (const p of profiles) {
    const ax = axisOf(p.normal);
    if (!ax) continue;
    const w = profileWorld(p);
    // Check if this profile is part of any corroborated feature
    for (const feat of features) {
      if (Math.abs(w[0] - feat.wx) < TOL && Math.abs(w[1] - feat.wy) < TOL) {
        // Store as key: axis + 2D centroid (rounded)
        const key = `${ax}:${Math.round(p.centroid.x/TOL)}:${Math.round(p.centroid.y/TOL)}`;
        corrProfiles.add(key);
        break;
      }
    }
  }

  let matched = 0;
  const missed = [];
  for (const df of withCent) {
    const dc = df.centroid;
    const dn = df.normal;
    let found = false;

    // Strategy 1: If declared has normal, convert to 3D and match
    if (dn) {
      // We don't have offset, but we can match in the 2D profile space
      const ax = axisOf(dn);
      if (ax) {
        const key = `${ax}:${Math.round(dc.x/TOL)}:${Math.round(dc.y/TOL)}`;
        if (corrProfiles.has(key)) found = true;
        // Also try nearby keys (tolerance)
        if (!found) {
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const k2 = `${ax}:${Math.round(dc.x/TOL)+dx}:${Math.round(dc.y/TOL)+dy}`;
              if (corrProfiles.has(k2)) { found = true; break; }
            }
            if (found) break;
          }
        }
      }
    }

    // Strategy 2: Fallback — try 3D world match (for features that happen to align)
    if (!found && dn) {
      // Approximate: the feature could be at any offset along its normal.
      // Try matching just the transverse coordinates.
      // For Y-normal features: centroid.x ≈ -worldZ, centroid.y ≈ worldX
      // Need to match worldX,worldY of corroborated against reconstructed value.
      // Use a rough offset=0 reconstruction
      const w3 = toWorld3D(dc.x, dc.y, dn, 0);
      // For axis-aligned normals, 2 of 3 world coords are reliable (the one along normal is wrong)
      const ax = axisOf(dn);
      if (ax) {
        for (const feat of features) {
          let d2;
          if (ax === 'X') d2 = Math.sqrt((w3[1]-feat.wy)**2 + (w3[2]-(feat.wz||0))**2);
          else if (ax === 'Y') d2 = Math.sqrt((w3[0]-feat.wx)**2 + (w3[2]-(feat.wz||0))**2);
          else d2 = Math.sqrt((w3[0]-feat.wx)**2 + (w3[1]-feat.wy)**2);
          if (d2 < TOL * 3) { found = true; break; }
        }
      }
    }

    if (found) matched++;
    else missed.push(df);
  }

  console.log(`\n${CY}── vs Declared ──${RS}`);
  console.log(`   Declared: ${declaredFeatures.length} (${withCent.length} with centroid)`);
  console.log(`   Matched: ${matched}/${withCent.length} (${(matched/Math.max(1,withCent.length)*100).toFixed(0)}%)`);
  if (missed.length > 0) {
    console.log(`   ${RD}Missed: ${missed.length}${RS}`);
    for (const m of missed.slice(0, 5)) {
      console.log(`     ${m.type||m.label} @ (${m.centroid.x.toFixed(1)}, ${m.centroid.y.toFixed(1)})`);
    }
    if (missed.length > 5) console.log(`     ${D}... +${missed.length - 5} more${RS}`);
  }

  return { slug, profiles: profiles.length, triple, double, total: features.length, declared: withCent.length, matched, missed: missed.length };
}

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════
const args = process.argv.slice(2);
const vizDir = path.join(__dirname, '..', 'public', 'viz-data');

let files;
if (args.length > 0) {
  files = args.map(a => path.resolve(a));
} else {
  const idxPath = path.join(vizDir, 'index.json');
  if (fs.existsSync(idxPath)) {
    const idx = JSON.parse(fs.readFileSync(idxPath, 'utf-8'));
    files = idx.map(m => path.join(vizDir, `${m.slug}.json`)).filter(f => fs.existsSync(f));
  } else {
    files = fs.readdirSync(vizDir).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => path.join(vizDir, f));
  }
}

console.log(`${B}⚒️  La Forja — Cross-Axis Correlation v2${RS}`);
console.log(`${D}   ${files.length} models${RS}`);

const results = [];
for (const f of files) {
  try { results.push(analyzeModel(f)); }
  catch (err) { console.error(`${RD}✗ ${path.basename(f)}: ${err.message}${RS}`); }
}

if (results.length > 1) {
  console.log(`\n${B}═══════════════════════════════════════════ SUMMARY ═══════════════════════════════════════════${RS}`);
  console.log(`${'Model'.padEnd(42)} Prof   ★3   ★2  Tot   Decl  Match  Miss`);
  console.log('─'.repeat(90));
  for (const r of results) {
    console.log(`${r.slug.padEnd(42)} ${r.profiles.toString().padStart(4)}  ${r.triple.toString().padStart(3)}  ${r.double.toString().padStart(3)}  ${r.total.toString().padStart(3)}   ${r.declared.toString().padStart(4)}  ${r.matched.toString().padStart(5)}  ${r.missed.toString().padStart(4)}`);
  }
  console.log('─'.repeat(90));
  const s = (k) => results.reduce((a, r) => a + r[k], 0);
  console.log(`${'TOTAL'.padEnd(42)} ${s('profiles').toString().padStart(4)}  ${s('triple').toString().padStart(3)}  ${s('double').toString().padStart(3)}  ${s('total').toString().padStart(3)}   ${s('declared').toString().padStart(4)}  ${s('matched').toString().padStart(5)}  ${s('missed').toString().padStart(4)}`);
  console.log(`\n${B}Overall: ${s('matched')}/${s('declared')} matched (${(s('matched')/Math.max(1,s('declared'))*100).toFixed(1)}%)${RS}`);
}
