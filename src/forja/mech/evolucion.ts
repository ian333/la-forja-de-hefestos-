/**
 * EVOLUCIÓN — déjale el trabajo al cómputo. Un algoritmo genético busca el cicloidal
 * ÓPTIMO (0 pérdidas, movimiento completo, sin fusión, compacto) en vez de derivarlo a mano.
 *
 * La idea elegante: TODO lo que derivamos a mano hoy se vuelve el JUEZ (fitness). La evolución
 * propone geometrías; las fórmulas reales las califican. No inventamos curvas — las fórmulas
 * verificadas (fusión, runout, película λ, capacidad T) son el tribunal.
 *
 * UN SOLO problema del puro cicloidal: dimensionar UNA junta (la peor: el hombro, 8.5 N·m)
 * que NO se funda, NO se trabe (el error de hoy), NO esté guanga, y pierda lo mínimo.
 *
 * Genoma = la geometría + decisiones de impresión. Fitness = las fórmulas de hoy.
 * Puro, testeable, determinista (PRNG sembrado). mm, N·m, g.
 */
import { cycloidalDisc } from './cycloidal';
import { cycloidalCapacity } from './brazo';
import { fusionSF, effectiveGap } from './factor-seguridad';
import { runoutOneBearing, runoutCone, worstMeshOverDirections } from './ensamble';
import { eccentricityForLoad, lambdaRatio, regime } from './cojinete-continuo';
import { lobeRoughnessAtTilt } from './print45';

// ──────────────────────────────────────────────────────────────────────────
// El GENOMA — los grados de libertad del DISEÑO (lo que la evolución mueve)
// ──────────────────────────────────────────────────────────────────────────
export interface Genome {
  R: number;        // radio del círculo de pernos (mm)
  lobes: number;    // nº de lóbulos = reducción (int)
  N: number;        // nº de discos apilados = carga (int)
  t: number;        // espesor de cada disco (mm)
  RrFac: number;    // radio del rodillo / R
  Efac: number;     // excentricidad como fracción del límite de validez (0..1)
  gap: number;      // holgura de malla del MODELO (mm)
  coneDeg: number;  // semiángulo del cono de autocentrado (0 = voladizo = el error de hoy)
  shaftFac: number; // diámetro del eje / R
  ribs: number;     // 0|1 — costillas axiales (hembra entre discos, fija el juego axial)
  tiltDeg: number;  // inclinación de impresión (0 = vertical liso, 45 = una pieza)
}
export interface GeneBound { key: keyof Genome; min: number; max: number; int?: boolean }
export const BOUNDS: GeneBound[] = [
  { key: 'R', min: 12, max: 40 },
  { key: 'lobes', min: 7, max: 16, int: true },
  { key: 'N', min: 1, max: 5, int: true },
  { key: 't', min: 3, max: 9 },
  { key: 'RrFac', min: 0.06, max: 0.14 },
  { key: 'Efac', min: 0.30, max: 0.92 },
  { key: 'gap', min: 0.30, max: 1.20 },
  { key: 'coneDeg', min: 0, max: 50 },
  { key: 'shaftFac', min: 0.18, max: 0.36 },
  { key: 'ribs', min: 0, max: 1, int: true },
  { key: 'tiltDeg', min: 0, max: 90 },
];

// ──────────────────────────────────────────────────────────────────────────
// El PROBLEMA — condiciones de operación fijas (un solo cicloidal, el peor)
// ──────────────────────────────────────────────────────────────────────────
export interface Weights { eff: number; prec: number; compact: number; margin: number }
export const DEFAULT_WEIGHTS: Weights = { eff: 0.40, prec: 0.30, compact: 0.20, margin: 0.10 };
export interface Problem {
  torqueTarget_Nm: number;  // par requerido (hombro 8.5)
  rpmIn: number;            // rpm del excéntrico (operación)
  fusionTargetSF: number;   // SF anti-fusión exigido
  targetMass_g: number;     // masa objetivo (compacidad)
  muOil_PaS: number;        // viscosidad del aceite
  weights?: Weights;        // prioridades del fitness (default = balanceado)
}
export const DEFAULT_PROBLEM: Problem = {
  torqueTarget_Nm: 8.5, rpmIn: 200, fusionTargetSF: 1.5, targetMass_g: 100, muOil_PaS: 0.1,
};

const PLA_RHO_G = 1.24e-3;     // g/mm³
const CONE_MIN_DEG = 8;        // por debajo de esto el cono no autocentra (sigue siendo voladizo)
const SHAFT_BORE_CLEAR = 0.15; // holgura de impresión del barreno del eje (mm)
const ROUGH_FLOOR = 0.02;      // rugosidad mínima del muñón impreso (mm)
const LAYER_H = 0.2;

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

