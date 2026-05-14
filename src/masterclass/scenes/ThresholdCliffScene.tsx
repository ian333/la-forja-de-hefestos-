/**
 * ThresholdCliffScene — el acantilado cuántico.
 *
 *   Barra vertical de h·f (azul→violeta) creciendo conforme la frecuencia
 *   sube. Plano rojo horizontal marca W. Cuando hf < W: nada pasa, placa
 *   inerte, etiqueta "$\\varnothing$". Cuando hf cruza W: explosión de
 *   electrones, plate emisivo.
 *
 *   Es una discontinuidad VISUAL deliberada — la frecuencia es continua,
 *   pero la respuesta es 0 o explosión, no gradual.
 *
 *   Fase: '05-cliff'
 */

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface Props { phase?: string }

const PLANCK_H_eVs = 4.136e-15;
const FREQ_UNIT = 1e14;
const W_eV = 4.30;  // zinc

interface ElectronState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  active: boolean;
  age: number;
}

function makePool(n: number): ElectronState[] {
  return Array.from({ length: n }, () => ({
    pos: new THREE.Vector3(0, -50, 0),
    vel: new THREE.Vector3(0, 0, 0),
    active: false,
    age: 0,
  }));
}

function colorForEnergy(eV: number): THREE.Color {
  if (eV < 2) return new THREE.Color('#FF3D3D');
  if (eV < 3) return new THREE.Color('#FB923C');
  if (eV < 4) return new THREE.Color('#FACC15');
  if (eV < 5) return new THREE.Color('#22D3EE');
  if (eV < 6) return new THREE.Color('#A78BFA');
  return new THREE.Color('#F472B6');
}

function EnergyBar({
  hfRef,
  matRef,
}: {
  hfRef: React.MutableRefObject<number>;
  matRef: React.MutableRefObject<THREE.MeshStandardMaterial | null>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!meshRef.current) return;
    const h = Math.max(0.05, hfRef.current * 0.45);  // eV → unidades canvas
    meshRef.current.scale.set(1, h, 1);
    meshRef.current.position.set(0, -1 + h / 2, 0);
    if (matRef.current) {
      const c = colorForEnergy(hfRef.current);
      matRef.current.color = c;
      matRef.current.emissive = c;
    }
  });
  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[0.7, 1, 0.7]} />
      <meshStandardMaterial
        ref={matRef as any}
        color="#22D3EE"
        emissive="#22D3EE"
        emissiveIntensity={1.4}
        toneMapped={false}
      />
    </mesh>
  );
}

function ThresholdPlane() {
  const yPlane = -1 + W_eV * 0.45;
  return (
    <group>
      {/* plano semitransparente */}
      <mesh position={[0, yPlane, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 4]} />
        <meshBasicMaterial
          color="#EF4444"
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* línea borde */}
      <Line
        points={[[-3, yPlane, 1.5], [3, yPlane, 1.5], [3, yPlane, -1.5], [-3, yPlane, -1.5], [-3, yPlane, 1.5]] as any}
        color="#EF4444"
        lineWidth={2}
      />
    </group>
  );
}

function MetalPlate({ aliveRef }: { aliveRef: React.MutableRefObject<boolean> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!meshRef.current) return;
    const alive = aliveRef.current;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = alive ? 0.6 : 0.1;
    mat.emissive.set(alive ? '#22D3EE' : '#1E293B');
  });
  return (
    <mesh ref={meshRef} position={[0, -1.15, 0]}>
      <boxGeometry args={[4, 0.25, 1.5]} />
      <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.4} emissive="#1E293B" emissiveIntensity={0.1} />
    </mesh>
  );
}

