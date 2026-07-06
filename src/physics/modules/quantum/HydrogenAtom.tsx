/**
 * Átomo de Hidrógeno — orbitales ψ_nlm en 3D cine.
 *
 * FÍSICA REAL:
 *   ψ_nlm(r,θ,φ) = R_nl(r) · Y_lm(θ,φ)
 *
 *   Parte radial — funciones de Laguerre asociadas:
 *     R_nl(r) = −√[(2/na₀)³ (n−l−1)!/(2n[(n+l)!]³)] · e^(−r/na₀)
 *               · (2r/na₀)^l · L^(2l+1)_{n−l−1}(2r/na₀)
 *
 *   Armónicos esféricos reales Y_lm:
 *     Y_00  = 1/(2√π)
 *     Y_10  = (1/2)√(3/π)·cos θ
 *     Y_11c = (1/2)√(3/π)·sin θ·cos φ  (m=+1, parte real)
 *     Y_11s = (1/2)√(3/π)·sin θ·sin φ  (m=−1, parte imag)
 *     … etc. (implementados exactamente, sin aproximación)
 *
 *   Niveles de energía (Bohr):
 *     E_n = −13.6 eV / n²
 *
 * VISUALIZACIÓN 3D CINE:
 *   - Monte Carlo de rechazo: ~20 000 puntos muestreados con P ∝ |ψ_nlm|²
 *   - Color → módulo |ψ|² (azul oscuro → blanco brillante)
 *   - Nube additive blending, toneMapped=false → bloom REVIENTA en el Stage
 *   - Stage autoRotate lento — el orbital se CONTEMPLA
 *
 * REGLA useFrame: SOLO dentro del sub-componente OrbitalCloud (hijo de Stage).
 */

import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import { getParticleTexture } from '@/labs/components/sprite-texture';

// ─── Constantes físicas ───────────────────────────────────────────────────────
// Unidades atómicas: a₀ = radio de Bohr = 1
const A0 = 1.0;

// ─── Funciones matemáticas exactas ───────────────────────────────────────────

