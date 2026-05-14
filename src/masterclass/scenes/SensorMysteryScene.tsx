/**
 * SensorMysteryScene — el hook del primer scene.
 *
 *   Una lámpara que alterna: ROJA MÁXIMA → UV TENUE.
 *   Un sensor a la derecha. Bajo luz roja brillante: 0 mA.
 *   Bajo luz UV débil: explosión de corriente.
 *
 *   Es un misterio puro. ¿Por qué? El resto de la clase lo explica.
 *
 *   Fase: '01-sensor'
 */

import { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface Props { phase?: string }

interface State {
  mode: 'red-bright' | 'uv-dim';
  t: number;
}

function Lamp({ stateRef }: { stateRef: React.MutableRefObject<State> }) {
  const bulbRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const s = stateRef.current;
    const color = s.mode === 'red-bright' ? '#EF4444' : '#A78BFA';
    const intensity = s.mode === 'red-bright' ? 4.0 : 0.7;
    const haloOpacity = s.mode === 'red-bright' ? 0.45 : 0.18;
    if (bulbRef.current) {
      const mat = bulbRef.current.material as THREE.MeshStandardMaterial;
      mat.color.set(color);
      mat.emissive.set(color);
      mat.emissiveIntensity = intensity;
    }
    if (haloMatRef.current) {
      haloMatRef.current.color.set(color);
      haloMatRef.current.opacity = haloOpacity;
    }
  });
  return (
    <group position={[-2.5, 0.5, 0]}>
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.9, 24, 24]} />
        <meshBasicMaterial ref={haloMatRef as any} color="#EF4444" transparent opacity={0.45} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={bulbRef}>
        <sphereGeometry args={[0.42, 28, 28]} />
        <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={4} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.3, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.7} />
      </mesh>
    </group>
  );
}

function LightBeam({ stateRef }: { stateRef: React.MutableRefObject<State> }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const s = stateRef.current;
    const color = s.mode === 'red-bright' ? '#EF4444' : '#A78BFA';
    const opacity = s.mode === 'red-bright' ? 0.32 : 0.18;
    if (matRef.current) {
      matRef.current.color.set(color);
      matRef.current.opacity = opacity;
    }
  });
  // cono que va de la lámpara al sensor
  return (
    <mesh ref={meshRef} position={[0, 0.5, 0]} rotation={[0, 0, -Math.PI / 2]}>
      <coneGeometry args={[0.4, 4.0, 24, 1, true]} />
      <meshBasicMaterial
        ref={matRef as any}
        color="#EF4444"
        transparent
        opacity={0.32}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function Sensor({ stateRef }: { stateRef: React.MutableRefObject<State> }) {
  const ledRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const s = stateRef.current;
    const lit = s.mode === 'uv-dim';
    if (ledRef.current) {
      const mat = ledRef.current.material as THREE.MeshStandardMaterial;
      mat.emissive.set(lit ? '#22D3EE' : '#1E293B');
      mat.emissiveIntensity = lit ? 3.0 : 0.1;
    }
  });
  return (
    <group position={[2.5, 0.4, 0]}>
      {/* base del sensor */}
      <mesh>
        <boxGeometry args={[1.4, 1.2, 0.4]} />
        <meshStandardMaterial color="#0F172A" metalness={0.5} roughness={0.6} emissive="#1E293B" emissiveIntensity={0.4} />
      </mesh>
      {/* ventana fotosensitiva */}
      <mesh position={[-0.71, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[0.35, 24]} />
        <meshStandardMaterial color="#1E293B" emissive="#0EA5E9" emissiveIntensity={0.2} />
      </mesh>
      {/* LED indicador (se enciende cuando hay corriente) */}
      <mesh ref={ledRef} position={[0.45, 0.35, 0.21]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color="#22D3EE" emissive="#22D3EE" emissiveIntensity={3.0} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Scene({ stateRef }: { stateRef: React.MutableRefObject<State> }) {
  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 5, 4]} intensity={0.6} />
      <pointLight position={[-2.5, 0.5, 1]} intensity={2.0} color="#EF4444" />
      <pointLight position={[2.5, 1, 1]} intensity={0.4} color="#22D3EE" />
      <Lamp stateRef={stateRef} />
      <LightBeam stateRef={stateRef} />
      <Sensor stateRef={stateRef} />
    </>
  );
}

export default function SensorMysteryScene({ phase: _phase = '01-sensor' }: Props) {
  const stateRef = useRef<State>({ mode: 'red-bright', t: 0 });
  const modeHudRef = useRef<HTMLSpanElement>(null);
  const currentHudRef = useRef<HTMLSpanElement>(null);
  const verdictRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      // alternar cada 3 segundos
      const mode: State['mode'] = Math.floor(t / 3) % 2 === 0 ? 'red-bright' : 'uv-dim';
      stateRef.current.mode = mode;
      stateRef.current.t = t;
      if (modeHudRef.current) {
        modeHudRef.current.textContent = mode === 'red-bright'
          ? 'ROJA · intensidad MÁXIMA'
          : 'UV · tenue';
      }
      if (currentHudRef.current) {
        currentHudRef.current.textContent = mode === 'red-bright'
          ? '0.00 mA · sensor inerte'
          : '12.4 mA · corriente';
      }
      if (verdictRef.current) {
        verdictRef.current.textContent = mode === 'red-bright'
          ? '∅ no reacciona'
          : '✓ electrones eyectados';
        verdictRef.current.style.color = mode === 'red-bright' ? '#EF4444' : '#22D3EE';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at center, #0A0E1A 0%, #03050A 80%)' }}
    >
      <Canvas camera={{ position: [0, 1.6, 6.5], fov: 42 }}>
        <Scene stateRef={stateRef} />
        <OrbitControls enableDamping enableZoom={false} enablePan={false} enableRotate={false} target={[0, 0.5, 0]} />
      </Canvas>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#FDB813] tracking-[0.3em] uppercase">
          Lámpara · ventana óptica · sensor de cesio
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">
          intensidad ROJA máxima vs UV tenue · ¿quién gana?
        </div>
      </div>

      <div className="absolute bottom-6 left-6 pointer-events-none">
        <div className="px-5 py-3 rounded-md border border-[#FDB813]/30 bg-black/55 backdrop-blur-sm space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#FDB813]">
            Estado actual
          </div>
          <div className="text-[13px] font-mono text-white">
            luz: <span ref={modeHudRef} className="text-[#EF4444] font-bold">ROJA · intensidad MÁXIMA</span>
          </div>
          <div className="text-[13px] font-mono text-white">
            sensor: <span ref={currentHudRef} className="text-[#94A3B8]">0.00 mA · sensor inerte</span>
          </div>
          <div className="text-[11px] font-mono pt-1 border-t border-[#1E293B]">
            <span ref={verdictRef} style={{ color: '#EF4444' }}>∅ no reacciona</span>
          </div>
        </div>
      </div>
    </div>
  );
}
