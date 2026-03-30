/**
 * ⚒️ La Forja de Hefestos — STRESS TEST LAB
 * ============================================
 * Extreme, adversarial test cases that push fitContour to its limits.
 * Multi-scale, absurd combinations, real-world nightmares.
 *
 * Usage:  npx tsx scripts/sketch-fit-stress.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface Point2D { x: number; y: number }

// ── Load fitContour from the real module ──
const root = path.resolve(import.meta.dirname ?? __dirname, '..');
const srcFile = path.join(root, 'src/lib/sketch-fitting.ts');
const srcContent = fs.readFileSync(srcFile, 'utf-8');
const patched = srcContent
  .replace(/import type.*from.*cross-section.*;\n?/, `
type SliceAxis = 'X' | 'Y' | 'Z';
interface Contour { points: Point2D[]; windingNumber: number; }
`)
  .replace(/@\/\*/g, './*');
const tmpFile = path.join(root, '.sketch-fit-stress-tmp.ts');
fs.writeFileSync(tmpFile, patched);
const mod: any = await import(tmpFile);
const fitContour: (pts: Point2D[], tolerance?: number) => {
  entities: any[];
  constraints: any[];
} = mod.fitContour;
fs.unlinkSync(tmpFile);

// ═══════════════════════════════════════════════════════════════
// Shape Generators
// ═══════════════════════════════════════════════════════════════

function genCircle(cx: number, cy: number, r: number, n = 64): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

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

function genLine(x1: number, y1: number, x2: number, y2: number, n = 30): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) });
  }
  return pts;
}

/** Closed contour: chain of segments, auto-closing last→first */
function chain(...segments: Point2D[][]): Point2D[] {
  const pts: Point2D[] = [];
  for (const seg of segments) {
    // Skip first point of each segment after the first (avoid duplication)
    const start = pts.length === 0 ? 0 : 1;
    for (let i = start; i < seg.length; i++) pts.push(seg[i]);
  }
  return pts;
}

function addStaircase(pts: Point2D[], stepSize: number): Point2D[] {
  return pts.map(p => ({
    x: Math.round(p.x / stepSize) * stepSize,
    y: Math.round(p.y / stepSize) * stepSize,
  }));
}

function addNoise(pts: Point2D[], sigma: number): Point2D[] {
  return pts.map(p => ({
    x: p.x + (Math.random() - 0.5) * 2 * sigma,
    y: p.y + (Math.random() - 0.5) * 2 * sigma,
  }));
}

/** Rounded rect as a chain that returns closed contour */
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

/** Generate a D-shape: semicircle + straight line */
function genDShape(cx: number, cy: number, r: number, nArc = 40, nLine = 20): Point2D[] {
  // Semicircle from 90° to 270° (left half)
  const arc = genArc(cx, cy, r, -90, 90, nArc);
  // Straight line closing the right side
  const line = genLine(arc[arc.length - 1].x, arc[arc.length - 1].y, arc[0].x, arc[0].y, nLine);
  return chain(arc, line);
}

/** Generate a slot: two semicircles connected by two parallel lines */
function genSlot(cx: number, cy: number, length: number, width: number, nArc = 20, nLine = 30): Point2D[] {
  const r = width / 2;
  const halfL = length / 2 - r;
  // Top line left→right
  const topLine = genLine(cx - halfL, cy + r, cx + halfL, cy + r, nLine);
  // Right semicircle
  const rightArc = genArc(cx + halfL, cy, r, 90, -90, nArc);
  // Bottom line right→left
  const botLine = genLine(cx + halfL, cy - r, cx - halfL, cy - r, nLine);
  // Left semicircle
  const leftArc = genArc(cx - halfL, cy, r, -90, -270, nArc);
  return chain(topLine, rightArc, botLine, leftArc);
}

/** Keyhole: big circle with a small rectangular slot cut into it */
function genKeyhole(cx: number, cy: number, bigR: number, slotW: number, slotH: number, n = 80): Point2D[] {
  // Most of the circle (say from 10° to 350°)
  const gapHalfAngle = Math.atan2(slotW / 2, bigR) * 180 / Math.PI;
  const arc = genArc(cx, cy, bigR, gapHalfAngle, 360 - gapHalfAngle, n);
  // Slot: rectangle jutting outward
  const lastPt = arc[arc.length - 1];
  const firstPt = arc[0];
  const slotPts: Point2D[] = [
    lastPt,
    { x: lastPt.x + slotH, y: lastPt.y },
    { x: firstPt.x + slotH, y: firstPt.y },
    firstPt,
  ];
  // Interpolate the slot edges
  const top = genLine(lastPt.x, lastPt.y, lastPt.x + slotH, lastPt.y, 10);
  const cap = genLine(lastPt.x + slotH, lastPt.y, firstPt.x + slotH, firstPt.y, 6);
  const bot = genLine(firstPt.x + slotH, firstPt.y, firstPt.x, firstPt.y, 10);
  return chain(arc, top, cap, bot);
}

