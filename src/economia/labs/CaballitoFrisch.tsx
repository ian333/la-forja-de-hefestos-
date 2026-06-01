/**
 * CaballitoFrisch — laboratorio interactivo del premio 1969 (Frisch & Tinbergen).
 *
 * El modelo "rocking horse" de Frisch (1933): la economía es un oscilador
 * con inercia, golpeado por impulsos al azar. La física es REAL y exacta:
 *
 *     ẍ + 2ζω·ẋ + ω²·x = Σ impulsos(t)
 *
 *   x  = desviación de la economía respecto a su tendencia (output gap)
 *   ω  = frecuencia natural  = 2π / (longitud del ciclo)
 *   ζ  = amortiguamiento (0<ζ<1 → sub-amortiguado, oscila y se calma)
 *   impulsos = golpes (sticks) que llegan a tasa de Poisson, signo y
 *              magnitud aleatorios → patean la velocidad ẋ.
 *
 * El punto pedagógico (y el teorema de Frisch): aunque los golpes son puro
 * ruido sin correlación, el sistema los FILTRA hacia su frecuencia natural.
 * Por eso el output se ve cíclico y regular sin que nadie agende el ciclo.
 * Apaga los golpes y el caballito se queda quieto: el ciclo no nace del azar,
 * nace de cómo el mecanismo digiere el azar.
 *
 * Integración: Euler semi-implícito (simpléctico) con paso fijo h=1/120 y
 * acumulador, desacoplado del framerate. Sin React Three Fiber: canvas 2D
 * (la economía vive en el plano tiempo→valor).
 */

import { useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Parámetros y configuración

interface Params {
  /** Longitud del ciclo natural, en "temporadas" (s de simulación). */
  cycleLen: number;
  /** Amortiguamiento ζ. Bajo = oscila mucho; alto = se calma rápido. */
  zeta: number;
  /** Fuerza típica de cada golpe. */
  shockMag: number;
  /** Golpes por temporada (tasa de Poisson). */
  shockRate: number;
  /** ¿Llegan golpes? */
  shocksOn: boolean;
  /** ¿Corriendo o en pausa? */
  paused: boolean;
}

const DEFAULTS: Params = {
  cycleLen: 3.4,
  zeta: 0.07,
  shockMag: 1.2,
  shockRate: 1.3,
  shocksOn: true,
  paused: false,
};

const W = 820;
const H = 380;
const STAGE_H = 116;          // franja superior: el caballito
const N = 760;                // muestras en el buffer del cronograma
const STEP = 1 / 120;         // paso físico fijo

interface Preset {
  label: string;
  hint: string;
  p: Partial<Params>;
}

const PRESETS: Preset[] = [
  {
    label: 'Sin golpes',
    hint: 'Apaga el azar. El caballito se queda quieto: el ciclo NO nace del azar.',
    p: { shocksOn: false },
  },
  {
    label: 'Economía nerviosa',
    hint: 'Golpes fuertes y seguidos, poca calma. Vaivenes salvajes.',
    p: { shocksOn: true, zeta: 0.04, shockMag: 1.8, shockRate: 2.6, cycleLen: 3.0 },
  },
  {
    label: 'Economía amortiguada',
    hint: 'Cada golpe se diluye rápido. Aburrida, pero estable.',
    p: { shocksOn: true, zeta: 0.42, shockMag: 1.4, shockRate: 1.6, cycleLen: 3.4 },
  },
  {
    label: 'Boom y bust',
    hint: 'El punto de Frisch: golpes al azar, vaivén regular y limpio.',
    p: { shocksOn: true, zeta: 0.05, shockMag: 1.1, shockRate: 1.0, cycleLen: 3.6 },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Estado mutable de la simulación (refs, no React state — no re-render)

interface SimState {
  x: number;
  v: number;
  t: number;
  flash: number;       // brillo del último golpe [0..1]
  buf: number[];       // cronograma de x
  ampScale: number;    // autoescala suavizada del eje vertical
}

function makeSim(): SimState {
  return { x: 0, v: 0, t: 0, flash: 0, buf: [], ampScale: 1.5 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente

export default function CaballitoFrisch() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS });
  const simRef = useRef<SimState>(makeSim());
  const whackRef = useRef<boolean>(false);

  const [cycleLen, setCycleLen] = useState(DEFAULTS.cycleLen);
  const [zeta, setZeta] = useState(DEFAULTS.zeta);
  const [shockMag, setShockMag] = useState(DEFAULTS.shockMag);
  const [shockRate, setShockRate] = useState(DEFAULTS.shockRate);
  const [shocksOn, setShocksOn] = useState(DEFAULTS.shocksOn);
  const [paused, setPaused] = useState(DEFAULTS.paused);

  const [stats, setStats] = useState({ gap: 0, amp: 0, recPct: 0 });

  // Mantener paramsRef en sync con el estado de los sliders.
  useEffect(() => {
    paramsRef.current = { cycleLen, zeta, shockMag, shockRate, shocksOn, paused };
  }, [cycleLen, zeta, shockMag, shockRate, shocksOn, paused]);

  // Loop de simulación + render. Se monta una sola vez.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Crisp en pantallas retina.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let frame = 0;

    function step(h: number) {
      const p = paramsRef.current;
      const sim = simRef.current;
      const omega = (2 * Math.PI) / p.cycleLen;

      // Golpe manual (botón ¡Golpea!).
      if (whackRef.current) {
        sim.v += (Math.random() < 0.5 ? -1 : 1) * (1.6 + Math.random()) * 3;
        sim.flash = 1;
        whackRef.current = false;
      }
      // Golpes al azar (proceso de Poisson): prob = tasa · h por paso.
      if (p.shocksOn && Math.random() < p.shockRate * h) {
        sim.v += (Math.random() * 2 - 1) * p.shockMag * 3;
        sim.flash = 1;
      }

      // Oscilador amortiguado forzado: ẍ = -2ζω·ẋ - ω²·x  (Euler semi-implícito)
      const a = -2 * p.zeta * omega * sim.v - omega * omega * sim.x;
      sim.v += a * h;
      sim.x += sim.v * h;
      sim.t += h;
      sim.flash = Math.max(0, sim.flash - h * 3.5);

      // Una muestra por paso → 1px por muestra (ventana ≈ 6.3 s).
      sim.buf.push(sim.x);
      if (sim.buf.length > N) sim.buf.shift();
    }

    function draw() {
      if (!ctx) return;
      const sim = simRef.current;
      const p = paramsRef.current;

      // Fondo.
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── Franja del caballito ──────────────────────────────────────────
      const hx = W / 2;
      const hy = STAGE_H - 30;
      const tilt = Math.max(-1, Math.min(1, sim.x / sim.ampScale)) * 0.42;

      // Mecedora (arco bajo el caballito).
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(hx, hy + 20, 40, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();

      // El garrote que golpea (flash).
      if (sim.flash > 0.02) {
        ctx.save();
        ctx.globalAlpha = sim.flash;
        ctx.strokeStyle = '#FDB813';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(hx + 78, hy - 54);
        ctx.lineTo(hx + 30, hy - 12);
        ctx.stroke();
        // chispa
        ctx.fillStyle = '#FEF3C7';
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(hx + 24 + Math.cos(ang) * 12, hy - 8 + Math.sin(ang) * 12, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // El caballito (emoji, rotado por el tilt).
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(tilt);
      ctx.font = '46px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🐴', 0, -8);
      ctx.restore();

      ctx.fillStyle = '#64748B';
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('los golpes llegan al azar →', 16, 22);
      ctx.textAlign = 'right';
      ctx.fillText('↓ y abajo sale el ciclo', W - 16, 22);

      // ── Cronograma (el ciclo económico) ───────────────────────────────
      const cx0 = 16;
      const cx1 = W - 16;
      const cyTop = STAGE_H + 16;
      const cyBot = H - 24;
      const midY = (cyTop + cyBot) / 2;
      const half = (cyBot - cyTop) / 2 - 6;

      // Autoescala suave del eje vertical.
      let maxAbs = 0.6;
      for (let i = 0; i < sim.buf.length; i++) {
        const ax = Math.abs(sim.buf[i]);
        if (ax > maxAbs) maxAbs = ax;
      }
      const target = Math.max(1.2, maxAbs * 1.15);
      sim.ampScale += (target - sim.ampScale) * 0.05;
      const A = sim.ampScale;

      const yOf = (xv: number) =>
        midY - Math.max(-1.12, Math.min(1.12, xv / A)) * half;

      // Relleno tipo latido: línea vertical por muestra (verde auge / rojo recesión).
      const len = sim.buf.length;
      if (len > 1) {
        const dx = (cx1 - cx0) / (N - 1);
        for (let i = 0; i < len; i++) {
          const xv = sim.buf[i];
          const px = cx0 + i * dx;
          ctx.strokeStyle = xv >= 0 ? 'rgba(52,211,153,0.10)' : 'rgba(239,68,68,0.11)';
          ctx.lineWidth = dx + 0.6;
          ctx.beginPath();
          ctx.moveTo(px, midY);
          ctx.lineTo(px, yOf(xv));
          ctx.stroke();
        }
      }

      // Línea de tendencia (cero).
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx0, midY);
      ctx.lineTo(cx1, midY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('tendencia normal', cx0 + 4, midY - 5);

      // La curva del ciclo, con glow.
      if (len > 1) {
        const dx = (cx1 - cx0) / (N - 1);
        ctx.save();
        ctx.shadowColor = '#34D399';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = '#5EEAD4';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const px = cx0 + i * dx;
          const py = yOf(sim.buf[i]);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();

        // Punto actual.
        const lastPx = cx0 + (len - 1) * dx;
        const lastPy = yOf(sim.buf[len - 1]);
        ctx.fillStyle = '#ECFEFF';
        ctx.beginPath();
        ctx.arc(lastPx, lastPy, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Etiqueta de estado.
        const cur = sim.buf[len - 1];
        ctx.textAlign = 'right';
        ctx.font = 'bold 12px ui-monospace, monospace';
        if (cur >= 0.05) {
          ctx.fillStyle = '#34D399';
          ctx.fillText('▲ AUGE', cx1 - 4, cyTop + 14);
        } else if (cur <= -0.05) {
          ctx.fillStyle = '#EF4444';
          ctx.fillText('▼ RECESIÓN', cx1 - 4, cyTop + 14);
        }
      }

      // Pausa overlay.
      if (p.paused) {
        ctx.fillStyle = 'rgba(5,6,10,0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 16px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⏸ en pausa', W / 2, H / 2 + 30);
      }

      // Stats throttled (~5/s).
      if (frame % 12 === 0 && len > 4) {
        let mn = Infinity;
        let mx = -Infinity;
        let neg = 0;
        for (let i = 0; i < len; i++) {
          const xv = sim.buf[i];
          if (xv < mn) mn = xv;
          if (xv > mx) mx = xv;
          if (xv < 0) neg++;
        }
        setStats({
          gap: sim.buf[len - 1],
          amp: (mx - mn) / 2,
          recPct: neg / len,
        });
      }
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!paramsRef.current.paused) {
        acc += dt;
        while (acc >= STEP) {
          step(STEP);
          acc -= STEP;
        }
      }
      draw();
      frame++;
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  function applyPreset(preset: Preset) {
    const merged = { ...paramsRef.current, ...preset.p };
    setCycleLen(merged.cycleLen);
    setZeta(merged.zeta);
    setShockMag(merged.shockMag);
    setShockRate(merged.shockRate);
    setShocksOn(merged.shocksOn);
  }

  function reset() {
    simRef.current = makeSim();
    setStats({ gap: 0, amp: 0, recPct: 0 });
  }

  // Texto dinámico de lectura según parámetros.
  const insight = !shocksOn
    ? 'Apagaste los golpes. El caballito se frena solo y se queda en la tendencia. SIN sorpresas no hay ciclo: el vaivén no nace del azar, nace de cómo el mecanismo lo digiere.'
    : zeta > 0.3
      ? 'Amortiguamiento alto: cada golpe se diluye casi de inmediato. La economía vuelve rapidísimo a su normal. Estable… y aburrida.'
      : zeta < 0.08
        ? 'Amortiguamiento bajo: cada golpe deja una onda larga. Mira el ritmo — golpes al azar, pero vaivén regular. ESE es el ciclo económico de Frisch.'
        : 'Golpes al azar entrando arriba; abajo sale un vaivén con ritmo propio. Sube la fuerza o baja la calma y verás los ciclos crecer.';

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* Escenario */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Controles de reproducción */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPaused(p => !p)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399] hover:bg-[#34D399]/20 transition"
            >
              {paused ? '▶ reanudar' : '⏸ pausa'}
            </button>
            <button
              onClick={() => { whackRef.current = true; }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#FDB813]/40 bg-[#FDB813]/10 text-[#FDB813] hover:bg-[#FDB813]/20 transition"
            >
              🏏 ¡golpéalo tú!
            </button>
            <button
              onClick={reset}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#475569] hover:text-[#CBD5E1] transition"
            >
              ↺ reiniciar
            </button>
            <button
              onClick={() => setShocksOn(s => !s)}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                shocksOn
                  ? 'border-[#F472B6]/40 bg-[#F472B6]/10 text-[#F472B6] hover:bg-[#F472B6]/20'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              {shocksOn ? '⚡ golpes: ON' : '○ golpes: OFF'}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="estado ahora" value={fmtGap(stats.gap)} accent={stats.gap >= 0 ? '#34D399' : '#EF4444'} />
            <Stat label="amplitud del ciclo" value={stats.amp.toFixed(2)} accent="#5EEAD4" />
            <Stat label="tiempo en recesión" value={`${(stats.recPct * 100).toFixed(0)}%`} accent={stats.recPct > 0.5 ? '#EF4444' : '#94A3B8'} />
          </div>

          {/* Lectura dinámica */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#34D399] font-mono mb-2">
              ✦ ¿Qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* Controles */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Cómo es tu economía
          </div>

          <Slider
            label="Ritmo natural"
            value={cycleLen}
            min={1.6} max={7} step={0.1}
            onChange={setCycleLen}
            fmt={v => `${v.toFixed(1)} temporadas`}
            hint="Cada cuánto sube y baja por su cuenta. Largo = olas anchas y lentas."
          />
          <Slider
            label="Qué tan rápido se calma"
            value={zeta}
            min={0.02} max={0.5} step={0.01}
            onChange={setZeta}
            fmt={v => v.toFixed(2)}
            hint="Bajo = los golpes dejan ondas largas. Alto = vuelve a la normal de volada."
          />
          <Slider
            label="Fuerza de los golpes"
            value={shockMag}
            min={0.2} max={3} step={0.1}
            onChange={setShockMag}
            fmt={v => `× ${v.toFixed(1)}`}
            hint="Qué tan duro pega cada sorpresa (una sequía, una feria, una crisis)."
          />
          <Slider
            label="Qué tan seguido llegan"
            value={shockRate}
            min={0} max={4} step={0.1}
            onChange={setShockRate}
            fmt={v => `${v.toFixed(1)} / temporada`}
            hint="Frecuencia de las sorpresas. En 0, no llega ninguna."
          />

          {/* Presets */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono mb-2">
              Escenarios
            </div>
            <div className="space-y-1.5">
              {PRESETS.map(preset => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className="w-full text-left px-3 py-2 border border-[#1E293B] rounded hover:border-[#34D399]/40 hover:bg-[#34D399]/5 transition"
                >
                  <div className="text-[12px] text-[#E2E8F0] font-medium">{preset.label}</div>
                  <div className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{preset.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo: ẍ + 2ζω·ẋ + ω²·x = golpes<br />
            (Frisch 1933 · oscilador amortiguado forzado)
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponentes

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
        <span className="text-[12px] font-mono text-[#FDB813]">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#34D399]"
      />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}

function fmtGap(g: number): string {
  const sign = g >= 0 ? '+' : '';
  return `${sign}${g.toFixed(2)}`;
}
