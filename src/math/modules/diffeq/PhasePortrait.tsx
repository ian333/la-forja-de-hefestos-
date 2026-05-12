/**
 * Retrato de fases 2D — la geometría de las ecuaciones diferenciales.
 *
 *   ẋ = f(x, y)
 *   ẏ = g(x, y)
 *
 * Cada punto del plano (x,y) tiene un VECTOR (ẋ, ẏ). Las soluciones del
 * sistema son trayectorias que siguen las flechas. Los equilibrios son
 * los puntos donde el vector se anula.
 *
 * Aquí mostramos:
 *   1. El campo vectorial muestreado en una rejilla, con flechas pequeñas.
 *   2. Click en cualquier punto del plano → integramos RK4 hacia adelante
 *      y hacia atrás → trayectoria en pantalla.
 *   3. Presets clásicos: Lotka-Volterra (presa-depredador), van der Pol
 *      (ciclo límite), Lorenz (proyección 2D), oscilador no-lineal.
 *
 * El "click" pedagógico: ver que las trayectorias NUNCA se cruzan (unicidad
 * de las EDO), ver los ciclos límite atractores de van der Pol, y entender
 * cómo Lorenz puede ser determinista pero impredecible.
 */

import { useMemo, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Line, Text } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

interface PhaseLessonState {
  presetId: string;
}

