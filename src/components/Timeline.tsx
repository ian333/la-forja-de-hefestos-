/**
 * ⚒️ La Forja — Parametric Timeline
 * ====================================
 * The history timeline bar at the bottom of the viewport.
 * Shows each operation as a node that can be clicked to restore state.
 * Drag the marker to scrub through history.
 * 
 * Just like Fusion 360's timeline — each feature is a step.
 */

import { useRef } from 'react';

export interface TimelineEntry {
  id: number;
  label: string;
  icon: string;
  type: 'primitive' | 'operation' | 'modify' | 'delete';
}

interface TimelineProps {
  entries: TimelineEntry[];
  currentIndex: number;
  onSeek: (index: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  primitive: '#c9a84c',
  operation: '#b4a0ff',
  modify: '#FFB900',
  delete: '#e53e3e',
};

export default function Timeline({
  entries, currentIndex, onSeek, onUndo, onRedo, canUndo, canRedo,
}: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="h-10 flex items-center px-3 gap-1.5 shrink-0 z-20" style={{ background: 'rgba(8,9,13,0.70)', borderTop: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)' }}>
      {/* Undo/Redo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-[13px] text-[#6b6050] hover:text-[#f0ece4] hover:bg-white/[0.04] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
        title="Deshacer (Ctrl+Z)"
      >
        ↶
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-[13px] text-[#6b6050] hover:text-[#f0ece4] hover:bg-white/[0.04] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
        title="Rehacer (Ctrl+Y)"
      >
        ↷
      </button>

      <div className="w-px h-4 bg-white/[0.06] mx-1" />

      {/* Timeline label */}
      <span className="text-[10px] text-[#4a4035] uppercase tracking-wider font-medium shrink-0 mr-1">Timeline</span>

      {/* Scrollable timeline track */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-center gap-px overflow-x-auto scrollbar-thin py-1"
        style={{ scrollBehavior: 'smooth' }}
      >
        {entries.length === 0 && (
          <span className="text-[11px] text-[#4a4035] italic">Sin historial</span>
        )}
        {entries.map((entry, i) => {
          const isCurrent = i === currentIndex;
          const isPast = i <= currentIndex;
          const color = TYPE_COLORS[entry.type] ?? '#888';

          return (
            <div key={entry.id} className="flex items-center shrink-0">
              {/* Connector line */}
              {i > 0 && (
                <div
                  className="h-px w-3 transition-colors"
                  style={{ background: isPast ? color : 'rgba(255,255,255,0.06)' }}
                />
              )}
              {/* Node */}
              <button
                onClick={() => onSeek(i)}
                title={entry.label}
                className={`relative flex items-center justify-center rounded transition-all group ${
                  isCurrent
                    ? 'ring-2 ring-offset-1 ring-offset-[#08090d]'
                    : isPast
                      ? 'opacity-80 hover:opacity-100'
                      : 'opacity-30 hover:opacity-60'
                }`}
                style={{
                  width: 28,
                  height: 28,
                  background: isCurrent ? `${color}15` : isPast ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                  borderWidth: 1,
                  borderColor: isCurrent ? color : isPast ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                  borderRadius: 8,
                  ['ringColor' as string]: isCurrent ? color : 'transparent',
                }}
              >
                <span className="text-[11px]" style={{ color: isPast ? color : '#555' }}>
                  {entry.icon}
                </span>
                {/* Tooltip on hover */}
                <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg text-[10px] text-[#f0ece4] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10" style={{ background: 'rgba(8,9,13,0.85)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
                  {entry.label}
                  <span className="ml-1.5 text-[9px] text-[#4a4035] font-mono">#{i + 1}</span>
                </div>
              </button>
            </div>
          );
        })}

        {/* Current position marker */}
        {entries.length > 0 && (
          <div className="flex items-center shrink-0 ml-1">
            <div className="w-0 h-0 border-t-[5px] border-b-[5px] border-l-[7px] border-transparent border-l-[#c9a84c]" />
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-white/[0.06] mx-1" />

      {/* History count */}
      <span className="text-[10px] text-[#4a4035] font-mono shrink-0">
        {currentIndex + 1}/{entries.length}
      </span>
    </div>
  );
}
