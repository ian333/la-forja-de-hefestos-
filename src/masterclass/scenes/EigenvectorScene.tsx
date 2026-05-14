import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Symmetric matrix with known orthonormal eigenvectors
// We construct A = V D V^T explicitly so eigenvectors are exact.
const EIGEN = (() => {
  // Three orthonormal eigenvectors
  const v1 = new THREE.Vector3(1, 0, 0);
  const v2 = new THREE.Vector3(0, 1, 1).normalize();
  const v3 = new THREE.Vector3(0, 1, -1).normalize();
  const lambdas: [number, number, number] = [2.4, 1.2, 0.55];

  // Build A from V D V^T
  const V = [v1, v2, v3];
  const A = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) {
        const vk = V[k];
        const vk_i = [vk.x, vk.y, vk.z][i];
        const vk_j = [vk.x, vk.y, vk.z][j];
        s += lambdas[k] * vk_i * vk_j;
      }
      A[i][j] = s;
    }
  }
  return { vectors: [v1, v2, v3], lambdas, A };
})();

function applyMat(A: number[][], v: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(
    A[0][0]*v.x + A[0][1]*v.y + A[0][2]*v.z,
    A[1][0]*v.x + A[1][1]*v.y + A[1][2]*v.z,
    A[2][0]*v.x + A[2][1]*v.y + A[2][2]*v.z,
  );
}

function lerpMat(t: number): number[][] {
  // t=0 → I, t=1 → A
  const R: number[][] = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const target = EIGEN.A[i][j];
    const id = i === j ? 1 : 0;
    R[i][j] = id + (target - id) * t;
  }
  return R;
}

interface ArrowProps {
  baseDir: THREE.Vector3;
  isEigen: boolean;
  eigenIdx: number;
  phaseRef: React.MutableRefObject<string>;
}

function VectorArrow({ baseDir, isEigen, eigenIdx, phaseRef }: ArrowProps) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const phase = phaseRef.current;

    // Phase-dependent visibility for generic (non-eigen) vectors
    if (groupRef.current) {
      if (!isEigen) {
        // Hide generic vectors in phase 07 — only eigenvectors visible
        groupRef.current.visible = phase !== '07-eigenvector';
      } else {
        groupRef.current.visible = true;
      }
    }

    const period = 6.0;
    const local = (t % period) / period;
    let s = 0;
    if (local < 0.35) s = local / 0.35;
    else if (local < 0.65) s = 1;
    else s = 1 - (local - 0.65) / 0.35;
    const M = lerpMat(s);
    const transformed = applyMat(M, baseDir);
    const len = transformed.length();

    if (groupRef.current && len > 0.001) {
      const dir = transformed.clone().normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      groupRef.current.quaternion.copy(q);
      groupRef.current.scale.set(1, 1, len);
      if (matRef.current && isEigen) {
        // Stronger pulse in phase 09 (skeleton emphasis)
        const baseIntensity = phase === '09-esqueleto' ? 2.2 : 1.6;
        matRef.current.emissiveIntensity = baseIntensity + 0.8 * Math.sin(t * 1.5 + eigenIdx * 1.7);
      }
    }
  });

  const color = isEigen ? '#FDB813' : '#475569';
  const emissive = isEigen ? '#FDB813' : '#1E293B';
  const thickness = isEigen ? 0.04 : 0.022;
  const opacity = isEigen ? 1.0 : 0.65;

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, 0.5]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[thickness, thickness, 1, isEigen ? 12 : 8]} />
        <meshStandardMaterial ref={matRef} color={color} emissive={emissive} emissiveIntensity={isEigen ? 2.0 : 0.4} transparent opacity={opacity} />
      </mesh>
      <mesh position={[0, 0, 1.0]} rotation={[Math.PI/2, 0, 0]}>
        <coneGeometry args={[thickness * 2.5, thickness * 5, 12]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={isEigen ? 2.4 : 0.5} transparent opacity={opacity} />
      </mesh>
    </group>
  );
}

function HaloDisc({ vector, color }: { vector: THREE.Vector3; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const s = 1.0 + 0.15 * Math.sin(t * 1.2);
    ref.current.scale.setScalar(s);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.12 * Math.sin(t * 0.9);
  });
  // Position halo at tip of eigenvector
  const v = vector.clone().normalize();
  return (
    <mesh ref={ref} position={[v.x * 1.3, v.y * 1.3, v.z * 1.3]}>
      <sphereGeometry args={[0.16, 16, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.BackSide} />
    </mesh>
  );
}

function GridFloor() {
  const lines = useMemo(() => {
    const l: [number,number,number][][] = [];
    for (let i = -3; i <= 3; i++) {
      l.push([[i, -2, -3], [i, -2, 3]]);
      l.push([[-3, -2, i], [3, -2, i]]);
    }
    return l;
  }, []);
  return (
    <>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color="#1E1A2F" lineWidth={0.5} transparent opacity={0.3} />
      ))}
    </>
  );
}

