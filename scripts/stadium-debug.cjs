/**
 * Stadium debug — diagnose contour #46 fitting
 * Runs the fitting pipeline step-by-step and prints what happens at each phase.
 */
const { readFileSync } = require('fs');
const { join } = require('path');

const VIZ_DIR = join(__dirname, '..', 'public', 'viz-data');
const TARGET = 'nist_ctc_01_asme1_ap242-e1';

// Load the data
const raw = JSON.parse(readFileSync(join(VIZ_DIR, `${TARGET}.json`), 'utf8'));

// Flatten slices to get contour #46
let contourIdx = 0;
let targetContour = null;
let targetSlice = null;
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

const pts = targetContour.points.map(p => ({ x: p[0], y: p[1] }));
console.log(`\n=== Contour #46 ===`);
console.log(`Slice: ${targetSlice.label}, offset=${targetSlice.offset}`);
console.log(`Points: ${pts.length}`);

// Compute bbox and diag
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const p of pts) {
  minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
  minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
}
const diag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
const tol = Math.max(0.001, diag * 0.002);
console.log(`BBox: [${minX.toFixed(2)}, ${minY.toFixed(2)}] → [${maxX.toFixed(2)}, ${maxY.toFixed(2)}]`);
console.log(`Diagonal: ${diag.toFixed(3)}  Tolerance: ${tol.toFixed(6)}`);
console.log(`Width: ${(maxX - minX).toFixed(2)}  Height: ${(maxY - minY).toFixed(2)}`);

// Check closure
const closureDist = Math.sqrt((pts[0].x - pts[pts.length-1].x)**2 + (pts[0].y - pts[pts.length-1].y)**2);
let avgSpacing = 0;
for (let i = 1; i < pts.length; i++) {
  avgSpacing += Math.sqrt((pts[i].x - pts[i-1].x)**2 + (pts[i].y - pts[i-1].y)**2);
}
avgSpacing /= (pts.length - 1);
console.log(`\nClosure dist: ${closureDist.toFixed(4)}`);
console.log(`Avg spacing: ${avgSpacing.toFixed(4)}`);
console.log(`Open threshold: ${Math.max(avgSpacing * 3, diag * 0.01).toFixed(4)}`);
console.log(`Is open: ${closureDist > Math.max(avgSpacing * 3, diag * 0.01)}`);

// Compute curvature at each point
function localCurvature(pts, idx, win) {
  const n = pts.length;
  const prev = pts[(idx - win + n) % n];
  const curr = pts[idx];
  const next = pts[(idx + win) % n];
  const v1x = curr.x - prev.x, v1y = curr.y - prev.y;
  const v2x = next.x - curr.x, v2y = next.y - curr.y;
  const cross = v1x * v2y - v1y * v2x;
  const l1 = Math.sqrt(v1x*v1x + v1y*v1y);
  const l2 = Math.sqrt(v2x*v2x + v2y*v2y);
  if (l1 < 1e-12 || l2 < 1e-12) return 0;
  return cross / (l1 * l2);
}

// Compute direction change at each point (like detectCorners does)
console.log(`\n=== Direction Analysis ===`);
const n = pts.length;
const win = Math.max(4, Math.min(60, Math.floor(n * 0.05)));
console.log(`Window size: ${win}`);

const dirChanges = [];
for (let i = 0; i < n; i++) {
  const prev = pts[(i - win + n) % n];
  const next = pts[(i + win) % n];
  const curr = pts[i];
  
  const v1x = curr.x - prev.x, v1y = curr.y - prev.y;
  const v2x = next.x - curr.x, v2y = next.y - curr.y;
  const l1 = Math.sqrt(v1x*v1x + v1y*v1y);
  const l2 = Math.sqrt(v2x*v2x + v2y*v2y);
  
  if (l1 < 1e-12 || l2 < 1e-12) {
    dirChanges.push(0);
    continue;
  }
  
  const dot = (v1x*v2x + v1y*v2y) / (l1*l2);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
  dirChanges.push(angle);
}

console.log('\nPoint | Dir Change (deg) | Curvature | Position');
console.log('------|------------------|-----------|----------');
for (let i = 0; i < n; i++) {
  const curv = localCurvature(pts, i, Math.max(1, Math.floor(win/2)));
  const marker = dirChanges[i] > 35 ? ' <<<CORNER>>>' : (dirChanges[i] > 20 ? ' <<near>>' : '');
  console.log(`  ${String(i).padStart(3)} | ${dirChanges[i].toFixed(2).padStart(16)} | ${curv.toFixed(5).padStart(9)} | (${pts[i].x.toFixed(3)}, ${pts[i].y.toFixed(3)})${marker}`);
}

// Show which corners would be detected with 35° threshold
const corners35 = [];
const corners20 = [];
for (let i = 0; i < n; i++) {
  if (dirChanges[i] > 35) corners35.push(i);
  if (dirChanges[i] > 20) corners20.push(i);
}
console.log(`\nCorners at 35° threshold: ${corners35.length} → [${corners35.join(', ')}]`);
console.log(`Corners at 20° threshold: ${corners20.length} → [${corners20.join(', ')}]`);

// Show the shape - compute direction (angle) at each point
console.log(`\n=== Point-by-Point Direction ===`);
for (let i = 0; i < n; i++) {
  const next = pts[(i + 1) % n];
  const dx = next.x - pts[i].x, dy = next.y - pts[i].y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const edgeLen = Math.sqrt(dx*dx + dy*dy);
  console.log(`  ${String(i).padStart(3)} → ${String((i+1) % n).padStart(3)}: angle=${angle.toFixed(1).padStart(7)}°  len=${edgeLen.toFixed(4)}`);
}

// Try fitting through the actual module
console.log('\n=== Running actual fitContour ===');
// We can't easily import the TS module from CJS, so let's see the output
// from the contour-to-jpg analysis data instead
console.log('(Use npx tsx to run actual fitting - see contour-to-jpg output)');
