import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Phase-aware matrix-cube scene.
 *
 *   '03-matriz-transformacion' → one gentle preset cycling slowly, no swarm
 *   '04-columnas-aterrizan'    → emphasize the 3 column arrows + labels
 *   '05-determinante'          → include the singular preset, HUD shows det
 *   '06-todo-rota'             → adds a swarm of random vectors that visibly
 *                                 rotate as A is applied (sets up eigen)
 */

interface MatrixCubeSceneProps {
  phase?: string;
}

type Mat3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

const I3: Mat3 = [[1,0,0],[0,1,0],[0,0,1]];

const PRESETS: { name: string; M: Mat3; det: number }[] = [
  { name: 'identidad',         M: I3,                                                                          det: 1 },
  { name: 'rotación 45° Y',    M: [[Math.cos(Math.PI/4),0,Math.sin(Math.PI/4)],[0,1,0],[-Math.sin(Math.PI/4),0,Math.cos(Math.PI/4)]], det: 1 },
  { name: 'escala 1.6×',       M: [[1.6,0,0],[0,1.2,0],[0,0,0.7]],                                            det: 1.344 },
  { name: 'cizalla en x',      M: [[1,0.6,0.3],[0,1,0],[0,0,1]],                                              det: 1 },
  { name: 'reflexión y',       M: [[1,0,0],[0,-1,0],[0,0,1]],                                                 det: -1 },
  { name: 'singular (rank 2)', M: [[1,0.5,0],[0.6,0.3,0],[0,0,0]],                                            det: 0 },
];

// Phase-specific preset cycles
const PHASE_PRESETS: Record<string, number[]> = {
  '03-matriz-transformacion': [0, 1],          // identity ↔ rotation, gentle
  '04-columnas-aterrizan':    [0, 1, 2],       // identity → rotation → scale
  '05-determinante':          [0, 2, 5, 4],    // identity, scale (det≈1.34), singular (det=0), reflection (det=-1)
  '06-todo-rota':             [0, 1, 3, 2],    // identity, rotation, shear, scale
};

function lerpMat(A: Mat3, B: Mat3, t: number): Mat3 {
  const r: Mat3 = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i=0;i<3;i++) for (let j=0;j<3;j++) r[i][j] = A[i][j] + (B[i][j] - A[i][j]) * t;
  return r;
}

function applyMat(M: Mat3, v: [number,number,number]): [number,number,number] {
  return [
    M[0][0]*v[0] + M[0][1]*v[1] + M[0][2]*v[2],
    M[1][0]*v[0] + M[1][1]*v[1] + M[1][2]*v[2],
    M[2][0]*v[0] + M[2][1]*v[1] + M[2][2]*v[2],
  ];
}

function detMat(M: Mat3): number {
  return (
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
    - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
    + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
  );
}

const CUBE_VERTS: [number,number,number][] = [
  [0,0,0],[1,0,0],[1,1,0],[0,1,0],
  [0,0,1],[1,0,1],[1,1,1],[0,1,1],
];
const CUBE_EDGES: [number,number][] = [
  [0,1],[1,2],[2,3],[3,0],
  [4,5],[5,6],[6,7],[7,4],
  [0,4],[1,5],[2,6],[3,7],
];

const AXIS_COLORS = ['#F87171', '#4ADE80', '#60A5FA'] as const;

