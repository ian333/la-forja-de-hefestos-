/**
 * Validación del sistema de bonds (Morse) en CPU reference.
 *
 * Para un dímero con enlace Morse el pequeño oscillation period es
 *   T_osc = 2π · √(μ / k)   con  k = 2 D α² (curvatura en r_eq)
 * donde μ = m1·m2/(m1+m2) es la masa reducida.
 *
 * También verificamos que:
 *   · La energía (K + U_Morse) conserva bien.
 *   · Con SKIP-bonded, el LJ no contamina la oscilación del dímero.
 */

import { describe, it, expect } from 'vitest';
import {
  pairwiseStepCpu,
  kineticEnergyCpu,
  bondPotentialCpu,
  ljCpu,
  ljPotentialCpu,
  type PairwiseCpuState,
  type BondList,
  type BondParams,
} from '../pairwise';

function makeState(N: number): PairwiseCpuState {
  return { pos: new Float32Array(N * 4), vel: new Float32Array(N * 4), N };
}

describe('bond CPU — Morse dímero', () => {
  it('periodo de oscilación pequeño ≈ 2π·√(μ/k)', () => {
    // Dos partículas m=1 enlazadas, desplazadas levemente de r_eq.
    const s = makeState(2);
    const params: BondParams = { D: 4, alpha: 2, rEq: 1 };
    const k = 2 * params.D * params.alpha * params.alpha;  // 32
    const mu = 0.5;  // masa reducida 1·1/(1+1)
    const Texpected = 2 * Math.PI * Math.sqrt(mu / k);

    const r0 = params.rEq + 0.02;  // pequeño desplazamiento → régimen armónico
    s.pos[0] = r0 / 2;
    s.pos[4] = -r0 / 2;
    s.vel[3] = 1; s.vel[7] = 1;

    const bonds: BondList = new Int32Array([
      1, -1,    // partícula 0 enlazada a 1
      0, -1,    // partícula 1 enlazada a 0
    ]);

    // Medir periodo por zero-crossings del desplazamiento
    const dt = Texpected / 200;
    let tPrev = 0;
    const crossings: number[] = [];
    let sPrev = r0 - params.rEq;
    for (let step = 0; step < 2000; step++) {
      pairwiseStepCpu(s, [], dt, undefined, { list: bonds, params });
      const r = Math.abs(s.pos[0] - s.pos[4]);
      const disp = r - params.rEq;
      // zero crossing de signo
      if (sPrev * disp < 0) {
        const t = (step + 1) * dt;
        crossings.push(t);
        tPrev = t;
      }
      sPrev = disp;
      if (crossings.length >= 5) break;
    }
    expect(crossings.length).toBeGreaterThanOrEqual(4);
    // Periodo = 2·(tiempo entre cruces consecutivos de signo)
    const halfPeriod = (crossings[crossings.length - 1] - crossings[0]) / (crossings.length - 1);
    const Tmeas = 2 * halfPeriod;
    const rel = Math.abs(Tmeas - Texpected) / Texpected;
    expect(rel).toBeLessThan(0.1);
    void tPrev;
  });

  it('energía (K + U_Morse) conserva a ~1% en 2000 pasos', () => {
    const s = makeState(2);
    const params: BondParams = { D: 2, alpha: 2, rEq: 1 };
    s.pos[0] =  0.5 + 0.08;
    s.pos[4] = -0.5;
    s.vel[3] = 1; s.vel[7] = 1;
    const bonds: BondList = new Int32Array([1, -1, 0, -1]);

    const E0 = kineticEnergyCpu(s) + bondPotentialCpu(s, bonds, params);
    const dt = 0.002;
    for (let k = 0; k < 2000; k++) {
      pairwiseStepCpu(s, [], dt, undefined, { list: bonds, params });
    }
    const Ef = kineticEnergyCpu(s) + bondPotentialCpu(s, bonds, params);
    expect(Math.abs((Ef - E0) / E0)).toBeLessThan(0.015);
  });

  it('skip-bonded: LJ NO altera la dinámica del par enlazado', () => {
    // Configuramos un dímero + una partícula lejana. Sin skip-bonded, LJ
    // entre los dos átomos del dímero afectaría la oscilación.
    const s = makeState(3);
    const params: BondParams = { D: 4, alpha: 2, rEq: 1 };
    s.pos[0 ] =  0.5;   // átomo 0
    s.pos[4 ] = -0.5;   // átomo 1 (bonded con 0)
    s.pos[8 ] =  10;    // átomo 2 muy lejos
    for (let i = 0; i < 3; i++) s.vel[i*4+3] = 1;

    const bonds: BondList = new Int32Array([
      1, -1,
      0, -1,
      -1, -1,
    ]);
    const lj = ljCpu({ sigma: [1, 1, 1, 1], epsilon: [1, 1, 1, 1] });
    const dt = 0.002;
    // La separación del dímero debe oscilar cerca de r_eq=1 (LJ entre 0 y 1
    // está deshabilitado por skip-bonded). Si se colara, r oscilaría lejos
    // de r_eq porque el mínimo LJ está en ~1.12, no 1.
    for (let step = 0; step < 500; step++) {
      pairwiseStepCpu(s, [lj], dt, undefined, { list: bonds, params });
    }
    const r = Math.abs(s.pos[0] - s.pos[4]);
    // sin skip-bonded, r tendería a ~1.12 (mínimo LJ) + oscilación; con skip,
    // r oscila cerca de 1. Margen generoso para ruido numérico.
    expect(Math.abs(r - params.rEq)).toBeLessThan(0.1);
  });

  it('dímero + bath LJ: el enlace sobrevive 500 pasos a T moderada', () => {
    // 1 dímero + 14 átomos libres en caja pequeña, todos con LJ.
    // El enlace Morse es fuerte (D=5) → debe sostenerse aún con LJ ruido.
    const N = 16;
    const s = makeState(N);
    const L = 4;
    let idx = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 2; k++, idx++) {
          s.pos[idx*4  ] = -L/2 + (k + 0.5) * L/2;
          s.pos[idx*4+1] = -L/2 + (j + 0.5) * L/2;
          s.pos[idx*4+2] = -L/2 + (i + 0.5) * L/4;
          s.vel[idx*4  ] = 0.3 * (Math.sin(idx*1.7));
          s.vel[idx*4+1] = 0.3 * (Math.sin(idx*2.3));
          s.vel[idx*4+2] = 0.3 * (Math.sin(idx*3.1));
          s.vel[idx*4+3] = 1;
        }
      }
    }
    // Acercamos 0 y 1 para enlazarlos cerca de r_eq
    s.pos[0] = 0; s.pos[1] = 0; s.pos[2] = 0;
    s.pos[4] = 1; s.pos[5] = 0; s.pos[6] = 0;
    const bonds: BondList = new Int32Array(N * 2).fill(-1);
    bonds[0] = 1; bonds[2] = 0;

    const params: BondParams = { D: 5, alpha: 2, rEq: 1 };
    const lj = ljCpu({ sigma: [1, 1, 1, 1], epsilon: [1, 1, 1, 1] });
    for (let step = 0; step < 500; step++) {
      pairwiseStepCpu(s, [lj], 0.001, L, { list: bonds, params });
    }
    const r = Math.abs(Math.hypot(
      s.pos[0] - s.pos[4],
      s.pos[1] - s.pos[5],
      s.pos[2] - s.pos[6],
    ));
    // Oscila pero el enlace se mantiene dentro de ±30% de r_eq
    expect(r).toBeGreaterThan(0.6);
    expect(r).toBeLessThan(1.4);
    // Sanity: el bath no explotó
    const E = kineticEnergyCpu(s) + ljPotentialCpu(s, { sigma: [1,1,1,1], epsilon: [1,1,1,1] }, L);
    expect(Number.isFinite(E)).toBe(true);
  });
});
