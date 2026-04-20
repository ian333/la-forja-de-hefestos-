/**
 * PCA projection N×D → N×3 for small D (≤64). Uses Jacobi eigendecomposition
 * of the D×D centered covariance because D is tiny; N can be millions since we
 * only sweep the matrix twice (mean + covariance) and once more for the
 * projection.
 *
 * The projection is deterministic but sign-ambiguous on each axis — we flip
 * each axis so the entry with largest |value| is positive, which keeps PCA
 * views stable across brain reloads (as long as the underlying positions are).
 */

function jacobiEigen(A: Float64Array, n: number): { vals: Float64Array; vecs: Float64Array } {
  const a = new Float64Array(A);
  const v = new Float64Array(n * n);
  for (let i = 0; i < n; i++) v[i * n + i] = 1;

  const MAX_SWEEPS = 80;
  for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) off += Math.abs(a[p * n + q]);
    if (off < 1e-12) break;

    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p * n + q];
        if (Math.abs(apq) < 1e-14) continue;
        const app = a[p * n + p];
        const aqq = a[q * n + q];
        const theta = (aqq - app) / (2 * apq);
        const t = theta >= 0
          ? 1 / (theta + Math.sqrt(1 + theta * theta))
          : 1 / (theta - Math.sqrt(1 + theta * theta));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;

        a[p * n + p] = app - t * apq;
        a[q * n + q] = aqq + t * apq;
        a[p * n + q] = 0;
        a[q * n + p] = 0;
        for (let r = 0; r < n; r++) {
          if (r !== p && r !== q) {
            const arp = a[r * n + p];
            const arq = a[r * n + q];
            a[r * n + p] = c * arp - s * arq;
            a[p * n + r] = a[r * n + p];
            a[r * n + q] = s * arp + c * arq;
            a[q * n + r] = a[r * n + q];
          }
          const vrp = v[r * n + p];
          const vrq = v[r * n + q];
          v[r * n + p] = c * vrp - s * vrq;
          v[r * n + q] = s * vrp + c * vrq;
        }
      }
    }
  }

  const vals = new Float64Array(n);
  for (let i = 0; i < n; i++) vals[i] = a[i * n + i];
  return { vals, vecs: v };
}

export interface Pca3dResult {
  /** Projected coords, length N*3. */
  xyz: Float32Array;
  /** Fraction of variance captured by the top-3 components. */
  variance_explained: number;
  /** Bounding box diagonal after projection, handy for camera framing. */
  diag: number;
}

/**
 * Project row-major flat[n*d] to 3D with PCA. Returns a new Float32Array.
 * Centering is in-place on a copy — input is not mutated.
 */
export function pca3d(flat: ArrayLike<number>, n: number, d: number): Pca3dResult {
  if (d < 3) {
    // Pad to 3D by zero-filling missing axes; still useful for 2D positions.
    const xyz = new Float32Array(n * 3);
    for (let i = 0; i < n; i++)
      for (let k = 0; k < d; k++) xyz[i * 3 + k] = flat[i * d + k];
    return { xyz, variance_explained: 1, diag: boundingDiag(xyz) };
  }

  // 1. Mean.
  const mean = new Float64Array(d);
  for (let i = 0; i < n; i++)
    for (let k = 0; k < d; k++) mean[k] += flat[i * d + k];
  for (let k = 0; k < d; k++) mean[k] /= n;

  // 2. Covariance D×D (symmetric, 1/(n-1) scaling).
  const cov = new Float64Array(d * d);
  const norm = Math.max(1, n - 1);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < d; a++) {
      const va = flat[i * d + a] - mean[a];
      for (let b = a; b < d; b++) {
        const vb = flat[i * d + b] - mean[b];
        cov[a * d + b] += va * vb;
      }
    }
  }
  for (let a = 0; a < d; a++) {
    for (let b = a; b < d; b++) {
      cov[a * d + b] /= norm;
      cov[b * d + a] = cov[a * d + b];
    }
  }

  // 3. Eigendecompose and pick top-3 by |val|.
  const { vals, vecs } = jacobiEigen(cov, d);
  const idx = Array.from({ length: d }, (_, i) => i).sort(
    (i, j) => Math.abs(vals[j]) - Math.abs(vals[i]),
  );
  const top = idx.slice(0, 3);
  let total = 0;
  let captured = 0;
  for (let i = 0; i < d; i++) total += Math.abs(vals[i]);
  for (const i of top) captured += Math.abs(vals[i]);
  const variance_explained = total > 0 ? captured / total : 0;

  // 4. Project. xyz[i,:] = (x[i] - mean) · V[:, top[0..2]]
  const xyz = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    for (let axis = 0; axis < 3; axis++) {
      const col = top[axis];
      let s = 0;
      for (let k = 0; k < d; k++) s += (flat[i * d + k] - mean[k]) * vecs[k * d + col];
      xyz[i * 3 + axis] = s;
    }
  }

  // 5. Sign-stabilize each axis (largest |value| positive).
  for (let axis = 0; axis < 3; axis++) {
    let maxAbs = 0;
    let maxVal = 0;
    for (let i = 0; i < n; i++) {
      const v = xyz[i * 3 + axis];
      if (Math.abs(v) > maxAbs) { maxAbs = Math.abs(v); maxVal = v; }
    }
    if (maxVal < 0) {
      for (let i = 0; i < n; i++) xyz[i * 3 + axis] = -xyz[i * 3 + axis];
    }
  }

  return { xyz, variance_explained, diag: boundingDiag(xyz) };
}

function boundingDiag(xyz: Float32Array): number {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < xyz.length; i += 3) {
    const x = xyz[i], y = xyz[i + 1], z = xyz[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const dx = maxX - minX, dy = maxY - minY, dz = maxZ - minZ;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
