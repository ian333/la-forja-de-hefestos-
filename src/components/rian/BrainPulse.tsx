/**
 * BrainPulse — compact viewport overlay that shows the live Kuramoto order
 * parameters of the RIAN reservoir.
 *
 * One ring per module plus a central global-order ring. Radius and glow scale
 * with R ∈ [0, 1], where 0 = incoherent noise and 1 = fully phase-locked.
 *
 * Protocol cost: M+1 floats per frame, independent of reservoir size — the
 * exact same overlay works when N scales from 1024 to 10^9.
 */

import { useEffect, useMemo } from 'react';
import { useRianStore } from '@/lib/rian/rian-store';

export default function BrainPulse() {
  const conn = useRianStore((s) => s.conn);
  const pulse = useRianStore((s) => s.pulse);
  const error = useRianStore((s) => s.error);
  const init = useRianStore((s) => s.init);
  const startPulse = useRianStore((s) => s.startPulse);
  const stopPulse = useRianStore((s) => s.stopPulse);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (conn !== 'online') return;
    startPulse(100, 4);
    return () => stopPulse();
  }, [conn, startPulse, stopPulse]);

  const modules = pulse?.R_mod ?? [];
  const rGlob = pulse?.R_glob ?? 0;

  const layout = useMemo(() => {
    const M = modules.length;
    const cx = 48;
    const cy = 48;
    const ringR = 30;
    return Array.from({ length: M }, (_, i) => {
      const angle = (i / Math.max(1, M)) * Math.PI * 2 - Math.PI / 2;
      return {
        x: cx + Math.cos(angle) * ringR,
        y: cy + Math.sin(angle) * ringR,
      };
    });
  }, [modules.length]);

  if (conn === 'offline') {
    return (
      <div className="pointer-events-none absolute bottom-4 right-4 z-30 rounded-md bg-zinc-900/80 px-3 py-2 text-[11px] text-zinc-400 backdrop-blur">
        RIAN offline{error ? ` · ${error}` : ''}
      </div>
    );
  }
  if (conn !== 'online' || !pulse) return null;

  const globR = 3 + rGlob * 18;

  return (
    <button
      type="button"
      onClick={() => window.open('/brain.html', '_blank', 'noopener')}
      className="absolute bottom-4 right-4 z-30 cursor-pointer rounded-lg bg-zinc-900/85 px-3 py-2 text-[11px] text-zinc-200 shadow-lg backdrop-blur transition hover:bg-zinc-800/90"
      title={`abrir vista de campo · R_glob=${rGlob.toFixed(3)}  t=${pulse.t.toFixed(2)}s  steps=${pulse.steps}`}
    >
      <div className="mb-1 flex items-center justify-between gap-4">
        <span className="text-[10px] uppercase tracking-wider text-zinc-400">
          RIAN · pulse ↗
        </span>
        <span className="font-mono text-zinc-500">t={pulse.t.toFixed(1)}s</span>
      </div>
      <svg width={96} height={96} className="block">
        <circle
          cx={48}
          cy={48}
          r={34}
          fill="none"
          stroke="rgb(39 39 42)"
          strokeWidth={1}
        />
        {modules.map((r, i) => {
          const { x, y } = layout[i];
          const rad = 2 + r * 12;
          const alpha = 0.25 + r * 0.75;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={rad}
              fill={`rgba(110, 231, 183, ${alpha})`}
            >
              <title>{`module ${i}: R=${r.toFixed(3)}`}</title>
            </circle>
          );
        })}
        <circle
          cx={48}
          cy={48}
          r={globR}
          fill={`rgba(250, 204, 21, ${0.3 + rGlob * 0.7})`}
        />
      </svg>
      <div className="mt-1 flex justify-between gap-2 font-mono text-[10px] text-zinc-400">
        <span>R<sub>glob</sub>={rGlob.toFixed(3)}</span>
        <span>M={modules.length}</span>
      </div>
    </button>
  );
}
