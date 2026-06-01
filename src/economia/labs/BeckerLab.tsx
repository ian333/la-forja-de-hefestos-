/**
 * BeckerLab — laboratorio del premio 1992 (Gary Becker).
 *
 * El click: tu cerebro hace cuentas aunque no lo sientas. Becker demostró
 * que el crimen, la educación, el matrimonio y la discriminación obedecen
 * a la MISMA lógica de costo-beneficio que comprar jitomates.
 *
 * Modelo REAL del crimen (Becker 1968, "Crime and Punishment: An Economic Approach"):
 *
 *   Utilidad esperada del crimen:
 *     EU_crime = (1 − p) × G + p × (G − F)
 *               = G − p × F
 *   donde:
 *     G = ganancia del crimen (si no lo atrapa)
 *     p = probabilidad de que lo atrapen (0..1)
 *     F = castigo esperado (en unidades de utilidad)
 *
 *   Utilidad del trabajo legal:
 *     EU_legal = W  (salario seguro)
 *
 *   El criminal decide delinquir si EU_crime > EU_legal
 *     ↔  G − p × F > W
 *     ↔  G > W + p × F
 *
 * El canvas muestra el "espacio de decisión": eje X = ganancia G, eje Y = castigo×prob (p·F).
 * La línea diagonal es la frontera  G = W + p·F  — arriba de ella el crimen "paga",
 * abajo no. Un punto (taquero criminal) se mueve en tiempo real.
 *
 * Capital humano (Becker 1964): retorno de la educación.
 *   W(s) = W0 × exp(r × s)   — ecuación de Mincer (r ≈ 0.08 por año)
 *   Costo(s) = c × s          — costo directo lineal (tuición + oportunidad)
 *   VPN(s) ≈ (W(s) − W0) / δ − Costo(s)   — valor presente neto simplificado (δ tasa descuento)
 *
 * Segundo panel muestra ambas curvas y el s* óptimo donde VPN se maximiza.
 */

import { useEffect, useRef, useState } from 'react';

// ────────── Constantes de layout ──────────
const W_CANVAS = 820;
const H_CANVAS = 340;
const MARGIN = { top: 40, right: 30, bottom: 50, left: 60 };
const PLOT_W = W_CANVAS - MARGIN.left - MARGIN.right;
const PLOT_H = H_CANVAS - MARGIN.top - MARGIN.bottom;

const W_EDU = 820;
const H_EDU = 240;
const S_MAX = 20;       // años de escolaridad
const W0    = 4;        // salario base (normalizado)
const R_EDU = 0.09;     // retorno Mincer por año de escolaridad
const DELTA  = 0.05;    // tasa de descuento

// Colores
const ACCENT_CRIME  = '#F472B6';   // rosa — crimen
const ACCENT_LEGAL  = '#34D399';   // verde — trabajo legal
const ACCENT_EDU    = '#22D3EE';   // cian — educación
const ACCENT_BALL   = '#FDB813';   // amarillo — el taquero
const BG_DARK       = '#0B0F17';

// ────────── Funciones del modelo ──────────
/** Utilidad esperada del crimen */
const euCrime = (G: number, p: number, F: number): number => G - p * F;
/** Frontera: G tal que euCrime = euLegal, para un p·F dado */
const borderG = (W: number, pF: number): number => W + pF;
/** Retorno Mincer */
const wMincer = (s: number, costPerYear: number): number =>
  W0 * Math.exp(R_EDU * s);
/** VPN de la educación (simplificado) */
const vpnEdu = (s: number, costPerYear: number): number =>
  (wMincer(s, costPerYear) - W0) / DELTA - costPerYear * s;

// ────────── Tipos ──────────
interface CrimeParams {
  G: number;    // ganancia bruta del crimen   (0..20)
  p: number;    // prob de atrapar             (0..1)
  F: number;    // castigo (años equivalentes) (0..20)
  W: number;    // salario legal               (0..12)
}

