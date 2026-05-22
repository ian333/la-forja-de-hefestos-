/**
 * NashMedicinaOstrom — Nash Cap 5 · Escena M4 · "La medicina amable"
 *
 * Gemela en espejo de OstromTragedia, pero al REVÉS:
 *   - Tragedia: bosque pleno → astronautas cosechan → todo muere
 *   - Medicina: comunidad reunida → reglas brotan → bosque florece
 *
 * Narrativa Ostrom 1990: comunidades con reglas propias, monitoreo mutuo,
 * sanciones graduadas, CAMBIAN el equilibrio de Nash sin estado ni violencia.
 *
 * Beats sincronizados con audio Matilda 30s:
 *   0-3s   Civilian central (Elinor) emerge con luz cálida
 *   3-6s   "Nobel" → star aparece sobre Elinor
 *   6-10s  "Filipinas, Alpes, Oaxaca" → 3 civilians aparecen con bandera
 *   10-16s "donde la gente se conoce" → 4 civilians más completan asamblea
 *   16-20s "reglas propias, no muere" → campfire prende, fish saltan, flores florecen
 *   20-24s "sin estado, sin privatizar" → trees expanden, bosque vibrante
 *   24-30s "se llama comunidad" → push-out a vista amplia contemplativa
 *
 * Color script: calidez humana (verdes vivos + cálidos suaves + acento dorado).
 * Bajo 280 LOC.
 */

import { useMemo, useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import AtomModel from '../assets/gltf/AtomModel';
import { LIBRARY } from '../assets/gltf/manifest';
import { MasterclassEnv } from '../assets/hdri';
import PostFX from '../scenes/_postFX';
import type { ShapeMode } from '../assets/shapes/_BaseShape';

function readInitialMode(): ShapeMode {
  if (typeof window === 'undefined') return 'atom';
  try {
    const m = localStorage.getItem('nashMedicinaMode');
    if (m === 'solid' || m === 'wireframe' || m === 'edges' || m === 'atom') return m;
  } catch {}
  return 'atom';
}

const AUDIO_URL = '/audio/preview-nash-medicina-m4/nash-medicina-m4.mp3';

AtomModel.preload(LIBRARY.civilian_a.src);
AtomModel.preload(LIBRARY.civilian_b.src);
AtomModel.preload(LIBRARY.civilian_c.src);
AtomModel.preload(LIBRARY.civilian_d.src);
AtomModel.preload(LIBRARY.civilian_e.src);
AtomModel.preload(LIBRARY.civilian_f.src);
AtomModel.preload(LIBRARY.civilian_g.src);
AtomModel.preload(LIBRARY.civilian_h.src);
AtomModel.preload(LIBRARY.civilian_i.src);
AtomModel.preload(LIBRARY.tree_oak.src);
AtomModel.preload(LIBRARY.tree_pine.src);
AtomModel.preload(LIBRARY.fish.src);
AtomModel.preload(LIBRARY.flower_yellow.src);
AtomModel.preload(LIBRARY.flower_purple.src);
AtomModel.preload(LIBRARY.house.src);
AtomModel.preload(LIBRARY.campfire.src);
AtomModel.preload(LIBRARY.star.src);

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function rng(seed: number, i: number): number {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const TOTAL_DURATION = 30;

// ─────────────────────────────────────────────────────────────
// FadeItem — aparece en tAppear y se mantiene; scale crece, opacity ↗

interface FadeItemProps {
  position: [number, number, number];
  scale: number;
  rotationY: number;
  src: string;
  color: string;
  tAppear: number;
  duration?: number;
  timeRef: { current: number };
  mode: ShapeMode;
  glow?: number;
  bob?: boolean;
}

function FadeItem({
  position, scale, rotationY, src, color,
  tAppear, duration = 1.5, timeRef, mode, glow = 1.0, bob = false,
}: FadeItemProps) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    const t = timeRef.current;
    const a = clamp((t - tAppear) / duration, 0, 1);
    const eased = easeOutCubic(a);
    groupRef.current.visible = a > 0.01;
    const bobY = bob ? Math.sin(t * 1.4 + position[0]) * 0.06 : 0;
    groupRef.current.position.y = position[1] + bobY;
    groupRef.current.scale.setScalar(scale * eased);
  });
  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <AtomModel src={src} color={color} glow={glow} mode={mode} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Pez saltando — arco entre dos puntos del círculo de civilians,
