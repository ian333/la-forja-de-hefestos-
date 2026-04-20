import { useEffect, useMemo, useRef, useState } from 'react';
import { PRESETS, getPreset } from '@/lib/chem/reactions';
import { simulate, type Trajectory } from '@/lib/chem/kinetics';
import { getMolecule } from '@/lib/chem/molecule';

import MoleculeView, { type SpeciesDisplay } from './MoleculeView';
import ConcentrationChart from './ConcentrationChart';
import ReactionSelector from './ReactionSelector';
import FormulaPanel from './FormulaPanel';
import ConcentrationSliders from './ConcentrationSliders';

const SPECIES_COLORS: Record<string, string> = {
  H2: '#60A5FA', O2: '#F87171', N2: '#818CF8', H2O: '#34D399',
  H2O2: '#C084FC', NH3: '#FBBF24', HCl: '#A3E635', NaOH: '#F472B6',
  NaCl: '#A5B4FC', NO2: '#FB923C', N2O5: '#2DD4BF', CO2: '#94A3B8',
  CH4: '#E879F9',
};

const PANEL_CLS = 'rounded-xl border border-[#1E293B] bg-[#0B0F17]/70 backdrop-blur-md';
const PANEL_HEAD = 'text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B]';

export default function ReactionTab() {
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const preset = useMemo(() => getPreset(presetId)!, [presetId]);
  const [T, setT] = useState(preset.T);
  const [initialC, setInitialC] = useState<Record<string, number>>({ ...preset.initial });
  const [traj, setTraj] = useState<Trajectory | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setT(preset.T);
    setInitialC({ ...preset.initial });
    setTraj(null);
    setProgress(0);
    setPlaying(false);
  }, [presetId]);

  useEffect(() => {
    const id = setTimeout(() => {
      const duration = preset.duration;
      const dt = preset.dt;
      const N = Math.max(50, Math.min(4000, Math.round(duration / dt)));
      try {
        const t = simulate(preset.steps, T, initialC, duration / N, N);
        setTraj(t);
        setProgress(0);
        setTimeout(() => setPlaying(true), 50);
      } catch (e) { console.error(e); }
    }, 150);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [T, JSON.stringify(initialC), presetId]);

  useEffect(() => {
    if (!playing || !traj) return;
    let last = performance.now();
    const anim = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setProgress((p) => {
        const next = p + dt / (traj.t[traj.t.length - 1] / 5);
        if (next >= 1) { setPlaying(false); return 1; }
        return next;
      });
      rafRef.current = requestAnimationFrame(anim);
    };
    rafRef.current = requestAnimationFrame(anim);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, traj]);

  const currentIdx = traj ? Math.min(traj.t.length - 1, Math.floor(progress * (traj.t.length - 1))) : 0;
  const currentT = traj ? traj.t[currentIdx] : 0;
  const finalT = traj ? traj.t[traj.t.length - 1] : preset.duration;

  const currentC = useMemo(() => {
    if (!traj) return initialC;
    const c: Record<string, number> = {};
    for (const sp of traj.species) c[sp] = traj.C[sp][currentIdx];
    return c;
  }, [traj, currentIdx, initialC]);

  const displaySpecies = useMemo<SpeciesDisplay[]>(() => {
    const source = traj ? traj.species : Object.keys(initialC);
    const maxC: Record<string, number> = {};
    for (const sp of source) {
      maxC[sp] = traj ? Math.max(...traj.C[sp], 0.01) : Math.max(initialC[sp] ?? 0, 0.01);
    }
    return source.map((sp): SpeciesDisplay | null => {
      const mol = getMolecule(sp);
      if (!mol) return null;
      const isR = preset.steps[0].reactants.some((r) => r.species === sp);
      const isP = preset.steps[0].products.some((p) => p.species === sp);
      return {
        formula: sp, molecule: mol,
        concentration: currentC[sp] ?? 0,
        concentrationMax: maxC[sp],
        role: isR ? 'reactant' : isP ? 'product' : 'intermediate',
      };
    }).filter((s): s is SpeciesDisplay => s !== null);
  }, [traj, currentC, initialC, preset]);

  const exportCSV = () => {
    if (!traj) return;
    const lines = [['t_s', ...traj.species].join(',')];
    for (let i = 0; i < traj.t.length; i++) {
      lines.push([traj.t[i].toFixed(4), ...traj.species.map((s) => traj.C[s][i].toExponential(5))].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `gaia-${presetId}-${T}K.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      <section className="col-span-12 lg:col-span-8 space-y-4">
        <div className={`${PANEL_CLS} p-4 flex items-center gap-4 flex-wrap`}>
          <div className="text-[#94A3B8] text-[12px] font-semibold">Sistema:</div>
          <ReactionSelector presets={PRESETS} selected={presetId} onChange={setPresetId} />
          <div className="ml-auto flex items-center gap-2 font-mono text-[11px] text-[#64748B]">
            t = {currentT.toFixed(currentT < 1 ? 3 : 1)} / {finalT.toFixed(finalT < 1 ? 2 : 0)} s
          </div>
        </div>
        <div className="bg-black/30 rounded-xl overflow-hidden border border-[#1E293B]">
          <MoleculeView species={displaySpecies} height={380} />
        </div>
        <div className="bg-black/30 rounded-xl overflow-hidden border border-[#1E293B]">
          <ConcentrationChart
            t={traj?.t ?? []}
            C={traj?.C ?? {}}
            colors={SPECIES_COLORS}
            currentT={currentT}
            height={240}
          />
        </div>
      </section>

      <aside className="col-span-12 lg:col-span-4 space-y-4">
        <div className={`${PANEL_CLS} p-4`}>
          <div className="flex items-baseline justify-between">
            <span className={PANEL_HEAD}>Temperatura</span>
            <span className="font-mono text-[16px] font-semibold text-white">
              {T.toFixed(0)} <span className="text-[11px] text-[#64748B]">K</span>
              <span className="text-[#334155] mx-1">·</span>
              <span className="text-[12px] text-[#64748B]">{(T - 273.15).toFixed(0)} °C</span>
            </span>
          </div>
          <input
            type="range"
            min={preset.Trange[0]}
            max={preset.Trange[1]}
            value={T}
            onChange={(e) => setT(Number(e.target.value))}
            className="w-full mt-3 accent-[#F87171]"
          />
          <div className="flex justify-between text-[10px] font-mono text-[#64748B] mt-1">
            <span>{preset.Trange[0]} K</span><span>{preset.Trange[1]} K</span>
          </div>
        </div>

        <div className={`${PANEL_CLS} p-4 space-y-3`}>
          <div className="flex items-center gap-3">
            {playing ? (
              <button onClick={() => setPlaying(false)} className="flex-1 px-4 py-2 rounded-md bg-[#7E57C2] hover:bg-[#9575CD] text-white text-[13px] font-semibold transition">
                ⏸ Pausa
              </button>
            ) : (
              <button onClick={() => { if (progress >= 1) setProgress(0); setPlaying(true); }} className="flex-1 px-4 py-2 rounded-md bg-[#4FC3F7] hover:bg-[#29B6F6] text-[#0B0F17] text-[13px] font-semibold transition">
                ▶ Simular
              </button>
            )}
            <button onClick={() => { setProgress(0); setPlaying(false); }} className="px-3 py-2 rounded-md bg-[#1E293B] hover:bg-[#334155] text-[#CBD5E1] text-[13px] transition">
              ↻
            </button>
          </div>
          <div className="h-1 rounded-full bg-[#1E293B] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#4FC3F7] to-[#7E57C2]" style={{ width: `${progress * 100}%` }} />
          </div>
          <button onClick={exportCSV} className="w-full mt-1 text-[11px] text-[#64748B] hover:text-[#4FC3F7] transition">
            📥 Exportar trayectoria CSV
          </button>
        </div>

        <ConcentrationSliders
          initial={initialC}
          onChange={setInitialC}
          colors={SPECIES_COLORS}
        />

        <FormulaPanel preset={preset} T={T} />
      </aside>
    </div>
  );
}