function Scene({ phaseRef }: { phaseRef: React.MutableRefObject<string> }) {
  // 15 random non-eigen directions
  const randomDirs = useMemo(() => {
    const dirs: THREE.Vector3[] = [];
    let seed = 12345;
    for (let i = 0; i < 18; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const u = ((seed / 0x7fffffff) - 0.5) * 2;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const v = (seed / 0x7fffffff);
      const theta = u * Math.PI;
      const phi = Math.acos(2 * v - 1);
      const d = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi),
      );
      dirs.push(d);
    }
    return dirs;
  }, []);

  return (
    <>
      <ambientLight intensity={0.28} />
      <pointLight position={[3, 4, 3]} intensity={1.0} color="#FDB813" distance={14} />
      <pointLight position={[-3, 2, 4]} intensity={0.5} color="#7E57C2" distance={12} />
      <directionalLight position={[0, 5, 5]} intensity={0.35} />
      <GridFloor />
      {/* Non-eigen vectors (rotate AND stretch under A) */}
      {randomDirs.map((d, i) => (
        <VectorArrow key={`r${i}`} baseDir={d} isEigen={false} eigenIdx={i} phaseRef={phaseRef} />
      ))}
      {/* Eigenvectors (only stretch, no rotation) */}
      {EIGEN.vectors.map((v, i) => (
        <VectorArrow key={`e${i}`} baseDir={v.clone()} isEigen={true} eigenIdx={i} phaseRef={phaseRef} />
      ))}
      {EIGEN.vectors.map((v, i) => (
        <HaloDisc key={`h${i}`} vector={v} color="#FDB813" />
      ))}
      {/* Central glowing core */}
      <mesh>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#FFFAE5" emissive="#FDB813" emissiveIntensity={3.0} />
      </mesh>
    </>
  );
}

interface EigenvectorSceneProps {
  phase?: string;
}

export default function EigenvectorScene({ phase = '08-ecuacion-eigen' }: EigenvectorSceneProps) {
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const captionByPhase: Record<string, string> = {
    '07-eigenvector': 'tres direcciones propias, solo estiran  ·  Av = λv',
    '08-ecuacion-eigen': 'genéricos giran  ·  eigen solo estiran',
    '09-esqueleto': 'el esqueleto de A  ·  λ₁ = 2.4,  λ₂ = 1.2,  λ₃ = 0.55',
  };
  const caption = captionByPhase[phase] ?? '';

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #14081A 0%, #03050A 85%)' }}
    >
      <Canvas camera={{ position: [3.5, 2.0, 3.5], fov: 40 }}>
        <Scene phaseRef={phaseRef} />
        <OrbitControls
          enableDamping
          autoRotate
          autoRotateSpeed={0.3}
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI/4}
          maxPolarAngle={Math.PI/2.2}
          target={[0, 0, 0]}
        />
      </Canvas>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#FDB813] tracking-[0.3em] uppercase">
          Eigenvectores · direcciones invariantes
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">{caption}</div>
      </div>

      {/* Phase 09 — show λ values floating on the LEFT (chalkboard occupies right side) */}
      {phase === '09-esqueleto' && (
        <div className="absolute top-1/2 left-12 -translate-y-1/2 pointer-events-none">
          <div className="px-5 py-3 rounded-md border border-[#FDB813]/40 bg-black/40 backdrop-blur-sm">
            <div className="text-[10px] font-mono text-[#FDB813] uppercase tracking-[0.2em] mb-2">
              esqueleto de A
            </div>
            <div className="space-y-1.5 text-[14px]">
              <div className="text-white"><span className="text-[#FDB813]">λ₁</span> = 2.40  <span className="text-[#64748B]">↗ estiramiento</span></div>
              <div className="text-white"><span className="text-[#FDB813]">λ₂</span> = 1.20  <span className="text-[#64748B]">↗ estiramiento</span></div>
              <div className="text-white"><span className="text-[#FDB813]">λ₃</span> = 0.55  <span className="text-[#64748B]">↘ encogimiento</span></div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-8 left-8 pointer-events-none">
        <div className="flex items-center gap-2 text-[10px] font-mono mb-1">
          <span className="inline-block w-4 h-0.5 bg-[#FDB813] shadow-[0_0_6px_#FDB813]" />
          <span className="text-[#94A3B8]">eigenvectores · solo estiran</span>
        </div>
        {phase !== '07-eigenvector' && (
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="inline-block w-4 h-0.5 bg-[#475569]" />
            <span className="text-[#94A3B8]">vectores genéricos · rotan + estiran</span>
          </div>
        )}
      </div>
    </div>
  );
}
