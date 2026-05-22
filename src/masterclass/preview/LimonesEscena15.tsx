/**
 * LimonesEscena15 — "Pero Akerlof solo describió el problema" (Cap 3 → Cap 4)
 *
 * Cliffhanger. Akerlof nombró el problema, no la solución. Quien la trajo
 * fue Spence: "señalización". Lead-in al Cap 4.
 *
 * Visual:
 *   - Pregunta clave en grande: "¿cómo evitas el colapso?"
 *   - Después: palabra "señalizar" emerge, con un símbolo (anillo de luz que crece)
 *   - Texto final: "Capítulo 4 · Michael Spence"
 *
 * Duración: ~32s.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import SkyText, { type SkyTextHandle } from './SkyText';
import PostFX from '../scenes/_postFX';
import { useAudioMeta } from './_useAudioMeta';

const TRACK_FILE = '15-pero-akerlof.mp3';
const META_URL = '/audio/preview/meta.json';
const AUDIO_URL = '/audio/preview/' + TRACK_FILE;
const FALLBACK_DURATION = 31.95;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ─────────────────────────────────────────────────────────────
// Anillos concéntricos pulsantes — representan "señal viajando"

function SignalRings({ timeRef, appearT }: {
  timeRef: React.MutableRefObject<number>;
  appearT: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringMatsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const RING_COUNT = 4;
  useFrame(() => {
    if (!groupRef.current) return;
    const t = timeRef.current;
    const appear = easeOutCubic(clamp((t - appearT) / 2.5, 0, 1));
    groupRef.current.scale.setScalar(appear);
    groupRef.current.visible = appear > 0.05;
    // Cada anillo pulsa con su propio offset
    for (let i = 0; i < RING_COUNT; i++) {
      const mat = ringMatsRef.current[i];
      if (!mat) continue;
      const phase = ((t - appearT) * 0.5 + i * 0.25) % 1;
      // Aparece a 0, crece, fade out
      mat.opacity = (1 - phase) * 0.6 * appear;
    }
    // Rotar grupo lento
    groupRef.current.rotation.z = t * 0.10;
  });
  return (
    <group ref={groupRef} position={[0, 0.3, -3]}>
      {Array.from({ length: RING_COUNT }).map((_, i) => {
        const phaseOffset = i / RING_COUNT;
        return (
          <RingInstance
            key={i}
            phaseOffset={phaseOffset}
            timeRef={timeRef}
            appearT={appearT}
            matRefCallback={(ref) => { ringMatsRef.current[i] = ref; }}
          />
        );
      })}
    </group>
  );
}

function RingInstance({ phaseOffset, timeRef, appearT, matRefCallback }: {
  phaseOffset: number;
  timeRef: React.MutableRefObject<number>;
  appearT: number;
  matRefCallback: (ref: THREE.MeshBasicMaterial) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    const t = timeRef.current;
    // Anillo expande con loop
    const phase = (((t - appearT) * 0.5) + phaseOffset) % 1;
    const radius = 0.4 + phase * 2.3;
    groupRef.current.scale.setScalar(radius);
    if (matRef.current && !matRefCallback.toString().includes('null')) {
      matRefCallback(matRef.current);
    }
  });
  return (
    <group ref={groupRef}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.95, 1.0, 64]} />
        <meshBasicMaterial
          ref={matRef}
          color="#FFE5A0"
          transparent
          opacity={0.6}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
function CameraDirector({ timeRef, sceneLoopRef }: {
  timeRef: React.MutableRefObject<number>;
  sceneLoopRef: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current % sceneLoopRef.current;
    const zoom = easeInOutCubic(clamp(t / 30, 0, 1));
    const dist = 11 - 2.0 * zoom;
    const y = 0.5 + 0.4 * Math.sin(t * 0.10);
    camera.position.set(0.15 * Math.sin(t * 0.13), y, dist);
    camera.lookAt(0, 0.3, -3);
  });
  return null;
}

// ─────────────────────────────────────────────────────────────
function SceneContent({ audioRef, isPlaying }: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  const questionRef = useRef<SkyTextHandle | null>(null);
  const subRef = useRef<SkyTextHandle | null>(null);
  const signalRef = useRef<SkyTextHandle | null>(null);
  const signalSubRef = useRef<SkyTextHandle | null>(null);
  const capRef = useRef<SkyTextHandle | null>(null);
  const nameRef = useRef<SkyTextHandle | null>(null);

  const sceneLoopRef = useRef(34);

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
    const t = timeRef.current % sceneLoopRef.current;
    if (typeof window !== 'undefined') (window as any).__sceneTime = timeRef.current;

    if (questionRef.current) {
      const appear = easeOutCubic(clamp((t - 3.5) / 3, 0, 1));
      const fadeOut = easeOutCubic(clamp((t - 16) / 3, 0, 1));
      questionRef.current.setOpacity(appear * (1 - fadeOut));
      questionRef.current.setScale(0.85 + 0.15 * appear);
    }
    if (subRef.current) {
      const appear = easeOutCubic(clamp((t - 5) / 3, 0, 1));
      const fadeOut = easeOutCubic(clamp((t - 16) / 3, 0, 1));
      subRef.current.setOpacity(appear * (1 - fadeOut) * 0.65);
    }
    if (signalRef.current) {
      const appear = easeOutCubic(clamp((t - 16) / 3, 0, 1));
      const fadeOut = easeOutCubic(clamp((t - 26) / 3, 0, 1));
      signalRef.current.setOpacity(appear * (1 - fadeOut));
      signalRef.current.setScale(0.85 + 0.15 * appear);
    }
    if (signalSubRef.current) {
      const appear = easeOutCubic(clamp((t - 18) / 3, 0, 1));
      const fadeOut = easeOutCubic(clamp((t - 26) / 3, 0, 1));
      signalSubRef.current.setOpacity(appear * (1 - fadeOut) * 0.65);
    }
    if (capRef.current) {
      const appear = easeOutCubic(clamp((t - 26) / 3, 0, 1));
      capRef.current.setOpacity(appear);
      capRef.current.setScale(0.85 + 0.15 * appear);
    }
    if (nameRef.current) {
      const appear = easeOutCubic(clamp((t - 28) / 3, 0, 1));
      nameRef.current.setOpacity(appear);
      nameRef.current.setScale(0.85 + 0.15 * appear);
    }
  });

  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 5, 4]} intensity={0.40} color="#FFE5A0" />
      <directionalLight position={[-3, 3, 2]} intensity={0.20} color="#7B6BA0" />

      <CameraDirector timeRef={timeRef} sceneLoopRef={sceneLoopRef} />

      {/* Anillos de señal — aparecen cuando se nombra "señalizar" */}
      <SignalRings timeRef={timeRef} appearT={16} />

      {/* Pregunta clave inicial */}
      <SkyText
        ref={questionRef}
        text="¿cómo evitas el colapso?"
        position={[0, 2.5, -2]}
        width={9}
        height={1.0}
        color="#FFE5A0"
        fontWeight={600}
      />
      <SkyText
        ref={subRef}
        text="el problema es que el comprador no sabe"
        position={[0, 1.2, -2]}
        width={8.5}
        height={0.45}
        color="#A89580"
        fontWeight={400}
      />

      {/* "Señalizar" — palabra clave del cap 4 */}
      <SkyText
        ref={signalRef}
        text="señalizar"
        position={[0, 2.5, -2]}
        width={6.5}
        height={1.2}
        color="#FFB81C"
        fontWeight={700}
      />
      <SkyText
        ref={signalSubRef}
        text="mandar una señal costosa que el malo no puede imitar"
        position={[0, 1.2, -2]}
        width={9.5}
        height={0.42}
        color="#A89580"
        fontWeight={400}
      />

      {/* Cliffhanger final */}
      <SkyText
        ref={capRef}
        text="Capítulo 4"
        position={[0, -2.0, 0]}
        width={4.5}
        height={0.6}
        color="#FFE5A0"
        fontWeight={500}
      />
      <SkyText
        ref={nameRef}
        text="Michael Spence"
        position={[0, -2.9, 0]}
        width={5.5}
        height={0.65}
        color="#FFE5A0"
        fontWeight={700}
      />

      <fog attach="fog" args={['#02010A', 10, 40]} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
