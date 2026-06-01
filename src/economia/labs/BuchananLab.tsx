/**
 * BuchananLab — laboratorio del premio 1986 (James Buchanan).
 *
 * El click: el político no es malo. Maximiza su propio interés igual que tú
 * en el super. Buchanan formalizó el Public Choice: aplicar la lógica del
 * mercado al gobierno. Los políticos maximizan votos, no bienestar.
 *
 * Modelo económico REAL:
 *   Hay N proyectos. Cada uno tiene:
 *     impacto_social(x)   = s_i · ln(1 + x / c_i)     [utilidad social con rendimientos decrecientes]
 *     rendimiento_votos(x) = v_i · visibilidad_i · ln(1 + x / c_i)  [votos proporcionales a visibilidad]
 *
 *   "Ángel benevolente" (welfare maximizer):
 *     maximiza Σ impacto_social(x_i)  sujeto a Σ x_i = BUDGET
 *     Condición KKT: s_i / (c_i + x_i) = λ  para todo i
 *     → solución cerrada: x_i* ∝ s_i   (asignación proporcional al impacto)
 *       con ajuste iterativo de la cota 0 ≤ x_i ≤ BUDGET
 *
 *   "Político real" (vote maximizer):
 *     maximiza Σ rendimiento_votos(x_i)  sujeto a Σ x_i = BUDGET
 *     misma condición KKT pero ponderado por v_i · visibilidad_i
 *     → x_i** ∝ v_i · visibilidad_i   (distorsión electoral)
 *
 *   Brecha de bienestar (deadweight loss político):
 *     DWL = Σ impacto_social(x_i*) − Σ impacto_social(x_i**)
 *
 *   El usuario mueve "sesgo de visibilidad" y ve emerger la distorsión en vivo.
 */

import { useEffect, useRef, useState } from 'react';

const W = 820;
const H = 380;
const BUDGET = 100;            // presupuesto total (unidades abstractas)
const STEP = 1 / 60;

// ─── Proyectos con parámetros fijos (impacto social real vs impacto electoral) ───
interface Project {
  nombre: string;
  emoji: string;
  /** utilidad marginal base (peso social real) */
  s: number;
  /** visibilidad electoral (qué tan fotogénico es inaugurarlo) */
  visBase: number;
  /** costo de escalado (cuánto cuesta antes de rendir bien) */
  c: number;
  color: string;
}

const PROJECTS: Project[] = [
  { nombre: 'Hospital',      emoji: '🏥', s: 9.0, visBase: 0.5, c: 15, color: '#EF4444' },
  { nombre: 'Puente',        emoji: '🌉', s: 5.0, visBase: 1.8, c: 20, color: '#FDB813' },
  { nombre: 'Parque',        emoji: '🌳', s: 3.5, visBase: 2.8, c: 8,  color: '#34D399' },
  { nombre: 'Escuela',       emoji: '🏫', s: 8.0, visBase: 0.7, c: 12, color: '#4FC3F7' },
];

interface Params {
  sesgoBias: number;    // 0 = todo proporcional a impacto social, 10 = todo proporcional a visibilidad
  horizonte: number;    // 0..10: cuán corto es el horizonte electoral (amplifica visibilidad)
  modo: 'angel' | 'politico';
}

const DEFAULTS: Params = { sesgoBias: 5, horizonte: 5, modo: 'politico' };

// ─── Modelo: asignación óptima con log-utilidad + condición KKT ───────────────

/**
 * Resuelve: max Σ w_i · ln(1 + x_i/c_i)   s.t. Σ x_i = BUDGET, x_i ≥ 0
 * Condición de primer orden: w_i / (c_i + x_i) = λ
 * → x_i = w_i/λ − c_i    (con x_i ≥ 0)
 * λ se obtiene de la restricción: Σ max(0, w_i/λ − c_i) = BUDGET
 * Bisección en λ.
 */
function solveAllocation(weights: number[], cs: number[]): number[] {
  const n = weights.length;
  // Cota superior e inferior para λ
  const wMax = Math.max(...weights);
  const cMin = Math.min(...cs);
  let lo = 0;
  let hi = wMax / cMin;  // x_i ≥ 0 garantizado

  for (let iter = 0; iter < 80; iter++) {
    const mid = (lo + hi) / 2;
    const total = weights.reduce((acc, w, i) => {
      const xi = w / mid - cs[i];
      return acc + (xi > 0 ? xi : 0);
    }, 0);
    if (total > BUDGET) lo = mid;
    else hi = mid;
  }

  const lambda = (lo + hi) / 2;
  const raw = weights.map((w, i) => Math.max(0, w / lambda - cs[i]));
  // Normalizar al presupuesto exacto (corrección numérica)
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(xi => (xi / sum) * BUDGET);
}

