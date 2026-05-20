/**
 * LimonesEscena06 v2 — "La matemática que mata" (info-dense + frontal cam)
 *
 * Cap 2 · Escena 6. Refactor del primer intento:
 *   - Cámara FRONTAL (no orbit) — el alumno lee el espacio como un dashboard
 *   - MÁS elementos simultáneos (datos, fórmula, fechas, consecuencias)
 *   - Texto nítido (sin triple-shadow que causaba duplicidad)
 *
 * Duración: 35.47s.
 *
 * Layout del dashboard 3D (vista frontal):
 *
 *   [HEADER · arriba]      EL CÁLCULO DEL COMPRADOR · 1970
 *
 *   [STATS · izquierda]                      [FÓRMULA · centro-derecha]
 *   • 55% defecto oculto                       ½ × $200,000
 *   • $25k pérdida promedio                     +
 *   • 40% quejas PROFECO                       ½ × $80,000
 *                                              = $140,000
 *
 *   [CONSECUENCIA · centro-bajo]
 *   "el bueno NO acepta $140k → SE VA"
 *
 *   [FOOTER]   Akerlof · Nobel 2001 · paper rechazado 3 veces
 *
 * Cámara: dolly suave hacia adelante de z=11 a z=7. Sin orbit.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import SkyText, { type SkyTextHandle } from './SkyText';
import PostFX from '../scenes/_postFX';
import { useAudioMeta } from './_useAudioMeta';

const TRACK_FILE = '06-matematica.mp3';
const META_URL = '/audio/preview/meta.json';
const AUDIO_URL = '/audio/preview/' + TRACK_FILE;
const FALLBACK_DURATION = 35.47;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ─────────────────────────────────────────────────────────────
// Subtle starfield (sin movimiento de cámara orbital — solo profundidad)

function Starfield({ count = 100 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const positions = useMemo(() => {
    const arr: Array<{ x: number; y: number; z: number; phase: number; size: number }> = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 50,
        y: (Math.random() - 0.5) * 30,
        z: -15 - Math.random() * 25,
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
      const twinkle = 0.6 + 0.4 * Math.sin(t * 0.6 + p.phase);
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(p.size * twinkle);
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
// Camera: FRONTAL, dolly suave forward. SIN ORBIT.

function CameraDirector({ timeRef, sceneLoopRef }: {
  timeRef: React.MutableRefObject<number>;
  sceneLoopRef: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current % sceneLoopRef.current;
    // Cámara FIJA en x=0, solo dolly muy suave forward + micro-breathing vertical.
    // El dashboard es estático; lo que cambia es QUÉ aparece, no la posición.
    const dollyProgress = easeInOutCubic(clamp(t / 32, 0, 1));
    const z = 13 - 2.5 * dollyProgress; // más distancia base + dolly menor
    const y = 0.20 * Math.sin(t * 0.10); // breathing imperceptible
    camera.position.set(0, y, z);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// ─────────────────────────────────────────────────────────────
// Connector line — pure 2D path en el plano XY

function ConnectorLine({ from, to, color, opacityRef }: {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  opacityRef: React.MutableRefObject<number>;
}) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      from[0], from[1], from[2],
      to[0], to[1], to[2],
    ], 3));
    return g;
  }, [from, to]);
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  useFrame(() => {
    if (matRef.current) matRef.current.opacity = opacityRef.current;
  });
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={0}
        toneMapped={false}
      />
    </lineSegments>
  );
}

// ─────────────────────────────────────────────────────────────
function SceneContent({ audioRef, isPlaying }: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  // ═══ Refs para TODOS los elementos del dashboard ═══

  // Header
  const titleRef = useRef<SkyTextHandle | null>(null);
  const dateRef = useRef<SkyTextHandle | null>(null);

  // Stats column (izquierda)
  const stat1Ref = useRef<SkyTextHandle | null>(null);
  const stat2Ref = useRef<SkyTextHandle | null>(null);
  const stat3Ref = useRef<SkyTextHandle | null>(null);
  const stat4Ref = useRef<SkyTextHandle | null>(null);

  // Formula (centro-derecha)
  const f1Ref = useRef<SkyTextHandle | null>(null); // "½ × $200,000"
  const f2Ref = useRef<SkyTextHandle | null>(null); // "+"
  const f3Ref = useRef<SkyTextHandle | null>(null); // "½ × $80,000"
  const f4Ref = useRef<SkyTextHandle | null>(null); // "="
  const f5Ref = useRef<SkyTextHandle | null>(null); // "$140,000" GRANDE

  // Consequence (debajo de fórmula)
  const c1Ref = useRef<SkyTextHandle | null>(null); // "el bueno NO acepta"
  const c2Ref = useRef<SkyTextHandle | null>(null); // "→ se va"

  // Footer
  const footRef = useRef<SkyTextHandle | null>(null);
  const foot2Ref = useRef<SkyTextHandle | null>(null);

  const connectorOpRef = useRef(0);
  const sceneLoopRef = useRef(38);

  const initialTime = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const params = new URLSearchParams(window.location.search);
    const t = parseFloat(params.get('t') || '0');
    return isNaN(t) ? 0 : t;
  }, []);
  const timeRef = useRef(initialTime);

  // Helper: fade-in (no fade-out — todo permanece visible al final)
  const fade = (
    handle: SkyTextHandle | null,
    t: number,
    appearStart: number,
    appearEnd: number,
    targetOpacity = 1,
  ) => {
    if (!handle) return;
    const p = easeOutCubic(clamp((t - appearStart) / (appearEnd - appearStart), 0, 1));
    handle.setOpacity(p * targetOpacity);
    handle.setScale(0.85 + 0.15 * p);
  };

  useFrame((_, dt) => {
    if (isPlaying && audioRef.current && !audioRef.current.paused) {
      timeRef.current = audioRef.current.currentTime;
    } else {
      timeRef.current += Math.min(dt, 0.1);
    }
    const t = timeRef.current % sceneLoopRef.current;
    if (typeof window !== 'undefined') (window as any).__sceneTime = timeRef.current;

    // ═══ Timing ═══
    // 0-3: Header
    fade(titleRef.current, t, 0.5, 3);
    fade(dateRef.current, t, 1.0, 3.5, 0.6);

    // 3-7: Stats column (la cifra, el contexto)
    fade(stat1Ref.current, t, 3, 5);
    fade(stat2Ref.current, t, 4, 6);
    fade(stat3Ref.current, t, 5, 7, 0.7);
    fade(stat4Ref.current, t, 6, 8, 0.7);

    // 7-18: Formula building (paso a paso siguiendo la voz)
    fade(f1Ref.current, t, 7, 10);   // ½ × $200,000
    fade(f2Ref.current, t, 10, 11);  // +
    fade(f3Ref.current, t, 11, 13);  // ½ × $80,000
    fade(f4Ref.current, t, 14, 15);  // =
    fade(f5Ref.current, t, 15, 18, 1.0);  // $140,000

    // 18-29: Consequence
    fade(c1Ref.current, t, 22, 25);   // el bueno NO acepta
    fade(c2Ref.current, t, 26, 29);   // → se va

    // 29-35: Footer (cierre / context histórico)
    fade(footRef.current, t, 30, 33, 0.6);
    fade(foot2Ref.current, t, 32, 35, 0.6);

    // Connector lines: aparecen cuando la fórmula está completa
    connectorOpRef.current = easeOutCubic(clamp((t - 13) / 4, 0, 1)) * 0.45;
  });

  // ═══ POSICIONES en el espacio (vista frontal) ═══
  // Layout: -6 izquierda, +6 derecha · -4 abajo, +4 arriba

  // Header
  const POS_TITLE: [number, number, number]  = [0, 4.2, 0];
  const POS_DATE:  [number, number, number]  = [0, 3.5, 0];

  // Stats column (izquierda)
  const POS_S1: [number, number, number] = [-4.5, 2.0, 0];
  const POS_S2: [number, number, number] = [-4.5, 1.1, 0];
  const POS_S3: [number, number, number] = [-4.5, 0.2, 0];
  const POS_S4: [number, number, number] = [-4.5, -0.7, 0];

  // Formula (centro-derecha)
  const POS_F1: [number, number, number] = [2.5, 1.8, 0];     // ½ × $200k
  const POS_F2: [number, number, number] = [2.5, 1.0, 0];     // +
  const POS_F3: [number, number, number] = [2.5, 0.2, 0];     // ½ × $80k
  const POS_F4: [number, number, number] = [2.5, -0.6, 0];    // =
  const POS_F5: [number, number, number] = [3.5, -1.6, 0];    // $140,000 (grande)

  // Consequence
  const POS_C1: [number, number, number] = [0, -2.8, 0];
  const POS_C2: [number, number, number] = [0, -3.6, 0];

  // Footer
  const POS_FOOT: [number, number, number]  = [0, -4.4, 0];
  const POS_FOOT2: [number, number, number] = [0, -5.0, 0];

  return (
    <>
      <ambientLight intensity={0.30} />
      <directionalLight position={[3, 5, 5]} intensity={0.35} color="#FFFFFF" />

      <CameraDirector timeRef={timeRef} sceneLoopRef={sceneLoopRef} />
      <Starfield count={120} />

      {/* ═══ HEADER ═══ */}
      <SkyText ref={titleRef}
        text="EL CÁLCULO DEL COMPRADOR"
        position={POS_TITLE}
        color="#FFE5A0"
        width={7.5} height={0.7}
        fontWeight={600}
      />
      <SkyText ref={dateRef}
        text="Akerlof · 1970"
        position={POS_DATE}
        color="#A89580"
        width={3.6} height={0.45}
        fontWeight={400}
      />

      {/* ═══ STATS COLUMN (izquierda) ═══ */}
      <SkyText ref={stat1Ref}
        text="55% de usados en CDMX"
        position={POS_S1}
        color="#FFE5A0"
        width={5.0} height={0.50}
        fontWeight={500}
      />
      <SkyText ref={stat2Ref}
        text="tienen defecto oculto"
        position={[POS_S1[0], POS_S1[1] - 0.55, 0]}
        color="#FFB81C"
        width={5.0} height={0.50}
        fontWeight={500}
      />
      <SkyText ref={stat3Ref}
        text="pérdida promedio: $25,000"
        position={[POS_S1[0], POS_S1[1] - 1.4, 0]}
        color="#A89580"
        width={5.6} height={0.42}
        fontWeight={400}
      />
      <SkyText ref={stat4Ref}
        text="40% de quejas PROFECO"
        position={[POS_S1[0], POS_S1[1] - 2.0, 0]}
        color="#A89580"
        width={5.6} height={0.42}
        fontWeight={400}
      />

      {/* ═══ FORMULA (centro-derecha) ═══ */}
      <SkyText ref={f1Ref}
        text="½ × $200,000"
        position={POS_F1}
        color="#34D399"
        width={4.5} height={0.65}
        fontWeight={600}
      />
      <SkyText ref={f2Ref}
        text="+"
        position={POS_F2}
        color="#FFE5A0"
        width={0.6} height={0.6}
        fontWeight={700}
      />
      <SkyText ref={f3Ref}
        text="½ × $80,000"
        position={POS_F3}
        color="#FF5040"
        width={4.2} height={0.65}
        fontWeight={600}
      />
      <SkyText ref={f4Ref}
        text="="
        position={POS_F4}
        color="#FFE5A0"
        width={0.6} height={0.6}
        fontWeight={700}
      />
      <SkyText ref={f5Ref}
        text="$140,000"
        position={POS_F5}
        color="#FDB813"
        width={5.0} height={1.0}
        fontWeight={700}
      />

      {/* ═══ CONSEQUENCE (debajo) ═══ */}
      <SkyText ref={c1Ref}
        text="el bueno NO acepta $140,000"
        position={POS_C1}
        color="#FF5040"
        width={8.5} height={0.55}
        fontWeight={500}
      />
      <SkyText ref={c2Ref}
        text="→ se va. Quedan los malos."
        position={POS_C2}
        color="#FF5040"
        width={8.0} height={0.55}
        fontWeight={600}
      />

      {/* ═══ FOOTER ═══ */}
      <SkyText ref={footRef}
        text="Paper rechazado 3 veces antes de publicarse"
        position={POS_FOOT}
        color="#A89580"
        width={8.0} height={0.40}
        fontWeight={400}
      />
      <SkyText ref={foot2Ref}
        text="Nobel 2001 · base de Spence, Stiglitz, Tirole"
        position={POS_FOOT2}
        color="#A89580"
        width={8.0} height={0.40}
        fontWeight={400}
      />

      {/* Connector lines uniendo la fórmula */}
      <ConnectorLine from={POS_F1} to={POS_F4} color="#FFE5A0" opacityRef={connectorOpRef} />
      <ConnectorLine from={POS_F3} to={POS_F4} color="#FFE5A0" opacityRef={connectorOpRef} />
      <ConnectorLine from={POS_F4} to={POS_F5} color="#FDB813" opacityRef={connectorOpRef} />

      <fog attach="fog" args={['#020108', 12, 35]} />
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
        Akerlof · Cap 2 · Escena 6
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
      const elapsed = ((performance.now() - start) / 1000) % 38;
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
interface LimonesEscena06Props {
  forceAspect?: '9:16' | '16:9' | 'auto';
}

