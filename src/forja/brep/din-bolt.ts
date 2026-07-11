/**
 * ⚒️ La Forja — TORNILLO DIN 933 SÓLIDO (cabeza hex + cuerda real)
 * ================================================================
 * El puente entre el catálogo (src/lib/parts/fasteners: 942 SKUs con las cotas
 * LITERALES de la norma — llave s, cabeza k, paso) y el kernel OCCT. No se
 * dibuja un tornillo: SE INVOCA por su designación — "DIN 933 M12×20" — y sale
 * con su entrecaras exacta (¡la llave del 19!) y su cuerda helicoidal real.
 */

import { HEX_HEAD, THREAD, type MetricSize } from '../../lib/parts/fasteners/din';
import { extrudePolygon, fuse, type OC, type Shape, type Pt2 } from './occt';
import { makeThreadedRod } from './thread';

export interface DinBoltInfo { d: number; pitch: number; s: number; k: number; desig: string }

export function dinBoltInfo(size: MetricSize, length: number): DinBoltInfo {
  const t = THREAD[size], h = HEX_HEAD[size];
  return { d: t.d, pitch: t.pitch, s: h.s, k: h.k, desig: `DIN 933 ${size}×${length}` };
}

/** Tornillo DIN 933: vástago roscado (0..length) + cabeza hexagonal encima.
 *  El hexágono se construye por ENTRECARAS (s de la norma): R = s/√3. */
export function makeDinBolt(oc: OC, size: MetricSize, length: number): Shape {
  const { d, pitch, s, k } = dinBoltInfo(size, length);
  const rod = makeThreadedRod(oc, d, pitch, length);
  const R = s / Math.sqrt(3);
  const pts: Pt2[] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;   // cara plana hacia +x (llave)
    pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) });
  }
  const head = extrudePolygon(oc, pts, k, { origin: [0, 0, length], uDir: [1, 0, 0], vDir: [0, 1, 0] });
  return fuse(oc, rod, head);
}
