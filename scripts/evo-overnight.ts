/* EVOLUCIÓN NOCTURNA — déjalo toda la noche. Barre configuraciones (juntas × prioridades ×
   fusión), evoluciona profundo cada una, mantiene un salón de la fama RESUMIBLE y refresca el
   catálogo + dashboard cada ronda. El fitness son las fórmulas derivadas a mano.
   Lanzar detached:  nohup tsx scripts/evo-overnight.ts > forja-shots/evo/overnight/run.log 2>&1 &
*/
import * as fs from 'fs';
import { Resvg } from '@resvg/resvg-js';
import {
  evolve, evaluate, verifyChampion, paretoFront, TODAYS_FAILED, DEFAULT_WEIGHTS,
  type Problem, type Genome, type Evaluation, type Weights, type GAResult,
} from '../src/forja/mech/evolucion';

const OUT = '/home/ian/Orkesta/la-forja/forja-shots/evo/overnight';
fs.mkdirSync(OUT, { recursive: true });

// ── Las configuraciones a barrer (variedad: el cómputo nunca ocioso) ──
const JOINTS = [{ k: 'hombro', T: 8.5 }, { k: 'codo', T: 4.7 }, { k: 'muñeca', T: 1.9 }];
const PRIOS: { k: string; w: Weights }[] = [
  { k: 'balance', w: DEFAULT_WEIGHTS },
  { k: 'eficiencia', w: { eff: 0.60, prec: 0.20, compact: 0.10, margin: 0.10 } },
  { k: 'precisión', w: { eff: 0.20, prec: 0.60, compact: 0.10, margin: 0.10 } },
  { k: 'compacto', w: { eff: 0.20, prec: 0.20, compact: 0.50, margin: 0.10 } },
];
interface Config { id: string; joint: string; prio: string; prob: Problem }
const CONFIGS: Config[] = [];
// 3 juntas × 4 prioridades (SF 1.5, 100 g)
for (const j of JOINTS) for (const p of PRIOS)
  CONFIGS.push({ id: `${j.k}|${p.k}|sf1.5`, joint: j.k, prio: p.k, prob: { torqueTarget_Nm: j.T, rpmIn: 200, fusionTargetSF: 1.5, targetMass_g: 100, muOil_PaS: 0.1, weights: p.w } });
// barrido de fusión sobre el hombro/balance
for (const sf of [1.3, 2.0])
  CONFIGS.push({ id: `hombro|balance|sf${sf}`, joint: 'hombro', prio: `balance·SF${sf}`, prob: { torqueTarget_Nm: 8.5, rpmIn: 200, fusionTargetSF: sf, targetMass_g: 100, muOil_PaS: 0.1, weights: DEFAULT_WEIGHTS } });

const HEADLINE = 'hombro|balance|sf1.5';

// ── Salón de la fama (resumible) ──
interface Hof { id: string; joint: string; prio: string; prob: Problem; best: Genome; fitness: number; metrics: Evaluation['metrics']; rounds: number; history?: GAResult['history'] }
const hallPath = `${OUT}/hall.json`;
const hall: Record<string, Hof> = fs.existsSync(hallPath) ? JSON.parse(fs.readFileSync(hallPath, 'utf8')).hall ?? {} : {};
let round = fs.existsSync(hallPath) ? (JSON.parse(fs.readFileSync(hallPath, 'utf8')).round ?? 0) : 0;
let headlineRes: GAResult | null = null;

