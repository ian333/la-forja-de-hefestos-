/**
 * TobinLab — laboratorio del premio Nobel 1981 (James Tobin).
 *
 * Tobin unificó DOS ideas que parecen de mundos distintos:
 *
 * 1. Q DE TOBIN (1969):
 *    Q = ValorMercado / CostoReposicion
 *    Si Q > 1 → construir activos reales vale la pena (el mercado paga más de lo que cuesta).
 *    Si Q < 1 → mejor comprar en bolsa que construir desde cero.
 *    Dinámica de inversión:  I(t) = I_max · max(0, Q-1)   (simplificada)
 *
 * 2. SEPARACIÓN DE FONDOS / Capital Market Line (1958):
 *    Con un activo libre de riesgo (tasa r_f) y un portafolio de mercado (E[Rm], σm),
 *    la frontera eficiente se vuelve una LÍNEA RECTA:
 *      CML:  E[Rp] = r_f + [(E[Rm] - r_f) / σm] · σp
 *    El "precio del riesgo" (Sharpe del mercado) = (E[Rm] - r_f) / σm.
 *    Cualquier punto sobre la CML se consigue mezclando activo libre y portafolio de mercado.
 *
 * El lab corre DOS paneles en el mismo canvas:
 *   - Panel izquierdo: plano riesgo-retorno con la CML, la frontera eficiente y el portafolio.
 *   - Panel derecho: termómetro de la Q de Tobin y barra de inversión.
 *
 * Interacciones:
 *   - Arrastra el punto del portafolio sobre la CML (slider α ∈ [0,2]).
 *   - Sliders: r_f, prima de riesgo del mercado (E[Rm]-r_f), σm, activos totales, precio mercado.
 */

import { useEffect, useRef, useState } from 'react';

// ─── Dimensiones ───────────────────────────────────────────────────────────
const W = 820;
const H = 380;
const LEFT_W = 480;   // ancho del panel CML
const RIGHT_W = W - LEFT_W;
const PAD = { top: 40, bot: 50, left: 48, right: 16 };
// área de graficación panel izquierdo
const GX0 = PAD.left;
const GX1 = LEFT_W - PAD.right - 8;
const GY0 = PAD.top;
const GY1 = H - PAD.bot;
const GW = GX1 - GX0;
const GH = GY1 - GY0;

const SIG_MAX = 0.40;   // σ máximo graficado
const RET_MAX = 0.35;   // retorno máximo graficado (35 %)

// ─── Parámetros por defecto ─────────────────────────────────────────────────
const DEF_RF   = 0.06;   // tasa libre de riesgo (6%)
const DEF_PREM = 0.10;   // prima de riesgo (E[Rm] - rf)  (10%)
const DEF_SIG  = 0.18;   // volatilidad del portafolio de mercado (18%)
const DEF_ALPHA = 0.8;   // fracción invertida en portafolio de mercado (aversión al riesgo)
const DEF_ACTIVOS = 100; // millones de pesos: costo de reposición
const DEF_Q_MKT  = 1.25; // valor de mercado / costo reposición inicial

// ─── Funciones del modelo ───────────────────────────────────────────────────
/** Retorno esperado sobre la CML dado α (fracción en mercado, puede > 1 = apalancado) */
function cmlReturn(rf: number, prem: number, alpha: number): number {
  return rf + alpha * prem;
}
/** Desviación estándar del portafolio sobre la CML */
function cmlSigma(sigM: number, alpha: number): number {
  return Math.abs(alpha) * sigM;
}
/** Precio del riesgo (Sharpe del mercado) */
function sharpeM(prem: number, sigM: number): number {
  return prem / sigM;
}
/** Inversión a partir de Q (función lineal convexa, saturada) */
function investFromQ(q: number, activos: number): number {
  if (q <= 1) return 0;
  // Tobin: I ~ ajuste_velocidad * (Q-1) * K ; usamos velocidad = 0.25
  return Math.min(activos * 0.5, 0.25 * activos * (q - 1));
}

// ─── Conversión coordenadas gráfica ↔ pantalla ─────────────────────────────
function toCanvasX(sigma: number): number {
  return GX0 + (sigma / SIG_MAX) * GW;
}
function toCanvasY(ret: number): number {
  return GY1 - (ret / RET_MAX) * GH;
}

