/**
 * HicksArrowLab — laboratorio del premio 1972 (John Hicks + Kenneth Arrow).
 *
 * El click: millones de personas toman decisiones sin coordinarse. Y los precios
 * cuadran todos al mismo tiempo. Arrow y Debreu demostraron en 1954 que eso es
 * posible matemáticamente — y Hicks (Value and Capital, 1939) ya había trazado
 * cómo un cambio en un mercado se propaga en cadena a TODOS los demás.
 *
 * Demostración REAL: equilibrio general walrasiano con 3 mercados encadenados.
 *
 *   Mercado 1 — TORTILLAS   : bien de consumo final
 *   Mercado 2 — MAÍZ        : insumo de tortillas  (D_maíz ↑ cuando P_tortilla sube)
 *   Mercado 3 — AGUA        : insumo del maíz      (D_agua  ↑ cuando P_maíz   sube)
 *
 * Funciones de oferta y demanda lineales (calibradas para que los 3 mercados
 * tengan solución interior positiva en los parámetros default):
 *
 *   D_i(p_i, p_j) = a_i - b_i * p_i + c_i * p_j   ← demanda cruza con precio anterior
 *   S_i(p_i)      = d_i + e_i * p_i
 *   Exceso de demanda: z_i = D_i - S_i
 *
 * Tâtonnement de Walras (la dinámica de ajuste):
 *   dp_i/dt = k * z_i(p)    — el precio sube si falta, baja si sobra.
 *
 * Parámetros ajustables: demanda de tortillas (shock al consumidor final),
 * oferta de maíz (shock de cosecha), oferta de agua (sequía).
 * El jugador ve en vivo cómo el shock en un mercado ajusta los TRES precios.
 *
 * Equilibrio analítico (3 ecuaciones, 3 incógnitas):
 *   Se resuelve numéricamente con el propio tâtonnement; también se muestra
 *   la solución simbólica en la leyenda.
 */

import { useEffect, useRef, useState } from 'react';

// ─── Dimensiones del canvas ────────────────────────────────────────────────
const W = 820;
const H = 400;
const STEP = 1 / 120;        // paso de integración (s)
const K_ADJ  = 4.0;          // velocidad de ajuste walrasiano
const DAMP   = 2.8;          // amortiguamiento (fricción viscosa)
const MARKET_N = 3;

// ─── Parámetros del modelo ─────────────────────────────────────────────────
//
// Mercado 0 = TORTILLAS  Mercado 1 = MAÍZ  Mercado 2 = AGUA
//
// D_i = aD_i - bD*p_i + cross_i*p_{i-1}   (i>0 tiene sustituto/insumo)
// S_i = aS_i + bS*p_i

const bD = 1.2;   // pendiente de la demanda propia (↑ precio → ↓ demanda)
const bS = 0.9;   // pendiente de la oferta   propia (↑ precio → ↑ oferta)
// cruce: demanda del mercado i depende del precio del mercado anterior
// tortilla → maíz: más caro la tortilla → más se quiere producir → más maíz
// maíz    → agua : más caro el maíz     → más se cultiva          → más agua
const CROSS = [0, 0.8, 0.7];   // cross[0] sin cruce (tortilla no tiene insumo visible)

const LABELS    = ['Tortillas', 'Maíz', 'Agua'];
const UNITS     = ['$/kg', '$/ton', '$/m³'];
const COLORS    = ['#F59E0B', '#34D399', '#38BDF8'];
const COLORS_DIM= ['#92400E', '#065F46', '#075985'];

// Parámetros aD y aS (ajustados por los sliders del usuario)
// Defaults: equilibrio ~p* = [3.5, 4, 4.5] aproximadamente
interface ModelParams {
  aD: [number, number, number];  // interceptos de demanda
  aS: [number, number, number];  // interceptos de oferta
}

const DEFAULT_PARAMS: ModelParams = {
  aD: [13, 12, 11],
  aS: [3,  2,  1],
};

// ─── Helpers del modelo ────────────────────────────────────────────────────
function demand(i: number, p: number[], params: ModelParams): number {
  const prev = i > 0 ? p[i - 1] : 0;
  return params.aD[i] - bD * p[i] + CROSS[i] * prev;
}

