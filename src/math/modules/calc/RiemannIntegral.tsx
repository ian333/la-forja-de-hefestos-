/**
 * Integral por sumas de Riemann — Spivak cap. 13.
 *
 *   ∫_a^b f(x) dx = lim_{N→∞} Σ_{i=1}^N f(xᵢ*) · Δx
 *
 * Eliges f, intervalo [a, b], N rectángulos, y la regla (izquierda, derecha,
 * punto medio, trapezoidal). Ves los rectángulos llenando el área bajo la
 * curva, y cómo N → ∞ converge al valor analítico.
 *
 * Comparamos en vivo cuatro reglas:
 *   • Izquierda  — error O(Δx)
 *   • Derecha    — error O(Δx)
 *   • Punto medio — error O(Δx²)  ← muchísimo mejor
 *   • Trapezoidal — error O(Δx²)  ← misma orden, otra geometría
 *
 * El "click" pedagógico: ver que con N=10 punto medio ya empata a N=1000
 * de izquierda/derecha. Y que el "área negativa" donde f<0 sale natural.
 */

import { useMemo, useState } from 'react';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

interface IntState {
  fnId: string;
  N: number;
  rule: 'left' | 'right' | 'mid' | 'trap';
  a: number;
  b: number;
}

const LESSON: Lesson<IntState> = {
  hook: {
    title: '¿Cuánta pintura cubre esta pared… si la pared tiene una curva?',
    body: `Si la pared fuera un rectángulo, multiplicás ancho × alto y listo. Pero ¿qué pasa si el borde de arriba es una curva — una loma, una onda, una campana?

Arquímedes (siglo III a.C.) tuvo la idea: APROXIMÁ con rectángulos chiquitos. Si la pared es difícil, dividila en muchas franjitas verticales — cada una rectangular. Sumá las áreas.

Mientras más franjas, más cerca la suma se acerca al área verdadera. Si tomás INFINITAS franjas infinitesimales… llegás a la integral.

Esta clase te muestra cómo "Arquímedes + límite" se convierte en cálculo integral.`,
  },

  steps: [
    {
      title: 'Empezá con pocos rectángulos',
      duration: 4500,
      body: `f(x) = sin(x), integral de 0 a π. Esto es: el área bajo media onda senoidal.

Pongo N = 4 rectángulos con la regla "punto medio". Mirá: los rectángulos NO encajan perfectamente con la curva. Hay sobras y faltantes.

La aproximación es ≈ 2.05, mientras que el área verdadera es exactamente 2 (porque cos(π) − cos(0) = -1 - 1 = -2 con signo). Error ~2.5%.

Es un buen INICIO pero no es exacto. Newton se preguntó: ¿podemos hacer N → ∞?`,
      formula: 'A ≈ Σ_i f(x_mid_i) · Δx',
      keyframes: [
        { at: 0, state: { fnId: 'sin', N: 4, rule: 'mid', a: 0, b: Math.PI } },
        { at: 1, state: { fnId: 'sin', N: 4, rule: 'mid', a: 0, b: Math.PI } },
      ],
    },
    {
      title: 'Subí N — la suma converge',
      duration: 6000,
      body: `Ahora subo N: 4 → 12 → 30 → 80.

Mirá cómo los rectángulos se hacen más finos y siguen mejor el contorno. Las "sobras" desaparecen, las "faltantes" también.

El error cae rápido: 2.5% (N=4) → 0.07% (N=80). En el panel ves el número aprox. acercándose a 2.0000.

Esa es la INTEGRAL: el límite de la suma cuando N → ∞. Newton y Leibniz la escribieron con un símbolo nuevo — la S estirada, ∫.`,
      formula: '∫₀^π sin(x) dx = lim_{N→∞} Σ f(xᵢ) · Δx = 2',
      keyframes: [
        { at: 0,    state: { fnId: 'sin', N: 4,   rule: 'mid', a: 0, b: Math.PI } },
        { at: 0.33, state: { fnId: 'sin', N: 12,  rule: 'mid', a: 0, b: Math.PI } },
        { at: 0.66, state: { fnId: 'sin', N: 30,  rule: 'mid', a: 0, b: Math.PI } },
        { at: 1,    state: { fnId: 'sin', N: 80,  rule: 'mid', a: 0, b: Math.PI } },
      ],
    },
    {
      title: 'No todas las reglas son iguales',
      duration: 5500,
      body: `Con N=20 fijo, cambio la regla: izquierda → derecha → punto medio → trapezoidal.

Izquierda y derecha tienen errores grandes (~5%): los rectángulos sobreestiman/subestiman uniformemente.

Punto medio y trapezoidal son MUCHO mejor (~0.01%): el error es de orden Δx² en vez de Δx. Doblar N divide el error entre 4, no entre 2.

Esto es importante: la elección de cómo aproximar IMPORTA. Numéricos sofisticados usan Gauss-Legendre o Simpson, que son aún mejores.`,
      keyframes: [
        { at: 0,    state: { fnId: 'sin', N: 20, rule: 'left',  a: 0, b: Math.PI } },
        { at: 0.33, state: { fnId: 'sin', N: 20, rule: 'right', a: 0, b: Math.PI } },
        { at: 0.66, state: { fnId: 'sin', N: 20, rule: 'mid',   a: 0, b: Math.PI } },
        { at: 1,    state: { fnId: 'sin', N: 20, rule: 'trap',  a: 0, b: Math.PI } },
      ],
    },
    {
      title: 'El área puede ser NEGATIVA',
      duration: 5000,
      body: `Cambio a f(x) = x · sin(x), e integro de -π a 1.5π. Esta función oscila: positiva, negativa, positiva.

Mirá: aparecen rectángulos ROJOS donde f es negativa. La integral cuenta esa área CON SIGNO — se RESTA.

Es lo que en física se llama "trabajo neto": si una fuerza empuja en un sentido y luego en el opuesto, el trabajo total puede cancelarse parcialmente.

La integral no es solo "área visible" — es "área algebraica firmada".`,
      formula: '∫ negativa cuando f(x) < 0',
      keyframes: [
        { at: 0, state: { fnId: 'osc', N: 40, rule: 'mid', a: -Math.PI, b: Math.PI * 1.5 } },
        { at: 1, state: { fnId: 'osc', N: 40, rule: 'mid', a: -Math.PI, b: Math.PI * 1.5 } },
      ],
    },
    {
      title: 'La gaussiana — sin fórmula cerrada',
      duration: 5000,
      body: `f(x) = e^(-x²). Esta es la distribución normal — la "campana" de Gauss.

A diferencia de sin o x², esta función NO tiene antiderivada elemental. No existe ninguna fórmula F(x) algebraica tal que F'(x) = e^(-x²).

¿Eso significa que no podemos integrarla? No: ahí ENTRA el cálculo numérico. Sumas de Riemann (o variantes mejores como Simpson) nos dan el valor con la precisión que querramos.

De [-1.5, 1.5] el área es ≈ 1.6932 — la mayor parte de la "masa" de la gaussiana.`,
      formula: '∫ e^(-x²) dx — sin antiderivada elemental',
      keyframes: [
        { at: 0,   state: { fnId: 'bell', N: 20, rule: 'mid', a: -1.5, b: 1.5 } },
        { at: 0.5, state: { fnId: 'bell', N: 50, rule: 'mid', a: -1.5, b: 1.5 } },
        { at: 1,   state: { fnId: 'bell', N: 100, rule: 'mid', a: -1.5, b: 1.5 } },
      ],
    },
  ],

  connect: {
    body: `Acabás de ver una idea con 2300 años de historia, refinada hasta ser computable.

La integral aparece en TODO:
• Área, volumen, distancia recorrida
• Probabilidad acumulada (gaussiana)
• Energía total, trabajo, momento
• Promedio de una función continua
• La FFT (transformada de Fourier discreta es una suma de Riemann ponderada)

Y el teorema fundamental del cálculo (Newton-Leibniz) une derivada e integral en una sola identidad: si F'=f entonces ∫_a^b f dx = F(b) - F(a). Derivar e integrar son operaciones inversas.`,
    links: [
      { label: 'Derivada — el inverso (TFC)', href: '#derivative-1d' },
      { label: 'Series de Taylor — integrar serie a serie', href: '#series' },
      { label: 'Campos vectoriales — integral de línea', href: '#vector-fields' },
    ],
  },
};

