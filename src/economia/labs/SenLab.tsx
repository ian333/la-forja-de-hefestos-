/**
 * SenLab — laboratorio del premio 1998 (Amartya Sen).
 *
 * El click: la hambruna de Bengala (1943) mató a 3 millones mientras la India
 * exportaba comida. No faltó comida — faltaron DERECHOS de acceso a ella.
 * Sen llamó a esto el "Entitlement Approach" (Poverty and Famines, 1981) y
 * luego lo extendió al "Capability Approach": la pobreza no es falta de dinero
 * sino falta de la capacidad real de hacer y ser.
 *
 * Modelo REAL implementado:
 *
 *   Dotación (endowment) W  → tu trabajo, tierra, activos
 *   Tasa de canje (exchange entitlement rate) ε ∈ [0,1]
 *     — reducida por discriminación, desempleo, precios de mercado adversos
 *   Control propio sobre el ingreso κ ∈ [0,1]
 *     — si otro controla tu dinero, ε·W no te pertenece
 *   Acceso a servicios públicos α ∈ [0,1]
 *     — salud, educación, agua; convierte ingreso en capability real
 *
 *   Ingreso efectivo I = W · ε · κ
 *   Capability C = I · α                    ← "lo que realmente puedes hacer"
 *   Umbral de pobreza de capacidades C*
 *     — por debajo: incapaz de nutrición, salud, participación social básica
 *
 *   Entitlement para comida (modelo hambruna):
 *     Food_E = W_food + W_otros · (P_otros / P_comida)
 *     Si Food_E < Requerimiento_mínimo → hambre (aunque haya comida en el mercado)
 *
 * Visualización:
 *   Panel izquierdo: Espacio de capabilities (2D). Eje X = ingreso efectivo,
 *     eje Y = capability real. La posición de la persona + el umbral de pobreza
 *     + la curva de conversión α.
 *   Panel derecho (modo hambruna): gráfica de distribución de comida vs
 *     entitlement individual — visible el "food paradox".
 *
 * Controles: dotación, discriminación, control propio, acceso a servicios.
 * Botón toggle: modo "capability" vs modo "hambruna".
 */

import { useEffect, useRef, useState } from 'react';

/* ─── Dimensiones del canvas ─── */
const W = 820;
const H = 380;
/* ─── Colores ─── */
const BG0 = '#07090F';
const BG1 = '#0B0F17';
const ACCENT = '#EF4444';          // rojo pobreza
const ACCENT2 = '#34D399';         // verde capability OK
const ACCENT3 = '#FDB813';         // amarillo persona
const GRID_CLR = '#1E293B';
const TEXT_DIM = '#64748B';
const TEXT_MID = '#94A3B8';
const TEXT_BRI = '#E2E8F0';

/* ─── Tipos ─── */
interface Params {
  dotacion: number;        // W ∈ [0, 100] — "cuánto tienes"
  discriminacion: number;  // d ∈ [0, 1]  — reduce ε: ε = 1 − d
  control: number;         // κ ∈ [0, 1]  — fracción que controlas tú
  acceso: number;          // α ∈ [0, 1]  — acceso a servicios
  modo: 'capability' | 'hambruna';
}

interface Sim {
  /** Posición suavizada de la persona en el plano (x=I, y=C), normalizadas a [0,1] */
  animT: number;  // frame counter para animaciones
}

const DEFAULTS: Params = {
  dotacion: 55,
  discriminacion: 0.35,
  control: 0.7,
  acceso: 0.55,
  modo: 'capability',
};

/* ─── Matemática del modelo ─── */
const epsilon = (d: number) => 1 - d;                            // tasa de canje
const ingresoEfectivo = (W: number, d: number, k: number) =>
  W * epsilon(d) * k;                                            // I = W·ε·κ
const capability = (W: number, d: number, k: number, a: number) =>
  ingresoEfectivo(W, d, k) * a;                                  // C = I·α

/** Umbral de capability mínima (fijo, normalizado a escala 0-100) */
const C_STAR = 18;
/** Umbral de ingreso mínimo */
const I_STAR = 25;

/* ─── Helpers de dibujo ─── */

