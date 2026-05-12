/**
 * Derivada como recta tangente — Spivak cap. 10, definición por límite.
 *
 *   f'(x₀) = lim_{h→0} [f(x₀+h) − f(x₀)] / h
 *
 * Ves la recta secante "colapsar" hacia la recta tangente mientras h → 0.
 * Ese momento — cuando la secante deja de ser una aproximación y se vuelve
 * la dirección instantánea — es el corazón del cálculo diferencial.
 *
 * Comparamos en vivo:
 *   • Derivada numérica (diferencia centrada de 4to orden)
 *   • Derivada analítica (cerrada para cada preset)
 * El error |numérica − analítica| es típicamente < 1e-9 para h razonable.
 *
 * Casos pedagógicos:
 *   • x²        → f'(x) = 2x, suave en todo ℝ
 *   • sin x     → f'(x) = cos x, idénticamente acotada
 *   • e^x       → f'(x) = e^x, la única función que es su propia derivada
 *   • |x|       → NO diferenciable en 0 (cusp). Ves el "salto" en h→0.
 *   • √x        → f'(x) = 1/(2√x), explota en x=0
 */

import { useMemo, useState } from 'react';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

interface DerivState {
  fnId: string;
  x0: number;
  logH: number;
}

const LESSON: Lesson<DerivState> = {
  hook: {
    title: '¿Qué tan rápido va tu coche AHORA MISMO?',
    body: `El velocímetro marca 90. Pero "ahora mismo" no tiene duración — es un instante.

Si la velocidad es "distancia entre tiempo", y el tiempo es CERO, la fórmula explota: 0/0.

Y sin embargo, claramente vas a 90. La aguja no tiembla. Hay una respuesta.

Newton y Leibniz pelearon décadas por esta paradoja. La solución se llama derivada. Esta clase te muestra cómo "atrapar" la velocidad instantánea sin dividir entre cero.`,
  },

  steps: [
    {
      title: 'La idea de la secante',
      duration: 5000,
      body: `Mirá la curva rosa: y = sin(x). Es la posición de algo en el tiempo.

El punto azul está en x₀ ≈ π/4. Queremos saber la "velocidad" ahí — qué tan rápido cambia y cuando x cambia.

Para empezar, tomo DOS puntos: uno en x₀ y otro en x₀ + h (con h grande, h=1). La recta verde los une. Su pendiente Δy/Δx ya es una aproximación de la velocidad — pero solo PROMEDIO sobre ese tramo.

Vas a ver: si achico h, la línea verde se acerca a la dorada — la verdadera tangente.`,
      formula: 'pendiente secante = ( f(x₀+h) − f(x₀) ) / h',
      keyframes: [
        { at: 0, state: { fnId: 'sin', x0: Math.PI / 4, logH: 0 } }, // h = 1
        { at: 1, state: { fnId: 'sin', x0: Math.PI / 4, logH: 0 } },
      ],
    },
    {
      title: 'El límite — achicá h',
      duration: 6000,
      body: `Ahora bajo h gradualmente: 1 → 0.1 → 0.01 → 0.001.

Mirá la recta verde (secante): se VA PEGANDO a la dorada (tangente).

Esto es lo que Newton llamó "el límite cuando h → 0". El cociente Δy/Δx tiende a un número concreto — la velocidad instantánea en x₀.

f'(π/4) = cos(π/4) = √2/2 ≈ 0.707.

En el panel ves: cuando h se vuelve diminuto, la pendiente de la secante coincide con la analítica casi exactamente.`,
      formula: "f'(x₀) = lim_{h→0} ( f(x₀+h) − f(x₀) ) / h\nf'(π/4) = cos(π/4) ≈ 0.707",
      keyframes: [
        { at: 0,    state: { fnId: 'sin', x0: Math.PI / 4, logH:  0    } }, // h=1
        { at: 0.25, state: { fnId: 'sin', x0: Math.PI / 4, logH: -1    } }, // h=0.1
        { at: 0.5,  state: { fnId: 'sin', x0: Math.PI / 4, logH: -2    } }, // h=0.01
        { at: 0.75, state: { fnId: 'sin', x0: Math.PI / 4, logH: -3    } }, // h=0.001
        { at: 1,    state: { fnId: 'sin', x0: Math.PI / 4, logH: -4    } }, // h=0.0001
      ],
    },
    {
      title: 'La tangente vive en cada punto',
      duration: 5500,
      body: `Mantengo h pequeño y muevo x₀ a lo largo de la curva.

Mirá: la recta dorada gira siguiendo la curva. Su pendiente CAMBIA en cada punto.

Donde la curva sube fuerte, la tangente tiene pendiente alta. Donde es plana (en los máximos/mínimos), la tangente es horizontal. Donde baja, pendiente negativa.

Eso significa que la derivada es una NUEVA función: f'(x) = cos(x). Donde sin era +, su derivada cos es la TASA de cambio.`,
      formula: "f(x) = sin(x)   ⇒   f'(x) = cos(x)",
      keyframes: [
        { at: 0,   state: { fnId: 'sin', x0: -Math.PI, logH: -3 } },
        { at: 0.5, state: { fnId: 'sin', x0: 0,        logH: -3 } },
        { at: 1,   state: { fnId: 'sin', x0:  Math.PI, logH: -3 } },
      ],
    },
    {
      title: 'Cambiá la función: x²',
      duration: 5000,
      body: `Cambio a f(x) = x². La derivada analítica es f'(x) = 2x — la conoces de prepa.

Empiezo en x₀ = -2 (pendiente -4, fuerte bajada). Camino al origen. La tangente pasa de bajar fuerte → horizontal → subir fuerte.

f'(0) = 0 → punto crítico (mínimo).

f'(-2) = -4 → la curva cae 4 unidades por cada unidad que avanzás en x.

Toda esta lectura sale de mirar UNA recta tangente.`,
      formula: "f(x) = x²   ⇒   f'(x) = 2x",
      keyframes: [
        { at: 0,   state: { fnId: 'sq', x0: -2,    logH: -3 } },
        { at: 0.5, state: { fnId: 'sq', x0:  0,    logH: -3 } },
        { at: 1,   state: { fnId: 'sq', x0:  2,    logH: -3 } },
      ],
    },
    {
      title: 'El caso patológico — |x| en x=0',
      duration: 5500,
      body: `Cambio a f(x) = |x|. Aparece un CODO en x = 0.

Camino x₀ desde -1 hacia +1. La tangente tiene pendiente -1 en el lado izquierdo… y pendiente +1 en el derecho.

¿Cuál es la pendiente EN x=0? No hay una sola — el límite por izquierda da -1, por derecha da +1. No coinciden.

f no es diferenciable en x=0. La derivada NO existe ahí.

Esto importa: las redes neuronales usan funciones de activación como ReLU (que es |x| para x>0 y 0 para x<0) — y en el codo necesitan trucos especiales para el gradient descent.`,
      formula: "f(x) = |x|   ⇒   f'(0) NO EXISTE",
      keyframes: [
        { at: 0,    state: { fnId: 'abs', x0: -1,    logH: -3 } },
        { at: 0.3,  state: { fnId: 'abs', x0: -0.2,  logH: -3 } },
        { at: 0.5,  state: { fnId: 'abs', x0:  0,    logH: -3 } },  // codo
        { at: 0.7,  state: { fnId: 'abs', x0:  0.2,  logH: -3 } },
        { at: 1,    state: { fnId: 'abs', x0:  1,    logH: -3 } },
      ],
    },
  ],

  connect: {
    body: `Acabás de capturar la velocidad instantánea sin dividir entre cero. Newton y Leibniz tardaron una vida en formalizarlo, vos lo viste en 5 minutos.

Lo que aprendiste vale para casi todo:
• Velocidad y aceleración (física)
• Tasa de cambio de cualquier cosa (química, biología, finanzas)
• Pendiente de un grafo en cualquier punto
• El "salto" en redes neuronales con activaciones suaves

Lo siguiente natural: si la derivada es la pendiente, ¿podemos hacer el camino inverso? ¿Si te doy f', puedo recuperar f? Sí — esa es la integral.`,
    links: [
      { label: 'Integral — el inverso de la derivada', href: '#integral-area' },
      { label: 'Plano tangente — derivada en 3D', href: '#tangent-plane' },
      { label: 'Taylor — derivadas para aproximar', href: '#series' },
    ],
  },
};

