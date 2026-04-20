/**
 * Tests del stiff solver Rosenbrock-2.
 *
 * Benchmarks clásicos:
 *   - Problema decaimiento exponencial (no stiff) — sanity check
 *   - Robertson 1966 (stiff severo) — referencia publicada
 *   - Sistema 2x2 con autovalores λ=-1, λ=-1000 (moderadamente stiff)
 */
import { describe, it, expect } from 'vitest';
import { solveStiff, jacobianFD, simulateStiff, type OdeFn } from '../stiff-solver';

// ═══════════════════════════════════════════════════════════════
// Jacobiano FD
// ═══════════════════════════════════════════════════════════════

describe('jacobianFD', () => {
  it('función lineal f(y) = A·y → J = A', () => {
    // f(y) = [2·y0 + y1, 3·y1]  → J = [[2,1],[0,3]]
    const f: OdeFn = (_t, y) => [2 * y[0] + y[1], 3 * y[1]];
    const J = jacobianFD(f, 0, [1, 1]);
    expect(J[0][0]).toBeCloseTo(2, 5);
    expect(J[0][1]).toBeCloseTo(1, 5);
    expect(J[1][0]).toBeCloseTo(0, 5);
    expect(J[1][1]).toBeCloseTo(3, 5);
  });

  it('no modifica el vector y de entrada', () => {
    const f: OdeFn = (_t, y) => [y[0] * y[1]];
    const y = [2, 3];
    const copy = [...y];
    jacobianFD(f, 0, y);
    expect(y).toEqual(copy);
  });
});

// ═══════════════════════════════════════════════════════════════
// Sanity — decaimiento exponencial
// ═══════════════════════════════════════════════════════════════

