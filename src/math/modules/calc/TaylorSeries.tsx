/**
 * Series de Taylor — la magia de aproximar funciones con polinomios.
 *
 *   f(x) ≈ ∑_{k=0}^{N} (fᵏ(0) / k!) · xᵏ
 *
 * Mueves N y ves cómo cada término extra "ajusta" el polinomio dorado
 * (Pₙ(x)) más cerca de la curva real (f(x), en rosa). Ves dónde converge
 * y dónde diverge.
 *
 * Trick clave de visualización: clampamos las y a yRange ANTES de dibujar
 * para que los Line segments no se vayan a |y|=1000+ (cosa que hace que
 * la línea esté técnicamente en pantalla pero fuera del frustum visible).
 */

import { useMemo, useState } from 'react';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

interface TaylorState {
  fnId: string;
  N: number;
}

const LESSON: Lesson<TaylorState> = {
  hook: {
    title: '¿Cómo calcula sin(0.5) tu calculadora?',
    body: `Tu calculadora no tiene una tabla infinita de senos guardados. No tiene un humano dentro consultando libros. Y sin embargo te da sin(0.5) ≈ 0.4794 en milisegundos.

¿Cómo lo hace? Con polinomios. POLINOMIOS — esas cosas con + y × y x², lo más simple que existe — que IMITAN a sin(x) tan bien como querramos.

La idea es de Brook Taylor (1715): si tomás los suficientes términos de la forma x^k/k!, podés reconstruir CUALQUIER función suave. Hoy todas las calculadoras del mundo usan variantes de esto.

Esta clase te muestra cómo más términos = más fielmente.`,
  },

  steps: [
    {
      title: 'Empezamos con NADA (N=0)',
      duration: 4500,
      body: `Mirá la curva rosa: sin(x). Es la onda real.

Pongo N=0 — el polinomio de Taylor es solo la constante f(0) = sin(0) = 0. Eso es la línea horizontal dorada en y=0.

Coincide con sin(x) SOLO en x=0. Apenas te alejás, falla. Terrible aproximación.

Pero es el punto de partida. Newton diría: si tu mejor info es "vale 0 en x=0", la mejor aproximación constante es y=0.`,
      formula: 'P₀(x) = f(0) = 0',
      keyframes: [
        { at: 0, state: { fnId: 'sin', N: 0 } },
        { at: 1, state: { fnId: 'sin', N: 0 } },
      ],
    },
    {
      title: 'Añadí una recta (N=1)',
      duration: 4500,
      body: `N=1: P₁(x) = f(0) + f'(0)·x = 0 + 1·x = x.

¡Eh! Esto es la recta TANGENTE de sin(x) en el origen. La que ya viste en la clase de la derivada.

Cerca de x=0, sin(x) ≈ x. Por eso los físicos escriben "sin θ ≈ θ" para ángulos pequeños — eso es Taylor de orden 1.

Pero la recta se aleja rápido. En x = ±1.5 ya hay error visible.`,
      formula: 'P₁(x) = f(0) + f\'(0)·x = x',
      keyframes: [
        { at: 0, state: { fnId: 'sin', N: 1 } },
        { at: 1, state: { fnId: 'sin', N: 1 } },
      ],
    },
    {
      title: 'Más términos → más fidelidad',
      duration: 7000,
      body: `Voy subiendo N: 1 → 3 → 5 → 7 → 11.

Mirá: la curva dorada (Taylor) cada vez se PEGA más a la rosa (sin verdadero). Primero captura la subida-bajada (N=3), luego la siguiente oscilación (N=5), luego el rebote (N=7)…

Cada nuevo término corrige la curvatura del orden anterior. Con N=11, los dos lados de la onda completa coinciden visualmente.

Esto es lo que la calculadora hace: típicamente usa N ≈ 15 para sin/cos, con error < 10⁻¹⁶ — el límite de la precisión flotante de 64 bits.`,
      formula: 'sin(x) = x − x³/3! + x⁵/5! − x⁷/7! + …',
      keyframes: [
        { at: 0,    state: { fnId: 'sin', N: 1  } },
        { at: 0.25, state: { fnId: 'sin', N: 3  } },
        { at: 0.5,  state: { fnId: 'sin', N: 5  } },
        { at: 0.75, state: { fnId: 'sin', N: 7  } },
        { at: 1,    state: { fnId: 'sin', N: 11 } },
      ],
    },
    {
      title: 'log(1+x) — radio de convergencia',
      duration: 6000,
      body: `Cambio a log(1+x). La curva rosa tiene una asíntota vertical en x = −1 (se va a −∞).

Subo N: 2 → 5 → 10 → 20. Mirá lo que pasa para |x|<1: la aproximación dorada CONVERGE preciosa al log real.

Pero para x > 1 (a la derecha), la aproximación EXPLOTA — oscila salvajemente. No converge.

Esto es el RADIO DE CONVERGENCIA: log(1+x) solo se puede aproximar bien en |x| < 1. Afuera, agregar más términos NO ayuda — empeora.

La banda verde te muestra dónde la serie converge.`,
      formula: 'log(1+x) = x − x²/2 + x³/3 − x⁴/4 + …\nradio = 1',
      keyframes: [
        { at: 0,    state: { fnId: 'log', N: 2  } },
        { at: 0.33, state: { fnId: 'log', N: 5  } },
        { at: 0.66, state: { fnId: 'log', N: 10 } },
        { at: 1,    state: { fnId: 'log', N: 20 } },
      ],
    },
    {
      title: 'eˣ — convergencia total',
      duration: 5500,
      body: `Última: f(x) = eˣ. Esta función es ESPECIAL.

Subo N: 1 → 4 → 8 → 15. Cada incremento la mejora EN TODO el rango — no hay zona "prohibida".

¿Por qué? El radio de convergencia de eˣ es ∞. La serie 1 + x + x²/2! + x³/3! + … converge para CUALQUIER x.

Esa es la propiedad mágica de las funciones enteras (sin, cos, eˣ, sinh, cosh…): su serie de Taylor converge en todo ℝ. Por eso aparecen en TODOS los modelos de física — son las funciones "globalmente aproximables".`,
      formula: 'eˣ = 1 + x + x²/2! + x³/3! + … (radio = ∞)',
      keyframes: [
        { at: 0,    state: { fnId: 'exp', N: 1  } },
        { at: 0.33, state: { fnId: 'exp', N: 4  } },
        { at: 0.66, state: { fnId: 'exp', N: 8  } },
        { at: 1,    state: { fnId: 'exp', N: 15 } },
      ],
    },
  ],

  connect: {
    body: `Taylor te dice: cualquier función suave se puede mirar como un polinomio infinito. Y los primeros términos ya son una buena aproximación local.

Esta idea está en todas partes:
• Tu calculadora (sin, cos, eˣ via Taylor o variantes Chebyshev)
• La física teórica ("a primer orden", "a segundo orden" = términos de Taylor)
• Los métodos numéricos (Runge-Kutta, finite differences)
• La regresión polinómica de datos
• El principio de la relatividad de Einstein a velocidades bajas: γ ≈ 1 + v²/2c² + …

Y el primer término no constante de Taylor es siempre la DERIVADA. Por eso decir "linealiza" es lo mismo que "toma Taylor de orden 1".`,
    links: [
      { label: 'Derivada — Taylor de orden 1', href: '#derivative-1d' },
      { label: 'Plano tangente — Taylor en 2D', href: '#tangent-plane' },
      { label: 'Integral — integrar serie por serie', href: '#integral-area' },
    ],
  },
};

