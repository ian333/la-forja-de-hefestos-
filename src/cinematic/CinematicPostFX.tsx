/**
 * CinematicPostFX — postproceso cinematográfico reutilizable para las escenas
 * astrofísicas de La Forja (BH / magnetar / quasar).
 *
 * IMPORTANTE — coordinación de tonemap:
 *   Este componente APLICA el ToneMapping ACES. Las escenas que lo usen NO deben
 *   tonemappear dos veces. El shader del sujeto (p. ej. el BH) debe emitir HDR
 *   LINEAL (linearOutput=true) para que el ACES de aquí no se aplique encima de
 *   un color ya tonemapeado.
 *
 * Orden de efectos (estricto, así "respira" la imagen como cine):
 *   Bloom (threshold BAJO -> los picos REVIENTAN) -> [flare anamórfico] ->
 *   DepthOfField (bokeh) -> ToneMapping ACES -> grade (Brightness/Contrast +
 *   Hue/Saturation) -> ChromaticAberration -> Noise (grano) -> Vignette.
 *
 * Guard del race de EffectComposer: igual que Stage.tsx, montamos los efectos
 * DETRÁS de un frame para que el composer no crashee al inicializarse (el
 * patrón PostprocessingShield + DeferredEffects). Sin esto, drei <Text> u otras
 * race conditions revientan el composer.
 *
 * Determinismo: el grano (Noise) es estático/blend; no introduce no-determinismo
 * por frame siempre que el render offline fije el mismo estado. No usamos
 * ningún reloj de sistema aquí.
 */

import { Component, useEffect, useState, useMemo, type ReactNode, type ErrorInfo, type ComponentProps, type FC } from 'react'
import { useThree } from '@react-three/fiber'
import { HalfFloatType, Vector2, NoToneMapping } from 'three'
import {
  EffectComposer,
  Bloom,
  DepthOfField,
  ToneMapping,
  BrightnessContrast,
  HueSaturation,
  ChromaticAberration,
  Noise,
  Vignette,
} from '@react-three/postprocessing'
import { ToneMappingMode, BlendFunction } from 'postprocessing'

// EffectComposer (@react-three/postprocessing) tipa sus children como ReactElement
// estricto; bajo React 19 varios efectos resuelven a ReactElement | undefined y el
// type-check truena aunque el runtime es correcto. Cast localizado: conserva el
// chequeo de props del composer (y de cada efecto), solo afloja el tipo de children.
const FXComposer = EffectComposer as unknown as FC<
  Omit<ComponentProps<typeof EffectComposer>, 'children'> & { children?: ReactNode }
>

/* ------------------------------------------------------------------ */
/* Presets por escena                                                  */
/* ------------------------------------------------------------------ */

export type CinematicPreset = 'bh' | 'magnetar' | 'quasar' | 'physics'

export interface CinematicPostFXProps {
  /** Preset que fija defaults sensatos por escena. */
  preset?: CinematicPreset

  // --- Bloom ---
  /** Intensidad del bloom. */
  bloomIntensity?: number
  /** Umbral de luminancia. BAJO (~0.1-0.2) para que los picos REVIENTEN. */
  bloomThreshold?: number
  /** Radio del bloom (suavidad del halo). */
  bloomRadius?: number

  // --- Depth of Field (bokeh) ---
  /** Distancia de foco (0..1, espacio de profundidad de pp). */
  dofFocusDistance?: number
  /** Longitud focal (más alta = transición más suave). */
  dofFocalLength?: number
  /** Escala del bokeh (tamaño del círculo de confusión). */
  dofBokehScale?: number

  // --- Lente / grade ---
  /** Offset de aberración cromática (sutil en bordes). */
  caOffset?: number
  /** Opacidad del grano de película. */
  grainOpacity?: number
  /** Oscuridad de la viñeta. */
  vignetteDarkness?: number
  /** Flare anamórfico horizontal (bloom adicional estirado en X). */
  anamorphic?: boolean

  // --- Color ---
  saturation?: number
  contrast?: number
  brightness?: number
}

interface PresetDefaults {
  bloomIntensity: number
  bloomThreshold: number
  bloomRadius: number
  dofFocusDistance: number
  dofFocalLength: number
  dofBokehScale: number
  caOffset: number
  grainOpacity: number
  vignetteDarkness: number
  anamorphic: boolean
  saturation: number
  contrast: number
  brightness: number
}

/**
 * Defaults por escena. Todos con bloom threshold BAJO para que los picos
 * (photon ring, polos del magnetar, jet del quasar) revienten en blanco.
 */
