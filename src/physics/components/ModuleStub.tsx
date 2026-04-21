/**
 * Vista de un módulo todavía en estado `stub` o `planned`.
 *
 * Mostramos el roadmap honesto — qué ecuación, qué visualización, qué presets
 * deberían estar aquí. Así el usuario sabe qué esperar y podemos usar la misma
 * estructura para crecer sin reescribir la navegación.
 */

import type { PhysicsBranch, PhysicsModule } from '@/physics/types';
import { useAudience } from '@/physics/context';

export default function ModuleStub({ branch, module: mod }: { branch: PhysicsBranch; module: PhysicsModule }) {
  const { audience } = useAudience();
  const hint = audience === 'child' ? mod.childHint : mod.researcherHint;

  return (
    <div className="h-full overflow-y-auto bg-[#05060A]">
      <div className="max-w-[760px] mx-auto px-8 py-12">
        <div className="flex items-center gap-2.5 text-[11px] text-[#64748B] uppercase tracking-[0.14em]">
          <span style={{ color: branch.accent }}>{branch.icon}</span>
          <span>{branch.name}</span>
          <span>·</span>
          <span>{mod.status === 'stub' ? 'Esqueleto' : 'Planeado'}</span>
        </div>

        <h1 className="mt-3 text-[36px] font-bold text-white tracking-tight leading-tight">{mod.name}</h1>
        <p className="mt-3 text-[15px] text-[#CBD5E1] leading-relaxed">{mod.blurb}</p>

        {hint && (
          <div className="mt-6 p-4 rounded-lg border border-[#1E293B] bg-[#0B0F17] text-[13px] text-[#CBD5E1] leading-relaxed">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#64748B] mb-2">
              {audience === 'child' ? 'Qué verás' : 'Qué mide'}
            </div>
            {hint}
          </div>
        )}

        {mod.roadmap && mod.roadmap.length > 0 && (
          <div className="mt-8">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#64748B] mb-3">Roadmap técnico</div>
            <ol className="space-y-2.5">
              {mod.roadmap.map((item, i) => (
                <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-[#CBD5E1]">
                  <span className="shrink-0 w-6 h-6 rounded-full border border-[#1E293B] text-[#4FC3F7] text-[11px] font-mono flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="mt-0.5">{item}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-[#1E293B] text-[11px] text-[#64748B] leading-relaxed">
          La forja cubre deliberadamente toda la física. Este módulo es un
          compromiso — cuando alguien lo construya, el roadmap es la especificación.
          Para investigación, hay un integrador simpléctico y primitivas de campo
          ya listas en <span className="font-mono text-[#94A3B8]">src/lib/physics/</span>.
        </div>
      </div>
    </div>
  );
}
