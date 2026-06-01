/**
 * NashLab — laboratorio del premio 1994 (Nash, Harsanyi, Selten).
 *
 * El click: cuando todos eligen la mejor respuesta a lo que los demás hacen,
 * nadie tiene razón para moverse solo. Ese punto se llama equilibrio de Nash.
 *
 * El lab muestra el Dilema del Prisionero 2×2 generalizado con pagos ajustables:
 *
 *              Jugador B: Cooperar   Jugador B: Traicionar
 *  Jugador A: Cooperar    (R, R)          (S, T)
 *  Jugador A: Traicionar  (T, S)          (P, P)
 *
 *  Donde:  T > R > P > S   → Dilema del Prisionero clásico.
 *
 *  Mejor respuesta de A dado que B hace X:
 *    Si B coopera  → A compara R vs T → elige Traicionar si T > R (siempre).
 *    Si B traiciona → A compara S vs P → elige Traicionar si P > S (siempre).
 *  → Traicionar es estrategia dominante → equilibrio de Nash = (Traicionar, Traicionar).
 *
 *  Paradoja: (Cooperar, Cooperar) da R > P a ambos, pero ninguno llega ahí solo.
 *
 *  Cuando el usuario mueve los pagos de modo que T < R (¡elige cooperar!), el juego
 *  deja de ser Dilema del Prisionero y el equilibrio cambia. El lab lo detecta y
 *  muestra el nuevo equilibrio en tiempo real.
 *
 *  La animación: dos "jugadores" (esferas) con flechas de mejor-respuesta dibujadas
 *  en canvas 2D. Las flechas apuntan a la casilla óptima desde cada posición.
 *  Un "rondas" iterado muestra cómo la dinámica de mejor-respuesta converge al NE.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/* ───────────────── constantes de layout ───────────────── */
const W = 820;
const H = 380;

/* Células de la matriz 2×2 (esquinas en canvas) */
const MATRIX_LEFT   = 180;
const MATRIX_TOP    = 80;
const CELL_W        = 200;
const CELL_H        = 110;
const MATRIX_RIGHT  = MATRIX_LEFT + CELL_W * 2;
const MATRIX_BOTTOM = MATRIX_TOP  + CELL_H * 2;

/* Colores de acento */
const CLR_A  = '#A78BFA';   // jugador A — violeta
const CLR_B  = '#34D399';   // jugador B — verde
const CLR_NE = '#FDB813';   // equilibrio — ámbar
const BG     = '#0B0F17';

/* ───────────────── tipos ───────────────── */
type Action = 0 | 1;  // 0 = Cooperar, 1 = Traicionar

interface Payoffs {
  T: number;   // Tentación (traicionar cuando el otro coopera)
  R: number;   // Recompensa (ambos cooperan)
  P: number;   // Punición (ambos traicionan)
  S: number;   // Sucker (cooperar cuando el otro traiciona)
}

interface RoundRecord {
  a: Action;
  b: Action;
  scoreA: number;
  scoreB: number;
}

/* ───────────────── helpers de juego ───────────────── */
/** Pago que recibe el jugador A dado sus acciones. */
function payA(a: Action, b: Action, pw: Payoffs): number {
  if (a === 0 && b === 0) return pw.R;
  if (a === 0 && b === 1) return pw.S;
  if (a === 1 && b === 0) return pw.T;
  return pw.P;
}

/** Mejor respuesta de A dado que B juega b. */
function bestResponseA(b: Action, pw: Payoffs): Action {
  const ifCoop = payA(0, b, pw);
  const ifBet  = payA(1, b, pw);
  return ifBet >= ifCoop ? 1 : 0;
}

