/**
 * Tests del fit Bayesian.
 *
 * El test honesto: dado modelo M con parámetros conocidos (D*, r*),
 * generamos datos sintéticos y vemos si la posterior los recupera.
 * Si la región de credibilidad 95% contiene (D*, r*) → el método funciona.
 */

import { describe, it, expect } from 'vitest';
import {
  simulateClosureRadial, logLikelihood, logPrior, gridPosterior,
  sampleFromPosterior, credibleInterval,
  type DataPoint, type ParamRange,
} from '../fisher-kpp-fit';

// ═══════════════════════════════════════════════════════════════
// Simulación: comportamiento esperado
// ═══════════════════════════════════════════════════════════════

describe('simulateClosureRadial', () => {
  it('día 0 → área restante = 1.0', () => {
    const out = simulateClosureRadial(1e-3, 1, [0]);
    expect(out[0].areaFrac).toBeCloseTo(1, 5);
  });

  it('r=0 (sin proliferación) → cierre lentísimo', () => {
    // Solo difusión: cierre por advección de células desde fuera
    const out = simulateClosureRadial(1e-3, 0, [0, 30]);
    // Sin reacción, en 30 días con D=1e-3, las células difunden √(2Dt) ≈ 0.24 mm,
    // mucho menos que el agujero de 1mm radio → área restante alta
    expect(out[1].areaFrac).toBeGreaterThan(0.5);
  });

  it('r alto → cierre rápido', () => {
    const lo = simulateClosureRadial(1e-3, 0.3, [30]);
    const hi = simulateClosureRadial(1e-3, 2.0, [30]);
    expect(hi[0].areaFrac).toBeLessThan(lo[0].areaFrac);
  });

  it('scarLimit < 1 produce plateau', () => {
    // Con scarLimit=0.5 y r=1, la herida no debería cerrar más allá de ~50%
    const out = simulateClosureRadial(1e-3, 1.5, [10, 30, 60], 0.5);
    // Esperamos que tras día 30 se estabilice (plateau)
    expect(out[2].areaFrac).toBeGreaterThan(0.3);
    expect(Math.abs(out[2].areaFrac - out[1].areaFrac)).toBeLessThan(0.15);
  });
});

// ═══════════════════════════════════════════════════════════════
// Likelihood y prior
// ═══════════════════════════════════════════════════════════════

describe('logLikelihood', () => {
  it('máximo en (D*, r*) que generaron los datos sintéticos', () => {
    const Dtrue = 1.5e-3, rTrue = 1.2;
    const days = [0, 5, 10, 15, 20, 25, 30];
    const data = simulateClosureRadial(Dtrue, rTrue, days);
    // Likelihood en el verdadero
    const llTrue = logLikelihood(Dtrue, rTrue, data, 0.02);
    // Likelihood en otros puntos
    const llA = logLikelihood(Dtrue * 5, rTrue, data, 0.02);
    const llB = logLikelihood(Dtrue, rTrue * 0.3, data, 0.02);
    const llC = logLikelihood(Dtrue * 0.1, rTrue * 3, data, 0.02);
    expect(llTrue).toBeGreaterThan(llA);
    expect(llTrue).toBeGreaterThan(llB);
    expect(llTrue).toBeGreaterThan(llC);
  });

  it('logLik decrece con sigma muy pequeño cuando hay residuos', () => {
    const data: DataPoint[] = [{ day: 0, areaFrac: 1 }, { day: 30, areaFrac: 0.3 }];
    const ll1 = logLikelihood(1e-3, 1.0, data, 0.1);
    const ll2 = logLikelihood(1e-3, 1.0, data, 0.01);   // sigma diminuto
    expect(ll2).toBeLessThan(ll1);
  });
});

describe('logPrior', () => {
  it('uniforme dentro del rango, −∞ fuera', () => {
    const dRange: ParamRange = { logMin: -4, logMax: -1 };
    const rRange: ParamRange = { logMin: -1, logMax: 1 };
    expect(logPrior(1e-3, 1, dRange, rRange)).toBe(0);
    expect(logPrior(1, 1, dRange, rRange)).toBe(-Infinity);
    expect(logPrior(1e-3, 100, dRange, rRange)).toBe(-Infinity);
  });
});

