/**
 * CardAngristImbensLab — laboratorio del premio 2021 (Card, Angrist, Imbens).
 *
 * El click: para saber si algo CAUSA algo, necesitas un grupo de comparación
 * casi idéntico al que no le pasó lo mismo. La vida ya está corriendo el
 * experimento — solo tienes que saber dónde mirar.
 *
 * Técnica REAL: Diferencias-en-Diferencias (DiD).
 *   Y_it = α + β·Tratado_i + γ·Post_t + δ·(Tratado_i × Post_t) + ε_it
 *   δ = DiD = efecto CAUSAL del tratamiento.
 *
 * El estimador δ (delta) es el "doble descuento":
 *   δ = (Ȳ_Tratado,Post − Ȳ_Tratado,Pre) − (Ȳ_Control,Post − Ȳ_Control,Pre)
 *
 * Supuesto clave: "tendencias paralelas" — en ausencia del tratamiento,
 * ambos grupos habrían seguido la misma trayectoria. Si no se cumple,
 * el estimador se contamina. El lab lo muestra visualmente.
 *
 * Basado en Card & Krueger (1994): NJ subió salario mínimo, PA no lo hizo.
 * ¿Cayó el empleo en NJ? Compara hamburguesas. La respuesta fue NO.
 */

import { useEffect, useRef, useState } from 'react';

const W = 820;
const H = 380;

// Periodos: 0..T_PRE-1 = antes, T_PRE..T_TOTAL-1 = después del tratamiento
const T_PRE = 8;
const T_TOTAL = 16;
const T_TREAT = T_PRE; // momento del tratamiento (borde)

interface SimParams {
  effectoTratamiento: number;   // δ real (efecto DiD): −4..+8
  ruido: number;                // σ del ruido en las series: 0..3
  violaTendencias: boolean;     // si true: el control cambia de tendencia después
  mostrarContrafactual: boolean;
}

const DEFAULTS: SimParams = {
  effectoTratamiento: 3.2,
  ruido: 1.2,
  violaTendencias: false,
  mostrarContrafactual: true,
};

interface ObsPoint { t: number; y: number; }

