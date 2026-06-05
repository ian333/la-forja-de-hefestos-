/* Visualiza el cojinete CONTINUO (su resultado es un vector → se VE). 4 paneles:
   (1) la CURVA de aceite continua h(θ) donde flota el disco, (2) curva CONTINUA vs
   pads discretos (la corrección), (3) Stribeck: fricción ~nula en full-film,
   (4) "solo la carga rompe": h_min vs carga, con el presupuesto full-film.
   node --import tsx scripts/cojinete-continuo-viz.ts  →  forja-shots/cojinete/continuo.html */
import * as fs from 'fs';
import { filmCurve, eccentricityForLoad, filmFourier } from '../src/forja/mech/cojinete-continuo';

const GOLD = '#d8a657', INK = '#0d1218', STEEL = '#9fb3c8', GREEN = '#7ee081', RED = '#e06c6c', BLUE = '#6fb6c9', AMBER = '#e0a96c';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots/cojinete';
fs.mkdirSync(DIR, { recursive: true });

// ── Panel 1: la CURVA de aceite continua — el disco FLOTA y sigue su trayectoria ──
function filmPanel(): string {
  const cx = 200, cy = 195, Rb = 130, epsV = 0.55, ePx = (Rb * 0.18) * epsV / 0.55; // exagerado
  const Rj = Rb - 26;                                   // muñón (leva)
  const cyJ = cy + 26 - 2 + ePx;                         // muñón desplazado hacia la carga (abajo)
  void filmCurve;
  // joroba de presión: SOLO el semiarco cargado/convergente (abajo), no toda la vuelta.
  // θ de π/2 a 3π/2 (lado de abajo); presión ~ sin del arco, cero en los bordes.
  let pPath = `M${cx},${cy + Rb + 3} `;
  const i0 = 45, i1 = 135;                               // de 90° a 270° (semiarco inferior)
  for (let i = i0; i <= i1; i++) {
    const th = (2 * Math.PI * i) / 180;                  // π/2 … 3π/2
    const ang = -Math.PI / 2 + th;
    const bump = Math.sin(((i - i0) / (i1 - i0)) * Math.PI); // 0→1→0 (joroba limpia)
    const r = Rb + 3 + bump * 48;
    pPath += `L${(cx + r * Math.cos(ang)).toFixed(1)},${(cy + r * Math.sin(ang)).toFixed(1)} `;
  }
  return `
  <text x="40" y="26" fill="${GOLD}" font-size="14" font-weight="bold">la CURVA: película continua donde flota</text>
  <circle cx="${cx}" cy="${cy}" r="${Rb}" fill="none" stroke="${STEEL}" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="${Rb}" fill="${BLUE}11"/>
  <circle cx="${cx}" cy="${cyJ}" r="${Rj}" fill="#1a2530" stroke="${GOLD}" stroke-width="2.5"/>
  <text x="${cx}" y="${cyJ + 4}" fill="${GOLD}" font-size="12" text-anchor="middle">leva (muñón)</text>
  <path d="${pPath}" fill="none" stroke="${GREEN}" stroke-width="2.5"/>
  <text x="${cx - 150}" y="${cy + Rb + 36}" fill="${GREEN}" font-size="11">joroba de presión (continua, en la convergencia)</text>
  <line x1="${cx}" y1="${cy - Rb - 6}" x2="${cx}" y2="${cyJ - Rj - 4}" stroke="${STEEL}" stroke-width="6" opacity="0.5"/>
  <text x="${cx + 6}" y="${cy - Rb + 2}" fill="${STEEL}" font-size="11">h_max</text>
  <text x="${cx + 6}" y="${cy + Rb - 6}" fill="${RED}" font-size="11">h_min = c(1−ε)</text>
  <text x="40" y="${cy + Rb + 56}" fill="${STEEL}" font-size="12">h(θ)=c(1+ε·cos θ) — el disco NO toca metal: orbita sobre aceite</text>
  <text x="40" y="${cy + Rb + 74}" fill="${BLUE}" font-size="11">cara-𝔦 (operador 𝔄): DC=holgura, k=1=la onda de CENTRADO → ${JSON.stringify(filmFourier(0.3, 0.5))}</text>`;
}

