/**
 * ThalerLab — laboratorio del premio 2017 (Richard Thaler).
 *
 * El click: el default cambia todo. Sin tocar la ley, sin gastar un peso,
 * solo cambiando qué opción viene marcada de fábrica, los gobiernos han
 * triplicado tasas de ahorro, duplicado donación de órganos y aumentado
 * inscripciones a seguros.
 *
 * Modelo REAL implementado:
 *
 * 1) STATUS QUO BIAS — probabilidad de quedarse con el default:
 *    P(default) = 1 / (1 + exp(−(bias + δ)))
 *    donde δ es el "costo" percibido de cambiar (fricción del formulario).
 *
 * 2) LOSS AVERSION (Kahneman-Tversky, 1979; adoptado por Thaler):
 *    v(x) = x^α          si x ≥ 0  (ganancia)
 *    v(x) = −λ·(−x)^α   si x < 0  (pérdida)
 *    λ ≈ 2.25 empíricamente (pierdes el doble que ganas en valor subjetivo).
 *
 * 3) La simulación corre N = 200 agentes con sesgo heterogéneo
 *    (bias_i ~ Normal(μ_bias, σ)) y fricción de cambio aleatoria.
 *    Al cambiar el default, cada agente decide con la distribución opuesta.
 *
 * Controles:
 *   • Tipo de default: Opt-In (tienes que pedir) vs Opt-Out (ya estás dentro)
 *   • Status quo bias μ: qué tan renuente es la gente a cambiar (0..5)
 *   • Fricción del formulario: qué tan difícil es cambiarlo (0..4)
 *   • Mostrar mental accounting: valor subjetivo vs real (λ y α ajustables)
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/* ─── Dimensiones ─────────────────────────────────────────────────── */
const W = 820;
const H = 380;
const N_AGENTS = 200;         // personas en la simulación
const AGENT_R = 5;

/* ─── Modelo ──────────────────────────────────────────────────────── */
/** Logistic para P(quedarse con el default) */
function pStatusQuo(bias: number, friction: number): number {
  const logit = bias + friction;
  return 1 / (1 + Math.exp(-logit));
}

/** Valor subjetivo de Kahneman-Tversky / Thaler Mental Accounting */
function prospectValue(x: number, lambda: number, alpha: number): number {
  if (x >= 0) return Math.pow(x, alpha);
  return -lambda * Math.pow(-x, alpha);
}