// ──────────────────────────────────────────────────────────────────────────
// La EVALUACIÓN — aquí entra TODA la física derivada a mano (el tribunal)
// ──────────────────────────────────────────────────────────────────────────
export interface Metrics {
  valid: boolean;
  Tcap_Nm: number; torqueMargin: number;
  runout_mm: number; hasCone: boolean; bindMargin_mm: number; binds: boolean;
  fusionSF: number; fuses: boolean;
  lambda: number; regime: string; muContact: number; efficiency: number;
  backlash_mm: number; mass_g: number;
  stackH_mm: number; Router_mm: number;
}
export interface Evaluation { metrics: Metrics; feasible: boolean; fitness: number; penalty: number; score: number }

/** Evalúa un genoma con las fórmulas reales. Devuelve métricas + fitness escalar. */
export function evaluate(g: Genome, prob: Problem = DEFAULT_PROBLEM): Evaluation {
  const pins = g.lobes + 1;
  const Rr = g.RrFac * g.R;
  const Elimit = g.R / (2 * pins);          // E < esto para que el perfil sea válido
  const E = g.Efac * Elimit;
  const disc = cycloidalDisc({ lobes: g.lobes, R: g.R, Rr, E, segments: 120 });
  const valid = disc.valid && E > 0.05;

  // (1) CAPACIDAD — la fórmula del brazo: T ∝ N·t·R²
  const Tcap = cycloidalCapacity({ N: g.N, t: g.t, R: g.R, SF: 1 });
  const torqueMargin = Tcap / prob.torqueTarget_Nm;

  // (2) MOVIMIENTO — el error de hoy: runout del eje vs holgura. Cono vs voladizo.
  const stackH = g.N * g.t + (g.N - 1) * g.gap;
  const boreEngage = Math.max(g.t, 2 * g.R * g.shaftFac);
  const hasCone = g.coneDeg >= CONE_MIN_DEG;
  const runout = hasCone ? runoutCone(5) : runoutOneBearing(SHAFT_BORE_CLEAR, stackH, boreEngage);
  // el gap impreso (efectivo) menos el runout = margen contra el choque. <0 = SE TRABA (lo de hoy).
  const effGap = effectiveGap(g.gap);
  const bindMargin = +(effGap - runout).toFixed(4);   // holgura que le queda al runout (≤0 = choca)
  const binds = bindMargin <= 0.03;
  // GUANGO (lost motion) = juego de malla + bamboleo del eje sin centrar. "No es cerrar el gap":
  // el gap es inevitable (fusión), pero el cono MATA el 2º término (runout→0). Por eso el cono gana.
  const backlash = +(effGap + runout).toFixed(4);

  // (3) FUSIÓN — la fórmula del factor de seguridad
  const fsf = fusionSF(g.gap);
  const fuses = fsf < prob.fusionTargetSF;

  // (4) EFICIENCIA — la película continua: λ (full-film?) → fricción Stribeck → η.
  // Cálculo MAGRO (sin el barrido de holgura óptima): carga radial → ε de equilibrio → h_min → λ.
  const sigma = ROUGH_FLOOR + lobeRoughnessAtTilt(g.tiltDeg, LAYER_H); // impreso a 45° = muñón rugoso
  const Rjournal = g.R * g.shaftFac + E;             // radio del muñón (leva) = shaftD/2 + E
  const Wradial = (prob.torqueTarget_Nm / g.lobes) * 1000 / Rjournal;  // reacción del engrane (N)
  const cJournal = 0.20;                             // holgura de impresión del muñón
  const epsFilm = eccentricityForLoad({ muPaS: prob.muOil_PaS, rpm: prob.rpmIn, R_mm: Rjournal, L_mm: g.N * g.t, c_mm: cJournal, W_N: Wradial });
  const hMin = cJournal * (1 - epsFilm);
  const lam = lambdaRatio(hMin, sigma);
  const reg = regime(lam);
  // Stribeck: full-film (λ≥3) → fricción viscosa diminuta; mixto interpola; frontera → asperezas.
  const muContact = lam >= 3 ? 0.004 : lam >= 1 ? 0.004 + (0.10 - 0.004) * (3 - lam) / 2 : 0.12;
  // pérdida cicloidal de deslizamiento ~ μ·π·(1+1/ratio) (forma real; constante calibrable).
  const efficiency = clamp(1 - muContact * Math.PI * (1 + 1 / g.lobes), 0.4, 0.995);

  // (5) MASA — compacidad (la meta de 100 g)
  const wall = 4;
  const Router = g.R + Rr + wall;
  const height = stackH + 4 + (g.ribs ? 2 : 0);
  const mass = +(Math.PI * Router * Router * height * 0.7 * PLA_RHO_G).toFixed(1); // 0.7 = barrenos+infill

  const metrics: Metrics = {
    valid, Tcap_Nm: Tcap, torqueMargin: +torqueMargin.toFixed(3),
    runout_mm: runout, hasCone, bindMargin_mm: bindMargin, binds,
    fusionSF: fsf, fuses, lambda: lam, regime: reg, muContact: +muContact.toFixed(4),
    efficiency: +efficiency.toFixed(4), backlash_mm: +backlash.toFixed(4), mass_g: mass,
    stackH_mm: +stackH.toFixed(1), Router_mm: +Router.toFixed(1),
  };

  // ── FITNESS: penalizaciones duras (escala hacia la factibilidad), luego puntaje ──
  let penalty = 0;
  if (!valid) penalty += 5 + (E <= 0.05 ? 1 : (E - Elimit > 0 ? E - Elimit : 0));
  if (binds) penalty += 3 + Math.max(0, -bindMargin);          // el error de hoy: se traba
  if (fuses) penalty += 2 + (prob.fusionTargetSF - fsf);       // se funde
  if (torqueMargin < 1) penalty += 4 * (1 - torqueMargin);     // no aguanta el par
  const feasible = penalty === 0;

  // puntaje (solo si factible): 0 pérdidas + movimiento (poco juego) + compacto + margen
  const effScore = (efficiency - 0.4) / 0.595;                 // 0..1
  const precScore = clamp(1 - backlash / 1.2, 0, 1);           // poco juego = preciso
  const compactScore = clamp(prob.targetMass_g / Math.max(1, mass), 0, 1);
  const marginScore = torqueMargin >= 1.5 ? 1 : clamp((torqueMargin - 1) / 0.5, 0, 1);
  const wt = prob.weights ?? DEFAULT_WEIGHTS;
  const score = wt.eff * effScore + wt.prec * precScore + wt.compact * compactScore + wt.margin * marginScore;

  const fitness = feasible ? score : -penalty;
  return { metrics, feasible, fitness: +fitness.toFixed(5), penalty: +penalty.toFixed(4), score: +score.toFixed(5) };
}