const LESSON: Lesson<PhaseLessonState> = {
  hook: {
    title: 'Las soluciones de una ecuación diferencial son CAMINOS en el plano.',
    body: `Una ecuación diferencial ordinaria dice cómo cambian dos cantidades x e y simultáneamente:

ẋ = f(x, y)     ẏ = g(x, y)

En cada punto del plano, hay un vector de velocidad. Si soltás una partícula ahí, sigue ese vector. Su trayectoria — la curva que dibuja — es UNA solución de la EDO.

Henri Poincaré (1890) tuvo la idea revolucionaria: en vez de buscar fórmulas para resolver EDOs, MIRAR la GEOMETRÍA de las soluciones. Equilibrios, ciclos, separatrices.

Esta clase recorre los retratos canónicos — los "tipos" cualitativos que dominan toda la dinámica no-lineal.`,
  },

  steps: [
    {
      title: 'Espiral estable — todo se hunde al origen',
      duration: 5500,
      body: `Primer sistema: ẋ = −x + y, ẏ = −x − y. Linear, con eigenvalores complejos de parte real negativa.

Mirá: las trayectorias rosadas SALEN de cualquier punto y caen en espiral hacia el origen. El equilibrio (0,0) es un FOCO ESTABLE.

Es lo que pasa en un oscilador amortiguado (péndulo con fricción), en circuitos RLC con resistencia, en cualquier sistema que se "calma" al estado de mínima energía.

La estabilidad se decide mirando los eigenvalores de la matriz [-1, 1; -1, -1] linealizada — todos con parte real negativa = atractor.`,
      formula: 'ẋ = −x + y\nẏ = −x − y\nλ = −1 ± i  (foco estable)',
      keyframes: [
        { at: 0, state: { presetId: 'spiral' } },
        { at: 1, state: { presetId: 'spiral' } },
      ],
    },
    {
      title: 'Silla — el equilibrio que repele',
      duration: 5500,
      body: `Ahora ẋ = x, ẏ = −y. Eigenvalores reales con signos OPUESTOS: +1 y -1.

Mirá: el origen NO es atractor. Las trayectorias se acercan por el eje y… y se alejan por el eje x. El equilibrio es un PUNTO DE SILLA.

Los ejes x e y son SEPARATRICES: dividen el plano en regiones donde las trayectorias se comportan distinto. Una vez que cruzaste una separatriz, tu destino cambia drásticamente.

En economía, climatología, biología — los puntos de silla marcan "puntos de no retorno".`,
      formula: 'ẋ = x, ẏ = −y\nλ = +1, −1  (silla)',
      keyframes: [
        { at: 0, state: { presetId: 'saddle' } },
        { at: 1, state: { presetId: 'saddle' } },
      ],
    },
    {
      title: 'Lotka-Volterra — presa y depredador',
      duration: 6000,
      body: `Cambio a ẋ = 1.5x − xy, ẏ = xy − y. Es Lotka-Volterra: x = conejos, y = zorros.

Mirá las ÓRBITAS CERRADAS alrededor del equilibrio (1, 1.5). Los conejos crecen, eso permite que los zorros crezcan, eso reduce los conejos, eso reduce los zorros, eso permite que los conejos vuelvan a crecer… ciclo eterno.

Las poblaciones oscilan PARA SIEMPRE — no convergen ni divergen. Cada órbita es estructuralmente estable: una pequeña perturbación cambia el tamaño de la órbita pero no su existencia.

Esto fue el primer modelo NO-LINEAL de ecología (Lotka 1925, Volterra 1926, mirando datos de pesca del Adriático).`,
      formula: 'ẋ = 1.5x − xy   (presa)\nẏ = xy − y       (depredador)',
      keyframes: [
        { at: 0, state: { presetId: 'lotka-volterra' } },
        { at: 1, state: { presetId: 'lotka-volterra' } },
      ],
    },
    {
      title: 'Van der Pol — ciclo límite atractor',
      duration: 6000,
      body: `Cambio a ẋ = y, ẏ = (1 − x²)y − x. Es el oscilador de Van der Pol (1920).

Mirá: empiezo trayectorias DESDE DENTRO del ciclo y desde AFUERA. AMBAS convergen al MISMO ciclo cerrado.

Eso es un CICLO LÍMITE: una solución periódica que ATRAE a las demás. No es una órbita cualquiera — es UN comportamiento robusto.

Aparece en electrónica (osciladores no lineales), biología (latido cardíaco modelado por FitzHugh-Nagumo es Van der Pol generalizado), neurociencia, química (reacciones oscilantes tipo Belousov-Zhabotinsky).`,
      formula: 'ẋ = y\nẏ = (1 − x²)y − x   (μ=1)',
      keyframes: [
        { at: 0, state: { presetId: 'van-der-pol' } },
        { at: 1, state: { presetId: 'van-der-pol' } },
      ],
    },
    {
      title: 'Péndulo no-lineal — librations y rotations',
      duration: 6500,
      body: `Último: ẋ = y, ẏ = −sin(x). Es el péndulo SIN aproximación de ángulos pequeños.

Mirá DOS familias de trayectorias separadas por la SEPARATRIZ (la curva que pasa por (±π, 0)):

• ADENTRO de la separatriz: el péndulo OSCILA — librations. Pequeñas oscilaciones cerca de (0, 0).
• AFUERA: el péndulo GIRA completamente — rotations. Tiene tanta energía que da vuelta tras vuelta.

La separatriz es energéticamente CRÍTICA: justo la energía suficiente para llegar al equilibrio inestable arriba (±π, 0).

Este es el primer sistema "real" donde las hermosas series de Taylor del péndulo lineal fallan. Hay que usar Jacobi elíptica.`,
      formula: 'ẍ + sin x = 0\nseparatriz: x = ±π\nadentro: librations\nafuera: rotations',
      keyframes: [
        { at: 0, state: { presetId: 'pendulum' } },
        { at: 1, state: { presetId: 'pendulum' } },
      ],
    },
  ],

  connect: {
    body: `Poincaré abrió esta forma de pensar: en vez de RESOLVER la ecuación, MIRAR la geometría.

Esta vista te lleva directo a:

• Teoría del caos: el atractor de Lorenz (que ya viste en presets) es la generalización 3D de estos retratos
• Estabilidad: Lyapunov definió "estable" sin resolver — mirando la geometría
• Bifurcaciones: cómo el retrato CAMBIA cuando varía un parámetro (período-doble → caos en logística)
• Termodinámica fuera del equilibrio: sistemas químicos con ciclos límite (Prigogine, Nobel 1977)
• Neurociencia: las EDOs de Hodgkin-Huxley para el potencial de acción del axón (Nobel 1963) viven aquí

El sandbox tiene 6 presets — explorá cada uno. Doná clicks para soltar partículas. La geometría te enseña la dinámica.`,
    links: [
      { label: 'Campos vectoriales — el dibujo subyacente', href: '#vector-fields' },
      { label: 'Eigenvectores — estabilidad lineal', href: '#eigen-3d' },
      { label: 'Plano tangente — derivadas en sistemas', href: '#tangent-plane' },
    ],
  },
};

type Field = (x: number, y: number) => [number, number];

interface Preset {
  id: string;
  label: string;
  blurb: string;
  field: Field;
  range: [number, number]; // [min, max] for both x and y
  equilibria?: [number, number][];
  initial?: [number, number][];
}

