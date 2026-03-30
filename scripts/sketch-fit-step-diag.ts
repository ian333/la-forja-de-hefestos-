/**
 * ⚒️ La Forja — STEP Model Diagnostic
 * ======================================
 * Runs fitContour on EVERY real contour from STEP models
 * and reports detailed per-contour metrics:
 *   - entity count (lines, arcs, circles)
 *   - reconstruction error (max, avg, coverage)
 *   - closure gap (first↔last endpoints)
 *   - suspicious patterns (e.g. circles split as arcs, too many lines)
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fitContour, reconstructionError, type SketchEntity } from '../src/lib/sketch-fitting';

interface Point2D { x: number; y: number }

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const VIZ_DIR = join(__dirname, '..', 'public', 'viz-data');

// ── Helpers ──
function dist(a: Point2D, b: Point2D) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function sweepDeg(e: SketchEntity): number {
  if (e.type === 'line') return 0;
  return Math.abs(e.endAngle - e.startAngle) * 180 / Math.PI;
}

function entityLabel(e: SketchEntity): string {
  if (e.type === 'line') {
    const len = dist(e.start, e.end);
    return `LINE len=${len.toFixed(2)}`;
  }
  const sw = sweepDeg(e);
  if (e.isFullCircle) return `CIRCLE r=${e.radius.toFixed(3)}`;
  return `ARC r=${e.radius.toFixed(3)} sweep=${sw.toFixed(1)}°`;
}

// ── Main ──
const files = readdirSync(VIZ_DIR)
  .filter(f => f.endsWith('.json') && f !== 'index.json')
  .sort();

interface ContourResult {
  model: string;
  slice: string;
  ci: number;
  nPts: number;
  nLines: number;
  nArcs: number;
  nCircles: number;
  nTotal: number;
  maxErr: number;
  avgErr: number;
  coverage: number;
  closureGap: number;
  diag: number;
  issues: string[];
  entities: SketchEntity[];
}

const allResults: ContourResult[] = [];
let totalContours = 0;

console.log('⚒️  La Forja — STEP Model Diagnostic\n');

for (const file of files) {
  const data = JSON.parse(readFileSync(join(VIZ_DIR, file), 'utf-8'));
  const modelName = file.replace('.json', '');
  const slices = data.slices || [];
  
  for (const slice of slices) {
    const contours = slice.contours || [];
    
    for (let ci = 0; ci < contours.length; ci++) {
      const raw = contours[ci];
      const rawPts: number[][] = raw.points || raw;
      if (!Array.isArray(rawPts) || rawPts.length < 3) continue;
      
      // Convert to Point2D
      const pts: Point2D[] = rawPts.map((p: number[]) => ({ x: p[0], y: p[1] }));
      
      // Compute bounding box diagonal
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const diag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
      
      // Run fitContour
      const result = fitContour(pts);
      const entities = result.entities;
      
      // Count types
      let nLines = 0, nArcs = 0, nCircles = 0;
      for (const e of entities) {
        if (e.type === 'line') nLines++;
        else if (e.isFullCircle) nCircles++;
        else nArcs++;
      }
      
      // Reconstruction error
      const tol = Math.max(0.001, diag * 0.002);
      const err = reconstructionError(pts, entities, tol);
      
      // Closure gap
      let closureGap = 0;
      if (entities.length >= 2) {
        const first = entities[0];
        const last = entities[entities.length - 1];
        closureGap = dist(last.end, first.start);
      } else if (entities.length === 1 && !entities[0].isFullCircle) {
        closureGap = dist(entities[0].end, entities[0].start);
      }
      
      // Detect issues
      const issues: string[] = [];
      
      // Issue: closure gap too large
      if (closureGap > tol * 5 && entities.length > 1) {
        issues.push(`CLOSURE_GAP=${closureGap.toFixed(3)}`);
      }
      
      // Issue: max error too large
      if (err.maxError > tol * 10) {
        issues.push(`HIGH_MAX_ERR=${err.maxError.toFixed(3)}`);
      }
      
      // Issue: low coverage
      if (err.coverage < 0.9) {
        issues.push(`LOW_COVERAGE=${(err.coverage * 100).toFixed(1)}%`);
      }
      
      // Issue: circle split into multiple arcs (same center/radius)
      for (let i = 0; i < entities.length; i++) {
        const ei = entities[i];
        if (ei.type !== 'arc' || ei.isFullCircle) continue;
        for (let j = i + 1; j < entities.length; j++) {
          const ej = entities[j];
          if (ej.type !== 'arc' || ej.isFullCircle) continue;
          const cd = dist(ei.center, ej.center);
          const rd = Math.abs(ei.radius - ej.radius);
          const avgR = (ei.radius + ej.radius) / 2;
          if (cd < avgR * 0.1 && rd < avgR * 0.1) {
            const totalSweep = sweepDeg(ei) + sweepDeg(ej);
            if (totalSweep > 300) {
              issues.push(`SPLIT_CIRCLE arcs[${i},${j}] totalSweep=${totalSweep.toFixed(0)}°`);
            }
          }
        }
      }
      
      // Issue: too many entities for simple shapes
      if (pts.length < 30 && entities.length > 8) {
        issues.push(`TOO_MANY_ENTITIES n=${entities.length} for ${pts.length}pts`);
      }
      
      // Issue: predominantly lines where arcs expected
      const closedCircular = pts.length > 20 && diag > 0.1;
      if (closedCircular && nCircles === 0 && nArcs === 0 && nLines > 6) {
        issues.push(`ALL_LINES n=${nLines} (expected arcs?)`);
      }
      
      allResults.push({
        model: modelName,
        slice: slice.label,
        ci,
        nPts: pts.length,
        nLines, nArcs, nCircles,
        nTotal: entities.length,
        maxErr: err.maxError,
        avgErr: err.avgError,
        coverage: err.coverage,
        closureGap,
        diag,
        issues,
        entities,
      });
      totalContours++;
    }
  }
}

// ── Summary ──
console.log(`Processed ${totalContours} contours from ${files.length} models\n`);

// Overall statistics
const withIssues = allResults.filter(r => r.issues.length > 0);
const avgEntities = allResults.reduce((s, r) => s + r.nTotal, 0) / totalContours;
const maxEntities = Math.max(...allResults.map(r => r.nTotal));
const avgCoverage = allResults.reduce((s, r) => s + r.coverage, 0) / totalContours;

console.log('────────── GLOBAL STATS ──────────');
console.log(`  Total contours:   ${totalContours}`);
console.log(`  With issues:      ${withIssues.length} (${(withIssues.length / totalContours * 100).toFixed(1)}%)`);
console.log(`  Avg entities:     ${avgEntities.toFixed(1)}`);
console.log(`  Max entities:     ${maxEntities}`);
console.log(`  Avg coverage:     ${(avgCoverage * 100).toFixed(1)}%`);

// Entity type breakdown
const totalLines = allResults.reduce((s, r) => s + r.nLines, 0);
const totalArcs = allResults.reduce((s, r) => s + r.nArcs, 0);
const totalCircles = allResults.reduce((s, r) => s + r.nCircles, 0);
console.log(`  Total Lines:      ${totalLines}`);
console.log(`  Total Arcs:       ${totalArcs}`);
console.log(`  Total Circles:    ${totalCircles}`);
console.log(`  Ratio L:A:C       ${totalLines}:${totalArcs}:${totalCircles}`);

// Issue breakdown
const issueTypes = new Map<string, number>();
for (const r of withIssues) {
  for (const issue of r.issues) {
    const key = issue.split('=')[0].split(' ')[0];
    issueTypes.set(key, (issueTypes.get(key) || 0) + 1);
  }
}
console.log('\n────────── ISSUE BREAKDOWN ──────────');
for (const [k, v] of [...issueTypes.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`);
}

// Per-contour details for problematic ones
console.log('\n────────── PROBLEMATIC CONTOURS ──────────');
// Sort by number of issues (worst first), then by entity count
const sorted = [...withIssues].sort((a, b) => {
  if (b.issues.length !== a.issues.length) return b.issues.length - a.issues.length;
  return b.nTotal - a.nTotal;
});

for (const r of sorted.slice(0, 30)) {
  const label = `${r.model} → ${r.slice} contour#${r.ci}`;
  console.log(`\n  ${label}`);
  console.log(`    ${r.nPts}pts → ${r.nLines}L ${r.nArcs}A ${r.nCircles}C = ${r.nTotal} entities`);
  console.log(`    diag=${r.diag.toFixed(2)} maxErr=${r.maxErr.toFixed(4)} avgErr=${r.avgErr.toFixed(4)} coverage=${(r.coverage * 100).toFixed(1)}%`);
  console.log(`    closureGap=${r.closureGap.toFixed(4)}`);
  console.log(`    Issues: ${r.issues.join(' | ')}`);
  
  // Show entities
  for (let i = 0; i < Math.min(r.entities.length, 12); i++) {
    console.log(`      [${i}] ${entityLabel(r.entities[i])}`);
  }
  if (r.entities.length > 12) {
    console.log(`      ... +${r.entities.length - 12} more`);
  }
}

// Also show contours with highest entity count (over-segmentation)
console.log('\n────────── TOP 15 BY ENTITY COUNT ──────────');
const byEntCount = [...allResults].sort((a, b) => b.nTotal - a.nTotal);
for (const r of byEntCount.slice(0, 15)) {
  const label = `${r.model} → ${r.slice}#${r.ci}`;
  const issueTag = r.issues.length > 0 ? ` ⚠️ ${r.issues.join(', ')}` : '';
  console.log(`  ${r.nTotal.toString().padStart(3)} entities (${r.nLines}L ${r.nArcs}A ${r.nCircles}C) | ${r.nPts}pts diag=${r.diag.toFixed(1)} | ${label}${issueTag}`);
}

// Show contours that are circles but got split
console.log('\n────────── CIRCLES THAT GOT SPLIT ──────────');
const splitCircles = allResults.filter(r => r.issues.some(i => i.startsWith('SPLIT_CIRCLE')));
for (const r of splitCircles.slice(0, 20)) {
  const label = `${r.model} → ${r.slice}#${r.ci}`;
  console.log(`  ${label}: ${r.nPts}pts → ${r.nLines}L ${r.nArcs}A ${r.nCircles}C`);
  for (let i = 0; i < r.entities.length; i++) {
    console.log(`    [${i}] ${entityLabel(r.entities[i])}`);
  }
}

// Show "all lines" contours
console.log('\n────────── ALL-LINES (EXPECTED ARCS?) ──────────');
const allLines = allResults.filter(r => r.issues.some(i => i.startsWith('ALL_LINES')));
for (const r of allLines.slice(0, 15)) {
  const label = `${r.model} → ${r.slice}#${r.ci}`;
  console.log(`  ${label}: ${r.nPts}pts → ${r.nLines}L diag=${r.diag.toFixed(1)}`);
  for (let i = 0; i < Math.min(r.entities.length, 6); i++) {
    console.log(`    [${i}] ${entityLabel(r.entities[i])}`);
  }
  if (r.entities.length > 6) console.log(`    ... +${r.entities.length - 6} more`);
}

// Reconstruction quality histogram
console.log('\n────────── RECONSTRUCTION QUALITY ──────────');
const buckets = [0.9, 0.95, 0.99, 0.999, 1.0];
for (let i = 0; i < buckets.length; i++) {
  const prev = i === 0 ? 0 : buckets[i - 1];
  const curr = buckets[i];
  const count = allResults.filter(r => r.coverage > prev && r.coverage <= curr).length;
  const bar = '█'.repeat(Math.round(count / totalContours * 80));
  console.log(`  ${(prev * 100).toFixed(0).padStart(3)}%-${(curr * 100).toFixed(0).padStart(3)}%: ${count.toString().padStart(3)} ${bar}`);
}
const perfect = allResults.filter(r => r.coverage >= 1).length;
console.log(`     100%: ${perfect.toString().padStart(3)} contours with perfect coverage`);
