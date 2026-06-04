/* Visualiza el Operador 𝔄: el resultado es un VECTOR, así que se VE. Emite un HTML
   con 4 paneles (flechas de fase=balance, espectro, batido=ratio, campo de uniones).
   node --import tsx scripts/operador-viz.ts  →  forja-shots/operador/operador.html */
import * as fs from 'fs';
import { cyclicBalance, modeSpectrum } from '../src/forja/mech/operador-mecanismos';

const GOLD = '#d8a657', INK = '#0d1218', STEEL = '#9fb3c8';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots/operador';
fs.mkdirSync(DIR, { recursive: true });

// ── Panel 1: flechas de fase → suman CERO (balance), vs N=1 (no cancela) ──
function phasesPanel(N: number, cxp: number): string {
  const cy = 150, R = 105;
  let sx = 0, sy = 0, arrows = '';
  for (let n = 0; n < N; n++) {
    const a = (2 * Math.PI * n) / N;
    const ex = cxp + R * Math.cos(a), ey = cy - R * Math.sin(a);
    sx += Math.cos(a); sy += Math.sin(a);
    arrows += `<line x1="${cxp}" y1="${cy}" x2="${ex}" y2="${ey}" stroke="${GOLD}" stroke-width="3" marker-end="url(#ah)"/>`;
  }
  const rx = cxp + R * sx / Math.max(1, N) * 1, ry = cy - R * sy / Math.max(1, N);
  const sumMag = Math.hypot(sx, sy);
  const sum = sumMag < 1e-6
    ? `<circle cx="${cxp}" cy="${cy}" r="6" fill="#7ee081"/><text x="${cxp}" y="${cy + 130}" fill="#7ee081" font-size="13" text-anchor="middle">Σ = 0  → BALANCEADO</text>`
    : `<line x1="${cxp}" y1="${cy}" x2="${rx}" y2="${ry}" stroke="#e06c6c" stroke-width="5" marker-end="url(#ar)"/><text x="${cxp}" y="${cy + 130}" fill="#e06c6c" font-size="13" text-anchor="middle">Σ ≠ 0  → DESBALANCEADO</text>`;
  return `<circle cx="${cxp}" cy="${cy}" r="${R}" fill="none" stroke="${STEEL}33" stroke-width="1"/>${arrows}${sum}<text x="${cxp}" y="35" fill="${STEEL}" font-size="13" text-anchor="middle">N = ${N} discos</text>`;
}

// ── Panel 2: espectro de modos |X_k| (una sola frecuencia → DC=0) ──
function spectrumPanel(N: number, x0: number): string {
  const spec = cyclicBalance(N).spectrum, w = 34, base = 250, h = 150;
  let bars = '';
  for (let k = 0; k < N; k++) {
    const bh = spec[k] * h, bx = x0 + k * (w + 8);
    const col = k === 0 ? '#e06c6c' : GOLD;
    bars += `<rect x="${bx}" y="${base - bh}" width="${w}" height="${bh}" fill="${col}" rx="3"/><text x="${bx + w / 2}" y="${base + 16}" fill="${STEEL}" font-size="12" text-anchor="middle">k=${k}</text>`;
    if (spec[k] > 0.05) bars += `<text x="${bx + w / 2}" y="${base - bh - 6}" fill="${col}" font-size="11" text-anchor="middle">${spec[k].toFixed(2)}</text>`;
  }
  return `<text x="${x0}" y="60" fill="${STEEL}" font-size="13">espectro |X_k| — DC (k=0) = ${cyclicBalance(N).dc.toFixed(2)}; pico en k=1 (onda pura)</text>${bars}`;
}

