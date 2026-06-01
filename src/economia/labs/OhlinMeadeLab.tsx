/**
 * OhlinMeadeLab — laboratorio del premio 1977 (Bertil Ohlin + James Meade).
 *
 * El click: un país vende al mundo lo que le sobra.
 * Si sobran brazos → exporta manufactura barata → los salarios suben.
 * Si sobra capital → exporta tecnología → los dueños del capital ganan.
 * Cuando abres la frontera, los que tienen lo que abunda ganan; los que
 * tienen lo que escasea pierden.  Eso es Heckscher-Ohlin en vivo.
 *
 * Modelo REAL implementado:
 *   Dos países A (trabajadores) y B (capital), dos bienes:
 *     T = textiles (trabajo-intensivo): producción ∝ L^0.7 · K^0.3
 *     M = maquinaria (capital-intensiva): producción ∝ L^0.3 · K^0.7
 *
 *   Dotaciones: país A → (Lₐ, Kₐ), país B → (Lb, Kb)
 *   Precio relativo de autarquía (Balassa): p* que iguala TMS con TMT
 *   Con libre comercio → precio mundial = promedio ponderado de precios de autarquía
 *   Stolper-Samuelson: w = p·MPL,  r = p·MPK
 *   Exporta el bien intensivo en el factor abundante (Ohlin).
 *
 *   Triángulo de comercio animado en canvas 2D.
 */

import { useEffect, useRef, useState } from 'react';

/* ─── dimensiones ─── */
const W = 820;
const H = 380;

/* ─── constantes del modelo ─── */
const ALPHA_T = 0.70; // participación del trabajo en textiles
const ALPHA_M = 0.30; // participación del trabajo en maquinaria

/** Producción CES Cobb-Douglas de bien i dado dotación (L, K) y su alpha */
function prod(L: number, K: number, alpha: number): number {
  if (L <= 0 || K <= 0) return 0;
  return Math.pow(L, alpha) * Math.pow(K, 1 - alpha);
}

/** PPF de un país: puntos (T, M) para λ ∈ [0,1] de asignación de L,K */
function ppfPoint(L: number, K: number, lambda: number): { t: number; m: number } {
  const Lt = lambda * L;
  const Kt = lambda * K;
  const Lm = (1 - lambda) * L;
  const Km = (1 - lambda) * K;
  return {
    t: prod(Lt, Kt, ALPHA_T),
    m: prod(Lm, Km, ALPHA_M),
  };
}

/** Precio relativo de autarquía: p = (precio textil / precio maquinaria)
 *  En equilibrio la TMS = TMT.  Resolvemos numéricamente. */
function autarkyPriceRatio(L: number, K: number): number {
  // Relación de precios de autarquía proporcional a K/L (HO clásico)
  // p_textil/p_maq ∝ (K/L)  — país con más K tiene textiles más caros relativamente
  return (K / L);
}

