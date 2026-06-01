/**
 * LucasLab — laboratorio del premio 1995 (Robert Lucas Jr.).
 *
 * El click: el gobierno inyecta dinero para crear empleos. Si la gente
 * lo anticipa, el truco no funciona. Solo sube la inflación, sin ganancia
 * real de producción.
 *
 * Modelo REAL: Curva de oferta de Lucas (Lucas Supply Curve, 1972)
 *
 *   y = y_n + b · (π − π^e)
 *
 *   donde:
 *     y      = producción/empleo actual (desviación de la media, %)
 *     y_n    = producción natural = 0 (baseline)
 *     b      = sensibilidad de la oferta a la sorpresa monetaria (≈ 0.5-2)
 *     π      = inflación real (%)
 *     π^e    = inflación esperada por la gente (%)
 *
 *   Demanda agregada (cantidad de dinero):  y = m − π
 *     donde m = tasa de crecimiento del dinero (instrumento del gobierno)
 *
 *   En cada periodo el gobierno anuncia o inyecta un shock m.
 *   Si el shock es ANUNCIADO (esperado), la gente pone π^e = m → y = y_n
 *   Si el shock es SORPRESA, π^e = π^e_anterior y la gente produce más.
 *   Con el tiempo, la expectativa se actualiza: π^e ← π^e + λ(π − π^e)
 *   (aprendizaje adaptativo, λ = velocidad de ajuste de expectativas)
 *
 * Para el taquero: si cada enero subes el precio y tus clientes ya lo saben,
 * el "truco" no te da lo que calculaste porque ellos se adelantaron.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/* ─── Dimensiones ────────────────────────────────────────────── */
const W = 820;
const H = 380;

/* ─── Parámetros del modelo ──────────────────────────────────── */
const B_SUPPLY = 1.2;          // sensibilidad output a sorpresa (b en la curva Lucas)
const Y_NAT    = 0;            // producción natural (normalizada a 0)
const Y_MIN    = -4;
const Y_MAX    = 6;
const PI_MIN   = -1;
const PI_MAX   = 12;
const ADAPT_SPEED_SLOW = 0.25; // λ cuando la gente aprende lento
const ADAPT_SPEED_FAST = 0.85; // λ cuando la gente aprende rápido (expectativas racionales puras)
const MAX_HISTORY = 20;

interface EconPoint {
  pi: number;    // inflación realizada
  y:  number;    // output gap
  piE: number;   // expectativa de inflación en ese momento
  surprise: boolean;
}

/* ─── Coordinate helpers ────────────────────────────────────────── */
// Margenes internos del canvas
const PAD_L = 62, PAD_R = 30, PAD_T = 42, PAD_B = 50;
const CW = W - PAD_L - PAD_R;
const CH = H - PAD_T - PAD_B;

function cx(y: number): number {
  // x = output gap eje horizontal
  return PAD_L + ((y - Y_MIN) / (Y_MAX - Y_MIN)) * CW;
}
function cy(pi: number): number {
  // y = inflación eje vertical (mayor arriba)
  return PAD_T + (1 - (pi - PI_MIN) / (PI_MAX - PI_MIN)) * CH;
}

/* ─── Lucas Supply Curve: dado π^e, traza puntos (y, π) ─────── */
// y = y_n + b*(π - π^e)  →  π = π^e + (y - y_n)/b
function supplyPiOfY(y: number, piE: number): number {
  return piE + (y - Y_NAT) / B_SUPPLY;
}
function supplyYofPi(pi: number, piE: number): number {
  return Y_NAT + B_SUPPLY * (pi - piE);
}

/* ─── Aggregate Demand: y = m - π ───────────────────────────── */
function demandPiOfY(y: number, m: number): number {
  return m - y;
}
function demandYofPi(pi: number, m: number): number {
  return m - pi;
}

