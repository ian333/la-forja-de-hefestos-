/**
 * C0 Gap Analysis — La Forja
 * 
 * Focuses ONLY on C0 gaps: where they are, how big, and why.
 * Also finds contours where consecutive lines could be merged (reducing entity count).
 * FAST — no heavy logging, just the numbers that matter.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fitContour, type Point2D, type SketchEntity } from '../src/lib/sketch-fitting.ts';

const VIZ_DIR = join(import.meta.dirname!, '..', 'public', 'viz-data');

function dist(a: Point2D, b: Point2D) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function entityDesc(e: SketchEntity): string {
  if (e.type === 'line') return 'LINE';
  if (e.isFullCircle) return 'CIRCLE';
  return 'ARC';
}

interface GapInfo {
  model: string;
  pts: number;
  diag: number;
  tol: number;
  gapDist: number;
  gapRatio: number; // gap / tol
  fromType: string;
  toType: string;
  fromIdx: number;
  totalEnts: number;
  fromEnd: Point2D;
  toStart: Point2D;
}

interface MergeableInfo {
  model: string;
  pts: number;
  totalEnts: number;
  mergeableLines: number; // adjacent collinear lines
  potentialReduction: number; // how many entities could be eliminated
}

const gaps: GapInfo[] = [];
const mergeables: MergeableInfo[] = [];
let totalContours = 0;
let totalGaps = 0;
let totalMergeableLines = 0;

const files = readdirSync(VIZ_DIR)
  .filter(f => f.endsWith('.json') && f !== 'index.json')
  .sort();

console.log('⚒️  La Forja — C0 Gap Analysis\n');

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
      const entities = result.entities;
      
      // Check C0 gaps (skip wrap-around for open contours)
      // Detect if contour is open: closure dist >> average spacing
      const cleanedPts = pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]) > 1e-6);
      const closureDist = dist(cleanedPts[0], cleanedPts[cleanedPts.length - 1]);
      let avgSpc = 0;
      for (let i = 1; i < cleanedPts.length; i++) avgSpc += dist(cleanedPts[i - 1], cleanedPts[i]);
      avgSpc /= Math.max(1, cleanedPts.length - 1);
      const isOpenContour = closureDist > Math.max(avgSpc * 3, cDiag * 0.01);
      
      for (let i = 0; i < entities.length; i++) {
        const isWrapAround = (i === entities.length - 1);
        if (isOpenContour && isWrapAround) continue; // skip open contour wrap gap
        const curr = entities[i];
        const next = entities[(i + 1) % entities.length];
        if (curr.isFullCircle || next.isFullCircle) continue;
        if (entities.length === 1) continue;
        const gap = dist(curr.end, next.start);
        if (gap > tol) {
          totalGaps++;
          gaps.push({
            model: name,
            pts: pts.length,
            diag: cDiag,
            tol,
            gapDist: gap,
            gapRatio: gap / tol,
            fromType: entityDesc(curr),
            toType: entityDesc(next),
            fromIdx: i,
            totalEnts: entities.length,
            fromEnd: curr.end,
            toStart: next.start,
          });
        }
      }
      
      // Check mergeable consecutive lines (collinear within 3°)
      let mergeableCount = 0;
      for (let i = 0; i < entities.length; i++) {
        const e1 = entities[i];
        const e2 = entities[(i + 1) % entities.length];
        if (e1.type !== 'line' || e2.type !== 'line') continue;
        const a1 = Math.atan2(e1.end.y - e1.start.y, e1.end.x - e1.start.x);
        const a2 = Math.atan2(e2.end.y - e2.start.y, e2.end.x - e2.start.x);
        let da = Math.abs(a1 - a2);
        if (da > Math.PI) da = 2 * Math.PI - da;
        if (da < 3 * Math.PI / 180) {
          mergeableCount++;
        }
      }
      if (mergeableCount > 0) {
        totalMergeableLines += mergeableCount;
        mergeables.push({
          model: name,
          pts: pts.length,
          totalEnts: entities.length,
          mergeableLines: mergeableCount,
          potentialReduction: mergeableCount,
        });
      }
    }
  }
}

// ── Results ──
console.log(`Analyzed ${totalContours} contours from ${files.length} models\n`);

console.log('━'.repeat(90));
console.log('🔴 C0 GAPS (endpoint mismatches)\n');
console.log(`Total gaps: ${totalGaps}\n`);

if (gaps.length > 0) {
  // Group by gap size
  const small = gaps.filter(g => g.gapRatio < 5);
  const medium = gaps.filter(g => g.gapRatio >= 5 && g.gapRatio < 20);
  const large = gaps.filter(g => g.gapRatio >= 20);
  
  console.log(`  1-5× tol:   ${small.length} gaps (minor)`);
  console.log(`  5-20× tol:  ${medium.length} gaps (visible)`);
  console.log(`  >20× tol:   ${large.length} gaps (BROKEN)\n`);
  
  // Group by transition type
  const byType: Record<string, number> = {};
  for (const g of gaps) {
    const key = `${g.fromType}→${g.toType}`;
    byType[key] = (byType[key] || 0) + 1;
  }
  console.log('  By transition type:');
  for (const [k, v] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k}: ${v} gaps`);
  }
  
  // Show worst 15 gaps
  const sorted = [...gaps].sort((a, b) => b.gapRatio - a.gapRatio);
  console.log(`\n  Top 15 worst gaps:`);
  console.log(`  ${'Model'.padEnd(40)} ${'Pts'.padStart(5)} ${'Ents'.padStart(5)} ${'Gap'.padStart(10)} ${'Tol'.padStart(10)} ${'Ratio'.padStart(8)} ${'Transition'}`);
  for (const g of sorted.slice(0, 15)) {
    console.log(`  ${g.model.padEnd(40)} ${g.pts.toString().padStart(5)} ${g.totalEnts.toString().padStart(5)} ${g.gapDist.toFixed(4).padStart(10)} ${g.tol.toFixed(4).padStart(10)} ${g.gapRatio.toFixed(1).padStart(8)}× ${g.fromType}[${g.fromIdx}]→${g.toType}[${g.fromIdx+1}]`);
  }
  
  // Show exact coordinates of worst 5 gaps
  console.log(`\n  Exact coordinates of worst 5 gaps:`);
  for (const g of sorted.slice(0, 5)) {
    console.log(`  ${g.model}: entity[${g.fromIdx}].end=(${g.fromEnd.x.toFixed(4)},${g.fromEnd.y.toFixed(4)}) → entity[${g.fromIdx+1}].start=(${g.toStart.x.toFixed(4)},${g.toStart.y.toFixed(4)}) gap=${g.gapDist.toFixed(6)}`);
  }
}

console.log('\n' + '━'.repeat(90));
console.log('🟡 MERGEABLE COLLINEAR LINES (< 3° angle)\n');
console.log(`Total mergeable pairs: ${totalMergeableLines}`);
console.log(`Potential entity reduction: -${totalMergeableLines} entities\n`);

if (mergeables.length > 0) {
  const sorted = [...mergeables].sort((a, b) => b.mergeableLines - a.mergeableLines);
  console.log(`  Top 10 contours with mergeable lines:`);
  console.log(`  ${'Model'.padEnd(40)} ${'Pts'.padStart(5)} ${'Ents'.padStart(5)} ${'Merge'.padStart(6)} ${'→Could be'.padStart(10)}`);
  for (const m of sorted.slice(0, 10)) {
    const reduced = m.totalEnts - m.potentialReduction;
    console.log(`  ${m.model.padEnd(40)} ${m.pts.toString().padStart(5)} ${m.totalEnts.toString().padStart(5)} ${m.mergeableLines.toString().padStart(6)} ${reduced.toString().padStart(10)}`);
  }
}

console.log('\n' + '━'.repeat(90));
console.log('📊 SUMMARY\n');
console.log(`  Contours analyzed:     ${totalContours}`);
console.log(`  C0 gaps found:         ${totalGaps}`);
console.log(`  Mergeable line pairs:  ${totalMergeableLines}`);
console.log(`  Gap rate:              ${(100 * totalGaps / totalContours).toFixed(1)}% of contours have gaps`);
console.log(`  Merge opportunity:     -${totalMergeableLines} entities could be eliminated`);