/** Verificación HONESTA del campeón con la malla REAL (ensamble), no el proxy lineal. */
export function verifyChampion(g: Genome): { runout_mm: number; realWorstMesh_mm: number; collides: boolean; proxyAgrees: boolean } {
  const pins = g.lobes + 1, Rr = g.RrFac * g.R, E = g.Efac * (g.R / (2 * pins));
  const stackH = g.N * g.t + (g.N - 1) * g.gap;
  const boreEngage = Math.max(g.t, 2 * g.R * g.shaftFac);
  const runout = g.coneDeg >= CONE_MIN_DEG ? runoutCone(5) : runoutOneBearing(SHAFT_BORE_CLEAR, stackH, boreEngage);
  const real = worstMeshOverDirections({ lobes: g.lobes, R: g.R, Rr, E, gap: g.gap, discs: g.N }, runout, 16);
  const proxyBinds = effectiveGap(g.gap) - runout <= 0.03;
  return { runout_mm: runout, realWorstMesh_mm: real.worst, collides: real.collides, proxyAgrees: real.collides === proxyBinds };
}

// ──────────────────────────────────────────────────────────────────────────
// PRNG sembrado (determinista — la evolución es reproducible)
// ──────────────────────────────────────────────────────────────────────────
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randGene(b: GeneBound, rnd: () => number): number {
  const v = b.min + rnd() * (b.max - b.min);
  return b.int ? Math.round(v) : v;
}
export function randomGenome(rnd: () => number): Genome {
  const g: any = {};
  for (const b of BOUNDS) g[b.key] = randGene(b, rnd);
  return g as Genome;
}
function repair(g: Genome): Genome {
  const out: any = { ...g };
  for (const b of BOUNDS) { out[b.key] = clamp(out[b.key], b.min, b.max); if (b.int) out[b.key] = Math.round(out[b.key]); }
  return out as Genome;
}

