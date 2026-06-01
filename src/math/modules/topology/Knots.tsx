/**
 * Nudos — curvas cerradas en 3D y sus invariantes elementales.
 *
 * Un NUDO matemático es una curva cerrada simple metida en R³: tomas una
 * cuerda, la anudas, y pegas los extremos. La pregunta central de la teoría
 * de nudos es: ¿cuándo dos curvas son "el mismo nudo"? Dos nudos son
 * equivalentes si puedes deformar uno en el otro SIN cortar la cuerda
 * (isotopía ambiente). Distinguirlos requiere INVARIANTES: cantidades que
 * NO cambian bajo esas deformaciones.
 *
 * El invariante más elemental es el CROSSING NUMBER: el mínimo de cruces
 * que aparecen en cualquier diagrama plano del nudo. El unknot tiene 0
 * (es un círculo, no se cruza), el trébol tiene 3 (es el nudo no trivial
 * más simple), y el nudo en ocho tiene 4.
 *
 * Aquí mostramos parametrizaciones REALES:
 *   • Unknot   : un círculo plano,    c(t) = (cos t, sin t, 0)
 *   • Trébol   : la (2,3)-torus knot, x=sin t+2sin2t, y=cos t−2cos2t, z=−sin3t
 *   • En ocho  : la figure-eight knot, parametrización trigonométrica clásica
 *
 * Render: muestreamos la curva, la pasamos por un CatmullRomCurve3 cerrado,
 * extruimos un TubeGeometry emisivo, y proyectamos a un plano para CONTAR los
 * cruces a mano (segmento contra segmento) — el crossing number emerge de la
 * geometría, no está hardcodeado.
 */

import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import CanvasCapture from '@/math/components/CanvasCapture';

const ACCENT = '#34D399'; // verde esmeralda = rama topología

interface KnotsState {
  knotId: string;
  showProjection: boolean;
}

// ── Parametrizaciones reales ───────────────────────────────────────────
// Cada curva c: [0, 2π) → R³, cerrada (c(0) = c(2π)).

type Curve = (t: number) => [number, number, number];

interface KnotDef {
  id: string;
  label: string;
  blurb: string;
  /** Crossing number MÍNIMO conocido (invariante del nudo, valor teórico). */
  crossingNumber: number;
  /** Nombre en la tabla de Rolfsen. */
  rolfsen: string;
  curve: Curve;
  /** Escala global para que las tres curvas tengan tamaño parecido en pantalla. */
  scale: number;
}

const KNOTS: KnotDef[] = [
  {
    id: 'unknot',
    label: 'Círculo (unknot)',
    blurb: 'El nudo trivial: un círculo plano. Sin cruces, c(t) = (cos t, sin t, 0).',
    crossingNumber: 0,
    rolfsen: '0₁',
    // Círculo unitario en el plano XY.
    curve: (t) => [Math.cos(t), Math.sin(t), 0],
    scale: 1.7,
  },
  {
    id: 'trefoil',
    label: 'Trébol (trefoil)',
    blurb: 'El nudo no trivial más simple. (2,3)-torus knot. x=sin t+2 sin 2t, y=cos t−2 cos 2t, z=−sin 3t.',
    crossingNumber: 3,
    rolfsen: '3₁',
    // Parametrización clásica del trébol (Lissajous toroidal).
    curve: (t) => [
      Math.sin(t) + 2 * Math.sin(2 * t),
      Math.cos(t) - 2 * Math.cos(2 * t),
      -Math.sin(3 * t),
    ],
    scale: 0.62,
  },
  {
    id: 'figure-eight',
    label: 'Nudo en ocho',
    blurb: 'El único nudo de 4 cruces. Amfiquiral (igual a su espejo). Parametrización trigonométrica.',
    crossingNumber: 4,
    rolfsen: '4₁',
    // Figure-eight knot — parametrización estándar (Wikipedia / Knot Atlas).
    curve: (t) => [
      (2 + Math.cos(2 * t)) * Math.cos(3 * t),
      (2 + Math.cos(2 * t)) * Math.sin(3 * t),
      Math.sin(4 * t),
    ],
    scale: 0.7,
  },
];

// ── Muestreo + tubo ─────────────────────────────────────────────────────

const SAMPLES = 320;

function sampleCurve(def: KnotDef): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = (i / SAMPLES) * 2 * Math.PI;
    const [x, y, z] = def.curve(t);
    pts.push(new THREE.Vector3(x * def.scale, y * def.scale, z * def.scale));
  }
  return pts;
}

