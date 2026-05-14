import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface DerivativeSceneProps {
  phase?: string;
}

const CURVE_FN = (x: number) => Math.sin(x * 0.8) * 1.6 + 0.3 * Math.sin(x * 2.1);
const CURVE_DFN = (x: number) => 0.8 * Math.cos(x * 0.8) * 1.6 + 2.1 * 0.3 * Math.cos(x * 2.1);
const X_MIN = -5;
const X_MAX = 5;
const N_PTS = 200;

function useCurvePoints(): [number, number, number][] {
  return useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= N_PTS; i++) {
      const x = X_MIN + (X_MAX - X_MIN) * (i / N_PTS);
      pts.push([x, CURVE_FN(x), 0]);
    }
    return pts;
  }, []);
}

function TangentProbe() {
  const sphereRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<THREE.Group>(null);
  const tangentPts = useRef<[number, number, number][]>([[0, 0, 0], [1, 0, 0]]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const x = X_MIN + 1.5 + (X_MAX - X_MIN - 3) * (0.5 + 0.5 * Math.sin(t * 0.35));
    const y = CURVE_FN(x);
    const slope = CURVE_DFN(x);

    if (sphereRef.current) {
      sphereRef.current.position.set(x, y, 0);
    }

    const len = 1.8;
    const dx = len / Math.sqrt(1 + slope * slope);
    tangentPts.current = [
      [x - dx, y - slope * dx, 0],
      [x + dx, y + slope * dx, 0],
    ];
  });

  return (
    <group ref={lineRef}>
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.1, 20, 20]} />
        <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={2.5} />
      </mesh>
      <TangentLine ptsRef={tangentPts} />
    </group>
  );
}

function TangentLine({ ptsRef }: { ptsRef: React.MutableRefObject<[number, number, number][]> }) {
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const positions = useMemo(() => new Float32Array(6), []);

  useFrame(() => {
    if (!geomRef.current) return;
    const [a, b] = ptsRef.current;
    positions[0] = a[0]; positions[1] = a[1]; positions[2] = a[2];
    positions[3] = b[0]; positions[4] = b[1]; positions[5] = b[2];
    const attr = geomRef.current.attributes.position as THREE.BufferAttribute;
    attr.needsUpdate = true;
  });

  return (
    <line>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute
          attach="attributes-position"
          count={2}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#FDB813" linewidth={2} transparent opacity={0.9} />
    </line>
  );
}

function SecantGhost({ phaseRef, hValueRef }: { phaseRef: React.MutableRefObject<string>; hValueRef: React.MutableRefObject<number> }) {
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const positions = useMemo(() => new Float32Array(6), []);
  const matRef = useRef<THREE.LineBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (!geomRef.current || !matRef.current) return;
    const t = clock.elapsedTime;
    const phase = phaseRef.current;
    const x = X_MIN + 1.5 + (X_MAX - X_MIN - 3) * (0.5 + 0.5 * Math.sin(t * 0.35));

    // Phase-specific h behavior
    let h = 0.4 + 1.2 * (0.5 + 0.5 * Math.sin(t * 0.7));
    let visible = true;
    let opacityBoost = 0;
    if (phase === '03-tangente') {
      // Just show a static-ish secant — h is more moderate
      h = 0.5 + 0.4 * (0.5 + 0.5 * Math.sin(t * 0.5));
    } else if (phase === '04-h-cero') {
      // Dramatic h → 0 sweep: large h decaying to tiny then resetting
      const cycle = (t * 0.25) % 1; // 4s cycle
      h = 2.0 * Math.pow(1 - cycle, 1.5) + 0.05;
      opacityBoost = 0.3; // make secant much more visible during this beat
    } else if (phase === '05-funciones') {
      // Skip the secant ghost; emphasis is on the tangent + different functions
      visible = false;
    }

    hValueRef.current = h;
    matRef.current.opacity = visible ? (0.15 + 0.2 * (h / 1.6) + opacityBoost) : 0;

    if (!visible) return;
    const y1 = CURVE_FN(x);
    const y2 = CURVE_FN(x + h);
    positions[0] = x - 1; positions[1] = y1 - (y2 - y1) / h; positions[2] = 0;
    positions[3] = x + h + 1; positions[4] = y2 + (y2 - y1) / h; positions[5] = 0;
    const attr = geomRef.current.attributes.position as THREE.BufferAttribute;
    attr.needsUpdate = true;
  });

  return (
    <line>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute
          attach="attributes-position"
          count={2}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial ref={matRef} color="#F472B6" transparent opacity={0.25} />
    </line>
  );
}

