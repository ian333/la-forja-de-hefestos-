/**
 * MertonScholesLab — laboratorio del premio 1997 (Merton & Scholes).
 *
 * El click: Black, Scholes y Merton encontraron la fórmula exacta para
 * ponerle precio a una opción financiera. El truco es que puedes "replicar"
 * la opción combinando el activo subyacente con deuda, así que su precio
 * deja de ser opinión y se vuelve matemática pura.
 *
 * Fórmula BLACK-SCHOLES exacta (call europea):
 *   C = S·N(d₁) − K·e^(−rT)·N(d₂)
 *   d₁ = [ln(S/K) + (r + σ²/2)·T] / (σ·√T)
 *   d₂ = d₁ − σ·√T
 *
 * donde:
 *   S   = precio actual del activo
 *   K   = precio de ejercicio (strike)
 *   σ   = volatilidad anualizada
 *   r   = tasa libre de riesgo
 *   T   = tiempo al vencimiento (años)
 *   N() = CDF de la normal estándar
 *
 * El canvas muestra:
 *   1. Curva C(S) — valor de la opción a lo largo del precio del activo
 *   2. Línea de payoff intrínseco: max(S − K, 0)
 *   3. Punto actual (S, C) destacado
 *   4. Zona de "valor tiempo" entre la curva BS y el payoff intrínseco
 *   5. Simulación Monte Carlo de N trayectorias de precio (GBM), para
 *      visualizar el riesgo que la fórmula "domestica"
 *
 * La física REAL detrás: el movimiento del activo sigue un GBM:
 *   dS = S·(μ dt + σ dW)
 * con la solución exacta:
 *   S(t) = S₀ · exp[(μ − σ²/2)t + σ·√t·Z], Z ~ N(0,1)
 */

import { useEffect, useRef, useState } from 'react';

// ─── constantes de layout ───────────────────────────────────────────────────
const W = 820;
const H = 380;

// ─── utilidades matemáticas ─────────────────────────────────────────────────

/** Aproximación racional de la CDF normal estándar (Abramowitz & Stegun 26.2.17). */
function normCDF(x: number): number {
  if (x < -7) return 0;
  if (x > 7) return 1;
  const sign = x >= 0 ? 1 : -1;
  const z = Math.abs(x);
  const t = 1 / (1 + 0.2316419 * z);
  const poly =
    t * (0.319381530 +
      t * (-0.356563782 +
        t * (1.781477937 +
          t * (-1.821255978 +
            t * 1.330274429))));
  const phi = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  return 0.5 + sign * (0.5 - phi * poly);
}

/** Valor Black-Scholes de una call europea. Devuelve null si T ≤ 0. */
function bsCall(S: number, K: number, sigma: number, r: number, T: number): number {
  if (T <= 0) return Math.max(S - K, 0);
  if (sigma <= 0) return Math.max(S - K * Math.exp(-r * T), 0);
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  return S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
}

/** Delta de la call: ∂C/∂S = N(d₁). */
function bsDelta(S: number, K: number, sigma: number, r: number, T: number): number {
  if (T <= 0) return S > K ? 1 : 0;
  if (sigma <= 0) return S > K ? 1 : 0;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  return normCDF(d1);
}

/** Simula N trayectorias GBM con pasos finos. Devuelve array de arrays de precios. */
function simulatePaths(
  S0: number,
  sigma: number,
  r: number,
  T: number,
  nPaths: number,
  nSteps: number,
): number[][] {
  const dt = T / nSteps;
  const drift = (r - 0.5 * sigma * sigma) * dt;
  const vol = sigma * Math.sqrt(dt);
  const paths: number[][] = [];
  for (let p = 0; p < nPaths; p++) {
    const path: number[] = [S0];
    let s = S0;
    for (let i = 0; i < nSteps; i++) {
      // Box-Muller para normal estándar
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1 + 1e-14)) * Math.cos(2 * Math.PI * u2);
      s = s * Math.exp(drift + vol * z);
      path.push(s);
    }
    paths.push(path);
  }
  return paths;
}

// ─── parámetros e interfaz ──────────────────────────────────────────────────

