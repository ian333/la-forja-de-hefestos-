/**
 * SolverTab — el panel scrolleable que muestra los PASOS exactos del solver
 * para el problema que el modulo esta visualizando en 3D. Es el contenido del
 * tercer tab ('∑ Pasos') del LessonPanel.
 *
 * Si el modulo no tiene resolvedor (resultado=null), muestra un mensaje honesto
 * en vez de inventar pasos.
 */
import type { Resultado } from '@/solver/engine';
import PasosView from '@/solver/components/PasosView';

export default function SolverTab({
  resultado,
  titulo,
}: {
  resultado: Resultado | null;
  titulo?: string;
}) {
  if (!resultado) {
    return (
      <div className="text-[12px] text-[#94A3B8] leading-relaxed space-y-2">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[#64748B]">Pasos exactos</div>
        <p>Este modulo todavia no tiene resolvedor paso a paso conectado.</p>
        <p className="text-[#64748B]">
          La visualizacion 3D ya muestra el resultado; el detalle simbolico llegara
          cuando el motor cubra esta operacion.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {titulo && (
        <div className="text-[10px] uppercase tracking-[0.14em] text-[#FDB813]">{titulo}</div>
      )}
      <p className="text-[11px] text-[#64748B] leading-relaxed">
        Mismos numeros que la viz 3D — pero resueltos de forma exacta, sin caja negra.
      </p>
      <PasosView resultado={resultado} />
    </div>
  );
}