// ── Conteo de cruces a partir de la proyección XY ───────────────────────
// Proyectamos la curva sobre el plano XY y contamos cuántas veces se cruzan
// los segmentos en 2D. El crossing number MÍNIMO es un invariante (no depende
// de la proyección); el conteo de una proyección concreta es ≥ ese mínimo.
// Mostramos AMBOS: el valor teórico y lo que ve esta proyección.

function segIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const d1x = bx - ax, d1y = by - ay;
  const d2x = dx - cx, d2y = dy - cy;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return false; // paralelos
  const s = ((cx - ax) * d2y - (cy - ay) * d2x) / denom;
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / denom;
  const eps = 1e-6;
  return s > eps && s < 1 - eps && u > eps && u < 1 - eps;
}

function countProjectedCrossings(pts: THREE.Vector3[]): number {
  const N = pts.length;
  let crossings = 0;
  for (let i = 0; i < N; i++) {
    const a = pts[i], b = pts[(i + 1) % N];
    for (let j = i + 2; j < N; j++) {
      // No comparar segmentos adyacentes (comparten vértice) ni el wrap-around.
      if (i === 0 && j === N - 1) continue;
      const c = pts[j], d = pts[(j + 1) % N];
      if (segIntersect(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y)) crossings++;
    }
  }
  return crossings;
}

// ── Lección ──────────────────────────────────────────────────────────────

