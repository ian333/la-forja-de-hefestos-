/**
 * ══════════════════════════════════════════════════════════════════════
 *  ScaleLimit — ¿desde qué N empieza a valer "promediar"?
 * ══════════════════════════════════════════════════════════════════════
 *
 * Experimento numérico honesto:
 *
 *   1. Correr gas LJ con N ∈ {16, 32, 64, 128, 256, 512, 1024} átomos.
 *   2. Para cada N, medir la dispersión relativa de la temperatura
 *      instantánea σ_T / ⟨T⟩ tras un burn-in.
 *   3. Comparar contra la predicción analítica √(2/(3N)).
 *   4. Identificar el umbral N* a partir del cual la RSD cae por debajo
 *      de un error objetivo (5%, 2%, 1%).
 *
 * Es el test físico que justifica — o no — toda nuestra infraestructura
 * de coarse-graining y bridging. Si los puntos medidos caen sobre la
 * línea √(2/3N), la estadística pasa: podemos promediar y el promedio
 * tiene significado. Si no, algo anda mal.
 *
 * No usa Three.js. Es un gráfico log-log puro en SVG — una herramienta
 * de laboratorio, no un adorno.
 */

import { useEffect, useRef, useState } from 'react';
import { useAudience } from '@/physics/context';
import {
  ljCpu, pairwiseStepCpu, kineticEnergyCpu,
  type PairwiseCpuState,
} from '@/lib/gpu/pairwise';
import {
  analyzeSeries, predictTemperatureRSD, SCALE_THRESHOLDS,
} from '@/lib/scale-limit/fluctuations';
import { gaussianN01 } from '@/lib/gpu/kernel-core';

// ═══════════════════════════════════════════════════════════════
// Ejecución del experimento
// ═══════════════════════════════════════════════════════════════

interface MeasurePoint {
  N: number;
  rsdMeasured: number;
  rsdPredicted: number;
  meanT: number;
  duration: number;   // ms de cómputo
}

function seedGas(N: number, L: number, T0: number): PairwiseCpuState {
  const pos = new Float32Array(N * 4);
  const vel = new Float32Array(N * 4);
  const side = Math.ceil(Math.cbrt(N));
  const dx = L / side;
  const half = L / 2;
  let vxM = 0, vyM = 0, vzM = 0;
  for (let i = 0; i < N; i++) {
    const a = Math.floor(i / (side * side));
    const b = Math.floor((i / side) % side);
    const c = i % side;
    pos[i*4  ] = -half + (c + 0.5) * dx + (Math.random() - 0.5) * dx * 0.12;
    pos[i*4+1] = -half + (b + 0.5) * dx + (Math.random() - 0.5) * dx * 0.12;
    pos[i*4+2] = -half + (a + 0.5) * dx + (Math.random() - 0.5) * dx * 0.12;
    const sv = Math.sqrt(T0);
    const vx = gaussianN01() * sv;
    const vy = gaussianN01() * sv;
    const vz = gaussianN01() * sv;
    vel[i*4] = vx; vel[i*4+1] = vy; vel[i*4+2] = vz; vel[i*4+3] = 1;
    vxM += vx; vyM += vy; vzM += vz;
  }
  vxM /= N; vyM /= N; vzM /= N;
  for (let i = 0; i < N; i++) {
    vel[i*4] -= vxM; vel[i*4+1] -= vyM; vel[i*4+2] -= vzM;
  }
  return { pos, vel, N };
}

