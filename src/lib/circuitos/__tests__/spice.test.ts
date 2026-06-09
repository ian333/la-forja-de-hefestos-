import { describe, it, expect } from 'vitest';
import {
  solveLinear,
  dcOperatingPoint,
  transient,
  waveAt,
  type Circuit,
} from '../spice';

// ── Solver lineal ───────────────────────────────────────────────────────

describe('solveLinear', () => {
  it('resuelve un sistema 2×2 conocido', () => {
    // 2x + y = 5 ; x + 3y = 10  →  x=1, y=3
    const x = solveLinear([[2, 1], [1, 3]], [5, 10]);
    expect(x).not.toBeNull();
    expect(x![0]).toBeCloseTo(1, 9);
    expect(x![1]).toBeCloseTo(3, 9);
  });

  it('devuelve null si la matriz es singular', () => {
    expect(solveLinear([[1, 1], [1, 1]], [2, 2])).toBeNull();
  });
});

// ── Leyes de Ohm/Kirchhoff en DC ────────────────────────────────────────

describe('DC — divisor de voltaje', () => {
  it('R1=R2 → el punto medio está a la mitad', () => {
    // V(10) en nodo1; R1 nodo1→nodo2; R2 nodo2→tierra
    const c: Circuit = {
      nodeCount: 2,
      elements: [
        { kind: 'V', id: 'V1', a: 1, b: 0, value: 10 },
        { kind: 'R', id: 'R1', a: 1, b: 2, value: 1000 },
        { kind: 'R', id: 'R2', a: 2, b: 0, value: 1000 },
      ],
    };
    const op = dcOperatingPoint(c)!;
    expect(op.v[1]).toBeCloseTo(10, 9);
    expect(op.v[2]).toBeCloseTo(5, 9);
    // corriente de la fuente = 10 / (1k+1k) = 5 mA (entra por -, signo MNA)
    expect(Math.abs(op.vsrcI.get('V1')!)).toBeCloseTo(0.005, 9);
  });

  it('divisor asimétrico R1=1k, R2=3k → V2 = 10·3/4 = 7.5', () => {
    const c: Circuit = {
      nodeCount: 2,
      elements: [
        { kind: 'V', id: 'V1', a: 1, b: 0, value: 10 },
        { kind: 'R', id: 'R1', a: 1, b: 2, value: 1000 },
        { kind: 'R', id: 'R2', a: 2, b: 0, value: 3000 },
      ],
    };
    const op = dcOperatingPoint(c)!;
    expect(op.v[2]).toBeCloseTo(7.5, 9);
  });
});

describe('DC — fuente de corriente', () => {
  it('I inyectada en un resistor a tierra: v = I·R', () => {
    const c: Circuit = {
      nodeCount: 1,
      elements: [
        { kind: 'I', id: 'I1', a: 1, b: 0, value: 0.002 }, // 2 mA en nodo1
        { kind: 'R', id: 'R1', a: 1, b: 0, value: 2200 },
      ],
    };
    const op = dcOperatingPoint(c)!;
    expect(op.v[1]).toBeCloseTo(0.002 * 2200, 9); // 4.4 V
  });
});

describe('DC — puente de Wheatstone balanceado', () => {
  it('puente balanceado → 0 V en la diagonal', () => {
    // Vin nodo1. Rama izq: R1(1→2), R3(2→0). Rama der: R2(1→3), R4(3→0).
    // Balance: R1/R3 = R2/R4 → V2 = V3.
    const c: Circuit = {
      nodeCount: 3,
      elements: [
        { kind: 'V', id: 'V1', a: 1, b: 0, value: 5 },
        { kind: 'R', id: 'R1', a: 1, b: 2, value: 1000 },
        { kind: 'R', id: 'R3', a: 2, b: 0, value: 1000 },
        { kind: 'R', id: 'R2', a: 1, b: 3, value: 2200 },
        { kind: 'R', id: 'R4', a: 3, b: 0, value: 2200 },
      ],
    };
    const op = dcOperatingPoint(c)!;
    expect(op.v[2] - op.v[3]).toBeCloseTo(0, 9);
  });
});

// ── Transitorio: RC, RL, RLC ────────────────────────────────────────────

describe('Transitorio — carga RC', () => {
  it('V_C(τ) ≈ 0.6321·V con τ = RC', () => {
    const R = 1000, C = 1e-6; // τ = 1 ms
    const tau = R * C;
    const c: Circuit = {
      nodeCount: 2,
      elements: [
        { kind: 'V', id: 'V1', a: 1, b: 0, value: 1 },
        { kind: 'R', id: 'R1', a: 1, b: 2, value: R },
        { kind: 'C', id: 'C1', a: 2, b: 0, value: C }, // arranca descargado
      ],
    };
    const res = transient(c, { dt: tau / 2000, tStop: 6 * tau });
    // valor en t = τ
    const idx = res.t.findIndex((t) => t >= tau);
    const vC = res.v[idx][2];
    expect(vC).toBeCloseTo(1 - Math.exp(-1), 3); // 0.6321
    // a 6τ ya saturó (e^-6 ≈ 0.0025 < 0.005)
    expect(res.v[res.v.length - 1][2]).toBeCloseTo(1, 2);
  });

  it('sigue la exponencial en varios puntos', () => {
    const R = 470, C = 2.2e-6;
    const tau = R * C;
    const c: Circuit = {
      nodeCount: 2,
      elements: [
        { kind: 'V', id: 'V1', a: 1, b: 0, value: 5 },
        { kind: 'R', id: 'R1', a: 1, b: 2, value: R },
        { kind: 'C', id: 'C1', a: 2, b: 0, value: C },
      ],
    };
    const res = transient(c, { dt: tau / 4000, tStop: 4 * tau });
    for (const frac of [0.5, 1, 2, 3]) {
      const tt = frac * tau;
      const idx = res.t.findIndex((t) => t >= tt);
      const expected = 5 * (1 - Math.exp(-tt / tau));
      expect(res.v[idx][2]).toBeCloseTo(expected, 2);
    }
  });
});

