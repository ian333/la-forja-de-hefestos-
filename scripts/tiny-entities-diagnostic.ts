/**
 * Tiny Entities Diagnostic — Lines AND Arcs
 * 
 * Finds all lines AND arcs that are disproportionately small compared
 * to their contour. These are fitting artifacts that should be absorbed
 * into their neighbors.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fitContour, reconstructionError, type Point2D, type SketchEntity, type SketchArc } from '../src/lib/sketch-fitting.ts';

const VIZ_DIR = join(import.meta.dirname!, '..', 'public', 'viz-data');

function dist(a: Point2D, b: Point2D) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function entityLength(e: SketchEntity): number {
  if (e.type === 'line') return dist(e.start, e.end);
  const arc = e as SketchArc;
  if (arc.isFullCircle) return 2 * Math.PI * arc.radius;
  let sweep = arc.endAngle - arc.startAngle;
  if (sweep < 0) sweep += 2 * Math.PI;
  if (sweep > 2 * Math.PI) sweep -= 2 * Math.PI;
  return Math.abs(sweep) * arc.radius;
}

function sweepDeg(e: SketchEntity): number {
  if (e.type === 'line') return 0;
  const arc = e as SketchArc;
  if (arc.isFullCircle) return 360;
  let sweep = arc.endAngle - arc.startAngle;
  if (sweep < 0) sweep += 2 * Math.PI;
  if (sweep > 2 * Math.PI) sweep -= 2 * Math.PI;
  return Math.abs(sweep) * 180 / Math.PI;
}

function entName(e: SketchEntity) {
  if (e.type === 'line') return 'LINE';
  if ((e as SketchArc).isFullCircle) return 'CIRCLE';
  return 'ARC';
}

interface TinyEntityInfo {
  model: string;
  type: 'line' | 'arc';
  length: number;
  diag: number;
  ratio: number;
  sweepDeg: number;  // 0 for lines
  radius: number;    // 0 for lines
  prevType: string;
  nextType: string;
  contourEnts: number;
  maxError: number;
}

const tinyEnts: TinyEntityInfo[] = [];
let totalContours = 0;
let totalLines = 0, totalArcs = 0;

// Thresholds to test
const THRESHOLDS = [0.005, 0.01, 0.02, 0.03, 0.05];

// Track how many entities fall below each threshold
const belowThreshold: Record<string, { lines: number; arcs: number }> = {};
for (const t of THRESHOLDS) belowThreshold[String(t)] = { lines: 0, arcs: 0 };

// Track sweep angle distribution for small arcs
const sweepBuckets = [5, 10, 15, 20, 30, 45, 60, 90, 180, 360];
const sweepCounts: Record<string, number> = {};
for (const b of sweepBuckets) sweepCounts[`<${b}°`] = 0;

const files = readdirSync(VIZ_DIR)
  .filter(f => f.endsWith('.json') && f !== 'index.json')
  .sort();

console.log('⚒️  La Forja — Tiny Lines + Mini-Arcs Diagnostic\n');

for (const file of files) {
  const raw = readFileSync(join(VIZ_DIR, file), 'utf-8');
  const model = JSON.parse(raw);
  const name = file.replace('.json', '');

  for (const slice of (model.slices || [])) {
    for (const contour of (slice.contours || [])) {
      const pts: Point2D[] = contour.points.map((p: number[]) => ({ x: p[0], y: p[1] }));
      if (pts.length < 3) continue;
      totalContours++;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      }
      const cDiag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
      const tol = Math.max(0.001, cDiag * 0.002);

      const result = fitContour(pts);
      const ents = result.entities;
      const error = reconstructionError(pts, ents, tol);

      for (let i = 0; i < ents.length; i++) {
        const e = ents[i];
        const len = entityLength(e);
        const ratio = cDiag > 0 ? len / cDiag : 0;

        if (e.type === 'line') totalLines++;
        else if (!(e as SketchArc).isFullCircle) totalArcs++;

        // Threshold counts
        for (const t of THRESHOLDS) {
          if (ratio < t) {
            if (e.type === 'line') belowThreshold[String(t)].lines++;
            else if (!(e as SketchArc).isFullCircle) belowThreshold[String(t)].arcs++;
          }
        }

        // Sweep angle distribution for ALL arcs (not circles)
        if (e.type === 'arc' && !(e as SketchArc).isFullCircle) {
          const sd = sweepDeg(e);
          for (const b of sweepBuckets) {
            if (sd < b) { sweepCounts[`<${b}°`]++; break; }
          }
        }

        // Collect tiny entities (< 5% of diag)
        if (ratio < 0.05 && e.type !== 'arc' || (e.type === 'arc' && !(e as SketchArc).isFullCircle && ratio < 0.05)) {
          const prev = ents[(i - 1 + ents.length) % ents.length];
          const next = ents[(i + 1) % ents.length];
          tinyEnts.push({
            model: name,
            type: e.type === 'line' ? 'line' : 'arc',
            length: len,
            diag: cDiag,
            ratio,
            sweepDeg: sweepDeg(e),
            radius: e.type === 'arc' ? (e as SketchArc).radius : 0,
            prevType: entName(prev),
            nextType: entName(next),
            contourEnts: ents.length,
            maxError: error.maxError,
          });
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════

console.log(`═══════════════════════════════════════════════════════`);
console.log(`OVERVIEW: ${totalContours} contours, ${totalLines} lines, ${totalArcs} arcs (non-circle)\n`);

console.log(`═══════════════════════════════════════════════════════`);
console.log(`ENTITIES BELOW PROPORTIONAL THRESHOLDS (length/diag)`);
console.log(`  Threshold    Lines               Arcs`);
for (const t of THRESHOLDS) {
  const d = belowThreshold[String(t)];
  console.log(`  < ${String(t).padEnd(6)}   ${String(d.lines).padStart(5)} (${(d.lines/totalLines*100).toFixed(1).padStart(5)}%)      ${String(d.arcs).padStart(5)} (${(d.arcs/totalArcs*100).toFixed(1).padStart(5)}%)`);
}
console.log();

console.log(`═══════════════════════════════════════════════════════`);
console.log(`ARC SWEEP ANGLE DISTRIBUTION (all ${totalArcs} non-circle arcs)`);
for (const b of sweepBuckets) {
  const k = `<${b}°`;
  const n = sweepCounts[k];
  const bar = '█'.repeat(Math.round(n / totalArcs * 60));
  console.log(`  ${k.padEnd(7)} ${String(n).padStart(5)} (${(n/totalArcs*100).toFixed(1).padStart(5)}%) ${bar}`);
}
console.log();

// Mini-arcs detail: arcs < 20° sweep
console.log(`═══════════════════════════════════════════════════════`);
const miniArcs = tinyEnts.filter(e => e.type === 'arc' && e.sweepDeg < 20);
console.log(`MINI-ARCS (< 20° sweep AND < 5% diag): ${miniArcs.length}`);
if (miniArcs.length > 0) {
  const neighborCounts: Record<string, number> = {};
  for (const t of miniArcs) {
    const key = `${t.prevType}→ARC→${t.nextType}`;
    neighborCounts[key] = (neighborCounts[key] ?? 0) + 1;
  }
  console.log(`  NEIGHBOR PATTERNS:`);
  for (const [p, c] of Object.entries(neighborCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${p.padEnd(25)} ${c}`);
  }
  console.log(`\n  Worst 15 mini-arcs:`);
  miniArcs.sort((a, b) => a.ratio - b.ratio);
  for (const m of miniArcs.slice(0, 15)) {
    console.log(`    ${m.model.slice(0, 35).padEnd(35)} sweep=${m.sweepDeg.toFixed(1).padStart(5)}° r=${m.radius.toFixed(2).padStart(7)} len/diag=${m.ratio.toFixed(5)} ${m.prevType}→ARC→${m.nextType}`);
  }
}
console.log();

// Tiny lines detail
console.log(`═══════════════════════════════════════════════════════`);
const tinyLinesSub = tinyEnts.filter(e => e.type === 'line' && e.ratio < 0.02);
console.log(`TINY LINES (< 2% of diag): ${tinyLinesSub.length}`);
if (tinyLinesSub.length > 0) {
  const neighborCounts: Record<string, number> = {};
  for (const t of tinyLinesSub) {
    const key = `${t.prevType}→LINE→${t.nextType}`;
    neighborCounts[key] = (neighborCounts[key] ?? 0) + 1;
  }
  console.log(`  NEIGHBOR PATTERNS:`);
  for (const [p, c] of Object.entries(neighborCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${p.padEnd(25)} ${c}`);
  }
  console.log(`\n  Worst 15 tiny lines:`);
  tinyLinesSub.sort((a, b) => a.ratio - b.ratio);
  for (const m of tinyLinesSub.slice(0, 15)) {
    console.log(`    ${m.model.slice(0, 35).padEnd(35)} len=${m.length.toFixed(4).padStart(9)} diag=${m.diag.toFixed(1).padStart(7)} ratio=${m.ratio.toFixed(6)} ${m.prevType}→LINE→${m.nextType}`);
  }
}
console.log();

// Summary: what would happen if we absorbed entities < X% of diag?
console.log(`═══════════════════════════════════════════════════════`);
console.log(`ABSORPTION IMPACT ESTIMATE`);
console.log(`If we absorb entities < threshold into neighbors:\n`);
for (const t of [0.005, 0.01, 0.02]) {
  const affectedLines = tinyEnts.filter(e => e.type === 'line' && e.ratio < t);
  const affectedArcs = tinyEnts.filter(e => e.type === 'arc' && e.ratio < t);
  const total = affectedLines.length + affectedArcs.length;
  console.log(`  < ${(t*100).toFixed(1)}% diag: ${total} entities removed (${affectedLines.length} lines + ${affectedArcs.length} arcs)`);
}
