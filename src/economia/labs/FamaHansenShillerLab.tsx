/**
 * FamaHansenShillerLab — laboratorio del premio Nobel 2013.
 *
 * El click: Fama y Shiller ganaron el MISMO Nobel con ideas opuestas.
 *   - Fama (Hipótesis de Mercado Eficiente): a corto plazo los precios son
 *     un paseo aleatorio — nadie puede predecirlos. La información se absorbe
 *     instantáneamente.
 *   - Shiller: a largo plazo los mercados SÍ se vuelven locos. Su CAPE ratio
 *     (precio / utilidades ajustadas por ciclo) predice retornos a 10 años.
 *     Cuando está muy arriba → burbuja. Cuando está muy abajo → oportunidad.
 *   - Hansen: diseñó el GMM (Generalized Method of Moments), la herramienta
 *     estadística que les permitió a ambos probar sus tesis con datos reales.
 *
 * Modelo REAL implementado:
 *
 *   Precio fundamental (valor intrínseco):
 *     F(t) = F₀ · exp(g·t)       g = crecimiento real anualizado de utilidades
 *
 *   Precio de mercado (proceso de Ornstein-Uhlenbeck + deriva):
 *     dP = κ·(F - P)·dt + σ·√P·dW + euforia·(P - F)·dt
 *     donde κ = velocidad de reversión a la media (Shiller)
 *           σ = volatilidad instantánea (Fama: ruido imposible de batir)
 *           euforia ∈ [0,1] aleja P de F temporalmente → burbuja
 *
 *   CAPE aproximado:
 *     CAPE(t) = P(t) / (utilidades promedio ajustadas × 10 años)
 *     Señal Shiller: CAPE > 30 → caro; CAPE < 15 → barato
 *
 *   El "Fama forecast" (random walk puro): siempre P(t+1) = P(t) + ruido
 *   El "Shiller forecast" (reversión): espera caída cuando CAPE > umbral
 *
 * Controles:
 *   - Euforia del mercado (aleja precios de fundamentales)
 *   - Crecimiento de utilidades (mueve el fundamental)
 *   - Volatilidad diaria (ruido de corto plazo, Fama)
 *   - Botón "Crash" — inyecta corrección de Shiller
 *   - Botón "Inversión" — marca si habrías comprado/vendido en CAPE extremo
 */

import { useEffect, useRef, useState } from 'react';

// ─── Dimensiones ──────────────────────────────────────────────────────────────
const W = 820;
const H = 380;

// ─── Constantes del modelo ────────────────────────────────────────────────────
const DT = 1 / 252;          // 1 día de trading (año = 252 días)
const HISTORY = 504;          // 2 años de historia visible (puntos)
const F0 = 100;               // precio fundamental inicial
const EARNINGS_BASE = 5;      // utilidades base por acción
const CAPE_CHEAP = 15;
const CAPE_EXPENSIVE = 30;

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface SimState {
  price: number;
  fundamental: number;
  day: number;
  // historias circulares
  priceHistory: Float32Array;
  fundHistory: Float32Array;
  capeHistory: Float32Array;
  head: number;
  earningsSmoothed: number;  // EMA de 10 años de utilidades (252*10 días)
}

interface Params {
  euforia: number;       // 0..1 — cuánto el mercado ignora fundamentales
  crecimiento: number;   // 0..0.1 — crecimiento anual de utilidades
  volatilidad: number;   // 0.005..0.04 — σ diaria
  paused: boolean;
}

const DEFAULTS: Params = {
  euforia: 0.3,
  crecimiento: 0.04,
  volatilidad: 0.015,
  paused: false,
};

// ─── Utilidades numéricas ─────────────────────────────────────────────────────
/** Box-Muller: genera ~N(0,1) */
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function cape(price: number, earningsSmoothed: number): number {
  return earningsSmoothed > 0 ? price / earningsSmoothed : 20;
}

