/**
 * PriceText3D — texto de precio renderizado como textura canvas sobre un
 * plano 3D. Usamos canvas en lugar de drei <Text> porque drei Text dispara
 * el bug conocido de @react-three/postprocessing (crash en EffectComposer).
 *
 * Soporta:
 *   • Tachón animado (strikeProgress 0-1) — línea roja que cruza el texto.
 *   • Opacidad y escala desde props (para fade-in/out).
 *   • Glow emisivo desde el material (toneMapped=false para que bloom lo capte).
 *
 * El texto se vectoriza alto-DPI (2048×512) para que aguante zooms cercanos.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';

interface PriceText3DProps {
  text: string;
  color?: string;
  width?: number;
  height?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  opacity?: number;
  scale?: number;
  /** Si > 0, dibuja un tachón rojo desde 0 hasta este progreso (0-1). */
  strikeProgress?: number;
  /** Color del tachón. */
  strikeColor?: string;
  /** Font weight. Default 700. */
  fontWeight?: number;
}

function makePriceTexture(text: string, color: string, fontWeight: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const W = 2048;
  const H = 512;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Transparente
  ctx.clearRect(0, 0, W, H);

  // Texto centrado, JetBrains Mono para precio (estilo digital/cosmico)
  ctx.fillStyle = color;
  ctx.font = `${fontWeight} 340px "JetBrains Mono", "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Slight glow simulation: pinto el texto 2 veces con desenfoque variable
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.fillText(text, W / 2, H / 2);
  ctx.shadowBlur = 8;
  ctx.fillText(text, W / 2, H / 2);
  ctx.shadowBlur = 0;
  ctx.fillText(text, W / 2, H / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  return tex;
}

export default function PriceText3D({
  text,
  color = '#FFE5A0',
  width = 4.0,
  height = 1.0,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  opacity = 1,
  scale = 1,
  strikeProgress = 0,
  strikeColor = '#EF4444',
  fontWeight = 700,
}: PriceText3DProps) {
  const texture = useMemo(() => makePriceTexture(text, color, fontWeight), [text, color, fontWeight]);

  // Cleanup texture cuando cambia el text
  useEffect(() => {
    return () => { texture.dispose(); };
  }, [texture]);

  // Strike-through: una sub-mesh con planeGeometry escalada en X según progress
  const strikeWidth = width * 0.78; // no llega hasta los extremos
  const strikeOpacity = strikeProgress > 0 ? Math.min(1, strikeProgress * 2.5) : 0;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Texto principal */}
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={opacity}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      {/* Tachón rojo */}
      {strikeProgress > 0 && (
        <mesh position={[(strikeProgress - 1) * strikeWidth / 2, 0, 0.01]}>
          <planeGeometry args={[strikeWidth * strikeProgress, height * 0.10]} />
          <meshBasicMaterial
            color={strikeColor}
            transparent
            opacity={strikeOpacity * opacity}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Glow halo detrás del texto (sutil) */}
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[width * 1.15, height * 1.4]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={opacity * 0.25}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
