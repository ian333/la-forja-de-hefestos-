/**
 * MakeVsBuyScene — escena phase-aware para Coase.
 *
 *   06-decision:
 *     Una "tarea" (un cubo dorado) flota en el centro. Dos opciones: ir hacia
 *     la izquierda (mercado, varios proveedores externos) o hacia la derecha
 *     (empresa, jerarquía con jefe arriba). Una flecha oscila mostrando que
 *     hay que elegir. Costos visibles en HUD.
 *
 *   07-tamano-optimo:
 *     Curvas 2D-en-3D: dos líneas (costo de coordinar internamente vs costo
 *     de transactar en el mercado) cruzando en un punto. Una "barra" del
 *     tamaño de la empresa se mueve y muestra el cruce óptimo.
 *
 * Phases que comparten esta escena: 06-decision, 07-tamano-optimo.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

interface SceneProps {
  phase: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 06-DECISION · task floats in center, two paths

function DecisionScene() {
  const taskRef = useRef<THREE.Group>(null);
  const arrowRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (taskRef.current) {
      taskRef.current.rotation.y = t * 0.7;
      taskRef.current.position.y = 0.4 + Math.sin(t * 1.1) * 0.05;
    }
    if (arrowRef.current) {
      // Oscillates left/right — decision
      const dir = Math.sin(t * 0.6);
      arrowRef.current.scale.x = dir;
      arrowRef.current.position.x = dir * 0.3;
    }
  });

  return (
    <>
      <ambientLight intensity={0.32} />
      <directionalLight position={[3, 5, 4]} intensity={0.65} />
      <pointLight position={[-3, 3, 2]} intensity={0.7} color="#60A5FA" distance={9} />
      <pointLight position={[3, 3, 2]} intensity={0.7} color="#F472B6" distance={9} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial color="#0A0F18" roughness={1} />
      </mesh>

      {/* MARKET side (left) — scattered cubes */}
      <group position={[-2.6, 0, 0]}>
        {Array.from({ length: 5 }, (_, i) => {
          const angle = (i / 5) * Math.PI * 2;
          const r = 0.65;
          return (
            <mesh key={i} position={[Math.cos(angle) * r, 0.15, Math.sin(angle) * r]}>
              <boxGeometry args={[0.32, 0.32, 0.32]} />
              <meshStandardMaterial color="#60A5FA" emissive="#1E40AF" emissiveIntensity={0.6} />
            </mesh>
          );
        })}
      </group>

      {/* FIRM side (right) — hierarchy (boss on top, workers below) */}
      <group position={[2.6, 0, 0]}>
        <mesh position={[0, 0.8, 0]}>
          <boxGeometry args={[0.38, 0.38, 0.38]} />
          <meshStandardMaterial color="#F472B6" emissive="#BE185D" emissiveIntensity={0.9} />
        </mesh>
        <mesh position={[-0.45, 0.15, 0]}>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshStandardMaterial color="#F472B6" emissive="#BE185D" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0.45, 0.15, 0]}>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshStandardMaterial color="#F472B6" emissive="#BE185D" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, 0.15, 0.45]}>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshStandardMaterial color="#F472B6" emissive="#BE185D" emissiveIntensity={0.5} />
        </mesh>
        {/* Connector lines (jerarquía) */}
        <Line points={[[0, 0.6, 0], [-0.45, 0.3, 0]]} color="#94A3B8" lineWidth={1.2} transparent opacity={0.6} />
        <Line points={[[0, 0.6, 0], [0.45, 0.3, 0]]} color="#94A3B8" lineWidth={1.2} transparent opacity={0.6} />
        <Line points={[[0, 0.6, 0], [0, 0.3, 0.45]]} color="#94A3B8" lineWidth={1.2} transparent opacity={0.6} />
      </group>

      {/* The decision (task in center) */}
      <group ref={taskRef} position={[0, 0.4, 0]}>
        <mesh>
          <octahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={1.8} />
        </mesh>
      </group>

      {/* Oscillating arrow (decision) */}
      <group ref={arrowRef} position={[0, 0.4, 0]}>
        <mesh>
          <boxGeometry args={[1.8, 0.04, 0.04]} />
          <meshStandardMaterial color="#E2E8F0" emissive="#FDB813" emissiveIntensity={0.7} />
        </mesh>
        <mesh position={[0.9, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.08, 0.18, 12]} />
          <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={1.4} />
        </mesh>
      </group>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 07-TAMANO-OPTIMO · curves crossing at optimal size