/* ─── Utilidad canvas ─── */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ─── Subcomponentes React ─── */
function Stat({ label, value, accent, sub }: {
  label: string; value: string; accent: string; sub?: string;
}) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[18px] font-bold font-mono" style={{ color: accent }}>{value}</div>
      {sub && <div className="text-[10px] text-[#64748B] font-mono mt-0.5">{sub}</div>}
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
        <span className="text-[12px] font-mono text-[#FDB813]">
          {fmt ? fmt(value) : value.toFixed(0)}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#EF4444]" />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════════════════ */
export default function SenLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<Params>({ ...DEFAULTS });
  const simRef = useRef<Sim>({ animT: 0 });

  const [dotacion, setDotacion] = useState(DEFAULTS.dotacion);
  const [discriminacion, setDiscriminacion] = useState(DEFAULTS.discriminacion);
  const [control, setControl] = useState(DEFAULTS.control);
  const [acceso, setAcceso] = useState(DEFAULTS.acceso);
  const [modo, setModo] = useState<'capability' | 'hambruna'>(DEFAULTS.modo);
  const [stats, setStats] = useState({ I: 0, C: 0, bajo: false });

  /* Sincronizar ref con estado React */
  useEffect(() => {
    paramsRef.current = { dotacion, discriminacion, control, acceso, modo };
  }, [dotacion, discriminacion, control, acceso, modo]);

  /* ─── Loop de animación ─── */
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

    /* ── MODO CAPABILITY: plano 2D ingreso vs capability ── */
    function drawCapabilityPlane(p: Params, t: number) {
      if (!ctx) return;
      const PAD_L = 64, PAD_R = 24, PAD_T = 32, PAD_B = 56;
      const PW = W - PAD_L - PAD_R;
      const PH = H - PAD_T - PAD_B;

      const toX = (I: number) => PAD_L + (I / 100) * PW;
      const toY = (C: number) => PAD_T + PH - (C / 100) * PH;

      /* fondo */
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, BG0);
      bg.addColorStop(1, BG1);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      /* ── Zona de pobreza (abajo a la izquierda del umbral) ── */
      const xStar = toX(I_STAR);
      const yStar = toY(C_STAR);

      /* sombra roja para zona de pobreza en capability */
      ctx.fillStyle = hexToRgba(ACCENT, 0.07);
      ctx.fillRect(PAD_L, yStar, PW, PAD_T + PH - yStar);
      ctx.fillStyle = hexToRgba(ACCENT, 0.07);
      ctx.fillRect(PAD_L, PAD_T, xStar - PAD_L, PH);

      /* ── Grid ── */
      ctx.strokeStyle = GRID_CLR;
      ctx.lineWidth = 1;
      for (let v = 0; v <= 100; v += 20) {
        ctx.beginPath();
        ctx.moveTo(toX(v), PAD_T);
        ctx.lineTo(toX(v), PAD_T + PH);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(PAD_L, toY(v));
        ctx.lineTo(PAD_L + PW, toY(v));
        ctx.stroke();
      }

      /* ── Curva de conversión: C = I·α, para α del usuario ── */
      /* mostramos también α=1 (máximo) y α=0.2 (mínimo) */
      const alphaLevels: Array<{ a: number; color: string; label: string }> = [
        { a: 1.0, color: '#1E4A3A', label: 'α=1 acceso total' },
        { a: p.acceso, color: ACCENT2, label: `α=${p.acceso.toFixed(2)} (tuyo)` },
        { a: 0.15, color: '#4A1A1A', label: 'α=0.15 sin servicios' },
      ];

      for (const { a, color } of alphaLevels) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = a === p.acceso ? 2.5 : 1;
        ctx.setLineDash(a === p.acceso ? [] : [4, 4]);
        for (let i = 0; i <= 80; i++) {
          const I = (i / 80) * 100;
          const C = Math.min(100, I * a);
          if (i === 0) ctx.moveTo(toX(I), toY(C));
          else ctx.lineTo(toX(I), toY(C));
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      /* ── Etiquetas curvas ── */
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillStyle = ACCENT2;
      ctx.textAlign = 'left';
      const labelI = 92;
      const labelC = Math.min(100, labelI * p.acceso);
      ctx.fillText(`α=${p.acceso.toFixed(2)}`, toX(labelI) - 30, toY(labelC) - 5);

      /* ── Líneas umbral de pobreza ── */
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      /* umbral horizontal C* */
      ctx.beginPath();
      ctx.moveTo(PAD_L, yStar);
      ctx.lineTo(PAD_L + PW, yStar);
      ctx.stroke();
      /* umbral vertical I* */
      ctx.beginPath();
      ctx.moveTo(xStar, PAD_T);
      ctx.lineTo(xStar, PAD_T + PH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = ACCENT;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`C* = ${C_STAR} (umbral)`, PAD_L + 4, yStar - 4);
      ctx.fillText(`I* = ${I_STAR}`, xStar + 3, PAD_T + 14);

      /* ── Punto de la persona ── */
      const I = ingresoEfectivo(p.dotacion, p.discriminacion, p.control);
      const C = capability(p.dotacion, p.discriminacion, p.control, p.acceso);
      const px = toX(I);
      const py = toY(C);

      /* pulso suave */
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.06);
      const r = 10 + pulse * 3;

      /* línea de desglose desde origin */
      ctx.strokeStyle = hexToRgba(ACCENT3, 0.25);
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(0));
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.setLineDash([]);

      /* proyección al eje X (ingreso efectivo) */
      ctx.strokeStyle = hexToRgba(ACCENT3, 0.2);
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, PAD_T + PH);
      ctx.stroke();
      ctx.setLineDash([]);

      /* halo */
      const isBelowC = C < C_STAR;
      const isBelowI = I < I_STAR;
      const personColor = (isBelowC || isBelowI) ? ACCENT : ACCENT2;

      ctx.save();
      ctx.shadowColor = personColor;
      ctx.shadowBlur = 16 + pulse * 8;
      const grad = ctx.createRadialGradient(px - 2, py - 2, 2, px, py, r);
      grad.addColorStop(0, isBelowC ? '#FEF2F2' : '#F0FDF4');
      grad.addColorStop(1, personColor);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      /* etiqueta persona */
      ctx.fillStyle = TEXT_BRI;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TÚ', px, py - r - 5);

      /* coordenadas */
      ctx.fillStyle = TEXT_MID;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`(I=${I.toFixed(0)}, C=${C.toFixed(0)})`, px, py - r - 16);

      /* ── Etiquetas de ejes ── */
      ctx.fillStyle = TEXT_DIM;
      ctx.font = '11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Ingreso efectivo I = W · ε · κ', PAD_L + PW / 2, H - 8);
      ctx.save();
      ctx.translate(14, PAD_T + PH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Capability C = I · α', 0, 0);
      ctx.restore();

      /* ── Título del modo ── */
      ctx.fillStyle = TEXT_MID;
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText('Espacio de Capabilities (Sen 1985)', W - PAD_R, PAD_T - 8);

      /* ── Etiqueta estado ── */
      const label = (isBelowC && isBelowI)
        ? 'POBREZA DE CAPABILITIES — ni ingreso ni acceso alcanzan'
        : isBelowC
          ? 'TRAMPA: ingreso llega, pero sin servicios no se convierte en capability'
          : isBelowI
            ? 'TRAMPA: acceso a servicios, pero el ingreso real es insuficiente'
            : 'FUERA DEL UMBRAL — capabilities básicas cubiertas';
      const labelColor = (isBelowC || isBelowI) ? ACCENT : ACCENT2;
      ctx.fillStyle = labelColor;
      ctx.font = 'bold 12px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(label, W / 2, H - 24);

      /* ── Alpha label ── */
      ctx.fillStyle = TEXT_DIM;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('— — sin servicios (α=0.15)', PAD_L + 4, PAD_T + 22);
      ctx.fillStyle = '#1E4A3A';
      ctx.fillText('—— acceso total (α=1)', PAD_L + 4, PAD_T + 34);
    }

    /* ── MODO HAMBRUNA: Entitlement approach ── */
    function drawHambruna(p: Params, t: number) {
      if (!ctx) return;
      const PAD_L = 56, PAD_R = 24, PAD_T = 36, PAD_B = 56;
      const PW = W - PAD_L - PAD_R;
      const PH = H - PAD_T - PAD_B;

      /* fondo */
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#080B12');
      bg.addColorStop(1, BG1);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      /* ── Escenario: distribución de food entitlements ── */
      /* Modelamos N=20 "personas" con dotaciones aleatorias (seed fijo) y diferentes
         exchange entitlement rates según su ocupación.
         La clave del modelo Sen: el total de comida en el mercado puede ser constante
         o incluso subir, mientras los entitlements de ciertos grupos colapsan.         */

      /* RNG determinístico simple (LCG) para posiciones fijas */
      const lcg = (seed: number) => {
        let s = seed;
        return () => {
          s = (1664525 * s + 1013904223) & 0xffffffff;
          return (s >>> 0) / 4294967296;
        };
      };
      const rng = lcg(42);

      /* Grupos: trabajador agrícola, artesano, pastor, comerciante */
      type Grupo = { nombre: string; n: number; baseW: number; epsilonMod: number };
      const grupos: Grupo[] = [
        { nombre: 'jornalero agrícola', n: 6, baseW: 40, epsilonMod: 0.3 + p.discriminacion * 0.4 },
        { nombre: 'artesano',          n: 5, baseW: 55, epsilonMod: 0.55 },
        { nombre: 'ganadero',          n: 4, baseW: 60, epsilonMod: 0.65 },
        { nombre: 'comerciante',       n: 5, baseW: 75, epsilonMod: 0.85 },
      ];

      /* Precio relativo de comida: sube en crisis (discriminacion = proxy crisis) */
      const precioComida = 1 + p.discriminacion * 2.5;  /* 1x – 3.5x normal */
      const reqMin = 22;   /* unidades de comida mínimas por persona */

      /* Generar personas */
      type Persona = { grupo: number; W: number; eps: number; foodE: number; x: number; y: number };
      const personas: Persona[] = [];
      let gi = 0;
      for (const g of grupos) {
        for (let i = 0; i < g.n; i++) {
          const noise = 0.8 + rng() * 0.4;
          const Wi = g.baseW * noise * (p.dotacion / 55); /* escala con dotación global */
          const eps = Math.min(0.95, g.epsilonMod * p.control);
          /* entitlement de comida: dinero disponible / precio de comida */
          const foodE = (Wi * eps) / precioComida;
          const x = PAD_L + rng() * PW;
          const y = PAD_T + rng() * PH;
          personas.push({ grupo: gi, W: Wi, eps, foodE, x, y });
        }
        gi++;
      }

      /* Comida total en el mercado (puede ser alta aunque haya hambre) */
      const foodTotal = personas.reduce((s, p2) => s + p2.foodE, 0) * 1.1; // hay 10% extra en el mercado

      /* ── Dibujar personas como burbujas ── */
      /* Radio proporcional al foodEntitlement */
      const maxFoodE = Math.max(...personas.map(p2 => p2.foodE));
      const groupColors = [ACCENT, '#FB923C', '#FDB813', ACCENT2];

      const pulse = 0.5 + 0.5 * Math.sin(t * 0.05);

      for (const per of personas) {
        const rr = 6 + (per.foodE / maxFoodE) * 18;
        const col = groupColors[per.grupo] ?? ACCENT2;
        const hambre = per.foodE < reqMin;

        ctx.save();
        if (hambre) {
          ctx.shadowColor = ACCENT;
          ctx.shadowBlur = 10 + pulse * 8;
        }
        const grad = ctx.createRadialGradient(per.x - 2, per.y - 2, 1, per.x, per.y, rr);
        grad.addColorStop(0, hambre ? '#FEE2E2' : '#F0FDF4');
        grad.addColorStop(1, col);
        ctx.fillStyle = grad;
        ctx.globalAlpha = hambre ? 0.85 + pulse * 0.1 : 0.6;
        ctx.beginPath();
        ctx.arc(per.x, per.y, rr, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        /* icono de hambre */
        if (hambre) {
          ctx.fillStyle = '#FFF';
          ctx.font = 'bold 10px ui-sans-serif, system-ui';
          ctx.textAlign = 'center';
          ctx.fillText('✗', per.x, per.y + 4);
        }
      }

      /* ── Barra: comida total disponible vs entitlement total ── */
      const barX = PAD_L;
      const barY = PAD_T + PH + 12;
      const barH = 14;

      /* total de comida en mercado */
      const foodNorm = Math.min(1, foodTotal / (reqMin * personas.length * 1.5));
      ctx.fillStyle = hexToRgba(ACCENT2, 0.15);
      ctx.fillRect(barX, barY, PW, barH);
      ctx.fillStyle = ACCENT2;
      ctx.fillRect(barX, barY, foodNorm * PW, barH);
      ctx.fillStyle = TEXT_MID;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Comida en el mercado: ${foodTotal.toFixed(0)} u.`, barX + 4, barY + barH - 3);

      /* entitlement hambrientos */
      const hambrientos = personas.filter(pp => pp.foodE < reqMin);
      const hambrientasFrac = hambrientos.length / personas.length;

      ctx.fillStyle = TEXT_BRI;
      ctx.font = 'bold 12px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      const msg = hambrientasFrac > 0.3
        ? `${hambrientos.length}/${personas.length} personas pasan hambre — aunque hay ${foodTotal.toFixed(0)} u. de comida en el mercado`
        : hambrientasFrac > 0
          ? `${hambrientos.length}/${personas.length} personas sin entitlement suficiente`
          : 'Todos tienen entitlement suficiente — nadie pasa hambre';
      const msgColor = hambrientasFrac > 0.3 ? ACCENT : hambrientasFrac > 0 ? '#FB923C' : ACCENT2;
      ctx.fillStyle = msgColor;
      ctx.fillText(msg, W / 2, H - 6);

      /* ── Leyenda grupos ── */
      const legendX = PAD_L;
      const legendY = PAD_T + 2;
      const gNames = ['jornalero', 'artesano', 'ganadero', 'comerciante'];
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = groupColors[i] ?? ACCENT2;
        ctx.fillRect(legendX + i * 150, legendY, 10, 10);
        ctx.fillStyle = TEXT_MID;
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(gNames[i] ?? '', legendX + i * 150 + 14, legendY + 9);
      }

      /* ── Título ── */
      ctx.fillStyle = TEXT_MID;
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(`Precio comida: ${precioComida.toFixed(1)}x — Entitlement (Sen 1981)`, W - PAD_R, PAD_T - 10);

      /* tamaño burbuja = food entitlement del individuo */
      ctx.fillStyle = TEXT_DIM;
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText('● tamaño = entitlement de comida individual  ✗ = pasa hambre', W - PAD_R, H - 18);
    }

    /* ── Loop principal ── */
    function loop() {
      const p = paramsRef.current;
      const sim = simRef.current;
      sim.animT += 1;

      if (!ctx) return;

      if (p.modo === 'capability') {
        drawCapabilityPlane(p, sim.animT);
      } else {
        drawHambruna(p, sim.animT);
      }

      /* Stats cada 6 frames */
      if (sim.animT % 6 === 0) {
        const I = ingresoEfectivo(p.dotacion, p.discriminacion, p.control);
        const C = capability(p.dotacion, p.discriminacion, p.control, p.acceso);
        setStats({ I, C, bajo: C < C_STAR || I < I_STAR });
      }

      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ── Valores calculados para los stats ── */
  const I = ingresoEfectivo(dotacion, discriminacion, control);
  const C = capability(dotacion, discriminacion, control, acceso);
  const eps = epsilon(discriminacion);

  /* ── Insight dinámico ── */
  const insight = (() => {
    if (modo === 'hambruna') {
      const precioComida = 1 + discriminacion * 2.5;
      if (precioComida > 2.5) {
        return 'El precio de la comida subió al triple por la crisis. Los jornaleros, aunque tengan trabajo, ya no pueden comprar suficiente — exactamente como Bengala 1943: la comida existía, pero sus salarios reales colapsaron ante el precio de guerra.';
      }
      return 'Baja la dotación o sube la discriminación (proxy de crisis) para ver cómo los jornaleros pierden su entitlement aunque el mercado siga lleno de comida. El hambre no es escasez — es falta de acceso.';
    }
    if (C < C_STAR && I < I_STAR) {
      return 'Estás bajo ambos umbrales. Pobreza clásica: ni ingreso ni acceso a servicios. Para Sen, esto no es solo "falta de dinero" — es falta de libertad real para elegir una vida digna.';
    }
    if (C < C_STAR && I >= I_STAR) {
      return '¡Trampa de servicios! Tu ingreso nominal llega al umbral, pero sin acceso a salud, agua o educación, ese ingreso no se convierte en capability real. Por eso el IDH mide más que el PIB.';
    }
    if (C >= C_STAR && I < I_STAR) {
      return 'Acceso a servicios públicos de calidad puede compensar un ingreso bajo. Un país con buena salud pública y educación universal eleva capabilities incluso con ingresos modestos.';
    }
    return 'Capabilities básicas cubiertas. Mueve los sliders para ver cómo discriminación o falta de control propio del ingreso destruyen capabilities aunque la dotación suba.';
  })();

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

        {/* ── Canvas ── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#07090F] block touch-none"
              style={{ width: W, height: H }}
            />
          </div>

          {/* ── Botones de modo ── */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setModo('capability')}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                modo === 'capability'
                  ? 'border-[#34D399]/50 bg-[#34D399]/10 text-[#34D399]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
              }`}>
              📐 Espacio de capabilities
            </button>
            <button
              onClick={() => setModo('hambruna')}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                modo === 'hambruna'
                  ? 'border-[#EF4444]/50 bg-[#EF4444]/10 text-[#EF4444]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
              }`}>
              🌾 Paradoja de la hambruna
            </button>
            <button
              onClick={() => {
                setDiscriminacion(0.85);
                setControl(0.2);
                setAcceso(0.18);
                setDotacion(40);
              }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10 transition">
              ⚡ Caso crítico
            </button>
            <button
              onClick={() => {
                setDiscriminacion(0.1);
                setControl(0.95);
                setAcceso(0.9);
                setDotacion(70);
              }}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#34D399]/30 text-[#34D399] hover:bg-[#34D399]/10 transition">
              ✓ Caso óptimo
            </button>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-4 gap-3">
            <Stat
              label="ε (tasa de canje)"
              value={eps.toFixed(2)}
              accent={eps < 0.5 ? ACCENT : ACCENT2}
              sub={eps < 0.5 ? 'discriminación alta' : 'mercado justo'}
            />
            <Stat
              label="Ingreso efectivo I"
              value={I.toFixed(0)}
              accent={I < I_STAR ? ACCENT : ACCENT2}
              sub={`umbral: ${I_STAR}`}
            />
            <Stat
              label="Capability C"
              value={C.toFixed(0)}
              accent={C < C_STAR ? ACCENT : ACCENT2}
              sub={`umbral: ${C_STAR}`}
            />
            <Stat
              label="Estado"
              value={stats.bajo ? 'PRIVACIÓN' : 'OK'}
              accent={stats.bajo ? ACCENT : ACCENT2}
              sub={stats.bajo ? 'bajo umbral' : 'capabilities cubiertas'}
            />
          </div>

          {/* ── Insight ── */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#EF4444] font-mono mb-2">
              ✦ ¿Qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── Panel de controles ── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Mueve el mundo
          </div>

          <Slider
            label="Dotación W (recursos propios)"
            value={dotacion}
            min={5}
            max={100}
            step={1}
            onChange={setDotacion}
            fmt={v => v < 30 ? `${v} — poca` : v < 60 ? `${v} — media` : `${v} — alta`}
            hint="Tu trabajo, tierra, activos. Subir esto sube el ingreso bruto antes de la discriminación."
          />

          <Slider
            label="Discriminación / crisis (d)"
            value={discriminacion}
            min={0}
            max={1}
            step={0.01}
            onChange={setDiscriminacion}
            fmt={v => `d=${v.toFixed(2)} → ε=${(1 - v).toFixed(2)}`}
            hint="Reduce la tasa de canje ε=1−d: tu trabajo vale menos en el mercado. También modela crisis de precios en modo hambruna."
          />

          <Slider
            label="Control propio del ingreso (κ)"
            value={control}
            min={0.05}
            max={1}
            step={0.01}
            onChange={setControl}
            fmt={v => `${(v * 100).toFixed(0)}%`}
            hint="¿Qué fracción del ingreso controlas tú? Si tu pareja o familia controla el dinero, κ < 1 aunque trabajes."
          />

          <Slider
            label="Acceso a servicios (α)"
            value={acceso}
            min={0.05}
            max={1}
            step={0.01}
            onChange={setAcceso}
            fmt={v => `α=${v.toFixed(2)}`}
            hint="Salud, educación, agua. Convierte ingreso en capability real. Incluso con buen ingreso, α bajo te deja bajo el umbral."
          />

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed space-y-1">
            <div>C = W · (1−d) · κ · α</div>
            <div>I = W · (1−d) · κ</div>
            <div>umbral C* = {C_STAR} · umbral I* = {I_STAR}</div>
            <div className="pt-1 text-[#374151]">
              Sen, Poverty and Famines (1981)<br />
              Development as Freedom (1999)<br />
              Nobel 1998 · economía del bienestar
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
