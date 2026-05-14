import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Phase-aware gimbal scene.
 *
 *   phase '10-euler-rotacion'  → Single rotation around a fixed (eigen) axis.
 *                                 Rings hidden. The golden axis is the
 *                                 invariant direction (eigenvector λ=1).
 *   phase '11-euler-angles'    → 3 gimbal rings dancing with all 3 Euler
 *                                 angles. Pitch stays in the safe zone.
 *   phase '12-gimbal-lock'     → Pitch is forced toward π/2. When near it,
 *                                 the two inner rings co-align, a red lock
 *                                 glow flashes, and a LOCK indicator pops in.
 *
 * The component does NOT remount across phases — it reads the phase via
 * a ref so animation logic switches mid-flight.
 */

interface GimbalSceneProps {
  phase?: string;
}

function RingMesh({ radius, color, tubeRadius = 0.018, opacity = 1 }: { radius: number; color: string; tubeRadius?: number; opacity?: number }) {
  return (
    <mesh>
      <torusGeometry args={[radius, tubeRadius, 12, 96]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} metalness={0.6} roughness={0.35} transparent opacity={opacity} />
    </mesh>
  );
}

function Spacecraft({ groupRef }: { groupRef: (g: THREE.Group | null) => void }) {
  return (
    <group ref={groupRef}>
      <mesh>
        <boxGeometry args={[0.4, 0.18, 0.6]} />
        <meshStandardMaterial color="#E2E8F0" emissive="#FDB813" emissiveIntensity={0.5} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.13, 0.05]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.0, 0.04, 0.18]} />
        <meshStandardMaterial color="#94A3B8" />
      </mesh>
    </group>
  );
}

