/**
 * DufloBanerjeeKremerLab — laboratorio del premio 2019
 * (Esther Duflo, Abhijit Banerjee, Michael Kremer).
 *
 * El click: distinguir CORRELACIÓN de CAUSALIDAD en política social.
 * Sin aleatorización, los mejores municipios entran al programa → el
 * efecto medido está inflado por SESGO DE SELECCIÓN. Con aleatorización
 * (RCT), el grupo de control es estadísticamente idéntico al de
 * tratamiento ANTES del programa → la diferencia de medias es efecto
 * causal puro.
 *
 * Modelo cuantitativo real implementado:
 *   Cada "aldea" i tiene:
 *     x_i ~ N(μ_base, σ²_pop)     ← ingreso/bienestar base (latente)
 *     ε_i ~ N(0, σ²_noise)        ← ruido de medición
 *   Resultado observado sin programa:
 *     y_i = x_i + ε_i
 *   Resultado con programa (efecto τ = ATE real):
 *     y_i(1) = x_i + τ + ε_i'    (ε_i' independiente)
 *
 *   Sin RCT (opt-in sesgado): P(selección | i) ∝ softmax(x_i / T_sel)
 *     → E[y|tratado] − E[y|control] = τ + sesgo_de_selección
 *
 *   Con RCT: asignación D_i ~ Bernoulli(0.5) independiente de x_i
 *     → E[y|D=1] − E[y|D=0] → τ  (converge a medida que n crece)
 *
 *   ATE estimado: τ̂ = ȳ_T − ȳ_C
 *   Error estándar: SE = √(Var_T/n_T + Var_C/n_C)
 *   p-valor aproximado: 2·(1 − Φ(|τ̂/SE|))   (two-sided z-test)
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── constantes canvas ────────────────────────────────────────────────────────
const W = 820;
const H = 380;
const PAD = 48;
const VILLAGE_R = 7;

// ─── parámetros del modelo ───────────────────────────────────────────────────
const N_VILLAGES = 80;        // total de aldeas
const MU_BASE    = 50;        // bienestar promedio (escala 0-100)
const SIGMA_POP  = 18;        // dispersión poblacional
const SIGMA_NOISE= 8;         // ruido de medición (por run)
const T_SELECTION= 14;        // temperatura de sesgo (menor→más sesgo)

// ─── tipos ───────────────────────────────────────────────────────────────────
interface Intervencion {
  id: string;
  label: string;
  tau: number;   // efecto promedio REAL (ATE en escala 0-100)
  color: string; // acento
}

const INTERVENCIONES: Intervencion[] = [
  { id: 'cash',    label: 'Transferencia en efectivo a madres',  tau: 8,  color: '#34D399' },
  { id: 'parasit', label: 'Desparasitación escolar (Kremer)',    tau: 12, color: '#A78BFA' },
  { id: 'tutor',   label: 'Tutores por nivel (no por grado)',    tau: 6,  color: '#4FC3F7' },
  { id: 'libros',  label: 'Libros de texto gratuitos',           tau: 1,  color: '#FB923C' },  // ¡sorpresa!
];

interface Village {
  id: number;
  x_lat: number;   // bienestar latente
  y_pre: number;   // resultado pre-intervención observado
  y_post_t: number;// resultado post si recibe tratamiento
  y_post_c: number;// resultado post si es control
  treated: boolean;
  // posición canvas
  cx: number;
  cy: number;
}

interface RunResult {
  tauHat: number;
  se: number;
  pval: number;
  meanT: number;
  meanC: number;
  biasedDiff: number; // diferencia naïve sin RCT (selección sesgada)
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function randn(): number {
  // Box-Muller
  const u1 = Math.random(), u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1 + 1e-12)) * Math.cos(2 * Math.PI * u2);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Aproximación de la CDF normal estándar (Abramowitz & Stegun 26.2.17) */
