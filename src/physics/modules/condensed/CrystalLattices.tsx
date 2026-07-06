/**
 * Redes de Bravais — celdas FCC/BCC/HCP, planos de Miller (hkl),
 * red recíproca en 3D.
 *
 * Física real:
 *   - Vectores de red primitivos a₁,a₂,a₃ de cada estructura Bravais.
 *   - Posiciones de los átomos en la celda unitaria (base).
 *   - Planos de Miller (hkl): normal n = h·a* + k·b* + l·c* donde a*,b*,c*
 *     son los vectores de la red recíproca (definición cristalográfica exacta).
 *   - Red recíproca: b₁ = 2π(a₂×a₃)/(a₁·a₂×a₃), b₂,b₃ cíclicamente.
 *   - Distancia interplanar: d_hkl = 2π / |h·b₁ + k·b₂ + l·b₃|.
 *   - Ley de Bragg: 2·d·sinθ = n·λ.
 *
 * Visualización: cristal 3D R3F con bloom emisivo, celda unitaria
 * resaltada, planos Miller semitransparentes, auto-rotate contemplativo.
 */

import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

// ─── Tipos de estado de la lección ──────────────────────────────────────────

interface CrystalLessonState {
  latticeId: string;
  millerH: number;
  millerK: number;
  millerL: number;
  showReciprocal: boolean;
}

// ─── Lección pedagógica ──────────────────────────────────────────────────────

