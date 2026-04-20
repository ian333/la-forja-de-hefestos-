/**
 * ══════════════════════════════════════════════════════════════════════
 *  stiff-solver — Implicit Euler + Richardson extrapolation
 * ══════════════════════════════════════════════════════════════════════
 *
 * RK4 explícito falla en sistemas stiff: radicales de combustión, Robertson
 * 1966, mecanismos atmosféricos. El factor-problema es que la escala de
 * tiempo mínima (radical lifetime ~ 10⁻¹² s) fuerza dt ridículamente pequeño.
 *
 * Esquema usado aquí:
 *   1. Implicit Euler (IE): y_{n+1} = y_n + h·f(y_{n+1})        [1er orden, L-estable]
 *      Resuelto con Newton iterativo sobre G(z) = z − y − h·f(z).
 *   2. Step-doubling: un paso de tamaño h → y_full
 *                     dos pasos de tamaño h/2 → y_half
 *      Diferencia = estimación de error (O(h²)).
 *   3. Extrapolación de Richardson:
 *        y_exact ≈ 2·y_half − y_full         [orden elevado de 1 a 2]
 *   4. Control de paso PI tradicional.
 *
 * Ventajas:
 *   - L-estable (dampening correcto en stiff limit) — necesario para Robertson.
 *   - 2º orden efectivo tras Richardson.
 *   - Un único parámetro γ (=1) implícito, simple de razonar.
 *
 * Costo: 3 factorizaciones LU por paso aceptado (una por sub-paso Newton).
 * Es más caro que un Rosenbrock bien hecho pero robusto.
 *
 * Ref [S1] Hairer, E. & Wanner, G. "Solving ODEs II — Stiff and DAE",
 *          Springer, 1996. §IV.8 (step-doubling y Richardson).
 * Ref [S2] Robertson, H.H. "The solution of a set of reaction rate
 *          equations", Numerical Analysis, J. Walsh ed., 1966.
 */

import { identityMinus, luFactor, luSolve, vec } from './linalg';

export type OdeFn = (t: number, y: number[]) => number[];

// ═══════════════════════════════════════════════════════════════
// Jacobiano numérico por diferencias finitas
// ═══════════════════════════════════════════════════════════════

/**
 * J_{ij} = ∂f_i / ∂y_j vía diferencia adelantada (error O(ε)).
 * ε adaptativa: max(sqrt(macheps)·|y_j|, sqrt(macheps)).
 */
export function jacobianFD(f: OdeFn, t: number, y: number[], f0?: number[]): number[][] {
  const n = y.length;
  const J: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const fy = f0 ?? f(t, y);
  const eps = Math.sqrt(Number.EPSILON);
  for (let j = 0; j < n; j++) {
    const h = Math.max(eps * Math.abs(y[j]), eps);
    const yj0 = y[j];
    y[j] = yj0 + h;
    const fp = f(t, y);
    y[j] = yj0;
    for (let i = 0; i < n; i++) {
      J[i][j] = (fp[i] - fy[i]) / h;
    }
  }
  return J;
}

// ═══════════════════════════════════════════════════════════════
// Paso único — Implicit Euler con Newton amortiguado
// ═══════════════════════════════════════════════════════════════

export interface IEStepResult {
  yNew: number[];
  converged: boolean;
  iters: number;
}

/**
 * Implicit Euler: y_{n+1} = y_n + h·f(t+h, y_{n+1}).
 *
 * Newton: solve G(z) = z − y − h·f(z) = 0
 *        G'(z) = I − h·J(z)
 *        z^{k+1} = z^k − [G'(z^k)]⁻¹ · G(z^k)
 *
 * Inicialización: z₀ = y + h·f(y) (paso explícito de Euler).
 * Convergencia: ‖Δz‖∞ < tol.
 */