function bestResponseB(a: Action, pw: Payoffs): Action {
  // Juego simétrico: por simetría la mejor respuesta de B es igual a la de A
  // con sus filas y columnas intercambiadas. En el dilema simétrico es idéntico.
  const ifCoop = payA(a, 0, pw);  // B coopera → pago de A es payA(a,0) pero necesitamos el de B
  // Pago de B = pago de A cuando los roles se invierten (juego simétrico)
  const bPayIfCoop = payA(0, a, pw);   // B coopera
  const bPayIfBet  = payA(1, a, pw);   // B traiciona
  return bPayIfBet >= bPayIfCoop ? 1 : 0;
}

/**
 * Detecta los equilibrios de Nash puro en el juego 2×2 simétrico.
 * Devuelve los pares (a,b) que son NE.
 */
function findNashEquilibria(pw: Payoffs): Array<[Action, Action]> {
  const pairs: Array<[Action, Action]> = [[0,0],[0,1],[1,0],[1,1]];
  return pairs.filter(([a, b]) => {
    // A no quiere desviarse
    const bestA = bestResponseA(b, pw);
    // B no quiere desviarse
    const bestB = bestResponseB(a, pw);
    return bestA === a && bestB === b;
  });
}

/* ───────────────── sub-componentes UI ───────────────── */
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3 min-w-0">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1 truncate">{label}</div>
      <div className="text-[18px] font-bold font-mono leading-tight" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange, fmt, hint }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string; hint?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[12px] font-mono text-[#FDB813]">{fmt ? fmt(value) : value.toFixed(1)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={e => onChange(Number(e.target.value))} className="w-full accent-[#A78BFA]" />
      {hint && <div className="text-[10px] text-[#475569] leading-snug">{hint}</div>}
    </div>
  );
}

