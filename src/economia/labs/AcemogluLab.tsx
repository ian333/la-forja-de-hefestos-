/**
 * AcemogluLab — laboratorio del premio 2024 (Acemoglu, Johnson & Robinson).
 *
 * El click: las instituciones son las reglas del juego. Cuando son EXTRACTIVAS
 * (alta expropiación, sin Estado de derecho, sin pluralismo político), nadie
 * invierte porque el fruto de su trabajo puede robárselo quien tenga el poder.
 * Cuando son INCLUSIVAS (derechos de propiedad seguros, competencia abierta,
 * pluralismo), el esfuerzo rinde — y toda la economía crece.
 *
 * Modelo REAL (Acemoglu-Johnson-Robinson 2001/2005):
 *
 *   Cada agente i decide cuánto invertir k_i ∈ [0, k_max].
 *   Retorno bruto:  R_i = A · k_i^α          (tecnología Cobb-Douglas, α<1)
 *   Riesgo de expropiación: tasa τ (instituciones extractivas) — el Estado o
 *   las élites se quedan con fracción τ del retorno bruto.
 *   Retorno neto esperado:  π_i = (1−τ)·R_i − k_i
 *   El agente maximiza π_i → k_i* = (α·A·(1−τ))^(1/(1−α))  [fórmula exacta]
 *   Si k_i* < 0, no invierte (k_i = 0).
 *
 *   Además modelamos "costos de entrada" (burocracia/permisos) como b:
 *   solo si (1−τ)·R(k*) − k* > b el agente entra al mercado.
 *
 *   Pluralismo político: reduce τ con el tiempo a través de checks & balances.
 *   Cada período sin pluralismo: τ puede SUBIR (élites se consolidan).
 *   Cada período CON pluralismo: τ deriva hacia 0 lentamente.
 *
 *   El PIB de este "país" es la suma de retornos netos de todos los agentes
 *   que invirtieron, normalizado para mostrar en pantalla.
 *
 * Referencias:
 *   Acemoglu, Johnson & Robinson (2001) "Colonial Origins…" AER
 *   Acemoglu & Robinson (2012) "Why Nations Fail"
 *   comité Nobel 2024
 */

import { useEffect, useRef, useState } from 'react';

/* ─── Dimensiones y constantes ─────────────────────────────────────────── */
const W = 820;
const H = 380;
const MARGIN = { top: 36, right: 30, bottom: 52, left: 60 };
const PLOT_W = W - MARGIN.left - MARGIN.right - 180; // reserva 180px para panel derecho
const PLOT_H = H - MARGIN.top - MARGIN.bottom;
const MAX_TICKS = 80;          // períodos en el historial del eje X
const N_AGENTS = 40;           // número de agentes en el "país"
const ALPHA = 0.5;             // elasticidad del capital (Cobb-Douglas)
const K_MAX = 100;             // capital máximo por agente
const A_BASE = 8;              // productividad total de factores

/* ─── Utilidades de color ──────────────────────────────────────────────── */
const C_INCLUSIVE = '#34D399';  // verde — instituciones inclusivas
const C_EXTRACTIVE = '#EF4444'; // rojo — instituciones extractivas
const C_GDP = '#4FC3F7';        // azul — PIB
const C_INVEST = '#FDB813';     // dorado — inversión
const C_AGENT_IN = '#A78BFA';   // violeta — agente que invierte
const C_AGENT_OUT = '#334155';  // gris — agente que no invierte

/* ─── Parámetros del modelo ────────────────────────────────────────────── */
interface Params {
  tau: number;          // 0..0.95 — tasa de expropiación
  burocracia: number;   // 0..60 — costo fijo de entrada al mercado
  pluralismo: boolean;  // checks & balances activos
  paused: boolean;
}

const DEFAULTS: Params = { tau: 0.55, burocracia: 20, pluralismo: false, paused: false };

/* ─── Estado de la simulación ──────────────────────────────────────────── */
interface SimState {
  tick: number;
  tau: number;            // τ dinámico (puede drift según pluralismo)
  agents: AgentState[];
  gdpHistory: number[];   // PIB normalizado por período
  investHistory: number[]; // fracción de agentes que invirtieron
  tauHistory: number[];   // historial de τ
}

