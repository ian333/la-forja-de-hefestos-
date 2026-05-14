/**
 * Fractales de Newton — Needham §3 / Strogatz "Nonlinear Dynamics" §10.
 *
 *   Newton-Raphson en ℂ:    z_{n+1} = z_n − p(z_n) / p'(z_n)
 *
 * Cada punto z₀ ∈ ℂ converge a UNA raíz (o no converge). Color = raíz alcanzada.
 * Altura = #iteraciones (más alto → más cerca de la frontera fractal de Julia).
 *
 * Animación continua: una "sonda" orbita en el plano y traza en vivo la
 * iteración de Newton — vemos saltar entre cuencas según dónde la pones.
 */

import { useMemo, useState, useRef } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

// ── Lesson state ──────────────────────────────────────────────────────

interface NewtonLessonState {
  preset: string;
}

// ── Complex arithmetic ────────────────────────────────────────────────

type C = [number, number];

const cAdd  = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const cSub  = (a: C, b: C): C => [a[0] - b[0], a[1] - b[1]];
const cMul  = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cDiv  = (a: C, b: C): C => {
  const denom = b[0] * b[0] + b[1] * b[1];
  if (denom < 1e-30) return [NaN, NaN];
  return [(a[0] * b[0] + a[1] * b[1]) / denom, (a[1] * b[0] - a[0] * b[1]) / denom];
};
const cScale = (a: C, s: number): C => [a[0] * s, a[1] * s];
const cAbs2  = (a: C): number => a[0] * a[0] + a[1] * a[1];
const cPow2  = (a: C): C => [a[0] * a[0] - a[1] * a[1], 2 * a[0] * a[1]];
const cPow3  = (a: C): C => cMul(cPow2(a), a);
const cPow4  = (a: C): C => cPow2(cPow2(a));
const cPow5  = (a: C): C => cMul(cPow4(a), a);

// ── Polynomial presets ────────────────────────────────────────────────

interface Poly {
  id: string;
  label: string;
  formula: string;
  p:  (z: C) => C;
  pp: (z: C) => C;
  roots: C[];
}

const SQ3 = Math.sqrt(3) / 2;

const POLYS: Poly[] = [
  {
    id: 'z3-1',
    label: 'z³ − 1',
    formula: 'p(z) = z³ − 1     p\'(z) = 3z²',
    p:  z => cSub(cPow3(z), [1, 0]),
    pp: z => cScale(cPow2(z), 3),
    roots: [[1, 0], [-0.5, SQ3], [-0.5, -SQ3]],
  },
  {
    id: 'z4-1',
    label: 'z⁴ − 1',
    formula: 'p(z) = z⁴ − 1     p\'(z) = 4z³',
    p:  z => cSub(cPow4(z), [1, 0]),
    pp: z => cScale(cPow3(z), 4),
    roots: [[1, 0], [0, 1], [-1, 0], [0, -1]],
  },
  {
    id: 'z3-z',
    label: 'z³ − z',
    formula: 'p(z) = z³ − z     p\'(z) = 3z² − 1',
    p:  z => cSub(cPow3(z), z),
    pp: z => cSub(cScale(cPow2(z), 3), [1, 0]),
    roots: [[0, 0], [1, 0], [-1, 0]],
  },
  {
    id: 'z5-1',
    label: 'z⁵ − 1',
    formula: 'p(z) = z⁵ − 1     p\'(z) = 5z⁴',
    p:  z => cSub(cPow5(z), [1, 0]),
    pp: z => cScale(cPow4(z), 5),
    roots: Array.from({ length: 5 }, (_, k) => {
      const θ = (2 * Math.PI * k) / 5;
      return [Math.cos(θ), Math.sin(θ)] as C;
    }),
  },
  {
    id: 'z3-2z+2',
    label: 'z³ − 2z + 2 (patológica de Smale)',
    formula: 'p(z) = z³ − 2z + 2     p\'(z) = 3z² − 2',
    p:  z => cAdd(cSub(cPow3(z), cScale(z, 2)), [2, 0]),
    pp: z => cSub(cScale(cPow2(z), 3), [2, 0]),
    roots: [[-1.7693, 0], [0.88465, 0.58974], [0.88465, -0.58974]],
  },
];

const ROOT_COLORS = ['#F472B6', '#4FC3F7', '#FDB813', '#34D399', '#A78BFA'];
const DIVERGENT_COLOR = '#1E293B';

// ── Newton iteration ──────────────────────────────────────────────────