function supply(i: number, p: number[], params: ModelParams): number {
  return params.aS[i] + bS * p[i];
}

function excess(i: number, p: number[], params: ModelParams): number {
  return demand(i, p, params) - supply(i, p, params);
}

// Precio de equilibrio analítico del mercado 0 (sin cruce):
//   aD[0] - bD*p0 = aS[0] + bS*p0  →  p0* = (aD[0] - aS[0]) / (bD + bS)
// Para mercados 1 y 2 depende del precio previo → resuelto por tâtonnement.
function pStar0(params: ModelParams): number {
  return (params.aD[0] - params.aS[0]) / (bD + bS);
}

// ─── Estado de la simulación ───────────────────────────────────────────────
interface SimState {
  p: [number, number, number];    // precios actuales
  vp: [number, number, number];   // velocidades
}

// ─── Mapeo canvas ──────────────────────────────────────────────────────────
const P_MAX = 10;                // precio máximo visible
const MARKET_W = (W - 60) / MARKET_N;   // ancho de cada subgráfica
const MARGIN_L = 20;
const MARGIN_T = 52;
const MARGIN_B = 56;
const GRAPH_H  = H - MARGIN_T - MARGIN_B;

function marketX0(i: number): number { return MARGIN_L + i * MARKET_W; }
function priceToY(p: number): number {
  return MARGIN_T + GRAPH_H - (p / P_MAX) * GRAPH_H;
}
function qtyToX(i: number, q: number, qMax: number): number {
  const x0 = marketX0(i) + 6;
  const w   = MARKET_W - 12;
  return x0 + (q / qMax) * w;
}

