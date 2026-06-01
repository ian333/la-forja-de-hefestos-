/**
 * MechanismDesignLab — Premio Nobel 2007 (Hurwicz, Maskin, Myerson)
 *
 * El click: si los participantes pueden mentir, ¿qué reglas inventas para que
 * digan la verdad? El diseño de mecanismos es ingeniería de incentivos.
 *
 * Demo: subasta de PRIMER PRECIO vs SEGUNDO PRECIO.
 *   - Subasta de primer precio: gana el que más ofrece, paga lo que ofreció.
 *     → Los jugadores tienen incentivo de "shade" (ofertar menos que su valor
 *     real para no pagar de más). Estrategia óptima: b_i = v_i * (N-1)/N
 *     (equilibrio de Nash bayesiano con N competidores, valores uniformes).
 *   - Subasta de segundo precio (Vickrey): gana el que más ofrece, pero paga
 *     lo que ofreció el SEGUNDO. → Domina ofertar el valor verdadero: si subes
 *     la oferta, pagas más sin necesidad; si la bajas, puedes perder un trato
 *     que valías más. REVELAR LA VERDAD es estrategia dominante.
 *   - Teorema de equivalencia de ingresos: ambas generan el mismo ingreso
 *     esperado para el vendedor (Myerson 1981).
 *
 * El usuario fija su valor personal y el número de competidores (N-1 rivales
 * con valores uniformes en [0,100]). El lab simula muchas rondas, compara
 * ganancias bajo ambos mecanismos y muestra la "horquilla del mentiroso".
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const W = 820;
const H = 380;

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface AuctionParams {
  myValue: number;      // valor verdadero del usuario [0,100]
  nBidders: number;     // número TOTAL de participantes (incluyendo el usuario)
  myBidFirst: number;   // su oferta manual en primer precio
  rounds: number;       // cuántas rondas simular
}

interface RoundResult {
  mechanism: 'first' | 'second';
  myBid: number;
  winningBid: number;
  secondBid: number;
  won: boolean;
  profit: number;  // valor - precio_pagado (0 si pierde)
}

interface SimStats {
  firstWinRate: number;
  secondWinRate: number;
  firstAvgProfit: number;
  secondAvgProfit: number;
  firstAvgRevenue: number;
  secondAvgRevenue: number;
  lastFirstRound: RoundResult | null;
  lastSecondRound: RoundResult | null;
}

// ─── Matemáticas reales ──────────────────────────────────────────────────────

/** Equilibrio de Nash bayesiano: oferta óptima en primer precio con N rivales
 *  valores i.i.d. U[0, V_MAX]. b*(v) = v * (N-1)/N */
function optimalFirstBid(value: number, nBidders: number): number {
  return value * (nBidders - 1) / nBidders;
}

/** Corre una ronda de subasta de primer precio.
 *  Todos los rivales tienen valores U[0,100] y usan la estrategia óptima. */
function runFirstPrice(
  myValue: number,
  myBid: number,
  nBidders: number,
  rng: () => number,
): RoundResult {
  let winningRivalBid = 0;
  for (let i = 1; i < nBidders; i++) {
    const rv = rng() * 100;
    const rb = optimalFirstBid(rv, nBidders);
    if (rb > winningRivalBid) winningRivalBid = rb;
  }
  const won = myBid > winningRivalBid;
  const profit = won ? myValue - myBid : 0;
  return {
    mechanism: 'first',
    myBid,
    winningBid: won ? myBid : winningRivalBid,
    secondBid: won ? winningRivalBid : 0,
    won,
    profit,
  };
}

/** Corre una ronda de subasta de segundo precio.
 *  Estrategia dominante: myBid = myValue.
 *  Precio pagado = máxima oferta rival (si gana). */
