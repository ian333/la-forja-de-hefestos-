/**
 * KahnemanLab — laboratorio del premio 2002 (Kahneman + Vernon Smith).
 *
 * El click: tu cerebro NO pesa ganancias y pérdidas igual. Perder 200 pesos
 * duele MÁS que ganar 200 pesos da gusto. Kahneman y Tversky lo midieron,
 * pusieron números y lo llamaron Teoría Prospectiva (Prospect Theory, 1979).
 *
 * Matemática REAL y exacta:
 *
 *   Función de valor (Kahneman-Tversky 1992):
 *     v(x) =  x^α              si x ≥ 0   (ganancias, cóncava)
 *     v(x) = −λ·(−x)^β        si x < 0   (pérdidas, convexa, con aversión λ)
 *
 *   Parámetros experimentales (cumulative prospect theory, Tversky & Kahneman 1992):
 *     α = β = 0.88  (sensibilidad decreciente — la curva aplana)
 *     λ = 2.25      (aversión a la pérdida — el doblete del dolor)
 *
 *   Punto de referencia: cero. Todo se mide respecto a lo que ya tienes.
 *   La asimetría α=β pero λ>1 es exactamente lo que genera el dolor doble.
 *
 *   Vernon Smith: en mercados de subasta con múltiples participantes el precio
 *   converge al equilibrio aunque cada uno sea "irracional". El caos individual
 *   se ordena. Eso se muestra en el panel de la derecha con partículas que
 *   convergen a p*.
 */

import { useEffect, useRef, useState } from 'react';

/* ── Dimensiones ─────────────────────────────────────────────────────────── */
const W = 820;
const H = 380;

/* ── Parámetros Kahneman-Tversky 1992 ───────────────────────────────────── */
const ALPHA = 0.88;   // sensibilidad ganancias
const BETA  = 0.88;   // sensibilidad pérdidas

/* Función de valor prospectivo */
function prospectValue(x: number, lambda: number): number {
  if (x >= 0) return Math.pow(x, ALPHA);
  return -lambda * Math.pow(-x, BETA);
}

/* ── Coordenadas canvas ──────────────────────────────────────────────────── */
const MARGIN = { top: 36, right: 28, bottom: 36, left: 42 };
const PLOT_W = W * 0.58;   // panel izquierdo: curva
const PLOT_H = H;
const X_RANGE = 300;       // eje ±300 pesos
const Y_RANGE_POS = Math.pow(X_RANGE, ALPHA);   // v(300)
// y range negativo: lambda*Y_RANGE_POS (varía con slider)

function dataToCanvas(
  x: number, y: number,
  lambda: number
): [number, number] {
  const yNeg = lambda * Math.pow(X_RANGE, BETA);
  const yRange = Math.max(Y_RANGE_POS, yNeg);
  const cx = MARGIN.left + ((x + X_RANGE) / (2 * X_RANGE)) * (PLOT_W - MARGIN.left - MARGIN.right);
  const cy = MARGIN.top + ((yRange - y) / (2 * yRange)) * (PLOT_H - MARGIN.top - MARGIN.bottom);
  return [cx, cy];
}

/* ── Tipos ───────────────────────────────────────────────────────────────── */
interface SimState {
  // Partícula de la propuesta actual (posición en eje x = cantidad propuesta)
  proposalX: number;   // −X_RANGE..X_RANGE
  dragging: boolean;
}

interface MarketParticle {
  price: number;
  vy: number;   // velocity hacia p*
  age: number;
  id: number;
}

