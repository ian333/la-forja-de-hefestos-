/**
 * Lemon — citrón estilizado, perfil revolution alrededor del eje Y.
 *
 *   ●    ← punta superior
 *  ▼
 *  ███
 * █████
 * █████   ← cuerpo elipsoide pinched
 *  ███
 *  ▼
 *   ●    ← punta inferior
 *
 * Default color amarillo cálido (#FDB813). En atom mode el halo casa con bloom.
 * Tamaño base: ~2 unidades de alto. Usa scale prop para ajustar.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import BaseShape, { type BaseShapeProps } from './_BaseShape';

type LemonProps = Omit<BaseShapeProps, 'geometry'> & {
  /** Resolución de la lathe (segmentos angulares). Default 28. */
  segments?: number;
};

export default function Lemon({ color = '#FDB813', segments = 28, ...rest }: LemonProps) {
  const geometry = useMemo(() => {
    // Perfil 2D del limón (semicorte vertical). Y de -1 (punta abajo) a +1 (punta arriba).
    // X = radio desde el eje. Las puntas pinch a casi 0.
    const points: THREE.Vector2[] = [
      new THREE.Vector2(0.00, -1.00),
      new THREE.Vector2(0.18, -0.92),
      new THREE.Vector2(0.45, -0.75),
      new THREE.Vector2(0.65, -0.45),
      new THREE.Vector2(0.74, -0.15),
      new THREE.Vector2(0.75, 0.10),
      new THREE.Vector2(0.71, 0.40),
      new THREE.Vector2(0.58, 0.65),
      new THREE.Vector2(0.35, 0.85),
      new THREE.Vector2(0.14, 0.96),
      new THREE.Vector2(0.00, 1.00),
    ];
    const geo = new THREE.LatheGeometry(points, segments);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }, [segments]);

  return <BaseShape geometry={geometry} color={color} {...rest} />;
}
