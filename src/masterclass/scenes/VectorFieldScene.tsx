import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface VectorFieldSceneProps {
  phase?: string;
}

const GRID = 12;
const EXTENT = 4.5;
const N_PARTICLES = 200;

function fieldFn(x: number, y: number): [number, number] {
  const r2 = x * x + y * y + 0.5;
  const vx = -y / r2 + 0.12 * x / r2;
  const vy = x / r2 + 0.12 * y / r2;
  return [vx, vy];
}

function Arrows() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = GRID * GRID;
  const colors = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const cLow = new THREE.Color('#1E3A5F');
    const cHigh = new THREE.Color('#4FC3F7');
    let idx = 0;
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const x = -EXTENT + (2 * EXTENT * (i + 0.5)) / GRID;
        const y = -EXTENT + (2 * EXTENT * (j + 0.5)) / GRID;
        const [vx, vy] = fieldFn(x, y);
        const mag = Math.sqrt(vx * vx + vy * vy);
        const t = Math.min(1, mag / 1.5);
        const c = cLow.clone().lerp(cHigh, t);
        arr[idx++] = c.r;
        arr[idx++] = c.g;
        arr[idx++] = c.b;
      }
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    let idx = 0;
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const x = -EXTENT + (2 * EXTENT * (i + 0.5)) / GRID;
        const y = -EXTENT + (2 * EXTENT * (j + 0.5)) / GRID;
        const [vx, vy] = fieldFn(x, y);
        const mag = Math.sqrt(vx * vx + vy * vy);
        const angle = Math.atan2(vy, vx);
        const scl = Math.min(0.65, mag * 0.6) * (0.85 + 0.15 * Math.sin(t * 0.8 + i + j));

        dummy.position.set(x, 0.01, y);
        dummy.rotation.set(0, -angle + Math.PI / 2, 0);
        dummy.scale.set(scl, scl, scl);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(idx, dummy.matrix);
        idx++;
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <coneGeometry args={[0.18, 0.55, 6]} />
      <meshStandardMaterial vertexColors={false} color="#4FC3F7" emissive="#4FC3F7" emissiveIntensity={0.8} />
      <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
    </instancedMesh>
  );
}

function Particles({ phaseRef }: { phaseRef: React.MutableRefObject<string> }) {
  const posRef = useRef<Float32Array>(null);
  const colRef = useRef<Float32Array>(null);
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);

  const state = useMemo(() => {
    const px = new Float32Array(N_PARTICLES);
    const py = new Float32Array(N_PARTICLES);
    const age = new Float32Array(N_PARTICLES);
    for (let i = 0; i < N_PARTICLES; i++) {
      px[i] = (Math.random() - 0.5) * EXTENT * 2;
      py[i] = (Math.random() - 0.5) * EXTENT * 2;
      age[i] = Math.random() * 5;
    }
    return { px, py, age };
  }, []);

  if (!posRef.current) posRef.current = new Float32Array(N_PARTICLES * 3);
  if (!colRef.current) colRef.current = new Float32Array(N_PARTICLES * 3);

  useFrame((_, delta) => {
    if (!geomRef.current || !posRef.current || !colRef.current) return;
    if (matRef.current) {
      // Hide particles in phase 15 (just the field, no flow yet)
      matRef.current.opacity = phaseRef.current === '15-campo' ? 0 : 0.9;
    }
    const dt = Math.min(delta, 0.05);
    const { px, py, age } = state;

    for (let i = 0; i < N_PARTICLES; i++) {
      const [vx, vy] = fieldFn(px[i], py[i]);
      px[i] += vx * dt * 2.5;
      py[i] += vy * dt * 2.5;
      age[i] += dt;

      if (Math.abs(px[i]) > EXTENT + 1 || Math.abs(py[i]) > EXTENT + 1 || age[i] > 5) {
        const a = Math.random() * Math.PI * 2;
        const r = 1.5 + Math.random() * 2;
        px[i] = Math.cos(a) * r;
        py[i] = Math.sin(a) * r;
        age[i] = 0;
      }

      const alpha = Math.max(0, 1 - age[i] / 5);
      posRef.current[i * 3] = px[i];
      posRef.current[i * 3 + 1] = 0.05;
      posRef.current[i * 3 + 2] = py[i];
      colRef.current[i * 3] = 0.2 + 0.8 * alpha;
      colRef.current[i * 3 + 1] = 0.95 * alpha;
      colRef.current[i * 3 + 2] = 0.35 * alpha;
    }
    (geomRef.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geomRef.current.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <points>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute
          attach="attributes-position"
          count={N_PARTICLES}
          array={posRef.current!}
          itemSize={3}
          args={[posRef.current!, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          count={N_PARTICLES}
          array={colRef.current!}
          itemSize={3}
          args={[colRef.current!, 3]}
        />
      </bufferGeometry>
      <pointsMaterial ref={matRef} size={0.09} vertexColors transparent opacity={0.9} sizeAttenuation />
    </points>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <planeGeometry args={[14, 14]} />
      <meshStandardMaterial color="#070A12" roughness={1} />
    </mesh>
  );
}

function Scene({ phaseRef }: { phaseRef: React.MutableRefObject<string> }) {
  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 6, 0]} intensity={1.2} color="#4FC3F7" distance={16} />
      <pointLight position={[3, 4, 3]} intensity={0.5} color="#34D399" distance={10} />
      <directionalLight position={[2, 8, 3]} intensity={0.4} />
      <Floor />
      <Arrows />
      <Particles phaseRef={phaseRef} />
    </>
  );
}