// ── Panel 3: el BATIDO → el ratio. Dos ondas (Zc lóbulos, Zr rodillos) + su batido ──
function beatPanel(Zc: number, Zr: number, x0: number, yMid: number): string {
  const W = 560, amp = 30; let p1 = '', p2 = '', pb = '';
  for (let i = 0; i <= 560; i++) {
    const th = (2 * Math.PI * i) / 560, X = x0 + i;
    p1 += `${i ? 'L' : 'M'}${X},${yMid - 70 + amp * Math.sin(Zc * th)} `;
    p2 += `${i ? 'L' : 'M'}${X},${yMid + amp * Math.sin(Zr * th)} `;
    pb += `${i ? 'L' : 'M'}${X},${yMid + 80 + 40 * Math.sin((Zr - Zc) * th)} `;  // batido = |Zr-Zc|
  }
  return `<text x="${x0}" y="${yMid - 100}" fill="${GOLD}" font-size="12">disco: ${Zc} lóbulos</text><path d="${p1}" fill="none" stroke="${GOLD}" stroke-width="2"/>
  <text x="${x0}" y="${yMid - 22}" fill="#6fb6c9" font-size="12">anillo: ${Zr} rodillos</text><path d="${p2}" fill="none" stroke="#6fb6c9" stroke-width="2"/>
  <text x="${x0}" y="${yMid + 58}" fill="#7ee081" font-size="12">BATIDO = |${Zr}−${Zc}| = 1 → la salida gira LENTO (ratio = ${Zc}/${Zr} según qué fijes)</text><path d="${pb}" fill="none" stroke="#7ee081" stroke-width="3"/>`;
}

// ── Panel 4: campo de uniones b(θ) — holgura (azul) + cuellos (rojo) ──
function bondPanel(cxp: number, cy: number): string {
  const R = 95; let arcs = `<circle cx="${cxp}" cy="${cy}" r="${R}" fill="none" stroke="#6fb6c9" stroke-width="10"/>`;
  for (let k = 0; k < 12; k++) { const a = (2 * Math.PI * k) / 12; arcs += `<circle cx="${cxp + R * Math.cos(a)}" cy="${cy - R * Math.sin(a)}" r="5" fill="#e06c6c"/>`; }
  return `${arcs}<text x="${cxp}" y="${cy - R - 14}" fill="${STEEL}" font-size="13" text-anchor="middle">campo de uniones b(θ)</text>
  <text x="${cxp}" y="${cy + R + 24}" fill="#6fb6c9" font-size="12" text-anchor="middle">azul = HOLGURA (gira)</text>
  <text x="${cxp}" y="${cy + R + 42}" fill="#e06c6c" font-size="12" text-anchor="middle">rojo = CUELLO frangible (rompe)</text>`;
}

const svg = (w: number, h: number, inner: string) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${GOLD}"/></marker><marker id="ar" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#e06c6c"/></marker></defs><rect width="${w}" height="${h}" fill="${INK}"/>${inner}</svg>`;

const html = `<!doctype html><html><head><meta charset="utf8"><style>body{margin:0;background:${INK};font-family:system-ui;color:${STEEL}}h1{color:${GOLD};text-align:center;padding:16px;font-size:20px}h2{color:${GOLD};margin:8px 0 0 16px;font-size:14px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px}.card{background:#121a22;border:1px solid ${GOLD}33;border-radius:10px;padding:8px}</style></head>
<body><h1>Operador 𝔄 — el mecanismo, VISTO (su resultado es un vector)</h1><div class="grid">
<div class="card"><h2>1 · Balance = las flechas de fase suman CERO</h2>${svg(620, 310, phasesPanel(5, 160) + phasesPanel(1, 460))}</div>
<div class="card"><h2>2 · Espectro: una sola frecuencia (k=1) → DC=0</h2>${svg(620, 300, spectrumPanel(5, 30))}</div>
<div class="card"><h2>3 · Ratio = el BATIDO de las dos ondas</h2>${svg(620, 320, beatPanel(10, 11, 30, 150))}</div>
<div class="card"><h2>4 · Campo de uniones b(θ) sobre la misma cara-𝔦</h2>${svg(620, 300, bondPanel(310, 150))}</div>
</div></body></html>`;

fs.writeFileSync(`${DIR}/operador.html`, html);
console.log('VIZ ok → ' + DIR + '/operador.html');