interface AgentState {
  id: number;
  x: number;   // posición visual (fija)
  y: number;
  k: number;   // capital invertido este período
  profit: number;
}

/* ─── Fórmulas del modelo ──────────────────────────────────────────────── */
// Capital óptimo de Cobb-Douglas con expropiación
function kOptimal(tau: number): number {
  const val = Math.pow(ALPHA * A_BASE * (1 - tau), 1 / (1 - ALPHA));
  return Math.min(K_MAX, Math.max(0, val));
}

// Retorno bruto
function grossReturn(k: number): number {
  return A_BASE * Math.pow(k, ALPHA);
}

// Retorno neto del agente (después de expropiación)
function netReturn(k: number, tau: number): number {
  return (1 - tau) * grossReturn(k) - k;
}

/* ─── Inicialización de agentes (posiciones visuales aleatorias) ─────── */
function initAgents(): AgentState[] {
  // Usamos posiciones pseudo-aleatorias deterministas (sin Math.random en render)
  const agents: AgentState[] = [];
  for (let i = 0; i < N_AGENTS; i++) {
    // Distribución en una cuadrícula con pequeño jitter determinista
    const col = i % 8;
    const row = Math.floor(i / 8);
    const jx = ((i * 17 + 3) % 13) - 6;
    const jy = ((i * 11 + 7) % 9) - 4;
    agents.push({
      id: i,
      x: W - 175 + col * 18 + jx + 9,
      y: MARGIN.top + 8 + row * 22 + jy + 8,
      k: 0,
      profit: 0,
    });
  }
  return agents;
}

function initSim(tau: number): SimState {
  return {
    tick: 0,
    tau,
    agents: initAgents(),
    gdpHistory: [],
    investHistory: [],
    tauHistory: [],
  };
}

/* ─── Un paso de simulación ─────────────────────────────────────────────── */
function simStep(sim: SimState, params: Params): SimState {
  // Drift dinámico de τ según pluralismo
  let newTau = sim.tau;
  if (params.pluralismo) {
    // Con checks & balances, la expropiación decrece (reform gradual)
    newTau = Math.max(0.02, sim.tau - 0.008);
  } else {
    // Sin pluralismo, las élites consolidan poder — τ tiende a subir si ya es alto
    if (sim.tau > 0.4) {
      newTau = Math.min(0.95, sim.tau + 0.003);
    }
  }
  // El slider del usuario ANCLA el τ inicial si el usuario lo mueve
  // (se refleja al resetear; aquí dejamos derivar desde params.tau si sim.tick==0)
  if (sim.tick === 0) newTau = params.tau;

  const kStar = kOptimal(newTau);
  const buro = params.burocracia;

  let totalGDP = 0;
  let investors = 0;

  const newAgents = sim.agents.map(agent => {
    const nret = netReturn(kStar, newTau);
    const invests = kStar > 0 && nret > buro;
    const k = invests ? kStar : 0;
    const profit = invests ? nret - buro : 0;
    if (invests) { investors++; totalGDP += profit; }
    return { ...agent, k, profit };
  });

  // Normaliza PIB para la gráfica: máximo posible ≈ N_AGENTS * netReturn(kOptimal(0), 0)
  const gdpMax = N_AGENTS * netReturn(kOptimal(0.0), 0.0);
  const gdpNorm = Math.max(0, (totalGDP / gdpMax) * 100);
  const investFrac = (investors / N_AGENTS) * 100;

  const gdpHistory = [...sim.gdpHistory.slice(-MAX_TICKS + 1), gdpNorm];
  const investHistory = [...sim.investHistory.slice(-MAX_TICKS + 1), investFrac];
  const tauHistory = [...sim.tauHistory.slice(-MAX_TICKS + 1), newTau * 100];

  return {
    tick: sim.tick + 1,
    tau: newTau,
    agents: newAgents,
    gdpHistory,
    investHistory,
    tauHistory,
  };
}

/* ─── Coordenadas del plot ──────────────────────────────────────────────── */
const px = (i: number, total: number) =>
  MARGIN.left + (i / (total - 1 || 1)) * PLOT_W;

const py = (v: number) =>
  MARGIN.top + PLOT_H - (v / 100) * PLOT_H;

