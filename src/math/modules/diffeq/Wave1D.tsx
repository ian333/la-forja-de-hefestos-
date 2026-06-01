/**
 * Ecuación de onda 1D — la cuerda vibrante.
 *
 *   ∂²u/∂t² = c² ∂²u/∂x²
 *
 * u(x, t) es el desplazamiento transversal de una cuerda tensa. c es la
 * velocidad de propagación. La ecuación dice: la aceleración de cada punto
 * es proporcional a la CURVATURA local de la cuerda. Donde la cuerda se
 * dobla hacia abajo (cóncava), el punto se acelera hacia arriba, y viceversa.
 *
 * Resolvemos numéricamente con FDTD (Finite-Difference Time-Domain), esquema
 * leapfrog explícito de 2do orden en espacio y tiempo:
 *
 *   u^{n+1}_i = 2u^n_i − u^{n-1}_i + C² (u^n_{i+1} − 2u^n_i + u^n_{i-1})
 *
 * donde C = c·dt/dx es el número de Courant. El método es ESTABLE solo si se
 * respeta la condición CFL:   C = c·dt/dx ≤ 1.
 * Si C > 1, la información numérica viaja más lento que la onda física y el
 * esquema EXPLOTA (oscilaciones que crecen sin cota). Lo mostramos en vivo.
 *
 * Bordes:
 *   • Fijo (Dirichlet):  u(0)=u(L)=0   — la cuerda está clavada; la onda
 *     rebota INVERTIDA (cambio de fase de π).
 *   • Libre (Neumann):   ∂u/∂x=0 en los extremos — el extremo puede subir y
 *     bajar; la onda rebota SIN invertirse. Implementado con nodos fantasma
 *     (u[−1]=u[1], u[N]=u[N−2]).
 *
 * Condiciones iniciales:
 *   • Pulso gaussiano viajero (lo ves rebotar).
 *   • Pellizco triangular (pluck de guitarra) en reposo.
 *   • Modo senoidal estacionario:  u(x,0)=sin(mπx/L), velocidad 0  →  onda
 *     estacionaria pura de frecuencia f_m = m·c/(2L).
 *
 * Toda la matemática se resuelve en vivo en useFrame; los controles (c, borde,
 * condición inicial) recalculan la simulación al instante.
 */

