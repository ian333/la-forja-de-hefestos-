/**
 * ComptonKickScene — dos bolas en colisión, slow-mo.
 *
 *   Una esfera violeta brillante (fotón X) entra desde la izquierda.
 *   Una esfera cian (electrón) en reposo en el centro. Colisión. Ambas
 *   se desvían en ángulos opuestos, cada una arrastrando una cola de
 *   luz que dibuja la trayectoria.
 *
 *   El fotón sale más rojo (longitud de onda mayor). Cinemática silente.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface State {
  cycleT: number;
  thetaDeg: number;
}

function PhotonTrail({ stateRef }: { stateRef: React.MutableRefObject<State> }) {
  const photonRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (!photonRef.current || !trailRef.current || !matRef.current) return;
    const s = stateRef.current;
    const t = s.cycleT;
    const thetaRad = s.thetaDeg * Math.PI / 180;
    if (t < 0.5) {
      const u = t / 0.5;
      photonRef.current.position.set(-4 + u * 4, 0, 0);
      matRef.current.color.set('#A78BFA');
      matRef.current.emissive.set('#A78BFA');
      // trail desde inicio hasta posición actual (horizontal)
      const len = u * 4;
      trailRef.current.position.set(-4 + len / 2, 0, 0);
      trailRef.current.scale.set(len, 0.04, 0.04);
      trailRef.current.rotation.set(0, 0, 0);
    } else {
      const u = (t - 0.5) / 0.5;
      const x = u * 4 * Math.cos(thetaRad);
      const y = u * 4 * Math.sin(thetaRad);
      photonRef.current.position.set(x, y, 0);
      matRef.current.color.set('#FACC15');  // shifted (más roja en realidad pero amarillo lee mejor)
      matRef.current.emissive.set('#FACC15');
      // trail de origen a posición actual
      const len = u * 4;
      trailRef.current.position.set(x / 2, y / 2, 0);
      trailRef.current.scale.set(len, 0.04, 0.04);
      trailRef.current.rotation.set(0, 0, thetaRad);
    }
  });
  return (
    <group>
      <mesh ref={trailRef}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#A78BFA" transparent opacity={0.4} toneMapped={false} />
      </mesh>
      <mesh ref={photonRef}>
        <sphereGeometry args={[0.15, 20, 20]} />
        <meshStandardMaterial
          ref={matRef as any}
          color="#A78BFA"
          emissive="#A78BFA"
          emissiveIntensity={3.5}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function ElectronTrail({ stateRef }: { stateRef: React.MutableRefObject<State> }) {
  const electronRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!electronRef.current || !trailRef.current) return;
    const s = stateRef.current;
    const t = s.cycleT;
    const thetaRad = s.thetaDeg * Math.PI / 180;
    const phi = -Math.min(0.9, thetaRad / 1.6);
    if (t < 0.5) {
      electronRef.current.position.set(0, 0, 0);
      trailRef.current.scale.setScalar(0.001);
    } else {
      const u = (t - 0.5) / 0.5;
      const x = u * 3.5 * Math.cos(phi);
      const y = u * 3.5 * Math.sin(phi);
      electronRef.current.position.set(x, y, 0);
      const len = u * 3.5;
      trailRef.current.position.set(x / 2, y / 2, 0);
      trailRef.current.scale.set(len, 0.04, 0.04);
      trailRef.current.rotation.set(0, 0, phi);
    }
  });
  return (
    <group>
      <mesh ref={trailRef}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#22D3EE" transparent opacity={0.45} toneMapped={false} />
      </mesh>
      <mesh ref={electronRef}>
        <sphereGeometry args={[0.18, 20, 20]} />
        <meshStandardMaterial
          color="#22D3EE"
          emissive="#22D3EE"
          emissiveIntensity={3.2}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function CollisionFlash({ stateRef }: { stateRef: React.MutableRefObject<State> }) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (!ref.current || !matRef.current) return;
    const t = stateRef.current.cycleT;
    if (t > 0.45 && t < 0.7) {
      const u = (t - 0.45) / 0.25;
      const op = (1 - u) * 0.85;
      ref.current.scale.setScalar(0.3 + u * 1.2);
      matRef.current.opacity = op;
    } else {
      matRef.current.opacity = 0;
    }
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 20, 20]} />
      <meshBasicMaterial ref={matRef as any} color="#FFFFFF" transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Scene() {
  const stateRef = useRef<State>({ cycleT: 0, thetaDeg: 90 });
  const thetaList = [30, 60, 90, 120, 150];
  useFrame((_, dt) => {
    const s = stateRef.current;
    s.cycleT += dt * 0.45;          // slow-mo factor
    if (s.cycleT >= 1.4) {
      s.cycleT = 0;
      const idx = Math.floor(Math.random() * thetaList.length);
      s.thetaDeg = thetaList[idx];
    }
  });
  return (
    <>
      <ambientLight intensity={0.45} />
      <pointLight position={[-3, 2, 3]} intensity={0.8} color="#A78BFA" />
      <pointLight position={[ 3, 2, 3]} intensity={0.8} color="#22D3EE" />
      <CollisionFlash stateRef={stateRef} />
      <PhotonTrail stateRef={stateRef} />
      <ElectronTrail stateRef={stateRef} />
    </>
  );
}

export default function ComptonKickScene(_props: { phase?: string } = {}) {
  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [0, 1.0, 5.5], fov: 42, near: 0.001, far: 100 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        dpr={[0.55, 1]}
      >
        <Scene />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.22}
          minPolarAngle={1.3}
          maxPolarAngle={1.55}
        />
      </Canvas>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center text-[11px] font-mono text-[#94A3B8]">
        rayo X  ·  electrón en reposo
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-[12px] font-mono text-[#CBD5E1]">
        el fotón tiene momento
      </div>
    </div>
  );
}
