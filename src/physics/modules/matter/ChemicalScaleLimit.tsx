/**
 * ══════════════════════════════════════════════════════════════════════
 *  ChemicalScaleLimit — nivel 1 → 2: SSA vs ODE
 * ══════════════════════════════════════════════════════════════════════
 *
 * Experimento: birth-death química con distintos ⟨X⟩ ∈ {5…5000}.
 *
 *   ∅ → X       (rate α)
 *   X → ∅       (rate β = 1)
 *
 * Steady state: ⟨X⟩ = α; Var(X) = α (Poisson) ⇒ σ/⟨X⟩ = 1/√⟨X⟩.
 *
 * Para cada ⟨X⟩ corremos SSA exacto, medimos σ/⟨X⟩ tras burn-in, y lo
 * comparamos con 1/√⟨X⟩. También mostramos dos trayectorias de ejemplo:
 * una con ⟨X⟩ bajo (ruido domina) y una con ⟨X⟩ alto (ODE se parece).
 *
 * Salida visual honesta:
 *   · Plot log-log como ScaleLimit (N átomos → N moléculas).
 *   · Dos mini-trayectorias SSA+ODE lado a lado mostrando la diferencia
 *     cualitativa del ruido.
 */

import { useEffect, useRef, useState } from 'react';
import { useAudience } from '@/physics/context';
import {
  ssaRun, odeRun, steadyStateStats, birthDeathRSD, birthDeath,
  type SSAResult, type ODEResult,
} from '@/lib/scale-limit/gillespie';

// ═══════════════════════════════════════════════════════════════
// Experimento
// ═══════════════════════════════════════════════════════════════

interface Measurement {
  meanTarget: number;    // α
  meanMeasured: number;
  rsdMeasured: number;
  rsdPredicted: number;
  nEvents: number;
  duration: number;
}

const SWEEP_ALPHAS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

async function measureBirthDeath(alpha: number): Promise<Measurement> {
  await new Promise(r => setTimeout(r, 0));
  const start = performance.now();
  // Ajustar tMax para que haya suficientes eventos pero sin explotar:
  // eventos por unidad de tiempo ≈ 2α (birth + death), queremos ~5-10K
  // eventos → tMax ≈ 5000 / (2α)
  const tMax = Math.max(4, 5000 / (2 * alpha));
  const dtRec = Math.max(0.01, tMax / 1500);
  const net = birthDeath(alpha, 1);
  const result = ssaRun(net, new Int32Array([alpha]), tMax, dtRec);
  const s = steadyStateStats(result, 0, 0.3);
  return {
    meanTarget: alpha,
    meanMeasured: s.mean,
    rsdMeasured: s.rsd,
    rsdPredicted: birthDeathRSD(alpha, 1),
    nEvents: result.totalEvents,
    duration: performance.now() - start,
  };
}

// ═══════════════════════════════════════════════════════════════
// SVG plots
// ═══════════════════════════════════════════════════════════════

