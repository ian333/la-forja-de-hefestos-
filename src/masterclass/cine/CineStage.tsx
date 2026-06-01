/**
 * CineStage — el SHELL inmersivo estándar de toda masterclass GAIA.
 *
 * Estandariza, basado en Gargantua + Limones:
 *   • Canvas 3D con ACES filmic tonemapping + dpr alto.
 *   • HDRI environment por mood (MasterclassEnv) — un solo HDRI cambia todo.
 *   • PostFX (bloom + vignette + aberración) con shield anti-crash + deferred
 *     mount (NUNCA tira la escena; cae a "sin bloom" si falla).
 *   • Reloj de escena sincronizado al audio (o al clock si no hay audio),
 *     publicado por contexto para los primitivos (CineCamera/CineText/CineModel).
 *   • HUD de cine: gradientes arriba/abajo, etiqueta de capítulo, marca GAIA.
 *   • Botón ▶ si hay audio (gesto de usuario para desbloquear autoplay).
 *
 * Autorar una escena = poner contenido 3D como children + un <CineCamera> y
 * varios <CineText>. El shell hace el resto, igual para todas.
 *
 * REGLA: nada de drei <Text> aquí dentro (rompe el EffectComposer). Texto = SkyText.
 */

import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import MasterclassEnv from '@/masterclass/assets/hdri/MasterclassEnv';
import PostFX, { type PostFXProps } from '@/masterclass/scenes/_postFX';
import type { HdriMood } from '@/masterclass/assets/hdri/manifest';
import { CineTimeContext, useCineLayout } from './useCineTime';

export interface CineStageProps {
  /** Mood del HDRI: studio | urban_night | starry_night. */
  mood?: HdriMood;
  /** Intensidad del ambient/reflection del HDRI. */
  envIntensity?: number;
  /** Overrides del postproceso. */
  postfx?: Partial<PostFXProps>;
  /** Duración en segundos (loop si no hay audio). */
  duration?: number;
  /** Audio narrado opcional (/audio/...). Si falta, corre por clock. */
  audio?: string;
  /** Etiqueta de capítulo (HUD arriba-izquierda). */
  chapter?: string;
  /** FOV de la cámara. */
  fov?: number;
  /** Posición inicial de cámara (CineCamera la sobreescribe si existe). */
  cameraPos?: [number, number, number];
  /** Fondo CSS del contenedor. */
  background?: string;
  /** Relación de aspecto del contenedor (CSS). Default 16/9. */
  aspect?: string;
  /** Subtítulos sincronizados al audio — HUD, SIEMPRE visibles (no se salen de cuadro). */
  subtitles?: { text: string; at: number; until: number }[];
  children?: ReactNode;
}

