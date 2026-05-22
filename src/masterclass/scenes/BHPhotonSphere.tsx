/**
 * BHPhotonSphere — fotones orbitando a r = 1.5 r_s. Los rayos rebotan
 * eternamente en esa esfera; cualquier fluctuación pequeña los manda al
 * horizonte (inestable) o al infinito.
 *
 * Mostramos múltiples geodésicas circulares de luz alrededor del BH para
 * evidenciar la órbita inestable.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function PhotonOrbit({ axisTilt, speed, color, radius }: {
  axisTilt: [number, number, number]; speed: number; color: string; radius: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.x = axisTilt[0];
    groupRef.current.rotation.y = axisTilt[1] + clock.elapsedTime * speed;
    groupRef.current.rotation.z = axisTilt[2];
  });
  const trailGeom = useMemo(() => {
    const N = 64;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      pos[i*3+0] = radius * Math.cos(t);
      pos[i*3+1] = 0;
      pos[i*3+2] = radius * Math.sin(t);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, [radius]);
  return (
    <group ref={groupRef}>
      <lineLoop>
        <primitive object={trailGeom} attach="geometry" />
        <lineBasicMaterial color={color} transparent opacity={0.45} />
      </lineLoop>
      {/* Fotón corriendo */}
      <mesh position={[radius, 0, 0]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3.0} />
      </mesh>
    </group>
  );
}

function PhotonScene() {
  return (
    <group>
      {/* BH */}
      <mesh>
        <sphereGeometry args={[1.0, 48, 48]} />
        <meshBasicMaterial color="#000" />
      </mesh>
      {/* Esfera de fotones sutil (transparente) */}
      <mesh>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial color="#FDB813" transparent opacity={0.06} wireframe />
      </mesh>

      {/* Varias órbitas de fotones con orientaciones distintas */}
      <PhotonOrbit axisTilt={[0, 0, 0]}                    speed={0.6}  color="#FDB813" radius={1.5} />
      <PhotonOrbit axisTilt={[Math.PI/3, 0, 0]}           speed={0.55} color="#F472B6" radius={1.5} />
      <PhotonOrbit axisTilt={[0, 0, Math.PI/3]}           speed={0.5}  color="#4FC3F7" radius={1.5} />
      <PhotonOrbit axisTilt={[Math.PI/4, Math.PI/6, 0]}   speed={0.45} color="#22D3EE" radius={1.5} />
      <PhotonOrbit axisTilt={[Math.PI/6, Math.PI/3, 0]}   speed={0.4}  color="#FACC15" radius={1.5} />

      {/* halo del BH */}
      <pointLight position={[0, 0, 0]} intensity={2.0} distance={4} color="#FDB813" />
    </group>
  );
}

export default function BHPhotonSphere() {
  return (
    <div className="w-full h-full relative" style={{
      background: 'radial-gradient(ellipse at center, #1F0F12 0%, #05060A 85%)',
    }}>
      <Canvas camera={{ position: [5, 4, 8], fov: 38 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 4, 5]} intensity={0.5} />
        <PhotonScene />
        <OrbitControls enablePan={false} enableZoom
                       autoRotate autoRotateSpeed={0.4}
                       minDistance={3} maxDistance={40}
                       minPolarAngle={0.3} maxPolarAngle={2.2} />
      </Canvas>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center text-[11px] font-mono text-[#94A3B8]">
        <div>esfera de fotones · r = 1.5 r_s · órbita circular de la luz</div>
        <div className="text-[10px] text-[#475569] mt-1">inestable: el fotón cae al horizonte o escapa</div>
      </div>
    </div>
  );
}
