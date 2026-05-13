/**
 * ══════════════════════════════════════════════════════════════════════
 *  quantum/jacobi — Diagonalización de matrices simétricas reales
 * ══════════════════════════════════════════════════════════════════════
 *
 * Método cíclico de Jacobi: rota iterativamente la matriz para anular
 * elementos fuera de la diagonal, convergiendo a una forma diagonal cuyos
 * elementos son los autovalores. Los autovectores son las columnas del
 * producto de rotaciones acumuladas.
 *
 *   A_new = R^T · A · R       con R rotación de Givens en el plano (p,q).
 *   θ se elige para anular A[p,q]:   tan(2θ) = 2 A_pq / (A_qq - A_pp).
 *
 * Convergencia cuadrática para matrices bien condicionadas. Robusto para
 * dimensiones moderadas (≤ ~100). Para el análisis vibracional típico
 * (3N×3N con N≤10 átomos) es ideal y autocontenido.
 *
 * Ref [J1] Jacobi, C.G.J. "Über ein leichtes Verfahren die in der Theorie
 *          der Säcularstörungen vorkommenden Gleichungen numerisch
 *          aufzulösen", Crelle J. 30, 51-94 (1846). Trabajo original.
 * Ref [J2] Press, W.H. et al. "Numerical Recipes", 3rd ed., §11.1.
 *          Implementación práctica con criterios de convergencia.
 * Ref [J3] Golub, G.H. & Van Loan, C.F. "Matrix Computations", 4th ed.,
 *          Johns Hopkins, 2013. §8.5.
 */

export interface EigenDecomp {
  /** Autovalores en orden ascendente. */
  values: number[];
  /** Autovectores como columnas: vectors[i][k] = componente i del k-ésimo eigenvector. */
  vectors: number[][];
}

/**
 * Diagonaliza una matriz real simétrica A (n×n) por método cíclico de Jacobi.
 *
 * Verifica simetría dentro de `symTol`. La matriz de entrada NO se modifica.
 *
 * @param A          Matriz real simétrica n×n (acepta arrays anidados).
 * @param tol        Tolerancia para off-diagonal (default 1e-12).
 * @param maxSweeps  Pasadas completas máximas (default 100).
 * @returns          { values: λ₁≤λ₂≤..., vectors: V con A·V = V·diag(λ) }
 */
export function jacobiEigen(
  A: readonly (readonly number[])[],
  tol: number = 1e-12,
  maxSweeps: number = 100,
): EigenDecomp {
  const n = A.length;
  if (n === 0) return { values: [], vectors: [] };
  for (let i = 0; i < n; i++) {
    if (A[i].length !== n) throw new Error(`jacobi: matriz no cuadrada (fila ${i})`);
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(A[i][j] - A[j][i]) > 1e-8) {
        throw new Error(`jacobi: matriz no simétrica en (${i},${j}): ${A[i][j]} vs ${A[j][i]}`);
      }
    }
  }

  // Copia de trabajo (la matriz se mutará).
  const D: number[][] = Array.from({ length: n }, (_, i) => A[i].slice());
  // Matriz acumulada de autovectores: empieza identidad.
  const V: number[][] = Array.from({ length: n }, (_, i) => {
    const row = new Array(n).fill(0);
    row[i] = 1;
    return row;
  });

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    // Suma de cuadrados off-diagonal como criterio de convergencia.
    let off = 0;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) off += D[p][q] * D[p][q];
    }
    if (off < tol) break;

    // Recorrido cíclico (p,q): anula cada elemento fuera de la diagonal.
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const Apq = D[p][q];
        if (Math.abs(Apq) < 1e-18) continue;

        // Ángulo de rotación de Givens.
        const App = D[p][p];
        const Aqq = D[q][q];
        const theta = (Aqq - App) / (2 * Apq);
        // t = tan(θ); estable para |theta| grande.
        let t: number;
        if (Math.abs(theta) > 1e15) {
          t = 1 / (2 * theta);
        } else {
          t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
          if (theta === 0) t = 1;
        }
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        const tau = s / (1 + c);

        // Actualiza diagonales p,q.
        D[p][p] = App - t * Apq;
        D[q][q] = Aqq + t * Apq;
        D[p][q] = 0;
        D[q][p] = 0;

        // Filas/columnas distintas de p,q.
        for (let r = 0; r < n; r++) {
          if (r === p || r === q) continue;
          const Arp = D[r][p];
          const Arq = D[r][q];
          D[r][p] = Arp - s * (Arq + tau * Arp);
          D[p][r] = D[r][p];
          D[r][q] = Arq + s * (Arp - tau * Arq);
          D[q][r] = D[r][q];
        }

        // Acumula autovectores V := V · G(p,q,θ).
        for (let r = 0; r < n; r++) {
          const Vrp = V[r][p];
          const Vrq = V[r][q];
          V[r][p] = c * Vrp - s * Vrq;
          V[r][q] = s * Vrp + c * Vrq;
        }
      }
    }
  }

  // Extrae diagonal, ordena ascendente, reordena autovectores.
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => D[a][a] - D[b][b]);
  const values = idx.map((i) => D[i][i]);
  const vectors: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let k = 0; k < n; k++) {
    const colSrc = idx[k];
    for (let r = 0; r < n; r++) vectors[r][k] = V[r][colSrc];
  }
  return { values, vectors };
}
