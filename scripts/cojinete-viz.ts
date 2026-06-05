/* Visualiza el AUTOCENTRADO HIDRODINÁMICO de la jaula (su resultado es un vector → se VE).
   4 paneles: (1) plano vs cuña = la joroba de presión, (2) carga vs razón de cuña con el
   óptimo, (3) fuerza restauradora vs deriva, (4) la FIGURA angulada en la jaula.
   node --import tsx scripts/cojinete-viz.ts  →  forja-shots/cojinete/cojinete.html */
import * as fs from 'fs';
import {
  wedgePressureProfile, wedgeLoadCoeff, optimumWedgeRatio, selfCenter, designCageWedge,
} from '../src/forja/mech/cojinete-jaula';

const GOLD = '#d8a657', INK = '#0d1218', STEEL = '#9fb3c8', GREEN = '#7ee081', RED = '#e06c6c', BLUE = '#6fb6c9';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots/cojinete';
fs.mkdirSync(DIR, { recursive: true });

const opt = optimumWedgeRatio();
const dz = designCageWedge({ R: 40, Rr: 3, lobes: 10, E: 1.5, T: 6, gap: 0.7, rpmIn: 600 });

// ── Panel 1: PLANO vs CUÑA — el perfil del hueco + la joroba de presión ──
function wedgePanel(): string {
  const x0 = 60, x1 = 560, yDisc = 250, gapPx = 60;      // disco abajo (móvil)
  const n = 2.2, prof = wedgePressureProfile(n, 80);
  const h1px = gapPx, h2px = gapPx / n;                   // boca ancha → garganta
  // land superior inclinado (la cuña): de y=yDisc-h1px (izq) a yDisc-h2px (der)
  const landY = (xi: number) => yDisc - (h1px - (h1px - h2px) * xi);
  let land = '';
  for (let i = 0; i <= 80; i++) { const X = x0 + (x1 - x0) * (i / 80); land += `${i ? 'L' : 'M'}${X.toFixed(1)},${landY(i / 80).toFixed(1)} `; }
  // película (relleno entre disco y land)
  const film = `M${x0},${yDisc} L${x1},${yDisc} L${x1},${landY(1)} ${land.replace(/^M/, 'L').split(' ').reverse().join(' ')}`;
  // presión: curva normalizada arriba
  const pmax = Math.max(...prof.map((p) => p.Pbar));
  const pTop = 60, pScale = 120 / pmax;
  let pCurve = '', pFill = `M${x0},${pTop + 120} `;
  prof.forEach((p, i) => { const X = x0 + (x1 - x0) * (i / 80); const Y = pTop + 120 - p.Pbar * pScale; pCurve += `${i ? 'L' : 'M'}${X.toFixed(1)},${Y.toFixed(1)} `; pFill += `L${X.toFixed(1)},${Y.toFixed(1)} `; });
  pFill += `L${x1},${pTop + 120} Z`;
  const Hpeak = 2 * n / (n + 1), xiPeak = (n - Hpeak) / (n - 1), Xpeak = x0 + (x1 - x0) * xiPeak;
  return `
  <text x="${x0}" y="28" fill="${GOLD}" font-size="14" font-weight="bold">la JOROBA de presión (sólo si hay cuña)</text>
  <path d="${pFill}" fill="${GOLD}22"/><path d="${pCurve}" fill="none" stroke="${GOLD}" stroke-width="2.5"/>
  <line x1="${Xpeak}" y1="${pTop - 4}" x2="${Xpeak}" y2="${yDisc}" stroke="${GOLD}55" stroke-width="1" stroke-dasharray="3 3"/>
  <text x="${Xpeak + 5}" y="${pTop + 6}" fill="${GOLD}" font-size="11">pico p en la garganta</text>
  <line x1="${x0}" y1="${pTop + 122}" x2="${x1}" y2="${pTop + 122}" stroke="${STEEL}33" stroke-width="1" stroke-dasharray="2 4"/>
  <text x="${x1 + 6}" y="${pTop + 90}" fill="${RED}" font-size="11">plano</text>
  <text x="${x1 + 6}" y="${pTop + 104}" fill="${RED}" font-size="11">p = 0</text>
  <line x1="${x0}" y1="${pTop + 122}" x2="${x1}" y2="${pTop + 122}" stroke="${RED}" stroke-width="2" stroke-dasharray="6 5"/>
  <path d="${film}" fill="${BLUE}33" stroke="none"/>
  <path d="${land}" fill="none" stroke="${STEEL}" stroke-width="3"/>
  <line x1="${x0}" y1="${yDisc}" x2="${x1}" y2="${yDisc}" stroke="${GREEN}" stroke-width="4"/>
  <text x="${x0}" y="${yDisc + 22}" fill="${GREEN}" font-size="12">DISCO (se mueve →, arrastra el aceite)</text>
  <line x1="${x0 + 150}" y1="${yDisc + 34}" x2="${x0 + 230}" y2="${yDisc + 34}" stroke="${GREEN}" stroke-width="2" marker-end="url(#ah)"/>
  <text x="${x0 - 4}" y="${yDisc - h1px - 6}" fill="${STEEL}" font-size="11">h₁ (boca)</text>
  <text x="${x1 - 50}" y="${yDisc - h2px - 6}" fill="${STEEL}" font-size="11">h₂ (garganta)</text>
  <text x="${x0}" y="${yDisc + 52}" fill="${BLUE}" font-size="12">cuña CONVERGENTE = land de la jaula (FIJO)</text>`;
}

