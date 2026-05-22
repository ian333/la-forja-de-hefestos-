/**
 * LimonesEscena23 — "Cómo no ser limón" (Cap 5 · turn)
 *
 * Cada cosa costosa de obtener es una señal. Lo fácil no señaliza.
 *
 * Duración: ~32s.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import SkyText, { type SkyTextHandle } from './SkyText';
import PostFX from '../scenes/_postFX';
import { useAudioMeta } from './_useAudioMeta';

const TRACK_FILE = '23-como-no-ser-limon.mp3';
const META_URL = '/audio/preview/meta.json';
const AUDIO_URL = '/audio/preview/' + TRACK_FILE;
const FALLBACK_DURATION = 32.37;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function CameraDirector({ timeRef }: { timeRef: React.MutableRefObject<number> }) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current;
    camera.position.set(0.15 * Math.sin(t * 0.10), 0.6, 9 - 0.5 * clamp(t / 30, 0, 1));
    camera.lookAt(0, 0.3, 0);
  });
  return null;
}

function SceneContent({ audioRef, isPlaying }: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  const askRef = useRef<SkyTextHandle | null>(null);
  const list1Ref = useRef<SkyTextHandle | null>(null);
  const list2Ref = useRef<SkyTextHandle | null>(null);
  const list3Ref = useRef<SkyTextHandle | null>(null);
  const facilRef = useRef<SkyTextHandle | null>(null);
  const facilSubRef = useRef<SkyTextHandle | null>(null);
  const dificilRef = useRef<SkyTextHandle | null>(null);
  const dificilSubRef = useRef<SkyTextHandle | null>(null);
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
      [askRef, 0.5, 2.5, 1.0],
      [list1Ref, 4, 1.5, 0.85],
      [list2Ref, 5.5, 1.5, 0.85],
      [list3Ref, 7, 1.5, 0.85],
      [facilRef, 11, 2, 0.85],
      [facilSubRef, 13, 2, 0.65],
      [dificilRef, 17, 2, 0.85],
      [dificilSubRef, 19.5, 2, 0.65],
      [verdictRef, 26, 3, 1.0],
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
      <ambientLight intensity={0.30} />
      <CameraDirector timeRef={timeRef} />

      <SkyText ref={askRef} text="¿qué señal mandas?" position={[0, 3.5, -3]} width={8} height={0.80} color="#FFE5A0" fontWeight={600} />

      {/* Lista */}
      <SkyText ref={list1Ref} text="tu CV"          position={[-3.5,  1.8, 0]} width={2.5} height={0.55} color="#FFE5A0" fontWeight={500} />
      <SkyText ref={list2Ref} text="tu portfolio"  position={[ 0,    1.8, 0]} width={3.5} height={0.55} color="#FFE5A0" fontWeight={500} />
      <SkyText ref={list3Ref} text="tu certificación" position={[ 3.5,  1.8, 0]} width={4.3} height={0.55} color="#FFE5A0" fontWeight={500} />

      {/* Fácil vs difícil */}
      <SkyText ref={facilRef} text="fácil → no señaliza" position={[-3.5, -0.2, 0]} width={5.5} height={0.50} color="#FF8060" fontWeight={500} />
      <SkyText ref={facilSubRef} text="curso de Udemy 5h" position={[-3.5, -1.0, 0]} width={5.0} height={0.38} color="#A89580" fontWeight={400} />

      <SkyText ref={dificilRef} text="costoso → señaliza" position={[3.5, -0.2, 0]} width={5.5} height={0.50} color="#34D399" fontWeight={500} />
      <SkyText ref={dificilSubRef} text="2 años de GitHub" position={[3.5, -1.0, 0]} width={4.5} height={0.38} color="#A89580" fontWeight={400} />

      <SkyText ref={verdictRef} text="el esfuerzo es lo que el malo no puede imitar" position={[0, -3.0, 0]} width={11} height={0.55} color="#FFB81C" fontWeight={600} />

      <fog attach="fog" args={['#02010A', 10, 40]} />
    </>
  );
}

function HudOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-0 left-0 right-0 h-[8%] bg-gradient-to-b from-black/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-[14%] bg-gradient-to-t from-black/70 to-transparent" />
      <div className="absolute top-6 left-6 text-[10px] uppercase tracking-[0.3em] text-[#FFE5A0]/55 font-mono">
        Akerlof · Cap 5 · Escena 23
      </div>
    </div>
  );
}

interface Props { forceAspect?: '9:16' | '16:9' | 'auto'; }

export default function LimonesEscena23({ forceAspect = 'auto' }: Props) {
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
    <div className="relative w-full h-full overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 35%, #0A0612 0%, #02010A 80%)' }}>
      <audio ref={audioRef} src={AUDIO_URL} preload="auto" />
      <Canvas camera={{ position: [0, 0.6, 9], fov, near: 0.1, far: 200 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95, alpha: false }} dpr={[1, 2]}>
        <SceneContent audioRef={audioRef} isPlaying={isPlaying} />
        <PostFX intensity={1.05} threshold={0.35} smoothing={0.50} vignette={0.68} vignetteOffset={0.22} aberration={0.0003} />
      </Canvas>
      <HudOverlay />
      {!hasStarted && !isScreenshotMode && (
        <button onClick={handlePlay} className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer group" style={{ zIndex: 50 }}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full border-2 border-[#FFE5A0] flex items-center justify-center group-hover:scale-110 transition-transform" style={{ boxShadow: '0 0 30px rgba(255, 229, 160, 0.6)' }}>
              <div className="text-[#FFE5A0] text-3xl ml-1.5">▶</div>
            </div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#FFE5A0]/70 font-mono">Cap 5 · Escena 23 · {audioMeta ? audioMeta.duration.toFixed(0) + 's' : '~32s'}</div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">cómo no ser limón</div>
          </div>
        </button>
      )}
    </div>
  );
}
