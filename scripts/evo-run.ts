/* EVOLUCIÓN del cicloidal — le deja el trabajo al cómputo.
   node --import tsx scripts/evo-run.ts  → reporte + forja-shots/evo/dashboard.png
   El fitness son las fórmulas derivadas a mano (fusión, runout, película λ, T_cap). */
import * as fs from 'fs';
import { Resvg } from '@resvg/resvg-js';
import {
  evolve, evaluate, verifyChampion, paretoFront, TODAYS_FAILED, DEFAULT_PROBLEM, type Genome, type Evaluation,
} from '../src/forja/mech/evolucion';

const OUT = '/home/ian/Orkesta/la-forja/forja-shots/evo';
fs.mkdirSync(OUT, { recursive: true });

const INK = '#0d1218', PANEL = '#121a22', GOLD = '#d8a657', STEEL = '#9fb3c8', GREEN = '#7ee081',
  RED = '#e06c6c', BLUE = '#6fb6c9', VIOLET = '#b58cf0', DIM = '#5a6576';

// ── Correr la evolución (varias semillas, quedarse con el mejor) ──
const SEEDS = [3, 7, 11, 19, 23];
let champ = evolve(DEFAULT_PROBLEM, { seed: SEEDS[0], pop: 160, gens: 240 });
for (const s of SEEDS.slice(1)) {
  const r = evolve(DEFAULT_PROBLEM, { seed: s, pop: 160, gens: 240 });
  if (r.bestEval.fitness > champ.bestEval.fitness) champ = r;
}
const g = champ.best, e = champ.bestEval, m = e.metrics;
const today = evaluate(TODAYS_FAILED);
const verify = verifyChampion(g);
const front = paretoFront(champ.population).sort((a, b) => b.e.metrics.efficiency - a.e.metrics.efficiency).slice(0, 14);

// ── Reporte de consola ──
const L = (s: string) => console.log(s);
L('\n══════════ EVOLUCIÓN DEL CICLOIDAL — el cómputo encontró el diseño ══════════');
L(`generaciones: 240 · población: 160 · semillas: ${SEEDS.join(',')} · fitness = física derivada a mano\n`);
L('CAMPEÓN (genoma):');
L(`  R=${g.R.toFixed(1)}mm  lóbulos=${g.lobes} (reducción ${g.lobes}:1)  discos=${g.N}  espesor=${g.t.toFixed(1)}mm`);
L(`  Rr/R=${g.RrFac.toFixed(3)}  E=${(g.Efac).toFixed(2)}·límite  gap=${g.gap.toFixed(2)}mm  cono=${g.coneDeg.toFixed(0)}°  eje/R=${g.shaftFac.toFixed(2)}  costillas=${g.ribs ? 'sí' : 'no'}  tilt=${g.tiltDeg.toFixed(0)}°`);
L('\nMÉTRICAS (juzgadas por las fórmulas de hoy):');
L(`  capacidad  T=${m.Tcap_Nm} N·m  (×${m.torqueMargin} del objetivo 8.5)`);
L(`  MOVIMIENTO  cono=${m.hasCone ? 'SÍ' : 'NO'}  runout=${m.runout_mm}mm  margen=${m.bindMargin_mm}mm  ${m.binds ? 'SE TRABA ✗' : 'LIBRA ✓'}`);
L(`  FUSIÓN  SF=${m.fusionSF}  ${m.fuses ? 'SE FUNDE ✗' : 'separa ✓'}  (gap efectivo ${(g.gap - 0.24).toFixed(2)}mm)`);
L(`  0 PÉRDIDAS  λ=${m.lambda} (${m.regime})  μ=${m.muContact}  η=${(m.efficiency * 100).toFixed(1)}%`);
L(`  juego (guango)=${m.backlash_mm}mm   masa=${m.mass_g}g`);
L(`\nVERIFICACIÓN con malla REAL (ensamble, no el proxy): peor holgura=${verify.realWorstMesh_mm}mm  choca=${verify.collides}  proxy concuerda=${verify.proxyAgrees}`);
L(`\nCONTRA EL DISEÑO DE HOY (sin cono, gap 0.55):  fitness hoy=${today.fitness}  vs  campeón=${e.fitness}`);
L(`  hoy: ${today.metrics.binds ? 'se traba' : 'libra'} · ${today.metrics.fuses ? 'se funde' : 'separa'} · runout ${today.metrics.runout_mm}mm`);
L('═════════════════════════════════════════════════════════════════════════════\n');

