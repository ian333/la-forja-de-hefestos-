/**
 * Diagramas de Feynman — QED básico en 3D.
 *
 * FÍSICA REAL (canónica):
 *   Dispersión Møller (e⁻e⁻ → e⁻e⁻) a primer orden (árbol): un fotón virtual
 *   intercambiado, dos vértices QED. Amplitud de Feynman:
 *
 *     M ∝ e² · ū(p₃)γᵘu(p₁) · (1/q²) · ū(p₄)γᵘu(p₂)
 *
 *   donde q = p₁ − p₃ es el cuadrimomento transferido (t-canal).
 *   El propagador del fotón virtual: −gᵘᵛ / q²  (gauge de Feynman).
 *
 *   Reglas de Feynman QED (canónicas, Peskin & Schroeder §4.8):
 *     • Línea fermiónica entrante: u(p)         espinor de partícula
 *     • Línea fermiónica saliente: ū(p)         espinor conjugado
 *     • Vértice: −ieγᵘ                          acoplamiento QED
 *     • Propagador fotón: −igᵘᵛ / q²            fotón virtual
 *     • Propagador fermión: i(γᵘpᵘ + m) / (p²−m²)
 *
 *   Visualización 3D: espacio-tiempo con eje x = posición, eje t = tiempo.
 *   Las líneas de mundo de los electrones entran desde abajo y salen arriba.
 *   El fotón virtual (propagador) conecta los dos vértices con una línea ondulada
 *   (espiral/helicoide). Un "halo" en cada vértice indica el acoplamiento −ieγᵘ.
 *
 *   Incluimos también el diagrama de aniquilación e⁻e⁺ → γγ y
 *   la dispersión Compton (e⁻γ → e⁻γ) como presets seleccionables.
 */

import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

// ─── Estado del módulo ────────────────────────────────────────────────────────

interface FDState {
  diagramId: string;
  showAmplitude: boolean;
  showMomentum: boolean;
}

// ─── Lesson ───────────────────────────────────────────────────────────────────

