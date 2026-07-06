/**
 * Schrödinger 1D — ecuación dependiente del tiempo en 3D cine.
 *
 * iℏ ∂ψ/∂t = Hψ = [−ℏ²/2m ∂²/∂x² + V(x)] ψ
 *
 * FÍSICA REAL — Split-Step Fourier (SSF) orden 2:
 *
 *   1. Medio paso de potencial (espacio):
 *      ψ → ψ · exp(−i V(x) Δt / 2ℏ)
 *
 *   2. Paso completo de cinético (k-espacio, FFT):
 *      ψ̂ → ψ̂ · exp(−i ℏk²/2m · Δt)
 *
 *   3. Medio paso de potencial (espacio):
 *      ψ → ψ · exp(−i V(x) Δt / 2ℏ)
 *
 *   El SSF es unitario: ||ψ||² se conserva exactamente hasta redondeo float64.
 *   Error global O(Δt², Δx²) — simetría Trotter de segundo orden.
 *
 *   Para la FFT implementamos la DFT discreta de Cooley-Tukey recursiva en JS
 *   (N=512=2^9, ~1ms/paso en JS moderno).
 *
 * POTENCIALES disponibles:
 *   - Barrera cuadrada  → túnel cuántico
 *   - Pozo cuadrado     → estados ligados
 *   - Armónico V=½kx²  → coherent state oscila sin dispersión
 *   - Doble pozo        → splitting de niveles / oscilación entre pozos
 *
 * VISUALIZACIÓN 3D CINE:
 *   - Tubo de |ψ|² extruido a lo largo del eje X (TubeGeometry dinámico)
 *   - Fase color-mapeada como hue (HSL): Re→rojo, Im→verde, mix→arco iris
 *   - Potencial V(x) como floor plate emisivo
 *   - Nube de partículas aditiva: puntos de probabilidad alta que "brillan"
 *   - Stage con autoRotate lento — la función de onda se CONTEMPLA
 *
 * REGLA useFrame: SOLO dentro de sub-componentes hijos de <Stage>.
 */

import { useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import { getParticleTexture } from '@/labs/components/sprite-texture';

// ─── Constantes físicas (unidades atómicas: ℏ=1, m=1) ─────────────────
const HBAR = 1.0;
const MASS = 1.0;

// ─── Grilla ────────────────────────────────────────────────────────────
const N    = 512;           // puntos espaciales — potencia de 2 para FFT
const L    = 20.0;          // dominio [−L/2, L/2] en unidades atómicas
const DX   = L / N;         // paso espacial
const DT   = 0.004;         // paso temporal (unidades atómicas)
const SUB  = 6;             // sub-pasos SSF por frame de render
const X0   = L / 2;        // offset para centrar: x_i = i·DX − L/2

// Coordenadas reales
const XS = new Float64Array(N);
for (let i = 0; i < N; i++) XS[i] = i * DX - X0;

// Frecuencias k (ordenadas para FFT: 0..N/2-1, -N/2..-1)
const KS = new Float64Array(N);
for (let i = 0; i < N; i++) {
  KS[i] = i < N / 2
    ? (2 * Math.PI / L) * i
    : (2 * Math.PI / L) * (i - N);
}

// ─── FFT Cooley-Tukey iterativa in-place ───────────────────────────────
// Trabaja sobre Float64Array de longitud 2N: [re0,im0, re1,im1, ...]
function fft(a: Float64Array, inverse: boolean): void {
  const n = a.length >> 1;  // numero de puntos complejos
  // bit-reversal permutation
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = a[2*i]; a[2*i] = a[2*j]; a[2*j] = t;
      t = a[2*i+1]; a[2*i+1] = a[2*j+1]; a[2*j+1] = t;
    }
  }
  // butterfly
  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const ang = sign * 2 * Math.PI / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let uRe = 1, uIm = 0;
      for (let k = 0; k < len >> 1; k++) {
        const eRe = a[2*(i+k)],   eIm = a[2*(i+k)+1];
        const oRe = a[2*(i+k+(len>>1))], oIm = a[2*(i+k+(len>>1))+1];
        const tRe = uRe*oRe - uIm*oIm, tIm = uRe*oIm + uIm*oRe;
        a[2*(i+k)]           = eRe + tRe;
        a[2*(i+k)+1]         = eIm + tIm;
        a[2*(i+k+(len>>1))]  = eRe - tRe;
        a[2*(i+k+(len>>1))+1]= eIm - tIm;
        const nuRe = uRe*wRe - uIm*wIm;
        uIm = uRe*wIm + uIm*wRe;
        uRe = nuRe;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < 2*n; i++) a[i] /= n;
  }
}

// ─── Potenciales ───────────────────────────────────────────────────────
type PotentialId = 'barrier' | 'well' | 'harmonic' | 'double_well';

