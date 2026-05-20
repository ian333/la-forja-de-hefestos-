/**
 * Coin — moneda. Cilindro muy delgado con dos caras opcionales (símbolo en
 * canvas texture). Lateral revela el espesor mínimo característico.
 *
 *      ╱─────╲
 *     │   $   │   ← cara frontal
 *      ╲─────╱
 *      ▔▔▔▔▔     ← canto delgado
 *
 * Útil para: Akerlof (transacción), Friedman (base monetaria), Markowitz
 * (unidad de capital), Nash (pago). Color default oro pálido.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import BaseShape, { type BaseShapeProps } from './_BaseShape';

type CoinProps = Omit<BaseShapeProps, 'geometry'> & {
  /** Símbolo en la cara. Default "$". */
  symbol?: string;
  /** Color del símbolo. Default contrasta con color base. */
  symbolColor?: string;
  /** Radio relativo (1 = unit). Default 1. */
  radius?: number;
  /** Grosor relativo. Default 0.18. */
  thickness?: number;
};

export default function Coin({
  color = '#E8C474',
  symbol = '$',
  symbolColor = '#3A2818',
  radius = 1,
  thickness = 0.18,
  scale = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  glow = 1,
  ...rest
}: CoinProps) {
  const bodyGeo = useMemo(() => {
    const geo = new THREE.CylinderGeometry(radius, radius, thickness, 36, 1);
    geo.computeBoundingSphere();
    return geo;
  }, [radius, thickness]);

  const symbolTex = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 512);
    ctx.fillStyle = symbolColor;
    ctx.font = '900 400px "JetBrains Mono", "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, 256, 280);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [symbol, symbolColor]);

  const scaleArr: [number, number, number] =
    typeof scale === 'number' ? [scale, scale, scale] : scale;

  return (
    <group position={position} rotation={rotation} scale={scaleArr}>
      {/* Body atom-style — el cilindro emisivo dorado */}
      <BaseShape geometry={bodyGeo} color={color} glow={glow} {...rest} />

      {/* Cara frontal — símbolo en plane circular */}
      <mesh position={[0, thickness / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius * 0.78, 36]} />
        <meshBasicMaterial map={symbolTex} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      {/* Cara trasera (espejada) */}
      <mesh position={[0, -thickness / 2 - 0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius * 0.78, 36]} />
        <meshBasicMaterial map={symbolTex} transparent toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}