// ═══════════════════════════════════════════════════════════════
// Test Infrastructure
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
    // NEW: verify specific entity properties
    noArcRadiusAbove?: number;   // No arc should have radius > X
    noArcSweepBelow?: number;    // No arc should have sweep < X degrees
    noLineLengthBelow?: number;  // No line should be shorter than X
  };
  tolerance?: number;
}

function dist(a: Point2D, b: Point2D) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
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

function runTest(test: TestCase): { pass: boolean; message: string; counts: ReturnType<typeof countTypes>; entities: any[] } {
  const result = fitContour(test.points, test.tolerance);
  const c = countTypes(result.entities);
  const errs: string[] = [];

  if (test.expect.minEntities !== undefined && c.total < test.expect.minEntities)
    errs.push(`total ${c.total} < min ${test.expect.minEntities}`);
  if (test.expect.maxEntities !== undefined && c.total > test.expect.maxEntities)
    errs.push(`total ${c.total} > max ${test.expect.maxEntities}`);
  if (test.expect.lines !== undefined && c.lines !== test.expect.lines)
    errs.push(`lines: got ${c.lines}, want ${test.expect.lines}`);
  if (test.expect.arcs !== undefined && c.arcs !== test.expect.arcs)
    errs.push(`arcs: got ${c.arcs}, want ${test.expect.arcs}`);
  if (test.expect.circles !== undefined && c.circles !== test.expect.circles)
    errs.push(`circles: got ${c.circles}, want ${test.expect.circles}`);
  if (test.expect.totalMax !== undefined && c.total > test.expect.totalMax)
    errs.push(`total ${c.total} > maxAllowed ${test.expect.totalMax}`);

  // Property checks
  for (const e of result.entities) {
    if (e.type === 'arc' && !e.isFullCircle) {
      if (test.expect.noArcRadiusAbove !== undefined && e.radius > test.expect.noArcRadiusAbove) {
        errs.push(`arc r=${e.radius.toFixed(2)} > maxR ${test.expect.noArcRadiusAbove}`);
        break;
      }
      let sw = e.endAngle - e.startAngle;
      while (sw > 2 * Math.PI) sw -= 2 * Math.PI;
      while (sw < -2 * Math.PI) sw += 2 * Math.PI;
      const swDeg = Math.abs(sw) * 180 / Math.PI;
      if (test.expect.noArcSweepBelow !== undefined && swDeg < test.expect.noArcSweepBelow) {
        errs.push(`arc sweep=${swDeg.toFixed(1)}° < min ${test.expect.noArcSweepBelow}°`);
        break;
      }
    }
    if (e.type === 'line') {
      const len = dist(e.start, e.end);
      if (test.expect.noLineLengthBelow !== undefined && len < test.expect.noLineLengthBelow) {
        errs.push(`line len=${len.toFixed(4)} < min ${test.expect.noLineLengthBelow}`);
        break;
      }
    }
  }

  return {
    pass: errs.length === 0,
    message: errs.length > 0 ? errs.join('; ') : 'OK',
    counts: c,
    entities: result.entities,
  };
}

// ═══════════════════════════════════════════════════════════════
// EXTREME TEST CASES
// ═══════════════════════════════════════════════════════════════

const tests: TestCase[] = [];
let id = 0;
function T(name: string, points: Point2D[], expect: TestCase['expect'], tolerance?: number) {
  tests.push({ name: `${++id}. ${name}`, points, expect, tolerance });
}

// ─────────────────────────────────────────────────────────
// SCALE EXTREMES: Ultra-small and ultra-large
// ─────────────────────────────────────────────────────────

T('Micro circle r=0.1 (16pts)',
  genCircle(0, 0, 0.1, 16),
  { circles: 1, totalMax: 3 });

T('Micro circle r=0.01 (12pts)',
  genCircle(0, 0, 0.01, 12),
  { totalMax: 3 });

T('Giant circle r=10000 (200pts)',
  genCircle(0, 0, 10000, 200),
  { circles: 1, totalMax: 1 });

