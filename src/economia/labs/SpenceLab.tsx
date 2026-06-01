/**
 * SpenceLab — laboratorio del premio 2001 (Michael Spence).
 *
 * El click: tu título universitario puede no haberte enseñado nada útil —
 * y aun así fue la mejor inversión que hiciste. Spence formalizó la
 * SEÑALIZACIÓN (Job Market Signaling, 1973): en un mercado donde el patrón
 * no puede ver tu habilidad directamente, una credencial cara y dolorosa de
 * obtener actúa como señal creíble — PORQUE le cuesta más a los de baja
 * habilidad y por eso solo la toman los buenos.
 *
 * Modelo REAL (Spence 1973):
 *   Dos tipos de trabajadores: Alta habilidad θ_H y Baja habilidad θ_L (θ_H > θ_L).
 *   Costo de adquirir educación e para tipo θ: C(e, θ) = e / θ
 *     → A mayor habilidad, la educación es menos costosa.
 *   Salario ofrecido dado la señal e:
 *     w(e) = θ_H si e ≥ e*,  w(e) = θ_L si e < e*
 *   Equilibrio separador (Spence): existe e* tal que:
 *     θ_H - C(e*, θ_H) ≥ θ_L   (a los buenos les conviene señalizar)
 *     θ_L - C(e*, θ_L) ≤ θ_L   (a los malos NO les conviene señalizar)
 *   La condición simplificada: θ_L(1/θ_L - 1/θ_H) ≤ e* ≤ (θ_H - θ_L)·θ_H/θ_L
 *   y la señal mínima que soporta el equilibrio: e* = θ_H - θ_L (normalizado)
 *
 * El lab muestra:
 *   - Curvas de indiferencia de cada tipo (utilidad = salario - costo de señal).
 *   - El umbral e* que separa los tipos.
 *   - Qué pasa cuando e* sube (inflación de credenciales) o los tipos se acercan.
 *   - Los jugadores se mueven con animación suave hacia su equilibrio.
 */

import { useEffect, useRef, useState } from 'react';

// ─── Dimensiones del canvas ────────────────────────────────────────────────
const W = 820;
const H = 380;

// ─── Rango visible del eje x (años de educación / señal) ──────────────────
const E_MAX = 10;  // unidades de señal máx
const E_STEP = 1 / 120;

// ─── Tipos de jugadores en el canvas ──────────────────────────────────────
interface Agent {
  e: number;         // nivel actual de educación (posición en eje x)
  ve: number;        // velocidad (animación física)
  type: 'H' | 'L';  // High-ability vs Low-ability
}

interface Params {
  thetaH: number;    // productividad alta (4-10)
  thetaL: number;    // productividad baja (1-4, siempre < thetaH)
  eStar: number;     // umbral de señal elegido (deslizador)
  paused: boolean;
}

const DEFAULTS: Params = {
  thetaH: 8,
  thetaL: 3,
  eStar: 4,
  paused: false,
};

// ─── Helpers de coordenadas ────────────────────────────────────────────────
const xOf  = (e: number) => 60 + (e / E_MAX) * (W - 120);
const eOfX = (x: number) => Math.max(0, Math.min(E_MAX, ((x - 60) / (W - 120)) * E_MAX));

// Salario que ofrece el mercado dado e y el umbral e*
const wage = (e: number, eStar: number, tH: number, tL: number) =>
  e >= eStar ? tH : tL;

// Utilidad del tipo θ con señal e: U = salario - costo = w(e) - e/θ
const utility = (e: number, theta: number, eStar: number, tH: number, tL: number) =>
  wage(e, eStar, tH, tL) - e / theta;

// Utilidad óptima para cada tipo (máximo sobre e ∈ [0, E_MAX])
const bestE = (theta: number, eStar: number, tH: number, tL: number): number => {
  // Sin señal (e=0): u = tL - 0 = tL
  const uNoSignal = tL;
  // Con señal mínima e=eStar: u = tH - eStar/theta
  const uSignal   = tH - eStar / theta;
  // Elige señalizar si la utilidad es mayor, y la señal óptima es justamente e* (no más)
  return uSignal >= uNoSignal ? eStar : 0;
};

