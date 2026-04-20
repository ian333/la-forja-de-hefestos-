import { describe, it, expect } from 'vitest';
import {
  createState, stepVerlet, computeForces,
  instantaneousTemperature, kineticEnergy,
  berendsenThermostat, applyReactions,
  TYPE_PRESETS, countByType,
  type ReactionRule,
} from '../quantum/md';

describe('createState', () => {
  it('crea N partículas del tipo indicado', () => {
    const counts = new Map([[TYPE_PRESETS.A, 50], [TYPE_PRESETS.B, 30]]);
    const state = createState(counts, 10, 1.0);
    expect(state.N).toBe(80);
    expect(state.positions.length).toBe(80 * 3);
    expect(state.velocities.length).toBe(80 * 3);
    expect(state.types).toHaveLength(2);
  });

  it('posiciones dentro de la caja', () => {
    const state = createState(new Map([[TYPE_PRESETS.A, 100]]), 5, 1.0);
    for (let i = 0; i < state.N; i++) {
      for (let c = 0; c < 3; c++) {
        const x = state.positions[i * 3 + c];
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(5);
      }
    }
  });

  it('velocidades del centro de masa ≈ 0 (sin deriva)', () => {
    const state = createState(new Map([[TYPE_PRESETS.A, 200]]), 10, 1.0);
    let vxS = 0, vyS = 0, vzS = 0;
    for (let i = 0; i < state.N; i++) {
      vxS += state.velocities[i * 3 + 0];
      vyS += state.velocities[i * 3 + 1];
      vzS += state.velocities[i * 3 + 2];
    }
    expect(Math.abs(vxS) / state.N).toBeLessThan(1e-6);
    expect(Math.abs(vyS) / state.N).toBeLessThan(1e-6);
    expect(Math.abs(vzS) / state.N).toBeLessThan(1e-6);
  });

  it('temperatura instantánea cercana al target', () => {
    const state = createState(new Map([[TYPE_PRESETS.A, 500]]), 10, 2.0);
    const T = instantaneousTemperature(state);
    // Con N=500 la fluctuación relativa es ~1/√N ~ 4.5%
    expect(T).toBeGreaterThan(1.7);
    expect(T).toBeLessThan(2.3);
  });
});

describe('computeForces', () => {
  it('fuerzas netas suman ≈ 0 (tercera ley de Newton)', () => {
    // Caja grande → baja densidad → no hay overlaps que generen F=Inf
    const state = createState(new Map([[TYPE_PRESETS.A, 30]]), 15, 1.0, 1);
    computeForces(state);
    let fx = 0, fy = 0, fz = 0;
    let maxF = 0;
    for (let i = 0; i < state.N; i++) {
      fx += state.forces[i * 3 + 0];
      fy += state.forces[i * 3 + 1];
      fz += state.forces[i * 3 + 2];
      const mf = Math.hypot(
        state.forces[i * 3 + 0], state.forces[i * 3 + 1], state.forces[i * 3 + 2],
      );
      if (mf > maxF) maxF = mf;
    }
    // Tolerancia relativa al máximo de fuerza individual
    const tol = Math.max(1e-6, maxF * 1e-10);
    expect(Math.abs(fx)).toBeLessThan(tol);
    expect(Math.abs(fy)).toBeLessThan(tol);
    expect(Math.abs(fz)).toBeLessThan(tol);
  });

  it('una sola partícula no tiene fuerza', () => {
    const state = createState(new Map([[TYPE_PRESETS.A, 1]]), 5, 1.0);
    computeForces(state);
    expect(state.forces[0]).toBe(0);
    expect(state.forces[1]).toBe(0);
    expect(state.forces[2]).toBe(0);
  });
});

