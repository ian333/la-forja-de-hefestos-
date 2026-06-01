/**
 * SolowLab — laboratorio del premio 1987 (Robert Solow).
 *
 * El click: puedes duplicar fábricas para siempre y seguirás estancado.
 * El verdadero motor del crecimiento es la tecnología (TFP): el "residuo"
 * que Solow midió en EE.UU. y que explicó más de la mitad del crecimiento.
 *
 * Modelo REAL (Solow 1956, forma intensiva por trabajador eficiente):
 *
 *   Producción:   y = k^α            (por trabajador eficiente, A=1 base)
 *   Ahorro:       s·y = s·k^α        (inversión bruta por trab. ef.)
 *   Depreciación + crecimiento poblacional + TFP:
 *                 (δ + n + g)·k      (inversión de reposición)
 *   Dinámica:     dk/dt = s·k^α − (δ + n + g)·k
 *   Estado estacionario:  k* = (s/(δ+n+g))^(1/(1−α))
 *
 * El parámetro g (crecimiento TFP) desplaza toda la curva de break-even
 * hacia arriba → k* cae. Pero el ingreso POR TRABAJADOR ORIGINAL
 * sigue creciendo a tasa g. Solo la TFP rompe el techo del crecimiento.
 *
 * Para el taquero: cada freidora que agregas rinde menos que la anterior
 * (rendimientos decrecientes). Lo que te dispara es aprender algo nuevo.
 */

import { useEffect, useRef, useState } from 'react';

/* ─── Dimensiones del canvas ─────────────────────────────── */
const W = 820;
const H = 390;

/* ─── Modelo Solow ───────────────────────────────────────── */
const ALPHA = 0.35;          // elasticidad del capital (empírica típica)
const K_MAX = 12;            // capital máximo en el eje x (unidades intensivas)
const K_STEPS = 300;         // puntos para trazar curvas

/** y = k^α  (producción por trab. eficiente) */
function f(k: number): number {
  return Math.pow(Math.max(0, k), ALPHA);
}

/** dk/dt = s·k^α − (δ+n+g)·k */
function dkdt(k: number, s: number, delta: number, n: number, g: number): number {
  return s * f(k) - (delta + n + g) * k;
}

/** k* analítico = (s/(δ+n+g))^(1/(1-α)) */
function kStar(s: number, delta: number, n: number, g: number): number {
  const phi = delta + n + g;
  if (phi <= 0) return K_MAX;
  return Math.pow(s / phi, 1 / (1 - ALPHA));
}

/* ─── Parámetros del slider ──────────────────────────────── */
interface Params {
  s: number;      // tasa de ahorro  0.05..0.45
  delta: number;  // depreciación    0.03..0.15
  n: number;      // crecimiento n   0.00..0.04
  g: number;      // crecimiento TFP 0.00..0.06
}

const DEFAULTS: Params = { s: 0.20, delta: 0.07, n: 0.01, g: 0.02 };

/* ─── Simulación de la "canica" (capital actual) ─────────── */
interface Sim { k: number; vk: number; dragging: boolean; }

/* ─── Mapeo canvas ───────────────────────────────────────── */
const PAD_L = 54, PAD_R = 28, PAD_T = 40, PAD_B = 60;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

function xOfK(k: number): number {
  return PAD_L + (k / K_MAX) * PLOT_W;
}
function kOfX(x: number): number {
  return Math.max(0.05, Math.min(K_MAX, ((x - PAD_L) / PLOT_W) * K_MAX));
}

/** Mapea un valor de y (producción) al eje vertical del canvas.
 *  y_max se recalcula en cada frame con los parámetros actuales. */
function yOfVal(val: number, yMax: number): number {
  return PAD_T + PLOT_H - (val / yMax) * PLOT_H;
}

/* ─── Colores ────────────────────────────────────────────── */
const C_BG        = '#0B0F17';
const C_GRID      = '#1E293B';
const C_PROD      = '#34D399';   // curva de producción (verde)
const C_SAVINGS   = '#4FC3F7';   // curva de ahorro s·f(k) (azul)
const C_BREAK     = '#F472B6';   // línea de break-even (rosa)
const C_BALL      = '#FDB813';   // canica (capital actual)
const C_STAR      = '#A78BFA';   // k* equilibrio (violeta)
const C_RESIDUO   = '#FB923C';   // acento TFP (naranja)
const BALL_R      = 11;

