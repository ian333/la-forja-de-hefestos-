/**
 * BHHawking — radiación de Hawking. Pares partícula-antipartícula virtuales
 * cerca del horizonte: uno cae, otro escapa. La BH pierde masa.
 *
 * Mostramos un BH con un halo de partículas que escapan radialmente con
 * colores complementarios (par-anti-par).
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function HawkingScene() {
  const N = 220;
  const random = useMemo(() => {
    const arr: { dir: THREE.Vector3; phase: number; sign: number }[] = [];
    for (let i = 0; i < N; i++) {
      const u = Math.random();
      const v = Math.random();
      const th = 2 * Math.PI * u;
      const ph = Math.acos(2 * v - 1);
      arr.push({
        dir: new THREE.Vector3(
          Math.sin(ph) * Math.cos(th),
          Math.sin(ph) * Math.sin(th),
          Math.cos(ph),
        ),
        phase: Math.random() * 2 * Math.PI,
        sign: Math.random() < 0.5 ? 1 : -1,
      });
    }
    return arr;
  }, []);
  const positions = useMemo(() => new Float32Array(N * 3), []);
  const colors = useMemo(() => new Float32Array(N * 3), []);
  const geomRef = useRef<THREE.BufferGeometry>(null);

  useFrame(({ clock }) => {
    if (!geomRef.current) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < N; i++) {
      const r = random[i];
      const localT = (t * 0.4 + r.phase) % 6;
      const radius = 1.05 + localT * 0.45;          // emerge desde r_s y escapa
      const fade = Math.max(0, 1 - localT / 5.5);
      positions[i*3+0] = r.dir.x * radius;
      positions[i*3+1] = r.dir.y * radius;
      positions[i*3+2] = r.dir.z * radius;
      // Partícula (azul) vs antipartícula (rosa) por sign
      if (r.sign > 0) {
        colors[i*3+0] = 0.4 * fade;
        colors[i*3+1] = 0.7 * fade;
        colors[i*3+2] = 1.0 * fade;
      } else {
        colors[i*3+0] = 1.0 * fade;
        colors[i*3+1] = 0.4 * fade;
        colors[i*3+2] = 0.7 * fade;
      }
    }
    (geomRef.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geomRef.current.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <group>
      {/* BH */}
      <mesh>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial color="#000" />
      </mesh>
      {/* Horizonte halo */}
      <mesh>
        <sphereGeometry args={[1.02, 48, 48]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.04} />
      </mesh>
      {/* Partículas Hawking */}
      <points>
        <bufferGeometry ref={geomRef}>
          <bufferAttribute attach="attributes-position" count={N} array={positions} itemSize={3} args={[positions, 3]} />
          <bufferAttribute attach="attributes-color"    count={N} array={colors}    itemSize={3} args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial vertexColors size={0.06} sizeAttenuation transparent opacity={0.9} />
      </points>
    </group>
  );
}

export default function BHHawking() {
  return (
    <div className="w-full h-full relative" style={{
      background: 'radial-gradient(ellipse at center, #0F0E22 0%, #05060A 85%)',
    }}>
      <Canvas camera={{ position: [0, 0, 5.2], fov: 40 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 4, 5]} intensity={0.4} />
        <HawkingScene />
        <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.3} />
      </Canvas>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-[11px] font-mono text-[#94A3B8]">
        <div>T_H = ℏc³ / (8π G M k_B) — más caliente cuanto más pequeño</div>
        <div className="text-[10px] text-[#475569] mt-1">una BH de 10 M☉ tiene T_H ≈ 6 nK · más fría que el espacio</div>
      </div>
      <div className="absolute top-6 left-6 text-[11px] font-mono text-[#94A3B8] space-y-1">
        <div><span className="text-[#4FC3F7]">●</span> partícula que escapa</div>
        <div><span className="text-[#F472B6]">●</span> antipartícula que cae</div>
      </div>
    </div>
  );
}
