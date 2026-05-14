/**
 * VickreyScene — subasta de Vickrey con drama cinemático.
 *
 * Mejoras visuales:
 *   • Item central: gema icosaédrica rotando, pulsando, con halo y caustics.
 *   • Bidders sobre pedestales con plinto reflectivo.
 *   • Envelopes con motion blur (estela detrás).
 *   • Spotlight desde el cielo iluminando el item.
 *   • Confetti explosion + spotlight intenso sobre el ganador.
 *   • Cámara cinemática que cambia ángulo según la fase.
 *   • Sky dome con gradiente, marble floor.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const N_BIDDERS = 6;
const RADIUS = 4.5;

const BIDDER_COLORS = ['#FDB813', '#34D399', '#F472B6', '#60A5FA', '#A78BFA', '#EF4444'];
const MAX_CONFETTI = 80;
const MAX_TRAIL = 60;

interface BidderState {
  value: number;
  bid: number;
  isWinner: boolean;
  isSecond: boolean;
}

interface AuctionState {
  bidders: BidderState[];
  startTime: number;
  phase: 'thinking' | 'flying' | 'revealing' | 'paying' | 'reset';
  winnerIdx: number;
  secondIdx: number;
  pricePaid: number;
}

interface Confetti {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;
  rotX: number; rotY: number; rotZ: number;
  vrx: number; vry: number; vrz: number;
  color: THREE.Color;
}

interface TrailPt { x: number; y: number; z: number; life: number; color: THREE.Color; }

function regimeForPhase(phase: string): { truthTelling: boolean; label: string; color: string } {
  const p = phase.toLowerCase();
  if (p.match(/estrategia|mentir|cheating|deviation/)) {
    return { truthTelling: false, label: 'Postores mentirosos', color: '#EF4444' };
  }
  return { truthTelling: true, label: 'Truth-telling (estrategia dominante)', color: '#34D399' };
}

function newAuction(truthTelling: boolean): BidderState[] {
  const bidders: BidderState[] = [];
  for (let i = 0; i < N_BIDDERS; i++) {
    const value = 15 + Math.random() * 75;
    let bid: number;
    if (truthTelling) bid = value;
    else bid = Math.max(5, Math.min(95, value + (Math.random() - 0.5) * 30));
    bidders.push({ value, bid, isWinner: false, isSecond: false });
  }
  const sorted = bidders.map((b, i) => ({ ...b, idx: i })).sort((a, b) => b.bid - a.bid);
  bidders[sorted[0].idx].isWinner = true;
  bidders[sorted[1].idx].isSecond = true;
  return bidders;
}

function bidderPos(i: number): [number, number, number] {
  const angle = (i / N_BIDDERS) * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(angle) * RADIUS, 0, Math.sin(angle) * RADIUS];
}

function SkyDome() {
  const geometry = useMemo(() => new THREE.SphereGeometry(80, 24, 16), []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `
      varying vec3 vWP;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWP = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWP;
      void main() {
        float h = normalize(vWP).y;
        vec3 top = vec3(0.07, 0.05, 0.15);
        vec3 mid = vec3(0.20, 0.10, 0.30);
        vec3 bot = vec3(0.08, 0.03, 0.10);
        vec3 col;
        if (h > 0.0) col = mix(mid, top, smoothstep(0.0, 0.7, h));
        else col = mix(mid, bot, smoothstep(0.0, -0.4, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  }), []);
  return <mesh geometry={geometry} material={material} />;
}

function MarbleFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
      <circleGeometry args={[10, 64]} />
      <meshStandardMaterial
        color="#1A1825"
        roughness={0.25}
        metalness={0.45}
        emissive="#0A0815"
        emissiveIntensity={0.3}
      />
    </mesh>
  );
}

function SpotlightBeam({ active }: { active: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!ref.current || !matRef.current) return;
    const t = clock.elapsedTime;
    matRef.current.opacity = (active ? 0.25 : 0.12) + 0.06 * Math.sin(t * 2);
    ref.current.rotation.y = t * 0.4;
  });
  return (
    <mesh ref={ref} position={[0, 5, 0]}>
      <coneGeometry args={[2.5, 12, 32, 1, true]} />
      <meshBasicMaterial
        ref={matRef}
        color="#FFE5A0"
        transparent
        opacity={0.2}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

function Bidder({
  i,
  state,
  isWinnerPhase,
  paying,
}: {
  i: number;
  state: BidderState;
  isWinnerPhase: boolean;
  paying: boolean;
}) {
  const pos = bidderPos(i);
  const color = BIDDER_COLORS[i];
  const ref = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const baseScale = 1 + 0.06 * Math.sin(t * 2 + i);
    const winnerBoost = isWinnerPhase && state.isWinner ? 1.25 + 0.1 * Math.sin(t * 6) : 1;
    const dim = paying && !state.isWinner ? 0.85 : 1;
    ref.current.scale.setScalar(baseScale * winnerBoost * dim);
    if (haloRef.current) {
      haloRef.current.scale.setScalar(1 + 0.2 * Math.sin(t * 3 + i));
    }
  });

  const isHighlight = state.isWinner || state.isSecond;
  const haloColor = state.isWinner ? '#34D399' : state.isSecond ? '#FDB813' : color;

  return (
    <group position={pos}>
      {/* Pedestal */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.7, 0.85, 0.1, 24]} />
        <meshStandardMaterial color="#241A2E" metalness={0.6} roughness={0.3} emissive="#1A0F25" emissiveIntensity={0.4} />
      </mesh>
      {/* Body sphere */}
      <mesh ref={ref} position={[0, 0.7, 0]}>
        <sphereGeometry args={[0.5, 28, 18]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHighlight && isWinnerPhase ? 1.6 : 0.75}
          roughness={0.3}
          metalness={0.3}
        />
      </mesh>
      {/* Halo */}
      {(isHighlight && isWinnerPhase) && (
        <mesh ref={haloRef} position={[0, 0.7, 0]}>
          <sphereGeometry args={[0.85, 18, 12]} />
          <meshBasicMaterial color={haloColor} transparent opacity={0.3} toneMapped={false} />
        </mesh>
      )}
      {/* Spotlight cone over winner */}
      {state.isWinner && isWinnerPhase && (
        <mesh position={[0, 3, 0]}>
          <coneGeometry args={[1.2, 6, 32, 1, true]} />
          <meshBasicMaterial color="#34D399" transparent opacity={0.18} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function ItemInCenter({ revealed, winnerColor }: { revealed: boolean; winnerColor: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.rotation.x = t * 0.4;
    ref.current.rotation.y = t * 0.6;
    ref.current.position.y = 1.0 + 0.15 * Math.sin(t * 2);
    if (haloRef.current) {
      haloRef.current.position.y = ref.current.position.y;
      haloRef.current.scale.setScalar(1 + 0.18 * Math.sin(t * 3));
    }
  });

  const color = revealed ? winnerColor : '#FDB813';
  return (
    <>
      <mesh ref={ref}>
        <icosahedronGeometry args={[0.7, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.2}
          roughness={0.15}
          metalness={0.6}
        />
      </mesh>
      {/* Halo */}
      <mesh ref={haloRef} position={[0, 1, 0]}>
        <sphereGeometry args={[1.2, 18, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} toneMapped={false} />
      </mesh>
      {/* Pedestal */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.5, 0.7, 0.1, 24]} />
        <meshStandardMaterial color="#2A1F35" metalness={0.7} roughness={0.2} />
      </mesh>
    </>
  );
}

function ConfettiBurst({ confettiRef }: { confettiRef: React.MutableRefObject<Confetti[]> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < MAX_CONFETTI; i++) {
      const p = confettiRef.current[i];
      if (p.life > 0) {
        p.life -= dt;
        p.vy -= 6.0 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.rotX += p.vrx * dt;
        p.rotY += p.vry * dt;
        p.rotZ += p.vrz * dt;
        if (p.y < 0.1) p.life = 0;
      }
      if (p.life > 0) {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
        dummy.scale.setScalar(0.10 * Math.min(1, p.life * 2));
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
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_CONFETTI]}>
      <boxGeometry args={[1, 1, 0.2]} />
      <meshBasicMaterial color="#FFFFFF" toneMapped={false} />
    </instancedMesh>
  );
}

function TrailDots({ trailRef }: { trailRef: React.MutableRefObject<TrailPt[]> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < MAX_TRAIL; i++) {
      const p = trailRef.current[i];
      if (p.life > 0) {
        p.life -= dt;
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(0.08 * Math.max(0, p.life * 1.6));
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
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_TRAIL]}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshBasicMaterial color="#FFFFFF" toneMapped={false} />
    </instancedMesh>
  );
}

