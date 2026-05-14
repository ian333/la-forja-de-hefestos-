/**
 * Void — pantalla "vacía" para introducciones / cierres.
 * Solo un punto luminoso pulsando con halos, fondo oscuro radial.
 */

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Pulse() {
  const meshRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (meshRef.current) {
      meshRef.current.scale.setScalar(1 + 0.15 * Math.sin(t * 1.5));
    }
    if (haloRef.current) {
      const s = 1.6 + 0.6 * Math.sin(t * 0.8);
      haloRef.current.scale.setScalar(s);
      (haloRef.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.12 * Math.cos(t * 0.8);
    }
  });
  return (
    <>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.18, 32, 32]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFD86B" emissiveIntensity={2.5} />
      </mesh>
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.5, 24, 24]} />
        <meshBasicMaterial color="#FDB813" transparent opacity={0.25} side={THREE.BackSide} />
      </mesh>
    </>
  );
}

export default function Void() {
  return (
    <div className="w-full h-full" style={{
      background: 'radial-gradient(ellipse at center, #14111A 0%, #05060A 80%)',
    }}>
      <Canvas camera={{ position: [0, 0, 4], fov: 40 }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[0, 0, 0]} intensity={1.5} color="#FDB813" distance={5} />
        <Pulse />
      </Canvas>
    </div>
  );
}
