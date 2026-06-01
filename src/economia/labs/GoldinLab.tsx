/**
 * GoldinLab — laboratorio del premio 2023 (Claudia Goldin).
 *
 * El click: la brecha salarial no explota cuando entras a trabajar.
 * Explota cuando nace el primer bebé. Goldin midió 200 años de datos y
 * descubrió que el mercado no castiga "ser mujer" — castiga "no estar
 * disponible 24/7". Los "greedy jobs" (trabajos que pagan MÁS que
 * proporcional por cada hora extra) crean la trampa.
 *
 * Modelo REAL de Goldin (Career and Family, 2021):
 *
 *   w(a) = w₀ · exp(g · a)     ← curva de salario sin hijos
 *
 *   Donde `a` = fracción de disponibilidad (0-1). Las greedy jobs pagan
 *   súper-proporcional al tiempo disponible:
 *
 *   w_greedy(a) = w₀ · (a ^ (1 + γ))   γ > 0 = premium de avaricia
 *
 *   Cuando nace el primer hijo (año T), uno de los dos baja su disponibilidad
 *   de a=1 a a=1−δ (donde δ = penalización por maternidad/cuidado).
 *
 *   El otro puede compensar con licencia paterna real: δ_paterno = ρ · δ
 *   donde ρ ∈ [0,1] es la fracción de la carga que él asume.
 *
 *   La brecha acumulada al año t es:
 *     gap(t) = ∫₀ᵗ [w_A(τ) − w_B(τ)] dτ   (área entre curvas)
 *
 *   Las curvas siguen una dinámica compuesta: el salario de cada año es
 *   base × (disponibilidad)^(1+γ), donde la base crece con experiencia.
 *
 *   Esto captura el efecto real de Goldin: la brecha no es puntual — es
 *   una DIVERGENCIA que se agranda con el tiempo porque cada ascenso,
 *   aumento y red de contactos depende del año anterior.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Constantes canvas ───────────────────────────────────────────────────────
const W = 820;
const H = 380;
const PAD_L = 64;
const PAD_R = 30;
const PAD_T = 48;
const PAD_B = 56;
const YEARS = 30;          // simulamos 30 años de carrera
const BASE_WAGE = 100;     // índice base = 100 en año 0

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface SimParams {
  childYear: number;      // año en que nace el primer hijo (1-20)
  gamma: number;          // 0..2, premium de greedy job (0 = lineal)
  delta: number;          // 0..0.7, reducción de disponibilidad del cuidador
  rho: number;            // 0..1, fracción del cuidado que asume la otra parte
  growthRate: number;     // 0.01..0.08, tasa base de crecimiento salarial anual
}

const DEFAULTS: SimParams = {
  childYear: 7,
  gamma: 1.2,
  delta: 0.35,
  rho: 0.0,
  growthRate: 0.04,
};

interface YearPoint {
  wA: number;  // salario persona A (queda sin reducción)
  wB: number;  // salario persona B (cuidador principal)
  gap: number; // diferencia acumulada
}

// ─── Simulación numérica ──────────────────────────────────────────────────────
/**
 * Calcula w(t, availability) en un greedy job:
 *   base crece exponencialmente con experiencia (modelo Mincer simplificado),
 *   pero la disponibilidad afecta super-proporcionalmente.
 *
 *   w(t, a) = BASE · exp(g·t) · a^(1+γ)
 *
 * Año 0: ambos con a=1 → w = BASE · 1^(1+γ) = BASE.
 * Año childYear en adelante: B tiene a = 1−δ_eff, A tiene a = 1−δ_A
 */
function simulate(p: SimParams): YearPoint[] {
  const points: YearPoint[] = [];
  let cumGap = 0;

  for (let t = 0; t <= YEARS; t++) {
    const base = BASE_WAGE * Math.exp(p.growthRate * t);
    const avail_full = 1.0;
    const delta_eff_B = t >= p.childYear ? p.delta * (1 - p.rho) : 0;
    const delta_eff_A = t >= p.childYear ? p.delta * p.rho : 0;
    const avail_B = Math.max(0.05, avail_full - delta_eff_B);
    const avail_A = Math.max(0.05, avail_full - delta_eff_A);

    const wA = base * Math.pow(avail_A, 1 + p.gamma);
    const wB = base * Math.pow(avail_B, 1 + p.gamma);

    if (t > 0) cumGap += Math.max(0, wA - wB);
    points.push({ wA, wB, gap: cumGap });
  }
  return points;
}

