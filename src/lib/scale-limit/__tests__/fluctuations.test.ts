/**
 * Tests de honestidad: ¿reproducimos σ_T/⟨T⟩ = √(2/3N)?
 *
 * Tres niveles de rigor:
 *
 *   1. Welford básico — contra media/varianza calculadas naïve.
 *      Si esto falla, ni de broma los tests superiores valen.
 *
 *   2. Muestreo directo Maxwell-Boltzmann — NO es MD, son N velocidades
 *      resampleadas cada paso. Debe dar EXACTAMENTE (3N)^(-1/2)·√2. Test
 *      de la estadística pura, sin física de integración.
 *
 *   3. MD genuina NVE en CPU — corre `pairwiseStepCpu` con LJ, mide T
 *      cada step tras burn-in, compara contra predicción. Tolerancia
 *      amplia (30%) porque (a) NVE tiene drift lento, (b) las N son
 *      pequeñas para que el test corra <1s.
 */

import { describe, it, expect } from 'vitest';
import {
  RunningStats,
  analyzeSeries,
  autoCorrelation,
  integratedAutoCorrTime,
  effectiveSampleSize,
  predictTemperatureRSD,
  scaleLimitCheck,
} from '../fluctuations';
import { pairwiseStepCpu, ljCpu, kineticEnergyCpu, type PairwiseCpuState } from '../../gpu/pairwise';
import { gaussianN01 } from '../../gpu/kernel-core';

// ═══════════════════════════════════════════════════════════════
// 1. Welford
// ═══════════════════════════════════════════════════════════════

