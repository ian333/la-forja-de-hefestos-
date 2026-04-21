/**
 * Sidebar jerárquico — ramas colapsables, módulos seleccionables.
 *
 * Cada módulo muestra su status con un pill. Externos abren en otro tab.
 */

import { useState } from 'react';
import type { PhysicsBranch, PhysicsModule, ModuleStatus } from '@/physics/types';

interface Props {
  branches: PhysicsBranch[];
  selected: { branchId: string; moduleId: string } | null;
  onSelect: (branchId: string, moduleId: string) => void;
}

const STATUS_STYLE: Record<ModuleStatus, { label: string; className: string }> = {
  live:     { label: 'live',     className: 'bg-[#4FC3F7]/15 text-[#4FC3F7] border-[#4FC3F7]/30' },
  stub:     { label: 'stub',     className: 'bg-[#FDB813]/10 text-[#FDB813] border-[#FDB813]/25' },
  planned:  { label: 'planned',  className: 'bg-[#64748B]/15 text-[#94A3B8] border-[#64748B]/25' },
  external: { label: 'externo',  className: 'bg-[#7E57C2]/15 text-[#C4A8FF] border-[#7E57C2]/30' },
};

export default function Sidebar({ branches, selected, onSelect }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(branches.map(b => [b.id, b.id === selected?.branchId])),
  );
  const toggle = (id: string) => setOpen(o => ({ ...o, [id]: !o[id] }));

  return (
    <nav className="flex flex-col gap-1 p-2 text-[12px]">
      {branches.map(br => {
        const isOpen = open[br.id] ?? false;
        return (
          <div key={br.id} className="rounded-md">
            <button
              onClick={() => toggle(br.id)}
              data-testid={`branch-${br.id}`}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-[#121823] group"
            >
              <span className="text-[13px]" style={{ color: br.accent }}>{br.icon}</span>
              <span className="flex-1 text-left font-medium text-[#E2E8F0]">{br.name}</span>
              <span className="text-[#64748B] text-[10px] font-mono">{br.modules.length}</span>
              <span className={`text-[#64748B] transition ${isOpen ? 'rotate-90' : ''}`}>›</span>
            </button>
            {isOpen && (
              <div className="pl-3 pb-1 flex flex-col gap-0.5 border-l border-[#1E293B] ml-5 mt-0.5">
                {br.modules.map(mod => (
                  <ModuleRow
                    key={mod.id}
                    mod={mod}
                    active={selected?.branchId === br.id && selected?.moduleId === mod.id}
                    onClick={() => {
                      if (mod.status === 'external' && mod.externalUrl) {
                        window.open(mod.externalUrl, '_blank', 'noopener');
                        return;
                      }
                      onSelect(br.id, mod.id);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function ModuleRow({ mod, active, onClick }: { mod: PhysicsModule; active: boolean; onClick: () => void }) {
  const sty = STATUS_STYLE[mod.status];
  return (
    <button
      onClick={onClick}
      data-testid={`module-${mod.id}`}
      className={`group flex items-start gap-2 px-2 py-1.5 rounded-md text-left transition ${
        active ? 'bg-gradient-to-r from-[#1E40AF]/25 to-[#7E22CE]/15' : 'hover:bg-[#121823]'
      }`}
    >
      <span
        className={`mt-0.5 shrink-0 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${sty.className}`}
        style={{ minWidth: 52, textAlign: 'center' }}
      >
        {sty.label}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-[12px] ${active ? 'text-white' : 'text-[#CBD5E1]'}`}>{mod.name}</span>
        <span className="block text-[10px] text-[#64748B] leading-snug line-clamp-2">{mod.blurb}</span>
      </span>
    </button>
  );
}