function CinematicCamera({ phase }: { phase: string }) {
  const { camera } = useThree();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    let baseY = 6;
    let baseR = 9;
    if (phase === 'revealing' || phase === 'paying') {
      baseY = 4.2;
      baseR = 8;
    } else if (phase === 'flying') {
      baseY = 5;
      baseR = 9.5;
    }
    const orbit = t * 0.12;
    const r = baseR + 0.6 * Math.sin(t * 0.3);
    const h = baseY + 0.4 * Math.sin(t * 0.25);
    camera.position.set(Math.sin(orbit) * r, h, Math.cos(orbit) * r);
    camera.lookAt(0, 1.0, 0);
  });
  return null;
}

function AuctionSim({
  phase,
  onState,
  confettiRef,
  trailRef,
}: {
  phase: string;
  onState: (s: any) => void;
  confettiRef: React.MutableRefObject<Confetti[]>;
  trailRef: React.MutableRefObject<TrailPt[]>;
}) {
  const regime = useMemo(() => regimeForPhase(phase), [phase]);

  const auctionRef = useRef<AuctionState>({
    bidders: newAuction(regime.truthTelling),
    startTime: 0,
    phase: 'thinking',
    winnerIdx: 0,
    secondIdx: 0,
    pricePaid: 0,
  });

  useEffect(() => {
    const bidders = newAuction(regime.truthTelling);
    const winnerIdx = bidders.findIndex(b => b.isWinner);
    const secondIdx = bidders.findIndex(b => b.isSecond);
    auctionRef.current = {
      bidders,
      startTime: 0,
      phase: 'thinking',
      winnerIdx,
      secondIdx,
      pricePaid: bidders[secondIdx].bid,
    };
  }, [phase, regime.truthTelling]);

  const [_tick, setTick] = useState(0);
  const lastConfettiBurstRef = useRef(0);

  useFrame(({ clock }, dt) => {
    const s = auctionRef.current;
    if (s.startTime === 0) s.startTime = clock.elapsedTime;
    const t = clock.elapsedTime - s.startTime;

    let newPhase: AuctionState['phase'] = 'thinking';
    if (t < 2.5) newPhase = 'thinking';
    else if (t < 4.5) newPhase = 'flying';
    else if (t < 6.5) newPhase = 'revealing';
    else if (t < 9.5) newPhase = 'paying';
    else newPhase = 'reset';

    if (newPhase !== s.phase) {
      s.phase = newPhase;
      if (newPhase === 'paying') {
        // Trigger confetti
        if (clock.elapsedTime - lastConfettiBurstRef.current > 2) {
          lastConfettiBurstRef.current = clock.elapsedTime;
          const winPos = bidderPos(s.winnerIdx);
          for (let k = 0; k < 60; k++) {
            const idx = confettiRef.current.findIndex(c => c.life <= 0);
            if (idx === -1) break;
            const c = confettiRef.current[idx];
            c.x = winPos[0]; c.y = 1.5; c.z = winPos[2];
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4;
            c.vx = Math.cos(angle) * speed;
            c.vz = Math.sin(angle) * speed;
            c.vy = 3 + Math.random() * 4;
            c.rotX = Math.random() * Math.PI;
            c.rotY = Math.random() * Math.PI;
            c.rotZ = Math.random() * Math.PI;
            c.vrx = (Math.random() - 0.5) * 8;
            c.vry = (Math.random() - 0.5) * 8;
            c.vrz = (Math.random() - 0.5) * 8;
            c.life = 1.8 + Math.random() * 0.8;
            const palette = ['#FDB813', '#34D399', '#F472B6', '#60A5FA', '#A78BFA', '#FFFFFF'];
            c.color.set(palette[Math.floor(Math.random() * palette.length)]);
          }
        }
      }
      if (newPhase === 'reset') {
        const bidders = newAuction(regime.truthTelling);
        const winnerIdx = bidders.findIndex(b => b.isWinner);
        const secondIdx = bidders.findIndex(b => b.isSecond);
        auctionRef.current = {
          bidders, startTime: clock.elapsedTime,
          phase: 'thinking', winnerIdx, secondIdx,
          pricePaid: bidders[secondIdx].bid,
        };
      }
    }

    // Emit envelope trail particles during flying
    if (s.phase === 'flying') {
      const startTimeFlying = s.startTime + 2.5;
      const dtFly = Math.max(0, Math.min(1, (clock.elapsedTime - startTimeFlying) / 2.0));
      for (let i = 0; i < N_BIDDERS; i++) {
        if (Math.random() < 0.35) {
          const base = bidderPos(i);
          const ex = base[0] * (1 - dtFly);
          const ey = 1.5 + 0.3 * Math.sin(dtFly * Math.PI);
          const ez = base[2] * (1 - dtFly);
          const idx = trailRef.current.findIndex(p => p.life <= 0);
          if (idx !== -1) {
            const p = trailRef.current[idx];
            p.x = ex; p.y = ey; p.z = ez;
            p.life = 0.5;
            p.color.set(BIDDER_COLORS[i]);
          }
        }
      }
    }

    setTick(n => (n + 1) % 1000);

    onState({
      phase: s.phase,
      values: s.bidders.map(b => b.value),
      bids: s.bidders.map(b => b.bid),
      winner: s.winnerIdx,
      pricePaid: s.pricePaid,
      isWinner: s.bidders.map(b => b.isWinner),
      isSecond: s.bidders.map(b => b.isSecond),
    });
  });

  const s = auctionRef.current;
  const revealed = s.phase === 'revealing' || s.phase === 'paying';
  const winnerColor = BIDDER_COLORS[s.winnerIdx] || '#34D399';
  const isWinnerPhase = s.phase === 'revealing' || s.phase === 'paying';

  // Compute envelope positions per phase
  const envelopePositions: ([number, number, number] | null)[] = s.bidders.map((_, i) => {
    const base = bidderPos(i);
    const localT = Math.max(0, performance.now() / 1000 - (s.startTime || 0));
    if (s.phase === 'thinking') {
      return [base[0], 1.55 + 0.10 * Math.sin(localT * 2 + i), base[2]];
    }
    if (s.phase === 'flying') {
      const dt = Math.max(0, Math.min(1, (localT - 2.5) / 2.0));
      return [
        base[0] * (1 - dt),
        1.55 + 0.4 * Math.sin(dt * Math.PI),
        base[2] * (1 - dt),
      ];
    }
    if (s.phase === 'revealing' || s.phase === 'paying') {
      const angle = (i / N_BIDDERS) * Math.PI * 2;
      return [
        Math.cos(angle) * 1.9,
        1.55 + 0.1 * Math.sin(localT * 2 + i),
        Math.sin(angle) * 1.9,
      ];
    }
    return null;
  });

  return (
    <>
      <ambientLight intensity={0.32} color="#B8C0E0" />
      <directionalLight position={[8, 14, 6]} intensity={0.9} color="#FFFFFF" castShadow />
      <directionalLight position={[-6, 8, -4]} intensity={0.4} color="#A78BFA" />
      <pointLight position={[0, 5, 0]} intensity={1.4} color="#FFE5A0" distance={18} />
      {revealed && (
        <pointLight position={[bidderPos(s.winnerIdx)[0], 4, bidderPos(s.winnerIdx)[2]]}
          intensity={2.5} color="#34D399" distance={10} />
      )}

      <fog attach="fog" args={['#1a1530', 15, 50]} />

      <SkyDome />
      <MarbleFloor />
      <SpotlightBeam active={revealed} />

      <ItemInCenter revealed={revealed} winnerColor={winnerColor} />

      {s.bidders.map((b, i) => (
        <Bidder key={i} i={i} state={b} isWinnerPhase={isWinnerPhase} paying={s.phase === 'paying'} />
      ))}

      {/* Envelopes */}
      {s.bidders.map((b, i) => {
        const pos = envelopePositions[i];
        if (!pos) return null;
        const isHighlight = revealed && (b.isWinner || b.isSecond);
        const envColor = isHighlight ? (b.isWinner ? '#34D399' : '#FDB813') : '#FFFFFF';
        return (
          <mesh key={`env-${i}`} position={pos}>
            <boxGeometry args={[0.42, 0.06, 0.30]} />
            <meshStandardMaterial
              color={envColor}
              emissive={envColor}
              emissiveIntensity={revealed ? 1.5 : 0.5}
              roughness={0.55}
              metalness={0.1}
            />
          </mesh>
        );
      })}

      {/* Envelope trails */}
      <TrailDots trailRef={trailRef} />

      {/* Confetti */}
      <ConfettiBurst confettiRef={confettiRef} />

      <CinematicCamera phase={s.phase} />
    </>
  );
}

