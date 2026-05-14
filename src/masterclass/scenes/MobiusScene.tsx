/**
 * MobiusScene (cinematic) — z plane + w plane + Riemann sphere.
 * Cycles through identity → inversion → Cayley automatically.
 */

import { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

type C = [number, number];

const cAdd = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const cSub = (a: C, b: C): C => [a[0] - b[0], a[1] - b[1]];
const cMul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cDiv = (a: C, b: C): C => {
  const d = b[0] * b[0] + b[1] * b[1];
  if (d < 1e-12) return [NaN, NaN];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};

function mobius(z: C, a: C, b: C, d: C, e: C): C {
  return cDiv(cAdd(cMul(a, z), b), cAdd(cMul(d, z), e));
}

function stereo(z: C): [number, number, number] {
  if (!isFinite(z[0]) || !isFinite(z[1])) return [0, 0, 1];
  const r2 = z[0] * z[0] + z[1] * z[1];
  const D = r2 + 1;
  return [2 * z[0] / D, 2 * z[1] / D, (r2 - 1) / D];
}

const PRESETS = [
  { id: 'identity', a: [1, 0], b: [0, 0], d: [0, 0], e: [1, 0] },
  { id: 'inversion', a: [0, 0], b: [1, 0], d: [1, 0], e: [0, 0] },
  { id: 'cayley',   a: [1, 0], b: [0, -1], d: [1, 0], e: [0, 1] },
  { id: 'rotate',   a: [Math.cos(Math.PI / 3), Math.sin(Math.PI / 3)], b: [0, 0], d: [0, 0], e: [1, 0] },
] as const;

function buildGrid(): { color: string; pts: C[] }[] {
  const out: { color: string; pts: C[] }[] = [];
  for (const r of [0.5, 1, 1.5, 2]) {
    const pts: C[] = [];
    for (let i = 0; i <= 80; i++) {
      const θ = (2 * Math.PI * i) / 80;
      pts.push([r * Math.cos(θ), r * Math.sin(θ)]);
    }
    out.push({ color: '#4FC3F7', pts });
  }
  for (let k = 0; k < 8; k++) {
    const θ = (k * Math.PI) / 4;
    const pts: C[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      pts.push([3 * Math.cos(θ) * t, 3 * Math.sin(θ) * t]);
    }
    out.push({ color: '#F472B6', pts });
  }
  return out;
}

function clamp3(v: number) { return Math.max(-3, Math.min(3, v)); }

function Scene() {
  const grid = useMemo(() => buildGrid(), []);
  const [preset, setPreset] = useState<typeof PRESETS[number]>(PRESETS[2]); // start with Cayley

  // Cycle presets every 6s
  useEffect(() => {
    const order: typeof PRESETS[number]['id'][] = ['identity', 'rotate', 'inversion', 'cayley'];
    let i = 0;
    setPreset(PRESETS.find(p => p.id === order[0])!);
    const t = setInterval(() => {
      i = (i + 1) % order.length;
      setPreset(PRESETS.find(p => p.id === order[i])!);
    }, 6500);
    return () => clearInterval(t);
  }, []);

  const transformed = useMemo(() => grid.map(curve => ({
    color: curve.color,
    pts: curve.pts.map(z => mobius(z, preset.a as C, preset.b as C, preset.d as C, preset.e as C)),
  })), [grid, preset]);

  const Z_OFFSET = -3;
  const W_OFFSET = 3;
  const SPHERE = { c: [0, 4.5, 0] as [number, number, number], R: 1.5 };

  // Animated probe
  const zRef = useRef<THREE.Mesh>(null);
  const wRef = useRef<THREE.Mesh>(null);
  const sRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const r = 1.0 + 0.4 * Math.sin(t * 0.2);
    const θ = t * 0.55;
    const z: C = [r * Math.cos(θ), r * Math.sin(θ)];
    if (zRef.current) zRef.current.position.set(Z_OFFSET + z[0], z[1], 0.04);
    const w = mobius(z, preset.a as C, preset.b as C, preset.d as C, preset.e as C);
    const wOk = isFinite(w[0]) && isFinite(w[1]);
    if (wRef.current) {
      if (wOk) wRef.current.position.set(W_OFFSET + clamp3(w[0]), clamp3(w[1]), 0.04);
      wRef.current.visible = wOk;
    }
    if (sRef.current) {
      const [px, py, pz] = stereo(w);
      sRef.current.position.set(
        SPHERE.c[0] + SPHERE.R * px,
        SPHERE.c[1] + SPHERE.R * pz,
        SPHERE.c[2] + SPHERE.R * py,
      );
      sRef.current.visible = wOk;
    }
  });

  return (
    <>
      {/* z plane */}
      <PlanePanel center={[Z_OFFSET, 0, 0]} />
      {grid.map((curve, i) => (
        <Line
          key={`z${i}`}
          points={curve.pts.map(p => [Z_OFFSET + p[0], p[1], 0] as [number, number, number])}
          color={curve.color} lineWidth={1.4} transparent opacity={0.85}
        />
      ))}

      {/* w plane */}
      <PlanePanel center={[W_OFFSET, 0, 0]} />
      {transformed.flatMap((curve, i) => {
        const segs: [number, number, number][][] = [];
        let cur: [number, number, number][] = [];
        for (const p of curve.pts) {
          if (!isFinite(p[0]) || !isFinite(p[1])) {
            if (cur.length > 1) segs.push(cur);
            cur = []; continue;
          }
          cur.push([W_OFFSET + clamp3(p[0]), clamp3(p[1]), 0]);
        }
        if (cur.length > 1) segs.push(cur);
        return segs.map((seg, k) => (
          <Line key={`w${i}-${k}`} points={seg} color={curve.color} lineWidth={1.4} transparent opacity={0.85} />
        ));
      })}

      {/* Sphere */}
      <RiemannSphere center={SPHERE.c} R={SPHERE.R} grid={grid} transformed={transformed} />

      {/* Probes */}
      <mesh ref={zRef}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={2} />
      </mesh>
      <mesh ref={wRef}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FDB813" emissiveIntensity={2} />
      </mesh>
      <mesh ref={sRef}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#34D399" emissiveIntensity={2} />
      </mesh>
    </>
  );
}

