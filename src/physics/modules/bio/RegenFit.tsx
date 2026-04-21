/**
 * ══════════════════════════════════════════════════════════════════════
 *  RegenFit — Fit Bayesian de los datos Heber-Katz 2004
 * ══════════════════════════════════════════════════════════════════════
 *
 * Antes (en RegenReplica): parámetros (D, r) escogidos a ojo, RMSE
 * calculado pero ningún rigor estadístico.
 *
 * Aquí: posterior P(D, r | datos) calculada exhaustivamente sobre rejilla
 * 14×14 en log-espacio. Mostramos:
 *
 *   · Heatmap del log-posterior (incluye la "banana" de degeneración)
 *   · MAP marcado
 *   · Marginales 1D de D y r con CI 95%
 *   · Posterior predictive: 30 muestras → bandas de incertidumbre
 *     superpuestas a los datos publicados
 *
 * Tiempo de cómputo: ~2-4 segundos para 196 sims (1D radial RES=60).
 *
 * Esto es el primer módulo del simulador con honestidad estadística:
 * no afirma "los parámetros son X", afirma "dado el modelo, X está
 * dentro del CI 95%". Falsable.
 */

import { useEffect, useRef, useState } from 'react';
import { useAudience } from '@/physics/context';
import {
  simulateClosureRadial, gridPosterior, sampleFromPosterior, credibleInterval,
  type DataPoint, type GridPosterior,
} from '@/lib/scale-limit/fisher-kpp-fit';

// ═══════════════════════════════════════════════════════════════
// Datos publicados (mismos que RegenReplica)
// ═══════════════════════════════════════════════════════════════

const DATA_MRL: DataPoint[] = [
  { day:  0, areaFrac: 1.00 }, { day:  3, areaFrac: 0.95 },
  { day:  7, areaFrac: 0.84 }, { day: 10, areaFrac: 0.70 },
  { day: 14, areaFrac: 0.50 }, { day: 18, areaFrac: 0.32 },
  { day: 21, areaFrac: 0.20 }, { day: 24, areaFrac: 0.10 },
  { day: 28, areaFrac: 0.03 }, { day: 30, areaFrac: 0.01 },
];

const DATA_B6: DataPoint[] = [
  { day:  0, areaFrac: 1.00 }, { day:  3, areaFrac: 0.96 },
  { day:  7, areaFrac: 0.85 }, { day: 10, areaFrac: 0.75 },
  { day: 14, areaFrac: 0.65 }, { day: 18, areaFrac: 0.58 },
  { day: 21, areaFrac: 0.55 }, { day: 24, areaFrac: 0.53 },
  { day: 28, areaFrac: 0.51 }, { day: 30, areaFrac: 0.50 },
];

interface Strain {
  id: string; name: string; data: DataPoint[]; accent: string;
  scarLimit: number;
}

const STRAINS: Strain[] = [
  { id: 'mrl', name: 'MRL/MpJ', data: DATA_MRL, accent: '#4FC3F7', scarLimit: 1.0 },
  { id: 'b6',  name: 'C57BL/6', data: DATA_B6,  accent: '#EF4444', scarLimit: 0.55 },
];

// Rangos de búsqueda (log10)
const D_RANGE = { logMin: -4.5, logMax: -1.5 };   // 3e-5 to 3e-2 mm²/d
const R_RANGE = { logMin: -1.0, logMax:  1.0 };   // 0.1 to 10 /d
const N_GRID = 14;

// ═══════════════════════════════════════════════════════════════
// SVG plots
// ═══════════════════════════════════════════════════════════════