const PRESETS: Record<CinematicPreset, PresetDefaults> = {
  // Agujero negro: void frío azul-violeta vs anillo de fotones caliente.
  bh: {
    bloomIntensity: 2.4,
    bloomThreshold: 0.12,
    bloomRadius: 0.85,
    dofFocusDistance: 0.012,
    dofFocalLength: 0.04,
    dofBokehScale: 4.0,
    caOffset: 0.0,        // 0: la aberración cromática sobre el starfield = confeti verde
    grainOpacity: 0.03,
    vignetteDarkness: 0.9,
    anamorphic: true,
    saturation: 0.04,     // bajo: no empujar el residual de color (evita el morado/verde)
    contrast: 0.18,
    brightness: -0.02,
  },
  // Magnetar: polos brutalmente brillantes, líneas de campo dipolar.
  magnetar: {
    bloomIntensity: 2.0,
    bloomThreshold: 0.1,
    bloomRadius: 0.8,
    dofFocusDistance: 0.02,
    dofFocalLength: 0.05,
    dofBokehScale: 3.0,
    caOffset: 0.0012,
    grainOpacity: 0.05,
    vignetteDarkness: 0.85,
    anamorphic: true,
    saturation: 0.18,
    contrast: 0.16,
    brightness: 0.0,
  },
  // Quasar: jet relativista + disco de acreción ardiente.
  quasar: {
    bloomIntensity: 2.6,
    bloomThreshold: 0.14,
    bloomRadius: 0.9,
    dofFocusDistance: 0.03,
    dofFocalLength: 0.05,
    dofBokehScale: 3.5,
    caOffset: 0.0016,
    grainOpacity: 0.06,
    vignetteDarkness: 0.88,
    anamorphic: true,
    saturation: 0.2,
    contrast: 0.2,
    brightness: -0.01,
  },
  // Fisica (lab INTERACTIVO): lift cinematografico SIN sacrificar legibilidad.
  // El usuario ORBITA y lee el experimento -> NADA de DOF (no desenfocar
  // geometria educativa), NADA de flare anamorfico, vineta SUAVE (hay que ver el
  // experimento), aberracion casi nula (evita confeti sobre lineas/puntos). El
  // bloom de threshold bajo hace que la emision REVIENTE, con intensidad moderada
  // para no lavar el contenido. El salto vs el Stage viejo es el ACES + grade.
  physics: {
    bloomIntensity: 1.1,
    bloomThreshold: 0.22,
    bloomRadius: 0.7,
    dofFocusDistance: 0.02,
    dofFocalLength: 0.05,
    dofBokehScale: 0,
    caOffset: 0.0004,
    grainOpacity: 0.025,
    vignetteDarkness: 0.6,
    anamorphic: false,
    saturation: 0.12,
    contrast: 0.12,
    brightness: 0.0,
  },
}

/* ------------------------------------------------------------------ */
/* Guard del race de EffectComposer (replicado de Stage.tsx)          */
/* ------------------------------------------------------------------ */

/**
 * Error boundary mudo SOLO para el postproceso. Si el EffectComposer no logra
 * montar (race de @react-three/postprocessing v3 que lee pass.alpha de un
 * render target null), caemos a "sin postFX": la escena se sigue viendo, solo
 * sin el grade cinematográfico. Idéntico al PostprocessingShield de Stage.tsx.
 */
class PostprocessingShield extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[CinematicPostFX] Postproceso falló, renderizando sin grade:', error.message, info.componentStack)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/**
 * Difiere el montaje del EffectComposer hasta que el renderer esté del todo
 * inicializado — esquiva el race de @react-three/postprocessing v3 donde el
 * constructor del EffectComposer lee de un render target null. Dos ticks de
 * RAF (igual que Stage.tsx) para que el render target ya esté asignado.
 * En el render offline (frameloop="demand") forzamos un invalidate para que
 * los ticks sucedan.
 */
function DeferredEffects({ children }: { children: ReactNode }) {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!gl) return
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setReady(true)
        invalidate()
      })
      invalidate()
    })
    invalidate()
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [gl, invalidate])
  if (!ready) return null
  return <>{children}</>
}

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

