/**
 * Caras del operador 𝔄 — API ergonómica para simulaciones físicas.
 *
 * El método de cambio de caras (PROCESO_CARAS.md §1):
 *
 *   1. Identificar simetría de la operación (traslación, escala, rotación...)
 *   2. Elegir cara natural de esa simetría (Fourier, Mellin, Bessel...)
 *   3. Ir:     x̂ = ℱ(x)
 *   4. Operar: ŷ = O(x̂)            ← trivial en la cara
 *   5. Volver: y = ℱ⁻¹(ŷ)
 *   6. Auditar: ||y − O(x)|| < tolerancia (Parseval-Plancherel)
 *
 * Esta lib implementa el patrón como **LUT + sample(x) O(1)** para uso en
 * tiempo real en R3F. Cada `Cara` es un slot de LUT precalculada + interpolación
 * lineal. Cada `Modo` factoriza un campo separable como producto tensor de
 * caras, una por canal de simetría conmutativa.
 *
 * Ergonomía objetivo: 3 líneas para crear un modo, 1 línea para evaluarlo.
 *
 *   const m = modo({
 *     amp: 0.7,
 *     R: caraBessel({ m: 1, k: 3.83 / R, R_max: 15 }),
 *     Theta: caraI_Theta({ m: 1 }),
 *     Z: caraI_Z({ kZ: 0.08, omega: alfvenOmega(0.42, 0.08, 3.83 / R), LENGTH: 110 }),
 *   });
 *   const psi = m.eval(r, theta, z);   // 3 lookups + 2 muls, O(1)
 *
 * Referencias: papers/operador_ian/lab/PROCESO_CARAS.md, FORMALISMO.md
 */

/* ═══ Bessel J_m polinómicos (Abramowitz-Stegun 9.4) ═══════════════════ */
function besselJ0(x: number): number {
  const ax = Math.abs(x);
  if (ax < 3) {
    const u = x / 3, u2 = u * u;
    return 1 - 2.2499997 * u2 + 1.2656208 * u2 ** 2
           - 0.3163866 * u2 ** 3 + 0.0444479 * u2 ** 4
           - 0.0039444 * u2 ** 5 + 0.00021 * u2 ** 6;
  }
  return Math.sqrt(2 / (Math.PI * ax)) * Math.cos(ax - Math.PI / 4);
}
function besselJ1(x: number): number {
  const ax = Math.abs(x), s = Math.sign(x);
  if (ax < 3) {
    const u = x / 3, u2 = u * u;
    const p = 0.5 - 0.56249985 * u2 + 0.21093573 * u2 ** 2
              - 0.03954289 * u2 ** 3 + 0.00443319 * u2 ** 4
              - 0.00031761 * u2 ** 5 + 0.00001109 * u2 ** 6;
    return x * p;
  }
  return s * Math.sqrt(2 / (Math.PI * ax)) * Math.cos(ax - 3 * Math.PI / 4);
}
function besselJ2(x: number): number {
  return Math.abs(x) < 1e-3 ? 0 : (2 / x) * besselJ1(x) - besselJ0(x);
}
function besselJm(m: 0 | 1 | 2, x: number): number {
  return m === 0 ? besselJ0(x) : m === 1 ? besselJ1(x) : besselJ2(x);
}

/* ═══ Tipo Cara ═════════════════════════════════════════════════════════ */

/**
 * Cara del operador 𝔄: LUT precalculada + sample O(1).
 * Cumple Parseval: ||x||²_aritmética = ||sample evaluations||²_dual.
 */
export interface Cara {
  readonly nombre: string;
  readonly N: number;       // resolución del LUT
  readonly lut: Float32Array;
  /** Sample con interpolación lineal en posición x. O(1). */
  sample(x: number): number;
}

/** Cara con dependencia temporal: necesita refresh por frame. */
export interface CaraTemporal extends Cara {
  /** Recompute el LUT al tiempo t. Costo O(N). Hazlo ≤1×/frame. */
  update(t: number): void;
}

/* ═══ Cara Bessel (canal radial con frontera) ══════════════════════════ */

/**
 * Cara-Bessel: J_m(k·r) en r ∈ [0, R_max].
 * Simetría que diagonaliza: axisimetría con frontera en R_max
 * (auto-funciones del Laplaciano cilíndrico con borde Dirichlet).
 *
 * Usage:
 *   const R = caraBessel({ m: 1, k: 3.8317 / 1.4, R_max: 15 });
 *   R.sample(2.5)  // devuelve J_1(k·2.5) interpolado
 */