function PosteriorHeatmap({
  post, width = 320, height = 280, accent,
}: { post: GridPosterior | null; width?: number; height?: number; accent: string }) {
  const pad = { l: 50, r: 16, t: 24, b: 38 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  if (!post) {
    return (
      <svg width={width} height={height} className="bg-[#0B0F17] border border-[#1E293B] rounded-md">
        <text x={width/2} y={height/2} textAnchor="middle" fontSize={11}
          fill="#64748B" fontFamily="monospace">computando…</text>
      </svg>
    );
  }
  const nD = post.logD.length;
  const nR = post.logR.length;
  const cellW = W / nD;
  const cellH = H / nR;
  const xOf = (i: number) => pad.l + i * cellW;
  const yOf = (j: number) => pad.t + H - (j + 1) * cellH;

  // Color por p / max(p)
  let pmax = 0;
  for (let k = 0; k < post.P.length; k++) if (post.P[k] > pmax) pmax = post.P[k];

  // Hex parse for accent
  const hex = accent.replace('#', '');
  const ar = parseInt(hex.substring(0, 2), 16);
  const ag = parseInt(hex.substring(2, 4), 16);
  const ab = parseInt(hex.substring(4, 6), 16);

  const cells: { x: number; y: number; w: number; h: number; fill: string }[] = [];
  for (let i = 0; i < nD; i++) {
    for (let j = 0; j < nR; j++) {
      const p = post.P[i * nR + j] / pmax;
      const r = Math.round(20 + (ar - 20) * p);
      const g = Math.round(20 + (ag - 20) * p);
      const b = Math.round(30 + (ab - 30) * p);
      cells.push({
        x: xOf(i), y: yOf(j), w: cellW + 0.5, h: cellH + 0.5,
        fill: `rgb(${r},${g},${b})`,
      });
    }
  }
  // MAP marker
  const iMap = post.logD.findIndex(v => Math.abs(Math.pow(10, v) - post.mapD) < 1e-9);
  const jMap = post.logR.findIndex(v => Math.abs(Math.pow(10, v) - post.mapR) < 1e-9);
  const mapX = xOf(iMap) + cellW / 2;
  const mapY = yOf(jMap) + cellH / 2;

  // Ticks
  const dTicks = [-4, -3, -2];
  const rTicks = [-1, 0, 1];
  const xOfLog = (l: number) => pad.l + W * (l - D_RANGE.logMin) / (D_RANGE.logMax - D_RANGE.logMin);
  const yOfLog = (l: number) => pad.t + H * (1 - (l - R_RANGE.logMin) / (R_RANGE.logMax - R_RANGE.logMin));

  return (
    <svg width={width} height={height} className="bg-[#0B0F17] border border-[#1E293B] rounded-md">
      <text x={width / 2} y={14} textAnchor="middle" fontSize={11}
        fill="#CBD5E1" fontFamily="monospace">P(D, r | datos)</text>
      {cells.map((c, k) => (
        <rect key={k} x={c.x} y={c.y} width={c.w} height={c.h} fill={c.fill} />
      ))}
      {/* MAP */}
      <circle cx={mapX} cy={mapY} r={5} fill="none" stroke="#FBBF24" strokeWidth="2" />
      <line x1={mapX-7} x2={mapX+7} y1={mapY} y2={mapY} stroke="#FBBF24" strokeWidth="1" />
      <line x1={mapX} x2={mapX} y1={mapY-7} y2={mapY+7} stroke="#FBBF24" strokeWidth="1" />
      {/* Ticks */}
      {dTicks.map(d => (
        <g key={d}>
          <line x1={xOfLog(d)} x2={xOfLog(d)} y1={pad.t + H} y2={pad.t + H + 3}
            stroke="#64748B" />
          <text x={xOfLog(d)} y={pad.t + H + 14} textAnchor="middle"
            fontSize={9} fill="#64748B" fontFamily="monospace">10^{d}</text>
        </g>
      ))}
      {rTicks.map(r => (
        <g key={r}>
          <line x1={pad.l - 3} x2={pad.l} y1={yOfLog(r)} y2={yOfLog(r)} stroke="#64748B" />
          <text x={pad.l - 6} y={yOfLog(r) + 3} textAnchor="end"
            fontSize={9} fill="#64748B" fontFamily="monospace">10^{r}</text>
        </g>
      ))}
      <text x={pad.l + W / 2} y={height - 6} textAnchor="middle"
        fontSize={10} fill="#94A3B8" fontFamily="monospace">D (mm²/día)</text>
      <text x={14} y={pad.t + H / 2} textAnchor="middle"
        fontSize={10} fill="#94A3B8" fontFamily="monospace"
        transform={`rotate(-90 14 ${pad.t + H / 2})`}>r (/día)</text>
    </svg>
  );
}

function PosteriorPredictive({
  post, data, currentScarLimit, accent, width = 540, height = 280,
}: {
  post: GridPosterior | null; data: DataPoint[]; currentScarLimit: number;
  accent: string; width?: number; height?: number;
}) {
  const pad = { l: 50, r: 16, t: 24, b: 38 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const tMax = 32;
  const xOf = (d: number) => pad.l + W * (d / tMax);
  const yOf = (a: number) => pad.t + H * (1 - a);
  const days = Array.from({ length: 33 }, (_, i) => i);

  // Posterior predictive curves
  const ppCurves: DataPoint[][] = [];
  if (post) {
    const samples = sampleFromPosterior(post, 30);
    for (const s of samples) {
      ppCurves.push(simulateClosureRadial(s.D, s.r, days, currentScarLimit));
    }
  }

  // MAP curve
  const mapCurve: DataPoint[] = post
    ? simulateClosureRadial(post.mapD, post.mapR, days, currentScarLimit)
    : [];

  const dayTicks = [0, 7, 14, 21, 28];
  const aTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg width={width} height={height} className="bg-[#0B0F17] border border-[#1E293B] rounded-md">
      <text x={width / 2} y={14} textAnchor="middle" fontSize={11}
        fill="#CBD5E1" fontFamily="monospace">
        Posterior predictive · datos vs modelo
      </text>
      {dayTicks.map(d => (
        <g key={d}>
          <line x1={xOf(d)} x2={xOf(d)} y1={pad.t} y2={pad.t + H}
            stroke="#1E293B" strokeDasharray="2 3" />
          <text x={xOf(d)} y={pad.t + H + 14} textAnchor="middle"
            fontSize={9} fill="#64748B" fontFamily="monospace">{d}</text>
        </g>
      ))}
      {aTicks.map(a => (
        <g key={a}>
          <line x1={pad.l} x2={pad.l + W} y1={yOf(a)} y2={yOf(a)}
            stroke="#1E293B" strokeDasharray="2 3" />
          <text x={pad.l - 6} y={yOf(a) + 3} textAnchor="end"
            fontSize={9} fill="#64748B" fontFamily="monospace">{(a * 100).toFixed(0)}%</text>
        </g>
      ))}
      {/* Posterior predictive curves */}
      {ppCurves.map((c, k) => (
        <path key={k}
          d={c.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.day)} ${yOf(p.areaFrac)}`).join(' ')}
          stroke={accent} strokeWidth="0.7" fill="none" opacity="0.25" />
      ))}
      {/* MAP curve */}
      {mapCurve.length > 0 && (
        <path d={mapCurve.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.day)} ${yOf(p.areaFrac)}`).join(' ')}
          stroke={accent} strokeWidth="2.5" fill="none" />
      )}
      {/* Datos publicados */}
      {data.map((p, i) => (
        <circle key={i} cx={xOf(p.day)} cy={yOf(p.areaFrac)}
          r={4} fill="#FBBF24" stroke="#0B0F17" strokeWidth="1" />
      ))}
      <text x={pad.l + W / 2} y={height - 6} textAnchor="middle"
        fontSize={10} fill="#94A3B8" fontFamily="monospace">días</text>
      <text x={14} y={pad.t + H / 2} textAnchor="middle"
        fontSize={10} fill="#94A3B8" fontFamily="monospace"
        transform={`rotate(-90 14 ${pad.t + H / 2})`}>área restante</text>

      {/* Leyenda */}
      <g transform={`translate(${pad.l + W - 165}, ${pad.t + 6})`}>
        <rect x={0} y={0} width={160} height={50} fill="#0B0F17" stroke="#1E293B" rx="3" opacity="0.95" />
        <circle cx={14} cy={14} r={4} fill="#FBBF24" />
        <text x={24} y={17} fontSize={9} fill="#CBD5E1" fontFamily="monospace">datos Heber-Katz</text>
        <line x1={6} x2={22} y1={28} y2={28} stroke={accent} strokeWidth="2.5" />
        <text x={24} y={31} fontSize={9} fill="#CBD5E1" fontFamily="monospace">MAP</text>
        <line x1={6} x2={22} y1={42} y2={42} stroke={accent} strokeWidth="0.7" opacity="0.4" />
        <text x={24} y={45} fontSize={9} fill="#CBD5E1" fontFamily="monospace">30 muestras posterior</text>
      </g>
    </svg>
  );
}

