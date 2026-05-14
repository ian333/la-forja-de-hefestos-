/**
 * Stage — Canvas R3F compartido con la misma calidad visual que el átomo de GaiaLab.
 *
 * Lo que te da "gratis":
 *   - Bloom + Vignette postprocessing (tolerante a fallos).
 *   - Fondo con gradiente radial (vignette tipográfico).
 *   - Iluminación ambiental + direccional + point lights.
 *   - OrbitControls con damping suave y auto-rotate opcional.
 *   - Cámara con buena distancia default, near=0.001 para escalas atómicas.
 *
 * Nota: `@react-three/postprocessing` tiene un bug de carrera en
 * EffectComposer.addPass (lee pass.alpha de un buffer null) que dispara
 * "Cannot read properties of null (reading 'alpha')". Envolvemos los effects
 * en un ErrorBoundary mudo que cae a "sin postprocessing" si falla — la
 * escena se sigue viendo, solo sin bloom.
 */

import { Canvas, useThree, type CanvasProps } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import { Component, useEffect, useState, type ReactNode, type ErrorInfo } from 'react';
import { HalfFloatType } from 'three';

interface StageProps {
  /** Distancia inicial de la cámara. Default = 5. */
  cameraDistance?: number;
  /** Rotación automática muy lenta (como el átomo). Default false. */
  autoRotate?: boolean;
  /** Intensidad de bloom (glow). 0 = sin glow. Default 0.9. */
  bloomIntensity?: number;
  /** Umbral luminoso para bloom. Default 0.1 (suave, captura colores emisivos). */
  bloomThreshold?: number;
  /** Color del fondo. Default mezcla de la forja. */
  bgColor?: string;
  /** Permitir pan (arrastrar con botón derecho). Default true. */
  enablePan?: boolean;
  /** Distancia mínima y máxima de zoom. */
  minDistance?: number;
  maxDistance?: number;
  /** Opciones extras para el canvas (near/far, fov, etc.). */
  canvasProps?: Partial<CanvasProps>;
  /** Hijos son la escena 3D. */
  children: ReactNode;
}

/**
 * Silent error boundary specifically for postprocessing.
 * If EffectComposer fails to mount, we just render nothing — the scene
 * stays intact, only the bloom/vignette is missing.
 */
class PostprocessingShield extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[Stage] Postprocessing falló, renderizando sin bloom:', error.message, info.componentStack);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Defers mounting of EffectComposer until after the renderer is fully
 * initialized — sidesteps a race in @react-three/postprocessing v3 where
 * EffectComposer's constructor reads from a null render target.
 */
function DeferredEffects({ children }: { children: ReactNode }) {
  const gl = useThree(state => state.gl);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!gl) return;
    // Wait two RAF ticks so the renderer's render target is allocated.
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

export default function Stage({
  cameraDistance = 5,
  autoRotate = false,
  bloomIntensity = 0.9,
  bloomThreshold = 0.1,
  bgColor = '#05060A',
  enablePan = true,
  minDistance,
  maxDistance,
  canvasProps,
  children,
}: StageProps) {
  return (
    <div
      className="relative w-full h-full"
      style={{
        background: `radial-gradient(ellipse at center, #0B0F17 0%, ${bgColor} 85%)`,
      }}
    >
      <Canvas
        camera={{ position: [0, cameraDistance * 0.35, cameraDistance], fov: 45, near: 0.001, far: 10000 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        dpr={[1, 2]}
        {...canvasProps}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 8, 5]} intensity={0.6} color="#CBD5E1" />
        <directionalLight position={[-6, -3, -4]} intensity={0.25} color="#4FC3F7" />
        <pointLight position={[0, 0, 0]} intensity={0.4} distance={cameraDistance * 2} color="#FDB813" />

        <OrbitControls
          enablePan={enablePan}
          enableDamping
          dampingFactor={0.08}
          autoRotate={autoRotate}
          autoRotateSpeed={0.4}
          minDistance={minDistance ?? cameraDistance * 0.1}
          maxDistance={maxDistance ?? cameraDistance * 20}
        />

        {children}

        {bloomIntensity > 0 && (
          <PostprocessingShield>
            <DeferredEffects>
              <EffectComposer
                multisampling={4}
                enableNormalPass={false}
                frameBufferType={HalfFloatType}
              >
                <Bloom
                  intensity={bloomIntensity}
                  luminanceThreshold={bloomThreshold}
                  luminanceSmoothing={0.4}
                  mipmapBlur
                  kernelSize={KernelSize.LARGE}
                />
                <Vignette
                  offset={0.25}
                  darkness={0.65}
                  blendFunction={BlendFunction.NORMAL}
                />
              </EffectComposer>
            </DeferredEffects>
          </PostprocessingShield>
        )}
      </Canvas>
    </div>
  );
}
