/**
 * LenardApparatusScene — un cristal de zinc en el vacío.
 *
 *  Una lluvia continua de fotones (violetas) cayendo sobre una red
 *  cúbica de átomos de zinc. De su superficie superior brota un cardumen
 *  silencioso de electrones (cian) ascendiendo lento.
 *
 *  Sin laboratorio. Sin amperímetro. La narración explica.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const LATTICE = 5;             // 5x5x5 atoms
const SPACING = 0.42;
const N_PHOTONS = 60;
const N_ELECTRONS = 70;

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  life: number;
}

function ZincLattice() {
  const positions = useMemo(() => {
    const pts: [number, number, number][] = [];
    const off = (LATTICE - 1) * SPACING / 2;
    for (let i = 0; i < LATTICE; i++)
      for (let j = 0; j < LATTICE; j++)
        for (let k = 0; k < LATTICE; k++)
          pts.push([i * SPACING - off, j * SPACING - off, k * SPACING - off]);
    return pts;
  }, []);
  return (
    <group>
      {positions.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.11, 14, 14]} />
          <meshStandardMaterial
            color="#94A3B8"
            emissive="#FDB813"
            emissiveIntensity={0.4}
            metalness={0.9}
            roughness={0.3}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function PhotonRain({ poolRef }: { poolRef: React.MutableRefObject<Particle[]> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const spawnAccum = useRef(0);

  useFrame((_, dt) => {
    if (!meshRef.current) return;
    const pool = poolRef.current;
    // pulsa intensidad: 1x ↔ 2x cada 5s, suave
    const t = performance.now() / 1000;
    const intensity = 1.0 + (Math.sin(t * 0.6) * 0.5 + 0.5);
    spawnAccum.current += dt * 30 * intensity;
    while (spawnAccum.current > 1) {
      spawnAccum.current -= 1;
      const slot = pool.findIndex(p => p.age >= p.life);
      if (slot >= 0) {
        const p = pool[slot];
        p.pos.set((Math.random() - 0.5) * 3.0, 3.5, (Math.random() - 0.5) * 3.0);
        p.vel.set(0, -3.5, 0);
        p.age = 0;
        p.life = 1.6;
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
        dummy.scale.setScalar(0.08);
      }
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, N_PHOTONS]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial
        color="#A78BFA"
        emissive="#A78BFA"
        emissiveIntensity={3.5}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function ElectronCardumen({ poolRef }: { poolRef: React.MutableRefObject<Particle[]> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const spawnAccum = useRef(0);

  useFrame((_, dt) => {
    if (!meshRef.current) return;
    const pool = poolRef.current;
    const t = performance.now() / 1000;
    const intensity = 1.0 + (Math.sin(t * 0.6) * 0.5 + 0.5);
    spawnAccum.current += dt * 22 * intensity;
    while (spawnAccum.current > 1) {
      spawnAccum.current -= 1;
      const slot = pool.findIndex(p => p.age >= p.life);
      if (slot >= 0) {
        const p = pool[slot];
        const r = Math.random() * 0.9;
        const ang = Math.random() * Math.PI * 2;
        p.pos.set(Math.cos(ang) * r, 0.95, Math.sin(ang) * r);
        // VELOCIDAD CONSTANTE — la cuestión clave
        const swirl = (Math.random() - 0.5) * 0.3;
        p.vel.set(swirl, 1.7, swirl);
        p.age = 0;
        p.life = 2.4;
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
        dummy.scale.setScalar(0.09 * (0.7 + fade * 0.3));
      }
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, N_ELECTRONS]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial
        color="#22D3EE"
        emissive="#22D3EE"
        emissiveIntensity={3.2}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

export default function LenardApparatusScene(_props: { phase?: string } = {}) {
  const photonPool = useRef<Particle[]>(
    Array.from({ length: N_PHOTONS }, () => ({
      pos: new THREE.Vector3(0, -50, 0),
      vel: new THREE.Vector3(0, 0, 0),
      age: 999, life: 1,
    })),
  );
  const electronPool = useRef<Particle[]>(
    Array.from({ length: N_ELECTRONS }, () => ({
      pos: new THREE.Vector3(0, -50, 0),
      vel: new THREE.Vector3(0, 0, 0),
      age: 999, life: 1,
    })),
  );

  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [0, 1.2, 5.2], fov: 42, near: 0.001, far: 100 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        dpr={[0.55, 1]}
      >
        <ambientLight intensity={0.35} />
        <pointLight position={[0, 4, 0]} intensity={1.0} color="#A78BFA" />
        <pointLight position={[2, 0, 2]} intensity={0.4} color="#22D3EE" />
        <ZincLattice />
        <PhotonRain poolRef={photonPool} />
        <ElectronCardumen poolRef={electronPool} />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.32}
          minPolarAngle={1.15}
          maxPolarAngle={1.55}
        />
      </Canvas>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center text-[11px] font-mono text-[#94A3B8]">
        zinc · W = 4.30 eV
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-[12px] font-mono text-[#CBD5E1]">
        intensidad cambia cuántos · no qué tan rápido
      </div>
    </div>
  );
}
