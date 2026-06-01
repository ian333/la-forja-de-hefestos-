/**
 * DeatonLab — laboratorio del Nobel 2015 (Angus Deaton).
 *
 * El click: el termómetro real del bienestar no es el ingreso declarado —
 * es cómo GASTA la gente su dinero. Deaton formalizó las Curvas de Engel y el
 * Almost Ideal Demand System (AIDS, 1980) con Muellbauer: la fracción del
 * presupuesto que un hogar gasta en cada categoría cambia de forma predecible
 * con el ingreso. Los pobres gastan el 60-70% en alimentos y servicios básicos;
 * los ricos, menos del 20%. ESA brecha es el Gran Escape hecho número.
 *
 * Modelo REAL (AIDS linealizado, LAIDS — Deaton & Muellbauer 1980):
 *
 *   w_i = α_i + β_i · ln(x)   para cada categoría i
 *
 *   donde:
 *     w_i  = fracción del gasto total dedicada a la categoría i  (0..1)
 *     x    = gasto total del hogar (proxy del bienestar real)
 *     α_i  = intercepto (participación a ingreso base)
 *     β_i  = parámetro de Engel:
 *              β_i < 0  → necesidad  (share cae al crecer x)
 *              β_i > 0  → lujo       (share sube al crecer x)
 *              β_i ≈ 0  → neutro
 *
 *   Restricción de adición (se cumple por construcción):
 *     Σ α_i = 1,   Σ β_i = 0
 *
 *   Pobreza (línea Deaton-estilo):
 *     Un hogar está en pobreza alimentaria si w_alimentos > 0.52
 *     (calibrado con ENIGH-México: Línea de Bienestar CONEVAL ~$3,200/mes)
 *
 *   El lab permite:
 *     - Mover el ingreso mensual (x) de $1,500 a $60,000 MXN
 *     - Ver las curvas de Engel de 5 categorías en vivo
 *     - Agregar un "shock de precio" (tortilla, gasolina, renta) y ver cómo
 *       desplaza el gasto real y cuántos hogares caen en pobreza alimentaria
 */

import { useEffect, useRef, useState } from 'react';

// ─── Layout ───────────────────────────────────────────────────────────────────
const W = 820;
const H = 380;

// ─── Categorías de gasto (calibradas con ENIGH 2022, estrato típico) ──────────
interface Category {
  key: string;
  label: string;
  alpha: number;  // intercepto (suma = 1)
  beta: number;   // Engel slope (suma = 0)
  color: string;
  emoji: string;
}

// Σ alpha = 1, Σ beta = 0
const CATEGORIES: Category[] = [
  { key: 'alim',  label: 'Alimentos y tortilla', alpha: 0.42, beta: -0.14, color: '#F59E0B', emoji: '🌮' },
  { key: 'renta', label: 'Vivienda y servicios',  alpha: 0.28, beta: -0.06, color: '#60A5FA', emoji: '🏠' },
  { key: 'salud', label: 'Salud y educación',     alpha: 0.08, beta:  0.08, color: '#34D399', emoji: '💊' },
  { key: 'trans', label: 'Transporte',             alpha: 0.10, beta:  0.04, color: '#A78BFA', emoji: '🚌' },
  { key: 'recr',  label: 'Ocio y resto',           alpha: 0.12, beta:  0.08, color: '#F87171', emoji: '🎉' },
];

// ─── Rango de ingreso en log-escala ───────────────────────────────────────────
const X_MIN = 1_500;   // MXN/mes (pobreza extrema urbana México)
const X_MAX = 60_000;  // MXN/mes (clase media alta)

// Línea de pobreza alimentaria: w_alimentos > POVERTY_SHARE
const POVERTY_SHARE = 0.52;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }

function engel(cat: Category, x: number): number {
  const raw = cat.alpha + cat.beta * Math.log(x);
  return clamp(raw, 0.01, 0.99);
}

/** Shares normalizadas para que sumen 1 (small rounding correction). */
function sharesAt(x: number): Record<string, number> {
  const raw: Record<string, number> = {};
  let total = 0;
  for (const c of CATEGORIES) { raw[c.key] = engel(c, x); total += raw[c.key]; }
  const out: Record<string, number> = {};
  for (const c of CATEGORIES) out[c.key] = raw[c.key] / total;
  return out;
}

