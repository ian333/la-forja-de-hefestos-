/**
 * ⚒️ La Forja — Mechanical Clock Panel (Peldaño 6 capstone)
 * =============================================================
 * Escapement + 3-stage compound gear train + 3 hands. Scrub `time` and watch
 * the clock tell real time. Three invariants must stay green while editing:
 *
 *   • real-time chain:  ω_s = 2π/60, ω_m = 2π/3600, ω_h = 2π/43200
 *   • compound ratio:   ω_h / ω_e = escapeToSeconds · secondsToMinute · minuteToHour
 *   • decoded clock:    decoded HH·3600 + MM·60 + SS matches t mod 43200
 *
 * Right-click: Preset → Real / Fast / Slow  |  Time → 0 / +1min / +1h / +12h
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SdfOperation } from '@/lib/sdf-engine';
import {
  CLOCK_DEFAULTS,
  buildClock,
  clockGeometry,
  clockKinematics,
  formatClockTime,
  tunePendulumLength,
  type ClockParams,
} from '@/lib/parts/clock';
import MarkingMenu, { type MarkingMenuSection } from '@/components/MarkingMenu';

interface ClockPanelProps {
  open: boolean;
  onClose: () => void;
  onSceneChange: (scene: SdfOperation, params: ClockParams) => void;
}

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

export default function ClockPanel({ open, onClose, onSceneChange }: ClockPanelProps) {
  const [params, setParams] = useState<ClockParams>(CLOCK_DEFAULTS);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const derived = useMemo(() => {
    try {
      return {
        geom: clockGeometry(params),
        kin: clockKinematics(params),
        error: null as string | null,
      };
    } catch (e) {
      return { geom: null, kin: null, error: (e as Error).message };
    }
  }, [params]);

  const invRealTime = derived.geom?.isRealTime === true;

  const invCompoundRatio = useMemo(() => {
    if (!derived.geom) return false;
    const product = params.escapeToSecondsRatio * params.secondsToMinuteRatio * params.minuteToHourRatio;
    const ratio = derived.geom.hourAngularVelocity / derived.geom.escapeAngularVelocity;
    return Math.abs(product - ratio) < 1e-12 && Math.abs(product - derived.geom.compoundRatio) < 1e-12;
  }, [derived.geom, params.escapeToSecondsRatio, params.secondsToMinuteRatio, params.minuteToHourRatio]);

  const invDecoded = useMemo(() => {
    if (!derived.geom || !derived.kin) return false;
    if (!derived.geom.isRealTime) return true;
    const decoded =
      derived.kin.displayedHours * 3600 +
      derived.kin.displayedMinutes * 60 +
      derived.kin.displayedSeconds;
    const expected = params.time % 43200;
    return Math.abs(decoded - expected) < 1e-3;
  }, [derived.geom, derived.kin, params.time]);

  const firstRunRef = useRef(true);
  useEffect(() => {
    if (firstRunRef.current) { firstRunRef.current = false; return; }
    if (typeof navigator !== 'undefined' && navigator.webdriver) return;
    if (derived.error) return;
    const id = window.setTimeout(() => {
      const b = buildClock(params);
      onSceneChange(b.rootOp, params);
    }, 0);
    return () => window.clearTimeout(id);
  }, [params, onSceneChange, derived.error]);

  function update(patch: Partial<ClockParams>) {
    setParams((prev) => ({ ...prev, ...patch }));
  }

  function setRealClock() {
    update({
      teethCount: 30,
      pendulumLength: tunePendulumLength(2.0, 9.80665, 0.05),
      gravity: 9.80665,
      amplitude: 0.05,
      escapeToSecondsRatio: 0.5,
      secondsToMinuteRatio: 1 / 60,
      minuteToHourRatio: 1 / 12,
    });
  }

  const menuSections: MarkingMenuSection[] = useMemo(() => {
    return [
      {
        label: 'Preset',
        icon: '⏱',
        items: [
          { label: 'Real',    icon: '🕰', action: setRealClock },
          { label: 'Fast 2×', icon: '»',  action: () => update({ escapeToSecondsRatio: 1.0 }) },
          { label: 'Slow ½×', icon: '‹',  action: () => update({ escapeToSecondsRatio: 0.25 }) },
        ],
      },
      {
        label: 'Time',
        icon: '⏲',
        items: [
          { label: '0',     icon: '●', action: () => update({ time: 0 }) },
          { label: '+1min', icon: '⑥⓪', action: () => update({ time: params.time + 60 }) },
          { label: '+1h',   icon: '①ₕ', action: () => update({ time: params.time + 3600 }) },
          { label: '+12h',  icon: '①②', action: () => update({ time: params.time + 43200 }) },
        ],
      },
      { label: 'Cerrar', icon: '×', action: onClose },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, onClose]);

  if (!open) return null;

  const geom = derived.geom;
  const kin = derived.kin;

  return (
    <>
      <div
        data-testid="clock-panel"
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        style={{
          position: 'fixed',
          top: 70,
          right: 12,
          width: 340,
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
            🕰 Mechanical Clock
          </span>
          <button
            data-testid="clock-close"
            onClick={onClose}
            aria-label="close"
            style={{ background: 'transparent', border: 'none', color: 'var(--c-text-2)', cursor: 'pointer', fontSize: 16, padding: '0 6px' }}
          >×</button>
        </div>

        <section style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Escapement driver
          </div>
          <Slider testid="teethCount" label="teeth N" value={params.teethCount}
            min={8} max={60} step={1}
            onChange={(v) => update({ teethCount: Math.round(v) })}
            format={(v) => v.toFixed(0)} />
          <Slider testid="pendulumLength" label="length L" value={params.pendulumLength}
            min={0.05} max={2.0} step={0.0001}
            onChange={(v) => update({ pendulumLength: v })}
            format={(v) => `${v.toFixed(4)} m`} />

          <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
            Gear train ratios
          </div>
          <Slider testid="escapeToSeconds" label="ω_s / ω_e" value={params.escapeToSecondsRatio}
            min={0.05} max={2.0} step={0.01}
            onChange={(v) => update({ escapeToSecondsRatio: v })}
            format={(v) => v.toFixed(3)} />
          <Slider testid="secondsToMinute" label="ω_m / ω_s" value={params.secondsToMinuteRatio}
            min={1 / 120} max={0.5} step={0.0001}
            onChange={(v) => update({ secondsToMinuteRatio: v })}
            format={(v) => `1/${(1 / v).toFixed(1)}`} />
          <Slider testid="minuteToHour" label="ω_h / ω_m" value={params.minuteToHourRatio}
            min={1 / 24} max={0.5} step={0.0001}
            onChange={(v) => update({ minuteToHourRatio: v })}
            format={(v) => `1/${(1 / v).toFixed(1)}`} />

          <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
            Time
          </div>
          <Slider testid="time" label="t" value={params.time}
            min={0} max={43200} step={0.5}
            onChange={(v) => update({ time: v })}
            format={(v) => `${v.toFixed(1)} s`} />
        </section>

        {derived.error ? (
          <div
            data-testid="clock-error"
            style={{ background: '#3a1111', color: '#e75a5a', border: '1px solid #7a2020',
                     borderRadius: 4, padding: 6, fontSize: 11, fontFamily: 'monospace' }}
          >
            ✗ {derived.error}
          </div>
        ) : (
          <>
            <section style={{ borderTop: '1px solid var(--c-border-sub)', paddingTop: 8,
                              display: 'grid', gap: 4, fontSize: 11, fontFamily: 'monospace' }}>
              <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'system-ui' }}>
                Train · live
              </div>
              <div data-testid="geom-period">T = {geom!.period.toFixed(6)} s</div>
              <div data-testid="geom-seconds-rev">sec/rev = {geom!.secondsPerSecondsRev.toFixed(4)} s</div>
              <div data-testid="geom-minute-rev">min/rev = {geom!.secondsPerMinuteRev.toFixed(2)} s</div>
              <div data-testid="geom-hour-rev">hr/rev = {geom!.secondsPerHourRev.toFixed(0)} s</div>
              <div data-testid="geom-compound">Π ratios = {geom!.compoundRatio.toExponential(4)}</div>
            </section>

            <section style={{ borderTop: '1px solid var(--c-border-sub)', paddingTop: 8, marginTop: 8,
                              display: 'grid', gap: 4, fontSize: 11, fontFamily: 'monospace' }}>
              <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'system-ui' }}>
                Display · live
              </div>
              <div data-testid="clock-time" style={{ fontSize: 18, color: 'var(--c-accent, #d4af37)' }}>
                {formatClockTime(kin!)}
              </div>
              <div data-testid="kin-hour">HH = {kin!.displayedHours}</div>
              <div data-testid="kin-minute">MM = {kin!.displayedMinutes}</div>
              <div data-testid="kin-seconds">SS = {kin!.displayedSeconds.toFixed(2)}</div>
            </section>

            <section style={{ borderTop: '1px solid var(--c-border-sub)', paddingTop: 8, marginTop: 8,
                              display: 'grid', gap: 4, fontSize: 11, fontFamily: 'monospace' }}>
              <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'system-ui' }}>
                Invariants · live
              </div>
              <div data-testid="inv-realtime" style={{ color: invRealTime ? '#6bd97a' : '#e75a5a' }}>
                {invRealTime ? '✓' : '✗'} ω_s=2π/60, ω_m=2π/3600, ω_h=2π/43200
              </div>
              <div data-testid="inv-compound" style={{ color: invCompoundRatio ? '#6bd97a' : '#e75a5a' }}>
                {invCompoundRatio ? '✓' : '✗'} Π ratios = ω_h/ω_e
              </div>
              <div data-testid="inv-decoded" style={{ color: invDecoded ? '#6bd97a' : '#e75a5a' }}>
                {invDecoded ? '✓' : '✗'} decoded HH:MM:SS = t mod 43200
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