function lerpColor(a: string, b: string, t: number): string {
  // a, b en '#RRGGBB'
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `#${rr.toString(16).padStart(2, '0')}${rg.toString(16).padStart(2, '0')}${rb.toString(16).padStart(2, '0')}`;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function FamaHansenShillerLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS });
  const simRef = useRef<SimState | null>(null);
  const crashRef = useRef(false);
  const tradeRef = useRef<{ type: 'buy' | 'sell'; day: number; price: number } | null>(null);

  const [euforia, setEuforia] = useState(DEFAULTS.euforia);
  const [crecimiento, setCrecimiento] = useState(DEFAULTS.crecimiento);
  const [volatilidad, setVolatilidad] = useState(DEFAULTS.volatilidad);
  const [paused, setPaused] = useState(DEFAULTS.paused);
  const [stats, setStats] = useState({ price: F0, fund: F0, capeVal: 20, day: 0 });

  // Sync params ref
  useEffect(() => {
    paramsRef.current = { euforia, crecimiento, volatilidad, paused };
  }, [euforia, crecimiento, volatilidad, paused]);

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

    // ── Inicializa simulación ─────────────────────────────────────────────────
    const sim: SimState = {
      price: F0,
      fundamental: F0,
      day: 0,
      priceHistory: new Float32Array(HISTORY).fill(F0),
      fundHistory: new Float32Array(HISTORY).fill(F0),
      capeHistory: new Float32Array(HISTORY).fill(20),
      head: 0,
      earningsSmoothed: EARNINGS_BASE,
    };
    simRef.current = sim;

    let raf = 0;
    let frameCount = 0;
    const STEPS_PER_FRAME = 3; // 3 días por frame → ~180 días por segundo

    // ── Paso de simulación (un día de trading) ────────────────────────────────
    function step() {
      const p = paramsRef.current;
      const s = sim;

      // Actualiza fundamental (crece a tasa g)
      s.fundamental *= Math.exp(p.crecimiento * DT);

      // Utilidades actuales = fundamental * (EARNINGS_BASE / F0)
      const earningsNow = s.fundamental * (EARNINGS_BASE / F0);
      // EMA lenta de 10 años ≈ α = 2/(252*10+1) por día
      const alpha = 2 / (252 * 10 + 1);
      s.earningsSmoothed = s.earningsSmoothed * (1 - alpha) + earningsNow * alpha;

      // Reversión de Shiller + ruido de Fama + euforia
      const kappa = 0.8; // velocidad de reversión media-anual → /252 por día
      const mean = s.fundamental;
      const drift =
        kappa * (mean - s.price) * DT +            // reversión (Shiller)
        p.euforia * (s.price - mean) * DT * 1.5;  // fuga eufórica (burbuja)

      const vol = p.volatilidad * Math.sqrt(Math.abs(s.price));
      const shock = randn() * vol * Math.sqrt(DT);

      // Crash manual
      let crashPush = 0;
      if (crashRef.current) {
        crashPush = -0.12 * s.price; // -12% shock inmediato
        crashRef.current = false;
      }

      s.price = Math.max(1, s.price + drift + shock + crashPush);
      s.day++;

      // Escribe historia circular
      sim.priceHistory[sim.head] = s.price;
      sim.fundHistory[sim.head] = s.fundamental;
      sim.capeHistory[sim.head] = cape(s.price, s.earningsSmoothed);
      sim.head = (sim.head + 1) % HISTORY;
    }

    // ── Helpers de dibujo ─────────────────────────────────────────────────────
    function getHistorySorted(arr: Float32Array, head: number): Float32Array {
      // Devuelve el array en orden cronológico (más viejo → más reciente)
      const out = new Float32Array(HISTORY);
      for (let i = 0; i < HISTORY; i++) {
        out[i] = arr[(head + i) % HISTORY];
      }
      return out;
    }

    function chartY(val: number, vmin: number, vmax: number, yTop: number, yBot: number): number {
      const t = Math.max(0, Math.min(1, (val - vmin) / Math.max(1e-6, vmax - vmin)));
      return yBot - t * (yBot - yTop);
    }

    // ── Dibuja frame ──────────────────────────────────────────────────────────
    function draw() {
      if (!ctx) return;
      const s = sim;
      const p = paramsRef.current;

      // Fondo
      ctx.fillStyle = '#0B0F17';
      ctx.fillRect(0, 0, W, H);

      // ── Layout: zona de precio (arriba) y zona de CAPE (abajo) ──
      const PRICE_TOP = 28;
      const PRICE_BOT = H - 90;
      const CAPE_TOP = H - 82;
      const CAPE_BOT = H - 32;

      const priceOrd = getHistorySorted(s.priceHistory, s.head);
      const fundOrd = getHistorySorted(s.fundHistory, s.head);
      const capeOrd = getHistorySorted(s.capeHistory, s.head);

      // Calcula rango de precio (precio + fundamental juntos)
      let pmin = Infinity, pmax = -Infinity;
      for (let i = 0; i < HISTORY; i++) {
        if (priceOrd[i] < pmin) pmin = priceOrd[i];
        if (priceOrd[i] > pmax) pmax = priceOrd[i];
        if (fundOrd[i] < pmin) pmin = fundOrd[i];
        if (fundOrd[i] > pmax) pmax = fundOrd[i];
      }
      pmin = pmin * 0.92;
      pmax = pmax * 1.08;

      const xOf = (i: number) => 52 + (i / (HISTORY - 1)) * (W - 64);

      // ── Zona sombreada "burbuja" cuando precio > fundamental ──
      ctx.beginPath();
      for (let i = 0; i < HISTORY; i++) {
        const x = xOf(i);
        const yP = chartY(priceOrd[i], pmin, pmax, PRICE_TOP, PRICE_BOT);
        const yF = chartY(fundOrd[i], pmin, pmax, PRICE_TOP, PRICE_BOT);
        if (i === 0) ctx.moveTo(x, yP);
        else ctx.lineTo(x, yP);
      }
      for (let i = HISTORY - 1; i >= 0; i--) {
        ctx.lineTo(xOf(i), chartY(fundOrd[i], pmin, pmax, PRICE_TOP, PRICE_BOT));
      }
      ctx.closePath();
      const bubbleGrad = ctx.createLinearGradient(0, PRICE_TOP, 0, PRICE_BOT);
      bubbleGrad.addColorStop(0, 'rgba(251,146,60,0.13)');
      bubbleGrad.addColorStop(1, 'rgba(251,146,60,0.03)');
      ctx.fillStyle = bubbleGrad;
      ctx.fill();

      // ── Línea de valor fundamental (Shiller) ──
      ctx.beginPath();
      for (let i = 0; i < HISTORY; i++) {
        const x = xOf(i);
        const y = chartY(fundOrd[i], pmin, pmax, PRICE_TOP, PRICE_BOT);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // ── Línea del precio de mercado (coloreada por CAPE) ──
      for (let i = 1; i < HISTORY; i++) {
        const cVal = capeOrd[i];
        // Verde (barato) → blanco → rojo (caro)
        let color: string;
        if (cVal <= CAPE_CHEAP) {
          color = '#34D399';
        } else if (cVal <= CAPE_EXPENSIVE) {
          const t = (cVal - CAPE_CHEAP) / (CAPE_EXPENSIVE - CAPE_CHEAP);
          color = lerpColor('#E2E8F0', '#FB923C', t);
        } else {
          color = '#EF4444';
        }
        ctx.beginPath();
        ctx.moveTo(xOf(i - 1), chartY(priceOrd[i - 1], pmin, pmax, PRICE_TOP, PRICE_BOT));
        ctx.lineTo(xOf(i), chartY(priceOrd[i], pmin, pmax, PRICE_TOP, PRICE_BOT));
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // ── Etiquetas del eje de precio ──
      ctx.fillStyle = '#475569';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'right';
      const priceSteps = 4;
      for (let k = 0; k <= priceSteps; k++) {
        const val = pmin + (k / priceSteps) * (pmax - pmin);
        const y = chartY(val, pmin, pmax, PRICE_TOP, PRICE_BOT);
        ctx.fillText(`$${val.toFixed(0)}`, 48, y + 4);
        ctx.beginPath();
        ctx.moveTo(50, y); ctx.lineTo(W - 12, y);
        ctx.strokeStyle = 'rgba(71,85,105,0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // ── Marcador de operación del usuario ──
      const tr = tradeRef.current;
      if (tr) {
        // ¿Dónde cae en la historia visible?
        const daysAgo = s.day - tr.day;
        const idx = HISTORY - 1 - daysAgo;
        if (idx >= 0 && idx < HISTORY) {
          const x = xOf(idx);
          const y = chartY(tr.price, pmin, pmax, PRICE_TOP, PRICE_BOT);
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fillStyle = tr.type === 'buy' ? '#34D399' : '#EF4444';
          ctx.fill();
          ctx.fillStyle = '#0B0F17';
          ctx.font = 'bold 8px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(tr.type === 'buy' ? 'C' : 'V', x, y + 3);
        }
      }

      // ── Etiquetas del gráfico principal ──
      ctx.fillStyle = '#34D399';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('── valor fundamental (Shiller)', 56, PRICE_TOP + 14);

      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('── precio de mercado (Fama: ruido puro hoy)', 56 + 210, PRICE_TOP + 14);

      // ── Subgráfico: CAPE ──
      // Fondo CAPE
      ctx.fillStyle = 'rgba(15,20,35,0.7)';
      ctx.fillRect(52, CAPE_TOP - 4, W - 64, CAPE_BOT - CAPE_TOP + 8);

      const capeMin = 5, capeMax = 50;
      // Zona roja (caro) y verde (barato)
      const yCheap = chartY(CAPE_CHEAP, capeMin, capeMax, CAPE_TOP, CAPE_BOT);
      const yExp = chartY(CAPE_EXPENSIVE, capeMin, capeMax, CAPE_TOP, CAPE_BOT);
      ctx.fillStyle = 'rgba(52,211,153,0.08)';
      ctx.fillRect(52, yCheap, W - 64, CAPE_BOT - yCheap);
      ctx.fillStyle = 'rgba(239,68,68,0.08)';
      ctx.fillRect(52, CAPE_TOP - 4, W - 64, yExp - CAPE_TOP + 4);

      // Líneas de referencia CAPE
      ctx.strokeStyle = 'rgba(52,211,153,0.4)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(52, yCheap); ctx.lineTo(W - 12, yCheap);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(239,68,68,0.4)';
      ctx.beginPath();
      ctx.moveTo(52, yExp); ctx.lineTo(W - 12, yExp);
      ctx.stroke();
      ctx.setLineDash([]);

      // Curva CAPE
      ctx.beginPath();
      for (let i = 0; i < HISTORY; i++) {
        const x = xOf(i);
        const y = chartY(Math.min(capeMax, Math.max(capeMin, capeOrd[i])), capeMin, capeMax, CAPE_TOP, CAPE_BOT);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#FDB813';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Etiquetas CAPE
      ctx.fillStyle = '#FDB813';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('CAPE', 54, CAPE_TOP + 9);
      ctx.fillStyle = 'rgba(52,211,153,0.7)';
      ctx.fillText('15', 38, yCheap + 3);
      ctx.fillStyle = 'rgba(239,68,68,0.7)';
      ctx.fillText('30', 38, yExp + 3);

      // ── Panel derecho: estado actual ──
      const capeNow = cape(s.price, s.earningsSmoothed);
      const over = (s.price / s.fundamental - 1) * 100;

      const panelX = W - 176;
      ctx.fillStyle = 'rgba(11,15,23,0.85)';
      ctx.beginPath();
      ctx.roundRect(panelX, PRICE_TOP + 2, 162, 120, 8);
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.stroke();

      const line = (label: string, val: string, color: string, y: number) => {
        ctx.fillStyle = '#64748B';
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(label, panelX + 8, y);
        ctx.fillStyle = color;
        ctx.font = 'bold 13px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(val, panelX + 154, y);
      };

      line('precio mercado', `$${s.price.toFixed(1)}`, '#E2E8F0', PRICE_TOP + 22);
      line('valor fundamental', `$${s.fundamental.toFixed(1)}`, '#34D399', PRICE_TOP + 42);
      line('sobrevaluación', `${over > 0 ? '+' : ''}${over.toFixed(1)}%`,
        over > 25 ? '#EF4444' : over < -15 ? '#34D399' : '#94A3B8', PRICE_TOP + 62);
      const capeColor = capeNow > CAPE_EXPENSIVE ? '#EF4444' : capeNow < CAPE_CHEAP ? '#34D399' : '#FDB813';
      line('CAPE (Shiller)', capeNow.toFixed(1), capeColor, PRICE_TOP + 82);
      line('día de trading', `#${s.day}`, '#475569', PRICE_TOP + 102);

      // ── Señal Shiller ──
      const signal = capeNow > CAPE_EXPENSIVE
        ? { text: '⚠ CARO — Shiller dice esperar', color: '#EF4444' }
        : capeNow < CAPE_CHEAP
          ? { text: '✦ BARATO — Shiller dice comprar', color: '#34D399' }
          : { text: '○ Shiller: zona neutral', color: '#64748B' };

      ctx.fillStyle = 'rgba(11,15,23,0.7)';
      ctx.beginPath();
      ctx.roundRect(52, PRICE_BOT - 26, 280, 22, 4);
      ctx.fill();
      ctx.fillStyle = signal.color;
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(signal.text, 60, PRICE_BOT - 10);

      // ── Fama note ──
      ctx.fillStyle = 'rgba(148,163,184,0.4)';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText('Fama: predecir el día de mañana = imposible', W - 14, PRICE_BOT - 10);

      // ── Pausa ──
      if (p.paused) {
        ctx.fillStyle = 'rgba(5,6,10,0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 16px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⏸ en pausa', W / 2, H / 2);
      }

      // Actualiza stats
      if (frameCount % 8 === 0) {
        setStats({ price: s.price, fund: s.fundamental, capeVal: capeNow, day: s.day });
      }
    }

    // ── Loop principal ────────────────────────────────────────────────────────
    function loop() {
      if (!paramsRef.current.paused) {
        for (let i = 0; i < STEPS_PER_FRAME; i++) step();
      }
      draw();
      frameCount++;
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(raf); };
  }, []);

  // Derivados para UI
  const capeColor = stats.capeVal > CAPE_EXPENSIVE
    ? '#EF4444'
    : stats.capeVal < CAPE_CHEAP
      ? '#34D399'
      : '#FDB813';

  const over = ((stats.price / stats.fund - 1) * 100);

  const insight = stats.capeVal > CAPE_EXPENSIVE
    ? 'El mercado está caro. Shiller dice: ten paciencia. El CAPE por encima de 30 históricamente predijo retornos bajos (o negativos) a 10 años. Pulsa CRASH para ver lo que Fama no puede predecir pero Shiller ya sabe que llegará.'
    : stats.capeVal < CAPE_CHEAP
      ? 'El mercado está barato. Shiller dice: hora de comprar. Fama dice: igual podría bajar más mañana — nadie lo sabe. Ambos tienen razón: la oportunidad existe, pero el timing exacto es imposible.'
      : 'Zona neutral. Fama gana el debate de corto plazo: el ruido del día a día es impredecible. Sube la euforia para ver crecer la burbuja — y observa cómo el CAPE te avisa mucho antes del crash.';

  const handleCrash = () => {
    crashRef.current = true;
  };

  const handleTrade = (type: 'buy' | 'sell') => {
    const s = simRef.current;
    if (!s) return;
    tradeRef.current = { type, day: s.day, price: s.price };
  };

  const handleReset = () => {
    const s = simRef.current;
    if (!s) return;
    s.price = F0;
    s.fundamental = F0;
    s.day = 0;
    s.earningsSmoothed = EARNINGS_BASE;
    s.priceHistory.fill(F0);
    s.fundHistory.fill(F0);
    s.capeHistory.fill(20);
    s.head = 0;
    tradeRef.current = null;
    crashRef.current = false;
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* ── Canvas + botones ── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPaused(v => !v)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7] hover:bg-[#4FC3F7]/20 transition"
            >
              {paused ? '▶ reanudar' : '⏸ pausa'}
            </button>
            <button
              onClick={handleCrash}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 transition"
            >
              💥 CRASH (−12%)
            </button>
            <button
              onClick={() => handleTrade('buy')}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399] hover:bg-[#34D399]/20 transition"
            >
              📈 Comprar ahora
            </button>
            <button
              onClick={() => handleTrade('sell')}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#FB923C]/40 bg-[#FB923C]/10 text-[#FB923C] hover:bg-[#FB923C]/20 transition"
            >
              📉 Vender ahora
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#475569]/40 text-[#475569] hover:text-[#CBD5E1] transition"
            >
              ↺ reiniciar
            </button>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-4 gap-3">
            <StatBox label="precio mercado" value={`$${stats.price.toFixed(1)}`} accent="#E2E8F0" />
            <StatBox label="valor fundamental" value={`$${stats.fund.toFixed(1)}`} accent="#34D399" />
            <StatBox
              label="sobrevaluación"
              value={`${over > 0 ? '+' : ''}${over.toFixed(1)}%`}
              accent={over > 25 ? '#EF4444' : over < -15 ? '#34D399' : '#94A3B8'}
            />
            <StatBox label="CAPE Shiller" value={stats.capeVal.toFixed(1)} accent={capeColor} />
          </div>

          {/* ── Insight ── */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#FDB813] font-mono mb-2">✦ ¿Quién tiene razón — Fama o Shiller?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── Panel de controles ── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ Mueve el mercado</div>

          <SliderControl
            label="Euforia del mercado"
            value={euforia}
            min={0}
            max={0.8}
            step={0.01}
            onChange={setEuforia}
            fmt={v => v < 0.25 ? 'racional' : v < 0.55 ? 'optimista' : 'burbuja 🫧'}
            hint="Cuánto el precio se aleja del fundamental. Alta euforia = burbuja inminente."
          />

          <SliderControl
            label="Crecimiento de utilidades"
            value={crecimiento}
            min={0}
            max={0.1}
            step={0.002}
            onChange={setCrecimiento}
            fmt={v => `${(v * 100).toFixed(1)}% / año`}
            hint="Mueve el valor fundamental a largo plazo. Más crecimiento = precio justo más alto."
          />

          <SliderControl
            label="Volatilidad diaria (Fama)"
            value={volatilidad}
            min={0.003}
            max={0.04}
            step={0.001}
            onChange={setVolatilidad}
            fmt={v => `σ = ${(v * 100).toFixed(1)}%`}
            hint="El ruido de corto plazo que Fama dice que es imposible de predecir."
          />

          <div className="border-t border-[#1E293B] pt-4 space-y-2">
            <div className="text-[10px] font-mono text-[#475569] leading-relaxed">
              <span className="text-[#34D399]">Fama (EMH):</span> precio = toda la info disponible. Mañana es ruido puro.
            </div>
            <div className="text-[10px] font-mono text-[#475569] leading-relaxed">
              <span className="text-[#FDB813]">Shiller (CAPE):</span> largo plazo sí hay señal. Cuando todos están eufóricos, viene la corrección.
            </div>
            <div className="text-[10px] font-mono text-[#475569] leading-relaxed">
              <span className="text-[#4FC3F7]">Hansen (GMM):</span> la estadística para probar a los dos sin mentirse.
            </div>
          </div>

          <div className="text-[10px] font-mono text-[#334155] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo: dP = κ(F−P)dt + euforia·(P−F)dt + σ√P·dW<br />
            CAPE = P / utilidades_ema₁₀<br />
            Fama·Shiller·Hansen — Nobel Economía 2013
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function StatBox({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[18px] font-bold font-mono" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function SliderControl({
  label, value, min, max, step, onChange, fmt, hint,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[12px] font-mono text-[#FDB813]">{fmt ? fmt(value) : value.toFixed(3)}</span>
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
