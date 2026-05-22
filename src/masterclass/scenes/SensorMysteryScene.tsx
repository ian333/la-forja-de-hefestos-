/**
 * SensorMysteryScene — un sensor en el vacío bajo dos luces que alternan.
 *
 *   Una lámpara roja gigante a la izquierda, una violeta diminuta a la
 *   derecha. La luz roja crece, baña al sensor — nada pasa. La luz
 *   violeta tenue toca al sensor y un cardumen de electrones cian
 *   estalla hacia arriba. Alternancia silenciosa cada 5 segundos.
 *
 *   Wallpaper. Sin laboratorio.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  life: number;
}

const N_ELECTRONS = 50;

function ModePulse() {
  // pulsa la fase global: 0..1 ciclo de 6s
  const ref = useRef({ mode: 'red' as 'red' | 'uv', tInMode: 0 });
  useFrame((_, dt) => {
    ref.current.tInMode += dt;
    if (ref.current.tInMode > 4.0) {
      ref.current.tInMode = 0;
      ref.current.mode = ref.current.mode === 'red' ? 'uv' : 'red';
    }
  });
  return ref;
}

function Sensor({ modeRef }: { modeRef: React.MutableRefObject<{ mode: 'red' | 'uv'; tInMode: number }> }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (!matRef.current) return;
    const lit = modeRef.current.mode === 'uv';
    matRef.current.emissive.set(lit ? '#22D3EE' : '#1E293B');
    matRef.current.emissiveIntensity = lit ? 2.0 : 0.4;
  });
  return (
    <group>
      <mesh>
        <boxGeometry args={[1.2, 0.8, 0.6]} />
        <meshStandardMaterial
          ref={matRef as any}
          color="#0F172A"
          metalness={0.6}
          roughness={0.5}
          emissive="#1E293B"
          emissiveIntensity={0.4}
          toneMapped={false}
        />
      </mesh>
      {/* Ventana óptica */}
      <mesh position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 32]} />
        <meshStandardMaterial color="#0EA5E9" emissive="#0EA5E9" emissiveIntensity={1.0} toneMapped={false} />
      </mesh>
    </group>
  );
}

function LampHalo({ side, modeRef }: { side: 'red' | 'uv'; modeRef: React.MutableRefObject<{ mode: 'red' | 'uv'; tInMode: number }> }) {
  const haloRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const bulbMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const x = side === 'red' ? -3.5 : 3.5;
  const color = side === 'red' ? '#EF4444' : '#A78BFA';

  useFrame(() => {
    if (!haloRef.current || !matRef.current || !bulbMatRef.current) return;
    const active = modeRef.current.mode === side;
    // tamaño / intensidad dependen del modo
    const scale = active ? 1.0 : 0.3;
    const opacity = active ? 0.55 : 0.1;
    haloRef.current.scale.setScalar(scale * 1.0);
    matRef.current.opacity = opacity;
    bulbMatRef.current.emissiveIntensity = active ? 4.0 : 0.6;
  });

  return (
    <group position={[x, 0.6, 0]}>
      <mesh ref={haloRef}>
        <sphereGeometry args={[2.2, 28, 28]} />
        <meshBasicMaterial ref={matRef as any} color={color} transparent opacity={0.55} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshStandardMaterial ref={bulbMatRef as any} color={color} emissive={color} emissiveIntensity={4.0} toneMapped={false} />
      </mesh>
    </group>
  );
}

function ElectronBurst({ modeRef, poolRef }: {
  modeRef: React.MutableRefObject<{ mode: 'red' | 'uv'; tInMode: number }>;
  poolRef: React.MutableRefObject<Particle[]>;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const spawnAccum = useRef(0);
  useFrame((_, dt) => {
    if (!meshRef.current) return;
    const pool = poolRef.current;
    if (modeRef.current.mode === 'uv') {
      spawnAccum.current += dt * 30;
      while (spawnAccum.current > 1) {
        spawnAccum.current -= 1;
        const slot = pool.findIndex(p => p.age >= p.life);
        if (slot >= 0) {
          const p = pool[slot];
          p.pos.set((Math.random() - 0.5) * 0.4, 0.55, (Math.random() - 0.5) * 0.4);
          const swirl = (Math.random() - 0.5) * 0.4;
          p.vel.set(swirl, 2.0, swirl);
          p.age = 0;
          p.life = 1.8;
        }
      }
    }
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      p.age += dt;
      if (p.age >= p.life) {
        dummy.position.set(0, -50, 0);
        dummy.scale.setScalar(0.001);
      } else {
        p.pos.addScaledVector(p.vel, dt);
        dummy.position.copy(p.pos);
        dummy.scale.setScalar(0.085 * Math.max(0.001, 1 - p.age / p.life));
      }
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, N_ELECTRONS]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial color="#22D3EE" emissive="#22D3EE" emissiveIntensity={3.5} toneMapped={false} />
    </instancedMesh>
  );
}

function Scene() {
  const modeRef = ModePulse();
  const electronPool = useRef<Particle[]>(
    Array.from({ length: N_ELECTRONS }, () => ({
      pos: new THREE.Vector3(0, -50, 0),
      vel: new THREE.Vector3(0, 0, 0),
      age: 999, life: 1,
    })),
  );
  return (
    <>
      <ambientLight intensity={0.28} />
      <pointLight position={[-3, 0, 1]} intensity={2.0} color="#EF4444" />
      <pointLight position={[ 3, 0, 1]} intensity={1.2} color="#A78BFA" />
      <Sensor modeRef={modeRef} />
      <LampHalo side="red" modeRef={modeRef} />
      <LampHalo side="uv" modeRef={modeRef} />
      <ElectronBurst modeRef={modeRef} poolRef={electronPool} />
    </>
  );
}

export default function SensorMysteryScene(_props: { phase?: string } = {}) {
  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [0, 1.2, 6.0], fov: 42, near: 0.001, far: 100 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        dpr={[0.55, 1]}
      >
        <Scene />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.28}
          minPolarAngle={1.25}
          maxPolarAngle={1.55}
        />
      </Canvas>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center text-[11px] font-mono text-[#94A3B8]">
        sensor de cesio · dos colores
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-[12px] font-mono text-[#CBD5E1]">
        intensidad no manda · color sí
      </div>
    </div>
  );
}