describe('stepVerlet — conservación de energía en NVE', () => {
  it('energía total drift <10% en 500 pasos a dt=0.002 (densidad dilution)', () => {
    // Densidad baja (~0.017) y dt pequeño para evitar overlaps violentos
    const state = createState(new Map([[TYPE_PRESETS.A, 50]]), 15, 0.5, 42);
    const PE0 = computeForces(state);
    const Etot0 = kineticEnergy(state) + PE0;

    for (let s = 0; s < 500; s++) {
      stepVerlet(state, 0.002);
    }

    const PE1 = computeForces(state);
    const Etot1 = kineticEnergy(state) + PE1;
    const drift = Math.abs(Etot1 - Etot0) / Math.max(1e-6, Math.abs(Etot0));
    expect(drift).toBeLessThan(0.1);
  });

  it('posiciones quedan siempre dentro de la caja (PBC)', () => {
    const state = createState(new Map([[TYPE_PRESETS.A, 40]]), 15, 1.0);
    for (let s = 0; s < 300; s++) {
      stepVerlet(state, 0.005);
    }
    for (let i = 0; i < state.N; i++) {
      for (let c = 0; c < 3; c++) {
        const x = state.positions[i * 3 + c];
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(15);
      }
    }
  });

  it('tiempo avanza correctamente', () => {
    const state = createState(new Map([[TYPE_PRESETS.A, 10]]), 5, 1.0);
    const t0 = state.time;
    stepVerlet(state, 0.01);
    stepVerlet(state, 0.01);
    expect(state.time - t0).toBeCloseTo(0.02, 8);
  });
});

describe('berendsenThermostat — acerca al target', () => {
  it('desde T=2 hacia T=0.5 baja T al rango objetivo', () => {
    const state = createState(new Map([[TYPE_PRESETS.A, 100]]), 18, 2.0, 7);
    const Tbefore = instantaneousTemperature(state);
    expect(Tbefore).toBeGreaterThan(1.5);
    for (let s = 0; s < 300; s++) {
      stepVerlet(state, 0.002);
      berendsenThermostat(state, 0.5, 0.002, 0.1);
    }
    const Tafter = instantaneousTemperature(state);
    // Debe estar cerca de 0.5 (±50%)
    expect(Tafter).toBeLessThan(0.9);
    expect(Tafter).toBeGreaterThan(0.2);
  });
});

describe('applyReactions', () => {
  it('ejecuta reacción A+B → C+D cuando están cerca con energía', () => {
    // Forzamos partículas muy cercanas y veloces
    const state = createState(
      new Map([[TYPE_PRESETS.A, 1], [TYPE_PRESETS.B, 1]]),
      10, 0,  // T=0 → velocidades iniciales casi nulas
    );
    // Coloca A cerca de B y da velocidad fuerte
    state.positions[0] = 1.0; state.positions[1] = 1.0; state.positions[2] = 1.0;
    state.positions[3] = 1.5; state.positions[4] = 1.0; state.positions[5] = 1.0;
    state.velocities[0] =  5; state.velocities[3] = -5;

    const rules: ReactionRule[] = [{
      reactantA: 0, reactantB: 1,
      productA: TYPE_PRESETS.C.id, productB: TYPE_PRESETS.D.id,
      rCollision: 1.0, Ea: 0.1, probability: 1.0,
    }];
    // Insertar C, D en types
    state.types.push(TYPE_PRESETS.C, TYPE_PRESETS.D);
    // Corregir IDs a índices en state.types
    rules[0].productA = 2;
    rules[0].productB = 3;

    const n = applyReactions(state, rules, 1);
    expect(n).toBe(1);
    const counts = countByType(state);
    expect(counts.A).toBe(0);
    expect(counts.B).toBe(0);
    expect(counts.C + counts.D).toBe(2);
  });

  it('NO reacciona si energía relativa < barrera', () => {
    const state = createState(
      new Map([[TYPE_PRESETS.A, 1], [TYPE_PRESETS.B, 1]]),
      10, 0,
    );
    state.positions[0] = 1.0; state.positions[3] = 1.2;
    state.velocities[0] = 0.01; state.velocities[3] = -0.01;  // casi quietos

    const rules: ReactionRule[] = [{
      reactantA: 0, reactantB: 1, productA: 0, productB: 1,
      rCollision: 1.0, Ea: 1e6, probability: 1.0,   // barrera enorme
    }];
    const n = applyReactions(state, rules, 2);
    expect(n).toBe(0);
  });
});

describe('countByType', () => {
  it('cuenta correctamente', () => {
    const state = createState(
      new Map([[TYPE_PRESETS.A, 10], [TYPE_PRESETS.B, 7]]), 5, 1.0,
    );
    const counts = countByType(state);
    expect(counts.A).toBe(10);
    expect(counts.B).toBe(7);
  });
});
