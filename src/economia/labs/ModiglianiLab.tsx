/**
 * ModiglianiLab — laboratorio del premio 1985 (Franco Modigliani).
 *
 * El click: tu vida entera es un solo presupuesto. La hipótesis del ciclo de
 * vida (LCH, 1954) dice que no ahorras por disciplina — ahorras porque tu
 * cerebro reparte el consumo a lo largo de toda la vida, incluso cuando el
 * ingreso cae a cero en la vejez.
 *
 * Matemática REAL y exacta (LCH de Modigliani-Brumberg):
 *
 *   Perfil de ingreso hump-shape:
 *     Y(t) = Y_peak · 4 · ((t − t0)/(t1 − t0)) · ((t1 − t)/(t1 − t0))
 *     donde t0 = edad inicio carrera, t1 = edad retiro; Y = 0 fuera de [t0, t1].
 *
 *   Riqueza acumulada en t (activos financieros, W ≥ 0 no forzado):
 *     W(t) = ∫_{t0}^{t} [Y(s) − C(s)] ds
 *
 *   Consumo suavizado óptimo (LCH bajo tasa de interés r = 0 para claridad):
 *     C* = W_total_lifetime / (T_vida − t0)
 *     donde W_total = ∫_{t0}^{T} Y(s) ds  +  W0 (herencia/riqueza inicial)
 *
 *   Con tasa de interés r > 0 (slider), el ingreso permanente descontado:
 *     PV = ∫_{t0}^{t_ret} Y(s) · e^{−r(s−t)} ds  +  W0
 *     C*(t) = PV / ∫_{t}^{T} e^{−r(s−t)} ds
 *
 *   Ahorro en cada período:
 *     S(t) = Y(t) − C*(t)
 *
 * El usuario puede arrastrar la línea de "edad actual" (t) y ver cómo cambia
 * la riqueza acumulada, el ahorro y el consumo. Los sliders controlan retiro,
 * longevidad, tasa de interés y pico de ingreso.
 */

import { useEffect, useRef, useState } from 'react';

/* ─── Constantes de layout ─────────────────────────────────────── */
const W = 820;
const H = 380;
const PAD_L = 54;
const PAD_R = 24;
const PAD_T = 38;
const PAD_B = 54;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const AGE_MIN = 18;
const AGE_MAX = 90;
const N_STEPS = 360; // sub-pasos por año para integración

/* ─── Estado de la simulación ───────────────────────────────────── */
interface Params {
  ageNow: number;      // edad actual (deslizador de arrastre)
  ageRetire: number;   // edad de retiro
  ageEnd: number;      // longevidad esperada
  ageStart: number;    // edad inicio carrera
  yPeak: number;       // ingreso pico (miles MXN / año)
  r: number;           // tasa de descuento / interés anual (0..0.08)
  w0: number;          // riqueza inicial (herencia / ahorro previo)
}

const DEFAULTS: Params = {
  ageNow: 35,
  ageRetire: 65,
  ageEnd: 85,
  ageStart: 22,
  yPeak: 400,  // $400k MXN/año en el pico
  r: 0.03,
  w0: 0,
};

/* ─── Helpers matemáticos ────────────────────────────────────────── */

/** Ingreso laboral en la edad t según perfil hump-shape. */
function income(t: number, p: Params): number {
  if (t < p.ageStart || t >= p.ageRetire) return 0;
  const span = p.ageRetire - p.ageStart;
  const x = (t - p.ageStart) / span;
  return p.yPeak * 4 * x * (1 - x);
}

/** Descuenta un flujo desde t hacia hoy a tasa r. */
function discount(t: number, tNow: number, r: number): number {
  return Math.exp(-r * Math.max(0, t - tNow));
}

/**
 * Consumo óptimo (LCH suavizado) en la edad tNow.
 * C* = PV_wealth / PV_años_restantes
 * donde PV integra con e^{-r(s-tNow)} desde tNow hasta ageEnd.
 */
