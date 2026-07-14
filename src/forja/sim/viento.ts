/**
 * ✈️ ESTUDIO VIENTO (supersónico) — el análisis aerodinámico de La Forja CAD
 * ==========================================================================
 * Hermano del FEA: el alumno CONSTRUYE la pieza (cuña) en el Part Studio y
 * este estudio la analiza. Nada de laboratorios aparte: la pieza es la del
 * kernel, la forma (semiángulo δ) se MIDE de su bbox.
 *
 * FÍSICA (Anderson 6ª ed., cap. 1 §1.5 + cap. 9):
 *   · Atmósfera: ISA real (src/aero/atmosfera.ts, 8/8 tests vs ISO 2533).
 *   · Choque oblicuo: β de la relación θ-β-M (rama débil) y el salto de
 *     presión p₂/p₁ = 1 + 2γ/(γ+1)·(M₁²sin²β − 1) — la presión sobre las
 *     caras NO es un número copiado del libro: EMERGE del choque.
 *     (Para δ=5°, M=2, nivel del mar: p₂ ≈ 1.31×10⁵ Pa — Ejemplo 1.1.)
 *   · Cortante: τ_w = 431·s^(−0.2) — distribución EMPÍRICA dada por el
 *     Ejemplo 1.1 (ETIQUETADA como tal; el modelo general de capa límite
 *     llega con capa-limite.ts en U4-L7).
 *   · D′ = ∮(−p·n̂ + τ·t̂)·x̂ ds integrado por paneles (ec. 1.8): las DOS
 *     manos del aire y ninguna más.
 */

import { atmosferaISA } from '@/aero/atmosfera';
import { betaChoqueOblicuo } from '@/aero/cuna-anderson';

export interface VientoSuperParams {
  /** semiángulo de la cuña [rad] — MEDIDO de la pieza (atan(semialtura/cuerda)) */
  delta: number;
  /** cuerda del ANÁLISIS [m] (la pieza se dibuja a escala; el análisis corre a tamaño real) */
  cuerdaM: number;
  mach: number;
  /** altitud ISA [m] */
  hM: number;
  nPaneles: number;
}

export interface VientoSuperResultado {
  deltaDeg: number;
  beta: number;
  betaDeg: number;
  /** presión sobre las caras tras el choque [Pa] */
  p2: number;
  pInf: number;
  rho: number;
  T: number;
  aSonido: number;
  V: number;
  q: number;
  Dp: number;
  Df: number;
  D: number;
  cd: number;
  fraccionPresion: number;
  nPaneles: number;
  mach: number;
  hM: number;
  cuerdaM: number;
}

const GAMMA = 1.4;
const TAU_K = 431;      // τ = 431·s^−0.2 — empírico del Ejemplo 1.1 (Anderson)
const TAU_EXP = -0.2;

export function estudioVientoSupersonico(prm: VientoSuperParams): VientoSuperResultado {
  const { delta, cuerdaM: c, mach, hM, nPaneles: n } = prm;
  const atm = atmosferaISA(hM);
  const V = mach * atm.aSonido;
  const q = 0.5 * atm.rho * V * V;

  // choque oblicuo débil → presión sobre las caras
  const beta = betaChoqueOblicuo(mach, delta, GAMMA);
  const M1n2 = (mach * Math.sin(beta)) ** 2;
  const p2 = atm.p * (1 + (2 * GAMMA / (GAMMA + 1)) * (M1n2 - 1));

  // integral por paneles (ec. 1.8) sobre las dos caras inclinadas + base a p∞
  const L = c / Math.cos(delta);
  const ds = L / n;
  let DpCaras = 0;
  for (let i = 0; i < n; i++) DpCaras += p2 * Math.sin(delta) * ds;
  DpCaras *= 2;
  const DpBase = -atm.p * (2 * c * Math.tan(delta));
  let Df = 0;
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) * ds;
    Df += TAU_K * Math.pow(s, TAU_EXP) * Math.cos(delta) * ds;
  }
  Df *= 2;

  const Dp = DpCaras + DpBase;
  const D = Dp + Df;
  return {
    deltaDeg: delta * 180 / Math.PI,
    beta, betaDeg: beta * 180 / Math.PI,
    p2, pInf: atm.p, rho: atm.rho, T: atm.T, aSonido: atm.aSonido, V, q,
    Dp, Df, D,
    cd: D / (q * c),
    fraccionPresion: D !== 0 ? Dp / D : 0,
    nPaneles: n, mach, hM, cuerdaM: c,
  };
}