// ── Dashboard SVG → PNG ──
const W = 1600, H = 1120;
function panel(x: number, y: number, w: number, h: number, title: string, body: string) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${PANEL}" stroke="${GOLD}33"/>
  <text x="${x + 18}" y="${y + 30}" fill="${GOLD}" font-size="17" font-weight="bold">${title}</text>${body}`;
}
// Panel 1: convergencia
function convergence(x: number, y: number, w: number, h: number) {
  const hist = champ.history; const px = x + 50, pw = w - 70, py = y + 50, ph = h - 90;
  const fits = hist.map((d) => d.best).concat(hist.map((d) => d.mean));
  const lo = Math.min(...fits), hi = Math.max(...fits);
  const sx = (i: number) => px + (i / (hist.length - 1)) * pw;
  const sy = (v: number) => py + ph - ((v - lo) / (hi - lo || 1)) * ph;
  const line = (key: 'best' | 'mean', col: string) => `<polyline fill="none" stroke="${col}" stroke-width="2.5" points="${hist.map((d, i) => `${sx(i).toFixed(1)},${sy(d[key]).toFixed(1)}`).join(' ')}"/>`;
  const zeroY = lo < 0 && hi > 0 ? sy(0) : null;
  return panel(x, y, w, h, 'Convergencia — el fitness sube generación a generación', `
    ${zeroY ? `<line x1="${px}" y1="${zeroY.toFixed(1)}" x2="${px + pw}" y2="${zeroY.toFixed(1)}" stroke="${DIM}" stroke-dasharray="4 4"/><text x="${px + pw - 60}" y="${(zeroY - 5).toFixed(1)}" fill="${DIM}" font-size="11">factible→</text>` : ''}
    ${line('mean', BLUE)} ${line('best', GREEN)}
    <circle cx="${sx(hist.length - 1).toFixed(1)}" cy="${sy(hist[hist.length - 1].best).toFixed(1)}" r="4" fill="${GREEN}"/>
    <text x="${px}" y="${y + h - 14}" fill="${GREEN}" font-size="12">— mejor</text>
    <text x="${px + 70}" y="${y + h - 14}" fill="${BLUE}" font-size="12">— promedio</text>
    <text x="${px + 180}" y="${y + h - 14}" fill="${STEEL}" font-size="12">${hist.length} generaciones · final ${hist[hist.length - 1].best.toFixed(3)}</text>`);
}
// Panel 2: el campeón (genoma + métricas)
function champion(x: number, y: number, w: number, h: number) {
  const rows: [string, string, string][] = [
    ['R · lóbulos · discos', `${g.R.toFixed(1)}mm · ${g.lobes} · ${g.N}`, STEEL],
    ['gap (modelo)', `${g.gap.toFixed(2)}mm  →  SF fusión ${m.fusionSF}`, m.fuses ? RED : GREEN],
    ['cono autocentrado', `${g.coneDeg.toFixed(0)}°  →  runout ${m.runout_mm}mm`, m.hasCone ? GREEN : RED],
    ['movimiento', m.binds ? 'SE TRABA' : `LIBRA (margen ${m.bindMargin_mm}mm)`, m.binds ? RED : GREEN],
    ['0 pérdidas (η)', `${(m.efficiency * 100).toFixed(1)}%  ·  λ=${m.lambda} ${m.regime}`, GREEN],
    ['juego / guango', `${m.backlash_mm}mm`, GOLD],
    ['capacidad', `${m.Tcap_Nm} N·m  (×${m.torqueMargin})`, GREEN],
    ['masa · costillas', `${m.mass_g}g · ${g.ribs ? 'sí' : 'no'}`, STEEL],
  ];
  const body = rows.map((r, i) => { const yy = y + 64 + i * 34; return `
    <text x="${x + 20}" y="${yy}" fill="${DIM}" font-size="14">${r[0]}</text>
    <text x="${x + w - 20}" y="${yy}" fill="${r[2]}" font-size="14" text-anchor="end" font-weight="bold">${r[1]}</text>
    <line x1="${x + 20}" y1="${yy + 12}" x2="${x + w - 20}" y2="${yy + 12}" stroke="${GOLD}14"/>`; }).join('');
  return panel(x, y, w, h, 'Campeón — lo que el cómputo eligió', body);
}
// Panel 3: hoy vs evolucionado
function compare(x: number, y: number, w: number, h: number) {
  const cols = [['', x + 20], ['HOY (falló)', x + w * 0.5], ['EVOLUCIONADO', x + w - 20]] as [string, number][];
  const head = cols.map((c, i) => `<text x="${c[1]}" y="${y + 58}" fill="${i === 1 ? RED : i === 2 ? GREEN : DIM}" font-size="13" font-weight="bold" text-anchor="${i === 0 ? 'start' : i === 1 ? 'middle' : 'end'}">${c[0]}</text>`).join('');
  const rows: [string, string, string][] = [
    ['cono', today.metrics.hasCone ? 'sí' : 'no', m.hasCone ? `${g.coneDeg.toFixed(0)}°` : 'no'],
    ['runout', `${today.metrics.runout_mm}mm`, `${m.runout_mm}mm`],
    ['gap', `${TODAYS_FAILED.gap}mm`, `${g.gap.toFixed(2)}mm`],
    ['fusión', today.metrics.fuses ? 'se funde' : 'ok', m.fuses ? 'se funde' : `SF ${m.fusionSF}`],
    ['movimiento', today.metrics.binds ? 'SE TRABA' : 'libra', m.binds ? 'traba' : 'LIBRA'],
    ['η', `${(today.metrics.efficiency * 100).toFixed(0)}%`, `${(m.efficiency * 100).toFixed(0)}%`],
    ['fitness', `${today.fitness}`, `${e.fitness}`],
  ];
  const body = head + rows.map((r, i) => { const yy = y + 88 + i * 30; return `
    <text x="${x + 20}" y="${yy}" fill="${DIM}" font-size="13">${r[0]}</text>
    <text x="${x + w * 0.5}" y="${yy}" fill="${RED}" font-size="13" text-anchor="middle">${r[1]}</text>
    <text x="${x + w - 20}" y="${yy}" fill="${GREEN}" font-size="13" text-anchor="end" font-weight="bold">${r[2]}</text>`; }).join('');
  return panel(x, y, w, h, 'Hoy vs evolucionado', body);
}
// Panel 4: frente de Pareto (η vs juego, tamaño = masa)
function pareto(x: number, y: number, w: number, h: number) {
  const px = x + 55, pw = w - 80, py = y + 50, ph = h - 95;
  const effs = front.map((p) => p.e.metrics.efficiency), backs = front.map((p) => p.e.metrics.backlash_mm);
  const eLo = Math.min(...effs), eHi = Math.max(...effs, eLo + 0.001);
  const bLo = Math.min(...backs), bHi = Math.max(...backs, bLo + 0.01);
  const sx = (b: number) => px + ((b - bLo) / (bHi - bLo)) * pw;        // x = juego (menos = mejor, izq)
  const sy = (eff: number) => py + ph - ((eff - eLo) / (eHi - eLo)) * ph; // y = η (más = mejor, arriba)
  const dots = front.map((p) => { const mm = p.e.metrics; const r = 4 + (mm.mass_g / 300) * 8; const isChamp = p.g === g;
    return `<circle cx="${sx(mm.backlash_mm).toFixed(1)}" cy="${sy(mm.efficiency).toFixed(1)}" r="${r.toFixed(1)}" fill="${isChamp ? GOLD : VIOLET}99" stroke="${isChamp ? GOLD : VIOLET}"/>`; }).join('');
  return panel(x, y, w, h, 'Frente de Pareto — η↑ vs juego↓ (tamaño = masa)', `
    <text x="${px - 8}" y="${py + 8}" fill="${DIM}" font-size="11" text-anchor="end">η↑</text>
    <text x="${px + pw}" y="${py + ph + 26}" fill="${DIM}" font-size="11" text-anchor="end">juego→ (mm)</text>
    <line x1="${px}" y1="${py}" x2="${px}" y2="${py + ph}" stroke="${DIM}55"/>
    <line x1="${px}" y1="${py + ph}" x2="${px + pw}" y2="${py + ph}" stroke="${DIM}55"/>
    ${dots}
    <text x="${px}" y="${y + h - 12}" fill="${GOLD}" font-size="12">● campeón</text>
    <text x="${px + 90}" y="${y + h - 12}" fill="${VIOLET}" font-size="12">● no-dominados (${front.length})</text>`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${INK}"/>
  <text x="${W / 2}" y="42" fill="${GOLD}" font-size="26" font-weight="bold" text-anchor="middle" font-family="system-ui">Evolución del cicloidal — el cómputo buscó el diseño óptimo</text>
  <text x="${W / 2}" y="68" fill="${STEEL}" font-size="14" text-anchor="middle" font-family="system-ui">0 pérdidas · movimiento completo · sin fusión · compacto — juzgado por las fórmulas derivadas a mano</text>
  <g font-family="system-ui">
    ${convergence(40, 90, 760, 440)}
    ${champion(820, 90, 740, 440)}
    ${compare(40, 550, 500, 530)}
    ${pareto(560, 550, 1000, 530)}
  </g>
</svg>`;

const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1600 }, font: { loadSystemFonts: true } });
fs.writeFileSync(`${OUT}/dashboard.png`, resvg.render().asPng());
fs.writeFileSync(`${OUT}/champion.json`, JSON.stringify({ genome: g, metrics: m, fitness: e.fitness, verify, today: { genome: TODAYS_FAILED, metrics: today.metrics, fitness: today.fitness } }, null, 2));
L(`PNG → ${OUT}/dashboard.png\nJSON → ${OUT}/champion.json\n`);