function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530
    + t * (-0.356563782
    + t * (1.781477937
    + t * (-1.821255978
    + t * 1.330274429))));
  const base = 1 - 0.3989422804 * Math.exp(-0.5 * z * z) * poly;
  return z >= 0 ? base : 1 - base;
}

/** Genera N aldeas con propiedades latentes */
function genVillages(tau: number, rng: () => number = Math.random): Village[] {
  const villages: Village[] = [];
  // Layout: dos columnas (tratamiento | control) dentro del canvas
  const colTW = (W / 2 - PAD * 1.5);
  const colCW = (W / 2 - PAD * 1.5);
  const cols = 8;
  const rows = Math.ceil(N_VILLAGES / (2 * cols));

  for (let i = 0; i < N_VILLAGES; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const side = i < N_VILLAGES / 2 ? 0 : 1; // izq=0 der=1, reorganizado al asignar
    const x_lat = clamp(MU_BASE + SIGMA_POP * randn(), 5, 95);
    const y_pre = clamp(x_lat + SIGMA_NOISE * randn(), 0, 100);
    const y_post_t = clamp(x_lat + tau + SIGMA_NOISE * randn(), 0, 100);
    const y_post_c = clamp(x_lat + SIGMA_NOISE * randn(), 0, 100);
    // posición en layout de cuadrícula (se reorganiza al correr el RCT)
    const cxBase = PAD + (col % cols) * (colTW / cols) + colTW / (2 * cols);
    const cyBase = 60 + row * ((H - 90) / rows);
    villages.push({
      id: i,
      x_lat,
      y_pre,
      y_post_t,
      y_post_c,
      treated: false,
      cx: cxBase + (side === 1 ? W / 2 : 0),
      cy: clamp(cyBase, 60, H - 40),
    });
  }
  return villages;
}

/** Asigna tratamiento con SESGO (opt-in → las mejores aldeas entran) */
function assignBiased(villages: Village[]): Village[] {
  const sorted = [...villages].sort((a, b) => b.x_lat - a.x_lat);
  return villages.map(v => ({
    ...v,
    treated: sorted.indexOf(v) < N_VILLAGES / 2,
  }));
}

/** Asigna tratamiento ALEATORIO (RCT) */
function assignRandom(villages: Village[]): Village[] {
  const shuffled = [...villages].sort(() => Math.random() - 0.5);
  return villages.map(v => ({
    ...v,
    treated: shuffled.indexOf(v) < N_VILLAGES / 2,
  }));
}

function calcResult(villages: Village[]): RunResult {
  const treated = villages.filter(v => v.treated);
  const control = villages.filter(v => !v.treated);
  const meanT = treated.reduce((s, v) => s + v.y_post_t, 0) / treated.length;
  const meanC = control.reduce((s, v) => s + v.y_post_c, 0) / control.length;
  const varT = treated.reduce((s, v) => s + (v.y_post_t - meanT) ** 2, 0) / (treated.length - 1);
  const varC = control.reduce((s, v) => s + (v.y_post_c - meanC) ** 2, 0) / (control.length - 1);
  const se = Math.sqrt(varT / treated.length + varC / control.length);
  const tauHat = meanT - meanC;
  const z = tauHat / (se + 1e-9);
  const pval = 2 * (1 - normCdf(Math.abs(z)));

  // diferencia naïve (mismas aldeas, resultado pre-program)
  const meanTpre = treated.reduce((s, v) => s + v.y_pre, 0) / treated.length;
  const meanCpre = control.reduce((s, v) => s + v.y_pre, 0) / control.length;
  const biasedDiff = meanTpre - meanCpre;

  return { tauHat, se, pval, meanT, meanC, biasedDiff };
}