/* ─── Componente principal ──────────────────────────────────────────────── */
export default function AcemogluLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS });
  const simRef = useRef<SimState>(initSim(DEFAULTS.tau));
  const resetFlagRef = useRef(false);

  const [tau, setTau] = useState(DEFAULTS.tau);
  const [burocracia, setBurocracia] = useState(DEFAULTS.burocracia);
  const [pluralismo, setPluralism] = useState(DEFAULTS.pluralismo);
  const [paused, setPaused] = useState(DEFAULTS.paused);
  const [stats, setStats] = useState({
    gdp: 0, investors: 0, tauLive: DEFAULTS.tau, tick: 0,
  });

  // Sincroniza params con React state
  useEffect(() => {
    paramsRef.current = { tau, burocracia, pluralismo, paused };
  }, [tau, burocracia, pluralismo, paused]);

  // Resetea simulación cuando el usuario mueve sliders
  useEffect(() => {
    resetFlagRef.current = true;
  }, [tau, burocracia]);

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
    let lastTime = performance.now();
    let accTime = 0;
    let frameCount = 0;
    const SIM_STEP_MS = 220; // un paso cada ~220ms

    function draw() {
      if (!ctx) return;
      const p = paramsRef.current;
      const sim = simRef.current;

      // Fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#05060A');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const gdpHist = sim.gdpHistory;
      const tauHist = sim.tauHistory;
      const investHist = sim.investHistory;
      const len = gdpHist.length;

      // ── Ejes ───────────────────────────────────────────────────────────
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN.left, MARGIN.top);
      ctx.lineTo(MARGIN.left, MARGIN.top + PLOT_H);
      ctx.lineTo(MARGIN.left + PLOT_W, MARGIN.top + PLOT_H);
      ctx.stroke();

      // Líneas guía horizontales (25 / 50 / 75 / 100)
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = '#1A2535';
      ctx.lineWidth = 1;
      for (const val of [25, 50, 75, 100]) {
        const yg = py(val);
        ctx.beginPath();
        ctx.moveTo(MARGIN.left, yg);
        ctx.lineTo(MARGIN.left + PLOT_W, yg);
        ctx.stroke();
        ctx.fillStyle = '#3B4A60';
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${val}`, MARGIN.left - 4, yg + 3);
      }
      ctx.setLineDash([]);

      // Label eje Y
      ctx.save();
      ctx.translate(14, MARGIN.top + PLOT_H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#475569';
      ctx.font = '10px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('% del máximo posible', 0, 0);
      ctx.restore();

      // Label eje X
      ctx.fillStyle = '#475569';
      ctx.font = '10px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('períodos', MARGIN.left + PLOT_W / 2, H - 8);

      // ── Serie τ (expropiación) ─────────────────────────────────────────
      if (len >= 2) {
        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const x = px(i, len);
          const y = py(tauHist[i]);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = C_EXTRACTIVE;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // ── Serie inversión (fracción que invierte) ────────────────────────
      if (len >= 2) {
        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const x = px(i, len);
          const y = py(investHist[i]);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = C_INVEST;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // ── Serie PIB (relleno) ────────────────────────────────────────────
      if (len >= 2) {
        ctx.beginPath();
        ctx.moveTo(px(0, len), py(gdpHist[0]));
        for (let i = 1; i < len; i++) {
          ctx.lineTo(px(i, len), py(gdpHist[i]));
        }
        ctx.lineTo(px(len - 1, len), MARGIN.top + PLOT_H);
        ctx.lineTo(px(0, len), MARGIN.top + PLOT_H);
        ctx.closePath();
        ctx.fillStyle = 'rgba(79,195,247,0.08)';
        ctx.fill();

        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const x = px(i, len);
          const y = py(gdpHist[i]);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = C_GDP;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      // ── Leyenda del plot ───────────────────────────────────────────────
      const legendX = MARGIN.left + 8;
      const legendY = MARGIN.top + 14;
      const items: [string, string][] = [
        [C_GDP, 'PIB (% máx)'],
        [C_INVEST, '% agentes invierten'],
        [C_EXTRACTIVE, 'expropiación τ (%)'],
      ];
      items.forEach(([color, label], idx) => {
        const lx = legendX + idx * 138;
        ctx.fillStyle = color;
        ctx.fillRect(lx, legendY - 7, 18, 3);
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(label, lx + 22, legendY - 1);
      });

      // ── Panel agentes (derecha) ────────────────────────────────────────
      const panelX = W - 170;
      const panelY = MARGIN.top - 8;
      const panelW = 160;
      const panelH = H - MARGIN.top + 4;

      ctx.fillStyle = 'rgba(11,15,23,0.7)';
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'center';
      ctx.fillText('agentes', panelX + panelW / 2, panelY + 14);

      // Dibuja cada agente como un círculo
      sim.agents.forEach(agent => {
        const investing = agent.k > 0;
        const r = 5;
        ctx.beginPath();
        ctx.arc(agent.x, agent.y, r, 0, Math.PI * 2);
        if (investing) {
          ctx.fillStyle = C_AGENT_IN;
          ctx.shadowColor = C_AGENT_IN;
          ctx.shadowBlur = 8;
        } else {
          ctx.fillStyle = C_AGENT_OUT;
          ctx.shadowBlur = 0;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Contador de inversores
      const nInv = sim.agents.filter(a => a.k > 0).length;
      const tauPct = (sim.tau * 100).toFixed(0);
      const instiLabel = sim.tau < 0.3
        ? 'INCLUSIVAS'
        : sim.tau < 0.6 ? 'MIXTAS' : 'EXTRACTIVAS';
      const instiColor = sim.tau < 0.3
        ? C_INCLUSIVE
        : sim.tau < 0.6 ? C_INVEST : C_EXTRACTIVE;

      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = instiColor;
      ctx.fillText(instiLabel, panelX + panelW / 2, panelY + panelH - 36);
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(`τ=${tauPct}%  inv=${nInv}/${N_AGENTS}`, panelX + panelW / 2, panelY + panelH - 18);

      // ── Estado (pausa) ────────────────────────────────────────────────
      if (p.paused) {
        ctx.fillStyle = 'rgba(5,6,10,0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 16px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⏸ en pausa', W / 2, H / 2);
      }

      // ── Notificación de Nogales ───────────────────────────────────────
      if (len > 0) {
        const lastGDP = gdpHist[len - 1];
        let msg = '';
        let msgColor = '#64748B';
        if (sim.tau < 0.25) {
          msg = '→ Nogales, Arizona: hospitales, universidades, crédito';
          msgColor = C_INCLUSIVE;
        } else if (sim.tau > 0.65) {
          msg = '→ Nogales, Sonora: misma gente, misma tierra — reglas distintas';
          msgColor = C_EXTRACTIVE;
        } else {
          msg = `→ economía mixta: ${nInv} de ${N_AGENTS} agentes invierten · PIB ${lastGDP.toFixed(0)}%`;
          msgColor = C_INVEST;
        }
        ctx.fillStyle = msgColor;
        ctx.font = '11px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(msg, MARGIN.left + PLOT_W / 2, H - MARGIN.bottom + 20);
      }

      // Actualiza stats para React cada ~10 frames
      if (frameCount % 8 === 0 && len > 0) {
        const nInvestors = sim.agents.filter(a => a.k > 0).length;
        setStats({
          gdp: gdpHist[len - 1],
          investors: nInvestors,
          tauLive: sim.tau,
          tick: sim.tick,
        });
      }
    }

    function loop(now: number) {
      const dt = Math.min(0.15, (now - lastTime) / 1000);
      lastTime = now;

      if (resetFlagRef.current) {
        simRef.current = initSim(paramsRef.current.tau);
        resetFlagRef.current = false;
      }

      if (!paramsRef.current.paused) {
        accTime += dt * 1000;
        while (accTime >= SIM_STEP_MS) {
          simRef.current = simStep(simRef.current, paramsRef.current);
          accTime -= SIM_STEP_MS;
        }
      }

      draw();
      frameCount++;
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Insight dinámico ──────────────────────────────────────────────────
  const instiType = stats.tauLive < 0.3
    ? 'inclusivas'
    : stats.tauLive < 0.6 ? 'mixtas' : 'extractivas';

  const insight =
    stats.tauLive > 0.6
      ? `Con expropiación del ${(stats.tauLive * 100).toFixed(0)}%, solo ${stats.investors} de ${N_AGENTS} agentes invierten. El esfuerzo no rinde — ¿para qué construir si te lo quitan? Eso es una institución extractiva. El PIB colapsa aunque la tierra, la gente y la tecnología sean idénticas.`
      : stats.tauLive < 0.3
        ? `Expropiación en ${(stats.tauLive * 100).toFixed(0)}%: ${stats.investors} de ${N_AGENTS} agentes invierten. Los derechos de propiedad están seguros, el Estado de derecho protege tu inversión. El PIB florece — no por magia: por incentivos.`
        : `Instituciones mixtas (τ = ${(stats.tauLive * 100).toFixed(0)}%): algunos invierten, otros no. La economía avanza a la mitad de su potencial. Esto es México hoy: instituciones que a veces protegen y a veces extraen.`;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

        {/* ── Canvas ────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Botones */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPaused(v => !v)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7] hover:bg-[#4FC3F7]/20 transition"
            >
              {paused ? '▶ reanudar' : '⏸ pausa'}
            </button>
            <button
              onClick={() => { resetFlagRef.current = true; }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#FDB813]/40 bg-[#FDB813]/10 text-[#FDB813] hover:bg-[#FDB813]/20 transition"
            >
              ↺ reiniciar
            </button>
            <button
              onClick={() => setPluralism(v => !v)}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                pluralismo
                  ? 'border-[#34D399]/50 bg-[#34D399]/10 text-[#34D399]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              {pluralismo ? '🏛 pluralismo: ON' : '○ sin pluralismo'}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="PIB (% del máx)"
              value={`${stats.gdp.toFixed(1)}%`}
              accent={stats.gdp > 60 ? '#34D399' : stats.gdp > 30 ? '#FDB813' : '#EF4444'}
            />
            <Stat
              label="expropiación τ"
              value={`${(stats.tauLive * 100).toFixed(0)}%`}
              accent={stats.tauLive < 0.3 ? '#34D399' : stats.tauLive < 0.6 ? '#FDB813' : '#EF4444'}
            />
            <Stat
              label={`invierten (/${N_AGENTS})`}
              value={`${stats.investors}`}
              accent="#A78BFA"
            />
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">
              ✦ ¿Qué estás viendo? · instituciones {instiType}
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── Panel de controles ─────────────────────────────────────────── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Las reglas del juego
          </div>

          <Slider
            label="Expropiación τ"
            value={tau}
            min={0.02}
            max={0.95}
            step={0.01}
            onChange={v => { setTau(v); }}
            fmt={v => {
              if (v < 0.25) return 'Estado de derecho';
              if (v < 0.5)  return 'riesgo moderado';
              if (v < 0.75) return 'instituciones débiles';
              return 'extractivo puro';
            }}
            hint="Fracción del retorno que el Estado o las élites se quedan. A más τ, menos razón para invertir."
          />

          <Slider
            label="Burocracia / permisos"
            value={burocracia}
            min={0}
            max={80}
            step={1}
            onChange={setBurocracia}
            fmt={v => v < 15 ? 'bajo' : v < 40 ? 'normal' : 'sofocante'}
            hint="Costo fijo para entrar al mercado. Si el potencial neto no supera este costo, el agente no abre su negocio."
          />

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo: k* = (α·A·(1−τ))^(1/(1−α))<br />
            π = (1−τ)·A·k^α − k − b<br />
            α = {ALPHA}   A = {A_BASE}   n = {N_AGENTS} agentes<br />
            AJR (2001) · Nobel 2024
          </div>

          <div className="space-y-2 border-t border-[#1E293B] pt-3">
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#64748B] font-mono mb-1">
              ¿qué es el pluralismo?
            </div>
            <p className="text-[11px] text-[#64748B] leading-snug">
              Los checks &amp; balances — congreso independiente, jueces autónomos,
              prensa libre — reducen τ con el tiempo porque ningún grupo puede
              secuestrar las reglas permanentemente. Actívalo y observa cómo
              la expropiación cae aunque no la hayas movido.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Componentes auxiliares ─────────────────────────────────────────────── */
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
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
  label, value, min, max, step, onChange, fmt, hint,
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
        className="w-full accent-[#4FC3F7]"
      />
      {hint && (
        <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>
      )}
    </div>
  );
}
