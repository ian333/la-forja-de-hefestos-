import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface IntegralSceneProps {
  phase?: string;
}

const FN = (x: number) => 1.2 * Math.sin(x * 0.9) + 0.6 * Math.cos(x * 1.7) + 1.8;
const X_MIN = -4;
const X_MAX = 4;
const N_CURVE = 200;

function useCurvePoints(): [number, number, number][] {
  return useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= N_CURVE; i++) {
      const x = X_MIN + (X_MAX - X_MIN) * (i / N_CURVE);
      pts.push([x, FN(x), 0]);
    }
    return pts;
  }, []);
}

const MAX_N = 60;

function RiemannBars({ phaseRef, nDisplayRef }: { phaseRef: React.MutableRefObject<string>; nDisplayRef: React.MutableRefObject<number> }) {
  const matGold = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#FDB813', emissive: '#FDB813', emissiveIntensity: 0.5,
    transparent: true, opacity: 0.7, metalness: 0.3, roughness: 0.5,
  }), []);
  const matEdge = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#FDB813', wireframe: true, transparent: true, opacity: 0.4,
  }), []);
  const boxGeom = useMemo(() => new THREE.BoxGeometry(1, 1, 0.15), []);
  const refs = useRef<(THREE.Group | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const phase = phaseRef.current;
    let N = 0;

    if (phase === '06-vuelta') {
      // The "flip the question" beat — no bars yet, just curve + area
      N = 0;
    } else if (phase === '07-riemann') {
      // Convergence beat — animate N from 4 to MAX_N
      const cycle = ((t * 0.12) % 1);
      N = Math.max(4, Math.floor(4 + cycle * (MAX_N - 4)));
    } else if (phase === '08-fundamental') {
      // Fundamental theorem beat — hold at fine resolution
      N = MAX_N;
    } else {
      const cycle = ((t * 0.12) % 1);
      N = Math.max(4, Math.floor(4 + cycle * (MAX_N - 4)));
    }
    nDisplayRef.current = N;

    const dx = N > 0 ? (X_MAX - X_MIN) / N : 1;
    for (let i = 0; i < MAX_N; i++) {
      const g = refs.current[i];
      if (!g) continue;
      if (i < N) {
        const x = X_MIN + dx * (i + 0.5);
        const h = Math.max(0.01, FN(x));
        g.visible = true;
        g.position.set(x, h / 2, 0);
        g.scale.set(dx * 0.95, h, 1);
      } else {
        g.visible = false;
      }
    }
  });

  return (
    <>
      {Array.from({ length: MAX_N }).map((_, i) => (
        <group key={i} ref={el => { refs.current[i] = el; }}>
          <mesh geometry={boxGeom} material={matGold} />
          <mesh geometry={boxGeom} material={matEdge} />
        </group>
      ))}
    </>
  );
}

function AreaGlow() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    (ref.current.material as THREE.MeshBasicMaterial).opacity =
      0.06 + 0.04 * Math.sin(clock.elapsedTime * 0.5);
  });
  return (
    <mesh ref={ref} position={[0, 1.2, -0.2]}>
      <planeGeometry args={[X_MAX - X_MIN, 4]} />
      <meshBasicMaterial color="#FDB813" transparent opacity={0.06} />
    </mesh>
  );
}

function GridFloor() {
  const lines: [number, number, number][][] = useMemo(() => {
    const l: [number, number, number][][] = [];
    for (let x = Math.ceil(X_MIN); x <= Math.floor(X_MAX); x++) {
      l.push([[x, -0.5, 0], [x, 4.5, 0]]);
    }
    for (let y = 0; y <= 4; y++) {
      l.push([[X_MIN, y, 0], [X_MAX, y, 0]]);
    }
    return l;
  }, []);
  return (
    <>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color="#1E293B" lineWidth={0.5} transparent opacity={0.3} />
      ))}
      <Line points={[[X_MIN, 0, 0], [X_MAX, 0, 0]]} color="#334155" lineWidth={1} transparent opacity={0.6} />
    </>
  );
}

function Scene({ phaseRef, nDisplayRef }: { phaseRef: React.MutableRefObject<string>; nDisplayRef: React.MutableRefObject<number> }) {
  const curvePts = useCurvePoints();
  return (
    <>
      <ambientLight intensity={0.22} />
      <pointLight position={[0, 5, 5]} intensity={1.0} color="#FDB813" distance={18} />
      <pointLight position={[-4, 3, 3]} intensity={0.5} color="#4FC3F7" distance={12} />
      <directionalLight position={[3, 6, 4]} intensity={0.35} />
      <GridFloor />
      <AreaGlow />
      <RiemannBars phaseRef={phaseRef} nDisplayRef={nDisplayRef} />
      <Line points={curvePts} color="#4FC3F7" lineWidth={2.8} transparent opacity={0.9} />
    </>
  );
}

export default function IntegralScene({ phase = '07-riemann' }: IntegralSceneProps) {
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const nDisplayRef = useRef(0);
  const nHudRef = useRef<HTMLSpanElement>(null);

  const captionByPhase: Record<string, string> = {
    '06-vuelta': 'dale la vuelta a la pregunta · ¿cuánto se acumuló?',
    '07-riemann': 'N → ∞  ·  rectángulos convergen al área exacta',
    '08-fundamental': 'derivada ↔ integral · operaciones inversas',
  };
  const caption = captionByPhase[phase] ?? '';

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #14110A 0%, #03050A 85%)' }}
    >
      <Canvas
        camera={{ position: [0, 1.8, 9], fov: 36 }}
        onCreated={() => {
          const update = () => {
            if (nHudRef.current) {
              nHudRef.current.textContent = nDisplayRef.current === 0 ? '—' : String(nDisplayRef.current);
            }
            requestAnimationFrame(update);
          };
          update();
        }}
      >
        <Scene phaseRef={phaseRef} nDisplayRef={nDisplayRef} />
        <OrbitControls
          enableDamping
          enableZoom={false}
          enablePan={false}
          enableRotate={false}
          target={[0, 1.5, 0]}
        />
      </Canvas>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#FDB813] tracking-[0.3em] uppercase">
          Integral · sumas de Riemann
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">{caption}</div>
      </div>

      {/* N counter HUD — only on the convergence beat */}
      {phase === '07-riemann' && (
        <div className="absolute top-1/2 left-12 -translate-y-1/2 pointer-events-none">
          <div className="px-5 py-3 rounded-md border border-[#FDB813]/40 bg-black/40 backdrop-blur-sm">
            <div className="text-[10px] font-mono text-[#FDB813] uppercase tracking-[0.2em] mb-1">
              número de rectángulos
            </div>
            <div className="text-[34px] font-bold leading-none text-white">
              N = <span ref={nHudRef}>4</span>
            </div>
            <div className="text-[10px] font-mono text-[#64748B] mt-2">
              N → ∞ ⇒ ∫ exacta
            </div>
          </div>
        </div>
      )}

      {/* Fundamental theorem card on phase 08 */}
      {phase === '08-fundamental' && (
        <div className="absolute top-1/2 left-12 -translate-y-1/2 pointer-events-none">
          <div className="px-5 py-3 rounded-md border border-[#4FC3F7]/40 bg-black/40 backdrop-blur-sm">
            <div className="text-[10px] font-mono text-[#4FC3F7] uppercase tracking-[0.2em] mb-2">
              Teorema Fundamental
            </div>
            <div className="text-[16px] text-[#F5F0E8]" style={{ fontFamily: '"Caveat", cursive' }}>
              d/dx ∫ f(t) dt = f(x) <br />
              ∫ f'(x) dx = f(b) − f(a)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
