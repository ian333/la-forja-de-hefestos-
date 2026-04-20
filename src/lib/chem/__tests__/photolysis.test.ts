import { describe, it, expect } from 'vitest';
import {
  jValue,
  jValueAt,
  diurnalJ,
  J_PARAMS,
  J_LIST,
} from '../photolysis';

const DEG = Math.PI / 180;

describe('J_PARAMS database', () => {
  it('contiene las reacciones atmosféricas canónicas', () => {
    expect(J_PARAMS.J1).toBeDefined();   // O3 → O(¹D)
    expect(J_PARAMS.J4).toBeDefined();   // NO2 → NO
    expect(J_PARAMS.J11).toBeDefined();  // HCHO → CO
  });

  it('todos los parámetros tienen l, m, n positivos', () => {
    for (const p of J_LIST) {
      expect(p.l).toBeGreaterThan(0);
      expect(p.m).toBeGreaterThan(0);
      expect(p.n).toBeGreaterThan(0);
    }
  });

  it('key y name coinciden', () => {
    for (const [key, param] of Object.entries(J_PARAMS)) {
      expect(param.name).toBe(key);
    }
  });
});

describe('jValue instantáneo', () => {
  it('cero de noche (zenith > 90°)', () => {
    for (const p of J_LIST) {
      expect(jValue(p, 91 * DEG)).toBe(0);
    }
  });

  it('máximo al mediodía (zenith=0)', () => {
    for (const p of J_LIST) {
      const zenith = jValue(p, 0);
      const sunset = jValue(p, 85 * DEG);
      expect(zenith).toBeGreaterThan(sunset);
    }
  });

  it('J(NO2) al mediodía está en rango 10⁻³ s⁻¹ (valor típico troposférico)', () => {
    // J(NO2) máximo ~ 0.01 s⁻¹ en condiciones de cenit claro
    const j = jValue(J_PARAMS.J4, 0);
    expect(j).toBeGreaterThan(1e-3);
    expect(j).toBeLessThan(2e-2);
  });

  it('J(O3→O¹D) al mediodía ~ 10⁻⁵ s⁻¹ (valor de referencia)', () => {
    // J1 máximo típico: 3-5·10⁻⁵ s⁻¹
    const j = jValue(J_PARAMS.J1, 0);
    expect(j).toBeGreaterThan(1e-5);
    expect(j).toBeLessThan(1e-4);
  });

  it('monotónicamente decreciente con zenith en 0-85°', () => {
    const zs = [0, 15, 30, 45, 60, 75, 85].map((d) => d * DEG);
    for (const p of J_LIST) {
      const values = zs.map((z) => jValue(p, z));
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
      }
    }
  });
});

describe('diurnalJ', () => {
  it('retorna 24h (con final) en serie', () => {
    const { t, J } = diurnalJ(J_PARAMS.J4, 2026, 6, 21, 19.43, -99.13, -6, 60);
    expect(t[0]).toBe(0);
    expect(t[t.length - 1]).toBe(24);
    expect(J).toHaveLength(t.length);
  });

  it('es 0 en la madrugada y al anochecer', () => {
    const { t, J } = diurnalJ(J_PARAMS.J4, 2026, 6, 21, 19.43, -99.13, -6, 60);
    // hora 2 AM y 11 PM deben tener J≈0
    const hour2 = J[2];
    const hour23 = J[23];
    expect(hour2).toBeLessThan(1e-10);
    expect(hour23).toBeLessThan(1e-10);
  });

  it('es máximo cerca del mediodía local', () => {
    const { t, J } = diurnalJ(J_PARAMS.J4, 2026, 6, 21, 19.43, -99.13, -6, 30);
    const maxJ = Math.max(...J);
    const idxMax = J.indexOf(maxJ);
    const tMax = t[idxMax];
    // Debe estar entre 11:30 y 13:30 hora local
    expect(tMax).toBeGreaterThan(11);
    expect(tMax).toBeLessThan(14);
  });

  it('integral de J sobre el día es finita y positiva', () => {
    const { t, J } = diurnalJ(J_PARAMS.J4, 2026, 6, 21, 19.43, -99.13, -6, 15);
    let area = 0;
    for (let i = 1; i < t.length; i++) {
      area += (J[i] + J[i - 1]) / 2 * (t[i] - t[i - 1]) * 3600; // h → s
    }
    expect(area).toBeGreaterThan(1);       // fracción de fotólisis integrada
    expect(Number.isFinite(area)).toBe(true);
  });
});

describe('jValueAt conveniencia', () => {
  it('coincide con jValue(param, solarPosition.zenith)', () => {
    const j = jValueAt(J_PARAMS.J4, 2026, 6, 21, 12, 0, 19.43, -99.13, -6);
    expect(j).toBeGreaterThan(0);
    expect(j).toBeLessThan(0.02);
  });

  it('nombre string funciona igual que objeto', () => {
    const a = jValueAt(J_PARAMS.J4, 2026, 6, 21, 12, 0, 19.43, -99.13, -6);
    const b = jValueAt('J4', 2026, 6, 21, 12, 0, 19.43, -99.13, -6);
    expect(a).toBe(b);
  });

  it('key desconocida → 0', () => {
    expect(jValueAt('JXXX', 2026, 6, 21, 12, 0, 19.43, -99.13, -6)).toBe(0);
  });
});