// Subtítulos HUD: leen el tiempo del audio (fuente de verdad) → sincronía exacta.
// Siempre abajo-centro, legibles, pase lo que pase con la cámara.
function Subtitles({ subs, audioRef, duration }: {
  subs: { text: string; at: number; until: number }[];
  audioRef: React.RefObject<HTMLAudioElement | null>;
  duration: number;
}) {
  const [text, setText] = useState<string | null>(null);
  const lastRef = useRef<string | null>(null);
  useEffect(() => {
    let raf = 0;
    let clock = 0;
    let last = performance.now();
    const tick = () => {
      const a = audioRef.current;
      let t: number;
      if (a) t = a.currentTime;
      else { const now = performance.now(); clock = (clock + (now - last) / 1000) % (duration > 0 ? duration : 1e9); last = now; t = clock; }
      const hit = subs.find(s => t >= s.at && t < s.until);
      const next = hit ? hit.text : null;
      if (next !== lastRef.current) { lastRef.current = next; setText(next); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [subs, audioRef, duration]);

  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-[7%] w-[88%] max-w-[1180px] text-center pointer-events-none">
      {text && (
        <span className="inline-block font-bold text-white leading-tight"
              style={{ fontSize: 'clamp(17px, 2.5vw, 36px)', textShadow: '0 2px 16px rgba(0,0,0,0.95), 0 0 40px rgba(0,0,0,0.7)' }}>
          {text}
        </span>
      )}
    </div>
  );
}

function SceneClock({ audioRef, timeRef, playing, duration }: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  timeRef: React.MutableRefObject<number>;
  playing: boolean;
  duration: number;
}) {
  useFrame((_, dt) => {
    void playing;
    const a = audioRef.current;
    if (a) {
      // Con audio: el reloj ES el audio (queda en 0 hasta que el usuario da play).
      timeRef.current = a.currentTime;
    } else {
      // Sin audio: corre por clock, en loop.
      timeRef.current = (timeRef.current + Math.min(dt, 0.1)) % (duration > 0 ? duration : 1e9);
    }
  });
  return null;
}

export default function CineStage({
  mood = 'studio',
  envIntensity = 0.7,
  postfx,
  duration = 40,
  audio,
  chapter,
  fov = 46,
  cameraPos = [0, 4, 16],
  background = 'radial-gradient(ellipse at 50% 38%, #0a0d1a 0%, #02010A 80%)',
  aspect = '16 / 9',
  subtitles,
  children,
}: CineStageProps) {
  const layout = useCineLayout();
  const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
  const fovUsed = portrait ? Math.min(fov * 1.28, 76) : fov;

  const timeRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(!audio);   // sin audio → corre solo
  const [started, setStarted] = useState(!audio);

  // Loop del audio (si lo hay): al terminar, reinicia tras una pausa.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnded = () => {
      setPlaying(false);
      setTimeout(() => { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().then(() => setPlaying(true)).catch(() => {}); } }, 2500);
    };
    a.addEventListener('ended', onEnded);
    return () => a.removeEventListener('ended', onEnded);
  }, []);

  const start = () => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().then(() => { setPlaying(true); setStarted(true); }).catch(() => setStarted(true));
  };

  return (
    <div
      className={layout.fill
        ? 'fixed inset-0 w-screen h-screen overflow-hidden z-0'
        : 'relative w-full overflow-hidden rounded-xl border border-[#1E293B]'}
      style={layout.fill ? { background } : { background, aspectRatio: aspect }}
    >
      {audio && <audio ref={audioRef} src={audio} preload="auto" />}

      <Canvas
        camera={{ position: cameraPos, fov: fovUsed, near: 0.1, far: 400 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95, alpha: false }}
        dpr={[1, 2]}
      >
        <CineTimeContext.Provider value={timeRef}>
          <SceneClock audioRef={audioRef} timeRef={timeRef} playing={playing} duration={duration} />
          <Suspense fallback={null}>
            <MasterclassEnv preset={mood} intensity={envIntensity} />
            {children}
          </Suspense>
          <PostFX intensity={1.3} threshold={0.32} smoothing={0.5} vignette={0.72} vignetteOffset={0.22} aberration={0.0004} {...postfx} />
        </CineTimeContext.Provider>
      </Canvas>

      {/* HUD de cine */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-[10%] bg-gradient-to-b from-black/45 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-[16%] bg-gradient-to-t from-black/65 to-transparent" />
        {chapter && (
          <div className="absolute top-4 left-5 text-[10px] uppercase tracking-[0.3em] font-mono text-[#FFE5A0]/60">
            {chapter}
          </div>
        )}
        <div className="absolute top-4 right-5 text-[10px] uppercase tracking-[0.3em] font-mono text-[#94A3B8]/50">
          GAIA · masterclass
        </div>
        {subtitles && subtitles.length > 0 && (
          <Subtitles subs={subtitles} audioRef={audioRef} duration={duration} />
        )}
      </div>

      {/* Botón de inicio (solo con audio) */}
      {audio && !started && (
        <button onClick={start} data-cine-play
                className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer group">
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full border-2 border-[#FFE5A0] flex items-center justify-center group-hover:scale-110 transition-transform"
                 style={{ boxShadow: '0 0 30px rgba(255,229,160,0.55)' }}>
              <div className="text-[#FFE5A0] text-3xl ml-1.5">▶</div>
            </div>
            {chapter && <div className="text-[11px] uppercase tracking-[0.3em] text-[#FFE5A0]/70 font-mono">{chapter}</div>}
          </div>
        </button>
      )}
    </div>
  );
}
