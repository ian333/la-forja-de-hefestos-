import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const N_PTS = 900;

/**
 * Gaussian cloud with non-trivial covariance + glowing principal axes.
 * Covariance matrix is fixed (we picked it analytically) so the principal
 * axes are exact.
 */

// Principal axes (orthonormal) + variances
const PAXES = {
  v1: new THREE.Vector3(0.85, 0.4, 0.34).normalize(),
  v2: new THREE.Vector3(-0.5, 0.8, 0.32).normalize(),
  v3: new THREE.Vector3(0.15, -0.45, 0.88).normalize(),
  sigma: [1.85, 0.95, 0.42] as [number, number, number],
};

function gaussian(rand: () => number): number {
  // Box-Muller
  const u = Math.max(1e-9, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function PointCloud() {
  const meshRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    let seed = 4242;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const arr = new Float32Array(N_PTS * 3);
    for (let i = 0; i < N_PTS; i++) {
      // Sample in eigen-basis
      const a = gaussian(rand) * PAXES.sigma[0];
      const b = gaussian(rand) * PAXES.sigma[1];
      const c = gaussian(rand) * PAXES.sigma[2];
      // Transform to world coords
      arr[i*3+0] = PAXES.v1.x * a + PAXES.v2.x * b + PAXES.v3.x * c;
      arr[i*3+1] = PAXES.v1.y * a + PAXES.v2.y * b + PAXES.v3.y * c;
      arr[i*3+2] = PAXES.v1.z * a + PAXES.v2.z * b + PAXES.v3.z * c;
    }
    return arr;
  }, []);

  const colors = useMemo(() => {
    const arr = new Float32Array(N_PTS * 3);
    for (let i = 0; i < N_PTS; i++) {
      const x = positions[i*3+0];
      const y = positions[i*3+1];
      const z = positions[i*3+2];
      const t = Math.min(1, Math.sqrt(x*x + y*y + z*z) / 3);
      // Color from cyan (near center) to gold (far)
      arr[i*3+0] = 0.3 + 0.7 * t;
      arr[i*3+1] = 0.7 + 0.25 * t;
      arr[i*3+2] = 0.9 - 0.7 * t;
    }
    return arr;
  }, [positions]);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.PointsMaterial;
      mat.size = 0.075 + 0.012 * Math.sin(clock.elapsedTime * 0.8);
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={N_PTS} array={positions} itemSize={3} args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" count={N_PTS} array={colors} itemSize={3} args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.08} vertexColors transparent opacity={0.85} sizeAttenuation />
    </points>
  );
}

function Ellipsoid({ phaseRef }: { phaseRef: React.MutableRefObject<string> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const phase = phaseRef.current;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    // Hide in phase 15 (only cloud), visible in 16/17
    const baseAlpha = phase === '15-datos' ? 0 : (0.07 + 0.04 * Math.sin(clock.elapsedTime * 0.6));
    mat.opacity = baseAlpha;
    ref.current.visible = baseAlpha > 0.005;
  });
  const matrix = useMemo(() => {
    const m = new THREE.Matrix4();
    m.makeBasis(PAXES.v1, PAXES.v2, PAXES.v3);
    return m;
  }, []);
  return (
    <mesh ref={ref} matrix={matrix} matrixAutoUpdate={false}>
      <sphereGeometry args={[1, 32, 24]} />
      <meshBasicMaterial color="#7E57C2" transparent opacity={0.1} side={THREE.DoubleSide} wireframe={false} />
    </mesh>
  );
}

