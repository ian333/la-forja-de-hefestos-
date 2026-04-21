/**
 * ══════════════════════════════════════════════════════════════════════
 *  TissueScaleLimit — Nivel 2 → 3: ABM vs Fisher-KPP PDE
 * ══════════════════════════════════════════════════════════════════════
 *
 * Onda invasora 1D, simultánea:
 *   · ABM arriba — células individuales con birth-death-diffusion
 *   · PDE abajo  — Fisher-KPP continuum ∂u/∂t = D∇²u + r·u(1−u/K)
 *
 * Misma IC (pulso en el lado izquierdo), mismas constantes. Se ve cómo
 * el ABM se parece al PDE a K alto y se desvía a K bajo (corrección
 * Brunet-Derrida: c_ABM ≈ c_PDE − π²D/(2·ln²N)).
 *
 * Medimos c_ABM, c_PDE en tiempo real y los comparamos con 2√(rD).
 */

import { useEffect, useRef, useState } from 'react';
import { useAudience } from '@/physics/context';
import {
  createPopulation, addCell, abmStep, densityProfile, waveFrontPosition,
  createFisherKpp, fisherKppStep, fisherKppWaveSpeed, brunetDerridaCorrection,
  type ABMState, type FisherKppState, type ABMParams,
} from '@/lib/scale-limit/agent-based';

// ═══════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════

const L = 60;
const N_BINS = 120;
const D_COEF = 0.5;
const R_RATE = 0.4;
const DT = 0.05;

interface Preset {
  id: string;
  name: string;
  K: number;          // carrying capacity en celdas/unit
  note: string;
  color: string;
}

const PRESETS: Preset[] = [
  { id: 'tiny',   name: 'K=10 · ruido domina',    K:  10, color: '#EF4444',
    note: 'Pocas células. Brunet-Derrida pesa: c_ABM bastante menor que c_PDE.' },
  { id: 'small',  name: 'K=40 · transición',       K:  40, color: '#F97316',
    note: 'Régimen intermedio. La onda ABM es reconocible pero ruidosa.' },
  { id: 'medium', name: 'K=200 · buen match',      K: 200, color: '#FBBF24',
    note: 'La onda ABM empieza a pegar con PDE. Corrección logarítmica ~5%.' },
  { id: 'large',  name: 'K=800 · casi idéntico',   K: 800, color: '#10B981',
    note: 'ABM ≈ PDE. Corrección <2%. El tejido se comporta como continuum.' },
];

// ═══════════════════════════════════════════════════════════════
// Estado de la simulación
// ═══════════════════════════════════════════════════════════════

interface SimHandle {
  abm: ABMState;
  pde: FisherKppState;
  K: number;
  // wave tracking
  f0Abm: number; f0Pde: number;
  t0: number;
  currentC_abm: number;
  currentC_pde: number;
}

function initSim(K: number): SimHandle {
  const maxN = Math.ceil(K * L * 1.5);
  const abm = createPopulation(maxN);
  const nSeed = Math.ceil(K * L * 0.1);
  for (let i = 0; i < nSeed; i++) addCell(abm, Math.random() * L * 0.1, L);
  const pde = createFisherKpp(N_BINS, L);
  const seedBins = Math.floor(N_BINS * 0.1);
  for (let i = 0; i < seedBins; i++) pde.u[i] = K;
  return {
    abm, pde, K,
    f0Abm: 0, f0Pde: 0, t0: 0,
    currentC_abm: NaN, currentC_pde: NaN,
  };
}

function stepSim(sim: SimHandle, nSteps: number) {
  const params: ABMParams = { L, D: D_COEF, r: R_RATE, K: sim.K, dt: DT, localBin: 0.04 };
  for (let k = 0; k < nSteps; k++) {
    abmStep(sim.abm, params);
    fisherKppStep(sim.pde, D_COEF, R_RATE, sim.K, DT);
  }
  // Medir wave speed cada llamada
  const dens = densityProfile(sim.abm, L, N_BINS);
  const fAbm = waveFrontPosition(dens, L, sim.K, 0.5, 0);
  const fPde = (() => {
    const tgt = 0.5 * sim.K;
    const dx = L / N_BINS;
    for (let i = 0; i < N_BINS; i++) if (sim.pde.u[i] < tgt) return (i + 0.5) * dx;
    return L;
  })();
  const t = sim.abm.t;
  // Ventana móvil: medir velocidad sobre ~3 segundos
  if (sim.t0 === 0 && t > 3) {
    sim.f0Abm = fAbm; sim.f0Pde = fPde; sim.t0 = t;
  } else if (sim.t0 > 0 && t - sim.t0 > 2) {
    sim.currentC_abm = (fAbm - sim.f0Abm) / (t - sim.t0);
    sim.currentC_pde = (fPde - sim.f0Pde) / (t - sim.t0);
    // Reset ventana
    sim.f0Abm = fAbm; sim.f0Pde = fPde; sim.t0 = t;
  }
}

