/**
 * AllaisLab — laboratorio del premio 1988 (Maurice Allais).
 *
 * El click: la Paradoja de Allais (1953).
 * El experimento original le mostró al mundo que la gente viola la Utilidad
 * Esperada (EU) de forma sistemática — no por error aleatorio, sino porque el
 * cerebro sobrepondera la CERTEZA.
 *
 * Las dos preguntas clásicas:
 *   Problema 1: A = 100% · $1M  vs  B = 89%·$1M + 10%·$5M + 1%·$0
 *   Problema 2: C = 11%·$1M + 89%·$0  vs  D = 10%·$5M + 90%·$0
 *
 * Si prefieres A > B y también D > C, violas los axiomas de von Neumann–Morgenstern.
 * Demostración:
 *   A>B  ⟹  U(1M) > 0.89·U(1M) + 0.10·U(5M) + 0.01·U(0)
 *          ⟹  0.11·U(1M) > 0.10·U(5M) + 0.01·U(0)
 *   D>C  ⟹  0.10·U(5M) + 0.90·U(0) > 0.11·U(1M) + 0.89·U(0)
 *          ⟹  0.10·U(5M) + 0.01·U(0) > 0.11·U(1M)
 *   Estas dos son CONTRADICTORIAS. La paradoja nace.
 *
 * El canvas visualiza:
 *   1. Ruedas de probabilidad (probability wheels) para cada opción.
 *   2. Valor Esperado y Utilidad Esperada (con CRRA) calculados en tiempo real.
 *   3. Curva de Ponderación de Probabilidades de Prospect Theory  w(p) = p^γ/(p^γ+(1−p)^γ)^(1/γ)
 *      que SÍ explica el patrón de Allais.
 *   4. Un indicador de consistencia: si el usuario elige A>B y D>C, se muestra la contradicción.
 *
 * Parámetros interactivos:
 *   - γ (gamma): parámetro de curvatura de ponderación (0.4–1.0)
 *   - Riqueza base (referencia) para ajustar el efecto de encuadre
 *   - El usuario elige entre A/B y entre C/D y ve el análisis en vivo
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ── Dimensiones canvas ──────────────────────────────────────────────────────
const W = 820;
const H = 400;

// ── Valores del experimento de Allais (en miles de pesos para hacerlo local) ─
const V0 = 0;          // $0
const V1 = 1_000;      // $1,000,000 → representados en miles
const V5 = 5_000;      // $5,000,000

// Opciones originales de Allais
// Problema 1
const OPT_A = [{ p: 1.00, v: V1 }];
const OPT_B = [{ p: 0.89, v: V1 }, { p: 0.10, v: V5 }, { p: 0.01, v: V0 }];
// Problema 2
const OPT_C = [{ p: 0.11, v: V1 }, { p: 0.89, v: V0 }];
const OPT_D = [{ p: 0.10, v: V5 }, { p: 0.90, v: V0 }];

type Choice1 = 'A' | 'B' | null;
type Choice2 = 'C' | 'D' | null;

// ── Modelos matemáticos ──────────────────────────────────────────────────────

/** Valor esperado lineal (EU con u(x)=x). */
function ev(opts: Array<{ p: number; v: number }>): number {
  return opts.reduce((s, o) => s + o.p * o.v, 0);
}

/** Utilidad CRRA: u(x) = x^(1-ρ) / (1-ρ)  con u(0)=0.
 *  Para ρ→1 usa ln(x+1). */
function u_crra(x: number, rho: number): number {
  if (x <= 0) return 0;
  if (Math.abs(rho - 1) < 1e-6) return Math.log(x + 1);
  return Math.pow(x + 1, 1 - rho) / (1 - rho);
}

/** Utilidad Esperada bajo CRRA. */
function eu_crra(opts: Array<{ p: number; v: number }>, rho: number): number {
  return opts.reduce((s, o) => s + o.p * u_crra(o.v, rho), 0);
}

/** Ponderación de probabilidades de Prospect Theory (Tversky & Kahneman 1992).
 *  w(p) = p^γ / (p^γ + (1−p)^γ)^(1/γ) */
