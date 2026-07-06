/**
 * SkyText — texto grande flotante en el cielo (canvas-texture).
 *
 * Diseñado para "etiquetar" momentos clave (reveal de un término técnico,
 * cliffhanger entre capítulos, etc). Materializa con opacity + scale via
 * imperative API.
 *
 * IMPORTANTE: el canvas se genera con el MISMO ratio width/height que el
 * plane 3D, así el texto no se aplasta ni estira aunque el plane sea
 * extremadamente ancho o cuadrado.
 *
 * Posición típica: y alto (cielo), z atrás (lejos), centered en x.
 */

import { useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';

export interface SkyTextHandle {
  setOpacity(o: number): void;
  setScale(s: number): void;
}

interface SkyTextProps {
  text: string;
  color?: string;
  /** Ancho del plano en world units. Default 12. */
  width?: number;
  height?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Font weight. Default 600 (lighter than prices). */
  fontWeight?: number;
  /** MAYÚSCULAS (para palabras-ancla). */
  upper?: boolean;
  /** Tracking (letter-spacing px) — palabras-ancla se ven mejor con ~6-10. */
  track?: number;
  /** Intensidad del glow (default 14; ancla ~22). */
  glow?: number;
}

function makeSkyTexture(
  text: string,
  color: string,
  fontWeight: number,
  ratio: number,
  upper = false,
  track = 0,
  glow = 14,
): THREE.CanvasTexture {
  // Canvas dimensions con el MISMO ratio que el plane 3D (width/height).
  // Eso garantiza que el texto se renderiza sin aplastarse/estirarse al
  // mapear la textura sobre el plane.
  //
  // Base H fija para mantener calidad pareja. W deriva del ratio.
  // Clamp el ratio a un rango razonable para evitar canvases gigantes.
  const safeRatio = Math.max(0.5, Math.min(20, ratio));
  const H = 384;
  const W = Math.round(H * safeRatio);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);
  const label = upper ? text.toUpperCase() : text;

  // Auto-fit font (Outfit = geométrica, fuerte en bold; ideal para palabras-ancla):
  const maxHeightPx = H * 0.72;
  const maxWidthPx = W * 0.94;
  let fontSize = Math.floor(maxHeightPx);
  const setFont = () => {
    ctx.font = `${fontWeight} ${fontSize}px "Outfit", "Inter", "Helvetica", sans-serif`;
    try { ctx.letterSpacing = `${track}px`; } catch { /* letterSpacing no soportado */ }
  };
  setFont();
  let measured = ctx.measureText(label).width;
  if (measured > maxWidthPx) {
    fontSize = Math.floor(fontSize * (maxWidthPx / measured));
    setFont();
  }

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Glow: 2 pasadas de sombra (halo) + relleno nítido encima → revienta por bloom
  ctx.shadowColor = color;
  ctx.shadowBlur = glow * 1.8;
  ctx.fillText(label, W / 2, H / 2);
  ctx.shadowBlur = glow;
  ctx.fillText(label, W / 2, H / 2);
  ctx.shadowBlur = 0;
  ctx.fillText(label, W / 2, H / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

const SkyText = forwardRef<SkyTextHandle, SkyTextProps>(
  function SkyText({
    text,
    color = '#FFE5A0',
    width = 12,
    height = 2.25,
    position = [0, 8, -10],
    rotation = [0, 0, 0],
    fontWeight = 600,
    upper = false,
    track = 0,
    glow = 14,
  }, ref) {
    const ratio = width / Math.max(0.01, height);
    const texture = useMemo(
      () => makeSkyTexture(text, color, fontWeight, ratio, upper, track, glow),
      [text, color, fontWeight, ratio, upper, track, glow],
    );
    useEffect(() => () => { texture.dispose(); }, [texture]);

    const groupRef = useRef<THREE.Group>(null);
    const matRef = useRef<THREE.MeshBasicMaterial>(null);
    const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);

    useImperativeHandle(ref, () => ({
      setOpacity(o: number) {
        if (matRef.current) matRef.current.opacity = o;
        if (haloMatRef.current) haloMatRef.current.opacity = o * 0.30;
      },
      setScale(s: number) {
        if (groupRef.current) groupRef.current.scale.setScalar(s);
      },
    }), []);

    return (
      <group ref={groupRef} position={position} rotation={rotation}>
        {/* Texto principal — single mesh, sin halo background que duplica.
            El bloom postFX hace el glow naturalmente. */}
        <mesh>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial
            ref={matRef}
            map={texture}
            transparent
            opacity={0}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
        {/* haloMatRef es un noop ahora — mantenemos la ref para compat API */}
        <mesh visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial ref={haloMatRef} transparent opacity={0} />
        </mesh>
      </group>
    );
  },
);

export default SkyText;
