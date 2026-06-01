/**
 * SamuelsonTazon — laboratorio del premio 1970 (Paul Samuelson).
 *
 * El click: el precio justo no lo decide nadie. El mercado lo encuentra solo,
 * como una canica que rueda al fondo de un tazón. Samuelson formalizó la
 * ESTABILIDAD del equilibrio (Foundations, 1947): el precio se mueve según el
 * exceso de demanda, y converge al punto donde oferta = demanda.
 *
 * Física REAL y exacta:
 *   D(p) = aD − p        (demanda baja con el precio)
 *   S(p) = aS + p        (oferta sube con el precio)
 *   z(p) = D − S = (aD − aS) − 2p     ← exceso de demanda
 *   Dinámica de tâtonnement (Samuelson):  dp/dt ∝ z(p)
 *   Potencial:  V(p) = p² − (aD−aS)·p   → parábola con mínimo en p* = (aD−aS)/2
 *
 * La FUERZA sobre la canica es literalmente el exceso de demanda: F = −dV/dp = z(p).
 * Le ponemos masa + fricción para que ruede rico y se asiente en p*.
 *
 * Techo de precio (price ceiling): una pared que impide que el precio suba a su
 * nivel justo. La canica se queda atorada contra la pared → exceso de demanda
 * permanente → ESCASEZ. Eso son las colas de la gasolina subsidiada.
 */

import { useEffect, useRef, useState } from 'react';

const W = 820;
const H = 380;
const P_MAX = 10;
const STEP = 1 / 120;
const BALL_R = 13;

interface Params {
  demanda: number;   // 0..6 → aD = 8 + demanda
  oferta: number;    // 0..6 → aS = 1 + oferta
  ceilingOn: boolean;
  ceiling: number;   // precio tope
  paused: boolean;
}

const DEFAULTS: Params = { demanda: 3, oferta: 2, ceilingOn: false, ceiling: 2.5, paused: false };

interface Sim { p: number; vp: number; dragging: boolean; }

const aDof = (d: number) => 8 + d;
const aSof = (s: number) => 1 + s;
const pStarOf = (d: number, s: number) => (aDof(d) - aSof(s)) / 2;
const zOf = (p: number, d: number, s: number) => (aDof(d) - aSof(s)) - 2 * p;
const Vof = (p: number, d: number, s: number) => p * p - (aDof(d) - aSof(s)) * p;

const xOf = (p: number) => 48 + (p / P_MAX) * (W - 96);
const pOfX = (x: number) => Math.max(0, Math.min(P_MAX, ((x - 48) / (W - 96)) * P_MAX));