// ──────────────────────────────────────────────────────────────────────────
// El ALGORITMO GENÉTICO
// ──────────────────────────────────────────────────────────────────────────
export interface GAOptions { seed?: number; pop?: number; gens?: number; elite?: number; mutRate?: number; tournament?: number }
export interface GAHistory { gen: number; best: number; mean: number; feasibleFrac: number }
export interface GAResult { best: Genome; bestEval: Evaluation; history: GAHistory[]; population: { g: Genome; e: Evaluation }[]; problem: Problem }

function tournament(pop: { g: Genome; e: Evaluation }[], k: number, rnd: () => number): Genome {
  let best = pop[Math.floor(rnd() * pop.length)];
  for (let i = 1; i < k; i++) { const c = pop[Math.floor(rnd() * pop.length)]; if (c.e.fitness > best.e.fitness) best = c; }
  return best.g;
}
function crossover(a: Genome, b: Genome, rnd: () => number): Genome {
  const child: any = {};
  for (const bd of BOUNDS) {
    if (bd.int) child[bd.key] = rnd() < 0.5 ? (a as any)[bd.key] : (b as any)[bd.key];
    else { const alpha = 0.3, lo = Math.min((a as any)[bd.key], (b as any)[bd.key]), hi = Math.max((a as any)[bd.key], (b as any)[bd.key]); const d = hi - lo; child[bd.key] = (lo - alpha * d) + rnd() * (d + 2 * alpha * d); } // BLX-α
  }
  return repair(child as Genome);
}
function mutate(g: Genome, rate: number, rnd: () => number): Genome {
  const out: any = { ...g };
  for (const b of BOUNDS) {
    if (rnd() < rate) {
      if (b.int) out[b.key] = randGene(b, rnd);
      else { const sigma = 0.15 * (b.max - b.min); out[b.key] = out[b.key] + (rnd() * 2 - 1) * sigma; }
    }
  }
  return repair(out as Genome);
}

export function evolve(prob: Problem = DEFAULT_PROBLEM, opts: GAOptions = {}): GAResult {
  const seed = opts.seed ?? 12345, popN = opts.pop ?? 140, gens = opts.gens ?? 220;
  const elite = opts.elite ?? 4, mutRate = opts.mutRate ?? 0.18, tk = opts.tournament ?? 3;
  const rnd = mulberry32(seed);
  let pop = Array.from({ length: popN }, () => { const g = randomGenome(rnd); return { g, e: evaluate(g, prob) }; });
  const history: GAHistory[] = [];

  for (let gen = 0; gen < gens; gen++) {
    pop.sort((a, b) => b.e.fitness - a.e.fitness);
    const best = pop[0].e.fitness;
    const mean = pop.reduce((s, p) => s + p.e.fitness, 0) / pop.length;
    const feasibleFrac = pop.filter((p) => p.e.feasible).length / pop.length;
    history.push({ gen, best: +best.toFixed(5), mean: +mean.toFixed(5), feasibleFrac: +feasibleFrac.toFixed(3) });

    const next: { g: Genome; e: Evaluation }[] = pop.slice(0, elite); // elitismo
    while (next.length < popN) {
      const pa = tournament(pop, tk, rnd), pb = tournament(pop, tk, rnd);
      const child = mutate(crossover(pa, pb, rnd), mutRate, rnd);
      next.push({ g: child, e: evaluate(child, prob) });
    }
    pop = next;
  }
  pop.sort((a, b) => b.e.fitness - a.e.fitness);
  return { best: pop[0].g, bestEval: pop[0].e, history, population: pop, problem: prob };
}

/** El diseño que FALLÓ hoy (para contraste): sin cono, gap que se funde, 1 disco, eje flaco. */
export const TODAYS_FAILED: Genome = {
  R: 24, lobes: 10, N: 1, t: 5, RrFac: 0.10, Efac: 0.8, gap: 0.55,
  coneDeg: 0, shaftFac: 0.22, ribs: 0, tiltDeg: 0,
};

/** Frente de Pareto (no-dominados) sobre eficiencia↑, juego↓, masa↓ de los factibles. */
export function paretoFront(pop: { g: Genome; e: Evaluation }[]): { g: Genome; e: Evaluation }[] {
  const feas = pop.filter((p) => p.e.feasible);
  const dominated = (a: Metrics, b: Metrics) => // b domina a a
    b.efficiency >= a.efficiency && b.backlash_mm <= a.backlash_mm && b.mass_g <= a.mass_g &&
    (b.efficiency > a.efficiency || b.backlash_mm < a.backlash_mm || b.mass_g < a.mass_g);
  return feas.filter((p) => !feas.some((q) => q !== p && dominated(p.e.metrics, q.e.metrics)));
}