function Assembly({ phaseRef, lockGlowRef, lockTextRef, eulerAxisRef, ringOpacityRef }: {
  phaseRef: React.MutableRefObject<string>;
  lockGlowRef: React.MutableRefObject<THREE.Mesh | null>;
  lockTextRef: React.MutableRefObject<HTMLDivElement | null>;
  eulerAxisRef: React.MutableRefObject<THREE.Group | null>;
  ringOpacityRef: React.MutableRefObject<{ outer: THREE.MeshStandardMaterial | null; middle: THREE.MeshStandardMaterial | null; inner: THREE.MeshStandardMaterial | null }>;
}) {
  const yawRef = useRef<THREE.Group>(null);
  const pitchRef = useRef<THREE.Group>(null);
  const rollRef = useRef<THREE.Group>(null);
  const objRef = useRef<THREE.Group | null>(null);
  const phaseStartTime = useRef(0);
  const lastPhase = useRef('');

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const phase = phaseRef.current;

    // Reset phase-start timer on phase changes
    if (phase !== lastPhase.current) {
      phaseStartTime.current = t;
      lastPhase.current = phase;
    }
    const tLocal = t - phaseStartTime.current;

    let yaw = 0;
    let pitch = 0;
    let roll = 0;
    let ringOpacity = 1;
    let lockProx = 0;

    if (phase === '10-euler-rotacion') {
      // Pure rotation around the fixed eigenvector. No 3-gimbal dance.
      // Rings fade out. Object spins around the highlighted axis.
      ringOpacity = 0.12;
      // Apply rotation around the axis vector directly (skip Euler chain)
      if (objRef.current) {
        const axis = new THREE.Vector3(0.35, 1, 0.28).normalize();
        const angle = tLocal * 0.55;
        objRef.current.quaternion.setFromAxisAngle(axis, angle);
      }
      // Keep gimbal frame at identity (no yaw/pitch/roll)
      if (yawRef.current) yawRef.current.rotation.y = 0;
      if (pitchRef.current) pitchRef.current.rotation.x = 0;
      if (rollRef.current) rollRef.current.rotation.z = 0;
      // Show the highlighted Euler axis
      if (eulerAxisRef.current) eulerAxisRef.current.visible = true;
    } else if (phase === '11-euler-angles') {
      // 3 rings dancing, pitch clamped to ±60° (safe zone)
      ringOpacity = 0.95;
      yaw = tLocal * 0.4;
      pitch = Math.sin(tLocal * 0.6) * (Math.PI / 3);
      roll = tLocal * 0.7;
      if (eulerAxisRef.current) eulerAxisRef.current.visible = false;
    } else {
      // Phase '12-gimbal-lock' or default — sweep through ±π/2
      ringOpacity = 0.95;
      yaw = tLocal * 0.35;
      // Sweep pitch through ±π/2 and HOLD near the lock for drama
      const cycle = (tLocal % 5) / 5; // 5s per cycle
      // Curve: spend more time near ±π/2
      const phase01 = cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2; // 0→1→0
      pitch = (Math.PI / 2) * Math.pow(phase01, 0.5);
      roll = tLocal * 0.7;
      lockProx = 1 - Math.min(1, Math.abs(pitch - Math.PI/2) * 4);
      if (eulerAxisRef.current) eulerAxisRef.current.visible = false;
    }

    if (yawRef.current) yawRef.current.rotation.y = yaw;
    if (pitchRef.current) pitchRef.current.rotation.x = pitch;
    if (rollRef.current) rollRef.current.rotation.z = roll;

    if (objRef.current && phase !== '10-euler-rotacion') {
      // For phases 11 & 12, the spacecraft just rotates locally a bit (for visual interest)
      objRef.current.rotation.y = tLocal * 0.6;
    }

    // Ring opacities
    [ringOpacityRef.current.outer, ringOpacityRef.current.middle, ringOpacityRef.current.inner].forEach(m => {
      if (m) m.opacity = ringOpacity;
    });

    // Lock glow
    if (lockGlowRef.current) {
      (lockGlowRef.current.material as THREE.MeshBasicMaterial).opacity = lockProx * 0.6;
      lockGlowRef.current.scale.setScalar(0.8 + lockProx * 0.55);
    }
    // HTML lock indicator
    if (lockTextRef.current) {
      lockTextRef.current.style.opacity = lockProx > 0.65 ? '1' : '0';
    }
  });

  return (
    <group>
      {/* Highlighted Euler axis (only visible in phase 10) */}
      <group ref={r => { eulerAxisRef.current = r; }} visible={false}>
        {(() => {
          const axis = new THREE.Vector3(0.35, 1, 0.28).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
          const length = 1.5;
          return (
            <group quaternion={q}>
              {/* Shaft (both directions) */}
              <mesh position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.025, 0.025, length * 2, 14]} />
                <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={2.4} />
              </mesh>
              {/* Top tip */}
              <mesh position={[0, 0, length]} rotation={[Math.PI/2, 0, 0]}>
                <coneGeometry args={[0.09, 0.22, 14]} />
                <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={2.6} />
              </mesh>
              {/* Bottom tip */}
              <mesh position={[0, 0, -length]} rotation={[-Math.PI/2, 0, 0]}>
                <coneGeometry args={[0.09, 0.22, 14]} />
                <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={2.6} />
              </mesh>
              {/* Glowing halo at center */}
              <mesh>
                <sphereGeometry args={[0.5, 18, 18]} />
                <meshBasicMaterial color="#FDB813" transparent opacity={0.08} side={THREE.BackSide} />
              </mesh>
            </group>
          );
        })()}
      </group>

      {/* Outer ring — Yaw */}
      <group ref={yawRef}>
        <mesh>
          <torusGeometry args={[1.30, 0.022, 12, 96]} />
          <meshStandardMaterial
            ref={r => { ringOpacityRef.current.outer = r; }}
            color="#60A5FA" emissive="#60A5FA" emissiveIntensity={1.6}
            metalness={0.6} roughness={0.35} transparent opacity={1}
          />
        </mesh>
        {/* Pitch */}
        <group ref={pitchRef} rotation={[0, 0, Math.PI/2]}>
          <mesh>
            <torusGeometry args={[1.05, 0.020, 12, 96]} />
            <meshStandardMaterial
              ref={r => { ringOpacityRef.current.middle = r; }}
              color="#4ADE80" emissive="#4ADE80" emissiveIntensity={1.6}
              metalness={0.6} roughness={0.35} transparent opacity={1}
            />
          </mesh>
          {/* Roll */}
          <group ref={rollRef} rotation={[Math.PI/2, 0, 0]}>
            <mesh>
              <torusGeometry args={[0.78, 0.018, 12, 96]} />
              <meshStandardMaterial
                ref={r => { ringOpacityRef.current.inner = r; }}
                color="#F472B6" emissive="#F472B6" emissiveIntensity={1.6}
                metalness={0.6} roughness={0.35} transparent opacity={1}
              />
            </mesh>
            <Spacecraft groupRef={r => { objRef.current = r; }} />
          </group>
        </group>
      </group>

      {/* Red lock-warning glow */}
      <mesh ref={r => { lockGlowRef.current = r; }}>
        <sphereGeometry args={[0.45, 24, 24]} />
        <meshBasicMaterial color="#EF4444" transparent opacity={0} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -2.2, 0]}>
      <planeGeometry args={[14, 14]} />
      <meshStandardMaterial color="#070A12" roughness={1} />
    </mesh>
  );
}

