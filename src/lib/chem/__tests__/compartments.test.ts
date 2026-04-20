import { describe, it, expect } from 'vitest';
import {
  simulateMultiBox,
  verticalDiffusion,
  type MultiBoxSystem,
  type Compartment,
} from '../compartments';
import type { ReactionStep } from '../kinetics';

// Reacción simple para tener algo de cinética interna
const decay: ReactionStep = {
  name: 'A → B',
  reactants: [{ species: 'A', nu: 1, order: 1 }],
  products:  [{ species: 'B', nu: 1 }],
  A: 0.1, Ea: 0,
};

describe('simulateMultiBox — 2 cajas sin flujo', () => {
  it('sin flujo las cajas evolucionan independientes', () => {
    const sys: MultiBoxSystem = {
      compartments: [
        { id: 'box1', name: 'Box 1', volume: 1, T: 300, steps: [decay],
          initial: { A: 1, B: 0 } },
        { id: 'box2', name: 'Box 2', volume: 1, T: 300, steps: [decay],
          initial: { A: 2, B: 0 } },
      ],
      fluxes: [],
    };
    const res = simulateMultiBox(sys, 10, { rtol: 1e-6 });
    const last = res.t.length - 1;
    // Cada caja decae a exp(-0.1·10) de su inicial
    expect(res.C.box1.A[last]).toBeCloseTo(1 * Math.exp(-1), 3);
    expect(res.C.box2.A[last]).toBeCloseTo(2 * Math.exp(-1), 3);
  });
});

describe('simulateMultiBox — difusión equilibra concentraciones', () => {
  it('volúmenes iguales, 1 flux difusivo → concentración promedio', () => {
    const sys: MultiBoxSystem = {
      compartments: [
        { id: 'a', name: 'A', volume: 1, T: 300, steps: [], initial: { X: 10 } },
        { id: 'b', name: 'B', volume: 1, T: 300, steps: [], initial: { X: 0 } },
      ],
      fluxes: [
        { from: 'a', to: 'b', rate: 0.5, kind: 'diffusive' },
      ],
    };
    const res = simulateMultiBox(sys, 100, { rtol: 1e-6 });
    const last = res.t.length - 1;
    // Equilibrio: ambas a 5 (promedio conservando masa)
    expect(res.C.a.X[last]).toBeCloseTo(5, 2);
    expect(res.C.b.X[last]).toBeCloseTo(5, 2);
  });

  it('volúmenes distintos: equilibrio tiene C_a = C_b (difusivo)', () => {
    const sys: MultiBoxSystem = {
      compartments: [
        { id: 'small', name: 'small', volume: 1, T: 300, steps: [], initial: { X: 10 } },
        { id: 'big',   name: 'big',   volume: 9, T: 300, steps: [], initial: { X: 0 } },
      ],
      fluxes: [
        { from: 'small', to: 'big', rate: 0.1, kind: 'diffusive' },
      ],
    };
    const res = simulateMultiBox(sys, 1000, { rtol: 1e-6 });
    const last = res.t.length - 1;
    // Masa total 10; V total 10 ⇒ C_eq = 1 en ambas cajas
    expect(res.C.small.X[last]).toBeCloseTo(1, 2);
    expect(res.C.big.X[last]).toBeCloseTo(1, 2);
  });

  it('conservación de masa con flujo difusivo', () => {
    const sys: MultiBoxSystem = {
      compartments: [
        { id: 'a', name: 'A', volume: 2, T: 300, steps: [], initial: { X: 5 } },
        { id: 'b', name: 'B', volume: 3, T: 300, steps: [], initial: { X: 2 } },
      ],
      fluxes: [
        { from: 'a', to: 'b', rate: 0.2, kind: 'diffusive' },
      ],
    };
    const res = simulateMultiBox(sys, 50, { rtol: 1e-6 });
    const initialMass = 5 * 2 + 2 * 3;
    for (let i = 0; i < res.t.length; i++) {
      const mass = res.C.a.X[i] * 2 + res.C.b.X[i] * 3;
      expect(mass).toBeCloseTo(initialMass, 3);
    }
  });

  it('flujo advectivo: reactor vacía "aguas arriba" sin reponerlo', () => {
    const sys: MultiBoxSystem = {
      compartments: [
        { id: 'up', name: 'upstream', volume: 1, T: 300, steps: [], initial: { X: 10 } },
        { id: 'dn', name: 'downstream', volume: 1, T: 300, steps: [], initial: { X: 0 } },
      ],
      fluxes: [
        { from: 'up', to: 'dn', rate: 0.5, kind: 'advective' },
      ],
    };
    const res = simulateMultiBox(sys, 20, { rtol: 1e-6 });
    const last = res.t.length - 1;
    // up decae como exp(-0.5·20) ≈ 4.5e-5
    expect(res.C.up.X[last]).toBeLessThan(1e-3);
    // dn absorbe casi toda la masa
    expect(res.C.dn.X[last]).toBeCloseTo(10, 1);
  });
});

describe('simulateMultiBox — emisión y deposición', () => {
  it('emisión constante produce acumulación lineal (sin reacción ni deposición)', () => {
    const sys: MultiBoxSystem = {
      compartments: [
        { id: 'air', name: 'air', volume: 1, T: 300,
          steps: [], initial: { X: 0 },
          emission: { X: 0.01 } },    // 0.01 mol/(L·s)
      ],
      fluxes: [],
    };
    const res = simulateMultiBox(sys, 100, { rtol: 1e-6 });
    const last = res.t.length - 1;
    // X(100) = 0 + 0.01·100 = 1.0
    expect(res.C.air.X[last]).toBeCloseTo(1.0, 2);
  });

  it('emisión + deposición en equilibrio: C_ss = E/k_dep', () => {
    const sys: MultiBoxSystem = {
      compartments: [
        { id: 'air', name: 'air', volume: 1, T: 300,
          steps: [], initial: { X: 0 },
          emission: { X: 1.0 },
          deposition: { X: 0.1 } },
      ],
      fluxes: [],
    };
    const res = simulateMultiBox(sys, 200, { rtol: 1e-6 });
    const last = res.t.length - 1;
    // C_ss = E/k = 1.0 / 0.1 = 10
    expect(res.C.air.X[last]).toBeCloseTo(10, 1);
  });
});

describe('verticalDiffusion helper', () => {
  it('produce un flux difusivo con rate = kZ/H²', () => {
    const fluxes = verticalDiffusion('lo', 'hi', 1, 100);
    expect(fluxes).toHaveLength(1);
    expect(fluxes[0].rate).toBeCloseTo(1 / (100 * 100), 10);
    expect(fluxes[0].from).toBe('lo');
    expect(fluxes[0].to).toBe('hi');
    expect(fluxes[0].kind).toBe('diffusive');
  });
});

describe('cinética diferente por caja', () => {
  it('una caja puede reaccionar mientras otra está inerte', () => {
    const sys: MultiBoxSystem = {
      compartments: [
        { id: 'active', name: 'reactor', volume: 1, T: 300,
          steps: [decay], initial: { A: 1, B: 0 } },
        { id: 'dead', name: 'inert', volume: 1, T: 300,
          steps: [], initial: { A: 1, B: 0 } },
      ],
      fluxes: [],
    };
    const res = simulateMultiBox(sys, 10, { rtol: 1e-6 });
    const last = res.t.length - 1;
    // Caja activa: A decae a exp(-1)
    expect(res.C.active.A[last]).toBeCloseTo(Math.exp(-1), 3);
    // Caja inerte: A se mantiene en 1
    expect(res.C.dead.A[last]).toBeCloseTo(1, 10);
  });
});
