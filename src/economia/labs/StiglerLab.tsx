/**
 * StiglerLab — laboratorio del premio 1982 (George Stigler).
 *
 * El click: el regulador que te protege trabaja para la industria que regula.
 * No es corrupción accidental — es el equilibrio de un mercado político.
 *
 * Modelo de captura regulatoria (Stigler, 1971):
 *   - Las industrias DEMANDAN regulación como producto: barreras de entrada,
 *     subsidios, precios mínimos. La demanda es función del beneficio esperado.
 *   - Los políticos/reguladores OFRECEN regulación a cambio de votos, dinero
 *     de campaña y empleos futuros (puerta giratoria).
 *   - El equilibrio: captura λ ∈ [0, 1], donde λ=0 es regulador independiente
 *     y λ=1 es regulador completamente capturado.
 *
 * Fórmulas del mercado regulado:
 *   P(λ)  = P_c + λ·(P_m − P_c)          [precio entre competitivo y monopolio]
 *   n(λ)  = 1 + round((n_max−1)·(1−λ))   [número de empresas activas]
 *   Q(P)  = Q_max·(1 − P/P_max)           [demanda lineal]
 *   CS(λ) = ½·(P_max − P)·Q              [excedente del consumidor]
 *   π(λ)  = (P − MC)·Q                   [ganancia del monopolio]
 *   DWL(λ)= ½·(P−P_c)·(Q_c−Q)           [pérdida irrecuperable de bienestar]
 *
 *   Presupuesto de lobbying: L = π(λ)·α  (fracción α de la ganancia monopolista)
 *   Captura de equilibrio:   λ* = L / (L + S)  (Stigler: la captura depende
 *                            de lobbying relativo vs. independencia del regulador S)
 *
 * La animación muestra flujo de dinero (lobby→regulador), precio subiendo,
 * competidores saliendo del mercado, y welfare del ciudadano cayendo.
 */

import { useEffect, useRef, useState } from 'react';

/* ─────────────── constantes de layout ─────────────── */
const W = 820;
const H = 380;

/* Parámetros de mercado base */
const P_MAX  = 100;   // precio máximo de reserva (demanda cero arriba de esto)
const MC     = 20;    // costo marginal (precio competitivo)
const Q_MAX  = 1000;  // cantidad máxima demandada (precio = 0)
const N_MAX  = 8;     // número de empresas sin captura

/* Colores */
const CLR_INDUSTRY  = '#EF4444';   // rojo — industria (monopolista)
const CLR_REGULATOR = '#FDB813';   // ámbar — regulador
const CLR_CITIZEN   = '#4FC3F7';   // azul — ciudadano / consumidor
const CLR_LOBBY     = '#F97316';   // naranja — flujo de lobbying
const BG = '#0B0F17';

/* ─────────────── modelo económico ─────────────── */
function priceAt(lambda: number): number {
  // P_monopolio Cournot: (P_max + MC*(n+1)) / 2  con n=1 en monopolio total
  // vs precio competitivo MC
  const P_m = (P_MAX + MC) / 2;   // monopolio puro (n=1 en Cournot)
  return MC + lambda * (P_m - MC);
}

function quantityAt(price: number): number {
  return Math.max(0, Q_MAX * (1 - price / P_MAX));
}

function firmsAt(lambda: number): number {
  // n decrece con la captura: barreras de entrada expulsan competidores
  return Math.max(1, Math.round(1 + (N_MAX - 1) * (1 - lambda)));
}

function consumerSurplus(lambda: number): number {
  const P  = priceAt(lambda);
  const Q  = quantityAt(P);
  // CS = ½ × (P_max − P) × Q  (demanda lineal)
  return 0.5 * (P_MAX - P) * Q;
}

function industryProfit(lambda: number): number {
  const P = priceAt(lambda);
  const Q = quantityAt(P);
  return (P - MC) * Q;
}

function deadweightLoss(lambda: number): number {
  const P   = priceAt(lambda);
  const Q   = quantityAt(P);
  const Q_c = quantityAt(MC);   // cantidad competitiva
  return 0.5 * (P - MC) * (Q_c - Q);
}

/**
 * Captura de equilibrio de Stigler:
 *   λ* = lobbying / (lobbying + independencia_del_regulador)
 *
 * lobbying = fracción alpha del beneficio monopolista
 * independencia = salario_real × rotación (más sueldo y más rotación → menos captura)
 */
