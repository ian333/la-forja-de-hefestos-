/**
 * Ecuación del Calor — difusión 2D en una placa metálica.
 *
 *   ∂u/∂t = α (∂²u/∂x² + ∂²u/∂y²)   — el Laplaciano en 2D
 *
 * Método REAL: Crank-Nicolson por splitting dimensional (operador splitting).
 * En cada paso de tiempo hacemos dos medios pasos CN:
 *   1. CN implícito en x (tridiagonal por cada fila)
 *   2. CN implícito en y (tridiagonal por cada columna)
 * Esto da orden 2 en tiempo y espacio, e incondicionalmente estable en 2D.
 * Alias: esquema ADI (Alternating Direction Implicit) de Peaceman-Rachford (1955).
 *
 * Visualización 3D cine R3F:
 *   - Placa cuadrada NxN extruida como InstancedMesh de voxeles planos.
 *   - Color = mapa de calor (azul→rojo→amarillo) + emisivo → bloom.
 *   - Escala Y de cada voxel = temperatura (la placa "se levanta" en caliente).
 *   - Fondo negro, cámara que rota lentamente: pura contemplación.
 *   - HUD con t, α, ∫u dA y número de Fourier (r = αΔt/Δx²).
 *
 * Condiciones de frontera:
 *   - Dirichlet: bordes fijos a 0 (baño frío).
 *   - Neumann: bordes aislados (flujo nulo, nodo fantasma).
 *
 * Ref: Peaceman & Rachford, J. Soc. Ind. Appl. Math. 3, 28 (1955).
 */

import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

// ── Estado del módulo ──────────────────────────────────────────────────

type ICId = 'pulse' | 'ring' | 'stripe' | 'twin';
type BCId = 'dirichlet' | 'neumann';

interface HeatState {
  alpha: number;
  icId: ICId;
  bcId: BCId;
}

// ── LESSON ─────────────────────────────────────────────────────────────

