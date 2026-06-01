/**
 * Ecuación del calor 1D — difusión en una barra.
 *
 *   ∂u/∂t = α ∂²u/∂x²,   x ∈ [0, L],   t ≥ 0
 *
 * El método REAL implementado aquí es Crank-Nicolson: promedio del esquema
 * explícito (forward Euler) y el implícito (backward Euler). Es de orden 2 en
 * tiempo y espacio, e INCONDICIONALMENTE ESTABLE (no hay límite tipo CFL sobre
 * el paso de tiempo). El precio: en cada paso hay que resolver un sistema lineal
 * tridiagonal — lo hacemos con el algoritmo de Thomas (eliminación gaussiana
 * especializada, O(N)).
 *
 * Discretización (r = α Δt / Δx²):
 *
 *   −r/2 · u_{i-1}^{n+1} + (1+r) · u_i^{n+1} − r/2 · u_{i+1}^{n+1}
 *     =  r/2 · u_{i-1}^{n} + (1−r) · u_i^{n} + r/2 · u_{i+1}^{n}
 *
 * Fronteras seleccionables:
 *   • Dirichlet:  u(0,t) = u(L,t) = 0   (extremos a temperatura fija)
 *   • Neumann:    u_x(0,t) = u_x(L,t) = 0   (extremos aislados, sin flujo)
 *
 * Comparamos opcionalmente con la solución por serie de Fourier (Dirichlet,
 * pulso/escalón/dos focos proyectados sobre senos):
 *
 *   u(x,t) = Σ b_k · sin(kπx/L) · exp(−α (kπ/L)² t)
 *
 * con b_k = (2/L) ∫₀ᴸ u₀(x) sin(kπx/L) dx (cuadratura del trapecio).
 *
 * La intuición: cada modo de Fourier decae con su propia tasa exp(−α λ_k t),
 * y los modos de alta frecuencia (k grande) mueren MUCHO más rápido (∝ k²).
 * Por eso cualquier perfil inicial se suaviza y termina aplanándose.
 */

