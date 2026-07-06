/**
 * _postFX — Postprocessing reutilizable para escenas de masterclass.
 *
 * Patrón heredado de Stage.tsx:
 *   • PostprocessingShield: ErrorBoundary mudo que cae a "sin bloom" si falla.
 *   • DeferredEffects: espera 2 RAF ticks para evitar la race condition de
 *     @react-three/postprocessing v3 donde EffectComposer lee de un render
 *     target null al montarse.
 *
 * IMPORTANTE: NO usar drei `<Text>` dentro de escenas que tengan PostFX —
 * dispara el bug mencionado y crashea la escena entera. Usa overlays HTML.
 *
 * Uso:
 *   <Canvas>
 *     <YourScene />
 *     <PostFX intensity={1.6} threshold={0.2} vignette={0.7} aberration={0.0015} />
 *   </Canvas>
 */

import { useThree, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import { Component, useEffect, useRef, useState, type ReactNode, type ErrorInfo } from 'react';
import { HalfFloatType, Vector2 } from 'three';
import { voiceLevel } from '@/masterclass/cine/dynamics';

/**
 * BloomPulse — Bloom cuya intensidad RESPIRA con la voz (voiceLevel del envelope).
 * En los picos de narración los objetos emisivos FLAREAN. Si no hay envelope,
 * voiceLevel()=0 → intensidad base (cero cambio para escenas sin voz).
 */
function BloomPulse({ intensity, threshold, smoothing }: { intensity: number; threshold: number; smoothing: number }) {
  const ref = useRef<{ intensity: number } | null>(null);
  useFrame(() => { if (ref.current) ref.current.intensity = intensity * (1 + voiceLevel() * 0.45); });
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Bloom ref={ref as any} intensity={intensity} luminanceThreshold={threshold} luminanceSmoothing={smoothing} mipmapBlur kernelSize={KernelSize.LARGE} />
  );
}

class PostprocessingShield extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[PostFX] Postprocessing falló, renderizando sin bloom:', error.message, info.componentStack);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function DeferredEffects({ children }: { children: ReactNode }) {
  const gl = useThree(state => state.gl);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!gl) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [gl]);
  if (!ready) return null;
  return <>{children}</>;
}

export interface PostFXProps {
  /** Intensidad del bloom (glow desbordado). 0.8 = sutil, 1.5 = cinemático, 2.0 = etéreo. Default 1.4. */
  intensity?: number;
  /** Umbral luminoso (qué tan brillante necesita ser un pixel para que brille). 0.1 = casi todo brilla, 0.4 = solo lo emisivo. Default 0.2. */
  threshold?: number;
  /** Suavizado del umbral. Default 0.4. */
  smoothing?: number;
  /** Darkness del vignette (sombreado en bordes). 0 = sin vignette, 0.9 = bordes casi negros. Default 0.6. */
  vignette?: number;
  /** Offset del vignette (cuánto se acerca al centro). Default 0.25. */
  vignetteOffset?: number;
  /** Aberración cromática (separación RGB en bordes). 0 = sin, 0.002 = sutil cine, 0.005 = obvio. Default 0. */
  aberration?: number;
}

/**
 * Postprocessing stack reutilizable.
 * Aplica bloom + vignette + (opcional) chromatic aberration con tolerancia a
 * fallos de inicialización.
 */
export default function PostFX({
  intensity = 1.4,
  threshold = 0.2,
  smoothing = 0.4,
  vignette = 0.6,
  vignetteOffset = 0.25,
  aberration = 0,
}: PostFXProps) {
  if (intensity <= 0) return null;
  // Always include all effects to satisfy EffectComposer children typing.
  // Set neutral values (darkness=0, offset=0) when the user opted out.
  // MSAA del composer: a 4K (lado largo > 2400px) un framebuffer multisample
  // HalfFloat satura la VRAM/límites de ANGLE → context lost (pantalla blanca).
  // A 4K usamos 0 (8.3 MP + bloom ya suavizan); a resoluciones bajas, 4.
  const bigRes = typeof window !== 'undefined' && Math.max(window.innerWidth, window.innerHeight) > 2400;
  return (
    <PostprocessingShield>
      <DeferredEffects>
        <EffectComposer
          multisampling={bigRes ? 0 : 4}
          enableNormalPass={false}
          frameBufferType={HalfFloatType}
        >
          <BloomPulse intensity={intensity} threshold={threshold} smoothing={smoothing} />
          <Vignette
            offset={vignetteOffset}
            darkness={vignette}
            blendFunction={BlendFunction.NORMAL}
          />
          <ChromaticAberration
            offset={new Vector2(aberration, aberration)}
            radialModulation={false}
            modulationOffset={0}
          />
        </EffectComposer>
      </DeferredEffects>
    </PostprocessingShield>
  );
}