function runSecondPrice(
  myValue: number,
  nBidders: number,
  rng: () => number,
): RoundResult {
  const myBid = myValue; // revelar verdad es dominante
  let maxRival = 0;
  let secondRival = 0;
  for (let i = 1; i < nBidders; i++) {
    const rv = rng() * 100; // rival también revela su valor verdadero
    if (rv > maxRival) { secondRival = maxRival; maxRival = rv; }
    else if (rv > secondRival) secondRival = rv;
  }
  const won = myBid > maxRival;
  const pricePaid = won ? maxRival : 0;
  const profit = won ? myValue - pricePaid : 0;
  return {
    mechanism: 'second',
    myBid,
    winningBid: won ? myBid : maxRival,
    secondBid: won ? maxRival : 0,
    won,
    profit,
  };
}

function simulate(params: AuctionParams, rounds: number): SimStats {
  // LCG determinista para reproducibilidad
  let seed = 42;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 4294967296;
  };

  let fw = 0, sw = 0, fp = 0, sp = 0, fr = 0, sr = 0;
  let lastFirst: RoundResult | null = null;
  let lastSecond: RoundResult | null = null;

  for (let r = 0; r < rounds; r++) {
    const f = runFirstPrice(params.myValue, params.myBidFirst, params.nBidders, rng);
    const s = runSecondPrice(params.myValue, params.nBidders, rng);
    if (f.won) fw++;
    if (s.won) sw++;
    fp += f.profit;
    sp += s.profit;
    fr += f.won ? f.myBid : f.winningBid;
    sr += s.won ? s.myBid : s.winningBid;
    if (r === rounds - 1) { lastFirst = f; lastSecond = s; }
  }

  return {
    firstWinRate: fw / rounds,
    secondWinRate: sw / rounds,
    firstAvgProfit: fp / rounds,
    secondAvgProfit: sp / rounds,
    firstAvgRevenue: fr / rounds,
    secondAvgRevenue: sr / rounds,
    lastFirstRound: lastFirst,
    lastSecondRound: lastSecond,
  };
}

// ─── Paleta ──────────────────────────────────────────────────────────────────

const COL = {
  bg: '#0B0F17',
  bgDark: '#070A11',
  accent: '#A78BFA',        // violeta (bloque juegos-mecanismos)
  accentDim: '#6D28D9',
  gold: '#FDB813',
  green: '#34D399',
  red: '#EF4444',
  blue: '#4FC3F7',
  orange: '#FB923C',
  grid: '#1E293B',
  text: '#E2E8F0',
  dim: '#64748B',
};

// ─── Dibujo principal ────────────────────────────────────────────────────────

