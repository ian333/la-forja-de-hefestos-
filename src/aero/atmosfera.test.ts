/**
 * atmosfera.test.ts — ISA contra los valores PUBLICADOS del estándar (ISO 2533 /
 * Anderson ap. A). Fixtures literales, jamás inventados (regla Kazmer).
 */
import { describe, it, expect } from 'vitest';
import {
  atmosferaISA, atmosferaISAz, presionDinamica, mach, ISA,
  geopotencial, geometrica,
} from './atmosfera';

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

/**
 * Las capas ALTAS del estándar. Antes el modelo se detenía en 20 km y el
 * material hipersónico (Anderson cap. 14) necesita 59 y 68.9 km.
 * Fixtures: presiones publicadas del U.S. Standard Atmosphere 1976 en la base
 * de cada capa. Se comparan a 4 cifras porque se DERIVAN encadenando la
 * hidrostática desde p0, no se copian de la tabla.
 */
describe('atmosferaISA — capas altas (hasta 84.852 km)', () => {
  const TABLA: Array<[number, number, number]> = [
    // [H geopotencial (m), T (K), p (Pa)]
    [20000, 216.65, 5474.89],
    [32000, 228.65, 868.02],
    [47000, 270.65, 110.91],
    [51000, 270.65, 66.939],
    [71000, 214.65, 3.9564],
    [84852, 186.946, 0.37338],
  ];
  for (const [H, T, p] of TABLA) {
    it(`H=${H} m: T=${T} K, p≈${p} Pa`, () => {
      const s = atmosferaISA(H);
      expect(s.T).toBeCloseTo(T, 2);
      expect(s.p / p).toBeCloseTo(1, 3);   // 0.1% contra la tabla publicada
    });
  }
  it('sin saltos de presión en NINGUNA frontera de capa', () => {
    for (const H of [11000, 20000, 32000, 47000, 51000, 71000]) {
      const a = atmosferaISA(H - 0.01).p, b = atmosferaISA(H + 0.01).p;
      expect(Math.abs(a - b) / a).toBeLessThan(1e-5);
    }
  });
  it('la presión es monótona decreciente en todo el modelo', () => {
    let prev = Infinity;
    for (let H = 0; H <= ISA.hMax; H += 500) {
      const p = atmosferaISA(H).p;
      expect(p).toBeLessThan(prev);
      prev = p;
    }
  });
  it('fuera del modelo LANZA en vez de extrapolar en silencio', () => {
    expect(() => atmosferaISA(-1)).toThrow();
    expect(() => atmosferaISA(ISA.hMax + 1)).toThrow();
  });
});

/**
 * Geopotencial vs geométrica — Anderson §1.9 lo marca con "must" dos veces.
 * Ignorarlo es barato abajo y caro arriba: 19 m a 11 km, 390 m a 50 km.
 */
describe('altitud geopotencial vs geométrica', () => {
  it('H < z siempre, y la ida y vuelta cierra', () => {
    for (const z of [1000, 11000, 20000, 50000, 80000]) {
      const H = geopotencial(z);
      expect(H).toBeLessThan(z);
      expect(geometrica(H)).toBeCloseTo(z, 6);
    }
  });
  it('la diferencia crece con la altura: ~19 m a 11 km, ~390 m a 50 km', () => {
    expect(11000 - geopotencial(11000)).toBeCloseTo(19.0, 0);
    expect(50000 - geopotencial(50000)).toBeCloseTo(390.2, 0);
  });
  it('al nivel del mar ambas coinciden', () => {
    expect(geopotencial(0)).toBe(0);
    expect(atmosferaISAz(0).p).toBeCloseTo(ISA.p0, 6);
  });
  it('atmosferaISAz(z) evalúa el modelo en H, no en z', () => {
    const z = 20000;
    expect(atmosferaISAz(z).p).toBeCloseTo(atmosferaISA(geopotencial(z)).p, 9);
    // y NO es lo mismo que evaluarlo en z: a 20 km la diferencia es medible
    expect(Math.abs(atmosferaISAz(z).p - atmosferaISA(z).p)).toBeGreaterThan(1);
  });
});
