/**
 * Cadenas de Markov — estados, matriz de transición y distribución estacionaria.
 *
 *   π_{n+1} = π_n · P
 *
 * P es una matriz ESTOCÁSTICA por filas: P[i][j] = probabilidad de ir del
 * estado i al estado j, y cada fila suma exactamente 1. Una cadena de Markov
 * "no tiene memoria": el próximo estado depende SOLO del estado actual, no de
 * cómo llegaste ahí (propiedad de Markov).
 *
 * El método REAL implementado aquí es la ITERACIÓN DE POTENCIAS sobre el vector
 * de distribución: arrancamos con una distribución inicial π₀ (toda la masa en
 * un estado) y multiplicamos repetidamente por P. Si la cadena es ergódica
 * (irreducible + aperiódica), π_n converge a la ÚNICA distribución estacionaria
 * π que satisface
 *
 *   π · P = π        (π es el eigenvector izquierdo de P con eigenvalor 1)
 *   Σ π_i = 1
 *
 * Esto es exactamente el corazón de PageRank: la "importancia" de una página es
 * su probabilidad estacionaria en la caminata aleatoria del navegante sobre el
 * grafo de enlaces. Aquí calculamos esa π por dos caminos y los comparamos:
 *
 *   1) Iteración de potencias (lo que se ANIMA cuadro a cuadro).
 *   2) Resolución directa del sistema (πP = π, Σπ=1) por eliminación
 *      gaussiana — la "verdad" hacia la que la iteración debe converger.
 *
 * Presets reales:
 *   • clima      — soleado / nublado / lluvia (cadena clásica de meteorología).
 *   • randomwalk — caminata sobre un anillo de 5 nodos (mezcla uniforme).
 *   • pagerank   — mini-web de 5 páginas con enlaces dirigidos + teletransporte
 *                  (factor de amortiguación d = 0.85, como el paper de Brin-Page).
 */