function MarginalPlot({
  marg, axis, ci, label, color, width = 230, height = 110,
}: {
  marg: Float64Array | null; axis: Float64Array | null;
  ci: { low: number; high: number; median: number } | null;
  label: string; color: string; width?: number; height?: number;
}) {
  const pad = { l: 32, r: 8, t: 18, b: 22 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  if (!marg || !axis) {
    return (
      <svg width={width} height={height} className="bg-[#0B0F17] border border-[#1E293B] rounded-md">
        <text x={width/2} y={height/2} textAnchor="middle" fontSize={10}
          fill="#64748B" fontFamily="monospace">…</text>
      </svg>
    );
  }
  let ymax = 0;
  for (const v of marg) if (v > ymax) ymax = v;
  const xMin = axis[0], xMax = axis[axis.length - 1];
  const xOf = (l: number) => pad.l + W * (l - xMin) / (xMax - xMin);
  const yOf = (p: number) => pad.t + H * (1 - p / Math.max(ymax, 1e-9));
  const barW = W / axis.length;
  return (
    <svg width={width} height={height} className="bg-[#0B0F17] border border-[#1E293B] rounded-md">
      <text x={pad.l} y={12} fontSize={10} fill="#94A3B8" fontFamily="monospace">{label}</text>
      {/* CI band */}
      {ci && (
        <rect x={xOf(ci.low)} y={pad.t} width={xOf(ci.high) - xOf(ci.low)} height={H}
          fill={color} opacity="0.1" />
      )}
      {/* Bars */}
      {Array.from(axis).map((a, i) => (
        <rect key={i} x={xOf(a) - barW/2} y={yOf(marg[i])}
          width={barW + 0.5} height={pad.t + H - yOf(marg[i])}
          fill={color} opacity="0.85" />
      ))}
      {/* Median line */}
      {ci && (
        <line x1={xOf(ci.median)} x2={xOf(ci.median)} y1={pad.t} y2={pad.t + H}
          stroke="#FBBF24" strokeWidth="2" />
      )}
      <text x={pad.l} y={height - 5} fontSize={8} fill="#64748B" fontFamily="monospace">
        {xMin.toFixed(1)}
      </text>
      <text x={pad.l + W} y={height - 5} textAnchor="end" fontSize={8}
        fill="#64748B" fontFamily="monospace">{xMax.toFixed(1)}</text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// Módulo
// ═══════════════════════════════════════════════════════════════

function fmt(x: number, d = 2) { return isFinite(x) ? x.toFixed(d) : '—'; }

export default function RegenFit() {
  const { audience } = useAudience();
  const [strainId, setStrainId] = useState<string>('mrl');
  const strain = STRAINS.find(s => s.id === strainId)!;
  const [sigma, setSigma] = useState(0.04);
  const [post, setPost] = useState<GridPosterior | null>(null);
  const [computing, setComputing] = useState(false);
  const [computeMs, setComputeMs] = useState(0);
  const cancelRef = useRef(false);

  const runFit = async () => {
    if (computing) return;
    setComputing(true);
    setPost(null);
    cancelRef.current = false;
    await new Promise(r => setTimeout(r, 30));
    const t0 = performance.now();
    const p = gridPosterior(strain.data, D_RANGE, R_RANGE, N_GRID, N_GRID, sigma, strain.scarLimit);
    const t1 = performance.now();
    setComputeMs(t1 - t0);
    setPost(p);
    setComputing(false);
  };

  useEffect(() => { runFit(); /* eslint-disable-next-line */ }, [strainId, sigma]);

  const ciD = post ? credibleInterval(post.margD, post.logD, 0.95) : null;
  const ciR = post ? credibleInterval(post.margR, post.logR, 0.95) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full min-h-0 overflow-hidden">
      <div className="relative min-h-0 overflow-auto p-6 flex flex-col items-center justify-start gap-3"
        style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}>

        <div className="text-center mb-1">
          <div className="text-[10px] uppercase tracking-widest text-[#64748B] font-mono">
            Inferencia bayesiana de parámetros
          </div>
          <div className="text-[16px] text-[#CBD5E1] font-semibold mt-1">
            Posterior P(D, r | datos Heber-Katz 2004)
          </div>
          <div className="text-[11px] text-[#94A3B8] mt-1 max-w-xl">
            Rejilla 14×14 sobre log(D) ∈ [−4.5, −1.5], log(r) ∈ [−1, 1].
            Likelihood Gaussiana, prior log-uniforme.
          </div>
        </div>

        <div className="flex gap-3 flex-wrap justify-center items-start">
          <PosteriorHeatmap post={post} accent={strain.accent} />
          <PosteriorPredictive post={post} data={strain.data}
            currentScarLimit={strain.scarLimit} accent={strain.accent} />
        </div>

        <div className="flex gap-3 flex-wrap justify-center">
          <MarginalPlot marg={post?.margD ?? null} axis={post?.logD ?? null} ci={ciD}
            label="marginal log₁₀ D" color={strain.accent} />
          <MarginalPlot marg={post?.margR ?? null} axis={post?.logR ?? null} ci={ciR}
            label="marginal log₁₀ r" color={strain.accent} />
        </div>

        <div className="rounded-lg border border-[#1E293B] bg-[#0B0F17] p-3 flex flex-wrap gap-4 items-center font-mono text-[11px]">
          <div>
            <div className="text-[#64748B] text-[9px] uppercase tracking-widest">D MAP</div>
            <div className="text-white text-[13px]">
              {post ? post.mapD.toExponential(2) : '—'}
            </div>
          </div>
          <div>
            <div className="text-[#64748B] text-[9px] uppercase tracking-widest">r MAP</div>
            <div style={{color: strain.accent}} className="text-[13px] font-semibold">
              {post ? fmt(post.mapR, 2) : '—'} /día
            </div>
          </div>
          <div>
            <div className="text-[#64748B] text-[9px] uppercase tracking-widest">r 95% CI</div>
            <div className="text-[#FBBF24] text-[13px]">
              {ciR ? `[${fmt(Math.pow(10, ciR.low), 2)}, ${fmt(Math.pow(10, ciR.high), 2)}]` : '—'}
            </div>
          </div>
          <div>
            <div className="text-[#64748B] text-[9px] uppercase tracking-widest">c = 2√(rD)</div>
            <div className="text-white text-[13px]">
              {post ? fmt(2 * Math.sqrt(post.mapD * post.mapR), 3) : '—'} mm/día
            </div>
          </div>
          <div>
            <div className="text-[#64748B] text-[9px] uppercase tracking-widest">cómputo</div>
            <div className="text-[#94A3B8] text-[13px]">{fmt(computeMs / 1000, 2)} s</div>
          </div>
        </div>
      </div>

      <aside className="border-l border-[#1E293B] bg-[#0B0F17] overflow-y-auto">
        <Section title="Cepa">
          <div className="grid grid-cols-1 gap-1.5">
            {STRAINS.map(s => (
              <button key={s.id} onClick={() => setStrainId(s.id)}
                data-testid={`preset-${s.id}`}
                className="text-left px-3 py-2 rounded-md border text-[12px] transition"
                style={{
                  borderColor: strainId === s.id ? s.accent : '#1E293B',
                  background: strainId === s.id ? `${s.accent}22` : 'transparent',
                  color: strainId === s.id ? '#fff' : '#94A3B8',
                }}>
                <div className="font-semibold">{s.name}</div>
                <div className="text-[10px] mt-0.5 opacity-80">{s.data.length} puntos · scarLimit {s.scarLimit}</div>
              </button>
            ))}
          </div>
        </Section>

        {audience === 'child' ? (
          <Section title="Lo que ves">
            <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
              <p>El mapa de calor (izquierda) muestra qué combinaciones (D, r) son compatibles con los datos.</p>
              <p>La cruz amarilla = la mejor combinación.</p>
              <p>Las líneas tenues a la derecha = predicciones con muchas (D, r) sacadas del mapa. Si todas pasan cerca de los puntos amarillos, el modelo cuadra.</p>
              <p>Las barras de abajo dicen "¿qué tan seguros estamos de cada parámetro?".</p>
            </div>
          </Section>
        ) : (
          <Section title="Método">
            <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
              <div className="text-white">P(θ|d) ∝ P(d|θ)·P(θ)</div>
              <div className="mt-1 text-[#94A3B8]">P(d|θ) = Π N(d_i; model(t_i; θ), σ²)</div>
              <div className="text-[#94A3B8]">P(θ) = log-uniforme en [10⁻⁴·⁵, 10⁻¹·⁵] × [10⁻¹, 10¹]</div>
              <div className="mt-2 text-[#FBBF24]">14×14 = 196 sims · ~3-5 s</div>
            </div>
          </Section>
        )}

        {audience === 'researcher' && (
          <Section title="Hiperparámetros">
            <Slider label="σ obs (ruido)" v={sigma * 100} min={1} max={15} step={0.5}
              on={v => setSigma(v / 100)} />
            <div className="mt-2 text-[10px] text-[#64748B]">
              σ = {(sigma * 100).toFixed(1)}% del rango. Mayor σ → posterior más amplia, menor RMSE penaliza menos.
            </div>
          </Section>
        )}

        <Section title="Lo que esto resuelve">
          <div className="text-[11px] text-[#CBD5E1] leading-relaxed space-y-1">
            <p>· Reemplaza "parámetros a ojo" por intervalos cuantitativos.</p>
            <p>· Detecta degeneración (la "banana" rD = const).</p>
            <p>· Muestra la incertidumbre genuina del modelo, no solo el ajuste.</p>
            <p>· Predicciones ahora son falsables: el modelo afirma que con probabilidad 95%, r ∈ [low, high].</p>
          </div>
        </Section>

        <Section title="Lo que NO resuelve (honesto)">
          <div className="text-[11px] text-[#94A3B8] leading-relaxed space-y-1">
            <p>· σ es un hiperparámetro elegido — debería ser otro parámetro a inferir (perfil empírico).</p>
            <p>· La degeneración no se rompe sin más datos (e.g. perfil espacial del frente).</p>
            <p>· Asume modelo Fisher-KPP correcto — model misspecification no se detecta solo con CI.</p>
            <p>· Datos digitalizados a ojo de Fig 2 — error sistemático no contabilizado.</p>
          </div>
        </Section>

        <Section title="Tests">
          <div className="text-[11px] text-[#94A3B8] leading-relaxed">
            <p>11 tests en <code className="text-white">fisher-kpp-fit.test.ts</code>:</p>
            <ul className="ml-3 space-y-1 mt-1">
              <li>· Sim radial: día 0 → 1.0; r=0 → cierre lento</li>
              <li>· logLik máximo en (D*, r*) sintético</li>
              <li>· CI 95% del marginal r contiene r*</li>
              <li>· Predicción al MAP RMSE &lt; 5%</li>
              <li>· Marginales suman 1; samples reproducen media</li>
            </ul>
          </div>
        </Section>

        <Section title="Próximo paso">
          <div className="text-[11px] text-[#CBD5E1] leading-relaxed italic">
            Romper la degeneración: añadir UN observable adicional que dependa
            de D y r de forma distinta. P.ej. el ancho del frente (depende
            ∝ √(D/r)) además de la velocidad (∝ √(rD)). Eso convierte la
            "banana" en un punto.
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
        <span className="text-white">{v.toFixed(1)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={e => on(Number(e.target.value))} className="w-full" />
    </div>
  );
}
