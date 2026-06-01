/**
 * FogelNorthLab — laboratorio del premio Nobel 1993 (Robert Fogel & Douglass North).
 *
 * EL CLICK (la cliometría en acción):
 *   Fogel tomó el mito del ferrocarril americano y le puso números: calculó el
 *   "contrafactual" — ¿cuánto hubiera crecido EE.UU. SIN el tren, usando canales
 *   y carreteras? Respuesta: llega al mismo PIB… cuatro años después. CUATRO años,
 *   no siglos. El mito del tren se derrumbó con una ecuación.
 *
 *   North fue más lejos: lo que de verdad separa a países ricos de pobres no es
 *   ninguna tecnología — son las REGLAS DEL JUEGO (instituciones formales +
 *   informales). Esas reglas determinan el ritmo de crecimiento para siempre.
 *
 * MODELO REAL (Solow con contrafactual + instituciones):
 *
 *   Base Solow con TFP:
 *     Y_t  = A_t  · K_t^α · L^(1−α)    (producción)
 *     K_{t+1} = K_t + s·Y_t − δ_K·K_t  (acumulación de capital; s = tasa de ahorro)
 *     A_{t+1} = A_t · (1 + g_A + σ·g_I) (crecimiento de TFP: base + bonus institucional)
 *
 *   Tecnología específica (ferrocarril / innovación) — solo puntual:
 *     Durante los períodos [0, T_tech] el canal "con tecnología" tiene además
 *     un boost adicional Δ_tech en el crecimiento de A_t.
 *     El contrafactual usa sustitutos: mismo Δ_tech * (1 − impacto_relativo).
 *     → Fogel mostró que impacto_relativo ≈ 0.04 (4% de crecimiento extra acumulado).
 *
 *   La brecha en períodos para alcanzar el mismo Y:
 *     gap = |t(Y_con) − t(Y_sin)|   — la "brecha Fogel" en años.
 *     El usuario ve cuántos años son en realidad (habitualmente ~3-6 años).
 *
 *   Instituciones (North):
 *     σ ∈ [0, 1] — calidad institucional (derechos de propiedad, cumplimiento
 *     de contratos, acceso al crédito, pluralismo político).
 *     g_I = 0.003 — tasa de crecimiento extra por punto de institución.
 *     A lo largo del tiempo, un σ alto hace que los dos países (tecnología + no)
 *     CONVERJAN: las buenas instituciones compensan cualquier tecnología.
 *     Un σ bajo hace que la diferencia de tecnología se mantenga indefinidamente.
 *
 * Parámetros calibrados para reproducir órdenes de magnitud históricos:
 *   α = 0.35 (elasticidad del capital, estimación estándar)
 *   s = 0.20 (tasa de ahorro EE.UU. siglo XIX)
 *   δ_K = 0.05 (depreciación del capital)
 *   g_A_base = 0.012 (crecimiento base de TFP, Solow residual histórico)
 *   g_I = 0.003 (bonus TFP por unidad de calidad institucional)
 *   Δ_tech = 0.025 (boost de TFP durante la ventana tecnológica)
 *   T_tech = 20 períodos (ventana de impacto tecnológico puntual)
 *
 * Referencias:
 *   Fogel, Railroads and American Economic Growth (1964)
 *   Fogel, "A Quantitative Approach to the Study of Railroads…" (1979)
 *   North, Institutions, Institutional Change and Economic Performance (1990)
 *   Comité Nobel 1993
 */

import { useEffect, useRef, useState } from 'react';

/* ─── Dimensiones ────────────────────────────────────────────────────────── */
const W = 820;
const H = 380;
const MARGIN = { top: 44, right: 24, bottom: 52, left: 62 };
const PLOT_W = W - MARGIN.left - MARGIN.right - 160; // 160px panel lateral
const PLOT_H = H - MARGIN.top - MARGIN.bottom;