async function measurePoint(N: number, T0: number, nProd: number): Promise<MeasurePoint> {
  // Yield al DOM para no bloquear UI
  await new Promise(r => setTimeout(r, 0));
  const start = performance.now();
  const L = Math.cbrt(N) * 1.8;    // ρ ≈ 0.17 — gas diluido, régimen donde LJ es cercano al ideal
  const state = seedGas(N, L, T0);
  const law = ljCpu({ sigma: [1,1,1,1], epsilon: [1,1,1,1] });
  const dt = 0.003;
  const nBurn = 120;
  for (let k = 0; k < nBurn; k++) pairwiseStepCpu(state, [law], dt, L);
  const Ts: number[] = new Array(nProd);
  for (let k = 0; k < nProd; k++) {
    pairwiseStepCpu(state, [law], dt, L);
    const KE = kineticEnergyCpu(state);
    Ts[k] = (2 * KE) / (3 * N);
  }
  const s = analyzeSeries(Ts);
  const duration = performance.now() - start;
  return {
    N, meanT: s.mean, rsdMeasured: s.rsd,
    rsdPredicted: predictTemperatureRSD(N), duration,
  };
}

// ═══════════════════════════════════════════════════════════════
// SVG Plot log-log
// ═══════════════════════════════════════════════════════════════

interface PlotProps {
  points: MeasurePoint[];
  width?: number; height?: number;
  threshold5: number;
  threshold1: number;
}

function LogLogPlot({
  points, width = 520, height = 380, threshold5, threshold1,
}: PlotProps) {
  const pad = { l: 60, r: 20, t: 20, b: 50 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const Nmin = 8, Nmax = 65536;
  const rsdMin = 1e-3, rsdMax = 1.0;
  const x = (N: number) => pad.l + W * (Math.log10(N) - Math.log10(Nmin)) / (Math.log10(Nmax) - Math.log10(Nmin));
  const y = (r: number) => pad.t + H * (1 - (Math.log10(r) - Math.log10(rsdMin)) / (Math.log10(rsdMax) - Math.log10(rsdMin)));

  // Predicción: √(2/3N) sobre el rango completo
  const predPath = (() => {
    const steps = 60;
    const pts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const logN = Math.log10(Nmin) + (Math.log10(Nmax) - Math.log10(Nmin)) * (i / steps);
      const N = Math.pow(10, logN);
      const r = Math.sqrt(2 / (3 * N));
      if (r < rsdMin || r > rsdMax) continue;
      pts.push(`${i === 0 ? 'M' : 'L'} ${x(N)} ${y(r)}`);
    }
    return pts.join(' ');
  })();

  // Líneas de error objetivo
  const hline = (r: number) => ({
    path: `M ${pad.l} ${y(r)} L ${pad.l + W} ${y(r)}`,
    label: `σ/⟨T⟩ = ${(r * 100).toFixed(0)}%`,
  });
  const h5 = hline(0.05);
  const h1 = hline(0.01);

  // Ticks de los ejes
  const nTicks = [10, 100, 1000, 10000];
  const rsdTicks = [0.001, 0.01, 0.1, 1];

  return (
    <svg width={width} height={height}
      className="bg-[#0B0F17] border border-[#1E293B] rounded-lg">
      {/* Grid vertical (N) */}
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
      {/* Grid horizontal (rsd) */}
      {rsdTicks.map(r => (
        <g key={r}>
          <line x1={pad.l} x2={pad.l + W} y1={y(r)} y2={y(r)}
            stroke="#1E293B" strokeDasharray="2 3" />
          <text x={pad.l - 8} y={y(r) + 3} textAnchor="end"
            fontSize={10} fill="#64748B" fontFamily="monospace">
            {r < 0.01 ? r.toExponential(0) : r}
          </text>
        </g>
      ))}

      {/* Líneas de error objetivo */}
      <path d={h5.path} stroke="#4FC3F7" strokeWidth="1" strokeDasharray="4 4" fill="none" opacity="0.5" />
      <text x={pad.l + W - 4} y={y(0.05) - 4} textAnchor="end"
        fontSize={10} fill="#4FC3F7" fontFamily="monospace" opacity={0.8}>
        5% · N* = {threshold5}
      </text>
      <path d={h1.path} stroke="#10B981" strokeWidth="1" strokeDasharray="4 4" fill="none" opacity="0.5" />
      <text x={pad.l + W - 4} y={y(0.01) - 4} textAnchor="end"
        fontSize={10} fill="#10B981" fontFamily="monospace" opacity={0.8}>
        1% · N* = {threshold1}
      </text>

      {/* Predicción analítica */}
      <path d={predPath} stroke="#FBBF24" strokeWidth="2" fill="none" opacity={0.85} />

      {/* Puntos medidos */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(p.N)} cy={y(p.rsdMeasured)} r={5}
            fill="#F472B6" stroke="#0B0F17" strokeWidth="1.5" />
          {/* error bar heurístico ±1/√2N_samples aprox */}
        </g>
      ))}

      {/* Labels de ejes */}
      <text x={pad.l + W / 2} y={height - 10} textAnchor="middle"
        fontSize={11} fill="#CBD5E1" fontFamily="monospace">
        N (átomos)
      </text>
      <text x={18} y={pad.t + H / 2} textAnchor="middle"
        fontSize={11} fill="#CBD5E1" fontFamily="monospace"
        transform={`rotate(-90 18 ${pad.t + H / 2})`}>
        σ_T / ⟨T⟩ (adim)
      </text>

      {/* Leyenda */}
      <g transform={`translate(${pad.l + 14}, ${pad.t + 14})`}>
        <rect x={0} y={0} width={170} height={44}
          fill="#0B0F17" stroke="#1E293B" rx="4" opacity="0.9" />
        <line x1={8} x2={24} y1={16} y2={16} stroke="#FBBF24" strokeWidth="2" />
        <text x={30} y={19} fontSize={10} fill="#CBD5E1" fontFamily="monospace">
          √(2/(3N)) teoría
        </text>
        <circle cx={16} cy={32} r={4} fill="#F472B6" />
        <text x={30} y={35} fontSize={10} fill="#CBD5E1" fontFamily="monospace">
          medición MD
        </text>
      </g>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// Módulo