function w_pt(p: number, gamma: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const num = Math.pow(p, gamma);
  const den = Math.pow(Math.pow(p, gamma) + Math.pow(1 - p, gamma), 1 / gamma);
  return num / den;
}

/** Utilidad Ponderada de Prospect Theory (CPT simplificado). */
function eu_pt(opts: Array<{ p: number; v: number }>, gamma: number, rho: number): number {
  return opts.reduce((s, o) => s + w_pt(o.p, gamma) * u_crra(o.v, rho), 0);
}

// ── Colores ──────────────────────────────────────────────────────────────────
const COL = {
  bg: '#050609',
  panel: '#0B0F17',
  border: '#1E293B',
  A: '#4FC3F7',     // azul cielo — opción A
  B: '#FBBF24',     // ámbar — opción B
  C: '#34D399',     // esmeralda — opción C
  D: '#F472B6',     // rosa — opción D
  eu: '#A78BFA',    // violeta — EU estándar
  pt: '#FB923C',    // naranja — Prospect Theory
  warn: '#EF4444',
  ok: '#34D399',
  text: '#E2E8F0',
  dim: '#64748B',
  gold: '#FDB813',
};

// ── Wheel drawer ─────────────────────────────────────────────────────────────
function drawWheel(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  slices: Array<{ p: number; v: number; color: string }>,
  label: string,
  selected: boolean,
  evVal: number,
) {
  // sombra si seleccionada
  ctx.save();
  if (selected) {
    ctx.shadowColor = slices[0]?.color ?? '#fff';
    ctx.shadowBlur = 18;
  }

  let angle = -Math.PI / 2;
  for (const sl of slices) {
    const sweep = sl.p * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.closePath();
    ctx.fillStyle = sl.color;
    ctx.fill();
    // etiqueta del slice si es grande
    if (sl.p > 0.06) {
      const mid = angle + sweep / 2;
      const tx = cx + (r * 0.62) * Math.cos(mid);
      const ty = cy + (r * 0.62) * Math.sin(mid);
      ctx.fillStyle = '#000a';
      ctx.font = `bold ${sl.p > 0.25 ? 11 : 9}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const pct = `${(sl.p * 100).toFixed(0)}%`;
      ctx.fillText(pct, tx, ty);
    }
    angle += sweep;
  }

  // borde
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = selected ? slices[0]?.color ?? '#fff' : COL.border;
  ctx.lineWidth = selected ? 3 : 1.5;
  ctx.stroke();

  ctx.restore();

  // etiqueta
  ctx.fillStyle = selected ? (slices[0]?.color ?? COL.text) : COL.dim;
  ctx.font = `bold 14px ui-sans-serif, system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, cx, cy - r - 22);

  // EV
  ctx.fillStyle = COL.dim;
  ctx.font = `10px ui-monospace, monospace`;
  ctx.fillText(`EV $${(evVal).toLocaleString('es-MX')}k`, cx, cy + r + 6);
}

// ── Leyenda de la rueda ──────────────────────────────────────────────────────
function drawLegend(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  slices: Array<{ p: number; v: number; color: string }>,
) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < slices.length; i++) {
    const sl = slices[i];
    ctx.fillStyle = sl.color;
    ctx.fillRect(x, y + i * 16, 10, 10);
    ctx.fillStyle = COL.text;
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(`${(sl.p * 100).toFixed(0)}% → $${sl.v.toLocaleString('es-MX')}k`, x + 14, y + i * 16 + 5);
  }
}