interface PotentialDef {
  id: PotentialId;
  name: string;
  note: string;
  V: (x: number) => number;        // en ℏ=m=1
  psi0: (x: number) => [number, number]; // Re, Im del paquete inicial
  k0: number;     // momento medio del paquete (unidades atómicas)
  sigma: number;  // ancho del paquete gaussiano
  x0: number;     // centro inicial del paquete
}

const POTENTIALS: PotentialDef[] = [
  {
    id: 'barrier',
    name: 'Barrera — Túnel cuántico',
    note: 'El paquete incide sobre la barrera. Parte se transmite: TÚNEL. Parte se refleja. La probabilidad de transmisión T = |t|² sigue la fórmula de Gamow.',
    V: (x) => (Math.abs(x) < 0.8 ? 3.5 : 0),
    psi0: (x) => {
      const k0 = 2.0, x0 = -4.5, sig = 1.0;
      const dx = x - x0;
      const env = Math.exp(-(dx * dx) / (2 * sig * sig));
      // Normalize constant absorbed later
      return [env * Math.cos(k0 * dx), env * Math.sin(k0 * dx)];
    },
    k0: 2.0,
    sigma: 1.0,
    x0: -4.5,
  },
  {
    id: 'well',
    name: 'Pozo cuadrado — estados ligados',
    note: 'El paquete cae en el pozo. Los estados ligados resuenan — el |ψ|² oscila dentro del pozo, formando los perfiles característicos de ψₙ(x).',
    V: (x) => (Math.abs(x) < 2.0 ? -4.0 : 0),
    psi0: (x) => {
      const k0 = 0.5, x0 = -5.0, sig = 1.2;
      const dx = x - x0;
      const env = Math.exp(-(dx * dx) / (2 * sig * sig));
      return [env * Math.cos(k0 * dx), env * Math.sin(k0 * dx)];
    },
    k0: 0.5,
    sigma: 1.2,
    x0: -5.0,
  },
  {
    id: 'harmonic',
    name: 'Oscilador armónico — estado coherente',
    note: 'V = ½kx². El paquete gaussiano es el estado coherente de Glauber: oscila SIN dispersión, manteniendo su forma gaussiana. Es la solución más clásica de la QM.',
    V: (x) => 0.25 * x * x,
    psi0: (x) => {
      const x0 = 3.5, sig = 1.0;
      const dx = x - x0;
      const env = Math.exp(-(dx * dx) / (2 * sig * sig));
      return [env, 0];     // sin momento inicial — oscila por potencial
    },
    k0: 0.0,
    sigma: 1.0,
    x0: 3.5,
  },
  {
    id: 'double_well',
    name: 'Doble pozo — tunelamiento lento',
    note: 'V = a(x²−b²)². El paquete localizado en un pozo tunela al otro. La frecuencia de oscilación es proporcional al splitting de energía ΔE = E₁ − E₀ — visible directamente.',
    V: (x) => 0.015 * (x * x - 9) * (x * x - 9),
    psi0: (x) => {
      const x0 = -3.0, sig = 1.0;
      const dx = x - x0;
      const env = Math.exp(-(dx * dx) / (2 * sig * sig));
      return [env, 0];
    },
    k0: 0.0,
    sigma: 1.0,
    x0: -3.0,
  },
];

// ─── Estado cuántico — Split-Step Fourier ─────────────────────────────
function makeWavefunction(pot: PotentialDef): Float64Array {
  // psi_buf: [re0,im0, re1,im1, ..., re_{N-1},im_{N-1}]
  const psi = new Float64Array(2 * N);
  let norm2 = 0;
  for (let i = 0; i < N; i++) {
    const x = XS[i];
    const [re, im] = pot.psi0(x);
    psi[2*i]   = re;
    psi[2*i+1] = im;
    norm2 += re*re + im*im;
  }
  // Normalizar: ∫|ψ|²dx = 1
  const inv = 1 / Math.sqrt(norm2 * DX);
  for (let i = 0; i < 2*N; i++) psi[i] *= inv;
  return psi;
}

// Precalcular los propagadores: exp(-i V(x) dt/2) y exp(-i ℏk²/2m dt)
function makePropagators(pot: PotentialDef, dt: number) {
  const propV_re = new Float64Array(N);  // Real part of exp(-i V dt/2)
  const propV_im = new Float64Array(N);  // Imag part
  const propK_re = new Float64Array(N);  // Real part of exp(-i ℏk²/2m dt)
  const propK_im = new Float64Array(N);

  for (let i = 0; i < N; i++) {
    const angle_V = -pot.V(XS[i]) * dt / (2 * HBAR);
    propV_re[i] = Math.cos(angle_V);
    propV_im[i] = Math.sin(angle_V);

    const k = KS[i];
    const angle_K = -(HBAR * k * k) / (2 * MASS) * dt;
    propK_re[i] = Math.cos(angle_K);
    propK_im[i] = Math.sin(angle_K);
  }
  return { propV_re, propV_im, propK_re, propK_im };
}