// ─── Frontera eficiente (curva paramétrica, portafolios de n activos riesgosos)
// Usamos una aproximación analítica sencilla que da la forma de parábola
// μ(σ) = a·σ² + b para la frontera mínima de varianza (sin libre de riesgo).
// Parámetros ajustados al mercado elegido.
function frontierMu(sigma: number, sigM: number, prem: number, rf: number): number {
  // Frontera: μ_min al sigma_min = sigM/√2; μ_min = rf + prem/2
  const sigMin = sigM * 0.55;
  const muMin  = rf + prem * 0.35;
  const k      = prem / (sigM * sigM - sigMin * sigMin) * 1.2;
  return muMin + k * (sigma * sigma - sigMin * sigMin);
}

// ─── Interfaz de estado React ───────────────────────────────────────────────
interface SimState {
  rf: number;       // tasa libre de riesgo
  prem: number;     // prima de riesgo
  sigM: number;     // σ mercado
  alpha: number;    // fracción en mercado [0..2]
  activos: number;  // costo de reposición (millones MXN)
  qMkt: number;     // Q de Tobin actual
}

const DEFAULTS: SimState = {
  rf: DEF_RF, prem: DEF_PREM, sigM: DEF_SIG,
  alpha: DEF_ALPHA, activos: DEF_ACTIVOS, qMkt: DEF_Q_MKT,
};