function generarSeries(p: SimParams, seed: number): {
  control: ObsPoint[];
  tratado: ObsPoint[];
  contrafactual: ObsPoint[];
} {
  // Usamos Math.random con semilla simulada (mezclamos con seed)
  const rng = (i: number, s: number) => {
    const x = Math.sin(seed * 9301 + i * 49297 + s * 233) * 43758.5453;
    return x - Math.floor(x);
  };
  const gRng = (i: number, s: number, sigma: number) => {
    const u = Math.max(1e-10, rng(i, s));
    const v = rng(i + 1000, s);
    return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  // Nivel base del control y tratado (empleo % hamburguesería)
  const baseControl = 20.0;
  const baseTratado = 22.5;   // ligeramente distinto, como en el paper real
  const tendencia = 0.15;     // crecimiento suave ambos grupos (precrisis baja)

  const control: ObsPoint[] = [];
  const tratado: ObsPoint[] = [];
  const contrafactual: ObsPoint[] = [];

  // Drift del control DESPUÉS del tratamiento (0 si tendencias paralelas)
  // violaTendencias: control acelera por un boom regional (sesgo de selección)
  const driftExtra = p.violaTendencias ? 2.8 : 0;

  for (let t = 0; t < T_TOTAL; t++) {
    const pre = t < T_PRE;
    const tendBase = tendencia * t;

    const yControl = baseControl + tendBase
      + (pre ? 0 : driftExtra * (t - T_PRE + 1) / (T_TOTAL - T_PRE))
      + gRng(t, 1, p.ruido);

    // El tratado sigue la MISMA tendencia base, más el efecto δ post-tratamiento
    const yTratado = baseTratado + tendBase
      + (pre ? 0 : p.effectoTratamiento)
      + gRng(t, 2, p.ruido);

    // Contrafactual: qué hubiera pasado al tratado SIN tratamiento
    // (proyección de la tendencia pre-periodo)
    const yContrafactual = baseTratado + tendBase + gRng(t, 3, p.ruido * 0.4);

    control.push({ t, y: yControl });
    tratado.push({ t, y: yTratado });
    contrafactual.push({ t, y: yContrafactual });
  }

  return { control, tratado, contrafactual };
}

// Calcula el estimador DiD a partir de las series generadas
function calcDiD(control: ObsPoint[], tratado: ObsPoint[]): {
  mediaTratPre: number; mediaTratPost: number;
  mediaCtrlPre: number; mediaCtrlPost: number;
  did: number;
} {
  const avg = (arr: ObsPoint[], desde: number, hasta: number) => {
    const sub = arr.filter(p => p.t >= desde && p.t < hasta);
    return sub.reduce((s, p) => s + p.y, 0) / sub.length;
  };
  const mediaTratPre  = avg(tratado,  0,      T_PRE);
  const mediaTratPost = avg(tratado,  T_PRE,  T_TOTAL);
  const mediaCtrlPre  = avg(control,  0,      T_PRE);
  const mediaCtrlPost = avg(control,  T_PRE,  T_TOTAL);
  const did = (mediaTratPost - mediaTratPre) - (mediaCtrlPost - mediaCtrlPre);
  return { mediaTratPre, mediaTratPost, mediaCtrlPre, mediaCtrlPost, did };
}

// Mapea tiempo y valor a píxeles del canvas
const PAD_L = 60;
const PAD_R = 20;
const PAD_T = 42;
const PAD_B = 56;

function tX(t: number): number {
  return PAD_L + (t / (T_TOTAL - 1)) * (W - PAD_L - PAD_R);
}

function yY(y: number, yMin: number, yMax: number): number {
  const range = yMax - yMin || 1;
  return PAD_T + (1 - (y - yMin) / range) * (H - PAD_T - PAD_B);
}

export default function CardAngristImbensLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<SimParams>({ ...DEFAULTS });

  const [efecto, setEfecto]               = useState(DEFAULTS.effectoTratamiento);
  const [ruido, setRuido]                 = useState(DEFAULTS.ruido);
  const [violaTend, setViolaTend]         = useState(DEFAULTS.violaTendencias);
  const [mostrarCF, setMostrarCF]         = useState(DEFAULTS.mostrarContrafactual);
  const [seed, setSeed]                   = useState(42);
  const [stats, setStats]                 = useState({ did: 0, sesgado: false });

  // Sincroniza ref con state (sin reiniciar el loop de rAF)
  useEffect(() => {
    paramsRef.current = {
      effectoTratamiento: efecto,
      ruido,
      violaTendencias: violaTend,
      mostrarContrafactual: mostrarCF,
    };
  }, [efecto, ruido, violaTend, mostrarCF]);

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
    let frame = 0;
    // Ruido animado: pequeño jitter para que las series "vivan"
    let jitterSeed = seed;

    function draw() {
      if (!ctx) return;
      const p = paramsRef.current;

      // Regenerar con jitter muy leve cada N frames para sensación viva
      if (frame % 90 === 0) jitterSeed = seed + frame * 0.001;

      const { control, tratado, contrafactual } = generarSeries(p, jitterSeed);
      const diD = calcDiD(control, tratado);

      // Rango Y para el canvas
      const allY = [...control, ...tratado, ...contrafactual].map(pt => pt.y);
      const yMin = Math.min(...allY) - 1.5;
      const yMax = Math.max(...allY) + 1.5;

      // ── Fondo ────────────────────────────────────────────────────────────
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── Zona pre/post ────────────────────────────────────────────────────
      const xTreat = tX(T_TREAT - 0.5);
      ctx.fillStyle = 'rgba(99,179,237,0.04)';
      ctx.fillRect(PAD_L, PAD_T, xTreat - PAD_L, H - PAD_T - PAD_B);
      ctx.fillStyle = 'rgba(246,173,85,0.04)';
      ctx.fillRect(xTreat, PAD_T, W - PAD_R - xTreat, H - PAD_T - PAD_B);

      // Línea del tratamiento
      ctx.strokeStyle = '#F6AD55';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(xTreat, PAD_T - 8);
      ctx.lineTo(xTreat, H - PAD_B + 4);
      ctx.stroke();
      ctx.setLineDash([]);

      // Etiquetas zona
      ctx.fillStyle = '#63B3ED';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ANTES', PAD_L + (xTreat - PAD_L) / 2, PAD_T - 6);
      ctx.fillStyle = '#F6AD55';
      ctx.fillText('DESPUÉS', xTreat + (W - PAD_R - xTreat) / 2, PAD_T - 6);
      ctx.fillStyle = '#F6AD55';
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('↑ política', xTreat + 4, PAD_T + 14);

      // ── Grid Y ───────────────────────────────────────────────────────────
      const gridSteps = 5;
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillStyle = '#475569';
      ctx.textAlign = 'right';
      for (let i = 0; i <= gridSteps; i++) {
        const yVal = yMin + (i / gridSteps) * (yMax - yMin);
        const py = yY(yVal, yMin, yMax);
        ctx.beginPath();
        ctx.moveTo(PAD_L, py);
        ctx.lineTo(W - PAD_R, py);
        ctx.stroke();
        ctx.fillText(yVal.toFixed(1), PAD_L - 4, py + 4);
      }

      // Etiqueta eje Y
      ctx.save();
      ctx.translate(14, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('empleo (%)', 0, 0);
      ctx.restore();

      // ── Contrafactual (qué hubiera pasado sin tratamiento) ───────────────
      if (p.mostrarContrafactual) {
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(252,211,77,0.45)';
        ctx.lineWidth = 1.8;
        for (let i = 0; i < contrafactual.length; i++) {
          const pt = contrafactual[i];
          const px = tX(pt.t), py = yY(pt.y, yMin, yMax);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        // etiqueta
        const last = contrafactual[contrafactual.length - 1];
        ctx.fillStyle = 'rgba(252,211,77,0.6)';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('↖ contrafactual', tX(T_PRE + 1), yY(last.y, yMin, yMax) - 10);
      }

      // ── Serie CONTROL (PA - no recibió tratamiento) ──────────────────────
      ctx.beginPath();
      ctx.strokeStyle = '#63B3ED';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      for (let i = 0; i < control.length; i++) {
        const pt = control[i];
        const px = tX(pt.t), py = yY(pt.y, yMin, yMax);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Puntos control
      for (const pt of control) {
        ctx.beginPath();
        ctx.arc(tX(pt.t), yY(pt.y, yMin, yMax), 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#63B3ED';
        ctx.fill();
      }

      // ── Serie TRATADO (NJ - sí recibió tratamiento) ──────────────────────
      ctx.beginPath();
      ctx.strokeStyle = '#68D391';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      for (let i = 0; i < tratado.length; i++) {
        const pt = tratado[i];
        const px = tX(pt.t), py = yY(pt.y, yMin, yMax);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Puntos tratado
      for (const pt of tratado) {
        ctx.beginPath();
        ctx.arc(tX(pt.t), yY(pt.y, yMin, yMax), 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#68D391';
        ctx.fill();
      }

      // ── Flecha / brecha DiD al final ─────────────────────────────────────
      {
        const lastT = tratado[T_TOTAL - 1];
        const lastCF = contrafactual[T_TOTAL - 1];
        if (p.mostrarContrafactual && lastT && lastCF) {
          const x  = tX(T_TOTAL - 1) - 18;
          const y1 = yY(lastCF.y, yMin, yMax);
          const y2 = yY(lastT.y, yMin, yMax);
          const mid = (y1 + y2) / 2;

          ctx.strokeStyle = '#F687B3';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y1);
          ctx.lineTo(x, y2);
          ctx.stroke();
          // cabeza de flecha arriba
          ctx.beginPath();
          ctx.moveTo(x - 5, y2 + (y1 > y2 ? -8 : 8));
          ctx.lineTo(x, y2);
          ctx.lineTo(x + 5, y2 + (y1 > y2 ? -8 : 8));
          ctx.stroke();

          ctx.fillStyle = '#F687B3';
          ctx.font = 'bold 11px ui-monospace, monospace';
          ctx.textAlign = 'right';
          const did = diD.did;
          ctx.fillText(`δ = ${did > 0 ? '+' : ''}${did.toFixed(1)}`, x - 8, mid + 4);
        }
      }

      // ── Medias por periodo (líneas horizontales punteadas) ───────────────
      {
        const drawMedia = (yVal: number, color: string, desde: number, hasta: number) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(tX(desde), yY(yVal, yMin, yMax));
          ctx.lineTo(tX(hasta - 1), yY(yVal, yMin, yMax));
          ctx.stroke();
          ctx.setLineDash([]);
        };
        drawMedia(diD.mediaTratPre,  'rgba(104,211,145,0.5)', 0,     T_PRE);
        drawMedia(diD.mediaTratPost, 'rgba(104,211,145,0.5)', T_PRE, T_TOTAL);
        drawMedia(diD.mediaCtrlPre,  'rgba(99,179,237,0.5)',  0,     T_PRE);
        drawMedia(diD.mediaCtrlPost, 'rgba(99,179,237,0.5)',  T_PRE, T_TOTAL);
      }

      // ── Leyenda ───────────────────────────────────────────────────────────
      {
        const lx = PAD_L + 4, ly = H - PAD_B + 14;
        ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'left';

        ctx.fillStyle = '#68D391';
        ctx.fillText('── Tratado (NJ)', lx, ly);
        ctx.fillStyle = '#63B3ED';
        ctx.fillText('── Control (PA)', lx + 140, ly);
        if (p.mostrarContrafactual) {
          ctx.fillStyle = 'rgba(252,211,77,0.7)';
          ctx.fillText('- - contrafactual', lx + 290, ly);
        }
        ctx.fillStyle = '#F687B3';
        ctx.fillText('δ DiD (efecto causal)', lx + 462, ly);
      }

      // ── Advertencia sesgo si viola tendencias ────────────────────────────
      if (p.violaTendencias) {
        ctx.fillStyle = 'rgba(239,68,68,0.85)';
        ctx.font = 'bold 11px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⚠ tendencias NO paralelas → DiD sesgado (no es causal)', W / 2, PAD_T + 18);
      }

      // Actualiza stats
      if (frame % 8 === 0) {
        setStats({ did: diD.did, sesgado: p.violaTendencias });
      }

      frame++;
      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  const didColor = stats.sesgado ? '#EF4444' : Math.abs(stats.did) < 0.5 ? '#94A3B8' : stats.did > 0 ? '#68D391' : '#F87171';

  const insight = stats.sesgado
    ? 'El control cambió de tendencia justo cuando le tocó. El DiD mide la diferencia, pero esa diferencia YA EXISTÍA sin el tratamiento. El estimador está sesgado: le estás atribuyendo a la política algo que hubiera pasado de todas formas.'
    : Math.abs(stats.did) < 0.5
      ? 'El efecto causal estimado es casi cero. La política no movió el empleo — o el ruido lo ahoga todo. Sube el "efecto real" o baja el ruido para verlo emerger.'
      : stats.did > 0
        ? 'El salario mínimo subió en NJ y el empleo subió también (o no cayó). El DiD aísla ese efecto descontando la tendencia del control. Card & Krueger (1994) encontraron exactamente esto: la destrucción de empleo que "todos predecían" no apareció.'
        : 'El efecto causal es negativo: la política sí redujo empleo. En qué rango y por cuánto depende del contexto. DiD lo mide sin sesgo siempre que las tendencias sean paralelas.';

  const reseedHandler = () => setSeed(Math.floor(Math.random() * 99999));

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

        {/* ── Canvas ──────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Botones rápidos */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={reseedHandler}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7] hover:bg-[#4FC3F7]/20 transition"
            >
              ↺ nueva muestra
            </button>
            <button
              onClick={() => setMostrarCF(v => !v)}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                mostrarCF
                  ? 'border-[#FCD34D]/50 bg-[#FCD34D]/10 text-[#FCD34D]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              {mostrarCF ? '◎ ocultar contrafactual' : '○ mostrar contrafactual'}
            </button>
            <button
              onClick={() => setViolaTend(v => !v)}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                violaTend
                  ? 'border-[#EF4444]/50 bg-[#EF4444]/10 text-[#EF4444]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              {violaTend ? '⚠ tendencias rotas: ON' : '○ romper tendencias (sesgo)'}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="δ DiD estimado"
              value={`${stats.did > 0 ? '+' : ''}${stats.did.toFixed(2)} pp`}
              accent={didColor}
            />
            <Stat
              label="efecto real (δ)"
              value={`${efecto > 0 ? '+' : ''}${efecto.toFixed(1)} pp`}
              accent="#A78BFA"
            />
            <Stat
              label="supuesto"
              value={stats.sesgado ? 'VIOLADO' : 'paralelas ✓'}
              accent={stats.sesgado ? '#EF4444' : '#34D399'}
            />
          </div>

          {/* Insight dinámico */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">
              ✦ ¿Qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── Panel de controles ───────────────────────────────────────── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Juega con el experimento
          </div>

          <Slider
            label="Efecto real del tratamiento"
            value={efecto}
            min={-4}
            max={8}
            step={0.1}
            onChange={setEfecto}
            fmt={v => `${v > 0 ? '+' : ''}${v.toFixed(1)} pp`}
            hint="El 'δ' verdadero: cuánto sube (o baja) el empleo en el grupo tratado por la política. En el paper real: ≈ +0.5 pp (sin caída)."
          />

          <Slider
            label="Ruido / variabilidad"
            value={ruido}
            min={0}
            max={3}
            step={0.05}
            onChange={setRuido}
            fmt={v => v < 0.5 ? 'datos limpios' : v < 1.5 ? 'realista' : 'muy ruidoso'}
            hint="Más ruido = más difícil distinguir el efecto. Por eso los economistas necesitan muestras grandes."
          />

          <div className="border-t border-[#1E293B] pt-4 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono">
              Fórmula DiD
            </div>
            <div className="text-[11px] font-mono text-[#94A3B8] space-y-1 leading-relaxed">
              <div>δ = (Ȳ<sub>NJ,post</sub> − Ȳ<sub>NJ,pre</sub>)</div>
              <div className="pl-4">− (Ȳ<sub>PA,post</sub> − Ȳ<sub>PA,pre</sub>)</div>
              <div className="mt-2 text-[#475569]">
                Doble diferencia: descuenta la tendencia común antes de medir el efecto.
              </div>
            </div>
          </div>

          <div className="border-t border-[#1E293B] pt-3 text-[10px] font-mono text-[#475569] leading-relaxed">
            Card &amp; Krueger (1994), AER<br />
            Angrist &amp; Imbens: LATE / IV<br />
            comité Nobel 2021 · método causal
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Componentes auxiliares ───────────────────────────────────────────────────

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
  label, value, min, max, step, onChange, fmt, hint,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string; hint?: string;
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
      {hint && (
        <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>
      )}
    </div>
  );
}
