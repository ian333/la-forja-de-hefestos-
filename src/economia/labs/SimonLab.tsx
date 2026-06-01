/**
 * SimonLab — laboratorio del premio 1978 (Herbert Simon).
 *
 * El click: tu cerebro NUNCA ha calculado la mejor decisión de su vida.
 * Ni falta que hace. Simon demostró que buscar "suficientemente bueno"
 * (satisficing) es la única estrategia racional cuando el tiempo y la
 * información cuestan.
 *
 * Modelo REAL implementado:
 *  — Búsqueda secuencial con nivel de aspiración A ∈ [0, 100].
 *  — N opciones distribuidas U[0,100]. Costo de buscar una opción: c.
 *  — Regla satisficing: acepta la primera opción x_i ≥ A.
 *  — Utilidad neta satisficing: x* − k·c  (k = número de opciones chequeadas)
 *  — Benchmark: búsqueda exhaustiva de las N opciones → elige el máximo.
 *    Su utilidad neta: max(x_i) − N·c.
 *  — Para c suficientemente grande, satisficing gana SIEMPRE.
 *  — Regla óptima (secretary problem, Lindley 1961):
 *    Observar sin aceptar las primeras ⌊N/e⌋ ≈ 0.368·N opciones,
 *    luego aceptar la primera que supere el mejor visto hasta ahora.
 *    P(elegir la mejor) → 1/e ≈ 36.8% para N grande.
 *  — El lab muestra los tres agentes al mismo tiempo para comparar.
 */

import { useEffect, useRef, useState } from 'react';

/* ─────────────────────────── Dimensiones ─────────────────────────── */
const W = 820;
const H = 390;
const PAD_L = 50;
const PAD_R = 30;
const PAD_TOP = 52;
const PAD_BOT = 52;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_TOP - PAD_BOT;

/* ─────────────────────────── Colores ─────────────────────────── */
const BG0 = '#05060A';
const BG1 = '#0B0F17';
const C_SATIS = '#FDB813';   // satisficer (tú)
const C_OPT   = '#EF4444';   // optimizador exhaustivo
const C_SEC   = '#34D399';   // regla del secretario (óptimo teórico)
const C_GRID  = '#1E293B';
const C_AXIS  = '#334155';

/* ─────────────────────────── Tipos ─────────────────────────── */
interface Params {
  N: number;           // cantidad de opciones (tamaño del mercado)
  cost: number;        // costo de buscar UNA opción (puntos de utilidad)
  aspiration: number;  // nivel de aspiración [0,100]
  speed: number;       // opciones por segundo que "mira" el agente
  running: boolean;
}

interface SearchState {
  options: number[];          // todas las opciones generadas
  kSatisficer: number;        // cuántas chequeó el satisficer
  doneSatisficer: boolean;
  kOptimizer: number;         // cuántas chequeó el optimizador
  doneOptimizer: boolean;
  kSecretary: number;         // cuántas chequeó el secretario
  doneSecretary: boolean;
  // valores elegidos
  choiceSatisficer: number | null;
  choiceOptimizer: number | null;
  choiceSecretary: number | null;
  // mejor visto hasta ahora para la regla del secretario
  bestSeen: number;
  phase: 'exploring' | 'accepting' | 'done'; // fase del secretario
}

interface Stats {
  utilSatisficer: number | null;
  utilOptimizer: number | null;
  utilSecretary: number | null;
  kSatisficer: number;
  kOptimizer: number;
  kSecretary: number;
}

const DEFAULTS: Params = {
  N: 30,
  cost: 1.5,
  aspiration: 68,
  speed: 4,
  running: false,
};

/* ─────────────────────────── Helpers ─────────────────────────── */
function generateOptions(N: number): number[] {
  return Array.from({ length: N }, () => Math.random() * 100);
}

function secretaryThreshold(N: number): number {
  // Observar sin aceptar las primeras floor(N/e) opciones
  return Math.floor(N / Math.E);
}

function utilNet(value: number, k: number, cost: number): number {
  return value - k * cost;
}

function initSearch(N: number): SearchState {
  return {
    options: generateOptions(N),
    kSatisficer: 0,
    doneSatisficer: false,
    kOptimizer: 0,
    doneOptimizer: false,
    kSecretary: 0,
    doneSecretary: false,
    choiceSatisficer: null,
    choiceOptimizer: null,
    choiceSecretary: null,
    bestSeen: -Infinity,
    phase: 'exploring',
  };
}