import { useMemo, useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import CanvasCapture from '@/math/components/CanvasCapture';

// ── Estado del módulo ──────────────────────────────────────────────────

type ICId = 'pulse' | 'step' | 'twin';
type BCId = 'dirichlet' | 'neumann';

interface HeatState {
  alpha: number;
  icId: ICId;
  bcId: BCId;
  showFourier: boolean;
}

// ── LESSON ─────────────────────────────────────────────────────────────

const LESSON: Lesson<HeatState> = {
  hook: {
    title: 'Pon una cuchara caliente en agua fría. ¿Cómo se reparte el calor?',
    body: `Tienes una barra de metal. Un extremo está caliente, el resto frío. Si cierras los ojos un momento y vuelves a mirar, el calor ya se "esparció": el punto caliente bajó, los vecinos subieron.

Joseph Fourier escribió la ley en 1822: la temperatura u(x,t) obedece

  ∂u/∂t = α ∂²u/∂x²

El calor fluye de lo caliente a lo frío a una tasa proporcional a la CURVATURA del perfil (la segunda derivada). Donde el perfil hace una "joroba", la joroba se hunde; donde hace un "valle", el valle se rellena.

Esta clase resuelve esa ecuación de verdad — con Crank-Nicolson, un esquema implícito que NO explota aunque tomes pasos de tiempo grandes — y la ves difundirse cuadro a cuadro.`,
  },

  steps: [
    {
      title: 'El perfil inicial — un pulso de calor',
      duration: 5500,
      body: `Arrancamos con un PULSO: casi todo el calor concentrado en el centro de la barra, gaussiano y angosto.

Mira la curva: es alta y delgada. Eso significa CURVATURA enorme (∂²u/∂x² muy negativa en la cresta, muy positiva en los flancos).

La ecuación del calor lee esa curvatura y dicta la velocidad de cambio: ∂u/∂t = α · curvatura. Donde la cresta se curva hacia abajo, u baja rápido; donde los flancos se curvan hacia arriba, u sube.

Por eso un pulso angosto se aplasta FURIOSAMENTE al principio: la curvatura inicial es máxima. La barra "no soporta" gradientes bruscos.`,
      formula: 'u₀(x) = exp(−((x−L/2)/σ)²),  σ pequeño\n∂u/∂t = α ∂²u/∂x²',
      keyframes: [
        { at: 0, state: { icId: 'pulse', bcId: 'dirichlet', alpha: 0.6, showFourier: false } },
        { at: 1, state: { icId: 'pulse', bcId: 'dirichlet', alpha: 0.6, showFourier: false } },
      ],
    },
    {
      title: 'Crank-Nicolson — implícito e incondicionalmente estable',
      duration: 6000,
      body: `¿Cómo avanzamos en el tiempo sin que el esquema explote? Crank-Nicolson (1947).

Promediamos el lado derecho entre el instante n y el n+1. Eso deja la incógnita u^{n+1} en AMBOS lados: hay que resolver un sistema lineal en cada paso.

La matriz es TRIDIAGONAL (cada nodo solo habla con sus dos vecinos). La resolvemos con el algoritmo de Thomas: una pasada hacia adelante eliminando, una hacia atrás sustituyendo. Cuesta O(N), igual de barato que el método explícito.

La ganancia: con r = α Δt/Δx², el esquema explícito exige r ≤ 1/2 (si no, oscila y diverge). Crank-Nicolson es estable para CUALQUIER r. Subes α o Δt y la solución sigue siendo física.`,
      formula: '−r/2·u_{i-1} + (1+r)·u_i − r/2·u_{i+1}\n  = r/2·u_{i-1}ⁿ + (1−r)·u_iⁿ + r/2·u_{i+1}ⁿ\nr = α Δt/Δx²   (estable ∀ r)',
      keyframes: [
        { at: 0, state: { icId: 'pulse', bcId: 'dirichlet', alpha: 1.0, showFourier: false } },
        { at: 1, state: { icId: 'pulse', bcId: 'dirichlet', alpha: 1.0, showFourier: false } },
      ],
    },
    {
      title: 'Dirichlet vs Neumann — qué pasa en los extremos',
      duration: 6000,
      body: `Las fronteras deciden a dónde va el calor.

DIRICHLET: u(0,t) = u(L,t) = 0. Los extremos están sujetos a un baño frío. El calor se ESCAPA por las puntas y la barra termina en cero: el área bajo la curva cae.

NEUMANN: u_x(0,t) = u_x(L,t) = 0. Los extremos están AISLADOS, no hay flujo. El calor no puede salir: se redistribuye hasta quedar PLANO en el promedio. El área se conserva.

Cambia la frontera en el sandbox y observa: con Dirichlet la barra se enfría a negro; con Neumann se uniformiza a un gris tibio constante. Misma ecuación, destinos distintos.`,
      formula: 'Dirichlet: u(0)=u(L)=0      → ∫u dx → 0\nNeumann:  u_x(0)=u_x(L)=0  → ∫u dx = cte',
      keyframes: [
        { at: 0, state: { icId: 'step', bcId: 'neumann', alpha: 0.8, showFourier: false } },
        { at: 1, state: { icId: 'step', bcId: 'neumann', alpha: 0.8, showFourier: false } },
      ],
    },
    {
      title: 'La verdad de Fourier — modos que decaen como k²',
      duration: 6000,
      body: `¿Por qué el perfil se SUAVIZA siempre, sin importar cómo empezó? Fourier lo explicó descomponiendo en senos.

Con Dirichlet, escribimos u₀(x) = Σ b_k sin(kπx/L). Cada modo evoluciona SOLO, multiplicándose por exp(−α (kπ/L)² t).

Lo clave está en el k²: el modo k=10 decae CIEN veces más rápido que el k=1. Las arrugas finas (alta frecuencia) se borran casi al instante; la joroba suave (k=1) sobrevive más. Por eso todo perfil tiende a su modo fundamental antes de morir.

Activa "comparar Fourier" en el sandbox: la curva punteada es la serie analítica. Cae justo encima de Crank-Nicolson — dos caminos distintos a la misma física.`,
      formula: 'u(x,t) = Σ b_k sin(kπx/L) exp(−α(kπ/L)² t)\nb_k = (2/L)∫₀ᴸ u₀(x) sin(kπx/L) dx\ntasa de decaimiento ∝ k²',
      keyframes: [
        { at: 0, state: { icId: 'twin', bcId: 'dirichlet', alpha: 0.7, showFourier: true } },
        { at: 1, state: { icId: 'twin', bcId: 'dirichlet', alpha: 0.7, showFourier: true } },
      ],
    },
  ],

  connect: {
    body: `Acabas de resolver la ecuación de difusión, la más universal de la física.

La MISMA matemática gobierna:
• Difusión de partículas (segunda ley de Fick) — cómo se mezcla una gota de tinta
• La ecuación de Black-Scholes de finanzas — es una ecuación del calor disfrazada (Nobel de Economía 1997)
• El kernel gaussiano del desenfoque en visión por computadora — difuminar una imagen ES difundir calor
• El paso "forward" de los modelos de difusión que generan imágenes con IA

El operador clave, ∂²/∂x², es el Laplaciano. Cuando lo igualas a cero (estado estacionario, ∂u/∂t = 0) obtienes la ecuación de Laplace, la puerta a la teoría del potencial.

Y el truco de Fourier — descomponer en modos que decaen solos — es la diagonalización del operador de difusión. La misma idea que ver una matriz en su base de eigenvectores.`,
    links: [
      { label: 'Retrato de fases — la geometría de las EDOs', href: '#phase-portrait' },
      { label: 'Campos vectoriales — el flujo subyacente', href: '#vector-fields' },
      { label: 'Eigenvectores — diagonalizar operadores', href: '#eigen-3d' },
    ],
  },
};

// ── Discretización ─────────────────────────────────────────────────────

const N = 160;            // número de nodos internos + extremos: índices 0..N
const L = 1.0;            // longitud de la barra (adimensional)
const DX = L / N;         // paso espacial
const DT = 0.0008;        // paso de tiempo del integrador
const STEPS_PER_FRAME = 4;

// Condiciones iniciales reales (perfiles de temperatura sobre [0, L]).
function initialProfile(icId: ICId): Float64Array {
  const u = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const x = i * DX;
    if (icId === 'pulse') {
      // Gaussiana angosta centrada.
      const sigma = 0.05;
      u[i] = Math.exp(-Math.pow((x - 0.5) / sigma, 2));
    } else if (icId === 'step') {
      // Escalón: mitad izquierda caliente.
      u[i] = x < 0.5 ? 1.0 : 0.0;
    } else {
      // Dos focos gaussianos.
      const s = 0.06;
      u[i] = Math.exp(-Math.pow((x - 0.3) / s, 2)) + Math.exp(-Math.pow((x - 0.72) / s, 2));
    }
  }
  return u;
}

