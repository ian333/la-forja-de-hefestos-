/**
 * LimonesEscena14 — "El Nobel, 31 años después" (Cap 3 · payoff)
 *
 * Estocolmo 2001. Akerlof + Spence + Stiglitz comparten el Nobel.
 *
 * Visual:
 *   - 3 medallas Nobel orbitando (esferas doradas emisivas con anillo)
 *   - Cada una etiquetada con su economista
 *   - Background: starfield + texto "ESTOCOLMO · 2001"
 *   - El paper viejo (Quarterly Journal) brilla abajo
 *   - Camera lenta orbit
 *
 * Duración: ~28s.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import SkyText, { type SkyTextHandle } from './SkyText';
import PostFX from '../scenes/_postFX';
import { useAudioMeta } from './_useAudioMeta';

const TRACK_FILE = '14-nobel.mp3';
const META_URL = '/audio/preview/meta.json';
const AUDIO_URL = '/audio/preview/' + TRACK_FILE;
const FALLBACK_DURATION = 28.45;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ─────────────────────────────────────────────────────────────
// Medalla Nobel — esfera dorada con anillo decorativo

function NobelMedal({ angle, color, appearT, timeRef, name, year, role }: {
  angle: number;
  color: string;
  appearT: number;
  timeRef: React.MutableRefObject<number>;
  name: string;
  year: string;
  role: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    const t = timeRef.current;
    const appear = easeOutCubic(clamp((t - appearT) / 2.5, 0, 1));
    // Orbit en un círculo de radio 3 horizontalmente
    const R = 3.0;
    const orbitT = t * 0.18 + angle;
    const x = Math.cos(orbitT) * R;
    const z = Math.sin(orbitT) * R - 1;
    const y = 0.3 + 0.15 * Math.sin(t * 0.8 + angle);
    groupRef.current.position.set(x, y, z);
    groupRef.current.scale.setScalar(appear * 1.0);
    groupRef.current.rotation.y = -orbitT + Math.PI / 2;
    groupRef.current.visible = appear > 0.02;
  });
  void role; void year;
  return (
    <group ref={groupRef}>
      {/* Medalla — disco con grosor */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.08, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          roughness={0.30}
          metalness={0.85}
        />
      </mesh>
      {/* Borde del aro decorativo */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <torusGeometry args={[0.55, 0.04, 12, 32]} />
        <meshStandardMaterial
          color="#FFD86B"
          emissive="#FFD86B"
          emissiveIntensity={0.85}
          roughness={0.20}
          metalness={0.90}
        />
      </mesh>
      {/* "Cinta" colgando arriba */}
      <mesh position={[0, 0.78, 0]}>
        <boxGeometry args={[0.18, 0.45, 0.04]} />
        <meshStandardMaterial
          color="#3F5BA0"
          emissive="#3F5BA0"
          emissiveIntensity={0.35}
          roughness={0.55}
          metalness={0.10}
        />
      </mesh>
      {/* Label con el apellido */}
      <NameLabel name={name} />
    </group>
  );
}