function ColumnArrow({ axisRef, color }: { axisRef: (g: THREE.Group | null) => void; color: string }) {
  return (
    <group ref={axisRef}>
      <mesh position={[0, 0, 0.5]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.0} />
      </mesh>
      <mesh position={[0, 0, 1.0]} rotation={[Math.PI/2, 0, 0]}>
        <coneGeometry args={[0.11, 0.24, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.4} />
      </mesh>
    </group>
  );
}

function GenericVectorSwarm({ phaseRef, matRef }: { phaseRef: React.MutableRefObject<string>; matRef: React.MutableRefObject<Mat3> }) {
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const baseDirs = useMemo(() => {
    const dirs: THREE.Vector3[] = [];
    let seed = 7777;
    for (let i = 0; i < 10; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const u = ((seed / 0x7fffffff) - 0.5) * 2;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const v = seed / 0x7fffffff;
      const theta = u * Math.PI;
      const phi = Math.acos(2 * v - 1);
      dirs.push(new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi),
      ));
    }
    return dirs;
  }, []);

  useFrame(() => {
    const M = matRef.current;
    const visible = phaseRef.current === '06-todo-rota';
    groupRefs.current.forEach((g, i) => {
      if (!g) return;
      g.visible = visible;
      if (!visible) return;
      const base = baseDirs[i];
      const tip = applyMat(M, [base.x, base.y, base.z]);
      const dir = new THREE.Vector3(...tip);
      const len = dir.length();
      if (len > 0.001) {
        const dirN = dir.clone().normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), dirN);
        g.quaternion.copy(q);
        g.scale.set(1, 1, len);
      } else {
        g.scale.set(0.001, 0.001, 0.001);
      }
    });
  });

  return (
    <>
      {baseDirs.map((_, i) => (
        <group key={i} ref={el => { groupRefs.current[i] = el; }} visible={false}>
          <mesh position={[0, 0, 0.5]} rotation={[Math.PI/2, 0, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 1, 6]} />
            <meshStandardMaterial color="#94A3B8" emissive="#475569" emissiveIntensity={0.4} transparent opacity={0.7} />
          </mesh>
          <mesh position={[0, 0, 1.0]} rotation={[Math.PI/2, 0, 0]}>
            <coneGeometry args={[0.05, 0.10, 8]} />
            <meshStandardMaterial color="#CBD5E1" emissive="#94A3B8" emissiveIntensity={0.5} transparent opacity={0.85} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function AnimatedCube({ phaseRef, matRef, hudRef }: {
  phaseRef: React.MutableRefObject<string>;
  matRef: React.MutableRefObject<Mat3>;
  hudRef: React.MutableRefObject<HTMLSpanElement | null>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const edgesRef = useRef<(THREE.Mesh | null)[]>([]);
  const axisRefs = useRef<(THREE.Group | null)[]>([null, null, null]);
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

    const sequence = PHASE_PRESETS[phase] ?? PHASE_PRESETS['03-matriz-transformacion'];
    const cyclePeriod = phase === '03-matriz-transformacion' ? 7.5 : 5.5;
    const N = sequence.length;
    const cycle = (tLocal % (cyclePeriod * N)) / cyclePeriod;
    const cur = Math.floor(cycle) % N;
    const next = (cur + 1) % N;
    const local = cycle - Math.floor(cycle);
    const blend = local < 0.3 ? local / 0.3 : 1;
    const A = PRESETS[sequence[cur]].M;
    const B = PRESETS[sequence[next]].M;
    const M = lerpMat(A, B, blend);
    matRef.current = M;

    // Update HUD det
    if (hudRef.current && phase === '05-determinante') {
      const det = detMat(M);
      hudRef.current.textContent = det.toFixed(2);
      hudRef.current.style.color = det > 0.1 ? '#34D399' : det < -0.1 ? '#F472B6' : '#FDB813';
    }

    // Edges
    CUBE_EDGES.forEach(([a, b], i) => {
      const ref = edgesRef.current[i];
      if (!ref) return;
      const va = applyMat(M, [CUBE_VERTS[a][0]-0.5, CUBE_VERTS[a][1]-0.5, CUBE_VERTS[a][2]-0.5]);
      const vb = applyMat(M, [CUBE_VERTS[b][0]-0.5, CUBE_VERTS[b][1]-0.5, CUBE_VERTS[b][2]-0.5]);
      const mid: [number,number,number] = [(va[0]+vb[0])/2, (va[1]+vb[1])/2, (va[2]+vb[2])/2];
      const dir = new THREE.Vector3(vb[0]-va[0], vb[1]-va[1], vb[2]-va[2]);
      const len = dir.length();
      ref.position.set(mid[0], mid[1], mid[2]);
      const up = new THREE.Vector3(0,1,0);
      const dirN = dir.clone().normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(up, dirN);
      ref.quaternion.copy(q);
      ref.scale.set(1, Math.max(0.001, len), 1);
    });

    // Column axes
    [0, 1, 2].forEach(c => {
      const a = axisRefs.current[c];
      if (!a) return;
      const dir = new THREE.Vector3(M[0][c], M[1][c], M[2][c]);
      const len = dir.length();
      a.position.set(0, 0, 0);
      if (len > 0.001) {
        const dirN = dir.clone().normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), dirN);
        a.quaternion.copy(q);
        a.scale.set(1, 1, len);
      } else {
        a.scale.set(0.001, 0.001, 0.001);
      }
    });

    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.12;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0,0,0]}>
        <boxGeometry args={[1,1,1]} />
        <meshBasicMaterial color="#334155" wireframe transparent opacity={0.22} />
      </mesh>
      {CUBE_EDGES.map((_, i) => (
        <mesh key={i} ref={el => { edgesRef.current[i] = el; }}>
          <cylinderGeometry args={[0.018, 0.018, 1, 6]} />
          <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={1.5} />
        </mesh>
      ))}
      <ColumnArrow color={AXIS_COLORS[0]} axisRef={el => { axisRefs.current[0] = el; }} />
      <ColumnArrow color={AXIS_COLORS[1]} axisRef={el => { axisRefs.current[1] = el; }} />
      <ColumnArrow color={AXIS_COLORS[2]} axisRef={el => { axisRefs.current[2] = el; }} />
    </group>
  );
}

function GridFloor() {
  const lines = useMemo(() => {
    const l: [number,number,number][][] = [];
    for (let i = -3; i <= 3; i++) {
      l.push([[i, -1.5, -3], [i, -1.5, 3]]);
      l.push([[-3, -1.5, i], [3, -1.5, i]]);
    }
    return l;
  }, []);
  return (
    <>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color="#1E3A5F" lineWidth={0.5} transparent opacity={0.3} />
      ))}
    </>
  );
}

