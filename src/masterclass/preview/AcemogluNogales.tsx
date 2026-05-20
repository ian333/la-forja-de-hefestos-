/**
 * AcemogluNogales — Two Worlds, Nobel 2024.
 *
 * Misma latitud. Misma gente. Diferentes instituciones.
 * Una barda divide Nogales AZ (próspera) de Nogales Sonora (modesta).
 *
 * Layout (vista desde el sur):
 *   Sonora (izq, x<0)  ──wall──  Arizona (der, x>0)
 *   · casa modesta             · casa próspera
 *   · cactus + bush            · árbol verde + flag
 *   · policía (extractive)     · oficina alta + tower
 *   · flag más opaco            · oficina + tower (instituciones)
 *
 * Timeline 30s (sincronizado con audio Matilda):
 *   0-4s    wide contemplativo, todo oscuro
 *   4-10s   reveal del wall (apparition)
 *   10-18s  brightening Arizona (lado derecho)
 *   18-24s  brightening Sonora más tenue (lado izquierdo)
 *   24-30s  orbit lento contrastando ambos lados, push-in al wall
 */

import { useMemo, useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import AtomModel from '../assets/gltf/AtomModel';
import { LIBRARY } from '../assets/gltf/manifest';
import { MasterclassEnv } from '../assets/hdri';
import PostFX from '../scenes/_postFX';
import type { ShapeMode } from '../assets/shapes/_BaseShape';

const AUDIO_URL = '/audio/preview-acemoglu/acemoglu-nogales.mp3';

// Preload todos los assets para evitar Suspense mid-animation
AtomModel.preload(LIBRARY.wall.src);
AtomModel.preload(LIBRARY.house.src);
AtomModel.preload(LIBRARY.office.src);
AtomModel.preload(LIBRARY.tower.src);
AtomModel.preload(LIBRARY.flag.src);
AtomModel.preload(LIBRARY.tree.src);
AtomModel.preload(LIBRARY.cactus.src);
AtomModel.preload(LIBRARY.bush.src);
AtomModel.preload(LIBRARY.soldier.src);
AtomModel.preload(LIBRARY.police.src);

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function readInitialMode(): ShapeMode {
  if (typeof window === 'undefined') return 'atom';
  try {
    const m = localStorage.getItem('acemogluMode');
    if (m === 'solid' || m === 'wireframe' || m === 'edges' || m === 'atom') return m;
  } catch {}
  return 'atom';
}

// ─────────────────────────────────────────────────────────────
// Fade-in item: aparece a partir de tAppear, mantiene visible

interface FadeItemProps {
  src: string;
  color: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  glow?: number;
  tAppear: number;
  fadeDuration?: number;
  timeRef: { current: number };
  mode: ShapeMode;
}

function FadeItem({
  src, color, position, rotationY = 0, scale = 1, glow = 1.0,
  tAppear, fadeDuration = 2, timeRef, mode,
}: FadeItemProps) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    const t = timeRef.current;
    const a = clamp((t - tAppear) / fadeDuration, 0, 1);
    const eased = easeInOutCubic(a);
    groupRef.current.visible = a > 0.01;
    groupRef.current.scale.setScalar(Math.max(0.001, scale * eased));
  });
  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]} scale={0.001}>
      <AtomModel src={src} color={color} glow={glow} mode={mode} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Wall segments — un muro extendido en Z formado por varios instances

