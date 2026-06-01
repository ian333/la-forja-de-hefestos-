/**
 * DiamondMortensenPissaridesLab — Premio Nobel 2010.
 *
 * El click: hay chambas vacías y gente sin chamba AL MISMO TIEMPO.
 * No es flojera. El mercado laboral es un tianguis enorme a oscuras:
 * el que ofrece y el que busca tardan en toparse — eso se llama fricción.
 *
 * Modelo DMP (Diamond-Mortensen-Pissarides):
 *
 *   Matching function:  m(u, v) = A · u^α · v^(1−α)        (Cobb-Douglas en búsqueda)
 *   Tightness:          θ = v / u                            (vacantes / desempleados)
 *   Job-finding rate:   f(θ) = m/u = A · θ^(1−α)
 *   Vacancy-filling:    q(θ) = m/v = A · θ^(−α)
 *
 *   Steady-state unemployment (flujos de entrada = flujos de salida):
 *     s · (1 − u*) = f(θ) · u*
 *     → u* = s / (s + f(θ))
 *
 *   Curva de Beveridge: lugares geométricos (u, v) donde el mercado laboral
 *   está en steady-state para distintos valores de θ.
 *   Con θ = v/u fijo → v = θ·u → la curva: v = A^(1/(1-α))·u·(u/(A))^(-1)
 *   Parametrizada: u* = s/(s+A·θ^(1-α)), v* = θ·u*
 *
 * Controles:
 *   - Eficiencia del match (A): qué tan fácil es toparte con la vacante
 *   - Separación (s): con qué frecuencia la gente pierde su chamba
 *   - Costo de la vacante (κ): lo que le cuesta a la empresa publicar y esperar
 *
 * La simulación de partículas muestra visualmente cómo trabajadores (puntos
 * azules) y vacantes (puntos amarillos) se mueven al azar y se emparejan
 * (match). La Curva de Beveridge se dibuja viva mientras el sistema evoluciona.
 */

import { useEffect, useRef, useState } from 'react';

/* ─── constantes de layout ─── */
const W = 820;
const H = 380;
const BEVER_X0 = 40;   // origen del plano Beveridge en canvas
const BEVER_Y0 = 340;
const BEVER_W  = 310;  // ancho del gráfico Beveridge
const BEVER_H  = 300;  // alto del gráfico Beveridge
const SIM_X0   = 390;  // origen del tianguis (partículas)
const SIM_W    = 410;  // ancho zona partículas
const SIM_H    = H - 10;
const N_WORKERS   = 60;  // total agentes (empleados + desempleados)
const N_VACANCIES = 30;  // máximo de vacantes posibles

/* ─── parámetros del modelo ─── */
interface Params {
  A: number;      // eficiencia del matching, 0.2..1.2
  alpha: number;  // elasticidad, fija en 0.5 (Cobb-Douglas simétrico)
  s: number;      // tasa de separación (job destruction), 0.01..0.25
  kappa: number;  // costo de vacante (0.1..2.0)
  paused: boolean;
}

const DEFAULTS: Params = { A: 0.6, alpha: 0.5, s: 0.06, kappa: 0.5, paused: false };

/* ─── estado de la simulación de partículas ─── */
interface Worker {
  x: number; y: number;
  vx: number; vy: number;
  employed: boolean;
  matchTimer: number;   // tiempo hasta que pierde la chamba (si empleado)
  searchTimer: number;  // tiempo en búsqueda
  partnerId: number;    // índice de vacancy asignada (-1 si ninguna)
}

interface Vacancy {
  x: number; y: number;
  vx: number; vy: number;
  open: boolean;
  partnerId: number;    // índice de worker asignado (-1 si ninguna)
}

/* ─── historia de la curva de Beveridge (puntos observados) ─── */
interface BeveridgePoint { u: number; v: number; t: number; }

/* ─── utilidades del modelo ─── */
const fTheta = (A: number, alpha: number, theta: number) =>
  A * Math.pow(Math.max(theta, 1e-6), 1 - alpha);

const uStar = (A: number, alpha: number, s: number, theta: number) => {
  const f = fTheta(A, alpha, theta);
  return s / (s + f);
};

const vStar = (theta: number, u: number) => theta * u;