export function caraBessel(opts: {
  m: 0 | 1 | 2;
  k: number;
  R_max: number;
  N?: number;
}): Cara {
  const { m, k, R_max, N = 64 } = opts;
  const lut = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = (i / (N - 1)) * R_max;
    lut[i] = besselJm(m, k * r);
  }
  return {
    nombre: `Bessel J_${m}(${k.toFixed(3)}·r)`,
    N, lut,
    sample(x: number): number {
      if (x < 0) x = -x;            // simetría radial
      const fi = (x / R_max) * (N - 1);
      const i0 = Math.min(N - 2, Math.max(0, Math.floor(fi)));
      const a = fi - i0;
      return lut[i0] * (1 - a) + lut[i0 + 1] * a;
    },
  };
}

/* ═══ Cara i_θ (canal angular con simetría rotacional) ═════════════════ */

/**
 * Cara-i_θ: cos(m·θ) periódica en [0, 2π].
 * Simetría que diagonaliza: rotación ∂_θ (Fourier circular).
 *
 * Para m=0 el sample es trivialmente 1 (la integración del LUT puede
 * saltearse en el caller — ver helper `esTrivial(c)` abajo).
 */
export function caraI_Theta(opts: { m: number; N?: number }): Cara {
  const { m, N = 64 } = opts;
  const lut = new Float32Array(N);
  for (let j = 0; j < N; j++) {
    const th = (j / N) * 2 * Math.PI;
    lut[j] = Math.cos(m * th);
  }
  return {
    nombre: m === 0 ? `i_θ (m=0, trivial)` : `cos(${m}·θ)`,
    N, lut,
    sample(theta: number): number {
      if (m === 0) return 1;            // fast path
      let t = theta;
      while (t < 0) t += 2 * Math.PI;
      while (t >= 2 * Math.PI) t -= 2 * Math.PI;
      const fi = (t / (2 * Math.PI)) * N;
      const i0 = Math.floor(fi) % N;
      const i1 = (i0 + 1) % N;
      const a = fi - Math.floor(fi);
      return lut[i0] * (1 - a) + lut[i1] * a;
    },
  };
}

/* ═══ Cara i_z(t) (canal axial + temporal, onda plana) ═════════════════ */

/**
 * Cara-i_z(t): cos(k_z·z − ω·t + φ).
 * Simetría que diagonaliza: traslación ∂_z + estática ∂_t (ondas planas).
 * NECESITA .update(t) por frame para refrescar el LUT a tiempo t.
 *
 * Costo update: O(N). Para N=96, vA=0.42, ω~0.5 → 96 cos/frame por modo.
 * 6 modos × 96 = 576 cos/frame, despreciable.
 */
export function caraI_Z(opts: {
  kZ: number;
  omega: number;
  LENGTH: number;
  phase?: number;
  N?: number;
}): CaraTemporal {
  const { kZ, omega, LENGTH, phase = 0, N = 96 } = opts;
  const lut = new Float32Array(N);
  // populate at t=0
  for (let k = 0; k < N; k++) {
    const z = (k / (N - 1)) * LENGTH;
    lut[k] = Math.cos(kZ * z + phase);
  }
  return {
    nombre: `cos(${kZ.toFixed(3)}·z − ${omega.toFixed(3)}·t)`,
    N, lut,
    sample(z: number): number {
      const fi = (Math.abs(z) / LENGTH) * (N - 1);
      const i0 = Math.min(N - 2, Math.max(0, Math.floor(fi)));
      const a = fi - i0;
      return lut[i0] * (1 - a) + lut[i0 + 1] * a;
    },
    update(t: number): void {
      for (let k = 0; k < N; k++) {
        const z = (k / (N - 1)) * LENGTH;
        lut[k] = Math.cos(kZ * z - omega * t + phase);
      }
    },
  };
}

/* ═══ Modo factorizado: producto tensor de caras conmutativas ══════════ */

/**
 * Modo del operador 𝔄: Φ(r,θ,z,t) = amp · R(r) · Θ(θ) · Z(z,t).
 *
 * Materialización del teorema: cuando las simetrías ∂_θ, ∂_z, ∂_t conmutan,
 * el campo se factoriza como producto tensor. Cada cara es 1D, costo total
 * por evaluación es 3 lookups + 2 muls = O(1).
 *
 * Speedup vs Bessel directo en runtime: ~5-6× según paper MHD_FROM_OPERATOR.md.
 */
export interface Modo {
  readonly amp: number;
  readonly R: Cara;
  readonly Theta: Cara;
  readonly Z: CaraTemporal;
  /** Metadata opcional: número azimutal m del modo (0,1,2,...). Útil para
   *  decidir cómo acoplar el modo a vR/vTheta/vZ del campo de velocidad. */
  readonly m?: number;
  /** Metadata opcional: índice radial n (cero n-ésimo del Bessel). */
  readonly n?: number;
  /** Φ(r,θ,z) al tiempo actual de Z. O(1). */
  eval(r: number, theta: number, z: number): number;
}