import { useMemo, useState, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import CanvasCapture from '@/math/components/CanvasCapture';

// ── Estado del módulo ──────────────────────────────────────────────────

interface MarkovState {
  presetId: string;
  autoIterate: boolean;
  showStationary: boolean;
}

// ── LESSON ─────────────────────────────────────────────────────────────

const LESSON: Lesson<MarkovState> = {
  hook: {
    title: 'Si solo sabes DÓNDE estás hoy, ¿puedes predecir el clima de siempre?',
    body: `Imagina un sistema que salta entre unos cuantos estados: hoy soleado, mañana lluvia, pasado nublado. La regla es simple y casi mágica: a dónde saltas depende SOLO de dónde estás ahora, no de toda tu historia. Eso es una cadena de Markov, y a esa amnesia se le llama "propiedad de Markov".

Toda la dinámica vive en una matriz P: la entrada P[i][j] es la probabilidad de pasar del estado i al estado j. Cada fila suma 1 (de algún lado tienes que salir). A esa matriz se le dice estocástica.

Andréi Márkov la inventó en 1906 para estudiar letras en la poesía de Pushkin. Hoy mueve mucho más: es el esqueleto de PageRank (cómo Google ordenó la web), del muestreo MCMC en estadística bayesiana y de medio aprendizaje por refuerzo.

En esta clase multiplicamos un vector por P una y otra vez y vemos cómo la distribución se OLVIDA de dónde empezó y se asienta en una única forma estable: la distribución estacionaria.`,
  },

  steps: [
    {
      title: 'El clima — tres estados y una matriz',
      duration: 5500,
      body: `Empezamos con el clima: tres estados (soleado, nublado, lluvia) y flechas con probabilidades entre ellos.

Mira el grafo: cada nodo es un estado, cada arista una transición con su peso. Si hoy está soleado, hay 70% de que mañana siga soleado, 20% de que se nuble y 10% de que llueva. Esa es una fila de P, y suma 1.

Las barras de abajo son la distribución actual π: dónde está la "masa de probabilidad" en este instante. Arranco con toda la masa en SOLEADO: π₀ = (1, 0, 0). Es decir, hoy sé con certeza que está soleado.

A partir de aquí, multiplicar por P avanza un día. La pregunta interesante no es mañana: es qué pasa dentro de mil días.`,
      formula: 'P[i][j] = P(estado j mañana | estado i hoy)\nΣⱼ P[i][j] = 1   (matriz estocástica por filas)\nπ₀ = (1, 0, 0)',
      keyframes: [
        { at: 0, state: { presetId: 'clima', autoIterate: false, showStationary: false } },
        { at: 1, state: { presetId: 'clima', autoIterate: false, showStationary: false } },
      ],
    },
    {
      title: 'Iteración de potencias — la masa se reparte',
      duration: 6000,
      body: `Ahora dale al play: cada paso multiplica el vector actual por la matriz, π_{n+1} = π_n · P.

Mira las barras moverse. La masa que estaba toda en "soleado" se filtra hacia "nublado" y "lluvia" siguiendo las flechas. En el segundo paso ya hay tres componentes vivas; cada componente nueva es un promedio ponderado de las anteriores por las columnas de P.

Esto NO es magia: es una multiplicación matriz-vector que ya conoces del álgebra lineal. π_n es una fila, P es la matriz, y el producto reparte la probabilidad de cada estado entre sus destinos.

Fíjate que, paso tras paso, las barras se mueven cada vez MENOS. La cadena está perdiendo memoria de su origen y acercándose a algo fijo.`,
      formula: 'π_{n+1} = π_n · P\n(π_{n+1})_j = Σᵢ (π_n)_i · P[i][j]',
      keyframes: [
        { at: 0, state: { presetId: 'clima', autoIterate: true, showStationary: false } },
        { at: 1, state: { presetId: 'clima', autoIterate: true, showStationary: false } },
      ],
    },
    {
      title: 'La distribución estacionaria — el punto fijo πP = π',
      duration: 6000,
      body: `Después de suficientes pasos, π_n deja de cambiar. Llegó a la distribución ESTACIONARIA π: el único vector que cumple π·P = π. Multiplicar por P ya no lo mueve.

Activo el contorno punteado: es la π exacta, resuelta directamente del sistema lineal (πP = π junto con Σπ = 1, por eliminación gaussiana). La iteración de potencias cae justo encima — dos caminos a la misma respuesta.

En lenguaje de álgebra lineal, π es el eigenvector izquierdo de P con eigenvalor 1. El teorema de Perron-Frobenius garantiza que para una cadena ergódica ese eigenvalor 1 es simple y su eigenvector es positivo: existe UNA sola estacionaria.

Para el clima esto dice algo concreto: a largo plazo, sin importar el clima de hoy, la fracción de días soleados, nublados y lluviosos tiende a estos números fijos. El clima "olvida" su condición inicial.`,
      formula: 'π · P = π,   Σ π_i = 1\nπ = eigenvector izquierdo de P (λ = 1)\nPerron-Frobenius: única y positiva si ergódica',
      keyframes: [
        { at: 0, state: { presetId: 'clima', autoIterate: true, showStationary: true } },
        { at: 1, state: { presetId: 'clima', autoIterate: true, showStationary: true } },
      ],
    },
    {
      title: 'Caminata aleatoria — el anillo se mezcla a uniforme',
      duration: 5500,
      body: `Cambio a una caminata aleatoria sobre un anillo de cinco nodos: desde cada nodo saltas al de la izquierda o al de la derecha con probabilidad 1/2.

Mira: arranco con toda la masa en un nodo, y la iteración la dispersa por el anillo como una onda que da la vuelta. Como todos los nodos son simétricos (cada uno tiene el mismo grado), la estacionaria es UNIFORME: π = (1/5, 1/5, 1/5, 1/5, 1/5).

Esto es clave en estadística computacional: si diseñas una cadena cuya estacionaria es la distribución que quieres muestrear, basta con caminar mucho rato y los estados visitados son muestras de esa distribución. Ese es el truco de Metropolis-Hastings y de todo MCMC.

La velocidad a la que se mezcla la controla el segundo eigenvalor de P: cuanto más chico en magnitud, más rápido se olvida el origen.`,
      formula: 'anillo: P[i][i±1] = 1/2\ngrado constante ⇒ π = uniforme = (1/n,…,1/n)\nvelocidad de mezcla ∝ 1 − |λ₂|',
      keyframes: [
        { at: 0, state: { presetId: 'randomwalk', autoIterate: true, showStationary: true } },
        { at: 1, state: { presetId: 'randomwalk', autoIterate: true, showStationary: true } },
      ],
    },
    {
      title: 'PageRank — la web como cadena de Markov',
      duration: 6500,
      body: `Último preset: una mini-web de cinco páginas con enlaces dirigidos. Imagina un navegante que, en cada página, hace clic en un enlace al azar. Esa caminata es una cadena de Markov, y su estacionaria es el PageRank: la importancia de cada página.

Hay un problema: páginas sin salida o ciclos cerrados atraparían al navegante. Brin y Page lo arreglaron con TELETRANSPORTE: con probabilidad d = 0.85 sigue un enlace, y con 1 − d = 0.15 salta a una página cualquiera. Eso vuelve la cadena ergódica y garantiza una estacionaria única.

La matriz de Google es entonces P = d·(matriz de enlaces) + (1−d)·(1/n)·(todos-unos). Mira las barras: las páginas más enlazadas — y enlazadas por páginas importantes — acumulan más masa estacionaria. La importancia es recursiva: eres importante si te enlazan los importantes.

Eso es literalmente cómo Google ordenó la web en 1998. El PageRank de una página es su probabilidad estacionaria en esta caminata.`,
      formula: 'G = d·M + (1−d)·(1/n)·𝟙𝟙ᵀ,   d = 0.85\nM[i][j] = 1/(enlaces de salida de i)\nPageRank = π estacionaria de G',
      keyframes: [
        { at: 0, state: { presetId: 'pagerank', autoIterate: true, showStationary: true } },
        { at: 1, state: { presetId: 'pagerank', autoIterate: true, showStationary: true } },
      ],
    },
  ],

  connect: {
    body: `Acabas de ver el mecanismo central de las cadenas de Markov: multiplicar por una matriz estocástica hasta que la distribución se olvida de su origen y se asienta en la estacionaria π, el eigenvector con eigenvalor 1.

La misma matemática aparece en todas partes:
• PageRank — Google ordenó la web con la estacionaria de la caminata del navegante.
• MCMC (Metropolis-Hastings, Gibbs) — muestrear distribuciones imposibles construyendo una cadena cuya estacionaria es la que quieres.
• Modelos ocultos de Markov (HMM) — reconocimiento de voz, alineamiento de genes, etiquetado de texto.
• Aprendizaje por refuerzo — los procesos de decisión de Markov (MDP) son cadenas con recompensas.
• Colas y confiabilidad — cuánto tiempo pasa un servidor ocupado, cuándo falla una máquina.

La pregunta de "cuándo existe una única π" la responde Perron-Frobenius; la de "qué tan rápido se llega" la responde el segundo eigenvalor (el gap espectral). Y todo se reduce a una idea que ya tienes: ver una matriz a través de sus eigenvectores.`,
    links: [
      { label: 'Eigenvectores — π es el eigenvector con λ=1', href: '#eigen-3d' },
      { label: 'Matrix 3D — P como transformación lineal', href: '#matrix-3d' },
      { label: 'Teorema del límite central — el otro gran "se olvida del origen"', href: '#central-limit' },
    ],
  },
};

// ── Modelo: matrices de transición REALES por preset ────────────────────

interface Preset {
  id: string;
  label: string;
  blurb: string;
  states: string[];
  /** Matriz estocástica por filas. P[i][j] = P(i→j). Σⱼ P[i][j] = 1. */
  P: number[][];
  /** Posiciones 3D de los nodos (layout fijo, legible). */
  layout: [number, number, number][];
  /** Estado inicial: índice donde arranca toda la masa. */
  start: number;
}

// Layout circular de n nodos sobre el plano z=0 (radio r).
function ring(n: number, r: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    out.push([r * Math.cos(a), r * Math.sin(a), 0]);
  }
  return out;
}