const MAX_ITER = 32;
const TOL_SQ = 1e-6;

function newtonIterate(z0: C, poly: Poly): { rootIdx: number; iters: number } {
  let z = z0;
  for (let i = 0; i < MAX_ITER; i++) {
    const pv = poly.p(z);
    const dv = poly.pp(z);
    if (cAbs2(dv) < 1e-20) return { rootIdx: -1, iters: MAX_ITER };
    z = cSub(z, cDiv(pv, dv));
    if (!isFinite(z[0]) || !isFinite(z[1])) return { rootIdx: -1, iters: MAX_ITER };
    for (let r = 0; r < poly.roots.length; r++) {
      const dx = z[0] - poly.roots[r][0];
      const dy = z[1] - poly.roots[r][1];
      if (dx * dx + dy * dy < TOL_SQ) return { rootIdx: r, iters: i + 1 };
    }
  }
  return { rootIdx: -1, iters: MAX_ITER };
}

// Live trace for the animated probe — returns up to maxSteps points
function newtonTrace(z0: C, poly: Poly, maxSteps: number): C[] {
  const pts: C[] = [z0];
  let z = z0;
  for (let i = 0; i < maxSteps; i++) {
    const pv = poly.p(z);
    const dv = poly.pp(z);
    if (cAbs2(dv) < 1e-20) break;
    z = cSub(z, cDiv(pv, dv));
    if (!isFinite(z[0])) break;
    pts.push([
      Math.max(-HALF, Math.min(HALF, z[0])),
      Math.max(-HALF, Math.min(HALF, z[1])),
    ]);
    for (const r of poly.roots) {
      if ((z[0] - r[0]) ** 2 + (z[1] - r[1]) ** 2 < 1e-4) return pts;
    }
  }
  return pts;
}

// ── Fractal grid (vertex arrays for the heightmap) ─────────────────────