function computeAllocations(p: Params): { angel: number[]; politico: number[] } {
  const cs = PROJECTS.map(proj => proj.c);

  // Pesos del ángel: solo impacto social real
  const wAngel = PROJECTS.map(proj => proj.s);

  // Pesos del político: impacto social distorsionado por visibilidad y sesgo
  const visibilidad = PROJECTS.map(proj => {
    const vis = proj.visBase * (1 + (p.sesgoBias / 10) * (p.horizonte / 5));
    return vis;
  });
  // Blend entre social puro y electoral puro
  const alpha = p.sesgoBias / 10;  // 0 = ángel, 1 = puro votos
  const wPolitico = PROJECTS.map((proj, i) => {
    return (1 - alpha) * proj.s + alpha * visibilidad[i] * proj.s;
  });

  return {
    angel: solveAllocation(wAngel, cs),
    politico: solveAllocation(wPolitico, cs),
  };
}

function socialWelfare(alloc: number[]): number {
  return PROJECTS.reduce((acc, proj, i) => acc + proj.s * Math.log(1 + alloc[i] / proj.c), 0);
}

// ─── Animación suave de barras ─────────────────────────────────────────────

interface AnimState {
  bars: number[];      // asignación animada actual (animated toward target)
  target: number[];
  welfare: number;
  targetWelfare: number;
  angelWelfare: number;
}