// ── PageRank: construir la matriz de Google a partir de los enlaces ─────

// Lista de adyacencia dirigida de la mini-web (i → [destinos]).
const WEB_LINKS: number[][] = [
  [1, 2],     // A enlaza a B, C
  [2],        // B enlaza a C
  [0, 3],     // C enlaza a A, D
  [0, 1, 4],  // D enlaza a A, B, E
  [3],        // E enlaza a D
];

function buildGoogleMatrix(links: number[][], d = 0.85): number[][] {
  const n = links.length;
  const teleport = (1 - d) / n;
  const P: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row = new Array<number>(n).fill(teleport);
    const outs = links[i];
    if (outs.length === 0) {
      // Nodo sumidero: enlaza uniformemente a todos (parche estándar de PageRank).
      for (let j = 0; j < n; j++) row[j] += d / n;
    } else {
      const w = d / outs.length;
      for (const j of outs) row[j] += w;
    }
    P[i] = row;
  }
  return P;
}

const PRESETS: Preset[] = [
  {
    id: 'clima',
    label: 'Clima',
    blurb: 'Soleado / nublado / lluvia. Cadena meteorológica clásica de 3 estados.',
    states: ['Soleado', 'Nublado', 'Lluvia'],
    // Filas suman 1. Mañana | hoy.
    P: [
      [0.70, 0.20, 0.10],
      [0.30, 0.40, 0.30],
      [0.20, 0.45, 0.35],
    ],
    layout: ring(3, 2.0),
    start: 0,
  },
  {
    id: 'randomwalk',
    label: 'Caminata en anillo',
    blurb: 'Anillo de 5 nodos: salto a izquierda/derecha con prob. 1/2. Estacionaria uniforme.',
    states: ['n0', 'n1', 'n2', 'n3', 'n4'],
    P: (() => {
      const n = 5;
      const P: number[][] = [];
      for (let i = 0; i < n; i++) {
        const row = new Array<number>(n).fill(0);
        row[(i + 1) % n] = 0.5;
        row[(i - 1 + n) % n] = 0.5;
        P.push(row);
      }
      return P;
    })(),
    layout: ring(5, 2.2),
    start: 0,
  },
  {
    id: 'pagerank',
    label: 'PageRank (mini-web)',
    blurb: 'Web de 5 páginas + teletransporte d=0.85. La estacionaria ES el PageRank.',
    states: ['A', 'B', 'C', 'D', 'E'],
    P: buildGoogleMatrix(WEB_LINKS, 0.85),
    layout: ring(5, 2.2),
    start: 0,
  },
];

