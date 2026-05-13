/**
 * Transformaciones de Möbius y la esfera de Riemann — Needham, cap. 3.
 *
 *   w = (a z + b) / (c z + d),    a, b, c, d ∈ ℂ,    ad − bc ≠ 0
 *
 * Es la simetría más rica del plano complejo extendido ℂ ∪ {∞}. La esfera
 * de Riemann es la "verdadera casa" de estas transformaciones — cada Möbius
 * es una rotación + dilatación de la esfera. Los polos norte/sur son 0 y ∞.
 *
 * Aquí mostramos:
 *   1. Plano z con una cuadrícula geométrica (líneas + círculos concéntricos).
 *   2. La misma cuadrícula transformada por w(z) en otro plano.
 *   3. La esfera de Riemann con la imagen proyectada estereográficamente.
 *
 * El "click" pedagógico: ver que toda recta o círculo del plano z se mapea
 * a otra recta o círculo en w (las "rectas-círculos" son una sola familia).
 * Y que sobre la esfera, todas las transformaciones son simplemente movimientos.
 */

import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Line, Text } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

interface MobiusLessonState {
  preset: string;
}

const LESSON: Lesson<MobiusLessonState> = {
  hook: {
    title: 'Una transformación que convierte TODO círculo en otro círculo (o en una recta).',
    body: `En el plano complejo ℂ hay un grupo especial de transformaciones — las de Möbius:

w = (az + b) / (cz + d)

Lo asombroso: aunque parece una simple fracción, tiene una propiedad mágica. Toma cualquier círculo del plano z, y lo manda a otro círculo (o una recta) en el plano w. Las rectas son "círculos de radio infinito".

Y hay algo más profundo: si proyectás el plano sobre una esfera (la "esfera de Riemann"), TODAS las transformaciones de Möbius son simplemente ROTACIONES de la esfera. El infinito se vuelve un punto más — el polo norte.

Esta clase recorre las transformaciones canónicas con sus efectos visuales.`,
  },

  steps: [
    {
      title: 'Identidad — w = z',
      duration: 4500,
      body: `Empezamos con a=1, b=0, c=0, d=1. Eso da w = z. No pasa nada — los puntos se quedan donde estaban.

Los círculos azules y las rectas rosas del plano izquierdo aparecen IDÉNTICOS en el derecho.

Punto de partida.`,
      formula: 'w = z   (identidad)',
      keyframes: [
        { at: 0, state: { preset: 'identity' } },
        { at: 1, state: { preset: 'identity' } },
      ],
    },
    {
      title: 'Translación — desplazá todo',
      duration: 4500,
      body: `Cambio a w = z + (1+i). Cada punto se mueve por (1, 1).

Los círculos del plano derecho mantienen su FORMA, solo cambian de posición.

Translación es la operación más simple — preserva forma, cambia ubicación.`,
      formula: 'w = z + (1+i)',
      keyframes: [
        { at: 0, state: { preset: 'translate' } },
        { at: 1, state: { preset: 'translate' } },
      ],
    },
    {
      title: 'Rotación 60° — todo gira',
      duration: 4500,
      body: `Ahora w = e^(iπ/3) · z. Cada punto se rota 60° alrededor del origen.

Los círculos AZULES centrados en el origen se mapean a sí mismos — el origen es punto fijo. Las RECTAS rosas radiales se giran 60°.

Multiplicar por un número complejo unitario = rotar. Esto es la regla más bonita del análisis complejo: e^(iθ) ↔ rotación por θ.`,
      formula: 'w = e^(iπ/3) · z',
      keyframes: [
        { at: 0, state: { preset: 'rotate' } },
        { at: 1, state: { preset: 'rotate' } },
      ],
    },
    {
      title: 'Inversión — w = 1/z (¡círculos!)',
      duration: 5500,
      body: `Ahora w = 1/z. Acá pasa algo INESPERADO.

Las rectas radiales rosas se mapean a rectas radiales (pasan por origen → siguen pasando). Pero los círculos concéntricos azules se INVIERTEN: el círculo |z|=2 se vuelve |w|=1/2, el de |z|=0.5 se vuelve |w|=2.

Y el origen z=0 se manda a w=∞. Y z=∞ se manda a w=0. Los polos están entrelazados.

Esto es lo que Needham llama "la primera transformación verdaderamente compleja".`,
      formula: 'w = 1/z\n|z|=r ↔ |w|=1/r\nz=0 ↔ w=∞',
      keyframes: [
        { at: 0, state: { preset: 'inversion' } },
        { at: 1, state: { preset: 'inversion' } },
      ],
    },
    {
      title: 'Cayley — el semi-plano se vuelve un disco',
      duration: 6000,
      body: `Última: w = (z − i) / (z + i). Es la transformación de Cayley.

Mapea el semi-plano superior {z : Im z > 0} al disco unitario {w : |w| < 1}. Es uno de los teoremas más usados del análisis complejo.

El plano w muestra un patrón ASIMÉTRICO — sale de mapear el "borde recto" (eje real) al borde circular del disco.

En la esfera de Riemann arriba, esto es simplemente una rotación específica. TODA Möbius es rotación de la esfera.`,
      formula: 'w = (z − i)/(z + i)   (Cayley)\nsemi-plano superior → disco unitario',
      keyframes: [
        { at: 0, state: { preset: 'cayley' } },
        { at: 1, state: { preset: 'cayley' } },
      ],
    },
  ],

  connect: {
    body: `Las transformaciones de Möbius son TANTO matemáticas como herramienta de ingeniería:

• Carta de Smith (RF / impedancia) — TODA línea de transmisión se diseña sobre una carta que es geométricamente una Möbius del semi-plano derecho al disco unitario (exactamente Cayley). Z → Γ = (Z − Z₀)/(Z + Z₀). En el lab de EM ves las cargas y campos que generan esa Z.

• Óptica paraxial — la matriz ABCD de un sistema óptico actúa sobre el rayo como una Möbius. Concatenar lentes es multiplicar Möbius.

• Relatividad especial — las transformaciones de Lorentz proyectivas son Möbius en la esfera celeste. El "cielo" rotado de un astronauta a velocidad relativista se calcula con Möbius.

• Geometría hiperbólica — el disco de Poincaré usa Möbius como isometrías. El módulo de Mapas Conformes muestra el disco en vivo.

• Teoría de números — las Möbius enteras (SL(2,ℤ)) generan el grupo modular — clave en la prueba del Último Teorema de Fermat por Wiles.

Si recordás solo una cosa: "círculos a círculos" — eso encierra toda la teoría.`,
    links: [
      { label: 'Campos EM — impedancia compleja Z = R + iωL', href: '/physics.html#em/fields' },
      { label: 'Newton fractals — la otra cara de ℂ', href: '#complex/roots' },
      { label: 'Mapas conformes — Joukowski y el disco de Poincaré', href: '#complex/conformal' },
      { label: 'Eigenvectores 3D — rotaciones reales en matrices', href: '#linalg/eigen-3d' },
    ],
  },
};