const SIM_DT   = 1 / 120;
const SIM_DAMP = 1.8;
const SIM_GAIN = 4.0;

/* ═══════════════════════════════════════════════════════════ */
export default function SolowLab() {

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const paramsRef  = useRef<Params>({ ...DEFAULTS });
  const simRef     = useRef<Sim>({ k: 2.5, vk: 0, dragging: false });
  const pausedRef  = useRef<boolean>(false);

  const [s,     setS]     = useState(DEFAULTS.s);
  const [delta, setDelta] = useState(DEFAULTS.delta);
  const [n,     setN]     = useState(DEFAULTS.n);
  const [g,     setG]     = useState(DEFAULTS.g);
  const [paused, setPaused] = useState(false);
  const [stats, setStats]  = useState({ k: 2.5, ks: 0, dk: 0, y: 0 });

  /* Sincronizar paramsRef y pausedRef con estado React */
  useEffect(() => {
    paramsRef.current = { s, delta, n, g };
  }, [s, delta, n, g]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  /* ─── Loop principal ──────────────────────────────────── */
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

    let raf = 0, last = performance.now(), acc = 0, frame = 0;

    function simStep(h: number) {
      const p  = paramsRef.current;
      const sm = simRef.current;
      if (sm.dragging) { sm.vk = 0; return; }
      const F = dkdt(sm.k, p.s, p.delta, p.n, p.g) * SIM_GAIN;
      sm.vk += F * h;
      sm.vk *= (1 - SIM_DAMP * h);
      sm.k  += sm.vk * h;
      if (sm.k < 0.05) { sm.k = 0.05; sm.vk = 0; }
      if (sm.k > K_MAX) { sm.k = K_MAX; sm.vk = 0; }
    }

    function draw() {
      if (!ctx) return;
      const p  = paramsRef.current;
      const sm = simRef.current;
      const { s: sv, delta: dv, n: nv, g: gv } = p;

      /* Calcular escala vertical: máximo entre producción y break-even */
      let yMax = 0.01;
      for (let i = 0; i <= K_STEPS; i++) {
        const k = (i / K_STEPS) * K_MAX;
        const fy = f(k);
        const bk = (dv + nv + gv) * k;
        if (fy > yMax) yMax = fy;
        if (bk > yMax) yMax = bk;
      }
      yMax *= 1.12;  // margen superior

      /* --- Fondo ---*/
      ctx.fillStyle = C_BG;
      ctx.fillRect(0, 0, W, H);

      /* --- Zona de plot --- */
      ctx.save();
      ctx.beginPath();
      ctx.rect(PAD_L, PAD_T, PLOT_W, PLOT_H);
      ctx.clip();

      /* Grid horizontal */
      ctx.strokeStyle = C_GRID;
      ctx.lineWidth = 1;
      const gridTicks = 5;
      for (let i = 1; i < gridTicks; i++) {
        const y = PAD_T + (i / gridTicks) * PLOT_H;
        ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(PAD_L + PLOT_W, y); ctx.stroke();
      }
      /* Grid vertical */
      for (let i = 1; i < 6; i++) {
        const x = PAD_L + (i / 6) * PLOT_W;
        ctx.beginPath(); ctx.moveTo(x, PAD_T); ctx.lineTo(x, PAD_T + PLOT_H); ctx.stroke();
      }

      /* --- Área bajo la curva de producción (sombreado sutil) --- */
      ctx.beginPath();
      for (let i = 0; i <= K_STEPS; i++) {
        const k  = (i / K_STEPS) * K_MAX;
        const px = xOfK(k);
        const py = yOfVal(f(k), yMax);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.lineTo(xOfK(K_MAX), PAD_T + PLOT_H);
      ctx.lineTo(PAD_L, PAD_T + PLOT_H);
      ctx.closePath();
      ctx.fillStyle = 'rgba(52,211,153,0.05)';
      ctx.fill();

      /* --- Curva de producción y = k^α --- */
      ctx.beginPath();
      for (let i = 0; i <= K_STEPS; i++) {
        const k  = (i / K_STEPS) * K_MAX;
        const px = xOfK(k);
        const py = yOfVal(f(k), yMax);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = C_PROD; ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);

      /* --- Curva de ahorro s·y = s·k^α --- */
      ctx.beginPath();
      for (let i = 0; i <= K_STEPS; i++) {
        const k  = (i / K_STEPS) * K_MAX;
        const px = xOfK(k);
        const py = yOfVal(sv * f(k), yMax);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = C_SAVINGS; ctx.lineWidth = 2.5; ctx.stroke();

      /* --- Línea de break-even (δ+n+g)·k --- */
      const phi = dv + nv + gv;
      ctx.beginPath();
      for (let i = 0; i <= K_STEPS; i++) {
        const k  = (i / K_STEPS) * K_MAX;
        const px = xOfK(k);
        const py = yOfVal(phi * k, yMax);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = C_BREAK; ctx.lineWidth = 2.5; ctx.stroke();

      /* --- Línea vertical k* --- */
      const ks   = kStar(sv, dv, nv, gv);
      const ksx  = xOfK(Math.min(ks, K_MAX));
      const ksY1 = PAD_T + PLOT_H;
      const ksY2 = yOfVal(sv * f(Math.min(ks, K_MAX)), yMax);
      ctx.strokeStyle = C_STAR; ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(ksx, ksY1); ctx.lineTo(ksx, ksY2); ctx.stroke();
      ctx.setLineDash([]);

      /* --- Punto de intersección k* --- */
      ctx.save();
      ctx.shadowColor = C_STAR; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(ksx, ksY2, 5, 0, Math.PI * 2);
      ctx.fillStyle = C_STAR; ctx.fill();
      ctx.restore();

      /* --- Flecha de presión sobre la canica (dk/dt) --- */
      const currentDK = dkdt(sm.k, sv, dv, nv, gv);
      const ballX  = xOfK(sm.k);
      const ballSY = yOfVal(sv * f(sm.k), yMax);
      const ballBY = yOfVal(phi * sm.k,   yMax);
      /* Segmento vertical entre las dos curvas en k actual */
      if (Math.abs(currentDK) > 0.005) {
        const gapColor = currentDK > 0 ? C_SAVINGS : C_BREAK;
        ctx.strokeStyle = gapColor; ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(ballX, ballSY); ctx.lineTo(ballX, ballBY); ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();  // fin clip

      /* --- Canica (capital actual k) --- */
      const bx = xOfK(sm.k);
      const by = yOfVal(sv * f(sm.k), yMax);
      ctx.save();
      ctx.shadowColor = C_BALL; ctx.shadowBlur = 18;
      const grad = ctx.createRadialGradient(bx - 3, by - 3, 2, bx, by, BALL_R);
      grad.addColorStop(0, '#FEF9C3');
      grad.addColorStop(1, '#F59E0B');
      ctx.beginPath(); ctx.arc(bx, by, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = grad; ctx.fill();
      ctx.restore();

      /* --- Etiqueta k actual --- */
      ctx.fillStyle = '#E2E8F0';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`k=${sm.k.toFixed(2)}`, bx, by - BALL_R - 5);

      /* --- Ejes --- */
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(PAD_L, PAD_T); ctx.lineTo(PAD_L, PAD_T + PLOT_H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PAD_L, PAD_T + PLOT_H); ctx.lineTo(PAD_L + PLOT_W, PAD_T + PLOT_H); ctx.stroke();

      /* Tick labels eje X */
      ctx.fillStyle = '#64748B'; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'center';
      for (let i = 0; i <= 6; i++) {
        const k  = (i / 6) * K_MAX;
        const px = xOfK(k);
        ctx.fillText(k.toFixed(0), px, PAD_T + PLOT_H + 14);
      }
      /* Etiqueta eje X */
      ctx.fillStyle = '#94A3B8'; ctx.font = '11px ui-sans-serif, system-ui'; ctx.textAlign = 'center';
      ctx.fillText('capital por trabajador eficiente  k', PAD_L + PLOT_W / 2, H - 10);

      /* Etiqueta eje Y */
      ctx.save();
      ctx.translate(13, PAD_T + PLOT_H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#94A3B8'; ctx.font = '11px ui-sans-serif, system-ui'; ctx.textAlign = 'center';
      ctx.fillText('inversión / depr.', 0, 0);
      ctx.restore();

      /* --- Leyenda ---*/
      const LEG_X = PAD_L + 10;
      const LEG_Y = PAD_T + 12;
      const items: Array<{ color: string; dash: boolean; label: string }> = [
        { color: C_PROD,    dash: true,  label: 'y = kᵅ  (producción)' },
        { color: C_SAVINGS, dash: false, label: 's·y  (ahorro/inversión)' },
        { color: C_BREAK,   dash: false, label: '(δ+n+g)·k  (depreciación+crecimiento)' },
        { color: C_STAR,    dash: true,  label: 'k*  (estado estacionario)' },
      ];
      items.forEach((item, idx) => {
        const ly = LEG_Y + idx * 18;
        ctx.strokeStyle = item.color; ctx.lineWidth = 1.8;
        if (item.dash) ctx.setLineDash([4, 3]); else ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(LEG_X, ly); ctx.lineTo(LEG_X + 22, ly); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = item.color; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'left';
        ctx.fillText(item.label, LEG_X + 27, ly + 4);
      });

      /* --- Mensaje estado --- */
      const dkNow = dkdt(sm.k, sv, dv, nv, gv);
      const nearStar = Math.abs(sm.k - ks) < 0.08;
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px ui-sans-serif, system-ui';
      if (nearStar) {
        ctx.fillStyle = '#34D399';
        ctx.fillText(`✓ estado estacionario  k* ≈ ${ks.toFixed(2)}`, W / 2, H - 22);
      } else if (dkNow > 0.01) {
        ctx.fillStyle = C_SAVINGS;
        ctx.fillText(`▶ el ahorro supera la depreciación → k crece hacia k* = ${ks.toFixed(2)}`, W / 2, H - 22);
      } else if (dkNow < -0.01) {
        ctx.fillStyle = C_BREAK;
        ctx.fillText(`◀ la depreciación supera el ahorro → k cae hacia k* = ${ks.toFixed(2)}`, W / 2, H - 22);
      } else {
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(`equilibrio  k* ≈ ${ks.toFixed(2)}`, W / 2, H - 22);
      }

      /* --- Pausa overlay --- */
      if (pausedRef.current) {
        ctx.fillStyle = 'rgba(5,6,10,0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#E2E8F0'; ctx.font = 'bold 15px ui-sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('⏸ en pausa', W / 2, H / 2);
      }

      /* Actualizar stats cada 8 frames */
      if (frame % 8 === 0) {
        setStats({ k: sm.k, ks: Math.min(ks, K_MAX), dk: dkNow, y: f(sm.k) });
      }
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!pausedRef.current) {
        acc += dt;
        while (acc >= SIM_DT) { simStep(SIM_DT); acc -= SIM_DT; }
      }
      draw(); frame++;
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    /* Arrastre de la canica */
    const setFromPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (W / rect.width);
      simRef.current.k  = kOfX(x);
      simRef.current.vk = 0;
    };
    const onDown = (e: PointerEvent) => { simRef.current.dragging = true;  setFromPointer(e); };
    const onMove = (e: PointerEvent) => { if (simRef.current.dragging) setFromPointer(e); };
    const onUp   = ()                => { simRef.current.dragging = false; };

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove',  onMove);
    window.addEventListener('pointerup',    onUp);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove',  onMove);
      window.removeEventListener('pointerup',    onUp);
    };
  }, []);

  /* ─── Insight contextual ─────────────────────────────── */
  const nearStar = Math.abs(stats.k - stats.ks) < 0.1;
  const gIsHigh  = g > 0.04;
  const sIsHigh  = s > 0.30;

  let insight: string;
  if (gIsHigh && sIsHigh) {
    insight = `Alta TFP Y alto ahorro: la curva de ahorro sube y el break-even también. El estado estacionario (k*≈${stats.ks.toFixed(2)}) crece, pero aun así tiene techo. El crecimiento sostenido de largo plazo sigue viniendo de g (TFP), no del ahorro.`;
  } else if (gIsHigh) {
    insight = `Alta TFP (g=${(g*100).toFixed(1)}%): la línea de break-even sube más rápido, k* es menor. Pero el ingreso POR trabajador original crece sin parar a tasa g. Ese es el "residuo Solow": lo que los países ricos tienen y no es capital.`;
  } else if (sIsHigh) {
    insight = `Ahorro alto (${(s*100).toFixed(0)}%): k* sube — más capital por trabajador. Pero fíjate: los rendimientos decrecientes frenan el crecimiento. Puedes duplicar el ahorro y k* solo sube un poco. Sin TFP, hay un techo.`;
  } else if (nearStar) {
    insight = `La canica está en k*≈${stats.ks.toFixed(2)}: ahorro = depreciación + crecimiento. El capital por trabajador ya no cambia. Para crecer más en el largo plazo, necesitas más tecnología (g) — no más ahorro.`;
  } else {
    insight = `Arrastra la canica a cualquier k. Observa cómo la brecha entre la curva azul (s·y) y la rosa ((δ+n+g)·k) determina si el capital crece o cae. El punto donde se cruzan es k*: el estado estacionario de Solow.`;
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

        {/* ─── Canvas + controles inferiores ─────────────────── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block touch-none cursor-grab"
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
              onClick={() => { simRef.current.k = 0.3; simRef.current.vk = 0; }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#FDB813]/40 bg-[#FDB813]/10 text-[#FDB813] hover:bg-[#FDB813]/20 transition"
            >
              k muy bajo (pobre)
            </button>
            <button
              onClick={() => { simRef.current.k = K_MAX * 0.9; simRef.current.vk = 0; }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399] hover:bg-[#34D399]/20 transition"
            >
              k muy alto (rico)
            </button>
            <button
              onClick={() => {
                setS(DEFAULTS.s); setDelta(DEFAULTS.delta);
                setN(DEFAULTS.n); setG(DEFAULTS.g);
              }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#475569]/60 text-[#64748B] hover:text-[#CBD5E1] transition"
            >
              reset
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <Stat label="k actual" value={stats.k.toFixed(2)} accent={C_BALL} />
            <Stat label="k* (eq.)" value={stats.ks.toFixed(2)} accent={C_STAR} />
            <Stat
              label="dk/dt"
              value={(stats.dk >= 0 ? '+' : '') + stats.dk.toFixed(3)}
              accent={Math.abs(stats.dk) < 0.01 ? '#34D399' : stats.dk > 0 ? C_SAVINGS : C_BREAK}
            />
            <Stat label="y = kᵅ" value={stats.y.toFixed(3)} accent={C_PROD} />
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">
              ✦ ¿qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ─── Panel de controles ────────────────────────────── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Parámetros del modelo
          </div>

          <Slider
            label="Tasa de ahorro  s"
            value={s}
            min={0.05} max={0.45} step={0.01}
            onChange={setS}
            fmt={v => `${(v * 100).toFixed(0)}%`}
            hint="Sube s → la curva azul sube → k* sube. Más ahorro = más capital. Pero hay techo."
            accentColor={C_SAVINGS}
          />

          <Slider
            label="Depreciación  δ"
            value={delta}
            min={0.03} max={0.15} step={0.005}
            onChange={setDelta}
            fmt={v => `${(v * 100).toFixed(1)}%`}
            hint="Más depreciación → la línea rosa sube → k* cae. Las máquinas se oxidan."
            accentColor={C_BREAK}
          />

          <Slider
            label="Crecimiento poblacional  n"
            value={n}
            min={0.00} max={0.04} step={0.005}
            onChange={setN}
            fmt={v => `${(v * 100).toFixed(1)}%`}
            hint="Más gente → capital se diluye entre más trabajadores → línea rosa sube → k* cae."
            accentColor={C_BREAK}
          />

          <div className="rounded-lg border border-[#FB923C]/30 bg-[#FB923C]/05 p-3 space-y-2">
            <Slider
              label="TFP (tecnología)  g"
              value={g}
              min={0.00} max={0.06} step={0.005}
              onChange={setG}
              fmt={v => `${(v * 100).toFixed(1)}%`}
              hint="Este es el 'residuo Solow'. Más g → break-even sube → k* baja. Pero el ingreso real por trabajador crece a tasa g sin límite. Solo aquí escapa el techo."
              accentColor={C_RESIDUO}
            />
            <div className="text-[10px] text-[#FB923C] font-mono leading-snug">
              ▲ el único parámetro sin techo de largo plazo
            </div>
          </div>

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo: dk/dt = s·kᵅ − (δ+n+g)·k<br />
            α = {ALPHA} · estado est.: k* = (s/(δ+n+g))^(1/(1−α))<br />
            Solow, QJE 1956 · Nobel 1987
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-componentes ─────────────────────────────────────── */
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[17px] font-bold font-mono" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function Slider({
  label, value, min, max, step, onChange, fmt, hint, accentColor,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string;
  hint?: string; accentColor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[12px] font-mono" style={{ color: accentColor ?? '#FDB813' }}>
          {fmt ? fmt(value) : value.toFixed(3)}
        </span>
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
