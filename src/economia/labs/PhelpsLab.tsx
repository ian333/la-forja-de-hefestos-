/**
 * PhelpsLab — laboratorio del premio Nobel 2006 (Edmund Phelps).
 *
 * EL CLICK TAQUERO:
 *   El gobierno baja el desempleo imprimiendo dinero. Funciona dos meses.
 *   Luego los trabajadores se dan cuenta de que su sueldo real no subió y
 *   piden más. La inflación sube y el desempleo regresa igual. Le hiciste
 *   trampa, pero la gente no se deja dos veces. Eso es la curva de Phillips
 *   aumentada por expectativas de Phelps.
 *
 * MODELO REAL (Phelps 1968 / Friedman-Phelps):
 *
 *   Curva de Phillips aumentada por expectativas:
 *     π = πᵉ - α·(u - u*)
 *
 *   donde:
 *     π    = inflación actual
 *     πᵉ   = expectativas de inflación (adaptativas)
 *     u    = tasa de desempleo actual
 *     u*   = NAIRU (tasa natural de desempleo)
 *     α    = pendiente de la curva de corto plazo (aquí α = 1.2)
 *
 *   Dinámica de expectativas adaptativas (Cagan/Phelps):
 *     dπᵉ/dt = λ·(π - πᵉ)     → los agentes aprenden del error pasado
 *
 *   Restricción del banco central (función de reacción simplificada):
 *     El usuario mueve el "estímulo monetario": Δu = u_objetivo − u*
 *     El banco central fuerza u = u* − estímulo (en el corto plazo)
 *     pero a largo plazo u → u* porque πᵉ se ajusta.
 *
 *   NAIRU (u*): fijo en el modelo; aquí parametrizable vía slider.
 *
 *   Coordenadas del canvas:
 *     eje X → desempleo u  [0%, 20%]
 *     eje Y → inflación π  [-4%, 20%]
 *
 *   Se dibujan:
 *     1. Curva de corto plazo (posición actual de πᵉ): línea color acento
 *     2. Curva de largo plazo (vertical en u*): línea blanca punteada
 *     3. Puntos históricos de la simulación (trayectoria)
 *     4. Punto actual (bola naranja)
 */

import { useEffect, useRef, useState } from 'react';

// ─── constantes del canvas ────────────────────────────────────────────────────
const W = 820;
const H = 380;

// rango de ejes
const U_MIN = 0;
const U_MAX = 20;   // % desempleo
const PI_MIN = -4;
const PI_MAX = 20;  // % inflación

// márgenes internos
const ML = 56;  // izquierda (eje Y)
const MR = 24;  // derecha
const MT = 28;  // arriba
const MB = 44;  // abajo

// ─── modelo Phelps ────────────────────────────────────────────────────────────
const ALPHA = 1.2;      // pendiente curva Phillips corto plazo
const LAMBDA = 0.25;    // velocidad de ajuste de expectativas (por segundo)
const SIM_STEP = 1 / 60; // segundos por tick de simulación

// Inflación corto plazo: π = πᵉ - α·(u - u*)
function phillips(piE: number, u: number, uStar: number): number {
  return piE - ALPHA * (u - uStar);
}

// ─── mapeos canvas ────────────────────────────────────────────────────────────
function xOfU(u: number): number {
  return ML + ((u - U_MIN) / (U_MAX - U_MIN)) * (W - ML - MR);
}
function yOfPi(pi: number): number {
  return MT + ((PI_MAX - pi) / (PI_MAX - PI_MIN)) * (H - MT - MB);
}

// ─── tipos ────────────────────────────────────────────────────────────────────
interface SimState {
  u: number;         // desempleo actual (%)
  piE: number;       // expectativas de inflación (%)
  pi: number;        // inflación actual (%)
  acc: number;       // acumulador de tiempo para fixed-step
}

interface HistPoint {
  u: number;
  pi: number;
  piE: number;
  t: number;
}

