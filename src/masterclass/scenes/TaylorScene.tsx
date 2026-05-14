import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface TaylorSceneProps {
  phase?: string;
}

const X_MIN = -5.5;
const X_MAX = 5.5;
const N_PTS = 300;
const TARGET_FN = Math.sin;

function taylorSin(x: number, nTerms: number): number {
  let sum = 0;
  let term = x;
  for (let n = 0; n < nTerms; n++) {
    sum += term;
    term *= -x * x / ((2 * n + 2) * (2 * n + 3));
  }
  return sum;
}

function useTargetCurve(): [number, number, number][] {
  return useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= N_PTS; i++) {
      const x = X_MIN + (X_MAX - X_MIN) * (i / N_PTS);
      pts.push([x, TARGET_FN(x), 0]);
    }
    return pts;
  }, []);
}

function TaylorCurve({ phaseRef, nTermsRef }: { phaseRef: React.MutableRefObject<string>; nTermsRef: React.MutableRefObject<number> }) {
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const positions = useMemo(() => new Float32Array((N_PTS + 1) * 3), []);
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  const phaseStart = useRef(0);
  const lastPhase = useRef('');

  useFrame(({ clock }) => {
    if (!geomRef.current || !matRef.current) return;
    const t = clock.elapsedTime;
    const phase = phaseRef.current;
    if (phase !== lastPhase.current) {
      phaseStart.current = t;
      lastPhase.current = phase;
    }
    const tLocal = t - phaseStart.current;

    let nTerms = 1;
    let visible = true;
    if (phase === '09-taylor-pregunta') {
      // The question beat — hide the Taylor approximation entirely
      visible = false;
      nTerms = 0;
    } else if (phase === '10-taylor-formula') {
      // Fixed at N=1 (just the tangent line) as the formula appears
      nTerms = 1;
    } else {
      // Phase 11-taylor-visual (default) — full sweep N=1..14
      const cycle = (tLocal * 0.075) % 1;
      nTerms = Math.max(1, Math.floor(1 + cycle * 14));
    }
    nTermsRef.current = nTerms;
    matRef.current.opacity = visible ? 0.95 : 0;

    if (visible) {
      for (let i = 0; i <= N_PTS; i++) {
        const x = X_MIN + (X_MAX - X_MIN) * (i / N_PTS);
        const y = taylorSin(x, nTerms);
        const clamped = Math.max(-4, Math.min(4, y));
        positions[i * 3] = x;
        positions[i * 3 + 1] = clamped;
        positions[i * 3 + 2] = 0.01;
      }
      const attr = geomRef.current.attributes.position as THREE.BufferAttribute;
      attr.needsUpdate = true;
    }
  });

  return (
    <line>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute
          attach="attributes-position"
          count={N_PTS + 1}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial ref={matRef} color="#FDB813" transparent opacity={0.95} />
    </line>
  );
}

function NTermsHUD() {
  return null;
}

function GridFloor() {
  const lines: [number, number, number][][] = useMemo(() => {
    const l: [number, number, number][][] = [];
    for (let x = Math.ceil(X_MIN); x <= Math.floor(X_MAX); x++) {
      l.push([[x, -3, 0], [x, 3, 0]]);
    }
    for (let y = -3; y <= 3; y++) {
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
      <Line points={[[0, -3, 0], [0, 3, 0]]} color="#334155" lineWidth={1} transparent opacity={0.6} />
    </>
  );
}

function ConvergenceBand({ phaseRef, nTermsRef }: { phaseRef: React.MutableRefObject<string>; nTermsRef: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const phase = phaseRef.current;
    // Only show in phase 11 — and grow with the N sweep
    if (phase !== '11-taylor-visual') {
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    const n = nTermsRef.current;
    const reach = 1.5 + (n / 14) * 9;
    ref.current.scale.x = reach * 2;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.04 + 0.03 * Math.sin(t * 0.4);
  });
  return (
    <mesh ref={ref} position={[0, 0, -0.1]}>
      <planeGeometry args={[1, 8]} />
      <meshBasicMaterial color="#34D399" transparent opacity={0.05} />
    </mesh>
  );
}

function Scene({ phaseRef, nTermsRef }: { phaseRef: React.MutableRefObject<string>; nTermsRef: React.MutableRefObject<number> }) {
  const targetPts = useTargetCurve();
  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 4, 5]} intensity={0.8} color="#F472B6" distance={16} />
      <pointLight position={[-3, 2, 4]} intensity={0.5} color="#FDB813" distance={12} />
      <directionalLight position={[2, 5, 4]} intensity={0.35} />
      <GridFloor />
      <ConvergenceBand phaseRef={phaseRef} nTermsRef={nTermsRef} />
      <Line points={targetPts} color="#F472B6" lineWidth={2.5} transparent opacity={0.7} />
      <TaylorCurve phaseRef={phaseRef} nTermsRef={nTermsRef} />
      <NTermsHUD />
    </>
  );
}

export default function TaylorScene({ phase = '11-taylor-visual' }: TaylorSceneProps) {
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const nTermsRef = useRef(1);
  const nDisplayRef = useRef<HTMLSpanElement>(null);

  const captionByPhase: Record<string, string> = {
    '09-taylor-pregunta': '¿basta un punto + sus derivadas para reconstruir f?',
    '10-taylor-formula': 'N = 1: la recta tangente',
    '11-taylor-visual': 'N crece → el polinomio persigue a sin(x)',
  };
  const caption = captionByPhase[phase] ?? '';

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at center, #140A18 0%, #03050A 85%)' }}
    >
      <Canvas
        camera={{ position: [0, 0, 10], fov: 36 }}
        onCreated={() => {
          const update = () => {
            if (nDisplayRef.current) {
              nDisplayRef.current.textContent = `N = ${nTermsRef.current}`;
            }
            requestAnimationFrame(update);
          };
          update();
        }}
      >
        <Scene phaseRef={phaseRef} nTermsRef={nTermsRef} />
        <OrbitControls
          enableDamping
          enableZoom={false}
          enablePan={false}
          enableRotate={false}
          target={[0, 0, 0]}
        />
      </Canvas>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#F472B6] tracking-[0.3em] uppercase">
          Serie de Taylor · sin(x)
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">{caption}</div>
      </div>
      <div className="absolute bottom-8 left-8 pointer-events-none">
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="inline-block w-5 h-0.5 bg-[#F472B6]" />
          <span className="text-[#94A3B8]">sin(x) original</span>
        </div>
        {phase !== '09-taylor-pregunta' && (
          <div className="flex items-center gap-3 text-[10px] font-mono mt-1.5">
            <span className="inline-block w-5 h-0.5 bg-[#FDB813]" />
            <span className="text-[#94A3B8]">Taylor · <span ref={nDisplayRef} className="text-white">N = 1</span></span>
          </div>
        )}
      </div>
    </div>
  );
}
