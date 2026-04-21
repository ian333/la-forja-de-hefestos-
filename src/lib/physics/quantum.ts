/**
 * ══════════════════════════════════════════════════════════════════════
 *  physics/quantum — Ecuación de Schrödinger dependiente del tiempo 1D
 * ══════════════════════════════════════════════════════════════════════
 *
 *   iℏ ∂ψ/∂t = (-ℏ²/2m ∂²/∂x² + V(x)) ψ
 *
 * Resolvemos por split-operator (Trotter-Suzuki de 2º orden):
 *
 *   ψ(t+Δt) ≈ exp(-iVΔt/2ℏ) · F⁻¹[ exp(-iTΔt/ℏ) · F[ exp(-iVΔt/2ℏ) ψ ] ]
 *
 * donde T = p²/2m. En el espacio k (Fourier), T es diagonal:
 *   exp(-iTΔt/ℏ) · ψ̃(k) = exp(-iℏk²Δt/2m) · ψ̃(k)
 *
 * Ventajas del método:
 *   · Unitario (preserva norma) a toda precisión de máquina.
 *   · Estable para cualquier Δt.
 *   · Error O(Δt³) por step.
 *
 * Unidades reducidas: ℏ = m = 1 (átomicas). L en bohrs, t en a₀/v_Bohr.
 *
 * Ref:
 *   · Feit, Fleck, Steiger, JCP 47, 412 (1982) — método original.
 *   · Tannor, "Introduction to Quantum Mechanics: A Time-Dependent
 *     Perspective", 2007. Capítulo 11 (split-operator).
 *   · Griffiths, QM §11 (dinámica dependiente del tiempo).
 */

// ═══════════════════════════════════════════════════════════════
// Estado y parámetros
// ═══════════════════════════════════════════════════════════════

export interface Schrodinger1DParams {
  /** Puntos del grid (potencia de 2 para FFT eficiente). Típico 512-1024 */
  N: number;
  /** Ancho del dominio [-L/2, +L/2] (en bohrs) */
  L: number;
  /** Masa reducida (1 = electrón) */
  m: number;
  /** Paso temporal (en unidades de a₀/v_Bohr = ~24 attosegundos) */
  dt: number;
}

export interface Schrodinger1DState {
  /** Parte real de ψ en cada punto del grid */
  re: Float64Array;
  /** Parte imaginaria de ψ */
  im: Float64Array;
  /** Potencial V(x) en el grid — se mantiene constante durante un ciclo */
  V: Float64Array;
  /** Tiempo acumulado */
  t: number;
}

// ═══════════════════════════════════════════════════════════════
// Inicializaciones
// ═══════════════════════════════════════════════════════════════

/** Crea estado vacío con grid de potencial provisto */
export function createState(params: Schrodinger1DParams, V: (x: number) => number): Schrodinger1DState {
  const { N, L } = params;
  const state: Schrodinger1DState = {
    re: new Float64Array(N),
    im: new Float64Array(N),
    V: new Float64Array(N),
    t: 0,
  };
  const dx = L / N;
  for (let i = 0; i < N; i++) {
    const x = -L / 2 + (i + 0.5) * dx;
    state.V[i] = V(x);
  }
  return state;
}

/**
 * Paquete de onda gaussiano:
 *   ψ(x, 0) = (2πσ²)^(-1/4) · exp(ik₀(x−x₀)) · exp(-(x−x₀)²/4σ²)
 *
 * Momento central k₀, posición central x₀, ancho σ.
 */
export function seedGaussianPacket(
  state: Schrodinger1DState,
  params: Schrodinger1DParams,
  x0: number, k0: number, sigma: number,
): void {
  const { N, L } = params;
  const dx = L / N;
  const norm = Math.pow(2 * Math.PI * sigma * sigma, -0.25);
  let sumR = 0, sumI = 0;
  // Primera pasada: computar magnitudes
  for (let i = 0; i < N; i++) {
    const x = -L / 2 + (i + 0.5) * dx;
    const amp = norm * Math.exp(-(x - x0) * (x - x0) / (4 * sigma * sigma));
    const phase = k0 * (x - x0);
    state.re[i] = amp * Math.cos(phase);
    state.im[i] = amp * Math.sin(phase);
    sumR += state.re[i] * state.re[i] + state.im[i] * state.im[i];
  }
  // Renormalizar para ∫|ψ|² dx = 1
  const normFactor = 1 / Math.sqrt(sumR * dx);
  for (let i = 0; i < N; i++) {
    state.re[i] *= normFactor;
    state.im[i] *= normFactor;
  }
  void sumI;
}

// ═══════════════════════════════════════════════════════════════
// Split-operator propagator
// ═══════════════════════════════════════════════════════════════

/**
 * FFT Cooley-Tukey radix-2 in-place. N debe ser potencia de 2.
 * Modifica re[] e im[] in-place. inverse=false es FFT, true es IFFT.
 */
function fft(re: Float64Array, im: Float64Array, inverse: boolean): void {
  const N = re.length;
  if (N <= 1) return;

  // Bit-reversal permutation
  let j = 0;
  for (let i = 1; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  for (let len = 2; len <= N; len <<= 1) {
    const half = len >> 1;
    const angle = (inverse ? 2 : -2) * Math.PI / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < N; i += len) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < half; k++) {
        const xRe = re[i + k];
        const xIm = im[i + k];
        const yRe = re[i + k + half] * curRe - im[i + k + half] * curIm;
        const yIm = re[i + k + half] * curIm + im[i + k + half] * curRe;
        re[i + k] = xRe + yRe;
        im[i + k] = xIm + yIm;
        re[i + k + half] = xRe - yRe;
        im[i + k + half] = xIm - yIm;
        const nextRe = curRe * wRe - curIm * wIm;
        const nextIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
        curIm = nextIm;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; }
  }
}

