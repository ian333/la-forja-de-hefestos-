/**
 * cuna-anderson.test.ts — la integral numérica contra los números PUBLICADOS
 * del Ejemplo 1.1 de Anderson (6ª ed., §1.5). Fixtures literales del libro.
 */
import { describe, it, expect } from 'vitest';
import { cunaAnderson, betaChoqueOblicuo } from './cuna-anderson';

describe('Anderson Ejemplo 1.1 — cuña 5° a Mach 2', () => {
  const r = cunaAnderson(400);

  it('velocidad del sonido a=340.2 y V∞=680.4 m/s (libro)', () => {
    expect(r.aSonido).toBeCloseTo(340.2, 1);
    expect(r.V).toBeCloseTo(680.4, 0); // el libro redondea a antes de doblar

  });

  it('q∞ = 2.847×10⁵ Pa (libro)', () => {
    expect(r.q).toBeCloseTo(2.847e5, -3); // ±500 Pa
  });

  it('arrastre de presión = 1.052×10⁴ N/m (libro: 2×5260)', () => {
    expect(Math.abs(r.Dp - 1.052e4) / 1.052e4).toBeLessThan(0.01);
  });

  it('arrastre de fricción = 1873 N/m (libro: 2×936.5)', () => {
    expect(Math.abs(r.Df - 1873) / 1873).toBeLessThan(0.01);
  });

  it("D′ = 1.24×10⁴ N/m y cd = 0.022 (libro)", () => {
    expect(Math.abs(r.D - 1.24e4) / 1.24e4).toBeLessThan(0.01);
    expect(r.cd).toBeCloseTo(0.022, 3);
  });

  it('el 85% del arrastre es PRESIÓN (onda de choque), 15% fricción', () => {
    expect(r.fraccionPresion).toBeGreaterThan(0.83);
    expect(r.fraccionPresion).toBeLessThan(0.87);
  });

  it('converge: 50 paneles ya está al 1% de 400 paneles', () => {
    const r50 = cunaAnderson(50);
    expect(Math.abs(r50.D - r.D) / r.D).toBeLessThan(0.01);
  });

  it('choque oblicuo θ-β-M: β(M=2, θ=5°) ≈ 34.3° (carta NACA 1135)', () => {
    const beta = betaChoqueOblicuo(2, 5 * Math.PI / 180) * 180 / Math.PI;
    expect(beta).toBeGreaterThan(34.0);
    expect(beta).toBeLessThan(34.6);
  });
});
