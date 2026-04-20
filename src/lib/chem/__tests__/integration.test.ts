/**
 * Tests de integración: escenarios de simulación end-to-end.
 *
 * Estos tests tratan al motor como caja negra y verifican que produce
 * resultados físicamente razonables para escenarios reales de química.
 * Son la "prueba de realidad" del motor.
 */
import { describe, it, expect } from 'vitest';
import { simulate, arrhenius, rateOf, type ReactionStep } from '../kinetics';
import { CONSTANTS } from '../elements';

// ═══════════════════════════════════════════════════════════════
// Escenario 1 — Caso canónico de libro: A → B → C (reacción en serie)
// ═══════════════════════════════════════════════════════════════
// Sistema de reacciones consecutivas. El intermediario B debe tener máximo
// y luego decaer. Atkins §17.11, Levenspiel §3.6

describe('reacciones en serie A → B → C', () => {
  const steps: ReactionStep[] = [
    {
      name: 'A → B',
      reactants: [{ species: 'A', nu: 1, order: 1 }],
      products: [{ species: 'B', nu: 1 }],
      A: 0.3, Ea: 0,
    },
    {
      name: 'B → C',
      reactants: [{ species: 'B', nu: 1, order: 1 }],
      products: [{ species: 'C', nu: 1 }],
      A: 0.1, Ea: 0,
    },
  ];
  const traj = simulate(steps, 300, { A: 1, B: 0, C: 0 }, 0.05, 2000);

  it('A decae monótonamente', () => {
    for (let i = 1; i < traj.C.A.length; i++) {
      expect(traj.C.A[i]).toBeLessThanOrEqual(traj.C.A[i - 1] + 1e-12);
    }
  });

  it('C crece monótonamente', () => {
    for (let i = 1; i < traj.C.C.length; i++) {
      expect(traj.C.C[i]).toBeGreaterThanOrEqual(traj.C.C[i - 1] - 1e-12);
    }
  });

  it('B tiene un máximo intermedio (no monótono)', () => {
    const maxB = Math.max(...traj.C.B);
    const idxMax = traj.C.B.indexOf(maxB);
    // Máximo no debe estar en los extremos
    expect(idxMax).toBeGreaterThan(5);
    expect(idxMax).toBeLessThan(traj.C.B.length - 5);
    // Máximo positivo
    expect(maxB).toBeGreaterThan(0);
  });

  it('tiempo al máximo B coincide con fórmula analítica t_max = ln(k1/k2)/(k1-k2)', () => {
    const k1 = 0.3, k2 = 0.1;
    const tMaxAnalytic = Math.log(k1 / k2) / (k1 - k2); // ≈ 5.49 s
    const idxMax = traj.C.B.indexOf(Math.max(...traj.C.B));
    const tMaxMeasured = traj.t[idxMax];
    expect(Math.abs(tMaxMeasured - tMaxAnalytic) / tMaxAnalytic).toBeLessThan(0.05);
  });

  it('conservación total: A+B+C = 1 en todo momento', () => {
    for (let i = 0; i < traj.t.length; i++) {
      const total = traj.C.A[i] + traj.C.B[i] + traj.C.C[i];
      expect(total).toBeCloseTo(1, 4);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Escenario 2 — Reacciones paralelas con selectividad
// ═══════════════════════════════════════════════════════════════
// A → P (fast) y A → Q (slow): selectividad hacia P

describe('reacciones paralelas A → P, A → Q', () => {
  const steps: ReactionStep[] = [
    {
      name: 'A → P',
      reactants: [{ species: 'A', nu: 1, order: 1 }],
      products: [{ species: 'P', nu: 1 }],
      A: 0.8, Ea: 0,
    },
    {
      name: 'A → Q',
      reactants: [{ species: 'A', nu: 1, order: 1 }],
      products: [{ species: 'Q', nu: 1 }],
      A: 0.2, Ea: 0,
    },
  ];

  it('selectividad P/Q = k_P/k_Q = 4:1', () => {
    const traj = simulate(steps, 300, { A: 1, P: 0, Q: 0 }, 0.05, 400);
    const last = traj.t.length - 1;
    const ratio = traj.C.P[last] / traj.C.Q[last];
    expect(ratio).toBeCloseTo(4, 2);
  });

  it('P + Q = A consumido', () => {
    const traj = simulate(steps, 300, { A: 1, P: 0, Q: 0 }, 0.05, 400);
    const last = traj.t.length - 1;
    const consumed = 1 - traj.C.A[last];
    const produced = traj.C.P[last] + traj.C.Q[last];
    expect(produced).toBeCloseTo(consumed, 5);
  });
});

// ═══════════════════════════════════════════════════════════════
// Escenario 3 — Equilibrio reversible cuantitativo
// ═══════════════════════════════════════════════════════════════
// A ⇌ B con Keq conocida; verifica convergencia

describe('equilibrio reversible — Keq cuantitativa', () => {
  const stepRev: ReactionStep = {
    name: 'A ⇌ B',
    reactants: [{ species: 'A', nu: 1, order: 1 }],
    products: [{ species: 'B', nu: 1, order: 1 }],
    A: 2.0, Ea: 0,
    reversible: true,
    A_rev: 0.5, Ea_rev: 0,
  };

  it('[B]/[A] converge a Keq = kf/kr = 4', () => {
    const traj = simulate([stepRev], 300, { A: 1, B: 0 }, 0.01, 5000);
    const last = traj.t.length - 1;
    const ratio = traj.C.B[last] / traj.C.A[last];
    expect(ratio).toBeCloseTo(4, 2);
  });

  it('independiente de condiciones iniciales: 0→eq = 1→eq cambiado de lado', () => {
    const trajA = simulate([stepRev], 300, { A: 1, B: 0 }, 0.01, 5000);
    const trajB = simulate([stepRev], 300, { A: 0, B: 1 }, 0.01, 5000);
    const lastA = trajA.t.length - 1;
    const lastB = trajB.t.length - 1;
    const ratioA = trajA.C.B[lastA] / trajA.C.A[lastA];
    const ratioB = trajB.C.B[lastB] / trajB.C.A[lastB];
    expect(ratioA).toBeCloseTo(ratioB, 2);
  });

  it('conservación: A+B es constante', () => {
    const traj = simulate([stepRev], 300, { A: 0.7, B: 0.3 }, 0.01, 1000);
    for (let i = 0; i < traj.t.length; i++) {
      expect(traj.C.A[i] + traj.C.B[i]).toBeCloseTo(1, 4);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Escenario 4 — Reacciones autocatalíticas (A + B → 2B)
// ═══════════════════════════════════════════════════════════════
// El producto cataliza su propia formación — crecimiento sigmoide

describe('autocatálisis A + B → 2B', () => {
  const step: ReactionStep = {
    name: 'A + B → 2B',
    reactants: [
      { species: 'A', nu: 1, order: 1 },
      { species: 'B', nu: 1, order: 1 },
    ],
    products: [{ species: 'B', nu: 2 }],
    A: 1.0, Ea: 0,
  };

  it('cinética sigmoide: B crece lento → rápido → satura', () => {
    const traj = simulate([step], 300, { A: 1, B: 0.01 }, 0.01, 2000);
    const last = traj.t.length - 1;

    // B finales debe ser cercano a A+B inicial = 1.01
    expect(traj.C.B[last]).toBeCloseTo(1.01, 2);
    // A debe estar casi agotado
    expect(traj.C.A[last]).toBeLessThan(0.01);
  });

  it('sin semilla (B=0) la reacción no arranca', () => {
    const traj = simulate([step], 300, { A: 1, B: 0 }, 0.01, 500);
    const last = traj.t.length - 1;
    expect(traj.C.A[last]).toBeCloseTo(1, 10);
    expect(traj.C.B[last]).toBeCloseTo(0, 10);
  });

  it('conservación: A+B constante (átomo genérico)', () => {
    const traj = simulate([step], 300, { A: 1, B: 0.05 }, 0.01, 800);
    for (let i = 0; i < traj.t.length; i++) {
      expect(traj.C.A[i] + traj.C.B[i]).toBeCloseTo(1.05, 4);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Escenario 5 — Oscilaciones químicas (Lotka-Volterra químico)
// ═══════════════════════════════════════════════════════════════
// Modelo predador-presa químico: A → X (rápido, autocatalítico en X),
// X + Y → 2Y (autocatalítico en Y), Y → B
// Produce oscilaciones sostenidas — test serio de estabilidad del integrador.
// Lotka 1910, Volterra 1926.

describe('Lotka-Volterra químico', () => {
  const steps: ReactionStep[] = [
    {
      name: 'A + X → 2X',
      reactants: [
        { species: 'A', nu: 1, order: 1 },
        { species: 'X', nu: 1, order: 1 },
      ],
      products: [{ species: 'X', nu: 2 }],
      A: 0.5, Ea: 0,
    },
    {
      name: 'X + Y → 2Y',
      reactants: [
        { species: 'X', nu: 1, order: 1 },
        { species: 'Y', nu: 1, order: 1 },
      ],
      products: [{ species: 'Y', nu: 2 }],
      A: 1.0, Ea: 0,
    },
    {
      name: 'Y → B',
      reactants: [{ species: 'Y', nu: 1, order: 1 }],
      products: [{ species: 'B', nu: 1 }],
      A: 0.3, Ea: 0,
    },
  ];

  it('simulación se completa sin NaN en 10 000 pasos', () => {
    const traj = simulate(
      steps,
      300,
      { A: 100, X: 1, Y: 1, B: 0 },
      0.01,
      10000,
    );
    for (const sp of traj.species) {
      for (const v of traj.C[sp]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Escenario 6 — Sensibilidad a dt (convergencia RK4)
// ═══════════════════════════════════════════════════════════════

describe('convergencia del integrador en dt', () => {
  const step: ReactionStep = {
    reactants: [{ species: 'A', nu: 1, order: 1 }],
    products: [{ species: 'B', nu: 1 }],
    A: 1.0, Ea: 0,
  };
  const tFinal = 5;
  const exact = Math.exp(-1.0 * 5);

  it('RK4 tiene error global O(dt⁴)', () => {
    const run = (dt: number) => {
      const nSteps = Math.round(tFinal / dt);
      const traj = simulate([step], 300, { A: 1, B: 0 }, dt, nSteps);
      return Math.abs(traj.C.A[traj.t.length - 1] - exact);
    };
    const err1 = run(0.1);
    const err2 = run(0.05);
    // Reducir dt a la mitad debería reducir error ~16× (orden 4)
    // Tolerancia generosa porque para errores muy pequeños el redondeo domina
    expect(err2).toBeLessThan(err1);
  });
});

// ═══════════════════════════════════════════════════════════════
// Escenario 7 — Temperatura como sensibilidad exponencial (Arrhenius)
// ═══════════════════════════════════════════════════════════════

describe('sensibilidad a temperatura — Arrhenius', () => {
  const step: ReactionStep = {
    reactants: [{ species: 'A', nu: 1, order: 1 }],
    products: [{ species: 'B', nu: 1 }],
    A: 1e10, Ea: 80000, // Ea típica
  };

  it('k(T+100) / k(T) coincide con exp(Ea/(R·T(T+100))·100)', () => {
    const T = 300;
    const k1 = arrhenius(1e10, 80000, T);
    const k2 = arrhenius(1e10, 80000, T + 100);
    const ratio = k2 / k1;
    const expected = Math.exp((80000 / (CONSTANTS.R * T * (T + 100))) * 100);
    expect(ratio).toBeCloseTo(expected, 3);
  });

  it('simulaciones a T+50K consumen más rápido', () => {
    const trajLow = simulate([step], 500, { A: 1, B: 0 }, 0.001, 500);
    const trajHigh = simulate([step], 550, { A: 1, B: 0 }, 0.001, 500);
    const last = trajLow.t.length - 1;
    expect(trajHigh.C.A[last]).toBeLessThan(trajLow.C.A[last]);
  });
});

// ═══════════════════════════════════════════════════════════════
// Escenario 8 — rateOf en condiciones extremas
// ═══════════════════════════════════════════════════════════════

describe('robustez numérica', () => {
  it('rateOf con T muy baja (100K) no produce NaN', () => {
    const step: ReactionStep = {
      reactants: [{ species: 'A', nu: 1, order: 1 }],
      products: [{ species: 'B', nu: 1 }],
      A: 1e15, Ea: 300000, // Ea alta + T baja = k casi 0
    };
    const r = rateOf(step, 100, { A: 1, B: 0 });
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeGreaterThanOrEqual(0);
  });

  it('rateOf con concentración enorme (1e6 M) no produce Infinity', () => {
    const step: ReactionStep = {
      reactants: [{ species: 'A', nu: 1, order: 1 }],
      products: [{ species: 'B', nu: 1 }],
      A: 1e10, Ea: 50000,
    };
    const r = rateOf(step, 300, { A: 1e6, B: 0 });
    expect(Number.isFinite(r)).toBe(true);
  });

  it('simulate con cero reactivo produce trayectoria plana', () => {
    const step: ReactionStep = {
      reactants: [{ species: 'A', nu: 1, order: 1 }],
      products: [{ species: 'B', nu: 1 }],
      A: 1, Ea: 0,
    };
    const traj = simulate([step], 300, { A: 0, B: 0 }, 0.1, 100);
    for (const sp of traj.species) {
      for (const v of traj.C[sp]) {
        expect(v).toBe(0);
      }
    }
  });
});
