/**
 * LimonesEscena18 — "El crédito bancario" (Cap 4 · turn)
 *
 * Visual: 2 columnas — buen negocio vs mal negocio.
 * Tasa de interés sube: 5% → 12% → 20%.
 *
 * Duración: ~24s.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import SkyText, { type SkyTextHandle } from './SkyText';
import PostFX from '../scenes/_postFX';
import { useAudioMeta } from './_useAudioMeta';

const TRACK_FILE = '18-credito.mp3';
const META_URL = '/audio/preview/meta.json';
const AUDIO_URL = '/audio/preview/' + TRACK_FILE;
const FALLBACK_DURATION = 24.03;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function CameraDirector({ timeRef }: { timeRef: React.MutableRefObject<number> }) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current;
    camera.position.set(0.20 * Math.sin(t * 0.10), 0.5 + 0.20 * Math.sin(t * 0.08), 9);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function SceneContent({ audioRef, isPlaying }: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  const headerRef = useRef<SkyTextHandle | null>(null);
  const buenoLabelRef = useRef<SkyTextHandle | null>(null);
  const buenoTasaRef = useRef<SkyTextHandle | null>(null);
  const maloLabelRef = useRef<SkyTextHandle | null>(null);
  const maloTasaRef = useRef<SkyTextHandle | null>(null);
  const rateChangeRef = useRef<SkyTextHandle | null>(null);
  const closingRef = useRef<SkyTextHandle | null>(null);

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
      [headerRef, 0.3, 2.5, 1.0],
      [buenoLabelRef, 3, 2, 0.85],
      [buenoTasaRef, 5, 1.5, 0.85],
      [maloLabelRef, 7, 2, 0.85],
      [maloTasaRef, 9, 1.5, 0.85],
      [rateChangeRef, 13, 3, 1.0],
      [closingRef, 19, 3, 1.0],
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
      <ambientLight intensity={0.35} />
      <directionalLight position={[2, 4, 5]} intensity={0.45} color="#FFE5A0" />
      <CameraDirector timeRef={timeRef} />

      <SkyText ref={headerRef} text="EL CRÉDITO BANCARIO" position={[0, 4.0, -3]} width={8.5} height={0.75} color="#FFE5A0" fontWeight={600} />

      {/* Buen negocio */}
      <SkyText ref={buenoLabelRef} text="buen negocio" position={[-3.5, 2.0, 0]} width={4.2} height={0.50} color="#34D399" fontWeight={600} />
      <SkyText ref={buenoTasaRef} text="al 10%" position={[-3.5, 1.1, 0]} width={2.8} height={0.55} color="#34D399" fontWeight={700} />

      {/* Mal negocio */}
      <SkyText ref={maloLabelRef} text="mal negocio" position={[3.5, 2.0, 0]} width={4.0} height={0.50} color="#FF5040" fontWeight={600} />
      <SkyText ref={maloTasaRef} text="al 20%" position={[3.5, 1.1, 0]} width={2.8} height={0.55} color="#FF5040" fontWeight={700} />

      {/* Cambio: el banco sube tasa, los buenos se van */}
      <SkyText ref={rateChangeRef} text="el banco sube tasa → los buenos se van" position={[0, -0.8, 0]} width={9.5} height={0.50} color="#FFB81C" fontWeight={500} />
      <SkyText ref={closingRef} text="al banco solo le quedan... los malos" position={[0, -2.5, 0]} width={9.5} height={0.55} color="#FF5040" fontWeight={600} />

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
        Akerlof · Cap 4 · Escena 18
      </div>
    </div>
  );
}

interface Props { forceAspect?: '9:16' | '16:9' | 'auto'; }

export default function LimonesEscena18({ forceAspect = 'auto' }: Props) {
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
      <Canvas camera={{ position: [0, 0.5, 9], fov, near: 0.1, far: 200 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95, alpha: false }} dpr={[1, 2]}>
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
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#FFE5A0]/70 font-mono">Cap 4 · Escena 18 · {audioMeta ? audioMeta.duration.toFixed(0) + 's' : '~24s'}</div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">el crédito</div>
          </div>
        </button>
      )}
    </div>
  );
}
