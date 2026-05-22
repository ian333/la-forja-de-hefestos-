/**
 * LimonesEscena10 — "¿Hay solución?" (cliffhanger Cap 2 → Cap 3)
 *
 * Cierra Cap 2 con la pregunta abierta. Visualmente minimalista:
 *   - Una sola pregunta gigante que aparece y se queda
 *   - Después: silueta abstracta de persona (geometría procedural) — Akerlof
 *   - Datos del paper: "29 años · 1970 · rechazado 3 veces"
 *   - Texto final "Capítulo 3 · George Akerlof"
 *
 * Sin GLBs externos — composición pura SkyText + un cilindro emisivo para
 * la silueta. Mood: misterio (transición narrativa).
 *
 * Duración: ~26s.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import SkyText, { type SkyTextHandle } from './SkyText';
import PostFX from '../scenes/_postFX';
import { useAudioMeta } from './_useAudioMeta';

const TRACK_FILE = '10-hay-solucion.mp3';
const META_URL = '/audio/preview/meta.json';
const AUDIO_URL = '/audio/preview/' + TRACK_FILE;
const FALLBACK_DURATION = 26.12;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ─────────────────────────────────────────────────────────────
// Starfield sutil
function Starfield({ count = 80 }: { count?: number }) {
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
      <meshBasicMaterial color="#FFE5A0" transparent opacity={0.40} toneMapped={false} />
    </instancedMesh>
  );
}

// ─────────────────────────────────────────────────────────────
// Silueta abstracta de persona (Akerlof) — composición de primitivas
// que aparece en la segunda mitad. Forma:
//   - cabeza: esfera pequeña
//   - cuerpo: cilindro con taper inferior
//   - todo emisivo gold, edges visibles
function AkerlofSilhouette({ timeRef }: { timeRef: React.MutableRefObject<number> }) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const headMatRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    const t = timeRef.current;
    // Aparece t=14 → 18
    const appear = easeOutCubic(clamp((t - 14) / 4, 0, 1));
    const breathe = 1 + 0.02 * Math.sin(t * 0.8);
    groupRef.current.scale.setScalar(appear * breathe);
    groupRef.current.visible = appear > 0.01;
    const op = appear * 0.85;
    if (bodyMatRef.current) {
      bodyMatRef.current.opacity = op;
      bodyMatRef.current.emissiveIntensity = 0.7 * appear;
    }
    if (headMatRef.current) {
      headMatRef.current.opacity = op;
      headMatRef.current.emissiveIntensity = 0.7 * appear;
    }
  });
  return (
    <group ref={groupRef} position={[0, 0.3, -2]}>
      {/* Cabeza */}
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.32, 24, 18]} />
        <meshStandardMaterial
          ref={headMatRef}
          color="#FFE5A0"
          emissive="#FFE5A0"
          emissiveIntensity={0.7}
          roughness={0.4}
          metalness={0.3}
          transparent
          opacity={0}
        />
      </mesh>
      {/* Cuello (cilindro chico) */}
      <mesh position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 0.22, 16]} />
        <meshStandardMaterial
          color="#FFE5A0"
          emissive="#FFE5A0"
          emissiveIntensity={0.6}
          roughness={0.5}
          metalness={0.2}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* Cuerpo (cone-like) */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.35, 0.65, 1.2, 18]} />
        <meshStandardMaterial
          ref={bodyMatRef}
          color="#FFE5A0"
          emissive="#FFE5A0"
          emissiveIntensity={0.7}
          roughness={0.45}
          metalness={0.25}
          transparent
          opacity={0}
        />
      </mesh>
      {/* Aro de luz a sus pies */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.32, 0]}>
        <ringGeometry args={[0.6, 0.85, 32]} />
        <meshBasicMaterial color="#FFE5A0" transparent opacity={0.40} toneMapped={false} side={THREE.DoubleSide} />
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
    const dolly = easeInOutCubic(clamp(t / 24, 0, 1));
    const dist = 11 - 2.0 * dolly;
    const height = 1.8 + 0.4 * Math.sin(t * 0.10);
    camera.position.set(0.10 * Math.sin(t * 0.12), height, dist);
    const lookY = 0.8 + 0.4 * easeInOutCubic(clamp((t - 14) / 4, 0, 1));
    camera.lookAt(0, lookY, -2);
  });
  return null;
}