function draw(
  ctx: CanvasRenderingContext2D,
  params: AuctionParams,
  stats: SimStats,
): void {
  const { myValue, nBidders, myBidFirst } = params;
  const optBid = optimalFirstBid(myValue, nBidders);

  // Fondo
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, COL.bg);
  bg.addColorStop(1, COL.bgDark);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Gráfica de distribución de ofertas en primer precio ──
  // Muestra la función de oferta óptima b*(v) = v*(N-1)/N sobre [0,100]
  const chartX = 44;
  const chartY = 28;
  const chartW = 360;
  const chartH = 220;

  // Rejilla
  ctx.strokeStyle = COL.grid;
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const yy = chartY + (i / 4) * chartH;
    ctx.beginPath(); ctx.moveTo(chartX, yy); ctx.lineTo(chartX + chartW, yy); ctx.stroke();
    const val = Math.round(100 - (i / 4) * 100);
    ctx.fillStyle = COL.dim;
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${val}`, chartX - 4, yy + 3);
  }
  // Eje X
  ctx.beginPath(); ctx.moveTo(chartX, chartY + chartH); ctx.lineTo(chartX + chartW, chartY + chartH);
  ctx.strokeStyle = COL.grid; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = COL.dim; ctx.font = '9px ui-monospace'; ctx.textAlign = 'center';
  ctx.fillText('valor real v', chartX + chartW / 2, chartY + chartH + 14);

  // Títulos de columnas
  ctx.fillStyle = COL.accent;
  ctx.font = 'bold 11px ui-sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('función de oferta óptima', chartX + chartW / 2, chartY - 10);

  // Línea de 45° (verdad completa)
  ctx.beginPath();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = COL.dim;
  ctx.lineWidth = 1.2;
  for (let i = 0; i <= 60; i++) {
    const v = (i / 60) * 100;
    const px = chartX + (v / 100) * chartW;
    const py = chartY + chartH - (v / 100) * chartH;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COL.dim;
  ctx.font = '9px ui-monospace';
  ctx.textAlign = 'left';
  ctx.fillText('b=v (verdad)', chartX + chartW * 0.6 + 2, chartY + chartH * 0.3);

  // Curva de shading — primer precio
  ctx.beginPath();
  ctx.strokeStyle = COL.gold;
  ctx.lineWidth = 2;
  for (let i = 0; i <= 60; i++) {
    const v = (i / 60) * 100;
    const b = optimalFirstBid(v, nBidders);
    const px = chartX + (v / 100) * chartW;
    const py = chartY + chartH - (b / 100) * chartH;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.fillStyle = COL.gold;
  ctx.font = '9px ui-monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`1er precio: b=(N-1)/N·v`, chartX + 4, chartY + chartH * 0.88);

  // Línea de segundo precio (siempre b=v)
  ctx.beginPath();
  ctx.strokeStyle = COL.blue;
  ctx.lineWidth = 2;
  for (let i = 0; i <= 60; i++) {
    const v = (i / 60) * 100;
    const px = chartX + (v / 100) * chartW;
    const py = chartY + chartH - (v / 100) * chartH;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.fillStyle = COL.blue;
  ctx.font = '9px ui-monospace';
  ctx.textAlign = 'left';
  ctx.fillText('2do precio: b=v (dom.)', chartX + 4, chartY + chartH * 0.96);

  // Marca del valor del usuario
  const ux = chartX + (myValue / 100) * chartW;
  // Línea vertical
  ctx.beginPath();
  ctx.strokeStyle = COL.accent;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.moveTo(ux, chartY);
  ctx.lineTo(ux, chartY + chartH);
  ctx.stroke();
  ctx.setLineDash([]);

  // Punto: oferta óptima 1er precio
  const optBidY = chartY + chartH - (optBid / 100) * chartH;
  ctx.beginPath();
  ctx.arc(ux, optBidY, 5, 0, Math.PI * 2);
  ctx.fillStyle = COL.gold;
  ctx.fill();
  ctx.strokeStyle = '#FFF';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Punto: oferta 2do precio
  const trueY = chartY + chartH - (myValue / 100) * chartH;
  ctx.beginPath();
  ctx.arc(ux, trueY, 5, 0, Math.PI * 2);
  ctx.fillStyle = COL.blue;
  ctx.fill();
  ctx.strokeStyle = '#FFF';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Tu oferta manual vs óptima — badge
  const badgeX = ux + 8;
  const badgeY = optBidY - 20;
  ctx.fillStyle = COL.gold;
  ctx.font = 'bold 10px ui-monospace';
  ctx.textAlign = 'left';
  const myBidDiff = myBidFirst - optBid;
  const diffStr = myBidDiff >= 0 ? `+${myBidDiff.toFixed(1)}` : `${myBidDiff.toFixed(1)}`;
  ctx.fillText(`tu oferta ${myBidFirst.toFixed(0)} (óptima ${optBid.toFixed(0)}, ${diffStr})`, badgeX, badgeY);

  // ── Panel derecho: comparativa de mecanismos ──
  const px2 = chartX + chartW + 28;
  const colW = W - px2 - 16;

  // Encabezado
  ctx.fillStyle = COL.accent;
  ctx.font = 'bold 11px ui-sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('simulación de mecanismos', px2, chartY + 2);

  // Subpanel tabla
  const rows: Array<{ label: string; first: string; second: string; better: 'first' | 'second' | 'tie' }> = [
    {
      label: 'tu oferta',
      first: `${myBidFirst.toFixed(1)}`,
      second: `${myValue.toFixed(1)} (≡ valor)`,
      better: 'tie',
    },
    {
      label: 'oferta óptima',
      first: `${optBid.toFixed(1)}`,
      second: `${myValue.toFixed(1)}`,
      better: 'tie',
    },
    {
      label: '% victorias',
      first: `${(stats.firstWinRate * 100).toFixed(0)}%`,
      second: `${(stats.secondWinRate * 100).toFixed(0)}%`,
      better: stats.secondWinRate >= stats.firstWinRate ? 'second' : 'first',
    },
    {
      label: 'ganancia prom.',
      first: `${stats.firstAvgProfit.toFixed(1)}`,
      second: `${stats.secondAvgProfit.toFixed(1)}`,
      better: stats.secondAvgProfit > stats.firstAvgProfit + 0.5 ? 'second'
            : stats.firstAvgProfit > stats.secondAvgProfit + 0.5 ? 'first' : 'tie',
    },
    {
      label: 'ingreso vendedor',
      first: `${stats.firstAvgRevenue.toFixed(1)}`,
      second: `${stats.secondAvgRevenue.toFixed(1)}`,
      better: 'tie',
    },
  ];

  const rowH = 30;
  const tableY = chartY + 22;
  const col1 = px2;
  const col2 = px2 + 108;
  const col3 = px2 + colW * 0.55;

  // Cabecera columnas
  ctx.font = '10px ui-monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = COL.gold;
  ctx.fillText('1er precio', col2, tableY - 2);
  ctx.fillStyle = COL.blue;
  ctx.fillText('2do precio', col3, tableY - 2);

  rows.forEach((row, i) => {
    const ry = tableY + 10 + i * rowH;
    // Fondo alterno
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(167,139,250,0.04)';
      ctx.fillRect(col1 - 2, ry - 14, colW, rowH - 2);
    }
    ctx.fillStyle = COL.dim;
    ctx.font = '10px ui-monospace';
    ctx.textAlign = 'left';
    ctx.fillText(row.label, col1, ry);

    const c1 = row.better === 'first' ? COL.green : COL.gold;
    const c2 = row.better === 'second' ? COL.green : COL.blue;
    ctx.fillStyle = c1;
    ctx.font = 'bold 11px ui-monospace';
    ctx.fillText(row.first, col2, ry);
    ctx.fillStyle = c2;
    ctx.fillText(row.second, col3, ry);
  });

  // ── Zona inferior: "horquilla del mentiroso" ──
  const barY = chartY + chartH + 36;
  const barH = 18;
  const barW = chartW;

  ctx.fillStyle = COL.dim;
  ctx.font = '10px ui-sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('zona de mentira óptima (primer precio)', chartX, barY - 4);

  // Barra: [0, v] → zona shaded
  const bxTrue = chartX + (myValue / 100) * barW;
  const bxOpt = chartX + (optBid / 100) * barW;
  const bxMy = chartX + Math.min(myBidFirst / 100, 1) * barW;

  // Fondo barra completa
  ctx.fillStyle = '#14213D';
  ctx.fillRect(chartX, barY, barW, barH);

  // Zona de shading (entre optBid y myValue)
  if (bxOpt < bxTrue) {
    ctx.fillStyle = 'rgba(253,184,19,0.22)';
    ctx.fillRect(bxOpt, barY, bxTrue - bxOpt, barH);
  }

  // Marca valor verdadero
  ctx.fillStyle = COL.blue;
  ctx.fillRect(bxTrue - 1.5, barY - 4, 3, barH + 8);
  ctx.fillStyle = COL.blue;
  ctx.font = '9px ui-monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`v=${myValue.toFixed(0)}`, bxTrue, barY + barH + 14);

  // Marca oferta óptima
  ctx.fillStyle = COL.gold;
  ctx.fillRect(bxOpt - 1.5, barY - 4, 3, barH + 8);
  ctx.fillStyle = COL.gold;
  ctx.textAlign = 'center';
  ctx.fillText(`b*=${optBid.toFixed(0)}`, bxOpt, barY - 6);

  // Marca oferta manual
  if (Math.abs(bxMy - bxOpt) > 4) {
    ctx.fillStyle = COL.accent;
    ctx.fillRect(bxMy - 1.5, barY, 3, barH);
    ctx.fillStyle = COL.accent;
    ctx.textAlign = 'center';
    ctx.fillText(`tú=${myBidFirst.toFixed(0)}`, bxMy, barY + barH + 26);
  }

  // Etiqueta izquierda/derecha de zona
  ctx.fillStyle = COL.gold;
  ctx.font = '9px ui-monospace';
  ctx.textAlign = 'left';
  ctx.fillText('shading →', bxOpt + 4, barY + 12);

  // ── Panel derecho inferior: explicación del teorema ──
  const thmY = chartY + chartH + 28;
  ctx.fillStyle = 'rgba(167,139,250,0.07)';
  ctx.fillRect(px2 - 2, thmY - 2, colW + 4, H - thmY - 4);

  ctx.fillStyle = COL.accent;
  ctx.font = 'bold 10px ui-sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Teorema de equiv. de ingresos (Myerson 1981)', px2, thmY + 12);

  ctx.fillStyle = COL.text;
  ctx.font = '10px ui-sans-serif';
  const revDiff = Math.abs(stats.firstAvgRevenue - stats.secondAvgRevenue);
  const lines = [
    `1er precio ingreso: ${stats.firstAvgRevenue.toFixed(2)}`,
    `2do precio ingreso: ${stats.secondAvgRevenue.toFixed(2)}`,
    `diferencia: ${revDiff.toFixed(2)} → ${revDiff < 3 ? '✓ equiv. (n>' + params.rounds / 100 + '00 rondas)' : 'varía con muestras finitas'}`,
  ];
  lines.forEach((l, i) => {
    ctx.fillText(l, px2, thmY + 28 + i * 16);
  });

  ctx.fillStyle = COL.dim;
  ctx.font = '9px ui-sans-serif';
  ctx.fillText(`N=${nBidders} participantes · ${params.rounds} rondas simuladas`, px2, H - 12);
}

// ─── Componente principal ────────────────────────────────────────────────────

const DEFAULTS: AuctionParams = {
  myValue: 70,
  nBidders: 4,
  myBidFirst: 52,
  rounds: 2000,
};

export default function MechanismDesignLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<AuctionParams>({ ...DEFAULTS });
  const statsRef = useRef<SimStats>(simulate(DEFAULTS, DEFAULTS.rounds));

  const [myValue, setMyValue] = useState(DEFAULTS.myValue);
  const [nBidders, setNBidders] = useState(DEFAULTS.nBidders);
  const [myBidFirst, setMyBidFirst] = useState(DEFAULTS.myBidFirst);
  const [rounds] = useState(DEFAULTS.rounds);
  const [stats, setStats] = useState<SimStats>(() => simulate(DEFAULTS, DEFAULTS.rounds));

  // Sincroniza params ref y recalcula (solo cuando cambian los parámetros)
  const recalc = useCallback((p: AuctionParams) => {
    paramsRef.current = p;
    const s = simulate(p, p.rounds);
    statsRef.current = s;
    setStats(s);
  }, []);

  useEffect(() => {
    recalc({ myValue, nBidders, myBidFirst, rounds });
  }, [myValue, nBidders, myBidFirst, rounds, recalc]);

  // Canvas rAF — solo redibuja, nunca re-simula
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
    function loop() {
      draw(ctx!, paramsRef.current, statsRef.current);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const optBid = optimalFirstBid(myValue, nBidders);
  const shading = myValue - optBid;
  const profitDiff = stats.secondAvgProfit - stats.firstAvgProfit;

  // Insight dinámico
  const insight: string = (() => {
    if (myBidFirst > myValue) {
      return `Ofertaste más de tu valor verdadero ($${myBidFirst} > $${myValue}). Si ganas, pagas más de lo que vale para ti — ya perdiste dinero. Nunca conviene en ningún mecanismo.`;
    }
    if (Math.abs(myBidFirst - optBid) < 2) {
      return `Oferta muy cerca de la óptima ($${optBid.toFixed(0)}). En primer precio así mientes justo lo suficiente: tu "shading" de $${shading.toFixed(0)} maximiza ganancia esperada dado que hay ${nBidders - 1} rivales. Bien jugado.`;
    }
    if (myBidFirst > optBid) {
      return `Ofertaste $${myBidFirst} pero la óptima era $${optBid.toFixed(0)}. Ganás más seguido, pero pagas de más cuando ganás — tus ganancias se reducen. Las reglas de primer precio siempre te empujan a mentir a la baja.`;
    }
    return `Ofertaste $${myBidFirst}, menos que la óptima ($${optBid.toFixed(0)}). Ganas menos rondas de las que podrías. El diseño de mecanismos dice: la oferta óptima en primer precio es exactamente (N-1)/N de tu valor real.`;
  })();

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

        {/* Canvas */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="oferta óptima 1er precio"
              value={`$${optBid.toFixed(1)}`}
              accent={COL.gold}
            />
            <StatCard
              label="shading (mentira óptima)"
              value={`$${shading.toFixed(1)}`}
              accent="#FB923C"
            />
            <StatCard
              label="ganancia extra 2do precio"
              value={profitDiff >= 0 ? `+$${profitDiff.toFixed(1)}` : `−$${(-profitDiff).toFixed(1)}`}
              accent={profitDiff >= 0 ? COL.green : COL.red}
            />
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#A78BFA] font-mono mb-2">
              ✦ ¿Qué ves aquí?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* Panel de controles */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Diseña el mecanismo
          </div>

          <Slider
            label="Tu valor verdadero"
            value={myValue}
            min={10}
            max={100}
            step={1}
            onChange={(v) => setMyValue(v)}
            fmt={(v) => `$${v}`}
            hint="¿Cuánto vale para ti el objeto? Solo tú lo sabes — el mecanismo no puede verlo."
          />

          <Slider
            label="Tu oferta en primer precio"
            value={myBidFirst}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setMyBidFirst(v)}
            fmt={(v) => `$${v}`}
            hint={`Óptima: $${optBid.toFixed(1)} = valor × (N-1)/N. En 2do precio siempre ofertas $${myValue} sin pensarlo.`}
          />

          <Slider
            label="Número de participantes (N)"
            value={nBidders}
            min={2}
            max={10}
            step={1}
            onChange={(v) => {
              setNBidders(v);
              // Actualizar oferta manual al óptimo nuevo automáticamente
              setMyBidFirst(Math.round(optimalFirstBid(myValue, v)));
            }}
            fmt={(v) => `${v} personas`}
            hint="Más rivales → más shading. Con N→∞ todos ofrecen b=v aunque sea primer precio (la verdad emerge de la presión)."
          />

          <div className="border-t border-[#1E293B] pt-4 space-y-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#64748B] font-mono">
              ¿Por qué el 2do precio es "mejor"?
            </div>
            <p className="text-[11px] text-[#64748B] leading-snug">
              En primer precio tienes que adivinar cuánto van a ofertar los rivales. En segundo precio
              no importa qué hagan: revelar tu valor siempre es tu mejor jugada. Eso se llama
              <span className="text-[#A78BFA]"> estrategia dominante</span>.
            </p>
            <p className="text-[11px] text-[#64748B] leading-snug">
              Myerson (1981) demostró que ambos mecanismos dan el mismo ingreso al vendedor —
              <span className="text-[#A78BFA]"> teorema de equivalencia de ingresos</span>.
              La diferencia está en quién carga la incertidumbre: el comprador (1er precio) o el vendedor.
            </p>
          </div>

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo: Nash bayesiano · b*(v) = v·(N-1)/N<br />
            Hurwicz 1972 · Maskin 1999 · Myerson 1981<br />
            comité Nobel 2007
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers UI ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">
        {label}
      </div>
      <div className="text-[19px] font-bold font-mono" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
  hint,
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
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#A78BFA]"
      />
      {hint && (
        <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>
      )}
    </div>
  );
}