T('Giant circle r=100000 (500pts)',
  genCircle(0, 0, 100000, 500),
  { circles: 1, totalMax: 1 });

// ─────────────────────────────────────────────────────────
// MULTI-SCALE: Huge contour with tiny features
// ─────────────────────────────────────────────────────────

// A 1000mm line, then a tiny 1mm radius fillet, then another 1000mm line,
// then a closing line back. Like a bracket with tiny fillets.
T('1000mm lines + 1mm fillet (1000:1 ratio)',
  chain(
    genLine(0, 0, 1000, 0, 100),          // long bottom line
    genArc(1000, 1, 1, -90, 0, 16),       // tiny fillet r=1
    genLine(1001, 1, 1001, 500, 50),       // long right line
    genLine(1001, 500, 0, 500, 100),       // long top line
    genLine(0, 500, 0, 0, 50),            // long left line
  ),
  { totalMax: 10, noArcRadiusAbove: 5000 });

T('500mm rect with 0.5mm fillets',
  genRoundedRect(0, 0, 500, 200, 0.5, 60, 12),
  { totalMax: 16, noArcRadiusAbove: 2500 });

T('100mm rect with 0.1mm fillets',
  genRoundedRect(0, 0, 100, 50, 0.1, 40, 10),
  { totalMax: 16 });

// ─────────────────────────────────────────────────────────
// MULTI-SCALE: Giant line + micro arc + giant line
// ─────────────────────────────────────────────────────────

T('2000mm line + r=0.5mm 90° fillet + 2000mm line (4000:1)',
  chain(
    genLine(0, 0, 2000, 0, 150),
    genArc(2000, 0.5, 0.5, -90, 0, 12),
    genLine(2000.5, 0.5, 2000.5, 2000, 150),
    genLine(2000.5, 2000, 0, 2000, 150),
    genLine(0, 2000, 0, 0, 150),
  ),
  { totalMax: 12, noArcRadiusAbove: 10000 });

// ─────────────────────────────────────────────────────────
// ABSURD LINES: Ultra-long straight lines
// ─────────────────────────────────────────────────────────

T('Single straight line 10000mm (closed → thin rectangle)',
  chain(
    genLine(0, 0, 10000, 0, 200),
    genLine(10000, 0, 10000, 0.1, 3),
    genLine(10000, 0.1, 0, 0.1, 200),
    genLine(0, 0.1, 0, 0, 3),
  ),
  { circles: 0, totalMax: 8 });

T('L-shape with very long arms (1000×1000, width=10)',
  chain(
    genLine(0, 0, 1000, 0, 80),
    genLine(1000, 0, 1000, 10, 5),
    genLine(1000, 10, 10, 10, 80),
    genLine(10, 10, 10, 1000, 80),
    genLine(10, 1000, 0, 1000, 5),
    genLine(0, 1000, 0, 0, 80),
  ),
  { circles: 0, arcs: 0, totalMax: 10 });

// ─────────────────────────────────────────────────────────
// TINY ARCS: Fillet radii that are almost invisible
// ─────────────────────────────────────────────────────────

T('Square 100×100, fillets r=0.05',
  genRoundedRect(0, 0, 100, 100, 0.05, 40, 8),
  { totalMax: 16 });

T('Square 50×50, fillets r=0.01',
  genRoundedRect(0, 0, 50, 50, 0.01, 30, 6),
  { totalMax: 16 });

// ─────────────────────────────────────────────────────────
// HUGE ARCS: Arcs that span almost-circles
// ─────────────────────────────────────────────────────────

T('Arc 330° r=100 (big gap, should NOT be circle)',
  genArc(0, 0, 100, 15, 330, 100),    // 315° span with 45° gap
  { circles: 0, totalMax: 5 });

T('Arc 345° r=50 (small gap, still NOT full circle)',
  genArc(0, 0, 50, 10, 350, 100),     // 340° span with 20° gap
  { circles: 0, totalMax: 5 });

T('Arc 10° r=500 (huge radius tiny sweep → is it an arc or line?)',
  genArc(0, 0, 500, 0, 10, 30),
  { totalMax: 5, noArcRadiusAbove: 1000 });

T('Arc 5° r=1000 (extreme: should become a line)',
  genArc(0, 0, 1000, 0, 5, 20),
  { totalMax: 5 });

// ─────────────────────────────────────────────────────────
// D-SHAPES and SLOTS
// ─────────────────────────────────────────────────────────