// ── Panel 2: la CARGA vs la razón de cuña, con el óptimo n*≈2.19 ──
function loadPanel(): string {
  const x0 = 70, y0 = 250, W = 480, H = 200;
  let curve = '';
  const nMax = 5, samp = 120, cMax = 0.0267;
  for (let i = 0; i <= samp; i++) { const nn = 1 + (nMax - 1) * (i / samp); const c = wedgeLoadCoeff(nn); const X = x0 + W * (i / samp); const Y = y0 - (c / cMax) * H; curve += `${i ? 'L' : 'M'}${X.toFixed(1)},${Y.toFixed(1)} `; }
  const Xopt = x0 + W * ((opt.n - 1) / (nMax - 1)), Yopt = y0 - H;
  return `
  <text x="${x0}" y="28" fill="${GOLD}" font-size="14" font-weight="bold">carga del aceite W̄(n) — hay un ÓPTIMO</text>
  <line x1="${x0}" y1="${y0}" x2="${x0 + W}" y2="${y0}" stroke="${STEEL}44" stroke-width="1"/>
  <line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0 - H - 10}" stroke="${STEEL}44" stroke-width="1"/>
  <path d="${curve}" fill="none" stroke="${GOLD}" stroke-width="2.5"/>
  <circle cx="${x0}" cy="${y0}" r="5" fill="${RED}"/><text x="${x0 - 6}" y="${y0 + 20}" fill="${RED}" font-size="11">n=1 PLANO → 0</text>
  <line x1="${Xopt}" y1="${y0}" x2="${Xopt}" y2="${Yopt}" stroke="${GREEN}55" stroke-width="1" stroke-dasharray="3 3"/>
  <circle cx="${Xopt}" cy="${Yopt}" r="6" fill="${GREEN}"/>
  <text x="${Xopt - 30}" y="${Yopt - 10}" fill="${GREEN}" font-size="12">n* = ${opt.n}</text>
  <text x="${x0 + W - 70}" y="${y0 + 20}" fill="${STEEL}" font-size="11">h₁/h₂ →</text>
  <text x="${x0 + 40}" y="${y0 - H + 6}" fill="${STEEL}" font-size="11">máx carga ≈ 0.0267</text>`;
}

// ── Panel 3: AUTOCENTRADO — fuerza restauradora vs deriva (con el spike 1/h²) ──
function centerPanel(): string {
  const x0 = 70, yMid = 170, W = 480, H = 120;
  const op = { muPaS: 0.1, U_mps: dz.U_mps, B_mm: dz.landB_mm, L_mm: dz.landL_mm, h2_mm: dz.h2_mm, n: opt.n };
  const eMax = dz.h2_mm * 0.9, samp = 80;
  const fs_ = [] as number[]; for (let i = 0; i <= samp; i++) fs_.push(selfCenter(op, eMax * (i / samp)).F_N);
  const fMax = Math.max(...fs_.map(Math.abs));
  let curve = '';
  for (let i = 0; i <= samp; i++) { const X = x0 + W * (i / samp); const Y = yMid - (fs_[i] / fMax) * H; curve += `${i ? 'L' : 'M'}${X.toFixed(1)},${Y.toFixed(1)} `; }
  return `
  <text x="${x0}" y="28" fill="${GOLD}" font-size="14" font-weight="bold">autocentrado: la fuerza EMPUJA de regreso</text>
  <line x1="${x0}" y1="${yMid}" x2="${x0 + W}" y2="${yMid}" stroke="${STEEL}44" stroke-width="1"/>
  <text x="${x0 + W - 4}" y="${yMid + 18}" fill="${STEEL}" font-size="11" text-anchor="end">deriva del disco hacia el rodillo →</text>
  <path d="${curve}" fill="none" stroke="${GREEN}" stroke-width="3"/>
  <circle cx="${x0}" cy="${yMid}" r="4" fill="${STEEL}"/><text x="${x0}" y="${yMid - 8}" fill="${STEEL}" font-size="11">centro: F=0</text>
  <text x="${x0 + W - 8}" y="${yMid - H + 4}" fill="${GREEN}" font-size="11" text-anchor="end">F restauradora ~1/h² ↑ (muerde al acercarse)</text>
  <text x="${x0}" y="${yMid + 50}" fill="${STEEL}" font-size="12">k = ${dz.centeringStiffness_N_per_mm} N/mm  ·  estable (k&gt;0)</text>
  <text x="${x0}" y="${yMid + 70}" fill="${STEEL}" font-size="12">carga total ${dz.totalLoad_N} N vs peso disco ${dz.discWeight_N} N → no FLOTA, pero CENTRA</text>`;
}

