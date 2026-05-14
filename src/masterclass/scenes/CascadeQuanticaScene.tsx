/**
 * CascadeQuanticaScene — árbol genealógico de la cuántica.
 *
 *   Nodo raíz: E = h·f  (Einstein 1905)
 *   Hijos aparecen secuencialmente con su año:
 *     1923 · Compton      · p = h/λ
 *     1924 · de Broglie   · materia ondulatoria
 *     1924 · Bose-Einstein· estadística cuántica
 *     1925 · Heisenberg   · Δx · Δp ≥ ℏ/2
 *     1926 · Schrödinger  · i ℏ ∂_t ψ = H ψ
 *     1927 · Dirac        · ec. relativista del electrón
 *
 *   Drama: la raíz pulsa, las líneas se dibujan, cada nodo brilla al aparecer.
 *
 *   Fase: '14-cascada'
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

interface Props { phase?: string }

interface Child {
  id: string;
  year: number;
  who: string;
  formula: string;
  description: string;
  angleDeg: number;     // posición radial
  color: string;
}

const CHILDREN: Child[] = [
  { id: 'compton',     year: 1923, who: 'Compton',           formula: 'p = h / λ',                  description: 'fotón tiene momento',         angleDeg: 30,  color: '#FACC15' },
  { id: 'debroglie',   year: 1924, who: 'de Broglie',        formula: 'p = h / λ  ·  materia',      description: 'partículas son ondas',        angleDeg: 90,  color: '#FB923C' },
  { id: 'boseeinstein',year: 1924, who: 'Bose-Einstein',     formula: 'fotones indistinguibles',    description: 'estadística cuántica',        angleDeg: 150, color: '#A78BFA' },
  { id: 'heisenberg',  year: 1925, who: 'Heisenberg',        formula: 'Δx · Δp ≥ ℏ/2',              description: 'incertidumbre intrínseca',    angleDeg: 210, color: '#F472B6' },
  { id: 'schrodinger', year: 1926, who: 'Schrödinger',       formula: 'i ℏ ∂_t ψ = H ψ',            description: 'ecuación de onda',            angleDeg: 270, color: '#22D3EE' },
  { id: 'dirac',       year: 1928, who: 'Dirac',             formula: '(iγ^μ ∂_μ − m) ψ = 0',       description: 'relativista · antimateria',   angleDeg: 330, color: '#34D399' },
];

const RADIUS = 2.7;

function childPos(angleDeg: number): [number, number, number] {
  const a = angleDeg * Math.PI / 180;
  return [Math.cos(a) * RADIUS, Math.sin(a) * RADIUS, 0];
}

function RootNode() {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 1.5) * 0.08;
    ringRef.current.scale.setScalar(s);
  });
  return (
    <group>
      <mesh ref={ringRef}>
        <torusGeometry args={[0.85, 0.04, 12, 48]} />
        <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={1.8} toneMapped={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.8, 32]} />
        <meshBasicMaterial color="#03050A" />
      </mesh>
      <Text position={[0, 0.18, 0.01]} fontSize={0.28} color="#FFFFFF" anchorX="center" anchorY="middle" material-toneMapped={false}>
        E = h·f
      </Text>
      <Text position={[0, -0.18, 0.01]} fontSize={0.16} color="#FDB813" anchorX="center" anchorY="middle" material-toneMapped={false}>
        Einstein · 1905
      </Text>
    </group>
  );
}

function ChildNode({ child, visible, glow }: { child: Child; visible: boolean; glow: number }) {
  const pos = childPos(child.angleDeg);
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ringRef.current) return;
    const mat = ringRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 1.0 + glow * 1.8;
  });
  if (!visible) return null;
  return (
    <group position={pos}>
      <mesh ref={ringRef}>
        <torusGeometry args={[0.62, 0.03, 8, 32]} />
        <meshStandardMaterial color={child.color} emissive={child.color} emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.59, 28]} />
        <meshBasicMaterial color="#03050A" />
      </mesh>
      <Text position={[0, 0.32, 0.01]} fontSize={0.13} color={child.color} anchorX="center" anchorY="middle" material-toneMapped={false}>
        {`${child.year} · ${child.who}`}
      </Text>
      <Text position={[0, 0.06, 0.01]} fontSize={0.16} color="#FFFFFF" anchorX="center" anchorY="middle" material-toneMapped={false}>
        {child.formula}
      </Text>
      <Text position={[0, -0.22, 0.01]} fontSize={0.10} color="#94A3B8" anchorX="center" anchorY="middle" material-toneMapped={false}>
        {child.description}
      </Text>
    </group>
  );
}

function ConnectingLine({ child, visible }: { child: Child; visible: boolean }) {
  const pos = childPos(child.angleDeg);
  const inner = useMemo(() => {
    const dir = new THREE.Vector3(pos[0], pos[1], 0).normalize();
    return dir.multiplyScalar(0.85).toArray() as [number, number, number];
  }, [pos]);
  const outer = useMemo(() => {
    const dir = new THREE.Vector3(pos[0], pos[1], 0).normalize();
    const target = new THREE.Vector3(pos[0], pos[1], 0).sub(dir.multiplyScalar(0.62));
    return [target.x, target.y, 0] as [number, number, number];
  }, [pos]);
  if (!visible) return null;
  return <Line points={[inner, outer]} color={child.color} lineWidth={1.5} transparent opacity={0.7} />;
}

function Scene({ revealed, glowMap }: {
  revealed: Set<string>;
  glowMap: Record<string, number>;
}) {
  return (
    <>
      <ambientLight intensity={1.1} />
      <pointLight position={[0, 0, 4]} intensity={0.5} color="#FDB813" />
      <RootNode />
      {CHILDREN.map((c) => (
        <group key={c.id}>
          <ConnectingLine child={c} visible={revealed.has(c.id)} />
          <ChildNode child={c} visible={revealed.has(c.id)} glow={glowMap[c.id] ?? 0} />
        </group>
      ))}
    </>
  );
}

export default function CascadeQuanticaScene({ phase: _phase = '14-cascada' }: Props) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [glowMap, setGlowMap] = useState<Record<string, number>>({});

  useEffect(() => {
    // Cada 2 segundos aparece un hijo nuevo
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      const newRevealed = new Set<string>();
      const newGlow: Record<string, number> = {};
      CHILDREN.forEach((c, i) => {
        const tAppear = 1 + i * 1.6;
        if (elapsed >= tAppear) {
          newRevealed.add(c.id);
          const age = elapsed - tAppear;
          newGlow[c.id] = Math.max(0, 1 - age / 1.5);
        }
      });
      setRevealed(newRevealed);
      setGlowMap(newGlow);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at center, #2A1A03 0%, #03050A 75%)' }}
    >
      <Canvas camera={{ position: [0, 0, 7.5], fov: 42 }}>
        <Scene revealed={revealed} glowMap={glowMap} />
        <OrbitControls enableDamping enableZoom={false} enablePan={false} enableRotate={false} target={[0, 0, 0]} />
      </Canvas>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#FDB813] tracking-[0.3em] uppercase">
          Hijos directos de E = h·f
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">
          una sola ecuación · la mecánica cuántica entera
        </div>
      </div>

      <div className="absolute bottom-6 left-6 pointer-events-none">
        <div className="px-5 py-3 rounded-md border border-[#FDB813]/30 bg-black/55 backdrop-blur-sm">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#FDB813]">
            Annalen der Physik · vol. 17 · 1905
          </div>
          <div className="text-[12px] font-mono text-[#CBD5E1] mt-1">
            <em>Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt</em>
          </div>
          <div className="mt-2 text-[10px] font-mono">
            <a
              href="https://onlinelibrary.wiley.com/doi/10.1002/andp.19053220607"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#22D3EE] hover:underline pointer-events-auto"
            >
              DOI 10.1002/andp.19053220607 ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
