/**
 * ISOSUPERFICIES por MARCHING TETRAHEDRA — la "burbuja de calor" 3D del molde.
 * Cada celda del grid se parte en 6 tetraedros; cada tetraedro con el nivel
 * adentro aporta 1-2 triángulos con vértices interpolados linealmente sobre las
 * aristas que cruzan el nivel. Sin tablas de 256 casos (eso es marching cubes):
 * los 16 casos del tetraedro se enumeran directo. Puro, sin three.js — testeable
 * en node (esfera analítica → área ≈ 4πr²).
 */

export interface IsoMesh { positions: Float32Array; normals: Float32Array }

/** los 6 tetraedros del cubo unitario (índices a las 8 esquinas) */
const TETS: number[][] = [
  [0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6],
  [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6],
];
const CORNER: Array<[number, number, number]> = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];

/** extrae la isosuperficie f=level de un campo escalar en grid regular.
 *  `field(n)` indexado n=(k·ny+j)·nx+i; celda física `cell` mm; origen (x0,y0,z0). */
export function isoSurface(
  field: Float32Array, nx: number, ny: number, nz: number,
  level: number, cell: number, x0 = 0, y0 = 0, z0 = 0,
): IsoMesh {
  const pos: number[] = [];
  const idx = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  const vert = (i: number, j: number, k: number): [number, number, number, number] =>
    [x0 + i * cell, y0 + j * cell, z0 + k * cell, field[idx(Math.min(i, nx - 1), Math.min(j, ny - 1), Math.min(k, nz - 1))]];
  // nota: el campo vive en CENTROS de celda; tratamos índices como nodos (offset ½
  // celda constante — irrelevante para la forma del cascarón)
  for (let k = 0; k + 1 < nz; k++) for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) {
    // valores en las 8 esquinas de la celda
    const V: Array<[number, number, number, number]> = CORNER.map(([di, dj, dk]) => vert(i + di, j + dj, k + dk));
    // ¿el nivel cruza la celda? (rechazo rápido)
    let below = 0;
    for (const v of V) if (v[3] < level) below++;
    if (below === 0 || below === 8) continue;
    for (const tet of TETS) {
      const t = tet.map((c) => V[c]);
      const inside = t.map((v) => v[3] >= level);
      const nIn = inside.filter(Boolean).length;
      if (nIn === 0 || nIn === 4) continue;
      // aristas que cruzan: interpola el punto del nivel
      const cross: Array<[number, number, number]> = [];
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
        if (inside[a] === inside[b]) continue;
        const va = t[a], vb = t[b];
        const s = (level - va[3]) / (vb[3] - va[3] || 1e-12);
        cross.push([va[0] + s * (vb[0] - va[0]), va[1] + s * (vb[1] - va[1]), va[2] + s * (vb[2] - va[2])]);
      }
      if (cross.length === 3) {
        pos.push(...cross[0], ...cross[1], ...cross[2]);
      } else if (cross.length === 4) {
        // cuadrilátero → 2 triángulos; ordenar por ángulo alrededor del centroide
        const cx = (cross[0][0] + cross[1][0] + cross[2][0] + cross[3][0]) / 4;
        const cy = (cross[0][1] + cross[1][1] + cross[2][1] + cross[3][1]) / 4;
        const cz = (cross[0][2] + cross[1][2] + cross[2][2] + cross[3][2]) / 4;
        // base ortonormal del plano aproximado
        const e1 = [cross[0][0] - cx, cross[0][1] - cy, cross[0][2] - cz];
        const l1 = Math.hypot(...e1) || 1; e1[0] /= l1; e1[1] /= l1; e1[2] /= l1;
        const dif = [cross[1][0] - cx, cross[1][1] - cy, cross[1][2] - cz];
        const nrm = [e1[1] * dif[2] - e1[2] * dif[1], e1[2] * dif[0] - e1[0] * dif[2], e1[0] * dif[1] - e1[1] * dif[0]];
        const ln = Math.hypot(...nrm) || 1;
        const e2 = [(nrm[1] * e1[2] - nrm[2] * e1[1]) / ln, (nrm[2] * e1[0] - nrm[0] * e1[2]) / ln, (nrm[0] * e1[1] - nrm[1] * e1[0]) / ln];
        const sorted = cross.map((p) => {
          const dx = p[0] - cx, dy = p[1] - cy, dz = p[2] - cz;
          return { p, a: Math.atan2(dx * e2[0] + dy * e2[1] + dz * e2[2], dx * e1[0] + dy * e1[1] + dz * e1[2]) };
        }).sort((a, b) => a.a - b.a).map((q) => q.p);
        pos.push(...sorted[0], ...sorted[1], ...sorted[2], ...sorted[0], ...sorted[2], ...sorted[3]);
      }
    }
  }
  const positions = new Float32Array(pos);
  // normales por GRADIENTE del campo (suaves, apuntan hacia el nivel alto)
  const normals = new Float32Array(positions.length);
  const sampleF = (x: number, y: number, z: number) => {
    const i = Math.max(0, Math.min(nx - 1, Math.round((x - x0) / cell)));
    const j = Math.max(0, Math.min(ny - 1, Math.round((y - y0) / cell)));
    const k = Math.max(0, Math.min(nz - 1, Math.round((z - z0) / cell)));
    return field[idx(i, j, k)];
  };
  for (let n = 0; n < positions.length; n += 3) {
    const x = positions[n], y = positions[n + 1], zc = positions[n + 2];
    const gx = sampleF(x + cell, y, zc) - sampleF(x - cell, y, zc);
    const gy = sampleF(x, y + cell, zc) - sampleF(x, y - cell, zc);
    const gz = sampleF(x, y, zc + cell) - sampleF(x, y, zc - cell);
    const l = Math.hypot(gx, gy, gz) || 1;
    normals[n] = gx / l; normals[n + 1] = gy / l; normals[n + 2] = gz / l;
  }
  return { positions, normals };
}

/** área total de la malla (para el gate: esfera → 4πr²). */
export function isoArea(m: IsoMesh): number {
  let a = 0;
  const P = m.positions;
  for (let t = 0; t + 8 < P.length; t += 9) {
    const ux = P[t + 3] - P[t], uy = P[t + 4] - P[t + 1], uz = P[t + 5] - P[t + 2];
    const vx = P[t + 6] - P[t], vy = P[t + 7] - P[t + 1], vz = P[t + 8] - P[t + 2];
    a += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  }
  return a;
}