export function CinematicPostFX(props: CinematicPostFXProps) {
  const preset = props.preset ?? 'bh'
  const d = PRESETS[preset]

  // Overrides opcionales encima del preset.
  const bloomIntensity = props.bloomIntensity ?? d.bloomIntensity
  const bloomThreshold = props.bloomThreshold ?? d.bloomThreshold
  const bloomRadius = props.bloomRadius ?? d.bloomRadius
  const dofFocusDistance = props.dofFocusDistance ?? d.dofFocusDistance
  const dofFocalLength = props.dofFocalLength ?? d.dofFocalLength
  const dofBokehScale = props.dofBokehScale ?? d.dofBokehScale
  const caOffset = props.caOffset ?? d.caOffset
  const grainOpacity = props.grainOpacity ?? d.grainOpacity
  const vignetteDarkness = props.vignetteDarkness ?? d.vignetteDarkness
  const anamorphic = props.anamorphic ?? d.anamorphic
  const saturation = props.saturation ?? d.saturation
  const contrast = props.contrast ?? d.contrast
  const brightness = props.brightness ?? d.brightness

  // Vector2 estable para la aberración cromática — evita un alloc por frame en
  // el render offline (miles de frames). Solo se recrea si caOffset cambia.
  const caVec = useMemo(() => new Vector2(caOffset, caOffset), [caOffset])

  // ESTE componente hace el ÚNICO tonemap (ACES). Forzamos NoToneMapping en el
  // renderer para que R3F no aplique su ACES por default ENCIMA del nuestro
  // (doble tonemap = lavado). Idempotente: las escenas que ya lo fijan en
  // onCreated no cambian. Esto hace que migrar un módulo a CinematicPostFX sea
  // solo cambiar el bloque de postFX, SIN tocar el <Canvas>.
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    if (!gl) return
    const prev = gl.toneMapping
    gl.toneMapping = NoToneMapping
    return () => { gl.toneMapping = prev }
  }, [gl])

  return (
    <PostprocessingShield>
      <DeferredEffects>
        <FXComposer
          // multisampling alto para el render IMAX (cada Bloom controla mipmapBlur).
          multisampling={8}
          // HDR lineal preservado entre passes para que el ACES no recorte picos.
          frameBufferType={HalfFloatType}
        >
          {/* 1) Bloom principal — threshold BAJO para que los picos REVIENTEN. */}
          <Bloom
            intensity={bloomIntensity}
            luminanceThreshold={bloomThreshold}
            luminanceSmoothing={0.9}
            radius={bloomRadius}
            mipmapBlur
          />

          {/*
            2) Flare anamórfico horizontal.
            Aproximación: un Bloom adicional más ancho que, combinado con la
            aberración cromática de abajo, insinúa el "rayo" horizontal de lente
            anamórfica. NOTA / SLOT: un flare anamórfico verdadero (estiramiento
            puro en X) requiere un Effect custom (kernel separable solo en X
            sobre el buffer de luminancia). Para el rayo nítido, sustituye este
            Bloom por ese Effect custom AQUÍ MISMO, manteniendo el orden (después
            del Bloom principal, antes del DOF).
          */}
          {anamorphic ? (
            <Bloom
              intensity={bloomIntensity * 0.4}
              luminanceThreshold={Math.max(bloomThreshold * 1.5, 0.18)}
              luminanceSmoothing={0.7}
              radius={Math.min(bloomRadius * 1.15, 0.97)}
              mipmapBlur
            />
          ) : null}

          {/* 3) Depth of Field con bokeh — separa planos = profundidad = escala.
              SOLO si bokehScale>0 Y la escena escribe profundidad real. En escenas
              de quad fullscreen SIN depth (el BH raytrace: depthWrite=false) hay
              que pasar dofBokehScale={0}; si no, el DOF lee profundidad plana y
              desenfoca TODO el cuadro de forma uniforme. */}
          {dofBokehScale > 0 ? (
            <DepthOfField
              focusDistance={dofFocusDistance}
              focalLength={dofFocalLength}
              bokehScale={dofBokehScale}
            />
          ) : null}

          {/* 4) ToneMapping ACES — ÚNICO tonemap del pipeline. */}
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />

          {/* 5) Grade: contraste/brillo (S-curve) + saturación (void frío vs disco caliente). */}
          <BrightnessContrast brightness={brightness} contrast={contrast} />
          <HueSaturation saturation={saturation} />

          {/* 6) Aberración cromática sutil en bordes (lente real). */}
          <ChromaticAberration
            offset={caVec}
            radialModulation
            modulationOffset={0.3}
          />

          {/* 7) Grano de película — textura orgánica, no render clínico. */}
          <Noise opacity={grainOpacity} blendFunction={BlendFunction.OVERLAY} />

          {/* 8) Viñeta — negros profundos en las esquinas, foco al centro. */}
          <Vignette eskil={false} offset={0.2} darkness={vignetteDarkness} />
        </FXComposer>
      </DeferredEffects>
    </PostprocessingShield>
  )
}

export default CinematicPostFX
