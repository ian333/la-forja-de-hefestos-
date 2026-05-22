/**
 * LimonesEscena13 — "Rechazado tres veces" (Cap 3 · turn)
 *
 * Visual: 4 papers en columna vertical.
 *   Papers 1-3: cada uno aparece, recibe sello rojo "RECHAZADO" + nombre revista, cae.
 *   Paper 4: aparece, recibe sello verde "ACEPTADO" + "Quarterly Journal of Economics".
 *
 * Mood: frustración → vindicación. Camera ligeramente shake en rechazos.
 *
 * Duración: ~34s.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import SkyText, { type SkyTextHandle } from './SkyText';
import PostFX from '../scenes/_postFX';
import { useAudioMeta } from './_useAudioMeta';

const TRACK_FILE = '13-rechazado.mp3';
const META_URL = '/audio/preview/meta.json';
const AUDIO_URL = '/audio/preview/' + TRACK_FILE;
const FALLBACK_DURATION = 33.41;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ─────────────────────────────────────────────────────────────
// Un "paper" — rectángulo blanco que entra, recibe sello y cae

interface PaperProps {
  basePos: [number, number, number];
  journalName: string;
  shortName: string;
  tEnter: number;
  tStamp: number;
  tExit: number;
  accepted: boolean;
  timeRef: React.MutableRefObject<number>;
}

function PaperWithStamp({
  basePos,
  journalName: _journalName,
  shortName,
  tEnter,
  tStamp,
  tExit,
  accepted,
  timeRef,
}: PaperProps) {
  const groupRef = useRef<THREE.Group>(null);
  const paperMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const stampMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const stampGroupRef = useRef<THREE.Group>(null);

  // Pequeño texto canvas-based para el sello
  const stampTexture = useMemo(() => {
    const W = 512;
    const H = 256;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    const color = accepted ? '#34D399' : '#FF5040';
    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    // Marco rectangular doble (estilo sello)
    ctx.strokeRect(20, 20, W - 40, H - 40);
    ctx.strokeRect(35, 35, W - 70, H - 70);
    // Texto
    ctx.font = '700 95px "Inter", sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(accepted ? 'ACEPTADO' : 'RECHAZADO', W / 2, H / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }, [accepted]);

  useFrame(() => {
    if (!groupRef.current) return;
    const t = timeRef.current;

    // Phase: enter, idle, stamp shake, exit
    const enterP = easeOutCubic(clamp((t - tEnter) / 0.8, 0, 1));
    const exitP = easeOutCubic(clamp((t - tExit) / 1.0, 0, 1));

    const yEntry = 5 * (1 - enterP);
    const yExit = -10 * exitP;
    const x = basePos[0];
    const z = basePos[2];
    groupRef.current.position.set(x, basePos[1] + yEntry + yExit, z);

    // Rotación al caer
    groupRef.current.rotation.set(0, 0, exitP * (accepted ? 0 : 0.35));

    // Visible solo en el rango
    groupRef.current.visible = enterP > 0.01 && exitP < 0.98;

    if (paperMatRef.current) {
      paperMatRef.current.emissiveIntensity = accepted && t > tStamp + 1 ? 0.45 : 0.10;
    }

    // Sello — aparece con pop scale + shake
    if (stampGroupRef.current) {
      const stampP = easeOutCubic(clamp((t - tStamp) / 0.4, 0, 1));
      const shake = stampP > 0.1 && stampP < 0.95 ? Math.sin(t * 50) * 0.04 * (1 - stampP) : 0;
      stampGroupRef.current.scale.setScalar(stampP * 1.0 + shake);
      stampGroupRef.current.visible = stampP > 0.05;
      stampGroupRef.current.rotation.z = -0.20 + shake;
    }
    if (stampMatRef.current) {
      const stampP = easeOutCubic(clamp((t - tStamp) / 0.4, 0, 1));
      stampMatRef.current.opacity = stampP * 0.95;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Paper background — rectángulo blanco */}
      <mesh>
        <planeGeometry args={[2.2, 2.8]} />
        <meshStandardMaterial
          ref={paperMatRef}
          color="#F5E6C8"
          emissive={accepted ? '#34D399' : '#F5E6C8'}
          emissiveIntensity={0.10}
          roughness={0.85}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Sub-label: nombre de la revista en parte superior del paper */}
      {/* No usamos SkyText aquí porque va anclado al paper; usamos plane con texture */}
      <JournalLabel name={shortName} accepted={accepted} />

      {/* Sello — texture canvas */}
      <group ref={stampGroupRef} position={[0.10, -0.15, 0.05]} rotation={[0, 0, -0.20]}>
        <mesh>
          <planeGeometry args={[1.8, 0.9]} />
          <meshBasicMaterial
            ref={stampMatRef}
            map={stampTexture}
            transparent
            opacity={0}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

