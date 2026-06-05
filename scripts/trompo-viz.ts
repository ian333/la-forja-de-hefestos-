/* Visualiza la transmisión 3D (trompo): (1) descomposición tangencial/radial/AXIAL,
   (2) barril SIMÉTRICO → axial neto 0 (la clave), (3) torque ~intacto vs ψ, (4) escalado
   a 100 g. node --import tsx scripts/trompo-viz.ts → forja-shots/trompo/trompo.html */
import * as fs from 'fs';
import { decompose, torqueRetention, scaleForMass, printabilityAtScale, minPrintable } from '../src/forja/mech/trompo';

const GOLD = '#d8a657', INK = '#0d1218', STEEL = '#9fb3c8', GREEN = '#7ee081', RED = '#e06c6c', BLUE = '#6fb6c9', VIOLET = '#b58cf0';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots/trompo';
fs.mkdirSync(DIR, { recursive: true });
const base = { massG: 320.7, params: { R: 40, T: 6, E: 1.5, Rr: 3, shaftD: 16, shaftBore: 8, lobes: 10, discs: 5 } };

// ── Panel 1: descomposición — plano (sin axial) vs curvo (aparece axial) ──
function decompPanel(): string {
  const cx = 290, cy = 175;
  const f = decompose(100, 20, 0), c = decompose(100, 20, 18);
  const sc = 1.0;
  const arrow = (x: number, y: number, dx: number, dy: number, col: string, lbl: string) =>
    `<line x1="${x}" y1="${y}" x2="${x + dx}" y2="${y + dy}" stroke="${col}" stroke-width="3" marker-end="url(#ar)"/><text x="${x + dx + (dx > 0 ? 4 : -4)}" y="${y + dy}" fill="${col}" font-size="11" text-anchor="${dx < 0 ? 'end' : 'start'}">${lbl}</text>`;
  return `
  <text x="40" y="26" fill="${GOLD}" font-size="14" font-weight="bold">la fuerza del contacto: ¿axial Y radial?</text>
  <text x="120" y="55" fill="${STEEL}" font-size="12" text-anchor="middle">diente PLANO (ψ=0)</text>
  ${arrow(120, 150, 0, -c.tangential * sc * 0.7, GREEN, 'tang→torque')}
  ${arrow(120, 150, f.radial * sc * 0.7, 0, BLUE, 'radial')}
  <circle cx="120" cy="150" r="3" fill="${STEEL}"/>
  <text x="120" y="250" fill="${RED}" font-size="11" text-anchor="middle">axial = 0 ✓</text>
  <text x="430" y="55" fill="${STEEL}" font-size="12" text-anchor="middle">diente CURVO (ψ=18°)</text>
  ${arrow(430, 150, 0, -c.tangential * sc * 0.7, GREEN, 'tang→torque')}
  ${arrow(430, 150, c.radial * sc * 0.7, 0, BLUE, 'radial')}
  ${arrow(430, 150, 22, 22, VIOLET, 'AXIAL')}
  <circle cx="430" cy="150" r="3" fill="${STEEL}"/>
  <text x="430" y="250" fill="${VIOLET}" font-size="11" text-anchor="middle">axial = F·sin ψ ≈ ${c.axial.toFixed(0)} N (NUEVO)</text>`;
}

