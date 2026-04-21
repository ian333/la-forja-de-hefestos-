/**
 * ══════════════════════════════════════════════════════════════════════
 *  physics/thermo — Modelo de Ising 2D + ecuación del calor
 * ══════════════════════════════════════════════════════════════════════
 *
 * ─── Modelo de Ising 2D ──────────────────────────────────────────────
 *
 *   H = -J Σ_{<i,j>} s_i s_j - h Σ_i s_i
 *
 * Spins s_i ∈ {-1, +1} en una red cuadrada L×L con condiciones periódicas.
 * Monte Carlo Metropolis: flipeamos un spin con probabilidad min(1, exp(-ΔE/kT)).
 * A T crítica (T_c = 2J/ln(1+√2)·k_B ≈ 2.269 J/k_B en 2D) aparece la
 * transición ferromagnética con divergencia de susceptibilidad χ y
 * magnetización espontánea M.
 *
 *   Ref: Onsager (1944); Newman & Barkema, "Monte Carlo Methods in
 *        Statistical Physics", 1999.
 *
 * ─── Ecuación del calor 2D ───────────────────────────────────────────
 *
 *   ∂T/∂t = α ∇²T
 *
 * Discretizado con FTCS (forward-time central-space). Condición de
 * estabilidad: α·Δt/Δx² ≤ 1/4 en 2D.
 *
 *   Ref: Incropera, "Fundamentals of Heat and Mass Transfer", 7ª ed.
 *        Capítulo 5 (conducción transitoria).
 */

// ═══════════════════════════════════════════════════════════════
// ISING 2D
// ═══════════════════════════════════════════════════════════════

export interface IsingParams {
  /** Tamaño de la red (L×L spins) */
  L: number;
  /** Acoplamiento J (default 1) */
  J: number;
  /** Campo externo h (default 0) */
  h: number;
  /** Temperatura T en unidades de k_B/J */
  T: number;
}

export interface IsingState {
  /** Uint8Array: 0 = spin down, 1 = spin up */
  spins: Uint8Array;
  /** Tamaño del lado */
  L: number;
  /** Pasos Monte Carlo realizados */
  steps: number;
}

/** T_c teórica para Ising 2D cuadrado: 2J/ln(1+√2)/k_B ≈ 2.269 */
export const ISING_TC_2D = 2 / Math.log(1 + Math.SQRT2);

export function createIsing(L: number, random = true): IsingState {
  const spins = new Uint8Array(L * L);
  if (random) {
    for (let i = 0; i < spins.length; i++) spins[i] = Math.random() < 0.5 ? 0 : 1;
  } else {
    // Alineado hacia arriba
    spins.fill(1);
  }
  return { spins, L, steps: 0 };
}

function spinVal(s: number): number { return s === 1 ? 1 : -1; }

/** Energía de un spin dado sus vecinos — usado para ΔE en flip */
function localEnergy(state: IsingState, params: IsingParams, i: number, j: number): number {
  const { L } = state;
  const { J, h } = params;
  const s = spinVal(state.spins[i * L + j]);
  const up    = spinVal(state.spins[((i - 1 + L) % L) * L + j]);
  const down  = spinVal(state.spins[((i + 1) % L) * L + j]);
  const left  = spinVal(state.spins[i * L + ((j - 1 + L) % L)]);
  const right = spinVal(state.spins[i * L + ((j + 1) % L)]);
  return -J * s * (up + down + left + right) - h * s;
}

/**
 * Realiza N_flips intentos de flip Metropolis por paso.
 * Típicamente N_flips = L² (un "sweep").
 */
export function isingStep(state: IsingState, params: IsingParams, nFlips?: number): void {
  const { L } = state;
  const N = L * L;
  const flips = nFlips ?? N;
  const { T } = params;
  const invT = T > 0 ? 1 / T : 1e12;

  for (let k = 0; k < flips; k++) {
    const idx = Math.floor(Math.random() * N);
    const i = Math.floor(idx / L);
    const j = idx % L;

    // ΔE = E_después − E_antes = −2 × E_local_antes
    const eBefore = localEnergy(state, params, i, j);
    const deltaE = -2 * eBefore;

    if (deltaE <= 0 || Math.random() < Math.exp(-deltaE * invT)) {
      state.spins[idx] = state.spins[idx] === 1 ? 0 : 1;
    }
  }
  state.steps++;
}

/** Magnetización por spin: (N↑ - N↓) / N */
export function magnetization(state: IsingState): number {
  let sum = 0;
  for (let i = 0; i < state.spins.length; i++) sum += spinVal(state.spins[i]);
  return sum / state.spins.length;
}

/** Energía total por spin (excluyendo campo externo) */
export function isingEnergy(state: IsingState, params: IsingParams): number {
  const { L } = state;
  const { J, h } = params;
  let E = 0;
  for (let i = 0; i < L; i++) {
    for (let j = 0; j < L; j++) {
      const s = spinVal(state.spins[i * L + j]);
      const right = spinVal(state.spins[i * L + ((j + 1) % L)]);
      const down  = spinVal(state.spins[((i + 1) % L) * L + j]);
      E += -J * s * (right + down) - h * s;
    }
  }
  return E / (L * L);
}

// ═══════════════════════════════════════════════════════════════
// ECUACIÓN DEL CALOR 2D
// ═══════════════════════════════════════════════════════════════

export interface HeatParams {
  /** Grid size N×N */
  N: number;
  /** Longitud física del dominio */
  L: number;
  /** Difusividad térmica α */
  alpha: number;
  /** Paso temporal */
  dt: number;
  /** Borde fijo a temperatura (Dirichlet) */
  boundaryT: number;
}

export interface HeatState {
  T: Float64Array;
  next: Float64Array;   // buffer doble
  N: number;
  t: number;
}

export function createHeat(params: HeatParams, initial: (x: number, y: number) => number): HeatState {
  const { N, L } = params;
  const T = new Float64Array(N * N);
  const next = new Float64Array(N * N);
  const dx = L / N;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = -L / 2 + (j + 0.5) * dx;
      const y = -L / 2 + (i + 0.5) * dx;
      T[i * N + j] = initial(x, y);
    }
  }
  return { T, next, N, t: 0 };
}

/** Paso FTCS 2D. dt estable si α·dt/dx² ≤ 1/4. */
export function heatStep(state: HeatState, params: HeatParams): void {
  const { N, L, alpha, dt, boundaryT } = params;
  const dx = L / N;
  const lam = alpha * dt / (dx * dx);

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === 0 || i === N - 1 || j === 0 || j === N - 1) {
        state.next[i * N + j] = boundaryT;
        continue;
      }
      const c = state.T[i * N + j];
      const up = state.T[(i - 1) * N + j];
      const down = state.T[(i + 1) * N + j];
      const left = state.T[i * N + j - 1];
      const right = state.T[i * N + j + 1];
      state.next[i * N + j] = c + lam * (up + down + left + right - 4 * c);
    }
  }
  // Swap
  [state.T, state.next] = [state.next, state.T];
  state.t += dt;
  void L;
}

/** Temperatura media del grid */
export function heatMean(state: HeatState): number {
  let sum = 0;
  for (let i = 0; i < state.T.length; i++) sum += state.T[i];
  return sum / state.T.length;
}
