/**
 * FriedmanLab — laboratorio del premio 1976 (Milton Friedman).
 *
 * El click: "La inflación siempre y en todo lugar es un fenómeno monetario."
 * Friedman demostró con datos de docenas de países y más de un siglo que
 * el hilo que une TODAS las inflaciones altas es uno solo: el banco central
 * imprimió de más. Y lo demostró con modelo real: la Ecuación de Cantidad.
 *
 * Modelo REAL y exacto (Teoría Cuantitativa del Dinero):
 *
 *   MV = PQ   (Fisher/Friedman)
 *
 *   Donde:
 *     M = oferta monetaria
 *     V = velocidad del dinero (constante a corto plazo, ≈2-3 veces el PIB)
 *     P = nivel de precios
 *     Q = producto real (PIB real)
 *
 *   Tomando tasas de crecimiento (aproximación en logs):
 *     π ≈ μ − g
 *
 *   Donde:
 *     π = inflación
 *     μ = tasa de crecimiento de la oferta monetaria
 *     g = tasa de crecimiento del PIB real
 *
 *   Friedman descubrió el REZAGO de 12-18 meses:
 *     π(t) ≈ μ(t − lag) − g   con lag ∈ [12, 18] meses
 *
 *   El lab simula este rezago con filtro exponencial:
 *     π_suavizada(t) = α · μ(t − lag) + (1−α) · π_suavizada(t−1)
 *
 * El usuario puede "imprimir dinero" jalando el slider de μ hacia arriba y
 * verá cómo la inflación lo persigue con un rezago visible — ese es el "ajá".
 * También puede ver el caso Venezuela/Argentina con el botón de hiperimpresión.
 */

import { useEffect, useRef, useState } from 'react';

// ─── dimensiones ───────────────────────────────────────────────────────────
const W = 820;
const H = 380;

// ─── simulación ─────────────────────────────────────────────────────────────
// Ventana de tiempo: 48 meses, tick = 1 mes
const N_MONTHS = 60;           // meses en la ventana visual
const SIM_STEP = 1 / 60;      // segundos por frame, ~1 mes/s a 60fps velocidad x1

// Rezago de Friedman en meses
const FRIEDMAN_LAG = 15;       // 12-18 meses, usamos 15

// Suavizamiento: qué tan rápido responde la inflación (α pequeño = inercia alta)
const ALPHA_INF = 0.08;        // constante de respuesta inflacionaria

// Límites del eje Y del gráfico: −5% a +60%
const Y_MIN = -5;
const Y_MAX = 60;

// ─── tipos ──────────────────────────────────────────────────────────────────
interface SimState {
  /** Historia circular de crecimiento monetario μ, un valor por mes. */
  muHistory: number[];
  /** Inflación suavizada actual (%) */
  piSmooth: number;
  /** Buffer de inflación para graficar */
  piHistory: number[];
  /** Mes actual acumulado */
  monthIdx: number;
  /** Acumulador de tiempo sub-mes */
  acc: number;
  /** Velocidad de simulación multiplicada */
  speed: number;
}

interface Params {
  mu: number;       // tasa actual de impresión (% mensual)
  g: number;        // crecimiento real del PIB (% anual → /12 por mes)
  paused: boolean;
  speed: number;    // multiplicador de velocidad (1x, 2x, 5x)
}

const DEFAULTS: Params = { mu: 0.8, g: 2.5, paused: false, speed: 2 };

// ─── helpers de coordenadas ──────────────────────────────────────────────────
const PAD_L = 50;
const PAD_R = 20;
const PAD_T = 36;
const PAD_B = 44;
const CHART_W = W - PAD_L - PAD_R;
const CHART_H = H - PAD_T - PAD_B;

function yPx(pct: number): number {
  const t = (pct - Y_MIN) / (Y_MAX - Y_MIN);
  return PAD_T + CHART_H - t * CHART_H;
}
function xPx(monthIdx: number, total: number): number {
  return PAD_L + (monthIdx / (total - 1)) * CHART_W;
}

