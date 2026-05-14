/**
 * ACMotorScene — motor de corriente alterna trifásico.
 *
 * Tres bobinas de estator a 120° entre sí. Cada una recibe corriente
 * I_k = cos(ωt − 2πk/3). Los tres campos B_k sumados dan un campo B
 * total que ROTA — un vector de magnitud constante (3/2)·I₀.
 *
 * Por arriba, un inset en plano complejo muestra los TRES vectores como
 * exponenciales complejas separadas 120°. Su suma (verde) es el "por qué"
 * matemático: tres números complejos desfasados un tercio de vuelta
 * suman un vector que gira a velocidad constante.
 *
 * El rotor (imán N-S) sigue al campo B y gira. Pala de ventilador arriba.
 */

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const PHASES = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
const PHASE_COLORS = ['#F472B6', '#FDB813', '#4FC3F7'];
const STATOR_R = 1.6;
const OMEGA = 1.4;

function MotorScene() {
  // Refs we mutate every frame
  const coilMatsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const coilArrowsRef = useRef<THREE.Group[]>([]);
  const bFieldGroupRef = useRef<THREE.Group>(null);
  const rotorGroupRef = useRef<THREE.Group>(null);
  const fanRef = useRef<THREE.Group>(null);
  const phaseInsetVectorsRef = useRef<THREE.Group[]>([]);
  const phaseInsetDotsRef = useRef<THREE.Mesh[]>([]);
  const sumVectorRef = useRef<THREE.Group>(null);
  const sumDotRef = useRef<THREE.Mesh>(null);

  // Vector geometries (line position buffers) for the phase inset
  // We pre-create LineGeometries; on each frame we update line endpoints.
  // For simplicity we use <Line points={...}> rebuilt — but it's costly.
  // So we use direct THREE objects via refs.

  // Persistent buffer attributes for phase vectors (3) + sum (1)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phaseLineGeomsRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sumLineGeomRef = useRef<any>(null);

  const tRef = useRef(0);

  useFrame((_, dt) => {
    tRef.current += dt;
    const t = tRef.current;
    const ωt = OMEGA * t;

    // Update coil glow intensity + arrow scale per phase
    for (let i = 0; i < 3; i++) {
      const φ = PHASES[i];
      const I = Math.cos(ωt - φ);  // current in this phase

      const mat = coilMatsRef.current[i];
      if (mat) mat.emissiveIntensity = 0.3 + 1.8 * Math.abs(I);

      const arr = coilArrowsRef.current[i];
      if (arr) {
        const mag = Math.abs(I);
        arr.scale.set(mag, mag, mag);
        // Position arrow inward/outward depending on sign
        arr.visible = mag > 0.05;
        // We want it pointing toward center if I > 0, away if I < 0
        // Coil sits at angle φ; inward is (-cos(φ), 0, -sin(φ))
        const dir = I > 0 ? -1 : 1;
        arr.position.set(
          dir * 0.55 * Math.cos(φ),
          0,
          dir * 0.55 * Math.sin(φ),
        );
        // Rotate cone to point along (toward center or away)
        arr.rotation.set(0, -φ + (I > 0 ? Math.PI : 0), 0);
      }
    }

    // B field rotates with ωt (around +Y axis)
    if (bFieldGroupRef.current) bFieldGroupRef.current.rotation.y = -ωt;
    // Rotor follows B with tiny slip
    if (rotorGroupRef.current) rotorGroupRef.current.rotation.y = -ωt + 0.04;
    // Fan spins faster
    if (fanRef.current) fanRef.current.rotation.y -= OMEGA * dt * 0.5;

    // Phase inset: three vectors of unit length at angle (ωt - φ_k)
    // We tilted the inset so its local plane = XY ; we placed it at y=3.6 facing camera
    for (let i = 0; i < 3; i++) {
      const θ = ωt - PHASES[i];
      const x = 0.85 * Math.cos(θ);
      const y = 0.85 * Math.sin(θ);
      const g = phaseLineGeomsRef.current[i];
      if (g) {
        const attr = g.attributes.position as THREE.BufferAttribute;
        attr.setXYZ(0, 0, 0, 0.002);
        attr.setXYZ(1, x, y, 0.002);
        attr.needsUpdate = true;
      }
      const dot = phaseInsetDotsRef.current[i];
      if (dot) dot.position.set(x, y, 0.003);
    }
    // Sum vector: points at angle ωt with magnitude 1.5 × unit
    const sx = 0.85 * 1.5 * Math.cos(ωt);
    const sy = 0.85 * 1.5 * Math.sin(ωt);
    if (sumLineGeomRef.current) {
      const attr = sumLineGeomRef.current.attributes.position as THREE.BufferAttribute;
      attr.setXYZ(0, 0, 0, 0.004);
      attr.setXYZ(1, sx, sy, 0.004);
      attr.needsUpdate = true;
    }
    if (sumDotRef.current) sumDotRef.current.position.set(sx, sy, 0.005);
  });

  // Initial buffer data for phase + sum lines
  const phaseLineBuffers = useRef<Float32Array[]>([
    new Float32Array(6), new Float32Array(6), new Float32Array(6),
  ]);
  const sumLineBuffer = useRef<Float32Array>(new Float32Array(6));

  return (
    <>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
        <circleGeometry args={[STATOR_R + 0.8, 64]} />
        <meshStandardMaterial color="#0B1220" metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <ringGeometry args={[STATOR_R - 0.04, STATOR_R + 0.04, 64]} />
        <meshStandardMaterial color="#334155" emissive="#334155" emissiveIntensity={0.4} />
      </mesh>

      {/* Three stator coils */}
      {PHASES.map((φ, i) => {
        const x = STATOR_R * Math.cos(φ);
        const z = STATOR_R * Math.sin(φ);
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, -φ, 0]}>
            <mesh rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.42, 0.13, 16, 48]} />
              <meshStandardMaterial
                ref={(m) => { if (m) coilMatsRef.current[i] = m; }}
                color={PHASE_COLORS[i]}
                emissive={PHASE_COLORS[i]}
                emissiveIntensity={0.5}
                metalness={0.4}
                roughness={0.5}
              />
            </mesh>
            {/* Current direction arrow */}
            <group ref={(g) => { if (g) coilArrowsRef.current[i] = g; }}>
              <mesh rotation={[0, 0, -Math.PI / 2]}>
                <coneGeometry args={[0.12, 0.28, 12]} />
                <meshStandardMaterial color={PHASE_COLORS[i]} emissive={PHASE_COLORS[i]} emissiveIntensity={1.8} />
              </mesh>
            </group>
          </group>
        );
      })}

      {/* B field rotating arrow (green) */}
      <group ref={bFieldGroupRef}>
        <Line points={[[0, 0.02, 0], [1.05, 0.02, 0]]} color="#34D399" lineWidth={3} />
        <mesh position={[1.18, 0.02, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.13, 0.26, 16]} />
          <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={1.5} />
        </mesh>
      </group>

      {/* Rotor (magnet bar) + axle + fan */}
      <group ref={rotorGroupRef}>
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[1.0, 0.2, 0.32]} />
          <meshStandardMaterial color="#1E293B" metalness={0.5} roughness={0.5} />
        </mesh>
        {/* N pole (red) */}
        <mesh position={[0.5, 0.05, 0]}>
          <boxGeometry args={[0.18, 0.22, 0.34]} />
          <meshStandardMaterial color="#EF5350" emissive="#EF5350" emissiveIntensity={1.2} />
        </mesh>
        {/* S pole (blue) */}
        <mesh position={[-0.5, 0.05, 0]}>
          <boxGeometry args={[0.18, 0.22, 0.34]} />
          <meshStandardMaterial color="#4FC3F7" emissive="#4FC3F7" emissiveIntensity={1.2} />
        </mesh>
        {/* Axle */}
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 1.2, 12]} />
          <meshStandardMaterial color="#94A3B8" metalness={0.7} roughness={0.4} />
        </mesh>
        {/* Fan */}
        <group ref={fanRef} position={[0, 1.4, 0]}>
          {[0, 1, 2, 3].map(i => (
            <mesh key={i} rotation={[0, (i * Math.PI) / 2, 0.12]} position={[0.4 * Math.cos((i * Math.PI) / 2), 0, 0.4 * Math.sin((i * Math.PI) / 2)]}>
              <boxGeometry args={[0.7, 0.04, 0.16]} />
              <meshStandardMaterial color="#CBD5E1" metalness={0.3} roughness={0.6} />
            </mesh>
          ))}
          <mesh>
            <cylinderGeometry args={[0.12, 0.12, 0.1, 16]} />
            <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      </group>

      {/* Phase inset above motor */}
      <group position={[0, 3.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {/* Backdrop */}
        <mesh>
          <circleGeometry args={[1.4, 48]} />
          <meshBasicMaterial color="#0B1220" transparent opacity={0.65} />
        </mesh>
        {/* Axes */}
        <Line points={[[-1.3, 0, 0.001], [1.3, 0, 0.001]]} color="#334155" lineWidth={1} />
        <Line points={[[0, -1.3, 0.001], [0, 1.3, 0.001]]} color="#334155" lineWidth={1} />
        {/* Unit circle */}
        <Line
          points={Array.from({ length: 64 }, (_, i) => {
            const θ = (i / 63) * 2 * Math.PI;
            return [0.85 * Math.cos(θ), 0.85 * Math.sin(θ), 0.001] as [number, number, number];
          })}
          color="#475569" lineWidth={0.8} transparent opacity={0.6}
        />
        {/* Three phase vectors */}
        {[0, 1, 2].map(i => (
          <group key={i}>
            <line>
              <bufferGeometry
                ref={(g) => { if (g) phaseLineGeomsRef.current[i] = g; }}
              >
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={phaseLineBuffers.current[i]}
                  itemSize={3}
                  args={[phaseLineBuffers.current[i], 3]}
                />
              </bufferGeometry>
              <lineBasicMaterial color={PHASE_COLORS[i]} linewidth={2} />
            </line>
            <mesh ref={(m) => { if (m) phaseInsetDotsRef.current[i] = m; }}>
              <sphereGeometry args={[0.075, 16, 16]} />
              <meshStandardMaterial color={PHASE_COLORS[i]} emissive={PHASE_COLORS[i]} emissiveIntensity={1.8} />
            </mesh>
          </group>
        ))}
        {/* Sum vector (B field representation in complex plane) */}
        <group ref={sumVectorRef}>
          <line>
            <bufferGeometry ref={sumLineGeomRef}>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={sumLineBuffer.current}
                itemSize={3}
                args={[sumLineBuffer.current, 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#34D399" linewidth={3} />
          </line>
          <mesh ref={sumDotRef}>
            <sphereGeometry args={[0.085, 16, 16]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#34D399" emissiveIntensity={2.2} />
          </mesh>
        </group>
      </group>

      {/* Center glow */}
      <pointLight position={[0, 0.8, 0]} intensity={1.3} color="#34D399" distance={5} />
    </>
  );
}

interface ACMotorSceneProps {
  phase?: string;
}

export default function ACMotorScene({ phase = '17-rotor' }: ACMotorSceneProps) {
  const captionByPhase: Record<string, string> = {
    '15-motor-tres-fases': '3 corrientes desfasadas 120°  ·  3 × e^(iωt)',
    '16-b-field': 'la suma vectorial: B gira a velocidad constante',
    '17-rotor': 'el rotor sigue B  ·  todo gira por i',
  };
  const caption = captionByPhase[phase] ?? '';

  return (
    <div className="w-full h-full relative" style={{
      background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)',
    }}>
      <Canvas camera={{ position: [3, 3.5, 5], fov: 45 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={0.7} />
        <directionalLight position={[-3, 5, -4]} intensity={0.3} color="#4FC3F7" />
        <OrbitControls enableDamping autoRotate autoRotateSpeed={0.18} target={[0, 1.2, 0]} />
        <MotorScene />
      </Canvas>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#34D399] tracking-[0.3em] uppercase">
          Motor AC trifásico
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">{caption}</div>
      </div>
    </div>
  );
}