function JournalLabel({ name, accepted: _accepted }: { name: string; accepted: boolean }) {
  // Canvas-rendered label para mantener consistencia y crisp text
  const texture = useMemo(() => {
    const W = 512;
    const H = 96;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#3A2A1E';
    ctx.font = '500 42px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, W / 2, H / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [name]);
  return (
    <mesh position={[0, 1.1, 0.02]}>
      <planeGeometry args={[2.0, 0.35]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────
// Camera shake — pequeño rumble en rechazos

function CameraDirector({ timeRef, sceneLoopRef, shakeTimes }: {
  timeRef: React.MutableRefObject<number>;
  sceneLoopRef: React.MutableRefObject<number>;
  shakeTimes: number[]; // ts en los que ocurre shake
}) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current % sceneLoopRef.current;
    let shake = 0;
    for (const ts of shakeTimes) {
      const local = (t - ts) / 0.5;
      if (local > 0 && local < 1) {
        shake = Math.max(shake, (1 - local) * 0.10);
      }
    }
    const sx = shake * Math.sin(t * 50);
    const sy = shake * Math.cos(t * 47);
    const dolly = easeInOutCubic(clamp(t / 32, 0, 1));
    camera.position.set(sx, 0.3 + sy, 9 - 1.5 * dolly);
    camera.lookAt(sx * 0.3, 0, 0);
  });
  return null;
}

// ─────────────────────────────────────────────────────────────
function SceneContent({ audioRef, isPlaying }: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  const headerRef = useRef<SkyTextHandle | null>(null);
  const footerRef = useRef<SkyTextHandle | null>(null);
  const acceptedNoteRef = useRef<SkyTextHandle | null>(null);

  const sceneLoopRef = useRef(36);

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

    if (headerRef.current) {
      const appear = easeOutCubic(clamp((t - 0.5) / 2, 0, 1));
      const fadeOut = easeOutCubic(clamp((t - 26) / 4, 0, 1));
      headerRef.current.setOpacity(appear * (1 - fadeOut));
      headerRef.current.setScale(0.85 + 0.15 * appear);
    }
    if (acceptedNoteRef.current) {
      const appear = easeOutCubic(clamp((t - 25) / 3, 0, 1));
      acceptedNoteRef.current.setOpacity(appear);
      acceptedNoteRef.current.setScale(0.85 + 0.15 * appear);
    }
    if (footerRef.current) {
      const appear = easeOutCubic(clamp((t - 28.5) / 3, 0, 1));
      footerRef.current.setOpacity(appear * 0.75);
    }
  });

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[2, 4, 5]} intensity={0.65} color="#FFE5A0" />
      <directionalLight position={[-2, 3, 2]} intensity={0.25} color="#A89580" />

      <CameraDirector
        timeRef={timeRef}
        sceneLoopRef={sceneLoopRef}
        shakeTimes={[4.5, 9, 14]}  // 3 rechazos
      />

      {/* Floor sutil */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#08050E" roughness={0.4} metalness={0.4} emissive="#0A0510" emissiveIntensity={0.06} />
      </mesh>

      {/* Header */}
      <SkyText
        ref={headerRef}
        text="PAPER RECHAZADO 3 VECES"
        position={[0, 3.8, -3]}
        width={8.5}
        height={0.75}
        color="#FF5040"
        fontWeight={600}
      />

      {/* 4 papers — primeros 3 rechazos, último aceptado */}
      <PaperWithStamp
        basePos={[-3.2, 0.3, 0]}
        journalName="American Economic Review"
        shortName="American Economic Review"
        tEnter={3}
        tStamp={4.5}
        tExit={7}
        accepted={false}
        timeRef={timeRef}
      />
      <PaperWithStamp
        basePos={[-1.1, 0.3, 0]}
        journalName="Journal of Political Economy"
        shortName="Journal of Political Economy"
        tEnter={7.5}
        tStamp={9}
        tExit={12}
        accepted={false}
        timeRef={timeRef}
      />
      <PaperWithStamp
        basePos={[1.1, 0.3, 0]}
        journalName="Review of Economic Studies"
        shortName="Review of Economic Studies"
        tEnter={12.5}
        tStamp={14}
        tExit={17}
        accepted={false}
        timeRef={timeRef}
      />
      <PaperWithStamp
        basePos={[3.2, 0.3, 0]}
        journalName="Quarterly Journal of Economics"
        shortName="Quarterly Journal of Economics"
        tEnter={20}
        tStamp={23}
        tExit={50}  // nunca sale (queda al final)
        accepted={true}
        timeRef={timeRef}
      />

      {/* Note final: aceptado en QJE 1970 */}
      <SkyText
        ref={acceptedNoteRef}
        text="aceptado · Quarterly Journal of Economics · 1970"
        position={[0, -2.7, -2]}
        width={9.5}
        height={0.45}
        color="#34D399"
        fontWeight={500}
      />
      <SkyText
        ref={footerRef}
        text="hoy es uno de los papers más citados de la historia"
        position={[0, -3.6, -2]}
        width={9.0}
        height={0.40}
        color="#A89580"
        fontWeight={400}
      />

      <fog attach="fog" args={['#04020A', 12, 50]} />
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
        Akerlof · Cap 3 · Escena 13
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
      const elapsed = ((performance.now() - start) / 1000) % 36;
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
interface LimonesEscena13Props {
  forceAspect?: '9:16' | '16:9' | 'auto';
}

export default function LimonesEscena13({ forceAspect = 'auto' }: LimonesEscena13Props) {
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
        camera={{ position: [0, 0.3, 9], fov, near: 0.1, far: 200 }}
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
          intensity={1.0}
          threshold={0.40}
          smoothing={0.50}
          vignette={0.65}
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
              Cap 3 · Escena 13 · {audioMeta ? audioMeta.duration.toFixed(0) + 's' : '~34s'}
            </div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">
              paper rechazado
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
