/**
 * Sistema Solar — N-body gravity sandbox with real SI units and live invariants.
 *
 * El usuario:
 *   1. Ve un sistema físico moverse (empieza con Sol+Tierra).
 *   2. Mira E total y L_z conservarse (o no, si rompe el preset).
 *   3. Cambia velocidades/masas y ve qué pasa (hipérbola, escape, captura).
 *   4. Cambia preset y aprende por comparación.
 *
 * No hay tutorial escrito. La única pedagogía es la simulación honesta.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AU, YEAR, DAY } from '@/lib/physics/constants';
import {
  advance, totalEnergy, totalKineticEnergy, totalPotentialEnergy,
  totalAngularMomentum, recenterCOM, computeAccelerations,
  type SimState, type Body,
} from '@/lib/physics/nbody';
import { PRESETS, type PresetId } from '@/lib/physics/presets';
import { stateToElements } from '@/lib/physics/kepler';
import SolarViewport from '@/physics/components/SolarViewport';
import { useAudience } from '@/physics/context';

function fmtSci(x: number, digits = 3): string {
  if (!isFinite(x)) return 'NaN';
  if (x === 0) return '0';
  return x.toExponential(digits);
}
function fmtDuration(seconds: number): string {
  const yrs = seconds / YEAR;
  if (Math.abs(yrs) >= 1) return `${yrs.toFixed(3)} años`;
  const days = seconds / DAY;
  if (Math.abs(days) >= 1) return `${days.toFixed(2)} días`;
  return `${seconds.toFixed(0)} s`;
}
function computeDisplayScale(state: SimState): number {
  // Frame so the outermost body lands at ~1.8 scene units from origin — inside
  // the default camera's view frustum (camera at distance ~4.7, half-height ~2.2).
  let maxR = 0;
  for (const b of state.bodies) {
    const r = Math.hypot(b.pos[0], b.pos[1], b.pos[2]);
    if (r > maxR) maxR = r;
  }
  if (maxR === 0) return 1 / AU;
  return 1.8 / maxR;
}
function visualRadius(b: Body, ds: number): number {
  // Real radii at AU scale → Sun = 3.5e-3, Earth = 1.5e-5 scene units (invisible).
  // We log-compress so Sun is a proper disc and planets are clearly pickable.
  const physRad = b.radius * ds;
  const isSun = b.id === 'sun' || b.color === '#FDB813';
  if (isSun) return Math.max(0.11, Math.min(0.16, Math.pow(physRad, 0.35) * 0.7));
  const boosted = Math.max(0.045, Math.pow(physRad, 0.3) * 0.5);
  return Math.min(boosted, 0.11);
}

export default function SolarSystem() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState<PresetId>('inner');
  const preset = PRESETS.find(p => p.id === presetId)!;

  const stateRef = useRef<SimState>(preset.factory());
  const [displayScale, setDisplayScale] = useState<number>(() => computeDisplayScale(stateRef.current));
  const [, force] = useState(0);

  const [running, setRunning]       = useState(true);
  const [timeScale, setTimeScale]   = useState(1);
  const [dt, setDt]                 = useState(preset.dtDefault);
  const [stepsPerFrame, setSteps]   = useState(60);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [trailLength, setTrail]     = useState(2000);

  useEffect(() => {
    stateRef.current = preset.factory();
    setDt(preset.dtDefault);
    setDisplayScale(computeDisplayScale(stateRef.current));
    setE0(null);
    setL0(null);
    force(x => x + 1);
  }, [presetId]);

  const [E0, setE0] = useState<number | null>(null);
  const [L0, setL0] = useState<[number, number, number] | null>(null);
  useEffect(() => {
    setE0(totalEnergy(stateRef.current));
    setL0(totalAngularMomentum(stateRef.current));
  }, [presetId]);

  useEffect(() => {
    let raf = 0;
    let lastMetricUpdate = 0;
    const tick = () => {
      if (running) {
        advance(stateRef.current, dt * timeScale, stepsPerFrame);
      }
      const now = performance.now();
      if (now - lastMetricUpdate > 100) {
        force(x => x + 1);
        lastMetricUpdate = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, dt, timeScale, stepsPerFrame]);

  const s = stateRef.current;
  const K = totalKineticEnergy(s);
  const U = totalPotentialEnergy(s);
  const E = K + U;
  const L = totalAngularMomentum(s);
  const dE = E0 != null ? Math.abs((E - E0) / E0) : 0;
  const dLz = L0 != null && L0[2] !== 0 ? Math.abs((L[2] - L0[2]) / L0[2]) : 0;

  const orbital = useMemo(() => {
    if (s.bodies.length < 2) return null;
    const central = s.bodies.find(b => b.id === 'sun') ?? s.bodies[0];
    const other   = s.bodies.find(b => b !== central);
    if (!other) return null;
    const rRel: [number,number,number] = [other.pos[0]-central.pos[0], other.pos[1]-central.pos[1], other.pos[2]-central.pos[2]];
    const vRel: [number,number,number] = [other.vel[0]-central.vel[0], other.vel[1]-central.vel[1], other.vel[2]-central.vel[2]];
    try { return { name: other.name, central: central.name, el: stateToElements(rRel, vRel, central.mass) }; }
    catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId, Math.floor(s.t / (preset.dtDefault * 10))]);

  const reset = useCallback(() => {
    stateRef.current = preset.factory();
    setDisplayScale(computeDisplayScale(stateRef.current));
    setE0(totalEnergy(stateRef.current));
    setL0(totalAngularMomentum(stateRef.current));
    force(x => x + 1);
  }, [preset]);

  const recenter = useCallback(() => {
    recenterCOM(stateRef.current);
    computeAccelerations(stateRef.current);
    setE0(totalEnergy(stateRef.current));
    setL0(totalAngularMomentum(stateRef.current));
    force(x => x + 1);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <SolarViewport
          stateRef={stateRef}
          displayScale={displayScale}
          trailLength={trailLength}
          showLabels={showLabels}
          showOrbits={showOrbits}
          visualRadius={visualRadius}
        />
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1]">
          <div><span className="text-[#64748B]">t sim&nbsp;&nbsp;</span>= {fmtDuration(s.t)}</div>
          <div><span className="text-[#64748B]">dt&nbsp;&nbsp;&nbsp;&nbsp;</span>= {fmtDuration(dt * timeScale)} / paso</div>
          <div><span className="text-[#64748B]">cuerpos&nbsp;</span>= {s.bodies.length}</div>
        </div>
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</IconBtn>
          <IconBtn onClick={reset} title="Reiniciar">↺</IconBtn>
          <IconBtn onClick={recenter} title="Recentrar COM">⊕</IconBtn>
          <span className="text-[10px] text-[#64748B] font-mono px-2 border-l border-[#1E293B] ml-1">
            velocidad&nbsp;
            <select value={timeScale} onChange={e => setTimeScale(Number(e.target.value))}
                    className="bg-[#05060A] border border-[#1E293B] rounded px-1 py-0.5 text-[#CBD5E1]">
              <option value={0.1}>0.1×</option>
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={5}>5×</option>
              <option value={10}>10×</option>
              <option value={50}>50×</option>
              <option value={200}>200×</option>
            </select>
          </span>
        </div>
      </div>

      <aside className="border-l border-[#1E293B] bg-[#0B0F17] overflow-y-auto">
        <Section title="Sistema">
          <div className="grid grid-cols-1 gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => setPresetId(p.id)}
                data-testid={`preset-${p.id}`}
                className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                  presetId === p.id
                    ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#4FC3F7]/40 text-white'
                    : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </Section>

        {audience === 'child' ? (
          <Section title="Lo que ves">
            <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
              <p>Cada cuerpo solo siente gravedad — se atraen todos entre todos.</p>
              <p>Lo increíble: las órbitas <span className="text-[#4FC3F7]">se repiten</span> porque la energía y el momento se conservan.</p>
              <p>Energía total ahora: <span className="font-mono text-white">{fmtSci(E, 2)} J</span>. Cambia de preset — ¿puedes hacer una órbita de escape?</p>
            </div>
          </Section>
        ) : (
          <Section title="Invariantes (conservación)">
            <Row label="E total"        value={`${fmtSci(E)} J`} />
            <Row label="E cinética"     value={`${fmtSci(K)} J`} />
            <Row label="E potencial"    value={`${fmtSci(U)} J`} />
            <Row label="L z"            value={`${fmtSci(L[2])} kg·m²/s`} />
            <div className="mt-3 pt-3 border-t border-[#1E293B]">
              <Row label="ΔE / E"   value={fmtSci(dE)}   highlight={dE > 1e-4} />
              <Row label="ΔL / L"   value={fmtSci(dLz)}  highlight={dLz > 1e-4} />
            </div>
            <div className="mt-2 text-[10px] text-[#64748B] leading-relaxed">
              El integrador es Verlet simpléctico — ΔE debe quedar ∼1e-13 por paso.
              Si crece, es porque el paso dt es demasiado grande para la escala física.
            </div>
          </Section>
        )}

        {orbital && audience === 'researcher' && (
          <Section title={`Órbita · ${orbital.name} alrededor de ${orbital.central}`}>
            <Row label="a"  value={`${(orbital.el.a / AU).toFixed(6)} AU`} />
            <Row label="e"  value={orbital.el.e.toFixed(6)} />
            <Row label="i"  value={`${(orbital.el.i * 180 / Math.PI).toFixed(3)}°`} />
            <Row label="T"  value={fmtDuration(orbital.el.period)} />
            <Row label="ε"  value={`${fmtSci(orbital.el.energy)} m²/s²`} />
            <Row label="|h|" value={`${fmtSci(orbital.el.h)} m²/s`} />
            <div className="mt-2 text-[10px] text-[#64748B] leading-relaxed">
              Extraído de r,v en la frame del cuerpo central. Kepler exacto (2 cuerpos).
              Cuando hay 3+ cuerpos son elementos osculadores — oscilan.
            </div>
          </Section>
        )}

        {audience === 'researcher' && (
          <Section title="Integrador">
            <label className="block text-[11px] text-[#94A3B8] mt-1">
              dt por paso — <span className="font-mono text-white">{fmtDuration(dt)}</span>
            </label>
            <input
              type="range"
              min={Math.log10(60)}
              max={Math.log10(DAY * 365)}
              step={0.01}
              value={Math.log10(dt)}
              onChange={e => setDt(Math.pow(10, Number(e.target.value)))}
              className="w-full mt-1"
            />
            <label className="block text-[11px] text-[#94A3B8] mt-3">
              Pasos por frame — <span className="font-mono text-white">{stepsPerFrame}</span>
            </label>
            <input
              type="range" min={1} max={500} step={1}
              value={stepsPerFrame}
              onChange={e => setSteps(Number(e.target.value))}
              className="w-full mt-1"
            />
          </Section>
        )}

        <Section title="Visualización">
          <Toggle value={showOrbits} onChange={setShowOrbits} label="Estelas orbitales" />
          <Toggle value={showLabels} onChange={setShowLabels} label="Nombres de cuerpos" />
          <label className="block text-[11px] text-[#94A3B8] mt-3">
            Puntos de estela — <span className="font-mono text-white">{trailLength}</span>
          </label>
          <input
            type="range" min={100} max={10000} step={100}
            value={trailLength}
            onChange={e => setTrail(Number(e.target.value))}
            className="w-full mt-1"
          />
          <label className="block text-[11px] text-[#94A3B8] mt-3">
            Escala de renderizado (cámara)
          </label>
          <input
            type="range"
            min={Math.log10(displayScale * 0.1)}
            max={Math.log10(displayScale * 10)}
            step={0.01}
            value={Math.log10(displayScale)}
            onChange={e => setDisplayScale(Math.pow(10, Number(e.target.value)))}
            className="w-full mt-1"
          />
        </Section>

        <Section title="Cuerpos">
          <div className="space-y-1">
            {s.bodies.map(b => (
              <div key={b.id} className="flex items-center gap-2 text-[11px] font-mono">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: b.color }} />
                <span className="text-white flex-shrink-0 w-[80px] truncate">{b.name}</span>
                <span className="text-[#64748B]">m=</span><span className="text-[#CBD5E1]">{fmtSci(b.mass, 2)}</span>
                <span className="text-[#64748B] ml-auto">|v|=</span>
                <span className="text-[#CBD5E1]">{fmtSci(Math.hypot(b.vel[0], b.vel[1], b.vel[2]), 2)}</span>
              </div>
            ))}
          </div>
        </Section>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}
function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className={highlight ? 'text-[#F87171]' : 'text-white'}>{value}</span>
    </div>
  );
}
function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 py-1 cursor-pointer text-[12px] text-[#CBD5E1]">
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} className="accent-[#4FC3F7]" />
      {label}
    </label>
  );
}
function IconBtn({ children, onClick, active, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-9 h-9 rounded-md border text-[14px] transition flex items-center justify-center ${
        active
          ? 'border-[#4FC3F7]/60 text-[#4FC3F7] bg-[#4FC3F7]/10'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