// ═══════════════════════════════════════════════════════════════
// SVG Render
// ═══════════════════════════════════════════════════════════════

function ABMView({
  sim, width = 560, height = 120, accent,
}: { sim: SimHandle | null; width?: number; height?: number; accent: string }) {
  const pad = { l: 40, r: 16, t: 18, b: 28 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  if (!sim) return null;
  const dens = densityProfile(sim.abm, L, N_BINS);
  const maxY = Math.max(sim.K * 1.2, 1);
  const dx = L / N_BINS;
  const xOf = (x: number) => pad.l + W * (x / L);
  const yOf = (v: number) => pad.t + H * (1 - v / maxY);
  // Histograma
  const barW = W / N_BINS;
  const bars = Array.from({ length: N_BINS }, (_, i) => ({
    x: xOf(i * dx), y: yOf(dens[i]), h: H - (yOf(dens[i]) - pad.t),
  }));
  // Threshold line
  const thrY = yOf(sim.K * 0.5);
  const capY = yOf(sim.K);
  return (
    <svg width={width} height={height} className="bg-[#0B0F17] border border-[#1E293B] rounded-md">
      <text x={pad.l} y={14} fontSize={10} fill="#94A3B8" fontFamily="monospace">
        ABM (células individuales) · N = {sim.abm.N.toLocaleString('en-US')}
      </text>
      <line x1={pad.l} x2={pad.l + W} y1={capY} y2={capY}
        stroke="#475569" strokeDasharray="2 3" />
      <text x={pad.l + W - 2} y={capY - 3} fontSize={9} fill="#64748B" textAnchor="end" fontFamily="monospace">
        K = {sim.K}
      </text>
      <line x1={pad.l} x2={pad.l + W} y1={thrY} y2={thrY}
        stroke="#F472B6" strokeDasharray="3 3" opacity="0.5" />
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={barW + 0.5} height={b.h}
          fill={accent} opacity="0.85" />
      ))}
      <text x={pad.l - 4} y={pad.t + 6} fontSize={9} fill="#64748B" textAnchor="end" fontFamily="monospace">
        ρ
      </text>
      <text x={pad.l + W / 2} y={height - 8} fontSize={9} fill="#64748B" textAnchor="middle" fontFamily="monospace">
        x
      </text>
    </svg>
  );
}