/* ───────────────── componente principal ───────────────── */
export default function NashLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* Pagos — defaults = Dilema del Prisionero clásico */
  const [T, setT] = useState(5);   // Tentación
  const [R, setR] = useState(3);   // Recompensa mutua
  const [P, setP] = useState(1);   // Punición mutua
  const [S, setS] = useState(0);   // Sucker

  /* Selección manual del jugador A en el lab */
  const [choiceA, setChoiceA] = useState<Action>(0);
  const [choiceB, setChoiceB] = useState<Action>(0);

  /* Historial de rondas iteradas */
  const [rounds, setRounds] = useState<RoundRecord[]>([]);
  const [totalA, setTotalA] = useState(0);
  const [totalB, setTotalB] = useState(0);

  /* Modo auto: la IA juega mejor respuesta */
  const [autoPlay, setAutoPlay] = useState(false);
  const autoRef = useRef(false);
  autoRef.current = autoPlay;

  /* Ref de payoffs para el canvas */
  const pwRef = useRef<Payoffs>({ T, R, P, S });
  const choiceRef = useRef<{ a: Action; b: Action }>({ a: choiceA, b: choiceB });

  useEffect(() => { pwRef.current = { T, R, P, S }; }, [T, R, P, S]);
  useEffect(() => { choiceRef.current = { a: choiceA, b: choiceB }; }, [choiceA, choiceB]);

  /* ── auto-play ── */
  useEffect(() => {
    if (!autoPlay) return;
    const iv = window.setInterval(() => {
      const pw = pwRef.current;
      const prev = choiceRef.current;
      // Dinámica de mejor respuesta: cada jugador reacciona al movimiento del otro
      const newA = bestResponseA(prev.b, pw);
      const newB = bestResponseB(prev.a, pw);
      setChoiceA(newA);
      setChoiceB(newB);
    }, 800);
    return () => window.clearInterval(iv);
  }, [autoPlay]);

  /* ── función para jugar una ronda ── */
  const playRound = useCallback((a: Action, b: Action) => {
    const pw = pwRef.current;
    const sA = payA(a, b, pw);
    const sB = payA(b, a, pw);   // juego simétrico
    const rec: RoundRecord = { a, b, scoreA: sA, scoreB: sB };
    setRounds(prev => [rec, ...prev].slice(0, 8));
    setTotalA(prev => prev + sA);
    setTotalB(prev => prev + sB);
    setChoiceA(a);
    setChoiceB(b);
  }, []);

  const resetRounds = useCallback(() => {
    setRounds([]);
    setTotalA(0);
    setTotalB(0);
    setChoiceA(0);
    setChoiceB(0);
  }, []);

  /* ── canvas 2D ── */
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

    let raf = 0;
    let t = 0;

    function cellCenter(col: number, row: number): [number, number] {
      const x = MATRIX_LEFT + col * CELL_W + CELL_W / 2;
      const y = MATRIX_TOP  + row * CELL_H + CELL_H / 2;
      return [x, y];
    }

    function drawArrow(x1: number, y1: number, x2: number, y2: number, color: string, alpha: number) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) { ctx.restore(); return; }
      const ux = dx / len, uy = dy / len;
      const shortX = x2 - ux * 14, shortY = y2 - uy * 14;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(shortX, shortY);
      ctx.stroke();
      // punta
      ctx.save();
      ctx.translate(x2, y2);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.beginPath();
      ctx.moveTo(-14, -5);
      ctx.lineTo(0, 0);
      ctx.lineTo(-14, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.restore();
    }

    function draw() {
      if (!ctx) return;
      t += 0.025;
      const pw  = pwRef.current;
      const sel = choiceRef.current;
      const ne  = findNashEquilibria(pw);

      /* ── fondo ── */
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      /* ── etiquetas de columnas (Jugador B) ── */
      ctx.fillStyle = CLR_B;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('B: Cooperar', MATRIX_LEFT + CELL_W / 2, MATRIX_TOP - 28);
      ctx.fillText('B: Traicionar', MATRIX_LEFT + CELL_W * 1.5, MATRIX_TOP - 28);

      /* ── etiqueta de filas (Jugador A) ── */
      ctx.save();
      ctx.translate(MATRIX_LEFT - 28, MATRIX_TOP + CELL_H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = CLR_A;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('A: Cooperar', 0, 0);
      ctx.restore();

      ctx.save();
      ctx.translate(MATRIX_LEFT - 28, MATRIX_TOP + CELL_H * 1.5);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = CLR_A;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('A: Traicionar', 0, 0);
      ctx.restore();

      /* ── cabecera izquierda ── */
      ctx.fillStyle = '#334155';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Jugador B →', MATRIX_LEFT + CELL_W, MATRIX_TOP - 48);
      ctx.save();
      ctx.translate(MATRIX_LEFT - 48, MATRIX_TOP + CELL_H);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Jugador A ↓', 0, 0);
      ctx.restore();

      /* ── celdas de la matriz 2×2 ── */
      const cells: Array<{ col: number; row: number; a: Action; b: Action }> = [
        { col: 0, row: 0, a: 0, b: 0 },
        { col: 1, row: 0, a: 0, b: 1 },
        { col: 0, row: 1, a: 1, b: 0 },
        { col: 1, row: 1, a: 1, b: 1 },
      ];

      for (const cell of cells) {
        const x = MATRIX_LEFT + cell.col * CELL_W;
        const y = MATRIX_TOP  + cell.row * CELL_H;

        const isSelected = sel.a === cell.a && sel.b === cell.b;
        const isNE       = ne.some(([na, nb]) => na === cell.a && nb === cell.b);

        /* Fondo de celda */
        if (isNE) {
          ctx.fillStyle = `rgba(253,184,19,0.12)`;
        } else if (isSelected) {
          ctx.fillStyle = `rgba(167,139,250,0.10)`;
        } else {
          ctx.fillStyle = `rgba(30,41,59,0.6)`;
        }
        ctx.fillRect(x + 2, y + 2, CELL_W - 4, CELL_H - 4);

        /* Borde */
        if (isNE) {
          ctx.strokeStyle = CLR_NE;
          ctx.lineWidth = isSelected ? 2.5 : 1.5;
          const glow = Math.sin(t * 2) * 0.3 + 0.7;
          ctx.globalAlpha = glow;
        } else if (isSelected) {
          ctx.strokeStyle = CLR_A;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 1;
        } else {
          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 1;
          ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        ctx.rect(x + 2, y + 2, CELL_W - 4, CELL_H - 4);
        ctx.stroke();
        ctx.globalAlpha = 1;

        /* Pago de A */
        const pA = payA(cell.a, cell.b, pw);
        const pB = payA(cell.b, cell.a, pw);
        const cx = x + CELL_W / 2;
        const cy = y + CELL_H / 2;

        ctx.font = 'bold 22px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = CLR_A;
        ctx.fillText(`${pA}`, cx - 20, cy + 4);
        ctx.fillStyle = '#475569';
        ctx.font = '14px ui-monospace, monospace';
        ctx.fillText(',', cx, cy + 4);
        ctx.fillStyle = CLR_B;
        ctx.font = 'bold 22px ui-monospace, monospace';
        ctx.fillText(`${pB}`, cx + 22, cy + 4);

        /* Etiqueta A,B pequeña */
        ctx.fillStyle = '#334155';
        ctx.font = '9px ui-sans-serif, system-ui';
        ctx.fillText('A   B', cx, cy - 20);

        /* Estrella NE */
        if (isNE) {
          ctx.fillStyle = CLR_NE;
          ctx.font = 'bold 11px ui-sans-serif';
          ctx.fillText('⬡ Nash', cx, cy + 28);
        }
      }

      /* ── líneas de la cuadrícula ── */
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1;
      // borde exterior
      ctx.beginPath();
      ctx.rect(MATRIX_LEFT, MATRIX_TOP, CELL_W * 2, CELL_H * 2);
      ctx.stroke();
      // línea media vertical
      ctx.beginPath();
      ctx.moveTo(MATRIX_LEFT + CELL_W, MATRIX_TOP);
      ctx.lineTo(MATRIX_LEFT + CELL_W, MATRIX_BOTTOM);
      ctx.stroke();
      // línea media horizontal
      ctx.beginPath();
      ctx.moveTo(MATRIX_LEFT, MATRIX_TOP + CELL_H);
      ctx.lineTo(MATRIX_RIGHT, MATRIX_TOP + CELL_H);
      ctx.stroke();

      /* ── flechas de mejor respuesta ── */
      // Para cada columna de B (b=0, b=1) → flecha desde la peor resp de A a la mejor
      for (const bAct of [0, 1] as Action[]) {
        const brA = bestResponseA(bAct, pw);
        const badA: Action = brA === 0 ? 1 : 0;
        const [x1, y1] = cellCenter(bAct, badA);
        const [x2, y2] = cellCenter(bAct, brA);
        if (y1 !== y2) drawArrow(x1, y1, x2, y2, CLR_A, 0.55);
      }
      // Para cada fila de A → flecha mejor resp de B
      for (const aAct of [0, 1] as Action[]) {
        const brB = bestResponseB(aAct, pw);
        const badB: Action = brB === 0 ? 1 : 0;
        const [x1, y1] = cellCenter(badB, aAct);
        const [x2, y2] = cellCenter(brB, aAct);
        if (x1 !== x2) drawArrow(x1, y1, x2, y2, CLR_B, 0.55);
      }

      /* ── indicador de selección actual ── */
      {
        const [sx, sy] = cellCenter(sel.b, sel.a);
        ctx.save();
        ctx.globalAlpha = 0.7 + Math.sin(t * 3) * 0.3;
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        const r = 26;
        ctx.beginPath();
        ctx.arc(sx, sy - 10, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      /* ── panel derecho: info del juego ── */
      const panelX = MATRIX_RIGHT + 22;
      const panelW = W - panelX - 10;

      // Tipo de juego
      const isPD = T > R && R > P && P > S;
      const isCoopBest = R >= T;

      ctx.fillStyle = isPD ? '#EF4444' : '#34D399';
      ctx.font = `bold 11px ui-sans-serif, system-ui`;
      ctx.textAlign = 'left';
      const gameLabel = isPD ? 'DILEMA DEL PRISIONERO' : (isCoopBest ? 'JUEGO DE COORDINACIÓN' : 'JUEGO ASIMÉTRICO');
      ctx.fillText(gameLabel, panelX, MATRIX_TOP + 10);

      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`T=${T} R=${R} P=${P} S=${S}`, panelX, MATRIX_TOP + 28);

      // NE actuales
      ctx.fillStyle = CLR_NE;
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.fillText('Equilibrio(s) de Nash:', panelX, MATRIX_TOP + 56);
      const neLabels = ne.map(([a, b]) =>
        `(${a === 0 ? 'Coop' : 'Trai'}, ${b === 0 ? 'Coop' : 'Trai'})`
      );
      ctx.fillStyle = '#FDB813';
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillText(neLabels.join(' · ') || '(ninguno puro)', panelX, MATRIX_TOP + 74);

      // Pago óptimo social
      const socialBest = Math.max(payA(0,0,pw)*2, payA(0,1,pw)+payA(1,0,pw), payA(1,1,pw)*2);
      const neSocial   = ne.reduce((acc, [a,b]) => Math.max(acc, payA(a,b,pw)+payA(b,a,pw)), 0);
      const loss = socialBest - neSocial;

      if (loss > 0) {
        ctx.fillStyle = '#F472B6';
        ctx.font = 'bold 10px ui-sans-serif, system-ui';
        ctx.fillText(`Costo de no cooperar: −${loss}`, panelX, MATRIX_TOP + 100);
        ctx.fillStyle = '#6B21A8';
        ctx.font = '9px ui-sans-serif, system-ui';
        ctx.fillText('(cooperar daría más a los dos)', panelX, MATRIX_TOP + 116);
      } else {
        ctx.fillStyle = '#34D399';
        ctx.font = '10px ui-sans-serif, system-ui';
        ctx.fillText('El NE es óptimo social ✓', panelX, MATRIX_TOP + 100);
      }

      // Pago actual seleccionado
      const curPA = payA(sel.a, sel.b, pw);
      const curPB = payA(sel.b, sel.a, pw);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText('Casilla marcada:', panelX, MATRIX_TOP + 148);
      ctx.fillStyle = CLR_A;
      ctx.font = 'bold 13px ui-monospace, monospace';
      ctx.fillText(`A: ${curPA}`, panelX, MATRIX_TOP + 168);
      ctx.fillStyle = CLR_B;
      ctx.fillText(`B: ${curPB}`, panelX + 60, MATRIX_TOP + 168);

      // Leyenda de colores
      ctx.fillStyle = CLR_A;
      ctx.fillRect(panelX, MATRIX_TOP + 198, 10, 10);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '9px ui-sans-serif, system-ui';
      ctx.fillText('→ mejor resp. de A', panelX + 14, MATRIX_TOP + 208);

      ctx.fillStyle = CLR_B;
      ctx.fillRect(panelX, MATRIX_TOP + 214, 10, 10);
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('→ mejor resp. de B', panelX + 14, MATRIX_TOP + 224);

      ctx.fillStyle = CLR_NE;
      ctx.fillRect(panelX, MATRIX_TOP + 230, 10, 10);
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('→ equilibrio Nash', panelX + 14, MATRIX_TOP + 240);

      /* ── pie: descripción dinámica ── */
      let msg = '';
      if (isPD) {
        if (sel.a === 1 && sel.b === 1) {
          msg = '⚠ Ambos traicionan: atrapados en el NE. Juntos ganan más cooperando, pero ninguno se mueve.';
        } else if (sel.a === 0 && sel.b === 0) {
          msg = '✓ Ambos cooperan — el mejor resultado social. Pero es inestable: cada quien quiere traicionar.';
        } else {
          msg = `A ${sel.a === 0 ? 'coopera' : 'traiciona'} / B ${sel.b === 0 ? 'coopera' : 'traiciona'}. El que coopera recibe el peor pago.`;
        }
      } else if (isCoopBest) {
        msg = ne.some(([a,b]) => a===0 && b===0) ?
          '✓ Cooperar es la mejor respuesta de ambos — el NE coincide con el óptimo social.' :
          'Modifica los pagos. Cooperar es tentador pero el NE puede ser mixto.';
      } else {
        msg = `Tus pagos crean un juego distinto. NE: ${neLabels.join(', ') || 'ninguno puro'}.`;
      }

      ctx.fillStyle = '#94A3B8';
      ctx.font = '11px ui-sans-serif, system-ui';
      ctx.textAlign = 'left';
      // wrap sencillo por carácter
      if (ctx.measureText(msg).width > W - 20) {
        const half = Math.floor(msg.length / 2);
        const sp = msg.lastIndexOf(' ', half);
        ctx.fillText(msg.slice(0, sp), 10, H - 22);
        ctx.fillText(msg.slice(sp + 1), 10, H - 8);
      } else {
        ctx.fillText(msg, 10, H - 12);
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ── lógica de Nash para el panel React ── */
  const pw = { T, R, P, S };
  const ne = findNashEquilibria(pw);
  const isPD = T > R && R > P && P > S;
  const neLabels = ne.map(([a, b]) =>
    `(${a === 0 ? 'Cooperar' : 'Traicionar'}, ${b === 0 ? 'Cooperar' : 'Traicionar'})`
  );

  const insight = isPD
    ? ne.some(([a, b]) => a === 1 && b === 1)
      ? 'Ambos traicionan aunque cooperar daría más. Nadie se mueve solo porque desviarse empeora su resultado — eso es el equilibrio de Nash: una trampa lógica perfecta.'
      : 'Ajusta los pagos. Cuando T > R > P > S, Traicionar es siempre la mejor respuesta y el dilema emerge.'
    : 'Cambiaste los pagos fuera del Dilema del Prisionero. El equilibrio se mueve. Observa las flechas: te dicen la mejor respuesta en cada caso.';

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

          {/* Botones de selección manual */}
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#64748B] font-mono">
              Haz clic: ¿qué harías tú?
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([ [0,0],[0,1],[1,0],[1,1] ] as [Action,Action][]).map(([a, b]) => {
                const sel = choiceA === a && choiceB === b;
                const isNE = ne.some(([na, nb]) => na === a && nb === b);
                return (
                  <button
                    key={`${a}-${b}`}
                    onClick={() => playRound(a, b)}
                    className={`px-3 py-2 text-[12px] font-mono rounded border transition text-left ${
                      sel
                        ? 'border-[#A78BFA]/70 bg-[#A78BFA]/15 text-[#A78BFA]'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-[#CBD5E1]'
                    }`}
                  >
                    <span style={{ color: CLR_A }}>A: {a === 0 ? 'Cooperar' : 'Traicionar'}</span>
                    {' · '}
                    <span style={{ color: CLR_B }}>B: {b === 0 ? 'Cooperar' : 'Traicionar'}</span>
                    {isNE && <span className="ml-1 text-[#FDB813]">⬡</span>}
                    <span className="ml-2 text-[#475569]">
                      ({payA(a, b, pw)},{payA(b, a, pw)})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Control auto + reset */}
            <div className="flex gap-2">
              <button
                onClick={() => setAutoPlay(v => !v)}
                className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                  autoPlay
                    ? 'border-[#34D399]/50 bg-[#34D399]/10 text-[#34D399]'
                    : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
                }`}
              >
                {autoPlay ? '⏸ detener dinámica' : '▶ dinámica de mejor respuesta'}
              </button>
              <button
                onClick={resetRounds}
                className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1] transition"
              >
                ↺ reiniciar
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="NE del juego" value={neLabels[0]?.replace('Cooperar','Coop').replace('Traicionar','Trai') ?? '—'} accent={CLR_NE} />
            <Stat label="acum. A" value={String(totalA)} accent={CLR_A} />
            <Stat label="acum. B" value={String(totalB)} accent={CLR_B} />
          </div>

          {/* Historial */}
          {rounds.length > 0 && (
            <div className="bg-[#070A11] border border-[#1E293B] rounded-lg p-3 space-y-1">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#475569] font-mono mb-2">Últimas rondas</div>
              {rounds.map((r, i) => (
                <div key={i} className="flex items-center gap-3 text-[11px] font-mono">
                  <span style={{ color: CLR_A }}>{r.a === 0 ? 'Coop' : 'Trai'}</span>
                  <span className="text-[#334155]">vs</span>
                  <span style={{ color: CLR_B }}>{r.b === 0 ? 'Coop' : 'Trai'}</span>
                  <span className="ml-auto text-[#475569]">A:{r.scoreA} B:{r.scoreB}</span>
                </div>
              ))}
            </div>
          )}

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#A78BFA] font-mono mb-2">✦ ¿Qué estás viendo?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── panel de controles ── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ Pagos del juego</div>

          <div className="text-[11px] text-[#64748B] leading-relaxed">
            T = Tentación · R = Recompensa · P = Punición · S = Sucumbir<br />
            <span className="text-[#A78BFA]">Dilema del Prisionero: T &gt; R &gt; P &gt; S</span>
          </div>

          <SliderRow
            label="T — Tentación (traicionar solo)"
            value={T} min={1} max={8} step={0.5}
            onChange={v => setT(v)}
            fmt={v => v.toFixed(1)}
            hint="Qué tanto ganas si traicionas mientras el otro coopera."
          />
          <SliderRow
            label="R — Recompensa (ambos cooperan)"
            value={R} min={1} max={8} step={0.5}
            onChange={v => setR(v)}
            fmt={v => v.toFixed(1)}
            hint="Qué ganas si ambos cooperan. ¿Vale más que Traicionar?"
          />
          <SliderRow
            label="P — Punición (ambos traicionan)"
            value={P} min={0} max={6} step={0.5}
            onChange={v => setP(v)}
            fmt={v => v.toFixed(1)}
            hint="Qué ganas cuando ambos traicionan — el equilibrio de Nash clásico."
          />
          <SliderRow
            label="S — Sucumbir (cooperas solo)"
            value={S} min={0} max={4} step={0.5}
            onChange={v => setS(v)}
            fmt={v => v.toFixed(1)}
            hint="Qué recibes si cooperas y el otro te traiciona. El peor caso."
          />

          <div className={`rounded-md p-3 text-[11px] leading-relaxed ${
            isPD ? 'bg-[#2A0B0B] border border-[#991B1B] text-[#FCA5A5]'
                 : 'bg-[#062E20] border border-[#047857] text-[#6EE7B7]'
          }`}>
            {isPD
              ? 'T > R > P > S: Dilema del Prisionero. Traicionar domina. El NE es malo para todos.'
              : R >= T
                ? 'R ≥ T: Cooperar ya no es la peor decisión. El NE cambia — ¡mira las flechas!'
                : 'Juego con estructura diferente. Observa qué equilibrio emerge.'}
          </div>

          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3 space-y-1">
            <div className="text-[10px] text-[#475569] font-mono mb-1">Estrategia taquera</div>
            <p className="text-[11px] text-[#64748B] leading-relaxed">
              El taquero y su competidor de enfrente no se destruyen en guerra de
              precios porque saben que si uno baja, el otro baja y ambos pierden.
              Eso es (Traicionar, Traicionar) con P bajo. Cuando P sube (la guerra
              cuesta más), el equilibrio cambia.
            </p>
          </div>

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo: juego 2×2 en forma normal<br />
            NE: ningún jugador quiere desviarse solo<br />
            Nash, "Non-Cooperative Games" · 1951 · Nobel 1994
          </div>
        </div>

      </div>
    </div>
  );
}