// representa intercambio de recurso bajo reglas comunes.

interface JumpingFishProps {
  fromAngle: number;
  toAngle: number;
  radius: number;
  tStart: number;
  cycle: number;
  color: string;
  scale: number;
  timeRef: { current: number };
  mode: ShapeMode;
}

function JumpingFish({
  fromAngle, toAngle, radius, tStart, cycle, color, scale, timeRef, mode,
}: JumpingFishProps) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    const t = timeRef.current;
    if (t < tStart) { groupRef.current.visible = false; return; }
    const phase = ((t - tStart) % cycle) / cycle;
    const eased = easeInOutCubic(phase);
    const ang = fromAngle + (toAngle - fromAngle) * eased;
    const x = Math.cos(ang) * radius;
    const z = Math.sin(ang) * radius;
    const y = 0.4 + Math.sin(phase * Math.PI) * 1.4;
    groupRef.current.position.set(x, y, z);
    groupRef.current.rotation.set(
      Math.sin(phase * Math.PI) * 0.4,
      ang + Math.PI / 2,
      Math.cos(phase * Math.PI * 2) * 0.3,
    );
    groupRef.current.scale.setScalar(scale);
    groupRef.current.visible = true;
  });
  return (
    <group ref={groupRef} scale={scale}>
      <AtomModel src={LIBRARY.fish.src} color={color} glow={1.0} mode={mode} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Campfire central pulsando — el focal point (Schelling) de la comunidad

function PulsingCampfire({ timeRef, mode }: { timeRef: { current: number }; mode: ShapeMode }) {
  const groupRef = useRef<THREE.Group>(null);
  const tAppear = 16;
  useFrame(() => {
    if (!groupRef.current) return;
    const t = timeRef.current;
    const a = clamp((t - tAppear) / 2.0, 0, 1);
    const eased = easeOutCubic(a);
    const pulse = 1 + Math.sin(t * 3.2) * 0.08;
    groupRef.current.visible = a > 0.01;
    groupRef.current.scale.setScalar(0.85 * eased * pulse);
  });
  return (
    <group ref={groupRef} position={[0, 0, 0]} scale={0.55}>
      <AtomModel src={LIBRARY.campfire.src} color="#FF9F4D" glow={0.7} mode={mode} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// CameraDirector — orbit + push-out al final

function CameraDirector({ timeRef, loopRef }: {
  timeRef: { current: number };
  loopRef: { current: number };
}) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current % loopRef.current;
    const orbit = -0.4 + t * 0.035;
    // Push-in al campfire en t=16-20
    const pushIn = easeInOutCubic(clamp((t - 16) / 4, 0, 1));
    // Pull-back contemplativo en t=22-30
    const pullBack = easeInOutCubic(clamp((t - 22) / 8, 0, 1));
    const dist = 14 - pushIn * 2 + pullBack * 6;
    const height = 5 + Math.sin(t * 0.12) * 0.8 - pushIn * 0.6 + pullBack * 2;
    camera.position.set(Math.sin(orbit) * dist, height, Math.cos(orbit) * dist);
    camera.lookAt(0, 0.6, 0);
  });
  return null;
}

// ─────────────────────────────────────────────────────────────
// Scene content