// ── Álgebra real ────────────────────────────────────────────────────────

// Un paso de iteración de potencias: fila × matriz → fila. π' = π·P.
function stepDistribution(pi: number[], P: number[][]): number[] {
  const n = pi.length;
  const out = new Array<number>(n).fill(0);
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += pi[i] * P[i][j];
    out[j] = s;
  }
  return out;
}

// Distancia L1 entre dos distribuciones (criterio de convergencia).
function l1(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s;
}

/**
 * Distribución estacionaria EXACTA resolviendo el sistema lineal:
 *   π (P − I) = 0,   Σ π = 1.
 * Equivale a (Pᵀ − I) πᵀ = 0 con la restricción de normalización. Reemplazamos
 * la última ecuación (redundante) por Σπ=1 y resolvemos A x = b por eliminación
 * gaussiana con pivoteo parcial. Es la "verdad" contra la que comparamos.
 */
function stationaryExact(P: number[][]): number[] {
  const n = P.length;
  // A = (Pᵀ − I); fila k de A·π = 0 significa Σᵢ (P[i][k] − δ_{ik}) π_i = 0.
  const A: number[][] = [];
  for (let k = 0; k < n; k++) {
    const row = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) row[i] = P[i][k] - (i === k ? 1 : 0);
    A.push(row);
  }
  // Reemplazar la última ecuación por Σπ = 1.
  const b = new Array<number>(n).fill(0);
  A[n - 1] = new Array<number>(n).fill(1);
  b[n - 1] = 1;

  return gaussianSolve(A, b);
}