export default function MatrixCubeScene({ phase = '03-matriz-transformacion' }: MatrixCubeSceneProps) {
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const matRef = useRef<Mat3>(I3);
  const detHudRef = useRef<HTMLSpanElement | null>(null);

  const captionByPhase: Record<string, string> = {
    '03-matriz-transformacion': 'el cubo unitario aterriza en A·cubo',
    '04-columnas-aterrizan': 'las 3 columnas = donde aterrizan î, ĵ, k̂',
    '05-determinante': 'det(A) = factor de volumen',
    '06-todo-rota': 'los vectores rotan + estiran  ·  ¿alguno se libra?',
  };
  const caption = captionByPhase[phase] ?? '';

  const showColumnEmphasis = phase === '04-columnas-aterrizan';
  const showDetHud = phase === '05-determinante';
  const showSwarmLegend = phase === '06-todo-rota';

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #0C0820 0%, #03050A 85%)' }}
    >
      <Canvas camera={{ position: [3.2, 2.4, 3.8], fov: 38 }}>
        <ambientLight intensity={0.32} />
        <pointLight position={[3, 4, 3]} intensity={1.0} color="#FDB813" distance={14} />
        <pointLight position={[-3, 2, 4]} intensity={0.6} color="#7E57C2" distance={12} />
        <directionalLight position={[2, 5, 4]} intensity={0.45} />
        <GridFloor />
        <AnimatedCube phaseRef={phaseRef} matRef={matRef} hudRef={detHudRef} />
        <GenericVectorSwarm phaseRef={phaseRef} matRef={matRef} />
        <OrbitControls
          enableDamping
          autoRotate
          autoRotateSpeed={0.25}
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI/4}
          maxPolarAngle={Math.PI/2.3}
          target={[0, 0, 0]}
        />
      </Canvas>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#7E57C2] tracking-[0.3em] uppercase">
          Matriz como transformación
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">{caption}</div>
      </div>

      {/* Determinant HUD — only in phase 05 */}
      {showDetHud && (
        <div className="absolute top-1/2 left-12 -translate-y-1/2 pointer-events-none">
          <div className="px-5 py-3 rounded-md border border-[#FDB813]/40 bg-black/40 backdrop-blur-sm">
            <div className="text-[10px] font-mono text-[#FDB813] uppercase tracking-[0.2em] mb-1">
              determinante
            </div>
            <div className="text-[34px] font-bold leading-none">
              det(A) = <span ref={detHudRef}>1.00</span>
            </div>
            <div className="text-[10px] font-mono text-[#64748B] mt-2">
              factor de volumen
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-8 left-8 pointer-events-none">
        {showColumnEmphasis ? (
          // Phase 04 — big emphatic label
          <>
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#FDB813] mb-2">
              ¡las columnas dicen todo!
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono mb-1">
              <span className="inline-block w-4 h-4 rounded-full bg-[#F87171] shadow-[0_0_10px_#F87171]" />
              <span className="text-white font-bold">A·î = (a₁₁, a₂₁, a₃₁)</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono mb-1">
              <span className="inline-block w-4 h-4 rounded-full bg-[#4ADE80] shadow-[0_0_10px_#4ADE80]" />
              <span className="text-white font-bold">A·ĵ = (a₁₂, a₂₂, a₃₂)</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="inline-block w-4 h-4 rounded-full bg-[#60A5FA] shadow-[0_0_10px_#60A5FA]" />
              <span className="text-white font-bold">A·k̂ = (a₁₃, a₂₃, a₃₃)</span>
            </div>
          </>
        ) : showSwarmLegend ? (
          <>
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#FDB813] mb-2">
              10 vectores genéricos
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono mb-1">
              <span className="inline-block w-3 h-3 rounded-full bg-[#94A3B8] shadow-[0_0_4px_#94A3B8]" />
              <span className="text-[#94A3B8]">rotan + estiran al aplicar A</span>
            </div>
            <div className="text-[10px] font-mono text-[#64748B] mt-1">
              ¿habrá uno que A no gire?
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[10px] font-mono mb-1">
              <span className="inline-block w-3 h-3 rounded-full bg-[#F87171] shadow-[0_0_6px_#F87171]" />
              <span className="text-[#94A3B8]">columna 1 · A·î</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono mb-1">
              <span className="inline-block w-3 h-3 rounded-full bg-[#4ADE80] shadow-[0_0_6px_#4ADE80]" />
              <span className="text-[#94A3B8]">columna 2 · A·ĵ</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="inline-block w-3 h-3 rounded-full bg-[#60A5FA] shadow-[0_0_6px_#60A5FA]" />
              <span className="text-[#94A3B8]">columna 3 · A·k̂</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
