import { describe, it, expect } from 'vitest';
import {
  julianDay,
  solarPosition,
  solarPositionAt,
  airmass,
  actinicFluxUV,
  solarModulation,
} from '../solar';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

describe('julianDay', () => {
  it('J2000.0 = 2451545.0 (2000-01-01 12:00 UT)', () => {
    const jd = julianDay(2000, 1, 1, 12);
    expect(jd).toBeCloseTo(2451545.0, 3);
  });

  it('avanza 1 día entre fechas consecutivas', () => {
    const a = julianDay(2026, 4, 18, 0);
    const b = julianDay(2026, 4, 19, 0);
    expect(b - a).toBeCloseTo(1, 5);
  });

  it('es monótona creciente en 2026', () => {
    let prev = -Infinity;
    for (const m of [1, 3, 6, 9, 12]) {
      const jd = julianDay(2026, m, 15, 12);
      expect(jd).toBeGreaterThan(prev);
      prev = jd;
    }
  });
});

describe('solarPosition', () => {
  it('sol cerca del zenith a mediodía en el ecuador en equinoccio', () => {
    // Marzo 20, 2026 — equinoccio de primavera (aprox)
    const jd = julianDay(2026, 3, 20, 12);       // 12:00 UT
    const pos = solarPosition(jd, 0, 0);          // ecuador, Greenwich
    // Zenith < 5° (sol casi vertical)
    expect(pos.zenith * RAD).toBeLessThan(5);
    // Declinación ≈ 0 en equinoccio
    expect(Math.abs(pos.declination * RAD)).toBeLessThan(2);
  });

  it('sol bajo el horizonte de noche', () => {
    const jd = julianDay(2026, 6, 21, 0);        // medianoche en Greenwich en verano NH
    const pos = solarPosition(jd, 19.43, -99.13); // CDMX
    // A medianoche UT, CDMX está en 6 PM hora local... aún es de día en verano
    // Probemos 6 UT (= 0 hora local CDMX) en junio → debería estar bajo
    const jd2 = julianDay(2026, 6, 21, 6);
    const pos2 = solarPosition(jd2, 19.43, -99.13);
    expect(pos2.elevation).toBeLessThan(0);
  });

  it('sol alto al mediodía local CDMX en solsticio verano', () => {
    // 21 junio, 12:00 local CDMX = 18:00 UT
    const pos = solarPositionAt(2026, 6, 21, 12, 0, 19.43, -99.13, -6);
    // A 19.43°N en solsticio verano, cerca del cenit (declination ≈ +23.4°)
    expect(pos.elevation * RAD).toBeGreaterThan(80);
  });

  it('azimut entre 0 y 2π', () => {
    const pos = solarPositionAt(2026, 4, 18, 15, 0, 19.43, -99.13, -6);
    expect(pos.azimuth).toBeGreaterThanOrEqual(0);
    expect(pos.azimuth).toBeLessThanOrEqual(2 * Math.PI + 1e-9);
  });
});

describe('airmass', () => {
  it('zenith=0 → airmass=1 (vertical)', () => {
    expect(airmass(0)).toBeCloseTo(1, 3);
  });

  it('crece con el ángulo', () => {
    expect(airmass(45 * DEG)).toBeGreaterThan(airmass(0));
    expect(airmass(80 * DEG)).toBeGreaterThan(airmass(45 * DEG));
  });

  it('zenith=60° → airmass ≈ 2 (clásico)', () => {
    expect(airmass(60 * DEG)).toBeCloseTo(2, 1);
  });

  it('clamp cerca del horizonte — no explota', () => {
    const am = airmass(90 * DEG);
    expect(Number.isFinite(am)).toBe(true);
    expect(am).toBeLessThan(50);
  });
});

describe('actinicFluxUV', () => {
  it('cero de noche', () => {
    expect(actinicFluxUV(Math.PI / 2 + 0.1)).toBe(0);
  });

  it('máximo en el zenith', () => {
    const atZenith = actinicFluxUV(0);
    const at45 = actinicFluxUV(45 * DEG);
    expect(atZenith).toBeGreaterThan(at45);
  });

  it('decae con opacidad atmosférica', () => {
    const clean = actinicFluxUV(0, 0.1);
    const dirty = actinicFluxUV(0, 1.0);
    expect(dirty).toBeLessThan(clean);
  });
});

describe('solarModulation', () => {
  it('vale 1 en el cenit', () => {
    expect(solarModulation(0)).toBeCloseTo(1, 2);
  });

  it('vale 0 de noche', () => {
    expect(solarModulation(Math.PI / 2 + 0.1)).toBe(0);
  });

  it('monotónicamente decreciente con zenith', () => {
    const vals = [0, 15, 30, 45, 60, 75, 85].map((d) => solarModulation(d * DEG));
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeLessThanOrEqual(vals[i - 1]);
    }
  });
});
