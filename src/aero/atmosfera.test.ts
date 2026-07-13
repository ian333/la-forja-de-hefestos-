/**
 * atmosfera.test.ts — ISA contra los valores PUBLICADOS del estándar (ISO 2533 /
 * Anderson ap. A). Fixtures literales, jamás inventados (regla Kazmer).
 */
import { describe, it, expect } from 'vitest';
import { atmosferaISA, presionDinamica, mach, ISA } from './atmosfera';

describe('atmosferaISA — tabla del estándar', () => {
  it('nivel del mar: 288.15 K, 101325 Pa, 1.225 kg/m³, a=340.3 m/s', () => {
    const s = atmosferaISA(0);
    expect(s.T).toBeCloseTo(288.15, 3);
    expect(s.p).toBeCloseTo(101325, 0);
    expect(s.rho).toBeCloseTo(1.225, 3);
    expect(s.aSonido).toBeCloseTo(340.3, 1);
  });
  it('h=5,000 m (tabla ISA): T=255.65 K, p≈54,019 Pa, ρ≈0.7361', () => {
    const s = atmosferaISA(5000);
    expect(s.T).toBeCloseTo(255.65, 2);
    expect(s.p).toBeCloseTo(54019, -1);      // ±5 Pa vs tabla publicada 54,020
    expect(s.rho).toBeCloseTo(0.7361, 3);
  });
  it('tropopausa h=11,000 m: T=216.65 K, p≈22,632 Pa, ρ≈0.3639', () => {
    const s = atmosferaISA(11000);
    expect(s.T).toBeCloseTo(216.65, 2);
    expect(s.p).toBeCloseTo(22632, -1);
    expect(s.rho).toBeCloseTo(0.3639, 3);
  });
  it('estratosfera h=15,000 m (isoterma): T=216.65 K, p≈12,045 Pa', () => {
    const s = atmosferaISA(15000);
    expect(s.T).toBeCloseTo(216.65, 2);
    expect(s.p).toBeCloseTo(12045, -1);      // tabla: 12,044.6 Pa
  });
  it('continuidad en la tropopausa (sin salto de presión)', () => {
    // gap de 2 cm: el gradiente ahí es ~3.6 Pa/m → diferencia esperada ~0.07 Pa < 0.5
    expect(atmosferaISA(10999.99).p).toBeCloseTo(atmosferaISA(11000.01).p, 0);
  });
  it('presión dinámica: crucero 250 m/s a 11 km → q = ½·0.3639·250² ≈ 11,372 Pa', () => {
    expect(presionDinamica(11000, 250)).toBeCloseTo(0.5 * 0.3639 * 62500, -2);
  });
  it('Mach: 295.2 m/s a 11 km = Mach 1.0 (a=295.07)', () => {
    expect(mach(11000, 295.07)).toBeCloseTo(1.0, 3);
  });
  it('rho0 exportada coincide con la derivada', () => {
    expect(atmosferaISA(0).rho).toBeCloseTo(ISA.rho0, 3);
  });
});
