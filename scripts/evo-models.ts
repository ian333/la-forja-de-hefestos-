/* VER LOS MODELOS — dibuja la GEOMETRÍA REAL de cada campeón que la evolución terminó.
   Lee hall.json y renderiza el perfil cicloidal verdadero (cycloidalDisc) + rodillos + leva +
   excéntrica + cono. node puro (resvg, sin GPU). → forja-shots/evo/overnight/modelos.png */
import * as fs from 'fs';
import { Resvg } from '@resvg/resvg-js';
import { cycloidalDisc, pinPositions } from '../src/forja/mech/cycloidal';

const OUT = '/home/ian/Orkesta/la-forja/forja-shots/evo/overnight';
const hallPath = `${OUT}/hall.json`;
let parsed: any; for (let i = 0; i < 5; i++) { try { parsed = JSON.parse(fs.readFileSync(hallPath, 'utf8')); break; } catch { } }
const hall = parsed?.hall ?? {}; const roundN = parsed?.round ?? 0;

const INK = '#0d1218', PANEL = '#121a22', GOLD = '#d8a657', GOLDD = '#9c7430', STEEL = '#9fb3c8',
  STEELD = '#5a6576', GREEN = '#7ee081', RED = '#e06c6c', BLUE = '#6fb6c9', VIOLET = '#b58cf0', BORE = '#0a0e13';

// Los modelos a mostrar: las 3 juntas (catálogo) + las 4 prioridades del hombro
const PICKS = [
  { id: 'hombro|balance|sf1.5', tag: 'HOMBRO', sub: 'balance' },
  { id: 'codo|balance|sf1.5', tag: 'CODO', sub: 'balance' },
  { id: 'muñeca|balance|sf1.5', tag: 'MUÑECA', sub: 'balance' },
  { id: 'hombro|eficiencia|sf1.5', tag: 'HOMBRO', sub: 'eficiencia' },
  { id: 'hombro|precisión|sf1.5', tag: 'HOMBRO', sub: 'precisión' },
  { id: 'hombro|compacto|sf1.5', tag: 'HOMBRO', sub: 'compacto' },
  { id: 'hombro|balance|sf1.3', tag: 'HOMBRO', sub: 'fusión SF1.3' },
  { id: 'hombro|balance|sf2.0', tag: 'HOMBRO', sub: 'fusión SF2.0' },
].map((p) => ({ ...p, hof: hall[p.id] })).filter((p) => p.hof);

const COLS = 4, CW = 415, CH = 470, MX = 24, MY = 96;
const W = COLS * CW + MX * 2, ROWS = Math.ceil(PICKS.length / COLS), H = MY + ROWS * CH + 30;

