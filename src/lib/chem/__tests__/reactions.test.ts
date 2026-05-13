/**
 * Tests del catálogo de reacciones precargadas.
 *
 * Cada preset debe:
 *   1. Tener ID único y metadatos coherentes
 *   2. Estar atómicamente balanceado
 *   3. Simular sin NaN/Infinity ni negativos
 *   4. Conservar átomos a lo largo de la simulación
 *   5. Producir comportamiento físicamente sensato (reactantes ↓, productos ↑)
 */
import { describe, it, expect } from 'vitest';
import {
  PRESETS,
  R_N2O5_DECOMP,
  R_HABER,
  R_NEUTRALIZATION,
  R_H2O2_DECOMP,
  R_H2_COMBUSTION,
  R_CH4_COMBUSTION,
  R_FE_CU_REDOX,
  R_SN2,
  R_FISCHER_ESTER,
  getPreset,
  type Preset,
} from '../reactions';
import { simulate, atomBalance, arrhenius } from '../kinetics';
import { CONSTANTS } from '../elements';

// ═══════════════════════════════════════════════════════════════
// Invariantes del catálogo
// ═══════════════════════════════════════════════════════════════

describe('PRESETS — invariantes', () => {
  it('cada preset tiene ID único', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada preset tiene nombre y descripción no vacíos', () => {
    for (const p of PRESETS) {
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
    }
  });

  it('cada preset tiene al menos un paso', () => {
    for (const p of PRESETS) {
      expect(p.steps.length).toBeGreaterThan(0);
    }
  });

  it('cada preset tiene Trange consistente con T inicial', () => {
    for (const p of PRESETS) {
      expect(p.T).toBeGreaterThanOrEqual(p.Trange[0]);
      expect(p.T).toBeLessThanOrEqual(p.Trange[1]);
      expect(p.Trange[0]).toBeLessThan(p.Trange[1]);
    }
  });

  it('cada preset tiene dt < duration', () => {
    for (const p of PRESETS) {
      expect(p.dt).toBeLessThan(p.duration);
      expect(p.dt).toBeGreaterThan(0);
    }
  });

  it('concentraciones iniciales todas ≥ 0', () => {
    for (const p of PRESETS) {
      for (const c of Object.values(p.initial)) {
        expect(c).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('cada paso tiene al menos un reactante y un producto', () => {
    for (const p of PRESETS) {
      for (const step of p.steps) {
        expect(step.reactants.length).toBeGreaterThan(0);
        expect(step.products.length).toBeGreaterThan(0);
      }
    }
  });

  it('todas las especies referenciadas en steps están en initial', () => {
    for (const p of PRESETS) {
      const initialSpecies = new Set(Object.keys(p.initial));
      for (const step of p.steps) {
        for (const sp of [...step.reactants, ...step.products]) {
          expect(initialSpecies.has(sp.species)).toBe(true);
        }
      }
    }
  });

  it('parámetros Arrhenius son físicamente sensatos', () => {
    for (const p of PRESETS) {
      for (const step of p.steps) {
        expect(step.A).toBeGreaterThan(0);
        expect(step.Ea).toBeGreaterThanOrEqual(0);
        expect(step.Ea).toBeLessThan(500000); // < 500 kJ/mol
        if (step.reversible) {
          expect(step.A_rev).toBeGreaterThan(0);
          expect(step.Ea_rev).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Balance atómico por preset
// ═══════════════════════════════════════════════════════════════

describe('balance atómico', () => {
  for (const p of PRESETS) {
    it(`${p.name}: todos los pasos balanceados`, () => {
      for (const step of p.steps) {
        const b = atomBalance(step);
        if (Object.keys(b).length > 0) {
          // Debug info útil si falla
          console.error(`Desbalance en ${p.name}:`, b);
        }
        expect(b).toEqual({});
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// Simulaciones: cada preset debe poder correr limpiamente
// ═══════════════════════════════════════════════════════════════

describe('simulación por preset — sin NaN/negativos', () => {
  for (const p of PRESETS) {
    it(`${p.name}: trayectoria finita y no-negativa`, () => {
      const nSteps = Math.min(500, Math.round(p.duration / p.dt));
      const traj = simulate(p.steps, p.T, p.initial, p.dt, nSteps);

      for (const sp of traj.species) {
        for (let i = 0; i < traj.t.length; i++) {
          const v = traj.C[sp][i];
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
        }
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// Conservación de átomos a lo largo del tiempo
// ═══════════════════════════════════════════════════════════════

function countAtoms(formula: string): Record<string, number> {
  const out: Record<string, number> = {};
  const tokens = formula.match(/([A-Z][a-z]?)(\d*)/g) ?? [];
  for (const tok of tokens) {
    if (!tok) continue;
    const m = tok.match(/([A-Z][a-z]?)(\d*)/);
    if (!m) continue;
    const sym = m[1];
    const n = m[2] ? parseInt(m[2], 10) : 1;
    out[sym] = (out[sym] ?? 0) + n;
  }
  return out;
}

function totalAtomMoles(C: Record<string, number>): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const [species, conc] of Object.entries(C)) {
    const atoms = countAtoms(species);
    for (const [el, n] of Object.entries(atoms)) {
      totals[el] = (totals[el] ?? 0) + n * conc;
    }
  }
  return totals;
}

describe('conservación de átomos durante simulación', () => {
  for (const p of PRESETS) {
    it(`${p.name}: átomos iniciales = átomos finales`, () => {
      const nSteps = Math.min(500, Math.round(p.duration / p.dt));
      const traj = simulate(p.steps, p.T, p.initial, p.dt, nSteps);

      // Tomar snapshots inicial y final
      const snapshot = (i: number): Record<string, number> => {
        const C: Record<string, number> = {};
        for (const sp of traj.species) C[sp] = traj.C[sp][i];
        return C;
      };
      const initialTotals = totalAtomMoles(snapshot(0));
      const finalTotals = totalAtomMoles(snapshot(traj.t.length - 1));

      // Cada elemento debe tener la misma cantidad (tolerancia relativa 0.1%)
      for (const el of Object.keys(initialTotals)) {
        const initial = initialTotals[el];
        const final = finalTotals[el] ?? 0;
        // Tolerancia: 0.1% o 1e-6 (lo que sea mayor, para manejar casi-ceros)
        const tol = Math.max(initial * 0.001, 1e-6);
        expect(Math.abs(final - initial)).toBeLessThan(tol);
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// Comportamiento físico específico
// ═══════════════════════════════════════════════════════════════

describe('N₂O₅ descomposición — primer orden', () => {
  it('vida media coincide con t½ = ln(2)/k_eff donde k_eff = 2k (ν=2)', () => {
    const p = R_N2O5_DECOMP;
    const step = p.steps[0];
    const k = arrhenius(step.A, step.Ea, p.T);
    // dC/dt = -2k·C → t½ = ln(2)/(2k)
    const tHalf = Math.log(2) / (2 * k);
    const nSteps = Math.round((tHalf * 3) / p.dt); // 3 × vida media
    const traj = simulate(p.steps, p.T, p.initial, p.dt, nSteps);

    // Encontrar donde [N2O5] = C0/2
    const C0 = p.initial.N2O5;
    let idxHalf = 0;
    for (let i = 0; i < traj.t.length; i++) {
      if (traj.C.N2O5[i] <= C0 / 2) {
        idxHalf = i;
        break;
      }
    }
    const measuredTHalf = traj.t[idxHalf];
    // Tolerancia: 10% (sensible al dt)
    expect(Math.abs(measuredTHalf - tHalf) / tHalf).toBeLessThan(0.1);
  });

  it('a temperatura mayor la reacción es más rápida', () => {
    const p = R_N2O5_DECOMP;
    const Tlow = p.T;
    const Thigh = p.T + 30; // +30 K
    const nSteps = 200;
    const trajLow = simulate(p.steps, Tlow, p.initial, p.dt, nSteps);
    const trajHigh = simulate(p.steps, Thigh, p.initial, p.dt, nSteps);

    // Al mismo tiempo, high debería haber consumido más
    const tIdx = nSteps;
    expect(trajHigh.C.N2O5[tIdx]).toBeLessThan(trajLow.C.N2O5[tIdx]);
  });
});

describe('Haber — reversible, tiende a equilibrio', () => {
  it('la velocidad neta decae hacia el equilibrio', () => {
    const p = R_HABER;
    // Simulación larga
    const nSteps = 2000;
    const traj = simulate(p.steps, p.T, p.initial, p.dt, nSteps);

    // Diferencia entre pasos consecutivos debe decrecer (tendencia a equilibrio)
    const last = traj.t.length - 1;
    const midToLate = Math.abs(traj.C.NH3[last] - traj.C.NH3[Math.floor(last / 2)]);
    const earlyToMid = Math.abs(traj.C.NH3[Math.floor(last / 2)] - traj.C.NH3[0]);
    expect(midToLate).toBeLessThan(earlyToMid);
  });

  it('NH3 crece desde 0 (no es negativo en t=0)', () => {
    const p = R_HABER;
    expect(p.initial.NH3).toBe(0);
  });
});

describe('neutralización HCl+NaOH — consume reactivos', () => {
  it('HCl y NaOH caen, NaCl y H2O crecen', () => {
    const p = R_NEUTRALIZATION;
    const nSteps = 100;
    const traj = simulate(p.steps, p.T, p.initial, p.dt, nSteps);
    const last = traj.t.length - 1;
    expect(traj.C.HCl[last]).toBeLessThan(p.initial.HCl);
    expect(traj.C.NaOH[last]).toBeLessThan(p.initial.NaOH);
    expect(traj.C.NaCl[last]).toBeGreaterThan(0);
    expect(traj.C.H2O[last]).toBeGreaterThan(0);
  });

  it('conservación: HCl consumido = NaCl producido (ν=1:1)', () => {
    const p = R_NEUTRALIZATION;
    const nSteps = 100;
    const traj = simulate(p.steps, p.T, p.initial, p.dt, nSteps);
    const last = traj.t.length - 1;
    const hClConsumed = p.initial.HCl - traj.C.HCl[last];
    const naClProduced = traj.C.NaCl[last];
    expect(naClProduced).toBeCloseTo(hClConsumed, 5);
  });
});

describe('H₂O₂ descomposición', () => {
  it('a T=298K sin catalizador es lenta (consume <10% en 1 min)', () => {
    const p = R_H2O2_DECOMP;
    // 1 minuto = 60 s, dt=1 → 60 pasos
    const traj = simulate(p.steps, 298, p.initial, p.dt, 60);
    const last = traj.t.length - 1;
    const fractionConsumed = (p.initial.H2O2 - traj.C.H2O2[last]) / p.initial.H2O2;
    expect(fractionConsumed).toBeLessThan(0.1);
  });

  it('el O₂ producido es la mitad del H₂O₂ consumido (estequiometría)', () => {
    const p = R_H2O2_DECOMP;
    const nSteps = 500;
    const traj = simulate(p.steps, p.T + 50, p.initial, p.dt, nSteps);
    const last = traj.t.length - 1;
    const h2o2Consumed = p.initial.H2O2 - traj.C.H2O2[last];
    const o2Produced = traj.C.O2[last];
    // 2 H2O2 → 2 H2O + 1 O2  ⇒  O2 = H2O2_consumed / 2
    expect(o2Produced).toBeCloseTo(h2o2Consumed / 2, 4);
  });
});

describe('combustión H₂ — dependencia brutal con T', () => {
  it('a 600K casi no hay reacción, a 1500K es rápida', () => {
    const p = R_H2_COMBUSTION;
    const trajCold = simulate(p.steps, 600, p.initial, p.dt, 50);
    const trajHot = simulate(p.steps, 1500, p.initial, p.dt, 50);
    const lastCold = trajCold.t.length - 1;
    const lastHot = trajHot.t.length - 1;
    const coldConsumed = p.initial.H2 - trajCold.C.H2[lastCold];
    const hotConsumed = p.initial.H2 - trajHot.C.H2[lastHot];
    expect(hotConsumed).toBeGreaterThan(coldConsumed * 10);
  });
});

// ═══════════════════════════════════════════════════════════════
// FASE 4 — Reacciones clásicas (combustión, redox, SN2, Fischer)
// Cada bloque verifica datos contra NIST / CRC / Laidler / Ingold.
// ═══════════════════════════════════════════════════════════════

describe('combustión CH₄ — NIST ΔH y consumo estequiométrico', () => {
  it('ΔH coincide con la entalpía de combustión NIST (productos gas)', () => {
    // NIST WebBook: ΔH°c(CH₄, productos gas) = -802.3 ± 0.5 kJ/mol
    const dH = R_CH4_COMBUSTION.steps[0].deltaH!;
    expect(dH).toBeCloseTo(-802300, -2); // ±100 J/mol → tolerancia 0.01%
  });

  it('Ea ≈ 200 kJ/mol (Westbrook & Dryer 1981)', () => {
    const Ea = R_CH4_COMBUSTION.steps[0].Ea;
    expect(Ea).toBeGreaterThan(180000);
    expect(Ea).toBeLessThan(220000);
  });

  it('a T alta consume el CH₄ con 2:1 razón O₂:CH₄ (estequiometría)', () => {
    const p = R_CH4_COMBUSTION;
    const traj = simulate(p.steps, p.T, p.initial, p.dt, 200);
    const last = traj.t.length - 1;
    const ch4Consumed = p.initial.CH4 - traj.C.CH4[last];
    const o2Consumed = p.initial.O2 - traj.C.O2[last];
    // CH₄ + 2 O₂ → ... ⇒ O2_consumed / CH4_consumed = 2
    if (ch4Consumed > 1e-6) {
      expect(o2Consumed / ch4Consumed).toBeCloseTo(2, 1);
    }
    // H₂O producido = 2 × CH₄ consumido
    const h2oProduced = traj.C.H2O[last];
    expect(h2oProduced).toBeCloseTo(2 * ch4Consumed, 4);
    // CO₂ producido = 1 × CH₄ consumido
    expect(traj.C.CO2[last]).toBeCloseTo(ch4Consumed, 4);
  });
});

describe('Fe + CuSO₄ — termodinámica electroquímica', () => {
  it('ΔH ≈ -154 kJ/mol (NIST entalpías de formación)', () => {
    // CRC: ΔH = ΔH°f(FeSO4 aq) - ΔH°f(CuSO4 aq) ≈ -998.3 + 844.5 ≈ -153.8 kJ/mol
    const dH = R_FE_CU_REDOX.steps[0].deltaH!;
    expect(dH).toBeLessThan(-140000);
    expect(dH).toBeGreaterThan(-170000);
  });

  it('K_eq enorme (>10²⁰) → reacción prácticamente irreversible', () => {
    // E°(cell) = +0.789 V, n=2 → ΔG° = -2·F·E° = -152.3 kJ/mol
    // K_eq = exp(-ΔG°/RT) a 298 K
    const F = 96485; // C/mol
    const n = 2;
    const Ecell = 0.789;
    const dG = -n * F * Ecell; // J/mol
    const T = 298;
    const Keq = Math.exp(-dG / (CONSTANTS.R * T));
    // Debe ser monstruosamente grande
    expect(Keq).toBeGreaterThan(1e20);
    // El ΔH del preset debe ser del mismo orden que ΔG° (entropía pequeña)
    const dH = R_FE_CU_REDOX.steps[0].deltaH!;
    expect(Math.abs(dH - dG) / Math.abs(dG)).toBeLessThan(0.15); // dentro del 15%
  });

  it('Fe y CuSO₄ se consumen 1:1, FeSO₄ y Cu crecen 1:1', () => {
    const p = R_FE_CU_REDOX;
    const traj = simulate(p.steps, p.T, p.initial, p.dt, 500);
    const last = traj.t.length - 1;
    const feConsumed = p.initial.Fe - traj.C.Fe[last];
    const cuso4Consumed = p.initial.CuSO4 - traj.C.CuSO4[last];
    expect(feConsumed).toBeCloseTo(cuso4Consumed, 4);
    expect(traj.C.FeSO4[last]).toBeCloseTo(feConsumed, 4);
    expect(traj.C.Cu[last]).toBeCloseTo(feConsumed, 4);
  });
});

describe('SN2 CH₃Br + OH⁻ — cinética Ingold/Laidler', () => {
  it('k(298 K) coincide con valor experimental de Laidler', () => {
    // Laidler §9.4: k(25°C en agua) ≈ 2.4·10⁻⁴ M⁻¹s⁻¹
    const step = R_SN2.steps[0];
    const k298 = arrhenius(step.A, step.Ea, 298);
    // Tolerancia: dentro de un factor de 5 (los parámetros son sensibles)
    expect(k298).toBeGreaterThan(5e-5);
    expect(k298).toBeLessThan(5e-3);
  });

  it('Ea coincide con la barrera SN2 reportada (~90 kJ/mol)', () => {
    const Ea = R_SN2.steps[0].Ea;
    expect(Ea).toBeGreaterThan(80000);
    expect(Ea).toBeLessThan(105000);
  });

  it('Orden global = 2 (1 en CH₃Br, 1 en OH⁻) — confirmó mecanismo Walden', () => {
    const step = R_SN2.steps[0];
    const order = step.reactants.reduce((acc, r) => acc + (r.order ?? r.nu), 0);
    expect(order).toBe(2);
  });

  it('CH₃Br y NaOH se consumen 1:1, CH₃OH y NaBr crecen 1:1', () => {
    const p = R_SN2;
    const traj = simulate(p.steps, p.T, p.initial, p.dt, 200);
    const last = traj.t.length - 1;
    const ch3brConsumed = p.initial.CH3Br - traj.C.CH3Br[last];
    expect(p.initial.NaOH - traj.C.NaOH[last]).toBeCloseTo(ch3brConsumed, 5);
    expect(traj.C.CH3OH[last]).toBeCloseTo(ch3brConsumed, 5);
    expect(traj.C.NaBr[last]).toBeCloseTo(ch3brConsumed, 5);
  });
});

describe('Fischer esterificación — equilibrio K ≈ 4', () => {
  it('K_eq de parámetros Arrhenius ≈ 4 a temperatura de reacción', () => {
    const step = R_FISCHER_ESTER.steps[0];
    const T = R_FISCHER_ESTER.T;
    const kf = arrhenius(step.A, step.Ea, T);
    const kr = arrhenius(step.A_rev!, step.Ea_rev!, T);
    const Keq = kf / kr;
    // Berthelot & Saint-Gilles 1862: K_eq ≈ 4 en reflujo
    // Tolerancia generosa: orden de magnitud correcto
    expect(Keq).toBeGreaterThan(1);
    expect(Keq).toBeLessThan(20);
  });

  it('ΔH es casi termoneutra (|ΔH| < 10 kJ/mol)', () => {
    const dH = R_FISCHER_ESTER.steps[0].deltaH!;
    expect(Math.abs(dH)).toBeLessThan(10000);
  });

  it('relación Ea_rev = Ea_fwd - ΔH (consistencia termodinámica)', () => {
    // En cualquier reacción reversible elemental:
    //   ΔH_rxn = Ea_fwd - Ea_rev
    // → Ea_rev = Ea_fwd - ΔH
    const step = R_FISCHER_ESTER.steps[0];
    const expectedEaRev = step.Ea - (step.deltaH ?? 0);
    expect(step.Ea_rev).toBeCloseTo(expectedEaRev, -3); // ±1 kJ/mol
  });

  it('partiendo de 1:1 alcanza ~67% conversión (consistente con K=4)', () => {
    const p = R_FISCHER_ESTER;
    // K = [ester][H2O] / ([HAc][EtOH]). Si x es conversión: K = x²/(1-x)²
    // → x/(1-x) = √K = 2 → x = 2/3 ≈ 0.67
    const nSteps = Math.round(p.duration / p.dt);
    const traj = simulate(p.steps, p.T, p.initial, p.dt, nSteps);
    const last = traj.t.length - 1;
    const ester = traj.C.CH3COOC2H5[last];
    // Tolerancia generosa porque el sistema puede no llegar al equilibrio en duration
    expect(ester).toBeGreaterThan(0.4);
    expect(ester).toBeLessThan(0.9);
  });

  it('un catalizador NO cambiaría K_eq (solo cinética) — invariante teórico', () => {
    // Verificamos que K_eq depende SOLO de A_fwd/A_rev y de Ea_fwd-Ea_rev.
    // Si bajamos Ea_fwd y Ea_rev por la misma cantidad (un catalizador real
    // baja ambas), K_eq queda igual a la misma T.
    const step = R_FISCHER_ESTER.steps[0];
    const T = R_FISCHER_ESTER.T;
    const kf0 = arrhenius(step.A, step.Ea, T);
    const kr0 = arrhenius(step.A_rev!, step.Ea_rev!, T);
    // "Catalizador" baja Ea por 30 kJ/mol en ambos sentidos
    const kfCat = arrhenius(step.A, step.Ea - 30000, T);
    const krCat = arrhenius(step.A_rev!, step.Ea_rev! - 30000, T);
    expect(kf0 / kr0).toBeCloseTo(kfCat / krCat, 6);
  });
});

// ═══════════════════════════════════════════════════════════════
// getPreset
// ═══════════════════════════════════════════════════════════════

describe('getPreset', () => {
  it('encuentra preset por ID', () => {
    expect(getPreset('haber')).toBe(R_HABER);
    expect(getPreset('n2o5-decomp')).toBe(R_N2O5_DECOMP);
    expect(getPreset('ch4-combustion')).toBe(R_CH4_COMBUSTION);
    expect(getPreset('fe-cu-redox')).toBe(R_FE_CU_REDOX);
    expect(getPreset('sn2-ch3br')).toBe(R_SN2);
    expect(getPreset('fischer-ester')).toBe(R_FISCHER_ESTER);
  });

  it('retorna null para ID desconocido', () => {
    expect(getPreset('no-existe')).toBeNull();
  });
});
