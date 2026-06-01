/**
 * KydlandPrescottLab — laboratorio del premio 2004 (Kydland & Prescott).
 *
 * EL CLICK: "Banxico no le obedece al presidente — y eso salva tu quincena."
 *
 * Modelo REAL: inconsistencia temporal (Kydland & Prescott 1977).
 *
 * El gobierno elige inflación π. Los trabajadores forman expectativas πᵉ.
 * Función de utilidad del gobierno (Barro-Gordon 1983, que formaliza K&P):
 *
 *   W(π, πᵉ) = −a·π² + b·(π − πᵉ)     [a, b > 0]
 *
 * Primer término: costo de la inflación (la detesta la sociedad).
 * Segundo término: beneficio de "sorprender" — si π > πᵉ, el output/empleo
 * sube en el corto plazo (curva de Phillips de corto plazo).
 *
 * Equilibrio discrecional (sin compromiso):
 *   Maximizar W respecto a π dado πᵉ fijo → π* = b/(2a)
 *   Los trabajadores lo anticipan → πᵉ = b/(2a)
 *   Resultado: inflación alta, W = −b²/(4a)   — sesgo inflacionario
 *
 * Equilibrio con regla (banco central autónomo):
 *   Gobierno se compromete a π=0. Si es creíble, πᵉ=0 y W=0. MEJOR.
 *
 * La simulación: el usuario controla el "temptation slider" (b) y ve
 * cómo el equilibrio de Nash discrecional genera inflación aunque todos
 * lo verían venir. Puede alternar entre Gobierno Libre vs Banco Autónomo.
 */

import { useEffect, useRef, useState } from 'react';

/* ─── Dimensiones del canvas ─── */
const W = 820;
const H = 400;

/* ─── Parámetros del modelo ─── */
const A_COST  = 1.0;    // costo social de la inflación (fijo)

interface SimParams {
  b: number;          // tentación (beneficio de sorprender, 0..4)
  mode: 'rule' | 'discretion';
  showNash: boolean;
}

interface State {
  // Historial de la simulación (t = períodos)
  inflation: number[];      // π_t elegida por banco
  expected: number[];       // πᵉ_t de los trabajadores (expectativas racionales)
  welfare: number[];        // W_t realizado
  t: number;
  // animación de la ficha de tentación
  temptX: number;
  temptVX: number;
}

const MAX_HIST = 60;
const SIM_STEP = 1 / 60;
const SIM_SPEED = 0.8;  // períodos por segundo

/* ─── Utilidades del modelo ─── */
function optimalPi(b: number, piE: number): number {
  // arg-max de W = −a·π² + b·(π − πᵉ)  →  dW/dπ = −2a·π + b = 0  →  π = b/(2a)
  return b / (2 * A_COST);
}

function welfare(pi: number, piE: number, b: number): number {
  return -A_COST * pi * pi + b * (pi - piE);
}

/* equilibrio de Nash discrecional: πᵉ = b/(2a) = mismo que π óptimo */
function nashPi(b: number): number { return b / (2 * A_COST); }

/* ─── Coordenadas del canvas ─── */
const PI_MAX = 5;
const CHART_L = 56, CHART_R = W - 40, CHART_T = 48, CHART_B = H - 64;
const CHART_W = CHART_R - CHART_L;
const CHART_H = CHART_B - CHART_T;

function xOfT(t: number, total: number): number {
  return CHART_L + (t / Math.max(1, total - 1)) * CHART_W;
}
function yOfPi(pi: number): number {
  return CHART_B - (pi / PI_MAX) * CHART_H;
}