/**
 * Resuelve un sistema tridiagonal A·x = d con el algoritmo de Thomas.
 *   a = subdiagonal (a[0] no se usa)
 *   b = diagonal
 *   c = superdiagonal (c[n-1] no se usa)
 * O(n). Modifica copias internas; devuelve x.
 */
function thomas(
  a: Float64Array,
  b: Float64Array,
  c: Float64Array,
  d: Float64Array,
): Float64Array {
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
  for (let i = n - 2; i >= 0; i--) {
    x[i] = dp[i] - cp[i] * x[i + 1];
  }
  return x;
}

/**
 * Un paso de Crank-Nicolson. r = α Δt / Δx².
 * Resuelve para TODOS los nodos 0..N; las fronteras entran como ecuaciones.
 *   Dirichlet: u[0]=u[N]=0 (filas identidad, rhs 0).
 *   Neumann:   u_x=0 vía nodo fantasma → ecuación reflejada.
 */
function crankNicolsonStep(u: Float64Array, alpha: number, bcId: BCId): Float64Array {
  const n = N + 1;
  const r = (alpha * DT) / (DX * DX);
  const a = new Float64Array(n); // subdiagonal
  const b = new Float64Array(n); // diagonal
  const c = new Float64Array(n); // superdiagonal
  const d = new Float64Array(n); // rhs

  // Nodos internos: mismo estarcido CN para Dirichlet y Neumann.
  for (let i = 1; i < n - 1; i++) {
    a[i] = -r / 2;
    b[i] = 1 + r;
    c[i] = -r / 2;
    d[i] = (r / 2) * u[i - 1] + (1 - r) * u[i] + (r / 2) * u[i + 1];
  }

  if (bcId === 'dirichlet') {
    // u[0] = 0, u[N] = 0.
    b[0] = 1; c[0] = 0; d[0] = 0;
    a[n - 1] = 0; b[n - 1] = 1; d[n - 1] = 0;
  } else {
    // Neumann u_x=0 → nodo fantasma u[-1]=u[1], u[N+1]=u[N-1].
    // Borde izquierdo: el vecino "izquierdo" es u[1] (reflejado).
    b[0] = 1 + r;
    c[0] = -r; // = -r/2 - r/2 (fantasma colapsa sobre u[1])
    d[0] = (1 - r) * u[0] + r * u[1];
    // Borde derecho:
    a[n - 1] = -r;
    b[n - 1] = 1 + r;
    d[n - 1] = (1 - r) * u[n - 1] + r * u[n - 2];
  }

  return thomas(a, b, c, d);
}

