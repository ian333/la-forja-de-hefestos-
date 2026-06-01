// determinant.ts — Determinante EXACTO por reduccion triangular (Bareiss-free,
// racionales puros). Registra el signo de cada intercambio y el factor de cada
// eliminacion. valor = producto de la diagonal de la triangular superior.

import { Fraction } from './fraction';
import type { Paso } from './types';

export interface ResultadoDeterminante {
  valor: Fraction;
  pasos: Paso[];
}

function matLatex(A: Fraction[][]): string {
  const rows = A.map((row) => row.map((f) => f.toLatex()).join(' & '));
  return `\\begin{vmatrix}\n${rows.join(' \\\\\n')}\n\\end{vmatrix}`;
}

function cloneMatrix(A: Fraction[][]): Fraction[][] {
  return A.map((row) => row.slice());
}

/**
 * det(A) por eliminacion gaussiana hacia adelante sobre racionales exactos.
 * Mantiene el determinante invariante salvo:
 *   - intercambio de filas: multiplica por -1 (lo absorbemos en `signo`).
 *   - sumar multiplo de una fila a otra: NO cambia el determinante.
 * Al final det = signo * (producto de la diagonal).
 */
export function determinant(A: Fraction[][]): ResultadoDeterminante {
  const n = A.length;
  if (n === 0) throw new Error('determinant: matriz vacia');
  for (const row of A) {
    if (row.length !== n) throw new Error('determinant: la matriz debe ser cuadrada');
  }

  const M = cloneMatrix(A);
  const pasos: Paso[] = [];
  let signo = 1n; // se vuelve -1 con cada intercambio

  pasos.push({
    titulo: 'Matriz inicial',
    operacion: 'det(A)',
    matrizLatex: matLatex(M),
    nota: 'Reduciremos a triangular superior; el determinante sera el producto de la diagonal.',
  });

  for (let col = 0; col < n; col++) {
    // Buscar pivote no nulo en/abajo de col.
    let sel = -1;
    for (let r = col; r < n; r++) {
      if (!M[r][col].isZero()) {
        sel = r;
        break;
      }
    }

    if (sel === -1) {
      // Toda la columna (de col hacia abajo) es cero => det = 0.
      pasos.push({
        titulo: 'Columna nula',
        operacion: `columna ${col + 1} sin pivote`,
        matrizLatex: matLatex(M),
        nota: 'No hay pivote: la matriz es singular, det = 0.',
      });
      return { valor: Fraction.zero(), pasos };
    }

    if (sel !== col) {
      const tmp = M[sel];
      M[sel] = M[col];
      M[col] = tmp;
      signo = -signo;
      pasos.push({
        titulo: 'Intercambio de filas',
        operacion: `R${col + 1} <-> R${sel + 1}  (signo x -1)`,
        matrizLatex: matLatex(M),
        nota: 'Cada intercambio invierte el signo del determinante.',
      });
    }

    // Eliminar debajo del pivote.
    const piv = M[col][col];
    for (let r = col + 1; r < n; r++) {
      if (M[r][col].isZero()) continue;
      const factor = M[r][col].div(piv);
      for (let c = col; c < n; c++) {
        M[r][c] = M[r][c].sub(factor.mul(M[col][c]));
      }
      const opSign = factor.isNegative()
        ? `+ (${factor.neg().toString()})`
        : `- (${factor.toString()})`;
      pasos.push({
        titulo: 'Eliminar debajo del pivote',
        operacion: `R${r + 1} -> R${r + 1} ${opSign}·R${col + 1}`,
        matrizLatex: matLatex(M),
        nota: 'Sumar un multiplo de una fila a otra NO cambia el determinante.',
      });
    }
  }

  // Producto de la diagonal.
  let prod = Fraction.one();
  for (let i = 0; i < n; i++) prod = prod.mul(M[i][i]);
  const valor = signo === -1n ? prod.neg() : prod;

  const diagStr = M.map((row, i) => row[i].toLatex()).join(' \\cdot ');
  const signStr = signo === -1n ? '-' : '+';
  pasos.push({
    titulo: 'Producto de la diagonal',
    operacion: `det = ${signStr}(${diagStr})`,
    matrizLatex: `\\det(A) = ${valor.toLatex()}`,
    nota: 'Multiplicamos la diagonal de la triangular y aplicamos el signo acumulado.',
  });

  return { valor, pasos };
}
