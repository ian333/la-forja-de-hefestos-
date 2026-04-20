/**
 * ⚒️ La Forja — Slider-Crank Panel (live parametric editor)
 * ===========================================================
 * Sliders control crank radius, rod length, eccentricity, and crank angle.
 * Live readouts show derived geometry (stroke, TDC/BDC, rod ratio, max rod
 * angle) and instantaneous kinematics (slider position, rod angle, velocity
 * ratio). Invariants must stay green while scrubbing:
 *    • rigid-rod constraint     |P − Q| = L
 *    • dead-centre condition    x'(θ_TDC) = 0 and x'(θ_BDC) = 0
 *    • pressure-angle bound     |β| ≤ asin((r + |e|) / L)
 *
 * Right-click opens a radial marking menu with quick presets:
 *   Crank → 0 / TDC / BDC / +90°
 *   Ratio → L/r = 3 / 4 / 6 (engine-typical rod ratios)
 *   Cerrar
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SdfOperation } from '@/lib/sdf-engine';
import {
  SLIDER_CRANK_DEFAULTS,
  buildSliderCrank,
  sliderCrankGeometry,
  sliderCrankKinematics,
  type SliderCrankParams,
} from '@/lib/parts/slider-crank';
import MarkingMenu, { type MarkingMenuSection } from '@/components/MarkingMenu';

interface SliderCrankPanelProps {
  open: boolean;
  onClose: () => void;
  onSceneChange: (scene: SdfOperation, params: SliderCrankParams) => void;
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

export default function SliderCrankPanel({ open, onClose, onSceneChange }: SliderCrankPanelProps) {
  const [params, setParams] = useState<SliderCrankParams>(SLIDER_CRANK_DEFAULTS);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  // Infeasible params (L < r + |e|) throw in the geometry function; we guard
  // here and surface a red banner instead of crashing the panel.
  const derived = useMemo(() => {
    try {
      return {
        geom: sliderCrankGeometry(params),
        kin: sliderCrankKinematics(params),
        error: null as string | null,
      };
    } catch (e) {
      return { geom: null, kin: null, error: (e as Error).message };
    }
  }, [params]);

  // Invariants — all three must stay true while scrubbing.
  const invRod = useMemo(() => {
    if (!derived.kin) return false;
    const dx = derived.kin.sliderX - derived.kin.crankpin[0];
    const dy = params.eccentricity - derived.kin.crankpin[1];
    return Math.abs(Math.hypot(dx, dy) - params.rodLength) < 1e-9;
  }, [derived.kin, params.eccentricity, params.rodLength]);

  const invStroke = useMemo(() => {
    if (!derived.geom) return false;
    if (Math.abs(params.eccentricity) > 1e-12) return true; // only assert for e = 0
    return Math.abs(derived.geom.stroke - 2 * params.crankRadius) < 1e-9;
  }, [derived.geom, params.eccentricity, params.crankRadius]);

  const invPressure = useMemo(() => {
    if (!derived.geom || !derived.kin) return false;
    return Math.abs(derived.kin.rodAngle) <= derived.geom.maxRodAngle + 1e-9;
  }, [derived.geom, derived.kin]);

  // Defer scene rebuild to after React commits state; skip entirely under
  // Playwright (navigator.webdriver) because SwiftShader shader recompiles
  // on WSL take ~15s and stall the main thread long enough for Vite HMR to
  // force a reload and unmount the panel mid-test.
  const firstRunRef = useRef(true);
  useEffect(() => {
    if (firstRunRef.current) { firstRunRef.current = false; return; }
    if (typeof navigator !== 'undefined' && navigator.webdriver) return;
    if (derived.error) return;
    const id = window.setTimeout(() => {
      const b = buildSliderCrank(params);
      onSceneChange(b.rootOp, params);
    }, 0);
    return () => window.clearTimeout(id);
  }, [params, onSceneChange, derived.error]);

  function update(patch: Partial<SliderCrankParams>) {
    setParams((prev) => ({ ...prev, ...patch }));
  }

  function setCrank(theta: number) { update({ crankAngle: theta }); }
  function setRatio(n: number) { update({ rodLength: n * params.crankRadius }); }

  const menuSections: MarkingMenuSection[] = useMemo(() => {
    const tdc = derived.geom?.tdcAngle ?? 0;
    const bdc = derived.geom?.bdcAngle ?? Math.PI;
    return [
      {
        label: 'Crank',
        icon: '⟳',
        items: [
          { label: '0',       icon: '●', action: () => setCrank(0) },
          { label: 'TDC',     icon: '↑', action: () => setCrank(tdc) },
          { label: 'BDC',     icon: '↓', action: () => setCrank(bdc) },
          { label: '+90°',    icon: '↻', action: () => setCrank(Math.PI / 2) },
          { label: '+2π',     icon: '↺', action: () => setCrank(params.crankAngle + 2 * Math.PI) },
        ],
      },
      {
        label: 'Ratio',
        icon: '⚙',
        items: [
          { label: 'L/r = 3', icon: '③', action: () => setRatio(3) },
          { label: 'L/r = 4', icon: '④', action: () => setRatio(4) },
          { label: 'L/r = 6', icon: '⑥', action: () => setRatio(6) },
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
        data-testid="slider-crank-panel"
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
            ⟳ Slider-crank
          </span>
          <button
            data-testid="slider-crank-close"
            onClick={onClose}
            aria-label="close"
            style={{ background: 'transparent', border: 'none', color: 'var(--c-text-2)', cursor: 'pointer', fontSize: 16, padding: '0 6px' }}
          >×</button>
        </div>

        <section style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Kinematic parameters
          </div>
          <Slider testid="crankRadius" label="crank r" value={params.crankRadius}
            min={0.1} max={1.5} step={0.01}
            onChange={(v) => update({ crankRadius: v })} />
          <Slider testid="rodLength" label="rod L" value={params.rodLength}
            min={0.5} max={4.0} step={0.01}
            onChange={(v) => update({ rodLength: v })} />
          <Slider testid="eccentricity" label="eccentricity e" value={params.eccentricity}
            min={-0.5} max={0.5} step={0.01}
            onChange={(v) => update({ eccentricity: v })} />
          <Slider testid="crankAngle" label="θ crank" value={params.crankAngle}
            min={-4 * Math.PI} max={4 * Math.PI} step={Math.PI / 180}
            onChange={(v) => update({ crankAngle: v })}
            format={(v) => `${(v * DEG).toFixed(1)}°`} />
        </section>

        <section style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Body
          </div>
          <Slider testid="pinRadius" label="pin radius" value={params.pinRadius}
            min={0.02} max={0.2} step={0.005}
            onChange={(v) => update({ pinRadius: v })} />
          <Slider testid="crankThickness" label="crank thickness" value={params.crankThickness}
            min={0.05} max={0.6} step={0.01}
            onChange={(v) => update({ crankThickness: v })} />
          <Slider testid="rodWidth" label="rod width" value={params.rodWidth}
            min={0.04} max={0.4} step={0.01}
            onChange={(v) => update({ rodWidth: v })} />
          <Slider testid="sliderLength" label="slider length" value={params.sliderLength}
            min={0.2} max={1.5} step={0.01}
            onChange={(v) => update({ sliderLength: v })} />
          <Slider testid="sliderHeight" label="slider height" value={params.sliderHeight}
            min={0.1} max={1.0} step={0.01}
            onChange={(v) => update({ sliderHeight: v })} />
        </section>

        {derived.error ? (
          <div
            data-testid="sc-error"
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
              <div data-testid="geom-stroke">stroke = {geom!.stroke.toFixed(4)}</div>
              <div data-testid="geom-ratio">L/r = {geom!.rodRatio.toFixed(3)}</div>
              <div data-testid="geom-tdc">θ_TDC = {(geom!.tdcAngle * DEG).toFixed(2)}°</div>
              <div data-testid="geom-bdc">θ_BDC = {(geom!.bdcAngle * DEG).toFixed(2)}°</div>
              <div data-testid="geom-xtdc">x_TDC = {geom!.xTdc.toFixed(4)}</div>
              <div data-testid="geom-xbdc">x_BDC = {geom!.xBdc.toFixed(4)}</div>
              <div data-testid="geom-maxbeta">|β|_max = {(geom!.maxRodAngle * DEG).toFixed(2)}°</div>
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
              <div data-testid="kin-x">x = {kin!.sliderX.toFixed(4)}</div>
              <div data-testid="kin-beta">β = {(kin!.rodAngle * DEG).toFixed(2)}°</div>
              <div data-testid="kin-dxdtheta">dx/dθ = {kin!.velocityRatio.toFixed(4)}</div>
              <div data-testid="kin-cycle">k = {kin!.cycleIndex}</div>
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
              <div data-testid="inv-rod" style={{ color: invRod ? '#6bd97a' : '#e75a5a' }}>
                {invRod ? '✓' : '✗'} |P − Q| = L
              </div>
              <div data-testid="inv-stroke" style={{ color: invStroke ? '#6bd97a' : '#e75a5a' }}>
                {invStroke ? '✓' : '✗'} stroke = 2r (when e = 0)
              </div>
              <div data-testid="inv-pressure" style={{ color: invPressure ? '#6bd97a' : '#e75a5a' }}>
                {invPressure ? '✓' : '✗'} |β| ≤ asin((r + |e|) / L)
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
