/**
 * LimonesEscena12 — "La pregunta absurda" (Cap 3 · develop)
 *
 * Akerlof escribe la ecuación. Visualizamos el bucle de retroalimentación:
 *   precio → calidad promedio → precio → ...
 *
 * Visual:
 *   - 3 "círculos conceptuales" conectados por flechas en bucle
 *     1. PRECIO (verde) ←→  2. CALIDAD PROMEDIO (azul) ←→ 3. CONFIANZA (rojo) → 1
 *   - Cada nodo es una esfera emisiva con texto flotante
 *   - Pulsos de energía recorriendo las conexiones (rojo cuando va mal)
 *   - Cámara estática, frontal, contemplativa
 *
 * Duración: ~27s.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import SkyText, { type SkyTextHandle } from './SkyText';
import PostFX from '../scenes/_postFX';
import { useAudioMeta } from './_useAudioMeta';

const TRACK_FILE = '12-pregunta-absurda.mp3';
const META_URL = '/audio/preview/meta.json';
const AUDIO_URL = '/audio/preview/' + TRACK_FILE;
const FALLBACK_DURATION = 26.59;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ─────────────────────────────────────────────────────────────
// Nodo de bucle — esfera emisiva
interface NodeProps {
  position: [number, number, number];
  color: string;
  appearT: number;
  pulseT: number;
  timeRef: React.MutableRefObject<number>;
}

function LoopNode({ position, color, appearT, pulseT, timeRef }: NodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    const t = timeRef.current;
    const appear = easeOutCubic(clamp((t - appearT) / 2.0, 0, 1));
    const pulse = 1 + 0.10 * Math.max(0, Math.sin((t - pulseT) * 1.5));
    groupRef.current.position.set(position[0], position[1], position[2]);
    groupRef.current.scale.setScalar(appear * pulse);
    if (ringMatRef.current) {
      ringMatRef.current.opacity = 0.25 + 0.30 * Math.max(0, Math.sin((t - pulseT) * 1.5));
    }
  });
  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.7, 32, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.85}
          roughness={0.35}
          metalness={0.30}
          transparent
          opacity={0.55}
        />
      </mesh>
      {/* Aro alrededor */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.95, 1.05, 48]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color={color}
          transparent
          opacity={0.35}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Flecha arqueada entre dos nodos — línea + pulso de energía