/* Avanza UN paso para los tres agentes */
function stepSearch(s: SearchState, params: Params): SearchState {
  const ns = { ...s };
  const { N, cost, aspiration } = params;
  const threshold = secretaryThreshold(N);

  // ── Satisficer ──
  if (!ns.doneSatisficer && ns.kSatisficer < N) {
    const val = ns.options[ns.kSatisficer];
    ns.kSatisficer++;
    if (val >= aspiration || ns.kSatisficer === N) {
      ns.choiceSatisficer = val;
      ns.doneSatisficer = true;
    }
  }

  // ── Optimizador exhaustivo ──
  if (!ns.doneOptimizer) {
    if (ns.kOptimizer < N) {
      ns.kOptimizer++;
    } else {
      // terminó de ver todo
      let best = -Infinity;
      for (const v of ns.options) if (v > best) best = v;
      ns.choiceOptimizer = best;
      ns.doneOptimizer = true;
    }
  }

  // ── Regla del secretario ──
  if (!ns.doneSecretary && ns.kSecretary < N) {
    const val = ns.options[ns.kSecretary];
    ns.kSecretary++;
    if (ns.kSecretary <= threshold) {
      // fase de exploración: observa sin aceptar, guarda el mejor
      ns.bestSeen = Math.max(ns.bestSeen, val);
      ns.phase = 'exploring';
    } else {
      // fase de aceptación: acepta la primera que supera el mejor visto
      ns.phase = 'accepting';
      if (val > ns.bestSeen || ns.kSecretary === N) {
        ns.choiceSecretary = val;
        ns.doneSecretary = true;
        ns.phase = 'done';
      }
    }
  } else if (!ns.doneSecretary) {
    // Agotó opciones sin aceptar → queda con la última
    ns.choiceSecretary = ns.options[N - 1];
    ns.doneSecretary = true;
    ns.phase = 'done';
  }

  return ns;
}

