/**
 * EngleGrangerLab — laboratorio del premio 2003 (Robert Engle + Clive Granger).
 *
 * DOS mecanismos en UN canvas:
 *
 * ── PANEL A: ARCH/GARCH (Engle) ──────────────────────────────────────────
 * El modelo GARCH(1,1) real:
 *   ε_t = σ_t · z_t,   z_t ~ N(0,1)
 *   σ²_t = ω + α·ε²_{t-1} + β·σ²_{t-1}
 *
 * Parámetros: ω>0, α≥0, β≥0, α+β<1 (estacionariedad).
 * El usuario controla α (impacto de shocks) y β (persistencia de volatilidad).
 * Cuando α+β→1, la volatilidad es muy persistente (mercados en crisis).
 *
 * ── PANEL B: Cointegración (Granger) ─────────────────────────────────────
 * Dos caminatas aleatorias cointegradas con error-correction:
 *   X_t = X_{t-1} + u_t                      (random walk)
 *   Y_t = Y_{t-1} + γ(X_{t-1} - Y_{t-1}) + v_t   (error correction)
 *
 * γ es la velocidad de ajuste (0..1). Cuando γ=0, Y_t es un random walk puro
 * y no hay cointegración. Cuando γ>0, Y_t "jala" de vuelta hacia X_t.
 * El spread S_t = X_t - Y_t oscila alrededor de 0 → series cointegradas.
 *
 * El usuario ve las dos series y el spread. Puede matar la cointegración con
 * γ=0 y ver cómo el spread se "aleja para siempre" (divergencia).
 */

import { useEffect, useRef, useState } from 'react';

// ── Dimensiones ────────────────────────────────────────────────────────────
const W = 820;
const H = 420;
const PANEL_H = H / 2 - 10;   // altura de cada sub-panel
const PAD_L = 52;
const PAD_R = 16;
const PAD_TOP = 18;
const PAD_BOT = 8;
const N = 300;                  // puntos históricos visibles

// ── Estado de simulación (NO React, en un ref) ─────────────────────────────
interface SimState {
  // ARCH series
  archReturns: number[];   // ε_t
  archSigma: number[];     // σ_t
  archPrice: number[];     // precio acumulado (para visual)

  // Coint series
  serX: number[];
  serY: number[];
  spread: number[];

  // Parámetros actuales
  alpha: number;           // ARCH impact
  beta: number;            // ARCH persistence
  gamma: number;           // speed of adjustment (coint)
  omega: number;           // ARCH baseline variance
  paused: boolean;
}

// ── RNG Box-Muller (usa Math.random del navegador) ─────────────────────────
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ── Helpers de dibujo ──────────────────────────────────────────────────────
function normalize(arr: number[], lo: number, hi: number, yTop: number, yBot: number): number[] {
  const range = hi - lo || 1;
  return arr.map(v => yTop + ((hi - v) / range) * (yBot - yTop));
}

function polyline(ctx: CanvasRenderingContext2D, xs: number[], ys: number[]) {
  if (xs.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(xs[0], ys[0]);
  for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i], ys[i]);
  ctx.stroke();
}

// ── Colores ────────────────────────────────────────────────────────────────
const C_BG = '#0B0F17';
const C_PANEL = '#070A11';
const C_BORDER = '#1E293B';
const C_ARCH_PRICE = '#4FC3F7';
const C_ARCH_VOL = '#F59E0B';
const C_X = '#34D399';
const C_Y = '#F472B6';
const C_SPREAD = '#A78BFA';
const C_GRID = 'rgba(30,41,59,0.7)';
const C_ZERO = 'rgba(100,116,139,0.5)';
const C_TEXT = '#94A3B8';
const C_ACCENT = '#E2E8F0';

