/* MODELOS 3D (isométrico) — la geometría cicloidal REAL de cada campeón, extruida y en perspectiva,
   para VERLA como modelo imprimible. node puro (resvg, sin GPU). → forja-shots/evo/overnight/modelos3d.png */
import * as fs from 'fs';
import { Resvg } from '@resvg/resvg-js';
import { cycloidalDisc, pinPositions } from '../src/forja/mech/cycloidal';

const OUT = '/home/ian/Orkesta/la-forja/forja-shots/evo/overnight';
let parsed: any; for (let i = 0; i < 6; i++) { try { parsed = JSON.parse(fs.readFileSync(`${OUT}/hall.json`, 'utf8')); break; } catch { } }
const hall = parsed?.hall ?? {}, roundN = parsed?.round ?? 0;

const INK = '#0d1218', PANEL = '#10171e', GOLD = '#d8a657', GOLDT = '#e8bd77', GOLDD = '#7a5a24',
  STEEL = '#9fb3c8', STEELT = '#c2d2e4', STEELD = '#566273', GREEN = '#7ee081', RED = '#e06c6c',
  VIOLET = '#b58cf0', BORE = '#070a0e';

const PICKS = [
  { id: 'hombro|balance|sf1.5', tag: 'HOMBRO', sub: 'balance' },
  { id: 'codo|balance|sf1.5', tag: 'CODO', sub: 'balance' },
  { id: 'muñeca|balance|sf1.5', tag: 'MUÑECA', sub: 'balance' },
  { id: 'hombro|eficiencia|sf1.5', tag: 'HOMBRO', sub: 'eficiencia' },
  { id: 'hombro|precisión|sf1.5', tag: 'HOMBRO', sub: 'precisión' },
  { id: 'hombro|compacto|sf1.5', tag: 'HOMBRO', sub: 'compacto' },
].map((p) => ({ ...p, hof: hall[p.id] })).filter((p) => p.hof);

// ── proyección isométrica (disco en plano XY, z = altura del apilado, +z hacia arriba) ──
const A = Math.PI / 6, ca = Math.cos(A), sa = Math.sin(A);
const isoX = (x: number, y: number) => (x - y) * ca;
const isoY = (x: number, y: number, z: number) => (x + y) * sa - z;