type Rule = 'left' | 'right' | 'mid' | 'trap';

interface FuncDef {
  id: string;
  label: string;
  expr: string;
  f: (x: number) => number;
  exact: (a: number, b: number) => number;
  xRange: [number, number];
  yRange: [number, number];
  defaultA: number;
  defaultB: number;
}

const FUNCS: FuncDef[] = [
  {
    id: 'sq',  label: 'x²',  expr: 'f(x) = x²',
    f: x => x * x,
    exact: (a, b) => (b * b * b - a * a * a) / 3,
    xRange: [-1, 3], yRange: [-1, 9.5], defaultA: 0, defaultB: 2,
  },
  {
    id: 'sin', label: 'sin x', expr: 'f(x) = sin(x)',
    f: Math.sin,
    exact: (a, b) => Math.cos(a) - Math.cos(b),
    xRange: [-Math.PI, Math.PI * 1.5], yRange: [-1.5, 1.5], defaultA: 0, defaultB: Math.PI,
  },
  {
    id: 'cos', label: 'cos x', expr: 'f(x) = cos(x)',
    f: Math.cos,
    exact: (a, b) => Math.sin(b) - Math.sin(a),
    xRange: [-Math.PI, Math.PI], yRange: [-1.5, 1.5], defaultA: -Math.PI / 2, defaultB: Math.PI / 2,
  },
  {
    id: 'exp', label: 'e^x', expr: 'f(x) = eˣ',
    f: Math.exp,
    exact: (a, b) => Math.exp(b) - Math.exp(a),
    xRange: [-1, 2], yRange: [-0.5, 8], defaultA: 0, defaultB: 1.5,
  },
  {
    id: 'bell', label: 'gauss', expr: 'f(x) = e^(−x²)',
    f: x => Math.exp(-x * x),
    // No closed form — numerical "exact" via Simpson with N=10000
    exact: (a, b) => {
      const N = 10000, h = (b - a) / N;
      let s = Math.exp(-a * a) + Math.exp(-b * b);
      for (let i = 1; i < N; i++) {
        const x = a + i * h;
        s += (i % 2 === 0 ? 2 : 4) * Math.exp(-x * x);
      }
      return (s * h) / 3;
    },
    xRange: [-2.5, 2.5], yRange: [-0.2, 1.2], defaultA: -1.5, defaultB: 1.5,
  },
  {
    id: 'osc', label: 'x · sin', expr: 'f(x) = x · sin(x)',
    f: x => x * Math.sin(x),
    // ∫ x sin(x) dx = sin(x) − x cos(x)
    exact: (a, b) => (Math.sin(b) - b * Math.cos(b)) - (Math.sin(a) - a * Math.cos(a)),
    xRange: [-2 * Math.PI, 2 * Math.PI], yRange: [-5, 6.5], defaultA: -Math.PI, defaultB: Math.PI * 1.5,
  },
];

