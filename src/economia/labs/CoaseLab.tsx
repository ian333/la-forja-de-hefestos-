/**
 * CoaseLab — laboratorio del premio 1991 (Ronald Coase).
 *
 * EL CLICK: Las empresas existen porque coordinar en el mercado CUESTA.
 * Coase llamó a ese costo invisible "costo de transacción".
 * Cuando ese costo supera contratar gente fija que obedezca, nace la empresa.
 * El teorema de Coase dice: si los derechos son claros y negociar es gratis,
 * la gente resuelve sola cualquier problema sin necesidad del Estado.
 *
 * Física REAL y exacta:
 *   Costo total de mercado (n actividades, costo por transacción τ):
 *     C_mkt(n, τ) = n · τ    ← negocias cada vez
 *   Costo total de firma (staff fixo, overhead F, monitoreo por actividad m):
 *     C_firm(n, F, m) = F + n · m   ← pagas fijo + gestión
 *   Umbral (break-even, donde conviene tener empleado):
 *     n* = F / (τ − m)    [solo si τ > m]
 *
 *   Teorema de Coase: si τ→0 y derechos de propiedad claros, las partes
 *   llegan solas al Óptimo de Pareto independientemente de quién tenga el derecho.
 *   Simulamos esto con una externalidad bilateral (vecino ruidoso):
 *     Daño al vecino A: dA (si B produce ruido)
 *     Ganancia de B produciendo: gB
 *     Óptimo social: B produce si gB > dA
 *   Si τ=0: independientemente de quién tiene el derecho legal, se llega ahí.
 *   Si τ>0: a veces el acuerdo no se hace aunque sería eficiente.
 *
 * Dos modos:
 *   1. Hacer vs Comprar — ajusta τ, F, m y ve el umbral n* en tiempo real.
 *   2. Teorema de Coase — dos partes negocian; ajusta τ y ve si el acuerdo emerge.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/* ══════════════════════════════════════════════════════════════
   Constantes de layout
══════════════════════════════════════════════════════════════ */
const W = 820;
const H = 370;
const PAD_L = 64;
const PAD_R = 36;
const PAD_T = 48;
const PAD_B = 52;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

/* ══════════════════════════════════════════════════════════════
   Modelos económicos
══════════════════════════════════════════════════════════════ */

/** Costo de coordinar n actividades vía mercado (precio por transacción). */
function costMkt(n: number, tau: number): number {
  return n * tau;
}

/** Costo de coordinar n actividades dentro de la empresa. */
function costFirm(n: number, F: number, m: number): number {
  return F + n * m;
}

/** Umbral donde mercado y empresa cuestan igual. */
function breakEven(F: number, tau: number, m: number): number {
  if (tau <= m) return Infinity;
  return F / (tau - m);
}

/* ══════════════════════════════════════════════════════════════
   Subcomponentes reutilizables (copiados del estilo SamuelsonTazon)
══════════════════════════════════════════════════════════════ */
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[19px] font-bold font-mono" style={{ color: accent }}>{value}</div>
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

/* ══════════════════════════════════════════════════════════════
   Modo 1: Hacer vs Comprar (curvas de costo)
══════════════════════════════════════════════════════════════ */
interface MakeVsBuyParams {
  tau: number;   // costo por transacción en mercado ($)
  F: number;     // costo fijo de tener empleado ($)
  m: number;     // costo de monitorear cada actividad dentro ($)
}

