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

import { Canvas, type CanvasProps } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { type ReactNode } from 'react';
import { ACESFilmicToneMapping } from 'three';

interface StageProps {
  /** Distancia inicial de la cámara. Default = 5. */
  cameraDistance?: number;
  /** Rotación automática muy lenta (como el átomo). Default false. */
  autoRotate?: boolean;
  /** Intensidad de bloom (glow). Sin pasar = la del preset 'physics'. 0 = sin glow. */
  bloomIntensity?: number;
  /** Umbral de bloom. Opcional: si no se pasa manda el preset. Compatibilidad
      con callers (math lab + física) que aún lo especifican. */
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
  /**
   * OPT-IN: cuando true, el WebGL context se crea con
   * `preserveDrawingBuffer: true` para que `gl.domElement.toDataURL()` capture
   * el frame (si no, el navegador limpia el backbuffer tras el composite y el
   * PNG sale EN BLANCO). Tiene un costo de rendimiento pequeño, por eso es
   * opt-in: solo los modulos exportables del Math Lab lo activan. Los 14
   * modulos de fisica/quimica siguen sin pagarlo.
   */
  captureMode?: boolean;
  /** Hijos son la escena 3D. */
  children: ReactNode;
}

// Los guards anti-crash del EffectComposer (PostprocessingShield + DeferredEffects)
// ahora viven DENTRO de CinematicPostFX — Stage ya no los necesita aquí.

export default function Stage({
  cameraDistance = 5,
  autoRotate = false,
  bloomIntensity,   // sin default: si el módulo no lo pasa, manda el preset 'physics'
  bloomThreshold,   // idem; forward opcional al preset
  bgColor = '#05060A',
  enablePan = true,
  minDistance,
  maxDistance,
  canvasProps,
  captureMode = false,
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
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          // Solo en captureMode: deja el frame disponible para toDataURL().
          preserveDrawingBuffer: captureMode,
        }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        dpr={[1, 2]}
        onCreated={({ gl }) => {
          // El renderer hace el tonemap ACES directo (UNA vez). Antes lo hacía
          // CinematicPostFX vía EffectComposer, pero ese pipeline HDR-float+MSAA
          // revienta a BLANCO en GPUs diversas (Intel/ANGLE D3D11) — afectaba TODOS
          // los sims del lab. Sin EffectComposer = negro/oscuro garantizado en toda GPU.
          gl.toneMapping = ACESFilmicToneMapping;
        }}
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

        {/* SIN EffectComposer en el lab interactivo: el postFX cinematográfico
            (CinematicPostFX: HDR-float + MSAA + bloom) reventaba a BLANCO en GPUs
            diversas (Intel integrada / ANGLE D3D11) — rompía TODOS los sims a la vez.
            El renderer hace el tonemap ACES directo (onCreated) → fondo oscuro
            garantizado en toda GPU. El glow lo cargan los materiales emisivos.
            El postFX completo se conserva para los renders de video 4K (escenas
            dedicadas, no Stage). bloomIntensity/Threshold quedan como no-ops compat. */}
      </Canvas>
    </div>
  );
}