/* ─── curva de Beveridge teórica (barrido de θ) ─── */
function beveridgeCurve(A: number, alpha: number, s: number) {
  const pts: { u: number; v: number }[] = [];
  for (let i = 1; i <= 80; i++) {
    const theta = 0.05 + (i / 80) * 6;
    const u = uStar(A, alpha, s, theta);
    const v = vStar(theta, u);
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) pts.push({ u, v });
  }
  return pts;
}

/* ─── mapeo coordenadas Beveridge → canvas ─── */
const bvX = (u: number) => BEVER_X0 + u * BEVER_W;
const bvY = (v: number) => BEVER_Y0 - v * BEVER_H;

/* ─── componente principal ─── */
export default function DiamondMortensenPissaridesLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS });

  /* estado React (controles) */
  const [A, setA] = useState(DEFAULTS.A);
  const [s, setS] = useState(DEFAULTS.s);
  const [kappa, setKappa] = useState(DEFAULTS.kappa);
  const [paused, setPaused] = useState(DEFAULTS.paused);
  const [stats, setStats] = useState({ u: 0.09, v: 0.05, theta: 0, uStarCalc: 0 });

  useEffect(() => {
    paramsRef.current = { A, alpha: 0.5, s, kappa, paused };
  }, [A, s, kappa, paused]);

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

    /* ── inicializar partículas ── */
    const rnd = () => Math.random();
    const workers: Worker[] = Array.from({ length: N_WORKERS }, (_, i) => ({
      x: SIM_X0 + 20 + rnd() * (SIM_W - 40),
      y: 10 + rnd() * (SIM_H - 20),
      vx: (rnd() - 0.5) * 0.8,
      vy: (rnd() - 0.5) * 0.8,
      employed: i < Math.round(N_WORKERS * 0.9),
      matchTimer: 80 + rnd() * 200,
      searchTimer: rnd() * 60,
      partnerId: -1,
    }));

    const vacancies: Vacancy[] = Array.from({ length: N_VACANCIES }, () => ({
      x: SIM_X0 + 20 + rnd() * (SIM_W - 40),
      y: 10 + rnd() * (SIM_H - 20),
      vx: (rnd() - 0.5) * 0.5,
      vy: (rnd() - 0.5) * 0.5,
      open: rnd() < 0.4,
      partnerId: -1,
    }));

    /* ── historia de la curva de Beveridge ── */
    const history: BeveridgePoint[] = [];
    let historyTimer = 0;

    let raf = 0;
    let frame = 0;
    let last = performance.now();

    function simStep(dt: number) {
      const p = paramsRef.current;
      const alpha = p.alpha;

      /* contar desempleados y vacantes abiertas */
      const unemployed = workers.filter(w => !w.employed);
      const openVacs    = vacancies.filter(v => v.open && v.partnerId === -1);
      const totalU = unemployed.length / N_WORKERS;
      const totalV = openVacs.length  / N_VACANCIES;

      /* ── movimiento partículas ── */
      const speed = 0.9;
      for (const w of workers) {
        if (w.partnerId >= 0) {
          /* seguir a la vacante asignada durante el proceso de match */
          const vac = vacancies[w.partnerId];
          if (vac) {
            const dx = vac.x - w.x;
            const dy = vac.y - w.y;
            w.x += dx * 0.08;
            w.y += dy * 0.08;
          }
          continue;
        }
        w.x += w.vx * speed;
        w.y += w.vy * speed;
        /* rebotar en los bordes de la zona del tianguis */
        if (w.x < SIM_X0 + 5)    { w.x = SIM_X0 + 5;    w.vx = Math.abs(w.vx); }
        if (w.x > SIM_X0 + SIM_W - 5) { w.x = SIM_X0 + SIM_W - 5; w.vx = -Math.abs(w.vx); }
        if (w.y < 5)              { w.y = 5;              w.vy = Math.abs(w.vy); }
        if (w.y > SIM_H - 5)     { w.y = SIM_H - 5;      w.vy = -Math.abs(w.vy); }
        /* pequeño ruido de dirección */
        w.vx += (rnd() - 0.5) * 0.1; w.vx = Math.max(-1.2, Math.min(1.2, w.vx));
        w.vy += (rnd() - 0.5) * 0.1; w.vy = Math.max(-1.2, Math.min(1.2, w.vy));
      }

      for (const v of vacancies) {
        if (!v.open || v.partnerId >= 0) continue;
        v.x += v.vx * speed * 0.6;
        v.y += v.vy * speed * 0.6;
        if (v.x < SIM_X0 + 5)    { v.x = SIM_X0 + 5;    v.vx = Math.abs(v.vx); }
        if (v.x > SIM_X0 + SIM_W - 5) { v.x = SIM_X0 + SIM_W - 5; v.vx = -Math.abs(v.vx); }
        if (v.y < 5)              { v.y = 5;              v.vy = Math.abs(v.vy); }
        if (v.y > SIM_H - 5)     { v.y = SIM_H - 5;      v.vy = -Math.abs(v.vy); }
        v.vx += (rnd() - 0.5) * 0.08; v.vx = Math.max(-0.8, Math.min(0.8, v.vx));
        v.vy += (rnd() - 0.5) * 0.08; v.vy = Math.max(-0.8, Math.min(0.8, v.vy));
      }

      /* ── separación (job destruction): empleado → desempleado ── */
      const sepRate = p.s * dt * 0.016;   // escala de tiempo
      for (const w of workers) {
        if (!w.employed) continue;
        w.matchTimer -= 1;
        if (w.matchTimer <= 0 || rnd() < sepRate) {
          w.employed = false;
          w.matchTimer = 0;
          w.searchTimer = 0;
          /* soltar la vacante vinculada */
          if (w.partnerId >= 0) {
            vacancies[w.partnerId].partnerId = -1;
            vacancies[w.partnerId].open = true;
            w.partnerId = -1;
          }
        }
      }

      /* ── matching: desempleados cerca de vacante abierta ── */
      const theta = Math.max(totalV, 1e-6) / Math.max(totalU, 1e-6);
      const matchProb = fTheta(p.A, alpha, theta) * dt * 0.004;

      for (const w of unemployed) {
        if (w.partnerId >= 0) continue;
        if (rnd() > matchProb) continue;
        /* buscar la vacante abierta más cercana */
        let bestDist = Infinity;
        let bestIdx  = -1;
        for (let vi = 0; vi < vacancies.length; vi++) {
          const vac = vacancies[vi];
          if (!vac.open || vac.partnerId >= 0) continue;
          const dx = vac.x - w.x;
          const dy = vac.y - w.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestDist) { bestDist = d2; bestIdx = vi; }
        }
        if (bestIdx < 0) continue;
        /* iniciar proceso de match */
        w.partnerId = bestIdx;
        vacancies[bestIdx].partnerId = workers.indexOf(w);
      }

      /* ── resolver matches en proceso ── */
      for (let wi = 0; wi < workers.length; wi++) {
        const w = workers[wi];
        if (w.partnerId < 0 || w.employed) continue;
        const vac = vacancies[w.partnerId];
        if (!vac) { w.partnerId = -1; continue; }
        const dx = vac.x - w.x;
        const dy = vac.y - w.y;
        if (dx * dx + dy * dy < 64) {
          /* match completado! */
          w.employed  = true;
          w.matchTimer = 120 + rnd() * 300 * (1 / (p.s * 10 + 0.1));
          vac.open    = false;
          vac.partnerId = -1;
          w.partnerId   = -1;
        }
      }

      /* ── apertura de nuevas vacantes (libre entrada de firmas) ── */
      /* condición JC: q(θ)·(y−w) = κ → q(θ) ≥ κ/y → más vacantes si θ bajo */
      const qTheta_val = p.A * Math.pow(Math.max(theta, 0.01), -alpha);
      const vacancyOpenProb = Math.min(0.015, qTheta_val / (p.kappa * 40 + 1)) * dt * 0.5;
      for (const vac of vacancies) {
        if (vac.open) continue;
        if (vac.partnerId >= 0) continue;
        if (rnd() < vacancyOpenProb) {
          vac.open = true;
          vac.x = SIM_X0 + 20 + rnd() * (SIM_W - 40);
          vac.y = 10 + rnd() * (SIM_H - 20);
          vac.vx = (rnd() - 0.5) * 0.5;
          vac.vy = (rnd() - 0.5) * 0.5;
        }
      }

      /* ── registro historia Beveridge ── */
      historyTimer++;
      if (historyTimer % 90 === 0) {
        const curU = workers.filter(w => !w.employed).length / N_WORKERS;
        const curV = vacancies.filter(v => v.open).length / N_VACANCIES;
        history.push({ u: curU, v: curV, t: frame });
        if (history.length > 120) history.shift();
      }

      /* ── stats cada 20 frames ── */
      if (frame % 20 === 0) {
        const curU    = workers.filter(w => !w.employed).length / N_WORKERS;
        const curV    = vacancies.filter(v => v.open).length / N_VACANCIES;
        const curTheta = Math.max(curV, 0.001) / Math.max(curU, 0.001);
        setStats({ u: curU, v: curV, theta: curTheta, uStarCalc: uStar(p.A, p.alpha, p.s, curTheta) });
      }
    }

    /* ─── dibujo ─── */
    function draw() {
      if (!ctx) return;
      const p = paramsRef.current;
      const alpha = p.alpha;

      /* fondo */
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      /* ══════════════════ PANEL IZQUIERDO — CURVA DE BEVERIDGE ══════════════════ */

      /* cuadrícula tenue */
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 0.5;
      for (let tick = 0; tick <= 4; tick++) {
        const u = tick / 4;
        const x = bvX(u);
        ctx.beginPath(); ctx.moveTo(x, bvY(0)); ctx.lineTo(x, bvY(1)); ctx.stroke();
        const y = bvY(u);
        ctx.beginPath(); ctx.moveTo(bvX(0), y); ctx.lineTo(bvX(1), y); ctx.stroke();
      }

      /* ejes */
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bvX(0), bvY(0));
      ctx.lineTo(bvX(1), bvY(0));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bvX(0), bvY(0));
      ctx.lineTo(bvX(0), bvY(1));
      ctx.stroke();

      /* etiquetas de eje */
      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('desempleo (u)', bvX(0.5), bvY(0) + 20);
      ctx.save();
      ctx.translate(bvX(0) - 28, bvY(0.5));
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('vacantes (v)', 0, 0);
      ctx.restore();

      /* ticks en ejes */
      ctx.fillStyle = '#475569';
      ctx.font = '9px ui-monospace, monospace';
      for (let t = 0; t <= 4; t++) {
        const u = t / 4;
        ctx.textAlign = 'center';
        ctx.fillText((u * 100).toFixed(0) + '%', bvX(u), bvY(0) + 11);
        ctx.textAlign = 'right';
        ctx.fillText((u * 100).toFixed(0) + '%', bvX(0) - 4, bvY(u) + 3);
      }

      /* curva de Beveridge teórica */
      const curve = beveridgeCurve(p.A, alpha, p.s);
      if (curve.length > 1) {
        ctx.beginPath();
        ctx.moveTo(bvX(curve[0].u), bvY(curve[0].v));
        for (let i = 1; i < curve.length; i++) {
          ctx.lineTo(bvX(curve[i].u), bvY(curve[i].v));
        }
        ctx.strokeStyle = '#4FC3F7';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();

        /* relleno suave */
        ctx.lineTo(bvX(curve[curve.length - 1].u), bvY(0));
        ctx.lineTo(bvX(curve[0].u), bvY(0));
        ctx.closePath();
        ctx.fillStyle = 'rgba(79,195,247,0.04)';
        ctx.fill();
      }

      /* historia observada (puntos de color) */
      for (let i = 0; i < history.length; i++) {
        const pt = history[i];
        const age = (history.length - i) / history.length;
        ctx.beginPath();
        ctx.arc(bvX(pt.u), bvY(pt.v), 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(251,146,60,${0.2 + 0.8 * (1 - age)})`;
        ctx.fill();
      }

      /* punto actual */
      if (history.length > 0) {
        const last_pt = history[history.length - 1];
        ctx.beginPath();
        ctx.arc(bvX(last_pt.u), bvY(last_pt.v), 6, 0, Math.PI * 2);
        ctx.fillStyle = '#FB923C';
        ctx.shadowColor = '#FB923C';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      /* título del gráfico */
      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('Curva de Beveridge', BEVER_X0, 18);
      ctx.fillStyle = '#4FC3F7';
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText('─── equilibrio teórico', BEVER_X0, 30);
      ctx.fillStyle = '#FB923C';
      ctx.fillText('● observado en vivo', BEVER_X0, 42);

      /* ══════════════════ PANEL DERECHO — TIANGUIS (PARTÍCULAS) ══════════════════ */

      /* separador */
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(SIM_X0 - 8, 0);
      ctx.lineTo(SIM_X0 - 8, H);
      ctx.stroke();
      ctx.setLineDash([]);

      /* fondo zona tianguis */
      ctx.fillStyle = 'rgba(15,23,42,0.6)';
      ctx.fillRect(SIM_X0 - 4, 0, SIM_W + 4, H);

      /* título */
      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('El tianguis laboral', SIM_X0 + 2, 18);

      /* dibujar vacantes (cuadros amarillos) */
      for (const vac of vacancies) {
        if (!vac.open) continue;
        const x = vac.x;
        const y = vac.y;
        const inMatch = vac.partnerId >= 0;
        ctx.save();
        if (inMatch) { ctx.shadowColor = '#FDB813'; ctx.shadowBlur = 8; }
        ctx.fillStyle = inMatch ? '#FEF3C7' : '#FDB813';
        ctx.fillRect(x - 5, y - 5, 10, 10);
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 5, y - 5, 10, 10);
        ctx.restore();
      }

      /* dibujar trabajadores (círculos) */
      for (const w of workers) {
        const x = w.x;
        const y = w.y;
        const inMatch = w.partnerId >= 0;

        ctx.save();
        if (w.employed) {
          /* empleados: verde tenue, chiquitos */
          ctx.globalAlpha = 0.45;
          ctx.fillStyle = '#34D399';
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (inMatch) {
          /* en proceso de match: naranja brillante */
          ctx.shadowColor = '#FB923C';
          ctx.shadowBlur = 12;
          const grad = ctx.createRadialGradient(x - 1, y - 1, 1, x, y, 7);
          grad.addColorStop(0, '#FFF7ED');
          grad.addColorStop(1, '#FB923C');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.fill();
        } else {
          /* desempleado buscando: azul vibrante */
          ctx.shadowColor = '#60A5FA';
          ctx.shadowBlur = 6;
          const grad2 = ctx.createRadialGradient(x - 1, y - 1, 1, x, y, 6);
          grad2.addColorStop(0, '#EFF6FF');
          grad2.addColorStop(1, '#3B82F6');
          ctx.fillStyle = grad2;
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      /* leyenda tianguis */
      const ly = H - 62;
      const lx = SIM_X0 + 8;
      ctx.font = '10px ui-sans-serif, system-ui';

      ctx.fillStyle = '#3B82F6';
      ctx.beginPath(); ctx.arc(lx + 6, ly + 5, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#94A3B8';
      ctx.textAlign = 'left';
      ctx.fillText('buscando trabajo', lx + 15, ly + 9);

      ctx.fillStyle = '#34D399';
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(lx + 6, ly + 22, 4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('empleado', lx + 15, ly + 26);

      ctx.fillStyle = '#FDB813';
      ctx.fillRect(lx + 1, ly + 36, 10, 10);
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('vacante abierta', lx + 15, ly + 46);

      ctx.fillStyle = '#FB923C';
      ctx.beginPath(); ctx.arc(lx + 6, ly + 58, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('en proceso de match', lx + 15, ly + 62);

      /* ── barra inferior: stats del modelo ── */
      const curU = workers.filter(w2 => !w2.employed).length / N_WORKERS;
      const curV = vacancies.filter(v2 => v2.open).length / N_VACANCIES;

      ctx.fillStyle = '#E2E8F0';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      const uPct  = (curU  * 100).toFixed(1);
      const vPct  = (curV  * 100).toFixed(1);
      const theta = (Math.max(curV, 0.001) / Math.max(curU, 0.001)).toFixed(2);
      ctx.fillStyle = '#4FC3F7';
      ctx.fillText(`u=${uPct}%`, SIM_X0 + SIM_W * 0.25, H - 8);
      ctx.fillStyle = '#FDB813';
      ctx.fillText(`v=${vPct}%`, SIM_X0 + SIM_W * 0.5, H - 8);
      ctx.fillStyle = '#A78BFA';
      ctx.fillText(`θ=${theta}`, SIM_X0 + SIM_W * 0.75, H - 8);

      /* ── pausa ── */
      if (p.paused) {
        ctx.fillStyle = 'rgba(5,6,10,0.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 16px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⏸ en pausa', W / 2, H / 2);
      }
    }

    /* ─── loop de animación ─── */
    function loop(now: number) {
      const dt = Math.min(50, now - last);
      last = now;
      if (!paramsRef.current.paused) {
        simStep(dt);
      }
      draw();
      frame++;
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(raf);
  }, []);

  /* ─── insight contextual ─── */
  const insight =
    stats.u > 0.18
      ? 'El desempleo está alto. Mueve la eficiencia del match hacia arriba: más fácil toparte = menos gente buscando. Eso es lo que hacen LinkedIn o las bolsas de trabajo.'
      : stats.v > 0.35
      ? 'Hay muchas vacantes sin llenar. Baja el costo de la vacante o sube la eficiencia del match para que las empresas encuentren candidatos más rápido.'
      : stats.u < 0.04
      ? `Desempleo friccional mínimo (${(stats.u * 100).toFixed(1)}%). ¡Imposible llegar a 0%: siempre habrá alguien en el camino, recién renunció, buscando algo mejor, o la vacante acaba de abrirse!`
      : `Mercado en equilibrio. Siempre hay algo de desempleo (${(stats.u * 100).toFixed(1)}%) aunque haya vacantes (${(stats.v * 100).toFixed(1)}%). El tianguis no es instantáneo — encontrarse cuesta.`;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

        {/* canvas */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* botones */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPaused(v => !v)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7] hover:bg-[#4FC3F7]/20 transition"
            >
              {paused ? '▶ reanudar' : '⏸ pausa'}
            </button>
          </div>

          {/* stats */}
          <div className="grid grid-cols-4 gap-3">
            <Stat label="desempleo" value={`${(stats.u * 100).toFixed(1)}%`} accent="#4FC3F7" />
            <Stat label="vacantes" value={`${(stats.v * 100).toFixed(1)}%`} accent="#FDB813" />
            <Stat label="tensión (θ=v/u)" value={stats.theta.toFixed(2)} accent="#A78BFA" />
            <Stat label="u* teórico" value={`${(stats.uStarCalc * 100).toFixed(1)}%`} accent="#34D399" />
          </div>

          {/* insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">
              ✦ ¿Qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* panel de controles */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Mueve el tianguis
          </div>

          <Slider
            label="Eficiencia del match (A)"
            value={A}
            min={0.15}
            max={1.2}
            step={0.01}
            onChange={setA}
            fmt={v => v < 0.4 ? 'muy difícil' : v < 0.8 ? 'normal' : 'fácil'}
            hint="Qué tan fácil es que se topen un buscador y una vacante. Más alta = plataformas mejores, más networks."
          />

          <Slider
            label="Separación (s): qué tan seguido despiden"
            value={s}
            min={0.01}
            max={0.25}
            step={0.005}
            onChange={setS}
            fmt={v => v < 0.05 ? 'estable' : v < 0.12 ? 'normal' : 'mucha rotación'}
            hint="Alta separación = mucha gente pierde su chamba todo el tiempo. El desempleo friccional sube aunque la economía esté bien."
          />

          <Slider
            label="Costo de la vacante (κ)"
            value={kappa}
            min={0.1}
            max={2.0}
            step={0.05}
            onChange={setKappa}
            fmt={v => v < 0.4 ? 'barato publicar' : v < 1.0 ? 'normal' : 'muy caro publicar'}
            hint="Lo que le cuesta a la empresa publicar y esperar que llegue alguien. Más caro = menos vacantes abiertas."
          />

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed space-y-1">
            <div>m(u,v) = A·u^α·v^(1−α)</div>
            <div>f(θ) = A·θ^(1−α), θ = v/u</div>
            <div>u* = s / (s + f(θ))</div>
            <div className="text-[#334155] pt-1">Diamond-Mortensen-Pissarides (1982-94)</div>
          </div>

          <div className="bg-[#050608] border border-[#1E2A1A] rounded p-3 space-y-1">
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#34D399] font-mono mb-1">
              Para el taquero
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              Tu taquería tiene 2 puestos vacíos y no encuentras a nadie. El barrio tiene 10 personas sin chamba.
              No es que no quieran trabajar: el tianguis es oscuro. Anuncio en Marketplace, pagas mejor, das horario flexible —
              subes la <span className="text-[#FDB813] font-mono">A</span> del modelo. Las vacantes se llenan más rápido y el
              desempleo baja aunque tú seas el único que cambió algo.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ─── helpers de UI ─── */
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
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}
