/**
 * LimonesEscena11 — "Berkeley, 1970" (Cap 3 hook)
 *
 * Apertura de Cap 3. Cambio de mood: dejamos el lote oscuro de Cap 1-2 y
 * entramos a la oficina de Akerlof en Berkeley. Más cálido, contemplativo.
 *
 * Visual:
 *   - HDRI studio + key cálida (lámpara de oficina amarilla)
 *   - Una "mesa" (plano emisivo sutil) con:
 *       · briefcase (LIBRARY) — la cartera con el manuscrito
 *       · 14 hojas flotando arriba — el paper
 *   - Texto "BERKELEY · 1970 · 29 años" emerge
 *   - Cámara hace zoom-in desde wide hasta close-up del manuscrito
 *
 * Duración: ~30s.
 */

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import SkyText, { type SkyTextHandle } from './SkyText';
import PostFX from '../scenes/_postFX';
import { useAudioMeta } from './_useAudioMeta';
import AtomModel from '../assets/gltf/AtomModel';
import { LIBRARY } from '../assets/gltf/manifest';
import { MasterclassEnv } from '../assets/hdri';

const TRACK_FILE = '11-berkeley.mp3';
const META_URL = '/audio/preview/meta.json';
const AUDIO_URL = '/audio/preview/' + TRACK_FILE;
const FALLBACK_DURATION = 30.12;

AtomModel.preload(LIBRARY.briefcase.src);

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function pseudoRandom(seed: number, index: number): number {
  const x = Math.sin((seed * 12.9898) + (index * 78.233)) * 43758.5453;
  return x - Math.floor(x);
}

// ─────────────────────────────────────────────────────────────
// 14 hojas flotando — el paper original (14 páginas, dato real)

function PaperStack({ timeRef }: { timeRef: React.MutableRefObject<number> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const PAGES = 14;
  const positions = useMemo(() => {
    const arr: Array<{ x: number; y: number; z: number; rotZ: number; tAppear: number }> = [];
    for (let i = 0; i < PAGES; i++) {
      arr.push({
        x: (pseudoRandom(31, i) - 0.5) * 0.8,
        y: i * 0.025 + 1.6,
        z: (pseudoRandom(37, i) - 0.5) * 0.6,
        rotZ: (pseudoRandom(41, i) - 0.5) * 0.18,
        tAppear: 12 + i * 0.4, // 12-17.6s, aparecen una por una
      });
    }
    return arr;
  }, []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = timeRef.current;
    for (let i = 0; i < PAGES; i++) {
      const p = positions[i];
      const appear = easeOutCubic(clamp((t - p.tAppear) / 0.8, 0, 1));
      const float = Math.sin(t * 0.5 + i * 0.4) * 0.04;
      dummy.position.set(p.x, p.y + float, p.z);
      dummy.rotation.set(-Math.PI / 2 + 0.03 * Math.sin(t * 0.3 + i), p.rotZ, 0);
      dummy.scale.set(appear * 0.9, appear * 0.9, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PAGES]}>
      <planeGeometry args={[0.7, 0.95]} />
      <meshStandardMaterial
        color="#F5E6C8"
        emissive="#F5E6C8"
        emissiveIntensity={0.08}
        roughness={0.85}
        metalness={0.05}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}

// ─────────────────────────────────────────────────────────────
// Briefcase con animation de entrada

function OfficeBriefcase({ timeRef }: { timeRef: React.MutableRefObject<number> }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    const t = timeRef.current;
    const appear = easeOutCubic(clamp((t - 5) / 3, 0, 1));
    const breathe = 1 + 0.015 * Math.sin(t * 0.6);
    groupRef.current.position.set(0, -0.15, 0);
    groupRef.current.scale.setScalar(appear * 1.0 * breathe);
    groupRef.current.rotation.y = -0.2 + t * 0.06;
  });
  return (
    <group ref={groupRef}>
      <AtomModel
        src={LIBRARY.briefcase.src}
        color="#5A4F3E"
        glow={0.65}
        mode="atom"
        scale={1.4}
        fitTo={1.8}
        halo={false}
      />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Mesa — plano con leve glow

function DeskPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial
        color="#1A1410"
        roughness={0.55}
        metalness={0.10}
        emissive="#1A0E08"
        emissiveIntensity={0.08}
      />
    </mesh>
  );
}

