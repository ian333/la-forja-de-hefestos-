/**
 * ConcentrationChart — gráfica Canvas 2D de concentración vs. tiempo.
 *
 * Render eficiente sin dependencias de charting. Soporta:
 *   - Múltiples series con colores consistentes por especie
 *   - Leyenda integrada
 *   - Highlight del tiempo actual (cursor vertical)
 *   - Autoescala de ejes
 */

import { useEffect, useRef } from 'react';

interface ConcentrationChartProps {
  t: number[];
  C: Record<string, number[]>;
  colors?: Record<string, string>;
  /** Tiempo actual para dibujar cursor vertical */
  currentT?: number;
  height?: number;
  /** Etiqueta eje Y (default "C (mol/L)") */
  yLabel?: string;
  /** Etiqueta eje X (default "t (s)") */
  xLabel?: string;
}

const DEFAULT_COLORS = ['#0696D7', '#E8A417', '#22C55E', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F59E0B'];

function formatNum(v: number): string {
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1e4 || abs < 1e-3) return v.toExponential(1);
  if (abs < 1) return v.toFixed(3);
  if (abs < 100) return v.toFixed(2);
  return v.toFixed(0);
}

export default function ConcentrationChart({
  t,
  C,
  colors,
  currentT,
  height = 300,
  yLabel = 'C (mol/L)',
  xLabel = 't (s)',
}: ConcentrationChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    const wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const width = wrap.clientWidth;
    cv.width = width * dpr;
    cv.height = height * dpr;
    cv.style.width = width + 'px';
    cv.style.height = height + 'px';

    const ctx = cv.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Márgenes
    const ml = 60, mr = 20, mt = 16, mb = 40;
    const plotW = width - ml - mr;
    const plotH = height - mt - mb;

    if (t.length === 0) {
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '14px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('Presiona ▶ para simular', width / 2, height / 2);
      return;
    }

    // Rangos
    const tMin = t[0];
    const tMax = t[t.length - 1];
    let yMin = Infinity, yMax = -Infinity;
    for (const sp of Object.keys(C)) {
      for (const v of C[sp]) {
        if (v < yMin) yMin = v;
        if (v > yMax) yMax = v;
      }
    }
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) { yMin = 0; yMax = 1; }
    if (yMax === yMin) yMax = yMin + 1;
    // Pad superior
    const ySpan = yMax - yMin;
    yMax += ySpan * 0.05;
    yMin = Math.max(0, yMin - ySpan * 0.05);
    const tSpan = tMax - tMin || 1;
    const ySpanPad = yMax - yMin || 1;

    const px = (tt: number): number => ml + ((tt - tMin) / tSpan) * plotW;
    const py = (yy: number): number => mt + (1 - (yy - yMin) / ySpanPad) * plotH;

    // Fondo del área de plot
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(ml, mt, plotW, plotH);

    // Grid
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    ctx.font = '11px JetBrains Mono';
    ctx.fillStyle = '#6B7280';

    // Y-grid
    const nYTicks = 5;
    for (let i = 0; i <= nYTicks; i++) {
      const y = mt + (plotH * i) / nYTicks;
      ctx.beginPath();
      ctx.moveTo(ml, y);
      ctx.lineTo(ml + plotW, y);
      ctx.stroke();
      const val = yMax - (ySpanPad * i) / nYTicks;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatNum(val), ml - 6, y);
    }

    // X-grid
    const nXTicks = 6;
    for (let i = 0; i <= nXTicks; i++) {
      const x = ml + (plotW * i) / nXTicks;
      ctx.beginPath();
      ctx.moveTo(x, mt);
      ctx.lineTo(x, mt + plotH);
      ctx.stroke();
      const val = tMin + (tSpan * i) / nXTicks;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(formatNum(val), x, mt + plotH + 6);
    }

    // Ejes
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ml, mt);
    ctx.lineTo(ml, mt + plotH);
    ctx.lineTo(ml + plotW, mt + plotH);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = '#374151';
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(xLabel, ml + plotW / 2, height - 4);
    ctx.save();
    ctx.translate(14, mt + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // Series
    const speciesList = Object.keys(C);
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    speciesList.forEach((sp, i) => {
      const color = colors?.[sp] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      ctx.strokeStyle = color;
      ctx.beginPath();
      const series = C[sp];
      for (let j = 0; j < t.length; j++) {
        const X = px(t[j]);
        const Y = py(series[j]);
        if (j === 0) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      }
      ctx.stroke();
    });

    // Cursor en t actual
    if (currentT !== undefined && currentT >= tMin && currentT <= tMax) {
      const xC = px(currentT);
      ctx.strokeStyle = '#0696D7';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(xC, mt);
      ctx.lineTo(xC, mt + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Leyenda
    let lx = ml + 10;
    const ly = mt + 10;
    ctx.font = '12px Inter';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    speciesList.forEach((sp, i) => {
      const color = colors?.[sp] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      ctx.fillStyle = color;
      ctx.fillRect(lx, ly - 6, 12, 3);
      ctx.fillStyle = '#1F2937';
      ctx.fillText(sp, lx + 18, ly);
      lx += ctx.measureText(sp).width + 38;
    });
  }, [t, C, colors, currentT, height, yLabel, xLabel]);

  return (
    <div ref={wrapRef} className="w-full rounded-xl border border-[#E5E7EB] bg-white">
      <canvas ref={canvasRef} />
    </div>
  );
}
