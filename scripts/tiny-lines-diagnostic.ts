/**
 * Tiny Lines Diagnostic — La Forja
 * 
 * The user identified that MOST fitting errors come from ultra-small lines
 * relative to the contour scale. This script measures every entity, finds
 * the proportion of tiny lines, and correlates them with fitting error.
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
  // Arc: radius * sweepAngle
  const arc = e as SketchArc;
  if (arc.isFullCircle) return 2 * Math.PI * arc.radius;
  let sweep = arc.endAngle - arc.startAngle;
  if (sweep < 0) sweep += 2 * Math.PI;
  if (sweep > 2 * Math.PI) sweep -= 2 * Math.PI;
  return Math.abs(sweep) * arc.radius;
}

interface TinyLineInfo {
  model: string;
  contourIdx: number;
  entityIdx: number;
  length: number;
  contourDiag: number;
  ratio: number;   // length / diag
  prevType: string;
  nextType: string;
  maxError: number;
  avgError: number;
}

const tinyLines: TinyLineInfo[] = [];
let totalContours = 0;
let totalEntities = 0;
let totalLines = 0;
let totalArcs = 0;
let totalCircles = 0;
let contoursWith0Error = 0;

// Accumulate per-bucket stats
const buckets = [0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5];
const bucketCounts: Record<string, { lines: number; arcs: number }> = {};
for (const b of buckets) bucketCounts[`<${b}`] = { lines: 0, arcs: 0 };
bucketCounts['>=0.5'] = { lines: 0, arcs: 0 };

// Per-contour stats: does having many tiny lines correlate with high error?
interface ContourStats {
  model: string;
  pts: number;
  diag: number;
  totalEnts: number;
  lineCount: number;
  arcCount: number;
  circleCount: number;
  tinyLineCount: number; // lines < 1% of diag
  microLineCount: number; // lines < 0.1% of diag
  tinyArcCount: number;  // arcs < 1% of diag
  maxError: number;
  avgError: number;
  coverage: number;
  medianLineRatio: number;
  minLineRatio: number;
}
const contourStats: ContourStats[] = [];

const files = readdirSync(VIZ_DIR)
  .filter(f => f.endsWith('.json') && f !== 'index.json')
  .sort();

console.log('⚒️  La Forja — Tiny Lines Diagnostic\n');

for (const file of files) {
  const raw = readFileSync(join(VIZ_DIR, file), 'utf-8');
  const model = JSON.parse(raw);
  const name = file.replace('.json', '');
  
  let contourIdx = 0;
  for (const slice of (model.slices || [])) {
    for (const contour of (slice.contours || [])) {
      const pts: Point2D[] = contour.points.map((p: number[]) => ({ x: p[0], y: p[1] }));
      if (pts.length < 3) continue;
      
      totalContours++;
      contourIdx++;
      
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      }
      const cDiag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
      const tol = Math.max(0.001, cDiag * 0.002);
      
      const result = fitContour(pts);
      const entities = result.entities;
      const error = reconstructionError(pts, entities, tol);
      
      totalEntities += entities.length;
      
      let lineCount = 0, arcCount = 0, circleCount = 0;
      let tinyLineCount = 0, microLineCount = 0, tinyArcCount = 0;
      const lineRatios: number[] = [];
      
      for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        const len = entityLength(e);
        const ratio = cDiag > 0 ? len / cDiag : 0;
        
        if (e.type === 'line') {
          totalLines++;
          lineCount++;
          lineRatios.push(ratio);
          
          // Bucket it
          let bucketed = false;
          for (const b of buckets) {
            if (ratio < b) { bucketCounts[`<${b}`].lines++; bucketed = true; break; }
          }
          if (!bucketed) bucketCounts['>=0.5'].lines++;
          
          if (ratio < 0.01) {
            tinyLineCount++;
            const prev = entities[(i - 1 + entities.length) % entities.length];
            const next = entities[(i + 1) % entities.length];
            tinyLines.push({
              model: name,
              contourIdx,
              entityIdx: i,
              length: len,
              contourDiag: cDiag,
              ratio,
              prevType: prev.type === 'arc' ? (prev.isFullCircle ? 'circle' : 'arc') : 'line',
              nextType: next.type === 'arc' ? (next.isFullCircle ? 'circle' : 'arc') : 'line',
              maxError: error.maxError,
              avgError: error.avgError,
            });
          }
          if (ratio < 0.001) microLineCount++;
        } else {
          const arc = e as SketchArc;
          if (arc.isFullCircle) { totalCircles++; circleCount++; }
          else { totalArcs++; arcCount++; }
          
          // Bucket arcs too
          let bucketed = false;
          for (const b of buckets) {
            if (ratio < b) { bucketCounts[`<${b}`].arcs++; bucketed = true; break; }
          }
          if (!bucketed) bucketCounts['>=0.5'].arcs++;
          
          if (ratio < 0.01) tinyArcCount++;
        }
      }
      
      lineRatios.sort((a, b) => a - b);
      const medianLineRatio = lineRatios.length > 0 ? lineRatios[Math.floor(lineRatios.length / 2)] : 0;
      const minLineRatio = lineRatios.length > 0 ? lineRatios[0] : 0;
      
      contourStats.push({
        model: name,
        pts: pts.length,
        diag: cDiag,
        totalEnts: entities.length,
        lineCount, arcCount, circleCount,
        tinyLineCount, microLineCount, tinyArcCount,
        maxError: error.maxError,
        avgError: error.avgError,
        coverage: error.coverage,
        medianLineRatio,
        minLineRatio,
      });
      
      if (error.maxError < 0.001) contoursWith0Error++;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════

console.log(`═══════════════════════════════════════════════════════`);
console.log(`OVERVIEW`);
console.log(`  Contours: ${totalContours}`);
console.log(`  Entities: ${totalEntities} (${totalLines} lines, ${totalArcs} arcs, ${totalCircles} circles)`);
console.log(`  Contours with maxErr < 0.001: ${contoursWith0Error} / ${totalContours}`);
console.log();

console.log(`═══════════════════════════════════════════════════════`);
console.log(`ENTITY LENGTH DISTRIBUTION (as ratio of contour diagonal)`);
console.log(`  Bucket          Lines    Arcs`);
for (const b of buckets) {
  const k = `<${b}`;
  console.log(`  ratio ${k.padEnd(8)}  ${String(bucketCounts[k].lines).padStart(6)}  ${String(bucketCounts[k].arcs).padStart(6)}`);
}
console.log(`  ratio >=0.5     ${String(bucketCounts['>=0.5'].lines).padStart(6)}  ${String(bucketCounts['>=0.5'].arcs).padStart(6)}`);
console.log();

console.log(`═══════════════════════════════════════════════════════`);
console.log(`TINY LINES (< 1% of contour diagonal): ${tinyLines.length} / ${totalLines} lines`);
if (tinyLines.length > 0) {
  console.log(`  Percentage: ${(tinyLines.length / totalLines * 100).toFixed(1)}% of all lines`);
  const microCount = tinyLines.filter(t => t.ratio < 0.001).length;
  console.log(`  Ultra-micro (< 0.1% diag): ${microCount}`);
  
  // Neighborhood analysis: what's adjacent to tiny lines?
  const neighborCounts: Record<string, number> = {};
  for (const t of tinyLines) {
    const key = `${t.prevType}→LINE→${t.nextType}`;
    neighborCounts[key] = (neighborCounts[key] ?? 0) + 1;
  }
  console.log(`\n  NEIGHBOR PATTERNS (what's around tiny lines):`);
  const sorted = Object.entries(neighborCounts).sort((a, b) => b[1] - a[1]);
  for (const [pattern, count] of sorted) {
    console.log(`    ${pattern.padEnd(25)} ${count}`);
  }
}
console.log();

console.log(`═══════════════════════════════════════════════════════`);
console.log(`CORRELATION: tiny lines vs error`);
// Split contours into two groups: those WITH tiny lines and those WITHOUT
const withTiny = contourStats.filter(c => c.tinyLineCount > 0);
const noTiny = contourStats.filter(c => c.tinyLineCount === 0);
if (withTiny.length > 0 && noTiny.length > 0) {
  const avgMaxErrWithTiny = withTiny.reduce((s, c) => s + c.maxError, 0) / withTiny.length;
  const avgMaxErrNoTiny = noTiny.reduce((s, c) => s + c.maxError, 0) / noTiny.length;
  const avgAvgErrWithTiny = withTiny.reduce((s, c) => s + c.avgError, 0) / withTiny.length;
  const avgAvgErrNoTiny = noTiny.reduce((s, c) => s + c.avgError, 0) / noTiny.length;
  console.log(`  Contours WITH tiny lines:    ${withTiny.length.toString().padStart(4)}  avgMaxErr: ${avgMaxErrWithTiny.toFixed(6)}  avgAvgErr: ${avgAvgErrWithTiny.toFixed(6)}`);
  console.log(`  Contours WITHOUT tiny lines: ${noTiny.length.toString().padStart(4)}  avgMaxErr: ${avgMaxErrNoTiny.toFixed(6)}  avgAvgErr: ${avgAvgErrNoTiny.toFixed(6)}`);
  console.log(`  Error ratio (with/without): maxErr ${(avgMaxErrWithTiny / avgMaxErrNoTiny).toFixed(1)}x, avgErr ${(avgAvgErrWithTiny / avgAvgErrNoTiny).toFixed(1)}x`);
}
console.log();

// Top 20 worst contours by error — show tiny line count
console.log(`═══════════════════════════════════════════════════════`);
console.log(`TOP 20 WORST CONTOURS BY MAX ERROR`);
const worstContours = [...contourStats].sort((a, b) => b.maxError - a.maxError).slice(0, 20);
console.log('  model                                          pts   ents tinyL microL  maxErr     avgErr   minRatio');
for (const c of worstContours) {
  const shortName = c.model.slice(0, 45).padEnd(45);
  console.log(`  ${shortName} ${String(c.pts).padStart(5)} ${String(c.totalEnts).padStart(5)} ${String(c.tinyLineCount).padStart(5)} ${String(c.microLineCount).padStart(5)}  ${c.maxError.toFixed(6).padStart(10)} ${c.avgError.toFixed(6).padStart(10)}  ${c.minLineRatio.toFixed(6)}`);
}
console.log();

// Show the 20 tiniest lines with their context
console.log(`═══════════════════════════════════════════════════════`);
console.log(`20 TINIEST LINES (absolute smallest)`);
const tiniest = [...tinyLines].sort((a, b) => a.ratio - b.ratio).slice(0, 20);
for (const t of tiniest) {
  console.log(`  ${t.model.slice(0, 35).padEnd(35)} len=${t.length.toFixed(6).padStart(10)} diag=${t.contourDiag.toFixed(2).padStart(8)} ratio=${t.ratio.toExponential(2)} ${t.prevType}→LINE→${t.nextType}`);
}
