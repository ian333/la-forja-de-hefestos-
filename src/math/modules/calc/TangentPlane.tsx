/**
 * Plano tangente y gradiente — Cálculo multivariable hecho visible.
 *
 * Capa pedagógica (Layer A + B + D) implementada via LessonPanel.
 * Capa de simulador (Layer C) sigue siendo la misma — la superficie 3D,
 * el punto arrastrable, el plano tangente, el vector gradiente.
 */

import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

// ── Surface presets ───────────────────────────────────────────────────

interface Surface {
  id: string;
  label: string;
  formula: string;
  f: (x: number, y: number) => number;
  fx: (x: number, y: number) => number;
  fy: (x: number, y: number) => number;
  scale: number;
  domain: number;
}

const SURFACES: Surface[] = [
  {
    id: 'paraboloid', label: 'Paraboloide', formula: 'z = (x² + y²) / 4',
    f:  (x, y) => (x * x + y * y) / 4,
    fx: (x) => x / 2,
    fy: (_x, y) => y / 2,
    scale: 1, domain: 2.5,
  },
  {
    id: 'saddle', label: 'Silla de montar', formula: 'z = x² − y²',
    f:  (x, y) => x * x - y * y,
    fx: (x) => 2 * x,
    fy: (_x, y) => -2 * y,
    scale: 0.35, domain: 1.8,
  },
  {
    id: 'ripple', label: 'Onda radial', formula: 'z = sin(√(x² + y²) · π) / 2',
    f:  (x, y) => Math.sin(Math.sqrt(x * x + y * y) * Math.PI) / 2,
    fx: (x, y) => {
      const r = Math.sqrt(x * x + y * y);
      if (r < 1e-6) return 0;
      return (Math.cos(r * Math.PI) * Math.PI) / 2 * (x / r);
    },
    fy: (x, y) => {
      const r = Math.sqrt(x * x + y * y);
      if (r < 1e-6) return 0;
      return (Math.cos(r * Math.PI) * Math.PI) / 2 * (y / r);
    },
    scale: 1, domain: 2.2,
  },
  {
    id: 'gauss', label: 'Campana gaussiana', formula: 'z = exp(−(x² + y²))',
    f:  (x, y) => Math.exp(-(x * x + y * y)),
    fx: (x, y) => -2 * x * Math.exp(-(x * x + y * y)),
    fy: (x, y) => -2 * y * Math.exp(-(x * x + y * y)),
    scale: 1.4, domain: 1.8,
  },
];

const SEG = 64;
function buildSurface(s: Surface) {
  const geo = new THREE.PlaneGeometry(s.domain * 2, s.domain * 2, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, s.f(x, z) * s.scale);
  }
  geo.computeVertexNormals();
  return geo;
}

// ── State shape exposed to the lesson driver ──────────────────────────

interface TangentState {
  surfId: string;
  px: number;
  py: number;
}

// ── Lesson script ─────────────────────────────────────────────────────

