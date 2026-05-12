/**
 * Campos vectoriales — divergencia, rotacional, líneas de flujo.
 *
 *   F(x, y) = (P(x, y), Q(x, y))
 *
 * Cada punto del plano tiene un vector. Visualizamos como flechitas coloreadas
 * por magnitud, y dejamos al usuario soltar partículas (click) que siguen
 * el campo via RK4 — las líneas de flujo (streamlines).
 *
 * Computamos en tiempo real:
 *   ∇·F = ∂P/∂x + ∂Q/∂y     (divergencia — qué tanto "se expande" el campo)
 *   ∇×F = ∂Q/∂x − ∂P/∂y     (rotacional 2D — qué tanto "gira" el campo)
 *
 * Presets canónicos:
 *   • Fuente puro:   F = (x, y)            → ∇·F = 2, ∇×F = 0
 *   • Vórtice puro:  F = (−y, x)           → ∇·F = 0, ∇×F = 2
 *   • Silla:         F = (x, −y)           → ∇·F = 0, ∇×F = 0
 *   • Coulomb 2D:    F = (x, y)/(x²+y²)    → ∇·F = 0 fuera del origen
 *   • Dipolo:        F = ∇(x/r²)
 *
 * Estos son los ladrillos del teorema fundamental del cálculo vectorial:
 * todo campo descompone en gradiente + rotacional puro (Helmholtz).
 */

