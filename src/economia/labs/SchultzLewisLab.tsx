/**
 * SchultzLewisLab — laboratorio del premio Nobel 1979 (Theodore Schultz + Arthur Lewis).
 *
 * EL CLICK: un país pobre no salta al desarrollo por tener petróleo o tierra.
 * Salta cuando dos mecanismos operan juntos:
 *
 * 1. MODELO DUAL DE LEWIS (1954):
 *    La economía tiene dos sectores: uno tradicional (campo) con trabajo
 *    "ilimitado" al salario de subsistencia w_s, y uno moderno (industria)
 *    que paga más porque el capital es productivo.
 *    La industria contrata hasta que el producto marginal del trabajo = salario:
 *      Y_I = A · L_I^α    (función de producción del sector moderno)
 *      MPL = A · α · L_I^(α-1)  → salario industrial w_I = MPL
 *    Mientras el campo tiene exceso de mano de obra, w_I es constante y la
 *    industria absorbe trabajadores a ese precio.  Cuando el campo se agota,
 *    w_I empieza a subir: es el "Punto Lewis".
 *
 * 2. CAPITAL HUMANO DE SCHULTZ (1961):
 *    Educación ≡ inversión que eleva la productividad A del sector moderno.
 *    Un % de educación 'e' multiplica A por (1 + e·γ).
 *    Esto desplaza hacia arriba la curva de demanda de trabajo:
 *    la industria puede pagar más Y contratar más gente.
 *    Rendimiento de la educación > rendimiento del capital físico en economías
 *    con exceso de trabajo rural. Por eso Corea apostó a escuelas, no a minas.
 *
 * El usuario mueve:
 *  - inversión industrial (escala el capital K → eleva A)
 *  - gasto en educación (eleva productividad TFP)
 *  - tamaño inicial del campo (población rural)
 * y observa cómo los trabajadores migran, los salarios convergen y el
 * ingreso total del país sube (o no, si no educa).
 */

import { useEffect, useRef, useState } from 'react';

// ─── Constantes del modelo ───────────────────────────────────────────────────
const W = 820;
const H = 400;
const ALPHA = 0.65;          // elasticidad del trabajo en Y = A·L^α
const W_SUBSISTENCE = 1.0;   // salario de subsistencia (unidades normalizadas)
const EDU_GAMMA = 1.8;        // multiplicador: A *= (1 + e·γ)
const MIGRATE_SPEED = 0.6;   // fracción de exceso que migra por año simulado
const SIM_DT = 1 / 60;       // ~60 FPS → paso ≈ 0.3 años/seg a velocidad real

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Params {
  inversionIndustrial: number;   // 0.2 .. 4.0  → K base
  educacion: number;             // 0.0 .. 1.0
  poblacionRural0: number;       // 40 .. 80  total de trabajadores
  paused: boolean;
}

interface SimState {
  L_rural: number;   // trabajadores en el campo
  L_urban: number;   // trabajadores en la industria
  year: number;      // año simulado (empieza en 0)
  lewisPoint: boolean; // ¿ya se agotó el exceso rural?
}

interface Stats {
  wUrban: number;
  wRural: number;
  yTotal: number;
  lUrban: number;
  lRural: number;
  year: number;
  lewisPoint: boolean;
}

const DEFAULTS: Params = {
  inversionIndustrial: 1.2,
  educacion: 0.15,
  poblacionRural0: 70,
  paused: false,
};

// ─── Funciones del modelo Lewis-Schultz ──────────────────────────────────────
function computeA(inv: number, edu: number): number {
  return inv * (1 + edu * EDU_GAMMA);
}

/** Producto marginal del trabajo industrial — precio que la fábrica paga */
function mpl(L_I: number, A: number): number {
  if (L_I <= 0) return 999;
  return A * ALPHA * Math.pow(L_I, ALPHA - 1);
}

/** Producción total del sector moderno */
function yIndustrial(L_I: number, A: number): number {
  return A * Math.pow(Math.max(L_I, 0.01), ALPHA);
}

/** Producción total del sector rural (rendimientos constantes en subsistencia) */
function yRural(L_R: number): number {
  return W_SUBSISTENCE * L_R;  // cada cabeza produce su subsistencia
}

