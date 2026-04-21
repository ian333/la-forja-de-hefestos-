/**
 * Tests de la farmacología paramétrica.
 */

import { describe, it, expect } from 'vitest';
import {
  DRUG_LIBRARY,
  pkBateman,
  timeToPeak,
  spatialWeight,
  currentModulation,
  healScore,
  safetyScore,
  overallScore,
  type Drug,
  type Schedule,
} from '../pharmacology';

describe('pharmacology — biblioteca', () => {
  it('todos los drugs tienen campos válidos', () => {
    for (const d of DRUG_LIBRARY) {
      expect(d.id).toBeTruthy();
      expect(d.name).toBeTruthy();
      expect(d.onset).toBeGreaterThan(0);
      expect(d.halfLife).toBeGreaterThan(0);
      expect(d.tumorRisk).toBeGreaterThanOrEqual(0);
    }
    expect(DRUG_LIBRARY.length).toBeGreaterThanOrEqual(5);
  });

  it('incluye candidatos de cada familia clave', () => {
    const families = new Set(DRUG_LIBRARY.map(d => d.family));
    for (const f of ['growth-factor', 'signaling-inhibitor', 'cytokine', 'reprogrammer', 'placebo']) {
      expect(families.has(f as never)).toBe(true);
    }
  });
});

describe('pharmacology — PK Bateman', () => {
  const drug: Drug = {
    id: 'test', name: 'test', family: 'small-molecule',
    deltaF: 0, deltaK: 0, onset: 4, halfLife: 24,
    delivery: 'systemic', tumorRisk: 1, blurb: '', ref: '', accent: '#fff',
  };

  it('0 antes de t=0, 0 en t=0, >0 después', () => {
    expect(pkBateman(-1, drug)).toBe(0);
    expect(pkBateman(0, drug)).toBe(0);
    expect(pkBateman(2, drug)).toBeGreaterThan(0);
  });

  it('pico normalizado = 1 (aprox)', () => {
    const tpk = timeToPeak(drug);
    const peak = pkBateman(tpk, drug);
    expect(peak).toBeGreaterThan(0.95);
    expect(peak).toBeLessThan(1.01);
  });

  it('monótono: sube antes del pico, baja después', () => {
    const tpk = timeToPeak(drug);
    const before1 = pkBateman(tpk * 0.5, drug);
    const before2 = pkBateman(tpk * 0.8, drug);
    const after1  = pkBateman(tpk * 1.5, drug);
    const after2  = pkBateman(tpk * 3.0, drug);
    expect(before2).toBeGreaterThan(before1);
    expect(after2).toBeLessThan(after1);
  });

  it('half-life se respeta (aprox)', () => {
    const tpk = timeToPeak(drug);
    const peak = pkBateman(tpk, drug);
    const half = pkBateman(tpk + drug.halfLife, drug);
    // Tras una half-life desde el pico, debe quedar ~50% (±30%)
    // (la eliminación no es puramente exponencial hasta que la absorción
    // se completa, por eso tolerancia generosa).
    expect(half).toBeGreaterThan(0.3 * peak);
    expect(half).toBeLessThan(0.7 * peak);
  });

  it('dosis escala linealmente', () => {
    const tpk = timeToPeak(drug);
    const c1 = pkBateman(tpk, drug, 1);
    const c2 = pkBateman(tpk, drug, 2.5);
    expect(Math.abs(c2 - 2.5 * c1)).toBeLessThan(1e-6);
  });
});

