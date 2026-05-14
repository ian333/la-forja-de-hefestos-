/**
 * QualityCollapseScene — el unraveling de Akerlof en cine.
 *
 * Carros estilizados (cherry verde, lemon amarillo) en un lote. El precio
 * que ofrece el comprador (una banda rosa flotante) baja gradualmente.
 * Cualquier carro cuya reserva > precio "huye": sube, rota, se desvanece
 * y suelta un rastro de partículas. Al final del ciclo solo quedan limones.
 *
 * HUD: conteo cherries/lemons + precio actual.
 */

import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Car, CHERRY, LEMON } from './_carShape';

interface CarSlot {
  basePos: [number, number, number];
  isCherry: boolean;
  reserve: number;
  spinPhase: number;
}

function useSlots(): CarSlot[] {
  return useMemo(() => {
    const N = 80;
    const cols = 10;
    const rows = 8;
    const slots: CarSlot[] = [];
    for (let i = 0; i < N; i++) {
      const hash = (i * 2654435761) >>> 0;
      const isCherry = hash % 100 < 55;
      const reserve = isCherry
        ? 12 + ((hash >> 8) % 800) / 100   // 12..20
        : 4 + ((hash >> 16) % 400) / 100;  // 4..8
      const c = i % cols;
      const r = Math.floor(i / cols);
      slots.push({
        basePos: [
          (c - (cols - 1) / 2) * 1.15,
          0,
          (r - (rows - 1) / 2) * 1.0,
        ],
        isCherry,
        reserve,
        spinPhase: ((i * 7919) % 1000) / 1000,
      });
    }
    return slots;
  }, []);
}

function CarSlot({
  slot,
  state,
}: {
  slot: CarSlot;
  state: { price: number; t: number };
}) {
  const groupRef = useRef<THREE.Group>(null);
  const carRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const { price, t } = state;
    const sells = slot.reserve <= price;
    // "Flee" amount grows the more the gap (reserve − price) opens.
    const gap = Math.max(0, slot.reserve - price);
    const flee = sells ? 0 : Math.min(1, gap / 8 + 0.15);
    const yOff = sells ? 0 : flee * 6 + Math.sin(t + slot.spinPhase * 6) * 0.06;
    const rotY = sells
      ? 0
      : (t * 1.5 + slot.spinPhase * 10) * flee;
    const tilt = sells ? 0 : flee * 0.6 * Math.sin(t * 0.9 + slot.spinPhase * 5);
    const scl = sells ? 0.95 : Math.max(0.001, 0.95 * (1 - flee * 0.85));

    groupRef.current.position.set(
      slot.basePos[0],
      slot.basePos[1] + yOff,
      slot.basePos[2],
    );
    groupRef.current.rotation.set(tilt, rotY, tilt * 0.5);
    groupRef.current.scale.setScalar(scl);
  });

  return (
    <group ref={groupRef} position={slot.basePos}>
      <Car ref={carRef} scale={1} colors={slot.isCherry ? CHERRY : LEMON} />
    </group>
  );
}

