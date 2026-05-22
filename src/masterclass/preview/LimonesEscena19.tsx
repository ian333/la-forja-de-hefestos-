/**
 * LimonesEscena19 — "Subprime 2008" (Cap 4 · payoff)
 *
 * Visual: AAA gigante tachado, "2008" rojo dominante, "LEHMAN" cayendo.
 *
 * Duración: ~36s.
 */

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import SkyText, { type SkyTextHandle } from './SkyText';
import PostFX from '../scenes/_postFX';
import { useAudioMeta } from './_useAudioMeta';
import AtomModel from '../assets/gltf/AtomModel';
import { LIBRARY } from '../assets/gltf/manifest';

AtomModel.preload(LIBRARY.house.src);

const TRACK_FILE = '19-subprime-2008.mp3';
const META_URL = '/audio/preview/meta.json';
const AUDIO_URL = '/audio/preview/' + TRACK_FILE;
const FALLBACK_DURATION = 35.79;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function FallingHouse({ x, tEnter, tFall, timeRef }: {
  x: number; tEnter: number; tFall: number; timeRef: React.MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    const t = timeRef.current;
    const enter = easeOutCubic(clamp((t - tEnter) / 1.5, 0, 1));
    const fall = easeOutCubic(clamp((t - tFall) / 2.5, 0, 1));
    groupRef.current.position.set(x, 0.5 - fall * 4, 0);
    groupRef.current.rotation.set(fall * 0.6, 0.2 + t * 0.10, fall * 0.4);
    groupRef.current.scale.setScalar(enter * (1 - fall * 0.8));
    groupRef.current.visible = enter > 0.05 && fall < 0.95;
  });
  return (
    <group ref={groupRef}>
      <AtomModel src={LIBRARY.house.src} color="#FF8060" glow={0.55} mode="atom" scale={0.85} fitTo={1.6} halo={false} />
    </group>
  );
}

function CameraDirector({ timeRef }: { timeRef: React.MutableRefObject<number> }) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current;
    const dolly = clamp(t / 30, 0, 1);
    camera.position.set(0.25 * Math.sin(t * 0.10), 1.2 + 0.20 * Math.sin(t * 0.08), 10 - 1.5 * dolly);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function SceneContent({ audioRef, isPlaying }: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  const yearRef = useRef<SkyTextHandle | null>(null);
  const countryRef = useRef<SkyTextHandle | null>(null);
  const aaaRef = useRef<SkyTextHandle | null>(null);
  const lehmanRef = useRef<SkyTextHandle | null>(null);
  const verdictRef = useRef<SkyTextHandle | null>(null);

  const initialTime = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const params = new URLSearchParams(window.location.search);
    const t = parseFloat(params.get('t') || '0');
    return isNaN(t) ? 0 : t;
  }, []);
  const timeRef = useRef(initialTime);

  useFrame((_, dt) => {
    if (isPlaying && audioRef.current && !audioRef.current.paused) {
      timeRef.current = audioRef.current.currentTime;
    } else {
      timeRef.current += Math.min(dt, 0.1);
    }
    const t = timeRef.current;
    if (typeof window !== 'undefined') (window as any).__sceneTime = t;
    const fades: Array<[React.RefObject<SkyTextHandle | null>, number, number, number?]> = [
      [yearRef, 0.5, 2.5, 1.0],
      [countryRef, 2, 2, 0.7],
      [aaaRef, 11, 3, 1.0],
      [lehmanRef, 24, 2.5, 1.0],
      [verdictRef, 30, 4, 1.0],
    ];
    for (const [ref, start, dur, target] of fades) {
      if (!ref.current) continue;
      const p = easeOutCubic(clamp((t - start) / dur, 0, 1));
      ref.current.setOpacity(p * (target ?? 1));
      ref.current.setScale(0.85 + 0.15 * p);
    }
  });

  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[2, 4, 5]} intensity={0.45} color="#FFE5A0" />
      <directionalLight position={[-3, 3, 2]} intensity={0.25} color="#FF8060" />
      <CameraDirector timeRef={timeRef} />

      <Suspense fallback={null}>
        <FallingHouse x={-3.2} tEnter={4} tFall={20} timeRef={timeRef} />
        <FallingHouse x={-1.1} tEnter={4.5} tFall={21} timeRef={timeRef} />
        <FallingHouse x={1.1} tEnter={5} tFall={22} timeRef={timeRef} />
        <FallingHouse x={3.2} tEnter={5.5} tFall={23} timeRef={timeRef} />
      </Suspense>

      <SkyText ref={yearRef} text="2008" position={[0, 4.2, -4]} width={5} height={1.5} color="#FF5040" fontWeight={700} />
      <SkyText ref={countryRef} text="Estados Unidos · hipotecas subprime" position={[0, 2.8, -4]} width={9} height={0.45} color="#A89580" fontWeight={400} />

      <SkyText ref={aaaRef} text="calificadas AAA" position={[0, -1.8, 0]} width={6} height={0.6} color="#FFB81C" fontWeight={600} />

      <SkyText ref={lehmanRef} text="LEHMAN BROTHERS · cae" position={[0, -3.0, 0]} width={9} height={0.65} color="#FF5040" fontWeight={700} />
      <SkyText ref={verdictRef} text="los paquetes eran limones" position={[0, -4.0, 0]} width={7.5} height={0.50} color="#FFE5A0" fontWeight={500} />

      <fog attach="fog" args={['#0A0612', 10, 50]} />
    </>
  );
}

function HudOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-0 left-0 right-0 h-[8%] bg-gradient-to-b from-black/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-[14%] bg-gradient-to-t from-black/70 to-transparent" />
      <div className="absolute top-6 left-6 text-[10px] uppercase tracking-[0.3em] text-[#FFE5A0]/55 font-mono">
        Akerlof · Cap 4 · Escena 19
      </div>
    </div>
  );
}

interface Props { forceAspect?: '9:16' | '16:9' | 'auto'; }

export default function LimonesEscena19({ forceAspect = 'auto' }: Props) {
  const aspect: '9:16' | '16:9' = forceAspect === 'auto'
    ? (typeof window !== 'undefined' && window.innerHeight > window.innerWidth ? '9:16' : '16:9')
    : forceAspect;
  const fov = aspect === '9:16' ? 60 : 48;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const isScreenshotMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('t');
  }, []);
  const audioMeta = useAudioMeta(META_URL, { expectedTrackFile: TRACK_FILE, fallbackDuration: FALLBACK_DURATION });

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
      }, 2500);
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, []);

  const handlePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().then(() => { setIsPlaying(true); setHasStarted(true); }).catch(e => console.warn('autoplay blocked', e));
  };

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 35%, #1A0808 0%, #02010A 80%)' }}>
      <audio ref={audioRef} src={AUDIO_URL} preload="auto" />
      <Canvas camera={{ position: [0, 1.2, 10], fov, near: 0.1, far: 200 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95, alpha: false }} dpr={[1, 2]}>
        <SceneContent audioRef={audioRef} isPlaying={isPlaying} />
        <PostFX intensity={1.10} threshold={0.32} smoothing={0.50} vignette={0.75} vignetteOffset={0.20} aberration={0.0003} />
      </Canvas>
      <HudOverlay />
      {!hasStarted && !isScreenshotMode && (
        <button onClick={handlePlay} className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer group" style={{ zIndex: 50 }}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full border-2 border-[#FFE5A0] flex items-center justify-center group-hover:scale-110 transition-transform" style={{ boxShadow: '0 0 30px rgba(255, 229, 160, 0.6)' }}>
              <div className="text-[#FFE5A0] text-3xl ml-1.5">▶</div>
            </div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#FFE5A0]/70 font-mono">Cap 4 · Escena 19 · {audioMeta ? audioMeta.duration.toFixed(0) + 's' : '~36s'}</div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">subprime · 2008</div>
          </div>
        </button>
      )}
    </div>
  );
}