function OptimalSizeScene() {
  const markerRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!markerRef.current) return;
    const t = clock.elapsedTime;
    // The marker moves left-right showing different firm sizes
    const cycle = (t * 0.25) % 1;
    const x = -2.5 + cycle * 5; // sweep from -2.5 to 2.5
    markerRef.current.position.x = x;
  });

  // Costs:
  // C_market(x) = decreases as x grows (less needed) — actually no, market cost = how much you pay to buy externally
  //   for a firm of size x, you BUY everything that's NOT inside.
  //   Smaller firm → buys more → pays more market costs.
  //   We model: C_market = K1 * (X_total - x).  As x → X_total, C_market → 0.
  // C_internal(x) = grows as x grows (coordination cost rises).
  //   We model: C_internal = K2 * x^1.4 (super-linear).
  // Optimal x*: where derivative crosses, i.e., where the SUM is minimized,
  //   or equivalently where C_market'(x) = -C_internal'(x).

  const W = 5;
  const X = useMemo(() => Array.from({ length: 80 }, (_, i) => -2.5 + (i / 79) * W), []);

  // Map firm size x ∈ [-2.5, 2.5] to cost values
  // C_market(x): linear decreasing, peak at left
  // C_internal(x): quadratic increasing, peak at right
  // total(x) = C_market + C_internal, has minimum somewhere
  function cMarket(x: number) { return Math.max(0.05, 1.8 - 0.5 * (x + 2.5)); }
  function cInternal(x: number) { return 0.15 + 0.18 * Math.pow(x + 2.5, 1.55); }
  function cTotal(x: number) { return cMarket(x) + cInternal(x); }

  // Find optimum (numerically)
  let xOpt = -2.5;
  let minTotal = Infinity;
  for (const x of X) {
    const c = cTotal(x);
    if (c < minTotal) { minTotal = c; xOpt = x; }
  }

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 4]} intensity={0.55} />

      {/* Axes */}
      <Line points={[[-2.6, 0, 0], [2.6, 0, 0]]} color="#334155" lineWidth={1} />
      <Line points={[[-2.6, 0, 0], [-2.6, 2.6, 0]]} color="#334155" lineWidth={1} />

      {/* C_market curve (blue, decreasing) */}
      <Line
        points={X.map(x => [x, cMarket(x), 0] as [number, number, number])}
        color="#60A5FA"
        lineWidth={2}
      />

      {/* C_internal curve (pink, increasing) */}
      <Line
        points={X.map(x => [x, cInternal(x), 0] as [number, number, number])}
        color="#F472B6"
        lineWidth={2}
      />

      {/* C_total curve (yellow, sum) */}
      <Line
        points={X.map(x => [x, cTotal(x), 0] as [number, number, number])}
        color="#FDB813"
        lineWidth={2.5}
      />

      {/* Vertical line at optimal x* */}
      <Line
        points={[[xOpt, 0, 0], [xOpt, cTotal(xOpt) + 0.2, 0]]}
        color="#34D399"
        lineWidth={1.5}
        dashed
        dashSize={0.15}
        gapSize={0.1}
      />

      {/* Dot at optimum */}
      <mesh position={[xOpt, cTotal(xOpt), 0]}>
        <sphereGeometry args={[0.085, 16, 16]} />
        <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={2.2} />
      </mesh>

      {/* Moving marker (current size) */}
      <mesh ref={markerRef} position={[-2.5, 0, 0]}>
        <coneGeometry args={[0.1, 0.25, 12]} />
        <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={1.5} />
      </mesh>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MakeVsBuyScene({ phase }: SceneProps) {
  const isSize = phase === '07-tamano-optimo';

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #14111A 0%, #03050A 80%)' }}
    >
      <Canvas camera={{ position: [0, 1.4, 6], fov: 40 }}>
        {isSize ? <OptimalSizeScene /> : <DecisionScene />}
      </Canvas>

      {!isSize && (
        <>
          <div className="absolute top-6 left-6 text-[10px] font-mono uppercase tracking-[0.25em] text-[#94A3B8]">
            Make vs Buy · la decisión
          </div>
          <div className="absolute top-1/2 left-12 -translate-y-1/2 text-[11px] font-mono">
            <div className="text-[#60A5FA] mb-1">● mercado</div>
            <div className="text-[#94A3B8]">5 proveedores externos</div>
            <div className="text-[#64748B] mt-2 text-[10px]">costo: transactar</div>
          </div>
          <div className="absolute top-1/2 right-12 -translate-y-1/2 text-[11px] font-mono text-right">
            <div className="text-[#F472B6] mb-1">empresa ●</div>
            <div className="text-[#94A3B8]">jefe + 3 trabajadores</div>
            <div className="text-[#64748B] mt-2 text-[10px]">costo: coordinar</div>
          </div>
        </>
      )}

      {isSize && (
        <>
          <div className="absolute top-6 left-6 text-[10px] font-mono uppercase tracking-[0.25em] text-[#94A3B8]">
            Tamaño óptimo de la empresa
          </div>
          <div className="absolute top-6 right-6 text-[11px] font-mono space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-0.5 bg-[#60A5FA] shadow-[0_0_6px_#60A5FA]" />
              <span className="text-[#CBD5E1]">costo del mercado</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-0.5 bg-[#F472B6] shadow-[0_0_6px_#F472B6]" />
              <span className="text-[#CBD5E1]">costo de coordinar</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-0.5 bg-[#FDB813] shadow-[0_0_6px_#FDB813]" />
              <span className="text-[#CBD5E1]">costo total</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#34D399] shadow-[0_0_8px_#34D399]" />
              <span className="text-[#CBD5E1]">tamaño óptimo</span>
            </div>
          </div>
          <div className="absolute bottom-44 left-1/2 -translate-x-1/2 text-[11px] font-mono text-[#94A3B8] pointer-events-none">
            tamaño  →
          </div>
        </>
      )}
    </div>
  );
}
