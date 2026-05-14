/**
 * ConformalScene (cinematic) — Joukowski airfoil + animated particles.
 * Slowly oscillates the angle of attack to show lift growing/shrinking.
 */

import { useMemo, useRef } from 'react';
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
const joukowski = (z: C): C => cAdd(z, cDiv([1, 0], z));

const OFFSET_X = -0.1, OFFSET_Y = 0.07;
const ZC: C = [OFFSET_X, OFFSET_Y];
const R = Math.hypot(1 - OFFSET_X, -OFFSET_Y);

function flowVel(z: C, alpha: number, gamma: number) {
  const zRel = cSub(z, ZC);
  const eMinusIα: C = [Math.cos(alpha), -Math.sin(alpha)];
  const ePlusIα: C  = [Math.cos(alpha), Math.sin(alpha)];
  const Rsq = cDiv([R * R, 0], cMul(zRel, zRel));
  const vortex = cDiv([0, -gamma / (2 * Math.PI)], zRel);
  const dPhi = cAdd(cSub(eMinusIα, cMul(ePlusIα, Rsq)), vortex);
  return { u: dPhi[0], v: -dPhi[1] };
}

const kutta = (alpha: number) => -4 * Math.PI * R * Math.sin(alpha + Math.atan2(ZC[1], 1 - ZC[0]));

function sampleCircle(n: number): C[] {
  const out: C[] = [];
  for (let i = 0; i <= n; i++) {
    const θ = (2 * Math.PI * i) / n;
    out.push([ZC[0] + R * Math.cos(θ), ZC[1] + R * Math.sin(θ)]);
  }
  return out;
}

function clamp(v: number) { return Math.max(-2.5, Math.min(2.5, v)); }

const Z_OFFSET = -2.8, W_OFFSET = 2.8;
const N_PARTS = 70;