// Un paso SSF de segundo orden
function stepSSF(
  psi: Float64Array,
  propV_re: Float64Array, propV_im: Float64Array,
  propK_re: Float64Array, propK_im: Float64Array,
): void {
  // 1. Medio paso potencial
  for (let i = 0; i < N; i++) {
    const re = psi[2*i], im = psi[2*i+1];
    const vr = propV_re[i], vi = propV_im[i];
    psi[2*i]   = re*vr - im*vi;
    psi[2*i+1] = re*vi + im*vr;
  }

  // 2. FFT → k-espacio
  fft(psi, false);

  // 3. Paso cinético en k-espacio
  for (let i = 0; i < N; i++) {
    const re = psi[2*i], im = psi[2*i+1];
    const kr = propK_re[i], ki = propK_im[i];
    psi[2*i]   = re*kr - im*ki;
    psi[2*i+1] = re*ki + im*kr;
  }

  // 4. IFFT → espacio real
  fft(psi, true);

  // 5. Medio paso potencial
  for (let i = 0; i < N; i++) {
    const re = psi[2*i], im = psi[2*i+1];
    const vr = propV_re[i], vi = propV_im[i];
    psi[2*i]   = re*vr - im*vi;
    psi[2*i+1] = re*vi + im*vr;
  }
}

// ─── Lección pedagógica ────────────────────────────────────────────────
interface QMLessonState { potId: PotentialId }