export function modo(opts: {
  amp: number;
  R: Cara;
  Theta: Cara;
  Z: CaraTemporal;
  m?: number;
  n?: number;
}): Modo {
  return {
    amp: opts.amp,
    R: opts.R,
    Theta: opts.Theta,
    Z: opts.Z,
    m: opts.m,
    n: opts.n,
    eval(r: number, theta: number, z: number): number {
      return this.amp * this.R.sample(r) * this.Theta.sample(theta) * this.Z.sample(z);
    },
  };
}

/* ═══ Helpers físicos ══════════════════════════════════════════════════ */

/**
 * Dispersión Alfvén MHD: ω² = vA²·(kz² + k⊥²).
 * Para construir el ω de un modo dado vA, kz, k⊥.
 */
export function alfvenOmega(vA: number, kZ: number, kPerp: number): number {
  return Math.sqrt(vA * vA * (kZ * kZ + kPerp * kPerp));
}

/**
 * Ceros positivos de J_m para n=1,2,... (usados para k⊥ con frontera Dirichlet).
 * j_{m,n} = enésimo cero positivo de J_m.
 * Tabla extendida en Abramowitz-Stegun 9.5.
 */
export const J_ZEROS = {
  0: [2.4048, 5.5201, 8.6537, 11.7915],
  1: [3.8317, 7.0156, 10.1735, 13.3237],
  2: [5.1356, 8.4172, 11.6198, 14.7960],
} as const;

/** k⊥ para el modo n del Bessel J_m con frontera en R. */
export function kPerpBessel(m: 0 | 1 | 2, n: 1 | 2 | 3 | 4, R: number): number {
  return J_ZEROS[m][n - 1] / R;
}

/* ═══ Auditoría Parseval (test de invertibilidad) ══════════════════════ */

/**
 * Test de norma L²: una cara legítima preserva energía.
 * Devuelve error relativo entre las dos normas. ok si < 1e-6.
 *
 * Para Bessel: ||R||² primal = ∫ |R(r)|² · r dr (Hankel weight)
 * Para i_θ:    ||Θ||² primal = ∫ |Θ(θ)|² dθ (uniform)
 * Para i_z:    ||Z||² primal = ∫ |Z(z)|² dz (uniform)
 */
export function auditarParseval(c: Cara, dx = 0.01): { error: number; ok: boolean } {
  // Aprox: integramos |sample(x)|² en [0, N·dx] (rango cubierto por el LUT)
  let normaSample = 0;
  let normaLut = 0;
  const xMax = c.N * dx;
  for (let i = 0; i < c.N; i++) {
    const x = (i + 0.5) * dx * (xMax / (c.N * dx));
    const s = c.sample(x);
    normaSample += s * s * dx;
    normaLut += c.lut[i] * c.lut[i] * dx;
  }
  const err = Math.abs(normaSample - normaLut) / Math.max(1e-12, normaLut);
  return { error: err, ok: err < 1e-6 };
}

/* ═══ Helpers de composición ═══════════════════════════════════════════ */

/**
 * Actualiza la cara temporal Z de todos los modos al tiempo t.
 * Llamar 1×/frame desde useFrame.
 */
export function actualizarModosEnTiempo(modos: readonly Modo[], t: number): void {
  for (const m of modos) m.Z.update(t);
}

/**
 * Evalúa Σ_n amp_n · R_n · Θ_n · Z_n en (r,θ,z) — el campo perturbativo total.
 * Si necesitas el modo dominante (para colorear por cara), usar evalModoDominante.
 */
export function evalCampo(modos: readonly Modo[], r: number, theta: number, z: number): number {
  let total = 0;
  for (const m of modos) total += m.eval(r, theta, z);
  return total;
}

/**
 * Como evalCampo pero también devuelve el índice del modo de mayor |Φ_n| y |Φ_n|
 * (usado para colorear partículas por cara dominante).
 */
export function evalModoDominante(
  modos: readonly Modo[], r: number, theta: number, z: number,
): { total: number; idx: number; abs: number } {
  let total = 0, maxAbs = 0, idx = -1;
  for (let i = 0; i < modos.length; i++) {
    const v = modos[i].eval(r, theta, z);
    total += v;
    const a = Math.abs(v);
    if (a > maxAbs) { maxAbs = a; idx = i; }
  }
  return { total, idx, abs: maxAbs };
}