function Scene() {
  const cylPts = useMemo(() => sampleCircle(120), []);
  const alphaRef = useRef(0.2);
  const particles = useRef<Float32Array>(new Float32Array(N_PARTS * 2));
  const zPartsRef = useRef<THREE.InstancedMesh>(null);
  const wPartsRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const liftRef = useRef<THREE.Group>(null);
  const airfoilGeomRef = useRef<THREE.BufferGeometry>(null);
  const airfoilBuf = useMemo(() => new Float32Array(121 * 3), []);

  // Initialize particles
  const initDone = useRef(false);
  if (!initDone.current) {
    for (let i = 0; i < N_PARTS; i++) {
      particles.current[i * 2] = -2.6 - Math.random() * 0.4;
      particles.current[i * 2 + 1] = -1.9 + (i / N_PARTS) * 3.8;
    }
    initDone.current = true;
  }

  useFrame((_, delta) => {
    const t = performance.now() * 0.001;
    // Oscillate alpha between 0.05 and 0.32 over ~7s
    const alpha = 0.18 + 0.14 * Math.sin(t * 0.42);
    alphaRef.current = alpha;
    const gamma = kutta(alpha);
    const dt = Math.min(0.05, delta) * 0.85;
    const arr = particles.current;
    for (let i = 0; i < N_PARTS; i++) {
      const x = arr[i * 2], y = arr[i * 2 + 1];
      const v1 = flowVel([x, y], alpha, gamma);
      const xm = x + 0.5 * dt * v1.u, ym = y + 0.5 * dt * v1.v;
      const v2 = flowVel([xm, ym], alpha, gamma);
      let nx = x + dt * v2.u, ny = y + dt * v2.v;
      if (nx > 2.5 || Math.abs(ny) > 2.2 || !isFinite(nx)) {
        nx = -2.6 - Math.random() * 0.3;
        ny = -1.9 + Math.random() * 3.8;
      }
      const drx = nx - ZC[0], dry = ny - ZC[1];
      if (drx * drx + dry * dry < R * R * 1.02) {
        const ang = Math.atan2(dry, drx);
        nx = ZC[0] + R * 1.05 * Math.cos(ang);
        ny = ZC[1] + R * 1.05 * Math.sin(ang);
      }
      arr[i * 2] = nx; arr[i * 2 + 1] = ny;
      if (zPartsRef.current) {
        dummy.position.set(Z_OFFSET + clamp(nx), ny, 0.02);
        dummy.updateMatrix();
        zPartsRef.current.setMatrixAt(i, dummy.matrix);
      }
      if (wPartsRef.current) {
        const wz = joukowski([nx, ny]);
        if (isFinite(wz[0]) && isFinite(wz[1])) {
          dummy.position.set(W_OFFSET + clamp(wz[0]), clamp(wz[1]), 0.02);
          dummy.updateMatrix();
          wPartsRef.current.setMatrixAt(i, dummy.matrix);
        }
      }
    }
    if (zPartsRef.current) zPartsRef.current.instanceMatrix.needsUpdate = true;
    if (wPartsRef.current) wPartsRef.current.instanceMatrix.needsUpdate = true;

    // Airfoil contour (changes if alpha rotates the frame visually — keep static)
    // Lift arrow pulse based on current gamma
    if (liftRef.current) {
      const len = Math.min(1.4, Math.abs(gamma) * 0.4);
      liftRef.current.scale.set(1, len, 1);
      liftRef.current.position.y = len * 0.5;
      liftRef.current.visible = len > 0.1;
    }

    // Build airfoil from current particle frame (alpha-dependent? Actually
    // Joukowski mapping is independent of alpha — wing shape stays same).
    if (!airfoilBuf[0]) {  // first time only
      for (let i = 0; i <= 120; i++) {
        const z = cylPts[i];
        const w = joukowski(z);
        airfoilBuf[i * 3 + 0] = W_OFFSET + clamp(w[0]);
        airfoilBuf[i * 3 + 1] = w[1];
        airfoilBuf[i * 3 + 2] = 0;
      }
      if (airfoilGeomRef.current) {
        (airfoilGeomRef.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }
    }
  });

  return (
    <>
      {/* Backdrops */}
      <PlaneBg center={[Z_OFFSET, 0, 0]} />
      <PlaneBg center={[W_OFFSET, 0, 0]} />

      {/* Cylinder (left) */}
      <Line
        points={cylPts.map(p => [Z_OFFSET + p[0], p[1], 0] as [number, number, number])}
        color="#FDB813" lineWidth={2}
      />

      {/* Airfoil (right) — buffer-based for HMR robustness */}
      <line>
        <bufferGeometry ref={airfoilGeomRef}>
          <bufferAttribute attach="attributes-position" count={121} array={airfoilBuf} itemSize={3} args={[airfoilBuf, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#FDB813" linewidth={2} />
      </line>

      {/* Particles */}
      <instancedMesh ref={zPartsRef} args={[undefined, undefined, N_PARTS]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#7DD3FC" emissiveIntensity={1.2} />
      </instancedMesh>
      <instancedMesh ref={wPartsRef} args={[undefined, undefined, N_PARTS]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FBBF77" emissiveIntensity={1.2} />
      </instancedMesh>

      {/* Lift arrow on right plane */}
      <group ref={liftRef} position={[W_OFFSET + 0.4, 0, 0.05]}>
        <mesh>
          <boxGeometry args={[0.06, 1, 0.06]} />
          <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={0.7} />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <coneGeometry args={[0.1, 0.2, 16]} />
          <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={0.9} />
        </mesh>
      </group>

      {/* Axes */}
      <Line points={[[Z_OFFSET - 2.4, 0, 0], [Z_OFFSET + 2.4, 0, 0]]} color="#334155" lineWidth={0.8} transparent opacity={0.5} />
      <Line points={[[W_OFFSET - 2.4, 0, 0], [W_OFFSET + 2.4, 0, 0]]} color="#334155" lineWidth={0.8} transparent opacity={0.5} />
    </>
  );
}

function PlaneBg({ center }: { center: [number, number, number] }) {
  return (
    <mesh position={[center[0], center[1], center[2] - 0.005]}>
      <planeGeometry args={[4.8, 4.8]} />
      <meshBasicMaterial color="#0B1220" transparent opacity={0.55} />
    </mesh>
  );
}

interface ConformalSceneProps {
  phase?: string;
}

export default function ConformalScene({ phase = '13-flujo' }: ConformalSceneProps) {
  const captionByPhase: Record<string, string> = {
    '11-conformal-formula': 'Joukowski · w = z + 1/z',
    '12-airfoil': 'círculo descentrado → perfil de ala',
    '13-flujo': 'flujo potencial · presión arriba ≠ abajo',
    '14-em-puente': 'Bombelli → Möbius → Joukowski  ·  3 siglos',
  };
  const caption = captionByPhase[phase] ?? '';

  return (
    <div className="w-full h-full relative" style={{
      background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)',
    }}>
      <Canvas camera={{ position: [0, 0.5, 7.5], fov: 45 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 6, 5]} intensity={0.7} />
        <OrbitControls enableDamping autoRotate autoRotateSpeed={0.15} target={[0, 0, 0]} />
        <Scene />
      </Canvas>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#F472B6] tracking-[0.3em] uppercase">
          Mapas conformes · Joukowski
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">{caption}</div>
      </div>
    </div>
  );
}
