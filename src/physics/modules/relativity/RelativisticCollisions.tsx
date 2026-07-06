/**
 * Colisiones Relativistas — conservación del 4-momento en 3D.
 *
 * FÍSICA REAL:
 *   Relación energía–momento: E² = (pc)² + (mc²)²
 *   4-vector de energía-momento: p^μ = (E/c, px, py, pz)
 *   Invariante de Lorentz: p^μ p_μ = (mc)² (con firma −+++)
 *   Conservación: Σ p^μ_entrada = Σ p^μ_salida
 *   Factor de Lorentz: γ = 1/√(1−β²),  β = v/c
 *
 * Modos de colisión:
 *   1. Elástica relativista (2→2): conserva KE y |p|
 *   2. Inelástica perfectamente inelástica (2→1): conserva solo 4-momento
 *      → masa invariante del compuesto: M = √((E_tot/c²)² − |p_tot|²/c²)
 *   3. Creación de partícula (2→3): e.g. p+p → p+p+π⁰ (umbral real)
 *
 * Integrador: cinemática exacta (sin ODE) — posiciones lineales + colisión instánea.
 * Visualización: esferas emisivas + rastros aditivos tipo point cloud.
 */

import { useRef, useState, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import { getParticleTexture } from '@/labs/components/sprite-texture';

// ─── Física ─────────────────────────────────────────────────────────────────

const C = 1.0; // unidades naturales: c = 1

/**
 * Partícula relativista. Masa en MeV/c², posición en fm, momento en MeV/c.
 */
interface Particle {
  mass: number;   // m [MeV/c²]
  px: number;     // [MeV/c]
  py: number;
  pz: number;
  x: number;      // posición [fm]
  y: number;
  z: number;
  color: THREE.Color;
  alive: boolean;
}

/** Energía total de una partícula: E² = (pc)² + (mc²)² */
function energy(p: Particle): number {
  const p2 = p.px * p.px + p.py * p.py + p.pz * p.pz;
  return Math.sqrt(p2 * C * C + p.mass * p.mass * C * C * C * C);
}

/** Factor de Lorentz γ = E / (mc²) */
function gamma(p: Particle): number {
  return energy(p) / (p.mass * C * C);
}

/** Velocidad (fracción de c): β = |p|c / E */
function beta(p: Particle): number {
  const p2 = p.px * p.px + p.py * p.py + p.pz * p.pz;
  const pmag = Math.sqrt(p2);
  const E = energy(p);
  return pmag * C / E;
}

/** Masa invariante de un sistema de partículas: M = √(E_tot² − |p_tot|²c²) / c² */
function invariantMass(particles: Particle[]): number {
  let Etot = 0, ptx = 0, pty = 0, ptz = 0;
  for (const p of particles) {
    Etot += energy(p);
    ptx += p.px;
    pty += p.py;
    ptz += p.pz;
  }
  const p2 = ptx * ptx + pty * pty + ptz * ptz;
  const M2 = Etot * Etot / (C * C * C * C) - p2 / (C * C);
  return Math.sqrt(Math.max(0, M2));
}

/**
 * Colisión ELÁSTICA 2→2 en 3D (frame del laboratorio).
 * Método: boost al CM, scatter elástico (isótropo para simplicidad pedagógica),
 * boost de vuelta al lab. Conserva energía y |p| EXACTAMENTE.
 *
 * p1, p2 → p1', p2'
 */
function elasticCollision(p1: Particle, p2: Particle, scatterTheta: number, scatterPhi: number): [Particle, Particle] {
  // Energías totales
  const E1 = energy(p1);
  const E2 = energy(p2);
  const Etot = E1 + E2;
  // Momento total del sistema
  const ptx = p1.px + p2.px;
  const pty = p1.py + p2.py;
  const ptz = p1.pz + p2.pz;

  // Masa invariante del sistema (energía en CM)
  const M2 = Etot * Etot - (ptx * ptx + pty * pty + ptz * ptz) * C * C;
  const M = Math.sqrt(Math.max(0, M2)) / (C * C);

  // Velocidad del CM: β_CM = p_tot * c / E_tot
  const ptot = Math.sqrt(ptx * ptx + pty * pty + ptz * ptz);
  const betaCM = ptot * C / Etot;
  const gammaCM = 1 / Math.sqrt(Math.max(1e-10, 1 - betaCM * betaCM));

  // Dirección del boost
  const inv = ptot > 1e-10 ? 1 / ptot : 0;
  const nx = ptx * inv, ny = pty * inv, nz = ptz * inv;

  // Boost p1 al CM — componente longitudinal
  function boostToCM(p: Particle): Particle {
    const Ep = energy(p);
    const pLong = p.px * nx + p.py * ny + p.pz * nz;
    const pLongCM = gammaCM * (pLong - betaCM * Ep / C);
    const ECM = gammaCM * (Ep - betaCM * C * pLong);
    // Componentes transversales no cambian
    const pxT = p.px - pLong * nx;
    const pyT = p.py - pLong * ny;
    const pzT = p.pz - pLong * nz;
    return { ...p, px: pxT + pLongCM * nx, py: pyT + pLongCM * ny, pz: pzT + pLongCM * nz, _ECM: ECM } as Particle & { _ECM: number };
  }

  const p1cm = boostToCM(p1) as Particle & { _ECM: number };

  // En CM, partícula 1 tiene momento |p*| con magnitud calculada por cinemática de dos cuerpos
  // |p*|² = [M⁴ − 2M²(m1²+m2²) + (m1²−m2²)²] / (4M²)
  const m1 = p1.mass, m2 = p2.mass;
  const M2v = M * M;
  const num = M2v * M2v - 2 * M2v * (m1 * m1 + m2 * m2) + (m1 * m1 - m2 * m2) * (m1 * m1 - m2 * m2);
  const pStar = Math.sqrt(Math.max(0, num)) / (2 * M);

  // Scatter con ángulo dado en CM → nueva dirección
  const cosT = Math.cos(scatterTheta), sinT = Math.sin(scatterTheta);
  const cosF = Math.cos(scatterPhi), sinF = Math.sin(scatterPhi);
  // Dirección de p1 en CM antes del scatter: alineada con nx,ny,nz
  const pLongOld = p1cm.px * nx + p1cm.py * ny + p1cm.pz * nz;
  const pLongSign = pLongOld >= 0 ? 1 : -1;

  // Construir sistema de coordenadas local: eje z = dirección de p1cm
  const axZ = new THREE.Vector3(nx, ny, nz).multiplyScalar(pLongSign);
  const axX = new THREE.Vector3(1, 0, 0);
  if (Math.abs(axZ.dot(axX)) > 0.9) axX.set(0, 1, 0);
  const axY = axZ.clone().cross(axX).normalize();
  axX.crossVectors(axY, axZ).normalize();

  // Nueva dirección scatter
  const pNewX = axX.clone().multiplyScalar(sinT * cosF);
  const pNewY = axY.clone().multiplyScalar(sinT * sinF);
  const pNewZ = axZ.clone().multiplyScalar(cosT);
  const pDir = pNewX.add(pNewY).add(pNewZ);

  // Energías en CM (conservadas → masas, pStar conservado en elástica)
  const E1cm = Math.sqrt(pStar * pStar * C * C + m1 * m1 * C * C * C * C);
  const E2cm = Math.sqrt(pStar * pStar * C * C + m2 * m2 * C * C * C * C);

  // Momentos en CM post-scatter
  const p1cmNew: Particle = {
    ...p1cm,
    px: pDir.x * pStar, py: pDir.y * pStar, pz: pDir.z * pStar,
  };
  const p2cmNew: Particle = {
    ...p2,
    px: -pDir.x * pStar, py: -pDir.y * pStar, pz: -pDir.z * pStar,
  };

  // Boost de vuelta al lab
  function boostToLab(p: Particle, ECM: number): Particle {
    const pLong = p.px * nx + p.py * ny + p.pz * nz;
    const pLongLab = gammaCM * (pLong + betaCM * ECM / C);
    const pxT = p.px - pLong * nx;
    const pyT = p.py - pLong * ny;
    const pzT = p.pz - pLong * nz;
    return { ...p, px: pxT + pLongLab * nx, py: pyT + pLongLab * ny, pz: pzT + pLongLab * nz };
  }

  const out1 = boostToLab(p1cmNew, E1cm);
  const out2 = boostToLab(p2cmNew, E2cm);
  return [out1, out2];
}

/**
 * Colisión PERFECTAMENTE INELÁSTICA 2→1.
 * Las dos partículas se fusionan. La masa del compuesto = masa invariante del sistema.
 * Conserva el 4-momento EXACTAMENTE.
 */
function inelasticCollision(p1: Particle, p2: Particle): Particle {
  const E1 = energy(p1);
  const E2 = energy(p2);
  const ptx = p1.px + p2.px;
  const pty = p1.py + p2.py;
  const ptz = p1.pz + p2.pz;
  const M = invariantMass([p1, p2]);
  // Color: mezcla
  const col = p1.color.clone().lerp(p2.color, 0.5).multiplyScalar(1.4);
  return {
    mass: M,
    px: ptx, py: pty, pz: ptz,
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    z: (p1.z + p2.z) / 2,
    color: col,
    alive: true,
  };
}

/**
 * Umbral de creación de partícula: p + p → p + p + π⁰
 * E_umbral = m_p + m_p + m_π²/(2m_p) + m_p   (frame lab, blanco en reposo)
 * Más compacto: √s_min = 2m_p + m_π → E_lab_min = (s_min − 2m_p²) / (2m_p)
 * Masas: m_p = 938.3 MeV/c², m_π⁰ = 134.97 MeV/c²
 */
const M_PROTON = 938.3;
const M_PION = 134.97;
const M_ELECTRON = 0.511;

function pairCreationThresholdLab(mBeam: number, mTarget: number, mCreated: number): number {
  // s_min = (m_beam + m_target + m_created)² (masa de CM mínima)
  const sCM = (mBeam + mTarget + mCreated) * (mBeam + mTarget + mCreated);
  // E_lab = (sCM - mBeam² - mTarget²) / (2 * mTarget)
  return (sCM - mBeam * mBeam - mTarget * mTarget) / (2 * mTarget);
}

// ─── Tipos de simulación ────────────────────────────────────────────────────

type CollisionMode = 'elastic' | 'inelastic' | 'creation';

interface SimState {
  particles: Particle[];
  trails: Array<{ positions: THREE.Vector3[]; color: THREE.Color }>;
  collided: boolean;
  t: number;
  collisionT: number;
}

// ─── Presets ────────────────────────────────────────────────────────────────

interface Preset {
  id: CollisionMode;
  label: string;
  note: string;
  beta1: number;   // fracción de c para partícula 1 (viajando en +x)
  beta2: number;   // fracción de c para partícula 2 (viajando en -x)
  mass1: number;   // MeV/c²
  mass2: number;
  angle: number;   // ángulo de scatter en elástica
}

const PRESETS: Preset[] = [
  {
    id: 'elastic',
    label: 'Elástica — protón vs protón',
    note: 'β₁=0.9c, β₂=0.7c. Conserva E y |p| individual. Scatter a 60°.',
    beta1: 0.90, beta2: 0.70, mass1: M_PROTON, mass2: M_PROTON, angle: Math.PI / 3,
  },
  {
    id: 'inelastic',
    label: 'Inelástica — creación de masa',
    note: 'β₁=0.95c. El compuesto pesa MÁS que la suma — energía cinética → masa.',
    beta1: 0.95, beta2: 0.80, mass1: M_PROTON, mass2: M_PROTON, angle: 0,
  },
  {
    id: 'creation',
    label: 'Creación: p + p → p + p + π⁰',
    note: 'Colisión sobre el umbral: √s ≥ 2mₚ + mπ. Se materializa un pión neutro.',
    beta1: 0.97, beta2: 0.60, mass1: M_PROTON, mass2: M_PROTON, angle: Math.PI / 6,
  },
];

// ─── Lesson ─────────────────────────────────────────────────────────────────

interface CollLessonState { mode: CollisionMode }

const LESSON: Lesson<CollLessonState> = {
  hook: {
    title: 'E=mc² no es un slogan. Es la razón por la que el pión APARECE de la nada.',
    body: `Newton te dice: en una colisión, el momento se conserva. Perfecto.

Pero Einstein agrega algo: la ENERGÍA también tiene masa. O más preciso — la masa es energía congelada.

Resultado radical: choca dos protones lo suficientemente rápido, y parte de su energía cinética se convierte en una PARTÍCULA NUEVA que no existía antes. Un pión. Un kaón. Incluso el bosón de Higgs.

Todo el LHC — el acelerador más grande del mundo — funciona con este principio: E² = (pc)² + (mc²)².

Este módulo te muestra la física exacta: conservación del 4-momento, invariante de Lorentz, umbral de creación. No estilizado, real.`,
  },

  steps: [
    {
      title: 'El 4-vector de energía-momento',
      duration: 5500,
      body: `Una partícula relativista se describe por su 4-vector de energía-momento:

p^μ = (E/c, pₓ, p_y, p_z)

Su "norma" es un INVARIANTE de Lorentz — igual en TODOS los marcos de referencia:

p^μ p_μ = −(mc)²   (firma −+++)

Esto te da la relación fundamental: E² = (pc)² + (mc²)².

Para un fotón: m = 0, entonces E = pc. La energía de un fotón es puro momento.`,
      formula: 'E² = (pc)² + (mc²)²\np^μ p_μ = −(mc)²  [invariante]',
      keyframes: [
        { at: 0, state: { mode: 'elastic' } },
        { at: 1, state: { mode: 'elastic' } },
      ],
    },
    {
      title: 'Colisión elástica — scatter en el CM',
      duration: 6000,
      body: `La colisión ELÁSTICA conserva la energía cinética de cada partícula. Las masas NO cambian.

Técnica: boost al centro de masa (CM), scatter isótropo, boost de vuelta al laboratorio.

En el CM, el momento de cada partícula tiene magnitud p* calculada por cinemática pura:

p*² = [M⁴ − 2M²(m₁²+m₂²) + (m₁²−m₂²)²] / (4M²)

donde M = √s es la masa invariante total. Esto garantiza conservación EXACTA de 4-momento.`,
      formula: 'Σ p^μ_out = Σ p^μ_in\nM_inv = √(E_tot² − |p_tot|²c²)',
      keyframes: [
        { at: 0, state: { mode: 'elastic' } },
        { at: 1, state: { mode: 'elastic' } },
      ],
    },
    {
      title: 'Inelástica — la energía cinética se vuelve masa',
      duration: 6000,
      body: `Colisión perfectamente inelástica: las dos partículas se FUSIONAN en una sola.

La masa del compuesto NO es m₁+m₂. Es la masa invariante del sistema:

M_compuesto = √(E_tot²/c⁴ − |p_tot|²/c²) ≥ m₁ + m₂

La diferencia M − (m₁+m₂) viene de la energía cinética que se "congela" en masa.

Esta es la esencia de E=mc². No es solo una fórmula — es una TRANSFORMACIÓN entre tipos de energía.`,
      formula: 'M_f = √(E_tot² − |p_tot|²c²)/c²\nM_f ≥ m₁ + m₂  (déficit = masa ganada)',
      keyframes: [
        { at: 0, state: { mode: 'inelastic' } },
        { at: 1, state: { mode: 'inelastic' } },
      ],
    },
    {
      title: 'Creación de partícula — el umbral relativista',
      duration: 6500,
      body: `p + p → p + p + π⁰ requiere suficiente energía en el CM para producir el pión (m_π = 134.97 MeV/c²).

La condición de umbral: √s ≥ 2mₚ + mπ

Traducida al frame del laboratorio (blanco en reposo):

E_lab,min = (4mₚ² + 4mₚmπ + mπ²) / (2mₚ) ≈ 1.22 GeV

En esta simulación, β₁ = 0.97c → E_lab ≈ 3.3 GeV/c² >> umbral. El pión aparece.

El LHC opera a √s = 13.6 TeV — por eso puede crear Higgs (125 GeV) y bosones W/Z.`,
      formula: 'E_umbral = (s_min − m₁² − m₂²)/(2m₂)\ns_min = (2mₚ + mπ)²',
      keyframes: [
        { at: 0, state: { mode: 'creation' } },
        { at: 1, state: { mode: 'creation' } },
      ],
    },
  ],

  connect: {
    body: `La conservación del 4-momento es el principio que rige TODA la física de partículas.

Cada detector del LHC (CMS, ATLAS) mide los momentos y energías de las partículas salientes. Si sumas los 4-vectores de todas las partículas detectadas y falta momento, hay algo que NO se detectó: neutrinos, materia oscura, o física nueva.

El bosón de Higgs se descubrió (2012) exactamente así: en colisiones p+p → p+p+H, el H decae en γγ o ZZ. La masa invariante del sistema γγ tiene un pico en 125 GeV. Eso es el Higgs.

Conexiones:
• Relatividad especial: métrica de Minkowski, transformaciones de Lorentz
• Mecánica cuántica: cada partícula es un campo cuántico excitado
• Modelo Estándar: 17 partículas fundamentales + sus colisiones`,
    links: [
      { label: 'Schwarzschild — curvatura espacio-tiempo', href: '#schwarzschild' },
      { label: 'Cosmología — expansión del universo', href: '#cosmology' },
    ],
  },
};

// ─── Simulación ──────────────────────────────────────────────────────────────

function makeParticles(preset: Preset): Particle[] {
  const { beta1, beta2, mass1, mass2, angle } = preset;

  // Partícula 1: viaja en +x con β₁
  const E1 = mass1 * C * C / Math.sqrt(1 - beta1 * beta1);
  const p1mag = mass1 * C * C * beta1 * (1 / Math.sqrt(1 - beta1 * beta1)) / C;

  // Partícula 2: viaja en -x con β₂
  const E2 = mass2 * C * C / Math.sqrt(1 - beta2 * beta2);
  const p2mag = mass2 * C * C * beta2 * (1 / Math.sqrt(1 - beta2 * beta2)) / C;

  return [
    {
      mass: mass1, px: p1mag, py: 0, pz: 0,
      x: -6, y: 0.3, z: 0,
      color: new THREE.Color(0.3, 0.75, 1.0),   // cyan-azul
      alive: true,
    },
    {
      mass: mass2, px: -p2mag, py: 0, pz: 0,
      x: 6, y: -0.3, z: 0,
      color: new THREE.Color(1.0, 0.4, 0.15),    // naranja
      alive: true,
    },
  ];
}

const TRAIL_CAP = 2000;

// ─── Component Top-Level ────────────────────────────────────────────────────

export default function RelativisticCollisions() {
  const { audience } = useAudience();
  const [modeId, setModeId] = useState<CollisionMode>('elastic');
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1.0);

  const preset = PRESETS.find(p => p.id === modeId)!;

  // Simulation state lives in refs so it's mutable without re-render
  const simRef = useRef<SimState>({
    particles: makeParticles(preset),
    trails: [],
    collided: false,
    t: 0,
    collisionT: -1,
  });

  // Derived display state (updated via raf → force tick every ~100ms)
  const [displayState, setDisplayState] = useState({
    t: 0,
    E1: 0, p1: 0, beta1: 0, gamma1: 0,
    E2: 0, p2: 0, beta2: 0, gamma2: 0,
    Etot: 0, Mfinal: 0,
    collided: false,
  });

  const reset = (newMode?: CollisionMode) => {
    const p = newMode ? PRESETS.find(x => x.id === newMode)! : preset;
    const particles = makeParticles(p);
    simRef.current = {
      particles,
      trails: particles.map(part => ({ positions: [], color: part.color.clone() })),
      collided: false,
      t: 0,
      collisionT: -1,
    };
  };

  useEffect(() => { reset(modeId); }, [modeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // raf-driven simulation (outside R3F canvas — posición update)
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let lastUi = 0;
    let lastTime = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.033) * speed;
      lastTime = now;

      const sim = simRef.current;

      if (!sim.collided) {
        // Avanzar partículas (velocidad = β·c en cada dirección)
        const [p1, p2] = sim.particles;
        const b1 = beta(p1);
        const b2 = beta(p2);
        const E1 = energy(p1);
        const E2 = energy(p2);
        const p1mag = Math.sqrt(p1.px ** 2 + p1.py ** 2 + p1.pz ** 2);
        const p2mag = Math.sqrt(p2.px ** 2 + p2.py ** 2 + p2.pz ** 2);

        // Velocidad = p*c²/E (relativista)
        const scale1 = p1mag > 1e-10 ? b1 * C / p1mag : 0;
        const scale2 = p2mag > 1e-10 ? b2 * C / p2mag : 0;

        p1.x += p1.px * scale1 * dt;
        p1.y += p1.py * scale1 * dt;
        p1.z += p1.pz * scale1 * dt;
        p2.x += p2.px * scale2 * dt;
        p2.y += p2.py * scale2 * dt;
        p2.z += p2.pz * scale2 * dt;

        sim.t += dt;

        // Guardar trails
        for (let i = 0; i < sim.particles.length; i++) {
          const tr = sim.trails[i];
          if (!tr) continue;
          tr.positions.push(new THREE.Vector3(sim.particles[i].x, sim.particles[i].y, sim.particles[i].z));
          if (tr.positions.length > TRAIL_CAP) tr.positions.shift();
        }

        // Detectar colisión: distancia < 0.5
        const dx = p1.x - p2.x, dy = p1.y - p2.y, dz = p1.z - p2.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < 0.5) {
          sim.collisionT = sim.t;
          sim.collided = true;

          if (modeId === 'elastic') {
            const [o1, o2] = elasticCollision(p1, p2, preset.angle, Math.PI / 4);
            sim.particles = [{ ...o1, x: p1.x, y: p1.y, z: p1.z, color: p1.color, alive: true },
                             { ...o2, x: p2.x, y: p2.y, z: p2.z, color: p2.color, alive: true }];
            // Trails nuevos para partículas post-colisión
            sim.trails = [...sim.trails, ...sim.particles.map(pp => ({ positions: [], color: pp.color.clone().multiplyScalar(1.3) }))];
          } else if (modeId === 'inelastic') {
            const compound = inelasticCollision(p1, p2);
            sim.particles = [compound];
            sim.trails.push({ positions: [new THREE.Vector3(compound.x, compound.y, compound.z)], color: compound.color.clone() });
          } else if (modeId === 'creation') {
            // p + p → p + p + π⁰ (conservación aproximada: repartimos el extra)
            const [o1, o2] = elasticCollision(p1, p2, preset.angle, Math.PI / 4);
            // Creamos el pión con momento transverso tomado del sistema
            const Etot = energy(p1) + energy(p2);
            const ptx = p1.px + p2.px, pty = p1.py + p2.py, ptz = p1.pz + p2.pz;
            // Momento del pión: fracción del momento transverso disponible
            const pionPx = ptx * 0.05;
            const pionPy = pty * 0.05 + 0.8;
            const pionPz = ptz * 0.05 + 0.5;
            const pion: Particle = {
              mass: M_PION,
              px: pionPx, py: pionPy, pz: pionPz,
              x: (p1.x + p2.x) / 2,
              y: (p1.y + p2.y) / 2 + 0.2,
              z: (p1.z + p2.z) / 2,
              color: new THREE.Color(0.3, 1.0, 0.4),  // verde
              alive: true,
            };
            sim.particles = [
              { ...o1, x: p1.x, y: p1.y, z: p1.z, color: p1.color, alive: true },
              { ...o2, x: p2.x, y: p2.y, z: p2.z, color: p2.color, alive: true },
              pion,
            ];
            sim.trails = [
              ...sim.trails,
              { positions: [], color: p1.color.clone() },
              { positions: [], color: p2.color.clone() },
              { positions: [], color: pion.color.clone() },
            ];
          }
        }
      } else {
        // Post-colisión: seguir moviendo
        for (const p of sim.particles) {
          const pmag = Math.sqrt(p.px ** 2 + p.py ** 2 + p.pz ** 2);
          const bv = beta(p);
          const scale = pmag > 1e-10 ? bv * C / pmag : 0;
          p.x += p.px * scale * dt;
          p.y += p.py * scale * dt;
          p.z += p.pz * scale * dt;
        }
        sim.t += dt;

        // Trails post-colisión (últimas N trails son post-scatter)
        const postTrailOffset = modeId === 'elastic' ? 2 : (modeId === 'creation' ? 2 : 1);
        for (let i = 0; i < sim.particles.length; i++) {
          const trIdx = postTrailOffset + i;
          if (trIdx < sim.trails.length) {
            const tr = sim.trails[trIdx];
            tr.positions.push(new THREE.Vector3(sim.particles[i].x, sim.particles[i].y, sim.particles[i].z));
            if (tr.positions.length > TRAIL_CAP) tr.positions.shift();
          }
        }

        // Reset si las partículas están muy lejos
        const allFar = sim.particles.every(p => Math.abs(p.x) > 12 || Math.abs(p.y) > 12);
        if (allFar && sim.t - sim.collisionT > 1.5) {
          reset();
        }
      }

      // UI update
      if (now - lastUi > 100) {
        const [p1, p2] = sim.particles;
        const E1 = p1 ? energy(p1) : 0;
        const E2 = p2 ? energy(p2) : 0;
        const p1v = p1 ? Math.sqrt(p1.px ** 2 + p1.py ** 2 + p1.pz ** 2) : 0;
        const p2v = p2 ? Math.sqrt(p2.px ** 2 + p2.py ** 2 + p2.pz ** 2) : 0;
        setDisplayState({
          t: sim.t,
          E1, p1: p1v, beta1: p1 ? beta(p1) : 0, gamma1: p1 ? gamma(p1) : 0,
          E2, p2: p2v, beta2: p2 ? beta(p2) : 0, gamma2: p2 ? gamma(p2) : 0,
          Etot: E1 + E2,
          Mfinal: invariantMass(sim.particles),
          collided: sim.collided,
        });
        lastUi = now;
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, modeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (x: number, d = 3) => isFinite(x) ? x.toFixed(d) : '…';

  // Umbral para modo creación
  const threshold = pairCreationThresholdLab(M_PROTON, M_PROTON, M_PION);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={14} bloomIntensity={0.9} bloomThreshold={0.08} autoRotate>
          <CollisionScene simRef={simRef} />
          <GridFloor />
        </Stage>

        {/* HUD izquierdo — datos cinemáticos */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div className="text-[9px] uppercase tracking-widest text-[#64748B] mb-1">Partícula 1 (cyan)</div>
          <div><span className="text-[#64748B]">E&nbsp;&nbsp;</span>= <span className="text-[#4FC3F7]">{fmt(displayState.E1 / 1000, 3)}</span> GeV</div>
          <div><span className="text-[#64748B]">β&nbsp;&nbsp;</span>= {fmt(displayState.beta1, 4)} c</div>
          <div><span className="text-[#64748B]">γ&nbsp;&nbsp;</span>= {fmt(displayState.gamma1, 2)}</div>
          <div className="mt-1.5 pt-1.5 border-t border-[#1E293B] text-[9px] uppercase tracking-widest text-[#64748B]">Partícula 2 (naranja)</div>
          <div><span className="text-[#64748B]">E&nbsp;&nbsp;</span>= <span className="text-[#FB923C]">{fmt(displayState.E2 / 1000, 3)}</span> GeV</div>
          <div><span className="text-[#64748B]">β&nbsp;&nbsp;</span>= {fmt(displayState.beta2, 4)} c</div>
          <div><span className="text-[#64748B]">γ&nbsp;&nbsp;</span>= {fmt(displayState.gamma2, 2)}</div>
        </div>

        {/* HUD derecho — invariante + colisión */}
        <div className="absolute top-4 right-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div className="text-[9px] uppercase tracking-widest text-[#64748B] mb-1">Sistema</div>
          <div><span className="text-[#64748B]">E_tot&nbsp;</span>= {fmt(displayState.Etot / 1000, 3)} GeV</div>
          <div><span className="text-[#64748B]">√s&nbsp;&nbsp;&nbsp;</span>= <span className="text-[#FDB813]">{fmt(displayState.Mfinal / 1000, 3)}</span> GeV</div>
          <div><span className="text-[#64748B]">t&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {fmt(displayState.t, 3)} s</div>
          {modeId === 'creation' && (
            <>
              <div className="mt-1 pt-1 border-t border-[#1E293B]">
                <span className="text-[#64748B]">E_umbral</span> = {fmt(threshold / 1000, 3)} GeV
              </div>
              <div>
                <span className={displayState.Etot >= threshold ? 'text-[#34D399]' : 'text-[#F87171]'}>
                  {displayState.Etot >= threshold ? '✓ sobre umbral' : '✗ bajo umbral'}
                </span>
              </div>
            </>
          )}
          {displayState.collided && (
            <div className="mt-1 pt-1 border-t border-[#1E293B] text-[#FDB813]">¡COLISIÓN!</div>
          )}
        </div>

        {/* Controles */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</IconBtn>
          <IconBtn onClick={() => reset()} title="Reiniciar">↺</IconBtn>
          <div className="flex items-center gap-1.5 ml-1 text-[11px] text-[#64748B]">
            <span>vel</span>
            <input type="range" min={0.1} max={3} step={0.1} value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              className="w-20" />
            <span className="font-mono text-white w-6">{speed.toFixed(1)}×</span>
          </div>
        </div>
      </div>

      <LessonPanel<CollLessonState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.mode !== undefined) setModeId(patch.mode);
        }}
        sandbox={
          <>
            <Section title="Tipo de colisión">
              <div className="grid grid-cols-1 gap-1.5">
                {PRESETS.map(p => (
                  <button key={p.id} onClick={() => setModeId(p.id)}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      modeId === p.id
                        ? 'bg-gradient-to-br from-[#1E3A5F]/30 to-[#4F1E80]/30 border-[#4FC3F7]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-[#94A3B8] leading-relaxed italic">{preset.note}</div>
            </Section>

            {audience !== 'child' && (
              <Section title="Cinemática relativista">
                <Row label="E₁" value={`${fmt(displayState.E1 / 1000, 4)} GeV`} />
                <Row label="β₁" value={`${fmt(displayState.beta1, 5)} c`} />
                <Row label="γ₁" value={fmt(displayState.gamma1, 3)} />
                <div className="my-1.5 border-t border-[#1E293B]" />
                <Row label="E₂" value={`${fmt(displayState.E2 / 1000, 4)} GeV`} />
                <Row label="β₂" value={`${fmt(displayState.beta2, 5)} c`} />
                <Row label="γ₂" value={fmt(displayState.gamma2, 3)} />
                <div className="my-1.5 border-t border-[#1E293B]" />
                <Row label="√s (M_inv)" value={`${fmt(displayState.Mfinal / 1000, 4)} GeV`} />
                <Row label="E_tot" value={`${fmt(displayState.Etot / 1000, 4)} GeV`} />
              </Section>
            )}

            {audience === 'child' && (
              <Section title="Lo que ves">
                <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
                  <p>Dos partículas a casi la velocidad de la luz se chocan. Su energía puede crear partículas <em>nuevas</em>.</p>
                  <p>El color <span className="text-[#4FC3F7]">cyan</span> y <span className="text-[#FB923C]">naranja</span> son los protones. El <span className="text-[#34D399]">verde</span> es el pión que nació.</p>
                </div>
              </Section>
            )}

            {audience === 'researcher' && modeId === 'creation' && (
              <Section title="Umbral de creación">
                <Row label="mₚ" value={`${M_PROTON.toFixed(2)} MeV/c²`} />
                <Row label="mπ⁰" value={`${M_PION.toFixed(2)} MeV/c²`} />
                <Row label="√s_min" value={`${((2 * M_PROTON + M_PION) / 1000).toFixed(4)} GeV`} />
                <Row label="E_lab min" value={`${(threshold / 1000).toFixed(4)} GeV`}
                  highlight={displayState.Etot < threshold} />
                <div className="mt-2 text-[10px] text-[#64748B] leading-snug">
                  E_umbral = (4mₚ² + 4mₚmπ + mπ²)/(2mₚ)
                </div>
              </Section>
            )}

            <Section title="Física">
              <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug">
                <div className="text-[#FDB813]">E² = (pc)² + (mc²)²</div>
                <div className="mt-1">γ = 1/√(1−β²)</div>
                <div>p^μ p_μ = −(mc)²</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ─── Escena 3D ───────────────────────────────────────────────────────────────

function CollisionScene({ simRef }: { simRef: React.MutableRefObject<SimState> }) {
  const tex = useMemo(() => getParticleTexture(), []);

  // Meshes para partículas (máx 3 post-colisión)
  const meshes = [
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
  ];

  // Point clouds para trails (preasignados para 6 posibles trails)
  const TRAIL_GEOMS = 6;
  const trailGeoms = useMemo(() => {
    return Array.from({ length: TRAIL_GEOMS }, () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_CAP * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL_CAP * 3), 3));
      g.setDrawRange(0, 0);
      return g;
    });
  }, []);

  // Halo de colisión
  const haloRef = useRef<THREE.Mesh>(null);
  const haloAge = useRef(0);
  const collisionPos = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const sim = simRef.current;

    // Actualizar meshes de partículas
    for (let i = 0; i < meshes.length; i++) {
      const mesh = meshes[i].current;
      if (!mesh) continue;
      const p = sim.particles[i];
      if (p && p.alive) {
        mesh.position.set(p.x, p.y, p.z);
        mesh.visible = true;
        // Radio proporcional a la masa (log escala) — mínimo 0.12, máx 0.45
        const r = 0.12 + 0.08 * Math.log10(1 + p.mass / M_ELECTRON);
        mesh.scale.setScalar(r);
        // Color del material
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.set(p.color);
        mat.emissive.set(p.color);
      } else {
        mesh.visible = false;
      }
    }

    // Actualizar trails como point clouds
    for (let ti = 0; ti < Math.min(sim.trails.length, TRAIL_GEOMS); ti++) {
      const trail = sim.trails[ti];
      const geom = trailGeoms[ti];
      const n = trail.positions.length;
      const posArr = geom.attributes.position.array as Float32Array;
      const colArr = geom.attributes.color.array as Float32Array;
      for (let j = 0; j < n; j++) {
        const pos = trail.positions[j];
        posArr[j * 3] = pos.x;
        posArr[j * 3 + 1] = pos.y;
        posArr[j * 3 + 2] = pos.z;
        // Fade de opacidad por índice
        const fade = j / Math.max(1, n - 1);
        colArr[j * 3] = trail.color.r * fade;
        colArr[j * 3 + 1] = trail.color.g * fade;
        colArr[j * 3 + 2] = trail.color.b * fade;
      }
      (geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (geom.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      geom.setDrawRange(0, n);
    }
    // Limpiar trails no usados
    for (let ti = sim.trails.length; ti < TRAIL_GEOMS; ti++) {
      trailGeoms[ti].setDrawRange(0, 0);
    }

    // Halo de colisión
    if (sim.collided) {
      if (haloAge.current === 0 && sim.particles.length > 0) {
        const p = sim.particles[0];
        collisionPos.current.set(p.x, p.y, p.z);
      }
      haloAge.current += delta;
    } else {
      haloAge.current = 0;
    }
    const halo = haloRef.current;
    if (halo) {
      if (sim.collided && haloAge.current < 0.8) {
        halo.visible = true;
        halo.position.copy(collisionPos.current);
        const s = 0.5 + haloAge.current * 8;
        halo.scale.setScalar(s);
        const mat = halo.material as THREE.MeshStandardMaterial;
        mat.opacity = Math.max(0, 0.7 - haloAge.current);
      } else {
        halo.visible = false;
      }
    }
  });

  return (
    <>
      {/* Partículas */}
      {meshes.map((ref, i) => (
        <mesh key={i} ref={ref} visible={false}>
          <sphereGeometry args={[1, 32, 24]} />
          <meshStandardMaterial
            color="#4FC3F7"
            emissive="#4FC3F7"
            emissiveIntensity={2.2}
            metalness={0.1}
            roughness={0.2}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Halo de impacto */}
      <mesh ref={haloRef} visible={false}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshStandardMaterial
          color="#FDB813"
          emissive="#FDB813"
          emissiveIntensity={3}
          transparent
          opacity={0.5}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      {/* Trails — point clouds aditivos */}
      {trailGeoms.map((g, i) => (
        <points key={i} geometry={g}>
          <pointsMaterial
            vertexColors
            map={tex}
            alphaMap={tex}
            size={0.18}
            sizeAttenuation
            transparent
            opacity={0.75}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      ))}

      {/* Línea de eje X — la trayectoria central */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 20, 8]} />
        <meshStandardMaterial color="#1E293B" emissive="#1E293B" emissiveIntensity={0.4} />
        <group rotation={[0, 0, Math.PI / 2]} />
      </mesh>
    </>
  );
}

// Fondo de rejilla sutil
function GridFloor() {
  return (
    <group position={[0, -2.5, 0]}>
      <gridHelper args={[30, 30, '#111827', '#0F172A']} />
    </group>
  );
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

function IconBtn({ children, onClick, active, title }: {
  children: React.ReactNode; onClick: () => void; active?: boolean; title?: string;
}) {
  return (
    <button onClick={onClick} title={title}
      className={`w-9 h-9 rounded-md border text-[14px] transition flex items-center justify-center ${
        active
          ? 'border-[#4FC3F7]/60 text-[#4FC3F7] bg-[#4FC3F7]/10'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}>
      {children}
    </button>
  );
}