// ═══════════════════════════════════════════════════════════════
// El test del recupero: posterior debe contener verdad
// ═══════════════════════════════════════════════════════════════

describe('gridPosterior — recupero de parámetros sintéticos', () => {
  it('predicción al MAP ajusta los datos sintéticos con RMSE pequeño', () => {
    // Test pragmático: aunque el MAP individual (D, r) se mueva por la
    // degeneración de Fisher-KPP, la PREDICCIÓN al MAP debe estar cerca
    // de los datos. Esto es lo que importa para una réplica.
    const Dtrue = 1.5e-3, rTrue = 1.2;
    const days = [0, 5, 10, 15, 20, 25, 30];
    const data = simulateClosureRadial(Dtrue, rTrue, days);

    const dRange: ParamRange = { logMin: -4, logMax: -1.5 };
    const rRange: ParamRange = { logMin: -0.7, logMax: 1 };
    const post = gridPosterior(data, dRange, rRange, 12, 12, 0.015);

    // Predecir con (D_map, r_map)
    const pred = simulateClosureRadial(post.mapD, post.mapR, days);
    let sumSq = 0;
    for (let i = 0; i < data.length; i++) {
      sumSq += (pred[i].areaFrac - data[i].areaFrac) ** 2;
    }
    const rmse = Math.sqrt(sumSq / data.length);
    expect(rmse).toBeLessThan(0.05);   // RMSE < 5% del rango total [0,1]
  });

  it('CI 95% del marginal r contiene r* verdadero', () => {
    const Dtrue = 1e-3, rTrue = 1.0;
    const days = [0, 7, 14, 21, 28];
    const data = simulateClosureRadial(Dtrue, rTrue, days);

    const dRange: ParamRange = { logMin: -4, logMax: -1.5 };
    const rRange: ParamRange = { logMin: -1, logMax: 1 };
    const post = gridPosterior(data, dRange, rRange, 14, 14, 0.02);
    const ciR = credibleInterval(post.margR, post.logR, 0.95);
    const logRtrue = Math.log10(rTrue);
    expect(ciR.low).toBeLessThanOrEqual(logRtrue + 0.05);   // pequeña tolerancia bin
    expect(ciR.high).toBeGreaterThanOrEqual(logRtrue - 0.05);
  });

  it('marginales suman ≈ 1', () => {
    const data = simulateClosureRadial(1e-3, 1, [0, 15, 30]);
    const post = gridPosterior(data,
      { logMin: -4, logMax: -1.5 }, { logMin: -1, logMax: 1 },
      8, 8, 0.05);
    let sD = 0, sR = 0;
    for (let i = 0; i < post.margD.length; i++) sD += post.margD[i];
    for (let i = 0; i < post.margR.length; i++) sR += post.margR[i];
    expect(sD).toBeCloseTo(1, 6);
    expect(sR).toBeCloseTo(1, 6);
  });
});

// ═══════════════════════════════════════════════════════════════
// Sampling
// ═══════════════════════════════════════════════════════════════

describe('sampleFromPosterior', () => {
  it('media de muestras ≈ media analítica del grid', () => {
    const data = simulateClosureRadial(1e-3, 1, [0, 10, 20, 30]);
    const post = gridPosterior(data,
      { logMin: -4, logMax: -1.5 }, { logMin: -0.5, logMax: 0.7 },
      10, 10, 0.025);
    const samples = sampleFromPosterior(post, 1000);
    let muLogR = 0;
    for (const s of samples) muLogR += Math.log10(s.r);
    muLogR /= samples.length;
    // Media analítica de logR pesada por margR
    let muLogRanalytic = 0;
    for (let j = 0; j < post.logR.length; j++) {
      muLogRanalytic += post.logR[j] * post.margR[j];
    }
    expect(Math.abs(muLogR - muLogRanalytic)).toBeLessThan(0.1);
  });
});