function MakeVsBuyCanvas({ params }: { params: MakeVsBuyParams }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<MakeVsBuyParams>(params);

  useEffect(() => { paramsRef.current = params; }, [params]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    let raf = 0;

    function draw() {
      if (!ctx) return;
      const { tau, F, m } = paramsRef.current;

      /* fondo */
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17'); bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      const N_MAX = 30;
      const C_MAX = Math.max(costMkt(N_MAX, tau), costFirm(N_MAX, F, m), F * 1.2, 10);

      const xOf = (n: number) => PAD_L + (n / N_MAX) * PLOT_W;
      const yOf = (c: number) => PAD_T + PLOT_H - (c / C_MAX) * PLOT_H;

      /* grid */
      ctx.strokeStyle = '#1E293B'; ctx.lineWidth = 1;
      for (let i = 0; i <= 5; i++) {
        const y = PAD_T + (i / 5) * PLOT_H;
        ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(PAD_L + PLOT_W, y); ctx.stroke();
        const val = C_MAX * (1 - i / 5);
        ctx.fillStyle = '#475569'; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'right';
        ctx.fillText(`$${val.toFixed(0)}`, PAD_L - 6, y + 4);
      }
      for (let i = 0; i <= 6; i++) {
        const x = PAD_L + (i / 6) * PLOT_W;
        ctx.beginPath(); ctx.moveTo(x, PAD_T); ctx.lineTo(x, PAD_T + PLOT_H); ctx.stroke();
        ctx.fillStyle = '#475569'; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'center';
        ctx.fillText(`${Math.round((i / 6) * N_MAX)}`, x, PAD_T + PLOT_H + 16);
      }

      /* ejes */
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(PAD_L, PAD_T); ctx.lineTo(PAD_L, PAD_T + PLOT_H + 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PAD_L - 2, PAD_T + PLOT_H); ctx.lineTo(PAD_L + PLOT_W, PAD_T + PLOT_H); ctx.stroke();

      /* etiquetas de ejes */
      ctx.fillStyle = '#64748B'; ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('actividades coordinadas (n)', PAD_L + PLOT_W / 2, H - 8);
      ctx.save(); ctx.translate(14, PAD_T + PLOT_H / 2); ctx.rotate(-Math.PI / 2);
      ctx.fillText('costo total ($)', 0, 0); ctx.restore();

      /* curva mercado: C_mkt = n * tau  → línea desde origen */
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const n = (i / 120) * N_MAX;
        const c = costMkt(n, tau);
        const x = xOf(n), y = yOf(c);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#F472B6'; ctx.lineWidth = 2.5; ctx.setLineDash([]); ctx.stroke();

      /* curva firma: C_firm = F + n * m  → línea con intercepto F */
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const n = (i / 120) * N_MAX;
        const c = costFirm(n, F, m);
        const x = xOf(n), y = yOf(c);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#4FC3F7'; ctx.lineWidth = 2.5; ctx.stroke();

      /* punto de cruce (n*) */
      const nStar = breakEven(F, tau, m);
      if (nStar > 0 && nStar < N_MAX) {
        const xStar = xOf(nStar);
        const cStar = costMkt(nStar, tau);
        const yStar = yOf(cStar);

        /* línea vertical punteada */
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = '#FDB813'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(xStar, PAD_T); ctx.lineTo(xStar, PAD_T + PLOT_H); ctx.stroke();
        ctx.setLineDash([]);

        /* punto */
        ctx.save();
        ctx.shadowColor = '#FDB813'; ctx.shadowBlur = 14;
        ctx.fillStyle = '#FDB813';
        ctx.beginPath(); ctx.arc(xStar, yStar, 7, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        /* etiqueta n* */
        ctx.fillStyle = '#FDB813'; ctx.font = 'bold 11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`n*=${nStar.toFixed(1)}`, xStar, PAD_T - 10);
      } else if (nStar <= 0 || tau <= m) {
        ctx.fillStyle = '#F472B6'; ctx.font = 'bold 11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('siempre mejor contratar empleado', PAD_L + PLOT_W / 2, PAD_T - 10);
      } else {
        ctx.fillStyle = '#4FC3F7'; ctx.font = 'bold 11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('siempre mejor usar el mercado', PAD_L + PLOT_W / 2, PAD_T - 10);
      }

      /* sombreados: zonas "usa mercado" vs "crea empresa" */
      if (nStar > 0 && nStar < N_MAX && tau > m) {
        const xStar = xOf(nStar);
        /* zona izquierda: mercado gana */
        ctx.fillStyle = 'rgba(244,114,182,0.07)';
        ctx.fillRect(PAD_L, PAD_T, xStar - PAD_L, PLOT_H);
        /* zona derecha: empresa gana */
        ctx.fillStyle = 'rgba(79,195,247,0.07)';
        ctx.fillRect(xStar, PAD_T, PAD_L + PLOT_W - xStar, PLOT_H);
      }

      /* leyendas */
      const lx = PAD_L + PLOT_W - 10;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#F472B6'; ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.fillText('▶ mercado (C = n·τ)', lx, PAD_T + 18);
      ctx.fillStyle = '#4FC3F7';
      ctx.fillText('▶ empresa (C = F + n·m)', lx, PAD_T + 34);

      /* texto inferior */
      const nStarLabel = (nStar > 0 && nStar < N_MAX)
        ? `Umbral: a partir de ${nStar.toFixed(1)} actividades, conviene tener empleado fijo.`
        : nStar >= N_MAX
          ? 'El mercado siempre es más barato con estos parámetros.'
          : 'El empleado fijo siempre es más barato con estos parámetros.';
      ctx.fillStyle = '#94A3B8'; ctx.font = '11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(nStarLabel, PAD_L + PLOT_W / 2, H - 14);
    }

    function loop() { draw(); raf = requestAnimationFrame(loop); }
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
      style={{ width: W, height: H }}
    />
  );
}

/* ══════════════════════════════════════════════════════════════
   Modo 2: Teorema de Coase (negociación bilateral)
══════════════════════════════════════════════════════════════ */
interface CoaseTheoremParams {
  /** Daño que el ruido de B le causa a A (pesos). */
  damageA: number;
  /** Ganancia de B si produce con ruido (pesos). */
  gainB: number;
  /** Costo de transacción de negociar (pesos). */
  tau: number;
  /** Quién tiene el derecho: 'A' (A tiene derecho al silencio) o 'B' (B tiene derecho a producir). */
  rightHolder: 'A' | 'B';
}

/** Resultado de la negociación de Coase. */
interface NegotiationResult {
  /** ¿Produce B con ruido? */
  produces: boolean;
  /** ¿Hay acuerdo (negociación exitosa)? */
  deal: boolean;
  /** Ganancias netas de A. */
  netA: number;
  /** Ganancias netas de B. */
  netB: number;
  /** ¿Es el óptimo social? (B produce ssi gainB > damageA) */
  socialOptimum: boolean;
  description: string;
}

function coaseNegotiation(p: CoaseTheoremParams): NegotiationResult {
  const { damageA, gainB, tau, rightHolder } = p;
  const socialBproduces = gainB > damageA;   // óptimo de Pareto

  if (rightHolder === 'A') {
    // A tiene derecho al silencio. B necesita comprarle ese derecho.
    // B pagaría hasta gainB por producir. A pediría al menos damageA.
    // Hay acuerdo si gainB - damageA > 2*tau (excedente > costos de negociar por ambas partes)
    const surplus = gainB - damageA;
    if (surplus > 2 * tau) {
      // Acuerdo: B le paga a A, ambos ganan.
      const payment = damageA + surplus / 2; // pago de Nash (divide el excedente)
      return {
        produces: true, deal: true,
        netA: payment - tau,
        netB: gainB - payment - tau,
        socialOptimum: socialBproduces,
        description: `B le paga $${payment.toFixed(0)} a A por el derecho a producir. Ambos ganan con el trato.`,
      };
    } else if (surplus <= 0) {
      // No vale producir ni socialmente: A bloquea, correcto.
      return {
        produces: false, deal: true,
        netA: 0, netB: 0,
        socialOptimum: !socialBproduces,
        description: 'A bloquea legalmente la producción. Es el óptimo social: gainB < damageA.',
      };
    } else {
      // El excedente existe pero los costos de transacción se comen la ganancia → no hay trato.
      return {
        produces: false, deal: false,
        netA: -tau, netB: -tau,
        socialOptimum: false,
        description: `El trato sería eficiente pero el costo de negociar ($${(2 * tau).toFixed(0)}) supera el excedente ($${surplus.toFixed(0)}). Fallo de mercado.`,
      };
    }
  } else {
    // rightHolder === 'B': B tiene derecho a producir con ruido.
    // A necesita pagarle a B para que pare.
    const surplus = gainB - damageA;
    if (surplus < -2 * tau) {
      // A pagaría hasta damageA para que B pare. B aceptaría si ≥ gainB.
      const payment = gainB + (damageA - gainB) / 2; // divide excedente de parar
      return {
        produces: false, deal: true,
        netA: -(payment + tau),
        netB: payment - tau,
        socialOptimum: !socialBproduces,
        description: `A le paga $${payment.toFixed(0)} a B para que deje de producir. Óptimo social alcanzado.`,
      };
    } else if (surplus >= 0) {
      // B produce sin necesidad de compensar a A: es el óptimo.
      return {
        produces: true, deal: true,
        netA: -damageA, netB: gainB,
        socialOptimum: socialBproduces,
        description: 'B produce legalmente. Es el óptimo social: gainB ≥ damageA.',
      };
    } else {
      // B debería parar pero el costo de negociar impide el acuerdo.
      return {
        produces: true, deal: false,
        netA: -damageA - tau, netB: gainB - tau,
        socialOptimum: false,
        description: `B sigue produciendo aunque el óptimo sería parar. El costo de negociar ($${(2 * tau).toFixed(0)}) impide el acuerdo. Fallo de mercado.`,
      };
    }
  }
}

function CoaseTheoremCanvas({ params }: { params: CoaseTheoremParams }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<CoaseTheoremParams>(params);

  useEffect(() => { paramsRef.current = params; }, [params]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let t = 0;

    function draw() {
      if (!ctx) return;
      const p = paramsRef.current;
      const result = coaseNegotiation(p);
      t += 0.03;

      /* fondo */
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17'); bg.addColorStop(1, '#07090F');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      /* ── Diagrama de actores ── */
      // Posiciones de los dos actores
      const aX = 160, bX = W - 160;
      const actorY = H / 2 - 20;
      const BOX_W = 140, BOX_H = 80;

      /* Actor A */
      const aColor = result.netA >= 0 ? '#34D399' : '#EF4444';
      ctx.strokeStyle = aColor; ctx.lineWidth = 2;
      ctx.fillStyle = `${aColor}18`;
      ctx.beginPath();
      ctx.roundRect(aX - BOX_W / 2, actorY - BOX_H / 2, BOX_W, BOX_H, 10);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = aColor; ctx.font = 'bold 13px ui-sans-serif, system-ui'; ctx.textAlign = 'center';
      ctx.fillText('Vecino A', aX, actorY - 18);
      ctx.fillStyle = '#94A3B8'; ctx.font = '11px ui-monospace, monospace';
      ctx.fillText(`daño recibido: $${p.damageA.toFixed(0)}`, aX, actorY + 2);
      ctx.fillStyle = aColor; ctx.font = 'bold 12px ui-monospace, monospace';
      const netALabel = result.netA >= 0 ? `+$${result.netA.toFixed(0)}` : `-$${Math.abs(result.netA).toFixed(0)}`;
      ctx.fillText(`neto: ${netALabel}`, aX, actorY + 20);

      /* Actor B */
      const bColor = result.netB >= 0 ? '#34D399' : '#EF4444';
      ctx.strokeStyle = bColor; ctx.lineWidth = 2;
      ctx.fillStyle = `${bColor}18`;
      ctx.beginPath();
      ctx.roundRect(bX - BOX_W / 2, actorY - BOX_H / 2, BOX_W, BOX_H, 10);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = bColor; ctx.font = 'bold 13px ui-sans-serif, system-ui'; ctx.textAlign = 'center';
      ctx.fillText('Taller B', bX, actorY - 18);
      ctx.fillStyle = '#94A3B8'; ctx.font = '11px ui-monospace, monospace';
      ctx.fillText(`ganancia: $${p.gainB.toFixed(0)}`, bX, actorY + 2);
      ctx.fillStyle = bColor; ctx.font = 'bold 12px ui-monospace, monospace';
      const netBLabel = result.netB >= 0 ? `+$${result.netB.toFixed(0)}` : `-$${Math.abs(result.netB).toFixed(0)}`;
      ctx.fillText(`neto: ${netBLabel}`, bX, actorY + 20);

      /* Flecha central de negociación */
      const midX = W / 2;
      const arrowY = actorY;

      if (result.deal && p.tau < 50) {
        /* flecha animada (pulso) */
        const pulse = 0.5 + 0.5 * Math.sin(t * 2);
        ctx.save();
        ctx.shadowColor = '#FDB813'; ctx.shadowBlur = 8 + pulse * 8;
        ctx.strokeStyle = `rgba(253,184,19,${0.6 + pulse * 0.4})`;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 5]);
        ctx.lineDashOffset = -t * 8;
        ctx.beginPath();
        ctx.moveTo(aX + BOX_W / 2, arrowY);
        ctx.lineTo(bX - BOX_W / 2, arrowY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        /* etiqueta en la flecha */
        ctx.fillStyle = '#FDB813'; ctx.font = 'bold 11px ui-monospace, monospace'; ctx.textAlign = 'center';
        ctx.fillText('negociación', midX, arrowY - 12);
        ctx.fillStyle = '#94A3B8'; ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(`τ = $${p.tau.toFixed(0)} c/u`, midX, arrowY + 5);
      } else if (!result.deal) {
        /* X en rojo: negociación bloqueada */
        ctx.fillStyle = '#EF4444'; ctx.font = 'bold 22px ui-sans-serif, system-ui'; ctx.textAlign = 'center';
        ctx.fillText('✕', midX, arrowY + 8);
        ctx.fillStyle = '#EF4444'; ctx.font = 'bold 11px ui-monospace, monospace';
        ctx.fillText('τ demasiado alto', midX, arrowY + 26);
        /* línea punteada roja */
        ctx.strokeStyle = '#EF444455'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(aX + BOX_W / 2, arrowY);
        ctx.lineTo(bX - BOX_W / 2, arrowY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      /* Badge del derecho de propiedad */
      ctx.fillStyle = p.rightHolder === 'A' ? '#4FC3F7' : '#A78BFA';
      ctx.font = 'bold 11px ui-monospace, monospace'; ctx.textAlign = 'center';
      const rightLabel = p.rightHolder === 'A' ? '⚖ derecho: A (silencio)' : '⚖ derecho: B (producción)';
      ctx.fillText(rightLabel, midX, actorY - 36);

      /* Badge óptimo social */
      const optColor = result.socialOptimum ? '#34D399' : '#EF4444';
      const optLabel = result.socialOptimum
        ? `✓ ÓPTIMO SOCIAL alcanzado (B ${result.produces ? 'produce' : 'no produce'})`
        : `✕ INEFICIENCIA (B ${result.produces ? 'produce' : 'no produce'} pero no debería)`;
      ctx.fillStyle = `${optColor}22`;
      ctx.fillRect(PAD_L, PAD_T + PLOT_H + 10, PLOT_W + PAD_L - 20, 26);
      ctx.fillStyle = optColor; ctx.font = 'bold 12px ui-sans-serif, system-ui'; ctx.textAlign = 'center';
      ctx.fillText(optLabel, W / 2, PAD_T + PLOT_H + 27);

      /* Descripción del resultado (bottom) */
      ctx.fillStyle = '#64748B'; ctx.font = '11px ui-sans-serif, system-ui'; ctx.textAlign = 'center';
      /* wrap manual corto */
      const words = result.description.split(' ');
      let line = ''; let lineY = H - 36;
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (ctx.measureText(test).width > PLOT_W && line) {
          ctx.fillStyle = '#64748B'; ctx.fillText(line, W / 2, lineY);
          line = w; lineY += 14;
        } else { line = test; }
      }
      if (line) ctx.fillText(line, W / 2, lineY);
    }

    function loop() { draw(); raf = requestAnimationFrame(loop); }
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
      style={{ width: W, height: H }}
    />
  );
}

/* ══════════════════════════════════════════════════════════════
   Componente principal
══════════════════════════════════════════════════════════════ */
export default function CoaseLab() {
  /* ─── modo activo ─── */
  const [mode, setMode] = useState<'mvb' | 'coase'>('mvb');

  /* ─── parámetros Hacer vs Comprar ─── */
  const [tau, setTau] = useState(8);    // costo por transacción en mercado
  const [F, setF] = useState(40);       // costo fijo de contratar empleado
  const [m, setM] = useState(2);        // costo de monitorear actividad dentro

  /* ─── parámetros Teorema de Coase ─── */
  const [damageA, setDamageA] = useState(60);
  const [gainB, setGainB] = useState(90);
  const [coaseTau, setCoaseTau] = useState(10);
  const [rightHolder, setRightHolder] = useState<'A' | 'B'>('A');

  /* ─── stats derivados ─── */
  const nStar = breakEven(F, tau, m);
  const mvbParams: MakeVsBuyParams = { tau, F, m };
  const coaseParams: CoaseTheoremParams = { damageA, gainB, tau: coaseTau, rightHolder };
  const coaseResult = coaseNegotiation(coaseParams);

  /* ─── insights dinámicos ─── */
  const mvbInsight = nStar <= 0 || tau <= m
    ? 'Con estos números siempre conviene contratar empleado: el costo fijo se paga solo. El mercado es demasiado caro para cualquier volumen.'
    : nStar >= 30
      ? 'Con estos números siempre conviene usar el mercado: negociar cada vez sale más barato que pagar el overhead de un empleado fijo.'
      : `En tu negocio: si necesitas menos de ${nStar.toFixed(0)} actividades al mes, mándalas afuera. Si necesitas más, vale la pena contratar. Eso es exactamente lo que descubrió Coase en 1937.`;

  const coaseInsight = coaseResult.socialOptimum
    ? coaseTau < 15
      ? 'Con costos de transacción bajos, el acuerdo ocurre solo — sin necesidad de regulación. El teorema de Coase en acción.'
      : 'Se alcanzó el óptimo social. Pero solo porque los costos de negociar son manejables.'
    : 'El mercado falla: el costo de negociar impide un acuerdo eficiente. Aquí el Estado sí puede añadir valor. Eso es lo que el propio Coase reconocía para México y países con litigio caro.';

  const onRightHolderToggle = useCallback(() => {
    setRightHolder(v => v === 'A' ? 'B' : 'A');
  }, []);

  return (
    <div className="w-full">
      {/* ── Selector de modo ── */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('mvb')}
          className={`px-4 py-2 text-[12px] font-mono rounded-lg border transition ${
            mode === 'mvb'
              ? 'border-[#4FC3F7] bg-[#4FC3F7]/15 text-[#4FC3F7]'
              : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
          }`}
        >
          1 · Hacer vs Comprar
        </button>
        <button
          onClick={() => setMode('coase')}
          className={`px-4 py-2 text-[12px] font-mono rounded-lg border transition ${
            mode === 'coase'
              ? 'border-[#A78BFA] bg-[#A78BFA]/15 text-[#A78BFA]'
              : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
          }`}
        >
          2 · Teorema de Coase
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* ── Canvas principal ── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            {mode === 'mvb'
              ? <MakeVsBuyCanvas params={mvbParams} />
              : <CoaseTheoremCanvas params={coaseParams} />}
          </div>

          {/* Stats */}
          {mode === 'mvb' ? (
            <div className="grid grid-cols-3 gap-3">
              <Stat label="costo mercado (n=20)" value={`$${costMkt(20, tau).toFixed(0)}`} accent="#F472B6" />
              <Stat label="costo empresa (n=20)" value={`$${costFirm(20, F, m).toFixed(0)}`} accent="#4FC3F7" />
              <Stat
                label="umbral n*"
                value={nStar > 0 && nStar < 30 ? `${nStar.toFixed(1)} act.` : nStar <= 0 ? 'siempre empresa' : 'siempre mercado'}
                accent="#FDB813"
              />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <Stat label="óptimo social" value={gainB > damageA ? 'B produce' : 'B para'} accent="#4FC3F7" />
              <Stat label="resultado real" value={coaseResult.produces ? 'B produce' : 'B no produce'} accent={coaseResult.socialOptimum ? '#34D399' : '#EF4444'} />
              <Stat label="acuerdo" value={coaseResult.deal ? 'sí' : 'bloqueado'} accent={coaseResult.deal ? '#34D399' : '#EF4444'} />
            </div>
          )}

          {/* Insight dinámico */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">✦ ¿Qué estás viendo?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">
              {mode === 'mvb' ? mvbInsight : coaseInsight}
            </p>
          </div>
        </div>

        {/* ── Panel de controles ── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ {mode === 'mvb' ? 'Mueve el mercado' : 'La negociación'}
          </div>

          {mode === 'mvb' ? (
            <>
              <Slider
                label="Costo por transacción en mercado (τ)"
                value={tau} min={1} max={20} step={0.5} onChange={setTau}
                fmt={v => `$${v.toFixed(0)}/act.`}
                hint="Qué tan caro es buscar proveedor, negociar y vigilar el contrato cada vez."
              />
              <Slider
                label="Costo fijo de contratar empleado (F)"
                value={F} min={5} max={120} step={5} onChange={setF}
                fmt={v => `$${v.toFixed(0)}`}
                hint="Reclutamiento, capacitación, prestaciones, espacio. Se paga aunque no haya trabajo."
              />
              <Slider
                label="Costo de monitorear c/actividad (m)"
                value={m} min={0} max={10} step={0.5} onChange={setM}
                fmt={v => `$${v.toFixed(0)}/act.`}
                hint="Qué tan caro es supervisar al empleado internamente. Si es muy alto, mejor el mercado."
              />
              <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
                modelo: C_mkt = n·τ   C_firma = F + n·m<br />
                umbral: n* = F / (τ − m)<br />
                (Coase, "Nature of the Firm", 1937)
              </div>
            </>
          ) : (
            <>
              <Slider
                label="Daño al vecino A por el ruido ($)"
                value={damageA} min={10} max={150} step={5} onChange={setDamageA}
                fmt={v => `$${v.toFixed(0)}`}
                hint="Cuánto pierde A si B produce con ruido. Puede ser dinero, salud, productividad."
              />
              <Slider
                label="Ganancia de B al producir ($)"
                value={gainB} min={10} max={150} step={5} onChange={setGainB}
                fmt={v => `$${v.toFixed(0)}`}
                hint="Lo que gana el taller si produce. Si supera el daño, el óptimo social es que produzca."
              />
              <Slider
                label="Costo de negociar (τ por persona)"
                value={coaseTau} min={0} max={60} step={2} onChange={setCoaseTau}
                fmt={v => v === 0 ? 'gratis' : `$${v.toFixed(0)}`}
                hint="Abogados, tiempo, trámites. El teorema de Coase dice: si esto es cero, el acuerdo siempre llega."
              />
              <div className="space-y-2">
                <div className="text-[12px] text-[#94A3B8] font-medium">¿Quién tiene el derecho legal?</div>
                <button
                  onClick={onRightHolderToggle}
                  className={`w-full px-3 py-2 text-[12px] font-mono rounded border transition ${
                    rightHolder === 'A'
                      ? 'border-[#4FC3F7]/50 bg-[#4FC3F7]/10 text-[#4FC3F7]'
                      : 'border-[#A78BFA]/50 bg-[#A78BFA]/10 text-[#A78BFA]'
                  }`}
                >
                  {rightHolder === 'A' ? '⚖ A tiene derecho al silencio' : '⚖ B tiene derecho a producir'}
                </button>
                <div className="text-[10px] text-[#64748B] leading-snug">
                  El teorema de Coase: con τ=0, el resultado es el mismo sin importar quién tiene el derecho. Súbelo y mira qué pasa.
                </div>
              </div>
              <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
                acuerdo si: |gainB − damageA| &gt; 2τ<br />
                óptimo social: B produce ⟺ gainB &gt; damageA<br />
                (Coase, "Problem of Social Cost", 1960)
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