// ─── helpers para render ──────────────────────────────────────────────────────
function fmtPct(v: number, decimals = 1): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}%`;
}

// ─── componente principal ─────────────────────────────────────────────────────
export default function PhelpsLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // parámetros controlables por el usuario
  const [uStar, setUStar] = useState(5);          // NAIRU (%)
  const [estimulo, setEstimulo] = useState(0);    // reducción forzada de u por encima del NAIRU (pp)
  const [paused, setPaused] = useState(false);

  // refs para el loop de animación (no causan re-renders)
  const simRef = useRef<SimState>({ u: 7, piE: 2, pi: 2, acc: 0 });
  const histRef = useRef<HistPoint[]>([]);
  const paramsRef = useRef({ uStar, estimulo, paused });
  const statsRef = useRef({ u: 7, pi: 2, piE: 2 });
  const [stats, setStats] = useState({ u: 7, pi: 2, piE: 2 });

  // sincronizar params sin causar re-render del loop
  useEffect(() => {
    paramsRef.current = { uStar, estimulo, paused };
  }, [uStar, estimulo, paused]);

  // reset suave cuando cambia uStar: reposiciona en equilibrio de largo plazo
  function handleResetEquilibrio() {
    simRef.current = { u: uStar, piE: 2, pi: 2, acc: 0 };
    histRef.current = [];
  }

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
    let last = performance.now();
    let frame = 0;

    // ── simulación Phelps (paso fijo) ─────────────────────────────────────────
    function tick(h: number) {
      const p = paramsRef.current;
      const sim = simRef.current;

      // El "estímulo monetario" fuerza u por debajo de u*
      // u_objetivo = u* - estimulo  (estimulo ∈ [0, u* - 1])
      const uTarget = Math.max(1, p.uStar - p.estimulo);

      // Ajuste parcial de u hacia el objetivo (con inercia)
      sim.u += (uTarget - sim.u) * Math.min(1, 1.5 * h);
      sim.u = Math.max(0.5, Math.min(U_MAX - 0.5, sim.u));

      // Inflación de corto plazo según curva de Phillips aumentada
      sim.pi = phillips(sim.piE, sim.u, p.uStar);
      sim.pi = Math.max(PI_MIN, Math.min(PI_MAX, sim.pi));

      // Expectativas adaptativas: los agentes aprenden del error
      const dPiE = LAMBDA * (sim.pi - sim.piE);
      sim.piE += dPiE * h;
      sim.piE = Math.max(-3, Math.min(PI_MAX, sim.piE));
    }

    // ── draw ──────────────────────────────────────────────────────────────────
    function draw(now: number) {
      if (!ctx) return;
      const p = paramsRef.current;
      const sim = simRef.current;

      // ── fondo ────────────────────────────────────────────────────────────
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#05060A');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── ejes ─────────────────────────────────────────────────────────────
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;

      // líneas de cuadrícula horizontales (inflación)
      for (const piTick of [-2, 0, 2, 4, 6, 8, 10, 14, 18]) {
        if (piTick < PI_MIN || piTick > PI_MAX) continue;
        const y = yOfPi(piTick);
        ctx.beginPath();
        ctx.moveTo(ML, y);
        ctx.lineTo(W - MR, y);
        ctx.stroke();
        // etiqueta
        ctx.fillStyle = piTick === 0 ? '#64748B' : '#334155';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${piTick}%`, ML - 6, y + 3.5);
      }

      // líneas de cuadrícula verticales (desempleo)
      for (const uTick of [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]) {
        const x = xOfU(uTick);
        ctx.beginPath();
        ctx.moveTo(x, MT);
        ctx.lineTo(x, H - MB);
        ctx.stroke();
        ctx.fillStyle = '#334155';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${uTick}%`, x, H - MB + 14);
      }

      // etiquetas de ejes
      ctx.fillStyle = '#475569';
      ctx.font = '11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('desempleo (u)', ML + (W - ML - MR) / 2, H - 4);

      ctx.save();
      ctx.translate(13, MT + (H - MT - MB) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('inflación (π)', 0, 0);
      ctx.restore();

      // línea de inflación cero
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(ML, yOfPi(0));
      ctx.lineTo(W - MR, yOfPi(0));
      ctx.stroke();
      ctx.setLineDash([]);

      // ── curva de largo plazo (vertical en u*) ────────────────────────────
      const xStar = xOfU(p.uStar);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(xStar, MT);
      ctx.lineTo(xStar, H - MB);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NAIRU', xStar, MT - 8);
      ctx.fillText(`u*=${p.uStar.toFixed(1)}%`, xStar, MT + 2);

      // ── curva de Phillips de corto plazo (posición de πᵉ actual) ─────────
      // π = πᵉ - α·(u - u*) → una línea recta en el espacio (u, π)
      // Con la posición actual de πᵉ:
      const currentPiE = sim.piE;
      ctx.strokeStyle = '#F472B6';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#F472B6';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      let first = true;
      for (let i = 0; i <= 80; i++) {
        const u = U_MIN + (i / 80) * (U_MAX - U_MIN);
        const pi = phillips(currentPiE, u, p.uStar);
        if (pi < PI_MIN - 1 || pi > PI_MAX + 1) continue;
        const x = xOfU(u);
        const y = yOfPi(Math.max(PI_MIN, Math.min(PI_MAX, pi)));
        if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // etiqueta de la curva de corto plazo
      const labelU = Math.min(p.uStar + 6, U_MAX - 1);
      const labelPi = phillips(currentPiE, labelU, p.uStar);
      if (labelPi > PI_MIN && labelPi < PI_MAX) {
        ctx.fillStyle = '#F472B6';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`CP (πᵉ=${currentPiE.toFixed(1)}%)`, xOfU(labelU) + 4, yOfPi(labelPi) - 4);
      }

      // ── trayectoria histórica ─────────────────────────────────────────────
      const hist = histRef.current;
      if (hist.length > 1) {
        ctx.strokeStyle = 'rgba(251,146,60,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(xOfU(hist[0].u), yOfPi(hist[0].pi));
        for (let i = 1; i < hist.length; i++) {
          ctx.lineTo(xOfU(hist[i].u), yOfPi(hist[i].pi));
        }
        ctx.stroke();

        // puntos históricos pequeños
        for (let i = 0; i < hist.length; i += 3) {
          const h2 = hist[i];
          const alpha = 0.2 + 0.5 * (i / hist.length);
          ctx.fillStyle = `rgba(251,146,60,${alpha.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(xOfU(h2.u), yOfPi(h2.pi), 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ── punto actual (la economía) ────────────────────────────────────────
      const bx = xOfU(sim.u);
      const by = yOfPi(sim.pi);
      ctx.save();
      ctx.shadowColor = '#FB923C';
      ctx.shadowBlur = 18;
      const grad = ctx.createRadialGradient(bx - 3, by - 3, 1, bx, by, 10);
      grad.addColorStop(0, '#FEF3C7');
      grad.addColorStop(1, '#F59E0B');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // etiqueta del punto
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`u=${sim.u.toFixed(1)}%  π=${sim.pi.toFixed(1)}%`, bx + 13, by + 4);

      // ── leyenda de estado ─────────────────────────────────────────────────
      const gap = sim.u - p.uStar;
      const piE = sim.piE;
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px ui-sans-serif, system-ui';

      let msg = '';
      let msgColor = '#34D399';

      if (Math.abs(gap) < 0.2 && Math.abs(sim.pi - piE) < 0.3) {
        msg = `✓ largo plazo: u = u* = ${p.uStar.toFixed(1)}% · πᵉ estable en ${piE.toFixed(1)}%`;
        msgColor = '#34D399';
      } else if (gap < -0.3 && sim.pi > piE + 0.2) {
        msg = `▲ TRAMPA: u<u* → inflación sube (${sim.pi.toFixed(1)}%) · πᵉ se ajusta → perderás el empleo`;
        msgColor = '#EF4444';
      } else if (piE > 6) {
        msg = `⚠ expectativas desancladas: πᵉ = ${piE.toFixed(1)}% — se necesita medicina amarga`;
        msgColor = '#F59E0B';
      } else if (gap < -0.3) {
        msg = `↗ estímulo activo: empleo baja, inflación sube… pero πᵉ ya está aprendiendo`;
        msgColor = '#FB923C';
      } else {
        msg = `← retorno al NAIRU: expectativas corrigiendo, curva CP desplazándose`;
        msgColor = '#4FC3F7';
      }

      ctx.fillStyle = msgColor;
      ctx.fillText(msg, W / 2, H - MB + 30);

      if (p.paused) {
        ctx.fillStyle = 'rgba(5,6,10,0.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 16px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⏸ en pausa', W / 2, H / 2);
      }

      // actualizar stats cada 8 frames
      if (frame % 8 === 0) {
        statsRef.current = { u: sim.u, pi: sim.pi, piE: sim.piE };
        setStats({ u: sim.u, pi: sim.pi, piE: sim.piE });
      }
    }

    // ── loop principal ────────────────────────────────────────────────────────
    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!paramsRef.current.paused) {
        simRef.current.acc += dt;
        while (simRef.current.acc >= SIM_STEP) {
          tick(SIM_STEP);
          simRef.current.acc -= SIM_STEP;
        }

        // registrar trayectoria (cada ~6 frames)
        if (frame % 6 === 0) {
          const sim = simRef.current;
          histRef.current.push({ u: sim.u, pi: sim.pi, piE: sim.piE, t: now });
          if (histRef.current.length > 200) histRef.current.shift();
        }
      }

      draw(now);
      frame++;
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── lógica del insight para el panel ────────────────────────────────────────
  const gapPiE = stats.piE - 2;
  const gapU   = stats.u - uStar;

  const insight =
    estimulo > 1.5
      ? `Estás forzando el desempleo ${estimulo.toFixed(1)} puntos abajo del NAIRU. La inflación sube porque el banco central "imprime". Al principio parece que funciona. Pero πᵉ se mueve hacia arriba: la curva CP se desplaza y la trampa se cierra sola.`
      : Math.abs(gapPiE) < 0.5 && Math.abs(gapU) < 0.3
      ? `Estás en el equilibrio de largo plazo: u ≈ u* = ${uStar}% y πᵉ ≈ π. La curva CP y la curva LP se cruzan justo aquí. Sin estímulo, ninguna palanca monetaria puede empujarte fuera de aquí de forma permanente.`
      : gapPiE > 2
      ? `Las expectativas de inflación ya subieron a ${stats.piE.toFixed(1)}%. La curva de corto plazo se desplazó hacia arriba. Aunque bajes el estímulo, recuperar la credibilidad tarda meses o años — la "medicina amarga" de subir tasas.`
      : `Observa la bola naranja: aunque el estímulo la empuje hacia la izquierda (menos desempleo), el ajuste de expectativas la regresa al NAIRU. Sube el estímulo para ver el ciclo completo.`;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* ── canvas + botones ── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* botones de control */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPaused(v => !v)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7] hover:bg-[#4FC3F7]/20 transition"
            >
              {paused ? '▶ reanudar' : '⏸ pausa'}
            </button>
            <button
              onClick={handleResetEquilibrio}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#FDB813]/40 bg-[#FDB813]/10 text-[#FDB813] hover:bg-[#FDB813]/20 transition"
            >
              ↺ equilibrio inicial
            </button>
            <button
              onClick={() => {
                simRef.current.piE = Math.min(PI_MAX, simRef.current.piE + 5);
                histRef.current = [];
              }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 transition"
            >
              🔥 shock de expectativas (+5%)
            </button>
          </div>

          {/* stats */}
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="desempleo actual"
              value={`${stats.u.toFixed(1)}%`}
              accent={Math.abs(stats.u - uStar) < 0.3 ? '#34D399' : '#EF4444'}
            />
            <Stat
              label="inflación π"
              value={fmtPct(stats.pi)}
              accent={stats.pi > 6 ? '#EF4444' : stats.pi > 3 ? '#F59E0B' : '#4FC3F7'}
            />
            <Stat
              label="expectativas πᵉ"
              value={fmtPct(stats.piE)}
              accent={stats.piE > 5 ? '#EF4444' : '#F472B6'}
            />
          </div>

          {/* insight dinámico */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#F472B6] font-mono mb-2">
              ✦ ¿Qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── panel de controles ── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Maneja la política monetaria
          </div>

          <Slider
            label="Tasa natural de desempleo (NAIRU)"
            value={uStar}
            min={2}
            max={12}
            step={0.5}
            onChange={v => { setUStar(v); handleResetEquilibrio(); }}
            fmt={v => `u* = ${v.toFixed(1)}%`}
            hint="En México ronda 3-4%. En EE.UU. ~4.5%. Estructural: no lo baja ni el banco central."
          />

          <Slider
            label="Estímulo monetario (bajar u)"
            value={estimulo}
            min={0}
            max={Math.max(0, uStar - 1.5)}
            step={0.1}
            onChange={setEstimulo}
            fmt={v => v < 0.2 ? 'sin estímulo' : v < 1.5 ? 'moderado' : 'agresivo'}
            hint="Simula imprimir dinero / bajar tasas para crear empleo. ¿Dura? Sube al máximo y observa πᵉ."
          />

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed space-y-1">
            <div className="text-[#64748B] font-bold">Modelo exacto:</div>
            <div>π = πᵉ − α·(u − u*)</div>
            <div>dπᵉ/dt = λ·(π − πᵉ)</div>
            <div className="pt-1">α = {ALPHA} · λ = {LAMBDA}/s</div>
            <div className="pt-1 text-[#334155]">
              CP = curva Phillips corto plazo<br />
              LP = curva largo plazo (vertical)
            </div>
            <div className="pt-2 text-[#475569]">
              Phelps (1968) · Nobel 2006
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── componentes auxiliares ───────────────────────────────────────────────────

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
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
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
  hint,
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
        className="w-full accent-[#F472B6]"
      />
      {hint && (
        <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>
      )}
    </div>
  );
}