const LESSON: Lesson<QMLessonState> = {
  hook: {
    title: 'Una partícula cuántica ATRAVIESA una pared sólida.',
    body: `Clásicamente, si una pelota no tiene suficiente energía para superar una barrera, REBOTA. Fin de la historia.

En mecánica cuántica, la realidad es diferente. La partícula existe como una función de onda ψ(x,t). Su módulo al cuadrado |ψ|² es la DENSIDAD DE PROBABILIDAD — la probabilidad de encontrarla en x.

Cuando ψ incide sobre una barrera donde E < V, la solución de Schrödinger dentro de la barrera no es cero: es una exponencial decreciente e^{−κx}. Si la barrera es finita, ψ "filtra" al otro lado. Ahí hay probabilidad. La partícula PUEDE aparecer al otro lado.

Esto se llama efecto túnel. Es el principio de:
• Microscopía de efecto túnel (STM — Binnig & Rohrer, Nobel 1986)
• Fusión nuclear en el Sol (sin túnel, el Sol no brillaría)
• Transistores de efecto túnel en tu CPU
• Radiactividad α (Gamow, 1928)

La ecuación que lo governa: iℏ∂ψ/∂t = [−ℏ²/2m ∂²/∂x² + V(x)] ψ.

Aquí la resolvemos con Split-Step Fourier: unitario, exacto, ||ψ||²=1 en todo instante.`,
  },

  steps: [
    {
      title: 'Barrera — el túnel cuántico en vivo',
      duration: 7000,
      body: `El paquete gaussiano (amarillo brillante) se mueve hacia la barrera (verde). Su energía cinética E = ℏ²k₀²/2m < V₀.

Clásicamente: rebote total. Cuánticamente: parte se TRANSMITE.

La probabilidad de transmisión sigue la fórmula de Gamow:
T ≈ exp(−2κa)  donde  κ = √(2m(V−E))/ℏ

El |ψ|² después de la barrera es real — hay probabilidad al otro lado. La fase (color arco iris) te muestra que la función de onda continúa oscilando.

Observa: el paquete reflejado (izquierda) y el transmitido (derecha) son coherentes — interferencia cuántica.`,
      formula: 'T ≈ exp(−2κa)\nκ = √(2m(V−E)) / ℏ',
      keyframes: [
        { at: 0, state: { potId: 'barrier' } },
        { at: 1, state: { potId: 'barrier' } },
      ],
    },
    {
      title: 'Pozo cuadrado — resonancias y estados ligados',
      duration: 7000,
      body: `El pozo de potencial V < 0 atrapa al paquete. El |ψ|² oscila dentro — una superposición de estados ligados ψₙ(x).

Los niveles permitidos cumplen las condiciones de empalme en los bordes:
  k·tan(ka/2) = κ  (estados pares)
  k·cot(ka/2) = −κ (estados impares)

Mirá la estructura de nodos: ψ₁ no tiene nodos (más ligado), ψ₂ tiene 1, etc. Es el espectro discreso del pozo cuadrado finito.

La densidad de probabilidad "rebota" dentro del pozo, sin poder escapar completamente — son los estados ligados E < 0.`,
      formula: 'E_n = −V₀ + ℏ²π²n²/(2m(2a)²)\n(pozo infinito)\nEstados ligados: N ≥ 1  siempre.',
      keyframes: [
        { at: 0, state: { potId: 'well' } },
        { at: 1, state: { potId: 'well' } },
      ],
    },
    {
      title: 'Oscilador armónico — estado coherente de Glauber',
      duration: 7000,
      body: `V(x) = ½mω²x². El estado coherente |α⟩ es el que más se parece a un oscilador clásico.

Mirá: el paquete gaussiano oscila SIN deformarse. Mantiene exactamente su forma. En ningún otro potencial esto ocurre.

La razón es algebraica: el estado coherente es autoestado del operador de bajada â. Su evolución temporal es rotación en el espacio de fase:
  α(t) = α₀ · e^{−iωt}

La dispersión posición-momento ΔxΔp = ℏ/2 es MÍNIMA — es el estado de menor incertidumbre permitido por Heisenberg.

Los láseres y los estados del campo electromagnético son estados coherentes.`,
      formula: 'â|α⟩ = α|α⟩\nΔxΔp = ℏ/2  (mínima incertidumbre)\nα(t) = α₀·e^{−iωt}',
      keyframes: [
        { at: 0, state: { potId: 'harmonic' } },
        { at: 1, state: { potId: 'harmonic' } },
      ],
    },
    {
      title: 'Doble pozo — tunelamiento entre pozos',
      duration: 8000,
      body: `V(x) = a(x²−b²)². Dos mínimos simétricos. El paquete inicia en el pozo izquierdo.

El sistema tiene dos estados casi-degenerados:
  ψ_+ ≈ (ψ_L + ψ_R)/√2  (simétrico, E₀)
  ψ_− ≈ (ψ_L − ψ_R)/√2  (antisimétrico, E₁)

El paquete inicial |ψ_L⟩ = (ψ_+ + ψ_−)/√2. La evolución temporal da:
  ψ(t) ∝ e^{−iE₀t/ℏ}ψ_+ + e^{−iE₁t/ℏ}ψ_−

Que oscila con frecuencia Ω = (E₁−E₀)/ℏ entre los dos pozos — TUNELAMIENTO.

Observa: el |ψ|² se transfiere periódicamente de izquierda a derecha. Es el mismo mecanismo que produce la inversión de la molécula de amoniaco NH₃ (el maser de Townes, Nobel 1964).`,
      formula: 'Ω = ΔE/ℏ = (E₁−E₀)/ℏ\nP_L(t) = cos²(Ωt/2)',
      keyframes: [
        { at: 0, state: { potId: 'double_well' } },
        { at: 1, state: { potId: 'double_well' } },
      ],
    },
  ],

  connect: {
    body: `La ecuación de Schrödinger es el corazón de la física cuántica. Con ella se explican:

• Estructura atómica: los orbitales del hidrógeno son sus autofunciones.
• Química cuántica: los enlaces moleculares son túnel de electrones entre átomos.
• Semiconductores: los estados de Bloch ψ_k(x) en cristales periódicos → bandas de energía → transistores.
• Superconductividad: los pares de Cooper son estados enlazados por el fonón.
• Óptica cuántica: los fotones en una cavidad son modos del oscilador armónico.

El Split-Step Fourier que usamos aquí es el mismo algoritmo que corre en simulaciones de fibra óptica no-lineal, propagación de pulsos láser femtosegundo, y solitones cuánticos.`,
    links: [
      { label: 'Oscilador armónico 3D — orbitales', href: '#harmonic-3d' },
      { label: 'Átomo de hidrógeno — espectro real', href: '#hydrogen-atom' },
      { label: 'Electromagnetismo — ondas de Maxwell', href: '#em-fields' },
    ],
  },
};

// ─── Helpers de visualización ──────────────────────────────────────────
const TUBE_SEGS = N - 1;  // segmentos del tubo = N-1
const CLOUD_N   = 180;    // puntos de nube de probabilidad
const VIS_SCALE = 3.5;    // amplitud visual de |ψ|² en el eje Y
const X_SCALE   = 12.0;   // escala del eje X en unidades de mundo
const V_SCALE   = 0.6;    // escala del potencial en el eje Y (floor)

// Mapeo x físico → coordenada mundo
function xWorld(x: number) { return (x / X0) * X_SCALE * 0.5; }