const PRESETS: Preset[] = [
  {
    id: 'lotka-volterra',
    label: 'Lotka-Volterra',
    blurb: 'Presa-depredador. α=1.5, β=1, γ=1, δ=1. Órbitas cerradas alrededor del equilibrio (1, 1.5).',
    field: (x, y) => [1.5 * x - x * y, x * y - y],
    range: [-0.5, 4],
    equilibria: [[0, 0], [1, 1.5]],
    initial: [[1.5, 2], [2.5, 1], [0.8, 3]],
  },
  {
    id: 'van-der-pol',
    label: 'Van der Pol',
    blurb: 'Oscilador no-lineal. μ=1. Ciclo límite atractor — todas las trayectorias convergen.',
    field: (x, y) => [y, 1 * (1 - x * x) * y - x],
    range: [-3.5, 3.5],
    equilibria: [[0, 0]],
    initial: [[0.1, 0], [3, 0], [-3, 0], [0.5, 2]],
  },
  {
    id: 'pendulum',
    label: 'Péndulo no-lineal',
    blurb: 'θ̈ + sin θ = 0. Vista del cilindro (θ, θ̇). Separatrices, librations, rotations.',
    field: (x, y) => [y, -Math.sin(x)],
    range: [-Math.PI * 1.2, Math.PI * 1.2],
    equilibria: [[0, 0], [Math.PI, 0], [-Math.PI, 0]],
    initial: [[0.5, 0], [Math.PI - 0.1, 0], [0, 2.5], [0, -2.5]],
  },
  {
    id: 'spiral',
    label: 'Espiral estable',
    blurb: 'ẋ = −x + y, ẏ = −x − y. Foco estable en el origen.',
    field: (x, y) => [-x + y, -x - y],
    range: [-3, 3],
    equilibria: [[0, 0]],
    initial: [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]],
  },
  {
    id: 'saddle',
    label: 'Silla',
    blurb: 'ẋ = x, ẏ = −y. Punto de silla en el origen — separatrices son los ejes.',
    field: (x, y) => [x, -y],
    range: [-3, 3],
    equilibria: [[0, 0]],
    initial: [[1, 0.1], [-1, 0.1], [0.1, 1], [0.1, -1], [1.5, 1.2], [-1.5, -1.2]],
  },
  {
    id: 'lorenz-xy',
    label: 'Lorenz (proyección XY)',
    blurb: 'Z fijado en 25. σ=10, ρ=28, β=8/3. Atractor extraño.',
    field: (x, y) => [10 * (y - x), 28 * x - y - x * 25],
    range: [-30, 30],
    equilibria: [],
    initial: [[1, 1], [-1, -1], [10, 0]],
  },
];

// RK4 integration step (dt fixed)
function rk4Step(field: Field, x: number, y: number, dt: number): [number, number] {
  const [k1x, k1y] = field(x, y);
  const [k2x, k2y] = field(x + dt * k1x / 2, y + dt * k1y / 2);
  const [k3x, k3y] = field(x + dt * k2x / 2, y + dt * k2y / 2);
  const [k4x, k4y] = field(x + dt * k3x, y + dt * k3y);
  return [
    x + dt * (k1x + 2 * k2x + 2 * k3x + k4x) / 6,
    y + dt * (k1y + 2 * k2y + 2 * k3y + k4y) / 6,
  ];
}

function integrate(field: Field, x0: number, y0: number, dt: number, steps: number, range: [number, number]): [number, number, number][] {
  const out: [number, number, number][] = [[x0, y0, 0]];
  let x = x0, y = y0;
  const margin = (range[1] - range[0]) * 0.1;
  const lo = range[0] - margin, hi = range[1] + margin;
  for (let i = 0; i < steps; i++) {
    [x, y] = rk4Step(field, x, y, dt);
    if (!isFinite(x) || !isFinite(y)) break;
    if (x < lo || x > hi || y < lo || y > hi) break;
    out.push([x, y, 0]);
  }
  return out;
}

// ── Vector field arrows ────────────────────────────────────────────────

const GRID_N = 18;

function buildArrows(field: Field, range: [number, number]) {
  const arrows: { p: [number, number]; v: [number, number]; mag: number }[] = [];
  let maxMag = 0;
  const [lo, hi] = range;
  const step = (hi - lo) / (GRID_N + 1);
  for (let i = 1; i <= GRID_N; i++) {
    for (let j = 1; j <= GRID_N; j++) {
      const x = lo + step * i;
      const y = lo + step * j;
      const [vx, vy] = field(x, y);
      if (!isFinite(vx) || !isFinite(vy)) continue;
      const mag = Math.hypot(vx, vy);
      if (mag > maxMag) maxMag = mag;
      arrows.push({ p: [x, y], v: [vx, vy], mag });
    }
  }
  // Normalize
  const len = (hi - lo) / GRID_N * 0.42;
  return arrows.map(a => {
    const m = a.mag / Math.max(maxMag, 1e-9);
    const scale = len * (0.3 + 0.7 * m);
    const norm = Math.max(a.mag, 1e-9);
    return {
      p: a.p,
      v: [a.v[0] / norm * scale, a.v[1] / norm * scale] as [number, number],
      mag: m,
    };
  });
}

// ── Component ─────────────────────────────────────────────────────────