const LESSON: Lesson<FDState> = {
  hook: {
    title: '¿Cómo se HABLAN dos electrones? Con un fotón que no existe.',
    body: `Cuando dos electrones se repelen, los físicos dicen que "intercambian un fotón virtual". Pero ese fotón viola la relación de Einstein E² = p²c² + m²c⁴ — está "fuera de la capa de masa" (off-shell).

Richard Feynman inventó un lenguaje diagramático para calcular la probabilidad de cualquier proceso cuántico. Cada diagrama es una ecuación — una instrucción precisa para sumar amplitudes de probabilidad.

Lo que ves aquí es ese lenguaje: líneas de mundo en espacio-tiempo, vértices donde las partículas se acoplan, y propagadores que "transportan" el intercambio cuántico.

La amplitud de dispersión M determina la sección eficaz σ ∝ |M|². La mecánica cuántica no te dice "qué pasó" — te da la probabilidad de cada resultado posible.`,
  },

  steps: [
    {
      title: 'Dispersión Møller — e⁻e⁻ vía fotón virtual (t-canal)',
      duration: 6000,
      body: `Dos electrones se acercan, intercambian un fotón virtual, y se separan. Esta es la dispersión Møller: e⁻ + e⁻ → e⁻ + e⁻.

El fotón virtual (línea ondulada) conecta dos vértices QED. En cada vértice actúa el operador −ieγᵘ: e es la carga del electrón, γᵘ son las matrices de Dirac que mezclan la espín del fermión con la dirección de la corriente.

El propagador del fotón −igᵘᵛ/q² diverge cuando q² → 0 (fotón casi real, dispersión en ángulo pequeño). Ahí la sección eficaz explota — la repulsión de Coulomb clásica emerge como límite de bajas energías de este intercambio cuántico.

La amplitud total: M ∝ e² ū(p₃)γᵘu(p₁) · (1/q²) · ū(p₄)γᵘu(p₂). Cuadras |M|² e integras sobre ángulos sólidos para obtener dσ/dΩ de Møller.`,
      formula:
        'M_t = −e² [ū(p₃)γᵘu(p₁)] (−gᵘᵛ/q²) [ū(p₄)γᵥu(p₂)]\nq = p₁ − p₃  (momento transferido)\nq² < 0  →  intercambio espacio-tipo',
      keyframes: [
        { at: 0, state: { diagramId: 'moller', showAmplitude: false, showMomentum: false } },
        { at: 0.5, state: { diagramId: 'moller', showAmplitude: true, showMomentum: false } },
        { at: 1, state: { diagramId: 'moller', showAmplitude: true, showMomentum: true } },
      ],
    },
    {
      title: 'Diagrama de intercambio (u-canal) — identidad cuántica',
      duration: 5500,
      body: `Los electrones son INDISTINGUIBLES. Eso cambia todo en QFT.

Para la dispersión e⁻e⁻ existen DOS diagramas de árbol: el t-canal (fotón conecta línea 1→3 con línea 2→4) y el u-canal (fotón conecta línea 1→4 con línea 2→3). Los electrones "no se saben" cuál es cuál.

Por el principio de Pauli (fermiones = antisimétricos), los dos diagramas se RESTAN: M = M_t − M_u. Este signo menos es consecuencia directa de que los operadores de creación de fermiones anticonmutan: {c_p, c_q†} = δ(p−q).

Si los electrones fueran bosones (como el Higgs), los diagramas se SUMARÍAN y la física sería distinta. La estadística cuántica está codificada en los signos de Feynman.`,
      formula:
        'M_total = M_t − M_u\n(−) por antisimetría fermiónica\n{a_p, a_q†} = δ³(p−q)  →  intercambio = signo',
      keyframes: [
        { at: 0, state: { diagramId: 'moller-u', showAmplitude: true, showMomentum: false } },
        { at: 1, state: { diagramId: 'moller-u', showAmplitude: true, showMomentum: true } },
      ],
    },
    {
      title: 'Aniquilación e⁻e⁺ → γγ — materia que desaparece',
      duration: 5500,
      body: `Un electrón y un positrón se aniquilan produciendo dos fotones reales. Aquí las líneas de mundo cruzan: el positrón viaja hacia atrás en el tiempo (convención de Feynman-Stückelberg).

El propagador intermedio es un ELECTRÓN VIRTUAL (no un fotón): i(γᵘpᵘ+m)/(p²−m²). Este fermión propagador conecta el vértice de aniquilación con el vértice de emisión del segundo fotón.

Los dos fotones salen con momenta p₃ y p₄ conservando cuadrimomento total: p₁ + p₂ = p₃ + p₄. En el sistema del centro de masa, los fotones salen de forma opuesta — así funciona el PET scan médico.

La amplitud: M ∝ e² · ε*ᵘ(k₁) · ε*ᵛ(k₂) · ū(p₂)[γᵥ S_F(q) γᵘ]v(p₁), donde S_F es el propagador de Feynman del electrón virtual.`,
      formula:
        'e⁻(p₁) + e⁺(p₂) → γ(k₁) + γ(k₂)\nConservación: p₁+p₂ = k₁+k₂\nPropagador fermión: S_F(q) = i(q̸+m)/(q²−m²)',
      keyframes: [
        { at: 0, state: { diagramId: 'annihilation', showAmplitude: false, showMomentum: false } },
        { at: 0.4, state: { diagramId: 'annihilation', showAmplitude: true, showMomentum: false } },
        { at: 1, state: { diagramId: 'annihilation', showAmplitude: true, showMomentum: true } },
      ],
    },
    {
      title: 'Dispersión Compton — e⁻γ → e⁻γ y la jerarquía de loop',
      duration: 6000,
      body: `Un fotón real golpea un electrón y sale con otra dirección y energía. Dos diagramas contribuyen a primer orden: fotón absorbido antes de emitirse (s-canal) y emitido antes de absorberse (u-canal).

La fórmula de Klein-Nishina (resultado de sumar y cuadrar estos diagramas) predice la sección eficaz real de dispersión Compton — verificada experimentalmente con < 0.1% de error.

En QED, los órdenes de la expansión perturbativa van como (α/π)^n donde α = e²/4π ≈ 1/137 (constante de estructura fina). A primer orden (árbol): α. A un loop: α². A dos loops: α³. La serie converge porque α ≪ 1.

Cada "loop" en un diagrama agrega una integral ∫d⁴k sobre el momento del propagador interno — estas integrales divergen UV y requieren renormalización. La QED renormalizada es la teoría más precisa de la historia: g−2 del electrón predicho vs medido a 12 cifras decimales.`,
      formula:
        'dσ/dΩ = (α²/m²)(ω′/ω)²[ω′/ω + ω/ω′ − sin²θ]\n(Klein-Nishina, arboles QED a primer orden)\nα = e²/4πε₀ℏc ≈ 1/137.036',
      keyframes: [
        { at: 0, state: { diagramId: 'compton', showAmplitude: false, showMomentum: false } },
        { at: 0.5, state: { diagramId: 'compton', showAmplitude: true, showMomentum: false } },
        { at: 1, state: { diagramId: 'compton', showAmplitude: true, showMomentum: true } },
      ],
    },
  ],

  connect: {
    body: `Los diagramas de Feynman son más que imágenes bonitas — son algoritmos de cálculo para amplitudes de dispersión en cualquier teoría cuántica de campos.

El mismo formalismo (con diferentes reglas de Feynman) funciona para:
• QCD — cromodinámica cuántica (quarks + gluones, fuerza nuclear fuerte)
• Teoría electrodébil — unificación de EM + fuerza débil (bosones W, Z)
• Gravedad cuántica de bucles — intento de cuantizar la relatividad general

La convergencia de la serie perturbativa depende de la constante de acoplamiento:
• QED: α ≈ 1/137 → converge muy bien (expansión en α/π)
• QCD a bajas energías: αₛ ≈ 1 → NO converge → confinamiento cuántico
• QCD a altas energías: αₛ ≪ 1 → libertad asintótica (Nobel 2004)

El experimento g−2 del muón (Brookhaven, Fermilab 2021-2025) mide la anomalía del momento magnético con 11 cifras de precisión, donde ~12,000 diagramas de Feynman contribuyen a la predicción teórica. La tensión con la QED estándar podría ser la primera señal de nueva física.`,
    links: [
      { label: 'Cadenas de Decaimiento Nuclear', href: '#decay-chains' },
      { label: 'Campos EM — Maxwell cuántico', href: '#em-fields' },
      { label: 'Schrödinger 1D — mecánica cuántica base', href: '#schrodinger' },
    ],
  },
};