describe('pharmacology — selectividad espacial', () => {
  const localDrug: Drug = {
    id: 't', name: 't', family: 'growth-factor',
    deltaF: 0, deltaK: 0, onset: 1, halfLife: 10,
    delivery: 'local', tumorRisk: 1, blurb: '', ref: '', accent: '#fff',
  };
  const systemicDrug: Drug = { ...localDrug, delivery: 'systemic' };

  it('local: peso 1 en centro, decae con distancia', () => {
    expect(spatialWeight(localDrug, 0, 0, 0, 0, 0.25)).toBeCloseTo(1, 5);
    const far = spatialWeight(localDrug, 0.5, 0, 0, 0, 0.25);
    expect(far).toBeLessThan(0.2);   // 2σ ≈ 13.5% de gauss
  });

  it('sistémica: peso 1 en todos lados', () => {
    expect(spatialWeight(systemicDrug, 0, 0, 0, 0, 0.25)).toBe(1);
    expect(spatialWeight(systemicDrug, 0.8, 0.8, 0, 0, 0.25)).toBe(1);
  });
});

describe('pharmacology — superposición', () => {
  it('dos drugs compatibles: efectos se suman', () => {
    const sched: Schedule = {
      administrations: [
        { drugId: 'bmp2', t0: 0, dose: 1 },
        { drugId: 'fgf10', t0: 0, dose: 1 },
      ],
    };
    // Justo en los picos (aprox) de ambos
    const bmp2 = DRUG_LIBRARY.find(d => d.id === 'bmp2')!;
    const fgf10 = DRUG_LIBRARY.find(d => d.id === 'fgf10')!;
    // Ambos locales — evaluar en el centro
    const tBmp = timeToPeak(bmp2);
    const modA = currentModulation(sched, tBmp, 0, 0);
    // ΔF de cada uno es negativo (empuja hacia α); la suma debe ser más negativa
    // que cualquiera individualmente.
    expect(modA.dF).toBeLessThan(bmp2.deltaF * 0.5);   // efecto al menos 50%
    expect(modA.dF).toBeLessThan(fgf10.deltaF * 0.5);
  });

  it('placebo no mueve nada', () => {
    const sched: Schedule = { administrations: [{ drugId: 'placebo', t0: 0, dose: 1 }] };
    for (let t = 1; t < 20; t += 2) {
      const m = currentModulation(sched, t, 0, 0);
      expect(m.dF).toBe(0);
      expect(m.dK).toBe(0);
    }
  });

  it('efecto decae tras halfLife suficiente (tiempo largo)', () => {
    const sched: Schedule = { administrations: [{ drugId: 'bmp2', t0: 0, dose: 1 }] };
    const late = currentModulation(sched, 200, 0, 0);   // muy tarde
    expect(Math.abs(late.dF)).toBeLessThan(0.005);
  });
});

describe('pharmacology — scoring', () => {
  it('heal perfecto: todas las celdas heridas llegan a target', () => {
    const RES = 8;
    const field = new Float32Array(RES * RES * 4);
    const mask = new Uint8Array(RES * RES);
    for (let i = 0; i < RES * RES; i++) {
      mask[i] = i < 16 ? 1 : 0;   // primer bloque = herida
      field[i * 4 + 1] = 0.30;    // v = 0.30 en TODAS
    }
    const s = healScore(field, RES, mask, 0.25);
    expect(s).toBeGreaterThan(0.9);
  });

  it('heal 0: ninguna celda herida alcanza target', () => {
    const RES = 8;
    const field = new Float32Array(RES * RES * 4);
    const mask = new Uint8Array(RES * RES);
    for (let i = 0; i < RES * RES; i++) {
      mask[i] = i < 16 ? 1 : 0;
      field[i * 4 + 1] = mask[i] ? 0 : 0.25;   // herida v=0
    }
    const s = healScore(field, RES, mask, 0.25);
    expect(s).toBeLessThan(0.1);
  });

  it('safety: alta presión tumor → score bajo', () => {
    const sHigh = safetyScore(100, 10);    // presión 10 /unidad tiempo
    const sLow  = safetyScore(1,   10);
    expect(sHigh).toBeLessThan(sLow);
    expect(sLow).toBeGreaterThan(0.9);
  });

  it('overall = heal · safety', () => {
    expect(overallScore(0.8, 0.5)).toBeCloseTo(0.4, 5);
    expect(overallScore(1.0, 1.0)).toBe(1);
    expect(overallScore(0, 0.9)).toBe(0);
  });
});