const LESSON: Lesson<HeatState> = {
  hook: {
    title: 'Un punto caliente en una placa metálica. ¿Cómo se reparte el calor?',
    body: `Imagina que tocas con la punta de un soldador el centro de una placa de cobre. En ese punto, la temperatura sube al instante. El resto de la placa está fría.

¿Qué pasa después? La ecuación que escribió Joseph Fourier en 1822 lo dice todo:

  ∂u/∂t = α (∂²u/∂x² + ∂²u/∂y²)

El calor fluye de lo caliente a lo frío con una velocidad proporcional a la CURVATURA del perfil de temperatura — la segunda derivada en ambas direcciones, es decir, el Laplaciano.

Donde la temperatura forma una "joroba", la joroba se hunde. Donde hay un "hueco", el hueco se llena. El calor no es una substancia que viaja — es información sobre la diferencia con los vecinos, que se propaga y borra gradientes.

Esta clase resuelve esa ecuación en 2D con el método ADI de Peaceman-Rachford (1955): Crank-Nicolson alternado por dirección. Incondicionalmente estable. Ves el calor difundirse cuadro a cuadro, en cine.`,
  },

  steps: [
    {
      title: 'Pulso central — la joroba que se aplasta',
      duration: 6000,
      body: `Arrancamos con una gaussiana angosta en el centro de la placa — un pulso de calor concentrado.

La curvatura del pulso es ENORME: positiva en el borde, negativa en la cresta. La ecuación del calor lee esa curvatura y la convierte en velocidad de cambio: ∂u/∂t = α · ∇²u.

En los primeros instantes, la difusión es FURIOSAMENTE rápida. El pulso se aplasta, se ensancha. La temperatura máxima cae como 1/(4παt) — una ley de potencias.

Con Dirichlet (bordes a 0), el calor se escapa por los bordes y la placa termina fría. Con Neumann (bordes aislados), el calor se redistribuye hasta quedar uniforme.`,
      formula: 'u₀(x,y) = exp(−((x−x₀)²+(y−y₀)²)/2σ²)\nu_max(t) ∝ 1/(4παt)  (solución fundamental)',
      keyframes: [
        { at: 0, state: { icId: 'pulse', bcId: 'dirichlet', alpha: 0.6 } },
        { at: 1, state: { icId: 'pulse', bcId: 'dirichlet', alpha: 0.6 } },
      ],
    },
    {
      title: 'ADI de Peaceman-Rachford — implícito en dos dimensiones',
      duration: 6500,
      body: `¿Cómo resolvemos en 2D sin explotar? Usar un solo paso CN 2D requeriría invertir una matriz pentadiagonal de N²×N² — prohibitivamente costoso.

Peaceman y Rachford (1955) encontraron el truco: SPLITTING. Cada paso Δt se divide en dos medios pasos:

1. Medio paso CN implícito en x, explícito en y (una tridiagonal por cada fila).
2. Medio paso CN implícito en y, explícito en x (una tridiagonal por cada columna).

Cada tridiagonal se resuelve con el algoritmo de Thomas en O(N). El esquema completo cuesta O(N²) por paso de tiempo — óptimo para una malla N×N.

El resultado: orden 2 en tiempo y espacio, incondicionalmente estable para cualquier α o Δt. El número de Fourier r = αΔt/Δx² puede ser >> 1.`,
      formula: '½-paso x: −r/2·u_{i-1,j} + (1+r)·u_{i,j} − r/2·u_{i+1,j} = RHS\n½-paso y: idem en j\nr = α Δt/Δx²  (estable ∀ r)',
      keyframes: [
        { at: 0, state: { icId: 'ring', bcId: 'dirichlet', alpha: 0.8 } },
        { at: 1, state: { icId: 'ring', bcId: 'dirichlet', alpha: 0.8 } },
      ],
    },
    {
      title: 'Dirichlet vs Neumann — el destino lo fijan las fronteras',
      duration: 6000,
      body: `Las condiciones de frontera son tan importantes como la ecuación misma — deciden el destino del sistema.

DIRICHLET: los bordes están fijos a u=0, en contacto con un baño frío. El calor se drena por los bordes. El área bajo la superficie cae a cero: toda la energía térmica sale.

NEUMANN: los bordes están aislados (flujo nulo: ∂u/∂n = 0). El calor no puede salir. La placa se equilibra en la temperatura promedio inicial: energía térmica conservada.

Misma ecuación, mismo perfil inicial, mismo α. Solo cambia la frontera — y el destino es completamente distinto. La física está en la ecuación, la solución está en las fronteras.`,
      formula: 'Dirichlet: u=0 en ∂Ω         → ∫∫u dA → 0\nNeumann:  ∂u/∂n=0 en ∂Ω     → ∫∫u dA = cte',
      keyframes: [
        { at: 0, state: { icId: 'stripe', bcId: 'neumann', alpha: 0.7 } },
        { at: 1, state: { icId: 'stripe', bcId: 'neumann', alpha: 0.7 } },
      ],
    },
    {
      title: 'Dos focos — fusión y modos de Fourier 2D',
      duration: 6000,
      body: `Ponemos dos pulsos gaussianos separados. En los primeros instantes, cada uno difunde INDEPENDIENTEMENTE — no se "sienten" todavía porque la temperatura entre ellos sigue siendo cero.

Luego las halos se tocan, se suman, y los dos focos se funden en una sola joroba que se aplana lentamente.

En el lenguaje de Fourier 2D, la condición inicial se descompone en modos sin(kπx/L)sin(lπy/L). Cada modo (k,l) decae como exp(−α(k²+l²)(π/L)²t). Los modos de alta frecuencia mueren primero — las arrugas finas desaparecen casi al instante. Lo que queda es el modo (1,1), la joroba más suave.`,
      formula: 'u(x,y,t) = Σ_{k,l} b_{kl} sin(kπx/L)sin(lπy/L)\n           × exp(−α(k²+l²)(π/L)²t)\ntasa ∝ k²+l²  (modos altos mueren primero)',
      keyframes: [
        { at: 0, state: { icId: 'twin', bcId: 'dirichlet', alpha: 0.5 } },
        { at: 1, state: { icId: 'twin', bcId: 'dirichlet', alpha: 0.5 } },
      ],
    },
  ],

  connect: {
    body: `La ecuación del calor 2D es el laplaciano en acción — el operador más universal de la física matemática.

La MISMA matemática governa fenómenos aparentemente sin relación:
• Difusión de tinta en papel (segunda ley de Fick)
• Black-Scholes en finanzas (es la ecuación del calor con cambio de variable)
• El kernel gaussiano del desenfoque de imágenes (difuminar = difundir calor)
• El paso "forward" de los modelos de difusión generativa (DALL-E, Stable Diffusion)
• Conducción eléctrica en semiconductores

El ADI de Peaceman-Rachford fue el primer método implícito práctico para EDPs 2D, y abrió la era de la simulación numérica moderna (1955 — cuatro años antes de los primeros satélites).

Y el "truco" de Fourier — descomponer en modos que decaen solos — es la diagonalización del operador Laplaciano. Los senos son sus eigenfunciones, y k²+l² son sus eigenvalores.`,
    links: [
      { label: 'Ecuación del calor 1D — Crank-Nicolson puro', href: '/math.html#heat-1d' },
      { label: 'Ising 2D — transición de fase térmica', href: '#ising-2d' },
      { label: 'Gases ideales — termodinámica cinética', href: '#ideal-gas' },
    ],
  },
};

