/**
 * Physics Lab — la forja donde enseñamos física real, no clases.
 *
 *   "Primero la realidad, luego los problemas."
 *
 * Arquitectura:
 *   - `registry.ts` enumera todas las ramas y módulos conocidos.
 *   - Sidebar jerárquico (rama → módulo).
 *   - El módulo seleccionado se monta en el main area vía Suspense.
 *   - AudienceContext controla densidad/tono (niño ↔ investigador).
 */

import { Suspense, useMemo, useState } from 'react';
import type { Audience } from './types';
import { AudienceContext } from './context';
import { BRANCHES, findModule } from './registry';
import Sidebar from './components/Sidebar';
import AudienceToggle from './components/AudienceToggle';
import ModuleStub from './components/ModuleStub';

const FIRST_LIVE = (() => {
  for (const b of BRANCHES) {
    const m = b.modules.find(mm => mm.status === 'live');
    if (m) return { branchId: b.id, moduleId: m.id };
  }
  return { branchId: BRANCHES[0].id, moduleId: BRANCHES[0].modules[0].id };
})();

export default function PhysicsLab() {
  const [audience, setAudience] = useState<Audience>('researcher');
  const [selected, setSelected] = useState<{ branchId: string; moduleId: string }>(FIRST_LIVE);

  const { branch, module: mod } = useMemo(
    () => findModule(selected.branchId, selected.moduleId),
    [selected],
  );

  const audienceValue = useMemo(() => ({ audience, setAudience }), [audience]);

  return (
    <AudienceContext.Provider value={audienceValue}>
      <div className="min-h-screen bg-[#05060A] text-[#E2E8F0] font-sans flex flex-col">
        <div
          className="fixed inset-0 pointer-events-none opacity-[0.03] z-0"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #CBD5E1 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        <header className="sticky top-0 z-40 bg-[#05060A]/85 backdrop-blur-xl border-b border-[#1E293B]">
          <div className="px-5 py-3 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#4FC3F7] to-[#7E57C2] flex items-center justify-center font-bold text-[#0B0F17]">
                Φ
              </div>
              <div>
                <div className="text-[15px] font-semibold tracking-tight leading-none">
                  Physics Lab · La Forja
                </div>
                <div className="text-[10px] text-[#64748B] font-medium leading-none mt-1 uppercase tracking-wider">
                  toda la física · sin clases · vé y toca
                </div>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-4">
              <AudienceToggle />
              <span className="text-[11px] text-[#64748B] font-mono hidden md:inline">
                Verlet · RK4 · SI · invariantes en vivo
              </span>
              <div className="flex items-center gap-3 text-[11px] text-[#64748B] font-mono">
                <a href="/lab.html"   className="hover:text-[#4FC3F7] transition">GAIA (Química) →</a>
                <a href="/"           className="hover:text-[#4FC3F7] transition">La Forja →</a>
              </div>
            </div>
          </div>
        </header>

        <main className="relative z-10 flex-1 grid grid-cols-1 md:grid-cols-[220px_1fr] lg:grid-cols-[260px_1fr] min-h-0">
          <aside className="hidden md:block border-r border-[#1E293B] bg-[#0B0F17] overflow-y-auto">
            <div className="p-3 border-b border-[#1E293B]">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#64748B]">Ramas</div>
              <div className="text-[11px] text-[#94A3B8] mt-1 leading-relaxed">
                {BRANCHES.length} ramas · {BRANCHES.reduce((n,b) => n + b.modules.length, 0)} módulos
              </div>
            </div>
            <Sidebar
              branches={BRANCHES}
              selected={selected}
              onSelect={(branchId, moduleId) => setSelected({ branchId, moduleId })}
            />
          </aside>

          {/* Dropdown de ramas/módulos para móvil */}
          <div className="md:hidden border-b border-[#1E293B] bg-[#0B0F17] p-3 space-y-2">
            <select
              value={`${selected.branchId}:${selected.moduleId}`}
              onChange={e => {
                const [b, m] = e.target.value.split(':');
                setSelected({ branchId: b, moduleId: m });
              }}
              className="w-full bg-[#05060A] border border-[#1E293B] rounded-md px-2 py-1.5 text-[12px] text-[#E2E8F0]"
            >
              {BRANCHES.map(b => (
                <optgroup key={b.id} label={`${b.icon} ${b.name}`}>
                  {b.modules.map(m => (
                    <option key={m.id} value={`${b.id}:${m.id}`}>
                      {m.name} {m.status !== 'live' ? `(${m.status})` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <section className="overflow-hidden min-h-0">
            {!branch || !mod ? (
              <NotFound />
            ) : mod.component ? (
              <Suspense fallback={<LoadingModule branchAccent={branch.accent} name={mod.name} />}>
                <mod.component />
              </Suspense>
            ) : (
              <ModuleStub branch={branch} module={mod} />
            )}
          </section>
        </main>
      </div>
    </AudienceContext.Provider>
  );
}

function LoadingModule({ branchAccent, name }: { branchAccent: string; name: string }) {
  return (
    <div className="h-full flex items-center justify-center bg-[#05060A]">
      <div className="text-center">
        <div
          className="w-12 h-12 rounded-full border-2 border-[#1E293B] border-t-[color:var(--a)] animate-spin mx-auto"
          style={{ ['--a' as string]: branchAccent } as React.CSSProperties}
        />
        <div className="mt-4 text-[12px] text-[#94A3B8]">compilando {name}…</div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="h-full flex items-center justify-center text-[#64748B]">
      Módulo no encontrado.
    </div>
  );
}
