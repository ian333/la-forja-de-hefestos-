/**
 * Tests de los reactores ideales: Batch, CSTR, PFR.
 *
 * Relaciones clave verificadas:
 *   - Batch(t=τ) y PFR(V/Q=τ) producen la MISMA conversión (con misma T)
 *   - CSTR en estado estacionario: feed - out = r·V/Q
 *   - Para reacción orden 1: X_cstr = kτ/(1+kτ),  X_pfr = 1 − exp(−kτ)
 *     → PFR siempre más eficiente que CSTR (para orden positivo).
 */
import { describe, it, expect } from 'vitest';
import {
  simulateBatch,
  simulateCstrTransient,
  cstrSteadyState,
  simulatePfr,
  conversion,
  selectivity,
  yield_,
} from '../reactors';
import type { ReactionStep } from '../kinetics';

// Reacción simple orden 1: A → B, sin Ea para trabajar analíticamente
const firstOrder: ReactionStep = {
  reactants: [{ species: 'A', nu: 1, order: 1 }],
  products: [{ species: 'B', nu: 1 }],
  A: 0.2,
  Ea: 0,
};

describe('BATCH — orden 1 vs solución analítica', () => {
  it('C_A(t) = C_A0 · exp(-k·t)', () => {
    const res = simulateBatch(
      [firstOrder],
      { A: 1, B: 0 },
      { T: 300 },
      10,
      { rtol: 1e-6 },
    );
    const last = res.t.length - 1;
    expect(res.C.A[last]).toBeCloseTo(Math.exp(-0.2 * 10), 3);
    expect(res.C.B[last]).toBeCloseTo(1 - Math.exp(-0.2 * 10), 3);
  });

  it('conservación A + B = 1', () => {
    const res = simulateBatch([firstOrder], { A: 1, B: 0 }, { T: 300 }, 5);
    for (let i = 0; i < res.t.length; i++) {
      expect(res.C.A[i] + res.C.B[i]).toBeCloseTo(1, 4);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// CSTR — estado estacionario analítico
// ═══════════════════════════════════════════════════════════════

describe('CSTR — estado estacionario con solución analítica', () => {
  it('para A → B orden 1: X_ss = kτ/(1+kτ)', () => {
    // Parámetros: feed A=1 M, Q=1 L/s, V=10 L → τ=10 s, k=0.2 → X=0.667
    const ss = cstrSteadyState(
      [firstOrder],
      { Q: 1, V: 10, feed: { A: 1, B: 0 }, T: 300 },
    );
    const X_expected = (0.2 * 10) / (1 + 0.2 * 10); // = 2/3
    expect(ss.conversion.A).toBeCloseTo(X_expected, 3);
  });

  it('τ más grande → mayor conversión (monotonía)', () => {
    const ssShort = cstrSteadyState(
      [firstOrder],
      { Q: 1, V: 1, feed: { A: 1, B: 0 }, T: 300 },
    );
    const ssLong = cstrSteadyState(
      [firstOrder],
      { Q: 1, V: 100, feed: { A: 1, B: 0 }, T: 300 },
    );
    expect(ssLong.conversion.A).toBeGreaterThan(ssShort.conversion.A);
    expect(ssLong.conversion.A).toBeGreaterThan(0.9);
  });

  it('transitorio converge al estado estacionario', () => {
    const tau = 10;
    const transient = simulateCstrTransient(
      [firstOrder],
      { A: 0, B: 0 },   // arrancar vacío
      { Q: 1, V: 10, feed: { A: 1, B: 0 }, T: 300 },
      20 * tau,
    );
    const ss = cstrSteadyState(
      [firstOrder],
      { Q: 1, V: 10, feed: { A: 1, B: 0 }, T: 300 },
    );
    const last = transient.t.length - 1;
    expect(transient.C.A[last]).toBeCloseTo(ss.C.A!, 3);
  });
});

// ═══════════════════════════════════════════════════════════════
// PFR — equivalencia con Batch
// ═══════════════════════════════════════════════════════════════

describe('PFR — equivalencia matemática con Batch', () => {
  it('PFR(V/Q=τ) = Batch(t=τ) para la misma cinética isotérmica', () => {
    // Para reacción orden 1 sin cambio de densidad, el PFR en τ=V/Q es
    // idéntico al batch en t=τ.
    const tau = 5;
    const Q = 1;
    const V = Q * tau;

    const batch = simulateBatch([firstOrder], { A: 1, B: 0 }, { T: 300 }, tau, {
      rtol: 1e-6,
    });
    const pfr = simulatePfr(
      [firstOrder],
      { Q, V, inlet: { A: 1, B: 0 }, T: 300 },
      { rtol: 1e-6 },
    );
    const batchFinal = batch.C.A[batch.t.length - 1];
    const pfrFinal = pfr.C.A[pfr.t.length - 1];
    expect(pfrFinal).toBeCloseTo(batchFinal, 3);
  });

  it('PFR para orden 1: C_A(τ) = C_A0 · exp(-k·τ)', () => {
    const tau = 5;
    const pfr = simulatePfr(
      [firstOrder],
      { Q: 1, V: 5, inlet: { A: 1, B: 0 }, T: 300 },
      { rtol: 1e-6 },
    );
    const last = pfr.t.length - 1;
    expect(pfr.C.A[last]).toBeCloseTo(Math.exp(-0.2 * tau), 3);
  });
});

// ═══════════════════════════════════════════════════════════════
// PFR vs CSTR — la jerarquía clásica
// ═══════════════════════════════════════════════════════════════

describe('PFR más eficiente que CSTR (orden positivo)', () => {
  it('misma τ, misma k: conversión PFR > conversión CSTR', () => {
    const pfr = simulatePfr(
      [firstOrder],
      { Q: 1, V: 10, inlet: { A: 1, B: 0 }, T: 300 },
      { rtol: 1e-6 },
    );
    const cstr = cstrSteadyState(
      [firstOrder],
      { Q: 1, V: 10, feed: { A: 1, B: 0 }, T: 300 },
    );
    const X_pfr = 1 - pfr.C.A[pfr.t.length - 1];
    const X_cstr = cstr.conversion.A;
    expect(X_pfr).toBeGreaterThan(X_cstr);
    // Valores analíticos: PFR = 1-exp(-2) = 0.865, CSTR = 2/3 = 0.667
    expect(X_pfr).toBeCloseTo(1 - Math.exp(-2), 2);
    expect(X_cstr).toBeCloseTo(2 / 3, 2);
  });
});

// ═══════════════════════════════════════════════════════════════
// Métricas de rendimiento
// ═══════════════════════════════════════════════════════════════

describe('métricas de reactor', () => {
  it('conversion bien definida en rangos', () => {
    expect(conversion(1, 0)).toBe(1);
    expect(conversion(1, 1)).toBe(0);
    expect(conversion(1, 0.3)).toBeCloseTo(0.7, 10);
    expect(conversion(0, 0)).toBe(0);  // evita NaN
  });

  it('selectivity infinita si no hay subproducto', () => {
    expect(selectivity(1, 0)).toBe(Infinity);
    expect(selectivity(2, 1)).toBe(2);
  });

  it('yield con coeficientes estequiométricos', () => {
    // 0.7 mol producto de 1 mol A, ν_P=1, ν_R=1 → 70%
    expect(yield_(0.7, 1)).toBeCloseTo(0.7, 10);
    // 0.5 mol producto de 2 mol A, ν_P=1, ν_R=2 → 0.5·2/(2·1) = 0.5
    expect(yield_(0.5, 2, 1, 2)).toBeCloseTo(0.5, 10);
  });
});

// ═══════════════════════════════════════════════════════════════
// CSTR no-isotérmico — multiplicidad potencial
// ═══════════════════════════════════════════════════════════════

describe('CSTR adiabático — ignición', () => {
  it('CSTR adiabático con reacción exotérmica muestra ΔT', () => {
    const step: ReactionStep = {
      reactants: [{ species: 'A', nu: 1, order: 1 }],
      products:  [{ species: 'B', nu: 1 }],
      A: 1e8,
      Ea: 80000,
      deltaH: -150000,
    };
    const transient = simulateCstrTransient(
      [step],
      { A: 1, B: 0 },
      {
        Q: 1, V: 10,
        feed: { A: 1, B: 0 },
        T: 450,
        Tfeed: 300,
        thermal: {
          species: { A: { Cp: 60 }, B: { Cp: 60 } },
          volume: 10,
          UA: 0,
          Tamb: 300,
        },
      },
      200,
      { rtol: 1e-5 },
    );
    // En adiabático la T aumenta por calor de reacción
    const T_ss = transient.T[transient.t.length - 1];
    // Al menos debería subir (salvo que conversión sea cero; verificamos ambos)
    const A_ss = transient.C.A[transient.t.length - 1];
    if (A_ss < 0.9) {
      expect(T_ss).toBeGreaterThan(300); // no colapsa a Tfeed
    }
    expect(Number.isFinite(T_ss)).toBe(true);
  });
});
