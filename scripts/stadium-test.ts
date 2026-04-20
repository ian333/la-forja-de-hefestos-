/**
 * Quick test: run fitting on stadium contour #46 and print results
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { fitContour, type Point2D, type SketchEntity } from '../src/lib/sketch-fitting.ts';

const VIZ_DIR = join(import.meta.dirname!, '..', 'public', 'viz-data');
const TARGET = 'nist_ctc_01_asme1_ap242-e1';

const raw = JSON.parse(readFileSync(join(VIZ_DIR, `${TARGET}.json`), 'utf8'));

// Flatten slices to get contour #46
let contourIdx = 0;
let targetContour: any = null;
let targetSlice: any = null;
for (const slice of raw.slices) {
  for (const c of slice.contours) {
    if (contourIdx === 46) {
      targetContour = c;
      targetSlice = slice;
    }
    contourIdx++;
  }
}

if (!targetContour) {
  console.error('Contour #46 not found!');
  process.exit(1);
}

const pts: Point2D[] = targetContour.points.map((p: number[]) => ({ x: p[0], y: p[1] }));
console.log(`\n=== Contour #46 — ${pts.length} points ===`);
console.log(`Slice: ${targetSlice.label}, offset=${targetSlice.offset}`);

// Enable debug logging
(globalThis as any).__FORGE_DEBUG__ = true;
const result = fitContour(pts);
(globalThis as any).__FORGE_DEBUG__ = false;
console.log(`\nEntities: ${result.entities.length}`);
for (let i = 0; i < result.entities.length; i++) {
  const e = result.entities[i];
  if (e.type === 'line') {
    const len = Math.sqrt((e.end.x - e.start.x) ** 2 + (e.end.y - e.start.y) ** 2);
    console.log(`  [${i}] LINE  (${e.start.x.toFixed(2)}, ${e.start.y.toFixed(2)}) → (${e.end.x.toFixed(2)}, ${e.end.y.toFixed(2)})  len=${len.toFixed(2)}`);
  } else {
    const sweep = ((e.endAngle - e.startAngle) * 180 / Math.PI);
    console.log(`  [${i}] ARC   center=(${e.center.x.toFixed(2)}, ${e.center.y.toFixed(2)}) R=${e.radius.toFixed(2)} sweep=${sweep.toFixed(1)}°  (${e.start.x.toFixed(2)}, ${e.start.y.toFixed(2)}) → (${e.end.x.toFixed(2)}, ${e.end.y.toFixed(2)})${e.isFullCircle ? ' [CIRCLE]' : ''}`);
  }
}

// Compute reconstruction error
let maxErr = 0, sumErr = 0;
for (const p of pts) {
  let minD = Infinity;
  for (const e of result.entities) {
    let d: number;
    if (e.type === 'line') {
      const dx = e.end.x - e.start.x, dy = e.end.y - e.start.y;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-12) { d = Math.sqrt((p.x - e.start.x) ** 2 + (p.y - e.start.y) ** 2); }
      else {
        let t = ((p.x - e.start.x) * dx + (p.y - e.start.y) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const cx = e.start.x + t * dx, cy = e.start.y + t * dy;
        d = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
      }
    } else {
      const dx = p.x - e.center.x, dy = p.y - e.center.y;
      d = Math.abs(Math.sqrt(dx * dx + dy * dy) - e.radius);
    }
    if (d < minD) minD = d;
  }
  sumErr += minD;
  maxErr = Math.max(maxErr, minD);
}

console.log(`\nReconstruction Error:`);
console.log(`  maxErr: ${maxErr.toFixed(4)} mm`);
console.log(`  avgErr: ${(sumErr / pts.length).toFixed(4)} mm`);
console.log(`\nConstraints: ${result.constraints.length}`);
for (const c of result.constraints) {
  console.log(`  ${c.type} [${c.entities.join(', ')}]`);
}
