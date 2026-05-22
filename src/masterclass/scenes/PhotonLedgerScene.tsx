/**
 * PhotonLedgerScene — tres barras flotantes en el vacío.
 *
 *   Tres columnas verticales: morada (h·f), roja (W), cian (K = h·f − W).
 *   Suben, bajan, se rebalancean entre sí en silencio. Cuando la cian
 *   crece, un fotón cruza y un electrón emerge.
 *
 *   El balance es la imagen. La fórmula vive como texto pequeño abajo.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface State {
  hf: number;       // eV
  W: number;        // eV (varía entre metales)
  cycleT: number;
}

const SCALE = 0.45;  // eV → unidades canvas

function Bar({ valueRef, color, x }: {
  valueRef: React.MutableRefObject<number>;
  color: string;
  x: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!meshRef.current) return;
    const v = Math.max(0.04, valueRef.current * SCALE);
    meshRef.current.scale.set(1, v, 1);
    meshRef.current.position.set(x, -1 + v / 2, 0);
  });
  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[0.6, 1, 0.6]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2.0}
        transparent
        opacity={0.9}
        toneMapped={false}
      />
    </mesh>
  );
}

function ScenePhotonAndElectron({ stateRef }: { stateRef: React.MutableRefObject<State> }) {
  const photonRef = useRef<THREE.Mesh>(null);
  const electronRef = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    const s = stateRef.current;
    s.cycleT += dt;
    const cycle = s.cycleT % 2.5;
    // fotón: vuela de arriba-izq a centro (0..0.7s)
    if (photonRef.current) {
      if (cycle < 0.7) {
        const t = cycle / 0.7;
        photonRef.current.position.set(-2.5 + t * 2.5, 2.5 - t * 2.5, 0);
        photonRef.current.scale.setScalar(0.12);
      } else {
        photonRef.current.scale.setScalar(0.001);
      }
    }
    // electron sale del 0,0 (0.75..2.0s) sólo si K > 0
    const K = Math.max(0, s.hf - s.W);
    if (electronRef.current) {
      if (cycle > 0.75 && cycle < 2.0 && K > 0) {
        const t = (cycle - 0.75) / 1.25;
        const speed = Math.sqrt(K) * 1.5;
        electronRef.current.position.set(0, t * speed, 0);
        electronRef.current.scale.setScalar(0.13 * Math.max(0.001, 1 - t));
      } else {
        electronRef.current.scale.setScalar(0.001);
      }
    }
  });
  return (
    <group>
      <mesh ref={photonRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#A78BFA" emissive="#A78BFA" emissiveIntensity={3.5} toneMapped={false} />
      </mesh>
      <mesh ref={electronRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#22D3EE" emissive="#22D3EE" emissiveIntensity={3.2} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Scene() {
  const stateRef = useRef<State>({ hf: 5.0, W: 4.30, cycleT: 0 });
  const hfRef = useRef(5.0);
  const wRef = useRef(4.30);
  const kRef = useRef(0.7);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // hf oscila 1.5..6.5 eV (cruza varios W)
    const hf = 4.0 + Math.sin(t * 0.45) * 2.5;
    // W rota entre Cs(1.95), K(2.3), Zn(4.3), Pt(5.65) cada 6s
    const wList = [1.95, 2.30, 4.30, 5.65];
    const wIdx = Math.floor(t / 6) % wList.length;
    const W = wList[wIdx];
    stateRef.current.hf = hf;
    stateRef.current.W = W;
    hfRef.current = hf;
    wRef.current = W;
    kRef.current = Math.max(0, hf - W);
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[-2, 3, 3]} intensity={0.6} color="#A78BFA" />
      <pointLight position={[ 2, 3, 3]} intensity={0.6} color="#22D3EE" />
      <Bar valueRef={hfRef} color="#A78BFA" x={-1.2} />
      <Bar valueRef={wRef}  color="#EF4444" x={ 0.0} />
      <Bar valueRef={kRef}  color="#22D3EE" x={ 1.2} />
      <ScenePhotonAndElectron stateRef={stateRef} />
    </>
  );
}

export default function PhotonLedgerScene(_props: { phase?: string } = {}) {
  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [3.5, 1.8, 5.5], fov: 40, near: 0.001, far: 100 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        dpr={[0.55, 1]}
      >
        <Scene />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.3}
          minPolarAngle={1.15}
          maxPolarAngle={1.55}
        />
      </Canvas>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center text-[11px] font-mono text-[#94A3B8]">
        K  =  h·f  −  W
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-[12px] font-mono text-[#CBD5E1]">
        un fotón · un electrón · todo o nada
      </div>
    </div>
  );
}
