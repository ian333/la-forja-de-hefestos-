/**
 * MundellLab — laboratorio del premio 1999 (Robert Mundell).
 *
 * El click: Hay tres cosas que todo país quiere de su dinero.
 * Mundell demostró que solo puedes tener DOS. Elige.
 *
 * Trilema de Mundell-Fleming:
 *   (A) Tipo de cambio fijo    — tu moneda vale lo mismo que el dólar hoy y mañana.
 *   (B) Libre flujo de capital — tu dinero entra y sale sin restricciones.
 *   (C) Política monetaria     — tú decides tus propias tasas de interés.
 *
 * Las tres son incompatibles. Si fijas el tipo de cambio y abres el capital,
 * la paridad de tasas de interés te fuerza a copiar la tasa del país ancla:
 *   i = i* + E[dS/S]
 * Si E[dS/S] = 0 (tipo fijo) → i = i* (pierdes la política monetaria).
 *
 * En el canvas dibujamos el triángulo de Mundell. Cada vértice es un objetivo.
 * El usuario puede activar/desactivar. Si activa los tres, se dispara la crisis.
 * Simulamos la dinámica del tipo de cambio con Uncovered Interest Parity (UIP):
 *   dS/dt = (i - i*) * S_t   (si capital libre)
 * y las reservas internacionales:
 *   dR/dt = -CF * (i - i*)   (si tipo fijo y capital libre, las reservas caen)
 *
 * Los tres regímenes reales:
 *   A+B → El euro / Hong Kong: tipo fijo + capital libre = sin política propia.
 *   A+C → China / Bretton Woods: tipo fijo + tasas propias = controles de capital.
 *   B+C → México post-94 / USA: libre capital + tasas propias = tipo flotante.
 */

import { useEffect, useRef, useState } from 'react';

// ─── Dimensiones ──────────────────────────────────────────────────────────────
const W = 820;
const H = 380;

// ─── Geometría del triángulo ──────────────────────────────────────────────────
// Vértice A (arriba, centro): Tipo de cambio fijo
// Vértice B (abajo-izq):      Libre flujo de capital
// Vértice C (abajo-der):      Política monetaria propia
const VA = { x: W / 2, y: 48 };
const VB = { x: 120, y: H - 72 };
const VC = { x: W - 120, y: H - 72 };

// ─── Colores ──────────────────────────────────────────────────────────────────
const COL_A = '#FB923C';   // naranja — tipo fijo
const COL_B = '#4FC3F7';   // cyan   — capital libre
const COL_C = '#A78BFA';   // lila   — política monetaria
const COL_ERR = '#EF4444'; // rojo   — imposible / crisis
const COL_OK = '#34D399';  // verde  — régimen estable

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Corner { id: 'A' | 'B' | 'C'; active: boolean; }

interface SimState {
  // Tipo de cambio (pesos por dólar). Base = 17.
  S: number;
  // Reservas internacionales (índice 0→1).
  R: number;
  // Tasa de interés local (%).
  i: number;
  // Tiempo
  t: number;
  // Crisis activa
  crisis: boolean;
  // Frame
  frame: number;
}