/** Un paso de split-operator: V/2 → T → V/2 */
export function step(state: Schrodinger1DState, params: Schrodinger1DParams): void {
  const { N, L, m, dt } = params;
  const dx = L / N;

  // exp(-i V dt / 2) — fase en espacio real
  for (let i = 0; i < N; i++) {
    const phase = -state.V[i] * dt / 2;
    const c = Math.cos(phase), s = Math.sin(phase);
    const r = state.re[i], ii = state.im[i];
    state.re[i] = r * c - ii * s;
    state.im[i] = r * s + ii * c;
  }

  // Transformar a espacio k
  fft(state.re, state.im, false);

  // exp(-i T dt) donde T = k²/(2m) en espacio k
  // k_j = 2π j / L para j < N/2, y 2π(j - N)/L para j ≥ N/2
  for (let j = 0; j < N; j++) {
    const kIdx = j < N / 2 ? j : j - N;
    const k = (2 * Math.PI * kIdx) / L;
    const phase = -(k * k) * dt / (2 * m);
    const c = Math.cos(phase), s = Math.sin(phase);
    const r = state.re[j], ii = state.im[j];
    state.re[j] = r * c - ii * s;
    state.im[j] = r * s + ii * c;
  }

  // Volver a espacio real
  fft(state.re, state.im, true);

  // exp(-i V dt / 2) otra vez
  for (let i = 0; i < N; i++) {
    const phase = -state.V[i] * dt / 2;
    const c = Math.cos(phase), s = Math.sin(phase);
    const r = state.re[i], ii = state.im[i];
    state.re[i] = r * c - ii * s;
    state.im[i] = r * s + ii * c;
  }

  state.t += dt;
  void dx;
}

// ═══════════════════════════════════════════════════════════════
// Observables
// ═══════════════════════════════════════════════════════════════

export function probabilityDensity(state: Schrodinger1DState): Float64Array {
  const N = state.re.length;
  const out = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    out[i] = state.re[i] * state.re[i] + state.im[i] * state.im[i];
  }
  return out;
}

export function totalProbability(state: Schrodinger1DState, params: Schrodinger1DParams): number {
  const dx = params.L / params.N;
  const rho = probabilityDensity(state);
  let sum = 0;
  for (let i = 0; i < rho.length; i++) sum += rho[i];
  return sum * dx;
}

export function expectedPosition(state: Schrodinger1DState, params: Schrodinger1DParams): number {
  const { N, L } = params;
  const dx = L / N;
  const rho = probabilityDensity(state);
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const x = -L / 2 + (i + 0.5) * dx;
    sum += x * rho[i];
  }
  return sum * dx;
}

/** Energía total <E> = <T> + <V>. Usa derivadas de diferencia finita. */
export function totalEnergy(state: Schrodinger1DState, params: Schrodinger1DParams): number {
  const { N, L, m } = params;
  const dx = L / N;
  let sumT = 0, sumV = 0;

  // Energía cinética via (ψ, -∂²/2m ψ)
  // -∂²ψ/∂x² ≈ (ψ_{i-1} - 2ψ_i + ψ_{i+1}) / dx²  (negativo del operador T)
  for (let i = 0; i < N; i++) {
    const ip = (i + 1) % N;
    const im = (i - 1 + N) % N;
    const lapRe = (state.re[ip] - 2 * state.re[i] + state.re[im]) / (dx * dx);
    const lapIm = (state.im[ip] - 2 * state.im[i] + state.im[im]) / (dx * dx);
    // <T> = -ℏ²/2m <ψ*, ∇²ψ> (positive because of -)
    // psi* · (-lap/2m) = -(re − i im)·(lapRe + i lapIm)/2m
    //   real part: -(re·lapRe + im·lapIm)/2m
    sumT += -(state.re[i] * lapRe + state.im[i] * lapIm) / (2 * m);
    sumV += state.V[i] * (state.re[i] * state.re[i] + state.im[i] * state.im[i]);
  }
  return (sumT + sumV) * dx;
}

// ═══════════════════════════════════════════════════════════════
// Potenciales predefinidos (fábricas de V(x))
// ═══════════════════════════════════════════════════════════════

export function V_free(): (x: number) => number {
  return () => 0;
}

export function V_barrier(x0: number, width: number, height: number): (x: number) => number {
  return (x: number) => (Math.abs(x - x0) < width / 2 ? height : 0);
}

export function V_well(x0: number, width: number, depth: number): (x: number) => number {
  return (x: number) => (Math.abs(x - x0) < width / 2 ? -depth : 0);
}

export function V_harmonic(omega: number, m = 1): (x: number) => number {
  return (x: number) => 0.5 * m * omega * omega * x * x;
}

export function V_step(x0: number, height: number): (x: number) => number {
  return (x: number) => (x > x0 ? height : 0);
}

export function V_doubleWell(a: number, b: number): (x: number) => number {
  // V(x) = a·x⁴ - b·x²  (dos mínimos simétricos)
  return (x: number) => a * x * x * x * x - b * x * x;
}

// ═══════════════════════════════════════════════════════════════
// Export de FFT para tests
// ═══════════════════════════════════════════════════════════════

export { fft as _fft_test };