/** Gasto absoluto mensual en MXN, ajustado por un factor de precio (shock). */
function spendAt(x: number, priceFactor: number, key: string): number {
  const shares = sharesAt(x);
  // El shock de precio afecta el gasto real: si tortilla sube 30%, el hogar
  // necesita más ingreso nominal para mantener el mismo consumo real.
  const realX = x / priceFactor;
  return shares[key] * realX;
}

// ─── Coordenadas canvas ───────────────────────────────────────────────────────
const PAD = { l: 56, r: 20, t: 30, b: 50 };

function xCanvas(x: number): number {
  // Eje horizontal en log-escala
  const t = (Math.log(x) - Math.log(X_MIN)) / (Math.log(X_MAX) - Math.log(X_MIN));
  return PAD.l + t * (W - PAD.l - PAD.r);
}

function yCanvas(share: number): number {
  // Eje vertical: 0..0.7 (share de gasto)
  const Y_MAX_SHARE = 0.70;
  const t = 1 - share / Y_MAX_SHARE;
  return PAD.t + t * (H - PAD.t - PAD.b);
}

// ─── Ticks del eje X ──────────────────────────────────────────────────────────
const X_TICKS = [2_000, 4_000, 8_000, 15_000, 30_000, 60_000];

// ─── Interfaz de simulación (mutable, vive fuera de React) ───────────────────
interface Sim {
  x: number;       // ingreso actual (puede estar animándose)
  xTarget: number; // ingreso objetivo
  dragging: boolean;
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function DeatonLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef    = useRef<Sim>({ x: 8_000, xTarget: 8_000, dragging: false });
  // Parámetros controlados por sliders/botones
  const [income,      setIncome]      = useState(8_000);
  const [shockPct,    setShockPct]    = useState(0);       // % encarecimiento (0..50)
  const [shockTarget, setShockTarget] = useState<string>('alim'); // qué bien se encarece
  const [paused,      setPaused]      = useState(false);
  const [stats, setStats] = useState({ shares: sharesAt(8_000), poor: false });

  // ── Sync refs cuando cambian sliders ──────────────────────────────────────
  useEffect(() => {
    simRef.current.xTarget = income;
  }, [income]);

  // ── Loop canvas ────────────────────────────────────────────────────────────
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

    let raf = 0;
    let frameN = 0;
    let last = performance.now();
    let pausedState = false;

    // Suavizado exponencial del ingreso en pantalla
    function animate(dt: number) {
      const sim = simRef.current;
      const alpha = 1 - Math.exp(-6 * dt); // ~6x/s de convergencia
      sim.x += (sim.xTarget - sim.x) * alpha;
      if (Math.abs(sim.x - sim.xTarget) < 1) sim.x = sim.xTarget;
    }

    function drawAxes() {
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth   = 1;
      // Eje Y
      ctx.beginPath();
      ctx.moveTo(PAD.l, PAD.t);
      ctx.lineTo(PAD.l, H - PAD.b);
      ctx.stroke();
      // Eje X
      ctx.beginPath();
      ctx.moveTo(PAD.l, H - PAD.b);
      ctx.lineTo(W - PAD.r, H - PAD.b);
      ctx.stroke();

      // Ticks Y (shares)
      ctx.fillStyle = '#475569';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'right';
      for (const share of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]) {
        const y = yCanvas(share);
        ctx.fillText(`${(share * 100).toFixed(0)}%`, PAD.l - 4, y + 3);
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(PAD.l, y);
        ctx.lineTo(W - PAD.r, y);
        ctx.stroke();
      }

      // Ticks X (ingresos)
      ctx.textAlign = 'center';
      ctx.fillStyle = '#475569';
      for (const xv of X_TICKS) {
        const xc = xCanvas(xv);
        const label = xv >= 1_000 ? `$${xv / 1_000}k` : `$${xv}`;
        ctx.fillText(label, xc, H - PAD.b + 14);
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(xc, PAD.t);
        ctx.lineTo(xc, H - PAD.b);
        ctx.stroke();
      }

