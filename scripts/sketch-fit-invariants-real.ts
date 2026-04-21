/**
 * ⚒️ La Forja — Invariants on REAL viz-data (TS, runs against src/)
 * =================================================================
 * Imports fitContour directly from src/lib/sketch-fitting.ts so
 * checks reflect the live algorithm — no drift from stale CJS copies.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fitContour, type SketchEntity } from '../src/lib/sketch-fitting';
import type { Point2D } from '../src/lib/cross-section';

const __dirname_local = path.dirname(fileURLToPath(import.meta.url));
const vizDir = path.join(__dirname_local, '..', 'public', 'viz-data');

function dist(a: Point2D, b: Point2D) { return Math.hypot(a.x - b.x, a.y - b.y); }
function angleBetween(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
function sweepAng(e: SketchEntity): number {
  if (e.type !== 'arc') return 0;
  return e.endAngle - e.startAngle;
}
function pointToSegDist(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  if (l2 < 1e-20) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}
function entityLength(e: SketchEntity): number {
  if (e.type === 'line') return dist(e.start, e.end);
  if (e.isFullCircle) return 2 * Math.PI * e.radius;
  return e.radius * Math.abs(sweepAng(e));
}
function departureAngle(e: SketchEntity): number {
  if (e.type === 'line') return Math.atan2(e.end.y - e.start.y, e.end.x - e.start.x);
  const ra = Math.atan2(e.start.y - e.center.y, e.start.x - e.center.x);
  return sweepAng(e) >= 0 ? ra + Math.PI / 2 : ra - Math.PI / 2;
}
function arrivalAngle(e: SketchEntity): number {
  if (e.type === 'line') return Math.atan2(e.end.y - e.start.y, e.end.x - e.start.x);
  const ra = Math.atan2(e.end.y - e.center.y, e.end.x - e.center.x);
  return sweepAng(e) >= 0 ? ra + Math.PI / 2 : ra - Math.PI / 2;
}
function pointToEntityDist(p: Point2D, e: SketchEntity): number {
  if (e.type === 'line') return pointToSegDist(p, e.start, e.end);
  const dx = p.x - e.center.x, dy = p.y - e.center.y, d = Math.sqrt(dx * dx + dy * dy);
  const cd = Math.abs(d - e.radius);
  if (e.isFullCircle) return cd;
  const angle = Math.atan2(dy, dx), sa = e.startAngle, sw = sweepAng(e);
  let rel = angle - sa;
  if (sw >= 0) { while (rel < 0) rel += 2 * Math.PI; while (rel > 2 * Math.PI) rel -= 2 * Math.PI; if (rel <= sw + 1e-9) return cd; }
  else { while (rel > 0) rel -= 2 * Math.PI; while (rel < -2 * Math.PI) rel += 2 * Math.PI; if (rel >= sw - 1e-9) return cd; }
  return Math.min(dist(p, e.start), dist(p, e.end));
}
function shoelaceArea(pts: Point2D[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return a / 2;
}

interface CheckResult {
  issues: string[];
  pass: boolean;
  maxError: number;
  avgError: number;
  coverage: number;
  perimRatio: number;
  areaRatio: number;
  entityCount: number;
}

function checkContour(pts: Point2D[], entities: SketchEntity[], tol: number): CheckResult {
  const issues: string[] = [];
  const N = entities.length;
  if (N === 0) return { issues: ['EMPTY'], pass: false, maxError: 0, avgError: 0, coverage: 0, perimRatio: 1, areaRatio: 1, entityCount: 0 };
  const single = N === 1 && entities[0].type === 'arc' && (entities[0] as any).isFullCircle;

  let bbxmin = Infinity, bbxmax = -Infinity, bbymin = Infinity, bbymax = -Infinity;
  for (const p of pts) { if (p.x < bbxmin) bbxmin = p.x; if (p.x > bbxmax) bbxmax = p.x; if (p.y < bbymin) bbymin = p.y; if (p.y > bbymax) bbymax = p.y; }
  const bbw = bbxmax - bbxmin, bbh = bbymax - bbymin;
  const bbMinDim = Math.min(bbw, bbh), bbMaxDim = Math.max(bbw, bbh);
  const bbAspect = bbMaxDim / (bbMinDim + 1e-12);
  if (bbMinDim < tol * 2) return { issues: [], pass: true, maxError: 0, avgError: 0, coverage: 100, perimRatio: 1, areaRatio: 1, entityCount: N };

  const adaptiveTol = single ? (entities[0] as any).radius * (1 - Math.cos(Math.PI / Math.max(6, pts.length))) * 3 : tol;

  if (!single) {
    const g = dist(entities[N - 1].end, entities[0].start);
    if (g > adaptiveTol * 5) issues.push(`CLOSURE gap=${g.toFixed(4)}`);
  }
  if (!single) {
    for (let i = 0; i < N; i++) {
      const g = dist(entities[i].end, entities[(i + 1) % N].start);
      if (g > adaptiveTol * 3) issues.push(`C0[${i}→${(i + 1) % N}] gap=${g.toFixed(4)}`);
    }
  }
  if (!single && N >= 2) {
    let tt = 0;
    for (let i = 0; i < N; i++) {
      if (entities[i].type === 'arc' && !(entities[i] as any).isFullCircle) tt += sweepAng(entities[i]);
      tt += angleBetween(arrivalAngle(entities[i]), departureAngle(entities[(i + 1) % N]));
    }
    const off = Math.abs(Math.abs(tt) - 2 * Math.PI);
    if (off > 0.15) issues.push(`TURNING off=${(off * 180 / Math.PI).toFixed(1)}° (total=${(tt * 180 / Math.PI).toFixed(1)}°)`);
  }
  let maxErr = 0, sumErr = 0, uncov = 0;
  const covThresh = Math.max(adaptiveTol * 10, tol * 10);
  for (const p of pts) {
    let md = Infinity;
    for (const e of entities) { const d = pointToEntityDist(p, e); if (d < md) md = d; }
    maxErr = Math.max(maxErr, md);
    sumErr += md;
    if (md > covThresh) uncov++;
  }
  const cov = 100 * (1 - uncov / pts.length);
  if (cov < 85 && pts.length >= 12 && !(bbAspect > 50 && pts.length < 20)) issues.push(`COVERAGE=${cov.toFixed(0)}%`);
  for (let i = 0; i < N; i++) {
    const e = entities[i];
    if (e.type !== 'arc') continue;
    if ((e as any).isFullCircle) {
      const ds = Math.abs(dist(e.start, e.center) - e.radius);
      if (ds > adaptiveTol * 3) issues.push(`ARC[${i}] fc_start off=${ds.toFixed(4)}`);
    } else {
      const bbDiag = Math.sqrt(bbw * bbw + bbh * bbh);
      const arcTol = Math.max(tol * 5, bbDiag * 0.001);
      const ds = Math.abs(dist(e.start, e.center) - e.radius);
      if (ds > arcTol) issues.push(`ARC[${i}] start off=${ds.toFixed(4)}`);
      const de = Math.abs(dist(e.end, e.center) - e.radius);
      if (de > arcTol) issues.push(`ARC[${i}] end off=${de.toFixed(4)}`);
    }
  }
  for (let i = 0; i < N; i++) {
    if (entities[i].type === 'arc' && (entities[i] as any).isFullCircle && N > 1) issues.push(`FULL_CIRCLE[${i}]+${N - 1} others`);
  }
  for (let i = 0; i < N; i++) {
    const e = entities[i];
    if (e.type === 'arc' && !(e as any).isFullCircle && Math.abs(sweepAng(e)) > Math.PI * 1.9 && N > 1) issues.push(`LARGE_ARC[${i}] sweep=${(sweepAng(e) * 180 / Math.PI).toFixed(0)}°`);
  }
  let origP = 0;
  for (let i = 0; i < pts.length; i++) origP += dist(pts[i], pts[(i + 1) % pts.length]);
  let entP = 0;
  for (const e of entities) entP += entityLength(e);
  const pr = entP / Math.max(origP, 1e-12);
  if (!single && pts.length >= 12 && (pr < 0.7 || pr > 1.3)) issues.push(`PERIM ratio=${pr.toFixed(2)}`);
  const origA = shoelaceArea(pts);
  let ar = 1.0;
  if (Math.abs(origA) > 1 && pts.length >= 10 && !(bbAspect > 50 && pts.length < 20)) {
    let entA: number;
    if (single) {
      entA = Math.sign(origA || 1) * Math.PI * (entities[0] as any).radius ** 2;
    } else {
      const entPts: Point2D[] = [];
      for (const e of entities) {
        entPts.push(e.start);
        if (e.type === 'arc' && !(e as any).isFullCircle) {
          const sw = sweepAng(e);
          for (let k = 1; k < 16; k++) {
            const a = e.startAngle + sw * (k / 16);
            entPts.push({ x: e.center.x + e.radius * Math.cos(a), y: e.center.y + e.radius * Math.sin(a) });
          }
        }
      }
      entA = shoelaceArea(entPts);
    }
    ar = Math.abs(entA) / Math.max(Math.abs(origA), 1e-12);
    if (ar < 0.7 || ar > 1.3) issues.push(`AREA ratio=${ar.toFixed(2)}`);
  }

  return {
    issues,
    pass: issues.length === 0,
    maxError: maxErr,
    avgError: sumErr / pts.length,
    coverage: cov,
    perimRatio: pr,
    areaRatio: ar,
    entityCount: N,
  };
}

// ══ RUN ══
let indexData: { slug: string }[];
try {
  indexData = JSON.parse(fs.readFileSync(path.join(vizDir, 'index.json'), 'utf8'));
} catch {
  console.error('No index.json found');
  process.exit(1);
}

const slugArg = process.argv[2];
const slugs = slugArg ? [slugArg] : indexData.map(m => m.slug);

console.log('══════════════════════════════════════════════════════════════════════');
console.log('⚒️  La Forja — REAL DATA Invariants Verifier (TS against src/)');
console.log(`   ${slugs.length} models to check`);
console.log('══════════════════════════════════════════════════════════════════════\n');

let totalContours = 0, totalIssues = 0, totalPass = 0;
let skippedOpen = 0;
interface Failure extends CheckResult { slug: string; slice: string; contour: number; pts: number; }
const allFailures: Failure[] = [];

for (const slug of slugs) {
  let data: any;
  try { data = JSON.parse(fs.readFileSync(path.join(vizDir, `${slug}.json`), 'utf8')); }
  catch { continue; }

  let modelIssues = 0, modelContours = 0;

  for (let si = 0; si < (data.slices || []).length; si++) {
    const slice = data.slices[si];
    for (let ci = 0; ci < (slice.contours || []).length; ci++) {
      const raw = slice.contours[ci];
      if (!raw.points || raw.points.length < 6) continue;
      const pts: Point2D[] = raw.points.map((p: number[]) => ({ x: p[0], y: p[1] }));

      let mnX = 1e9, mxX = -1e9, mnY = 1e9, mxY = -1e9;
      for (const p of pts) { if (p.x < mnX) mnX = p.x; if (p.x > mxX) mxX = p.x; if (p.y < mnY) mnY = p.y; if (p.y > mxY) mxY = p.y; }
      const srcDiag = Math.hypot(mxX - mnX, mxY - mnY);
      const srcGap = dist(pts[0], pts[pts.length - 1]);
      if (srcGap > srcDiag * 0.01) { skippedOpen++; continue; }

      const fitResult = fitContour(pts);
      const bbox = { x: mxX - mnX, y: mxY - mnY };
      const diag = Math.hypot(bbox.x, bbox.y);
      const tolUsed = Math.max(0.001, diag * 0.002);
      const result = checkContour(pts, fitResult.entities, tolUsed);
      totalContours++;
      modelContours++;
      if (result.pass) totalPass++;
      else {
        modelIssues++;
        totalIssues++;
        allFailures.push({ slug, slice: slice.label, contour: ci, pts: pts.length, ...result });
      }
    }
  }

  const status = modelIssues === 0 ? '✅' : `🔴 ${modelIssues}`;
  console.log(`  ${status} ${slug} — ${modelContours} contours`);
}

console.log('\n══════════════════════════════════════════════════════════════════════');
console.log(`📊 RESULTS: ${totalPass}/${totalContours} closed contours pass invariants`);
console.log(`   ${totalIssues} contours with issues`);
console.log(`   ${skippedOpen} open contours skipped (not closed in source data)`);

if (allFailures.length > 0) {
  const issueCounts: Record<string, number> = {};
  for (const f of allFailures) {
    for (const iss of f.issues) {
      const type = iss.split(/[\[( ]/)[0];
      issueCounts[type] = (issueCounts[type] || 0) + 1;
    }
  }
  console.log('\n📋 ISSUE BREAKDOWN:');
  for (const [type, count] of Object.entries(issueCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${type}: ${count}`);
  }
  console.log('\n🔴 FIRST 20 FAILURES:');
  for (const f of allFailures.slice(0, 20)) {
    console.log(`   ${f.slug} | ${f.slice} | contour#${f.contour} (${f.pts}pts → ${f.entityCount}e) | maxErr=${f.maxError.toFixed(4)}`);
    for (const iss of f.issues) console.log(`     ⚠ ${iss}`);
  }
}

console.log('══════════════════════════════════════════════════════════════════════');
