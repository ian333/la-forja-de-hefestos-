/**
 * Bill — billete de dinero. Rectángulo plano con borde interior y un símbolo
 * extruido al centro (por default "$" en green-peso). Idealmente leído de
 * lado para que la cámara orbital lo "encuentre" como en BlackHole reveal.
 *
 *   ┌─────────────────┐
 *   │  ┌───────────┐  │
 *   │  │     $     │  │   ← símbolo extruido emisivo
 *   │  └───────────┘  │
 *   └─────────────────┘
 *
 * Útil para: Akerlof (transacción), Friedman/Lucas (oferta monetaria),
 * Markowitz (asignación de capital).
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import BaseShape, { type BaseShapeProps } from './_BaseShape';

type BillProps = Omit<BaseShapeProps, 'geometry'> & {
  /** Símbolo central. "$" | "€" | "₿" | "¥" | string custom. Default "$". */
  symbol?: string;
  /** Color del símbolo (override del color base). */
  symbolColor?: string;
};

const BILL_W = 2.4;
const BILL_H = 1.2;
const BILL_D = 0.04;

export default function Bill({
  color = '#7AC97D',
  symbol = '$',
  symbolColor,
  scale = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  glow = 1,
  ...rest
}: BillProps) {
  // Body principal del billete — caja plana.
  const bodyGeo = useMemo(() => {
    const geo = new THREE.BoxGeometry(BILL_W, BILL_H, BILL_D);
    geo.computeBoundingSphere();
    return geo;
  }, []);

  // Borde interior — rectángulo wireframe encima de la cara frontal.
  const borderGeo = useMemo(() => {
    const w = BILL_W - 0.30;
    const h = BILL_H - 0.20;
    const positions: number[] = [
      -w/2, -h/2, BILL_D/2 + 0.001,   w/2, -h/2, BILL_D/2 + 0.001,
       w/2, -h/2, BILL_D/2 + 0.001,   w/2,  h/2, BILL_D/2 + 0.001,
       w/2,  h/2, BILL_D/2 + 0.001,  -w/2,  h/2, BILL_D/2 + 0.001,
      -w/2,  h/2, BILL_D/2 + 0.001,  -w/2, -h/2, BILL_D/2 + 0.001,
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, []);

  // Símbolo central — Canvas texture aplicada a un plane.
  // (TextGeometry de drei requeriría drei <Text3D> + fuente; preferimos canvas
  // por simplicidad y para evitar el bug postFX+drei Text mencionado en
  // feedback_r3f_postprocessing_race.)
  const symbolTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 512);
    const finalColor = symbolColor ?? color;
    ctx.fillStyle = finalColor;
    ctx.font = '700 380px "JetBrains Mono", "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = finalColor;
    ctx.shadowBlur = 36;
    ctx.fillText(symbol, 256, 270);
    ctx.shadowBlur = 0;
    ctx.fillText(symbol, 256, 270);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [symbol, color, symbolColor]);

  const scaleArr: [number, number, number] =
    typeof scale === 'number' ? [scale, scale, scale] : scale;

  return (
    <group position={position} rotation={rotation} scale={scaleArr}>
      {/* Body atom-style — el billete como volumen emisivo */}
      <BaseShape geometry={bodyGeo} color={color} glow={glow} {...rest} />

      {/* Borde interior wireframe (sutil) */}
      <lineSegments geometry={borderGeo}>
        <lineBasicMaterial color={color} transparent opacity={0.55 * glow} toneMapped={false} />
      </lineSegments>

      {/* Símbolo "$" frontal */}
      <mesh position={[0, 0, BILL_D / 2 + 0.002]}>
        <planeGeometry args={[0.85, 0.85]} />
        <meshBasicMaterial map={symbolTexture} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      {/* Espejo trasero del símbolo */}
      <mesh position={[0, 0, -BILL_D / 2 - 0.002]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.85, 0.85]} />
        <meshBasicMaterial map={symbolTexture} transparent toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}