function PriceBand({ price }: { price: number }) {
  // Position the band visually: low price = low y (sits among cars)
  // map price 4..20 → y 0.3..3.5
  const y = 0.3 + ((price - 4) / 16) * 3.2;
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    ringRef.current.rotation.z = clock.elapsedTime * 0.4;
  });
  return (
    <mesh ref={ringRef} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[7.6, 7.9, 64]} />
      <meshBasicMaterial color="#F472B6" transparent opacity={0.55} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Particles({ state, slots }: { state: { price: number; t: number }; slots: CarSlot[] }) {
  const PARTICLES = 300;
  const positions = useMemo(() => new Float32Array(PARTICLES * 3), []);
  const colors = useMemo(() => new Float32Array(PARTICLES * 3), []);
  const geomRef = useRef<THREE.BufferGeometry>(null);

  useFrame(() => {
    if (!geomRef.current) return;
    const { t, price } = state;
    // Pick a sliding window of "fleeing" cars and trail particles upward
    let pi = 0;
    for (let i = 0; i < slots.length && pi < PARTICLES; i++) {
      const slot = slots[i];
      if (slot.reserve <= price) continue;
      // Particle at slot pos + random offset, drifting upward
      const offset = ((i * 31 + Math.floor(t * 3)) % 4);
      for (let k = 0; k < 4 && pi < PARTICLES; k++) {
        const yJitter = ((t * 1.7 + i * 0.13 + k * 0.7) % 3);
        positions[pi * 3 + 0] = slot.basePos[0] + (Math.sin(i + k * 1.7) * 0.18);
        positions[pi * 3 + 1] = 0.3 + yJitter * 2;
        positions[pi * 3 + 2] = slot.basePos[2] + (Math.cos(i + k * 1.7) * 0.18);
        const c = slot.isCherry ? [0.06, 0.85, 0.6] : [0.99, 0.72, 0.07];
        colors[pi * 3 + 0] = c[0];
        colors[pi * 3 + 1] = c[1];
        colors[pi * 3 + 2] = c[2];
        pi++;
      }
    }
    // zero unused
    for (let i = pi; i < PARTICLES; i++) {
      positions[i * 3 + 0] = 0;
      positions[i * 3 + 1] = -50;
      positions[i * 3 + 2] = 0;
    }
    const posAttr = geomRef.current.attributes.position as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    const colAttr = geomRef.current.attributes.color as THREE.BufferAttribute;
    colAttr.needsUpdate = true;
  });

  return (
    <points>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLES}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          count={PARTICLES}
          array={colors}
          itemSize={3}
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.08} vertexColors transparent opacity={0.85} sizeAttenuation />
    </points>
  );
}

function Scene({
  setHud,
}: {
  setHud: (h: { price: number; cherries: number; lemons: number }) => void;
}) {
  const slots = useSlots();
  const stateRef = useRef({ price: 20, t: 0 });
  const hudTickRef = useRef(0);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const cycleT = (t % 20) / 20;
    const price = 20 - cycleT * 16;
    stateRef.current.price = price;
    stateRef.current.t = t;

    hudTickRef.current++;
    if (hudTickRef.current % 8 === 0) {
      let c = 0;
      let l = 0;
      for (const s of slots) {
        const sells = s.reserve <= price;
        if (sells) {
          if (s.isCherry) c++;
          else l++;
        }
      }
      setHud({ price, cherries: c, lemons: l });
    }
  });

  return (
    <>
      <ambientLight intensity={0.32} />
      <directionalLight position={[6, 10, 4]} intensity={0.7} />
      <directionalLight position={[-4, 6, -3]} intensity={0.35} color="#F472B6" />
      <pointLight position={[0, 6, 0]} intensity={1.0} color="#FDB813" distance={20} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <planeGeometry args={[40, 24]} />
        <meshStandardMaterial color="#0A0F18" roughness={1} metalness={0} />
      </mesh>
      {slots.map((s, i) => (
        <CarSlot key={i} slot={s} state={stateRef.current} />
      ))}
      <PriceBand price={stateRef.current.price} />
      <Particles state={stateRef.current} slots={slots} />
    </>
  );
}

export default function QualityCollapseScene() {
  const [hud, setHud] = useState({ price: 20, cherries: 44, lemons: 36 });
  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #14111A 0%, #03050A 80%)' }}
    >
      <Canvas camera={{ position: [0, 7, 12], fov: 38 }}>
        <Scene setHud={setHud} />
        <OrbitControls
          enableDamping
          autoRotate
          autoRotateSpeed={0.3}
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 3.4}
          maxPolarAngle={Math.PI / 2.2}
          target={[0, 0.8, 0]}
        />
      </Canvas>

      <div className="absolute top-6 left-6 text-[11px] font-mono space-y-2 pointer-events-none">
        <div className="flex items-center gap-2.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-[#1FAE6E] shadow-[0_0_10px_#10B981]" />
          <span className="text-[#94A3B8]">cherries: <span className="text-white">{hud.cherries}</span></span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-[#E0A800] shadow-[0_0_10px_#FDB813]" />
          <span className="text-[#94A3B8]">lemons: <span className="text-white">{hud.lemons}</span></span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="inline-block w-3 h-0.5 bg-[#F472B6] shadow-[0_0_8px_#F472B6]" />
          <span className="text-[#94A3B8]">precio: <span className="text-white">${hud.price.toFixed(1)}k</span></span>
        </div>
      </div>

      <div className="absolute top-6 right-6 text-[10px] font-mono text-[#475569] tracking-[0.2em] uppercase">
        Selección adversa · cherries huyen
      </div>
    </div>
  );
}
