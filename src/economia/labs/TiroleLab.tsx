/**
 * TiroleLab — laboratorio del premio Nobel 2014 (Jean Tirole).
 *
 * El click: las plataformas (Visa, App Store, Uber, Mercado Libre) son
 * "mercados de dos lados". Tienen que atraer a DOS tipos de usuario al mismo
 * tiempo — si cobras mal a uno, el otro no entra, y la plataforma muere.
 *
 * Modelo REAL: Rochet & Tirole (2003), "Platform Competition in Two-Sided Markets".
 *
 * Sea A = compradores/usuarios (lado gratuito), B = vendedores/developers (lado que paga).
 *   D_A(p_A, p_B) = max(0, αA − βA·p_A + γA·n_B)   ← usuarios: demanda baja con su precio,
 *                                                        sube con más vendedores (red)
 *   D_B(p_A, p_B) = max(0, αB − βB·p_B + γB·n_A)   ← vendedores: demanda baja con su precio,
 *                                                        sube con más usuarios (red)
 *   n_A = D_A,  n_B = D_B  (equilibrio de punto fijo: efectos de red cruzados)
 *
 * La plataforma tiene costo marginal c por transacción. Maximiza:
 *   π = (p_A − c_A)·n_A + (p_B − c_B)·n_B
 *
 * El lab permite mover p_A y p_B libremente y ver cómo nacen/mueren los dos lados,
 * cómo la externalidad de red conecta ambas demandas, y por qué el precio óptimo
 * puede ser NEGATIVO en un lado (subsidiarlo para enganchar al otro).
 *
 * Se usa iteración de punto fijo para resolver el equilibrio de red en cada frame.
 */

import { useEffect, useRef, useState } from 'react';

// ─── dimensiones ───────────────────────────────────────────────────────────────
const W = 820;
const H = 380;

// ─── parámetros del modelo ──────────────────────────────────────────────────────
// Los tres sliders ajustan los precios de la plataforma a cada lado.
// Los parámetros estructurales (alfa, beta, gamma) los fijamos; el usuario
// puede cambiarlos con el botón de preset.

interface ModelParams {
  pA: number;        // precio al lado A (usuarios/compradores)
  pB: number;        // precio al lado B (vendedores/developers)
  cA: number;        // costo marginal lado A (fijo por preset)
  cB: number;        // costo marginal lado B (fijo por preset)
  alphaA: number;    // demanda base lado A
  alphaB: number;    // demanda base lado B
  betaA: number;     // sensibilidad al precio, lado A
  betaB: number;     // sensibilidad al precio, lado B
  gammaA: number;    // externalidad de red: efecto de n_B sobre D_A
  gammaB: number;    // externalidad de red: efecto de n_A sobre D_B
}

type PresetKey = 'app-store' | 'mercado-libre' | 'visa';

interface Preset {
  label: string;
  subtitle: string;
  sideA: string;
  sideB: string;
  params: ModelParams;
}

const PRESETS: Record<PresetKey, Preset> = {
  'app-store': {
    label: 'App Store',
    subtitle: 'Apple / desarrolladores',
    sideA: 'Usuarios (tú, gratis)',
    sideB: 'Developers (30% comisión)',
    params: {
      pA: 0,
      pB: 30,
      cA: 2,
      cB: 5,
      alphaA: 90,
      alphaB: 60,
      betaA: 1.2,
      betaB: 0.8,
      gammaA: 0.7,
      gammaB: 0.9,
    },
  },
  'mercado-libre': {
    label: 'Mercado Libre',
    subtitle: 'compradores / vendedores',
    sideA: 'Compradores (navegan gratis)',
    sideB: 'Vendedores (comisión ~7%)',
    params: {
      pA: 0,
      pB: 15,
      cA: 1,
      cB: 4,
      alphaA: 80,
      alphaB: 55,
      betaA: 1.0,
      betaB: 0.9,
      gammaA: 0.8,
      gammaB: 0.85,
    },
  },
  visa: {
    label: 'Visa / Tarjeta',
    subtitle: 'tarjetahabientes / comercios',
    sideA: 'Tarjetahabientes (puntos, 0)',
    sideB: 'Comercios (comisión ~2.5%)',
    params: {
      pA: -5,
      pB: 20,
      cA: 3,
      cB: 3,
      alphaA: 70,
      alphaB: 65,
      betaA: 0.9,
      betaB: 0.7,
      gammaA: 0.75,
      gammaB: 0.95,
    },
  },
};

