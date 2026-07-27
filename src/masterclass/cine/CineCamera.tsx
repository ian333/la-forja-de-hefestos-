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

import { useMemo, useRef } from 'react';
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
 * PCHIP (Fritsch–Carlson): cúbica monótona C1 por componente. La cámara pasa
 * EXACTO por cada key pero la velocidad es CONTINUA — sin el paro-arranque del
 * easeInOut por segmento (los "pequeños saltos" entre planos). Nace EN VUELO
 * (gancho con movimiento desde el cuadro 1) y aterriza con pendiente 0.
 */
function pchip(ts: number[], ys: number[]) {
  const n = ts.length;
  if (n === 1) return () => ys[0];
  const h: number[] = [], d: number[] = [];
  for (let i = 0; i < n - 1; i++) { h.push(ts[i + 1] - ts[i]); d.push((ys[i + 1] - ys[i]) / (ts[i + 1] - ts[i])); }
  const m: number[] = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) { m[i] = 0; continue; }
    const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
    m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  }
  // nace EN VUELO (m0 = secante del 1er segmento, monótono-seguro: α=1 cae en la
  // región de Fritsch–Carlson): el gancho necesita movimiento desde el cuadro 1
  // (detector-gancho: los virales miden 0.012-0.058 de motion en 0.5s; con m0=0
  // la cámara nacía QUIETA y el arranque moría). Aterrizaje sí queda suave.
  m[0] = d[0]; m[n - 1] = 0;
  return (t: number) => {
    if (t <= ts[0]) return ys[0];
    if (t >= ts[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && t >= ts[i + 1]) i++;
    const x = (t - ts[i]) / h[i], x2 = x * x, x3 = x2 * x;
    return (2 * x3 - 3 * x2 + 1) * ys[i] + (x3 - 2 * x2 + x) * h[i] * m[i]
         + (-2 * x3 + 3 * x2) * ys[i + 1] + (x3 - x2) * h[i] * m[i + 1];
  };
}

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
export default function CineCamera({ keys, live = 0, smooth = false }:
  { keys: CineCamKey[]; live?: number | boolean; smooth?: boolean }) {
  const { camera } = useThree();
  const timeRef = useCineTime();
  const lookVec = useRef(new THREE.Vector3());
  const offset = useRef(new THREE.Vector3());
  const amp = live === true ? 1 : (live || 0);

  // modo smooth: UNA curva C1 por componente a través de TODAS las keys
  // (un solo empuje continuo — doctrina de las cápsulas). Ignora `cut`.
  const spline = useMemo(() => {
    if (!smooth || keys.length < 2) return null;
    const ts = keys.map(k => k.t);
    return {
      px: pchip(ts, keys.map(k => k.pos[0])), py: pchip(ts, keys.map(k => k.pos[1])), pz: pchip(ts, keys.map(k => k.pos[2])),
      lx: pchip(ts, keys.map(k => k.look[0])), ly: pchip(ts, keys.map(k => k.look[1])), lz: pchip(ts, keys.map(k => k.look[2])),
      t0: ts[0], t1: ts[ts.length - 1],
    };
  }, [keys, smooth]);

  useFrame(() => {
    if (keys.length === 0) return;
    const t = timeRef.current;
    let progress = 0;                                        // avance del pushIn (continuo)
    if (spline) {
      camera.position.set(spline.px(t), spline.py(t), spline.pz(t));
      lookVec.current.set(spline.lx(t), spline.ly(t), spline.lz(t));
      progress = Math.max(0, Math.min(1, (t - spline.t0) / Math.max(1e-3, spline.t1 - spline.t0)));
    } else {
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
      progress = localE;
    }

    if (amp > 0) {
      // vector look→cámara; lo giramos/escalamos para orbitar y respirar
      offset.current.subVectors(camera.position, lookVec.current);
      const ang = Math.sin(t * 0.16) * 0.07 * amp;            // orbit ±~4°
      offset.current.applyAxisAngle(Y_AXIS, ang);
      // PUSH-IN: acerca ~6% conforme avanza (tensión que sube). En keyframes por
      // segmento esto se RESETEABA en cada key (brinco radial visible); en smooth
      // el avance es GLOBAL → continuo.
      const pushIn = 1 - 0.06 * amp * (spline ? progress : easeInOut(progress));
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
