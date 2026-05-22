/**
 * LimonesEscena05 — "Información asimétrica (cliffhanger Cap 1)"
 *
 * Escena 5 del Cap 1. Duración: 28.45s.
 * Template: reveal · Mood: claridad mental (frío analítico).
 *
 * Timeline:
 *   0.0–3.0   Lote 100 carros gris (estado final de Escena 4). Cámara fija.
 *   3.0–7.0   Palabra "información" emerge en el cielo (fade-in lento).
 *   7.0–11.0  Palabra "asimétrica" emerge debajo. Las dos forman el término.
 *   11.0–18.0 Hold contemplativo. El alumno mira lote + nombre.
 *   18.0–23.0 Coolness sube — el cielo se vuelve más analítico.
 *   23.0–28.5 Pull-back final. Fade-out gradual de carros y texto.
 *
 * Reusa: CarLot100, NightSky, Floor, DistantWindows, CinematicLighting (todos
 *        importados localmente — pendiente extraer shell).
 * Nuevo: SkyText × 2 (uno por palabra).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import CarLot100, { type CarLot100Handle } from './CarLot100';
import SkyText, { type SkyTextHandle } from './SkyText';
import PostFX from '../scenes/_postFX';
import { useAudioMeta } from './_useAudioMeta';

const TRACK_FILE = '05-cliffhanger.mp3';
const META_URL = '/audio/preview/meta.json';
const AUDIO_URL = '/audio/preview/' + TRACK_FILE;
const FALLBACK_DURATION = 28.45;

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
        uniforms={{ coolness: { value: 1 } }}
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
      const cool1 = new THREE.Color('#B8C8F5');
      const cool2 = new THREE.Color('#7FB0FF');
      keyRef.current.color = cool1.clone().lerp(cool2, c);
      keyRef.current.intensity = 0.6 + 0.2 * c;
    }
    if (rimRef.current) rimRef.current.intensity = 0.40 + 0.40 * c;
    if (ambientRef.current) {
      ambientRef.current.color = new THREE.Color('#181A2E');
      ambientRef.current.intensity = 0.32;
    }
  });
  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.32} />
      <directionalLight ref={keyRef} position={[3, 12, 3]} intensity={0.6} color="#B8C8F5" />
      <directionalLight ref={rimRef} position={[-5, 8, -5]} intensity={0.40} color="#7FB0FF" />
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
function CameraDirector({ timeRef, sceneLoopRef }: {
  timeRef: React.MutableRefObject<number>;
  sceneLoopRef: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current % sceneLoopRef.current;

    // Cámara casi fija (vista contemplativa) con micro-breathing y un
    // pull-back muy lento al final.
    const baseDist = 28;
    const baseHeight = 13;

    const pullBack = easeInOutCubic(clamp((t - 23) / 5.5, 0, 1));

    const dist = baseDist + 4 * pullBack;
    const height = baseHeight + 1.5 * pullBack;
    const orbit = 0.4 + 0.04 * Math.sin(t * 0.20) + (t / sceneLoopRef.current) * 0.25;

    camera.position.set(Math.sin(orbit) * dist, height, Math.cos(orbit) * dist);
    // Mira ligeramente arriba (al sky text) entre t=4 y t=18
    const skyFocus = easeInOutCubic(clamp((t - 4) / 6, 0, 1)) - easeInOutCubic(clamp((t - 22) / 4, 0, 1));
    camera.lookAt(0, 1.5 + 2.5 * skyFocus, 0);
  });
  return null;
}

// ─────────────────────────────────────────────────────────────
function SceneContent({ audioRef, isPlaying }: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  const lotHandle = useRef<CarLot100Handle | null>(null);
  const skyText1Handle = useRef<SkyTextHandle | null>(null);
  const skyText2Handle = useRef<SkyTextHandle | null>(null);
  const skyRef = useRef<THREE.Mesh>(null);
  const coolnessRef = useRef(1); // Empezamos en cool (continúa de Escena 4)
  const sceneLoopRef = useRef(32);

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

    // Lote siempre en POV comprador (gris uniforme) — eso es el estado final
    // de Escena 4, y la base contemplativa de Escena 5.
    if (lotHandle.current) lotHandle.current.setPovMix(1);

    // ── Palabra 1: "información" (t=3 a 7)
    if (skyText1Handle.current) {
      const appear = easeOutCubic(clamp((t - 3) / 4, 0, 1));
      const fadeOut = easeOutCubic(clamp((t - 25) / 3.5, 0, 1));
      const opacity = appear * (1 - fadeOut);
      skyText1Handle.current.setOpacity(opacity);
      // Slight settle scale
      const scale = 0.85 + 0.15 * appear;
      skyText1Handle.current.setScale(scale);
    }

    // ── Palabra 2: "asimétrica" (t=7 a 11) — aparece después
    if (skyText2Handle.current) {
      const appear = easeOutCubic(clamp((t - 7) / 4, 0, 1));
      const fadeOut = easeOutCubic(clamp((t - 25) / 3.5, 0, 1));
      const opacity = appear * (1 - fadeOut);
      skyText2Handle.current.setOpacity(opacity);
      const scale = 0.85 + 0.15 * appear;
      skyText2Handle.current.setScale(scale);
    }

    // Coolness: arranca alto, sube más al final
    if (t < 18) coolnessRef.current = 1.0;
    else coolnessRef.current = 1.0; // ya en cool total, mantenemos
  });

  return (
    <>
      <NightSky skyRef={skyRef} />
      <SkyUpdater skyRef={skyRef} coolnessRef={coolnessRef} />
      <CinematicLighting coolnessRef={coolnessRef} />
      <CameraDirector timeRef={timeRef} sceneLoopRef={sceneLoopRef} />

      <Floor />
      <DistantWindows />

      <CarLot100 ref={lotHandle} cherryRatio={0.60} seed={7} />

      {/* Sky text — dos palabras apiladas */}
      <SkyText
        ref={skyText1Handle}
        text="información"
        position={[0, 9, -8]}
        width={11}
        height={2.2}
        color="#FFE5A0"
        fontWeight={500}
      />
      <SkyText
        ref={skyText2Handle}
        text="asimétrica"
        position={[0, 6.5, -8]}
        width={11}
        height={2.2}
        color="#FFE5A0"
        fontWeight={500}
      />

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
        Akerlof · Cap 1 · Escena 5
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
      const elapsed = ((performance.now() - start) / 1000) % 32;
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
interface LimonesEscena05Props {
  forceAspect?: '9:16' | '16:9' | 'auto';
}

export default function LimonesEscena05({ forceAspect = 'auto' }: LimonesEscena05Props) {
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
      }, 3000);
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
      style={{ background: 'radial-gradient(ellipse at 50% 35%, #0a0d1a 0%, #050308 80%)' }}
    >
      <audio ref={audioRef} src={AUDIO_URL} preload="auto" />

      <Canvas
        camera={{ position: [10, 13, 26], fov, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.18,
          alpha: false,
        }}
        dpr={[1, 2]}
      >
        <SceneContent audioRef={audioRef} isPlaying={isPlaying} />
        <PostFX
          intensity={1.6}
          threshold={0.20}
          smoothing={0.45}
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
              Cap 1 · Escena 5 · {audioMeta ? audioMeta.duration.toFixed(0) + 's' : '~28s'}
            </div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">
              cierre del Capítulo 1
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
