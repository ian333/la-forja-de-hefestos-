/**
 * CascadeQuanticaScene — un sol con seis satélites.
 *
 *   Un núcleo dorado pulsando en el centro. Seis satélites de colores
 *   distintos aparecen secuencialmente alrededor, conectados por hilos
 *   de luz. Cada uno orbita lentamente sobre su eje propio.
 *
 *   Sin etiquetas. Sin años. La narración cuenta quién es quién.
 *   La imagen es la genealogía.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const SATELLITES = [
  { angleDeg: 30,  color: '#FACC15' },   // Compton
  { angleDeg: 90,  color: '#FB923C' },   // de Broglie
  { angleDeg: 150, color: '#A78BFA' },   // Bose-Einstein
  { angleDeg: 210, color: '#F472B6' },   // Heisenberg
  { angleDeg: 270, color: '#22D3EE' },   // Schrödinger
  { angleDeg: 330, color: '#34D399' },   // Dirac
];

const ORBIT_R = 2.6;

function satellitePos(angleDeg: number): [number, number, number] {
  const a = angleDeg * Math.PI / 180;
  return [Math.cos(a) * ORBIT_R, Math.sin(a) * ORBIT_R, 0];
}

function CorePulse() {
  const meshRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (meshRef.current) {
      const s = 1 + Math.sin(t * 1.4) * 0.08;
      meshRef.current.scale.setScalar(s);
    }
    if (haloRef.current && haloMat.current) {
      const s = 1 + Math.sin(t * 1.4) * 0.15;
      haloRef.current.scale.setScalar(s);
      haloMat.current.opacity = 0.35 + Math.sin(t * 1.4) * 0.08;
    }
  });
  return (
    <group>
      <mesh ref={haloRef}>
        <sphereGeometry args={[1.0, 32, 32]} />
        <meshBasicMaterial ref={haloMat as any} color="#FDB813" transparent opacity={0.35} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.55, 28, 28]} />
        <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={3.5} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Satellite({ angleDeg, color, visible, glow }: {
  angleDeg: number;
  color: string;
  visible: boolean;
  glow: number;
}) {
  const orbitRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!orbitRef.current) return;
    const t = clock.elapsedTime;
    // pulsa cuando recién apareció (glow alto), después estable
    const pulse = 1 + Math.sin(t * 1.7) * 0.04;
    orbitRef.current.scale.setScalar(pulse);
    if (haloRef.current && haloMat.current) {
      haloRef.current.scale.setScalar(1 + glow * 0.4);
      haloMat.current.opacity = (0.22 + glow * 0.45) * (visible ? 1 : 0);
    }
  });
  if (!visible) return null;
  const pos = satellitePos(angleDeg);
  return (
    <group position={pos}>
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshBasicMaterial ref={haloMat as any} color={color} transparent opacity={0.22} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={orbitRef}>
        <sphereGeometry args={[0.32, 24, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.8} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Connection({ angleDeg, color, visible }: { angleDeg: number; color: string; visible: boolean }) {
  const pos = satellitePos(angleDeg);
  const dir = new THREE.Vector3(pos[0], pos[1], 0).normalize();
  const inner = dir.clone().multiplyScalar(0.7).toArray() as [number, number, number];
  const outer = new THREE.Vector3(pos[0], pos[1], 0).sub(dir.multiplyScalar(0.35)).toArray() as [number, number, number];
  if (!visible) return null;
  return <Line points={[inner, outer]} color={color} lineWidth={1.4} transparent opacity={0.55} />;
}

function Scene() {
  const [revealedN, setRevealedN] = useState(0);
  const [glows, setGlows] = useState<number[]>(SATELLITES.map(() => 0));
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      const newGlows = SATELLITES.map((_, i) => {
        const appear = 1.5 + i * 2.2;
        const age = elapsed - appear;
        if (age < 0) return 0;
        return Math.max(0, 1 - age / 1.8);
      });
      const n = SATELLITES.filter((_, i) => elapsed >= 1.5 + i * 2.2).length;
      setRevealedN(n);
      setGlows(newGlows);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 0, 3]} intensity={0.7} color="#FDB813" />
      <CorePulse />
      {SATELLITES.map((s, i) => (
        <group key={i}>
          <Connection angleDeg={s.angleDeg} color={s.color} visible={i < revealedN} />
          <Satellite angleDeg={s.angleDeg} color={s.color} visible={i < revealedN} glow={glows[i] ?? 0} />
        </group>
      ))}
    </>
  );
}

export default function CascadeQuanticaScene(_props: { phase?: string } = {}) {
  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [0, 0, 6.5], fov: 42, near: 0.001, far: 100 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        dpr={[0.55, 1]}
      >
        <Scene />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.25}
        />
      </Canvas>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center text-[11px] font-mono text-[#94A3B8]">
        E  =  h · f
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-[12px] font-mono text-[#CBD5E1]">
        todo desciende de aquí
      </div>
    </div>
  );
}