const LESSON: Lesson<CrystalLessonState> = {
  hook: {
    title: 'La sal de mesa es un cristal perfecto. Así lo sabe la física.',
    body: `Tomá un granito de sal. Parece polvo. Pero si lo ves con rayos X, descubrís algo increíble: cada átomo de sodio y cloro está en una posición EXACTA, periódica, que se repite millones de veces.

Eso es un cristal: simetría traslacional perfecta en 3D. Y no hay muchas formas de hacerlo — solo 14 redes de Bravais (demostrado por Bravais en 1845) pueden llenar el espacio de manera periódica. Todas las estructuras cristalinas del universo — silicio, diamante, hierro, proteínas — son combinaciones de estas 14 geometrías con diferentes bases atómicas.

Los planos de Miller (hkl) son las "caras" de ese orden: planos que cortan la celda unitaria en fracciones precisas. La red recíproca transforma esos planos en puntos — y esos puntos son exactamente lo que ves en un patrón de difracción de rayos X.

Esta clase te muestra las tres estructuras más importantes: FCC (cobre, oro), BCC (hierro, tungsteno), HCP (magnesio, titanio).`,
  },

  steps: [
    {
      title: 'FCC — la más densa que existe',
      duration: 6000,
      body: `FCC (Face-Centered Cubic): un átomo en cada esquina del cubo y uno en el centro de cada cara. 4 átomos por celda unitaria.

Es la estructura de empaquetamiento más densa junto con HCP — factor de empaquetamiento 74%. No puedes apilar esferas más compacto.

Los vectores primitivos de la FCC son:
  a₁ = (a/2)(0,1,1)
  a₂ = (a/2)(1,0,1)
  a₃ = (a/2)(1,1,0)

FCC es la red del cobre, plata, oro, aluminio, níquel. La mayoría de los metales nobles eligen FCC porque minimiza la energía de superficie.

La red recíproca de FCC es BCC — y viceversa. Son redes duales.`,
      formula: 'Factor de empaquetamiento = π/(3√2) ≈ 74%\n4 átomos/celda unitaria',
      keyframes: [
        { at: 0, state: { latticeId: 'fcc', millerH: 1, millerK: 1, millerL: 1, showReciprocal: false } },
        { at: 1, state: { latticeId: 'fcc', millerH: 1, millerK: 1, millerL: 1, showReciprocal: false } },
      ],
    },
    {
      title: 'Planos de Miller (111) — el plano más denso de la FCC',
      duration: 6000,
      body: `Un plano de Miller (hkl) corta los ejes cristalinos en a/h, a/k, a/l. El índice 0 significa que el plano es paralelo a ese eje (corta en infinito).

El plano (111) de FCC es el más denso: ahí están los átomos más juntos. Es por donde la FCC "se parte" con menos energía — la dirección de deslizamiento preferida (slip plane) en los metales.

La normal al plano (hkl) en la red recíproca es:
  n̂ = h·b₁ + k·b₂ + l·b₃

La distancia interplanar es el inverso de la magnitud:
  d_{hkl} = 2π / |G_{hkl}|

Con la ley de Bragg (2·d·sinθ = λ), cada familia de planos da UN pico en el difractograma de rayos X.`,
      formula: 'd_{hkl} = 2π / |h·b₁ + k·b₂ + l·b₃|\n2·d_{hkl}·sin θ = n·λ (Bragg)',
      keyframes: [
        { at: 0, state: { latticeId: 'fcc', millerH: 1, millerK: 1, millerL: 1, showReciprocal: false } },
        { at: 1, state: { latticeId: 'fcc', millerH: 1, millerK: 1, millerL: 1, showReciprocal: false } },
      ],
    },
    {
      title: 'BCC — la red del hierro a temperatura ambiente',
      duration: 5500,
      body: `BCC (Body-Centered Cubic): un átomo en cada esquina y uno en el centro del cubo. 2 átomos por celda unitaria. Factor de empaquetamiento 68%.

BCC es menos compacto que FCC, pero tiene más opciones de deslizamiento (slip systems) — lo que hace al hierro-α más dúctil en ciertas condiciones.

Los vectores primitivos BCC:
  a₁ = (a/2)(-1,1,1)
  a₂ = (a/2)(1,-1,1)
  a₃ = (a/2)(1,1,-1)

Hierro, cromo, tungsteno, molibdeno, vanadio son BCC. El tungsteno funde a 3422°C — la temperatura más alta de todos los metales puro, gracias parcialmente a su estructura BCC.

La red recíproca de BCC es FCC.`,
      formula: '2 átomos/celda unitaria\nFactor empaquetamiento = π√3/8 ≈ 68%',
      keyframes: [
        { at: 0, state: { latticeId: 'bcc', millerH: 1, millerK: 1, millerL: 0, showReciprocal: false } },
        { at: 1, state: { latticeId: 'bcc', millerH: 1, millerK: 1, millerL: 0, showReciprocal: false } },
      ],
    },
    {
      title: 'Red recíproca — el espacio de Fourier del cristal',
      duration: 6500,
      body: `La red recíproca es la transformada de Fourier de la red directa. Sus vectores b₁,b₂,b₃ se definen como:

  b₁ = 2π (a₂×a₃) / (a₁·a₂×a₃)

y cíclicamente para b₂,b₃.

La condición de difracción de Laue dice: un rayo de rayos X con vector de onda k se difracta en k' si y solo si k' − k = G_hkl (un vector de la red recíproca). Es equivalente a la ley de Bragg.

Esto significa que el patrón de difracción de rayos X que ves en el laboratorio ES una imagen directa de la red recíproca — y de ella deduces la estructura del cristal.

Así Rosalind Franklin, Watson y Crick determinaron la estructura del ADN en 1953.`,
      formula: 'b₁ = 2π(a₂×a₃)/(a₁·a₂×a₃)\nCondición Laue: Δk = G_{hkl}',
      keyframes: [
        { at: 0, state: { latticeId: 'fcc', millerH: 1, millerK: 1, millerL: 1, showReciprocal: true } },
        { at: 1, state: { latticeId: 'fcc', millerH: 1, millerK: 1, millerL: 1, showReciprocal: true } },
      ],
    },
    {
      title: 'HCP — la otra estructura más densa',
      duration: 5500,
      body: `HCP (Hexagonal Close-Packed): dos planos hexagonales con átomos en los huecos. 6 átomos por celda unitaria convencional (2 en la primitiva hexagonal).

HCP y FCC tienen el mismo factor de empaquetamiento (74%) pero difieren en el apilamiento:
  FCC: ...ABCABC... (planos rotados 60° cada tercero)
  HCP: ...ABABAB... (alterna entre dos posiciones)

Esa diferencia sutil cambia la simetría cúbica vs hexagonal, y afecta las propiedades mecánicas: HCP tiene MENOS sistemas de deslizamiento que FCC → los metales HCP son más frágiles (magnesio, titanio puro, zinc).

La razón ideal es c/a = √(8/3) ≈ 1.633. Metales reales se desvían levemente.`,
      formula: 'c/a ideal = √(8/3) ≈ 1.633\n6 átomos/celda convencional',
      keyframes: [
        { at: 0, state: { latticeId: 'hcp', millerH: 0, millerK: 0, millerL: 1, showReciprocal: false } },
        { at: 1, state: { latticeId: 'hcp', millerH: 0, millerK: 0, millerL: 1, showReciprocal: false } },
      ],
    },
  ],

  connect: {
    body: `Las redes de Bravais son el "alfabeto" de la cristalografía. Con ellas puedes:

• Predecir qué picos aparecen en difracción de rayos X (reglas de extinción: FCC solo da señal si h,k,l son todos pares o todos impares).
• Calcular la densidad de átomos en cualquier plano.
• Entender por qué el silicio (diamante cúbico = FCC con base 2) tiene las propiedades que necesita la electrónica.
• Diseñar nuevos materiales — "ingeniería de redes" como los perovskitas para celdas solares.

La física de estado sólido entera — semiconductores, superconductores, magnetismo — surge de cómo los electrones se mueven en estas redes periódicas. El teorema de Bloch (ψ_k = e^(ik·r)·u_k(r)) es la solución exacta de Schrödinger para un electrón en una red periódica.`,
    links: [
      { label: 'Difracción cuántica — de Broglie', href: '/math.html#quantum' },
      { label: 'Fonones — cuantos de vibración de red', href: '#phonons' },
      { label: 'Bandas de energía — Bloch', href: '#band-structure' },
    ],
  },
};