// ── Solución por serie de Fourier (Dirichlet) ──────────────────────────

const FOURIER_MODES = 64;

function fourierCoeffs(u0: Float64Array): Float64Array {
  // b_k = (2/L) ∫₀ᴸ u₀(x) sin(kπx/L) dx, cuadratura del trapecio.
  const bk = new Float64Array(FOURIER_MODES + 1);
  for (let k = 1; k <= FOURIER_MODES; k++) {
    let s = 0;
    for (let i = 0; i <= N; i++) {
      const x = i * DX;
      const w = i === 0 || i === N ? 0.5 : 1.0;
      s += w * u0[i] * Math.sin((k * Math.PI * x) / L);
    }
    bk[k] = (2 / L) * s * DX;
  }
  return bk;
}

function fourierEval(bk: Float64Array, alpha: number, t: number): Float64Array {
  const u = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const x = i * DX;
    let s = 0;
    for (let k = 1; k <= FOURIER_MODES; k++) {
      const lam = (k * Math.PI) / L;
      s += bk[k] * Math.sin(lam * x) * Math.exp(-alpha * lam * lam * t);
    }
    u[i] = s;
  }
  return u;
}

// ── Colormap caliente → frío (azul → rojo → amarillo) ──────────────────

function hotColor(v: number): [number, number, number] {
  // v normalizado ~[0,1]. Frío = azul profundo; tibio = magenta/rojo; caliente = amarillo.
  const t = Math.max(0, Math.min(1, v));
  // tramos: 0 azul (#1E3A8A) → 0.5 rojo (#EF4444) → 1 amarillo (#FDE047)
  let r: number, g: number, b: number;
  if (t < 0.5) {
    const s = t / 0.5;
    r = lerp(0.07, 0.94, s);
    g = lerp(0.16, 0.27, s);
    b = lerp(0.54, 0.27, s);
  } else {
    const s = (t - 0.5) / 0.5;
    r = lerp(0.94, 0.99, s);
    g = lerp(0.27, 0.88, s);
    b = lerp(0.27, 0.28, s);
  }
  return [r, g, b];
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Mapea el perfil u (sobre [0,L]) a puntos 3D centrados en el origen.
// x → [-W/2, W/2], u → altura escalada, z = 0.
const WORLD_W = 4.0;     // ancho de la barra en el mundo
const HEIGHT = 1.8;      // altura máxima de la curva

function profileToPoints(u: Float64Array): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * WORLD_W - WORLD_W / 2;
    const y = u[i] * HEIGHT;
    pts.push([x, y, 0]);
  }
  return pts;
}