// ── Panel 2: LA CLAVE — barril SIMÉTRICO cancela el axial; cono simple no ──
function cancelPanel(): string {
  const ax = 150, bx = 410, cy = 165, R = 60;
  return `
  <text x="40" y="26" fill="${GOLD}" font-size="14" font-weight="bold">la clave: barril SIMÉTRICO cancela el axial</text>
  <!-- barril simétrico: dos conos espejo (forma de X / barril) -->
  <path d="M${ax - 40},${cy - R} L${ax + 40},${cy} L${ax - 40},${cy + R}" fill="none" stroke="${GOLD}" stroke-width="2"/>
  <path d="M${ax + 40},${cy - R} L${ax - 40},${cy} L${ax + 40},${cy + R}" fill="none" stroke="${GOLD}" stroke-width="2"/>
  <line x1="${ax}" y1="${cy - 18}" x2="${ax}" y2="${cy - 52}" stroke="${VIOLET}" stroke-width="3" marker-end="url(#ar)"/>
  <line x1="${ax}" y1="${cy + 18}" x2="${ax}" y2="${cy + 52}" stroke="${VIOLET}" stroke-width="3" marker-end="url(#ar)"/>
  <text x="${ax}" y="${cy + R + 26}" fill="${GREEN}" font-size="12" text-anchor="middle">↑+↓ = 0 NETO ✓</text>
  <text x="${ax}" y="${cy + R + 44}" fill="${STEEL}" font-size="11" text-anchor="middle">barril (trompo simétrico)</text>
  <!-- cono simple: un solo sentido -->
  <path d="M${bx - 40},${cy - R} L${bx + 40},${cy} L${bx - 40},${cy + R}" fill="none" stroke="${GOLD}" stroke-width="2"/>
  <line x1="${bx}" y1="${cy}" x2="${bx}" y2="${cy - 56}" stroke="${RED}" stroke-width="4" marker-end="url(#ar)"/>
  <text x="${bx}" y="${cy + R + 26}" fill="${RED}" font-size="12" text-anchor="middle">empuje NETO ≠ 0</text>
  <text x="${bx}" y="${cy + R + 44}" fill="${STEEL}" font-size="11" text-anchor="middle">cono simple (lo evitas)</text>`;
}

// ── Panel 3: el TORQUE casi no cambia con ψ (cos ψ) ──
function torquePanel(): string {
  const x0 = 70, y0 = 230, W = 460, H = 150;
  let curve = '';
  for (let i = 0; i <= 100; i++) { const psi = (40 * i) / 100; const ret = torqueRetention(psi); const X = x0 + W * (i / 100); const Y = y0 - ret * H; curve += `${i ? 'L' : 'M'}${X.toFixed(1)},${Y.toFixed(1)} `; }
  const mark = (psi: number, col: string) => { const X = x0 + W * (psi / 40), Y = y0 - torqueRetention(psi) * H; return `<circle cx="${X}" cy="${Y}" r="5" fill="${col}"/><text x="${X}" y="${Y - 10}" fill="${col}" font-size="11" text-anchor="middle">ψ=${psi}° → ${(torqueRetention(psi) * 100).toFixed(0)}%</text>`; };
  return `
  <text x="40" y="26" fill="${GOLD}" font-size="14" font-weight="bold">el TORQUE casi no cambia: sigue tang×R</text>
  <line x1="${x0}" y1="${y0}" x2="${x0 + W}" y2="${y0}" stroke="${STEEL}44"/>
  <line x1="${x0}" y1="${y0 - H}" x2="${x0 + W}" y2="${y0 - H}" stroke="${GREEN}33" stroke-dasharray="4 4"/>
  <text x="${x0 + W}" y="${y0 - H - 4}" fill="${GREEN}" font-size="10" text-anchor="end">100% (plano)</text>
  <path d="${curve}" fill="none" stroke="${GOLD}" stroke-width="2.5"/>
  ${mark(15, GREEN)} ${mark(30, BLUE)}
  <text x="${x0 + W}" y="${y0 + 18}" fill="${STEEL}" font-size="11" text-anchor="end">inclinación del diente ψ →</text>
  <text x="40" y="${y0 + 38}" fill="${STEEL}" font-size="11">retención = cos ψ: a 15° pierdes 3%, a 30° pierdes 13%. La transmisión NO se complica.</text>`;
}

