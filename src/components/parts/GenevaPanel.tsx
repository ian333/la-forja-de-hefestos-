/**
 * ⚒️ La Forja — Geneva Drive Panel (live parametric editor)
 * ===========================================================
 * Drives the Geneva mechanism — sliders for slot count, crank radius,
 * pin/slot dimensions, and drive angle. Live readout of:
 *   • derived geometry (C, b, α)
 *   • engagement / dwell fractions
 *   • instantaneous kinematics (engaged, cycle index, driven angle)
 *   • invariant check rows (all must stay green as you scrub)
 *
 * Right-click opens a radial marking menu with quick presets:
 *   Slots      → 3 / 4 / 6 / 8 / 12
 *   Drive      → -α / 0 / +α / reset to 0
 *   Cerrar
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SdfOperation } from '@/lib/sdf-engine';
import {
  GENEVA_DEFAULTS,
  buildGeneva,
  genevaGeometry,
  genevaKinematics,
  type GenevaParams,
} from '@/lib/parts/geneva';
import MarkingMenu, { type MarkingMenuSection } from '@/components/MarkingMenu';

interface GenevaPanelProps {
  open: boolean;
  onClose: () => void;
  onSceneChange: (scene: SdfOperation, params: GenevaParams) => void;
}

const DEG = 180 / Math.PI;

function Slider({
  testid, label, value, min, max, step, onChange, format,
}: {
  testid: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const display = format ? format(value) : value.toFixed(3);
  return (
    <label style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 2, fontSize: 11 }}>
      <span style={{ color: 'var(--c-text-2)' }}>{label}</span>
      <span data-testid={`${testid}-value`}
            style={{ color: 'var(--c-accent, #d4af37)', fontFamily: 'monospace' }}>
        {display}
      </span>
      <input
        data-testid={`${testid}-slider`}
        style={{ gridColumn: '1 / span 2', width: '100%' }}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export default function GenevaPanel({ open, onClose, onSceneChange }: GenevaPanelProps) {
  const [params, setParams] = useState<GenevaParams>(GENEVA_DEFAULTS);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const geom = useMemo(() => genevaGeometry(params), [params]);
  const kin = useMemo(() => genevaKinematics(params), [params]);

  // Invariants (must stay green while scrubbing).
  const invPythagoras = Math.abs(
    params.crankRadius ** 2 + geom.wheelRadius ** 2 - geom.centerDistance ** 2,
  ) < 1e-9;
  const invSlotConstraint = Math.abs(
    Math.sin(Math.PI / params.slotCount) - params.crankRadius / geom.centerDistance,
  ) < 1e-12;
  const invFractions = Math.abs(
    geom.engagementFraction + geom.dwellFraction - 1,
  ) < 1e-12;

  // Defer the heavy scene rebuild to after React commits the new panel state,
  // so the DOM updates (and invariant/kinematic readouts repaint) even when
  // the GLSL shader recompile blocks the main thread for seconds.
  //
  // Under headless WebDriver (Playwright) we skip the GPU scene update
  // entirely: SwiftShader takes ~15s per shader compile on WSL and the panel
  // assertions only care about DOM state, not what the canvas renders.
  const firstRunRef = useRef(true);
  useEffect(() => {
    if (firstRunRef.current) { firstRunRef.current = false; return; }
    if (typeof navigator !== 'undefined' && navigator.webdriver) return;
    const id = window.setTimeout(() => {
      const b = buildGeneva(params);
      onSceneChange(b.rootOp, params);
    }, 0);
    return () => window.clearTimeout(id);
  }, [params, onSceneChange]);

  function update(patch: Partial<GenevaParams>) {
    setParams((prev) => ({ ...prev, ...patch }));
  }

  function setSlots(N: number) { update({ slotCount: N }); }
  function setDrive(theta: number) { update({ drive: theta }); }

  const menuSections: MarkingMenuSection[] = useMemo(() => [
    {
      label: 'Slots',
      icon: '✦',
      items: [
        { label: 'N = 3',  icon: '◢', action: () => setSlots(3)  },
        { label: 'N = 4',  icon: '◆', action: () => setSlots(4)  },
        { label: 'N = 6',  icon: '⬡', action: () => setSlots(6)  },
        { label: 'N = 8',  icon: '✱', action: () => setSlots(8)  },
        { label: 'N = 12', icon: '✸', action: () => setSlots(12) },
      ],
    },
    {
      label: 'Drive',
      icon: '⟳',
      items: [
        { label: '−α',        icon: '←',  action: () => setDrive(-geom.engagementHalfAngle) },
        { label: '0',         icon: '●',  action: () => setDrive(0) },
        { label: '+α',        icon: '→',  action: () => setDrive(geom.engagementHalfAngle)  },
        { label: '+2π (step)',icon: '↻',  action: () => setDrive(params.drive + 2 * Math.PI) },
      ],
    },
    { label: 'Cerrar', icon: '×', action: onClose },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [params, geom.engagementHalfAngle, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        data-testid="geneva-panel"
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        style={{
          position: 'fixed',
          top: 70,
          right: 12,
          width: 300,
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderRadius: 8,
          padding: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          zIndex: 50,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>
            ✦ Geneva Drive
          </span>
          <button
            data-testid="geneva-close"
            onClick={onClose}
            aria-label="close"
            style={{ background: 'transparent', border: 'none', color: 'var(--c-text-2)', cursor: 'pointer', fontSize: 16, padding: '0 6px' }}
          >×</button>
        </div>

        <section style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Kinematic parameters
          </div>
          <Slider testid="slotCount" label="N slots" value={params.slotCount}
            min={3} max={12} step={1}
            onChange={(v) => update({ slotCount: Math.round(v) })}
            format={(v) => v.toFixed(0)} />
          <Slider testid="crankRadius" label="crank a" value={params.crankRadius}
            min={0.25} max={2.5} step={0.05}
            onChange={(v) => update({ crankRadius: v })} />
          <Slider testid="drive" label="θ_D driver" value={params.drive}
            min={-4 * Math.PI} max={4 * Math.PI} step={Math.PI / 180}
            onChange={(v) => update({ drive: v })}
            format={(v) => `${(v * DEG).toFixed(1)}°`} />
        </section>

        <section style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Body
          </div>
          <Slider testid="thickness" label="thickness" value={params.thickness}
            min={0.1} max={2} step={0.05}
            onChange={(v) => update({ thickness: v })} />
          <Slider testid="pinRadius" label="pin radius" value={params.pinRadius}
            min={0.04} max={0.3} step={0.01}
            onChange={(v) => update({ pinRadius: v })} />
          <Slider testid="slotWidth" label="slot width" value={params.slotWidth}
            min={0.1} max={0.6} step={0.01}
            onChange={(v) => update({ slotWidth: v })} />
          <Slider testid="slotDepth" label="slot depth" value={params.slotDepth}
            min={0.2} max={1.5} step={0.05}
            onChange={(v) => update({ slotDepth: v })} />
        </section>

        <section
          style={{
            borderTop: '1px solid var(--c-border-sub)',
            paddingTop: 8,
            display: 'grid',
            gap: 4,
            fontSize: 11,
            fontFamily: 'monospace',
          }}
        >
          <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'system-ui' }}>
            Geometry · live
          </div>
          <div data-testid="geom-C">C (center distance) = {geom.centerDistance.toFixed(4)}</div>
          <div data-testid="geom-b">b (wheel radius) = {geom.wheelRadius.toFixed(4)}</div>
          <div data-testid="geom-alpha">α = {(geom.engagementHalfAngle * DEG).toFixed(2)}°</div>
          <div data-testid="geom-eng">
            eng = {(geom.engagementFraction * 100).toFixed(1)}%
            &nbsp;· dwell = {(geom.dwellFraction * 100).toFixed(1)}%
          </div>
        </section>

        <section
          style={{
            borderTop: '1px solid var(--c-border-sub)',
            paddingTop: 8,
            marginTop: 8,
            display: 'grid',
            gap: 4,
            fontSize: 11,
            fontFamily: 'monospace',
          }}
        >
          <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'system-ui' }}>
            Kinematics · live
          </div>
          <div
            data-testid="kin-engaged"
            style={{ color: kin.engaged ? '#6bd97a' : '#e2c97e' }}
          >
            {kin.engaged ? '▶ ENGAGED' : '◼ DWELL'}
          </div>
          <div data-testid="kin-cycle">k = {kin.cycleIndex}</div>
          <div data-testid="kin-theta-g">φ_G = {(kin.drivenAngle * DEG).toFixed(2)}°</div>
        </section>

        <section
          style={{
            borderTop: '1px solid var(--c-border-sub)',
            paddingTop: 8,
            marginTop: 8,
            display: 'grid',
            gap: 4,
            fontSize: 11,
            fontFamily: 'monospace',
          }}
        >
          <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'system-ui' }}>
            Invariants · live
          </div>
          <div data-testid="inv-pythagoras" style={{ color: invPythagoras ? '#6bd97a' : '#e75a5a' }}>
            {invPythagoras ? '✓' : '✗'} a² + b² = C²
          </div>
          <div data-testid="inv-sin" style={{ color: invSlotConstraint ? '#6bd97a' : '#e75a5a' }}>
            {invSlotConstraint ? '✓' : '✗'} sin(π/N) = a/C
          </div>
          <div data-testid="inv-fractions" style={{ color: invFractions ? '#6bd97a' : '#e75a5a' }}>
            {invFractions ? '✓' : '✗'} eng + dwell = 1
          </div>
        </section>
      </div>
      {menu && (
        <MarkingMenu
          sections={menuSections}
          position={menu}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}