interface Params {
  activeA: boolean;
  activeB: boolean;
  activeC: boolean;
  iStar: number;  // tasa extranjera (%)
  iLocal: number; // tasa local slider (%)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }

function regimeLabel(a: boolean, b: boolean, c: boolean): string {
  if (a && b && !c) return 'Euro / Dólar HK — tipo fijo + capital libre';
  if (a && !b && c) return 'China / Bretton Woods — tipo fijo + control de capital';
  if (!a && b && c) return 'México post-94 / USA — tipo flotante + capital libre';
  if (a && b && c)  return '⚡ IMPOSIBLE — entra en crisis';
  return 'Elige al menos dos vértices';
}

function regimeColor(a: boolean, b: boolean, c: boolean): string {
  if (a && b && c) return COL_ERR;
  const count = (a ? 1 : 0) + (b ? 1 : 0) + (c ? 1 : 0);
  if (count === 2) return COL_OK;
  return '#94A3B8';
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function MundellLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ activeA: false, activeB: true, activeC: true, iStar: 5, iLocal: 9 });
  const simRef = useRef<SimState>({ S: 17, R: 0.75, i: 9, t: 0, crisis: false, frame: 0 });

  const [activeA, setActiveA] = useState(false);
  const [activeB, setActiveB] = useState(true);
  const [activeC, setActiveC] = useState(true);
  const [iStar, setIStar] = useState(5);
  const [iLocal, setILocal] = useState(9);

  // Estadísticas para los Stat cards (actualiza React state cada N frames)
  const [stats, setStats] = useState({ S: 17, R: 0.75, i: 9, regime: '', crisis: false });

  // Sincronizar paramsRef con React state
  useEffect(() => {
    paramsRef.current = { activeA, activeB, activeC, iStar, iLocal };
    // Al cambiar régimen, reinicia la simulación
    const sim = simRef.current;
    if (!(activeA && activeB && activeC)) {
      sim.crisis = false;
      if (!activeA) sim.S = 17; // tipo flotante → tipo de cambio puede moverse
      if (activeA)  sim.S = 17; // tipo fijo → ancla en 17
      sim.R = 0.75;
      sim.i = iLocal;
    }
  }, [activeA, activeB, activeC, iStar, iLocal]);

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

    let raf = 0;
    let last = performance.now();
    const DT = 1 / 60; // paso fijo de simulación (segundos simulados por frame)

    // ── Física / simulación UIP ──────────────────────────────────────────────
    function stepSim(h: number) {
      const p = paramsRef.current;
      const sim = simRef.current;
      const { activeA: fA, activeB: fB, activeC: fC, iStar: iS, iLocal: iL } = p;

      if (fA && fB && fC) {
        // IMPOSIBLE: tipo fijo + capital libre + tasas propias → crisis de reservas
        sim.crisis = true;
        // Si tasas locales > externas con tipo fijo + capital libre → entra capital
        // pero el mercado exige devaluar. Las reservas se agotan tratando de defender.
        const diferencialTasa = (iL - iS) / 100; // diferencial diario
        const presionCambio = diferencialTasa * 8 * h; // presión acumulada
        sim.R -= Math.abs(presionCambio) * 1.2;
        sim.R = clamp(sim.R, 0, 1);
        if (sim.R < 0.05) {
          // Se agotan las reservas: devaluación abrupta
          sim.S += (iL - iS) * 0.08 * h;
        }
        sim.S = clamp(sim.S, 5, 60);
        sim.i = iL;
        return;
      }

      sim.crisis = false;

      if (fA && fB && !fC) {
        // EURO: tipo fijo + capital libre → tasas propias = tasas del exterior (UIP)
        // i_local → i* (paridad de tasas)
        sim.i = lerp(sim.i, iS, 3 * h);
        sim.S = lerp(sim.S, 17, 8 * h); // ancla en 17
        sim.R = lerp(sim.R, 0.72, 0.5 * h); // reservas estables
        return;
      }

      if (fA && !fB && fC) {
        // CHINA: tipo fijo + control de capital → política monetaria independiente
        // El tipo de cambio está fijo. Tasas son independientes.
        sim.S = lerp(sim.S, 17, 12 * h);
        sim.i = lerp(sim.i, iL, 4 * h);
        sim.R = lerp(sim.R, 0.82, 0.3 * h); // reservas altas (controles protegen)
        return;
      }

      if (!fA && fB && fC) {
        // MÉXICO: capital libre + tasas propias → tipo flotante (UIP determina S)
        // Uncovered Interest Parity: si i > i*, el peso se aprecia en expectativa
        const diferencial = (iL - iS) / 100;
        // Tipo de cambio converge al nivel de equilibrio UIP:
        // S_eq = S_0 / (1 + diferencial)  (simplificado)
        const S_eq = 17 / (1 + diferencial * 2.5);
        sim.S = lerp(sim.S, S_eq, 1.5 * h);
        sim.i = lerp(sim.i, iL, 4 * h);
        sim.R = lerp(sim.R, 0.60, 0.4 * h); // reservas moderadas
        return;
      }

      // Menos de 2 activos → sin simulación significativa
      sim.S = lerp(sim.S, 17, 2 * h);
      sim.R = lerp(sim.R, 0.70, 0.5 * h);
      sim.i = lerp(sim.i, iL, 2 * h);
    }

    // ── Dibujado ─────────────────────────────────────────────────────────────
    function draw(now: number) {
      if (!ctx) return;
      const p = paramsRef.current;
      const sim = simRef.current;
      const { activeA: fA, activeB: fB, activeC: fC } = p;

      // Fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#060A12');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── Triángulo ──────────────────────────────────────────────────────────
      // Lado AB (A↔B)
      drawEdge(ctx, VA, VB, fA && fB, COL_A, COL_B, fA && fB && fC);
      // Lado BC (B↔C)
      drawEdge(ctx, VB, VC, fB && fC, COL_B, COL_C, fA && fB && fC);
      // Lado AC (A↔C)
      drawEdge(ctx, VA, VC, fA && fC, COL_A, COL_C, fA && fB && fC);

      // Relleno del triángulo cuando hay régimen válido (2 activos)
      const count = (fA ? 1 : 0) + (fB ? 1 : 0) + (fC ? 1 : 0);
      if (count === 2) {
        ctx.beginPath();
        ctx.moveTo(VA.x, VA.y);
        ctx.lineTo(VB.x, VB.y);
        ctx.lineTo(VC.x, VC.y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(52,211,153,0.05)';
        ctx.fill();
      } else if (count === 3) {
        // Parpadeo rojo: imposible
        const alpha = 0.04 + 0.04 * Math.sin(now / 200);
        ctx.beginPath();
        ctx.moveTo(VA.x, VA.y);
        ctx.lineTo(VB.x, VB.y);
        ctx.lineTo(VC.x, VC.y);
        ctx.closePath();
        ctx.fillStyle = `rgba(239,68,68,${alpha})`;
        ctx.fill();
      }

      // ── Vértices ───────────────────────────────────────────────────────────
      drawVertex(ctx, VA, 'A', 'TIPO DE CAMBIO FIJO', fA, COL_A, fA && fB && fC, now, 'top');
      drawVertex(ctx, VB, 'B', 'LIBRE FLUJO DE CAPITAL', fB, COL_B, fA && fB && fC, now, 'bottom-left');
      drawVertex(ctx, VC, 'C', 'POLÍTICA MONETARIA PROPIA', fC, COL_C, fA && fB && fC, now, 'bottom-right');

      // ── Etiqueta del régimen (al centro del triángulo) ─────────────────────
      const cx = (VA.x + VB.x + VC.x) / 3;
      const cy = (VA.y + VB.y + VC.y) / 3 + 10;
      const rLabel = regimeLabel(fA, fB, fC);
      const rColor = regimeColor(fA, fB, fC);
      ctx.textAlign = 'center';
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.fillStyle = rColor;
      ctx.fillText(rLabel, cx, cy);

      // ── Indicadores de la economía (derecho del canvas) ───────────────────
      const px = W - 200;
      const py = 60;
      drawGauge(ctx, px, py, 'Tipo de cambio', `$${sim.S.toFixed(2)} MXN/USD`, sim.S, 5, 40, COL_A, fA);
      drawGauge(ctx, px, py + 64, 'Reservas internacionales', `${(sim.R * 100).toFixed(0)}%`, sim.R, 0, 1, COL_B, fB);
      drawGauge(ctx, px, py + 128, 'Tasa de interés local', `${sim.i.toFixed(1)}%`, sim.i, 0, 20, COL_C, fC);

      // ── Mensaje de crisis ──────────────────────────────────────────────────
      if (sim.crisis) {
        const alpha = 0.7 + 0.3 * Math.sin(now / 300);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 15px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = COL_ERR;
        ctx.fillText('⚡ CRISIS DE RESERVAS — la trinidad imposible colapsó', W / 2, H - 20);
        ctx.restore();
      }

      // ── Actualizar stats React cada 6 frames ──────────────────────────────
      sim.frame++;
      if (sim.frame % 6 === 0) {
        setStats({
          S: sim.S,
          R: sim.R,
          i: sim.i,
          regime: rLabel,
          crisis: sim.crisis,
        });
      }
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      stepSim(dt * 3); // 3× velocidad para que se vea animado
      draw(now);
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);

    // ── Manejo de clicks en el canvas (sobre vértices) ──────────────────────
    function onCanvasClick(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (W / rect.width);
      const my = (e.clientY - rect.top)  * (H / rect.height);

      const R_HIT = 30; // radio de hit en píxeles

      const hitA = Math.hypot(mx - VA.x, my - VA.y) < R_HIT;
      const hitB = Math.hypot(mx - VB.x, my - VB.y) < R_HIT;
      const hitC = Math.hypot(mx - VC.x, my - VC.y) < R_HIT;

      if (hitA) setActiveA(v => !v);
      if (hitB) setActiveB(v => !v);
      if (hitC) setActiveC(v => !v);
    }

    canvas.addEventListener('click', onCanvasClick);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('click', onCanvasClick);
    };
  }, []);

  // ─── Insight dinámico ────────────────────────────────────────────────────
  const count = (activeA ? 1 : 0) + (activeB ? 1 : 0) + (activeC ? 1 : 0);
  const insight =
    activeA && activeB && activeC
      ? 'Elegiste los tres. Eso es exactamente lo que intentó Argentina 1991-2001: peso fijo 1:1 al dólar (A), capital libre (B), tasas propias (C). En diciembre de 2001 las reservas se acabaron y todo explotó. El mercado siempre gana.'
      : activeA && activeB && !activeC
        ? 'Tipo fijo + capital libre = pierdes tus tasas. El Banco Central copia al de afuera sin opción. Eso es el euro: Grecia no podía imprimir ni bajar tasas cuando su economía colapsó. Tampoco era su moneda.'
        : activeA && !activeB && activeC
          ? 'Tipo fijo + tasas propias = tienes que cerrar la frontera al capital. Así funciona China: el yuan está cuasi-fijo pero no puedes sacar tu dinero libremente. Control de cambios. La barrera es el precio que pagan.'
          : !activeA && activeB && activeC
            ? 'Capital libre + tasas propias = tipo flotante. El dólar sube y baja todos los días. Eso eligió México tras el Error de Diciembre de 1994. Duele ver el tipo de cambio brincar, pero es la válvula de escape cuando el mundo se pone raro.'
            : 'Haz clic en los vértices del triángulo para activar cada objetivo. Intenta los tres a la vez — y observa la crisis.';

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        {/* ── Canvas ── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block cursor-pointer"
              style={{ width: W, height: H }}
              title="Haz clic en los vértices para activar/desactivar"
            />
          </div>

          {/* Botones de presets */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setActiveA(false); setActiveB(true); setActiveC(true); }}
              className={`px-3 py-1.5 text-[11px] font-mono rounded border transition ${
                !activeA && activeB && activeC
                  ? 'border-[#4FC3F7]/60 bg-[#4FC3F7]/10 text-[#4FC3F7]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'}`}>
              🇲🇽 México (B+C)
            </button>
            <button
              onClick={() => { setActiveA(true); setActiveB(true); setActiveC(false); }}
              className={`px-3 py-1.5 text-[11px] font-mono rounded border transition ${
                activeA && activeB && !activeC
                  ? 'border-[#FB923C]/60 bg-[#FB923C]/10 text-[#FB923C]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'}`}>
              🇪🇺 Euro (A+B)
            </button>
            <button
              onClick={() => { setActiveA(true); setActiveB(false); setActiveC(true); }}
              className={`px-3 py-1.5 text-[11px] font-mono rounded border transition ${
                activeA && !activeB && activeC
                  ? 'border-[#A78BFA]/60 bg-[#A78BFA]/10 text-[#A78BFA]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'}`}>
              🇨🇳 China (A+C)
            </button>
            <button
              onClick={() => { setActiveA(true); setActiveB(true); setActiveC(true); }}
              className={`px-3 py-1.5 text-[11px] font-mono rounded border transition ${
                activeA && activeB && activeC
                  ? 'border-[#EF4444]/60 bg-[#EF4444]/10 text-[#EF4444]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'}`}>
              ⚡ Argentina (los 3 → crisis)
            </button>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Tipo de cambio" value={`$${stats.S.toFixed(2)}`} accent={COL_A} />
            <Stat label="Reservas" value={`${(stats.R * 100).toFixed(0)}%`}
                  accent={stats.R < 0.15 ? COL_ERR : COL_B} />
            <Stat label="Tasa local" value={`${stats.i.toFixed(1)}%`} accent={COL_C} />
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#FB923C] font-mono mb-2">
              ✦ ¿Qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── Panel de controles ── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Parámetros
          </div>

          {/* Checkboxes de vértices */}
          <div className="space-y-2">
            <CornerToggle
              label="A — Tipo de cambio fijo"
              description="Ancla la moneda a un valor fijo."
              color={COL_A}
              active={activeA}
              onToggle={() => setActiveA(v => !v)}
            />
            <CornerToggle
              label="B — Libre flujo de capital"
              description="Tu dinero entra y sale sin trabas."
              color={COL_B}
              active={activeB}
              onToggle={() => setActiveB(v => !v)}
            />
            <CornerToggle
              label="C — Política monetaria propia"
              description="Tú fijas tus tasas de interés."
              color={COL_C}
              active={activeC}
              onToggle={() => setActiveC(v => !v)}
            />
          </div>

          <Slider
            label="Tasa extranjera (i*)"
            value={iStar}
            min={0} max={15} step={0.25}
            onChange={setIStar}
            fmt={v => `${v.toFixed(2)}%`}
            hint="La tasa de la Fed o del BCE. Con tipo fijo + capital libre, tu tasa converge aquí."
            color="#64748B"
          />

          <Slider
            label="Tasa local que quieres"
            value={iLocal}
            min={0} max={20} step={0.25}
            onChange={setILocal}
            fmt={v => `${v.toFixed(2)}%`}
            hint="Tu política monetaria ideal. Solo la puedes tener si no tienes tipo fijo o cierras el capital."
            color={COL_C}
          />

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            Uncovered Interest Parity:<br />
            i = i* + E[dS/S]<br />
            Si tipo fijo → E[dS/S]=0 → i=i*<br />
            (Mundell-Fleming, 1963)
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers de dibujo ───────────────────────────────────────────────────────