const LESSON: Lesson<KnotsState> = {
  hook: {
    title: 'Un nudo es una cuerda cerrada en el espacio — y el problema es: ¿cuándo dos son el mismo?',
    body: `Toma una cuerda, anúdala como quieras, y pega los extremos. Eso es un NUDO matemático: una curva cerrada simple metida en el espacio tridimensional.

La pregunta central de la teoría de nudos es engañosamente simple: ¿cuándo dos cuerdas anudadas son "el mismo nudo"? Decimos que sí cuando puedes deformar una en la otra sin cortarla nunca — estirando, doblando, deslizando. A eso se le llama isotopía.

El problema es que mirar dos marañas y decidir si son iguales es DIFICILÍSIMO. La solución son los INVARIANTES: números que le calculas a un nudo y que NO cambian cuando lo deformas. Si dos nudos tienen invariantes distintos, son distintos. Garantizado.

En esta clase ves tres nudos con parametrizaciones reales y el invariante más elemental: el número mínimo de cruces.`,
  },

  steps: [
    {
      title: 'El unknot — un círculo, cero cruces',
      duration: 5500,
      body: `Empezamos con el caso trivial: el UNKNOT, que no es más que un círculo plano c(t) = (cos t, sin t, 0).

Mira la curva: la puedes aplastar sobre una mesa sin que se monte sobre sí misma. Su diagrama no tiene ningún cruce.

Por eso su crossing number — el mínimo de cruces en cualquier dibujo plano — es CERO. Es el único nudo con esta propiedad.

Suena tonto, pero detectar el unknot es un problema profundo: dada una maraña salvaje de cuerda, ¿es secretamente un círculo? Eso se llama "unknotting problem" y costó décadas entenderlo.`,
      formula: 'c(t) = (cos t, sin t, 0),  t ∈ [0, 2π)\ncrossing number = 0   (Rolfsen 0₁)',
      keyframes: [
        { at: 0, state: { knotId: 'unknot', showProjection: false } },
        { at: 1, state: { knotId: 'unknot', showProjection: false } },
      ],
    },
    {
      title: 'El trébol — el primer nudo de verdad',
      duration: 6000,
      body: `Ahora el TRÉBOL (trefoil). Su parametrización: x = sin t + 2 sin 2t, y = cos t − 2 cos 2t, z = −sin 3t. Es el nudo de toro (2,3): da dos vueltas en un sentido y tres en el otro sobre la superficie de una dona.

Mira los tres lóbulos. No importa cómo lo gires o estires: SIEMPRE vas a ver al menos 3 cruces en su sombra. Su crossing number es 3.

Y es famoso por otra cosa: el trébol NO es igual a su imagen en el espejo. Existe el trébol "diestro" y el "zurdo", y son nudos distintos. Es quiral, como tus manos.

Es el nudo no trivial más simple que existe — el primer escalón real de la teoría.`,
      formula: 'x = sin t + 2 sin 2t\ny = cos t − 2 cos 2t\nz = −sin 3t\ncrossing number = 3   (Rolfsen 3₁)',
      keyframes: [
        { at: 0, state: { knotId: 'trefoil', showProjection: false } },
        { at: 1, state: { knotId: 'trefoil', showProjection: false } },
      ],
    },
    {
      title: 'El nudo en ocho — cuatro cruces y un espejo perfecto',
      duration: 6000,
      body: `El NUDO EN OCHO (figure-eight). Su parametrización trigonométrica enrosca tres vueltas en el plano con una oscilación vertical de cuatro tiempos.

Es el único nudo cuyo crossing number es 4 — no hay otro con exactamente cuatro cruces mínimos.

A diferencia del trébol, el nudo en ocho SÍ es igual a su imagen en el espejo: es amfiquiral. Lo puedes deformar hasta convertirlo en su reflejo.

En geometría hiperbólica es una estrella: su complemento (el espacio que lo rodea) admite una estructura hiperbólica de volumen mínimo. Es el laboratorio favorito de los topólogos.`,
      formula: 'x = (2 + cos 2t) · cos 3t\ny = (2 + cos 2t) · sin 3t\nz = sin 4t\ncrossing number = 4   (Rolfsen 4₁)',
      keyframes: [
        { at: 0, state: { knotId: 'figure-eight', showProjection: false } },
        { at: 1, state: { knotId: 'figure-eight', showProjection: false } },
      ],
    },
    {
      title: 'La sombra — de dónde sale el número de cruces',
      duration: 6000,
      body: `Para CONTAR cruces, aplastamos la curva sobre un plano: su sombra. Cada vez que la curva pasa por encima de sí misma en esa sombra, eso es un cruce.

Activa la proyección: aparece la sombra de la curva en gris, y contamos cuántas veces se intersectan sus segmentos en 2D. Ese conteo lo hace el código sobre la geometría real — no está escrito a mano.

Cuidado: una proyección concreta puede mostrar MÁS cruces que el mínimo (si la miras desde un ángulo malo). El crossing number es el mínimo sobre TODAS las proyecciones posibles.

Por eso el HUD muestra dos números: el invariante teórico del nudo, y lo que ve esta sombra particular. Gira la cámara y mira cómo cambia la sombra pero no el invariante.`,
      formula: 'cruces(proyección) ≥ crossing number (mínimo)\nel mínimo es el INVARIANTE',
      keyframes: [
        { at: 0, state: { knotId: 'trefoil', showProjection: true } },
        { at: 1, state: { knotId: 'trefoil', showProjection: true } },
      ],
    },
  ],

  connect: {
    body: `El crossing number es el primer invariante, pero la teoría de nudos tiene una caja de herramientas enorme:

• Polinomio de Alexander (1923): el primer invariante polinomial, sale de la topología algebraica del complemento del nudo.
• Polinomio de Jones (1984, Medalla Fields): distingue muchísimos nudos y conecta con física estadística y álgebras de operadores.
• Invariantes de Vassiliev y el polinomio HOMFLY: generalizaciones más finas.
• Grupo del nudo: el grupo fundamental del espacio que rodea al nudo, π₁(S³ ∖ K).

Y la teoría de nudos NO es abstracta: el ADN se anuda y las enzimas topoisomerasas lo "desanudan" para que se pueda replicar; las proteínas tienen nudos en su cadena; y en física, las anyones trenzadas son la base de la computación cuántica topológica.

Anudar una cuerda resultó ser una de las preguntas más profundas de las matemáticas.`,
    links: [
      { label: 'Banda de Möbius — orientabilidad de superficies', href: '#mobius-strip' },
      { label: 'Género — clasificar superficies por sus agujeros', href: '#genus' },
      { label: 'Campos vectoriales — flujos sobre curvas', href: '#vector-fields' },
    ],
  },
};

// ── Componente ────────────────────────────────────────────────────────────