function LogLogPlot({
  points, width = 520, height = 360,
}: { points: Measurement[]; width?: number; height?: number }) {
  const pad = { l: 60, r: 20, t: 20, b: 50 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const Nmin = 2, Nmax = 10000;
  const rsdMin = 1e-3, rsdMax = 2.0;
  const x = (N: number) => pad.l + W * (Math.log10(N) - Math.log10(Nmin)) / (Math.log10(Nmax) - Math.log10(Nmin));
  const y = (r: number) => pad.t + H * (1 - (Math.log10(r) - Math.log10(rsdMin)) / (Math.log10(rsdMax) - Math.log10(rsdMin)));

  const predPath = (() => {
    const pts: string[] = [];
    for (let i = 0; i <= 60; i++) {
      const logN = Math.log10(Nmin) + (Math.log10(Nmax) - Math.log10(Nmin)) * (i / 60);
      const N = Math.pow(10, logN);
      const r = 1 / Math.sqrt(N);
      if (r < rsdMin || r > rsdMax) continue;
      pts.push(`${i === 0 ? 'M' : 'L'} ${x(N)} ${y(r)}`);
    }
    return pts.join(' ');
  })();

  const nTicks = [10, 100, 1000, 10000];
  const rTicks = [0.001, 0.01, 0.1, 1];
  const h10 = y(0.1), h1 = y(0.01);

  return (
    <svg width={width} height={height} className="bg-[#0B0F17] border border-[#1E293B] rounded-lg">
      {nTicks.map(N => (
        <g key={N}>
          <line x1={x(N)} x2={x(N)} y1={pad.t} y2={pad.t + H}
            stroke="#1E293B" strokeDasharray="2 3" />
          <text x={x(N)} y={pad.t + H + 18} textAnchor="middle"
            fontSize={10} fill="#64748B" fontFamily="monospace">
            {N >= 1000 ? `${N/1000}K` : N}
          </text>
        </g>
      ))}
      {rTicks.map(r => (
        <g key={r}>
          <line x1={pad.l} x2={pad.l + W} y1={y(r)} y2={y(r)}
            stroke="#1E293B" strokeDasharray="2 3" />
          <text x={pad.l - 8} y={y(r) + 3} textAnchor="end"
            fontSize={10} fill="#64748B" fontFamily="monospace">
            {r < 0.01 ? r.toExponential(0) : r}
          </text>
        </g>
      ))}

      {/* Zonas */}
      <rect x={pad.l} y={pad.t} width={W} height={h10 - pad.t}
        fill="#EF4444" opacity="0.04" />
      <rect x={pad.l} y={h10} width={W} height={h1 - h10}
        fill="#FBBF24" opacity="0.05" />
      <rect x={pad.l} y={h1} width={W} height={pad.t + H - h1}
        fill="#10B981" opacity="0.05" />

      <line x1={pad.l} x2={pad.l + W} y1={h10} y2={h10}
        stroke="#F87171" strokeWidth="1" strokeDasharray="4 4" opacity="0.7" />
      <text x={pad.l + W - 4} y={h10 - 4} textAnchor="end"
        fontSize={10} fill="#F87171" fontFamily="monospace">
        10% · ODE no fiable abajo
      </text>
      <line x1={pad.l} x2={pad.l + W} y1={h1} y2={h1}
        stroke="#10B981" strokeWidth="1" strokeDasharray="4 4" opacity="0.7" />
      <text x={pad.l + W - 4} y={h1 - 4} textAnchor="end"
        fontSize={10} fill="#10B981" fontFamily="monospace">
        1% · ODE confiable
      </text>

      {/* Predicción */}
      <path d={predPath} stroke="#FBBF24" strokeWidth="2" fill="none" opacity={0.85} />

      {/* Puntos medidos */}
      {points.map((p, i) => (
        <circle key={i} cx={x(p.meanMeasured)} cy={y(p.rsdMeasured)}
          r={5} fill="#F472B6" stroke="#0B0F17" strokeWidth="1.5" />
      ))}

      <text x={pad.l + W / 2} y={height - 10} textAnchor="middle"
        fontSize={11} fill="#CBD5E1" fontFamily="monospace">
        ⟨X⟩ (moléculas)
      </text>
      <text x={18} y={pad.t + H / 2} textAnchor="middle"
        fontSize={11} fill="#CBD5E1" fontFamily="monospace"
        transform={`rotate(-90 18 ${pad.t + H / 2})`}>
        σ_X / ⟨X⟩
      </text>

      <g transform={`translate(${pad.l + 14}, ${pad.t + 14})`}>
        <rect x={0} y={0} width={170} height={44}
          fill="#0B0F17" stroke="#1E293B" rx="4" opacity="0.9" />
        <line x1={8} x2={24} y1={16} y2={16} stroke="#FBBF24" strokeWidth="2" />
        <text x={30} y={19} fontSize={10} fill="#CBD5E1" fontFamily="monospace">
          1/√⟨X⟩ teoría
        </text>
        <circle cx={16} cy={32} r={4} fill="#F472B6" />
        <text x={30} y={35} fontSize={10} fill="#CBD5E1" fontFamily="monospace">
          SSA medido
        </text>
      </g>
    </svg>
  );
}

function TrajectoryPlot({
  ssa, ode, width = 250, height = 160, title, alpha,
}: { ssa: SSAResult; ode: ODEResult; width?: number; height?: number; title: string; alpha: number }) {
  const pad = { l: 38, r: 10, t: 20, b: 26 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  // Eje X compartido = tiempo
  const tMax = ssa.times[ssa.times.length - 1] ?? 1;
  // Eje Y: usar rango combinado
  let yMax = 0;
  for (const s of ssa.samples) yMax = Math.max(yMax, s[0]);
  for (const s of ode.samples) yMax = Math.max(yMax, s[0]);
  yMax = Math.max(yMax, alpha * 1.2);
  const x = (t: number) => pad.l + W * (t / tMax);
  const y = (v: number) => pad.t + H * (1 - v / yMax);

  const ssaPath = ssa.times.map((t, i) =>
    `${i === 0 ? 'M' : 'L'} ${x(t).toFixed(1)} ${y(ssa.samples[i][0]).toFixed(1)}`,
  ).join(' ');
  const odePath = ode.times.map((t, i) =>
    `${i === 0 ? 'M' : 'L'} ${x(t).toFixed(1)} ${y(ode.samples[i][0]).toFixed(1)}`,
  ).join(' ');

  return (
    <svg width={width} height={height} className="bg-[#0B0F17] border border-[#1E293B] rounded-md">
      <text x={width / 2} y={14} textAnchor="middle" fontSize={10}
        fill="#94A3B8" fontFamily="monospace">
        {title}
      </text>
      <line x1={pad.l} x2={pad.l + W} y1={y(alpha)} y2={y(alpha)}
        stroke="#475569" strokeDasharray="2 3" />
      <text x={pad.l - 4} y={y(alpha) + 3} textAnchor="end"
        fontSize={9} fill="#64748B" fontFamily="monospace">
        α={alpha}
      </text>
      <path d={ssaPath} stroke="#F472B6" strokeWidth="1" fill="none" opacity={0.85} />
      <path d={odePath} stroke="#FBBF24" strokeWidth="2" fill="none" />
      <text x={pad.l} y={height - 8} fontSize={9} fill="#64748B" fontFamily="monospace">
        t
      </text>
      <text x={pad.l - 30} y={pad.t + 8} fontSize={9} fill="#64748B" fontFamily="monospace"
        transform={`rotate(-90 ${pad.l - 30} ${pad.t + 8})`}>
        X
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// Módulo
// ═══════════════════════════════════════════════════════════════

export default function ChemicalScaleLimit() {
  const { audience } = useAudience();
  const [points, setPoints] = useState<Measurement[]>([]);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
  const cancelRef = useRef(false);

  // Trayectorias de ejemplo
  const [trajLow, setTrajLow] = useState<{ ssa: SSAResult; ode: ODEResult } | null>(null);
  const [trajHigh, setTrajHigh] = useState<{ ssa: SSAResult; ode: ODEResult } | null>(null);

  const runSweep = async () => {
    if (running) return;
    setPoints([]);
    setRunning(true);
    cancelRef.current = false;
    for (const alpha of SWEEP_ALPHAS) {
      if (cancelRef.current) break;
      setCurrent(alpha);
      const pt = await measureBirthDeath(alpha);
      setPoints(prev => [...prev, pt]);
    }
    setCurrent(null);
    setRunning(false);
  };

  const computeTrajectories = () => {
    // ⟨X⟩ bajo = 10 (ruido domina); ⟨X⟩ alto = 1000 (ODE exacta)
    const netLow = birthDeath(10, 1);
    const netHigh = birthDeath(1000, 1);
    const lowSSA = ssaRun(netLow,  new Int32Array([10]),   8, 0.05);
    const lowODE = odeRun(netLow,  new Float64Array([10]), 8, 0.02);
    const hiSSA  = ssaRun(netHigh, new Int32Array([1000]), 3, 0.02);
    const hiODE  = odeRun(netHigh, new Float64Array([1000]), 3, 0.01);
    setTrajLow({ ssa: lowSSA, ode: lowODE });
    setTrajHigh({ ssa: hiSSA, ode: hiODE });
  };

  useEffect(() => {
    computeTrajectories();
    runSweep();
    // eslint-disable-next-line
  }, []);

  // Crossover
  const findCrossover = (target: number): number | null => {
    if (points.length < 2) return null;
    const sorted = [...points].sort((a, b) => a.meanMeasured - b.meanMeasured);
    for (let i = 0; i < sorted.length - 1; i++) {
      const p0 = sorted[i], p1 = sorted[i + 1];
      if ((p0.rsdMeasured - target) * (p1.rsdMeasured - target) <= 0) {
        const l0 = Math.log(p0.meanMeasured), l1 = Math.log(p1.meanMeasured);
        const r0 = Math.log(p0.rsdMeasured), r1 = Math.log(p1.rsdMeasured);
        const rt = Math.log(target);
        const frac = (rt - r0) / (r1 - r0);
        return Math.round(Math.exp(l0 + frac * (l1 - l0)));
      }
    }
    return null;
  };
  const cx10 = findCrossover(0.1);
  const cx1 = findCrossover(0.01);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full min-h-0 overflow-hidden">
      <div className="relative min-h-0 overflow-auto p-6 flex flex-col items-center justify-start gap-4"
        style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}>

        <div className="text-center mb-1">
          <div className="text-[10px] uppercase tracking-widest text-[#64748B] font-mono">Nivel 1 → 2</div>
          <div className="text-[16px] text-[#CBD5E1] font-semibold mt-1">
            ¿Desde qué N de moléculas las ODEs químicas son fiables?
          </div>
          <div className="text-[11px] text-[#94A3B8] mt-1 max-w-xl">
            Birth-death ∅ ⇌ X con α ∈ {'{'}{SWEEP_ALPHAS[0]}…{SWEEP_ALPHAS[SWEEP_ALPHAS.length-1]}{'}'}. Medimos σ/⟨X⟩
            del SSA exacto y lo comparamos con <span className="font-mono text-[#FBBF24]">1/√⟨X⟩</span>.
          </div>
        </div>

        <LogLogPlot points={points} />

        {/* Trayectorias SSA vs ODE */}
        <div className="flex gap-3 flex-wrap justify-center">
          {trajLow && (
            <TrajectoryPlot ssa={trajLow.ssa} ode={trajLow.ode}
              title="⟨X⟩ = 10  ·  ruido domina" alpha={10} />
          )}
          {trajHigh && (
            <TrajectoryPlot ssa={trajHigh.ssa} ode={trajHigh.ode}
              title="⟨X⟩ = 1000  ·  ODE se pega" alpha={1000} />
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={runSweep} disabled={running}
            className={`flex items-center gap-2 px-4 h-10 rounded-lg border text-[13px] font-semibold tracking-wide transition ${
              running ? 'border-[#475569] text-[#94A3B8]'
                      : 'border-[#F472B6]/60 text-[#F472B6] hover:bg-[#F472B6]/10'
            }`}>
            {running ? '⋯ midiendo' : '↻ Medir sweep'}
          </button>
          {running && (
            <button onClick={() => { cancelRef.current = true; }}
              className="px-4 h-10 rounded-lg border border-[#EF4444]/60 text-[#EF4444] hover:bg-[#EF4444]/10 text-[13px] transition">
              Cancelar
            </button>
          )}
          <button onClick={computeTrajectories}
            className="px-4 h-10 rounded-lg border border-[#334155] text-[#CBD5E1] hover:border-[#4FC3F7] text-[13px] transition">
            ↺ Nuevas trayectorias
          </button>
          {running && current !== null && (
            <div className="text-[11px] font-mono text-[#94A3B8]">⟨X⟩ = {current}</div>
          )}
        </div>

        {/* Tabla */}
        <div className="w-full max-w-[560px]">
          <div className="rounded-lg border border-[#1E293B] bg-[#0B0F17] overflow-hidden">
            <table className="w-full text-[11px] font-mono">
              <thead className="bg-[#0F172A] text-[#64748B]">
                <tr>
                  <th className="text-left px-3 py-2">α = ⟨X⟩</th>
                  <th className="text-right px-3 py-2">σ/⟨X⟩ SSA</th>
                  <th className="text-right px-3 py-2">1/√⟨X⟩ teo</th>
                  <th className="text-right px-3 py-2">razón</th>
                  <th className="text-right px-3 py-2">#eventos</th>
                </tr>
              </thead>
              <tbody className="text-[#CBD5E1]">
                {SWEEP_ALPHAS.map(a => {
                  const m = points.find(q => q.meanTarget === a);
                  return (
                    <tr key={a} className="border-t border-[#1E293B]"
                      style={{ opacity: m ? 1 : 0.45 }}>
                      <td className="px-3 py-1.5">{a}</td>
                      <td className="text-right px-3 py-1.5">
                        {m ? (m.rsdMeasured * 100).toFixed(2) + '%' : '—'}
                      </td>
                      <td className="text-right px-3 py-1.5 text-[#FBBF24]">
                        {((1 / Math.sqrt(a)) * 100).toFixed(2)}%
                      </td>
                      <td className="text-right px-3 py-1.5">
                        {m ? (m.rsdMeasured * Math.sqrt(a)).toFixed(2) : '—'}
                      </td>
                      <td className="text-right px-3 py-1.5 text-[#64748B]">
                        {m ? m.nEvents.toLocaleString('en-US') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <aside className="border-l border-[#1E293B] bg-[#0B0F17] overflow-y-auto">
        <Section title="Umbrales">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B]">ODE NO fiable</div>
              <div className="font-mono text-[14px] text-[#EF4444]">⟨X⟩ &lt; 100</div>
              <div className="text-[11px] text-[#94A3B8] mt-0.5">σ/⟨X⟩ &gt; 10% · SSA obligatorio</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B]">10% error (empírico)</div>
              <div className="font-mono text-[14px] text-[#FBBF24]">⟨X⟩ = {cx10 ?? '—'}</div>
              <div className="text-[11px] text-[#94A3B8] mt-0.5">teoría: ⟨X⟩ = 100</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B]">1% error (empírico)</div>
              <div className="font-mono text-[14px] text-[#10B981]">⟨X⟩ = {cx1 ?? 'fuera'}</div>
              <div className="text-[11px] text-[#94A3B8] mt-0.5">teoría: ⟨X⟩ = 10 000</div>
            </div>
          </div>
        </Section>

        {audience === 'child' ? (
          <Section title="Lo que ves">
            <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
              <p>Dos mundos iguales — mismas reglas químicas, distintas cantidades.</p>
              <p>Arriba: 10 moléculas. La línea rosa (simulación molécula por molécula) ZIGZAGUEA alrededor de la línea amarilla (ODE).</p>
              <p>Abajo: 1000 moléculas. La línea rosa ABRAZA la amarilla — ya no hay ruido visible.</p>
              <p>Por eso los libros de química te mienten un poco: las ODEs funcionan solo cuando hay MUCHAS moléculas.</p>
            </div>
          </Section>
        ) : (
          <Section title="Modelo">
            <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
              <div className="text-white">∅ → X      (α)</div>
              <div className="text-white">X → ∅      (β = 1)</div>
              <div className="mt-2 text-[#94A3B8]">Steady: ⟨X⟩ = α, Var = α (Poisson)</div>
              <div className="text-[#94A3B8]">σ/⟨X⟩ = 1/√⟨X⟩</div>
            </div>
          </Section>
        )}

        {audience === 'researcher' && (
          <Section title="SSA Direct Method">
            <div className="text-[11px] text-[#94A3B8] leading-relaxed space-y-2">
              <p>Gillespie 1976: τ ~ Exp(a₀), j ~ Cat(aⱼ/a₀).</p>
              <p>Propensity con combinatoria exacta (binomial): para A+A→B, a = c·n(n−1)/2 (NO c·n²).</p>
              <p>ODE mass-action usa potencias continuas (c·x²). Esa es la diferencia que se desvanece al N → ∞.</p>
            </div>
          </Section>
        )}

        <Section title="Otras redes — por medir">
          <div className="text-[11px] text-[#CBD5E1] leading-relaxed space-y-2">
            <p><span className="text-[#F97316] font-semibold">Lotka-Volterra:</span> SSA a N bajo → extinción estocástica. ODE oscila para siempre. Diferencia cualitativa.</p>
            <p><span className="text-[#A855F7] font-semibold">Schlögl:</span> bistable. SSA transiciona entre estados, ODE se queda atascada en uno.</p>
            <p><span className="text-[#EC4899] font-semibold">Brusselator:</span> oscilador químico. SSA rompe el límite ciclo a bajo N.</p>
            <p className="mt-3 text-[10px] text-[#64748B] italic">Todos usables con el mismo motor gillespie.ts.</p>
          </div>
        </Section>

        <Section title="Tests">
          <div className="text-[11px] text-[#94A3B8] leading-relaxed space-y-2">
            <p>15 tests en <code className="text-white">gillespie.test.ts</code>:</p>
            <ul className="ml-3 space-y-1">
              <li>· Propensity binomial correcta</li>
              <li>· ⟨X⟩_SSA → α/β (LLN)</li>
              <li>· Var(X)_SSA → α/β (Poisson)</li>
              <li>· σ/⟨X⟩ sigue ley 1/√⟨X⟩</li>
              <li>· ODE birth-death reproduce x(t) = α/β·(1−e^(−βt))</li>
              <li>· LV SSA↔ODE concuerda a N alto</li>
            </ul>
          </div>
        </Section>

        <Section title="En una línea">
          <div className="text-[11px] text-[#CBD5E1] leading-relaxed italic">
            "La ley de acción de masas es el límite termodinámico de la dinámica
            estocástica de reacciones" — van Kampen 2007.
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
