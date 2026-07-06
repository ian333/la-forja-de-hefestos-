/**
 * dynamics.tsx — palancas de DINÁMICA reutilizables para las masterclass cine.
 * Todo PURO en t (determinista → cacheable en el render headless por __cineT).
 *
 *   · pop()/popAt()  — entrada con REBOTE (overshoot), no un fade plano
 *   · pulse()        — pulso rítmico determinista
 *   · voiceLevel()   — nivel de la VOZ (0..1) en este instante (envelope precomputado)
 *   · <VoiceDriver/> — carga el envelope y publica window.__voiceLevel cada frame
 *   · <ParticleStream/> — corriente de partículas que fluye de A→B en loop (energía/dinero/ideas)
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCineTime } from './useCineTime';
import SkyText, { type SkyTextHandle } from '@/masterclass/preview/SkyText';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

// ── Entrada con REBOTE (backOut): sube por encima de 1 y se asienta ─────────
export function pop(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const c1 = 1.70158, c3 = c1 + 1, p = x - 1;
  return 1 + c3 * p * p * p + c1 * p * p;
}
export function popAt(t: number, start: number, dur = 0.9): number {
  return pop(clamp((t - start) / dur, 0, 1));
}

// ── Pulso rítmico determinista ──────────────────────────────────────────────
export function pulse(t: number, freq = 1.5, amp = 1): number {
  return amp * (0.5 + 0.5 * Math.sin(t * freq * Math.PI * 2));
}

// ── Nivel de la VOZ (0..1) publicado por VoiceDriver ────────────────────────
export function voiceLevel(): number {
  const v = (window as unknown as { __voiceLevel?: number }).__voiceLevel;
  return typeof v === 'number' ? v : 0;
}

/**
 * VoiceDriver — carga el envelope.json de la narración y, cada frame, publica
 * window.__voiceLevel = env[t] (indexado por el reloj de cine, __cineT o audio).
 * Las escenas leen voiceLevel() para pulsar con la VOZ real. Sin envelope → 0.
 */
export function VoiceDriver({ src, audioRef }: { src: string; audioRef?: React.RefObject<HTMLAudioElement | null> }) {
  const timeRef = useCineTime();
  const data = useRef<{ fps: number; env: number[] } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(src).then(r => r.ok ? r.json() : null).then(j => { if (alive && j) data.current = j; }).catch(() => {});
    return () => { alive = true; (window as unknown as { __voiceLevel?: number }).__voiceLevel = 0; };
  }, [src]);
  useFrame(() => {
    const d = data.current;
    if (!d) return;
    const ov = (window as unknown as { __cineT?: number }).__cineT;
    let t: number;
    if (typeof ov === 'number') t = ov;
    else if (audioRef?.current) t = audioRef.current.currentTime;
    else t = timeRef.current;
    const i = Math.floor(t * d.fps);
    (window as unknown as { __voiceLevel?: number }).__voiceLevel = d.env[clamp(i, 0, d.env.length - 1)] || 0;
  });
  return null;
}

// ── PALABRAS-ANCLA: timestamps de voz (words.json) → texto 3D sincronizado ──
type Word = { w: string; t: number; end: number };

/** WordsDriver — carga words.json y lo publica en window.__cineWords. */
export function WordsDriver({ src }: { src: string }) {
  useEffect(() => {
    let alive = true;
    fetch(src).then(r => r.ok ? r.json() : null).then(j => {
      if (alive && j && Array.isArray(j.words)) (window as unknown as { __cineWords?: Word[] }).__cineWords = j.words;
    }).catch(() => {});
    return () => { alive = false; };
  }, [src]);
  return null;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, '').trim();

/** Busca el tiempo de inicio de `match` (su 1ª palabra) en window.__cineWords, tras `after`. */
function findWordTime(match: string, after = 0): number | null {
  const ws = (window as unknown as { __cineWords?: Word[] }).__cineWords;
  if (!ws || !ws.length) return null;
  const target = norm(match).split(' ')[0];
  if (!target) return null;
  for (const w of ws) { if (w.t >= after && norm(w.w) === target) return w.t; }
  for (const w of ws) { if (w.t >= after && norm(w.w).includes(target)) return w.t; }
  return null;
}

