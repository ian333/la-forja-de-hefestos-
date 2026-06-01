/**
 * MarkowitzSharpeLab — Premio Nobel 1990 (Markowitz, Sharpe, Miller).
 *
 * El click: no importa qué tan buena sea una sola inversión en papel —
 * mezclar activos que NO se mueven igual siempre te da MÁS rendimiento
 * por cada peso de riesgo. La FRONTERA EFICIENTE emerge de la matemática;
 * el Sharpe Ratio la cuantifica.
 *
 * Matemática REAL y exacta:
 *   Portafolio de 3 activos con pesos w = [w1, w2, w3], Σ w_i = 1
 *
 *   Rendimiento esperado:
 *     E[Rp] = w1·μ1 + w2·μ2 + w3·μ3
 *
 *   Varianza del portafolio (matriz de covarianzas 3×3):
 *     σ²p = Σ_i Σ_j w_i · w_j · σ_ij
 *     σ_ij = ρ_ij · σ_i · σ_j
 *
 *   Riesgo (desviación estándar):
 *     σp = √σ²p
 *
 *   Sharpe Ratio (tasa libre de riesgo rf):
 *     SR = (E[Rp] − rf) / σp
 *
 * La frontera eficiente se traza muestreando decenas de miles de
 * portafolios aleatorios de los 3 activos y pintando cada punto
 * en el espacio (σ, E[R]). La curva superior es la frontera de
 * Markowitz. La recta de mercado de capitales (CML) pasa por rf
 * y toca la frontera en el portafolio de máximo Sharpe.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Dimensiones del canvas ───────────────────────────────────────────────────
const W = 820;
const H = 380;

// ─── Activos predefinidos (μ = rendimiento anual, σ = vol anual) ──────────────
interface Asset {
  name: string;
  mu: number;   // rendimiento esperado anual (fracción: 0.12 = 12%)
  sigma: number; // desviación estándar anual (fracción)
  color: string;
}

const ASSETS: Asset[] = [
  { name: 'Acciones MX', mu: 0.12, sigma: 0.22, color: '#FDB813' },
  { name: 'Bonos Tesoro', mu: 0.045, sigma: 0.06, color: '#4FC3F7' },
  { name: 'Oro', mu: 0.08, sigma: 0.16, color: '#F472B6' },
];

// Correlaciones (matriz triangular superior) —
// ρ[i][j] con i < j (activos 0,1,2)
// Acciones↔Bonos: −0.15  (correlación negativa: bonos suben si bolsa cae)
// Acciones↔Oro:    0.05  (casi independientes)
// Bonos↔Oro:      −0.05
const RHO: number[][] = [
  [1.0,  -0.15,  0.05],
  [-0.15,  1.0, -0.05],
  [0.05, -0.05,  1.0],
];

const RF = 0.045; // tasa libre de riesgo anual (Cetes ~4.5%)

// ─── Helpers de álgebra de portafolio ─────────────────────────────────────────
function portfolioStats(w: number[]): { mu: number; sigma: number } {
  let mu = 0;
  for (let i = 0; i < 3; i++) mu += w[i] * ASSETS[i].mu;

  let variance = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      variance += w[i] * w[j] * RHO[i][j] * ASSETS[i].sigma * ASSETS[j].sigma;
    }
  }
  return { mu, sigma: Math.sqrt(Math.max(0, variance)) };
}

function sharpeRatio(mu: number, sigma: number): number {
  if (sigma < 1e-9) return 0;
  return (mu - RF) / sigma;
}

// Simula N portafolios aleatorios (Dirichlet uniforme → simplest: normalizar 3 uniformes)
function samplePortfolios(n: number): Array<{ w: number[]; mu: number; sigma: number; sr: number }> {
  const result: Array<{ w: number[]; mu: number; sigma: number; sr: number }> = [];
  for (let k = 0; k < n; k++) {
    // 3 números exponenciales (normalizar da distribución uniforme en el simplex)
    const r = [
      -Math.log(Math.random() + 1e-12),
      -Math.log(Math.random() + 1e-12),
      -Math.log(Math.random() + 1e-12),
    ];
    const sum = r[0] + r[1] + r[2];
    const w = r.map(x => x / sum);
    const { mu, sigma } = portfolioStats(w);
    result.push({ w, mu, sigma, sr: sharpeRatio(mu, sigma) });
  }
  return result;
}

// ─── Escala canvas ─────────────────────────────────────────────────────────────
const PAD_L = 64;
const PAD_R = 24;
const PAD_T = 36;
const PAD_B = 52;

// Rango del espacio (σ, μ)
const SIGMA_MIN = 0;
const SIGMA_MAX = 0.28;
const MU_MIN = 0.02;
const MU_MAX = 0.155;

function toCanvasX(sigma: number): number {
  return PAD_L + ((sigma - SIGMA_MIN) / (SIGMA_MAX - SIGMA_MIN)) * (W - PAD_L - PAD_R);
}
function toCanvasY(mu: number): number {
  return H - PAD_B - ((mu - MU_MIN) / (MU_MAX - MU_MIN)) * (H - PAD_T - PAD_B);
}

// ─── Tipos de estado ───────────────────────────────────────────────────────────
interface Weights {
  w0: number; // acciones (0..100, paso 1)
  w1: number; // bonos
  // w2 = 100 - w0 - w1
}

const DEFAULTS: Weights = { w0: 40, w1: 35 };

// ─── Muestreo estático de la frontera (se recalcula una vez) ──────────────────
let CACHED_SAMPLES: Array<{ w: number[]; mu: number; sigma: number; sr: number }> = [];
function getOrCreateSamples(): typeof CACHED_SAMPLES {
  if (CACHED_SAMPLES.length === 0) {
    CACHED_SAMPLES = samplePortfolios(4000);
  }
  return CACHED_SAMPLES;
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function MarkowitzSharpeLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const weightsRef = useRef<Weights>({ ...DEFAULTS });

  const [w0, setW0] = useState(DEFAULTS.w0);
  const [w1, setW1] = useState(DEFAULTS.w1);

  // Stats que se muestran fuera del canvas
  const [stats, setStats] = useState({ mu: 0, sigma: 0, sr: 0, w2: 25, maxSR: 0, maxSRmu: 0, maxSRsigma: 0 });

  // Sincronizar ref con estado
  useEffect(() => {
    weightsRef.current = { w0, w1 };
  }, [w0, w1]);

  // Limitar w1 para que w2 >= 0
  const safeW1Max = useCallback((newW0: number) => Math.max(0, 100 - newW0), []);
  const handleW0 = useCallback((newW0: number) => {
    setW0(newW0);
    setW1(prev => Math.min(prev, safeW1Max(newW0)));
  }, [safeW1Max]);

  // ─── Loop de animación ────────────────────────────────────────────────────
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

    const samples = getOrCreateSamples();

    // Portafolio de máximo Sharpe (precomputado)
    let maxSR = -Infinity;
    let maxSRPt = samples[0];
    for (const pt of samples) {
      if (pt.sr > maxSR) { maxSR = pt.sr; maxSRPt = pt; }
    }

    let raf = 0;
    let frame = 0;

    function draw() {
      if (!ctx) return;
      const ww = weightsRef.current;
      const rawW2 = 100 - ww.w0 - ww.w1;
      const w2clamped = Math.max(0, rawW2);
      const wArr = [ww.w0 / 100, ww.w1 / 100, w2clamped / 100];
      const { mu: curMu, sigma: curSigma } = portfolioStats(wArr);
      const curSR = sharpeRatio(curMu, curSigma);

      // Fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ─── Ejes ──────────────────────────────────────────────────────────────
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;

      // Líneas de cuadrícula horizontales (rendimiento)
      ctx.setLineDash([3, 5]);
      for (let mu = 0.04; mu <= MU_MAX; mu += 0.02) {
        const y = toCanvasY(mu);
        ctx.beginPath();
        ctx.moveTo(PAD_L, y);
        ctx.lineTo(W - PAD_R, y);
        ctx.stroke();
      }
      // Líneas de cuadrícula verticales (riesgo)
      for (let s = 0.05; s <= SIGMA_MAX; s += 0.05) {
        const x = toCanvasX(s);
        ctx.beginPath();
        ctx.moveTo(x, PAD_T);
        ctx.lineTo(x, H - PAD_B);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Ejes principales
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(PAD_L, PAD_T);
      ctx.lineTo(PAD_L, H - PAD_B);
      ctx.lineTo(W - PAD_R, H - PAD_B);
      ctx.stroke();

      // Etiquetas eje X (riesgo σ)
      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      for (let s = 0.05; s <= SIGMA_MAX; s += 0.05) {
        const x = toCanvasX(s);
        ctx.fillText(`${(s * 100).toFixed(0)}%`, x, H - PAD_B + 14);
      }
      ctx.fillStyle = '#94A3B8';
      ctx.font = '11px ui-sans-serif, system-ui';
      ctx.fillText('Riesgo (σ anual)', W / 2 + 20, H - 8);

      // Etiquetas eje Y (rendimiento μ)
      ctx.textAlign = 'right';
      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      for (let mu = 0.04; mu <= MU_MAX; mu += 0.02) {
        const y = toCanvasY(mu);
        ctx.fillText(`${(mu * 100).toFixed(0)}%`, PAD_L - 6, y + 4);
      }
      // Label eje Y rotado
      ctx.save();
      ctx.translate(14, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Rendimiento esperado (μ anual)', 0, 0);
      ctx.restore();

      // ─── Nube de portafolios (frontera de Markowitz) ───────────────────────
      for (const pt of samples) {
        const x = toCanvasX(pt.sigma);
        const y = toCanvasY(pt.mu);
        // Color por Sharpe ratio: bajo=azul oscuro, alto=dorado
        const t = Math.max(0, Math.min(1, (pt.sr - 0.1) / 0.9));
        const r = Math.round(79 + t * (253 - 79));
        const g = Math.round(143 + t * (184 - 143));
        const b = Math.round(200 + t * (19 - 200));
        ctx.fillStyle = `rgba(${r},${g},${b},0.55)`;
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }

      // ─── Línea del mercado de capitales (CML) ──────────────────────────────
      // CML: pasa por (0, rf) y (σ*, μ*) del portafolio de máx Sharpe
      // E[R] = rf + SR_max * σ
      const cmlX0 = toCanvasX(0);
      const cmlY0 = toCanvasY(RF);
      const cmlX1 = toCanvasX(SIGMA_MAX);
      const cmlY1 = toCanvasY(RF + maxSRPt.sr * SIGMA_MAX);
      ctx.save();
      ctx.strokeStyle = 'rgba(52,211,153,0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(cmlX0, cmlY0);
      ctx.lineTo(cmlX1, cmlY1);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Etiqueta CML
      ctx.fillStyle = '#34D399';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('CML', cmlX1 - 40, cmlY1 - 6);

      // Tasa libre de riesgo (Cetes)
      const rfX = toCanvasX(0);
      const rfY = toCanvasY(RF);
      ctx.fillStyle = '#34D399';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`rf=${(RF * 100).toFixed(1)}%`, rfX + 4, rfY - 4);

      // ─── Activos individuales ──────────────────────────────────────────────
      for (let i = 0; i < 3; i++) {
        const ax = toCanvasX(ASSETS[i].sigma);
        const ay = toCanvasY(ASSETS[i].mu);
        ctx.save();
        ctx.shadowColor = ASSETS[i].color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = ASSETS[i].color;
        ctx.beginPath();
        ctx.arc(ax, ay, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = ASSETS[i].color;
        ctx.font = 'bold 11px ui-sans-serif, system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(ASSETS[i].name, ax + 8, ay + 4);
      }

      // ─── Portafolio de máximo Sharpe (estrella) ────────────────────────────
      const msx = toCanvasX(maxSRPt.sigma);
      const msy = toCanvasY(maxSRPt.mu);
      ctx.save();
      ctx.shadowColor = '#34D399';
      ctx.shadowBlur = 18;
      // Dibujar estrella sencilla (punto grande con bordes)
      ctx.strokeStyle = '#34D399';
      ctx.fillStyle = 'rgba(52,211,153,0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(msx, msy, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#34D399';
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`★ Sharpe max`, msx + 12, msy - 2);
      ctx.fillText(`SR=${maxSRPt.sr.toFixed(2)}`, msx + 12, msy + 10);

      // ─── Portafolio actual del usuario ─────────────────────────────────────
      const px = toCanvasX(curSigma);
      const py = toCanvasY(curMu);
      ctx.save();
      ctx.shadowColor = '#FDB813';
      ctx.shadowBlur = 22;
      const grad = ctx.createRadialGradient(px - 3, py - 3, 2, px, py, 11);
      grad.addColorStop(0, '#FEF3C7');
      grad.addColorStop(1, '#F59E0B');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#FEF3C7';
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('Tu portafolio', px + 13, py - 2);
      ctx.fillStyle = '#FDB813';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`SR=${curSR.toFixed(2)}`, px + 13, py + 10);

      // ─── Segmento que conecta tu portafolio con el Sharpe máx ─────────────
      if (Math.abs(px - msx) > 4 || Math.abs(py - msy) > 4) {
        ctx.save();
        ctx.strokeStyle = 'rgba(253,184,19,0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(msx, msy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // ─── Título ────────────────────────────────────────────────────────────
      ctx.fillStyle = '#E2E8F0';
      ctx.font = 'bold 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('Frontera Eficiente de Markowitz · 3 activos', PAD_L + 4, 22);

      // Leyenda de color Sharpe
      const legX = W - PAD_R - 140;
      const legY = PAD_T + 4;
      const gradLeg = ctx.createLinearGradient(legX, 0, legX + 100, 0);
      gradLeg.addColorStop(0, 'rgba(79,143,200,0.7)');
      gradLeg.addColorStop(1, 'rgba(253,184,19,0.7)');
      ctx.fillStyle = gradLeg;
      ctx.fillRect(legX, legY, 100, 8);
      ctx.fillStyle = '#64748B';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('Sharpe bajo', legX, legY + 18);
      ctx.textAlign = 'right';
      ctx.fillText('Sharpe alto', legX + 100, legY + 18);

      if (frame % 8 === 0) {
        setStats({
          mu: curMu,
          sigma: curSigma,
          sr: curSR,
          w2: Math.max(0, 100 - ww.w0 - ww.w1),
          maxSR: maxSRPt.sr,
          maxSRmu: maxSRPt.mu,
          maxSRsigma: maxSRPt.sigma,
        });
      }
    }

    function loop() {
      draw();
      frame++;
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  // ─── Insight contextual ────────────────────────────────────────────────────
  const insightText = (() => {
    const srRatio = stats.maxSR > 0 ? stats.sr / stats.maxSR : 0;
    if (srRatio >= 0.95) {
      return '¡Tu portafolio está cerca del máximo Sharpe! Estás en la frontera eficiente: máximo rendimiento por cada peso de riesgo. Así construye Banxico sus reservas de 220 mil millones de dólares.';
    }
    if (stats.w2 >= 90) {
      return 'Todo en oro: alta concentración. El portafolio eficiente de Markowitz dice que podrías ganar más o arriesgar menos mezclando. Mueve los sliders para ver cómo la bolita dorada sube hacia el portafolio estrella (★).';
    }
    if (w0 >= 90) {
      return 'Todo en acciones mexicanas: alto rendimiento esperado pero también alta volatilidad. Agrega bonos (correlación negativa con la bolsa) y reduce tu riesgo sin sacrificar casi nada de rendimiento. Eso es la magia de la diversificación.';
    }
    if (w1 >= 85) {
      return 'Todo en bonos: bajo riesgo, pero el rendimiento esperado también es bajo. Si agregas un poco de acciones (que NO se mueven igual que los bonos) puedes subir el rendimiento con poco aumento de riesgo. La nube de puntos te muestra adónde llega la frontera.';
    }
    return 'Mueve los sliders y observa cómo tu portafolio (bolita dorada) viaja por la nube. Los puntos más arriba-izquierda son los mejores: más rendimiento, menos riesgo. La recta verde (CML) pasa por el portafolio de máximo Sharpe (★).';
  })();

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* ── Canvas ─────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Estadísticas numéricas */}
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="Rendimiento esperado"
              value={`${(stats.mu * 100).toFixed(1)}%`}
              sub="μ anual"
              accent="#FDB813"
            />
            <Stat
              label="Riesgo (volatilidad)"
              value={`${(stats.sigma * 100).toFixed(1)}%`}
              sub="σ anual"
              accent="#F472B6"
            />
            <Stat
              label="Sharpe Ratio"
              value={stats.sr.toFixed(2)}
              sub={`max posible ${stats.maxSR.toFixed(2)}`}
              accent={stats.maxSR > 0 && stats.sr / stats.maxSR >= 0.9 ? '#34D399' : '#4FC3F7'}
            />
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#FDB813] font-mono mb-2">
              ✦ ¿Qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insightText}</p>
          </div>
        </div>

        {/* ── Panel de controles ─────────────────────────────────────────── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Mueve tu portafolio
          </div>

          {/* Slider Acciones */}
          <Slider
            label="Acciones MX"
            value={w0}
            min={0}
            max={100}
            step={1}
            color="#FDB813"
            onChange={handleW0}
            fmt={v => `${v}%`}
            hint="Alta volatilidad, alto rendimiento esperado."
          />

          {/* Slider Bonos */}
          <Slider
            label="Bonos del Tesoro"
            value={w1}
            min={0}
            max={safeW1Max(w0)}
            step={1}
            color="#4FC3F7"
            onChange={setW1}
            fmt={v => `${v}%`}
            hint="Correlación negativa con la bolsa: ↓bolsa → ↑bonos."
          />

          {/* Oro (residual) */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] text-[#94A3B8] font-medium">Oro</span>
              <span className="text-[12px] font-mono" style={{ color: '#F472B6' }}>
                {Math.max(0, 100 - w0 - w1)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#1E293B] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(0, 100 - w0 - w1)}%`,
                  background: '#F472B6',
                }}
              />
            </div>
            <div className="text-[10px] text-[#64748B] leading-snug">
              Residual automático. Poco correlacionado con bonos y acciones.
            </div>
          </div>

          {/* Barra visual de composición */}
          <div className="space-y-1">
            <div className="text-[10px] text-[#64748B] font-mono uppercase tracking-widest">
              composición
            </div>
            <div className="flex h-4 rounded overflow-hidden gap-px">
              <div style={{ width: `${w0}%`, background: '#FDB813' }} />
              <div style={{ width: `${w1}%`, background: '#4FC3F7' }} />
              <div style={{ width: `${Math.max(0, 100 - w0 - w1)}%`, background: '#F472B6' }} />
            </div>
          </div>

          {/* Referencia Sharpe Ratio */}
          <div className="bg-[#0B1420] border border-[#1E293B] rounded p-3 space-y-1">
            <div className="text-[10px] text-[#4FC3F7] font-mono uppercase tracking-widest mb-1">
              ¿Qué es el Sharpe Ratio?
            </div>
            <div className="text-[11px] font-mono text-[#94A3B8] leading-relaxed">
              SR = (μ − rf) / σ
            </div>
            <div className="text-[10px] text-[#64748B] leading-snug">
              Rendimiento extra sobre Cetes (rf={`${(RF * 100).toFixed(1)}`}%)
              por unidad de riesgo. SR {'>'} 1 es excelente. El S&P 500 promedió
              ~0.7 histórico. Tu ETF básico vale más que un hedge fund con SR de 0.3.
            </div>
          </div>

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo: σ²p = Σᵢⱼ wᵢ wⱼ ρᵢⱼ σᵢ σⱼ<br />
            (Markowitz, Portfolio Selection 1952<br />
            · Sharpe, CAPM 1964)
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

interface StatProps {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}

function Stat({ label, value, sub, accent }: StatProps) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[19px] font-bold font-mono" style={{ color: accent }}>{value}</div>
      {sub && <div className="text-[9px] text-[#475569] font-mono mt-0.5">{sub}</div>}
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  color: string;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
  hint?: string;
}

function Slider({ label, value, min, max, step, color, onChange, fmt, hint }: SliderProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[12px] font-mono" style={{ color }}>
          {fmt ? fmt(value) : value}
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
        style={{ accentColor: color }}
      />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}