// ── Panel 2: CONTINUA vs PADS discretos (la corrección del usuario) ──
function vsPanel(): string {
  const cyA = 150, cxA = 150, cxB = 430, R = 70;
  // continua: lóbulo de presión suave todo alrededor
  let cont = '';
  for (let i = 0; i <= 180; i++) { const th = (2 * Math.PI * i) / 180; const conv = Math.max(0, -Math.cos(th)); const r = R + conv * 30; const a = -Math.PI / 2 + th; cont += `${i ? 'L' : 'M'}${(cxA + r * Math.cos(a)).toFixed(1)},${(cyA + r * Math.sin(a)).toFixed(1)} `; }
  // pads: 4 jorobas discretas con HUECOS entre ellas
  let pads = '';
  for (let k = 0; k < 4; k++) { const c0 = (2 * Math.PI * k) / 4; for (let i = 0; i <= 30; i++) { const t = i / 30; const th = c0 - 0.5 + t; const bump = Math.sin(Math.PI * t); const r = R + bump * 26; const a = -Math.PI / 2 + th; pads += `${i ? 'L' : 'M'}${(cxB + r * Math.cos(a)).toFixed(1)},${(cyB(cyA) + r * Math.sin(a)).toFixed(1)} `; } pads += ' '; }
  function cyB(y: number) { return y; }
  return `
  <text x="40" y="26" fill="${GOLD}" font-size="14" font-weight="bold">curva CONTINUA vs pads discretos</text>
  <circle cx="${cxA}" cy="${cyA}" r="${R}" fill="none" stroke="${STEEL}" stroke-width="1.5"/>
  <path d="${cont}" fill="${GREEN}22" stroke="${GREEN}" stroke-width="2.5"/>
  <text x="${cxA}" y="${cyA + R + 30}" fill="${GREEN}" font-size="12" text-anchor="middle">CONTINUA ✓</text>
  <text x="${cxA}" y="${cyA + R + 48}" fill="${STEEL}" font-size="11" text-anchor="middle">centra en cualquier dirección</text>
  <circle cx="${cxB}" cy="${cyA}" r="${R}" fill="none" stroke="${STEEL}" stroke-width="1.5"/>
  <path d="${pads}" fill="${AMBER}22" stroke="${AMBER}" stroke-width="2"/>
  <text x="${cxB}" y="${cyA + R + 30}" fill="${AMBER}" font-size="12" text-anchor="middle">PADS (cuñas)</text>
  <text x="${cxB}" y="${cyA + R + 48}" fill="${RED}" font-size="11" text-anchor="middle">huecos: ciego entre pads</text>`;
}

// ── Panel 3: Stribeck — fricción ~NULA en full-film, sin desgaste ──
function stribeckPanel(): string {
  const x0 = 70, y0 = 230, W = 470, H = 170;
  // curva de Stribeck canónica: f alto en frontera, mínimo cerca de λ~3, sube leve en full-film
  const fOf = (lam: number) => 0.13 * Math.exp(-lam / 0.7) + 0.004 + 0.0016 * Math.max(0, lam - 3);
  let curve = ''; const lamMax = 8, fMax = 0.14;
  for (let i = 0; i <= 200; i++) { const lam = (lamMax * i) / 200; const X = x0 + W * (i / 200); const Y = y0 - (fOf(lam) / fMax) * H; curve += `${i ? 'L' : 'M'}${X.toFixed(1)},${Y.toFixed(1)} `; }
  const xLam = (l: number) => x0 + W * (l / lamMax);
  return `
  <text x="40" y="26" fill="${GOLD}" font-size="14" font-weight="bold">Stribeck: la fricción cae a ~NULA en full-film</text>
  <rect x="${x0}" y="${y0 - H}" width="${xLam(1) - x0}" height="${H}" fill="${RED}11"/>
  <rect x="${xLam(1)}" y="${y0 - H}" width="${xLam(3) - xLam(1)}" height="${H}" fill="${AMBER}11"/>
  <rect x="${xLam(3)}" y="${y0 - H}" width="${x0 + W - xLam(3)}" height="${H}" fill="${GREEN}11"/>
  <line x1="${x0}" y1="${y0}" x2="${x0 + W}" y2="${y0}" stroke="${STEEL}44"/>
  <path d="${curve}" fill="none" stroke="${GOLD}" stroke-width="2.5"/>
  <text x="${(x0 + xLam(1)) / 2}" y="${y0 - H + 16}" fill="${RED}" font-size="11" text-anchor="middle">frontera</text>
  <text x="${(xLam(1) + xLam(3)) / 2}" y="${y0 - H + 16}" fill="${AMBER}" font-size="11" text-anchor="middle">mixto</text>
  <text x="${(xLam(3) + x0 + W) / 2}" y="${y0 - H + 16}" fill="${GREEN}" font-size="11" text-anchor="middle">FULL-FILM</text>
  <text x="${(xLam(3) + x0 + W) / 2}" y="${y0 - H + 32}" fill="${GREEN}" font-size="10" text-anchor="middle">sin desgaste · f≈0.003</text>
  <text x="${x0 + W}" y="${y0 + 18}" fill="${STEEL}" font-size="11" text-anchor="end">λ = h_min/σ →</text>
  <circle cx="${xLam(0.26)}" cy="${y0 - (fOf(0.26) / fMax) * H}" r="5" fill="${RED}"/>
  <text x="${xLam(0.26) + 8}" y="${y0 - (fOf(0.26) / fMax) * H}" fill="${RED}" font-size="10">5 N·m (frontera)</text>
  <circle cx="${xLam(4.3)}" cy="${y0 - (fOf(4.3) / fMax) * H}" r="5" fill="${GREEN}"/>
  <text x="${xLam(4.3) + 8}" y="${y0 - (fOf(4.3) / fMax) * H - 6}" fill="${GREEN}" font-size="10">0.4 N·m (flota)</text>`;
}