// ── Panel 4: la FIGURA en la jaula — rodillo + disco + cuña + ángulo de impresión ──
function cagePanel(): string {
  const cx = 200, cy = 180, Rr = 34;                     // un rodillo (vista superior)
  // disco (arco grande que barre) + cuña convergente (land) tangente al rodillo
  const lobe = `M${cx - 150},${cy + 70} Q${cx},${cy + 10} ${cx + 150},${cy + 70}`;
  // land/cuña: de boca ancha (izq) a garganta (der) sobre el rodillo
  const land = `M${cx - 120},${cy - 18} L${cx + 60},${cy + 30} L${cx + 60},${cy + 40} L${cx - 120},${cy - 4} Z`;
  return `
  <text x="40" y="28" fill="${GOLD}" font-size="14" font-weight="bold">la FIGURA: cuña en la jaula (no pared plana)</text>
  <circle cx="${cx}" cy="${cy}" r="${Rr}" fill="${STEEL}22" stroke="${STEEL}" stroke-width="2"/>
  <text x="${cx}" y="${cy + 4}" fill="${STEEL}" font-size="11" text-anchor="middle">rodillo</text>
  <path d="${land}" fill="${GOLD}33" stroke="${GOLD}" stroke-width="2"/>
  <text x="${cx - 118}" y="${cy - 24}" fill="${GOLD}" font-size="10">boca h₁</text>
  <text x="${cx + 30}" y="${cy + 56}" fill="${GOLD}" font-size="10">garganta h₂</text>
  <path d="${lobe}" fill="none" stroke="${GREEN}" stroke-width="3"/>
  <text x="${cx - 150}" y="${cy + 90}" fill="${GREEN}" font-size="11">lóbulo del disco (orbita →)</text>
  <line x1="${cx - 60}" y1="${cy + 64}" x2="${cx + 20}" y2="${cy + 56}" stroke="${GREEN}" stroke-width="2" marker-end="url(#ah)"/>
  <text x="40" y="${cy + 130}" fill="${BLUE}" font-size="12">el aceite entra por h₁, se comprime hacia h₂ → presión → centra</text>
  <text x="40" y="${cy + 150}" fill="${STEEL}" font-size="11">rampa hidrodinámica ${dz.rampDeg}° (poco profunda)</text>
  <text x="40" y="${cy + 168}" fill="${STEEL}" font-size="11">+ inclinación ${dz.landTiltDeg}° en Z → AUTO-SOPORTA al imprimir ✓</text>`;
}

const svg = (w: number, h: number, inner: string) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${GREEN}"/></marker></defs><rect width="${w}" height="${h}" fill="${INK}"/>${inner}</svg>`;

const html = `<!doctype html><html><head><meta charset="utf8"><style>body{margin:0;background:${INK};font-family:system-ui;color:${STEEL}}h1{color:${GOLD};text-align:center;padding:16px 0 4px;font-size:21px}.sub{text-align:center;color:${STEEL};font-size:13px;padding-bottom:10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px}.card{background:#121a22;border:1px solid ${GOLD}33;border-radius:10px;padding:8px}</style></head>
<body><h1>La jaula AUTOCENTRA con aceite — el ÁNGULO es la clave</h1>
<div class="sub">Reynolds 1D: película PLANA → p=0 (cero centrado) · cuña CONVERGENTE → joroba de presión → centra. Mismo ángulo auto-soporta la impresión.</div>
<div class="grid">
<div class="card">${svg(680, 340, wedgePanel())}</div>
<div class="card">${svg(640, 320, loadPanel())}</div>
<div class="card">${svg(640, 300, centerPanel())}</div>
<div class="card">${svg(540, 380, cagePanel())}</div>
</div></body></html>`;

fs.writeFileSync(`${DIR}/cojinete.html`, html);
console.log('VIZ ok → ' + DIR + '/cojinete.html');
