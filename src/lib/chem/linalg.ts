/**
 * ══════════════════════════════════════════════════════════════════════
 *  linalg — álgebra lineal densa mínima para solvers
 * ══════════════════════════════════════════════════════════════════════
 *
 * Operaciones sobre matrices densas de pequeño tamaño (n ≲ 100). Suficiente
 * para sistemas de reacciones químicas típicos donde el número de especies
 * activas rara vez excede decenas. Para sistemas mayores conviene migrar a
 * matrices dispersas (CSR), pero ese overhead no se justifica aquí.
 *
 * Ref [L1] Trefethen & Bau, "Numerical Linear Algebra", SIAM, 1997.
 */

/** Matriz identidad n×n */
export function identity(n: number): number[][] {
  const A: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) A[i][i] = 1;
  return A;
}

/** Clona una matriz (sin aliasing) */
export function clone(A: number[][]): number[][] {
  return A.map((row) => row.slice());
}

/** A = I - α·B (útil para construir (I − γhJ) en Rosenbrock) */
export function identityMinus(alpha: number, B: number[][]): number[][] {
  const n = B.length;
  const A = identity(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      A[i][j] -= alpha * B[i][j];
    }
  }
  return A;
}

/**
 * Descomposición LU con pivoteo parcial (Doolittle con P).
 * Retorna { L, U, P (permutación), sign } donde P·A = L·U.
 * In-place sobre la copia interna.
 *
 * Ref [L1] §20 — partial pivoting garantiza estabilidad numérica
 * para matrices no singulares.
 */
export interface LU {
  LU: number[][];         // matriz combinada: U arriba diagonal, L debajo
  piv: number[];          // piv[i] = fila original mapeada a fila i
  singular: boolean;
}

export function luFactor(A: number[][]): LU {
  const n = A.length;
  const M = clone(A);
  const piv = Array.from({ length: n }, (_, i) => i);
  let singular = false;

  for (let k = 0; k < n; k++) {
    // Pivoteo parcial: buscar fila con |M[i][k]| máximo
    let maxVal = Math.abs(M[k][k]);
    let maxRow = k;
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(M[i][k]);
      if (v > maxVal) {
        maxVal = v;
        maxRow = i;
      }
    }

    if (maxVal < 1e-300) {
      singular = true;
      continue;
    }

    if (maxRow !== k) {
      [M[k], M[maxRow]] = [M[maxRow], M[k]];
      [piv[k], piv[maxRow]] = [piv[maxRow], piv[k]];
    }

    const inv = 1 / M[k][k];
    for (let i = k + 1; i < n; i++) {
      M[i][k] *= inv;
      for (let j = k + 1; j < n; j++) {
        M[i][j] -= M[i][k] * M[k][j];
      }
    }
  }

  return { LU: M, piv, singular };
}

/**
 * Resolver L·U·x = P·b dado factor LU de A.
 * Back-substitution + forward-substitution en O(n²).
 */
export function luSolve(lu: LU, b: number[]): number[] {
  const n = b.length;
  const { LU: M, piv } = lu;
  const y = new Array(n).fill(0);
  const x = new Array(n).fill(0);

  // Permutación: y = P·b
  for (let i = 0; i < n; i++) y[i] = b[piv[i]];

  // Forward-sub: L·z = y (L tiene 1 en la diagonal)
  for (let i = 0; i < n; i++) {
    let s = y[i];
    for (let j = 0; j < i; j++) s -= M[i][j] * y[j];
    y[i] = s;
  }

  // Back-sub: U·x = z
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }

  return x;
}

/** Helpers vectoriales (in-place-friendly) */
export const vec = {
  add: (a: number[], b: number[], s = 1): number[] =>
    a.map((ai, i) => ai + s * b[i]),
  sub: (a: number[], b: number[]): number[] =>
    a.map((ai, i) => ai - b[i]),
  scale: (a: number[], s: number): number[] => a.map((x) => x * s),
  norm2: (a: number[]): number =>
    Math.sqrt(a.reduce((s, x) => s + x * x, 0)),
  normInf: (a: number[]): number => {
    let m = 0;
    for (const x of a) m = Math.max(m, Math.abs(x));
    return m;
  },
  /** Norma ponderada estilo CVODE: sqrt(mean((y_i / sc_i)²)) */
  wrmsNorm: (a: number[], sc: number[]): number => {
    let s = 0;
    for (let i = 0; i < a.length; i++) {
      const r = a[i] / sc[i];
      s += r * r;
    }
    return Math.sqrt(s / a.length);
  },
};
