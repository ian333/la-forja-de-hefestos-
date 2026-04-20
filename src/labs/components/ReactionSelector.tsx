/**
 * ReactionSelector — menú dropdown con tarjetas de reacción.
 */

import { useState, useRef, useEffect } from 'react';
import type { Preset } from '@/lib/chem/reactions';
import { reactionToString, formatFormula } from '@/lib/chem/kinetics';

interface ReactionSelectorProps {
  presets: Preset[];
  selected: string;
  onChange: (id: string) => void;
}

function formatReaction(preset: Preset): string {
  if (preset.steps.length === 0) return preset.name;
  const raw = reactionToString(preset.steps[0]);
  return raw
    .split(' ')
    .map((token) => {
      // si es formula (empieza con mayúscula y contiene letras y dígitos), aplica subíndice
      if (/^[A-Z]/.test(token) && /\d/.test(token)) {
        return formatFormula(token);
      }
      return token;
    })
    .join(' ');
}

const CATEGORY_COLORS: Record<string, string> = {
  combustion:   'bg-orange-100 text-orange-700',
  'acid-base':  'bg-blue-100 text-blue-700',
  decomposition:'bg-purple-100 text-purple-700',
  synthesis:    'bg-green-100 text-green-700',
  redox:        'bg-yellow-100 text-yellow-700',
};

const CATEGORY_LABELS: Record<string, string> = {
  combustion:   'Combustión',
  'acid-base':  'Ácido-base',
  decomposition:'Descomposición',
  synthesis:    'Síntesis',
  redox:        'Redox',
};

export default function ReactionSelector({ presets, selected, onChange }: ReactionSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = presets.find((p) => p.id === selected) ?? presets[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E5E7EB] hover:border-[#0696D7] transition text-[13px] font-medium"
      >
        <span className="text-[#1F2937] max-w-[280px] truncate">
          {current.name}
        </span>
        <span className="text-[#9CA3AF]">▾</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-[420px] max-h-[480px] overflow-y-auto bg-white rounded-xl shadow-xl border border-[#E5E7EB] p-1.5">
          {presets.map((p) => {
            const catColor = CATEGORY_COLORS[p.category] ?? 'bg-gray-100 text-gray-700';
            const catLabel = CATEGORY_LABELS[p.category] ?? p.category;
            return (
              <button
                key={p.id}
                onClick={() => { onChange(p.id); setOpen(false); }}
                className={`w-full text-left p-3 rounded-lg hover:bg-[#F9FAFB] transition ${
                  p.id === selected ? 'bg-[#F1F8FD] ring-1 ring-[#0696D7]' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[13px] text-[#1F2937]">{p.name}</span>
                  <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${catColor}`}>
                    {catLabel}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[#6B7280] mt-1">
                  {formatReaction(p)}
                </div>
                <div className="text-[11px] text-[#6B7280] mt-1 leading-snug">
                  {p.description}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
