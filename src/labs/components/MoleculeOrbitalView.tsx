/**
 * MoleculeOrbitalView — visualiza una molécula con el MISMO pipeline
 * visual que `MultiElectronAtomView` (el tab Átomo).
 *
 * Diferencia crítica respecto a átomos: los MOs mezclan orbitales de
 * varios átomos, y el término cruzado 2·cₐ·c_b·φₐ·φ_b es la densidad
 * de bonding que aparece/desaparece cuando los átomos se acercan o
 * separan. Para que el observador VEA el enlace formándose, el
 * sampling debe evaluar ψ_MO completo (no sólo orbitales atómicos
 * individuales) y re-muestrear cada frame.
 *
 * Pipeline:
 *   1. Cada frame, `sampleMoleculeFast` re-muestrea N puntos con
 *      importance per-átomo + LCAO completo. Rápido (~3ms para 2500 pts).
 *   2. Resultados escritos in-place en un BufferAttribute DynamicDraw.
 *   3. Core exclusion filtra los puntos que tapan el núcleo.
 *   4. Textura `getParticleTexture` (gradiente radial) — idéntica al
 *      AtomView → look unificado.
 *   5. Colores por simetría del MO dominante:
 *        bonding     → cian (+) / naranja (−)
 *        antibonding → verde (+) / rojo (−)
 *        nonbonding  → violeta (+) / durazno (−)   (pares libres)
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  sampleMoleculeFast,
  bondOrder, totalElectrons,
  type Molecule3D,
  type MoleculeSample,
} from '@/lib/chem/quantum/molecular-orbitals';
import { ELEMENTS } from '@/lib/chem/elements';
import { getParticleTexture } from './sprite-texture';

interface MoleculeOrbitalViewProps {
  molecule: Molecule3D;
  /** Puntos re-muestreados por frame (default 2500) */
  nPoints?: number;
  height?: number | string;
  visibleMOs?: number[];
  skipSampling?: boolean;
  lowRes?: boolean;
  autoRotate?: boolean;
  /** Radio en bohrs: puntos más cerca de un átomo no se dibujan */
  coreExclusion?: number;
}

// ═══════════════════════════════════════════════════════════════
// Color por simetría de MO (coherente con los 6 tipos que maneja el sistema)
// ═══════════════════════════════════════════════════════════════

function colorForSample(s: MoleculeSample, molecule: Molecule3D): THREE.Color {
  const mo = molecule.mos[s.dominantMOIndex];
  const sym = mo?.symmetry;
  if (sym === 'bonding') {
    return new THREE.Color(s.sign > 0 ? '#4FC3F7' : '#FFB74D');
  }
  if (sym === 'antibonding') {
    return new THREE.Color(s.sign > 0 ? '#66BB6A' : '#EF5350');
  }
  // nonbonding (lone pair)
  return new THREE.Color(s.sign > 0 ? '#BA68C8' : '#FFA726');
}

// ═══════════════════════════════════════════════════════════════
// Nube dinámica: re-samplea cada frame con sampleMoleculeFast
// ═══════════════════════════════════════════════════════════════

