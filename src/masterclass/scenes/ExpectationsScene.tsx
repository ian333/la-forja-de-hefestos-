/**
 * ExpectationsScene — Phillips curve dinámica con expectativas.
 *
 * Visualización cinemática:
 *   • Chart 3D con curvas SRPC como tubos brillantes que PULSAN cuando π_e cambia.
 *   • Vertical LRPC dorada con resplandor.
 *   • Punto economía con estela de partículas y wake con rastro persistente.
 *   • Shocks de política aparecen como meteoritos con explosión en el chart.
 *   • Cámara que respira y panea siguiendo el punto.
 *   • Sky dome de noche-tormenta con sutil aurora.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import PostFX from './_postFX';

const U_NATURAL = 5.0;
const BETA = 0.8;
const ALPHA = 0.5;

interface RegimeConfig {
  name: string;
  color: string;
  description: string;
  adaptiveSpeed: number;
}

function regimeForPhase(phase: string): RegimeConfig {
  const p = phase.toLowerCase();
  if (p.match(/lucas|racional|expectat|anticip|policy/)) {
    return { name: 'Racional (Lucas)', color: '#34D399', description: 'ajuste inmediato', adaptiveSpeed: 0 };
  }
  if (p.match(/friedman|adaptat|natural/)) {
    return { name: 'Adaptativa (Friedman)', color: '#FB923C', description: 'ajuste lento por aprendizaje', adaptiveSpeed: 0.04 };
  }
  return { name: 'Mixta', color: '#FDB813', description: 'baseline', adaptiveSpeed: 0.08 };
}

const X_RANGE: [number, number] = [0, 12];
const Y_RANGE: [number, number] = [0, 14];
const X_LEN = 14;
const Y_LEN = 10;

function world(x: number, y: number): [number, number, number] {
  const wx = ((x - X_RANGE[0]) / (X_RANGE[1] - X_RANGE[0])) * X_LEN - X_LEN / 2;
  const wy = ((y - Y_RANGE[0]) / (Y_RANGE[1] - Y_RANGE[0])) * Y_LEN - Y_LEN / 2;
  return [wx, wy, 0];
}

function srpcPoint(u: number, piE: number): number {
  return piE - BETA * (u - U_NATURAL);
}

interface TrailPt { x: number; y: number; z: number; life: number; }
interface Shock { x: number; y: number; age: number; }

function SkyDome() {
  const geo = useMemo(() => new THREE.SphereGeometry(80, 24, 16), []);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      varying vec3 vWP;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWP = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec3 vWP;
      void main() {
        vec3 n = normalize(vWP);
        float h = n.y;
        vec3 top = vec3(0.04, 0.05, 0.12);
        vec3 mid = vec3(0.10, 0.08, 0.20);
        vec3 bot = vec3(0.05, 0.05, 0.12);
        vec3 col = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.7, h)) : mix(mid, bot, smoothstep(0.0, -0.4, h));
        // Subtle aurora bands
        float aurora = sin(n.x * 6.0 + time * 0.4) * sin(n.y * 4.0 - time * 0.3);
        col += vec3(0.05, 0.12, 0.18) * max(0.0, aurora) * smoothstep(0.0, 0.4, h);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  }), []);

  useFrame(({ clock }) => { mat.uniforms.time.value = clock.elapsedTime; });
  return <mesh geometry={geo} material={mat} />;
}

function PhillipsCurve({ piE, color, opacity, width, glow }: {
  piE: number; color: string; opacity: number; width: number; glow: boolean;
}) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const Nsamples = 80;
    for (let i = 0; i < Nsamples; i++) {
      const u = X_RANGE[0] + (X_RANGE[1] - X_RANGE[0]) * (i / (Nsamples - 1));
      const pi = srpcPoint(u, piE);
      if (pi < Y_RANGE[0] - 1 || pi > Y_RANGE[1] + 1) continue;
      const [wx, wy] = world(u, Math.max(0, pi));
      pts.push(new THREE.Vector3(wx, wy, 0));
    }
    return pts;
  }, [piE]);

  const tube = useMemo(() => {
    if (points.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, points.length - 1, width, 8, false);
  }, [points, width]);

  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!matRef.current || !glow) return;
    matRef.current.emissiveIntensity = 1.0 + 0.5 * Math.sin(clock.elapsedTime * 2);
  });

  if (!tube) return null;
  return (
    <mesh geometry={tube}>
      <meshStandardMaterial
        ref={matRef}
        color={color}
        emissive={color}
        emissiveIntensity={glow ? 1.4 : 0.6}
        transparent
        opacity={opacity}
        toneMapped={false}
      />
    </mesh>
  );
}

function VerticalLRPC() {
  const points = useMemo(() => {
    const [wxBot, wyBot] = world(U_NATURAL, 0);
    const [, wyTop] = world(U_NATURAL, Y_RANGE[1]);
    return [new THREE.Vector3(wxBot, wyBot, 0), new THREE.Vector3(wxBot, wyTop, 0)];
  }, []);
  const tube = useMemo(() => {
    const curve = new THREE.LineCurve3(points[0], points[1]);
    return new THREE.TubeGeometry(curve, 1, 0.06, 8, false);
  }, [points]);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!matRef.current) return;
    matRef.current.emissiveIntensity = 1.2 + 0.4 * Math.sin(clock.elapsedTime * 1.5);
  });
  return (
    <mesh geometry={tube}>
      <meshStandardMaterial ref={matRef} color="#FDB813" emissive="#FDB813" emissiveIntensity={1.2} transparent opacity={0.85} toneMapped={false} />
    </mesh>
  );
}

function Axes() {
  const xAxis = useMemo(() => {
    const a = world(X_RANGE[0], 0); const b = world(X_RANGE[1], 0);
    return new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(...a), new THREE.Vector3(...b)), 1, 0.04, 8, false);
  }, []);
  const yAxis = useMemo(() => {
    const a = world(X_RANGE[0], Y_RANGE[0]); const b = world(X_RANGE[0], Y_RANGE[1]);
    return new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(...a), new THREE.Vector3(...b)), 1, 0.04, 8, false);
  }, []);
  const gridLines = useMemo(() => {
    const arr: THREE.BufferGeometry[] = [];
    for (let u = X_RANGE[0]; u <= X_RANGE[1]; u += 2) {
      const a = world(u, 0); const b = world(u, Y_RANGE[1]);
      arr.push(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(...a), new THREE.Vector3(...b)), 1, 0.008, 4, false));
    }
    for (let pi = Y_RANGE[0]; pi <= Y_RANGE[1]; pi += 2) {
      const a = world(X_RANGE[0], pi); const b = world(X_RANGE[1], pi);
      arr.push(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(...a), new THREE.Vector3(...b)), 1, 0.008, 4, false));
    }
    return arr;
  }, []);

  return (
    <>
      <mesh geometry={xAxis}><meshStandardMaterial color="#94A3B8" emissive="#94A3B8" emissiveIntensity={0.6} /></mesh>
      <mesh geometry={yAxis}><meshStandardMaterial color="#94A3B8" emissive="#94A3B8" emissiveIntensity={0.6} /></mesh>
      {gridLines.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial color="#3a3060" transparent opacity={0.4} />
        </mesh>
      ))}
    </>
  );
}

function EconomyPoint({ position, color }: { position: [number, number, number]; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.set(position[0], position[1], position[2] + 0.1 * Math.sin(t * 3));
    ref.current.scale.setScalar(1 + 0.12 * Math.sin(t * 5));
    if (haloRef.current) {
      haloRef.current.position.set(position[0], position[1], position[2]);
      haloRef.current.scale.setScalar(1 + 0.25 * Math.sin(t * 3));
    }
  });
  return (
    <>
      <mesh ref={ref}>
        <sphereGeometry args={[0.28, 24, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.4} toneMapped={false} />
      </mesh>
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.55, 18, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} toneMapped={false} />
      </mesh>
    </>
  );
}

function TrailDots({ trailRef, max }: { trailRef: React.MutableRefObject<TrailPt[]>; max: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const mesh = meshRef.current; if (!mesh) return;
    for (let i = 0; i < max; i++) {
      const p = trailRef.current[i];
      if (p.life > 0) {
        p.life -= dt;
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(0.10 * Math.max(0, p.life * 1.2));
      } else {
        dummy.position.set(0, -1000, 0);
        dummy.scale.setScalar(0.0001);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, max]}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={2} toneMapped={false} />
    </instancedMesh>
  );
}

function ShockExplosion({ shock }: { shock: Shock }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    const r = 0.3 + shock.age * 5;
    ref.current.scale.setScalar(r);
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, 0.8 - shock.age * 1.0);
  });
  const [wx, wy] = world(shock.x, shock.y);
  return (
    <mesh ref={ref} position={[wx, wy, 0]}>
      <sphereGeometry args={[1, 18, 12]} />
      <meshBasicMaterial color="#EF4444" transparent opacity={0.8} toneMapped={false} />
    </mesh>
  );
}

function PolicyMeteor({ active, target }: { active: boolean; target: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const startTimeRef = useRef<number | null>(null);

  useFrame(({ clock }, dt) => {
    if (!ref.current) return;
    if (active && startTimeRef.current === null) startTimeRef.current = clock.elapsedTime;
    if (!active) { startTimeRef.current = null; ref.current.visible = false; return; }
    const t = (clock.elapsedTime - (startTimeRef.current ?? clock.elapsedTime));
    if (t > 1.0) { ref.current.visible = false; return; }
    ref.current.visible = true;
    const start: [number, number, number] = [target[0] + 4, target[1] + 8, 0];
    const x = start[0] + (target[0] - start[0]) * t;
    const y = start[1] + (target[1] - start[1]) * t;
    ref.current.position.set(x, y, 0);
    ref.current.scale.setScalar(0.4 + 0.3 * Math.sin(t * 20));
  });

  return (
    <mesh ref={ref} visible={false}>
      <sphereGeometry args={[0.4, 16, 12]} />
      <meshBasicMaterial color="#FDB813" toneMapped={false} />
    </mesh>
  );
}

interface SimState {
  pi: number;
  piE: number;
  u: number;
  piTarget: number;
  trail: Array<{ u: number; pi: number; t: number }>;
  startTime: number;
  shockAt: number;
}

function CinematicCamera() {
  const { camera } = useThree();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const x = 1.2 * Math.sin(t * 0.18);
    const y = 0.6 * Math.sin(t * 0.15);
    const z = 12 + 0.8 * Math.sin(t * 0.12);
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function PhillipsSim({ phase, onState }: { phase: string; onState: (s: any) => void; }) {
  const regime = useMemo(() => regimeForPhase(phase), [phase]);

  const state = useRef<SimState>({
    pi: 2, piE: 2, u: U_NATURAL, piTarget: 2, trail: [], startTime: 0, shockAt: -1,
  });

  useEffect(() => {
    state.current = { pi: 2, piE: 2, u: U_NATURAL, piTarget: 2, trail: [], startTime: 0, shockAt: -1 };
  }, [phase]);

  const [pointPos, setPointPos] = useState<[number, number, number]>(world(U_NATURAL, 2));
  const [shocks, setShocks] = useState<Shock[]>([]);
  const [shockTriggered, setShockTriggered] = useState(false);

  const MAX_TRAIL = 50;
  const trailRef = useRef<TrailPt[]>(
    Array.from({ length: MAX_TRAIL }, () => ({ x: 0, y: -1000, z: 0, life: 0 }))
  );
  const trailIdxRef = useRef(0);

  useFrame(({ clock }, dt) => {
    const s = state.current;
    if (s.startTime === 0) s.startTime = clock.elapsedTime;
    const t = clock.elapsedTime - s.startTime;

    if (t < 2.5) s.piTarget = 2;
    else if (t < 12) s.piTarget = 8;
    else s.piTarget = 8;

    // Trigger shock visualization at t=2.5
    if (t >= 2.5 && !shockTriggered) {
      setShockTriggered(true);
      const [wx, wy] = world(U_NATURAL, 8);
      setShocks(prev => [...prev, { x: U_NATURAL, y: 8, age: 0 }]);
    }

    // Age shocks
    setShocks(prev => prev.map(s => ({ ...s, age: s.age + dt })).filter(s => s.age < 0.9));

    if (regime.adaptiveSpeed === 0) {
      s.piE = s.piTarget;
    } else {
      s.piE += regime.adaptiveSpeed * (s.pi - s.piE);
    }

    s.pi = ALPHA * s.piTarget + (1 - ALPHA) * s.piE;
    s.u = U_NATURAL - (s.pi - s.piE) / BETA;
    s.u = Math.max(X_RANGE[0] + 0.5, Math.min(X_RANGE[1] - 0.5, s.u));

    const w = world(s.u, s.pi);
    setPointPos(w);

    // Emit trail dot
    if (Math.random() < 0.4) {
      const idx = trailIdxRef.current;
      const p = trailRef.current[idx];
      p.x = w[0]; p.y = w[1]; p.z = 0;
      p.life = 1.5;
      trailIdxRef.current = (idx + 1) % MAX_TRAIL;
    }

    s.trail.push({ u: s.u, pi: s.pi, t });
    if (s.trail.length > 60) s.trail.shift();

    onState({ pi: s.pi, piE: s.piE, u: s.u, piTarget: s.piTarget, regime: regime.name });
  });

  const srpcExpectations = [2, 5, 8, 11];

  // Recompute "closeness" per render
  const piECurrent = state.current.piE;

  return (
    <>
      <ambientLight intensity={0.4} color="#A0A8E0" />
      <directionalLight position={[6, 10, 8]} intensity={0.7} />
      <pointLight position={[0, 5, 5]} intensity={1.2} color="#FDB813" distance={20} />
      <pointLight position={[pointPos[0], pointPos[1], 3]} intensity={1.5} color={regime.color} distance={10} />

      <fog attach="fog" args={['#1a1530', 18, 60]} />

      <SkyDome />
      <Axes />
      <VerticalLRPC />

      {srpcExpectations.map((piE, i) => {
        const closeness = Math.max(0, 1 - Math.abs(piE - piECurrent) / 3);
        return (
          <PhillipsCurve key={i} piE={piE} color={i === 0 ? '#94A3B8' : '#A78BFA'}
            opacity={0.28 + 0.65 * closeness} width={0.04 + 0.03 * closeness} glow={closeness > 0.5} />
        );
      })}

      <TrailDots trailRef={trailRef} max={MAX_TRAIL} />

      {shocks.map((s, i) => <ShockExplosion key={`shk-${i}-${s.age.toFixed(3)}`} shock={s} />)}

      <PolicyMeteor active={shockTriggered && state.current.startTime > 0 && (Date.now() / 1000 - state.current.startTime) < 3.5} target={world(U_NATURAL, 8)} />

      <EconomyPoint position={pointPos} color={regime.color} />
    </>
  );
}

export default function ExpectationsScene({ phase }: { phase: string }) {
  const regime = useMemo(() => regimeForPhase(phase), [phase]);
  const [hud, setHud] = useState({ pi: 2, piE: 2, u: U_NATURAL, piTarget: 2, regime: regime.name });

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #14111A 0%, #03050A 80%)' }}
    >
      <Canvas
        camera={{ position: [0, 0, 12], fov: 50 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      >
        <PhillipsSim key={phase} phase={phase} onState={setHud} />
        <CinematicCamera />
        {/* Bloom alto sobre las curvas pulsantes + ChromAberration para
            sensación de datos cuánticos / energía económica. */}
        <PostFX intensity={1.6} threshold={0.30} smoothing={0.50} vignette={0.65} vignetteOffset={0.20} aberration={0.0020} />
      </Canvas>

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute" style={{ left: '50%', bottom: '110px', transform: 'translateX(-50%)' }}>
          <span className="text-[12px] font-mono text-[#94A3B8]">u — desempleo (%) →</span>
        </div>
        <div className="absolute" style={{ left: '40px', top: '50%', transform: 'translateY(-50%) rotate(-90deg)' }}>
          <span className="text-[12px] font-mono text-[#94A3B8]">↑ π — inflación (%)</span>
        </div>
      </div>

      <div className="absolute top-6 left-6 text-[11px] font-mono pointer-events-none">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#64748B]">Régimen</div>
        <div className="mt-1" style={{ color: regime.color }}>{regime.name}</div>
        <div className="text-[10px] text-[#64748B] mt-0.5">{regime.description}</div>
      </div>

      <div className="absolute top-6 right-6 text-[11px] font-mono pointer-events-none text-right space-y-0.5">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#64748B]">Estado</div>
        <div><span className="text-[#475569]">π_objetivo:</span> <span className="text-[#FDB813]">{hud.piTarget.toFixed(1)}%</span></div>
        <div><span className="text-[#475569]">π_actual:</span> <span className="text-[#E2E8F0]">{hud.pi.toFixed(2)}%</span></div>
        <div><span className="text-[#475569]">π_esperada:</span> <span style={{ color: regime.color }}>{hud.piE.toFixed(2)}%</span></div>
        <div><span className="text-[#475569]">u:</span> <span className={Math.abs(hud.u - U_NATURAL) < 0.2 ? 'text-[#34D399]' : 'text-[#EF4444]'}>{hud.u.toFixed(2)}%</span></div>
      </div>
    </div>
  );
}
