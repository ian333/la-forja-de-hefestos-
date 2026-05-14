/**
 * TransactionFlowScene — escena phase-aware para Coase.
 *
 * Usa el mismo canvas para tres beats narrativos distintos según `phase`:
 *
 *   05-costos-ocultos:
 *     Una transacción central (dos cubos pasando un paquete entre ellos)
 *     emite halos animados que se etiquetan: buscar, negociar, contratar,
 *     verificar, vigilar, hacer cumplir. Cada uno aparece en cascada y
 *     queda flotando.
 *
 *   12-teorema:
 *     Dos cubos (Fábrica + Pescador) en posiciones fijas. Una flecha de
 *     pago bilateral oscila entre ellos: a veces fábrica→pescador, a veces
 *     pescador→fábrica. La negociación encuentra el óptimo.
 *
 *   13-externalidad:
 *     La fábrica emite "humo" rojo que viaja río abajo hacia el pescador.
 *     El pescador se atenúa cuando recibe la contaminación. Aparece una
 *     flecha de "$ pago" entre ellos cuando llegan al acuerdo.
 *
 * Sin drei <Text>. HUD HTML para las etiquetas.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SceneProps {
  phase: string;
}

const COST_LABELS = [
  { label: 'buscar',         color: '#F472B6', angle: 0   },
  { label: 'negociar',       color: '#FDB813', angle: 60  },
  { label: 'contratar',      color: '#34D399', angle: 120 },
  { label: 'verificar',      color: '#60A5FA', angle: 180 },
  { label: 'vigilar',        color: '#A78BFA', angle: 240 },
  { label: 'hacer cumplir',  color: '#EF4444', angle: 300 },
];

// ─────────────────────────────────────────────────────────────────────────────
// 05-COSTOS-OCULTOS · transaction central + halos around it

function CostsScene() {
  const buyerRef = useRef<THREE.Mesh>(null);
  const sellerRef = useRef<THREE.Mesh>(null);
  const packetRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (buyerRef.current) {
      buyerRef.current.position.y = Math.sin(t * 0.8) * 0.05;
    }
    if (sellerRef.current) {
      sellerRef.current.position.y = Math.sin(t * 0.8 + Math.PI) * 0.05;
    }
    if (packetRef.current) {
      // Packet oscillates between buyer (left, x=-1.6) and seller (right, x=1.6)
      const phase = (Math.sin(t * 0.6) + 1) / 2;
      packetRef.current.position.x = -1.6 + phase * 3.2;
      packetRef.current.rotation.y = t * 1.4;
    }
  });

  return (
    <>
      <ambientLight intensity={0.32} />
      <directionalLight position={[3, 5, 4]} intensity={0.65} />
      <pointLight position={[0, 3, 2]} intensity={0.7} color="#FDB813" distance={9} />

      {/* Buyer (left) */}
      <mesh ref={buyerRef} position={[-1.6, 0, 0]}>
        <boxGeometry args={[0.65, 0.65, 0.65]} />
        <meshStandardMaterial color="#60A5FA" emissive="#1E40AF" emissiveIntensity={0.6} metalness={0.4} roughness={0.4} />
      </mesh>
      {/* Seller (right) */}
      <mesh ref={sellerRef} position={[1.6, 0, 0]}>
        <boxGeometry args={[0.65, 0.65, 0.65]} />
        <meshStandardMaterial color="#F472B6" emissive="#BE185D" emissiveIntensity={0.6} metalness={0.4} roughness={0.4} />
      </mesh>

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <circleGeometry args={[5, 64]} />
        <meshStandardMaterial color="#0A0F18" roughness={1} />
      </mesh>

      {/* Packet (the thing being exchanged) */}
      <group ref={packetRef} position={[0, 0.1, 0]}>
        <mesh>
          <octahedronGeometry args={[0.18, 0]} />
          <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={1.6} />
        </mesh>
      </group>

      {/* Cost halos — orbiting markers around the exchange */}
      {COST_LABELS.map((c, i) => (
        <CostHalo key={i} angle={(c.angle * Math.PI) / 180} color={c.color} idx={i} />
      ))}
    </>
  );
}