function EllipsoidWire({ phaseRef }: { phaseRef: React.MutableRefObject<string> }) {
  const ref = useRef<THREE.Mesh>(null);
  const phaseStart = useRef(0);
  const lastPhase = useRef('');
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const phase = phaseRef.current;
    if (phase !== lastPhase.current) {
      phaseStart.current = t;
      lastPhase.current = phase;
    }
    const tLocal = t - phaseStart.current;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    let alpha = 0;
    if (phase === '15-datos') {
      alpha = 0;
    } else if (phase === '16-covarianza') {
      // Reveal wireframe after first axis appears
      const reveal = Math.min(1, Math.max(0, (tLocal - 4) / 2));
      alpha = reveal * (0.18 + 0.06 * Math.sin(t * 0.5));
    } else {
      alpha = 0.18 + 0.06 * Math.sin(t * 0.5);
    }
    mat.opacity = alpha;
    ref.current.visible = alpha > 0.005;
  });
  const matrix = useMemo(() => {
    const m = new THREE.Matrix4();
    const v1s = PAXES.v1.clone().multiplyScalar(PAXES.sigma[0]);
    const v2s = PAXES.v2.clone().multiplyScalar(PAXES.sigma[1]);
    const v3s = PAXES.v3.clone().multiplyScalar(PAXES.sigma[2]);
    m.makeBasis(v1s, v2s, v3s);
    return m;
  }, []);
  return (
    <mesh ref={ref} matrix={matrix} matrixAutoUpdate={false}>
      <sphereGeometry args={[1, 24, 16]} />
      <meshBasicMaterial color="#A78BFA" wireframe transparent opacity={0.22} />
    </mesh>
  );
}

interface AxisArrowProps {
  dir: THREE.Vector3;
  length: number;
  color: string;
  pulseIdx: number;
  /** PC index (0=PC1, 1=PC2, 2=PC3) — used for progressive reveal */
  pcIdx: number;
  phaseRef: React.MutableRefObject<string>;
}
function AxisArrow({ dir, length, color, pulseIdx, pcIdx, phaseRef }: AxisArrowProps) {
  const groupRef = useRef<THREE.Group>(null);
  const cylMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const coneMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const phaseStart = useRef(0);
  const lastPhase = useRef('');
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const phase = phaseRef.current;
    if (phase !== lastPhase.current) {
      phaseStart.current = t;
      lastPhase.current = phase;
    }
    const tLocal = t - phaseStart.current;

    // Progressive reveal in phase 16: PC1 at t≈1s, PC2 at t≈3s, PC3 at t≈5s
    let visScale = 1;
    if (phase === '15-datos') {
      visScale = 0;
    } else if (phase === '16-covarianza') {
      const appearAt = [1, 3, 5][pcIdx];
      visScale = Math.min(1, Math.max(0, (tLocal - appearAt) / 0.8));
    }

    if (groupRef.current) {
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
      groupRef.current.quaternion.copy(q);
      groupRef.current.scale.set(visScale, visScale, visScale);
      groupRef.current.visible = visScale > 0.01;
    }
    const intensity = (1.8 + 0.6 * Math.sin(t * 1.4 + pulseIdx * 1.7)) * Math.max(0.4, visScale);
    if (cylMatRef.current) cylMatRef.current.emissiveIntensity = intensity;
    if (coneMatRef.current) coneMatRef.current.emissiveIntensity = intensity * 1.2;
  });
  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, length / 2]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.038, 0.038, length, 14]} />
        <meshStandardMaterial ref={cylMatRef} color={color} emissive={color} emissiveIntensity={2.0} />
      </mesh>
      <mesh position={[0, 0, length]} rotation={[Math.PI/2, 0, 0]}>
        <coneGeometry args={[0.11, 0.26, 14]} />
        <meshStandardMaterial ref={coneMatRef} color={color} emissive={color} emissiveIntensity={2.6} />
      </mesh>
    </group>
  );
}

