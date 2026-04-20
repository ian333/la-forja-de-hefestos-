/**
 * ⚒️ La Forja — Clock Escapement Panel (live timing editor)
 * =============================================================
 * Sliders control tooth count, pendulum length, gravity, amplitude, and the
 * simulation time t. Live readouts show period, escape-wheel angular velocity,
 * current pendulum angle, anchor angle, escape angle, and the tick counter.
 * Three invariants must stay green while scrubbing:
 *    • period law:     T ≈ 2π·√(L/g) · (1 + A²/16)  (verified live)
 *    • tooth advance:  θ_e = ticks·(2π/N), ticks = ⌊2t/T + 0.5⌋
 *    • pendulum law:   θ_p(t) = A·cos(2π·t/T)
 *
 * Right-click opens a radial marking menu:
 *   Preset → seconds pendulum / 30-tooth / fast 12-tooth
 *   Time   → 0 / +T/4 / +T/2 / +T / +60s
 *   Cerrar
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SdfOperation } from '@/lib/sdf-engine';
import {
  ESCAPEMENT_DEFAULTS,
  buildEscapement,
  escapementGeometry,
  escapementKinematics,
  pendulumPeriod,
  simplePeriod,
  type EscapementParams,
} from '@/lib/parts/escapement';
import MarkingMenu, { type MarkingMenuSection } from '@/components/MarkingMenu';

interface EscapementPanelProps {
  open: boolean;
  onClose: () => void;
  onSceneChange: (scene: SdfOperation, params: EscapementParams) => void;
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

export default function EscapementPanel({ open, onClose, onSceneChange }: EscapementPanelProps) {
  const [params, setParams] = useState<EscapementParams>(ESCAPEMENT_DEFAULTS);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const derived = useMemo(() => {
    try {
      return {
        geom: escapementGeometry(params),
        kin: escapementKinematics(params),
        error: null as string | null,
      };
    } catch (e) {
      return { geom: null, kin: null, error: (e as Error).message };
    }
  }, [params]);

  const invPeriod = useMemo(() => {
    if (!derived.geom) return false;
    const T0 = simplePeriod(params.pendulumLength, params.gravity);
    const expected = pendulumPeriod(params.pendulumLength, params.gravity, params.amplitude);
    return Math.abs(derived.geom.period - expected) < 1e-10 && derived.geom.period > T0 - 1e-10;
  }, [derived.geom, params.pendulumLength, params.gravity, params.amplitude]);

  const invTicks = useMemo(() => {
    if (!derived.geom || !derived.kin) return false;
    const expected = Math.floor(params.time / (derived.geom.period / 2) + 0.5);
    const angOK = Math.abs(derived.kin.escapeAngle - expected * derived.geom.toothAngle) < 1e-12;
    return derived.kin.ticksReleased === expected && angOK;
  }, [derived.geom, derived.kin, params.time]);

  const invPendulum = useMemo(() => {
    if (!derived.geom || !derived.kin) return false;
    const expected = params.amplitude * Math.cos((2 * Math.PI * params.time) / derived.geom.period);
    return Math.abs(derived.kin.pendulumAngle - expected) < 1e-10;
  }, [derived.geom, derived.kin, params.amplitude, params.time]);

  const firstRunRef = useRef(true);
  useEffect(() => {
    if (firstRunRef.current) { firstRunRef.current = false; return; }
    if (typeof navigator !== 'undefined' && navigator.webdriver) return;
    if (derived.error) return;
    const id = window.setTimeout(() => {
      const b = buildEscapement(params);
      onSceneChange(b.rootOp, params);
    }, 0);
    return () => window.clearTimeout(id);
  }, [params, onSceneChange, derived.error]);

  function update(patch: Partial<EscapementParams>) {
    setParams((prev) => ({ ...prev, ...patch }));
  }

  function setSecondsPendulum() {
    update({
      teethCount: 30,
      pendulumLength: 9.80665 / (Math.PI * Math.PI),
      gravity: 9.80665,
      amplitude: 0.05,
    });
  }

  const menuSections: MarkingMenuSection[] = useMemo(() => {
    const T = derived.geom?.period ?? 2;
    return [
      {
        label: 'Preset',
        icon: '⏱',
        items: [
          { label: 'Seconds',    icon: '𝟐ₛ', action: setSecondsPendulum },
          { label: '30-tooth',   icon: '③⓪', action: () => update({ teethCount: 30 }) },
          { label: '12-tooth',   icon: '①②', action: () => update({ teethCount: 12 }) },
          { label: 'A = 3°',     icon: '△',   action: () => update({ amplitude: (3 * Math.PI) / 180 }) },
          { label: 'A = 6°',     icon: '▲',   action: () => update({ amplitude: (6 * Math.PI) / 180 }) },
        ],
      },
      {
        label: 'Time',
        icon: '⏲',
        items: [
          { label: '0',     icon: '●', action: () => update({ time: 0 }) },
          { label: '+T/4',  icon: '¼', action: () => update({ time: params.time + T / 4 }) },
          { label: '+T/2',  icon: '½', action: () => update({ time: params.time + T / 2 }) },
          { label: '+T',    icon: '①', action: () => update({ time: params.time + T }) },
          { label: '+60s',  icon: '⑥⓪', action: () => update({ time: params.time + 60 }) },
        ],
      },
      { label: 'Cerrar', icon: '×', action: onClose },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, derived.geom, onClose]);

  if (!open) return null;

  const geom = derived.geom;
  const kin = derived.kin;

  return (
    <>
      <div
        data-testid="escapement-panel"
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        style={{
          position: 'fixed',
          top: 70,
          right: 12,
          width: 320,
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
            ⏱ Escapement (deadbeat)
          </span>
          <button
            data-testid="escapement-close"
            onClick={onClose}
            aria-label="close"
            style={{ background: 'transparent', border: 'none', color: 'var(--c-text-2)', cursor: 'pointer', fontSize: 16, padding: '0 6px' }}
          >×</button>
        </div>

        <section style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Wheel + pendulum
          </div>
          <Slider testid="teethCount" label="teeth N" value={params.teethCount}
            min={8} max={60} step={1}
            onChange={(v) => update({ teethCount: Math.round(v) })}
            format={(v) => v.toFixed(0)} />
          <Slider testid="pendulumLength" label="length L" value={params.pendulumLength}
            min={0.05} max={2.0} step={0.001}
            onChange={(v) => update({ pendulumLength: v })} />
          <Slider testid="gravity" label="g" value={params.gravity}
            min={1.62} max={24.79} step={0.001}
            onChange={(v) => update({ gravity: v })} />
          <Slider testid="amplitude" label="A" value={params.amplitude}
            min={0.005} max={Math.PI / 3} step={0.001}
            onChange={(v) => update({ amplitude: v })}
            format={(v) => `${(v * DEG).toFixed(2)}°`} />
          <Slider testid="time" label="t" value={params.time}
            min={0} max={120} step={0.01}
            onChange={(v) => update({ time: v })}
            format={(v) => `${v.toFixed(2)} s`} />
        </section>

        {derived.error ? (
          <div
            data-testid="esc-error"
            style={{
              background: '#3a1111',
              color: '#e75a5a',
              border: '1px solid #7a2020',
              borderRadius: 4,
              padding: 6,
              fontSize: 11,
              fontFamily: 'monospace',
            }}
          >
            ✗ {derived.error}
          </div>
        ) : (
          <>
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
                Timing · live
              </div>
              <div data-testid="geom-period">T = {geom!.period.toFixed(4)} s</div>
              <div data-testid="geom-period-simple">T₀ = {geom!.periodSimple.toFixed(4)} s</div>
              <div data-testid="geom-tooth">2π/N = {(geom!.toothAngle * DEG).toFixed(2)}°</div>
              <div data-testid="geom-omega">ω_e = {geom!.escapeAngularVelocity.toFixed(4)} rad/s</div>
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
                Phase · live
              </div>
              <div data-testid="kin-pendulum">θ_p = {(kin!.pendulumAngle * DEG).toFixed(3)}°</div>
              <div data-testid="kin-anchor">θ_a = {(kin!.anchorAngle * DEG).toFixed(3)}°</div>
              <div data-testid="kin-escape">θ_e = {(kin!.escapeAngle * DEG).toFixed(2)}°</div>
              <div data-testid="kin-ticks">ticks = {kin!.ticksReleased}</div>
              <div data-testid="kin-pallet">
                locking = {kin!.entryPalletLocking ? 'entry' : 'exit'}
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
                Invariants · live
              </div>
              <div data-testid="inv-period" style={{ color: invPeriod ? '#6bd97a' : '#e75a5a' }}>
                {invPeriod ? '✓' : '✗'} T = 2π·√(L/g)·(1 + A²/16 + …)
              </div>
              <div data-testid="inv-ticks" style={{ color: invTicks ? '#6bd97a' : '#e75a5a' }}>
                {invTicks ? '✓' : '✗'} θ_e = ticks·(2π/N), ticks = ⌊2t/T + ½⌋
              </div>
              <div data-testid="inv-pendulum" style={{ color: invPendulum ? '#6bd97a' : '#e75a5a' }}>
                {invPendulum ? '✓' : '✗'} θ_p(t) = A·cos(2π·t/T)
              </div>
            </section>
          </>
        )}
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