function GridFloor() {
  const lines: [number, number, number][][] = useMemo(() => {
    const l: [number, number, number][][] = [];
    for (let x = Math.ceil(X_MIN); x <= Math.floor(X_MAX); x++) {
      l.push([[x, -3, 0], [x, 4, 0]]);
    }
    for (let y = -3; y <= 4; y++) {
      l.push([[X_MIN, y, 0], [X_MAX, y, 0]]);
    }
    return l;
  }, []);

  return (
    <>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color="#1E293B" lineWidth={0.6} transparent opacity={0.4} />
      ))}
      <Line points={[[X_MIN, 0, 0], [X_MAX, 0, 0]]} color="#334155" lineWidth={1} transparent opacity={0.7} />
      <Line points={[[0, -3, 0], [0, 4, 0]]} color="#334155" lineWidth={1} transparent opacity={0.7} />
    </>
  );
}

function GlowOrb({ position, color, size = 0.06 }: { position: [number, number, number]; color: string; size?: number }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[size, 12, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} />
    </mesh>
  );
}

function Scene({ phaseRef, hValueRef }: { phaseRef: React.MutableRefObject<string>; hValueRef: React.MutableRefObject<number> }) {
  const curvePts = useCurvePoints();

  return (
    <>
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 4, 5]} intensity={1.0} color="#4FC3F7" distance={18} />
      <pointLight position={[-3, 2, 3]} intensity={0.6} color="#FDB813" distance={14} />
      <directionalLight position={[2, 5, 4]} intensity={0.4} />
      <GridFloor />
      <Line points={curvePts} color="#4FC3F7" lineWidth={2.5} transparent opacity={0.85} />
      <SecantGhost phaseRef={phaseRef} hValueRef={hValueRef} />
      <TangentProbe />
      <GlowOrb position={[X_MIN + 0.1, CURVE_FN(X_MIN + 0.1), 0]} color="#4FC3F7" />
      <GlowOrb position={[X_MAX - 0.1, CURVE_FN(X_MAX - 0.1), 0]} color="#4FC3F7" />
    </>
  );
}

export default function DerivativeScene({ phase = '03-tangente' }: DerivativeSceneProps) {
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const hValueRef = useRef(1.0);
  const hHudRef = useRef<HTMLSpanElement>(null);

  const captionByPhase: Record<string, string> = {
    '03-tangente': 'recta tangente · pendiente local',
    '04-h-cero': 'h → 0  ·  secante se vuelve tangente',
    '05-funciones': 'cualquier función suave tiene su derivada',
  };
  const caption = captionByPhase[phase] ?? '';
  const showHHud = phase === '04-h-cero';

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at center, #0A1628 0%, #03050A 85%)' }}
    >
      <Canvas
        camera={{ position: [0, 0.5, 9], fov: 38 }}
        onCreated={() => {
          const update = () => {
            if (hHudRef.current) hHudRef.current.textContent = `h = ${hValueRef.current.toFixed(2)}`;
            requestAnimationFrame(update);
          };
          update();
        }}
      >
        <Scene phaseRef={phaseRef} hValueRef={hValueRef} />
        <OrbitControls
          enableDamping
          enableZoom={false}
          enablePan={false}
          enableRotate={false}
          target={[0, 0.5, 0]}
        />
      </Canvas>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#4FC3F7] tracking-[0.3em] uppercase">
          Derivada · recta tangente
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">{caption}</div>
      </div>

      {showHHud && (
        <div className="absolute top-1/2 left-12 -translate-y-1/2 pointer-events-none">
          <div className="px-5 py-3 rounded-md border border-[#F472B6]/40 bg-black/40 backdrop-blur-sm">
            <div className="text-[10px] font-mono text-[#F472B6] uppercase tracking-[0.2em] mb-1">
              variable h
            </div>
            <div className="text-[28px] font-bold leading-none text-white">
              <span ref={hHudRef}>h = 1.00</span>
            </div>
            <div className="text-[10px] font-mono text-[#64748B] mt-2">
              h → 0 ⇒ secante = tangente
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-8 left-8 pointer-events-none">
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="inline-block w-5 h-0.5 bg-[#4FC3F7]" />
          <span className="text-[#94A3B8]">f(x) original</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono mt-1.5">
          <span className="inline-block w-5 h-0.5 bg-[#FDB813]" />
          <span className="text-[#94A3B8]">tangente · f'(x)</span>
        </div>
        {phase !== '05-funciones' && (
          <div className="flex items-center gap-3 text-[10px] font-mono mt-1.5">
            <span className="inline-block w-5 h-0.5 bg-[#F472B6]/60" />
            <span className="text-[#94A3B8]">secante · gap = h</span>
          </div>
        )}
      </div>
    </div>
  );
}
