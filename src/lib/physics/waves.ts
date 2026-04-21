/**
 * ══════════════════════════════════════════════════════════════════════
 *  physics/waves — Ecuación de onda 1D por diferencias finitas (FDTD)
 * ══════════════════════════════════════════════════════════════════════
 *
 *   ∂²u/∂t² = c²(x) · ∂²u/∂x²
 *
 * Discretización leapfrog:
 *   u_i^{n+1} = 2u_i^n − u_i^{n-1} + (c Δt / Δx)² · (u_{i+1}^n − 2u_i^n + u_{i-1}^n)
 *
 * CFL: c·Δt/Δx ≤ 1 para estabilidad.
 *
 * Soporta:
 *   · c(x) variable (medios heterogéneos, reflexión parcial en interfaces)
 *   · Condiciones de contorno: fixed (0 siempre) o free (∂u/∂x = 0)
 *   · Fuentes puntuales (suma un pulso en cada step)
 *   · Soft boundaries (amortiguamiento progresivo en los bordes para evitar
 *     reflexiones — Mur 1st order absorbing condition)
 *
 * Ref: Taflove & Hagness, "Computational Electrodynamics: FDTD", 3ª ed.,
 *      2005. Capítulo 2 (wave equation as scalar FDTD primer).
 */

export type BoundaryType = 'fixed' | 'free' | 'absorbing';

export interface Wave1DParams {
  /** Puntos del grid */
  N: number;
  /** Longitud física (unidades arbitrarias) */
  L: number;
  /** Paso temporal */
  dt: number;
  /** Condición de contorno en ambos extremos */
  boundary: BoundaryType;
}

export interface Wave1DState {
  /** Desplazamiento actual u^n */
  u: Float64Array;
  /** Paso anterior u^{n-1} */
  uPrev: Float64Array;
  /** Buffer para u^{n+1} */
  uNext: Float64Array;
  /** Velocidad de onda c(x) en cada punto */
  c: Float64Array;
  /** Tiempo acumulado */
  t: number;
}

export function createWave(
  params: Wave1DParams,
  cFunc: (x: number) => number,
  u0?: (x: number) => number,
): Wave1DState {
  const { N, L } = params;
  const state: Wave1DState = {
    u: new Float64Array(N),
    uPrev: new Float64Array(N),
    uNext: new Float64Array(N),
    c: new Float64Array(N),
    t: 0,
  };
  const dx = L / N;
  for (let i = 0; i < N; i++) {
    const x = -L / 2 + (i + 0.5) * dx;
    state.c[i] = cFunc(x);
    if (u0) {
      state.u[i] = u0(x);
      state.uPrev[i] = u0(x);  // velocidad inicial cero
    }
  }
  return state;
}

export function waveStep(state: Wave1DState, params: Wave1DParams): void {
  const { N, L, dt, boundary } = params;
  const dx = L / N;
  const dx2 = dx * dx;

  for (let i = 1; i < N - 1; i++) {
    const c = state.c[i];
    const lap = state.u[i + 1] - 2 * state.u[i] + state.u[i - 1];
    state.uNext[i] = 2 * state.u[i] - state.uPrev[i] + (c * c * dt * dt / dx2) * lap;
  }

  // Bordes
  if (boundary === 'fixed') {
    state.uNext[0] = 0;
    state.uNext[N - 1] = 0;
  } else if (boundary === 'free') {
    // ∂u/∂x = 0 → u[0] = u[1], u[N-1] = u[N-2]
    state.uNext[0] = state.uNext[1];
    state.uNext[N - 1] = state.uNext[N - 2];
  } else {
    // Mur 1st-order absorbing (Engquist-Majda):
    //   u_0^{n+1} = u_1^n + (c·dt - dx)/(c·dt + dx) · (u_1^{n+1} - u_0^n)
    const c0 = state.c[0];
    const cN = state.c[N - 1];
    const factor0 = (c0 * dt - dx) / (c0 * dt + dx);
    const factorN = (cN * dt - dx) / (cN * dt + dx);
    state.uNext[0] = state.u[1] + factor0 * (state.uNext[1] - state.u[0]);
    state.uNext[N - 1] = state.u[N - 2] + factorN * (state.uNext[N - 2] - state.u[N - 1]);
  }

  // Cycle: uPrev ← u ← uNext
  const tmp = state.uPrev;
  state.uPrev = state.u;
  state.u = state.uNext;
  state.uNext = tmp;
  state.t += dt;
}

/** Inyecta un pulso gaussiano en la posición x0 con amplitud A y ancho σ. */
export function injectPulse(
  state: Wave1DState,
  params: Wave1DParams,
  x0: number, A: number, sigma: number,
): void {
  const { N, L } = params;
  const dx = L / N;
  for (let i = 0; i < N; i++) {
    const x = -L / 2 + (i + 0.5) * dx;
    const envelope = A * Math.exp(-(x - x0) * (x - x0) / (2 * sigma * sigma));
    state.u[i] += envelope;
    state.uPrev[i] += envelope;  // velocidad inicial cero
  }
}

/** Energía total de la onda (aproximada, sin peso por ρ). */
export function waveEnergy(state: Wave1DState, params: Wave1DParams): number {
  const { N, L, dt } = params;
  const dx = L / N;
  let sumK = 0, sumP = 0;
  for (let i = 1; i < N - 1; i++) {
    const v = (state.u[i] - state.uPrev[i]) / dt;
    sumK += 0.5 * v * v;
    const grad = (state.u[i + 1] - state.u[i - 1]) / (2 * dx);
    sumP += 0.5 * state.c[i] * state.c[i] * grad * grad;
  }
  return (sumK + sumP) * dx;
}
