/**
 * DebreuLab — laboratorio del premio Nobel 1983 (Gérard Debreu).
 *
 * El click: los precios no son caprichos ni mentiras de los ricos.
 * Son el único idioma que millones de desconocidos comparten para
 * ponerse de acuerdo sin hablar. Debreu lo demostró matemáticamente
 * en 87 páginas (Theory of Value, 1959): bajo ciertas condiciones,
 * SIEMPRE existe un vector de precios donde todos los mercados se
 * equilibran al mismo tiempo — equilibrio general de Arrow-Debreu.
 *
 * Matemática REAL (Arrow-Debreu, Walras):
 *
 *   Tres mercados interconectados: maíz (0), tortilla (1), taco (2).
 *   Cada mercado i tiene:
 *     Demanda: D_i(p) = a_i - b_i*p_i + c_ij*p_j   (sustitutos/complementos)
 *     Oferta:  S_i(p) = d_i + e_i*p_i
 *     Exceso de demanda: z_i(p) = D_i(p) - S_i(p)
 *
 *   Dinámica de tatonnement (Walras):
 *     dp_i/dt = λ * z_i(p)        si no hay control de precios
 *     p_i ≤ techo_i               si hay control
 *
 *   Ley de Walras: Σ p_i * z_i(p*) = 0  en equilibrio
 *
 *   El equilibrio p* existe (Debreu) y la dinámica converge a él.
 *   Si introduces un techo en mercado j, z_j > 0 (escasez),
 *   y por la interdependencia los otros mercados también se distorsionan.
 *
 * El usuario puede:
 *   - Ajustar demanda en cada mercado
 *   - Activar un control de precios en cualquier mercado
 *   - Ver cómo el desequilibrio en uno se propaga a los demás
 */

import { useEffect, useRef, useState } from 'react';

// ─── Canvas dimensions ──────────────────────────────────────────────────────
const W = 820;
const H = 380;
const STEP = 1 / 120;   // physics timestep
const LAMBDA = 4.0;     // tatonnement speed
const FRICTION = 1.8;   // velocity damping

// ─── Market indices ──────────────────────────────────────────────────────────
const MAIZ = 0;
const TORTILLA = 1;
const TACO = 2;
const NAMES = ['Maíz', 'Tortilla', 'Taco'];
const UNITS = ['$/kg', '$/paq', '$/pieza'];
const COLORS = ['#34D399', '#FDB813', '#F472B6'];
const GLOW   = ['#065F46', '#B45309', '#BE185D'];

// ─── Model parameters ───────────────────────────────────────────────────────
// Demand: D_i(p) = a_i - b_i*p_i + cross terms
// Supply: S_i(p) = d_i + e_i*p_i
// Equilibrium price: p*_i where z_i = 0 simultaneously

interface MarketParams {
  // Demand intercept (adjusted by user slider)
  demandShift: number;   // -2..+2  default 0
  // Price ceiling: null = no ceiling
  ceiling: number | null;
}

interface SimState {
  p: [number, number, number];
  vp: [number, number, number];
}

// Base parameters for the 3-market system
// Demand: D_i = A_i(demandShift) - B_i*p_i + C_ij*p_j
// A_i base, B_i own-price, C_ij cross-price with next market (substitute)
const BASE_A = [12, 18, 24];    // intercepts
const B      = [1.5, 1.2, 1.0]; // own-price slope (negative)
const C_UP   = [0.3, 0.25, 0]; // cross-price with upstream (complement: +)
const C_DOWN = [0, 0.4, 0.3];  // cross-price with downstream (substitute: +)
// Supply: S_i = D_i + e_i*p_i (simplified)
const D_S    = [2, 3, 4];       // supply intercept
const E      = [1.0, 0.9, 0.8]; // own-price supply slope

function demand(i: number, p: [number, number, number], shift: number): number {
  const j = i > 0 ? i - 1 : i;    // upstream
  const k = i < 2 ? i + 1 : i;    // downstream
  const crossUp   = i > 0 ? C_UP[i]   * p[j] : 0;
  const crossDown = i < 2 ? C_DOWN[i] * p[k] : 0;
  return BASE_A[i] + shift - B[i] * p[i] + crossUp + crossDown;
}