// ── Discretización ─────────────────────────────────────────────────────

/** Número de nodos por lado (incluyendo frontera): índices 0..M */
const M = 60;
const L = 1.0;
const DX = L / M;
const DT = 0.0006;
const STEPS_PER_FRAME = 3;

// Condiciones iniciales — placa cuadrada [0,L]×[0,L]
function initialField(icId: ICId): Float64Array {
  const u = new Float64Array((M + 1) * (M + 1));
  const idx = (i: number, j: number) => i * (M + 1) + j;

  for (let i = 0; i <= M; i++) {
    for (let j = 0; j <= M; j++) {
      const x = i * DX;
      const y = j * DX;
      let v = 0;
      if (icId === 'pulse') {
        const s = 0.06;
        v = Math.exp(-((x - 0.5) ** 2 + (y - 0.5) ** 2) / (2 * s * s));
      } else if (icId === 'ring') {
        const r = Math.sqrt((x - 0.5) ** 2 + (y - 0.5) ** 2);
        const s = 0.04;
        v = Math.exp(-((r - 0.25) ** 2) / (2 * s * s));
      } else if (icId === 'stripe') {
        const s = 0.07;
        v = Math.exp(-((y - 0.5) ** 2) / (2 * s * s));
      } else {
        // twin
        const s = 0.055;
        v =
          Math.exp(-((x - 0.3) ** 2 + (y - 0.3) ** 2) / (2 * s * s)) +
          Math.exp(-((x - 0.7) ** 2 + (y - 0.7) ** 2) / (2 * s * s));
      }
      u[idx(i, j)] = Math.min(v, 1.0);
    }
  }
  return u;
}

// ── Algoritmo de Thomas (tridiagonal) ──────────────────────────────────

function thomas(a: Float64Array, b: Float64Array, c: Float64Array, d: Float64Array): Float64Array {
  const n = b.length;
  const cp = new Float64Array(n);
  const dp = new Float64Array(n);
  cp[0] = c[0] / b[0];
  dp[0] = d[0] / b[0];
  for (let i = 1; i < n; i++) {
    const m = b[i] - a[i] * cp[i - 1];
    cp[i] = c[i] / m;
    dp[i] = (d[i] - a[i] * dp[i - 1]) / m;
  }
  const x = new Float64Array(n);
  x[n - 1] = dp[n - 1];
  for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
  return x;
}

// ── Un paso ADI completo ────────────────────────────────────────────────
// Peaceman-Rachford 1955: dos semi-pasos CN, cada uno resuelve tridiagonales
// independientes por filas (x) y columnas (y).

