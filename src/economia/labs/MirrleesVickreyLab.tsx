/**
 * MirrleesVickreyLab — laboratorio del premio 1996 (Mirrlees & Vickrey).
 *
 * EL CLICK: el gobierno nunca sabe cuánto ganas de verdad — pero puede
 * diseñar las reglas para que te convenga decir la verdad.
 *
 * PANEL 1 — Subasta de Vickrey (segundo precio):
 *   En una subasta de primer precio cada quien adivina cuánto ofrece el rival
 *   y MIENTE hacia abajo. En una de segundo precio (Vickrey) decir tu valor
 *   real es la estrategia dominante:
 *     Utilidad si ganas = V_i − P     donde P = max(V_{-i})
 *     Si V_i > V_j para todo j, ganas y pagas V_{2nd} < V_i → SIEMPRE conviene
 *   La demostración es por dominancia estricta: no existe razón para mentir.
 *
 * PANEL 2 — Impuesto óptimo de Mirrlees:
 *   Cada trabajador tiene habilidad θ ~ U[θ_min, θ_max].
 *   Produce: y = θ·h   (ingreso = habilidad × horas)
 *   Utilidad: U = c − h²/2   (cuadrática en esfuerzo, lineal en consumo)
 *   Con transferencia T(y) = τ·y − K (impuesto lineal + lump-sum),
 *   elige h* = θ(1−τ)  →  y* = θ²(1−τ)
 *   Recaudación total: R(τ) = τ · E[y*(τ)] − K·N
 *     donde E[y*(τ)] = (1−τ)·∫θ²dθ / (θ_max−θ_min)
 *   La curva de Laffer emerge naturalmente: τ* maximiza R(τ).
 *   τ* = 1/2  para distribución uniforme sin transferencia.
 *   Con bienestar social Rawlsiano (max el peor), el óptimo cambia.
 */

import { useEffect, useRef, useState } from 'react';

/* ─── Dimensiones ─────────────────────────────── */
const W = 820;
const H = 380;

/* ─── Colores ─────────────────────────────────── */
const BG0 = '#0B0F17';
const BG1 = '#070A11';
const ACCENT = '#A78BFA';   // violeta (bloque juegos-mecanismos)
const CYAN   = '#22D3EE';
const GOLD   = '#FDB813';
const GREEN  = '#34D399';
const RED    = '#EF4444';
const MUTED  = '#475569';

/* ══════════════════════════════════════════════════════
   UTILIDADES MATEMÁTICAS
══════════════════════════════════════════════════════ */

/**
 * Curva de Laffer de Mirrlees (impuesto lineal sobre ingreso laboral).
 * Distribución de habilidades θ ~ U[1, θMax].
 * θ* = θ(1-τ) → y = θ²(1-τ) → E[y] = (θMax²+θMax+1)/3 · (1-τ)
 * R(τ) = τ · E[y(τ)]  (K=0 para simplificar la visualización)
 */
function recaudacion(tau: number, thetaMax: number): number {
  if (tau <= 0 || tau >= 1) return 0;
  // E[θ²] para U[1, thetaMax]
  const eTheta2 = (thetaMax * thetaMax + thetaMax + 1) / 3;
  return tau * (1 - tau) * eTheta2;
}

/** τ* analítico = 0.5 (no depende de thetaMax con U[1,N]) */
function tauOptimo(): number { return 0.5; }

/**
 * Recaudación normalizada a [0,1] para escalar en la gráfica.
 * R_max = R(0.5) = 0.25 · E[θ²]
 */
function recaudacionNorm(tau: number, thetaMax: number): number {
  const rMax = recaudacion(0.5, thetaMax);
  return rMax > 0 ? recaudacion(tau, thetaMax) / rMax : 0;
}

/* ══════════════════════════════════════════════════════
   TIPOS
══════════════════════════════════════════════════════ */
type ModoLab = 'subasta' | 'impuesto';