const HALF = 1.7;
const N = 121;
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
      const r = newtonIterate([x, y], poly);
      const idx = (j * N + i) * 3;
      positions[idx + 0] = x;
      positions[idx + 2] = y;
      positions[idx + 1] = -r.iters * HEIGHT_SCALE * 0.6 + 0.6;
      const hex = r.rootIdx >= 0 ? ROOT_COLORS[r.rootIdx % ROOT_COLORS.length] : DIVERGENT_COLOR;
      tmpColor.set(hex);
      const t = Math.min(1, r.iters / 18);
      const dark = 0.25;
      const mix = dark + (1 - dark) * (1 - t);
      colors[idx + 0] = tmpColor.r * mix;
      colors[idx + 1] = tmpColor.g * mix;
      colors[idx + 2] = tmpColor.b * mix;
    }
  }

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
    body: `Newton-Raphson es UNA línea:

z_{n+1} = z_n − p(z_n) / p'(z_n)

Empezás cerca de una raíz, la encontrás. Aburrido.

PERO si dejás z₀ correr por todo el plano complejo, cada punto te lleva a UNA raíz — y la frontera entre cuencas es un FRACTAL infinito. Tres colores entrelazados, donde sea que mires hay otra copia más chica.

La sonda blanca orbita en vivo: ves la iteración salir de un punto y caer a una raíz. Cambia de raíz cuando cruza la frontera fractal.

En la práctica: si diseñás un control con Newton-Raphson, y empezás demasiado cerca de la frontera, ¡saltás a una raíz inestable! Caos clásico.`,
  },

  steps: [
    {
      title: 'z³ − 1 — tres raíces, tres colores',
      duration: 5000,
      body: `p(z) = z³ − 1. Las tres raíces son las raíces cúbicas de la unidad:

ω⁰ = 1,    ω¹ = −½ + i√3/2,    ω² = −½ − i√3/2.

Lejos del origen, cada tercio del plano es "leal" a su raíz más cercana. Pero cerca del centro, los tres colores se ENTRETEJEN — la sonda blanca te lo muestra: pequeños cambios saltan entre raíces.`,
      formula: 'z_{n+1} = z_n − (z_n³ − 1) / (3z_n²)',
      keyframes: [
        { at: 0, state: { preset: 'z3-1' } },
        { at: 1, state: { preset: 'z3-1' } },
      ],
    },
    {
      title: 'z⁴ − 1 — cuatro cuencas',
      duration: 5000,
      body: `p(z) = z⁴ − 1. Cuatro raíces: 1, i, −1, −i. Cuatro colores en los ejes ±X, ±Y.

Las fronteras siguen siendo fractales. ENTRE el rosa y el azul aparecen pellizcos de ámbar y verde — la iteración puede oscilar arbitrariamente cerca del límite.`,
      formula: 'p(z) = z⁴ − 1     raíces = {1, i, −1, −i}',
      keyframes: [
        { at: 0, state: { preset: 'z4-1' } },
        { at: 1, state: { preset: 'z4-1' } },
      ],
    },
    {
      title: 'z³ − z — tres raíces reales',
      duration: 5000,
      body: `p(z) = z(z−1)(z+1). Tres raíces sobre el eje real.

Newton-Raphson real alcanzaría rápido cualquiera. Pero en ℂ aparecen DOS bandas verticales de basin boundary entre las tres raíces.

El problema "real" tiene una estructura COMPLEJA invisible al ojo del cálculo 1D.`,
      formula: 'p(z) = z(z−1)(z+1)\np\'(z) = 3z² − 1',
      keyframes: [
        { at: 0, state: { preset: 'z3-z' } },
        { at: 1, state: { preset: 'z3-z' } },
      ],
    },
    {
      title: 'Patológica de Smale — z³ − 2z + 2',
      duration: 5500,
      body: `Famoso ejemplo: p(z) = z³ − 2z + 2. En el eje REAL, Newton cae en un CICLO período-2 si empezás cerca de z=0.

Pero en ℂ el conjunto donde Newton falla es de medida cero. Casi todo z₀ converge.

Las áreas oscuras anuncian la "trampa" del ciclo real — el modo donde Newton se atasca.`,
      formula: 'z₀ = 0  →  z₁ = 1  →  z₂ = 0  →  ciclo',
      keyframes: [
        { at: 0, state: { preset: 'z3-2z+2' } },
        { at: 1, state: { preset: 'z3-2z+2' } },
      ],
    },
    {
      title: 'z⁵ − 1 — la flor con propiedad de Wada',
      duration: 5500,
      body: `p(z) = z⁵ − 1. Cinco raíces: e^(2πik/5), k = 0..4.

Cinco colores formando una "flor". La frontera tiene propiedad de Wada: en CUALQUIER punto donde se tocan DOS cuencas, también tocan las OTRAS TRES.

Frontera = conjunto de Julia con dimensión fractal > 1.`,
      formula: 'raíces = {e^(2πik/5) : k = 0..4}',
      keyframes: [
        { at: 0, state: { preset: 'z5-1' } },
        { at: 1, state: { preset: 'z5-1' } },
      ],
    },
  ],

  connect: {
    body: `Newton-Raphson en ℂ no es decoración. Aparece en:

• Control automático — encontrar polos de 1 + k·G(s) = 0 para diseñar PIDs. Si empezás Newton cerca de la frontera fractal, podés saltar a un polo INESTABLE y volar el sistema. En la rama de EM ves cómo i aparece naturalmente como impedancia.

• Caos clásico (péndulo doble) — la misma sensibilidad a condiciones iniciales: dos lanzamientos casi idénticos terminan en estados muy distintos.

• Mecánica orbital — N-cuerpos comparte la "frontera fractal entre regímenes".

• Galois / Abel — no hay fórmula cerrada para polinomios grado ≥ 5, así que usar Newton numéricamente es OBLIGATORIO — y la fractalidad es inevitable.`,
    links: [
      { label: 'Campos EM — impedancia compleja Z = R + iωL', href: '/physics.html#em/fields' },
      { label: 'Péndulo doble — sensibilidad a condiciones iniciales', href: '/physics.html#mech/double-pendulum' },
      { label: 'Möbius — círculos a círculos', href: '#complex/mobius' },
      { label: 'Mapas conformes — Joukowski airfoil', href: '#complex/conformal' },
    ],
  },
};

// ── Inner 3D scene (lives inside Stage's Canvas, can use useFrame) ─────

