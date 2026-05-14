/**
 * NobelTimelineScene — los tres laureates 2001 conectados a la medalla.
 *
 * Una medalla dorada gira en el centro. Tres luces orbitales (verde Akerlof,
 * amarilla Spence, rosa Stiglitz) flotan en torno y se conectan a la
 * medalla con líneas brillantes. Pequeños "papers" (planos rectangulares
 * blanco-amarillo) flotan alrededor de cada uno.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Fixed positions so all three laureates stay visible to the camera at
 * [0, 2.2, 6.5]. We arrange them as a wide triangle in front of the medal
 * (which sits at [0, 0.6, 0]). Spence sits raised slightly so even if the
 * scene rotates a touch, he never falls behind the medal disc.
 */
const LAUREATES = [
  { name: 'Akerlof',  year: 1970, contribution: 'limones',      pos: [-3.2, 0.4, 1.4] as [number, number, number], color: '#34D399', halo: '#10B981' },
  { name: 'Spence',   year: 1973, contribution: 'señalización', pos: [ 0.0, 2.4, -0.6] as [number, number, number], color: '#FDB813', halo: '#E0A800' },
  { name: 'Stiglitz', year: 1976, contribution: 'screening',    pos: [ 3.2, 0.4, 1.4] as [number, number, number], color: '#F472B6', halo: '#EC4899' },
];

function Medal() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.55;
    ref.current.rotation.x = Math.sin(clock.elapsedTime * 0.3) * 0.18;
  });
  return (
    <group ref={ref} position={[0, 0.6, 0]}>
      {/* Disc */}
      <mesh>
        <cylinderGeometry args={[0.65, 0.65, 0.10, 48]} />
        <meshStandardMaterial color="#FFD86B" emissive="#FDB813" emissiveIntensity={0.9} metalness={1} roughness={0.18} />
      </mesh>
      {/* Inner relief ring */}
      <mesh position={[0, 0.051, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.55, 48]} />
        <meshStandardMaterial color="#E0A800" emissive="#E0A800" emissiveIntensity={0.7} side={THREE.DoubleSide} />
      </mesh>
      {/* Ribbon */}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[0.55, 0.5, 0.04]} />
        <meshStandardMaterial color="#3B82F6" roughness={0.5} />
      </mesh>
    </group>
  );
}

function Laureate({
  pos,
  color,
  halo,
  idx,
}: {
  pos: [number, number, number];
  color: string;
  halo: string;
  idx: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (groupRef.current) {
      const wobble = Math.sin(t * 0.6 + idx * 1.3) * 0.07;
      groupRef.current.position.y = wobble;
    }
    if (ringRef.current) {
      const s = 1.7 + 0.5 * Math.sin(t * 0.9 + idx);
      ringRef.current.scale.setScalar(s);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.22 + 0.13 * Math.cos(t * 0.9 + idx);
    }
  });

  // Vector from this laureate's pos to medal center [0, 0.6, 0]
  const toMedal: [number, number, number] = [-pos[0], 0.6 - pos[1], -pos[2]];

  return (
    <group position={pos}>
      <group ref={groupRef}>
        <mesh>
          <sphereGeometry args={[0.28, 24, 24]} />
          <meshStandardMaterial color={color} emissive={halo} emissiveIntensity={2.8} />
        </mesh>
        <mesh ref={ringRef}>
          <sphereGeometry args={[0.55, 24, 24]} />
          <meshBasicMaterial color={halo} transparent opacity={0.28} side={THREE.BackSide} />
        </mesh>
        {[0, 1, 2].map(i => (
          <mesh
            key={i}
            position={[0.45 * Math.cos(i * 2.1), -0.1 + i * 0.16, 0.45 * Math.sin(i * 2.1)]}
            rotation={[0.3, i * 0.7, 0.2]}
          >
            <planeGeometry args={[0.22, 0.28]} />
            <meshStandardMaterial color="#F5F0E8" emissive="#F5F0E8" emissiveIntensity={0.20} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <Line
        points={[
          [0, 0, 0],
          [toMedal[0] * 0.94, toMedal[1] * 0.94, toMedal[2] * 0.94],
        ]}
        color={halo}
        lineWidth={1.8}
        transparent
        opacity={0.55}
      />
    </group>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
      <circleGeometry args={[6, 64]} />
      <meshStandardMaterial color="#0B1220" roughness={1} />
    </mesh>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[2, 5, 4]} intensity={0.5} />
      <pointLight position={[0, 2.2, 3]} intensity={1.2} color="#FDB813" distance={12} />
      <Floor />
      <Medal />
      {LAUREATES.map((l, i) => (
        <Laureate key={l.name} idx={i} pos={l.pos} color={l.color} halo={l.halo} />
      ))}
    </>
  );
}

export default function NobelTimelineScene() {
  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at center, #1A1308 0%, #05060A 80%)' }}
    >
      <Canvas camera={{ position: [0, 2.2, 7.0], fov: 42 }}>
        <Scene />
        <OrbitControls
          enableDamping
          enableZoom={false}
          enablePan={false}
          enableRotate={false}
          target={[0, 0.9, 0]}
        />
      </Canvas>

      {/* Labels for each laureate, positioned by approximate screen mapping */}
      <div className="absolute inset-0 pointer-events-none">
        {LAUREATES.map((l, i) => {
          // Akerlof bottom-left, Spence top-center, Stiglitz bottom-right
          const positions = [
            { left: '12%', top: '62%' },
            { left: '50%', top: '12%', transform: 'translateX(-50%)' },
            { left: '88%', top: '62%', transform: 'translateX(-100%)' },
          ];
          const p = positions[i];
          return (
            <div
              key={l.name}
              className="absolute text-center"
              style={p}
            >
              <div className="text-white font-semibold text-[17px]">{l.name}</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.25em] mt-1" style={{ color: l.color }}>
                {l.contribution}
              </div>
              <div className="text-[10px] font-mono text-[#64748B] mt-1">paper · {l.year}</div>
            </div>
          );
        })}
      </div>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-[11px] font-mono text-[#FDB813] tracking-[0.3em] uppercase">
        Nobel Economía · 2001
      </div>
    </div>
  );
}
