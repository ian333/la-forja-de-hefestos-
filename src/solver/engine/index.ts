// index.ts — API unificada del motor del Resolvedor.
// Reexporta tipos y expone solve(tipo, entrada).

import { Fraction } from './fraction';
import { solveGaussJordan, matFromNumbers, vecFromNumbers } from './linear';
import type { ResultadoLineal } from './linear';
import { determinant } from './determinant';
import type { ResultadoDeterminante } from './determinant';
import { derivative, integral } from './calculus';
import type { ResultadoCalculo } from './calculus';
import type { Paso, TipoSolucion } from './types';

export { Fraction } from './fraction';
export { solveGaussJordan, matFromNumbers, vecFromNumbers } from './linear';
export type { ResultadoLineal } from './linear';
export { determinant } from './determinant';
export type { ResultadoDeterminante } from './determinant';
export {
  derivative,
  integral,
  parse,
  simplify,
  evaluate,
  toLatex,
  toText,
} from './calculus';
export type { ResultadoCalculo, Node, FuncName } from './calculus';
export type { Paso, TipoSolucion, ResultadoBase } from './types';

// ---- API unificada --------------------------------------------------------

export type TipoOperacion = 'lineal' | 'determinante' | 'derivada' | 'integral';

export interface EntradaLineal {
  A: number[][]; // coeficientes
  b: number[]; // terminos independientes
}

export interface EntradaDeterminante {
  A: number[][];
}

export interface EntradaCalculo {
  expr: string;
  variable?: string; // por defecto 'x'
}

export type Entrada = EntradaLineal | EntradaDeterminante | EntradaCalculo;

// Discriminante de la operacion. Se llama `op` (NO `tipo`) para no chocar con
// `ResultadoLineal.tipo`, que es la clasificacion de la solucion del sistema
// ('unica' | 'infinitas' | 'sin-solucion') y debe seguir disponible para la UI.
export type Resultado =
  | ({ op: 'lineal' } & ResultadoLineal)
  | ({ op: 'determinante' } & ResultadoDeterminante)
  | ({ op: 'derivada' } & ResultadoCalculo)
  | ({ op: 'integral' } & ResultadoCalculo);

/**
 * Punto de entrada unico para la UI.
 * solve('lineal', { A, b }) | solve('determinante', { A })
 * solve('derivada', { expr }) | solve('integral', { expr })
 */
export function solve(tipo: 'lineal', entrada: EntradaLineal): { op: 'lineal' } & ResultadoLineal;
export function solve(
  tipo: 'determinante',
  entrada: EntradaDeterminante,
): { op: 'determinante' } & ResultadoDeterminante;
export function solve(
  tipo: 'derivada',
  entrada: EntradaCalculo,
): { op: 'derivada' } & ResultadoCalculo;
export function solve(
  tipo: 'integral',
  entrada: EntradaCalculo,
): { op: 'integral' } & ResultadoCalculo;
export function solve(tipo: TipoOperacion, entrada: Entrada): Resultado {
  switch (tipo) {
    case 'lineal': {
      const e = entrada as EntradaLineal;
      const A = matFromNumbers(e.A);
      const b = vecFromNumbers(e.b);
      return { ...solveGaussJordan(A, b), op: 'lineal' };
    }
    case 'determinante': {
      const e = entrada as EntradaDeterminante;
      const A = matFromNumbers(e.A);
      return { ...determinant(A), op: 'determinante' };
    }
    case 'derivada': {
      const e = entrada as EntradaCalculo;
      return { ...derivative(e.expr, e.variable ?? 'x'), op: 'derivada' };
    }
    case 'integral': {
      const e = entrada as EntradaCalculo;
      return { ...integral(e.expr, e.variable ?? 'x'), op: 'integral' };
    }
  }
}