/** Calcula layout xy: dos paneles (T / C) separados por línea central */
function layoutVillages(villages: Village[]): Village[] {
  const nT = villages.filter(v => v.treated).length;
  const nC = villages.length - nT;
  const colsT = Math.ceil(Math.sqrt(nT * (W / 2 / (H - 100))));
  const colsC = Math.ceil(Math.sqrt(nC * (W / 2 / (H - 100))));
  let iT = 0, iC = 0;
  return villages.map(v => {
    if (v.treated) {
      const col = iT % colsT;
      const row = Math.floor(iT / colsT);
      iT++;
      return { ...v,
        cx: clamp(PAD + col * ((W / 2 - PAD * 2) / colsT) + (W / 2 - PAD * 2) / (2 * colsT), PAD + VILLAGE_R, W / 2 - VILLAGE_R),
        cy: clamp(72 + row * ((H - 110) / Math.ceil(nT / colsT)), 72, H - 38),
      };
    } else {
      const col = iC % colsC;
      const row = Math.floor(iC / colsC);
      iC++;
      return { ...v,
        cx: clamp(W / 2 + PAD + col * ((W / 2 - PAD * 2) / colsC) + (W / 2 - PAD * 2) / (2 * colsC), W / 2 + VILLAGE_R, W - PAD - VILLAGE_R),
        cy: clamp(72 + row * ((H - 110) / Math.ceil(nC / colsC)), 72, H - 38),
      };
    }
  });
}

// ─── colores auxiliares ───────────────────────────────────────────────────────
const COL_TREATED = '#34D399';
const COL_CONTROL = '#F472B6';
const COL_GLOW_T  = '#065F46';
const COL_GLOW_C  = '#831843';
const COL_DIM     = '#1E293B';
const BG1 = '#0B0F17';
const BG2 = '#070A11';

