/**
 * ComplexPlane — un punto siendo multiplicado por i, rotando 90° cada vez.
 * Muestra el plano complejo con ejes Re/Im, y un punto que gira 4 veces
 * (porque i^4 = 1) para mostrar que i es el operador "gira".
 */

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

function Scene() {
  const dotRef = useRef<THREE.Mesh>(null);
  const arrowRef = useRef<THREE.Group>(null);
  const trailGeomRef = useRef<THREE.BufferGeometry>(null);
  const TRAIL_N = 80;
  const trailBuf = useMemo(() => new Float32Array(TRAIL_N * 3), []);

  // Position: starts at z=1, gets multiplied by i each "tick".
  // Total rotation = ω·t where ω = π/2 * cyclesPerSec.
  // We let it go around continuously (not discrete) so motion is fluid.

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const θ = t * 0.6;
    // Start radius 1.5 — but every "i multiplication" simulates jump by π/2.
    const x = 1.5 * Math.cos(θ);
    const y = 1.5 * Math.sin(θ);
    if (dotRef.current) dotRef.current.position.set(x, y, 0);
    if (arrowRef.current) {
      arrowRef.current.position.set(x, y, 0);
      arrowRef.current.rotation.z = θ + Math.PI / 2;
    }

    // Trail
    for (let i = TRAIL_N - 1; i > 0; i--) {
      trailBuf[i * 3 + 0] = trailBuf[(i - 1) * 3 + 0];
      trailBuf[i * 3 + 1] = trailBuf[(i - 1) * 3 + 1];
      trailBuf[i * 3 + 2] = trailBuf[(i - 1) * 3 + 2];
    }
    trailBuf[0] = x; trailBuf[1] = y; trailBuf[2] = 0;
    if (trailGeomRef.current) {
      (trailGeomRef.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  // Ticks at multiples of π/2 — show where i, i², i³, i⁴ land
  const ticks = useMemo(() => [
    { θ: 0,            label: '1',  color: '#FDB813' },
    { θ: Math.PI / 2,  label: 'i',  color: '#F472B6' },
    { θ: Math.PI,      label: '−1', color: '#FDB813' },
    { θ: 3 * Math.PI / 2, label: '−i', color: '#F472B6' },
  ], []);

  return (
    <>
      {/* Axes */}
      <Line points={[[-2.5, 0, 0], [2.5, 0, 0]]} color="#334155" lineWidth={1} />
      <Line points={[[0, -2.5, 0], [0, 2.5, 0]]} color="#334155" lineWidth={1} />

      {/* Unit circle */}
      <Line
        points={Array.from({ length: 96 }, (_, i) => {
          const θ = (i / 95) * 2 * Math.PI;
          return [1.5 * Math.cos(θ), 1.5 * Math.sin(θ), 0] as [number, number, number];
        })}
        color="#475569" lineWidth={1} transparent opacity={0.4}
      />

      {/* Tick markers */}
      {ticks.map((tk, i) => (
        <mesh key={i} position={[1.5 * Math.cos(tk.θ), 1.5 * Math.sin(tk.θ), 0]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color={tk.color} emissive={tk.color} emissiveIntensity={1.2} />
        </mesh>
      ))}

      {/* Trail */}
      <line>
        <bufferGeometry ref={trailGeomRef}>
          <bufferAttribute attach="attributes-position" count={TRAIL_N} array={trailBuf} itemSize={3} args={[trailBuf, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#F472B6" transparent opacity={0.5} />
      </line>

      {/* Orbiting point */}
      <mesh ref={dotRef}>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#F472B6" emissiveIntensity={2} />
      </mesh>

      {/* Velocity arrow attached to the dot, pointing tangentially (90° rotated radial = "i × radial") */}
      <group ref={arrowRef}>
        <mesh position={[0.25, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.06, 0.18, 16]} />
          <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={1.4} />
        </mesh>
      </group>
    </>
  );
}

export default function ComplexPlane() {
  return (
    <div className="w-full h-full" style={{
      background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)',
    }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 4, 5]} intensity={0.6} />
        <Scene />
      </Canvas>
      {/* Axis labels as HTML overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 right-12 text-[11px] font-mono text-[#94A3B8]">Re →</div>
        <div className="absolute top-12 left-1/2 -translate-x-1/2 text-[11px] font-mono text-[#94A3B8]">↑ Im</div>
      </div>
    </div>
  );
}