import { useMemo, useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import CanvasCapture from '@/math/components/CanvasCapture';

// ── Tipos de estado de la lección ─────────────────────────────────────

type BoundaryId = 'fixed' | 'free';
type InitId = 'pulse' | 'pluck' | 'mode1' | 'mode2' | 'mode3';

interface WaveLessonState {
  c: number;          // velocidad de propagación
  boundary: BoundaryId;
  init: InitId;
}

// ── La lección ────────────────────────────────────────────────────────

const LESSON: Lesson<WaveLessonState> = {
  hook: {
    title: 'Una cuerda de guitarra resuelve una ecuación diferencial cada vez que la tocas.',
    body: `Pellizcas la cuerda, la sueltas, y suena. ¿Por qué vibra con ESA forma y no otra? ¿Por qué da ESA nota?

La respuesta es una de las ecuaciones más bellas de la física: la ecuación de onda.

∂²u/∂t² = c² ∂²u/∂x²

Dice algo simple: la aceleración de cada pedacito de cuerda es proporcional a qué tan CURVADA está ahí. Donde la cuerda forma un valle, la tensión la jala hacia arriba; donde forma una cima, la jala hacia abajo. Esa restauración constante es lo que hace que vibre.

D'Alembert la resolvió en 1747. Aquí la resolvemos como lo hace una computadora moderna: discretizando el espacio y el tiempo (FDTD), respetando la regla de oro de la estabilidad numérica.`,
  },

  steps: [
    {
      title: 'Un pulso que viaja',
      duration: 5500,
      body: `Empiezo con un pulso gaussiano y velocidad inicial cero. Sin empujarlo en ninguna dirección, el pulso se PARTE en dos: medio viaja a la derecha, medio a la izquierda, cada uno a velocidad c.

Eso es exactamente la solución de d'Alembert: u(x,t) = ½[f(x−ct) + f(x+ct)]. Cualquier forma inicial se descompone en dos copias que viajan en sentidos opuestos.

Mira cómo cada mitad mantiene su forma mientras se desplaza. La ecuación de onda NO deforma el pulso (es no dispersiva) — solo lo traslada.

Numéricamente, cada punto futuro u^{n+1}_i sale de su pasado u^{n−1}_i y de la curvatura de sus vecinos. Es el esquema leapfrog.`,
      formula: 'u(x,t) = ½[ f(x−ct) + f(x+ct) ]\nu^{n+1}_i = 2u^n_i − u^{n−1}_i + C²(u^n_{i+1} − 2u^n_i + u^n_{i−1})',
      keyframes: [
        { at: 0, state: { c: 1, boundary: 'fixed', init: 'pulse' } },
        { at: 1, state: { c: 1, boundary: 'fixed', init: 'pulse' } },
      ],
    },
    {
      title: 'Borde fijo — rebote invertido',
      duration: 6000,
      body: `La cuerda está clavada en los dos extremos: u(0)=u(L)=0. Es la condición de Dirichlet.

Mira qué le pasa al pulso cuando llega a la pared: rebota INVERTIDO. Lo que era una cima vuelve como un valle. Es un cambio de fase de π.

¿Por qué? La pared no se puede mover. Para mantener u=0 ahí en todo momento, el pulso reflejado debe cancelar exactamente al incidente — y eso exige que llegue con el signo opuesto.

Es el mismo fenómeno que hace que el extremo fijo de una soga reboje las ondas al revés, y que en óptica un reflejo "duro" invierta la fase de la luz.`,
      formula: 'u(0,t) = u(L,t) = 0    (Dirichlet)\nrebote ⇒ inversión de fase (π)',
      keyframes: [
        { at: 0, state: { c: 1, boundary: 'fixed', init: 'pulse' } },
        { at: 1, state: { c: 1, boundary: 'fixed', init: 'pulse' } },
      ],
    },
    {
      title: 'Borde libre — rebote sin invertir',
      duration: 6000,
      body: `Ahora suelto los extremos: ∂u/∂x = 0 en x=0 y x=L. Es la condición de Neumann. El extremo de la cuerda puede subir y bajar libremente, solo que sin pendiente.

Mira el rebote: el pulso vuelve DERECHO, sin invertirse. Una cima regresa como cima.

Lo implemento con nodos fantasma: u[−1] = u[1] y u[N] = u[N−2]. Eso fuerza pendiente cero en el borde sin necesidad de fijar el valor.

Físicamente es un anillo deslizante en un poste sin fricción: el extremo está libre de fuerza transversal, así que la onda se refleja sin perder la cara.`,
      formula: '∂u/∂x|₀ = ∂u/∂x|_L = 0    (Neumann)\nnodo fantasma: u[−1]=u[1],  u[N]=u[N−2]',
      keyframes: [
        { at: 0, state: { c: 1, boundary: 'free', init: 'pulse' } },
        { at: 1, state: { c: 1, boundary: 'free', init: 'pulse' } },
      ],
    },
    {
      title: 'Ondas estacionarias — los modos de la cuerda',
      duration: 6000,
      body: `Arranco con una forma senoidal pura: u(x,0) = sin(mπx/L), con velocidad cero y bordes fijos.

Mira: la onda ya NO viaja. Sube y baja en el mismo lugar. Es una onda ESTACIONARIA — la superposición de dos ondas viajeras idénticas en sentidos opuestos.

Hay NODOS (puntos que nunca se mueven) y ANTINODOS (los que oscilan al máximo). El modo m tiene m antinodos.

Cada modo vibra a su propia frecuencia: f_m = m·c/(2L). El modo 1 es la fundamental (la nota que oyes); los demás son los armónicos que le dan timbre. Una cuerda real suena como la SUMA de todos estos modos a la vez (serie de Fourier).`,
      formula: 'u_m(x,t) = sin(mπx/L) · cos(2π f_m t)\nf_m = m·c / (2L)',
      keyframes: [
        { at: 0,   state: { c: 1, boundary: 'fixed', init: 'mode1' } },
        { at: 0.5, state: { c: 1, boundary: 'fixed', init: 'mode2' } },
        { at: 1,   state: { c: 1, boundary: 'fixed', init: 'mode3' } },
      ],
    },
    {
      title: 'La condición CFL — el límite de velocidad numérico',
      duration: 6000,
      body: `Todo lo anterior funciona solo si respetamos UNA regla de oro: la condición de Courant-Friedrichs-Lewy.

C = c·dt/dx ≤ 1.

C es cuántas celdas avanza la onda física en un paso de tiempo. Si C ≤ 1, la onda nunca le gana al esquema numérico y la simulación es estable. Si subes c (o dt) hasta que C > 1, la información física viaja MÁS RÁPIDO que lo que la malla puede transmitir — y el método explota: aparecen oscilaciones que crecen sin freno.

Sube la velocidad c con el slider hasta el borde rojo y míralo reventar. No es un bug: es el límite fundamental de los métodos explícitos. CFL (1928) es por qué los simuladores de clima, sismos y tsunamis eligen su paso de tiempo con tanto cuidado.`,
      formula: 'CFL:  C = c·Δt/Δx ≤ 1   (estable)\nC > 1  ⇒  el esquema explota',
      keyframes: [
        { at: 0,   state: { c: 1.0, boundary: 'fixed', init: 'pulse' } },
        { at: 0.6, state: { c: 1.0, boundary: 'fixed', init: 'pulse' } },
        { at: 1,   state: { c: 1.0, boundary: 'fixed', init: 'pulse' } },
      ],
    },
  ],

  connect: {
    body: `Acabas de simular la misma ecuación que gobierna el sonido, la luz, los sismos y las olas del mar — todas son ondas que obedecen ∂²u/∂t² = c² ∇²u.

A dónde te lleva esto:

• Series de Fourier: una cuerda real vibra como la SUMA de sus modos. Descomponer cualquier sonido en senos es el corazón de la compresión de audio (MP3) y de imagen (JPEG).
• Ecuación de Schrödinger: cambia el signo y vuelve compleja la onda → mecánica cuántica. Los "modos" pasan a ser niveles de energía.
• Ecuación del calor: quita una derivada temporal y obtienes difusión. Misma malla FDTD, dinámica opuesta (suaviza en vez de propagar).
• Sismología y tsunamis: la versión 2D/3D con c variable predice cómo viaja un terremoto bajo tierra.

La condición CFL que acabas de romper es la misma que limita a cada uno de esos simuladores.`,
    links: [
      { label: 'Ecuación del calor — difusión en la misma malla', href: '#heat-1d' },
      { label: 'Retrato de fases — la geometría de las EDO', href: '#phase-portrait' },
      { label: 'Series de Fourier — descomponer en modos', href: '#fourier-series' },
    ],
  },
};

// ── Parámetros numéricos de la malla ──────────────────────────────────

const N = 220;            // número de nodos espaciales (i = 0..N-1)
const L = 6;              // longitud física de la cuerda (unidades de mundo)
const DX = L / (N - 1);   // Δx
const DT = 0.018;         // Δt fijo (el slider mueve c, no dt)
const SUBSTEPS = 3;       // pasos FDTD por frame de render
const AMP = 0.9;          // amplitud visual del eje vertical

// Velocidad a la que C = c·dt/dx = 1 exactamente (frontera CFL):
//   c_CFL = dx / dt
const C_CFL = DX / DT;

// ── Condiciones iniciales (matemática real) ───────────────────────────

/** Desplazamiento inicial u(x,0) según la condición elegida. x ∈ [0, L]. */
function initialDisplacement(init: InitId, x: number): number {
  switch (init) {
    case 'pulse': {
      // Gaussiana centrada en L/2.
      const x0 = L * 0.5;
      const w = L * 0.05;
      return AMP * Math.exp(-((x - x0) * (x - x0)) / (2 * w * w));
    }
    case 'pluck': {
      // Pellizco triangular: pico en x = L/3 (como una púa de guitarra).
      const xp = L / 3;
      return x < xp ? AMP * (x / xp) : AMP * ((L - x) / (L - xp));
    }
    case 'mode1': return AMP * 0.7 * Math.sin((1 * Math.PI * x) / L);
    case 'mode2': return AMP * 0.7 * Math.sin((2 * Math.PI * x) / L);
    case 'mode3': return AMP * 0.7 * Math.sin((3 * Math.PI * x) / L);
  }
}

/** Construye los arreglos u^n y u^{n-1} para arrancar el leapfrog. */
function buildInitialState(init: InitId, boundary: BoundaryId): {
  u: Float32Array;
  uPrev: Float32Array;
} {
  const u = new Float32Array(N);
  const uPrev = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    u[i] = initialDisplacement(init, i * DX);
  }
  // Bordes fijos: clavar extremos a cero.
  if (boundary === 'fixed') {
    u[0] = 0;
    u[N - 1] = 0;
  }
  // Velocidad inicial CERO ⇒ el primer paso especial usa u^{-1} = u^0 + ½C²·(curvatura).
  // Con v=0, el arranque estándar de leapfrog es:
  //   u^{1}_i = u^0_i + ½ C² (u^0_{i+1} − 2u^0_i + u^0_{i−1})
  // Para que u^{n-1} represente correctamente el paso previo y v(0)=0, fijamos
  // uPrev = u (simétrico), lo que equivale a velocidad inicial nula a 2do orden.
  uPrev.set(u);
  return { u, uPrev };
}