// ─── Diagramas definidos como estructuras de datos ────────────────────────────

interface Particle {
  id: string;
  type: 'fermion' | 'photon' | 'virtual-fermion';
  /** Puntos de la línea en espacio-tiempo [x, t, z] (3D) */
  points: [number, number, number][];
  color: string;
  label?: string;
  /** Si es línea de antipartícula (flecha invertida) */
  antiparticle?: boolean;
  /** Momento 3D para etiqueta */
  momentum?: string;
}

interface Vertex {
  pos: [number, number, number];
  label: string;
  coupling: string;  // e.g. "−ieγᵘ"
}

interface DiagramDef {
  id: string;
  name: string;
  particles: Particle[];
  vertices: Vertex[];
}

const DIAGRAMS: DiagramDef[] = [
  // ─── Dispersión Møller t-canal ────────────────────────────────────────
  {
    id: 'moller',
    name: 'Møller (t-canal): e⁻e⁻ → e⁻e⁻',
    particles: [
      // Electrón 1: entra por abajo-izquierda, sale arriba-izquierda
      {
        id: 'e1-in', type: 'fermion',
        points: [[-1.5, -2.0, 0], [-0.8, 0.0, 0]],
        color: '#38BDF8', label: 'e⁻', momentum: 'p₁',
      },
      {
        id: 'e1-out', type: 'fermion',
        points: [[-0.8, 0.0, 0], [-1.5, 2.0, 0]],
        color: '#38BDF8', label: 'e⁻', momentum: 'p₃',
      },
      // Electrón 2: entra por abajo-derecha, sale arriba-derecha
      {
        id: 'e2-in', type: 'fermion',
        points: [[1.5, -2.0, 0], [0.8, 0.0, 0]],
        color: '#818CF8', label: 'e⁻', momentum: 'p₂',
      },
      {
        id: 'e2-out', type: 'fermion',
        points: [[0.8, 0.0, 0], [1.5, 2.0, 0]],
        color: '#818CF8', label: 'e⁻', momentum: 'p₄',
      },
      // Fotón virtual (t-canal): conecta vértice izquierdo con derecho
      {
        id: 'photon-t', type: 'photon',
        points: [[-0.8, 0.0, 0], [0.8, 0.0, 0]],
        color: '#FDB813', label: 'γ*', momentum: 'q=p₁−p₃',
      },
    ],
    vertices: [
      { pos: [-0.8, 0.0, 0], label: 'V₁', coupling: '−ieγᵘ' },
      { pos: [ 0.8, 0.0, 0], label: 'V₂', coupling: '−ieγᵘ' },
    ],
  },

  // ─── Dispersión Møller u-canal ────────────────────────────────────────
  {
    id: 'moller-u',
    name: 'Møller (u-canal): intercambio cruzado',
    particles: [
      // e1 entra izquierda, cruza a derecha arriba
      {
        id: 'e1-in', type: 'fermion',
        points: [[-1.5, -2.0, 0], [-0.8, 0.0, 0]],
        color: '#38BDF8', label: 'e⁻', momentum: 'p₁',
      },
      {
        id: 'e1-out', type: 'fermion',
        points: [[-0.8, 0.0, 0], [1.5, 2.0, 0]],
        color: '#38BDF8', label: 'e⁻', momentum: 'p₄',
      },
      // e2 entra derecha, cruza a izquierda arriba
      {
        id: 'e2-in', type: 'fermion',
        points: [[1.5, -2.0, 0], [0.8, 0.0, 0]],
        color: '#818CF8', label: 'e⁻', momentum: 'p₂',
      },
      {
        id: 'e2-out', type: 'fermion',
        points: [[0.8, 0.0, 0], [-1.5, 2.0, 0]],
        color: '#818CF8', label: 'e⁻', momentum: 'p₃',
      },
      // Fotón virtual u-canal: mismo eje pero distinguible
      {
        id: 'photon-u', type: 'photon',
        points: [[-0.8, 0.0, 0], [0.8, 0.0, 0]],
        color: '#FDB813', label: 'γ*', momentum: 'q=p₁−p₄',
      },
    ],
    vertices: [
      { pos: [-0.8, 0.0, 0], label: 'V₁', coupling: '−ieγᵘ' },
      { pos: [ 0.8, 0.0, 0], label: 'V₂', coupling: '−ieγᵘ' },
    ],
  },

  // ─── Aniquilación e⁻e⁺ → γγ ─────────────────────────────────────────
  {
    id: 'annihilation',
    name: 'Aniquilación: e⁻e⁺ → γγ',
    particles: [
      // e⁻ entra desde abajo-izquierda
      {
        id: 'em', type: 'fermion',
        points: [[-1.5, -2.0, 0], [0.0, 0.0, 0]],
        color: '#38BDF8', label: 'e⁻', momentum: 'p₁',
      },
      // e⁺ entra desde abajo-derecha (antipartícula: flecha invertida en tiempo)
      {
        id: 'ep', type: 'fermion',
        points: [[1.5, -2.0, 0], [0.0, 0.0, 0]],
        color: '#F472B6', label: 'e⁺', momentum: 'p₂', antiparticle: true,
      },
      // Fermión virtual (propagador interno)
      {
        id: 'vf', type: 'virtual-fermion',
        points: [[0.0, 0.0, 0], [0.0, 1.0, 0]],
        color: '#94A3B8', label: 'e*', momentum: 'q',
      },
      // γ₁ sale arriba-izquierda
      {
        id: 'g1', type: 'photon',
        points: [[0.0, 1.0, 0], [-1.5, 2.0, 0]],
        color: '#FDB813', label: 'γ', momentum: 'k₁',
      },
      // γ₂ sale arriba-derecha
      {
        id: 'g2', type: 'photon',
        points: [[0.0, 1.0, 0], [1.5, 2.0, 0]],
        color: '#FBBF24', label: 'γ', momentum: 'k₂',
      },
    ],
    vertices: [
      { pos: [0.0, 0.0, 0], label: 'V₁', coupling: '−ieγᵘ' },
      { pos: [0.0, 1.0, 0], label: 'V₂', coupling: '−ieγᵘ' },
    ],
  },

  // ─── Dispersión Compton ───────────────────────────────────────────────
  {
    id: 'compton',
    name: 'Compton: e⁻γ → e⁻γ',
    particles: [
      // e⁻ entra desde abajo-izquierda
      {
        id: 'e-in', type: 'fermion',
        points: [[-1.5, -2.0, 0], [-0.5, -0.5, 0]],
        color: '#38BDF8', label: 'e⁻', momentum: 'p',
      },
      // γ entrante desde abajo-derecha
      {
        id: 'g-in', type: 'photon',
        points: [[1.5, -2.0, 0], [-0.5, -0.5, 0]],
        color: '#FDB813', label: 'γ', momentum: 'k',
      },
      // Electrón virtual (propagador)
      {
        id: 'e-virt', type: 'virtual-fermion',
        points: [[-0.5, -0.5, 0], [-0.5, 0.5, 0]],
        color: '#94A3B8', label: 'e*',
      },
      // e⁻ saliente arriba-izquierda
      {
        id: 'e-out', type: 'fermion',
        points: [[-0.5, 0.5, 0], [-1.5, 2.0, 0]],
        color: '#38BDF8', label: 'e⁻', momentum: "p'",
      },
      // γ saliente arriba-derecha
      {
        id: 'g-out', type: 'photon',
        points: [[-0.5, 0.5, 0], [1.5, 2.0, 0]],
        color: '#FDB813', label: 'γ', momentum: "k'",
      },
    ],
    vertices: [
      { pos: [-0.5, -0.5, 0], label: 'V₁', coupling: '−ieγᵘ' },
      { pos: [-0.5,  0.5, 0], label: 'V₂', coupling: '−ieγᵘ' },
    ],
  },
];

