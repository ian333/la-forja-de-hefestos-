/**
 * SDF 3D VERDADERO DE UNA MALLA — distancia con signo a la superficie de la pieza,
 * evaluada en los centros de una rejilla cartesiana.
 *
 * POR QUÉ EXISTE. `mold-thermal-fdm` venía aproximando la superficie por una LOSA en z
 * por columna: φ = max(zBot − z, z − zTop). Para las dos paredes grandes (cavidad y
 * núcleo, que miran en z) eso es exacto, pero en las paredes LATERALES no hay nada —
 * a la columna vecina sin plástico se le asignaba φ = +celda y el cruce quedaba
 * inventado. Este módulo lo mide de verdad, contra los triángulos.
 *
 * QUÉ ES UN SDF DE VERDAD. No es "un campo que cambia de signo en la superficie":
 * tiene que cumplir la ECUACIÓN EIKONAL |∇φ| = 1 en casi todo punto (falla solo en el
 * eje medial, donde la distancia deja de ser diferenciable). Ése es el invariante que
 * separa un sdf real de una aproximación que "se ve bien" — y es lo que el gate mide.
 *
 * CÓMO:
 *   · SIGNO por PARIDAD de cruces en z. Para cada columna (i,j) se juntan las z donde
 *     la vertical corta la malla; un punto está adentro si arriba de él queda un número
 *     IMPAR de cruces. Exacto para malla cerrada — y ahora tenemos `verificacion/
 *     matricula.ts` para saber si lo está, así que el sdf EXIGE coherencia y lo declara.
 *   · DISTANCIA exacta punto-triángulo, con los triángulos indexados en una rejilla y
 *     búsqueda por anillos crecientes que se corta cuando el anillo ya no puede mejorar.
 *   · BANDA: solo se calcula distancia exacta cerca de la superficie. Lejos, la magnitud
 *     se satura al ancho de banda (el signo sigue siendo correcto). Para la celda
 *     cortada eso basta: lo único que importa es dónde el campo CRUZA cero.
 */

export interface MallaSdf {
  positions: Float32Array | number[];
  indices: Uint32Array | number[];
}

export interface RejillaSdf {
  nx: number; ny: number; nz: number;
  /** paso de celda en mm (cúbica) */
  dxMm: number;
  /** esquina mínima de la rejilla, en mm */
  x0: number; y0: number; z0: number;
}

export interface ResultadoSdf {
  /** distancia con signo en el CENTRO de cada celda, en mm. Negativa adentro. */
  sdf: Float32Array;
  /** ancho de banda con distancia exacta (mm) */
  bandaMm: number;
  /** celdas con distancia EXACTA (dentro de la banda) */
  exactas: number;
  /** celdas saturadas a ±banda (signo correcto, magnitud truncada) */
  saturadas: number;
  /** columnas con número IMPAR de cruces — malla no cerrada por ahí. Se DECLARA:
   *  el signo de esas columnas no es de fiar. */
  columnasImpares: number;
  ms: number;
}

/** distancia² exacta de un punto a un triángulo (Ericson, Real-Time Collision Detection) */
function d2PuntoTri(
  px: number, py: number, pz: number,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
): number {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) return apx * apx + apy * apy + apz * apz;
  const bpx = px - bx, bpy = py - by, bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return bpx * bpx + bpy * bpy + bpz * bpz;
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return cpx * cpx + cpy * cpy + cpz * cpz;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const t = d1 / (d1 - d3);
    const qx = ax + abx * t - px, qy = ay + aby * t - py, qz = az + abz * t - pz;
    return qx * qx + qy * qy + qz * qz;
  }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const t = d2 / (d2 - d6);
    const qx = ax + acx * t - px, qy = ay + acy * t - py, qz = az + acz * t - pz;
    return qx * qx + qy * qy + qz * qz;
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
    const t = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    const qx = bx + (cx - bx) * t - px, qy = by + (cy - by) * t - py, qz = bz + (cz - bz) * t - pz;
    return qx * qx + qy * qy + qz * qz;
  }
  const den = 1 / (va + vb + vc);
  const u = vb * den, v = vc * den;
  const qx = ax + abx * u + acx * v - px, qy = ay + aby * u + acy * v - py, qz = az + abz * u + acz * v - pz;
  return qx * qx + qy * qy + qz * qz;
}