function computeConsumption(tNow: number, p: Params, wAccum: number): number {
  const { ageEnd, r } = p;
  if (tNow >= ageEnd) return 0;

  const h = 1 / N_STEPS;
  let pvIncome = 0;
  let pvYears = 0;

  for (let i = 0; i < (ageEnd - tNow) * N_STEPS; i++) {
    const s = tNow + (i + 0.5) * h;
    const df = discount(s, tNow, r);
    pvIncome += income(s, p) * df * h;
    pvYears += df * h;
  }

  const totalWealth = wAccum + pvIncome; // riqueza actual + PV ingresos futuros
  if (pvYears < 1e-9 || totalWealth <= 0) return 0;
  return totalWealth / pvYears;
}

interface LifecycleSeries {
  ages: Float64Array;
  incomes: Float64Array;
  consumptions: Float64Array;
  savings: Float64Array;
  wealth: Float64Array;
}

/** Calcula las series completas año a año desde ageStart hasta ageEnd. */
function computeSeries(p: Params): LifecycleSeries {
  const { ageStart, ageEnd, w0 } = p;
  const n = Math.ceil((ageEnd - ageStart) * N_STEPS);
  const h = (ageEnd - ageStart) / n;

  // Salida a resolución 1 año
  const nYears = ageEnd - ageStart + 1;
  const ages = new Float64Array(nYears);
  const incomes = new Float64Array(nYears);
  const consumptions = new Float64Array(nYears);
  const savings = new Float64Array(nYears);
  const wealth = new Float64Array(nYears);

  // Acumular riqueza con RK4-simple (Euler de paso fino)
  let w = w0;
  let yi = 0;

  for (let age = ageStart; age <= ageEnd; age++) {
    const idx = age - ageStart;
    ages[idx] = age;
    const y = income(age, p);
    const c = computeConsumption(age, p, w);
    incomes[idx] = y;
    consumptions[idx] = c;
    savings[idx] = y - c;
    wealth[idx] = w;
    // avanzar un año con Euler de paso h
    for (let j = 0; j < Math.round(1 / h); j++) {
      const tSub = age + j * h;
      const ySub = income(tSub, p);
      const cSub = computeConsumption(tSub, p, w);
      w += (ySub - cSub) * h;
      if (w < -50) w = -50; // permitir pequeña deuda
    }
    yi++;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void yi;
  return { ages, incomes, consumptions, savings, wealth };
}

/* ─── Coordenadas canvas ─────────────────────────────────────────── */
function xOfAge(age: number): number {
  return PAD_L + ((age - AGE_MIN) / (AGE_MAX - AGE_MIN)) * PLOT_W;
}
function ageOfX(x: number): number {
  return Math.max(AGE_MIN, Math.min(AGE_MAX, AGE_MIN + ((x - PAD_L) / PLOT_W) * (AGE_MAX - AGE_MIN)));
}
function yOfVal(v: number, vMin: number, vMax: number): number {
  const t = Math.max(0, Math.min(1, (v - vMin) / Math.max(1, vMax - vMin)));
  return PAD_T + PLOT_H - t * PLOT_H;
}

/* ─── Componente principal ──────────────────────────────────────── */
export default function ModiglianiLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS });
  const draggingRef = useRef(false);
  const seriesRef = useRef<LifecycleSeries | null>(null);
  const dirtyRef = useRef(true);

  const [ageNow, setAgeNow] = useState(DEFAULTS.ageNow);
  const [ageRetire, setAgeRetire] = useState(DEFAULTS.ageRetire);
  const [ageEnd, setAgeEnd] = useState(DEFAULTS.ageEnd);
  const [yPeak, setYPeak] = useState(DEFAULTS.yPeak);
  const [r, setR] = useState(DEFAULTS.r);
  const [w0, setW0] = useState(DEFAULTS.w0);
  const [stats, setStats] = useState({ wealth: 0, saving: 0, consume: 0, income: 0 });

  // Sincroniza paramsRef cuando cambia cualquier slider
  useEffect(() => {
    const prev = paramsRef.current;
    const ageStart = DEFAULTS.ageStart;
    paramsRef.current = { ageNow, ageRetire, ageEnd, ageStart, yPeak, r, w0 };
    if (
      prev.ageRetire !== ageRetire ||
      prev.ageEnd !== ageEnd ||
      prev.yPeak !== yPeak ||
      prev.r !== r ||
      prev.w0 !== w0
    ) {
      dirtyRef.current = true;
    }
  }, [ageNow, ageRetire, ageEnd, yPeak, r, w0]);

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
    let frame = 0;

    function draw() {
      if (!ctx) return;
      const p = paramsRef.current;

      // Recomputa series si algo cambió (costoso, solo cuando dirty)
      if (dirtyRef.current || !seriesRef.current) {
        seriesRef.current = computeSeries(p);
        dirtyRef.current = false;
      }
      const ser = seriesRef.current!;

      // ── Fondo ──
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#05060A');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── Ejes ──
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD_L, PAD_T);
      ctx.lineTo(PAD_L, PAD_T + PLOT_H);
      ctx.lineTo(PAD_L + PLOT_W, PAD_T + PLOT_H);
      ctx.stroke();

      // Marcas de edad
      ctx.fillStyle = '#475569';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      for (let age = 20; age <= 90; age += 10) {
        const x = xOfAge(age);
        ctx.beginPath();
        ctx.moveTo(x, PAD_T + PLOT_H);
        ctx.lineTo(x, PAD_T + PLOT_H + 4);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillText(`${age}`, x, PAD_T + PLOT_H + 16);
      }
      ctx.fillStyle = '#475569';
      ctx.textAlign = 'center';
      ctx.fillText('edad', PAD_L + PLOT_W / 2, PAD_T + PLOT_H + 30);

      // Escala de valores (eje Y)
      const vMax = p.yPeak * 1.1;
      const vMin = -p.yPeak * 0.3;
      const vRange = vMax - vMin;

      // Línea de 0 en eje Y
      const y0 = yOfVal(0, vMin, vMax);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(PAD_L, y0);
      ctx.lineTo(PAD_L + PLOT_W, y0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#334155';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText('0', PAD_L - 4, y0 + 3);

      // Marcas eje Y
      const step = p.yPeak / 2;
      for (let v = step; v < vMax; v += step) {
        const yy = yOfVal(v, vMin, vMax);
        ctx.fillStyle = '#334155';
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${(v / 1000).toFixed(0)}k`, PAD_L - 4, yy + 3);
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(PAD_L, yy);
        ctx.lineTo(PAD_L + PLOT_W, yy);
        ctx.stroke();
      }
      void vRange;

      // ── Zona de ahorro / desahorro ──
      ctx.save();
      ctx.beginPath();
      ctx.rect(PAD_L, PAD_T, PLOT_W, PLOT_H);
      ctx.clip();

      // Relleno ahorro positivo (verde) y negativo (rojo)
      for (let i = 0; i < ser.ages.length - 1; i++) {
        const age1 = ser.ages[i];
        const age2 = ser.ages[i + 1];
        const s1 = ser.savings[i];
        const s2 = ser.savings[i + 1];
        const x1 = xOfAge(age1);
        const x2 = xOfAge(age2);
        const yy1 = yOfVal(s1, vMin, vMax);
        const yy2 = yOfVal(s2, vMin, vMax);
        const y0c = yOfVal(0, vMin, vMax);
        ctx.beginPath();
        ctx.moveTo(x1, y0c);
        ctx.lineTo(x1, yy1);
        ctx.lineTo(x2, yy2);
        ctx.lineTo(x2, y0c);
        ctx.closePath();
        ctx.fillStyle = (s1 + s2) / 2 >= 0
          ? 'rgba(52,211,153,0.12)'
          : 'rgba(239,68,68,0.12)';
        ctx.fill();
      }
      ctx.restore();

      // ── Curvas ──
      // Helper para trazar una curva
      function drawCurve(vals: Float64Array, color: string, lw: number) {
        ctx!.beginPath();
        ctx!.strokeStyle = color;
        ctx!.lineWidth = lw;
        ctx!.lineJoin = 'round';
        ctx!.save();
        ctx!.rect(PAD_L, PAD_T, PLOT_W, PLOT_H);
        ctx!.clip();
        for (let i = 0; i < ser.ages.length; i++) {
          const x = xOfAge(ser.ages[i]);
          const y = yOfVal(vals[i], vMin, vMax);
          if (i === 0) ctx!.moveTo(x, y); else ctx!.lineTo(x, y);
        }
        ctx!.stroke();
        ctx!.restore();
      }

      drawCurve(ser.incomes, '#FDB813', 2);       // ingreso: amarillo dorado
      drawCurve(ser.consumptions, '#4FC3F7', 2.5); // consumo: azul celeste
      drawCurve(ser.savings, '#34D399', 1.5);      // ahorro: verde

      // Riqueza: escala separada (eje secundario)
      const wMax = Math.max(...Array.from(ser.wealth)) * 1.15 + 50;
      const wMin = Math.min(Math.min(...Array.from(ser.wealth)) * 1.2, -50);
      ctx.save();
      ctx.rect(PAD_L, PAD_T, PLOT_W, PLOT_H);
      ctx.clip();
      ctx.beginPath();
      ctx.strokeStyle = '#A78BFA';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      for (let i = 0; i < ser.ages.length; i++) {
        const x = xOfAge(ser.ages[i]);
        const y = yOfVal(ser.wealth[i], wMin, wMax);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // ── Línea de retiro ──
      const xRetire = xOfAge(p.ageRetire);
      ctx.strokeStyle = '#FB923C';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(xRetire, PAD_T);
      ctx.lineTo(xRetire, PAD_T + PLOT_H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#FB923C';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`retiro ${p.ageRetire}`, xRetire, PAD_T - 6);

      // ── Línea de "edad actual" (arrastrable) ──
      const xNow = xOfAge(p.ageNow);
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xNow, PAD_T);
      ctx.lineTo(xNow, PAD_T + PLOT_H);
      ctx.stroke();

      // Punto en la curva de riqueza
      const idxNow = Math.max(0, Math.min(ser.ages.length - 1, Math.round(p.ageNow - p.ageStart)));
      const wNow = ser.wealth[idxNow] ?? 0;
      const cNow = ser.consumptions[idxNow] ?? 0;
      const yNow = ser.incomes[idxNow] ?? 0;
      const sNow = ser.savings[idxNow] ?? 0;

      // Circulito en curva de riqueza
      const wxNow = xOfAge(p.ageNow);
      const wyNow = yOfVal(wNow, wMin, wMax);
      ctx.save();
      ctx.shadowColor = '#A78BFA';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#A78BFA';
      ctx.beginPath();
      ctx.arc(wxNow, wyNow, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Etiqueta de edad actual
      ctx.fillStyle = '#E2E8F0';
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`tú: ${Math.round(p.ageNow)}`, xNow, PAD_T - 6);

      // ── Leyenda ──
      const leyendaItems: Array<{ color: string; label: string; dash?: boolean }> = [
        { color: '#FDB813', label: 'ingreso' },
        { color: '#4FC3F7', label: 'consumo' },
        { color: '#34D399', label: 'ahorro' },
        { color: '#A78BFA', label: 'riqueza acum.', dash: true },
      ];
      let lx = PAD_L + 6;
      const ly = PAD_T + 12;
      ctx.font = '10px ui-monospace, monospace';
      for (const item of leyendaItems) {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.dash ? 1.5 : 2;
        if (item.dash) ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + 18, ly);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = item.color;
        ctx.textAlign = 'left';
        ctx.fillText(item.label, lx + 22, ly + 3.5);
        lx += 80;
      }

      // ── Stats en canvas ──
      if (frame % 6 === 0) {
        setStats({
          wealth: Math.round(wNow),
          saving: Math.round(sNow),
          consume: Math.round(cNow),
          income: Math.round(yNow),
        });
      }

      frame++;
    }

    function loop() {
      draw();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    // ── Arrastre de la línea de edad actual ──
    const getAgeFromEvent = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (W / rect.width);
      const age = ageOfX(x);
      const p = paramsRef.current;
      const clamped = Math.max(p.ageStart, Math.min(p.ageEnd - 1, age));
      paramsRef.current = { ...p, ageNow: clamped };
      setAgeNow(Math.round(clamped));
    };
    const onDown = (e: PointerEvent) => {
      draggingRef.current = true;
      canvas.setPointerCapture(e.pointerId);
      getAgeFromEvent(e);
    };
    const onMove = (e: PointerEvent) => {
      if (draggingRef.current) getAgeFromEvent(e);
    };
    const onUp = () => { draggingRef.current = false; };
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

  const isRetired = ageNow >= ageRetire;
  const isYoung = ageNow < 30;

  const insight = isYoung
    ? `Eres joven: tu ingreso sube y el consumo suavizado ya "adelantó" el gasto futuro. Tu ahorro puede ser bajo o hasta negativo (deuda estudiantil). El ciclo de vida dice que eso es racional — pero AFORE primero, Netflix después.`
    : isRetired
    ? `Ya te retiraste: no hay ingreso laboral. Vives de la riqueza acumulada. Si esa curva morada ya tocó cero o está en negativo, tu yo joven no ahorró suficiente. El modelo de Modigliani lo predijo.`
    : `Estás en la fase de ahorro máximo: ingresas mucho y el consumo suavizado es menor. Aquí se construye el colchón para la vejez. Mueve el slider de retiro y ve cómo cambia todo: retirar más tarde da más tiempo para acumular.`;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        <div className="space-y-4">
          {/* Canvas */}
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block touch-none cursor-ew-resize"
              style={{ width: W, height: H }}
            />
          </div>
          <p className="text-[11px] text-[#475569] font-mono">
            ← arrastra en la gráfica para moverte en el tiempo de vida
          </p>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            <Stat label="ingreso" value={`$${(stats.income / 1000).toFixed(0)}k`} accent="#FDB813" />
            <Stat label="consumo" value={`$${(stats.consume / 1000).toFixed(0)}k`} accent="#4FC3F7" />
            <Stat label="ahorro" value={`$${(stats.saving / 1000).toFixed(0)}k`}
              accent={stats.saving >= 0 ? '#34D399' : '#EF4444'} />
            <Stat label="riqueza" value={`$${(stats.wealth / 1000).toFixed(0)}k`}
              accent={stats.wealth >= 0 ? '#A78BFA' : '#EF4444'} />
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">
              ✦ ¿qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>

          {/* Panel Modigliani-Miller */}
          <MMPanel yPeak={yPeak} />
        </div>

        {/* Sliders */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Tu vida económica
          </div>

          <Slider
            label="Tu edad actual"
            value={ageNow}
            min={22}
            max={ageEnd - 1}
            step={1}
            onChange={(v) => {
              setAgeNow(v);
              paramsRef.current = { ...paramsRef.current, ageNow: v };
            }}
            fmt={(v) => `${v} años`}
            hint="Muévete en el tiempo. Observa cómo cambia la riqueza acumulada."
          />
          <Slider
            label="Edad de retiro"
            value={ageRetire}
            min={50}
            max={80}
            step={1}
            onChange={(v) => {
              const nr = Math.min(v, ageEnd - 2);
              setAgeRetire(nr);
              dirtyRef.current = true;
            }}
            fmt={(v) => `${v} años`}
            hint="Retiro tarde = más ingreso acumulado. Retiro temprano = más años sin ingreso."
          />
          <Slider
            label="Longevidad esperada"
            value={ageEnd}
            min={70}
            max={95}
            step={1}
            onChange={(v) => {
              const ne = Math.max(v, ageRetire + 2);
              setAgeEnd(ne);
              dirtyRef.current = true;
            }}
            fmt={(v) => `${v} años`}
            hint="Vivir más requiere más ahorro. El modelo lo recalcula en tiempo real."
          />
          <Slider
            label="Ingreso pico (miles MXN/año)"
            value={yPeak}
            min={100}
            max={1500}
            step={50}
            onChange={(v) => {
              setYPeak(v);
              dirtyRef.current = true;
            }}
            fmt={(v) => `$${v.toFixed(0)}k`}
            hint="Tu sueldo más alto en toda la carrera. Afecta el consumo suavizado de toda la vida."
          />
          <Slider
            label="Tasa de interés / retorno"
            value={r}
            min={0}
            max={0.10}
            step={0.005}
            onChange={(v) => {
              setR(v);
              dirtyRef.current = true;
            }}
            fmt={(v) => `${(v * 100).toFixed(1)}%`}
            hint="Con tasa alta, el ahorro de hoy vale más mañana. Cambia el consumo óptimo."
          />
          <Slider
            label="Riqueza inicial / herencia"
            value={w0}
            min={0}
            max={2000}
            step={50}
            onChange={(v) => {
              setW0(v);
              dirtyRef.current = true;
            }}
            fmt={(v) => `$${v}k`}
            hint="Herencia o ahorro previo. Sube el consumo suavizado desde el inicio."
          />

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo: Modigliani-Brumberg LCH (1954)<br />
            C* = PV(ingresos + riqueza) / PV(años restantes)<br />
            S(t) = Y(t) − C*(t) · Modigliani-Miller (1958)
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Panel Modigliani-Miller ────────────────────────────────────── */
function MMPanel({ yPeak }: { yPeak: number }) {
  // MM theorem: V_firm = V_L (con deuda) = V_U (sin deuda) en mercado perfecto
  // Solo cambia la estructura, no el valor total
  const [debtFrac, setDebtFrac] = useState(0.4); // fracción financiada con deuda
  const firmValue = yPeak * 8; // valor simplificado: P/E = 8
  const equity = firmValue * (1 - debtFrac);
  const debt = firmValue * debtFrac;

  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4 space-y-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#FDB813] font-mono">
        ✦ Modigliani-Miller: el pastel es el mismo
      </div>
      <p className="text-[12px] text-[#94A3B8] leading-snug">
        ¿Deuda o capital accionario? En un mercado limpio (sin impuestos), no importa.
        El valor de la empresa no cambia — solo cambia cómo lo cortas.
      </p>

      <Slider
        label="Fracción financiada con deuda"
        value={debtFrac}
        min={0}
        max={0.9}
        step={0.05}
        onChange={setDebtFrac}
        fmt={(v) => `${(v * 100).toFixed(0)}% deuda`}
        hint="Mueve esto: el valor total no cambia. Solo cambia quién tiene qué rebanada."
      />

      <div className="grid grid-cols-3 gap-2 pt-1">
        <Stat label="Valor total" value={`$${(firmValue / 1000).toFixed(0)}M`} accent="#FDB813" />
        <Stat label="Capital (equity)" value={`$${(equity / 1000).toFixed(0)}M`} accent="#4FC3F7" />
        <Stat label="Deuda" value={`$${(debt / 1000).toFixed(0)}M`} accent="#FB923C" />
      </div>

      {/* Barra visual del pastel */}
      <div className="h-5 rounded-full overflow-hidden flex">
        <div className="h-full transition-all duration-200"
          style={{ width: `${(1 - debtFrac) * 100}%`, background: 'rgba(79,195,247,0.7)' }} />
        <div className="h-full transition-all duration-200"
          style={{ width: `${debtFrac * 100}%`, background: 'rgba(251,146,60,0.7)' }} />
      </div>
      <div className="flex justify-between text-[10px] text-[#64748B] font-mono">
        <span>equity (azul)</span>
        <span>deuda (naranja)</span>
      </div>
      <p className="text-[11px] text-[#475569] leading-snug">
        MM dice: el pastel total {`$${(firmValue / 1000).toFixed(0)}M`} no se mueve aunque cambies el split.
        Lo que sí mueve el valor en la realidad: <span className="text-[#FDB813]">impuestos</span> (intereses son deducibles → deuda conviene) y <span className="text-[#EF4444]">riesgo de quiebra</span>.
      </p>
    </div>
  );
}

/* ─── Subcomponentes ─────────────────────────────────────────────── */
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[17px] font-bold font-mono leading-tight" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function Slider({
  label, value, min, max, step, onChange, fmt, hint,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[12px] font-mono text-[#FDB813]">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#4FC3F7]"
      />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}
