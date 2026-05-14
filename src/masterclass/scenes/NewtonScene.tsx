/**
 * NewtonScene (cinematic) — fractal heightmap z³ − 1 rotating + iteration trace.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

type C = [number, number];
const cSub = (a: C, b: C): C => [a[0] - b[0], a[1] - b[1]];
const cMul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cDiv = (a: C, b: C): C => {
  const d = b[0] * b[0] + b[1] * b[1];
  if (d < 1e-30) return [NaN, NaN];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const cScale = (a: C, s: number): C => [a[0] * s, a[1] * s];
const cPow2 = (a: C): C => [a[0] * a[0] - a[1] * a[1], 2 * a[0] * a[1]];
const cPow3 = (a: C): C => cMul(cPow2(a), a);

const SQ3 = Math.sqrt(3) / 2;
const ROOTS: C[] = [[1, 0], [-0.5, SQ3], [-0.5, -SQ3]];
const ROOT_COLORS = ['#F472B6', '#4FC3F7', '#FDB813'];

const MAX_ITER = 32;

function p(z: C): C { return cSub(cPow3(z), [1, 0]); }
function pp(z: C): C { return cScale(cPow2(z), 3); }

function newtonIter(z0: C): { root: number; iters: number } {
  let z = z0;
  for (let i = 0; i < MAX_ITER; i++) {
    const dv = pp(z);
    if (dv[0] * dv[0] + dv[1] * dv[1] < 1e-20) return { root: -1, iters: MAX_ITER };
    z = cSub(z, cDiv(p(z), dv));
    if (!isFinite(z[0])) return { root: -1, iters: MAX_ITER };
    for (let r = 0; r < ROOTS.length; r++) {
      const dx = z[0] - ROOTS[r][0], dy = z[1] - ROOTS[r][1];
      if (dx * dx + dy * dy < 1e-6) return { root: r, iters: i + 1 };
    }
  }
  return { root: -1, iters: MAX_ITER };
}

const HALF = 1.7;
const N = 121;

function buildFractal() {
  const positions = new Float32Array(N * N * 3);
  const colors = new Float32Array(N * N * 3);
  const indices = new Uint32Array((N - 1) * (N - 1) * 6);
  const tmp = new THREE.Color();
  for (let j = 0; j < N; j++) {
    const y = -HALF + (j / (N - 1)) * 2 * HALF;
    for (let i = 0; i < N; i++) {
      const x = -HALF + (i / (N - 1)) * 2 * HALF;
      const r = newtonIter([x, y]);
      const k = (j * N + i) * 3;
      positions[k] = x; positions[k + 2] = y;
      positions[k + 1] = -r.iters * 0.024 + 0.6;
      const hex = r.root >= 0 ? ROOT_COLORS[r.root] : '#1E293B';
      tmp.set(hex);
      const m = 0.3 + 0.7 * (1 - Math.min(1, r.iters / 18));
      colors[k] = tmp.r * m; colors[k + 1] = tmp.g * m; colors[k + 2] = tmp.b * m;
    }
  }
  let kk = 0;
  for (let j = 0; j < N - 1; j++) {
    for (let i = 0; i < N - 1; i++) {
      const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
      indices[kk++] = a; indices[kk++] = c; indices[kk++] = b;
      indices[kk++] = b; indices[kk++] = c; indices[kk++] = d;
    }
  }
  return { positions, colors, indices };
}

function newtonTrace(z0: C, maxN: number): C[] {
  const pts: C[] = [z0];
  let z = z0;
  for (let i = 0; i < maxN; i++) {
    const dv = pp(z);
    if (dv[0] * dv[0] + dv[1] * dv[1] < 1e-20) break;
    z = cSub(z, cDiv(p(z), dv));
    if (!isFinite(z[0])) break;
    pts.push([Math.max(-HALF, Math.min(HALF, z[0])), Math.max(-HALF, Math.min(HALF, z[1]))]);
    for (const r of ROOTS) if ((z[0] - r[0]) ** 2 + (z[1] - r[1]) ** 2 < 1e-4) return pts;
  }
  return pts;
}

function Scene() {
  const { positions, colors, indices } = useMemo(buildFractal, []);
  const probeRef = useRef<THREE.Mesh>(null);
  const traceGeomRef = useRef<THREE.BufferGeometry>(null);
  const groupRef = useRef<THREE.Group>(null);
  const TRACE_N = 14;
  const traceBuf = useMemo(() => new Float32Array(TRACE_N * 3), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const r = 0.55 + 0.4 * Math.sin(t * 0.31);
    const θ = t * 0.45;
    const z0: C = [r * Math.cos(θ), r * Math.sin(θ)];
    if (probeRef.current) probeRef.current.position.set(z0[0], 0.94, z0[1]);

    const trace = newtonTrace(z0, TRACE_N - 1);
    const last = trace[trace.length - 1];
    for (let i = 0; i < TRACE_N; i++) {
      const q = trace[i] ?? last;
      traceBuf[i * 3 + 0] = q[0];
      traceBuf[i * 3 + 1] = 0.94;
      traceBuf[i * 3 + 2] = q[1];
    }
    if (traceGeomRef.current) (traceGeomRef.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(t * 0.08) * 0.15;
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} args={[colors, 3]} />
          <bufferAttribute attach="index" count={indices.length} array={indices} itemSize={1} args={[indices, 1]} />
        </bufferGeometry>
        <meshStandardMaterial vertexColors metalness={0.18} roughness={0.55} side={THREE.DoubleSide} />
      </mesh>
      {ROOTS.map((r, i) => (
        <mesh key={i} position={[r[0], 0.8, r[1]]}>
          <sphereGeometry args={[0.085, 24, 24]} />
          <meshStandardMaterial color={ROOT_COLORS[i]} emissive={ROOT_COLORS[i]} emissiveIntensity={1.5} />
        </mesh>
      ))}
      <mesh ref={probeRef}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={2} />
      </mesh>
      <line>
        <bufferGeometry ref={traceGeomRef}>
          <bufferAttribute attach="attributes-position" count={TRACE_N} array={traceBuf} itemSize={3} args={[traceBuf, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#FFFFFF" transparent opacity={0.85} />
      </line>
    </group>
  );
}

interface NewtonSceneProps {
  phase?: string;
}

export default function NewtonScene({ phase = '10-newton-fractal' }: NewtonSceneProps) {
  const captionByPhase: Record<string, string> = {
    '09-newton-pregunta': 'z³ = 1 → 3 raíces  ·  ¿desde dónde caes a cuál?',
    '10-newton-fractal': 'la frontera entre cuencas es un fractal infinito',
  };
  const caption = captionByPhase[phase] ?? '';

  return (
    <div className="w-full h-full relative" style={{
      background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)',
    }}>
      <Canvas camera={{ position: [0, 2.5, 4.5], fov: 45 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 3]} intensity={0.8} />
        <pointLight position={[0, 4, 0]} intensity={0.3} color="#FDB813" />
        <OrbitControls enableDamping autoRotate autoRotateSpeed={0.3} target={[0, 0.5, 0]} />
        <Scene />
      </Canvas>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#F472B6] tracking-[0.3em] uppercase">
          Fractales de Newton · ℂ
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">{caption}</div>
      </div>
    </div>
  );
}
