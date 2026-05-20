/**
 * OstromTragedia — escena dogfood de la library.
 *
 * Nobel 15 · Elinor Ostrom (2009) · "Tragedia de los Comunes" (refutada).
 *
 * Dramatiza el COLAPSO predicho por Hardin (1968):
 *   - 40 árboles + 12 hongos/flores/cactus + 2 astronautas (cosechadores) +
 *     1 log_stack (recurso extraído) en un bosque circular.
 *   - Cámara orbita lento, contemplativa.
 *   - Timeline 0-30s: los árboles desaparecen progresivamente, simulando la
 *     sobrexplotación racional individual que destruye el recurso común.
 *
 * Estética: atom-style (edges + halo + emissive) sobre HDRI moonless_golf
 * (noche urbana cálida) para mood "última hora del crepúsculo del bosque".
 *
 * Bajo 200 LOC.
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
    const m = localStorage.getItem('ostromMode');
    if (m === 'solid' || m === 'wireframe' || m === 'edges' || m === 'atom') return m;
  } catch {}
  return 'atom';
}

const AUDIO_URL = '/audio/preview-ostrom/ostrom-tragedia.mp3';

// Preload todos los GLBs al cargar el módulo — evita que Suspense corte
// la escena cuando los Harvester/LogPile aparecen mid-animation.
AtomModel.preload(LIBRARY.tree.src);
AtomModel.preload(LIBRARY.mushroom.src);
AtomModel.preload(LIBRARY.flower.src);
AtomModel.preload(LIBRARY.cactus.src);
AtomModel.preload(LIBRARY.bush.src);
AtomModel.preload(LIBRARY.astronaut.src);
AtomModel.preload(LIBRARY.log_stack.src);

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Determinístico para que el "orden de muerte" sea reproducible
function rng(seed: number, i: number): number {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ─────────────────────────────────────────────────────────────
// Forest item — un instance del bosque con su propio "muere en t=tDeath"

interface ForestItemProps {
  position: [number, number, number];
  scale: number;
  rotationY: number;
  src: string;
  color: string;
  tDeathRef: { current: number };
  myTDeath: number;
  mode: ShapeMode;
}

function ForestItem({ position, scale, rotationY, src, color, tDeathRef, myTDeath, mode }: ForestItemProps) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    const t = tDeathRef.current;
    if (t < myTDeath) {
      groupRef.current.position.y = position[1];
      groupRef.current.scale.setScalar(scale);
      groupRef.current.visible = true;
    } else {
      const dying = clamp((t - myTDeath) / 2.0, 0, 1);
      const eased = easeInOutCubic(dying);
      groupRef.current.position.y = position[1] - eased * 0.6;
      groupRef.current.scale.setScalar(scale * (1 - eased * 0.4));
      groupRef.current.visible = dying < 0.99;
    }
  });
  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <AtomModel src={src} color={color} glow={1.2} mode={mode} scale={1} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Camera orbit suave + push-in al final

function CameraDirector({ timeRef, loopRef }: {
  timeRef: { current: number };
  loopRef: { current: number };
}) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current % loopRef.current;
    const orbit = 0.2 + t * 0.04;
    // Al final del colapso, push-in para enfatizar el vacío
    const collapseProgress = easeInOutCubic(clamp((t - 22) / 8, 0, 1));
    const dist = 16 - 4 * collapseProgress;
    const height = 5 + 2 * Math.sin(t * 0.15) - 1.5 * collapseProgress;
    camera.position.set(Math.sin(orbit) * dist, height, Math.cos(orbit) * dist);
    camera.lookAt(0, 0.5 - 0.3 * collapseProgress, 0);
  });
  return null;
}

// ─────────────────────────────────────────────────────────────
// Scene content

// Sincronizado a audio Matilda 32.44s (ostrom-tragedia.mp3).
// Beats narrativos:
//   0-6s   "Un bosque. Seis pastores."              bosque pleno
//   6-14s  "Nadie es dueño. Mil novecientos..."     contemplación + entran cosechadores
//   14-23s "Su predicción es brutal..."             trees empiezan a morir
//   23-27s "ahora es un desierto"                   colapso máximo + push-in
//   27-32s "Los pastores no son malos..."           silencio del vacío
const TOTAL_DURATION = 33;
const TREES_COUNT = 36;
const FILLER_COUNT = 14;
const FOREST_RADIUS = 6.0;

function SceneContent({ aspect: _aspect, audioRef, isPlaying, mode }: {
  aspect: '9:16' | '16:9';
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  mode: ShapeMode;
}) {
  void _aspect;
  // Soporta ?t=N en URL para empezar en timestamp arbitrario (modo screenshot)
  const initialTime = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const params = new URLSearchParams(window.location.search);
    const t = parseFloat(params.get('t') || '0');
    return isNaN(t) ? 0 : t;
  }, []);
  const timeRef = useRef(initialTime);
  const loopRef = useRef(TOTAL_DURATION + 4); // 4s extra de "vacío contemplativo"

  // Distribución determinística del bosque
  const trees = useMemo(() => {
    const arr: Array<{ pos: [number, number, number]; scale: number; rotY: number; tDeath: number; color: string }> = [];
    // Trees: en ring + jitter
    for (let i = 0; i < TREES_COUNT; i++) {
      const theta = (i / TREES_COUNT) * Math.PI * 2 + rng(7, i) * 0.3;
      const r = FOREST_RADIUS * (0.5 + rng(11, i) * 0.7);
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const scale = 0.7 + rng(13, i) * 0.6;
      const rotY = rng(17, i) * Math.PI * 2;
      // Mueren entre t=14 y t=28 sincronizado con "predicción brutal" → "desierto"
      const tDeath = 14 + (i / TREES_COUNT) * 14 + rng(19, i) * 1.5;
      // Variación cálida verde
      const greenH = 0.30 + rng(23, i) * 0.05;
      const greenS = 0.5 + rng(29, i) * 0.2;
      const greenL = 0.35 + rng(31, i) * 0.15;
      const c = new THREE.Color().setHSL(greenH, greenS, greenL);
      arr.push({ pos: [x, 0, z], scale, rotY, tDeath, color: '#' + c.getHexString() });
    }
    return arr;
  }, []);

  const fillers = useMemo(() => {
    const types = [
      { src: LIBRARY.mushroom.src, color: '#D7263D' },
      { src: LIBRARY.mushroom.src, color: '#FF7A45' },
      { src: LIBRARY.flower.src, color: '#FBBF24' },
      { src: LIBRARY.flower.src, color: '#A78BFA' },
      { src: LIBRARY.cactus.src, color: '#5BA34A' },
      { src: LIBRARY.bush.src, color: '#3D8C5A' },
    ];
    const arr: Array<{ pos: [number, number, number]; scale: number; rotY: number; tDeath: number; src: string; color: string }> = [];
    for (let i = 0; i < FILLER_COUNT; i++) {
      const theta = rng(41, i) * Math.PI * 2;
      const r = (0.3 + rng(43, i) * 0.9) * FOREST_RADIUS;
      const t = types[i % types.length];
      arr.push({
        pos: [Math.cos(theta) * r, 0, Math.sin(theta) * r],
        scale: 0.45 + rng(47, i) * 0.4,
        rotY: rng(53, i) * Math.PI * 2,
        // Fillers mueren entre t=11 y t=25 (un poco antes que árboles)
        tDeath: 11 + (i / FILLER_COUNT) * 14,
        src: t.src,
        color: t.color,
      });
    }
    return arr;
  }, []);

  // Astronautas — cosechadores que aparecen para "tomar" del bosque
  const harvesters = useMemo(() => {
    return [
      // Aparecen en sync con "Mil novecientos sesenta y ocho..." (Hardin intro)
      { pos: [3.5, 0, 2.5] as [number, number, number], rotY: -0.5, tAppear: 9 },
      { pos: [-3.0, 0, 3.0] as [number, number, number], rotY: 2.0, tAppear: 12 },
      { pos: [1.0, 0, -3.5] as [number, number, number], rotY: 1.5, tAppear: 17 },
    ];
  }, []);

  useFrame((_, dt) => {
    // Si hay audio reproduciéndose, sincronizamos timeRef con audio.currentTime
    // para evitar drift entre voz y visual.
    if (isPlaying && audioRef.current && !audioRef.current.paused) {
      timeRef.current = audioRef.current.currentTime;
    } else {
      timeRef.current = (timeRef.current + Math.min(dt, 0.1)) % loopRef.current;
    }
    if (typeof window !== 'undefined') (window as any).__sceneTime = timeRef.current;
  });

  return (
    <>
      <MasterclassEnv preset="urban_night" intensity={0.4} />
      <ambientLight intensity={0.20} />
      <directionalLight position={[8, 12, 6]} intensity={0.5} color="#FFB870" />
      <directionalLight position={[-6, 4, -8]} intensity={0.4} color="#7FB0FF" />
      <fog attach="fog" args={['#08050c', 8, 30]} />
      <CameraDirector timeRef={timeRef} loopRef={loopRef} />

      {/* Trees forest */}
      {trees.map((t, i) => (
        <ForestItem
          key={`t-${i}`}
          position={t.pos}
          scale={t.scale}
          rotationY={t.rotY}
          src={LIBRARY.tree.src}
          color={t.color}
          tDeathRef={timeRef}
          myTDeath={t.tDeath}
          mode={mode}
        />
      ))}

      {/* Fillers — mushrooms, flowers, cactus */}
      {fillers.map((f, i) => (
        <ForestItem
          key={`f-${i}`}
          position={f.pos}
          scale={f.scale}
          rotationY={f.rotY}
          src={f.src}
          color={f.color}
          tDeathRef={timeRef}
          myTDeath={f.tDeath}
          mode={mode}
        />
      ))}

      {/* Astronautas cosechadores (no mueren, observan) */}
      {harvesters.map((h, i) => (
        <Harvester key={`h-${i}`} {...h} timeRef={timeRef} mode={mode} />
      ))}

      {/* Log stack central — el "recurso extraído" que crece con cada árbol caído */}
      <LogPile timeRef={timeRef} mode={mode} />
    </>
  );
}