interface Params {
  S: number;      // precio actual del activo (stock price)
  K: number;      // strike
  sigma: number;  // volatilidad anualizada (0.05 – 1.0)
  r: number;      // tasa libre de riesgo (0 – 0.15)
  T: number;      // tiempo al vencimiento en años (0.05 – 2)
  showPaths: boolean;
}

const DEFAULTS: Params = {
  S: 100,
  K: 100,
  sigma: 0.20,
  r: 0.05,
  T: 0.5,
  showPaths: true,
};

const N_PATHS = 28;
const N_STEPS = 60;

// ─── mapping canvas → coordenadas ──────────────────────────────────────────

/** Rango de S que mostramos en el eje X del canvas. */
function sRange(K: number): [number, number] {
  return [K * 0.4, K * 1.8];
}

function xOfS(s: number, K: number): number {
  const [lo, hi] = sRange(K);
  const pad = 56;
  return pad + ((s - lo) / (hi - lo)) * (W - 2 * pad);
}

function sOfX(x: number, K: number): number {
  const [lo, hi] = sRange(K);
  const pad = 56;
  return lo + ((x - pad) / (W - 2 * pad)) * (hi - lo);
}

function yOfC(c: number, cMax: number): number {
  const yTop = 46;
  const yBot = H - 48;
  const t = Math.min(1, c / Math.max(cMax, 1e-6));
  return yBot - t * (yBot - yTop);
}

// ─── componente principal ───────────────────────────────────────────────────