// ─── Componente principal ───────────────────────────────────────────────────
export default function TobinLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef  = useRef<SimState>({ ...DEFAULTS });

  const [rf,     setRf]     = useState(DEFAULTS.rf);
  const [prem,   setPrem]   = useState(DEFAULTS.prem);
  const [sigM,   setSigM]   = useState(DEFAULTS.sigM);
  const [alpha,  setAlpha]  = useState(DEFAULTS.alpha);
  const [activos,setActivos]= useState(DEFAULTS.activos);
  const [qMkt,   setQMkt]   = useState(DEFAULTS.qMkt);

  // Stats derivados para los badges
  const retP   = cmlReturn(rf, prem, alpha);
  const sigP   = cmlSigma(sigM, alpha);
  const sharpe = sharpeM(prem, sigM);
  const inv    = investFromQ(qMkt, activos);

  // Sincronizar stateRef cuando cambia estado React
  useEffect(() => {
    stateRef.current = { rf, prem, sigM, alpha, activos, qMkt };
  }, [rf, prem, sigM, alpha, activos, qMkt]);

  // ─── Loop de animación ───────────────────────────────────────────────────
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

    function draw() {
      if (!ctx) return;
      const s = stateRef.current;
      const { rf: r, prem: pr, sigM: sm, alpha: al, activos: act, qMkt: q } = s;
      const retPt  = cmlReturn(r, pr, al);
      const sigPt  = cmlSigma(sm, al);
      const invAmt = investFromQ(q, act);

      // ── Fondo ────────────────────────────────────────────────────────────
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Divisor entre paneles
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(LEFT_W, 12);
      ctx.lineTo(LEFT_W, H - 12);
      ctx.stroke();

      // ────────────────────────────────────────────────────────────────────
      // PANEL IZQUIERDO: plano σ-E[R] con CML y frontera eficiente
      // ────────────────────────────────────────────────────────────────────

      // Rejilla ligera
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        const x = toCanvasX(SIG_MAX * i / 4);
        ctx.beginPath(); ctx.moveTo(x, GY0); ctx.lineTo(x, GY1); ctx.stroke();
        const y = toCanvasY(RET_MAX * i / 4);
        ctx.beginPath(); ctx.moveTo(GX0, y); ctx.lineTo(GX1 - 4, y); ctx.stroke();
      }

      // Ejes
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      // eje X
      ctx.beginPath(); ctx.moveTo(GX0, GY1); ctx.lineTo(GX1, GY1); ctx.stroke();
      // eje Y
      ctx.beginPath(); ctx.moveTo(GX0, GY0); ctx.lineTo(GX0, GY1); ctx.stroke();

      // Etiquetas ejes
      ctx.fillStyle = '#475569';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('riesgo (σ)', GX0 + GW / 2, GY1 + 18);
      ctx.save();
      ctx.translate(12, GY0 + GH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('retorno esperado', 0, 0);
      ctx.restore();

      // Tick labels σ
      ctx.textAlign = 'center';
      ctx.fillStyle = '#475569';
      for (let i = 1; i <= 4; i++) {
        const v = SIG_MAX * i / 4;
        ctx.fillText(`${(v * 100).toFixed(0)}%`, toCanvasX(v), GY1 + 10);
      }
      // Tick labels E[R]
      ctx.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        const v = RET_MAX * i / 4;
        ctx.fillText(`${(v * 100).toFixed(0)}%`, GX0 - 4, toCanvasY(v) + 4);
      }

      // ── Frontera eficiente (zona riesgosa, sin libre de riesgo) ──────────
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const sig = (i / 80) * SIG_MAX;
        const mu  = frontierMu(sig, sm, pr, r);
        if (mu < 0 || mu > RET_MAX) continue;
        const px = toCanvasX(sig);
        const py = toCanvasY(mu);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = '#1D4ED8';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label frontera
      const fLabelSig = sm * 0.9;
      const fLabelMu  = frontierMu(fLabelSig, sm, pr, r);
      if (fLabelMu > 0 && fLabelMu < RET_MAX) {
        ctx.fillStyle = '#3B82F6';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('frontera eficiente', toCanvasX(fLabelSig) + 4, toCanvasY(fLabelMu) - 4);
      }

      // ── CML (Capital Market Line) ─────────────────────────────────────────
      // CML: E[Rp] = rf + [(prem)/sigM] * sigP, desde (0, rf) hasta extrapolado
      const cmlSigEnd  = SIG_MAX;
      const cmlRetEnd  = r + (pr / sm) * cmlSigEnd;
      ctx.beginPath();
      ctx.moveTo(toCanvasX(0), toCanvasY(r));
      ctx.lineTo(toCanvasX(cmlSigEnd), toCanvasY(Math.min(cmlRetEnd, RET_MAX)));
      ctx.strokeStyle = '#FDB813';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label CML
      const cmlLabelSig = sm * 1.35;
      const cmlLabelRet = r + (pr / sm) * cmlLabelSig;
      if (cmlLabelSig < SIG_MAX && cmlLabelRet < RET_MAX) {
        ctx.fillStyle = '#FDB813';
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('CML', toCanvasX(cmlLabelSig) + 4, toCanvasY(cmlLabelRet) - 4);
      }

      // Punto rf (activo libre de riesgo)
      ctx.beginPath();
      ctx.arc(toCanvasX(0), toCanvasY(r), 5, 0, Math.PI * 2);
      ctx.fillStyle = '#34D399';
      ctx.fill();
      ctx.fillStyle = '#34D399';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`rf=${(r*100).toFixed(1)}%`, toCanvasX(0) + 8, toCanvasY(r) - 2);

      // Punto portafolio de mercado (alpha=1)
      const mktX = toCanvasX(sm);
      const mktY = toCanvasY(r + pr);
      ctx.beginPath();
      ctx.arc(mktX, mktY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#F59E0B';
      ctx.fill();
      ctx.fillStyle = '#F59E0B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('M', mktX + 8, mktY + 4);

      // ── Portafolio del usuario ────────────────────────────────────────────
      const ptX = toCanvasX(sigPt);
      const ptY = toCanvasY(retPt);
      // Halo
      ctx.save();
      ctx.shadowColor = '#A78BFA';
      ctx.shadowBlur  = 18;
      ctx.beginPath();
      ctx.arc(ptX, ptY, 9, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(ptX - 2, ptY - 2, 2, ptX, ptY, 9);
      grad.addColorStop(0, '#DDD6FE');
      grad.addColorStop(1, '#7C3AED');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      // Etiqueta portafolio
      ctx.fillStyle = '#C4B5FD';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`E[R]=${(retPt*100).toFixed(1)}%`, ptX, ptY - 14);
      ctx.fillStyle = '#A78BFA';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`σ=${(sigPt*100).toFixed(1)}%`, ptX, ptY - 4);

      // Líneas punteadas hacia ejes
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = '#4C1D95';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ptX, ptY); ctx.lineTo(ptX, GY1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ptX, ptY); ctx.lineTo(GX0, ptY); ctx.stroke();
      ctx.setLineDash([]);

      // Zona de apalancamiento (alpha > 1)
      if (al > 1.02) {
        ctx.fillStyle = '#7F1D1D';
        ctx.fillRect(toCanvasX(sm), GY0, GX1 - toCanvasX(sm), GH);
        ctx.fillStyle = '#FCA5A5';
        ctx.font = '10px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⚠ apalancado', toCanvasX(sm) + (GX1 - toCanvasX(sm)) / 2, GY0 + 14);
      }

      // Titulo panel izquierdo
      ctx.fillStyle = '#FDB813';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('Capital Market Line — Tobin (1958)', GX0 + 2, GY0 - 8);

      // ────────────────────────────────────────────────────────────────────
      // PANEL DERECHO: Q de Tobin + barra de inversión
      // ────────────────────────────────────────────────────────────────────
      const RX = LEFT_W + 14;
      const RY0 = 28;
      const RH_ = H - 56;

      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('Q de Tobin — decisión de inversión', RX, RY0);

      // ── Termómetro Q ───────────────────────────────────────────────────
      const thermX  = RX + 20;
      const thermY0 = RY0 + 14;
      const thermH  = RH_ - 90;
      const thermW  = 18;
      const Q_RANGE = 2.5;  // muestra Q de 0 a 2.5

      // fondo termómetro
      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(thermX, thermY0, thermW, thermH, 4);
      ctx.fill();
      ctx.stroke();

      // zona verde > 1
      const yLine1 = thermY0 + thermH * (1 - 1 / Q_RANGE);
      const filling = Math.min(q, Q_RANGE) / Q_RANGE;
      const fillH   = filling * thermH;
      const fillY   = thermY0 + thermH - fillH;
      const fillColor = q > 1 ? '#10B981' : '#EF4444';
      ctx.fillStyle = fillColor + '99';
      ctx.beginPath();
      ctx.roundRect(thermX + 2, fillY, thermW - 4, fillH, 2);
      ctx.fill();

      // línea Q=1
      ctx.strokeStyle = '#FDB813';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(thermX - 6, yLine1);
      ctx.lineTo(thermX + thermW + 6, yLine1);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#FDB813';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('Q=1', thermX + thermW + 8, yLine1 + 4);

      // marcador del nivel Q actual
      const qY = thermY0 + thermH * (1 - Math.min(q, Q_RANGE) / Q_RANGE);
      ctx.save();
      ctx.shadowColor = fillColor;
      ctx.shadowBlur = 10;
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.moveTo(thermX - 2, qY);
      ctx.lineTo(thermX - 10, qY - 5);
      ctx.lineTo(thermX - 10, qY + 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // ticks Q
      ctx.fillStyle = '#475569';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'right';
      for (let qi = 0; qi <= Q_RANGE; qi += 0.5) {
        const ty = thermY0 + thermH * (1 - qi / Q_RANGE);
        if (ty < thermY0 || ty > thermY0 + thermH) continue;
        ctx.fillText(qi.toFixed(1), thermX - 12, ty + 3);
      }

      // valor Q grande
      ctx.fillStyle = fillColor;
      ctx.font = 'bold 22px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Q = ${q.toFixed(2)}`, thermX + thermW / 2 + 38, thermY0 + thermH + 20);

      // ── Decisión empresarial ───────────────────────────────────────────
      const decMsg = q > 1 ? '▲ INVIERTE: Q > 1' : '▼ PAUSA: Q < 1';
      ctx.fillStyle = q > 1 ? '#34D399' : '#EF4444';
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(decMsg, thermX + thermW / 2 + 38, thermY0 + thermH + 36);

      // ── Barra de inversión ────────────────────────────────────────────
      const barLabel = q > 1
        ? `Inversión: $${invAmt.toFixed(1)}M`
        : 'Inversión: $0M';
      const barMax = act * 0.5;
      const barFrac = Math.min(1, invAmt / Math.max(1, barMax));
      const barX   = RX + 56;
      const barW   = RIGHT_W - 74;
      const barY   = thermY0 + thermH + 50;
      const barH   = 12;

      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 3);
      ctx.fill();
      ctx.stroke();

      if (barFrac > 0) {
        const barGrad = ctx.createLinearGradient(barX, 0, barX + barW * barFrac, 0);
        barGrad.addColorStop(0, '#065F46');
        barGrad.addColorStop(1, '#10B981');
        ctx.fillStyle = barGrad;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW * barFrac, barH, 3);
        ctx.fill();
      }

      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(barLabel, barX, barY + barH + 13);

      ctx.fillStyle = '#475569';
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText(`activos: $${act.toFixed(0)}M`, barX, barY + barH + 24);

      // ── Leyenda rápida ────────────────────────────────────────────────
      const legY = barY + barH + 42;
      ctx.fillStyle = '#334155';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('I = 0.25 · K · max(0, Q−1)', RX, legY);
      ctx.fillText('Q = V_mkt / K_repos', RX, legY + 11);

      // Sharpe del mercado (en panel derecho abajo)
      ctx.fillStyle = '#64748B';
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText(`Sharpe M = ${sharpeM(pr, sm).toFixed(2)}`, RX, legY + 26);
    }

    function loop() {
      draw();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(raf); };
  }, []);

  const insight = (() => {
    const q = stateRef.current.qMkt;
    if (q > 1.5) return 'Q está muy alta: el mercado valúa a la empresa mucho más de lo que cuestan sus activos. Señal de construir agresivamente — o de burbuja. Boom tecnológico, 1999.';
    if (q > 1.05) return 'Q > 1: conviene invertir. El mercado dice que cada peso de capital real genera más de un peso de valor. Las empresas se ponen a construir.';
    if (q > 0.90) return 'Q ≈ 1: equilibrio. El mercado valúa los activos justo a su costo de reposición. Sin señal clara para invertir o desinvertir.';
    return 'Q < 1: vale más comprar la empresa en bolsa que construir sus activos desde cero. Las empresas paran proyectos. Eso es una recesión de inversión.';
  })();

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* Canvas */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block touch-none"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Badges */}
          <div className="grid grid-cols-4 gap-2">
            <Stat label="E[R] portafolio" value={`${(retP*100).toFixed(1)}%`}  accent="#A78BFA" />
            <Stat label="σ portafolio"    value={`${(sigP*100).toFixed(1)}%`}  accent="#7C3AED" />
            <Stat label="Sharpe mercado"  value={sharpe.toFixed(2)}             accent="#FDB813" />
            <Stat label="Inversión"       value={`$${inv.toFixed(1)}M`}         accent={qMkt > 1 ? '#34D399' : '#EF4444'} />
          </div>

          {/* Panel insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#38BDF8] font-mono mb-2">✦ ¿Qué estás viendo?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* Panel de controles */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ Mueve los parámetros</div>

          <Slider
            label="Tasa libre de riesgo (rf)"
            value={rf} min={0.01} max={0.18} step={0.005}
            onChange={setRf}
            fmt={v => `${(v*100).toFixed(1)}%`}
            hint="CETES, bonos del gobierno. Sube rf → la CML se desplaza hacia arriba."
          />
          <Slider
            label="Prima de riesgo (E[Rm]−rf)"
            value={prem} min={0.02} max={0.20} step={0.005}
            onChange={setPrem}
            fmt={v => `${(v*100).toFixed(1)}%`}
            hint="Cuánto extra paga el mercado sobre los bonos. Más prima → CML más inclinada."
          />
          <Slider
            label="Volatilidad del mercado (σm)"
            value={sigM} min={0.05} max={0.35} step={0.01}
            onChange={setSigM}
            fmt={v => `${(v*100).toFixed(0)}%`}
            hint="Qué tan volátil es el portafolio de mercado. Aumenta → Sharpe baja."
          />
          <Slider
            label="Fracción en mercado (α)"
            value={alpha} min={0} max={2} step={0.01}
            onChange={setAlpha}
            fmt={v => v < 0.05 ? 'solo bonos' : v < 0.95 ? `${(v*100).toFixed(0)}% mkt` : v < 1.05 ? 'portafolio M' : `apalancado ×${v.toFixed(2)}`}
            hint="0 = solo bonos, 1 = portafolio de mercado, >1 = pide prestado para invertir más."
          />

          <div className="border-t border-[#1E293B] pt-3 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">Q de Tobin</div>
            <Slider
              label="Q actual de la empresa"
              value={qMkt} min={0.3} max={2.5} step={0.05}
              onChange={setQMkt}
              fmt={v => v.toFixed(2)}
              hint="ValorMercado / CostoReposición. Muévelo y observa cuánto invierte la empresa."
            />
            <Slider
              label="Capital (activos, millones $)"
              value={activos} min={20} max={300} step={5}
              onChange={setActivos}
              fmt={v => `$${v.toFixed(0)}M`}
              hint="Costo de reposición de los activos reales de la empresa."
            />
          </div>

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed space-y-1">
            <div>CML: E[Rp] = rf + Sharpe·σp</div>
            <div>Q = V_mkt / K_repos</div>
            <div>I = 0.25·K·max(0, Q−1)</div>
            <div className="text-[#334155] mt-1">Tobin (1958, 1969) · comité Nobel 1981</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componentes ────────────────────────────────────────────────────────
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[17px] font-bold font-mono" style={{ color: accent }}>{value}</div>
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
        <span className="text-[12px] font-mono text-[#FDB813]">{fmt ? fmt(value) : value.toFixed(3)}</span>
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
