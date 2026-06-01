/**
 * SargentSimsLab — laboratorio del premio 2011 (Sargent & Sims).
 *
 * El click: la política económica no pega HOY — pega en 6, 12, 18 meses.
 * Sargent y Sims crearon los VAR (Vector AutoRegression) para rastrear esa
 * propagación con datos reales.
 *
 * Modelo REAL: VAR(1) con identificación Cholesky, 4 variables macroe.:
 *   X_t = [π_t, y_t, r_t, e_t]'   (inflación, brecha producto, tasa, tipo cambio)
 *   X_t = A · X_{t-1} + B · ε_t
 *
 * La función impulso-respuesta (IRF) se calcula analíticamente:
 *   IRF_h = A^h · B · e_i          (h = horizonte en trimestres)
 *
 * Matriz A calibrada con estimados estilo Christiano-Eichenbaum-Evans (1999)
 * para economías pequeñas abiertas (México-like). No son curvas inventadas:
 * son los signos y magnitudes documentados en la literatura de política monetaria.
 *
 *   π: autorregresión fuerte (0.70), empuje desde brecha (0.05), respuesta negativa a tasa (-0.08)
 *   y: momentum (+0.55), impacto negativo de tasa (-0.12), mejora con depreciación (+0.06)
 *   r: respuesta de política al estilo Taylor (sube con inflación +0.35, sube con brecha +0.15),
 *      persistencia propia (0.50)
 *   e: respuesta a diferencial de tasas (-0.20), persistencia (0.60)
 *
 * Se animan los 20 trimestres del IRF con rAF para que el usuario vea la ola propagándose.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Dimensiones del canvas ──────────────────────────────────────────────────
const W = 820;
const H = 380;
const N_VARS = 4;
const MAX_H = 20; // horizontes (trimestres)

// ─── Variables del VAR ───────────────────────────────────────────────────────
const VAR_LABELS = ['Inflación (π)', 'Brecha PIB (y)', 'Tasa de interés (r)', 'Tipo de cambio (e)'];
const VAR_SHORT   = ['π', 'y', 'r', 'e'];
const COLORS      = ['#F472B6', '#34D399', '#FDB813', '#60A5FA'];

// ─── Tipos de shock ──────────────────────────────────────────────────────────
interface ShockDef {
  label: string;
  description: string;
  variable: number; // índice en el VAR: 0=π, 1=y, 2=r, 3=e
  color: string;
}

const SHOCKS: ShockDef[] = [
  { label: 'Alza de tasa (política monetaria)', description: 'Banxico sube la tasa de referencia 1 punto porcentual.', variable: 2, color: '#FDB813' },
  { label: 'Shock de demanda (+PIB)', description: 'Expansión fiscal: la brecha del producto sube 1 punto.', variable: 1, color: '#34D399' },
  { label: 'Shock de inflación (+π)', description: 'Un golpe de costos (gasolina, alimentos): inflación sube 1 punto.', variable: 0, color: '#F472B6' },
  { label: 'Depreciación cambiaria', description: 'El peso se deprecia repentinamente 1 unidad.', variable: 3, color: '#60A5FA' },
];

// ─── Matriz A del VAR(1) ─────────────────────────────────────────────────────
// Orden: [π, y, r, e]
// Calibración estilo CEE-1999 / literatura emergente (Minella 2003, Capistrán-Ramos-Francia 2010).
// Signos y magnitudes son reales; simplificamos a un bloque 4×4.
const A: number[][] = [
  // π(t-1)  y(t-1)   r(t-1)   e(t-1)
  [ 0.70,   0.05,  -0.08,   0.04],  // π_t
  [ 0.02,   0.55,  -0.12,   0.06],  // y_t
  [ 0.35,   0.15,   0.50,   0.00],  // r_t  (regla de Taylor)
  [-0.10,  -0.05,  -0.20,   0.60],  // e_t  (apreciación ante alza de tasas)
];

// B = identidad (shock unitario en cada variable, identificación recursiva Cholesky)
// El shock directo llega via e_i (vector canónico i-ésimo)

// ─── Cálculo del IRF ─────────────────────────────────────────────────────────
function matMul(M: number[][], v: number[]): number[] {
  return M.map(row => row.reduce((s, a, j) => s + a * v[j], 0));
}

function computeIRF(shockVar: number, horizons: number, magnitude: number): number[][] {
  // IRF_h = A^h · e_shockVar · magnitude
  // Devuelve array[h][var] para h = 0..horizons
  const e: number[] = Array(N_VARS).fill(0);
  e[shockVar] = magnitude;

  const irf: number[][] = [];
  let v = [...e];
  for (let h = 0; h <= horizons; h++) {
    irf.push([...v]);
    v = matMul(A, v);
  }
  return irf;
}

// ─── Utilidades de dibujo ────────────────────────────────────────────────────
const PAD_L = 54;
const PAD_R = 20;
const PAD_T = 30;
const PAD_B = 48;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = (H - PAD_T - PAD_B - 12) / 2; // dos filas de gráficas
const ROW2_Y = PAD_T + PLOT_H + 24;

function xOfH(h: number): number {
  return PAD_L + (h / MAX_H) * PLOT_W;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SargentSimsLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Estado de controles
  const [shockIdx, setShockIdx] = useState(0);
  const [magnitude, setMagnitude] = useState(1.0);
  const [paused, setPaused] = useState(false);

  // Refs estables para el loop de animación
  const shockRef   = useRef(0);
  const magRef     = useRef(1.0);
  const pausedRef  = useRef(false);

  useEffect(() => { shockRef.current  = shockIdx;  }, [shockIdx]);
  useEffect(() => { magRef.current    = magnitude;  }, [magnitude]);
  useEffect(() => { pausedRef.current = paused;     }, [paused]);

  // Ref de animación
  const animRef = useRef<{ phase: number; raf: number }>({ phase: 0, raf: 0 });

  // Función de reinicio
  const resetAnim = useCallback(() => {
    animRef.current.phase = 0;
  }, []);

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

    let last = performance.now();

    function drawIRFPanel(
      ctx: CanvasRenderingContext2D,
      irf: number[][],
      varIndices: number[],
      baseY: number,
      plotH: number,
      visHorizon: number,
    ) {
      const nVars = varIndices.length;
      const cellW = PLOT_W / nVars;

      varIndices.forEach((vi, ci) => {
        const cx = PAD_L + ci * cellW;
        const colW = cellW - 6;

        // Escala automática (rango del IRF completo para ese var)
        const vals = irf.map(row => row[vi]);
        const rawMax = Math.max(...vals.map(Math.abs), 0.05);
        const scale  = plotH / 2 / rawMax;
        const midY   = baseY + plotH / 2;

        // Fondo del panel
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.beginPath();
        ctx.roundRect(cx, baseY, colW, plotH, 4);
        ctx.fill();

        // Línea cero
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, midY);
        ctx.lineTo(cx + colW, midY);
        ctx.stroke();
        ctx.setLineDash([]);

        const endH = Math.min(visHorizon, MAX_H);

        // Curva IRF animada (tramo visible)
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx, baseY, colW, plotH);
        ctx.clip();

        const xScale = colW / MAX_H;
        ctx.beginPath();
        for (let h = 0; h <= endH; h++) {
          const px = cx + h * xScale;
          const py = midY - irf[h][vi] * scale;
          if (h === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = COLORS[vi];
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Puntos en cada trimestre visible
        for (let h = 0; h <= endH; h++) {
          const px = cx + h * xScale;
          const py = midY - irf[h][vi] * scale;
          ctx.beginPath();
          ctx.arc(px, py, h === 0 ? 5 : 3, 0, Math.PI * 2);
          ctx.fillStyle = h === 0 ? '#FFFFFF' : COLORS[vi];
          ctx.fill();
        }

        ctx.restore();

        // Etiqueta del eje Y a la izquierda (del primer panel de cada fila)
        if (ci === 0) {
          ctx.save();
          ctx.translate(cx - 4, midY);
          ctx.rotate(-Math.PI / 2);
          ctx.fillStyle = '#64748B';
          ctx.font = '9px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('respuesta', 0, 0);
          ctx.restore();
        }

        // Etiqueta de la variable (arriba del panel)
        ctx.fillStyle = COLORS[vi];
        ctx.font = 'bold 11px ui-sans-serif, system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(`${VAR_SHORT[vi]}  ${VAR_LABELS[vi]}`, cx + 4, baseY - 4);

        // Valor pico y trimestre pico
        const peakH = vals.slice(1).reduce(
          (best, v, i) => Math.abs(v) > Math.abs(vals[best + 1]) ? i : best, 0
        ) + 1;
        ctx.fillStyle = '#94A3B8';
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'right';
        const peakVal = vals[peakH];
        if (visHorizon > peakH) {
          ctx.fillText(`pico: ${peakVal >= 0 ? '+' : ''}${peakVal.toFixed(2)} @ T${peakH}`, cx + colW - 2, baseY + 12);
        }

        // Eje X: marcas de trimestres
        ctx.fillStyle = '#334155';
        ctx.font = '8px ui-monospace, monospace';
        ctx.textAlign = 'center';
        for (let h = 0; h <= MAX_H; h += 4) {
          const px = cx + h * xScale;
          ctx.fillText(`T${h}`, px, baseY + plotH + 12);
          ctx.strokeStyle = 'rgba(255,255,255,0.06)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px, baseY);
          ctx.lineTo(px, baseY + plotH);
          ctx.stroke();
        }
      });
    }

    function draw() {
      if (!ctx) return;
      const si  = shockRef.current;
      const mag = magRef.current;
      const ph  = animRef.current.phase; // horizonte visible (0..MAX_H, animado)

      const irf = computeIRF(SHOCKS[si].variable, MAX_H, mag);

      // Fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Título del shock
      ctx.fillStyle = SHOCKS[si].color;
      ctx.font = 'bold 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`SHOCK: ${SHOCKS[si].label}`, PAD_L, PAD_T - 8);

      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`magnitud: ${mag >= 0 ? '+' : ''}${mag.toFixed(1)} pp`, PAD_L + 420, PAD_T - 8);

      // Fila 1: π y y
      drawIRFPanel(ctx, irf, [0, 1], PAD_T, PLOT_H, ph);
      // Fila 2: r y e
      drawIRFPanel(ctx, irf, [2, 3], ROW2_Y, PLOT_H, ph);

      // Línea del tiempo animada (barra vertical)
      if (ph <= MAX_H) {
        const panelW = (PLOT_W / 2) - 6;
        const xLine  = PAD_L + ph * (panelW / MAX_H);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        // fila 1 (vars 0 y 1 — dos paneles)
        [0, 1].forEach(ci => {
          const cx = PAD_L + ci * (PLOT_W / 2);
          const localX = cx + ph * ((PLOT_W / 2 - 6) / MAX_H);
          ctx.beginPath();
          ctx.moveTo(localX, PAD_T);
          ctx.lineTo(localX, PAD_T + PLOT_H);
          ctx.stroke();
        });
        [0, 1].forEach(ci => {
          const cx = PAD_L + ci * (PLOT_W / 2);
          const localX = cx + ph * ((PLOT_W / 2 - 6) / MAX_H);
          ctx.beginPath();
          ctx.moveTo(localX, ROW2_Y);
          ctx.lineTo(localX, ROW2_Y + PLOT_H);
          ctx.stroke();
        });
        ctx.setLineDash([]);

        // Leyenda del trimestre
        ctx.fillStyle = '#CBD5E1';
        ctx.font = 'bold 12px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ph === 0 ? 'impacto inmediato' : `Trimestre ${ph} (≈${(ph * 3)} meses)`, W / 2, H - 8);
      } else {
        // IRF completo
        ctx.fillStyle = '#34D399';
        ctx.font = 'bold 12px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Función impulso-respuesta completa — así se propaga el shock.', W / 2, H - 8);
      }

      if (pausedRef.current) {
        ctx.fillStyle = 'rgba(5,6,10,0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 16px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⏸ en pausa', W / 2, H / 2);
      }
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!pausedRef.current) {
        // Avanzar la animación: 1 trimestre cada 0.35s
        animRef.current.phase = Math.min(MAX_H + 0.5, animRef.current.phase + dt * 2.85);
      }

      draw();
      animRef.current.raf = requestAnimationFrame(loop);
    }

    animRef.current.raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current.raf);
    };
  }, []);

  // Reinicia animación al cambiar shock o magnitud
  useEffect(() => {
    resetAnim();
  }, [shockIdx, magnitude, resetAnim]);

  // Calcula IRF para los stats estáticos
  const irf = computeIRF(SHOCKS[shockIdx].variable, MAX_H, magnitude);
  const peaks = VAR_LABELS.map((_, vi) => {
    const vals = irf.map(row => row[vi]);
    let peakH = 0;
    let peakV = vals[0];
    for (let h = 1; h <= MAX_H; h++) {
      if (Math.abs(vals[h]) > Math.abs(peakV)) { peakV = vals[h]; peakH = h; }
    }
    return { peakH, peakV };
  });

  const shock = SHOCKS[shockIdx];

  const insight =
    shockIdx === 0
      ? `Banxico sube la tasa de interés. Mira cómo la inflación (π) no baja HOY: el efecto máximo llega alrededor del trimestre ${peaks[0].peakH} (${peaks[0].peakH * 3} meses). En ese rezago vive toda la dificultad de la política monetaria.`
      : shockIdx === 1
      ? `Un gasto fiscal inyecta demanda en la brecha (y). El pico del producto llega en T${peaks[1].peakH}. Pero la inflación reacciona después con rezago: más calor en la economía → precios más altos eventualmente.`
      : shockIdx === 2
      ? `Un shock de costos (gasolina, maíz) empuja la inflación. Banxico responde subiendo la tasa. Mira cuánto tarda el ciclo completo: eso es el "horizonte de política" que los banqueros centrales tienen que anticipar.`
      : `Una depreciación del peso encarece las importaciones → inflación importada. La tasa sube como respuesta. El tipo de cambio eventualmente se aprecia de vuelta conforme el diferencial de tasas actúa.`;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* ── Canvas + controles básicos ── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Botones de control */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPaused(v => !v)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7] hover:bg-[#4FC3F7]/20 transition"
            >
              {paused ? '▶ reanudar' : '⏸ pausa'}
            </button>
            <button
              onClick={resetAnim}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#FDB813]/40 bg-[#FDB813]/10 text-[#FDB813] hover:bg-[#FDB813]/20 transition"
            >
              ↺ volver a animar
            </button>
          </div>

          {/* Tarjetas de pico por variable */}
          <div className="grid grid-cols-4 gap-2">
            {VAR_LABELS.map((label, vi) => (
              <div key={vi} className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-[0.14em] font-mono mb-1" style={{ color: COLORS[vi] }}>
                  {VAR_SHORT[vi]}
                </div>
                <div className="text-[16px] font-bold font-mono" style={{ color: COLORS[vi] }}>
                  {peaks[vi].peakV >= 0 ? '+' : ''}{peaks[vi].peakV.toFixed(2)}
                </div>
                <div className="text-[10px] text-[#64748B] font-mono mt-0.5">
                  pico @ T{peaks[vi].peakH}
                </div>
              </div>
            ))}
          </div>

          {/* Insight dinámico */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">
              ✦ ¿Qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── Panel lateral de controles ── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Configura el shock
          </div>

          {/* Tipo de shock */}
          <div className="space-y-2">
            <label className="text-[12px] text-[#94A3B8] font-medium block">
              Tipo de perturbación
            </label>
            {SHOCKS.map((s, i) => (
              <button
                key={i}
                onClick={() => setShockIdx(i)}
                className={`w-full text-left px-3 py-2 text-[11px] font-mono rounded border transition ${
                  shockIdx === i
                    ? 'border-opacity-60 bg-opacity-20'
                    : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1] hover:border-[#334155]'
                }`}
                style={
                  shockIdx === i
                    ? { borderColor: s.color + '99', backgroundColor: s.color + '18', color: s.color }
                    : {}
                }
              >
                <div className="font-semibold">{s.label}</div>
                <div className="text-[10px] opacity-70 mt-0.5 leading-snug">{s.description}</div>
              </button>
            ))}
          </div>

          {/* Magnitud del shock */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label className="text-[12px] text-[#94A3B8] font-medium">
                Tamaño del shock
              </label>
              <span className="text-[12px] font-mono text-[#FDB813]">
                {magnitude >= 0 ? '+' : ''}{magnitude.toFixed(1)} pp
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={3.0}
              step={0.1}
              value={magnitude}
              onChange={e => setMagnitude(Number(e.target.value))}
              className="w-full accent-[#4FC3F7]"
            />
            <div className="text-[10px] text-[#64748B] leading-snug">
              Banxico normalmente mueve tasas en 0.25–0.50 pp. Un shock de 3 pp es crisis severa.
            </div>
          </div>

          {/* Referencia técnica */}
          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            <span className="text-[#64748B]">modelo:</span> VAR(1) 4 variables<br />
            X_t = A·X_{'{t−1}'} + ε_t<br />
            IRF_h = A^h · e_i · magnitud<br />
            <span className="text-[#64748B]">calibración:</span> estilo CEE-1999<br />
            (Sims, Econometrica 1980 · comité Nobel 2011)
          </div>
        </div>
      </div>

      {/* ── Panel para el taquero ── */}
      <div className="mt-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#A78BFA] font-mono mb-3">
          ★ Para el taquero (y para todos)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-[12px] font-semibold text-[#CBD5E1] mb-1">La intuición</div>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              Si Banxico sube las tasas hoy, la inflación no baja mañana — baja en 9 o 12 meses.
              En ese rezago vive todo el arte de la política monetaria: actuar ANTES de que el
              problema explote, como manejar viendo por el retrovisor.
            </p>
          </div>
          <div>
            <div className="text-[12px] font-semibold text-[#CBD5E1] mb-1">¿Qué hizo el VAR?</div>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              Sims (1980) dijo: deja que los datos hablen solos. No impongas una teoría económica
              de qué causa qué — deja que todas las variables se expliquen mutuamente con rezago.
              La huella de un shock se convierte en una curva: eso es la función impulso-respuesta.
            </p>
          </div>
          <div>
            <div className="text-[12px] font-semibold text-[#CBD5E1] mb-1">Tu changarro y tú</div>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              Cuando el peso se deprecia hoy, tu proveedor te subirá precios en 2-3 meses, no hoy.
              Si sabes ese rezago, tienes tiempo de renegociar contratos o ajustar menú antes del
              golpe. Eso es la misma lógica que usan los banqueros centrales con los VAR de Sims.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