function NameLabel({ name }: { name: string }) {
  const texture = useMemo(() => {
    const W = 512;
    const H = 96;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    ctx.font = '600 48px "Inter", sans-serif';
    ctx.fillStyle = '#FFE5A0';
    ctx.shadowColor = '#FFE5A0';
    ctx.shadowBlur = 8;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, W / 2, H / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [name]);
  return (
    <mesh position={[0, -0.95, 0]}>
      <planeGeometry args={[2.4, 0.46]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────
// Starfield
function Starfield({ count = 90 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const positions = useMemo(() => {
    const arr: Array<{ x: number; y: number; z: number; phase: number; size: number }> = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 60,
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
      <meshBasicMaterial color="#FFE5A0" transparent opacity={0.50} toneMapped={false} />
    </instancedMesh>
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
    const dolly = easeInOutCubic(clamp(t / 26, 0, 1));
    const dist = 8 - 1 * dolly;
    const height = 1.8 + 0.5 * Math.sin(t * 0.08);
    camera.position.set(0.5 * Math.sin(t * 0.12), height, dist);
    camera.lookAt(0, 0.2, -1);
  });
  return null;
}

// ─────────────────────────────────────────────────────────────
function SceneContent({ audioRef, isPlaying }: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  const locationRef = useRef<SkyTextHandle | null>(null);
  const yearRef = useRef<SkyTextHandle | null>(null);
  const subRef = useRef<SkyTextHandle | null>(null);
  const closingRef = useRef<SkyTextHandle | null>(null);

  const sceneLoopRef = useRef(31);

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

    if (locationRef.current) {
      const appear = easeOutCubic(clamp((t - 4) / 3, 0, 1));
      locationRef.current.setOpacity(appear);
      locationRef.current.setScale(0.85 + 0.15 * appear);
    }
    if (yearRef.current) {
      const appear = easeOutCubic(clamp((t - 6) / 2.5, 0, 1));
      yearRef.current.setOpacity(appear);
    }
    if (subRef.current) {
      const appear = easeOutCubic(clamp((t - 9) / 3, 0, 1));
      subRef.current.setOpacity(appear * 0.70);
    }
    if (closingRef.current) {
      const appear = easeOutCubic(clamp((t - 22) / 4, 0, 1));
      closingRef.current.setOpacity(appear);
      closingRef.current.setScale(0.85 + 0.15 * appear);
    }
  });

  return (
    <>
      <ambientLight intensity={0.30} />
      <directionalLight position={[3, 6, 4]} intensity={0.65} color="#FFE5A0" />
      <directionalLight position={[-3, 4, 2]} intensity={0.30} color="#7B6BA0" />

      <CameraDirector timeRef={timeRef} sceneLoopRef={sceneLoopRef} />
      <Starfield count={120} />

      {/* 3 medallas orbitando — Akerlof, Spence, Stiglitz */}
      <NobelMedal
        angle={0}
        color="#FFD86B"
        appearT={2}
        timeRef={timeRef}
        name="Akerlof"
        year="2001"
        role="problema"
      />
      <NobelMedal
        angle={(Math.PI * 2) / 3}
        color="#FFD86B"
        appearT={3.5}
        timeRef={timeRef}
        name="Spence"
        year="2001"
        role="señalización"
      />
      <NobelMedal
        angle={(Math.PI * 4) / 3}
        color="#FFD86B"
        appearT={5}
        timeRef={timeRef}
        name="Stiglitz"
        year="2001"
        role="información"
      />

      {/* Header — Estocolmo */}
      <SkyText
        ref={locationRef}
        text="ESTOCOLMO"
        position={[0, 4.0, -5]}
        width={6.5}
        height={0.80}
        color="#FFE5A0"
        fontWeight={600}
      />
      <SkyText
        ref={yearRef}
        text="2001"
        position={[0, 2.8, -5]}
        width={3.0}
        height={0.60}
        color="#FFB81C"
        fontWeight={700}
      />
      <SkyText
        ref={subRef}
        text="Premio Nobel de Economía · compartido"
        position={[0, 1.9, -5]}
        width={7.2}
        height={0.38}
        color="#A89580"
        fontWeight={400}
      />

      {/* Closing */}
      <SkyText
        ref={closingRef}
        text="Spence: empezó a buscar la solución"
        position={[0, -3.0, 0]}
        width={8.0}
        height={0.50}
        color="#FFE5A0"
        fontWeight={500}
      />

      <fog attach="fog" args={['#04020A', 10, 40]} />
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
        Akerlof · Cap 3 · Escena 14
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
      const elapsed = ((performance.now() - start) / 1000) % 31;
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
interface LimonesEscena14Props {
  forceAspect?: '9:16' | '16:9' | 'auto';
}

export default function LimonesEscena14({ forceAspect = 'auto' }: LimonesEscena14Props) {
  const aspect: '9:16' | '16:9' =
    forceAspect === 'auto'
      ? typeof window !== 'undefined' && window.innerHeight > window.innerWidth
        ? '9:16'
        : '16:9'
      : forceAspect;
  const fov = aspect === '9:16' ? 60 : 48;

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
      style={{ background: 'radial-gradient(ellipse at 50% 35%, #0A0612 0%, #02010A 80%)' }}
    >
      <audio ref={audioRef} src={AUDIO_URL} preload="auto" />

      <Canvas
        camera={{ position: [0, 1.8, 8], fov, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          alpha: false,
        }}
        dpr={[1, 2]}
      >
        <SceneContent audioRef={audioRef} isPlaying={isPlaying} />
        <PostFX
          intensity={1.10}
          threshold={0.36}
          smoothing={0.50}
          vignette={0.68}
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
              Cap 3 · Escena 14 · {audioMeta ? audioMeta.duration.toFixed(0) + 's' : '~28s'}
            </div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">
              Nobel · Estocolmo 2001
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