/**
 * AnchorWord — PALABRA-ANCLA que aparece EXACTO cuando se dice (forced alignment),
 * flotando en 3D (SkyText Outfit + glow), con pop de entrada y fade. Fija la idea.
 *
 *   <AnchorWord text="NEGOCIAR" after={81} pos={[0,5,0]} color="#FDB813" />
 *
 * Resuelve el tiempo de `match` (default = text) en window.__cineWords. Si das `at`,
 * usa ese tiempo fijo. Determinista (cacheado tras resolver) → válido en render.
 */
export function AnchorWord({
  text, match, at, after = 0, pos, color = '#FDB813', width = 5.5, height = 1.35,
  hold = 3.2, track = 8, glow = 24, fontWeight = 800,
}: {
  text: string; match?: string; at?: number; after?: number; pos: [number, number, number];
  color?: string; width?: number; height?: number; hold?: number; track?: number; glow?: number; fontWeight?: number;
}) {
  const timeRef = useCineTime();
  const ref = useRef<SkyTextHandle | null>(null);
  const resolved = useRef<number | null>(at ?? null);
  // 9:16 (portrait) recorta lo ancho: centra la x y limita el ancho del plano
  // → las palabras-ancla se apilan VERTICALES y centradas, completas.
  const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
  const px: [number, number, number] = portrait ? [pos[0] * 0.42, pos[1], pos[2]] : pos;
  const pw = portrait ? Math.min(width, 5.6) : width;
  useFrame(() => {
    if (!ref.current) return;
    if (resolved.current == null) {
      const tt = findWordTime(match ?? text, after);
      if (tt != null) resolved.current = tt; else { ref.current.setOpacity(0); return; }
    }
    const start = resolved.current;
    const t = timeRef.current;
    const inDur = 0.32, outDur = 0.6;
    let o = 0, s = 0.62;
    if (t < start) { o = 0; s = 0.62; }
    else if (t < start + inDur) { const f = clamp((t - start) / inDur, 0, 1); o = f; s = 0.62 + 0.45 * pop(f); }
    else if (t < start + inDur + hold) { o = 1; s = 1.0 + 0.02 * Math.sin((t - start) * 2); }
    else if (t < start + inDur + hold + outDur) { o = 1 - clamp((t - start - inDur - hold) / outDur, 0, 1); s = 1; }
    else { o = 0; }
    ref.current.setOpacity(o);
    ref.current.setScale(s);
  });
  return <SkyText ref={ref} text={text} upper track={track} glow={glow} fontWeight={fontWeight} color={color} width={pw} height={height} position={px} />;
}

/**
 * ParticleStream — corriente de N partículas que viajan de `from` a `to` en loop
 * continuo (escalonadas en fase → río constante). Emisivas → revientan por bloom.
 * Usar para flujos de energía/dinero/ideas entre dos elementos de la escena.
 */
export function ParticleStream({
  from, to, count = 10, color = '#FDB813', size = 0.16, speed = 0.4, arc = 1.2, intensity = 2.5,
}: {
  from: [number, number, number]; to: [number, number, number];
  count?: number; color?: string; size?: number; speed?: number; arc?: number; intensity?: number;
}) {
  const timeRef = useCineTime();
  const meshes = useRef<THREE.Mesh[]>([]);
  const a = useMemo(() => new THREE.Vector3(...from), [from]);
  const b = useMemo(() => new THREE.Vector3(...to), [to]);
  const mid = useMemo(() => a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, arc, 0)), [a, b, arc]);
  useFrame(() => {
    const t = timeRef.current;
    for (let i = 0; i < count; i++) {
      const m = meshes.current[i]; if (!m) continue;
      const ph = ((t * speed + i / count) % 1 + 1) % 1;
      // bezier cuadrática a→mid→b (arco)
      const u = 1 - ph;
      m.position.set(
        u * u * a.x + 2 * u * ph * mid.x + ph * ph * b.x,
        u * u * a.y + 2 * u * ph * mid.y + ph * ph * b.y,
        u * u * a.z + 2 * u * ph * mid.z + ph * ph * b.z,
      );
      const s = size * (0.6 + Math.sin(ph * Math.PI) * 0.8);
      m.scale.setScalar(s);
    }
  });
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} ref={m => { if (m) meshes.current[i] = m; }}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}