/* ─── Constantes del modelo (Solow cliométrico) ─────────────────────────── */
const ALPHA = 0.35;          // elasticidad del capital
const S_RATE = 0.20;         // tasa de ahorro
const DELTA_K = 0.05;        // depreciación del capital
const G_A_BASE = 0.012;      // crecimiento base de TFP (Solow residual)
const G_INST = 0.003;        // bonus TFP por unidad de σ (instituciones)
const DELTA_TECH = 0.025;    // boost TFP durante ventana tecnológica
const T_TECH = 20;           // duración del impulso tecnológico (períodos)
const T_MAX = 90;            // períodos totales de simulación
const L = 100;               // trabajo normalizado (constante)
const K0 = 50;               // capital inicial
const A0 = 1.0;              // TFP inicial

/* ─── Colores ────────────────────────────────────────────────────────────── */
const C_CON  = '#4FC3F7';   // azul  — "con tecnología"
const C_SIN  = '#F472B6';   // rosa  — "sin tecnología" (contrafactual)
const C_INST = '#34D399';   // verde — instituciones
const C_TECH = '#FDB813';   // dorado — boost tecnológico

/* ─── Parámetros ─────────────────────────────────────────────────────────── */
interface Params {
  sigma: number;           // 0..1 — calidad institucional (North)
  techImpact: number;      // 0..1 — impacto relativo de la tecnología (Fogel: real ≈ 0.04)
  paused: boolean;
}

const DEFAULTS: Params = { sigma: 0.3, techImpact: 0.5, paused: false };

/* ─── Estado de la simulación ────────────────────────────────────────────── */
interface EconState {
  K: number;   // capital
  A: number;   // TFP
  Y: number;   // producción (normalizada respecto al inicio)
}

interface SimState {
  tick: number;
  con: EconState;   // economía "con tecnología"
  sin: EconState;   // economía "sin tecnología" (contrafactual)
  // historiales para graficar (normalizados a Y0 = 1)
  conHist: number[];
  sinHist: number[];
  // brecha en períodos (Fogel)
  fogelGap: number;
}

function Y(K: number, A: number): number {
  return A * Math.pow(K, ALPHA) * Math.pow(L, 1 - ALPHA);
}

function initEcon(): EconState {
  const K = K0;
  const A = A0;
  return { K, A, Y: Y(K, A) };
}

function stepEcon(e: EconState, sigma: number, techBoost: number): EconState {
  const output = Y(e.K, e.A);
  const newK = e.K + S_RATE * output - DELTA_K * e.K;
  const gA = G_A_BASE + G_INST * sigma + techBoost;
  const newA = e.A * (1 + gA);
  return { K: newK, A: newA, Y: Y(newK, newA) };
}

const Y0 = Y(K0, A0);  // producción inicial — normalizamos con esto

function initSim(p: Params): SimState {
  const con = initEcon();
  const sin = initEcon();
  return {
    tick: 0,
    con,
    sin,
    conHist: [con.Y / Y0],
    sinHist: [sin.Y / Y0],
    fogelGap: 0,
  };
}

function simStep(s: SimState, p: Params): SimState {
  const t = s.tick;

  // Boost tecnológico: solo durante la ventana T_TECH
  const techOn = t < T_TECH;
  const boostCon = techOn ? DELTA_TECH * p.techImpact : 0;
  const boostSin = techOn ? DELTA_TECH * p.techImpact * (1 - p.techImpact) * 0.6 : 0;
  // La economía "sin" usa sustitutos imperfectos: recupera fracción del boost

  const newCon = stepEcon(s.con, p.sigma, boostCon);
  const newSin = stepEcon(s.sin, p.sigma, boostSin);

  const conHist = [...s.conHist, newCon.Y / Y0];
  const sinHist = [...s.sinHist, newSin.Y / Y0];

  // Brecha de Fogel: ¿cuántos períodos tarda "sin" en alcanzar el Y actual de "con"?
  const yCon = newCon.Y;
  let gap = 0;
  // Busca cuándo sinHist cruzó yCon/Y0
  const target = yCon / Y0;
  for (let i = sinHist.length - 1; i >= 0; i--) {
    if (sinHist[i] >= target) {
      gap = 0;
      break;
    }
    gap++;
  }

  return {
    tick: t + 1,
    con: newCon,
    sin: newSin,
    conHist,
    sinHist,
    fogelGap: gap,
  };
}

