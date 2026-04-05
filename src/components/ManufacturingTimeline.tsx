/**
 * Manufacturing Timeline — Fusion 360-style horizontal feature strip
 * Shows detected manufacturing features as clickable icons
 */

import { useRef, useEffect } from 'react';

interface VizFeatureChild {
  type: string;
  label: string;
  params?: Record<string, number>;
  centroid?: { x: number; y: number };
}

export interface VizFeature {
  type: string;
  label: string;
  params?: Record<string, number>;
  normal?: number[];
  centroid?: { x: number; y: number };
  depth?: number;
  confidence?: number;
  sliceCount?: number;
  count?: number;
  children?: VizFeatureChild[];
}

const FEATURE_ICONS: Record<string, string> = {
  hole: '⊙',
  slot: '▬',
  rect_pocket: '▭',
  fillet_pocket: '▭',
  polygon_pocket: '⬡',
  freeform_pocket: '◇',
  circle: '○',
  keyhole: '⊚',
  pattern_circular: '⊙×',
  pattern_linear: '▤',
  revolution: '◉',
  chamfer: '◿',
  fillet: '◠',
};

const FEATURE_COLORS: Record<string, string> = {
  hole: '#f87171',
  slot: '#facc15',
  rect_pocket: '#4ade80',
  fillet_pocket: '#4ade80',
  polygon_pocket: '#a78bfa',
  freeform_pocket: '#38bdf8',
  circle: '#60a5fa',
  keyhole: '#fb923c',
  pattern_circular: '#c084fc',
  pattern_linear: '#c084fc',
  revolution: '#f472b6',
};

interface Props {
  features: VizFeature[];
  selectedIdx: number | null;
  onSelect: (idx: number | null) => void;
}

export default function ManufacturingTimeline({ features, selectedIdx, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll selected feature into view
  useEffect(() => {
    if (selectedIdx == null || !scrollRef.current) return;
    const el = scrollRef.current.children[selectedIdx + 1] as HTMLElement; // +1 for base body
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedIdx]);

  return (
    <div className="h-9 border-t flex items-center shrink-0 z-20"
      style={{
        background: 'var(--panel-glass)',
        borderColor: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}>
      {/* Label */}
      <div className="px-3 flex items-center gap-1.5 shrink-0 border-r"
        style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        <span className="text-[10px]">⚒️</span>
        <span className="text-[9px] font-bold tracking-wider"
          style={{ color: 'var(--c-gold)' }}>
          PROCESO
        </span>
        <span className="text-[8px] font-mono" style={{ color: 'var(--c-text-3)' }}>
          {features.length}
        </span>
      </div>

      {/* Scrollable feature strip */}
      <div ref={scrollRef}
        className="flex-1 flex items-center gap-1 px-2 overflow-x-auto scrollbar-thin"
        style={{ scrollbarColor: 'rgba(201,168,76,0.15) transparent' }}>
        {/* Step 0: Base body */}
        <button
          onClick={() => onSelect(null)}
          className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[9px] transition-all ${
            selectedIdx === null
              ? 'bg-gold/15 ring-1 ring-gold/30'
              : 'hover:bg-white/[0.03] opacity-60 hover:opacity-100'
          }`}
          title="Cuerpo base">
          <span className="text-[11px]">◼</span>
          <span className="font-mono" style={{ color: 'var(--c-text-2)' }}>0</span>
        </button>

        {/* Connecting line */}
        <div className="w-3 h-px shrink-0" style={{ background: 'rgba(201,168,76,0.15)' }} />

        {features.map((f, i) => {
          const icon = FEATURE_ICONS[f.type] ?? '◆';
          const color = FEATURE_COLORS[f.type] ?? '#c9a84c';
          const isSelected = selectedIdx === i;
          const isPattern = f.type.startsWith('pattern_');
          return (
            <div key={i} className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onSelect(isSelected ? null : i)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] transition-all ${
                  isSelected
                    ? 'ring-1 shadow-lg'
                    : 'hover:bg-white/[0.03] opacity-60 hover:opacity-100'
                }`}
                style={isSelected ? {
                  background: `${color}15`,
                  borderColor: `${color}40`,
                  boxShadow: `0 0 8px ${color}20`,
                  outlineColor: `${color}40`,
                } : undefined}
                title={f.label}>
                <span style={{ color, fontSize: isPattern ? 9 : 11 }}>{icon}</span>
                <span className="font-mono" style={{ color: isSelected ? color : 'var(--c-text-3)' }}>
                  {i + 1}
                </span>
                {isPattern && f.count && (
                  <span className="text-[7px] font-bold px-0.5 rounded"
                    style={{ background: `${color}20`, color }}>
                    ×{f.count}
                  </span>
                )}
              </button>
              {i < features.length - 1 && (
                <div className="w-2 h-px shrink-0" style={{ background: 'rgba(201,168,76,0.1)' }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