T('D-shape (semicircle + line, r=20)',
  genDShape(0, 0, 20, 40, 20),
  { totalMax: 5 });

T('D-shape tiny (r=0.5)',
  genDShape(0, 0, 0.5, 20, 10),
  { totalMax: 5 });

T('Slot 100×20 (two semicircles + two lines)',
  genSlot(0, 0, 100, 20),
  { totalMax: 8 });

T('Slot 10×2 (tiny slot)',
  genSlot(0, 0, 10, 2),
  { totalMax: 8 });

T('Slot 1000×5 (extreme aspect ratio 200:1)',
  genSlot(0, 0, 1000, 5, 20, 80),
  { totalMax: 8, noArcRadiusAbove: 500 });

// ─────────────────────────────────────────────────────────
// KEYHOLE: Circle + small slot cutout
// ─────────────────────────────────────────────────────────

T('Keyhole: r=50 circle, 5×20 slot',
  genKeyhole(0, 0, 50, 5, 20, 80),
  { totalMax: 8 });

T('Keyhole: r=100 circle, 2×50 slot',
  genKeyhole(0, 0, 100, 2, 50, 120),
  { totalMax: 8 });

// ─────────────────────────────────────────────────────────
// STAIRCASE COMBINATIONS (simulates GPU tessellation)
// ─────────────────────────────────────────────────────────

T('Giant circle r=500 + heavy staircase (step=5)',
  addStaircase(genCircle(0, 0, 500, 200), 5),
  { circles: 1, totalMax: 5 });

T('Slot 200×30 + staircase (step=1)',
  addStaircase(genSlot(0, 0, 200, 30, 30, 50), 1),
  { totalMax: 12 });

T('D-shape r=100 + staircase (step=2)',
  addStaircase(genDShape(0, 0, 100, 80, 40), 2),
  { totalMax: 8 });

T('Rounded rect 300×150 r=10 + staircase (step=0.5)',
  addStaircase(genRoundedRect(0, 0, 300, 150, 10, 60, 20), 0.5),
  { totalMax: 20 });

// ─────────────────────────────────────────────────────────
// NOISE STRESS
// ─────────────────────────────────────────────────────────

T('Circle r=20 + heavy noise (σ=0.5)',
  addNoise(genCircle(0, 0, 20, 80), 0.5),
  { circles: 1, totalMax: 5 });

T('Circle r=5 + heavy noise (σ=0.2)',
  addNoise(genCircle(0, 0, 5, 48), 0.2),
  { totalMax: 8 }); // Noise is 4% of radius — may fragment, just shouldn't explode

T('Slot 80×10 + noise (σ=0.3)',
  addNoise(genSlot(0, 0, 80, 10, 20, 40), 0.3),
  { totalMax: 12 });

// ─────────────────────────────────────────────────────────
// COMPLEX COMBOS: Multiple features in single contour
// ─────────────────────────────────────────────────────────

// Closed contour that looks like a bolt head cross-section:
// Hexagonal outer shape
T('Hexagon (6 straight sides, r=30)',
  (() => {
    const pts: Point2D[] = [];
    const R = 30;
    // Generate actual flat hexagonal edges, NOT points on circle
    const verts: Point2D[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (2 * Math.PI * i) / 6;
      verts.push({ x: R * Math.cos(a), y: R * Math.sin(a) });
    }
    for (let i = 0; i < 6; i++) {
      const v1 = verts[i], v2 = verts[(i + 1) % 6];
      const n = 20;
      for (let j = 0; j < n; j++) {
        const t = j / n;
        pts.push({ x: v1.x + t * (v2.x - v1.x), y: v1.y + t * (v2.y - v1.y) });
      }
    }
    return pts;
  })(),
  { lines: 6, arcs: 0, circles: 0, totalMax: 8 });

