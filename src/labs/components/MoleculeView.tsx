/**
 * MoleculeView — visualización 3D tipo "bolas y palos" de un conjunto
 * de moléculas, con opacidad proporcional a concentración.
 *
 * Cada molécula del preset se muestra con:
 *   - Esferas por átomo (radio proporcional a radio covalente, color CPK)
 *   - Cilindros por enlace
 *   - Opacidad ∝ concentración actual / concentración máxima histórica
 *
 * Al cambiar concentraciones, las moléculas "aparecen/desvanecen" visualmente.
 * Esto NO es dinámica molecular — es iconografía cinética, pero
 * transmite el cambio de mezcla reactiva en tiempo real.
 */

import { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Molecule } from '@/lib/chem/molecule';
import { ELEMENTS } from '@/lib/chem/elements';

interface SpeciesDisplay {
  formula: string;
  molecule: Molecule;
  concentration: number;     // actual
  concentrationMax: number;  // referencia para opacidad (p.ej. C₀ inicial)
  role: 'reactant' | 'product' | 'intermediate';
}

interface MoleculeViewProps {
  species: SpeciesDisplay[];
  height?: number;
}

/** Layout en círculo: reactantes a izquierda, productos a derecha. */
function moleculeAnchors(species: SpeciesDisplay[]): [number, number, number][] {
  const anchors: [number, number, number][] = [];
  const reactants = species.filter((s) => s.role === 'reactant');
  const products = species.filter((s) => s.role === 'product');
  const intermediates = species.filter((s) => s.role === 'intermediate');

  const placeRow = (items: SpeciesDisplay[], x: number): void => {
    const n = items.length;
    const spacing = 4;
    const yStart = -(n - 1) * spacing / 2;
    for (let i = 0; i < n; i++) {
      anchors.push([x, yStart + i * spacing, 0]);
    }
  };

  placeRow(reactants, -6);
  placeRow(products, 6);
  placeRow(intermediates, 0);
  return anchors;
}

/** Un átomo: esfera con color CPK y opacidad dinámica */
function Atom({ element, position, scale, opacity }: {
  element: string;
  position: [number, number, number];
  scale: number;
  opacity: number;
}) {
  const el = ELEMENTS[element];
  const color = el?.color ?? '#888888';
  const radius = (el?.covalentRadius ?? 70) / 100; // pm → units
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius * scale * 0.4, 20, 20]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        roughness={0.3}
        metalness={0.1}
      />
    </mesh>
  );
}

/** Un enlace: cilindro entre dos posiciones */
function Bond({ a, b, order, opacity }: {
  a: [number, number, number];
  b: [number, number, number];
  order: number;
  opacity: number;
}) {
  const midpoint: [number, number, number] = [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
    (a[2] + b[2]) / 2,
  ];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const length = Math.hypot(dx, dy, dz);

  // Rotación: alinear cilindro (default Y) al vector (a→b)
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(yAxis, dir);
  const euler = new THREE.Euler().setFromQuaternion(quat);

  const radius = order === 1 ? 0.08 : order === 2 ? 0.12 : 0.16;

  return (
    <mesh position={midpoint} rotation={[euler.x, euler.y, euler.z]}>
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <meshStandardMaterial
        color="#888"
        transparent
        opacity={opacity * 0.7}
        roughness={0.5}
      />
    </mesh>
  );
}

/** Una molécula completa posicionada en escena */
function MoleculeInstance({ mol, anchor, opacity, scale }: {
  mol: Molecule;
  anchor: [number, number, number];
  opacity: number;
  scale: number;
}) {
  const centered = useMemo(() => {
    // Centrar molécula en anchor
    let cx = 0, cy = 0, cz = 0;
    for (const a of mol.atoms) {
      cx += a.position[0];
      cy += a.position[1];
      cz += a.position[2];
    }
    cx /= mol.atoms.length;
    cy /= mol.atoms.length;
    cz /= mol.atoms.length;
    return mol.atoms.map((a) => ({
      element: a.element,
      position: [
        a.position[0] - cx + anchor[0],
        a.position[1] - cy + anchor[1],
        a.position[2] - cz + anchor[2],
      ] as [number, number, number],
    }));
  }, [mol, anchor]);

  return (
    <group>
      {centered.map((atom, i) => (
        <Atom
          key={`a-${i}`}
          element={atom.element}
          position={atom.position}
          scale={scale}
          opacity={opacity}
        />
      ))}
      {mol.bonds.map((bond, i) => (
        <Bond
          key={`b-${i}`}
          a={centered[bond.a].position}
          b={centered[bond.b].position}
          order={bond.order}
          opacity={opacity}
        />
      ))}
    </group>
  );
}

function SceneContents({ species }: { species: SpeciesDisplay[] }) {
  const anchors = useMemo(() => moleculeAnchors(species), [species]);
  const groupRef = useRef<THREE.Group>(null);

  // Rotación lenta continua para darle vida a la escena
  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.05;
  });

  return (
    <group ref={groupRef}>
      {species.map((sp, i) => {
        const opacity = Math.max(
          0.05,
          Math.min(1, sp.concentration / (sp.concentrationMax || 1)),
        );
        const scale = 1.2;
        return (
          <MoleculeInstance
            key={sp.formula}
            mol={sp.molecule}
            anchor={anchors[i] ?? [0, 0, 0]}
            opacity={opacity}
            scale={scale}
          />
        );
      })}
    </group>
  );
}

export default function MoleculeView({ species, height = 400 }: MoleculeViewProps) {
  return (
    <div style={{ height, width: '100%' }} className="rounded-xl overflow-hidden bg-gradient-to-br from-[#F2F4F8] to-[#E4EAF2]">
      <Canvas camera={{ position: [0, 0, 16], fov: 45 }} dpr={[1, 2]}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={0.8} />
        <directionalLight position={[-10, -5, -5]} intensity={0.3} />
        <SceneContents species={species} />
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={8}
          maxDistance={30}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
}

export type { SpeciesDisplay };