// ─── componente principal ─────────────────────────────────────────────────────
export default function DufloBanerjeeKremerLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // estado React (controles)
  const [intervencionIdx, setIntervencionIdx] = useState(0);
  const [mode, setMode] = useState<'biased' | 'rct'>('biased');
  const [ran, setRan] = useState(false);

  // estado de simulación (ref, mutable sin re-render)
  const villagesRef  = useRef<Village[]>([]);
  const resultRef    = useRef<RunResult | null>(null);
  const animPhase    = useRef<'idle' | 'shuffle' | 'show'>('idle');
  const shuffleT     = useRef(0);
  const rafRef       = useRef(0);

  const intervencion = INTERVENCIONES[intervencionIdx];

  // genera aldeas nuevas al cambiar intervención o mode
  const reset = useCallback(() => {
    const tau = INTERVENCIONES[intervencionIdx].tau;
    villagesRef.current = genVillages(tau);
    resultRef.current = null;
    animPhase.current = 'idle';
    shuffleT.current = 0;
    setRan(false);
  }, [intervencionIdx]);

  // regenra cada vez que cambia intervención
  useEffect(() => { reset(); }, [reset]);

  // función para correr el experimento
  const runExperiment = useCallback(() => {
    const tau = INTERVENCIONES[intervencionIdx].tau;
    let vs = genVillages(tau);
    if (mode === 'biased') {
      vs = assignBiased(vs);
    } else {
      vs = assignRandom(vs);
    }
    vs = layoutVillages(vs);
    villagesRef.current = vs;
    resultRef.current = calcResult(vs);
    animPhase.current = 'shuffle';
    shuffleT.current = 0;
    setRan(true);
  }, [intervencionIdx, mode]);

  // loop de animación (canvas 2D)
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

    function draw(now: number) {
      if (!ctx) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      // avanza fase de animación
      if (animPhase.current === 'shuffle') {
        shuffleT.current += dt * 1.8;
        if (shuffleT.current >= 1) {
          shuffleT.current = 1;
          animPhase.current = 'show';
        }
      }

      // fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, BG1);
      bg.addColorStop(1, BG2);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const vs = villagesRef.current;
      const result = resultRef.current;
      const t = shuffleT.current;
      const phase = animPhase.current;
      const intv = intervencion;

      // ── paneles de fondo (T / C) ──────────────────────────────────────────
      if (ran) {
        ctx.fillStyle = 'rgba(6,95,70,0.07)';
        ctx.fillRect(0, 0, W / 2, H);
        ctx.fillStyle = 'rgba(131,24,67,0.07)';
        ctx.fillRect(W / 2, 0, W / 2, H);
        // divisor
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(W / 2, 52);
        ctx.lineTo(W / 2, H - 18);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // ── etiquetas de panel ────────────────────────────────────────────────
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px ui-sans-serif, system-ui';
      if (ran) {
        ctx.fillStyle = COL_TREATED;
        ctx.fillText('TRATAMIENTO', W / 4, 38);
        ctx.fillStyle = COL_CONTROL;
        ctx.fillText('CONTROL', (3 * W) / 4, 38);
        ctx.fillStyle = '#475569';
        ctx.font = '10px ui-sans-serif, system-ui';
        ctx.fillText(mode === 'rct' ? '(asignado al azar)' : '(los que pidieron entrar)', W / 4, 52);
        ctx.fillText(mode === 'rct' ? '(asignado al azar)' : '(los que no fueron seleccionados)', (3 * W) / 4, 52);
      } else {
        ctx.fillStyle = '#475569';
        ctx.font = '13px ui-sans-serif, system-ui';
        ctx.fillText('Elige una intervención y corre el experimento', W / 2, H / 2 - 12);
        ctx.fillStyle = '#334155';
        ctx.font = '11px ui-monospace, monospace';
        ctx.fillText('80 aldeas esperando asignación...', W / 2, H / 2 + 12);
      }

      // ── aldeas (puntos) ───────────────────────────────────────────────────
      if (vs.length > 0) {
        for (const v of vs) {
          const prog = clamp(t * 1.4 - (v.id / N_VILLAGES) * 0.4, 0, 1);
          const eased = prog < 0.5 ? 2 * prog * prog : -1 + (4 - 2 * prog) * prog; // ease in-out

          // color según asignación (aparece gradualmente)
          let col: string;
          if (!ran) {
            col = '#2D3748';
          } else if (v.treated) {
            col = `rgba(52,211,153,${0.25 + 0.75 * eased})`;
          } else {
            col = `rgba(244,114,182,${0.25 + 0.75 * eased})`;
          }

          // tamaño palpitante basado en resultado (escala del impacto)
          const outcome = v.treated ? v.y_post_t : v.y_post_c;
          const r = VILLAGE_R * (0.7 + 0.3 * (outcome / 100));

          ctx.save();
          if (ran && eased > 0.3) {
            ctx.shadowColor = v.treated ? COL_GLOW_T : COL_GLOW_C;
            ctx.shadowBlur  = 8 * eased;
          }
          ctx.beginPath();
          ctx.arc(v.cx, v.cy, r, 0, Math.PI * 2);
          ctx.fillStyle = col;
          ctx.fill();

          // borde sutil
          ctx.strokeStyle = ran
            ? (v.treated ? 'rgba(52,211,153,0.4)' : 'rgba(244,114,182,0.4)')
            : '#374151';
          ctx.lineWidth = 0.8;
          ctx.stroke();
          ctx.restore();
        }
      }

      // ── panel de resultados (aparece al terminar animación) ───────────────
      if (result && phase === 'show') {
        const { tauHat, se, pval, meanT, meanC, biasedDiff } = result;
        const sig = pval < 0.05;

        // barra de efecto (diferencia de medias)
        const barY = H - 28;
        const barH = 12;
        const barXC = W / 2 - 2;
        const pxPerUnit = 2.2;
        const barW = Math.abs(tauHat) * pxPerUnit;

        ctx.fillStyle = sig ? (tauHat > 0 ? 'rgba(52,211,153,0.2)' : 'rgba(244,114,182,0.2)') : 'rgba(148,163,184,0.1)';
        const bx = tauHat > 0 ? barXC : barXC - barW;
        ctx.fillRect(bx, barY - barH / 2, barW, barH);
        ctx.fillStyle = sig ? (tauHat > 0 ? COL_TREATED : COL_CONTROL) : '#94A3B8';
        ctx.fillRect(barXC - 1, barY - barH / 2 - 2, 2, barH + 4);

        // etiqueta de efecto
        ctx.textAlign = tauHat > 0 ? 'left' : 'right';
        ctx.font = `bold 11px ui-monospace, monospace`;
        ctx.fillStyle = sig ? intv.color : '#94A3B8';
        const effLabel = tauHat >= 0 ? `+${tauHat.toFixed(1)}` : tauHat.toFixed(1);
        ctx.fillText(`τ̂=${effLabel} pts (p=${pval < 0.001 ? '<0.001' : pval.toFixed(3)})`,
          tauHat > 0 ? barXC + barW + 6 : barXC - barW - 6, barY + 4);

        // sesgo (diferencia pre-tratamiento entre grupos) — solo en modo biased
        if (mode === 'biased' && Math.abs(biasedDiff) > 0.5) {
          ctx.textAlign = 'center';
          ctx.font = '10px ui-sans-serif, system-ui';
          ctx.fillStyle = '#F59E0B';
          ctx.fillText(`⚠ Los grupos YA diferían en ${biasedDiff.toFixed(1)} pts antes del programa — sesgo de selección`,
            W / 2, H - 46);
        }

        // medias en los paneles
        ctx.font = 'bold 14px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = COL_TREATED;
        ctx.fillText(`ȳ_T = ${meanT.toFixed(1)}`, W / 4, H - 46);
        ctx.fillStyle = COL_CONTROL;
        ctx.fillText(`ȳ_C = ${meanC.toFixed(1)}`, (3 * W) / 4, H - 46);

        // etiqueta efecto real (referencia)
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        ctx.fillText(`efecto real: τ = ${intv.tau} pts`, W / 2, H - 58);
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [ran, mode, intervencion]);

  // ── insight dinámico ───────────────────────────────────────────────────────
  const result = resultRef.current;
  let insight = 'Elige una intervención y corre el experimento. Las aldeas están esperando.';
  if (ran && result) {
    const { tauHat, pval, biasedDiff } = result;
    const sig = pval < 0.05;
    if (mode === 'biased') {
      if (Math.abs(biasedDiff) > 3) {
        insight = `Sesgo de selección: los grupos ya diferían ${biasedDiff.toFixed(1)} pts ANTES del programa. El efecto medido (${tauHat.toFixed(1)} pts) no es confiable — puede estar inflado o distorsionado. Sin aleatorización, no puedes saber si fue el programa o simplemente que entró gente que ya iba mejor.`;
      } else {
        insight = `Por casualidad el sesgo fue pequeño esta vez (${biasedDiff.toFixed(1)} pts). Pero sin aleatorización no SABES si eso es suerte. Vuelve a correrlo — a veces el sesgo es enorme.`;
      }
    } else {
      if (sig) {
        insight = `RCT: con aleatorización los grupos eran idénticos ANTES. La diferencia post es efecto causal puro: τ̂ ≈ ${tauHat.toFixed(1)} pts vs efecto real ${intervencion.tau} pts. ${intervencion.tau < 2 ? '¡Ojo! El efecto real es casi cero — el programa no sirve, aunque cueste un ojo.' : 'El programa sí funciona, y puedes demostrarlo.'}`;
      } else {
        insight = `RCT: el efecto estimado (${tauHat.toFixed(1)} pts, p=${pval.toFixed(2)}) no es estadísticamente significativo con esta muestra. Necesitas más aldeas o el efecto real es demasiado pequeño para detectarlo. La desparasitación (Kremer) tiene efecto grande y sí aparece.`;
      }
    }
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* ── canvas + controles ────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* botones de acción */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={runExperiment}
              className="px-4 py-1.5 text-[12px] font-mono rounded border border-[#34D399]/50 bg-[#34D399]/10 text-[#34D399] hover:bg-[#34D399]/20 transition font-semibold"
            >
              ▶ Correr experimento
            </button>
            <button
              onClick={reset}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1] transition"
            >
              ↺ Reiniciar
            </button>
            <div className="flex gap-1 ml-auto">
              <button
                onClick={() => setMode('biased')}
                className={`px-3 py-1.5 text-[11px] font-mono rounded border transition ${
                  mode === 'biased'
                    ? 'border-[#F59E0B]/60 bg-[#F59E0B]/10 text-[#F59E0B]'
                    : 'border-[#1E293B] text-[#475569] hover:text-[#94A3B8]'
                }`}
              >
                Sin aleatorizar (sesgo)
              </button>
              <button
                onClick={() => setMode('rct')}
                className={`px-3 py-1.5 text-[11px] font-mono rounded border transition ${
                  mode === 'rct'
                    ? 'border-[#4FC3F7]/60 bg-[#4FC3F7]/10 text-[#4FC3F7]'
                    : 'border-[#1E293B] text-[#475569] hover:text-[#94A3B8]'
                }`}
              >
                RCT (Duflo/Kremer)
              </button>
            </div>
          </div>

          {/* stats */}
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="Efecto medido (τ̂)"
              value={result ? (result.tauHat >= 0 ? `+${result.tauHat.toFixed(1)}` : result.tauHat.toFixed(1)) : '—'}
              accent={result ? (result.pval < 0.05 ? intervencion.color : '#94A3B8') : '#475569'}
            />
            <Stat
              label="Efecto real (τ)"
              value={ran ? `${intervencion.tau} pts` : '—'}
              accent="#F59E0B"
            />
            <Stat
              label="p-valor"
              value={result ? (result.pval < 0.001 ? '<0.001' : result.pval.toFixed(3)) : '—'}
              accent={result ? (result.pval < 0.05 ? '#34D399' : '#EF4444') : '#475569'}
            />
          </div>

          {/* insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">✦ ¿Qué estás viendo?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── panel de controles ────────────────────────────────────────── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ Elige la intervención</div>

          <div className="space-y-2">
            {INTERVENCIONES.map((inv, idx) => (
              <button
                key={inv.id}
                onClick={() => { setIntervencionIdx(idx); }}
                className={`w-full text-left px-3 py-2.5 rounded border text-[12px] transition ${
                  intervencionIdx === idx
                    ? 'border-opacity-60 bg-opacity-10'
                    : 'border-[#1E293B] text-[#475569] hover:text-[#94A3B8] hover:border-[#334155]'
                }`}
                style={intervencionIdx === idx ? {
                  borderColor: inv.color + '99',
                  backgroundColor: inv.color + '18',
                  color: inv.color,
                } : {}}
              >
                <div className="font-medium leading-snug">{inv.label}</div>
                <div className="text-[10px] mt-0.5 opacity-70">
                  efecto real: τ = {inv.tau} pts {inv.tau < 2 ? '(¡sorpresa!)' : ''}
                </div>
              </button>
            ))}
          </div>

          {/* divider */}
          <div className="border-t border-[#1E293B]" />

          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">El modelo</div>
            <div className="text-[10px] font-mono text-[#475569] leading-relaxed space-y-1">
              <div>Aldeas <span className="text-[#64748B]">i=1…80</span></div>
              <div>x_i ~ N(50, 18²) bienestar latente</div>
              <div>y_i(1) = x_i + τ + ε  ← tratadas</div>
              <div>y_i(0) = x_i + ε       ← control</div>
              <div className="pt-1">τ̂ = ȳ_T − ȳ_C</div>
              <div>SE = √(Var_T/n_T + Var_C/n_C)</div>
              <div>z-test bilateral</div>
            </div>
          </div>

          <div className="border-t border-[#1E293B] pt-3">
            <div className="text-[10px] font-mono text-[#475569] leading-relaxed">
              Sin RCT: P(selección|i) ∝ bienestar base → sesgo.<br />
              Con RCT: D_i ~ Bernoulli(0.5) independiente → τ̂ → τ.<br />
              <br />
              Banerjee, Duflo, Kremer · Nobel 2019
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── componentes auxiliares ───────────────────────────────────────────────────
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[19px] font-bold font-mono" style={{ color: accent }}>{value}</div>
    </div>
  );
}
