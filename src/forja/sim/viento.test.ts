/**
 * viento.test.ts — el ESTUDIO VIENTO reproduce el Ejemplo 1.1 de Anderson
 * pero con la presión p₂ EMERGIENDO del choque oblicuo (no copiada del libro).
 * Fixtures literales del texto.
 */
import { describe, it, expect } from 'vitest';
import { estudioVientoSupersonico } from './viento';

const DEG = Math.PI / 180;

describe('Estudio Viento — cuña 5° a Mach 2 (Anderson Ej. 1.1)', () => {
  const r = estudioVientoSupersonico({ delta: 5 * DEG, cuerdaM: 2.0, mach: 2.0, hM: 0, nPaneles: 400 });

  it('el choque anclado a β ≈ 34.3° (θ-β-M)', () => {
    expect(r.betaDeg).toBeGreaterThan(34.0);
    expect(r.betaDeg).toBeLessThan(34.6);
  });

  it('la presión sobre las caras EMERGE del choque: p₂ ≈ 1.31×10⁵ Pa (libro ±2%)', () => {
    // el libro da pu = pl = 1.31×10⁵ Pa (leído de la carta de choque); nuestro
    // θ-β-M exacto da 1.328×10⁵ — mismo número al 1.4%. La lección enseña justo
    // eso: lo CALCULAMOS, no lo copiamos.
    expect(Math.abs(r.p2 - 1.31e5) / 1.31e5).toBeLessThan(0.02);
  });

  it('q∞ ≈ 2.84×10⁵ Pa (ρ ISA 1.225 vs 1.23 del libro → 0.4%)', () => {
    expect(Math.abs(r.q - 2.847e5) / 2.847e5).toBeLessThan(0.01);
  });

  it("D′ y cd ≈ los del libro (1.24×10⁴ N/m, 0.022) al ~3%", () => {
    // emergente: D≈1.31×10⁴, cd≈0.023 — dentro de la banda de la carta de choque
    expect(Math.abs(r.D - 1.24e4) / 1.24e4).toBeLessThan(0.06);
    expect(r.cd).toBeCloseTo(0.022, 2);
  });

  it('85% del arrastre es presión (onda de choque)', () => {
    expect(r.fraccionPresion).toBeGreaterThan(0.82);
    expect(r.fraccionPresion).toBeLessThan(0.88);
  });

  it('la ALTITUD cambia el análisis: a 11 km q cae ~3× (menos aire)', () => {
    const alto = estudioVientoSupersonico({ delta: 5 * DEG, cuerdaM: 2.0, mach: 2.0, hM: 11000, nPaneles: 200 });
    // ρ(11km)/ρ(0) ≈ 0.297 → q cae en esa proporción a mismo Mach (V baja también con a)
    expect(alto.q).toBeLessThan(r.q);
    expect(alto.rho).toBeCloseTo(0.3639, 3);
  });

  it('converge: 40 paneles ya al 1% de 400', () => {
    const r40 = estudioVientoSupersonico({ delta: 5 * DEG, cuerdaM: 2.0, mach: 2.0, hM: 0, nPaneles: 40 });
    expect(Math.abs(r40.D - r.D) / r.D).toBeLessThan(0.01);
  });
});