export default function GimbalScene({ phase = '12-gimbal-lock' }: GimbalSceneProps) {
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const lockGlowRef = useRef<THREE.Mesh | null>(null);
  const lockTextRef = useRef<HTMLDivElement | null>(null);
  const eulerAxisRef = useRef<THREE.Group | null>(null);
  const ringOpacityRef = useRef({ outer: null as THREE.MeshStandardMaterial | null, middle: null as THREE.MeshStandardMaterial | null, inner: null as THREE.MeshStandardMaterial | null });

  // Phase-specific subtitle for the small caption under the title
  const captionByPhase: Record<string, string> = {
    '10-euler-rotacion': 'todo giro tiene un eje fijo  ·  λ = 1',
    '11-euler-angles': 'yaw · pitch · roll en zona segura',
    '12-gimbal-lock': 'pitch → π/2  ·  dos rings co-alinean',
  };
  const caption = captionByPhase[phase] ?? '';

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #0A1428 0%, #03050A 85%)' }}
    >
      <Canvas camera={{ position: [3.0, 1.8, 3.0], fov: 40 }}>
        <ambientLight intensity={0.32} />
        <pointLight position={[3, 4, 3]} intensity={1.0} color="#60A5FA" distance={14} />
        <pointLight position={[-3, 2, 4]} intensity={0.7} color="#F472B6" distance={12} />
        <directionalLight position={[0, 5, 5]} intensity={0.45} />
        <Floor />
        <Assembly
          phaseRef={phaseRef}
          lockGlowRef={lockGlowRef}
          lockTextRef={lockTextRef}
          eulerAxisRef={eulerAxisRef}
          ringOpacityRef={ringOpacityRef}
        />
        <OrbitControls
          enableDamping
          autoRotate
          autoRotateSpeed={0.4}
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI/4}
          maxPolarAngle={Math.PI/2.2}
          target={[0, 0, 0]}
        />
      </Canvas>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#60A5FA] tracking-[0.3em] uppercase">
          Ángulos de Euler · gimbal
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1 transition-opacity">
          {caption}
        </div>
      </div>

      {/* LOCK indicator (only flashes during phase 12 at the lock moment) */}
      <div
        ref={lockTextRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[120px] pointer-events-none transition-opacity duration-200"
        style={{ opacity: 0 }}
      >
        <div className="px-5 py-2 rounded-md border-2 border-[#EF4444] bg-[#EF4444]/15 text-[#EF4444] text-[13px] font-bold tracking-[0.3em] uppercase">
          ⚠ Gimbal Lock
        </div>
      </div>

      <div className="absolute bottom-8 left-8 pointer-events-none">
        <div className="flex items-center gap-2 text-[10px] font-mono mb-1">
          <span className="inline-block w-3 h-3 rounded-full bg-[#60A5FA] shadow-[0_0_6px_#60A5FA]" />
          <span className="text-[#94A3B8]">yaw — eje Z (azul)</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono mb-1">
          <span className="inline-block w-3 h-3 rounded-full bg-[#4ADE80] shadow-[0_0_6px_#4ADE80]" />
          <span className="text-[#94A3B8]">pitch — eje X (verde)</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="inline-block w-3 h-3 rounded-full bg-[#F472B6] shadow-[0_0_6px_#F472B6]" />
          <span className="text-[#94A3B8]">roll — eje interno (rosa)</span>
        </div>
      </div>
    </div>
  );
}
