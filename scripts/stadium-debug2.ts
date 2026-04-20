/**
 * Debug: trace curvature transitions for contour #46
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { fitContour, type Point2D } from '../src/lib/sketch-fitting.ts';

const VIZ_DIR = join(import.meta.dirname!, '..', 'public', 'viz-data');
const TARGET = 'nist_ctc_01_asme1_ap242-e1';
const raw = JSON.parse(readFileSync(join(VIZ_DIR, `${TARGET}.json`), 'utf8'));

let idx = 0;
let contour: any = null;
for (const slice of raw.slices) {
  for (const c of slice.contours) {
    if (idx === 46) contour = c;
    idx++;
  }
}

const pts: Point2D[] = contour.points.map((p: number[]) => ({ x: p[0], y: p[1] }));

// Simulate the pre-processing from fitContour
const cleaned: Point2D[] = [pts[0]];
for (let i = 1; i < pts.length; i++) {
  const dx = pts[i].x - cleaned[cleaned.length - 1].x;
  const dy = pts[i].y - cleaned[cleaned.length - 1].y;
  if (Math.sqrt(dx * dx + dy * dy) > 1e-6) cleaned.push(pts[i]);
}
let explicitlyClosed = false;
if (cleaned.length > 2) {
  const dx = cleaned[0].x - cleaned[cleaned.length - 1].x;
  const dy = cleaned[0].y - cleaned[cleaned.length - 1].y;
  if (Math.sqrt(dx * dx + dy * dy) < 1e-6) {
    cleaned.pop();
    explicitlyClosed = true;
  }
}
console.log(`Cleaned points: ${cleaned.length}, explicitly closed: ${explicitlyClosed}`);

const n = cleaned.length;

// Compute curvature for open point selection
function localCurvature(pts: Point2D[], idx: number, win = 3) {
  const n = pts.length;
  const prev = pts[(idx - win + n) % n];
  const curr = pts[idx];
  const next = pts[(idx + win) % n];
  const v1x = curr.x - prev.x, v1y = curr.y - prev.y;
  const v2x = next.x - curr.x, v2y = next.y - curr.y;
  const cross = v1x * v2y - v1y * v2x;
  const l1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const l2 = Math.sqrt(v2x * v2x + v2y * v2y);
  if (l1 < 1e-12 || l2 < 1e-12) return 0;
  return cross / (l1 * l2);
}

// Find open point (max curvature jump)
const kappa = new Float64Array(n);
for (let i = 0; i < n; i++) kappa[i] = localCurvature(cleaned, i);
let maxJump = -1, openIdx = 0;
for (let i = 0; i < n; i++) {
  const jump = Math.abs(kappa[i] - kappa[(i + 1) % n]);
  if (jump > maxJump) { maxJump = jump; openIdx = (i + 1) % n; }
}
console.log(`Open index: ${openIdx} (max curvature jump: ${maxJump.toFixed(4)})`);
console.log(`Open point: (${cleaned[openIdx].x.toFixed(2)}, ${cleaned[openIdx].y.toFixed(2)})`);

// Create openPts
const openPts: Point2D[] = [];
for (let i = 0; i < n; i++) openPts.push(cleaned[(openIdx + i) % n]);

console.log(`\nopenPts[0] = (${openPts[0].x.toFixed(2)}, ${openPts[0].y.toFixed(2)})`);
console.log(`openPts[${n-1}] = (${openPts[n-1].x.toFixed(2)}, ${openPts[n-1].y.toFixed(2)})`);

// Compute curvature on openPts for transition detection (windowed)
const win = Math.max(2, Math.min(8, Math.floor(n * 0.04)));
console.log(`\nCurvature window: ${win}`);
const openKappa: number[] = [];
for (let i = 0; i < n; i++) {
  const prev = openPts[(i - win + n) % n];
  const curr = openPts[i];
  const next = openPts[(i + win) % n];
  const v1x = curr.x - prev.x, v1y = curr.y - prev.y;
  const v2x = next.x - curr.x, v2y = next.y - curr.y;
  const l1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const l2 = Math.sqrt(v2x * v2x + v2y * v2y);
  if (l1 < 1e-12 || l2 < 1e-12) { openKappa.push(0); continue; }
  const cross = v1x * v2y - v1y * v2x;
  openKappa.push(Math.abs(cross / (l1 * l2)));
}

let maxK = 0;
for (const k of openKappa) if (k > maxK) maxK = k;
console.log(`\nMax curvature: ${maxK.toFixed(6)}`);

// Bimodal gap analysis
const sorted = [...openKappa].sort((a, b) => a - b);
let maxGap = 0, gapIdx = 0;
for (let i = 1; i < sorted.length; i++) {
  const g = sorted[i] - sorted[i - 1];
  if (g > maxGap) { maxGap = g; gapIdx = i; }
}
console.log(`Max gap: ${maxGap.toFixed(6)} at sorted index ${gapIdx}`);
console.log(`Gap threshold check: maxGap/maxK = ${(maxGap / maxK).toFixed(3)} (need > 0.3)`);
console.log(`Gap boundary: [${sorted[gapIdx - 1].toFixed(6)}, ${sorted[gapIdx].toFixed(6)}]`);
const threshold = (sorted[gapIdx - 1] + sorted[gapIdx]) / 2;
console.log(`Threshold: ${threshold.toFixed(6)}`);

// Classify
const isStraight = openKappa.map(k => k < threshold);
const straightCount = isStraight.filter(Boolean).length;
console.log(`\nStraight points: ${straightCount} / ${n}`);

console.log('\nClassification:');
for (let i = 0; i < n; i++) {
  console.log(`  [${i}] κ=${openKappa[i].toFixed(4)} ${isStraight[i] ? 'STRAIGHT' : 'CURVED'} (${openPts[i].x.toFixed(1)}, ${openPts[i].y.toFixed(1)})`);
}

// Find transitions
const transitions: number[] = [];
for (let i = 0; i < n; i++) {
  const next = (i + 1) % n;
  if (isStraight[i] !== isStraight[next]) {
    transitions.push(next);
  }
}
console.log(`\nTransitions: [${transitions.join(', ')}]`);

// Also check detectCorners on openPts
// Simulate detectCorners
const w = Math.max(4, Math.min(60, Math.floor(n * 0.05)));
console.log(`\nCorner detection window: ${w}`);
const angleChanges: number[] = new Array(n).fill(0);
for (let i = w; i < n - w; i++) {
  const bx = openPts[i].x - openPts[i - w].x;
  const by = openPts[i].y - openPts[i - w].y;
  const fx = openPts[i + w].x - openPts[i].x;
  const fy = openPts[i + w].y - openPts[i].y;
  const bLen = Math.sqrt(bx * bx + by * by);
  const fLen = Math.sqrt(fx * fx + fy * fy);
  if (bLen < 1e-12 || fLen < 1e-12) continue;
  const dot = (bx * fx + by * fy) / (bLen * fLen);
  angleChanges[i] = Math.acos(Math.max(-1, Math.min(1, dot)));
}
const thresh = 35 * Math.PI / 180;
const corners = [];
for (let i = w; i < n - w; i++) {
  if (angleChanges[i] > thresh) corners.push(i);
}
console.log(`Corners at 35°: ${corners.length} [${corners.join(', ')}]`);

// Run actual fitting
const result = fitContour(pts);
console.log(`\n=== ACTUAL FITTING RESULT: ${result.entities.length} entities ===`);
for (let i = 0; i < result.entities.length; i++) {
  const e = result.entities[i];
  if (e.type === 'line') {
    const len = Math.sqrt((e.end.x - e.start.x) ** 2 + (e.end.y - e.start.y) ** 2);
    console.log(`  [${i}] LINE  (${e.start.x.toFixed(2)}, ${e.start.y.toFixed(2)}) → (${e.end.x.toFixed(2)}, ${e.end.y.toFixed(2)})  len=${len.toFixed(2)}`);
  } else {
    const sweep = ((e.endAngle - e.startAngle) * 180 / Math.PI);
    console.log(`  [${i}] ARC   center=(${e.center.x.toFixed(2)}, ${e.center.y.toFixed(2)}) R=${e.radius.toFixed(2)} sweep=${sweep.toFixed(1)}°  (${e.start.x.toFixed(2)}, ${e.start.y.toFixed(2)}) → (${e.end.x.toFixed(2)}, ${e.end.y.toFixed(2)})`);
  }
}