export default function VectorFieldScene({ phase = '15-campo' }: VectorFieldSceneProps) {
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const captionByPhase: Record<string, string> = {
    '15-campo': 'una flecha en cada punto del espacio',
    '16-div-curl': 'partículas en flujo  ·  ∇·F + ∇×F leen el campo',
    '17-maxwell': 'cuatro ecuaciones describen toda la luz',
  };
  const caption = captionByPhase[phase] ?? '';
  const isMaxwell = phase === '17-maxwell';

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at center, #081018 0%, #03050A 85%)' }}
    >
      <Canvas camera={{ position: [0, 8, 6], fov: 36 }}>
        <Scene phaseRef={phaseRef} />
        <OrbitControls
          enableDamping
          autoRotate
          autoRotateSpeed={0.25}
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 5}
          maxPolarAngle={Math.PI / 3}
          target={[0, 0, 0]}
        />
      </Canvas>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#34D399] tracking-[0.3em] uppercase">
          Campo vectorial · divergencia + rotacional
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">{caption}</div>
      </div>

      {/* Maxwell card on phase 17 — emphasizes that this is the punchline */}
      {isMaxwell && (
        <div className="absolute top-1/2 left-12 -translate-y-1/2 pointer-events-none">
          <div className="px-5 py-3 rounded-md border border-[#34D399]/40 bg-black/40 backdrop-blur-sm">
            <div className="text-[10px] font-mono text-[#34D399] uppercase tracking-[0.2em] mb-2">
              Maxwell · 1865
            </div>
            <div className="text-[15px] text-[#F5F0E8]" style={{ fontFamily: '"Caveat", cursive' }}>
              ∇·E = ρ/ε₀ <br />
              ∇·B = 0 <br />
              ∇×E = −∂B/∂t <br />
              ∇×B = μ₀J + μ₀ε₀ ∂E/∂t
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-8 left-8 pointer-events-none">
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="inline-block w-2 h-2 rounded-full bg-[#4FC3F7] shadow-[0_0_6px_#4FC3F7]" />
          <span className="text-[#94A3B8]">dirección del campo</span>
        </div>
        {phase !== '15-campo' && (
          <div className="flex items-center gap-2 text-[10px] font-mono mt-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-[#34D399] shadow-[0_0_6px_#34D399]" />
            <span className="text-[#94A3B8]">partículas en flujo</span>
          </div>
        )}
      </div>
    </div>
  );
}
