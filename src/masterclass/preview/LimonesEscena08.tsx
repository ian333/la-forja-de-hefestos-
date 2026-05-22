/**
 * LimonesEscena08 — "El nuevo promedio cae"
 *
 * Cap 2 · Escena 8. Template: cascade · Story beat: turn.
 *
 * El comprador recalcula. Solo quedan limones. Ofrece $80k. Pero entre
 * limones también hay jerarquía: el "menos malo" (valía $100k) no acepta,
 * se va. El precio cae más. $70k → $60k → $50k. Espiral descendente.
 *
 * Primera escena que usa la NUEVA asset library (AtomModel + LIBRARY).
 * 5 limones GLB (Kenney CC0) en formación, HDRI urban_night moonless_golf.
 *
 * Paradigma:
 *   • 1 objeto principal: los 5 limones flotantes con sus precios
 *   • 1 SkyText: precio promedio cayendo
 *   • Cámara orbita lento
 *   • Bloom alto sobre los edges del atom-style
 *
 * Duración: ~33s.
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

const TRACK_FILE = '08-nuevo-promedio.mp3';
const META_URL = '/audio/preview/meta.json';
const AUDIO_URL = '/audio/preview/' + TRACK_FILE;
const FALLBACK_DURATION = 33.15;

// Preload los modelos al montar el módulo
AtomModel.preload(LIBRARY.lemon.src);

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ─────────────────────────────────────────────────────────────
// 5 limones con jerarquía de valor — el más valioso se va primero,
// luego el siguiente, hasta quedar los 2 peores.

interface LemonDatum {
  pos: [number, number, number];
  /** Valor de mercado en miles (k). 100 = $100,000 */
  value: number;
  /** Cuándo empieza a "irse" (sube + fade) — en segundos. -1 = nunca */
  tLeave: number;
  /** Color tint para diferenciación (cuanto mayor valor, más cálido el limón) */
  color: string;
  rotY: number;
}

const LEMONS: LemonDatum[] = [
  // Limón más valioso ($100k) — se va primero (t=11)
  { pos: [-4.0, 0, 0],   value: 100, tLeave: 11, color: '#FFD86B', rotY: 0.3 },
  // Otro $100k — se va segundo (t=15)
  { pos: [4.0, 0, 0],    value: 100, tLeave: 15, color: '#FFD86B', rotY: -0.4 },
  // $90k — se va tercero (t=19)
  { pos: [-2.0, 0, -1.5], value: 90,  tLeave: 19, color: '#FBBF24', rotY: 0.5 },
  // $90k — se va cuarto (t=22)
  { pos: [2.0, 0, -1.5],  value: 90,  tLeave: 22, color: '#FBBF24', rotY: -0.3 },
  // El peor ($50k) — se queda hasta el final
  { pos: [0, 0, 0.8],     value: 50,  tLeave: -1, color: '#8B7355', rotY: 0.1 },
];

// ─────────────────────────────────────────────────────────────
// AtomLemon — wrapper que anima entrada/salida individual