interface FunctionDef {
  id: string;
  label: string;
  expr: string;
  f: (x: number) => number;
  coef: (k: number) => number;
  radius: number;
  xRange: [number, number];
  yRange: [number, number];
}

const FACT_CACHE: number[] = [1];
function factorial(n: number): number {
  for (let i = FACT_CACHE.length; i <= n; i++) FACT_CACHE[i] = FACT_CACHE[i - 1] * i;
  return FACT_CACHE[n];
}

const FUNCTIONS: FunctionDef[] = [
  {
    id: 'exp', label: 'eˣ', expr: 'eˣ = Σ xᵏ/k!',
    f: Math.exp, coef: k => 1 / factorial(k),
    radius: Infinity, xRange: [-3, 3], yRange: [-1, 12],
  },
  {
    id: 'sin', label: 'sin(x)', expr: 'sin x = Σ (−1)ᵏ x^(2k+1)/(2k+1)!',
    f: Math.sin,
    coef: k => {
      if (k % 2 === 0) return 0;
      const m = (k - 1) / 2;
      return (m % 2 === 0 ? 1 : -1) / factorial(k);
    },
    radius: Infinity, xRange: [-4.2, 4.2], yRange: [-1.5, 1.5],
  },
  {
    id: 'cos', label: 'cos(x)', expr: 'cos x = Σ (−1)ᵏ x^(2k)/(2k)!',
    f: Math.cos,
    coef: k => {
      if (k % 2 !== 0) return 0;
      const m = k / 2;
      return (m % 2 === 0 ? 1 : -1) / factorial(k);
    },
    radius: Infinity, xRange: [-4.2, 4.2], yRange: [-1.5, 1.5],
  },
  {
    id: 'log', label: 'log(1+x)', expr: 'log(1+x) = Σ (−1)^(k−1) xᵏ/k',
    f: x => x > -1 ? Math.log(1 + x) : NaN,
    coef: k => k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) / k,
    radius: 1, xRange: [-0.95, 2.5], yRange: [-3, 2],
  },
  {
    id: 'geom', label: '1/(1−x)', expr: '1/(1−x) = Σ xᵏ',
    f: x => x < 1 ? 1 / (1 - x) : NaN,
    coef: () => 1,
    radius: 1, xRange: [-1.5, 1.5], yRange: [-3, 6],
  },
];

