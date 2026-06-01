/**
 * HartHolmstromLab — laboratorio del premio 2016 (Oliver Hart + Bengt Holmström).
 *
 * EL CLICK:
 *   Todo contrato tiene huecos. Nadie puede escribir el futuro completo.
 *   Cuando la realidad llega y el contrato calla, alguien tiene que decidir
 *   — y ese alguien manda de verdad.
 *
 * El lab tiene DOS paneles enlazados:
 *
 * ① PANEL HOLMSTRÖM — El dilema del incentivo.
 *   El agente (empleado) elige esfuerzo e ∈ [0,1].
 *   Producción real: q = e + ε,  ε ~ N(0, σ²).
 *   Contrato lineal de Holmström (1979):
 *     pago = salario_base + β·q
 *   donde β ∈ [0,1] es la intensidad del incentivo.
 *   Esfuerzo óptimo del agente (dado β y costo c):
 *     e*(β) = β / c
 *   Utilidad del agente (CARA, aversión ρ):
 *     CE = pago_esperado − c·e²/2 − ρ·β²·σ²/2
 *   donde el último término es el costo del riesgo que le transfiere el contrato.
 *   El principal elige β que maximiza:
 *     E[q − pago] = (1−β)·e*(β)
 *   Solución de primer orden: β* = 1 / (1 + ρ·c·σ²).
 *   → Con más ruido σ o más aversión ρ: el contrato óptimo paga menos por resultado.
 *
 * ② PANEL HART — Los huecos del contrato.
 *   Animación de 10 burbujas de "escenarios del futuro". Cada burbuja es un
 *   estado del mundo. Los escritos en el contrato (verdes) los resuelve el papel.
 *   Los huecos (rojos) los decide quien tiene el poder residual. El usuario mueve
 *   el slider "completitud del contrato" y ve cuántos escenarios quedan en rojo.
 *
 * Fórmulas estrictamente correctas — Holmström (1979), Hart & Moore (1988).
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ── Dimensiones ─────────────────────────────────────────────────────────────
const W = 820;
const H_TOP = 280;   // panel Holmström (canvas arriba)
const H_BOT = 200;   // panel Hart (canvas abajo)
const H = H_TOP + H_BOT;
const STEP = 1 / 60;

// ── Parámetros del modelo ────────────────────────────────────────────────────
interface Params {
  beta: number;       // intensidad del incentivo [0..1]
  sigma: number;      // ruido del entorno [0.1..1]
  costo: number;      // costo de esfuerzo [0.5..3]
  rho: number;        // aversión al riesgo [0..2]
  completitud: number;// % del contrato que es completo [0..1]
  paused: boolean;
}

const DEFAULTS: Params = {
  beta: 0.5,
  sigma: 0.4,
  costo: 1.2,
  rho: 1.0,
  completitud: 0.4,
  paused: false,
};

// ── Modelo Holmström ─────────────────────────────────────────────────────────
function esfuerzoOptimo(beta: number, costo: number): number {
  return Math.min(1, Math.max(0, beta / costo));
}

function betaOptima(sigma: number, costo: number, rho: number): number {
  return 1 / (1 + rho * costo * sigma * sigma);
}

function certEquivalente(beta: number, sigma: number, costo: number, rho: number): number {
  const e = esfuerzoOptimo(beta, costo);
  const pago = beta * e; // salario base normalizado a 0
  return pago - (costo * e * e) / 2 - (rho * beta * beta * sigma * sigma) / 2;
}

function gananciaPrincipal(beta: number, costo: number): number {
  const e = esfuerzoOptimo(beta, costo);
  return (1 - beta) * e;
}

// ── Estado de simulación ─────────────────────────────────────────────────────
interface SimState {
  // historial de producción observable (dots en canvas)
  history: number[];  // últimas N realizaciones de q
  t: number;
  accum: number;
}

// Partículas para el panel Hart
interface Bubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  label: string;
  covered: boolean; // si el contrato cubre este escenario
}

const SCENARIOS = [
  'pandemia',
  'huelga',
  'innovación',
  'competidor',
  'devaluación',
  'tecnología',
  'proveedor cae',
  'regulación',
  'ola de calor',
  'fusión rival',
];

function makeBubbles(): Bubble[] {
  const seed = [0.15, 0.72, 0.33, 0.88, 0.51, 0.27, 0.64, 0.42, 0.79, 0.19];
  const seed2 = [0.62, 0.38, 0.81, 0.24, 0.57, 0.93, 0.11, 0.69, 0.45, 0.84];
  return SCENARIOS.map((label, i) => ({
    x: 60 + seed[i] * (W - 120),
    y: 30 + seed2[i] * (H_BOT - 60),
    vx: (seed[i] - 0.5) * 0.4,
    vy: (seed2[i] - 0.5) * 0.3,
    r: 26 + i % 3 * 5,
    label,
    covered: false,
  }));
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function HartHolmstromLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS });
  const simRef = useRef<SimState>({ history: [], t: 0, accum: 0 });
  const bubblesRef = useRef<Bubble[]>(makeBubbles());

  const [beta, setBeta] = useState(DEFAULTS.beta);
  const [sigma, setSigma] = useState(DEFAULTS.sigma);
  const [costo, setCosto] = useState(DEFAULTS.costo);
  const [rho, setRho] = useState(DEFAULTS.rho);
  const [completitud, setCompletitud] = useState(DEFAULTS.completitud);
  const [paused, setPaused] = useState(DEFAULTS.paused);

  const [stats, setStats] = useState({
    esfuerzo: 0,
    ganancia: 0,
    certEq: 0,
    betaOpt: 0,
    huecos: 0,
  });

  // Sincroniza params
  useEffect(() => {
    paramsRef.current = { beta, sigma, costo, rho, completitud, paused };
    // Actualizar cobertura de burbujas
    const n = SCENARIOS.length;
    const cubiertos = Math.round(completitud * n);
    bubblesRef.current.forEach((b, i) => { b.covered = i < cubiertos; });
  }, [beta, sigma, costo, rho, completitud, paused]);

  // Gaussian de Box-Muller
  const gauss = useCallback(() => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }, []);

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

    // ── Actualización física ─────────────────────────────────────────────────
    function simStep(dt: number) {
      const p = paramsRef.current;
      const sim = simRef.current;

      sim.accum += dt;
      // Emite una nueva realización de q cada ~0.5 s
      if (sim.accum >= 0.5) {
        sim.accum -= 0.5;
        const e = esfuerzoOptimo(p.beta, p.costo);
        const noise = gauss() * p.sigma;
        const q = Math.max(0, Math.min(2, e + noise));
        sim.history.push(q);
        if (sim.history.length > 40) sim.history.shift();
      }
      sim.t += dt;

      // Burbujas Hart
      const bubs = bubblesRef.current;
      for (const b of bubs) {
        b.x += b.vx;
        b.y += b.vy;
        if (b.x < b.r || b.x > W - b.r) b.vx *= -1;
        if (b.y < b.r || b.y > H_BOT - b.r) b.vy *= -1;
        b.x = Math.max(b.r, Math.min(W - b.r, b.x));
        b.y = Math.max(b.r, Math.min(H_BOT - b.r, b.y));
      }
    }

    // ── Dibujo panel Holmström ───────────────────────────────────────────────
    function drawHolmstrom() {
      const p = paramsRef.current;
      const sim = simRef.current;
      if (!ctx) return;

      // Fondo top
      const bg = ctx.createLinearGradient(0, 0, 0, H_TOP);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#07090F');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H_TOP);

      // Título
      ctx.fillStyle = '#A78BFA';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('① HOLMSTRÖM — El dilema del incentivo', 16, 22);

      // Eje β → esfuerzo, ganancias, certEq
      const MARGIN_L = 56, MARGIN_R = 24, MARGIN_T = 38, MARGIN_B = 36;
      const axW = W - MARGIN_L - MARGIN_R;
      const axH = H_TOP - MARGIN_T - MARGIN_B;
      const ax0x = MARGIN_L, ax0y = MARGIN_T + axH;

      // Ejes
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax0x, MARGIN_T);
      ctx.lineTo(ax0x, ax0y);
      ctx.lineTo(ax0x + axW, ax0y);
      ctx.stroke();

      // Labels ejes
      ctx.fillStyle = '#475569';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Intensidad del incentivo β', ax0x + axW / 2, ax0y + 22);
      ctx.save();
      ctx.translate(14, MARGIN_T + axH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('valor', 0, 0);
      ctx.restore();

      // Etiqueta β=0 y β=1
      ctx.fillStyle = '#475569';
      ctx.textAlign = 'center';
      ctx.fillText('0', ax0x, ax0y + 12);
      ctx.fillText('1', ax0x + axW, ax0y + 12);

      // Helper: coordenada en el eje de una curva
      const px = (b: number) => ax0x + b * axW;
      const py = (v: number, vmin: number, vmax: number) =>
        ax0y - ((v - vmin) / (vmax - vmin)) * axH;

      const VMIN = -0.5, VMAX = 0.6;

      // Curva: ganancia del principal (verde)
      ctx.beginPath();
      ctx.setLineDash([]);
      for (let i = 0; i <= 80; i++) {
        const bv = i / 80;
        const gp = gananciaPrincipal(bv, p.costo);
        const y = py(gp, VMIN, VMAX);
        if (i === 0) ctx.moveTo(px(bv), y);
        else ctx.lineTo(px(bv), y);
      }
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Curva: certeza equivalente del agente (violeta)
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const bv = i / 80;
        const ce = certEquivalente(bv, p.sigma, p.costo, p.rho);
        const y = py(ce, VMIN, VMAX);
        if (i === 0) ctx.moveTo(px(bv), y);
        else ctx.lineTo(px(bv), y);
      }
      ctx.strokeStyle = '#A78BFA';
      ctx.lineWidth = 2;
      ctx.stroke();

      // β* (óptimo teórico) — línea punteada
      const bOpt = betaOptima(p.sigma, p.costo, p.rho);
      ctx.strokeStyle = '#FDB813';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(px(bOpt), MARGIN_T);
      ctx.lineTo(px(bOpt), ax0y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#FDB813';
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('β*', px(bOpt), MARGIN_T - 4);

      // β actual — línea gruesa naranja
      ctx.strokeStyle = '#FB923C';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(px(p.beta), MARGIN_T + 10);
      ctx.lineTo(px(p.beta), ax0y);
      ctx.stroke();
      ctx.fillStyle = '#FB923C';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('β', px(p.beta), MARGIN_T + 6);

      // Historial de q (barras pequeñas en la parte derecha)
      const histW = 90, histH = 60;
      const histX = W - histW - 12, histY = MARGIN_T + 4;
      ctx.fillStyle = 'rgba(11,15,23,0.85)';
      ctx.fillRect(histX - 4, histY - 14, histW + 8, histH + 20);
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.strokeRect(histX - 4, histY - 14, histW + 8, histH + 20);
      ctx.fillStyle = '#64748B';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('producción q observada', histX + histW / 2, histY - 3);

      const hist = sim.history;
      if (hist.length > 1) {
        const barW = Math.max(2, histW / hist.length - 1);
        const paid = p.beta;
        for (let i = 0; i < hist.length; i++) {
          const q = hist[i];
          const bh = (q / 2) * histH;
          const bx2 = histX + (i / hist.length) * histW;
          // color según si el pago cubre el esfuerzo
          const pago = paid * q;
          ctx.fillStyle = pago > 0.3 ? '#34D399' : '#EF4444';
          ctx.fillRect(bx2, histY + histH - bh, barW, bh);
        }
      }

      // Leyenda
      const legX = MARGIN_L + 8, legY = MARGIN_T + 10;
      ctx.fillStyle = '#34D399'; ctx.font = '10px ui-monospace'; ctx.textAlign = 'left';
      ctx.fillText('── ganancia del principal', legX, legY);
      ctx.fillStyle = '#A78BFA';
      ctx.fillText('── utilidad del agente (cert. equiv.)', legX, legY + 14);
      ctx.fillStyle = '#FDB813';
      ctx.fillText('β* = óptimo teórico', legX, legY + 28);

      // Línea cero
      const zy = py(0, VMIN, VMAX);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(ax0x, zy);
      ctx.lineTo(ax0x + axW, zy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#475569';
      ctx.font = '9px ui-monospace';
      ctx.textAlign = 'right';
      ctx.fillText('0', ax0x - 3, zy + 3);
    }

    // ── Dibujo panel Hart ────────────────────────────────────────────────────
    function drawHart() {
      if (!ctx) return;
      const offsetY = H_TOP;

      // Fondo bottom
      const bg = ctx.createLinearGradient(0, offsetY, 0, offsetY + H_BOT);
      bg.addColorStop(0, '#07090F');
      bg.addColorStop(1, '#050609');
      ctx.fillStyle = bg;
      ctx.fillRect(0, offsetY, W, H_BOT);

      // Separador
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, offsetY);
      ctx.lineTo(W, offsetY);
      ctx.stroke();

      // Título
      ctx.fillStyle = '#F472B6';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('② HART — Los huecos del contrato', 16, offsetY + 18);

      // Burbujas
      const bubs = bubblesRef.current;
      const huecos = bubs.filter(b => !b.covered).length;

      for (const b of bubs) {
        const by = offsetY + b.y;

        // Sombra/glow
        ctx.save();
        ctx.shadowBlur = b.covered ? 8 : 14;
        ctx.shadowColor = b.covered ? '#34D39966' : '#EF444466';

        // Círculo
        ctx.beginPath();
        ctx.arc(b.x, by, b.r, 0, Math.PI * 2);
        ctx.fillStyle = b.covered
          ? 'rgba(52,211,153,0.12)'
          : 'rgba(239,68,68,0.12)';
        ctx.fill();
        ctx.strokeStyle = b.covered ? '#34D399' : '#EF4444';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // Texto
        ctx.fillStyle = b.covered ? '#34D399' : '#EF4444';
        ctx.font = `9px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        // Wrap si es largo
        const words = b.label.split(' ');
        const lineH = 11;
        const startY = by - (words.length > 1 ? lineH / 2 : 0);
        words.forEach((w, wi) => {
          ctx.fillText(w, b.x, startY + wi * lineH);
        });

        // Ícono de estado
        ctx.font = '12px ui-monospace';
        ctx.fillText(b.covered ? '✓' : '?', b.x, by - b.r - 3);
      }

      // Leyenda huecos
      const txt = huecos === 0
        ? 'Contrato perfecto: el papel resuelve todo. (Imposible en la vida real.)'
        : huecos === SCENARIOS.length
          ? 'Contrato vacío: todo depende de quien tenga el poder. Así nace el abuso.'
          : `${huecos} escenario${huecos > 1 ? 's' : ''} sin cubrir — ahí manda quien tiene el control residual.`;

      ctx.fillStyle = huecos === 0 ? '#34D399' : huecos > 7 ? '#EF4444' : '#F472B6';
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(txt, W / 2, offsetY + H_BOT - 10);
    }

    // ── Loop principal ───────────────────────────────────────────────────────
    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!paramsRef.current.paused) simStep(dt);

      drawHolmstrom();
      drawHart();

      // Actualiza stats cada 12 frames
      if (frame % 12 === 0) {
        const p = paramsRef.current;
        setStats({
          esfuerzo: esfuerzoOptimo(p.beta, p.costo),
          ganancia: gananciaPrincipal(p.beta, p.costo),
          certEq: certEquivalente(p.beta, p.sigma, p.costo, p.rho),
          betaOpt: betaOptima(p.sigma, p.costo, p.rho),
          huecos: bubblesRef.current.filter(b => !b.covered).length,
        });
      }

      frame++;
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Insight dinámico ─────────────────────────────────────────────────────
  const insight = (() => {
    const bOpt = stats.betaOpt;
    const diff = beta - bOpt;
    if (beta < 0.15)
      return 'Con β muy bajo el empleado recibe salario fijo — sin incentivo para esforzarse. La producción cae y el jefe pierde. Eso es el riesgo moral clásico.';
    if (beta > 0.85)
      return 'Con β casi 1 el empleado cobra TODO el riesgo del resultado. Si el mercado colapsa por causas externas, él pierde aunque haya trabajado duro. El contrato destruye su bienestar.';
    if (Math.abs(diff) < 0.08)
      return `β ≈ β* (${bOpt.toFixed(2)}): estás cerca del contrato óptimo de Holmström. El incentivo equilibra motivación y seguro justo dado el ruido σ = ${sigma.toFixed(1)}.`;
    if (diff > 0)
      return `β > β*: expones al agente a demasiado riesgo. Holmström diría: baja el bono para compensar la incertidumbre (σ = ${sigma.toFixed(1)}).`;
    return `β < β*: el agente está demasiado asegurado. Esfuerzo subóptimo. Holmström diría: sube el bono para que le importe el resultado.`;
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
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#A78BFA]/40 bg-[#A78BFA]/10 text-[#A78BFA] hover:bg-[#A78BFA]/20 transition"
            >
              {paused ? '▶ reanudar' : '⏸ pausa'}
            </button>
            <button
              onClick={() => { simRef.current.history = []; }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1] transition"
            >
              ↺ limpiar historial
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <Stat label="esfuerzo e*" value={stats.esfuerzo.toFixed(2)} accent="#34D399" />
            <Stat label="ganancia jefe" value={stats.ganancia.toFixed(2)} accent="#4FC3F7" />
            <Stat label="util. empleado" value={stats.certEq.toFixed(2)} accent="#A78BFA" />
            <Stat label="β* óptimo" value={stats.betaOpt.toFixed(2)} accent="#FDB813" />
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#A78BFA] font-mono mb-2">
              ✦ ¿Qué ves?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>

          {/* Panel "para el taquero" */}
          <div className="bg-[#0B0F17] border border-[#F472B6]/20 rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#F472B6] font-mono mb-2">
              ② El hueco del contrato — para el taquero
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">
              Las burbujas de abajo son escenarios del futuro. Las verdes ya están escritas en el contrato
              — el papel decide. Las rojas son los huecos: nadie las anticipó. Cuando llegan, el que
              tiene el <span className="text-[#F472B6] font-semibold">control residual</span> manda.
              Mueve el slider "completitud" y ve cómo desaparecen los huecos (imposible al 100% en la vida real).
              <span className="block mt-1 text-[#94A3B8]">
                «El que controla los huecos, controla la relación.» — Hart &amp; Moore (1988)
              </span>
            </p>
          </div>
        </div>

        {/* Panel de controles */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Diseña el contrato
          </div>

          <Slider
            label="Intensidad del incentivo β"
            value={beta}
            min={0}
            max={1}
            step={0.01}
            onChange={setBeta}
            fmt={v => v < 0.2 ? 'sueldo fijo' : v > 0.8 ? 'puro comisión' : `β = ${v.toFixed(2)}`}
            hint="β=0: salario fijo (cero incentivo). β=1: el empleado cobra todo, pero también asume todo el riesgo."
            accent="#FB923C"
          />

          <Slider
            label="Ruido del entorno σ"
            value={sigma}
            min={0.05}
            max={1}
            step={0.01}
            onChange={setSigma}
            fmt={v => v < 0.3 ? 'muy predecible' : v > 0.7 ? 'muy incierto' : `σ = ${v.toFixed(2)}`}
            hint="Con más ruido, Holmström dice: baja β* para no castigar al agente por la mala suerte."
            accent="#4FC3F7"
          />

          <Slider
            label="Costo del esfuerzo c"
            value={costo}
            min={0.5}
            max={3}
            step={0.05}
            onChange={setCosto}
            fmt={v => v < 1 ? 'fácil' : v > 2.2 ? 'muy duro' : `c = ${v.toFixed(2)}`}
            hint="Si el esfuerzo sale caro, el agente hace menos aunque el bono sea alto."
            accent="#34D399"
          />

          <Slider
            label="Aversión al riesgo ρ"
            value={rho}
            min={0.1}
            max={2.5}
            step={0.05}
            onChange={setRho}
            fmt={v => v < 0.6 ? 'neutro al riesgo' : v > 1.8 ? 'muy adverso' : `ρ = ${v.toFixed(2)}`}
            hint="Mayor aversión → el empleado exige más seguro → β* baja. Un emprendedor con ρ bajo acepta más bono."
            accent="#A78BFA"
          />

          <div className="border-t border-[#1E293B] pt-4">
            <Slider
              label="Completitud del contrato"
              value={completitud}
              min={0}
              max={1}
              step={0.01}
              onChange={setCompletitud}
              fmt={v => `${Math.round(v * 100)}% cubierto`}
              hint="Mueve esto para ver cuántos escenarios quedan en rojo (huecos). Hart: nadie llega al 100%."
              accent="#F472B6"
            />
          </div>

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            β* = 1 / (1 + ρ·c·σ²)<br />
            e* = β / c<br />
            CE = β·e* − c·e*²/2 − ρ·β²·σ²/2<br />
            <span className="text-[#334155]">Holmström (1979) · Hart &amp; Moore (1988)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────────────────
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">
        {label}
      </div>
      <div className="text-[18px] font-bold font-mono" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

function Slider({
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
        className="w-full accent-[#A78BFA]"
      />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}
