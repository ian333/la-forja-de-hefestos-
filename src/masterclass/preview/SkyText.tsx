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
}

function makeSkyTexture(
  text: string,
  color: string,
  fontWeight: number,
  ratio: number,
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

  // Auto-fit font:
  //   - El tamaño máximo está limitado por la altura disponible (line height ~70% H)
  //   - Y por el ancho disponible (94% W)
  // Empezamos con un tamaño basado en H y bajamos si excede el ancho.
  const maxHeightPx = H * 0.72;
  const maxWidthPx = W * 0.94;
  let fontSize = Math.floor(maxHeightPx);
  ctx.font = `${fontWeight} ${fontSize}px "Inter", "Helvetica", sans-serif`;
  let measured = ctx.measureText(text).width;
  if (measured > maxWidthPx) {
    fontSize = Math.floor(fontSize * (maxWidthPx / measured));
    ctx.font = `${fontWeight} ${fontSize}px "Inter", "Helvetica", sans-serif`;
  }

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Single sutil glow
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillText(text, W / 2, H / 2);
  ctx.shadowBlur = 0;
  ctx.fillText(text, W / 2, H / 2);

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
  }, ref) {
    const ratio = width / Math.max(0.01, height);
    const texture = useMemo(
      () => makeSkyTexture(text, color, fontWeight, ratio),
      [text, color, fontWeight, ratio],
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