export default function BuchananLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS });
  const animRef = useRef<AnimState>({
    bars: PROJECTS.map(() => BUDGET / PROJECTS.length),
    target: PROJECTS.map(() => BUDGET / PROJECTS.length),
    welfare: 0,
    targetWelfare: 0,
    angelWelfare: 0,
  });

  const [sesgoBias, setSesgoBias] = useState(DEFAULTS.sesgoBias);
  const [horizonte, setHorizonte] = useState(DEFAULTS.horizonte);
  const [modo, setModo] = useState<'angel' | 'politico'>(DEFAULTS.modo);
  const [stats, setStats] = useState({
    gap: 0,
    angelW: 0,
    politicoW: 0,
    alloc: PROJECTS.map(() => BUDGET / PROJECTS.length),
  });

  // Sync params
  useEffect(() => {
    paramsRef.current = { sesgoBias, horizonte, modo };
  }, [sesgoBias, horizonte, modo]);

  // Main loop
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

    function update(dt: number) {
      const p = paramsRef.current;
      const anim = animRef.current;
      const allocs = computeAllocations(p);
      anim.target = p.modo === 'angel' ? allocs.angel : allocs.politico;
      anim.targetWelfare = socialWelfare(anim.target);
      anim.angelWelfare = socialWelfare(allocs.angel);

      // Lerp barras hacia el target
      const speed = 5;
      anim.bars = anim.bars.map((b, i) => b + (anim.target[i] - b) * Math.min(1, speed * dt));
      anim.welfare = anim.welfare + (anim.targetWelfare - anim.welfare) * Math.min(1, speed * dt);
    }

    function draw() {
      if (!ctx) return;
      const anim = animRef.current;
      const p = paramsRef.current;

      // Fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#07090F');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const N = PROJECTS.length;
      const marginL = 52;
      const marginR = 36;
      const marginT = 52;
      const marginB = 80;
      const chartW = W - marginL - marginR;
      const chartH = H - marginT - marginB;
      const barGroupW = chartW / N;
      const barW = barGroupW * 0.55;
      const maxAlloc = BUDGET;  // max bar height = budget (all in one)

      // Grid horizontal
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      for (let pct of [25, 50, 75, 100]) {
        const y = marginT + chartH - (pct / 100) * chartH;
        ctx.beginPath();
        ctx.moveTo(marginL, y);
        ctx.lineTo(W - marginR, y);
        ctx.stroke();
        ctx.fillStyle = '#334155';
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${pct}`, marginL - 6, y + 3);
      }

      // Etiqueta eje Y
      ctx.save();
      ctx.translate(14, marginT + chartH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#475569';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('presupuesto asignado (%)', 0, 0);
      ctx.restore();

      // Calcular también asignación del ángel para comparación gris
      const allocs = computeAllocations(p);
      const angelAlloc = allocs.angel;
      const politicoAlloc = allocs.politico;

      for (let i = 0; i < N; i++) {
        const proj = PROJECTS[i];
        const cx = marginL + i * barGroupW + barGroupW / 2;
        const barX = cx - barW / 2;

        // Barra de referencia ángel (gris tenue, detrás)
        if (p.modo === 'politico') {
          const angelH = (angelAlloc[i] / maxAlloc) * chartH;
          const angelY = marginT + chartH - angelH;
          ctx.fillStyle = 'rgba(148,163,184,0.12)';
          ctx.fillRect(barX, angelY, barW, angelH);
          ctx.strokeStyle = 'rgba(148,163,184,0.25)';
          ctx.lineWidth = 1;
          ctx.strokeRect(barX, angelY, barW, angelH);
          // Etiqueta pequeña
          ctx.fillStyle = '#475569';
          ctx.font = '9px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${Math.round(angelAlloc[i])}`, cx, angelY - 4);
        }

        // Barra principal (asignación actual animada)
        const barH = (anim.bars[i] / maxAlloc) * chartH;
        const barY = marginT + chartH - barH;

        // Gradiente de la barra
        const grad = ctx.createLinearGradient(barX, barY, barX, marginT + chartH);
        grad.addColorStop(0, proj.color);
        grad.addColorStop(1, proj.color + '44');
        ctx.fillStyle = grad;

        // Brillo si está muy sesgado
        if (p.modo === 'politico') {
          const bias = (politicoAlloc[i] - angelAlloc[i]) / maxAlloc;
          if (bias > 0.02) {
            ctx.save();
            ctx.shadowColor = proj.color;
            ctx.shadowBlur = 10 + bias * 60;
          }
        }

        ctx.fillRect(barX, barY, barW, barH);

        if (p.modo === 'politico') {
          const bias = (politicoAlloc[i] - angelAlloc[i]) / maxAlloc;
          if (bias > 0.02) ctx.restore();
        }

        // Borde de la barra
        ctx.strokeStyle = proj.color + '88';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(barX, barY, barW, barH);

        // Valor encima
        ctx.fillStyle = proj.color;
        ctx.font = 'bold 11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(anim.bars[i])}`, cx, barY - 6);

        // Etiqueta del proyecto
        ctx.fillStyle = '#94A3B8';
        ctx.font = '11px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(proj.emoji, cx, marginT + chartH + 18);
        ctx.fillStyle = '#64748B';
        ctx.font = '10px ui-sans-serif, system-ui';
        ctx.fillText(proj.nombre, cx, marginT + chartH + 32);

        // Bienestar social del proyecto (calculado con asignación animada)
        const sw = proj.s * Math.log(1 + anim.bars[i] / proj.c);
        ctx.fillStyle = '#475569';
        ctx.font = '9px ui-monospace, monospace';
        ctx.fillText(`★${sw.toFixed(1)}`, cx, marginT + chartH + 46);
      }

      // Panel de bienestar total
      const angelW = anim.angelWelfare;
      const politicoW = anim.welfare;
      const maxW = angelW;
      const gapPct = maxW > 0 ? ((angelW - politicoW) / angelW) * 100 : 0;

      // Barra de bienestar total (derecha)
      const wBarX = W - marginR - 28;
      const wBarH = chartH;
      const wBarY = marginT;

      ctx.fillStyle = '#1E293B';
      ctx.fillRect(wBarX, wBarY, 22, wBarH);

      // Bienestar ángel (fondo)
      ctx.fillStyle = 'rgba(148,163,184,0.15)';
      ctx.fillRect(wBarX, wBarY, 22, wBarH);

      // Bienestar actual
      const filledH = maxW > 0 ? (politicoW / maxW) * wBarH : wBarH;
      const wGrad = ctx.createLinearGradient(wBarX, wBarY + wBarH - filledH, wBarX, wBarY + wBarH);
      wGrad.addColorStop(0, p.modo === 'angel' ? '#34D399' : (gapPct > 10 ? '#EF4444' : '#FDB813'));
      wGrad.addColorStop(1, '#1E293B');
      ctx.fillStyle = wGrad;
      ctx.fillRect(wBarX, wBarY + wBarH - filledH, 22, filledH);

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(wBarX, wBarY, 22, wBarH);

      ctx.save();
      ctx.translate(wBarX + 11, wBarY + wBarH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('bienestar social total', 0, 0);
      ctx.restore();

      // Leyenda modo
      const modeLabel = p.modo === 'angel' ? '👼 Ángel benevolente' : '🗳 Político real';
      const modeColor = p.modo === 'angel' ? '#34D399' : '#FDB813';
      ctx.fillStyle = modeColor;
      ctx.font = 'bold 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(modeLabel, W / 2, 28);

      // Brecha de bienestar
      if (p.modo === 'politico' && gapPct > 0.5) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 12px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`▼ pérdida de bienestar vs óptimo: ${gapPct.toFixed(1)}%`, W / 2, H - 10);
      } else if (p.modo === 'angel') {
        ctx.fillStyle = '#34D399';
        ctx.font = 'bold 12px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('✓ asignación social óptima', W / 2, H - 10);
      }

      // Leyenda "referencia ángel" si en modo político
      if (p.modo === 'politico') {
        ctx.fillStyle = 'rgba(148,163,184,0.5)';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('▭ = referencia ángel', marginL, H - 10);
      }

      if (frame % 12 === 0) {
        setStats({
          gap: gapPct,
          angelW,
          politicoW,
          alloc: [...anim.bars],
        });
      }
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      frame++;
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Insight dinámico
  const modoLabel = modo === 'angel' ? 'ángel' : 'político';
  const insight = modo === 'politico' && stats.gap > 8
    ? `Con sesgo ${sesgoBias}/10, el político distorsiona tanto el presupuesto que pierdes ${stats.gap.toFixed(0)}% de bienestar. El hospital y la escuela (impacto real alto, visibilidad baja) quedan desfinanciados. Eso son las obras de ribbon-cutting que ves en campaña.`
    : modo === 'politico' && stats.gap > 2
      ? `Hay una brecha de ${stats.gap.toFixed(1)}% entre la asignación del político y el óptimo social. El parque y el puente (más fotogénicos) capturan más presupuesto del que merecen.`
      : modo === 'angel'
        ? 'El ángel asigna según impacto social real (log-utilidad ponderada). El hospital recibe más porque su rendimiento social marginal es alto. Nadie piensa en los votos.'
        : 'Con sesgo bajo, el político casi replica al ángel. El Public Choice dice: cambia los incentivos, no al político.';

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Botones de modo */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setModo('angel')}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                modo === 'angel'
                  ? 'border-[#34D399]/60 bg-[#34D399]/15 text-[#34D399]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              👼 Ángel benevolente
            </button>
            <button
              onClick={() => setModo('politico')}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                modo === 'politico'
                  ? 'border-[#FDB813]/60 bg-[#FDB813]/15 text-[#FDB813]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              🗳 Político real
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="bienestar social" value={stats.politicoW.toFixed(2)} accent={modo === 'angel' ? '#34D399' : '#FDB813'} />
            <Stat label="óptimo social" value={stats.angelW.toFixed(2)} accent="#4FC3F7" />
            <Stat
              label="pérdida"
              value={modo === 'politico' ? `−${stats.gap.toFixed(1)}%` : '0%'}
              accent={stats.gap > 8 ? '#EF4444' : stats.gap > 2 ? '#FB923C' : '#34D399'}
            />
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#A78BFA] font-mono mb-2">
              ✦ Buchanan · Public Choice
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* Panel de controles */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ Mueve los incentivos</div>

          <Slider
            label="Sesgo de visibilidad"
            value={sesgoBias}
            min={0}
            max={10}
            step={0.1}
            onChange={setSesgoBias}
            fmt={v => v < 2 ? 'casi sin sesgo' : v < 5 ? 'sesgo medio' : v < 8 ? 'sesgo alto' : '¡puro ribbon-cutting!'}
            hint="Cuánto más peso le da el político a proyectos que salen en foto vs. los que realmente funcionan."
          />

          <Slider
            label="Horizonte electoral"
            value={horizonte}
            min={0}
            max={10}
            step={0.5}
            onChange={setHorizonte}
            fmt={v => v < 3 ? 'largo plazo' : v < 6 ? 'ciclo normal' : 'elecciones mañana'}
            hint="Mientras más cerca la elección, más visible tiene que ser cada peso gastado."
          />

          {/* Leyenda proyectos */}
          <div className="border-t border-[#1E293B] pt-3 space-y-2">
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#475569] font-mono mb-1">
              proyectos (impacto real ★ / visibilidad 👁)
            </div>
            {PROJECTS.map(proj => (
              <div key={proj.nombre} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px]">{proj.emoji}</span>
                  <span className="text-[11px] font-medium" style={{ color: proj.color }}>{proj.nombre}</span>
                </div>
                <div className="text-[10px] font-mono text-[#475569]">
                  ★{proj.s.toFixed(0)} / 👁{proj.visBase.toFixed(1)}
                </div>
              </div>
            ))}
          </div>

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo: max Σ wᵢ·ln(1+xᵢ/cᵢ)<br />
            KKT: wᵢ/(cᵢ+xᵢ) = λ → bisección<br />
            (Buchanan, The Calculus of Consent 1962)
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[19px] font-bold font-mono" style={{ color: accent }}>{value}</div>
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
        <span className="text-[12px] font-mono text-[#FDB813]">{fmt ? fmt(value) : value.toFixed(1)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#A78BFA]"
      />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}