// ── Componente interno (vive dentro del Canvas: puede usar useFrame) ───

interface SceneProps {
  c: number;
  boundary: BoundaryId;
  init: InitId;
  /** Token que cambia para forzar re-seed de la simulación (botón / cambio de IC). */
  seed: number;
  /** Reporta el valor pico |u| al exterior (para detectar explosión CFL). */
  onPeak: (peak: number) => void;
}

function WaveScene({ c, boundary, init, seed, onPeak }: SceneProps) {
  // Estado de la simulación (mutable, fuera de React para velocidad).
  const uRef = useRef<Float32Array>(new Float32Array(N));
  const uPrevRef = useRef<Float32Array>(new Float32Array(N));
  const uNextRef = useRef<Float32Array>(new Float32Array(N));

  // Geometría viva de la cuerda (line strip de N puntos).
  const stringGeomRef = useRef<THREE.BufferGeometry>(null);
  const positions = useMemo(() => new Float32Array(N * 3), []);

  // Marcadores: esferas en los extremos para señalar el tipo de borde.
  // (se posicionan en useFrame siguiendo la cuerda)
  const endLeftRef = useRef<THREE.Mesh>(null);
  const endRightRef = useRef<THREE.Mesh>(null);

  // Re-seed cuando cambian init / boundary / botón pluck.
  useMemo(() => {
    const { u, uPrev } = buildInitialState(init, boundary);
    uRef.current = u;
    uPrevRef.current = uPrev;
    uNextRef.current = new Float32Array(N);
    // Escribir geometría inicial.
    for (let i = 0; i < N; i++) {
      positions[i * 3 + 0] = i * DX - L / 2;
      positions[i * 3 + 1] = u[i];
      positions[i * 3 + 2] = 0;
    }
    if (stringGeomRef.current) {
      (stringGeomRef.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [init, boundary, seed]);

  // Acumulador de peak reportado (para no spamear setState cada frame).
  const peakReportRef = useRef(0);
  const frameCountRef = useRef(0);

  useFrame(() => {
    // Número de Courant del paso actual. C > 1 ⇒ inestable (lo dejamos explotar).
    const C = (c * DT) / DX;
    const C2 = C * C;

    for (let s = 0; s < SUBSTEPS; s++) {
      const u = uRef.current;
      const uPrev = uPrevRef.current;
      const uNext = uNextRef.current;

      // Interior: leapfrog explícito de 2do orden.
      //   u^{n+1}_i = 2u^n_i − u^{n-1}_i + C²(u^n_{i+1} − 2u^n_i + u^n_{i-1})
      for (let i = 1; i < N - 1; i++) {
        const lap = u[i + 1] - 2 * u[i] + u[i - 1];
        uNext[i] = 2 * u[i] - uPrev[i] + C2 * lap;
      }

      // Bordes.
      if (boundary === 'fixed') {
        // Dirichlet: extremos clavados a cero.
        uNext[0] = 0;
        uNext[N - 1] = 0;
      } else {
        // Neumann via nodos fantasma: u[-1]=u[1], u[N]=u[N-2] ⇒ pendiente 0.
        // Borde izquierdo (i=0):
        {
          const lap0 = u[1] - 2 * u[0] + u[1]; // u[-1] = u[1]
          uNext[0] = 2 * u[0] - uPrev[0] + C2 * lap0;
        }
        // Borde derecho (i=N-1):
        {
          const lapN = u[N - 2] - 2 * u[N - 1] + u[N - 2]; // u[N] = u[N-2]
          uNext[N - 1] = 2 * u[N - 1] - uPrev[N - 1] + C2 * lapN;
        }
      }

      // Rotar buffers: (uPrev, u, uNext) → (u, uNext, uPrev_reusado)
      uPrevRef.current = u;
      uRef.current = uNext;
      uNextRef.current = uPrev;
    }

    // Volcar el estado a la geometría + medir el pico.
    const u = uRef.current;
    let peak = 0;
    for (let i = 0; i < N; i++) {
      const yi = u[i];
      const a = Math.abs(yi);
      if (a > peak) peak = a;
      // Clamp visual para que una explosión no rompa el frustum / NaN render.
      const yClamped = isFinite(yi) ? Math.max(-6, Math.min(6, yi)) : 0;
      positions[i * 3 + 1] = yClamped;
    }
    if (stringGeomRef.current) {
      (stringGeomRef.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // Marcadores de extremo (siguen la cuerda).
    const yL = isFinite(u[0]) ? Math.max(-6, Math.min(6, u[0])) : 0;
    const yR = isFinite(u[N - 1]) ? Math.max(-6, Math.min(6, u[N - 1])) : 0;
    if (endLeftRef.current) endLeftRef.current.position.set(-L / 2, yL, 0);
    if (endRightRef.current) endRightRef.current.position.set(L / 2, yR, 0);

    // Reporte de pico ~ cada 6 frames (suaviza el setState externo).
    frameCountRef.current += 1;
    if (frameCountRef.current % 6 === 0) {
      const reported = isFinite(peak) ? peak : 1e9;
      if (Math.abs(reported - peakReportRef.current) > 0.02 || reported > 100) {
        peakReportRef.current = reported;
        onPeak(reported);
      }
    }
  });

  const endColor = boundary === 'fixed' ? '#EF5350' : '#34D399';

  return (
    <>
      {/* Eje x (la posición de reposo de la cuerda) */}
      <Line
        points={[[-L / 2, 0, 0], [L / 2, 0, 0]]}
        color="#1E293B"
        lineWidth={1}
        transparent
        opacity={0.7}
      />

      {/* Postes / paredes en los extremos */}
      {[-L / 2, L / 2].map((xPost, k) => (
        <mesh key={k} position={[xPost, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, AMP * 2.6, 12]} />
          <meshStandardMaterial
            color="#334155"
            emissive={endColor}
            emissiveIntensity={0.35}
          />
        </mesh>
      ))}

      {/* La cuerda vibrante — line strip emisivo */}
      <line>
        <bufferGeometry ref={stringGeomRef}>
          <bufferAttribute
            attach="attributes-position"
            count={N}
            array={positions}
            itemSize={3}
            args={[positions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#FDB813" linewidth={2} toneMapped={false} />
      </line>

      {/* Marcadores de extremo (color = tipo de borde) */}
      <mesh ref={endLeftRef} position={[-L / 2, 0, 0]}>
        <sphereGeometry args={[0.085, 18, 18]} />
        <meshStandardMaterial color={endColor} emissive={endColor} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      <mesh ref={endRightRef} position={[L / 2, 0, 0]}>
        <sphereGeometry args={[0.085, 18, 18]} />
        <meshStandardMaterial color={endColor} emissive={endColor} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
    </>
  );
}

// ── Componente exportado ──────────────────────────────────────────────

export default function Wave1D() {
  const { audience } = useAudience();
  const [c, setC] = useState(1);
  const [boundary, setBoundary] = useState<BoundaryId>('fixed');
  const [init, setInit] = useState<InitId>('pulse');
  const [seed, setSeed] = useState(0);
  const [peak, setPeak] = useState(AMP);

  const reseed = useCallback(() => setSeed((s) => s + 1), []);

  const handlePeak = useCallback((p: number) => setPeak(p), []);

  // Número de Courant y diagnóstico CFL (matemática real, no hardcodeado).
  const courant = (c * DT) / DX;
  const cflStable = courant <= 1;
  const exploded = !isFinite(peak) || peak > 50;

  // Frecuencia fundamental f_1 = c / (2L) y del modo activo si es senoidal.
  const modeNumber: number | null =
    init === 'mode1' ? 1 : init === 'mode2' ? 2 : init === 'mode3' ? 3 : null;
  const fundamental = c / (2 * L);
  const modeFreq = modeNumber !== null ? (modeNumber * c) / (2 * L) : null;

  const INIT_OPTS: { id: InitId; label: string; blurb: string }[] = [
    { id: 'pulse', label: 'Pulso', blurb: 'Gaussiano. Se parte en dos y rebota.' },
    { id: 'pluck', label: 'Pellizco', blurb: 'Triangular (púa de guitarra).' },
    { id: 'mode1', label: 'Modo 1', blurb: 'sin(πx/L) — fundamental.' },
    { id: 'mode2', label: 'Modo 2', blurb: 'sin(2πx/L) — 1er armónico.' },
    { id: 'mode3', label: 'Modo 3', blurb: 'sin(3πx/L) — 2do armónico.' },
  ];

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage
          captureMode
          bgColor="#05060A"
          cameraDistance={L * 1.15}
          bloomIntensity={0.6}
          bloomThreshold={0.5}
          autoRotate={false}
          enablePan
        >
          <CanvasCapture />
          <WaveScene
            c={c}
            boundary={boundary}
            init={init}
            seed={seed}
            onPeak={handlePeak}
          />
        </Stage>

        {/* HUD overlay (divs absolutos — NO drei Text) */}
        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div><span className="text-[#FDB813]">━</span> u(x,t) — la cuerda</div>
          <div>
            <span style={{ color: boundary === 'fixed' ? '#EF5350' : '#34D399' }}>●</span>{' '}
            borde {boundary === 'fixed' ? 'fijo (Dirichlet)' : 'libre (Neumann)'}
          </div>
          <div className="text-[#94A3B8] mt-1">
            C = c·Δt/Δx = <span className={cflStable ? 'text-[#34D399]' : 'text-[#EF5350]'}>{courant.toFixed(3)}</span>
          </div>
        </div>

        {/* Alerta de explosión CFL */}
        {exploded && (
          <div className="absolute bottom-3 left-3 right-3 text-[11px] text-[#EF5350]
                          bg-[#EF5350]/10 backdrop-blur px-3 py-2 rounded border border-[#EF5350]/40 leading-snug">
            ⚠ Inestabilidad CFL: C = {courant.toFixed(3)} &gt; 1. El esquema explotó (|u| → ∞).
            Baja c o presiona reiniciar.
          </div>
        )}
      </div>

      <LessonPanel<WaveLessonState>
        lesson={LESSON}
        onApplyState={(patch) => {
          let changedIC = false;
          if (patch.c !== undefined) setC(patch.c);
          if (patch.boundary !== undefined) { setBoundary(patch.boundary); changedIC = true; }
          if (patch.init !== undefined) { setInit(patch.init); changedIC = true; }
          if (changedIC) reseed();
        }}
        sandbox={
          <>
            {/* Velocidad c con frontera CFL marcada */}
            <div>
              <label className="block text-[11px] text-[#94A3B8]">
                velocidad c = <span className="text-[#FDB813] font-mono">{c.toFixed(2)}</span>
                <input
                  type="range"
                  min={0.2}
                  max={(C_CFL * 1.25).toFixed(2)}
                  step={0.02}
                  value={c}
                  onChange={(e) => setC(parseFloat(e.target.value))}
                  className="w-full accent-[#FDB813]"
                />
              </label>
              <div className="flex justify-between text-[10px] font-mono mt-0.5">
                <span className="text-[#64748B]">estable</span>
                <span className={cflStable ? 'text-[#34D399]' : 'text-[#EF5350]'}>
                  C = {courant.toFixed(3)} {cflStable ? '≤ 1 ✓' : '> 1 ✗ explota'}
                </span>
              </div>
              <div className="text-[10px] text-[#64748B] mt-0.5">
                frontera CFL en c = {C_CFL.toFixed(2)} (donde C = 1)
              </div>
            </div>

            {/* Selector de borde */}
            <div className="border-t border-[#1E293B] pt-3">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Borde</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(['fixed', 'free'] as BoundaryId[]).map((b) => (
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
              <div className="text-[10px] text-[#64748B] mt-1 leading-snug">
                {boundary === 'fixed'
                  ? 'u=0 en los extremos. La onda rebota INVERTIDA.'
                  : '∂u/∂x=0 en los extremos. La onda rebota SIN invertir.'}
              </div>
            </div>

            {/* Condición inicial */}
            <div className="border-t border-[#1E293B] pt-3">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Condición inicial</div>
              <div className="grid grid-cols-1 gap-1">
                {INIT_OPTS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => { setInit(opt.id); reseed(); }}
                    className={`text-left text-[11px] px-2 py-1.5 rounded border transition ${
                      init === opt.id
                        ? 'bg-[#4FC3F7]/15 border-[#4FC3F7]/50 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#4FC3F7]/30'
                    }`}
                  >
                    <div className="font-semibold">{opt.label}</div>
                    <div className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{opt.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Botón pluck / reiniciar */}
            <div className="border-t border-[#1E293B] pt-3">
              <button
                onClick={reseed}
                className="w-full text-[11px] px-2 py-1.5 rounded border border-[#FDB813]/40 bg-[#FDB813]/10 text-[#FDB813] hover:bg-[#FDB813]/20"
              >
                ↻ Pellizcar / reiniciar onda
              </button>
            </div>

            {/* Lecturas en vivo */}
            <div className="border-t border-[#1E293B] pt-3 space-y-1 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Δx</span>
                <span className="text-white">{DX.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Δt</span>
                <span className="text-white">{DT.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Courant C</span>
                <span className={cflStable ? 'text-[#34D399]' : 'text-[#EF5350]'}>{courant.toFixed(4)}</span>
              </div>
              <div className="flex justify-between border-t border-[#1E293B] pt-1 mt-1">
                <span className="text-[#94A3B8]">f₁ = c/2L</span>
                <span className="text-[#FDB813]">{fundamental.toFixed(4)}</span>
              </div>
              {modeFreq !== null && (
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">f_{modeNumber} = {modeNumber}c/2L</span>
                  <span className="text-[#FDB813]">{modeFreq.toFixed(4)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">pico |u|</span>
                <span className={exploded ? 'text-[#EF5350]' : 'text-[#94A3B8]'}>
                  {exploded ? '∞ (inestable)' : peak.toFixed(3)}
                </span>
              </div>
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                FDTD leapfrog: u^{'{n+1}'} = 2u^n − u^{'{n-1}'} + C²·∂²ₓu. Orden 2 en x y t.
                Estabilidad von Neumann ⇒ CFL C ≤ 1. Neumann via nodos fantasma; Dirichlet clava extremos.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