function NewtonScene({ poly }: { poly: Poly }) {
  // Heightmap arrays
  const { positions, colors, indices } = useMemo(() => buildFractal(poly), [poly]);

  // Animated probe — orbits in (x, y) plane
  const probeMeshRef = useRef<THREE.Mesh>(null);
  const traceGeomRef = useRef<THREE.BufferGeometry>(null);
  const heightmapRef = useRef<THREE.Group>(null);

  // Fixed-size trace buffer (max 14 points × 3 floats)
  const TRACE_CAP = 14;
  const tracePositions = useMemo(() => new Float32Array(TRACE_CAP * 3), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    // Probe orbit
    const r = 0.55 + 0.4 * Math.sin(t * 0.31);
    const θ = t * 0.45;
    const z0: C = [r * Math.cos(θ), r * Math.sin(θ)];

    if (probeMeshRef.current) {
      probeMeshRef.current.position.set(z0[0], 0.92, z0[1]);
    }

    // Live Newton trace
    const trace = newtonTrace(z0, poly, TRACE_CAP - 1);
    const nTrace = Math.min(TRACE_CAP, trace.length);
    for (let i = 0; i < nTrace; i++) {
      tracePositions[i * 3 + 0] = trace[i][0];
      tracePositions[i * 3 + 1] = 0.92;
      tracePositions[i * 3 + 2] = trace[i][1];
    }
    // Repeat the last point to fill the buffer (so the segments don't draw garbage)
    const last = trace[nTrace - 1];
    for (let i = nTrace; i < TRACE_CAP; i++) {
      tracePositions[i * 3 + 0] = last[0];
      tracePositions[i * 3 + 1] = 0.92;
      tracePositions[i * 3 + 2] = last[1];
    }
    if (traceGeomRef.current) {
      const attr = traceGeomRef.current.attributes.position as THREE.BufferAttribute;
      attr.needsUpdate = true;
    }

    // Subtle heightmap rotation
    if (heightmapRef.current) {
      heightmapRef.current.rotation.y = Math.sin(t * 0.08) * 0.12;
    }
  });

  return (
    <>
      {/* Heightmap fractal */}
      <group ref={heightmapRef}>
        <mesh>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={positions.length / 3}
              array={positions}
              itemSize={3}
              args={[positions, 3]}
            />
            <bufferAttribute
              attach="attributes-color"
              count={colors.length / 3}
              array={colors}
              itemSize={3}
              args={[colors, 3]}
            />
            <bufferAttribute
              attach="index"
              count={indices.length}
              array={indices}
              itemSize={1}
              args={[indices, 1]}
            />
          </bufferGeometry>
          <meshStandardMaterial
            vertexColors
            metalness={0.18}
            roughness={0.55}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Root markers — emissive, slight pulse */}
      {poly.roots.map((root, i) => (
        <RootMarker key={i} position={[root[0], 0.78, root[1]]} color={ROOT_COLORS[i % ROOT_COLORS.length]} index={i} />
      ))}

      {/* Animated probe (the white dot z₀) */}
      <mesh ref={probeMeshRef}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1.8} />
      </mesh>

      {/* Live Newton trace — line strip from z₀ to root */}
      <line>
        <bufferGeometry ref={traceGeomRef}>
          <bufferAttribute
            attach="attributes-position"
            count={TRACE_CAP}
            array={tracePositions}
            itemSize={3}
            args={[tracePositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#FFFFFF" transparent opacity={0.85} linewidth={1} />
      </line>

      {/* Axes (subtle) */}
      <Line points={[[-HALF, 0.72, 0], [HALF, 0.72, 0]]} color="#475569" lineWidth={0.5} transparent opacity={0.5} />
      <Line points={[[0, 0.72, -HALF], [0, 0.72, HALF]]} color="#475569" lineWidth={0.5} transparent opacity={0.5} />
    </>
  );
}

function RootMarker({ position, color, index }: { position: [number, number, number]; color: string; index: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    const pulse = 0.8 + 0.2 * Math.sin(t * 2 + index * 0.7);
    meshRef.current.scale.setScalar(pulse);
  });
  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.085, 24, 24]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} />
    </mesh>
  );
}

// ── Component ─────────────────────────────────────────────────────────

export default function NewtonFractals() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState('z3-1');

  const poly = useMemo(
    () => POLYS.find(p => p.id === presetId) ?? POLYS[0],
    [presetId],
  );

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={4.2} bloomIntensity={0.5} bloomThreshold={0.55}>
          <NewtonScene poly={poly} />
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
          <div className="text-[#64748B] text-[10px] mt-1">altura ∝ #iters · color = cuenca · sonda blanca = z₀</div>
        </div>
      </div>

      <LessonPanel<NewtonLessonState>
        lesson={LESSON}
        onApplyState={patch => {
          if (typeof patch.preset === 'string') setPresetId(patch.preset);
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

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Grid {N}×{N}, hasta {MAX_ITER} iters, tol = √{TOL_SQ.toExponential(0)}.
                Frontera = ∂ de cada cuenca = conjunto de Julia.
                Sonda orbita con r(t) = 0.55 + 0.4 sin(0.31t), θ(t) = 0.45t.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