function adiStep(u: Float64Array, alpha: number, bc: BCId): Float64Array {
  const Np = M + 1;
  const r = (alpha * DT) / (DX * DX);
  const rh = r / 2;

  // u* = semi-paso en x
  const uh = new Float64Array(Np * Np);

  // --- Semi-paso 1: implícito en x, explícito en y ---
  const a = new Float64Array(Np);
  const bv = new Float64Array(Np);
  const cv = new Float64Array(Np);
  const d = new Float64Array(Np);

  for (let j = 0; j <= M; j++) {
    // Construir la tridiagonal para la fila j
    for (let i = 1; i < M; i++) {
      const uij = u[i * Np + j];
      const uj_plus  = j < M ? u[i * Np + j + 1] : (bc === 'neumann' ? u[i * Np + j - 1] : 0);
      const uj_minus = j > 0 ? u[i * Np + j - 1] : (bc === 'neumann' ? u[i * Np + j + 1] : 0);
      a[i]  = -rh;
      bv[i] = 1 + r;
      cv[i] = -rh;
      // RHS: CN explícito en y
      d[i] = rh * uj_minus + (1 - r) * uij + rh * uj_plus;
    }

    // Fronteras en x
    if (bc === 'dirichlet') {
      a[0] = 0; bv[0] = 1; cv[0] = 0; d[0] = 0;
      a[M] = 0; bv[M] = 1; cv[M] = 0; d[M] = 0;
    } else {
      // Neumann: u_x=0 → nodo fantasma u[-1]=u[1], u[M+1]=u[M-1]
      const u0j = u[0 * Np + j];
      const u1j = u[1 * Np + j];
      const uMj = u[M * Np + j];
      const uMm1j = u[(M - 1) * Np + j];
      const uj_p0 = j < M ? u[0 * Np + j + 1] : u[0 * Np + j - 1];
      const uj_m0 = j > 0 ? u[0 * Np + j - 1] : u[0 * Np + j + 1];
      const uj_pM = j < M ? u[M * Np + j + 1] : u[M * Np + j - 1];
      const uj_mM = j > 0 ? u[M * Np + j - 1] : u[M * Np + j + 1];
      a[0] = 0;  bv[0] = 1 + r;  cv[0] = -r;
      d[0] = (1 - r) * u0j + rh * uj_m0 + rh * uj_p0;
      a[M] = -r; bv[M] = 1 + r;  cv[M] = 0;
      d[M] = (1 - r) * uMj + rh * uj_mM + rh * uj_pM;
      // suppress unused
      void u1j; void uMm1j;
    }

    const sol = thomas(a, bv, cv, d);
    for (let i = 0; i <= M; i++) uh[i * Np + j] = sol[i];
  }

  // --- Semi-paso 2: implícito en y, explícito en x ---
  const unew = new Float64Array(Np * Np);

  for (let i = 0; i <= M; i++) {
    for (let j = 1; j < M; j++) {
      const uhij = uh[i * Np + j];
      const uhi_plus  = i < M ? uh[(i + 1) * Np + j] : (bc === 'neumann' ? uh[(i - 1) * Np + j] : 0);
      const uhi_minus = i > 0 ? uh[(i - 1) * Np + j] : (bc === 'neumann' ? uh[(i + 1) * Np + j] : 0);
      a[j]  = -rh;
      bv[j] = 1 + r;
      cv[j] = -rh;
      d[j] = rh * uhi_minus + (1 - r) * uhij + rh * uhi_plus;
    }

    if (bc === 'dirichlet') {
      a[0] = 0; bv[0] = 1; cv[0] = 0; d[0] = 0;
      a[M] = 0; bv[M] = 1; cv[M] = 0; d[M] = 0;
    } else {
      const uhi0 = uh[i * Np + 0];
      const uhiM = uh[i * Np + M];
      const uhi_m0 = i > 0 ? uh[(i - 1) * Np + 0] : uh[(i + 1) * Np + 0];
      const uhi_p0 = i < M ? uh[(i + 1) * Np + 0] : uh[(i - 1) * Np + 0];
      const uhi_mM = i > 0 ? uh[(i - 1) * Np + M] : uh[(i + 1) * Np + M];
      const uhi_pM = i < M ? uh[(i + 1) * Np + M] : uh[(i - 1) * Np + M];
      a[0] = 0;  bv[0] = 1 + r;  cv[0] = -r;
      d[0] = (1 - r) * uhi0 + rh * uhi_m0 + rh * uhi_p0;
      a[M] = -r; bv[M] = 1 + r;  cv[M] = 0;
      d[M] = (1 - r) * uhiM + rh * uhi_mM + rh * uhi_pM;
    }

    const sol = thomas(a, bv, cv, d);
    for (let j = 0; j <= M; j++) unew[i * Np + j] = sol[j];
  }

  return unew;
}

// ── Colormap caliente (azul → rojo → amarillo) ─────────────────────────