function taylorSum(fn: FunctionDef, N: number, x: number): number {
  let s = 0, pow = 1;
  for (let k = 0; k <= N; k++) {
    s += fn.coef(k) * pow;
    pow *= x;
  }
  return s;
}

const SAMPLES = 160;

/**
 * Build polyline segments clipped to [yMin, yMax]. Whenever the curve
 * leaves the y window, we close the current segment so the rendered
 * line only contains visible points — keeps geometry inside the frustum
 * and visually communicates "diverges off-screen here".
 */
function clipToYWindow(
  xs: number[],
  ys: number[],
  yMin: number,
  yMax: number,
): [number, number, number][][] {
  const segs: [number, number, number][][] = [];
  let cur: [number, number, number][] = [];
  for (let i = 0; i < xs.length; i++) {
    const y = ys[i];
    if (!isFinite(y) || y < yMin - 0.05 || y > yMax + 0.05) {
      if (cur.length > 1) segs.push(cur);
      cur = [];
      continue;
    }
    cur.push([xs[i], y, 0]);
  }
  if (cur.length > 1) segs.push(cur);
  return segs;
}

export default function TaylorSeries() {
  const { audience } = useAudience();
  const [fnId, setFnId] = useState('sin');
  const [N, setN] = useState(5);

  const fn = useMemo(() => FUNCTIONS.find(f => f.id === fnId)!, [fnId]);
  const [xMin, xMax] = fn.xRange;
  const [yMin, yMax] = fn.yRange;

  const xs = useMemo(() => {
    return Array.from({ length: SAMPLES }, (_, i) => xMin + ((xMax - xMin) * i) / (SAMPLES - 1));
  }, [xMin, xMax]);

  const trueYs = useMemo(() => xs.map(x => fn.f(x)), [xs, fn]);
  const taylorYs = useMemo(() => xs.map(x => taylorSum(fn, N, x)), [xs, fn, N]);

  const truePts   = useMemo(() => clipToYWindow(xs, trueYs, yMin, yMax), [xs, trueYs, yMin, yMax]);
  const taylorPts = useMemo(() => clipToYWindow(xs, taylorYs, yMin, yMax), [xs, taylorYs, yMin, yMax]);

  const showBand = isFinite(fn.radius);
  const span = Math.max(xMax - xMin, yMax - yMin);
  const camD = span * 1.5;

  return (
    <div className="w-full h-full grid grid-cols-[1fr_340px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={camD} bloomIntensity={0.6} bloomThreshold={0.5}
               canvasProps={{ camera: { position: [0, 0, camD], fov: 35, near: 0.001, far: 1000 } }}>
          {/* Axes */}
          <Line points={[[xMin, 0, 0], [xMax, 0, 0]]} color="#64748B" lineWidth={1} />
          <Line points={[[0, yMin, 0], [0, yMax, 0]]} color="#64748B" lineWidth={1} />

          {/* Convergence radius band */}
          {showBand && (
            <mesh position={[0, (yMin + yMax) / 2, -0.01]}>
              <planeGeometry args={[2 * fn.radius, yMax - yMin]} />
              <meshBasicMaterial color="#34D399" transparent opacity={0.08} />
            </mesh>
          )}

          {/* Grid (light) */}
          {(() => {
            const out: React.ReactElement[] = [];
            const dx = (xMax - xMin) / 10;
            const dy = (yMax - yMin) / 10;
            for (let i = 1; i < 10; i++) {
              const x = xMin + dx * i;
              out.push(<Line key={`gx${i}`} points={[[x, yMin, 0], [x, yMax, 0]]} color="#1E293B" lineWidth={0.5} transparent opacity={0.55} />);
              const y = yMin + dy * i;
              out.push(<Line key={`gy${i}`} points={[[xMin, y, 0], [xMax, y, 0]]} color="#1E293B" lineWidth={0.5} transparent opacity={0.55} />);
            }
            return out;
          })()}

          {/* True function (pink) */}
          {truePts.map((seg, i) => (
            <Line key={`t${i}`} points={seg} color="#F472B6" lineWidth={2.5} />
          ))}

          {/* Taylor partial sum (gold) */}
          {taylorPts.map((seg, i) => (
            <Line key={`p${i}`} points={seg} color="#FDB813" lineWidth={2} />
          ))}

          {/* Origin marker */}
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[span * 0.012, 16, 16]} />
            <meshStandardMaterial color="#4FC3F7" emissive="#4FC3F7" emissiveIntensity={1} />
          </mesh>
        </Stage>

        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div><span className="text-[#F472B6]">━</span> f(x) verdadera</div>
          <div><span className="text-[#FDB813]">━</span> Pₙ(x) Taylor (a=0)</div>
          {showBand && (
            <div><span className="text-[#34D399]">▮</span> radio R = {fn.radius}</div>
          )}
        </div>
      </div>

      <LessonPanel<TaylorState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.fnId !== undefined) setFnId(patch.fnId);
          if (patch.N    !== undefined) setN(Math.round(patch.N));
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Función</div>
              <div className="grid grid-cols-2 gap-1.5">
                {FUNCTIONS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFnId(f.id)}
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
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">
                N = <span className="text-white font-mono">{N}</span> términos
              </div>
              <input
                type="range" min={0} max={30} step={1}
                value={N}
                onChange={e => setN(parseInt(e.target.value))}
                className="w-full accent-[#FDB813]"
              />
              <div className="flex justify-between text-[10px] text-[#64748B] mt-1">
                <span>0</span><span>30</span>
              </div>
            </div>

            <div className="border-t border-[#1E293B] pt-3">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Polinomio Pₙ(x)</div>
              <div className="text-[10px] font-mono text-[#94A3B8] leading-snug max-h-32 overflow-y-auto">
                {(() => {
                  const terms: string[] = [];
                  for (let k = 0; k <= Math.min(N, 8); k++) {
                    const c = fn.coef(k);
                    if (Math.abs(c) < 1e-10) continue;
                    const sign = c < 0 ? '−' : (terms.length > 0 ? '+' : '');
                    const absC = Math.abs(c);
                    const coefStr = absC === 1 ? '' : absC.toFixed(4).replace(/\.?0+$/, '');
                    const xStr = k === 0 ? '1' : (k === 1 ? 'x' : `x^${k}`);
                    terms.push(`${sign}${coefStr === '' && k > 0 ? '' : coefStr}${k > 0 ? '·' + xStr : ''}`);
                  }
                  return terms.join(' ') + (N > 8 ? ' + …' : '');
                })()}
              </div>
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Cada N+1 corrige la curvatura del orden previo. sin/cos/eˣ: radio ∞. log(1+x), 1/(1−x): radio 1.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
