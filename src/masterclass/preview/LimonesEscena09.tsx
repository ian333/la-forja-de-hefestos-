/**
 * LimonesEscena09 — "El colapso"
 *
 * Cap 2 · Escena 9. Template: collapse · Story beat: payoff.
 *
 * El mercado queda matemáticamente roto. El precio toca fondo ($30k).
 * Solo queda 1 limón en un lote vacío. Lo que se perdió: cherries (todos),
 * precio justo, confianza.
 *
 * Visualmente: comparación final.
 *   - Izquierda: lo que HABÍA (cherries + lemons, lote lleno) — fantasma
 *   - Derecha: lo que QUEDA (1 limón triste, vacío)
 *   - Centro abajo: "EL MERCADO SE ROMPIÓ MATEMÁTICAMENTE"
 *
 * Duración: ~37s.
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

const TRACK_FILE = '09-colapso.mp3';
const META_URL = '/audio/preview/meta.json';
const AUDIO_URL = '/audio/preview/' + TRACK_FILE;
const FALLBACK_DURATION = 36.91;

AtomModel.preload(LIBRARY.lemon.src);
AtomModel.preload(LIBRARY.cherry.src);

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function pseudoRandom(seed: number, index: number): number {
  const x = Math.sin((seed * 12.9898) + (index * 78.233)) * 43758.5453;
  return x - Math.floor(x);
}

// ─────────────────────────────────────────────────────────────
// Ghost frutas — recuerdo de lo que había. Cherries + lemons mezclados,
// flotando débilmente, casi transparentes (lo que YA NO ESTÁ).

interface GhostDatum {
  pos: [number, number, number];
  isCherry: boolean;
  scale: number;
}

function buildGhosts(count: number): GhostDatum[] {
  const arr: GhostDatum[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = -6 - col * 1.2;
    const z = (row - 1.5) * 1.4;
    const y = Math.abs(pseudoRandom(13, i) - 0.5) * 0.4;
    const isCherry = pseudoRandom(7, i) < 0.55;
    const scale = 0.55 + pseudoRandom(23, i) * 0.15;
    arr.push({ pos: [x, y, z], isCherry, scale });
  }
  return arr;
}

function GhostItem({ datum, timeRef, fadeStartT, fadeEndT }: {
  datum: GhostDatum;
  timeRef: React.MutableRefObject<number>;
  fadeStartT: number;
  fadeEndT: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    const t = timeRef.current;
    const appear = easeOutCubic(clamp((t - fadeStartT) / (fadeEndT - fadeStartT), 0, 1));
    const float = Math.sin(t * 0.4 + datum.pos[0] * 0.5) * 0.1;
    groupRef.current.position.set(datum.pos[0], datum.pos[1] + float, datum.pos[2]);
    groupRef.current.scale.setScalar(appear * datum.scale);
    groupRef.current.rotation.y = t * 0.10;
    groupRef.current.visible = appear > 0.01;
  });
  return (
    <group ref={groupRef}>
      <AtomModel
        src={datum.isCherry ? LIBRARY.cherry.src : LIBRARY.lemon.src}
        color={datum.isCherry ? '#5A6E60' : '#6B6258'} // GRIS amortiguado — ghosts
        glow={0.35}
        mode="atom"
        scale={1.0}
        fitTo={1.2}
        halo={false}
      />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// El limón sobreviviente — único, triste, en el centro-derecha

function SurvivorLemon({ timeRef }: { timeRef: React.MutableRefObject<number> }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    const t = timeRef.current;
    const appear = easeOutCubic(clamp((t - 2) / 3, 0, 1));
    const breathe = 1 + 0.04 * Math.sin(t * 1.2);
    const float = Math.sin(t * 0.7) * 0.12;
    groupRef.current.position.set(4.5, 0.3 + float, 0);
    groupRef.current.scale.setScalar(appear * 1.0 * breathe);
    groupRef.current.rotation.y = t * 0.22;
  });
  return (
    <group ref={groupRef}>
      <AtomModel
        src={LIBRARY.lemon.src}
        color="#8B7A4A"  // limón oscuro, deslavado — el peor
        glow={0.65}
        mode="atom"
        scale={1.3}
        fitTo={2.0}
        halo={false}
      />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Camera: empuja lentamente para revelar el contraste

function CameraDirector({ timeRef, sceneLoopRef }: {
  timeRef: React.MutableRefObject<number>;
  sceneLoopRef: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current % sceneLoopRef.current;
    // Empuja muy lento desde más lejos. Casi estático — luto.
    const dolly = easeInOutCubic(clamp(t / 32, 0, 1));
    const dist = 16 - 2.5 * dolly;
    const height = 4.5 + 0.4 * Math.sin(t * 0.08);
    const orbit = 0.05 * Math.sin(t * 0.10); // micro orbit, casi nada
    camera.position.set(Math.sin(orbit) * dist, height, Math.cos(orbit) * dist);
    camera.lookAt(0, 0.5, 0);
  });
  return null;
}

// ─────────────────────────────────────────────────────────────
// Scene content

function SceneContent({ audioRef, isPlaying }: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  const labelGhostsRef = useRef<SkyTextHandle | null>(null);
  const labelSurvivorRef = useRef<SkyTextHandle | null>(null);
  const priceBigRef = useRef<SkyTextHandle | null>(null);
  const priceWasRef = useRef<SkyTextHandle | null>(null);
  const verdict1Ref = useRef<SkyTextHandle | null>(null);
  const verdict2Ref = useRef<SkyTextHandle | null>(null);

  const sceneLoopRef = useRef(40);

  const initialTime = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const params = new URLSearchParams(window.location.search);
    const t = parseFloat(params.get('t') || '0');
    return isNaN(t) ? 0 : t;
  }, []);
  const timeRef = useRef(initialTime);

  const ghosts = useMemo(() => buildGhosts(12), []);

  useFrame((_, dt) => {
    if (isPlaying && audioRef.current && !audioRef.current.paused) {
      timeRef.current = audioRef.current.currentTime;
    } else {
      timeRef.current += Math.min(dt, 0.1);
    }
    const t = timeRef.current % sceneLoopRef.current;
    if (typeof window !== 'undefined') (window as any).__sceneTime = timeRef.current;

    // Label "LO QUE HABÍA" arriba de ghosts — t=6
    if (labelGhostsRef.current) {
      const appear = easeOutCubic(clamp((t - 6) / 3, 0, 1));
      labelGhostsRef.current.setOpacity(appear * 0.55);
    }
    // Label "LO QUE QUEDA" sobre survivor — t=2
    if (labelSurvivorRef.current) {
      const appear = easeOutCubic(clamp((t - 2) / 2.5, 0, 1));
      labelSurvivorRef.current.setOpacity(appear * 0.8);
    }
    // Precio $30k gigante — aparece t=10
    if (priceBigRef.current) {
      const appear = easeOutCubic(clamp((t - 10) / 3, 0, 1));
      priceBigRef.current.setOpacity(appear);
      const pulse = 1 + 0.06 * Math.sin(t * 1.3);
      priceBigRef.current.setScale((0.85 + 0.15 * appear) * pulse);
    }
    // "valía $200k" tachado — t=14
    if (priceWasRef.current) {
      const appear = easeOutCubic(clamp((t - 14) / 3, 0, 1));
      priceWasRef.current.setOpacity(appear * 0.6);
    }
    // Verdict 1: "el mercado se rompió matemáticamente" — t=24
    if (verdict1Ref.current) {
      const appear = easeOutCubic(clamp((t - 24) / 4, 0, 1));
      verdict1Ref.current.setOpacity(appear);
      verdict1Ref.current.setScale(0.85 + 0.15 * appear);
    }
    // Verdict 2: "sin que nadie hiciera trampa" — t=30
    if (verdict2Ref.current) {
      const appear = easeOutCubic(clamp((t - 30) / 4, 0, 1));
      verdict2Ref.current.setOpacity(appear);
      verdict2Ref.current.setScale(0.85 + 0.15 * appear);
    }
  });

  return (
    <>
      <Suspense fallback={null}>
        <MasterclassEnv preset="urban_night" background={false} intensity={0.30} />
      </Suspense>
      <ambientLight intensity={0.18} color="#1A1825" />
      <directionalLight position={[3, 8, 2]} intensity={0.45} color="#D4B89E" />
      <directionalLight position={[-4, 5, -3]} intensity={0.25} color="#7B6BA0" />

      <CameraDirector timeRef={timeRef} sceneLoopRef={sceneLoopRef} />

      {/* Floor metálico */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial
          color="#08050E"
          roughness={0.35}
          metalness={0.55}
          emissive="#0A0510"
          emissiveIntensity={0.10}
        />
      </mesh>

      {/* Línea divisoria visual */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.18, 0]}>
        <planeGeometry args={[0.06, 8]} />
        <meshBasicMaterial color="#FFE5A0" transparent opacity={0.15} toneMapped={false} />
      </mesh>

      {/* GHOST frutas (lo que había) — izquierda */}
      <Suspense fallback={null}>
        {ghosts.map((g, i) => (
          <GhostItem
            key={i}
            datum={g}
            timeRef={timeRef}
            fadeStartT={6 + i * 0.15}
            fadeEndT={10 + i * 0.15}
          />
        ))}

        {/* SURVIVOR (lo que queda) — derecha */}
        <SurvivorLemon timeRef={timeRef} />
      </Suspense>

      {/* Label LO QUE HABÍA — izquierda */}
      <SkyText
        ref={labelGhostsRef}
        text="lo que había"
        position={[-7.5, 3.8, 0]}
        width={3.5}
        height={0.45}
        color="#A89580"
        fontWeight={400}
      />

      {/* Label LO QUE QUEDA — derecha */}
      <SkyText
        ref={labelSurvivorRef}
        text="lo que queda"
        position={[4.5, 3.8, 0]}
        width={3.5}
        height={0.45}
        color="#FF5040"
        fontWeight={500}
      />

      {/* Precio $30k gigante — centro */}
      <SkyText
        ref={priceBigRef}
        text="$30,000"
        position={[0, 5.5, -6]}
        width={6.0}
        height={1.4}
        color="#FF5040"
        fontWeight={700}
      />

      {/* Valía $200k — pequeño tachado */}
      <SkyText
        ref={priceWasRef}
        text="valía $200,000"
        position={[0, 4.0, -6]}
        width={4.0}
        height={0.40}
        color="#A89580"
        fontWeight={400}
      />

      {/* VERDICT 1 — centro abajo */}
      <SkyText
        ref={verdict1Ref}
        text="el mercado se rompió matemáticamente"
        position={[0, -3.0, -2]}
        width={10}
        height={0.55}
        color="#FFE5A0"
        fontWeight={600}
      />

      {/* VERDICT 2 — debajo */}
      <SkyText
        ref={verdict2Ref}
        text="sin que nadie hiciera trampa"
        position={[0, -3.9, -2]}
        width={7.5}
        height={0.50}
        color="#FFE5A0"
        fontWeight={500}
      />

      <fog attach="fog" args={['#08050E', 14, 60]} />
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
        Akerlof · Cap 2 · Escena 9
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
      const elapsed = ((performance.now() - start) / 1000) % 40;
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
interface LimonesEscena09Props {
  forceAspect?: '9:16' | '16:9' | 'auto';
}

export default function LimonesEscena09({ forceAspect = 'auto' }: LimonesEscena09Props) {
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
      style={{ background: 'radial-gradient(ellipse at 50% 35%, #0a0815 0%, #02010A 80%)' }}
    >
      <audio ref={audioRef} src={AUDIO_URL} preload="auto" />

      <Canvas
        camera={{ position: [0, 4.5, 16], fov, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.90,
          alpha: false,
        }}
        dpr={[1, 2]}
      >
        <SceneContent audioRef={audioRef} isPlaying={isPlaying} />
        <PostFX
          intensity={0.95}
          threshold={0.40}
          smoothing={0.55}
          vignette={0.78}
          vignetteOffset={0.20}
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
              Cap 2 · Escena 9 · {audioMeta ? audioMeta.duration.toFixed(0) + 's' : '~37s'}
            </div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">
              el colapso
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