// Hexagon with rounded corners
T('Hexagon r=30 with 2mm fillets',
  (() => {
    const pts: Point2D[] = [];
    const R = 30, fr = 2;
    for (let i = 0; i < 6; i++) {
      const a1 = (2 * Math.PI * i) / 6;
      const a2 = (2 * Math.PI * (i + 1)) / 6;
      // Corner at a2
      const aMid = (a1 + a2) / 2;
      // Straight portion (not all the way to corner)
      const edgeLen = 2 * R * Math.sin(Math.PI / 6);
      const trimFrac = fr / edgeLen; // fraction to trim for fillet
      // Line from (trim past a1 corner) to (trim before a2 corner)
      for (let j = 0; j <= 15; j++) {
        const t = trimFrac + j / 15 * (1 - 2 * trimFrac);
        const a = a1 + t * (a2 - a1);
        pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) });
      }
      // Fillet arc at corner a2
      const ca2 = a2;
      const filletCenter = { x: (R - fr / Math.cos(Math.PI / 6)) * Math.cos(ca2), y: (R - fr / Math.cos(Math.PI / 6)) * Math.sin(ca2) };
      for (let j = 1; j < 8; j++) {
        const frac = j / 8;
        const fa = ca2 - Math.PI / 6 + frac * (Math.PI / 3);
        pts.push({ x: filletCenter.x + fr * Math.cos(fa), y: filletCenter.y + fr * Math.sin(fa) });
      }
    }
    return pts;
  })(),
  { totalMax: 18 }); // 6 lines + 6 arcs max = 12, but allow some slack

// Gear tooth profile: series of arcs + lines
T('Gear tooth: 8 teeth on r=40 gear',
  (() => {
    const pts: Point2D[] = [];
    const teeth = 8;
    const outerR = 45, innerR = 35, tipR = 3;
    for (let t = 0; t < teeth; t++) {
      const baseAngle = (2 * Math.PI * t) / teeth;
      const toothWidth = (2 * Math.PI) / teeth;
      // Inner arc (root)
      for (let j = 0; j <= 8; j++) {
        const a = baseAngle + toothWidth * 0.05 + (toothWidth * 0.2) * (j / 8);
        pts.push({ x: innerR * Math.cos(a), y: innerR * Math.sin(a) });
      }
      // Rise: line from inner to outer
      const riseStartA = baseAngle + toothWidth * 0.25;
      const riseEndA = baseAngle + toothWidth * 0.35;
      for (let j = 0; j <= 6; j++) {
        const frac = j / 6;
        const r = innerR + frac * (outerR - innerR);
        const a = riseStartA + frac * (riseEndA - riseStartA);
        pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
      }
      // Tip arc
      const tipCenterA = baseAngle + toothWidth * 0.5;
      for (let j = 0; j <= 6; j++) {
        const a = tipCenterA - 0.06 + 0.12 * (j / 6);
        pts.push({ x: outerR * Math.cos(a), y: outerR * Math.sin(a) });
      }
      // Fall: line from outer to inner
      const fallStartA = baseAngle + toothWidth * 0.65;
      const fallEndA = baseAngle + toothWidth * 0.75;
      for (let j = 0; j <= 6; j++) {
        const frac = j / 6;
        const r = outerR - frac * (outerR - innerR);
        const a = fallStartA + frac * (fallEndA - fallStartA);
        pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
      }
      // Inner arc on other side (root)
      for (let j = 0; j <= 8; j++) {
        const a = baseAngle + toothWidth * 0.75 + (toothWidth * 0.2) * (j / 8);
        pts.push({ x: innerR * Math.cos(a), y: innerR * Math.sin(a) });
      }
    }
    return pts;
  })(),
  { circles: 0, totalMax: 60 }); // 8 teeth × (line + arc + line + arc) ~ 32-48

// I-beam cross section: two horizontal flanges + vertical web
T('I-beam (200×100×10) no fillets',
  chain(
    genLine(-50, 0, 50, 0, 30),          // bottom flange bottom
    genLine(50, 0, 50, 10, 5),           // right of bottom flange
    genLine(50, 10, 5, 10, 20),          // bottom flange top right
    genLine(5, 10, 5, 190, 40),          // web right
    genLine(5, 190, 50, 190, 20),        // top flange bottom right
    genLine(50, 190, 50, 200, 5),        // right of top flange
    genLine(50, 200, -50, 200, 30),      // top flange top
    genLine(-50, 200, -50, 190, 5),      // left of top flange
    genLine(-50, 190, -5, 190, 20),      // top flange bottom left
    genLine(-5, 190, -5, 10, 40),        // web left
    genLine(-5, 10, -50, 10, 20),        // bottom flange top left
    genLine(-50, 10, -50, 0, 5),         // left of bottom flange
  ),
  { lines: 12, arcs: 0, circles: 0, totalMax: 14 });

