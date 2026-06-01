// linear.ts — Eliminacion de Gauss-Jordan EXACTA sobre racionales.
// Registra cada operacion elemental como un Paso inspeccionable.

import { Fraction } from './fraction';
import type { Paso, TipoSolucion } from './types';

export interface ResultadoLineal {
  rref: Fraction[][]; // matriz aumentada en forma escalonada reducida
  tipo: TipoSolucion;
  solucion: Fraction[] | null; // valor de cada variable si es unica
  pasos: Paso[];
  nota?: string;
}

// ---- Helpers de LaTeX -----------------------------------------------------

// Renderiza la matriz aumentada [A | b] como un pmatrix con barra.
function augLatex(A: Fraction[][]): string {
  const rows = A.map((row) => {
    const lhs = row.slice(0, -1).map((f) => f.toLatex());
    const rhs = row[row.length - 1].toLatex();
    return [...lhs, rhs].join(' & ');
  });
  const cols = A[0].length;
  const spec = 'c'.repeat(cols - 1) + '|c';
  return `\\left[\\begin{array}{${spec}}\n${rows.join(' \\\\\n')}\n\\end{array}\\right]`;
}

function cloneMatrix(A: Fraction[][]): Fraction[][] {
  return A.map((row) => row.slice());
}

// ---- Algoritmo ------------------------------------------------------------

/**
 * Resuelve A x = b por Gauss-Jordan exacto.
 * A: matriz de coeficientes (m x n), b: vector (m).
 * Construye la aumentada y la lleva a RREF registrando cada paso.
 */
export function solveGaussJordan(
  A: Fraction[][],
  b: Fraction[],
): ResultadoLineal {
  const m = A.length;
  if (m === 0) throw new Error('solveGaussJordan: matriz vacia');
  const n = A[0].length;
  if (b.length !== m) throw new Error('solveGaussJordan: dimension de b no coincide');

  // Matriz aumentada.
  const M: Fraction[][] = A.map((row, i) => [...row.map((f) => f), b[i]]);

  const pasos: Paso[] = [];
  pasos.push({
    titulo: 'Matriz aumentada',
    operacion: '[A | b]',
    matrizLatex: augLatex(M),
    nota: 'Escribimos el sistema como una sola matriz para operar fila por fila.',
  });

  let pivotRow = 0;
  const pivotCols: number[] = [];

  for (let col = 0; col < n && pivotRow < m; col++) {
    // 1) Buscar un pivote no nulo en/abajo de pivotRow.
    let sel = -1;
    for (let r = pivotRow; r < m; r++) {
      if (!M[r][col].isZero()) {
        sel = r;
        break;
      }
    }
    if (sel === -1) continue; // columna sin pivote (variable libre)

    // 2) Intercambio si hace falta.
    if (sel !== pivotRow) {
      const tmp = M[sel];
      M[sel] = M[pivotRow];
      M[pivotRow] = tmp;
      pasos.push({
        titulo: 'Intercambio de filas',
        operacion: `R${pivotRow + 1} <-> R${sel + 1}`,
        matrizLatex: augLatex(M),
        nota: `Subimos una fila con pivote distinto de cero en la columna ${col + 1}.`,
      });
    }

    // 3) Normalizar el pivote a 1.
    const piv = M[pivotRow][col];
    if (!piv.isOne()) {
      for (let c = 0; c < M[pivotRow].length; c++) {
        M[pivotRow][c] = M[pivotRow][c].div(piv);
      }
      pasos.push({
        titulo: 'Normalizar pivote',
        operacion: `R${pivotRow + 1} -> R${pivotRow + 1} / (${piv.toString()})`,
        matrizLatex: augLatex(M),
        nota: `Hacemos 1 el pivote de la columna ${col + 1}.`,
      });
    }

    // 4) Anular el resto de la columna (arriba y abajo): Jordan completo.
    for (let r = 0; r < m; r++) {
      if (r === pivotRow) continue;
      const factor = M[r][col];
      if (factor.isZero()) continue;
      for (let c = 0; c < M[r].length; c++) {
        M[r][c] = M[r][c].sub(factor.mul(M[pivotRow][c]));
      }
      const fStr = factor.toString();
      const opSign = factor.isNegative()
        ? `+ (${factor.neg().toString()})`
        : `- (${fStr})`;
      pasos.push({
        titulo: 'Eliminar columna',
        operacion: `R${r + 1} -> R${r + 1} ${opSign}·R${pivotRow + 1}`,
        matrizLatex: augLatex(M),
        nota: `Volvemos cero la entrada (${r + 1}, ${col + 1}).`,
      });
    }

    pivotCols.push(col);
    pivotRow++;
  }

  // ---- Clasificar la solucion --------------------------------------------

  // Fila inconsistente: [0 ... 0 | c] con c != 0.
  let inconsistente = false;
  for (let r = 0; r < m; r++) {
    let allZero = true;
    for (let c = 0; c < n; c++) {
      if (!M[r][c].isZero()) {
        allZero = false;
        break;
      }
    }
    if (allZero && !M[r][n].isZero()) {
      inconsistente = true;
      break;
    }
  }

  let tipo: TipoSolucion;
  let solucion: Fraction[] | null = null;
  let nota: string | undefined;

  if (inconsistente) {
    tipo = 'sin-solucion';
    nota = 'Aparece una fila 0 = c con c != 0: el sistema es incompatible.';
    pasos.push({
      titulo: 'Sin solucion',
      operacion: '0 = c (c != 0)',
      matrizLatex: augLatex(M),
      nota,
    });
  } else if (pivotCols.length < n) {
    tipo = 'infinitas';
    const libres = n - pivotCols.length;
    nota = `Hay ${libres} variable(s) libre(s): infinitas soluciones.`;
    pasos.push({
      titulo: 'Infinitas soluciones',
      operacion: `${libres} variable(s) libre(s)`,
      matrizLatex: augLatex(M),
      nota,
    });
  } else {
    tipo = 'unica';
    // Columna pivote i corresponde a la variable i; b queda en la ultima col.
    solucion = new Array(n);
    for (let i = 0; i < n; i++) solucion[i] = Fraction.zero();
    for (let r = 0; r < pivotCols.length; r++) {
      const col = pivotCols[r];
      solucion[col] = M[r][n];
    }
    const solStr = solucion
      .map((v, i) => `x_{${i + 1}} = ${v.toLatex()}`)
      .join(', \\quad ');
    pasos.push({
      titulo: 'Solucion unica',
      operacion: 'Lectura directa de la RREF',
      matrizLatex: solStr,
      nota: 'Como cada variable tiene su pivote, la solucion se lee directo.',
    });
  }

  return { rref: M, tipo, solucion, pasos, nota };
}

// Conveniencia: construir Fraction[][] desde numeros crudos.
export function matFromNumbers(rows: number[][]): Fraction[][] {
  return rows.map((row) => row.map((x) => Fraction.from(x)));
}

export function vecFromNumbers(v: number[]): Fraction[] {
  return v.map((x) => Fraction.from(x));
}

export { cloneMatrix };