function hotRGB(v: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, v));
  if (t < 0.5) {
    const s = t / 0.5;
    return [lerp(0.04, 0.93, s), lerp(0.10, 0.27, s), lerp(0.50, 0.27, s)];
  }
  const s = (t - 0.5) / 0.5;
  return [lerp(0.93, 0.99, s), lerp(0.27, 0.87, s), lerp(0.27, 0.18, s)];
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// Integración ∫∫u dA (regla del trapecio 2D, proporcional al calor total)
function trapz2d(u: Float64Array): number {
  const Np = M + 1;
  let s = 0;
  for (let i = 0; i <= M; i++) {
    const wi = i === 0 || i === M ? 0.5 : 1.0;
    for (let j = 0; j <= M; j++) {
      const wj = j === 0 || j === M ? 0.5 : 1.0;
      s += wi * wj * u[i * Np + j];
    }
  }
  return s * DX * DX;
}

// ── Escena 3D ──────────────────────────────────────────────────────────

// Número de voxeles = (M+1)^2 — usamos InstancedMesh para eficiencia.
const N_INST = (M + 1) * (M + 1);

// Geometría base de un voxel: caja unitaria, luego escalamos por instancia.
const VOXEL_SIZE = 1.0 / M;   // ancho/fondo de cada celda en espacio mundo
const HEIGHT_SCALE = 0.8;     // u=1 levanta la celda esta altura

interface SceneProps {
  uRef: React.MutableRefObject<Float64Array>;
  runRef: React.MutableRefObject<boolean>;
  alphaRef: React.MutableRefObject<number>;
  bcRef: React.MutableRefObject<BCId>;
  tRef: React.MutableRefObject<number>;
  onStats: (t: number, energy: number) => void;
}