// Spotlight cálido como lámpara de oficina
function OfficeLamp({ timeRef }: { timeRef: React.MutableRefObject<number> }) {
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame(() => {
    if (!lightRef.current) return;
    const t = timeRef.current;
    const flicker = 1 + 0.05 * Math.sin(t * 5.7);
    lightRef.current.intensity = 14 * flicker;
  });
  return (
    <>
      <pointLight ref={lightRef} position={[1.2, 3.2, 1.2]} color="#FFD080" intensity={14} distance={9} decay={2} />
      {/* "bombilla" visible */}
      <mesh position={[1.2, 3.2, 1.2]}>
        <sphereGeometry args={[0.10, 12, 8]} />
        <meshBasicMaterial color="#FFE5A0" toneMapped={false} />
      </mesh>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Camera — zoom in lento

function CameraDirector({ timeRef, sceneLoopRef }: {
  timeRef: React.MutableRefObject<number>;
  sceneLoopRef: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current % sceneLoopRef.current;
    const zoom = easeInOutCubic(clamp(t / 26, 0, 1));
    const dist = 8.5 - 4.5 * zoom; // 8.5 → 4.0
    const height = 3.5 - 1.5 * zoom; // 3.5 → 2.0
    const orbit = 0.4 + 0.20 * Math.sin(t * 0.08);
    camera.position.set(Math.sin(orbit) * dist, height, Math.cos(orbit) * dist);
    const lookY = 0.3 + 0.5 * zoom;
    camera.lookAt(0, lookY, 0);
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
  const ageRef = useRef<SkyTextHandle | null>(null);
  const paperLabelRef = useRef<SkyTextHandle | null>(null);
  const titleRef = useRef<SkyTextHandle | null>(null);
  const pagesCountRef = useRef<SkyTextHandle | null>(null);

  const sceneLoopRef = useRef(33);

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
      const appear = easeOutCubic(clamp((t - 0.5) / 2.5, 0, 1));
      locationRef.current.setOpacity(appear);
      locationRef.current.setScale(0.85 + 0.15 * appear);
    }
    if (yearRef.current) {
      const appear = easeOutCubic(clamp((t - 2.5) / 2.5, 0, 1));
      yearRef.current.setOpacity(appear * 0.85);
    }
    if (ageRef.current) {
      const appear = easeOutCubic(clamp((t - 5) / 2.5, 0, 1));
      ageRef.current.setOpacity(appear * 0.75);
    }
    if (paperLabelRef.current) {
      const appear = easeOutCubic(clamp((t - 18) / 3, 0, 1));
      paperLabelRef.current.setOpacity(appear * 0.85);
    }
    if (titleRef.current) {
      const appear = easeOutCubic(clamp((t - 21) / 3, 0, 1));
      titleRef.current.setOpacity(appear);
      titleRef.current.setScale(0.85 + 0.15 * appear);
    }
    if (pagesCountRef.current) {
      const appear = easeOutCubic(clamp((t - 25) / 3, 0, 1));
      pagesCountRef.current.setOpacity(appear * 0.70);
    }
  });

  return (
    <>
      <Suspense fallback={null}>
        <MasterclassEnv preset="studio" background={false} intensity={0.20} />
      </Suspense>
      <ambientLight intensity={0.18} color="#3A2A1E" />
      <directionalLight position={[2, 6, 3]} intensity={0.40} color="#FFD080" />
      <directionalLight position={[-3, 4, -2]} intensity={0.15} color="#7B6B4E" />
      <OfficeLamp timeRef={timeRef} />

      <CameraDirector timeRef={timeRef} sceneLoopRef={sceneLoopRef} />

      <DeskPlane />

      {/* Briefcase + 14 páginas flotando */}
      <Suspense fallback={null}>
        <OfficeBriefcase timeRef={timeRef} />
      </Suspense>
      <PaperStack timeRef={timeRef} />

      {/* Header */}
      <SkyText
        ref={locationRef}
        text="BERKELEY"
        position={[0, 5.2, -6]}
        width={5.0}
        height={0.85}
        color="#FFE5A0"
        fontWeight={600}
      />
      <SkyText
        ref={yearRef}
        text="1970"
        position={[0, 4.2, -6]}
        width={2.8}
        height={0.55}
        color="#FFB81C"
        fontWeight={700}
      />
      <SkyText
        ref={ageRef}
        text="George Akerlof · 29 años"
        position={[0, 3.4, -6]}
        width={5.5}
        height={0.40}
        color="#A89580"
        fontWeight={400}
      />

      {/* Paper labels */}
      <SkyText
        ref={paperLabelRef}
        text="3 semanas · 14 páginas"
        position={[3.8, 1.6, 0]}
        width={4.5}
        height={0.40}
        color="#FFE5A0"
        fontWeight={500}
      />
      <SkyText
        ref={titleRef}
        text="The Market for Lemons"
        position={[0, -2.2, 0]}
        width={7.5}
        height={0.65}
        color="#FFE5A0"
        fontWeight={700}
      />
      <SkyText
        ref={pagesCountRef}
        text="cambiaría la economía para siempre"
        position={[0, -3.2, 0]}
        width={7.0}
        height={0.40}
        color="#A89580"
        fontWeight={400}
      />

      <fog attach="fog" args={['#0A0608', 10, 35]} />
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
        Akerlof · Cap 3 · Escena 11
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
      const elapsed = ((performance.now() - start) / 1000) % 33;
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
interface LimonesEscena11Props {
  forceAspect?: '9:16' | '16:9' | 'auto';
}

export default function LimonesEscena11({ forceAspect = 'auto' }: LimonesEscena11Props) {
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
      style={{ background: 'radial-gradient(ellipse at 50% 35%, #1A1208 0%, #050202 80%)' }}
    >
      <audio ref={audioRef} src={AUDIO_URL} preload="auto" />

      <Canvas
        camera={{ position: [3, 3.5, 7], fov, near: 0.1, far: 200 }}
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
          intensity={1.0}
          threshold={0.38}
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
              Cap 3 · Escena 11 · {audioMeta ? audioMeta.duration.toFixed(0) + 's' : '~30s'}
            </div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">
              Berkeley · 1970
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