/** Factorial (entero pequeño). */
function fact(n: number): number {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/**
 * Polinomio de Laguerre asociado L^α_k(x) — recurrencia de tres términos.
 * L^α_0 = 1, L^α_1 = 1+α−x,
 * (k+1)L^α_{k+1} = (2k+1+α−x)L^α_k − (k+α)L^α_{k−1}
 */
function laguerreAssoc(k: number, alpha: number, x: number): number {
  if (k === 0) return 1;
  if (k === 1) return 1 + alpha - x;
  let Lm1 = 1, L0 = 1 + alpha - x, Lc = 0;
  for (let j = 1; j < k; j++) {
    Lc = ((2 * j + 1 + alpha - x) * L0 - (j + alpha) * Lm1) / (j + 1);
    Lm1 = L0;
    L0 = Lc;
  }
  return L0;
}

/**
 * Parte radial R_nl(r) de los orbitales del hidrógeno.
 * Normalizada: ∫₀^∞ |R_nl|² r² dr = 1
 *
 * Formula: R_nl = −√[(2/na₀)³ · (n−l−1)! / (2n·(n+l)!³)] ·
 *           e^(−r/na₀) · (2r/na₀)^l · L^(2l+1)_{n−l−1}(2r/na₀)
 *
 * Nota: el signo leading no afecta a |ψ|², lo omitimos.
 */
function radial(n: number, l: number, r: number): number {
  const rho = (2 * r) / (n * A0);          // variable adimensional
  const norm = Math.sqrt(
    Math.pow(2 / (n * A0), 3) *
    fact(n - l - 1) / (2 * n * Math.pow(fact(n + l), 3))
  );
  const poly = laguerreAssoc(n - l - 1, 2 * l + 1, rho);
  return norm * Math.exp(-r / (n * A0)) * Math.pow(rho, l) * poly;
}

/**
 * Armónico esférico REAL Y_lm(θ,φ).
 * Solo se implementan los que usamos: l ∈ {0,1,2,3}.
 * Convenio: m > 0 → parte coseno, m < 0 → parte seno.
 * Normalización: ∫|Y_lm|² dΩ = 1
 */
function sphericalHarmonic(l: number, m: number, theta: number, phi: number): number {
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  const cp2 = Math.cos(2 * phi);
  const sp2 = Math.sin(2 * phi);
  const cp3 = Math.cos(3 * phi);
  const sp3 = Math.sin(3 * phi);

  if (l === 0 && m === 0) return 0.5 / Math.sqrt(Math.PI);
  if (l === 1 && m === 0) return 0.5 * Math.sqrt(3 / Math.PI) * ct;
  if (l === 1 && m === 1) return 0.5 * Math.sqrt(3 / Math.PI) * st * cp;
  if (l === 1 && m === -1) return 0.5 * Math.sqrt(3 / Math.PI) * st * sp;

  if (l === 2 && m === 0) return 0.25 * Math.sqrt(5 / Math.PI) * (3 * ct * ct - 1);
  if (l === 2 && m === 1) return 0.5 * Math.sqrt(15 / Math.PI) * st * ct * cp;
  if (l === 2 && m === -1) return 0.5 * Math.sqrt(15 / Math.PI) * st * ct * sp;
  if (l === 2 && m === 2) return 0.25 * Math.sqrt(15 / Math.PI) * st * st * cp2;
  if (l === 2 && m === -2) return 0.25 * Math.sqrt(15 / Math.PI) * st * st * sp2;

  if (l === 3 && m === 0) return 0.25 * Math.sqrt(7 / Math.PI) * ct * (5 * ct * ct - 3);
  if (l === 3 && m === 1) return 0.125 * Math.sqrt(42 / Math.PI) * st * (5 * ct * ct - 1) * cp;
  if (l === 3 && m === -1) return 0.125 * Math.sqrt(42 / Math.PI) * st * (5 * ct * ct - 1) * sp;
  if (l === 3 && m === 2) return 0.25 * Math.sqrt(105 / Math.PI) * st * st * ct * cp2;
  if (l === 3 && m === -2) return 0.25 * Math.sqrt(105 / Math.PI) * st * st * ct * sp2;
  if (l === 3 && m === 3) return 0.125 * Math.sqrt(70 / Math.PI) * st * st * st * cp3;
  if (l === 3 && m === -3) return 0.125 * Math.sqrt(70 / Math.PI) * st * st * st * sp3;

  return 0;
}

/**
 * Densidad de probabilidad |ψ_nlm(r,θ,φ)|² en coordenadas cartesianas.
 * x,y,z en unidades de a₀.
 */
function psi2(n: number, l: number, m: number, x: number, y: number, z: number): number {
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r < 1e-12) return 0;
  const theta = Math.acos(Math.max(-1, Math.min(1, z / r)));
  const phi = Math.atan2(y, x);
  const R = radial(n, l, r);
  const Y = sphericalHarmonic(l, m, theta, phi);
  return R * R * Y * Y;
}

// ─── Monte Carlo para muestrear |ψ|² ──────────────────────────────────────────

/**
 * Muestreo por rechazo de `count` puntos distribuidos según |ψ_nlm|².
 * Caja de muestreo adaptativa: ±boxR en cada eje.
 * psiMax: estimado del máximo de |ψ|² para el rechazo.
 * Devuelve Float32Array [x0,y0,z0, x1,y1,z1, ...] + Float32Array de intensidades.
 */
function sampleOrbital(
  n: number, l: number, m: number,
  count: number,
  boxR: number,
  psiMax: number,
): { positions: Float32Array; intensities: Float32Array } {
  const positions = new Float32Array(count * 3);
  const intensities = new Float32Array(count);
  let filled = 0;
  const inv = 1 / psiMax;
  // Budget de intentos: evitar loop infinito
  const budget = count * 200;
  let tries = 0;
  while (filled < count && tries < budget) {
    tries++;
    const x = (Math.random() * 2 - 1) * boxR;
    const y = (Math.random() * 2 - 1) * boxR;
    const z = (Math.random() * 2 - 1) * boxR;
    const p = psi2(n, l, m, x, y, z);
    if (Math.random() < p * inv) {
      positions[filled * 3 + 0] = x;
      positions[filled * 3 + 1] = y;
      positions[filled * 3 + 2] = z;
      intensities[filled] = Math.min(1, p * inv);
      filled++;
    }
  }
  return { positions, intensities };
}