function ArcConnection({ from, to, color, pulseSeed, timeRef, appearT }: {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  pulseSeed: number;
  timeRef: React.MutableRefObject<number>;
  appearT: number;
}) {
  // Genera curva entre dos puntos con un arco
  const curve = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    // Sesga el midpoint perpendicular al segmento (para arquear)
    const dir = b.clone().sub(a).normalize();
    const perp = new THREE.Vector3(-dir.y, dir.x, 0).multiplyScalar(0.8);
    mid.add(perp);
    return new THREE.QuadraticBezierCurve3(a, mid, b);
  }, [from, to]);

  const tubeGeo = useMemo(() => new THREE.TubeGeometry(curve, 32, 0.025, 8, false), [curve]);
  const pulseRef = useRef<THREE.Mesh>(null);
  const tubeMatRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const t = timeRef.current;
    const appear = easeOutCubic(clamp((t - appearT) / 2, 0, 1));
    if (tubeMatRef.current) tubeMatRef.current.opacity = appear * 0.55;
    if (!pulseRef.current) return;
    // Pulso viaja a lo largo de la curva. Loop con seed offset.
    const u = ((t * 0.35) + pulseSeed) % 1;
    const p = curve.getPoint(u);
    pulseRef.current.position.copy(p);
    pulseRef.current.visible = appear > 0.05;
    pulseRef.current.scale.setScalar(0.10 + 0.04 * Math.sin(t * 3 + pulseSeed * 5));
  });

  return (
    <>
      <mesh geometry={tubeGeo}>
        <meshBasicMaterial
          ref={tubeMatRef}
          color={color}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={pulseRef}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Camera frontal estática
function CameraDirector({ timeRef, sceneLoopRef }: {
  timeRef: React.MutableRefObject<number>;
  sceneLoopRef: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current % sceneLoopRef.current;
    const dolly = easeInOutCubic(clamp(t / 25, 0, 1));
    const dist = 12 - 1.5 * dolly;
    const yJit = 0.15 * Math.sin(t * 0.08);
    camera.position.set(0, yJit, dist);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// ─────────────────────────────────────────────────────────────
function SceneContent({ audioRef, isPlaying }: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  const headerRef = useRef<SkyTextHandle | null>(null);
  const node1LabelRef = useRef<SkyTextHandle | null>(null);
  const node2LabelRef = useRef<SkyTextHandle | null>(null);
  const node3LabelRef = useRef<SkyTextHandle | null>(null);
  const verdictRef = useRef<SkyTextHandle | null>(null);

  const sceneLoopRef = useRef(30);

  const initialTime = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const params = new URLSearchParams(window.location.search);
    const t = parseFloat(params.get('t') || '0');
    return isNaN(t) ? 0 : t;
  }, []);
  const timeRef = useRef(initialTime);

  // Posiciones de los 3 nodos en triángulo
  const POS_PRECIO: [number, number, number]   = [-3.2, 1.5, 0];
  const POS_CALIDAD: [number, number, number]  = [3.2, 1.5, 0];
  const POS_CONFIANZA: [number, number, number] = [0, -2.4, 0];

  useFrame((_, dt) => {
    if (isPlaying && audioRef.current && !audioRef.current.paused) {
      timeRef.current = audioRef.current.currentTime;
    } else {
      timeRef.current += Math.min(dt, 0.1);
    }
    const t = timeRef.current % sceneLoopRef.current;
    if (typeof window !== 'undefined') (window as any).__sceneTime = timeRef.current;

    if (headerRef.current) {
      const appear = easeOutCubic(clamp((t - 0.3) / 2.5, 0, 1));
      headerRef.current.setOpacity(appear);
      headerRef.current.setScale(0.85 + 0.15 * appear);
    }
    if (node1LabelRef.current) {
      const appear = easeOutCubic(clamp((t - 5) / 1.8, 0, 1));
      node1LabelRef.current.setOpacity(appear);
    }
    if (node2LabelRef.current) {
      const appear = easeOutCubic(clamp((t - 8) / 1.8, 0, 1));
      node2LabelRef.current.setOpacity(appear);
    }
    if (node3LabelRef.current) {
      const appear = easeOutCubic(clamp((t - 13) / 2, 0, 1));
      node3LabelRef.current.setOpacity(appear);
    }
    if (verdictRef.current) {
      const appear = easeOutCubic(clamp((t - 21) / 3, 0, 1));
      verdictRef.current.setOpacity(appear);
      verdictRef.current.setScale(0.85 + 0.15 * appear);
    }
  });

  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 5, 4]} intensity={0.40} color="#FFE5A0" />
      <directionalLight position={[-3, 3, 2]} intensity={0.25} color="#7B6BA0" />

      <CameraDirector timeRef={timeRef} sceneLoopRef={sceneLoopRef} />

      {/* 3 nodos del bucle */}
      <LoopNode position={POS_PRECIO}    color="#34D399" appearT={4}  pulseT={4}  timeRef={timeRef} />
      <LoopNode position={POS_CALIDAD}   color="#FFB81C" appearT={7}  pulseT={9}  timeRef={timeRef} />
      <LoopNode position={POS_CONFIANZA} color="#FF5040" appearT={12} pulseT={14} timeRef={timeRef} />

      {/* Conexiones — flechas arqueadas */}
      <ArcConnection from={POS_PRECIO}    to={POS_CALIDAD}   color="#FFE5A0" pulseSeed={0.0} timeRef={timeRef} appearT={10} />
      <ArcConnection from={POS_CALIDAD}   to={POS_CONFIANZA} color="#FFE5A0" pulseSeed={0.33} timeRef={timeRef} appearT={14} />
      <ArcConnection from={POS_CONFIANZA} to={POS_PRECIO}    color="#FFE5A0" pulseSeed={0.66} timeRef={timeRef} appearT={17} />

      {/* Header */}
      <SkyText
        ref={headerRef}
        text="EL BUCLE QUE COLAPSA"
        position={[0, 4.5, -3]}
        width={8}
        height={0.8}
        color="#FFE5A0"
        fontWeight={600}
      />

      {/* Labels de los 3 nodos */}
      <SkyText
        ref={node1LabelRef}
        text="precio"
        position={[POS_PRECIO[0], POS_PRECIO[1] - 1.5, POS_PRECIO[2]]}
        width={2.4}
        height={0.55}
        color="#34D399"
        fontWeight={600}
      />
      <SkyText
        ref={node2LabelRef}
        text="calidad promedio"
        position={[POS_CALIDAD[0], POS_CALIDAD[1] - 1.5, POS_CALIDAD[2]]}
        width={4.4}
        height={0.55}
        color="#FFB81C"
        fontWeight={600}
      />
      <SkyText
        ref={node3LabelRef}
        text="confianza"
        position={[POS_CONFIANZA[0], POS_CONFIANZA[1] - 1.5, POS_CONFIANZA[2]]}
        width={2.8}
        height={0.55}
        color="#FF5040"
        fontWeight={600}
      />

      {/* Verdict abajo */}
      <SkyText
        ref={verdictRef}
        text="los bucles malos colapsan"
        position={[0, -4.5, 0]}
        width={6.8}
        height={0.50}
        color="#FF5040"
        fontWeight={500}
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
        Akerlof · Cap 3 · Escena 12
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
interface LimonesEscena12Props {
  forceAspect?: '9:16' | '16:9' | 'auto';
}

export default function LimonesEscena12({ forceAspect = 'auto' }: LimonesEscena12Props) {
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
      style={{ background: 'radial-gradient(ellipse at 50% 35%, #06030F 0%, #02010A 80%)' }}
    >
      <audio ref={audioRef} src={AUDIO_URL} preload="auto" />

      <Canvas
        camera={{ position: [0, 0, 12], fov, near: 0.1, far: 200 }}
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
          vignette={0.70}
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
              Cap 3 · Escena 12 · {audioMeta ? audioMeta.duration.toFixed(0) + 's' : '~27s'}
            </div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">
              el bucle que colapsa
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