function CostHalo({ angle, color, idx }: { angle: number; color: string; idx: number }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const ballRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Halo grows in cascade: each appears at its time index
    const delay = idx * 0.6;
    const appear = Math.min(1, Math.max(0, (t - delay) / 0.5));
    if (ballRef.current) {
      ballRef.current.scale.setScalar(appear * (1 + 0.12 * Math.sin(t * 1.6 + idx)));
    }
    if (ringRef.current) {
      const s = appear * (1.6 + 0.4 * Math.sin(t * 0.9 + idx));
      ringRef.current.scale.setScalar(s);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity =
        appear * (0.25 + 0.12 * Math.cos(t * 0.9 + idx));
    }
  });
  // Orbit radius — bigger than the transaction itself (the transaction is at x ∈ [-1.6, 1.6])
  const R = 3.5;
  const x = Math.cos(angle) * R;
  const z = Math.sin(angle) * R * 0.6; // ellipse
  const y = 0.4 + 0.3 * Math.sin(angle * 2);
  return (
    <group position={[x, y, z]}>
      <mesh ref={ballRef}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.4} />
      </mesh>
      <mesh ref={ringRef}>
        <sphereGeometry args={[0.32, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 12-TEOREMA · two parties exchanging payments

function CoaseTheoremScene() {
  const arrowRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!arrowRef.current) return;
    const t = clock.elapsedTime;
    // Direction oscillates: positive = factory→fisher, negative = fisher→factory
    const dir = Math.sin(t * 0.55);
    arrowRef.current.scale.x = dir;
  });

  return (
    <>
      <ambientLight intensity={0.32} />
      <directionalLight position={[3, 5, 4]} intensity={0.65} />
      <pointLight position={[-2, 3, 2]} intensity={0.65} color="#EF4444" distance={9} />
      <pointLight position={[2, 3, 2]} intensity={0.65} color="#34D399" distance={9} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <circleGeometry args={[5, 64]} />
        <meshStandardMaterial color="#0A0F18" roughness={1} />
      </mesh>

      {/* Factory (left, red) */}
      <mesh position={[-2.2, 0, 0]}>
        <boxGeometry args={[0.9, 1.0, 0.7]} />
        <meshStandardMaterial color="#7F1D1D" emissive="#EF4444" emissiveIntensity={0.5} />
      </mesh>
      {/* Smoke stack */}
      <mesh position={[-2.2, 0.7, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.5, 12]} />
        <meshStandardMaterial color="#374151" />
      </mesh>

      {/* Fisher (right, green) */}
      <mesh position={[2.2, 0, 0]}>
        <coneGeometry args={[0.45, 0.9, 4]} />
        <meshStandardMaterial color="#065F46" emissive="#34D399" emissiveIntensity={0.5} />
      </mesh>

      {/* Bilateral arrow — payment between them */}
      <group ref={arrowRef} position={[0, 0.6, 0]}>
        <mesh>
          <boxGeometry args={[3.4, 0.05, 0.05]} />
          <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={1.4} />
        </mesh>
        <mesh position={[1.7, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.1, 0.22, 12]} />
          <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={1.4} />
        </mesh>
      </group>

      {/* Dollar sign halos pulse along the arrow */}
      <DollarPulse />
    </>
  );
}

function DollarPulse() {
  const refs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (let i = 0; i < 3; i++) {
      const r = refs[i].current;
      if (!r) continue;
      const phase = (t * 0.55 + i / 3) % 1;
      const dir = Math.sin(t * 0.55) > 0 ? 1 : -1;
      r.position.x = (phase * 2 - 1) * 1.7 * dir;
      r.position.y = 0.6 + Math.sin(phase * Math.PI) * 0.1;
      const opacity = Math.sin(phase * Math.PI);
      (r.material as THREE.MeshStandardMaterial).emissiveIntensity = opacity * 3;
    }
  });
  return (
    <>
      {refs.map((ref, i) => (
        <mesh key={i} ref={ref} position={[0, 0.6, 0]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={2.4} />
        </mesh>
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 13-EXTERNALIDAD · factory pollutes fisher, then they negotiate

function ExternalityScene() {
  const smokeRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!smokeRef.current) return;
    smokeRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const t = clock.elapsedTime;
      const phase = ((t * 0.4 + i * 0.18) % 1);
      mesh.position.x = -1.9 + phase * 4.0;
      mesh.position.y = 1.0 + phase * 0.6 + Math.sin(phase * Math.PI * 2 + i) * 0.1;
      mesh.scale.setScalar(0.18 + phase * 0.4);
      (mesh.material as THREE.MeshStandardMaterial).opacity = 1 - phase;
    });
  });

  return (
    <>
      <ambientLight intensity={0.32} />
      <directionalLight position={[3, 5, 4]} intensity={0.55} />
      <pointLight position={[-2, 3, 2]} intensity={0.7} color="#EF4444" distance={9} />
      <pointLight position={[2, 3, 2]} intensity={0.5} color="#34D399" distance={9} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[14, 5]} />
        <meshStandardMaterial color="#0A0F18" roughness={1} />
      </mesh>

      {/* River — a strip between them */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.49, 0]}>
        <planeGeometry args={[8, 0.8]} />
        <meshStandardMaterial color="#1E3A8A" emissive="#3B82F6" emissiveIntensity={0.4} />
      </mesh>

      {/* Factory */}
      <mesh position={[-2.2, 0, 0]}>
        <boxGeometry args={[0.9, 1.0, 0.7]} />
        <meshStandardMaterial color="#7F1D1D" emissive="#EF4444" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[-2.2, 0.75, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.6, 12]} />
        <meshStandardMaterial color="#374151" />
      </mesh>

      {/* Smoke particles drifting from factory */}
      <group ref={smokeRef}>
        {Array.from({ length: 10 }, (_, i) => (
          <mesh key={i} position={[0, 0, 0]}>
            <sphereGeometry args={[0.15, 10, 10]} />
            <meshStandardMaterial color="#7F1D1D" emissive="#EF4444" emissiveIntensity={1.6} transparent opacity={0.6} />
          </mesh>
        ))}
      </group>

      {/* Fisher (downstream) */}
      <mesh position={[2.2, 0, 0]}>
        <coneGeometry args={[0.45, 0.9, 4]} />
        <meshStandardMaterial color="#065F46" emissive="#34D399" emissiveIntensity={0.45} />
      </mesh>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level wrapper that picks the right sub-scene by phase

