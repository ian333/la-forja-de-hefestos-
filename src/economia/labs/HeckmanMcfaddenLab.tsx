/**
 * HeckmanMcfaddenLab — laboratorio del premio Nobel 2000.
 *
 * Premio compartido:
 *   · James Heckman  — corrección del sesgo de selección muestral
 *   · Daniel McFadden — modelo logit de elecciones discretas
 *
 * El click: Los estudios clásicos medían solo a quienes YA eligieron
 * (quien entró al mercado laboral, quien tomó el crédito, quien fue
 * a la universidad). Eso corrompe la estimación. Heckman lo corrige
 * con la Razón Inversa de Mills. McFadden, en paralelo, modeló CÓMO
 * la gente elige entre alternativas discretas (metro vs carro vs Uber)
 * usando utilidades aleatorias y el softmax (logit).
 *
 * MATEMÁTICAS REALES
 * ──────────────────
 * Heckman (dos etapas):
 *   Ecuación de selección (probit):   P_sel = Φ(z·γ)
 *   IMR (Inverse Mills Ratio):         λ = φ(z·γ) / Φ(z·γ)
 *   Ecuación de salarios:              E[w|sel] = β₀ + β_edu·edu + σ·λ
 *
 *   Sin corrección → sesgo positivo porque los que "entran" al mercado
 *   son los más productivos (self-selected).
 *   Con corrección → E[w|todos] = β₀ + β_edu·edu  (sin el término σλ)
 *
 * McFadden logit multinomial:
 *   V_j = β_costo · costo_j + β_tiempo · tiempo_j  (utilidad determin.)
 *   P_j = exp(V_j) / Σ_k exp(V_k)                  (softmax)
 *   Elasticidad cruzada propia:  ε_jj = β_costo · costo_j · (1 − P_j)
 */

import { useEffect, useRef, useState } from 'react';

// ── Dimensiones ──────────────────────────────────────────────────────────────
const W = 820;
const H = 400;
const PAD = 44;

// ── Normal PDF y CDF (Box-Muller / Horner) ───────────────────────────────────
function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}
// Rational approx de Abramowitz & Stegun §7.1.26 (max error 7.5e-8)
function normCdf(x: number): number {
  const neg = x < 0;
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly =
    t * (0.319381530 +
    t * (-0.356563782 +
    t * (1.781477937 +
    t * (-1.821255978 +
    t *  1.330274429))));
  const val = 1 - normPdf(Math.abs(x)) * poly;
  return neg ? 1 - val : val;
}
function invMillsRatio(z: number): number {
  const d = normCdf(z);
  if (d < 1e-10) return 4.0;            // límite superior estable
  return normPdf(z) / d;
}

// ── Parámetros del modelo Heckman ─────────────────────────────────────────────
// Ecuación de selección: P_sel = Φ(γ₀ + γ_ing·ingreso_familiar)
// Ecuación de salarios:  w = β₀ + β_edu·años_edu + σ·IMR + ε
const HECK = {
  gamma0:  -1.2,   // constante de selección
  gammaInc: 0.8,   // ingreso familiar → probabilidad de entrar al mercado
  beta0:    8.0,   // intercepto salarial (miles MXN/mes)
  betaEdu:  0.6,   // retorno por año de educación
  sigma:    2.2,   // cov(ε_sel, ε_sal) / σ_sel
  noise:    0.9,   // ruido del salario observable
};

// ── Genera N personas sintéticas ──────────────────────────────────────────────
interface Persona {
  edu: number;     // años educación 6-22
  inc: number;     // ingreso familiar estandarizado -2..2
  pSel: number;    // prob. ser seleccionado (en muestra)
  sel: boolean;    // ¿entra al mercado/muestra?
  wTrue: number;   // salario "verdadero" (con IMR corr.)
  wBias: number;   // salario observado (sin corr., sesgado)
}

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return ((s >>> 0) / 0xffffffff);
  };
}

