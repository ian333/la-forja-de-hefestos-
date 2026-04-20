/**
 * Error Report Generator — La Forja
 * 
 * Generates an interactive HTML page showing every contour fit
 * with points colored by error, entity overlays, and statistics.
 * 
 * Usage: npx tsx scripts/error-report.ts [model-name]
 * Opens: debug-report/index.html in browser
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fitContour, type Point2D, type SketchEntity, type SketchArc } from '../src/lib/sketch-fitting.ts';

const VIZ_DIR = join(import.meta.dirname!, '..', 'public', 'viz-data');
const OUT_DIR = join(import.meta.dirname!, '..', 'debug-report');
const TARGET = process.argv[2] || 'nist_ctc_01_asme1_ap242-e1';

mkdirSync(OUT_DIR, { recursive: true });

function dist(a: Point2D, b: Point2D) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function distToLine(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
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
  let sweep = ea - sa;
  if (sweep < 0) sweep += 2 * Math.PI;
  let diff = angle - sa;
  if (diff < 0) diff += 2 * Math.PI;
  if (diff <= sweep) return radialDist;
  return Math.min(dist(p, arc.start), dist(p, arc.end));
}

function distToEntity(p: Point2D, e: SketchEntity): number {
  if (e.type === 'line') return distToLine(p, e.start, e.end);
  return distToArc(p, e as SketchArc);
}

function distToAny(p: Point2D, entities: SketchEntity[]): { d: number; idx: number } {
  let min = Infinity, idx = 0;
  for (let i = 0; i < entities.length; i++) {
    const dd = distToEntity(p, entities[i]);
    if (dd < min) { min = dd; idx = i; }
  }
  return { d: min, idx };
}

// ─── Read model ────────────────────────────────────────────────
const raw = JSON.parse(readFileSync(join(VIZ_DIR, `${TARGET}.json`), 'utf-8'));
const slices: any[] = raw.slices;
console.log(`Model ${TARGET}: ${slices.length} slices`);

interface ContourReport {
  idx: number;
  sliceLabel: string;
  sliceOffset: number;
  nPts: number;
  diag: number;
  tol: number;
  isOpen: boolean;
  nEnts: number;
  maxErr: number;
  avgErr: number;
  pts: { x: number; y: number; err: number; nearEnt: number }[];
  entities: {
    type: string;
    start: Point2D;
    end: Point2D;
    center?: Point2D;
    radius?: number;
    startAngle?: number;
    endAngle?: number;
    isFullCircle?: boolean;
    len: number;
    lenPct: number; // % of diagonal
  }[];
  maxGap: number;
}

const reports: ContourReport[] = [];
let globalIdx = 0;

for (const slice of slices) {
  for (const contour of slice.contours) {
    const rawPts = contour.points || contour;
    const pts: Point2D[] = (Array.isArray(rawPts[0]) ? rawPts : rawPts).map((p: any) =>
      Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y }
    );
    if (pts.length < 3) { globalIdx++; continue; }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    const diag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
    if (diag < 1e-6) { globalIdx++; continue; }
    const tol = Math.max(0.001, diag * 0.002);

    const closureDist = dist(pts[0], pts[pts.length - 1]);
    const totalPerim = pts.reduce((s, p, i) => i === 0 ? 0 : s + dist(pts[i - 1], p), 0);
    const avgSpacing = totalPerim / (pts.length - 1);
    const isOpen = closureDist > Math.max(avgSpacing * 3, diag * 0.01);

    const result = fitContour(pts);
    const entities = result.entities;

    // Max gap
    let maxGap = 0;
    for (let i = 1; i < pts.length; i++) {
      const g = dist(pts[i - 1], pts[i]);
      if (g > maxGap) maxGap = g;
    }

    // Per-point error
    const ptReports = pts.map(p => {
      const { d: err, idx: nearEnt } = distToAny(p, entities);
      return { x: p.x, y: p.y, err, nearEnt };
    });
    const maxErr = Math.max(...ptReports.map(p => p.err));
    const avgErr = ptReports.reduce((s, p) => s + p.err, 0) / ptReports.length;

    // Entity info
    const entReports = entities.map(e => {
      let len: number;
      if (e.type === 'line') {
        len = dist(e.start, e.end);
      } else {
        const arc = e as SketchArc;
        if (arc.isFullCircle) len = 2 * Math.PI * arc.radius;
        else {
          let sw = arc.endAngle - arc.startAngle;
          while (sw < 0) sw += 2 * Math.PI;
          len = Math.abs(sw) * arc.radius;
        }
      }
      const base: any = {
        type: e.type,
        start: { x: +e.start.x.toFixed(2), y: +e.start.y.toFixed(2) },
        end: { x: +e.end.x.toFixed(2), y: +e.end.y.toFixed(2) },
        len: +len.toFixed(2),
        lenPct: +(len / diag * 100).toFixed(1),
      };
      if (e.type !== 'line') {
        const arc = e as SketchArc;
        base.center = { x: +arc.center.x.toFixed(2), y: +arc.center.y.toFixed(2) };
        base.radius = +arc.radius.toFixed(2);
        base.startAngle = +arc.startAngle.toFixed(4);
        base.endAngle = +arc.endAngle.toFixed(4);
        base.isFullCircle = arc.isFullCircle;
      }
      return base;
    });

    reports.push({
      idx: globalIdx,
      sliceLabel: slice.label,
      sliceOffset: +slice.offset.toFixed(2),
      nPts: pts.length,
      diag: +diag.toFixed(2),
      tol: +tol.toFixed(4),
      isOpen,
      nEnts: entities.length,
      maxErr: +maxErr.toFixed(2),
      avgErr: +avgErr.toFixed(2),
      pts: ptReports.map(p => ({ x: +p.x.toFixed(3), y: +p.y.toFixed(3), err: +p.err.toFixed(3), nearEnt: p.nearEnt })),
      entities: entReports,
      maxGap: +maxGap.toFixed(2),
    });
    globalIdx++;
  }
}

reports.sort((a, b) => b.maxErr - a.maxErr);

// Write JSON data
writeFileSync(join(OUT_DIR, 'data.json'), JSON.stringify(reports, null, 0));

// Write HTML
const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Error Report — ${TARGET}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'SF Mono', 'Fira Code', monospace; background: #111; color: #eee; padding: 16px; }
  h1 { font-size: 18px; margin-bottom: 8px; color: #0af; }
  .summary { font-size: 13px; color: #888; margin-bottom: 16px; }
  .controls { margin-bottom: 12px; display: flex; gap: 12px; align-items: center; }
  .controls label { font-size: 12px; color: #aaa; }
  .controls select, .controls input { background: #222; color: #eee; border: 1px solid #444; padding: 4px 8px; font-size: 12px; }
  
  table { border-collapse: collapse; width: 100%; font-size: 12px; margin-bottom: 16px; }
  th { background: #222; color: #0af; padding: 6px 8px; text-align: left; cursor: pointer; user-select: none; }
  th:hover { background: #333; }
  td { padding: 4px 8px; border-bottom: 1px solid #222; }
  tr:hover td { background: #1a1a2e; }
  tr.selected td { background: #1a2a3e; }
  .err-hi { color: #f44; font-weight: bold; }
  .err-md { color: #fa0; }
  .err-lo { color: #4f4; }
  
  .detail { display: flex; gap: 16px; margin-top: 16px; }
  .canvas-wrap { flex: 1; min-width: 0; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; position: relative; }
  canvas { width: 100%; display: block; cursor: crosshair; }
  .info-panel { width: 360px; overflow-y: auto; max-height: 70vh; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; padding: 12px; font-size: 12px; }
  .info-panel h3 { color: #0af; margin-bottom: 8px; font-size: 14px; }
  .info-panel .label { color: #888; }
  .info-panel .value { color: #eee; }
  .info-panel .ent-line { color: #5df; }
  .info-panel .ent-arc { color: #f5a; }
  .info-panel .ent-circle { color: #fd3; }
  .info-panel .row { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px solid #222; }
  .ent-list { margin-top: 8px; }
  .ent-item { padding: 4px; margin-bottom: 4px; background: #222; border-radius: 3px; }
  .ent-item .tiny { color: #f44; font-weight: bold; }
  .bar { display: inline-block; height: 8px; background: #0af; border-radius: 2px; vertical-align: middle; }
  
  .hover-info { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.85); padding: 8px; border-radius: 4px; font-size: 11px; pointer-events: none; }
</style>
</head>
<body>

<h1>🔧 Error Report — ${TARGET}</h1>
<div class="summary" id="summary"></div>

<div class="controls">
  <label>Filtrar: <select id="filter">
    <option value="all">Todos</option>
    <option value="high">maxErr > 10</option>
    <option value="medium">maxErr > 1</option>
    <option value="low">maxErr < 1 (OK)</option>
    <option value="open">Solo abiertos</option>
  </select></label>
  <label>Slice: <select id="sliceFilter"><option value="all">Todos</option></select></label>
  <label>Ordenar: <select id="sortBy">
    <option value="maxErr">Max Error ↓</option>
    <option value="avgErr">Avg Error ↓</option>
    <option value="nPts">Puntos ↑</option>
    <option value="nEnts">Entities ↓</option>
    <option value="diag">Diagonal ↓</option>
  </select></label>
</div>

<table id="tbl">
  <thead>
    <tr>
      <th data-col="idx">#</th>
      <th data-col="sliceLabel">Slice</th>
      <th data-col="nPts">Pts</th>
      <th data-col="nEnts">Ents</th>
      <th data-col="diag">Diag</th>
      <th data-col="maxErr">maxErr</th>
      <th data-col="avgErr">avgErr</th>
      <th data-col="maxGap">maxGap</th>
      <th data-col="isOpen">Open</th>
      <th>errBar</th>
    </tr>
  </thead>
  <tbody id="tbody"></tbody>
</table>

<div class="detail">
  <div class="canvas-wrap">
    <canvas id="cv" width="900" height="700"></canvas>
    <div class="hover-info" id="hoverInfo" style="display:none"></div>
  </div>
  <div class="info-panel" id="infoPanel">
    <h3>Selecciona un contorno</h3>
    <p style="color:#666">Haz clic en una fila de la tabla para ver el detalle visual</p>
  </div>
</div>

<script>
let DATA = [];
fetch('data.json').then(r => r.json()).then(data => {
  DATA = data;
  init();
});

function init() {
  // Summary
  const totalC = DATA.length;
  const errAbove10 = DATA.filter(c => c.maxErr > 10).length;
  const errAbove1 = DATA.filter(c => c.maxErr > 1).length;
  document.getElementById('summary').textContent =
    totalC + ' contornos | ' + errAbove10 + ' con maxErr>10 | ' + errAbove1 + ' con maxErr>1';

  // Slice filter
  const slices = [...new Set(DATA.map(c => c.sliceLabel))];
  const sf = document.getElementById('sliceFilter');
  for (const s of slices) {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    sf.appendChild(o);
  }

  renderTable();
  document.getElementById('filter').onchange = renderTable;
  document.getElementById('sliceFilter').onchange = renderTable;
  document.getElementById('sortBy').onchange = renderTable;
}

function renderTable() {
  const f = document.getElementById('filter').value;
  const sf = document.getElementById('sliceFilter').value;
  const sortBy = document.getElementById('sortBy').value;

  let items = DATA.slice();
  if (f === 'high') items = items.filter(c => c.maxErr > 10);
  else if (f === 'medium') items = items.filter(c => c.maxErr > 1);
  else if (f === 'low') items = items.filter(c => c.maxErr <= 1);
  else if (f === 'open') items = items.filter(c => c.isOpen);

  if (sf !== 'all') items = items.filter(c => c.sliceLabel === sf);

  if (sortBy === 'maxErr') items.sort((a,b) => b.maxErr - a.maxErr);
  else if (sortBy === 'avgErr') items.sort((a,b) => b.avgErr - a.avgErr);
  else if (sortBy === 'nPts') items.sort((a,b) => a.nPts - b.nPts);
  else if (sortBy === 'nEnts') items.sort((a,b) => b.nEnts - a.nEnts);
  else if (sortBy === 'diag') items.sort((a,b) => b.diag - a.diag);

  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';
  const globalMaxErr = Math.max(...DATA.map(c => c.maxErr), 1);

  for (const c of items) {
    const tr = document.createElement('tr');
    const cls = c.maxErr > 10 ? 'err-hi' : c.maxErr > 1 ? 'err-md' : 'err-lo';
    const barW = Math.min(200, c.maxErr / globalMaxErr * 200);
    tr.innerHTML = '<td>' + c.idx + '</td>' +
      '<td>' + c.sliceLabel + '</td>' +
      '<td>' + c.nPts + '</td>' +
      '<td>' + c.nEnts + '</td>' +
      '<td>' + c.diag.toFixed(1) + '</td>' +
      '<td class="' + cls + '">' + c.maxErr.toFixed(2) + '</td>' +
      '<td>' + c.avgErr.toFixed(2) + '</td>' +
      '<td>' + c.maxGap.toFixed(1) + '</td>' +
      '<td>' + (c.isOpen ? '✓' : '') + '</td>' +
      '<td><div class="bar" style="width:' + barW + 'px;background:' + (c.maxErr > 10 ? '#f44' : c.maxErr > 1 ? '#fa0' : '#4f4') + '"></div></td>';
    tr.onclick = () => selectContour(c, tr);
    tbody.appendChild(tr);
  }
}

let selectedTr = null;
let selectedC = null;

function selectContour(c, tr) {
  if (selectedTr) selectedTr.classList.remove('selected');
  tr.classList.add('selected');
  selectedTr = tr;
  selectedC = c;
  drawCanvas(c);
  drawInfo(c);
}

function drawCanvas(c) {
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, W, H);

  // Compute bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of c.pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  for (const e of c.entities) {
    for (const ep of [e.start, e.end]) {
      if (ep.x < minX) minX = ep.x; if (ep.x > maxX) maxX = ep.x;
      if (ep.y < minY) minY = ep.y; if (ep.y > maxY) maxY = ep.y;
    }
    if (e.center) {
      const r = e.radius || 0;
      if (e.center.x - r < minX) minX = e.center.x - r;
      if (e.center.x + r > maxX) maxX = e.center.x + r;
      if (e.center.y - r < minY) minY = e.center.y - r;
      if (e.center.y + r > maxY) maxY = e.center.y + r;
    }
  }
  const padding = 40;
  const dw = maxX - minX || 1;
  const dh = maxY - minY || 1;
  const scale = Math.min((W - 2 * padding) / dw, (H - 2 * padding) / dh);
  const ox = padding + ((W - 2 * padding) - dw * scale) / 2;
  const oy = padding + ((H - 2 * padding) - dh * scale) / 2;

  function tx(x) { return ox + (x - minX) * scale; }
  function ty(y) { return H - oy - (y - minY) * scale; } // flip Y

  // Draw grid
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 0.5;
  const gridStep = Math.pow(10, Math.floor(Math.log10(dw / 4)));
  for (let x = Math.ceil(minX / gridStep) * gridStep; x <= maxX; x += gridStep) {
    ctx.beginPath(); ctx.moveTo(tx(x), 0); ctx.lineTo(tx(x), H); ctx.stroke();
  }
  for (let y = Math.ceil(minY / gridStep) * gridStep; y <= maxY; y += gridStep) {
    ctx.beginPath(); ctx.moveTo(0, ty(y)); ctx.lineTo(W, ty(y)); ctx.stroke();
  }

  // Draw entities
  for (let i = 0; i < c.entities.length; i++) {
    const e = c.entities[i];
    const color = e.type === 'line' ? '#5df' : (e.isFullCircle ? '#fd3' : '#f5a');
    const tiny = e.lenPct < 2;
    ctx.strokeStyle = tiny ? '#f44' : color;
    ctx.lineWidth = tiny ? 3 : 2;

    if (e.type === 'line') {
      ctx.beginPath();
      ctx.moveTo(tx(e.start.x), ty(e.start.y));
      ctx.lineTo(tx(e.end.x), ty(e.end.y));
      ctx.stroke();
    } else {
      // Arc
      const cx = tx(e.center.x), cy = ty(e.center.y);
      const r = e.radius * scale;
      if (e.isFullCircle) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.stroke();
      } else {
        ctx.beginPath();
        // Canvas arc has y-flipped so we negate angles
        ctx.arc(cx, cy, r, -e.endAngle, -e.startAngle);
        ctx.stroke();
      }
    }

    // Entity index label
    const mx = (e.start.x + e.end.x) / 2;
    const my = (e.start.y + e.end.y) / 2;
    ctx.fillStyle = tiny ? '#f44' : '#fff';
    ctx.font = '11px monospace';
    ctx.fillText('#' + i + ' ' + e.type[0].toUpperCase() + ' ' + e.len.toFixed(1), tx(mx) + 4, ty(my) - 6);

    // Entity endpoints
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(tx(e.start.x), ty(e.start.y), 3, 0, 2 * Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(tx(e.end.x), ty(e.end.y), 3, 0, 2 * Math.PI); ctx.fill();
  }

  // Draw points with error heatmap
  const maxErr = c.maxErr || 1;
  for (let i = 0; i < c.pts.length; i++) {
    const p = c.pts[i];
    const ratio = Math.min(1, p.err / (c.tol * 20));
    const r = Math.round(255 * ratio);
    const g = Math.round(255 * (1 - ratio));
    ctx.fillStyle = 'rgb(' + r + ',' + g + ',50)';
    const sz = p.err > c.tol ? 5 : 3;
    ctx.beginPath();
    ctx.arc(tx(p.x), ty(p.y), sz, 0, 2 * Math.PI);
    ctx.fill();

    // Point index for high-error points
    if (p.err > c.tol * 5) {
      ctx.fillStyle = '#f88';
      ctx.font = '10px monospace';
      ctx.fillText('p' + i + '(' + p.err.toFixed(1) + ')', tx(p.x) + 6, ty(p.y) + 4);
    }
  }

  // Draw lines from high-error points to nearest entity
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  for (const p of c.pts) {
    if (p.err > c.tol * 5) {
      const e = c.entities[p.nearEnt];
      // Find closest point on entity
      let nearPt;
      if (e.type === 'line') {
        const dx = e.end.x - e.start.x, dy = e.end.y - e.start.y;
        const len2 = dx * dx + dy * dy;
        let t = len2 > 0 ? ((p.x - e.start.x) * dx + (p.y - e.start.y) * dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        nearPt = { x: e.start.x + t * dx, y: e.start.y + t * dy };
      } else {
        const a = Math.atan2(p.y - e.center.y, p.x - e.center.x);
        nearPt = { x: e.center.x + e.radius * Math.cos(a), y: e.center.y + e.radius * Math.sin(a) };
      }
      ctx.strokeStyle = 'rgba(255,80,80,0.5)';
      ctx.beginPath();
      ctx.moveTo(tx(p.x), ty(p.y));
      ctx.lineTo(tx(nearPt.x), ty(nearPt.y));
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // Scale bar
  ctx.fillStyle = '#666';
  ctx.font = '11px monospace';
  ctx.fillText(gridStep.toFixed(gridStep >= 1 ? 0 : 2) + ' units/grid', 8, H - 8);
  ctx.fillText('diag=' + c.diag.toFixed(1) + '  tol=' + c.tol.toFixed(3) + '  scale=' + scale.toFixed(2) + 'px/unit', 8, H - 22);

  // Store transform for hover
  cv._tx = tx; cv._ty = ty; cv._c = c; cv._minX = minX; cv._maxX = maxX; cv._minY = minY; cv._maxY = maxY; cv._scale = scale; cv._ox = ox; cv._oy = oy;
}

function drawInfo(c) {
  const p = document.getElementById('infoPanel');
  let h = '<h3>Contorno #' + c.idx + '</h3>';
  h += '<div class="row"><span class="label">Slice</span><span class="value">' + c.sliceLabel + ' @ ' + c.sliceOffset + '</span></div>';
  h += '<div class="row"><span class="label">Puntos</span><span class="value">' + c.nPts + '</span></div>';
  h += '<div class="row"><span class="label">Entities</span><span class="value">' + c.nEnts + '</span></div>';
  h += '<div class="row"><span class="label">Diagonal</span><span class="value">' + c.diag.toFixed(2) + ' mm</span></div>';
  h += '<div class="row"><span class="label">Tolerancia</span><span class="value">' + c.tol.toFixed(4) + ' mm</span></div>';
  h += '<div class="row"><span class="label">Max Error</span><span class="value err-hi">' + c.maxErr.toFixed(3) + ' mm (' + (c.maxErr / c.diag * 100).toFixed(1) + '% diag)</span></div>';
  h += '<div class="row"><span class="label">Avg Error</span><span class="value">' + c.avgErr.toFixed(3) + ' mm</span></div>';
  h += '<div class="row"><span class="label">Max Gap</span><span class="value">' + c.maxGap.toFixed(1) + ' mm (' + (c.maxGap / c.diag * 100).toFixed(0) + '% diag)</span></div>';
  h += '<div class="row"><span class="label">Abierto</span><span class="value">' + (c.isOpen ? 'SI' : 'No') + '</span></div>';

  // High-error points
  const hiErr = c.pts.filter(p => p.err > c.tol).sort((a, b) => b.err - a.err);
  h += '<div style="margin-top:12px;color:#f88"><b>' + hiErr.length + '/' + c.nPts + ' puntos con error > tol</b></div>';

  h += '<div class="ent-list"><b>Entities:</b>';
  for (let i = 0; i < c.entities.length; i++) {
    const e = c.entities[i];
    const cls = e.type === 'line' ? 'ent-line' : e.isFullCircle ? 'ent-circle' : 'ent-arc';
    const tiny = e.lenPct < 2;
    h += '<div class="ent-item">';
    h += '<span class="' + cls + '">#' + i + ' ' + e.type.toUpperCase() + '</span>';
    if (tiny) h += ' <span class="tiny">TINY</span>';
    h += '<br>len=' + e.len.toFixed(2) + ' (' + e.lenPct.toFixed(1) + '% diag)';
    h += '<br><div class="bar" style="width:' + Math.min(300, e.lenPct * 3) + 'px"></div>';
    h += '<br>[' + e.start.x + ',' + e.start.y + '] → [' + e.end.x + ',' + e.end.y + ']';
    if (e.center) h += '<br>center=[' + e.center.x + ',' + e.center.y + '] r=' + e.radius;
    h += '</div>';
  }
  h += '</div>';

  // Top 10 worst points
  h += '<div style="margin-top:12px"><b>Top 10 peores puntos:</b></div>';
  const worst = c.pts.map((p, i) => ({...p, i})).sort((a, b) => b.err - a.err).slice(0, 10);
  for (const w of worst) {
    h += '<div style="padding:2px 0;font-size:11px;color:' + (w.err > c.tol * 10 ? '#f44' : w.err > c.tol ? '#fa0' : '#4f4') + '">';
    h += 'p' + w.i + ' [' + w.x.toFixed(2) + ',' + w.y.toFixed(2) + '] err=' + w.err.toFixed(3) + ' → ent#' + w.nearEnt;
    h += '</div>';
  }

  p.innerHTML = h;
}

// Hover on canvas
const cv = document.getElementById('cv');
cv.onmousemove = function(ev) {
  if (!cv._c) return;
  const rect = cv.getBoundingClientRect();
  const mx = (ev.clientX - rect.left) * (cv.width / rect.width);
  const my = (ev.clientY - rect.top) * (cv.height / rect.height);
  const c = cv._c;
  
  // Find nearest point
  let best = null, bestD = 20; // 20px threshold
  for (let i = 0; i < c.pts.length; i++) {
    const p = c.pts[i];
    const sx = cv._tx(p.x), sy = cv._ty(p.y);
    const d = Math.sqrt((mx - sx) ** 2 + (my - sy) ** 2);
    if (d < bestD) { bestD = d; best = { ...p, i }; }
  }
  
  const hi = document.getElementById('hoverInfo');
  if (best) {
    hi.style.display = 'block';
    hi.innerHTML = 'p' + best.i + ' [' + best.x.toFixed(2) + ', ' + best.y.toFixed(2) + ']<br>' +
      'err=' + best.err.toFixed(3) + ' → ent#' + best.nearEnt;
  } else {
    hi.style.display = 'none';
  }
};
</script>
</body>
</html>`;

writeFileSync(join(OUT_DIR, 'index.html'), html);

console.log(`\\n✅ Report generated: ${OUT_DIR}/index.html`);
console.log(`   ${reports.length} contours, ${reports.filter(r => r.maxErr > 10).length} with maxErr > 10`);
console.log(`   Open in browser: file://${OUT_DIR}/index.html`);
