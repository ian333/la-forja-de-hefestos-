/**
 * BernankeDiamondDybvigLab — laboratorio del premio 2022
 * (Ben Bernanke, Douglas Diamond, Philip Dybvig).
 *
 * El click: tu banco tiene 100 pesos de tus ahorros y presta 90 ahora mismo.
 * Si la gente cree que el banco va a quebrar, corre a retirar.
 * Esa corrida HACE que el banco quiebre — aunque fuera solvente.
 * El miedo ES la causa. Diamond-Dybvig lo modelaron en 1983.
 *
 * Modelo real (Diamond-Dybvig simplificado):
 *   - N depositantes, cada uno con depósito d = 1.
 *   - El banco presta fracción λ de los fondos a largo plazo (activo ilíquido).
 *   - Reserva líquida = (1 − λ) · N · d
 *   - Un depositante "paciente" retira solo si cree que el banco quebrará:
 *       P(retirar | pánico) = sigmoid(k · (fraccCorriendo − umbral_i))
 *   - Si la cola de retiros supera la reserva, el banco suspende pagos → crisis.
 *   - Equilibrio bueno: pocos retiran, el banco aguanta.
 *   - Equilibrio malo: expectativas coordinan la corrida → profecía autocumplida.
 *
 * Bernanke (1983): la crisis bancaria de 1929 destruyó el crédito y eso fue lo
 * que hundió la economía real — no solo la bolsa.
 *
 * Seguro de depósito (IPAB/FDIC): garantía del gobierno = umbral de pánico se
 * vuelve infinito → corrida imposible → equilibrio bueno siempre.
 */

import { useEffect, useRef, useState } from 'react';

// ── dimensiones canvas ──────────────────────────────────────────────────────
const W = 820;
const H = 380;

// ── parámetros del modelo ───────────────────────────────────────────────────
const N_DEP = 60;          // número de depositantes
const D_UNIT = 1;          // depósito unitario (normalizado)
const BALL_R = 7;          // radio de cada depositante en canvas

// ── posiciones de los depositantes en el canvas ─────────────────────────────
// Se acomodan en una cuadrícula a la izquierda del canvas
const COLS = 10;
const ROWS = Math.ceil(N_DEP / COLS);
const GRID_X0 = 30;
const GRID_Y0 = 30;
const CELL_W = (W * 0.45) / COLS;
const CELL_H = (H - 60) / ROWS;

function depositorXY(i: number): [number, number] {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return [
    GRID_X0 + col * CELL_W + CELL_W / 2,
    GRID_Y0 + row * CELL_H + CELL_H / 2,
  ];
}

// ── posición del banco (centro derecho) ─────────────────────────────────────
const BANK_X = W * 0.73;
const BANK_Y = H / 2;
const BANK_W = 120;
const BANK_H = 80;

// ── lógica del modelo ────────────────────────────────────────────────────────
interface Depositor {
  id: number;
  /** umbral personal de pánico (fracción de corrida que lo activa) */
  threshold: number;
  /** estado actual */
  state: 'calm' | 'running' | 'paid' | 'lost';
  /** posición de animación (interpolación hacia el banco) */
  tx: number;
  ty: number;
  /** animación de movimiento */
  animT: number;  // 0..1 hacia el banco
}

interface SimState {
  depositors: Depositor[];
  reserves: number;           // efectivo líquido del banco (0..N_DEP * D_UNIT)
  totalAssets: number;        // activos totales del banco (reservas + préstamos)
  panicFrac: number;          // fracción corriendo ahora
  bankFailed: boolean;
  paused: boolean;
  shock: boolean;             // si se activó el shock externo
  insurance: boolean;         // seguro de depósito activo
  reserveRatio: number;       // slider: fracción que el banco guarda líquida (0.05..0.50)
  panicSeed: number;          // cuántos empiezan corriendo al inicio del shock
}

