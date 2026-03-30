/**
 * ⚒️ La Forja de Hefestos — Sketch Fit Lab
 * ==========================================
 * Synthetic shapes with KNOWN answers → run fitContour → report pass/fail.
 *
 * Usage:  npx tsx scripts/sketch-fit-lab.ts
 */

// ── Inline fitContour (we copy the core algo to run standalone) ──
// The real module uses TS path aliases & imports types from cross-section.ts
// so we re-export the needed pieces here for the lab.

interface Point2D { x: number; y: number }

// ── Shape Generators ──

/** Generate a perfect circle of N points */
function genCircle(cx: number, cy: number, r: number, n = 64): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/** Generate a square with side `s`, center at (cx, cy), optionally with fillet radius r */
function genRoundedRect(
  cx: number, cy: number, w: number, h: number, r: number,
  ptsPerSide = 20, ptsPerFillet = 12
): Point2D[] {
  const pts: Point2D[] = [];
  const halfW = w / 2, halfH = h / 2;
  const cr = Math.min(r, halfW, halfH);

  // Corners: TR, TL, BL, BR
  const corners = [
    { cx: cx + halfW - cr, cy: cy + halfH - cr, sa: 0 },           // bottom-right
    { cx: cx - halfW + cr, cy: cy + halfH - cr, sa: Math.PI / 2 }, // bottom-left
    { cx: cx - halfW + cr, cy: cy - halfH + cr, sa: Math.PI },     // top-left
    { cx: cx + halfW - cr, cy: cy - halfH + cr, sa: 3 * Math.PI / 2 }, // top-right
  ];

  for (let c = 0; c < 4; c++) {
    const { cx: ccx, cy: ccy, sa } = corners[c];
    // Straight edge before fillet
    const nextC = corners[(c + 1) % 4];
    // Fillet arc
    if (cr > 0.001) {
      for (let j = 0; j <= ptsPerFillet; j++) {
        const a = sa + (Math.PI / 2) * (j / ptsPerFillet);
        pts.push({ x: ccx + cr * Math.cos(a), y: ccy + cr * Math.sin(a) });
      }
    } else {
      // Sharp corner
      pts.push({ x: ccx + cr * Math.cos(sa), y: ccy + cr * Math.sin(sa) });
    }
    // Straight segment to next corner
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

/** Generate a single arc from startAngle to endAngle */
function genArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number, n = 40): Point2D[] {
  const pts: Point2D[] = [];
  const sa = startDeg * Math.PI / 180;
  const ea = endDeg * Math.PI / 180;
  for (let i = 0; i <= n; i++) {
    const a = sa + (ea - sa) * (i / n);
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/** Two straight lines meeting at an angle */
function genAngle(len: number, angleDeg: number, n = 40): Point2D[] {
  const pts: Point2D[] = [];
  // First segment: along +X
  for (let i = 0; i <= n; i++) {
    pts.push({ x: (len * i) / n, y: 0 });
  }
  // Second segment: at angle
  const a = angleDeg * Math.PI / 180;
  for (let i = 1; i <= n; i++) {
    const t = (len * i) / n;
    pts.push({ x: len + t * Math.cos(a), y: t * Math.sin(a) });
  }
  return pts;
}

/** Line + fillet arc + Line (L-shape with radius) */
function genFilletedCorner(len: number, r: number, angleDeg = 90, nPerSegment = 30, nArc = 16): Point2D[] {
  const pts: Point2D[] = [];
  const halfA = (angleDeg * Math.PI / 180) / 2;

  // Line 1: along +X from 0 to (len - r*tan(halfA))
  const tangentLen = r * Math.tan(halfA);
  const line1End = len - tangentLen;
  for (let i = 0; i <= nPerSegment; i++) {
    pts.push({ x: (line1End * i) / nPerSegment, y: 0 });
  }

  // Arc: center at (line1End, r) for 90° case
  const arcCx = line1End;
  const arcCy = r;
  for (let i = 1; i < nArc; i++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * (i / nArc);
    pts.push({ x: arcCx + r * Math.cos(a), y: arcCy + r * Math.sin(a) });
  }

  // Line 2: from arc end going +Y
  const arcEnd = { x: arcCx + r * Math.cos(0), y: arcCy + r * Math.sin(0) };
  // Actually, for 90° case: arc from -90° to 0°, so endpoint is (arcCx + r, arcCy)
  const line2Start = { x: arcCx + r, y: arcCy };
  const line2End = { x: arcCx + r, y: arcCy + len - tangentLen };
  for (let i = 0; i <= nPerSegment; i++) {
    const t = i / nPerSegment;
    pts.push({
      x: line2Start.x + t * (line2End.x - line2Start.x),
      y: line2Start.y + t * (line2End.y - line2Start.y),
    });
  }

  return pts;
}

/** Square with one circular hole (closed contour for the hole) */
function genHole(cx: number, cy: number, r: number, n = 48): Point2D[] {
  return genCircle(cx, cy, r, n);
}

/** Add tessellation noise to simulate marching-squares staircase */
function addStaircase(pts: Point2D[], stepSize: number): Point2D[] {
  return pts.map(p => ({
    x: Math.round(p.x / stepSize) * stepSize,
    y: Math.round(p.y / stepSize) * stepSize,
  }));
}

/** Add random noise */
function addNoise(pts: Point2D[], sigma: number): Point2D[] {
  return pts.map(p => ({
    x: p.x + (Math.random() - 0.5) * 2 * sigma,
    y: p.y + (Math.random() - 0.5) * 2 * sigma,
  }));
}

// ═══════════════════════════════════════════════════════════════
// Import fitContour by building it with esbuild at runtime
// ═══════════════════════════════════════════════════════════════

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// We need to extract fitContour from the TypeScript module.
// Create a temp file that strips the cross-section import and exports fitContour.
const root = path.resolve(import.meta.dirname ?? __dirname, '..');
const srcFile = path.join(root, 'src/lib/sketch-fitting.ts');
const srcContent = fs.readFileSync(srcFile, 'utf-8');

// Replace the import with inline types
const patched = srcContent
  .replace(/import type.*from.*cross-section.*;\n?/, `
// Inlined types for lab
type SliceAxis = 'X' | 'Y' | 'Z';
interface Contour { points: Point2D[]; windingNumber: number; }
`)
  .replace(/@\/\*/g, './*');

const tmpFile = path.join(root, '.sketch-fit-lab-tmp.ts');
fs.writeFileSync(tmpFile, patched);

// Dynamic import of the patched file via tsx
const mod: any = await import(tmpFile);
const fitContour: (pts: Point2D[], tolerance?: number) => {
  entities: any[];
  constraints: any[];
} = mod.fitContour;

// Cleanup
fs.unlinkSync(tmpFile);

// ═══════════════════════════════════════════════════════════════
// Test Framework
// ═══════════════════════════════════════════════════════════════

interface TestCase {
  name: string;
  points: Point2D[];
  expect: {
    minEntities?: number;
    maxEntities?: number;
    lines?: number;
    arcs?: number;
    circles?: number;
    totalMax?: number;
  };
  tolerance?: number;
}

function countTypes(entities: any[]) {
  let lines = 0, arcs = 0, circles = 0;
  for (const e of entities) {
    if (e.type === 'line') lines++;
    else if (e.type === 'arc') {
      if (e.isFullCircle) circles++;
      else arcs++;
    }
  }
  return { lines, arcs, circles, total: entities.length };
}

function runTest(test: TestCase): { pass: boolean; message: string; counts: ReturnType<typeof countTypes> } {
  const result = fitContour(test.points, test.tolerance);
  const c = countTypes(result.entities);
  const errs: string[] = [];

  if (test.expect.minEntities !== undefined && c.total < test.expect.minEntities) {
    errs.push(`total ${c.total} < min ${test.expect.minEntities}`);
  }
  if (test.expect.maxEntities !== undefined && c.total > test.expect.maxEntities) {
    errs.push(`total ${c.total} > max ${test.expect.maxEntities}`);
  }
  if (test.expect.lines !== undefined && c.lines !== test.expect.lines) {
    errs.push(`lines: got ${c.lines}, want ${test.expect.lines}`);
  }
  if (test.expect.arcs !== undefined && c.arcs !== test.expect.arcs) {
    errs.push(`arcs: got ${c.arcs}, want ${test.expect.arcs}`);
  }
  if (test.expect.circles !== undefined && c.circles !== test.expect.circles) {
    errs.push(`circles: got ${c.circles}, want ${test.expect.circles}`);
  }
  if (test.expect.totalMax !== undefined && c.total > test.expect.totalMax) {
    errs.push(`total ${c.total} > maxAllowed ${test.expect.totalMax}`);
  }

  return {
    pass: errs.length === 0,
    message: errs.length > 0 ? errs.join('; ') : 'OK',
    counts: c,
  };
}

// ═══════════════════════════════════════════════════════════════
// Test Cases
// ═══════════════════════════════════════════════════════════════

const tests: TestCase[] = [
  // ── 1. Perfect circle ──
  {
    name: '1. Circle (r=10, 64pts)',
    points: genCircle(0, 0, 10, 64),
    expect: { circles: 1, lines: 0, arcs: 0, totalMax: 1 },
  },
  {
    name: '2. Circle (r=2, 24pts)',
    points: genCircle(5, 5, 2, 24),
    expect: { circles: 1, lines: 0, arcs: 0, totalMax: 1 },
  },
  {
    name: '3. Circle (r=50, 128pts)',
    points: genCircle(0, 0, 50, 128),
    expect: { circles: 1, lines: 0, arcs: 0, totalMax: 1 },
  },
  // ── 2. Circle with staircase noise ──
  {
    name: '4. Circle + staircase (r=10, step=0.3)',
    points: addStaircase(genCircle(0, 0, 10, 64), 0.3),
    expect: { circles: 1, totalMax: 3 },
  },
  {
    name: '5. Circle + staircase (r=5, step=0.2)',
    points: addStaircase(genCircle(0, 0, 5, 48), 0.2),
    expect: { circles: 1, totalMax: 3 },
  },
  // ── 3. Rounded Rectangle (4 lines + 4 arcs ideally, but tolerance allows some merging) ──
  {
    name: '6. Rounded Rect (20×10, r=2)',
    points: genRoundedRect(0, 0, 20, 10, 2, 30, 16),
    expect: { circles: 0, totalMax: 12 },
  },
  {
    name: '7. Rounded Rect (10×10, r=1)',
    points: genRoundedRect(0, 0, 10, 10, 1, 20, 12),
    expect: { circles: 0, totalMax: 12 },
  },
  {
    name: '8. Rounded Rect + staircase',
    points: addStaircase(genRoundedRect(0, 0, 20, 10, 3, 30, 16), 0.2),
    expect: { totalMax: 20 },
  },
  // ── 4. Sharp square (no fillets) → 4 lines ──
  {
    name: '9. Sharp Square (20×20)',
    points: genRoundedRect(0, 0, 20, 20, 0, 40, 0),
    expect: { lines: 4, arcs: 0, circles: 0, totalMax: 8 },
  },
  // ── 5. Single arc (open contour → treated as closed, so expect extra entities) ──
  {
    name: '10. Arc 90° (r=10)',
    points: genArc(0, 0, 10, 0, 90, 30),
    expect: { totalMax: 5 },
  },
  {
    name: '11. Arc 180° (r=8)',
    points: genArc(0, 0, 8, 0, 180, 40),
    expect: { totalMax: 5 },
  },
  {
    name: '12. Arc 270° (r=15)',
    points: genArc(0, 0, 15, 0, 270, 60),
    expect: { totalMax: 5 },
  },
  // ── 6. Two lines meeting at angle (open contour, expect 2-3 lines) ──
  {
    name: '13. V-shape 90° (two lines)',
    points: genAngle(10, 90, 30),
    expect: { arcs: 0, circles: 0, totalMax: 5 },
  },
  {
    name: '14. V-shape 45° (two lines)',
    points: genAngle(10, 45, 30),
    expect: { arcs: 0, circles: 0, totalMax: 5 },
  },
  {
    name: '15. V-shape 135° (two lines)',
    points: genAngle(10, 135, 30),
    expect: { arcs: 0, circles: 0, totalMax: 5 },
  },
  // ── 7. Line + fillet + line (open contour) ──
  {
    name: '16. L-fillet (r=2, 90°)',
    points: genFilletedCorner(10, 2, 90),
    expect: { totalMax: 6 },
  },
  {
    name: '17. L-fillet (r=5, 90°)',
    points: genFilletedCorner(15, 5, 90),
    expect: { totalMax: 6 },
  },
  // ── 8. Small hole (circle that's small relative to "model") ──
  {
    name: '18. Small hole (r=1, 20pts)',
    points: genHole(0, 0, 1, 20),
    expect: { circles: 1, totalMax: 3 },
  },
  {
    name: '19. Tiny hole (r=0.5, 16pts)',
    points: genHole(0, 0, 0.5, 16),
    expect: { totalMax: 3 },
  },
  // ── 9. Large arc with staircase (simulates cylinder cross-section) ──
  {
    name: '20. Large arc + staircase (r=50, 45°)',
    points: addStaircase(genArc(0, 0, 50, 0, 45, 60), 0.5),
    expect: { totalMax: 5 },
  },
  {
    name: '21. Large arc + staircase (r=100, 30°)',
    points: addStaircase(genArc(0, 0, 100, 0, 30, 80), 0.8),
    expect: { totalMax: 5 },
  },
  // ── 10. Stress: rounded rect with staircase + noise ──
  {
    name: '22. RoundedRect + staircase + noise',
    points: addNoise(addStaircase(genRoundedRect(0, 0, 30, 15, 4, 40, 20), 0.15), 0.05),
    expect: { totalMax: 20 },
  },
];

// ═══════════════════════════════════════════════════════════════
// Run All Tests
// ═══════════════════════════════════════════════════════════════

console.log('\n⚒️  La Forja — Sketch Fit Lab\n');
console.log('━'.repeat(80));

let passed = 0, failed = 0;
const failures: { name: string; message: string; counts: any }[] = [];

for (const test of tests) {
  const res = runTest(test);
  const status = res.pass ? '✅' : '❌';
  const countsStr = `${res.counts.lines}L ${res.counts.arcs}A ${res.counts.circles}C = ${res.counts.total}`;
  console.log(`${status} ${test.name.padEnd(45)} ${countsStr.padEnd(20)} ${res.pass ? '' : res.message}`);
  if (res.pass) passed++;
  else {
    failed++;
    failures.push({ name: test.name, message: res.message, counts: res.counts });
  }
}

console.log('━'.repeat(80));
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length} tests\n`);

if (failures.length > 0) {
  console.log('❌ FAILURES:\n');
  for (const f of failures) {
    console.log(`  ${f.name}`);
    console.log(`    Got: ${f.counts.lines}L ${f.counts.arcs}A ${f.counts.circles}C = ${f.counts.total}`);
    console.log(`    ${f.message}\n`);
  }
}

process.exit(failed > 0 ? 1 : 0);