const SAMPLES = 220;

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

function riemannSum(f: (x: number) => number, a: number, b: number, N: number, rule: Rule): number {
  const dx = (b - a) / N;
  let s = 0;
  for (let i = 0; i < N; i++) {
    const xL = a + i * dx;
    const xR = xL + dx;
    if (rule === 'left')  s += f(xL);
    else if (rule === 'right') s += f(xR);
    else if (rule === 'mid')   s += f((xL + xR) / 2);
    else /* trap */ s += (f(xL) + f(xR)) / 2;
  }
  return s * dx;
}

export default function RiemannIntegral() {
  const { audience } = useAudience();
  const [fnId, setFnId] = useState('sin');
  const [N, setN] = useState(8);
  const [rule, setRule] = useState<Rule>('mid');
  const fn = useMemo(() => FUNCS.find(f => f.id === fnId)!, [fnId]);
  const [a, setA] = useState(fn.defaultA);
  const [b, setB] = useState(fn.defaultB);

  const [xMin, xMax] = fn.xRange;
  const [yMin, yMax] = fn.yRange;
  const aClamp = Math.max(xMin + 0.05, Math.min(xMax - 0.1, Math.min(a, b - 0.1)));
  const bClamp = Math.max(aClamp + 0.1, Math.min(xMax - 0.05, Math.max(b, aClamp + 0.1)));

  const xs = useMemo(() =>
    Array.from({ length: SAMPLES }, (_, i) => xMin + ((xMax - xMin) * i) / (SAMPLES - 1)),
    [xMin, xMax]);
  const ys = useMemo(() => xs.map(fn.f), [xs, fn]);
  const curvePts = useMemo(() => clipToY(xs, ys, yMin, yMax), [xs, ys, yMin, yMax]);

  // Compute rectangles
  const dx = (bClamp - aClamp) / N;
  const rects: { x: number; w: number; y: number; h: number; positive: boolean }[] = [];
  const trapPolys: [number, number, number][][] = [];
  for (let i = 0; i < N; i++) {
    const xL = aClamp + i * dx;
    const xR = xL + dx;
    let h: number;
    if (rule === 'left')       h = fn.f(xL);
    else if (rule === 'right') h = fn.f(xR);
    else if (rule === 'mid')   h = fn.f((xL + xR) / 2);
    else                       h = (fn.f(xL) + fn.f(xR)) / 2;
    if (rule === 'trap') {
      const yL = fn.f(xL), yR = fn.f(xR);
      // Trapezoid as a closed loop of 4 corners + back to start
      trapPolys.push([
        [xL, 0, 0], [xL, yL, 0], [xR, yR, 0], [xR, 0, 0], [xL, 0, 0],
      ]);
    } else {
      const yTop = Math.sign(h) * Math.min(Math.abs(h), Math.max(Math.abs(yMin), Math.abs(yMax)));
      rects.push({ x: xL, w: dx, y: 0, h: yTop, positive: h >= 0 });
    }
  }

  const approx = useMemo(() => riemannSum(fn.f, aClamp, bClamp, N, rule), [fn, aClamp, bClamp, N, rule]);
  const exact = useMemo(() => fn.exact(aClamp, bClamp), [fn, aClamp, bClamp]);
  const err = approx - exact;

  // All 4 rules for comparison
  const cmp = useMemo(() => ({
    left:  riemannSum(fn.f, aClamp, bClamp, N, 'left'),
    right: riemannSum(fn.f, aClamp, bClamp, N, 'right'),
    mid:   riemannSum(fn.f, aClamp, bClamp, N, 'mid'),
    trap:  riemannSum(fn.f, aClamp, bClamp, N, 'trap'),
  }), [fn, aClamp, bClamp, N]);

  const span = Math.max(xMax - xMin, yMax - yMin);

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={span * 1.5} bloomIntensity={0.5} bloomThreshold={0.6}>
          {/* Axes */}
          <Line points={[[xMin, 0, 0], [xMax, 0, 0]]} color="#64748B" lineWidth={1} />
          <Line points={[[0, yMin, 0], [0, yMax, 0]]} color="#64748B" lineWidth={1} />

          {/* Grid */}
          {(() => {
            const out: React.ReactElement[] = [];
            const nx = 12, ny = 10;
            const ddx = (xMax - xMin) / nx;
            const ddy = (yMax - yMin) / ny;
            for (let i = 1; i < nx; i++) {
              const x = xMin + ddx * i;
              out.push(<Line key={`gx${i}`} points={[[x, yMin, 0], [x, yMax, 0]]} color="#1E293B" lineWidth={0.5} transparent opacity={0.45} />);
            }
            for (let j = 1; j < ny; j++) {
              const y = yMin + ddy * j;
              out.push(<Line key={`gy${j}`} points={[[xMin, y, 0], [xMax, y, 0]]} color="#1E293B" lineWidth={0.5} transparent opacity={0.45} />);
            }
            return out;
          })()}

          {/* Riemann rectangles (left/right/mid) — filled planes */}
          {rule !== 'trap' && rects.map((r, i) => (
            <mesh key={`r${i}`} position={[r.x + r.w / 2, r.h / 2, -0.005]}>
              <planeGeometry args={[r.w * 0.98, Math.abs(r.h)]} />
              <meshBasicMaterial
                color={r.positive ? '#FDB813' : '#EF5350'}
                transparent
                opacity={0.35}
              />
            </mesh>
          ))}
          {/* Rectangle outlines */}
          {rule !== 'trap' && rects.map((r, i) => (
            <Line
              key={`ro${i}`}
              points={[
                [r.x, 0, 0],
                [r.x, r.h, 0],
                [r.x + r.w, r.h, 0],
                [r.x + r.w, 0, 0],
              ]}
              color={r.positive ? '#FDB813' : '#EF5350'}
              lineWidth={1}
              transparent
              opacity={0.9}
            />
          ))}

          {/* Trapezoid outlines */}
          {rule === 'trap' && trapPolys.map((poly, i) => (
            <Line key={`tp${i}`} points={poly} color="#FDB813" lineWidth={1} transparent opacity={0.9} />
          ))}

          {/* The function curve (pink) */}
          {curvePts.map((seg, i) => (
            <Line key={`f${i}`} points={seg} color="#F472B6" lineWidth={2.5} />
          ))}

          {/* Endpoints a, b */}
          <mesh position={[aClamp, 0, 0]}>
            <sphereGeometry args={[span * 0.011, 14, 14]} />
            <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={1.2} />
          </mesh>
          <mesh position={[bClamp, 0, 0]}>
            <sphereGeometry args={[span * 0.011, 14, 14]} />
            <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={1.2} />
          </mesh>
        </Stage>

        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div><span className="text-[#F472B6]">━</span> f(x)</div>
          <div><span className="text-[#FDB813]">▮</span> área positiva (suma {rule === 'trap' ? 'trapezoidal' : `regla ${rule}`})</div>
          <div><span className="text-[#EF5350]">▮</span> área negativa (f &lt; 0)</div>
          <div><span className="text-[#34D399]">●</span> a, b</div>
        </div>
      </div>

      <LessonPanel<IntState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.fnId !== undefined) setFnId(patch.fnId);
          if (patch.N    !== undefined) setN(Math.round(patch.N));
          if (patch.rule !== undefined) setRule(patch.rule);
          if (patch.a    !== undefined) setA(patch.a);
          if (patch.b    !== undefined) setB(patch.b);
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Función</div>
              <div className="grid grid-cols-3 gap-1.5">
                {FUNCS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => { setFnId(f.id); setA(f.defaultA); setB(f.defaultB); }}
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
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Regla</div>
              <div className="grid grid-cols-4 gap-1">
                {(['left', 'right', 'mid', 'trap'] as Rule[]).map(r => (
                  <button
                    key={r}
                    onClick={() => setRule(r)}
                    className={`text-[10px] px-1.5 py-1 rounded border transition ${
                      rule === r
                        ? 'bg-[#FDB813]/15 border-[#FDB813]/50 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#FDB813]/30'
                    }`}
                  >
                    {r === 'left' ? 'izq' : r === 'right' ? 'der' : r === 'mid' ? 'med' : 'trap'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-[#94A3B8]">
                N = <span className="text-white font-mono">{N}</span> subintervalos
              </label>
              <input
                type="range" min={1} max={200} step={1}
                value={N}
                onChange={e => setN(parseInt(e.target.value))}
                className="w-full accent-[#FDB813]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] text-[#94A3B8]">
                a = <span className="text-[#34D399] font-mono">{aClamp.toFixed(3)}</span>
                <input
                  type="range" min={xMin + 0.05} max={xMax - 0.1} step={0.01}
                  value={aClamp}
                  onChange={e => setA(parseFloat(e.target.value))}
                  className="w-full accent-[#34D399]"
                />
              </label>
              <label className="block text-[11px] text-[#94A3B8]">
                b = <span className="text-[#34D399] font-mono">{bClamp.toFixed(3)}</span>
                <input
                  type="range" min={xMin + 0.1} max={xMax - 0.05} step={0.01}
                  value={bClamp}
                  onChange={e => setB(parseFloat(e.target.value))}
                  className="w-full accent-[#34D399]"
                />
              </label>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-1 text-[12px] font-mono">
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">∫ aprox.</span>
                <span className="text-[#FDB813]">{approx.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">∫ exacta</span>
                <span className="text-white">{exact.toFixed(6)}</span>
              </div>
              <div className="flex justify-between border-t border-[#1E293B] pt-1 mt-1">
                <span className="text-[#94A3B8]">error</span>
                <span className={Math.abs(err) < 1e-3 ? 'text-[#34D399]' : 'text-[#EF5350]'}>
                  {err.toExponential(3)}
                </span>
              </div>
            </div>

            <div className="border-t border-[#1E293B] pt-3">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Comparación de reglas (N={N})</div>
              <div className="space-y-0.5 text-[10px] font-mono">
                {(['left', 'right', 'mid', 'trap'] as Rule[]).map(r => {
                  const e = cmp[r] - exact;
                  return (
                    <div key={r} className="flex justify-between">
                      <span className={r === rule ? 'text-[#FDB813]' : 'text-[#94A3B8]'}>
                        {r === 'left' ? 'izquierda' : r === 'right' ? 'derecha' : r === 'mid' ? 'punto medio' : 'trapezoidal'}
                      </span>
                      <span className={Math.abs(e) < 1e-3 ? 'text-[#34D399]' : Math.abs(e) < 0.1 ? 'text-[#94A3B8]' : 'text-[#EF5350]'}>
                        {e.toExponential(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Izq/der: O(Δx). Medio/trap: O(Δx²). TFC: ∫_a^b f dx = F(b) − F(a).
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