// I-beam with fillets at web-flange junctions (4 fillets)
T('I-beam with r=3 fillets at junctions',
  chain(
    genLine(-50, 0, 50, 0, 30),
    genLine(50, 0, 50, 10, 5),
    genLine(50, 10, 8, 10, 20),
    genArc(8, 13, 3, -90, 0, 10),       // fillet
    genLine(11, 13, 11, 187, 38),
    genArc(8, 187, 3, 0, 90, 10),       // fillet
    genLine(8, 190, 50, 190, 20),
    genLine(50, 190, 50, 200, 5),
    genLine(50, 200, -50, 200, 30),
    genLine(-50, 200, -50, 190, 5),
    genLine(-50, 190, -8, 190, 20),
    genArc(-8, 187, 3, 90, 180, 10),    // fillet
    genLine(-11, 187, -11, 13, 38),
    genArc(-8, 13, 3, 180, 270, 10),    // fillet
    genLine(-8, 10, -50, 10, 20),
    genLine(-50, 10, -50, 0, 5),
  ),
  { totalMax: 22 }); // 12 lines + 4 arcs = 16 ideal, but allow merging

// ─────────────────────────────────────────────────────────
// NEAR-DEGENERATE CASES
// ─────────────────────────────────────────────────────────

T('Near-zero area triangle (very thin)',
  chain(
    genLine(0, 0, 100, 0, 50),
    genLine(100, 0, 50, 0.01, 25),
    genLine(50, 0.01, 0, 0, 25),
  ),
  { circles: 0, arcs: 0, totalMax: 6 });

T('Collinear points (perfect line as closed shape)',
  chain(
    genLine(0, 0, 200, 0, 100),
    genLine(200, 0, 200, 0.001, 2),
    genLine(200, 0.001, 0, 0.001, 100),
    genLine(0, 0.001, 0, 0, 2),
  ),
  { circles: 0, totalMax: 8 });

T('Two concentric-ish arcs (not a circle)',
  chain(
    genArc(0, 0, 50, 0, 180, 60),
    genArc(0, 0, 45, 180, 360, 60),
  ),
  { circles: 0, totalMax: 6 });

// ─────────────────────────────────────────────────────────
// ADVERSARIAL: Things that SHOULDN'T be circles
// ─────────────────────────────────────────────────────────

T('Ellipse-ish (40×20) — NO circle',
  (() => {
    const pts: Point2D[] = [];
    for (let i = 0; i < 80; i++) {
      const a = (2 * Math.PI * i) / 80;
      pts.push({ x: 40 * Math.cos(a), y: 20 * Math.sin(a) });
    }
    return pts;
  })(),
  { circles: 0, totalMax: 20 });

T('Egg shape (asymmetric) — NO circle',
  (() => {
    const pts: Point2D[] = [];
    for (let i = 0; i < 80; i++) {
      const a = (2 * Math.PI * i) / 80;
      const r = 20 + 12 * Math.cos(a); // bigger on one side (ratio 4:1 major/minor)
      pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
    }
    return pts;
  })(),
  { circles: 0, totalMax: 20 });

T('Square rotated 45° — 4 lines, NO arcs',
  (() => {
    const s = 50;
    const pts: Point2D[] = [];
    const corners = [
      { x: s, y: 0 }, { x: 0, y: s }, { x: -s, y: 0 }, { x: 0, y: -s },
    ];
    for (let i = 0; i < 4; i++) {
      const c1 = corners[i], c2 = corners[(i + 1) % 4];
      for (let j = 0; j < 25; j++) {
        const t = j / 25;
        pts.push({ x: c1.x + t * (c2.x - c1.x), y: c1.y + t * (c2.y - c1.y) });
      }
    }
    return pts;
  })(),
  { lines: 4, arcs: 0, circles: 0, totalMax: 6 });

// ─────────────────────────────────────────────────────────
// ADVERSARIAL STAIRCASE — the GPU nightmare
// ─────────────────────────────────────────────────────────

T('Staircase circle r=10, step=1 (brutal quantization)',
  addStaircase(genCircle(0, 0, 10, 32), 1),
  { totalMax: 8 }); // step=1 is 10% of radius — too brutal for reliable circle detection

T('Staircase circle r=3, step=0.5 (pixels bigger than radius!)',
  addStaircase(genCircle(0, 0, 3, 20), 0.5),
  { totalMax: 8 }); // may not detect circle, but shouldn't explode

T('Staircase slot 50×8, step=1',
  addStaircase(genSlot(0, 0, 50, 8, 16, 30), 1),
  { totalMax: 16 });