function initSim(): SimState {
  const muHistory = Array<number>(N_MONTHS).fill(DEFAULTS.mu);
  const piHistory = Array<number>(N_MONTHS).fill(
    Math.max(0, DEFAULTS.mu - DEFAULTS.g / 12)
  );
  return {
    muHistory,
    piHistory,
    piSmooth: Math.max(0, DEFAULTS.mu - DEFAULTS.g / 12),
    monthIdx: N_MONTHS - 1,
    acc: 0,
    speed: DEFAULTS.speed,
  };
}

// ─── componente ─────────────────────────────────────────────────────────────
export default function FriedmanLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS });
  const simRef = useRef<SimState>(initSim());

  const [mu, setMu] = useState(DEFAULTS.mu);
  const [g, setG] = useState(DEFAULTS.g);
  const [paused, setPaused] = useState(DEFAULTS.paused);
  const [speed, setSpeed] = useState(DEFAULTS.speed);
  const [stats, setStats] = useState({
    pi: 0,
    piAnual: 0,
    mu: DEFAULTS.mu,
    muAnual: 0,
    gap: 0,
  });

  // sincronizar params al ref
  useEffect(() => {
    paramsRef.current = { mu, g, paused, speed };
    simRef.current.speed = speed;
  }, [mu, g, paused, speed]);

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

    let raf = 0;
    let last = performance.now();
    let frame = 0;

    // Avanza un "mes" en la simulación
    function tickMonth() {
      const p = paramsRef.current;
      const sim = simRef.current;

      // El crecimiento monetario actual va al historial (circular)
      sim.muHistory.push(p.mu);
      sim.piHistory.push(sim.piSmooth);
      if (sim.muHistory.length > N_MONTHS) sim.muHistory.shift();
      if (sim.piHistory.length > N_MONTHS) sim.piHistory.shift();
      sim.monthIdx++;

      // Inflación responde a μ de hace FRIEDMAN_LAG meses (% mensual)
      const lagIdx = Math.max(0, sim.muHistory.length - 1 - FRIEDMAN_LAG);
      const muLagged = sim.muHistory[lagIdx];
      // Inflación mensual de equilibrio: μ_rezagada − crecimiento_real_mensual
      const piTarget = Math.max(-2, muLagged - p.g / 12);
      // Filtro exponencial (inercia inflacionaria)
      sim.piSmooth = ALPHA_INF * piTarget + (1 - ALPHA_INF) * sim.piSmooth;
    }

    function draw() {
      if (!ctx) return;
      const sim = simRef.current;
      const p = paramsRef.current;

      // fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── rejilla horizontal ──
      const gridLevels = [0, 10, 20, 30, 40, 50];
      ctx.setLineDash([4, 6]);
      for (const lvl of gridLevels) {
        const y = yPx(lvl);
        if (y < PAD_T || y > PAD_T + CHART_H) continue;
        ctx.strokeStyle = lvl === 0 ? '#2D3748' : '#1A202C';
        ctx.lineWidth = lvl === 0 ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(PAD_L, y);
        ctx.lineTo(PAD_L + CHART_W, y);
        ctx.stroke();
        ctx.fillStyle = '#475569';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${lvl}%`, PAD_L - 6, y + 4);
      }
      ctx.setLineDash([]);

      // ── eje X (meses) ──
      ctx.fillStyle = '#475569';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      const labelSteps = [0, 12, 24, 36, 48, 59];
      for (const s of labelSteps) {
        const x = xPx(s, N_MONTHS);
        ctx.fillText(`${s}m`, x, PAD_T + CHART_H + 16);
      }

      // ── zona de rezago Friedman ──
      // Sombreamos el tramo "en tránsito" (entre μ y π)
      ctx.fillStyle = 'rgba(251,146,60,0.04)';
      const lagX = xPx(Math.max(0, N_MONTHS - 1 - FRIEDMAN_LAG), N_MONTHS);
      ctx.fillRect(lagX, PAD_T, CHART_W - (lagX - PAD_L), CHART_H);

      // ── curva μ (crecimiento monetario) ──
      const muData = sim.muHistory;
      ctx.beginPath();
      for (let i = 0; i < muData.length; i++) {
        const x = xPx(i, N_MONTHS);
        const y = yPx(muData[i]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#FB923C';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // ── relleno bajo μ ──
      ctx.beginPath();
      for (let i = 0; i < muData.length; i++) {
        const x = xPx(i, N_MONTHS);
        const y = yPx(muData[i]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineTo(xPx(muData.length - 1, N_MONTHS), PAD_T + CHART_H);
      ctx.lineTo(xPx(0, N_MONTHS), PAD_T + CHART_H);
      ctx.closePath();
      ctx.fillStyle = 'rgba(251,146,60,0.06)';
      ctx.fill();

      // ── curva π (inflación) ──
      const piData = sim.piHistory;
      ctx.beginPath();
      for (let i = 0; i < piData.length; i++) {
        const x = xPx(i, N_MONTHS);
        const y = yPx(piData[i]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // ── relleno bajo π ──
      ctx.beginPath();
      for (let i = 0; i < piData.length; i++) {
        const x = xPx(i, N_MONTHS);
        const y = yPx(piData[i]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineTo(xPx(piData.length - 1, N_MONTHS), PAD_T + CHART_H);
      ctx.lineTo(xPx(0, N_MONTHS), PAD_T + CHART_H);
      ctx.closePath();
      ctx.fillStyle = 'rgba(239,68,68,0.06)';
      ctx.fill();

      // ── etiquetas de curva ──
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      const lastMu = muData[muData.length - 1];
      const lastPi = piData[piData.length - 1];
      const muY = Math.max(PAD_T + 12, Math.min(PAD_T + CHART_H - 4, yPx(lastMu)));
      const piY = Math.max(PAD_T + 12, Math.min(PAD_T + CHART_H - 4, yPx(lastPi)));
      ctx.fillStyle = '#FB923C';
      ctx.fillText('μ dinero', PAD_L + CHART_W - 68, muY - 7);
      ctx.fillStyle = '#EF4444';
      ctx.fillText('π inflación', PAD_L + CHART_W - 74, piY + 14);

      // ── flecha del rezago ──
      const arrowY = PAD_T + 20;
      const arrowX1 = lagX;
      const arrowX2 = xPx(N_MONTHS - 1, N_MONTHS);
      ctx.strokeStyle = 'rgba(251,146,60,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(arrowX1, arrowY);
      ctx.lineTo(arrowX2, arrowY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(251,146,60,0.7)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`← rezago ~${FRIEDMAN_LAG} meses →`, (arrowX1 + arrowX2) / 2, arrowY - 4);

      // ── valores actuales ──
      const muAnual = p.mu * 12;
      const piAnual = sim.piSmooth * 12;
      const gapAnual = muAnual - p.g;

      // panel superior izquierdo
      const panelX = PAD_L + 8;
      const panelY = PAD_T + 6;
      ctx.fillStyle = 'rgba(11,15,23,0.75)';
      ctx.fillRect(panelX - 4, panelY - 4, 210, 56);
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#FB923C';
      ctx.fillText(`μ anual: ${muAnual.toFixed(1)}%  (dinero)`, panelX, panelY + 14);
      ctx.fillStyle = '#EF4444';
      ctx.fillText(`π anual: ${piAnual.toFixed(1)}%  (inflación)`, panelX, panelY + 30);
      ctx.fillStyle = gapAnual > 2 ? '#EF4444' : '#34D399';
      ctx.fillText(`gap μ−g: ${gapAnual.toFixed(1)}%  (presión inflac.)`, panelX, panelY + 46);

      // ── alerta hiperinflación ──
      if (piAnual > 30) {
        ctx.save();
        ctx.font = 'bold 13px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#EF4444';
        const flash = Math.sin(Date.now() / 250) > 0;
        if (flash) ctx.fillText('⚠ HIPERINFLACIÓN — imprimiste demasiado', W / 2, PAD_T + CHART_H + 30);
        ctx.restore();
      } else if (piAnual > 8) {
        ctx.font = '12px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FB923C';
        ctx.fillText(`inflación alta: ${piAnual.toFixed(1)}% anual — el peso se derrite`, W / 2, PAD_T + CHART_H + 30);
      } else if (piAnual < 0.5 && muAnual < 1) {
        ctx.font = '12px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#34D399';
        ctx.fillText(`inflación controlada: ${piAnual.toFixed(1)}% anual — zona segura`, W / 2, PAD_T + CHART_H + 30);
      } else {
        ctx.font = '12px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(`inflación: ${piAnual.toFixed(1)}% anual — meta Banxico ≈ 3%`, W / 2, PAD_T + CHART_H + 30);
      }

      // ── pausa ──
      if (p.paused) {
        ctx.fillStyle = 'rgba(5,6,10,0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 16px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⏸ en pausa', W / 2, H / 2);
      }

      // actualizar stats para React (cada 10 frames)
      if (frame % 10 === 0) {
        setStats({
          pi: sim.piSmooth,
          piAnual,
          mu: p.mu,
          muAnual,
          gap: gapAnual,
        });
      }
    }

    function loop(now: number) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const p = paramsRef.current;
      const sim = simRef.current;

      if (!p.paused) {
        sim.acc += dt * sim.speed;
        // avanzar meses completos
        while (sim.acc >= SIM_STEP * 60) {
          tickMonth();
          sim.acc -= SIM_STEP * 60;
        }
      }

      draw();
      frame++;
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── escenarios de preset ──
  const scenarios: Array<{ label: string; mu: number; g: number; color: string; desc: string }> = [
    { label: 'Banxico 3%', mu: 0.25, g: 2.0, color: '#34D399', desc: 'Meta de inflación de Banxico: ~3% anual. μ bajo, g moderado.' },
    { label: 'México 2022', mu: 0.72, g: 3.0, color: '#FDB813', desc: 'México 2022: inflación llegó a 8.7%. μ elevado post-pandemia.' },
    { label: 'Argentina 2024', mu: 5.5, g: -2.0, color: '#FB923C', desc: 'Argentina 2024: +200% inflación. Impresión masiva + recesión.' },
    { label: 'Venezuela 2018', mu: 30.0, g: -15.0, color: '#EF4444', desc: 'Venezuela 2018: 1,000,000% inflación. El caso extremo.' },
  ];

  function applyScenario(s: (typeof scenarios)[number]) {
    setMu(s.mu);
    setG(s.g);
  }

  const insight =
    stats.piAnual > 30
      ? `Imprimiste ${stats.muAnual.toFixed(0)}% anual de dinero. La inflación ya rebasó ${stats.piAnual.toFixed(0)}% — el peso pierde valor más rápido de lo que la gente puede gastar. Esto ES Venezuela o Argentina: el banco central financió al gobierno con la impresora.`
      : stats.piAnual > 8
      ? `Con μ=${stats.muAnual.toFixed(1)}%, la inflación llegó a ${stats.piAnual.toFixed(1)}% anual. Nota el rezago: la inflación te persigue desde hace ~15 meses. La medicina (bajar μ ahora) tardará igual en sentirse — por eso Banxico no espera a que la inflación llegue para actuar.`
      : stats.gap > 3
      ? `La presión inflacionaria es ${stats.gap.toFixed(1)}% anual. La inflación va a subir — ya viene en camino, solo espera el rezago de Friedman.`
      : `Con μ≈${stats.muAnual.toFixed(1)}% y g≈${g.toFixed(1)}%, el sistema está cerca del equilibrio. Inflación esperada: μ−g ≈ ${Math.max(0, stats.muAnual - g).toFixed(1)}% anual.`;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* ── Canvas + controles ── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* botones de escenario */}
          <div className="flex flex-wrap gap-2">
            {scenarios.map(s => (
              <button
                key={s.label}
                onClick={() => applyScenario(s)}
                title={s.desc}
                className="px-3 py-1.5 text-[11px] font-mono rounded border transition"
                style={{
                  borderColor: `${s.color}44`,
                  color: s.color,
                  backgroundColor: `${s.color}12`,
                }}
              >
                {s.label}
              </button>
            ))}
            <button
              onClick={() => setPaused(v => !v)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7] hover:bg-[#4FC3F7]/20 transition"
            >
              {paused ? '▶ reanudar' : '⏸ pausa'}
            </button>
            <button
              onClick={() => {
                setMu(DEFAULTS.mu);
                setG(DEFAULTS.g);
                simRef.current = initSim();
              }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#475569]/40 text-[#64748B] hover:text-[#CBD5E1] transition"
            >
              ↺ reiniciar
            </button>
          </div>

          {/* stats */}
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="impresión μ anual"
              value={`${stats.muAnual.toFixed(1)}%`}
              accent="#FB923C"
            />
            <Stat
              label="inflación π anual"
              value={`${stats.piAnual.toFixed(1)}%`}
              accent={stats.piAnual > 8 ? '#EF4444' : stats.piAnual < 4 ? '#34D399' : '#FDB813'}
            />
            <Stat
              label="presión μ−g"
              value={`${stats.gap > 0 ? '+' : ''}${stats.gap.toFixed(1)}%`}
              accent={stats.gap > 3 ? '#EF4444' : '#34D399'}
            />
          </div>

          {/* insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#FB923C] font-mono mb-2">
              ✦ ¿Qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── Panel de controles ── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Controla la impresora
          </div>

          <Slider
            label="Crecimiento monetario μ (% mensual)"
            value={mu}
            min={0}
            max={35}
            step={0.05}
            onChange={setMu}
            fmt={v => {
              const a = v * 12;
              if (a < 2) return 'austero';
              if (a < 5) return 'normal';
              if (a < 15) return 'riesgoso';
              if (a < 60) return '¡peligro!';
              return '¡HIPER!';
            }}
            hint="Cuánto dinero nuevo inyecta el banco central cada mes. Muévelo y espera el rezago."
          />

          <Slider
            label="Crecimiento real del PIB g (% anual)"
            value={g}
            min={-15}
            max={8}
            step={0.1}
            onChange={setG}
            fmt={v =>
              v < -5 ? 'recesión severa' : v < 0 ? 'recesión' : v < 2 ? 'estancado' : v < 4 ? 'creciendo' : 'auge'
            }
            hint="Si la economía crece más rápido, absorbe parte del dinero nuevo sin inflar precios. Si cae en recesión, peor."
          />

          <Slider
            label="Velocidad de simulación"
            value={speed}
            min={0.5}
            max={10}
            step={0.5}
            onChange={setSpeed}
            fmt={v => `${v}×`}
            hint="Acelera el tiempo para ver el rezago completo en segundos."
          />

          {/* fórmula */}
          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed space-y-1">
            <div className="text-[#64748B] font-bold">Modelo:</div>
            <div>MV = PQ &nbsp; (Fisher/Friedman)</div>
            <div>π ≈ μ − g &nbsp; (tasas de crecimiento)</div>
            <div>rezago: ~{FRIEDMAN_LAG} meses</div>
            <div className="pt-1 text-[#374151]">
              Friedman & Schwartz,<br />
              A Monetary History of the<br />
              United States 1867-1960 (1963)<br />
              comité Nobel 1976
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── subcomponentes ──────────────────────────────────────────────────────────
function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">
        {label}
      </div>
      <div className="text-[19px] font-bold font-mono" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[12px] font-mono text-[#FDB813]">
          {fmt ? fmt(value) : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#FB923C]"
      />
      {hint && (
        <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>
      )}
    </div>
  );
}
