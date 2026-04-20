/**
 * Contour-to-JPG — La Forja de Hefestos
 * 
 * Renders each contour as a JPG image showing:
 *  - Original sample points (green dots, red when high error)
 *  - Fitted entities: lines (cyan), arcs (magenta), circles (gold)
 *  - Error lines from high-error points to nearest entity (red dashed)
 *  - Entity index labels
 *  - Stats overlay (pts, entities, maxErr, diag)
 * 
 * Usage: npx tsx scripts/contour-to-jpg.ts [model-name]
 * Output: debug-jpg/contour_NNN_slice.jpg
 */
import { createCanvas } from 'canvas';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fitContour, type Point2D, type SketchEntity, type SketchArc, type SketchFitResult } from '../src/lib/sketch-fitting.ts';

const VIZ_DIR = join(import.meta.dirname!, '..', 'public', 'viz-data');
const OUT_DIR = join(import.meta.dirname!, '..', 'debug-jpg');
const TARGET = process.argv[2] || 'nist_ctc_01_asme1_ap242-e1';
const W = 1200, H = 900;

mkdirSync(OUT_DIR, { recursive: true });

function d(a: Point2D, b: Point2D) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function distToLine(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return d(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return d(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function distToArc(p: Point2D, arc: SketchArc): number {
  const dx = p.x - arc.center.x, dy = p.y - arc.center.y;
  const rp = Math.sqrt(dx * dx + dy * dy);
  const radialDist = Math.abs(rp - arc.radius);
  if (arc.isFullCircle) return radialDist;
  let angle = Math.atan2(dy, dx);
  let sa = arc.startAngle, ea = arc.endAngle;
  while (angle < 0) angle += 2 * Math.PI;
  while (sa < 0) sa += 2 * Math.PI;
  while (ea < 0) ea += 2 * Math.PI;
  let sweep = ea - sa; if (sweep < 0) sweep += 2 * Math.PI;
  let diff = angle - sa; if (diff < 0) diff += 2 * Math.PI;
  if (diff <= sweep) return radialDist;
  return Math.min(d(p, arc.start), d(p, arc.end));
}

function distToEntity(p: Point2D, e: SketchEntity): number {
  if (e.type === 'line') return distToLine(p, e.start, e.end);
  return distToArc(p, e as SketchArc);
}

function nearestEntity(p: Point2D, ents: SketchEntity[]): { dist: number; idx: number } {
  let min = Infinity, idx = 0;
  for (let i = 0; i < ents.length; i++) {
    const dd = distToEntity(p, ents[i]);
    if (dd < min) { min = dd; idx = i; }
  }
  return { dist: min, idx };
}

function closestPointOnLine(p: Point2D, a: Point2D, b: Point2D): Point2D {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return a;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

function closestPointOnArc(p: Point2D, arc: SketchArc): Point2D {
  const angle = Math.atan2(p.y - arc.center.y, p.x - arc.center.x);
  return { x: arc.center.x + arc.radius * Math.cos(angle), y: arc.center.y + arc.radius * Math.sin(angle) };
}

function entityLength(e: SketchEntity): number {
  if (e.type === 'line') return d(e.start, e.end);
  const arc = e as SketchArc;
  if (arc.isFullCircle) return 2 * Math.PI * arc.radius;
  let sw = arc.endAngle - arc.startAngle;
  while (sw < 0) sw += 2 * Math.PI;
  return Math.abs(sw) * arc.radius;
}

// ─── Read model ────────────────────────────────────────────────
const raw = JSON.parse(readFileSync(join(VIZ_DIR, `${TARGET}.json`), 'utf-8'));
const slices: any[] = raw.slices;
console.log(`Model: ${TARGET} — ${slices.length} slices`);

let globalIdx = 0;

for (const slice of slices) {
  for (const contourObj of slice.contours) {
    const rawPts: number[][] = contourObj.points;
    const pts: Point2D[] = rawPts.map(p => ({ x: p[0], y: p[1] }));
    if (pts.length < 3) { globalIdx++; continue; }

    // Bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    const diag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
    if (diag < 1e-6) { globalIdx++; continue; }
    const tol = Math.max(0.001, diag * 0.002);

    // Fit
    const result: SketchFitResult = fitContour(pts);
    const entities = result.entities;
    if (!entities || entities.length === 0) { globalIdx++; continue; }

    // Extend bounds to include entity geometry
    for (const e of entities) {
      for (const ep of [e.start, e.end]) {
        if (ep.x < minX) minX = ep.x; if (ep.x > maxX) maxX = ep.x;
        if (ep.y < minY) minY = ep.y; if (ep.y > maxY) maxY = ep.y;
      }
      if (e.type !== 'line') {
        const arc = e as SketchArc;
        const r = arc.radius;
        if (arc.center.x - r < minX) minX = arc.center.x - r;
        if (arc.center.x + r > maxX) maxX = arc.center.x + r;
        if (arc.center.y - r < minY) minY = arc.center.y - r;
        if (arc.center.y + r > maxY) maxY = arc.center.y + r;
      }
    }

    // Per-point error
    const errors = pts.map(p => nearestEntity(p, entities));
    const maxErr = Math.max(...errors.map(e => e.dist));
    const avgErr = errors.reduce((s, e) => s + e.dist, 0) / errors.length;
    const hiCount = errors.filter(e => e.dist > tol).length;

    // ─── Render ────────────────────────────────────────────
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);

    // Transform
    const pad = 60;
    const dw = maxX - minX || 1;
    const dh = maxY - minY || 1;
    const sc = Math.min((W - 2 * pad) / dw, (H - 2 * pad) / dh);
    const ox = pad + ((W - 2 * pad) - dw * sc) / 2;
    const oy = pad + ((H - 2 * pad) - dh * sc) / 2;
    const tx = (x: number) => ox + (x - minX) * sc;
    const ty = (y: number) => H - oy - (y - minY) * sc; // flip Y

    // Grid
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 0.5;
    const gridStep = Math.pow(10, Math.floor(Math.log10(dw / 5)));
    for (let x = Math.ceil(minX / gridStep) * gridStep; x <= maxX; x += gridStep) {
      ctx.beginPath(); ctx.moveTo(tx(x), 0); ctx.lineTo(tx(x), H); ctx.stroke();
    }
    for (let y = Math.ceil(minY / gridStep) * gridStep; y <= maxY; y += gridStep) {
      ctx.beginPath(); ctx.moveTo(0, ty(y)); ctx.lineTo(W, ty(y)); ctx.stroke();
    }

    // ─── Draw entities ─────────────────────────────────────
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const len = entityLength(e);
      const pct = len / diag * 100;
      const tiny = pct < 2;

      if (e.type === 'line') {
        ctx.strokeStyle = tiny ? '#f44' : '#5df';
        ctx.lineWidth = tiny ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(tx(e.start.x), ty(e.start.y));
        ctx.lineTo(tx(e.end.x), ty(e.end.y));
        ctx.stroke();
      } else {
        const arc = e as SketchArc;
        ctx.strokeStyle = tiny ? '#f44' : (arc.isFullCircle ? '#fd3' : '#f5a');
        ctx.lineWidth = tiny ? 3 : 2;
        const cx = tx(arc.center.x), cy = ty(arc.center.y);
        const r = arc.radius * sc;
        if (arc.isFullCircle) {
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(cx, cy, r, -arc.endAngle, -arc.startAngle);
          ctx.stroke();
        }
      }

      // Entity endpoint dots
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(tx(e.start.x), ty(e.start.y), 3, 0, 2 * Math.PI); ctx.fill();
      ctx.beginPath(); ctx.arc(tx(e.end.x), ty(e.end.y), 3, 0, 2 * Math.PI); ctx.fill();

      // Label
      const mx = (e.start.x + e.end.x) / 2;
      const my = (e.start.y + e.end.y) / 2;
      const len2 = entityLength(e);
      ctx.fillStyle = tiny ? '#f44' : '#ccc';
      ctx.font = '11px monospace';
      ctx.fillText(`#${i} ${e.type === 'line' ? 'L' : 'A'} ${len2.toFixed(1)}`, tx(mx) + 4, ty(my) - 6);
    }

    // ─── Error lines from high-error points ────────────────
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,80,80,0.6)';
    for (let i = 0; i < pts.length; i++) {
      if (errors[i].dist > tol * 3) {
        const p = pts[i];
        const e = entities[errors[i].idx];
        let near: Point2D;
        if (e.type === 'line') near = closestPointOnLine(p, e.start, e.end);
        else near = closestPointOnArc(p, e as SketchArc);
        ctx.beginPath();
        ctx.moveTo(tx(p.x), ty(p.y));
        ctx.lineTo(tx(near.x), ty(near.y));
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // ─── Draw points ───────────────────────────────────────
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const err = errors[i].dist;
      const ratio = Math.min(1, err / (tol * 20));
      const r = Math.round(255 * ratio);
      const g = Math.round(255 * (1 - ratio));
      ctx.fillStyle = `rgb(${r},${g},50)`;
      const sz = err > tol ? 5 : 3;
      ctx.beginPath(); ctx.arc(tx(p.x), ty(p.y), sz, 0, 2 * Math.PI); ctx.fill();

      // Label for very high error points
      if (err > tol * 10) {
        ctx.fillStyle = '#f88';
        ctx.font = '10px monospace';
        ctx.fillText(`p${i}(${err.toFixed(1)})`, tx(p.x) + 6, ty(p.y) + 4);
      }
    }

    // ─── Stats overlay ─────────────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, 50);
    ctx.fillStyle = '#0af';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`Contour #${globalIdx}  |  ${slice.label} @ ${(+slice.offset).toFixed(2)}`, 12, 18);
    
    const errColor = maxErr > 10 ? '#f44' : maxErr > 1 ? '#fa0' : '#4f4';
    ctx.fillStyle = '#aaa';
    ctx.font = '12px monospace';
    ctx.fillText(
      `${pts.length} pts  ${entities.length} ents  diag=${diag.toFixed(1)}  tol=${tol.toFixed(3)}  ` +
      `hiErr=${hiCount}/${pts.length}`,
      12, 36
    );
    ctx.fillStyle = errColor;
    ctx.fillText(`maxErr=${maxErr.toFixed(2)}  avgErr=${avgErr.toFixed(2)}`, 620, 36);

    // Entity summary
    const nLines = entities.filter(e => e.type === 'line').length;
    const nArcs = entities.filter(e => e.type !== 'line' && !(e as SketchArc).isFullCircle).length;
    const nCircles = entities.filter(e => e.type !== 'line' && (e as SketchArc).isFullCircle).length;
    ctx.fillStyle = '#888';
    ctx.fillText(`L:${nLines} A:${nArcs} C:${nCircles}`, 900, 36);

    // Bottom scale bar
    ctx.fillStyle = '#555';
    ctx.font = '10px monospace';
    ctx.fillText(`grid=${gridStep}  scale=${sc.toFixed(2)}px/unit`, 8, H - 8);

    // ─── Save JPG ──────────────────────────────────────────
    const sliceTag = slice.label.replace(/[^a-zA-Z0-9+]/g, '_').replace(/\+/g, 'p');
    const fname = `contour_${String(globalIdx).padStart(3, '0')}_${sliceTag}.jpg`;
    const buf = canvas.toBuffer('image/jpeg', { quality: 0.92 });
    writeFileSync(join(OUT_DIR, fname), buf);
    
    const status = maxErr > 10 ? '❌' : maxErr > 1 ? '⚠️' : '✅';
    console.log(`${status} ${fname} — ${pts.length}pts ${entities.length}ents maxErr=${maxErr.toFixed(2)}`);
    
    globalIdx++;
  }
}

console.log(`\n✅ Done: ${globalIdx} contours → ${OUT_DIR}/`);