describe('Transitorio — crecimiento RL', () => {
  it('i_L(τ) ≈ 0.6321·(V/R) con τ = L/R', () => {
    const V = 10, R = 100, L = 0.1; // τ = L/R = 1 ms, i_final = 0.1 A
    const tau = L / R;
    const c: Circuit = {
      nodeCount: 2,
      elements: [
        { kind: 'V', id: 'V1', a: 1, b: 0, value: V },
        { kind: 'R', id: 'R1', a: 1, b: 2, value: R },
        { kind: 'L', id: 'L1', a: 2, b: 0, value: L },
      ],
    };
    const res = transient(c, { dt: tau / 2000, tStop: 5 * tau, probeCurrents: ['L1'] });
    const idx = res.t.findIndex((t) => t >= tau);
    const iL = res.current['L1'][idx];
    expect(iL).toBeCloseTo((V / R) * (1 - Math.exp(-1)), 3); // 0.0632 A
    expect(res.current['L1'][res.current['L1'].length - 1]).toBeCloseTo(V / R, 2); // 0.1 A
  });
});

describe('Transitorio — tanque LC (frecuencia natural)', () => {
  it('oscila a ω₀ = 1/√(LC)', () => {
    const L = 1e-3, C = 1e-6; // ω₀ = 31623 rad/s, T = 1.987e-4 s
    const omega0 = 1 / Math.sqrt(L * C);
    const quarterT = (Math.PI / 2) / omega0; // primer cruce por cero desde el máximo
    // Cap cargado a 1 V en paralelo con L. v_C(t) = cos(ω₀ t).
    const c: Circuit = {
      nodeCount: 1,
      elements: [
        { kind: 'C', id: 'C1', a: 1, b: 0, value: C, ic: 1 },
        { kind: 'L', id: 'L1', a: 1, b: 0, value: L },
      ],
    };
    // init: cap a 1 V, sin corriente en L
    const init = {
      t: 0,
      v: [0, 1],
      vsrcI: new Map<string, number>(),
      hist: new Map([
        ['C1', { v: 1, i: 0 }],
        ['L1', { v: 1, i: 0 }],
      ]),
    };
    const res = transient(c, { dt: quarterT / 500, tStop: quarterT * 1.5, init });
    // primer cruce por cero de v[1]
    let tzc = -1;
    for (let k = 1; k < res.v.length; k++) {
      if (res.v[k - 1][1] > 0 && res.v[k][1] <= 0) { tzc = res.t[k]; break; }
    }
    expect(tzc).toBeGreaterThan(0);
    expect(tzc).toBeCloseTo(quarterT, 5); // dentro de ~1e-5 s
  });
});

// ── No lineal: diodo ────────────────────────────────────────────────────

describe('DC — diodo (Shockley + Newton)', () => {
  it('en directa cae ~0.6–0.7 V', () => {
    // V(5) → R(1k) → diodo a tierra (ánodo nodo2, cátodo tierra)
    const c: Circuit = {
      nodeCount: 2,
      elements: [
        { kind: 'V', id: 'V1', a: 1, b: 0, value: 5 },
        { kind: 'R', id: 'R1', a: 1, b: 2, value: 1000 },
        { kind: 'D', id: 'D1', a: 2, b: 0 },
      ],
    };
    const op = dcOperatingPoint(c)!;
    expect(op.v[2]).toBeGreaterThan(0.55);
    expect(op.v[2]).toBeLessThan(0.75);
    // la corriente cuadra con (5 − Vd)/R
    const iExpected = (5 - op.v[2]) / 1000;
    expect(iExpected).toBeGreaterThan(0.004);
  });

  it('en inversa bloquea (corriente despreciable, casi toda la tensión cae en el diodo)', () => {
    // diodo al revés: cátodo en nodo2, ánodo a tierra → inversamente polarizado
    const c: Circuit = {
      nodeCount: 2,
      elements: [
        { kind: 'V', id: 'V1', a: 1, b: 0, value: 5 },
        { kind: 'R', id: 'R1', a: 1, b: 2, value: 1000 },
        { kind: 'D', id: 'D1', a: 0, b: 2 },
      ],
    };
    const op = dcOperatingPoint(c)!;
    // casi no cae tensión en R → nodo2 ≈ 5 V
    expect(op.v[2]).toBeGreaterThan(4.9);
  });
});

// ── Formas de onda ──────────────────────────────────────────────────────

describe('waveAt', () => {
  it('seno', () => {
    const w = { type: 'sine', amp: 2, freq: 1 } as const;
    expect(waveAt(w, 0)).toBeCloseTo(0, 9);
    expect(waveAt(w, 0.25)).toBeCloseTo(2, 9); // cuarto de periodo
  });
  it('pulso 50% duty', () => {
    const w = { type: 'pulse', lo: 0, hi: 3.3, period: 1 } as const;
    expect(waveAt(w, 0.1)).toBe(3.3);
    expect(waveAt(w, 0.6)).toBe(0);
  });
  it('escalón', () => {
    const w = { type: 'step', lo: 0, hi: 1, at: 1 } as const;
    expect(waveAt(w, 0.5)).toBe(0);
    expect(waveAt(w, 1.5)).toBe(1);
  });
});
