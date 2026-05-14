/**
 * BHTidal — spaghettification. Una "persona" (cápsula simple) cayendo hacia
 * un BH es estirada exponencialmente. Las partículas que la rodean siguen
 * geodésicas radiales — los pies aceleran más que la cabeza.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function FallingObserver() {
  const ref = useRef<THREE.Group>(null);
  // 12 segmentos de "cuerpo" cuya longitud crece con el tiempo (estiramiento)
  const seg = 16;
  const meshes = useMemo(() => Array.from({ length: seg }, (_, i) => ({ i })), []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.elapsedTime * 0.45) % 6;
    // Posición radial: empieza en r=4 y va hacia r=1 (horizonte)
    const r = Math.max(1.0, 4 - t * 0.55);
    ref.current.position.set(r, 0, 0);
    // Stretch: longitud crece como 1 / (r - 0.9)
    const stretch = Math.min(8, 0.4 / Math.max(0.1, r - 0.9));
    const dy = stretch / seg;
    for (let k = 0; k < seg; k++) {
      const child = ref.current.children[k] as THREE.Mesh | undefined;
      if (!child) continue;
      // Distribución logarítmica: la cabeza más lejos del BH se alarga más
      const offset = (k - seg / 2 + 0.5) * dy;
      child.position.set(offset, 0, 0);
      child.scale.set(1.0, 0.7 - 0.5 * (k / seg), 0.7 - 0.5 * (k / seg));
    }
  });

  return (
    <group ref={ref}>
      {meshes.map((m, k) => {
        const isHead = k === seg - 1;
        return (
          <mesh key={k}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial
              color={isHead ? '#FDB813' : '#F472B6'}
              emissive={isHead ? '#FDB813' : '#F472B6'}
              emissiveIntensity={1.6}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function TidalScene() {
  return (
    <group>
      {/* BH */}
      <mesh>
        <sphereGeometry args={[0.9, 48, 48]} />
        <meshBasicMaterial color="#000" />
      </mesh>
      {/* Halo */}
      <mesh>
        <sphereGeometry args={[1.0, 48, 48]} />
        <meshBasicMaterial color="#FDB813" transparent opacity={0.12} />
      </mesh>
      {/* "Observador" cayendo */}
      <FallingObserver />
      {/* Líneas radiales de campo gravitacional */}
      <RadialField />
    </group>
  );
}

function RadialField() {
  const points = useMemo(() => {
    const lines: Float32Array[] = [];
    const N = 24;
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * 2 * Math.PI;
      const arr = new Float32Array(2 * 3);
      arr[0] = 1.2 * Math.cos(ang); arr[1] = 0; arr[2] = 1.2 * Math.sin(ang);
      arr[3] = 4.0 * Math.cos(ang); arr[4] = 0; arr[5] = 4.0 * Math.sin(ang);
      lines.push(arr);
    }
    return lines;
  }, []);
  return (
    <group>
      {points.map((arr, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={2} array={arr} itemSize={3} args={[arr, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#7E57C2" transparent opacity={0.18} />
        </line>
      ))}
    </group>
  );
}

export default function BHTidal() {
  return (
    <div className="w-full h-full relative" style={{
      background: 'radial-gradient(ellipse at center, #1A0F08 0%, #05060A 85%)',
    }}>
      <Canvas camera={{ position: [0, 2.5, 5.5], fov: 36 }}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 6, 3]} intensity={0.7} />
        <pointLight position={[0, 0, 0]} intensity={2.0} distance={3} color="#FDB813" />
        <TidalScene />
        <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.2}
                       minPolarAngle={0.6} maxPolarAngle={1.4} />
      </Canvas>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center text-[11px] font-mono text-[#94A3B8]">
        <div>tidal Δa = 2 G M L / r³ — diverge cuando r → r_s para BHs estelares</div>
      </div>
      <div className="absolute bottom-6 left-6 text-[11px] font-mono text-[#94A3B8]">
        para Cygnus X-1 (21 M☉): Δa cabeza-pies de 2 m al cruzar = 10¹⁰ G's. Te liquida.
      </div>
      <div className="absolute bottom-6 right-6 text-[11px] font-mono text-[#94A3B8] text-right">
        para Gargantua (10⁸ M☉): Δa = ~10⁻³ G's. Cooper sobrevive y ve el bulk.
      </div>
    </div>
  );
}
