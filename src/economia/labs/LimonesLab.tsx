/**
 * LimonesLab — laboratorio del premio 2001 (Akerlof, Spence, Stiglitz).
 *
 * El click: cuando el comprador no sabe la calidad de lo que compra, paga el
 * PROMEDIO esperado. Ese precio es demasiado bajo para los dueños de carros
 * buenos → se van. Quedan más limones → el comprador baja su oferta → se van
 * más buenos → al final solo quedan limones. El mercado muere solo.
 *
 * Modelo REAL (Akerlof 1970):
 *   - N carros en el mercado, calidad q_i ~ U[0, q_max] (distribución uniforme).
 *   - Comprador ofrece precio P = E[q | q_i ≤ q_umbral] × ratio_buyer
 *     donde ratio_buyer > 1 (comprador quiere ganancia marginal).
 *   - Vendedor acepta si P ≥ q_i × ratio_seller (valor mínimo del dueño).
 *   - Equilibrio: q_umbral* tal que P(q_umbral*) = q_umbral* × ratio_seller.
 *     → q* = (ratio_buyer / (2 × ratio_seller - ratio_buyer)) × q_max (aprox.)
 *   - Si ratio_buyer < 2 × ratio_seller, el mercado colapsa completamente.
 *
 * Dinámica (lo que el usuario ve):
 *   Iteración de tâtonnement: q_umbral avanza hacia donde oferta = precio aceptable.
 *   Cada paso los carros con q > umbral actual salen; el precio se recalcula.
 *   La animación muestra las partículas-carro coloreadas por calidad, saliendo en rojo.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const W = 820;
const H = 380;
const N_CARROS = 80;          // carros iniciales en el mercado
const BALL_R = 7;
const STEP = 1 / 60;
const Q_MAX = 100;             // calidad máxima posible (100 = perfecto)

// ─── tipos ──────────────────────────────────────────────────────────────────

interface Carro {
  id: number;
  q: number;                   // calidad real 0..Q_MAX
  x: number;                   // posición canvas X
  y: number;                   // posición canvas Y
  vx: number;
  vy: number;
  estado: 'en-mercado' | 'saliendo' | 'fuera';
  alpha: number;               // opacidad 0..1
}

interface SimState {
  carros: Carro[];
  umbral: number;              // calidad máxima que acepta el precio actual
  precio: number;              // precio ofertado por compradores
  iteracion: number;
  colapso: boolean;
  running: boolean;
  velocidad: number;           // pasos por frame
}

interface Params {
  ratioBuyer: number;          // cuánto valora el comprador (>1 = valor extra)
  ratioSeller: number;         // cuánto pide el vendedor (>1 = costo oportunidad)
  infoLevel: number;           // 0=asimetría total, 1=info perfecta
  paused: boolean;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function calcPrecio(carros: Carro[], umbral: number, ratioBuyer: number, infoLevel: number): number {
  // Con información perfecta (infoLevel=1): el comprador paga q_i × ratioBuyer
  // Con asimetría total (infoLevel=0): paga E[q | q <= umbral] × ratioBuyer
  const activos = carros.filter(c => c.estado === 'en-mercado' && c.q <= umbral + 0.001);
  if (activos.length === 0) return 0;

  // Información mixta: precio = mezcla entre promedio y valor real promedio
  const qProm = activos.reduce((s, c) => s + c.q, 0) / activos.length;
  // Con info perfecta, el umbral es Q_MAX (todos se venden a su precio)
  const qEfectivo = infoLevel * Q_MAX + (1 - infoLevel) * qProm;
  return qEfectivo * ratioBuyer;
}

function nuevosMercado(velocidad: number): Carro[] {
  const arr: Carro[] = [];
  for (let i = 0; i < N_CARROS; i++) {
    arr.push({
      id: i,
      q: Math.random() * Q_MAX,
      x: 60 + Math.random() * (W - 120),
      y: 60 + Math.random() * (H - 120),
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      estado: 'en-mercado',
      alpha: 1,
    });
    void velocidad; // suppress unused
  }
  return arr;
}

function colorDeCalidad(q: number, alpha: number = 1): string {
  // Verde brillante = buena calidad, naranja/rojo = limón
  const t = q / Q_MAX;
  if (t > 0.6) {
    const r = Math.round(52 + (1 - t) * 160);
    const g = Math.round(211 - (1 - t) * 60);
    const b = Math.round(52);
    return `rgba(${r},${g},${b},${alpha})`;
  } else {
    const r = Math.round(239);
    const g = Math.round(68 + t * 120);
    const b = Math.round(68);
    return `rgba(${r},${g},${b},${alpha})`;
  }
}

// ─── componente principal ────────────────────────────────────────────────────

const DEFAULTS: Params = {
  ratioBuyer: 1.5,
  ratioSeller: 1.2,
  infoLevel: 0,
  paused: false,
};

export default function LimonesLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS });
  const simRef = useRef<SimState>({
    carros: nuevosMercado(1),
    umbral: Q_MAX,
    precio: 0,
    iteracion: 0,
    colapso: false,
    running: false,
    velocidad: 1,
  });

  const [ratioBuyer, setRatioBuyer] = useState(DEFAULTS.ratioBuyer);
  const [ratioSeller, setRatioSeller] = useState(DEFAULTS.ratioSeller);
  const [infoLevel, setInfoLevel] = useState(DEFAULTS.infoLevel);
  const [paused, setPaused] = useState(DEFAULTS.paused);
  const [stats, setStats] = useState({
    enMercado: N_CARROS,
    umbral: Q_MAX,
    precio: 0,
    qPromedio: 0,
    colapso: false,
    iteracion: 0,
  });

  // Sincronizar params en ref para el loop
  useEffect(() => {
    paramsRef.current = { ratioBuyer, ratioSeller, infoLevel, paused };
  }, [ratioBuyer, ratioSeller, infoLevel, paused]);

  const resetSim = useCallback(() => {
    const cs = nuevosMercado(1);
    simRef.current = {
      carros: cs,
      umbral: Q_MAX,
      precio: calcPrecio(cs, Q_MAX, paramsRef.current.ratioBuyer, paramsRef.current.infoLevel),
      iteracion: 0,
      colapso: false,
      running: false,
      velocidad: 1,
    };
  }, []);

  const iniciarEspiral = useCallback(() => {
    simRef.current.running = true;
  }, []);

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
    let acc = 0;
    let last = performance.now();
    let subframe = 0;

    // ── lógica de un paso del modelo ──────────────────────────────────────
    function stepSim() {
      const sim = simRef.current;
      const p = paramsRef.current;
      if (!sim.running || sim.colapso) return;

      // Calcular precio ofrecido dado el umbral actual
      const precio = calcPrecio(sim.carros, sim.umbral, p.ratioBuyer, p.infoLevel);
      sim.precio = precio;

      // Nuevo umbral: vendedores aceptan si precio >= q × ratioSeller
      // → q <= precio / ratioSeller
      const nuevoUmbral = precio / p.ratioSeller;

      // Marcar para salir: carros buenos que ya no aceptan el precio
      for (const c of sim.carros) {
        if (c.estado === 'en-mercado' && c.q > nuevoUmbral + 0.5) {
          c.estado = 'saliendo';
        }
      }

      sim.umbral = Math.max(0, nuevoUmbral);
      sim.iteracion++;

      // Colapso si quedan muy pocos o umbral cerca de cero
      const enMercado = sim.carros.filter(c => c.estado === 'en-mercado').length;
      if (sim.umbral < 1 || enMercado === 0) {
        sim.colapso = true;
        sim.running = false;
      }
    }

    // ── animación de partículas ───────────────────────────────────────────
    function actualizarParticulas() {
      for (const c of simRef.current.carros) {
        if (c.estado === 'en-mercado') {
          // Deriva suave dentro del canvas
          c.x += c.vx;
          c.y += c.vy;
          if (c.x < BALL_R + 40) { c.x = BALL_R + 40; c.vx *= -1; }
          if (c.x > W - BALL_R - 40) { c.x = W - BALL_R - 40; c.vx *= -1; }
          if (c.y < BALL_R + 40) { c.y = BALL_R + 40; c.vy *= -1; }
          if (c.y > H - BALL_R - 80) { c.y = H - BALL_R - 80; c.vy *= -1; }
        } else if (c.estado === 'saliendo') {
          // Fluir hacia la derecha y desaparecer
          c.x += 3.5;
          c.vy += 0.1;
          c.y += c.vy;
          c.alpha = Math.max(0, c.alpha - 0.03);
          if (c.alpha <= 0) c.estado = 'fuera';
        }
      }
    }

    // ── dibujo ────────────────────────────────────────────────────────────
    function draw() {
      if (!ctx) return;
      const sim = simRef.current;
      const p = paramsRef.current;

      // Fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#05060A');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── panel de calidad (barra de distribución) ──
      const barW = 200;
      const barH = 12;
      const barX = W - barW - 20;
      const barY = 20;
      // gradiente de calidad
      const gBar = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      gBar.addColorStop(0, '#EF4444');
      gBar.addColorStop(0.5, '#FB923C');
      gBar.addColorStop(1, '#34D399');
      ctx.fillStyle = 'rgba(15,23,42,0.7)';
      ctx.roundRect(barX - 4, barY - 4, barW + 8, barH + 22, 4);
      ctx.fill();
      ctx.fillStyle = gBar;
      ctx.roundRect(barX, barY, barW, barH, 3);
      ctx.fill();

      // línea del umbral en la barra
      const umbralX = barX + (sim.umbral / Q_MAX) * barW;
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(umbralX, barY - 2);
      ctx.lineTo(umbralX, barY + barH + 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#F59E0B';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`umbral q=${sim.umbral.toFixed(0)}`, umbralX, barY + barH + 14);

      // etiquetas barra
      ctx.fillStyle = '#475569';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('limón', barX, barY + barH + 14);
      ctx.textAlign = 'right';
      ctx.fillText('perfecto', barX + barW, barY + barH + 14);

      // ── zona de "salida" (derecha) ──
      ctx.fillStyle = 'rgba(239,68,68,0.04)';
      ctx.fillRect(W - 44, 0, 44, H);
      ctx.strokeStyle = 'rgba(239,68,68,0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(W - 44, 0);
      ctx.lineTo(W - 44, H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.save();
      ctx.translate(W - 28, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = 'rgba(239,68,68,0.5)';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BUENOS SE VAN →', 0, 0);
      ctx.restore();

      // ── partículas ──
      const enMercado = sim.carros.filter(c => c.estado === 'en-mercado');
      const saliendo = sim.carros.filter(c => c.estado === 'saliendo');

      // Mostrar partículas que salen (con efecto de info limitada o no)
      for (const c of [...enMercado, ...saliendo]) {
        if (c.alpha <= 0) continue;
        const alpha = c.estado === 'saliendo' ? c.alpha : 1;

        // Con info asimétrica (infoLevel=0) los compradores ven carros grises (no saben la calidad)
        // Con info perfecta (infoLevel=1) ven el color real
        const colorVisible = p.infoLevel > 0.5
          ? colorDeCalidad(c.q, alpha)
          : c.q > sim.umbral
            ? colorDeCalidad(c.q, alpha)       // los que se van: se revelan
            : `rgba(148,163,184,${alpha * 0.7})`; // los que quedan: grises (no los ves)

        ctx.save();
        ctx.shadowColor = colorDeCalidad(c.q, 0.6);
        ctx.shadowBlur = c.estado === 'saliendo' ? 8 : 5;
        ctx.fillStyle = colorVisible;
        ctx.beginPath();
        ctx.arc(c.x, c.y, BALL_R, 0, Math.PI * 2);
        ctx.fill();

        // Mini ícono de carro
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.6})`;
        ctx.font = `${BALL_R}px ui-sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚗', c.x, c.y);
        ctx.restore();
      }

      // ── etiqueta de precio ──
      const precioY = H - 55;
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px ui-monospace, monospace';
      if (sim.colapso) {
        ctx.fillStyle = '#EF4444';
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 12;
        ctx.fillText('⚠ MERCADO COLAPSADO — solo quedan limones', W / 2, precioY);
        ctx.shadowBlur = 0;
      } else if (!sim.running && sim.iteracion === 0) {
        ctx.fillStyle = '#64748B';
        ctx.fillText('Presiona ▶ INICIAR ESPIRAL para ver el mercado de limones en acción', W / 2, precioY);
      } else if (sim.running || sim.iteracion > 0) {
        const enM = enMercado.length;
        const qProm = enM > 0 ? enMercado.reduce((s, c) => s + c.q, 0) / enM : 0;
        ctx.fillStyle = '#94A3B8';
        ctx.font = '12px ui-monospace, monospace';
        ctx.fillText(
          `Ronda ${sim.iteracion} · ${enM} carros · precio ofrecido: $${sim.precio.toFixed(1)} · calidad prom: ${qProm.toFixed(1)}`,
          W / 2, precioY,
        );
      }

      // ── info-level indicator ──
      const infoText = p.infoLevel < 0.2
        ? '🙈 compradores ciegos (asimetría total)'
        : p.infoLevel > 0.8
          ? '👁 info perfecta (no hay limones posibles)'
          : `👀 info parcial (${Math.round(p.infoLevel * 100)}%)`;
      ctx.textAlign = 'left';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillStyle = '#475569';
      ctx.fillText(infoText, 20, H - 12);

      // ── pausa overlay ──
      if (p.paused) {
        ctx.fillStyle = 'rgba(5,6,10,0.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 16px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⏸ en pausa', W / 2, H / 2);
      }

      // Actualizar stats para React (cada 6 frames)
      if (subframe % 6 === 0) {
        const enM2 = sim.carros.filter(c => c.estado === 'en-mercado');
        const qP = enM2.length > 0 ? enM2.reduce((s, c) => s + c.q, 0) / enM2.length : 0;
        setStats({
          enMercado: enM2.length,
          umbral: sim.umbral,
          precio: sim.precio,
          qPromedio: qP,
          colapso: sim.colapso,
          iteracion: sim.iteracion,
        });
      }
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!paramsRef.current.paused) {
        acc += dt;
        while (acc >= STEP) {
          actualizarParticulas();
          // El modelo económico avanza más lento (cada ~1.5s)
          if (subframe % 90 === 0) stepSim();
          acc -= STEP;
          subframe++;
        }
      }

      draw();
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  // Insight dinámico basado en el estado
  const insight = stats.colapso
    ? 'El mercado colapsó solo. Nadie lo planeó. Los vendedores buenos fueron saliendo uno a uno y al final solo quedaron limones. Eso es exactamente lo que Akerlof demostró en 1970.'
    : stats.iteracion === 0
      ? 'Los puntos grises son carros que el comprador no puede evaluar (asimetría de información). Los verdes son buenos, los rojos son limones — pero el comprador no lo sabe. Presiona ▶ para ver qué pasa.'
      : stats.umbral < Q_MAX * 0.3
        ? `Calidad promedio: ${stats.qPromedio.toFixed(0)}/100. Ya casi solo quedan limones — los buenos se fueron porque el precio no los vale.`
        : `Ronda ${stats.iteracion}: precio ofrecido $${stats.precio.toFixed(1)}. Los carros con calidad > ${stats.umbral.toFixed(0)} prefieren no vender. El mercado se estrecha.`;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* ── canvas ── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* controles de acción */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={iniciarEspiral}
              disabled={simRef.current.running || stats.colapso}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399] hover:bg-[#34D399]/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ▶ iniciar espiral
            </button>
            <button
              onClick={() => { resetSim(); setStats({ enMercado: N_CARROS, umbral: Q_MAX, precio: 0, qPromedio: Q_MAX / 2, colapso: false, iteracion: 0 }); }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/20 transition"
            >
              ↺ nuevo mercado
            </button>
            <button
              onClick={() => setPaused(v => !v)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7] hover:bg-[#4FC3F7]/20 transition"
            >
              {paused ? '▶ reanudar' : '⏸ pausa'}
            </button>
          </div>

          {/* stats */}
          <div className="grid grid-cols-4 gap-3">
            <Stat label="en mercado" value={`${stats.enMercado}`} accent="#4FC3F7" />
            <Stat label="calidad prom" value={`${stats.qPromedio.toFixed(0)}/100`}
              accent={stats.qPromedio > 60 ? '#34D399' : stats.qPromedio > 30 ? '#FB923C' : '#EF4444'} />
            <Stat label="precio ofrecido" value={`$${stats.precio.toFixed(1)}`} accent="#FDB813" />
            <Stat label="umbral aceptable" value={`q≤${stats.umbral.toFixed(0)}`}
              accent={stats.colapso ? '#EF4444' : '#94A3B8'} />
          </div>

          {/* insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#F472B6] font-mono mb-2">✦ ¿Qué estás viendo?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── panel de parámetros ── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ Ajusta el mercado</div>

          <Slider
            label="Cuánto vale el carro para el comprador"
            value={ratioBuyer}
            min={1.0}
            max={2.5}
            step={0.05}
            onChange={setRatioBuyer}
            fmt={v => v < 1.3 ? 'poco interés' : v < 1.8 ? 'interés normal' : 'muy interesado'}
            hint="Más alto = el comprador valora más el carro. Si baja demasiado, nadie quiere comprar."
          />

          <Slider
            label="Costo de oportunidad del vendedor"
            value={ratioSeller}
            min={1.0}
            max={2.0}
            step={0.05}
            onChange={setRatioSeller}
            fmt={v => v < 1.2 ? 'flexible' : v < 1.6 ? 'exigente' : 'muy exigente'}
            hint="Más alto = el dueño de un buen carro necesita un precio más alto para ceder."
          />

          <Slider
            label="Información del comprador"
            value={infoLevel}
            min={0}
            max={1}
            step={0.05}
            onChange={setInfoLevel}
            fmt={v => v < 0.2 ? 'ciego total' : v < 0.5 ? 'sospecha algo' : v < 0.8 ? 'sabe bastante' : 'info perfecta'}
            hint="Con info perfecta no hay limones: cada carro se vende a su precio real. El drama está en la oscuridad."
          />

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo: selección adversa<br />
            Akerlof, QJE (1970) · umbral q* = rB·q_max / (2·rS)<br />
            colapso cuando rB &lt; 2·rS<br />
            Premio Nobel 2001 compartido con Spence y Stiglitz
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── sub-componentes ──────────────────────────────────────────────────────────

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
        className="w-full accent-[#F472B6]"
      />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}