// ─── Análisis del equilibrio ───────────────────────────────────────────────
function analyzeEquilibrium(p: Params): { separating: boolean; hSenaliza: boolean; lSenaliza: boolean } {
  const { thetaH, thetaL, eStar } = p;
  const uH_signal   = thetaH - eStar / thetaH;
  const uH_noSignal = thetaL;
  const uL_signal   = thetaH - eStar / thetaL;
  const uL_noSignal = thetaL;
  const hSenaliza = uH_signal >= uH_noSignal;
  const lSenaliza = uL_signal >= uL_noSignal;
  return { separating: hSenaliza && !lSenaliza, hSenaliza, lSenaliza };
};

// ─── Curva de indiferencia de un tipo ──────────────────────────────────────
// w = U + e/θ → dado un nivel de utilidad U, w(e) = U + e/θ
// Pero en nuestro sistema, el "salario" cambia en salto en e*.
// Mostramos la curva de bienestar: utility(e) = w(e) - e/θ
// Mapeamos utility a coordenada Y del canvas.
const utilToY = (u: number, uMin: number, uMax: number) => {
  const pad = 55;
  const range = H - pad * 2;
  const t = (u - uMin) / Math.max(0.01, uMax - uMin);
  return H - pad - t * range;
};

export default function SpenceLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS });
  const agentsRef = useRef<Agent[]>([
    { e: 7, ve: 0, type: 'H' },
    { e: 2, ve: 0, type: 'L' },
  ]);

  const [thetaH, setThetaH] = useState(DEFAULTS.thetaH);
  const [thetaL, setThetaL] = useState(DEFAULTS.thetaL);
  const [eStar, setEStar]   = useState(DEFAULTS.eStar);
  const [paused, setPaused] = useState(DEFAULTS.paused);
  const [eq, setEq]         = useState({ separating: true, hSenaliza: true, lSenaliza: false });
  const [stats, setStats]   = useState({ eH: 4, eL: 0, wH: 8, wL: 3, uH: 0, uL: 0 });

  // Sincroniza ref con estado de React
  useEffect(() => {
    paramsRef.current = { thetaH, thetaL, eStar, paused };
  }, [thetaH, thetaL, eStar, paused]);

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

    // Simulación física: cada agente se atrae hacia su e* óptimo
    function step(h: number) {
      const p = paramsRef.current;
      const agents = agentsRef.current;
      for (const ag of agents) {
        const target = bestE(ag.type === 'H' ? p.thetaH : p.thetaL, p.eStar, p.thetaH, p.thetaL);
        const F = (target - ag.e) * 8;      // fuerza elástica hacia el equilibrio
        ag.ve += F * h;
        ag.ve *= (1 - 3 * h);               // fricción amortiguada
        ag.e  += ag.ve * h;
        ag.e   = Math.max(0, Math.min(E_MAX, ag.e));
      }
    }

    function draw() {
      if (!ctx) return;
      const p = paramsRef.current;
      const { thetaH: tH, thetaL: tL, eStar: eS } = p;
      const agents = agentsRef.current;

      // Fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ─── Eje X (nivel de señal) ─────────────────────────────────────────
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(55, H - 38);
      ctx.lineTo(W - 50, H - 38);
      ctx.stroke();
      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      for (let i = 0; i <= E_MAX; i += 2) {
        const x = xOf(i);
        ctx.fillText(`${i}`, x, H - 24);
        ctx.beginPath();
        ctx.moveTo(x, H - 40);
        ctx.lineTo(x, H - 35);
        ctx.strokeStyle = '#334155';
        ctx.stroke();
      }
      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('años de credencial (señal e)', W / 2, H - 10);

      // ─── Calcular rango de utilidades para normalizar eje Y ────────────
      let uMin = Infinity, uMax = -Infinity;
      const uSamples: number[] = [];
      for (let i = 0; i <= 60; i++) {
        const e = (i / 60) * E_MAX;
        const uH = utility(e, tH, eS, tH, tL);
        const uL = utility(e, tL, eS, tH, tL);
        uSamples.push(uH, uL);
      }
      for (const u of uSamples) {
        if (u < uMin) uMin = u;
        if (u > uMax) uMax = u;
      }
      uMin -= 0.5; uMax += 0.5;

      // ─── Curva de utilidad de tipo H (azul cyan) ─────────────────────
      const drawUtilityCurve = (theta: number, color: string) => {
        ctx.beginPath();
        let first = true;
        for (let i = 0; i <= 120; i++) {
          const e = (i / 120) * E_MAX;
          const u = utility(e, theta, eS, tH, tL);
          const x = xOf(e);
          const y = utilToY(u, uMin, uMax);
          // Salto en e* (discontinuidad en el salario)
          const ePrev = ((i - 1) / 120) * E_MAX;
          if (i > 0 && ((ePrev < eS && e >= eS))) {
            ctx.stroke();
            ctx.beginPath();
            first = true;
          }
          if (first) { ctx.moveTo(x, y); first = false; }
          else        { ctx.lineTo(x, y); }
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      };

      drawUtilityCurve(tH, '#22D3EE');   // alta habilidad → cyan
      drawUtilityCurve(tL, '#F472B6');   // baja habilidad → pink

      // ─── Línea del umbral e* ────────────────────────────────────────────
      const starX = xOf(eS);
      ctx.strokeStyle = '#FDB813';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(starX, 40);
      ctx.lineTo(starX, H - 38);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#FDB813';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('e* = ' + eS.toFixed(1), starX, 30);
      ctx.fillText('umbral', starX, 42);

      // ─── Zona de señal (derecha del umbral) sombreada ─────────────────
      ctx.fillStyle = 'rgba(34,211,238,0.04)';
      ctx.fillRect(starX, 50, W - 50 - starX, H - 90);
      ctx.fillStyle = 'rgba(34,211,238,0.35)';
      ctx.font = '9px ui-sans-serif, system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('salario = θ_H', starX + 6, 62);
      ctx.fillStyle = 'rgba(244,114,182,0.35)';
      ctx.textAlign = 'right';
      ctx.fillText('salario = θ_L', starX - 6, 62);

      // ─── Leyenda de tipos ──────────────────────────────────────────────
      const leg = [
        { label: `Tipo H (θ=${tH}) — alta habilidad`, color: '#22D3EE' },
        { label: `Tipo L (θ=${tL}) — baja habilidad`,  color: '#F472B6' },
      ];
      leg.forEach((l, i) => {
        const lx = 68, ly = 56 + i * 18;
        ctx.fillStyle = l.color;
        ctx.fillRect(lx, ly, 20, 3);
        ctx.font = '10px ui-sans-serif, system-ui';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#CBD5E1';
        ctx.fillText(l.label, lx + 26, ly + 4);
      });

      // ─── Jugadores (puntos que se mueven) ─────────────────────────────
      const colors: Record<string, string> = { H: '#22D3EE', L: '#F472B6' };
      const shadowC: Record<string, string> = { H: '#0891B2', L: '#BE185D' };
      for (const ag of agents) {
        const theta = ag.type === 'H' ? tH : tL;
        const u     = utility(ag.e, theta, eS, tH, tL);
        const x     = xOf(ag.e);
        const y     = utilToY(u, uMin, uMax);
        ctx.save();
        ctx.shadowColor = shadowC[ag.type];
        ctx.shadowBlur  = 18;
        ctx.fillStyle   = colors[ag.type];
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#0B0F17';
        ctx.font      = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ag.type, x, y + 4);
        // etiqueta flotante
        ctx.fillStyle = colors[ag.type];
        ctx.font      = '9px ui-monospace, monospace';
        ctx.fillText(`e=${ag.e.toFixed(1)}`, x, y - 16);
      }

      // ─── Análisis del equilibrio en la parte inferior ─────────────────
      const eqState = analyzeEquilibrium(p);
      let msgColor = '#34D399', msg = '';
      if (eqState.separating) {
        msg = '✓ EQUILIBRIO SEPARADOR — H señaliza, L no. El mercado los distingue.';
        msgColor = '#34D399';
      } else if (eqState.hSenaliza && eqState.lSenaliza) {
        msg = '⚠ TODOS señalizan — L también copia a H. La señal no distingue nada. Inflación de diplomas.';
        msgColor = '#FB923C';
      } else if (!eqState.hSenaliza && !eqState.lSenaliza) {
        msg = '⚠ NADIE señaliza — la credencial es demasiado cara hasta para H. Equilibrio agrupador bajo.';
        msgColor = '#EF4444';
      } else {
        msg = '• Solo H señaliza (umbral OK). Mueve e* para afinar el equilibrio.';
        msgColor = '#FDB813';
      }
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px ui-sans-serif, system-ui';
      ctx.fillStyle = msgColor;
      ctx.fillText(msg, W / 2, H - 16);

      if (p.paused) {
        ctx.fillStyle = 'rgba(5,6,10,0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 16px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⏸ en pausa', W / 2, H / 2);
      }

      // Actualiza stats cada 10 frames
      if (frame % 10 === 0) {
        const agH = agents.find(a => a.type === 'H')!;
        const agL = agents.find(a => a.type === 'L')!;
        const wH  = wage(agH.e, eS, tH, tL);
        const wL  = wage(agL.e, eS, tH, tL);
        setEq(analyzeEquilibrium(p));
        setStats({
          eH: agH.e,
          eL: agL.e,
          wH,
          wL,
          uH: utility(agH.e, tH, eS, tH, tL),
          uL: utility(agL.e, tL, eS, tH, tL),
        });
      }
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!paramsRef.current.paused) {
        acc += dt;
        while (acc >= E_STEP) { step(E_STEP); acc -= E_STEP; }
      }
      draw();
      frame++;
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    // Arrastre de los jugadores
    let dragging: Agent | null = null;
    const hitAgent = (x: number, y: number): Agent | null => {
      const agents = agentsRef.current;
      const p = paramsRef.current;
      for (const ag of agents) {
        const theta = ag.type === 'H' ? p.thetaH : p.thetaL;
        // Necesitamos reproducir uMin/uMax del frame actual (aprox)
        let uMin2 = Infinity, uMax2 = -Infinity;
        for (let i = 0; i <= 60; i++) {
          const e = (i / 60) * E_MAX;
          const u1 = utility(e, p.thetaH, p.eStar, p.thetaH, p.thetaL);
          const u2 = utility(e, p.thetaL, p.eStar, p.thetaH, p.thetaL);
          if (u1 < uMin2) uMin2 = u1; if (u1 > uMax2) uMax2 = u1;
          if (u2 < uMin2) uMin2 = u2; if (u2 > uMax2) uMax2 = u2;
        }
        uMin2 -= 0.5; uMax2 += 0.5;
        const u = utility(ag.e, theta, p.eStar, p.thetaH, p.thetaL);
        const ax = xOf(ag.e), ay = utilToY(u, uMin2, uMax2);
        if (Math.hypot(x - ax, y - ay) < 18) return ag;
      }
      return null;
    };
    const toCanvas = (e: PointerEvent): [number, number] => {
      const rect = canvas.getBoundingClientRect();
      return [
        (e.clientX - rect.left) * (W / rect.width),
        (e.clientY - rect.top) * (H / rect.height),
      ];
    };
    const onDown = (e: PointerEvent) => {
      const [cx, cy] = toCanvas(e);
      dragging = hitAgent(cx, cy);
      if (dragging) { dragging.ve = 0; canvas.setPointerCapture(e.pointerId); }
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const [cx] = toCanvas(e);
      dragging.e  = eOfX(cx);
      dragging.ve = 0;
    };
    const onUp = () => { dragging = null; };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
    };
  }, []);

  // Insight contextual
  const insight = eq.separating
    ? 'Equilibrio separador activo: el tipo H paga el costo de la credencial y se distingue. El tipo L no la toma — le saldría más caro de lo que gana. El sistema funciona aunque nadie aprenda nada en la escuela.'
    : eq.hSenaliza && eq.lSenaliza
      ? 'Umbral e* muy bajo: el tipo L también puede pagarlo. Ambos se acreditan y el mercado ya no los distingue. Esto es la inflación de diplomas: todos tienen maestría y nadie se diferencia. El siguiente umbral se corre hacia el doctorado.'
      : '¡Umbral e* demasiado alto: hasta el tipo H prefiere no señalizar! La credencial se volvió inaccesible para todos. Nadie entra al mercado formal. Mueve e* hacia abajo o acerca las productividades.';

  const clampThetaL = (v: number) => Math.min(v, thetaH - 1);

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* ── Canvas + controles básicos ─────────────────────────────── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block touch-none cursor-grab"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Botones de acción */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPaused(v => !v)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7] hover:bg-[#4FC3F7]/20 transition"
            >
              {paused ? '▶ reanudar' : '⏸ pausa'}
            </button>
            <button
              onClick={() => {
                agentsRef.current = [
                  { e: 9, ve: 0, type: 'H' },
                  { e: 0.5, ve: 0, type: 'L' },
                ];
              }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#FDB813]/40 bg-[#FDB813]/10 text-[#FDB813] hover:bg-[#FDB813]/20 transition"
            >
              ↺ reiniciar posiciones
            </button>
          </div>

          {/* Stats de equilibrio */}
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="señal tipo H"
              value={`e=${stats.eH.toFixed(1)}`}
              sub={`w=$${stats.wH.toFixed(1)}`}
              accent="#22D3EE"
            />
            <Stat
              label="señal tipo L"
              value={`e=${stats.eL.toFixed(1)}`}
              sub={`w=$${stats.wL.toFixed(1)}`}
              accent="#F472B6"
            />
            <Stat
              label="estado del mercado"
              value={eq.separating ? 'SEPARA' : eq.hSenaliza && eq.lSenaliza ? 'POOL' : 'COLAPSO'}
              sub={eq.separating ? 'funciona' : eq.hSenaliza && eq.lSenaliza ? 'inflación' : 'nadie entra'}
              accent={eq.separating ? '#34D399' : '#EF4444'}
            />
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#22D3EE] font-mono mb-2">
              ✦ ¿Qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── Panel de controles ─────────────────────────────────────── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Parámetros del mercado
          </div>

          <Slider
            label="Productividad alta θ_H"
            value={thetaH}
            min={4}
            max={10}
            step={0.5}
            onChange={v => { setThetaH(v); if (thetaL >= v) setThetaL(v - 1); }}
            fmt={v => v.toFixed(1)}
            hint="Lo que produce el trabajador bueno. Más alto = vale más contratarlo."
          />
          <Slider
            label="Productividad baja θ_L"
            value={thetaL}
            min={1}
            max={thetaH - 0.5}
            step={0.5}
            onChange={v => setThetaL(clampThetaL(v))}
            fmt={v => v.toFixed(1)}
            hint="Lo que produce el trabajador menos hábil. Acércalo a θ_H y el equilibrio se rompe."
          />
          <Slider
            label="Umbral de señal e*"
            value={eStar}
            min={0.5}
            max={E_MAX - 0.5}
            step={0.5}
            onChange={setEStar}
            fmt={v => v.toFixed(1)}
            hint="El mínimo de credencial que el mercado exige para pagar el salario alto. Mueve esto y observa cuándo colapsa el equilibrio."
          />

          {/* Tabla de utilidades */}
          <div className="border border-[#1E293B] rounded-lg overflow-hidden">
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#475569] font-mono px-3 py-2 bg-[#0F172A]">
              utilidades en equilibrio
            </div>
            <div className="grid grid-cols-2 divide-x divide-[#1E293B]">
              <div className="p-3 space-y-1">
                <div className="text-[10px] text-[#22D3EE] font-mono">Tipo H</div>
                <div className="text-[11px] text-[#94A3B8] font-mono">
                  u = {thetaH.toFixed(1)} − {eStar.toFixed(1)}/{thetaH.toFixed(1)}
                </div>
                <div className="text-[15px] font-bold text-[#22D3EE] font-mono">
                  = {(thetaH - eStar / thetaH).toFixed(2)}
                </div>
                <div className="text-[9px] text-[#475569]">
                  sin señal: {thetaL.toFixed(1)}
                </div>
              </div>
              <div className="p-3 space-y-1">
                <div className="text-[10px] text-[#F472B6] font-mono">Tipo L</div>
                <div className="text-[11px] text-[#94A3B8] font-mono">
                  u = {thetaL.toFixed(1)} − {eStar.toFixed(1)}/{thetaL.toFixed(1)}
                </div>
                <div className="text-[15px] font-bold text-[#F472B6] font-mono">
                  = {(thetaL - eStar / thetaL).toFixed(2)}
                </div>
                <div className="text-[9px] text-[#475569]">
                  sin señal: {thetaL.toFixed(1)}
                </div>
              </div>
            </div>
          </div>

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo: U(e,θ) = w(e) − e/θ<br />
            C(e,θ) = e/θ → más barato para θ alto<br />
            separador ↔ θ_L(1/θ_L − 1/θ_H) ≤ e* ≤ θ_H − θ_L<br />
            Spence, Job Market Signaling (QJE 1973) · Nobel 2001
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componentes auxiliares ────────────────────────────────────────────────

function Stat({ label, value, sub, accent }: {
  label: string; value: string; sub: string; accent: string;
}) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[17px] font-bold font-mono" style={{ color: accent }}>{value}</div>
      <div className="text-[10px] font-mono" style={{ color: accent + 'AA' }}>{sub}</div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt, hint }: {
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
        className="w-full accent-[#22D3EE]"
      />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}
