/**
 * Tests del motor cinético: Arrhenius, leyes de velocidad, RK4, balance.
 *
 * Verificamos:
 *   - Correctitud matemática (vs. soluciones analíticas)
 *   - Conservación (átomos, no-negatividad)
 *   - Estabilidad numérica (sin NaN/Infinity)
 *   - Coherencia con termodinámica (equilibrio reversible)
 */
import { describe, it, expect } from 'vitest';
import {
  arrhenius,
  arrheniusExtended,
  rateOf,
  derivatives,
  rk4Step,
  simulate,
  atomBalance,
  keqFromGibbs,
  reactionToString,
  formatFormula,
  type ReactionStep,
  type Concentrations,
} from '../kinetics';
import { CONSTANTS } from '../elements';

// ═══════════════════════════════════════════════════════════════
// 1. ARRHENIUS
// ═══════════════════════════════════════════════════════════════

describe('arrhenius', () => {
  it('con Ea=0 devuelve A (cualquier T)', () => {
    expect(arrhenius(1e10, 0, 298)).toBeCloseTo(1e10, 0);
    expect(arrhenius(1e10, 0, 1000)).toBeCloseTo(1e10, 0);
  });

  it('k decrece cuando Ea crece (a T fija)', () => {
    const T = 300;
    const A = 1e12;
    const k1 = arrhenius(A, 50000, T);
    const k2 = arrhenius(A, 100000, T);
    expect(k1).toBeGreaterThan(k2);
  });

  it('k crece cuando T crece (Ea fija, positiva)', () => {
    const A = 1e12;
    const Ea = 80000;
    const k300 = arrhenius(A, Ea, 300);
    const k400 = arrhenius(A, Ea, 400);
    const k500 = arrhenius(A, Ea, 500);
    expect(k400).toBeGreaterThan(k300);
    expect(k500).toBeGreaterThan(k400);
  });

  it('valor conocido: k(298 K) con A=1e13, Ea=100000', () => {
    // k = 1e13 · exp(-100000/(8.314·298)) = 1e13 · exp(-40.363) ≈ 2.956e-5
    const k = arrhenius(1e13, 100000, 298);
    expect(k).toBeCloseTo(2.956e-5, 6);
  });

  it('regla de los 10 °C: k duplica/triplica por cada 10 K (rango biológico típico)', () => {
    // Para Ea≈50 kJ/mol alrededor de 298 K, k(T+10)/k(T) ≈ 1.9
    const A = 1e10, Ea = 50000;
    const ratio = arrhenius(A, Ea, 308) / arrhenius(A, Ea, 298);
    expect(ratio).toBeGreaterThan(1.5);
    expect(ratio).toBeLessThan(3.0);
  });

  it('arrheniusExtended con n=0 coincide con arrhenius', () => {
    const A = 1e10, Ea = 60000, T = 350;
    expect(arrheniusExtended(A, 0, Ea, T)).toBeCloseTo(arrhenius(A, Ea, T), 5);
  });

  it('no produce NaN/Infinity en rango razonable', () => {
    for (const T of [100, 300, 500, 1000, 2000]) {
      for (const Ea of [1000, 50000, 200000]) {
        const k = arrhenius(1e10, Ea, T);
        expect(Number.isFinite(k)).toBe(true);
      }
    }
  });

  it('T → ∞ ⇒ k → A (error relativo <10⁻⁵)', () => {
    const A = 1e12;
    const k = arrhenius(A, 100000, 1e10);
    // tolerancia relativa: k/A debe estar a 5·10⁻⁶ de 1
    expect(k / A).toBeCloseTo(1, 5);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. RATE / DERIVATIVES
// ═══════════════════════════════════════════════════════════════

function firstOrder(A: number, Ea: number): ReactionStep {
  return {
    reactants: [{ species: 'A', nu: 1, order: 1 }],
    products: [{ species: 'P', nu: 1 }],
    A,
    Ea,
  };
}

function secondOrderSingle(A: number, Ea: number): ReactionStep {
  // 2A → P, rate = k·[A]²
  return {
    reactants: [{ species: 'A', nu: 2, order: 2 }],
    products: [{ species: 'P', nu: 1 }],
    A,
    Ea,
  };
}

function bimolecular(A: number, Ea: number): ReactionStep {
  // A + B → P, rate = k·[A]·[B]
  return {
    reactants: [
      { species: 'A', nu: 1, order: 1 },
      { species: 'B', nu: 1, order: 1 },
    ],
    products: [{ species: 'P', nu: 1 }],
    A,
    Ea,
  };
}

describe('rateOf', () => {
  it('orden 1: r = k·[A]', () => {
    const step = firstOrder(1e10, 50000);
    const T = 300;
    const k = arrhenius(1e10, 50000, T);
    expect(rateOf(step, T, { A: 2, P: 0 })).toBeCloseTo(k * 2, 5);
  });

  it('orden 2 (2A): r = k·[A]²', () => {
    const step = secondOrderSingle(1e9, 40000);
    const T = 350;
    const k = arrhenius(1e9, 40000, T);
    expect(rateOf(step, T, { A: 3, P: 0 })).toBeCloseTo(k * 9, 5);
  });

  it('bimolecular A+B: r = k·[A]·[B]', () => {
    const step = bimolecular(1e8, 30000);
    const T = 400;
    const k = arrhenius(1e8, 30000, T);
    expect(rateOf(step, T, { A: 2, B: 5, P: 0 })).toBeCloseTo(k * 10, 5);
  });

  it('concentración negativa se clampa a 0 (no NaN)', () => {
    const step = firstOrder(1e10, 50000);
    const r = rateOf(step, 300, { A: -1, P: 0 });
    expect(r).toBe(0);
  });

  it('especie faltante en C → rate=0 (tratada como 0)', () => {
    const step = firstOrder(1e10, 50000);
    const r = rateOf(step, 300, { P: 0 } as Concentrations);
    expect(r).toBe(0);
  });

  it('reversible: en equilibrio r=0 cuando [P]/[A] = Keq aparente', () => {
    const step: ReactionStep = {
      reactants: [{ species: 'A', nu: 1, order: 1 }],
      products: [{ species: 'B', nu: 1, order: 1 }],
      A: 1e10, Ea: 50000,
      reversible: true,
      A_rev: 1e10, Ea_rev: 50000, // simétrica → Keq=1
    };
    const r = rateOf(step, 300, { A: 0.5, B: 0.5 });
    expect(Math.abs(r)).toBeLessThan(1e-10);
  });

  it('reversible: r > 0 cuando hay más reactante que producto (Keq=1)', () => {
    const step: ReactionStep = {
      reactants: [{ species: 'A', nu: 1, order: 1 }],
      products: [{ species: 'B', nu: 1, order: 1 }],
      A: 1e10, Ea: 50000,
      reversible: true,
      A_rev: 1e10, Ea_rev: 50000,
    };
    expect(rateOf(step, 300, { A: 1, B: 0 })).toBeGreaterThan(0);
    expect(rateOf(step, 300, { A: 0, B: 1 })).toBeLessThan(0);
  });
});

describe('derivatives', () => {
  it('un paso: reactante cae a la misma tasa que producto crece (ν=1)', () => {
    const step = firstOrder(1e10, 50000);
    const d = derivatives([step], 300, { A: 1, P: 0 });
    expect(d.A).toBeCloseTo(-d.P, 8);
  });

  it('estequiometría 2A → P: dA/dt = -2·r, dP/dt = +r', () => {
    const step = secondOrderSingle(1e9, 40000);
    const T = 350;
    const k = arrhenius(1e9, 40000, T);
    const C = { A: 1, P: 0 };
    const d = derivatives([step], T, C);
    expect(d.A).toBeCloseTo(-2 * k * 1, 5);
    expect(d.P).toBeCloseTo(+1 * k * 1, 5);
  });

  it('múltiples pasos: contribuciones se suman', () => {
    const step1 = firstOrder(1e10, 50000); // A → P
    const step2: ReactionStep = {
      reactants: [{ species: 'A', nu: 1, order: 1 }],
      products: [{ species: 'Q', nu: 1 }],
      A: 2e10, Ea: 50000,
    }; // A → Q
    const d = derivatives([step1, step2], 300, { A: 1, P: 0, Q: 0 });
    // dA = -(r1 + r2)
    expect(d.A).toBeCloseTo(-(d.P + d.Q), 8);
    expect(d.P).toBeGreaterThan(0);
    expect(d.Q).toBeGreaterThan(0);
  });

  it('inicializa especies faltantes en dC con 0', () => {
    const step = firstOrder(1e10, 50000);
    const d = derivatives([step], 300, { A: 1, P: 0 });
    expect(d).toHaveProperty('A');
    expect(d).toHaveProperty('P');
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. RK4 — integrador
// ═══════════════════════════════════════════════════════════════

describe('rk4Step', () => {
  it('orden 1 A → P: solución analítica C(t) = C0·exp(-kt)', () => {
    // Caso sin Ea (k=A constante) para aislar al solver
    const step = firstOrder(0.1, 0); // k = 0.1 s⁻¹
    const T = 300;
    const C0 = 1;
    const dt = 0.01;
    const nSteps = 1000; // t_final = 10 s
    let C: Concentrations = { A: C0, P: 0 };
    for (let i = 0; i < nSteps; i++) {
      C = rk4Step([step], T, C, dt);
    }
    const expected = C0 * Math.exp(-0.1 * 10); // ≈ 0.3679
    expect(C.A).toBeCloseTo(expected, 4);
    // Conservación: A + P = C0
    expect(C.A + C.P).toBeCloseTo(C0, 4);
  });

  it('orden 2 2A → P: solución analítica 1/[A](t) = 1/[A]₀ + 2kt', () => {
    // Para dA/dt = -2k·A², solución es 1/A = 1/A0 + 2kt
    const step = secondOrderSingle(0.5, 0); // k = 0.5 M⁻¹s⁻¹
    const C0 = 1;
    const dt = 0.001;
    const nSteps = 10000; // t_final = 10 s
    let C: Concentrations = { A: C0, P: 0 };
    for (let i = 0; i < nSteps; i++) {
      C = rk4Step([step], 300, C, dt);
    }
    // 1/A(10) = 1/1 + 2·0.5·10 = 11 → A(10) = 1/11 ≈ 0.0909
    expect(C.A).toBeCloseTo(1 / 11, 3);
  });

  it('nunca produce concentraciones negativas (clamping)', () => {
    // Paso enorme que intentaría llevar C a negativo
    const step = firstOrder(10, 0);
    let C: Concentrations = { A: 0.01, P: 0 };
    for (let i = 0; i < 100; i++) {
      C = rk4Step([step], 300, C, 10); // dt exagerado
      expect(C.A).toBeGreaterThanOrEqual(0);
      expect(C.P).toBeGreaterThanOrEqual(0);
    }
  });

  it('no produce NaN/Infinity en escenarios extremos', () => {
    const step = firstOrder(1e20, 0);
    let C: Concentrations = { A: 1e6, P: 0 };
    for (let i = 0; i < 50; i++) {
      C = rk4Step([step], 300, C, 0.001);
      for (const v of Object.values(C)) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('dt pequeño = mayor precisión (convergencia del método)', () => {
    const step = firstOrder(0.5, 0);
    const C0: Concentrations = { A: 1, P: 0 };
    const tFinal = 5;
    const runWith = (dt: number): number => {
      let C = { ...C0 };
      const n = Math.round(tFinal / dt);
      for (let i = 0; i < n; i++) C = rk4Step([step], 300, C, dt);
      return C.A;
    };
    const exact = Math.exp(-0.5 * 5); // ≈ 0.08208
    const errBig = Math.abs(runWith(0.5) - exact);
    const errSmall = Math.abs(runWith(0.01) - exact);
    expect(errSmall).toBeLessThan(errBig);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. SIMULATE — trayectoria completa
// ═══════════════════════════════════════════════════════════════

describe('simulate', () => {
  it('produce trayectoria de longitud N+1 con tiempos monótonos', () => {
    const step = firstOrder(0.1, 0);
    const traj = simulate([step], 300, { A: 1, P: 0 }, 0.1, 100);
    expect(traj.t).toHaveLength(101);
    expect(traj.C.A).toHaveLength(101);
    expect(traj.C.P).toHaveLength(101);
    for (let i = 1; i < traj.t.length; i++) {
      expect(traj.t[i]).toBeGreaterThan(traj.t[i - 1]);
    }
  });

  it('reactante decrece monótonamente (irreversible)', () => {
    const step = firstOrder(0.5, 0);
    const traj = simulate([step], 300, { A: 1, P: 0 }, 0.05, 200);
    for (let i = 1; i < traj.C.A.length; i++) {
      expect(traj.C.A[i]).toBeLessThanOrEqual(traj.C.A[i - 1] + 1e-12);
    }
  });

  it('producto crece monótonamente (irreversible)', () => {
    const step = firstOrder(0.5, 0);
    const traj = simulate([step], 300, { A: 1, P: 0 }, 0.05, 200);
    for (let i = 1; i < traj.C.P.length; i++) {
      expect(traj.C.P[i]).toBeGreaterThanOrEqual(traj.C.P[i - 1] - 1e-12);
    }
  });

  it('conservación de moles total (A + P = C0) a lo largo del tiempo', () => {
    const step = firstOrder(0.3, 0);
    const traj = simulate([step], 300, { A: 1, P: 0 }, 0.05, 100);
    for (let i = 0; i < traj.t.length; i++) {
      expect(traj.C.A[i] + traj.C.P[i]).toBeCloseTo(1.0, 5);
    }
  });

  it('equilibrio reversible tiende a Keq correcta (simétrica → 50/50)', () => {
    const step: ReactionStep = {
      reactants: [{ species: 'A', nu: 1, order: 1 }],
      products: [{ species: 'B', nu: 1, order: 1 }],
      A: 1.0, Ea: 0,
      reversible: true,
      A_rev: 1.0, Ea_rev: 0,
    };
    const traj = simulate([step], 300, { A: 1, B: 0 }, 0.1, 500);
    const last = traj.t.length - 1;
    expect(traj.C.A[last]).toBeCloseTo(0.5, 3);
    expect(traj.C.B[last]).toBeCloseTo(0.5, 3);
  });

  it('equilibrio reversible favorece productos cuando kf >> kr', () => {
    const step: ReactionStep = {
      reactants: [{ species: 'A', nu: 1, order: 1 }],
      products: [{ species: 'B', nu: 1, order: 1 }],
      A: 10, Ea: 0,
      reversible: true,
      A_rev: 0.1, Ea_rev: 0,
    };
    // Keq = kf/kr = 100 → [B]/[A] ≈ 100
    const traj = simulate([step], 300, { A: 1, B: 0 }, 0.01, 2000);
    const last = traj.t.length - 1;
    expect(traj.C.B[last] / traj.C.A[last]).toBeGreaterThan(50);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. BALANCE ATÓMICO
// ═══════════════════════════════════════════════════════════════

describe('atomBalance', () => {
  it('reacción balanceada devuelve {}', () => {
    const step: ReactionStep = {
      reactants: [
        { species: 'H2', nu: 2 },
        { species: 'O2', nu: 1 },
      ],
      products: [{ species: 'H2O', nu: 2 }],
      A: 1, Ea: 0,
    };
    expect(atomBalance(step)).toEqual({});
  });

  it('detecta desbalance H', () => {
    const step: ReactionStep = {
      reactants: [{ species: 'H2', nu: 1 }, { species: 'O2', nu: 1 }],
      products: [{ species: 'H2O', nu: 1 }],
      A: 1, Ea: 0,
    };
    // Reactivos: 2H + 2O; Productos: 2H + 1O → falta O
    const b = atomBalance(step);
    expect(b.O).toBeCloseTo(-1, 5); // 1O de menos en productos
  });

  it('reacción compleja balanceada: combustión metano', () => {
    // CH4 + 2 O2 → CO2 + 2 H2O
    const step: ReactionStep = {
      reactants: [{ species: 'CH4', nu: 1 }, { species: 'O2', nu: 2 }],
      products: [{ species: 'CO2', nu: 1 }, { species: 'H2O', nu: 2 }],
      A: 1, Ea: 0,
    };
    expect(atomBalance(step)).toEqual({});
  });

  it('balanceada Haber: N2 + 3H2 → 2NH3', () => {
    const step: ReactionStep = {
      reactants: [{ species: 'N2', nu: 1 }, { species: 'H2', nu: 3 }],
      products: [{ species: 'NH3', nu: 2 }],
      A: 1, Ea: 0,
    };
    expect(atomBalance(step)).toEqual({});
  });

  it('balanceada N₂O₅: 2 N₂O₅ → 4 NO₂ + O₂', () => {
    const step: ReactionStep = {
      reactants: [{ species: 'N2O5', nu: 2 }],
      products: [{ species: 'NO2', nu: 4 }, { species: 'O2', nu: 1 }],
      A: 1, Ea: 0,
    };
    expect(atomBalance(step)).toEqual({});
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. TERMODINÁMICA
// ═══════════════════════════════════════════════════════════════

describe('keqFromGibbs', () => {
  it('ΔG=0 → Keq=1', () => {
    expect(keqFromGibbs(0, 0, 298)).toBeCloseTo(1, 8);
  });

  it('ΔG<0 (exergónica) → Keq>1', () => {
    expect(keqFromGibbs(-10000, 0, 298)).toBeGreaterThan(1);
  });

  it('ΔG>0 (endergónica) → Keq<1', () => {
    expect(keqFromGibbs(10000, 0, 298)).toBeLessThan(1);
  });

  it('aumenta con T cuando ΔS>0', () => {
    const k1 = keqFromGibbs(10000, 50, 300);
    const k2 = keqFromGibbs(10000, 50, 500);
    expect(k2).toBeGreaterThan(k1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. FORMATEO
// ═══════════════════════════════════════════════════════════════

describe('formato', () => {
  it('reactionToString — irreversible usa →', () => {
    const step: ReactionStep = {
      reactants: [{ species: 'H2', nu: 2 }, { species: 'O2', nu: 1 }],
      products: [{ species: 'H2O', nu: 2 }],
      A: 1, Ea: 0,
    };
    expect(reactionToString(step)).toBe('2 H2 + O2 → 2 H2O');
  });

  it('reactionToString — reversible usa ⇌', () => {
    const step: ReactionStep = {
      reactants: [{ species: 'N2', nu: 1 }, { species: 'H2', nu: 3 }],
      products: [{ species: 'NH3', nu: 2 }],
      A: 1, Ea: 0,
      reversible: true, A_rev: 1, Ea_rev: 0,
    };
    expect(reactionToString(step)).toContain('⇌');
  });

  it('ν=1 omite el coeficiente', () => {
    const step: ReactionStep = {
      reactants: [{ species: 'HCl', nu: 1 }, { species: 'NaOH', nu: 1 }],
      products: [{ species: 'NaCl', nu: 1 }, { species: 'H2O', nu: 1 }],
      A: 1, Ea: 0,
    };
    const s = reactionToString(step);
    expect(s).toBe('HCl + NaOH → NaCl + H2O');
  });

  it('formatFormula convierte dígitos a subíndices unicode', () => {
    expect(formatFormula('H2O')).toBe('H₂O');
    expect(formatFormula('CO2')).toBe('CO₂');
    expect(formatFormula('C6H12O6')).toBe('C₆H₁₂O₆');
  });

  it('formatFormula no toca letras', () => {
    expect(formatFormula('NaCl')).toBe('NaCl');
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. CONSTANTES DEL SISTEMA
// ═══════════════════════════════════════════════════════════════

describe('interacción con CONSTANTS', () => {
  it('arrhenius usa la R = 8.314 importada de elements.ts', () => {
    // k = A · exp(-Ea/RT); verificar implícito
    const A = 1e13, Ea = 100000, T = 298;
    const k = arrhenius(A, Ea, T);
    const expected = A * Math.exp(-Ea / (CONSTANTS.R * T));
    expect(k).toBeCloseTo(expected, 10);
  });
});
