/**
 * Helpers de terminal para que las lecciones se vean decentes
 * sin dependencias externas. ASCII puro.
 */

const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/** Sparkline unicode para una serie — compresión visual rápida. */
export function sparkline(values: number[], width = 60): string {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = Math.max(1, Math.floor(values.length / width));
  const out: string[] = [];
  for (let i = 0; i < values.length; i += step) {
    const v = values[i];
    const idx = Math.min(7, Math.floor(((v - min) / range) * 8));
    out.push(BLOCKS[idx] ?? '▁');
  }
  return out.join('');
}

/** Multi-serie con colores (ANSI). Ideal para C vs t de varias especies. */
export function multiSparkline(
  series: Record<string, number[]>,
  width = 60,
): string {
  const lines: string[] = [];
  const colors = ['\x1b[36m', '\x1b[33m', '\x1b[32m', '\x1b[35m', '\x1b[31m', '\x1b[34m'];
  const reset = '\x1b[0m';
  let ci = 0;
  for (const [name, values] of Object.entries(series)) {
    const color = colors[ci++ % colors.length];
    const bar = sparkline(values, width);
    const first = values[0].toExponential(2);
    const last = values[values.length - 1].toExponential(2);
    lines.push(`  ${color}${name.padEnd(8)}${reset} ${bar} ${first} → ${last}`);
  }
  return lines.join('\n');
}

/** Gráfica XY simple en ASCII, altura fija. */
export function asciiPlot(
  xs: number[],
  ys: number[],
  opts: { width?: number; height?: number; label?: string } = {},
): string {
  const width = opts.width ?? 70;
  const height = opts.height ?? 15;
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  const grid: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ' '),
  );

  for (let i = 0; i < xs.length; i++) {
    const col = Math.min(width - 1, Math.floor(((xs[i] - xMin) / xRange) * (width - 1)));
    const row = Math.min(
      height - 1,
      Math.max(0, height - 1 - Math.floor(((ys[i] - yMin) / yRange) * (height - 1))),
    );
    grid[row][col] = '●';
  }

  const lines: string[] = [];
  if (opts.label) lines.push(`  ${opts.label}`);
  for (let r = 0; r < height; r++) {
    const prefix = r === 0
      ? yMax.toExponential(2).padStart(9)
      : r === height - 1
        ? yMin.toExponential(2).padStart(9)
        : '         ';
    lines.push(`${prefix} │${grid[r].join('')}`);
  }
  lines.push(`          └${'─'.repeat(width)}`);
  lines.push(
    `           ${xMin.toExponential(2)}${' '.repeat(Math.max(1, width - 18))}${xMax.toExponential(2)}`,
  );
  return lines.join('\n');
}

/** Tabla clásica formateada con columnas alineadas. */
export function table(
  rows: Record<string, string | number>[],
  opts: { cols?: string[]; precision?: number } = {},
): string {
  if (rows.length === 0) return '(vacío)';
  const cols = opts.cols ?? Object.keys(rows[0]);
  const p = opts.precision ?? 4;
  const fmt = (v: string | number): string => {
    if (typeof v === 'number') {
      if (Math.abs(v) >= 1e4 || (v !== 0 && Math.abs(v) < 1e-3)) return v.toExponential(p);
      return v.toFixed(p);
    }
    return String(v);
  };
  const widths = cols.map((c) =>
    Math.max(c.length, ...rows.map((r) => fmt(r[c] ?? '').length)),
  );
  const sep = '─'.repeat(widths.reduce((s, w) => s + w + 3, 1));
  const out: string[] = [sep];
  out.push('│ ' + cols.map((c, i) => c.padEnd(widths[i])).join(' │ ') + ' │');
  out.push(sep);
  for (const row of rows) {
    out.push(
      '│ ' + cols.map((c, i) => fmt(row[c] ?? '').padEnd(widths[i])).join(' │ ') + ' │',
    );
  }
  out.push(sep);
  return out.join('\n');
}

/** Cabecera ornamental de una clase. */
export function title(num: number | string, text: string): string {
  const bar = '═'.repeat(72);
  return `\n\x1b[1m${bar}\n  LECCIÓN ${num} — ${text}\n${bar}\x1b[0m`;
}

/** Párrafo de "pizarra" con indent. */
export function board(text: string): string {
  return text
    .split('\n')
    .map((l) => '  ' + l)
    .join('\n');
}

/** Muestrea N puntos uniformemente de un array largo. */
export function sample<T>(arr: T[], n: number): { idx: number; val: T }[] {
  if (arr.length <= n) return arr.map((val, idx) => ({ idx, val }));
  const out: { idx: number; val: T }[] = [];
  const step = (arr.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) {
    const idx = Math.round(i * step);
    out.push({ idx, val: arr[idx] });
  }
  return out;
}