// ─── Matemática de redes de Bravais ─────────────────────────────────────────

interface LatticeConfig {
  id: string;
  name: string;
  a: number; // parámetro de red
  // vectores primitivos en unidades de a
  a1: [number, number, number];
  a2: [number, number, number];
  a3: [number, number, number];
  // posiciones de la base (fracción de los vectores primitivos)
  basis: Array<[number, number, number]>;
  color: string;
  note: string;
}

const LATTICES: LatticeConfig[] = [
  {
    id: 'fcc',
    name: 'FCC — cúbica centrada en caras',
    a: 1.0,
    a1: [0, 0.5, 0.5],
    a2: [0.5, 0, 0.5],
    a3: [0.5, 0.5, 0],
    basis: [[0, 0, 0]],
    color: '#4FC3F7',
    note: 'Cobre, oro, plata, aluminio. 74% empaquetamiento.',
  },
  {
    id: 'bcc',
    name: 'BCC — cúbica centrada en el cuerpo',
    a: 1.0,
    a1: [-0.5, 0.5, 0.5],
    a2: [0.5, -0.5, 0.5],
    a3: [0.5, 0.5, -0.5],
    basis: [[0, 0, 0]],
    color: '#F59E0B',
    note: 'Hierro, cromo, tungsteno. 68% empaquetamiento.',
  },
  {
    id: 'hcp',
    name: 'HCP — hexagonal compacta',
    a: 1.0,
    // vectores primitivos HCP con c/a = sqrt(8/3)
    a1: [1, 0, 0],
    a2: [0.5, 0.866025, 0],
    a3: [0, 0, 1.632993], // sqrt(8/3)
    basis: [
      [0, 0, 0],
      [0.333333, 0.666667, 0.5],
    ],
    color: '#A78BFA',
    note: 'Magnesio, titanio, zinc. c/a = √(8/3) ≈ 1.633.',
  },
];