export default function TransactionFlowScene({ phase }: SceneProps) {
  // Determine which beat we're in (default: costs)
  const isTheorem    = phase === '12-teorema';
  const isExtern     = phase === '13-externalidad';
  const isCosts      = !isTheorem && !isExtern;

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #14111A 0%, #03050A 80%)' }}
    >
      <Canvas camera={{ position: [0, 1.8, 6.5], fov: 42 }}>
        {isCosts && <CostsScene />}
        {isTheorem && <CoaseTheoremScene />}
        {isExtern && <ExternalityScene />}
      </Canvas>

      {/* HUD labels */}
      {isCosts && (
        <>
          <div className="absolute top-6 left-6 text-[10px] font-mono uppercase tracking-[0.25em] text-[#94A3B8]">
            Costos de transacción
          </div>
          <div className="absolute inset-x-0 bottom-44 flex justify-center pointer-events-none">
            <div className="grid grid-cols-3 gap-x-8 gap-y-1 text-[11px] font-mono text-center">
              {COST_LABELS.map((c) => (
                <div key={c.label} className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
                  <span className="text-[#CBD5E1]">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {isTheorem && (
        <>
          <div className="absolute top-6 left-6 text-[10px] font-mono uppercase tracking-[0.25em] text-[#94A3B8]">
            Teorema de Coase · 1960
          </div>
          <div className="absolute top-1/2 left-12 -translate-y-1/2 text-[11px] font-mono">
            <div className="text-[#EF4444]">● fábrica</div>
            <div className="text-[#94A3B8] mt-1">contamina</div>
          </div>
          <div className="absolute top-1/2 right-12 -translate-y-1/2 text-[11px] font-mono text-right">
            <div className="text-[#34D399]">pescador ●</div>
            <div className="text-[#94A3B8] mt-1">río abajo</div>
          </div>
          <div className="absolute inset-x-0 bottom-40 text-center pointer-events-none">
            <span className="px-3 py-1 rounded-full bg-[#FDB813]/15 text-[#FDB813] text-[11px] font-mono">
              negociación bilateral → óptimo (si costos = 0)
            </span>
          </div>
        </>
      )}

      {isExtern && (
        <>
          <div className="absolute top-6 left-6 text-[10px] font-mono uppercase tracking-[0.25em] text-[#94A3B8]">
            Externalidad · humo aguas abajo
          </div>
          <div className="absolute top-1/2 left-12 -translate-y-1/2 text-[11px] font-mono">
            <div className="text-[#EF4444]">● fábrica</div>
            <div className="text-[#94A3B8] mt-1">↓ humo · río</div>
          </div>
          <div className="absolute top-1/2 right-12 -translate-y-1/2 text-[11px] font-mono text-right">
            <div className="text-[#34D399]">pescador ●</div>
            <div className="text-[#94A3B8] mt-1">recibe contaminación</div>
          </div>
        </>
      )}
    </div>
  );
}
