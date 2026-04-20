/**
 * Joint Scrubber — bottom status-bar slider that drives the selected joint.
 * Shown only when a revolute/slider joint is selected (rigid has no DOF).
 */

import { useForgeStore } from '@/lib/useForgeStore';
import { type Joint } from '@/lib/joints';

function fmtDrive(j: Joint): string {
  if (j.type === 'revolute') {
    const deg = (j.drive * 180) / Math.PI;
    return `${deg.toFixed(1)}°`;
  }
  if (j.type === 'slider') {
    return `${j.drive.toFixed(3)}`;
  }
  return '—';
}

function sliderRange(j: Joint): { min: number; max: number; step: number; unit: string } {
  if (j.type === 'revolute') {
    const min = j.limits?.min ?? -Math.PI;
    const max = j.limits?.max ?? Math.PI;
    return { min, max, step: (max - min) / 200, unit: 'rad' };
  }
  if (j.type === 'slider') {
    const min = j.limits?.min ?? -1;
    const max = j.limits?.max ?? 1;
    return { min, max, step: (max - min) / 200, unit: 'u' };
  }
  return { min: 0, max: 0, step: 0, unit: '' };
}

export default function JointScrubber() {
  const joints = useForgeStore(s => s.joints);
  const selectedJointId = useForgeStore(s => s.selectedJointId);
  const driveJoint = useForgeStore(s => s.driveJoint);
  const setSelectedJoint = useForgeStore(s => s.setSelectedJoint);

  const j = joints.find(x => x.id === selectedJointId);
  if (!j || j.type === 'rigid') return null;

  const { min, max, step, unit } = sliderRange(j);

  return (
    <div
      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-lg shadow-lg animate-scaleIn forge-glass"
      style={{
        border: '1px solid var(--c-border)',
        background: 'var(--panel-glass)',
        minWidth: 420,
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: 'var(--c-gold)', boxShadow: '0 0 6px var(--c-gold-glow)' }}
        />
        <span className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: 'var(--c-gold)' }}>
          {j.type}
        </span>
        <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">{j.label}</span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={j.drive}
        onChange={(e) => driveJoint(j.id, parseFloat(e.target.value))}
        className="flex-1 accent-[var(--c-gold)]"
        style={{ minWidth: 180 }}
      />

      <div className="flex items-center gap-2 font-mono text-[11px]">
        <span style={{ color: 'var(--c-gold-dim)' }}>{fmtDrive(j)}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">
          [{min.toFixed(unit === 'rad' ? 2 : 3)} → {max.toFixed(unit === 'rad' ? 2 : 3)}]
        </span>
      </div>

      <button
        onClick={() => driveJoint(j.id, 0)}
        className="px-2 py-0.5 rounded text-[10px] hover:bg-accent/60 transition"
        style={{ border: '1px solid var(--c-border-sub)' }}
        title="Reset drive a 0"
      >
        ⟲
      </button>

      <button
        onClick={() => setSelectedJoint(null)}
        className="px-2 py-0.5 rounded text-[10px] hover:bg-accent/60 transition"
        style={{ border: '1px solid var(--c-border-sub)' }}
        title="Cerrar"
      >
        ✕
      </button>
    </div>
  );
}