// ── Rounded rect helper ────────────────────────────────────────────────────
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Curva de ponderación ─────────────────────────────────────────────────────
function drawWeightCurve(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, w: number, h: number,
  gamma: number,
) {
  // fondo
  ctx.fillStyle = COL.panel;
  ctx.strokeStyle = COL.border;
  ctx.lineWidth = 1;
  rrect(ctx, x0, y0, w, h, 6);
  ctx.fill();
  ctx.stroke();

  const pad = 14;
  const gx = x0 + pad, gy = y0 + pad;
  const gw = w - pad * 2, gh = h - pad * 2;

  // diagonal (EU racional = identidad)
  ctx.beginPath();
  ctx.moveTo(gx, gy + gh);
  ctx.lineTo(gx + gw, gy);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // curva PT
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) {
    const p = i / 80;
    const wp = w_pt(p, gamma);
    const px = gx + p * gw;
    const py = gy + (1 - wp) * gh;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = COL.pt;
  ctx.lineWidth = 2;
  ctx.stroke();

  // ejes
  ctx.strokeStyle = COL.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh);
  ctx.stroke();

  // labels
  ctx.fillStyle = COL.dim;
  ctx.font = '9px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('w(p)', x0 + w / 2, y0 + 2);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('1', gx - 2, gy);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillText('p', gx + gw, gy + gh + 2);
  ctx.fillText('0', gx, gy + gh + 2);
  ctx.fillText('1', gx + gw, gy + gh + 2);

  // marcador γ
  ctx.fillStyle = COL.pt;
  ctx.font = `bold 9px ui-monospace, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`γ=${gamma.toFixed(2)}`, x0 + 4, y0 + 4);
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function AllaisLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [choice1, setChoice1] = useState<Choice1>(null);
  const [choice2, setChoice2] = useState<Choice2>(null);
  const [gamma, setGamma] = useState<number>(0.69);   // valor calibrado empíricamente
  const [rho, setRho] = useState<number>(0.5);         // aversión al riesgo CRRA

  // Refs para el loop de animación (evita cerrar sobre state)
  const stateRef = useRef({ choice1, choice2, gamma, rho });
  useEffect(() => { stateRef.current = { choice1, choice2, gamma, rho }; }, [choice1, choice2, gamma, rho]);

  // Animación: pulso de selección
  const frameRef = useRef(0);

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

    function draw() {
      if (!ctx) return;
      const { choice1: c1, choice2: c2, gamma: gam, rho: ro } = stateRef.current;
      const frame = frameRef.current;

      // ── Fondo ───────────────────────────────────────────────────────────
      ctx.fillStyle = COL.bg;
      ctx.fillRect(0, 0, W, H);

      // ── Título ──────────────────────────────────────────────────────────
      ctx.fillStyle = COL.text;
      ctx.font = 'bold 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('La Paradoja de Allais', 16, 12);
      ctx.fillStyle = COL.dim;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText('Valores en miles de MXN · Elige una opción en cada problema', 16, 29);

      // ── Separador problemas ──────────────────────────────────────────────
      ctx.strokeStyle = COL.border;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(W / 2 - 0.5, 42);
      ctx.lineTo(W / 2 - 0.5, H - 6);
      ctx.stroke();

      // ── PROBLEMA 1 (izquierda) ───────────────────────────────────────────
      ctx.fillStyle = COL.dim;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('PROBLEMA 1', W / 4, 44);

      const WL = W / 2;   // ancho disponible izquierda
      const rWheel = 56;
      const cyWheel = 155;

      // Opción A — rueda única
      const slicesA: Array<{ p: number; v: number; color: string }> = [
        { p: 1.0, v: V1, color: COL.A },
      ];
      drawWheel(ctx, WL * 0.27, cyWheel, rWheel, slicesA, 'A', c1 === 'A', ev(OPT_A));
      drawLegend(ctx, WL * 0.27 - 48, cyWheel + rWheel + 14, slicesA);

      // Opción B
      const slicesB: Array<{ p: number; v: number; color: string }> = [
        { p: 0.89, v: V1, color: COL.A + 'aa' },
        { p: 0.10, v: V5, color: COL.B },
        { p: 0.01, v: V0, color: '#EF4444' },
      ];
      drawWheel(ctx, WL * 0.73, cyWheel, rWheel, slicesB, 'B', c1 === 'B', ev(OPT_B));
      drawLegend(ctx, WL * 0.73 - 54, cyWheel + rWheel + 14, slicesB);

      // ── PROBLEMA 2 (derecha) ─────────────────────────────────────────────
      ctx.fillStyle = COL.dim;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PROBLEMA 2', WL + WL / 2, 44);

      // Opción C
      const slicesC: Array<{ p: number; v: number; color: string }> = [
        { p: 0.11, v: V1, color: COL.C },
        { p: 0.89, v: V0, color: '#334155' },
      ];
      drawWheel(ctx, WL + WL * 0.27, cyWheel, rWheel, slicesC, 'C', c2 === 'C', ev(OPT_C));
      drawLegend(ctx, WL + WL * 0.27 - 48, cyWheel + rWheel + 14, slicesC);

      // Opción D
      const slicesD: Array<{ p: number; v: number; color: string }> = [
        { p: 0.10, v: V5, color: COL.D },
        { p: 0.90, v: V0, color: '#334155' },
      ];
      drawWheel(ctx, WL + WL * 0.73, cyWheel, rWheel, slicesD, 'D', c2 === 'D', ev(OPT_D));
      drawLegend(ctx, WL + WL * 0.73 - 54, cyWheel + rWheel + 14, slicesD);

      // ── Panel de diagnóstico ─────────────────────────────────────────────
      const diagY = H - 74;
      ctx.fillStyle = COL.panel;
      ctx.strokeStyle = COL.border;
      ctx.lineWidth = 1;
      rrect(ctx, 8, diagY, W - 16, 66, 6);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      if (c1 === null || c2 === null) {
        ctx.fillStyle = COL.dim;
        ctx.font = '12px ui-sans-serif, system-ui';
        ctx.fillText('Elige una opción en cada problema para ver el diagnóstico de Allais.', 18, diagY + 33);
      } else {
        // Paradoja de Allais: A+D es la combinación que viola EU
        const isParadox = c1 === 'A' && c2 === 'D';
        const isConsistent1 = c1 === 'B' && c2 === 'C';
        const isConsistent2 = c1 === 'A' && c2 === 'C';
        const isConsistent3 = c1 === 'B' && c2 === 'D';

        // Calcular EU y PT para las opciones elegidas
        const euC1 = eu_crra(c1 === 'A' ? OPT_A : OPT_B, ro);
        const euC1_alt = eu_crra(c1 === 'A' ? OPT_B : OPT_A, ro);
        const euC2 = eu_crra(c2 === 'C' ? OPT_C : OPT_D, ro);
        const euC2_alt = eu_crra(c2 === 'C' ? OPT_D : OPT_C, ro);

        const ptC1 = eu_pt(c1 === 'A' ? OPT_A : OPT_B, gam, ro);
        const ptC1_alt = eu_pt(c1 === 'A' ? OPT_B : OPT_A, gam, ro);
        const ptC2 = eu_pt(c2 === 'C' ? OPT_C : OPT_D, gam, ro);
        const ptC2_alt = eu_pt(c2 === 'C' ? OPT_D : OPT_C, gam, ro);

        // EU concuerda con tu elección?
        const euAgrees1 = euC1 > euC1_alt;
        const euAgrees2 = euC2 > euC2_alt;
        // PT concuerda?
        const ptAgrees1 = ptC1 > ptC1_alt;
        const ptAgrees2 = ptC2 > ptC2_alt;

        const pulse = Math.sin(frame * 0.08) * 0.5 + 0.5;

        if (isParadox) {
          ctx.fillStyle = `rgba(239,68,68,${0.7 + pulse * 0.3})`;
          ctx.font = 'bold 13px ui-sans-serif, system-ui';
          ctx.fillText('¡PARADOJA DE ALLAIS! Elegiste A + D — esto viola los axiomas de EU de von Neumann–Morgenstern.', 18, diagY + 14);
          ctx.fillStyle = COL.dim;
          ctx.font = '11px ui-monospace, monospace';
          ctx.fillText('A>B implica 0.11·U($1M) > 0.10·U($5M) + 0.01·U($0)   ←pero→   D>C implica 0.10·U($5M) + 0.01·U($0) > 0.11·U($1M)   ← CONTRADICCIÓN', 18, diagY + 32);
          ctx.fillStyle = COL.pt;
          ctx.fillText(`Prospect Theory (γ=${gam.toFixed(2)}) SÍ explica tu elección: sobrepondera la certeza del 100% (Efecto Certeza).`, 18, diagY + 50);
        } else if (isConsistent1) {
          ctx.fillStyle = COL.ok;
          ctx.font = 'bold 13px ui-sans-serif, system-ui';
          ctx.fillText('Consistente con EU. Elegiste B + C: prefieres el valor esperado mayor en ambos problemas.', 18, diagY + 14);
          ctx.fillStyle = COL.dim;
          ctx.font = '11px ui-monospace, monospace';
          ctx.fillText(`EU estándar (ρ=${ro.toFixed(1)}): EU(${c1})=${euC1.toFixed(3)}  EU(${c2})=${euC2.toFixed(3)}  |  PT (γ=${gam.toFixed(2)}): también coincide.`, 18, diagY + 36);
          ctx.fillStyle = COL.dim;
          ctx.fillText('Sin embargo, la MAYORÍA de la gente elige A+D. Estás en la minoría racional según Allais.', 18, diagY + 52);
        } else {
          ctx.fillStyle = COL.text;
          ctx.font = 'bold 13px ui-sans-serif, system-ui';
          ctx.fillText(`Elegiste ${c1} + ${c2}. ${isConsistent2 ? 'Máxima aversión al riesgo: seguro siempre.' : 'Preferencia por altas ganancias esperadas.'}`, 18, diagY + 14);
          ctx.fillStyle = COL.dim;
          ctx.font = '11px ui-monospace, monospace';
          ctx.fillText(`EU (ρ=${ro.toFixed(1)}): ${euAgrees1 ? '✓' : '✗'} Problema 1,  ${euAgrees2 ? '✓' : '✗'} Problema 2  |  PT (γ=${gam.toFixed(2)}): ${ptAgrees1 ? '✓' : '✗'} Problema 1,  ${ptAgrees2 ? '✓' : '✗'} Problema 2`, 18, diagY + 36);
          ctx.fillStyle = COL.gold;
          ctx.fillText(`EV: ${c1}=$${ev(c1 === 'A' ? OPT_A : OPT_B).toLocaleString('es-MX')}k  ${c2}=$${ev(c2 === 'C' ? OPT_C : OPT_D).toLocaleString('es-MX')}k  |  Elige A+D para ver la paradoja clásica.`, 18, diagY + 52);
        }
      }

      // ── Curva de ponderación (pequeña, esquina inferior derecha) ────────
      drawWeightCurve(ctx, W - 130, 44, 122, 108, gam);

      frameRef.current++;
      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);

    // ── Interacción: clicks en ruedas ─────────────────────────────────────
    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (W / rect.width);
      const my = (e.clientY - rect.top) * (H / rect.height);
      const WL = W / 2;
      const cyWheel = 155;
      const rWheel = 56;

      const dist = (cx: number, cy: number) =>
        Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);

      if (dist(WL * 0.27, cyWheel) <= rWheel + 18) setChoice1('A');
      else if (dist(WL * 0.73, cyWheel) <= rWheel + 18) setChoice1('B');
      else if (dist(WL + WL * 0.27, cyWheel) <= rWheel + 18) setChoice2('C');
      else if (dist(WL + WL * 0.73, cyWheel) <= rWheel + 18) setChoice2('D');
    };

    canvas.addEventListener('click', handleClick);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('click', handleClick);
    };
  }, []);

  // Insight dinámico
  const insight = useCallback((): string => {
    if (choice1 === 'A' && choice2 === 'D') {
      return 'Caíste en la trampa clásica. El 100% de la opción A "se siente" cualitativamente distinto al 89%. Tu cerebro sobrepondera la certeza: el Efecto Certeza de Allais. Y bajo Prospect Theory con γ<1, eso es racional para TU cerebro — solo no para la EU de papel.';
    }
    if (choice1 === 'B' && choice2 === 'C') {
      return 'Elección consistente con EU. Elegiste el mayor valor esperado en ambos casos. Eres parte de la minoría que no cae en la paradoja — o eres economista de nacimiento.';
    }
    if (choice1 === null || choice2 === null) {
      return 'Haz clic en las ruedas del canvas para elegir en cada problema. La mayoría de la gente elige A en el Problema 1 y D en el Problema 2 — una combinación imposible bajo utilidad esperada.';
    }
    return `Tu combinación ${choice1}+${choice2} es menos común. Mueve el slider γ (abajo) para ver cuándo Prospect Theory predice tu elección.`;
  }, [choice1, choice2]);

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        {/* ── Canvas ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#050609] block cursor-pointer"
              style={{ width: W, height: H }}
              title="Haz clic en una rueda para elegir"
            />
          </div>

          {/* Botones de elección rápida */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#64748B] font-mono mb-2">Problema 1</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setChoice1('A')}
                  className={`flex-1 px-2 py-1.5 text-[12px] font-mono rounded border transition ${
                    choice1 === 'A'
                      ? 'border-[#4FC3F7] bg-[#4FC3F7]/20 text-[#4FC3F7]'
                      : 'border-[#1E293B] text-[#64748B] hover:text-[#94A3B8]'
                  }`}
                >
                  A — 100% $1M
                </button>
                <button
                  onClick={() => setChoice1('B')}
                  className={`flex-1 px-2 py-1.5 text-[12px] font-mono rounded border transition ${
                    choice1 === 'B'
                      ? 'border-[#FBBF24] bg-[#FBBF24]/20 text-[#FBBF24]'
                      : 'border-[#1E293B] text-[#64748B] hover:text-[#94A3B8]'
                  }`}
                >
                  B — 10% $5M
                </button>
              </div>
            </div>
            <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#64748B] font-mono mb-2">Problema 2</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setChoice2('C')}
                  className={`flex-1 px-2 py-1.5 text-[12px] font-mono rounded border transition ${
                    choice2 === 'C'
                      ? 'border-[#34D399] bg-[#34D399]/20 text-[#34D399]'
                      : 'border-[#1E293B] text-[#64748B] hover:text-[#94A3B8]'
                  }`}
                >
                  C — 11% $1M
                </button>
                <button
                  onClick={() => setChoice2('D')}
                  className={`flex-1 px-2 py-1.5 text-[12px] font-mono rounded border transition ${
                    choice2 === 'D'
                      ? 'border-[#F472B6] bg-[#F472B6]/20 text-[#F472B6]'
                      : 'border-[#1E293B] text-[#64748B] hover:text-[#94A3B8]'
                  }`}
                >
                  D — 10% $5M
                </button>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2">
            <Stat label="EV opción A" value={`$${ev(OPT_A).toLocaleString('es-MX')}k`} accent={COL.A} />
            <Stat label="EV opción B" value={`$${ev(OPT_B).toLocaleString('es-MX')}k`} accent={COL.B} />
            <Stat label="EV opción C" value={`$${ev(OPT_C).toFixed(0)}k`} accent={COL.C} />
            <Stat label="EV opción D" value={`$${ev(OPT_D).toFixed(0)}k`} accent={COL.D} />
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">✦ ¿Qué estás viendo?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight()}</p>
          </div>

          {/* Demostración algebraica de la paradoja */}
          {choice1 === 'A' && choice2 === 'D' && (
            <div className="bg-[#0B0F17] border border-[#EF4444]/30 rounded-lg p-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#EF4444] font-mono mb-2">⚠ La contradicción matemática</div>
              <div className="text-[11px] font-mono text-[#94A3B8] leading-relaxed space-y-1">
                <div>A &gt; B  →  <span className="text-[#4FC3F7]">U($1M) &gt; 0.89·U($1M) + 0.10·U($5M) + 0.01·U($0)</span></div>
                <div className="pl-8">→  <span className="text-[#4FC3F7]">0.11·U($1M) − 0.01·U($0) &gt; 0.10·U($5M)</span>  … (i)</div>
                <div>D &gt; C  →  <span className="text-[#F472B6]">0.10·U($5M) + 0.90·U($0) &gt; 0.11·U($1M) + 0.89·U($0)</span></div>
                <div className="pl-8">→  <span className="text-[#F472B6]">0.10·U($5M) &gt; 0.11·U($1M) − 0.01·U($0)</span>  … (ii)</div>
                <div className="text-[#EF4444] font-bold mt-2">(i) y (ii) son contradictorias. No existe ninguna función U que las satisfaga simultáneamente.</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Panel lateral de controles ──────────────────────────────── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ Ajusta los modelos</div>

          <Slider
            label="γ — curvatura PT"
            value={gamma}
            min={0.3}
            max={1.0}
            step={0.01}
            onChange={setGamma}
            fmt={v => v < 0.6 ? `${v.toFixed(2)} (máx sesgo)` : v > 0.9 ? `${v.toFixed(2)} (casi EU)` : v.toFixed(2)}
            hint="Baja γ → más sobreestimación de probabilidades bajas y efecto certeza. 1.0 = EU estándar."
          />

          <Slider
            label="ρ — aversión al riesgo (CRRA)"
            value={rho}
            min={0.01}
            max={2.0}
            step={0.01}
            onChange={setRho}
            fmt={v => v < 0.5 ? `${v.toFixed(2)} (neutral)` : v < 1.2 ? `${v.toFixed(2)} (moderada)` : `${v.toFixed(2)} (alta)`}
            hint="Aversión al riesgo en la función de utilidad u(x) = x^(1-ρ)/(1-ρ)."
          />

          {/* EU vs PT comparison */}
          <div className="space-y-3 border-t border-[#1E293B] pt-4">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[#64748B] font-mono">Modelo predice A&gt;B</div>
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-[#94A3B8]">EU (ρ={rho.toFixed(1)})</span>
              <span className={eu_crra(OPT_A, rho) > eu_crra(OPT_B, rho) ? 'text-[#34D399]' : 'text-[#EF4444]'}>
                {eu_crra(OPT_A, rho) > eu_crra(OPT_B, rho) ? '✓ sí' : '✗ no'}
              </span>
            </div>
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-[#94A3B8]">PT (γ={gamma.toFixed(2)})</span>
              <span className={eu_pt(OPT_A, gamma, rho) > eu_pt(OPT_B, gamma, rho) ? 'text-[#34D399]' : 'text-[#EF4444]'}>
                {eu_pt(OPT_A, gamma, rho) > eu_pt(OPT_B, gamma, rho) ? '✓ sí' : '✗ no'}
              </span>
            </div>

            <div className="text-[10px] uppercase tracking-[0.14em] text-[#64748B] font-mono mt-2">Modelo predice D&gt;C</div>
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-[#94A3B8]">EU (ρ={rho.toFixed(1)})</span>
              <span className={eu_crra(OPT_D, rho) > eu_crra(OPT_C, rho) ? 'text-[#34D399]' : 'text-[#EF4444]'}>
                {eu_crra(OPT_D, rho) > eu_crra(OPT_C, rho) ? '✓ sí' : '✗ no'}
              </span>
            </div>
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-[#94A3B8]">PT (γ={gamma.toFixed(2)})</span>
              <span className={eu_pt(OPT_D, gamma, rho) > eu_pt(OPT_C, gamma, rho) ? 'text-[#34D399]' : 'text-[#EF4444]'}>
                {eu_pt(OPT_D, gamma, rho) > eu_pt(OPT_C, gamma, rho) ? '✓ sí' : '✗ no'}
              </span>
            </div>

            {/* Paradox status */}
            <div className={`mt-2 text-[11px] font-mono px-2 py-1.5 rounded ${
              eu_pt(OPT_A, gamma, rho) > eu_pt(OPT_B, gamma, rho) &&
              eu_pt(OPT_D, gamma, rho) > eu_pt(OPT_C, gamma, rho)
                ? 'bg-[#FB923C]/10 text-[#FB923C]'
                : 'bg-[#1E293B] text-[#64748B]'
            }`}>
              {eu_pt(OPT_A, gamma, rho) > eu_pt(OPT_B, gamma, rho) &&
               eu_pt(OPT_D, gamma, rho) > eu_pt(OPT_C, gamma, rho)
                ? `PT predice A+D (paradoja) con γ=${gamma.toFixed(2)}`
                : `PT no predice A+D con γ=${gamma.toFixed(2)}`}
            </div>
          </div>

          <div className="text-[9px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            Allais (1953) · Tversky & Kahneman, CPT (1992)<br />
            Nobel de Economía 1988 · w(p) = p^γ/(p^γ+(1−p)^γ)^(1/γ)
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Componentes auxiliares ───────────────────────────────────────────────────
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[9px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[16px] font-bold font-mono" style={{ color: accent }}>{value}</div>
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
        className="w-full accent-[#FB923C]"
      />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}
