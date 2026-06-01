/**
 * useSolverFor — hook PUENTE entre la viz 3D de un modulo del Math Lab y el
 * Resolvedor simbolico paso a paso (src/solver/engine).
 *
 * El modulo es la fuente de verdad del input (la matriz M de Matrix3D; el expr
 * del preset activo de Derivative1D; la funcion activa de RiemannIntegral). Este
 * hook toma ese input, llama a `solve(...)`, y devuelve el `Resultado | null`
 * memoizado sobre el input serializado. Asi los pasos exactos que se muestran
 * son EXACTAMENTE el mismo problema que la viz dibuja, por construccion.
 *
 * Ademas publica el resultado al ReportContext para que el boton "Exportar PDF"
 * del shell pueda meter los pasos en el reporte sin que el modulo conozca al shell.
 */
import { useEffect, useMemo } from 'react';
import { solve } from '@/solver/engine';
import type { Resultado } from '@/solver/engine';
import { useReport, type ModuleMeta } from '@/math/report/ReportContext';

export type SolverSpec =
  | { op: 'derivada'; expr: string; variable?: string }
  | { op: 'integral'; expr: string; variable?: string }
  | { op: 'determinante'; A: number[][] }
  | { op: 'lineal'; A: number[][]; b: number[] };

/**
 * @param spec  descripcion del problema a resolver (o null si el modulo no mapea
 *              en este instante). Recalcula solo cuando cambia su forma serializada.
 * @param meta  identidad del modulo, para que el reporte sepa de donde salio.
 */
export function useSolverFor(spec: SolverSpec | null, meta?: ModuleMeta | null): Resultado | null {
  const { setSolverResult, setModuleMeta } = useReport();

  // Clave estable: serializa el spec. Numeros con toda su precision.
  const key = useMemo(() => (spec ? JSON.stringify(spec) : ''), [spec]);

  const resultado = useMemo<Resultado | null>(() => {
    if (!spec) return null;
    try {
      switch (spec.op) {
        case 'derivada':
          return solve('derivada', { expr: spec.expr, variable: spec.variable ?? 'x' });
        case 'integral':
          return solve('integral', { expr: spec.expr, variable: spec.variable ?? 'x' });
        case 'determinante':
          return solve('determinante', { A: spec.A });
        case 'lineal':
          return solve('lineal', { A: spec.A, b: spec.b });
      }
    } catch {
      return null;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Publica al ReportContext (para el boton de exportar del shell).
  useEffect(() => {
    setSolverResult(resultado);
    return () => setSolverResult(null);
  }, [resultado, setSolverResult]);

  const metaKey = meta ? `${meta.rama}/${meta.moduleId}/${meta.nombre}` : '';
  useEffect(() => {
    if (meta) setModuleMeta(meta);
    return () => setModuleMeta(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaKey, setModuleMeta]);

  return resultado;
}