// ── Panel 4: escalado — masa vs tamaño (ley cúbica), 100 g marcado ──
function scalePanel(): string {
  const x0 = 70, y0 = 250, W = 460, H = 175;
  const massMax = 360; let curve = '';
  for (let i = 0; i <= 100; i++) { const s = 0.25 + (1.15 - 0.25) * (i / 100); const m = base.massG * s * s * s; const X = x0 + W * ((s - 0.25) / 0.9); const Y = y0 - (m / massMax) * H; curve += `${i ? 'L' : 'M'}${X.toFixed(1)},${Y.toFixed(1)} `; }
  const s100 = scaleForMass(base, 100); const X100 = x0 + W * ((s100 - 0.25) / 0.9), Y100 = y0 - (100 / massMax) * H;
  const mp = minPrintable(base.params, base); const Xmin = x0 + W * ((mp.minScale - 0.25) / 0.9);
  const pr = printabilityAtScale(base.params, s100, base.massG);
  return `
  <text x="40" y="26" fill="${GOLD}" font-size="14" font-weight="bold">cualquier tamaño: éste a 100 g</text>
  <line x1="${x0}" y1="${y0}" x2="${x0 + W}" y2="${y0}" stroke="${STEEL}44"/>
  <line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0 - H - 6}" stroke="${STEEL}44"/>
  <path d="${curve}" fill="none" stroke="${GOLD}" stroke-width="2.5"/>
  <rect x="${x0}" y="${y0 - H}" width="${Xmin - x0}" height="${H}" fill="${RED}10"/>
  <line x1="${Xmin}" y1="${y0}" x2="${Xmin}" y2="${y0 - H}" stroke="${RED}" stroke-width="1.5" stroke-dasharray="4 4"/>
  <text x="${Xmin + 4}" y="${y0 - H + 14}" fill="${RED}" font-size="10">< ${mp.minMassG} g: rodillo < 2·boquilla</text>
  <line x1="${X100}" y1="${y0}" x2="${X100}" y2="${Y100}" stroke="${GREEN}" stroke-width="1" stroke-dasharray="3 3"/>
  <circle cx="${X100}" cy="${Y100}" r="6" fill="${GREEN}"/>
  <text x="${X100 + 8}" y="${Y100 - 6}" fill="${GREEN}" font-size="12">100 g → R=${pr ? (40 * s100).toFixed(0) : ''} mm, ${pr.envMmDia} mm⌀</text>
  <text x="${x0 + W}" y="${y0 + 18}" fill="${STEEL}" font-size="11" text-anchor="end">tamaño (escala) →</text>
  <text x="40" y="${y0 + 38}" fill="${STEEL}" font-size="11">la macro escala ∝ R³; holguras de impresión (gap 0.6, boquilla 0.4) FIJAS → ajustan voladizos</text>`;
}

const svg = (w: number, h: number, inner: string) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="ar" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="context-stroke"/></marker></defs><rect width="${w}" height="${h}" fill="${INK}"/>${inner}</svg>`;
const html = `<!doctype html><html><head><meta charset="utf8"><style>body{margin:0;background:${INK};font-family:system-ui;color:${STEEL}}h1{color:${GOLD};text-align:center;padding:16px 0 4px;font-size:21px}.sub{text-align:center;font-size:13px;padding-bottom:10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px}.card{background:#121a22;border:1px solid ${GOLD}33;border-radius:10px;padding:8px}</style></head>
<body><h1>Trompo: dientes 3D — ¿axial y radial? + cualquier tamaño</h1>
<div class="sub">La curva 3D mete axial, PERO simétrica (barril) lo cancela → torque sigue tang×R (no se complica). Y escala a 100 g.</div>
<div class="grid">
<div class="card">${svg(580, 270, decompPanel())}</div>
<div class="card">${svg(580, 270, cancelPanel())}</div>
<div class="card">${svg(580, 290, torquePanel())}</div>
<div class="card">${svg(580, 310, scalePanel())}</div>
</div></body></html>`;
fs.writeFileSync(`${DIR}/trompo.html`, html);
console.log('VIZ ok → ' + DIR + '/trompo.html');