/* ─── Equilibrio: intersection of supply and demand ─────────── */
//  π - π^e = (y - y_n)/b   AND   y = m - π
//  Substituting: π - π^e = (m - π - y_n)/b
//  b(π - π^e) = m - π - y_n
//  bπ - bπ^e = m - π - y_n
//  π(b+1) = m - y_n + bπ^e
//  π* = (m - y_n + b·π^e) / (b+1)
//  y* = m - π*
function equilibrium(m: number, piE: number): { pi: number; y: number } {
  const pi = (m - Y_NAT + B_SUPPLY * piE) / (B_SUPPLY + 1);
  const y  = m - pi;
  return { pi, y };
}

/* ─── Component ──────────────────────────────────────────────── */
export default function LucasLab() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);

  // Parámetros controlados por el usuario
  const [moneyShock, setMoneyShock] = useState(3);       // m: cuánto dinero inyecta el gobierno
  const [isSurprise, setIsSurprise] = useState(true);    // ¿el shock es sorpresa o anunciado?
  const [learnSpeed, setLearnSpeed] = useState<'lento' | 'rapido'>('lento');

  // Estado interno de la simulación
  const piExpRef  = useRef(1.5);   // expectativa actual de inflación
  const historyRef = useRef<EconPoint[]>([]);

  // Stats para mostrar en UI
  const [stats, setStats] = useState({ pi: 1.5, y: 0, piE: 1.5, round: 0 });

  /* ── Función dibujo ──────────────────────────────────── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const piE    = piExpRef.current;
    const m      = moneyShock;
    const hist   = historyRef.current;
    const eq     = equilibrium(m, piE);
    const piEq   = Math.max(PI_MIN, Math.min(PI_MAX, eq.pi));
    const yEq    = Math.max(Y_MIN,  Math.min(Y_MAX,  eq.y));

    /* Fondo */
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0B0F17');
    bg.addColorStop(1, '#070A11');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* Grid suave */
    ctx.strokeStyle = '#1A2235';
    ctx.lineWidth = 1;
    // Líneas verticales (output gap)
    for (let y0 = Math.ceil(Y_MIN); y0 <= Y_MAX; y0++) {
      const x0 = cx(y0);
      ctx.beginPath(); ctx.moveTo(x0, PAD_T); ctx.lineTo(x0, H - PAD_B); ctx.stroke();
    }
    // Líneas horizontales (inflación)
    for (let p = Math.ceil(PI_MIN); p <= PI_MAX; p += 2) {
      const y0 = cy(p);
      ctx.beginPath(); ctx.moveTo(PAD_L, y0); ctx.lineTo(W - PAD_R, y0); ctx.stroke();
    }

    /* Ejes */
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    // Eje Y (producción natural, y=0)
    ctx.beginPath(); ctx.moveTo(cx(0), PAD_T - 10); ctx.lineTo(cx(0), H - PAD_B + 6); ctx.stroke();
    // Eje X (inflación = 0)
    ctx.beginPath(); ctx.moveTo(PAD_L - 6, cy(0)); ctx.lineTo(W - PAD_R + 6, cy(0)); ctx.stroke();

    /* Etiquetas de ejes */
    ctx.fillStyle = '#475569';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    for (let y0 = Y_MIN; y0 <= Y_MAX; y0 += 2) {
      ctx.fillText(y0 > 0 ? `+${y0}%` : `${y0}%`, cx(y0), H - PAD_B + 16);
    }
    ctx.textAlign = 'right';
    for (let p = 0; p <= PI_MAX; p += 2) {
      ctx.fillText(`${p}%`, PAD_L - 6, cy(p) + 4);
    }

    // Títulos de ejes
    ctx.fillStyle = '#64748B';
    ctx.font = '11px ui-sans-serif, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('brecha de producción (output gap)', W / 2, H - 6);
    ctx.save();
    ctx.translate(14, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('inflación π (%)', 0, 0);
    ctx.restore();

    /* Línea de producción natural: y = y_n = 0 (vertical, largo plazo) */
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(cx(Y_NAT), PAD_T);
    ctx.lineTo(cx(Y_NAT), H - PAD_B);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('LP', cx(Y_NAT) + 4, PAD_T + 10);

    /* Curva de Oferta de Lucas (short-run AS) — para π^e actual */
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 200; i++) {
      const yVal = Y_MIN + (i / 200) * (Y_MAX - Y_MIN);
      const piVal = supplyPiOfY(yVal, piE);
      if (piVal < PI_MIN || piVal > PI_MAX) continue;
      const px = cx(yVal), py = cy(piVal);
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Etiqueta curva oferta
    ctx.fillStyle = '#34D399';
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    const yLabelY = Y_MAX - 0.5;
    const piLabelY = supplyPiOfY(yLabelY, piE);
    if (piLabelY >= PI_MIN && piLabelY <= PI_MAX) {
      ctx.fillText(`AS(πᵉ=${piE.toFixed(1)}%)`, cx(yLabelY) - 90, cy(piLabelY) - 6);
    }

    /* Curva de Demanda Agregada (AD) — y = m - π */
    ctx.strokeStyle = '#4FC3F7';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    started = false;
    for (let i = 0; i <= 200; i++) {
      const yVal = Y_MIN + (i / 200) * (Y_MAX - Y_MIN);
      const piVal = demandPiOfY(yVal, m);
      if (piVal < PI_MIN || piVal > PI_MAX) continue;
      const px = cx(yVal), py = cy(piVal);
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Etiqueta curva demanda
    ctx.fillStyle = '#4FC3F7';
    ctx.font = 'bold 10px ui-monospace, monospace';
    const yLabelAD = Y_MIN + 0.5;
    const piLabelAD = demandPiOfY(yLabelAD, m);
    if (piLabelAD >= PI_MIN && piLabelAD <= PI_MAX) {
      ctx.fillText(`AD(m=${m.toFixed(1)}%)`, cx(yLabelAD) + 4, cy(piLabelAD) - 6);
    }

    /* Historia de puntos anteriores */
    for (let i = 0; i < hist.length; i++) {
      const pt = hist[i];
      const alpha = 0.2 + 0.6 * (i / Math.max(1, hist.length - 1));
      const px = cx(Math.max(Y_MIN, Math.min(Y_MAX, pt.y)));
      const py = cy(Math.max(PI_MIN, Math.min(PI_MAX, pt.pi)));
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = pt.surprise
        ? `rgba(251,146,60,${alpha})`    // naranja = sorpresa (hubo output)
        : `rgba(248,113,113,${alpha})`;  // rojo = anticipado (solo inflación)
      ctx.fill();
      // Conectar puntos con línea tenue
      if (i > 0) {
        const pp = hist[i - 1];
        const px0 = cx(Math.max(Y_MIN, Math.min(Y_MAX, pp.y)));
        const py0 = cy(Math.max(PI_MIN, Math.min(PI_MAX, pp.pi)));
        ctx.strokeStyle = `rgba(100,116,139,${alpha * 0.5})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px0, py0);
        ctx.lineTo(px, py);
        ctx.stroke();
      }
    }

    /* Punto de equilibrio actual (brillante) */
    const eqX = cx(Math.max(Y_MIN, Math.min(Y_MAX, yEq)));
    const eqY = cy(Math.max(PI_MIN, Math.min(PI_MAX, piEq)));

    ctx.save();
    ctx.shadowColor = isSurprise ? '#FDB813' : '#EF4444';
    ctx.shadowBlur = 20;
    const grad = ctx.createRadialGradient(eqX - 2, eqY - 2, 1, eqX, eqY, 10);
    if (isSurprise) {
      grad.addColorStop(0, '#FEF3C7');
      grad.addColorStop(1, '#F59E0B');
    } else {
      grad.addColorStop(0, '#FECDD3');
      grad.addColorStop(1, '#EF4444');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(eqX, eqY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Coordenadas del punto actual
    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    const labelX = eqX + 14;
    const labelY = eqY - 6;
    ctx.fillText(`π=${piEq.toFixed(1)}%`, labelX, labelY);
    ctx.fillText(`y=${yEq > 0 ? '+' : ''}${yEq.toFixed(1)}%`, labelX, labelY + 14);

    /* Diagnóstico abajo */
    const surpriseGap = yEq - Y_NAT;
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px ui-sans-serif, system-ui';
    if (Math.abs(surpriseGap) < 0.1) {
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('La economía está en su nivel natural — el truco no funcionó.', W / 2, H - PAD_B + 32);
    } else if (surpriseGap > 0) {
      ctx.fillStyle = '#FB923C';
      ctx.fillText(`↑ Sorpresa monetaria: +${surpriseGap.toFixed(1)}% output — pero temporal`, W / 2, H - PAD_B + 32);
    } else {
      ctx.fillStyle = '#F472B6';
      ctx.fillText(`↓ Output bajo — inflación sin crecimiento: estanflación`, W / 2, H - PAD_B + 32);
    }

    /* Leyenda */
    const lx = W - PAD_R - 160;
    const ly = PAD_T + 10;
    ctx.fillStyle = 'rgba(11,15,23,0.85)';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(lx - 8, ly - 4, 168, 58, 6);
    ctx.fill(); ctx.stroke();

    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#34D399';
    ctx.fillText('─── AS corto plazo (Lucas)', lx, ly + 12);
    ctx.fillStyle = '#4FC3F7';
    ctx.fillText('─── AD demanda agregada', lx, ly + 26);
    ctx.fillStyle = '#EF4444';
    ctx.fillText('─ ─ producción natural (LP)', lx, ly + 40);
    ctx.fillStyle = '#FB923C';
    ctx.fillText('● sorpresa  ', lx + 100, ly + 52);
    ctx.fillStyle = '#F87171';
    ctx.fillText('● anticipado', lx, ly + 52);

  }, [moneyShock, isSurprise]);

  /* ── Montaje: canvas DPR ─────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  /* ── Redibujar cuando cambian parámetros ─────────────── */
  useEffect(() => {
    draw();
  }, [draw]);

  /* ── Actualizar stats ────────────────────────────────── */
  useEffect(() => {
    const piE = piExpRef.current;
    const eq  = equilibrium(moneyShock, piE);
    setStats(s => ({ ...s, pi: eq.pi, y: eq.y, piE }));
  }, [moneyShock]);

  /* ── Aplicar política ────────────────────────────────── */
  const applyPolicy = useCallback(() => {
    const piE = piExpRef.current;
    const m   = moneyShock;

    // Si es anunciado/esperado, la gente ya subió sus expectativas al nivel del shock
    // Ajuste: si isSurprise=false, la expectativa ya incorpora m → π^e = m / (1 + 1/b)
    // es decir: el banco central anuncia m → los agentes resuelven y^e = y_n → π^e = m - y_n = m
    const piEEffective = isSurprise
      ? piE                                   // sorpresa: expectativas se quedan donde estaban
      : (m - Y_NAT + B_SUPPLY * piE) / (B_SUPPLY + 1); // anticipado: π^e sube al nivel de eq completo

    const eq = equilibrium(m, piEEffective);
    const piRealized = Math.max(PI_MIN, Math.min(PI_MAX, eq.pi));
    const yRealized  = Math.max(Y_MIN,  Math.min(Y_MAX,  eq.y));

    // Registrar en historia
    const pt: EconPoint = {
      pi: piRealized,
      y:  yRealized,
      piE: piEEffective,
      surprise: isSurprise && Math.abs(yRealized - Y_NAT) > 0.1,
    };
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), pt];

    // Ajuste de expectativas para el siguiente periodo (aprendizaje adaptativo)
    const lambda = learnSpeed === 'rapido' ? ADAPT_SPEED_FAST : ADAPT_SPEED_SLOW;
    const newPiE = piEEffective + lambda * (piRealized - piEEffective);
    piExpRef.current = Math.max(0, Math.min(PI_MAX, newPiE));

    setStats({
      pi:    piRealized,
      y:     yRealized,
      piE:   piExpRef.current,
      round: historyRef.current.length,
    });
    draw();
  }, [moneyShock, isSurprise, learnSpeed, draw]);

  /* ── Reset ───────────────────────────────────────────── */
  const reset = useCallback(() => {
    piExpRef.current = 1.5;
    historyRef.current = [];
    setStats({ pi: equilibrium(moneyShock, 1.5).pi, y: equilibrium(moneyShock, 1.5).y, piE: 1.5, round: 0 });
    draw();
  }, [moneyShock, draw]);

  /* ── Insight dinámico ────────────────────────────────── */
  const yGap = stats.y - Y_NAT;
  let insight = '';
  if (stats.round === 0) {
    insight = 'Ajusta el shock monetario (m), elige si es sorpresa o anunciado, y presiona "Aplicar política". Mira cómo la economía reacciona — y cómo aprende.';
  } else if (!isSurprise && Math.abs(yGap) < 0.15) {
    insight = '¡Exacto! Como el shock estaba anunciado, la gente ya subió sus precios de antemano. El output quedó en su nivel natural. Solo ganaste inflación — nada más.';
  } else if (isSurprise && yGap > 0.3) {
    insight = `La sorpresa funcionó: +${yGap.toFixed(1)}% de output por encima del natural. Pero el siguiente periodo la gente ya lo sabe — la expectativa subió a ${stats.piE.toFixed(1)}%. Aplícalo otra vez: la ganancia será menor.`;
  } else if (stats.round > 3 && Math.abs(yGap) < 0.3) {
    insight = 'La gente aprendió. Ya no te pueden engañar con el mismo truco. La curva AS subió hasta que el equilibrio volvió al nivel natural — con más inflación que antes. Eso es la Crítica de Lucas.';
  } else {
    insight = `Expectativa actual: π^e = ${stats.piE.toFixed(1)}%. Cada ronda que aplicas el mismo shock, la gente ajusta sus expectativas. El output extra se desvanece. Solo la sorpresa genuina mueve el output — y las sorpresas duran poco.`;
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* ── Canvas + botones ── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={applyPolicy}
              className="px-4 py-1.5 text-[12px] font-mono rounded border border-[#34D399]/50 bg-[#34D399]/10 text-[#34D399] hover:bg-[#34D399]/20 transition font-semibold"
            >
              ▶ Aplicar política (ronda {stats.round + 1})
            </button>
            <button
              onClick={reset}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#475569]/50 bg-transparent text-[#64748B] hover:text-[#CBD5E1] hover:border-[#64748B] transition"
            >
              ↺ reiniciar
            </button>
            <button
              onClick={() => setIsSurprise(v => !v)}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                isSurprise
                  ? 'border-[#FB923C]/50 bg-[#FB923C]/10 text-[#FB923C]'
                  : 'border-[#EF4444]/50 bg-[#EF4444]/10 text-[#EF4444]'
              }`}
            >
              {isSurprise ? '⚡ shock: SORPRESA' : '📢 shock: ANUNCIADO'}
            </button>
            <button
              onClick={() => setLearnSpeed(v => v === 'lento' ? 'rapido' : 'lento')}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                learnSpeed === 'rapido'
                  ? 'border-[#A78BFA]/50 bg-[#A78BFA]/10 text-[#A78BFA]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              {learnSpeed === 'rapido' ? '🧠 expectativas: RACIONALES' : '○ expectativas: adaptativas'}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <Stat label="output gap" value={`${stats.y > 0 ? '+' : ''}${stats.y.toFixed(1)}%`}
                  accent={Math.abs(stats.y) > 0.2 ? '#FB923C' : '#64748B'} />
            <Stat label="inflación π" value={`${stats.pi.toFixed(1)}%`} accent="#4FC3F7" />
            <Stat label="πᵉ esperada" value={`${stats.piE.toFixed(1)}%`} accent="#34D399" />
            <Stat label="rondas" value={`${stats.round}`} accent="#A78BFA" />
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#34D399] font-mono mb-2">✦ ¿Qué estás viendo?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── Panel de controles ── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ Controla la política</div>

          <Slider
            label="Shock monetario (m)"
            value={moneyShock}
            min={0}
            max={10}
            step={0.1}
            onChange={v => { setMoneyShock(v); }}
            fmt={v => `${v.toFixed(1)}%`}
            hint="Cuánto dinero extra inyecta el gobierno. Más m = más inflación potencial."
          />

          <div className="space-y-2">
            <div className="text-[11px] font-medium text-[#94A3B8]">Tipo de shock</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setIsSurprise(true)}
                className={`py-2 text-[11px] font-mono rounded border transition ${
                  isSurprise
                    ? 'border-[#FB923C] bg-[#FB923C]/15 text-[#FB923C]'
                    : 'border-[#1E293B] text-[#475569] hover:text-[#94A3B8]'
                }`}
              >
                ⚡ Sorpresa
              </button>
              <button
                onClick={() => setIsSurprise(false)}
                className={`py-2 text-[11px] font-mono rounded border transition ${
                  !isSurprise
                    ? 'border-[#EF4444] bg-[#EF4444]/15 text-[#EF4444]'
                    : 'border-[#1E293B] text-[#475569] hover:text-[#94A3B8]'
                }`}
              >
                📢 Anunciado
              </button>
            </div>
            <div className="text-[10px] text-[#475569] leading-snug">
              {isSurprise
                ? 'La gente no lo esperaba. Puede haber ganancia temporal de output.'
                : 'La gente ya lo anticipó. Subió sus precios antes. No hay ganancia de output.'}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-medium text-[#94A3B8]">Velocidad de aprendizaje</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setLearnSpeed('lento')}
                className={`py-2 text-[11px] font-mono rounded border transition ${
                  learnSpeed === 'lento'
                    ? 'border-[#4FC3F7] bg-[#4FC3F7]/15 text-[#4FC3F7]'
                    : 'border-[#1E293B] text-[#475569] hover:text-[#94A3B8]'
                }`}
              >
                Adaptativas
              </button>
              <button
                onClick={() => setLearnSpeed('rapido')}
                className={`py-2 text-[11px] font-mono rounded border transition ${
                  learnSpeed === 'rapido'
                    ? 'border-[#A78BFA] bg-[#A78BFA]/15 text-[#A78BFA]'
                    : 'border-[#1E293B] text-[#475569] hover:text-[#94A3B8]'
                }`}
              >
                Racionales
              </button>
            </div>
            <div className="text-[10px] text-[#475569] leading-snug">
              {learnSpeed === 'rapido'
                ? 'Expectativas racionales puras: la gente aprende rápido. La primera sorpresa es la última.'
                : 'Aprendizaje lento: la gente tarda varios periodos en darse cuenta del patrón.'}
            </div>
          </div>

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed space-y-1">
            <div className="text-[#4FC3F7] font-semibold mb-1">Modelo (Lucas 1972):</div>
            <div>y = y_n + b·(π − πᵉ)</div>
            <div>AD: y = m − π</div>
            <div>πᵉ ← πᵉ + λ(π − πᵉ)</div>
            <div className="pt-1">b = {B_SUPPLY} · λ = {learnSpeed === 'rapido' ? ADAPT_SPEED_FAST : ADAPT_SPEED_SLOW}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Componentes auxiliares ────────────────────────────────── */
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[17px] font-bold font-mono" style={{ color: accent }}>{value}</div>
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