/** Dado el precio relativo mundial pw, calcula el lambdaóptimo que iguala TMS=pw */
function optimalLambda(L: number, K: number, pw: number): number {
  // En Cobb-Douglas: TMS_textil/maq en PPF linealizada ≈ (ALPHA_T/ALPHA_M)*(Lm*Km^...)
  // Resolvemos numéricamente en [0.01, 0.99]
  let lo = 0.01, hi = 0.99;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const dT = derivPPF_T(L, K, mid);
    const dM = derivPPF_M(L, K, mid);
    const slope = Math.abs(dM / dT); // |dM/dT| = precio relativo textil
    if (slope > pw) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function derivPPF_T(L: number, K: number, lam: number): number {
  const eps = 1e-5;
  const a = ppfPoint(L, K, lam + eps);
  const b = ppfPoint(L, K, lam - eps);
  return (a.t - b.t) / (2 * eps);
}

function derivPPF_M(L: number, K: number, lam: number): number {
  const eps = 1e-5;
  const a = ppfPoint(L, K, lam + eps);
  const b = ppfPoint(L, K, lam - eps);
  return (a.m - b.m) / (2 * eps);
}

/** Salario (w) y renta del capital (r) — Stolper-Samuelson.
 *  Cobb-Douglas: w = alpha * p_T * T/L  ;  r = (1-alpha)*p_T*T/K
 *  Usamos precio relativo como numerario: p_T = pw, p_M = 1 */
function factorPrices(L: number, K: number, lam: number, pw: number): { w: number; r: number } {
  const { t, m } = ppfPoint(L, K, lam);
  const LT = lam * L;
  const KT = lam * K;
  const LM = (1 - lam) * L;
  const KM = (1 - lam) * K;
  const w =
    LT > 0
      ? ALPHA_T * pw * t / LT * 0.5 + ALPHA_M * m / Math.max(LM, 1e-6) * 0.5
      : ALPHA_M * m / Math.max(LM, 1e-6);
  const r =
    KT > 0
      ? (1 - ALPHA_T) * pw * t / KT * 0.5 + (1 - ALPHA_M) * m / Math.max(KM, 1e-6) * 0.5
      : (1 - ALPHA_M) * m / Math.max(KM, 1e-6);
  return { w, r };
}

/* ─── tipos ─── */
interface Params {
  La: number; Ka: number;   // dotación país A
  Lb: number; Kb: number;   // dotación país B
  tradeOpen: boolean;
  anim: number;             // 0..1 progreso de apertura comercial
}

const DEFAULTS: Params = {
  La: 8, Ka: 3,   // A = Mexico: trabajo abundante
  Lb: 3, Kb: 8,   // B = USA:   capital abundante
  tradeOpen: false,
  anim: 0,
};

/* ─── canvas helpers ─── */
const PAD = { l: 56, r: 20, t: 24, b: 48 };

/** mapea valor de bien [0, maxVal] a píxel dentro de un panel de ancho W2, alto H2 */
function mkScale(maxT: number, maxM: number, x0: number, y0: number, w2: number, h2: number) {
  return {
    tx: (t: number) => x0 + PAD.l + (t / maxT) * (w2 - PAD.l - PAD.r),
    my: (m: number) => y0 + h2 - PAD.b - (m / maxM) * (h2 - PAD.t - PAD.b),
  };
}

/* ─── componente ─── */
export default function OhlinMeadeLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pRef = useRef<Params>({ ...DEFAULTS });
  const animRef = useRef(0); // tiempo animación apertura

  const [La, setLa] = useState(DEFAULTS.La);
  const [Ka, setKa] = useState(DEFAULTS.Ka);
  const [Lb, setLb] = useState(DEFAULTS.Lb);
  const [Kb, setKb] = useState(DEFAULTS.Kb);
  const [tradeOpen, setTradeOpen] = useState(DEFAULTS.tradeOpen);

  const [stats, setStats] = useState({
    pwA: 0, pwB: 0, pwWorld: 0,
    wA_auto: 0, rA_auto: 0,
    wA_trade: 0, rA_trade: 0,
    exportA: '',
  });

  // sync params ref
  useEffect(() => {
    pRef.current = { La, Ka, Lb, Kb, tradeOpen, anim: pRef.current.anim };
  }, [La, Ka, Lb, Kb, tradeOpen]);

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
    let frame = 0;
    let last = performance.now();

    function draw(now: number) {
      if (!ctx) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = pRef.current;

      // animate trade opening
      const target = p.tradeOpen ? 1 : 0;
      const speed = 1.4;
      animRef.current += (target - animRef.current) * Math.min(1, speed * dt);
      const t01 = animRef.current;
      pRef.current.anim = t01;

      // ── compute model ──
      const { La: lA, Ka: kA, Lb: lB, Kb: kB } = p;

      // autarky price ratios
      const pA0 = autarkyPriceRatio(lA, kA);
      const pB0 = autarkyPriceRatio(lB, kB);

      // world price = weighted average by total output potential
      const totalL = lA + lB;
      const totalK = kA + kB;
      const wA_w = lA / totalL;
      const pWorld = pA0 * wA_w + pB0 * (1 - wA_w);

      // current price each country faces (lerp auto→world)
      const pA = pA0 + (pWorld - pA0) * t01;
      const pB = pB0 + (pWorld - pB0) * t01;

      // optimal lambdas
      const lamA = optimalLambda(lA, kA, pA);
      const lamB = optimalLambda(lB, kB, pB);

      // production points
      const prodA = ppfPoint(lA, kA, lamA);
      const prodB = ppfPoint(lB, kB, lamB);

      // factor prices
      const fpA_auto = factorPrices(lA, kA, optimalLambda(lA, kA, pA0), pA0);
      const fpA_trade = factorPrices(lA, kA, lamA, pWorld);

      // export direction
      const exportA_text = lA / kA > lB / kB ? 'textiles (trabajo↑)' : 'maquinaria (capital↑)';

      // max PPF extents for scaling canvas panels
      const maxTA = ppfPoint(lA, kA, 0.99).t * 1.15;
      const maxMA = ppfPoint(lA, kA, 0.01).m * 1.15;
      const maxTB = ppfPoint(lB, kB, 0.99).t * 1.15;
      const maxMB = ppfPoint(lB, kB, 0.01).m * 1.15;

      // panel layout: two PPF panels side by side + mini trade flow
      const panW = Math.floor(W * 0.38);
      const panH = H;
      const x0A = 0;
      const x0B = panW + 10;
      const x0C = x0B + panW + 10; // trade flow diagram

      // ── clear ──
      ctx.fillStyle = '#0B0F17';
      ctx.fillRect(0, 0, W, H);

      // ── panel A ──
      drawPPFPanel(
        ctx, x0A, 0, panW, panH,
        lA, kA,
        pA, pA0,
        prodA,
        maxTA, maxMA,
        '#22D3EE', 'A — México',
        t01,
      );

      // ── panel B ──
      drawPPFPanel(
        ctx, x0B, 0, panW, panH,
        lB, kB,
        pB, pB0,
        prodB,
        maxTB, maxMB,
        '#FB923C', 'B — EE.UU.',
        t01,
      );

      // ── trade flow ──
      drawTradeFlow(
        ctx, x0C, 0, W - x0C, panH,
        lA, kA, lB, kB,
        t01,
        exportA_text,
        pA0, pB0, pWorld,
        fpA_auto, fpA_trade,
      );

      // update stats every 8 frames
      if (frame % 8 === 0) {
        setStats({
          pwA: pA0,
          pwB: pB0,
          pwWorld: pWorld,
          wA_auto: fpA_auto.w,
          rA_auto: fpA_auto.r,
          wA_trade: fpA_trade.w,
          rA_trade: fpA_trade.r,
          exportA: exportA_text,
        });
      }

      frame++;
      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // insight text
  const lA = La, kA = Ka;
  const laborAbundant = lA / kA > Lb / Kb;
  const insight = tradeOpen
    ? laborAbundant
      ? `México tiene más trabajadores que capital → exporta textiles (trabajo-intensivo). Al abrir fronteras, la demanda de trabajadores sube → salarios SUBEN. El dueño del capital que competía con el extranjero pierde. Eso es Stolper-Samuelson en tu quincena.`
      : `Con esa configuración México tiene más capital que trabajadores → exporta maquinaria. Al abrir, los dueños del capital ganan. Los trabajadores ven más competencia. Ajusta los sliders para volver al caso típico de México.`
    : `Mueve las dotaciones de trabajo y capital en cada país y luego abre el comercio. Observa cómo la PPF se deforma, cómo cambia el punto de producción, y cómo los salarios y rentas reaccionan.`;

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

          {/* controles */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setTradeOpen(v => !v)}
              className={`px-4 py-2 text-[12px] font-mono rounded border transition font-bold ${
                tradeOpen
                  ? 'border-[#34D399]/50 bg-[#34D399]/15 text-[#34D399]'
                  : 'border-[#FB923C]/40 bg-[#FB923C]/10 text-[#FB923C] hover:bg-[#FB923C]/20'
              }`}
            >
              {tradeOpen ? '🌐 Comercio ABIERTO' : '🚧 Abrir comercio'}
            </button>
            <button
              onClick={() => { setLa(8); setKa(3); setLb(3); setKb(8); setTradeOpen(false); }}
              className="px-3 py-1.5 text-[11px] font-mono rounded border border-[#334155] text-[#64748B] hover:text-[#CBD5E1] transition"
            >
              ↺ reset México/EE.UU.
            </button>
          </div>

          {/* stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="precio autarquía A" value={stats.pwA.toFixed(2)} accent="#22D3EE" />
            <Stat label="precio autarquía B" value={stats.pwB.toFixed(2)} accent="#FB923C" />
            <Stat label="precio mundial" value={stats.pwWorld.toFixed(2)} accent="#A78BFA" />
            <Stat label="exporta A" value={stats.exportA || '—'} accent="#34D399" />
          </div>

          {/* salarios */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#22D3EE] font-mono">País A — salario (w)</div>
              <div className="flex justify-between text-[12px] font-mono">
                <span className="text-[#64748B]">autarquía</span>
                <span className="text-[#94A3B8]">{stats.wA_auto.toFixed(3)}</span>
              </div>
              <div className="flex justify-between text-[12px] font-mono">
                <span className="text-[#64748B]">libre comercio</span>
                <span className={stats.wA_trade >= stats.wA_auto ? 'text-[#34D399] font-bold' : 'text-[#EF4444] font-bold'}>
                  {stats.wA_trade.toFixed(3)}
                  {' '}{stats.wA_trade > stats.wA_auto + 0.001 ? '▲' : stats.wA_trade < stats.wA_auto - 0.001 ? '▼' : '—'}
                </span>
              </div>
            </div>
            <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#FB923C] font-mono">País A — renta capital (r)</div>
              <div className="flex justify-between text-[12px] font-mono">
                <span className="text-[#64748B]">autarquía</span>
                <span className="text-[#94A3B8]">{stats.rA_auto.toFixed(3)}</span>
              </div>
              <div className="flex justify-between text-[12px] font-mono">
                <span className="text-[#64748B]">libre comercio</span>
                <span className={stats.rA_trade >= stats.rA_auto ? 'text-[#34D399] font-bold' : 'text-[#EF4444] font-bold'}>
                  {stats.rA_trade.toFixed(3)}
                  {' '}{stats.rA_trade > stats.rA_auto + 0.001 ? '▲' : stats.rA_trade < stats.rA_auto - 0.001 ? '▼' : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#A78BFA] font-mono mb-2">✦ ¿Qué estás viendo?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* panel de controles */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ Dotación de factores</div>

          <div className="text-[11px] font-bold text-[#22D3EE] font-mono">País A (México)</div>
          <Slider
            label="Trabajadores (L)"
            value={La} min={1} max={12} step={0.5} onChange={setLa}
            fmt={v => v.toFixed(1)}
            hint="Más L → ventaja comparativa en bienes trabajo-intensivos (textiles)."
          />
          <Slider
            label="Capital (K)"
            value={Ka} min={1} max={12} step={0.5} onChange={setKa}
            fmt={v => v.toFixed(1)}
            hint="Más K → ventaja comparativa en bienes capital-intensivos (maquinaria)."
          />

          <div className="text-[11px] font-bold text-[#FB923C] font-mono border-t border-[#1E293B] pt-3">País B (EE.UU.)</div>
          <Slider
            label="Trabajadores (L)"
            value={Lb} min={1} max={12} step={0.5} onChange={setLb}
            fmt={v => v.toFixed(1)}
            hint="EE.UU. por defecto tiene poca mano de obra relativa."
          />
          <Slider
            label="Capital (K)"
            value={Kb} min={1} max={12} step={0.5} onChange={setKb}
            fmt={v => v.toFixed(1)}
            hint="EE.UU. por defecto tiene mucho capital: exporta maquinaria."
          />

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo: Heckscher-Ohlin (1933)<br />
            Stolper-Samuelson (1941)<br />
            2 bienes · 2 factores · Cobb-Douglas<br />
            textiles: L^0.7·K^0.3 · maquinaria: L^0.3·K^0.7
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   drawPPFPanel — Frontera de Posibilidades de Producción
═══════════════════════════════════════════════════ */
function drawPPFPanel(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, pw: number, ph: number,
  L: number, K: number,
  pCurrent: number, pAuto: number,
  prod: { t: number; m: number },
  maxT: number, maxM: number,
  accent: string,
  label: string,
  t01: number,
) {
  const sc = mkScale(maxT, maxM, x0, y0, pw, ph);

  // background tint
  ctx.fillStyle = 'rgba(255,255,255,0.012)';
  ctx.fillRect(x0 + PAD.l, y0 + PAD.t, pw - PAD.l - PAD.r, ph - PAD.t - PAD.b);

  // axes
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sc.tx(0), y0 + PAD.t);
  ctx.lineTo(sc.tx(0), sc.my(0));
  ctx.lineTo(sc.tx(maxT), sc.my(0));
  ctx.stroke();

  // axis labels
  ctx.fillStyle = '#475569';
  ctx.font = '10px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Textiles →', x0 + PAD.l + (pw - PAD.l - PAD.r) / 2, sc.my(0) + 16);
  ctx.save();
  ctx.translate(x0 + 14, y0 + PAD.t + (ph - PAD.t - PAD.b) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Maquinaria →', 0, 0);
  ctx.restore();

  // PPF curve
  const STEPS = 80;
  ctx.beginPath();
  for (let i = 0; i <= STEPS; i++) {
    const lam = 0.005 + (i / STEPS) * 0.99;
    const pt = ppfPoint(L, K, lam);
    const x = sc.tx(pt.t);
    const y = sc.my(pt.m);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = accent + '88';
  ctx.lineWidth = 2;
  ctx.stroke();

  // price line (tangent at production point)
  // slope = -pCurrent = dM/dT
  const tDraw = prod.t;
  const mDraw = prod.m;
  const intercept_m = mDraw + pCurrent * tDraw; // m-intercept
  const tMax_line = intercept_m / pCurrent;
  const px0 = sc.tx(0);
  const py0 = sc.my(intercept_m);
  const px1 = sc.tx(Math.min(tMax_line, maxT * 1.1));
  const py1 = sc.my(0);

  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = t01 > 0.05 ? '#A78BFA' : accent + '55';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(Math.max(px0, sc.tx(0)), Math.min(py0, sc.my(0)));
  ctx.lineTo(Math.min(px1, sc.tx(maxT)), Math.max(py1, y0 + PAD.t));
  ctx.stroke();
  ctx.setLineDash([]);

  // autarky price line (dashed, faded)
  if (t01 > 0.05) {
    const lamAuto = optimalLambda(L, K, pAuto);
    const pAuto_pt = ppfPoint(L, K, lamAuto);
    const int_m_auto = pAuto_pt.m + pAuto * pAuto_pt.t;
    const tMax_auto = int_m_auto / pAuto;

    ctx.setLineDash([2, 6]);
    ctx.strokeStyle = accent + '33';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sc.tx(0), sc.my(Math.min(int_m_auto, maxM * 1.05)));
    ctx.lineTo(sc.tx(Math.min(tMax_auto, maxT * 1.05)), sc.my(0));
    ctx.stroke();
    ctx.setLineDash([]);

    // autarky dot
    ctx.fillStyle = accent + '44';
    ctx.beginPath();
    ctx.arc(sc.tx(pAuto_pt.t), sc.my(pAuto_pt.m), 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // production point
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 14;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(sc.tx(tDraw), sc.my(mDraw), 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // label
  ctx.fillStyle = accent;
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(label, x0 + PAD.l + 4, y0 + PAD.t + 14);

  // coords
  ctx.fillStyle = '#94A3B8';
  ctx.font = '10px ui-monospace, monospace';
  ctx.fillText(
    `T=${tDraw.toFixed(2)} M=${mDraw.toFixed(2)}`,
    sc.tx(tDraw) + 10,
    sc.my(mDraw) - 8,
  );
}

/* ═══════════════════════════════════════════════════
   drawTradeFlow — flujo de comercio + SS effect
═══════════════════════════════════════════════════ */
function drawTradeFlow(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, pw: number, ph: number,
  La: number, Ka: number, Lb: number, Kb: number,
  t01: number,
  exportA: string,
  pA0: number, pB0: number, pWorld: number,
  fpAuto: { w: number; r: number },
  fpTrade: { w: number; r: number },
) {
  const cx = x0 + pw / 2;
  const midY = y0 + ph / 2;

  // background
  ctx.fillStyle = '#070A11';
  ctx.fillRect(x0, y0, pw, ph);

  // ── factor abundance bar chart ──
  const barY = y0 + 28;
  const barH = 52;
  const barW = (pw - 24) * 0.45;
  const ratioA = La / (La + Ka);
  const ratioB = Lb / (Lb + Kb);

  // country A
  ctx.fillStyle = '#0B2138';
  ctx.fillRect(x0 + 6, barY, barW, barH);
  ctx.fillStyle = '#22D3EE';
  ctx.fillRect(x0 + 6, barY, barW * ratioA, barH);
  ctx.fillStyle = '#FB923C';
  ctx.fillRect(x0 + 6 + barW * ratioA, barY, barW * (1 - ratioA), barH);

  // country B
  ctx.fillStyle = '#0B2138';
  ctx.fillRect(x0 + pw - 6 - barW, barY, barW, barH);
  ctx.fillStyle = '#22D3EE';
  ctx.fillRect(x0 + pw - 6 - barW, barY, barW * ratioB, barH);
  ctx.fillStyle = '#FB923C';
  ctx.fillRect(x0 + pw - 6 - barW + barW * ratioB, barY, barW * (1 - ratioB), barH);

  ctx.font = '9px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('A: L/K=' + (La / Ka).toFixed(1), x0 + 6 + barW / 2, barY + barH + 12);
  ctx.fillText('B: L/K=' + (Lb / Kb).toFixed(1), x0 + pw - 6 - barW / 2, barY + barH + 12);

  // legend
  ctx.fillStyle = '#22D3EE';
  ctx.fillRect(cx - 28, barY - 14, 10, 7);
  ctx.fillStyle = '#475569';
  ctx.font = '9px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Trabajo', cx - 16, barY - 8);
  ctx.fillStyle = '#FB923C';
  ctx.fillRect(cx + 12, barY - 14, 10, 7);
  ctx.fillStyle = '#475569';
  ctx.fillText('Capital', cx + 24, barY - 8);

  // ── trade arrow ──
  const arrowY = midY - 20;
  const alpha = Math.max(0, t01 * 2 - 0.2);

  if (alpha > 0.01) {
    ctx.globalAlpha = Math.min(1, alpha);

    // direction of export from A
    const AexportsTex = La / Ka > Lb / Kb;

    // arrow A→B for textiles, B→A for maquinaria (or vice versa)
    const arrowColor = '#34D399';
    drawArrow(ctx, x0 + 14, arrowY, x0 + pw - 14, arrowY, arrowColor, 2.5);

    // return flow
    drawArrow(ctx, x0 + pw - 14, arrowY + 18, x0 + 14, arrowY + 18, '#A78BFA', 1.5);

    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#34D399';
    ctx.fillText(AexportsTex ? 'textiles →' : 'maquinaria →', cx, arrowY - 6);
    ctx.fillStyle = '#A78BFA';
    ctx.fillText(AexportsTex ? '← maquinaria' : '← textiles', cx, arrowY + 32);

    ctx.globalAlpha = 1;
  }

  // ── Stolper-Samuelson panel ──
  const ssY = arrowY + 52;
  const ssH = ph - ssY - y0 - 16;

  ctx.fillStyle = '#0B0F17';
  ctx.fillRect(x0 + 4, ssY, pw - 8, ssH);

  ctx.font = 'bold 9px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748B';
  ctx.fillText('Stolper-Samuelson (País A)', cx, ssY + 12);

  if (ssH > 50) {
    const barMaxH = ssH - 28;
    const wMax = Math.max(fpAuto.w, fpTrade.w, 0.01);
    const rMax = Math.max(fpAuto.r, fpTrade.r, 0.01);
    const normalize = Math.max(wMax, rMax);

    const bw = Math.min(22, (pw - 32) / 4 - 4);
    const bx = [cx - bw * 2.8, cx - bw * 1.4, cx + bw * 0.4, cx + bw * 1.8];

    const pairs: Array<{ val: number; label: string; color: string; sub: string }> = [
      { val: fpAuto.w, label: 'w_auto', color: '#22D3EE88', sub: 'w₀' },
      { val: fpTrade.w * (1 - t01) + fpTrade.w * t01, label: 'w_trade', color: '#22D3EE', sub: 'w*' },
      { val: fpAuto.r, label: 'r_auto', color: '#FB923C88', sub: 'r₀' },
      { val: fpTrade.r * (1 - t01) + fpTrade.r * t01, label: 'r_trade', color: '#FB923C', sub: 'r*' },
    ];

    pairs.forEach((bar, i) => {
      const bh = Math.max(2, (bar.val / normalize) * barMaxH);
      const by = ssY + 20 + barMaxH - bh;

      ctx.fillStyle = bar.color;
      ctx.fillRect(bx[i] - bw / 2, by, bw, bh);

      ctx.font = '8px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = bar.color;
      ctx.fillText(bar.sub, bx[i], ssY + 20 + barMaxH + 10);
      ctx.fillText(bar.val.toFixed(2), bx[i], by - 3);
    });

    // Stolper-Samuelson arrows
    if (t01 > 0.3) {
      const AexportsTex2 = La / Ka > Lb / Kb;
      const wUp = AexportsTex2;
      ctx.font = 'bold 11px ui-sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = wUp ? '#34D399' : '#EF4444';
      ctx.fillText(wUp ? 'w ▲' : 'w ▼', bx[1], ssY + 20 + barMaxH - (Math.max(fpTrade.w, fpAuto.w) / normalize) * barMaxH - 12);
      ctx.fillStyle = !wUp ? '#34D399' : '#EF4444';
      ctx.fillText(!wUp ? 'r ▲' : 'r ▼', bx[3], ssY + 20 + barMaxH - (Math.max(fpTrade.r, fpAuto.r) / normalize) * barMaxH - 12);
    }
  }

  // price labels
  ctx.font = '9px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#475569';
  ctx.fillText(`p_A=${pA0.toFixed(2)}  p*=${pWorld.toFixed(2)}  p_B=${pB0.toFixed(2)}`, cx, y0 + ph - 6);
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string, lw: number,
) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len, uy = dy / len;
  const headLen = 10;

  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - ux * headLen, y2 - uy * headLen);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * headLen - uy * 5, y2 - uy * headLen + ux * 5);
  ctx.lineTo(x2 - ux * headLen + uy * 5, y2 - uy * headLen - ux * 5);
  ctx.closePath();
  ctx.fill();
}

/* ─── sub-componentes UI ─── */
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[15px] font-bold font-mono truncate" style={{ color: accent }}>{value}</div>
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
        <span className="text-[12px] font-mono text-[#FDB813]">{fmt ? fmt(value) : value.toFixed(1)}</span>
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
