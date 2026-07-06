/**
 * CAM · ROSCADO (tapping) — libro Cimo cap 9 (última operación del placement 1).
 *
 * El libro: no hay comando dedicado — se usa drilling con Cycle Type = Tapping.
 * Machuelo ISO M8×1.25 sobre los pilotos ⌀6.8; roscar los primeros 20 mm
 * (Bottom Height = tope del barreno − 20). El roscado RÍGIDO exige el ciclo
 * enlatado G84 (husillo y avance SINCRONIZADOS: F = paso × S — expandirlo en
 * G1 sería falso: ninguna máquina rosca así). Emitimos G84 MODAL real:
 * primera línea con todos los words, los demás barrenos solo X/Y, G80 cierra.
 */
import type { DrillHole } from './drill';

export interface TapTool {
  pilotD: number; // ⌀ del piloto taladrado (6.8)
  pitch: number;  // paso de la rosca (1.25)
  rpm: number;    // vueltas del husillo en roscado (lento: ~500)
}

export interface TapParams {
  threadLen: number; // longitud roscada desde el tope del barreno (libro: 20)
  rPlane: number;    // plano R sobre el tope
  safeZ: number;
}

/** Designación ISO: nominal ≈ piloto + paso (6.8 + 1.25 → M8). */
export function threadName(t: TapTool): string {
  return `M${Math.round(t.pilotD + t.pitch)}x${t.pitch}`;
}

export function generateTappingGcode(holes: DrillHole[], t: TapTool, p: TapParams): string {
  if (!holes.length) return '';
  const f = (n: number) => n.toFixed(3).replace(/\.?0+$/, '') || '0';
  const feed = Math.round(t.pitch * t.rpm); // sincronía rígida: F = paso × S
  // mismo orden vecino-más-cercano que el taladrado (misma ruta, otro husillo)
  const rest = holes.slice(1), order = [holes[0]];
  while (rest.length) {
    const cur = order[order.length - 1];
    let bi = 0, bd = Infinity;
    for (let i = 0; i < rest.length; i++) {
      const d = Math.hypot(rest[i].x - cur.x, rest[i].y - cur.y);
      if (d < bd) { bd = d; bi = i; }
    }
    order.push(rest.splice(bi, 1)[0]);
  }
  const zSafe = Math.max(...order.map(h => h.zTop)) + p.safeZ;
  const L: string[] = [
    `(La Forja CAM - ROSCADO ${threadName(t)} x${order.length})`,
    'G21 (mm)', 'G90 (absoluto)', 'G17 (plano XY)',
    `M3 S${Math.round(t.rpm)}`,
    `G0 X${f(order[0].x)} Y${f(order[0].y)} Z${f(zSafe)}`,
    'G98 (retorno al plano inicial)',
  ];
  for (let i = 0; i < order.length; i++) {
    const h = order[i];
    const zBot = h.zTop - p.threadLen, zR = h.zTop + p.rPlane;
    // G84 es MODAL: el primero lleva Z/R/F; los siguientes repiten el ciclo en cada XY
    L.push(i === 0
      ? `G84 X${f(h.x)} Y${f(h.y)} Z${f(zBot)} R${f(zR)} F${feed}`
      : `X${f(h.x)} Y${f(h.y)}`);
  }
  L.push('G80 (cancela ciclo)', `G0 Z${f(zSafe)}`, 'M5', 'M30');
  return L.join('\n') + '\n';
}
