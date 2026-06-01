/**
 * KleinLab — laboratorio del premio 1980 (Lawrence Klein).
 *
 * El click: Klein construyó la primera "maqueta matemática" de una economía
 * entera. Antes, los gobiernos jalaban palancas a ciegas. Con él, por primera
 * vez puedes simular: "si subo la tasa de interés 2 puntos, ¿qué le pasa al
 * PIB, al empleo y a la inflación en los PRÓXIMOS 12 meses?".
 *
 * Matemática REAL (modelo IS-LM / Klein-Goldberger simplificado):
 *
 *   Producto de equilibrio (IS ampliada):
 *     Y* = [C₀ + I₀ + G − b·T − γ·r] / (1 − b·(1 − τ))
 *
 *   donde b = propensión marginal a consumir (≈ 0.72),
 *         τ = tasa impositiva implícita (≈ 0.25),
 *         γ = sensibilidad de la inversión a la tasa de interés,
 *         C₀, I₀ = consumo e inversión autónomos.
 *
 *   Dinámica real (ajuste con retardos, como en Klein-Goldberger):
 *     dY/dt = λ · (Y* − Y),   λ ≈ 0.4  (velocidad de ajuste)
 *
 *   Inflación (curva de Phillips aumentada):
 *     π = π_esperada + α · (Y − Y_potencial) / Y_potencial
 *     dπ_esperada/dt = μ · (π − π_esperada)     (expectativas adaptativas)
 *
 *   Desempleo (ley de Okun):
 *     U = U_natural − β · (Y − Y_potencial) / Y_potencial
 *
 * El usuario mueve: tasa de interés (r), gasto público (G), impuestos (T).
 * La simulación avanza en el tiempo y dibuja las series históricas.
 */

import { useEffect, useRef, useState } from 'react';

// ── Dimensiones del canvas ─────────────────────────────────────────────────
const W = 820;
const H = 380;

// ── Parámetros estructurales (calibrados en orden de magnitud macro de MX) ──
const b   = 0.72;   // propensión marginal a consumir
const tau = 0.25;   // tasa impositiva promedio
const gam = 2.8;    // sensibilidad inversión a tasa (bn MXN por %)
const lam = 0.35;   // velocidad de ajuste del producto
const alp = 0.55;   // coeficiente de Phillips (output gap → inflación)
const mu  = 0.20;   // velocidad de ajuste de expectativas
const bet = 0.45;   // coeficiente de Okun (output gap → desempleo)

// Autónomos base (normalizados a índice 100)
const C0 = 30;   // consumo autónomo
const I0 = 22;   // inversión autónoma
const Y_POT = 100; // producto potencial (normalizado)
const U_NAT = 4.5; // desempleo natural (%)

// Valores de política por defecto
const DEF_R = 8.0;  // tasa de interés %
const DEF_G = 20;   // gasto público (bn)
const DEF_T = 18;   // impuestos (bn)

const HISTORY_LEN = 96; // 96 trimestres de historia (≈ 24 años)
const DT = 0.25;         // paso de simulación = 1 trimestre

// ── Tipos ─────────────────────────────────────────────────────────────────
interface PolicyParams {
  r: number;  // tasa de interés %
  G: number;  // gasto público
  T: number;  // impuestos
}

interface SimState {
  Y: number;        // producto
  piExp: number;    // inflación esperada
}

interface DataPoint {
  Y: number;
  pi: number;   // inflación realizada
  U: number;    // desempleo
  t: number;    // trimestre (0 = inicio)
}

// ── Ecuaciones del modelo ─────────────────────────────────────────────────

/** Producto de equilibrio estático (IS ampliada). */
function yEquilibrium(p: PolicyParams): number {
  // Y* = (C0 + I0 + G - b*T - gamma*r) / (1 - b*(1-tau))
  const numerator = C0 + I0 + p.G - b * p.T - gam * p.r;
  const denominator = 1 - b * (1 - tau);
  return numerator / denominator;
}

/** Inflación realizada en función del output gap. */
function inflation(Y: number, piExp: number): number {
  const gap = (Y - Y_POT) / Y_POT;
  return piExp + alp * gap;
}