// ── Complex arithmetic ────────────────────────────────────────────────

type C = [number, number]; // [real, imag]

const c = {
  add:  (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]],
  sub:  (a: C, b: C): C => [a[0] - b[0], a[1] - b[1]],
  mul:  (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div:  (a: C, b: C): C => {
    const denom = b[0] * b[0] + b[1] * b[1];
    if (denom < 1e-12) return [NaN, NaN];
    return [(a[0] * b[0] + a[1] * b[1]) / denom, (a[1] * b[0] - a[0] * b[1]) / denom];
  },
};

function mobius(z: C, a: C, b: C, d: C, e: C): C {
  return c.div(c.add(c.mul(a, z), b), c.add(c.mul(d, z), e));
}

// ── Stereographic projection: ℂ → S² ────────────────────────────────────
// Convention: north pole (0, 0, 1) = ∞.  z = x + iy ↔ point P on sphere.
//   P = ((2x)/(|z|²+1), (2y)/(|z|²+1), (|z|²−1)/(|z|²+1))
function stereo(z: C): [number, number, number] {
  if (!isFinite(z[0]) || !isFinite(z[1])) return [0, 0, 1];
  const r2 = z[0] * z[0] + z[1] * z[1];
  const d = r2 + 1;
  return [2 * z[0] / d, 2 * z[1] / d, (r2 - 1) / d];
}

