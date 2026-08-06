/**
 * cuna-anderson.test.ts — la integral numérica contra los números PUBLICADOS
 * del Ejemplo 1.1 de Anderson (6ª ed., §1.5). Fixtures literales del libro.
 */
import { describe, it, expect } from 'vitest';
import {
  cunaAnderson, betaChoqueOblicuo, thetaDeBeta, deflexionMaxima, resolverChoqueOblicuo,
} from './cuna-anderson';

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

/**
 * EL CHOQUE DESPRENDIDO — la regresión del bug que fallaba EN SILENCIO.
 * La versión anterior biseccionaba en un bracket fijo de 65° y, cuando la
 * deflexión pedida excedía θmax, devolvía 65° sin avisar: un número plausible
 * y falso. Estos tres casos lo demostraron.
 */
describe('θ-β-M: rama, máximo y desprendimiento', () => {
  const D = 180 / Math.PI;

  it('θmax(M=2) ≈ 22.97° en β ≈ 64.7° (carta NACA 1135)', () => {
    const { thetaMax, betaEnMax } = deflexionMaxima(2);
    expect(thetaMax * D).toBeCloseTo(22.97, 1);
    // 64.67° < 65°: por esto el bracket fijo de 65° recortaba soluciones válidas
    expect(betaEnMax * D).toBeCloseTo(64.67, 1);
  });

  it.each([[2, 30], [1.5, 20], [3, 40]])(
    'M=%s con θ=%s° está DESPRENDIDO y se declara (antes devolvía 65° callado)',
    (M, thetaDeg) => {
      const r = resolverChoqueOblicuo(M, thetaDeg / D);
      expect(r.desprendido).toBe(true);
      expect(r.beta).toBeNull();
      expect(thetaDeg).toBeGreaterThan(r.thetaMax * D);
      expect(() => betaChoqueOblicuo(M, thetaDeg / D)).toThrow(/DESPRENDIDO/);
    },
  );

  it('justo por debajo de θmax hay solución; justo por encima, no', () => {
    const { thetaMax } = deflexionMaxima(3);
    expect(resolverChoqueOblicuo(3, thetaMax * 0.999).desprendido).toBe(false);
    expect(resolverChoqueOblicuo(3, thetaMax * 1.001).desprendido).toBe(true);
  });

  it('β en θmax supera los 65° a Mach alto — el bracket viejo era imposible', () => {
    expect(deflexionMaxima(20).betaEnMax * D).toBeGreaterThan(67);
  });

  it('ida y vuelta: θ(β(θ)) = θ en ambas ramas', () => {
    for (const M of [1.5, 2, 3, 5]) {
      for (const t of [2, 5, 10]) {
        const debil = resolverChoqueOblicuo(M, t / D, 1.4, 'debil');
        const fuerte = resolverChoqueOblicuo(M, t / D, 1.4, 'fuerte');
        expect(thetaDeBeta(M, debil.beta!) * D).toBeCloseTo(t, 4);
        expect(thetaDeBeta(M, fuerte.beta!) * D).toBeCloseTo(t, 4);
      }
    }
  });

  it('la rama fuerte da un choque más inclinado que la débil', () => {
    const d = resolverChoqueOblicuo(2, 5 / D, 1.4, 'debil').beta!;
    const f = resolverChoqueOblicuo(2, 5 / D, 1.4, 'fuerte').beta!;
    expect(f).toBeGreaterThan(d);
    expect(f * D).toBeLessThan(90);
  });

  it('deflexión nula ⇒ onda de Mach: β = asin(1/M)', () => {
    for (const M of [1.5, 2, 4]) {
      expect(resolverChoqueOblicuo(M, 0).beta!).toBeCloseTo(Math.asin(1 / M), 4);
    }
  });

  it('subsónico: no existe choque oblicuo', () => {
    expect(resolverChoqueOblicuo(0.8, 5 / D).desprendido).toBe(true);
  });
});
