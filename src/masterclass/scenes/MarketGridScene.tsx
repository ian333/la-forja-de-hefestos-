/**
 * MarketGridScene — un lote de cien carros usados.
 *
 * Cada carro es un objeto identificable (chassis + cabina + ruedas + faros).
 * Por defecto todos son grises uniformes — eso es lo que ve el comprador.
 * Por turnos, algunos carros se "iluminan" desde dentro revelando su
 * calidad real (verde cherry / amarillo lemon). Solo el vendedor sabe.
 *
 * No reutilizamos InstancedMesh: prefiero un grupo por carro para que cada
 * uno tenga su material independiente y la calidad pueda animarse limpia.
 * 96 carros = 96 grupos; sigue siendo rápido a 60fps.
 *
 * Sin drei <Text>: labels en HTML overlay.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Car, NEUTRAL, CHERRY, LEMON } from './_carShape';

interface CarSlot {
  pos: [number, number, number];
  isCherry: boolean;
  revealOffset: number;
}

function useCarSlots(): CarSlot[] {
  return useMemo(() => {
    const cols = 12;
    const rows = 8;
    const N = cols * rows;
    const slots: CarSlot[] = [];
    for (let i = 0; i < N; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const isCherry = ((i * 2654435761) >>> 0) % 100 < 55;
      slots.push({
        pos: [
          (c - (cols - 1) / 2) * 1.1,
          0,
          (r - (rows - 1) / 2) * 1.0,
        ],
        isCherry,
        revealOffset: ((i * 9301 + 49297) % 233280) / 233280,
      });
    }
    return slots;
  }, []);
}

function ParkingLot() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[40, 24]} />
        <meshStandardMaterial color="#0A0F18" roughness={1} metalness={0} />
      </mesh>
      {/* parking stripes: thin emissive rectangles along columns */}
      {Array.from({ length: 13 }, (_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[(i - 6) * 1.1 + 0.55, 0.001, 0]}
        >
          <planeGeometry args={[0.03, 9]} />
          <meshBasicMaterial color="#1E293B" />
        </mesh>
      ))}
    </>
  );
}

function CarInstance({ slot }: { slot: CarSlot }) {
  const groupRef = useRef<THREE.Group>(null);
  const carRef = useRef<THREE.Group>(null);
  const chassisMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

  // Only ~18% of cars will EVER reveal their quality. The rest stay gray
  // for the whole scene — that's the point: the buyer cannot tell.
  const willReveal = slot.revealOffset < 0.18;

  useFrame(({ clock }) => {
    if (!groupRef.current || !carRef.current) return;
    const t = clock.elapsedTime;

    // Gentle idle bob for all cars
    groupRef.current.position.y = Math.sin(t * 0.7 + slot.revealOffset * 6) * 0.012;

    // Lazy-grab the chassis material (first mesh = chassis box)
    if (!chassisMatRef.current) {
      carRef.current.traverse((obj) => {
        if (chassisMatRef.current) return;
        if ((obj as THREE.Mesh).isMesh) {
          chassisMatRef.current = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
        }
      });
    }
    const mat = chassisMatRef.current;
    if (!mat) return;

    if (!willReveal) {
      // Permanent gray (what the buyer sees)
      mat.color.set(NEUTRAL.body);
      mat.emissive.set(NEUTRAL.bodyEmissive);
      mat.emissiveIntensity = 0;
      return;
    }

    // The lucky few: pulsing reveal between 0.35 and 1.0 of full quality
    const phase = t * 0.55 + slot.revealOffset * 22;
    const reveal = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(phase));
    const base = slot.isCherry ? CHERRY : LEMON;
    mat.color.copy(new THREE.Color(NEUTRAL.body)).lerp(new THREE.Color(base.body), reveal);
    mat.emissive.set(base.bodyEmissive);
    mat.emissiveIntensity = base.bodyEmissiveIntensity * reveal;
  });

  return (
    <group ref={groupRef} position={slot.pos}>
      <Car ref={carRef} scale={0.95} />
    </group>
  );
}

function Scene() {
  const slots = useCarSlots();
  return (
    <>
      <ambientLight intensity={0.32} />
      <directionalLight position={[6, 10, 4]} intensity={0.7} color="#FFFFFF" />
      <directionalLight position={[-4, 6, -3]} intensity={0.35} color="#F472B6" />
      <pointLight position={[0, 5, 0]} intensity={0.8} color="#FDB813" distance={20} />
      <ParkingLot />
      {slots.map((s, i) => (
        <CarInstance key={i} slot={s} />
      ))}
    </>
  );
}

export default function MarketGridScene() {
  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #14111A 0%, #03050A 80%)' }}
    >
      <Canvas camera={{ position: [3.5, 5, 10], fov: 38 }} shadows>
        <Scene />
        <OrbitControls
          enableDamping
          autoRotate
          autoRotateSpeed={0.3}
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 2.8}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 0.2, 0]}
        />
      </Canvas>

      {/* HUD legend */}
      <div className="absolute top-6 left-6 text-[11px] font-mono space-y-2 pointer-events-none">
        <div className="flex items-center gap-2.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-[#1FAE6E] shadow-[0_0_10px_#10B981]" />
          <span className="text-[#94A3B8]">cherry · calidad alta · $20k</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-[#E0A800] shadow-[0_0_10px_#FDB813]" />
          <span className="text-[#94A3B8]">lemon · calidad baja · $5k</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-[#3B4252]" />
          <span className="text-[#64748B]">comprador solo ve esto</span>
        </div>
      </div>

      <div className="absolute top-6 right-6 text-[10px] font-mono text-[#475569] tracking-[0.2em] uppercase">
        Lote · 96 carros · información asimétrica
      </div>
    </div>
  );
}