import { useMemo, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

interface VFState {
  presetId: string;
}

const LESSON: Lesson<VFState> = {
  hook: {
    title: 'En cada punto del aire, hay un viento. Y en cada punto de un líquido, hay un flujo.',
    body: `Imaginate un lago tranquilo, visto desde arriba. Una hoja cae al agua. ¿Hacia dónde la lleva la corriente?

La respuesta depende de DÓNDE cae. Cerca del desagüe, gira en círculos. En aguas calmas, casi no se mueve. Cerca de una fuente, se aleja.

Cada PUNTO del lago tiene asociado un VECTOR — la velocidad de la corriente ahí. La colección de todos esos vectores es un campo vectorial.

Maxwell escribió el electromagnetismo así. Navier-Stokes escribió los fluidos así. Hasta la gravedad de Newton es un campo vectorial. Esta clase te muestra los patrones canónicos.`,
  },

  steps: [
    {
      title: 'Fuente — todo sale del origen',
      duration: 5500,
      body: `Primer campo: F(x, y) = (x, y). En cada punto, el vector apunta DESDE el origen hacia afuera.

Mirá las flechas amarillas — todas radiando. Las trayectorias rosa son líneas rectas saliendo del centro.

Esto es lo que pasa con una carga eléctrica positiva: el campo eléctrico apunta hacia afuera. La hoja en el lago se aleja del centro.

La medida formal de "qué tanto sale del origen" es la divergencia: ∇·F = ∂P/∂x + ∂Q/∂y = 1 + 1 = 2. Positiva → fuente.`,
      formula: 'F = (x, y)   ⇒   ∇·F = 2,   ∇×F = 0',
      keyframes: [
        { at: 0, state: { presetId: 'source' } },
        { at: 1, state: { presetId: 'source' } },
      ],
    },
    {
      title: 'Vórtice — todo gira',
      duration: 5500,
      body: `Cambio a F(x, y) = (−y, x).

Ahora las flechas son TANGENTES a círculos. Y las trayectorias son círculos perfectos.

Una hoja en este lago da vueltas para siempre — nunca se acerca al centro ni se aleja. Solo gira.

La divergencia es CERO: nada se acumula ni se escapa. Pero el rotacional (curl) es 2: hay rotación pura. Es lo que pasa cerca del ojo de un huracán.

Vórtices puros: divergencia 0, rotacional grande.`,
      formula: 'F = (−y, x)   ⇒   ∇·F = 0,   ∇×F = 2',
      keyframes: [
        { at: 0, state: { presetId: 'vortex' } },
        { at: 1, state: { presetId: 'vortex' } },
      ],
    },
    {
      title: 'Silla — escapa por los ejes',
      duration: 5500,
      body: `F(x, y) = (x, −y). Aleja en x, atrae en y.

Mira las trayectorias: si soltás la hoja en un eje, va por ese eje. Si la soltás en general, hace una curva hiperbólica — primero parece que viene al origen (atrae en y), luego se desvía y sale (repele en x).

El origen es un PUNTO DE SILLA del campo — equilibrio inestable. Cualquier perturbación te aleja.

Esto pasa en dinámicas de poblaciones, mercados financieros, sistemas climáticos. Los puntos críticos no son todos atractores ni repulsores — algunos son sillas.`,
      formula: 'F = (x, −y)   ⇒   ∇·F = 0,   ∇×F = 0',
      keyframes: [
        { at: 0, state: { presetId: 'saddle' } },
        { at: 1, state: { presetId: 'saddle' } },
      ],
    },
    {
      title: 'Coulomb 2D — la carga puntual',
      duration: 5500,
      body: `F(x, y) = (x, y) / (x² + y²). Es el campo eléctrico 2D de una carga en el origen.

¡Ojo! NO es lo mismo que la fuente lineal. Acá la magnitud DECAE con 1/r — más cerca del origen, MÁS fuerte; lejos, débil.

Las trayectorias siguen siendo radiales (en 2D, sale como flores), pero las flechas son largas cerca del centro y diminutas lejos.

En el centro (r=0) la magnitud diverge — eso es la SINGULARIDAD de la carga puntual. Maxwell tuvo que aceptar que las cargas idealizadas tienen este infinito.`,
      formula: 'F = r̂ / r   ⇒   ∇·F = 0  (excepto en origen — δ de Dirac)',
      keyframes: [
        { at: 0, state: { presetId: 'coulomb' } },
        { at: 1, state: { presetId: 'coulomb' } },
      ],
    },
    {
      title: 'Helmholtz — divergencia + rotacional juntos',
      duration: 6000,
      body: `F(x, y) = (x − y, x + y). Esta NO es ni puramente radial ni puramente circular.

Mirá las trayectorias: son espirales que salen del origen mientras giran. La hoja se aleja Y gira al mismo tiempo.

Helmholtz demostró en 1858: TODO campo vectorial bien comportado se puede ESCRIBIR como una parte rotacional + una parte divergente. Acá tenés las dos.

∇·F = 2 (diverge — sale), ∇×F = 2 (rota — gira).

Es el teorema fundamental del cálculo vectorial — el equivalente del TFC de Newton para campos.`,
      formula: 'F = (x−y, x+y)   ⇒   ∇·F = 2,   ∇×F = 2\n  toda F = ∇φ + ∇×A  (Helmholtz)',
      keyframes: [
        { at: 0, state: { presetId: 'mixed' } },
        { at: 1, state: { presetId: 'mixed' } },
      ],
    },
  ],

  connect: {
    body: `Acabás de ver los ladrillos de toda la física de campos.

Maxwell escribió las cuatro ecuaciones del electromagnetismo así:
• ∇·E = ρ/ε₀   (la carga es fuente del campo eléctrico)
• ∇·B = 0     (no hay "carga magnética" — ni fuentes ni sumideros)
• ∇×E = −∂B/∂t (campo magnético variable induce eléctrico — Faraday)
• ∇×B = μ₀J + μ₀ε₀ ∂E/∂t (corriente induce magnético — Ampère)

TODA la luz, las radios, las microondas, los rayos X — TODO sale de esos cuatro símbolos.

Y en fluidos, Navier-Stokes describe la velocidad como un campo vectorial donde div=0 (incompresible) y curl es la vorticidad.`,
    links: [
      { label: 'Plano tangente — ∇f es un campo vectorial', href: '#tangent-plane' },
      { label: 'Retrato de fases — campos en EDOs', href: '#phase-portrait' },
      { label: 'Integral — la integral de línea', href: '#integral-area' },
    ],
  },
};

type Field = (x: number, y: number) => [number, number];
type ScalarField = (x: number, y: number) => number;

interface Preset {
  id: string;
  label: string;
  blurb: string;
  F: Field;
  div: ScalarField;
  curl: ScalarField;
  range: [number, number];
}

const PRESETS: Preset[] = [
  {
    id: 'source',
    label: 'Fuente',
    blurb: 'F = (x, y). Sale radial. ∇·F = 2, ∇×F = 0.',
    F: (x, y) => [x, y],
    div: () => 2,
    curl: () => 0,
    range: [-2, 2],
  },
  {
    id: 'vortex',
    label: 'Vórtice',
    blurb: 'F = (−y, x). Gira CCW. ∇·F = 0, ∇×F = 2.',
    F: (x, y) => [-y, x],
    div: () => 0,
    curl: () => 2,
    range: [-2, 2],
  },
  {
    id: 'saddle',
    label: 'Silla',
    blurb: 'F = (x, −y). Hiperbólico. ∇·F = 0, ∇×F = 0.',
    F: (x, y) => [x, -y],
    div: () => 0,
    curl: () => 0,
    range: [-2, 2],
  },
  {
    id: 'sink',
    label: 'Sumidero',
    blurb: 'F = (−x, −y). Cae al origen. ∇·F = −2.',
    F: (x, y) => [-x, -y],
    div: () => -2,
    curl: () => 0,
    range: [-2, 2],
  },
  {
    id: 'coulomb',
    label: 'Coulomb 2D',
    blurb: 'F = (x, y)/(x² + y²). Campo de carga puntual.',
    F: (x, y) => {
      const r2 = x * x + y * y;
      if (r2 < 1e-4) return [0, 0];
      return [x / r2, y / r2];
    },
    div: (x, y) => {
      // ∇·F = 0 except at origin (Dirac). For visualization, return 0.
      const r2 = x * x + y * y;
      return r2 < 0.05 ? 999 : 0;
    },
    curl: () => 0,
    range: [-2, 2],
  },
  {
    id: 'shear',
    label: 'Cizalla',
    blurb: 'F = (y, 0). Flujo de Couette. ∇·F = 0, ∇×F = −1.',
    F: (_x, y) => [y, 0],
    div: () => 0,
    curl: () => -1,
    range: [-2, 2],
  },
  {
    id: 'dipole',
    label: 'Dipolo',
    blurb: 'F = (2xy, y² − x²) / r⁴. Dos polos opuestos.',
    F: (x, y) => {
      const r2 = x * x + y * y;
      if (r2 < 1e-3) return [0, 0];
      const r4 = r2 * r2;
      return [(2 * x * y) / r4, (y * y - x * x) / r4];
    },
    div: () => 0,
    curl: () => 0,
    range: [-2, 2],
  },
  {
    id: 'mixed',
    label: 'Helmholtz',
    blurb: 'F = (x − y, x + y). Diverge Y gira (descompone en suma).',
    F: (x, y) => [x - y, x + y],
    div: () => 2,
    curl: () => 2,
    range: [-2, 2],
  },
];

const GRID_N = 16;

function buildArrows(F: Field, range: [number, number]) {
  const arrows: { p: [number, number]; v: [number, number]; mag: number }[] = [];
  let maxMag = 0;
  const [lo, hi] = range;
  const step = (hi - lo) / (GRID_N + 1);
  for (let i = 1; i <= GRID_N; i++) {
    for (let j = 1; j <= GRID_N; j++) {
      const x = lo + step * i;
      const y = lo + step * j;
      const [vx, vy] = F(x, y);
      if (!isFinite(vx) || !isFinite(vy)) continue;
      const mag = Math.hypot(vx, vy);
      if (mag > maxMag) maxMag = mag;
      arrows.push({ p: [x, y], v: [vx, vy], mag });
    }
  }
  const len = (hi - lo) / GRID_N * 0.45;
  return arrows.map(a => {
    const norm = Math.max(a.mag, 1e-9);
    // Scale: linear in magnitude (capped) so weak fields still visible
    const m = Math.min(1, a.mag / Math.max(maxMag, 1e-9));
    const scale = len * (0.35 + 0.65 * m);
    return {
      p: a.p,
      v: [a.v[0] / norm * scale, a.v[1] / norm * scale] as [number, number],
      mag: m,
    };
  });
}

function rk4Step(F: Field, x: number, y: number, dt: number): [number, number] {
  const [k1x, k1y] = F(x, y);
  const [k2x, k2y] = F(x + dt * k1x / 2, y + dt * k1y / 2);
  const [k3x, k3y] = F(x + dt * k2x / 2, y + dt * k2y / 2);
  const [k4x, k4y] = F(x + dt * k3x, y + dt * k3y);
  return [
    x + dt * (k1x + 2 * k2x + 2 * k3x + k4x) / 6,
    y + dt * (k1y + 2 * k2y + 2 * k3y + k4y) / 6,
  ];
}

function streamline(F: Field, x0: number, y0: number, dt: number, steps: number, range: [number, number]): [number, number, number][] {
  const out: [number, number, number][] = [[x0, y0, 0]];
  const margin = (range[1] - range[0]) * 0.1;
  const lo = range[0] - margin, hi = range[1] + margin;
  let x = x0, y = y0;
  for (let i = 0; i < steps; i++) {
    [x, y] = rk4Step(F, x, y, dt);
    if (!isFinite(x) || !isFinite(y)) break;
    if (x < lo || x > hi || y < lo || y > hi) break;
    out.push([x, y, 0]);
  }
  return out;
}

function mixColor(hexA: string, hexB: string, t: number): string {
  const a = [parseInt(hexA.slice(1, 3), 16), parseInt(hexA.slice(3, 5), 16), parseInt(hexA.slice(5, 7), 16)];
  const b = [parseInt(hexB.slice(1, 3), 16), parseInt(hexB.slice(3, 5), 16), parseInt(hexB.slice(5, 7), 16)];
  return `rgb(${Math.round(a[0] + (b[0]-a[0])*t)}, ${Math.round(a[1]+(b[1]-a[1])*t)}, ${Math.round(a[2]+(b[2]-a[2])*t)})`;
}

export default function VectorFields() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState('vortex');
  const [trajectories, setTrajectories] = useState<[number, number, number][][]>([]);
  const [probe, setProbe] = useState<[number, number] | null>(null);

  const preset = useMemo(() => PRESETS.find(p => p.id === presetId)!, [presetId]);
  const arrows = useMemo(() => buildArrows(preset.F, preset.range), [preset]);

  // Seed a few streamlines on preset change
  useMemo(() => {
    const [lo, hi] = preset.range;
    const seeds: [number, number][] = [
      [lo * 0.6, lo * 0.6],
      [hi * 0.6, hi * 0.6],
      [lo * 0.6, hi * 0.6],
      [hi * 0.6, lo * 0.6],
      [hi * 0.3, 0],
      [lo * 0.3, 0],
    ];
    const seeded = seeds.map(([x, y]) => {
      const fwd = streamline(preset.F, x, y, 0.01, 1500, preset.range);
      const bck = streamline(preset.F, x, y, -0.01, 1500, preset.range);
      return [...bck.slice().reverse(), ...fwd];
    });
    setTrajectories(seeded);
    setProbe(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const handleClick = useCallback((event: any) => {
    const p = event.point;
    if (!p) return;
    const x = p.x, y = p.y;
    const fwd = streamline(preset.F, x, y, 0.01, 1500, preset.range);
    const bck = streamline(preset.F, x, y, -0.01, 1500, preset.range);
    setTrajectories(prev => [...prev, [...bck.slice().reverse(), ...fwd]].slice(-15));
    setProbe([x, y]);
  }, [preset]);

  const [lo, hi] = preset.range;
  const span = hi - lo;

  const probeVals = probe ? (() => {
    const [vx, vy] = preset.F(probe[0], probe[1]);
    return {
      pos: probe,
      v: [vx, vy] as [number, number],
      mag: Math.hypot(vx, vy),
      div: preset.div(probe[0], probe[1]),
      curl: preset.curl(probe[0], probe[1]),
    };
  })() : null;

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={span * 1.4} bloomIntensity={0.5} bloomThreshold={0.6}>
          {/* Axes */}
          <Line points={[[lo, 0, 0], [hi, 0, 0]]} color="#475569" lineWidth={1} />
          <Line points={[[0, lo, 0], [0, hi, 0]]} color="#475569" lineWidth={1} />

          {/* Vector field arrows */}
          {arrows.map((a, i) => {
            const x1 = a.p[0] + a.v[0];
            const y1 = a.p[1] + a.v[1];
            const color = mixColor('#4FC3F7', '#FDB813', a.mag);
            return (
              <Line
                key={i}
                points={[[a.p[0], a.p[1], 0], [x1, y1, 0]]}
                color={color}
                lineWidth={1}
                transparent
                opacity={0.4 + a.mag * 0.5}
              />
            );
          })}

          {/* Streamlines (pink) */}
          {trajectories.map((traj, i) => (
            <Line key={i} points={traj} color="#F472B6" lineWidth={2} transparent opacity={0.95} />
          ))}

          {/* Probe marker */}
          {probe && (
            <mesh position={[probe[0], probe[1], 0]}>
              <sphereGeometry args={[span * 0.018, 18, 18]} />
              <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={1.4} />
            </mesh>
          )}

          {/* Invisible click target */}
          <mesh onClick={handleClick} position={[0, 0, -0.01]}>
            <planeGeometry args={[span * 1.5, span * 1.5]} />
            <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
          </mesh>
        </Stage>

        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div><span className="text-[#FDB813]">→</span> campo F (color = |F|)</div>
          <div><span className="text-[#F472B6]">━</span> línea de flujo (RK4)</div>
          {probe && (
            <div><span className="text-[#34D399]">●</span> probe</div>
          )}
          <div className="text-[#94A3B8] mt-1">click → sembrar línea de flujo</div>
        </div>
      </div>

      <LessonPanel<VFState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.presetId !== undefined) setPresetId(patch.presetId);
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Campo</div>
              <div className="grid grid-cols-1 gap-1">
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

            {probeVals && (
              <div className="border-t border-[#1E293B] pt-3 space-y-1 text-[11px] font-mono">
                <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1">Probe en ({probeVals.pos[0].toFixed(2)}, {probeVals.pos[1].toFixed(2)})</div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">F</span>
                  <span className="text-white">({probeVals.v[0].toFixed(3)}, {probeVals.v[1].toFixed(3)})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">|F|</span>
                  <span className="text-[#FDB813]">{probeVals.mag.toFixed(3)}</span>
                </div>
                <div className="flex justify-between border-t border-[#1E293B] pt-1 mt-1">
                  <span className="text-[#94A3B8]">∇·F</span>
                  <span className={Math.abs(probeVals.div) < 0.01 ? 'text-[#94A3B8]' : probeVals.div > 0 ? 'text-[#34D399]' : 'text-[#F472B6]'}>
                    {Math.abs(probeVals.div) > 100 ? '∞ (singular)' : probeVals.div.toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">∇×F</span>
                  <span className={Math.abs(probeVals.curl) < 0.01 ? 'text-[#94A3B8]' : probeVals.curl > 0 ? 'text-[#34D399]' : 'text-[#F472B6]'}>
                    {probeVals.curl.toFixed(3)}
                  </span>
                </div>
              </div>
            )}

            <div className="border-t border-[#1E293B] pt-3">
              <button
                onClick={() => { setTrajectories([]); setProbe(null); }}
                className="w-full text-[11px] px-2 py-1.5 rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#EF5350]/40 hover:text-[#EF5350]"
              >
                Limpiar líneas ({trajectories.length})
              </button>
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Helmholtz: toda F = gradiente + rotacional. Vórtice ↔ curl, fuente ↔ div.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
