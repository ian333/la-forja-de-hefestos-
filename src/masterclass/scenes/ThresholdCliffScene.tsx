/**
 * ThresholdCliffScene — el acantilado cuántico, silencioso.
 *
 *   Una columna vertical de luz (h·f) crece y baja. Un plano horizontal
 *   tenue marca W. Cuando la columna cruza el plano, un torbellino de
 *   electrones cian estalla hacia arriba y se desvanece. Cuando baja,
 *   silencio.
 *
 *   Sin barras de eje. Sin HUD. La metáfora basta.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const N_PARTICLES = 100;
const W_HEIGHT = 1.4;    // posición vertical del plano umbral

interface Particle { pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number }

function makePool(n: number): Particle[] {
  return Array.from({ length: n }, () => ({
    pos: new THREE.Vector3(0, -50, 0),
    vel: new THREE.Vector3(0, 0, 0),
    age: 999, life: 1,
  }));
}

function EnergyColumn({ hfRef }: { hfRef: React.MutableRefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (!meshRef.current || !matRef.current) return;
    const hf = hfRef.current;
    meshRef.current.scale.set(1, hf * 0.6, 1);
    meshRef.current.position.set(0, -1 + hf * 0.3, 0);
    // color por frecuencia
    let c = '#FF3D3D';
    if (hf > 1.8) c = '#FB923C';
    if (hf > 2.5) c = '#FACC15';
    if (hf > 3.4) c = '#22D3EE';
    if (hf > 4.4) c = '#A78BFA';
    if (hf > 5.5) c = '#F472B6';
    matRef.current.color.set(c);
    matRef.current.emissive.set(c);
  });
  return (
    <mesh ref={meshRef}>
      <cylinderGeometry args={[0.32, 0.32, 1, 24]} />
      <meshStandardMaterial
        ref={matRef as any}
        color="#22D3EE"
        emissive="#22D3EE"
        emissiveIntensity={2.4}
        toneMapped={false}
      />
    </mesh>
  );
}

function ThresholdPlane() {
  return (
    <group position={[0, -1 + W_HEIGHT * 0.6, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.0, 2.6, 64]} />
        <meshBasicMaterial color="#EF4444" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.55, 2.62, 64]} />
        <meshBasicMaterial color="#EF4444" transparent opacity={0.65} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

function ElectronExplosion({ hfRef, poolRef }: {
  hfRef: React.MutableRefObject<number>;
  poolRef: React.MutableRefObject<Particle[]>;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const spawnAccum = useRef(0);
  useFrame((_, dt) => {
    if (!meshRef.current) return;
    const pool = poolRef.current;
    const hf = hfRef.current;
    const K = Math.max(0, hf - W_HEIGHT);
    if (K > 0) {
      spawnAccum.current += dt * (15 + K * 25);
      while (spawnAccum.current > 1) {
        spawnAccum.current -= 1;
        const slot = pool.findIndex(p => p.age >= p.life);
        if (slot >= 0) {
          const p = pool[slot];
          const r = 0.3 + Math.random() * 0.4;
          const ang = Math.random() * Math.PI * 2;
          p.pos.set(Math.cos(ang) * r, -1 + W_HEIGHT * 0.6 + 0.1, Math.sin(ang) * r);
          const speed = 1.4 + Math.sqrt(K) * 1.0;
          const upTilt = 0.5 + Math.random() * 0.3;
          p.vel.set(
            Math.cos(ang) * speed * (1 - upTilt),
            speed * upTilt,
            Math.sin(ang) * speed * (1 - upTilt),
          );
          p.age = 0;
          p.life = 2.5;
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
        const fade = Math.max(0.001, 1 - p.age / p.life);
        dummy.scale.setScalar(0.09 * (0.5 + fade * 0.5));
      }
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, N_PARTICLES]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial color="#22D3EE" emissive="#22D3EE" emissiveIntensity={3.2} toneMapped={false} />
    </instancedMesh>
  );
}

function Scene() {
  const hfRef = useRef(1.0);
  const poolRef = useRef(makePool(N_PARTICLES));
  useFrame(({ clock }) => {
    // 0.7 ↔ 3.5  (debajo / sobre W=1.4)
    hfRef.current = 2.1 + Math.sin(clock.elapsedTime * 0.55) * 1.4;
  });
  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 3, 0]} intensity={1.0} color="#FFFFFF" />
      <pointLight position={[3, 0, 0]} intensity={0.5} color="#EF4444" />
      <EnergyColumn hfRef={hfRef} />
      <ThresholdPlane />
      <ElectronExplosion hfRef={hfRef} poolRef={poolRef} />
    </>
  );
}

export default function ThresholdCliffScene(_props: { phase?: string } = {}) {
  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [3.5, 1.5, 4.5], fov: 42, near: 0.001, far: 100 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        dpr={[0.55, 1]}
      >
        <Scene />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.28}
          minPolarAngle={1.15}
          maxPolarAngle={1.6}
        />
      </Canvas>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center text-[11px] font-mono text-[#94A3B8]">
        h·f  vs  W
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-[12px] font-mono text-[#CBD5E1]">
        debajo del umbral · nada · arriba · todo
      </div>
    </div>
  );
}