function model(cx: number, cy: number, p: typeof PICKS[number]) {
  const g = p.hof.best, m = p.hof.metrics;
  const pins = g.lobes + 1, Rr = g.RrFac * g.R, E = g.Efac * (g.R / (2 * pins));
  const disc = cycloidalDisc({ lobes: g.lobes, R: g.R, Rr, E, segments: 220 });
  const shaftR = g.R * g.shaftFac, wall = 3;
  const stack = Math.min(g.N * g.t + (g.N - 1) * g.gap, 30);  // alto del apilado (cap visual)
  const extent = g.R + Rr + wall;
  const s = 120 / extent;                       // px por mm
  const ox = cx, oy = cy + 6;
  // helper: punto mundo (x,y,z) → pantalla
  const P = (x: number, y: number, z: number): [number, number] => [ox + isoX(x, y) * s, oy + isoY(x, y, z) * s];

  let svg = '';
  // ── piso/cuna de la hembra: elipse inferior del vaso ──
  const ringR = g.R + Rr + wall;
  const ell = (cxp: number, cyp: number, rx: number, ry: number, fill: string, stroke: string, sw = 1) =>
    `<ellipse cx="${cxp.toFixed(1)}" cy="${cyp.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  const erx = ringR * s * (ca * Math.SQRT2), ery = ringR * s * (sa * Math.SQRT2);
  const [bx, by] = P(0, 0, 0), [tx, ty] = P(0, 0, stack);
  // pared del vaso (banda entre elipse inferior y superior) — translúcida para ver dentro
  svg += `<path d="M${(bx - erx).toFixed(1)},${by.toFixed(1)} A${erx.toFixed(1)} ${ery.toFixed(1)} 0 0 0 ${(bx + erx).toFixed(1)},${by.toFixed(1)} L${(tx + erx).toFixed(1)},${ty.toFixed(1)} A${erx.toFixed(1)} ${ery.toFixed(1)} 0 0 1 ${(tx - erx).toFixed(1)},${ty.toFixed(1)} Z" fill="${STEELD}33" stroke="${STEELD}" stroke-width="1"/>`;
  svg += ell(bx, by, erx, ery, 'none', STEELD, 1);             // elipse inferior

  // ── rodillos (cilindros verticales) = pista de la hembra, pins = lobes+1 ──
  const rollers = pinPositions(g.R, pins);
  // ordenar por profundidad (x+y menor = atrás) para painter
  const rsorted = rollers.map((r: any) => ({ r, d: r.x + r.y })).sort((a, b) => a.d - b.d);
  const rrx = Rr * s * (ca * Math.SQRT2), rry = Rr * s * (sa * Math.SQRT2);
  for (const { r } of rsorted) {
    const [rbx, rby] = P(r.x, r.y, 0), [rtx, rty] = P(r.x, r.y, stack);
    svg += `<path d="M${(rbx - rrx).toFixed(1)},${rby.toFixed(1)} L${(rtx - rrx).toFixed(1)},${rty.toFixed(1)} A${rrx.toFixed(1)} ${rry.toFixed(1)} 0 0 0 ${(rtx + rrx).toFixed(1)},${rty.toFixed(1)} L${(rbx + rrx).toFixed(1)},${rby.toFixed(1)} A${rrx.toFixed(1)} ${rry.toFixed(1)} 0 0 1 ${(rbx - rrx).toFixed(1)},${rby.toFixed(1)} Z" fill="${STEEL}" stroke="${STEELD}" stroke-width="0.8"/>`;
    svg += ell(rtx, rty, rrx, rry, STEELT, STEELD, 0.8);       // tapa del rodillo
  }

  // ── el DISCO cicloidal real, extruido, en posición excéntrica (offset +E) ──
  const zTop = stack;                                          // el disco superior del apilado
  const prof = disc.profile.map((pt: any) => ({ x: pt.x + E, y: pt.y }));
  // pared lateral del disco (quads) — pintar de atrás hacia adelante por profundidad del segmento
  const segs = prof.map((pt: any, i: number) => ({ a: pt, b: prof[(i + 1) % prof.length], d: pt.x + pt.y })).sort((u, v) => u.d - v.d);
  for (const sgm of segs) {
    const [ax, ay] = P(sgm.a.x, sgm.a.y, zTop - g.t), [a2x, a2y] = P(sgm.a.x, sgm.a.y, zTop);
    const [bx2, by2] = P(sgm.b.x, sgm.b.y, zTop - g.t), [b2x, b2y] = P(sgm.b.x, sgm.b.y, zTop);
    svg += `<path d="M${ax.toFixed(1)},${ay.toFixed(1)} L${a2x.toFixed(1)},${a2y.toFixed(1)} L${b2x.toFixed(1)},${b2y.toFixed(1)} L${bx2.toFixed(1)},${by2.toFixed(1)} Z" fill="${GOLDD}" stroke="none"/>`;
  }
  // cara superior del disco
  const topFace = prof.map((pt: any, i: number) => { const [x, y] = P(pt.x, pt.y, zTop); return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ') + ' Z';
  svg += `<path d="${topFace}" fill="${GOLD}" stroke="${GOLDT}" stroke-width="1.2"/>`;

  // ── leva + barreno del eje, con cono (anillo verde) ──
  const [cxb, cyb] = P(E, 0, zTop);
  svg += ell(cxb, cyb, shaftR * s * ca * Math.SQRT2, shaftR * s * sa * Math.SQRT2, BORE, m.hasCone ? GREEN : RED, 2);
  if (m.hasCone) svg += ell(cxb, cyb, shaftR * s * ca * Math.SQRT2 * 0.6, shaftR * s * sa * Math.SQRT2 * 0.6, 'none', GREEN, 1);

  // ── etiquetas ──
  const ty2 = cy + 150;
  svg += `<text x="${cx}" y="${ty2}" fill="${GOLD}" font-size="17" font-weight="bold" text-anchor="middle">${p.tag} · ${p.sub}</text>`;
  svg += `<text x="${cx}" y="${ty2 + 21}" fill="${STEEL}" font-size="12.5" text-anchor="middle">R ${g.R.toFixed(1)} · ${g.lobes} lób (${g.lobes}:1) · ${g.N} discos · ${m.mass_g}g</text>`;
  svg += `<text x="${cx}" y="${ty2 + 39}" fill="${m.binds ? RED : GREEN}" font-size="12.5" text-anchor="middle">η ${(m.efficiency * 100).toFixed(0)}% · gap ${g.gap.toFixed(2)} · cono ${g.coneDeg.toFixed(0)}° · juego ${m.backlash_mm} · ${m.binds ? 'TRABA' : 'LIBRA'}</text>`;
  return svg;
}

const COLS = 3, CW = 430, CH = 400, MX = 26, MY = 96;
const ROWS = Math.ceil(PICKS.length / COLS), W = COLS * CW + MX * 2, H = MY + ROWS * CH + 24;
let cells = '';
PICKS.forEach((p, i) => {
  const col = i % COLS, row = Math.floor(i / COLS), x = MX + col * CW, y = MY + row * CH;
  cells += `<rect x="${x + 6}" y="${y + 6}" width="${CW - 12}" height="${CH - 12}" rx="12" fill="${PANEL}" stroke="${GOLD}22"/>`;
  cells += model(x + CW / 2, y + CH / 2 - 60, p);
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${INK}"/>
  <text x="${W / 2}" y="40" fill="${GOLD}" font-size="25" font-weight="bold" text-anchor="middle" font-family="system-ui">Los modelos cicloidales — vista 3D isométrica (geometría REAL)</text>
  <text x="${W / 2}" y="66" fill="${STEEL}" font-size="14" text-anchor="middle" font-family="system-ui">ronda ${roundN} · disco lobulado extruido (oro) dentro del anillo de rodillos (acero) · leva con cono (verde)</text>
  <g font-family="system-ui">${cells}</g>
</svg>`;
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: W }, font: { loadSystemFonts: true } });
fs.writeFileSync(`${OUT}/modelos3d.png`, resvg.render().asPng());
console.log(`modelos3d → ${OUT}/modelos3d.png (${PICKS.length} modelos, ronda ${roundN})`);