function Scene({ phaseRef }: { phaseRef: React.MutableRefObject<string> }) {
  const colors = ['#FDB813', '#F472B6', '#34D399'];
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[3, 4, 3]} intensity={1.0} color="#A78BFA" distance={16} />
      <pointLight position={[-3, 2, 4]} intensity={0.6} color="#FDB813" distance={12} />
      <directionalLight position={[2, 5, 4]} intensity={0.35} />
      <Ellipsoid phaseRef={phaseRef} />
      <EllipsoidWire phaseRef={phaseRef} />
      <PointCloud />
      <AxisArrow dir={PAXES.v1.clone()} length={PAXES.sigma[0] * 1.5} color={colors[0]} pulseIdx={0} pcIdx={0} phaseRef={phaseRef} />
      <AxisArrow dir={PAXES.v2.clone()} length={PAXES.sigma[1] * 1.5} color={colors[1]} pulseIdx={1} pcIdx={1} phaseRef={phaseRef} />
      <AxisArrow dir={PAXES.v3.clone()} length={PAXES.sigma[2] * 1.5} color={colors[2]} pulseIdx={2} pcIdx={2} phaseRef={phaseRef} />
      <AxisArrow dir={PAXES.v1.clone().negate()} length={PAXES.sigma[0] * 1.5} color={colors[0]} pulseIdx={0} pcIdx={0} phaseRef={phaseRef} />
      <AxisArrow dir={PAXES.v2.clone().negate()} length={PAXES.sigma[1] * 1.5} color={colors[1]} pulseIdx={1} pcIdx={1} phaseRef={phaseRef} />
      <AxisArrow dir={PAXES.v3.clone().negate()} length={PAXES.sigma[2] * 1.5} color={colors[2]} pulseIdx={2} pcIdx={2} phaseRef={phaseRef} />
    </>
  );
}

interface PCASceneProps {
  phase?: string;
}

export default function PCAScene({ phase = '17-aplicaciones' }: PCASceneProps) {
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const captionByPhase: Record<string, string> = {
    '15-datos': 'una nube de puntos  ·  ¿cuáles son sus ejes naturales?',
    '16-covarianza': 'eigenvectores de Σ → PC1 → PC2 → PC3',
    '17-aplicaciones': 'eigenfaces · embeddings · expresión génica',
  };
  const caption = captionByPhase[phase] ?? '';

  const showLegend = phase !== '15-datos';
  const isApplications = phase === '17-aplicaciones';

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #170B22 0%, #03050A 85%)' }}
    >
      <Canvas camera={{ position: [4.5, 3.0, 4.5], fov: 40 }}>
        <Scene phaseRef={phaseRef} />
        <OrbitControls
          enableDamping
          autoRotate
          autoRotateSpeed={0.35}
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI/5}
          maxPolarAngle={Math.PI/2.2}
          target={[0, 0, 0]}
        />
      </Canvas>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#A78BFA] tracking-[0.3em] uppercase">
          PCA · ejes principales
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">{caption}</div>
      </div>

      {isApplications && (
        <div className="absolute top-1/2 left-12 -translate-y-1/2 pointer-events-none">
          <div className="px-5 py-3 rounded-md border border-[#A78BFA]/40 bg-black/40 backdrop-blur-sm">
            <div className="text-[10px] font-mono text-[#A78BFA] uppercase tracking-[0.2em] mb-2">
              PCA en producción
            </div>
            <div className="space-y-1 text-[12px] font-mono text-[#CBD5E1]">
              <div>· Eigenfaces (Turk-Pentland)</div>
              <div>· embeddings de redes neuronales</div>
              <div>· expresión génica → PC1, PC2</div>
              <div>· factores Fama-French</div>
              <div>· compresión JPEG (DCT variante)</div>
            </div>
          </div>
        </div>
      )}

      {showLegend && (
        <div className="absolute bottom-8 left-8 pointer-events-none">
          <div className="flex items-center gap-2 text-[10px] font-mono mb-1">
            <span className="inline-block w-4 h-0.5 bg-[#FDB813] shadow-[0_0_6px_#FDB813]" />
            <span className="text-[#94A3B8]">PC1 · varianza {(PAXES.sigma[0] ** 2).toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono mb-1">
            <span className="inline-block w-4 h-0.5 bg-[#F472B6]" />
            <span className="text-[#94A3B8]">PC2 · varianza {(PAXES.sigma[1] ** 2).toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="inline-block w-4 h-0.5 bg-[#34D399]" />
            <span className="text-[#94A3B8]">PC3 · varianza {(PAXES.sigma[2] ** 2).toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
