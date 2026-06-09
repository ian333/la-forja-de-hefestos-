/**
 * symbols.tsx — primitivas SVG de esquemático eléctrico.
 *
 * Cada símbolo ocupa LEN px entre sus dos pines y se dibuja horizontal
 * (de izquierda a derecha) o vertical (de arriba a abajo). El paleo de
 * colores sale del design system "Oro Divino" (main.css).
 */
import type { ReactNode } from 'react';

export const GRID = 60; // separación entre pines de un símbolo
const STROKE = '#a0947e';
const HOT = '#d4b050';

interface Sym {
  x: number;
  y: number;
  horizontal?: boolean;
  label?: string;
  value?: string;
  /** Resalta el símbolo (energizado). */
  hot?: boolean;
}

/** Envoltura que orienta el símbolo: dibuja horizontal y rota si es vertical. */
function Oriented({ x, y, horizontal = true, children }: Sym & { children: ReactNode }) {
  const transform = horizontal ? `translate(${x} ${y})` : `translate(${x} ${y}) rotate(90)`;
  return <g transform={transform}>{children}</g>;
}

function Caption({ label, value, horizontal = true, hot }: Sym) {
  if (!label && !value) return null;
  const fill = hot ? HOT : '#c9bfa8';
  // texto perpendicular al cuerpo
  if (horizontal) {
    return (
      <text x={GRID / 2} y={-13} textAnchor="middle" fontSize={11} fill={fill} fontFamily="JetBrains Mono, monospace">
        {label}{value ? ` ${value}` : ''}
      </text>
    );
  }
  return (
    <text x={GRID / 2} y={-13} textAnchor="middle" fontSize={11} fill={fill} fontFamily="JetBrains Mono, monospace" transform="rotate(0)">
      {label}{value ? ` ${value}` : ''}
    </text>
  );
}

export function Resistor(p: Sym) {
  const s = p.hot ? HOT : STROKE;
  return (
    <Oriented {...p}>
      <line x1={0} y1={0} x2={12} y2={0} stroke={s} strokeWidth={2} />
      <polyline
        points="12,0 16,-7 24,7 32,-7 40,7 44,0"
        fill="none"
        stroke={s}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <line x1={44} y1={0} x2={GRID} y2={0} stroke={s} strokeWidth={2} />
      {!p.horizontal ? null : null}
      <g transform={p.horizontal ? '' : `translate(${GRID / 2} 0) rotate(-90) translate(${-GRID / 2} 0)`}>
        <Caption {...p} horizontal />
      </g>
    </Oriented>
  );
}

export function Capacitor(p: Sym) {
  const s = p.hot ? HOT : STROKE;
  return (
    <Oriented {...p}>
      <line x1={0} y1={0} x2={26} y2={0} stroke={s} strokeWidth={2} />
      <line x1={26} y1={-12} x2={26} y2={12} stroke={s} strokeWidth={2} />
      <line x1={34} y1={-12} x2={34} y2={12} stroke={s} strokeWidth={2} />
      <line x1={34} y1={0} x2={GRID} y2={0} stroke={s} strokeWidth={2} />
      <g transform={p.horizontal ? '' : `translate(${GRID / 2} 0) rotate(-90) translate(${-GRID / 2} 0)`}>
        <Caption {...p} horizontal />
      </g>
    </Oriented>
  );
}

export function Inductor(p: Sym) {
  const s = p.hot ? HOT : STROKE;
  return (
    <Oriented {...p}>
      <line x1={0} y1={0} x2={10} y2={0} stroke={s} strokeWidth={2} />
      <path
        d="M10,0 a5,5 0 0 1 10,0 a5,5 0 0 1 10,0 a5,5 0 0 1 10,0 a5,5 0 0 1 10,0"
        fill="none"
        stroke={s}
        strokeWidth={2}
      />
      <line x1={50} y1={0} x2={GRID} y2={0} stroke={s} strokeWidth={2} />
      <g transform={p.horizontal ? '' : `translate(${GRID / 2} 0) rotate(-90) translate(${-GRID / 2} 0)`}>
        <Caption {...p} horizontal />
      </g>
    </Oriented>
  );
}

