/**
 * KantorovichKoopmansLab — laboratorio del premio 1975 (Kantorovich & Koopmans).
 *
 * El click: con recursos limitados y múltiples opciones, la programación lineal
 * encuentra el EXACTO punto óptimo — no por intuición, sino por álgebra.
 *
 * Modelo REAL (LP en 2D):
 *
 *   Maximizar:   Z = c1·x1 + c2·x2          (ganancia)
 *   Sujeto a:    a1·x1 + b1·x2 ≤ R1         (recurso 1: tortillas)
 *                a2·x1 + b2·x2 ≤ R2         (recurso 2: tiempo de preparación)
 *                x1 ≥ 0,  x2 ≥ 0            (no negatividad)
 *
 *   Solución exacta: el óptimo siempre está en un vértice del polígono factible.
 *   Los vértices son las intersecciones de las fronteras activas.
 *   Se evalúa Z en cada vértice y se toma el máximo.
 *
 * Kantorovich (URSS, 1939) y Koopmans (EE.UU., 1951) llegaron al mismo algoritmo
 * desde economías opuestas. El resultado: menos desperdicio, más de todo.
 */

import { useEffect, useRef, useState } from 'react';

/* ─── constantes de layout ──────────────────────────────────────────── */
const W = 820;
const H = 380;
const PAD_L = 60;  // margen izq (eje Y)
const PAD_B = 46;  // margen inf (eje X)
const PAD_R = 24;
const PAD_T = 28;
const GW = W - PAD_L - PAD_R;   // ancho zona gráfica
const GH = H - PAD_B - PAD_T;   // alto  zona gráfica

const ACCENT1 = '#4FC3F7';   // x1 (tacos de pollo)
const ACCENT2 = '#F472B6';   // x2 (tacos de carne)
const ACCENT_REGION = 'rgba(99,102,241,0.22)';
const ACCENT_OPTIMAL = '#FDB813';
const ACCENT_CONSTRAINT1 = '#4FC3F7';
const ACCENT_CONSTRAINT2 = '#F472B6';

/* ─── tipos ─────────────────────────────────────────────────────────── */
interface Params {
  /** ganancia por taco de pollo */
  c1: number;
  /** ganancia por taco de carne */
  c2: number;
  /** tortillas necesarias por taco de pollo */
  a1: number;
  /** tortillas necesarias por taco de carne */
  b1: number;
  /** minutos por taco de pollo */
  a2: number;
  /** minutos por taco de carne */
  b2: number;
  /** tortillas disponibles */
  R1: number;
  /** minutos disponibles */
  R2: number;
}

interface LPResult {
  /** punto óptimo [x1, x2] */
  opt: [number, number];
  /** valor óptimo de Z */
  z: number;
  /** todos los vértices de la región factible */
  vertices: Array<[number, number]>;
  /** indica si hay solución */
  feasible: boolean;
}