function makeSim(reserveRatio: number, insurance: boolean): SimState {
  const depositors: Depositor[] = [];
  for (let i = 0; i < N_DEP; i++) {
    depositors.push({
      id: i,
      // umbral heterogéneo: distribución uniforme [0.05, 0.90]
      threshold: 0.05 + (i / (N_DEP - 1)) * 0.85,
      state: 'calm',
      tx: 0,
      ty: 0,
      animT: 0,
    });
  }
  // Reservas iniciales = fracción líquida del total
  const reserves = reserveRatio * N_DEP * D_UNIT;
  const totalAssets = N_DEP * D_UNIT;
  return {
    depositors,
    reserves,
    totalAssets,
    panicFrac: 0,
    bankFailed: false,
    paused: false,
    shock: false,
    insurance,
    reserveRatio,
    panicSeed: 3,
  };
}

// ── sigmoid ──────────────────────────────────────────────────────────────────
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// ── un tick del modelo Diamond-Dybvig ────────────────────────────────────────
// Retorna la fracción de corriendo
function tickModel(sim: SimState, dt: number): void {
  if (sim.bankFailed) return;

  const totalDep = N_DEP;
  const running = sim.depositors.filter(d => d.state === 'running').length;
  const currentFrac = running / totalDep;
  sim.panicFrac = currentFrac;

  // Cada depositante "calmo" decide si correr
  for (const dep of sim.depositors) {
    if (dep.state !== 'calm') continue;

    let pRun: number;
    if (sim.insurance) {
      // Con seguro: solo corren los genuinamente impacientes (umbral muy alto, probabilidad ≈ 0)
      pRun = 0.0001 * dt;
    } else {
      // Modelo Diamond-Dybvig: prob ∝ sigmoid(k · (frac_corriendo − umbral_personal))
      const k = 18;
      const raw = sigmoid(k * (currentFrac - dep.threshold));
      pRun = Math.min(0.9, raw) * dt * 2.5;
    }

    if (Math.random() < pRun) {
      dep.state = 'running';
      const [bx, by] = depositorXY(dep.id);
      dep.tx = bx;
      dep.ty = by;
      dep.animT = 0;
    }
  }

  // Procesar pagos a los que llegaron al banco
  for (const dep of sim.depositors) {
    if (dep.state !== 'running') continue;

    // Animar movimiento hacia el banco
    dep.animT = Math.min(1, dep.animT + dt * 1.8);

    if (dep.animT >= 1) {
      // Intentar retirar
      if (sim.reserves >= D_UNIT) {
        sim.reserves -= D_UNIT;
        dep.state = 'paid';
      } else {
        // El banco no tiene suficiente liquidez → suspende pagos
        dep.state = 'lost';
        sim.bankFailed = true;
      }
    }
  }

  // Si queda algún corriendo tras falla, marcarlos como perdidos
  if (sim.bankFailed) {
    for (const dep of sim.depositors) {
      if (dep.state === 'running') dep.state = 'lost';
    }
  }
}

// ── colores por estado ────────────────────────────────────────────────────────
function depColor(state: Depositor['state'], insurance: boolean): string {
  if (state === 'calm') return insurance ? '#34D399' : '#4FC3F7';
  if (state === 'running') return '#F59E0B';
  if (state === 'paid') return '#334155';
  return '#EF4444'; // lost
}

// ── formato corto ──────────────────────────────────────────────────────────
function fmtPct(v: number): string {
  return (v * 100).toFixed(0) + '%';
}