export default function PhasePortrait() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState('lotka-volterra');
  const [trajectories, setTrajectories] = useState<[number, number, number][][]>([]);

  const preset = useMemo(() => PRESETS.find(p => p.id === presetId)!, [presetId]);

  // Reset trajectories when preset changes, seed with preset's initials
  const arrows = useMemo(() => buildArrows(preset.field, preset.range), [preset]);
  useMemo(() => {
    const seeded: [number, number, number][][] = [];
    for (const [x0, y0] of preset.initial ?? []) {
      const fwd = integrate(preset.field, x0, y0, 0.01, 2500, preset.range);
      const bck = integrate(preset.field, x0, y0, -0.01, 2500, preset.range);
      seeded.push([...bck.slice().reverse(), ...fwd]);
    }
    setTrajectories(seeded);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const handleClick = useCallback((event: any) => {
    const point = event.point;
    if (!point) return;
    // Map world space back to (x, y). Stage is set up so x/y map directly.
    const x = point.x;
    const y = point.y;
    const fwd = integrate(preset.field, x, y, 0.01, 2500, preset.range);
    const bck = integrate(preset.field, x, y, -0.01, 2500, preset.range);
    setTrajectories(prev => [...prev, [...bck.slice().reverse(), ...fwd]].slice(-12));
  }, [preset]);

  const [lo, hi] = preset.range;
  const span = hi - lo;

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={span * 1.2} bloomIntensity={0.55} bloomThreshold={0.55}>
          {/* Axes */}
          <Line points={[[lo, 0, 0], [hi, 0, 0]]} color="#475569" lineWidth={1} />
          <Line points={[[0, lo, 0], [0, hi, 0]]} color="#475569" lineWidth={1} />
          <Text position={[hi + span * 0.04, 0, 0]} fontSize={span * 0.04} color="#64748B" anchorX="left" anchorY="middle">x</Text>
          <Text position={[0, hi + span * 0.04, 0]} fontSize={span * 0.04} color="#64748B" anchorX="center" anchorY="bottom">y</Text>

          {/* Vector field arrows */}
          {arrows.map((a, i) => {
            const x0 = a.p[0], y0 = a.p[1];
            const x1 = x0 + a.v[0], y1 = y0 + a.v[1];
            const color = mixColor('#4FC3F7', '#FDB813', a.mag);
            return (
              <Line
                key={i}
                points={[[x0, y0, 0], [x1, y1, 0]]}
                color={color}
                lineWidth={1}
                transparent
                opacity={0.35 + a.mag * 0.45}
              />
            );
          })}

          {/* Trajectories */}
          {trajectories.map((traj, i) => (
            <Line
              key={i}
              points={traj}
              color="#F472B6"
              lineWidth={2}
              transparent
              opacity={0.95}
            />
          ))}

          {/* Equilibria */}
          {(preset.equilibria ?? []).map(([ex, ey], i) => (
            <mesh key={i} position={[ex, ey, 0]}>
              <sphereGeometry args={[span * 0.012, 16, 16]} />
              <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={1} />
            </mesh>
          ))}

          {/* Click target (invisible plane on z=0 for raycasting) */}
          <mesh onClick={handleClick} position={[0, 0, -0.01]}>
            <planeGeometry args={[span * 1.4, span * 1.4]} />
            <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
          </mesh>
        </Stage>

        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div><span className="text-[#FDB813]">→</span> campo vectorial (color = |v|)</div>
          <div><span className="text-[#F472B6]">━</span> trayectoria RK4</div>
          {(preset.equilibria?.length ?? 0) > 0 && (
            <div><span className="text-[#34D399]">●</span> equilibrios</div>
          )}
          <div className="text-[#94A3B8] mt-1">click → sembrar trayectoria</div>
        </div>
      </div>

      <LessonPanel<PhaseLessonState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.presetId !== undefined) setPresetId(patch.presetId);
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Sistema</div>
              <div className="grid grid-cols-1 gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPresetId(p.id)}
                    className={`text-left text-[11px] px-2 py-1.5 rounded border transition ${
                      presetId === p.id
                        ? 'bg-[#FDB813]/10 border-[#FDB813]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#FDB813]/30'
                    }`}
                  >
                    <div className="font-semibold">{p.label}</div>
                    <div className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{p.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-2">
              <button
                onClick={() => setTrajectories([])}
                className="w-full text-[11px] px-2 py-1.5 rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#EF5350]/40 hover:text-[#EF5350]"
              >
                Limpiar trayectorias ({trajectories.length})
              </button>
              <div className="text-[10px] text-[#64748B] leading-snug">
                Click en el plano del simulador → sembrar trayectoria (RK4 fwd+bwd).
              </div>
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Picard-Lindelöf: trayectorias nunca se cruzan. Tipo del equilibrio sale de la jacobiana linealizada.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function mixColor(hexA: string, hexB: string, t: number): string {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
function parseHex(s: string): [number, number, number] {
  return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
}