function HudOverlay({ aspect }: { aspect: '9:16' | '16:9' }) {
  const isVertical = aspect === '9:16';
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/40 to-transparent pointer-events-none"
        style={{ height: isVertical ? '12%' : '8%' }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none"
        style={{ height: isVertical ? '22%' : '14%' }}
      />
      <div className="absolute top-6 left-6 text-[10px] uppercase tracking-[0.3em] text-[#FFE5A0]/55 font-mono pointer-events-none">
        Akerlof · Cap 3 · Escena 15
      </div>
      <SceneTimer />
    </div>
  );
}

function SceneTimer() {
  const timerRef = useRef<HTMLSpanElement>(null);
  useMemo(() => {
    const start = performance.now();
    const tick = () => {
      const elapsed = ((performance.now() - start) / 1000) % 34;
      if (timerRef.current) {
        timerRef.current.textContent = elapsed.toFixed(1).padStart(4, '0') + ' s';
      }
      requestAnimationFrame(tick);
    };
    if (typeof window !== 'undefined') requestAnimationFrame(tick);
    return null;
  }, []);
  return (
    <div className="absolute top-6 right-6 text-[10px] text-[#FFE5A0]/40 font-mono pointer-events-none">
      <span ref={timerRef}>00.0 s</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
interface LimonesEscena15Props {
  forceAspect?: '9:16' | '16:9' | 'auto';
}

export default function LimonesEscena15({ forceAspect = 'auto' }: LimonesEscena15Props) {
  const aspect: '9:16' | '16:9' =
    forceAspect === 'auto'
      ? typeof window !== 'undefined' && window.innerHeight > window.innerWidth
        ? '9:16'
        : '16:9'
      : forceAspect;
  const fov = aspect === '9:16' ? 58 : 46;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const isScreenshotMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.has('t');
  }, []);

  const audioMeta = useAudioMeta(META_URL, {
    expectedTrackFile: TRACK_FILE,
    fallbackDuration: FALLBACK_DURATION,
  });

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
    audio.play().then(() => {
      setIsPlaying(true);
      setHasStarted(true);
    }).catch(e => console.warn('autoplay blocked', e));
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 35%, #0a0815 0%, #02010A 80%)' }}
    >
      <audio ref={audioRef} src={AUDIO_URL} preload="auto" />

      <Canvas
        camera={{ position: [0, 0.5, 11], fov, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.95,
          alpha: false,
        }}
        dpr={[1, 2]}
      >
        <SceneContent audioRef={audioRef} isPlaying={isPlaying} />
        <PostFX
          intensity={1.05}
          threshold={0.35}
          smoothing={0.50}
          vignette={0.72}
          vignetteOffset={0.22}
          aberration={0.0003}
        />
      </Canvas>

      <HudOverlay aspect={aspect} />

      {!hasStarted && !isScreenshotMode && (
        <button
          onClick={handlePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer group"
          style={{ zIndex: 50 }}
        >
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-20 h-20 rounded-full border-2 border-[#FFE5A0] flex items-center justify-center group-hover:scale-110 transition-transform"
              style={{ boxShadow: '0 0 30px rgba(255, 229, 160, 0.6)' }}
            >
              <div className="text-[#FFE5A0] text-3xl ml-1.5">▶</div>
            </div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#FFE5A0]/70 font-mono">
              Cap 3 · Escena 15 · {audioMeta ? audioMeta.duration.toFixed(0) + 's' : '~32s'}
            </div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">
              señalizar
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
