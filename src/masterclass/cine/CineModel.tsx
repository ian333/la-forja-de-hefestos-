/**
 * CineModel — un GLB (AtomModel) con ENTRADA temporizada estándar.
 *
 * Carga cualquier modelo de /public/models/library/... con el atom-style, y le
 * da una entrada: crece (scale-in) en `at`, con flote suave. Estandariza el
 * "los objetos aparecen coreografiados" sin reescribir useFrame por escena.
 *
 *   <CineModel src="/models/library/buildings/factory.glb"
 *              position={[0,0,0]} at={1} color="#FDB813" fitTo={3} />
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import AtomModel from '@/masterclass/assets/gltf/AtomModel';
import type { ShapeMode } from '@/masterclass/assets/shapes/_BaseShape';
import { useCineTime, clamp01, easeOutCubic } from './useCineTime';

interface CineModelProps {
  src: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
  glow?: number;
  mode?: ShapeMode;
  fitTo?: number;
  halo?: boolean;
  /** Segundo de entrada. Default 0. */
  at?: number;
  /** Duración de la entrada (scale-in). Default 1.4. */
  rise?: number;
  /** Amplitud del flote. Default 0.08. 0 = quieto. */
  floatAmp?: number;
  /** Velocidad de giro en Y. Default 0. */
  spin?: number;
}

export default function CineModel({
  src, position = [0, 0, 0], rotation = [0, 0, 0], color = '#FDB813', glow = 1.0,
  mode = 'solid', fitTo = 2.5, halo = false, at = 0, rise = 1.4, floatAmp = 0.08, spin = 0,
}: CineModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useCineTime();

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const t = timeRef.current;
    const e = easeOutCubic(clamp01((t - at) / rise));
    g.scale.setScalar(e);
    g.visible = e > 0.01;
    const float = floatAmp > 0 ? Math.sin(t * 0.5 + position[0] * 0.6) * floatAmp * e : 0;
    g.position.set(position[0], position[1] + float, position[2]);
    if (spin) g.rotation.y = t * spin;
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      <AtomModel src={src} color={color} glow={glow} mode={mode} fitTo={fitTo} halo={halo} />
    </group>
  );
}