// ── Panel 4: "SOLO LA CARGA ROMPE" — h_min vs carga (Ocvirk real) ──
function breakPanel(): string {
  const x0 = 70, y0 = 250, W = 470, H = 180;
  const c = 0.12, sigma = 0.015, base = { muPaS: 0.3, rpm: 1500, R_mm: 9.5, L_mm: 6, c_mm: c };
  const Wmax = 30, pts: { w: number; h: number }[] = [];
  for (let i = 0; i <= 120; i++) { const w = 0.3 + (Wmax - 0.3) * (i / 120); const eps = eccentricityForLoad({ ...base, W_N: w }); pts.push({ w, h: c * (1 - eps) }); }
  const hMaxPx = c, yH = (h: number) => y0 - (h / hMaxPx) * H, xW = (w: number) => x0 + W * (w / Wmax);
  let curve = ''; pts.forEach((p, i) => { curve += `${i ? 'L' : 'M'}${xW(p.w).toFixed(1)},${yH(p.h).toFixed(1)} `; });
  const yFull = yH(3 * sigma);          // λ=3 (full-film limit)
  return `
  <text x="40" y="26" fill="${GOLD}" font-size="14" font-weight="bold">"solo la carga rompe": h_min vs carga</text>
  <line x1="${x0}" y1="${y0}" x2="${x0 + W}" y2="${y0}" stroke="${STEEL}44"/>
  <line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0 - H - 6}" stroke="${STEEL}44"/>
  <rect x="${x0}" y="${yFull}" width="${W}" height="${y0 - yFull}" fill="${RED}10"/>
  <line x1="${x0}" y1="${yFull}" x2="${x0 + W}" y2="${yFull}" stroke="${GREEN}" stroke-width="1.5" stroke-dasharray="6 4"/>
  <text x="${x0 + 6}" y="${yFull - 6}" fill="${GREEN}" font-size="11">λ=3 (full-film) — debajo: roza/desgasta</text>
  <path d="${curve}" fill="none" stroke="${GOLD}" stroke-width="2.5"/>
  <text x="${x0 + W}" y="${y0 + 18}" fill="${STEEL}" font-size="11" text-anchor="end">carga radial W (N) →</text>
  <text x="${x0 - 8}" y="${y0 - H}" fill="${STEEL}" font-size="11" text-anchor="end">h_min</text>
  <text x="40" y="${y0 + 40}" fill="${STEEL}" font-size="11">ni fricción ni desgaste bajan h_min — SOLO la carga. Presupuesto full-film ≈ 12 N.</text>`;
}

const svg = (w: number, h: number, inner: string) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="${INK}"/>${inner}</svg>`;

const html = `<!doctype html><html><head><meta charset="utf8"><style>body{margin:0;background:${INK};font-family:system-ui;color:${STEEL}}h1{color:${GOLD};text-align:center;padding:16px 0 4px;font-size:21px}.sub{text-align:center;font-size:13px;padding-bottom:10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px}.card{background:#121a22;border:1px solid ${GOLD}33;border-radius:10px;padding:8px}</style></head>
<body><h1>Autocentrado CONTINUO — curvas de aceite, no cuñas</h1>
<div class="sub">El disco flota en una película continua h(θ)=c(1+ε·cos θ) toda su trayectoria · fricción ~nula en full-film · solo la carga rompe.</div>
<div class="grid">
<div class="card">${svg(580, 330, filmPanel())}</div>
<div class="card">${svg(580, 250, vsPanel())}</div>
<div class="card">${svg(580, 280, stribeckPanel())}</div>
<div class="card">${svg(580, 310, breakPanel())}</div>
</div></body></html>`;

fs.writeFileSync(`${DIR}/continuo.html`, html);
console.log('VIZ ok → ' + DIR + '/continuo.html');
