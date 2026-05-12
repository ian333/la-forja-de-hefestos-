/**
 * Tests del modelo VSEPR.
 *
 * Verifica:
 *   - Vectores devueltos son unitarios (norma = 1).
 *   - Conteo correcto de bonds + lone pairs.
 *   - Ángulos ideales coinciden con la teoría:
 *       steric 2 → 180°
 *       steric 3 → 120°
 *       steric 4 → 109.47° (tetraédrico)
 *       steric 5 → 90° axial-eq, 120° eq-eq
 *       steric 6 → 90°
 *   - Casos canónicos (CO₂ AX₂, BF₃ AX₃, CH₄ AX₄, NH₃ AX₃E, H₂O AX₂E₂)
 *     producen la forma molecular correcta.
 *
 * Ref: Gillespie & Hargittai 1991.
 */

import { describe, it, expect } from 'vitest';
import { vsepr, angleBetween, placeAtoms, type Vec3 } from '../quantum/vsepr';

function normOf(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

describe('VSEPR — vectores unitarios', () => {
  it('todos los bonds y lone pairs son unitarios para steric 2-6', () => {
    for (let steric = 2; steric <= 6; steric++) {
      for (let lps = 0; lps < steric; lps++) {
        const bonds = steric - lps;
        if (bonds < 1) continue;
        const r = vsepr(bonds, lps);
        for (const d of r.bondDirections) expect(normOf(d)).toBeCloseTo(1, 6);
        for (const d of r.lonePairDirections) expect(normOf(d)).toBeCloseTo(1, 6);
        expect(r.bondDirections.length).toBe(bonds);
        expect(r.lonePairDirections.length).toBe(lps);
      }
    }
  });
});

describe('VSEPR — ángulos canónicos', () => {
  it('AX₂ (CO₂) — lineal, 180°', () => {
    const r = vsepr(2, 0);
    expect(r.shape).toBe('linear');
    expect(angleBetween(r.bondDirections[0], r.bondDirections[1])).toBeCloseTo(180, 3);
  });

  it('AX₃ (BF₃) — trigonal plana, 120°', () => {
    const r = vsepr(3, 0);
    expect(r.shape).toBe('trigonal-planar');
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        expect(angleBetween(r.bondDirections[i], r.bondDirections[j])).toBeCloseTo(120, 1);
      }
    }
  });

  it('AX₄ (CH₄) — tetraédrico, 109.47°', () => {
    const r = vsepr(4, 0);
    expect(r.shape).toBe('tetrahedral');
    // arccos(-1/3) = 109.4712°
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        expect(angleBetween(r.bondDirections[i], r.bondDirections[j])).toBeCloseTo(109.47, 1);
      }
    }
  });

  it('AX₃E (NH₃) — piramidal trigonal, ángulo bond-bond ~109.47° (ideal sin compresión)', () => {
    const r = vsepr(3, 1);
    expect(r.shape).toBe('trigonal-pyramidal');
    expect(r.effectiveAngleDeg).toBeCloseTo(106.7, 1); // NIST experimental
    // 3 bonds, 1 LP — todos vienen de tetraedro
    expect(r.bondDirections.length).toBe(3);
    expect(r.lonePairDirections.length).toBe(1);
  });

  it('AX₂E₂ (H₂O) — bent, effectiveAngle = 104.5°', () => {
    const r = vsepr(2, 2);
    expect(r.shape).toBe('bent');
    expect(r.effectiveAngleDeg).toBeCloseTo(104.5, 1);
  });

  it('AX₅ (PCl₅) — trigonal bipiramidal', () => {
    const r = vsepr(5, 0);
    expect(r.shape).toBe('trigonal-bipyramidal');
    expect(r.bondDirections.length).toBe(5);
  });

  it('AX₆ (SF₆) — octaédrico, 90°', () => {
    const r = vsepr(6, 0);
    expect(r.shape).toBe('octahedral');
    // Cada bond tiene 4 vecinos a 90° y 1 trans a 180°
    let count90 = 0;
    let count180 = 0;
    for (let i = 0; i < 6; i++) {
      for (let j = i + 1; j < 6; j++) {
        const ang = angleBetween(r.bondDirections[i], r.bondDirections[j]);
        if (Math.abs(ang - 90)  < 0.5) count90++;
        if (Math.abs(ang - 180) < 0.5) count180++;
      }
    }
    expect(count90).toBe(12);  // 6 × 4 / 2 pares cis
    expect(count180).toBe(3);  // 3 pares trans (x-x, y-y, z-z)
  });

  it('AX₄E₂ (XeF₄) — cuadrada plana, lone pairs trans', () => {
    const r = vsepr(4, 2);
    expect(r.shape).toBe('square-planar');
    // Los 2 LPs deben estar a 180° entre sí
    expect(angleBetween(r.lonePairDirections[0], r.lonePairDirections[1])).toBeCloseTo(180, 1);
  });
});

describe('VSEPR — placeAtoms', () => {
  it('coloca átomos a la distancia correcta del centro', () => {
    const r = vsepr(4, 0);
    const Hs = placeAtoms([0, 0, 0], r.bondDirections, [2.0, 2.0, 2.0, 2.0]);
    for (const h of Hs) {
      expect(normOf(h)).toBeCloseTo(2.0, 6);
    }
  });

  it('aplica offset del centro correctamente', () => {
    const r = vsepr(2, 0);
    const atoms = placeAtoms([1, 1, 1], r.bondDirections, [1.0, 1.0]);
    expect(atoms[0]).toEqual([2, 1, 1]);
    expect(atoms[1]).toEqual([0, 1, 1]);
  });

  it('falla si dirs.length !== bondLengths.length', () => {
    const r = vsepr(4, 0);
    expect(() => placeAtoms([0, 0, 0], r.bondDirections, [1.0, 1.0])).toThrow();
  });
});

describe('VSEPR — errores', () => {
  it('steric < 2 lanza', () => {
    expect(() => vsepr(1, 0)).toThrow();
  });
  it('steric > 6 no soportado', () => {
    expect(() => vsepr(4, 3)).toThrow();
  });
  it('0 bonds lanza', () => {
    expect(() => vsepr(0, 4)).toThrow();
  });
});
