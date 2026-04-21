#!/usr/bin/env node
/**
 * ⚒️ Visualize Fit Failures
 * ==========================
 * Renders raw contour points (red polyline) vs fitted entities (gold)
 * for the cases that fail the invariant test.
 *
 * Output: fit-diagnostics/<slug>__<slice>__<contour>.svg
 *
 * Usage: node scripts/visualize-fit-failures.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');

// Reuse the fitter from the invariants test (has exact same logic as src/).
const invPath = path.join(__dirname, 'sketch-fit-invariants-real.cjs');
const invSrc = fs.readFileSync(invPath, 'utf8');
// Extract everything up to (but not including) the "Invariants" header
// — we just want the fitting implementation.
const cutIdx = invSrc.indexOf('// Invariant checks');
if (cutIdx < 0) { console.error('Could not locate invariant section; cannot isolate fitter'); process.exit(1); }
const fitterOnly = invSrc.slice(0, cutIdx) + '\nmodule.exports = { fitContour, fitCircle, refineCircle };\n';
fs.writeFileSync('/tmp/forja-fitter.cjs', fitterOnly);
const { fitContour } = require('/tmp/forja-fitter.cjs');

// ── Failing cases from sketch-fit-invariants-real output ──
const FAILURES = [
  { slug: '827-9999-904_rev_c',          slice: '+Z d5/20',  contour: 0 },
  { slug: '827-9999-906',                 slice: '+Z d5/20',  contour: 0 },
  { slug: '827-9999-908',                 slice: '+Z d5/20',  contour: 0 },
  { slug: 'nist_ctc_02_asme1_rc',         slice: '+Y d8/20',  contour: 0 },
  { slug: 'nist_ctc_03_asme1_rc',         slice: '+Y d3/20',  contour: 0 },
  { slug: 'nist_ftc_06_asme1_rd',         slice: '+X d19/20', contour: 3 },
  { slug: 'nist_ftc_08_asme1_rc',         slice: '+Z d19/20', contour: 1 },
  { slug: 'nist_ftc_10_asme1_rb',         slice: '+Z d9/20',  contour: 0 },
  { slug: 'nist_ftc_10_asme1_rb',         slice: '+Z d17/20', contour: 1 },
  { slug: 'nist_ctc_02_asme1_ap242-e2',   slice: '+Z d1/20',  contour: 4 },
  { slug: 'nist_ctc_02_asme1_ap242-e2',   slice: '+Z d9/20',  contour: 1 },
  { slug: 'nist_ftc_10_asme1_ap242-e2',   slice: '+Y d20/20', contour: 1 },
];

const VIZ_DIR = path.join(__dirname, '..', 'public', 'viz-data');
const OUT_DIR = path.join(__dirname, '..', 'fit-diagnostics');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function dist(a, b) { return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2); }

function polygonArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a) / 2;
}

function entityArea(ents) {
  // Reconstruct polyline from entities, then polygon area.
  const recon = [];
  for (const e of ents) {
    if (e.type === 'line') {
      recon.push({ x: e.start.x, y: e.start.y });
    } else {
      // arc sampling
      const cx = e.center.x, cy = e.center.y, r = e.radius;
      let sa = e.startAngle, ea = e.endAngle;
      if (e.isFullCircle) { sa = 0; ea = 2 * Math.PI; }
      let d = ea - sa;
      while (d <= -Math.PI && !e.isFullCircle) d += 2 * Math.PI;
      while (d > Math.PI && !e.isFullCircle) d -= 2 * Math.PI;
      const N = Math.max(12, Math.ceil(Math.abs(d) * 180 / Math.PI / 5));
      for (let i = 0; i < N; i++) {
        const a = sa + d * (i / N);
        recon.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
    }
  }
  return polygonArea(recon);
}

function renderSVG(rawPts, entities, meta) {
  // Compute bbox over raw + entities
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const addPt = (x, y) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };
  for (const p of rawPts) addPt(p.x, p.y);
  for (const e of entities) {
    if (e.type === 'line') {
      addPt(e.start.x, e.start.y); addPt(e.end.x, e.end.y);
    } else {
      addPt(e.center.x - e.radius, e.center.y - e.radius);
      addPt(e.center.x + e.radius, e.center.y + e.radius);
    }
  }
  const w = maxX - minX, h = maxY - minY;
  const pad = Math.max(w, h) * 0.1;
  minX -= pad; maxX += pad; minY -= pad; maxY += pad;

  const W = 900, H = 900;
  const sx = W / (maxX - minX), sy = H / (maxY - minY);
  const s = Math.min(sx, sy);
  const X = (x) => (x - minX) * s;
  const Y = (y) => H - (y - minY) * s; // flip Y

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:#0d0f14">`);

  // Raw polyline: RED
  if (rawPts.length > 1) {
    let d = `M ${X(rawPts[0].x).toFixed(2)} ${Y(rawPts[0].y).toFixed(2)}`;
    for (let i = 1; i < rawPts.length; i++) {
      d += ` L ${X(rawPts[i].x).toFixed(2)} ${Y(rawPts[i].y).toFixed(2)}`;
    }
    d += ' Z';
    parts.push(`<path d="${d}" fill="none" stroke="#e05050" stroke-width="1.5" stroke-dasharray="4 2" opacity="0.85"/>`);
    // Raw points
    for (const p of rawPts) {
      parts.push(`<circle cx="${X(p.x).toFixed(2)}" cy="${Y(p.y).toFixed(2)}" r="2.5" fill="#e05050" opacity="0.9"/>`);
    }
  }

  // Fitted entities: GOLD
  for (const e of entities) {
    if (e.type === 'line') {
      parts.push(`<line x1="${X(e.start.x).toFixed(2)}" y1="${Y(e.start.y).toFixed(2)}" x2="${X(e.end.x).toFixed(2)}" y2="${Y(e.end.y).toFixed(2)}" stroke="#c9a84c" stroke-width="2.5"/>`);
    } else {
      // SVG arc or circle
      if (e.isFullCircle) {
        parts.push(`<circle cx="${X(e.center.x).toFixed(2)}" cy="${Y(e.center.y).toFixed(2)}" r="${(e.radius * s).toFixed(2)}" fill="none" stroke="#c9a84c" stroke-width="2.5"/>`);
      } else {
        const sa = e.startAngle, ea = e.endAngle;
        let d = ea - sa;
        while (d > 2*Math.PI) d -= 2*Math.PI;
        while (d < 0) d += 2*Math.PI;
        const largeArc = d > Math.PI ? 1 : 0;
        const sweepFlag = 0; // SVG sweep: 0=CCW with y-flip
        const xs = X(e.start.x).toFixed(2), ys = Y(e.start.y).toFixed(2);
        const xe = X(e.end.x).toFixed(2),   ye = Y(e.end.y).toFixed(2);
        const r = (e.radius * s).toFixed(2);
        parts.push(`<path d="M ${xs} ${ys} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${xe} ${ye}" fill="none" stroke="#c9a84c" stroke-width="2.5"/>`);
      }
    }
    // Mark arc/line endpoints
    if (e.type === 'line') {
      parts.push(`<circle cx="${X(e.start.x).toFixed(2)}" cy="${Y(e.start.y).toFixed(2)}" r="3.5" fill="#c9a84c"/>`);
      parts.push(`<circle cx="${X(e.end.x).toFixed(2)}" cy="${Y(e.end.y).toFixed(2)}" r="3.5" fill="#c9a84c"/>`);
    } else if (!e.isFullCircle) {
      parts.push(`<circle cx="${X(e.start.x).toFixed(2)}" cy="${Y(e.start.y).toFixed(2)}" r="3.5" fill="#c9a84c"/>`);
      parts.push(`<circle cx="${X(e.end.x).toFixed(2)}" cy="${Y(e.end.y).toFixed(2)}" r="3.5" fill="#c9a84c"/>`);
      parts.push(`<circle cx="${X(e.center.x).toFixed(2)}" cy="${Y(e.center.y).toFixed(2)}" r="2" fill="#786432"/>`);
    }
  }

  // Label
  const label = `${meta.slug} | ${meta.slice} | c#${meta.contour} | ${rawPts.length}pts → ${entities.length}e | A_raw=${meta.A_raw.toFixed(2)} A_fit=${meta.A_fit.toFixed(2)} ratio=${(meta.A_fit/meta.A_raw).toFixed(2)}`;
  parts.push(`<text x="10" y="20" fill="#c9a84c" font-family="monospace" font-size="12">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`);
  parts.push(`<text x="10" y="${H-30}" fill="#e05050" font-family="monospace" font-size="11">--- RAW polyline (${rawPts.length} pts)</text>`);
  parts.push(`<text x="10" y="${H-14}" fill="#c9a84c" font-family="monospace" font-size="11">— FITTED entities (${entities.length})</text>`);

  parts.push('</svg>');
  return parts.join('\n');
}

function main() {
  let rendered = 0;
  for (const f of FAILURES) {
    const jsonPath = path.join(VIZ_DIR, `${f.slug}.json`);
    if (!fs.existsSync(jsonPath)) {
      console.warn(`  skip: ${f.slug} — JSON not found`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const slice = (data.slices || []).find(s => s.label === f.slice);
    if (!slice) {
      console.warn(`  skip: ${f.slug} — slice "${f.slice}" not found`);
      continue;
    }
    const contour = slice.contours && slice.contours[f.contour];
    if (!contour || !contour.points) {
      console.warn(`  skip: ${f.slug} — contour ${f.contour} not found`);
      continue;
    }

    const pts = contour.points.map(p => ({ x: p[0], y: p[1] }));
    const result = fitContour(pts);
    const ents = result.entities;

    const A_raw = polygonArea(pts);
    const A_fit = entityArea(ents);

    const svg = renderSVG(pts, ents, {
      slug: f.slug, slice: f.slice, contour: f.contour,
      A_raw, A_fit,
    });

    const outName = `${f.slug}__${f.slice.replace(/[^\w-]/g, '_')}__c${f.contour}.svg`;
    fs.writeFileSync(path.join(OUT_DIR, outName), svg);
    console.log(`  ✓ ${outName}  (${pts.length}pts → ${ents.length}e, ratio=${(A_fit/A_raw).toFixed(2)})`);
    rendered++;
  }
  console.log(`\n→ ${rendered} SVGs in ${OUT_DIR}`);
}

main();