/* ─── Coordenadas del plot ───────────────────────────────────────────────── */
function px(i: number, total: number): number {
  return MARGIN.left + (i / Math.max(1, total - 1)) * PLOT_W;
}

function pyVal(v: number, yMax: number): number {
  const frac = Math.min(1, v / yMax);
  return MARGIN.top + PLOT_H - frac * PLOT_H;
}

/* ─── Componente principal ──────────────────────────────────────────────── */
export default function FogelNorthLab() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const paramsRef    = useRef<Params>({ ...DEFAULTS });
  const simRef       = useRef<SimState>(initSim(DEFAULTS));
  const resetFlagRef = useRef(false);

  const [sigma,       setSigma]       = useState(DEFAULTS.sigma);
  const [techImpact,  setTechImpact]  = useState(DEFAULTS.techImpact);
  const [paused,      setPaused]      = useState(DEFAULTS.paused);
  const [stats, setStats] = useState({
    yCon: 1, ySin: 1, fogelGap: 0, tick: 0,
  });

  useEffect(() => {
    paramsRef.current = { sigma, techImpact, paused };
  }, [sigma, techImpact, paused]);

  useEffect(() => {
    resetFlagRef.current = true;
  }, [sigma, techImpact]);

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

    let raf       = 0;
    let lastTime  = performance.now();
    let accTime   = 0;
    let frameCount = 0;
    const STEP_MS = 200;  // un período cada 200ms

    function draw(): void {
      if (!ctx) return;
      const p   = paramsRef.current;
      const sim = simRef.current;

      /* Fondo */
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#05060A');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const conH  = sim.conHist;
      const sinH  = sim.sinHist;
      const len   = conH.length;
      const yMax  = Math.max(2, ...conH, ...sinH) * 1.05;

      /* ── Ejes ──────────────────────────────────────────────────────────── */
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN.left, MARGIN.top);
      ctx.lineTo(MARGIN.left, MARGIN.top + PLOT_H);
      ctx.lineTo(MARGIN.left + PLOT_W, MARGIN.top + PLOT_H);
      ctx.stroke();

      // Guías horizontales
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = '#1A2535';
      const gridVals = [1, 2, 3, 4, 5, 6, 8, 10, 12].filter(v => v <= yMax);
      for (const v of gridVals) {
        const yg = pyVal(v, yMax);
        ctx.beginPath();
        ctx.moveTo(MARGIN.left, yg);
        ctx.lineTo(MARGIN.left + PLOT_W, yg);
        ctx.strokeStyle = v === 1 ? '#2A3A50' : '#1A2535';
        ctx.lineWidth = v === 1 ? 1.2 : 0.8;
        ctx.stroke();
        ctx.fillStyle = '#3B4A60';
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${v}×`, MARGIN.left - 4, yg + 3);
      }
      ctx.setLineDash([]);

      // Línea de Y = 1 (inicio) — referencia
      const y1 = pyVal(1, yMax);
      ctx.strokeStyle = '#2A3A50';
      ctx.lineWidth   = 1.2;
      ctx.beginPath();
      ctx.moveTo(MARGIN.left, y1);
      ctx.lineTo(MARGIN.left + PLOT_W, y1);
      ctx.stroke();

      // Labels de ejes
      ctx.save();
      ctx.translate(14, MARGIN.top + PLOT_H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#475569';
      ctx.font = '10px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('producción (múltiplo del año 0)', 0, 0);
      ctx.restore();

      ctx.fillStyle = '#475569';
      ctx.font = '10px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('períodos (años)', MARGIN.left + PLOT_W / 2, H - 8);

      /* ── Zona de impulso tecnológico ────────────────────────────────────── */
      if (sim.tick < T_TECH + 5) {
        const xEnd = px(Math.min(T_TECH, len - 1), len);
        const xNow = px(len - 1, len);
        const xFill = Math.min(xEnd, xNow);
        ctx.fillStyle = 'rgba(253,184,19,0.06)';
        ctx.fillRect(MARGIN.left, MARGIN.top, xFill - MARGIN.left, PLOT_H);
      }
      // Línea vertical al fin del impulso
      if (len > T_TECH) {
        const xT = px(T_TECH, len);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = `${C_TECH}55`;
        ctx.lineWidth   = 1.2;
        ctx.beginPath();
        ctx.moveTo(xT, MARGIN.top);
        ctx.lineTo(xT, MARGIN.top + PLOT_H);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle   = C_TECH;
        ctx.font        = '9px ui-monospace, monospace';
        ctx.textAlign   = 'center';
        ctx.fillText('fin boost tecnológico', xT, MARGIN.top - 6);
      }

      /* ── Serie "sin tecnología" (contrafactual) — relleno tenue ─────────── */
      if (len >= 2) {
        ctx.beginPath();
        ctx.moveTo(px(0, len), pyVal(sinH[0], yMax));
        for (let i = 1; i < len; i++) ctx.lineTo(px(i, len), pyVal(sinH[i], yMax));
        ctx.lineTo(px(len - 1, len), MARGIN.top + PLOT_H);
        ctx.lineTo(MARGIN.left, MARGIN.top + PLOT_H);
        ctx.closePath();
        ctx.fillStyle = 'rgba(244,114,182,0.06)';
        ctx.fill();

        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const x = px(i, len);
          const y = pyVal(sinH[i], yMax);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = C_SIN;
        ctx.lineWidth   = 2;
        ctx.lineJoin    = 'round';
        ctx.globalAlpha = 0.85;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      /* ── Serie "con tecnología" — relleno tenue ─────────────────────────── */
      if (len >= 2) {
        ctx.beginPath();
        ctx.moveTo(px(0, len), pyVal(conH[0], yMax));
        for (let i = 1; i < len; i++) ctx.lineTo(px(i, len), pyVal(conH[i], yMax));
        ctx.lineTo(px(len - 1, len), MARGIN.top + PLOT_H);
        ctx.lineTo(MARGIN.left, MARGIN.top + PLOT_H);
        ctx.closePath();
        ctx.fillStyle = 'rgba(79,195,247,0.07)';
        ctx.fill();

        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const x = px(i, len);
          const y = pyVal(conH[i], yMax);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = C_CON;
        ctx.lineWidth   = 2.8;
        ctx.lineJoin    = 'round';
        ctx.stroke();
      }

      /* ── Brecha de Fogel: flecha/anotación ──────────────────────────────── */
      if (len >= 4 && sim.fogelGap > 0 && sim.fogelGap < len) {
        const gap   = sim.fogelGap;
        const tNow  = len - 1;
        const xCon  = px(tNow, len);
        const xSin  = px(Math.max(0, tNow - gap), len);
        const yCon  = pyVal(conH[tNow], yMax);
        // Línea doble horizontal que muestra el gap
        const arrowY = yCon - 14;
        ctx.strokeStyle = `${C_TECH}CC`;
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(xSin, arrowY);
        ctx.lineTo(xCon, arrowY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = C_TECH;
        ctx.font      = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        const midX    = (xSin + xCon) / 2;
        ctx.fillText(`brecha Fogel ≈ ${gap} años`, midX, arrowY - 4);
      }

      /* ── Leyenda ─────────────────────────────────────────────────────────── */
      const lx   = MARGIN.left + 8;
      const ly   = MARGIN.top + 14;
      const items: Array<[string, string, number]> = [
        [C_CON,  'con tecnología (real)', 2.8],
        [C_SIN,  'sin tecnología (contrafactual)', 2],
      ];
      items.forEach(([color, label, lw], idx) => {
        const itemX = lx + idx * 200;
        ctx.strokeStyle = color;
        ctx.lineWidth   = lw;
        ctx.beginPath();
        ctx.moveTo(itemX, ly - 4);
        ctx.lineTo(itemX + 22, ly - 4);
        ctx.stroke();
        ctx.fillStyle   = color;
        ctx.font        = '10px ui-monospace, monospace';
        ctx.textAlign   = 'left';
        ctx.fillText(label, itemX + 26, ly);
      });

      /* ── Panel lateral: instituciones y estado ───────────────────────────── */
      const panelX = W - 155;
      const panelY = MARGIN.top - 10;
      const panelW = 146;
      const panelH = H - MARGIN.top + 6;

      ctx.fillStyle   = 'rgba(11,15,23,0.75)';
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 6);
      ctx.fill();
      ctx.stroke();

      // Título panel
      ctx.font      = 'bold 9px ui-monospace, monospace';
      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'center';
      ctx.fillText('INSTITUCIONES (North)', panelX + panelW / 2, panelY + 14);

      // Barra de calidad institucional
      const barX    = panelX + 12;
      const barY    = panelY + 24;
      const barW    = panelW - 24;
      const barH2   = 8;
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(barX, barY, barW, barH2);
      const sigmaFill = paramsRef.current.sigma * barW;
      const sigmaColor = paramsRef.current.sigma > 0.65 ? C_INST
        : paramsRef.current.sigma > 0.35 ? C_TECH : C_SIN;
      ctx.fillStyle = sigmaColor;
      ctx.fillRect(barX, barY, sigmaFill, barH2);
      ctx.font      = '9px ui-monospace, monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.textAlign = 'center';
      ctx.fillText(
        paramsRef.current.sigma > 0.65 ? 'inclusivas' :
        paramsRef.current.sigma > 0.35 ? 'mixtas' : 'extractivas',
        panelX + panelW / 2, barY + barH2 + 12,
      );

      // Separador
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(panelX + 8, panelY + 46);
      ctx.lineTo(panelX + panelW - 8, panelY + 46);
      ctx.stroke();

      // Valores actuales
      const rows: Array<[string, string, string]> = [
        ['Y (real)', `${(sim.con.Y / Y0).toFixed(2)}×`, C_CON],
        ['Y (cntf)', `${(sim.sin.Y / Y0).toFixed(2)}×`, C_SIN],
        ['brecha', `${sim.fogelGap}a`, C_TECH],
        ['período', `${sim.tick}`, '#94A3B8'],
        ['TFP (real)', `${sim.con.A.toFixed(3)}`, C_CON],
      ];
      rows.forEach(([label, val, color], i) => {
        const ry = panelY + 60 + i * 26;
        ctx.font      = '9px ui-monospace, monospace';
        ctx.fillStyle = '#64748B';
        ctx.textAlign = 'left';
        ctx.fillText(label, panelX + 10, ry);
        ctx.font      = 'bold 11px ui-monospace, monospace';
        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        ctx.fillText(val, panelX + panelW - 10, ry);
      });

      // Insight de Fogel en el panel
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(panelX + 8, panelY + panelH - 56);
      ctx.lineTo(panelX + panelW - 8, panelY + panelH - 56);
      ctx.stroke();

      ctx.font        = '8.5px ui-sans-serif, system-ui';
      ctx.fillStyle   = '#475569';
      ctx.textAlign   = 'center';
      const gapMsg    = sim.fogelGap <= 6 && sim.tick > T_TECH
        ? `Fogel: la brecha es\nsolo ${sim.fogelGap} años`
        : sim.tick > T_TECH
          ? `sin instituciones\nla brecha persiste`
          : 'moviendo tecnología…';
      const lines     = gapMsg.split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, panelX + panelW / 2, panelY + panelH - 42 + i * 13);
      });

      /* ── Pausa overlay ───────────────────────────────────────────────────── */
      if (p.paused) {
        ctx.fillStyle   = 'rgba(5,6,10,0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle   = '#E2E8F0';
        ctx.font        = 'bold 16px ui-sans-serif, system-ui';
        ctx.textAlign   = 'center';
        ctx.fillText('⏸ en pausa', W / 2, H / 2);
      }

      /* ── Título del eje X (período actual) ─────────────────────────────── */
      ctx.fillStyle   = '#475569';
      ctx.font        = '10px ui-monospace, monospace';
      ctx.textAlign   = 'right';
      ctx.fillText(`t = ${sim.tick}`, MARGIN.left + PLOT_W - 2, MARGIN.top + PLOT_H - 4);

      /* Stats React cada ~8 frames */
      if (frameCount % 8 === 0) {
        setStats({
          yCon:      sim.con.Y / Y0,
          ySin:      sim.sin.Y / Y0,
          fogelGap:  sim.fogelGap,
          tick:      sim.tick,
        });
      }
    }

    function loop(now: number): void {
      const dt = Math.min(0.2, (now - lastTime) / 1000);
      lastTime = now;

      if (resetFlagRef.current) {
        simRef.current    = initSim(paramsRef.current);
        resetFlagRef.current = false;
      }

      if (!paramsRef.current.paused && simRef.current.tick < T_MAX) {
        accTime += dt * 1000;
        while (accTime >= STEP_MS) {
          simRef.current = simStep(simRef.current, paramsRef.current);
          accTime -= STEP_MS;
        }
      }

      draw();
      frameCount++;
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ─── Insight dinámico ────────────────────────────────────────────────── */
  const insightMsg: string = (() => {
    const gap = stats.fogelGap;
    const tick = stats.tick;
    if (tick < 5) {
      return 'Las dos economías arrancan idénticas. La que tiene el ferrocarril (azul) acelera primero — dale tiempo para ver qué tan grande es realmente esa ventaja.';
    }
    if (tick < T_TECH + 5) {
      return `El impulso tecnológico está activo. La curva azul (con tren) crece más rápido. ¿Cuánto más? La brecha es ${gap} períodos — eso es el "costo de no tener el tren".`;
    }
    if (gap <= 4) {
      return `Brecha Fogel real: apenas ${gap} años. Sin el ferrocarril, EE.UU. hubiera llegado al mismo PIB solo ${gap} años después. El mito del tren se derrumba — lo que de verdad importa son las reglas del juego (sube el slider de instituciones y lo ves).`;
    }
    if (gap <= 10) {
      return `La brecha es ${gap} años — mayor que el caso Fogel porque el impacto de la tecnología está alto. Bájalo al 5-10% y verás lo que Fogel midió: ~4 años. Las instituciones fuertes comprimen esa brecha a casi nada.`;
    }
    return `Con impacto tecnológico exagerado y pocas instituciones, la brecha se dispara a ${gap} años. Eso no pasó históricamente: los sustitutos (canales, carreteras) eran más competitivos de lo que el mito sugería. North diría: cambia las reglas y no necesitas magia tecnológica.`;
  })();

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

        {/* ── Canvas ──────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Controles rápidos */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPaused(v => !v)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7] hover:bg-[#4FC3F7]/20 transition"
            >
              {paused ? '▶ reanudar' : '⏸ pausa'}
            </button>
            <button
              onClick={() => { resetFlagRef.current = true; }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#FDB813]/40 bg-[#FDB813]/10 text-[#FDB813] hover:bg-[#FDB813]/20 transition"
            >
              ↺ reiniciar
            </button>
            <button
              onClick={() => { setTechImpact(0.04); resetFlagRef.current = true; }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#F472B6]/40 bg-[#F472B6]/10 text-[#F472B6] hover:bg-[#F472B6]/20 transition"
            >
              Fogel real (4%)
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="producción (real)"
              value={`${stats.yCon.toFixed(2)}×`}
              accent={C_CON}
            />
            <Stat
              label="contrafactual"
              value={`${stats.ySin.toFixed(2)}×`}
              accent={C_SIN}
            />
            <Stat
              label="brecha Fogel"
              value={`${stats.fogelGap} años`}
              accent={stats.fogelGap <= 6 ? '#34D399' : stats.fogelGap <= 12 ? C_TECH : '#EF4444'}
            />
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">
              ✦ ¿Qué estás viendo? · cliometría de Fogel &amp; North
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insightMsg}</p>
          </div>
        </div>

        {/* ── Panel de controles ──────────────────────────────────────────── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Calibra el modelo
          </div>

          {/* Slider instituciones */}
          <Slider
            label="Calidad institucional σ"
            value={sigma}
            min={0}
            max={1}
            step={0.01}
            onChange={v => setSigma(v)}
            fmt={v =>
              v > 0.65 ? 'inclusivas' :
              v > 0.35 ? 'mixtas' : 'extractivas'
            }
            hint="(North) Derechos de propiedad, cumplimiento de contratos, pluralismo. A más σ, el crecimiento de TFP se acelera permanentemente — ninguna tecnología logra eso."
          />

          {/* Slider impacto tecnológico */}
          <Slider
            label="Impacto real del tren"
            value={techImpact}
            min={0.01}
            max={1}
            step={0.01}
            onChange={v => setTechImpact(v)}
            fmt={v => {
              if (v <= 0.06) return `${(v * 100).toFixed(0)}% ← Fogel real`;
              if (v <= 0.20) return `${(v * 100).toFixed(0)}% — leve`;
              if (v <= 0.50) return `${(v * 100).toFixed(0)}% — moderado`;
              return `${(v * 100).toFixed(0)}% — exagerado`;
            }}
            hint="(Fogel) Fracción del crecimiento que la tecnología realmente aporta vs. sus sustitutos (canales, carreteras). El valor histórico medido por Fogel es ~4%. Sube hasta 100% y observa que aun así las instituciones lo superan."
          />

          {/* Separador con modelo */}
          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            {'Y = A · K^α · L^(1−α)  (Solow)'}<br />
            {'A_{t+1} = A_t · (1 + g + σ·gᵢ + Δ)'}<br />
            {`α=${ALPHA} · s=${S_RATE} · δ=${DELTA_K}`}<br />
            {`g=${G_A_BASE} · gᵢ=${G_INST} · Δ=${DELTA_TECH}`}<br />
            {'Fogel 1964 · North 1990 · Nobel 1993'}
          </div>

          {/* Explicación taquera */}
          <div className="space-y-2 border-t border-[#1E293B] pt-3">
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#64748B] font-mono mb-1">
              para el taquero
            </div>
            <p className="text-[11px] text-[#64748B] leading-snug">
              La curva <span style={{ color: C_CON }}>azul</span> tiene el tren.
              La <span style={{ color: C_SIN }}>rosa</span> no lo tiene — usa
              canales y caminos. La brecha amarilla es cuántos años de ventaja
              da el tren de verdad. <strong style={{ color: '#CBD5E1' }}>Fogel
              midió: 4 años.</strong> No siglos.
              <br /><br />
              Ahora mueve el slider de <em>instituciones</em>: con reglas buenas,
              las dos economías terminan igual. Con reglas malas, la diferencia
              crece para siempre. Eso es North: las reglas del juego pesan más
              que cualquier tecnología.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Componentes auxiliares ─────────────────────────────────────────────── */
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">
        {label}
      </div>
      <div className="text-[19px] font-bold font-mono" style={{ color: accent }}>
        {value}
      </div>
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
        <span className="text-[12px] font-mono text-[#FDB813]">
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
      {hint && (
        <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>
      )}
    </div>
  );
}