/* ── Componente ─────────────────────────────────────────────────────────── */
export default function KahnemanLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lambdaRef = useRef<number>(2.25);
  const simRef    = useRef<SimState>({ proposalX: 150, dragging: false });
  const particlesRef = useRef<MarketParticle[]>([]);
  const nextIdRef    = useRef<number>(0);

  const [lambda, setLambda]     = useState<number>(2.25);
  const [proposal, setProposal] = useState<number>(150);
  const [stats, setStats]       = useState({ vGain: 0, vLoss: 0, ratio: 0 });

  /* Sincroniza ref con state */
  useEffect(() => { lambdaRef.current = lambda; }, [lambda]);
  useEffect(() => { simRef.current.proposalX = proposal; }, [proposal]);

  /* ── Loop de canvas ────────────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let frame = 0;
    const P_STAR = 200;   // precio de equilibrio del mercado Smith

    /* Genera partículas periódicamente */
    function spawnParticle() {
      const price = 50 + Math.random() * 300;
      particlesRef.current.push({
        price,
        vy: (P_STAR - price) * (0.02 + Math.random() * 0.04),
        age: 0,
        id: nextIdRef.current++,
      });
      if (particlesRef.current.length > 22) particlesRef.current.shift();
    }

    /* Dibuja el panel derecho: mercado Smith */
    function drawSmithMarket() {
      const px0 = PLOT_W + 12;
      const pw  = W - px0 - 10;
      const ph  = H;

      /* Fondo del panel */
      ctx.fillStyle = 'rgba(13,18,30,0.92)';
      ctx.fillRect(px0, 0, pw, ph);
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.strokeRect(px0, 0, pw, ph);

      /* Título */
      ctx.fillStyle = '#A78BFA';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Vernon Smith: el mercado', px0 + pw / 2, 18);
      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText('sí converge — aunque cada', px0 + pw / 2, 31);
      ctx.fillText('quien sea "irracional"', px0 + pw / 2, 43);

      /* Escala vertical: precio 50–350 */
      const priceMin = 50, priceMax = 350;
      const yTop = 60, yBot = H - 28;
      const pyOf = (p: number) => yTop + ((priceMax - p) / (priceMax - priceMin)) * (yBot - yTop);

      /* Línea p* */
      const pystar = pyOf(P_STAR);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px0 + 8, pystar);
      ctx.lineTo(px0 + pw - 8, pystar);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#34D399';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`p*=${P_STAR}`, px0 + pw - 36, pystar - 4);

      /* Partículas */
      particlesRef.current.forEach(pt => {
        const t = Math.min(1, pt.age / 90);
        const alpha = t < 0.8 ? t / 0.8 : (1 - t) / 0.2;
        const px = px0 + 18 + Math.sin(pt.id * 1.7) * (pw * 0.28);
        const py = pyOf(pt.price);
        const radius = 5;
        const dist = Math.abs(pt.price - P_STAR);
        const hue = dist < 20 ? '#34D399' : dist < 60 ? '#FDB813' : '#F472B6';
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = hue;
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      /* Etiqueta precio de equilibrio */
      ctx.fillStyle = '#34D399';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('equilibrio', px0 + pw / 2, H - 12);
    }

    /* Dibuja la curva de valor prospectivo */
    function drawValueCurve() {
      const lam = lambdaRef.current;
      const sim = simRef.current;

      /* Fondo */
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, PLOT_W, H);

      /* Zona ganancias / pérdidas */
      const [ox] = dataToCanvas(0, 0, lam);
      ctx.fillStyle = 'rgba(52,211,153,0.04)';
      ctx.fillRect(ox, 0, PLOT_W - ox, H);
      ctx.fillStyle = 'rgba(239,68,68,0.04)';
      ctx.fillRect(0, 0, ox, H);

      /* Ejes */
      const [, oy] = dataToCanvas(0, 0, lam);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // eje X
      ctx.moveTo(MARGIN.left, oy);
      ctx.lineTo(PLOT_W - MARGIN.right, oy);
      // eje Y
      ctx.moveTo(ox, MARGIN.top);
      ctx.lineTo(ox, H - MARGIN.bottom);
      ctx.stroke();

      /* Etiquetas de ejes */
      ctx.fillStyle = '#475569';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('−300', MARGIN.left + 4, oy + 12);
      ctx.fillText('+300', PLOT_W - MARGIN.right - 4, oy + 12);
      ctx.fillStyle = '#34D399';
      ctx.fillText('GANANCIA', ox + 40, MARGIN.top + 10);
      ctx.fillStyle = '#EF4444';
      ctx.fillText('PÉRDIDA', ox - 40, MARGIN.top + 10);

      /* Curva de valor */
      ctx.beginPath();
      let started = false;
      for (let i = -240; i <= 240; i += 3) {
        const v = prospectValue(i, lam);
        const [cx2, cy2] = dataToCanvas(i, v, lam);
        if (!started) { ctx.moveTo(cx2, cy2); started = true; }
        else ctx.lineTo(cx2, cy2);
      }
      ctx.strokeStyle = '#D946EF';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      /* Punto de la propuesta actual y su imagen */
      const px = sim.proposalX;
      const vPos = prospectValue(px, lam);
      const vNeg = prospectValue(-px, lam);

      /* Punto ganancia */
      const [gx, gy] = dataToCanvas(px, vPos, lam);
      ctx.save();
      ctx.shadowColor = '#34D399'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(gx, gy, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#34D399'; ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#E2E8F0'; ctx.font = 'bold 11px ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillText(`+${px} → ${vPos.toFixed(1)}`, gx, gy - 12);

      /* Punto pérdida */
      const [lx, ly] = dataToCanvas(-px, vNeg, lam);
      ctx.save();
      ctx.shadowColor = '#EF4444'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(lx, ly, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#EF4444'; ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#E2E8F0'; ctx.font = 'bold 11px ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillText(`−${px} → ${vNeg.toFixed(1)}`, lx, ly + 18);

      /* Línea que muestra la asimetría */
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx, gy); ctx.lineTo(lx, ly);
      ctx.stroke();
      ctx.setLineDash([]);

      /* Etiqueta λ en el eje */
      ctx.fillStyle = '#D946EF';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`λ = ${lam.toFixed(2)}`, MARGIN.left + 6, MARGIN.top + 22);
      ctx.fillStyle = '#64748B';
      ctx.fillText('v(x) = xᵅ   |   v(−x) = −λ·xᵝ', MARGIN.left + 6, H - 10);

      /* Indicador dolor vs placer */
      const ratio = Math.abs(vNeg) / vPos;
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px ui-sans-serif, system-ui';
      if (ratio > 1.05) {
        ctx.fillStyle = '#EF4444';
        ctx.fillText(
          `perder ${px}$ duele ${ratio.toFixed(2)}× más que ganar ${px}$ da gusto`,
          PLOT_W / 2, H - 26
        );
      } else {
        ctx.fillStyle = '#34D399';
        ctx.fillText('con λ=1 el dolor y el placer son iguales — no es humano', PLOT_W / 2, H - 26);
      }

      /* Actualiza stats */
      if (frame % 8 === 0) {
        setStats({ vGain: vPos, vLoss: Math.abs(vNeg), ratio });
        setProposal(sim.proposalX);
      }
    }

    function loop() {
      /* Mueve partículas Smith */
      particlesRef.current.forEach(pt => {
        pt.price += pt.vy;
        pt.vy    += (200 - pt.price) * 0.003;   // fuerza restauradora → p*
        pt.vy    *= 0.97;                          // fricción
        pt.age++;
      });
      if (frame % 18 === 0) spawnParticle();

      drawValueCurve();
      drawSmithMarket();

      frame++;
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);

    /* Arrastre sobre el canvas */
    const onDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (W / rect.width);
      if (x < PLOT_W) simRef.current.dragging = true;
    };
    const onMove = (e: PointerEvent) => {
      if (!simRef.current.dragging) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (W / rect.width);
      // Mapea X del canvas a unidades de pesos (mitad derecha = ganancias)
      const ox = MARGIN.left + (PLOT_W - MARGIN.left - MARGIN.right) / 2;
      const xUnits = ((x - ox) / (PLOT_W - MARGIN.left - MARGIN.right)) * (2 * X_RANGE);
      const clamped = Math.max(10, Math.min(X_RANGE - 10, Math.abs(xUnits)));
      simRef.current.proposalX = Math.round(clamped);
    };
    const onUp = () => { simRef.current.dragging = false; };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  /* ── Texto de insight dinámico ─────────────────────────────────────────── */
  const insight =
    lambda <= 1.05
      ? 'Con λ=1 tu cerebro pesa igual ganar que perder. Eso sería un Homo economicus puro — y no existe.'
      : stats.ratio > 1.8
        ? `Perder ${proposal}$ te duele ${stats.ratio.toFixed(1)}× más que ganarlo te alegra. Por eso no sueltas la acción perdedora en bolsa: soltarla "cristaliza" el dolor. Kahneman lo llamó "aversión a la pérdida".`
        : `Con λ=${lambda.toFixed(1)}, el dolor de perder es ${stats.ratio.toFixed(1)}× el placer de ganar. Sube λ para ver el efecto completo — y entender por qué el crédito hipotecario que nadie debería cargar se carga igual.`;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

        {/* Canvas */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block touch-none cursor-ew-resize"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Stats rápidos */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="utilidad ganancia" value={`+${stats.vGain.toFixed(1)}`} accent="#34D399" />
            <Stat label="utilidad pérdida" value={`−${stats.vLoss.toFixed(1)}`} accent="#EF4444" />
            <Stat
              label="ratio dolor/placer"
              value={`${stats.ratio.toFixed(2)}×`}
              accent={stats.ratio > 1.8 ? '#EF4444' : stats.ratio > 1.1 ? '#FDB813' : '#34D399'}
            />
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#D946EF] font-mono mb-2">
              ✦ ¿Qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* Panel de controles */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Mueve los parámetros
          </div>

          <Slider
            label="Cantidad en juego"
            value={proposal}
            min={10}
            max={290}
            step={5}
            onChange={v => { setProposal(v); simRef.current.proposalX = v; }}
            fmt={v => `$${v}`}
            hint="Arrástralo en el canvas o mueve este slider. El punto verde es ganar eso; el rojo, perderlo."
          />

          <Slider
            label="Aversión a la pérdida λ"
            value={lambda}
            min={1.0}
            max={4.0}
            step={0.05}
            onChange={setLambda}
            fmt={v => v.toFixed(2)}
            hint="Kahneman midió λ≈2.25 en promedio. Sube hasta 4 para ver a alguien con pánico financiero."
          />

          {/* Escenarios rápidos */}
          <div className="space-y-2">
            <div className="text-[10px] text-[#64748B] uppercase tracking-[0.12em] font-mono">
              Presets rápidos
            </div>
            {[
              { label: 'Promedio humano', lam: 2.25, prop: 150 },
              { label: 'Homo economicus', lam: 1.0,  prop: 150 },
              { label: 'Pánico / deuda', lam: 3.8,  prop: 200 },
            ].map(({ label, lam: l, prop: p }) => (
              <button
                key={label}
                onClick={() => {
                  setLambda(l);
                  setProposal(p);
                  simRef.current.proposalX = p;
                }}
                className="w-full text-left px-3 py-1.5 text-[11px] font-mono rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#D946EF]/40 hover:text-[#D946EF] transition"
              >
                {label} — λ={l}
              </button>
            ))}
          </div>

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            v(x) = x^α (ganancias)<br />
            v(−x) = −λ·x^β (pérdidas)<br />
            α = β = 0.88, λ medido ≈ 2.25<br />
            Kahneman & Tversky 1992 · Nobel 2002
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Componentes auxiliares ─────────────────────────────────────────────── */
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
        <span className="text-[12px] font-mono text-[#FDB813]">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#D946EF]"
      />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}