export default function HicksArrowLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sliders → parámetros del modelo
  const [demandaTort, setDemandaTort]   = useState(0);   // -3 .. +3 sobre aD[0]
  const [ofertaMaiz,  setOfertaMaiz]    = useState(0);   // -3 .. +3 sobre aS[1]
  const [ofertaAgua,  setOfertaAgua]    = useState(0);   // -3 .. +3 sobre aS[2]
  const [paused,      setPaused]        = useState(false);

  // Stats para los paneles React
  const [prices, setPrices] = useState<[number, number, number]>([3.5, 4.0, 4.5]);
  const [gaps,   setGaps]   = useState<[number, number, number]>([0, 0, 0]);

  // Refs para comunicar con el loop del canvas sin re-render
  const paramsRef = useRef<ModelParams>({ ...DEFAULT_PARAMS });
  const pausedRef = useRef(false);
  const simRef    = useRef<SimState>({
    p:  [3.5, 4.0, 4.5],
    vp: [0, 0, 0],
  });

  // Sincronizar slider → params
  useEffect(() => {
    paramsRef.current = {
      aD: [DEFAULT_PARAMS.aD[0] + demandaTort, DEFAULT_PARAMS.aD[1], DEFAULT_PARAMS.aD[2]],
      aS: [DEFAULT_PARAMS.aS[0], DEFAULT_PARAMS.aS[1] + ofertaMaiz,  DEFAULT_PARAMS.aS[2] + ofertaAgua],
    };
  }, [demandaTort, ofertaMaiz, ofertaAgua]);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // ── Loop principal ─────────────────────────────────────────────────────
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

    let raf = 0;
    let last = performance.now();
    let acc  = 0;
    let frame = 0;

    function stepSim(h: number) {
      const sim  = simRef.current;
      const par  = paramsRef.current;
      for (let i = 0; i < MARKET_N; i++) {
        const z = excess(i, sim.p, par);
        const F = z * K_ADJ;
        sim.vp[i] += F * h;
        sim.vp[i] *= (1 - DAMP * h);
        sim.p[i]  += sim.vp[i] * h;
        if (sim.p[i] < 0.05) { sim.p[i] = 0.05; if (sim.vp[i] < 0) sim.vp[i] = 0; }
        if (sim.p[i] > P_MAX) { sim.p[i] = P_MAX; if (sim.vp[i] > 0) sim.vp[i] = 0; }
      }
    }

    function draw() {
      if (!ctx) return;
      const sim = simRef.current;
      const par = paramsRef.current;

      // Fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#050810');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Título general
      ctx.fillStyle = '#CBD5E1';
      ctx.font = 'bold 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Equilibrio General — Arrow & Hicks 1972', W / 2, 22);

      ctx.fillStyle = '#475569';
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText('dp_i/dt = k · z_i(p)   z_i = demanda − oferta   →  3 mercados se equilibran solos', W / 2, 38);

      const Q_MAX = 20; // escala de cantidades

      for (let i = 0; i < MARKET_N; i++) {
        const x0  = marketX0(i);
        const xMid = x0 + MARKET_W / 2;
        const color = COLORS[i];
        const colorDim = COLORS_DIM[i];
        const p = sim.p[i];

        // ── Curvas de oferta y demanda ──────────────────────────────────
        // Trazamos D y S en función de p_i variando, con p_{i-1} fijo al actual.
        ctx.beginPath();
        for (let j = 0; j <= 60; j++) {
          const pj  = (j / 60) * P_MAX;
          const dv  = demand(i, sim.p.map((v, k) => k === i ? pj : v), par);
          const qx  = qtyToX(i, Math.max(0, dv), Q_MAX);
          const py  = priceToY(pj);
          if (j === 0) ctx.moveTo(qx, py); else ctx.lineTo(qx, py);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Etiqueta D
        {
          const dvTop = demand(i, sim.p.map((v, k) => k === i ? 0.1 : v), par);
          ctx.fillStyle = color;
          ctx.font = 'bold 10px ui-monospace, monospace';
          ctx.textAlign = 'left';
          ctx.fillText('D', qtyToX(i, Math.max(0, dvTop), Q_MAX) + 2, priceToY(0.3));
        }

        ctx.beginPath();
        for (let j = 0; j <= 60; j++) {
          const pj = (j / 60) * P_MAX;
          const sv = supply(i, [pj, pj, pj], par);  // oferta solo depende de p_i
          const qx = qtyToX(i, Math.max(0, sv), Q_MAX);
          const py = priceToY(pj);
          if (j === 0) ctx.moveTo(qx, py); else ctx.lineTo(qx, py);
        }
        ctx.strokeStyle = colorDim;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.9;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Etiqueta S
        {
          const svTop = supply(i, [P_MAX * 0.9, P_MAX * 0.9, P_MAX * 0.9], par);
          ctx.fillStyle = colorDim;
          ctx.font = 'bold 10px ui-monospace, monospace';
          ctx.textAlign = 'left';
          ctx.fillText('S', qtyToX(i, Math.max(0, svTop), Q_MAX) - 12, priceToY(P_MAX * 0.82));
        }

        // ── Línea de precio actual ──────────────────────────────────────
        const py = priceToY(p);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x0 + 6, py);
        ctx.lineTo(x0 + MARKET_W - 6, py);
        ctx.stroke();
        ctx.setLineDash([]);

        // Bola del precio
        const bx = xMid;
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur  = 18;
        const gr = ctx.createRadialGradient(bx - 3, py - 3, 2, bx, py, 9);
        gr.addColorStop(0, '#FEF3C7');
        gr.addColorStop(1, color);
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(bx, py, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Precio encima de la bola
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`$${p.toFixed(2)}`, bx, py - 14);

        // ── Exceso de demanda ───────────────────────────────────────────
        const z = excess(i, sim.p, par);
        ctx.textAlign = 'center';
        ctx.font = 'bold 11px ui-sans-serif, system-ui';
        const statusY = H - MARGIN_B + 14;
        if (Math.abs(z) > 0.2) {
          ctx.fillStyle = z > 0 ? '#EF4444' : '#FB923C';
          ctx.fillText(z > 0 ? `↑ falta ${z.toFixed(1)}` : `↓ sobra ${(-z).toFixed(1)}`, xMid, statusY);
        } else {
          ctx.fillStyle = '#34D399';
          ctx.fillText('✓ equilibrio', xMid, statusY);
        }

        // Nombre del mercado
        ctx.fillStyle = '#94A3B8';
        ctx.font = `bold 11px ui-sans-serif, system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(LABELS[i], xMid, MARGIN_T - 10);

        ctx.fillStyle = '#475569';
        ctx.font = '9px ui-monospace, monospace';
        ctx.fillText(UNITS[i], xMid, MARGIN_T - 1);

        // Separador vertical entre mercados
        if (i < MARKET_N - 1) {
          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x0 + MARKET_W, MARGIN_T - 16);
          ctx.lineTo(x0 + MARKET_W, H - MARGIN_B + 20);
          ctx.stroke();

          // Flecha de enlace entre mercados
          const arrowX = x0 + MARKET_W;
          const arrowY = H / 2;
          ctx.fillStyle = '#334155';
          ctx.font = '14px ui-sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('→', arrowX, arrowY + 5);
          ctx.font = '8px ui-monospace';
          ctx.fillStyle = '#475569';
          ctx.fillText('insumo', arrowX, arrowY + 16);
        }

        // Eje Y (precio) — marcas
        ctx.fillStyle = '#334155';
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'right';
        for (const tick of [0, 2, 4, 6, 8, 10]) {
          const ty = priceToY(tick);
          ctx.fillText(`${tick}`, x0 + 18, ty + 3);
          ctx.strokeStyle = '#1A2030';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(x0 + 20, ty);
          ctx.lineTo(x0 + MARKET_W - 4, ty);
          ctx.stroke();
        }
      }

      // Pausa overlay
      if (pausedRef.current) {
        ctx.fillStyle = 'rgba(5,6,10,0.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 16px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⏸ en pausa', W / 2, H / 2);
      }

      // Stats para UI React (cada 10 frames)
      if (frame % 10 === 0) {
        const g: [number, number, number] = [
          excess(0, sim.p, par),
          excess(1, sim.p, par),
          excess(2, sim.p, par),
        ];
        setPrices([sim.p[0], sim.p[1], sim.p[2]]);
        setGaps(g);
      }
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) {
        acc += dt;
        while (acc >= STEP) { stepSim(STEP); acc -= STEP; }
      }
      draw();
      frame++;
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); };
  }, []);

  // ── Calcular equilibrio analítico del mercado 0 para mostrar en leyenda
  const params = paramsRef.current;
  const p0Star = pStar0(params).toFixed(2);

  // ── Insight dinámico ──────────────────────────────────────────────────
  const allEq = gaps.every(g => Math.abs(g) < 0.3);
  const tortFalta = gaps[0] > 0.3;
  const insight = allEq
    ? 'Los tres mercados llegaron a su equilibrio al mismo tiempo, sin que nadie los coordinara. Eso es lo que Arrow y Debreu demostraron formalmente: bajo competencia, el sistema de precios resuelve solo un problema de millones de variables.'
    : tortFalta
    ? 'Faltan tortillas → su precio sube. Al subir el precio de las tortillas, vale la pena producir más → se demanda más maíz → sube el precio del maíz → se demanda más agua. El jalón se propaga en cadena — eso es equilibrio general.'
    : demandaTort > 1
    ? 'Subiste la demanda de tortillas (más gente las quiere). El sistema está ajustando los tres precios al mismo tiempo: tortilla → maíz → agua. Observa cómo el jalón de un solo mercado se transmite en cascada.'
    : ofertaMaiz < -1
    ? 'Bajaste la oferta de maíz (sequía de cosecha). El precio del maíz sube → encarece la tortilla (que lo usa de insumo) → y el sistema reajusta agua también. Un shock upstream se derrama hacia abajo.'
    : ofertaAgua < -1
    ? 'Menos agua disponible → sube su precio → encarece el maíz → encarece la tortilla. Una restricción en el recurso base propaga su costo hasta el bien final. Así funciona la cadena de suministros.'
    : 'Mueve los sliders y observa cómo un shock en cualquier mercado ajusta los tres precios. Eso es el insight de Arrow y Hicks: nada ocurre en una burbuja — todo jalón tiene eco en toda la red.';

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

          {/* Botones */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPaused(v => !v)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7] hover:bg-[#4FC3F7]/20 transition"
            >
              {paused ? '▶ reanudar' : '⏸ pausa'}
            </button>
            <button
              onClick={() => {
                simRef.current.p  = [9.0, 8.0, 7.0];
                simRef.current.vp = [0, 0, 0];
              }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/20 transition"
            >
              🔀 shock: precios altos
            </button>
            <button
              onClick={() => {
                simRef.current.p  = [0.3, 0.4, 0.5];
                simRef.current.vp = [0, 0, 0];
              }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#38BDF8]/40 bg-[#38BDF8]/10 text-[#38BDF8] hover:bg-[#38BDF8]/20 transition"
            >
              🔀 shock: precios bajos
            </button>
            <button
              onClick={() => {
                setDemandaTort(0);
                setOfertaMaiz(0);
                setOfertaAgua(0);
              }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#475569]/40 bg-[#1E293B]/50 text-[#94A3B8] hover:text-[#CBD5E1] transition"
            >
              ↺ reset sliders
            </button>
          </div>

          {/* Chips de precios */}
          <div className="grid grid-cols-3 gap-3">
            {LABELS.map((lbl, i) => (
              <StatChip
                key={lbl}
                label={lbl}
                price={prices[i]}
                gap={gaps[i]}
                unit={UNITS[i]}
                color={COLORS[i]}
              />
            ))}
          </div>

          {/* Insight dinámico */}
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
            ⚙ Mueve el sistema
          </div>

          <Slider
            label="Demanda de tortillas"
            value={demandaTort}
            min={-3}
            max={3}
            step={0.1}
            onChange={setDemandaTort}
            fmt={v =>
              v < -1.5 ? 'muy baja'
              : v < -0.5 ? 'baja'
              : v < 0.5 ? 'normal'
              : v < 1.5 ? 'alta'
              : 'muy alta'
            }
            hint="Más hambre → sube precio → se demanda más maíz → más agua."
          />

          <Slider
            label="Oferta de maíz (cosecha)"
            value={ofertaMaiz}
            min={-3}
            max={3}
            step={0.1}
            onChange={setOfertaMaiz}
            fmt={v =>
              v < -1.5 ? 'sequía grave'
              : v < -0.5 ? 'cosecha baja'
              : v < 0.5 ? 'normal'
              : v < 1.5 ? 'cosecha buena'
              : 'cosecha récord'
            }
            hint="Menos maíz en el campo → escasez → precio sube → tortilla más cara."
          />

          <Slider
            label="Oferta de agua"
            value={ofertaAgua}
            min={-3}
            max={3}
            step={0.1}
            onChange={setOfertaAgua}
            fmt={v =>
              v < -1.5 ? 'sequía'
              : v < -0.5 ? 'escasa'
              : v < 0.5 ? 'normal'
              : v < 1.5 ? 'abundante'
              : 'lluvias récord'
            }
            hint="El agua encarece todo lo que usa agua. La cadena va hacia arriba."
          />

          {/* Fórmula */}
          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed space-y-1">
            <div className="text-[#64748B] font-bold mb-1">Tâtonnement de Walras:</div>
            <div>dp_i/dt = k · (D_i − S_i)</div>
            <div>D_i = a_i − 1.2·p_i + c_i·p_&#123;i-1&#125;</div>
            <div>S_i = b_i + 0.9·p_i</div>
            <div className="pt-1">p*₀ ≈ ${p0Star} (analítico, sin cruces)</div>
            <div className="text-[#334155] pt-1">
              Arrow & Debreu (1954)<br />Hicks, Value and Capital (1939)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente auxiliar: chip de estadística por mercado ─────────────────
function StatChip({
  label, price, gap, unit, color,
}: {
  label: string; price: number; gap: number; unit: string; color: string;
}) {
  const eqOk = Math.abs(gap) < 0.3;
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#64748B] font-mono mb-1">
        {label}
      </div>
      <div className="text-[19px] font-bold font-mono" style={{ color }}>
        ${price.toFixed(2)}
        <span className="text-[10px] font-normal text-[#475569] ml-1">{unit}</span>
      </div>
      <div
        className="text-[10px] font-mono mt-0.5"
        style={{ color: eqOk ? '#34D399' : gap > 0 ? '#EF4444' : '#FB923C' }}
      >
        {eqOk ? '✓ eq' : gap > 0 ? `↑ falta ${gap.toFixed(1)}` : `↓ sobra ${(-gap).toFixed(1)}`}
      </div>
    </div>
  );
}

// ─── Slider reutilizable ───────────────────────────────────────────────────
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
          {fmt ? fmt(value) : value.toFixed(1)}
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