export function implicitEulerStep(
  f: OdeFn,
  t: number,
  y: number[],
  h: number,
  opts: { maxIter?: number; tol?: number } = {},
): IEStepResult {
  const maxIter = opts.maxIter ?? 15;
  const tol = opts.tol ?? 1e-10;
  const n = y.length;

  // Paso predictor explícito como guess inicial
  const fy = f(t, y);
  let z = new Array(n);
  for (let i = 0; i < n; i++) z[i] = y[i] + h * fy[i];

  let converged = false;
  let iters = 0;
  let prevNorm = Infinity;

  for (let k = 0; k < maxIter; k++) {
    iters = k + 1;
    const fz = f(t + h, z);
    // G(z) = z − y − h·f(z)
    const G = new Array(n);
    for (let i = 0; i < n; i++) G[i] = z[i] - y[i] - h * fz[i];

    const gnorm = vec.normInf(G);
    if (gnorm < tol) {
      converged = true;
      break;
    }

    const J = jacobianFD(f, t + h, z, fz);
    const W = identityMinus(h, J);
    const lu = luFactor(W);
    if (lu.singular) break;
    const dz = luSolve(lu, G);
    const dzNorm = vec.normInf(dz);

    // Línea de búsqueda mínima: si la residual diverge, no aceptar
    for (let i = 0; i < n; i++) z[i] -= dz[i];

    // Divergence check
    if (k > 0 && dzNorm > 2 * prevNorm) break;
    prevNorm = dzNorm;

    if (dzNorm < tol) {
      converged = true;
      break;
    }
  }

  return { yNew: z, converged, iters };
}

// ═══════════════════════════════════════════════════════════════
// Paso combinado con Richardson (1 big + 2 small)
// ═══════════════════════════════════════════════════════════════

export interface StiffStepResult {
  yNew: number[];
  yErr: number[];
  converged: boolean;
}

/**
 * Un paso de tamaño h usando step-doubling:
 *   y_full ← IE(y, h)       [1 paso]
 *   y_mid  ← IE(y, h/2)     [½ paso]
 *   y_half ← IE(y_mid, h/2) [½ paso]
 * Extrapolación de Richardson: y_new = 2·y_half − y_full (orden 2).
 * Error estimado: y_half − y_full.
 */
export function stiffStep(
  f: OdeFn,
  t: number,
  y: number[],
  h: number,
  opts: { maxIter?: number; tol?: number } = {},
): StiffStepResult {
  const big = implicitEulerStep(f, t, y, h, opts);
  if (!big.converged) return { yNew: big.yNew, yErr: y.slice(), converged: false };

  const mid = implicitEulerStep(f, t, y, h / 2, opts);
  if (!mid.converged) return { yNew: mid.yNew, yErr: y.slice(), converged: false };

  const small = implicitEulerStep(f, t + h / 2, mid.yNew, h / 2, opts);
  if (!small.converged) return { yNew: small.yNew, yErr: y.slice(), converged: false };

  const n = y.length;
  const yNew = new Array(n);
  const yErr = new Array(n);
  for (let i = 0; i < n; i++) {
    // Richardson: (y_exacta − y_h) ≈ 2·(y_exacta − y_{h/2}) → y_exacta ≈ 2·y_half − y_full
    yNew[i] = 2 * small.yNew[i] - big.yNew[i];
    yErr[i] = small.yNew[i] - big.yNew[i];
  }
  return { yNew, yErr, converged: true };
}

// ═══════════════════════════════════════════════════════════════
// Integración adaptativa
// ═══════════════════════════════════════════════════════════════

export interface StiffOptions {
  rtol?: number;
  atol?: number;
  hInit?: number;
  hMin?: number;
  hMax?: number;
  maxSteps?: number;
  clampNonNeg?: boolean;
}

export interface StiffResult {
  t: number[];
  y: number[][];
  steps: number;
  rejected: number;
}