function generatePersonas(N: number, sesgoBias: number): Persona[] {
  const rand = seededRand(42);
  const personas: Persona[] = [];
  for (let i = 0; i < N; i++) {
    const edu = 6 + Math.floor(rand() * 17);         // 6-22 años
    const inc = (rand() * 4 - 2);                     // -2..2
    // sesgo controlado por slider: cuánto pesa el ingreso familiar
    const z = HECK.gamma0 + (HECK.gammaInc + sesgoBias * 0.5) * inc;
    const pSel = normCdf(z);
    const sel  = rand() < pSel;
    const imr  = invMillsRatio(z);
    const noise = (rand() - 0.5) * 2 * HECK.noise;
    const wTrue = HECK.beta0 + HECK.betaEdu * edu + noise;
    const wBias = HECK.beta0 + HECK.betaEdu * edu + HECK.sigma * imr + noise;
    personas.push({ edu, inc, pSel, sel, wTrue, wBias });
  }
  return personas;
}

// ── Ajuste OLS simple (sin intercepción para edu → salario) ──────────────────
function ols(personas: Persona[], useSel: boolean, corrected: boolean): { slope: number; intercept: number } {
  const pts = useSel ? personas.filter(p => p.sel) : personas;
  if (pts.length < 2) return { slope: HECK.betaEdu, intercept: HECK.beta0 };
  const xs = pts.map(p => p.edu);
  const ys = pts.map(p => corrected ? p.wTrue : p.wBias);
  const n = pts.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) * (x - mx), 0);
  const slope = den > 0 ? num / den : HECK.betaEdu;
  const intercept = my - slope * mx;
  return { slope, intercept };
}

// ── McFadden: modos de transporte ─────────────────────────────────────────────
interface Mode {
  label: string;
  color: string;
  baseCost: number;   // pesos
  baseTime: number;   // minutos
}
const MODES: Mode[] = [
  { label: 'Metro',  color: '#4FC3F7', baseCost:  5,  baseTime: 40 },
  { label: 'Carro',  color: '#FDB813', baseCost: 80,  baseTime: 25 },
  { label: 'Uber',   color: '#34D399', baseCost: 60,  baseTime: 20 },
];
const BETA_COSTO  = -0.035;   // utilidad marginal del costo
const BETA_TIEMPO = -0.045;   // utilidad marginal del tiempo

function logitProbs(modes: Mode[], costoMult: number, tiempoMult: number): number[] {
  const Vs = modes.map(m => BETA_COSTO * m.baseCost * costoMult + BETA_TIEMPO * m.baseTime * tiempoMult);
  const maxV = Math.max(...Vs);
  const exps = Vs.map(v => Math.exp(v - maxV));
  const sum  = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sum);
}

// ── Interfaces de estado ──────────────────────────────────────────────────────
interface HeckParams {
  sesgoBias: number;   // 0..1  cuánto pesa el ingreso familiar en selección
  mostrarCorr: boolean;
  N: number;
}
interface McfParams {
  costoMult: number;   // multiplicador de costos 0.5..3
  tiempoMult: number;  // multiplicador de tiempos 0.5..2
}

const H_DEF: HeckParams  = { sesgoBias: 0.5, mostrarCorr: false, N: 180 };
const M_DEF: McfParams   = { costoMult: 1.0, tiempoMult: 1.0 };

// ── Componentes pequeños ──────────────────────────────────────────────────────
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[17px] font-bold font-mono leading-tight" style={{ color: accent }}>{value}</div>
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
        <span className="text-[12px] font-mono text-[#FDB813]">{fmt ? fmt(value) : value.toFixed(2)}</span>
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