function equilibriumCapture(alpha: number, salary: number): number {
  // Buscamos el punto fijo λ* tal que λ = L(λ) / (L(λ) + S)
  // donde L(λ) = alpha × π(λ)  y  S = salary
  // Iteramos 50 veces — converge rápido
  let lam = 0.5;
  for (let i = 0; i < 60; i++) {
    const lobbying = alpha * industryProfit(lam);
    lam = lobbying / (lobbying + salary);
  }
  return Math.max(0, Math.min(1, lam));
}

/* ─────────────── sub-componentes UI ─────────────── */
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3 min-w-0">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1 truncate">{label}</div>
      <div className="text-[18px] font-bold font-mono leading-tight" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange, fmt, hint, accent = '#4FC3F7' }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string; hint?: string; accent?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[12px] font-mono" style={{ color: accent }}>{fmt ? fmt(value) : value.toFixed(1)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={e => onChange(Number(e.target.value))} className="w-full accent-[#EF4444]" />
      {hint && <div className="text-[10px] text-[#475569] leading-snug">{hint}</div>}
    </div>
  );
}

/* ─────────────── estado de simulación para el canvas ─────────────── */
interface SimState {
  lambda: number;         // captura actual (animada hacia target)
  lobbyParticles: Array<{
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    size: number;
  }>;
  frame: number;
}

interface CanvasParams {
  alpha: number;          // fracción de lobbying
  salary: number;         // independencia del regulador
  manualOverride: boolean;
  manualLambda: number;
}

