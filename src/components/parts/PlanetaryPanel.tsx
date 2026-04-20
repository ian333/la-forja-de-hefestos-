/**
 * ⚒️ La Forja — Planetary Gear Panel (live parametric editor)
 * =============================================================
 * Sliders control tooth counts (sun / planet), planet count, module, and the
 * drive angle. A segmented control picks the fixed and input members. Live
 * readouts show derived geometry (ring teeth, carrier arm, speed ratio) and
 * instantaneous angles. Three invariants must stay green while scrubbing:
 *    • coaxial constraint  R = S + 2·P
 *    • Willis closure      S·θ_s + R·θ_r − (S+R)·θ_c = 0
 *    • assembly ok         (R+S) mod N = 0  AND  planets physically fit
 *
 * Right-click opens a radial marking menu:
 *   Mode   → ring-fixed / sun-fixed / carrier-fixed (classic three cases)
 *   Ratio  → preset tooth-count triples (S, P, N)
 *   Cerrar
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SdfOperation } from '@/lib/sdf-engine';
import {
  PLANETARY_DEFAULTS,
  buildPlanetary,
  planetaryGeometry,
  planetaryKinematics,
  planetaryWillisResidual,
  type PlanetaryParams,
  type PlanetaryMember,
} from '@/lib/parts/planetary';
import MarkingMenu, { type MarkingMenuSection } from '@/components/MarkingMenu';

interface PlanetaryPanelProps {
  open: boolean;
  onClose: () => void;
  onSceneChange: (scene: SdfOperation, params: PlanetaryParams) => void;
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

function MemberPicker({
  testidPrefix, value, disabled, onChange,
}: {
  testidPrefix: string;
  value: PlanetaryMember;
  disabled?: PlanetaryMember;
  onChange: (m: PlanetaryMember) => void;
}) {
  const members: PlanetaryMember[] = ['sun', 'ring', 'carrier'];
  return (
    <div style={{ display: 'grid', gridAutoFlow: 'column', gap: 4 }}>
      {members.map((m) => {
        const active = m === value;
        const isDisabled = m === disabled;
        return (
          <button
            key={m}
            data-testid={`${testidPrefix}-${m}`}
            disabled={isDisabled}
            onClick={() => onChange(m)}
            style={{
              padding: '4px 6px',
              fontSize: 11,
              border: '1px solid var(--c-border)',
              background: active ? 'var(--c-accent, #d4af37)' : 'transparent',
              color: active ? '#111' : isDisabled ? 'var(--c-text-3)' : 'var(--c-text-1)',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.35 : 1,
              borderRadius: 4,
              textTransform: 'capitalize',
              fontFamily: 'system-ui',
            }}
          >{m}</button>
        );
      })}
    </div>
  );
}

export default function PlanetaryPanel({ open, onClose, onSceneChange }: PlanetaryPanelProps) {
  const [params, setParams] = useState<PlanetaryParams>(PLANETARY_DEFAULTS);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const derived = useMemo(() => {
    try {
      return {
        geom: planetaryGeometry(params),
        kin: planetaryKinematics(params),
        error: null as string | null,
      };
    } catch (e) {
      return { geom: null, kin: null, error: (e as Error).message };
    }
  }, [params]);

  // Invariants.
  const invCoaxial = useMemo(() => {
    if (!derived.geom) return false;
    return derived.geom.ringTeeth === params.sunTeeth + 2 * params.planetTeeth;
  }, [derived.geom, params.sunTeeth, params.planetTeeth]);

  const invWillis = useMemo(() => {
    if (!derived.kin) return false;
    const res = planetaryWillisResidual(
      params.sunTeeth, params.planetTeeth,
      derived.kin.sunAngle, derived.kin.ringAngle, derived.kin.carrierAngle,
    );
    return Math.abs(res) < 1e-9;
  }, [derived.kin, params.sunTeeth, params.planetTeeth]);

  const invAssembly = useMemo(() => {
    if (!derived.geom) return false;
    return derived.geom.equalSpacingAssemblable && derived.geom.planetsFit;
  }, [derived.geom]);

  // Deferred scene rebuild, with webdriver bypass (Playwright + SwiftShader + WSL
  // recompile stalls main thread and Vite HMR force-reloads the page).
  const firstRunRef = useRef(true);
  useEffect(() => {
    if (firstRunRef.current) { firstRunRef.current = false; return; }
    if (typeof navigator !== 'undefined' && navigator.webdriver) return;
    if (derived.error) return;
    const id = window.setTimeout(() => {
      const b = buildPlanetary(params);
      onSceneChange(b.rootOp, params);
    }, 0);
    return () => window.clearTimeout(id);
  }, [params, onSceneChange, derived.error]);

  function update(patch: Partial<PlanetaryParams>) {
    setParams((prev) => ({ ...prev, ...patch }));
  }

  function setFixed(m: PlanetaryMember) {
    const input = params.inputMember === m
      ? (['sun', 'ring', 'carrier'] as PlanetaryMember[]).find((x) => x !== m)!
      : params.inputMember;
    update({ fixedMember: m, inputMember: input });
  }

  function setInput(m: PlanetaryMember) {
    if (m === params.fixedMember) return;
    update({ inputMember: m });
  }

  const menuSections: MarkingMenuSection[] = useMemo(() => {
    return [
      {
        label: 'Mode',
        icon: '⚙',
        items: [
          { label: 'Ring fixed',    icon: '◯', action: () => setFixed('ring') },
          { label: 'Sun fixed',     icon: '☀', action: () => setFixed('sun') },
          { label: 'Carrier fixed', icon: '⊙', action: () => setFixed('carrier') },
        ],
      },
      {
        label: 'Preset',
        icon: '①',
        items: [
          { label: '20 / 16 · 4', icon: '④', action: () => update({ sunTeeth: 20, planetTeeth: 16, planetCount: 4 }) },
          { label: '18 / 12 · 3', icon: '③', action: () => update({ sunTeeth: 18, planetTeeth: 12, planetCount: 3 }) },
          { label: '30 / 15 · 4', icon: '⑥', action: () => update({ sunTeeth: 30, planetTeeth: 15, planetCount: 4 }) },
        ],
      },
      {
        label: 'θ',
        icon: '⟳',
        items: [
          { label: '0',     icon: '●', action: () => update({ drive: 0 }) },
          { label: '+π/2',  icon: '↻', action: () => update({ drive: Math.PI / 2 }) },
          { label: '+2π',   icon: '↺', action: () => update({ drive: params.drive + 2 * Math.PI }) },
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
        data-testid="planetary-panel"
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
            ⊙ Planetary gear
          </span>
          <button
            data-testid="planetary-close"
            onClick={onClose}
            aria-label="close"
            style={{ background: 'transparent', border: 'none', color: 'var(--c-text-2)', cursor: 'pointer', fontSize: 16, padding: '0 6px' }}
          >×</button>
        </div>

        <section style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Tooth counts
          </div>
          <Slider testid="sunTeeth" label="sun S" value={params.sunTeeth}
            min={8} max={60} step={1}
            onChange={(v) => update({ sunTeeth: Math.round(v) })}
            format={(v) => v.toFixed(0)} />
          <Slider testid="planetTeeth" label="planet P" value={params.planetTeeth}
            min={4} max={40} step={1}
            onChange={(v) => update({ planetTeeth: Math.round(v) })}
            format={(v) => v.toFixed(0)} />
          <Slider testid="planetCount" label="planet N" value={params.planetCount}
            min={2} max={8} step={1}
            onChange={(v) => update({ planetCount: Math.round(v) })}
            format={(v) => v.toFixed(0)} />
          <Slider testid="module" label="module m" value={params.module}
            min={0.02} max={0.2} step={0.005}
            onChange={(v) => update({ module: v })} />
          <Slider testid="drive" label="θ input" value={params.drive}
            min={-4 * Math.PI} max={4 * Math.PI} step={Math.PI / 180}
            onChange={(v) => update({ drive: v })}
            format={(v) => `${(v * DEG).toFixed(1)}°`} />
        </section>

        <section style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Fixed member
          </div>
          <MemberPicker testidPrefix="fixed" value={params.fixedMember} onChange={setFixed} />
          <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
            Input member
          </div>
          <MemberPicker testidPrefix="input" value={params.inputMember} disabled={params.fixedMember} onChange={setInput} />
        </section>

        {derived.error ? (
          <div
            data-testid="pl-error"
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
                Geometry · live
              </div>
              <div data-testid="geom-ringteeth">R = {geom!.ringTeeth}</div>
              <div data-testid="geom-arm">arm = {geom!.carrierArmLength.toFixed(4)}</div>
              <div data-testid="geom-train">e = −S/R = {geom!.trainValue.toFixed(4)}</div>
              <div data-testid="geom-ratio">
                ω_{geom!.outputMember} / ω_{params.inputMember} = {geom!.speedRatio.toFixed(4)}
              </div>
              <div data-testid="geom-output">output = {geom!.outputMember}</div>
              <div data-testid="geom-assembly">
                (R+S) mod N = {(geom!.ringTeeth + params.sunTeeth) % params.planetCount}
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
                Angles · live
              </div>
              <div data-testid="kin-sun">θ_sun = {(kin!.sunAngle * DEG).toFixed(2)}°</div>
              <div data-testid="kin-ring">θ_ring = {(kin!.ringAngle * DEG).toFixed(2)}°</div>
              <div data-testid="kin-carrier">θ_carrier = {(kin!.carrierAngle * DEG).toFixed(2)}°</div>
              <div data-testid="kin-planet">θ_planet = {(kin!.planetAngle * DEG).toFixed(2)}°</div>
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
              <div data-testid="inv-coaxial" style={{ color: invCoaxial ? '#6bd97a' : '#e75a5a' }}>
                {invCoaxial ? '✓' : '✗'} R = S + 2·P
              </div>
              <div data-testid="inv-willis" style={{ color: invWillis ? '#6bd97a' : '#e75a5a' }}>
                {invWillis ? '✓' : '✗'} S·θ_s + R·θ_r = (S+R)·θ_c
              </div>
              <div data-testid="inv-assembly" style={{ color: invAssembly ? '#6bd97a' : '#e75a5a' }}>
                {invAssembly ? '✓' : '✗'} (R+S) mod N = 0 ∧ planets fit
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