export default function SamuelsonTazon() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS });
  const simRef = useRef<Sim>({ p: P_MAX * 0.85, vp: 0, dragging: false });

  const [demanda, setDemanda] = useState(DEFAULTS.demanda);
  const [oferta, setOferta] = useState(DEFAULTS.oferta);
  const [ceilingOn, setCeilingOn] = useState(DEFAULTS.ceilingOn);
  const [ceiling, setCeiling] = useState(DEFAULTS.ceiling);
  const [paused, setPaused] = useState(DEFAULTS.paused);
  const [stats, setStats] = useState({ p: 0, pStar: 0, gap: 0 });

  useEffect(() => {
    paramsRef.current = { demanda, oferta, ceilingOn, ceiling, paused };
  }, [demanda, oferta, ceilingOn, ceiling, paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    let raf = 0, last = performance.now(), acc = 0, frame = 0;

    function step(h: number) {
      const p = paramsRef.current;
      const sim = simRef.current;
      if (sim.dragging) { sim.vp = 0; return; }
      const F = zOf(sim.p, p.demanda, p.oferta) * 6;   // fuerza = exceso de demanda
      sim.vp += F * h;
      sim.vp *= (1 - 2.2 * h);                          // fricción → se asienta
      sim.p += sim.vp * h;
      if (sim.p < 0) { sim.p = 0; sim.vp = 0; }
      if (sim.p > P_MAX) { sim.p = P_MAX; sim.vp = 0; }
      if (p.ceilingOn && sim.p > p.ceiling) { sim.p = p.ceiling; if (sim.vp > 0) sim.vp = 0; }
    }

    function bowlY(p: number, d: number, s: number) {
      // Normaliza V sobre [0,P_MAX] a una franja vertical (tazón).
      const yTop = 70, yBot = H - 86;
      let vmin = Infinity, vmax = -Infinity;
      for (let i = 0; i <= 40; i++) {
        const pp = (i / 40) * P_MAX;
        const v = Vof(pp, d, s);
        if (v < vmin) vmin = v;
        if (v > vmax) vmax = v;
      }
      const t = (Vof(p, d, s) - vmin) / Math.max(1e-6, vmax - vmin);
      return yTop + t * (yBot - yTop);
    }

    function draw() {
      if (!ctx) return;
      const p = paramsRef.current;
      const sim = simRef.current;
      const d = p.demanda, s = p.oferta;
      const pStar = pStarOf(d, s);

      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17'); bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Tazón (la curva del potencial).
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const pp = (i / 120) * P_MAX;
        const x = xOf(pp), y = bowlY(pp, d, s);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
      // relleno suave bajo el tazón
      ctx.lineTo(xOf(P_MAX), H - 40); ctx.lineTo(xOf(0), H - 40); ctx.closePath();
      ctx.fillStyle = 'rgba(79,195,247,0.05)'; ctx.fill();

      // Línea del precio justo (fondo del tazón).
      const sxStar = xOf(pStar);
      ctx.strokeStyle = '#4FC3F7'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(sxStar, 60); ctx.lineTo(sxStar, H - 40); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#4FC3F7'; ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillText('precio justo', sxStar, 52);

      // Pared del techo de precio.
      if (p.ceilingOn) {
        const cx = xOf(p.ceiling);
        ctx.fillStyle = 'rgba(239,68,68,0.10)';
        ctx.fillRect(cx, 60, W - 48 - cx, H - 100);   // zona prohibida (precio > techo)
        ctx.strokeStyle = '#EF4444'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cx, 56); ctx.lineTo(cx, H - 40); ctx.stroke();
        ctx.fillStyle = '#EF4444'; ctx.font = 'bold 11px ui-monospace, monospace'; ctx.textAlign = 'left';
        ctx.fillText('TECHO DE PRECIO', cx + 6, 70);
      }

      // La canica.
      const bx = xOf(sim.p), by = bowlY(sim.p, d, s) - BALL_R;
      ctx.save();
      ctx.shadowColor = '#FDB813'; ctx.shadowBlur = 16;
      const grad = ctx.createRadialGradient(bx - 4, by - 4, 2, bx, by, BALL_R);
      grad.addColorStop(0, '#FEF3C7'); grad.addColorStop(1, '#F59E0B');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(bx, by, BALL_R, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#E2E8F0'; ctx.font = 'bold 12px ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillText(`$${sim.p.toFixed(1)}`, bx, by - BALL_R - 6);

      // Escasez / excedente al precio actual.
      const z = zOf(sim.p, d, s);
      ctx.textAlign = 'center'; ctx.font = 'bold 13px ui-sans-serif, system-ui';
      if (Math.abs(z) > 0.15) {
        if (z > 0) {
          ctx.fillStyle = '#EF4444';
          ctx.fillText(`▼ ESCASEZ: faltan ${z.toFixed(1)} — las colas`, W / 2, H - 16);
        } else {
          ctx.fillStyle = '#FB923C';
          ctx.fillText(`▲ EXCEDENTE: sobran ${(-z).toFixed(1)} — se queda en bodega`, W / 2, H - 16);
        }
      } else {
        ctx.fillStyle = '#34D399';
        ctx.fillText('✓ equilibrio: oferta = demanda', W / 2, H - 16);
      }

      if (p.paused) {
        ctx.fillStyle = 'rgba(5,6,10,0.4)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#E2E8F0'; ctx.font = 'bold 16px ui-sans-serif, system-ui'; ctx.textAlign = 'center';
        ctx.fillText('⏸ en pausa', W / 2, H / 2);
      }

      if (frame % 10 === 0) setStats({ p: sim.p, pStar, gap: z });
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!paramsRef.current.paused) { acc += dt; while (acc >= STEP) { step(STEP); acc -= STEP; } }
      draw(); frame++; raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    // Arrastre de la canica.
    const setFromEvent = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (W / rect.width);
      simRef.current.p = pOfX(x);
      simRef.current.vp = 0;
    };
    const onDown = (e: PointerEvent) => { simRef.current.dragging = true; setFromEvent(e); };
    const onMove = (e: PointerEvent) => { if (simRef.current.dragging) setFromEvent(e); };
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

  const insight = ceilingOn && stats.gap > 0.2
    ? 'Pusiste el techo abajo del precio justo. La canica no puede llegar al fondo → faltan cosas. Esto, literal, son las colas de la gasolina subsidiada y la escasez de renta controlada.'
    : Math.abs(stats.gap) < 0.2
      ? 'La canica está en el fondo: oferta = demanda. Nadie puso ese punto. El mercado lo encontró solo, como el agua su nivel.'
      : 'Arrastra la canica del precio y suéltala. Mira cómo rueda sola hacia el fondo — ese fondo es el precio donde oferta y demanda se cruzan.';

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas ref={canvasRef} className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block touch-none cursor-grab"
                    style={{ width: W, height: H }} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setPaused(v => !v)}
                    className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7] hover:bg-[#4FC3F7]/20 transition">
              {paused ? '▶ reanudar' : '⏸ pausa'}
            </button>
            <button onClick={() => { simRef.current.p = P_MAX * 0.9; simRef.current.vp = 0; }}
                    className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#FDB813]/40 bg-[#FDB813]/10 text-[#FDB813] hover:bg-[#FDB813]/20 transition">
              🫳 suéltala arriba
            </button>
            <button onClick={() => setCeilingOn(v => !v)}
                    className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                      ceilingOn ? 'border-[#EF4444]/50 bg-[#EF4444]/10 text-[#EF4444]' : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'}`}>
              {ceilingOn ? '🧱 techo: ON' : '○ techo de precio'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Stat label="precio ahora" value={`$${stats.p.toFixed(1)}`} accent="#FDB813" />
            <Stat label="precio justo" value={`$${stats.pStar.toFixed(1)}`} accent="#4FC3F7" />
            <Stat label="escasez/excedente" value={stats.gap > 0.15 ? `−${stats.gap.toFixed(1)}` : stats.gap < -0.15 ? `+${(-stats.gap).toFixed(1)}` : '0'}
                  accent={Math.abs(stats.gap) > 0.15 ? '#EF4444' : '#34D399'} />
          </div>

          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">✦ ¿Qué estás viendo?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ Mueve el mercado</div>
          <Slider label="Cuánta gente lo quiere" value={demanda} min={0} max={6} step={0.1} onChange={setDemanda}
                  fmt={v => v < 2 ? 'poca' : v < 4 ? 'normal' : 'mucha'} hint="Más demanda empuja el precio justo hacia arriba." />
          <Slider label="Cuánto hay en el mercado" value={oferta} min={0} max={6} step={0.1} onChange={setOferta}
                  fmt={v => v < 2 ? 'escaso' : v < 4 ? 'normal' : 'abundante'} hint="Más oferta empuja el precio justo hacia abajo." />
          {ceilingOn && (
            <Slider label="Dónde pones el techo" value={ceiling} min={0.5} max={P_MAX - 0.5} step={0.1} onChange={setCeiling}
                    fmt={v => `$${v.toFixed(1)}`} hint="Si lo pones abajo del precio justo: escasez. Es lo que hace un control de precios." />
          )}
          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo: dp/dt ∝ exceso de demanda<br />(Samuelson, Foundations 1947 · estabilidad)
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

function Slider({ label, value, min, max, step, onChange, fmt, hint }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[12px] font-mono text-[#FDB813]">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={e => onChange(Number(e.target.value))} className="w-full accent-[#4FC3F7]" />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}