// Dibuja un modelo cicloidal real dentro de una celda
function model(cx: number, cy: number, p: typeof PICKS[number]) {
  const g = p.hof.best, m = p.hof.metrics;
  const pins = g.lobes + 1, Rr = g.RrFac * g.R, E = g.Efac * (g.R / (2 * pins));
  const disc = cycloidalDisc({ lobes: g.lobes, R: g.R, Rr, E, segments: 240 });
  const rollers = pinPositions(g.R, pins);
  const shaftR = g.R * g.shaftFac;
  const extent = g.R + 2 * Rr;                 // radio a encuadrar
  const view = 150;                            // radio en px
  const s = view / extent;
  const ox = cx, oy = cy - 14;                 // centro del dibujo (deja sitio a la etiqueta)
  const PX = (x: number) => (ox + x * s).toFixed(1);
  const PY = (y: number) => (oy - y * s).toFixed(1);

  // anillo de la hembra (donde viven los rodillos)
  let svg = `<circle cx="${PX(0)}" cy="${PY(0)}" r="${((g.R + Rr) * s).toFixed(1)}" fill="none" stroke="${STEELD}" stroke-width="1.5" stroke-dasharray="3 3"/>`;
  // rodillos (pista de la hembra) — pins = lobes+1
  for (const r of rollers) svg += `<circle cx="${PX(r.x)}" cy="${PY(r.y)}" r="${(Rr * s).toFixed(1)}" fill="${STEEL}" stroke="${STEELD}" stroke-width="1"/>`;
  // el DISCO cicloidal real, en su posición excéntrica (offset E)
  const path = disc.profile.map((pt: any, i: number) => `${i ? 'L' : 'M'}${PX(pt.x + E)},${PY(pt.y)}`).join(' ') + ' Z';
  svg += `<path d="${path}" fill="${GOLD}cc" stroke="${GOLDD}" stroke-width="2"/>`;
  // leva + barreno del eje (en el centro del disco = origen + E), cono si lo hay
  svg += `<circle cx="${PX(E)}" cy="${PY(0)}" r="${(shaftR * s).toFixed(1)}" fill="${BORE}" stroke="${m.hasCone ? GREEN : RED}" stroke-width="2.5"/>`;
  if (m.hasCone) svg += `<circle cx="${PX(E)}" cy="${PY(0)}" r="${(shaftR * s * 0.62).toFixed(1)}" fill="none" stroke="${GREEN}" stroke-width="1.2" stroke-dasharray="2 2"/>`;
  // vector de excentricidad (origen → centro del disco)
  svg += `<line x1="${PX(0)}" y1="${PY(0)}" x2="${PX(E)}" y2="${PY(0)}" stroke="${VIOLET}" stroke-width="1.5"/><circle cx="${PX(0)}" cy="${PY(0)}" r="2.5" fill="${VIOLET}"/>`;

  // etiquetas
  const ty = cy + view + 22;
  svg += `<text x="${cx}" y="${ty}" fill="${GOLD}" font-size="17" font-weight="bold" text-anchor="middle">${p.tag} · ${p.sub}</text>`;
  const line1 = `R ${g.R.toFixed(1)}  ·  ${g.lobes} lób (${g.lobes}:1)  ·  ${g.N} discos  ·  ${m.mass_g}g`;
  const line2 = `η ${(m.efficiency * 100).toFixed(0)}%  ·  gap ${g.gap.toFixed(2)}  ·  cono ${g.coneDeg.toFixed(0)}°  ·  juego ${m.backlash_mm}`;
  svg += `<text x="${cx}" y="${ty + 22}" fill="${STEEL}" font-size="12.5" text-anchor="middle">${line1}</text>`;
  svg += `<text x="${cx}" y="${ty + 40}" fill="${m.binds ? RED : GREEN}" font-size="12.5" text-anchor="middle">${line2}  ·  ${m.binds ? 'TRABA' : 'LIBRA'}</text>`;
  return svg;
}

let cells = '';
PICKS.forEach((p, i) => {
  const col = i % COLS, row = Math.floor(i / COLS);
  const x = MX + col * CW, y = MY + row * CH;
  cells += `<rect x="${x + 6}" y="${y + 6}" width="${CW - 12}" height="${CH - 12}" rx="12" fill="${PANEL}" stroke="${GOLD}22"/>`;
  cells += model(x + CW / 2, y + CH / 2 - 24, p);
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${INK}"/>
  <text x="${W / 2}" y="40" fill="${GOLD}" font-size="25" font-weight="bold" text-anchor="middle" font-family="system-ui">Los modelos que la evolución terminó — geometría cicloidal REAL</text>
  <text x="${W / 2}" y="66" fill="${STEEL}" font-size="14" text-anchor="middle" font-family="system-ui">ronda ${roundN} · disco lobulado (epitrocoide) + rodillos + leva + excéntrica · verde=cono autocentrado, morado=excentricidad</text>
  <g font-family="system-ui">${cells}</g>
</svg>`;

const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: W }, font: { loadSystemFonts: true } });
fs.writeFileSync(`${OUT}/modelos.png`, resvg.render().asPng());
console.log(`modelos → ${OUT}/modelos.png  (${PICKS.length} modelos, ronda ${roundN})`);