T('Staircase I-beam, step=2',
  addStaircase(chain(
    genLine(-50, 0, 50, 0, 30),
    genLine(50, 0, 50, 10, 5),
    genLine(50, 10, 5, 10, 20),
    genLine(5, 10, 5, 190, 40),
    genLine(5, 190, 50, 190, 20),
    genLine(50, 190, 50, 200, 5),
    genLine(50, 200, -50, 200, 30),
    genLine(-50, 200, -50, 190, 5),
    genLine(-50, 190, -5, 190, 20),
    genLine(-5, 190, -5, 10, 40),
    genLine(-5, 10, -50, 10, 20),
    genLine(-50, 10, -50, 0, 5),
  ), 2),
  { circles: 0, totalMax: 24 }); // staircase may fragment, but bounded

// ─────────────────────────────────────────────────────────
// ZEBRA: Alternating line-arc-line-arc...
// ─────────────────────────────────────────────────────────

T('Zigzag 10 segments (alternating 90° turns)',
  (() => {
    const pts: Point2D[] = [];
    const segLen = 20;
    let x = 0, y = 0, angle = 0;
    for (let i = 0; i < 10; i++) {
      const nx = x + segLen * Math.cos(angle);
      const ny = y + segLen * Math.sin(angle);
      for (let j = 0; j <= 15; j++) {
        const t = j / 15;
        pts.push({ x: x + t * (nx - x), y: y + t * (ny - y) });
      }
      x = nx; y = ny;
      angle += (i % 2 === 0 ? 1 : -1) * (90 * Math.PI / 180); // sharp 90° turns
    }
    // Close back to origin
    for (let j = 0; j <= 15; j++) {
      const t = j / 15;
      pts.push({ x: x + t * (0 - x), y: y + t * (0 - y) });
    }
    return pts;
  })(),
  { circles: 0, arcs: 0, totalMax: 18 });

T('Sine wave approximation (20 line segments)',
  (() => {
    const pts: Point2D[] = [];
    const n = 200;
    for (let i = 0; i < n; i++) {
      const x = (i / n) * 100;
      const y = 10 * Math.sin((x / 100) * 4 * Math.PI);
      pts.push({ x, y });
    }
    // Close it
    for (let i = 0; i < 20; i++) {
      const t = i / 20;
      pts.push({ x: 100 * (1 - t), y: 0 });
    }
    return pts;
  })(),
  { circles: 0, totalMax: 30 });

// ─────────────────────────────────────────────────────────
// REAL-WORLD: Shapes from the screenshots
// ─────────────────────────────────────────────────────────

// Phone-like profile: rect with large corner radii
T('Phone profile 160×75, r=12',
  genRoundedRect(0, 0, 160, 75, 12, 50, 20),
  { totalMax: 12 });

// Screw head: large circle with a cross slot
// (This is a single contour for the circle)
T('Screw head r=8 (pure circle)',
  genCircle(0, 0, 8, 36),
  { circles: 1, totalMax: 1 });

// Bearing cross-section: circle with step
T('Bearing: r=25 outer circle',
  genCircle(0, 0, 25, 64),
  { circles: 1, totalMax: 1 });

// Cylinder bore: large circle
T('Cylinder bore r=75',
  genCircle(0, 0, 75, 100),
  { circles: 1, totalMax: 1 });

// Watch case: circle with lugs (complex profile)
T('Watch case profile (circle + 2 rect protrusions)',
  (() => {
    const pts: Point2D[] = [];
    const R = 20;
    // Main circle from 30° to 150°
    for (let i = 0; i <= 30; i++) {
      const a = (30 + i * 4) * Math.PI / 180;
      pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) });
    }
    // Left lug (rectangle protrusion)
    const lugW = 5, lugH = 15;
    const lugTop = pts[pts.length - 1];
    pts.push({ x: lugTop.x, y: lugTop.y + lugH });
    pts.push({ x: lugTop.x - lugW, y: lugTop.y + lugH });
    pts.push({ x: lugTop.x - lugW, y: lugTop.y });
    // Continue circle 150° to 210°
    for (let i = 0; i <= 15; i++) {
      const a = (150 + i * 4) * Math.PI / 180;
      pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) });
    }
    // Bottom
    for (let i = 0; i <= 30; i++) {
      const a = (210 + i * 4) * Math.PI / 180;
      pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) });
    }
    // Right lug
    const lugBot = pts[pts.length - 1];
    pts.push({ x: lugBot.x, y: lugBot.y - lugH });
    pts.push({ x: lugBot.x + lugW, y: lugBot.y - lugH });
    pts.push({ x: lugBot.x + lugW, y: lugBot.y });
    // Close back to start
    for (let i = 0; i <= 7; i++) {
      const a = (330 + i * 4 + 30) * Math.PI / 180;
      pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) });
    }
    return pts;
  })(),
  { circles: 0, totalMax: 20 });

