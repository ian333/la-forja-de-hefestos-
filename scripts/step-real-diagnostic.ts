/**
 * STEP Real Data Diagnostic — La Forja
 * 
 * Runs fitContour on EVERY contour from EVERY STEP model
 * and shows exactly what comes out. No synthetic data, no excuses.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fitContour, type Point2D, type SketchEntity } from '../src/lib/sketch-fitting.ts';

const VIZ_DIR = join(import.meta.dirname!, '..', 'public', 'viz-data');

interface ContourData {
  points: number[][];
  area: number;
}

interface SliceData {
  direction: { x: number; y: number; z: number };
  offset: number;
  contours: ContourData[];
}

interface ModelData {
  fileName: string;
  diagonal: number;
  slices: SliceData[];
}

// ── Helpers ──
function sweepDeg(e: SketchEntity): number {
  if (e.type !== 'arc') return 0;
  return Math.abs(e.endAngle - e.startAngle) * 180 / Math.PI;
}
function entityLen(e: SketchEntity): number {
  if (e.type === 'line') {
    return Math.sqrt((e.end.x - e.start.x) ** 2 + (e.end.y - e.start.y) ** 2);
  }
  return e.radius * Math.abs(e.endAngle - e.startAngle);
}
function dist(a: Point2D, b: Point2D) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ── Stats accumulators ──
let totalContours = 0;
let totalEntities = 0;
let totalLines = 0;
let totalArcs = 0;
let totalCircles = 0;
let tinySegments = 0;      // entities with length < 0.1% of contour diagonal
let gapErrors = 0;          // C0 discontinuities > tol
let hugeRadiusArcs = 0;     // arcs with radius > 10x contour diag
let circlesNotClosed = 0;   // "circles" where start != end or isFullCircle=false
let arcsCouldbeLine = 0;    // arcs with sagitta < tol (should be lines)
let linesCoulldbeArc = 0;   // consecutive lines that share curvature direction

const problems: string[] = [];
const modelStats: { name: string; contours: number; lines: number; arcs: number; circles: number; problems: number }[] = [];

// ── Process all models ──
const files = readdirSync(VIZ_DIR)
  .filter(f => f.endsWith('.json') && f !== 'index.json')
  .sort();

console.log('⚒️  La Forja — STEP Real Data Diagnostic\n');
console.log(`Found ${files.length} model files\n`);
console.log('━'.repeat(100));

for (const file of files) {
  const raw = readFileSync(join(VIZ_DIR, file), 'utf-8');
  const model: ModelData = JSON.parse(raw);
  const name = file.replace('.json', '');
  
  let mLines = 0, mArcs = 0, mCircles = 0, mContours = 0, mProblems = 0;
  const contourResults: string[] = [];
  
  for (const slice of (model.slices || [])) {
    for (const contour of (slice.contours || [])) {
      const pts: Point2D[] = contour.points.map(p => ({ x: p[0], y: p[1] }));
      if (pts.length < 3) continue;
      
      mContours++;
      totalContours++;
      
      // Compute contour diagonal
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const cDiag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
      const tol = Math.max(0.001, cDiag * 0.002);
      
      // Run fitContour
      const result = fitContour(pts);
      const entities = result.entities;
      
      let lines = 0, arcs = 0, circles = 0;
      for (const e of entities) {
        totalEntities++;
        if (e.type === 'line') { lines++; totalLines++; mLines++; }
        else if (e.isFullCircle) { circles++; totalCircles++; mCircles++; }
        else { arcs++; totalArcs++; mArcs++; }
        
        // Check for tiny segments
        const len = entityLen(e);
        if (len < cDiag * 0.001 && entities.length > 1) {
          tinySegments++;
        }
        
        // Check for huge radius arcs
        if (e.type === 'arc' && !e.isFullCircle && e.radius > cDiag * 10) {
          hugeRadiusArcs++;
        }
        
        // Check for arcs that could be lines (sagitta < tol)
        if (e.type === 'arc' && !e.isFullCircle) {
          const sweep = Math.abs(e.endAngle - e.startAngle);
          const sagitta = e.radius * (1 - Math.cos(sweep / 2));
          if (sagitta < tol) {
            arcsCouldbeLine++;
          }
        }
      }
      
      // Check C0 continuity (gaps between entities)
      for (let i = 0; i < entities.length; i++) {
        const curr = entities[i];
        const next = entities[(i + 1) % entities.length];
        if (curr.isFullCircle || next.isFullCircle) continue;
        const gap = dist(curr.end, next.start);
        if (gap > tol * 5) {
          gapErrors++;
        }
      }
      
      // Check for unclosed circles
      for (const e of entities) {
        if (e.type === 'arc' && e.isFullCircle) {
          if (dist(e.start, e.end) > tol) {
            circlesNotClosed++;
          }
        }
      }
      
      // Detect consecutive collinear lines that could be merged
      let consecutiveLines = 0;
      for (let i = 0; i < entities.length; i++) {
        if (entities[i].type === 'line' && entities[(i + 1) % entities.length].type === 'line') {
          const e1 = entities[i], e2 = entities[(i + 1) % entities.length];
          const a1 = Math.atan2(e1.end.y - e1.start.y, e1.end.x - e1.start.x);
          const a2 = Math.atan2(e2.end.y - e2.start.y, e2.end.x - e2.start.x);
          let da = Math.abs(a1 - a2);
          if (da > Math.PI) da = 2 * Math.PI - da;
          if (da < 5 * Math.PI / 180) { // < 5° angle
            consecutiveLines++;
          }
        }
      }
      
      const entCount = entities.length;
      const probCount = (entities.length > pts.length / 3 ? 1 : 0) + // too many entities
        (circles > 5 ? 1 : 0); // too many circles
      mProblems += probCount;
      
      // Flag interesting contours
      const flag = entCount > 20 ? '⚠️ MANY' : 
                   circles > 3 ? '⚠️ CIRCLES' :
                   consecutiveLines > 3 ? '⚠️ COLLINEAR' :
                   '';
      
      contourResults.push(
        `    ${pts.length.toString().padStart(4)}pts → ${lines}L ${arcs}A ${circles}C = ${entCount.toString().padStart(3)}  ` +
        `diag=${cDiag.toFixed(1).padStart(8)} ${flag}` +
        (consecutiveLines > 0 ? ` colinear=${consecutiveLines}` : '')
      );
    }
  }
  
  // Print model summary
  const emoji = mProblems > 0 ? '⚠️' : '✅';
  console.log(`${emoji} ${name.padEnd(45)} ${mContours} contours → ${mLines}L ${mArcs}A ${mCircles}C`);
  
  // Print problematic contours
  for (const r of contourResults) {
    if (r.includes('⚠️')) {
      console.log(r);
    }
  }
  
  modelStats.push({ name, contours: mContours, lines: mLines, arcs: mArcs, circles: mCircles, problems: mProblems });
}

console.log('━'.repeat(100));
console.log('\n📊 GLOBAL SUMMARY\n');
console.log(`Models:            ${files.length}`);
console.log(`Total contours:    ${totalContours}`);
console.log(`Total entities:    ${totalEntities}`);
console.log(`  Lines:           ${totalLines} (${(100 * totalLines / totalEntities).toFixed(1)}%)`);
console.log(`  Arcs:            ${totalArcs} (${(100 * totalArcs / totalEntities).toFixed(1)}%)`);
console.log(`  Circles:         ${totalCircles} (${(100 * totalCircles / totalEntities).toFixed(1)}%)`);
console.log(`  Avg per contour: ${(totalEntities / totalContours).toFixed(1)} entities`);
console.log('');
console.log('🔍 PROBLEMS DETECTED:');
console.log(`  Tiny segments (< 0.1% diag):    ${tinySegments}`);
console.log(`  C0 gaps (> 5×tol):              ${gapErrors}`);
console.log(`  Huge radius arcs (> 10×diag):   ${hugeRadiusArcs}`);
console.log(`  Arcs that should be lines:      ${arcsCouldbeLine}`);
console.log(`  Circles not closed:             ${circlesNotClosed}`);
console.log('');

// Top 5 worst models by entity count / contour count ratio
const sorted = [...modelStats].sort((a, b) => 
  (b.lines + b.arcs + b.circles) / Math.max(b.contours, 1) - 
  (a.lines + a.arcs + a.circles) / Math.max(a.contours, 1)
);
console.log('📈 TOP 10 MODELS BY ENTITIES/CONTOUR RATIO:');
for (const m of sorted.slice(0, 10)) {
  const ratio = (m.lines + m.arcs + m.circles) / Math.max(m.contours, 1);
  console.log(`  ${m.name.padEnd(45)} ${ratio.toFixed(1)} ent/contour  (${m.lines}L ${m.arcs}A ${m.circles}C)`);
}

// Detailed dump of the 3 worst contours
console.log('\n🔬 DETAILED DUMP — 3 Worst Contours:\n');
let dumpCount = 0;
for (const file of files) {
  if (dumpCount >= 3) break;
  const raw = readFileSync(join(VIZ_DIR, file), 'utf-8');
  const model: ModelData = JSON.parse(raw);
  const name = file.replace('.json', '');
  
  for (const slice of (model.slices || [])) {
    if (dumpCount >= 3) break;
    for (const contour of (slice.contours || [])) {
      if (dumpCount >= 3) break;
      const pts: Point2D[] = contour.points.map(p => ({ x: p[0], y: p[1] }));
      if (pts.length < 10) continue;
      
      const result = fitContour(pts);
      if (result.entities.length < 8) continue; // skip simple ones
      
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const cDiag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
      const tol = Math.max(0.001, cDiag * 0.002);
      
      console.log(`── ${name} (${pts.length}pts, diag=${cDiag.toFixed(2)}, tol=${tol.toFixed(4)}) ──`);
      for (let i = 0; i < result.entities.length; i++) {
        const e = result.entities[i];
        const next = result.entities[(i + 1) % result.entities.length];
        const gap = dist(e.end, next.start);
        const gapFlag = gap > tol ? `  ⚠️ GAP=${gap.toFixed(4)}` : '';
        
        if (e.type === 'line') {
          const len = Math.sqrt((e.end.x - e.start.x) ** 2 + (e.end.y - e.start.y) ** 2);
          console.log(`  [${i}] LINE len=${len.toFixed(3)} (${e.start.x.toFixed(3)},${e.start.y.toFixed(3)})→(${e.end.x.toFixed(3)},${e.end.y.toFixed(3)})${gapFlag}`);
        } else {
          const sw = sweepDeg(e);
          const fc = e.isFullCircle ? ' ●FULL' : '';
          console.log(`  [${i}] ARC r=${e.radius.toFixed(3)} sweep=${sw.toFixed(1)}° center=(${e.center.x.toFixed(3)},${e.center.y.toFixed(3)})${fc}${gapFlag}`);
        }
      }
      console.log('');
      dumpCount++;
    }
  }
}