// ── Curve sampling helpers ────────────────────────────────────────────

function sampleLine(p0: C, p1: C, n: number): C[] {
  const out: C[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]);
  }
  return out;
}
function sampleCircle(cx: number, cy: number, r: number, n: number): C[] {
  const out: C[] = [];
  for (let i = 0; i <= n; i++) {
    const θ = (2 * Math.PI * i) / n;
    out.push([cx + r * Math.cos(θ), cy + r * Math.sin(θ)]);
  }
  return out;
}

// ── Grid construction (in z plane) ────────────────────────────────────

function buildGrid(): { color: string; pts: C[] }[] {
  const out: { color: string; pts: C[] }[] = [];
  // Concentric circles
  for (const r of [0.5, 1, 1.5, 2, 3]) {
    out.push({ color: '#4FC3F7', pts: sampleCircle(0, 0, r, 80) });
  }
  // Radial lines (4 directions, going to ±3)
  for (let k = 0; k < 8; k++) {
    const θ = (k * Math.PI) / 4;
    const tip: C = [3 * Math.cos(θ), 3 * Math.sin(θ)];
    out.push({ color: '#F472B6', pts: sampleLine([0, 0], tip, 40) });
  }
  return out;
}

// ── Presets ───────────────────────────────────────────────────────────

interface Preset {
  id: string;
  label: string;
  description: string;
  a: C; b: C; d: C; e: C;  // (a, b, c, d) but `c` collides with complex helper, so renamed to (a, b, d, e)
}

const PRESETS: Preset[] = [
  { id: 'identity', label: 'Identidad', description: 'w = z',
    a: [1, 0], b: [0, 0], d: [0, 0], e: [1, 0] },
  { id: 'inversion', label: 'Inversión', description: 'w = 1/z — círculos ↔ círculos',
    a: [0, 0], b: [1, 0], d: [1, 0], e: [0, 0] },
  { id: 'translate', label: 'Translación', description: 'w = z + 1+i',
    a: [1, 0], b: [1, 1], d: [0, 0], e: [1, 0] },
  { id: 'rotate', label: 'Rotación 60°', description: 'w = e^(iπ/3) · z',
    a: [Math.cos(Math.PI / 3), Math.sin(Math.PI / 3)], b: [0, 0], d: [0, 0], e: [1, 0] },
  { id: 'cayley', label: 'Cayley', description: 'w = (z−i)/(z+i) — semi-plano → disco',
    a: [1, 0], b: [0, -1], d: [1, 0], e: [0, 1] },
  { id: 'parabolic', label: 'Parabólica', description: 'w = z/(z+1)',
    a: [1, 0], b: [0, 0], d: [1, 0], e: [1, 0] },
];

// ── Component ─────────────────────────────────────────────────────────