// ── Función principal ──────────────────────────────────────────────────────
export default function EngleGrangerLab() {
  // Parámetros controlables
  const [alpha, setAlpha] = useState(0.15);
  const [beta, setBeta]   = useState(0.80);
  const [gamma, setGamma] = useState(0.12);
  const [paused, setPaused] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef    = useRef<SimState | null>(null);
  const paramsRef = useRef({ alpha, beta, gamma, paused });

  // ── Sincronizar parámetros con el sim ────────────────────────────────────
  useEffect(() => {
    paramsRef.current = { alpha, beta, gamma, paused };
    if (simRef.current) {
      simRef.current.alpha  = alpha;
      simRef.current.beta   = beta;
      simRef.current.gamma  = gamma;
      simRef.current.paused = paused;
    }
  }, [alpha, beta, gamma, paused]);

  // ── Inicializar simulación ────────────────────────────────────────────────
  function initSim(a: number, b: number, g: number): SimState {
    // Quemamos 50 pasos de warm-up
    const omega = 0.0002;
    const archR: number[] = [];
    const archS: number[] = [];
    const archP: number[] = [];
    let sig2 = omega / (1 - a - b);
    let price = 100;
    for (let i = 0; i < N; i++) {
      const eps = Math.sqrt(sig2) * randn();
      price += eps * price * 0.1;
      archR.push(eps);
      archS.push(Math.sqrt(sig2));
      archP.push(price);
      sig2 = omega + a * eps * eps + b * sig2;
      sig2 = Math.max(sig2, omega);
    }

    const serX: number[] = [];
    const serY: number[] = [];
    const spread: number[] = [];
    let x = 0, y = 0;
    for (let i = 0; i < N; i++) {
      x = x + 0.4 * randn();
      const err = x - y;
      y = y + g * err + 0.4 * randn();
      serX.push(x);
      serY.push(y);
      spread.push(x - y);
    }

    return { archReturns: archR, archSigma: archS, archPrice: archP, serX, serY, spread, alpha: a, beta: b, gamma: g, omega, paused: false };
  }

  // ── Loop de animación ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    const p = paramsRef.current;
    simRef.current = initSim(p.alpha, p.beta, p.gamma);

    let raf = 0;
    let tickCount = 0;

    function stepSim() {
      const sim = simRef.current!;
      const { alpha: a, beta: b, gamma: g, omega } = sim;

      // ARCH step
      const lastEps = sim.archReturns[sim.archReturns.length - 1] ?? 0;
      const lastSig2 = (sim.archSigma[sim.archSigma.length - 1] ?? 0.01) ** 2;
      let sig2 = omega + a * lastEps * lastEps + b * lastSig2;
      sig2 = Math.max(sig2, omega);
      const eps = Math.sqrt(sig2) * randn();
      const lastPrice = sim.archPrice[sim.archPrice.length - 1] ?? 100;
      const newPrice = Math.max(1, lastPrice + eps * lastPrice * 0.1);

      sim.archReturns.push(eps);
      sim.archSigma.push(Math.sqrt(sig2));
      sim.archPrice.push(newPrice);
      if (sim.archReturns.length > N) { sim.archReturns.shift(); sim.archSigma.shift(); sim.archPrice.shift(); }

      // Coint step
      const lastX = sim.serX[sim.serX.length - 1] ?? 0;
      const lastY = sim.serY[sim.serY.length - 1] ?? 0;
      const newX = lastX + 0.4 * randn();
      const err = lastX - lastY;
      const newY = lastY + g * err + 0.4 * randn();
      sim.serX.push(newX);
      sim.serY.push(newY);
      sim.spread.push(newX - newY);
      if (sim.serX.length > N) { sim.serX.shift(); sim.serY.shift(); sim.spread.shift(); }
    }

    function draw() {
      const sim = simRef.current!;
      ctx.fillStyle = C_BG;
      ctx.fillRect(0, 0, W, H);

      // Divisor central
      ctx.strokeStyle = C_BORDER;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      drawARCHPanel(ctx, sim);
      drawCointPanel(ctx, sim);

      // Pausa
      if (sim.paused) {
        ctx.fillStyle = 'rgba(5,6,10,0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = C_ACCENT;
        ctx.font = 'bold 15px ui-monospace,monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⏸ en pausa', W / 2, H / 2);
      }
    }

    function drawARCHPanel(ctx: CanvasRenderingContext2D, sim: SimState) {
      const yTop  = PAD_TOP;
      const yBot  = H / 2 - PAD_BOT - 2;
      const xL    = PAD_L;
      const xR    = W - PAD_R;
      const n     = sim.archPrice.length;

      // Fondo panel
      ctx.fillStyle = C_PANEL;
      ctx.fillRect(0, 0, W, H / 2 - 1);

      // Título
      ctx.fillStyle = C_ARCH_PRICE;
      ctx.font = 'bold 11px ui-monospace,monospace';
      ctx.textAlign = 'left';
      ctx.fillText('ENGLE · ARCH/GARCH — volatilidad agrupada', xL, yTop + 12);

      // Labels sigma
      ctx.fillStyle = C_ARCH_VOL;
      ctx.font = '10px ui-monospace,monospace';
      ctx.textAlign = 'right';
      ctx.fillText('σ_t (volatilidad)', xR, yTop + 12);

      // Bandas de precio (la serie)
      const priceMin = Math.min(...sim.archPrice);
      const priceMax = Math.max(...sim.archPrice);
      const yPrice   = normalize(sim.archPrice, priceMin, priceMax, yTop + 22, yBot - 22);

      // Banda de volatilidad (fill ±σ alrededor del precio normalizado)
      const sigMin = 0;
      const sigMax = Math.max(...sim.archSigma) * 1.2 || 0.1;
      const scaleVol = (yBot - yTop - 44) / (sigMax - sigMin);

      // Relleno de volatilidad como banda alrededor del precio
      ctx.beginPath();
      const xs = sim.archPrice.map((_, i) => xL + (i / (N - 1)) * (xR - xL));
      for (let i = 0; i < n; i++) {
        const py = yPrice[i];
        const bw = sim.archSigma[i] * scaleVol * 4;
        if (i === 0) ctx.moveTo(xs[i], py - bw / 2);
        else ctx.lineTo(xs[i], py - bw / 2);
      }
      for (let i = n - 1; i >= 0; i--) {
        const py = yPrice[i];
        const bw = sim.archSigma[i] * scaleVol * 4;
        ctx.lineTo(xs[i], py + bw / 2);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(245,158,11,0.12)';
      ctx.fill();

      // Línea de precio
      ctx.strokeStyle = C_ARCH_PRICE;
      ctx.lineWidth = 1.5;
      polyline(ctx, xs, yPrice);

      // Línea de volatilidad (abajo del panel, escala propia)
      const volScale = normalize(sim.archSigma, 0, sigMax, yBot - 4, yBot - 24);
      ctx.strokeStyle = C_ARCH_VOL;
      ctx.lineWidth = 1.2;
      polyline(ctx, xs, volScale);

      // Ecuación
      const a = sim.alpha, b = sim.beta;
      const lastSig = sim.archSigma[sim.archSigma.length - 1] ?? 0;
      ctx.fillStyle = C_TEXT;
      ctx.font = '10px ui-monospace,monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`σ²_t = ω + ${a.toFixed(2)}·ε²_{t-1} + ${b.toFixed(2)}·σ²_{t-1}   |   α+β=${(a+b).toFixed(2)}   |   σ_actual=${(lastSig*100).toFixed(2)}%`, xL, yBot + 14);

      // Eje Y izq
      ctx.fillStyle = C_TEXT;
      ctx.font = '9px ui-monospace,monospace';
      ctx.textAlign = 'right';
      ctx.fillText(priceMax.toFixed(0), xL - 3, yTop + 25);
      ctx.fillText(priceMin.toFixed(0), xL - 3, yBot - 22);
    }

    function drawCointPanel(ctx: CanvasRenderingContext2D, sim: SimState) {
      const yTop  = H / 2 + PAD_TOP;
      const yBot  = H - PAD_BOT;
      const xL    = PAD_L;
      const xR    = W - PAD_R;
      const n     = sim.serX.length;
      const spreadH = 60; // height reserved for spread at bottom

      // Fondo panel
      ctx.fillStyle = C_PANEL;
      ctx.fillRect(0, H / 2 + 1, W, H / 2 - 1);

      // Título
      ctx.fillStyle = C_X;
      ctx.font = 'bold 11px ui-monospace,monospace';
      ctx.textAlign = 'left';
      ctx.fillText('GRANGER · Cointegración — dos series atadas por debajo', xL, yTop + 12);

      ctx.fillStyle = C_Y;
      ctx.textAlign = 'right';
      ctx.fillText('Y_t', xR, yTop + 12);

      // Área de series (parte superior del panel)
      const seriesYTop = yTop + 22;
      const seriesYBot = yBot - spreadH - 8;

      // All values for scale
      const allVals = [...sim.serX, ...sim.serY];
      const vMin = Math.min(...allVals);
      const vMax = Math.max(...allVals);
      const yX = normalize(sim.serX, vMin, vMax, seriesYTop, seriesYBot);
      const yY = normalize(sim.serY, vMin, vMax, seriesYTop, seriesYBot);
      const xs  = sim.serX.map((_, i) => xL + (i / (N - 1)) * (xR - xL));

      // Línea cero del spread (línea horizontal de referencia)
      const zeroY = seriesYTop + (vMax / (vMax - vMin || 1)) * (seriesYBot - seriesYTop);
      ctx.strokeStyle = C_ZERO;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(xL, zeroY);
      ctx.lineTo(xR, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Serie X (verde)
      ctx.strokeStyle = C_X;
      ctx.lineWidth = 1.6;
      polyline(ctx, xs, yX);

      // Serie Y (rosa)
      ctx.strokeStyle = C_Y;
      ctx.lineWidth = 1.6;
      polyline(ctx, xs, yY);

      // Área sombreada entre X e Y (la brecha = spread)
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (i === 0) ctx.moveTo(xs[i], yX[i]);
        else ctx.lineTo(xs[i], yX[i]);
      }
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(xs[i], yY[i]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(167,139,250,0.08)';
      ctx.fill();

      // ── Spread en la franja inferior ────────────────────────────────────
      const spTop = yBot - spreadH + 4;
      const spBot = yBot - 12;
      const spMax = Math.max(...sim.spread.map(Math.abs)) * 1.2 || 1;
      const ySpread = normalize(sim.spread, -spMax, spMax, spTop, spBot);
      const spZero  = spTop + (spMax / (2 * spMax)) * (spBot - spTop);

      // Línea cero del spread
      ctx.strokeStyle = C_ZERO;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(xL, spZero);
      ctx.lineTo(xR, spZero);
      ctx.stroke();
      ctx.setLineDash([]);

      // Relleno del spread
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (i === 0) ctx.moveTo(xs[i], spZero);
        ctx.lineTo(xs[i], ySpread[i]);
      }
      ctx.lineTo(xs[n - 1], spZero);
      ctx.closePath();
      ctx.fillStyle = 'rgba(167,139,250,0.15)';
      ctx.fill();

      // Línea del spread
      ctx.strokeStyle = C_SPREAD;
      ctx.lineWidth = 1.4;
      polyline(ctx, xs, ySpread);

      // Label spread
      ctx.fillStyle = C_SPREAD;
      ctx.font = '10px ui-monospace,monospace';
      ctx.textAlign = 'left';
      ctx.fillText('spread (X−Y)', xL, spTop - 2);

      // Ecuación + estado
      const g = sim.gamma;
      const lastSpread = sim.spread[sim.spread.length - 1] ?? 0;
      const coIntegrated = g > 0.01;
      ctx.fillStyle = C_TEXT;
      ctx.font = '10px ui-monospace,monospace';
      ctx.textAlign = 'left';
      ctx.fillText(
        `Y_t = Y_{t-1} + ${g.toFixed(2)}·(X_{t-1}−Y_{t-1}) + v_t   |   spread=${lastSpread.toFixed(2)}   |   ${coIntegrated ? '✓ cointegradas' : '✗ sin cointegración'}`,
        xL, yBot - 1,
      );

      // Leyenda
      ctx.fillStyle = C_X;
      ctx.font = '10px ui-monospace,monospace';
      ctx.textAlign = 'left';
      ctx.fillText('X_t', xL + 2, seriesYTop + 20);
      ctx.fillStyle = C_Y;
      ctx.fillText('Y_t', xL + 2, seriesYTop + 33);
    }

    function loop() {
      const sim = simRef.current!;
      sim.alpha  = paramsRef.current.alpha;
      sim.beta   = paramsRef.current.beta;
      sim.gamma  = paramsRef.current.gamma;
      sim.paused = paramsRef.current.paused;

      if (!sim.paused) {
        // 2 pasos por frame → fluidez sin parecer caótico
        stepSim();
        if (tickCount % 2 === 0) stepSim();
        tickCount++;
      }
      draw();
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Insight dinámico ───────────────────────────────────────────────────────
  const ab = alpha + beta;
  const archInsight =
    ab > 0.97
      ? 'α+β casi igual a 1: la volatilidad es MUY persistente. Un susto dura semanas. Así se ven los mercados en crisis.'
      : ab > 0.85
        ? `Alta persistencia (${ab.toFixed(2)}): la banda amarilla (σ_t) tarda mucho en achicarse después de un shock.`
        : `Baja persistencia (${ab.toFixed(2)}): la volatilidad se calma rápido. Mercados tranquilos, sin memoria de susto.`;

  const cointInsight =
    gamma < 0.02
      ? '¡Sin cointegración! Con γ=0, Y_t es un random walk puro: el spread se aleja sin regresar. Las dos series "se divorciaron".'
      : gamma < 0.1
        ? `Corrección lenta (γ=${gamma.toFixed(2)}): las series tardan mucho en reencontrarse pero lo hacen. El spread oscila amplio.`
        : `Corrección fuerte (γ=${gamma.toFixed(2)}): cuando el spread crece, Y_t jala de vuelta hacia X_t rápidamente. Están pegadas.`;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* ─── Canvas ─────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Botón pausa */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPaused(v => !v)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7] hover:bg-[#4FC3F7]/20 transition"
            >
              {paused ? '▶ reanudar' : '⏸ pausa'}
            </button>
            <span className="text-[11px] font-mono text-[#475569]">
              Panel superior: ARCH (volatilidad) · Panel inferior: Cointegración (series)
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="α + β (persistencia ARCH)"
              value={(alpha + beta).toFixed(2)}
              accent={alpha + beta > 0.95 ? '#EF4444' : alpha + beta > 0.85 ? '#F59E0B' : '#34D399'}
              sub={alpha + beta > 0.95 ? 'mercado en crisis' : alpha + beta > 0.85 ? 'volátil' : 'tranquilo'}
            />
            <StatCard
              label="γ (vel. ajuste coint.)"
              value={gamma.toFixed(2)}
              accent={gamma < 0.02 ? '#EF4444' : gamma < 0.1 ? '#F59E0B' : '#34D399'}
              sub={gamma < 0.02 ? 'sin cointegración' : gamma < 0.1 ? 'corrección lenta' : 'fuertemente atadas'}
            />
          </div>

          {/* Insights */}
          <div className="space-y-2">
            <InsightBox color="#F59E0B" title="Engle · ARCH" text={archInsight} />
            <InsightBox color="#A78BFA" title="Granger · Cointegración" text={cointInsight} />
          </div>
        </div>

        {/* ─── Panel de controles ──────────────────────────────────────────── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ Controles del modelo</div>

          <div className="border-b border-[#1E293B] pb-4">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[#F59E0B] font-mono mb-3">
              ARCH/GARCH (panel superior)
            </div>
            <SliderControl
              label="α — impacto del shock"
              value={alpha}
              min={0}
              max={0.35}
              step={0.01}
              onChange={v => {
                // Mantener α+β<0.999
                const maxA = Math.min(0.35, 0.999 - beta);
                setAlpha(Math.min(v, maxA));
              }}
              fmt={v => v.toFixed(2)}
              hint="Qué tan fuerte rebota la volatilidad ante un shock (una caída súbita)."
              accent="#F59E0B"
            />
            <SliderControl
              label="β — persistencia"
              value={beta}
              min={0}
              max={0.97}
              step={0.01}
              onChange={v => {
                const maxB = Math.min(0.97, 0.999 - alpha);
                setBeta(Math.min(v, maxB));
              }}
              fmt={v => v.toFixed(2)}
              hint="Qué tan lento se calma la volatilidad después del susto. β alto = la tormenta dura."
              accent="#F59E0B"
            />
            <div className="mt-2 text-[10px] font-mono rounded bg-[#0f1420] border border-[#1E293B] px-3 py-2 text-[#F59E0B]">
              {'σ²_t = ω + α·ε²_{t-1} + β·σ²_{t-1}'}
              <span className="text-[#475569] ml-2">(α+β {'<'} 1)</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-[#A78BFA] font-mono mb-3">
              Cointegración (panel inferior)
            </div>
            <SliderControl
              label="γ — velocidad de ajuste"
              value={gamma}
              min={0}
              max={0.45}
              step={0.01}
              onChange={setGamma}
              fmt={v => v.toFixed(2)}
              hint="Con γ=0 las series se separan para siempre. Con γ alto se 'jalan' de vuelta."
              accent="#A78BFA"
            />
            <div className="mt-2 text-[10px] font-mono rounded bg-[#0f1420] border border-[#1E293B] px-3 py-2 text-[#A78BFA]">
              Y_t = Y_{'{t-1}'} + γ(X_{'{t-1}'}−Y_{'{t-1}'}) + v_t
            </div>
            <p className="text-[11px] text-[#64748B] mt-2 leading-snug">
              Pon γ = 0 y mira cómo el spread del panel inferior se aleja sin regresar
              (divergencia). Sube γ y verás cómo las dos series regresan juntas.
            </p>
          </div>

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed space-y-0.5">
            <div>Engle, Econometrica 1982 (ARCH)</div>
            <div>Granger, J. Econometrics 1981</div>
            <div className="text-[#334155]">Premio Nobel · 2003</div>
          </div>
        </div>
      </div>

      {/* ─── Panel explicativo taquero ────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#F59E0B] font-mono mb-2">
            ✦ El click de Engle (ARCH)
          </div>
          <p className="text-[13px] text-[#CBD5E1] leading-relaxed">
            La banda amarilla es la volatilidad σ_t: qué tan agitada está la serie en este momento.
            Fíjate cómo se infla y se desinfla en rachas, no de a golpe. Eso es la <em>memoria del susto</em>.
            Sube β casi al límite y verás cómo una sola sacudida mancha semanas de calma.
            Las Afores usan GARCH exactamente así para saber si tu ahorro para el retiro está en zona tranquila o en zona de tormenta.
          </p>
        </div>
        <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#A78BFA] font-mono mb-2">
            ✦ El click de Granger (Cointegración)
          </div>
          <p className="text-[13px] text-[#CBD5E1] leading-relaxed">
            Las dos series (verde y rosa) se mueven solas, cada una a su ritmo. Pero el spread (morado)
            siempre regresa a cero porque están <em>cointegradas</em>: hay una cuerda invisible que las jala
            de vuelta. Pon γ = 0 y córtala: el spread se dispara sin regresar jamás.
            El peso y el dólar, la renta y la inflación, el petróleo y Banxico: todas esas parejas tienen
            γ {'>'} 0. Granger inventó el test que mide exactamente esa cuerda.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────
function StatCard({ label, value, accent, sub }: { label: string; value: string; accent: string; sub: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[19px] font-bold font-mono" style={{ color: accent }}>{value}</div>
      <div className="text-[10px] font-mono mt-0.5" style={{ color: accent }}>{sub}</div>
    </div>
  );
}

function InsightBox({ color, title, text }: { color: string; title: string; text: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] font-mono mb-1" style={{ color }}>{title}</div>
      <p className="text-[12px] text-[#CBD5E1] leading-relaxed">{text}</p>
    </div>
  );
}

function SliderControl({
  label, value, min, max, step, onChange, fmt, hint, accent,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string; hint?: string; accent?: string;
}) {
  return (
    <div className="space-y-1.5 mb-3">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[12px] font-mono" style={{ color: accent ?? '#FDB813' }}>
          {fmt ? fmt(value) : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#4FC3F7]"
      />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}
