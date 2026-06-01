/**
 * PasosView — render compartido de los PASOS del Resolvedor simbolico con KaTeX.
 *
 *   Esta es la pieza que antes vivia INLINE dentro de SolverPortal.tsx (helpers
 *   `tex()`, componente `Math`, `PasoCard`, `ResultadoVista`). Se extrajo aqui
 *   para reutilizarla DENTRO del Math Lab: el alumno ve la viz 3D y, al lado,
 *   exactamente los mismos pasos exactos que da el motor.
 *
 *   Riesgo R3F respetado: KaTeX es DOM/HTML puro (divs), NUNCA va dentro del
 *   arbol <Canvas> de R3F (drei <Text> crashea EffectComposer; KaTeX no, porque
 *   nunca toca el render-loop). Por eso este componente vive en divs HUD
 *   junto/sobre el canvas, jamas como hijo de <Stage>.
 */
import katex from 'katex';
import type { Resultado, Paso } from '../engine';

// ── Paleta GAIA ──────────────────────────────────────────────────────────────
const ACCENT = '#4FC3F7'; // azul

// ── Helpers de KaTeX ─────────────────────────────────────────────────────────
export function tex(latex: string, displayMode = true): { __html: string } {
  try {
    return {
      __html: katex.renderToString(latex, { throwOnError: false, displayMode }),
    };
  } catch {
    return { __html: `<code>${latex}</code>` };
  }
}

export function Math({
  latex,
  display = true,
  className = '',
}: {
  latex: string;
  display?: boolean;
  className?: string;
}) {
  return <span className={className} dangerouslySetInnerHTML={tex(latex, display)} />;
}

// ── Render de un paso ────────────────────────────────────────────────────────
export function PasoCard({ paso, idx }: { paso: Paso; idx: number }) {
  return (
    <div className="rounded-xl border border-[#1E293B] bg-[#0A0D14] px-5 py-4">
      <div className="flex items-baseline gap-3">
        <span
          className="shrink-0 w-7 h-7 rounded-full grid place-items-center text-[12px] font-bold text-[#05060A] font-mono"
          style={{ background: ACCENT }}
        >
          {idx + 1}
        </span>
        <div className="text-[15px] font-semibold text-white">{paso.titulo}</div>
      </div>
      {paso.operacion && (
        <div className="mt-2 ml-10 inline-block rounded-md bg-[#0B0F17] border border-[#1E293B] px-3 py-1 text-[13px] font-mono text-[#FDB813]">
          {paso.operacion}
        </div>
      )}
      {paso.matrizLatex && (
        <div className="mt-3 ml-10 overflow-x-auto text-[#E2E8F0]">
          <Math latex={paso.matrizLatex} />
        </div>
      )}
      {paso.nota && <div className="mt-2 ml-10 text-[12px] text-[#94A3B8] leading-relaxed">{paso.nota}</div>}
    </div>
  );
}

/**
 * PasosView — toma un `Resultado` del motor y dibuja la respuesta destacada +
 * la lista de pasos. ES el componente clave (antes `ResultadoVista`). Cero
 * cambio visual respecto del portal original.
 */
export default function PasosView({ resultado }: { resultado: Resultado }) {
  const pasos = resultado.pasos;

  // Encabezado / respuesta final segun el tipo de operacion.
  let titulo = '';
  let respuesta: React.ReactNode = null;
  let advertencia: React.ReactNode = null;

  switch (resultado.op) {
    case 'lineal': {
      titulo = 'Sistema lineal · Gauss-Jordan';
      if (resultado.tipo === 'unica' && resultado.solucion) {
        const latex = resultado.solucion.map((f, i) => `x_{${i + 1}} = ${f.toLatex()}`).join(', \\quad ');
        respuesta = <Math latex={latex} />;
      } else if (resultado.tipo === 'infinitas') {
        respuesta = <span className="text-[#FDB813] font-semibold">Infinitas soluciones</span>;
        advertencia = resultado.nota ? <span>{resultado.nota}</span> : null;
      } else {
        respuesta = <span className="text-[#FB7185] font-semibold">El sistema no tiene solucion</span>;
        advertencia = resultado.nota ? <span>{resultado.nota}</span> : null;
      }
      break;
    }
    case 'determinante': {
      titulo = 'Determinante';
      respuesta = <Math latex={`\\det(A) = ${resultado.valor.toLatex()}`} />;
      break;
    }
    case 'derivada':
    case 'integral': {
      titulo = resultado.op === 'derivada' ? 'Derivada' : 'Integral indefinida';
      if (!resultado.soportado) {
        respuesta = <span className="text-[#FB7185] font-semibold">No soportado todavia</span>;
        advertencia = (
          <span>{resultado.nota ?? 'Esta expresion sale del alcance del motor. No inventamos un resultado.'}</span>
        );
      } else if (resultado.resultadoLatex) {
        respuesta = <Math latex={resultado.resultadoLatex} />;
      }
      break;
    }
  }

  return (
    <div>
      {/* Respuesta destacada */}
      <div className="rounded-2xl border border-[#4FC3F7]/30 bg-[#0A0D14] p-6 mb-6">
        <div className="text-[11px] font-mono text-[#64748B] uppercase tracking-wider">{titulo} · respuesta</div>
        <div className="mt-3 text-[#E2E8F0] overflow-x-auto">{respuesta}</div>
        {advertencia && <div className="mt-3 text-[13px] text-[#94A3B8] leading-relaxed">{advertencia}</div>}
      </div>

      {/* Pasos */}
      {pasos.length > 0 && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-[#1E293B]" />
            <span className="text-[11px] font-mono text-[#64748B] uppercase tracking-wider">
              {pasos.length} paso{pasos.length === 1 ? '' : 's'}
            </span>
            <div className="h-px flex-1 bg-[#1E293B]" />
          </div>
          <div className="space-y-3">
            {pasos.map((p, i) => (
              <PasoCard key={i} paso={p} idx={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