// ── Componente principal ──────────────────────────────────────────────────────
export default function HeckmanMcfaddenLab() {
  // ── estado Heckman
  const [sesgoBias, setSesgoBias] = useState(H_DEF.sesgoBias);
  const [mostrarCorr, setMostrarCorr] = useState(H_DEF.mostrarCorr);
  // ── estado McFadden
  const [costoMult, setCostoMult]   = useState(M_DEF.costoMult);
  const [tiempoMult, setTiempoMult] = useState(M_DEF.tiempoMult);
  // ── modo activo
  const [modo, setModo] = useState<'heckman' | 'mcfadden'>('heckman');
  // ── stats mostrados
  const [statsH, setStatsH] = useState({ sesgado: 0, real: 0, pctSel: 0, N: 0 });
  const [statsM, setStatsM] = useState<number[]>([0.33, 0.33, 0.34]);

  // ── refs para canvas y parámetros
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const hRef       = useRef<HeckParams>({ ...H_DEF });
  const mRef       = useRef<McfParams>({ ...M_DEF });
  const modoRef    = useRef<'heckman' | 'mcfadden'>('heckman');
  const personasRef = useRef<Persona[]>(generatePersonas(H_DEF.N, H_DEF.sesgoBias));

  // ── sincroniza refs con estado
  useEffect(() => {
    hRef.current = { sesgoBias, mostrarCorr, N: H_DEF.N };
    personasRef.current = generatePersonas(H_DEF.N, sesgoBias);
  }, [sesgoBias, mostrarCorr]);
  useEffect(() => { mRef.current = { costoMult, tiempoMult }; }, [costoMult, tiempoMult]);
  useEffect(() => { modoRef.current = modo; }, [modo]);

  // ── bucle de animación
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
    let frame = 0;

    function drawHeckman() {
      if (!ctx) return;
      const hp     = hRef.current;
      const ps     = personasRef.current;

      // fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // zona del scatter
      const leftW  = W * 0.56;
      const rightW = W - leftW;
      const scLeft  = PAD;
      const scRight = leftW - PAD * 0.5;
      const scTop   = PAD + 20;
      const scBot   = H - PAD - 10;
      const scW = scRight - scLeft;
      const scH = scBot - scTop;

      // eje Y: salario 0-25k MXN
      const wMin = 0, wMax = 25;
      // eje X: educación 6-22 años
      const eMin = 6, eMax = 22;
      const toX = (e: number) => scLeft + ((e - eMin) / (eMax - eMin)) * scW;
      const toY = (w: number) => scBot - ((w - wMin) / (wMax - wMin)) * scH;

      // ejes
      ctx.strokeStyle = '#1E293B'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(scLeft, scTop); ctx.lineTo(scLeft, scBot); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(scLeft, scBot); ctx.lineTo(scRight, scBot); ctx.stroke();
      // ticks eje X
      ctx.fillStyle = '#475569'; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'center';
      for (let e = 6; e <= 22; e += 4) {
        const x = toX(e);
        ctx.beginPath(); ctx.moveTo(x, scBot); ctx.lineTo(x, scBot + 4); ctx.stroke();
        ctx.fillText(`${e}`, x, scBot + 14);
      }
      // ticks eje Y
      ctx.textAlign = 'right';
      for (let w = 0; w <= 24; w += 6) {
        const y = toY(w);
        ctx.beginPath(); ctx.moveTo(scLeft - 3, y); ctx.lineTo(scLeft, y); ctx.stroke();
        ctx.fillText(`$${w}k`, scLeft - 6, y + 4);
      }
      // etiquetas
      ctx.fillStyle = '#64748B'; ctx.font = '10px ui-sans-serif, system-ui'; ctx.textAlign = 'center';
      ctx.fillText('años de educación', scLeft + scW / 2, scBot + 28);
      ctx.save(); ctx.translate(PAD - 18, scTop + scH / 2); ctx.rotate(-Math.PI / 2);
      ctx.fillText('salario (miles MXN/mes)', 0, 0);
      ctx.restore();
      // título
      ctx.fillStyle = '#94A3B8'; ctx.font = 'bold 12px ui-sans-serif, system-ui'; ctx.textAlign = 'left';
      ctx.fillText('Sesgo de selección · Heckman', scLeft, scTop - 8);

      // puntos
      const sel   = ps.filter(p => p.sel);
      const unsel = ps.filter(p => !p.sel);
      // no seleccionados (fuera de muestra) — gris muy tenue
      unsel.forEach(p => {
        ctx.beginPath();
        ctx.arc(toX(p.edu), toY(p.wTrue), 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100,116,139,0.25)';
        ctx.fill();
      });
      // seleccionados (en muestra) — naranja/amarillo
      sel.forEach(p => {
        ctx.beginPath();
        ctx.arc(toX(p.edu), toY(hp.mostrarCorr ? p.wTrue : p.wBias), 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#FDB813';
        ctx.fill();
      });

      // líneas de regresión
      const olsBias = ols(ps, true,  false);  // sesgo: solo sel, sin corrección
      const olsReal = ols(ps, false, true);   // real: todos, corregido
      const drawLine = (slope: number, intercept: number, color: string, dash: number[]) => {
        ctx.beginPath();
        ctx.strokeStyle = color; ctx.lineWidth = 2.2;
        ctx.setLineDash(dash);
        for (let i = 0; i <= 40; i++) {
          const e = eMin + (i / 40) * (eMax - eMin);
          const w = intercept + slope * e;
          const x = toX(e), y = toY(w);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke(); ctx.setLineDash([]);
      };
      drawLine(olsBias.slope, olsBias.intercept, '#EF4444', [6, 4]);    // sesgado
      drawLine(olsReal.slope, olsReal.intercept, '#34D399', []);         // real

      // leyenda regresión
      const ly = scTop + 4;
      ctx.fillStyle = '#EF4444'; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'left';
      ctx.fillText('── sesgo de selección', scLeft + 4, ly + 12);
      ctx.fillStyle = '#34D399';
      ctx.fillText('── Heckman corregido', scLeft + 4, ly + 26);

      // stats
      const nSel = sel.length;
      const retBias = olsBias.slope;
      const retReal = olsReal.slope;
      if (frame % 8 === 0) {
        setStatsH({
          sesgado: retBias,
          real:    retReal,
          pctSel:  nSel / ps.length,
          N:       ps.length,
        });
      }

      // ── Panel derecho: visualización IMR ────────────────────────────────────
      const rx = leftW + 8;
      const rw = rightW - 16;
      const ry = scTop;
      const rh = scH;

      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(rx, ry - 14, rw, rh + 14, 8);
      ctx.fill();

      // IMR curva: λ(z) = φ(z)/Φ(z) para z en [-2.5, 2]
      ctx.save();
      ctx.rect(rx, ry - 14, rw, rh + 14);
      ctx.clip();
      const imrXmin = -2.5, imrXmax = 2.0;
      const imrYmax = 3.5;
      const toImrX = (z: number) => rx + ((z - imrXmin) / (imrXmax - imrXmin)) * rw;
      const toImrY = (v: number) => ry + rh - (v / imrYmax) * rh;
      ctx.beginPath();
      ctx.strokeStyle = '#A78BFA'; ctx.lineWidth = 2.5;
      for (let i = 0; i <= 80; i++) {
        const z = imrXmin + (i / 80) * (imrXmax - imrXmin);
        const imr = invMillsRatio(z);
        const x = toImrX(z), y = toImrY(Math.min(imr, imrYmax));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // ejes IMR
      ctx.strokeStyle = '#1E293B'; ctx.lineWidth = 1;
      const yAxis = toImrY(0);
      ctx.beginPath(); ctx.moveTo(rx, yAxis); ctx.lineTo(rx + rw, yAxis); ctx.stroke();
      const xAxis0 = toImrX(0);
      ctx.beginPath(); ctx.moveTo(xAxis0, ry); ctx.lineTo(xAxis0, ry + rh); ctx.stroke();
      // etiquetas IMR
      ctx.fillStyle = '#A78BFA'; ctx.font = 'bold 10px ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillText('λ(z) = φ(z) / Φ(z)', rx + rw / 2, ry - 3);
      ctx.fillStyle = '#64748B'; ctx.font = '9px ui-monospace, monospace';
      ctx.fillText('Razón Inversa de Mills', rx + rw / 2, ry + rh + 10);
      ctx.fillStyle = '#475569'; ctx.textAlign = 'left';
      ctx.fillText('z →', rx + rw - 22, yAxis - 3);
      // flecha: mayor z = mayor selección = menor λ = menor sesgo
      ctx.fillStyle = '#64748B'; ctx.font = '9px ui-sans-serif, system-ui'; ctx.textAlign = 'right';
      ctx.fillText('+ sesgo', rx + rw - 2, toImrY(2.8));
      ctx.fillText('− sesgo', rx + rw - 2, toImrY(0.4));
      ctx.restore();
    }

    function drawMcFadden() {
      if (!ctx) return;
      const mp = mRef.current;
      const probs = logitProbs(MODES, mp.costoMult, mp.tiempoMult);

      // fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── Panel izquierdo: barras de probabilidad ──────────────────────────
      const barLeft  = PAD + 10;
      const barBot   = H - PAD - 20;
      const barTop   = PAD + 30;
      const barH     = barBot - barTop;
      const barW     = 90;
      const barGap   = 50;
      const totalW   = MODES.length * barW + (MODES.length - 1) * barGap;
      const barStartX = barLeft;

      // título
      ctx.fillStyle = '#94A3B8'; ctx.font = 'bold 12px ui-sans-serif, system-ui'; ctx.textAlign = 'left';
      ctx.fillText('Logit multinomial · McFadden', barStartX, barTop - 14);
      ctx.fillStyle = '#475569'; ctx.font = '10px ui-sans-serif, system-ui';
      ctx.fillText('P(j) = exp(Vⱼ) / Σₖ exp(Vₖ)', barStartX, barTop - 2);

      // eje Y
      ctx.strokeStyle = '#1E293B'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(barLeft - 4, barTop); ctx.lineTo(barLeft - 4, barBot); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(barLeft - 4, barBot); ctx.lineTo(barLeft + totalW + 20, barBot); ctx.stroke();
      // ticks Y
      ctx.fillStyle = '#475569'; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'right';
      for (let p = 0; p <= 100; p += 20) {
        const y = barBot - (p / 100) * barH;
        ctx.beginPath(); ctx.strokeStyle = '#1E293B';
        ctx.moveTo(barLeft - 8, y); ctx.lineTo(barLeft + totalW + 10, y);
        ctx.stroke();
        ctx.fillText(`${p}%`, barLeft - 10, y + 4);
      }

      // barras
      MODES.forEach((m, i) => {
        const x  = barStartX + i * (barW + barGap);
        const ph = probs[i] * barH;
        const y  = barBot - ph;

        // sombra/glow
        ctx.save();
        ctx.shadowColor = m.color;
        ctx.shadowBlur  = 18;
        const grad = ctx.createLinearGradient(x, y, x, barBot);
        grad.addColorStop(0, m.color);
        grad.addColorStop(1, m.color + '44');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, ph, [4, 4, 0, 0]);
        ctx.fill();
        ctx.restore();

        // etiqueta modo
        ctx.fillStyle = m.color; ctx.font = 'bold 13px ui-sans-serif, system-ui'; ctx.textAlign = 'center';
        ctx.fillText(m.label, x + barW / 2, barBot + 18);
        // porcentaje
        ctx.fillStyle = '#E2E8F0'; ctx.font = 'bold 16px ui-monospace, monospace';
        ctx.fillText(`${(probs[i] * 100).toFixed(1)}%`, x + barW / 2, Math.max(y - 8, barTop + 14));
        // costo y tiempo
        const cost  = (MODES[i].baseCost * mp.costoMult).toFixed(0);
        const ttime = (MODES[i].baseTime * mp.tiempoMult).toFixed(0);
        ctx.fillStyle = '#64748B'; ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(`$${cost} · ${ttime}min`, x + barW / 2, barBot + 30);
      });

      // ── Panel derecho: utilidades y elasticidades ────────────────────────
      const rx  = barLeft + totalW + barGap * 1.5;
      const rw  = W - rx - PAD;
      const ry  = barTop;
      const rh  = barH;

      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(rx - 8, ry - 20, rw + 8, rh + 30, 8);
      ctx.fill();

      ctx.fillStyle = '#94A3B8'; ctx.font = 'bold 11px ui-sans-serif, system-ui'; ctx.textAlign = 'left';
      ctx.fillText('Utilidades V(j)', rx, ry - 8);
      ctx.fillStyle = '#475569'; ctx.font = '9px ui-monospace, monospace';
      ctx.fillText('Vⱼ = β_costo·Cⱼ + β_tiempo·Tⱼ', rx, ry + 4);

      const Vs = MODES.map(m =>
        BETA_COSTO * m.baseCost * mp.costoMult + BETA_TIEMPO * m.baseTime * mp.tiempoMult
      );
      const vMin = Math.min(...Vs);
      const vMax = Math.max(...Vs);
      const vRange = Math.max(vMax - vMin, 0.1);

      MODES.forEach((m, i) => {
        const barY = ry + 20 + i * 42;
        const fillW = Math.max(2, ((Vs[i] - vMin) / vRange) * (rw - 10));
        // barra de utilidad (negativa = gris, relativo al máximo)
        ctx.fillStyle = '#1E293B';
        ctx.beginPath(); ctx.roundRect(rx, barY, rw - 10, 22, 4); ctx.fill();
        ctx.fillStyle = m.color + 'BB';
        ctx.beginPath(); ctx.roundRect(rx, barY, fillW, 22, 4); ctx.fill();
        ctx.fillStyle = m.color; ctx.font = 'bold 11px ui-monospace, monospace'; ctx.textAlign = 'left';
        ctx.fillText(`${m.label}`, rx + 4, barY + 15);
        ctx.fillStyle = '#E2E8F0'; ctx.textAlign = 'right';
        ctx.fillText(`V = ${Vs[i].toFixed(2)}`, rx + rw - 12, barY + 15);
        // elasticidad propia: ε_jj = β_costo · Cj · (1 − Pj)
        const elas = (BETA_COSTO * MODES[i].baseCost * mp.costoMult * (1 - probs[i])).toFixed(2);
        ctx.fillStyle = '#64748B'; ctx.font = '9px ui-monospace, monospace'; ctx.textAlign = 'right';
        ctx.fillText(`ε_jj = ${elas}`, rx + rw - 12, barY + 27);
      });

      // nota de fórmula al pie
      ctx.fillStyle = '#334155'; ctx.font = '9px ui-monospace, monospace'; ctx.textAlign = 'left';
      ctx.fillText(`β_costo=${BETA_COSTO}  β_tiempo=${BETA_TIEMPO}`, rx, ry + rh + 8);

      if (frame % 8 === 0) setStatsM([...probs]);
    }

    function loop() {
      if (modoRef.current === 'heckman') drawHeckman();
      else drawMcFadden();
      frame++;
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Insight dinámico ──────────────────────────────────────────────────────
  const insightHeck =
    mostrarCorr
      ? `Corrección activa: el retorno REAL por año de edu ≈ $${(HECK.betaEdu).toFixed(2)}k/mes. Sin corregir, el sesgo lo inflaba. La Razón Inversa de Mills captura cuánto "favorecida" está la muestra observada.`
      : `Solo ves a los ${(statsH.pctSel * 100).toFixed(0)}% que ENTRAN al mercado (puntos naranjas). La línea roja sobreestima el retorno educativo en ≈${((statsH.sesgado - HECK.betaEdu)).toFixed(2)}k/año. Activa la corrección de Heckman para ver el real.`;

  const winnerM = MODES[statsM.indexOf(Math.max(...statsM))];
  const insightMcf =
    `Con los precios actuales, ${winnerM.label} es la opción más elegida (${(Math.max(...statsM) * 100).toFixed(1)}%). Sube el costo del metro para ver cómo se redistribuye el tráfico — el logit predice el viraje exacto, no adivina.`;

  return (
    <div className="w-full">
      {/* Tabs de modo */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setModo('heckman')}
          className={`px-4 py-2 text-[12px] font-mono rounded-lg border transition ${
            modo === 'heckman'
              ? 'border-[#A78BFA]/60 bg-[#A78BFA]/15 text-[#A78BFA]'
              : 'border-[#1E293B] text-[#475569] hover:text-[#CBD5E1]'
          }`}
        >
          ① Sesgo de selección · Heckman
        </button>
        <button
          onClick={() => setModo('mcfadden')}
          className={`px-4 py-2 text-[12px] font-mono rounded-lg border transition ${
            modo === 'mcfadden'
              ? 'border-[#4FC3F7]/60 bg-[#4FC3F7]/15 text-[#4FC3F7]'
              : 'border-[#1E293B] text-[#475569] hover:text-[#CBD5E1]'
          }`}
        >
          ② Elección discreta · McFadden
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        {/* Canvas */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Stats */}
          {modo === 'heckman' ? (
            <div className="grid grid-cols-3 gap-3">
              <Stat
                label="retorno sesgado"
                value={`+$${statsH.sesgado.toFixed(2)}k/año`}
                accent="#EF4444"
              />
              <Stat
                label="retorno real (Heckman)"
                value={`+$${HECK.betaEdu.toFixed(2)}k/año`}
                accent="#34D399"
              />
              <Stat
                label="% en muestra"
                value={`${(statsH.pctSel * 100).toFixed(0)}%`}
                accent="#A78BFA"
              />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {MODES.map((m, i) => (
                <Stat
                  key={m.label}
                  label={`P(${m.label})`}
                  value={`${(statsM[i] * 100).toFixed(1)}%`}
                  accent={m.color}
                />
              ))}
            </div>
          )}

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#A78BFA] font-mono mb-2">
              ✦ ¿Qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">
              {modo === 'heckman' ? insightHeck : insightMcf}
            </p>
          </div>
        </div>

        {/* Panel de controles */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          {modo === 'heckman' ? (
            <>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
                ⚙ Sesgo de selección
              </div>
              <Slider
                label="Fuerza del sesgo de entrada"
                value={sesgoBias}
                min={0}
                max={1}
                step={0.05}
                onChange={setSesgoBias}
                fmt={v => v < 0.3 ? 'leve' : v < 0.7 ? 'moderado' : 'severo'}
                hint="Qué tan fuerte es la correlación entre quién entra al mercado y quién gana más de por sí."
              />
              <div className="space-y-2">
                <button
                  onClick={() => setMostrarCorr(v => !v)}
                  className={`w-full px-3 py-2 text-[12px] font-mono rounded-lg border transition ${
                    mostrarCorr
                      ? 'border-[#34D399]/50 bg-[#34D399]/10 text-[#34D399]'
                      : 'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]'
                  }`}
                >
                  {mostrarCorr ? '✓ corrección Heckman: ON' : '✗ solo datos sesgados'}
                </button>
                <div className="text-[10px] text-[#475569] leading-snug">
                  Activa para ver los puntos corregidos con la Razón Inversa de Mills (λ).
                </div>
              </div>
              <div className="text-[10px] font-mono text-[#334155] border-t border-[#1E293B] pt-3 leading-relaxed">
                E[w|sel] = β₀ + β_edu·edu + σ·λ(z)<br />
                λ(z) = φ(z)/Φ(z) · (Razón Inv. Mills)<br />
                Heckman (1979) · Econometrica
              </div>
            </>
          ) : (
            <>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
                ⚙ Precios y tiempos de viaje
              </div>
              <Slider
                label="Multiplicador de costos"
                value={costoMult}
                min={0.4}
                max={3.0}
                step={0.05}
                onChange={setCostoMult}
                fmt={v => `×${v.toFixed(2)}`}
                hint="Sube todos los costos proporcialmente. Metro: $5→$15, Carro: $80→$240, Uber: $60→$180."
              />
              <Slider
                label="Multiplicador de tiempo"
                value={tiempoMult}
                min={0.5}
                max={2.5}
                step={0.05}
                onChange={setTiempoMult}
                fmt={v => `×${v.toFixed(2)}`}
                hint="Simula tráfico pesado o vialidades rápidas para todos los modos."
              />
              <button
                onClick={() => { setCostoMult(1.0); setTiempoMult(1.0); }}
                className="w-full px-3 py-1.5 text-[12px] font-mono rounded border border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1] transition"
              >
                ↺ restablecer valores base
              </button>
              <div className="text-[10px] font-mono text-[#334155] border-t border-[#1E293B] pt-3 leading-relaxed">
                P(j) = exp(Vⱼ) / Σₖ exp(Vₖ)<br />
                Vⱼ = {BETA_COSTO}·Cⱼ + {BETA_TIEMPO}·Tⱼ<br />
                McFadden (1974) · BART San Francisco
              </div>
            </>
          )}
        </div>
      </div>

      {/* Taquero footnote */}
      <div className="mt-4 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#64748B] font-mono mb-2">
          ✦ para el taquero
        </div>
        <p className="text-[12px] text-[#64748B] leading-relaxed">
          <span className="text-[#A78BFA]">Heckman:</span> preguntas a tus clientes satisfechos si recomendarían tu taquería — todos dicen sí, porque los insatisfechos ya se fueron. Ese hueco invisible es el sesgo de selección. La corrección te obliga a preguntar también a quien NO volvió. ·{' '}
          <span className="text-[#4FC3F7]">McFadden:</span> el Metro CDMX necesita saber cuántos pasajeros perderá si sube el precio $2. McFadden inventó el logit exactamente para eso — con datos de BART San Francisco. Hoy toda la infraestructura urbana de México usa alguna variante de este modelo.
        </p>
      </div>
    </div>
  );
}