// ─── Sub-componente interno (vive dentro del Canvas) ──────────────────────────

interface SceneProps {
  diagramId: string;
  showAmplitude: boolean;
  showMomentum: boolean;
  time: React.MutableRefObject<number>;
}

function FeynmanScene({ diagramId, showAmplitude, showMomentum, time }: SceneProps) {
  const diagram = DIAGRAMS.find(d => d.id === diagramId) ?? DIAGRAMS[0];

  // Construir geometrías de líneas para cada partícula
  const lineGeoms = useMemo(() => {
    return diagram.particles.map(p => {
      const points = p.points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
      const geom = new THREE.BufferGeometry().setFromPoints(points);
      return { id: p.id, geom, particle: p };
    });
  }, [diagram]);

  // Geometría de la línea ondulada del fotón (helicoide en el plano XY)
  const photonGeoms = useMemo(() => {
    return diagram.particles
      .filter(p => p.type === 'photon')
      .map(p => {
        const [x0, y0, z0] = p.points[0];
        const [x1, y1, z1] = p.points[p.points.length - 1];
        const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        // Dirección tangente y normal (perpendicular en el plano XY)
        const tx = dx / len, ty = dy / len;
        const nx = -ty, ny = tx; // normal perpendicular en el plano

        const N = 80; // segmentos de la onda
        const freq = 5.0; // ciclos a lo largo de la línea
        const amp = 0.08; // amplitud de la oscilación
        const verts: THREE.Vector3[] = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          const s = t * len; // posición a lo largo de la línea
          const wave = amp * Math.sin(2 * Math.PI * freq * t);
          const px = x0 + t * dx + wave * nx;
          const py = y0 + t * dy + wave * ny;
          const pz = z0 + t * dz + wave * (nx === 0 && ny === 0 ? 1.0 : 0.0);
          verts.push(new THREE.Vector3(px, py, pz + (z0 + t * dz !== pz ? 0 : 0)));
        }
        const geom = new THREE.BufferGeometry().setFromPoints(verts);
        return { id: p.id, geom, particle: p };
      });
  }, [diagram]);

  // Refs para animación de pulso en vértices
  const vertexMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const axisArrowRef = useRef<THREE.Mesh | null>(null);

  useFrame((_, delta) => {
    time.current += delta;
    // Pulso suave en los vértices
    const pulse = 0.85 + 0.15 * Math.sin(time.current * 3.5);
    vertexMeshRefs.current.forEach(m => {
      if (m) m.scale.setScalar(pulse);
    });
  });

  // Materiales
  const fermionMat = useMemo(() => new THREE.LineBasicMaterial({
    color: '#38BDF8', linewidth: 2,
  }), []);

  return (
    <>
      {/* Eje de tiempo (t) — fondo sutil */}
      <mesh position={[0, 0, -0.01]} ref={axisArrowRef}>
        <planeGeometry args={[0.02, 4.5]} />
        <meshStandardMaterial
          color="#1E293B"
          emissive="#1E293B"
          emissiveIntensity={0.5}
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Líneas fermiónicas */}
      {lineGeoms
        .filter(lg => lg.particle.type === 'fermion')
        .map(lg => (
          <FermionLine
            key={lg.id}
            geom={lg.geom}
            color={lg.particle.color}
            antiparticle={lg.particle.antiparticle}
            momentum={showMomentum ? (lg.particle.momentum ?? '') : ''}
            label={lg.particle.label ?? ''}
          />
        ))}

      {/* Propagadores fermión virtual */}
      {lineGeoms
        .filter(lg => lg.particle.type === 'virtual-fermion')
        .map(lg => (
          <VirtualFermionLine key={lg.id} geom={lg.geom} color={lg.particle.color} />
        ))}

      {/* Líneas onduladas (fotones) */}
      {photonGeoms.map(pg => (
        <PhotonLine
          key={pg.id}
          geom={pg.geom}
          color={pg.particle.color}
          momentum={showMomentum ? (pg.particle.momentum ?? '') : ''}
          label={pg.particle.label ?? ''}
        />
      ))}

      {/* Vértices QED */}
      {diagram.vertices.map((v, i) => (
        <VertexSphere
          key={v.label}
          pos={v.pos}
          coupling={showAmplitude ? v.coupling : ''}
          meshRef={(el) => { vertexMeshRefs.current[i] = el; }}
        />
      ))}

      {/* Etiqueta del eje de tiempo */}
      <Html position={[0.15, 2.3, 0]} style={{ pointerEvents: 'none' }}>
        <span style={{
          color: '#64748B',
          fontSize: '11px',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
        }}>t (tiempo)</span>
      </Html>

      {/* Etiqueta del eje de espacio */}
      <Html position={[1.8, -2.3, 0]} style={{ pointerEvents: 'none' }}>
        <span style={{
          color: '#64748B',
          fontSize: '11px',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
        }}>x (espacio)</span>
      </Html>
    </>
  );
}