// ─── equilibrio de punto fijo ────────────────────────────────────────────────────
// Resuelve n_A, n_B dadas las ecuaciones de demanda con externalidades de red.
// La demanda de cada lado depende de la participación del otro, así que
// iteramos hasta convergencia (contracción de Banach garantizada para γ·β < 1).
function solveEquilibrium(p: ModelParams): { nA: number; nB: number } {
  let nA = 0;
  let nB = 0;
  // Escala los precios a unidades de demanda (pA está en porcentaje de escala 0-100)
  const scaleP = 0.6; // factor para que precios tengan efecto razonable
  for (let i = 0; i < 80; i++) {
    const newNA = Math.max(0, p.alphaA - p.betaA * p.pA * scaleP + p.gammaA * nB);
    const newNB = Math.max(0, p.alphaB - p.betaB * p.pB * scaleP + p.gammaB * nA);
    if (Math.abs(newNA - nA) < 0.001 && Math.abs(newNB - nB) < 0.001) {
      nA = newNA; nB = newNB; break;
    }
    nA = newNA; nB = newNB;
  }
  // Normalizar a [0, 100]
  const norm = 100;
  return { nA: Math.min(norm, nA), nB: Math.min(norm, nB) };
}

// Beneficio neto (profit) de la plataforma — en unidades adimensionales
function computeProfit(p: ModelParams, nA: number, nB: number): number {
  const scaleP = 0.6;
  return (p.pA * scaleP - p.cA) * nA + (p.pB * scaleP - p.cB) * nB;
}

// ─── helpers de canvas ───────────────────────────────────────────────────────────
// Dibuja una barra horizontal con relleno brillante
function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, maxW: number, h: number,
  fill: number, // 0..1
  color: string,
  label: string,
  valueLabel: string,
) {
  const fillW = Math.max(0, Math.min(maxW, fill * maxW));
  // fondo
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  ctx.roundRect(x, y, maxW, h, 4);
  ctx.fill();
  // relleno
  if (fillW > 0) {
    const grad = ctx.createLinearGradient(x, y, x + fillW, y);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color + 'AA');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, fillW, h, 4);
    ctx.fill();
  }
  // etiqueta izquierda
  ctx.fillStyle = '#94A3B8';
  ctx.font = '11px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y - 5);
  // valor derecha
  ctx.fillStyle = '#E2E8F0';
  ctx.textAlign = 'right';
  ctx.fillText(valueLabel, x + maxW, y - 5);
}

