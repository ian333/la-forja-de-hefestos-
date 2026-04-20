/**
 * PeriodicTable — tabla de los 118 elementos clicable.
 *
 * Layout: grid 18 columnas × 10 filas (periodos 1-7 + 2 filas extra para
 * lantánidos/actínidos mostrados abajo, al estilo presentación estándar).
 *
 * El hover NO genera tooltip absoluto (que invadiría al contenido
 * siguiente). En cambio, expone `onHover` para que el parent pueda
 * mostrar la info del elemento en un panel dedicado.
 *
 * Modo `compact` reduce tamaño de celda para layouts laterales.
 */

import { useState } from 'react';
import {
  PERIODIC_TABLE, type Element, type Category,
} from '@/lib/chem/quantum/periodic-table';

interface PeriodicTableProps {
  selectedZ: number;
  onSelect: (Z: number) => void;
  onHover?: (Z: number | null) => void;
  compact?: boolean;
  /** Si es true, muestra la leyenda de categorías debajo. Default true. */
  showLegend?: boolean;
}

const CAT_COLORS: Record<Category, { bg: string; border: string; text: string }> = {
  'nonmetal-reactive':{ bg: 'bg-[#7DD3FC]/10',  border: 'border-[#7DD3FC]/40',  text: 'text-[#7DD3FC]' },
  'noble-gas':        { bg: 'bg-[#A78BFA]/10',  border: 'border-[#A78BFA]/40',  text: 'text-[#A78BFA]' },
  'alkali':           { bg: 'bg-[#F87171]/10',  border: 'border-[#F87171]/40',  text: 'text-[#F87171]' },
  'alkaline-earth':   { bg: 'bg-[#FB923C]/10',  border: 'border-[#FB923C]/40',  text: 'text-[#FB923C]' },
  'metalloid':        { bg: 'bg-[#FBBF24]/10',  border: 'border-[#FBBF24]/40',  text: 'text-[#FBBF24]' },
  'post-transition':  { bg: 'bg-[#94A3B8]/10',  border: 'border-[#94A3B8]/40',  text: 'text-[#E2E8F0]' },
  'transition':       { bg: 'bg-[#34D399]/10',  border: 'border-[#34D399]/40',  text: 'text-[#34D399]' },
  'lanthanide':       { bg: 'bg-[#F472B6]/10',  border: 'border-[#F472B6]/40',  text: 'text-[#F472B6]' },
  'actinide':         { bg: 'bg-[#E879F9]/10',  border: 'border-[#E879F9]/40',  text: 'text-[#E879F9]' },
  'halogen':          { bg: 'bg-[#4ADE80]/10',  border: 'border-[#4ADE80]/40',  text: 'text-[#4ADE80]' },
  'unknown':          { bg: 'bg-[#64748B]/10',  border: 'border-[#64748B]/40',  text: 'text-[#64748B]' },
};

const CAT_LABELS: Record<Category, string> = {
  'nonmetal-reactive':'No metal',
  'noble-gas':        'Noble',
  'alkali':           'Alcalino',
  'alkaline-earth':   'Alc.térreo',
  'metalloid':        'Metaloide',
  'post-transition':  'Post-trans.',
  'transition':       'Transición',
  'lanthanide':       'Lantánido',
  'actinide':         'Actínido',
  'halogen':          'Halógeno',
  'unknown':          'Desc.',
};

export default function PeriodicTable({
  selectedZ, onSelect, onHover, compact = false, showLegend = true,
}: PeriodicTableProps) {
  const [hoverZ, setHoverZ] = useState<number | null>(null);

  const handleHover = (Z: number | null) => {
    setHoverZ(Z);
    onHover?.(Z);
  };

  const cellSize = compact
    ? 'w-6 h-6 md:w-7 md:h-7'
    : 'w-10 h-10 md:w-11 md:h-11';

  const grid: (Element | null)[][] = Array.from({ length: 10 }, () =>
    new Array(18).fill(null),
  );
  for (const e of PERIODIC_TABLE) {
    const row = e.period - 1;
    grid[row][e.group - 1] = e;
  }

  return (
    <div className="space-y-2">
      <div
        className="grid gap-[1px]"
        style={{ gridTemplateColumns: 'repeat(18, minmax(0, 1fr))' }}
      >
        {grid.map((row, rIdx) =>
          row.map((el, cIdx) => {
            if (!el) {
              if (rIdx === 5 && cIdx === 2) {
                return (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    className={`${cellSize} rounded border border-dashed border-[#F472B6]/40 flex items-center justify-center font-mono text-[#F472B6] ${compact ? 'text-[6px]' : 'text-[8px]'}`}
                  >
                    57-71
                  </div>
                );
              }
              if (rIdx === 6 && cIdx === 2) {
                return (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    className={`${cellSize} rounded border border-dashed border-[#E879F9]/40 flex items-center justify-center font-mono text-[#E879F9] ${compact ? 'text-[6px]' : 'text-[8px]'}`}
                  >
                    89-103
                  </div>
                );
              }
              return <div key={`${rIdx}-${cIdx}`} className={cellSize} />;
            }
            return (
              <ElementCell
                key={el.Z}
                element={el}
                selected={el.Z === selectedZ}
                hover={el.Z === hoverZ}
                onClick={() => onSelect(el.Z)}
                onHover={handleHover}
                sizeClass={cellSize}
                compact={compact}
              />
            );
          }),
        )}
      </div>

      {showLegend && (
        <div className="flex flex-wrap gap-1 text-[9px] pt-1">
          {(Object.keys(CAT_LABELS) as Category[]).map((cat) => {
            const col = CAT_COLORS[cat];
            return (
              <div
                key={cat}
                className={`px-1.5 py-0.5 rounded border ${col.border} ${col.bg} ${col.text} font-semibold`}
              >
                {CAT_LABELS[cat]}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ElementCell({
  element, selected, hover, onClick, onHover, sizeClass, compact,
}: {
  element: Element;
  selected: boolean;
  hover: boolean;
  onClick: () => void;
  onHover: (z: number | null) => void;
  sizeClass: string;
  compact: boolean;
}) {
  const col = CAT_COLORS[element.category];
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => onHover(element.Z)}
      onMouseLeave={() => onHover(null)}
      className={`${sizeClass} rounded border ${col.border} ${col.bg} ${col.text} transition relative flex flex-col items-center justify-center leading-none ${
        selected
          ? 'ring-2 ring-white scale-110 z-10 shadow-lg'
          : hover
            ? 'ring-1 ring-white/60 scale-105 z-10'
            : 'hover:ring-1 hover:ring-white/30'
      }`}
    >
      {!compact && (
        <div className="text-[7px] opacity-60 font-mono leading-none">
          {element.Z}
        </div>
      )}
      <div
        className={`font-bold leading-none ${
          compact ? 'text-[9px] md:text-[10px]' : 'text-[12px] md:text-[13px]'
        }`}
      >
        {element.symbol}
      </div>
    </button>
  );
}
