/**
 * ⚒️ La Forja de Hefestos — Numeric Analysis Lab
 * =================================================
 * Runs fitContour on REAL model data and synthetic shapes,
 * then prints the raw numbers: lengths, radii, angles, etc.
 *
 * Goal: understand the SCALE of values to design proportional snapping.
 *
 * Usage:  npx tsx scripts/sketch-fit-numbers.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface Point2D { x: number; y: number }

// ── Load fitContour from real module ──
const root = path.resolve(import.meta.dirname ?? __dirname, '..');
const srcFile = path.join(root, 'src/lib/sketch-fitting.ts');
const srcContent = fs.readFileSync(srcFile, 'utf-8');
const patched = srcContent
  .replace(/import type.*from.*cross-section.*;\n?/, `
type SliceAxis = 'X' | 'Y' | 'Z';
interface Contour { points: Point2D[]; windingNumber: number; }
`)
  .replace(/@\/\*/g, './*');
const tmpFile = path.join(root, '.sketch-fit-numbers-tmp.ts');
fs.writeFileSync(tmpFile, patched);
const mod: any = await import(tmpFile);
const fitContour = mod.fitContour;
fs.unlinkSync(tmpFile);

// ── Utilities ──
function dist(a: Point2D, b: Point2D) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function analyzeEntities(entities: any[], label: string) {
  if (entities.length === 0) return;

  const lines: any[] = [];
  const arcs: any[] = [];
  const circles: any[] = [];

  for (const e of entities) {
    if (e.type === 'line') lines.push(e);
    else if (e.type === 'arc') {
      if (e.isFullCircle) circles.push(e);
      else arcs.push(e);
    }
  }

  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  ${label}`);
  console.log(`  ${entities.length} entities: ${lines.length}L ${arcs.length}A ${circles.length}C`);
  console.log(`${'═'.repeat(80)}`);

  // Line lengths
  if (lines.length > 0) {
    const lengths = lines.map((l: any) => dist(l.start, l.end)).sort((a, b) => a - b);
    console.log(`\n  📏 LINE LENGTHS (${lines.length} lines):`);
    console.log(`     min=${lengths[0].toFixed(6)}  max=${lengths[lengths.length - 1].toFixed(6)}  median=${lengths[Math.floor(lengths.length / 2)].toFixed(6)}`);
    console.log(`     Histogram:`);
    printHistogram(lengths, '     ');

    // Show all unique lengths (rounded to 4 decimals)
    const rounded = lengths.map(l => Number(l.toFixed(4)));
    const unique = [...new Set(rounded)].sort((a, b) => a - b);
    if (unique.length <= 30) {
      console.log(`     All lengths: ${unique.join(', ')}`);
    } else {
      console.log(`     First 15: ${unique.slice(0, 15).join(', ')}`);
      console.log(`     Last 15:  ${unique.slice(-15).join(', ')}`);
    }
  }

  // Arc radii
  if (arcs.length > 0) {
    const radii = arcs.map((a: any) => a.radius).sort((a, b) => a - b);
    const sweeps = arcs.map((a: any) => {
      let s = a.endAngle - a.startAngle;
      while (s > 2 * Math.PI) s -= 2 * Math.PI;
      while (s < -2 * Math.PI) s += 2 * Math.PI;
      return Math.abs(s) * 180 / Math.PI;
    }).sort((a, b) => a - b);
    const arcLens = arcs.map((a: any) => {
      let s = a.endAngle - a.startAngle;
      while (s > 2 * Math.PI) s -= 2 * Math.PI;
      while (s < -2 * Math.PI) s += 2 * Math.PI;
      return a.radius * Math.abs(s);
    }).sort((a, b) => a - b);

    console.log(`\n  🔵 ARC RADII (${arcs.length} arcs):`);
    console.log(`     min=${radii[0].toFixed(6)}  max=${radii[radii.length - 1].toFixed(6)}  median=${radii[Math.floor(radii.length / 2)].toFixed(6)}`);
    printHistogram(radii, '     ');

    console.log(`\n  🔵 ARC SWEEPS (degrees):`);
    console.log(`     min=${sweeps[0].toFixed(2)}°  max=${sweeps[sweeps.length - 1].toFixed(2)}°  median=${sweeps[Math.floor(sweeps.length / 2)].toFixed(2)}°`);

    console.log(`\n  🔵 ARC LENGTHS:`);
    console.log(`     min=${arcLens[0].toFixed(6)}  max=${arcLens[arcLens.length - 1].toFixed(6)}  median=${arcLens[Math.floor(arcLens.length / 2)].toFixed(6)}`);

    // Show unique radii
    const roundedR = radii.map(r => Number(r.toFixed(4)));
    const uniqueR = [...new Set(roundedR)].sort((a, b) => a - b);
    if (uniqueR.length <= 20) {
      console.log(`     Unique radii: ${uniqueR.join(', ')}`);
    } else {
      console.log(`     First 10: ${uniqueR.slice(0, 10).join(', ')}`);
      console.log(`     Last 10:  ${uniqueR.slice(-10).join(', ')}`);
    }
  }

  // Circle radii
  if (circles.length > 0) {
    const cRadii = circles.map((c: any) => c.radius).sort((a, b) => a - b);
    console.log(`\n  🟡 CIRCLE RADII (${circles.length} circles):`);
    const roundedC = cRadii.map(r => Number(r.toFixed(4)));
    const uniqueC = [...new Set(roundedC)].sort((a, b) => a - b);
    console.log(`     min=${cRadii[0].toFixed(6)}  max=${cRadii[cRadii.length - 1].toFixed(6)}`);
    console.log(`     Unique radii: ${uniqueC.join(', ')}`);
  }

  // ── Overall Scale Analysis ──
  const allLengths: number[] = [];
  for (const e of entities) {
    if (e.type === 'line') allLengths.push(dist(e.start, e.end));
    else if (e.type === 'arc') {
      let s = e.endAngle - e.startAngle;
      while (s > 2 * Math.PI) s -= 2 * Math.PI;
      while (s < -2 * Math.PI) s += 2 * Math.PI;
      allLengths.push(e.isFullCircle ? 2 * Math.PI * e.radius : e.radius * Math.abs(s));
    }
  }
  allLengths.sort((a, b) => a - b);
  const maxLen = allLengths[allLengths.length - 1];
  const minLen = allLengths[0];
  const ratio = maxLen / Math.max(minLen, 1e-12);

  console.log(`\n  📐 SCALE ANALYSIS:`);
  console.log(`     Max entity length:  ${maxLen.toFixed(6)}`);
  console.log(`     Min entity length:  ${minLen.toFixed(6)}`);
  console.log(`     Ratio max/min:      ${ratio.toFixed(1)}×`);
  console.log(`     Suggested precision: ${(maxLen / 1000).toFixed(6)} (maxLen/1000)`);
  console.log(`     Snap grid:           ${smartGrid(maxLen).toFixed(6)}`);

  // ── What would snapping do? ──
  const grid = smartGrid(maxLen);
  console.log(`\n  🎯 SNAPPED VALUES (grid=${grid.toFixed(6)}):`);
  if (lines.length > 0) {
    const snappedLens = lines.map((l: any) => {
      const len = dist(l.start, l.end);
      return { raw: len, snapped: snap(len, grid) };
    });
    const uniqueSnapped = [...new Set(snappedLens.map(s => s.snapped))].sort((a, b) => a - b);
    console.log(`     Lines: ${lines.length} raw → ${uniqueSnapped.length} unique snapped lengths`);
    console.log(`     Values: ${uniqueSnapped.slice(0, 20).join(', ')}`);
  }
  if (arcs.length > 0) {
    const snappedRadii = arcs.map((a: any) => snap(a.radius, grid));
    const uniqueSnapped = [...new Set(snappedRadii)].sort((a, b) => a - b);
    console.log(`     Arc radii: ${arcs.length} raw → ${uniqueSnapped.length} unique snapped radii`);
    console.log(`     Values: ${uniqueSnapped.slice(0, 20).join(', ')}`);
  }
  if (circles.length > 0) {
    const snappedRadii = circles.map((c: any) => snap(c.radius, grid));
    const uniqueSnapped = [...new Set(snappedRadii)].sort((a, b) => a - b);
    console.log(`     Circle radii: ${circles.length} raw → ${uniqueSnapped.length} unique snapped radii`);
    console.log(`     Values: ${uniqueSnapped.join(', ')}`);
  }
}

function snap(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

/** Compute a "smart" snap grid from the max dimension */
function smartGrid(maxDim: number): number {
  // Find order of magnitude, then use 1/1000 of it
  // e.g., maxDim=100 → grid=0.1,  maxDim=10 → grid=0.01, maxDim=800 → grid=0.5
  const order = Math.pow(10, Math.floor(Math.log10(maxDim)));
  return order / 1000;
}

function printHistogram(values: number[], indent: string) {
  if (values.length === 0) return;
  const min = values[0], max = values[values.length - 1];
  if (max - min < 1e-10) {
    console.log(`${indent}  [all values = ${min.toFixed(6)}]`);
    return;
  }
  const buckets = 10;
  const step = (max - min) / buckets;
  const counts = new Array(buckets).fill(0);
  for (const v of values) {
    const idx = Math.min(buckets - 1, Math.floor((v - min) / step));
    counts[idx]++;
  }
  const maxCount = Math.max(...counts);
  for (let i = 0; i < buckets; i++) {
    const lo = min + step * i;
    const hi = min + step * (i + 1);
    const barLen = Math.round((counts[i] / maxCount) * 30);
    const bar = '█'.repeat(barLen);
    console.log(`${indent}  ${lo.toFixed(3).padStart(10)}-${hi.toFixed(3).padEnd(10)} ${bar} ${counts[i]}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Run on real NIST model data
// ═══════════════════════════════════════════════════════════════

console.log('\n⚒️  La Forja — Numeric Analysis Lab\n');

// Load a NIST model
const vizDataDir = path.join(root, 'public/viz-data');
const files = ['nist_ctc_01_asme1_rd.json', 'nist_ctc_02_asme1_rc.json', 'nist_ctc_05_asme1_rd.json'];

for (const file of files) {
  const fpath = path.join(vizDataDir, file);
  if (!fs.existsSync(fpath)) continue;

  const data = JSON.parse(fs.readFileSync(fpath, 'utf-8'));
  console.log(`\n${'━'.repeat(80)}`);
  console.log(`  MODEL: ${data.fileName}  (diagonal: ${data.diagonal?.toFixed(2)})`);
  console.log(`${'━'.repeat(80)}`);

  if (!data.slices) continue;

  for (const slice of data.slices) {
    if (!slice.contours) continue;
    for (let ci = 0; ci < Math.min(3, slice.contours.length); ci++) {
      const contour = slice.contours[ci];
      const pts: Point2D[] = contour.points.map((p: number[]) =>
        Array.isArray(p) ? { x: p[0], y: p[1] } : p
      );
      if (pts.length < 6) continue;

      const result = fitContour(pts);
      analyzeEntities(
        result.entities,
        `${slice.label} offset=${slice.offset} contour#${ci} (${pts.length} pts)`
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Synthetic rounded rect with known dimensions
// ═══════════════════════════════════════════════════════════════

function genRoundedRect(
  cx: number, cy: number, w: number, h: number, r: number,
  ptsPerSide = 20, ptsPerFillet = 12
): Point2D[] {
  const pts: Point2D[] = [];
  const halfW = w / 2, halfH = h / 2;
  const cr = Math.min(r, halfW, halfH);
  const corners = [
    { cx: cx + halfW - cr, cy: cy + halfH - cr, sa: 0 },
    { cx: cx - halfW + cr, cy: cy + halfH - cr, sa: Math.PI / 2 },
    { cx: cx - halfW + cr, cy: cy - halfH + cr, sa: Math.PI },
    { cx: cx + halfW - cr, cy: cy - halfH + cr, sa: 3 * Math.PI / 2 },
  ];
  for (let c = 0; c < 4; c++) {
    const { cx: ccx, cy: ccy, sa } = corners[c];
    const nextC = corners[(c + 1) % 4];
    if (cr > 0.001) {
      for (let j = 0; j <= ptsPerFillet; j++) {
        const a = sa + (Math.PI / 2) * (j / ptsPerFillet);
        pts.push({ x: ccx + cr * Math.cos(a), y: ccy + cr * Math.sin(a) });
      }
    } else {
      pts.push({ x: ccx + cr * Math.cos(sa), y: ccy + cr * Math.sin(sa) });
    }
    const endAngle = sa + Math.PI / 2;
    const p1 = { x: ccx + cr * Math.cos(endAngle), y: ccy + cr * Math.sin(endAngle) };
    const nextSA = nextC.sa;
    const p2 = { x: nextC.cx + cr * Math.cos(nextSA), y: nextC.cy + cr * Math.sin(nextSA) };
    for (let j = 1; j < ptsPerSide; j++) {
      const t = j / ptsPerSide;
      pts.push({ x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) });
    }
  }
  return pts;
}

// Rounded rect: 100×50, r=5 — all numbers should snap to 0.1
const rrPts = genRoundedRect(0, 0, 100, 50, 5, 40, 16);
const rrResult = fitContour(rrPts);
analyzeEntities(rrResult.entities, 'SYNTHETIC: Rounded Rect 100×50 r=5 (expect: lines~45/95, arcs r=5)');

// Smaller: 10×10, r=2
const rr2Pts = genRoundedRect(0, 0, 10, 10, 2, 20, 12);
const rr2Result = fitContour(rr2Pts);
analyzeEntities(rr2Result.entities, 'SYNTHETIC: Rounded Rect 10×10 r=2 (expect: lines~6, arcs r=2)');

console.log('\n\n✅ Analysis complete\n');
