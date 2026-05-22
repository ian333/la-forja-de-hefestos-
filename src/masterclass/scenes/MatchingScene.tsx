/**
 * MatchingScene — algoritmo de Gale-Shapley (aceptación diferida).
 *
 * Visualización cinemática del algoritmo:
 *   • Nodos flotando en 3D (bipartito izq/der).
 *   • Propuestas: rayos dorados con estela de partículas viajando al receptor.
 *   • Aceptación: pulso de onda verde expansivo + vínculo brillante que late.
 *   • Rechazo: shockwave rojo, la propuesta se "rompe" en chispas.
 *   • Cámara orbital lenta que respira hacia adentro/afuera.
 *   • Postprocessing: bloom emisivo en todo lo que brilla.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import PostFX from './_postFX';

const N = 6;

interface Agent {
  id: number;
  side: 'left' | 'right';
  prefs: number[];
  current: number | null;
  proposalIdx: number;
}

type ProposalAnimState = 'flying' | 'accepted' | 'rejected';

interface ProposalAnim {
  from: number;
  to: number;
  state: ProposalAnimState;
  age: number;
  id: number;
}

interface PulseWave {
  pos: [number, number, number];
  age: number;
  color: string;
  kind: 'accept' | 'reject';
}

interface TrailParticle {
  x: number; y: number; z: number;
  life: number;
  color: THREE.Color;
}

function generateAgents(seed: number): { left: Agent[]; right: Agent[] } {
  const rand = (s: number) => {
    const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const shuffle = (arr: number[], salt: number) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand(seed + salt * 1000 + i) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const ids = Array.from({ length: N }, (_, i) => i);
  const left: Agent[] = ids.map(i => ({
    id: i, side: 'left', prefs: shuffle(ids, i + 1), current: null, proposalIdx: 0,
  }));
  const right: Agent[] = ids.map(i => ({
    id: i, side: 'right', prefs: shuffle(ids, i + 100), current: null, proposalIdx: 0,
  }));
  return { left, right };
}

const LEFT_X = -4.2;
const RIGHT_X = 4.2;
const SPACING = 1.5;

function nodePos(side: 'left' | 'right', id: number, t: number): [number, number, number] {
  const y = (id - (N - 1) / 2) * SPACING;
  const bob = 0.08 * Math.sin(t * 1.4 + id * 0.7 + (side === 'left' ? 0 : Math.PI));
  const sideZ = (side === 'left' ? -1 : 1) * 0.4 * Math.sin(t * 0.5 + id);
  return [side === 'left' ? LEFT_X : RIGHT_X, y + bob, sideZ];
}

const LEFT_COLOR = '#60A5FA';
const RIGHT_COLOR = '#F472B6';
const ACCEPTED_COLOR = '#34D399';
const FLYING_COLOR = '#FDB813';
const REJECTED_COLOR = '#EF4444';

function Node({
  side,
  id,
  matched,
  pulse,
}: {
  side: 'left' | 'right';
  id: number;
  matched: boolean;
  pulse: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const color = side === 'left' ? LEFT_COLOR : RIGHT_COLOR;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!ref.current) return;
    const pos = nodePos(side, id, t);
    ref.current.position.set(pos[0], pos[1], pos[2]);
    if (haloRef.current) haloRef.current.position.set(pos[0], pos[1], pos[2]);
    const beat = matched ? 1 + 0.08 * Math.sin(t * 2.5 + id) : 1 + 0.14 * Math.sin(t * 4 + id);
    const pulseScale = pulse > 0 ? 1 + pulse * 0.5 : 1;
    ref.current.scale.setScalar(beat * pulseScale);
  });

  return (
    <>
      <mesh ref={ref}>
        <sphereGeometry args={[0.34, 26, 18]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={matched ? 1.6 : 0.7}
          roughness={0.32}
          metalness={0.3}
        />
      </mesh>
      <mesh ref={haloRef}>
        <sphereGeometry args={[matched ? 0.62 : 0.5, 18, 12]} />
        <meshBasicMaterial color={color} transparent opacity={matched ? 0.22 : 0.1} />
      </mesh>
    </>
  );
}

function MatchTube({
  fromPos,
  toPos,
  color,
  opacity,
  radius,
  pulsate,
}: {
  fromPos: [number, number, number];
  toPos: [number, number, number];
  color: string;
  opacity: number;
  radius: number;
  pulsate: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => {
    const start = new THREE.Vector3(...fromPos);
    const end = new THREE.Vector3(...toPos);
    return new THREE.TubeGeometry(new THREE.LineCurve3(start, end), 1, radius, 6, false);
  }, [fromPos, toPos, radius]);

  useFrame(({ clock }) => {
    if (!meshRef.current || !pulsate) return;
    const t = clock.elapsedTime;
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = opacity * (0.7 + 0.3 * Math.sin(t * 3));
  });

  return (
    <mesh ref={meshRef} geometry={geo}>
      <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
    </mesh>
  );
}

function FlyingProposal({
  fromPos,
  toPos,
  progress,
  trailRef,
}: {
  fromPos: [number, number, number];
  toPos: [number, number, number];
  progress: number;
  trailRef: React.MutableRefObject<TrailParticle[]>;
}) {
  const x = fromPos[0] + (toPos[0] - fromPos[0]) * progress;
  const y = fromPos[1] + (toPos[1] - fromPos[1]) * progress + Math.sin(progress * Math.PI) * 0.4;
  const z = fromPos[2] + (toPos[2] - fromPos[2]) * progress;

  // Emit trail particles
  if (Math.random() < 0.6) {
    const idx = trailRef.current.findIndex(p => p.life <= 0);
    if (idx !== -1) {
      const p = trailRef.current[idx];
      p.x = x + (Math.random() - 0.5) * 0.08;
      p.y = y + (Math.random() - 0.5) * 0.08;
      p.z = z + (Math.random() - 0.5) * 0.08;
      p.life = 0.7;
      p.color.set('#FDB813');
    }
  }

  return (
    <mesh position={[x, y, z]}>
      <sphereGeometry args={[0.18, 18, 12]} />
      <meshBasicMaterial color={FLYING_COLOR} toneMapped={false} />
    </mesh>
  );
}

function TrailParticles({ trailRef, maxParticles }: { trailRef: React.MutableRefObject<TrailParticle[]>; maxParticles: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < maxParticles; i++) {
      const p = trailRef.current[i];
      if (p.life > 0) {
        p.life -= dt;
        dummy.position.set(p.x, p.y, p.z);
        const s = 0.10 * Math.max(0, p.life * 1.5);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        tmpColor.copy(p.color);
        mesh.setColorAt(i, tmpColor);
      } else {
        dummy.position.set(0, -1000, 0);
        dummy.scale.setScalar(0.0001);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, maxParticles]}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshBasicMaterial color="#FFFFFF" toneMapped={false} />
    </instancedMesh>
  );
}

function PulseWaveMesh({ wave }: { wave: PulseWave }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    const t = wave.age;
    const radius = wave.kind === 'accept' ? 0.5 + t * 4 : 0.5 + t * 6;
    ref.current.scale.set(radius, radius, radius);
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, 0.7 - t * 1.6);
  });
  return (
    <mesh ref={ref} position={wave.pos} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1, 0.04, 8, 32]} />
      <meshBasicMaterial color={wave.color} transparent opacity={0.7} toneMapped={false} />
    </mesh>
  );
}

function CinematicCamera() {
  const { camera } = useThree();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const orbit = Math.sin(t * 0.05) * 0.3;
    const r = 13 + 1.5 * Math.sin(t * 0.13);
    const h = 0.4 * Math.sin(t * 0.18);
    camera.position.set(Math.sin(orbit) * r, h, Math.cos(orbit) * r);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function GaleShapleySim({ phase }: { phase: string }) {
  const seed = useMemo(() => {
    let s = 0;
    for (let i = 0; i < phase.length; i++) s = (s * 31 + phase.charCodeAt(i)) >>> 0;
    return s;
  }, [phase]);

  const { left: initialLeft, right: initialRight } = useMemo(() => generateAgents(seed), [seed]);

  const leftRef = useRef<Agent[]>([]);
  const rightRef = useRef<Agent[]>([]);
  useEffect(() => {
    leftRef.current = initialLeft.map(a => ({ ...a, prefs: [...a.prefs] }));
    rightRef.current = initialRight.map(a => ({ ...a, prefs: [...a.prefs] }));
  }, [initialLeft, initialRight]);

  const [matches, setMatches] = useState<Array<{ left: number; right: number }>>([]);
  const [proposals, setProposals] = useState<ProposalAnim[]>([]);
  const [waves, setWaves] = useState<PulseWave[]>([]);
  const [nodePulses, setNodePulses] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);

  const MAX_TRAIL = 80;
  const trailRef = useRef<TrailParticle[]>(
    Array.from({ length: MAX_TRAIL }, () => ({ x: 0, y: -1000, z: 0, life: 0, color: new THREE.Color('#FDB813') }))
  );

  const lastStepRef = useRef(0);
  const STEP_INTERVAL = 2.0;
  const FLY_DURATION = 1.0;
  const propIdRef = useRef(0);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;

    // Age proposals
    setProposals(prev => {
      const next = prev.map(p => ({ ...p, age: p.age + dt }));
      return next.filter(p => p.age < FLY_DURATION + 0.5);
    });
    // Age waves
    setWaves(prev => prev.map(w => ({ ...w, age: w.age + dt })).filter(w => w.age < 0.7));
    // Decay node pulses
    setNodePulses(prev => {
      const next: Record<string, number> = {};
      for (const k in prev) {
        const v = prev[k] - dt * 2;
        if (v > 0) next[k] = v;
      }
      return next;
    });

    if (done) {
      // Restart after pause
      if (t - lastStepRef.current > 5) {
        leftRef.current = initialLeft.map(a => ({ ...a, prefs: [...a.prefs] }));
        rightRef.current = initialRight.map(a => ({ ...a, prefs: [...a.prefs] }));
        setMatches([]);
        setDone(false);
        lastStepRef.current = t;
      }
      return;
    }

    if (t - lastStepRef.current < STEP_INTERVAL) return;
    lastStepRef.current = t;

    const left = leftRef.current;
    const right = rightRef.current;

    const newProposals: ProposalAnim[] = [];
    let anyProposed = false;
    for (const m of left) {
      if (m.current !== null) continue;
      if (m.proposalIdx >= m.prefs.length) continue;
      const target = m.prefs[m.proposalIdx];
      m.proposalIdx++;
      newProposals.push({ from: m.id, to: target, state: 'flying', age: 0, id: propIdRef.current++ });
      anyProposed = true;
    }

    if (!anyProposed) {
      setDone(true);
      return;
    }

    setProposals(prev => [...prev, ...newProposals]);

    setTimeout(() => {
      const byReceiver = new Map<number, number[]>();
      for (const p of newProposals) {
        const arr = byReceiver.get(p.to) ?? [];
        arr.push(p.from);
        byReceiver.set(p.to, arr);
      }

      const newWaves: PulseWave[] = [];
      const newPulses: Record<string, number> = {};

      for (const [receiverId, proposers] of byReceiver) {
        const receiver = right[receiverId];
        const candidates = [...proposers];
        if (receiver.current !== null) candidates.push(receiver.current);

        let best = candidates[0];
        let bestRank = receiver.prefs.indexOf(best);
        for (const c of candidates) {
          const r = receiver.prefs.indexOf(c);
          if (r >= 0 && r < bestRank) { best = c; bestRank = r; }
        }

        const rejected = candidates.filter(c => c !== best);
        for (const r of rejected) {
          left[r].current = null;
          // Reject wave on left rejected node
          const lpos = nodePos('left', r, performance.now() / 1000);
          newWaves.push({ pos: lpos, age: 0, color: REJECTED_COLOR, kind: 'reject' });
          newPulses[`L${r}`] = 1.0;
        }
        receiver.current = best;
        left[best].current = receiverId;
        // Accept wave on right receiver
        const rpos = nodePos('right', receiverId, performance.now() / 1000);
        newWaves.push({ pos: rpos, age: 0, color: ACCEPTED_COLOR, kind: 'accept' });
        newPulses[`R${receiverId}`] = 1.0;
        newPulses[`L${best}`] = 1.0;
      }

      const newMatches: Array<{ left: number; right: number }> = [];
      for (const m of left) {
        if (m.current !== null) newMatches.push({ left: m.id, right: m.current });
      }
      setMatches(newMatches);
      setWaves(prev => [...prev, ...newWaves]);
      setNodePulses(prev => ({ ...prev, ...newPulses }));
    }, FLY_DURATION * 1000);
  });

  const tCurrent = useRef(0);
  useFrame(({ clock }) => { tCurrent.current = clock.elapsedTime; });

  const matchedLeft = new Set(matches.map(m => m.left));
  const matchedRight = new Set(matches.map(m => m.right));

  // Use leftRef.current — but render is for the snapshot we have
  const leftAgents = leftRef.current.length ? leftRef.current : initialLeft;
  const rightAgents = rightRef.current.length ? rightRef.current : initialRight;

  return (
    <>
      <ambientLight intensity={0.42} />
      <directionalLight position={[6, 10, 8]} intensity={0.9} color="#FFFFFF" />
      <directionalLight position={[-6, 5, -5]} intensity={0.45} color="#A78BFA" />
      <pointLight position={[0, 0, 4]} intensity={1.2} color="#FDB813" distance={20} />

      {/* Soft floor reflection */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4, 0]}>
        <circleGeometry args={[20, 32]} />
        <meshStandardMaterial color="#0A0F17" roughness={0.4} metalness={0.5} />
      </mesh>

      {/* Nodes */}
      {leftAgents.map(a => (
        <Node key={`L${a.id}`} side="left" id={a.id} matched={matchedLeft.has(a.id)} pulse={nodePulses[`L${a.id}`] || 0} />
      ))}
      {rightAgents.map(a => (
        <Node key={`R${a.id}`} side="right" id={a.id} matched={matchedRight.has(a.id)} pulse={nodePulses[`R${a.id}`] || 0} />
      ))}

      {/* Stable matches (pulsing tubes) */}
      {matches.map((m, i) => {
        const fp = nodePos('left', m.left, tCurrent.current);
        const tp = nodePos('right', m.right, tCurrent.current);
        return (
          <MatchTube key={`m${i}-${m.left}-${m.right}`} fromPos={fp} toPos={tp}
            color={ACCEPTED_COLOR} opacity={0.95} radius={0.06} pulsate />
        );
      })}

      {/* Flying proposals */}
      {proposals.map(p => {
        if (p.age > FLY_DURATION) return null;
        const fp = nodePos('left', p.from, tCurrent.current);
        const tp = nodePos('right', p.to, tCurrent.current);
        const progress = Math.min(1, p.age / FLY_DURATION);
        return (
          <group key={`p${p.id}`}>
            <FlyingProposal fromPos={fp} toPos={tp} progress={progress} trailRef={trailRef} />
            <MatchTube fromPos={fp} toPos={tp} color={FLYING_COLOR} opacity={0.35} radius={0.02} pulsate={false} />
          </group>
        );
      })}

      {/* Pulse waves */}
      {waves.map((w, i) => (
        <PulseWaveMesh key={`w${i}-${w.age.toFixed(3)}`} wave={w} />
      ))}

      {/* Trail particles */}
      <TrailParticles trailRef={trailRef} maxParticles={MAX_TRAIL} />
    </>
  );
}

