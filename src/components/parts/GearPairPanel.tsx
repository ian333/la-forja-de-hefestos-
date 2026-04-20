/**
 * ⚒️ La Forja — Gear Pair Panel (live parametric editor)
 * ========================================================
 * Floating right-side panel with sliders for the gear-pair parameters.
 * Each change rebuilds the scene and invokes `onSceneChange` with the
 * new SdfOperation — like editing the sketch in Fusion and watching the
 * body regenerate.
 *
 * Shows live invariant results (ratio, center distance, contact ratio),
 * a mechanics readout (F_t, σ_bending, SF, mass), and a lightening-hole
 * optimizer. Right-click the panel to open a marking menu with the same
 * tools as quick shortcuts.
 */

import { useMemo, useState } from 'react';
import type { SdfOperation } from '@/lib/sdf-engine';
import {
  GEAR_PAIR_DEFAULTS,
  buildGearPair,
  contactRatio,
  type GearPairParams,
} from '@/lib/parts/gear-pair';
import {
  analyzeGearLoad,
  analyzeGearMass,
  optimizeLightening,
  DEFAULT_LIGHTENING,
} from '@/lib/parts/gear-mechanics';
import MarkingMenu, { type MarkingMenuSection } from '@/components/MarkingMenu';

interface GearPairPanelProps {
  open: boolean;
  onClose: () => void;
  onSceneChange: (scene: SdfOperation, params: GearPairParams) => void;
}

const DEG = 180 / Math.PI;

const MATERIAL_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'acero_1020', label: 'Acero 1020' },
  { key: 'acero_1045', label: 'Acero 1045' },
  { key: 'acero_4340', label: 'Acero 4340' },
  { key: 'aluminio_6061', label: 'Al 6061' },
  { key: 'titanio_ti6al4v', label: 'Ti-6Al-4V' },
];

