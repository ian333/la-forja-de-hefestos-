/**
 * LimonesEscena22 — "La señal que sí funciona" (Cap 5 · develop)
 *
 * Las 5 estrellas, las reseñas, las calificaciones — la señal de Spence
 * aplicada en plataformas modernas.
 *
 * Visual: 5 estrellas aparecen una por una + texto "Uber 4.92"
 *
 * Duración: ~31s.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import SkyText, { type SkyTextHandle } from './SkyText';
import PostFX from '../scenes/_postFX';
import { useAudioMeta } from './_useAudioMeta';

const TRACK_FILE = '22-la-senal.mp3';
const META_URL = '/audio/preview/meta.json';
const AUDIO_URL = '/audio/preview/' + TRACK_FILE;
const FALLBACK_DURATION = 31.09;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// Estrella geométrica plana
function Star({ x, tEnter, timeRef }: { x: number; tEnter: number; timeRef: React.MutableRefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const spikes = 5;
    const outer = 0.4;
    const inner = 0.18;
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? outer : inner;
      const xv = Math.cos(a) * r;
      const yv = Math.sin(a) * r;
      if (i === 0) s.moveTo(xv, yv); else s.lineTo(xv, yv);
    }
    s.closePath();
    return s;
  }, []);
  const geo = useMemo(() => new THREE.ShapeGeometry(shape), [shape]);

  useFrame(() => {
    if (!meshRef.current || !matRef.current) return;
    const t = timeRef.current;
    const appear = easeOutCubic(clamp((t - tEnter) / 0.5, 0, 1));
    const wiggle = 1 + 0.10 * Math.sin(t * 1.5 + x);
    meshRef.current.scale.setScalar(appear * wiggle);
    meshRef.current.position.set(x, 1.2, 0);
    meshRef.current.rotation.z = appear * Math.PI * 2 * 0.15;
    matRef.current.opacity = appear * 0.95;
  });

  return (
    <mesh ref={meshRef} geometry={geo}>
      <meshBasicMaterial ref={matRef} color="#FFD86B" transparent opacity={0} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function CameraDirector({ timeRef }: { timeRef: React.MutableRefObject<number> }) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current;
    camera.position.set(0.15 * Math.sin(t * 0.10), 0.8, 8 - 0.5 * clamp(t / 28, 0, 1));
    camera.lookAt(0, 0.5, 0);
  });
  return null;
}

function SceneContent({ audioRef, isPlaying }: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  const headerRef = useRef<SkyTextHandle | null>(null);
  const uberRef = useRef<SkyTextHandle | null>(null);
  const ratingRef = useRef<SkyTextHandle | null>(null);
  const subRef = useRef<SkyTextHandle | null>(null);
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
      [headerRef, 0.5, 2.5, 1.0],
      [uberRef, 4, 2, 0.85],
      [ratingRef, 13, 3, 1.0],
      [subRef, 19, 3, 0.65],
      [closingRef, 26, 3, 1.0],
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
      <CameraDirector timeRef={timeRef} />

      <SkyText ref={headerRef} text="LA SEÑAL QUE SÍ FUNCIONA" position={[0, 3.6, -3]} width={9} height={0.8} color="#FFE5A0" fontWeight={600} />

      {/* 5 estrellas — Uber rating */}
      <Star x={-2.0} tEnter={6.0} timeRef={timeRef} />
      <Star x={-1.0} tEnter={6.6} timeRef={timeRef} />
      <Star x={ 0.0} tEnter={7.2} timeRef={timeRef} />
      <Star x={ 1.0} tEnter={7.8} timeRef={timeRef} />
      <Star x={ 2.0} tEnter={8.4} timeRef={timeRef} />

      <SkyText ref={uberRef} text="Uber · 4.92" position={[0, -0.2, 0]} width={4.5} height={0.55} color="#FFE5A0" fontWeight={600} />
      <SkyText ref={ratingRef} text="tu calificación es tu señal" position={[0, -1.5, 0]} width={7.5} height={0.55} color="#FFE5A0" fontWeight={600} />
      <SkyText ref={subRef} text="costosa de obtener · imposible de imitar" position={[0, -2.5, 0]} width={9.0} height={0.42} color="#A89580" fontWeight={400} />
      <SkyText ref={closingRef} text="el Nobel del 2001 · aplicado" position={[0, -3.5, 0]} width={8.0} height={0.50} color="#FFB81C" fontWeight={500} />

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
        Akerlof · Cap 5 · Escena 22
      </div>
    </div>
  );
}

interface Props { forceAspect?: '9:16' | '16:9' | 'auto'; }

export default function LimonesEscena22({ forceAspect = 'auto' }: Props) {
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
      <Canvas camera={{ position: [0, 0.8, 8], fov, near: 0.1, far: 200 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95, alpha: false }} dpr={[1, 2]}>
        <SceneContent audioRef={audioRef} isPlaying={isPlaying} />
        <PostFX intensity={1.10} threshold={0.32} smoothing={0.50} vignette={0.68} vignetteOffset={0.22} aberration={0.0003} />
      </Canvas>
      <HudOverlay />
      {!hasStarted && !isScreenshotMode && (
        <button onClick={handlePlay} className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer group" style={{ zIndex: 50 }}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full border-2 border-[#FFE5A0] flex items-center justify-center group-hover:scale-110 transition-transform" style={{ boxShadow: '0 0 30px rgba(255, 229, 160, 0.6)' }}>
              <div className="text-[#FFE5A0] text-3xl ml-1.5">▶</div>
            </div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#FFE5A0]/70 font-mono">Cap 5 · Escena 22 · {audioMeta ? audioMeta.duration.toFixed(0) + 's' : '~31s'}</div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">la señal</div>
          </div>
        </button>
      )}
    </div>
  );
}
