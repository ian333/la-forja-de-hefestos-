/**
 * Tests del balance energético acoplado a cinética.
 *
 * Benchmarks:
 *   - Elevación adiabática teórica vs. simulada
 *   - Isotérmico (UA=∞) debe reproducir batch aislado
 *   - Ecosistema exotérmico — T sube con tiempo
 *   - Runaway térmico detectable (demo)
 */
import { describe, it, expect } from 'vitest';
import {
  adiabaticTemperatureRise,
  totalHeatCapacity,
  simulateCoupled,
  CP_REF,
  type ThermalContext,
} from '../energy-balance';
import type { ReactionStep } from '../kinetics';

describe('totalHeatCapacity', () => {
  it('sistema puro H2O: C_total = V·C·Cp', () => {
    const ctx: ThermalContext = {
      species: { H2O: CP_REF.H2O },
      volume: 2,
      UA: 0,
      Tamb: 298,
    };
    const C = { H2O: 1.0 };
    const Ctot = totalHeatCapacity(C, ctx, 298);
    // = 1 mol/L · 2 L · 33.58 J/(mol·K) = 67.16 J/K
    expect(Ctot).toBeCloseTo(67.16, 1);
  });

  it('suma lineal de contribuciones', () => {
    const ctx: ThermalContext = {
      species: { H2: { Cp: 30 }, O2: { Cp: 40 } },
      volume: 1,
      UA: 0,
      Tamb: 298,
    };
    const Ctot = totalHeatCapacity({ H2: 2, O2: 1 }, ctx, 298);
    // = 2·1·30 + 1·1·40 = 100 J/K
    expect(Ctot).toBe(100);
  });

  it('ignora especies sin datos térmicos', () => {
    const ctx: ThermalContext = {
      species: { H2: { Cp: 30 } },
      volume: 1,
      UA: 0,
      Tamb: 298,
    };
    const Ctot = totalHeatCapacity({ H2: 1, X: 100 }, ctx, 298);
    expect(Ctot).toBe(30);
  });
});

describe('adiabaticTemperatureRise', () => {
  it('exotérmica ΔH<0 → ΔT>0', () => {
    const ctx: ThermalContext = {
      species: { A: { Cp: 50 }, B: { Cp: 50 } },
      volume: 1,
      UA: 0,
      Tamb: 298,
    };
    const dT = adiabaticTemperatureRise(-100000, 1, { A: 1, B: 0 }, ctx);
    // dT = (-(-100000) · 1 · 1) / (50·1·1) = 2000 K (muy grande — pero matemáticamente correcto)
    expect(dT).toBeCloseTo(2000, 0);
  });

  it('endotérmica ΔH>0 → ΔT<0', () => {
    const ctx: ThermalContext = {
      species: { A: { Cp: 50 } },
      volume: 1,
      UA: 0,
      Tamb: 298,
    };
    const dT = adiabaticTemperatureRise(100000, 1, { A: 1 }, ctx);
    expect(dT).toBeLessThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Sistema acoplado — isotérmico ≈ adiabático con UA alto
// ═══════════════════════════════════════════════════════════════

describe('simulateCoupled — aislamiento vs. pérdida total', () => {
  const step: ReactionStep = {
    reactants: [{ species: 'A', nu: 1, order: 1 }],
    products: [{ species: 'B', nu: 1 }],
    A: 1e6,
    Ea: 50000,
    deltaH: -100000,
  };

  it('UA=∞ mantiene T ≈ T_amb (isotérmico)', () => {
    const ctx: ThermalContext = {
      species: { A: { Cp: 50 }, B: { Cp: 50 } },
      volume: 1,
      UA: 1e10,          // transferencia extrema
      Tamb: 400,
    };
    const traj = simulateCoupled(
      [step],
      { A: 1, B: 0 },
      400,
      ctx,
      100,
      { rtol: 1e-6 },
    );
    const last = traj.t.length - 1;
    expect(traj.T[last]).toBeCloseTo(400, 0);  // dentro de 0.5 K
  });

  it('UA=0 adiabático acumula calor: ΔT ≈ ΔT_ad (cuando reacción completa)', () => {
    const ctx: ThermalContext = {
      species: { A: { Cp: 100 }, B: { Cp: 100 } },
      volume: 1,
      UA: 0,
      Tamb: 400,  // no se usa con UA=0, pero por completitud
    };
    const T0 = 500;
    const C0 = { A: 1.0, B: 0 };
    const dTad = adiabaticTemperatureRise(step.deltaH!, C0.A, C0, ctx, T0);

    const traj = simulateCoupled([step], C0, T0, ctx, 20, { rtol: 1e-5 });
    const last = traj.t.length - 1;
    const Tfinal = traj.T[last];
    const Afinal = traj.C.A[last];

    // Cuando la reacción casi terminó, T ≈ T0 + ΔT_ad
    expect(Afinal).toBeLessThan(0.05);
    // Dentro de 2 K de ΔT_ad (el reactor aún podría estar reaccionando)
    expect(Math.abs(Tfinal - T0 - dTad)).toBeLessThan(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// Runaway térmico — demo cualitativa
// ═══════════════════════════════════════════════════════════════

describe('runaway térmico — ignición autosostenida', () => {
  it('reactor adiabático con Ea moderada muestra rápida aceleración', () => {
    const step: ReactionStep = {
      reactants: [{ species: 'A', nu: 1, order: 1 }],
      products: [{ species: 'B', nu: 1 }],
      A: 1e10,
      Ea: 100000,       // Ea grande — reacción lenta a T baja
      deltaH: -200000,  // muy exotérmica
    };
    const ctx: ThermalContext = {
      species: { A: { Cp: 50 }, B: { Cp: 50 } },
      volume: 1,
      UA: 0,
      Tamb: 500,
    };
    const traj = simulateCoupled([step], { A: 1, B: 0 }, 500, ctx, 1000, {
      rtol: 1e-6,
    });
    // Verificar que T se dispara en algún momento
    const Tmax = Math.max(...traj.T);
    expect(Tmax).toBeGreaterThan(1000);  // disparo >500 K por encima del inicial
    // Y que la integración no explote
    expect(traj.T.every(Number.isFinite)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Conservación de energía con reacción térmicamente neutra
// ═══════════════════════════════════════════════════════════════

describe('reacción térmicamente neutra ΔH=0 → T constante', () => {
  it('T no cambia si ΔH=0 y UA=0', () => {
    const step: ReactionStep = {
      reactants: [{ species: 'A', nu: 1, order: 1 }],
      products: [{ species: 'B', nu: 1 }],
      A: 1000,
      Ea: 0,
      deltaH: 0,
    };
    const ctx: ThermalContext = {
      species: { A: { Cp: 50 }, B: { Cp: 50 } },
      volume: 1,
      UA: 0,
      Tamb: 300,
    };
    const traj = simulateCoupled([step], { A: 1, B: 0 }, 350, ctx, 1, {
      rtol: 1e-8,
    });
    for (const T of traj.T) {
      expect(T).toBeCloseTo(350, 5);
    }
  });
});