function SceneContent({ audioRef, isPlaying, mode }: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  mode: ShapeMode;
}) {
  const initialTime = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const params = new URLSearchParams(window.location.search);
    const t = parseFloat(params.get('t') || '0');
    return isNaN(t) ? 0 : t;
  }, []);
  const timeRef = useRef(initialTime);
  const loopRef = useRef(TOTAL_DURATION + 3);

  // 8 civilians en círculo (la asamblea Ostrom)
  const assembly = useMemo(() => {
    const srcs = [
      LIBRARY.civilian_a.src, LIBRARY.civilian_b.src, LIBRARY.civilian_c.src,
      LIBRARY.civilian_d.src, LIBRARY.civilian_e.src, LIBRARY.civilian_f.src,
      LIBRARY.civilian_g.src, LIBRARY.civilian_h.src,
    ];
    // Tints cálidos LatAm (terracota, dorado, ocre, oliva, salmón, ámbar)
    const colors = ['#FFD89E', '#F5C078', '#E8C39E', '#FFB870', '#D9A86C', '#E8B57A', '#F0C8A0', '#E5C28E'];
    return srcs.map((src, i) => {
      const theta = (i / srcs.length) * Math.PI * 2 + 0.2;
      const radius = 4.5;
      return {
        src,
        color: colors[i],
        pos: [Math.cos(theta) * radius, 0, Math.sin(theta) * radius] as [number, number, number],
        rotY: -theta + Math.PI / 2 + Math.PI, // mirando al centro
        // Primeros 3 aparecen en 6-10s (Filipinas/Alpes/Oaxaca beats)
        // Los otros 5 en 10-16s (donde la gente se conoce)
        tAppear: i < 3 ? 6 + i * 1.2 : 10 + (i - 3) * 1.0,
      };
    });
  }, []);

  // Outer ring: trees mezclados (bosque común)
  const forest = useMemo(() => {
    const arr: Array<{ pos: [number, number, number]; scale: number; rotY: number; src: string; color: string; tAppear: number }> = [];
    const count = 18;
    const treeSrcs = [LIBRARY.tree_oak.src, LIBRARY.tree_pine.src, LIBRARY.tree_oak.src];
    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 2 + rng(11, i) * 0.2;
      const r = 8.5 + rng(13, i) * 1.8;
      const greenH = 0.28 + rng(17, i) * 0.08;
      const greenS = 0.55 + rng(19, i) * 0.20;
      const greenL = 0.42 + rng(23, i) * 0.12;
      const c = new THREE.Color().setHSL(greenH, greenS, greenL);
      arr.push({
        pos: [Math.cos(theta) * r, 0, Math.sin(theta) * r],
        scale: 0.9 + rng(29, i) * 0.6,
        rotY: rng(31, i) * Math.PI * 2,
        src: treeSrcs[i % treeSrcs.length],
        color: '#' + c.getHexString(),
        tAppear: 20 + (i / count) * 4, // "sin estado, sin privatizar" → bosque florece
      });
    }
    return arr;
  }, []);

  // Flores esparcidas — abundancia preservada
  const flowers = useMemo(() => {
    const arr: Array<{ pos: [number, number, number]; scale: number; rotY: number; src: string; color: string; tAppear: number }> = [];
    const count = 18;
    for (let i = 0; i < count; i++) {
      const theta = rng(37, i) * Math.PI * 2;
      const r = 2.5 + rng(41, i) * 5.5;
      const isYellow = i % 2 === 0;
      arr.push({
        pos: [Math.cos(theta) * r, 0, Math.sin(theta) * r],
        scale: 0.45 + rng(43, i) * 0.3,
        rotY: rng(47, i) * Math.PI * 2,
        src: isYellow ? LIBRARY.flower_yellow.src : LIBRARY.flower_purple.src,
        color: isYellow ? '#FBBF24' : '#C4B5FD',
        tAppear: 17 + (i / count) * 6, // brotan con las reglas
      });
    }
    return arr;
  }, []);

  // Aldea al fondo (4 casas LatAm)
  const villages = useMemo(() => {
    return [
      { angle: Math.PI * 0.15, color: '#D97757' },
      { angle: Math.PI * 0.75, color: '#C97A5A' },
      { angle: Math.PI * 1.25, color: '#D88862' },
      { angle: Math.PI * 1.78, color: '#CE8060' },
    ].map((v, i) => ({
      pos: [Math.cos(v.angle) * 11.5, 0, Math.sin(v.angle) * 11.5] as [number, number, number],
      rotY: -v.angle + Math.PI / 2 + Math.PI,
      color: v.color,
      tAppear: 10 + i * 0.6,
    }));
  }, []);

  // Peces saltando entre civilians (recurso intercambiado bajo reglas)
  const fishJumps = useMemo(() => {
    return [
      { fromI: 0, toI: 3, color: '#34D399', tStart: 18, cycle: 3.5 },
      { fromI: 2, toI: 5, color: '#6EE7B7', tStart: 19, cycle: 3.8 },
      { fromI: 4, toI: 7, color: '#5EEAD4', tStart: 20, cycle: 3.2 },
      { fromI: 6, toI: 1, color: '#34D399', tStart: 21, cycle: 3.6 },
    ];
  }, []);

  const frameCountRef = useRef(0);
  useFrame((_, dt) => {
    frameCountRef.current++;
    if (frameCountRef.current === 1) console.log('[Nash] first useFrame, initialTime=', timeRef.current);
    if (isPlaying && audioRef.current && !audioRef.current.paused) {
      timeRef.current = audioRef.current.currentTime;
    } else {
      timeRef.current = (timeRef.current + Math.min(dt, 0.1)) % loopRef.current;
    }
    if (typeof window !== 'undefined') (window as any).__sceneTime = timeRef.current;
  });

  return (
    <>
      <MasterclassEnv preset="studio" intensity={0.35} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[6, 14, 8]} intensity={0.55} color="#FFD9A0" />
      <directionalLight position={[-7, 4, -6]} intensity={0.35} color="#9CE5B8" />
      <pointLight position={[0, 1.5, 0]} intensity={0.20} distance={6} color="#FF9F4D" />
      <fog attach="fog" args={['#0a1610', 16, 42]} />
      <CameraDirector timeRef={timeRef} loopRef={loopRef} />

      {/* Civilian central (Elinor Ostrom) — siempre el primero en aparecer */}
      <FadeItem
        position={[0, 0, 0]}
        scale={1.1}
        rotationY={0}
        src={LIBRARY.civilian_i.src}
        color="#FFE5A0"
        tAppear={0.3}
        duration={2.5}
        timeRef={timeRef}
        mode={mode}
        glow={1.0}
      />

      {/* Estrella sobre Elinor (Nobel) en t=3-4 */}
      <group position={[0, 3.2, 0]}>
        <FadeItem
          position={[0, 0, 0]}
          scale={0.5}
          rotationY={0}
          src={LIBRARY.star.src}
          color="#FFD700"
          tAppear={3.2}
          duration={1.5}
          timeRef={timeRef}
          mode={mode}
          glow={1.2}
          bob
        />
      </group>

      {/* Asamblea — 8 civilians en círculo */}
      {assembly.map((c, i) => (
        <FadeItem
          key={`a-${i}`}
          position={c.pos}
          scale={0.95}
          rotationY={c.rotY}
          src={c.src}
          color={c.color}
          tAppear={c.tAppear}
          duration={1.2}
          timeRef={timeRef}
          mode={mode}
          glow={1.0}
        />
      ))}

      {/* Bosque común — outer ring */}
      {forest.map((f, i) => (
        <FadeItem
          key={`f-${i}`}
          position={f.pos}
          scale={f.scale}
          rotationY={f.rotY}
          src={f.src}
          color={f.color}
          tAppear={f.tAppear}
          duration={2.0}
          timeRef={timeRef}
          mode={mode}
          glow={0.9}
        />
      ))}

      {/* Flores — abundancia */}
      {flowers.map((fl, i) => (
        <FadeItem
          key={`fl-${i}`}
          position={fl.pos}
          scale={fl.scale}
          rotationY={fl.rotY}
          src={fl.src}
          color={fl.color}
          tAppear={fl.tAppear}
          duration={1.0}
          timeRef={timeRef}
          mode={mode}
          glow={0.9}
        />
      ))}

      {/* Aldea LatAm — 4 casas */}
      {villages.map((v, i) => (
        <FadeItem
          key={`v-${i}`}
          position={v.pos}
          scale={1.0}
          rotationY={v.rotY}
          src={LIBRARY.house.src}
          color={v.color}
          tAppear={v.tAppear}
          duration={1.8}
          timeRef={timeRef}
          mode={mode}
          glow={0.8}
        />
      ))}

      {/* Campfire central — focal point */}
      <PulsingCampfire timeRef={timeRef} mode={mode} />

      {/* Peces saltando — recurso intercambiado */}
      {fishJumps.map((j, i) => {
        const from = assembly[j.fromI];
        const to = assembly[j.toI];
        if (!from || !to) return null;
        const fromAngle = Math.atan2(from.pos[2], from.pos[0]);
        const toAngle = Math.atan2(to.pos[2], to.pos[0]);
        return (
          <JumpingFish
            key={`j-${i}`}
            fromAngle={fromAngle}
            toAngle={toAngle}
            radius={4.5}
            tStart={j.tStart}
            cycle={j.cycle}
            color={j.color}
            scale={0.6}
            timeRef={timeRef}
            mode={mode}
          />
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Top-level

interface NashMedicinaOstromProps {
  forceAspect?: '9:16' | '16:9' | 'auto';
}

export default function NashMedicinaOstrom({ forceAspect = 'auto' }: NashMedicinaOstromProps) {
  const aspect: '9:16' | '16:9' =
    forceAspect === 'auto'
      ? typeof window !== 'undefined' && window.innerHeight > window.innerWidth
        ? '9:16'
        : '16:9'
      : forceAspect;
  const fov = aspect === '9:16' ? 55 : 42;

  const isScreenshotMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('t');
  }, []);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [mode, setMode] = useState<ShapeMode>(readInitialMode);

  useEffect(() => {
    try { localStorage.setItem('nashMedicinaMode', mode); } catch {}
  }, [mode]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      setIsPlaying(false);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        }
      }, 3000);
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, []);

  const handlePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().then(() => {
      setIsPlaying(true);
      setHasStarted(true);
    }).catch(e => console.warn('autoplay blocked', e));
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 50%, #1a2418 0%, #050a07 78%)' }}
    >
      <audio ref={audioRef} src={AUDIO_URL} preload="auto" />

      <Canvas
        camera={{ position: [12, 5, 8], fov, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.90,
          alpha: false,
        }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <SceneContent audioRef={audioRef} isPlaying={isPlaying} mode={mode} />
        </Suspense>
        <PostFX
          intensity={0.18}
          threshold={0.90}
          smoothing={0.10}
          vignette={0.65}
          vignetteOffset={0.30}
          aberration={0}
        />
      </Canvas>

      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/35 to-transparent"
          style={{ height: '10%' }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent"
          style={{ height: '22%' }}
        />
        <div className="absolute top-6 left-6 text-[10px] uppercase tracking-[0.3em] text-[#A7D1B8]/70 font-mono">
          Nash · Cap 5 · La medicina · M4 Ostrom
        </div>

        <div className="absolute top-6 right-6 flex gap-1 font-mono pointer-events-auto">
          {(['solid', 'wireframe', 'edges', 'atom'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-1 text-[10px] uppercase tracking-wider border transition-all ${
                mode === m
                  ? 'border-[#A7D1B8] text-[#A7D1B8] bg-[#A7D1B8]/10'
                  : 'border-[#A7D1B8]/20 text-[#A7D1B8]/40 hover:text-[#A7D1B8]/70 hover:border-[#A7D1B8]/40'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="absolute bottom-10 left-0 right-0 text-center font-mono">
          <div className="text-[#A7D1B8]/80 text-sm tracking-wider">
            comunidad · reglas propias · monitoreo mutuo · sin violencia
          </div>
        </div>
      </div>

      {!hasStarted && !isScreenshotMode && (
        <button
          onClick={handlePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer group"
          style={{ zIndex: 50 }}
        >
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-20 h-20 rounded-full border-2 border-[#A7D1B8] flex items-center justify-center group-hover:scale-110 transition-transform"
              style={{ boxShadow: '0 0 30px rgba(167, 209, 184, 0.6)' }}
            >
              <div className="text-[#A7D1B8] text-3xl ml-1.5">▶</div>
            </div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#A7D1B8]/75 font-mono">
              Nash · Cap 5 · M4 La medicina · ~30s
            </div>
            <div className="text-[10px] text-[#A7D1B8]/45 font-mono">
              audífonos recomendados
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