function WallBorder({ tAppear, timeRef, mode }: {
  tAppear: number;
  timeRef: { current: number };
  mode: ShapeMode;
}) {
  // 5 segmentos del wall a lo largo del eje Z, todos en x=0
  const segments: Array<{ z: number; tDelay: number }> = useMemo(() => [
    { z: -4, tDelay: 0.0 },
    { z: -2, tDelay: 0.2 },
    { z:  0, tDelay: 0.4 },
    { z:  2, tDelay: 0.6 },
    { z:  4, tDelay: 0.8 },
  ], []);
  return (
    <>
      {segments.map((s, i) => (
        <FadeItem
          key={`wall-${i}`}
          src={LIBRARY.wall.src}
          color="#A89B8C"
          position={[0, 0, s.z]}
          scale={1.2}
          glow={1.0}
          tAppear={tAppear + s.tDelay}
          fadeDuration={1.5}
          timeRef={timeRef}
          mode={mode}
        />
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Camera: wide → push-in al wall → orbit lento

function CameraDirector({ timeRef, loopRef }: {
  timeRef: { current: number };
  loopRef: { current: number };
}) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current % loopRef.current;
    // Orbit lento alrededor del wall (eje Y)
    const orbit = -0.15 + t * 0.025;
    const dist = 16 - 3 * easeInOutCubic(clamp((t - 22) / 8, 0, 1));
    const height = 5 + 1.5 * Math.sin(t * 0.12);
    camera.position.set(Math.sin(orbit) * dist, height, Math.cos(orbit) * dist);
    camera.lookAt(0, 0.8, 0);
  });
  return null;
}

// ─────────────────────────────────────────────────────────────
// Scene content

const TOTAL_DURATION = 32;

function SceneContent({ mode }: { mode: ShapeMode }) {
  const initialTime = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const params = new URLSearchParams(window.location.search);
    const t = parseFloat(params.get('t') || '0');
    return isNaN(t) ? 0 : t;
  }, []);
  const timeRef = useRef(initialTime);
  const loopRef = useRef(TOTAL_DURATION + 3);

  // Track t for window export (screenshot harness uses __sceneTime)
  useFrame((_, dt) => {
    timeRef.current = (timeRef.current + Math.min(dt, 0.1)) % loopRef.current;
    if (typeof window !== 'undefined') (window as any).__sceneTime = timeRef.current;
  });

  // X coords: ARIZONA = positive x, SONORA = negative x
  const ARIZONA = 1;
  const SONORA = -1;

  return (
    <>
      <MasterclassEnv preset="urban_night" intensity={0.5} />
      <ambientLight intensity={0.20} />
      <directionalLight position={[8, 12, 6]} intensity={0.5} color="#FFB870" />
      <directionalLight position={[-6, 4, -8]} intensity={0.4} color="#7FB0FF" />
      <fog attach="fog" args={['#08050c', 8, 30]} />
      <CameraDirector timeRef={timeRef} loopRef={loopRef} />

      {/* Wall central — el reveal del frame narrativo */}
      <WallBorder tAppear={4} timeRef={timeRef} mode={mode} />

      {/* ── ARIZONA (lado derecho, x > 0) — prosperidad ── */}
      {/* Office alto al fondo */}
      <FadeItem src={LIBRARY.office.src} color="#A8B5C8"
        position={[ARIZONA * 5, 0, -3]} scale={1.0} glow={1.3}
        tAppear={10} fadeDuration={2} timeRef={timeRef} mode={mode} />
      {/* Tower */}
      <FadeItem src={LIBRARY.tower.src} color="#C8B89B"
        position={[ARIZONA * 6.5, 0, 2]} scale={1.0} glow={1.2}
        tAppear={11} fadeDuration={2} timeRef={timeRef} mode={mode} />
      {/* Casas prósperas */}
      <FadeItem src={LIBRARY.house.src} color="#E8B888"
        position={[ARIZONA * 3, 0, 4]} scale={1.0} rotationY={-0.5} glow={1.1}
        tAppear={12} fadeDuration={2} timeRef={timeRef} mode={mode} />
      <FadeItem src={LIBRARY.house.src} color="#E8B888"
        position={[ARIZONA * 4.5, 0, -1]} scale={1.0} rotationY={-0.8} glow={1.1}
        tAppear={13} fadeDuration={2} timeRef={timeRef} mode={mode} />
      {/* Árbol verde — vegetación sostenida */}
      <FadeItem src={LIBRARY.tree.src} color="#2D8659"
        position={[ARIZONA * 4, 0, 0.5]} scale={0.9} glow={1.0}
        tAppear={14} fadeDuration={2} timeRef={timeRef} mode={mode} />
      {/* Flag americana — bandera del lado próspero */}
      <FadeItem src={LIBRARY.flag.src} color="#D7263D"
        position={[ARIZONA * 2, 0, -4]} scale={1.0} glow={1.2}
        tAppear={15} fadeDuration={1.5} timeRef={timeRef} mode={mode} />
      {/* Soldado fronterizo — vigilando del lado americano */}
      <FadeItem src={LIBRARY.soldier.src} color="#3A4858"
        position={[ARIZONA * 1.5, 0, 0]} scale={0.8} rotationY={-Math.PI / 2} glow={0.9}
        tAppear={9} fadeDuration={1.5} timeRef={timeRef} mode={mode} />

      {/* ── SONORA (lado izquierdo, x < 0) — modestia + extractive ── */}
      {/* Casa modesta */}
      <FadeItem src={LIBRARY.house.src} color="#8B7355"
        position={[SONORA * 3, 0, 3]} scale={0.85} rotationY={0.6} glow={0.7}
        tAppear={18} fadeDuration={2} timeRef={timeRef} mode={mode} />
      <FadeItem src={LIBRARY.house.src} color="#8B7355"
        position={[SONORA * 4.5, 0, -1.5]} scale={0.85} rotationY={0.9} glow={0.7}
        tAppear={19} fadeDuration={2} timeRef={timeRef} mode={mode} />
      {/* Cactus — desierto sonorense */}
      <FadeItem src={LIBRARY.cactus.src} color="#5BA34A"
        position={[SONORA * 3.5, 0, 1]} scale={1.0} glow={0.6}
        tAppear={20} fadeDuration={2} timeRef={timeRef} mode={mode} />
      <FadeItem src={LIBRARY.cactus.src} color="#5BA34A"
        position={[SONORA * 5.5, 0, 3]} scale={1.0} glow={0.6}
        tAppear={20.5} fadeDuration={2} timeRef={timeRef} mode={mode} />
      <FadeItem src={LIBRARY.bush.src} color="#3D8C5A"
        position={[SONORA * 4, 0, 0]} scale={0.7} glow={0.5}
        tAppear={21} fadeDuration={2} timeRef={timeRef} mode={mode} />
      {/* Flag mexicana — bandera del lado modesto */}
      <FadeItem src={LIBRARY.flag.src} color="#5BA34A"
        position={[SONORA * 2, 0, -4]} scale={1.0} glow={0.8}
        tAppear={22} fadeDuration={1.5} timeRef={timeRef} mode={mode} />
      {/* Patrulla — instituciones extractivas */}
      <FadeItem src={LIBRARY.police.src} color="#3A4858"
        position={[SONORA * 6, 0, -2]} scale={0.8} rotationY={1.2} glow={0.7}
        tAppear={23} fadeDuration={1.5} timeRef={timeRef} mode={mode} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────

interface AcemogluNogalesProps {
  forceAspect?: '9:16' | '16:9' | 'auto';
}

export default function AcemogluNogales({ forceAspect = 'auto' }: AcemogluNogalesProps) {
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

  void isPlaying; // si se quiere sync audio↔visual, agregar dependencia en SceneContent

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
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #1a1320 0%, #050308 80%)' }}
    >
      <audio ref={audioRef} src={AUDIO_URL} preload="auto" />

      <Canvas
        camera={{ position: [14, 5, 10], fov, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
          alpha: false,
        }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <SceneContent mode={mode} />
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
          Acemoglu · 2024 · Nogales — Two Worlds
        </div>

        {/* Mode toggle */}
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
            misma latitud · mismo clima · misma gente
          </div>
          <div className="text-[#FFE5A0]/45 text-xs tracking-wider mt-1">
            diferente institución
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
              className="w-20 h-20 rounded-full border-2 border-[#FDB813] flex items-center justify-center group-hover:scale-110 transition-transform"
              style={{ boxShadow: '0 0 30px rgba(253, 184, 19, 0.6)' }}
            >
              <div className="text-[#FDB813] text-3xl ml-1.5">▶</div>
            </div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#FDB813]/70 font-mono">
              Acemoglu · Nogales · ~30s
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
