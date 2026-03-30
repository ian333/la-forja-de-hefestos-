/**
 * Deep dive into the worst C0 gaps — dump raw points + fitted entities
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { fitContour, type Point2D, type SketchEntity } from '../src/lib/sketch-fitting.ts';

const VIZ_DIR = join(import.meta.dirname!, '..', 'public', 'viz-data');

function dist(a: Point2D, b: Point2D) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Cases to investigate (from the gap analysis)
const cases = [
  { model: 'nist_ftc_10_asme1_rb', maxPts: 158 },  // 61mm gap
  { model: 'nist_ctc_02_asme1_rc', maxPts: 15 },    // 40mm gap
  { model: 'nist_stc_06_asme1_ap242-e3', maxPts: 31 }, // 56mm gap
  { model: 'nist_ctc_01_asme1_ap203', maxPts: 24 },  // 14mm gap
  { model: 'nist_ctc_05_asme1_ap203', maxPts: 13 },   // 6.7mm gap
  { model: 'nist_ftc_09_asme1_rd', maxPts: 11 },     // 0.7mm gap
];

for (const c of cases) {
  const raw = readFileSync(join(VIZ_DIR, c.model + '.json'), 'utf-8');
  const model = JSON.parse(raw);
  
  for (const slice of (model.slices || [])) {
    for (const contour of (slice.contours || [])) {
      const pts: Point2D[] = contour.points.map((p: number[]) => ({ x: p[0], y: p[1] }));
      if (pts.length !== c.maxPts) continue;
      
      // bbox
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      }
      const cDiag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
      const tol = Math.max(0.001, cDiag * 0.002);
      
      console.log(`\n${'═'.repeat(80)}`);
      console.log(`📐 ${c.model} — ${pts.length} points, diag=${cDiag.toFixed(2)}, tol=${tol.toFixed(4)}`);
      console.log(`   bbox: (${minX.toFixed(2)},${minY.toFixed(2)})→(${maxX.toFixed(2)},${maxY.toFixed(2)})`);
      
      // Show raw points (first/last + key points)
      console.log(`\n   Raw points (${pts.length}):`);
      if (pts.length <= 40) {
        for (let i = 0; i < pts.length; i++) {
          const next = pts[(i+1) % pts.length];
          const d = dist(pts[i], next);
          console.log(`     [${i.toString().padStart(3)}] (${pts[i].x.toFixed(4).padStart(10)}, ${pts[i].y.toFixed(4).padStart(10)})  →next: ${d.toFixed(4)}`);
        }
      } else {
        // Show first 10, gap, last 10
        for (let i = 0; i < 10; i++) {
          const next = pts[(i+1) % pts.length];
          const d = dist(pts[i], next);
          console.log(`     [${i.toString().padStart(3)}] (${pts[i].x.toFixed(4).padStart(10)}, ${pts[i].y.toFixed(4).padStart(10)})  →next: ${d.toFixed(4)}`);
        }
        console.log(`     ... (${pts.length - 20} more points) ...`);
        for (let i = pts.length - 10; i < pts.length; i++) {
          const next = pts[(i+1) % pts.length];
          const d = dist(pts[i], next);
          console.log(`     [${i.toString().padStart(3)}] (${pts[i].x.toFixed(4).padStart(10)}, ${pts[i].y.toFixed(4).padStart(10)})  →next: ${d.toFixed(4)}`);
        }
      }
      
      // Closure gap
      const closureGap = dist(pts[0], pts[pts.length - 1]);
      console.log(`\n   Closure: first→last distance = ${closureGap.toFixed(6)}`);
      
      // Fit result
      const result = fitContour(pts);
      console.log(`\n   Fitted entities (${result.entities.length}):`);
      for (let i = 0; i < result.entities.length; i++) {
        const e = result.entities[i];
        const next = result.entities[(i + 1) % result.entities.length];
        const gap = (result.entities.length > 1 && !e.isFullCircle && !next.isFullCircle)
          ? dist(e.end, next.start) : 0;
        const gapFlag = gap > tol ? `  ⚠️ GAP=${gap.toFixed(4)} (${(gap/tol).toFixed(1)}×tol)` : '';
        
        if (e.type === 'line') {
          const len = dist(e.start, e.end);
          console.log(`   [${i}] LINE len=${len.toFixed(4)} (${e.start.x.toFixed(4)},${e.start.y.toFixed(4)})→(${e.end.x.toFixed(4)},${e.end.y.toFixed(4)})${gapFlag}`);
        } else {
          const sw = Math.abs(e.endAngle - e.startAngle) * 180 / Math.PI;
          const fc = e.isFullCircle ? ' ●FULL' : '';
          console.log(`   [${i}] ARC r=${e.radius.toFixed(4)} sweep=${sw.toFixed(1)}° center=(${e.center.x.toFixed(4)},${e.center.y.toFixed(4)}) start=(${e.start.x.toFixed(4)},${e.start.y.toFixed(4)}) end=(${e.end.x.toFixed(4)},${e.end.y.toFixed(4)})${fc}${gapFlag}`);
        }
      }
      
      // Only show first matching contour
      break;
    }
  }
}
