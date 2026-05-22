/**
 * LimonesEscena16 — "Esto no es solo carros" (Cap 4 · hook)
 *
 * Zoom-out: el problema de los limones aplica a todos los mercados.
 * Visual: starfield + ECOS de varios "mercados" como labels flotantes
 * que aparecen uno tras otro.
 *
 * Duración: ~26s.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import SkyText, { type SkyTextHandle } from './SkyText';
import PostFX from '../scenes/_postFX';
import { useAudioMeta } from './_useAudioMeta';

const TRACK_FILE = '16-no-es-solo-carros.mp3';
const META_URL = '/audio/preview/meta.json';
const AUDIO_URL = '/audio/preview/' + TRACK_FILE;
const FALLBACK_DURATION = 25.81;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function Starfield({ count = 100 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const positions = useMemo(() => {
    const arr: Array<{ x: number; y: number; z: number; phase: number; size: number }> = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 50,
        y: (Math.random() - 0.5) * 30,
        z: -10 - Math.random() * 30,
        phase: Math.random() * Math.PI * 2,
        size: 0.015 + Math.random() * 0.04,
      });
    }
    return arr;
  }, [count]);
  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const p = positions[i];
      const tw = 0.6 + 0.4 * Math.sin(t * 0.5 + p.phase);
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(p.size * tw);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshBasicMaterial color="#FFE5A0" transparent opacity={0.45} toneMapped={false} />
    </instancedMesh>
  );
}

function CameraDirector({ timeRef }: { timeRef: React.MutableRefObject<number> }) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current;
    // pull-back lento
    const pull = clamp(t / 20, 0, 1);
    const dist = 8 + 4 * pull;
    camera.position.set(0.3 * Math.sin(t * 0.1), 0.5, dist);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function SceneContent({ audioRef, isPlaying }: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  const titleRef = useRef<SkyTextHandle | null>(null);
  const subRef = useRef<SkyTextHandle | null>(null);
  const market1Ref = useRef<SkyTextHandle | null>(null);
  const market2Ref = useRef<SkyTextHandle | null>(null);
  const market3Ref = useRef<SkyTextHandle | null>(null);
  const market4Ref = useRef<SkyTextHandle | null>(null);
  const market5Ref = useRef<SkyTextHandle | null>(null);
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
      [titleRef, 0.5, 3, 1.0],
      [subRef, 3.5, 2, 0.6],
      [market1Ref, 5, 1.5, 0.85],
      [market2Ref, 6.5, 1.5, 0.85],
      [market3Ref, 8, 1.5, 0.85],
      [market4Ref, 9.5, 1.5, 0.85],
      [market5Ref, 11, 1.5, 0.80],
      [closingRef, 19, 4, 1.0],
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
      <Starfield count={120} />
      <CameraDirector timeRef={timeRef} />

      <SkyText ref={titleRef} text="no es solo carros" position={[0, 3.2, -2]} width={9} height={1.0} color="#FFE5A0" fontWeight={600} />
      <SkyText ref={subRef} text="el problema está en todos lados" position={[0, 2.0, -2]} width={7.5} height={0.42} color="#A89580" fontWeight={400} />

      <SkyText ref={market1Ref} text="seguros médicos"   position={[-3.5,  0.8, 0]} width={3.5} height={0.45} color="#FF8060" fontWeight={500} />
      <SkyText ref={market2Ref} text="créditos bancarios" position={[ 3.5,  0.8, 0]} width={3.8} height={0.45} color="#FFB81C" fontWeight={500} />
      <SkyText ref={market3Ref} text="empleos"            position={[-2.8, -0.5, 0]} width={2.5} height={0.45} color="#34D399" fontWeight={500} />
      <SkyText ref={market4Ref} text="casas"              position={[ 2.8, -0.5, 0]} width={2.0} height={0.45} color="#7FB0FF" fontWeight={500} />
      <SkyText ref={market5Ref} text="hasta el amor"      position={[0,    -1.8, 0]} width={3.8} height={0.45} color="#FF5040" fontWeight={500} />

      <SkyText ref={closingRef} text="la mayoría no la ves" position={[0, -3.5, 0]} width={6.5} height={0.55} color="#FFE5A0" fontWeight={600} />

      <fog attach="fog" args={['#02010A', 10, 50]} />
    </>
  );
}

function HudOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-0 left-0 right-0 h-[8%] bg-gradient-to-b from-black/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-[14%] bg-gradient-to-t from-black/70 to-transparent" />
      <div className="absolute top-6 left-6 text-[10px] uppercase tracking-[0.3em] text-[#FFE5A0]/55 font-mono">
        Akerlof · Cap 4 · Escena 16
      </div>
    </div>
  );
}

interface Props { forceAspect?: '9:16' | '16:9' | 'auto'; }

export default function LimonesEscena16({ forceAspect = 'auto' }: Props) {
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
      <Canvas camera={{ position: [0, 0.5, 8], fov, near: 0.1, far: 200 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95, alpha: false }} dpr={[1, 2]}>
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
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#FFE5A0]/70 font-mono">Cap 4 · Escena 16 · {audioMeta ? audioMeta.duration.toFixed(0) + 's' : '~26s'}</div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">no es solo carros</div>
          </div>
        </button>
      )}
    </div>
  );
}