// Calcula la red recíproca: b_i = 2π (a_j × a_k) / (a_i · a_j × a_k)
function reciprocalVectors(
  a1: THREE.Vector3,
  a2: THREE.Vector3,
  a3: THREE.Vector3,
): [THREE.Vector3, THREE.Vector3, THREE.Vector3] {
  const cross23 = new THREE.Vector3().crossVectors(a2, a3);
  const cross31 = new THREE.Vector3().crossVectors(a3, a1);
  const cross12 = new THREE.Vector3().crossVectors(a1, a2);
  const vol = a1.dot(cross23); // a1 · (a2 × a3)
  const twoPI_over_vol = (2 * Math.PI) / vol;
  return [
    cross23.multiplyScalar(twoPI_over_vol),
    cross31.multiplyScalar(twoPI_over_vol),
    cross12.multiplyScalar(twoPI_over_vol),
  ];
}

// Calcula el vector G_hkl = h·b1 + k·b2 + l·b3
function millerVector(
  h: number, k: number, l: number,
  b1: THREE.Vector3, b2: THREE.Vector3, b3: THREE.Vector3,
): THREE.Vector3 {
  return new THREE.Vector3()
    .addScaledVector(b1, h)
    .addScaledVector(b2, k)
    .addScaledVector(b3, l);
}

// Genera posiciones de átomos en una supercelda N×N×N
function buildLatticePositions(lat: LatticeConfig, N: number): THREE.Vector3[] {
  const a1 = new THREE.Vector3(...lat.a1).multiplyScalar(lat.a);
  const a2 = new THREE.Vector3(...lat.a2).multiplyScalar(lat.a);
  const a3 = new THREE.Vector3(...lat.a3).multiplyScalar(lat.a);
  const positions: THREE.Vector3[] = [];

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      for (let k = 0; k < N; k++) {
        for (const [fb1, fb2, fb3] of lat.basis) {
          const pos = new THREE.Vector3()
            .addScaledVector(a1, i + fb1)
            .addScaledVector(a2, j + fb2)
            .addScaledVector(a3, k + fb3);
          positions.push(pos);
        }
      }
    }
  }
  return positions;
}