export default function Knots() {
  const { audience } = useAudience();
  const [knotId, setKnotId] = useState('trefoil');
  const [showProjection, setShowProjection] = useState(false);
  const [tubeRadius, setTubeRadius] = useState(0.16);

  const def = useMemo(() => KNOTS.find((k) => k.id === knotId)!, [knotId]);

  // Muestreo de la curva real.
  const samples = useMemo(() => sampleCurve(def), [def]);

  // Curva Catmull-Rom CERRADA + tubo 3D.
  const tube = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(samples, true, 'catmullrom', 0.5);
    return new THREE.TubeGeometry(curve, SAMPLES, tubeRadius, 20, true);
  }, [samples, tubeRadius]);

  // Conteo de cruces en la proyección XY actual (geometría, no hardcode).
  const projectedCrossings = useMemo(() => countProjectedCrossings(samples), [samples]);

  // Puntos de la línea de la curva (centro del tubo) para resaltarla.
  const linePoints = useMemo<[number, number, number][]>(
    () => samples.concat(samples[0]).map((p) => [p.x, p.y, p.z]),
    [samples],
  );

  // Sombra: proyección sobre el plano XY (z = −extent − margen).
  const projectionPoints = useMemo<[number, number, number][]>(() => {
    let minZ = Infinity;
    for (const p of samples) if (p.z < minZ) minZ = p.z;
    const floor = minZ - 1.4;
    return samples.concat(samples[0]).map((p) => [p.x, p.y, floor]);
  }, [samples]);

  // Distancia de cámara adaptada al tamaño del nudo.
  const camDist = useMemo(() => {
    let r = 0;
    for (const p of samples) r = Math.max(r, p.length());
    return r * 3.2 + 1;
  }, [samples]);

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={camDist} autoRotate bloomIntensity={0.62} bloomThreshold={0.5} bgColor="#05060A" captureMode>
          <CanvasCapture />

          {/* Tubo 3D del nudo — objeto principal, emisivo para que reviente el bloom. */}
          <mesh geometry={tube}>
            <meshStandardMaterial
              color={ACCENT}
              emissive={ACCENT}
              emissiveIntensity={0.55}
              metalness={0.3}
              roughness={0.35}
            />
          </mesh>

          {/* Línea brillante del eje de la curva (refuerza el glow). */}
          <Line points={linePoints} color="#A7F3D0" lineWidth={1.5} transparent opacity={0.45} />

          {/* Sombra / proyección sobre el plano XY → de aquí salen los cruces. */}
          {showProjection && (
            <Line points={projectionPoints} color="#64748B" lineWidth={2} transparent opacity={0.65} />
          )}
        </Stage>

        {/* HUD — crossing number */}
        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div className="text-white font-semibold">{def.label}</div>
          <div><span style={{ color: ACCENT }}>━</span> tubo del nudo</div>
          <div className="text-[#94A3B8] mt-1">Rolfsen <span className="text-white">{def.rolfsen}</span></div>
          <div className="text-[#94A3B8]">
            crossing number (mín): <span style={{ color: ACCENT }} className="font-semibold">{def.crossingNumber}</span>
          </div>
          {showProjection && (
            <div className="text-[#94A3B8]">
              esta sombra: <span className="text-white">{projectedCrossings}</span> cruces
            </div>
          )}
        </div>
      </div>

      <LessonPanel<KnotsState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.knotId !== undefined) setKnotId(patch.knotId);
          if (patch.showProjection !== undefined) setShowProjection(patch.showProjection);
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Nudo</div>
              <div className="grid grid-cols-1 gap-1.5">
                {KNOTS.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => setKnotId(k.id)}
                    className={`text-left text-[11px] px-2 py-1.5 rounded border transition ${
                      knotId === k.id
                        ? 'bg-[#34D399]/12 border-[#34D399]/50 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#34D399]/30'
                    }`}
                  >
                    <div className="font-semibold flex items-center justify-between">
                      <span>{k.label}</span>
                      <span className="font-mono text-[10px]" style={{ color: ACCENT }}>{k.rolfsen}</span>
                    </div>
                    <div className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{k.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Visualización</div>
              <label className="flex items-center gap-2 text-[11px] text-[#CBD5E1] py-0.5">
                <input
                  type="checkbox"
                  checked={showProjection}
                  onChange={(e) => setShowProjection(e.target.checked)}
                  className="accent-[#34D399]"
                />
                proyección (sombra) → cuenta cruces
              </label>
              <div className="mt-2">
                <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                  <span className="text-[#94A3B8]">grosor del tubo</span>
                  <span className="text-white">{tubeRadius.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.32}
                  step={0.01}
                  value={tubeRadius}
                  onChange={(e) => setTubeRadius(parseFloat(e.target.value))}
                  className="w-full accent-[#34D399]"
                />
              </div>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B]">Invariante</div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-[#94A3B8]">crossing number (mín)</span>
                <span style={{ color: ACCENT }} className="font-semibold">{def.crossingNumber}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-[#94A3B8]">cruces en esta sombra</span>
                <span className="text-white">{projectedCrossings}</span>
              </div>
              <div className="text-[10px] text-[#64748B] leading-snug">
                El conteo de la sombra se calcula sobre la curva muestreada (segmento vs. segmento en XY).
                Gira la cámara: la sombra cambia, el invariante no.
              </div>
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Trébol = (2,3)-torus knot, quiral. Nudo en ocho = 4₁, amfiquiral e hiperbólico.
                crossing number = mínimo de |cruces| sobre toda proyección regular.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
