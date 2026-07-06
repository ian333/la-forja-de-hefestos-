/**
 * CineText — texto 3D (SkyText) con reveal temporizado estándar.
 *
 * Reemplaza el boilerplate de useFrame + setOpacity/setScale que cada escena
 * repetía. Defines cuándo entra y cuánto dura:
 *
 *   <CineText text="¿Por qué Silicon Valley está donde está?"
 *             position={[0, 6, -6]} at={3} hold={5} color="#FFE5A0" />
 *
 * Curva: fade-in (inDur) → hold → fade-out (outDur), con un micro-pop de escala.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import SkyText, { type SkyTextHandle } from '@/masterclass/preview/SkyText';
import { useCineTime, clamp01, easeOutCubic, easeInCubic } from './useCineTime';

interface CineTextProps {
  text: string;
  position: [number, number, number];
  color?: string;
  width?: number;
  height?: number;
  fontWeight?: number;
  rotation?: [number, number, number];
  upper?: boolean;
  track?: number;
  glow?: number;
  /** Segundo en que empieza a aparecer. */
  at: number;
  /** Duración del fade-in. Default 0.8. */
  inDur?: number;
  /** Cuánto se queda visible. Default 4.5. */
  hold?: number;
  /** Duración del fade-out. Default 1.0. */
  outDur?: number;
  /** Opacidad máxima. Default 1. */
  maxOpacity?: number;
}

export default function CineText({
  text, position, color = '#FFE5A0', width = 9, height = 1.1, fontWeight = 600, rotation,
  upper = false, track = 0, glow = 14,
  at, inDur = 0.8, hold = 4.5, outDur = 1.0, maxOpacity = 1,
}: CineTextProps) {
  const ref = useRef<SkyTextHandle | null>(null);
  const timeRef = useCineTime();

  useFrame(() => {
    if (!ref.current) return;
    const t = timeRef.current;
    const tFull = at + inDur;
    const tHold = tFull + hold;
    const tOut = tHold + outDur;
    let o = 0;
    let s = 0.92;
    if (t < at) { o = 0; s = 0.92; }
    else if (t < tFull) { const f = easeOutCubic(clamp01((t - at) / inDur)); o = f; s = 0.92 + 0.08 * f; }
    else if (t < tHold) { o = 1; s = 1; }
    else if (t < tOut) { o = 1 - easeInCubic(clamp01((t - tHold) / outDur)); s = 1; }
    else { o = 0; }
    ref.current.setOpacity(o * maxOpacity);
    ref.current.setScale(s);
  });

  return (
    <SkyText ref={ref} text={text} position={position} color={color}
             width={width} height={height} fontWeight={fontWeight} rotation={rotation}
             upper={upper} track={track} glow={glow} />
  );
}