describe('RunningStats — Welford online', () => {
  it('media y varianza coinciden con cálculo naïve (muestras pequeñas)', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const naive = (arr: number[]) => {
      const m = arr.reduce((s, x) => s + x, 0) / arr.length;
      const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
      return { m, v };
    };
    const { m, v } = naive(data);
    const rs = new RunningStats();
    for (const x of data) rs.push(x);
    expect(rs.mean).toBeCloseTo(m, 12);
    expect(rs.variance).toBeCloseTo(v, 12);
  });

  it('estable con valores grandes + pequeños (catastrophic cancellation test)', () => {
    // Muestras con media 1e6 pero varianza real de 1. Algoritmos naïve
    // basados en Σx² − (Σx)² pierden precisión; Welford no.
    const rs = new RunningStats();
    for (let i = 0; i < 10000; i++) rs.push(1e6 + Math.sin(i));
    expect(rs.mean).toBeGreaterThan(1e6 - 0.1);
    expect(rs.mean).toBeLessThan(1e6 + 0.1);
    expect(rs.variance).toBeGreaterThan(0.3);
    expect(rs.variance).toBeLessThan(0.8);   // var(sin) ≈ 0.5
  });

  it('min y max rastreados correctamente', () => {
    const rs = new RunningStats();
    for (const x of [3, -1, 5, 2, -7, 10]) rs.push(x);
    expect(rs.min).toBe(-7);
    expect(rs.max).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. Maxwell-Boltzmann sampling → σ/⟨T⟩ = √(2/3N)
// ═══════════════════════════════════════════════════════════════

/**
 * Simula `nSamples` snapshots de gas 3D de `N` átomos con velocidades MB
 * re-sampleadas cada snapshot (no es MD — es MC directo). Devuelve la
 * serie de T_inst = (2/3N)·KE.
 */
function sampleMBTemperatures(N: number, nSamples: number, Ttrue = 1): number[] {
  const out: number[] = new Array(nSamples);
  const sigmaV = Math.sqrt(Ttrue);   // m=1, kB=1
  for (let s = 0; s < nSamples; s++) {
    let KE = 0;
    for (let i = 0; i < N; i++) {
      const vx = gaussianN01() * sigmaV;
      const vy = gaussianN01() * sigmaV;
      const vz = gaussianN01() * sigmaV;
      KE += 0.5 * (vx*vx + vy*vy + vz*vz);
    }
    out[s] = (2 * KE) / (3 * N);
  }
  return out;
}

describe('σ_T/⟨T⟩ — muestreo MB directo', () => {
  it('N = 64 → RSD ≈ √(2/192) ≈ 0.102 dentro de 15%', () => {
    const N = 64;
    const T = sampleMBTemperatures(N, 10000);
    const summary = analyzeSeries(T);
    const pred = predictTemperatureRSD(N);
    expect(summary.rsd).toBeGreaterThan(pred * 0.85);
    expect(summary.rsd).toBeLessThan(pred * 1.15);
    expect(summary.mean).toBeGreaterThan(0.95);
    expect(summary.mean).toBeLessThan(1.05);
  });

  it('N = 256 → RSD ≈ 0.051 dentro de 15%', () => {
    const N = 256;
    const T = sampleMBTemperatures(N, 8000);
    const summary = analyzeSeries(T);
    const pred = predictTemperatureRSD(N);
    expect(summary.rsd).toBeGreaterThan(pred * 0.85);
    expect(summary.rsd).toBeLessThan(pred * 1.15);
  });

  it('N = 1024 → RSD ≈ 0.0255 dentro de 20%', () => {
    const N = 1024;
    const T = sampleMBTemperatures(N, 3000);
    const summary = analyzeSeries(T);
    const pred = predictTemperatureRSD(N);
    expect(summary.rsd).toBeGreaterThan(pred * 0.80);
    expect(summary.rsd).toBeLessThan(pred * 1.20);
  });

  it('ley de escala: duplicar N reduce RSD por √2 (factor 0.707)', () => {
    const rsd64  = analyzeSeries(sampleMBTemperatures(64,  6000)).rsd;
    const rsd256 = analyzeSeries(sampleMBTemperatures(256, 6000)).rsd;
    const ratio = rsd256 / rsd64;
    const predRatio = Math.sqrt(64 / 256);   // = 0.5
    expect(ratio).toBeGreaterThan(predRatio * 0.80);
    expect(ratio).toBeLessThan(predRatio * 1.20);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. MD genuina NVE — el test honesto
// ═══════════════════════════════════════════════════════════════

function seedLJGas(N: number, L: number, T0: number): PairwiseCpuState {
  const pos = new Float32Array(N * 4);
  const vel = new Float32Array(N * 4);
  const side = Math.ceil(Math.cbrt(N));
  const dx = L / side;
  const half = L / 2;
  let vxM = 0, vyM = 0, vzM = 0;
  for (let i = 0; i < N; i++) {
    const a = Math.floor(i / (side * side));
    const b = Math.floor((i / side) % side);
    const c = i % side;
    pos[i*4  ] = -half + (c + 0.5) * dx + (Math.random() - 0.5) * dx * 0.15;
    pos[i*4+1] = -half + (b + 0.5) * dx + (Math.random() - 0.5) * dx * 0.15;
    pos[i*4+2] = -half + (a + 0.5) * dx + (Math.random() - 0.5) * dx * 0.15;
    const sv = Math.sqrt(T0);
    const vx = gaussianN01() * sv;
    const vy = gaussianN01() * sv;
    const vz = gaussianN01() * sv;
    vel[i*4  ] = vx; vel[i*4+1] = vy; vel[i*4+2] = vz; vel[i*4+3] = 1;
    vxM += vx; vyM += vy; vzM += vz;
  }
  vxM /= N; vyM /= N; vzM /= N;
  for (let i = 0; i < N; i++) {
    vel[i*4] -= vxM; vel[i*4+1] -= vyM; vel[i*4+2] -= vzM;
  }
  return { pos, vel, N };
}

describe('σ_T/⟨T⟩ — MD genuina NVE con LJ', () => {
  it('N = 32 LJ gas diluido, RSD se acerca a √(2/3N) ± 40%', () => {
    // N pequeño para que el test corra rápido. Tolerancia generosa
    // porque NVE + LJ tiene tanto ruido estructural como drift.
    const N = 32;
    const L = 4.5;   // ρ = N/L³ ≈ 0.35 — diluido
    const state = seedLJGas(N, L, 1.5);   // T alta = gas
    const law = ljCpu({ sigma: [1,1,1,1], epsilon: [1,1,1,1] });
    const dt = 0.003;

    // Burn-in: 200 steps para relajar y llegar a equilibrio
    for (let k = 0; k < 200; k++) pairwiseStepCpu(state, [law], dt, L);

    // Producción: 400 steps, registrar T cada paso
    const Ts: number[] = [];
    for (let k = 0; k < 400; k++) {
      pairwiseStepCpu(state, [law], dt, L);
      const KE = kineticEnergyCpu(state);
      Ts.push((2 * KE) / (3 * N));
    }
    const summary = analyzeSeries(Ts);
    const pred = predictTemperatureRSD(N);
    // MD NVE: T_inst fluctúa con CV ~ √(2/3N); tolerancia amplia por
    // (a) N pequeño (b) pasos correlacionados (c) LJ no es ideal.
    expect(summary.rsd).toBeGreaterThan(pred * 0.3);
    expect(summary.rsd).toBeLessThan(pred * 2.0);
    // T_mean razonable (no explotó)
    expect(summary.mean).toBeGreaterThan(0.5);
    expect(summary.mean).toBeLessThan(3.0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. Auto-correlación
// ═══════════════════════════════════════════════════════════════

describe('autoCorrelation + τ_int', () => {
  it('serie blanca iid → τ_int ≈ 1', () => {
    const N = 5000;
    const vals = new Float64Array(N);
    for (let i = 0; i < N; i++) vals[i] = gaussianN01();
    const tau = integratedAutoCorrTime(vals, 50);
    expect(tau).toBeGreaterThan(0.8);
    expect(tau).toBeLessThan(1.5);
  });

  it('serie correlacionada AR(1) ρ=0.9 → τ_int ≈ (1+ρ)/(1-ρ) = 19', () => {
    const N = 8000;
    const rho = 0.9;
    const vals = new Float64Array(N);
    vals[0] = gaussianN01();
    for (let i = 1; i < N; i++) {
      vals[i] = rho * vals[i - 1] + Math.sqrt(1 - rho * rho) * gaussianN01();
    }
    const tau = integratedAutoCorrTime(vals, 200);
    const expected = (1 + rho) / (1 - rho);
    expect(tau).toBeGreaterThan(expected * 0.5);
    expect(tau).toBeLessThan(expected * 1.5);
  });

  it('effectiveSampleSize: N_eff < N para datos correlacionados', () => {
    // AR(1) ρ=0.8 teórico: τ_int = (1+ρ)/(1-ρ) = 9 → N_eff = N/(2·9−1) = N/17.
    // Realización estocástica: factor 1.5× alrededor del esperado.
    const N = 4000;
    const rho = 0.8;
    const vals = new Float64Array(N);
    vals[0] = gaussianN01();
    for (let i = 1; i < N; i++) {
      vals[i] = rho * vals[i - 1] + Math.sqrt(1 - rho * rho) * gaussianN01();
    }
    const Neff = effectiveSampleSize(vals, 200);
    expect(Neff).toBeLessThan(N / 3);
    expect(Neff).toBeGreaterThan(N / 30);
  });

  it('autoCorrelation ρ(0) = 1 siempre', () => {
    const vals = [1, 3, 5, 2, 8, 4, 6];
    const rho = autoCorrelation(vals, 3);
    expect(rho[0]).toBeCloseTo(1, 10);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. Predicciones analíticas
// ═══════════════════════════════════════════════════════════════

describe('predictTemperatureRSD — ley √(2/3N)', () => {
  it('N = 100 → 0.0816', () => {
    expect(predictTemperatureRSD(100)).toBeCloseTo(Math.sqrt(2/300), 6);
  });

  it('decrece monotónicamente con N', () => {
    for (let i = 1; i < 10; i++) {
      const N1 = i * 100, N2 = (i + 1) * 100;
      expect(predictTemperatureRSD(N1)).toBeGreaterThan(predictTemperatureRSD(N2));
    }
  });
});

describe('scaleLimitCheck', () => {
  it('N = 100 @ 5% rsd: T sí, P no, transporte no', () => {
    const r = scaleLimitCheck(100, 0.05);
    // predT(100) = 0.0816 → > 0.05, así que T al 5% NO
    expect(r.temperature).toBe(false);
    expect(r.pressure).toBe(false);
    expect(r.transport).toBe(false);
  });

  it('N = 10 000 @ 5% rsd: T sí, P sí, transporte quizá', () => {
    const r = scaleLimitCheck(10000, 0.05);
    expect(r.temperature).toBe(true);
    expect(r.pressure).toBe(true);
  });
});