// ─── Colores ─────────────────────────────────────────────────────────────────
const ACCENT_URBAN  = '#4FC3F7'; // azul industria
const ACCENT_RURAL  = '#34D399'; // verde campo
const ACCENT_WARN   = '#FDB813'; // amarillo Lewis point
const ACCENT_EDU    = '#A78BFA'; // violeta educación
const RED           = '#EF4444';
const BG            = '#0B0F17';
const BG2           = '#070A11';
const GRID          = '#1E293B';

export default function SchultzLewisLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS });
  const simRef    = useRef<SimState>({
    L_rural: DEFAULTS.poblacionRural0,
    L_urban: DEFAULTS.poblacionRural0 * 0.05,
    year: 0,
    lewisPoint: false,
  });
  const historyRef = useRef<Array<{ year: number; wU: number; yT: number }>>([]);

  const [invInd, setInvInd] = useState(DEFAULTS.inversionIndustrial);
  const [edu,    setEdu]    = useState(DEFAULTS.educacion);
  const [pobR0,  setPobR0]  = useState(DEFAULTS.poblacionRural0);
  const [paused, setPaused] = useState(DEFAULTS.paused);
  const [stats,  setStats]  = useState<Stats>({
    wUrban: 0, wRural: W_SUBSISTENCE, yTotal: 0,
    lUrban: 0, lRural: DEFAULTS.poblacionRural0,
    year: 0, lewisPoint: false,
  });

  // Sync params to ref
  useEffect(() => {
    paramsRef.current = { inversionIndustrial: invInd, educacion: edu, poblacionRural0: pobR0, paused };
  }, [invInd, edu, pobR0, paused]);

  // Reset sim when poblacionRural0 changes
  useEffect(() => {
    simRef.current = {
      L_rural: pobR0,
      L_urban: pobR0 * 0.05,
      year: 0,
      lewisPoint: false,
    };
    historyRef.current = [];
  }, [pobR0]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let last = performance.now();
    let acc  = 0;
    let frame = 0;

    function simStep(dt: number) {
      const p   = paramsRef.current;
      const sim = simRef.current;
      const A   = computeA(p.inversionIndustrial, p.educacion);
      const L   = sim.L_rural + sim.L_urban;  // total fuerza laboral

      // Salario industrial = MPL del sector moderno
      const w_I = mpl(sim.L_urban, A);
      // Umbral del "punto Lewis": cuando el campo ya no tiene excedente
      const excessRural = sim.L_rural - L * 0.08;  // 8% mínimo atado al campo
      sim.lewisPoint = excessRural <= 0;

      if (!sim.lewisPoint && w_I > W_SUBSISTENCE) {
        // La industria atrae trabajadores rurales
        const gap = w_I - W_SUBSISTENCE;
        const flow = Math.min(excessRural, gap * MIGRATE_SPEED * dt * L * 0.3);
        if (flow > 0) {
          sim.L_rural -= flow;
          sim.L_urban += flow;
        }
      } else if (sim.lewisPoint) {
        // Fase Fei-Ranis: ya no hay exceso, los salarios salen del equilibrio
        // La industria sigue creciendo pero más lento (capital acumulado)
        const A_eff = A * (1 + sim.year * 0.02);
        const target_L_urban = Math.pow(A_eff * ALPHA / Math.max(W_SUBSISTENCE, 1.2), 1 / (1 - ALPHA));
        const diff = target_L_urban - sim.L_urban;
        if (diff > 0 && sim.L_rural > L * 0.08) {
          const move = Math.min(diff * 0.3 * dt, sim.L_rural - L * 0.08);
          sim.L_rural -= Math.max(0, move);
          sim.L_urban += Math.max(0, move);
        }
      }

      sim.year += dt * 3.5;   // velocidad narrativa: ~3.5 años por segundo real

      // Guardar historia (cada 0.5 años simulados)
      const lastEntry = historyRef.current[historyRef.current.length - 1];
      if (!lastEntry || sim.year - lastEntry.year > 0.5) {
        const wU = mpl(sim.L_urban, A);
        const yT = yIndustrial(sim.L_urban, A) + yRural(sim.L_rural);
        historyRef.current.push({ year: sim.year, wU, yT });
        if (historyRef.current.length > 60) historyRef.current.shift();
      }
    }

    function draw() {
      if (!ctx) return;
      const c   = ctx;   // narrowed local — TypeScript no pierde el type en closures
      const p   = paramsRef.current;
      const sim = simRef.current;
      const A   = computeA(p.inversionIndustrial, p.educacion);
      const L   = sim.L_rural + sim.L_urban;

      // Fondo
      const bg = c.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, BG); bg.addColorStop(1, BG2);
      c.fillStyle = bg;
      c.fillRect(0, 0, W, H);

      // ── Región izquierda: diagrama de fuerza laboral (barras) ─────────────
      const barAreaX = 30;
      const barAreaW = 280;
      const barAreaY = 44;
      const barAreaH = H - 90;

      // Título zona
      c.fillStyle = '#475569';
      c.font = '10px ui-monospace, monospace';
      c.textAlign = 'left';
      c.fillText('DISTRIBUCIÓN DE LA FUERZA LABORAL', barAreaX, barAreaY - 6);

      // Fondo zona
      c.fillStyle = 'rgba(30,41,59,0.3)';
      c.fillRect(barAreaX, barAreaY, barAreaW, barAreaH);

      const totalL = L;
      const fracRural = sim.L_rural / totalL;
      const fracUrban = sim.L_urban / totalL;

      // Barra campo (izq)
      const barW  = barAreaW * 0.44;
      const barX1 = barAreaX + 10;
      const barX2 = barAreaX + barAreaW - barW - 10;

      function drawBar(x: number, frac: number, color: string, label: string, count: number) {
        const bH = barAreaH * frac;
        const bY = barAreaY + barAreaH - bH;
        // Glow
        c.save();
        c.shadowColor = color;
        c.shadowBlur  = 14;
        const g = c.createLinearGradient(x, bY, x + barW, bY + bH);
        g.addColorStop(0, color + 'CC');
        g.addColorStop(1, color + '55');
        c.fillStyle = g;
        c.fillRect(x, bY, barW, bH);
        c.restore();
        // Borde
        c.strokeStyle = color;
        c.lineWidth = 1.5;
        c.strokeRect(x, bY, barW, bH);
        // Label abajo
        c.fillStyle = color;
        c.font = 'bold 11px ui-monospace, monospace';
        c.textAlign = 'center';
        c.fillText(label, x + barW / 2, barAreaY + barAreaH + 14);
        // Número dentro
        c.fillStyle = '#E2E8F0';
        c.font = 'bold 15px ui-monospace, monospace';
        c.fillText(count.toFixed(1), x + barW / 2, bY + 22);
        c.font = '10px ui-monospace, monospace';
        c.fillStyle = '#94A3B8';
        c.fillText(`${(frac * 100).toFixed(0)}%`, x + barW / 2, bY + 36);
      }

      drawBar(barX1, fracRural, ACCENT_RURAL,  'Campo', sim.L_rural);
      drawBar(barX2, fracUrban, ACCENT_URBAN, 'Industria', sim.L_urban);

      // Flecha de migración (animada)
      const arrowCX  = barAreaX + barAreaW / 2;
      const arrowCY  = barAreaY + barAreaH * (1 - (fracUrban + fracRural) / 2);
      const pulse = Math.sin(performance.now() / 300) * 3;
      if (!sim.lewisPoint) {
        c.save();
        c.strokeStyle = '#FDB813';
        c.lineWidth = 2;
        c.shadowColor = '#FDB813';
        c.shadowBlur = 8;
        c.beginPath();
        c.moveTo(arrowCX - 18 + pulse, arrowCY + 20);
        c.lineTo(arrowCX + 18 + pulse, arrowCY + 20);
        c.lineTo(arrowCX + 12 + pulse, arrowCY + 14);
        c.moveTo(arrowCX + 18 + pulse, arrowCY + 20);
        c.lineTo(arrowCX + 12 + pulse, arrowCY + 26);
        c.stroke();
        c.restore();
        c.fillStyle = '#FDB813';
        c.font = '9px ui-monospace, monospace';
        c.textAlign = 'center';
        c.fillText('migra →', arrowCX + pulse, arrowCY + 38);
      }

      // ── Región central: curva MPL y salarios ──────────────────────────────
      const mpAreaX = 330;
      const mpAreaW = 230;
      const mpAreaY = 44;
      const mpAreaH = H - 90;

      c.fillStyle = '#475569';
      c.font = '10px ui-monospace, monospace';
      c.textAlign = 'left';
      c.fillText('CURVA MPL INDUSTRIAL  (demanda de trabajo)', mpAreaX, mpAreaY - 6);

      // Ejes
      const axX = mpAreaX + 30;
      const axY = mpAreaY + mpAreaH;
      const axW = mpAreaW - 40;
      const axH = mpAreaH - 10;

      c.strokeStyle = GRID;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(axX, mpAreaY); c.lineTo(axX, axY);
      c.moveTo(axX, axY); c.lineTo(axX + axW, axY);
      c.stroke();

      // Etiquetas
      c.fillStyle = '#64748B';
      c.font = '9px ui-monospace, monospace';
      c.textAlign = 'left';
      c.fillText('salario', mpAreaX, mpAreaY + 10);
      c.textAlign = 'center';
      c.fillText('trabajadores industriales →', axX + axW / 2, axY + 16);

      // Escala Y: salarios 0..6  (en unidades normalizadas)
      const wMax = 6.0;
      const wToY = (w: number) => axY - (w / wMax) * axH;
      const lToX = (l: number) => axX + (l / (L * 1.1)) * axW;

      // Líneas de guía Y
      for (let w = 1; w <= 5; w++) {
        const gy = wToY(w);
        c.strokeStyle = GRID;
        c.lineWidth = 0.5;
        c.setLineDash([3, 5]);
        c.beginPath(); c.moveTo(axX, gy); c.lineTo(axX + axW, gy); c.stroke();
        c.setLineDash([]);
        c.fillStyle = '#334155';
        c.font = '9px ui-monospace, monospace';
        c.textAlign = 'right';
        c.fillText(w.toFixed(0), axX - 4, gy + 3);
      }

      // Curva MPL = A·α·L^(α-1)
      c.beginPath();
      let started = false;
      for (let i = 1; i <= 80; i++) {
        const lI  = (i / 80) * L * 1.1;
        const wI  = Math.min(mpl(lI, A), wMax);
        const cx  = lToX(lI);
        const cy  = wToY(wI);
        if (!started) { c.moveTo(cx, cy); started = true; }
        else c.lineTo(cx, cy);
      }
      c.strokeStyle = ACCENT_URBAN;
      c.lineWidth = 2.5;
      c.shadowColor = ACCENT_URBAN;
      c.shadowBlur = 6;
      c.stroke();
      c.shadowBlur = 0;

      // Curva MPL sin educación (referencia gris)
      const A_noEdu = computeA(p.inversionIndustrial, 0);
      if (p.educacion > 0.05) {
        c.beginPath();
        started = false;
        for (let i = 1; i <= 80; i++) {
          const lI = (i / 80) * L * 1.1;
          const wI = Math.min(mpl(lI, A_noEdu), wMax);
          const cx = lToX(lI);
          const cy = wToY(wI);
          if (!started) { c.moveTo(cx, cy); started = true; }
          else c.lineTo(cx, cy);
        }
        c.strokeStyle = '#334155';
        c.lineWidth = 1.5;
        c.setLineDash([4, 4]);
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = '#334155';
        c.font = '9px ui-monospace, monospace';
        c.textAlign = 'left';
        c.fillText('sin edu.', axX + 4, wToY(mpl(sim.L_urban * 0.4, A_noEdu)) - 4);
      }

      // Línea salario de subsistencia
      const wsY = wToY(W_SUBSISTENCE);
      c.strokeStyle = ACCENT_RURAL;
      c.lineWidth = 1.5;
      c.setLineDash([6, 4]);
      c.beginPath(); c.moveTo(axX, wsY); c.lineTo(axX + axW, wsY); c.stroke();
      c.setLineDash([]);
      c.fillStyle = ACCENT_RURAL;
      c.font = 'bold 9px ui-monospace, monospace';
      c.textAlign = 'left';
      c.fillText('w subsistencia', axX + 4, wsY - 4);

      // Punto actual (trabajadores urbanos, salario industrial)
      const curW = Math.min(mpl(sim.L_urban, A), wMax);
      const dotX = lToX(sim.L_urban);
      const dotY = wToY(curW);
      c.save();
      c.shadowColor = ACCENT_WARN;
      c.shadowBlur  = 18;
      c.fillStyle = ACCENT_WARN;
      c.beginPath();
      c.arc(dotX, dotY, 6, 0, Math.PI * 2);
      c.fill();
      c.restore();
      c.fillStyle = '#FEF3C7';
      c.font = 'bold 10px ui-monospace, monospace';
      c.textAlign = 'left';
      c.fillText(`w=${curW.toFixed(2)}`, dotX + 9, dotY + 4);

      // Lewis point marker (zona donde el campo se agota)
      const lLewis = L * 0.92;
      const xLewis = lToX(lLewis);
      if (xLewis < axX + axW) {
        c.strokeStyle = RED + '88';
        c.lineWidth = 1.5;
        c.setLineDash([3, 3]);
        c.beginPath(); c.moveTo(xLewis, mpAreaY + 8); c.lineTo(xLewis, axY); c.stroke();
        c.setLineDash([]);
        c.fillStyle = RED;
        c.font = 'bold 9px ui-monospace, monospace';
        c.textAlign = 'center';
        c.fillText('Punto Lewis', xLewis, mpAreaY + 20);
      }

      // ── Región derecha: histórico de salario/ingreso ───────────────────────
      const histX = 580;
      const histW = W - histX - 20;
      const histY = 44;
      const histH = H - 90;

      c.fillStyle = '#475569';
      c.font = '10px ui-monospace, monospace';
      c.textAlign = 'left';
      c.fillText('EVOLUCIÓN (salario industrial)', histX, histY - 6);

      // Mini ejes
      const hAxX = histX + 22;
      const hAxY = histY + histH;
      const hAxW = histW - 28;
      const hAxH = histH - 10;

      c.strokeStyle = GRID;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(hAxX, histY); c.lineTo(hAxX, hAxY);
      c.moveTo(hAxX, hAxY); c.lineTo(hAxX + hAxW, hAxY);
      c.stroke();

      const hist = historyRef.current;
      if (hist.length >= 2) {
        const maxW = Math.max(...hist.map(h => h.wU), wMax * 0.5);
        const yearMin = hist[0].year;
        const yearMax = Math.max(hist[hist.length - 1].year, yearMin + 1);

        const hxOf = (yr: number) => hAxX + ((yr - yearMin) / (yearMax - yearMin)) * hAxW;
        const hwOf = (w: number)  => hAxY - (w / (maxW * 1.1)) * hAxH;

        // Curva salario urbano
        c.beginPath();
        for (let i = 0; i < hist.length; i++) {
          const hx = hxOf(hist[i].year);
          const hy = hwOf(hist[i].wU);
          if (i === 0) c.moveTo(hx, hy); else c.lineTo(hx, hy);
        }
        c.strokeStyle = ACCENT_URBAN;
        c.lineWidth = 2;
        c.shadowColor = ACCENT_URBAN;
        c.shadowBlur = 5;
        c.stroke();
        c.shadowBlur = 0;

        // Línea subsistencia
        const hwSub = hwOf(W_SUBSISTENCE);
        c.strokeStyle = ACCENT_RURAL;
        c.lineWidth = 1;
        c.setLineDash([4, 4]);
        c.beginPath();
        c.moveTo(hAxX, hwSub); c.lineTo(hAxX + hAxW, hwSub);
        c.stroke();
        c.setLineDash([]);

        // Etiquetas eje Y
        c.fillStyle = '#334155';
        c.font = '9px ui-monospace, monospace';
        c.textAlign = 'right';
        c.fillText(maxW.toFixed(1), hAxX - 2, hwOf(maxW) + 3);
        c.fillText('1.0', hAxX - 2, hwOf(1.0) + 3);

        // Eje X (años)
        c.fillStyle = '#475569';
        c.font = '9px ui-monospace, monospace';
        c.textAlign = 'left';
        c.fillText(`año 0`, hAxX, hAxY + 14);
        c.textAlign = 'right';
        c.fillText(`${hist[hist.length - 1].year.toFixed(0)}`, hAxX + hAxW, hAxY + 14);
      } else {
        c.fillStyle = '#334155';
        c.font = '11px ui-monospace, monospace';
        c.textAlign = 'center';
        c.fillText('reanuda para ver historia', hAxX + hAxW / 2, histY + histH / 2);
      }

      // Leyenda colores
      c.font = '9px ui-monospace, monospace';
      c.textAlign = 'left';
      c.fillStyle = ACCENT_URBAN;
      c.fillText('── salario industrial', hAxX + 2, histY + histH - 22);
      c.fillStyle = ACCENT_RURAL;
      c.fillText('- - subsistencia', hAxX + 2, histY + histH - 10);

      // ── Barra inferior: Lewis point / mensaje ─────────────────────────────
      if (sim.lewisPoint) {
        c.fillStyle = 'rgba(239,68,68,0.12)';
        c.fillRect(0, H - 44, W, 44);
        c.fillStyle = RED;
        c.font = 'bold 13px ui-sans-serif, system-ui';
        c.textAlign = 'center';
        c.fillText('★ PUNTO LEWIS alcanzado: el campo se agotó. El salario industrial ya sube libre — es el despegue.', W / 2, H - 22);
      } else {
        const curWI = mpl(sim.L_urban, A);
        const msg = curWI > W_SUBSISTENCE + 0.3
          ? `La industria atrae gente del campo (salario industrial ${ curWI.toFixed(2) } > subsistencia ${ W_SUBSISTENCE.toFixed(1) }). Migración activa.`
          : 'Aumenta la inversión industrial o la educación para que la industria pague más que el campo.';
        c.fillStyle = curWI > W_SUBSISTENCE + 0.3 ? ACCENT_WARN : '#64748B';
        c.font = '12px ui-sans-serif, system-ui';
        c.textAlign = 'center';
        c.fillText(msg, W / 2, H - 22);
      }

      // Pausa
      if (p.paused) {
        c.fillStyle = 'rgba(5,6,10,0.45)';
        c.fillRect(0, 0, W, H);
        c.fillStyle = '#E2E8F0';
        c.font = 'bold 15px ui-sans-serif, system-ui';
        c.textAlign = 'center';
        c.fillText('⏸ en pausa', W / 2, H / 2);
      }

      // Año simulado (overlay)
      c.fillStyle = '#334155';
      c.font = 'bold 11px ui-monospace, monospace';
      c.textAlign = 'right';
      c.fillText(`año ${sim.year.toFixed(1)}`, W - 24, 24);

      if (frame % 8 === 0) {
        const wU = mpl(sim.L_urban, A);
        setStats({
          wUrban: wU,
          wRural: W_SUBSISTENCE,
          yTotal: yIndustrial(sim.L_urban, A) + yRural(sim.L_rural),
          lUrban: sim.L_urban,
          lRural: sim.L_rural,
          year: sim.year,
          lewisPoint: sim.lewisPoint,
        });
      }
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!paramsRef.current.paused) {
        acc += dt;
        while (acc >= SIM_DT) {
          simStep(SIM_DT);
          acc -= SIM_DT;
        }
      }
      draw();
      frame++;
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(raf);
  }, []);   // solo monta una vez; params vienen por ref

  // ── Insight dinámico ────────────────────────────────────────────────────────
  const insight = (() => {
    const wGap = stats.wUrban - stats.wRural;
    if (stats.lewisPoint) {
      return 'Alcanzaste el Punto Lewis: el campo ya no tiene excedente de mano de obra. A partir de aquí los salarios suben solos — el país entró al "despegue" de Lewis. Si Schultz tiene razón, cuanta más educación hayas invertido antes, más alto será ese techo.';
    }
    if (wGap < 0.3) {
      return 'La industria paga casi lo mismo que el campo. Nadie tiene incentivo para migrar. Sube la inversión industrial o la educación — necesitas que la fábrica ofrezca más que la milpa.';
    }
    if (edu < 0.05) {
      return `La industria atrae gente con un salario de $${stats.wUrban.toFixed(2)}, pero sin educación la productividad se estanca. Schultz demostró que el retorno de educar supera al del capital físico: con la misma inversión y más educación, el salario sube más rápido.`;
    }
    return `La brecha salarial (industria $${stats.wUrban.toFixed(2)} vs campo $${stats.wRural.toFixed(1)}) jala migración. La educación (TFP ×${(1 + edu * EDU_GAMMA).toFixed(2)}) levanta toda la curva MPL: más productividad = más salario = más migración = desarrollo.`;
  })();

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* Canvas */}
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
                simRef.current = {
                  L_rural: pobR0,
                  L_urban: pobR0 * 0.05,
                  year: 0,
                  lewisPoint: false,
                };
                historyRef.current = [];
              }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#FDB813]/40 bg-[#FDB813]/10 text-[#FDB813] hover:bg-[#FDB813]/20 transition"
            >
              ↺ reiniciar
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="salario industria" value={`$${stats.wUrban.toFixed(2)}`} accent={ACCENT_URBAN} />
            <StatBox label="salario campo" value={`$${stats.wRural.toFixed(2)}`}  accent={ACCENT_RURAL} />
            <StatBox label="ingreso total" value={stats.yTotal.toFixed(1)}         accent={ACCENT_WARN} />
            <StatBox
              label="fase"
              value={stats.lewisPoint ? 'DESPEGUE' : 'Dual'}
              accent={stats.lewisPoint ? RED : '#A78BFA'}
            />
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">✦ ¿Qué está pasando?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* Panel lateral de controles */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ Mueve la economía</div>

          <SliderRow
            label="Inversión industrial (K)"
            value={invInd}
            min={0.2}
            max={4.0}
            step={0.05}
            onChange={setInvInd}
            fmt={v => v < 1 ? 'pobre' : v < 2.5 ? 'media' : 'alta'}
            hint="Más capital → curva MPL más alta → la industria paga más → más migración."
            accent={ACCENT_URBAN}
          />

          <SliderRow
            label="Gasto en educación"
            value={edu}
            min={0}
            max={1}
            step={0.01}
            onChange={setEdu}
            fmt={v => `×${(1 + v * EDU_GAMMA).toFixed(2)} TFP`}
            hint="Schultz: educar multiplica la productividad total. Levanta la curva MPL sin añadir maquinaria."
            accent={ACCENT_EDU}
          />

          <SliderRow
            label="Población rural inicial"
            value={pobR0}
            min={40}
            max={80}
            step={1}
            onChange={setPobR0}
            fmt={v => `${v.toFixed(0)} personas`}
            hint="Más rural = más excedente de mano de obra = más tiempo en fase Lewis antes del despegue."
            accent={ACCENT_RURAL}
          />

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed space-y-1">
            <div>Y_I = A·L_I^{ALPHA} &nbsp; MPL = A·α·L_I^(α-1)</div>
            <div>A = K·(1 + e·γ)  γ={EDU_GAMMA} (rendimiento edu.)</div>
            <div>Lewis 1954 · Schultz 1961 · Nobel 1979</div>
          </div>

          <div className="border-t border-[#1E293B] pt-3 space-y-2">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#A78BFA] font-mono">Para el taquero</div>
            <p className="text-[11px] text-[#64748B] leading-snug">
              El que cruza de Oaxaca a Carolina del Norte no huye: cobra la brecha salarial entre el campo y la industria.
              Cuando esa brecha llega a cero (Punto Lewis), el país ya no regala mano de obra barata — y el
              desarrolloes forzado o se estanca. La educación es lo que empuja ese techo hacia arriba
              antes de que se rompa el modelo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[18px] font-bold font-mono" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function SliderRow({
  label, value, min, max, step, onChange, fmt, hint, accent,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
  hint?: string;
  accent?: string;
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
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#4FC3F7]"
      />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}
