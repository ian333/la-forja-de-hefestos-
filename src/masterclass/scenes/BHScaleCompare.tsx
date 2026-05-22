/**
 * BHScaleCompare — comparación visual logarítmica de cinco agujeros negros.
 * Etiquetas en HTML overlay (drei <Text> dispara el crash de EffectComposer).
 */

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface BH { name: string; M_sol: number; color: string; rs_human: string; }

const BHs: BH[] = [
  { name: 'Cygnus X-1', M_sol: 21,     color: '#4FC3F7', rs_human: '62 km' },
  { name: 'Sgr A*',     M_sol: 4.15e6, color: '#A78BFA', rs_human: '12 Gm' },
  { name: 'Gargantua',  M_sol: 1.0e8,  color: '#F472B6', rs_human: '300 Tm' },
  { name: 'M87*',       M_sol: 6.5e9,  color: '#FDB813', rs_human: '38 Tm' },
  { name: 'TON 618',    M_sol: 6.6e10, color: '#FACC15', rs_human: '195 Pm' },
];

function visualRadius(M_sol: number) {
  return 0.16 * Math.cbrt(Math.log10(Math.max(2, M_sol)));
}

function Scene() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (groupRef.current) groupRef.current.rotation.y = clock.elapsedTime * 0.06;
  });
  return (
    <group ref={groupRef}>
      {BHs.map((bh, i) => {
        const x = -3.2 + i * 1.6;
        const r = visualRadius(bh.M_sol);
        return (
          <group key={bh.name} position={[x, 0, 0]}>
            <mesh>
              <sphereGeometry args={[r, 32, 32]} />
              <meshBasicMaterial color="#000000" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[r * 1.05, r * 1.25, 64]} />
              <meshBasicMaterial color={bh.color} transparent opacity={0.95} side={THREE.DoubleSide} />
            </mesh>
            <pointLight color={bh.color} intensity={0.5} distance={2.0} />
          </group>
        );
      })}
    </group>
  );
}

export default function BHScaleCompare() {
  return (
    <div className="w-full h-full relative" style={{
      background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)',
    }}>
      <Canvas camera={{ position: [0, 2, 14], fov: 38 }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[3, 4, 5]} intensity={0.35} />
        <Scene />
        <OrbitControls enablePan={false} enableZoom
                       minDistance={4} maxDistance={40}
                       minPolarAngle={0.6} maxPolarAngle={2.2} />
      </Canvas>

      {/* HTML overlays alineadas con cada BH */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full">
          <div className="flex justify-center gap-[68px]">
            {BHs.map(bh => (
              <div key={bh.name} className="text-center" style={{ width: '90px' }}>
                <div className="text-[11px] font-semibold text-white">{bh.name}</div>
                <div className="text-[10px] font-mono mt-0.5" style={{ color: bh.color }}>
                  {bh.M_sol.toExponential(1)} M☉
                </div>
                <div className="text-[9px] text-[#64748B] mt-0.5">r_s = {bh.rs_human}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center text-[11px] font-mono text-[#94A3B8]">
        <div>tamaños relativos logarítmicos · masas reales</div>
        <div className="text-[10px] text-[#475569] mt-1">a escala real, TON 618 sería 10⁹× más grande que Cygnus X-1</div>
      </div>
    </div>
  );
}
