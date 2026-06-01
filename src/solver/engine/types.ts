// types.ts — Tipos compartidos por todo el motor.

export interface Paso {
  titulo: string;
  operacion?: string; // ej. "R2 -> R2 - 3·R1"  (opcional para calculo)
  matrizLatex?: string; // estado de la matriz/expresion en LaTeX
  nota?: string;
}

export type TipoSolucion = 'unica' | 'infinitas' | 'sin-solucion';

export interface ResultadoBase {
  pasos: Paso[];
}