// ─────────────────────────────────────────────────────────────
function SceneContent({ audioRef, isPlaying }: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  const questionRef = useRef<SkyTextHandle | null>(null);
  const subAnswerRef = useRef<SkyTextHandle | null>(null);
  const ageRef = useRef<SkyTextHandle | null>(null);
  const dateRef = useRef<SkyTextHandle | null>(null);
  const rejectsRef = useRef<SkyTextHandle | null>(null);
  const capRef = useRef<SkyTextHandle | null>(null);
  const nameRef = useRef<SkyTextHandle | null>(null);

  const sceneLoopRef = useRef(30);

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

    // Pregunta gigante: aparece t=2, se queda hasta t=18
    if (questionRef.current) {
      const appear = easeOutCubic(clamp((t - 1.5) / 3, 0, 1));
      const fadeOut = easeOutCubic(clamp((t - 18) / 3, 0, 1));
      const op = appear * (1 - fadeOut);
      questionRef.current.setOpacity(op);
      questionRef.current.setScale(0.85 + 0.15 * appear);
    }

    // Sub: "la respuesta existe, pero..." t=7
    if (subAnswerRef.current) {
      const appear = easeOutCubic(clamp((t - 7) / 3, 0, 1));
      const fadeOut = easeOutCubic(clamp((t - 18) / 3, 0, 1));
      subAnswerRef.current.setOpacity(appear * (1 - fadeOut) * 0.65);
    }

    // Datos personales — aparecen mientras silueta materializa (t=15-20)
    if (ageRef.current) {
      const appear = easeOutCubic(clamp((t - 15.5) / 2, 0, 1));
      ageRef.current.setOpacity(appear * 0.85);
    }
    if (dateRef.current) {
      const appear = easeOutCubic(clamp((t - 17.5) / 2, 0, 1));
      dateRef.current.setOpacity(appear * 0.70);
    }
    if (rejectsRef.current) {
      const appear = easeOutCubic(clamp((t - 19) / 2.5, 0, 1));
      rejectsRef.current.setOpacity(appear * 0.65);
    }

    // CAPÍTULO 3 — t=21
    if (capRef.current) {
      const appear = easeOutCubic(clamp((t - 21) / 2, 0, 1));
      capRef.current.setOpacity(appear);
      capRef.current.setScale(0.85 + 0.15 * appear);
    }
    if (nameRef.current) {
      const appear = easeOutCubic(clamp((t - 23) / 2.5, 0, 1));
      nameRef.current.setOpacity(appear);
      nameRef.current.setScale(0.85 + 0.15 * appear);
    }
  });

  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 5, 4]} intensity={0.40} color="#FFE5A0" />
      <directionalLight position={[-3, 3, 2]} intensity={0.30} color="#B8A578" />

      <CameraDirector timeRef={timeRef} sceneLoopRef={sceneLoopRef} />
      <Starfield count={100} />

      {/* Pregunta gigante centro */}
      <SkyText
        ref={questionRef}
        text="¿hay forma de pararlo?"
        position={[0, 2.5, -2]}
        width={9}
        height={1.0}
        color="#FFE5A0"
        fontWeight={600}
      />

      {/* Sub respuesta */}
      <SkyText
        ref={subAnswerRef}
        text="la respuesta existe... pero nadie quiere oírla"
        position={[0, 1.1, -2]}
        width={8.5}
        height={0.45}
        color="#A89580"
        fontWeight={400}
      />

      {/* Silueta de Akerlof — primitivas */}
      <AkerlofSilhouette timeRef={timeRef} />

      {/* Datos personales del paper */}
      <SkyText
        ref={ageRef}
        text="29 años"
        position={[-3.2, 1.8, -2]}
        width={2.2}
        height={0.40}
        color="#FFE5A0"
        fontWeight={500}
      />
      <SkyText
        ref={dateRef}
        text="Berkeley · 1970"
        position={[3.2, 1.8, -2]}
        width={3.0}
        height={0.40}
        color="#A89580"
        fontWeight={400}
      />
      <SkyText
        ref={rejectsRef}
        text="paper rechazado 3 veces"
        position={[0, -1.0, -2]}
        width={5.5}
        height={0.42}
        color="#FF8060"
        fontWeight={500}
      />

      {/* Cliffhanger final */}
      <SkyText
        ref={capRef}
        text="Capítulo 3"
        position={[0, -2.0, 0]}
        width={4.5}
        height={0.6}
        color="#FFE5A0"
        fontWeight={500}
      />
      <SkyText
        ref={nameRef}
        text="George Akerlof"
        position={[0, -2.9, 0]}
        width={5.5}
        height={0.65}
        color="#FFE5A0"
        fontWeight={700}
      />

      <fog attach="fog" args={['#02010A', 12, 50]} />
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
        Akerlof · Cap 2 · Escena 10
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
      const elapsed = ((performance.now() - start) / 1000) % 30;
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
interface LimonesEscena10Props {
  forceAspect?: '9:16' | '16:9' | 'auto';
}

export default function LimonesEscena10({ forceAspect = 'auto' }: LimonesEscena10Props) {
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
        camera={{ position: [0, 1.8, 11], fov, near: 0.1, far: 200 }}
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
          intensity={1.10}
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
              Cap 2 · Escena 10 · {audioMeta ? audioMeta.duration.toFixed(0) + 's' : '~26s'}
            </div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">
              ¿hay solución?
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
