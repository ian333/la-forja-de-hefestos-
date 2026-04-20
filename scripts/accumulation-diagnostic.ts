/**
 * Accumulation Diagnostic — La Forja
 * 
 * For ONE model, dumps every contour showing:
 * 1. Point-to-point spacing (consecutive gaps)
 * 2. Which entities cover which point ranges
 * 3. WHERE short entities accumulate vs WHERE big gaps exist
 * 4. Per-entity: length, type, error contribution
 * 
 * This is a TEXT dump so the agent can "see" the geometry.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { fitContour, type Point2D, type SketchEntity, type SketchArc } from '../src/lib/sketch-fitting.ts';

const VIZ_DIR = join(import.meta.dirname!, '..', 'public', 'viz-data');
const TARGET = process.argv[2] || 'nist_ctc_01_asme1_ap242-e1';

function d(a: Point2D, b: Point2D) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function entityLen(e: SketchEntity): number {
  if (e.type === 'line') return d(e.start, e.end);
  const arc = e as SketchArc;
  if (arc.isFullCircle) return 2 * Math.PI * arc.radius;
  let sw = arc.endAngle - arc.startAngle;
  while (sw < 0) sw += 2 * Math.PI;
  return Math.abs(sw) * arc.radius;
}

function distToLine(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return d(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return d(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function distToArc(p: Point2D, arc: SketchArc): number {
  const dx = p.x - arc.center.x, dy = p.y - arc.center.y;
  const rp = Math.sqrt(dx * dx + dy * dy);
  if (arc.isFullCircle) return Math.abs(rp - arc.radius);
  let angle = Math.atan2(dy, dx);
  while (angle < 0) angle += 2 * Math.PI;
  let sa = arc.startAngle;
  while (sa < 0) sa += 2 * Math.PI;
  let ea = arc.endAngle;
  while (ea < 0) ea += 2 * Math.PI;
  let sweep = ea - sa;
  if (sweep < 0) sweep += 2 * Math.PI;
  let diff = angle - sa;
  if (diff < 0) diff += 2 * Math.PI;
  if (diff <= sweep) return Math.abs(rp - arc.radius);
  return Math.min(d(p, arc.start), d(p, arc.end));
}

function distToEntity(p: Point2D, e: SketchEntity): number {
  if (e.type === 'line') return distToLine(p, e.start, e.end);
  return distToArc(p, e as SketchArc);
}

function distToAny(p: Point2D, entities: SketchEntity[]): number {
  let min = Infinity;
  for (const e of entities) min = Math.min(min, distToEntity(p, e));
  return min;
}

// ═══════════════════════════════════════════════════════════════

const raw = readFileSync(join(VIZ_DIR, `${TARGET}.json`), 'utf-8');
const model = JSON.parse(raw);

console.log(`⚒️  La Forja — Accumulation Diagnostic: ${TARGET}\n`);

let contourIdx = 0;
const contourSummaries: { idx: number; label: string; pts: number; ents: number; diag: number; maxErr: number; maxGap: number; longLineCount: number; shortLineCount: number }[] = [];

for (const slice of (model.slices || [])) {
  for (const contour of (slice.contours || [])) {
    const pts: Point2D[] = contour.points.map((p: number[]) => ({ x: p[0], y: p[1] }));
    if (pts.length < 3) { contourIdx++; continue; }
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    const diag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
    const tol = Math.max(0.001, diag * 0.002);
    
    const result = fitContour(pts);
    const entities = result.entities;
    const errors = pts.map(p => distToAny(p, entities));
    const maxErr = Math.max(...errors);
    
    // Point-to-point gaps
    const gaps: number[] = [];
    for (let i = 1; i < pts.length; i++) gaps.push(d(pts[i-1], pts[i]));
    const maxGap = Math.max(...gaps);
    
    // Entity lengths
    const lengths = entities.map(entityLen);
    const medLen = [...lengths].sort((a,b) => a-b)[Math.floor(lengths.length/2)] || 0;
    
    const shortLineCount = entities.filter((e,i) => e.type === 'line' && lengths[i] < diag * 0.02).length;
    const longLineCount = entities.filter((e,i) => e.type === 'line' && lengths[i] >= diag * 0.1).length;
    
    contourSummaries.push({ idx: contourIdx, label: slice.label, pts: pts.length, ents: entities.length, diag, maxErr, maxGap, longLineCount, shortLineCount });
    
    // Only print detailed report for contours with significant error
    if (maxErr > tol * 5) {
      console.log(`\n${'═'.repeat(70)}`);
      console.log(`CONTOUR #${contourIdx} — ${slice.label} (offset=${slice.offset?.toFixed?.(2) ?? '?'})`);
      console.log(`  ${pts.length} pts, diag=${diag.toFixed(2)}, tol=${tol.toFixed(4)}, maxErr=${maxErr.toFixed(4)}`);
      console.log(`  maxGap between consecutive points: ${maxGap.toFixed(2)}`);
      
      // Detect open contour
      const closureDist = d(pts[0], pts[pts.length-1]);
      const avgSpc = gaps.reduce((s,g) => s+g, 0) / gaps.length;
      const isOpen = closureDist > Math.max(avgSpc * 3, diag * 0.01);
      console.log(`  closure dist=${closureDist.toFixed(4)}, avgSpacing=${avgSpc.toFixed(4)}, isOpen=${isOpen}`);
      
      // Show point gaps — mark big ones
      console.log(`\n  POINT GAPS (consecutive point-to-point distances):`);
      for (let i = 0; i < gaps.length; i++) {
        const gap = gaps[i];
        const isHuge = gap > diag * 0.1;
        const isBig = gap > diag * 0.05;
        const err = errors[i];
        const marker = isHuge ? ' <<<< HUGE GAP' : isBig ? ' << big gap' : '';
        const errMarker = err > tol ? ` ERR=${err.toFixed(3)}` : '';
        if (isHuge || isBig || err > tol * 3) {
          console.log(`    pt${i}→${i+1}: gap=${gap.toFixed(4)}  (${(gap/diag*100).toFixed(1)}% of diag)${marker}${errMarker}   [${pts[i].x.toFixed(2)},${pts[i].y.toFixed(2)}]→[${pts[i+1].x.toFixed(2)},${pts[i+1].y.toFixed(2)}]`);
        }
      }
      
      // Show entity chain
      console.log(`\n  ENTITY CHAIN (${entities.length} entities):`);
      for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        const len = lengths[i];
        const ratio = len / diag;
        const type = e.type === 'line' ? 'LINE' : (e as SketchArc).isFullCircle ? 'CIRC' : 'ARC ';
        const isTiny = ratio < 0.02;
        const marker = isTiny ? ' ← TINY' : '';
        const bar = '█'.repeat(Math.min(40, Math.ceil(ratio * 40)));
        console.log(`    #${String(i).padStart(2)}: ${type} len=${len.toFixed(3).padStart(9)} (${(ratio*100).toFixed(1).padStart(5)}%) ${bar}${marker}`);
        console.log(`          [${e.start.x.toFixed(2)},${e.start.y.toFixed(2)}] → [${e.end.x.toFixed(2)},${e.end.y.toFixed(2)}]`);
      }
      
      // Show per-point errors for high-error points
      const highErrPts = errors.map((e, i) => ({ i, err: e, pt: pts[i] })).filter(x => x.err > tol);
      if (highErrPts.length > 0) {
        console.log(`\n  HIGH-ERROR POINTS (${highErrPts.length}/${pts.length} above tol=${tol.toFixed(4)}):`);
        for (const { i, err, pt } of highErrPts.slice(0, 20)) {
          // Find nearest entity
          let nearestIdx = 0, nearestDist = Infinity;
          for (let j = 0; j < entities.length; j++) {
            const de = distToEntity(pt, entities[j]);
            if (de < nearestDist) { nearestDist = de; nearestIdx = j; }
          }
          console.log(`    pt${String(i).padStart(3)}: [${pt.x.toFixed(2)},${pt.y.toFixed(2)}] err=${err.toFixed(4)} nearest=#${nearestIdx} (${entities[nearestIdx].type})`);
        }
      }
    }
    
    contourIdx++;
  }
}

// Summary table
console.log(`\n${'═'.repeat(70)}`);
console.log(`SUMMARY: ${contourSummaries.length} contours`);
console.log(`\nSorted by maxErr:`);
contourSummaries.sort((a, b) => b.maxErr - a.maxErr);
console.log('  idx  label           pts  ents  diag    maxErr    maxGap    shortL longL');
for (const s of contourSummaries.slice(0, 25)) {
  console.log(`  ${String(s.idx).padStart(3)}  ${s.label.padEnd(14)} ${String(s.pts).padStart(4)}  ${String(s.ents).padStart(4)}  ${s.diag.toFixed(1).padStart(6)}  ${s.maxErr.toFixed(2).padStart(8)}  ${s.maxGap.toFixed(2).padStart(8)}  ${String(s.shortLineCount).padStart(5)}  ${String(s.longLineCount).padStart(4)}`);
}