/* ──────────────────────────────────────────────────────── */
export default function KydlandPrescottLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<SimParams>({ b: 2.0, mode: 'discretion', showNash: true });
  const stateRef  = useRef<State>({
    inflation: [], expected: [], welfare: [], t: 0,
    temptX: 0, temptVX: 0,
  });

  const [b,        setB       ] = useState(2.0);
  const [mode,     setMode    ] = useState<'rule' | 'discretion'>('discretion');
  const [showNash, setShowNash] = useState(true);
  const [stats,    setStats   ] = useState({ pi: 0, piE: 0, w: 0, piNash: 0, piRule: 0 });

  /* Sincroniza ref con estado React */
  useEffect(() => {
    paramsRef.current = { b, mode, showNash };
  }, [b, mode, showNash]);

  /* Reset historial al cambiar modo */
  useEffect(() => {
    stateRef.current.inflation = [];
    stateRef.current.expected  = [];
    stateRef.current.welfare   = [];
    stateRef.current.t         = 0;
  }, [mode]);

  /* ── Loop principal ── */
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
    let acc  = 0.0;

    /* ── avanza un período de simulación ── */
    function tick() {
      const p  = paramsRef.current;
      const st = stateRef.current;
      const len = st.inflation.length;

      /* Expectativas: trabajadores son racionales → anticipan el equilibrio.
         Si el banco es libre (discrecional): πᵉ = Nash = b/(2a)
         Si hay regla creíble:               πᵉ = 0  (creen el compromiso)   */
      const piE: number = p.mode === 'rule' ? 0 : nashPi(p.b);

      /* Decisión del banco:
         Libre: maximiza W dado piE → π = b/(2a)
         Regla: se compromete a 0 (aunque podría ganar con trampa)           */
      const pi: number = p.mode === 'rule' ? 0 : optimalPi(p.b, piE);

      const w = welfare(pi, piE, p.b);

      if (len >= MAX_HIST) {
        st.inflation.shift(); st.expected.shift(); st.welfare.shift();
      }
      st.inflation.push(pi);
      st.expected.push(piE);
      st.welfare.push(w);
      st.t++;
    }

    /* ── animación de la "ficha de tentación" en el eje π ── */
    function updateTempt(h: number) {
      const p  = paramsRef.current;
      const st = stateRef.current;
      const targetX = p.mode === 'rule' ? 0 : nashPi(p.b);
      const force   = (targetX - st.temptX) * 18;
      st.temptVX   += force * h;
      st.temptVX   *= (1 - 5 * h);
      st.temptX    += st.temptVX * h;
    }

    /* ── renderizado ── */
    function draw() {
      if (!ctx) return;
      const p  = paramsRef.current;
      const st = stateRef.current;
      const piNash = nashPi(p.b);
      const piRule = 0;

      /* Fondo */
      ctx.fillStyle = '#05060A';
      ctx.fillRect(0, 0, W, H);

      /* Grid horizontal */
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1;
      for (let pi = 0; pi <= PI_MAX; pi++) {
        const y = yOfPi(pi);
        ctx.strokeStyle = pi === 0 ? '#1E293B' : '#111827';
        ctx.beginPath(); ctx.moveTo(CHART_L, y); ctx.lineTo(CHART_R, y); ctx.stroke();
        ctx.fillStyle = '#475569';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${pi}%`, CHART_L - 6, y + 3);
      }
      ctx.setLineDash([]);

      /* ── Curva de indiferencia: W = cte como función de (π, πᵉ) ──
         Para cada valor fijo de piE, dibujamos la parábola W(π) */
      const piECurrent = p.mode === 'rule' ? 0 : piNash;
      // Curva de bienestar bajo el equilibrio actual
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const pi = (i / 80) * PI_MAX;
        const w  = welfare(pi, piECurrent, p.b);
        // w va desde muy negativo (pi muy alto) a positivo en pi óptimo
        // Normalizar w para mostrarlo: convertimos en un "heatmap" de fondo
        // En su lugar mostramos la curva de ganancia marginal del banco
        const x = CHART_L + (pi / PI_MAX) * CHART_W;
        const wNorm = Math.max(0, Math.min(1, (w + 6) / 8));
        if (i === 0) ctx.moveTo(x, CHART_B - wNorm * CHART_H);
        else ctx.lineTo(x, CHART_B - wNorm * CHART_H);
      }
      ctx.strokeStyle = 'rgba(99,102,241,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(99,102,241,0.06)';
      ctx.lineTo(CHART_R, CHART_B);
      ctx.lineTo(CHART_L, CHART_B);
      ctx.closePath();
      ctx.fill();

      /* ── Línea del equilibrio Nash (sin compromiso) ── */
      if (p.showNash) {
        const xNash = CHART_L + (piNash / PI_MAX) * CHART_W;
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(xNash, CHART_T); ctx.lineTo(xNash, CHART_B); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Nash: ${piNash.toFixed(1)}%`, xNash, CHART_T - 6);
      }

      /* ── Línea del equilibrio con regla (π=0) ── */
      {
        const xRule = CHART_L;
        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(xRule, CHART_T); ctx.lineTo(xRule, CHART_B); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#34D399';
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Regla: 0%', xRule + 22, CHART_T - 6);
      }

      /* ── Historial de inflación y expectativas ── */
      const hist = st.inflation;
      const exp  = st.expected;
      if (hist.length > 1) {
        // Inflación realizada
        ctx.beginPath();
        for (let i = 0; i < hist.length; i++) {
          const x = xOfT(i, hist.length);
          const y = yOfPi(hist[i]);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = p.mode === 'rule' ? '#34D399' : '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Expectativas
        ctx.beginPath();
        for (let i = 0; i < exp.length; i++) {
          const x = xOfT(i, exp.length);
          const y = yOfPi(exp[i]);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(148,163,184,0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      /* ── Ficha animada (posición del banco en π) ── */
      {
        const piCurrent = hist.length ? hist[hist.length - 1] : 0;
        const bx = CHART_L + (Math.min(piCurrent, PI_MAX) / PI_MAX) * CHART_W;
        const by = yOfPi(piCurrent);
        ctx.save();
        ctx.shadowColor = p.mode === 'rule' ? '#34D399' : '#F59E0B';
        ctx.shadowBlur = 18;
        const gr = ctx.createRadialGradient(bx - 3, by - 3, 2, bx, by, 11);
        gr.addColorStop(0, p.mode === 'rule' ? '#D1FAE5' : '#FEF3C7');
        gr.addColorStop(1, p.mode === 'rule' ? '#10B981' : '#F59E0B');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(bx, by, 11, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${piCurrent.toFixed(1)}%`, bx, by - 16);
      }

      /* ── Etiquetas de los ejes ── */
      ctx.fillStyle = '#64748B';
      ctx.font = '11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('← tiempo (períodos) →', W / 2, H - 10);
      ctx.save();
      ctx.translate(14, CHART_T + CHART_H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('inflación π (%)', 0, 0);
      ctx.restore();

      /* ── Leyenda ── */
      const ly = CHART_B + 14;
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = p.mode === 'rule' ? '#34D399' : '#F59E0B';
      ctx.fillRect(CHART_L, ly + 2, 22, 3);
      ctx.fillText('π realizada', CHART_L + 28, ly + 6);
      ctx.fillStyle = 'rgba(148,163,184,0.7)';
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(148,163,184,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(CHART_L + 140, ly + 4); ctx.lineTo(CHART_L + 162, ly + 4);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillText('πᵉ esperada', CHART_L + 168, ly + 6);

      /* ── Modo indicator ── */
      const modeLabel = p.mode === 'rule'
        ? '✦ BANCO AUTÓNOMO — compromiso creíble'
        : '⚡ BANCO LIBRE — optimiza cada período';
      ctx.fillStyle = p.mode === 'rule' ? '#34D399' : '#EF4444';
      ctx.font = 'bold 12px ui-sans-serif, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(modeLabel, CHART_R, CHART_T - 6);

      /* ── Stats para React ── */
      const piLast = hist.length ? hist[hist.length - 1] : 0;
      const piELast = exp.length ? exp[exp.length - 1] : 0;
      const wLast  = st.welfare.length ? st.welfare[st.welfare.length - 1] : 0;
      setStats({ pi: piLast, piE: piELast, w: wLast, piNash, piRule });
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += dt * SIM_SPEED;
      while (acc >= SIM_STEP) {
        tick();
        updateTempt(SIM_STEP);
        acc -= SIM_STEP;
      }
      draw();
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ── Insight dinámico ── */
  const wNash = -A_COST * (b / (2 * A_COST)) ** 2;  // bienestar en equilibrio discrecional
  const wRule = 0;                                    // bienestar con regla (pi=0, piE=0)

  const insight =
    mode === 'rule'
      ? `Con banco autónomo y regla creíble: π = 0%, πᵉ = 0%, bienestar = 0. ¡El mercado te cree y la inflación ni empieza! Pero si el gobierno rompe el compromiso un solo período, la credibilidad tarda años en reconstruirse.`
      : `Sin compromiso, el equilibrio de Nash garantiza π = ${nashPi(b).toFixed(1)}% — no porque el gobierno "sea malo", sino porque los trabajadores ya anticiparon la trampa. Bienestar realizado ≈ ${wNash.toFixed(2)} vs ${wRule} con regla. Eso es el costo del sesgo inflacionario.`;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* ── Canvas ── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#05060A] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Botones de modo */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setMode('discretion')}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                mode === 'discretion'
                  ? 'border-[#EF4444]/60 bg-[#EF4444]/10 text-[#EF4444]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              ⚡ Banco libre (discrecional)
            </button>
            <button
              onClick={() => setMode('rule')}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                mode === 'rule'
                  ? 'border-[#34D399]/60 bg-[#34D399]/10 text-[#34D399]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              ✦ Banco autónomo (regla)
            </button>
            <button
              onClick={() => setShowNash(v => !v)}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                showNash
                  ? 'border-[#EF4444]/40 bg-[#EF4444]/05 text-[#EF4444]/80'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              {showNash ? '○ ocultar Nash' : '○ mostrar Nash'}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <Stat label="π realizada" value={`${stats.pi.toFixed(1)}%`}
                  accent={mode === 'rule' ? '#34D399' : '#F59E0B'} />
            <Stat label="πᵉ esperada" value={`${stats.piE.toFixed(1)}%`}
                  accent="#94A3B8" />
            <Stat label="bienestar W" value={stats.w.toFixed(2)}
                  accent={stats.w >= -0.01 ? '#34D399' : '#EF4444'} />
            <Stat label="costo sesgo" value={`${Math.abs(stats.w).toFixed(2)}`}
                  accent={mode === 'rule' ? '#34D399' : '#EF4444'} />
          </div>

          {/* Panel de insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">
              ✦ ¿Qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── Panel de controles ── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Juega con la tentación
          </div>

          <Slider
            label="Tentación política (b)"
            value={b}
            min={0.2}
            max={4.0}
            step={0.1}
            onChange={setB}
            fmt={v => v < 1.2 ? 'baja' : v < 2.5 ? 'media' : 'alta'}
            hint="Cuánto gana el gobierno sorprendiendo con inflación extra: empleo a corto plazo, popularidad, gasto. Más tentación → equilibrio de Nash más alto."
          />

          <div className="space-y-2 border-t border-[#1E293B] pt-4">
            <div className="text-[11px] text-[#94A3B8] font-mono mb-2">Equilibrios teóricos:</div>
            <div className="flex justify-between text-[12px] font-mono">
              <span className="text-[#64748B]">Nash (sin regla):</span>
              <span className="text-[#EF4444] font-bold">{nashPi(b).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between text-[12px] font-mono">
              <span className="text-[#64748B]">Con regla creíble:</span>
              <span className="text-[#34D399] font-bold">0.00%</span>
            </div>
            <div className="flex justify-between text-[12px] font-mono">
              <span className="text-[#64748B]">W(Nash) − W(regla):</span>
              <span className="text-[#EF4444] font-bold">{(wNash - wRule).toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-1 border-t border-[#1E293B] pt-4">
            <div className="text-[10px] text-[#4FC3F7] font-mono">Función del banco central:</div>
            <div className="text-[10px] font-mono text-[#475569] leading-relaxed">
              W(π,πᵉ) = −a·π² + b·(π−πᵉ)<br />
              <span className="text-[#334155]">a = {A_COST.toFixed(1)} (costo inflación fijo)</span><br />
              <span className="text-[#334155]">b = {b.toFixed(1)} (tentación; tú lo controlas)</span><br />
              π* discrecional = b/2a = {nashPi(b).toFixed(2)}%
            </div>
          </div>

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            Kydland & Prescott (1977)<br />
            "Rules Rather than Discretion"<br />
            Journal of Political Economy
          </div>
        </div>
      </div>

      {/* Panel explicativo "para el taquero" */}
      <div className="mt-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#F59E0B] font-mono mb-3">
          🌮 Para el taquero: la trampa del "después lo arreglo"
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[12px] text-[#94A3B8] leading-relaxed">
          <div>
            <div className="text-[#F59E0B] font-semibold mb-1">La tentación</div>
            El gobierno sabe que si imprime un poco más de dinero, el desempleo baja HOY. La gente tiene más lana, se siente bien, vota contento. El costo (inflación) llega después.
          </div>
          <div>
            <div className="text-[#EF4444] font-semibold mb-1">La trampa</div>
            Pero los trabajadores no son tontos. Saben que el gobierno va a ceder. Por eso ya piden sueldos más altos desde antes. El intento de sorprender falla: la inflación llega pero el empleo extra, no.
          </div>
          <div>
            <div className="text-[#34D399] font-semibold mb-1">La solución</div>
            Atar las manos: un banco central autónomo que no puede obedecer al presidente aunque éste lo pida. Sin escape posible, la gente cree que la inflación será baja → y lo es. Sin credibilidad, la trampa se cierra sola.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Componentes auxiliares ── */

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[18px] font-bold font-mono" style={{ color: accent }}>{value}</div>
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
