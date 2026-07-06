import { describe, it, expect } from 'vitest';
import {
  evaluate, evolve, verifyChampion, randomGenome, mulberry32,
  TODAYS_FAILED, DEFAULT_PROBLEM, BOUNDS, paretoFront, type Genome,
} from './evolucion';

describe('evolucion — genoma y evaluación', () => {
  it('los genes aleatorios respetan los límites', () => {
    const rnd = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const g: any = randomGenome(rnd);
      for (const b of BOUNDS) {
        expect(g[b.key]).toBeGreaterThanOrEqual(b.min);
        expect(g[b.key]).toBeLessThanOrEqual(b.max);
        if (b.int) expect(Number.isInteger(g[b.key])).toBe(true);
      }
    }
  });

  it('EL ERROR DE HOY: sin cono + gap 0.55 → se TRABA y/o se funde (infactible)', () => {
    const e = evaluate(TODAYS_FAILED);
    expect(e.feasible).toBe(false);
    // sin cono el runout es enorme (voladizo) → no libra la malla
    expect(e.metrics.hasCone).toBe(false);
    expect(e.metrics.binds || e.metrics.fuses).toBe(true);
  });

  it('un cono SÍ cambia el veredicto del runout (la lección física)', () => {
    const sinCono: Genome = { ...TODAYS_FAILED, gap: 0.9 };
    const conCono: Genome = { ...sinCono, coneDeg: 20 };
    expect(evaluate(conCono).metrics.runout_mm).toBeLessThan(evaluate(sinCono).metrics.runout_mm);
    expect(evaluate(conCono).metrics.binds).toBe(false);
  });
});

describe('evolucion — el algoritmo genético', () => {
  it('es DETERMINISTA: misma semilla → mismo campeón', () => {
    const a = evolve(DEFAULT_PROBLEM, { seed: 99, pop: 60, gens: 40 });
    const b = evolve(DEFAULT_PROBLEM, { seed: 99, pop: 60, gens: 40 });
    expect(b.best).toEqual(a.best);
    expect(b.bestEval.fitness).toBe(a.bestEval.fitness);
  });

  it('CONVERGE: el mejor fitness sube (o no baja) y termina factible', () => {
    const r = evolve(DEFAULT_PROBLEM, { seed: 3, pop: 120, gens: 120 });
    const first = r.history[0].best, last = r.history[r.history.length - 1].best;
    expect(last).toBeGreaterThan(first);
    expect(r.bestEval.feasible).toBe(true);
  });

  it('el CAMPEÓN respeta toda la física: no se traba, no se funde, aguanta el par', () => {
    const r = evolve(DEFAULT_PROBLEM, { seed: 3, pop: 120, gens: 120 });
    const m = r.bestEval.metrics;
    expect(m.valid).toBe(true);
    expect(m.binds).toBe(false);
    expect(m.fuses).toBe(false);
    expect(m.torqueMargin).toBeGreaterThanOrEqual(1);
    // la evolución DESCUBRE el cono (es la única forma de bajar el runout y poder apretar el gap)
    expect(m.hasCone).toBe(true);
  });

  it('VERIFICACIÓN honesta: la malla REAL (ensamble) concuerda con el proxy del fitness', () => {
    const r = evolve(DEFAULT_PROBLEM, { seed: 3, pop: 100, gens: 80 });
    const v = verifyChampion(r.best);
    expect(v.collides).toBe(false);
    expect(v.proxyAgrees).toBe(true);
  });

  it('el frente de Pareto no está vacío y todos son factibles', () => {
    const r = evolve(DEFAULT_PROBLEM, { seed: 5, pop: 120, gens: 100 });
    const front = paretoFront(r.population);
    expect(front.length).toBeGreaterThan(0);
    expect(front.every((p) => p.e.feasible)).toBe(true);
  });

  it('el campeón mejora al diseño de HOY en fitness', () => {
    const r = evolve(DEFAULT_PROBLEM, { seed: 3, pop: 120, gens: 120 });
    expect(r.bestEval.fitness).toBeGreaterThan(evaluate(TODAYS_FAILED).fitness);
  });
});