function AtomLemon({ datum, timeRef }: {
  datum: LemonDatum;
  timeRef: React.MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const matsRef = useRef<THREE.Material[]>([]);
  useFrame(() => {
    if (!groupRef.current) return;
    const t = timeRef.current;
    const g = groupRef.current;

    // Entrada: aparición suave 0-2s
    const appear = easeOutCubic(clamp(t / 2.0, 0, 1));

    // Salida (si tiene tLeave): rise + fade
    let leave = 0;
    if (datum.tLeave > 0) {
      leave = easeOutCubic(clamp((t - datum.tLeave) / 3.5, 0, 1));
    }

    const yFloat = Math.sin(t * 0.6 + datum.pos[0]) * 0.12;
    g.position.set(
      datum.pos[0],
      datum.pos[1] + yFloat + leave * 8,  // sube al irse
      datum.pos[2],
    );

    const scl = appear * (1 - leave) * 1.0;
    g.scale.setScalar(scl);
    g.rotation.set(0, datum.rotY + t * 0.18 + leave * 1.2, 0);
    g.visible = scl > 0.02;
  });

  void matsRef; // (placeholder por si después controlamos opacidad por material)

  return (
    <group ref={groupRef}>
      <AtomModel
        src={LIBRARY.lemon.src}
        color={datum.color}
        glow={0.85}
        mode="atom"
        scale={1.0}
        fitTo={1.6}
        halo={false}
      />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Etiqueta de precio flotante sobre cada limón

function PriceLabel({ datum, timeRef }: {
  datum: LemonDatum;
  timeRef: React.MutableRefObject<number>;
}) {
  const textRef = useRef<SkyTextHandle | null>(null);
  useFrame(() => {
    if (!textRef.current) return;
    const t = timeRef.current;
    const appear = easeOutCubic(clamp((t - 0.5) / 2.0, 0, 1));
    let leave = 0;
    if (datum.tLeave > 0) {
      leave = easeOutCubic(clamp((t - datum.tLeave) / 3.5, 0, 1));
    }
    const op = appear * (1 - leave) * 0.92;
    textRef.current.setOpacity(op);
  });
  return (
    <SkyText
      ref={textRef}
      text={'$' + datum.value + 'k'}
      position={[datum.pos[0], datum.pos[1] + 2.2, datum.pos[2]]}
      width={1.6}
      height={0.5}
      color={datum.color}
      fontWeight={600}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Camera: orbit lento, mira el centro

function CameraDirector({ timeRef, sceneLoopRef }: {
  timeRef: React.MutableRefObject<number>;
  sceneLoopRef: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current % sceneLoopRef.current;
    const orbit = 0.30 + t * 0.020 + 0.06 * Math.sin(t * 0.16);
    const dist = 10.5 - 1.5 * easeInOutCubic(clamp((t - 22) / 10, 0, 1));
    const height = 3.5 + 0.6 * Math.sin(t * 0.10);
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
  const headerRef = useRef<SkyTextHandle | null>(null);
  const priceLabelRef = useRef<SkyTextHandle | null>(null);
  const priceBigRef = useRef<SkyTextHandle | null>(null);
  const subPriceRef = useRef<SkyTextHandle | null>(null);
  const closingRef = useRef<SkyTextHandle | null>(null);

  const sceneLoopRef = useRef(36);

  const initialTime = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const params = new URLSearchParams(window.location.search);
    const t = parseFloat(params.get('t') || '0');
    return isNaN(t) ? 0 : t;
  }, []);
  const timeRef = useRef(initialTime);

  // El precio promedio "actual" mostrado en grande — cambia conforme limones se van
  const [bigPriceText, setBigPriceText] = useState('$140k');
  const lastPriceRef = useRef('$140k');

  useFrame((_, dt) => {
    if (isPlaying && audioRef.current && !audioRef.current.paused) {
      timeRef.current = audioRef.current.currentTime;
    } else {
      timeRef.current += Math.min(dt, 0.1);
    }
    const t = timeRef.current % sceneLoopRef.current;
    if (typeof window !== 'undefined') (window as any).__sceneTime = timeRef.current;

    // Header "EL PROMEDIO RECALCULA" — aparece 0-3s
    if (headerRef.current) {
      const appear = easeOutCubic(clamp((t - 0.3) / 2.5, 0, 1));
      headerRef.current.setOpacity(appear);
      headerRef.current.setScale(0.85 + 0.15 * appear);
    }

    // Pequeño label "PRECIO PROMEDIO" arriba del número grande
    if (priceLabelRef.current) {
      const appear = easeOutCubic(clamp((t - 3.5) / 2.0, 0, 1));
      priceLabelRef.current.setOpacity(appear * 0.6);
    }

    // Precio grande dinámico — cambia con el tiempo
    let newPrice = '$140k';
    if (t > 28)      newPrice = '$50k';
    else if (t > 23) newPrice = '$60k';
    else if (t > 19) newPrice = '$70k';
    else if (t > 12) newPrice = '$80k';
    else if (t > 6)  newPrice = '$90k';
    if (newPrice !== lastPriceRef.current) {
      lastPriceRef.current = newPrice;
      setBigPriceText(newPrice);
    }
    if (priceBigRef.current) {
      const appear = easeOutCubic(clamp((t - 4) / 2.5, 0, 1));
      priceBigRef.current.setOpacity(appear);
      // Pulse cada vez que cambia
      const pulse = 1.0 + 0.10 * Math.max(0, Math.sin(t * 1.5 + 0.5));
      priceBigRef.current.setScale((0.85 + 0.15 * appear) * pulse);
    }

    // Sub-info "y bajando..." aparece después de la primera caída
    if (subPriceRef.current) {
      const appear = easeOutCubic(clamp((t - 16) / 3, 0, 1));
      subPriceRef.current.setOpacity(appear * 0.55);
    }

    // Closing "el mercado se rompe" — aparece al final
    if (closingRef.current) {
      const appear = easeOutCubic(clamp((t - 28) / 4, 0, 1));
      closingRef.current.setOpacity(appear);
      closingRef.current.setScale(0.85 + 0.15 * appear);
    }
  });

  return (
    <>
      {/* HDRI urban_night — moonless_golf, perfecto para Akerlof noir */}
      <Suspense fallback={null}>
        <MasterclassEnv preset="urban_night" background={false} intensity={0.35} />
      </Suspense>
      <ambientLight intensity={0.18} color="#1A1825" />
      <directionalLight position={[3, 8, 2]} intensity={0.50} color="#D4B89E" />
      <directionalLight position={[-4, 5, -3]} intensity={0.30} color="#7B6BA0" />

      <CameraDirector timeRef={timeRef} sceneLoopRef={sceneLoopRef} />

      {/* Floor sutil con reflejo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial
          color="#0A0510"
          roughness={0.35}
          metalness={0.55}
          emissive="#0C0510"
          emissiveIntensity={0.10}
        />
      </mesh>

      {/* Underglow amarillo (el lote de limones tiene calor residual) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.18, 0]}>
        <planeGeometry args={[14, 14]} />
        <meshBasicMaterial color="#FBBF24" transparent opacity={0.04} toneMapped={false} depthWrite={false} />
      </mesh>

      {/* Los 5 limones AtomModel — corazón de la escena */}
      <Suspense fallback={null}>
        {LEMONS.map((d, i) => (
          <AtomLemon key={i} datum={d} timeRef={timeRef} />
        ))}
        {LEMONS.map((d, i) => (
          <PriceLabel key={'p' + i} datum={d} timeRef={timeRef} />
        ))}
      </Suspense>

      {/* HEADER — "EL PROMEDIO RECALCULA" */}
      <SkyText
        ref={headerRef}
        text="EL PROMEDIO RECALCULA"
        position={[0, 6.5, -6]}
        width={9}
        height={1.0}
        color="#FFE5A0"
        fontWeight={600}
      />

      {/* Label "PRECIO PROMEDIO" pequeño */}
      <SkyText
        ref={priceLabelRef}
        text="precio promedio"
        position={[0, 5.2, -6]}
        width={3.5}
        height={0.36}
        color="#A89580"
        fontWeight={400}
      />

      {/* PRECIO GIGANTE dinámico — cambia $140k → $50k */}
      <SkyText
        key={bigPriceText} /* re-rendea para nuevo texto */
        ref={priceBigRef}
        text={bigPriceText}
        position={[0, 4.0, -6]}
        width={4.5}
        height={1.6}
        color="#FF5040"
        fontWeight={700}
      />

      {/* Sub-info "y bajando..." */}
      <SkyText
        ref={subPriceRef}
        text="↓ y sigue bajando"
        position={[0, 2.8, -6]}
        width={4.2}
        height={0.4}
        color="#FF5040"
        fontWeight={500}
      />

      {/* CLOSING — final */}
      <SkyText
        ref={closingRef}
        text="el mercado colapsa"
        position={[0, -3.2, 0]}
        width={6.5}
        height={0.55}
        color="#FF5040"
        fontWeight={600}
      />

      <fog attach="fog" args={['#0A0612', 14, 50]} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// HUD overlay

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
        Akerlof · Cap 2 · Escena 8
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
interface LimonesEscena08Props {
  forceAspect?: '9:16' | '16:9' | 'auto';
}

export default function LimonesEscena08({ forceAspect = 'auto' }: LimonesEscena08Props) {
  const aspect: '9:16' | '16:9' =
    forceAspect === 'auto'
      ? typeof window !== 'undefined' && window.innerHeight > window.innerWidth
        ? '9:16'
        : '16:9'
      : forceAspect;
  const fov = aspect === '9:16' ? 58 : 48;

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
        camera={{ position: [4, 4, 9], fov, near: 0.1, far: 200 }}
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
              Cap 2 · Escena 8 · {audioMeta ? audioMeta.duration.toFixed(0) + 's' : '~33s'}
            </div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">
              el nuevo promedio cae
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