export default function VickreyScene({ phase }: { phase: string }) {
  const regime = useMemo(() => regimeForPhase(phase), [phase]);
  const [hud, setHud] = useState<{
    phase: string;
    values: number[];
    bids: number[];
    winner: number;
    pricePaid: number;
    isWinner: boolean[];
    isSecond: boolean[];
  }>({
    phase: 'thinking',
    values: new Array(N_BIDDERS).fill(0),
    bids: new Array(N_BIDDERS).fill(0),
    winner: 0,
    pricePaid: 0,
    isWinner: new Array(N_BIDDERS).fill(false),
    isSecond: new Array(N_BIDDERS).fill(false),
  });

  const confettiRef = useRef<Confetti[]>(
    Array.from({ length: MAX_CONFETTI }, () => ({
      x: 0, y: -1000, z: 0, vx: 0, vy: 0, vz: 0, life: 0,
      rotX: 0, rotY: 0, rotZ: 0, vrx: 0, vry: 0, vrz: 0,
      color: new THREE.Color('#FFFFFF'),
    }))
  );
  const trailRef = useRef<TrailPt[]>(
    Array.from({ length: MAX_TRAIL }, () => ({ x: 0, y: -1000, z: 0, life: 0, color: new THREE.Color('#FFFFFF') }))
  );

  const phaseLabels: Record<string, string> = {
    thinking: '✉ Sobres sellados',
    flying: '↗ Volando al centro',
    revealing: '★ ¡Revelando bids!',
    paying: '🎉 Ganador paga 2°',
    reset: '—',
  };

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #1a0d2e 0%, #03050A 80%)' }}
    >
      <Canvas
        camera={{ position: [0, 6, 9], fov: 42 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      >
        <AuctionSim key={phase} phase={phase} onState={setHud} confettiRef={confettiRef} trailRef={trailRef} />
      </Canvas>

      <div className="absolute top-6 left-6 text-[11px] font-mono pointer-events-none">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#64748B]">Subasta Vickrey</div>
        <div className="mt-1" style={{ color: regime.color }}>{regime.label}</div>
        <div className="text-[10px] text-[#94A3B8] mt-1">{phaseLabels[hud.phase] ?? hud.phase}</div>
      </div>

      <div className="absolute top-6 right-6 text-[10px] font-mono pointer-events-none space-y-1">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#64748B] mb-1.5 text-right">Postores</div>
        {hud.values.map((v, i) => {
          const showBid = hud.phase === 'revealing' || hud.phase === 'paying';
          const isWinner = hud.isWinner[i];
          const isSecond = hud.isSecond[i];
          const txtColor = isWinner ? '#34D399' : isSecond ? '#FDB813' : '#94A3B8';
          return (
            <div key={i} className="flex items-center gap-2 justify-end" style={{ color: txtColor }}>
              <span className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: BIDDER_COLORS[i], boxShadow: `0 0 6px ${BIDDER_COLORS[i]}` }} />
              <span>v={v.toFixed(0)}{showBid ? `, b=${hud.bids[i].toFixed(0)}` : ''}</span>
              {isWinner && showBid && <span className="text-[#34D399]">◀ gana</span>}
              {isSecond && showBid && <span className="text-[#FDB813]">◀ 2°</span>}
            </div>
          );
        })}
      </div>

      {hud.phase === 'paying' && (
        <div className="absolute bottom-32 left-6 text-[11px] font-mono pointer-events-none">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#64748B]">Resultado</div>
          <div className="text-[#34D399] mt-1">
            Postor {hud.winner + 1} gana · paga ${hud.pricePaid.toFixed(0)}
          </div>
          <div className="text-[10px] text-[#94A3B8]">
            (pagó el 2° más alto, no el suyo)
          </div>
        </div>
      )}
    </div>
  );
}