/** Desempleo por ley de Okun. */
function unemployment(Y: number): number {
  const gap = (Y - Y_POT) / Y_POT;
  return Math.max(0, U_NAT - bet * gap * 100);
}

/** Avanza el estado de la simulación un paso DT. */
function stepSim(state: SimState, p: PolicyParams): SimState {
  const ystar = yEquilibrium(p);
  const dY = lam * (ystar - state.Y) * DT;
  const pi = inflation(state.Y, state.piExp);
  const dPiExp = mu * (pi - state.piExp) * DT;
  return {
    Y: state.Y + dY,
    piExp: state.piExp + dPiExp,
  };
}

// ── Componente principal ───────────────────────────────────────────────────

export default function KleinLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [r, setR] = useState(DEF_R);
  const [G, setG] = useState(DEF_G);
  const [T, setT] = useState(DEF_T);

  // Selección de variable a ver en el gráfico principal
  const [view, setView] = useState<'Y' | 'pi' | 'U'>('Y');

  // Historia de la simulación (se recalcula cuando cambian los parámetros)
  const [history, setHistory] = useState<DataPoint[]>(() => buildHistory(
    { r: DEF_R, G: DEF_G, T: DEF_T }
  ));

  // Stats del último punto
  const last = history[history.length - 1];

  // Refs para el canvas
  const historyRef = useRef<DataPoint[]>(history);
  const viewRef = useRef<'Y' | 'pi' | 'U'>(view);
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { viewRef.current = view; }, [view]);

  // Recalcular simulación cada vez que cambian los parámetros de política
  useEffect(() => {
    const newHistory = buildHistory({ r, G, T });
    setHistory(newHistory);
  }, [r, G, T]);

  // ── Loop de animación del canvas ────────────────────────────────────────
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

    function draw() {
      if (!ctx) return;
      const hist = historyRef.current;
      const vw = viewRef.current;

      // Fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const PAD_L = 52, PAD_R = 20, PAD_T = 36, PAD_B = 48;
      const plotW = W - PAD_L - PAD_R;
      const plotH = H - PAD_T - PAD_B;

      // Extraer la serie activa
      type SerieKey = 'Y' | 'pi' | 'U';
      const series: Record<SerieKey, number[]> = {
        Y:  hist.map(d => d.Y),
        pi: hist.map(d => d.pi),
        U:  hist.map(d => d.U),
      };
      const labels: Record<SerieKey, string> = {
        Y:  'PIB (índice)',
        pi: 'Inflación (%)',
        U:  'Desempleo (%)',
      };
      const accentColors: Record<SerieKey, string> = {
        Y:  '#34D399',
        pi: '#FB923C',
        U:  '#F472B6',
      };
      const refLines: Record<SerieKey, number> = {
        Y:  Y_POT,
        pi: 3,        // meta de inflación Banxico = 3%
        U:  U_NAT,
      };
      const refLabels: Record<SerieKey, string> = {
        Y:  'PIB potencial',
        pi: 'meta Banxico 3%',
        U:  `desempleo natural ${U_NAT}%`,
      };

      const active = series[vw];
      const accent = accentColors[vw];
      const refVal = refLines[vw];

      // Rango de valores (dinámico + padding)
      let vMin = Math.min(...active, refVal) * 0.95;
      let vMax = Math.max(...active, refVal) * 1.05;
      // evitar degeneración
      if (vMax - vMin < 0.5) { vMin -= 0.25; vMax += 0.25; }

      // Función de mapeo
      const tx = (i: number) => PAD_L + (i / (hist.length - 1)) * plotW;
      const ty = (v: number) => PAD_T + plotH - ((v - vMin) / (vMax - vMin)) * plotH;

      // ── Grid ──────────────────────────────────────────────────────────
      const nGridY = 5;
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 0.8;
      for (let k = 0; k <= nGridY; k++) {
        const v = vMin + (vMax - vMin) * (k / nGridY);
        const y = ty(v);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y);
        ctx.stroke();
        ctx.fillStyle = '#475569';
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(v.toFixed(1), PAD_L - 4, y + 3);
      }
      ctx.setLineDash([]);

      // Ejes de tiempo (eje X: trimestres → "Q")
      const nGridX = 8;
      for (let k = 0; k <= nGridX; k++) {
        const idx = Math.round(k * (hist.length - 1) / nGridX);
        const xp = tx(idx);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(xp, PAD_T); ctx.lineTo(xp, PAD_T + plotH); ctx.stroke();
        ctx.fillStyle = '#334155';
        ctx.font = '8px ui-monospace, monospace';
        ctx.textAlign = 'center';
        const label = `Q${(idx % 4) + 1}'${String(Math.floor(idx / 4) + 1).padStart(2, '0')}`;
        ctx.fillText(label, xp, PAD_T + plotH + 14);
      }

      // ── Línea de referencia ───────────────────────────────────────────
      const ryp = ty(refVal);
      ctx.strokeStyle = 'rgba(100,116,139,0.5)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(PAD_L, ryp); ctx.lineTo(W - PAD_R, ryp); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#64748B';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(refLabels[vw], PAD_L + 4, ryp - 4);

      // ── Área bajo la curva (relleno semitransparente) ─────────────────
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(tx(0), PAD_T + plotH);
      for (let i = 0; i < active.length; i++) {
        ctx.lineTo(tx(i), ty(active[i]));
      }
      ctx.lineTo(tx(active.length - 1), PAD_T + plotH);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // ── Curva principal ───────────────────────────────────────────────
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < active.length; i++) {
        const xi = tx(i), yi = ty(active[i]);
        if (i === 0) ctx.moveTo(xi, yi); else ctx.lineTo(xi, yi);
      }
      ctx.stroke();
      ctx.restore();

      // ── Punto final (ahora) ────────────────────────────────────────────
      const lastX = tx(active.length - 1);
      const lastY = ty(active[active.length - 1]);
      ctx.save();
      ctx.shadowColor = accent; ctx.shadowBlur = 18;
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(lastX, lastY, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = accent;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(active[active.length - 1].toFixed(2), lastX, lastY - 12);

      // ── Mini sparklines de las otras dos variables ─────────────────────
      const otherKeys: SerieKey[] = (['Y', 'pi', 'U'] as SerieKey[]).filter(k => k !== vw);
      const sparkW = 110, sparkH = 32;
      const sparkY = PAD_T;
      otherKeys.forEach((key, idx) => {
        const spX = W - PAD_R - (otherKeys.length - idx) * (sparkW + 10);
        const ser = series[key];
        const mn = Math.min(...ser), mx = Math.max(...ser);
        const rng = mx - mn || 1;
        const c = accentColors[key];

        // Fondo semi
        ctx.fillStyle = 'rgba(11,15,23,0.8)';
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        roundRect(ctx, spX, sparkY, sparkW, sparkH + 18, 4);
        ctx.fill(); ctx.stroke();

        // Label
        ctx.fillStyle = c;
        ctx.font = 'bold 8px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(labels[key], spX + 4, sparkY + 9);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.fillText(ser[ser.length - 1].toFixed(2), spX + 4, sparkY + 20);

        // Sparkline
        ctx.save();
        ctx.strokeStyle = c; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < ser.length; i++) {
          const xi = spX + (i / (ser.length - 1)) * sparkW;
          const yi = sparkY + sparkH + 14 - ((ser[i] - mn) / rng) * 24;
          if (i === 0) ctx.moveTo(xi, yi); else ctx.lineTo(xi, yi);
        }
        ctx.stroke();
        ctx.restore();
      });

      // ── Título del gráfico ─────────────────────────────────────────────
      ctx.fillStyle = accent;
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(labels[vw], PAD_L, PAD_T - 6);
      ctx.fillStyle = '#475569';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText('modelo macroeconométrico · Klein 1980', W - PAD_R, PAD_T - 6);

      // ── Eje Y label ────────────────────────────────────────────────────
      ctx.save();
      ctx.translate(12, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#334155';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(labels[vw], 0, 0);
      ctx.restore();

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Insight dinámico ──────────────────────────────────────────────────
  const ystar = yEquilibrium({ r, G, T });
  const outputGap = ((ystar - Y_POT) / Y_POT) * 100;

  let insight: string;
  if (Math.abs(outputGap) < 0.5) {
    insight = 'La economía está en equilibrio: el PIB de largo plazo coincide con su potencial. Inflación cerca de la meta, desempleo natural. Así es cuando las palancas están bien calibradas.';
  } else if (outputGap > 3) {
    insight = `La economía está SOBRECALENTADA (brecha del ${outputGap.toFixed(1)}%). El PIB supera su potencial → la inflación sube y el desempleo cae por debajo de lo natural. Tarde o temprano el banco central sube la tasa para enfriar.`;
  } else if (outputGap > 0) {
    insight = `Brecha positiva leve (${outputGap.toFixed(1)}%). El PIB está ligeramente por encima del potencial: inflación tiende a subir gradualmente. Zona de "crecimiento con riesgo".`;
  } else if (outputGap < -3) {
    insight = `RECESIÓN: brecha del ${outputGap.toFixed(1)}%. El PIB está muy por debajo del potencial → inflación cae (o deflación), desempleo alto. Un gobierno puede usar G o bajar impuestos para estimular.`;
  } else {
    insight = `Brecha negativa leve (${outputGap.toFixed(1)}%). La economía opera por debajo de su potencial: hay capacidad ociosa y desempleo por encima del natural. El modelo señala espacio para estimular sin generar inflación.`;
  }

  // ── Colores de semáforo para stats ───────────────────────────────────
  const gapColor = Math.abs(outputGap) < 1 ? '#34D399' : Math.abs(outputGap) < 3 ? '#FDB813' : '#EF4444';
  const inflColor = last.pi < 2 ? '#4FC3F7' : last.pi < 4.5 ? '#34D399' : last.pi < 7 ? '#FDB813' : '#EF4444';
  const unempColor = last.U < U_NAT + 0.5 ? '#34D399' : last.U < U_NAT + 2 ? '#FDB813' : '#EF4444';

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* Panel izquierdo: canvas + controles de vista */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Selector de variable */}
          <div className="flex flex-wrap items-center gap-2">
            {([ ['Y', 'PIB', '#34D399'], ['pi', 'Inflación', '#FB923C'], ['U', 'Desempleo', '#F472B6'] ] as [typeof view, string, string][]).map(
              ([key, label, color]) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className="px-3 py-1.5 text-[12px] font-mono rounded border transition"
                  style={{
                    borderColor: view === key ? color + '80' : '#1E293B',
                    background: view === key ? color + '18' : 'transparent',
                    color: view === key ? color : '#64748B',
                  }}
                >
                  {label}
                </button>
              )
            )}
          </div>

          {/* Stats en tiempo real */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="PIB (LR)" value={last.Y.toFixed(1)} sub={`pot. ${Y_POT}`} accent="#34D399" />
            <Stat label="Inflación" value={`${last.pi.toFixed(2)}%`} sub="meta: 3%" accent={inflColor} />
            <Stat label="Desempleo" value={`${last.U.toFixed(2)}%`} sub={`natural: ${U_NAT}%`} accent={unempColor} />
          </div>

          {/* Brecha del producto */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3 flex items-center gap-3">
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-[#64748B] font-mono mb-0.5">Brecha del producto (output gap)</div>
              <div className="text-[22px] font-bold font-mono" style={{ color: gapColor }}>
                {outputGap > 0 ? '+' : ''}{outputGap.toFixed(2)}%
              </div>
            </div>
            <div className="text-[10px] text-[#475569] leading-snug flex-1">
              (Y* − Y_pot) / Y_pot · si &gt; 0: sobrecalentamiento → inflación
              · si &lt; 0: recesión → desempleo
            </div>
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono mb-2">✦ ¿Qué estás viendo?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* Panel derecho: controles de política + fórmulas */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ Palancas de política</div>

          <Slider
            label="Tasa de interés (r)"
            value={r}
            min={1} max={20} step={0.25}
            onChange={setR}
            fmt={v => `${v.toFixed(2)}%`}
            hint="Sube → encarece el crédito → cae la inversión → cae el PIB → baja la inflación."
            accentColor="#4FC3F7"
          />
          <Slider
            label="Gasto público (G)"
            value={G}
            min={5} max={40} step={0.5}
            onChange={setG}
            fmt={v => v.toFixed(1)}
            hint="Sube → más demanda agregada → multiplicador keynesiano → sube el PIB."
            accentColor="#A78BFA"
          />
          <Slider
            label="Impuestos (T)"
            value={T}
            min={5} max={35} step={0.5}
            onChange={setT}
            fmt={v => v.toFixed(1)}
            hint="Sube → menos ingreso disponible → cae el consumo → cae el PIB."
            accentColor="#FB923C"
          />

          {/* Parámetros del modelo */}
          <div className="border-t border-[#1E293B] pt-3 space-y-1.5">
            <div className="text-[9px] uppercase tracking-[0.15em] text-[#64748B] font-mono mb-2">Parámetros estructurales</div>
            {[
              ['b = 0.72', 'propensión marginal a consumir'],
              ['τ = 0.25', 'tasa impositiva implícita'],
              ['γ = 2.8',  'sensibilidad inversión a r'],
              ['α = 0.55', 'Phillips: brecha → inflación'],
              ['β = 0.45', 'Okun: brecha → desempleo'],
              ['λ = 0.35', 'velocidad de ajuste del PIB'],
            ].map(([val, desc]) => (
              <div key={val} className="flex items-baseline gap-1.5">
                <span className="text-[10px] font-mono text-[#34D399] w-14 shrink-0">{val}</span>
                <span className="text-[9px] text-[#475569]">{desc}</span>
              </div>
            ))}
          </div>

          {/* Ecuación clave */}
          <div className="border-t border-[#1E293B] pt-3">
            <div className="text-[9px] uppercase tracking-[0.15em] text-[#64748B] font-mono mb-1.5">Equilibrio IS:</div>
            <div className="text-[10px] font-mono text-[#94A3B8] leading-relaxed">
              Y* = (C₀ + I₀ + G − b·T − γ·r)<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/ (1 − b·(1 − τ))<br />
              <br />
              dY/dt = λ · (Y* − Y)<br />
              π = π̂ + α · (Y − Ypot)/Ypot<br />
              U = Un − β · (Y − Ypot)/Ypot
            </div>
          </div>

          <div className="text-[10px] font-mono text-[#334155] border-t border-[#1E293B] pt-3 leading-relaxed">
            Klein &amp; Goldberger (1955) · IS-LM dinámico<br />
            curva de Phillips + ley de Okun · Nobel 1980
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Función auxiliar: genera el historial completo de la simulación ────────

function buildHistory(policy: PolicyParams): DataPoint[] {
  // Arrancamos cerca del estado estacionario inicial (política default)
  const initY = yEquilibrium({ r: DEF_R, G: DEF_G, T: DEF_T });
  const initPiExp = 3.5; // inflación esperada inicial ≈ meta Banxico

  let state: SimState = { Y: initY, piExp: initPiExp };
  const hist: DataPoint[] = [];

  for (let t = 0; t < HISTORY_LEN; t++) {
    // Política: primeros 60 trimestres en estado default, luego la del usuario
    const p: PolicyParams = t < 60 ? { r: DEF_R, G: DEF_G, T: DEF_T } : policy;
    state = stepSim(state, p);
    const pi = inflation(state.Y, state.piExp);
    const U  = unemployment(state.Y);
    hist.push({ Y: state.Y, pi, U, t });
  }

  return hist;
}

// ── Componente Stat ────────────────────────────────────────────────────────

function Stat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[9px] uppercase tracking-[0.15em] text-[#64748B] font-mono mb-0.5">{label}</div>
      <div className="text-[18px] font-bold font-mono" style={{ color: accent }}>{value}</div>
      <div className="text-[9px] text-[#334155] font-mono">{sub}</div>
    </div>
  );
}

// ── Componente Slider ──────────────────────────────────────────────────────

function Slider({
  label, value, min, max, step, onChange, fmt, hint, accentColor,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string; hint?: string; accentColor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[12px] font-mono" style={{ color: accentColor ?? '#FDB813' }}>
          {fmt ? fmt(value) : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: accentColor ?? '#4FC3F7' }}
      />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}

// ── Utilitario: rectángulo con esquinas redondeadas ────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