// ─── Configuración de los orbitales ──────────────────────────────────────────

interface OrbitalDef {
  id: string;
  label: string;
  name: string;
  n: number; l: number; m: number;
  /** Radio de la caja de muestreo en a₀ */
  boxR: number;
  /** Estimado del máximo de |ψ|² — calibrado empíricamente para cada orbital */
  psiMax: number;
  /** Color base del cloud */
  color: [number, number, number];
  /** Nota corta para la UI */
  note: string;
}

const ORBITALS: OrbitalDef[] = [
  {
    id: '1s', label: '1s', name: '1s — Estado base', n: 1, l: 0, m: 0,
    boxR: 6, psiMax: 0.32,
    color: [0.3, 0.7, 1.0],
    note: 'Esférico. El electrón está en promedio a 1.5 a₀ del núcleo. E₁ = −13.6 eV.',
  },
  {
    id: '2s', label: '2s', name: '2s', n: 2, l: 0, m: 0,
    boxR: 14, psiMax: 0.026,
    color: [0.4, 0.9, 0.5],
    note: 'Esférico con un nodo radial (esfera de nodo interno). E₂ = −3.4 eV.',
  },
  {
    id: '2pz', label: '2p_z', name: '2p_z  (m=0)', n: 2, l: 1, m: 0,
    boxR: 16, psiMax: 0.012,
    color: [1.0, 0.65, 0.2],
    note: 'Dos lóbulos a lo largo del eje Z. Es el orbital de enlace σ en moléculas lineales.',
  },
  {
    id: '2px', label: '2p_x', name: '2p_x  (m=+1)', n: 2, l: 1, m: 1,
    boxR: 16, psiMax: 0.012,
    color: [1.0, 0.4, 0.55],
    note: 'Dos lóbulos a lo largo del eje X. Degenerado con 2p_z en H (sin campo externo).',
  },
  {
    id: '3dz2', label: '3d_z²', name: '3d_z²  (m=0)', n: 3, l: 2, m: 0,
    boxR: 26, psiMax: 0.0015,
    color: [0.9, 0.3, 1.0],
    note: 'Dos lóbulos polares + toro ecuatorial. Clave en la química de los metales de transición.',
  },
  {
    id: '3dxz', label: '3d_xz', name: '3d_xz  (m=+1)', n: 3, l: 2, m: 1,
    boxR: 26, psiMax: 0.0015,
    color: [0.2, 0.85, 0.9],
    note: 'Cuatro lóbulos en el plano XZ. Participa en los orbitales d de los complejos octaédricos.',
  },
  {
    id: '3dxy', label: '3d_xy', name: '3d_xy  (m=−2)', n: 3, l: 2, m: -2,
    boxR: 26, psiMax: 0.0015,
    color: [0.95, 0.85, 0.2],
    note: 'Cuatro lóbulos en el plano XY. Forma la simetría de los cristales cúbicos.',
  },
  {
    id: '4f', label: '4f_z³', name: '4f_z³  (m=0)', n: 4, l: 3, m: 0,
    boxR: 42, psiMax: 0.00018,
    color: [0.5, 1.0, 0.7],
    note: 'Orbital f: 8 lóbulos en cono polar. Característico de los lantánidos y actínidos.',
  },
];

// Número de puntos en la nube
const CLOUD_N = 22_000;

// ─── Lección pedagógica ───────────────────────────────────────────────────────

interface HLessonState { orbId: string }

