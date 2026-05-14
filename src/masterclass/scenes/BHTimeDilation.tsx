/**
 * BHTimeDilation — dos relojes (Cooper en Miller's planet vs Brand en el Endurance)
 * marcando a velocidades distintas. El reloj de Miller marca lentísimo: 1 tick
 * por cada ~61,000 del exterior. Es exactamente lo que Kip Thorne fijó para que
 * 1 h en el planeta = 7 años fuera.
 */

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function ClockHand({ rate, color, x, label }: { rate: number; color: string; x: number; label: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = -clock.elapsedTime * rate;
  });
  return (
    <group position={[x, 0, 0]}>
      {/* Marco */}
      <mesh>
        <torusGeometry args={[1.2, 0.04, 12, 96]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} />
      </mesh>
      {/* Marcas 12 horas */}
      {Array.from({ length: 12 }, (_, i) => {
        const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
        return (
          <mesh key={i} position={[Math.cos(ang) * 1.08, Math.sin(ang) * 1.08, 0]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1.4} />
          </mesh>
        );
      })}
      {/* Manecilla */}
      <group ref={ref}>
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[0.05, 0.9, 0.05]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.0} />
        </mesh>
      </group>
      {/* Centro */}
      <mesh>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1.6} />
      </mesh>
    </group>
  );
}

function TimeScene() {
  return (
    <group>
      <ClockHand rate={0.05} color="#F472B6" x={-1.8} label="Miller" />
      <ClockHand rate={3.0}  color="#4FC3F7" x={ 1.8} label="Endurance" />
    </group>
  );
}

export default function BHTimeDilation() {
  return (
    <div className="w-full h-full relative" style={{
      background: 'radial-gradient(ellipse at center, #0F1B2C 0%, #05060A 85%)',
    }}>
      <Canvas camera={{ position: [0, 0, 6], fov: 38 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 5]} intensity={0.5} />
        <pointLight position={[-1.8, 0, 1]} intensity={1.0} distance={3} color="#F472B6" />
        <pointLight position={[ 1.8, 0, 1]} intensity={1.0} distance={3} color="#4FC3F7" />
        <TimeScene />
        <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
      </Canvas>

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[34%] left-[26%] text-center">
          <div className="text-[13px] font-semibold text-[#F472B6]">Miller's Planet</div>
          <div className="text-[10px] text-[#94A3B8] font-mono">r ≈ 1.49 r_s</div>
          <div className="text-[10px] text-[#94A3B8] font-mono">1 tick / minuto</div>
        </div>
        <div className="absolute top-[34%] right-[26%] text-center">
          <div className="text-[13px] font-semibold text-[#4FC3F7]">Endurance (lejos)</div>
          <div className="text-[10px] text-[#94A3B8] font-mono">r ≫ r_s</div>
          <div className="text-[10px] text-[#94A3B8] font-mono">60,000 ticks / min</div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center text-[12px] font-mono text-[#CBD5E1]">
        <div className="text-[14px] text-white font-semibold">1 h en Miller = 7.05 años en Endurance</div>
        <div className="text-[10px] text-[#64748B] mt-1">factor de dilatación γ = (1 − r_s/r)⁻¹ᐟ² ≈ 61 317</div>
      </div>
    </div>
  );
}