// ═══════════════════════════════════════════════════════════════

const SWEEP_SIZES = [16, 32, 64, 128, 256, 512, 1024];
const T_TARGET = 1.3;

export default function ScaleLimit() {
  const { audience } = useAudience();
  const [points, setPoints] = useState<MeasurePoint[]>([]);
  const [running, setRunning] = useState(false);
  const [currentN, setCurrentN] = useState<number | null>(null);
  const [nProd, setNProd] = useState(1200);
  const cancelRef = useRef(false);

  const runSweep = async () => {
    if (running) return;
    setPoints([]);
    setRunning(true);
    cancelRef.current = false;
    for (const N of SWEEP_SIZES) {
      if (cancelRef.current) break;
      setCurrentN(N);
      const pt = await measurePoint(N, T_TARGET, nProd);
      setPoints(prev => [...prev, pt]);
    }
    setCurrentN(null);
    setRunning(false);
  };

  const cancel = () => { cancelRef.current = true; };
  const reset = () => { setPoints([]); setCurrentN(null); };

  useEffect(() => { runSweep(); /* autosweep al montar */
    // eslint-disable-next-line
  }, []);

  // Puntos teóricos (para tabla)
  const predicted = SWEEP_SIZES.map(N => ({ N, rsd: predictTemperatureRSD(N) }));

  // Umbrales de N crossover a partir de los puntos medidos:
  // interp lineal en log-log entre puntos vecinos.
  const findCrossover = (target: number): number | null => {
    if (points.length < 2) return null;
    const sorted = [...points].sort((a, b) => a.N - b.N);
    for (let i = 0; i < sorted.length - 1; i++) {
      const p0 = sorted[i], p1 = sorted[i + 1];
      if ((p0.rsdMeasured - target) * (p1.rsdMeasured - target) <= 0) {
        // interp lineal en log-log
        const l0 = Math.log(p0.N), l1 = Math.log(p1.N);
        const r0 = Math.log(p0.rsdMeasured), r1 = Math.log(p1.rsdMeasured);
        const rt = Math.log(target);
        const frac = (rt - r0) / (r1 - r0);
        return Math.round(Math.exp(l0 + frac * (l1 - l0)));
      }
    }
    return null;
  };

  const crossover5 = findCrossover(0.05);
  const crossover1 = findCrossover(0.01);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full min-h-0 overflow-hidden">
      <div className="relative min-h-0 overflow-auto p-6 flex flex-col items-center justify-start gap-4"
        style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}>

        <div className="text-center mb-2">
          <div className="text-[10px] uppercase tracking-widest text-[#64748B] font-mono">Nivel 0 → 1</div>
          <div className="text-[16px] text-[#CBD5E1] font-semibold mt-1">
            ¿Cuántos átomos hacen falta para que promediar T tenga sentido?
          </div>
          <div className="text-[11px] text-[#94A3B8] mt-1 max-w-xl">
            Medimos σ_T/⟨T⟩ en MD LJ para N = {SWEEP_SIZES[0]} hasta {SWEEP_SIZES[SWEEP_SIZES.length-1]} átomos.
            Lo comparamos contra la ley analítica <span className="font-mono text-[#FBBF24]">√(2/(3N))</span>.
          </div>
        </div>

        <LogLogPlot points={points}
          threshold5={SCALE_THRESHOLDS.temperature5pct}
          threshold1={SCALE_THRESHOLDS.temperature1pct} />

        <div className="flex items-center gap-2 mt-2">
          <button onClick={runSweep} disabled={running}
            className={`flex items-center gap-2 px-4 h-10 rounded-lg border text-[13px] font-semibold tracking-wide transition ${
              running
                ? 'border-[#475569] text-[#94A3B8]'
                : 'border-[#F472B6]/60 text-[#F472B6] hover:bg-[#F472B6]/10'
            }`}>
            {running ? '⋯ midiendo' : '↻ Medir sweep'}
          </button>
          {running && (
            <button onClick={cancel}
              className="px-4 h-10 rounded-lg border border-[#EF4444]/60 text-[#EF4444] hover:bg-[#EF4444]/10 text-[13px] transition">
              Cancelar
            </button>
          )}
          {!running && points.length > 0 && (
            <button onClick={reset}
              className="px-4 h-10 rounded-lg border border-[#475569] text-[#94A3B8] hover:text-white text-[13px] transition">
              Limpiar
            </button>
          )}
          {running && currentN !== null && (
            <div className="text-[11px] font-mono text-[#94A3B8]">N = {currentN} · {nProd} pasos</div>
          )}
        </div>

        {/* Tabla */}
        <div className="w-full max-w-[560px] mt-2">
          <div className="rounded-lg border border-[#1E293B] bg-[#0B0F17] overflow-hidden">
            <table className="w-full text-[11px] font-mono">
              <thead className="bg-[#0F172A] text-[#64748B]">
                <tr>
                  <th className="text-left px-3 py-2">N</th>
                  <th className="text-right px-3 py-2">σ/⟨T⟩ medido</th>
                  <th className="text-right px-3 py-2">√(2/3N) teo</th>
                  <th className="text-right px-3 py-2">razón</th>
                  <th className="text-right px-3 py-2">⟨T⟩</th>
                  <th className="text-right px-3 py-2">t (ms)</th>
                </tr>
              </thead>
              <tbody className="text-[#CBD5E1]">
                {predicted.map(p => {
                  const m = points.find(q => q.N === p.N);
                  return (
                    <tr key={p.N} className="border-t border-[#1E293B]"
                      style={{ opacity: m ? 1 : 0.45 }}>
                      <td className="px-3 py-1.5">{p.N}</td>
                      <td className="text-right px-3 py-1.5">
                        {m ? (m.rsdMeasured * 100).toFixed(2) + '%' : '—'}
                      </td>
                      <td className="text-right px-3 py-1.5 text-[#FBBF24]">
                        {(p.rsd * 100).toFixed(2)}%
                      </td>
                      <td className="text-right px-3 py-1.5">
                        {m ? (m.rsdMeasured / p.rsd).toFixed(2) : '—'}
                      </td>
                      <td className="text-right px-3 py-1.5">
                        {m ? m.meanT.toFixed(3) : '—'}
                      </td>
                      <td className="text-right px-3 py-1.5 text-[#64748B]">
                        {m ? m.duration.toFixed(0) : '—'}
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
        <Section title="Los números">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B]">Umbral 5% error</div>
              <div className="font-mono text-[14px] text-[#4FC3F7]">
                teoría: N ≈ {SCALE_THRESHOLDS.temperature5pct}
              </div>
              <div className="font-mono text-[12px] text-[#94A3B8]">
                medido: N ≈ {crossover5 ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B]">Umbral 1% error</div>
              <div className="font-mono text-[14px] text-[#10B981]">
                teoría: N ≈ {SCALE_THRESHOLDS.temperature1pct.toLocaleString()}
              </div>
              <div className="font-mono text-[12px] text-[#94A3B8]">
                fuera del rango medido
              </div>
            </div>
          </div>
        </Section>

        {audience === 'child' ? (
          <Section title="Qué ves">
            <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
              <p>Cada punto es una simulación con distinto número de átomos.</p>
              <p>La línea amarilla es la predicción matemática: con 100 átomos tienes ~8% de error en T; con 10 000 tienes ~1%.</p>
              <p>Si los puntos rosas caen sobre la línea, nuestro simulador respeta la ley. Si se salen, hay bug.</p>
            </div>
          </Section>
        ) : (
          <Section title="Ecuación">
            <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
              <div className="text-white">T_inst = (2/3N) · KE</div>
              <div className="text-white">σ_T / ⟨T⟩ = √(2 / (3N))</div>
              <div className="mt-2 text-[#94A3B8]">
                Central limit para Σ½m v². Exacto en MB; ±10-30% en MD NVE por correlaciones.
              </div>
            </div>
          </Section>
        )}

        {audience === 'researcher' && (
          <Section title="Parámetros">
            <Slider label="Steps producción" v={nProd} min={400} max={4000} step={100}
              on={setNProd} />
            <div className="text-[10px] text-[#64748B] mt-2">
              Burn-in fijo 120 pasos. T_target = {T_TARGET}. ρ ≈ 0.17 (gas diluido).
            </div>
          </Section>
        )}

        <Section title="Otros niveles — por medir">
          <div className="text-[11px] text-[#CBD5E1] leading-relaxed space-y-2">
            <div><span className="text-[#F97316] font-semibold">nivel 1 → 2:</span> Gillespie vs ODE — crossover ~10²-10³ moléculas/especie.</div>
            <div><span className="text-[#A855F7] font-semibold">nivel 2 → 3:</span> ABM vs PDE — ~10²-10³ células.</div>
            <div><span className="text-[#EC4899] font-semibold">nivel 3 → 4:</span> FEM vs compartimento — ~10⁶ voxels.</div>
            <div className="mt-3 text-[10px] text-[#64748B] italic">
              Solo nivel 0 → 1 está medido aquí. Los otros necesitan sus propios motores.
            </div>
          </div>
        </Section>

        <Section title="Tests">
          <div className="text-[11px] text-[#94A3B8] leading-relaxed space-y-2">
            <p>16 tests unitarios en <code className="text-white">fluctuations.test.ts</code>:</p>
            <ul className="ml-3 space-y-1">
              <li>· Welford numéricamente estable</li>
              <li>· σ/⟨T⟩ MB coincide con √(2/3N) ±15%</li>
              <li>· Ley de escala √2 al duplicar N</li>
              <li>· MD LJ genuina reproduce predicción ±40%</li>
              <li>· AR(1) recupera τ_int teórico</li>
            </ul>
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
