/**
 * Apple — manzana con leve indent superior (zona del tallo) + tallo opcional.
 *
 *     │     ← tallo
 *    ◯◯◯
 *   ◯◯◯◯◯
 *  ◯◯◯◯◯◯◯  ← cuerpo casi esférico, ligero achatamiento vertical
 *   ◯◯◯◯◯
 *    ◯◯◯
 *
 * El "atom" mode revela el tallo claramente. Color default rojo cereza maduro.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import BaseShape, { type BaseShapeProps } from './_BaseShape';

type AppleProps = Omit<BaseShapeProps, 'geometry'> & {
  /** Resolución de la lathe. Default 32. */
  segments?: number;
  /** Si true, agrega tallo pequeño marrón. Default true. */
  withStem?: boolean;
};

export default function Apple({
  color = '#D7263D',
  segments = 32,
  withStem = true,
  scale = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  ...rest
}: AppleProps) {
  const geometry = useMemo(() => {
    // Perfil de manzana: bottom rounded, top rounded con indent suave en y≈0.85.
    const points: THREE.Vector2[] = [
      new THREE.Vector2(0.00, -1.00),
      new THREE.Vector2(0.35, -0.92),
      new THREE.Vector2(0.65, -0.72),
      new THREE.Vector2(0.85, -0.40),
      new THREE.Vector2(0.94, -0.05),
      new THREE.Vector2(0.92, 0.30),
      new THREE.Vector2(0.78, 0.60),
      new THREE.Vector2(0.50, 0.82),
      new THREE.Vector2(0.22, 0.88),  // entra al indent
      new THREE.Vector2(0.10, 0.83),  // fondo del indent
      new THREE.Vector2(0.08, 0.92),  // base del tallo
      new THREE.Vector2(0.00, 0.93),
    ];
    const geo = new THREE.LatheGeometry(points, segments);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }, [segments]);

  const scaleArr: [number, number, number] =
    typeof scale === 'number' ? [scale, scale, scale] : scale;

  return (
    <group position={position} rotation={rotation} scale={scaleArr}>
      <BaseShape geometry={geometry} color={color} {...rest} />
      {withStem && (
        <group position={[0, 0.98, 0]}>
          <mesh>
            <cylinderGeometry args={[0.04, 0.05, 0.18, 8]} />
            <meshStandardMaterial color="#5C3A1E" roughness={0.8} metalness={0.1} />
          </mesh>
        </group>
      )}
    </group>
  );
}