function PlanePanel({ center }: { center: [number, number, number] }) {
  const [cx, cy, cz] = center;
  const size = 3.5;
  return (
    <>
      <mesh position={[cx, cy, cz - 0.001]}>
        <planeGeometry args={[size * 2, size * 2]} />
        <meshBasicMaterial color="#0B1220" transparent opacity={0.6} />
      </mesh>
      <Line points={[[cx - size, cy, cz], [cx + size, cy, cz]]} color="#334155" lineWidth={1} />
      <Line points={[[cx, cy - size, cz], [cx, cy + size, cz]]} color="#334155" lineWidth={1} />
    </>
  );
}

function RiemannSphere({
  center, R, grid, transformed,
}: {
  center: [number, number, number]; R: number;
  grid: { color: string; pts: C[] }[];
  transformed: { color: string; pts: C[] }[];
}) {
  const [cx, cy, cz] = center;
  const project = (pts: C[]): [number, number, number][][] => {
    const segs: [number, number, number][][] = [];
    let cur: [number, number, number][] = [];
    for (const z of pts) {
      if (!isFinite(z[0]) || !isFinite(z[1])) { if (cur.length > 1) segs.push(cur); cur = []; continue; }
      const [px, py, pz] = stereo(z);
      cur.push([cx + R * px, cy + R * pz, cz + R * py]);
    }
    if (cur.length > 1) segs.push(cur);
    return segs;
  };
  return (
    <>
      <mesh position={[cx, cy, cz]}>
        <sphereGeometry args={[R, 48, 32]} />
        <meshStandardMaterial color="#1E293B" metalness={0.3} roughness={0.7} transparent opacity={0.55} />
      </mesh>
      {/* North = ∞ */}
      <mesh position={[cx, cy + R, cz]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={1} />
      </mesh>
      {/* South = 0 */}
      <mesh position={[cx, cy - R, cz]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#4FC3F7" emissive="#4FC3F7" emissiveIntensity={1} />
      </mesh>
      {grid.flatMap((curve, i) => project(curve.pts).map((seg, k) => (
        <Line key={`zs${i}-${k}`} points={seg} color={curve.color} lineWidth={1} transparent opacity={0.25} />
      )))}
      {transformed.flatMap((curve, i) => project(curve.pts).map((seg, k) => (
        <Line key={`ws${i}-${k}`} points={seg} color={curve.color} lineWidth={1.3} transparent opacity={0.9} />
      )))}
    </>
  );
}

interface MobiusSceneProps {
  phase?: string;
}

export default function MobiusScene({ phase = '06-mobius-intro' }: MobiusSceneProps) {
  const captionByPhase: Record<string, string> = {
    '06-mobius-intro': 'w = (az + b) / (cz + d)  ·  fórmula simple',
    '07-mobius-magia': 'círculo → círculo  ·  ángulos preservados',
    '08-riemann': 'planos colapsan en la esfera de Riemann',
  };
  const caption = captionByPhase[phase] ?? '';

  return (
    <div className="w-full h-full relative" style={{
      background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)',
    }}>
      <Canvas camera={{ position: [0, 2, 9], fov: 45 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={0.7} />
        <pointLight position={[0, 0, 0]} intensity={0.4} color="#FDB813" />
        <OrbitControls enableDamping autoRotate autoRotateSpeed={0.2} target={[0, 1, 0]} />
        <Scene />
      </Canvas>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#F472B6] tracking-[0.3em] uppercase">
          Möbius · esfera de Riemann
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">{caption}</div>
      </div>
    </div>
  );
}