const LESSON: Lesson<TangentState> = {
  hook: {
    title: 'Estás en la ladera de una montaña — con los ojos cerrados.',
    body: `Solo podés sentir la pendiente con los pies. Querés llegar a la cima, pero no podés ver el contorno.

¿Hay una dirección "obvia" hacia donde subir más rápido? ¿Una sola?

Sorprendentemente sí. Tiene nombre — el gradiente. Y se calcula con dos derivadas.

Esta clase te lleva, paso a paso, desde "la montaña como función" hasta "el algoritmo que usa Google Maps para encontrar rutas y el que usa ChatGPT para aprender". Todo es el mismo gradiente.`,
  },

  steps: [
    {
      title: 'La montaña es una función z = f(x, y)',
      duration: 4500,
      body: `Mirá el paraboloide azul. Es un cuenco — su fórmula es z = (x² + y²)/4. Para cada par (x, y) en el piso, hay UNA altura z.

El punto rosa marca tu posición. Empezás en el fondo del cuenco.

Ahora subo lentamente por la pared. Notá cómo el plano dorado se inclina conforme me alejo del centro — la "tabla plana" cambia su pendiente en cada punto.

La fórmula es la regla. La superficie es el mapa. El punto se mueve y la geometría local responde.`,
      formula: 'z = f(x, y) = (x² + y²) / 4',
      keyframes: [
        { at: 0,   state: { surfId: 'paraboloid', px: 0,   py: 0 } },
        { at: 0.5, state: { surfId: 'paraboloid', px: 1.0, py: 0 } },
        { at: 1,   state: { surfId: 'paraboloid', px: 2.0, py: 0 } },
      ],
    },
    {
      title: 'El gradiente — la flecha verde apunta cuesta arriba',
      duration: 5000,
      body: `Mirá el piso, debajo de tu punto rosa. Sale una flecha verde. Esa es ∇f, el gradiente.

∇f apunta hacia donde la superficie sube MÁS rápido. Ahora me muevo en círculo alrededor del cuenco — y notá: la flecha verde siempre apunta hacia AFUERA. Siempre hacia el ascenso.

|∇f| crece con la distancia al centro: en el fondo del cuenco el gradiente es cero (plano horizontal), en el borde es máximo.

Esto es lo que un termómetro mide en un campo de temperatura, lo que un sensor de presión mide en la atmósfera — la dirección del cambio.`,
      formula: '∇f(x, y) = ( ∂f/∂x , ∂f/∂y ) = ( x/2 , y/2 )',
      keyframes: [
        { at: 0,    state: { surfId: 'paraboloid', px:  2.0, py:  0   } },
        { at: 0.25, state: { surfId: 'paraboloid', px:  1.4, py:  1.4 } },
        { at: 0.5,  state: { surfId: 'paraboloid', px:  0,   py:  2.0 } },
        { at: 0.75, state: { surfId: 'paraboloid', px: -1.4, py:  1.4 } },
        { at: 1,    state: { surfId: 'paraboloid', px: -2.0, py:  0   } },
      ],
    },
    {
      title: 'Cambio de terreno — la silla de montar',
      duration: 4500,
      body: `Ahora la superficie es z = x² − y². Sube en x, baja en y. Como una silla de caballo.

Camino lentamente desde un costado hacia el centro de la silla. Mirá: el plano tangente NO se queda inclinado — se va volviendo horizontal.

En el origen, el plano queda totalmente plano y la flecha verde desaparece. |∇f| = 0.

Pero ¡ojo! Esto no significa que sea un mínimo ni un máximo. Es un PUNTO DE SILLA — máximo si caminás en y, mínimo si caminás en x. Crítico pero ambiguo.`,
      formula: '∇f = 0  ⇏  mínimo\n(puede ser silla)',
      keyframes: [
        { at: 0,   state: { surfId: 'saddle', px: -1.5, py: 0 } },
        { at: 0.5, state: { surfId: 'saddle', px: -0.7, py: 0 } },
        { at: 1,   state: { surfId: 'saddle', px:  0,   py: 0 } },
      ],
    },
    {
      title: 'La sospecha — la silla NO es mínimo',
      duration: 5000,
      body: `Para convencerte de que no es mínimo, te oscilo a lo largo del eje y, manteniendo x en cero.

Va subiendo… va subiendo… llega a un máximo en y = ±1.8 (la cima de la silla), y baja… y vuelve a subir del otro lado.

Si fuera un mínimo, todo movimiento alrededor te dejaría más arriba. Pero acá moverte en y te lleva HACIA ABAJO. Por eso silla, no mínimo.

Esto es importante en optimización (ML, ingeniería): ∇f = 0 es necesario pero no suficiente. Hay que mirar la segunda derivada — la matriz Hessiana — para distinguir.`,
      keyframes: [
        { at: 0,    state: { surfId: 'saddle', px: 0, py:  0    } },
        { at: 0.25, state: { surfId: 'saddle', px: 0, py:  1.7  } },
        { at: 0.5,  state: { surfId: 'saddle', px: 0, py:  0    } },
        { at: 0.75, state: { surfId: 'saddle', px: 0, py: -1.7  } },
        { at: 1,    state: { surfId: 'saddle', px: 0, py:  0    } },
      ],
    },
    {
      title: 'La gaussiana — descender por el gradiente',
      duration: 5500,
      body: `Última escena: z = exp(−(x²+y²)). Una campana suave con máximo único en el origen.

Te suelto en (1.5, 1.5) — un punto en la ladera. Mirá la flecha verde: apunta hacia el origen, donde está la cima.

Ahora aplico el algoritmo: en cada paso, me muevo un poquito en dirección de ∇f. Va subiendo… va subiendo… va subiendo… hasta llegar al pico.

Esto es **gradient ascent**. Si invertís el signo (te movés en −∇f), bajás al valle: **gradient descent** — el algoritmo que ChatGPT y Stable Diffusion usan miles de millones de veces para aprender.`,
      formula: 'x_{n+1} = x_n + α · ∇f(x_n)\n  (ascent — sube al máximo)\nx_{n+1} = x_n − α · ∇f(x_n)\n  (descent — baja al mínimo)',
      keyframes: [
        { at: 0,    state: { surfId: 'gauss', px: 1.5,  py: 1.5  } },
        { at: 0.25, state: { surfId: 'gauss', px: 1.0,  py: 1.0  } },
        { at: 0.5,  state: { surfId: 'gauss', px: 0.6,  py: 0.6  } },
        { at: 0.75, state: { surfId: 'gauss', px: 0.3,  py: 0.3  } },
        { at: 1,    state: { surfId: 'gauss', px: 0.0,  py: 0.0  } },
      ],
    },
  ],

  connect: {
    body: `Acabás de ver la pieza fundamental del cálculo multivariable.

El gradiente es a las superficies lo que la derivada simple es a las curvas. Si entendiste esto, ya entendiste:

• Cómo Google Maps elige rutas (gradiente en grafos)
• Cómo se entrena una red neuronal (gradient descent sobre la función de pérdida)
• Por qué los ríos eligen el camino que eligen
• El método de Lagrange para optimización con restricciones

Y todo viene de mover un punto sobre una superficie y mirar qué dirección sube más rápido.`,
    links: [
      { label: 'Derivada 1D — la versión simple', href: '#derivative-1d' },
      { label: 'Campos vectoriales — ∇f es un campo', href: '#vector-fields' },
      { label: 'Retrato de fases — sistemas que siguen el gradiente', href: '#phase-portrait' },
    ],
  },
};