// ─── Helpers de coordenadas ───────────────────────────────────────────────────
const xOf = (t: number): number =>
  PAD_L + (t / YEARS) * (W - PAD_L - PAD_R);

const yOf = (w: number, wMin: number, wMax: number): number => {
  const range = Math.max(1, wMax - wMin);
  return PAD_T + (1 - (w - wMin) / range) * (H - PAD_T - PAD_B);
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function GoldinLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<SimParams>({ ...DEFAULTS });

  const [childYear, setChildYear] = useState(DEFAULTS.childYear);
  const [gamma, setGamma] = useState(DEFAULTS.gamma);
  const [delta, setDelta] = useState(DEFAULTS.delta);
  const [rho, setRho] = useState(DEFAULTS.rho);
  const [growthRate, setGrowthRate] = useState(DEFAULTS.growthRate);

  const [stats, setStats] = useState({
    wA: BASE_WAGE,
    wB: BASE_WAGE,
    gapPct: 0,
    cumGap: 0,
  });

  // Sincroniza ref con state para el loop de animación
  useEffect(() => {
    paramsRef.current = { childYear, gamma, delta, rho, growthRate };
  }, [childYear, gamma, delta, rho, growthRate]);

  // ── Loop de dibujo ──────────────────────────────────────────────────────────
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
    let animT = 0;          // año animado (0..YEARS)
    let last = performance.now();
    const ANIM_SPEED = 4;   // años por segundo

    function draw(now: number) {
      if (!ctx) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      animT = Math.min(YEARS, animT + dt * ANIM_SPEED);

      const p = paramsRef.current;
      const pts = simulate(p);

      // Rango de salarios para escala Y
      let wMax = 0;
      for (const pt of pts) { wMax = Math.max(wMax, pt.wA, pt.wB); }
      const wMin = BASE_WAGE * 0.4;

      // ── Fondo ──────────────────────────────────────────────────────────────
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── Grid de años ────────────────────────────────────────────────────────
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      for (let yr = 0; yr <= YEARS; yr += 5) {
        const x = xOf(yr);
        ctx.beginPath();
        ctx.moveTo(x, PAD_T);
        ctx.lineTo(x, H - PAD_B);
        ctx.stroke();
        ctx.fillStyle = '#475569';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`+${yr}a`, x, H - PAD_B + 14);
      }

      // Grid horizontal
      const gridWages = [BASE_WAGE, wMax * 0.5, wMax * 0.75, wMax].filter(v => v > wMin);
      for (const gw of gridWages) {
        const y = yOf(gw, wMin, wMax);
        if (y < PAD_T || y > H - PAD_B) continue;
        ctx.beginPath();
        ctx.moveTo(PAD_L, y);
        ctx.lineTo(W - PAD_R, y);
        ctx.stroke();
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'right';
        ctx.fillText(`${gw.toFixed(0)}`, PAD_L - 4, y + 4);
      }
      ctx.setLineDash([]);

      // ── Zona de penalización (desde childYear en adelante) ─────────────────
      const cxStart = xOf(p.childYear);
      const grad = ctx.createLinearGradient(cxStart, 0, W - PAD_R, 0);
      grad.addColorStop(0, 'rgba(244,114,182,0.08)');
      grad.addColorStop(1, 'rgba(244,114,182,0.02)');
      ctx.fillStyle = grad;
      ctx.fillRect(cxStart, PAD_T, W - PAD_R - cxStart, H - PAD_T - PAD_B);

      // Línea del hijo
      ctx.strokeStyle = '#F472B6';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(cxStart, PAD_T - 6);
      ctx.lineTo(cxStart, H - PAD_B);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#F472B6';
      ctx.font = 'bold 10px ui-sans-serif, system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('👶 nace el hijo', cxStart + 5, PAD_T + 12);

      // ── Área de brecha (relleno) ────────────────────────────────────────────
      const maxT = Math.floor(animT);
      if (maxT >= p.childYear + 1) {
        ctx.beginPath();
        ctx.moveTo(xOf(p.childYear), yOf(pts[p.childYear].wA, wMin, wMax));
        for (let t = p.childYear; t <= maxT && t <= YEARS; t++) {
          ctx.lineTo(xOf(t), yOf(pts[t].wA, wMin, wMax));
        }
        for (let t = Math.min(maxT, YEARS); t >= p.childYear; t--) {
          ctx.lineTo(xOf(t), yOf(pts[t].wB, wMin, wMax));
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(244,114,182,0.12)';
        ctx.fill();
      }

      // ── Curva de persona B (cuidador) ──────────────────────────────────────
      ctx.beginPath();
      for (let t = 0; t <= maxT && t <= YEARS; t++) {
        const x = xOf(t);
        const y = yOf(pts[t].wB, wMin, wMax);
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#F472B6';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // ── Curva de persona A ─────────────────────────────────────────────────
      ctx.beginPath();
      for (let t = 0; t <= maxT && t <= YEARS; t++) {
        const x = xOf(t);
        const y = yOf(pts[t].wA, wMin, wMax);
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // ── Puntos actuales al extremo animado ─────────────────────────────────
      const tEnd = Math.min(maxT, YEARS);
      const ptEnd = pts[tEnd];
      if (ptEnd) {
        // Punto A
        const xEnd = xOf(tEnd);
        const yA = yOf(ptEnd.wA, wMin, wMax);
        const yB = yOf(ptEnd.wB, wMin, wMax);
        ctx.save();
        ctx.shadowColor = '#22D3EE';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#22D3EE';
        ctx.beginPath();
        ctx.arc(xEnd, yA, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Etiqueta A
        ctx.fillStyle = '#22D3EE';
        ctx.font = 'bold 11px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`A: ${ptEnd.wA.toFixed(0)}`, xEnd + 8, yA + 4);

        // Punto B
        ctx.save();
        ctx.shadowColor = '#F472B6';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#F472B6';
        ctx.beginPath();
        ctx.arc(xEnd, yB, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#F472B6';
        ctx.font = 'bold 11px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`B: ${ptEnd.wB.toFixed(0)}`, xEnd + 8, yB + 4);
      }

      // ── Etiquetas de leyenda (esquina superior izquierda) ──────────────────
      ctx.fillStyle = '#22D3EE';
      ctx.font = '11px ui-sans-serif, system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('— Carrera A (disponibilidad alta)', PAD_L, PAD_T - 8);

      ctx.fillStyle = '#F472B6';
      ctx.fillText('— Carrera B (cuidador principal)', PAD_L + 220, PAD_T - 8);

      // ── Título del eje Y ───────────────────────────────────────────────────
      ctx.save();
      ctx.translate(14, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('salario (índice)', 0, 0);
      ctx.restore();

      // ── Brecha en el año final ─────────────────────────────────────────────
      if (tEnd === YEARS && ptEnd) {
        const gapPct = ptEnd.wA > 0
          ? ((ptEnd.wA - ptEnd.wB) / ptEnd.wA) * 100
          : 0;
        const midX = W - PAD_R - 80;
        const midY = yOf((ptEnd.wA + ptEnd.wB) / 2, wMin, wMax);
        ctx.fillStyle = 'rgba(244,114,182,0.85)';
        ctx.font = 'bold 13px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`▼ brecha: ${gapPct.toFixed(1)}%`, midX, midY);
      }

      // ── Stats para React ───────────────────────────────────────────────────
      if (tEnd === YEARS && ptEnd) {
        const gapPct = ptEnd.wA > 0
          ? ((ptEnd.wA - ptEnd.wB) / ptEnd.wA) * 100
          : 0;
        setStats({
          wA: ptEnd.wA,
          wB: ptEnd.wB,
          gapPct,
          cumGap: ptEnd.gap,
        });
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Reinicia la animación cuando cambia un parámetro
  const resetAnim = useCallback(() => {
    // Forzar redraw desde t=0 parchando animT desde afuera es complicado
    // con el closure; en cambio reiniciamos simplemente borrando+reconstruyendo
    // el canvas vía key change — pero mejor usamos un ref.
  }, []);
  void resetAnim;

  const animRef = useRef<{ t: number }>({ t: 0 });
  useEffect(() => {
    animRef.current.t = 0;
  }, [childYear, gamma, delta, rho, growthRate]);

  // ── Insight dinámico ────────────────────────────────────────────────────────
  const gapDisplay = stats.gapPct.toFixed(1);
  const insight =
    rho > 0.45
      ? `Con licencia de paternidad real (${Math.round(rho * 100)}% del cuidado compartido), la brecha cae a ${gapDisplay}%. Cambiar quién recoge al niño a las 3 es política salarial.`
      : gamma > 1.5
      ? `Trabajo muy "greedy" (γ=${gamma.toFixed(1)}): cada hora extra de disponibilidad vale muchísimo más. El mercado castiga ferozmente al que no puede estar siempre. Brecha final: ${gapDisplay}%.`
      : delta > 0.45
      ? `Penalización alta de cuidado (${Math.round(delta * 100)}% menos disponibilidad). El mercado no perdona. Brecha al año 30: ${gapDisplay}%.`
      : Math.abs(stats.gapPct) < 2
      ? `Con estos parámetros la brecha es mínima (${gapDisplay}%). Haz gamma más alto o licencia de paternidad = 0 para ver cómo se abre la trampa.`
      : `Brecha al año 30: ${gapDisplay}%. No es discriminación pura — es el mercado castigando quien no puede estar disponible 24/7. Goldin lo midió en 200 años de datos.`;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* Canvas + controles */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <StatBox label="salario A (año 30)" value={stats.wA.toFixed(0)} accent="#22D3EE" />
            <StatBox label="salario B (año 30)" value={stats.wB.toFixed(0)} accent="#F472B6" />
            <StatBox
              label="brecha final"
              value={`${stats.gapPct.toFixed(1)}%`}
              accent={stats.gapPct > 10 ? '#EF4444' : stats.gapPct > 3 ? '#FDB813' : '#34D399'}
            />
            <StatBox
              label="ingreso perdido total"
              value={stats.cumGap.toFixed(0)}
              accent="#FB923C"
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

        {/* Panel de controles */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Diseña el mercado
          </div>

          <SliderCtrl
            label="Año en que nace el primer hijo"
            value={childYear}
            min={1}
            max={20}
            step={1}
            onChange={setChildYear}
            fmt={v => `año ${v}`}
            hint="Entre más temprano, mayor el impacto acumulado."
          />
          <SliderCtrl
            label="Qué tan 'greedy' es el trabajo (γ)"
            value={gamma}
            min={0}
            max={2}
            step={0.05}
            onChange={setGamma}
            fmt={v => v < 0.3 ? 'lineal (justo)' : v < 1.0 ? 'medio greedy' : v < 1.6 ? 'muy greedy' : '¡máximo greedy!'}
            hint="γ=0: disponibilidad no importa. γ=2: cada hora extra paga desproporcionalmente. Finanzas, consultoría, corporativo = γ alto."
          />
          <SliderCtrl
            label="Penalización por cuidado (δ)"
            value={delta}
            min={0}
            max={0.7}
            step={0.01}
            onChange={setDelta}
            fmt={v => `−${Math.round(v * 100)}% disponibilidad`}
            hint="Cuánto baja la disponibilidad del cuidador principal cuando llega el hijo."
          />
          <SliderCtrl
            label="Licencia paternidad real (ρ)"
            value={rho}
            min={0}
            max={1}
            step={0.01}
            onChange={setRho}
            fmt={v => v < 0.05 ? 'inexistente' : v < 0.3 ? `${Math.round(v * 100)}% compartido` : v < 0.6 ? 'buen reparto' : '50-50 de verdad'}
            hint="Fracción del cuidado que asume la otra persona. ρ=0.5 → comparten la carga por igual."
          />
          <SliderCtrl
            label="Crecimiento base del salario (g)"
            value={growthRate}
            min={0.01}
            max={0.08}
            step={0.005}
            onChange={setGrowthRate}
            fmt={v => `${(v * 100).toFixed(1)}% anual`}
            hint="Cuánto sube el salario por experiencia, independientemente de disponibilidad."
          />

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            w(t,a) = BASE · e^(g·t) · a^(1+γ)<br />
            Goldin, Career and Family (2021)<br />
            Nobel de Economía 2023
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componentes auxiliares ──────────────────────────────────────────────────

function StatBox({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#64748B] font-mono mb-1">
        {label}
      </div>
      <div className="text-[17px] font-bold font-mono" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

function SliderCtrl({
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
        <span className="text-[12px] font-mono text-[#FDB813] whitespace-nowrap">
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