/* ─── RNG determinista (LCG simple, no Node) ─────────────────────── */
function makeLCG(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** Box-Muller con nuestro RNG */
function normalRNG(rng: () => number, mu: number, sigma: number): number {
  const u1 = Math.max(1e-10, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + sigma * z;
}

/* ─── Tipos ──────────────────────────────────────────────────────── */
interface Agent {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  bias: number;           // sesgo status-quo individual
  friction: number;       // fricción individual
  adopted: boolean;       // ¿tiene la conducta "deseada"? (ahorrar, donar, etc.)
  color: string;
  animProg: number;       // 0..1 para interpolación visual
}

interface SimState {
  agents: Agent[];
  frame: number;
}

type TabMode = 'nudge' | 'prospect';

/* ─── Parámetros ──────────────────────────────────────────────────── */
interface Params {
  optOut: boolean;        // true = opt-out (default = sí)
  muBias: number;         // sesgo status-quo promedio (0..5)
  friction: number;       // dificultad de cambiar (0..4)
  lambda: number;         // aversión a pérdidas (1..4)
  alpha: number;          // curvatura (0.3..1)
  tab: TabMode;
}

const DEFAULTS: Params = {
  optOut: false,
  muBias: 2.0,
  friction: 1.2,
  lambda: 2.25,
  alpha: 0.88,
  tab: 'nudge',
};

/* ─── Inicializar agentes ─────────────────────────────────────────── */
function buildAgents(rng: () => number, params: Params): Agent[] {
  const agents: Agent[] = [];
  for (let i = 0; i < N_AGENTS; i++) {
    const bias_i = Math.max(0, normalRNG(rng, params.muBias, 1.0));
    const fric_i = Math.max(0, normalRNG(rng, params.friction, 0.5));
    const pAdopt = params.optOut
      ? pStatusQuo(bias_i, fric_i)        // opt-out: por default adoptan, se quedan
      : 1 - pStatusQuo(bias_i, fric_i);   // opt-in: tienen que hacer el esfuerzo

    const adopted = rng() < pAdopt;

    // posición visual: adoptados a la izquierda, no-adoptados a la derecha
    const col = Math.floor(i / 20);
    const row = i % 20;
    const baseX = 48 + col * 28;
    const baseY = 55 + row * 15;

    agents.push({
      x: baseX + (rng() - 0.5) * 4,
      y: baseY + (rng() - 0.5) * 4,
      targetX: baseX,
      targetY: baseY,
      bias: bias_i,
      friction: fric_i,
      adopted,
      color: adopted ? '#34D399' : '#EF4444',
      animProg: 1,
    });
  }
  return agents;
}

/* ─── Componentes auxiliares React ───────────────────────────────── */
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[19px] font-bold font-mono" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt, hint }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[12px] font-mono text-[#FDB813]">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={e => onChange(Number(e.target.value))} className="w-full accent-[#D946EF]" />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}

/* ─── Componente principal ───────────────────────────────────────── */
export default function ThalerLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS });
  const simRef = useRef<SimState>({ agents: [], frame: 0 });
  const rafRef = useRef<number>(0);

  const [optOut, setOptOut] = useState(DEFAULTS.optOut);
  const [muBias, setMuBias] = useState(DEFAULTS.muBias);
  const [friction, setFriction] = useState(DEFAULTS.friction);
  const [lambda, setLambda] = useState(DEFAULTS.lambda);
  const [alpha, setAlpha] = useState(DEFAULTS.alpha);
  const [tab, setTab] = useState<TabMode>(DEFAULTS.tab);
  const [stats, setStats] = useState({ adopted: 0, rate: 0 });

  /* Sincronizar params ref */
  useEffect(() => {
    paramsRef.current = { optOut, muBias, friction, lambda, alpha, tab };
  }, [optOut, muBias, friction, lambda, alpha, tab]);

  /* Reconstruir agentes cuando cambian parámetros de default/sesgo/fricción */
  const rebuild = useCallback(() => {
    const rng = makeLCG(42);
    simRef.current.agents = buildAgents(rng, paramsRef.current);
  }, []);

  useEffect(() => { rebuild(); }, [optOut, muBias, friction, rebuild]);

  /* Loop de animación */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    // Inicializar agentes
    rebuild();

    function drawNudgeTab() {
      if (!ctx) return;
      const p = paramsRef.current;
      const sim = simRef.current;
      const agents = sim.agents;

      /* Fondo */
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#07090F');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      /* Barra de estadísticas */
      const adopted = agents.filter(a => a.adopted).length;
      const rate = adopted / agents.length;

      /* Línea divisoria de zonas */
      const divX = 380;

      /* Zona izquierda: adoptaron */
      ctx.fillStyle = 'rgba(52,211,153,0.05)';
      ctx.fillRect(30, 40, divX - 40, H - 70);
      ctx.strokeStyle = 'rgba(52,211,153,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(30, 40, divX - 40, H - 70);

      /* Zona derecha: no adoptaron */
      ctx.fillStyle = 'rgba(239,68,68,0.05)';
      ctx.fillRect(divX + 10, 40, W - divX - 40, H - 70);
      ctx.strokeStyle = 'rgba(239,68,68,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(divX + 10, 40, W - divX - 40, H - 70);

      /* Etiquetas de zona */
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#34D399';
      ctx.fillText(p.optOut ? 'SÍ DONARON / AHORRARON' : 'ACTIVAMENTE INSCRIBIERON', (30 + divX) / 2, 56);
      ctx.fillStyle = '#EF4444';
      ctx.fillText(p.optOut ? 'SE SALIERON (opt-out activo)' : 'NUNCA HICIERON EL TRÁMITE', (divX + 10 + W - 40) / 2, 56);

      /* Agentes */
      const adoptedAgents = agents.filter(a => a.adopted);
      const nonAdopted = agents.filter(a => !a.adopted);

      // Redibujar posiciones para separar adoptados/no-adoptados visualmente
      const rng2 = makeLCG(99);
      const zones: { agents: Agent[]; startX: number; endX: number; startY: number; endY: number }[] = [
        { agents: adoptedAgents, startX: 36, endX: divX - 14, startY: 62, endY: H - 42 },
        { agents: nonAdopted, startX: divX + 16, endX: W - 36, startY: 62, endY: H - 42 },
      ];

      for (const zone of zones) {
        const cols = Math.ceil(Math.sqrt(zone.agents.length * (zone.endX - zone.startX) / (zone.endY - zone.startY)));
        const rows = Math.ceil(zone.agents.length / cols);
        const dx = (zone.endX - zone.startX) / Math.max(1, cols);
        const dy = (zone.endY - zone.startY) / Math.max(1, rows);
        zone.agents.forEach((ag, idx) => {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const tx = zone.startX + (col + 0.5) * dx + (rng2() - 0.5) * 3;
          const ty = zone.startY + (row + 0.5) * dy + (rng2() - 0.5) * 3;
          ag.targetX = tx;
          ag.targetY = ty;
        });
      }

      /* Dibujar agentes */
      for (const ag of agents) {
        // Suave lerp hacia target
        ag.x += (ag.targetX - ag.x) * 0.08;
        ag.y += (ag.targetY - ag.y) * 0.08;

        ctx.save();
        ctx.shadowColor = ag.adopted ? '#34D399' : '#EF4444';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(ag.x, ag.y, AGENT_R, 0, Math.PI * 2);
        ctx.fillStyle = ag.color;
        ctx.fill();
        ctx.restore();
      }

      /* Barra de porcentaje */
      const barX = 30, barY = H - 28, barW = W - 60, barH = 10;
      ctx.fillStyle = 'rgba(239,68,68,0.3)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#34D399';
      ctx.fillRect(barX, barY, barW * rate, barH);

      ctx.textAlign = 'center';
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillStyle = '#E2E8F0';
      const pct = (rate * 100).toFixed(1);
      ctx.fillText(`${pct}% adoptaron — `, W / 2, barY - 6);

      /* Etiqueta del modo */
      ctx.textAlign = 'right';
      ctx.font = '11px ui-sans-serif, system-ui';
      ctx.fillStyle = p.optOut ? '#D946EF' : '#94A3B8';
      ctx.fillText(p.optOut ? '🟣 OPT-OUT activo (default = SÍ)' : '⚪ OPT-IN activo (default = NO)', W - 36, H - 34);

      if (sim.frame % 12 === 0) {
        setStats({ adopted, rate });
      }
    }

    function drawProspectTab() {
      if (!ctx) return;
      const p = paramsRef.current;

      /* Fondo */
      ctx.fillStyle = '#0B0F17';
      ctx.fillRect(0, 0, W, H);

      /* Coordenadas del gráfico */
      const gLeft = 70, gRight = W - 50, gTop = 30, gBottom = H - 60;
      const gW = gRight - gLeft, gH = gBottom - gTop;
      const originX = gLeft + gW / 2;
      const originY = gTop + gH / 2;

      /* Ejes */
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      // eje X
      ctx.beginPath();
      ctx.moveTo(gLeft, originY);
      ctx.lineTo(gRight, originY);
      ctx.stroke();
      // eje Y
      ctx.beginPath();
      ctx.moveTo(originX, gTop);
      ctx.lineTo(originX, gBottom);
      ctx.stroke();

      /* Marcas de eje X */
      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      for (let x = -4; x <= 4; x += 2) {
        const px = originX + (x / 5) * (gW / 2);
        ctx.beginPath();
        ctx.moveTo(px, originY - 3);
        ctx.lineTo(px, originY + 3);
        ctx.stroke();
        if (x !== 0) ctx.fillText(String(x * 25) + '%', px, originY + 14);
      }

      /* Curva de valor de Kahneman-Tversky (Thaler la aplicó a mental accounting) */
      const xToCanvas = (x: number) => originX + (x / 5) * (gW / 2);
      const vToCanvas = (v: number) => originY - (v / (Math.pow(5, p.alpha) * p.lambda)) * (gH * 0.44);

      // Curva de GANANCIAS (derecha)
      ctx.beginPath();
      let first = true;
      for (let i = 0; i <= 80; i++) {
        const x = (i / 80) * 5;
        const v = prospectValue(x, p.lambda, p.alpha);
        const px = xToCanvas(x);
        const py = vToCanvas(v);
        if (py < gTop - 5 || py > gBottom + 5) { first = true; continue; }
        if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Curva de PÉRDIDAS (izquierda)
      ctx.beginPath();
      first = true;
      for (let i = 0; i <= 80; i++) {
        const x = -(i / 80) * 5;
        const v = prospectValue(x, p.lambda, p.alpha);
        const px = xToCanvas(x);
        const py = vToCanvas(v);
        if (py < gTop - 5 || py > gBottom + 5) { first = true; continue; }
        if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      /* Línea diagonal de referencia (utilidad lineal) */
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xToCanvas(-5), vToCanvas(-Math.pow(5, p.alpha) * p.lambda));
      ctx.lineTo(xToCanvas(5), vToCanvas(Math.pow(5, p.alpha)));
      ctx.stroke();
      ctx.setLineDash([]);

      /* Marcador interactivo: punto en x = 2 (ganancia) vs x = -2 (pérdida equivalente) */
      const gain2 = prospectValue(2, p.lambda, p.alpha);
      const loss2 = prospectValue(-2, p.lambda, p.alpha);

      // Punto de ganancia
      ctx.save();
      ctx.shadowColor = '#34D399'; ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(xToCanvas(2), vToCanvas(gain2), 6, 0, Math.PI * 2);
      ctx.fillStyle = '#34D399';
      ctx.fill();
      ctx.restore();

      // Punto de pérdida
      ctx.save();
      ctx.shadowColor = '#EF4444'; ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(xToCanvas(-2), vToCanvas(loss2), 6, 0, Math.PI * 2);
      ctx.fillStyle = '#EF4444';
      ctx.fill();
      ctx.restore();

      /* Etiquetas de puntos */
      ctx.textAlign = 'left';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.fillStyle = '#34D399';
      ctx.fillText(`+50% → valor +${gain2.toFixed(2)}`, xToCanvas(2) + 8, vToCanvas(gain2) + 4);
      ctx.fillStyle = '#EF4444';
      ctx.fillText(`−50% → valor −${(-loss2).toFixed(2)}`, xToCanvas(-2) + 8, vToCanvas(loss2) + 4);

      /* Ratio aversión */
      const ratio = (-loss2) / gain2;
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px ui-sans-serif, system-ui';
      ctx.fillStyle = '#D946EF';
      ctx.fillText(`perder duele ${ratio.toFixed(2)}× más que ganar alegra`, W / 2, gBottom + 36);

      /* Leyenda nudge: por qué el default importa */
      ctx.textAlign = 'right';
      ctx.font = '11px ui-sans-serif, system-ui';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('La pérdida de "salirte del default" duele más que la ganancia — por eso nadie la cambia.', W - 50, gBottom + 52);

      /* Etiquetas de ejes */
      ctx.textAlign = 'center';
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillStyle = '#64748B';
      ctx.fillText('cambio en resultado (%)', originX, gBottom + 18);
      ctx.save();
      ctx.translate(gLeft - 44, originY);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('valor subjetivo', 0, 0);
      ctx.restore();

      /* Etiqueta curvas */
      ctx.textAlign = 'left';
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillStyle = '#34D399';
      ctx.fillText('ganancias (v = x^α)', xToCanvas(0.3), gTop + 20);
      ctx.fillStyle = '#EF4444';
      ctx.fillText('pérdidas (v = −λ·(−x)^α)', xToCanvas(-4.8), gTop + 20);
    }

    function loop() {
      const p = paramsRef.current;
      if (p.tab === 'nudge') {
        drawNudgeTab();
      } else {
        drawProspectTab();
      }
      simRef.current.frame++;
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [rebuild]);

  /* Insights contextuales */
  const adopted = stats.adopted;
  const rate = stats.rate;
  let insight = '';
  if (tab === 'nudge') {
    if (!optOut && rate < 0.2) {
      insight = 'Con opt-in, menos del 20% actúa. La gente necesita hacer el trámite: la inercia gana. Así pasan los años sin ahorrar para el retiro.';
    } else if (optOut && rate > 0.7) {
      insight = 'Con opt-out, la mayoría se queda. Nadie quitó la opción de salirse — pero casi nadie lo hace. El gobierno del Reino Unido subió donantes de órganos al 80% solo cambiando ese default.';
    } else if (optOut) {
      insight = 'El opt-out ya está activo. Mira la diferencia con opt-in: sin tocar la ley, sin gastar un peso, solo cambiando qué casilla viene marcada.';
    } else {
      insight = 'Activa el OPT-OUT y compara. España tiene 10× más donantes que Alemania solo por ese cambio. Es el nudge más poderoso conocido.';
    }
  } else {
    insight = `Con λ = ${lambda.toFixed(2)} y α = ${alpha.toFixed(2)}, perder el equivalente a tu default duele mucho más que la ganancia de salirte. Por eso la gente no cambia la opción aunque le convenga — su cerebro sobrevalora la pérdida del cambio.`;
  }

  const totalAdopted = tab === 'nudge' ? adopted : 0;
  const totalRate = tab === 'nudge' ? rate : 0;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        <div className="space-y-4">

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setTab('nudge')}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${tab === 'nudge' ? 'border-[#D946EF]/60 bg-[#D946EF]/15 text-[#D946EF]' : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'}`}>
              Nudge: el default
            </button>
            <button
              onClick={() => setTab('prospect')}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${tab === 'prospect' ? 'border-[#D946EF]/60 bg-[#D946EF]/15 text-[#D946EF]' : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'}`}>
              Mental Accounting
            </button>
          </div>

          {/* Canvas */}
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Control principal: default toggle */}
          {tab === 'nudge' && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setOptOut(false)}
                className={`px-4 py-2 text-[13px] font-mono rounded-lg border transition ${
                  !optOut ? 'border-[#EF4444]/60 bg-[#EF4444]/10 text-[#EF4444]' : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
                }`}>
                OPT-IN — hay que pedirlo
              </button>
              <button
                onClick={() => setOptOut(true)}
                className={`px-4 py-2 text-[13px] font-mono rounded-lg border transition ${
                  optOut ? 'border-[#D946EF]/60 bg-[#D946EF]/10 text-[#D946EF]' : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
                }`}>
                OPT-OUT — ya estás dentro
              </button>
              <div className="text-[11px] text-[#475569] font-mono ml-auto">
                {N_AGENTS} personas simuladas
              </div>
            </div>
          )}

          {/* Stats */}
          {tab === 'nudge' && (
            <div className="grid grid-cols-3 gap-3">
              <Stat label="adoptaron" value={`${totalAdopted}`} accent="#34D399" />
              <Stat label="tasa de adopción" value={`${(totalRate * 100).toFixed(1)}%`}
                    accent={totalRate > 0.5 ? '#34D399' : '#EF4444'} />
              <Stat label="default" value={optOut ? 'Opt-Out' : 'Opt-In'}
                    accent={optOut ? '#D946EF' : '#94A3B8'} />
            </div>
          )}

          {tab === 'prospect' && (
            <div className="grid grid-cols-3 gap-3">
              <Stat label="aversión pérdida λ" value={`${lambda.toFixed(2)}×`} accent="#EF4444" />
              <Stat label="curvatura α" value={`${alpha.toFixed(2)}`} accent="#FDB813" />
              <Stat label="ratio dolor/alegría" value={`${(lambda * Math.pow(2, alpha - 1)).toFixed(2)}×`} accent="#D946EF" />
            </div>
          )}

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#D946EF] font-mono mb-2">✦ ¿Qué estás viendo?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* Panel de controles */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ Ajusta el nudge</div>

          {tab === 'nudge' && (
            <>
              <Slider
                label="Sesgo status quo (μ)"
                value={muBias}
                min={0} max={5} step={0.05}
                onChange={setMuBias}
                fmt={v => v < 1 ? 'bajo' : v < 2.5 ? 'medio' : 'alto'}
                hint="Qué tan fuerte es la tendencia a no cambiar nada. 2.0 = promedio real medido en experimentos."
              />
              <Slider
                label="Fricción del formulario"
                value={friction}
                min={0} max={4} step={0.05}
                onChange={setFriction}
                fmt={v => v < 0.5 ? 'mínima' : v < 2 ? 'moderada' : 'alta'}
                hint="Dificultad de hacer el cambio: 0 = 1 clic, 4 = 10 páginas de PDF + notaría."
              />
              <div className="bg-[#0D1117] border border-[#1E293B] rounded-md p-3 text-[11px] text-[#64748B] leading-relaxed">
                <span className="text-[#D946EF] font-mono">P(default) = σ(sesgo + fricción)</span><br />
                La probabilidad de quedarse con el default crece con el sesgo y la fricción. El nudge invierte quién tiene que cargar el esfuerzo.
              </div>
            </>
          )}

          {tab === 'prospect' && (
            <>
              <Slider
                label="Aversión a pérdidas (λ)"
                value={lambda}
                min={1.0} max={4.0} step={0.05}
                onChange={setLambda}
                fmt={v => `${v.toFixed(2)}×`}
                hint="λ = 2.25 es el valor empírico de Tversky y Kahneman. El default cognitivo."
              />
              <Slider
                label="Curvatura de la utilidad (α)"
                value={alpha}
                min={0.3} max={1.0} step={0.01}
                onChange={setAlpha}
                fmt={v => v.toFixed(2)}
                hint="α < 1: diminishing sensitivity. 0.88 = parámetro original de Prospect Theory."
              />
              <div className="bg-[#0D1117] border border-[#1E293B] rounded-md p-3 text-[11px] text-[#64748B] leading-relaxed">
                <span className="text-[#D946EF] font-mono">v(x) = x^α · 1(x≥0) − λ·(−x)^α · 1(x&lt;0)</span><br />
                La curva verde (ganancias) es cóncava: la alegría disminuye con más ganancia. La roja (pérdidas) es convexa: el dolor crece más rápido. Por eso el seguro y los nudges funcionan.
              </div>
            </>
          )}

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            Thaler & Sunstein, Nudge (2008)<br />
            Thaler, Mental Accounting Matters (1999)<br />
            comité Nobel 2017 · behavioral economics
          </div>
        </div>
      </div>
    </div>
  );
}