/* ─── solver LP analítico (2 restricciones + no negatividad) ─────────── */
function solveLP(p: Params): LPResult {
  const { c1, c2, a1, b1, a2, b2, R1, R2 } = p;

  // candidatos a vértice: origen + intersecciones con ejes + intersección entre restricciones
  const candidates: Array<[number, number]> = [];

  // origen
  candidates.push([0, 0]);

  // R1: a1·x1 + b1·x2 = R1
  // intersección con eje x2=0: x1 = R1/a1
  if (a1 > 1e-9) candidates.push([R1 / a1, 0]);
  // intersección con eje x1=0: x2 = R1/b1
  if (b1 > 1e-9) candidates.push([0, R1 / b1]);

  // R2: a2·x1 + b2·x2 = R2
  if (a2 > 1e-9) candidates.push([R2 / a2, 0]);
  if (b2 > 1e-9) candidates.push([0, R2 / b2]);

  // intersección de las dos restricciones (sistema 2×2):
  // a1·x1 + b1·x2 = R1
  // a2·x1 + b2·x2 = R2
  const det = a1 * b2 - b1 * a2;
  if (Math.abs(det) > 1e-9) {
    const xi = (R1 * b2 - R2 * b1) / det;
    const yi = (a1 * R2 - a2 * R1) / det;
    candidates.push([xi, yi]);
  }

  // filtrar: solo factibles (x1≥0, x2≥0, ambas restricciones)
  const eps = 1e-6;
  const feasible = candidates.filter(([x, y]) =>
    x >= -eps && y >= -eps &&
    a1 * x + b1 * y <= R1 + eps &&
    a2 * x + b2 * y <= R2 + eps
  ).map(([x, y]): [number, number] => [Math.max(0, x), Math.max(0, y)]);

  if (feasible.length === 0) {
    return { opt: [0, 0], z: 0, vertices: [], feasible: false };
  }

  // ordenar vértices en sentido anti-horario (convex hull sobre conjunto pequeño)
  const cx = feasible.reduce((s, [x]) => s + x, 0) / feasible.length;
  const cy = feasible.reduce((s, [, y]) => s + y, 0) / feasible.length;
  const sorted = [...feasible].sort(
    ([ax, ay], [bx, by]) =>
      Math.atan2(ay - cy, ax - cx) - Math.atan2(by - cy, bx - cx)
  );

  // óptimo: vértice que maximiza Z
  let best: [number, number] = sorted[0];
  let bestZ = c1 * sorted[0][0] + c2 * sorted[0][1];
  for (const v of sorted) {
    const z = c1 * v[0] + c2 * v[1];
    if (z > bestZ) { bestZ = z; best = v; }
  }

  return { opt: best, z: bestZ, vertices: sorted, feasible: true };
}

/* ─── mapeo de coordenadas LP → canvas ──────────────────────────────── */
function makeMap(maxX: number, maxY: number) {
  const scaleX = GW / maxX;
  const scaleY = GH / maxY;
  const toCanvasX = (x: number) => PAD_L + x * scaleX;
  const toCanvasY = (y: number) => PAD_T + GH - y * scaleY;
  return { toCanvasX, toCanvasY, scaleX, scaleY };
}

/* ─── componentes UI ─────────────────────────────────────────────────── */
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[18px] font-bold font-mono" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function Slider({
  label, value, min, max, step, onChange, fmt, hint, accent,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string; hint?: string; accent?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[12px] font-mono" style={{ color: accent ?? '#FDB813' }}>
          {fmt ? fmt(value) : value.toFixed(1)}
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

/* ─── defaults ───────────────────────────────────────────────────────── */
const DEFAULTS: Params = {
  c1: 12,   // ganancia/taco pollo ($)
  c2: 18,   // ganancia/taco carne ($)
  a1: 2,    // tortillas/taco pollo
  b1: 3,    // tortillas/taco carne
  a2: 3,    // min/taco pollo
  b2: 2,    // min/taco carne
  R1: 120,  // tortillas disponibles
  R2: 90,   // minutos disponibles
};

