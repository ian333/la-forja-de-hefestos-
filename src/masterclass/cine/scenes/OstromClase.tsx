/**
 * OstromClase — cine + SIMULACIÓN real del premio 2009 (Elinor Ostrom).
 *
 * No es staging: es el MODELO corriendo, como el BH raytraced de Gargantua.
 * Un pasto común (recurso renovable, logístico) y un hato de ganado (GLB cow)
 * que lo pastorea. Dinámica REAL:
 *
 *     dS/dt = g·S·(1−S) − c·N·S          (recurso renovable con cosecha)
 *
 *   S = pasto (0..1, tiñe el campo verde↔café)
 *   N = número de vacas
 *   Acceso abierto: cada quien mete otra vaca mientras haya pasto → sobrepasa
 *     el punto sostenible → S colapsa → las vacas se mueren (tragedia, Hardin).
 *   Gobernanza (Ostrom): el hato se cap a N sostenible → S se recupera.
 *
 * Raíz animal (del debate): las abejas acortan la danza waggle cuando el parche
 * se satura; los murciélagos vampiro sancionan al que no recíproca. Gobernarse
 * sin jefe es un algoritmo evolutivo, no un invento humano. Ostrom lo redescubrió
 * con una libreta de campo — y fue la primera mujer Nobel de economía.
 *
 * Armada con el estándar `cine/` (CineStage + CineCamera + CineText) + un
 * componente de simulación custom (Commons), igual que el BH mete BHRaytraced.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import AtomModel from '@/masterclass/assets/gltf/AtomModel';
import { CineStage, CineCamera, CineText, CineModel, useCineTime } from '@/masterclass/cine';

const COW = '/models/library/animals/cow.glb';
const TREE = '/models/library/nature/tree_oak.glb';
AtomModel.preload(COW);
AtomModel.preload(TREE);

const COW_MAX = 9;
const GOVERN_T = 32;        // a los 32 s entra la gobernanza
const G = 0.35;            // regeneración del pasto
const C = 0.05;            // consumo por vaca
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

interface SimState { S: number; N: number; }

// ── La simulación: campo + integración de la ODE ──────────────────────────
function SimField({ simRef }: { simRef: React.MutableRefObject<SimState> }) {
  const timeRef = useCineTime();
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const green = useMemo(() => new THREE.Color('#2E8B57'), []);
  const brown = useMemo(() => new THREE.Color('#5A4327'), []);
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);
    const t = timeRef.current;
    const s = simRef.current;

    if (t < 6) {
      // Acto 1 — hook: pradera intacta.
      s.S = 1; s.N = 2;
    } else {
      const governed = t >= GOVERN_T;
      if (!governed) {
        // Acceso abierto: todos meten más vacas mientras haya pasto; mueren si no.
        if (s.S > 0.18) s.N += dt * 0.95;
        if (s.S < 0.07) s.N -= dt * 1.6;
      } else {
        // Gobernanza: cap al hato sostenible (S* objetivo ≈ 0.6).
        const nSust = (G * (1 - 0.6)) / C;
        s.N += (nSust - s.N) * dt * 0.7;
      }
      s.N = clamp(s.N, 0, COW_MAX);
      const dS = G * s.S * (1 - s.S) - C * s.N * s.S;
      s.S = clamp(s.S + dS * dt, 0, 1);
    }

    // El campo se tiñe: verde sano → café muerto.
    if (matRef.current) {
      tmp.copy(brown).lerp(green, s.S);
      matRef.current.color.copy(tmp);
      matRef.current.emissive.copy(tmp);
      matRef.current.emissiveIntensity = 0.10 + 0.35 * s.S;
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
      <circleGeometry args={[16, 64]} />
      <meshStandardMaterial ref={matRef} color="#2E8B57" emissive="#2E8B57" emissiveIntensity={0.4} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}

// ── Una vaca: visible si su índice cabe en el hato; pastorea y deambula ────
function Cow({ i, simRef }: { i: number; simRef: React.MutableRefObject<SimState> }) {
  const groupRef = useRef<THREE.Group>(null);
  const scaleRef = useRef(0);
  const timeRef = useCineTime();
  const home = useMemo<[number, number]>(() => {
    const a = (i / COW_MAX) * Math.PI * 2 + i * 0.7;
    const r = 3.5 + (i % 4) * 2.4;
    return [Math.cos(a) * r, Math.sin(a) * r];
  }, []);
  const phase = useMemo(() => i * 1.37, []);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const t = timeRef.current;
    const target = i < Math.round(simRef.current.N) ? 1 : 0;
    scaleRef.current += (target - scaleRef.current) * 0.06;
    const sc = scaleRef.current;
    g.visible = sc > 0.02;
    g.scale.setScalar(Math.max(0.001, sc));
    const drift = Math.cos(t * 0.18 + phase) * 1.3;
    const wob = Math.sin(t * 0.4 + phase) * 0.9;
    g.position.set(home[0] + drift, Math.abs(Math.sin(t * 1.6 + phase)) * 0.12, home[1] + wob);
    g.rotation.y = t * 0.12 + phase;
  });

  return (
    <group ref={groupRef}>
      <AtomModel src={COW} color="#EDE6CE" glow={1.0} mode="atom" fitTo={2.0} halo={false} />
    </group>
  );
}

function Commons() {
  const simRef = useRef<SimState>({ S: 1, N: 2 });
  const cows = useMemo(() => Array.from({ length: COW_MAX }, (_, i) => i), []);
  return (
    <>
      <SimField simRef={simRef} />
      {cows.map(i => <Cow key={i} i={i} simRef={simRef} />)}
      {/* árboles al borde — encuadre */}
      <CineModel src={TREE} position={[-13, 0, -6]} at={0} color="#3FA56A" fitTo={5} floatAmp={0} />
      <CineModel src={TREE} position={[13, 0, -7]} at={0} color="#3FA56A" fitTo={5.6} floatAmp={0} />
      <CineModel src={TREE} position={[10, 0, 8]} at={0} color="#3FA56A" fitTo={4.6} floatAmp={0} />
    </>
  );
}