// Dibuja el mapa de calor de ganancia en el espacio (pA, pB)
// Calcula para una grilla de puntos y traza con color
function drawProfitMap(
  ctx: CanvasRenderingContext2D,
  baseParams: ModelParams,
  currentPA: number,
  currentPB: number,
  x0: number, y0: number, mapW: number, mapH: number,
) {
  const cols = 50;
  const rows = 50;
  const cellW = mapW / cols;
  const cellH = mapH / rows;
  const pAmin = -10, pAmax = 60;
  const pBmin = 0, pBmax = 80;

  // Calcular rango de ganancias
  let profMin = Infinity, profMax = -Infinity;
  const profits: number[][] = [];
  for (let r = 0; r < rows; r++) {
    profits[r] = [];
    for (let c = 0; c < cols; c++) {
      const pa = pAmin + (c / (cols - 1)) * (pAmax - pAmin);
      const pb = pBmin + (r / (rows - 1)) * (pBmax - pBmin);
      const p2 = { ...baseParams, pA: pa, pB: pb };
      const { nA, nB } = solveEquilibrium(p2);
      const prof = computeProfit(p2, nA, nB);
      profits[r][c] = prof;
      if (prof < profMin) profMin = prof;
      if (prof > profMax) profMax = prof;
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = (profits[r][c] - profMin) / Math.max(1, profMax - profMin);
      // paleta: azul oscuro → púrpura → naranja dorado
      let red = 0, green = 0, blue = 0;
      if (t < 0.5) {
        const u = t * 2;
        red = Math.round(30 + u * 140);
        green = Math.round(20 + u * 30);
        blue = Math.round(80 + u * 60);
      } else {
        const u = (t - 0.5) * 2;
        red = Math.round(170 + u * 85);
        green = Math.round(50 + u * 120);
        blue = Math.round(140 - u * 100);
      }
      ctx.fillStyle = `rgb(${red},${green},${blue})`;
      ctx.fillRect(x0 + c * cellW, y0 + r * cellH, cellW + 0.5, cellH + 0.5);
    }
  }

  // Ejes del mapa
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, mapW, mapH);

  // Cruz del precio actual
  const cxA = x0 + ((currentPA - pAmin) / (pAmax - pAmin)) * mapW;
  const cyB = y0 + ((currentPB - pBmin) / (pBmax - pBmin)) * mapH;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(cxA, y0); ctx.lineTo(cxA, y0 + mapH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x0, cyB); ctx.lineTo(x0 + mapW, cyB);
  ctx.stroke();
  ctx.setLineDash([]);

  // Punto actual (crosshair)
  ctx.save();
  ctx.shadowColor = '#FDB813';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#FDB813';
  ctx.beginPath();
  ctx.arc(cxA, cyB, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Labels de los ejes
  ctx.fillStyle = '#64748B';
  ctx.font = '9px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('↑ precio a vendedores (pB)', x0 + mapW / 2, y0 - 3);
  ctx.save();
  ctx.translate(x0 - 3, y0 + mapH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('precio a usuarios (pA) →', 0, 0);
  ctx.restore();
}

// ─── componente principal ────────────────────────────────────────────────────────
export default function TiroleLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [preset, setPreset] = useState<PresetKey>('app-store');
  const [pA, setPa] = useState<number>(PRESETS['app-store'].params.pA);
  const [pB, setPb] = useState<number>(PRESETS['app-store'].params.pB);
  const [stats, setStats] = useState<{ nA: number; nB: number; profit: number }>({
    nA: 0, nB: 0, profit: 0,
  });

  // Ref para pintar siempre el último estado sin re-crear el loop
  const stateRef = useRef({ preset, pA, pB });
  useEffect(() => {
    stateRef.current = { preset, pA, pB };
  }, [preset, pA, pB]);

  // Cambiar preset: reinicia precios al valor por defecto del preset
  const applyPreset = (key: PresetKey) => {
    setPreset(key);
    setPa(PRESETS[key].params.pA);
    setPb(PRESETS[key].params.pB);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let frame = 0;

    // Offscreen canvas para el mapa de calor (evita re-escalar cada frame)
    const offscreen = document.createElement('canvas');
    offscreen.width = 180 * dpr;
    offscreen.height = 180 * dpr;
    const offCtx = offscreen.getContext('2d')!;

    function loop() {
      const { preset: pr, pA: pa, pB: pb } = stateRef.current;
      const pset = PRESETS[pr];
      const p = { ...pset.params, pA: pa, pB: pb };

      // Resolver equilibrio
      const { nA, nB } = solveEquilibrium(p);
      const profit = computeProfit(p, nA, nB);

      // Actualizar React stats cada ~6 frames para no sobrecargar
      if (frame % 6 === 0) {
        setStats({ nA: Math.round(nA), nB: Math.round(nB), profit: Math.round(profit) });
      }

      // ── fondo ──
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#05060A');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── título del preset ──
      ctx.fillStyle = '#CBD5E1';
      ctx.font = 'bold 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(pset.label, 16, 22);
      ctx.fillStyle = '#475569';
      ctx.font = '11px ui-sans-serif, system-ui';
      ctx.fillText(pset.subtitle, 16, 36);

      // ── zona izquierda: barras de participación ──
      const barX = 16;
      const barMaxW = 320;
      const barH = 22;

      // Lado A (usuarios)
      const yA = 62;
      drawBar(ctx, barX, yA, barMaxW, barH,
        nA / 100, '#4FC3F7',
        pset.sideA,
        `${Math.round(nA)} de 100`);

      // Indicador de precio A
      const priceAColor = pa < 0 ? '#34D399' : pa === 0 ? '#FDB813' : '#F472B6';
      ctx.fillStyle = priceAColor;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(
        pa < 0
          ? `les pagas $${Math.abs(pa).toFixed(0)} (subsidio)`
          : pa === 0
          ? 'gratis para ellos'
          : `les cobras $${pa.toFixed(0)}`,
        barX,
        yA + barH + 14,
      );

      // Flecha de externalidad de red A→B
      const arrowY1 = 110;
      ctx.strokeStyle = 'rgba(79,195,247,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(barX + (nA / 100) * barMaxW * 0.5, yA + barH + 2);
      ctx.lineTo(barX + 30, arrowY1 + 4);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(79,195,247,0.5)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      const networkTextA = nA > 5
        ? `${Math.round(nA)} usuarios atraen vendedores`
        : 'sin usuarios, vendedores no entran';
      ctx.fillText(networkTextA, barX + 35, arrowY1 + 6);

      // Lado B (vendedores)
      const yB = 130;
      drawBar(ctx, barX, yB, barMaxW, barH,
        nB / 100, '#A78BFA',
        pset.sideB,
        `${Math.round(nB)} de 100`);

      const priceBColor = pb < 0 ? '#34D399' : pb === 0 ? '#FDB813' : '#F472B6';
      ctx.fillStyle = priceBColor;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(
        pb < 0
          ? `les pagas $${Math.abs(pb).toFixed(0)} (subsidio)`
          : pb === 0
          ? 'gratis para ellos'
          : `les cobras $${pb.toFixed(0)}`,
        barX,
        yB + barH + 14,
      );

      // Flecha B→A
      const arrowY2 = 183;
      ctx.strokeStyle = 'rgba(167,139,250,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(barX + (nB / 100) * barMaxW * 0.5, yB + barH + 2);
      ctx.lineTo(barX + 30, arrowY2 + 4);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(167,139,250,0.5)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      const networkTextB = nB > 5
        ? `${Math.round(nB)} vendedores atraen más usuarios`
        : 'sin vendedores, usuarios no vienen';
      ctx.fillText(networkTextB, barX + 35, arrowY2 + 6);

      // ── ganancia de la plataforma ──
      const profitY = 215;
      const profitNorm = Math.max(-1, Math.min(1, profit / 3000));
      const profitBarX = barX;
      const profitBarW = barMaxW;
      const profitBarH = 20;
      // fondo gris
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.roundRect(profitBarX, profitY, profitBarW, profitBarH, 4);
      ctx.fill();
      // barra de ganancia (desde el centro si hay pérdida)
      const midX = profitBarX + profitBarW / 2;
      const barFill = profitNorm * (profitBarW / 2);
      if (barFill !== 0) {
        const profGrad = ctx.createLinearGradient(
          barFill > 0 ? midX : midX + barFill, profitY,
          barFill > 0 ? midX + barFill : midX, profitY,
        );
        profGrad.addColorStop(0, profit >= 0 ? '#FDB813' : '#EF4444');
        profGrad.addColorStop(1, profit >= 0 ? '#F59E0B' : '#DC2626');
        ctx.fillStyle = profGrad;
        ctx.beginPath();
        ctx.roundRect(
          barFill > 0 ? midX : midX + barFill,
          profitY,
          Math.abs(barFill),
          profitBarH,
          2,
        );
        ctx.fill();
      }
      // línea central
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(midX, profitY - 2);
      ctx.lineTo(midX, profitY + profitBarH + 2);
      ctx.stroke();
      // etiqueta
      ctx.fillStyle = '#94A3B8';
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('Ganancia plataforma', profitBarX, profitY - 5);
      ctx.fillStyle = profit >= 0 ? '#FDB813' : '#EF4444';
      ctx.textAlign = 'right';
      ctx.fillText(
        profit >= 0 ? `+${Math.round(profit)}` : `${Math.round(profit)}`,
        profitBarX + profitBarW,
        profitY - 5,
      );

      // ── diagnóstico ──
      const diagY = profitY + profitBarH + 18;
      let diagText = '';
      let diagColor = '#94A3B8';

      if (nA < 10 && nB < 10) {
        diagText = '⚠ plataforma muerta — ningún lado entró';
        diagColor = '#EF4444';
      } else if (nA < 15) {
        diagText = '← pocos usuarios: los vendedores van a irse pronto';
        diagColor = '#FB923C';
      } else if (nB < 15) {
        diagText = '→ pocos vendedores: los usuarios no encontrarán nada';
        diagColor = '#FB923C';
      } else if (profit < 0) {
        diagText = `plataforma pierde dinero ($${Math.abs(Math.round(profit))}) — pero puede vivir si escala`;
        diagColor = '#F472B6';
      } else {
        diagText = '✓ ambos lados activos — la plataforma funciona';
        diagColor = '#34D399';
      }
      ctx.fillStyle = diagColor;
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(diagText, barX, diagY);

      // ── zona derecha: mapa de calor pA × pB ──
      const mapX0 = W - 200;
      const mapY0 = 30;
      const mapW2 = 180;
      const mapH2 = 180;

      // Redibujar el mapa en el offscreen cada frame (50×50 = 2500 pts, rápido)
      if (offCtx) {
        offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
        offCtx.save();
        offCtx.scale(dpr, dpr);
        drawProfitMap(offCtx, pset.params, pa, pb, 0, 0, mapW2, mapH2);
        offCtx.restore();
      }
      ctx.drawImage(offscreen, 0, 0, offscreen.width, offscreen.height,
                    mapX0, mapY0, mapW2, mapH2);

      // ── leyenda del mapa ──
      const legY = mapY0 + mapH2 + 10;
      ctx.fillStyle = '#64748B';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('mapa de ganancia pA×pB', mapX0, legY);
      ctx.fillStyle = 'rgba(30,20,80,0.8)';
      ctx.fillRect(mapX0, legY + 4, 20, 8);
      ctx.fillStyle = '#64748B';
      ctx.fillText('bajo', mapX0 + 23, legY + 12);
      ctx.fillStyle = 'rgba(255,170,40,0.8)';
      ctx.fillRect(mapX0 + 55, legY + 4, 20, 8);
      ctx.fillStyle = '#64748B';
      ctx.fillText('alto', mapX0 + 78, legY + 12);
      ctx.fillStyle = '#FDB813';
      ctx.fillRect(mapX0 + 110, legY + 4, 8, 8);
      ctx.fillStyle = '#64748B';
      ctx.fillText('tú estás aquí', mapX0 + 121, legY + 12);

      // ── etiquetas de eje del mapa ──
      ctx.fillStyle = '#475569';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('pA: −10 … 60', mapX0 + mapW2 / 2, mapY0 + mapH2 + 26);
      ctx.save();
      ctx.translate(mapX0 - 8, mapY0 + mapH2 / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText('pB: 0 … 80', 0, 0);
      ctx.restore();

      // ── consejo de Tirole (esquina inferior) ──
      const tipsY = H - 40;
      ctx.fillStyle = 'rgba(15, 20, 35, 0.7)';
      ctx.fillRect(0, tipsY - 6, W - 210, 46);

      const tips: Array<[string, string]> = [
        ['Precio bajo en A', 'engancha usuarios → vendedores quieren entrar'],
        ['Precio alto en B', 'los vendedores pagan tu negocio'],
        ['Tirole 2003', 'p* ≠ costo marginal — depende de quién vale más para el otro lado'],
      ];
      const tipIdx = Math.floor(frame / 120) % tips.length;
      const [tipKey, tipVal] = tips[tipIdx];
      ctx.fillStyle = '#4FC3F7';
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`◈ ${tipKey}:`, 16, tipsY + 8);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(tipVal, 16, tipsY + 22);

      frame++;
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, []); // solo se crea una vez; lee estado por ref

  const p = PRESETS[preset];

  // Calcular también en React para los sliders (usamos ref para el canvas)
  const currentParams = { ...p.params, pA, pB };
  const { nA: rNa, nB: rNb } = solveEquilibrium(currentParams);
  const rProfit = computeProfit(currentParams, rNa, rNb);

  // Insight contextual
  let insight = '';
  if (rNa < 10 && rNb < 10) {
    insight =
      'La plataforma está muerta: cobraste demasiado a ambos lados y nadie entró. Sin masa crítica, el mercado de dos lados colapsa.';
  } else if (pA < 0) {
    insight = `Estás SUBSIDIANDO a los usuarios ($${Math.abs(pA)} de regalo). Eso suena absurdo, pero Tirole demostró que puede ser óptimo: si el otro lado (vendedores) paga lo suficiente, el subsidio se recupera.`;
  } else if (pA === 0 && pB > 0) {
    insight = `Gratis para usuarios, pagado por vendedores. Así operan App Store, Mercado Libre y Google. El precio cero en un lado no es generosidad — es estrategia de dos lados.`;
  } else if (rProfit < 0) {
    insight = `La plataforma pierde dinero ahora, pero puede crecer con más usuarios. Uber y Mercado Libre perdieron millones al inicio para lograr masa crítica.`;
  } else {
    insight = `Ambos lados activos y ganancia positiva. El "click" de Tirole: el precio justo no depende del costo — depende de quién necesita más al otro lado.`;
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* ─── CANVAS ─── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* ─── STATS ─── */}
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label={`usuarios (${p.sideA.split(' ')[0]})`}
              value={`${stats.nA} / 100`}
              accent="#4FC3F7"
            />
            <Stat
              label={`vendedores (${p.sideB.split(' ')[0]})`}
              value={`${stats.nB} / 100`}
              accent="#A78BFA"
            />
            <Stat
              label="ganancia plataforma"
              value={`${stats.profit >= 0 ? '+' : ''}${stats.profit}`}
              accent={stats.profit >= 0 ? '#FDB813' : '#EF4444'}
            />
          </div>

          {/* ─── INSIGHT ─── */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">
              ✦ ¿Qué está pasando?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ─── CONTROLES ─── */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Elige la plataforma
          </div>

          {/* Selector de preset */}
          <div className="flex flex-col gap-2">
            {(Object.keys(PRESETS) as PresetKey[]).map(key => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                className={`px-3 py-2 text-[11px] font-mono rounded border text-left transition ${
                  preset === key
                    ? 'border-[#4FC3F7]/60 bg-[#4FC3F7]/10 text-[#4FC3F7]'
                    : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1] hover:border-[#2E3E55]'
                }`}
              >
                <span className="font-bold">{PRESETS[key].label}</span>
                <span className="block text-[10px] mt-0.5 text-[#475569]">
                  {PRESETS[key].subtitle}
                </span>
              </button>
            ))}
          </div>

          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono pt-2 border-t border-[#1E293B]">
            ⚙ Mueve los precios
          </div>

          {/* Slider pA */}
          <Slider
            label={`Precio a usuarios (pA)`}
            sublabel={p.sideA}
            value={pA}
            min={-20}
            max={60}
            step={1}
            onChange={setPa}
            fmt={v =>
              v < 0 ? `subsidio $${Math.abs(v)}` : v === 0 ? 'gratis' : `$${v}`
            }
            hint="Negativo = les pagas (subsidio). 0 = gratis. Positivo = les cobras."
            accent="#4FC3F7"
          />

          {/* Slider pB */}
          <Slider
            label={`Precio a vendedores (pB)`}
            sublabel={p.sideB}
            value={pB}
            min={0}
            max={80}
            step={1}
            onChange={setPb}
            fmt={v => (v === 0 ? 'gratis' : `$${v} / transacción`)}
            hint="Este lado financia la plataforma. Súbelo y verás cuándo se van."
            accent="#A78BFA"
          />

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo: Rochet & Tirole (2003)<br />
            D_A = αA − βA·pA + γA·n_B<br />
            D_B = αB − βB·pB + γB·n_A<br />
            π = (pA − cA)·nA + (pB − cB)·nB<br />
            <span className="text-[#334155]">
              · punto fijo de efectos de red cruzados
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── sub-componentes ─────────────────────────────────────────────────────────────

function Stat({
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
  sublabel,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
  hint,
  accent,
}: {
  label: string;
  sublabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[12px] font-mono" style={{ color: accent ?? '#FDB813' }}>
          {fmt ? fmt(value) : value.toFixed(0)}
        </span>
      </div>
      <div className="text-[10px] text-[#475569] mb-1">{sublabel}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#4FC3F7]"
      />
      {hint && (
        <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>
      )}
    </div>
  );
}
