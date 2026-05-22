/**
 * DufloScene — Esther Duflo, Nobel Economía 2019.
 *
 * 6 phases (sceneIdx en el manifest):
 *   0 'duflo/pregunta'  — 1.6 mil millones, tierra con almas brillando
 *   1 'duflo/mito'      — intuiciones que mienten (bubbles fragmentándose)
 *   2 'duflo/rct'       — división aleatoria (split A/B)
 *   3 'duflo/kenya'     — vermífugo, escuela, +25%
 *   4 'duflo/mexico'    — Progresa, casa → escuela, +10%
 *   5 'duflo/cierre'    — Nobel medal + rays
 *
 * Patrón cinema:
 *   • Cámara con leve respiración + lerp entre phases
 *   • PostFX bloom + vignette + chromatic aberration
 *   • Color grading por phase (paleta complementaria)
 *   • Lights con rim + key warm/cool
 */

import { useEffect, useMemo, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
// PostFX deshabilitado: requiere WebGL 2 + EXT_color_buffer_float
// que ANGLE D3D12 NO expone. Render sin bloom pero con GPU RTX 4060 acelerada.
// import PostFX from './_postFX';
import { useRenderClock } from '../render-clock';

interface DufloSceneProps {
  phase: number;
}

const PHASE_PALETTE: Array<{ bg: [string, string]; key: string; rim: string }> = [
  { bg: ['#0a1e3a', '#000'],         key: '#3b82f6', rim: '#fcd34d' },
  { bg: ['#2a0e1a', '#000'],         key: '#f87171', rim: '#fbbf24' },
  { bg: ['#1a0a3a', '#000'],         key: '#c084fc', rim: '#34d399' },
  { bg: ['#2a1a0a', '#000'],         key: '#fcd34d', rim: '#f97316' },
  { bg: ['#2a0e0a', '#000'],         key: '#f59e0b', rim: '#dc2626' },
  { bg: ['#0c1a35', '#000'],         key: '#fffbeb', rim: '#fbbf24' },
];

function SkyDome({ topColor, bottomColor }: { topColor: string; bottomColor: string }) {
  const geometry = useMemo(() => new THREE.SphereGeometry(80, 24, 16), []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uTop: { value: new THREE.Color(topColor) },
      uBot: { value: new THREE.Color(bottomColor) },
    },
    vertexShader: `
      varying vec3 vWP;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWP = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uBot;
      varying vec3 vWP;
      void main() {
        float h = normalize(vWP).y;
        vec3 col = mix(uBot, uTop, smoothstep(-0.4, 0.7, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  }), [topColor, bottomColor]);
  return <mesh geometry={geometry} material={material} />;
}

function MarbleFloor({ color = '#0A0814' }: { color?: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
      <circleGeometry args={[30, 64]} />
      <meshStandardMaterial
        color={color}
        roughness={0.35}
        metalness={0.55}
        emissive={color}
        emissiveIntensity={0.20}
      />
    </mesh>
  );
}

// ─── PHASE 0 · PREGUNTA — tierra con almas brillantes (InstancedMesh)
function PhasePregunta({ t }: { t: number }) {
  const earthRef = useRef<THREE.Mesh>(null);
  const soulsRef = useRef<THREE.InstancedMesh>(null);
  const COUNT = 600;

  // Fibonacci sphere
  const data = useMemo(() => {
    const arr: { x: number; y: number; z: number; phase: number }[] = [];
    for (let i = 0; i < COUNT; i++) {
      const theta = (Math.PI * (1 + Math.sqrt(5))) * i;
      const y = 1 - (i / (COUNT - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      arr.push({
        x: Math.cos(theta) * r * 2.45,
        y: y * 2.45,
        z: Math.sin(theta) * r * 2.45,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }, []);

  useFrame(() => {
    if (!earthRef.current || !soulsRef.current) return;
    earthRef.current.rotation.y = t * 0.12;
    soulsRef.current.rotation.y = t * 0.12;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < COUNT; i++) {
      const d = data[i];
      const pulse = 0.7 + Math.sin(t * 1.5 + d.phase) * 0.3;
      dummy.position.set(d.x, d.y, d.z);
      dummy.scale.setScalar(0.08 * pulse);
      dummy.updateMatrix();
      soulsRef.current.setMatrixAt(i, dummy.matrix);
    }
    soulsRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* Tierra */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[2.4, 64, 64]} />
        <meshStandardMaterial
          color="#1e3a5f"
          emissive="#0a1e3a"
          emissiveIntensity={0.8}
          roughness={0.5}
          metalness={0.4}
        />
      </mesh>
      {/* Atmósfera (sutil halo) */}
      <mesh>
        <sphereGeometry args={[2.55, 32, 32]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.12} side={THREE.BackSide} />
      </mesh>
      {/* Almas — instanced */}
      <instancedMesh ref={soulsRef} args={[undefined, undefined, COUNT]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial color="#fde68a" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// ─── PHASE 1 · MITO — bubbles preconcepción
function PhaseMito({ t }: { t: number }) {
  const BUBBLES = [
    { pos: [-2.6, 1.0, 0],   color: '#fbbf24', label: 'microcrédito' },
    { pos: [-0.8, 2.4, -0.3], color: '#34d399', label: 'mosquito nets baratos' },
    { pos: [1.5, 1.7, 0.2],  color: '#a78bfa', label: 'capacitar maestros' },
    { pos: [2.8, 0.5, -0.1], color: '#f472b6', label: 'cobrar es sostenible' },
  ];
  return (
    <group>
      {BUBBLES.map((b, i) => {
        const popTime = 6 + i * 1.8;
        const popProgress = Math.max(0, Math.min(1, (t - popTime) / 1.4));
        const scale = (1 + Math.sin(t * 1.4 + i) * 0.08) * (1 - popProgress * 0.7) * 0.85;
        const opacity = (1 - popProgress);
        return (
          <group key={i} position={b.pos as [number, number, number]}>
            <mesh scale={scale}>
              <sphereGeometry args={[0.7, 32, 32]} />
              <meshStandardMaterial
                color={b.color}
                emissive={b.color}
                emissiveIntensity={1.5 * (1 - popProgress)}
                transparent
                opacity={opacity * 0.6}
                roughness={0.3}
                metalness={0.3}
              />
            </mesh>
            {/* Halo */}
            <mesh scale={scale * 1.4}>
              <sphereGeometry args={[0.7, 24, 24]} />
              <meshBasicMaterial color={b.color} transparent opacity={opacity * 0.18} side={THREE.BackSide} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ─── PHASE 2 · RCT — 2 InstancedMesh separados (uno por grupo) para evitar issue vertexColors
function PhaseRCT({ t }: { t: number }) {
  const refA = useRef<THREE.InstancedMesh>(null);
  const refB = useRef<THREE.InstancedMesh>(null);
  const NA = 40, NB = 40;
  const dataA = useMemo(() => Array.from({ length: NA }, () => {
    const r = Math.sqrt(Math.random()) * 1.8;
    const a = Math.random() * Math.PI * 2;
    return { ox: Math.cos(a) * r, oy: 0.4 + Math.random() * 0.5, oz: Math.sin(a) * r };
  }), []);
  const dataB = useMemo(() => Array.from({ length: NB }, () => {
    const r = Math.sqrt(Math.random()) * 1.8;
    const a = Math.random() * Math.PI * 2;
    return { ox: Math.cos(a) * r, oy: 0.4 + Math.random() * 0.5, oz: Math.sin(a) * r };
  }), []);

  const splitT = Math.max(0, Math.min(1, (t - 3) / 5));

  useFrame(() => {
    if (!refA.current || !refB.current) return;
    const dummy = new THREE.Object3D();
    // Group A (violet) → left side
    dataA.forEach((d, i) => {
      const targetX = -3.2 + (d.ox % 1.4);
      const targetZ = d.oz * 0.6;
      const x = d.ox + (targetX - d.ox) * splitT;
      const z = d.oz + (targetZ - d.oz) * splitT;
      const pulse = 1 + Math.sin(t * 1.2 + i) * 0.15;
      dummy.position.set(x, d.oy, z);
      dummy.scale.setScalar(0.22 * pulse);
      dummy.updateMatrix();
      refA.current!.setMatrixAt(i, dummy.matrix);
    });
    refA.current.instanceMatrix.needsUpdate = true;
    // Group B (green) → right side
    dataB.forEach((d, i) => {
      const targetX = 3.2 + (d.ox % 1.4);
      const targetZ = d.oz * 0.6;
      const x = d.ox + (targetX - d.ox) * splitT;
      const z = d.oz + (targetZ - d.oz) * splitT;
      const pulse = 1 + Math.sin(t * 1.2 + i + 1.5) * 0.15;
      dummy.position.set(x, d.oy, z);
      dummy.scale.setScalar(0.22 * pulse);
      dummy.updateMatrix();
      refB.current!.setMatrixAt(i, dummy.matrix);
    });
    refB.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={refA} args={[undefined, undefined, NA]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#a78bfa" emissive="#7c3aed" emissiveIntensity={1.4} roughness={0.4} metalness={0.3} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={refB} args={[undefined, undefined, NB]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#34d399" emissive="#10b981" emissiveIntensity={1.4} roughness={0.4} metalness={0.3} toneMapped={false} />
      </instancedMesh>
      {/* Línea divisoria luminosa */}
      <mesh position={[0, 0.5, 0]} scale={[0.08, 1.4, 4.5]}>
        <boxGeometry />
        <meshBasicMaterial color="#fde68a" transparent opacity={splitT * 0.9} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ─── PHASE 3 · KENYA — escuela + pastilla + niños + arrow up
function PhaseKenya({ t }: { t: number }) {
  const pillScale = 0.7 + 0.2 * Math.sin(t * 1.8);
  const chartT = Math.max(0, Math.min(1, (t - 10) / 5));
  return (
    <group>
      {/* Escuela rural - adobe + techo */}
      <group position={[0, 0, -1.5]}>
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[3.4, 1.4, 1.8]} />
          <meshStandardMaterial color="#8a5a30" emissive="#3a1a08" emissiveIntensity={0.4} roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.8, 0]} rotation={[0, Math.PI/4, 0]}>
          <coneGeometry args={[2.6, 1.0, 4]} />
          <meshStandardMaterial color="#5a3a20" emissive="#2a1a08" emissiveIntensity={0.3} roughness={0.8} />
        </mesh>
        {/* Ventanas iluminadas */}
        <mesh position={[-0.9, 0.7, 0.91]}>
          <planeGeometry args={[0.5, 0.5]} />
          <meshBasicMaterial color="#fde68a" toneMapped={false} />
        </mesh>
        <mesh position={[0.9, 0.7, 0.91]}>
          <planeGeometry args={[0.5, 0.5]} />
          <meshBasicMaterial color="#fde68a" toneMapped={false} />
        </mesh>
      </group>
      {/* Pastilla flotando + halo */}
      <group position={[0, 0.5, 1.5]}>
        <mesh scale={pillScale}>
          <capsuleGeometry args={[0.28, 0.45, 12, 24]} />
          <meshStandardMaterial color="#ffffff" emissive="#fcd34d" emissiveIntensity={0.8} roughness={0.2} metalness={0.5} />
        </mesh>
        <mesh scale={pillScale * 1.8}>
          <sphereGeometry args={[0.5, 24, 24]} />
          <meshBasicMaterial color="#fde68a" transparent opacity={0.12} side={THREE.BackSide} toneMapped={false} />
        </mesh>
      </group>
      {/* Niños orbitando */}
      {Array.from({ length: 7 }).map((_, i) => {
        const angle = (i / 7) * Math.PI * 2 + t * 0.15;
        const r = 3.5;
        return (
          <mesh key={i} position={[Math.cos(angle) * r, 0.35, Math.sin(angle) * r * 0.6 + 1.5]} scale={0.3}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={1.4} />
          </mesh>
        );
      })}
      {/* Arrow chart +25% */}
      <group position={[4.5, 2 + chartT * 1.5, 0]} scale={chartT}>
        <mesh>
          <coneGeometry args={[0.35, 1.0, 4]} />
          <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={0.9} />
        </mesh>
      </group>
    </group>
  );
}

// ─── PHASE 4 · MÉXICO — casa adobe + monedas viajando + escuela + arrow
function PhaseMexico({ t }: { t: number }) {
  const transferT = Math.max(0, Math.min(1, (t - 5) / 5));
  return (
    <group>
      {/* Casa rural mexicana */}
      <group position={[-3.5, 0, 0]}>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[1.8, 1.2, 1.6]} />
          <meshStandardMaterial color="#a16940" emissive="#4a2810" emissiveIntensity={0.4} roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.5, 0]} rotation={[0, Math.PI/4, 0]}>
          <coneGeometry args={[1.5, 0.8, 4]} />
          <meshStandardMaterial color="#8a4a28" roughness={0.8} />
        </mesh>
      </group>
      {/* Escuela */}
      <group position={[3.5, 0, 0]}>
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[2.0, 1.4, 1.7]} />
          <meshStandardMaterial color="#d4a373" emissive="#5a3a18" emissiveIntensity={0.4} roughness={0.6} />
        </mesh>
        <mesh position={[-0.5, 0.7, 0.86]}>
          <planeGeometry args={[0.5, 0.5]} />
          <meshBasicMaterial color="#fde68a" toneMapped={false} />
        </mesh>
        <mesh position={[0.5, 0.7, 0.86]}>
          <planeGeometry args={[0.5, 0.5]} />
          <meshBasicMaterial color="#fde68a" toneMapped={false} />
        </mesh>
      </group>
      {/* Monedas viajando */}
      {[0, 1, 2].map(i => {
        const delay = i * 0.5;
        const localT = Math.max(0, Math.min(1, (t - 5 - delay) / 1.8));
        const x = -2.5 + localT * 5;
        const y = 0.7 + Math.sin(localT * Math.PI) * 1.6;
        const rot = t * 4;
        return (
          <mesh key={i} position={[x, y, 0]} rotation={[0, rot, Math.PI / 2]} scale={0.6}>
            <cylinderGeometry args={[0.22, 0.22, 0.05, 32]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} metalness={0.9} roughness={0.15} />
          </mesh>
        );
      })}
      {/* Niño viajando */}
      <mesh position={[-2 + transferT * 5, 0.4 + transferT * 0.3, 1.2]} scale={0.35}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#fde68a" emissive="#fde68a" emissiveIntensity={1.4} />
      </mesh>
      {/* Arrow +10% */}
      <group position={[0, 3.2 + transferT * 0.4, 0]} scale={transferT}>
        <mesh>
          <coneGeometry args={[0.28, 0.85, 4]} />
          <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={0.9} />
        </mesh>
      </group>
    </group>
  );
}

// ─── PHASE 5 · CIERRE — Nobel medal + rays
function PhaseCierre({ t }: { t: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const medalScale = Math.min(1, t / 3);
  useFrame(() => {
    if (groupRef.current) groupRef.current.rotation.z = t * 0.18;
  });
  return (
    <group>
      {/* 16 rayos dorados rotando */}
      <group ref={groupRef}>
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i / 16) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(angle) * 2.8, Math.sin(angle) * 2.8, -1]} rotation={[0, 0, angle]}>
              <planeGeometry args={[0.4, 5]} />
              <meshBasicMaterial
                color="#fde68a"
                transparent
                opacity={0.35 * medalScale}
                toneMapped={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          );
        })}
      </group>
      {/* Medalla dorada */}
      <mesh position={[0, 0, 0]} scale={medalScale * 0.9} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1, 1, 0.18, 64]} />
        <meshStandardMaterial color="#fcd34d" emissive="#fbbf24" emissiveIntensity={0.6} metalness={0.95} roughness={0.12} />
      </mesh>
      {/* Cinta azul */}
      <mesh position={[0, 1.2, -0.1]} scale={medalScale * 0.65}>
        <boxGeometry args={[0.7, 1.6, 0.06]} />
        <meshStandardMaterial color="#1e3a5f" emissive="#0a1e3a" emissiveIntensity={0.5} />
      </mesh>
      {/* Halo general */}
      <mesh position={[0, 0.3, -0.3]} scale={medalScale * 4}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.10} side={THREE.BackSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CameraRig({ phase, tInScene }: { phase: number; tInScene: number }) {
  const targetPos: Record<number, [number, number, number]> = {
    0: [0, 0.5, 8],
    1: [0, 1.3, 7],
    2: [0, 1.5, 9],     // frontal — marbles visibles laterales
    3: [0, 2.0, 7],     // frente, no diagonal
    4: [0, 2.0, 8],     // mismo approach
    5: [0, 0.5, 10],    // alejado para que medalla quepa
  };
  const tgtLookAt: Record<number, [number, number, number]> = {
    0: [0, 0, 0],
    1: [0, 1.5, 0],
    2: [0, 0.5, 0],
    3: [0, 0.7, 0],
    4: [0, 0.7, 0],
    5: [0, 0.4, 0],
  };
  const pos = targetPos[phase] ?? [0, 1, 7];
  const look = tgtLookAt[phase] ?? [0, 0, 0];
  useFrame(({ camera }) => {
    const breath = Math.sin(tInScene * 0.15) * 0.2;
    camera.position.lerp(new THREE.Vector3(pos[0] + breath * 0.5, pos[1] + breath * 0.1, pos[2]), 0.04);
    camera.lookAt(look[0], look[1], look[2]);
  });
  return null;
}

function SceneRoot({ phase }: { phase: number }) {
  const { isDeterministic, tInScene } = useRenderClock();
  const wallTRef = useRef(0);
  useFrame(({ clock }) => { wallTRef.current = clock.elapsedTime; });
  const t = isDeterministic ? tInScene : wallTRef.current;
  const pal = PHASE_PALETTE[phase] ?? PHASE_PALETTE[0];

  return (
    <>
      <SkyDome topColor={pal.bg[0]} bottomColor={pal.bg[1]} />
      <MarbleFloor />

      <ambientLight intensity={0.30} />
      <pointLight position={[-4, 5, 3]} intensity={2.2} color={pal.key} distance={25} />
      <pointLight position={[4, 4, 2]} intensity={1.5} color={pal.rim} distance={20} />
      <directionalLight position={[0, 10, 5]} intensity={0.5} />

      {phase === 0 && <PhasePregunta t={t} />}
      {phase === 1 && <PhaseMito t={t} />}
      {phase === 2 && <PhaseRCT t={t} />}
      {phase === 3 && <PhaseKenya t={t} />}
      {phase === 4 && <PhaseMexico t={t} />}
      {phase === 5 && <PhaseCierre t={t} />}

      <CameraRig phase={phase} tInScene={t} />
      {/* PostFX disabled — WebGL 1.0 D3D12 backend no soporta EXT_color_buffer_float */}
    </>
  );
}

// ANGLE D3D12 (--use-angle=gl en WSL2) solo expone WebGL 1.0. Si Three.js
// intenta WebGL 2 falla. Forzamos WebGL 1 deshabilitando el context type
// 'webgl2' en HTMLCanvasElement.
if (typeof window !== 'undefined' && !(window as any).__webgl1_forced) {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type: string, ...args: any[]) {
    if (type === 'webgl2') return null;
    return (orig as any).call(this, type, ...args);
  } as any;
  (window as any).__webgl1_forced = true;
}

export default function DufloScene({ phase }: DufloSceneProps) {
  return (
    <div className="w-full h-full" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [0, 1, 8], fov: 38 }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <SceneRoot phase={phase} />
        </Suspense>
      </Canvas>
    </div>
  );
}