interface EduParams {
  costPerYear: number;  // costo por año de escolaridad (0.5..3)
}

interface SimRef {
  animT: number;
}

const CRIME_DEFAULTS: CrimeParams = { G: 8, p: 0.25, F: 10, W: 3 };
const EDU_DEFAULTS: EduParams    = { costPerYear: 1.2 };

// ════════════════════════════════════════════
export default function BeckerLab() {
  const crimeRef   = useRef<HTMLCanvasElement>(null);
  const eduRef     = useRef<HTMLCanvasElement>(null);
  const paramsRef  = useRef<CrimeParams>({ ...CRIME_DEFAULTS });
  const eduPRef    = useRef<EduParams>({ ...EDU_DEFAULTS });
  const simRef     = useRef<SimRef>({ animT: 0 });

  const [G,    setG]    = useState(CRIME_DEFAULTS.G);
  const [p,    setP]    = useState(CRIME_DEFAULTS.p);
  const [F,    setF]    = useState(CRIME_DEFAULTS.F);
  const [W,    setW]    = useState(CRIME_DEFAULTS.W);
  const [cost, setCost] = useState(EDU_DEFAULTS.costPerYear);

  const [stats, setStats] = useState({
    eu_crime: 0, eu_legal: 0, delincue: false, s_star: 0, vpn_star: 0,
  });

  // Sync params refs
  useEffect(() => { paramsRef.current = { G, p, F, W }; }, [G, p, F, W]);
  useEffect(() => { eduPRef.current   = { costPerYear: cost }; }, [cost]);

  // ─── Canvas del crimen ───────────────────
  useEffect(() => {
    const canvas = crimeRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = W_CANVAS * dpr;
    canvas.height = H_CANVAS * dpr;
    canvas.style.width  = `${W_CANVAS}px`;
    canvas.style.height = `${H_CANVAS}px`;
    ctx.scale(dpr, dpr);

    const G_MAX  = 20;
    const PF_MAX = 20;  // eje Y: p × F

    // mapeo coordenadas
    const toX  = (g: number)  => MARGIN.left + (g  / G_MAX)  * PLOT_W;
    const toY  = (pf: number) => MARGIN.top  + PLOT_H - (pf / PF_MAX) * PLOT_H;
    const fromX = (px: number) => Math.max(0, Math.min(G_MAX, (px - MARGIN.left) / PLOT_W * G_MAX));
    const fromY = (py: number) => Math.max(0, Math.min(PF_MAX, (MARGIN.top + PLOT_H - py) / PLOT_H * PF_MAX));

    let raf = 0;
    let frame = 0;

    function drawCrime() {
      if (!ctx) return;
      const pr = paramsRef.current;
      const pf_actual = pr.p * pr.F;

      // Fondo
      ctx.fillStyle = BG_DARK;
      ctx.fillRect(0, 0, W_CANVAS, H_CANVAS);

      // Zona "crimen paga" (arriba/izquierda de la frontera): para W dado
      // Frontera: G = W + p·F  →  en el espacio (G, p·F): la línea p·F = G − W
      // Región CRIMEN PAGA: G > W + p·F  ↔  G − W > p·F
      ctx.save();
      ctx.beginPath();
      // Polígono de la zona crimen-paga (G > W + pF → arriba-izquierda del eje)
      // Vértices: G_MAX arriba-derecha, W en Y=0, diagonal
      // La frontera es la línea: pF = G − W  →  para G de W a G_MAX, pF de 0 a G_MAX-W
      ctx.moveTo(toX(pr.W), toY(0));
      for (let i = 0; i <= 60; i++) {
        const gg = pr.W + (i / 60) * (G_MAX - pr.W);
        const ppf = gg - pr.W;
        ctx.lineTo(toX(gg), toY(ppf));
      }
      ctx.lineTo(toX(G_MAX), toY(0));
      ctx.closePath();
      ctx.fillStyle = 'rgba(244,114,182,0.12)';
      ctx.fill();
      ctx.restore();

      // Zona "trabajo legal paga"
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(0));
      ctx.lineTo(toX(pr.W), toY(0));
      for (let i = 60; i >= 0; i--) {
        const gg = pr.W + (i / 60) * (G_MAX - pr.W);
        const ppf = gg - pr.W;
        ctx.lineTo(toX(gg), toY(ppf));
      }
      ctx.lineTo(toX(G_MAX), toY(PF_MAX));
      ctx.lineTo(toX(0), toY(PF_MAX));
      ctx.closePath();
      ctx.fillStyle = 'rgba(52,211,153,0.07)';
      ctx.fill();
      ctx.restore();

      // Línea frontera (G = W + pF, es decir pF = G − W)
      ctx.beginPath();
      ctx.moveTo(toX(pr.W), toY(0));
      const gEnd = Math.min(G_MAX, pr.W + PF_MAX);
      ctx.lineTo(toX(gEnd), toY(gEnd - pr.W));
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Etiqueta frontera
      const midG = (pr.W + gEnd) / 2;
      const midPF = midG - pr.W;
      if (midPF < PF_MAX && midG < G_MAX) {
        ctx.save();
        ctx.translate(toX(midG) + 8, toY(midPF) - 10);
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = '#94A3B8';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('frontera: G = W + p·F', 0, 0);
        ctx.restore();
      }

      // Ejes
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      // Y
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(0));
      ctx.lineTo(toX(0), toY(PF_MAX));
      ctx.stroke();
      // X
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(0));
      ctx.lineTo(toX(G_MAX), toY(0));
      ctx.stroke();

      // Tick labels eje X
      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      for (const v of [0, 5, 10, 15, 20]) {
        ctx.fillText(`${v}`, toX(v), toY(0) + 14);
      }
      // Tick labels eje Y
      ctx.textAlign = 'right';
      for (const v of [0, 5, 10, 15, 20]) {
        ctx.fillText(`${v}`, toX(0) - 6, toY(v) + 4);
      }

      // Etiqueta eje X
      ctx.fillStyle = ACCENT_CRIME;
      ctx.font = '11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Ganancia del crimen G', toX(G_MAX / 2), H_CANVAS - 6);

      // Etiqueta eje Y (rotada)
      ctx.save();
      ctx.translate(12, toY(PF_MAX / 2));
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = ACCENT_CRIME;
      ctx.font = '11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Riesgo: p × F', 0, 0);
      ctx.restore();

      // Etiquetas de zonas
      ctx.fillStyle = 'rgba(244,114,182,0.7)';
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      const zoneGx = toX((pr.W + G_MAX) / 2 + 1);
      const zonePFy = toY(((pr.W + G_MAX) / 2 - pr.W) / 2 + 0.5);
      if (zoneGx < W_CANVAS - MARGIN.right && zonePFy > MARGIN.top) {
        ctx.fillText('CRIMEN PAGA', zoneGx, zonePFy);
      }
      ctx.fillStyle = 'rgba(52,211,153,0.7)';
      ctx.fillText('TRABAJO PAGA', toX(pr.W / 2 + 1), toY(PF_MAX * 0.55));

      // Línea vertical del salario legal (W)
      ctx.strokeStyle = ACCENT_LEGAL;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(toX(pr.W), toY(0));
      ctx.lineTo(toX(pr.W), toY(0) + 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ACCENT_LEGAL;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`W=${pr.W.toFixed(1)}`, toX(pr.W), toY(0) + 22);

      // ── El taquero (punto de decisión) ──
      const simT = simRef.current.animT;
      // pulso suave para el punto
      const pulse = 1 + 0.12 * Math.sin(simT * 4);
      const bx = toX(pr.G);
      const by = toY(pf_actual);
      const eu_crime = euCrime(pr.G, pr.p, pr.F);
      const eu_legal = pr.W;
      const delincue  = eu_crime > eu_legal;

      // Halo
      ctx.save();
      ctx.shadowColor = delincue ? ACCENT_CRIME : ACCENT_LEGAL;
      ctx.shadowBlur = 18 * pulse;
      ctx.beginPath();
      ctx.arc(bx, by, 11 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = delincue ? ACCENT_CRIME : ACCENT_LEGAL;
      ctx.fill();
      ctx.restore();

      // Etiqueta del punto
      ctx.fillStyle = '#E2E8F0';
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('tú', bx, by + 3);

      // Etiqueta decisión
      ctx.font = 'bold 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      if (delincue) {
        ctx.fillStyle = ACCENT_CRIME;
        ctx.fillText(
          `▶ EU_crimen=${eu_crime.toFixed(1)} > W=${eu_legal.toFixed(1)} → tu cerebro dice: roba`,
          W_CANVAS / 2, MARGIN.top - 12,
        );
      } else {
        ctx.fillStyle = ACCENT_LEGAL;
        ctx.fillText(
          `✓ EU_crimen=${eu_crime.toFixed(1)} ≤ W=${eu_legal.toFixed(1)} → tu cerebro dice: trabaja`,
          W_CANVAS / 2, MARGIN.top - 12,
        );
      }

      if (frame % 8 === 0) {
        setStats(s => ({ ...s, eu_crime: eu_crime, eu_legal: eu_legal, delincue }));
      }
    }

    function loop(now: number) {
      simRef.current.animT = now / 1000;
      drawCrime();
      frame++;
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ─── Canvas de educación ──────────────────
  useEffect(() => {
    const canvas = eduRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = W_EDU * dpr;
    canvas.height = H_EDU * dpr;
    canvas.style.width  = `${W_EDU}px`;
    canvas.style.height = `${H_EDU}px`;
    ctx.scale(dpr, dpr);

    const MG = { top: 30, right: 30, bottom: 40, left: 60 };
    const PW  = W_EDU  - MG.left - MG.right;
    const PH  = H_EDU  - MG.top  - MG.bottom;
    const Y_MAX = 18;

    const toX = (s: number)  => MG.left + (s / S_MAX) * PW;
    const toY = (v: number)  => MG.top  + PH - ((v + 2) / (Y_MAX + 2)) * PH;

    let raf2 = 0;
    let frame2 = 0;

    function drawEdu() {
      if (!ctx) return;
      const ep = eduPRef.current;

      ctx.fillStyle = BG_DARK;
      ctx.fillRect(0, 0, W_EDU, H_EDU);

      // Ejes
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(MG.left, MG.top); ctx.lineTo(MG.left, MG.top + PH); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(MG.left, MG.top + PH); ctx.lineTo(MG.left + PW, MG.top + PH); ctx.stroke();

      // Línea Y=0
      ctx.strokeStyle = '#1E293B';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(MG.left, toY(0)); ctx.lineTo(MG.left + PW, toY(0)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#475569';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText('VPN=0', MG.left - 4, toY(0) + 3);

      // Curva VPN(s)
      ctx.beginPath();
      let sStarVal = 0; let vpnStarVal = -Infinity;
      for (let i = 0; i <= 80; i++) {
        const s = (i / 80) * S_MAX;
        const v = vpnEdu(s, ep.costPerYear);
        const x = toX(s), y = toY(Math.max(-2, Math.min(Y_MAX, v)));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        if (v > vpnStarVal) { vpnStarVal = v; sStarVal = s; }
      }
      ctx.strokeStyle = ACCENT_EDU;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Curva de costo
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const s = (i / 80) * S_MAX;
        const v = ep.costPerYear * s;
        const x = toX(s), y = toY(Math.min(Y_MAX, v));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Curva de retorno
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const s = (i / 80) * S_MAX;
        const v = (wMincer(s, ep.costPerYear) - W0) / DELTA;
        const x = toX(s), y = toY(Math.min(Y_MAX, v));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = ACCENT_LEGAL;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Punto óptimo s*
      const sStarClamped = Math.min(S_MAX - 0.5, Math.max(0.5, sStarVal));
      const vpnStarClamped = Math.min(Y_MAX - 0.5, Math.max(-2, vpnStarVal));
      ctx.save();
      ctx.shadowColor = ACCENT_EDU; ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(toX(sStarClamped), toY(vpnStarClamped), 7, 0, Math.PI * 2);
      ctx.fillStyle = ACCENT_BALL;
      ctx.fill();
      ctx.restore();

      // Línea vertical s*
      ctx.strokeStyle = ACCENT_BALL;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(toX(sStarClamped), toY(vpnStarClamped));
      ctx.lineTo(toX(sStarClamped), toY(0));
      ctx.stroke();
      ctx.setLineDash([]);

      // Label s*
      ctx.fillStyle = ACCENT_BALL;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`s*=${sStarClamped.toFixed(1)}a`, toX(sStarClamped), MG.top + PH + 14);
      ctx.fillText(`VPN=${vpnStarClamped.toFixed(1)}`, toX(sStarClamped), toY(vpnStarClamped) - 12);

      // Tick labels eje X
      ctx.fillStyle = '#64748B';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      for (const v of [0, 4, 8, 12, 16, 20]) {
        ctx.fillText(`${v}`, toX(v), MG.top + PH + 12);
      }

      // Etiqueta eje X
      ctx.fillStyle = ACCENT_EDU;
      ctx.font = '10px ui-sans-serif, system-ui';
      ctx.fillText('años de escolaridad s', MG.left + PW / 2, H_EDU - 4);

      // Etiqueta eje Y
      ctx.save();
      ctx.translate(11, MG.top + PH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = ACCENT_EDU;
      ctx.font = '10px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('valor (normalizado)', 0, 0);
      ctx.restore();

      // Leyenda
      const lx = MG.left + PW - 160;
      const ly = MG.top + 8;
      const legend: [string, string, boolean][] = [
        [ACCENT_EDU,   'VPN neto de educación', false],
        [ACCENT_LEGAL, 'retorno total (VPA)', true],
        ['#EF4444',    'costo acumulado', true],
      ];
      legend.forEach(([color, label, dashed], i) => {
        const yy = ly + i * 16;
        ctx.strokeStyle = color; ctx.lineWidth = 1.5;
        if (dashed) ctx.setLineDash([5, 4]); else ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(lx, yy + 4); ctx.lineTo(lx + 20, yy + 4); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#94A3B8';
        ctx.font = '9px ui-sans-serif, system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(label, lx + 24, yy + 8);
      });

      if (frame2 % 12 === 0) {
        setStats(s => ({ ...s, s_star: sStarClamped, vpn_star: vpnStarClamped }));
      }
    }

    function loop2(now: number) {
      drawEdu();
      frame2++;
      raf2 = requestAnimationFrame(loop2);
    }
    raf2 = requestAnimationFrame(loop2);
    return () => cancelAnimationFrame(raf2);
  }, []);

  // ─── Insight dinámico ────────────────────
  const insight = stats.delincue
    ? `Con G=${G.toFixed(0)}, p=${(p * 100).toFixed(0)}% de que te atrapen y F=${F.toFixed(0)}: tu cerebro calcula EU_crimen=${stats.eu_crime.toFixed(1)} > W=${stats.eu_legal.toFixed(1)}. El modelo dice: ¡roba! Sube la probabilidad de captura o el castigo — no bastan años de cárcel si la probabilidad de que te atrapen es ínfima.`
    : `Con p=${(p * 100).toFixed(0)}% de captura y F=${F.toFixed(0)}: EU_crimen=${stats.eu_crime.toFixed(1)} ≤ W=${stats.eu_legal.toFixed(1)}. El cerebro hace cuentas y elige trabajar. Baja el salario legal W o la probabilidad de captura y mira cómo cambia la decisión.`;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

        {/* ── Panel izquierdo ── */}
        <div className="space-y-4">

          {/* Canvas del crimen */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#F472B6] font-mono mb-2">
              ✦ Modelo del crimen — Becker 1968
            </div>
            <div className="overflow-x-auto">
              <canvas
                ref={crimeRef}
                className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block touch-none"
                style={{ width: W_CANVAS, height: H_CANVAS }}
              />
            </div>
          </div>

          {/* Canvas de educación */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#22D3EE] font-mono mb-2">
              ✦ Capital humano — ecuación de Mincer
            </div>
            <div className="overflow-x-auto">
              <canvas
                ref={eduRef}
                className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block touch-none"
                style={{ width: W_EDU, height: H_EDU }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="EU crimen"  value={stats.eu_crime.toFixed(2)}
                  accent={stats.delincue ? ACCENT_CRIME : ACCENT_LEGAL} />
            <Stat label="salario W"  value={stats.eu_legal.toFixed(2)}  accent={ACCENT_LEGAL} />
            <Stat label="s* óptimo"  value={`${stats.s_star.toFixed(1)} años`} accent={ACCENT_EDU} />
            <Stat label="VPN edu"    value={stats.vpn_star.toFixed(1)}
                  accent={stats.vpn_star > 0 ? ACCENT_EDU : '#EF4444'} />
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#22D3EE] font-mono mb-2">
              ✦ ¿Qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── Panel derecho: controles ── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ El taquero criminal
          </div>

          <Slider
            label="Ganancia del crimen G"
            value={G} min={0} max={20} step={0.5}
            onChange={setG}
            fmt={v => v.toFixed(1)}
            hint="Lo que se lleva si no lo atrapan. A mayor ganancia, más atractivo el crimen."
            accent={ACCENT_CRIME}
          />
          <Slider
            label="Probabilidad de captura p"
            value={p} min={0} max={1} step={0.01}
            onChange={setP}
            fmt={v => `${(v * 100).toFixed(0)}%`}
            hint="Becker demostró: más probabilidad de captura reduce el crimen MÁS que más castigo."
            accent={ACCENT_CRIME}
          />
          <Slider
            label="Severidad del castigo F"
            value={F} min={0} max={20} step={0.5}
            onChange={setF}
            fmt={v => v.toFixed(1)}
            hint="Años de cárcel o equivalente. Solo pesa si p > 0; cárcel segura pero poco probable no disuade."
            accent={ACCENT_CRIME}
          />
          <Slider
            label="Salario legal W"
            value={W} min={0} max={12} step={0.25}
            onChange={setW}
            fmt={v => v.toFixed(2)}
            hint="Tu mejor alternativa legal. Más empleo y mejores salarios bajan el crimen más que la cárcel."
            accent={ACCENT_LEGAL}
          />

          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono border-t border-[#1E293B] pt-4">
            ⚙ Capital humano
          </div>
          <Slider
            label="Costo anual de estudiar"
            value={cost} min={0.5} max={3} step={0.05}
            onChange={setCost}
            fmt={v => v.toFixed(2)}
            hint="Tuición + oportunidad. Sube el costo y s* baja: menos gente estudia. Así los subsidios aumentan capital humano."
            accent={ACCENT_EDU}
          />

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo crimen: EU = G − p·F vs W<br />
            (Becker 1968, J.Political Economy)<br />
            capital humano: W(s) = W₀·e^(r·s)<br />
            r={R_EDU}, δ={DELTA} · Mincer 1974
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────── Componentes auxiliares ──────────
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[17px] font-bold font-mono" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function Slider({
  label, value, min, max, step, onChange, fmt, hint, accent,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string; hint?: string; accent?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[12px] font-mono" style={{ color: accent ?? '#FDB813' }}>
          {fmt ? fmt(value) : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#22D3EE]"
      />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}