interface FuncDef {
  id: string;
  label: string;
  expr: string;
  exprPrime: string;
  f: (x: number) => number;
  fPrime: (x: number) => number;
  xRange: [number, number];
  yRange: [number, number];
  defaultX0: number;
  /** true if f is differentiable everywhere in xRange */
  smooth: boolean;
}

const FUNCS: FuncDef[] = [
  {
    id: 'sq',  label: 'x²',  expr: 'f(x) = x²',  exprPrime: "f'(x) = 2x",
    f: x => x * x, fPrime: x => 2 * x,
    xRange: [-2.5, 2.5], yRange: [-1, 6.5], defaultX0: 1.2, smooth: true,
  },
  {
    id: 'sin', label: 'sin x', expr: 'f(x) = sin(x)', exprPrime: "f'(x) = cos(x)",
    f: Math.sin, fPrime: Math.cos,
    xRange: [-Math.PI * 1.2, Math.PI * 1.2], yRange: [-1.5, 1.5], defaultX0: Math.PI / 4, smooth: true,
  },
  {
    id: 'exp', label: 'e^x', expr: 'f(x) = eˣ', exprPrime: "f'(x) = eˣ",
    f: Math.exp, fPrime: Math.exp,
    xRange: [-2, 2], yRange: [-1, 8], defaultX0: 0.6, smooth: true,
  },
  {
    id: 'abs', label: '|x|', expr: 'f(x) = |x|', exprPrime: "f'(x) = sign(x)  ✗ en x=0",
    f: Math.abs, fPrime: x => x > 0 ? 1 : x < 0 ? -1 : NaN,
    xRange: [-2, 2], yRange: [-0.5, 2.5], defaultX0: 0.8, smooth: false,
  },
  {
    id: 'sqrt', label: '√x', expr: 'f(x) = √x', exprPrime: "f'(x) = 1/(2√x)",
    f: x => x >= 0 ? Math.sqrt(x) : NaN,
    fPrime: x => x > 0 ? 0.5 / Math.sqrt(x) : NaN,
    xRange: [-0.5, 4], yRange: [-0.5, 2.5], defaultX0: 1.5, smooth: false,
  },
  {
    id: 'cubic', label: 'x³−3x', expr: 'f(x) = x³ − 3x', exprPrime: "f'(x) = 3x² − 3",
    f: x => x * x * x - 3 * x, fPrime: x => 3 * x * x - 3,
    xRange: [-2.5, 2.5], yRange: [-4, 4], defaultX0: 0.5, smooth: true,
  },
];

