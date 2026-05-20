/**
 * SkyText — texto grande flotante en el cielo (canvas-texture).
 *
 * Diseñado para "etiquetar" momentos clave (reveal de un término técnico,
 * cliffhanger entre capítulos, etc). Materializa con opacity + scale via
 * imperative API.
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

function makeSkyTexture(text: string, color: string, fontWeight: number): THREE.CanvasTexture {
  const W = 2048;
  const H = 384;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);

  // Auto-fit font: medimos con un tamaño grande inicial y escalamos a la baja
  // si el texto excede el ancho disponible (con margen del 6%).
  const maxWidth = W * 0.94;
  let fontSize = 220;
  ctx.font = fontWeight + ' ' + fontSize + 'px "Inter", "Helvetica", sans-serif';
  let measured = ctx.measureText(text).width;
  if (measured > maxWidth) {
    fontSize = Math.floor(fontSize * (maxWidth / measured));
    ctx.font = fontWeight + ' ' + fontSize + 'px "Inter", "Helvetica", sans-serif';
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
    const texture = useMemo(
      () => makeSkyTexture(text, color, fontWeight),
      [text, color, fontWeight],
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
