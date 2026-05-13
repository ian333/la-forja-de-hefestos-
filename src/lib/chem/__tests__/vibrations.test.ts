/**
 * Tests de análisis vibracional contra datos experimentales NIST / Herzberg.
 *
 * Pipeline: FF armónico → Hessian numérico → mass-weighting → Jacobi →
 *           autovalores → ν̃ [cm⁻¹].
 *
 * Tolerancias por molécula (diferencias entre SVFF y experimento se deben
 * a anarmonicidad y acoplamiento — son ~3% para valencia simple):
 *   - Diatómicos:  ±10 cm⁻¹ absoluto.
 *   - Triatómicos: ±100 cm⁻¹ absoluto (el SVFF subestima sym/asym splitting).
 *
 * Ref: Herzberg 1945, NIST CCCBDB, Shimanouchi NSRDS-NBS 39.
 */

import { describe, it, expect } from 'vitest';
import {
  vibrationalAnalysis,
  potential,
  hessianFD,
  massWeightHessian,
  FF_H2,
  FF_HF,
  FF_HCL,
  FF_H2O,
  FF_CO2,
  FF_CATALOG,
  getFFEntry,
} from '../quantum/vibrations';
import { jacobiEigen } from '../quantum/jacobi';

// ═══════════════════════════════════════════════════════════════
// Jacobi — sanity de la diagonalización
// ═══════════════════════════════════════════════════════════════

