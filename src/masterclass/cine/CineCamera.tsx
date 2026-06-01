/**
 * CineCamera — cámara coreografiada por keyframes (el "director" estándar).
 *
 * Reemplaza los CameraDirector artesanales de cada escena. Defines puntos en el
 * tiempo {t, pos, look}; la cámara interpola suave (easeInOut) entre ellos
 * leyendo el reloj de la escena.
 *
 *   <CineCamera keys={[
 *     { t: 0,  pos: [0, 8, 40], look: [0, 1, 0] },
 *     { t: 12, pos: [6, 4, 18], look: [0, 2, 0] },
 *   ]} />
 */

import { useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCineTime, easeInOut, lerp } from './useCineTime';

export interface CineCamKey {
  t: number;
  pos: [number, number, number];
  look: [number, number, number];
  /** Si true, la cámara MANTIENE el plano anterior y CORTA seco a este key en su t (sin lerp). */
  cut?: boolean;
}

export default function CineCamera({ keys }: { keys: CineCamKey[] }) {
  const { camera } = useThree();
  const timeRef = useCineTime();
  const lookVec = useRef(new THREE.Vector3());

  useFrame(() => {
    if (keys.length === 0) return;
    const t = timeRef.current;
    let k0 = keys[0];
    let k1 = keys[0];
    if (t <= keys[0].t) {
      k0 = keys[0]; k1 = keys[0];
    } else if (t >= keys[keys.length - 1].t) {
      k0 = keys[keys.length - 1]; k1 = k0;
    } else {
      for (let i = 0; i < keys.length - 1; i++) {
        if (t >= keys[i].t && t < keys[i + 1].t) { k0 = keys[i]; k1 = keys[i + 1]; break; }
      }
    }
    const span = Math.max(1e-3, k1.t - k0.t);
    // Corte: mantener el plano anterior (k0) hasta k1.t; el salto a k1 ocurre solo
    // cuando t cruza al siguiente segmento → snap instantáneo (cine).
    const e = k1.cut ? 0 : easeInOut(Math.max(0, Math.min(1, (t - k0.t) / span)));
    camera.position.set(
      lerp(k0.pos[0], k1.pos[0], e),
      lerp(k0.pos[1], k1.pos[1], e),
      lerp(k0.pos[2], k1.pos[2], e),
    );
    lookVec.current.set(
      lerp(k0.look[0], k1.look[0], e),
      lerp(k0.look[1], k1.look[1], e),
      lerp(k0.look[2], k1.look[2], e),
    );
    camera.lookAt(lookVec.current);
  });

  return null;
}
