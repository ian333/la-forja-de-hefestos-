/**
 * Visual Error Diagnostic — La Forja
 * 
 * Generates SVG files for EACH contour of a specific STEP model showing:
 * - Original sample points (gray dots)
 * - Fitted entities (colored: white=line, magenta=arc, gold=circle)
 * - Error heatmap: each point colored by its distance to nearest entity
 * - Points with error > tol highlighted in RED with error magnitude
 * 
 * This lets us SEE exactly where fitting fails.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fitContour, reconstructionError, type Point2D, type SketchEntity, type SketchArc } from '../src/lib/sketch-fitting.ts';

const VIZ_DIR = join(import.meta.dirname!, '..', 'public', 'viz-data');
const OUT_DIR = join(import.meta.dirname!, '..', 'debug-svg');

// Choose which model to analyze — the one from the screenshot
const TARGET_MODEL = process.argv[2] || 'nist_ctc_01_asme1_ap242-e1';

mkdirSync(OUT_DIR, { recursive: true });

function d(a: Point2D, b: Point2D) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Distance from point to line segment */
function distToLine(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return d(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return d(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** Distance from point to arc */
function distToArc(p: Point2D, arc: SketchArc): number {
  const dx = p.x - arc.center.x, dy = p.y - arc.center.y;
  const rp = Math.sqrt(dx * dx + dy * dy);
  const radialDist = Math.abs(rp - arc.radius);
  
  if (arc.isFullCircle) return radialDist;
  
  // Check if the point's angle falls within the arc's angular span
  let angle = Math.atan2(dy, dx);
  let sa = arc.startAngle, ea = arc.endAngle;
  // Normalize
  while (angle < 0) angle += 2 * Math.PI;
  while (sa < 0) sa += 2 * Math.PI;
  while (ea < 0) ea += 2 * Math.PI;
  
  // Check if angle is within sweep
  let sweep = ea - sa;
  if (sweep < 0) sweep += 2 * Math.PI;
  let diff = angle - sa;
  if (diff < 0) diff += 2 * Math.PI;
  
  if (diff <= sweep) {
    return radialDist;
  }
  // Outside angular span — distance to endpoints
  return Math.min(d(p, arc.start), d(p, arc.end));
}

function distToEntity(p: Point2D, e: SketchEntity): number {
  if (e.type === 'line') return distToLine(p, e.start, e.end);
  return distToArc(p, e as SketchArc);
}

function distToAnyEntity(p: Point2D, entities: SketchEntity[]): number {
  let min = Infinity;
  for (const e of entities) min = Math.min(min, distToEntity(p, e));
  return min;
}

/** Generate SVG for a single contour */
function contourToSVG(
  pts: Point2D[],
  entities: SketchEntity[],
  contourIdx: number,
  sliceAxis: string,
  sliceValue: number,
  tol: number,
  diag: number,
): string {
  // Compute bounding box of points
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  const margin = diag * 0.05;
  minX -= margin; minY -= margin;
  maxX += margin; maxY += margin;
  const w = maxX - minX;
  const h = maxY - minY;
  
  const svgW = 1200;
  const svgH = Math.round(svgW * h / w);
  const scale = svgW / w;
  
  const tx = (p: Point2D) => ((p.x - minX) * scale).toFixed(2);
  const ty = (p: Point2D) => (svgH - (p.y - minY) * scale).toFixed(2); // flip Y
  
  // Compute per-point error
  const errors = pts.map(p => distToAnyEntity(p, entities));
  const maxErr = Math.max(...errors);
  const avgErr = errors.reduce((s, e) => s + e, 0) / errors.length;
  const highErrCount = errors.filter(e => e > tol).length;
  
  // Entity lengths
  const entityLengths = entities.map(e => {
    if (e.type === 'line') return d(e.start, e.end);
    const arc = e as SketchArc;
    if (arc.isFullCircle) return 2 * Math.PI * arc.radius;
    let sweep = arc.endAngle - arc.startAngle;
    while (sweep < 0) sweep += 2 * Math.PI;
    return Math.abs(sweep) * arc.radius;
  });
  
  const lines: string[] = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`);
  lines.push(`<rect width="100%" height="100%" fill="#1a1a2e"/>`);
  
  // Title / stats
  lines.push(`<text x="10" y="18" fill="#888" font-size="11" font-family="monospace">${TARGET_MODEL} — contour #${contourIdx} — ${sliceAxis}=${sliceValue.toFixed(2)}</text>`);
  lines.push(`<text x="10" y="32" fill="#888" font-size="11" font-family="monospace">${pts.length} pts → ${entities.length} entities (tol=${tol.toFixed(4)}, diag=${diag.toFixed(2)})</text>`);
  lines.push(`<text x="10" y="46" fill="${maxErr > tol ? '#ff4444' : '#44ff44'}" font-size="11" font-family="monospace">maxErr=${maxErr.toFixed(4)} avgErr=${avgErr.toFixed(4)} highErrPts=${highErrCount}/${pts.length}</text>`);
  
  // Entity legend
  const lineCount = entities.filter(e => e.type === 'line').length;
  const arcCount = entities.filter(e => e.type === 'arc' && !(e as SketchArc).isFullCircle).length;
  const circCount = entities.filter(e => e.type === 'arc' && (e as SketchArc).isFullCircle).length;
  lines.push(`<text x="10" y="60" fill="#888" font-size="11" font-family="monospace">${lineCount} lines, ${arcCount} arcs, ${circCount} circles</text>`);
  
  // ── Draw fitted entities ──
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    const lenRatio = entityLengths[i] / diag;
    const isTiny = lenRatio < 0.01;
    
    if (e.type === 'line') {
      const color = isTiny ? '#ff0000' : '#e0e0e0';
      const width = isTiny ? 3 : 1.5;
      lines.push(`<line x1="${tx(e.start)}" y1="${ty(e.start)}" x2="${tx(e.end)}" y2="${ty(e.end)}" stroke="${color}" stroke-width="${width}" stroke-opacity="0.9"/>`);
      // Label tiny lines
      if (isTiny) {
        const mx = (+tx(e.start) + +tx(e.end)) / 2;
        const my = (+ty(e.start) + +ty(e.end)) / 2;
        lines.push(`<text x="${mx}" y="${my - 4}" fill="#ff0000" font-size="9" text-anchor="middle" font-family="monospace">${lenRatio.toFixed(4)}</text>`);
      }
    } else {
      const arc = e as SketchArc;
      if (arc.isFullCircle) {
        const cx = tx(arc.center), cy = ty(arc.center);
        const r = (arc.radius * scale).toFixed(2);
        lines.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ffd700" stroke-width="2" stroke-opacity="0.8"/>`);
      } else {
        // Draw arc as SVG path
        const r = arc.radius * scale;
        const sx = +tx(arc.start), sy = +ty(arc.start);
        const ex = +tx(arc.end), ey = +ty(arc.end);
        let sweep = arc.endAngle - arc.startAngle;
        while (sweep < 0) sweep += 2 * Math.PI;
        const largeArc = sweep > Math.PI ? 1 : 0;
        // SVG arc: flipped Y, so sweep direction reverses
        const sweepFlag = 0; // We flip Y so counterclockwise in math = clockwise in SVG
        const color = isTiny ? '#ff6600' : '#cc44ff';
        const width = isTiny ? 3 : 2;
        lines.push(`<path d="M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${largeArc} ${sweepFlag} ${ex.toFixed(2)} ${ey.toFixed(2)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-opacity="0.8"/>`);
      }
    }
    
    // Entity endpoint dots
    if (!e.isFullCircle || e.type === 'line') {
      lines.push(`<circle cx="${tx(e.start)}" cy="${ty(e.start)}" r="3" fill="#00ff00" opacity="0.7"/>`);
      lines.push(`<circle cx="${tx(e.end)}" cy="${ty(e.end)}" r="3" fill="#00ccff" opacity="0.7"/>`);
    }
  }
  
  // ── Draw original points colored by error ──
  for (let i = 0; i < pts.length; i++) {
    const err = errors[i];
    const ratio = Math.min(1, err / (tol * 5)); // 0..1, where 1 = 5x tolerance
    const r = Math.round(255 * ratio);
    const g = Math.round(255 * (1 - ratio) * 0.5);
    const b2 = Math.round(100 * (1 - ratio));
    const color = `rgb(${r},${g},${b2})`;
    const radius = err > tol ? 4 : 1.5;
    lines.push(`<circle cx="${tx(pts[i])}" cy="${ty(pts[i])}" r="${radius}" fill="${color}" opacity="${err > tol ? 0.9 : 0.4}"/>`);
    
    // Label high-error points
    if (err > tol * 2) {
      lines.push(`<text x="${+tx(pts[i]) + 5}" y="${+ty(pts[i]) - 3}" fill="#ff4444" font-size="8" font-family="monospace">${err.toFixed(3)}</text>`);
    }
  }
  
  // ── Draw entity index numbers at midpoints ──
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    let mx: number, my: number;
    if (e.type === 'line') {
      mx = (+tx(e.start) + +tx(e.end)) / 2;
      my = (+ty(e.start) + +ty(e.end)) / 2;
    } else {
      const arc = e as SketchArc;
      if (arc.isFullCircle) {
        mx = +tx(arc.center);
        my = +ty(arc.center);
      } else {
        let midAngle = arc.startAngle + (arc.endAngle - arc.startAngle) / 2;
        const midPt = { x: arc.center.x + arc.radius * Math.cos(midAngle), y: arc.center.y + arc.radius * Math.sin(midAngle) };
        mx = +tx(midPt);
        my = +ty(midPt);
      }
    }
    lines.push(`<text x="${mx + 6}" y="${my + 3}" fill="#666" font-size="9" font-family="monospace">#${i}</text>`);
  }
  
  lines.push(`</svg>`);
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

const file = `${TARGET_MODEL}.json`;
const raw = readFileSync(join(VIZ_DIR, file), 'utf-8');
const model = JSON.parse(raw);

console.log(`⚒️  La Forja — Visual Diagnostic: ${TARGET_MODEL}\n`);
console.log(`  Output: ${OUT_DIR}/\n`);

let contourIdx = 0;
let totalHighErr = 0;
const summary: { idx: number; axis: string; value: number; pts: number; ents: number; maxErr: number; highPts: number }[] = [];

for (const slice of (model.slices || [])) {
  for (const contour of (slice.contours || [])) {
    const pts: Point2D[] = contour.points.map((p: number[]) => ({ x: p[0], y: p[1] }));
    if (pts.length < 3) { contourIdx++; continue; }
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    const cDiag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
    const tol = Math.max(0.001, cDiag * 0.002);
    
    const result = fitContour(pts);
    const entities = result.entities;
    
    // Compute per-point error for summary
    const errors = pts.map(p => distToAnyEntity(p, entities));
    const maxErr = Math.max(...errors);
    const highPts = errors.filter(e => e > tol).length;
    totalHighErr += highPts;
    
    const sliceLabel = slice.label || 'unknown';
    const sliceOffset = slice.offset ?? 0;
    summary.push({ idx: contourIdx, axis: sliceLabel, value: sliceOffset, pts: pts.length, ents: entities.length, maxErr, highPts });
    
    // Only generate SVG for contours with errors or interesting ones
    const svg = contourToSVG(pts, entities, contourIdx, sliceLabel, sliceOffset, tol, cDiag);
    const svgPath = join(OUT_DIR, `contour_${String(contourIdx).padStart(3, '0')}_${sliceLabel.replace(/[^a-zA-Z0-9]/g,'_')}_err${maxErr.toFixed(2)}.svg`);
    writeFileSync(svgPath, svg);
    
    contourIdx++;
  }
}

console.log(`  Generated ${contourIdx} SVG files\n`);

// Print summary sorted by error
summary.sort((a, b) => b.maxErr - a.maxErr);
console.log('  TOP 20 WORST CONTOURS:');
console.log('  idx  axis  value     pts  ents  maxErr      highErrPts');
for (const s of summary.slice(0, 20)) {
  console.log(`  ${String(s.idx).padStart(3)}  ${s.axis.padEnd(4)}  ${s.value.toFixed(2).padStart(8)}  ${String(s.pts).padStart(4)}  ${String(s.ents).padStart(4)}  ${s.maxErr.toFixed(4).padStart(10)}  ${s.highPts}/${s.pts}`);
}

console.log(`\n  Total high-error points: ${totalHighErr}`);
console.log(`  Open SVGs in browser: file://${OUT_DIR}/`);