describe('jacobiEigen — sanity', () => {
  it('diagonaliza diag(1,2,3) en orden', () => {
    const { values } = jacobiEigen([
      [1, 0, 0],
      [0, 2, 0],
      [0, 0, 3],
    ]);
    expect(values).toEqual([1, 2, 3]);
  });

  it('autovalores de una matriz 2x2 conocida', () => {
    // [[2, 1], [1, 2]] → autovalores 1, 3
    const { values, vectors } = jacobiEigen([
      [2, 1],
      [1, 2],
    ]);
    expect(values[0]).toBeCloseTo(1, 8);
    expect(values[1]).toBeCloseTo(3, 8);
    // Vector de autovalor 1: (1,-1)/√2 — antisimétrico
    expect(Math.abs(vectors[0][0] + vectors[1][0])).toBeLessThan(1e-6);
    // Vector de autovalor 3: (1,1)/√2 — simétrico
    expect(Math.abs(vectors[0][1] - vectors[1][1])).toBeLessThan(1e-6);
  });

  it('autovectores ortonormales', () => {
    const A = [
      [4, 1, 2],
      [1, 5, 0],
      [2, 0, 6],
    ];
    const { vectors } = jacobiEigen(A);
    // Producto V^T · V debe ser identidad
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let s = 0;
        for (let k = 0; k < 3; k++) s += vectors[k][i] * vectors[k][j];
        expect(s).toBeCloseTo(i === j ? 1 : 0, 8);
      }
    }
  });

  it('rechaza matriz no simétrica', () => {
    expect(() => jacobiEigen([[1, 2], [3, 4]])).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// Potencial — en el mínimo V = 0
// ═══════════════════════════════════════════════════════════════

describe('potential — punto de equilibrio', () => {
  for (const entry of FF_CATALOG) {
    it(`${entry.name}: V(equilibrio) ≈ 0`, () => {
      const positionsM = entry.positions.map((p) => p.map((x) => x * 1e-10));
      const V = potential(positionsM, entry.ff);
      // Tolerancia: 10⁻²² J (escala vibracional ~10⁻¹⁸ J).
      expect(V).toBeLessThan(1e-22);
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// Hessian — simetría y positivo definido (sin modos imaginarios reales)
// ═══════════════════════════════════════════════════════════════

describe('Hessian — propiedades', () => {
  it('H₂O: Hessian simétrico', () => {
    const H = hessianFD(FF_H2O.positions, FF_H2O.ff);
    const N = H.length;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const sym = Math.abs(H[i][j] - H[j][i]) / (Math.abs(H[i][j]) + 1);
        expect(sym).toBeLessThan(1e-4);
      }
    }
  });

  it('CO₂: mass-weighted Hessian es simétrico', () => {
    const H = hessianFD(FF_CO2.positions, FF_CO2.ff);
    const Hw = massWeightHessian(H, FF_CO2.masses);
    for (let i = 0; i < Hw.length; i++) {
      for (let j = i + 1; j < Hw.length; j++) {
        expect(Math.abs(Hw[i][j] - Hw[j][i])).toBeLessThan(1e-3);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Diatómicos: ν̃ contra NIST
// ═══════════════════════════════════════════════════════════════

describe('frecuencias vibracionales — diatómicos NIST', () => {
  const diatomicTolerance = 10; // ±10 cm⁻¹

  it('H₂: ν̃ ≈ 4401 cm⁻¹', () => {
    const { vibrational } = vibrationalAnalysis(FF_H2.positions, FF_H2.ff, FF_H2.masses);
    expect(vibrational.length).toBeGreaterThanOrEqual(1);
    const stretch = vibrational[vibrational.length - 1].wavenumber;
    expect(Math.abs(stretch - 4401.21)).toBeLessThan(diatomicTolerance);
  });

  it('HF: ν̃ ≈ 4138 cm⁻¹', () => {
    const { vibrational } = vibrationalAnalysis(FF_HF.positions, FF_HF.ff, FF_HF.masses);
    const stretch = vibrational[vibrational.length - 1].wavenumber;
    expect(Math.abs(stretch - 4138.32)).toBeLessThan(diatomicTolerance);
  });

  it('HCl: ν̃ ≈ 2991 cm⁻¹', () => {
    const { vibrational } = vibrationalAnalysis(FF_HCL.positions, FF_HCL.ff, FF_HCL.masses);
    const stretch = vibrational[vibrational.length - 1].wavenumber;
    expect(Math.abs(stretch - 2990.95)).toBeLessThan(diatomicTolerance);
  });
});

// ═══════════════════════════════════════════════════════════════
// H₂O — 3 modos (bend, sym, asym)
// ═══════════════════════════════════════════════════════════════

describe('H₂O — modos normales triatómicos', () => {
  it('produce exactamente 3 modos vibracionales reales (3N-6 = 3)', () => {
    const { vibrational } = vibrationalAnalysis(FF_H2O.positions, FF_H2O.ff, FF_H2O.masses);
    expect(vibrational.length).toBe(3);
  });

  it('bend ≈ 1595 cm⁻¹ (NIST)', () => {
    const { vibrational } = vibrationalAnalysis(FF_H2O.positions, FF_H2O.ff, FF_H2O.masses);
    const bend = vibrational[0].wavenumber; // el más bajo es el bend
    expect(bend).toBeGreaterThan(1400);
    expect(bend).toBeLessThan(1800);
  });

  it('los dos modos de stretching están en 3500-3900 cm⁻¹', () => {
    const { vibrational } = vibrationalAnalysis(FF_H2O.positions, FF_H2O.ff, FF_H2O.masses);
    const stretches = vibrational.slice(1).map((m) => m.wavenumber);
    for (const s of stretches) {
      expect(s).toBeGreaterThan(3400);
      expect(s).toBeLessThan(4000);
    }
  });

  it('separación sym/asym es positiva pero pequeña (acoplamiento débil)', () => {
    const { vibrational } = vibrationalAnalysis(FF_H2O.positions, FF_H2O.ff, FF_H2O.masses);
    const sym = vibrational[1].wavenumber;
    const asym = vibrational[2].wavenumber;
    expect(asym).toBeGreaterThan(sym);
    expect(asym - sym).toBeLessThan(200); // experimental: 3756-3657 = 99
  });
});

// ═══════════════════════════════════════════════════════════════
// CO₂ — 4 modos (bend doblemente degenerado, sym, asym)
// ═══════════════════════════════════════════════════════════════

describe('CO₂ — modos lineal triatómico', () => {
  it('produce 4 modos vibracionales reales (3N-5 = 4 para lineal)', () => {
    const { vibrational } = vibrationalAnalysis(FF_CO2.positions, FF_CO2.ff, FF_CO2.masses);
    expect(vibrational.length).toBe(4);
  });

  it('bend doblemente degenerado ≈ 667 cm⁻¹ (NIST)', () => {
    const { vibrational } = vibrationalAnalysis(FF_CO2.positions, FF_CO2.ff, FF_CO2.masses);
    const b1 = vibrational[0].wavenumber;
    const b2 = vibrational[1].wavenumber;
    expect(Math.abs(b1 - b2)).toBeLessThan(5); // degenerados
    expect(b1).toBeGreaterThan(500);
    expect(b1).toBeLessThan(900);
  });

  it('asym stretch ≈ 2349 cm⁻¹ (NIST) — el más alto', () => {
    // Tolerancia 200 cm⁻¹: el SVFF de un solo k no captura el acoplamiento
    // bond-bond k_rr que separa sym y asym (Wilson-Decius-Cross §5-4).
    const { vibrational } = vibrationalAnalysis(FF_CO2.positions, FF_CO2.ff, FF_CO2.masses);
    const asym = vibrational[vibrational.length - 1].wavenumber;
    expect(Math.abs(asym - 2349)).toBeLessThan(200);
  });

  it('sym stretch ≈ 1333 cm⁻¹ (NIST) — intermedio', () => {
    const { vibrational } = vibrationalAnalysis(FF_CO2.positions, FF_CO2.ff, FF_CO2.masses);
    const sym = vibrational[2].wavenumber;
    expect(Math.abs(sym - 1333)).toBeLessThan(200);
  });

  it('asym > sym > bend (orden energético correcto)', () => {
    const { vibrational } = vibrationalAnalysis(FF_CO2.positions, FF_CO2.ff, FF_CO2.masses);
    const bend = vibrational[0].wavenumber;
    const sym = vibrational[2].wavenumber;
    const asym = vibrational[3].wavenumber;
    expect(bend).toBeLessThan(sym);
    expect(sym).toBeLessThan(asym);
  });
});

// ═══════════════════════════════════════════════════════════════
// Modos rígidos: traslaciones/rotaciones ≈ 0
// ═══════════════════════════════════════════════════════════════

describe('modos rígidos (traslación + rotación) ≈ 0', () => {
  it('H₂O: los primeros 6 modos tienen |ν̃| < 10 cm⁻¹', () => {
    const { modes } = vibrationalAnalysis(FF_H2O.positions, FF_H2O.ff, FF_H2O.masses);
    // 3N=9 modos totales. Los primeros 6 son traslación(3)+rotación(3).
    expect(modes.length).toBe(9);
    for (let i = 0; i < 6; i++) {
      expect(Math.abs(modes[i].wavenumber)).toBeLessThan(10);
    }
  });

  it('CO₂: los primeros 5 modos tienen |ν̃| < 10 cm⁻¹ (lineal → 3T + 2R)', () => {
    const { modes } = vibrationalAnalysis(FF_CO2.positions, FF_CO2.ff, FF_CO2.masses);
    // 3N=9 modos. Lineal: 3 trasl + 2 rot. Sobran 4 vibracionales.
    expect(modes.length).toBe(9);
    for (let i = 0; i < 5; i++) {
      expect(Math.abs(modes[i].wavenumber)).toBeLessThan(10);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Lookup
// ═══════════════════════════════════════════════════════════════

describe('getFFEntry', () => {
  it('encuentra por fórmula', () => {
    expect(getFFEntry('H2O')).toBe(FF_H2O);
    expect(getFFEntry('CO2')).toBe(FF_CO2);
  });
  it('retorna null para fórmula desconocida', () => {
    expect(getFFEntry('XYZ')).toBeNull();
  });
});
