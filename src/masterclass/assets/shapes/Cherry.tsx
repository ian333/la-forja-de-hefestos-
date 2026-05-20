/**
 * Cherry — par de cerezas con tallo unificado en Y.
 *
 *     ╲ ╱       ← tallos curvos que se juntan arriba
 *      ┴
 *     ◯ ◯      ← dos esferas cerezas
 *
 * En el contexto Akerlof "cherries" = carros buenos (verde verde-vivo, no rojo).
 * El default color es verde para reusabilidad en escenas de Limones (cherries
 * vs lemons). Para una cereza-fruta real, override con color="#D7263D".
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import BaseShape, { type BaseShapeProps } from './_BaseShape';

type CherryProps = Omit<BaseShapeProps, 'geometry'> & {
  /** Color del tallo. Default verde botánico. */
  stemColor?: string;
  /** Si true, dos cerezas; si false, una sola. Default true. */
  pair?: boolean;
};

export default function Cherry({
  color = '#34D399',
  stemColor = '#5BA34A',
  pair = true,
  scale = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  glow = 1,
  ...rest
}: CherryProps) {
  // Geometría de UNA cereza: esfera con leve dimple arriba (donde se mete el tallo).
  const sphereGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.5, 28, 20);
    geo.computeBoundingSphere();
    return geo;
  }, []);

  // Tallo curvo: bezier que va de la cereza hacia arriba-centro.
  const stemGeo = useMemo(() => {
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0.55, 0.30, 0),    // start: top of left cherry
      new THREE.Vector3(0.45, 0.85, 0),
      new THREE.Vector3(0.15, 1.15, 0),
      new THREE.Vector3(0.00, 1.40, 0),    // end: top joint
    );
    return new THREE.TubeGeometry(curve, 18, 0.035, 6, false);
  }, []);

  const stemGeoRight = useMemo(() => {
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-0.55, 0.30, 0),
      new THREE.Vector3(-0.45, 0.85, 0),
      new THREE.Vector3(-0.15, 1.15, 0),
      new THREE.Vector3(0.00, 1.40, 0),
    );
    return new THREE.TubeGeometry(curve, 18, 0.035, 6, false);
  }, []);

  const scaleArr: [number, number, number] =
    typeof scale === 'number' ? [scale, scale, scale] : scale;

  return (
    <group position={position} rotation={rotation} scale={scaleArr}>
      {/* Cereza izquierda (o única) */}
      <group position={pair ? [0.55, -0.25, 0] : [0, -0.25, 0]}>
        <BaseShape geometry={sphereGeo} color={color} glow={glow} {...rest} />
      </group>

      {/* Cereza derecha (solo si pair) */}
      {pair && (
        <group position={[-0.55, -0.25, 0]}>
          <BaseShape geometry={sphereGeo} color={color} glow={glow} {...rest} />
        </group>
      )}

      {/* Tallo izquierdo */}
      <mesh geometry={pair ? stemGeo : stemGeoRight}>
        <meshStandardMaterial
          color={stemColor}
          emissive={stemColor}
          emissiveIntensity={0.4 * glow}
          roughness={0.7}
        />
      </mesh>

      {/* Tallo derecho (solo si pair) */}
      {pair && (
        <mesh geometry={stemGeoRight}>
          <meshStandardMaterial
            color={stemColor}
            emissive={stemColor}
            emissiveIntensity={0.4 * glow}
            roughness={0.7}
          />
        </mesh>
      )}
    </group>
  );
}
