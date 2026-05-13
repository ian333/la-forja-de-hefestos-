/**
 * Fractales de Newton — Needham §3 / Strogatz "Nonlinear Dynamics" §10.
 *
 *   Newton-Raphson en ℂ:    z_{n+1} = z_n − p(z_n) / p'(z_n)
 *
 * Para cada punto z₀ ∈ ℂ corremos la iteración. Si converge a una raíz, le
 * asignamos un color (uno por raíz) y una altura (≈ #iteraciones). Donde la
 * iteración es ambigua — la frontera entre cuencas de atracción — emerge un
 * patrón fractal. Es el ejemplo canónico de cómo "encontrar raíces", que parece
 * un problema bobo de cálculo, tiene una estructura topológica infinita.
 *
 * Visualización: heightmap 3D. La superficie está hundida (Y < 0) donde
 * converge rápido, y se queda plana arriba donde tarda. Las "crestas" entre
 * cuencas son las fronteras fractales.
 *
 * Conexión a la física real:
 *   - Control: encontrar polos del sistema en lazo cerrado (s donde 1+kG(s)=0)
 *     usa Newton-Raphson en ℂ. La forma de la cuenca te dice si el algoritmo
 *     converge a la raíz buena o salta a otra (¡puede mandar a un sistema
 *     inestable!).
 *   - Caos clásico: el péndulo doble exhibe la misma sensibilidad — pequeños
 *     cambios en condiciones iniciales saltan entre cuencas.
 */

import { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

// ── Lesson state ──────────────────────────────────────────────────────

interface NewtonLessonState {
  preset: string;
  showRoots: number;     // 0 → 1 (controla opacidad de marcadores)
  showSurface: number;   // 0 → 1
}

// ── Complex arithmetic ────────────────────────────────────────────────

type C = [number, number];

const c = {
  add:  (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]],
  sub:  (a: C, b: C): C => [a[0] - b[0], a[1] - b[1]],
  mul:  (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div:  (a: C, b: C): C => {
    const denom = b[0] * b[0] + b[1] * b[1];
    if (denom < 1e-30) return [NaN, NaN];
    return [(a[0] * b[0] + a[1] * b[1]) / denom, (a[1] * b[0] - a[0] * b[1]) / denom];
  },
  scale: (a: C, s: number): C => [a[0] * s, a[1] * s],
  pow2: (a: C): C => [a[0] * a[0] - a[1] * a[1], 2 * a[0] * a[1]],
  pow3: (a: C): C => {
    const sq = c.pow2(a);
    return c.mul(sq, a);
  },
  pow4: (a: C): C => c.pow2(c.pow2(a)),
  pow5: (a: C): C => c.mul(c.pow4(a), a),
  abs2: (a: C): number => a[0] * a[0] + a[1] * a[1],
};

// ── Polynomial presets ────────────────────────────────────────────────

interface Poly {
  id: string;
  label: string;
  formula: string;
  p:  (z: C) => C;
  pp: (z: C) => C;   // derivada
  roots: C[];
}

const SQ3 = Math.sqrt(3) / 2;

const POLYS: Poly[] = [
  {
    id: 'z3-1',
    label: 'z³ − 1',
    formula: 'p(z) = z³ − 1     p\'(z) = 3z²',
    p:  z => c.sub(c.pow3(z), [1, 0]),
    pp: z => c.scale(c.pow2(z), 3),
    roots: [[1, 0], [-0.5, SQ3], [-0.5, -SQ3]],
  },
  {
    id: 'z4-1',
    label: 'z⁴ − 1',
    formula: 'p(z) = z⁴ − 1     p\'(z) = 4z³',
    p:  z => c.sub(c.pow4(z), [1, 0]),
    pp: z => c.scale(c.pow3(z), 4),
    roots: [[1, 0], [0, 1], [-1, 0], [0, -1]],
  },
  {
    id: 'z3-z',
    label: 'z³ − z',
    formula: 'p(z) = z³ − z = z(z−1)(z+1)     p\'(z) = 3z² − 1',
    p:  z => c.sub(c.pow3(z), z),
    pp: z => c.sub(c.scale(c.pow2(z), 3), [1, 0]),
    roots: [[0, 0], [1, 0], [-1, 0]],
  },
  {
    id: 'z5-1',
    label: 'z⁵ − 1',
    formula: 'p(z) = z⁵ − 1     p\'(z) = 5z⁴',
    p:  z => c.sub(c.pow5(z), [1, 0]),
    pp: z => c.scale(c.pow4(z), 5),
    roots: Array.from({ length: 5 }, (_, k) => {
      const θ = (2 * Math.PI * k) / 5;
      return [Math.cos(θ), Math.sin(θ)] as C;
    }),
  },
  {
    id: 'z3-2z+2',
    label: 'z³ − 2z + 2 (patológica)',
    formula: 'p(z) = z³ − 2z + 2     p\'(z) = 3z² − 2',
    // Smale's "patológica": Newton-Raphson tiene ciclo periódico real cerca de z=0
    // (la iteración real diverge), pero en ℂ converge a las 3 raíces complejas.
    p:  z => c.add(c.sub(c.pow3(z), c.scale(z, 2)), [2, 0]),
    pp: z => c.sub(c.scale(c.pow2(z), 3), [2, 0]),
    roots: [
      // Raíces de z³ − 2z + 2 = 0  (calculadas con Cardano numérico)
      [-1.7693, 0],
      [0.88465, 0.58974],
      [0.88465, -0.58974],
    ],
  },
];

// ── Colors per root (matched to roots[i]) ─────────────────────────────

const ROOT_COLORS = [
  '#F472B6', // rosa  (raíz 0)
  '#4FC3F7', // azul  (raíz 1)
  '#FDB813', // ámbar (raíz 2)
  '#34D399', // verde (raíz 3)
  '#A78BFA', // violeta (raíz 4)
];

const DIVERGENT_COLOR = '#1E293B'; // no convergió

// ── Newton iteration ──────────────────────────────────────────────────

interface NewtonResult {
  rootIdx: number;   // -1 si no convergió
  iters: number;     // [0, MAX_ITER]
}

const MAX_ITER = 32;
const TOL_SQ = 1e-6;

function newtonIterate(z0: C, poly: Poly): NewtonResult {
  let z = z0;
  for (let i = 0; i < MAX_ITER; i++) {
    const pv = poly.p(z);
    const dv = poly.pp(z);
    if (c.abs2(dv) < 1e-20) return { rootIdx: -1, iters: MAX_ITER };
    z = c.sub(z, c.div(pv, dv));
    if (!isFinite(z[0]) || !isFinite(z[1])) return { rootIdx: -1, iters: MAX_ITER };
    for (let r = 0; r < poly.roots.length; r++) {
      const dx = z[0] - poly.roots[r][0];
      const dy = z[1] - poly.roots[r][1];
      if (dx * dx + dy * dy < TOL_SQ) return { rootIdx: r, iters: i + 1 };
    }
  }
  return { rootIdx: -1, iters: MAX_ITER };
}

// ── Build heightmap geometry from polynomial ──────────────────────────

const HALF = 1.7;       // mundo ∈ [-HALF, HALF] × [-HALF, HALF]
const N = 121;          // resolución del grid (N×N vértices)
const HEIGHT_SCALE = 0.04;

interface FractalGeom {
  positions: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

function buildFractal(poly: Poly): FractalGeom {
  const positions = new Float32Array(N * N * 3);
  const colors = new Float32Array(N * N * 3);
  const indices = new Uint32Array((N - 1) * (N - 1) * 6);
  const tmpColor = new THREE.Color();

  for (let j = 0; j < N; j++) {
    const y = -HALF + (j / (N - 1)) * 2 * HALF;
    for (let i = 0; i < N; i++) {
      const x = -HALF + (i / (N - 1)) * 2 * HALF;
      const z0: C = [x, y];
      const r = newtonIterate(z0, poly);

      const idx = (j * N + i) * 3;
      positions[idx + 0] = x;
      positions[idx + 2] = y;
      // Altura: cuanto MÁS rápido converge (menos iters) → más HUNDIDO. Cuanto
      // más cerca de la frontera fractal (más iters) → la superficie sube.
      positions[idx + 1] = -r.iters * HEIGHT_SCALE * 0.6 + 0.6;

      // Color por raíz alcanzada, oscurecido por #iters
      const hex = r.rootIdx >= 0 ? ROOT_COLORS[r.rootIdx % ROOT_COLORS.length] : DIVERGENT_COLOR;
      tmpColor.set(hex);
      // Mezcla a oscuro por iters (rápidos → brillantes, lentos → oscuros)
      const t = Math.min(1, r.iters / 18);
      const dark = 0.25;
      const mix = dark + (1 - dark) * (1 - t);
      colors[idx + 0] = tmpColor.r * mix;
      colors[idx + 1] = tmpColor.g * mix;
      colors[idx + 2] = tmpColor.b * mix;
    }
  }

  // Triangulate
  let k = 0;
  for (let j = 0; j < N - 1; j++) {
    for (let i = 0; i < N - 1; i++) {
      const a = j * N + i;
      const b = a + 1;
      const cc = a + N;
      const d = cc + 1;
      indices[k++] = a; indices[k++] = cc; indices[k++] = b;
      indices[k++] = b; indices[k++] = cc; indices[k++] = d;
    }
  }
  return { positions, colors, indices };
}

// ── Lesson ────────────────────────────────────────────────────────────

const LESSON: Lesson<NewtonLessonState> = {
  hook: {
    title: 'Buscar la raíz de un polinomio puede esconder un fractal.',
    body: `Newton-Raphson es UNA línea: para encontrar dónde p(z) = 0, iterás

z_{n+1} = z_n − p(z_n) / p'(z_n)

Empezás cerca de una raíz, la encontrás. Aburrido.

PERO si dejás z₀ correr por todo el plano complejo, cada punto te lleva a UNA raíz — y la frontera entre "cuál raíz alcanzo" es un FRACTAL infinito. Tres colores entrelazados, donde sea que mires hay otra copia más chica.

Esto es lo que Cayley descubrió en 1879 y no entendió por qué. Hoy lo entendemos: las cuencas de atracción tienen "boundary" de Julia.

En la práctica: si diseñás un control con Newton-Raphson para encontrar polos, y empezás demasiado cerca de la frontera, ¡saltás a una raíz inestable! Caos clásico.`,
  },

  steps: [
    {
      title: 'z³ − 1 — tres raíces, tres colores',
      duration: 5000,
      body: `Polinomio canónico: p(z) = z³ − 1. Las tres raíces son las raíces cúbicas de la unidad:

ω⁰ = 1,    ω¹ = −½ + i√3/2,    ω² = −½ − i√3/2.

Cada punto rosa/azul/ámbar marca una raíz. Los colores muestran "desde qué z₀ acabamos en qué raíz".

Lejos del origen, cada tercio del plano es "leal" a su raíz más cercana. Pero cerca del centro, los tres colores se ENTRETEJEN — donde sea que pongás z₀ con cierta simetría, la iteración decide entre tres caminos.`,
      formula: 'z_{n+1} = z_n − (z_n³ − 1) / (3z_n²)',
      keyframes: [
        { at: 0, state: { preset: 'z3-1', showRoots: 1, showSurface: 1 } },
        { at: 1, state: { preset: 'z3-1', showRoots: 1, showSurface: 1 } },
      ],
    },
    {
      title: 'z⁴ − 1 — cuatro cuencas',
      duration: 5000,
      body: `Ahora p(z) = z⁴ − 1. Cuatro raíces: 1, i, −1, −i. Cuatro colores.

La geometría es DISTINTA al caso cúbico: las cuatro cuencas se acomodan en los ejes ±X, ±Y. Las fronteras siguen siendo fractales.

Importante: NO hay solo cuatro regiones simples. Mirá con cuidado — ENTRE el rosa y el azul aparecen pellizcos de ámbar y verde. Esto es porque la iteración puede oscilar arbitrariamente cerca del límite.`,
      formula: 'p(z) = z⁴ − 1     raíces = {1, i, −1, −i}',
      keyframes: [
        { at: 0, state: { preset: 'z4-1', showRoots: 1, showSurface: 1 } },
        { at: 1, state: { preset: 'z4-1', showRoots: 1, showSurface: 1 } },
      ],
    },
    {
      title: 'z³ − z — raíces sobre el eje real',
      duration: 5000,
      body: `p(z) = z³ − z = z(z−1)(z+1). Tres raíces reales: 0, +1, −1.

Si fueras un estudiante de cálculo 1, Newton-Raphson REAL alcanzaría rápido cualquiera de las tres. Pero en ℂ aparecen DOS bandas verticales de basin boundary entre las tres raíces.

Lección: el problema real de "buscar raíces" tiene una estructura COMPLEJA invisible al ojo del cálculo 1D.`,
      formula: 'p(z) = z(z−1)(z+1)\np\'(z) = 3z² − 1',
      keyframes: [
        { at: 0, state: { preset: 'z3-z', showRoots: 1, showSurface: 1 } },
        { at: 1, state: { preset: 'z3-z', showRoots: 1, showSurface: 1 } },
      ],
    },
    {
      title: 'Patológica de Smale — z³ − 2z + 2',
      duration: 5500,
      body: `Famoso ejemplo de Smale: p(z) = z³ − 2z + 2. En el eje REAL, Newton-Raphson cae en un CICLO de período 2 si empezás cerca de z=0 — NUNCA converge.

Pero en el plano complejo, el conjunto donde Newton falla es de medida cero. Casi todo z₀ converge a una de las tres raíces.

Las áreas oscuras alrededor del origen son donde la iteración tarda mucho — anuncian la "trampa" del ciclo real.

Moraleja: si tu solver de raíces ataca un polinomio en ℝ, podés caer en un ciclo. En ℂ casi siempre escapás.`,
      formula: 'z₀ = 0  →  z₁ = 1  →  z₂ = 0  →  ciclo',
      keyframes: [
        { at: 0, state: { preset: 'z3-2z+2', showRoots: 1, showSurface: 1 } },
        { at: 1, state: { preset: 'z3-2z+2', showRoots: 1, showSurface: 1 } },
      ],
    },
    {
      title: 'z⁵ − 1 — cinco basins y zoom al detalle',
      duration: 5500,
      body: `p(z) = z⁵ − 1. Las cinco raíces son las raíces quintas de la unidad: e^(2πik/5), k = 0..4.

Cinco colores formando una "flor". Pero el verdadero asombro es la frontera: en cualquier punto donde se tocan DOS colores, también aparece pellizco de los otros TRES — esto es el "Wada lakes" property.

Donde sea que tres o más cuencas se encuentren, todas las raíces tocan ese punto. La frontera es un fractal con dimensión > 1.`,
      formula: 'raíces = {e^(2πik/5) : k = 0..4}\nfrontera = conjunto de Julia ≅ fractal',
      keyframes: [
        { at: 0, state: { preset: 'z5-1', showRoots: 1, showSurface: 1 } },
        { at: 1, state: { preset: 'z5-1', showRoots: 1, showSurface: 1 } },
      ],
    },
  ],

  connect: {
    body: `Newton-Raphson en ℂ no es decoración. Aparece en:

• Control automático — encontrar polos de 1 + k·G(s) = 0 para diseñar PIDs. Si empezás Newton cerca de la frontera fractal, podés saltar a un polo INESTABLE y volar el sistema. (En la rama de EM ves cómo i aparece naturalmente como impedancia).

• Caos clásico (péndulo doble) — la misma sensibilidad a condiciones iniciales: dos lanzamientos casi idénticos terminan en estados muy distintos.

• Mecánica orbital — N-cuerpos comparte la "frontera fractal entre regímenes": una sonda puede caer al Sol o escapar según décimas de m/s.

• Galois / Abel — el hecho de que NO haya fórmula radicalmente cerrada para polinomios grado ≥ 5 obliga a usar Newton numéricamente — y la fractalidad es inevitable.`,
    links: [
      { label: 'Campos EM (impedancia compleja Z = R + iωL − i/ωC)', href: '/physics.html#em/fields' },
      { label: 'Péndulo doble — sensibilidad a condiciones iniciales', href: '/physics.html#mech/double-pendulum' },
      { label: 'Möbius — la otra cara de las transformaciones complejas', href: '#complex/mobius' },
    ],
  },
};

// ── Component ─────────────────────────────────────────────────────────

export default function NewtonFractals() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState('z3-1');
  const [showRoots, setShowRoots] = useState(1);
  const [showSurface, setShowSurface] = useState(1);

  const poly = useMemo(
    () => POLYS.find(p => p.id === presetId) ?? POLYS[0],
    [presetId],
  );

  const geom = useMemo(() => buildFractal(poly), [poly]);

  // Build BufferGeometry from arrays
  const bufferGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(geom.positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(geom.colors, 3));
    g.setIndex(new THREE.BufferAttribute(geom.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [geom]);

  useEffect(() => () => bufferGeom.dispose(), [bufferGeom]);

  // Map a complex point [x,y] to world [x, y_height, y_world]
  function worldOfRoot(r: C): [number, number, number] {
    return [r[0], 0.7, r[1]];
  }

  // Iteration tracer for a single starting point (display only)
  const tracePath = useMemo(() => {
    const z0: C = [0.1, 0.05];
    const pts: [number, number, number][] = [];
    let z = z0;
    pts.push([z[0], 0.85, z[1]]);
    for (let i = 0; i < 14; i++) {
      const pv = poly.p(z);
      const dv = poly.pp(z);
      if (c.abs2(dv) < 1e-20) break;
      z = c.sub(z, c.div(pv, dv));
      if (!isFinite(z[0])) break;
      const x = Math.max(-HALF, Math.min(HALF, z[0]));
      const y = Math.max(-HALF, Math.min(HALF, z[1]));
      pts.push([x, 0.85, y]);
      // Stop if reached a root
      let done = false;
      for (const r of poly.roots) {
        if ((z[0] - r[0]) ** 2 + (z[1] - r[1]) ** 2 < 1e-4) { done = true; break; }
      }
      if (done) break;
    }
    return pts;
  }, [poly]);

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={4.2} bloomIntensity={0.45} bloomThreshold={0.6}>
          {/* Fractal surface */}
          {showSurface > 0.05 && (
            <mesh geometry={bufferGeom} castShadow={false} receiveShadow={false}>
              <meshStandardMaterial
                vertexColors
                metalness={0.2}
                roughness={0.55}
                side={THREE.DoubleSide}
                transparent
                opacity={showSurface}
              />
            </mesh>
          )}

          {/* Root markers */}
          {showRoots > 0.05 && poly.roots.map((r, i) => {
            const [wx, wy, wz] = worldOfRoot(r);
            return (
              <mesh key={i} position={[wx, wy, wz]}>
                <sphereGeometry args={[0.07, 24, 24]} />
                <meshStandardMaterial
                  color={ROOT_COLORS[i % ROOT_COLORS.length]}
                  emissive={ROOT_COLORS[i % ROOT_COLORS.length]}
                  emissiveIntensity={1.4}
                  transparent
                  opacity={showRoots}
                />
              </mesh>
            );
          })}

          {/* Iteration trace from z₀ = (0.1, 0.05) */}
          {tracePath.length > 1 && (
            <Line points={tracePath} color="#FFFFFF" lineWidth={1.5} transparent opacity={0.75} />
          )}

          {/* Axes (subtle) */}
          <Line points={[[-HALF, 0.7, 0], [HALF, 0.7, 0]]} color="#475569" lineWidth={0.5} transparent opacity={0.6} />
          <Line points={[[0, 0.7, -HALF], [0, 0.7, HALF]]} color="#475569" lineWidth={0.5} transparent opacity={0.6} />
        </Stage>

        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div className="text-[#94A3B8]">{poly.label}</div>
          {poly.roots.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span style={{ color: ROOT_COLORS[i % ROOT_COLORS.length] }}>●</span>
              <span className="text-[10px]">
                raíz {i}: ({r[0].toFixed(3)}, {r[1].toFixed(3)})
              </span>
            </div>
          ))}
          <div className="text-[#64748B] text-[10px] mt-1">altura ∝ #iters · color = cuenca</div>
        </div>
      </div>

      <LessonPanel<NewtonLessonState>
        lesson={LESSON}
        onApplyState={patch => {
          if (patch.preset !== undefined) setPresetId(patch.preset);
          if (typeof patch.showRoots === 'number') setShowRoots(patch.showRoots);
          if (typeof patch.showSurface === 'number') setShowSurface(patch.showSurface);
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Polinomio</div>
              <div className="grid grid-cols-1 gap-1.5">
                {POLYS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPresetId(p.id)}
                    className={`text-[11px] px-2 py-1.5 rounded border transition text-left ${
                      presetId === p.id
                        ? 'bg-[#F472B6]/15 border-[#F472B6]/50 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#F472B6]/30'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-[#1E293B] pt-3">
              <pre className="text-[10px] font-mono text-[#FDB813] bg-[#05060A] border border-[#1E293B] rounded px-2 py-1.5 whitespace-pre-wrap leading-snug">
                {poly.formula}
              </pre>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-2">
              <label className="text-[11px] text-[#94A3B8] flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showSurface > 0.5}
                  onChange={e => setShowSurface(e.target.checked ? 1 : 0)}
                />
                Mostrar superficie fractal
              </label>
              <label className="text-[11px] text-[#94A3B8] flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showRoots > 0.5}
                  onChange={e => setShowRoots(e.target.checked ? 1 : 0)}
                />
                Mostrar marcadores de raíces
              </label>
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Grid {N}×{N}, hasta {MAX_ITER} iters, tol = √{TOL_SQ.toExponential(0)}. Frontera de Julia = ∂ de cada cuenca.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