function ElectronsBurst({
  poolRef,
  hfRef,
}: {
  poolRef: React.MutableRefObject<ElectronState[]>;
  hfRef: React.MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const spawnAccumRef = useRef(0);

  useFrame((_, dt) => {
    if (!meshRef.current) return;
    const pool = poolRef.current;
    const inst = meshRef.current;
    const hf = hfRef.current;
    const K = Math.max(0, hf - W_eV);
    // spawn solo si K > 0; tasa proporcional a K
    if (K > 0) {
      spawnAccumRef.current += dt * (8 + K * 4);
      while (spawnAccumRef.current > 1) {
        spawnAccumRef.current -= 1;
        const slot = pool.findIndex(e => !e.active);
        if (slot >= 0) {
          const e = pool[slot];
          e.pos.set((Math.random() - 0.5) * 3.5, -1, (Math.random() - 0.5) * 1.2);
          const speed = 1.0 + Math.sqrt(K) * 0.7;
          const ax = (Math.random() - 0.5) * 0.7;
          const az = (Math.random() - 0.5) * 0.4;
          e.vel.set(ax, speed, az);
          e.active = true;
          e.age = 0;
        }
      }
    }
    for (let i = 0; i < pool.length; i++) {
      const e = pool[i];
      if (!e.active) {
        dummy.position.set(0, -50, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        continue;
      }
      e.pos.addScaledVector(e.vel, dt);
      e.age += dt;
      if (e.pos.y > 6 || e.age > 3) {
        e.active = false;
        continue;
      }
      dummy.position.copy(e.pos);
      dummy.scale.setScalar(0.1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 60]}>
      <sphereGeometry args={[1, 14, 14]} />
      <meshStandardMaterial color="#22D3EE" emissive="#22D3EE" emissiveIntensity={2.6} toneMapped={false} />
    </instancedMesh>
  );
}

function Scene({
  hfRef, aliveRef, poolRef, matRef,
}: {
  hfRef: React.MutableRefObject<number>;
  aliveRef: React.MutableRefObject<boolean>;
  poolRef: React.MutableRefObject<ElectronState[]>;
  matRef: React.MutableRefObject<THREE.MeshStandardMaterial | null>;
}) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={0.9} />
      <pointLight position={[0, 3, 4]} intensity={0.6} color="#A78BFA" />
      <pointLight position={[0, -2, 3]} intensity={0.4} color="#EF4444" />
      <MetalPlate aliveRef={aliveRef} />
      <ThresholdPlane />
      <EnergyBar hfRef={hfRef} matRef={matRef} />
      <ElectronsBurst poolRef={poolRef} hfRef={hfRef} />
    </>
  );
}

export default function ThresholdCliffScene({ phase: _phase = '05-cliff' }: Props) {
  const hfRef = useRef(2.0);     // empieza debajo del umbral
  const aliveRef = useRef(false);
  const poolRef = useRef(makePool(60));
  const matRef = useRef<THREE.MeshStandardMaterial | null>(null);

  const hfHudRef = useRef<HTMLSpanElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const fHudRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      // ciclo: hf de 2 eV → 7 eV → 2 eV en 10s
      const cycle = (Math.sin(t * 0.7) + 1) / 2;       // 0..1
      const hf = 1.5 + cycle * 5.0;                     // 1.5 .. 6.5 eV
      hfRef.current = hf;
      aliveRef.current = hf > W_eV;
      const fHz = hf / PLANCK_H_eVs;
      if (hfHudRef.current) hfHudRef.current.textContent = `${hf.toFixed(2)} eV`;
      if (fHudRef.current) fHudRef.current.textContent = `${(fHz / FREQ_UNIT).toFixed(2)} × 10¹⁴ Hz`;
      if (statusRef.current) {
        if (hf < W_eV) {
          statusRef.current.textContent = '∅ no eyección · debajo del umbral';
          statusRef.current.style.color = '#EF4444';
        } else {
          statusRef.current.textContent = `K = ${(hf - W_eV).toFixed(2)} eV · electrones eyectados`;
          statusRef.current.style.color = '#22D3EE';
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at center, #1A0E0E 0%, #03050A 80%)' }}
    >
      <Canvas camera={{ position: [4.0, 1.5, 6.0], fov: 42 }}>
        <Scene hfRef={hfRef} aliveRef={aliveRef} poolRef={poolRef} matRef={matRef} />
        <OrbitControls enableDamping enableZoom={false} enablePan={false} enableRotate={false} target={[0, 0.5, 0]} />
      </Canvas>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#EF4444] tracking-[0.3em] uppercase">
          Acantilado cuántico · umbral W = 4.30 eV (zinc)
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">
          la frecuencia es continua · la respuesta NO
        </div>
      </div>

      {/* HUD del estado */}
      <div className="absolute top-1/2 left-6 -translate-y-1/2 pointer-events-none">
        <div className="px-5 py-3 rounded-md border border-[#EF4444]/40 bg-black/60 backdrop-blur-sm space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#EF4444]">
            En vivo
          </div>
          <div className="text-[13px] font-mono text-white">
            f = <span ref={fHudRef} className="text-[#FACC15]">5.20 × 10¹⁴ Hz</span>
          </div>
          <div className="text-[13px] font-mono text-white">
            h·f = <span ref={hfHudRef} className="text-[#A78BFA] font-bold">2.15 eV</span>
          </div>
          <div className="text-[12px] font-mono pt-1 border-t border-[#1E293B]">
            <span ref={statusRef} style={{ color: '#EF4444' }}>∅ no eyección · debajo del umbral</span>
          </div>
        </div>
      </div>

      {/* Etiqueta del plano W */}
      <div className="absolute top-[44%] right-12 pointer-events-none">
        <div className="text-[10px] font-mono text-[#EF4444]">W = 4.30 eV  ←  acantilado</div>
      </div>
    </div>
  );
}