function PointCloudDynamic({
  molecule, nPoints, visibleMOs, coreExclusion,
}: {
  molecule: Molecule3D;
  nPoints: number;
  visibleMOs?: number[];
  coreExclusion: number;
}) {
  const particleTexture = useMemo(() => getParticleTexture(), []);
  const posArrayRef = useRef<Float32Array | null>(null);
  const colArrayRef = useRef<Float32Array | null>(null);
  const seedRef = useRef<number>(42);

  // Ref al molecule para garantizar que el useFrame lea el estado más fresco
  const moleculeRef = useRef(molecule);
  moleculeRef.current = molecule;

  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(nPoints * 3);
    const colors = new Float32Array(nPoints * 3);
    posArrayRef.current = positions;
    colArrayRef.current = colors;
    const posAttr = new THREE.BufferAttribute(positions, 3);
    const colAttr = new THREE.BufferAttribute(colors, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute('position', posAttr);
    geom.setAttribute('color', colAttr);
    geom.setDrawRange(0, 0);
    return geom;
  }, [nPoints]);

  useFrame(() => {
    const posArr = posArrayRef.current;
    const colArr = colArrayRef.current;
    if (!posArr || !colArr) return;

    const mol = moleculeRef.current;

    // Semilla fresca cada frame → "shimmer" natural de la nube cuántica
    seedRef.current = (seedRef.current * 16807 + 19) % 2147483647;
    const samples = sampleMoleculeFast(mol, nPoints, seedRef.current, visibleMOs);

    // Core exclusion — filtra puntos que taparían el núcleo
    let written = 0;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (coreExclusion > 0) {
        let tooClose = false;
        for (let a = 0; a < mol.atoms.length; a++) {
          const ap = mol.atoms[a].position;
          const dx = s.x - ap[0], dy = s.y - ap[1], dz = s.z - ap[2];
          if (dx * dx + dy * dy + dz * dz < coreExclusion * coreExclusion) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;
      }
      posArr[written * 3 + 0] = s.x;
      posArr[written * 3 + 1] = s.y;
      posArr[written * 3 + 2] = s.z;
      const col = colorForSample(s, mol);
      const brightness = 0.4 + 0.6 * s.density;
      colArr[written * 3 + 0] = col.r * brightness;
      colArr[written * 3 + 1] = col.g * brightness;
      colArr[written * 3 + 2] = col.b * brightness;
      written++;
    }

    geometry.setDrawRange(0, written);
    (geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (geometry.getAttribute('color')    as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <points geometry={geometry}>
      <pointsMaterial
        vertexColors
        map={particleTexture}
        alphaMap={particleTexture}
        size={0.28}
        sizeAttenuation
        transparent
        opacity={0.92}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// ═══════════════════════════════════════════════════════════════
// Núcleo con 3 capas — idéntico a AtomView
// ═══════════════════════════════════════════════════════════════

function Nucleus({ position, element, Z }: {
  position: [number, number, number];
  element: string;
  Z: number;
}) {
  const scale = 0.16 + 0.045 * Math.log2(Math.max(1, Z));
  const atomColor = ELEMENTS[element]?.color ?? '#FDD835';
  return (
    <group position={position}>
      <mesh>
        <icosahedronGeometry args={[scale, 2]} />
        <meshStandardMaterial
          color="#FFF3C4"
          emissive="#FFB300"
          emissiveIntensity={0.7}
          roughness={0.35}
          metalness={0.25}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[scale * 1.35, 24, 24]} />
        <meshBasicMaterial
          color="#FFD54F"
          transparent opacity={0.25}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[scale * 2.6, 20, 20]} />
        <meshBasicMaterial
          color="#FFE082"
          transparent opacity={0.10}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <ringGeometry args={[scale * 1.55, scale * 1.85, 32]} />
        <meshBasicMaterial color={atomColor} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function BondLines({ atoms }: { atoms: Molecule3D['atoms'] }) {
  const lines = useMemo(() => {
    const out: { from: [number, number, number]; to: [number, number, number] }[] = [];
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const d = Math.hypot(
          atoms[i].position[0] - atoms[j].position[0],
          atoms[i].position[1] - atoms[j].position[1],
          atoms[i].position[2] - atoms[j].position[2],
        );
        if (d < 3.5) {
          out.push({ from: atoms[i].position, to: atoms[j].position });
        }
      }
    }
    return out;
  }, [atoms]);
  return (
    <>
      {lines.map((l, idx) => {
        const geom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(...l.from),
          new THREE.Vector3(...l.to),
        ]);
        return (
          <line key={idx}>
            <primitive object={geom} attach="geometry" />
            <lineDashedMaterial color="#4FC3F7" dashSize={0.15} gapSize={0.1} opacity={0.4} transparent />
          </line>
        );
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// MoleculeGroup — todo rota junto
// ═══════════════════════════════════════════════════════════════

function MoleculeGroup({
  molecule, nPoints, visibleMOs, autoRotate, skipCloud, coreExclusion,
}: {
  molecule: Molecule3D;
  nPoints: number;
  visibleMOs?: number[];
  autoRotate: boolean;
  skipCloud: boolean;
  coreExclusion: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += dt * 0.08;
    }
  });

  return (
    <group ref={groupRef}>
      {molecule.atoms.map((atom, i) => (
        <Nucleus key={i} position={atom.position} element={atom.element} Z={atom.Z} />
      ))}
      <BondLines atoms={molecule.atoms} />
      {molecule.atoms.map((atom, i) => (
        <pointLight
          key={`l${i}`}
          position={atom.position}
          color="#FFE082"
          intensity={2.5}
          distance={8}
        />
      ))}
      {!skipCloud && (
        <PointCloudDynamic
          molecule={molecule}
          nPoints={nPoints}
          visibleMOs={visibleMOs}
          coreExclusion={coreExclusion}
        />
      )}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════
// VIEWPORT
// ═══════════════════════════════════════════════════════════════

export default function MoleculeOrbitalView({
  molecule, nPoints = 2500, height = 560, visibleMOs, skipSampling,
  autoRotate = true, coreExclusion = 0.45,
}: MoleculeOrbitalViewProps) {
  const cameraDistance = useMemo(() => {
    const bl = molecule.bondLength ?? 2;
    return Math.max(10, bl * 3);
  }, [molecule.formula, molecule.bondLength]);

  const styleHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      style={{ height: styleHeight }}
      className="w-full h-full overflow-hidden relative bg-[radial-gradient(ellipse_at_center,_#0f1117_0%,_#05060a_100%)]"
    >
      <Canvas
        camera={{ position: [cameraDistance * 0.8, cameraDistance * 0.5, cameraDistance], fov: 45 }}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={0.22} />
        <MoleculeGroup
          molecule={molecule}
          nPoints={nPoints}
          visibleMOs={visibleMOs}
          autoRotate={autoRotate && !skipSampling}
          skipCloud={!!skipSampling}
          coreExclusion={coreExclusion}
        />
        <OrbitControls
          enablePan={false}
          minDistance={cameraDistance * 0.3}
          maxDistance={cameraDistance * 3}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
}

export { bondOrder, totalElectrons };