function profileToColors(u: Float64Array): [number, number, number][] {
  const cols: [number, number, number][] = [];
  for (let i = 0; i <= N; i++) cols.push(hotColor(u[i]));
  return cols;
}

// ── Componente ─────────────────────────────────────────────────────────

// Corre el loop de simulación DENTRO del Canvas (useFrame solo vive bajo <Canvas>).
function FrameTick({ cb }: { cb: () => void }) {
  const ref = useRef(cb);
  ref.current = cb;
  useFrame(() => ref.current());
  return null;
}

export default function Heat1D() {
  const { audience } = useAudience();
  const [alpha, setAlpha] = useState(0.6);
  const [icId, setICId] = useState<ICId>('pulse');
  const [bcId, setBCId] = useState<BCId>('dirichlet');
  const [showFourier, setShowFourier] = useState(false);
  const [running, setRunning] = useState(true);

  // Estado de la simulación (mutable, vive en refs para no re-renderizar por frame).
  const uRef = useRef<Float64Array>(initialProfile('pulse'));
  const tRef = useRef<number>(0);
  const bkRef = useRef<Float64Array>(fourierCoeffs(initialProfile('pulse')));

  // Estado "publicado" a React para dibujar (se actualiza por frame controlado).
  const [points, setPoints] = useState<[number, number, number][]>(() =>
    profileToPoints(initialProfile('pulse')),
  );
  const [colors, setColors] = useState<[number, number, number][]>(() =>
    profileToColors(initialProfile('pulse')),
  );
  const [fourierPts, setFourierPts] = useState<[number, number, number][]>([]);
  const [simTime, setSimTime] = useState(0);
  const [energy, setEnergy] = useState(0); // ∫u dx (proporcional al calor total)

  // Re-inicializa la simulación cuando cambia IC (o al pedir reset).
  const resetKey = `${icId}`;
  useMemo(() => {
    const u0 = initialProfile(icId);
    uRef.current = u0.slice();
    tRef.current = 0;
    bkRef.current = fourierCoeffs(u0);
    setPoints(profileToPoints(u0));
    setColors(profileToColors(u0));
    setFourierPts([]);
    setSimTime(0);
    setEnergy(trapz(u0));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const restart = () => {
    const u0 = initialProfile(icId);
    uRef.current = u0.slice();
    tRef.current = 0;
    bkRef.current = fourierCoeffs(u0);
    setPoints(profileToPoints(u0));
    setColors(profileToColors(u0));
    setSimTime(0);
    setEnergy(trapz(u0));
  };

  // Bucle de integración: avanza Crank-Nicolson cada frame.
  const heatTick = () => {
    if (!running) return;
    let u = uRef.current;
    for (let s = 0; s < STEPS_PER_FRAME; s++) {
      u = crankNicolsonStep(u, alpha, bcId);
      tRef.current += DT;
    }
    uRef.current = u;
    setPoints(profileToPoints(u));
    setColors(profileToColors(u));
    setSimTime(tRef.current);
    setEnergy(trapz(u));
    if (showFourier && bcId === 'dirichlet') {
      setFourierPts(profileToPoints(fourierEval(bkRef.current, alpha, tRef.current)));
    } else if (fourierPts.length > 0) {
      setFourierPts([]);
    }
  };

  // Geometría de la "barra" (losa fina bajo la curva) coloreada por la base.
  const barColors = useMemo(() => colors, [colors]);

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={5.2} bloomIntensity={0.6} bloomThreshold={0.5} bgColor="#05060A" captureMode>
          <CanvasCapture />
          <FrameTick cb={heatTick} />

          {/* Eje base de la barra */}
          <Line
            points={[[-WORLD_W / 2, 0, 0], [WORLD_W / 2, 0, 0]]}
            color="#334155"
            lineWidth={1}
          />

          {/* Marcas de los extremos (x=0 y x=L) */}
          <mesh position={[-WORLD_W / 2, 0, 0]}>
            <sphereGeometry args={[0.045, 16, 16]} />
            <meshStandardMaterial
              color={bcId === 'dirichlet' ? '#1E3A8A' : '#94A3B8'}
              emissive={bcId === 'dirichlet' ? '#1E3A8A' : '#475569'}
              emissiveIntensity={0.8}
            />
          </mesh>
          <mesh position={[WORLD_W / 2, 0, 0]}>
            <sphereGeometry args={[0.045, 16, 16]} />
            <meshStandardMaterial
              color={bcId === 'dirichlet' ? '#1E3A8A' : '#94A3B8'}
              emissive={bcId === 'dirichlet' ? '#1E3A8A' : '#475569'}
              emissiveIntensity={0.8}
            />
          </mesh>

          {/* Curva u(x,t) — Crank-Nicolson, coloreada caliente→frío */}
          <Line
            points={points}
            vertexColors={colors}
            lineWidth={3.5}
            toneMapped={false}
          />

          {/* "Solera" caliente: réplica de la curva justo sobre la barra para
              que el bloom del Stage la haga brillar como una franja térmica. */}
          <Line
            points={points.map(([x, , z]) => [x, 0.02, z] as [number, number, number])}
            vertexColors={barColors}
            lineWidth={9}
            transparent
            opacity={0.55}
            toneMapped={false}
          />

          {/* Comparación con serie de Fourier (Dirichlet) — punteado verde */}
          {fourierPts.length > 0 && (
            <Line
              points={fourierPts}
              color="#34D399"
              lineWidth={1.6}
              dashed
              dashSize={0.08}
              gapSize={0.06}
              transparent
              opacity={0.9}
              toneMapped={false}
            />
          )}
        </Stage>

        {/* Leyenda HUD */}
        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div><span className="text-[#FDE047]">━</span> u(x,t) — Crank-Nicolson</div>
          {showFourier && bcId === 'dirichlet' && (
            <div><span className="text-[#34D399]">┄</span> serie de Fourier</div>
          )}
          <div className="text-[#94A3B8]">caliente <span className="text-[#FDE047]">amarillo</span> → frío <span className="text-[#60A5FA]">azul</span></div>
        </div>

        {/* Lectura en vivo */}
        <div className="absolute bottom-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div className="flex justify-between gap-4">
            <span className="text-[#94A3B8]">t</span>
            <span className="text-white">{simTime.toFixed(3)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#94A3B8]">α</span>
            <span className="text-[#FDB813]">{alpha.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#94A3B8]">∫u dx</span>
            <span className={bcId === 'neumann' ? 'text-[#34D399]' : 'text-[#F472B6]'}>{energy.toFixed(3)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#94A3B8]">r=αΔt/Δx²</span>
            <span className="text-[#60A5FA]">{((alpha * DT) / (DX * DX)).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <LessonPanel<HeatState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.alpha !== undefined) setAlpha(patch.alpha);
          if (patch.icId !== undefined) setICId(patch.icId);
          if (patch.bcId !== undefined) setBCId(patch.bcId);
          if (patch.showFourier !== undefined) setShowFourier(patch.showFourier);
        }}
        sandbox={
          <>
            {/* Condición inicial */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Perfil inicial</div>
              <div className="grid grid-cols-1 gap-1.5">
                {([
                  { id: 'pulse', label: 'Pulso', blurb: 'Gaussiana angosta en el centro. Curvatura máxima → difunde rápido.' },
                  { id: 'step', label: 'Escalón', blurb: 'Mitad caliente, mitad fría. El frente abrupto se suaviza (fenómeno de Gibbs en Fourier).' },
                  { id: 'twin', label: 'Dos focos', blurb: 'Dos gaussianas. Se funden en una sola joroba antes de aplanarse.' },
                ] as { id: ICId; label: string; blurb: string }[]).map(o => (
                  <button
                    key={o.id}
                    onClick={() => setICId(o.id)}
                    className={`text-left text-[11px] px-2 py-1.5 rounded border transition ${
                      icId === o.id
                        ? 'bg-[#FDB813]/10 border-[#FDB813]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#FDB813]/30'
                    }`}
                  >
                    <div className="font-semibold">{o.label}</div>
                    <div className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{o.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Frontera */}
            <div className="border-t border-[#1E293B] pt-3">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Frontera</div>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { id: 'dirichlet', label: 'Dirichlet', blurb: 'extremos a 0' },
                  { id: 'neumann', label: 'Neumann', blurb: 'aislada' },
                ] as { id: BCId; label: string; blurb: string }[]).map(o => (
                  <button
                    key={o.id}
                    onClick={() => setBCId(o.id)}
                    className={`text-center text-[11px] px-2 py-1.5 rounded border transition ${
                      bcId === o.id
                        ? 'bg-[#60A5FA]/10 border-[#60A5FA]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#60A5FA]/30'
                    }`}
                  >
                    <div className="font-semibold">{o.label}</div>
                    <div className="text-[10px] text-[#64748B] mt-0.5">{o.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Difusividad α */}
            <div className="border-t border-[#1E293B] pt-3">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#94A3B8]">Difusividad α</span>
                <span className="text-[#FDB813] font-mono">{alpha.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={3}
                step={0.05}
                value={alpha}
                onChange={(e) => setAlpha(parseFloat(e.target.value))}
                className="w-full accent-[#FDB813]"
              />
              <div className="text-[10px] text-[#64748B] mt-1 leading-snug">
                Más α → el calor se reparte más rápido. Crank-Nicolson aguanta α grande sin oscilar.
              </div>
            </div>

            {/* Controles de simulación */}
            <div className="border-t border-[#1E293B] pt-3 grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setRunning(r => !r)}
                className="text-[11px] px-2 py-1.5 rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#FDB813]/40 hover:text-[#FDB813]"
              >
                {running ? '⏸ pausa' : '▶ correr'}
              </button>
              <button
                onClick={restart}
                className="text-[11px] px-2 py-1.5 rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#34D399]/40 hover:text-[#34D399]"
              >
                ↻ reiniciar
              </button>
            </div>

            {/* Comparar Fourier */}
            <div className="border-t border-[#1E293B] pt-3">
              <button
                onClick={() => setShowFourier(s => !s)}
                disabled={bcId !== 'dirichlet'}
                className={`w-full text-[11px] px-2 py-1.5 rounded border transition ${
                  showFourier && bcId === 'dirichlet'
                    ? 'bg-[#34D399]/10 border-[#34D399]/40 text-[#34D399]'
                    : 'border-[#1E293B] text-[#94A3B8] hover:border-[#34D399]/30'
                } disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                {showFourier ? '✓ comparando con Fourier' : 'comparar con serie de Fourier'}
              </button>
              <div className="text-[10px] text-[#64748B] mt-1 leading-snug">
                Serie analítica (solo Dirichlet): u = Σ bₖ sin(kπx/L)·e^(−α(kπ/L)²t).
              </div>
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Crank-Nicolson: θ=½ entre Euler explícito e implícito. Sistema tridiagonal resuelto por Thomas (O(N)). Incondicionalmente A-estable; los modos de Fourier decaen ∝ k².
              </div>
            )}
          </>
        }
      />
    </div>
  );
}

// ── Helpers numéricos ──────────────────────────────────────────────────

// Regla del trapecio para ∫₀ᴸ u dx (calor total — invariante con Neumann).
function trapz(u: Float64Array): number {
  let s = 0;
  for (let i = 0; i < u.length - 1; i++) s += 0.5 * (u[i] + u[i + 1]);
  return s * DX;
}