function hashId(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const log = (s: string) => { const line = `[${new Date().toISOString()}] ${s}`; console.log(line); fs.appendFileSync(`${OUT}/progress.log`, line + '\n'); };

// ── El bucle nocturno ──
const MAX_ROUNDS = Number(process.env.EVO_ROUNDS ?? 200);   // tope alto; se mata en la mañana
const POP = Number(process.env.EVO_POP ?? 240), GENS = Number(process.env.EVO_GENS ?? 1500);
log(`=== EVOLUCIÓN NOCTURNA arranca (round ${round}) · ${CONFIGS.length} configs · pop ${POP} gens ${GENS} ===`);

for (; round < MAX_ROUNDS; round++) {
  const t0 = Date.now();
  for (const cfg of CONFIGS) {
    try {
      const seed = (hashId(cfg.id) + round * 7919) % 2147483647;
      const res = evolve(cfg.prob, { seed, pop: POP, gens: GENS });
      if (cfg.id === HEADLINE) headlineRes = res;
      const prev = hall[cfg.id];
      if (!prev || res.bestEval.fitness > prev.fitness) {
        hall[cfg.id] = { id: cfg.id, joint: cfg.joint, prio: cfg.prio, prob: cfg.prob, best: res.best, fitness: res.bestEval.fitness, metrics: res.bestEval.metrics, rounds: (prev?.rounds ?? 0) + 1, history: res.history };
      } else { hall[cfg.id].rounds = (prev.rounds ?? 0) + 1; }
    } catch (e) { log(`  ! config ${cfg.id} falló: ${(e as Error).message}`); }
  }
  fs.writeFileSync(hallPath, JSON.stringify({ round: round + 1, updated: new Date().toISOString(), hall }, null, 2));
  try { renderDashboard(round + 1); } catch (e) { log(`  ! dashboard falló: ${(e as Error).message}`); }
  const dt = ((Date.now() - t0) / 1000).toFixed(0);
  const champ = hall[HEADLINE];
  log(`ronda ${round + 1} lista en ${dt}s · hombro/balance fitness=${champ?.fitness} η=${(champ?.metrics.efficiency ?? 0) * 100 | 0}% cono=${champ?.best.coneDeg.toFixed(0)}° gap=${champ?.best.gap.toFixed(2)} masa=${champ?.metrics.mass_g}g`);
}
log('=== fin del bucle (alcanzó MAX_ROUNDS) ===');

// ──────────────────────────────────────────────────────────────────────────
// Dashboard SVG → PNG (el catálogo de la noche)
// ──────────────────────────────────────────────────────────────────────────
function renderDashboard(roundsDone: number) {
  const INK = '#0d1218', PANEL = '#121a22', GOLD = '#d8a657', STEEL = '#9fb3c8', GREEN = '#7ee081',
    RED = '#e06c6c', BLUE = '#6fb6c9', VIOLET = '#b58cf0', DIM = '#5a6576';
  const W = 1680, H = 1180;
  const champ = hall[HEADLINE];
  const today = evaluate(TODAYS_FAILED);

  const panel = (x: number, y: number, w: number, h: number, title: string, body: string) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${PANEL}" stroke="${GOLD}33"/>
     <text x="${x + 18}" y="${y + 30}" fill="${GOLD}" font-size="17" font-weight="bold">${title}</text>${body}`;

  // Panel 1 — convergencia del headline (última ronda)
  let p1 = '';
  if (headlineRes) {
    const hist = headlineRes.history, x = 40, y = 92, w = 770, h = 430;
    const px = x + 50, pw = w - 70, py = y + 50, ph = h - 95;
    const vals = hist.map((d) => d.best).concat(hist.map((d) => d.mean));
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const sx = (i: number) => px + (i / (hist.length - 1)) * pw;
    const sy = (v: number) => py + ph - ((v - lo) / (hi - lo || 1)) * ph;
    const ln = (key: 'best' | 'mean', col: string) => `<polyline fill="none" stroke="${col}" stroke-width="2.2" points="${hist.map((d, i) => `${sx(i).toFixed(1)},${sy(d[key]).toFixed(1)}`).join(' ')}"/>`;
    const zeroY = lo < 0 && hi > 0 ? sy(0) : null;
    p1 = panel(x, y, w, h, `Convergencia — ${HEADLINE} (última ronda, ${hist.length} gen)`, `
      ${zeroY ? `<line x1="${px}" y1="${zeroY.toFixed(1)}" x2="${px + pw}" y2="${zeroY.toFixed(1)}" stroke="${DIM}" stroke-dasharray="4 4"/><text x="${px + pw - 56}" y="${(zeroY - 5).toFixed(1)}" fill="${DIM}" font-size="11">factible→</text>` : ''}
      ${ln('mean', BLUE)} ${ln('best', GREEN)}
      <text x="${px}" y="${y + h - 14}" fill="${GREEN}" font-size="12">— mejor</text>
      <text x="${px + 70}" y="${y + h - 14}" fill="${BLUE}" font-size="12">— promedio</text>
      <text x="${px + 190}" y="${y + h - 14}" fill="${STEEL}" font-size="12">final ${hist[hist.length - 1].best.toFixed(3)}</text>`);
  }

  // Panel 2 — campeón headline
  let p2 = '';
  if (champ) {
    const g = champ.best, m = champ.metrics, x = 830, y = 92, w = 810, h = 430;
    const rows: [string, string, string][] = [
      ['R · lóbulos · discos', `${g.R.toFixed(1)}mm · ${g.lobes} · ${g.N}`, STEEL],
      ['gap → SF fusión', `${g.gap.toFixed(2)}mm → ${m.fusionSF}`, m.fuses ? RED : GREEN],
      ['cono → runout', `${g.coneDeg.toFixed(0)}° → ${m.runout_mm}mm`, m.hasCone ? GREEN : RED],
      ['movimiento', m.binds ? 'SE TRABA' : `LIBRA (${m.bindMargin_mm}mm)`, m.binds ? RED : GREEN],
      ['0 pérdidas η · λ', `${(m.efficiency * 100).toFixed(1)}% · ${m.lambda} ${m.regime}`, GREEN],
      ['juego (guango)', `${m.backlash_mm}mm`, GOLD],
      ['capacidad', `${m.Tcap_Nm} N·m (×${m.torqueMargin})`, GREEN],
      ['masa · costillas · tilt', `${m.mass_g}g · ${g.ribs ? 'sí' : 'no'} · ${g.tiltDeg.toFixed(0)}°`, STEEL],
    ];
    p2 = panel(x, y, w, h, `Campeón global — ${HEADLINE}`, rows.map((r, i) => { const yy = y + 64 + i * 42; return `
      <text x="${x + 20}" y="${yy}" fill="${DIM}" font-size="15">${r[0]}</text>
      <text x="${x + w - 20}" y="${yy}" fill="${r[2]}" font-size="15" text-anchor="end" font-weight="bold">${r[1]}</text>
      <line x1="${x + 20}" y1="${yy + 14}" x2="${x + w - 20}" y2="${yy + 14}" stroke="${GOLD}14"/>`; }).join(''));
  }

  // Panel 3 — CATÁLOGO: mejor diseño por junta (balance, SF1.5)
  const catRows = JOINTS.map((j) => hall[`${j.k}|balance|sf1.5`]).filter(Boolean);
  const x3 = 40, y3 = 545, w3 = 800, h3 = 595;
  const cols3 = ['junta', 'R', 'lób', 'disc', 'cono', 'η', 'juego', 'masa', 'fit'];
  const cw = [110, 70, 55, 55, 65, 70, 80, 80, 80];
  let cx = x3 + 20; const colX = cols3.map((_, i) => { const v = cx; cx += cw[i]; return v; });
  const head3 = cols3.map((c, i) => `<text x="${colX[i]}" y="${y3 + 60}" fill="${GOLD}" font-size="13" font-weight="bold">${c}</text>`).join('');
  const body3 = catRows.map((r, i) => { const yy = y3 + 92 + i * 40; const g = r.best, m = r.metrics;
    const cells = [r.joint, g.R.toFixed(1), `${g.lobes}`, `${g.N}`, `${g.coneDeg.toFixed(0)}°`, `${(m.efficiency * 100).toFixed(0)}%`, `${m.backlash_mm}`, `${m.mass_g}g`, `${r.fitness.toFixed(3)}`];
    return cells.map((c, ci) => `<text x="${colX[ci]}" y="${yy}" fill="${ci === 0 ? STEEL : ci === 8 ? GREEN : STEEL}" font-size="13" font-weight="${ci === 0 ? 'bold' : 'normal'}">${c}</text>`).join('') +
      `<line x1="${x3 + 20}" y1="${yy + 12}" x2="${x3 + w3 - 20}" y2="${yy + 12}" stroke="${GOLD}10"/>`; }).join('');
  // fusión sweep
  const sweep = [hall['hombro|balance|sf1.3'], hall[HEADLINE], hall['hombro|balance|sf2.0']].filter(Boolean);
  const swY = y3 + 92 + catRows.length * 40 + 30;
  const swBody = `<text x="${x3 + 20}" y="${swY}" fill="${BLUE}" font-size="13" font-weight="bold">barrido fusión (hombro):</text>` +
    sweep.map((r, i) => `<text x="${x3 + 200 + i * 200}" y="${swY}" fill="${STEEL}" font-size="12">SF${r.prob.fusionTargetSF} → gap ${r.best.gap.toFixed(2)} juego ${r.metrics.backlash_mm}</text>`).join('');
  const p3 = panel(x3, y3, w3, h3, 'Catálogo — mejor diseño por junta (balance, SF 1.5)', head3 + body3 + swBody);

  // Panel 4 — prioridades: cómo cambia el hombro según qué valoras
  const prioRows = PRIOS.map((p) => hall[`hombro|${p.k}|sf1.5`]).filter(Boolean);
  const x4 = 860, y4 = 545, w4 = 780, h4 = 595;
  const cols4 = ['prioridad', 'R', 'lób', 'disc', 'gap', 'cono', 'η', 'juego', 'masa'];
  const cw4 = [115, 65, 50, 50, 65, 60, 65, 75, 75];
  let cx4 = x4 + 20; const colX4 = cols4.map((_, i) => { const v = cx4; cx4 += cw4[i]; return v; });
  const head4 = cols4.map((c, i) => `<text x="${colX4[i]}" y="${y4 + 60}" fill="${GOLD}" font-size="13" font-weight="bold">${c}</text>`).join('');
  const body4 = prioRows.map((r, i) => { const yy = y4 + 96 + i * 46; const g = r.best, m = r.metrics;
    const cells = [r.prio, g.R.toFixed(1), `${g.lobes}`, `${g.N}`, g.gap.toFixed(2), `${g.coneDeg.toFixed(0)}°`, `${(m.efficiency * 100).toFixed(0)}%`, `${m.backlash_mm}`, `${m.mass_g}g`];
    return cells.map((c, ci) => `<text x="${colX4[ci]}" y="${yy}" fill="${ci === 0 ? VIOLET : STEEL}" font-size="13" font-weight="${ci === 0 ? 'bold' : 'normal'}">${c}</text>`).join('') +
      `<line x1="${x4 + 20}" y1="${yy + 14}" x2="${x4 + w4 - 20}" y2="${yy + 14}" stroke="${GOLD}10"/>`; }).join('');
  const note4 = `<text x="${x4 + 20}" y="${y4 + h4 - 24}" fill="${DIM}" font-size="12">misma junta (hombro 8.5 N·m); el óptimo CAMBIA según qué priorizas — eso es el frente de diseño.</text>`;
  const p4 = panel(x4, y4, w4, h4, 'Prioridades — el óptimo del hombro según qué valoras', head4 + body4 + note4);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${INK}"/>
    <text x="${W / 2}" y="40" fill="${GOLD}" font-size="26" font-weight="bold" text-anchor="middle" font-family="system-ui">Evolución nocturna del cicloidal — el cómputo busca toda la noche</text>
    <text x="${W / 2}" y="66" fill="${STEEL}" font-size="14" text-anchor="middle" font-family="system-ui">ronda ${roundsDone} · ${CONFIGS.length} configuraciones · fitness = las fórmulas derivadas a mano · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}</text>
    <g font-family="system-ui">${p1}${p2}${p3}${p4}</g>
  </svg>`;
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1680 }, font: { loadSystemFonts: true } });
  fs.writeFileSync(`${OUT}/dashboard.png`, resvg.render().asPng());
}
