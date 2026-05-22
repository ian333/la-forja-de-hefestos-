/**
 * WaveVsRealityScene — una onda EM que se rompe en fotones.
 *
 *   Una onda transversal pura cruzando el vacío de izquierda a derecha.
 *   A media trayectoria, las crestas y valles se "cuantizan": la onda
 *   deja de ser continua y se condensa en perlitas discretas (fotones).
 *   Transformación silenciosa y continua.
 *
 *   Sin split-screen. Sin "≠". Solo la metamorfosis.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const N_BEADS = 80;

function WaveToPhotons() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < N_BEADS; i++) {
      const u = i / (N_BEADS - 1);                  // 0..1 a lo largo
      const x = -4 + u * 8;
      // factor de "cuantización": izquierda = onda continua, derecha = puntos
      const quantize = Math.min(1, Math.max(0, (u - 0.35) * 2.0));
      // onda transversal pura: y = sin(phase)
      const phase = u * 14 - t * 3.5;
      const yWave = Math.sin(phase) * 0.9 * (1 - quantize * 0.5);
      // separación creciente con cuantización
      const sep = quantize * 0.15;
      // posición ligera en z para volumen visual
      const z = quantize * Math.cos(phase) * 0.5;
      dummy.position.set(x, yWave, z);
      // tamaño crece a la derecha (de "tira continua" a "perla")
      const size = 0.05 + quantize * 0.10 + sep;
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, N_BEADS]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial
        ref={matRef as any}
        color="#FACC15"
        emissive="#FACC15"
        emissiveIntensity={3.0}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

export default function WaveVsRealityScene(_props: { phase?: string } = {}) {
  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [0, 0.8, 5.5], fov: 42, near: 0.001, far: 100 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        dpr={[0.55, 1]}
      >
        <ambientLight intensity={0.35} />
        <pointLight position={[-3, 1, 2]} intensity={0.8} color="#FACC15" />
        <pointLight position={[ 3, 1, 2]} intensity={0.8} color="#A78BFA" />
        <WaveToPhotons />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.22}
          minPolarAngle={1.32}
          maxPolarAngle={1.58}
        />
      </Canvas>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center text-[11px] font-mono text-[#94A3B8]">
        onda → fotones
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-[12px] font-mono text-[#CBD5E1]">
        la onda clásica no predice lo que viene
      </div>
    </div>
  );
}