export default function MobiusRiemann() {
  const { audience } = useAudience();
  const [preset, setPreset] = useState('cayley');
  const [a, setA] = useState<C>([1, 0]);
  const [b, setB] = useState<C>([0, -1]);
  const [d, setD] = useState<C>([1, 0]);
  const [e, setE] = useState<C>([0, 1]);

  function loadPreset(id: string) {
    const p = PRESETS.find(p => p.id === id);
    if (!p) return;
    setPreset(id);
    setA(p.a); setB(p.b); setD(p.d); setE(p.e);
  }

  const grid = useMemo(() => buildGrid(), []);
  const transformed = useMemo(() => {
    return grid.map(curve => ({
      color: curve.color,
      pts: curve.pts.map(z => mobius(z, a, b, d, e)),
    }));
  }, [grid, a, b, d, e]);

  // Determinant ad − bc (in complex)
  const detM = useMemo(() => {
    const ae = c.mul(a, e);
    const bd = c.mul(b, d);
    return c.sub(ae, bd);
  }, [a, b, d, e]);
  const detMag = Math.hypot(detM[0], detM[1]);
  const isSingular = detMag < 1e-9;

  // Convert curves to 3D points in (z plane on left side, w plane on right side)
  // and the Riemann sphere projection
  const Z_OFFSET = -3;
  const W_OFFSET = 3;

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={9} bloomIntensity={0.5} bloomThreshold={0.55}>
          {/* z plane (left) */}
          <Plane center={[Z_OFFSET, 0, 0]} label="z" />
          {grid.map((curve, i) => {
            const pts3 = curve.pts.map(p => [Z_OFFSET + p[0], p[1], 0] as [number, number, number]);
            return <Line key={`z${i}`} points={pts3} color={curve.color} lineWidth={1.5} transparent opacity={0.85} />;
          })}

          {/* w plane (right) — transformed grid */}
          <Plane center={[W_OFFSET, 0, 0]} label="w = (az+b)/(cz+d)" />
          {transformed.flatMap((curve, i) => {
            // Split the path into contiguous finite segments — Drei's Line
            // doesn't tolerate NaN breakpoints (NaN bounding-sphere errors).
            const segs: [number, number, number][][] = [];
            let cur: [number, number, number][] = [];
            for (const p of curve.pts) {
              if (!isFinite(p[0]) || !isFinite(p[1])) {
                if (cur.length > 1) segs.push(cur);
                cur = [];
                continue;
              }
              const x = Math.max(-3, Math.min(3, p[0]));
              const y = Math.max(-3, Math.min(3, p[1]));
              cur.push([W_OFFSET + x, y, 0]);
            }
            if (cur.length > 1) segs.push(cur);
            return segs.map((seg, k) => (
              <Line key={`w${i}-${k}`} points={seg} color={curve.color} lineWidth={1.5} transparent opacity={0.85} />
            ));
          })}

          {/* Riemann sphere (above the planes) */}
          <RiemannSphere center={[0, 4.5, 0]} grid={grid} transformed={transformed} />
        </Stage>

        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div><span className="text-[#4FC3F7]">━</span> círculos |z|=r</div>
          <div><span className="text-[#F472B6]">━</span> rectas radiales</div>
          <div className="text-[#64748B] mt-1">← plano z | plano w → | ↑ esfera de Riemann</div>
        </div>
      </div>

      <LessonPanel<MobiusLessonState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.preset !== undefined) loadPreset(patch.preset);
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Preset</div>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => loadPreset(p.id)}
                    title={p.description}
                    className={`text-[11px] px-2 py-1.5 rounded border transition text-left ${
                      preset === p.id
                        ? 'bg-[#F472B6]/15 border-[#F472B6]/50 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#F472B6]/30'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-[#64748B]">
                {PRESETS.find(p => p.id === preset)?.description ?? 'personalizada'}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Coeficientes (Re, Im)</div>
              <div className="space-y-1.5">
                <ComplexInput name="a" v={a} set={v => { setA(v); setPreset('custom'); }} />
                <ComplexInput name="b" v={b} set={v => { setB(v); setPreset('custom'); }} />
                <ComplexInput name="c" v={d} set={v => { setD(v); setPreset('custom'); }} />
                <ComplexInput name="d" v={e} set={v => { setE(v); setPreset('custom'); }} />
              </div>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-1 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">ad − bc</span>
                <span className={isSingular ? 'text-[#EF5350]' : 'text-white'}>
                  ({detM[0].toFixed(3)}, {detM[1].toFixed(3)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">|ad − bc|</span>
                <span className={isSingular ? 'text-[#EF5350]' : 'text-[#34D399]'}>
                  {detMag.toFixed(4)}
                </span>
              </div>
              {isSingular && (
                <div className="text-[10px] text-[#EF5350]">⚠ degenerada (ad=bc) — colapsa el plano</div>
              )}
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Toda Möbius mapea <strong>cclines</strong> (círculos+rectas) a cclines. En la esfera ambos son círculos.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function Plane({ center, label }: { center: [number, number, number]; label: string }) {
  const [cx, cy, cz] = center;
  const size = 3.5;
  return (
    <>
      <mesh position={[cx, cy, cz - 0.001]}>
        <planeGeometry args={[size * 2, size * 2]} />
        <meshBasicMaterial color="#0B1220" transparent opacity={0.6} />
      </mesh>
      <Line points={[[cx - size, cy, cz], [cx + size, cy, cz]]} color="#334155" lineWidth={1} />
      <Line points={[[cx, cy - size, cz], [cx, cy + size, cz]]} color="#334155" lineWidth={1} />
      <Text position={[cx, cy + size + 0.25, cz]} fontSize={0.25} color="#94A3B8" anchorX="center" anchorY="bottom">
        {label}
      </Text>
    </>
  );
}

function RiemannSphere({
  center,
  grid,
  transformed,
}: {
  center: [number, number, number];
  grid: { color: string; pts: C[] }[];
  transformed: { color: string; pts: C[] }[];
}) {
  const [cx, cy, cz] = center;
  const R = 1.5;

  // Project a curve onto the sphere as a list of contiguous finite segments.
  const project = useMemo(() => (pts: C[]): [number, number, number][][] => {
    const segs: [number, number, number][][] = [];
    let cur: [number, number, number][] = [];
    for (const z of pts) {
      if (!isFinite(z[0]) || !isFinite(z[1])) {
        if (cur.length > 1) segs.push(cur);
        cur = [];
        continue;
      }
      const [px, py, pz] = stereo(z);
      cur.push([cx + R * px, cy + R * pz, cz + R * py]); // y is up
    }
    if (cur.length > 1) segs.push(cur);
    return segs;
  }, [cx, cy, cz, R]);

  return (
    <>
      {/* Sphere */}
      <mesh position={[cx, cy, cz]}>
        <sphereGeometry args={[R, 48, 32]} />
        <meshStandardMaterial color="#1E293B" metalness={0.3} roughness={0.7} transparent opacity={0.6} />
      </mesh>
      {/* Equator + meridians */}
      <Line
        points={Array.from({ length: 64 }, (_, i) => {
          const θ = (i / 63) * 2 * Math.PI;
          return [cx + R * Math.cos(θ), cy, cz + R * Math.sin(θ)] as [number, number, number];
        })}
        color="#475569"
        lineWidth={0.5}
        transparent
        opacity={0.5}
      />
      {/* North pole = ∞ */}
      <mesh position={[cx, cy + R, cz]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={1} />
      </mesh>
      <Text position={[cx, cy + R + 0.25, cz]} fontSize={0.18} color="#FDB813" anchorX="center" anchorY="bottom">∞</Text>
      {/* South pole = 0 */}
      <mesh position={[cx, cy - R, cz]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#4FC3F7" emissive="#4FC3F7" emissiveIntensity={1} />
      </mesh>

      {/* z grid projected onto sphere (dim) */}
      {grid.flatMap((curve, i) =>
        project(curve.pts).map((seg, k) => (
          <Line key={`zs${i}-${k}`} points={seg} color={curve.color} lineWidth={1} transparent opacity={0.25} />
        ))
      )}

      {/* w grid projected onto sphere (bright) */}
      {transformed.flatMap((curve, i) =>
        project(curve.pts).map((seg, k) => (
          <Line key={`ws${i}-${k}`} points={seg} color={curve.color} lineWidth={1.5} transparent opacity={0.95} />
        ))
      )}
    </>
  );
}

function ComplexInput({ name, v, set }: { name: string; v: C; set: (v: C) => void }) {
  return (
    <div className="grid grid-cols-[20px_1fr_1fr] gap-1.5 items-center">
      <span className="text-[11px] font-mono text-[#FDB813]">{name}</span>
      <input
        type="number"
        step={0.1}
        value={v[0]}
        onChange={ev => set([parseFloat(ev.target.value) || 0, v[1]])}
        className="bg-[#05060A] border border-[#1E293B] rounded px-1.5 py-1 text-[11px] font-mono text-white focus:border-[#F472B6] focus:outline-none"
      />
      <input
        type="number"
        step={0.1}
        value={v[1]}
        onChange={ev => set([v[0], parseFloat(ev.target.value) || 0])}
        className="bg-[#05060A] border border-[#1E293B] rounded px-1.5 py-1 text-[11px] font-mono text-white focus:border-[#F472B6] focus:outline-none"
      />
    </div>
  );
}