export default function MatchingScene({ phase }: { phase: string }) {
  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #14111A 0%, #03050A 80%)' }}
    >
      <Canvas
        camera={{ position: [0, 0, 14], fov: 38 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      >
        <GaleShapleySim phase={phase} />
        <CinematicCamera />
        {/* Bloom alto: la escena es 100% emisiva, queremos que se sienta etérea.
            Aberración cromática sutil para sensación cuántica/datos. */}
        <PostFX intensity={1.8} threshold={0.25} smoothing={0.45} vignette={0.7} vignetteOffset={0.18} aberration={0.0015} />
      </Canvas>

      {/* HUD */}
      <div className="absolute top-6 left-6 text-[11px] font-mono space-y-1 pointer-events-none">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#64748B]">Gale-Shapley</div>
        <div className="flex gap-3 mt-1.5">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: LEFT_COLOR, boxShadow: `0 0 8px ${LEFT_COLOR}` }} />
            <span className="text-[#94A3B8]">proponen</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: RIGHT_COLOR, boxShadow: `0 0 8px ${RIGHT_COLOR}` }} />
            <span className="text-[#94A3B8]">deciden</span>
          </span>
        </div>
      </div>

      <div className="absolute top-6 right-6 text-[11px] font-mono space-y-1 pointer-events-none text-right">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#64748B]">Estado</div>
        <div className="flex gap-3 mt-1.5 justify-end">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: FLYING_COLOR, boxShadow: `0 0 6px ${FLYING_COLOR}` }} />
            <span className="text-[#94A3B8]">propuesta</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: ACCEPTED_COLOR, boxShadow: `0 0 6px ${ACCEPTED_COLOR}` }} />
            <span className="text-[#94A3B8]">aceptado</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: REJECTED_COLOR, boxShadow: `0 0 6px ${REJECTED_COLOR}` }} />
            <span className="text-[#94A3B8]">rechazo</span>
          </span>
        </div>
      </div>
    </div>
  );
}