/** Integración con paso adaptativo tipo PI. */
export function solveStiff(
  f: OdeFn,
  t0: number,
  y0: number[],
  tFinal: number,
  opts: StiffOptions = {},
): StiffResult {
  const rtol = opts.rtol ?? 1e-6;
  const atol = opts.atol ?? 1e-9;
  const hMin = opts.hMin ?? (tFinal - t0) * 1e-14;
  const hMax = opts.hMax ?? (tFinal - t0);
  const maxSteps = opts.maxSteps ?? 50000;
  const clamp = opts.clampNonNeg ?? true;

  const tOut: number[] = [t0];
  const yOut: number[][] = [y0.slice()];

  let t = t0;
  let y = y0.slice();
  let h = opts.hInit ?? Math.min(hMax, Math.max(hMin, (tFinal - t0) * 1e-4));

  let steps = 0;
  let rejected = 0;
  const SAFETY = 0.9;
  const FAC_MIN = 0.2;
  const FAC_MAX = 5.0;
  const ORDER = 2; // Richardson eleva IE(1) → 2do orden

  while (t < tFinal && steps < maxSteps) {
    if (t + h > tFinal) h = tFinal - t;
    if (h < hMin) h = hMin;

    const res = stiffStep(f, t, y, h);

    if (!res.converged) {
      // Newton no convergió — reducir h agresivamente
      rejected++;
      h *= 0.25;
      if (h < hMin) {
        // Ya no podemos reducir — aceptar con error alto
        t += Math.max(hMin, h);
        y = res.yNew;
        if (clamp) for (let i = 0; i < y.length; i++) if (y[i] < 0) y[i] = 0;
        tOut.push(t); yOut.push(y.slice());
        steps++;
        h = hMin;
      }
      continue;
    }

    if (clamp) {
      for (let i = 0; i < res.yNew.length; i++) if (res.yNew[i] < 0) res.yNew[i] = 0;
    }

    // Norma WRMS del error
    const sc = y.map((yi, i) =>
      atol + rtol * Math.max(Math.abs(yi), Math.abs(res.yNew[i])),
    );
    const err = vec.wrmsNorm(res.yErr, sc);

    if (err <= 1 || h <= hMin * 1.01) {
      t += h;
      y = res.yNew;
      tOut.push(t); yOut.push(y.slice());
      steps++;
      // Tras aceptar NUNCA encogemos h — si err<1 pero cerca, quedamos en h
      // (evita churning en el borde). Solo shrink viene vía reject.
      const fac = err === 0
        ? FAC_MAX
        : Math.min(FAC_MAX, Math.max(1.0, SAFETY * Math.pow(err, -1 / (ORDER + 1))));
      h = Math.min(hMax, h * fac);
    } else {
      rejected++;
      const fac = Math.max(FAC_MIN, SAFETY * Math.pow(err, -1 / (ORDER + 1)));
      h = Math.max(hMin, h * fac);
    }
  }

  return { t: tOut, y: yOut, steps, rejected };
}

// ═══════════════════════════════════════════════════════════════
// Adaptador cinética → ODE
// ═══════════════════════════════════════════════════════════════

import type { ReactionStep } from './kinetics';
import { derivatives } from './kinetics';

export function buildKineticsOde(
  steps: ReactionStep[],
  species: string[],
  T: number,
): OdeFn {
  return (_t: number, y: number[]): number[] => {
    const C: Record<string, number> = {};
    for (let i = 0; i < species.length; i++) C[species[i]] = y[i];
    const dC = derivatives(steps, T, C);
    return species.map((sp) => dC[sp] ?? 0);
  };
}

export function simulateStiff(
  steps: ReactionStep[],
  T: number,
  C0: Record<string, number>,
  tFinal: number,
  opts: StiffOptions = {},
): { t: number[]; C: Record<string, number[]>; species: string[]; steps: number; rejected: number } {
  const species = Object.keys(C0);
  const y0 = species.map((s) => C0[s]);
  const f = buildKineticsOde(steps, species, T);
  const res = solveStiff(f, 0, y0, tFinal, opts);

  const C: Record<string, number[]> = {};
  for (let i = 0; i < species.length; i++) {
    C[species[i]] = res.y.map((row) => row[i]);
  }
  return { t: res.t, C, species, steps: res.steps, rejected: res.rejected };
}