// ── Component ─────────────────────────────────────────────────────────

export default function TangentPlane() {
  const { audience } = useAudience();
  const [surfId, setSurfId] = useState<string>('paraboloid');
  const [px, setPx] = useState(0);
  const [py, setPy] = useState(0);

  const surface = useMemo(() => SURFACES.find(s => s.id === surfId)!, [surfId]);
  const surfGeo = useMemo(() => buildSurface(surface), [surface]);

  const cx = Math.max(-surface.domain * 0.95, Math.min(surface.domain * 0.95, px));
  const cy = Math.max(-surface.domain * 0.95, Math.min(surface.domain * 0.95, py));

  const f0  = surface.f(cx, cy);
  const fx0 = surface.fx(cx, cy);
  const fy0 = surface.fy(cx, cy);
  const gradMag = Math.sqrt(fx0 * fx0 + fy0 * fy0);

  const planeSize = surface.domain * 0.55;
  const tangentVerts = useMemo(() => {
    const z0 = f0 * surface.scale;
    const dz = (dx: number, dy: number) =>
      (fx0 * dx + fy0 * dy) * surface.scale;
    const s = planeSize;
    const p1 = new THREE.Vector3(cx - s, z0 + dz(-s, -s), cy - s);
    const p2 = new THREE.Vector3(cx + s, z0 + dz( s, -s), cy - s);
    const p3 = new THREE.Vector3(cx + s, z0 + dz( s,  s), cy + s);
    const p4 = new THREE.Vector3(cx - s, z0 + dz(-s,  s), cy + s);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      p1.x, p1.y, p1.z,  p2.x, p2.y, p2.z,  p3.x, p3.y, p3.z,
      p1.x, p1.y, p1.z,  p3.x, p3.y, p3.z,  p4.x, p4.y, p4.z,
    ], 3));
    geo.computeVertexNormals();
    return { geo, edges: [p1, p2, p3, p4, p1] };
  }, [cx, cy, f0, fx0, fy0, surface.scale, planeSize]);

  const gradLen = Math.min(0.9, gradMag * 0.45);
  const gradEnd: [number, number, number] = [
    cx + (fx0 / Math.max(gradMag, 1e-6)) * gradLen,
    f0 * surface.scale + 0.02,
    cy + (fy0 / Math.max(gradMag, 1e-6)) * gradLen,
  ];

  // The Sandbox tab content — the raw controls from the original module
  const sandbox = (
    <>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Superficie</div>
        <div className="grid grid-cols-2 gap-1.5">
          {SURFACES.map(s => (
            <button
              key={s.id}
              onClick={() => setSurfId(s.id)}
              className={`text-[11px] px-2 py-1.5 rounded border transition ${
                surfId === s.id
                  ? 'bg-[#4FC3F7]/15 border-[#4FC3F7]/50 text-white'
                  : 'border-[#1E293B] text-[#94A3B8] hover:border-[#4FC3F7]/30'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="mt-2 text-[11px] font-mono text-[#FDB813]">{surface.formula}</div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Punto (x₀, y₀)</div>
        <label className="block text-[11px] text-[#94A3B8]">
          x₀ = <span className="text-[#F472B6] font-mono">{cx.toFixed(3)}</span>
          <input
            type="range"
            min={-surface.domain * 0.95}
            max={surface.domain * 0.95}
            step={0.01}
            value={cx}
            onChange={e => setPx(parseFloat(e.target.value))}
            className="w-full accent-[#F472B6]"
          />
        </label>
        <label className="block text-[11px] text-[#94A3B8] mt-2">
          y₀ = <span className="text-[#F472B6] font-mono">{cy.toFixed(3)}</span>
          <input
            type="range"
            min={-surface.domain * 0.95}
            max={surface.domain * 0.95}
            step={0.01}
            value={cy}
            onChange={e => setPy(parseFloat(e.target.value))}
            className="w-full accent-[#F472B6]"
          />
        </label>
      </div>

      <div className="border-t border-[#1E293B] pt-3 space-y-1 text-[12px] font-mono">
        <div className="flex justify-between">
          <span className="text-[#94A3B8]">f(x₀,y₀)</span>
          <span className="text-white">{f0.toFixed(4)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#94A3B8]">∂f/∂x</span>
          <span className="text-[#FDB813]">{fx0.toFixed(4)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#94A3B8]">∂f/∂y</span>
          <span className="text-[#FDB813]">{fy0.toFixed(4)}</span>
        </div>
        <div className="flex justify-between border-t border-[#1E293B] pt-1 mt-1">
          <span className="text-[#94A3B8]">|∇f|</span>
          <span className="text-[#34D399]">{gradMag.toFixed(4)}</span>
        </div>
      </div>

      {audience !== 'child' && (
        <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
          <div className="text-[#CBD5E1] mb-1 font-semibold">Plano tangente</div>
          <code className="block text-[10px] text-[#FDB813] bg-[#05060A] p-2 rounded">
            z − {(f0).toFixed(3)} = {fx0.toFixed(3)}·(x − {cx.toFixed(2)}) {fy0 >= 0 ? '+' : '−'} {Math.abs(fy0).toFixed(3)}·(y − {cy.toFixed(2)})
          </code>
        </div>
      )}
    </>
  );

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      {/* 3D Stage */}
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={6} bloomIntensity={0.7} bloomThreshold={0.4}>
          <Line points={[[-surface.domain, 0, 0], [surface.domain, 0, 0]]} color="#475569" lineWidth={1} />
          <Line points={[[0, 0, -surface.domain], [0, 0, surface.domain]]} color="#475569" lineWidth={1} />
          <Line points={[[0, -surface.domain, 0], [0, surface.domain, 0]]} color="#475569" lineWidth={1} />

          <mesh geometry={surfGeo} castShadow receiveShadow>
            <meshStandardMaterial
              color="#4FC3F7" metalness={0.15} roughness={0.55}
              transparent opacity={0.78} side={THREE.DoubleSide}
            />
          </mesh>
          <mesh geometry={surfGeo}>
            <meshBasicMaterial color="#1E40AF" wireframe transparent opacity={0.18} />
          </mesh>

          <mesh geometry={tangentVerts.geo}>
            <meshStandardMaterial
              color="#FDB813" emissive="#FDB813" emissiveIntensity={0.35}
              metalness={0.1} roughness={0.6}
              transparent opacity={0.55} side={THREE.DoubleSide}
            />
          </mesh>
          <Line points={tangentVerts.edges.map(v => [v.x, v.y, v.z] as [number,number,number])} color="#FDB813" lineWidth={1.5} />

          <mesh position={[cx, f0 * surface.scale, cy]}>
            <sphereGeometry args={[0.07, 24, 24]} />
            <meshStandardMaterial color="#F472B6" emissive="#F472B6" emissiveIntensity={1.2} />
          </mesh>

          <Line
            points={[[cx, 0, cy], [cx, f0 * surface.scale, cy]]}
            color="#F472B6" lineWidth={1} dashed dashSize={0.08} gapSize={0.06}
          />

          {gradMag > 1e-4 && (
            <>
              <Line
                points={[[cx, 0.005, cy], [gradEnd[0], 0.005, gradEnd[2]]]}
                color="#34D399" lineWidth={3}
              />
              <mesh position={gradEnd}>
                <coneGeometry args={[0.07, 0.18, 12]} />
                <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={0.8} />
              </mesh>
            </>
          )}
        </Stage>

        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div><span className="text-[#4FC3F7]">━</span> superficie z = f(x,y)</div>
          <div><span className="text-[#FDB813]">━</span> plano tangente</div>
          <div><span className="text-[#F472B6]">●</span> punto (x₀, y₀, f(x₀,y₀))</div>
          <div><span className="text-[#34D399]">→</span> gradiente ∇f en XY</div>
        </div>
      </div>

      <LessonPanel<TangentState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.surfId !== undefined) setSurfId(patch.surfId);
          if (patch.px !== undefined) setPx(patch.px);
          if (patch.py !== undefined) setPy(patch.py);
        }}
        sandbox={sandbox}
      />
    </div>
  );
}