export default function OstromClase() {
  return (
    <CineStage
      mood="starry_night"
      envIntensity={0.5}
      duration={52}
      chapter="Ostrom · 2009 · la tragedia de los comunes"
      fov={48}
      cameraPos={[0, 16, 34]}
      postfx={{ intensity: 1.4, threshold: 0.3, vignette: 0.78, aberration: 0.0005 }}
    >
      <CineCamera
        keys={[
          { t: 0,  pos: [0, 16, 34],  look: [0, 1, 0] },
          { t: 8,  pos: [-11, 5, 17], look: [0, 1.5, 0] },
          { t: 20, pos: [12, 7, 15],  look: [0, 1, 0] },
          { t: 30, pos: [4, 4, 13],   look: [0, 0.8, 0] },
          { t: 40, pos: [-7, 13, 26], look: [0, 2, 0] },
          { t: 52, pos: [0, 18, 34],  look: [0, 2, 0] },
        ]}
      />

      <Commons />

      <ambientLight intensity={0.22} color="#2A2640" />
      <directionalLight position={[5, 12, 4]} intensity={0.55} color="#FFE6C0" />
      <fog attach="fog" args={['#02010A', 26, 78]} />

      {/* La narración en pantalla — los actos del modelo */}
      <CineText text="Un pasto. De todos y de nadie." position={[0, 11, -9]} at={1.5} hold={4} width={11} height={1.1} color="#9FE8B0" />
      <CineText text="A ti te conviene meter una vaca más: el pasto se gasta entre todos, la vaca es solo tuya." position={[0, 12, -9]} at={8} hold={6} width={16} height={1.0} color="#FDB813" />
      <CineText text="Todos hicieron lo razonable. El pasto murió." position={[0, 12, -9]} at={21} hold={5} width={12} height={1.15} color="#FF6B5A" fontWeight={600} />
      <CineText text="Hardin lo llamó la tragedia de los comunes." position={[0, 10.5, -9]} at={24} hold={4} width={12} height={0.9} color="#A89580" />
      <CineText text="Pero Ostrom fue a ver pueblos reales: pesquerías, ejidos, riego. Sin Estado ni mercado, el pasto seguía vivo." position={[0, 12, -9]} at={33} hold={6.5} width={17} height={1.0} color="#4FC3F7" />
      <CineText text="Las abejas acortan su danza cuando el parche se satura. Gobernarse sin jefe es más viejo que el dinero." position={[0, 12, -9]} at={41} hold={6} width={17} height={1.0} color="#A78BFA" />
      <CineText text="Primera mujer Nobel de economía. La tragedia es opcional — depende de las reglas que el pueblo se da." position={[0, 11.5, -9]} at={47} hold={6} width={16} height={1.0} color="#FFE5A0" fontWeight={500} />
    </CineStage>
  );
}