/* ─────────────────────────── Componente principal ─────────────────────────── */
export default function SimonLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS });
  const searchRef = useRef<SearchState>(initSearch(DEFAULTS.N));
  const [N, setN] = useState(DEFAULTS.N);
  const [cost, setCost] = useState(DEFAULTS.cost);
  const [aspiration, setAspiration] = useState(DEFAULTS.aspiration);
  const [speed, setSpeed] = useState(DEFAULTS.speed);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<Stats>({
    utilSatisficer: null, utilOptimizer: null, utilSecretary: null,
    kSatisficer: 0, kOptimizer: 0, kSecretary: 0,
  });

  // Sincroniza params ref
  useEffect(() => {
    paramsRef.current = { N, cost, aspiration, speed, running };
  }, [N, cost, aspiration, speed, running]);

  // Reset al cambiar N o cost
  useEffect(() => {
    searchRef.current = initSearch(N);
    setRunning(false);
  }, [N, cost]);

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
    let lastStepTime = 0;
    let frameCount = 0;

    /* Coordenadas de pantalla */
    const xOf = (k: number, total: number): number =>
      PAD_L + (k / Math.max(1, total)) * PLOT_W;

    const yOf = (val: number): number =>
      PAD_TOP + PLOT_H - (val / 100) * PLOT_H;

    function draw(now: number) {
      if (!ctx) return;
      const p = paramsRef.current;
      const s = searchRef.current;
      const { N: n, cost: c, aspiration: asp } = p;

      /* ── Fondo ── */
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, BG1);
      bg.addColorStop(1, BG0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      /* ── Grid horizontal (cada 20 puntos) ── */
      ctx.strokeStyle = C_GRID;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      for (let v = 0; v <= 100; v += 20) {
        const y = yOf(v);
        ctx.beginPath();
        ctx.moveTo(PAD_L, y);
        ctx.lineTo(PAD_L + PLOT_W, y);
        ctx.stroke();
        ctx.fillStyle = '#475569';
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(String(v), PAD_L - 5, y + 3);
      }
      ctx.setLineDash([]);

      /* ── Eje X ── */
      ctx.strokeStyle = C_AXIS;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(PAD_L, PAD_TOP + PLOT_H);
      ctx.lineTo(PAD_L + PLOT_W, PAD_TOP + PLOT_H);
      ctx.stroke();

      /* ── Línea de aspiración ── */
      const yAsp = yOf(asp);
      ctx.strokeStyle = C_SATIS;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(PAD_L, yAsp);
      ctx.lineTo(PAD_L + PLOT_W, yAsp);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = C_SATIS;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`aspiración=${asp}`, PAD_L + 4, yAsp - 5);

      /* ── Línea del umbral del secretario ── */
      const threshold = secretaryThreshold(n);
      const xThresh = xOf(threshold, n);
      ctx.strokeStyle = C_SEC;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(xThresh, PAD_TOP);
      ctx.lineTo(xThresh, PAD_TOP + PLOT_H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = C_SEC;
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`≈37%`, xThresh, PAD_TOP - 8);
      ctx.fillText(`explorar`, xThresh, PAD_TOP - 0);

      /* ── Opciones como barras verticales ── */
      const barW = Math.max(2, PLOT_W / n - 2);
      for (let i = 0; i < n; i++) {
        const val = s.options[i];
        const x = xOf(i + 0.5, n);
        const yTop = yOf(val);
        const yBot = PAD_TOP + PLOT_H;
        const isVisible = i < Math.max(s.kSatisficer, s.kOptimizer, s.kSecretary);

        if (!isVisible) {
          // aún no "vistas" — gris oscuro
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(x - barW / 2, yTop, barW, yBot - yTop);
          continue;
        }

        // determinar color base según quién la "vio"
        ctx.fillStyle = '#334155';
        ctx.fillRect(x - barW / 2, yTop, barW, yBot - yTop);

        // marcador de elección satisficer
        if (s.doneSatisficer && s.choiceSatisficer === val && i === s.kSatisficer - 1) {
          ctx.save();
          ctx.shadowColor = C_SATIS;
          ctx.shadowBlur = 12;
          ctx.fillStyle = C_SATIS;
          ctx.fillRect(x - barW / 2, yTop, barW, yBot - yTop);
          ctx.restore();
        }

        // marcador de elección secretario
        if (s.doneSecretary && s.choiceSecretary === val && i === s.kSecretary - 1) {
          ctx.save();
          ctx.shadowColor = C_SEC;
          ctx.shadowBlur = 12;
          ctx.fillStyle = C_SEC;
          ctx.fillRect(x - barW / 2, yTop, barW, yBot - yTop);
          ctx.restore();
        }
      }

      /* ── Marca de elección del optimizador ── */
      if (s.doneOptimizer && s.choiceOptimizer !== null) {
        // Buscar la barra que corresponde al máximo
        let bestIdx = 0;
        for (let i = 1; i < n; i++) {
          if (s.options[i] > s.options[bestIdx]) bestIdx = i;
        }
        const x = xOf(bestIdx + 0.5, n);
        const yTop = yOf(s.options[bestIdx]);
        const yBot = PAD_TOP + PLOT_H;
        ctx.save();
        ctx.shadowColor = C_OPT;
        ctx.shadowBlur = 14;
        ctx.fillStyle = C_OPT;
        ctx.fillRect(x - barW / 2, yTop, barW, yBot - yTop);
        ctx.restore();
      }

      /* ── Curvas de utilidad neta acumulada ── */
      // Dibuja la utilidad neta esperada en función de cuántas opciones chequeaste
      // para cada estrategia (sólo informativa, hasta la opción k actual)
      const drawUtilCurve = (k: number, choice: number | null, color: string, label: string, yOff: number) => {
        if (k === 0) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= k && i < n; i++) {
          let bestSoFar = -Infinity;
          for (let j = 0; j <= i; j++) if (s.options[j] > bestSoFar) bestSoFar = s.options[j];
          const uNet = bestSoFar - (i + 1) * c;
          const x = xOf(i + 0.5, n);
          const yU = yOf(Math.max(0, Math.min(100, uNet + 50))); // normalizado para mostrar
          if (!started) { ctx.moveTo(x, yU); started = true; }
          else ctx.lineTo(x, yU);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (choice !== null) {
          const uFinal = utilNet(choice, k, c);
          ctx.fillStyle = color;
          ctx.font = 'bold 11px ui-monospace, monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`${label}: ${uFinal.toFixed(1)} pts`, W - PAD_R - 4, yOff);
        }
      };
      drawUtilCurve(s.kOptimizer, s.choiceOptimizer, C_OPT, 'Optimizador', PAD_TOP + 16);
      drawUtilCurve(s.kSecretary, s.choiceSecretary, C_SEC, 'Secretario', PAD_TOP + 30);
      drawUtilCurve(s.kSatisficer, s.choiceSatisficer, C_SATIS, 'Tú (satisficer)', PAD_TOP + 44);

      /* ── Cabecera ── */
      ctx.fillStyle = '#94A3B8';
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`N=${n} opciones   costo/búsqueda=${c.toFixed(1)} pts`, PAD_L, 18);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#64748B';
      ctx.fillText('utilidad neta = valor − k·costo', W - PAD_R, 18);

      /* ── Leyenda ── */
      const legends: Array<[string, string]> = [
        [C_SATIS, 'Tú (satisficer)'],
        [C_SEC,   'Regla del secretario (37%)'],
        [C_OPT,   'Optimizador exhaustivo'],
      ];
      let lx = PAD_L;
      const ly = H - 14;
      for (const [col, lbl] of legends) {
        ctx.fillStyle = col;
        ctx.fillRect(lx, ly - 8, 12, 8);
        ctx.fillStyle = '#CBD5E1';
        ctx.font = '10px ui-sans-serif, system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(lbl, lx + 16, ly);
        lx += ctx.measureText(lbl).width + 36;
      }

      /* ── Estado del avance ── */
      const allDone = s.doneSatisficer && s.doneOptimizer && s.doneSecretary;
      if (allDone) {
        const uS = s.choiceSatisficer !== null ? utilNet(s.choiceSatisficer, s.kSatisficer, c) : null;
        const uO = s.choiceOptimizer !== null ? utilNet(s.choiceOptimizer, n, c) : null;
        const uSec = s.choiceSecretary !== null ? utilNet(s.choiceSecretary, s.kSecretary, c) : null;
        const winner = (uS !== null && uO !== null && uSec !== null)
          ? uS >= uO && uS >= uSec ? 'satisficer' : uSec >= uO ? 'secretario' : 'optimizador'
          : null;
        ctx.textAlign = 'center';
        ctx.font = 'bold 13px ui-sans-serif, system-ui';
        if (winner === 'satisficer') {
          ctx.fillStyle = C_SATIS;
          ctx.fillText('¡TÚ ganaste! Buscar suficiente fue lo más inteligente.', W / 2, H - PAD_BOT + 18);
        } else if (winner === 'secretario') {
          ctx.fillStyle = C_SEC;
          ctx.fillText('La regla del 37% gana — matemáticamente óptima con tiempo ilimitado.', W / 2, H - PAD_BOT + 18);
        } else if (winner === 'optimizador') {
          ctx.fillStyle = C_OPT;
          ctx.fillText('El optimizador ganó — pero pagó el costo de buscar TODO.', W / 2, H - PAD_BOT + 18);
        }
        if (frameCount % 10 === 0 && uS !== null && uO !== null && uSec !== null) {
          setStats({
            utilSatisficer: uS,
            utilOptimizer: uO,
            utilSecretary: uSec,
            kSatisficer: s.kSatisficer,
            kOptimizer: n,
            kSecretary: s.kSecretary,
          });
        }
      } else {
        if (frameCount % 6 === 0) {
          setStats(prev => ({
            ...prev,
            kSatisficer: s.kSatisficer,
            kOptimizer: s.kOptimizer,
            kSecretary: s.kSecretary,
          }));
        }
      }
      frameCount++;
    }

    function loop(now: number) {
      const p = paramsRef.current;
      const s = searchRef.current;
      const allDone = s.doneSatisficer && s.doneOptimizer && s.doneSecretary;

      if (p.running && !allDone) {
        // Avanza según la velocidad elegida
        const msBetweenSteps = 1000 / p.speed;
        if (now - lastStepTime >= msBetweenSteps) {
          // Hacemos tantos pasos como toque según la velocidad
          const steps = Math.max(1, Math.round((now - lastStepTime) / msBetweenSteps));
          let newS = searchRef.current;
          for (let i = 0; i < steps; i++) {
            const done = newS.doneSatisficer && newS.doneOptimizer && newS.doneSecretary;
            if (!done) newS = stepSearch(newS, p);
          }
          searchRef.current = newS;
          lastStepTime = now;
        }
      }

      draw(now);
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  /* ─────────── UI handlers ─────────── */
  const handleReset = () => {
    const n = paramsRef.current.N;
    searchRef.current = initSearch(n);
    setRunning(false);
    setStats({
      utilSatisficer: null, utilOptimizer: null, utilSecretary: null,
      kSatisficer: 0, kOptimizer: 0, kSecretary: 0,
    });
  };

  const allDone = stats.utilSatisficer !== null;
  const winner = allDone
    ? stats.utilSatisficer! >= stats.utilOptimizer! && stats.utilSatisficer! >= stats.utilSecretary!
      ? 'satisficer'
      : stats.utilSecretary! >= stats.utilOptimizer!
        ? 'secretario'
        : 'optimizador'
    : null;

  const insight = !allDone
    ? 'Dale play y observa cómo los tres agentes buscan entre las mismas opciones. ¿Quién termina con más utilidad neta?'
    : winner === 'satisficer'
      ? `Tu umbral de aspiración (${aspiration}) estaba bien calibrado: aceptaste rápido una opción buena y no pagaste el costo de buscar más. Eso es racionalidad acotada ganándole a la "optimización perfecta".`
      : winner === 'secretario'
        ? 'La regla del 37% ganó: explorar sin comprometerse la primera tercera parte y luego aceptar la primera mejor-que-todo-lo-visto es matemáticamente óptima. Pero requiere calcular el umbral exacto.'
        : `El optimizador exhaustivo ganó porque el costo de buscar era bajo (${cost.toFixed(1)}) relativo al valor de encontrar el máximo. Sube el costo y el satisficer vuelve a ganar.`;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* ── Canvas + controles ── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#05060A] block touch-none"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Botones */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setRunning(v => !v)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#FDB813]/40 bg-[#FDB813]/10 text-[#FDB813] hover:bg-[#FDB813]/20 transition"
            >
              {running ? '⏸ pausa' : '▶ play'}
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#334155] text-[#94A3B8] hover:text-[#CBD5E1] transition"
            >
              ↺ nuevo mercado
            </button>
            <span className="text-[10px] font-mono text-[#475569]">
              {allDone ? '✓ búsqueda terminada' : running ? `buscando… ${stats.kSatisficer}/${N}` : 'pausado'}
            </span>
          </div>

          {/* Stats de utilidad */}
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="Tú (satisficer)"
              value={stats.utilSatisficer !== null ? `${stats.utilSatisficer.toFixed(1)}` : '—'}
              sub={`k=${stats.kSatisficer}`}
              accent={C_SATIS}
              highlight={winner === 'satisficer'}
            />
            <Stat
              label="Secretario 37%"
              value={stats.utilSecretary !== null ? `${stats.utilSecretary.toFixed(1)}` : '—'}
              sub={`k=${stats.kSecretary}`}
              accent={C_SEC}
              highlight={winner === 'secretario'}
            />
            <Stat
              label="Optimizador"
              value={stats.utilOptimizer !== null ? `${stats.utilOptimizer.toFixed(1)}` : '—'}
              sub={`k=${N} (todos)`}
              accent={C_OPT}
              highlight={winner === 'optimizador'}
            />
          </div>

          {/* Insight dinámico */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#FDB813] font-mono mb-2">
              ✦ ¿Qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── Panel de controles ── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Configura el mercado
          </div>

          <Slider
            label="Opciones en el mercado"
            value={N}
            min={10}
            max={60}
            step={5}
            onChange={v => { setN(v); }}
            fmt={v => `${v} opciones`}
            hint={`Regla del 37%: explora las primeras ${secretaryThreshold(N)} y ya acepta.`}
          />

          <Slider
            label="Costo de buscar una opción"
            value={cost}
            min={0.2}
            max={4}
            step={0.1}
            onChange={setCost}
            fmt={v => `${v.toFixed(1)} pts`}
            hint="Si cuesta mucho buscar, el satisficer gana. Si cuesta poco, el optimizador puede ganar."
          />

          <Slider
            label="Tu nivel de aspiración"
            value={aspiration}
            min={20}
            max={95}
            step={1}
            onChange={setAspiration}
            fmt={v => `${v} / 100`}
            hint="Si pides demasiado (≥90), casi nunca llegas y terminas con la última opción. Si pides poco (≤40), aceptas basura."
          />

          <Slider
            label="Velocidad de búsqueda"
            value={speed}
            min={1}
            max={20}
            step={1}
            onChange={setSpeed}
            fmt={v => `${v}x`}
            hint="Velocidad visual. No afecta el resultado matemático."
          />

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo: búsqueda secuencial<br />
            utilidad neta = valor − k·costo<br />
            umbral secretario = ⌊N/e⌋ ≈ 37%·N<br />
            (Simon 1955 · Lindley 1961)
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Sub-componentes ─────────────────────────── */

function Stat({
  label, value, sub, accent, highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="bg-[#0B0F17] border rounded-lg p-3 transition"
      style={{
        borderColor: highlight ? accent : '#1E293B',
        boxShadow: highlight ? `0 0 10px ${accent}33` : 'none',
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">
        {label}
      </div>
      <div className="text-[20px] font-bold font-mono" style={{ color: accent }}>
        {value} <span className="text-[10px] text-[#64748B]">pts</span>
      </div>
      {sub && (
        <div className="text-[10px] font-mono text-[#475569] mt-0.5">{sub} buscadas</div>
      )}
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