/* ─── componente principal ───────────────────────────────────────────── */
export default function KantorovichKoopmansLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS });
  const resultRef = useRef<LPResult | null>(null);

  const [c1, setC1] = useState(DEFAULTS.c1);
  const [c2, setC2] = useState(DEFAULTS.c2);
  const [R1, setR1] = useState(DEFAULTS.R1);
  const [R2, setR2] = useState(DEFAULTS.R2);
  const [stats, setStats] = useState({ x1: 0, x2: 0, z: 0, feasible: true });

  // sincroniza ref de params
  useEffect(() => {
    paramsRef.current = { ...DEFAULTS, c1, c2, R1, R2 };
  }, [c1, c2, R1, R2]);

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
      const result = solveLP(p);
      resultRef.current = result;

      // máximos para escala: un 20% extra de los ejes
      const maxX1_c1 = p.R1 / p.a1;
      const maxX1_c2 = p.R2 / p.a2;
      const maxX2_c1 = p.R1 / p.b1;
      const maxX2_c2 = p.R2 / p.b2;
      const maxX = Math.max(maxX1_c1, maxX1_c2, 1) * 1.15;
      const maxY = Math.max(maxX2_c1, maxX2_c2, 1) * 1.15;
      const { toCanvasX, toCanvasY } = makeMap(maxX, maxY);

      /* ── fondo ─────────────────────────────────────────────────── */
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      /* ── cuadrícula suave ──────────────────────────────────────── */
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 0.8;
      const gridStepX = maxX / 8;
      const gridStepY = maxY / 6;
      for (let gx = 0; gx <= maxX; gx += gridStepX) {
        const cx2 = toCanvasX(gx);
        ctx.beginPath(); ctx.moveTo(cx2, PAD_T); ctx.lineTo(cx2, PAD_T + GH); ctx.stroke();
      }
      for (let gy = 0; gy <= maxY; gy += gridStepY) {
        const cy2 = toCanvasY(gy);
        ctx.beginPath(); ctx.moveTo(PAD_L, cy2); ctx.lineTo(PAD_L + GW, cy2); ctx.stroke();
      }

      /* ── ejes ──────────────────────────────────────────────────── */
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(PAD_L, PAD_T);
      ctx.lineTo(PAD_L, PAD_T + GH);
      ctx.lineTo(PAD_L + GW, PAD_T + GH);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      // etiquetas eje X (x1 = tacos de pollo)
      for (let gx = 0; gx <= maxX; gx += gridStepX * 2) {
        ctx.fillText(Math.round(gx).toString(), toCanvasX(gx), PAD_T + GH + 14);
      }
      ctx.textAlign = 'right';
      // etiquetas eje Y (x2 = tacos de carne)
      for (let gy = 0; gy <= maxY; gy += gridStepY * 2) {
        ctx.fillText(Math.round(gy).toString(), PAD_L - 4, toCanvasY(gy) + 4);
      }

      // labels de ejes
      ctx.fillStyle = ACCENT1;
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('tacos de pollo (x₁)', PAD_L + GW / 2, H - 6);
      ctx.save();
      ctx.translate(14, PAD_T + GH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = ACCENT2;
      ctx.fillText('tacos de carne (x₂)', 0, 0);
      ctx.restore();

      /* ── región factible ───────────────────────────────────────── */
      if (result.feasible && result.vertices.length > 1) {
        ctx.beginPath();
        result.vertices.forEach(([x, y], i) => {
          const cx3 = toCanvasX(x);
          const cy3 = toCanvasY(y);
          if (i === 0) ctx.moveTo(cx3, cy3);
          else ctx.lineTo(cx3, cy3);
        });
        ctx.closePath();
        ctx.fillStyle = ACCENT_REGION;
        ctx.fill();
        ctx.strokeStyle = 'rgba(99,102,241,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      /* ── restricción 1: a1·x1 + b1·x2 = R1 (tortillas) ────────── */
      {
        const x0 = 0;
        const y0 = p.R1 / p.b1;
        const x1e = p.R1 / p.a1;
        const y1e = 0;
        ctx.strokeStyle = ACCENT_CONSTRAINT1;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(toCanvasX(x0), toCanvasY(y0));
        ctx.lineTo(toCanvasX(x1e), toCanvasY(y1e));
        ctx.stroke();
        ctx.setLineDash([]);
        // etiqueta
        const midX = (x0 + x1e) / 2;
        const midY = (y0 + y1e) / 2;
        ctx.fillStyle = ACCENT_CONSTRAINT1;
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`tortillas ≤ ${Math.round(p.R1)}`, toCanvasX(midX) + 6, toCanvasY(midY) - 4);
      }

      /* ── restricción 2: a2·x1 + b2·x2 = R2 (tiempo) ───────────── */
      {
        const x0 = 0;
        const y0 = p.R2 / p.b2;
        const x1e = p.R2 / p.a2;
        const y1e = 0;
        ctx.strokeStyle = ACCENT_CONSTRAINT2;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(toCanvasX(x0), toCanvasY(y0));
        ctx.lineTo(toCanvasX(x1e), toCanvasY(y1e));
        ctx.stroke();
        ctx.setLineDash([]);
        const midX = (x0 + x1e) / 2;
        const midY = (y0 + y1e) / 2;
        ctx.fillStyle = ACCENT_CONSTRAINT2;
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`tiempo ≤ ${Math.round(p.R2)} min`, toCanvasX(midX) - 6, toCanvasY(midY) + 14);
      }

      /* ── líneas de nivel Z (función objetivo) ──────────────────── */
      if (result.feasible) {
        const zValues = [result.z * 0.4, result.z * 0.7, result.z];
        for (const zVal of zValues) {
          // c1·x1 + c2·x2 = zVal  →  x2 = (zVal - c1·x1) / c2
          const x0 = 0;
          const y0 = p.c2 > 1e-9 ? zVal / p.c2 : 0;
          const x1e = p.c1 > 1e-9 ? zVal / p.c1 : 0;
          const y1e = 0;
          const alpha = zVal === result.z ? 0.85 : 0.25;
          ctx.strokeStyle = `rgba(253,184,19,${alpha})`;
          ctx.lineWidth = zVal === result.z ? 2 : 1;
          ctx.setLineDash(zVal === result.z ? [] : [3, 5]);
          ctx.beginPath();
          ctx.moveTo(toCanvasX(x0), toCanvasY(y0));
          ctx.lineTo(toCanvasX(x1e), toCanvasY(y1e));
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // etiqueta Z óptimo
        {
          const zVal = result.z;
          const x1e = p.c1 > 1e-9 ? zVal / p.c1 : 0;
          const labelX = Math.min(toCanvasX(x1e * 0.65), PAD_L + GW - 10);
          const labelY = p.c2 > 1e-9 ? toCanvasY(zVal / p.c2 * 0.35) - 6 : PAD_T + 10;
          ctx.fillStyle = ACCENT_OPTIMAL;
          ctx.font = 'bold 10px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`Z=$${Math.round(zVal)}`, labelX, Math.max(labelY, PAD_T + 12));
        }
      }

      /* ── vértices ──────────────────────────────────────────────── */
      if (result.feasible) {
        for (const [vx, vy] of result.vertices) {
          const isOpt = Math.abs(vx - result.opt[0]) < 1e-4 && Math.abs(vy - result.opt[1]) < 1e-4;
          const cx4 = toCanvasX(vx);
          const cy4 = toCanvasY(vy);
          ctx.save();
          if (isOpt) {
            ctx.shadowColor = ACCENT_OPTIMAL;
            ctx.shadowBlur = 20;
          }
          ctx.fillStyle = isOpt ? ACCENT_OPTIMAL : '#475569';
          ctx.beginPath();
          ctx.arc(cx4, cy4, isOpt ? 7 : 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          if (isOpt) {
            ctx.fillStyle = ACCENT_OPTIMAL;
            ctx.font = 'bold 11px ui-monospace, monospace';
            ctx.textAlign = vx > maxX * 0.5 ? 'right' : 'left';
            const off = vx > maxX * 0.5 ? -12 : 12;
            ctx.fillText(
              `★ (${Math.round(vx)}, ${Math.round(vy)})`,
              cx4 + off,
              vy > maxY * 0.5 ? cy4 + 18 : cy4 - 12
            );
          }
        }
      }

      /* ── texto Z en la región ──────────────────────────────────── */
      if (!result.feasible) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 14px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('sin solución factible', PAD_L + GW / 2, PAD_T + GH / 2);
      }

      /* ── actualiza stats React cada 8 frames ───────────────────── */
      if (frame % 8 === 0) {
        setStats({
          x1: Math.round(result.opt[0]),
          x2: Math.round(result.opt[1]),
          z: Math.round(result.z),
          feasible: result.feasible,
        });
      }

      frame++;
    }

    function loop() {
      draw();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(raf);
  }, []);

  /* ─── insight dinámico ─────────────────────────────────────────────── */
  const insight = !stats.feasible
    ? 'Los recursos son tan escasos que no puedes producir nada. Sube las restricciones.'
    : stats.x1 === 0 && stats.x2 === 0
    ? 'Con esos parámetros, lo mejor es no producir nada. Sube las ganancias o los recursos.'
    : stats.x1 === 0
    ? `Solo tacos de carne: ${stats.x2} tacos. La ganancia por carne supera tanto a la de pollo que conviene especializarse.`
    : stats.x2 === 0
    ? `Solo tacos de pollo: ${stats.x1} tacos. Con esa ganancia, el pollo se lleva todo.`
    : `Mezcla óptima: ${stats.x1} de pollo + ${stats.x2} de carne. Usas ambos recursos al máximo — el punto donde las dos restricciones se cruzan. Eso es lo que encontró Kantorovich en 1939.`;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* columna izquierda: canvas + controles + stats */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* leyenda de colores */}
          <div className="flex flex-wrap gap-4 text-[11px] font-mono text-[#94A3B8]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-5 h-0.5 border-t-2 border-dashed" style={{ borderColor: ACCENT1 }} />
              restricción tortillas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-5 h-0.5 border-t-2 border-dashed" style={{ borderColor: ACCENT2 }} />
              restricción tiempo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: ACCENT_OPTIMAL }} />
              óptimo Z*
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-5 h-0.5" style={{ background: ACCENT_OPTIMAL, opacity: 0.6 }} />
              líneas de nivel Z
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-3 rounded" style={{ background: 'rgba(99,102,241,0.4)' }} />
              región factible
            </span>
          </div>

          {/* stats */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="pollo (x₁)" value={`${stats.x1} tacos`} accent={ACCENT1} />
            <Stat label="carne (x₂)" value={`${stats.x2} tacos`} accent={ACCENT2} />
            <Stat label="ganancia máx Z*" value={`$${stats.z}`} accent={ACCENT_OPTIMAL} />
          </div>

          {/* insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">✦ ¿Qué estás viendo?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* columna derecha: controles */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ Tu taquería</div>

          <div className="text-[11px] text-[#475569] font-mono leading-relaxed border-b border-[#1E293B] pb-3">
            Maximizar: Z = c₁·x₁ + c₂·x₂<br />
            s.a. 2x₁ + 3x₂ ≤ tortillas<br />
            {'     '}3x₁ + 2x₂ ≤ minutos<br />
            {'     '}x₁, x₂ ≥ 0
          </div>

          <Slider
            label="Ganancia por taco de pollo (c₁)"
            value={c1}
            min={1} max={30} step={1}
            onChange={setC1}
            fmt={v => `$${v}`}
            hint="Cuánto ganas en pesos por cada taco de pollo que vendes."
            accent={ACCENT1}
          />
          <Slider
            label="Ganancia por taco de carne (c₂)"
            value={c2}
            min={1} max={30} step={1}
            onChange={setC2}
            fmt={v => `$${v}`}
            hint="Cuánto ganas por cada taco de carne. Si supera al de pollo, el óptimo cambia."
            accent={ACCENT2}
          />
          <Slider
            label="Tortillas disponibles (R₁)"
            value={R1}
            min={20} max={200} step={5}
            onChange={setR1}
            fmt={v => `${v}`}
            hint="Desplaza la restricción de tortillas. Más tortillas → región factible más grande."
            accent={ACCENT1}
          />
          <Slider
            label="Minutos disponibles (R₂)"
            value={R2}
            min={20} max={200} step={5}
            onChange={setR2}
            fmt={v => `${v} min`}
            hint="Tiempo total de preparación. Cada taco de pollo toma 3 min, cada carne 2 min."
            accent={ACCENT2}
          />

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            coeficientes fijos: pollo usa 2 tortillas y 3 min;<br />
            carne usa 3 tortillas y 2 min.<br />
            Kantorovich (1939) · Koopmans (1951)<br />
            Nobel 1975 — asignación óptima de recursos
          </div>
        </div>
      </div>
    </div>
  );
}
