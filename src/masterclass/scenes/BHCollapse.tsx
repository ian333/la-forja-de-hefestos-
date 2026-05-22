/**
 * BHCollapse — colapso de una estrella masiva. Una estrella se enciende,
 * agota su combustible, y colapsa: la cubierta vuela hacia afuera (supernova)
 * y el núcleo cae a r_s formando una BH.
 *
 * Tres fases:
 *   1) estrella estable, brillando
 *   2) supernova: explosión esférica de partículas
 *   3) BH residual + halo de polvo
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function Collapse() {
  const N = 800;
  const baseDir = useMemo(() => {
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = Math.random();
      const v = Math.random();
      const th = 2 * Math.PI * u;
      const ph = Math.acos(2 * v - 1);
      arr[i*3+0] = Math.sin(ph) * Math.cos(th);
      arr[i*3+1] = Math.sin(ph) * Math.sin(th);
      arr[i*3+2] = Math.cos(ph);
    }
    return arr;
  }, []);
  const positions = useMemo(() => new Float32Array(N * 3), []);
  const colors = useMemo(() => new Float32Array(N * 3), []);
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const starRef = useRef<THREE.Mesh>(null);
  const bhRef   = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * 0.4) % 14;
    // Fases: t < 4 estrella, t < 6 supernova rampa, t < 12 partículas se expanden, > 12 BH
    let phase: 'star' | 'pre' | 'boom' | 'bh' = 'star';
    if (t < 4) phase = 'star';
    else if (t < 5) phase = 'pre';
    else if (t < 10) phase = 'boom';
    else phase = 'bh';

    // Visibilidad de la estrella
    if (starRef.current) {
      const visible = phase === 'star' || phase === 'pre';
      starRef.current.visible = visible;
      if (visible) {
        const s = phase === 'pre' ? 1 + (t - 4) * 0.4 : 1 + 0.05 * Math.sin(clock.elapsedTime * 6);
        starRef.current.scale.setScalar(s);
        const mat = starRef.current.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = phase === 'pre' ? 2 + (t - 4) * 5 : 2;
      }
    }
    if (bhRef.current) {
      bhRef.current.visible = phase === 'bh';
    }
    if (haloRef.current) {
      haloRef.current.visible = phase === 'bh';
      if (phase === 'bh') {
        haloRef.current.rotation.z = clock.elapsedTime * 0.3;
      }
    }

    // Partículas
    if (geomRef.current) {
      const explFrac = phase === 'boom' ? (t - 5) / 5 :
                       phase === 'bh'   ? 1.0 :
                       0.0;
      for (let i = 0; i < N; i++) {
        const dx = baseDir[i*3+0];
        const dy = baseDir[i*3+1];
        const dz = baseDir[i*3+2];
        const radius = phase === 'star' ? 0 :
                       phase === 'pre' ? 0.3 * (t - 4) :
                       0.4 + 3.5 * explFrac;
        positions[i*3+0] = dx * radius;
        positions[i*3+1] = dy * radius;
        positions[i*3+2] = dz * radius;
        const intensity = phase === 'boom' ? 1 - explFrac * 0.7 :
                          phase === 'bh'   ? 0.18 :
                          0.5;
        colors[i*3+0] = 1.0 * intensity;
        colors[i*3+1] = (0.6 - 0.4 * explFrac) * intensity;
        colors[i*3+2] = (0.2 + 0.1 * explFrac) * intensity;
      }
      (geomRef.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (geomRef.current.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Estrella */}
      <mesh ref={starRef}>
        <sphereGeometry args={[0.6, 48, 48]} />
        <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={2.5} />
      </mesh>
      {/* Partículas de la supernova */}
      <points>
        <bufferGeometry ref={geomRef}>
          <bufferAttribute attach="attributes-position" count={N} array={positions} itemSize={3} args={[positions, 3]} />
          <bufferAttribute attach="attributes-color"    count={N} array={colors}    itemSize={3} args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial vertexColors size={0.08} transparent opacity={0.85} sizeAttenuation />
      </points>
      {/* BH residual */}
      <mesh ref={bhRef}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshBasicMaterial color="#000" />
      </mesh>
      {/* Halo (disco esquemático) */}
      <mesh ref={haloRef} rotation={[Math.PI/2, 0, 0]}>
        <ringGeometry args={[0.35, 0.75, 64]} />
        <meshBasicMaterial color="#FDB813" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export default function BHCollapse() {
  return (
    <div className="w-full h-full relative" style={{
      background: 'radial-gradient(ellipse at center, #100018 0%, #05060A 85%)',
    }}>
      <Canvas camera={{ position: [0, 3, 12], fov: 40 }}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 4, 5]} intensity={0.4} />
        <Collapse />
        <OrbitControls enablePan={false} enableZoom
                       autoRotate autoRotateSpeed={0.15}
                       minDistance={4} maxDistance={40}
                       minPolarAngle={0.6} maxPolarAngle={2.2} />
      </Canvas>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-[11px] font-mono text-[#94A3B8]">
        estrella → supernova → núcleo colapsa a r_s — un agujero negro estelar
      </div>
    </div>
  );
}