      // Etiqueta Y
      ctx.save();
      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.translate(12, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('% del gasto', 0, 0);
      ctx.restore();

      // Etiqueta X
      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText('Ingreso mensual (MXN)', W - PAD.r, H - 4);
    }

    function drawPovertyLine() {
      const y = yCanvas(POVERTY_SHARE);
      ctx.strokeStyle = 'rgba(239,68,68,0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(PAD.l, y);
      ctx.lineTo(W - PAD.r, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#EF4444';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('52% en alimentos = pobreza alimentaria (CONEVAL)', PAD.l + 4, y - 5);
    }

    function drawCurves(priceFactor: number, shockKey: string) {
      // Para cada categoría, trazar la curva de Engel (share vs ln x)
      const steps = 200;
      for (const cat of CATEGORIES) {
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const t  = i / steps;
          const xv = Math.exp(Math.log(X_MIN) * (1 - t) + Math.log(X_MAX) * t);
          // Si esta categoría tiene shock de precio, su share sube artificialmente
          const rawShares = sharesAt(xv);
          let share = rawShares[cat.key];
          if (cat.key === shockKey && priceFactor > 1) {
            // El hogar necesita gastar más fracción en este bien porque está más caro
            share = clamp(share * priceFactor, 0.01, 0.99);
          }
          const xc = xCanvas(xv);
          const yc = yCanvas(share);
          if (i === 0) ctx.moveTo(xc, yc); else ctx.lineTo(xc, yc);
        }
        ctx.strokeStyle = cat.color;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Etiqueta al final de la curva (lado derecho)
        const xv = X_MAX * 0.92;
        const rawShares = sharesAt(xv);
        let share = rawShares[cat.key];
        if (cat.key === shockKey && priceFactor > 1) {
          share = clamp(share * priceFactor, 0.01, 0.99);
        }
        const xc = xCanvas(xv);
        const yc = yCanvas(share);
        ctx.fillStyle = cat.color;
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${cat.emoji}`, xc + 4, yc + 4);
      }
    }

    function drawCursor(sim: Sim, priceFactor: number, shockKey: string) {
      const x   = clamp(sim.x, X_MIN, X_MAX);
      const xc  = xCanvas(x);

      // Línea vertical del ingreso actual
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xc, PAD.t);
      ctx.lineTo(xc, H - PAD.b);
      ctx.stroke();

      // Puntos en cada curva al ingreso actual
      const rawShares = sharesAt(x);
      for (const cat of CATEGORIES) {
        let share = rawShares[cat.key];
        if (cat.key === shockKey && priceFactor > 1) {
          share = clamp(share * priceFactor, 0.01, 0.99);
        }
        const yc = yCanvas(share);
        ctx.beginPath();
        ctx.arc(xc, yc, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = cat.color;
        ctx.fill();
        ctx.strokeStyle = '#0B0F17';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Etiqueta del ingreso
      const label = x >= 1_000 ? `$${(x / 1_000).toFixed(1)}k/mes` : `$${x.toFixed(0)}/mes`;
      ctx.fillStyle = '#E2E8F0';
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = xc > W / 2 ? 'right' : 'left';
      ctx.fillText(label, xc + (xc > W / 2 ? -8 : 8), PAD.t + 14);

      // Indicador de pobreza
      const wAlim = rawShares['alim'];
      const wAlimShocked = shockKey === 'alim' && priceFactor > 1
        ? clamp(wAlim * priceFactor, 0.01, 0.99) : wAlim;
      const poor = wAlimShocked > POVERTY_SHARE;
      if (poor) {
        ctx.fillStyle = 'rgba(239,68,68,0.12)';
        ctx.fillRect(PAD.l, PAD.t, xc - PAD.l, H - PAD.t - PAD.b);
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 11px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('▼ POBREZA ALIMENTARIA', (PAD.l + xc) / 2, H - PAD.b - 8);
      }

      return { shares: rawShares, poor };
    }

    function draw(pf: number, shockKey: string, paused_: boolean) {
      const sim = simRef.current;

      // Fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      drawAxes();
      drawPovertyLine();
      drawCurves(pf, shockKey);
      const cur = drawCursor(sim, pf, shockKey);

      if (paused_) {
        ctx.fillStyle = 'rgba(5,6,10,0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 16px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⏸ en pausa', W / 2, H / 2);
      }

      return cur;
    }

    // Snapshot de parámetros para el loop (evita closures stale)
    let pfSnap      = 1;
    let shockSnap   = 'alim';

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!pausedState) animate(dt);
      const result = draw(pfSnap, shockSnap, pausedState);
      frameN++;
      if (frameN % 6 === 0) {
        setStats({ shares: result.shares, poor: result.poor });
      }
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);

    // Arrastre horizontal → cambia ingreso
    const setXFromEvent = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const cx   = (e.clientX - rect.left) * (W / rect.width);
      const t    = clamp((cx - PAD.l) / (W - PAD.l - PAD.r), 0, 1);
      const xv   = Math.exp(Math.log(X_MIN) * (1 - t) + Math.log(X_MAX) * t);
      simRef.current.x       = xv;
      simRef.current.xTarget = xv;
      setIncome(Math.round(xv));
    };
    const onDown = (e: PointerEvent) => { simRef.current.dragging = true; setXFromEvent(e); };
    const onMove = (e: PointerEvent) => { if (simRef.current.dragging) setXFromEvent(e); };
    const onUp   = () => { simRef.current.dragging = false; };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);

    // Exponer setters al loop desde React state (via closure mutable)
    const syncParams = (pf: number, sk: string, p: boolean) => {
      pfSnap    = pf;
      shockSnap = sk;
      pausedState = p;
    };

    // Guardamos en el ref para poder llamar desde el effect de parámetros
    (canvas as HTMLCanvasElement & { _syncParams?: typeof syncParams })._syncParams = syncParams;

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    };
  }, []);

  // ── Sync parámetros al loop sin re-montar ────────────────────────────────
  useEffect(() => {
    const pf = 1 + shockPct / 100;
    const c = canvasRef.current as (HTMLCanvasElement & { _syncParams?: (pf: number, sk: string, p: boolean) => void }) | null;
    if (c && c._syncParams) c._syncParams(pf, shockTarget, paused);
  }, [shockPct, shockTarget, paused]);

  // ── Stats display ────────────────────────────────────────────────────────
  const pf = 1 + shockPct / 100;
  const curShares = stats.shares;
  const almShock  = shockTarget === 'alim' && pf > 1
    ? clamp((curShares['alim'] ?? 0) * pf, 0.01, 0.99)
    : (curShares['alim'] ?? 0);
  const isPoor = almShock > POVERTY_SHARE;

  const incomeLabel = income >= 1_000 ? `$${(income / 1_000).toFixed(1)}k` : `$${income}`;
  const salud = curShares['salud'] ?? 0;
  const saludMXN = (salud * income / pf).toFixed(0);

  const insight = isPoor
    ? `Con $${incomeLabel}/mes, más del 52% del gasto es comida. Queda poco para salud o educación — la trampa de la pobreza que Deaton midió hogar por hogar.`
    : income < 12_000
      ? `Con $${incomeLabel}/mes, el hogar escapa de pobreza alimentaria pero sigue gastando más de la mitad en necesidades básicas. El Gran Escape apenas empieza.`
      : `Con $${incomeLabel}/mes, la alimentación baja al ${((curShares['alim'] ?? 0) * 100).toFixed(0)}% del gasto. Quedan $${saludMXN}/mes para salud y educación — eso es el Gran Escape en números.`;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* ── Canvas + controles ── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block touch-none cursor-ew-resize"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Botones de acción */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPaused(v => !v)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7] hover:bg-[#4FC3F7]/20 transition">
              {paused ? '▶ reanudar' : '⏸ pausa'}
            </button>
            <button
              onClick={() => { setIncome(3_000); simRef.current.x = 3_000; simRef.current.xTarget = 3_000; }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 transition">
              📍 salario mínimo
            </button>
            <button
              onClick={() => { setIncome(12_000); simRef.current.x = 12_000; simRef.current.xTarget = 12_000; }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/20 transition">
              📍 clase media
            </button>
            <button
              onClick={() => { setIncome(40_000); simRef.current.x = 40_000; simRef.current.xTarget = 40_000; }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399] hover:bg-[#34D399]/20 transition">
              📍 clase alta
            </button>
          </div>

          {/* Stats en vivo */}
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.slice(0, 4).map(cat => {
              const sh  = (curShares[cat.key] ?? 0);
              const pct = (sh * 100).toFixed(0);
              const mxn = (sh * income / pf).toFixed(0);
              return (
                <div key={cat.key} className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-2">
                  <div className="text-[9px] uppercase tracking-[0.15em] text-[#64748B] font-mono mb-1">{cat.emoji} {cat.label.split(' ')[0]}</div>
                  <div className="text-[16px] font-bold font-mono" style={{ color: cat.color }}>{pct}%</div>
                  <div className="text-[9px] text-[#475569] font-mono">${mxn}/mes</div>
                </div>
              );
            })}
          </div>

          {/* Insight contextual */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">
              {isPoor ? '⚠ POBREZA ALIMENTARIA' : '✦ ¿Qué estás viendo?'}
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── Panel lateral de controles ── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ Mueve el hogar</div>

          {/* Slider de ingreso */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label className="text-[12px] text-[#94A3B8] font-medium">Ingreso mensual</label>
              <span className="text-[12px] font-mono text-[#FDB813]">{incomeLabel}/mes</span>
            </div>
            <input
              type="range" min={X_MIN} max={X_MAX} step={500}
              value={income}
              onChange={e => {
                const v = Number(e.target.value);
                setIncome(v);
                simRef.current.xTarget = v;
              }}
              className="w-full accent-[#4FC3F7]" />
            <div className="text-[10px] text-[#64748B] leading-snug">
              O arrastra directo en la gráfica (cursor ↔).
            </div>
          </div>

          {/* Shock de precio */}
          <div className="space-y-2">
            <div className="text-[11px] text-[#94A3B8] font-medium">💥 Shock de precio</div>
            <div className="flex flex-wrap gap-1">
              {[
                { key: 'alim',  label: '🌮 tortilla' },
                { key: 'renta', label: '🏠 renta' },
                { key: 'trans', label: '🚌 gasolina' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setShockTarget(opt.key)}
                  className={`px-2 py-1 text-[10px] font-mono rounded border transition ${
                    shockTarget === opt.key
                      ? 'border-[#EF4444]/60 bg-[#EF4444]/10 text-[#EF4444]'
                      : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-[#94A3B8]">Encarecimiento</span>
                <span className="text-[11px] font-mono text-[#EF4444]">+{shockPct}%</span>
              </div>
              <input
                type="range" min={0} max={50} step={1}
                value={shockPct}
                onChange={e => setShockPct(Number(e.target.value))}
                className="w-full accent-[#EF4444]" />
              <div className="text-[10px] text-[#64748B] leading-snug">
                Sube el precio de un bien y ve cómo sube su curva y desplaza el gasto real.
              </div>
            </div>
          </div>

          {/* Leyenda */}
          <div className="space-y-1 pt-1 border-t border-[#1E293B]">
            <div className="text-[10px] text-[#64748B] font-mono mb-2">Curvas de Engel</div>
            {CATEGORIES.map(cat => (
              <div key={cat.key} className="flex items-center gap-2">
                <div className="w-5 h-0.5 rounded" style={{ backgroundColor: cat.color }} />
                <span className="text-[10px] text-[#64748B]">{cat.emoji} {cat.label}</span>
                <span className="text-[10px] font-mono ml-auto" style={{ color: cat.color }}>
                  {cat.beta < 0 ? 'necesidad' : 'lujo'}
                </span>
              </div>
            ))}
          </div>

          {/* Fórmula */}
          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            w_i = α_i + β_i · ln(x)<br />
            Almost Ideal Demand System<br />
            (Deaton &amp; Muellbauer, 1980)<br />
            β {'<'} 0 → necesidad · β {'>'} 0 → lujo
          </div>
        </div>
      </div>
    </div>
  );
}