// ── componente principal ─────────────────────────────────────────────────────
export default function BernankeDiamondDybvigLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<SimState>(makeSim(0.15, false));
  const pausedRef = useRef<boolean>(false);

  const [reserveRatio, setReserveRatio] = useState(0.15);
  const [insurance, setInsurance] = useState(false);
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState({
    calm: N_DEP,
    running: 0,
    paid: 0,
    lost: 0,
    reserves: 0.15 * N_DEP,
    bankFailed: false,
    panicFrac: 0,
  });

  // Sincronizar pausedRef inmediatamente (evita capture stale)
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Reiniciar cuando cambian parámetros
  const resetSim = (rr: number, ins: boolean) => {
    simRef.current = makeSim(rr, ins);
  };

  // Canvas + loop principal
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
    let frameN = 0;

    function draw() {
      if (!ctx) return;
      const sim = simRef.current;

      // Fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#07090F');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── Banco (rectángulo central-derecho) ──────────────────────────────
      const bankColor = sim.bankFailed ? '#EF4444' : '#1E40AF';
      const bankBorder = sim.bankFailed ? '#FCA5A5' : '#3B82F6';

      // sombra del banco
      ctx.save();
      ctx.shadowColor = sim.bankFailed ? 'rgba(239,68,68,0.4)' : 'rgba(59,130,246,0.3)';
      ctx.shadowBlur = 24;
      ctx.fillStyle = bankColor + '33';
      ctx.strokeStyle = bankBorder;
      ctx.lineWidth = 2;
      const bx = BANK_X - BANK_W / 2;
      const by = BANK_Y - BANK_H / 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, BANK_W, BANK_H, 8);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Etiqueta del banco
      ctx.font = 'bold 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = sim.bankFailed ? '#FCA5A5' : '#93C5FD';
      ctx.fillText(sim.bankFailed ? '🏦 BANCO CERRADO' : '🏦 BANCO', BANK_X, BANK_Y - 30);

      // Barra de reservas
      const barW = BANK_W - 20;
      const barH = 12;
      const barX = BANK_X - barW / 2;
      const barY = BANK_Y - 8;
      const totalCap = N_DEP * D_UNIT;
      const resFrac = Math.max(0, Math.min(1, sim.reserves / totalCap));
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 4);
      ctx.fill();
      const fillColor = sim.reserves < totalCap * 0.1 ? '#EF4444' : sim.reserves < totalCap * 0.25 ? '#F59E0B' : '#34D399';
      if (resFrac > 0.01) {
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW * resFrac, barH, 4);
        ctx.fill();
      }
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(`reservas: ${fmtPct(resFrac)}`, BANK_X, barY + barH + 13);

      // Línea separadora centro
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(W * 0.52, 20);
      ctx.lineTo(W * 0.52, H - 20);
      ctx.stroke();
      ctx.setLineDash([]);

      // ── Depositantes ────────────────────────────────────────────────────
      for (const dep of sim.depositors) {
        const [ox, oy] = depositorXY(dep.id);
        let cx = ox, cy = oy;

        // Si está corriendo, interpolar hacia el banco
        if (dep.state === 'running') {
          const t = dep.animT;
          const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          cx = ox + (BANK_X - ox) * eased;
          cy = oy + (BANK_Y - oy) * eased;
        } else if (dep.state === 'paid') {
          // se fue: pequeño punto gris en su lugar original
          ctx.fillStyle = '#1E293B';
          ctx.beginPath();
          ctx.arc(ox, oy, 3, 0, Math.PI * 2);
          ctx.fill();
          continue;
        } else if (dep.state === 'lost') {
          // quedó fuera del banco con una X
          ctx.save();
          ctx.shadowColor = '#EF4444';
          ctx.shadowBlur = 8;
          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          ctx.arc(ox, oy, BALL_R, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.strokeStyle = '#FCA5A5';
          ctx.lineWidth = 1.5;
          const s = BALL_R * 0.55;
          ctx.beginPath();
          ctx.moveTo(ox - s, oy - s); ctx.lineTo(ox + s, oy + s);
          ctx.moveTo(ox + s, oy - s); ctx.lineTo(ox - s, oy + s);
          ctx.stroke();
          continue;
        }

        // Dibujar la bolita
        const color = depColor(dep.state, sim.insurance);
        ctx.save();
        if (dep.state === 'running') {
          ctx.shadowColor = '#F59E0B';
          ctx.shadowBlur = 12;
        } else if (dep.state === 'calm') {
          ctx.shadowColor = sim.insurance ? '#34D399' : '#4FC3F7';
          ctx.shadowBlur = 4;
        }
        const grad = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, BALL_R);
        grad.addColorStop(0, color + 'EE');
        grad.addColorStop(1, color + '88');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, BALL_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ── Panel de estado superior ────────────────────────────────────────
      const calm = sim.depositors.filter(d => d.state === 'calm').length;
      const running = sim.depositors.filter(d => d.state === 'running').length;
      const paid = sim.depositors.filter(d => d.state === 'paid').length;
      const lost = sim.depositors.filter(d => d.state === 'lost').length;

      // Texto de status en parte inferior
      ctx.font = 'bold 12px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      if (sim.bankFailed) {
        ctx.fillStyle = '#EF4444';
        ctx.fillText(
          `💥 CORRIDA BANCARIA — ${lost} depositantes perdieron su dinero`,
          W / 2, H - 12
        );
      } else if (running > 0) {
        ctx.fillStyle = '#F59E0B';
        ctx.fillText(
          `⚠ Corrida en curso — ${running} corriendo · ${fmtPct(sim.panicFrac)} del banco`,
          W / 2, H - 12
        );
      } else if (sim.insurance) {
        ctx.fillStyle = '#34D399';
        ctx.fillText(
          '✓ Seguro de depósito activo — ningún depositante tiene razón para correr',
          W / 2, H - 12
        );
      } else {
        ctx.fillStyle = '#4FC3F7';
        ctx.fillText(
          `Equilibrio estable — calma coordina la calma · ${calm} depositantes tranquilos`,
          W / 2, H - 12
        );
      }

      // Panel info derecho (debajo del banco)
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#475569';
      ctx.fillText(`calmos: ${calm}  |  corriendo: ${running}`, BANK_X, BANK_Y + BANK_H / 2 + 18);
      ctx.fillText(`pagados: ${paid}  |  perdidos: ${lost}`, BANK_X, BANK_Y + BANK_H / 2 + 31);

      // Seguro de depósito label
      if (sim.insurance) {
        ctx.save();
        ctx.shadowColor = '#34D399';
        ctx.shadowBlur = 12;
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.fillStyle = '#34D399';
        ctx.fillText('🛡 IPAB/FDIC activo', BANK_X, BANK_Y + BANK_H / 2 + 46);
        ctx.restore();
      }

      // Pausa overlay
      if (pausedRef.current) {
        ctx.fillStyle = 'rgba(5,6,10,0.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 16px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⏸ en pausa', W / 2, H / 2);
      }

      // Actualizar stats React cada ~10 frames
      if (frameN % 10 === 0) {
        setStats({
          calm,
          running,
          paid,
          lost,
          reserves: sim.reserves,
          bankFailed: sim.bankFailed,
          panicFrac: sim.panicFrac,
        });
      }
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) {
        tickModel(simRef.current, dt);
      }
      draw();
      frameN++;
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Cuando cambia reserveRatio o insurance, reiniciar
  const handleReset = (rr: number, ins: boolean) => {
    resetSim(rr, ins);
  };

  // Disparar shock: algunos depositantes empiezan a correr
  const triggerShock = (nShock: number) => {
    const sim = simRef.current;
    if (sim.bankFailed) {
      // Reiniciar primero
      const fresh = makeSim(reserveRatio, insurance);
      simRef.current = fresh;
      return;
    }
    const calmos = sim.depositors.filter(d => d.state === 'calm');
    // Escoge los de umbral MÁS BAJO (los más nerviosos) para el shock
    calmos.sort((a, b) => a.threshold - b.threshold);
    const toRun = calmos.slice(0, Math.min(nShock, calmos.length));
    for (const dep of toRun) {
      dep.state = 'running';
      dep.animT = 0;
    }
  };

  // Insight dinámico
  const insight = stats.bankFailed
    ? `Corrida consumada. ${stats.lost} personas perdieron su dinero — aunque el banco originalmente tenía activos para todos. El pánico fue la causa de la quiebra, no un resultado de ella. Eso demostró Diamond-Dybvig en 1983.`
    : stats.running > 0
    ? `Corrida en progreso: ${stats.running} depositantes corren. Si la ola supera las reservas (${fmtPct(simRef.current.reserves / (N_DEP * D_UNIT))}), el banco suspende pagos. El umbral individual no importa — lo que importa es cuántos otros corren.`
    : insurance
    ? 'Con seguro de depósito activo, ningún depositante tiene razón para correr: aunque todos los demás retiren, tú cobras. La garantía pública rompe la lógica del pánico antes de que empiece. Eso es el IPAB en México, el FDIC en EE.UU.'
    : 'Equilibrio bueno: nadie corre porque nadie espera que los demás corran. Es estable — pero frágil. Un shock pequeño puede romperlo. Pulsa "shock de pánico" para verlo.';

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        <div className="space-y-4">
          {/* Canvas */}
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Controles de acción */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPaused(v => !v)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7] hover:bg-[#4FC3F7]/20 transition"
            >
              {paused ? '▶ reanudar' : '⏸ pausa'}
            </button>
            <button
              onClick={() => triggerShock(3)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/20 transition"
            >
              ⚡ shock de pánico (3)
            </button>
            <button
              onClick={() => triggerShock(8)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 transition"
            >
              💥 shock grande (8)
            </button>
            <button
              onClick={() => handleReset(reserveRatio, insurance)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#94A3B8]/30 text-[#94A3B8] hover:text-[#CBD5E1] transition"
            >
              ↺ reiniciar
            </button>
          </div>

          {/* Stats chips */}
          <div className="grid grid-cols-4 gap-2">
            <Stat label="tranquilos" value={String(stats.calm)} accent="#4FC3F7" />
            <Stat label="corriendo" value={String(stats.running)} accent="#F59E0B" />
            <Stat label="pagados" value={String(stats.paid)} accent="#64748B" />
            <Stat label="perdidos" value={String(stats.lost)} accent="#EF4444" />
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">
              ✦ ¿Qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* Panel de controles */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Parámetros del banco
          </div>

          <Slider
            label="Reserva líquida del banco"
            value={reserveRatio}
            min={0.05}
            max={0.50}
            step={0.01}
            onChange={v => {
              setReserveRatio(v);
              handleReset(v, insurance);
            }}
            fmt={v => fmtPct(v)}
            hint="Fracción de los depósitos que el banco guarda en efectivo. El resto lo presta a largo plazo."
          />

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[#94A3B8] font-medium">Seguro de depósito</span>
              <button
                onClick={() => {
                  const next = !insurance;
                  setInsurance(next);
                  handleReset(reserveRatio, next);
                }}
                className={`px-3 py-1 text-[12px] font-mono rounded border transition ${
                  insurance
                    ? 'border-[#34D399]/50 bg-[#34D399]/10 text-[#34D399]'
                    : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
                }`}
              >
                {insurance ? '🛡 IPAB: ON' : '○ IPAB: OFF'}
              </button>
            </div>
            <div className="text-[10px] text-[#64748B] leading-snug">
              El gobierno garantiza los depósitos. Nadie tiene razón para correr → corrida imposible.
              Diamond-Dybvig: el seguro elimina el equilibrio malo.
            </div>
          </div>

          <div className="border-t border-[#1E293B] pt-3 space-y-2">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#64748B] font-mono">
              Leyenda
            </div>
            <div className="space-y-1.5 text-[11px] font-mono">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#4FC3F7] inline-block flex-shrink-0" />
                <span className="text-[#94A3B8]">calmo — espera</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#F59E0B] inline-block flex-shrink-0" />
                <span className="text-[#94A3B8]">corriendo al banco</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#334155] inline-block flex-shrink-0" />
                <span className="text-[#94A3B8]">retiró → pagado</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#EF4444] inline-block flex-shrink-0" />
                <span className="text-[#94A3B8]">llegó tarde → perdió</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo: Diamond-Dybvig (1983)<br />
            P(correr|frac) = sigmoid(k·(frac−umbral_i))<br />
            banco cae si retiros &gt; reservas<br />
            Bernanke (1983) · JPE · AER
          </div>
        </div>
      </div>
    </div>
  );
}

// ── componentes auxiliares ───────────────────────────────────────────────────
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#64748B] font-mono mb-1">{label}</div>
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