// ─────────────────────────────────────────────────────────
// FINAL BOSS: All-in-one stress
// ─────────────────────────────────────────────────────────

T('BOSS: 1000mm profile + 3 different fillet radii (0.5, 2, 10) + staircase step=0.3',
  addStaircase(chain(
    genLine(0, 0, 500, 0, 80),
    genArc(500, 0.5, 0.5, -90, 0, 8),     // tiny fillet
    genLine(500.5, 0.5, 500.5, 200, 40),
    genArc(498.5, 200, 2, 0, 90, 12),     // medium fillet
    genLine(498.5, 202, 100, 202, 60),
    genArc(100, 192, 10, 90, 180, 20),    // big fillet
    genLine(90, 192, 90, 50, 30),
    genLine(90, 50, 0, 50, 20),
    genLine(0, 50, 0, 0, 10),
  ), 0.3),
  { totalMax: 25, noArcRadiusAbove: 1000 });

T('BOSS: Nested circles simulation (slice cutting through 3 holes)',
  (() => {
    // 3 separate circles at different positions — but as ONE contour (impossible IRL)
    // This tests that the fitter doesn't merge them into one circle
    // Actually this should be 3 separate contours, but let's chain them weirdly
    // to see what happens—just a stress test
    const c1 = genCircle(-100, 0, 30, 40);
    const c2 = genCircle(0, 0, 15, 30);
    const c3 = genCircle(100, 0, 45, 50);
    // Connect them with lines
    return chain(
      c1,
      genLine(c1[0].x, c1[0].y, c2[0].x, c2[0].y, 10),
      c2,
      genLine(c2[0].x, c2[0].y, c3[0].x, c3[0].y, 10),
      c3,
      genLine(c3[0].x, c3[0].y, c1[0].x, c1[0].y, 10),
    );
  })(),
  { circles: 0, totalMax: 30 }); // This is weird topology, just shouldn't crash

// ═══════════════════════════════════════════════════════════════
// Run All Tests
// ═══════════════════════════════════════════════════════════════

console.log('\n⚒️  La Forja — STRESS TEST LAB\n');
console.log('━'.repeat(90));

let passed = 0, failed = 0;
const failures: { name: string; message: string; counts: any; entities: any[] }[] = [];

for (const test of tests) {
  const res = runTest(test);
  const status = res.pass ? '✅' : '❌';
  const countsStr = `${res.counts.lines}L ${res.counts.arcs}A ${res.counts.circles}C = ${res.counts.total}`;
  const detail = res.pass ? '' : `  ← ${res.message}`;
  console.log(`${status} ${test.name.padEnd(58)} ${countsStr.padEnd(18)}${detail}`);
  if (res.pass) passed++;
  else {
    failed++;
    failures.push({ name: test.name, message: res.message, counts: res.counts, entities: res.entities });
  }
}

console.log('━'.repeat(90));
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length} tests\n`);

if (failures.length > 0) {
  console.log('❌ FAILURES DETAIL:\n');
  for (const f of failures) {
    console.log(`  ${f.name}`);
    console.log(`    Got: ${f.counts.lines}L ${f.counts.arcs}A ${f.counts.circles}C = ${f.counts.total}`);
    console.log(`    ${f.message}`);
    // Show entity details for debugging
    for (let i = 0; i < Math.min(f.entities.length, 10); i++) {
      const e = f.entities[i];
      if (e.type === 'line') {
        const len = dist(e.start, e.end);
        console.log(`      [${i}] LINE len=${len.toFixed(3)} (${e.start.x.toFixed(2)},${e.start.y.toFixed(2)})→(${e.end.x.toFixed(2)},${e.end.y.toFixed(2)})`);
      } else if (e.type === 'arc') {
        let sw = e.endAngle - e.startAngle;
        while (sw > 2 * Math.PI) sw -= 2 * Math.PI;
        while (sw < -2 * Math.PI) sw += 2 * Math.PI;
        const swDeg = Math.abs(sw) * 180 / Math.PI;
        console.log(`      [${i}] ${e.isFullCircle ? 'CIRCLE' : 'ARC'} r=${e.radius.toFixed(3)} sweep=${swDeg.toFixed(1)}° center=(${e.center.x.toFixed(2)},${e.center.y.toFixed(2)})`);
      }
    }
    if (f.entities.length > 10) console.log(`      ... +${f.entities.length - 10} more`);
    console.log();
  }
}

process.exit(failed > 0 ? 1 : 0);