/** Fuente de voltaje (círculo con +/−). Pin A (izq/arriba) es el +. */
export function Source(p: Sym & { ac?: boolean }) {
  const s = p.hot ? HOT : STROKE;
  return (
    <Oriented {...p}>
      <line x1={0} y1={0} x2={18} y2={0} stroke={s} strokeWidth={2} />
      <circle cx={GRID / 2} cy={0} r={12} fill="#1e2538" stroke={s} strokeWidth={2} />
      {p.ac ? (
        <path d={`M${GRID / 2 - 7},0 q3.5,-7 7,0 q3.5,7 7,0`} fill="none" stroke={s} strokeWidth={1.5} />
      ) : (
        <>
          <text x={GRID / 2 - 5} y={-3} fontSize={11} fill={s} textAnchor="middle">+</text>
          <text x={GRID / 2 + 6} y={3} fontSize={12} fill={s} textAnchor="middle">−</text>
        </>
      )}
      <line x1={42} y1={0} x2={GRID} y2={0} stroke={s} strokeWidth={2} />
      <g transform={p.horizontal ? '' : `translate(${GRID / 2} 0) rotate(-90) translate(${-GRID / 2} 0)`}>
        <Caption {...p} horizontal />
      </g>
    </Oriented>
  );
}

/** Diodo. Pin A = ánodo (triángulo), pin B = cátodo (barra). */
export function Diode(p: Sym) {
  const s = p.hot ? HOT : STROKE;
  return (
    <Oriented {...p}>
      <line x1={0} y1={0} x2={20} y2={0} stroke={s} strokeWidth={2} />
      <polygon points="20,-9 20,9 36,0" fill={p.hot ? HOT : '#2f3852'} stroke={s} strokeWidth={2} />
      <line x1={36} y1={-9} x2={36} y2={9} stroke={s} strokeWidth={2} />
      <line x1={36} y1={0} x2={GRID} y2={0} stroke={s} strokeWidth={2} />
      <g transform={p.horizontal ? '' : `translate(${GRID / 2} 0) rotate(-90) translate(${-GRID / 2} 0)`}>
        <Caption {...p} horizontal />
      </g>
    </Oriented>
  );
}

/** Símbolo de tierra en (x,y), apuntando hacia abajo. */
export function Ground({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={STROKE} strokeWidth={2}>
      <line x1={0} y1={0} x2={0} y2={8} />
      <line x1={-10} y1={8} x2={10} y2={8} />
      <line x1={-6} y1={13} x2={6} y2={13} />
      <line x1={-2} y1={18} x2={2} y2={18} />
    </g>
  );
}

/** Cable poligonal. */
export function Wire({ points, hot }: { points: string; hot?: boolean }) {
  return <polyline points={points} fill="none" stroke={hot ? HOT : STROKE} strokeWidth={2} strokeLinejoin="round" />;
}

/** Nodo con etiqueta de voltaje en vivo. */
export function NodeProbe({ x, y, v, name }: { x: number; y: number; v: number; name?: string }) {
  // color por signo/magnitud: cálido = positivo alto, frío = ~0
  const mag = Math.min(1, Math.abs(v) / 12);
  const color = v >= 0 ? `rgb(${212},${Math.round(176 - mag * 60)},${Math.round(80 - mag * 40)})` : '#60a5fa';
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cx={0} cy={0} r={4} fill={color} stroke="#181d2e" strokeWidth={1} />
      <rect x={8} y={-9} width={54} height={16} rx={3} fill="#181d2e" opacity={0.85} />
      <text x={11} y={3} fontSize={11} fill="#f0ece4" fontFamily="JetBrains Mono, monospace">
        {name ? `${name} ` : ''}{v.toFixed(2)}V
      </text>
    </g>
  );
}