function HeatScene({ uRef, runRef, alphaRef, bcRef, tRef, onStats }: SceneProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Pre-calcular posición base de cada instancia (centrada en el origen XZ)
  const basePositions = useMemo<[number, number, number][]>(() => {
    const positions: [number, number, number][] = [];
    for (let i = 0; i <= M; i++) {
      for (let j = 0; j <= M; j++) {
        const x = (i / M - 0.5) * 1.0;
        const z = (j / M - 0.5) * 1.0;
        positions.push([x, 0, z]);
      }
    }
    return positions;
  }, []);

  // Scratch para matrices de instancia
  const mat = useMemo(() => new THREE.Matrix4(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const scl = useMemo(() => new THREE.Vector3(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);

  let frameCount = 0;

  useFrame(() => {
    // Avanzar simulación
    if (runRef.current) {
      for (let s = 0; s < STEPS_PER_FRAME; s++) {
        uRef.current = adiStep(uRef.current, alphaRef.current, bcRef.current);
        tRef.current += DT;
      }
    }

    const mesh = meshRef.current;
    if (!mesh) return;

    const u = uRef.current;
    const Np = M + 1;

    for (let k = 0; k < N_INST; k++) {
      const i = Math.floor(k / Np);
      const j = k % Np;
      const v = Math.max(0, u[i * Np + j]);

      const [bx, , bz] = basePositions[k];
      const h = Math.max(0.004, v * HEIGHT_SCALE);

      pos.set(bx, h * 0.5 - 0.001, bz);
      scl.set(VOXEL_SIZE * 0.98, h, VOXEL_SIZE * 0.98);
      quat.identity();
      mat.compose(pos, quat, scl);
      mesh.setMatrixAt(k, mat);

      const [r, g, b] = hotRGB(v);
      col.setRGB(r, g, b);
      mesh.setColorAt(k, col);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // Publicar stats cada ~10 frames
    frameCount++;
    if (frameCount % 10 === 0) {
      onStats(tRef.current, trapz2d(uRef.current));
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, N_INST]} castShadow={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        vertexColors
        toneMapped={false}
        emissiveIntensity={1.4}
        roughness={0.35}
        metalness={0.15}
      />
    </instancedMesh>
  );
}

// Plano de referencia sutil bajo la placa
function BasePlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.003, 0]}>
      <planeGeometry args={[1.12, 1.12]} />
      <meshStandardMaterial color="#0B1523" roughness={1} metalness={0} toneMapped={false} />
    </mesh>
  );
}

// ── Componente principal ────────────────────────────────────────────────

export default function HeatEquation() {
  const { audience } = useAudience();

  const [alpha, setAlpha] = useState(0.6);
  const [icId, setICId] = useState<ICId>('pulse');
  const [bcId, setBCId] = useState<BCId>('dirichlet');
  const [running, setRunning] = useState(true);
  const [simTime, setSimTime] = useState(0);
  const [energy, setEnergy] = useState(0);

  // Refs mutables para la simulación — no re-renderizan el componente en cada frame
  const uRef = useRef<Float64Array>(initialField('pulse'));
  const tRef = useRef<number>(0);
  const runRef = useRef<boolean>(true);
  const alphaRef = useRef<number>(0.6);
  const bcRef = useRef<BCId>('dirichlet');

  // Sincronizar refs con state (los cambios de slider/botón llegan por state)
  runRef.current = running;
  alphaRef.current = alpha;
  bcRef.current = bcId;

  const restart = (newIc?: ICId) => {
    const ic = newIc ?? icId;
    uRef.current = initialField(ic);
    tRef.current = 0;
    setSimTime(0);
    setEnergy(trapz2d(uRef.current));
  };

  // Al cambiar IC, re-inicializar
  const handleIC = (id: ICId) => {
    setICId(id);
    uRef.current = initialField(id);
    tRef.current = 0;
    setSimTime(0);
  };

  const handleStats = (t: number, e: number) => {
    setSimTime(t);
    setEnergy(e);
  };

  const r_fourier = (alpha * DT) / (DX * DX);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      {/* Canvas 3D */}
      <div className="relative">
        <Stage
          cameraDistance={1.85}
          autoRotate
          bloomIntensity={0.7}
          bloomThreshold={0.18}
          bgColor="#050608"
        >
          <HeatScene
            uRef={uRef}
            runRef={runRef}
            alphaRef={alphaRef}
            bcRef={bcRef}
            tRef={tRef}
            onStats={handleStats}
          />
          <BasePlane />
        </Stage>

        {/* HUD — stats */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#050608]/80 backdrop-blur border border-[#1E293B] px-3 py-2 font-mono text-[11px] text-[#CBD5E1] space-y-1">
          <div className="flex gap-3">
            <span className="text-[#64748B]">t</span>
            <span className="text-white">{simTime.toFixed(3)} s</span>
          </div>
          <div className="flex gap-3">
            <span className="text-[#64748B]">α</span>
            <span className="text-[#FDB813]">{alpha.toFixed(2)}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-[#64748B]">∫∫u dA</span>
            <span className={bcId === 'neumann' ? 'text-[#34D399]' : 'text-[#F472B6]'}>{energy.toFixed(3)}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-[#64748B]">r=αΔt/Δx²</span>
            <span className="text-[#60A5FA]">{r_fourier.toFixed(2)}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-[#64748B]">BC</span>
            <span className="text-[#94A3B8]">{bcId}</span>
          </div>
        </div>

        {/* HUD — controles de playback */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#050608]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>
            {running ? '❚❚' : '▶'}
          </IconBtn>
          <IconBtn onClick={() => restart()} title="Reiniciar perfil">↺</IconBtn>
        </div>

        {/* Leyenda colormap */}
        <div className="absolute bottom-5 right-4 text-[10px] font-mono text-[#94A3B8] space-y-0.5 text-right">
          <div><span style={{ color: '#fcde47' }}>■</span> caliente</div>
          <div><span style={{ color: '#ef4444' }}>■</span> tibio</div>
          <div><span style={{ color: '#1e3a8a' }}>■</span> frío</div>
        </div>
      </div>

      {/* Panel pedagógico */}
      <LessonPanel<HeatState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.alpha !== undefined) setAlpha(patch.alpha);
          if (patch.icId !== undefined) handleIC(patch.icId);
          if (patch.bcId !== undefined) setBCId(patch.bcId);
        }}
        sandbox={
          <>
            {/* Perfil inicial */}
            <Section title="Perfil inicial">
              <div className="grid grid-cols-1 gap-1.5">
                {([
                  { id: 'pulse'  as ICId, label: 'Pulso central',    blurb: 'Gaussiana en el centro. Difunde radialmente.' },
                  { id: 'ring'   as ICId, label: 'Anillo',           blurb: 'Anillo circular caliente que colapsa hacia adentro y afuera.' },
                  { id: 'stripe' as ICId, label: 'Franja horizontal', blurb: 'Banda caliente. Difunde en y, uniforme en x.' },
                  { id: 'twin'   as ICId, label: 'Dos focos',        blurb: 'Dos gaussianas que se funden.' },
                ]).map(o => (
                  <button
                    key={o.id}
                    onClick={() => handleIC(o.id)}
                    className={`text-left text-[11px] px-2.5 py-1.5 rounded border transition ${
                      icId === o.id
                        ? 'bg-[#FDB813]/10 border-[#FDB813]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#FDB813]/30 hover:text-white'
                    }`}
                  >
                    <div className="font-semibold">{o.label}</div>
                    <div className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{o.blurb}</div>
                  </button>
                ))}
              </div>
            </Section>

            {/* Condición de frontera */}
            <Section title="Condición de frontera">
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { id: 'dirichlet' as BCId, label: 'Dirichlet', blurb: 'u=0 en bordes' },
                  { id: 'neumann'   as BCId, label: 'Neumann',   blurb: '∂u/∂n=0 aislado' },
                ]).map(o => (
                  <button
                    key={o.id}
                    onClick={() => setBCId(o.id)}
                    className={`text-center text-[11px] px-2 py-1.5 rounded border transition ${
                      bcId === o.id
                        ? 'bg-[#60A5FA]/10 border-[#60A5FA]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#60A5FA]/30 hover:text-white'
                    }`}
                  >
                    <div className="font-semibold">{o.label}</div>
                    <div className="text-[10px] text-[#64748B] mt-0.5">{o.blurb}</div>
                  </button>
                ))}
              </div>
            </Section>

            {/* Difusividad */}
            <Section title="Difusividad térmica α">
              <div className="flex justify-between text-[11px] mb-1.5">
                <span className="text-[#94A3B8]">α</span>
                <span className="text-[#FDB813] font-mono">{alpha.toFixed(2)}</span>
              </div>
              <input
                type="range" min={0.1} max={3} step={0.05} value={alpha}
                onChange={e => setAlpha(parseFloat(e.target.value))}
                className="w-full accent-[#FDB813]"
              />
              <div className="text-[10px] text-[#64748B] mt-1 leading-snug">
                Mayor α → el calor se difunde más rápido. El ADI aguanta cualquier α (incondicionalmente estable).
              </div>
            </Section>

            {/* Controles */}
            <Section title="Simulación">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setRunning(r => !r)}
                  className="text-[11px] px-2 py-1.5 rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#FDB813]/40 hover:text-[#FDB813] transition"
                >
                  {running ? '⏸ pausa' : '▶ correr'}
                </button>
                <button
                  onClick={() => restart()}
                  className="text-[11px] px-2 py-1.5 rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#34D399]/40 hover:text-[#34D399] transition"
                >
                  ↻ reiniciar
                </button>
              </div>
            </Section>

            {/* Métricas para researcher */}
            {audience !== 'child' && (
              <Section title="Métricas">
                <Row label="t" value={`${simTime.toFixed(3)} s`} />
                <Row label="∫∫u dA" value={energy.toFixed(4)} highlight={false} />
                <Row label="r = αΔt/Δx²" value={r_fourier.toFixed(3)} highlight={r_fourier > 10} />
                <Row label="M (nodos/lado)" value={String(M + 1)} />
                <Row label="Δx" value={DX.toFixed(4)} />
                <Row label="Δt" value={DT.toFixed(5)} />
                <div className="mt-2 text-[10px] text-[#64748B] leading-relaxed">
                  ADI Peaceman-Rachford: 2 semi-pasos CN por Δt. Estable ∀r. Thomas O(N) por tridiagonal.
                </div>
              </Section>
            )}

            {/* Ecuación */}
            <Section title="Ecuación">
              <pre className="text-[10px] font-mono text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">
                {`∂u/∂t = α(∂²u/∂x² + ∂²u/∂y²)\n\nADI (Peaceman-Rachford):\n½Δt: CN en x, explícito en y\n½Δt: CN en y, explícito en x\nr = αΔt/Δx²  (sin restricción)`}
              </pre>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ── UI helpers ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className={highlight ? 'text-[#F87171]' : 'text-white'}>{value}</span>
    </div>
  );
}

function IconBtn({ children, onClick, active, title }: {
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
