/**
 * LimonesEscena24 — "La economía de la información" (Cap 5 · payoff)
 *
 * Google, Amazon, Uber — todas son soluciones a asimetría de información.
 *
 * Duración: ~33s.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import SkyText, { type SkyTextHandle } from './SkyText';
import PostFX from '../scenes/_postFX';
import { useAudioMeta } from './_useAudioMeta';

const TRACK_FILE = '24-economia-info.mp3';
const META_URL = '/audio/preview/meta.json';
const AUDIO_URL = '/audio/preview/' + TRACK_FILE;
const FALLBACK_DURATION = 32.76;

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
    const pull = clamp(t / 28, 0, 1);
    camera.position.set(0.30 * Math.sin(t * 0.08), 0.7 + 0.20 * Math.sin(t * 0.06), 9 + 1.5 * pull);
    camera.lookAt(0, 0.2, 0);
  });
  return null;
}

function SceneContent({ audioRef, isPlaying }: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  const headerRef = useRef<SkyTextHandle | null>(null);
  const subRef = useRef<SkyTextHandle | null>(null);
  const c1Ref = useRef<SkyTextHandle | null>(null);
  const c2Ref = useRef<SkyTextHandle | null>(null);
  const c3Ref = useRef<SkyTextHandle | null>(null);
  const c4Ref = useRef<SkyTextHandle | null>(null);
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
      [headerRef, 0.5, 3, 1.0],
      [subRef, 3.5, 2, 0.7],
      [c1Ref, 7, 1.8, 0.95],
      [c2Ref, 11, 1.8, 0.95],
      [c3Ref, 14, 1.8, 0.95],
      [c4Ref, 18, 1.8, 0.95],
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
      <Starfield count={130} />
      <CameraDirector timeRef={timeRef} />

      <SkyText ref={headerRef} text="LA ECONOMÍA DE LA INFORMACIÓN" position={[0, 3.5, -4]} width={10} height={0.75} color="#FFE5A0" fontWeight={600} />
      <SkyText ref={subRef} text="Akerlof abrió la puerta" position={[0, 2.5, -4]} width={6.5} height={0.40} color="#A89580" fontWeight={400} />

      <SkyText ref={c1Ref} text="Google" position={[-3.5,  0.8, 0]} width={3.5} height={0.65} color="#FFB81C" fontWeight={700} />
      <SkyText ref={c2Ref} text="Amazon" position={[ 3.5,  0.8, 0]} width={3.6} height={0.65} color="#FFB81C" fontWeight={700} />
      <SkyText ref={c3Ref} text="Uber"   position={[-3.5, -0.7, 0]} width={2.8} height={0.65} color="#FFB81C" fontWeight={700} />
      <SkyText ref={c4Ref} text="Reviews · Rankings · Reputación" position={[ 3.5, -0.7, 0]} width={7.0} height={0.42} color="#FFE5A0" fontWeight={500} />

      <SkyText ref={verdictRef} text="todos viviendo lo que Akerlof escribió" position={[0, -2.8, 0]} width={10} height={0.55} color="#FFE5A0" fontWeight={600} />

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
        Akerlof · Cap 5 · Escena 24
      </div>
    </div>
  );
}

interface Props { forceAspect?: '9:16' | '16:9' | 'auto'; }

export default function LimonesEscena24({ forceAspect = 'auto' }: Props) {
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
      <Canvas camera={{ position: [0, 0.7, 9], fov, near: 0.1, far: 200 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95, alpha: false }} dpr={[1, 2]}>
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
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#FFE5A0]/70 font-mono">Cap 5 · Escena 24 · {audioMeta ? audioMeta.duration.toFixed(0) + 's' : '~33s'}</div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">economía de la información</div>
          </div>
        </button>
      )}
    </div>
  );
}