// Eliminación gaussiana con pivoteo parcial. Resuelve A x = b (A es n×n).
function gaussianSolve(Ain: number[][], bin: number[]): number[] {
  const n = bin.length;
  const A = Ain.map((r) => r.slice());
  const b = bin.slice();
  for (let col = 0; col < n; col++) {
    // Pivoteo parcial.
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    }
    if (piv !== col) {
      [A[col], A[piv]] = [A[piv], A[col]];
      [b[col], b[piv]] = [b[piv], b[col]];
    }
    const d = A[col][col];
    if (Math.abs(d) < 1e-12) continue; // singular: dejamos que la normalización rescate
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col] / d;
      if (f === 0) continue;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const d = A[i][i];
    x[i] = Math.abs(d) < 1e-12 ? 0 : b[i] / d;
  }
  // Normalizar a probabilidad (por si acaso) y clamp de signos numéricos.
  let sum = 0;
  for (let i = 0; i < n; i++) { x[i] = Math.max(0, x[i]); sum += x[i]; }
  if (sum > 1e-12) for (let i = 0; i < n; i++) x[i] /= sum;
  return x;
}

// ── Estética ─────────────────────────────────────────────────────────────

const ACCENT = '#EF5350';   // acento de la rama probabilidad
const NODE_HOT = '#FDB813'; // masa alta
const NODE_COLD = '#1E3A8A';// masa baja
const STEP_MS = 700;        // ritmo de auto-iteración

// Interpola color frío→caliente según la masa del nodo.
function nodeColor(mass: number, maxMass: number): string {
  const t = maxMass > 1e-9 ? Math.max(0, Math.min(1, mass / maxMass)) : 0;
  const c = new THREE.Color(NODE_COLD).lerp(new THREE.Color(NODE_HOT), t);
  return `#${c.getHexString()}`;
}

// ── Componente ─────────────────────────────────────────────────────────

