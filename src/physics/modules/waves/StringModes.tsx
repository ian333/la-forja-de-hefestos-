/**
 * Modos normales de cuerda y membrana circular — física real en 3D.
 *
 * FÍSICA IMPLEMENTADA:
 *
 * 1. CUERDA (1D) — modos analíticos exactos:
 *    u_n(x,t) = A·sin(nπx/L)·cos(2πf_n·t + φ)
 *    f_n = n·c / (2L),    n = 1, 2, 3, …
 *    c = √(T/μ)  (tensión / densidad lineal)
 *
 * 2. MEMBRANA CIRCULAR (2D) — modos de Bessel exactos:
 *    u_{mn}(r,θ,t) = J_m(α_{mn}·r/R)·cos(mθ)·cos(2πf_{mn}·t)
 *    f_{mn} = α_{mn}·c / (2πR)
 *    α_{mn} = n-ésimo cero de J_m (tabla precalculada a 6 cifras)
 *    J_m calculada con serie de Taylor de 30 términos (física real, sin librería)
 *
 * 3. SUPERPOSICIÓN — suma lineal de armónicos con amplitudes A_n:
 *    u_total = Σ A_n · u_n(x,t)
 *
 * Visualización cine:
 *   - CUERDA: tubo emisivo (BufferGeometry line) + nube de puntos en antinodos
 *   - MEMBRANA: malla de superficie 3D (PlaneGeometry desplazada en Y) + bloom
 *   - autoRotate lento — la escena se contempla
 *   - Materiales emisivos (emissive + toneMapped=false) → bloom garantizado
 *
 * Regla useFrame: SOLO en sub-componentes dentro de <Stage> (dentro del Canvas).
 */

import { useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

// ── Tipos ─────────────────────────────────────────────────────────────

type ViewId = 'string' | 'membrane';
type ModeId = 'n1' | 'n2' | 'n3' | 'n4' | 'super' | 'bessel01' | 'bessel11' | 'bessel21' | 'bessel02';

interface ModesLessonState {
  view: ViewId;
  mode: ModeId;
  c: number;
}

// ── Constantes físicas ────────────────────────────────────────────────

const L      = 6.0;       // longitud de la cuerda (m)
const R_MEM  = 2.8;       // radio de la membrana (m)
const N_STR  = 280;       // puntos a lo largo de la cuerda
const N_R    = 52;        // puntos radiales de la membrana
const N_TH   = 96;        // puntos angulares de la membrana
const AMP    = 1.0;       // amplitud visual base

/**
 * Ceros de Bessel α_{mn}: n-ésimo cero de J_m.
 * Valores de tablas estándar (Abramowitz & Stegun), 6 cifras significativas.
 *   m=0: J_0(α)=0  → 2.40483, 5.52008, 8.65373, 11.7915
 *   m=1: J_1(α)=0  → 3.83171, 7.01559, 10.1735
 *   m=2: J_2(α)=0  → 5.13562, 8.41724
 */
const BESSEL_ZEROS: Record<number, number[]> = {
  0: [2.40483, 5.52008, 8.65373, 11.7915],
  1: [3.83171, 7.01559, 10.1735],
  2: [5.13562, 8.41724],
};

/**
 * J_m(x) — función de Bessel de primer tipo, orden m, argumento real.
 * Serie de Taylor:  J_m(x) = Σ_{k=0}^{K} (-1)^k / (k! · Γ(m+k+1)) · (x/2)^{2k+m}
 * Usamos 30 términos — error < 1e-12 para x < 15.
 */
function besselJ(m: number, x: number): number {
  if (x === 0) return m === 0 ? 1 : 0;
  let sum = 0;
  let term = 1;
  // term_0 = (x/2)^m / m!
  const half_x = x / 2;
  for (let j = 1; j <= m; j++) term *= half_x / j;   // (x/2)^m / m!
  sum = term;
  for (let k = 1; k <= 30; k++) {
    term *= -(half_x * half_x) / (k * (m + k));
    sum += term;
    if (Math.abs(term) < 1e-14 * Math.abs(sum)) break;
  }
  return sum;
}

// ── Lección pedagógica ────────────────────────────────────────────────

const LESSON: Lesson<ModesLessonState> = {
  hook: {
    title: 'Una guitarra y un tambor comparten el mismo secreto matemático.',
    body: `Tocas una guitarra: su cuerda vibra en formas muy específicas — no cualquier ondulación, solo patrones particulares llamados modos normales. Golpeas un tambor: su membrana baila en patrones circulares con simetría extraña.

¿Por qué esas formas y no otras? Porque la física es una ecuación de valores propios: las únicas formas de vibrar son aquellas que se repiten periódicamente con frecuencia fija.

Para la cuerda, esos modos son senos:  u_n = sin(nπx/L)
Para la membrana circular, son funciones de Bessel:  u_{mn} = J_m(α_{mn}·r/R)·cos(mθ)

Estas no son aproximaciones ni modelos. Son las soluciones exactas de la ecuación de onda con condiciones de borde. Lo que aquí renderizas es la matemática en 3D.`,
  },

  steps: [
    {
      title: 'Modo fundamental de la cuerda — el primer armónico',
      duration: 6000,
      body: `El modo más simple: n=1. La cuerda forma una media sinusoide que sube y baja completa.

La forma de vibración es siempre u₁(x) = sin(πx/L). La frecuencia es:
f₁ = c / (2L)

donde c = √(T/μ) depende de la tensión y la densidad lineal. Es la nota fundamental — el "do" de tu instrumento.

Observa que los EXTREMOS son nodos fijos (u=0 en x=0 y x=L). Exactamente en el medio hay un antinodo — el punto de máxima vibración.

Esta es la razón por la que puedes dividir una guitarra a la mitad de su escala y subir exactamente una octava: si L/2 entonces f₁ se duplica.`,
      formula: 'u₁(x,t) = A·sin(πx/L)·cos(2πf₁t)\nf₁ = c/(2L) = √(T/μ)/(2L)',
      keyframes: [
        { at: 0, state: { view: 'string', mode: 'n1', c: 1 } },
        { at: 1, state: { view: 'string', mode: 'n1', c: 1 } },
      ],
    },
    {
      title: 'Armónicos superiores — n=2, 3, 4',
      duration: 7000,
      body: `Al aumentar n, aparecen más nodos intermedios. El modo n tiene n-1 nodos internos y n antinodos.

La frecuencia del modo n es exactamente n veces la fundamental:
f_n = n · c/(2L) = n · f₁

Esto NO es coincidencia — es la razón de por qué los instrumentos de cuerda suenan "armoniosos". Las frecuencias son múltiplos enteros exactos. Tu oído percibe esa regularidad como timbre rico y consonante.

El modo n=2 suena una octava arriba que n=1. El n=3 es una quinta por encima de la octava. La serie 1:2:3:4 es la base de la armonía occidental.

Observa cómo la nube de partículas marca los antinodos de cada modo.`,
      formula: 'f_n = n·c/(2L),  n ∈ ℕ\nf₂ = 2f₁  (octava)\nf₃ = 3f₁  (octava + quinta)',
      keyframes: [
        { at: 0,    state: { view: 'string', mode: 'n1', c: 1 } },
        { at: 0.33, state: { view: 'string', mode: 'n2', c: 1 } },
        { at: 0.66, state: { view: 'string', mode: 'n3', c: 1 } },
        { at: 1,    state: { view: 'string', mode: 'n4', c: 1 } },
      ],
    },
    {
      title: 'Superposición de armónicos — el timbre',
      duration: 6500,
      body: `Una cuerda real NUNCA vibra en un modo puro. Vibra en la superposición de todos sus modos:
u(x,t) = Σ A_n · sin(nπx/L) · cos(2πf_n·t)

Las amplitudes A_n dependen de cómo tocas el instrumento. Un pellizco en el centro excita mucho n=1 y poco los pares. Un pellizco cerca del puente excita más los armónicos altos.

Esta suma es la Serie de Fourier aplicada a la dinámica. El "timbre" — la diferencia entre un violín y una flauta tocando la misma nota — es exactamente cuáles A_n son grandes y cuáles son pequeños.

Aquí muestro n=1+2+3 con amplitudes 1, 0.5, 0.25 (decaen como 1/n). La forma resultante NO es una sinusoide — es una onda compleja que se repite con período 1/f₁.`,
      formula: 'u = Σ_{n=1}^{N} A_n·sin(nπx/L)·cos(2πnf₁t)\nA_n ∝ 1/n  (decaída natural de armónicos)',
      keyframes: [
        { at: 0, state: { view: 'string', mode: 'super', c: 1 } },
        { at: 1, state: { view: 'string', mode: 'super', c: 1 } },
      ],
    },
    {
      title: 'Membrana circular — modos de Bessel J₀',
      duration: 6500,
      body: `Cambiamos a una membrana circular de radio R con borde fijo u(R,θ,t)=0. La solución exacta es:

u_{0n}(r,t) = J₀(α_{0n}·r/R) · cos(2πf_{0n}·t)

J₀ es la función de Bessel de orden 0 — tiene simetría radial perfecta. El primer modo tiene un solo lóbulo central (toda la membrana se mueve junta). Los siguientes tienen anillos nodales.

Los α_{0n} son los ceros de J₀: α₀₁=2.405, α₀₂=5.520, α₀₃=8.654...

Las frecuencias son f_{0n} = α_{0n}·c/(2πR). ¡No son múltiplos enteros! Por eso el tambor NO suena armónico como una guitarra. Sus frecuencias están en razón 1 : 2.295 : 3.598... — una relación irracional.`,
      formula: 'u_{0n} = J₀(α_{0n}·r/R)·cos(2πf_{0n}t)\nα₀₁=2.405, α₀₂=5.520  (ceros de J₀)\nf_{0n} = α_{0n}·c/(2πR)',
      keyframes: [
        { at: 0, state: { view: 'membrane', mode: 'bessel01', c: 1 } },
        { at: 1, state: { view: 'membrane', mode: 'bessel01', c: 1 } },
      ],
    },
    {
      title: 'Modos angulares J₁ y J₂ — rompiendo la simetría',
      duration: 7000,
      body: `Los modos con m > 0 rompen la simetría circular. Tienen variación angular cos(mθ):

u_{mn}(r,θ,t) = J_m(α_{mn}·r/R)·cos(mθ)·cos(2πf_{mn}·t)

Para m=1: la membrana tiene un lóbulo que sube y otro que baja (como un balancín). Para m=2: cuatro cuadrantes alternados.

Son los "modos de saddle" — lo que ves son las figuras de Chladni en 3D. Si espolvoreas arena sobre una membrana vibrante en estos modos, la arena se acumula exactamente en los nodos (donde u=0 siempre).

Ernst Chladni los demostró con arena en 1787. Hoy los ingenieros los usan para el diseño de resonadores MEMS, tímpanos artificiales y antenas de radar.`,
      formula: 'u_{mn} = J_m(α_{mn}·r/R)·cos(mθ)·cos(ωt)\nm=0: simetría radial\nm=1: dipolo (balancín)\nm=2: cuadrupolo (saddle)',
      keyframes: [
        { at: 0,    state: { view: 'membrane', mode: 'bessel01', c: 1 } },
        { at: 0.35, state: { view: 'membrane', mode: 'bessel11', c: 1 } },
        { at: 0.7,  state: { view: 'membrane', mode: 'bessel21', c: 1 } },
        { at: 1,    state: { view: 'membrane', mode: 'bessel02', c: 1 } },
      ],
    },
  ],

  connect: {
    body: `Los modos normales son la estructura más profunda de la física ondulatoria.

• Átomos: los orbitales electrónicos (s, p, d, f) son los modos normales de la ecuación de Schrödinger para un potencial coulombiano. Los nodos radiales y angulares son exactamente análogos a los nodos de la cuerda y la membrana.

• Óptica: los modos de una cavidad láser (TEM₀₀, TEM₀₁, …) son los modos normales de la ecuación de Helmholtz — la versión estacionaria de la ecuación de onda.

• Mecánica cuántica de campo: los "fotones" son cuantos del campo electromagnético, y el campo mismo es la superposición de sus modos normales. La cuantización reemplaza amplitudes por operadores de creación/destrucción.

• Sismos: los modos normales de la Tierra (oscilaciones libres) se miden con sismógrafos tras terremotos grandes. El modo ₀S₂ tiene período ~54 minutos.

• Diseño industrial: el análisis modal por elementos finitos (FEM) calcula los modos normales de cualquier estructura — puentes, turbinas, aviones — para evitar resonancias catastróficas.`,
    links: [
      { label: 'Cuerda vibrante FDTD — Wave1D', href: '#wave-1d' },
      { label: 'Ecuación de calor — difusión', href: '#heat-1d' },
      { label: 'Oscilador cuántico — Schrödinger 1D', href: '#schrodinger-1d' },
    ],
  },
};

// ── Tablas de modos ────────────────────────────────────────────────────

interface StringModeConfig {
  kind: 'string';
  ns: number[];           // índices de modo n a superponer
  amps: number[];         // amplitudes de cada modo
}
interface MembraneConfig {
  kind: 'membrane';
  m: number;              // orden azimutal
  n: number;              // índice del cero de Bessel (1-based)
  alpha: number;          // cero de Bessel α_{mn}
}
type ModeConfig = StringModeConfig | MembraneConfig;

function getModeConfig(id: ModeId): ModeConfig {
  switch (id) {
    case 'n1':       return { kind: 'string', ns: [1], amps: [1.0] };
    case 'n2':       return { kind: 'string', ns: [2], amps: [1.0] };
    case 'n3':       return { kind: 'string', ns: [3], amps: [1.0] };
    case 'n4':       return { kind: 'string', ns: [4], amps: [1.0] };
    case 'super':    return { kind: 'string', ns: [1,2,3,4], amps: [1.0, 0.5, 0.25, 0.125] };
    case 'bessel01': return { kind: 'membrane', m: 0, n: 1, alpha: BESSEL_ZEROS[0][0] };
    case 'bessel11': return { kind: 'membrane', m: 1, n: 1, alpha: BESSEL_ZEROS[1][0] };
    case 'bessel21': return { kind: 'membrane', m: 2, n: 1, alpha: BESSEL_ZEROS[2][0] };
    case 'bessel02': return { kind: 'membrane', m: 0, n: 2, alpha: BESSEL_ZEROS[0][1] };
  }
}

/** Frecuencia del modo de cuerda n (Hz), con c en m/s */
function stringFreq(n: number, c: number): number {
  return (n * c) / (2 * L);
}

/** Frecuencia del modo de membrana (m,n) */
function membraneFreq(alpha: number, c: number): number {
  return (alpha * c) / (2 * Math.PI * R_MEM);
}

// ── Escena: CUERDA vibrante ───────────────────────────────────────────

const PART_COUNT = 500;

function makePartGeom() {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(PART_COUNT * 3);
  const col = new Float32Array(PART_COUNT * 3);
  for (let i = 0; i < PART_COUNT; i++) pos[i * 3 + 1] = -999;
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color',    new THREE.BufferAttribute(col, 3));
  return g;
}

function StringScene({
  mode, c, running,
}: { mode: StringModeConfig; c: number; running: boolean }) {
  const positions = useMemo(() => new Float32Array(N_STR * 3), []);
  const lineGeom  = useRef<THREE.BufferGeometry>(null);
  const partGeom  = useMemo(() => makePartGeom(), []);
  const partLife  = useMemo(() => new Float32Array(PART_COUNT), []);
  const partIdx   = useRef(0);
  const frameRef  = useRef(0);
  const timeRef   = useRef(0);

  // Inicializar posiciones X
  useMemo(() => {
    for (let i = 0; i < N_STR; i++) {
      positions[i * 3 + 0] = (i / (N_STR - 1)) * L - L / 2;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }
  }, [positions]);

  useFrame((_, delta) => {
    if (running) timeRef.current += delta;
    const t = timeRef.current;

    // Calcular desplazamiento en cada punto
    const posArr = positions;
    let peak = 0;
    for (let i = 0; i < N_STR; i++) {
      const x = (i / (N_STR - 1)) * L;  // 0 … L
      let u = 0;
      for (let k = 0; k < mode.ns.length; k++) {
        const n  = mode.ns[k];
        const An = mode.amps[k];
        const fn = stringFreq(n, c);
        u += An * Math.sin((n * Math.PI * x) / L) * Math.cos(2 * Math.PI * fn * t);
      }
      // Normalizar por suma de amplitudes
      const totalAmp = mode.amps.reduce((a, b) => a + b, 0);
      u = (u / totalAmp) * AMP;
      if (Math.abs(u) > peak) peak = Math.abs(u);
      posArr[i * 3 + 1] = u;
    }
    if (lineGeom.current) {
      (lineGeom.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // Partículas en antinodos
    frameRef.current += 1;
    if (frameRef.current % 2 === 0) {
      const pG   = partGeom;
      const pPos = pG.attributes.position as THREE.BufferAttribute;
      const pCol = pG.attributes.color    as THREE.BufferAttribute;
      const pP   = pPos.array as Float32Array;
      const pC   = pCol.array as Float32Array;

      for (let i = 2; i < N_STR - 2; i++) {
        const yi = posArr[i * 3 + 1];
        const absY = Math.abs(yi);
        if (absY < 0.25 * AMP) continue;
        if (Math.random() > 0.06) continue;

        const pi = partIdx.current % PART_COUNT;
        partIdx.current += 1;
        const x = posArr[i * 3 + 0];
        pP[pi * 3 + 0] = x + (Math.random() - 0.5) * 0.15;
        pP[pi * 3 + 1] = yi + (Math.random() - 0.5) * 0.15;
        pP[pi * 3 + 2] = (Math.random() - 0.5) * 0.3;

        const tn = Math.min(1, absY / AMP);
        // Cyan → dorado según energía
        pC[pi * 3 + 0] = 0.31 + tn * 0.69;
        pC[pi * 3 + 1] = 0.76 - tn * 0.46;
        pC[pi * 3 + 2] = 0.97 - tn * 0.97;
        partLife[pi] = 1.0;
      }

      // Envejecer partículas
      for (let pi = 0; pi < PART_COUNT; pi++) {
        if (partLife[pi] <= 0) continue;
        partLife[pi] -= 0.035;
        if (partLife[pi] <= 0) {
          pP[pi * 3 + 1] = -999;
          partLife[pi] = 0;
        } else {
          pP[pi * 3 + 1] += 0.007 * partLife[pi];
        }
      }

      pPos.needsUpdate = true;
      pCol.needsUpdate = true;
    }
  });

  // Marcadores de nodo: puntos en los ceros de cada modo
  const nodePositions = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let k = 0; k < mode.ns.length; k++) {
      const n = mode.ns[k];
      // Nodos en x = j·L/n, j = 0..n (incluyendo extremos)
      for (let j = 0; j <= n; j++) {
        pts.push([(j / n) * L - L / 2, 0, 0]);
      }
    }
    return pts;
  }, [mode]);

  return (
    <>
      {/* Eje de reposo */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.007, 0.007, L, 8]} />
        <meshStandardMaterial color="#1E293B" transparent opacity={0.4} />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.007, 0.007, L, 8]} />
        <meshStandardMaterial color="#1E293B" transparent opacity={0.4} />
      </mesh>

      {/* Postes en extremos */}
      {([-L / 2, L / 2] as number[]).map((xp, k) => (
        <mesh key={k} position={[xp, 0, 0]}>
          <sphereGeometry args={[0.12, 20, 20]} />
          <meshStandardMaterial
            color="#EF5350"
            emissive="#EF5350"
            emissiveIntensity={2.0}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Marcadores de nodo (esferas pequeñas) */}
      {nodePositions.slice(1, -1).map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial
            color="#64748B"
            emissive="#334155"
            emissiveIntensity={0.8}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* La cuerda vibrante */}
      <line>
        <bufferGeometry ref={lineGeom}>
          <bufferAttribute
            attach="attributes-position"
            count={N_STR}
            array={positions}
            itemSize={3}
            args={[positions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#FDB813" linewidth={3} toneMapped={false} />
      </line>

      {/* Nube de partículas */}
      <points geometry={partGeom}>
        <pointsMaterial
          vertexColors
          size={0.11}
          sizeAttenuation
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>

      {/* Grid */}
      <gridHelper args={[L * 2, 16, '#0F172A', '#0F172A']} position={[0, -AMP * 1.8, 0]} />
    </>
  );
}

// ── Escena: MEMBRANA circular ─────────────────────────────────────────

/**
 * Genera BufferGeometry para la membrana con N_R × N_TH puntos.
 * Coordenadas en reposo: r ∈ [0, R_MEM], θ ∈ [0, 2π).
 * Los vértices se ordenan en una grilla triangulada (triángulos de strip circular).
 */
function buildMembraneGeometry(): THREE.BufferGeometry {
  // Vértices: N_R × N_TH puntos + punto central
  const vertCount = 1 + N_R * N_TH;
  const positions = new Float32Array(vertCount * 3);
  const uvs       = new Float32Array(vertCount * 2);

  // Centro
  positions[0] = 0; positions[1] = 0; positions[2] = 0;
  uvs[0] = 0.5; uvs[1] = 0.5;

  for (let ri = 0; ri < N_R; ri++) {
    const r = ((ri + 1) / N_R) * R_MEM;
    for (let ti = 0; ti < N_TH; ti++) {
      const theta = (ti / N_TH) * 2 * Math.PI;
      const vi = 1 + ri * N_TH + ti;
      positions[vi * 3 + 0] = r * Math.cos(theta);
      positions[vi * 3 + 1] = 0;
      positions[vi * 3 + 2] = r * Math.sin(theta);
      uvs[vi * 2 + 0] = 0.5 + 0.5 * (r / R_MEM) * Math.cos(theta);
      uvs[vi * 2 + 1] = 0.5 + 0.5 * (r / R_MEM) * Math.sin(theta);
    }
  }

  // Índices de triángulos
  const idxList: number[] = [];

  // Fan del centro al primer anillo
  for (let ti = 0; ti < N_TH; ti++) {
    const a = 1 + ti;
    const b = 1 + (ti + 1) % N_TH;
    idxList.push(0, a, b);
  }

  // Strips entre anillos
  for (let ri = 0; ri < N_R - 1; ri++) {
    for (let ti = 0; ti < N_TH; ti++) {
      const a = 1 + ri * N_TH + ti;
      const b = 1 + ri * N_TH + (ti + 1) % N_TH;
      const c = 1 + (ri + 1) * N_TH + ti;
      const d = 1 + (ri + 1) * N_TH + (ti + 1) % N_TH;
      idxList.push(a, c, b);
      idxList.push(b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(idxList);
  geom.computeVertexNormals();
  return geom;
}

function MembraneScene({
  mode, c, running,
}: { mode: MembraneConfig; c: number; running: boolean }) {
  const geom    = useMemo(() => buildMembraneGeometry(), []);
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  // Tabla de J_m en los vértices (solo depende de m, alpha)
  const jVals = useMemo(() => {
    const posArr = geom.attributes.position.array as Float32Array;
    const count  = geom.attributes.position.count;
    const vals   = new Float32Array(count);
    for (let vi = 0; vi < count; vi++) {
      const x = posArr[vi * 3 + 0];
      const z = posArr[vi * 3 + 2];
      const r = Math.sqrt(x * x + z * z);
      const theta = Math.atan2(z, x);
      const arg   = (mode.alpha * r) / R_MEM;
      vals[vi] = besselJ(mode.m, arg) * Math.cos(mode.m * theta);
    }
    // Normalizar por max |J_m(α·r/R)| = J_m(0) si m=0 else J_m(primer max)
    let maxVal = 0;
    for (let vi = 0; vi < count; vi++) {
      if (Math.abs(vals[vi]) > maxVal) maxVal = Math.abs(vals[vi]);
    }
    if (maxVal > 1e-10) {
      for (let vi = 0; vi < count; vi++) vals[vi] /= maxVal;
    }
    return vals;
  }, [geom, mode]);

  useFrame((_, delta) => {
    if (running) timeRef.current += delta;
    const t = timeRef.current;

    const fn   = membraneFreq(mode.alpha, c);
    const cosT = Math.cos(2 * Math.PI * fn * t);

    if (!meshRef.current) return;
    const posAttr = meshRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr     = posAttr.array as Float32Array;
    const count   = posAttr.count;

    for (let vi = 0; vi < count; vi++) {
      arr[vi * 3 + 1] = jVals[vi] * AMP * cosT;
    }
    posAttr.needsUpdate = true;
    meshRef.current.geometry.computeVertexNormals();
  });

  // Color de la superficie basado en desplazamiento
  // Usamos una textura de color de vértice: cyan positivo, rojo negativo
  const colorAttr = useMemo(() => {
    const count = geom.attributes.position.count;
    const cols  = new Float32Array(count * 3);
    // Inicial: todo cero → gris
    for (let i = 0; i < count; i++) {
      cols[i * 3 + 0] = 0.2;
      cols[i * 3 + 1] = 0.3;
      cols[i * 3 + 2] = 0.4;
    }
    const attr = new THREE.BufferAttribute(cols, 3);
    geom.setAttribute('color', attr);
    return attr;
  }, [geom]);

  // Actualizar colores sincrónicamente con el frame en un segundo useFrame
  const colorTimeRef = useRef(0);
  useFrame((_, delta) => {
    if (running) colorTimeRef.current += delta;
    const t  = colorTimeRef.current;
    const fn = membraneFreq(mode.alpha, c);
    const cosT = Math.cos(2 * Math.PI * fn * t);
    const arr  = colorAttr.array as Float32Array;
    const count = jVals.length;
    for (let vi = 0; vi < count; vi++) {
      const u01 = jVals[vi] * cosT;   // -1 … 1
      // u>0: cyan/dorado, u<0: azul oscuro
      const tp = Math.max(0, u01);
      const tn = Math.max(0, -u01);
      arr[vi * 3 + 0] = 0.1 + tp * 0.85 + tn * 0.05;   // R
      arr[vi * 3 + 1] = 0.2 + tp * 0.55 + tn * 0.10;   // G
      arr[vi * 3 + 2] = 0.3 + tp * 0.10 + tn * 0.65;   // B
    }
    colorAttr.needsUpdate = true;
  });

  return (
    <>
      {/* Membrana */}
      <mesh ref={meshRef} geometry={geom}>
        <meshStandardMaterial
          vertexColors
          emissive={new THREE.Color(0.05, 0.15, 0.25)}
          emissiveIntensity={0.6}
          side={THREE.DoubleSide}
          metalness={0.1}
          roughness={0.4}
          toneMapped={false}
        />
      </mesh>

      {/* Borde de la membrana — círculo emisivo */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[R_MEM, 0.04, 12, 96]} />
        <meshStandardMaterial
          color="#EF5350"
          emissive="#EF5350"
          emissiveIntensity={2.0}
          toneMapped={false}
        />
      </mesh>

      {/* Grid bajo la membrana */}
      <gridHelper
        args={[R_MEM * 2.8, 14, '#0F172A', '#0F172A']}
        position={[0, -AMP * 1.6, 0]}
      />
    </>
  );
}

// ── Selector de escena ─────────────────────────────────────────────────

function SceneSelector({
  view, modeId, c, running,
}: { view: ViewId; modeId: ModeId; c: number; running: boolean }) {
  const cfg = getModeConfig(modeId);
  if (view === 'string' && cfg.kind === 'string') {
    return <StringScene mode={cfg} c={c} running={running} />;
  }
  if (view === 'membrane' && cfg.kind === 'membrane') {
    return <MembraneScene mode={cfg} c={c} running={running} />;
  }
  // fallback: si el view no coincide con el modo, usar config por defecto
  if (view === 'string') {
    return <StringScene mode={{ kind: 'string', ns: [1], amps: [1] }} c={c} running={running} />;
  }
  return <MembraneScene mode={{ kind: 'membrane', m: 0, n: 1, alpha: BESSEL_ZEROS[0][0] }} c={c} running={running} />;
}

// ── Componente exportado ──────────────────────────────────────────────

export default function StringModes() {
  const { audience } = useAudience();

  const [view,    setView]    = useState<ViewId>('string');
  const [modeId,  setModeId]  = useState<ModeId>('n1');
  const [c,       setC]       = useState(1.0);
  const [running, setRunning] = useState(true);

  const handleApplyState = useCallback((patch: Partial<ModesLessonState>) => {
    if (patch.view   !== undefined) { setView(patch.view); setModeId(patch.view === 'string' ? 'n1' : 'bessel01'); }
    if (patch.mode   !== undefined) {
      setModeId(patch.mode);
      const cfg = getModeConfig(patch.mode);
      setView(cfg.kind === 'string' ? 'string' : 'membrane');
    }
    if (patch.c      !== undefined) setC(patch.c);
  }, []);

  // Modo activo real
  const cfg = getModeConfig(modeId);

  // Frecuencias a mostrar
  const freqInfo: string[] = [];
  if (cfg.kind === 'string') {
    for (let k = 0; k < cfg.ns.length; k++) {
      const n  = cfg.ns[k];
      const fn = stringFreq(n, c);
      freqInfo.push(`f${n} = ${fn.toFixed(3)} Hz`);
    }
  } else {
    const fn = membraneFreq(cfg.alpha, c);
    freqInfo.push(`f_{${cfg.m}${cfg.n}} = ${fn.toFixed(3)} Hz`);
    freqInfo.push(`α_{${cfg.m}${cfg.n}} = ${cfg.alpha.toFixed(5)}`);
  }

  const STRING_MODES: { id: ModeId; label: string; blurb: string }[] = [
    { id: 'n1',    label: 'Modo n=1 (fundamental)',  blurb: `f₁ = c/2L = ${stringFreq(1,c).toFixed(3)} Hz` },
    { id: 'n2',    label: 'Modo n=2 (1er armónico)', blurb: `f₂ = 2·f₁ = ${stringFreq(2,c).toFixed(3)} Hz` },
    { id: 'n3',    label: 'Modo n=3 (2do armónico)', blurb: `f₃ = 3·f₁ = ${stringFreq(3,c).toFixed(3)} Hz` },
    { id: 'n4',    label: 'Modo n=4 (3er armónico)', blurb: `f₄ = 4·f₁ = ${stringFreq(4,c).toFixed(3)} Hz` },
    { id: 'super', label: 'Superposición n=1…4',     blurb: 'A_n = 1, ½, ¼, ⅛  (serie Fourier)' },
  ];
  const MEM_MODES: { id: ModeId; label: string; blurb: string }[] = [
    { id: 'bessel01', label: 'J₀ — modo (0,1)',   blurb: `α=2.405  f=${membraneFreq(BESSEL_ZEROS[0][0],c).toFixed(3)} Hz` },
    { id: 'bessel11', label: 'J₁ — modo (1,1)',   blurb: `α=3.832  f=${membraneFreq(BESSEL_ZEROS[1][0],c).toFixed(3)} Hz` },
    { id: 'bessel21', label: 'J₂ — modo (2,1)',   blurb: `α=5.136  f=${membraneFreq(BESSEL_ZEROS[2][0],c).toFixed(3)} Hz` },
    { id: 'bessel02', label: 'J₀ — modo (0,2)',   blurb: `α=5.520  f=${membraneFreq(BESSEL_ZEROS[0][1],c).toFixed(3)} Hz` },
  ];

  const camDist = view === 'string' ? L * 1.3 : R_MEM * 3.2;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      {/* ── Canvas R3F ──────────────────────────────────────────────── */}
      <div className="relative">
        <Stage
          cameraDistance={camDist}
          bloomIntensity={0.9}
          bloomThreshold={0.08}
          autoRotate
          bgColor="#05060A"
          enablePan
        >
          <SceneSelector
            view={view}
            modeId={modeId}
            c={c}
            running={running}
          />
        </Stage>

        {/* HUD overlay */}
        <div className="absolute top-3 left-3 rounded-lg bg-[#05060A]/80 backdrop-blur
                        border border-[#1E293B] px-3 py-2 font-mono text-[11px] text-[#CBD5E1] space-y-1">
          <div className="text-[#FDB813] font-semibold">
            {view === 'string' ? 'Cuerda — modos normales' : 'Membrana circular — Bessel'}
          </div>
          {freqInfo.map((f, i) => (
            <div key={i} className="text-[#94A3B8]">{f}</div>
          ))}
          {cfg.kind === 'string' && cfg.ns.length > 1 && (
            <div className="text-[#64748B] text-[10px]">superposición: {cfg.ns.length} modos</div>
          )}
          {cfg.kind === 'membrane' && (
            <div className="text-[#64748B] text-[10px]">
              J_{cfg.m}(α·r/R)·cos({cfg.m}θ)·cos(ωt)
            </div>
          )}
          <div className="text-[#64748B] text-[10px]">c = {c.toFixed(2)} m/s</div>
        </div>

        {/* Controles de reproducción */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2
                        bg-[#05060A]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <CtrlBtn onClick={() => setRunning(r => !r)} active={running}>
            {running ? '❚❚' : '▶'}
          </CtrlBtn>
        </div>
      </div>

      {/* ── Panel pedagógico ────────────────────────────────────────── */}
      <LessonPanel<ModesLessonState>
        lesson={LESSON}
        onApplyState={handleApplyState}
        sandbox={
          <>
            {/* Vista */}
            <div className="p-3 border-b border-[#1E293B]">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-2">Vista</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(['string', 'membrane'] as ViewId[]).map(v => (
                  <button
                    key={v}
                    onClick={() => {
                      setView(v);
                      setModeId(v === 'string' ? 'n1' : 'bessel01');
                    }}
                    className={`text-[11px] px-2 py-1.5 rounded border transition ${
                      view === v
                        ? 'bg-[#FDB813]/10 border-[#FDB813]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#FDB813]/30'
                    }`}
                  >
                    {v === 'string' ? 'Cuerda' : 'Membrana'}
                  </button>
                ))}
              </div>
            </div>

            {/* Modos de cuerda */}
            {view === 'string' && (
              <div className="p-3 border-b border-[#1E293B]">
                <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-2">Modo de la cuerda</div>
                <div className="space-y-1">
                  {STRING_MODES.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setModeId(opt.id)}
                      className={`w-full text-left text-[11px] px-2.5 py-1.5 rounded border transition ${
                        modeId === opt.id
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
            )}

            {/* Modos de membrana */}
            {view === 'membrane' && (
              <div className="p-3 border-b border-[#1E293B]">
                <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-2">Modo de Bessel J_m</div>
                <div className="space-y-1">
                  {MEM_MODES.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setModeId(opt.id)}
                      className={`w-full text-left text-[11px] px-2.5 py-1.5 rounded border transition ${
                        modeId === opt.id
                          ? 'bg-[#A78BFA]/15 border-[#A78BFA]/50 text-white'
                          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#A78BFA]/30'
                      }`}
                    >
                      <div className="font-semibold">{opt.label}</div>
                      <div className="text-[10px] text-[#64748B]">{opt.blurb}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Velocidad de onda */}
            <div className="p-3 border-b border-[#1E293B]">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-2">Velocidad de onda c</div>
              <label className="block text-[11px] text-[#94A3B8]">
                c = <span className="font-mono text-[#FDB813]">{c.toFixed(2)}</span> m/s
              </label>
              <input
                type="range"
                min={0.2}
                max={4.0}
                step={0.05}
                value={c}
                onChange={e => setC(parseFloat(e.target.value))}
                className="w-full accent-[#FDB813] mt-1"
              />
              <div className="text-[10px] text-[#64748B] mt-1">
                c = √(T/μ) — más tensión o menos densidad → c mayor
              </div>
            </div>

            {/* Estado en tiempo real */}
            <div className="p-3 border-b border-[#1E293B]">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-2">Frecuencias</div>
              <div className="space-y-0.5 font-mono text-[11px]">
                {cfg.kind === 'string' && cfg.ns.map((n, k) => (
                  <div key={n} className="flex justify-between">
                    <span className="text-[#64748B]">f_{n}</span>
                    <span className="text-white">{stringFreq(n, c).toFixed(4)} Hz</span>
                  </div>
                ))}
                {cfg.kind === 'membrane' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">α_{cfg.m}{cfg.n}</span>
                      <span className="text-white">{cfg.alpha.toFixed(5)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">f_{cfg.m}{cfg.n}</span>
                      <span className="text-white">{membraneFreq(cfg.alpha, c).toFixed(4)} Hz</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Info técnica para researcher */}
            {audience === 'researcher' && (
              <div className="p-3 text-[10px] text-[#64748B] leading-relaxed space-y-1">
                <div className="text-[#94A3B8] font-semibold">Física</div>
                {cfg.kind === 'string' ? (
                  <>
                    <div>u_n(x,t) = sin(nπx/L)·cos(2πf_n t)</div>
                    <div>f_n = n·c/(2L),  L = {L} m</div>
                    <div>Puntos: {N_STR},  superposición lineal</div>
                  </>
                ) : (
                  <>
                    <div>u = J_{cfg.m}(α·r/R)·cos({cfg.m}θ)·cos(ωt)</div>
                    <div>J_m serie Taylor 30 términos</div>
                    <div>R = {R_MEM} m,  malla {N_R}×{N_TH}</div>
                    <div>α_{cfg.m}{cfg.n} = {cfg.alpha.toFixed(5)} (cero de J_{cfg.m})</div>
                  </>
                )}
              </div>
            )}
          </>
        }
      />
    </div>
  );
}

// ── UI helpers ────────────────────────────────────────────────────────

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