/** Centered 4th-order finite-difference derivative. */
function numDeriv(f: (x: number) => number, x: number, h: number): number {
  return (-f(x + 2 * h) + 8 * f(x + h) - 8 * f(x - h) + f(x - 2 * h)) / (12 * h);
}

const SAMPLES = 200;

function clipToY(xs: number[], ys: number[], yMin: number, yMax: number): [number, number, number][][] {
  const segs: [number, number, number][][] = [];
  let cur: [number, number, number][] = [];
  for (let i = 0; i < xs.length; i++) {
    const y = ys[i];
    if (!isFinite(y) || y < yMin - 0.1 || y > yMax + 0.1) {
      if (cur.length > 1) segs.push(cur);
      cur = [];
      continue;
    }
    cur.push([xs[i], y, 0]);
  }
  if (cur.length > 1) segs.push(cur);
  return segs;
}

export default function Derivative1D() {
  const { audience } = useAudience();
  const [fnId, setFnId] = useState('sin');
  const [x0, setX0] = useState(Math.PI / 4);
  const [logH, setLogH] = useState(-1);  // h = 10^logH, slider in [-6, 0]

  const fn = useMemo(() => FUNCS.find(f => f.id === fnId)!, [fnId]);
  const [xMin, xMax] = fn.xRange;
  const [yMin, yMax] = fn.yRange;

  // When the function changes, jump x₀ to the default
  // (without this the slider could be outside the new xRange).
  const cx = Math.max(xMin + 0.05, Math.min(xMax - 0.05, x0));
  const h  = Math.pow(10, logH);

  const xs = useMemo(() =>
    Array.from({ length: SAMPLES }, (_, i) => xMin + ((xMax - xMin) * i) / (SAMPLES - 1)),
    [xMin, xMax]);

  const ys = useMemo(() => xs.map(fn.f), [xs, fn]);
  const curvePts = useMemo(() => clipToY(xs, ys, yMin, yMax), [xs, ys, yMin, yMax]);

  const y0 = fn.f(cx);
  const slopeNum = numDeriv(fn.f, cx, h);
  const slopeAna = fn.fPrime(cx);
  const slopeUse = isFinite(slopeAna) ? slopeAna : slopeNum;

  // Tangent line: y = y0 + slopeAna * (x − cx)
  const tangentPts: [number, number, number][] = useMemo(() => {
    if (!isFinite(slopeUse)) return [];
    const xL = xMin, xR = xMax;
    const yL = y0 + slopeUse * (xL - cx);
    const yR = y0 + slopeUse * (xR - cx);
    return [[xL, yL, 0], [xR, yR, 0]];
  }, [slopeUse, cx, y0, xMin, xMax]);

  // Secant line from (cx, y0) to (cx+h, f(cx+h))
  const cxh = cx + h;
  const yh  = fn.f(cxh);
  const slopeSec = (yh - y0) / h;
  const secantPts: [number, number, number][] = useMemo(() => {
    if (!isFinite(slopeSec)) return [];
    // Extend secant across the visible window
    const xL = xMin, xR = xMax;
    return [
      [xL, y0 + slopeSec * (xL - cx), 0],
      [xR, y0 + slopeSec * (xR - cx), 0],
    ];
  }, [slopeSec, cx, y0, xMin, xMax]);

  const span = Math.max(xMax - xMin, yMax - yMin);

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={span * 1.5} bloomIntensity={0.55} bloomThreshold={0.55}>
          {/* Axes */}
          <Line points={[[xMin, 0, 0], [xMax, 0, 0]]} color="#64748B" lineWidth={1} />
          <Line points={[[0, yMin, 0], [0, yMax, 0]]} color="#64748B" lineWidth={1} />

          {/* Grid */}
          {(() => {
            const out: React.ReactElement[] = [];
            const nx = 12, ny = 10;
            const dx = (xMax - xMin) / nx;
            const dy = (yMax - yMin) / ny;
            for (let i = 1; i < nx; i++) {
              const x = xMin + dx * i;
              out.push(<Line key={`gx${i}`} points={[[x, yMin, 0], [x, yMax, 0]]} color="#1E293B" lineWidth={0.5} transparent opacity={0.5} />);
            }
            for (let j = 1; j < ny; j++) {
              const y = yMin + dy * j;
              out.push(<Line key={`gy${j}`} points={[[xMin, y, 0], [xMax, y, 0]]} color="#1E293B" lineWidth={0.5} transparent opacity={0.5} />);
            }
            return out;
          })()}

          {/* The function curve (pink) */}
          {curvePts.map((seg, i) => (
            <Line key={`f${i}`} points={seg} color="#F472B6" lineWidth={2.5} />
          ))}

          {/* Tangent line (gold) — analytic derivative */}
          {tangentPts.length === 2 && (
            <Line points={tangentPts} color="#FDB813" lineWidth={2} transparent opacity={0.95} />
          )}

          {/* Secant line (teal) — converges to tangent as h → 0 */}
          {secantPts.length === 2 && (
            <Line points={secantPts} color="#34D399" lineWidth={1.5} transparent opacity={0.85} />
          )}

          {/* Point (x₀, f(x₀)) */}
          <mesh position={[cx, y0, 0]}>
            <sphereGeometry args={[span * 0.012, 18, 18]} />
            <meshStandardMaterial color="#4FC3F7" emissive="#4FC3F7" emissiveIntensity={1.4} />
          </mesh>

          {/* Point (x₀+h, f(x₀+h)) — secant endpoint */}
          {isFinite(yh) && (
            <mesh position={[cxh, yh, 0]}>
              <sphereGeometry args={[span * 0.009, 14, 14]} />
              <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={1} />
            </mesh>
          )}
        </Stage>

        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div><span className="text-[#F472B6]">━</span> f(x)</div>
          <div><span className="text-[#FDB813]">━</span> recta tangente (f'(x₀))</div>
          <div><span className="text-[#34D399]">━</span> recta secante (Δy/Δx con paso h)</div>
          <div><span className="text-[#4FC3F7]">●</span> (x₀, f(x₀))</div>
        </div>
      </div>

      <LessonPanel<DerivState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.fnId !== undefined) setFnId(patch.fnId);
          if (patch.x0 !== undefined) setX0(patch.x0);
          if (patch.logH !== undefined) setLogH(patch.logH);
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Función</div>
              <div className="grid grid-cols-3 gap-1.5">
                {FUNCS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => { setFnId(f.id); setX0(f.defaultX0); }}
                    className={`text-[11px] px-2 py-1.5 rounded border transition ${
                      fnId === f.id
                        ? 'bg-[#4FC3F7]/15 border-[#4FC3F7]/50 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#4FC3F7]/30'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[11px] font-mono text-[#FDB813]">{fn.expr}</div>
              <div className="text-[10px] font-mono text-[#94A3B8]">{fn.exprPrime}</div>
            </div>

            <div>
              <label className="block text-[11px] text-[#94A3B8]">
                x₀ = <span className="text-[#4FC3F7] font-mono">{cx.toFixed(3)}</span>
                <input
                  type="range" min={xMin + 0.05} max={xMax - 0.05} step={0.01}
                  value={cx}
                  onChange={e => setX0(parseFloat(e.target.value))}
                  className="w-full accent-[#4FC3F7]"
                />
              </label>
            </div>

            <div>
              <label className="block text-[11px] text-[#94A3B8]">
                h = <span className="text-[#34D399] font-mono">{h.toExponential(2)}</span>
                <input
                  type="range" min={-6} max={0} step={0.05}
                  value={logH}
                  onChange={e => setLogH(parseFloat(e.target.value))}
                  className="w-full accent-[#34D399]"
                />
              </label>
              <div className="text-[10px] text-[#64748B]">paso de la secante (escala log)</div>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-1 text-[12px] font-mono">
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">f(x₀)</span>
                <span className="text-white">{y0.toFixed(5)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">f'(x₀) analítica</span>
                <span className={isFinite(slopeAna) ? 'text-[#FDB813]' : 'text-[#EF5350]'}>
                  {isFinite(slopeAna) ? slopeAna.toFixed(5) : 'no definida'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">f'(x₀) numérica</span>
                <span className="text-[#34D399]">{isFinite(slopeNum) ? slopeNum.toFixed(5) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">pendiente secante</span>
                <span className="text-[#34D399]">{isFinite(slopeSec) ? slopeSec.toFixed(5) : '—'}</span>
              </div>
              {isFinite(slopeAna) && isFinite(slopeNum) && (
                <div className="flex justify-between border-t border-[#1E293B] pt-1 mt-1">
                  <span className="text-[#94A3B8]">|err| numérica</span>
                  <span className="text-[#94A3B8]">{Math.abs(slopeNum - slopeAna).toExponential(2)}</span>
                </div>
              )}
            </div>

            {!fn.smooth && (
              <div className="text-[11px] text-[#EF5350] border border-[#EF5350]/30 bg-[#EF5350]/5 rounded p-2 leading-relaxed">
                ⚠ {fn.label} <strong>no es diferenciable</strong> en todo su dominio.
              </div>
            )}

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Derivada numérica = diferencia centrada O(h⁴). Para h ~ 1e-3 alcanza ~1e-12 de precisión.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
