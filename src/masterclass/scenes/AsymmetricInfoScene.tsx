/**
 * AsymmetricInfoScene — un carro detallado entre dos visiones.
 *
 * Centro: un carro grande estilizado girando. A los lados, dos paneles
 * (vendedor / comprador) iluminados con su color. Líneas finas dashed
 * conectan al vendedor con los defectos internos del carro (pistón rojo,
 * fuga naranja, choque morado), simbolizando que solo él los conoce. El
 * comprador no ve líneas: solo ve la pintura.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface Defect {
  pos: [number, number, number];
  color: string;
  label: string;
  yLabel: number;
}

const DEFECTS: Defect[] = [
  { pos: [0.18, 0.20, 0.18],  color: '#EF4444', label: 'fuga de aceite',     yLabel: 1.4 },
  { pos: [-0.18, 0.30, -0.10], color: '#FB923C', label: 'choque previo',    yLabel: 0.9 },
  { pos: [0.05, 0.10, -0.20], color: '#A855F7', label: 'odómetro alterado', yLabel: 0.4 },
];

function CarBig() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.28;
  });
  const scl = 2.5;
  return (
    <group ref={ref} scale={scl}>
      {/* Chassis (silver, semi-transparent so internal defects shine through) */}
      <mesh position={[0, 0.09, 0]}>
        <boxGeometry args={[1.0, 0.20, 0.46]} />
        <meshStandardMaterial
          color="#94A3B8"
          metalness={0.85}
          roughness={0.20}
          transparent
          opacity={0.42}
        />
      </mesh>
      {/* Wireframe outline of the chassis to keep silhouette readable */}
      <mesh position={[0, 0.09, 0]}>
        <boxGeometry args={[1.0, 0.20, 0.46]} />
        <meshBasicMaterial color="#94A3B8" wireframe transparent opacity={0.85} />
      </mesh>
      {/* Cabin (tinted glass) */}
      <mesh position={[-0.06, 0.26, 0]}>
        <boxGeometry args={[0.55, 0.18, 0.40]} />
        <meshStandardMaterial color="#1E293B" metalness={0.9} roughness={0.1} transparent opacity={0.6} />
      </mesh>
      <mesh position={[-0.06, 0.26, 0]}>
        <boxGeometry args={[0.55, 0.18, 0.40]} />
        <meshBasicMaterial color="#475569" wireframe transparent opacity={0.7} />
      </mesh>
      {/* Headlights */}
      <mesh position={[0.47, 0.11, 0.16]}>
        <sphereGeometry args={[0.05, 14, 14]} />
        <meshStandardMaterial color="#FFFAE5" emissive="#FFFAE5" emissiveIntensity={2.4} />
      </mesh>
      <mesh position={[0.47, 0.11, -0.16]}>
        <sphereGeometry args={[0.05, 14, 14]} />
        <meshStandardMaterial color="#FFFAE5" emissive="#FFFAE5" emissiveIntensity={2.4} />
      </mesh>
      {/* Wheels */}
      {[
        [0.33, 0.04, 0.235],
        [0.33, 0.04, -0.235],
        [-0.33, 0.04, 0.235],
        [-0.33, 0.04, -0.235],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <sphereGeometry args={[0.09, 14, 14]} />
          <meshStandardMaterial color="#0B0F17" metalness={0.3} roughness={0.65} />
        </mesh>
      ))}
      {/* Internal defects — emissive markers, now clearly visible through the glass chassis */}
      {DEFECTS.map((d, i) => (
        <group key={i}>
          <mesh position={d.pos}>
            <sphereGeometry args={[0.07, 14, 14]} />
            <meshStandardMaterial color={d.color} emissive={d.color} emissiveIntensity={3.0} />
          </mesh>
          {/* Halo around each defect */}
          <mesh position={d.pos}>
            <sphereGeometry args={[0.13, 14, 14]} />
            <meshBasicMaterial color={d.color} transparent opacity={0.18} side={THREE.BackSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function DefectLines() {
  // Lines go from seller-side anchor (left, ~x=-3) to each defect, in world space.
  // But the car rotates, so we can't link to defect positions in world space cleanly.
  // Workaround: anchor lines to the car's BASE position (fixed). The narrative is
  // "seller knows there are flaws inside" — not exact world tracking.
  const anchorL: [number, number, number] = [-2.2, 1.5, 0];

  // Each line: from anchor to a point near the car body
  const targets: [number, number, number][] = [
    [-0.4, 0.7, 0],
    [-0.2, 0.5, 0],
    [-0.0, 0.3, 0],
  ];

  const cols = ['#EF4444', '#FB923C', '#A855F7'];
  return (
    <>
      {targets.map((target, i) => (
        <Line
          key={i}
          points={[anchorL, target]}
          color={cols[i]}
          lineWidth={1.6}
          transparent
          opacity={0.45}
          dashed
          dashSize={0.18}
          gapSize={0.12}
        />
      ))}
      {/* Seller-side glowing anchor */}
      <mesh position={anchorL}>
        <sphereGeometry args={[0.085, 16, 16]} />
        <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={2.2} />
      </mesh>
    </>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.28} />
      <pointLight position={[-3, 2.5, 2]} intensity={1.4} color="#34D399" distance={11} />
      <pointLight position={[3, 2.5, 2]} intensity={1.1} color="#60A5FA" distance={11} />
      <directionalLight position={[0, 5, 5]} intensity={0.45} />
      <CarBig />
      <DefectLines />
      {/* Pedestal */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.6, 1.7, 64]} />
        <meshBasicMaterial color="#475569" transparent opacity={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
        <planeGeometry args={[20, 12]} />
        <meshStandardMaterial color="#070A12" roughness={1} />
      </mesh>
    </>
  );
}

export default function AsymmetricInfoScene() {
  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at center, #0E1118 0%, #03050A 85%)' }}
    >
      <Canvas camera={{ position: [0, 1.4, 4.0], fov: 36 }}>
        <Scene />
        <OrbitControls
          enableDamping
          enableZoom={false}
          enablePan={false}
          enableRotate={false}
          target={[0, 0.7, 0]}
        />
      </Canvas>

      {/* Vendedor side (left) */}
      <div className="absolute top-1/2 left-8 -translate-y-1/2 max-w-[240px] pointer-events-none">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#34D399] mb-2">
          ● vendedor
        </div>
        <div className="text-[14px] text-[#E2E8F0] leading-snug font-medium mb-3">
          “Sé que el motor tira aceite, choqué hace seis meses y manejé como animal.”
        </div>
        <div className="space-y-1.5 text-[10px] font-mono">
          <div className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#EF4444] shadow-[0_0_6px_#EF4444]" />
            <span className="text-[#94A3B8]">fuga de aceite</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FB923C] shadow-[0_0_6px_#FB923C]" />
            <span className="text-[#94A3B8]">choque previo</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#A855F7] shadow-[0_0_6px_#A855F7]" />
            <span className="text-[#94A3B8]">odómetro alterado</span>
          </div>
          <div className="text-[#64748B] mt-2">km reales: 84,000</div>
        </div>
      </div>

      {/* Comprador side (right) */}
      <div className="absolute top-1/2 right-8 -translate-y-1/2 max-w-[240px] text-right pointer-events-none">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#60A5FA] mb-2">
          comprador ●
        </div>
        <div className="text-[14px] text-[#E2E8F0] leading-snug font-medium mb-3">
          “Se ve bonito por fuera. Brilla la pintura. El precio parece justo.”
        </div>
        <div className="space-y-1.5 text-[10px] font-mono text-[#94A3B8]">
          <div>solo ve · pintura</div>
          <div>solo ve · odómetro</div>
          <div>solo ve · precio</div>
        </div>
      </div>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-[10px] font-mono text-[#475569] tracking-[0.25em] uppercase">
        Información asimétrica
      </div>
    </div>
  );
}