export default function MertonScholesLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS });
  const pathsRef = useRef<number[][]>([]);
  const needRegen = useRef<boolean>(true);

  const [S, setS] = useState(DEFAULTS.S);
  const [K, setK] = useState(DEFAULTS.K);
  const [sigma, setSigma] = useState(DEFAULTS.sigma);
  const [r, setR] = useState(DEFAULTS.r);
  const [T, setT] = useState(DEFAULTS.T);
  const [showPaths, setShowPaths] = useState(DEFAULTS.showPaths);

  const [stats, setStats] = useState({
    price: 0,
    delta: 0,
    intrinsic: 0,
    timeValue: 0,
  });

  // Sincroniza estado React → ref
  useEffect(() => {
    paramsRef.current = { S, K, sigma, r, T, showPaths };
    needRegen.current = true;
  }, [S, K, sigma, r, T, showPaths]);

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

    function draw() {
      if (!ctx) return;
      const p = paramsRef.current;
      const { S: s0, K: k, sigma: sig, r: rf, T: t, showPaths: sp } = p;

      // Regenerar trayectorias cuando cambian parámetros
      if (needRegen.current) {
        pathsRef.current = simulatePaths(s0, sig, rf, t, N_PATHS, N_STEPS);
        needRegen.current = false;
      }

      // ── Fondo ──
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#05060A');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const [sLo, sHi] = sRange(k);
      // Valor máximo de la call en el rango — para normalizar eje Y
      let cMax = 0;
      for (let i = 0; i <= 120; i++) {
        const sv = sLo + (i / 120) * (sHi - sLo);
        const cv = bsCall(sv, k, sig, rf, t);
        if (cv > cMax) cMax = cv;
      }
      cMax = Math.max(cMax, k * 0.3);

      // ── Trayectorias GBM ──
      if (sp && pathsRef.current.length > 0) {
        const paths = pathsRef.current;
        for (let p2 = 0; p2 < paths.length; p2++) {
          const path = paths[p2];
          const sEnd = path[path.length - 1];
          const payoff = Math.max(sEnd - k, 0);
          const inMoney = sEnd > k;
          ctx.beginPath();
          for (let i = 0; i < path.length; i++) {
            const xp = 56 + (i / (path.length - 1)) * (W - 112);
            const yp = yOfC(path[i] - sLo, (sHi - sLo) * 1.2);
            if (i === 0) ctx.moveTo(xp, yp); else ctx.lineTo(xp, yp);
          }
          ctx.strokeStyle = inMoney
            ? `rgba(253,184,19,${payoff > 0 ? 0.25 : 0.10})`
            : 'rgba(100,116,139,0.12)';
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }
        // Marcadores finales
        for (let p2 = 0; p2 < paths.length; p2++) {
          const path = paths[p2];
          const sEnd = path[path.length - 1];
          const inMoney = sEnd > k;
          const xEnd = W - 56;
          const yEnd = yOfC(sEnd - sLo, (sHi - sLo) * 1.2);
          ctx.beginPath();
          ctx.arc(xEnd, yEnd, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = inMoney ? 'rgba(253,184,19,0.5)' : 'rgba(100,116,139,0.3)';
          ctx.fill();
        }
      }

      // ── Payoff intrínseco: max(S−K, 0) ──
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const sv = sLo + (i / 120) * (sHi - sLo);
        const cv = Math.max(sv - k, 0);
        const x = xOfS(sv, k);
        const y = yOfC(cv, cMax);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(100,116,139,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // ── Zona "valor tiempo" (fill entre curva BS y payoff intrínseco) ──
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const sv = sLo + (i / 120) * (sHi - sLo);
        const cv = bsCall(sv, k, sig, rf, t);
        const x = xOfS(sv, k);
        const y = yOfC(cv, cMax);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      // cierra la zona con el payoff intrínseco
      for (let i = 120; i >= 0; i--) {
        const sv = sLo + (i / 120) * (sHi - sLo);
        const cv = Math.max(sv - k, 0);
        const x = xOfS(sv, k);
        const y = yOfC(cv, cMax);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(253,184,19,0.07)';
      ctx.fill();

      // ── Curva Black-Scholes principal ──
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const sv = sLo + (i / 120) * (sHi - sLo);
        const cv = bsCall(sv, k, sig, rf, t);
        const x = xOfS(sv, k);
        const y = yOfC(cv, cMax);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      const gradCurve = ctx.createLinearGradient(56, 0, W - 56, 0);
      gradCurve.addColorStop(0, 'rgba(253,184,19,0.4)');
      gradCurve.addColorStop(0.5, '#FDB813');
      gradCurve.addColorStop(1, '#F59E0B');
      ctx.strokeStyle = gradCurve;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#FDB813';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ── Línea vertical del strike K ──
      const xK = xOfS(k, k);
      ctx.strokeStyle = 'rgba(148,163,184,0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(xK, 38);
      ctx.lineTo(xK, H - 30);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`K=${k}`, xK, 32);

      // ── Punto actual (S, C) ──
      const cNow = bsCall(s0, k, sig, rf, t);
      const deltaNow = bsDelta(s0, k, sig, rf, t);
      const intrinsicNow = Math.max(s0 - k, 0);
      const timeValNow = cNow - intrinsicNow;

      const xNow = xOfS(s0, k);
      const yNow = yOfC(cNow, cMax);

      // línea tangente (delta visual)
      const dxLine = 60;
      const dyLine = deltaNow * dxLine * (cMax > 0 ? (H - 94) / cMax : 0);
      ctx.strokeStyle = 'rgba(79,195,247,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xNow - dxLine, yNow + dyLine);
      ctx.lineTo(xNow + dxLine, yNow - dyLine);
      ctx.stroke();

      // halo + punto
      ctx.save();
      ctx.shadowColor = '#4FC3F7';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(xNow, yNow, 7, 0, Math.PI * 2);
      const gDot = ctx.createRadialGradient(xNow - 2, yNow - 2, 1, xNow, yNow, 7);
      gDot.addColorStop(0, '#E0F7FF');
      gDot.addColorStop(1, '#4FC3F7');
      ctx.fillStyle = gDot;
      ctx.fill();
      ctx.restore();

      // etiqueta del precio actual de la opción
      const labelX = Math.min(xNow + 10, W - 100);
      ctx.fillStyle = '#4FC3F7';
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`C = $${cNow.toFixed(2)}`, labelX, yNow - 12);
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(79,195,247,0.7)';
      ctx.fillText(`Δ = ${deltaNow.toFixed(2)}`, labelX, yNow + 2);

      // ── Etiquetas de eje X ──
      ctx.textAlign = 'center';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillStyle = '#475569';
      const nTicks = 6;
      for (let i = 0; i <= nTicks; i++) {
        const sv = sLo + (i / nTicks) * (sHi - sLo);
        const x = xOfS(sv, k);
        ctx.fillText(`$${sv.toFixed(0)}`, x, H - 8);
      }

      // ── Leyenda ──
      const legend: Array<[string, string]> = [
        ['— — —', 'payoff intrínseco max(S−K,0)'],
        ['───', 'precio Black-Scholes C(S)'],
        ['···', `valor tiempo = $${timeValNow.toFixed(2)}`],
      ];
      ctx.textAlign = 'left';
      ctx.font = '10px ui-monospace, monospace';
      legend.forEach(([sym, desc], i) => {
        const lx = 60;
        const ly = H - 46 + i * 14;
        ctx.fillStyle = i === 0 ? '#475569' : i === 1 ? '#FDB813' : 'rgba(253,184,19,0.5)';
        ctx.fillText(sym, lx, ly);
        ctx.fillStyle = '#64748B';
        ctx.fillText(desc, lx + 42, ly);
      });

      // ── Actualizar stats ──
      if (frame % 8 === 0) {
        setStats({
          price: cNow,
          delta: deltaNow,
          intrinsic: intrinsicNow,
          timeValue: timeValNow,
        });
      }
    }

    function loop() {
      draw();
      frame++;
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    // Permitir arrastrar el precio actual S sobre el canvas
    const onDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const xClick = (e.clientX - rect.left) * (W / rect.width);
      const newS = sOfX(xClick, paramsRef.current.K);
      if (newS > 0) setS(Math.round(newS));
    };
    const onMove = (e: PointerEvent) => {
      if (e.buttons !== 1) return;
      const rect = canvas.getBoundingClientRect();
      const xClick = (e.clientX - rect.left) * (W / rect.width);
      const newS = sOfX(xClick, paramsRef.current.K);
      if (newS > 0) setS(Math.round(Math.max(1, newS)));
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
    };
  }, []);

  // Insight dinámico
  const itm = S > K;
  const otm = S < K;
  const deepITM = S > K * 1.3;
  const deepOTM = S < K * 0.75;
  const highVol = sigma > 0.5;

  let insight: string;
  if (deepOTM) {
    insight = `El activo está muy por debajo del strike. La opción casi no vale ($${stats.price.toFixed(2)}): la probabilidad de que el precio llegue a $${K} antes del vencimiento es pequeña. Aquí casi todo el valor es "esperanza pura" — el valor tiempo.`;
  } else if (deepITM) {
    insight = `El activo está muy por encima del strike. La opción casi vale su payoff intrínseco ($${stats.intrinsic.toFixed(2)}), y delta ≈ ${stats.delta.toFixed(2)}: por cada $1 que sube el activo, la opción sube ~$${stats.delta.toFixed(2)}. Replicar esto requiere ${(stats.delta * 100).toFixed(0)} acciones por cada 100 opciones.`;
  } else if (highVol) {
    insight = `Con volatilidad del ${(sigma * 100).toFixed(0)}%, el valor tiempo explota ($${stats.timeValue.toFixed(2)} de valor tiempo). Más incertidumbre = más vale el seguro. Por eso asegurar algo volátil sale un ojo de la cara.`;
  } else if (itm) {
    insight = `La opción está "en el dinero": precio actual $${S} > strike $${K}. Payoff intrínseco = $${stats.intrinsic.toFixed(2)}, más $${stats.timeValue.toFixed(2)} de valor tiempo. Delta = ${stats.delta.toFixed(2)}: la opción se mueve con el mercado.`;
  } else if (otm) {
    insight = `La opción está "fuera del dinero": precio actual $${S} < strike $${K}. No tiene valor intrínseco — es puro valor tiempo ($${stats.price.toFixed(2)}). Si el activo no sube a $${K} antes de ${(T * 12).toFixed(0)} meses, la opción vence sin valor.`;
  } else {
    insight = `Arrastra sobre el canvas para mover el precio del activo y ver cómo cambia el valor de la opción en tiempo real. Fíjate en el delta (la pendiente de la curva en ese punto): es cuántas acciones necesitas para replicar la opción sin riesgo.`;
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* ── Canvas + controles ── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block touch-none cursor-crosshair"
              style={{ width: W, height: H }}
            />
          </div>

          {/* botones */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setS(DEFAULTS.S); setK(DEFAULTS.K); setSigma(DEFAULTS.sigma); setR(DEFAULTS.r); setT(DEFAULTS.T); }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#FDB813]/40 bg-[#FDB813]/10 text-[#FDB813] hover:bg-[#FDB813]/20 transition"
            >
              ↺ reiniciar
            </button>
            <button
              onClick={() => setShowPaths(v => !v)}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                showPaths
                  ? 'border-[#4FC3F7]/50 bg-[#4FC3F7]/10 text-[#4FC3F7]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              {showPaths ? '👁 trayectorias: ON' : '○ trayectorias'}
            </button>
            <button
              onClick={() => { needRegen.current = true; }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1] transition"
            >
              ⟳ nuevas trayectorias
            </button>
          </div>

          {/* stats */}
          <div className="grid grid-cols-4 gap-3">
            <Stat label="precio opción C" value={`$${stats.price.toFixed(2)}`} accent="#FDB813" />
            <Stat label="delta Δ" value={stats.delta.toFixed(3)} accent="#4FC3F7" />
            <Stat label="intrínseco" value={`$${stats.intrinsic.toFixed(2)}`} accent="#34D399" />
            <Stat label="valor tiempo" value={`$${stats.timeValue.toFixed(2)}`} accent="#A78BFA" />
          </div>

          {/* insight dinámico */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#FDB813] font-mono mb-2">✦ ¿Qué estás viendo?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── Panel de controles ── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ Parámetros Black-Scholes</div>

          <Slider
            label="Precio del activo S"
            value={S}
            min={40}
            max={200}
            step={1}
            onChange={setS}
            fmt={v => `$${v}`}
            hint="El precio actual del activo subyacente. Arrástralo también directo en el canvas."
          />
          <Slider
            label="Precio de ejercicio K (strike)"
            value={K}
            min={40}
            max={200}
            step={1}
            onChange={setK}
            fmt={v => `$${v}`}
            hint="A qué precio tienes derecho a comprar. Si S > K, la opción vale su diferencia."
          />
          <Slider
            label="Volatilidad σ"
            value={sigma}
            min={0.05}
            max={1.0}
            step={0.01}
            onChange={setSigma}
            fmt={v => `${(v * 100).toFixed(0)}%`}
            hint="Qué tan loco se mueve el activo. Más volatilidad = prima más cara. Incertidumbre cuesta."
          />
          <Slider
            label="Tiempo al vencimiento T"
            value={T}
            min={0.05}
            max={2.0}
            step={0.05}
            onChange={setT}
            fmt={v => v < 0.25 ? `${(v * 12).toFixed(0)} sem` : `${v.toFixed(1)} años`}
            hint="Más tiempo = más chance de que el activo llegue al strike = opción más cara."
          />
          <Slider
            label="Tasa libre de riesgo r"
            value={r}
            min={0.0}
            max={0.20}
            step={0.005}
            onChange={setR}
            fmt={v => `${(v * 100).toFixed(1)}%`}
            hint="Tasa de Cetes / bono gobierno. Afecta el valor presente del strike."
          />

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed space-y-1">
            <div>C = S·N(d₁) − K·e^(−rT)·N(d₂)</div>
            <div>d₁ = [ln(S/K)+(r+σ²/2)T] / (σ√T)</div>
            <div>d₂ = d₁ − σ√T</div>
            <div className="pt-1 text-[#334155]">Black & Scholes (1973) · Merton (1973)</div>
            <div className="text-[#334155]">comité Nobel 1997</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── componentes auxiliares ─────────────────────────────────────────────────

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[18px] font-bold font-mono" style={{ color: accent }}>{value}</div>
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
        <span className="text-[12px] font-mono text-[#FDB813]">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#FDB813]"
      />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}
