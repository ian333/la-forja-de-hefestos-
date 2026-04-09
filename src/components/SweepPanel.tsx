/**
 * ⚒️ Sweep Panel — Barrido Adaptivo
 * Topology sparklines per axis + corroborated features list
 */
import { useCallback, useRef, useEffect, useState } from 'react';
import type { CrossAxisResult, AxisSweepResult, CorroboratedFeature } from '@/lib/gpu-cross-section';

interface SweepPanelProps {
  result: CrossAxisResult;
  onClose: () => void;
  onFeatureClick?: (feature: CorroboratedFeature) => void;
}

// ── Sparkline canvas for one axis ──
function AxisSparkline({ sweep, color, label }: { sweep: AxisSweepResult; color: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || sweep.samples.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const samples = sweep.samples;
    const minD = samples[0].depth;
    const maxD = samples[samples.length - 1].depth;
    const range = maxD - minD || 1;
    const maxC = Math.max(...samples.map(s => s.contourCount), 1);

    // Background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = '#1e2538';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (H * i) / 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Transition markers
    for (const tr of sweep.transitions) {
      const x = ((tr.fromDepth + tr.toDepth) / 2 - minD) / range * W;
      ctx.strokeStyle = tr.toCount > tr.fromCount ? '#22c55e40' : '#ef444440';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // Contour count line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let first = true;
    for (const s of samples) {
      const x = (s.depth - minD) / range * W;
      const y = H - (s.contourCount / maxC) * (H - 8) - 4;
      if (first) { ctx.moveTo(x, y); first = false; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill under
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = color.replace(')', ',0.08)').replace('rgb', 'rgba');
    ctx.fill();

    // Axis label
    ctx.fillStyle = '#a0947e';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText(label, 4, 13);

    // Stats
    ctx.fillStyle = '#6a5e4e';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${samples.length} slices · ${sweep.transitions.length} trans · ${sweep.totalMs.toFixed(0)}ms`, W - 4, 13);
    ctx.textAlign = 'left';

    // Max contour label
    ctx.fillStyle = color;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillText(`max ${maxC}`, 4, H - 4);
  }, [sweep, color, label]);

  return (
    <canvas
      ref={canvasRef}
      width={480}
      height={64}
      className="w-full rounded border border-border-sub"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

// ── Feature type badge ──
function TypeBadge({ feature }: { feature: CorroboratedFeature }) {
  const colors: Record<string, string> = {
    hole: 'text-red bg-red/10 border-red/20',
    boss: 'text-teal bg-teal/10 border-teal/20',
    pocket: 'text-orange bg-orange/10 border-orange/20',
    slot: 'text-blue bg-blue/10 border-blue/20',
    feature: 'text-text-2 bg-surface-up border-border',
  };
  const cls = colors[feature.type] || colors.feature;
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${cls}`}>
      {feature.type}
    </span>
  );
}

// ── Stars for corroboration ──
function Stars({ n }: { n: number }) {
  if (n >= 3) return <span className="text-green text-[11px]">★★★</span>;
  return <span className="text-gold text-[11px]">★★</span>;
}

export default function SweepPanel({ result, onClose, onFeatureClick }: SweepPanelProps) {
  const [filter, setFilter] = useState<'all' | 'triple' | 'holes' | 'bosses'>('all');

  const filtered = result.features.filter(f => {
    if (filter === 'triple') return f.corroboration === 3;
    if (filter === 'holes') return f.isHole;
    if (filter === 'bosses') return !f.isHole;
    return true;
  });

  const triple = result.features.filter(f => f.corroboration === 3).length;
  const double = result.features.filter(f => f.corroboration === 2).length;
  const totalSlices = Object.values(result.sweeps).reduce((s, sw) => s + sw.samples.length, 0);
  const totalTransitions = Object.values(result.sweeps).reduce((s, sw) => s + sw.transitions.length, 0);

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-base/95 backdrop-blur-xl border-l border-border z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold text-text-1">⚒️ Barrido Adaptivo</h2>
          <p className="text-[10px] text-text-3 mt-0.5">
            {totalSlices} slices auto → {totalTransitions} boundaries · {result.totalMs.toFixed(0)}ms
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-text-3 hover:text-text-1 transition-colors text-lg px-2"
        >
          ✕
        </button>
      </div>

      {/* Sparklines */}
      <div className="px-4 py-3 space-y-2 border-b border-border-sub">
        <AxisSparkline sweep={result.sweeps.X} color="rgb(239,68,68)" label="X axis" />
        <AxisSparkline sweep={result.sweeps.Y} color="rgb(34,197,94)" label="Y axis" />
        <AxisSparkline sweep={result.sweeps.Z} color="rgb(59,130,246)" label="Z axis" />
      </div>

      {/* Summary bar */}
      <div className="px-4 py-2 flex items-center gap-3 border-b border-border-sub text-[11px]">
        <span className="text-green font-mono">★★★ {triple}</span>
        <span className="text-gold font-mono">★★ {double}</span>
        <span className="text-text-3">·</span>
        <span className="text-text-2">{result.features.length} features</span>
        <div className="ml-auto flex gap-1">
          {(['all', 'triple', 'holes', 'bosses'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                filter === f
                  ? 'bg-gold/20 text-gold border border-gold/30'
                  : 'text-text-3 hover:text-text-2 border border-transparent'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'triple' ? '★★★' : f === 'holes' ? 'Holes' : 'Bosses'}
            </button>
          ))}
        </div>
      </div>

      {/* Features list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((f, i) => (
          <button
            key={i}
            onClick={() => onFeatureClick?.(f)}
            className="w-full px-4 py-2 flex items-center gap-2 hover:bg-surface-up/50 transition-colors text-left border-b border-border-sub/50"
          >
            <span className="text-text-3 text-[10px] font-mono w-6 text-right">
              {i + 1}
            </span>
            <Stars n={f.corroboration} />
            <TypeBadge feature={f} />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-text-2 font-mono truncate">
                ({f.world[0].toFixed(1)}, {f.world[1].toFixed(1)}, {f.world[2]?.toFixed(1) ?? '?'})
              </div>
              {f.depthRange && (
                <div className="text-[9px] text-text-3 font-mono">
                  z=[{f.depthRange[0].toFixed(1)}, {f.depthRange[1].toFixed(1)}] · d={f.depthCount}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-[10px] text-text-3 font-mono">
                {f.area > 10000 ? `${(f.area / 1000).toFixed(0)}K` : f.area.toFixed(0)} mm²
              </div>
              {f.circularity > 0.85 && (
                <div className="text-[9px] text-teal font-mono">⊙ {(f.circularity * 100).toFixed(0)}%</div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Discovered planes footer */}
      <div className="px-4 py-2 border-t border-border text-[10px] text-text-3 font-mono">
        {totalTransitions} planos naturales descubiertos · compresión {((1 - totalTransitions / totalSlices) * 100).toFixed(0)}%
      </div>
    </div>
  );
}
