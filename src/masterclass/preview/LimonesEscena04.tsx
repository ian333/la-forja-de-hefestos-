/**
 * LimonesEscena04 — "Ahora son cien · POV vendedor vs comprador"
 *
 * Escena 4 del Cap 1. Duración: 27.87s (audio real).
 * Template: zoom-out · Mood: asombro contemplativo → claridad mental
 *
 * Timeline (en s):
 *   0.0–3.5   Vista wide: 100 carros en grid, todos neutrales (gris).
 *   3.5–7.5   Cámara orbita suave revelando la magnitud del lote.
 *   7.5–12.0  POV VENDEDOR: los colores reales emergen (cherries verdes, lemons rojos).
 *   12.0–15.0 Hold del estado "vendedor sabe".
 *   15.0–19.0 TRANSICIÓN: los colores difuminan a gris uniforme. POV COMPRADOR.
 *   19.0–23.0 Hold del estado "comprador no sabe — todos se ven igual".
 *   23.0–28.0 Pull-back final + pregunta retórica visual.
 *
 * Reusa: SkyDome, Floor, Lighting (sin LampPost — estamos en lote abierto),
 *        CityBackground muy lejano.
 * Nuevo: CarLot100.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import CarLot100, { type CarLot100Handle } from './CarLot100';
import PostFX from '../scenes/_postFX';
import { useAudioMeta } from './_useAudioMeta';

const TRACK_FILE = '04-cien-carros.mp3';
const META_URL = '/audio/preview/meta.json';
const AUDIO_URL = '/audio/preview/' + TRACK_FILE;
const FALLBACK_DURATION = 27.87;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ─────────────────────────────────────────────────────────────
function NightSky({ skyRef }: { skyRef: React.RefObject<THREE.Mesh | null> }) {
  return (
    <mesh ref={skyRef}>
      <sphereGeometry args={[80, 32, 16]} />
      <shaderMaterial
        side={THREE.BackSide}
        uniforms={{ coolness: { value: 0 } }}
        vertexShader={`
          varying vec3 vWP;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWP = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `}
        fragmentShader={`
          uniform float coolness;
          varying vec3 vWP;
          void main() {
            float h = normalize(vWP).y;
            vec3 warmTop = vec3(0.025, 0.020, 0.040);
            vec3 warmBot = vec3(0.060, 0.035, 0.020);
            vec3 coldTop = vec3(0.010, 0.020, 0.060);
            vec3 coldBot = vec3(0.020, 0.040, 0.075);
            vec3 top = mix(warmTop, coldTop, coolness);
            vec3 bot = mix(warmBot, coldBot, coolness);
            vec3 col = mix(bot, top, smoothstep(-0.3, 0.7, h));
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial
        color="#080510"
        roughness={0.30}
        metalness={0.55}
        emissive="#0A0512"
        emissiveIntensity={0.10}
      />
    </mesh>
  );
}

function DistantWindows() {
  // Background lejano para sensación de "lote a las afueras de la ciudad"
  const windows = useMemo(() => {
    const arr: Array<{ x: number; y: number; intensity: number; color: string }> = [];
    const rng = (s: number) => { const x = Math.sin(s * 78.233) * 43758.5453; return x - Math.floor(x); };
    for (let i = 0; i < 36; i++) {
      arr.push({
        x: (rng(i) - 0.5) * 80,
        y: 0.5 + rng(i + 100) * 5,
        intensity: 0.3 + rng(i + 200) * 0.5,
        color: rng(i + 300) > 0.6 ? '#FFE5A0' : '#FFD080',
      });
    }
    return arr;
  }, []);
  return (
    <group position={[0, 0, -40]}>
      {windows.map((w, i) => (
        <mesh key={i} position={[w.x, w.y, 0]}>
          <planeGeometry args={[0.15, 0.18]} />
          <meshBasicMaterial color={w.color} transparent opacity={w.intensity * 0.35} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function CinematicLighting({ coolnessRef }: { coolnessRef: React.MutableRefObject<number> }) {
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  useFrame(() => {
    const c = coolnessRef.current;
    if (keyRef.current) {
      const warm = new THREE.Color('#FFB870');
      const cool = new THREE.Color('#B8C8F5');
      keyRef.current.color = warm.clone().lerp(cool, c);
      keyRef.current.intensity = 0.8 + 0.2 * c;
    }
    if (rimRef.current) rimRef.current.intensity = 0.25 + 0.45 * c;
    if (ambientRef.current) {
      const warm = new THREE.Color('#3A2818');
      const cool = new THREE.Color('#181A2E');
      ambientRef.current.color = warm.clone().lerp(cool, c);
      ambientRef.current.intensity = 0.30;
    }
  });
  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.30} />
      <directionalLight ref={keyRef} position={[5, 12, 5]} intensity={0.8} color="#FFB870" castShadow={false} />
      <directionalLight ref={rimRef} position={[-5, 8, -5]} intensity={0.25} color="#7FB0FF" />
    </>
  );
}

function SkyUpdater({ skyRef, coolnessRef }: {
  skyRef: React.RefObject<THREE.Mesh | null>;
  coolnessRef: React.MutableRefObject<number>;
}) {
  useFrame(() => {
    if (!skyRef.current) return;
    const mat = skyRef.current.material as THREE.ShaderMaterial;
    if (mat && mat.uniforms && mat.uniforms.coolness) {
      mat.uniforms.coolness.value = coolnessRef.current;
    }
  });
  return null;
}

// ─────────────────────────────────────────────────────────────
// Camera director — orbit suave + zoom-out gradual

function CameraDirector({ coolnessRef, timeRef, sceneLoopRef }: {
  coolnessRef: React.MutableRefObject<number>;
  timeRef: React.MutableRefObject<number>;
  sceneLoopRef: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current % sceneLoopRef.current;

    // Cámara en vista 3/4 desde arriba.
    // Phase A (0-3.5): empieza media-cerca
    // Phase B (3.5-12): orbita suave revelando magnitud
    // Phase C (15-19): durante la transición, sube ligeramente
    // Phase D (23-28): pull-back final dramatic

    const baseDist = 24;
    const baseHeight = 11;
    const baseOrbit = 0.3;

    const pullBack = easeInOutCubic(clamp((t - 23) / 5, 0, 1));
    const slowRise = easeInOutCubic(clamp((t - 15) / 4, 0, 1));

    const dist = baseDist + 6 * pullBack;
    const height = baseHeight + 2 * slowRise + 3 * pullBack;
    const orbit = baseOrbit + (t / sceneLoopRef.current) * 0.6;

    camera.position.set(Math.sin(orbit) * dist, height, Math.cos(orbit) * dist);
    camera.lookAt(0, 0, 0);

    // Coolness arc: 0-7 warm, 7-15 transición, 15+ cool
    let coolness = 0;
    if (t < 7) coolness = 0;
    else if (t < 15) coolness = easeInOutCubic((t - 7) / 8);
    else coolness = 1;
    coolnessRef.current = coolness;
  });
  return null;
}

// ─────────────────────────────────────────────────────────────
function SceneContent({ aspect, audioRef, isPlaying }: {
  aspect: '9:16' | '16:9';
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  void aspect; // se usaría para layout HUD diferente
  const lotHandle = useRef<CarLot100Handle | null>(null);
  const skyRef = useRef<THREE.Mesh>(null);
  const coolnessRef = useRef(0);
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

    // ── POV mix
    //   0 = vendedor (true colors revealed)
    //   1 = comprador (all neutral gray)
    //
    // Empieza en 1 (neutral). Entre t=7.5-12: → 0 (vendedor reveal).
    // Hold hasta t=15. Entre t=15-19: → 1 (comprador, vuelve a gris).
    // Hold el resto.
    let pov = 1;
    if (t < 7.5) {
      pov = 1;
    } else if (t < 12.0) {
      pov = 1 - easeInOutCubic((t - 7.5) / 4.5);
    } else if (t < 15.0) {
      pov = 0;
    } else if (t < 19.0) {
      pov = easeInOutCubic((t - 15.0) / 4.0);
    } else {
      pov = 1;
    }
    if (lotHandle.current) lotHandle.current.setPovMix(pov);
  });

  return (
    <>
      <NightSky skyRef={skyRef} />
      <SkyUpdater skyRef={skyRef} coolnessRef={coolnessRef} />
      <CinematicLighting coolnessRef={coolnessRef} />
      <CameraDirector coolnessRef={coolnessRef} timeRef={timeRef} sceneLoopRef={sceneLoopRef} />

      <Floor />
      <DistantWindows />

      <CarLot100 ref={lotHandle} cherryRatio={0.60} seed={7} />

      <fog attach="fog" args={['#0a0510', 18, 60]} />
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
        Akerlof · Cap 1 · Escena 4
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
interface LimonesEscena04Props {
  forceAspect?: '9:16' | '16:9' | 'auto';
}

export default function LimonesEscena04({ forceAspect = 'auto' }: LimonesEscena04Props) {
  const aspect: '9:16' | '16:9' =
    forceAspect === 'auto'
      ? typeof window !== 'undefined' && window.innerHeight > window.innerWidth
        ? '9:16'
        : '16:9'
      : forceAspect;
  const fov = aspect === '9:16' ? 55 : 45;

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
      style={{ background: 'radial-gradient(ellipse at 50% 35%, #1a1015 0%, #050308 80%)' }}
    >
      <audio ref={audioRef} src={AUDIO_URL} preload="auto" />

      <Canvas
        camera={{ position: [10, 11, 22], fov, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.18,
          alpha: false,
        }}
        dpr={[1, 2]}
      >
        <SceneContent aspect={aspect} audioRef={audioRef} isPlaying={isPlaying} />
        <PostFX
          intensity={1.5}
          threshold={0.20}
          smoothing={0.45}
          vignette={0.65}
          vignetteOffset={0.22}
          aberration={0.0012}
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
              Cap 1 · Escena 4 · {audioMeta ? audioMeta.duration.toFixed(0) + 's' : '~28s'}
            </div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">
              audífonos recomendados
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