// ─── Componentes auxiliares del diagrama ─────────────────────────────────────

function FermionLine({
  geom, color, antiparticle, momentum, label,
}: {
  geom: THREE.BufferGeometry;
  color: string;
  antiparticle?: boolean;
  momentum: string;
  label: string;
}) {
  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color, linewidth: 2 }),
    [color]
  );

  // Calcular midpoint para la etiqueta
  const positions = geom.attributes.position;
  if (!positions) return null;
  const n = positions.count;
  const midIdx = Math.floor(n / 2);
  const midX = positions.getX(midIdx);
  const midY = positions.getY(midIdx);
  const midZ = positions.getZ(midIdx);

  return (
    <group>
      <primitive object={new THREE.Line(geom, mat)} />
      {/* Flecha indicadora de dirección */}
      <ArrowHead geom={geom} color={color} antiparticle={antiparticle} />
      {/* Etiqueta HTML */}
      {label && (
        <Html position={[midX - 0.25, midY, midZ]} style={{ pointerEvents: 'none' }}>
          <span style={{
            color,
            fontSize: '12px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            textShadow: '0 0 6px ' + color,
            whiteSpace: 'nowrap',
          }}>
            {label}
            {momentum ? <><br /><span style={{ fontSize: '10px', opacity: 0.8 }}>{momentum}</span></> : null}
          </span>
        </Html>
      )}
    </group>
  );
}