function Slider({
  testid,
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
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
  const displayVal = format ? format(value) : value.toFixed(3);
  return (
    <label style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 2, fontSize: 11 }}>
      <span style={{ color: 'var(--c-text-2)' }}>{label}</span>
      <span
        data-testid={`${testid}-value`}
        style={{ color: 'var(--c-accent, #d4af37)', fontFamily: 'monospace' }}
      >
        {displayVal}
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

export default function GearPairPanel({ open, onClose, onSceneChange }: GearPairPanelProps) {
  const [params, setParams] = useState<GearPairParams>(GEAR_PAIR_DEFAULTS);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const build = useMemo(() => buildGearPair(params), [params]);
  const cr = useMemo(() => contactRatio(params), [params]);

  // Invariant checks live
  const ratioOk = Math.abs(build.geometry.gearRatio - params.teeth1 / params.teeth2) < 1e-12;
  const centerDistanceOk =
    Math.abs(
      build.geometry.centerDistance -
        (params.module * (params.teeth1 + params.teeth2)) / 2,
    ) < 1e-9;
  const contactRatioOk = cr > 1 && cr < 2.5;

  // Mechanics — analyze the weaker gear (the one with fewer teeth).
  const weakerZ = Math.min(params.teeth1, params.teeth2);
  const torqueNmm = params.torque ?? GEAR_PAIR_DEFAULTS.torque!;
  const materialKey = params.materialKey ?? GEAR_PAIR_DEFAULTS.materialKey!;
  // Convert sketch-unit thickness to mm (assume 1 sketch unit = 1 mm * module/1).
  // Here we treat `thickness` as mm directly (consistent with module in mm).
  const mechParams = {
    module: params.module,
    teethCount: weakerZ,
    thickness: Math.max(0.1, params.thickness * 10), // thickness slider is in "units" so x10 gives a plausible mm b
    pressureAngle: params.pressureAngle,
    torque: torqueNmm,
    materialKey,
    boreDiameter: params.boreFraction * params.module * weakerZ, // mm
    dedendumCoef: params.dedendumCoef,
  };
  const load = useMemo(() => {
    try { return analyzeGearLoad(mechParams); } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mechParams.module, mechParams.teethCount, mechParams.thickness,
    mechParams.pressureAngle, mechParams.torque, mechParams.materialKey,
  ]);

  const mass = useMemo(() => {
    try {
      return analyzeGearMass({
        module: mechParams.module,
        teethCount: mechParams.teethCount,
        thickness: mechParams.thickness,
        boreDiameter: mechParams.boreDiameter,
        materialKey: mechParams.materialKey,
        lighteningHoles: params.lighteningHoles ?? 0,
        lighteningHoleRadius: params.lighteningHoleRadius ?? 0,
      });
    } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mechParams.module, mechParams.teethCount, mechParams.thickness,
    mechParams.boreDiameter, mechParams.materialKey,
    params.lighteningHoles, params.lighteningHoleRadius,
  ]);

  const sfMin = 1.5;
  const sfOk = load ? load.safetyFactor >= sfMin : false;

  function update(patch: Partial<GearPairParams>) {
    const next = { ...params, ...patch };
    setParams(next);
    const newBuild = buildGearPair(next);
    onSceneChange(newBuild.rootOp, next);
  }

  function runOptimizer() {
    try {
      const opt = optimizeLightening(mechParams, DEFAULT_LIGHTENING);
      update({
        lighteningHoles: opt.holes,
        lighteningHoleRadius: opt.holeRadius,
      });
    } catch {
      /* ignore */
    }
  }

  function resetFillet() { update({ filletRadius: 0 }); }
  function quickFillet(coef: number) { update({ filletRadius: coef * params.module }); }
  function resetLightening() { update({ lighteningHoles: 0, lighteningHoleRadius: 0 }); }

  const menuSections: MarkingMenuSection[] = useMemo(() => [
    {
      label: 'Chaflán',
      icon: '⌒',
      items: [
        { label: 'Tip 0.1·m', icon: '•', action: () => quickFillet(0.1) },
        { label: 'Tip 0.2·m', icon: '●', action: () => quickFillet(0.2) },
        { label: 'Tip 0.3·m', icon: '⬤', action: () => quickFillet(0.3) },
        { label: 'Reset',      icon: '∅', action: resetFillet },
      ],
    },
    {
      label: 'Peso',
      icon: '⚖',
      items: [
        { label: 'Optimizar', icon: '⚙', action: runOptimizer },
        { label: 'Reset',     icon: '∅', action: resetLightening },
      ],
    },
    {
      label: 'Material',
      icon: '◧',
      items: MATERIAL_OPTIONS.map((m) => ({
        label: m.label, icon: '◎', action: () => update({ materialKey: m.key }),
      })),
    },
    {
      label: 'Invariantes',
      icon: 'Σ',
      action: () => { /* no-op, placeholder for a future invariants panel */ },
    },
    {
      label: 'Cerrar',
      icon: '×',
      action: onClose,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [params, onClose]);

  if (!open) return null;

  return (
    <>
    <div
      data-testid="gear-pair-panel"
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
          ⚙ Gear Pair
        </span>
        <button
          data-testid="gear-pair-close"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--c-text-2)',
            cursor: 'pointer',
            fontSize: 16,
            padding: '0 6px',
          }}
          aria-label="close"
        >
          ×
        </button>
      </div>

      <section style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
          Tooth counts
        </div>
        <Slider testid="teeth1" label="Z₁ (driver)" value={params.teeth1} min={6} max={120} step={1}
          onChange={(v) => update({ teeth1: Math.round(v) })} format={(v) => v.toFixed(0)} />
        <Slider testid="teeth2" label="Z₂ (driven)" value={params.teeth2} min={6} max={200} step={1}
          onChange={(v) => update({ teeth2: Math.round(v) })} format={(v) => v.toFixed(0)} />
      </section>

      <section style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
          Tooth profile
        </div>
        <Slider testid="module" label="module m" value={params.module} min={0.25} max={5} step={0.05}
          onChange={(v) => update({ module: v })} />
        <Slider testid="pressureAngle" label="pressure angle α" value={params.pressureAngle}
          min={(14 * Math.PI) / 180} max={(30 * Math.PI) / 180} step={Math.PI / 180}
          onChange={(v) => update({ pressureAngle: v })} format={(v) => `${(v * DEG).toFixed(1)}°`} />
        <Slider testid="addendumCoef" label="addendum ka" value={params.addendumCoef}
          min={0.5} max={1.5} step={0.05} onChange={(v) => update({ addendumCoef: v })} />
        <Slider testid="dedendumCoef" label="dedendum kd" value={params.dedendumCoef}
          min={1.0} max={1.75} step={0.05} onChange={(v) => update({ dedendumCoef: v })} />
        <Slider testid="filletRadius" label="fillet r" value={params.filletRadius ?? 0}
          min={0} max={0.4} step={0.01} onChange={(v) => update({ filletRadius: v })}
          format={(v) => v.toFixed(3)} />
      </section>

      <section style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
          Body
        </div>
        <Slider testid="thickness" label="thickness" value={params.thickness} min={0.1} max={3} step={0.05}
          onChange={(v) => update({ thickness: v })} />
        <Slider testid="boreFraction" label="bore fraction" value={params.boreFraction} min={0} max={0.6} step={0.02}
          onChange={(v) => update({ boreFraction: v })} />
        <Slider testid="drive" label="θ₁ driver" value={params.drive}
          min={-Math.PI} max={Math.PI} step={Math.PI / 180}
          onChange={(v) => update({ drive: v })} format={(v) => `${(v * DEG).toFixed(1)}°`} />
      </section>

      <section style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
          Fuerzas · mecánica
        </div>
        <Slider testid="torque" label="torque T (N·m)" value={torqueNmm / 1000}
          min={1} max={100} step={1}
          onChange={(v) => update({ torque: v * 1000 })} format={(v) => v.toFixed(0)} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {MATERIAL_OPTIONS.map((m) => (
            <button
              key={m.key}
              data-testid={`material-${m.key}`}
              onClick={() => update({ materialKey: m.key })}
              style={{
                flex: '1 1 auto',
                fontSize: 10,
                padding: '4px 6px',
                background: materialKey === m.key ? 'var(--c-accent, #d4af37)' : 'transparent',
                color: materialKey === m.key ? '#000' : 'var(--c-text-2)',
                border: '1px solid var(--c-border)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
          Lightening (web holes)
        </div>
        <Slider testid="lighteningHoles" label="N holes" value={params.lighteningHoles ?? 0}
          min={0} max={12} step={1}
          onChange={(v) => update({ lighteningHoles: Math.round(v) })}
          format={(v) => v.toFixed(0)} />
        <Slider testid="lighteningHoleRadius" label="hole r (mm)" value={params.lighteningHoleRadius ?? 0}
          min={0} max={5} step={0.25} onChange={(v) => update({ lighteningHoleRadius: v })}
          format={(v) => v.toFixed(2)} />
        <button
          data-testid="optimize-weight"
          onClick={runOptimizer}
          style={{
            fontSize: 11,
            padding: '6px 8px',
            background: 'var(--c-accent, #d4af37)',
            color: '#000',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Optimizar peso (SF ≥ {sfMin})
        </button>
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
          Invariants · live
        </div>
        <div data-testid="inv-ratio" style={{ color: ratioOk ? '#6bd97a' : '#e75a5a' }}>
          {ratioOk ? '✓' : '✗'} ratio = {build.geometry.gearRatio.toFixed(5)}
        </div>
        <div data-testid="inv-center" style={{ color: centerDistanceOk ? '#6bd97a' : '#e75a5a' }}>
          {centerDistanceOk ? '✓' : '✗'} C = {build.geometry.centerDistance.toFixed(4)}
        </div>
        <div data-testid="inv-contact" style={{ color: contactRatioOk ? '#6bd97a' : '#e75a5a' }}>
          {contactRatioOk ? '✓' : '✗'} ε (contact) = {cr.toFixed(3)}
        </div>
        <div data-testid="inv-theta2" style={{ color: 'var(--c-text-2)' }}>
          θ₂ driven = {(build.geometry.angle2 * DEG).toFixed(1)}°
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
          Mechanics · live
        </div>
        {load ? (
          <>
            <div data-testid="mech-ft">F_t = {load.tangentialForce.toFixed(1)} N</div>
            <div data-testid="mech-sigma">σ = {load.bendingStress.toFixed(1)} MPa</div>
            <div data-testid="mech-sf" style={{ color: sfOk ? '#6bd97a' : '#e75a5a' }}>
              {sfOk ? '✓' : '✗'} SF = {load.safetyFactor.toFixed(2)} (≥ {sfMin})
            </div>
            <div data-testid="mech-sigmay" style={{ color: 'var(--c-text-2)' }}>
              σ_y = {load.yieldStrength.toFixed(0)} MPa ({load.material.name})
            </div>
          </>
        ) : (
          <div data-testid="mech-error" style={{ color: '#e75a5a' }}>mecánica n/a</div>
        )}
        {mass && (
          <>
            <div data-testid="mech-mass">m = {mass.netMass.toFixed(3)} kg</div>
            <div data-testid="mech-savings">
              ahorro = {(mass.savingsFraction * 100).toFixed(1)}%
            </div>
          </>
        )}
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