interface Postor {
  id: number;
  nombre: string;
  valorReal: number;   // valor privado Vi ~ U[0, 100]
  oferta1: number;     // oferta en subasta de 1er precio (estratégica = shading)
  oferta2: number;     // oferta en subasta de 2do precio (= valor real, dom. strategy)
  color: string;
}

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════ */
export default function MirrleesVickreyLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* --- modo activo --- */
  const [modo, setModo] = useState<ModoLab>('subasta');

  /* --- parámetros subasta --- */
  const [numPostores, setNumPostores] = useState(4);
  const [postores, setPostores] = useState<Postor[]>([]);
  const [rondas, setRondas] = useState(0);
  const [ganancia1Total, setGanancia1Total] = useState(0);   // ganancia sumada vendedor 1er precio
  const [ganancia2Total, setGanancia2Total] = useState(0);   // ganancia sumada vendedor 2do precio

  /* --- parámetros impuesto --- */
  const [tau, setTau] = useState(0.3);           // tasa marginal
  const [thetaMax, setThetaMax] = useState(5);   // habilidad máxima (rango distribución)

  /* estado para insight dinámico */
  const [insight, setInsight] = useState('');

  const modoRef = useRef<ModoLab>('subasta');
  const postoresRef = useRef<Postor[]>([]);
  const tauRef = useRef(0.3);
  const thetaMaxRef = useRef(5);
  const rondaAnimRef = useRef<{ ganador1: number; ganador2: number; tick: number } | null>(null);

  const COLORES_POSTORES = [ACCENT, CYAN, GOLD, GREEN, '#F472B6', '#FB923C'];
  const NOMBRES = ['Ana', 'Bruno', 'Cara', 'David', 'Elena', 'Félix'];

  /* --- Sincroniza refs con estado --- */
  useEffect(() => { modoRef.current = modo; }, [modo]);
  useEffect(() => { postoresRef.current = postores; }, [postores]);
  useEffect(() => { tauRef.current = tau; }, [tau]);
  useEffect(() => { thetaMaxRef.current = thetaMax; }, [thetaMax]);

  /* --- Genera postores nuevos --- */
  function generarPostores(n: number): Postor[] {
    return Array.from({ length: n }, (_, i) => {
      const v = Math.round(10 + Math.random() * 90);  // U[10,100]
      // Estrategia 1er precio: "shade" = valor * factor (equilibrio BNE)
      // Con N postores simétricos y dist. uniforme: oferta_i = v_i * (N-1)/N
      const shade = (n - 1) / n;
      return {
        id: i,
        nombre: NOMBRES[i],
        valorReal: v,
        oferta1: Math.round(v * shade),
        oferta2: v,   // estrategia dominante: decir la verdad
        color: COLORES_POSTORES[i],
      };
    });
  }

  /* --- Inicializa postores al montar o cambiar N --- */
  useEffect(() => {
    const p = generarPostores(numPostores);
    setPostores(p);
    setRondas(0);
    setGanancia1Total(0);
    setGanancia2Total(0);
    rondaAnimRef.current = null;
  }, [numPostores]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ═══ LOOP DE CANVAS ═══════════════════════════════ */
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
    let frameN = 0;

    function drawFondo() {
      if (!ctx) return;
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, BG0);
      bg.addColorStop(1, BG1);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }

    /* ── SUBASTA ─────────────────────────────────── */
    function drawSubasta() {
      if (!ctx) return;
      const ps = postoresRef.current;
      if (ps.length === 0) return;

      const N = ps.length;
      const anim = rondaAnimRef.current;

      /* Identifica ganadores */
      let idx1 = 0, idx2 = 0;
      for (let i = 1; i < N; i++) {
        if (ps[i].oferta1 > ps[idx1].oferta1) idx1 = i;
        if (ps[i].oferta2 > ps[idx2].oferta2) idx2 = i;
      }
      /* Segundo precio para ganador de subasta 2 */
      let seg2 = 0;
      for (let i = 0; i < N; i++) {
        if (i === idx2) continue;
        if (ps[i].oferta2 > seg2) seg2 = ps[i].oferta2;
      }

      const padLeft = 30;
      const midX = W / 2;
      const colW = (W / 2) - padLeft - 30;

      /* ── Columna izquierda: 1er precio ── */
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SUBASTA 1er PRECIO', padLeft + colW / 2, 30);
      ctx.fillStyle = MUTED;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText('(gana quien más ofrece, paga su oferta)', padLeft + colW / 2, 44);

      const barH = Math.floor((H - 120) / N);
      for (let i = 0; i < N; i++) {
        const p = ps[i];
        const barMaxW = colW - 20;
        const bw = (p.oferta1 / 100) * barMaxW;
        const by = 60 + i * barH;
        const isWinner = i === idx1;
        const glow = anim && i === idx1;

        /* barra de oferta */
        ctx.fillStyle = isWinner ? p.color : p.color + '55';
        ctx.fillRect(padLeft + 10, by, bw, barH - 8);

        /* halo pulsante al ganador */
        if (glow) {
          ctx.save();
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 12 + 6 * Math.sin(frameN * 0.15);
          ctx.fillStyle = p.color;
          ctx.fillRect(padLeft + 10, by, bw, barH - 8);
          ctx.restore();
        }

        /* etiquetas */
        ctx.fillStyle = '#E2E8F0';
        ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(p.nombre, padLeft + 12, by + barH - 14);
        ctx.textAlign = 'right';
        ctx.fillStyle = isWinner ? p.color : '#94A3B8';
        ctx.fillText(`$${p.oferta1} (real $${p.valorReal})`, padLeft + bw + 8, by + barH - 14);

        /* barra del valor real (fantasma) */
        const bwReal = (p.valorReal / 100) * barMaxW;
        ctx.strokeStyle = p.color + '44';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(padLeft + 10 + bwReal, by + 2);
        ctx.lineTo(padLeft + 10 + bwReal, by + barH - 10);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      /* Precio pagado por ganador 1 */
      ctx.fillStyle = RED;
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`✗ paga su oferta: $${ps[idx1].oferta1}`, padLeft + colW / 2, H - 18);
      ctx.fillStyle = MUTED;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`(valor real: $${ps[idx1].valorReal} → mintió $${ps[idx1].valorReal - ps[idx1].oferta1})`, padLeft + colW / 2, H - 6);

      /* ── Divisor central ── */
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(midX, 20);
      ctx.lineTo(midX, H - 20);
      ctx.stroke();

      /* ── Columna derecha: 2do precio ── */
      const rx = midX + 20;
      ctx.fillStyle = ACCENT;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SUBASTA 2do PRECIO (Vickrey)', rx + colW / 2, 30);
      ctx.fillStyle = MUTED;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText('(gana el mayor, paga el SEGUNDO más alto)', rx + colW / 2, 44);

      for (let i = 0; i < N; i++) {
        const p = ps[i];
        const barMaxW = colW - 20;
        const bw = (p.oferta2 / 100) * barMaxW;
        const by = 60 + i * barH;
        const isWinner = i === idx2;
        const glow = anim && i === idx2;

        ctx.fillStyle = isWinner ? p.color : p.color + '55';
        ctx.fillRect(rx, by, bw, barH - 8);

        if (glow) {
          ctx.save();
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 12 + 6 * Math.sin(frameN * 0.15);
          ctx.fillStyle = p.color;
          ctx.fillRect(rx, by, bw, barH - 8);
          ctx.restore();
        }

        ctx.fillStyle = '#E2E8F0';
        ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(p.nombre, rx + 4, by + barH - 14);
        ctx.textAlign = 'right';
        ctx.fillStyle = isWinner ? p.color : '#94A3B8';
        /* En Vickrey la oferta = valor real → no hay mentira */
        ctx.fillText(`$${p.oferta2}`, rx + bw + 8, by + barH - 14);
      }

      /* Línea del segundo precio */
      const bwSeg = (seg2 / 100) * (colW - 20);
      ctx.strokeStyle = GREEN;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(rx + bwSeg, 56);
      ctx.lineTo(rx + bwSeg, H - 30);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = GREEN;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`2do precio: $${seg2}`, rx + bwSeg + 4, 64);

      ctx.fillStyle = GREEN;
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`✓ paga el 2do precio: $${seg2}`, rx + colW / 2, H - 18);
      ctx.fillStyle = MUTED;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`(valor real: $${ps[idx2].valorReal} → dijo la verdad, ganó $${ps[idx2].valorReal - seg2} extra)`, rx + colW / 2, H - 6);

      /* ── Utilidad del vendedor resumida ── */
      // primer precio: ingreso = oferta del ganador
      // segundo precio: ingreso = seg2
      // a largo plazo, con Npostores el ingreso esperado es igual (revenue equivalence)
      // pero en cada ronda individual podemos ver la diferencia
    }

    /* ── IMPUESTO DE MIRRLEES ─────────────────────── */
    function drawImpuesto() {
      if (!ctx) return;
      const tau_ = tauRef.current;
      const th = thetaMaxRef.current;

      const padL = 60, padR = 50, padT = 50, padB = 60;
      const gW = W - padL - padR;
      const gH = H - padT - padB;

      /* ejes */
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padL, padT);
      ctx.lineTo(padL, padT + gH);
      ctx.lineTo(padL + gW, padT + gH);
      ctx.stroke();

      /* etiquetas ejes */
      ctx.fillStyle = '#64748B';
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Tasa marginal de impuesto τ', padL + gW / 2, H - 10);
      ctx.save();
      ctx.translate(14, padT + gH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Recaudación total R(τ)', 0, 0);
      ctx.restore();

      /* ticks eje X */
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      for (let t = 0; t <= 1; t += 0.1) {
        const tx = padL + t * gW;
        ctx.beginPath();
        ctx.moveTo(tx, padT + gH);
        ctx.lineTo(tx, padT + gH + 5);
        ctx.stroke();
        if (t % 0.2 < 0.001) {
          ctx.fillStyle = MUTED;
          ctx.font = '10px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${Math.round(t * 100)}%`, tx, padT + gH + 16);
        }
      }

      /* Curva de Laffer */
      ctx.beginPath();
      let first = true;
      for (let i = 0; i <= 200; i++) {
        const t = i / 200;
        const r = recaudacionNorm(t, th);
        const px = padL + t * gW;
        const py = padT + gH - r * gH * 0.88;
        if (first) { ctx.moveTo(px, py); first = false; }
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();

      /* Relleno bajo la curva */
      ctx.lineTo(padL + gW, padT + gH);
      ctx.lineTo(padL, padT + gH);
      ctx.closePath();
      ctx.fillStyle = ACCENT + '18';
      ctx.fill();

      /* Línea del τ actual */
      const txCurr = padL + tau_ * gW;
      const ryCurr = recaudacionNorm(tau_, th);
      const pyCurr = padT + gH - ryCurr * gH * 0.88;

      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(txCurr, padT + gH);
      ctx.lineTo(txCurr, pyCurr);
      ctx.stroke();
      ctx.setLineDash([]);

      /* Punto en la curva */
      ctx.save();
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(txCurr, pyCurr, 7, 0, Math.PI * 2);
      ctx.fillStyle = GOLD;
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = GOLD;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = txCurr > padL + gW * 0.7 ? 'right' : 'left';
      ctx.fillText(`τ=${Math.round(tau_ * 100)}%`, txCurr + (txCurr > padL + gW * 0.7 ? -10 : 10), pyCurr - 12);
      ctx.fillText(`R=${(ryCurr * 100).toFixed(0)}%`, txCurr + (txCurr > padL + gW * 0.7 ? -10 : 10), pyCurr - 1);

      /* Línea del τ* óptimo */
      const tOpt = tauOptimo();
      const txOpt = padL + tOpt * gW;
      ctx.strokeStyle = GREEN;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(txOpt, padT);
      ctx.lineTo(txOpt, padT + gH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = GREEN;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('τ* óptimo = 50%', txOpt, padT - 6);

      /* Zona de ineficiencia */
      if (tau_ > 0.52) {
        ctx.fillStyle = 'rgba(239,68,68,0.08)';
        ctx.fillRect(txOpt, padT, padL + gW - txOpt, gH);
        ctx.fillStyle = RED;
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('⚠ zona de ineficiencia', txOpt + 8, padT + 14);
        ctx.fillStyle = '#64748B';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText('(la gente trabaja menos → recaudas menos)', txOpt + 8, padT + 26);
      }

      /* Insight dinámico de Mirrlees */
      const rec = (ryCurr * 100).toFixed(0);
      let msg = '';
      if (tau_ < 0.15) {
        msg = `Con τ=${Math.round(tau_ * 100)}% recaudas solo ${rec}% del máximo posible. Los trabajadores se quedan su ingreso pero el Estado no puede financiar nada.`;
      } else if (tau_ < 0.45) {
        msg = `Con τ=${Math.round(tau_ * 100)}% recaudas ${rec}% del máximo. Hay espacio para subir sin que la gente deje de trabajar. Mirrlees diría: puedes pedir más.`;
      } else if (tau_ < 0.55) {
        msg = `Con τ=${Math.round(tau_ * 100)}% estás cerca del óptimo de Mirrlees (50%). Máxima recaudación compatible con incentivos laborales. El SAT de muchos países apunta aquí.`;
      } else if (tau_ < 0.75) {
        msg = `Con τ=${Math.round(tau_ * 100)}% recaudas ${rec}% del máximo. Ya pasaste el pico: cada peso de impuesto extra TE COBRA más en trabajo perdido de lo que ganas. Estás en la parte mala de la curva.`;
      } else {
        msg = `Con τ=${Math.round(tau_ * 100)}% recaudas solo ${rec}% del máximo. ¿Confiscatorio? Sí. La gente trabaja menos, se va al informal, o migra. El modelo de Mirrlees dice: así no.`;
      }
      setInsight(msg);
    }

    function loop() {
      drawFondo();
      if (modoRef.current === 'subasta') drawSubasta();
      else drawImpuesto();
      frameN++;
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(raf); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Acción: nueva ronda de subasta ────────── */
  function nuevaRonda() {
    const p = generarPostores(numPostores);
    setPostores(p);
    setRondas(r => r + 1);

    /* calcula ganancias del VENDEDOR en cada formato */
    const maxOff1 = Math.max(...p.map(x => x.oferta1));
    const sorted2 = [...p].sort((a, b) => b.oferta2 - a.oferta2);
    const seg2 = sorted2[1]?.oferta2 ?? 0;

    setGanancia1Total(prev => prev + maxOff1);
    setGanancia2Total(prev => prev + seg2);
    rondaAnimRef.current = { ganador1: 0, ganador2: 0, tick: 0 };
  }

  /* ─── insight de subasta ─────────────────────── */
  let insightSubasta = '';
  if (postores.length > 0) {
    const max1 = Math.max(...postores.map(x => x.oferta1));
    const sorted2 = [...postores].sort((a, b) => b.oferta2 - a.oferta2);
    const seg2 = sorted2[1]?.oferta2 ?? 0;
    const winner1 = postores.find(p => p.oferta1 === max1);
    const winner2 = sorted2[0];
    if (winner1 && winner2) {
      const mentira1 = winner1.valorReal - winner1.oferta1;
      const ganancia2 = winner2.valorReal - seg2;
      insightSubasta = rondas === 0
        ? 'Mira las barras: en el 1er precio cada quien MIENTE hacia abajo (línea punteada = valor real). En el 2do precio todos dicen la verdad — es estrategia dominante. Dale "Nueva ronda" para ver el patrón acumulado.'
        : `1er precio: ${winner1.nombre} ganó mintiendo $${mentira1} hacia abajo. 2do precio: ${winner2.nombre} dijo la verdad y ganó $${ganancia2} de utilidad. Vendedor: en ${rondas} rondas 1er precio = $${ganancia1Total} vs 2do precio = $${ganancia2Total}.`;
    }
  }

  return (
    <div className="w-full">
      {/* Pestañas de modo */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setModo('subasta'); }}
          className={`px-4 py-2 text-[12px] font-mono rounded border transition ${
            modo === 'subasta'
              ? 'border-[#A78BFA]/60 bg-[#A78BFA]/15 text-[#A78BFA]'
              : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
          }`}
        >
          🔨 Subasta de Vickrey
        </button>
        <button
          onClick={() => { setModo('impuesto'); }}
          className={`px-4 py-2 text-[12px] font-mono rounded border transition ${
            modo === 'impuesto'
              ? 'border-[#A78BFA]/60 bg-[#A78BFA]/15 text-[#A78BFA]'
              : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
          }`}
        >
          📊 Curva de Laffer · Mirrlees
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* CANVAS */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Controles según modo */}
          {modo === 'subasta' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={nuevaRonda}
                className="px-4 py-1.5 text-[12px] font-mono rounded border border-[#A78BFA]/40 bg-[#A78BFA]/10 text-[#A78BFA] hover:bg-[#A78BFA]/20 transition"
              >
                🎲 Nueva ronda
              </button>
              <button
                onClick={() => {
                  setRondas(0);
                  setGanancia1Total(0);
                  setGanancia2Total(0);
                  const p = generarPostores(numPostores);
                  setPostores(p);
                }}
                className="px-4 py-1.5 text-[12px] font-mono rounded border border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1] transition"
              >
                ↺ reiniciar
              </button>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[11px] text-[#64748B] font-mono">rondas:</span>
                <span className="text-[13px] font-mono text-[#FDB813]">{rondas}</span>
              </div>
            </div>
          )}

          {/* Stats de subasta */}
          {modo === 'subasta' && rondas > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Ingreso vendedor · 1er precio" value={`$${ganancia1Total}`} accent={RED} />
              <Stat label="Ingreso vendedor · 2do precio" value={`$${ganancia2Total}`} accent={GREEN} />
            </div>
          )}

          {/* Stats de impuesto */}
          {modo === 'impuesto' && (
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Tasa marginal τ" value={`${Math.round(tau * 100)}%`} accent={GOLD} />
              <Stat label="Recaudación vs máximo" value={`${(recaudacionNorm(tau, thetaMax) * 100).toFixed(0)}%`}
                    accent={tau > 0.55 ? RED : tau > 0.45 ? GREEN : ACCENT} />
              <Stat label="τ* óptimo (Mirrlees)" value="50%" accent={GREEN} />
            </div>
          )}

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#A78BFA] font-mono mb-2">
              ✦ ¿Qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">
              {modo === 'subasta' ? insightSubasta : insight}
            </p>
          </div>
        </div>

        {/* Panel de controles */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ {modo === 'subasta' ? 'Ajusta la subasta' : 'Ajusta el sistema fiscal'}
          </div>

          {modo === 'subasta' && (
            <>
              <Slider
                label="Número de postores"
                value={numPostores}
                min={2}
                max={6}
                step={1}
                onChange={v => setNumPostores(v)}
                fmt={v => `${v} personas`}
                hint="Con más postores la 'mentira óptima' en 1er precio aumenta: oferta_i = V_i · (N-1)/N"
              />
              <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed space-y-1">
                <div>1er precio: estrategia = V·(N-1)/N</div>
                <div>2do precio: estrategia dominante = V (decir verdad)</div>
                <div>Equivalencia de ingresos (Vickrey·Myerson): ambos dan al vendedor el mismo ingreso esperado.</div>
              </div>
            </>
          )}

          {modo === 'impuesto' && (
            <>
              <Slider
                label="Tasa marginal de impuesto τ"
                value={tau}
                min={0.01}
                max={0.99}
                step={0.01}
                onChange={v => setTau(v)}
                fmt={v => `${Math.round(v * 100)}%`}
                hint="Mirrlees probó que subir τ más allá del óptimo reduce la recaudación porque la gente trabaja menos."
              />
              <Slider
                label="Dispersión de habilidades"
                value={thetaMax}
                min={2}
                max={10}
                step={0.5}
                onChange={v => setThetaMax(v)}
                fmt={v => `θ ∈ [1, ${v.toFixed(1)}]`}
                hint="Mayor dispersión significa más desigualdad de ingresos. El τ* no cambia con distribución uniforme — solo la escala de R."
              />
              <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed space-y-1">
                <div>y*(τ) = θ²(1−τ) · ingreso de equilibrio</div>
                <div>R(τ) = τ·E[y*] = τ(1−τ)·E[θ²]</div>
                <div>τ* = argmax R = ½</div>
                <div>(Mirrlees 1971, Rev. Econ. Studies)</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────── */
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
        className="w-full accent-[#A78BFA]"
      />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}
