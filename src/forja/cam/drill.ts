/**
 * CAM · TALADRADO (drilling) — libro Cimo cap 9 (última sección; el comando viene del cap 5).
 *
 * El libro: broca ⌀6.8 (piloto para rosca M8), preset "Aluminum - Drilling", se pica el
 * primer barreno y "Select Same Diameter" descubre los demás. Barreno pasante profundo
 * (42mm / ⌀6.8 = 6.2×⌀) → ciclo PECK (G83) que aquí se emite EXPANDIDO (G0/G1 honestos):
 * picar q, retraer a plano R, bajar en rápido con holgura de re-entrada, repetir.
 * La broca es puntiaguda (118°): para atravesar, la punta baja 0.3·⌀ bajo la cara inferior.
 */
import type { FacingTool, ToolpathSegment } from './facing';

export interface DrillHole {
  x: number; y: number;
  zTop: number;    // cara donde entra la broca
  zBottom: number; // fondo del barreno (cara inferior si es pasante)
  through: boolean;
}

export interface DrillParams {
  peckDepth: number;   // q del ciclo (típico 3×⌀)
  safeZ: number;       // altura de traslado entre barrenos (sobre el zTop más alto)
  rPlane: number;      // plano R: altura de arranque del ciclo sobre zTop del barreno
  reentryGap: number;  // holgura al re-bajar en rápido dentro del barreno (G83: ~0.5mm)
}

/** Ciclo peck por barreno, orden vecino-más-cercano (menos traslado, como ordena Fusion). */
export function generateDrillingToolpath(
  holes: DrillHole[], tool: FacingTool, p: DrillParams,
): ToolpathSegment[] {
  if (!holes.length) return [];
  const segs: ToolpathSegment[] = [];
  const zSafe = Math.max(...holes.map(h => h.zTop)) + p.safeZ;
  // orden vecino-más-cercano desde el primero
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
  let prev: [number, number, number] | null = null;
  for (const h of order) {
    const zR = h.zTop + p.rPlane;
    const zEnd = h.zBottom - (h.through ? 0.3 * tool.diameter : 0); // punta 118° libra la cara
    const at: [number, number, number] = [h.x, h.y, zSafe];
    segs.push({ kind: 'rapid', from: prev ?? at, to: at });
    segs.push({ kind: 'rapid', from: at, to: [h.x, h.y, zR] });
    let z = zR;
    while (z > zEnd + 1e-9) {
      const zq = Math.max(zEnd, z - p.peckDepth);
      segs.push({ kind: 'plunge', from: [h.x, h.y, z], to: [h.x, h.y, zq] });
      if (zq > zEnd + 1e-9) { // retracción total + re-bajada con holgura (G83)
        segs.push({ kind: 'rapid', from: [h.x, h.y, zq], to: [h.x, h.y, zR] });
        segs.push({ kind: 'rapid', from: [h.x, h.y, zR], to: [h.x, h.y, zq + p.reentryGap] });
        z = zq + p.reentryGap;
      } else z = zq;
    }
    segs.push({ kind: 'rapid', from: [h.x, h.y, zEnd], to: [h.x, h.y, zSafe] });
    prev = [h.x, h.y, zSafe];
  }
  return segs;
}

/**
 * "Select Same Diameter" sobre la malla: encuentra caras que son PAREDES de barreno
 * vertical (normales horizontales, huella cuadrada ⌀×⌀) con ⌀ ≈ objetivo (±15%).
 * Devuelve los barrenos (centro + zTop/zBottom + pasante vs zBottom del sólido).
 */
export function detectHolesFromMesh(
  mesh: { positions: Float32Array | number[]; normals: Float32Array | number[]; indices: Uint32Array | number[]; faceIds: Uint32Array | number[] },
  targetD: number,
): DrillHole[] {
  const ids = Array.from(new Set(Array.from(mesh.faceIds as ArrayLike<number>)));
  let solidZ0 = Infinity;
  for (let i = 2; i < mesh.positions.length; i += 3) solidZ0 = Math.min(solidZ0, mesh.positions[i] as number);
  const holes: DrillHole[] = [];
  for (const id of ids) {
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    let nzAbs = 0, cnt = 0;
    for (let t = 0; t < mesh.faceIds.length; t++) {
      if (mesh.faceIds[t] !== id) continue;
      for (let k = 0; k < 3; k++) {
        const vi = mesh.indices[t * 3 + k] as number;
        const X = mesh.positions[vi * 3] as number, Y = mesh.positions[vi * 3 + 1] as number, Z = mesh.positions[vi * 3 + 2] as number;
        if (X < mnx) mnx = X; if (X > mxx) mxx = X;
        if (Y < mny) mny = Y; if (Y > mxy) mxy = Y;
        if (Z < mnz) mnz = Z; if (Z > mxz) mxz = Z;
        nzAbs += Math.abs(mesh.normals[vi * 3 + 2] as number); cnt++;
      }
    }
    if (!cnt || nzAbs / cnt > 0.3) continue;               // pared vertical (normales horizontales)
    const w = mxx - mnx, d = mxy - mny;
    if (Math.abs(w - d) > 0.15 * targetD) continue;         // huella cuadrada = cilindro completo
    const dia = Math.max(w, d);
    if (Math.abs(dia - targetD) > 0.15 * targetD) continue; // mismo diámetro (±15%)
    holes.push({
      x: (mnx + mxx) / 2, y: (mny + mxy) / 2, zTop: mxz, zBottom: mnz,
      through: mnz <= solidZ0 + 0.5,
    });
  }
  return holes;
}