function ArrowHead({
  geom, color, antiparticle,
}: {
  geom: THREE.BufferGeometry;
  color: string;
  antiparticle?: boolean;
}) {
  const positions = geom.attributes.position;
  if (!positions) return null;

  // Punto a 2/3 del recorrido para la flecha
  const n = positions.count;
  const i = antiparticle
    ? Math.floor(n / 3)
    : Math.floor((2 * n) / 3);
  const i2 = Math.min(i + 1, n - 1);

  const px = positions.getX(i), py = positions.getY(i);
  const nx = positions.getX(i2), ny = positions.getY(i2);
  const dx = nx - px, dy = ny - py;
  const angle = Math.atan2(dy, dx);
  const effectiveAngle = antiparticle ? angle + Math.PI : angle;

  const conePos: [number, number, number] = [
    positions.getX(i), positions.getY(i), positions.getZ(i),
  ];

  return (
    <mesh position={conePos} rotation={[0, 0, effectiveAngle - Math.PI / 2]}>
      <coneGeometry args={[0.05, 0.12, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.2}
        toneMapped={false}
      />
    </mesh>
  );
}

function VirtualFermionLine({ geom, color }: { geom: THREE.BufferGeometry; color: string }) {
  // Línea discontinua (simulada con múltiples segmentos cortos)
  const mat = useMemo(
    () => new THREE.LineDashedMaterial({ color, linewidth: 1, dashSize: 0.07, gapSize: 0.05 }),
    [color]
  );
  const lineObj = useMemo(() => {
    const l = new THREE.Line(geom.clone(), mat);
    l.computeLineDistances();
    return l;
  }, [geom, mat]);

  return <primitive object={lineObj} />;
}

function PhotonLine({
  geom, color, momentum, label,
}: {
  geom: THREE.BufferGeometry;
  color: string;
  momentum: string;
  label: string;
}) {
  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color, linewidth: 2 }),
    [color]
  );

  const positions = geom.attributes.position;
  if (!positions) return null;
  const n = positions.count;
  const midIdx = Math.floor(n / 2);
  const midX = positions.getX(midIdx);
  const midY = positions.getY(midIdx);
  const midZ = positions.getZ(midIdx);

  return (
    <group>
      <primitive object={new THREE.Line(geom, mat)} />
      {label && (
        <Html position={[midX + 0.18, midY + 0.1, midZ]} style={{ pointerEvents: 'none' }}>
          <span style={{
            color,
            fontSize: '12px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            textShadow: '0 0 8px ' + color,
            whiteSpace: 'nowrap',
          }}>
            {label}
            {momentum ? <><br /><span style={{ fontSize: '9px', opacity: 0.8 }}>{momentum}</span></> : null}
          </span>
        </Html>
      )}
    </group>
  );
}