function supply(i: number, p: [number, number, number]): number {
  return D_S[i] + E[i] * p[i];
}

function excess(i: number, p: [number, number, number], shift: number): number {
  return demand(i, p, shift) - supply(i, p);
}

// Approximate equilibrium price analytically for a single market
// ignoring cross-price terms (used for display marker only).
// Real equilibrium emerges from the tatonnement simulation.
function approxPStar(i: number, shift: number): number {
  return (BASE_A[i] + shift - D_S[i]) / (B[i] + E[i]);
}

// Price display range per market
const P_MAX = [8, 14, 20];
const P_MIN = [0, 0, 0];

// ─── Layout geometry ─────────────────────────────────────────────────────────
// Three vertical markets laid side by side
const MARKET_W = Math.floor((W - 60) / 3);
const MARKET_MARGIN = 20;

function marketLeft(i: number): number {
  return 30 + i * MARKET_W;
}

function priceToY(price: number, i: number): number {
  const top = 60, bot = H - 80;
  const t = 1 - (price - P_MIN[i]) / (P_MAX[i] - P_MIN[i]);
  return top + t * (bot - top);
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface Params {
  demandShift: [number, number, number];
  ceiling: [number | null, number | null, number | null];
  paused: boolean;
}

const DEFAULTS: Params = {
  demandShift: [0, 0, 0],
  ceiling: [null, null, null],
  paused: false,
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function DebreuLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS, demandShift: [0, 0, 0], ceiling: [null, null, null] });
  const simRef    = useRef<SimState>({ p: [3, 6, 10], vp: [0, 0, 0] });

  // Sliders
  const [shift0, setShift0] = useState(0);
  const [shift1, setShift1] = useState(0);
  const [shift2, setShift2] = useState(0);
  const [ceil0,  setCeil0]  = useState(false);
  const [ceil1,  setCeil1]  = useState(false);
  const [ceil2,  setCeil2]  = useState(false);
  const [ceilVal0, setCeilVal0] = useState(2.0);
  const [ceilVal1, setCeilVal1] = useState(4.5);
  const [ceilVal2, setCeilVal2] = useState(8.0);
  const [paused, setPaused] = useState(false);

  const [stats, setStats] = useState({
    p: [3, 6, 10] as [number, number, number],
    z: [0, 0, 0]  as [number, number, number],
    pStar: [4, 7, 12] as [number, number, number],
  });

  // Sync params to ref on every render
  useEffect(() => {
    const ceiling: [number | null, number | null, number | null] = [
      ceil0 ? ceilVal0 : null,
      ceil1 ? ceilVal1 : null,
      ceil2 ? ceilVal2 : null,
    ];
    paramsRef.current = {
      demandShift: [shift0, shift1, shift2],
      ceiling,
      paused,
    };
  }, [shift0, shift1, shift2, ceil0, ceil1, ceil2, ceilVal0, ceilVal1, ceilVal2, paused]);

  // ── Canvas effect ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    let raf = 0, last = performance.now(), acc = 0, frame = 0;

    // ── Physics step (tatonnement) ──────────────────────────────────────────
    function step(h: number) {
      const { demandShift, ceiling } = paramsRef.current;
      const sim = simRef.current;

      for (let i = 0; i < 3; i++) {
        const z = excess(i, sim.p, demandShift[i]);
        const F = LAMBDA * z;
        sim.vp[i] += F * h;
        sim.vp[i] *= (1 - FRICTION * h);   // damping → settle
        sim.p[i] += sim.vp[i] * h;

        // Clamp to price range
        if (sim.p[i] < P_MIN[i]) { sim.p[i] = P_MIN[i]; sim.vp[i] = Math.max(0, sim.vp[i]); }
        if (sim.p[i] > P_MAX[i]) { sim.p[i] = P_MAX[i]; sim.vp[i] = Math.min(0, sim.vp[i]); }

        // Price ceiling: block upward movement
        const ceil = ceiling[i];
        if (ceil !== null && sim.p[i] > ceil) {
          sim.p[i] = ceil;
          if (sim.vp[i] > 0) sim.vp[i] = 0;
        }
      }
    }

    // ── Draw ───────────────────────────────────────────────────────────────
    function draw() {
      if (!ctx) return;
      const { demandShift, ceiling } = paramsRef.current;
      const { p } = simRef.current;

      // Background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Title bar
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, 0, W, 28);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('EQUILIBRIO GENERAL · ARROW-DEBREU (1954) · tatonnement de Walras', 12, 17);

      // Arrows between markets (show the interdependence)
      for (let i = 0; i < 2; i++) {
        const x1 = marketLeft(i) + MARKET_W - 4;
        const x2 = marketLeft(i + 1) + 4;
        const yMid = H / 2 - 10;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x1, yMid);
        ctx.lineTo(x2, yMid);
        ctx.stroke();
        ctx.setLineDash([]);
        // Arrow head
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(x2 - 1, yMid - 5);
        ctx.lineTo(x2 + 8, yMid);
        ctx.lineTo(x2 - 1, yMid + 5);
        ctx.closePath();
        ctx.fill();
      }

      // Draw each market
      for (let i = 0; i < 3; i++) {
        drawMarket(ctx, i, p as [number, number, number], demandShift[i], ceiling[i]);
      }

      // Bottom status bar
      const allNearEq = [0, 1, 2].every(i => Math.abs(excess(i, p as [number, number, number], demandShift[i])) < 0.25);
      const hasControl = ceiling.some(c => c !== null);
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px ui-sans-serif, system-ui';
      if (allNearEq && !hasControl) {
        ctx.fillStyle = '#34D399';
        ctx.fillText('✓ equilibrio general: los tres mercados cuadran al mismo tiempo', W / 2, H - 12);
      } else if (hasControl) {
        ctx.fillStyle = '#F472B6';
        ctx.fillText('⚠ control de precios activo — el sistema no puede llegar a su equilibrio', W / 2, H - 12);
      } else {
        ctx.fillStyle = '#94A3B8';
        ctx.fillText('ajustando → los precios buscan su nivel…', W / 2, H - 12);
      }

      // Stats update
      if (frame % 8 === 0) {
        const zArr: [number, number, number] = [
          excess(0, p as [number, number, number], demandShift[0]),
          excess(1, p as [number, number, number], demandShift[1]),
          excess(2, p as [number, number, number], demandShift[2]),
        ];
        const pStarArr: [number, number, number] = [
          approxPStar(0, demandShift[0]),
          approxPStar(1, demandShift[1]),
          approxPStar(2, demandShift[2]),
        ];
        setStats({ p: [...p] as [number, number, number], z: zArr, pStar: pStarArr });
      }

      if (paramsRef.current.paused) {
        ctx.fillStyle = 'rgba(5,6,10,0.4)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 16px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⏸ en pausa', W / 2, H / 2);
      }
    }

    function drawMarket(
      ctx: CanvasRenderingContext2D,
      i: number,
      p: [number, number, number],
      shift: number,
      ceiling: number | null,
    ) {
      const left  = marketLeft(i) + MARKET_MARGIN;
      const right = marketLeft(i) + MARKET_W - MARKET_MARGIN;
      const top   = 36;
      const bot   = H - 60;
      const midX  = (left + right) / 2;
      const color = COLORS[i];
      const pi    = p[i];

      // Market box background
      ctx.fillStyle = `rgba(${hexToRgb(GLOW[i])},0.04)`;
      ctx.fillRect(left, top, right - left, bot - top);

      // Market name
      ctx.fillStyle = color;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(NAMES[i], midX, top + 12);
      ctx.fillStyle = '#64748B';
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText(UNITS[i], midX, top + 22);

      // Draw supply curve (upward sloping line, price on Y, qty on X)
      // We draw supply and demand curves as lines within the market panel
      const qWidth = right - left;
      const priceRange = P_MAX[i] - P_MIN[i];

      // Demand curve: price on Y axis, quantity on X axis
      // At each test price, compute demand holding other markets' prices fixed.
      ctx.beginPath();
      for (let step = 0; step <= 40; step++) {
        const pi_test = P_MIN[i] + (step / 40) * priceRange;
        const tempP: [number, number, number] = [p[0], p[1], p[2]];
        tempP[i] = pi_test;
        const d_qty = demand(i, tempP, shift);
        const d_norm = Math.max(0, Math.min(1, d_qty / 20));
        const y = priceToY(pi_test, i);
        const dx = left + d_norm * qWidth;
        if (step === 0) {
          ctx.moveTo(dx, y);
        } else {
          ctx.lineTo(dx, y);
        }
      }
      ctx.strokeStyle = `rgba(${hexToRgb(color)},0.6)`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Supply curve
      ctx.beginPath();
      for (let step = 0; step <= 40; step++) {
        const pi_test = P_MIN[i] + (step / 40) * priceRange;
        const tempP: [number, number, number] = [p[0], p[1], p[2]];
        tempP[i] = pi_test;
        const s_qty = supply(i, tempP);
        const s_norm = Math.max(0, Math.min(1, s_qty / 20));
        const y = priceToY(pi_test, i);
        const sx = left + s_norm * qWidth;
        if (step === 0) ctx.moveTo(sx, y);
        else ctx.lineTo(sx, y);
      }
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Equilibrium line (approx, ignoring cross prices)
      const pStar = approxPStar(i, shift);
      const pStarY = priceToY(Math.min(P_MAX[i], Math.max(P_MIN[i], pStar)), i);
      ctx.strokeStyle = `rgba(${hexToRgb(color)},0.35)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(left, pStarY);
      ctx.lineTo(right, pStarY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Current price indicator
      const piClamped = Math.min(P_MAX[i], Math.max(P_MIN[i], pi));
      const piY = priceToY(piClamped, i);

      // Excess demand bar (horizontal) — right side of box
      const z = excess(i, p, shift);
      const barH = Math.min(50, Math.abs(z) * 8);
      const barX = right - 10;
      if (z > 0.1) {
        // Scarcity: demand > supply, draw red bar upward
        ctx.fillStyle = 'rgba(239,68,68,0.7)';
        ctx.fillRect(barX, piY - barH, 8, barH);
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ESCASEZ', barX + 4, piY - barH - 4);
      } else if (z < -0.1) {
        // Surplus: supply > demand, draw orange bar downward
        ctx.fillStyle = 'rgba(251,146,60,0.7)';
        ctx.fillRect(barX, piY, 8, barH);
        ctx.fillStyle = '#FB923C';
        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('EXCESO', barX + 4, piY + barH + 10);
      }

      // Price ceiling line
      if (ceiling !== null) {
        const ceilClamped = Math.min(P_MAX[i], Math.max(P_MIN[i], ceiling));
        const ceilY = priceToY(ceilClamped, i);
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(left, ceilY);
        ctx.lineTo(right - 12, ceilY);
        ctx.stroke();
        // Forbidden zone above ceiling
        ctx.fillStyle = 'rgba(239,68,68,0.08)';
        ctx.fillRect(left, top, right - left, ceilY - top);
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('techo', left + 2, ceilY - 3);
      }

      // Current price dot + label
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(midX, piY, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#E2E8F0';
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`$${pi.toFixed(2)}`, midX, piY - 12);

      // Vertical price axis ticks
      ctx.fillStyle = '#475569';
      ctx.font = '8px ui-monospace, monospace';
      ctx.textAlign = 'right';
      for (let tick = 0; tick <= 4; tick++) {
        const pTick = P_MIN[i] + (tick / 4) * (P_MAX[i] - P_MIN[i]);
        const yTick = priceToY(pTick, i);
        ctx.fillText(`$${pTick.toFixed(0)}`, left - 2, yTick + 3);
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(left, yTick);
        ctx.lineTo(left + 4, yTick);
        ctx.stroke();
      }
    }

    // ── Main loop ────────────────────────────────────────────────────────────
    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!paramsRef.current.paused) {
        acc += dt;
        while (acc >= STEP) { step(STEP); acc -= STEP; }
      }
      draw();
      frame++;
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(raf); };
  }, []);

  // ─── Derived insight ──────────────────────────────────────────────────────
  const anyCeiling = ceil0 || ceil1 || ceil2;
  const activeEscasez = [ceil0, ceil1, ceil2].some((on, i) => {
    if (!on) return false;
    const cv = [ceilVal0, ceilVal1, ceilVal2][i];
    const pStar = approxPStar(i, [shift0, shift1, shift2][i]);
    return cv < pStar;
  });

  const insight = activeEscasez
    ? 'Pusiste el techo abajo del precio de equilibrio. El precio no puede llegar a donde debe — y esa información bloqueada crea escasez. Mira cómo los otros mercados también se desajustan: en la cadena maíz → tortilla → taco, distorsionar uno jala a los demás. Eso es lo que Debreu formalizó.'
    : anyCeiling
      ? 'El techo está arriba del equilibrio, así que todavía no hay daño. Bájalo más hasta que quede debajo del precio natural — ahí verás aparecer la escasez.'
      : Math.max(...stats.z.map(Math.abs)) < 0.3
        ? 'Los tres mercados llegaron al equilibrio general. Nadie lo coordinó: cada quien siguió sus precios y todos cuadraron. Eso es lo que Debreu probó que siempre ocurre bajo las condiciones correctas.'
        : 'Los precios están ajustando. Cambia la demanda en algún mercado y observa cómo los otros reaccionan — están conectados por la cadena de producción.';

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

        {/* ── Canvas ── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* ── Botones ── */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPaused(v => !v)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7] hover:bg-[#4FC3F7]/20 transition"
            >
              {paused ? '▶ reanudar' : '⏸ pausa'}
            </button>
            <button
              onClick={() => {
                simRef.current = { p: [0.5, 1.0, 2.0], vp: [0, 0, 0] };
              }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#FDB813]/40 bg-[#FDB813]/10 text-[#FDB813] hover:bg-[#FDB813]/20 transition"
            >
              ↓ precios al mínimo
            </button>
            <button
              onClick={() => {
                simRef.current = { p: [P_MAX[0] * 0.9, P_MAX[1] * 0.9, P_MAX[2] * 0.9], vp: [0, 0, 0] };
              }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#F472B6]/40 bg-[#F472B6]/10 text-[#F472B6] hover:bg-[#F472B6]/20 transition"
            >
              ↑ precios al máximo
            </button>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-3 gap-3">
            {([0, 1, 2] as const).map(i => {
              const zi = stats.z[i];
              const label = Math.abs(zi) < 0.25 ? '≈ equilibrio' : zi > 0 ? `escasez +${zi.toFixed(1)}` : `excedente ${zi.toFixed(1)}`;
              const accent = Math.abs(zi) < 0.25 ? '#34D399' : zi > 0 ? '#EF4444' : '#FB923C';
              return (
                <div key={i} className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] font-mono mb-0.5" style={{ color: COLORS[i] }}>
                    {NAMES[i]}
                  </div>
                  <div className="text-[17px] font-bold font-mono text-[#E2E8F0]">
                    ${stats.p[i].toFixed(2)}
                  </div>
                  <div className="text-[10px] font-mono mt-0.5" style={{ color: accent }}>
                    {label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Insight ── */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">
              ✦ ¿Qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── Panel de controles ── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Mueve el mercado
          </div>

          {/* Maíz */}
          <MarketControl
            name="Maíz" color={COLORS[0]}
            shift={shift0} onShift={setShift0}
            ceilOn={ceil0} onCeilToggle={() => setCeil0(v => !v)}
            ceilVal={ceilVal0} onCeilVal={setCeilVal0}
            ceilMax={P_MAX[0]}
          />

          {/* Tortilla */}
          <MarketControl
            name="Tortilla" color={COLORS[1]}
            shift={shift1} onShift={setShift1}
            ceilOn={ceil1} onCeilToggle={() => setCeil1(v => !v)}
            ceilVal={ceilVal1} onCeilVal={setCeilVal1}
            ceilMax={P_MAX[1]}
          />

          {/* Taco */}
          <MarketControl
            name="Taco" color={COLORS[2]}
            shift={shift2} onShift={setShift2}
            ceilOn={ceil2} onCeilToggle={() => setCeil2(v => !v)}
            ceilVal={ceilVal2} onCeilVal={setCeilVal2}
            ceilMax={P_MAX[2]}
          />

          {/* Ley de Walras */}
          <WalrasLaw p={stats.p} z={stats.z} />

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo: dp_i/dt = λ·z_i(p)<br />
            z_i = D_i(p) − S_i(p) · exceso de demanda<br />
            Debreu, Theory of Value (1959)<br />
            Arrow & Debreu, Econometrica (1954)
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MarketControl({
  name, color,
  shift, onShift,
  ceilOn, onCeilToggle,
  ceilVal, onCeilVal,
  ceilMax,
}: {
  name: string; color: string;
  shift: number; onShift: (v: number) => void;
  ceilOn: boolean; onCeilToggle: () => void;
  ceilVal: number; onCeilVal: (v: number) => void;
  ceilMax: number;
}) {
  return (
    <div className="space-y-2 pb-3 border-b border-[#1E293B] last:border-0">
      <div className="text-[11px] font-bold font-mono" style={{ color }}>
        {name}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-[11px] text-[#94A3B8]">Demanda</label>
          <span className="text-[11px] font-mono text-[#FDB813]">
            {shift > 0.05 ? `+${shift.toFixed(1)} más` : shift < -0.05 ? `${shift.toFixed(1)} menos` : 'normal'}
          </span>
        </div>
        <input
          type="range" min={-2} max={2} step={0.1} value={shift}
          onChange={e => onShift(Number(e.target.value))}
          className="w-full accent-[#4FC3F7]"
        />
      </div>
      <button
        onClick={onCeilToggle}
        className={`w-full text-[10px] font-mono py-1 rounded border transition ${
          ceilOn
            ? 'border-[#EF4444]/50 bg-[#EF4444]/10 text-[#EF4444]'
            : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
        }`}
      >
        {ceilOn ? '🧱 techo activo' : '○ poner techo de precio'}
      </button>
      {ceilOn && (
        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <label className="text-[10px] text-[#94A3B8]">Techo en</label>
            <span className="text-[10px] font-mono text-[#EF4444]">${ceilVal.toFixed(1)}</span>
          </div>
          <input
            type="range" min={0.5} max={ceilMax - 0.5} step={0.1} value={ceilVal}
            onChange={e => onCeilVal(Number(e.target.value))}
            className="w-full accent-[#EF4444]"
          />
        </div>
      )}
    </div>
  );
}

function WalrasLaw({ p, z }: { p: [number, number, number]; z: [number, number, number] }) {
  const walras = p[0] * z[0] + p[1] * z[1] + p[2] * z[2];
  return (
    <div className="bg-[#070A11] border border-[#1E293B] rounded-lg p-3 space-y-1">
      <div className="text-[9px] uppercase tracking-[0.2em] text-[#64748B] font-mono">
        Ley de Walras: Σ pᵢ·zᵢ
      </div>
      <div
        className="text-[14px] font-bold font-mono"
        style={{ color: Math.abs(walras) < 1.5 ? '#34D399' : '#FB923C' }}
      >
        {walras > 0 ? '+' : ''}{walras.toFixed(2)}
      </div>
      <div className="text-[9px] text-[#475569] leading-snug">
        En equilibrio exacto = 0.<br />
        Aquí ≈ 0 porque los mercados se balancean entre sí.
      </div>
    </div>
  );
}

// ─── Utility ─────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