function PDEView({
  sim, width = 560, height = 120,
}: { sim: SimHandle | null; width?: number; height?: number }) {
  const pad = { l: 40, r: 16, t: 18, b: 28 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  if (!sim) return null;
  const maxY = Math.max(sim.K * 1.2, 1);
  const dx = L / N_BINS;
  const xOf = (x: number) => pad.l + W * (x / L);
  const yOf = (v: number) => pad.t + H * (1 - v / maxY);
  const pts: string[] = [];
  for (let i = 0; i < N_BINS; i++) {
    const x = (i + 0.5) * dx;
    pts.push(`${i === 0 ? 'M' : 'L'} ${xOf(x).toFixed(1)} ${yOf(sim.pde.u[i]).toFixed(1)}`);
  }
  const thrY = yOf(sim.K * 0.5);
  const capY = yOf(sim.K);
  return (
    <svg width={width} height={height} className="bg-[#0B0F17] border border-[#1E293B] rounded-md">
      <text x={pad.l} y={14} fontSize={10} fill="#94A3B8" fontFamily="monospace">
        PDE Fisher-KPP · u(x, t)
      </text>
      <line x1={pad.l} x2={pad.l + W} y1={capY} y2={capY}
        stroke="#475569" strokeDasharray="2 3" />
      <line x1={pad.l} x2={pad.l + W} y1={thrY} y2={thrY}
        stroke="#F472B6" strokeDasharray="3 3" opacity="0.5" />
      <path d={pts.join(' ')} stroke="#FBBF24" strokeWidth="2" fill="none" />
      <text x={pad.l - 4} y={pad.t + 6} fontSize={9} fill="#64748B" textAnchor="end" fontFamily="monospace">
        u
      </text>
      <text x={pad.l + W / 2} y={height - 8} fontSize={9} fill="#64748B" textAnchor="middle" fontFamily="monospace">
        x
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// Módulo
// ═══════════════════════════════════════════════════════════════

function fmt(x: number, d = 2) { return isFinite(x) ? x.toFixed(d) : '—'; }

export default function TissueScaleLimit() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState<string>('medium');
  const preset = PRESETS.find(p => p.id === presetId)!;
  const [playing, setPlaying] = useState(true);
  const [stepsPerFrame, setStepsPerFrame] = useState(4);
  const simRef = useRef<SimHandle>(initSim(preset.K));

  const reset = () => { simRef.current = initSim(preset.K); };
  useEffect(() => { reset(); /* eslint-disable-next-line */ }, [presetId]);

  // Loop
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      stepSim(simRef.current, stepsPerFrame);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, stepsPerFrame, presetId]);

  // Re-render UI
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 120);
    return () => clearInterval(t);
  }, []);

  const cPDE_theory = fisherKppWaveSpeed(D_COEF, R_RATE);
  const bdCorr = brunetDerridaCorrection(preset.K * L, D_COEF);
  const cABM_predicted = cPDE_theory + bdCorr;   // Brunet-Derrida dice restar
  const cAbm = simRef.current.currentC_abm;
  const cPde = simRef.current.currentC_pde;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full min-h-0 overflow-hidden">
      <div className="relative min-h-0 overflow-auto p-6 flex flex-col items-center justify-start gap-3"
        style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}>

        <div className="text-center mb-1">
          <div className="text-[10px] uppercase tracking-widest text-[#64748B] font-mono">Nivel 2 → 3</div>
          <div className="text-[16px] text-[#CBD5E1] font-semibold mt-1">
            ¿Cuándo el tejido se comporta como continuum?
          </div>
          <div className="text-[11px] text-[#94A3B8] mt-1 max-w-xl">
            Misma onda invasora en ABM (arriba) y PDE Fisher-KPP (abajo). Medimos c_ABM y c_PDE,
            comparamos con <span className="font-mono text-[#FBBF24]">2√(rD)</span> y la corrección Brunet-Derrida.
          </div>
        </div>

        <ABMView sim={simRef.current} accent={preset.color} />
        <PDEView sim={simRef.current} />

        {/* Velocidades */}
        <div className="rounded-lg border border-[#1E293B] bg-[#0B0F17] p-3 flex flex-wrap gap-4 items-center font-mono text-[11px]">
          <div>
            <div className="text-[#64748B] text-[9px] uppercase tracking-widest">c_ABM medido</div>
            <div style={{ color: preset.color }} className="text-[14px] font-semibold">
              {fmt(cAbm, 2)}
            </div>
          </div>
          <div>
            <div className="text-[#64748B] text-[9px] uppercase tracking-widest">c_PDE medido</div>
            <div className="text-[#FBBF24] text-[14px] font-semibold">{fmt(cPde, 2)}</div>
          </div>
          <div>
            <div className="text-[#64748B] text-[9px] uppercase tracking-widest">c teoría</div>
            <div className="text-white text-[14px] font-semibold">{fmt(cPDE_theory, 2)}</div>
          </div>
          <div>
            <div className="text-[#64748B] text-[9px] uppercase tracking-widest">Brunet-Derrida</div>
            <div className="text-[#EC4899] text-[14px] font-semibold">
              {fmt(bdCorr, 2)}
            </div>
          </div>
          <div>
            <div className="text-[#64748B] text-[9px] uppercase tracking-widest">t sim</div>
            <div className="text-white text-[14px]">{fmt(simRef.current.abm.t, 1)}</div>
          </div>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <button onClick={() => setPlaying(p => !p)}
            className={`flex items-center gap-2 px-4 h-10 rounded-lg border text-[13px] font-semibold tracking-wide transition ${
              playing
                ? 'border-[#4FC3F7]/60 text-[#4FC3F7] bg-[#4FC3F7]/10'
                : 'border-[#10B981]/60 text-[#10B981] bg-[#10B981]/10'
            }`}>
            <span className="text-[15px]">{playing ? '❚❚' : '▶'}</span>
            <span>{playing ? 'Pausa' : 'Play'}</span>
          </button>
          <button onClick={reset}
            className="flex items-center gap-2 px-4 h-10 rounded-lg border border-[#334155] text-[#CBD5E1] hover:border-[#4FC3F7] text-[13px] transition">
            <span className="text-[15px]">↺</span>
            <span>Reiniciar</span>
          </button>
        </div>
      </div>

      <aside className="border-l border-[#1E293B] bg-[#0B0F17] overflow-y-auto">
        <Section title="Preset">
          <div className="grid grid-cols-1 gap-1.5">
            {PRESETS.map(p => (
              <button key={p.id} onClick={() => setPresetId(p.id)}
                data-testid={`preset-${p.id}`}
                className="text-left px-3 py-2 rounded-md border text-[12px] transition"
                style={{
                  borderColor: presetId === p.id ? p.color : '#1E293B',
                  color: presetId === p.id ? '#fff' : '#94A3B8',
                  background: presetId === p.id ? `${p.color}22` : 'transparent',
                }}>
                <div className="font-semibold">{p.name}</div>
                <div className="text-[10px] opacity-75 mt-0.5 leading-snug">{p.note}</div>
              </button>
            ))}
          </div>
        </Section>

        {audience === 'child' ? (
          <Section title="Qué ves">
            <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
              <p>Dos mundos con las mismas reglas:</p>
              <p><span style={{color: preset.color}}>Arriba</span>: células individuales. Cuenta una por una.</p>
              <p><span className="text-[#FBBF24]">Abajo</span>: la ecuación que "olvida" las células individuales y solo sabe concentración.</p>
              <p>Cuando hay pocas células (K bajo), la onda ABM va más lenta. A medida que aumentas K, los dos mundos se parecen cada vez más.</p>
            </div>
          </Section>
        ) : (
          <Section title="Ecuaciones">
            <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
              <div className="text-white">ABM: birth rate r·(1 − ρ_local/K)</div>
              <div className="text-white">        + random walk √(2D·dt)</div>
              <div className="mt-1 text-white">PDE: ∂u/∂t = D ∇²u + r·u·(1 − u/K)</div>
              <div className="mt-2 text-[#FBBF24]">c_PDE = 2√(rD)</div>
              <div className="text-[#EC4899]">c_ABM = c_PDE − π²D/(2·ln²N) (Brunet-Derrida)</div>
            </div>
          </Section>
        )}

        {audience === 'researcher' && (
          <Section title="Integrador">
            <Slider label="steps/frame" v={stepsPerFrame} min={1} max={20} step={1}
              on={v => setStepsPerFrame(Math.round(v))} />
            <div className="mt-2 text-[10px] text-[#64748B]">
              D={D_COEF}, r={R_RATE}, L={L}, dt={DT}. localBin=4% de L.
              Estabilidad FTCS: D·dt/dx² = {(D_COEF * DT / Math.pow(L/N_BINS, 2)).toFixed(2)} (debe ≤ 0.5).
            </div>
          </Section>
        )}

        <Section title="Umbral empírico">
          <div className="text-[11px] text-[#CBD5E1] leading-relaxed space-y-2">
            <p>Para que el tejido responda bien a modelado continuum (PDE), necesitas:</p>
            <div className="font-mono text-white">N_cells / volumen &gt; 100-1000</div>
            <p className="mt-2">Morfogénesis, wound healing, organogénesis — todo entra en el rango donde ABM y PDE conviven.</p>
            <p className="text-[10px] text-[#64748B] italic mt-3">
              Brunet-Derrida: la corrección es logarítmica, así que aún con N=10⁶ queda ~1% de residuo — el límite continuum nunca es exacto.
            </p>
          </div>
        </Section>

        <Section title="Tests">
          <div className="text-[11px] text-[#94A3B8] leading-relaxed space-y-2">
            <p>8 tests en <code className="text-white">agent-based.test.ts</code>:</p>
            <ul className="ml-3 space-y-1">
              <li>· Random walk: ⟨x²⟩ = 2Dt ±30%</li>
              <li>· Logística bien-mezclada: N → K·L</li>
              <li>· PDE Fisher: c ≈ 2√(rD) ±25%</li>
              <li>· ABM K=80 ↔ PDE: c ±30%</li>
              <li>· Brunet-Derrida: correct sign y scaling</li>
            </ul>
          </div>
        </Section>

        <Section title="La escalera hasta aquí">
          <div className="text-[11px] text-[#CBD5E1] leading-relaxed space-y-1">
            <div><span className="text-[#4FC3F7]">0→1</span> átomos: σ ∝ 1/√N ✓</div>
            <div><span className="text-[#F472B6]">1→2</span> moléculas: σ ∝ 1/√⟨X⟩ ✓</div>
            <div style={{color: preset.color}}>2→3 células: c_ABM → c_PDE con corr log ✓</div>
            <div className="text-[#64748B]">3→4 tejido→órgano: FEM vs compartimento (pendiente)</div>
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
function Slider({ label, v, min, max, step, on }: { label: string; v: number; min: number; max: number; step: number; on: (v: number) => void }) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between text-[11px] font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{v}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={e => on(Number(e.target.value))} className="w-full" />
    </div>
  );
}