function VertexSphere({
  pos, coupling, meshRef,
}: {
  pos: [number, number, number];
  coupling: string;
  meshRef: (el: THREE.Mesh | null) => void;
}) {
  const COL = '#F97316';
  return (
    <group position={pos}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.10, 20, 16]} />
        <meshStandardMaterial
          color={COL}
          emissive={COL}
          emissiveIntensity={1.8}
          toneMapped={false}
          roughness={0.2}
          metalness={0.1}
        />
      </mesh>
      {/* Halo adicional */}
      <mesh>
        <sphereGeometry args={[0.18, 12, 10]} />
        <meshStandardMaterial
          color={COL}
          emissive={COL}
          emissiveIntensity={0.4}
          toneMapped={false}
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </mesh>
      {/* Etiqueta del vértice */}
      {coupling && (
        <Html position={[0.22, 0.12, 0]} style={{ pointerEvents: 'none' }}>
          <span style={{
            color: COL,
            fontSize: '10px',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            textShadow: '0 0 6px ' + COL,
          }}>{coupling}</span>
        </Html>
      )}
    </group>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FeynmanDiagrams() {
  const { audience } = useAudience();

  const [diagramId, setDiagramId] = useState<string>('moller');
  const [showAmplitude, setShowAmplitude] = useState(false);
  const [showMomentum, setShowMomentum] = useState(false);

  const timeRef = useRef(0);

  const diagram = DIAGRAMS.find(d => d.id === diagramId) ?? DIAGRAMS[0];

  // Calcular |M|² aproximado para mostrar en HUD (proporcional)
  // Møller: |M|² ∝ e⁴/q⁴  — mostramos factor de coupling α² = (e²/4π)²
  const alpha = 1 / 137.036;
  const alphaSq = alpha * alpha;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage
          cameraDistance={6}
          autoRotate={false}
          bloomIntensity={0.9}
          bloomThreshold={0.1}
          bgColor="#05060A"
        >
          <FeynmanScene
            diagramId={diagramId}
            showAmplitude={showAmplitude}
            showMomentum={showMomentum}
            time={timeRef}
          />
        </Stage>

        {/* HUD de información */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div className="text-[10px] uppercase tracking-widest text-[#64748B] mb-1">QED</div>
          <div><span className="text-[#64748B]">α&nbsp;&nbsp;&nbsp;</span>= 1/137.036</div>
          <div><span className="text-[#64748B]">α²&nbsp;&nbsp;</span>= {alphaSq.toExponential(3)}</div>
          <div><span className="text-[#64748B]">orden</span>= árbol (n=1 loop)</div>
          <div><span className="text-[#64748B]">vértices</span>= {diagram.vertices.length}</div>
        </div>

        {/* Controles rápidos */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <ToggleBtn
            active={showAmplitude}
            onClick={() => setShowAmplitude(v => !v)}
            label="−ieγᵘ"
            title="Mostrar acoplamiento en vértices"
          />
          <ToggleBtn
            active={showMomentum}
            onClick={() => setShowMomentum(v => !v)}
            label="pᵘ"
            title="Mostrar momentos"
          />
        </div>
      </div>

      <LessonPanel<FDState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.diagramId !== undefined) setDiagramId(patch.diagramId);
          if (patch.showAmplitude !== undefined) setShowAmplitude(patch.showAmplitude);
          if (patch.showMomentum !== undefined) setShowMomentum(patch.showMomentum);
        }}
        sandbox={
          <>
            <Section title="Diagrama">
              <div className="grid grid-cols-1 gap-1.5">
                {DIAGRAMS.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setDiagramId(d.id)}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      diagramId === d.id
                        ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#F97316]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Vista">
              <div className="space-y-2">
                <LabeledToggle
                  label="Acoplamientos (−ieγᵘ)"
                  value={showAmplitude}
                  onChange={setShowAmplitude}
                />
                <LabeledToggle
                  label="Momentos (pᵘ)"
                  value={showMomentum}
                  onChange={setShowMomentum}
                />
              </div>
            </Section>

            {audience !== 'child' && (
              <Section title="Reglas de Feynman QED">
                <div className="space-y-1.5 text-[11px] font-mono text-[#CBD5E1]">
                  <RuleRow symbol="────►" label="Fermión: u(p) / ū(p)" color="#38BDF8" />
                  <RuleRow symbol="∿∿∿∿" label="Fotón real: εᵘ(k)" color="#FDB813" />
                  <RuleRow symbol="- - -" label="Propagador virtual" color="#94A3B8" />
                  <RuleRow symbol="●" label="Vértice: −ieγᵘ" color="#F97316" />
                </div>
              </Section>
            )}

            {audience === 'researcher' && (
              <Section title="Amplitud de árbol">
                <div className="text-[10px] font-mono text-[#CBD5E1] leading-relaxed space-y-1">
                  <div className="text-[#FDB813]">|M|² ∝ e⁴ · f(s,t,u)</div>
                  <div className="text-[#64748B]">Variables de Mandelstam:</div>
                  <div>s = (p₁+p₂)²</div>
                  <div>t = (p₁−p₃)²</div>
                  <div>u = (p₁−p₄)²</div>
                  <div>s + t + u = Σmᵢ²</div>
                  <div className="mt-2 text-[#64748B]">
                    σ = ∫|M|² dΦ₂ / (4·|p_cm|·√s)
                  </div>
                </div>
              </Section>
            )}

            <Section title="Constantes QED">
              <div className="space-y-0.5">
                <Row label="α" value="1/137.036" />
                <Row label="e" value="1.602×10⁻¹⁹ C" />
                <Row label="mₑ" value="0.511 MeV/c²" />
                <Row label="g−2 (e⁻)" value="2.00231930436" />
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ─── UI helpers ────────────────────────────────────────────────────────────────

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

function ToggleBtn({
  active, onClick, label, title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-3 h-9 rounded-md border text-[12px] font-mono transition flex items-center justify-center ${
        active
          ? 'border-[#F97316]/60 text-[#F97316] bg-[#F97316]/10'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

function LabeledToggle({
  label, value, onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        onClick={() => onChange(!value)}
        className={`w-8 h-4 rounded-full transition-colors flex items-center ${
          value ? 'bg-[#F97316]/60' : 'bg-[#1E293B]'
        }`}
      >
        <div className={`w-3 h-3 rounded-full bg-white transition-transform mx-0.5 ${
          value ? 'translate-x-4' : 'translate-x-0'
        }`} />
      </div>
      <span className="text-[11px] text-[#CBD5E1]">{label}</span>
    </label>
  );
}

function RuleRow({ symbol, label, color }: { symbol: string; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span style={{ color, minWidth: '40px', fontSize: '11px' }}>{symbol}</span>
      <span className="text-[#94A3B8] text-[10px]">{label}</span>
    </div>
  );
}
