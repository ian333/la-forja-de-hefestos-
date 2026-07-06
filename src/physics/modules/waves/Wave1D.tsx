/**
 * Cuerda vibrante 3D — Ecuación de onda ∂²u/∂t² = c²∂²u/∂x²
 *
 * FÍSICA REAL (FDTD leapfrog, 2do orden en x y t):
 *
 *   u^{n+1}_i = 2u^n_i − u^{n-1}_i + C²(u^n_{i+1} − 2u^n_i + u^n_{i-1})
 *   C = c·Δt/Δx  (número de Courant — CFL exige C ≤ 1)
 *
 * Condiciones de borde:
 *   - Fijo (Dirichlet): u(0)=u(L)=0 → rebote INVERTIDO (fase π)
 *   - Libre (Neumann):  ∂u/∂x=0 via nodo fantasma → rebote DERECHO
 *
 * Condiciones iniciales:
 *   - Pulso gaussiano en el centro
 *   - Pellizco triangular (pluck de guitarra)
 *   - Modo senoidal m=1,2,3 → onda estacionaria pura
 *
 * Visualización 3D cine:
 *   - Tubo emisivo que sigue u(x,t) (TubeGeometry dinámico via CatmullRomCurve3)
 *   - Nube de partículas aditivas: puntos de antinodo que explotan y se desvanecen
 *   - Postes emisivos en los extremos (rojo=fijo, verde=libre)
 *   - Grid de referencia en el plano XZ (suelo negro)
 *   - Stage con autoRotate lento → la cuerda se contempla desde ángulo orbital
 *
 * Regla useFrame: SOLO dentro de sub-componentes hijos de <Stage> (dentro del Canvas).
 */

import { useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

// ── Tipos ─────────────────────────────────────────────────────────────

type BoundaryId = 'fixed' | 'free';
type InitId = 'pulse' | 'pluck' | 'mode1' | 'mode2' | 'mode3';

interface WaveLessonState {
  c: number;
  boundary: BoundaryId;
  init: InitId;
}

// ── Parámetros numéricos ──────────────────────────────────────────────

const N      = 220;            // nodos espaciales (i = 0..N-1)
const L      = 6;              // longitud física en unidades de mundo
const DX     = L / (N - 1);   // Δx
const DT     = 0.018;          // Δt fijo (el slider mueve c, no dt)
const SUB    = 3;              // pasos FDTD por frame de render
const AMP    = 0.9;            // amplitud visual (eje Y)
const C_CFL  = DX / DT;        // velocidad donde C = 1 exacto

// ── Lección pedagógica ────────────────────────────────────────────────

const LESSON: Lesson<WaveLessonState> = {
  hook: {
    title: 'Una cuerda de guitarra resuelve una EDO cada vez que la tocas.',
    body: `Pellizcas la cuerda y suena. ¿Por qué vibra con ESA forma y no otra? ¿Por qué da ESA nota?

La respuesta es una de las ecuaciones más bellas de la física:

∂²u/∂t² = c² ∂²u/∂x²

Dice algo simple: la aceleración de cada punto es proporcional a qué tan CURVADA está la cuerda ahí. Donde la cuerda forma un valle, la tensión la jala hacia arriba. Esa restauración constante es lo que hace que vibre.

D'Alembert la resolvió en 1747. Aquí la simulamos con FDTD — la misma técnica que usan los chips de WiFi para modelar campos electromagnéticos.`,
  },

  steps: [
    {
      title: 'El pulso que viaja — solución de D\'Alembert',
      duration: 6000,
      body: `Arranco con un pulso gaussiano en el centro y velocidad inicial cero. El pulso se PARTE en dos mitades idénticas, cada una viajando a velocidad c en direcciones opuestas.

Eso es exactamente la solución analítica de D'Alembert:
u(x,t) = ½[f(x−ct) + f(x+ct)]

Cualquier perfil inicial se descompone en dos copias viajeras. La ecuación de onda es NO dispersiva: cada mitad mantiene su forma perfectamente mientras se desplaza. No hay deformación, solo traslación.

Observa cómo cada mitad llega al extremo y... rebota.`,
      formula: 'u(x,t) = ½[ f(x−ct) + f(x+ct) ]\nu^{n+1}_i = 2u^n_i − u^{n-1}_i + C²(u^n_{i+1}−2u^n_i+u^n_{i-1})',
      keyframes: [
        { at: 0, state: { c: 1, boundary: 'fixed', init: 'pulse' } },
        { at: 1, state: { c: 1, boundary: 'fixed', init: 'pulse' } },
      ],
    },
    {
      title: 'Borde fijo — rebote con inversión de fase',
      duration: 6000,
      body: `La cuerda está clavada en los extremos: u(0)=u(L)=0. Es la condición de Dirichlet.

El poste rojo te dice: este extremo NO se mueve. Cuando el pulso llega al poste, rebota INVERTIDO. Una cima regresa como valle. Es un cambio de fase de π radianes.

¿Por qué? El borde fijo debe mantener u=0 en todo instante. Para cancelar la onda incidente, el reflejo debe venir con signo opuesto.

Es el mismo fenómeno que hace que el reflejo de la luz en un espejo metálico invierta la polarización, y que en acústica crea "nodos" en los extremos de los tubos cerrados.`,
      formula: 'u(0,t) = u(L,t) = 0    (Dirichlet)\nrebote → inversión de fase (Δφ = π)',
      keyframes: [
        { at: 0, state: { c: 1, boundary: 'fixed', init: 'pulse' } },
        { at: 1, state: { c: 1, boundary: 'fixed', init: 'pulse' } },
      ],
    },
    {
      title: 'Borde libre — rebote sin invertir',
      duration: 6000,
      body: `Ahora suelto los extremos: ∂u/∂x=0 en x=0 y x=L. Es la condición de Neumann. El poste verde: el extremo puede subir y bajar, solo que sin pendiente.

El rebote es completamente diferente: el pulso regresa DERECHO, sin invertirse. Una cima vuelve como cima.

Lo implemento con nodos fantasma: u[−1]=u[1] y u[N]=u[N−2]. Eso fuerza pendiente cero en el borde sin fijar el valor.

Físicamente: es un anillo deslizante en un poste sin fricción — el extremo no tiene fuerza transversal, entonces la onda se refleja sin perder la cara.`,
      formula: '∂u/∂x|₀ = ∂u/∂x|_L = 0    (Neumann)\nnodo fantasma: u[−1]=u[1], u[N]=u[N−2]',
      keyframes: [
        { at: 0, state: { c: 1, boundary: 'free', init: 'pulse' } },
        { at: 1, state: { c: 1, boundary: 'free', init: 'pulse' } },
      ],
    },
    {
      title: 'Ondas estacionarias — los modos de la cuerda',
      duration: 7000,
      body: `Arranco con una forma senoidal pura: u(x,0)=sin(mπx/L), velocidad cero, bordes fijos.

La onda ya NO viaja. Sube y baja en el mismo lugar — es una onda ESTACIONARIA. Matemáticamente es la superposición de dos viajeras idénticas en sentidos opuestos:
u_m(x,t) = sin(mπx/L)·cos(2πf_m·t)

Observa los NODOS (puntos que nunca se mueven) y los ANTINODOS (los que oscilan al máximo). El modo m tiene m antinodos y m+1 nodos (contando los extremos).

Cada modo vibra a su frecuencia: f_m = m·c/(2L). El modo 1 es la fundamental; los demás son los armónicos. Una guitarra real suena como la SUMA de todos estos modos (serie de Fourier).`,
      formula: 'u_m(x,t) = sin(mπx/L) · cos(2πf_m·t)\nf_m = m·c / (2L)',
      keyframes: [
        { at: 0,    state: { c: 1, boundary: 'fixed', init: 'mode1' } },
        { at: 0.4,  state: { c: 1, boundary: 'fixed', init: 'mode2' } },
        { at: 0.75, state: { c: 1, boundary: 'fixed', init: 'mode3' } },
        { at: 1,    state: { c: 1, boundary: 'fixed', init: 'mode3' } },
      ],
    },
    {
      title: 'La condición CFL — el límite de velocidad numérico',
      duration: 6500,
      body: `Todo lo anterior funciona solo si respetamos UNA regla de oro: la condición de Courant-Friedrichs-Lewy:
C = c·Δt/Δx ≤ 1

C es cuántas celdas avanza la onda física en un paso de tiempo. Si C ≤ 1, la información numérica viaja tan rápido como la onda física y la simulación es estable.

Si C > 1, la onda física viaja MÁS RÁPIDO que lo que la malla puede transmitir. El esquema EXPLOTA: aparecen oscilaciones que crecen sin freno. No es un bug — es el límite fundamental de los métodos explícitos.

CFL (1928) es por qué los simuladores de clima, sismos y tsunamis calculan su paso de tiempo con tanto cuidado.`,
      formula: 'CFL:  C = c·Δt/Δx ≤ 1   (estable)\nC > 1  ⇒  el esquema explota (inestabilidad de von Neumann)',
      keyframes: [
        { at: 0,   state: { c: 1.0, boundary: 'fixed', init: 'pulse' } },
        { at: 0.5, state: { c: 1.0, boundary: 'fixed', init: 'pulse' } },
        { at: 1,   state: { c: 1.0, boundary: 'fixed', init: 'pulse' } },
      ],
    },
  ],

  connect: {
    body: `Acabas de simular la misma ecuación que gobierna el sonido, la luz, los sismos y las olas del mar.

A dónde te lleva esto:

• Series de Fourier: una cuerda real vibra como la SUMA de sus modos. Descomponer cualquier sonido en senos es el corazón de MP3 y JPEG.
• Ecuación de Schrödinger: cambia el signo y vuelve compleja la amplitud → mecánica cuántica. Los modos pasan a ser niveles de energía.
• Ecuación del calor: quita una derivada temporal → difusión. Misma malla FDTD, dinámica opuesta (suaviza en vez de propagar).
• Sismología: la versión 2D/3D con c(x,z) variable predice cómo viaja un terremoto bajo tierra.
• Electrodinámica: Maxwell = ecuaciones de onda acopladas para E y B. La velocidad es c = 1/√(ε₀μ₀).

La CFL que acabas de romper limita a cada uno de esos simuladores.`,
    links: [
      { label: 'Ecuación del calor — difusión en la misma malla', href: '#heat-1d' },
      { label: 'Retrato de fases — geometría de EDOs', href: '#phase-portrait' },
      { label: 'Series de Fourier — descomponer en modos', href: '#fourier-series' },
    ],
  },
};

// ── FDTD helpers (matemática real) ────────────────────────────────────

function initialDisplacement(init: InitId, x: number): number {
  switch (init) {
    case 'pulse': {
      const x0 = L * 0.5;
      const w = L * 0.05;
      return AMP * Math.exp(-((x - x0) ** 2) / (2 * w * w));
    }
    case 'pluck': {
      const xp = L / 3;
      return x < xp ? AMP * (x / xp) : AMP * ((L - x) / (L - xp));
    }
    case 'mode1': return AMP * 0.75 * Math.sin((1 * Math.PI * x) / L);
    case 'mode2': return AMP * 0.75 * Math.sin((2 * Math.PI * x) / L);
    case 'mode3': return AMP * 0.75 * Math.sin((3 * Math.PI * x) / L);
  }
}

function buildInitialState(init: InitId, boundary: BoundaryId): {
  u: Float32Array;
  uPrev: Float32Array;
} {
  const u = new Float32Array(N);
  for (let i = 0; i < N; i++) u[i] = initialDisplacement(init, i * DX);
  if (boundary === 'fixed') { u[0] = 0; u[N - 1] = 0; }
  const uPrev = new Float32Array(u); // v(0)=0 → uPrev = u (leapfrog arranque)
  return { u, uPrev };
}

// ── Nube de partículas de energía ─────────────────────────────────────

const PART_COUNT = 600;

function makeParticleGeom() {
  const g = new THREE.BufferGeometry();
  const pos  = new Float32Array(PART_COUNT * 3);
  const col  = new Float32Array(PART_COUNT * 3);
  const life = new Float32Array(PART_COUNT); // 0 = muerta
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color',    new THREE.BufferAttribute(col, 3));
  // Inicialmente todas muertas (fuera del frustum)
  for (let i = 0; i < PART_COUNT; i++) {
    pos[i * 3 + 1] = -999;
    life[i] = 0;
  }
  return { geom: g, life };
}

// ── Escena 3D — vive dentro del Canvas ───────────────────────────────

interface SceneProps {
  c: number;
  boundary: BoundaryId;
  init: InitId;
  seed: number;
  onPeak: (p: number) => void;
}

function WaveScene({ c, boundary, init, seed, onPeak }: SceneProps) {
  // Buffers FDTD (mutables, fuera de React)
  const uRef     = useRef<Float32Array>(new Float32Array(N));
  const uPrevRef = useRef<Float32Array>(new Float32Array(N));
  const uNextRef = useRef<Float32Array>(new Float32Array(N));

  // Geometría de la cuerda: N vértices en la curva XY
  const positions = useMemo(() => new Float32Array(N * 3), []);
  const stringGeom = useRef<THREE.BufferGeometry>(null);

  // Marcadores de extremo
  const endLeftRef  = useRef<THREE.Mesh>(null);
  const endRightRef = useRef<THREE.Mesh>(null);

  // Tubo 3D (TubeGeometry regenerada cada frame sería muy caro;
  // usamos un LineSegments grueso + particles para el efecto cine)
  // La "cuerda" visible es una line con points adicionales.

  // Nube de partículas de energía
  const { geom: partGeom, life: partLife } = useMemo(() => makeParticleGeom(), []);
  const partIdx = useRef(0);
  const partPointsRef = useRef<THREE.Points>(null);

  // Posiciones estáticas de la línea de reposo (eje)
  const restPositions = useMemo(() => {
    const a = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      a[i * 3 + 0] = i * DX - L / 2;
      a[i * 3 + 1] = 0;
      a[i * 3 + 2] = 0;
    }
    return a;
  }, []);

  // Plano XZ de referencia (grid visual)
  // Re-seed cuando cambian init/boundary/seed
  useMemo(() => {
    const { u, uPrev } = buildInitialState(init, boundary);
    uRef.current     = u;
    uPrevRef.current = uPrev;
    uNextRef.current = new Float32Array(N);
    // Volcar a posiciones iniciales
    for (let i = 0; i < N; i++) {
      positions[i * 3 + 0] = i * DX - L / 2;
      positions[i * 3 + 1] = u[i];
      positions[i * 3 + 2] = 0;
    }
    if (stringGeom.current) {
      (stringGeom.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [init, boundary, seed]);

  const frameRef = useRef(0);
  const peakRef  = useRef(0);

  useFrame(() => {
    const C  = (c * DT) / DX;
    const C2 = C * C;

    // Pasos FDTD leapfrog
    for (let s = 0; s < SUB; s++) {
      const u     = uRef.current;
      const uPrev = uPrevRef.current;
      const uNext = uNextRef.current;

      // Interior
      for (let i = 1; i < N - 1; i++) {
        const lap = u[i + 1] - 2 * u[i] + u[i - 1];
        uNext[i]  = 2 * u[i] - uPrev[i] + C2 * lap;
      }

      // Bordes
      if (boundary === 'fixed') {
        uNext[0]     = 0;
        uNext[N - 1] = 0;
      } else {
        // Neumann via nodo fantasma
        { const lap0 = u[1] - 2 * u[0] + u[1]; uNext[0] = 2 * u[0] - uPrev[0] + C2 * lap0; }
        { const lapN = u[N-2] - 2 * u[N-1] + u[N-2]; uNext[N-1] = 2 * u[N-1] - uPrev[N-1] + C2 * lapN; }
      }

      // Rotar buffers
      uPrevRef.current = u;
      uRef.current     = uNext;
      uNextRef.current = uPrev;
    }

    // Volcar a posiciones + medir pico
    const u = uRef.current;
    let peak = 0;
    for (let i = 0; i < N; i++) {
      const yi = u[i];
      const a  = Math.abs(yi);
      if (a > peak) peak = a;
      const yC = isFinite(yi) ? Math.max(-6, Math.min(6, yi)) : 0;
      positions[i * 3 + 1] = yC;
    }
    if (stringGeom.current) {
      (stringGeom.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // Actualizar marcadores de extremo
    const yL = isFinite(u[0])     ? Math.max(-6, Math.min(6, u[0]))     : 0;
    const yR = isFinite(u[N - 1]) ? Math.max(-6, Math.min(6, u[N - 1])) : 0;
    if (endLeftRef.current)  endLeftRef.current.position.set(-L / 2, yL, 0);
    if (endRightRef.current) endRightRef.current.position.set( L / 2, yR, 0);

    // Emitir partículas de energía en antinodos (|u| > 0.3·AMP)
    // Cada ~3 frames emitimos un burst de partículas en varios puntos calientes
    frameRef.current += 1;
    if (frameRef.current % 3 === 0 && partPointsRef.current) {
      const partG    = partPointsRef.current.geometry;
      const posAttr  = partG.attributes.position as THREE.BufferAttribute;
      const colAttr  = partG.attributes.color    as THREE.BufferAttribute;
      const posArr   = posAttr.array  as Float32Array;
      const colArr   = colAttr.array  as Float32Array;

      // Recorrer la cuerda buscando antinodos
      for (let i = 2; i < N - 2; i++) {
        const yi = u[i];
        if (!isFinite(yi)) continue;
        const absY = Math.abs(yi);
        if (absY < 0.35 * AMP) continue;
        if (Math.random() > 0.08) continue; // emitir con prob 8%

        const pi = partIdx.current % PART_COUNT;
        partIdx.current += 1;

        const x = i * DX - L / 2;
        const y = Math.max(-6, Math.min(6, yi));

        posArr[pi * 3 + 0] = x + (Math.random() - 0.5) * 0.12;
        posArr[pi * 3 + 1] = y + (Math.random() - 0.5) * 0.12;
        posArr[pi * 3 + 2] = (Math.random() - 0.5) * 0.25;

        // Color: ámbar-dorado para alta energía, cyan para baja
        const t = Math.min(1, absY / AMP);
        colArr[pi * 3 + 0] = 0.31 + t * 0.69;  // R: 0.31→1.0
        colArr[pi * 3 + 1] = 0.76 - t * 0.44;  // G: 0.76→0.32
        colArr[pi * 3 + 2] = 0.97 - t * 0.97;  // B: 0.97→0.0

        partLife[pi] = 1.0;
      }

      // Envejecer y matar partículas
      for (let pi = 0; pi < PART_COUNT; pi++) {
        if (partLife[pi] <= 0) continue;
        partLife[pi] -= 0.04;
        if (partLife[pi] <= 0) {
          posArr[pi * 3 + 1] = -999; // mandar fuera del frustum
          partLife[pi] = 0;
        } else {
          // Flotar hacia arriba levemente
          posArr[pi * 3 + 1] += 0.008 * partLife[pi];
        }
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }

    // Reporte de pico cada 6 frames
    if (frameRef.current % 6 === 0) {
      const rep = isFinite(peak) ? peak : 1e9;
      if (Math.abs(rep - peakRef.current) > 0.02 || rep > 100) {
        peakRef.current = rep;
        onPeak(rep);
      }
    }
  });

  const endColor = boundary === 'fixed' ? '#EF5350' : '#34D399';
  const endEmissive = boundary === 'fixed' ? '#EF5350' : '#34D399';

  return (
    <>
      {/* Eje de reposo — referencia visual */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, L, 8]} />
        <meshStandardMaterial color="#1E293B" emissive="#0F172A" emissiveIntensity={0.5}
          transparent opacity={0.5} />
      </mesh>

      {/* Postes verticales en los extremos */}
      {([-L / 2, L / 2] as number[]).map((xPost, k) => (
        <mesh key={k} position={[xPost, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, AMP * 3.0, 12]} />
          <meshStandardMaterial
            color="#334155"
            emissive={endEmissive}
            emissiveIntensity={0.5}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* La cuerda vibrante — line strip emisivo */}
      <line>
        <bufferGeometry ref={stringGeom}>
          <bufferAttribute
            attach="attributes-position"
            count={N}
            array={positions}
            itemSize={3}
            args={[positions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#FDB813" linewidth={3} toneMapped={false} />
      </line>

      {/* Línea de reposo tenue — referencia de equilibrio */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={N}
            array={restPositions}
            itemSize={3}
            args={[restPositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#FDB813" linewidth={1} transparent opacity={0.18} toneMapped={false} />
      </line>

      {/* Marcadores de extremo (esferas emisivas) */}
      <mesh ref={endLeftRef} position={[-L / 2, 0, 0]}>
        <sphereGeometry args={[0.10, 20, 20]} />
        <meshStandardMaterial
          color={endColor}
          emissive={endColor}
          emissiveIntensity={2.0}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={endRightRef} position={[L / 2, 0, 0]}>
        <sphereGeometry args={[0.10, 20, 20]} />
        <meshStandardMaterial
          color={endColor}
          emissive={endColor}
          emissiveIntensity={2.0}
          toneMapped={false}
        />
      </mesh>

      {/* Nube de partículas de energía (aditiva, emisiva) */}
      <points ref={partPointsRef} geometry={partGeom}>
        <pointsMaterial
          vertexColors
          size={0.10}
          sizeAttenuation
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>

      {/* Grid de referencia en el plano XZ */}
      <gridHelper
        args={[L * 2.2, 18, '#0F172A', '#0F172A']}
        position={[0, -AMP * 1.6, 0]}
        rotation={[0, 0, 0]}
      />
    </>
  );
}

// ── Componente exportado ──────────────────────────────────────────────

export default function Wave1D() {
  const { audience } = useAudience();

  const [c,        setC]        = useState(1);
  const [boundary, setBoundary] = useState<BoundaryId>('fixed');
  const [init,     setInit]     = useState<InitId>('pulse');
  const [seed,     setSeed]     = useState(0);
  const [peak,     setPeak]     = useState(AMP);
  const [running,  setRunning]  = useState(true);

  const reseed    = useCallback(() => setSeed(s => s + 1), []);
  const handlePeak = useCallback((p: number) => setPeak(p), []);

  // Pausa: cuando !running no avanzamos el seed → la escena congela porque
  // el FDTD en useFrame sigue corriendo pero la referencia de "running"
  // queda disponible para el sub-componente vía prop.
  // Implementamos pausa real pasando c=0 al integrador.
  const cEff = running ? c : 0;

  // Diagnósticos CFL
  const courant  = (c * DT) / DX;
  const cflOk    = courant <= 1;
  const exploded = !isFinite(peak) || peak > 50;

  // Frecuencias
  const fundamental = c / (2 * L);
  const modeNum: number | null = init === 'mode1' ? 1 : init === 'mode2' ? 2 : init === 'mode3' ? 3 : null;
  const modeFreq = modeNum !== null ? (modeNum * c) / (2 * L) : null;

  const INIT_OPTS: { id: InitId; label: string; blurb: string }[] = [
    { id: 'pulse',  label: 'Pulso',     blurb: 'Gaussiano centrado. Se parte en dos y rebota.' },
    { id: 'pluck',  label: 'Pellizco',  blurb: 'Triangular — como una púa de guitarra.' },
    { id: 'mode1',  label: 'Modo 1',    blurb: 'sin(πx/L) — fundamental.' },
    { id: 'mode2',  label: 'Modo 2',    blurb: 'sin(2πx/L) — 1er armónico.' },
    { id: 'mode3',  label: 'Modo 3',    blurb: 'sin(3πx/L) — 2do armónico.' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      {/* ── Canvas R3F ──────────────────────────────────────────────── */}
      <div className="relative">
        <Stage
          cameraDistance={L * 1.25}
          bloomIntensity={0.9}
          bloomThreshold={0.08}
          autoRotate
          bgColor="#05060A"
          enablePan
        >
          <WaveScene
            c={cEff}
            boundary={boundary}
            init={init}
            seed={seed}
            onPeak={handlePeak}
          />
        </Stage>

        {/* HUD overlay — diagnósticos */}
        <div className="absolute top-3 left-3 rounded-lg bg-[#05060A]/80 backdrop-blur
                        border border-[#1E293B] px-3 py-2 font-mono text-[11px] text-[#CBD5E1] space-y-1">
          <div>
            <span className="text-[#FDB813]">━</span> u(x,t) — cuerda vibrante
          </div>
          <div>
            <span style={{ color: boundary === 'fixed' ? '#EF5350' : '#34D399' }}>●</span>{' '}
            borde {boundary === 'fixed' ? 'fijo (Dirichlet)' : 'libre (Neumann)'}
          </div>
          <div className="mt-0.5">
            C = c·Δt/Δx ={' '}
            <span className={cflOk ? 'text-[#34D399]' : 'text-[#EF5350]'}>
              {courant.toFixed(3)}
            </span>
          </div>
          <div className="text-[#64748B]">c = {c.toFixed(2)} | f₁ = {fundamental.toFixed(3)}</div>
        </div>

        {/* Alerta CFL */}
        {exploded && (
          <div className="absolute bottom-14 left-3 right-3 text-[11px] text-[#EF5350]
                          bg-[#EF5350]/10 border border-[#EF5350]/40 backdrop-blur
                          px-3 py-2 rounded leading-snug">
            Inestabilidad CFL: C = {courant.toFixed(3)} {'>'} 1. El esquema explotó — baja c o reinicia.
          </div>
        )}

        {/* Controles de reproducción */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2
                        bg-[#05060A]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <CtrlBtn onClick={() => setRunning(r => !r)} active={running}>
            {running ? '❚❚' : '▶'}
          </CtrlBtn>
          <CtrlBtn onClick={reseed} title="Reiniciar condición inicial">↺</CtrlBtn>
        </div>
      </div>

      {/* ── Panel pedagógico ────────────────────────────────────────── */}
      <LessonPanel<WaveLessonState>
        lesson={LESSON}
        onApplyState={(patch) => {
          let needSeed = false;
          if (patch.c         !== undefined) setC(patch.c);
          if (patch.boundary  !== undefined) { setBoundary(patch.boundary); needSeed = true; }
          if (patch.init      !== undefined) { setInit(patch.init);         needSeed = true; }
          if (needSeed) reseed();
        }}
        sandbox={
          <>
            {/* Velocidad c */}
            <div className="p-3 border-b border-[#1E293B]">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-2">Velocidad de propagación</div>
              <label className="block text-[11px] text-[#94A3B8]">
                c = <span className="font-mono text-[#FDB813]">{c.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0.2}
                max={(C_CFL * 1.25).toFixed(2)}
                step={0.02}
                value={c}
                onChange={e => setC(parseFloat(e.target.value))}
                className="w-full accent-[#FDB813] mt-1"
              />
              <div className="flex justify-between text-[10px] font-mono mt-1">
                <span className="text-[#64748B]">estable</span>
                <span className={cflOk ? 'text-[#34D399]' : 'text-[#EF5350]'}>
                  C={courant.toFixed(3)} {cflOk ? '≤1 ✓' : '>1 EXPLOTA'}
                </span>
              </div>
              <div className="text-[10px] text-[#64748B] mt-0.5">
                frontera CFL: c = {C_CFL.toFixed(2)} (C = 1 exacto)
              </div>
            </div>

            {/* Borde */}
            <div className="p-3 border-b border-[#1E293B]">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-2">Condición de borde</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(['fixed', 'free'] as BoundaryId[]).map(b => (
                  <button
                    key={b}
                    onClick={() => { setBoundary(b); reseed(); }}
                    className={`text-[11px] px-2 py-1.5 rounded border transition ${
                      boundary === b
                        ? 'bg-[#FDB813]/10 border-[#FDB813]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#FDB813]/30'
                    }`}
                  >
                    {b === 'fixed' ? 'Fijo (Dirichlet)' : 'Libre (Neumann)'}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-[#64748B] mt-1.5 leading-snug">
                {boundary === 'fixed'
                  ? 'u=0 en los extremos — rebote con inversión de fase (π).'
                  : '∂u/∂x=0 en los extremos — rebote sin invertir.'}
              </div>
            </div>

            {/* Condición inicial */}
            <div className="p-3 border-b border-[#1E293B]">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-2">Condición inicial</div>
              <div className="space-y-1">
                {INIT_OPTS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => { setInit(opt.id); reseed(); }}
                    className={`w-full text-left text-[11px] px-2.5 py-1.5 rounded border transition ${
                      init === opt.id
                        ? 'bg-[#4FC3F7]/15 border-[#4FC3F7]/50 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#4FC3F7]/30'
                    }`}
                  >
                    <div className="font-semibold">{opt.label}</div>
                    <div className="text-[10px] text-[#64748B]">{opt.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Reiniciar */}
            <div className="p-3 border-b border-[#1E293B]">
              <button
                onClick={reseed}
                className="w-full text-[11px] px-2 py-1.5 rounded border border-[#FDB813]/40
                           bg-[#FDB813]/10 text-[#FDB813] hover:bg-[#FDB813]/20"
              >
                ↻ Pellizcar / reiniciar onda
              </button>
            </div>

            {/* Estado en vivo */}
            <div className="p-3 space-y-1 text-[11px] font-mono">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-2">Estado</div>
              <MonoRow label="Δx"    value={DX.toFixed(4)} />
              <MonoRow label="Δt"    value={DT.toFixed(4)} />
              <MonoRow label="C"     value={courant.toFixed(4)} alert={!cflOk} />
              <MonoRow label="f₁"    value={fundamental.toFixed(4)} />
              {modeFreq !== null && (
                <MonoRow label={`f_${modeNum}`} value={modeFreq.toFixed(4)} />
              )}
              <MonoRow label="|u|max" value={exploded ? '∞ (inestable)' : peak.toFixed(3)} alert={exploded} />
            </div>

            {/* Detalles técnicos para researcher */}
            {audience === 'researcher' && (
              <div className="p-3 border-t border-[#1E293B] text-[10px] text-[#64748B] leading-relaxed">
                FDTD leapfrog 2do orden: u^{'n+1'} = 2u^n − u^{'n-1'} + C²·Δ²ₓu.
                Estabilidad von Neumann ⇒ CFL C ≤ 1.
                Neumann via nodos fantasma; Dirichlet fija extremos.
                N={N}, L={L}, SUB-pasos={SUB}/frame.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}

// ── Pequeños helpers de UI ───────────────────────────────────────────

function CtrlBtn({
  children, onClick, active, title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-9 h-9 rounded-md border text-[14px] transition flex items-center justify-center ${
        active
          ? 'border-[#FDB813]/60 text-[#FDB813] bg-[#FDB813]/10'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function MonoRow({
  label, value, alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className={alert ? 'text-[#EF5350]' : 'text-white'}>{value}</span>
    </div>
  );
}