describe('solveStiff — decaimiento y\' = -k·y', () => {
  it('converge a y(t) = y0·exp(-k·t)', () => {
    const k = 2.5;
    const f: OdeFn = (_t, y) => [-k * y[0]];
    const res = solveStiff(f, 0, [1], 2, { rtol: 1e-6, atol: 1e-9 });
    const last = res.t.length - 1;
    const expected = Math.exp(-k * 2);
    expect(res.y[last][0]).toBeCloseTo(expected, 4);
  });

  it('da paso razonable para sistemas poco stiff', () => {
    const f: OdeFn = (_t, y) => [-0.5 * y[0]];
    const res = solveStiff(f, 0, [1], 10, { rtol: 1e-4 });
    // Con rtol suelta no debería necesitar miles de pasos
    expect(res.steps).toBeLessThan(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// Sistema 2×2 moderadamente stiff
// ═══════════════════════════════════════════════════════════════

describe('solveStiff — sistema 2×2 con escalas λ₁=-1, λ₂=-1000', () => {
  // dy1/dt = -y1
  // dy2/dt = -1000·y2 + 1000·y1
  // Estado estacionario lento: y2 ≈ y1 (después de transitorio rápido)
  const f: OdeFn = (_t, y) => [
    -y[0],
    -1000 * y[1] + 1000 * y[0],
  ];

  it('maneja stiffness sin explotar', () => {
    const res = solveStiff(f, 0, [1, 0], 2, { rtol: 1e-4, atol: 1e-7 });
    const last = res.t.length - 1;
    // Después del transitorio rápido, y2 debe rastrear a y1
    expect(res.y[last][1]).toBeCloseTo(res.y[last][0], 3);
    // Y ambos decaen como exp(-t)
    expect(res.y[last][0]).toBeCloseTo(Math.exp(-2), 3);
  });

  it('usa menos pasos que lo que necesitaría RK4 explícito (<1000 steps)', () => {
    // RK4 explícito necesitaría dt ~ 2/|λ_max| = 2e-3 → 1000 pasos para t=2.
    // Implicit Euler + Richardson puede usar pasos mucho mayores por L-estabilidad.
    const res = solveStiff(f, 0, [1, 0], 2, { rtol: 1e-4 });
    expect(res.steps).toBeLessThan(1000);
  });
});

// ═══════════════════════════════════════════════════════════════
// Robertson 1966 — benchmark stiff clásico
// ═══════════════════════════════════════════════════════════════

describe('Robertson 1966 — benchmark stiff canónico', () => {
  /*
   * Reacciones (formulación estándar Hairer-Wanner):
   *    A → B            k1 = 0.04
   *    2B → C + B       k2 = 3·10⁷      (muy rápido; neto consume 1 B, produce 1 C)
   *    B + C → A + C    k3 = 10⁴
   *
   * ODE (conservativa: dA/dt + dB/dt + dC/dt = 0):
   *    dA/dt = -k1·A + k3·B·C
   *    dB/dt = k1·A - k3·B·C - k2·B²
   *    dC/dt = k2·B²
   *
   * Valores de referencia publicados (Hairer-Wanner II, p.3):
   *    t=40:  A ≈ 0.7158, B ≈ 9.186·10⁻⁶, C ≈ 0.2841
   */
  const k1 = 0.04, k2 = 3e7, k3 = 1e4;
  const f: OdeFn = (_t, y) => {
    const A = y[0], B = y[1], C = y[2];
    return [
      -k1 * A + k3 * B * C,
       k1 * A - k3 * B * C - k2 * B * B,
       k2 * B * B,
    ];
  };

  it('reproduce valores publicados en t=40', () => {
    // Robertson es el benchmark stiff más duro de la literatura. Usamos rtol
    // tight + atol muy pequeña (B queda del orden 10⁻⁵) y desactivamos
    // clamping no-negativo para no perder masa por redondeo.
    const res = solveStiff(f, 0, [1, 0, 0], 40, {
      rtol: 1e-7,
      atol: 1e-13,
      hInit: 1e-6,
      clampNonNeg: false,
      maxSteps: 100000,
    });
    const last = res.t.length - 1;
    const [A, B, C] = res.y[last];

    expect(A).toBeCloseTo(0.7158, 2);
    expect(B).toBeCloseTo(9.186e-6, 6);
    expect(C).toBeCloseTo(0.2841, 2);
  });

  it('conservación A + B + C = 1 (tolerancia)', () => {
    const res = solveStiff(f, 0, [1, 0, 0], 40, {
      rtol: 1e-7,
      atol: 1e-13,
      clampNonNeg: false,
      maxSteps: 100000,
    });
    const last = res.t.length - 1;
    const total = res.y[last][0] + res.y[last][1] + res.y[last][2];
    expect(total).toBeCloseTo(1, 3);
  });

  it('NO produce NaN/Infinity durante la integración', () => {
    const res = solveStiff(f, 0, [1, 0, 0], 100, {
      rtol: 1e-5,
      maxSteps: 100000,
    });
    for (const row of res.y) {
      for (const v of row) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('completa la integración en < 30k pasos (stiff extremo)', () => {
    // Robertson es uno de los benchmarks stiff más duros; RK4 explícito
    // necesitaría del orden de 10¹⁰ pasos por la escala k₂=3·10⁷.
    // Implicit Euler + Richardson lo maneja en decenas de miles.
    const res = solveStiff(f, 0, [1, 0, 0], 40, {
      rtol: 1e-5,
      maxSteps: 100000,
    });
    expect(res.steps).toBeLessThan(30000);
  });
});

// ═══════════════════════════════════════════════════════════════
// Integración con sistema cinético
// ═══════════════════════════════════════════════════════════════

describe('simulateStiff — adaptador a sistema de reacciones', () => {
  it('reacción A → B de primer orden coincide con analítica', () => {
    const steps = [{
      reactants: [{ species: 'A', nu: 1, order: 1 }],
      products:  [{ species: 'B', nu: 1 }],
      A: 0.5, Ea: 0,
    }];
    const res = simulateStiff(steps, 300, { A: 1, B: 0 }, 5, { rtol: 1e-6 });
    const last = res.t.length - 1;
    expect(res.C.A[last]).toBeCloseTo(Math.exp(-0.5 * 5), 3);
    expect(res.C.B[last]).toBeCloseTo(1 - Math.exp(-0.5 * 5), 3);
  });
});
