#!/usr/bin/env node
/**
 * ⚒️ Fit Hunter — Controlled minimal test cases to isolate each bug.
 *
 * Strategy: the real data has hundreds of thousands of points and is noisy.
 * The precision-test suite uses clean synthetic shapes and passes 25/25
 * but real data fails. So the synthetic tests miss the ACTUAL failure modes.
 *
 * This hunter builds TINY synthetic contours (10-25 points) that replicate
 * the failure modes seen in the real-data visualizations:
 *   1. Rectangle with few points → expect 4 lines, NOT 1 circle
 *   2. Near-colinear points → expect 1 line (or rejection), NOT 1 giant circle
 *   3. Two disjoint arcs of the same radius → expect 2 arcs, NOT 1 circle
 *   4. Rect with fillets: small arcs at corners → expect 4 lines + 4 arcs
 *
 * Each case prints exactly what went wrong and the fitter diagnostic trace.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

// Reuse fitter from invariants test
const { fitContour } = require('/tmp/forja-fitter.cjs');

const OUT = path.join(__dirname, '..', 'fit-diagnostics', 'hunt');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// ── Helpers ──
function entSummary(e) {
  if (e.type === 'line') {
    return `LINE (${e.start.x.toFixed(2)},${e.start.y.toFixed(2)})→(${e.end.x.toFixed(2)},${e.end.y.toFixed(2)}) len=${Math.hypot(e.end.x-e.start.x, e.end.y-e.start.y).toFixed(2)}`;
  }
  if (e.isFullCircle) return `CIRCLE⊙ C=(${e.center.x.toFixed(2)},${e.center.y.toFixed(2)}) R=${e.radius.toFixed(2)}`;
  const sweep = ((e.endAngle - e.startAngle) * 180 / Math.PI).toFixed(0);
  return `ARC C=(${e.center.x.toFixed(2)},${e.center.y.toFixed(2)}) R=${e.radius.toFixed(2)} sweep=${sweep}°`;
}

function report(name, pts, expected, actual, passed) {
  const icon = passed ? '✅' : '❌';
  console.log(`\n${icon} ${name}`);
  console.log(`   input: ${pts.length} points`);
  console.log(`   expected: ${expected}`);
  console.log(`   actual:   ${actual.length} entities`);
  actual.forEach((e, i) => console.log(`     [${i}] ${entSummary(e)}`));
}

// SVG render — small square format for side-by-side comparison
function renderCase(name, pts, ents) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minX=Math.min(minX,p.x); maxX=Math.max(maxX,p.x); minY=Math.min(minY,p.y); maxY=Math.max(maxY,p.y); }
  for (const e of ents) {
    if (e.type === 'line') { minX=Math.min(minX,e.start.x,e.end.x); maxX=Math.max(maxX,e.start.x,e.end.x); minY=Math.min(minY,e.start.y,e.end.y); maxY=Math.max(maxY,e.start.y,e.end.y); }
    else { minX=Math.min(minX,e.center.x-e.radius); maxX=Math.max(maxX,e.center.x+e.radius); minY=Math.min(minY,e.center.y-e.radius); maxY=Math.max(maxY,e.center.y+e.radius); }
  }
  const pad = Math.max(maxX-minX, maxY-minY) * 0.15 || 1;
  minX -= pad; maxX += pad; minY -= pad; maxY += pad;
  const W = 600, H = 600;
  const s = Math.min(W/(maxX-minX), H/(maxY-minY));
  const X = x => (x-minX)*s, Y = y => H - (y-minY)*s;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#0d0f14">`];
  // raw
  let d = `M ${X(pts[0].x)} ${Y(pts[0].y)}`;
  for (let i=1;i<pts.length;i++) d+=` L ${X(pts[i].x)} ${Y(pts[i].y)}`;
  d+=' Z';
  parts.push(`<path d="${d}" fill="none" stroke="#e05050" stroke-width="1.5" stroke-dasharray="3 2"/>`);
  for (const p of pts) parts.push(`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3" fill="#e05050"/>`);
  // entities
  for (const e of ents) {
    if (e.type==='line') parts.push(`<line x1="${X(e.start.x)}" y1="${Y(e.start.y)}" x2="${X(e.end.x)}" y2="${Y(e.end.y)}" stroke="#c9a84c" stroke-width="2.5"/>`);
    else if (e.isFullCircle) parts.push(`<circle cx="${X(e.center.x)}" cy="${Y(e.center.y)}" r="${e.radius*s}" fill="none" stroke="#c9a84c" stroke-width="2.5"/>`);
    else {
      let delta = e.endAngle - e.startAngle;
      while (delta < 0) delta += 2*Math.PI;
      while (delta > 2*Math.PI) delta -= 2*Math.PI;
      const large = delta > Math.PI ? 1 : 0;
      parts.push(`<path d="M ${X(e.start.x)} ${Y(e.start.y)} A ${e.radius*s} ${e.radius*s} 0 ${large} 0 ${X(e.end.x)} ${Y(e.end.y)}" fill="none" stroke="#c9a84c" stroke-width="2.5"/>`);
    }
  }
  parts.push(`<text x="10" y="20" fill="#c9a84c" font-family="monospace" font-size="11">${name} | ${pts.length}pts → ${ents.length}e</text>`);
  parts.push('</svg>');
  const svg = parts.join('\n');
  const png = new Resvg(svg, { background:'#0d0f14' }).render().asPng();
  fs.writeFileSync(path.join(OUT, `${name.replace(/[^\w-]/g,'_')}.png`), png);
}

// ═══ TEST CASES ═══

const cases = [];

// ── CASE 1: Rectangle with 17 points (like the 904_rev_c slice) ──
// W=100, H=60, 4 points per short side, 4 per long side, + closure
(() => {
  const pts = [];
  // bottom: (0,0) → (100,0) — 5 points
  for (let i = 0; i <= 4; i++) pts.push({ x: i*25, y: 0 });
  // right: (100,0) → (100,60) — 3 points (skip duplicate corner)
  for (let i = 1; i <= 3; i++) pts.push({ x: 100, y: i*20 });
  // top: (100,60) → (0,60) — 4 points (skip duplicate)
  for (let i = 1; i <= 4; i++) pts.push({ x: 100-i*25, y: 60 });
  // left: (0,60) → (0,0) — 2 points (skip duplicates at ends)
  for (let i = 1; i <= 2; i++) pts.push({ x: 0, y: 60-i*20 });
  cases.push({
    name: 'rect_17pts',
    pts,
    check: ents => {
      const lines = ents.filter(e => e.type === 'line').length;
      const arcs = ents.filter(e => e.type === 'arc').length;
      return { ok: lines === 4 && arcs === 0, expected: '4 LINES, 0 arcs' };
    },
  });
})();

// ── CASE 2: Very few points on a rectangle (6pts, minimum to form rect) ──
(() => {
  const pts = [
    { x: 0, y: 0 }, { x: 50, y: 0 },
    { x: 50, y: 30 }, { x: 50, y: 60 },
    { x: 0, y: 60 }, { x: 0, y: 30 },
  ];
  cases.push({
    name: 'rect_6pts',
    pts,
    check: ents => {
      const lines = ents.filter(e => e.type === 'line').length;
      return { ok: lines === 4, expected: '4 LINES' };
    },
  });
})();

// ── CASE 3: Near-colinear points (25 points on a thin vertical) ──
// Simulates the ctc_03 failure: 25 pts, almost-straight line, becomes giant circle
(() => {
  const pts = [];
  for (let i = 0; i <= 12; i++) pts.push({ x: 0, y: i * 5 }); // up
  for (let i = 11; i >= 0; i--) pts.push({ x: 0.1, y: i * 5 }); // down (0.1 horizontal offset)
  cases.push({
    name: 'thin_colinear_25pts',
    pts,
    check: ents => {
      const hasCircle = ents.some(e => e.type === 'arc');
      return { ok: !hasCircle, expected: 'NO circle/arc (should be 2 lines or rejected as degenerate)' };
    },
  });
})();

// ── CASE 4: Single very tall thin rectangle (simulates long cross-section) ──
(() => {
  const pts = [
    { x: 0, y: 0 }, { x: 0, y: 20 }, { x: 0, y: 40 }, { x: 0, y: 60 }, { x: 0, y: 80 },
    { x: 1, y: 80 }, { x: 1, y: 60 }, { x: 1, y: 40 }, { x: 1, y: 20 }, { x: 1, y: 0 },
  ];
  cases.push({
    name: 'thin_rect_10pts',
    pts,
    check: ents => {
      const lines = ents.filter(e => e.type === 'line').length;
      const arcs = ents.filter(e => e.type === 'arc').length;
      return { ok: lines === 4 && arcs === 0, expected: '4 LINES (thin rectangle, NOT circle)' };
    },
  });
})();

// ── CASE 5: Clean full circle (sanity — should give 1 full circle) ──
(() => {
  const pts = [];
  const N = 24, R = 25;
  for (let i = 0; i < N; i++) {
    const a = 2 * Math.PI * i / N;
    pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) });
  }
  cases.push({
    name: 'circle_24pts_R25',
    pts,
    check: ents => {
      const isOneCircle = ents.length === 1 && ents[0].type === 'arc' && ents[0].isFullCircle;
      const radiusOk = isOneCircle && Math.abs(ents[0].radius - 25) < 0.5;
      return { ok: isOneCircle && radiusOk, expected: '1 FULL CIRCLE R=25' };
    },
  });
})();

// ── CASE 6: Partial arc 90° (NOT a circle) ──
(() => {
  const pts = [];
  const N = 12, R = 30;
  for (let i = 0; i <= N; i++) {
    const a = (Math.PI/2) * i / N;
    pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) });
  }
  // Close with 2 line segments back to origin
  pts.push({ x: 0, y: 0 });
  cases.push({
    name: 'quarter_pie_R30',
    pts,
    check: ents => {
      const arcs = ents.filter(e => e.type === 'arc').length;
      const lines = ents.filter(e => e.type === 'line').length;
      const hasFullCircle = ents.some(e => e.type === 'arc' && e.isFullCircle);
      return { ok: !hasFullCircle && arcs === 1 && lines >= 1, expected: '1 arc (90°) + 2 lines, NO full circle' };
    },
  });
})();

// ── CASE 7: Two disjoint arcs on same circle (phantom circle test) ──
// Top half of R=20 circle + bottom half shifted by 30 in x.
// If phase 3e/3b detects "chains of arcs with similar r/center", this should
// NOT collapse into a full circle because centers differ.
(() => {
  const pts = [];
  // Upper arc: R=20 at center (0,0), from 0° to 180°
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * i / 10;
    pts.push({ x: 20*Math.cos(a), y: 20*Math.sin(a) });
  }
  // Line down to shifted center
  pts.push({ x: -20, y: 0 });
  pts.push({ x: -20, y: -5 });
  pts.push({ x: 50, y: -5 }); // jump to the other arc start
  // Lower arc: R=20 at center (30, 0), from 180° to 360°
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI + Math.PI * i / 10;
    pts.push({ x: 30 + 20*Math.cos(a), y: 20*Math.sin(a) });
  }
  cases.push({
    name: 'two_disjoint_arcs_R20',
    pts,
    check: ents => {
      const circles = ents.filter(e => e.type === 'arc' && e.isFullCircle).length;
      return { ok: circles === 0, expected: '0 full circles (2 arcs + lines)' };
    },
  });
})();

// ── CASE 8: Rounded rectangle (pocket with fillets) ──
(() => {
  const pts = [];
  const W = 80, H = 50, R = 5;
  // Bottom edge (y=0), 6 points
  for (let i = 0; i <= 5; i++) pts.push({ x: R + i*(W-2*R)/5, y: 0 });
  // Bottom-right fillet (center = W-R, R), 90° arc
  for (let i = 1; i <= 4; i++) {
    const a = -Math.PI/2 + (Math.PI/2) * i/4;
    pts.push({ x: (W-R) + R*Math.cos(a), y: R + R*Math.sin(a) });
  }
  // Right edge (x=W), 4 points
  for (let i = 1; i <= 4; i++) pts.push({ x: W, y: R + i*(H-2*R)/4 });
  // Top-right fillet
  for (let i = 1; i <= 4; i++) {
    const a = 0 + (Math.PI/2) * i/4;
    pts.push({ x: (W-R) + R*Math.cos(a), y: (H-R) + R*Math.sin(a) });
  }
  // Top edge (y=H)
  for (let i = 1; i <= 5; i++) pts.push({ x: (W-R) - i*(W-2*R)/5, y: H });
  // Top-left fillet
  for (let i = 1; i <= 4; i++) {
    const a = Math.PI/2 + (Math.PI/2) * i/4;
    pts.push({ x: R + R*Math.cos(a), y: (H-R) + R*Math.sin(a) });
  }
  // Left edge (x=0)
  for (let i = 1; i <= 4; i++) pts.push({ x: 0, y: (H-R) - i*(H-2*R)/4 });
  // Bottom-left fillet
  for (let i = 1; i < 4; i++) {
    const a = Math.PI + (Math.PI/2) * i/4;
    pts.push({ x: R + R*Math.cos(a), y: R + R*Math.sin(a) });
  }
  cases.push({
    name: 'rounded_rect_80x50_R5',
    pts,
    check: ents => {
      const lines = ents.filter(e => e.type === 'line').length;
      const arcs = ents.filter(e => e.type === 'arc' && !e.isFullCircle).length;
      const circles = ents.filter(e => e.type === 'arc' && e.isFullCircle).length;
      return {
        ok: lines === 4 && arcs === 4 && circles === 0,
        expected: '4 lines + 4 arcs, 0 full circles',
      };
    },
  });
})();

// ══ RUN ══
console.log('⚒️  FIT HUNTER — Controlled minimal cases\n' + '═'.repeat(60));

let pass = 0, fail = 0;
const failed = [];
for (const c of cases) {
  const result = fitContour(c.pts);
  const check = c.check(result.entities);
  renderCase(c.name, c.pts, result.entities);
  report(c.name, c.pts, check.expected, result.entities, check.ok);
  if (check.ok) pass++; else { fail++; failed.push(c.name); }
}

console.log('\n' + '═'.repeat(60));
console.log(`RESULTS: ${pass}/${cases.length} passed`);
if (failed.length) {
  console.log(`FAILED:  ${failed.join(', ')}`);
  console.log(`\nImages: ${OUT}`);
}