// Genera posiciones de puntos de la red recíproca en una supercelda M×M×M
function buildReciprocalPositions(
  b1: THREE.Vector3, b2: THREE.Vector3, b3: THREE.Vector3,
  M: number,
): THREE.Vector3[] {
  const positions: THREE.Vector3[] = [];
  const half = Math.floor(M / 2);
  for (let h = -half; h <= half; h++) {
    for (let k = -half; k <= half; k++) {
      for (let l = -half; l <= half; l++) {
        const pos = new THREE.Vector3()
          .addScaledVector(b1, h)
          .addScaledVector(b2, k)
          .addScaledVector(b3, l);
        positions.push(pos);
      }
    }
  }
  return positions;
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function CrystalLattices() {
  const { audience } = useAudience();

  const [latticeId, setLatticeId] = useState<string>('fcc');
  const [millerH, setMillerH] = useState(1);
  const [millerK, setMillerK] = useState(1);
  const [millerL, setMillerL] = useState(1);
  const [showReciprocal, setShowReciprocal] = useState(false);
  const [showMillerPlane, setShowMillerPlane] = useState(true);

  const lat = LATTICES.find(l => l.id === latticeId)!;

  // Vectores primitivos THREE.Vector3
  const { a1v, a2v, a3v, b1v, b2v, b3v, dHkl, G } = useMemo(() => {
    const a1v = new THREE.Vector3(...lat.a1).multiplyScalar(lat.a);
    const a2v = new THREE.Vector3(...lat.a2).multiplyScalar(lat.a);
    const a3v = new THREE.Vector3(...lat.a3).multiplyScalar(lat.a);
    const [b1v, b2v, b3v] = reciprocalVectors(a1v, a2v, a3v);
    const G = millerVector(millerH, millerK, millerL, b1v, b2v, b3v);
    const dHkl = Math.abs(G.length()) > 1e-10 ? (2 * Math.PI) / G.length() : Infinity;
    return { a1v, a2v, a3v, b1v, b2v, b3v, dHkl, G };
  }, [lat, millerH, millerK, millerL]);

  // Distancia interplanar y ángulo de Bragg para λ = 1.54 Å (Cu K-alpha)
  const lambda = 0.154; // nm (en unidades donde a = 1 nm para visualización)
  const sinTheta = dHkl > 0 && isFinite(dHkl) ? lambda / (2 * dHkl) : 2;
  const braggAngle = Math.abs(sinTheta) <= 1 ? (Math.asin(sinTheta) * 180) / Math.PI : NaN;

  const cameraDistance = lat.id === 'hcp' ? 8 : 7;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage
          cameraDistance={cameraDistance}
          autoRotate
          bloomIntensity={0.9}
          bloomThreshold={0.1}
        >
          <CrystalScene
            lat={lat}
            a1v={a1v}
            a2v={a2v}
            a3v={a3v}
            b1v={b1v}
            b2v={b2v}
            b3v={b3v}
            G={G}
            millerH={millerH}
            millerK={millerK}
            millerL={millerL}
            showMillerPlane={showMillerPlane}
            showReciprocal={showReciprocal}
          />
        </Stage>

        {/* HUD métricas */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-3 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div>
            <span className="text-[#64748B]">Red&nbsp;&nbsp;&nbsp;&nbsp;</span>
            <span className="text-white">{lat.name.split('—')[0].trim()}</span>
          </div>
          <div>
            <span className="text-[#64748B]">(hkl)&nbsp;&nbsp;</span>
            <span className="text-[#A78BFA]">({millerH}{millerK}{millerL})</span>
          </div>
          <div>
            <span className="text-[#64748B]">d_hkl&nbsp;</span>
            {isFinite(dHkl)
              ? <span className="text-white">{dHkl.toFixed(3)} a</span>
              : <span className="text-[#F87171]">∞ (plano paralelo)</span>
            }
          </div>
          <div>
            <span className="text-[#64748B]">2θ_Bragg</span>
            {!isNaN(braggAngle)
              ? <span className="text-[#4FC3F7]"> {(2 * braggAngle).toFixed(1)}°</span>
              : <span className="text-[#F87171]"> —</span>
            }
          </div>
        </div>

        {/* Controles booleanos */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <ToggleBtn active={showMillerPlane} onClick={() => setShowMillerPlane(v => !v)}>
            Plano Miller
          </ToggleBtn>
          <ToggleBtn active={showReciprocal} onClick={() => setShowReciprocal(v => !v)}>
            Red recíproca
          </ToggleBtn>
        </div>
      </div>

      <LessonPanel<CrystalLessonState>
        lesson={LESSON}
        onApplyState={patch => {
          if (patch.latticeId !== undefined) setLatticeId(patch.latticeId);
          if (patch.millerH !== undefined) setMillerH(patch.millerH);
          if (patch.millerK !== undefined) setMillerK(patch.millerK);
          if (patch.millerL !== undefined) setMillerL(patch.millerL);
          if (patch.showReciprocal !== undefined) setShowReciprocal(patch.showReciprocal);
        }}
        sandbox={
          <>
            <Section title="Estructura de Bravais">
              <div className="grid grid-cols-1 gap-1.5">
                {LATTICES.map(l => (
                  <button
                    key={l.id}
                    onClick={() => setLatticeId(l.id)}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      latticeId === l.id
                        ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#4FC3F7]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-[#94A3B8] leading-relaxed italic">{lat.note}</div>
            </Section>

            <Section title="Índices de Miller (hkl)">
              <MillerSlider label="h" value={millerH} onChange={setMillerH} />
              <MillerSlider label="k" value={millerK} onChange={setMillerK} />
              <MillerSlider label="l" value={millerL} onChange={setMillerL} />
              <div className="mt-2 text-[10px] text-[#64748B]">
                Plano ({millerH}{millerK}{millerL}) · d = {isFinite(dHkl) ? dHkl.toFixed(3) : '∞'} a
              </div>
            </Section>

            {audience !== 'child' && (
              <Section title="Red recíproca">
                <Row label="|G_{hkl}|" value={`${G.length().toFixed(3)} / a`} />
                <Row label="d_{hkl}" value={isFinite(dHkl) ? `${dHkl.toFixed(3)} a` : '∞'} />
                <Row label="2θ (Cu Kα)" value={!isNaN(braggAngle) ? `${(2 * braggAngle).toFixed(2)}°` : '—'} />
                <div className="mt-2 text-[10px] text-[#64748B] leading-snug font-mono">
                  b₁ = 2π(a₂×a₃)/(V)<br />
                  d = 2π/|G|
                </div>
              </Section>
            )}

            {audience === 'researcher' && (
              <Section title="Vectores primitivos">
                <VecRow label="a₁" v={a1v} />
                <VecRow label="a₂" v={a2v} />
                <VecRow label="a₃" v={a3v} />
                <div className="mt-2 border-t border-[#1E293B] pt-2">
                  <VecRow label="b₁" v={b1v} scale={1 / (2 * Math.PI)} unit="·2π/a" />
                  <VecRow label="b₂" v={b2v} scale={1 / (2 * Math.PI)} unit="·2π/a" />
                  <VecRow label="b₃" v={b3v} scale={1 / (2 * Math.PI)} unit="·2π/a" />
                </div>
              </Section>
            )}

            <Section title="Vista">
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-[12px] text-[#CBD5E1] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showMillerPlane}
                    onChange={e => setShowMillerPlane(e.target.checked)}
                    className="accent-blue-400"
                  />
                  Plano de Miller
                </label>
                <label className="flex items-center gap-2 text-[12px] text-[#CBD5E1] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showReciprocal}
                    onChange={e => setShowReciprocal(e.target.checked)}
                    className="accent-purple-400"
                  />
                  Red recíproca
                </label>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ─── Escena 3D ───────────────────────────────────────────────────────────────

interface SceneProps {
  lat: LatticeConfig;
  a1v: THREE.Vector3;
  a2v: THREE.Vector3;
  a3v: THREE.Vector3;
  b1v: THREE.Vector3;
  b2v: THREE.Vector3;
  b3v: THREE.Vector3;
  G: THREE.Vector3;
  millerH: number;
  millerK: number;
  millerL: number;
  showMillerPlane: boolean;
  showReciprocal: boolean;
}

function CrystalScene({
  lat, a1v, a2v, a3v, b1v, b2v, b3v, G,
  millerH, millerK, millerL,
  showMillerPlane, showReciprocal,
}: SceneProps) {
  // Supercelda 4×4×4 de átomos en red directa
  const SUPER = 4;
  const atomPositions = useMemo(
    () => buildLatticePositions(lat, SUPER),
    [lat],
  );

  // Centro geométrico para centrar la supercelda
  const center = useMemo(() => {
    const c = new THREE.Vector3();
    for (const p of atomPositions) c.add(p);
    c.divideScalar(atomPositions.length);
    return c;
  }, [atomPositions]);

  // Átomos de la celda unitaria (solo i=j=k=0)
  const unitCellAtoms = useMemo(
    () => buildLatticePositions({ ...lat, a1: lat.a1, a2: lat.a2, a3: lat.a3 }, 1).map(
      p => p.clone().sub(center),
    ),
    [lat, center],
  );

  // Posiciones de todos los átomos centradas
  const positions = useMemo(
    () => atomPositions.map(p => p.clone().sub(center)),
    [atomPositions, center],
  );

  // Point cloud buffer
  const atomGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(positions.length * 3);
    positions.forEach((p, i) => {
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    });
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return geo;
  }, [positions]);

  // Red recíproca — 5×5×5 alrededor del origen
  const RECIP_SUPER = 5;
  const recipScale = 0.35; // escala visual para que quepan en pantalla
  const recipPositions = useMemo(
    () => buildReciprocalPositions(b1v, b2v, b3v, RECIP_SUPER).map(
      p => p.clone().multiplyScalar(recipScale),
    ),
    [b1v, b2v, b3v],
  );
  const recipGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(recipPositions.length * 3);
    recipPositions.forEach((p, i) => {
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    });
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return geo;
  }, [recipPositions]);

  // Plano de Miller: se construye como un PlaneGeometry perpendicular a G
  const millerPlane = useMemo(() => {
    if (G.length() < 1e-10) return null;
    const normal = G.clone().normalize();
    // Punto en el plano: a₁/h si h≠0, else a₂/k, else origen
    let pointOnPlane: THREE.Vector3;
    if (Math.abs(millerH) > 0) {
      pointOnPlane = a1v.clone().divideScalar(millerH).sub(center);
    } else if (Math.abs(millerK) > 0) {
      pointOnPlane = a2v.clone().divideScalar(millerK).sub(center);
    } else if (Math.abs(millerL) > 0) {
      pointOnPlane = a3v.clone().divideScalar(millerL).sub(center);
    } else {
      return null;
    }
    return { normal, pointOnPlane };
  }, [G, millerH, millerK, millerL, a1v, a2v, a3v, center]);

  // Bordes de la celda unitaria (12 aristas del paralelepípedo)
  const cellEdges = useMemo(() => {
    const o = new THREE.Vector3().sub(center);
    // Los 8 vértices del paralelepípedo definido por a1v,a2v,a3v
    const verts = [
      o.clone(),
      o.clone().add(a1v),
      o.clone().add(a2v),
      o.clone().add(a3v),
      o.clone().add(a1v).add(a2v),
      o.clone().add(a1v).add(a3v),
      o.clone().add(a2v).add(a3v),
      o.clone().add(a1v).add(a2v).add(a3v),
    ];
    // Pares de vértices que forman las 12 aristas
    const pairs: Array<[THREE.Vector3, THREE.Vector3]> = [
      [verts[0], verts[1]], [verts[0], verts[2]], [verts[0], verts[3]],
      [verts[1], verts[4]], [verts[1], verts[5]],
      [verts[2], verts[4]], [verts[2], verts[6]],
      [verts[3], verts[5]], [verts[3], verts[6]],
      [verts[4], verts[7]], [verts[5], verts[7]], [verts[6], verts[7]],
    ];
    return pairs;
  }, [a1v, a2v, a3v, center]);

  return (
    <>
      {/* Luz puntual del color de la red */}
      <pointLight color={lat.color} intensity={2.0} distance={12} position={[0, 0, 0]} />

      {/* Átomos en la red — point cloud emisivo */}
      <points geometry={atomGeo}>
        <pointsMaterial
          color={lat.color}
          size={0.18}
          sizeAttenuation
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Átomos de la celda unitaria resaltados — esferas emisivas */}
      {unitCellAtoms.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[0.12, 24, 18]} />
          <meshStandardMaterial
            color={lat.color}
            emissive={lat.color}
            emissiveIntensity={2.5}
            toneMapped={false}
            metalness={0.1}
            roughness={0.4}
          />
        </mesh>
      ))}

      {/* Aristas de la celda unitaria */}
      {cellEdges.map(([a, b], i) => (
        <Line
          key={i}
          points={[a.toArray(), b.toArray()]}
          color={lat.color}
          lineWidth={1.5}
          transparent
          opacity={0.8}
        />
      ))}

      {/* Vectores de la red primitiva — flechas */}
      <PrimitiveArrow vec={a1v.clone().sub(center)} base={new THREE.Vector3().sub(center)} color="#4FC3F7" label="a₁" />
      <PrimitiveArrow vec={a2v.clone().sub(center)} base={new THREE.Vector3().sub(center)} color="#34D399" label="a₂" />
      <PrimitiveArrow vec={a3v.clone().sub(center)} base={new THREE.Vector3().sub(center)} color="#F59E0B" label="a₃" />

      {/* Plano de Miller */}
      {showMillerPlane && millerPlane && (
        <MillerPlane normal={millerPlane.normal} point={millerPlane.pointOnPlane} size={4} />
      )}

      {/* Red recíproca */}
      {showReciprocal && (
        <group>
          <points geometry={recipGeo}>
            <pointsMaterial
              color="#F472B6"
              size={0.22}
              sizeAttenuation
              transparent
              opacity={0.9}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </points>
          {/* Vector G_hkl resaltado */}
          <GVector G={G} scale={recipScale} />
        </group>
      )}
    </>
  );
}

// ─── Subcomponentes R3F ──────────────────────────────────────────────────────

function PrimitiveArrow({
  vec, base, color,
}: {
  vec: THREE.Vector3;
  base: THREE.Vector3;
  color: string;
  label: string;
}) {
  // Flecha: línea del origen al extremo
  const tip = base.clone().add(vec);
  return (
    <Line
      points={[base.toArray(), tip.toArray()]}
      color={color}
      lineWidth={2.5}
      transparent
      opacity={0.95}
    />
  );
}

function MillerPlane({
  normal, point, size,
}: {
  normal: THREE.Vector3;
  point: THREE.Vector3;
  size: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
    return q;
  }, [normal]);

  return (
    <mesh
      ref={meshRef}
      position={point.toArray()}
      quaternion={quaternion.toArray() as [number, number, number, number]}
    >
      <planeGeometry args={[size, size, 1, 1]} />
      <meshStandardMaterial
        color="#A78BFA"
        emissive="#7C3AED"
        emissiveIntensity={0.5}
        toneMapped={false}
        transparent
        opacity={0.25}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// Vector G_{hkl} en el espacio recíproco — cilindro pulsante (emisivo)
function GVector({ G, scale }: { G: THREE.Vector3; scale: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const Gscaled = useMemo(() => G.clone().multiplyScalar(scale), [G, scale]);
  const len = Gscaled.length();

  // Orientar el cilindro a lo largo de Gscaled
  const quaternion = useMemo(() => {
    if (len < 1e-10) return new THREE.Quaternion();
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), Gscaled.clone().normalize());
    return q;
  }, [Gscaled, len]);

  const midpoint = useMemo(() => Gscaled.clone().multiplyScalar(0.5), [Gscaled]);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.5 + 1.2 * Math.sin(clock.getElapsedTime() * 3);
    }
  });

  if (len < 1e-10) return null;

  return (
    <mesh
      ref={meshRef}
      position={midpoint.toArray()}
      quaternion={quaternion.toArray() as [number, number, number, number]}
    >
      <cylinderGeometry args={[0.02, 0.02, len, 8]} />
      <meshStandardMaterial
        color="#F472B6"
        emissive="#F472B6"
        emissiveIntensity={1.5}
        toneMapped={false}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function VecRow({ label, v, scale = 1, unit = 'a' }: {
  label: string;
  v: THREE.Vector3;
  scale?: number;
  unit?: string;
}) {
  const fmt = (x: number) => (x * scale).toFixed(3);
  return (
    <div className="flex items-baseline justify-between text-[10px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className="text-[#CBD5E1]">({fmt(v.x)}, {fmt(v.y)}, {fmt(v.z)}) {unit}</span>
    </div>
  );
}

function MillerSlider({
  label, value, onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between text-[11px] font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-[#A78BFA] font-bold">{value}</span>
      </div>
      <input
        type="range"
        min={-3}
        max={3}
        step={1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function ToggleBtn({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 h-9 rounded-md border text-[12px] transition ${
        active
          ? 'border-[#A78BFA]/60 text-[#A78BFA] bg-[#A78BFA]/10'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
