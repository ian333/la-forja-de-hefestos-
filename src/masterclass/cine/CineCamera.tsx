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

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * CÁMARA VIVA (`live`): sobre la interpolación de keyframes se superpone un
 * movimiento determinista (puro en t → cacheable en render) que da sensación de
 * VIAJE y peso, sin descuadrar el objeto:
 *   · ORBIT — la cámara orbita suave alrededor del look (handheld lento)
 *   · BREATH — push/pull radial (se acerca y aleja como respirando)
 *   · BOB — vaivén vertical leve
 *   · PUSH-IN — dentro de cada plano, deriva un pelín HACIA el objeto (tensión)
 * `live` es número = intensidad (1 = base). Omitirlo = cámara plana de siempre.
 */
export default function CineCamera({ keys, live = 0 }: { keys: CineCamKey[]; live?: number | boolean }) {
  const { camera } = useThree();
  const timeRef = useCineTime();
  const lookVec = useRef(new THREE.Vector3());
  const offset = useRef(new THREE.Vector3());
  const amp = live === true ? 1 : (live || 0);

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
    const localE = Math.max(0, Math.min(1, (t - k0.t) / span));
    const e = k1.cut ? 0 : easeInOut(localE);
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

    if (amp > 0) {
      // vector look→cámara; lo giramos/escalamos para orbitar y respirar
      offset.current.subVectors(camera.position, lookVec.current);
      const ang = Math.sin(t * 0.16) * 0.07 * amp;            // orbit ±~4°
      offset.current.applyAxisAngle(Y_AXIS, ang);
      // PUSH-IN: dentro del plano, acerca ~6% hacia el final (tensión que sube)
      const pushIn = 1 - 0.06 * amp * easeInOut(localE);
      // BREATH: respira ±2.5% radial
      const breath = 1 + Math.sin(t * 0.30) * 0.025 * amp;
      offset.current.multiplyScalar(pushIn * breath);
      camera.position.copy(lookVec.current).add(offset.current);
      camera.position.y += Math.sin(t * 0.45) * 0.18 * amp;   // bob vertical
    }

    camera.lookAt(lookVec.current);
  });

  return null;
}