const LESSON: Lesson<HLessonState> = {
  hook: {
    title: 'El electrón no orbita. Es una nube de probabilidad con forma exacta.',
    body: `Bohr (1913) dio la imagen de electrones como planetas: órbitas circulares, radios fijos. Funcionaba para el espectro del hidrógeno. Pero era INCORRECTA como descripción de la naturaleza.

Schrödinger (1926) resolvió la ecuación que lleva su nombre para el potencial coulombiano V = −e²/r.

Las soluciones son funciones de onda ψ_nlm(r,θ,φ). Su módulo al cuadrado |ψ|² es la densidad de probabilidad: la probabilidad de encontrar el electrón en el elemento de volumen dV en r,θ,φ.

Tres números cuánticos, uno por grado de libertad del espacio 3D:
• n ∈ {1,2,3,...} → energía: E_n = −13.6 eV / n²
• l ∈ {0,...,n−1} → momento angular orbital: L = ℏ√(l(l+1))
• m ∈ {−l,...,+l} → componente z del momento: Lz = mℏ

La nube que ves aquí es |ψ_nlm|² muestreada con Monte Carlo (rechazo). Cada punto tiene probabilidad real de encontrar el electrón ahí.`,
  },

  steps: [
    {
      title: '1s — el estado base esférico',
      duration: 6000,
      body: `El orbital 1s es el de menor energía: E₁ = −13.6 eV.

ψ_100 = (1/√π) · (1/a₀)^(3/2) · e^(−r/a₀)

La función de onda decae exponencialmente desde el núcleo. La densidad radial de probabilidad P(r) = |R₁₀|² r² tiene su máximo en r = a₀ = 0.529 Å — el radio de Bohr.

La nube es perfectamente esférica: l=0, m=0, sin dirección preferida en el espacio. La nube brillante en el centro muestra que el electrón pasa mucho tiempo DENTRO del núcleo.`,
      formula: 'ψ_100 = (1/√π) · a₀^(−3/2) · e^(−r/a₀)\nE₁ = −13.6 eV\n⟨r⟩ = 3a₀/2',
      keyframes: [
        { at: 0, state: { orbId: '1s' } },
        { at: 1, state: { orbId: '1s' } },
      ],
    },
    {
      title: '2s — primer nodo radial',
      duration: 6000,
      body: `El orbital 2s tiene n=2, l=0: mismo momento angular que 1s (esférico), pero E₂ = −13.6/4 = −3.4 eV.

ψ_200 ∝ (2 − r/a₀) · e^(−r/2a₀)

El factor (2 − r/a₀) se anula en r = 2a₀. Eso es el NODO RADIAL: una esfera donde ψ=0 y el electrón nunca aparece.

Nota la shell vacía interna y la densa nube exterior. La presencia del nodo es la razón por la que la estructura electrónica de los átomos produce capas (shells) — y por ende la tabla periódica.`,
      formula: 'ψ_200 = (1/4√2π) · a₀^(−3/2) · (2−r/a₀) · e^(−r/2a₀)\nnodo radial: r = 2a₀\nE₂ = −3.4 eV',
      keyframes: [
        { at: 0, state: { orbId: '2s' } },
        { at: 1, state: { orbId: '2s' } },
      ],
    },
    {
      title: '2p_z — lóbulos direccionales',
      duration: 6000,
      body: `El orbital 2p_z: n=2, l=1, m=0. El momento angular orbital es L=ℏ√2.

ψ_210 ∝ r · e^(−r/2a₀) · cos θ

El armónico esférico Y₁₀ ∝ cos θ crea DOS LÓBULOS a lo largo del eje Z. En el plano ecuatorial θ=π/2, cos θ=0: es el NODO ANGULAR.

Compara con 1s: misma energía que 2s (degeneración H), pero FORMA RADICALMENTE diferente. La dirección del orbital define cómo el átomo forma enlaces — σ (cabeza a cabeza) o π (lateral).`,
      formula: 'ψ_210 = (1/4√2π) · a₀^(−3/2) · (r/a₀) · e^(−r/2a₀) · cos θ\nnodo angular: θ = π/2 (plano xy)\nL = ℏ√2, Lz = 0',
      keyframes: [
        { at: 0, state: { orbId: '2pz' } },
        { at: 1, state: { orbId: '2pz' } },
      ],
    },
    {
      title: '3d — geometría de la química de transición',
      duration: 7000,
      body: `El orbital 3d_z² (n=3, l=2, m=0). E₃ = −13.6/9 ≈ −1.51 eV.

Y₂₀ ∝ (3cos²θ − 1): DOS lóbulos polares + UN TORO en el ecuador.

Los 5 orbitales 3d (m = −2,−1,0,+1,+2) son degenerados en el hidrógeno aislado. En los complejos de metales de transición (Fe, Cu, Ni…) los ligandos rompen esa degeneración (campo cristalino) — el splitting de energía determina el color de los complejos y sus propiedades magnéticas.

El 3d_xy (m=−2) tiene cuatro lóbulos en el plano XY — geométricamente diferente al 3d_z², aunque misma energía.`,
      formula: 'Y₂₀ ∝ 3cos²θ − 1\nY₂₋₂ ∝ sin²θ · sin(2φ)\nE_n = −13.6/n² eV  (n=3 → −1.51 eV)',
      keyframes: [
        { at: 0, state: { orbId: '3dz2' } },
        { at: 1, state: { orbId: '3dz2' } },
      ],
    },
    {
      title: '4f — lantánidos y actínidos',
      duration: 6000,
      body: `El orbital 4f_z³ (n=4, l=3, m=0). E₄ = −13.6/16 ≈ −0.85 eV.

Con l=3, el momento angular es L=ℏ√12. Los 7 orbitales f (m=−3…+3) crean geometrías de 8 lóbulos o toros complejos.

Los orbitales f son los orbitales de Valencia de los lantánidos (La-Lu) y actínidos (Ac-Lr). Su gran número de electrones y estados casi-degenerados genera:
• Las propiedades magnéticas únicas de los imanes de tierras raras (Nd, Sm)
• Los colores vivos de los lantánidos en solución
• La complejidad de los isótopos radiactivos de los actínidos

Contempla la simetría: cada lóbulo es una región donde el electrón tiene probabilidad significativa.`,
      formula: 'Y₃₀ ∝ cos θ · (5cos²θ − 3)\nl=3: L = ℏ√12, m ∈ {−3,…,+3}\nE₄ = −0.85 eV',
      keyframes: [
        { at: 0, state: { orbId: '4f' } },
        { at: 1, state: { orbId: '4f' } },
      ],
    },
  ],

  connect: {
    body: `Los orbitales del hidrógeno son la base de TODA la química cuántica.

La Aproximación de Orbital Molecular (MO theory) construye las funciones de onda moleculares como combinaciones lineales de orbitales atómicos (LCAO). El H₂ surge de combinar dos 1s: un orbital enlazante σ y uno antienlazante σ*.

Los principios que emergen de este módulo:
• Aufbau: los electrones llenan los orbitales de menor energía primero.
• Pauli: máximo 2 electrones por orbital (con spines opuestos).
• Hund: los orbitales degenerados se llenan con spin paralelo primero.

Juntos explican la estructura de la tabla periódica entera — desde el H (1s¹) hasta el Og (7p⁶).

Las técnicas de cálculo modernas (DFT, HF, MP2, CCSD) computan |ψ|² para sistemas con millones de electrones, pero el insight conceptual viene de estos orbitales simples del hidrógeno.`,
    links: [
      { label: 'Schrödinger 1D — túnel cuántico', href: '#schrodinger-1d' },
      { label: 'Espectro atómico real — líneas de Balmer', href: '#atomic-spectrum' },
      { label: 'Mecánica cuántica — postulados formales', href: '/math.html#quantum-postulates' },
    ],
  },
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function HydrogenAtom() {
  const { audience } = useAudience();
  const [orbId, setOrbId] = useState('1s');
  const [showNodes, setShowNodes] = useState(false);

  const orb = ORBITALS.find(o => o.id === orbId)!;

  // Cloud data — se recalcula al cambiar orbital
  const cloudData = useMemo(() => {
    return sampleOrbital(orb.n, orb.l, orb.m, CLOUD_N, orb.boxR, orb.psiMax);
  }, [orbId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scale world: normalizamos a ±5 unidades de escena para cualquier orbital
  const worldScale = 5.0 / orb.boxR;

  const En = -13.6 / (orb.n * orb.n);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={9} autoRotate bloomIntensity={0.95} bloomThreshold={0.06}>
          <OrbitalCloud
            cloudData={cloudData}
            color={orb.color}
            worldScale={worldScale}
            showNodes={showNodes}
            n={orb.n} l={orb.l} m={orb.m}
            boxR={orb.boxR}
          />
        </Stage>

        {/* HUD — info cuántica */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">n&nbsp;&nbsp;&nbsp;</span>= {orb.n}</div>
          <div><span className="text-[#64748B]">l&nbsp;&nbsp;&nbsp;</span>= {orb.l}</div>
          <div><span className="text-[#64748B]">m&nbsp;&nbsp;&nbsp;</span>= {orb.m}</div>
          <div><span className="text-[#64748B]">E_n&nbsp;</span>= <span className="text-[#FDE68A]">{En.toFixed(2)} eV</span></div>
        </div>

        {/* Leyenda de intensidad */}
        <div className="absolute top-4 right-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-3 py-2 text-[10px] text-[#94A3B8]">
          <div className="mb-1 font-semibold text-[#CBD5E1]">|ψ|²</div>
          <div className="flex items-center gap-1.5">
            <div className="w-20 h-2 rounded" style={{
              background: `linear-gradient(90deg, rgba(${orb.color.map(c => Math.round(c * 30)).join(',')},0.15), rgb(${orb.color.map(c => Math.round(c * 255)).join(',')}))`
            }} />
          </div>
          <div className="flex justify-between text-[9px] mt-0.5">
            <span>bajo</span><span>alto</span>
          </div>
        </div>

        {/* Controles inferiores */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-4 py-2">
          <label className="flex items-center gap-2 text-[11px] text-[#94A3B8] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showNodes}
              onChange={e => setShowNodes(e.target.checked)}
              className="accent-violet-400"
            />
            nodos
          </label>
          <span className="text-[#1E293B]">|</span>
          <span className="text-[11px] text-[#64748B] font-mono">{CLOUD_N.toLocaleString()} pts Monte Carlo</span>
        </div>
      </div>

      <LessonPanel<HLessonState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.orbId !== undefined) setOrbId(patch.orbId);
        }}
        sandbox={
          <>
            <Section title="Orbital">
              <div className="grid grid-cols-2 gap-1.5">
                {ORBITALS.map(o => (
                  <button
                    key={o.id}
                    onClick={() => setOrbId(o.id)}
                    className={`text-left px-3 py-2 rounded-md border text-[11px] font-mono transition ${
                      orbId === o.id
                        ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#818CF8]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}
                  >{o.label}</button>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-[#94A3B8] leading-relaxed italic">{orb.note}</div>
            </Section>

            {audience !== 'child' && (
              <Section title="Números cuánticos">
                <Row label="n (principal)" value={`${orb.n}`} />
                <Row label="l (angular)" value={`${orb.l}`} />
                <Row label="m (magnético)" value={`${orb.m}`} />
                <Row label="E_n" value={`${En.toFixed(3)} eV`} />
                <Row label="L" value={`ℏ√${orb.l * (orb.l + 1)}`} />
                <Row label="Lz" value={`${orb.m}ℏ`} />
                <div className="mt-2 text-[10px] text-[#64748B]">
                  Nodos radiales: {orb.n - orb.l - 1} | Nodos angulares: {orb.l}
                </div>
              </Section>
            )}

            {audience === 'child' && (
              <Section title="Lo que ves">
                <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
                  <p>Cada punto es una zona donde el electrón puede aparecer.</p>
                  <p>La nube brillante = alta probabilidad. Las zonas oscuras = el electrón casi nunca está ahí.</p>
                  <p>Activa <span className="text-white">"nodos"</span> para ver las superficies donde el electrón NUNCA aparece.</p>
                </div>
              </Section>
            )}

            {audience === 'researcher' && (
              <Section title="Física">
                <div className="text-[10px] font-mono text-[#94A3B8] leading-snug space-y-1">
                  <div>ψ_nlm = R_nl(r) · Y_lm(θ,φ)</div>
                  <div className="text-[#64748B]">R_nl: Laguerre asoc. L^(2l+1)_(n−l−1)</div>
                  <div className="text-[#64748B]">a₀ = 0.529 Å = 1 (UA)</div>
                  <div className="mt-1">E_n = −13.6/{orb.n}² = {En.toFixed(3)} eV</div>
                  <div className="mt-1 text-[#64748B]">Monte Carlo por rechazo.</div>
                  <div className="text-[#64748B]">p(x) = |ψ|²/|ψ|²_max</div>
                  <div className="text-[#64748B]">N = {CLOUD_N.toLocaleString()} puntos.</div>
                </div>
              </Section>
            )}

            <Section title="Ecuación">
              <div className="text-[10px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                <div className="text-white">Ĥψ = Eψ</div>
                <div className="text-[#94A3B8]">Ĥ = −ℏ²/2m ∇² − e²/r</div>
                <div className="mt-1 text-[#64748B]">Autovalores: E_n = −13.6/n² eV</div>
                <div className="text-[#64748B]">Autofunciones: ψ_nlm = R_nl · Y_lm</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ─── Escena 3D — DENTRO del Canvas (useFrame permitido) ──────────────────────

interface OrbitalCloudProps {
  cloudData: { positions: Float32Array; intensities: Float32Array };
  color: [number, number, number];
  worldScale: number;
  showNodes: boolean;
  n: number; l: number; m: number;
  boxR: number;
}

function OrbitalCloud({ cloudData, color, worldScale, showNodes, n, l, m, boxR }: OrbitalCloudProps) {
  const tex = useMemo(() => getParticleTexture(), []);

  // Geometría del cloud de |ψ|²
  const cloudGeo = useMemo(() => {
    const { positions, intensities } = cloudData;
    const count = positions.length / 3;

    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const [cr, cg, cb] = color;

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = positions[i * 3 + 0] * worldScale;
      pos[i * 3 + 1] = positions[i * 3 + 1] * worldScale;
      pos[i * 3 + 2] = positions[i * 3 + 2] * worldScale;

      // Intensidad → luminosidad del color
      const v = intensities[i];
      // Escalar suavemente: low → tenue, high → saturado
      const bright = 0.15 + v * 0.85;
      col[i * 3 + 0] = cr * bright;
      col[i * 3 + 1] = cg * bright;
      col[i * 3 + 2] = cb * bright;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position',  new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color',     new THREE.BufferAttribute(col, 3));
    return g;
  }, [cloudData, color, worldScale]);

  // Nodos angulares — mesh semitransparente de la isosuperficie ψ=0
  // Para l=0 no hay nodo angular. Para l>=1 aproximamos con disco/esfera adecuada.
  const nodeGeo = useMemo(() => buildNodeGeometry(l, m, worldScale, boxR), [l, m, worldScale, boxR]);

  // Núcleo — punto brillante en el origen (protón)
  const nucleusRef = useRef<THREE.Mesh>(null);

  // Rotación lenta adicional del cloud (sobre la del Stage autoRotate)
  const cloudGroupRef = useRef<THREE.Group>(null);

  useFrame((_state, delta) => {
    // Pequeña oscilación suave en el eje Y — el orbital "respira"
    if (cloudGroupRef.current) {
      cloudGroupRef.current.rotation.y += delta * 0.05;
    }
    // El núcleo pulsa con escala
    if (nucleusRef.current) {
      const t = _state.clock.elapsedTime;
      const scale = 1 + 0.12 * Math.sin(t * 2.3);
      nucleusRef.current.scale.setScalar(scale);
    }
  });

  return (
    <>
      {/* Luz puntual cálida — simula el núcleo como fuente */}
      <pointLight position={[0, 0, 0]} intensity={1.6} color="#FDB813" distance={14} />
      <pointLight position={[3, 2, 3]} intensity={0.5} color={`rgb(${color.map(c => Math.round(c*255)).join(',')})`} distance={18} />

      {/* Núcleo — esfera emisiva brillante */}
      <mesh ref={nucleusRef} position={[0, 0, 0]}>
        <sphereGeometry args={[0.09, 24, 24]} />
        <meshStandardMaterial
          color="#FDB813"
          emissive="#FFA500"
          emissiveIntensity={3.5}
          toneMapped={false}
        />
      </mesh>

      {/* Cloud de probabilidad |ψ|² */}
      <group ref={cloudGroupRef}>
        <points geometry={cloudGeo}>
          <pointsMaterial
            vertexColors
            map={tex}
            alphaMap={tex}
            size={0.13}
            sizeAttenuation
            transparent
            opacity={0.82}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </points>
      </group>

      {/* Nodos angulares — optional */}
      {showNodes && nodeGeo && (
        <mesh geometry={nodeGeo}>
          <meshStandardMaterial
            color="#94A3B8"
            emissive="#334155"
            emissiveIntensity={0.4}
            transparent
            opacity={0.18}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Eje de referencia tenue — Z */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.006, 0.006, boxR * worldScale * 1.5, 8]} />
        <meshStandardMaterial color="#1E293B" emissive="#0F172A" emissiveIntensity={0.3} transparent opacity={0.5} />
      </mesh>
    </>
  );
}

/**
 * Construye una geometría que aproxima visualmente los nodos angulares del orbital nlm.
 * – l=0: sin nodos angulares → null
 * – l=1, m=0: plano XY (nodo θ=π/2 → z=0)
 * – l=1, m=±1: plano YZ (nodo φ=π/2 o plano XZ)
 * – l=2, m=0: cono θ=acos(1/√3) — nodo de Y₂₀ (3cos²θ−1=0)
 * – l≥2, m≠0: disco aproximado
 */
function buildNodeGeometry(l: number, m: number, worldScale: number, boxR: number): THREE.BufferGeometry | null {
  const R = boxR * worldScale * 1.1;
  if (l === 0) return null;

  if (l === 1 && m === 0) {
    // Plano XY: disco horizontal
    return new THREE.CircleGeometry(R, 64);
  }
  if (l === 1 && (m === 1 || m === -1)) {
    // Plano YZ: disco rotado 90° alrededor Y
    const g = new THREE.CircleGeometry(R, 64);
    // Rotamos la geometría: el disco por defecto está en XY, lo queremos en YZ
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI / 2));
    return g;
  }
  if (l === 2 && m === 0) {
    // Dos conos — ángulo donde 3cos²θ−1=0 → θ = acos(1/√3) ≈ 54.7°
    // Aproximamos con un anillo (torus) en la latitud del nodo
    const theta_node = Math.acos(1 / Math.sqrt(3));
    const rRing = R * Math.sin(theta_node);
    const yRing = R * Math.cos(theta_node) * 0.6;
    const g = new THREE.TorusGeometry(rRing * 0.55, 0.025 * R, 16, 80);
    // Dos toros: +y y −y
    const merged = new THREE.BufferGeometry();
    const pos1 = (g.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const full = new Float32Array(pos1.length * 2);
    for (let i = 0; i < pos1.length; i += 3) {
      // Primer anillo (y positivo)
      full[i + 0] = pos1[i + 0];
      full[i + 1] = pos1[i + 1] + yRing;
      full[i + 2] = pos1[i + 2];
      // Segundo anillo (y negativo)
      full[pos1.length + i + 0] = pos1[i + 0];
      full[pos1.length + i + 1] = pos1[i + 1] - yRing;
      full[pos1.length + i + 2] = pos1[i + 2];
    }
    merged.setAttribute('position', new THREE.BufferAttribute(full, 3));
    return merged;
  }
  // Para l≥2, m≠0: disco semitransparente genérico
  return new THREE.CircleGeometry(R * 0.7, 64);
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

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