// Astronauta cosechador — siempre montado, controlamos visibilidad via ref
// (evita re-mount que dispararía Suspense mid-animation)
function Harvester({ pos, rotY, tAppear, timeRef, mode }: {
  pos: [number, number, number];
  rotY: number;
  tAppear: number;
  timeRef: { current: number };
  mode: ShapeMode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    const t = timeRef.current;
    const a = clamp((t - tAppear) / 1.5, 0, 1);
    groupRef.current.visible = a > 0.01;
    groupRef.current.scale.setScalar(0.8 * a);
  });
  return (
    <group ref={groupRef} position={pos} rotation={[0, rotY, 0]} scale={0.001}>
      {/* Astronautas SÍ con halo — son "actores" (hero-level), no crowd */}
      <AtomModel src={LIBRARY.astronaut.src} color="#E8E8F5" glow={0.9} mode={mode} />
    </group>
  );
}

// Pila de logs creciente — siempre montada, scale via ref
function LogPile({ timeRef, mode }: { timeRef: { current: number }; mode: ShapeMode }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    const t = timeRef.current;
    const grow = clamp((t - 13) / 17, 0, 1);
    const target = Math.max(0.001, grow * 1.4);
    groupRef.current.scale.setScalar(target);
    groupRef.current.visible = grow > 0.02;
  });
  return (
    <group ref={groupRef} position={[0, 0, 0]} scale={0.001}>
      <AtomModel src={LIBRARY.log_stack.src} color="#A0522D" glow={1.2} mode={mode} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Top-level

interface OstromTragediaProps {
  forceAspect?: '9:16' | '16:9' | 'auto';
}

export default function OstromTragedia({ forceAspect = 'auto' }: OstromTragediaProps) {
  const aspect: '9:16' | '16:9' =
    forceAspect === 'auto'
      ? typeof window !== 'undefined' && window.innerHeight > window.innerWidth
        ? '9:16'
        : '16:9'
      : forceAspect;
  const fov = aspect === '9:16' ? 55 : 42;

  // Modo screenshot (?t=N) — bypassa audio para no bloquear con autoplay
  const isScreenshotMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('t');
  }, []);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [mode, setMode] = useState<ShapeMode>(readInitialMode);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      setIsPlaying(false);
      // Loop: espera 3s, reinicia
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
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #1a1320 0%, #050308 80%)' }}
    >
      <audio ref={audioRef} src={AUDIO_URL} preload="auto" />

      <Canvas
        camera={{ position: [12, 5, 8], fov, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
          alpha: false,
        }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <SceneContent aspect={aspect} audioRef={audioRef} isPlaying={isPlaying} mode={mode} />
        </Suspense>
        <PostFX
          intensity={1.6}
          threshold={0.18}
          smoothing={0.45}
          vignette={0.75}
          vignetteOffset={0.20}
          aberration={0.0012}
        />
      </Canvas>

      {/* HUD mínimo — UN tag arriba, UN texto narrativo abajo */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/40 to-transparent"
          style={{ height: '10%' }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent"
          style={{ height: '20%' }}
        />
        <div className="absolute top-6 left-6 text-[10px] uppercase tracking-[0.3em] text-[#FFE5A0]/55 font-mono">
          Ostrom · 2009 · Tragedia de los Comunes
        </div>

        {/* Mode toggle — esquina superior derecha, pointer-events activas */}
        <div className="absolute top-6 right-6 flex gap-1 font-mono pointer-events-auto">
          {(['solid', 'wireframe', 'edges', 'atom'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-1 text-[10px] uppercase tracking-wider border transition-all ${
                mode === m
                  ? 'border-[#FDB813] text-[#FDB813] bg-[#FDB813]/10'
                  : 'border-[#FFE5A0]/20 text-[#FFE5A0]/40 hover:text-[#FFE5A0]/70 hover:border-[#FFE5A0]/40'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="absolute bottom-10 left-0 right-0 text-center font-mono">
          <div className="text-[#FFE5A0]/70 text-sm tracking-wider">
            seis pastores · un mismo bosque · ninguna regla
          </div>
        </div>
      </div>

      {/* Play button — solo antes de empezar y fuera de modo screenshot */}
      {!hasStarted && !isScreenshotMode && (
        <button
          onClick={handlePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer group"
          style={{ zIndex: 50 }}
        >
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-20 h-20 rounded-full border-2 border-[#FDB813] flex items-center justify-center group-hover:scale-110 transition-transform"
              style={{ boxShadow: '0 0 30px rgba(253, 184, 19, 0.6)' }}
            >
              <div className="text-[#FDB813] text-3xl ml-1.5">▶</div>
            </div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#FDB813]/70 font-mono">
              Ostrom · Cap 1 · Tragedia · ~30s
            </div>
            <div className="text-[10px] text-[#FDB813]/40 font-mono">
              audífonos recomendados
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