/* ─────────────── componente principal ─────────────── */
export default function StiglerLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* parámetros controlados */
  const [alpha, setAlpha]   = useState(0.15);    // fracción de lobbying (0–0.4)
  const [salary, setSalary] = useState(3000);     // independencia regulatoria (1k–10k)
  const [manual, setManual] = useState(false);    // modo manual de captura
  const [manualLam, setManualLam] = useState(0.5);

  const paramsRef = useRef<CanvasParams>({ alpha, salary, manualOverride: manual, manualLambda: manualLam });
  useEffect(() => {
    paramsRef.current = { alpha, salary, manualOverride: manual, manualLambda: manualLam };
  }, [alpha, salary, manual, manualLam]);

  /* stats expuestos desde el canvas */
  const [stats, setStats] = useState({
    lambda: 0,
    price: MC,
    firms: N_MAX,
    cs: consumerSurplus(0),
    profit: industryProfit(0),
    dwl: deadweightLoss(0),
  });

  /* canvas rAF */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctxRaw = canvas.getContext('2d');
    if (!ctxRaw) return;
    const ctx: CanvasRenderingContext2D = ctxRaw;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    const sim: SimState = {
      lambda: 0.2,
      lobbyParticles: [],
      frame: 0,
    };

    /* ── posiciones de actores en el canvas ── */
    // Izquierda: industria (empresa)
    const IND_X = 120;
    const IND_Y = H / 2;
    // Centro: regulador
    const REG_X = W / 2;
    const REG_Y = 90;
    // Derecha abajo: ciudadano
    const CIT_X = W - 120;
    const CIT_Y = H / 2;

    /* ── spawn de partículas de lobbying ── */
    function spawnLobbyParticle() {
      const angle = Math.random() * Math.PI * 0.5 - Math.PI * 0.25;
      const speed = 1.2 + Math.random() * 1.0;
      const dx = REG_X - IND_X;
      const dy = REG_Y - IND_Y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      sim.lobbyParticles.push({
        x: IND_X + (Math.random() - 0.5) * 20,
        y: IND_Y + (Math.random() - 0.5) * 20,
        vx: (dx / dist) * speed + Math.cos(angle) * 0.3,
        vy: (dy / dist) * speed + Math.sin(angle) * 0.3,
        life: 0,
        maxLife: dist / speed,
        size: 2 + Math.random() * 2.5,
      });
    }

    /* ── helpers de dibujo ── */
    function drawCircleActor(
      x: number, y: number, r: number,
      color: string, label: string, sublabel: string,
      glowIntensity: number
    ) {
      ctx.save();
      // glow
      if (glowIntensity > 0) {
        ctx.shadowColor = color;
        ctx.shadowBlur  = 18 * glowIntensity;
      }
      // círculo
      const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      grad.addColorStop(0, colorMix(color, '#ffffff', 0.25));
      grad.addColorStop(1, colorMix(color, '#000000', 0.4));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // borde
      ctx.strokeStyle = colorAlpha(color, 0.6);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // etiquetas
      ctx.fillStyle = '#E2E8F0';
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - r - 8);
      ctx.fillStyle = colorAlpha(color, 0.8);
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(sublabel, x, y - r - 22);
    }

    function colorMix(hex: string, with_: string, t: number): string {
      const parse = (h: string) => {
        const n = parseInt(h.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      };
      const [r1, g1, b1] = parse(hex);
      const [r2, g2, b2] = parse(with_);
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      return `rgb(${r},${g},${b})`;
    }

    function colorAlpha(hex: string, a: number): string {
      const n = parseInt(hex.slice(1), 16);
      const r = (n >> 16) & 255;
      const g = (n >> 8) & 255;
      const b = n & 255;
      return `rgba(${r},${g},${b},${a})`;
    }

    function drawBar(
      x: number, y: number, w: number, h: number,
      value: number, maxVal: number,
      color: string, label: string, valLabel: string
    ) {
      // fondo
      ctx.fillStyle = 'rgba(30,41,59,0.5)';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 4);
      ctx.fill();
      // barra
      const fillH = Math.max(0, (value / maxVal) * h);
      if (fillH > 0) {
        const grad = ctx.createLinearGradient(x, y + h - fillH, x, y + h);
        grad.addColorStop(0, colorAlpha(color, 0.9));
        grad.addColorStop(1, colorAlpha(color, 0.3));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y + h - fillH, w, fillH, 4);
        ctx.fill();
      }
      // borde
      ctx.strokeStyle = colorAlpha(color, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 4);
      ctx.stroke();
      // etiqueta inferior
      ctx.fillStyle = '#64748B';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + w / 2, y + h + 13);
      // valor arriba
      ctx.fillStyle = color;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.fillText(valLabel, x + w / 2, y - 4);
    }

    function wrapText(text: string, x: number, y: number, maxW: number, lineH: number) {
      const words = text.split(' ');
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW) {
          ctx.fillText(line, x, y);
          line = w;
          y += lineH;
        } else {
          line = test;
        }
      }
      if (line) ctx.fillText(line, x, y);
    }

    /* ── loop de animación ── */
    let raf = 0;
    let lastTime = performance.now();

    function loop(now: number) {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const p = paramsRef.current;

      /* Target lambda */
      const targetLam = p.manualOverride
        ? p.manualLambda
        : equilibriumCapture(p.alpha, p.salary);

      /* Animar lambda hacia target con amortiguación */
      const speed = 1.5;
      const diff = targetLam - sim.lambda;
      sim.lambda += diff * Math.min(1, speed * dt);

      const lam = sim.lambda;

      /* Spawn partículas de lobbying proporcional a captura */
      if (sim.frame % Math.max(1, Math.round(8 - lam * 6)) === 0) {
        spawnLobbyParticle();
      }

      /* Actualizar partículas */
      for (let i = sim.lobbyParticles.length - 1; i >= 0; i--) {
        const pt = sim.lobbyParticles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life++;
        if (pt.life > pt.maxLife) {
          sim.lobbyParticles.splice(i, 1);
        }
      }
      if (sim.lobbyParticles.length > 80) {
        sim.lobbyParticles.splice(0, sim.lobbyParticles.length - 80);
      }

      /* ── DIBUJO ── */
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      /* Gradient sutil de fondo */
      const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
      bgGrad.addColorStop(0, `rgba(239,68,68,${lam * 0.04})`);
      bgGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      /* ── Flecha débil: regulador → ciudadano (protección esperada, se desvanece) ── */
      {
        const alpha_arrow = Math.max(0, 1 - lam * 1.5);
        if (alpha_arrow > 0) {
          ctx.save();
          ctx.globalAlpha = alpha_arrow * 0.4;
          ctx.strokeStyle = CLR_CITIZEN;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 5]);
          ctx.beginPath();
          ctx.moveTo(REG_X + 10, REG_Y + 30);
          ctx.lineTo(CIT_X - 30, CIT_Y - 20);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      /* ── Flecha gruesa: industria → regulador (influencia / puerta giratoria) ── */
      {
        ctx.save();
        ctx.globalAlpha = 0.18 + lam * 0.22;
        const grd = ctx.createLinearGradient(IND_X, IND_Y, REG_X, REG_Y);
        grd.addColorStop(0, CLR_INDUSTRY);
        grd.addColorStop(1, CLR_REGULATOR);
        ctx.strokeStyle = grd;
        ctx.lineWidth = 2 + lam * 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(IND_X + 32, IND_Y - 12);
        ctx.quadraticCurveTo(
          (IND_X + REG_X) / 2, IND_Y - 60,
          REG_X - 32, REG_Y + 14
        );
        ctx.stroke();
        ctx.restore();
      }

      /* ── Partículas de lobbying ── */
      for (const pt of sim.lobbyParticles) {
        const progress = pt.life / pt.maxLife;
        const alpha_p  = progress < 0.2
          ? progress / 0.2
          : progress > 0.8
            ? (1 - progress) / 0.2
            : 1;
        ctx.save();
        ctx.globalAlpha = alpha_p * (0.5 + lam * 0.5);
        ctx.shadowColor = CLR_LOBBY;
        ctx.shadowBlur  = 6;
        ctx.fillStyle   = CLR_LOBBY;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      /* ── Actores ── */
      const firms = firmsAt(lam);
      const price = priceAt(lam);

      // Industria — brilla más cuando más capturada
      drawCircleActor(
        IND_X, IND_Y, 30,
        CLR_INDUSTRY,
        'INDUSTRIA',
        `${firms} empresa${firms > 1 ? 's' : ''}`,
        lam * 0.9
      );

      // Regulador — brilla ámbar cuando capturado, azul cuando independiente
      const regColor = lam > 0.5 ? CLR_REGULATOR : '#4FC3F7';
      const regLabel = lam > 0.7
        ? 'REGULADOR 🔴'
        : lam > 0.35
          ? 'REGULADOR ⚠'
          : 'REGULADOR ✓';
      const regSub = lam > 0.7
        ? 'capturado'
        : lam > 0.35
          ? 'en riesgo'
          : 'independiente';
      drawCircleActor(REG_X, REG_Y, 26, regColor, regLabel, regSub, lam * 0.8);

      // Ciudadano — brilla azul, se apaga con captura
      const citAlpha = 1 - lam * 0.7;
      ctx.save();
      ctx.globalAlpha = citAlpha;
      drawCircleActor(CIT_X, CIT_Y, 30, CLR_CITIZEN, 'CIUDADANO', 'pagando $' + price.toFixed(0), 0.4);
      ctx.restore();

      /* ── Panel de barras (zona central-derecha inferior) ── */
      const BAR_Y  = H * 0.42;
      const BAR_H  = H * 0.40;
      const BAR_W  = 44;
      const BAR_GAP = 60;
      const BARS_START = REG_X + 50;

      // Calcular valores actuales
      const cs     = consumerSurplus(lam);
      const profit = industryProfit(lam);
      const dwl    = deadweightLoss(lam);

      const CS_MAX  = consumerSurplus(0);
      const PI_MAX  = industryProfit(1);
      const DWL_MAX = deadweightLoss(1);

      // Barra 1: Precio
      const priceNorm = (price - MC) / ((P_MAX + MC) / 2 - MC);
      drawBar(
        BARS_START, BAR_Y, BAR_W, BAR_H,
        priceNorm, 1,
        CLR_INDUSTRY,
        'precio',
        `$${price.toFixed(0)}`
      );

      // Barra 2: Excedente consumidor
      drawBar(
        BARS_START + BAR_GAP, BAR_Y, BAR_W, BAR_H,
        cs, CS_MAX,
        CLR_CITIZEN,
        'bienestar',
        `${(cs / CS_MAX * 100).toFixed(0)}%`
      );

      // Barra 3: Ganancia industria
      drawBar(
        BARS_START + BAR_GAP * 2, BAR_Y, BAR_W, BAR_H,
        profit, PI_MAX,
        CLR_INDUSTRY,
        'ganancia',
        `${(profit / CS_MAX * 100).toFixed(0)}%`
      );

      // Barra 4: Pérdida irrecuperable
      drawBar(
        BARS_START + BAR_GAP * 3, BAR_Y, BAR_W, BAR_H,
        dwl, DWL_MAX,
        '#EF4444',
        'pérdida',
        dwl > 1 ? `${(dwl / CS_MAX * 100).toFixed(0)}%` : '~0%'
      );

      /* ── Etiqueta de captura ── */
      const pctCap = (lam * 100).toFixed(0);
      ctx.textAlign = 'center';

      // Medidor semicircular de captura (izquierda-centro)
      {
        const mX = (IND_X + REG_X) / 2 - 20;
        const mY = H - 64;
        const mR = 34;
        ctx.save();
        // Fondo arco
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(mX, mY, mR, Math.PI, 0, false);
        ctx.stroke();
        // Arco coloreado proporcional a captura
        const startA = Math.PI;
        const endA   = Math.PI + lam * Math.PI;
        const arcColor = lam < 0.35 ? '#34D399' : lam < 0.65 ? '#FDB813' : '#EF4444';
        ctx.strokeStyle = arcColor;
        ctx.shadowColor = arcColor;
        ctx.shadowBlur  = 8 * lam;
        ctx.lineWidth   = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(mX, mY, mR, startA, endA, false);
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Aguja
        const needleAngle = Math.PI + lam * Math.PI;
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(mX, mY);
        ctx.lineTo(
          mX + (mR - 4) * Math.cos(needleAngle),
          mY + (mR - 4) * Math.sin(needleAngle)
        );
        ctx.stroke();
        // Texto
        ctx.fillStyle = arcColor;
        ctx.font = `bold 14px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(`${pctCap}%`, mX, mY + 16);
        ctx.fillStyle = '#64748B';
        ctx.font = '9px ui-sans-serif, system-ui';
        ctx.fillText('captura', mX, mY + 30);
        ctx.restore();
      }

      /* ── Etiqueta de lobbying ── */
      {
        const lobbyAmt = (p.alpha * industryProfit(lam));
        ctx.fillStyle = colorAlpha(CLR_LOBBY, 0.8);
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        const midX = (IND_X + REG_X) / 2;
        const midY = IND_Y - 52;
        ctx.fillText(`lobby: $${lobbyAmt.toFixed(0)}/año`, midX, midY);
      }

      /* ── Mensaje de equilibrio ── */
      {
        const msgX = 14;
        const msgY = H - 28;
        let msg = '';
        if (lam < 0.2) {
          msg = '✓ Regulador independiente: precio competitivo, mercado abierto, ciudadano bien protegido.';
        } else if (lam < 0.5) {
          msg = '⚠ Captura parcial: el precio sube, algunas barreras de entrada frenan la competencia.';
        } else if (lam < 0.75) {
          msg = '🔴 Alta captura: la regulación ya protege a la industria, no al ciudadano. Puerta giratoria activa.';
        } else {
          msg = '🔴 Captura total: el "árbitro" juega para el equipo. Precio de monopolio, cero competencia nueva.';
        }
        ctx.fillStyle = '#94A3B8';
        ctx.font = '11px ui-sans-serif, system-ui';
        ctx.textAlign = 'left';
        wrapText(msg, msgX, msgY, W - 20, 14);
      }

      /* ── stats para React ── */
      if (sim.frame % 12 === 0) {
        setStats({
          lambda: lam,
          price,
          firms,
          cs,
          profit,
          dwl,
        });
      }

      sim.frame++;
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ── derivados para el insight ── */
  const cs0    = consumerSurplus(0);
  const pctLoss = cs0 > 0 ? ((cs0 - stats.cs) / cs0 * 100) : 0;

  const insight = stats.lambda < 0.15
    ? 'El regulador es independiente. La industria tiene poca ganancia monopolista y pocos incentivos para lobbear. El mercado funciona para el ciudadano — pero es inestable si la industria crece.'
    : stats.lambda < 0.45
      ? `Captura parcial (${(stats.lambda * 100).toFixed(0)}%). La industria ya está financiando al regulador. El precio subió, hay ${N_MAX - stats.firms} empresas bloqueadas. El ciudadano pierde ${pctLoss.toFixed(0)}% de su bienestar sin saberlo.`
      : stats.lambda < 0.75
        ? `Alta captura (${(stats.lambda * 100).toFixed(0)}%). El regulador escribe las reglas dictadas por la industria. La CFE, la CNBV, la CRE en su peor momento: exactamente este modelo. El ciudadano perdió ${pctLoss.toFixed(0)}% de bienestar.`
        : `Captura total (${(stats.lambda * 100).toFixed(0)}%). El "árbitro" es parte del equipo. Precio de monopolio, nadie puede entrar. La pérdida irrecuperable ($${stats.dwl.toFixed(0)}) es riqueza que no existe para nadie — ni para la industria.`;

  const lambdaEq = equilibriumCapture(alpha, salary);

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

          {/* Modo manual */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setManual(v => !v)}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                manual
                  ? 'border-[#EF4444]/50 bg-[#EF4444]/10 text-[#EF4444]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              {manual ? '🔴 modo manual: ON' : '○ modo manual'}
            </button>
            {manual && (
              <div className="flex items-center gap-2 flex-1">
                <span className="text-[11px] font-mono text-[#94A3B8]">captura:</span>
                <input
                  type="range" min={0} max={1} step={0.01} value={manualLam}
                  onChange={e => setManualLam(Number(e.target.value))}
                  className="flex-1 accent-[#EF4444]"
                />
                <span className="text-[12px] font-mono text-[#EF4444]">{(manualLam * 100).toFixed(0)}%</span>
              </div>
            )}
            {!manual && (
              <span className="text-[11px] font-mono text-[#475569]">
                equilibrio calculado: {(lambdaEq * 100).toFixed(0)}% de captura
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat
              label="captura"
              value={`${(stats.lambda * 100).toFixed(0)}%`}
              accent={stats.lambda < 0.3 ? '#34D399' : stats.lambda < 0.6 ? '#FDB813' : '#EF4444'}
            />
            <Stat label="precio mercado" value={`$${stats.price.toFixed(0)}`} accent={CLR_INDUSTRY} />
            <Stat label="empresas activas" value={String(stats.firms)} accent={CLR_CITIZEN} />
            <Stat
              label="bienestar perdido"
              value={pctLoss > 0.5 ? `−${pctLoss.toFixed(0)}%` : '~0%'}
              accent={pctLoss > 20 ? '#EF4444' : '#34D399'}
            />
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#EF4444] font-mono mb-2">✦ ¿Qué estás viendo?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── panel de controles ── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ El mercado político</div>

          <SliderRow
            label="Intensidad de lobbying (α)"
            value={alpha}
            min={0.01} max={0.4} step={0.01}
            onChange={setAlpha}
            fmt={v => `${(v * 100).toFixed(0)}% de ganancias`}
            hint="Fracción de las ganancias monopolistas que la industria destina a influenciar al regulador."
            accent={CLR_INDUSTRY}
          />

          <SliderRow
            label="Independencia del regulador"
            value={salary}
            min={500} max={12000} step={100}
            onChange={setSalary}
            fmt={v => `$${v.toLocaleString()}`}
            hint="Sueldo real + costo político de capturarse. Más alto → el regulador resiste más. Baja el sueldo y la puerta giratoria se abre sola."
            accent={CLR_CITIZEN}
          />

          {/* Tabla de equilibrio */}
          <div className="bg-[#070A11] border border-[#1E293B] rounded-lg p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#475569] font-mono">Equilibrio Stigler (λ*)</div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <span className="text-[#64748B]">captura</span>
              <span style={{ color: lambdaEq < 0.3 ? '#34D399' : lambdaEq < 0.6 ? '#FDB813' : '#EF4444' }}>
                {(lambdaEq * 100).toFixed(1)}%
              </span>
              <span className="text-[#64748B]">precio</span>
              <span className="text-[#EF4444]">${priceAt(lambdaEq).toFixed(0)}</span>
              <span className="text-[#64748B]">empresas</span>
              <span className="text-[#4FC3F7]">{firmsAt(lambdaEq)}</span>
              <span className="text-[#64748B]">bienestar</span>
              <span className="text-[#4FC3F7]">{((consumerSurplus(lambdaEq) / cs0) * 100).toFixed(0)}%</span>
              <span className="text-[#64748B]">lobby/año</span>
              <span className="text-[#F97316]">${(alpha * industryProfit(lambdaEq)).toFixed(0)}</span>
            </div>
          </div>

          {/* Casos reales */}
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#475569] font-mono">Casos en México</div>
            {[
              { label: 'CFE 2013–2018', action: () => { setAlpha(0.28); setSalary(2000); setManual(false); } },
              { label: 'Banca (CNBV)', action: () => { setAlpha(0.22); setSalary(4000); setManual(false); } },
              { label: 'Regulador ideal', action: () => { setAlpha(0.1); setSalary(10000); setManual(false); } },
            ].map(c => (
              <button
                key={c.label}
                onClick={c.action}
                className="w-full text-left px-3 py-2 text-[11px] font-mono rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-[#CBD5E1] transition"
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo: λ* = L(λ) / (L(λ) + S)<br />
            L = α · π(λ),  π = (P−MC)·Q(P)<br />
            P(λ) = MC + λ·(P_m − MC)<br />
            Stigler, Bell J. Economics (1971) · Nobel 1982
          </div>
        </div>

      </div>
    </div>
  );
}