export default function Markov() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState('clima');
  const [autoIterate, setAutoIterate] = useState(false);
  const [showStationary, setShowStationary] = useState(false);

  const preset = useMemo(() => PRESETS.find((p) => p.id === presetId)!, [presetId]);
  const n = preset.states.length;

  // π exacta (resuelta directo del sistema lineal). Es la "verdad".
  const piStar = useMemo(() => stationaryExact(preset.P), [preset]);

  // Distribución viva. Re-arranca cuando cambia el preset.
  const [pi, setPi] = useState<number[]>(() => {
    const v = new Array<number>(n).fill(0);
    v[preset.start] = 1;
    return v;
  });
  const [iter, setIter] = useState(0);

  // Re-inicializa cuando cambia el preset.
  const resetKey = preset.id;
  useMemo(() => {
    const v = new Array<number>(preset.states.length).fill(0);
    v[preset.start] = 1;
    setPi(v);
    setIter(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const doStep = useCallback(() => {
    setPi((cur) => stepDistribution(cur, preset.P));
    setIter((k) => k + 1);
  }, [preset]);

  const reset = useCallback(() => {
    const v = new Array<number>(n).fill(0);
    v[preset.start] = 1;
    setPi(v);
    setIter(0);
  }, [n, preset.start]);

  // Auto-iteración a ritmo constante (independiente del frame rate).
  const accRef = useRef(0);
  const lastRef = useRef<number | null>(null);
  useFrame(() => {
    if (!autoIterate) { lastRef.current = null; return; }
    const now = performance.now();
    if (lastRef.current == null) { lastRef.current = now; return; }
    accRef.current += now - lastRef.current;
    lastRef.current = now;
    if (accRef.current >= STEP_MS) {
      accRef.current = 0;
      // Si ya convergió, paramos de "saltar" (evita ruido numérico infinito).
      setPi((cur) => {
        const nxt = stepDistribution(cur, preset.P);
        if (l1(cur, nxt) < 1e-9) return cur;
        return nxt;
      });
      setIter((k) => k + 1);
    }
  });

  const maxMass = Math.max(...pi, 1e-9);
  const residual = l1(pi, piStar);

  // Construir aristas dirigidas con peso (solo P[i][j] > umbral, para legibilidad).
  const edges = useMemo(() => {
    const out: { i: number; j: number; w: number; self: boolean }[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const w = preset.P[i][j];
        if (w < 0.02) continue;
        out.push({ i, j, w, self: i === j });
      }
    }
    return out;
  }, [preset, n]);

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={6.2} bloomIntensity={0.6} bloomThreshold={0.5} bgColor="#05060A" captureMode autoRotate={false}>
          <CanvasCapture />

          {/* Aristas dirigidas con peso (grosor ∝ probabilidad) */}
          {edges.map((e, k) => {
            const a = preset.layout[e.i];
            const b = preset.layout[e.j];
            if (e.self) {
              // Auto-lazo: pequeño anillo emisivo encima del nodo.
              return (
                <SelfLoop key={`s${k}`} center={a} weight={e.w} />
              );
            }
            return (
              <DirectedEdge key={`e${k}`} a={a} b={b} weight={e.w} />
            );
          })}

          {/* Nodos esféricos emisivos, color por masa de probabilidad */}
          {preset.layout.map((pos, i) => {
            const mass = pi[i] ?? 0;
            const col = nodeColor(mass, maxMass);
            const radius = 0.22 + 0.40 * (maxMass > 1e-9 ? mass / maxMass : 0);
            return (
              <group key={i} position={pos}>
                <mesh>
                  <sphereGeometry args={[radius, 32, 24]} />
                  <meshStandardMaterial
                    color={col}
                    emissive={col}
                    emissiveIntensity={0.6 + 1.6 * (maxMass > 1e-9 ? mass / maxMass : 0)}
                    toneMapped={false}
                  />
                </mesh>
                {/* Halo tenue para el bloom */}
                <mesh>
                  <sphereGeometry args={[radius * 1.5, 16, 12]} />
                  <meshBasicMaterial color={col} transparent opacity={0.12} toneMapped={false} />
                </mesh>
                {/* Etiqueta del estado + probabilidad actual (HUD 3D, no drei <Text>) */}
                <Html center distanceFactor={9} position={[0, radius + 0.55, 0]} prepend>
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    lineHeight: 1.25,
                    color: '#E2E8F0',
                    textAlign: 'center',
                    textShadow: '0 0 6px #000, 0 0 6px #000',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                  }}>
                    <div style={{ fontWeight: 700 }}>{preset.states[i]}</div>
                    <div style={{ color: NODE_HOT }}>{(mass * 100).toFixed(1)}%</div>
                  </div>
                </Html>
              </group>
            );
          })}

          {/* Barras de la distribución actual (π) — alturas proporcionales */}
          <DistributionBars
            pi={pi}
            piStar={piStar}
            states={preset.states}
            showStationary={showStationary}
            yBase={-3.0}
            width={4.6}
          />
        </Stage>

        {/* Leyenda HUD */}
        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div><span style={{ color: NODE_HOT }}>●</span> nodo = estado (color ∝ probabilidad)</div>
          <div><span style={{ color: ACCENT }}>→</span> transición (grosor ∝ peso)</div>
          <div><span className="text-[#38BDF8]">▮</span> distribución actual π</div>
          {showStationary && <div><span className="text-[#34D399]">┄</span> estacionaria π* (exacta)</div>}
        </div>

        {/* Lectura en vivo */}
        <div className="absolute bottom-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div className="flex justify-between gap-5">
            <span className="text-[#94A3B8]">paso n</span>
            <span className="text-white">{iter}</span>
          </div>
          <div className="flex justify-between gap-5">
            <span className="text-[#94A3B8]">Σπ</span>
            <span className="text-[#38BDF8]">{pi.reduce((a, b) => a + b, 0).toFixed(4)}</span>
          </div>
          <div className="flex justify-between gap-5">
            <span className="text-[#94A3B8]">‖π − π*‖₁</span>
            <span className={residual < 1e-3 ? 'text-[#34D399]' : 'text-[#F472B6]'}>{residual.toExponential(2)}</span>
          </div>
        </div>
      </div>

      <LessonPanel<MarkovState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.presetId !== undefined) setPresetId(patch.presetId);
          if (patch.autoIterate !== undefined) setAutoIterate(patch.autoIterate);
          if (patch.showStationary !== undefined) setShowStationary(patch.showStationary);
        }}
        sandbox={
          <>
            {/* Selector de cadena */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Cadena</div>
              <div className="grid grid-cols-1 gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPresetId(p.id)}
                    className={`text-left text-[11px] px-2 py-1.5 rounded border transition ${
                      presetId === p.id
                        ? 'bg-[#EF5350]/12 border-[#EF5350]/45 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#EF5350]/30'
                    }`}
                  >
                    <div className="font-semibold">{p.label}</div>
                    <div className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{p.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Controles de iteración */}
            <div className="border-t border-[#1E293B] pt-3 grid grid-cols-2 gap-1.5">
              <button
                onClick={doStep}
                className="text-[11px] px-2 py-1.5 rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#EF5350]/40 hover:text-[#EF5350]"
              >
                ▸ paso (π·P)
              </button>
              <button
                onClick={() => setAutoIterate((a) => !a)}
                className={`text-[11px] px-2 py-1.5 rounded border transition ${
                  autoIterate
                    ? 'bg-[#EF5350]/12 border-[#EF5350]/45 text-[#EF5350]'
                    : 'border-[#1E293B] text-[#94A3B8] hover:border-[#EF5350]/30'
                }`}
              >
                {autoIterate ? '⏸ auto' : '▶ auto-iterar'}
              </button>
              <button
                onClick={reset}
                className="text-[11px] px-2 py-1.5 rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#34D399]/40 hover:text-[#34D399]"
              >
                ↻ reiniciar π₀
              </button>
              <button
                onClick={() => setShowStationary((s) => !s)}
                className={`text-[11px] px-2 py-1.5 rounded border transition ${
                  showStationary
                    ? 'bg-[#34D399]/10 border-[#34D399]/40 text-[#34D399]'
                    : 'border-[#1E293B] text-[#94A3B8] hover:border-[#34D399]/30'
                }`}
              >
                {showStationary ? '✓ π* exacta' : 'mostrar π*'}
              </button>
            </div>

            {/* Matriz de transición P (renderizada real, no decorativa) */}
            <div className="border-t border-[#1E293B] pt-3">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Matriz P (filas suman 1)</div>
              <div className="overflow-x-auto">
                <table className="text-[10px] font-mono text-[#CBD5E1] border-collapse">
                  <thead>
                    <tr>
                      <th className="px-1 py-0.5 text-[#64748B]"></th>
                      {preset.states.map((s, j) => (
                        <th key={j} className="px-1.5 py-0.5 text-[#94A3B8] text-right">{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preset.P.map((row, i) => (
                      <tr key={i}>
                        <td className="px-1 py-0.5 text-[#94A3B8]">{preset.states[i]}</td>
                        {row.map((v, j) => (
                          <td
                            key={j}
                            className="px-1.5 py-0.5 text-right"
                            style={{ color: v > 0.001 ? `rgba(239,83,80,${0.45 + 0.55 * Math.min(1, v)})` : '#334155' }}
                          >
                            {v.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Distribución actual vs estacionaria */}
            <div className="border-t border-[#1E293B] pt-3 space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B]">π actual (paso {iter})</div>
              {pi.map((v, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[#94A3B8]">{preset.states[i]}</span>
                    <span className="text-white">{(v * 100).toFixed(2)}%</span>
                    <span className="text-[#34D399]">π*={(piStar[i] * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-[#1E293B] rounded-full overflow-hidden relative">
                    <div className="h-full rounded-full transition-all duration-300"
                         style={{ width: `${Math.min(100, v * 100)}%`, background: '#38BDF8' }} />
                    {/* marca de la estacionaria exacta */}
                    <div className="absolute top-0 h-full w-[2px] bg-[#34D399]"
                         style={{ left: `${Math.min(100, piStar[i] * 100)}%` }} />
                  </div>
                </div>
              ))}
              <div className="text-[10px] text-[#64748B] mt-1 leading-snug">
                Residual ‖π − π*‖₁ = <span className="text-[#F472B6]">{residual.toExponential(2)}</span>. Auto-iterar hasta que caiga a ~0.
              </div>
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                π* resuelta exacto: (Pᵀ − I)πᵀ = 0 con Σπ = 1 por eliminación gaussiana. Iteración de potencias π_{'{n+1}'} = π_n P converge a esa π* a tasa |λ₂|ⁿ (gap espectral). Perron-Frobenius garantiza unicidad si la cadena es ergódica.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}

// ── Sub-componentes de escena ────────────────────────────────────────────

// Arista dirigida a→b con grosor ∝ peso y punta de flecha (cono emisivo).
function DirectedEdge({ a, b, weight }: { a: [number, number, number]; b: [number, number, number]; weight: number }) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(vb, va);
  const len = dir.length();
  if (len < 1e-6) return null;
  dir.normalize();

  const nodeR = 0.30; // dejar aire alrededor de los nodos
  const start = new THREE.Vector3().copy(va).addScaledVector(dir, nodeR);
  const end = new THREE.Vector3().copy(vb).addScaledVector(dir, -(nodeR + 0.18));

  // Curvar levemente para distinguir i→j de j→i (offset perpendicular en el plano).
  const perp = new THREE.Vector3(-dir.y, dir.x, 0).multiplyScalar(0.18);
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5).add(perp);
  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  const pts = curve.getPoints(20).map((p) => [p.x, p.y, p.z] as [number, number, number]);

  // Punta de flecha: orientar un cono según la tangente final de la curva.
  const tip = end;
  const tangent = curve.getTangent(1).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);

  const lineW = 0.8 + weight * 4.5;
  const op = 0.30 + 0.55 * Math.min(1, weight);

  return (
    <group>
      <Line points={pts} color={ACCENT} lineWidth={lineW} transparent opacity={op} toneMapped={false} />
      <mesh position={[tip.x, tip.y, tip.z]} quaternion={quat}>
        <coneGeometry args={[0.07 + weight * 0.05, 0.20, 12]} />
        <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={1.1} toneMapped={false} />
      </mesh>
    </group>
  );
}

// Auto-lazo: un toroide pequeño que cuelga del nodo (transición i→i).
function SelfLoop({ center, weight }: { center: [number, number, number]; weight: number }) {
  const r = 0.55 + weight * 0.25;
  // Colocar el lazo radialmente hacia afuera del origen.
  const c = new THREE.Vector3(...center);
  const outward = c.clone().normalize();
  if (outward.lengthSq() < 1e-9) outward.set(0, 1, 0);
  const pos = c.clone().addScaledVector(outward, 0.35 + r * 0.6);
  return (
    <mesh position={[pos.x, pos.y, pos.z]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[r * 0.5, 0.03 + weight * 0.04, 12, 32]} />
      <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={0.9} transparent opacity={0.35 + 0.5 * weight} toneMapped={false} />
    </mesh>
  );
}

// Barras 3D de la distribución actual + marcas de la estacionaria exacta.
function DistributionBars({
  pi, piStar, states, showStationary, yBase, width,
}: {
  pi: number[];
  piStar: number[];
  states: string[];
  showStationary: boolean;
  yBase: number;
  width: number;
}) {
  const n = pi.length;
  const slot = width / n;
  const barW = slot * 0.5;
  const maxH = 2.4; // altura de una barra al 100%
  const x0 = -width / 2 + slot / 2;

  return (
    <group position={[0, yBase, 0]}>
      {/* Eje base */}
      <Line
        points={[[-width / 2 - 0.2, 0, 0], [width / 2 + 0.2, 0, 0]]}
        color="#334155"
        lineWidth={1.2}
      />
      {pi.map((v, i) => {
        const x = x0 + i * slot;
        const h = Math.max(0.002, v * maxH);
        const hStar = Math.max(0.002, (piStar[i] ?? 0) * maxH);
        return (
          <group key={i} position={[x, 0, 0]}>
            {/* Barra de la distribución actual */}
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[barW, h, barW]} />
              <meshStandardMaterial color="#38BDF8" emissive="#0EA5E9" emissiveIntensity={0.9} toneMapped={false} />
            </mesh>
            {/* Marca de la estacionaria exacta: alambre verde a la altura de π* */}
            {showStationary && (
              <Line
                points={[
                  [-barW * 0.75, hStar, 0],
                  [barW * 0.75, hStar, 0],
                ]}
                color="#34D399"
                lineWidth={2.4}
                toneMapped={false}
              />
            )}
            {/* Etiqueta del estado bajo la barra */}
            <Html center distanceFactor={9} position={[0, -0.32, 0]} prepend>
              <div style={{
                fontFamily: 'monospace',
                fontSize: 10,
                color: '#94A3B8',
                textShadow: '0 0 5px #000',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}>
                {states[i]}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