function drawEdge(
  ctx: CanvasRenderingContext2D,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  active: boolean,
  col1: string,
  col2: string,
  crisis: boolean,
): void {
  const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
  if (crisis) {
    grad.addColorStop(0, 'rgba(239,68,68,0.8)');
    grad.addColorStop(1, 'rgba(239,68,68,0.8)');
  } else if (active) {
    grad.addColorStop(0, col1 + 'CC');
    grad.addColorStop(1, col2 + 'CC');
  } else {
    grad.addColorStop(0, '#1E293B');
    grad.addColorStop(1, '#1E293B');
  }
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = grad;
  ctx.lineWidth = active ? 2.5 : 1.5;
  ctx.setLineDash(active ? [] : [6, 4]);
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawVertex(
  ctx: CanvasRenderingContext2D,
  v: { x: number; y: number },
  id: string,
  label: string,
  active: boolean,
  color: string,
  crisis: boolean,
  now: number,
  position: 'top' | 'bottom-left' | 'bottom-right',
): void {
  const R = 22;
  const col = crisis ? COL_ERR : active ? color : '#334155';

  // Glow cuando está activo
  if (active) {
    ctx.save();
    ctx.shadowColor = crisis ? COL_ERR : color;
    ctx.shadowBlur = crisis ? 20 + 10 * Math.sin(now / 200) : 14;
    ctx.beginPath();
    ctx.arc(v.x, v.y, R, 0, Math.PI * 2);
    ctx.fillStyle = (crisis ? 'rgba(239,68,68,0.2)' : color + '30');
    ctx.fill();
    ctx.restore();
  }

  // Círculo principal
  ctx.beginPath();
  ctx.arc(v.x, v.y, R, 0, Math.PI * 2);
  ctx.fillStyle = active ? (col + '22') : '#0F172A';
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = active ? 2.5 : 1.5;
  ctx.stroke();

  // Letra del vértice
  ctx.font = `bold 13px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = active ? col : '#475569';
  ctx.fillText(id, v.x, v.y);
  ctx.textBaseline = 'alphabetic';

  // Etiqueta fuera del círculo
  const margin = R + 10;
  ctx.font = `10px ui-sans-serif, system-ui`;
  ctx.fillStyle = active ? col : '#475569';

  if (position === 'top') {
    ctx.textAlign = 'center';
    ctx.fillText(label, v.x, v.y - margin);
  } else if (position === 'bottom-left') {
    ctx.textAlign = 'right';
    const lines = label.split(' ');
    const mid = Math.ceil(lines.length / 2);
    const l1 = lines.slice(0, mid).join(' ');
    const l2 = lines.slice(mid).join(' ');
    ctx.fillText(l1, v.x - margin, v.y + 10);
    if (l2) ctx.fillText(l2, v.x - margin, v.y + 23);
  } else {
    ctx.textAlign = 'left';
    const lines = label.split(' ');
    const mid = Math.ceil(lines.length / 2);
    const l1 = lines.slice(0, mid).join(' ');
    const l2 = lines.slice(mid).join(' ');
    ctx.fillText(l1, v.x + margin, v.y + 10);
    if (l2) ctx.fillText(l2, v.x + margin, v.y + 23);
  }
}

function drawGauge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  valueStr: string,
  value: number,
  min: number,
  max: number,
  color: string,
  active: boolean,
): void {
  const BAR_W = 170;
  const BAR_H = 6;
  const t = clamp((value - min) / (max - min), 0, 1);

  // Label
  ctx.font = '9px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = active ? '#94A3B8' : '#334155';
  ctx.fillText(label.toUpperCase(), x, y);

  // Valor
  ctx.font = 'bold 14px ui-monospace, monospace';
  ctx.fillStyle = active ? color : '#334155';
  ctx.fillText(valueStr, x, y + 17);

  // Barra de progreso
  ctx.fillStyle = '#1E293B';
  roundRect(ctx, x, y + 22, BAR_W, BAR_H, 3);
  ctx.fill();

  if (active) {
    ctx.fillStyle = color;
    roundRect(ctx, x, y + 22, BAR_W * t, BAR_H, 3);
    ctx.fill();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  if (w <= 0) return;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[19px] font-bold font-mono" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function CornerToggle({
  label, description, color, active, onToggle,
}: {
  label: string;
  description: string;
  color: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full text-left px-3 py-2.5 rounded-lg border transition"
      style={{
        borderColor: active ? color + '60' : '#1E293B',
        background: active ? color + '12' : 'transparent',
      }}>
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full border-2 flex-shrink-0 transition"
          style={{
            borderColor: active ? color : '#334155',
            background: active ? color : 'transparent',
          }}
        />
        <span className="text-[12px] font-mono" style={{ color: active ? color : '#64748B' }}>
          {label}
        </span>
      </div>
      {active && (
        <div className="text-[10px] text-[#64748B] mt-1 pl-5 leading-snug">{description}</div>
      )}
    </button>
  );
}

function Slider({
  label, value, min, max, step, onChange, fmt, hint, color,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
  hint?: string;
  color?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[12px] font-mono" style={{ color: color ?? '#FDB813' }}>
          {fmt ? fmt(value) : value.toFixed(2)}
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