export function sdfDeMalla(mesh: MallaSdf, g: RejillaSdf, o?: { bandaCeldas?: number }): ResultadoSdf {
  const t0 = Date.now();
  const P = mesh.positions, I = mesh.indices;
  const nTri = Math.floor(I.length / 3);
  const { nx, ny, nz, dxMm: h, x0, y0, z0 } = g;
  const N = nx * ny * nz;
  const banda = (o?.bandaCeldas ?? 3) * h;
  const sdf = new Float32Array(N).fill(banda);

  // ── 1 · SIGNO por PARIDAD de cruces en z, por columna ────────────────────
  // Para cada columna se juntan las z donde la vertical (xc, yc) corta un triángulo.
  // Un punto está ADENTRO si arriba de él queda un número IMPAR de cruces.
  const cruces: number[][] = Array.from({ length: nx * ny }, () => []);
  for (let t = 0; t < nTri; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const ax = P[a], ay = P[a + 1], az = P[a + 2];
    const bx = P[b], by = P[b + 1], bz = P[b + 2];
    const cx = P[c], cy = P[c + 1], cz = P[c + 2];
    const mnx = Math.min(ax, bx, cx), mxx = Math.max(ax, bx, cx);
    const mny = Math.min(ay, by, cy), mxy = Math.max(ay, by, cy);
    const i0 = Math.max(0, Math.floor((mnx - x0) / h - 0.5));
    const i1 = Math.min(nx - 1, Math.ceil((mxx - x0) / h - 0.5));
    const j0 = Math.max(0, Math.floor((mny - y0) / h - 0.5));
    const j1 = Math.min(ny - 1, Math.ceil((mxy - y0) / h - 0.5));
    // área con signo de la proyección XY (para las baricéntricas)
    const e = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(e) < 1e-14) continue;                     // triángulo vertical: no cruza
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const qx = x0 + (i + 0.5) * h, qy = y0 + (j + 0.5) * h;
      const l0 = ((bx - qx) * (cy - qy) - (by - qy) * (cx - qx)) / e;
      const l1 = ((cx - qx) * (ay - qy) - (cy - qy) * (ax - qx)) / e;
      const l2 = 1 - l0 - l1;
      if (l0 < 0 || l1 < 0 || l2 < 0) continue;
      cruces[j * nx + i].push(l0 * az + l1 * bz + l2 * cz);
    }
  }
  let impares = 0;
  for (const zs of cruces) { zs.sort((p, q) => p - q); if (zs.length % 2 === 1) impares++; }

  // ── 2 · DISTANCIA exacta en una BANDA alrededor de la superficie ─────────
  // Los triángulos se indexan en la MISMA rejilla; para cada celda se buscan los de
  // los anillos vecinos y se corta cuando el anillo ya no puede mejorar la distancia.
  const bin = new Map<number, number[]>();
  const kb = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  const cl = (v: number, m: number) => Math.min(m - 1, Math.max(0, v));
  for (let t = 0; t < nTri; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const i0 = cl(Math.floor((Math.min(P[a], P[b], P[c]) - x0) / h), nx);
    const i1 = cl(Math.floor((Math.max(P[a], P[b], P[c]) - x0) / h), nx);
    const j0 = cl(Math.floor((Math.min(P[a + 1], P[b + 1], P[c + 1]) - y0) / h), ny);
    const j1 = cl(Math.floor((Math.max(P[a + 1], P[b + 1], P[c + 1]) - y0) / h), ny);
    const k0 = cl(Math.floor((Math.min(P[a + 2], P[b + 2], P[c + 2]) - z0) / h), nz);
    const k1 = cl(Math.floor((Math.max(P[a + 2], P[b + 2], P[c + 2]) - z0) / h), nz);
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const kk = kb(i, j, k);
      const arr = bin.get(kk); if (arr) arr.push(t); else bin.set(kk, [t]);
    }
  }
  const rMax = Math.ceil(banda / h) + 1;
  let exactas = 0, saturadas = 0;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const n = kb(i, j, k);
    const px = x0 + (i + 0.5) * h, py = y0 + (j + 0.5) * h, pz = z0 + (k + 0.5) * h;
    let best = banda * banda;
    for (let r = 0; r <= rMax; r++) {
      // cota inferior de la distancia alcanzable en anillos ≥ r: si ya la superamos,
      // no hay nada que ganar y se corta
      const cota = (r - 1) * h;
      if (r > 0 && cota > 0 && cota * cota >= best) break;
      for (let kk = k - r; kk <= k + r; kk++) for (let jj = j - r; jj <= j + r; jj++) for (let ii = i - r; ii <= i + r; ii++) {
        if (ii < 0 || jj < 0 || kk < 0 || ii >= nx || jj >= ny || kk >= nz) continue;
        if (r > 0 && Math.abs(ii - i) < r && Math.abs(jj - j) < r && Math.abs(kk - k) < r) continue;
        const arr = bin.get(kb(ii, jj, kk)); if (!arr) continue;
        for (const t of arr) {
          const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
          const d2 = d2PuntoTri(px, py, pz,
            P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], P[c], P[c + 1], P[c + 2]);
          if (d2 < best) best = d2;
        }
      }
    }
    const d = Math.sqrt(best);
    if (d >= banda) saturadas++; else exactas++;
    // signo: paridad de cruces por ENCIMA del punto
    const zs = cruces[j * nx + i];
    let arriba = 0;
    for (let q = zs.length - 1; q >= 0 && zs[q] > pz; q--) arriba++;
    sdf[n] = (arriba % 2 === 1) ? -d : d;
  }
  return { sdf, bandaMm: banda, exactas, saturadas, columnasImpares: impares, ms: Date.now() - t0 };
}
