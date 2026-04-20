import { useMemo, useState } from 'react';
import ParticleSandbox, { TYPE_PRESETS } from './ParticleSandbox';
import type { ReactionRule } from '@/lib/chem/quantum/md';

const PANEL_CLS = 'rounded-xl border border-[#1E293B] bg-[#0B0F17]/70 backdrop-blur-md';
const PANEL_HEAD = 'text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B]';

export default function SandboxTab() {
  const [nA, setNA] = useState(200);
  const [nB, setNB] = useState(200);
  const [boxSize, setBoxSize] = useState(20);
  const [targetT, setTargetT] = useState(1.2);
  const [reactionsOn, setReactionsOn] = useState(false);
  const [playing, setPlaying] = useState(true);

  const [stats, setStats] = useState<{ T: number; counts: Record<string, number>; step: number; time: number }>({
    T: targetT, counts: { A: nA, B: nB, C: 0, D: 0 }, step: 0, time: 0,
  });

  const initialCounts = useMemo(() => {
    return new Map([
      [TYPE_PRESETS.A, nA],
      [TYPE_PRESETS.B, nB],
      [TYPE_PRESETS.C, 0],
      [TYPE_PRESETS.D, 0],
    ]);
  }, [nA, nB]);

  const reactionRules: ReactionRule[] | undefined = useMemo(() => {
    if (!reactionsOn) return undefined;
    return [{
      reactantA: 0, reactantB: 1,
      productA: 2, productB: 3,
      rCollision: 1.3, Ea: 0.5, probability: 0.25,
    }];
  }, [reactionsOn]);

  return (
    <div className="grid grid-cols-12 gap-6">
      <section className="col-span-12 lg:col-span-8 space-y-4">
        <ParticleSandbox
          initialCounts={initialCounts}
          boxSize={boxSize}
          targetT={targetT}
          reactionRules={reactionRules}
          playing={playing}
          onStats={setStats}
          height={560}
        />

        <div className={`${PANEL_CLS} p-5`}>
          <div className={PANEL_HEAD}>Qué estás viendo</div>
          <p className="mt-2 text-[14px] leading-relaxed text-[#CBD5E1]">
            Cientos de moléculas en una caja periódica. La simulación computa
            <strong className="text-white"> F = m·a</strong> entre cada par de partículas con potencial
            Lennard-Jones + integrador Verlet. La temperatura del termostato es
            LITERALMENTE la velocidad cuadrática media. Sube T y verás las
            partículas frenéticas; baja T y verás clusters (fase condensada).
          </p>
          <p className="mt-2 text-[13px] text-[#64748B]">
            Ref: Allen & Tildesley, <em>Computer Simulation of Liquids</em>, 2ª ed.
            (2017) · Verlet, <em>Phys. Rev.</em> 159 (1967) · Berendsen et al.,
            <em> J. Chem. Phys.</em> 81 (1984).
          </p>
        </div>
      </section>

      <aside className="col-span-12 lg:col-span-4 space-y-4">
        <div className={`${PANEL_CLS} p-4 space-y-3`}>
          <div className="flex items-center gap-3">
            {playing ? (
              <button onClick={() => setPlaying(false)} className="flex-1 px-4 py-2 rounded-md bg-[#7E57C2] text-white text-[13px] font-semibold">
                ⏸ Pausa
              </button>
            ) : (
              <button onClick={() => setPlaying(true)} className="flex-1 px-4 py-2 rounded-md bg-[#4FC3F7] text-[#0B0F17] text-[13px] font-semibold">
                ▶ Correr
              </button>
            )}
          </div>
        </div>

        <div className={`${PANEL_CLS} p-4 space-y-4`}>
          <SandboxSlider label="N partículas A" value={nA} min={0} max={600} step={10} onChange={setNA} color="#60A5FA" />
          <SandboxSlider label="N partículas B" value={nB} min={0} max={600} step={10} onChange={setNB} color="#FBBF24" />
          <SandboxSlider label="Tamaño de caja" value={boxSize} min={10} max={40} step={1} onChange={setBoxSize} color="#94A3B8" suffix="σ" />
          <SandboxSlider label="Temperatura target" value={targetT} min={0.1} max={5} step={0.1} onChange={setTargetT} color="#F87171" suffix="ε/k" />
        </div>

        <div className={`${PANEL_CLS} p-4`}>
          <div className="flex items-center justify-between">
            <span className={PANEL_HEAD}>Reacciones A+B → C+D</span>
            <button
              onClick={() => setReactionsOn((v) => !v)}
              className={`w-9 h-5 rounded-full transition relative ${reactionsOn ? 'bg-[#4FC3F7]' : 'bg-[#334155]'}`}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: reactionsOn ? '18px' : '2px' }}
              />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[#94A3B8] leading-snug">
            Si se activa, cuando una A y una B chocan con suficiente energía
            relativa (barrera E<sub>a</sub>), se convierten en C+D.
            La reacción ocurre porque la física lo permite, no porque se
            "cambie un número".
          </p>
        </div>

        <div className={`${PANEL_CLS} p-4`}>
          <div className={PANEL_HEAD}>Estado instantáneo</div>
          <dl className="mt-3 space-y-1.5 text-[12px] font-mono">
            <StatRow label="T medida" value={`${stats.T.toFixed(3)} ε/k`} />
            <StatRow label="t simulado" value={`${stats.time.toFixed(2)} τ`} />
            <StatRow label="step" value={`${stats.step}`} />
            <StatRow label="partículas" value={`${Object.values(stats.counts).reduce((a, b) => a + b, 0)}`} />
          </dl>
          {reactionsOn && (
            <>
              <div className="mt-3 h-px bg-[#1E293B]" />
              <div className="mt-3 grid grid-cols-4 gap-1.5 text-[11px] font-mono">
                <SpeciesBadge name="A" count={stats.counts.A ?? 0} color="#60A5FA" />
                <SpeciesBadge name="B" count={stats.counts.B ?? 0} color="#FBBF24" />
                <SpeciesBadge name="C" count={stats.counts.C ?? 0} color="#34D399" />
                <SpeciesBadge name="D" count={stats.counts.D ?? 0} color="#F87171" />
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function SandboxSlider({
  label, value, min, max, step, onChange, color, suffix,
}: {
  label: string;
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
  color: string;
  suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className={PANEL_HEAD}>{label}</span>
        <span className="font-mono text-[13px] font-semibold text-white">
          {Number.isInteger(value) ? value : value.toFixed(1)}
          {suffix && <span className="text-[10px] text-[#64748B] ml-1">{suffix}</span>}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-1.5"
        style={{ accentColor: color }}
      />
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[#64748B]">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function SpeciesBadge({ name, count, color }: { name: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-1 rounded-md bg-[#0B0F17] border border-[#1E293B] px-1.5 py-1">
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="text-[#94A3B8]">{name}</span>
      <span className="ml-auto text-white font-semibold">{count}</span>
    </div>
  );
}