// ─── Componente principal ──────────────────────────────────────────────
export default function Schrodinger1D() {
  const { audience } = useAudience();
  const [potId, setPotId] = useState<PotentialId>('barrier');
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1.0);   // multiplicador de velocidad

  const pot = POTENTIALS.find(p => p.id === potId)!;

  // Estado de simulación — refs para no re-renderizar React
  const psiRef   = useRef<Float64Array>(makeWavefunction(pot));
  const propRef  = useRef(makePropagators(pot, DT));
  const normRef  = useRef(1.0);   // ||ψ||² calculado tras cada lote
  const timeRef  = useRef(0.0);

  // Stats UI (actualizadas cada ~100ms)
  const [norm,  setNorm]  = useState(1.0);
  const [simT,  setSimT]  = useState(0.0);
  const [probL, setProbL] = useState(0.5);  // P(x<0)
  const [probR, setProbR] = useState(0.5);  // P(x>0)

  // Reset al cambiar potencial
  const reset = useCallback((newPotId: PotentialId) => {
    const newPot = POTENTIALS.find(p => p.id === newPotId)!;
    psiRef.current  = makeWavefunction(newPot);
    propRef.current = makePropagators(newPot, DT);
    timeRef.current = 0;
    setSimT(0);
    setNorm(1.0);
    setProbL(0.5);
    setProbR(0.5);
  }, []);

  // Paso de simulación: corre SUB*speed pasos por llamada (desde fuera del canvas)
  // useFrame se encarga de llamarla; aquí solo definimos la función.
  const stepFn = useCallback(() => {
    if (!running) return;
    const psi  = psiRef.current;
    const { propV_re, propV_im, propK_re, propK_im } = propRef.current;
    const steps = Math.round(SUB * speed);
    for (let s = 0; s < steps; s++) {
      stepSSF(psi, propV_re, propV_im, propK_re, propK_im);
    }
    timeRef.current += DT * steps;

    // Calcular norma y probabilidades
    let n2 = 0, pL = 0, pR = 0;
    for (let i = 0; i < N; i++) {
      const r = psi[2*i], im = psi[2*i+1];
      const rho = (r*r + im*im) * DX;
      n2 += rho;
      if (XS[i] < 0) pL += rho; else pR += rho;
    }
    normRef.current = n2;
  }, [running, speed]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={10} autoRotate bloomIntensity={0.9} bloomThreshold={0.08}>
          <WaveScene
            psiRef={psiRef}
            pot={pot}
            stepFn={stepFn}
            running={running}
            normRef={normRef}
            timeRef={timeRef}
            onStats={(n, t, pl, pr) => {
              setNorm(n);
              setSimT(t);
              setProbL(pl);
              setProbR(pr);
            }}
          />
        </Stage>

        {/* HUD — métricas en vivo */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">t&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {simT.toFixed(2)} ℏ/Eₕ</div>
          <div><span className="text-[#64748B]">||ψ||²&nbsp;</span>= <span className={Math.abs(norm - 1) > 0.01 ? 'text-[#F87171]' : 'text-[#4ADE80]'}>{norm.toFixed(5)}</span></div>
          <div><span className="text-[#64748B]">P(x&lt;0)</span>= {(probL * 100).toFixed(1)}%</div>
          <div><span className="text-[#64748B]">P(x&gt;0)</span>= {(probR * 100).toFixed(1)}%</div>
        </div>

        {/* Leyenda de fase */}
        <div className="absolute top-4 right-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-3 py-2 text-[10px] text-[#94A3B8]">
          <div className="mb-1 font-semibold text-[#CBD5E1]">Fase ψ</div>
          <div className="flex items-center gap-1.5">
            <div className="w-24 h-2 rounded" style={{ background: 'linear-gradient(90deg,#ff4444,#aaff44,#44ffff,#aa44ff,#ff4444)' }} />
          </div>
          <div className="flex justify-between text-[9px] mt-0.5">
            <span>0</span><span>π/2</span><span>π</span><span>3π/2</span><span>2π</span>
          </div>
        </div>

        {/* Controles */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</IconBtn>
          <IconBtn onClick={() => reset(potId)} title="Reiniciar">↺</IconBtn>
          <div className="flex items-center gap-2 ml-2">
            <span className="text-[11px] text-[#64748B] font-mono">×</span>
            <input
              type="range" min={0.2} max={4} step={0.1} value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-[11px] text-white font-mono w-6">{speed.toFixed(1)}</span>
          </div>
        </div>
      </div>

      <LessonPanel<QMLessonState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.potId !== undefined) {
            setPotId(patch.potId);
            reset(patch.potId);
          }
        }}
        sandbox={
          <>
            <Section title="Potencial V(x)">
              <div className="grid grid-cols-1 gap-1.5">
                {POTENTIALS.map(p => (
                  <button key={p.id} onClick={() => { setPotId(p.id); reset(p.id); }}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      potId === p.id
                        ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#818CF8]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}>{p.name}</button>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-[#94A3B8] leading-relaxed italic">{pot.note}</div>
            </Section>

            {audience !== 'child' && (
              <Section title="Estado cuántico">
                <Row label="t"      value={`${simT.toFixed(2)} ℏ/Eₕ`} />
                <Row label="||ψ||²" value={norm.toFixed(6)} highlight={Math.abs(norm - 1) > 0.005} />
                <Row label="P(x&lt;0)" value={`${(probL * 100).toFixed(1)}%`} />
                <Row label="P(x&gt;0)" value={`${(probR * 100).toFixed(1)}%`} />
                <div className="mt-2 text-[10px] text-[#64748B]">
                  Split-Step Fourier O(Δt²). N={N}, Δx={DX.toFixed(3)} a₀, Δt={DT} ℏ/Eₕ.
                </div>
              </Section>
            )}

            {audience === 'child' && (
              <Section title="Lo que ves">
                <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
                  <p>La curva brillante es la <span className="text-[#FDE68A]">probabilidad</span> de encontrar la partícula en cada punto.</p>
                  <p>Los colores del arco iris muestran la <span className="text-[#A78BFA]">fase</span> — cuánto ha "girado" la función de onda.</p>
                  <p>Cuando la probabilidad aparece al otro lado de la barrera: <span className="text-white font-semibold">eso es el túnel cuántico</span>.</p>
                </div>
              </Section>
            )}

            {audience === 'researcher' && (
              <Section title="Integrador SSF">
                <Row label="N" value={`${N} pts`} />
                <Row label="Δx" value={`${DX.toFixed(4)} a₀`} />
                <Row label="Δt" value={`${DT} ℏ/Eₕ`} />
                <Row label="Sub-pasos/frame" value={`${SUB}×${speed.toFixed(1)}`} />
                <div className="mt-2 text-[10px] text-[#64748B] font-mono leading-snug">
                  FFT Cooley-Tukey in-place.<br/>
                  Error global O(Δt², Δx²).<br/>
                  Unitario: ||ψ||² conservado.
                </div>
              </Section>
            )}

            <Section title="Ecuación">
              <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                <div className="text-white">iℏ ∂ψ/∂t = Hψ</div>
                <div className="text-[#94A3B8]">H = −ℏ²/2m ∂²/∂x² + V(x)</div>
                <div className="mt-1 text-[#64748B] text-[10px]">SSF: exp(−iHΔt) ≈</div>
                <div className="text-[#64748B] text-[10px]">e^(−iVΔt/2ℏ) · e^(−iKΔt/ℏ) · e^(−iVΔt/2ℏ)</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ─── Escena 3D (DENTRO del Canvas — useFrame permitido) ───────────────

interface WaveSceneProps {
  psiRef:   React.MutableRefObject<Float64Array>;
  pot:      PotentialDef;
  stepFn:   () => void;
  running:  boolean;
  normRef:  React.MutableRefObject<number>;
  timeRef:  React.MutableRefObject<number>;
  onStats:  (norm: number, t: number, probL: number, probR: number) => void;
}

function WaveScene({ psiRef, pot, stepFn, running, normRef, timeRef, onStats }: WaveSceneProps) {
  const tex = useMemo(() => getParticleTexture(), []);

  // Tubo de |ψ|² — TubeGeometry dinámico
  const tubeRef    = useRef<THREE.Mesh>(null);
  const tubeMatRef = useRef<THREE.MeshStandardMaterial>(null);

  // Geometry del tubo (se reconstruye por completo en cada frame para la forma dinámica)
  // Usamos un Line simple: BufferGeometry con posiciones
  const waveGeo   = useRef<THREE.BufferGeometry>(null!);
  const wavePos   = useRef<Float32Array>(new Float32Array(N * 3));
  const phaseGeo  = useRef<THREE.BufferGeometry>(null!);
  const phasePos  = useRef<Float32Array>(new Float32Array(N * 3));
  const phaseCol  = useRef<Float32Array>(new Float32Array(N * 3));

  // Nube de probabilidad
  const cloudGeo  = useRef<THREE.BufferGeometry>(null!);
  const cloudPos  = useRef<Float32Array>(new Float32Array(CLOUD_N * 3));
  const cloudCol  = useRef<Float32Array>(new Float32Array(CLOUD_N * 3));

  // Potencial — geometry estática (se rehace solo al cambiar pot)
  const potGeo    = useRef<THREE.BufferGeometry>(null!);
  const potPos    = useRef<Float32Array>(new Float32Array(N * 3));

  // Inicializar geometrías
  useMemo(() => {
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(wavePos.current, 3));
    waveGeo.current = wg;

    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(phasePos.current, 3));
    pg.setAttribute('color',    new THREE.BufferAttribute(phaseCol.current, 3));
    phaseGeo.current = pg;

    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(cloudPos.current, 3));
    cg.setAttribute('color',    new THREE.BufferAttribute(cloudCol.current, 3));
    cloudGeo.current = cg;

    const vg = new THREE.BufferGeometry();
    vg.setAttribute('position', new THREE.BufferAttribute(potPos.current, 3));
    potGeo.current = vg;
  }, []);

  // Reconstruir curva del potencial al cambiar pot
  useMemo(() => {
    const pp = potPos.current;
    let vMax = 0;
    for (let i = 0; i < N; i++) {
      const v = Math.abs(pot.V(XS[i]));
      if (v > vMax) vMax = v;
    }
    const vNorm = vMax > 0 ? 1 / vMax : 1;
    for (let i = 0; i < N; i++) {
      const x = xWorld(XS[i]);
      const v = pot.V(XS[i]) * vNorm * V_SCALE * 0.8;
      pp[i*3+0] = x;
      pp[i*3+1] = v - 1.4;   // debajo de la función de onda
      pp[i*3+2] = 0;
    }
    if (potGeo.current) {
      (potGeo.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pot]);

  // Ref para throttle de stats
  const lastStats = useRef(0);

  useFrame((_state, delta) => {
    // 1. Avanzar la simulación
    stepFn();

    const psi = psiRef.current;

    // 2. Extraer |ψ|² y fase para visualización
    const wp = wavePos.current;
    const pp = phasePos.current;
    const pc = phaseCol.current;

    // Encontrar máximo para normalizar visualmente
    let rhoMax = 0;
    for (let i = 0; i < N; i++) {
      const r = psi[2*i], im = psi[2*i+1];
      const rho = r*r + im*im;
      if (rho > rhoMax) rhoMax = rho;
    }
    const rhoNorm = rhoMax > 1e-12 ? 1 / rhoMax : 1;

    // Llenar posiciones y colores de fase
    for (let i = 0; i < N; i++) {
      const r = psi[2*i], im = psi[2*i+1];
      const rho = r*r + im*im;
      const y = Math.sqrt(rho * rhoNorm) * VIS_SCALE;
      const x = xWorld(XS[i]);

      wp[i*3+0] = x;  wp[i*3+1] = y;  wp[i*3+2] = 0;
      pp[i*3+0] = x;  pp[i*3+1] = y + 0.02;  pp[i*3+2] = 0;

      // Color por fase: hue = atan2(im,re) / (2π) mapeado a RGB HSL
      const hue = (Math.atan2(im, r) / (2 * Math.PI) + 1) % 1;
      const amp = Math.min(rho * rhoNorm * 2.5, 1.0);
      hslToRgb(hue, 1.0, 0.6, pc, i*3, amp);
    }

    (waveGeo.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (phaseGeo.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (phaseGeo.current.attributes.color    as THREE.BufferAttribute).needsUpdate = true;

    // 3. Nube de probabilidad — samplear puntos proporcional a |ψ|²
    const cp = cloudPos.current;
    const cc = cloudCol.current;
    // Muestreo simple por rechazo
    let ci = 0;
    let tries = 0;
    while (ci < CLOUD_N && tries < CLOUD_N * 10) {
      tries++;
      const idx = Math.floor(Math.random() * N);
      const r = psi[2*idx], im = psi[2*idx+1];
      const rho = (r*r + im*im) * rhoNorm;
      if (Math.random() < rho) {
        const x = xWorld(XS[idx]) + (Math.random() - 0.5) * 0.08;
        const yBase = Math.sqrt(rho) * VIS_SCALE;
        const y = yBase + (Math.random() - 0.5) * 0.15;
        cp[ci*3+0] = x;
        cp[ci*3+1] = y;
        cp[ci*3+2] = (Math.random() - 0.5) * 0.3;
        // Color amarillo-dorado para la nube de probabilidad
        cc[ci*3+0] = 1.0;
        cc[ci*3+1] = 0.85 + Math.random() * 0.1;
        cc[ci*3+2] = 0.2 + Math.random() * 0.2;
        ci++;
      }
    }
    // Llenar resto con puntos en el origen (invisibles)
    for (let j = ci; j < CLOUD_N; j++) {
      cp[j*3+0] = 0; cp[j*3+1] = -99; cp[j*3+2] = 0;
    }
    (cloudGeo.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (cloudGeo.current.attributes.color    as THREE.BufferAttribute).needsUpdate = true;

    // 4. Stats para UI — cada 150ms
    const now = performance.now();
    if (now - lastStats.current > 150) {
      lastStats.current = now;
      let pL = 0, pR = 0;
      for (let i = 0; i < N; i++) {
        const r2 = psi[2*i], im2 = psi[2*i+1];
        const rho = (r2*r2 + im2*im2) * DX;
        if (XS[i] < 0) pL += rho; else pR += rho;
      }
      onStats(normRef.current, timeRef.current, pL, pR);
      void delta; // suppress unused
    }
  });

  return (
    <>
      {/* Luz puntual en el centro — ilumina la escena con cálido */}
      <pointLight position={[0, 2, 3]} intensity={1.2} color="#FDE68A" distance={20} />
      <pointLight position={[0, 1, -2]} intensity={0.8} color="#818CF8" distance={15} />

      {/* Curva |ψ|² — línea emisiva principal */}
      <line>
        <primitive object={waveGeo.current} attach="geometry" />
        <lineBasicMaterial
          color="#FDE68A"
          toneMapped={false}
          transparent
          opacity={0.95}
        />
      </line>

      {/* Fase — puntos coloreados superpuestos */}
      <points geometry={phaseGeo.current}>
        <pointsMaterial
          vertexColors
          map={tex}
          alphaMap={tex}
          size={0.12}
          sizeAttenuation
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>

      {/* Nube de probabilidad aditiva */}
      <points geometry={cloudGeo.current}>
        <pointsMaterial
          vertexColors
          map={tex}
          alphaMap={tex}
          size={0.18}
          sizeAttenuation
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>

      {/* Potencial V(x) — curva verde tenue abajo */}
      <line>
        <primitive object={potGeo.current} attach="geometry" />
        <lineBasicMaterial
          color="#4ADE80"
          toneMapped={false}
          transparent
          opacity={0.65}
        />
      </line>

      {/* Eje X — referencia */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[X_SCALE * 2 * 0.5, 0.012, 0.012]} />
        <meshStandardMaterial color="#334155" emissive="#1E293B" emissiveIntensity={0.5} />
      </mesh>

      {/* Suelo grid de referencia */}
      <group position={[0, -1.6, 0]}>
        <gridHelper args={[X_SCALE * 2.2, 30, '#1E293B', '#0F172A']} />
      </group>

      {/* Barrera / Pozo indicator — esfera emisiva en el centro del potencial */}
      <PotentialMarker pot={pot} />
    </>
  );
}

// Marcadores visuales del potencial (static, no necesitan useFrame)
function PotentialMarker({ pot }: { pot: PotentialDef }) {
  if (pot.id === 'barrier') {
    return (
      <>
        {/* Dos postes de la barrera */}
        <mesh position={[xWorld(-0.8), -0.3, 0]}>
          <boxGeometry args={[0.04, 1.4, 0.04]} />
          <meshStandardMaterial color="#4ADE80" emissive="#4ADE80" emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
        <mesh position={[xWorld(0.8), -0.3, 0]}>
          <boxGeometry args={[0.04, 1.4, 0.04]} />
          <meshStandardMaterial color="#4ADE80" emissive="#4ADE80" emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.38, 0]}>
          <boxGeometry args={[xWorld(0.8) - xWorld(-0.8), 0.04, 0.04]} />
          <meshStandardMaterial color="#4ADE80" emissive="#4ADE80" emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
      </>
    );
  }
  if (pot.id === 'well') {
    return (
      <>
        {/* Paredes del pozo */}
        <mesh position={[xWorld(-2.0), -0.7, 0]}>
          <boxGeometry args={[0.04, 1.2, 0.04]} />
          <meshStandardMaterial color="#38BDF8" emissive="#38BDF8" emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
        <mesh position={[xWorld(2.0), -0.7, 0]}>
          <boxGeometry args={[0.04, 1.2, 0.04]} />
          <meshStandardMaterial color="#38BDF8" emissive="#38BDF8" emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
      </>
    );
  }
  if (pot.id === 'double_well') {
    return (
      <>
        {/* Dos mínimos del doble pozo */}
        <mesh position={[xWorld(-3.0), -1.3, 0]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color="#A78BFA" emissive="#A78BFA" emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
        <mesh position={[xWorld(3.0), -1.3, 0]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color="#A78BFA" emissive="#A78BFA" emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
      </>
    );
  }
  // Armónico: esfera central
  return (
    <mesh position={[0, -1.3, 0]}>
      <sphereGeometry args={[0.10, 16, 16]} />
      <meshStandardMaterial color="#FB923C" emissive="#FB923C" emissiveIntensity={1.0} toneMapped={false} />
    </mesh>
  );
}

// ─── HSL → RGB para colorear por fase ─────────────────────────────────
function hslToRgb(h: number, s: number, l: number, arr: Float32Array, off: number, alpha: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  const sector = Math.floor(h * 6);
  if      (sector === 0) { r=c; g=x; b=0; }
  else if (sector === 1) { r=x; g=c; b=0; }
  else if (sector === 2) { r=0; g=c; b=x; }
  else if (sector === 3) { r=0; g=x; b=c; }
  else if (sector === 4) { r=x; g=0; b=c; }
  else                    { r=c; g=0; b=x; }
  arr[off+0] = (r + m) * alpha;
  arr[off+1] = (g + m) * alpha;
  arr[off+2] = (b + m) * alpha;
}

// ─── UI helpers ────────────────────────────────────────────────────────

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
function IconBtn({ children, onClick, active, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; title?: string }) {
  return (
    <button onClick={onClick} title={title}
      className={`w-9 h-9 rounded-md border text-[14px] transition flex items-center justify-center ${
        active
          ? 'border-[#818CF8]/60 text-[#818CF8] bg-[#818CF8]/10'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}>
      {children}
    </button>
  );
}
