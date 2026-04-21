/**
 * ⚒️ Fit Hunter (TS) — Runs on the REAL src/lib/sketch-fitting.ts.
 *
 * Controlled minimal shapes with known expected output.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Resvg } from '@resvg/resvg-js';
import { fitContour, type SketchEntity } from '../src/lib/sketch-fitting';
import type { Point2D } from '../src/lib/cross-section';

const __dirname_local = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname_local, '..', 'fit-diagnostics', 'hunt');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function entSummary(e: SketchEntity): string {
  if (e.type === 'line') {
    return `LINE (${e.start.x.toFixed(2)},${e.start.y.toFixed(2)})→(${e.end.x.toFixed(2)},${e.end.y.toFixed(2)}) len=${Math.hypot(e.end.x-e.start.x, e.end.y-e.start.y).toFixed(2)}`;
  }
  if (e.isFullCircle) return `CIRCLE⊙ C=(${e.center.x.toFixed(2)},${e.center.y.toFixed(2)}) R=${e.radius.toFixed(2)}`;
  const sweep = ((e.endAngle - e.startAngle) * 180 / Math.PI).toFixed(0);
  return `ARC C=(${e.center.x.toFixed(2)},${e.center.y.toFixed(2)}) R=${e.radius.toFixed(2)} sweep=${sweep}°`;
}

function renderCase(name: string, pts: Point2D[], ents: SketchEntity[]) {
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for (const p of pts) { minX=Math.min(minX,p.x); maxX=Math.max(maxX,p.x); minY=Math.min(minY,p.y); maxY=Math.max(maxY,p.y); }
  for (const e of ents) {
    if (e.type === 'line') { minX=Math.min(minX,e.start.x,e.end.x); maxX=Math.max(maxX,e.start.x,e.end.x); minY=Math.min(minY,e.start.y,e.end.y); maxY=Math.max(maxY,e.start.y,e.end.y); }
    else { minX=Math.min(minX,e.center.x-e.radius); maxX=Math.max(maxX,e.center.x+e.radius); minY=Math.min(minY,e.center.y-e.radius); maxY=Math.max(maxY,e.center.y+e.radius); }
  }
  const pad = Math.max(maxX-minX, maxY-minY) * 0.15 || 1;
  minX -= pad; maxX += pad; minY -= pad; maxY += pad;
  const W=600,H=600;
  const s = Math.min(W/(maxX-minX), H/(maxY-minY));
  const X = (x:number) => (x-minX)*s, Y = (y:number) => H - (y-minY)*s;
  const parts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#0d0f14">`];
  let d = `M ${X(pts[0].x)} ${Y(pts[0].y)}`;
  for (let i=1;i<pts.length;i++) d += ` L ${X(pts[i].x)} ${Y(pts[i].y)}`;
  d += ' Z';
  parts.push(`<path d="${d}" fill="none" stroke="#e05050" stroke-width="1.5" stroke-dasharray="3 2"/>`);
  for (const p of pts) parts.push(`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3" fill="#e05050"/>`);
  for (const e of ents) {
    if (e.type === 'line') parts.push(`<line x1="${X(e.start.x)}" y1="${Y(e.start.y)}" x2="${X(e.end.x)}" y2="${Y(e.end.y)}" stroke="#c9a84c" stroke-width="2.5"/>`);
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
  const png = new Resvg(svg, { background:'#0d0f14' as any }).render().asPng();
  fs.writeFileSync(path.join(OUT, `${name.replace(/[^\w-]/g,'_')}.png`), png);
}

interface Case {
  name: string;
  pts: Point2D[];
  check: (ents: SketchEntity[]) => { ok: boolean; expected: string };
}

const cases: Case[] = [];

// CASE 1: Rectangle with ~17 points
(() => {
  const pts: Point2D[] = [];
  for (let i = 0; i <= 4; i++) pts.push({ x: i*25, y: 0 });
  for (let i = 1; i <= 3; i++) pts.push({ x: 100, y: i*20 });
  for (let i = 1; i <= 4; i++) pts.push({ x: 100-i*25, y: 60 });
  for (let i = 1; i <= 2; i++) pts.push({ x: 0, y: 60-i*20 });
  cases.push({
    name: 'rect_17pts',
    pts,
    check: (ents) => {
      const lines = ents.filter(e => e.type === 'line').length;
      const arcs = ents.filter(e => e.type === 'arc').length;
      return { ok: lines === 4 && arcs === 0, expected: '4 LINES, 0 arcs' };
    },
  });
})();

// CASE 2: 6-pt rectangle
(() => {
  const pts: Point2D[] = [
    { x: 0, y: 0 }, { x: 50, y: 0 },
    { x: 50, y: 30 }, { x: 50, y: 60 },
    { x: 0, y: 60 }, { x: 0, y: 30 },
  ];
  cases.push({
    name: 'rect_6pts',
    pts,
    check: (ents) => {
      const lines = ents.filter(e => e.type === 'line').length;
      return { ok: lines === 4 && ents.length === 4, expected: '4 LINES' };
    },
  });
})();

// CASE 3: Near-colinear points (thin U)
(() => {
  const pts: Point2D[] = [];
  for (let i = 0; i <= 12; i++) pts.push({ x: 0, y: i * 5 });
  for (let i = 11; i >= 0; i--) pts.push({ x: 0.1, y: i * 5 });
  cases.push({
    name: 'thin_colinear_25pts',
    pts,
    check: (ents) => {
      const hasArc = ents.some(e => e.type === 'arc');
      return { ok: !hasArc, expected: 'NO circle/arc' };
    },
  });
})();

// CASE 4: Thin rect 10pts
(() => {
  const pts: Point2D[] = [
    { x: 0, y: 0 }, { x: 0, y: 20 }, { x: 0, y: 40 }, { x: 0, y: 60 }, { x: 0, y: 80 },
    { x: 1, y: 80 }, { x: 1, y: 60 }, { x: 1, y: 40 }, { x: 1, y: 20 }, { x: 1, y: 0 },
  ];
  cases.push({
    name: 'thin_rect_10pts',
    pts,
    check: (ents) => {
      const lines = ents.filter(e => e.type === 'line').length;
      const arcs = ents.filter(e => e.type === 'arc').length;
      return { ok: lines === 4 && arcs === 0, expected: '4 LINES' };
    },
  });
})();

// CASE 5: Clean full circle
(() => {
  const pts: Point2D[] = [];
  const N=24, R=25;
  for (let i=0;i<N;i++) {
    const a = 2*Math.PI*i/N;
    pts.push({ x: R*Math.cos(a), y: R*Math.sin(a) });
  }
  cases.push({
    name: 'circle_24pts_R25',
    pts,
    check: (ents) => {
      const isOne = ents.length === 1 && ents[0].type === 'arc' && (ents[0] as any).isFullCircle;
      const rOk = isOne && Math.abs((ents[0] as any).radius - 25) < 0.5;
      return { ok: isOne && rOk, expected: '1 FULL CIRCLE R=25' };
    },
  });
})();

// CASE 6: Quarter pie
(() => {
  const pts: Point2D[] = [];
  const N=12, R=30;
  for (let i=0;i<=N;i++) {
    const a = (Math.PI/2) * i/N;
    pts.push({ x: R*Math.cos(a), y: R*Math.sin(a) });
  }
  pts.push({ x: 0, y: 0 });
  cases.push({
    name: 'quarter_pie_R30',
    pts,
    check: (ents) => {
      const arcs = ents.filter(e => e.type === 'arc').length;
      const lines = ents.filter(e => e.type === 'line').length;
      const hasFull = ents.some(e => e.type === 'arc' && (e as any).isFullCircle);
      return { ok: !hasFull && arcs === 1 && lines >= 1, expected: '1 arc (90°) + 2 lines' };
    },
  });
})();

// CASE 7: Two disjoint arcs
(() => {
  const pts: Point2D[] = [];
  for (let i=0;i<=10;i++) {
    const a = Math.PI * i / 10;
    pts.push({ x: 20*Math.cos(a), y: 20*Math.sin(a) });
  }
  pts.push({ x: -20, y: 0 }, { x: -20, y: -5 }, { x: 50, y: -5 });
  for (let i=0;i<=10;i++) {
    const a = Math.PI + Math.PI * i/10;
    pts.push({ x: 30 + 20*Math.cos(a), y: 20*Math.sin(a) });
  }
  cases.push({
    name: 'two_disjoint_arcs_R20',
    pts,
    check: (ents) => {
      const circles = ents.filter(e => e.type === 'arc' && (e as any).isFullCircle).length;
      return { ok: circles === 0, expected: '0 full circles' };
    },
  });
})();

// CASE 8: Rounded rectangle
(() => {
  const pts: Point2D[] = [];
  const W=80,H=50,R=5;
  for (let i=0;i<=5;i++) pts.push({ x: R + i*(W-2*R)/5, y: 0 });
  for (let i=1;i<=4;i++) {
    const a = -Math.PI/2 + (Math.PI/2)*i/4;
    pts.push({ x: (W-R)+R*Math.cos(a), y: R+R*Math.sin(a) });
  }
  for (let i=1;i<=4;i++) pts.push({ x: W, y: R+i*(H-2*R)/4 });
  for (let i=1;i<=4;i++) {
    const a = 0 + (Math.PI/2)*i/4;
    pts.push({ x: (W-R)+R*Math.cos(a), y: (H-R)+R*Math.sin(a) });
  }
  for (let i=1;i<=5;i++) pts.push({ x: (W-R)-i*(W-2*R)/5, y: H });
  for (let i=1;i<=4;i++) {
    const a = Math.PI/2 + (Math.PI/2)*i/4;
    pts.push({ x: R+R*Math.cos(a), y: (H-R)+R*Math.sin(a) });
  }
  for (let i=1;i<=4;i++) pts.push({ x: 0, y: (H-R)-i*(H-2*R)/4 });
  for (let i=1;i<4;i++) {
    const a = Math.PI + (Math.PI/2)*i/4;
    pts.push({ x: R+R*Math.cos(a), y: R+R*Math.sin(a) });
  }
  cases.push({
    name: 'rounded_rect_80x50_R5',
    pts,
    check: (ents) => {
      const lines = ents.filter(e => e.type === 'line').length;
      const arcs = ents.filter(e => e.type === 'arc' && !(e as any).isFullCircle).length;
      const circles = ents.filter(e => e.type === 'arc' && (e as any).isFullCircle).length;
      return { ok: lines === 4 && arcs === 4 && circles === 0, expected: '4 lines + 4 arcs' };
    },
  });
})();

// ══ RUN ══
console.log('⚒️  FIT HUNTER (TS) — Controlled minimal cases\n' + '═'.repeat(60));

let pass = 0, fail = 0;
const failed: string[] = [];
for (const c of cases) {
  const result = fitContour(c.pts);
  const check = c.check(result.entities);
  renderCase(c.name, c.pts, result.entities);
  const icon = check.ok ? '✅' : '❌';
  console.log(`\n${icon} ${c.name}`);
  console.log(`   input: ${c.pts.length} points`);
  console.log(`   expected: ${check.expected}`);
  console.log(`   actual:   ${result.entities.length} entities`);
  result.entities.forEach((e, i) => console.log(`     [${i}] ${entSummary(e)}`));
  if (check.ok) pass++; else { fail++; failed.push(c.name); }
}

console.log('\n' + '═'.repeat(60));
console.log(`RESULTS: ${pass}/${cases.length} passed`);
if (failed.length) {
  console.log(`FAILED:  ${failed.join(', ')}`);
}
