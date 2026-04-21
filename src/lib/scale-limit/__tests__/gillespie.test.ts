/**
 * Tests honestos de Gillespie SSA y ODE de acción de masas.
 *
 * Birth-death tiene solución cerrada:
 *   ⟨X⟩   = α/β
 *   Var   = α/β
 *   σ/⟨X⟩ = 1/√⟨X⟩
 *
 * Si nuestro SSA lo reproduce, confiamos. Si no, hay bug en los
 * binomiales, el sampleo exponencial, o la stoichiometry.
 */

import { describe, it, expect } from 'vitest';
import {
  ssaRun, odeRun, odeStep,
  propensity,
  birthDeath, lotkaVolterra,
  steadyStateStats, birthDeathRSD,
  massActionDerivative,
} from '../gillespie';

// ═══════════════════════════════════════════════════════════════
// Propensity
// ═══════════════════════════════════════════════════════════════

describe('propensity — combinatoria correcta', () => {
  it('orden 1: a = c·n', () => {
    const r = { reactants: [[0, 1]] as [number,number][], products: [], c: 2 };
    expect(propensity(r, new Int32Array([5]))).toBe(10);
    expect(propensity(r, new Int32Array([0]))).toBe(0);
  });

  it('orden 2 dimer: a = c·n·(n-1)/2', () => {
    const r = { reactants: [[0, 2]] as [number,number][], products: [], c: 1 };
    // n=4 → 4·3/2 = 6
    expect(propensity(r, new Int32Array([4]))).toBe(6);
    // n=1 → 0 (no se puede dimerizar solo 1)
    expect(propensity(r, new Int32Array([1]))).toBe(0);
  });

  it('orden 2 mixed A+B: a = c·n_A·n_B', () => {
    const r = { reactants: [[0, 1], [1, 1]] as [number,number][], products: [], c: 3 };
    expect(propensity(r, new Int32Array([4, 5]))).toBe(3 * 4 * 5);
  });

  it('reactivo ausente ⇒ 0', () => {
    const r = { reactants: [[0, 1]] as [number,number][], products: [], c: 1 };
    expect(propensity(r, new Int32Array([0]))).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Birth-death: tests contra solución exacta
// ═══════════════════════════════════════════════════════════════

describe('Birth-death SSA — solución cerrada', () => {
  it('⟨X⟩ converge a α/β (α=100, β=1 ⇒ ⟨X⟩=100)', () => {
    const net = birthDeath(100, 1);
    const res = ssaRun(net, new Int32Array([0]), 50, 0.1);
    const s = steadyStateStats(res, 0, 0.4);
    expect(s.mean).toBeGreaterThan(95);
    expect(s.mean).toBeLessThan(105);
  });

  it('Var(X) ≈ ⟨X⟩ (Poisson: razón σ²/⟨X⟩ ≈ 1)', () => {
    const net = birthDeath(50, 1);   // ⟨X⟩=50
    const res = ssaRun(net, new Int32Array([50]), 80, 0.1);
    const s = steadyStateStats(res, 0, 0.3);
    const ratio = s.variance / s.mean;
    expect(ratio).toBeGreaterThan(0.7);
    expect(ratio).toBeLessThan(1.3);
  });

  it('σ/⟨X⟩ sigue la ley 1/√⟨X⟩', () => {
    // α = 25 ⇒ ⟨X⟩=25 ⇒ σ/⟨X⟩ = 0.20
    // α = 400 ⇒ ⟨X⟩=400 ⇒ σ/⟨X⟩ = 0.05
    const rsd25  = steadyStateStats(
      ssaRun(birthDeath(25, 1),  new Int32Array([25]),  120, 0.1), 0, 0.3,
    ).rsd;
    const rsd400 = steadyStateStats(
      ssaRun(birthDeath(400, 1), new Int32Array([400]), 30, 0.05), 0, 0.3,
    ).rsd;
    const pred25  = birthDeathRSD(25, 1);
    const pred400 = birthDeathRSD(400, 1);
    expect(rsd25 ).toBeGreaterThan(pred25  * 0.60);
    expect(rsd25 ).toBeLessThan   (pred25  * 1.40);
    expect(rsd400).toBeGreaterThan(pred400 * 0.60);
    expect(rsd400).toBeLessThan   (pred400 * 1.40);
    // Ley de escala: duplicar N en factor 16 reduce RSD por 4
    expect(rsd25 / rsd400).toBeGreaterThan(2.5);
    expect(rsd25 / rsd400).toBeLessThan(6.0);
  });

  it('ODE de birth-death da exactamente α/β en steady state', () => {
    const net = birthDeath(100, 1);
    const res = odeRun(net, new Float64Array([0]), 20, 0.01);
    const final = res.samples[res.samples.length - 1][0];
    expect(Math.abs(final - 100)).toBeLessThan(0.01);
  });

  it('ODE SIGUE analítica: x(t) = 100·(1 − e^(−t))', () => {
    const net = birthDeath(100, 1);
    const res = odeRun(net, new Float64Array([0]), 5, 0.001);
    // En t=1: x = 100(1 − e^-1) ≈ 63.21
    const t1idx = Math.floor(1 / 0.001);
    const analytic = 100 * (1 - Math.exp(-1));
    expect(res.samples[t1idx][0]).toBeCloseTo(analytic, 2);
  });
});

// ═══════════════════════════════════════════════════════════════
// Cross-over SSA → ODE
// ═══════════════════════════════════════════════════════════════

describe('Cross-over SSA ↔ ODE: desviación escala como 1/√N', () => {
  it('diferencia |⟨X⟩_SSA − X_ODE| decrece con N', () => {
    const sizes = [10, 100, 1000];
    const diffs = sizes.map(N => {
      // α = N, β = 1 ⇒ steady state = N
      const net = birthDeath(N, 1);
      const ssa = ssaRun(net, new Int32Array([N]), 30, 0.05);
      const stats = steadyStateStats(ssa, 0, 0.3);
      // ODE da exactamente N, así que |diff| = |⟨X⟩_SSA − N|
      return Math.abs(stats.mean - N) / N;   // normalizado
    });
    // Se espera diffs[0] > diffs[1] > diffs[2] (desviación relativa baja)
    // Con finite sampling no siempre monótono, pero el último debe ser pequeño
    expect(diffs[2]).toBeLessThan(0.05);
    expect(diffs[2]).toBeLessThan(diffs[0]);
  });
});

// ═══════════════════════════════════════════════════════════════
// Lotka-Volterra — cualitativo
// ═══════════════════════════════════════════════════════════════

describe('Lotka-Volterra estocástico', () => {
  it('sistema dinámico se sostiene (no extingue) con N moderado', () => {
    // Parámetros clásicos Wilkinson
    const net = lotkaVolterra(1.0, 0.005, 0.6);
    // IC: 100 presa, 50 depredador
    const res = ssaRun(net, new Int32Array([100, 50]), 15, 0.1);
    const finals = res.samples[res.samples.length - 1];
    // Al menos una de las dos especies debe seguir viva
    expect(finals[0] + finals[1]).toBeGreaterThan(0);
  });

  it('ODE da mismas constantes dinámicas que SSA (promedio) a N alto', () => {
    // A alto N, ⟨x_SSA(t)⟩ ≈ x_ODE(t) para momentos en que el sistema
    // no se ha desincronizado (antes que la fase estocástica se disperse)
    const net = lotkaVolterra(1.0, 0.005, 0.6);
    const ode = odeRun(net, new Float64Array([400, 200]), 3, 0.01);
    const ssa = ssaRun(net, new Int32Array([400, 200]), 3, 0.1);
    // Comparar promedios en los primeros ~3 segundos (antes que se acumule
    // la desincronización de fase estocástica, que es O(1/√N·t))
    const t1ode = ode.samples[ode.samples.length - 1];
    const t1ssa = ssa.samples[ssa.samples.length - 1];
    // Sin calidad muy alta — solo que no estén a mil millas de distancia
    expect(Math.abs(t1ssa[0] - t1ode[0]) / Math.max(1, t1ode[0])).toBeLessThan(1.5);
    expect(Math.abs(t1ssa[1] - t1ode[1]) / Math.max(1, t1ode[1])).toBeLessThan(1.5);
  });
});

// ═══════════════════════════════════════════════════════════════
// Mass action derivative — consistencia
// ═══════════════════════════════════════════════════════════════

describe('massActionDerivative', () => {
  it('birth-death: dx/dt = α − β·x', () => {
    const net = birthDeath(10, 0.5);
    const dx = massActionDerivative(net, new Float64Array([6]));
    expect(dx[0]).toBeCloseTo(10 - 0.5 * 6, 10);   // 10 − 3 = 7
  });

  it('reacción A + B → C: dA/dt = -c·A·B', () => {
    const net = {
      speciesNames: ['A', 'B', 'C'],
      reactions: [{ reactants: [[0,1], [1,1]] as [number,number][], products: [[2,1]] as [number,number][], c: 2 }],
    };
    const dx = massActionDerivative(net, new Float64Array([3, 4, 0]));
    // rate = 2 · 3 · 4 = 24 → dA = -24, dB = -24, dC = +24
    expect(dx[0]).toBeCloseTo(-24, 10);
    expect(dx[1]).toBeCloseTo(-24, 10);
    expect(dx[2]).toBeCloseTo( 24, 10);
  });

  it('RK4 de A → B con c=1 decae exponencial', () => {
    const net = {
      speciesNames: ['A', 'B'],
      reactions: [{ reactants: [[0,1]] as [number,number][], products: [[1,1]] as [number,number][], c: 1 }],
    };
    const x = new Float64Array([100, 0]);
    for (let k = 0; k < 1000; k++) odeStep(net, x, 0.001);
    // Tras t=1: A = 100·e^-1 ≈ 36.79, B = 63.21
    expect(x[0]).toBeCloseTo(100 * Math.exp(-1), 2);
    expect(x[1]).toBeCloseTo(100 * (1 - Math.exp(-1)), 2);
  });
});
