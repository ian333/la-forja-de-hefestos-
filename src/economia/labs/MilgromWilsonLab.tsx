/**
 * MilgromWilsonLab — laboratorio del premio 2020 (Milgrom & Wilson).
 *
 * El click: en una subasta de VALOR COMÚN (todos quieren lo mismo que vale
 * lo mismo para todos, como un bloque petrolero), la estrategia óptima
 * no es pujar tu estimación del valor — ¡es pujar MENOS!
 * El ganador suele ser el más optimista, no el más inteligente: eso se
 * llama la Maldición del Ganador (Winner's Curse).
 *
 * Modelo económico REAL:
 *   - Valor verdadero V ~ Uniforme(Vmin, Vmax), desconocido para los postores.
 *   - Cada postor i recibe señal: s_i = V + ε_i, donde ε_i ~ N(0, σ).
 *   - Estrategia óptima en subasta de primer precio con N postores y valor común:
 *       b_i = s_i − E[ε_(N:N)] ≈ s_i − σ·√(2·ln(N))   (orden estadístico máx.)
 *     La corrección de la maldición del ganador es exactamente ese descuento.
 *   - Subasta de segundo precio (Vickrey): estrategia dominante = pujar valor
 *     esperado dado que eres el ganador: b = E[V | s_i = max(señales)]
 *     También menor que s_i para valor común.
 *
 *   Winner's curse: si no corriges, en promedio
 *       Ganancia esperada = V - b_ganador < 0
 *   Con corrección óptima la ganancia esperada es ≈ 0 en equilibrio.
 *
 * El lab muestra N rondas acumuladas; cada ronda:
 *   1. Se sortea V y N señales (una por postor, incluyendo al "usuario").
 *   2. Los bots pujan con o sin corrección según el modo.
 *   3. Gana el mayor. Se registra si el ganador tuvo ganancia o pérdida.
 *   4. El canvas dibuja el historial de ganancias del ganador.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Dimensiones del canvas ───────────────────────────────────────────────────
const W = 820;
const H = 380;

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Params {
  nBidders: number;      // total de postores incluyendo al usuario
  sigma: number;         // ruido de las señales
  format: 'first' | 'second'; // tipo de subasta
  correction: boolean;   // ¿usan corrección de maldición del ganador?
  paused: boolean;
}

interface Round {
  trueValue: number;
  signals: number[];       // señal de cada postor
  bids: number[];          // puja de cada postor
  winnerIdx: number;       // quién ganó
  winnerBid: number;
  winnerSignal: number;
  profit: number;          // trueValue − precio pagado (puede ser negativo)
  pricePaid: number;
}

interface SimState {
  rounds: Round[];
  running: boolean;
}

const DEFAULTS: Params = {
  nBidders: 5,
  sigma: 15,
  format: 'first',
  correction: false,
  paused: false,
};

const V_MIN = 40;
const V_MAX = 160;
const MAX_ROUNDS = 80;
const ROUND_INTERVAL_MS = 600; // ms entre rondas automáticas

// ─── Utilidades matemáticas ───────────────────────────────────────────────────

/** Box-Muller: normal estándar desde Math.random */
function randNormal(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Corrección óptima para subasta de 1er precio con N postores, valor común.
 * Aproximación: E[ε_(N:N) | valor común] ≈ σ · Φ⁻¹((N-0.375)/(N+0.25))
 * Usamos la aproximación de quantiles de Blom: más precisa que √(2·ln N).
 */
function winnerCurseCorrection(n: number, sigma: number): number {
  if (n <= 1) return 0;
  // quantil de orden (N-0.375)/(N+0.25) de normal estándar — aprox Blom
  const p = (n - 0.375) / (n + 0.25);
  // rational approx de Φ⁻¹(p) (algoritmo AS241, preciso a 7 decimales)
  function normalInvCDF(pp: number): number {
    if (pp <= 0) return -6; if (pp >= 1) return 6;
    const a = [3.3871328727963666080e0, 1.3314166789178437745e2, 1.9715909503065514427e3,
               1.3731693765509461125e4, 4.5921953931549871457e4, 6.7265770927008700853e4,
               3.3430575583588128105e4, 2.5090809287301226727e3];
    const b = [1.0, 4.2313330701600911252e1, 6.8718700749205790830e2, 5.3941960214247511077e3,
               2.1213794301586595867e4, 3.9307895800092710610e4, 2.8729085735721942674e4, 5.2264952788528545610e3];
    const c = [1.42343711074721209144e0, 4.63033784615654529590e0, 5.76949722146864628717e0,
               3.64784832476320460504e0, 1.27045825245236838258e0, 2.41780725177450611770e-1,
               2.27001535109994502416e-2, 7.74545433978927258793e-4];
    const d = [1.0, 2.05319162663775882187e0, 1.67638483950684308090e0, 6.89767334985100004550e-1,
               1.48103976427480074590e-1, 1.51986665636164571966e-2, 5.47593808499534494600e-4, 1.05075007164441684324e-9];
    const e = [6.65790464350110377720e0, 5.46378491116411436990e0, 1.78482653991729133580e0,
               2.96560571828504891230e-1, 2.65321895943399497153e-2, 1.24266094738807843860e-3,
               2.71155556874348757815e-5, 2.01033439929228813265e-7];
    const f = [1.0, 5.99832206555887937690e-1, 1.36929880922735805310e-1, 1.48753612908506508940e-2,
               7.86869131145613259100e-4, 1.84631831751005468180e-5, 1.42151175831644588870e-7, 2.04426310338993978564e-15];
    const q = pp - 0.5;
    if (Math.abs(q) <= 0.425) {
      const r = 0.180625 - q * q;
      return q * (((((((a[7]*r+a[6])*r+a[5])*r+a[4])*r+a[3])*r+a[2])*r+a[1])*r+a[0]) /
                  (((((((b[7]*r+b[6])*r+b[5])*r+b[4])*r+b[3])*r+b[2])*r+b[1])*r+b[0]);
    }
    const r0 = pp < 0.5 ? pp : 1 - pp;
    const r = Math.sqrt(-Math.log(r0));
    let val: number;
    if (r <= 5) {
      const rr = r - 1.6;
      val = (((((((c[7]*rr+c[6])*rr+c[5])*rr+c[4])*rr+c[3])*rr+c[2])*rr+c[1])*rr+c[0]) /
            (((((((d[7]*rr+d[6])*rr+d[5])*rr+d[4])*rr+d[3])*rr+d[2])*rr+d[1])*rr+d[0]);
    } else {
      const rr = r - 5;
      val = (((((((e[7]*rr+e[6])*rr+e[5])*rr+e[4])*rr+e[3])*rr+e[2])*rr+e[1])*rr+e[0]) /
            (((((((f[7]*rr+f[6])*rr+f[5])*rr+f[4])*rr+f[3])*rr+f[2])*rr+f[1])*rr+f[0]);
    }
    return pp < 0.5 ? -val : val;
  }
  return sigma * normalInvCDF(p);
}

function computeBid(signal: number, n: number, sigma: number, format: 'first' | 'second', applyCorrection: boolean): number {
  if (!applyCorrection) {
    // Sin corrección: puja = señal directamente (naive)
    return Math.max(0, signal);
  }
  // Con corrección: resta la maldición del ganador esperada
  const correction = winnerCurseCorrection(n, sigma);
  // Subasta de 2do precio es conceptualmente equivalente en valor común:
  // la corrección óptima es similar pero el equilibrio difiere.
  // Para simplificar el lab usamos la misma corrección en ambos formatos
  // y el formato de 2do precio solo cambia el precio pagado.
  const corrected = signal - correction;
  // En subasta de primer precio hay un descuento adicional por la competencia
  const firstPriceShading = format === 'first' ? sigma * 0.12 * Math.log(Math.max(2, n)) : 0;
  return Math.max(0, corrected - firstPriceShading);
}

function runRound(params: Params): Round {
  const { nBidders, sigma, format, correction } = params;
  const V = V_MIN + Math.random() * (V_MAX - V_MIN);
  const signals: number[] = Array.from({ length: nBidders }, () => V + randNormal() * sigma);
  const bids: number[] = signals.map(s => computeBid(s, nBidders, sigma, format, correction));

  // Ganador = mayor puja
  let winnerIdx = 0;
  for (let i = 1; i < bids.length; i++) {
    if (bids[i] > bids[winnerIdx]) winnerIdx = i;
  }
  const winnerBid = bids[winnerIdx];

  // Precio pagado
  let pricePaid: number;
  if (format === 'first') {
    pricePaid = winnerBid;
  } else {
    // Segundo precio: paga el mayor de los demás
    const others = bids.filter((_, i) => i !== winnerIdx);
    pricePaid = others.length > 0 ? Math.max(...others) : winnerBid;
  }

  const profit = V - pricePaid;

  return {
    trueValue: V,
    signals,
    bids,
    winnerIdx,
    winnerBid,
    winnerSignal: signals[winnerIdx],
    profit,
    pricePaid,
  };
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function MilgromWilsonLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS });
  const simRef = useRef<SimState>({ rounds: [], running: false });
  const timerRef = useRef<number>(0);

  const [nBidders, setNBidders] = useState(DEFAULTS.nBidders);
  const [sigma, setSigma] = useState(DEFAULTS.sigma);
  const [format, setFormat] = useState<'first' | 'second'>(DEFAULTS.format);
  const [correction, setCorrection] = useState(DEFAULTS.correction);
  const [paused, setPaused] = useState(DEFAULTS.paused);
  const [stats, setStats] = useState({ rounds: 0, avgProfit: 0, pctNeg: 0, lastProfit: 0 });

  useEffect(() => {
    paramsRef.current = { nBidders, sigma, format, correction, paused };
  }, [nBidders, sigma, format, correction, paused]);

  // ─── Loop de canvas ────────────────────────────────────────────────────────
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

    function draw() {
      if (!ctx) return;
      const sim = simRef.current;
      const rounds = sim.rounds;
      const p = paramsRef.current;

      // Fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── Área de gráfica ────────────────────────────────────────────────────
      const MARGIN_L = 68, MARGIN_R = 24, MARGIN_T = 36, MARGIN_B = 60;
      const GW = W - MARGIN_L - MARGIN_R;
      const GH = H - MARGIN_T - MARGIN_B;

      // Grid horizontal (referencia de ganancia 0)
      const PROFIT_RANGE = 80; // ±80 en la vista
      const profitToY = (profit: number) =>
        MARGIN_T + GH / 2 - (profit / PROFIT_RANGE) * (GH / 2);

      // Línea del cero
      const yZero = profitToY(0);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(MARGIN_L, yZero);
      ctx.lineTo(W - MARGIN_R, yZero);
      ctx.stroke();
      ctx.setLineDash([]);

      // Etiquetas del eje Y
      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'right';
      [-60, -30, 0, 30, 60].forEach(v => {
        const y = profitToY(v);
        if (y >= MARGIN_T && y <= MARGIN_T + GH) {
          ctx.fillText(`${v > 0 ? '+' : ''}${v}`, MARGIN_L - 6, y + 3);
          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(MARGIN_L, y);
          ctx.lineTo(W - MARGIN_R, y);
          ctx.stroke();
        }
      });

      // Label eje Y
      ctx.save();
      ctx.translate(14, MARGIN_T + GH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ganancia del ganador ($)', 0, 0);
      ctx.restore();

      // Eje X (rondas)
      ctx.fillStyle = '#475569';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('rondas →', MARGIN_L + GW / 2, H - 8);

      if (rounds.length === 0) {
        ctx.fillStyle = '#4FC3F7';
        ctx.font = '14px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Presiona ▶ Iniciar subasta para ver la maldición del ganador', W / 2, H / 2);
        raf = requestAnimationFrame(draw);
        return;
      }

      // Línea de ganancias acumuladas
      const showCount = Math.min(rounds.length, MAX_ROUNDS);
      const startIdx = Math.max(0, rounds.length - MAX_ROUNDS);
      const xOf = (idx: number) => MARGIN_L + ((idx) / Math.max(1, Math.min(rounds.length, MAX_ROUNDS) - 1)) * GW;

      // Área bajo la curva (relleno)
      ctx.beginPath();
      for (let i = 0; i < showCount; i++) {
        const round = rounds[startIdx + i];
        const x = xOf(i);
        const y = Math.max(MARGIN_T, Math.min(MARGIN_T + GH, profitToY(round.profit)));
        if (i === 0) ctx.moveTo(x, yZero);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(xOf(showCount - 1), yZero);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, MARGIN_T, 0, MARGIN_T + GH);
      gradient.addColorStop(0, 'rgba(239,68,68,0.18)');
      gradient.addColorStop(0.5, 'rgba(52,211,153,0.07)');
      gradient.addColorStop(1, 'rgba(239,68,68,0.18)');
      ctx.fillStyle = gradient;
      ctx.fill();

      // Línea de ganancias por ronda (barras verticales delgadas)
      for (let i = 0; i < showCount; i++) {
        const round = rounds[startIdx + i];
        const x = xOf(i);
        const profit = round.profit;
        const y = Math.max(MARGIN_T, Math.min(MARGIN_T + GH, profitToY(profit)));
        const barColor = profit >= 0 ? '#34D399' : '#EF4444';
        ctx.strokeStyle = barColor;
        ctx.lineWidth = Math.max(1, GW / MAX_ROUNDS - 1);
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(x, yZero);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Media móvil (ventana de 10 rondas)
      const MA_WINDOW = 10;
      if (rounds.length >= MA_WINDOW) {
        ctx.beginPath();
        ctx.strokeStyle = p.correction ? '#4FC3F7' : '#FDB813';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        for (let i = MA_WINDOW - 1; i < showCount; i++) {
          const slice = rounds.slice(startIdx + i - MA_WINDOW + 1, startIdx + i + 1);
          const avg = slice.reduce((s, r) => s + r.profit, 0) / slice.length;
          const x = xOf(i);
          const y = Math.max(MARGIN_T, Math.min(MARGIN_T + GH, profitToY(avg)));
          if (i === MA_WINDOW - 1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Última ronda: burbuja de detalle
      if (rounds.length > 0) {
        const last = rounds[rounds.length - 1];
        const lx = xOf(Math.min(showCount - 1, MAX_ROUNDS - 1));
        const ly = profitToY(last.profit);
        const lyClipped = Math.max(MARGIN_T + 4, Math.min(MARGIN_T + GH - 4, ly));
        ctx.save();
        ctx.shadowColor = last.profit >= 0 ? '#34D399' : '#EF4444';
        ctx.shadowBlur = 12;
        ctx.fillStyle = last.profit >= 0 ? '#34D399' : '#EF4444';
        ctx.beginPath();
        ctx.arc(lx, lyClipped, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Texto de la última ronda
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 11px ui-monospace, monospace';
        ctx.textAlign = 'left';
        const textX = Math.min(lx + 10, W - MARGIN_R - 90);
        ctx.fillStyle = last.profit >= 0 ? '#34D399' : '#EF4444';
        ctx.fillText(`${last.profit >= 0 ? '+' : ''}$${last.profit.toFixed(1)}`, textX, lyClipped - 6);
        ctx.fillStyle = '#94A3B8';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(`val=$${last.trueValue.toFixed(0)} señal=$${last.winnerSignal.toFixed(0)} pujó=$${last.winnerBid.toFixed(0)}`, textX, lyClipped + 10);
      }

      // Título del gráfico
      ctx.fillStyle = '#94A3B8';
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(
        `${p.correction ? 'CON corrección' : 'SIN corrección'} · subasta ${p.format === 'first' ? '1er' : '2do'} precio · ${p.nBidders} postores · ruido σ=${p.sigma}`,
        MARGIN_L + 4, MARGIN_T - 6,
      );

      // Línea de media móvil — leyenda
      if (rounds.length >= MA_WINDOW) {
        ctx.fillStyle = p.correction ? '#4FC3F7' : '#FDB813';
        ctx.fillRect(W - MARGIN_R - 110, MARGIN_T - 6, 10, 3);
        ctx.fillStyle = '#94A3B8';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('media móvil (10)', W - MARGIN_R - 96, MARGIN_T - 4);
      }

      if (p.paused) {
        ctx.fillStyle = 'rgba(5,6,10,0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 15px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⏸ en pausa', W / 2, H / 2);
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ─── Timer de rondas automáticas ──────────────────────────────────────────
  const scheduleRound = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      if (paramsRef.current.paused) return;
      if (!simRef.current.running) return;
      const round = runRound(paramsRef.current);
      simRef.current.rounds.push(round);
      if (simRef.current.rounds.length > MAX_ROUNDS * 3) {
        simRef.current.rounds.splice(0, 1);
      }
      const rounds = simRef.current.rounds;
      const avgProfit = rounds.reduce((s, r) => s + r.profit, 0) / rounds.length;
      const pctNeg = (rounds.filter(r => r.profit < 0).length / rounds.length) * 100;
      setStats({ rounds: rounds.length, avgProfit, pctNeg, lastProfit: round.profit });
    }, ROUND_INTERVAL_MS);
  }, []);

  const handleStart = useCallback(() => {
    simRef.current.running = true;
    simRef.current.rounds = [];
    setStats({ rounds: 0, avgProfit: 0, pctNeg: 0, lastProfit: 0 });
    scheduleRound();
  }, [scheduleRound]);

  const handleReset = useCallback(() => {
    clearInterval(timerRef.current);
    simRef.current.running = false;
    simRef.current.rounds = [];
    setStats({ rounds: 0, avgProfit: 0, pctNeg: 0, lastProfit: 0 });
  }, []);

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  // ─── Insight dinámico ─────────────────────────────────────────────────────
  const insight = (() => {
    if (stats.rounds < 5) return 'Observa el historial de ganancias del ganador de cada subasta. Cada barra roja es una ronda perdida — el ganador pagó más de lo que valía el bien.';
    if (!correction && stats.pctNeg > 55) return `Maldición del ganador en acción: el ${stats.pctNeg.toFixed(0)}% de las rondas el ganador pierde dinero. Ganó la subasta, perdió el negocio.`;
    if (!correction && stats.avgProfit < 0) return `Ganancia media del ganador: $${stats.avgProfit.toFixed(1)} — negativa. Ganar consistentemente pierde dinero sin corrección. Activa "Con corrección" para ver la diferencia.`;
    if (correction && stats.avgProfit >= -3) return `Con corrección la ganancia media es $${stats.avgProfit.toFixed(1)} ≈ 0. El postor que se corrige ya no es víctima del ganador más optimista.`;
    return `Rondas: ${stats.rounds} | media: $${stats.avgProfit.toFixed(1)} | ${stats.pctNeg.toFixed(0)}% perdedoras.`;
  })();

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Controles principales */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleStart}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399] hover:bg-[#34D399]/20 transition"
            >
              ▶ Iniciar subasta
            </button>
            <button
              onClick={() => setPaused(v => !v)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7] hover:bg-[#4FC3F7]/20 transition"
            >
              {paused ? '▶ reanudar' : '⏸ pausa'}
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1] transition"
            >
              ↺ reiniciar
            </button>
            <button
              onClick={() => setCorrection(v => !v)}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                correction
                  ? 'border-[#4FC3F7]/50 bg-[#4FC3F7]/10 text-[#4FC3F7]'
                  : 'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]'
              }`}
            >
              {correction ? '✓ Con corrección' : '✗ Sin corrección'}
            </button>
            <button
              onClick={() => setFormat(v => v === 'first' ? 'second' : 'first')}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#A78BFA]/40 bg-[#A78BFA]/10 text-[#A78BFA] hover:bg-[#A78BFA]/20 transition"
            >
              {format === 'first' ? '1er precio' : '2do precio (Vickrey)'}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="ganancia media"
              value={stats.rounds > 0 ? `$${stats.avgProfit.toFixed(1)}` : '—'}
              accent={stats.avgProfit >= 0 ? '#34D399' : '#EF4444'}
            />
            <Stat
              label="rondas con pérdida"
              value={stats.rounds > 0 ? `${stats.pctNeg.toFixed(0)}%` : '—'}
              accent={stats.pctNeg > 50 ? '#EF4444' : '#FDB813'}
            />
            <Stat
              label="última ronda"
              value={stats.rounds > 0 ? `${stats.lastProfit >= 0 ? '+' : ''}$${stats.lastProfit.toFixed(1)}` : '—'}
              accent={stats.lastProfit >= 0 ? '#34D399' : '#EF4444'}
            />
          </div>

          {/* Panel de insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#A78BFA] font-mono mb-2">✦ ¿Qué estás viendo?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* Panel de controles */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ Diseña la subasta</div>

          <Slider
            label="Número de postores"
            value={nBidders}
            min={2}
            max={12}
            step={1}
            onChange={v => { setNBidders(v); handleReset(); }}
            fmt={v => `${v} postores`}
            hint="Más postores = maldición más fuerte. El ganador entre 10 está más sesgado que entre 2."
          />

          <Slider
            label="Ruido de las señales (σ)"
            value={sigma}
            min={3}
            max={40}
            step={1}
            onChange={v => { setSigma(v); handleReset(); }}
            fmt={v => `σ = ${v}`}
            hint="Mayor ruido = más diferencia entre la señal y el valor real. La maldición crece con σ."
          />

          <div className="space-y-2 text-[11px] text-[#64748B] border-t border-[#1E293B] pt-3 leading-relaxed">
            <div className="text-[#A78BFA] font-mono text-[10px] uppercase tracking-widest mb-1">Modelo real</div>
            <div>V ~ U(40,160) — valor común desconocido</div>
            <div>sᵢ = V + εᵢ, εᵢ ~ N(0, σ)</div>
            <div>Corrección óptima:</div>
            <div className="text-[#E2E8F0]">b* = sᵢ − σ · Φ⁻¹((N−0.375)/(N+0.25))</div>
            <div className="mt-1">Milgrom & Wilson (Econometrica 1982)</div>
          </div>

          {/* Explicación del formato */}
          <div className="text-[11px] text-[#64748B] border-t border-[#1E293B] pt-3 leading-relaxed">
            <span className="text-[#A78BFA]">1er precio</span>: gana el mayor, paga su puja.<br />
            <span className="text-[#A78BFA]">2do precio</span>: gana el mayor, paga el segundo.<br />
            <span className="text-[#64748B]">En valor común ambos sufren la maldición sin corrección.</span>
          </div>
        </div>
      </div>

      {/* Panel educativo inferior */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <InfoCard
          title="La Maldición del Ganador"
          accent="#EF4444"
          text="En valor común, la señal más alta es la más optimista — no la más correcta. El ganador suele ser quien más sobreestimó el valor. Sin corrección, ganar la subasta es perder el dinero."
        />
        <InfoCard
          title="La corrección óptima"
          accent="#4FC3F7"
          text={`Descuenta σ · Φ⁻¹((N-0.375)/(N+0.25)) de tu señal antes de pujar. Con N=${nBidders} y σ=${sigma} eso es ~$${winnerCurseCorrection(nBidders, sigma).toFixed(1)} de descuento. No es timidez: es matemática.`}
        />
        <InfoCard
          title="Por qué importa en México"
          accent="#A78BFA"
          text="El IFT subastó el espectro 5G. Pemex licita bloques petroleros. La CFE adjudica contratos. Si la subasta está mal diseñada, gana el más atrevido — no el más eficiente — y el país pierde miles de millones."
        />
      </div>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[19px] font-bold font-mono" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function Slider({
  label, value, min, max, step, onChange, fmt, hint,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[12px] font-mono text-[#FDB813]">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#A78BFA]"
      />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}

function InfoCard({ title, accent, text }: { title: string; accent: string; text: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
      <div className="text-[11px] font-bold font-mono mb-2" style={{ color: accent }}>{title}</div>
      <p className="text-[12px] text-[#94A3B8] leading-relaxed">{text}</p>
    </div>
  );
}
