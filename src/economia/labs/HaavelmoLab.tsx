/**
 * HaavelmoLab — laboratorio del premio 1989 (Trygve Haavelmo).
 *
 * El click: los economistas ajustaban curvas a datos y llamaban a eso "ley económica".
 * Haavelmo les dijo: es trampa. Si la oferta Y la demanda se mueven al mismo tiempo,
 * el dato que observas es la INTERSECCIÓN, no ninguna de las dos curvas.
 * Ajustar OLS sobre esos puntos te da una pendiente completamente inventada.
 *
 * Modelo REAL (sistema simultáneo Haavelmo 1944):
 *   Demanda:  Q = αD − βD·P + uD   (αD, βD > 0; uD ~ N(0, σD))
 *   Oferta:   Q = αS + βS·P + uS   (βS > 0; uS ~ N(0, σS))
 *
 *   Precio de equilibrio (resolviendo el sistema):
 *     P* = (αD − αS + uD − uS) / (βD + βS)
 *     Q* = (αD·βS + αS·βD + uS·βD + uD·βS) / (βD + βS)
 *
 *   Cada punto observado (P*, Q*) es la intersección de un par de curvas
 *   desplazadas por shocks aleatorios. OLS sobre esos puntos NO recupera
 *   ni la pendiente de demanda ni la de oferta.
 *
 * La "nube de puntos observados" tiene su propia pendiente OLS, que depende
 * de la VARIANZA RELATIVA de los shocks: si σD >> σS, la demanda se mueve
 * mucho y los puntos trazan la curva de oferta. Si σS >> σD, los puntos
 * trazan la demanda. En el caso general, la pendiente OLS es una mezcla.
 *
 * Eso es el sesgo de simultaneidad que Haavelmo formalizó.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Constantes del canvas ────────────────────────────────────────────────────
const W = 820;
const H = 380;
const PAD = { left: 56, right: 24, top: 32, bottom: 44 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

// Rango del espacio (P, Q)
const P_MIN = 0;
const P_MAX = 10;
const Q_MIN = 0;
const Q_MAX = 10;

const N_POINTS = 80;

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Params {
  alphaD: number;  // intercepto demanda (Q cuando P=0)
  betaD: number;   // pendiente demanda (baja, valor positivo)
  alphaS: number;  // intercepto oferta (Q cuando P=0, puede ser negativo)
  betaS: number;   // pendiente oferta (sube)
  sigmaD: number;  // desv. estándar shocks demanda
  sigmaS: number;  // desv. estándar shocks oferta
}

interface Point { p: number; q: number; }

interface OLSResult {
  slope: number;
  intercept: number;
  r2: number;
}

// ─── Box-Muller para normal(0,1) ─────────────────────────────────────────────
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ─── Generar N puntos de equilibrio desde el modelo estructural ───────────────
function generatePoints(params: Params, n: number): Point[] {
  const { alphaD, betaD, alphaS, betaS, sigmaD, sigmaS } = params;
  const points: Point[] = [];
  for (let i = 0; i < n; i++) {
    const uD = randn() * sigmaD;
    const uS = randn() * sigmaS;
    const denom = betaD + betaS;
    if (denom < 1e-6) continue;
    const pStar = (alphaD - alphaS + uD - uS) / denom;
    const qStar = (alphaD * betaS + alphaS * betaD + uS * betaD + uD * betaS) / denom;
    // Solo puntos dentro del rango visible
    if (pStar >= P_MIN && pStar <= P_MAX && qStar >= Q_MIN && qStar <= Q_MAX) {
      points.push({ p: pStar, q: qStar });
    }
  }
  return points;
}

// ─── OLS sobre la nube (Q = a + b·P) ─────────────────────────────────────────
function computeOLS(points: Point[]): OLSResult {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
  let sumP = 0, sumQ = 0, sumPP = 0, sumPQ = 0;
  for (const pt of points) { sumP += pt.p; sumQ += pt.q; sumPP += pt.p * pt.p; sumPQ += pt.p * pt.q; }
  const meanP = sumP / n, meanQ = sumQ / n;
  const denom = sumPP - n * meanP * meanP;
  if (Math.abs(denom) < 1e-10) return { slope: 0, intercept: meanQ, r2: 0 };
  const slope = (sumPQ - n * meanP * meanQ) / denom;
  const intercept = meanQ - slope * meanP;
  // R²
  let ssTot = 0, ssRes = 0;
  for (const pt of points) {
    ssTot += (pt.q - meanQ) ** 2;
    ssRes += (pt.q - (intercept + slope * pt.p)) ** 2;
  }
  const r2 = ssTot < 1e-10 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  return { slope, intercept, r2 };
}

// ─── Coordenadas canvas ───────────────────────────────────────────────────────
function cx(p: number): number { return PAD.left + ((p - P_MIN) / (P_MAX - P_MIN)) * PLOT_W; }
function cy(q: number): number { return PAD.top + ((Q_MAX - q) / (Q_MAX - Q_MIN)) * PLOT_H; }

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULTS: Params = {
  alphaD: 9,
  betaD: 1.0,
  alphaS: 1,
  betaS: 0.8,
  sigmaD: 1.2,
  sigmaS: 0.4,
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function HaavelmoLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS });
  const pointsRef = useRef<Point[]>([]);
  const olsRef = useRef<OLSResult>({ slope: 0, intercept: 0, r2: 0 });
  const showTruthRef = useRef<boolean>(false);
  const rafRef = useRef<number>(0);

  const [alphaD, setAlphaD] = useState(DEFAULTS.alphaD);
  const [betaD, setBetaD] = useState(DEFAULTS.betaD);
  const [alphaS, setAlphaS] = useState(DEFAULTS.alphaS);
  const [betaS, setBetaS] = useState(DEFAULTS.betaS);
  const [sigmaD, setSigmaD] = useState(DEFAULTS.sigmaD);
  const [sigmaS, setSigmaS] = useState(DEFAULTS.sigmaS);
  const [showTruth, setShowTruth] = useState(false);
  const [stats, setStats] = useState({ olsSlope: 0, trueD: 0, trueS: 0, r2: 0, nPts: 0 });
  const [seed, setSeed] = useState(0); // fuerza regeneración

  // Sincroniza refs con estado
  useEffect(() => {
    paramsRef.current = { alphaD, betaD, alphaS, betaS, sigmaD, sigmaS };
  }, [alphaD, betaD, alphaS, betaS, sigmaD, sigmaS]);

  useEffect(() => { showTruthRef.current = showTruth; }, [showTruth]);

  // Regenera puntos cuando cambian parámetros o seed
  useEffect(() => {
    const p = paramsRef.current;
    const pts = generatePoints(p, N_POINTS * 4); // sobregenera para llenar cuadro
    pointsRef.current = pts.slice(0, N_POINTS);
    const ols = computeOLS(pointsRef.current);
    olsRef.current = ols;
    setStats({
      olsSlope: ols.slope,
      trueD: -p.betaD,
      trueS: p.betaS,
      r2: ols.r2,
      nPts: pointsRef.current.length,
    });
  }, [alphaD, betaD, alphaS, betaS, sigmaD, sigmaS, seed]);

  // Loop de animación (dibuja en cada frame, sin física — solo dibujo estático reactivo)
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

    function draw() {
      if (!ctx) return;
      const p = paramsRef.current;
      const pts = pointsRef.current;
      const ols = olsRef.current;
      const showT = showTruthRef.current;

      // Fondo
      ctx.fillStyle = '#0B0F17';
      ctx.fillRect(0, 0, W, H);

      // Ejes
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, PAD.top);
      ctx.lineTo(PAD.left, PAD.top + PLOT_H);
      ctx.lineTo(PAD.left + PLOT_W, PAD.top + PLOT_H);
      ctx.stroke();

      // Etiquetas de ejes
      ctx.fillStyle = '#475569';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      for (let p2 = 0; p2 <= 10; p2 += 2) {
        const x = cx(p2);
        ctx.fillText(String(p2), x, PAD.top + PLOT_H + 14);
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, PAD.top);
        ctx.lineTo(x, PAD.top + PLOT_H);
        ctx.stroke();
      }
      ctx.textAlign = 'right';
      for (let q = 0; q <= 10; q += 2) {
        const y = cy(q);
        ctx.fillText(String(q), PAD.left - 6, y + 4);
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(PAD.left + PLOT_W, y);
        ctx.stroke();
      }
      ctx.fillStyle = '#475569';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Precio (P)', PAD.left + PLOT_W / 2, H - 4);
      ctx.save();
      ctx.translate(14, PAD.top + PLOT_H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Cantidad (Q)', 0, 0);
      ctx.restore();

      // ─── Verdaderas curvas estructurales (si se muestran) ─────────────────
      if (showT) {
        // Demanda: Q = alphaD − betaD·P
        ctx.save();
        ctx.strokeStyle = '#60A5FA';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        const qD0 = p.alphaD - p.betaD * P_MIN;
        const qD1 = p.alphaD - p.betaD * P_MAX;
        ctx.moveTo(cx(P_MIN), cy(qD0));
        ctx.lineTo(cx(P_MAX), cy(qD1));
        ctx.stroke();
        ctx.setLineDash([]);
        // Etiqueta
        const pLabelD = P_MAX * 0.72;
        const qLabelD = p.alphaD - p.betaD * pLabelD;
        if (qLabelD >= Q_MIN && qLabelD <= Q_MAX) {
          ctx.fillStyle = '#60A5FA';
          ctx.font = 'bold 11px ui-monospace, monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`demanda real (slope=${(-p.betaD).toFixed(2)})`, cx(pLabelD) + 6, cy(qLabelD) - 6);
        }
        ctx.restore();

        // Oferta: Q = alphaS + betaS·P
        ctx.save();
        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        const qS0 = p.alphaS + p.betaS * P_MIN;
        const qS1 = p.alphaS + p.betaS * P_MAX;
        ctx.moveTo(cx(P_MIN), cy(qS0));
        ctx.lineTo(cx(P_MAX), cy(qS1));
        ctx.stroke();
        ctx.setLineDash([]);
        const pLabelS = P_MAX * 0.25;
        const qLabelS = p.alphaS + p.betaS * pLabelS;
        if (qLabelS >= Q_MIN && qLabelS <= Q_MAX) {
          ctx.fillStyle = '#34D399';
          ctx.font = 'bold 11px ui-monospace, monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`oferta real (slope=+${p.betaS.toFixed(2)})`, cx(pLabelS) + 6, cy(qLabelS) - 6);
        }
        ctx.restore();

        // Equilibrio sin shocks
        const pEq = (p.alphaD - p.alphaS) / (p.betaD + p.betaS);
        const qEq = p.alphaS + p.betaS * pEq;
        if (pEq >= P_MIN && pEq <= P_MAX && qEq >= Q_MIN && qEq <= Q_MAX) {
          ctx.save();
          ctx.shadowColor = '#FDB813';
          ctx.shadowBlur = 12;
          ctx.fillStyle = '#FDB813';
          ctx.beginPath();
          ctx.arc(cx(pEq), cy(qEq), 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = '#FDB813';
          ctx.font = 'bold 11px ui-monospace, monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`equilibrio (${pEq.toFixed(1)}, ${qEq.toFixed(1)})`, cx(pEq) + 10, cy(qEq) - 8);
        }
      }

      // ─── Nube de puntos observados ────────────────────────────────────────
      for (const pt of pts) {
        ctx.save();
        ctx.fillStyle = 'rgba(251,146,60,0.65)';
        ctx.shadowColor = '#FB923C';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(cx(pt.p), cy(pt.q), 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ─── Línea OLS ────────────────────────────────────────────────────────
      if (pts.length >= 2) {
        const qOLS0 = ols.intercept + ols.slope * P_MIN;
        const qOLS1 = ols.intercept + ols.slope * P_MAX;
        ctx.save();
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(cx(P_MIN), cy(qOLS0));
        ctx.lineTo(cx(P_MAX), cy(qOLS1));
        ctx.stroke();
        ctx.restore();

        // Etiqueta OLS
        const pMid = (P_MIN + P_MAX) / 2;
        const qMid = ols.intercept + ols.slope * pMid;
        if (qMid >= Q_MIN && qMid <= Q_MAX) {
          ctx.fillStyle = '#EF4444';
          ctx.font = 'bold 11px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`OLS "naïve" (slope=${ols.slope.toFixed(2)}) R²=${ols.r2.toFixed(2)}`, cx(pMid), cy(qMid) - 10);
        }
      }

      // ─── Leyenda esquina superior derecha ─────────────────────────────────
      ctx.fillStyle = '#FB923C';
      ctx.font = '10px ui-sans-serif, system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('● datos observados (intersecciones)', PAD.left + PLOT_W - 210, PAD.top + 16);
      ctx.fillStyle = '#EF4444';
      ctx.fillText('— OLS naïve (línea que "ajustas")', PAD.left + PLOT_W - 210, PAD.top + 30);
      if (showT) {
        ctx.fillStyle = '#60A5FA';
        ctx.fillText('- - demanda real (estructural)', PAD.left + PLOT_W - 210, PAD.top + 44);
        ctx.fillStyle = '#34D399';
        ctx.fillText('- - oferta real (estructural)', PAD.left + PLOT_W - 210, PAD.top + 58);
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const regenerate = useCallback(() => setSeed(s => s + 1), []);

  // Insight dinámico
  let insight: string;
  if (!showTruth) {
    insight = 'Activa "revelar curvas reales" para ver qué hay detrás de la nube. Verás que la línea roja (OLS) no coincide con ninguna de las dos curvas verdaderas.';
  } else if (sigmaD > sigmaS * 2) {
    insight = `σD (${sigmaD.toFixed(1)}) >> σS (${sigmaS.toFixed(1)}): la demanda se mueve mucho, la oferta poco. Los puntos trazan casi la curva de OFERTA. OLS se acerca a la oferta (slope≈+${stats.trueS.toFixed(2)}).`;
  } else if (sigmaS > sigmaD * 2) {
    insight = `σS (${sigmaS.toFixed(1)}) >> σD (${sigmaD.toFixed(1)}): la oferta se mueve mucho, la demanda poco. Los puntos trazan casi la curva de DEMANDA. OLS se acerca a la demanda (slope≈${stats.trueD.toFixed(2)}).`;
  } else {
    insight = `Shocks equilibrados. El OLS (${stats.olsSlope.toFixed(2)}) NO es ni la demanda (${stats.trueD.toFixed(2)}) ni la oferta (+${stats.trueS.toFixed(2)}). Es una mezcla — el sesgo de simultaneidad que Haavelmo formalizó.`;
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* ─── Canvas + controles de acción ─────────────────────────────────── */}
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
              onClick={regenerate}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#FB923C]/40 bg-[#FB923C]/10 text-[#FB923C] hover:bg-[#FB923C]/20 transition"
            >
              ↺ nueva muestra
            </button>
            <button
              onClick={() => setShowTruth(v => !v)}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                showTruth
                  ? 'border-[#60A5FA]/50 bg-[#60A5FA]/10 text-[#60A5FA]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              {showTruth ? '◉ revelar: ON' : '○ revelar curvas reales'}
            </button>
            <button
              onClick={() => {
                setAlphaD(DEFAULTS.alphaD); setBetaD(DEFAULTS.betaD);
                setAlphaS(DEFAULTS.alphaS); setBetaS(DEFAULTS.betaS);
                setSigmaD(DEFAULTS.sigmaD); setSigmaS(DEFAULTS.sigmaS);
                setSeed(s => s + 1);
              }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1] transition"
            >
              reset
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            <StatBox label="OLS pendiente" value={stats.olsSlope.toFixed(2)} accent="#EF4444"
              hint="lo que OLS 've'" />
            <StatBox label="demanda real" value={stats.trueD.toFixed(2)} accent="#60A5FA"
              hint="pendiente estructural" />
            <StatBox label="oferta real" value={`+${stats.trueS.toFixed(2)}`} accent="#34D399"
              hint="pendiente estructural" />
            <StatBox label="R² (OLS)" value={stats.r2.toFixed(2)} accent="#FDB813"
              hint="↑R² no significa ↑verdad" />
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#60A5FA] font-mono mb-2">
              ✦ ¿qué está pasando?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ─── Panel de parámetros ───────────────────────────────────────────── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ modelo estructural
          </div>

          <div className="text-[10px] font-mono text-[#475569] border border-[#1E293B] rounded p-2 leading-relaxed">
            <span className="text-[#60A5FA]">Q = αD − βD·P + uD</span>{'  '}demanda<br />
            <span className="text-[#34D399]">Q = αS + βS·P + uS</span>{'  '}oferta<br />
            uD ~ N(0, σD²){'  '}uS ~ N(0, σS²)
          </div>

          <div className="text-[10px] text-[#64748B] font-mono uppercase tracking-widest">
            Curva de demanda
          </div>
          <SliderRow label="intercepto αD" value={alphaD} min={5} max={12} step={0.1}
            onChange={setAlphaD} fmt={v => v.toFixed(1)}
            hint="Q cuando P=0 (cuánto se quiere gratis)" accent="#60A5FA" />
          <SliderRow label="pendiente βD" value={betaD} min={0.3} max={2.5} step={0.05}
            onChange={setBetaD} fmt={v => `−${v.toFixed(2)}`}
            hint="qué tan sensible a precios" accent="#60A5FA" />
          <SliderRow label="ruido σD" value={sigmaD} min={0.1} max={3.0} step={0.1}
            onChange={setSigmaD} fmt={v => v.toFixed(1)}
            hint="cuánto se mueve la demanda" accent="#60A5FA" />

          <div className="text-[10px] text-[#64748B] font-mono uppercase tracking-widest pt-1 border-t border-[#1E293B]">
            Curva de oferta
          </div>
          <SliderRow label="intercepto αS" value={alphaS} min={-3} max={4} step={0.1}
            onChange={setAlphaS} fmt={v => v.toFixed(1)}
            hint="base de la oferta a precio 0" accent="#34D399" />
          <SliderRow label="pendiente βS" value={betaS} min={0.3} max={2.5} step={0.05}
            onChange={setBetaS} fmt={v => `+${v.toFixed(2)}`}
            hint="sensibilidad de oferta al precio" accent="#34D399" />
          <SliderRow label="ruido σS" value={sigmaS} min={0.1} max={3.0} step={0.1}
            onChange={setSigmaS} fmt={v => v.toFixed(1)}
            hint="cuánto se mueve la oferta" accent="#34D399" />

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            Haavelmo (1944): cada punto observado es una<br />
            intersección aleatoria. OLS ajusta la NUBE,<br />
            no las curvas. Sesgo de simultaneidad.
          </div>
        </div>
      </div>

      {/* ─── Explicación para el taquero ──────────────────────────────────── */}
      <div className="mt-5 bg-[#05060A] border border-[#1E293B] rounded-lg p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
        <TaqueroCard
          emoji="🌮"
          title="Para el taquero"
          text="Ves que cada vez que subes el precio de tu taco venden más (raro, ¿no?). No es ley del mercado — es que solo subiste precios en las semanas de fiesta cuando de todas formas había más hambre. Estás midiendo la intersección de dos curvas que se mueven juntas, no la misma curva."
        />
        <TaqueroCard
          emoji="📉"
          title="El sesgo de OLS"
          text="Ajustar una recta a datos donde oferta y demanda se mueven al mismo tiempo te da una pendiente que NO es ni la demanda ni la oferta real. Es una mezcla. Haavelmo lo formalizó: necesitas el modelo ESTRUCTURAL (dos ecuaciones, dos incógnitas) para recuperar los parámetros verdaderos."
        />
        <TaqueroCard
          emoji="🎲"
          title="El dado de Haavelmo"
          text="Prueba: sube σD (mueve mucho la demanda, la oferta quieta). Los puntos trazan la oferta. Baja σD y sube σS: los puntos trazan la demanda. Con los dos ruidos iguales, el OLS no traza nada real. Ese es el golpe central de Haavelmo al 'ajuste de curvas'."
        />
      </div>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function StatBox({ label, value, accent, hint }: { label: string; value: string; accent: string; hint?: string }) {
  return (
    <div className="bg-[#05060A] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[9px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-0.5">{label}</div>
      <div className="text-[18px] font-bold font-mono" style={{ color: accent }}>{value}</div>
      {hint && <div className="text-[9px] text-[#475569] font-mono mt-0.5">{hint}</div>}
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange, fmt, hint, accent }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string; hint?: string; accent?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[11px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[11px] font-mono" style={{ color: accent ?? '#FDB813' }}>
          {fmt ? fmt(value) : value.toFixed(2)}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#4FC3F7]" />
      {hint && <div className="text-[9px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}

function TaqueroCard({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <div className="text-[11px] uppercase tracking-[0.15em] text-[#94A3B8] font-mono">{title}</div>
      </div>
      <p className="text-[12px] text-[#94A3B8] leading-relaxed">{text}</p>
    </div>
  );
}