export default function LimonesEscena06({ forceAspect = 'auto' }: LimonesEscena06Props) {
  const aspect: '9:16' | '16:9' =
    forceAspect === 'auto'
      ? typeof window !== 'undefined' && window.innerHeight > window.innerWidth
        ? '9:16'
        : '16:9'
      : forceAspect;
  // FOV un poco más amplio para que quepa todo el dashboard
  const fov = aspect === '9:16' ? 62 : 50;

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
      style={{ background: 'radial-gradient(ellipse at 50% 35%, #0a0d1a 0%, #020108 80%)' }}
    >
      <audio ref={audioRef} src={AUDIO_URL} preload="auto" />

      <Canvas
        camera={{ position: [0, 0, 11], fov, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
          alpha: false,
        }}
        dpr={[1, 2]}
      >
        <SceneContent audioRef={audioRef} isPlaying={isPlaying} />
        {/* PostFX más sutil para esta escena info-dense — el texto debe leerse,
            no fundirse en el glow */}
        <PostFX
          intensity={1.2}
          threshold={0.30}
          smoothing={0.50}
          vignette={0.65}
          vignetteOffset={0.22}
          aberration={0.0006}
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
              Cap 2 · Escena 6 · {audioMeta ? audioMeta.duration.toFixed(0) + 's' : '~35s'}
            </div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">
              el dashboard de la trampa
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
