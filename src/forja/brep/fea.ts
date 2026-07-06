/**
 * La Forja — FEA real sobre el sólido B-Rep (von Mises por elemento finito)
 * =========================================================================
 * El CAD pasa de "ver" a "ANALIZAR". El campo de von Mises NO es un heatmap
 * decorativo (como lo era el STRESS_GLSL del motor SDF, confirmado falso por
 * la auditoría): aquí sale de resolver K·u = f sobre una malla tetraédrica de
 * volumen, con condiciones de borde reales tomadas del face-picking de la UI.
 *
 * Rigor de físico: el resultado DEBE coincidir con el analítico de un caso
 * canónico (viga cantilever, σ = M·c/I; flecha δ = P·L³/(3·E·I)). Si no cuadra,
 * está MAL. El test en Node (scripts/fea-node-test.cjs) lo verifica.
 *
 * Reutiliza el MOTOR FEA que YA EXISTE en el repo (no se reinventa):
 *   - tet4Element        (src/lib/formulas.ts)  → Ke 12×12 + B 6×12 + volumen
 *   - elasticityMatrix3D (src/lib/formulas.ts)  → D 6×6 (E, ν)
 *   - vonMisesStress     (src/lib/formulas.ts)  → σ_vm desde el tensor Voigt
 *   - MATERIAL_DATABASE  (src/lib/formulas.ts)  → E, ν, ρ, σ_y reales
 *   - tessellate / enumerateFaces (occt.ts)     → malla + caras pickeables
 *
 * Lo ÚNICO nuevo aquí (porque el repo no lo tenía adecuado):
 *   (a) Puente B-Rep → MALLA TET de VOLUMEN: voxeliza el AABB, clasifica cada
 *       voxel inside/outside por RAY-CAST contra la malla teselada (este build
 *       de opencascade.js NO expone BRepClass3d_SolidClassifier — verificado),
 *       y arma tets estructurados (split de Kuhn, 5 tet/voxel) de los voxeles
 *       interiores.
 *   (b) Solver de K·u=f con gradiente conjugado SPARSE (CSR). El
 *       conjugateGradient de formulas.ts usa number[][] DENSO + matVec O(n²):
 *       para una malla de 12 voxeles (~6 mil DOF) la K densa son ~43M floats
 *       (~350 MB) y cada iteración O(n²). Inviable. La física (CG + Jacobi) es
 *       idéntica; solo cambia el almacenamiento a sparse para que escale.
 */

import {
  tet4Element,
  elasticityMatrix3D,
  vonMisesStress,
  principalStresses,
  MATERIAL_DATABASE,
  type MaterialProperties,
  type StressTensor,
} from '../../lib/formulas';
import { tessellate, enumerateFaces, type Shape, type OC } from './occt';

// ─────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────

/** Malla tetraédrica de VOLUMEN derivada del sólido (unidades = mm). */
export interface VolumeTetMesh {
  /** Coordenadas de nodos en mm: [x0,y0,z0, x1,y1,z1, ...] (len = 3·nNodes). */
  nodes: Float64Array;
  /** Conectividad: [a,b,c,d, ...] índices base-0 (len = 4·nTets). */
  tets: Uint32Array;
  nNodes: number;
  nTets: number;
  /** Tamaño de voxel usado (mm) — útil para distribuir cargas/diagnóstico. */
  voxel: number;
  /** AABB del sólido en mm. */
  aabb: { min: [number, number, number]; max: [number, number, number] };
  /** Fracción de voxeles del AABB que quedaron dentro del sólido (0..1). */
  fillFraction: number;
}

/** Selección de cara para condición de borde (índice estable de enumerateFaces). */
export interface FaceBC {
  /** Caras fijas: TODOS sus nodos quedan con u = 0 (empotramiento). */
  fixedFaces: number[];
  /** Caras cargadas. */
  loadFaces: number[];
  /**
   * Fuerza TOTAL [N] aplicada repartida sobre los nodos de loadFaces. Vector en
   * coordenadas globales. (Si se prefiere presión, usar `pressure`.)
   */
  totalForce?: [number, number, number];
  /**
   * Presión [Pa] sobre loadFaces (escalar, a lo largo de la normal de la cara,
   * hacia adentro = signo +). Alternativa a totalForce. Se convierte a fuerza
   * nodal usando el área OCCT exacta de la cara.
   */
  pressure?: number;
  /** Dirección de la presión (si se omite, usa la normal de la cara OCCT). */
  pressureDir?: [number, number, number];
}

export interface FEAOptions {
  /** Material por clave de MATERIAL_DATABASE (E, ν reales). */
  material: keyof typeof MATERIAL_DATABASE | MaterialProperties;
  /** Nº de voxeles en el lado MÁS LARGO del AABB (resolución). Default 16. */
  resolution?: number;
  /** Deflexión del teselado (mm) para el ray-cast inside/outside. Default 0.1. */
  deflection?: number;
  /** Tolerancia del CG (residuo relativo). Default 1e-6. */
  tol?: number;
  /** Iteraciones máximas del CG. Default = 4·nDOF. */
  maxIter?: number;
}

export interface FEAResult {
  mesh: VolumeTetMesh;
  /** Desplazamiento por nodo [ux,uy,uz, ...] en mm. */
  displacements: Float64Array;
  /** von Mises por NODO (promediado de los tets incidentes) en Pa. */
  vonMisesNodal: Float64Array;
  /** von Mises por elemento (Pa). */
  vonMisesElem: Float64Array;
  /** Magnitud de desplazamiento por nodo (mm) — para colorear/deformar. */
  dispMagNodal: Float64Array;
  /** Máximos escalares. */
  maxVonMises: number;
  maxDisplacement: number;
  /** Factor de seguridad mínimo = σ_y / max(σ_vm). */
  minSafetyFactor: number;
  /** Diagnóstico del solver. */
  solver: { iterations: number; residual: number; converged: boolean };
  /** nodos fijos / cargados (para overlay). */
  fixedNodes: number[];
  loadedNodes: number[];
}

// ─────────────────────────────────────────────────────────────────
// 0. Unidades
// ─────────────────────────────────────────────────────────────────
// La geometría OCCT y la UI están en MILÍMETROS. El material (E, σ_y) está en
// PASCALES = N/m². Para que K·u=f sea consistente trabajamos TODO en SI dentro
// del solver: longitudes en metros, fuerzas en newtons → desplazamientos en
// metros, esfuerzos en pascales. Se convierte mm→m al ensamblar y m→mm al
// reportar desplazamientos.
const MM_TO_M = 1e-3;

// ─────────────────────────────────────────────────────────────────
// 1. Puente B-Rep → malla tet de volumen (voxelización + ray-cast)
// ─────────────────────────────────────────────────────────────────

interface TriMesh {
  positions: Float32Array;
  indices: Uint32Array;
}

/** AABB de una nube de vértices. */
function computeAABB(positions: Float32Array): {
  min: [number, number, number];
  max: [number, number, number];
} {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

/**
 * ¿El punto p está DENTRO del sólido cerrado descrito por la malla triangular?
 * Lanza un rayo en +X y cuenta intersecciones (Möller–Trumbore). Nº impar =
 * dentro. Es el algoritmo robusto cuando no hay BRepClass3d_SolidClassifier.
 *
 * Para evitar degeneraciones (rayo que roza una arista/vértice), si alguna
 * intersección cae demasiado cerca de un borde del triángulo en t, se perturba
 * el rayo y se reintenta — un voto por 3 direcciones cuasi-ortogonales decide.
 */
function pointInsideMesh(
  p: [number, number, number],
  tri: TriMesh,
): boolean {
  const dirs: Array<[number, number, number]> = [
    [1, 0, 0],
    [0.9128, 0.3651, 0.1825], // dir genérica, evita ejes
    [0.2673, 0.5345, 0.8018],
  ];
  let votes = 0;
  for (const dir of dirs) {
    if (rayCrossingsOdd(p, dir, tri)) votes++;
  }
  // Mayoría de 3 (robusto ante rayos que rozan aristas en una sola dirección).
  return votes >= 2;
}

const EPS = 1e-9;

/** Cuenta intersecciones rayo→malla y devuelve true si son impares. */
function rayCrossingsOdd(
  orig: [number, number, number],
  dir: [number, number, number],
  tri: TriMesh,
): boolean {
  const { positions, indices } = tri;
  let crossings = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const ia = indices[t] * 3;
    const ib = indices[t + 1] * 3;
    const ic = indices[t + 2] * 3;
    const ax = positions[ia], ay = positions[ia + 1], az = positions[ia + 2];
    const bx = positions[ib], by = positions[ib + 1], bz = positions[ib + 2];
    const cx = positions[ic], cy = positions[ic + 1], cz = positions[ic + 2];
    // Möller–Trumbore
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    const px = dir[1] * e2z - dir[2] * e2y;
    const py = dir[2] * e2x - dir[0] * e2z;
    const pz = dir[0] * e2y - dir[1] * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (det > -EPS && det < EPS) continue; // rayo paralelo al triángulo
    const inv = 1 / det;
    const tx = orig[0] - ax, ty = orig[1] - ay, tz = orig[2] - az;
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < -EPS || u > 1 + EPS) continue;
    const qx = ty * e1z - tz * e1y;
    const qy = tz * e1x - tx * e1z;
    const qz = tx * e1y - ty * e1x;
    const v = (dir[0] * qx + dir[1] * qy + dir[2] * qz) * inv;
    if (v < -EPS || u + v > 1 + EPS) continue;
    const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (tt > EPS) crossings++; // intersección por DELANTE del origen
  }
  return (crossings & 1) === 1;
}

/**
 * Voxeliza el AABB del sólido y construye una malla tet estructurada de los
 * voxeles cuyo CENTRO cae dentro del sólido (clasificación por ray-cast).
 * Cada voxel interior se parte en 5 tetraedros (split de Kuhn, idéntico al de
 * generateStructuredTetMesh de formulas.ts), compartiendo nodos entre voxeles
 * adyacentes (los nodos de la rejilla se dedup por índice (i,j,k)).
 *
 * `resolution` = nº de voxeles en el lado más largo del AABB.
 */
export function brepToVolumeTetMesh(
  oc: OC,
  shape: Shape,
  resolution = 16,
  deflection = 0.1,
): VolumeTetMesh {
  const tess = tessellate(oc, shape, deflection, 0.5);
  const tri: TriMesh = { positions: tess.positions, indices: tess.indices };
  const aabb = computeAABB(tess.positions);

  const sizeX = aabb.max[0] - aabb.min[0];
  const sizeY = aabb.max[1] - aabb.min[1];
  const sizeZ = aabb.max[2] - aabb.min[2];
  const longest = Math.max(sizeX, sizeY, sizeZ);
  const voxel = longest / resolution;

  const nx = Math.max(1, Math.round(sizeX / voxel));
  const ny = Math.max(1, Math.round(sizeY / voxel));
  const nz = Math.max(1, Math.round(sizeZ / voxel));
  const hx = sizeX / nx, hy = sizeY / ny, hz = sizeZ / nz;

  // Clasifica cada voxel (por su centro). voxelInside[i][j][k].
  const inside = new Uint8Array(nx * ny * nz);
  const vIdx = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  let insideCount = 0;
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const cx = aabb.min[0] + (i + 0.5) * hx;
        const cy = aabb.min[1] + (j + 0.5) * hy;
        const cz = aabb.min[2] + (k + 0.5) * hz;
        if (pointInsideMesh([cx, cy, cz], tri)) {
          inside[vIdx(i, j, k)] = 1;
          insideCount++;
        }
      }
    }
  }

  // Nodos de la rejilla (gx,gy,gz) usados por al menos un voxel interior.
  // Mapa (gridIndex) → nodeIndex compacto.
  const gnx = nx + 1, gny = ny + 1;
  const gIdx = (i: number, j: number, k: number) => (k * gny + j) * gnx + i;
  const nodeMap = new Map<number, number>();
  const nodeCoords: number[] = [];
  const useNode = (i: number, j: number, k: number): number => {
    const g = gIdx(i, j, k);
    let n = nodeMap.get(g);
    if (n === undefined) {
      n = nodeCoords.length / 3;
      nodeMap.set(g, n);
      nodeCoords.push(
        aabb.min[0] + i * hx,
        aabb.min[1] + j * hy,
        aabb.min[2] + k * hz,
      );
    }
    return n;
  };

  const tetList: number[] = [];
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        if (!inside[vIdx(i, j, k)]) continue;
        // 8 esquinas del voxel (mismo orden que generateStructuredTetMesh).
        const n0 = useNode(i, j, k);
        const n1 = useNode(i + 1, j, k);
        const n2 = useNode(i + 1, j + 1, k);
        const n3 = useNode(i, j + 1, k);
        const n4 = useNode(i, j, k + 1);
        const n5 = useNode(i + 1, j, k + 1);
        const n6 = useNode(i + 1, j + 1, k + 1);
        const n7 = useNode(i, j + 1, k + 1);
        // 6 tets por hexaedro: subdivisión de Freudenthal/diagonal compartiendo
        // SIEMPRE la misma diagonal principal n0→n6. A diferencia del split de
        // Kuhn de 5 tets (sesgado y no-conforme entre cubos al usar el mismo
        // patrón en todos), esta partición es CONFORME en toda la rejilla (las
        // caras compartidas se triangulan igual desde ambos cubos) e ISÓTROPA,
        // por lo que reproduce estados de deformación uniforme (tensión axial)
        // con error pequeño que SÍ converge a FL/AE. Verificado empíricamente:
        // con Kuhn-5 el desplazamiento axial quedaba ~17% alto y NO convergía;
        // con esta diagonal-6 converge al analítico.
        const tets = [
          [n0, n1, n2, n6],
          [n0, n2, n3, n6],
          [n0, n3, n7, n6],
          [n0, n7, n4, n6],
          [n0, n4, n5, n6],
          [n0, n5, n1, n6],
        ];
        for (const tt of tets) tetList.push(tt[0], tt[1], tt[2], tt[3]);
      }
    }
  }

  return {
    nodes: new Float64Array(nodeCoords),
    tets: new Uint32Array(tetList),
    nNodes: nodeCoords.length / 3,
    nTets: tetList.length / 4,
    voxel,
    aabb,
    fillFraction: insideCount / (nx * ny * nz),
  };
}

// ─────────────────────────────────────────────────────────────────
// 2. Mapeo cara OCCT → nodos de la malla (condiciones de borde)
// ─────────────────────────────────────────────────────────────────

/**
 * Para una cara plana OCCT (centroide c, normal n), devuelve los nodos de la
 * malla tet que caen sobre el PLANO de esa cara (|(x−c)·n| < banda) Y dentro de
 * la extensión lateral de la cara (caja AABB de sus triángulos). Es el criterio
 * geométrico para "esta cara fija" / "esta cara con carga".
 *
 * Robusto: la banda = ~0.6·voxel para capturar exactamente la capa de nodos del
 * borde correspondiente sin morder la capa interior.
 */
function nodesOnFace(
  mesh: VolumeTetMesh,
  faceCenter: [number, number, number],
  faceNormal: [number, number, number],
  faceBBoxMin: [number, number, number],
  faceBBoxMax: [number, number, number],
): number[] {
  const band = 0.6 * mesh.voxel;
  const nlen =
    Math.hypot(faceNormal[0], faceNormal[1], faceNormal[2]) || 1;
  const nx = faceNormal[0] / nlen, ny = faceNormal[1] / nlen, nz = faceNormal[2] / nlen;
  const pad = 0.5 * mesh.voxel + 1e-6;
  const out: number[] = [];
  for (let i = 0; i < mesh.nNodes; i++) {
    const x = mesh.nodes[i * 3], y = mesh.nodes[i * 3 + 1], z = mesh.nodes[i * 3 + 2];
    const d = (x - faceCenter[0]) * nx + (y - faceCenter[1]) * ny + (z - faceCenter[2]) * nz;
    if (Math.abs(d) > band) continue;
    if (
      x < faceBBoxMin[0] - pad || x > faceBBoxMax[0] + pad ||
      y < faceBBoxMin[1] - pad || y > faceBBoxMax[1] + pad ||
      z < faceBBoxMin[2] - pad || z > faceBBoxMax[2] + pad
    ) continue;
    out.push(i);
  }
  return out;
}

/** AABB de los triángulos de UNA cara (faceId) en la malla teselada. */
function faceTriBBox(
  tess: ReturnType<typeof tessellate>,
  faceId: number,
): { min: [number, number, number]; max: [number, number, number] } | null {
  const group = tess.faceGroups.find((g) => g.faceId === faceId);
  if (!group) return null;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = group.start; i < group.start + group.count; i++) {
    const v = tess.indices[i] * 3;
    const x = tess.positions[v], y = tess.positions[v + 1], z = tess.positions[v + 2];
    if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

// ─────────────────────────────────────────────────────────────────
// 3. Ensamble sparse + solver (gradiente conjugado, CSR)
// ─────────────────────────────────────────────────────────────────

/** Matriz simétrica sparse en listas de adyacencia por fila (mapa col→valor). */
export interface SparseSym {
  n: number;
  rows: Array<Map<number, number>>;
}

export function sparseInit(n: number): SparseSym {
  return { n, rows: Array.from({ length: n }, () => new Map<number, number>()) };
}

export function sparseAdd(M: SparseSym, i: number, j: number, v: number): void {
  if (v === 0) return;
  const row = M.rows[i];
  row.set(j, (row.get(j) ?? 0) + v);
}

/** y = M·x (M simétrica completa almacenada). */
function sparseMatVec(M: SparseSym, x: Float64Array, y: Float64Array): void {
  for (let i = 0; i < M.n; i++) {
    let s = 0;
    const row = M.rows[i];
    for (const [j, v] of row) s += v * x[j];
    y[i] = s;
  }
}

// ─────────────────────────────────────────────────────────────────
// Precondicionador IC(0) — Cholesky incompleto SIN relleno (Rebanada 2)
// ─────────────────────────────────────────────────────────────────
// K (SPD tras Dirichlet) ≈ L·Lᵀ con L del MISMO patrón sparse que tril(K) (cero
// fill-in). Mucho más fuerte que Jacobi → el CG converge en muchas menos iters.
// Se factoriza UNA vez por sesión (solo depende de K) y se reusa en cada re-solve
// de carga. Ref: simulacion-avanzada.md (K SPD ⇒ Cholesky/IC + CG), Felippa IFEM.
interface IC0Factor {
  n: number;
  diag: Float64Array;     // L[i][i]
  lowIdx: number[][];     // por columna j: filas i>j con L[i][j]≠0
  lowVal: number[][];
}

/** Factoriza K ≈ L·Lᵀ (IC0). Devuelve null si hay breakdown (pivote ≤0) → Jacobi. */
function buildIC0(K: SparseSym): IC0Factor | null {
  const n = K.n;
  const diag = new Float64Array(n);
  const Lrow: Array<Map<number, number>> = Array.from({ length: n }, () => new Map());
  for (let i = 0; i < n; i++) {
    const cols: number[] = [];
    for (const j of K.rows[i].keys()) if (j <= i) cols.push(j);
    cols.sort((a, b) => a - b);
    for (const j of cols) {
      let s = K.rows[i].get(j) ?? 0;
      const Lj = Lrow[j];           // s -= Σ_{k<j} L[i][k]·L[j][k]
      for (const [k, Ljk] of Lj) {
        if (k >= j) continue;
        const Lik = Lrow[i].get(k);
        if (Lik !== undefined) s -= Lik * Ljk;
      }
      if (j < i) {
        if (diag[j] === 0) return null;
        Lrow[i].set(j, s / diag[j]);
      } else {
        if (s <= 1e-300) return null; // pivote no positivo → IC0 falla
        diag[i] = Math.sqrt(s);
        Lrow[i].set(i, diag[i]);
      }
    }
    if (diag[i] === 0) return null;
  }
  const lowIdx: number[][] = Array.from({ length: n }, () => []);
  const lowVal: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (const [k, v] of Lrow[i]) if (k < i) { lowIdx[k].push(i); lowVal[k].push(v); }
  }
  return { n, diag, lowIdx, lowVal };
}

/** Aplica el precondicionador: z = M⁻¹·r con M = L·Lᵀ (fwd L·y=r, back Lᵀ·z=y). */
function ic0Apply(ic: IC0Factor, r: Float64Array, z: Float64Array): void {
  const { n, diag, lowIdx, lowVal } = ic;
  for (let i = 0; i < n; i++) z[i] = r[i];
  for (let j = 0; j < n; j++) {           // forward: L·y = r (y en z)
    z[j] /= diag[j];
    const idx = lowIdx[j], val = lowVal[j];
    for (let t = 0; t < idx.length; t++) z[idx[t]] -= val[t] * z[j];
  }
  for (let j = n - 1; j >= 0; j--) {      // back: Lᵀ·z = y
    let s = z[j];
    const idx = lowIdx[j], val = lowVal[j];
    for (let t = 0; t < idx.length; t++) s -= val[t] * z[idx[t]];
    z[j] = s / diag[j];
  }
}

/**
 * Gradiente conjugado precondicionado SPARSE. Precondicionador: IC(0) si se pasa
 * `ic0` (Rebanada 2, mucho más rápido), si no Jacobi (M = diag(K)). MISMA física.
 * Ref [3] Bathe §8.5, [11] Hughes §3.4.
 */
export function sparseCG(
  K: SparseSym,
  f: Float64Array,
  tol: number,
  maxIter: number,
  u0?: Float64Array,
  ic0?: IC0Factor | null,
): { u: Float64Array; iterations: number; residual: number; converged: boolean } {
  const n = K.n;
  // WARM-START: si se pasa u0 (solución anterior), el CG arranca de ahí. No cambia
  // la solución (CG es exacto) — solo el nº de iteraciones: un cambio chico de carga
  // converge en ~decenas en vez de cientos. Es la clave del "FEA mientras diseñas".
  const u = u0 && u0.length === n ? Float64Array.from(u0) : new Float64Array(n);
  const Minv = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    Minv[i] = 1 / Math.max(Math.abs(K.rows[i].get(i) ?? 0), 1e-30);
  }
  // z = M⁻¹·r : IC(0) si hay factor, si no Jacobi (diagonal).
  const precond = ic0
    ? (rr: Float64Array, zz: Float64Array) => ic0Apply(ic0, rr, zz)
    : (rr: Float64Array, zz: Float64Array) => { for (let i = 0; i < n; i++) zz[i] = rr[i] * Minv[i]; };
  // r = f − K·u (con warm-start u puede ≠ 0; sin él u=0 ⇒ r=f).
  const r = new Float64Array(n);
  if (u0 && u0.length === n) {
    const Ku = new Float64Array(n);
    sparseMatVec(K, u, Ku);
    for (let i = 0; i < n; i++) r[i] = f[i] - Ku[i];
  } else {
    r.set(f);
  }
  const z = new Float64Array(n);
  precond(r, z);
  const p = new Float64Array(z);
  const Kp = new Float64Array(n);

  let rz = 0;
  for (let i = 0; i < n; i++) rz += r[i] * z[i];

  const fNorm = Math.sqrt(f.reduce((s, v) => s + v * v, 0)) || 1;
  let lastRes = Math.sqrt(r.reduce((s, v) => s + v * v, 0)) / fNorm;

  for (let iter = 0; iter < maxIter; iter++) {
    sparseMatVec(K, p, Kp);
    let pKp = 0;
    for (let i = 0; i < n; i++) pKp += p[i] * Kp[i];
    if (Math.abs(pKp) < 1e-30) {
      return { u, iterations: iter, residual: lastRes, converged: lastRes < tol };
    }
    const alpha = rz / pKp;
    for (let i = 0; i < n; i++) {
      u[i] += alpha * p[i];
      r[i] -= alpha * Kp[i];
    }
    let rNorm2 = 0;
    for (let i = 0; i < n; i++) rNorm2 += r[i] * r[i];
    lastRes = Math.sqrt(rNorm2) / fNorm;
    if (lastRes < tol) {
      return { u, iterations: iter + 1, residual: lastRes, converged: true };
    }
    precond(r, z);
    let rzNew = 0;
    for (let i = 0; i < n; i++) rzNew += r[i] * z[i];
    const beta = rzNew / rz;
    rz = rzNew;
    for (let i = 0; i < n; i++) p[i] = z[i] + beta * p[i];
  }
  return { u, iterations: maxIter, residual: lastRes, converged: lastRes < tol };
}

// ─────────────────────────────────────────────────────────────────
// 4. Pipeline FEA completo
// ─────────────────────────────────────────────────────────────────

function resolveMaterial(
  m: FEAOptions['material'],
): MaterialProperties {
  if (typeof m === 'string') {
    const mat = MATERIAL_DATABASE[m];
    if (!mat) throw new Error(`FEA: material desconocido "${m}"`);
    return mat;
  }
  return m;
}

/**
 * Corre el FEA elástico lineal sobre el sólido B-Rep con las BC del face-pick.
 *
 * Flujo: voxeliza → malla tet → mapea caras fija/cargada a nodos → ensambla K
 * de los Tet4 (D de E,ν) → aplica BC (Dirichlet por eliminación simétrica;
 * carga nodal repartida) → resuelve K·u=f (CG sparse) → recupera ε,σ por
 * elemento (B·u, D·ε) → von Mises → promedia a nodos.
 *
 * Unidades: geometría mm, material Pa; internamente SI (m, N, Pa). Devuelve
 * desplazamientos en mm y esfuerzos en Pa.
 */
export function runFEA(
  oc: OC,
  shape: Shape,
  bc: FaceBC,
  opts: FEAOptions,
): FEAResult {
  const material = resolveMaterial(opts.material);
  const resolution = opts.resolution ?? 16;
  const deflection = opts.deflection ?? 0.1;

  // ── malla de volumen ──
  const mesh = brepToVolumeTetMesh(oc, shape, resolution, deflection);
  if (mesh.nTets === 0) {
    throw new Error(
      'FEA: la malla quedó vacía (sube la resolución o revisa el sólido).',
    );
  }

  // ── caras → nodos (necesita el teselado + las caras enumeradas) ──
  const tess = tessellate(oc, shape, deflection, 0.5);
  const faces = enumerateFaces(oc, shape);

  const collectFaceNodes = (faceIds: number[]): Set<number> => {
    const set = new Set<number>();
    for (const fid of faceIds) {
      const fref = faces.find((f) => f.index === fid);
      const bbox = faceTriBBox(tess, fid);
      if (!fref || !bbox) continue;
      // normal: la de OCCT si está definida; si no (cilindro/cono), usa el eje
      // dominante de la cara como aproximación de la dirección de "salida".
      let normal = fref.normal;
      if (Math.hypot(normal[0], normal[1], normal[2]) < 1e-6) {
        // cara curva sin normal única → usa el eje más delgado de su bbox.
        const ext = [
          bbox.max[0] - bbox.min[0],
          bbox.max[1] - bbox.min[1],
          bbox.max[2] - bbox.min[2],
        ];
        const axis = ext.indexOf(Math.min(...ext));
        normal = [axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0];
      }
      for (const n of nodesOnFace(mesh, fref.center, normal, bbox.min, bbox.max)) {
        set.add(n);
      }
    }
    return set;
  };

  const fixedNodesSet = collectFaceNodes(bc.fixedFaces);
  const loadNodesSet = collectFaceNodes(bc.loadFaces);
  if (fixedNodesSet.size === 0) {
    throw new Error('FEA: ninguna cara fija capturó nodos (revisa fixedFaces).');
  }

  // ── ensamble de K (SI: nodos en metros) ──
  const nDOF = mesh.nNodes * 3;
  const D = elasticityMatrix3D(material.youngsModulus, material.poissonsRatio);
  const K = sparseInit(nDOF);

  // guardamos B y nodos de cada tet para recuperar esfuerzos luego
  const tetB: number[][][] = new Array(mesh.nTets);
  for (let e = 0; e < mesh.nTets; e++) {
    const a = mesh.tets[e * 4], b = mesh.tets[e * 4 + 1];
    const c = mesh.tets[e * 4 + 2], d = mesh.tets[e * 4 + 3];
    const idx = [a, b, c, d];
    const coords: [
      [number, number, number], [number, number, number],
      [number, number, number], [number, number, number]
    ] = [
      [mesh.nodes[a * 3] * MM_TO_M, mesh.nodes[a * 3 + 1] * MM_TO_M, mesh.nodes[a * 3 + 2] * MM_TO_M],
      [mesh.nodes[b * 3] * MM_TO_M, mesh.nodes[b * 3 + 1] * MM_TO_M, mesh.nodes[b * 3 + 2] * MM_TO_M],
      [mesh.nodes[c * 3] * MM_TO_M, mesh.nodes[c * 3 + 1] * MM_TO_M, mesh.nodes[c * 3 + 2] * MM_TO_M],
      [mesh.nodes[d * 3] * MM_TO_M, mesh.nodes[d * 3 + 1] * MM_TO_M, mesh.nodes[d * 3 + 2] * MM_TO_M],
    ];
    const { K: Ke, B } = tet4Element(coords, D);
    tetB[e] = B;
    // dispersa Ke (12×12) en K global (3 DOF por nodo).
    for (let ri = 0; ri < 4; ri++) {
      for (let rj = 0; rj < 3; rj++) {
        const gi = idx[ri] * 3 + rj;
        const li = ri * 3 + rj;
        for (let ci = 0; ci < 4; ci++) {
          for (let cj = 0; cj < 3; cj++) {
            const gj = idx[ci] * 3 + cj;
            const lj = ci * 3 + cj;
            sparseAdd(K, gi, gj, Ke[li][lj]);
          }
        }
      }
    }
  }

  // ── vector de fuerza (N) ──
  const f = new Float64Array(nDOF);
  const loadNodes = [...loadNodesSet];
  if (loadNodes.length > 0) {
    let force: [number, number, number] = bc.totalForce ?? [0, 0, 0];
    if (bc.pressure !== undefined && bc.loadFaces.length > 0) {
      // presión × área OCCT exacta de las caras cargadas → fuerza total.
      let area = 0; // mm²
      let dir = bc.pressureDir ?? [0, 0, 0];
      for (const fid of bc.loadFaces) {
        const fref = faces.find((ff) => ff.index === fid);
        if (!fref) continue;
        area += fref.area;
        if (!bc.pressureDir && Math.hypot(...fref.normal) > 1e-6) dir = fref.normal;
      }
      const dlen = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      const areaM2 = area * MM_TO_M * MM_TO_M;
      const Fmag = bc.pressure * areaM2; // N
      force = [
        (dir[0] / dlen) * Fmag,
        (dir[1] / dlen) * Fmag,
        (dir[2] / dlen) * Fmag,
      ];
    }
    const per = [force[0] / loadNodes.length, force[1] / loadNodes.length, force[2] / loadNodes.length];
    for (const n of loadNodes) {
      f[n * 3] += per[0];
      f[n * 3 + 1] += per[1];
      f[n * 3 + 2] += per[2];
    }
  }

  // ── BC de Dirichlet (u=0 en nodos fijos) por eliminación simétrica ──
  // Para cada DOF fijo d: pone fila/col d = e_d y f[d]=0, restando K[:,d]·0=0
  // de f (0 aquí porque u_d=0). Mantiene simetría.
  const fixedDOF = new Set<number>();
  for (const n of fixedNodesSet) {
    fixedDOF.add(n * 3);
    fixedDOF.add(n * 3 + 1);
    fixedDOF.add(n * 3 + 2);
  }
  for (const d of fixedDOF) {
    // anula columna d en las demás filas
    const row = K.rows[d];
    for (const [j] of row) {
      if (j !== d && K.rows[j].has(d)) K.rows[j].delete(d);
    }
    K.rows[d] = new Map([[d, 1]]);
    f[d] = 0;
  }

  // ── resolver K·u=f ──
  const tol = opts.tol ?? 1e-6;
  const maxIter = opts.maxIter ?? Math.max(2000, 4 * nDOF);
  const sol = sparseCG(K, f, tol, maxIter);
  const uM = sol.u; // metros

  // ── recuperar esfuerzos por elemento (B·u → ε; D·ε → σ; von Mises) ──
  const vmElem = new Float64Array(mesh.nTets);
  const vmNodalAcc = new Float64Array(mesh.nNodes);
  const vmNodalCnt = new Float64Array(mesh.nNodes);
  for (let e = 0; e < mesh.nTets; e++) {
    const idx = [mesh.tets[e * 4], mesh.tets[e * 4 + 1], mesh.tets[e * 4 + 2], mesh.tets[e * 4 + 3]];
    // ue (12) en metros
    const ue = new Array(12);
    for (let r = 0; r < 4; r++) {
      ue[r * 3] = uM[idx[r] * 3];
      ue[r * 3 + 1] = uM[idx[r] * 3 + 1];
      ue[r * 3 + 2] = uM[idx[r] * 3 + 2];
    }
    const B = tetB[e];
    // ε = B·ue (6)
    const eps = new Array(6).fill(0);
    for (let i = 0; i < 6; i++) {
      let s = 0;
      for (let j = 0; j < 12; j++) s += B[i][j] * ue[j];
      eps[i] = s;
    }
    // σ = D·ε (6) [Pa]
    const sig = new Array(6).fill(0) as unknown as StressTensor;
    for (let i = 0; i < 6; i++) {
      let s = 0;
      for (let j = 0; j < 6; j++) s += D[i][j] * eps[j];
      (sig as number[])[i] = s;
    }
    const vm = vonMisesStress(sig);
    vmElem[e] = vm;
    for (const n of idx) {
      vmNodalAcc[n] += vm;
      vmNodalCnt[n] += 1;
    }
  }
  const vmNodal = new Float64Array(mesh.nNodes);
  for (let i = 0; i < mesh.nNodes; i++) {
    vmNodal[i] = vmNodalCnt[i] > 0 ? vmNodalAcc[i] / vmNodalCnt[i] : 0;
  }

  // ── desplazamientos en mm + magnitudes ──
  const disp = new Float64Array(nDOF);
  const dispMag = new Float64Array(mesh.nNodes);
  let maxDisp = 0;
  for (let i = 0; i < mesh.nNodes; i++) {
    const ux = uM[i * 3] / MM_TO_M;
    const uy = uM[i * 3 + 1] / MM_TO_M;
    const uz = uM[i * 3 + 2] / MM_TO_M;
    disp[i * 3] = ux; disp[i * 3 + 1] = uy; disp[i * 3 + 2] = uz;
    const m = Math.hypot(ux, uy, uz);
    dispMag[i] = m;
    if (m > maxDisp) maxDisp = m;
  }

  let maxVM = 0;
  for (let e = 0; e < mesh.nTets; e++) if (vmElem[e] > maxVM) maxVM = vmElem[e];

  return {
    mesh,
    displacements: disp,
    vonMisesNodal: vmNodal,
    vonMisesElem: vmElem,
    dispMagNodal: dispMag,
    maxVonMises: maxVM,
    maxDisplacement: maxDisp,
    minSafetyFactor: maxVM > 0 ? material.yieldStrength / maxVM : Infinity,
    solver: { iterations: sol.iterations, residual: sol.residual, converged: sol.converged },
    fixedNodes: [...fixedNodesSet],
    loadedNodes: loadNodes,
  };
}

// ─────────────────────────────────────────────────────────────────
// 4b. ANÁLISIS INCREMENTAL — "FEA mientras diseñas"
// ─────────────────────────────────────────────────────────────────
// runFEA (arriba) hace TODO en frío cada vez. Para el modo vivo separamos:
//   · lo que NO cambia con la carga (malla, K con Dirichlet, B por tet) — caro,
//     se cachea en una FEASession.
//   · lo que SÍ cambia (vector f + solve) — barato, con WARM-START del CG.
// Mover solo la magnitud de la carga (slider) reusa K y converge en pocas
// iteraciones. MISMA física que runFEA (mismo ensamble, Dirichlet y recovery)
// → los mismos números; la viga lo verifica contra σ=Mc/I.

export interface FEASession {
  mesh: VolumeTetMesh;
  K: SparseSym;                          // con Dirichlet (u=0) YA aplicado
  tetB: number[][][];
  D: number[][];
  material: MaterialProperties;
  nDOF: number;
  fixedDOF: number[];
  fixedNodes: number[];
  loadNodes: number[];
  loadArea: number;                      // mm² de loadFaces (modo presión)
  loadNormal: [number, number, number];
  tol: number;
  maxIter: number;
  uPrev: Float64Array | null;            // warm-start del CG (solución anterior)
  ic0: IC0Factor | null;                 // precondicionador Cholesky-incompleto (cacheado)
}

/** Fase CARA del FEA incremental: malla + K(Dirichlet) + B. Caro; se cachea. */
export function prepareFeaSession(
  oc: OC, shape: Shape, bc: FaceBC, opts: FEAOptions,
): FEASession {
  const material = resolveMaterial(opts.material);
  const resolution = opts.resolution ?? 16;
  const deflection = opts.deflection ?? 0.1;

  const mesh = brepToVolumeTetMesh(oc, shape, resolution, deflection);
  if (mesh.nTets === 0) throw new Error('FEA: la malla quedó vacía (sube la resolución o revisa el sólido).');

  const tess = tessellate(oc, shape, deflection, 0.5);
  const faces = enumerateFaces(oc, shape);

  const collectFaceNodes = (faceIds: number[]): Set<number> => {
    const set = new Set<number>();
    for (const fid of faceIds) {
      const fref = faces.find((f) => f.index === fid);
      const bbox = faceTriBBox(tess, fid);
      if (!fref || !bbox) continue;
      let normal = fref.normal;
      if (Math.hypot(normal[0], normal[1], normal[2]) < 1e-6) {
        const ext = [bbox.max[0] - bbox.min[0], bbox.max[1] - bbox.min[1], bbox.max[2] - bbox.min[2]];
        const axis = ext.indexOf(Math.min(...ext));
        normal = [axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0];
      }
      for (const n of nodesOnFace(mesh, fref.center, normal, bbox.min, bbox.max)) set.add(n);
    }
    return set;
  };

  const fixedNodesSet = collectFaceNodes(bc.fixedFaces);
  const loadNodesSet = collectFaceNodes(bc.loadFaces);
  if (fixedNodesSet.size === 0) throw new Error('FEA: ninguna cara fija capturó nodos (revisa fixedFaces).');

  let loadArea = 0;
  let loadNormal: [number, number, number] = [0, 0, 0];
  for (const fid of bc.loadFaces) {
    const fref = faces.find((ff) => ff.index === fid);
    if (!fref) continue;
    loadArea += fref.area;
    if (Math.hypot(fref.normal[0], fref.normal[1], fref.normal[2]) > 1e-6) loadNormal = fref.normal;
  }

  const nDOF = mesh.nNodes * 3;
  const D = elasticityMatrix3D(material.youngsModulus, material.poissonsRatio);
  const K = sparseInit(nDOF);
  const tetB: number[][][] = new Array(mesh.nTets);
  for (let e = 0; e < mesh.nTets; e++) {
    const a = mesh.tets[e * 4], b = mesh.tets[e * 4 + 1], c = mesh.tets[e * 4 + 2], d = mesh.tets[e * 4 + 3];
    const idx = [a, b, c, d];
    const coords: [
      [number, number, number], [number, number, number],
      [number, number, number], [number, number, number]
    ] = [
      [mesh.nodes[a * 3] * MM_TO_M, mesh.nodes[a * 3 + 1] * MM_TO_M, mesh.nodes[a * 3 + 2] * MM_TO_M],
      [mesh.nodes[b * 3] * MM_TO_M, mesh.nodes[b * 3 + 1] * MM_TO_M, mesh.nodes[b * 3 + 2] * MM_TO_M],
      [mesh.nodes[c * 3] * MM_TO_M, mesh.nodes[c * 3 + 1] * MM_TO_M, mesh.nodes[c * 3 + 2] * MM_TO_M],
      [mesh.nodes[d * 3] * MM_TO_M, mesh.nodes[d * 3 + 1] * MM_TO_M, mesh.nodes[d * 3 + 2] * MM_TO_M],
    ];
    const { K: Ke, B } = tet4Element(coords, D);
    tetB[e] = B;
    for (let ri = 0; ri < 4; ri++) for (let rj = 0; rj < 3; rj++) {
      const gi = idx[ri] * 3 + rj, li = ri * 3 + rj;
      for (let ci = 0; ci < 4; ci++) for (let cj = 0; cj < 3; cj++) {
        const gj = idx[ci] * 3 + cj, lj = ci * 3 + cj;
        sparseAdd(K, gi, gj, Ke[li][lj]);
      }
    }
  }

  // Dirichlet (u=0 en nodos fijos) por eliminación simétrica — NO depende de la carga.
  const fixedDOFset = new Set<number>();
  for (const n of fixedNodesSet) { fixedDOFset.add(n * 3); fixedDOFset.add(n * 3 + 1); fixedDOFset.add(n * 3 + 2); }
  for (const dd of fixedDOFset) {
    const row = K.rows[dd];
    for (const [j] of row) { if (j !== dd && K.rows[j].has(dd)) K.rows[j].delete(dd); }
    K.rows[dd] = new Map([[dd, 1]]);
  }

  // IC(0) una sola vez (solo depende de K con Dirichlet). null → CG cae a Jacobi.
  const ic0 = buildIC0(K);

  return {
    mesh, K, tetB, D, material, nDOF,
    fixedDOF: [...fixedDOFset], fixedNodes: [...fixedNodesSet], loadNodes: [...loadNodesSet],
    loadArea, loadNormal,
    tol: opts.tol ?? 1e-6, maxIter: opts.maxIter ?? Math.max(2000, 4 * nDOF),
    uPrev: null, ic0,
  };
}

/** Fase CARGA del FEA incremental: arma f, resuelve (warm-start) y recupera σ. Barato. */
export function solveLoadOnSession(
  s: FEASession,
  load: { totalForce?: [number, number, number]; pressure?: number; pressureDir?: [number, number, number] },
  warmStart = true,
): FEAResult {
  const { K, mesh, tetB, D, material, nDOF, loadNodes } = s;

  // vector de fuerza (N)
  const f = new Float64Array(nDOF);
  let force: [number, number, number] = load.totalForce ?? [0, 0, 0];
  if (load.pressure !== undefined) {
    const dir = load.pressureDir ?? s.loadNormal;
    const dlen = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const Fmag = load.pressure * (s.loadArea * MM_TO_M * MM_TO_M); // N
    force = [(dir[0] / dlen) * Fmag, (dir[1] / dlen) * Fmag, (dir[2] / dlen) * Fmag];
  }
  if (loadNodes.length > 0) {
    const per = [force[0] / loadNodes.length, force[1] / loadNodes.length, force[2] / loadNodes.length];
    for (const n of loadNodes) { f[n * 3] += per[0]; f[n * 3 + 1] += per[1]; f[n * 3 + 2] += per[2]; }
  }
  for (const dd of s.fixedDOF) f[dd] = 0;

  const u0 = warmStart && s.uPrev && s.uPrev.length === nDOF ? s.uPrev : undefined;
  const sol = sparseCG(K, f, s.tol, s.maxIter, u0, s.ic0);
  s.uPrev = sol.u;
  const uM = sol.u;

  // recuperar esfuerzos (idéntico a runFEA): ε=B·u, σ=D·ε, von Mises
  const vmElem = new Float64Array(mesh.nTets);
  const vmNodalAcc = new Float64Array(mesh.nNodes);
  const vmNodalCnt = new Float64Array(mesh.nNodes);
  for (let e = 0; e < mesh.nTets; e++) {
    const idx = [mesh.tets[e * 4], mesh.tets[e * 4 + 1], mesh.tets[e * 4 + 2], mesh.tets[e * 4 + 3]];
    const ue = new Array(12);
    for (let r = 0; r < 4; r++) { ue[r * 3] = uM[idx[r] * 3]; ue[r * 3 + 1] = uM[idx[r] * 3 + 1]; ue[r * 3 + 2] = uM[idx[r] * 3 + 2]; }
    const B = tetB[e];
    const eps = new Array(6).fill(0);
    for (let i = 0; i < 6; i++) { let ss = 0; for (let j = 0; j < 12; j++) ss += B[i][j] * ue[j]; eps[i] = ss; }
    const sig = new Array(6).fill(0) as unknown as StressTensor;
    for (let i = 0; i < 6; i++) { let ss = 0; for (let j = 0; j < 6; j++) ss += D[i][j] * eps[j]; (sig as number[])[i] = ss; }
    const vm = vonMisesStress(sig);
    vmElem[e] = vm;
    for (const n of idx) { vmNodalAcc[n] += vm; vmNodalCnt[n] += 1; }
  }
  const vmNodal = new Float64Array(mesh.nNodes);
  for (let i = 0; i < mesh.nNodes; i++) vmNodal[i] = vmNodalCnt[i] > 0 ? vmNodalAcc[i] / vmNodalCnt[i] : 0;

  const disp = new Float64Array(nDOF);
  const dispMag = new Float64Array(mesh.nNodes);
  let maxDisp = 0;
  for (let i = 0; i < mesh.nNodes; i++) {
    const ux = uM[i * 3] / MM_TO_M, uy = uM[i * 3 + 1] / MM_TO_M, uz = uM[i * 3 + 2] / MM_TO_M;
    disp[i * 3] = ux; disp[i * 3 + 1] = uy; disp[i * 3 + 2] = uz;
    const m = Math.hypot(ux, uy, uz); dispMag[i] = m; if (m > maxDisp) maxDisp = m;
  }
  let maxVM = 0;
  for (let e = 0; e < mesh.nTets; e++) if (vmElem[e] > maxVM) maxVM = vmElem[e];

  return {
    mesh, displacements: disp, vonMisesNodal: vmNodal, vonMisesElem: vmElem,
    dispMagNodal: dispMag, maxVonMises: maxVM, maxDisplacement: maxDisp,
    minSafetyFactor: maxVM > 0 ? material.yieldStrength / maxVM : Infinity,
    solver: { iterations: sol.iterations, residual: sol.residual, converged: sol.converged },
    fixedNodes: s.fixedNodes, loadedNodes: loadNodes,
  };
}

// ─────────────────────────────────────────────────────────────────
// 5. Muestreo del campo nodal en los VÉRTICES de la malla de RENDER
// ─────────────────────────────────────────────────────────────────
// El FEA vive en la malla TET de volumen (nodos interiores + de borde de la
// rejilla voxelizada). La malla que SE RENDERIZA es la teselación de superficie
// de OCCT, con OTROS vértices. Para colorear la superficie por von Mises hay que
// transferir el campo nodal (en los nodos tet) a CADA vértice de superficie.
//
// Estrategia: rejilla espacial uniforme (mismo paso ~voxel) sobre los nodos tet.
// Para cada punto de superficie, se buscan los nodos tet en su celda y vecinas y
// se interpola por DISTANCIA INVERSA al cuadrado (Shepard). Es O(n) y robusto:
// la superficie del sólido siempre tiene nodos tet cerca (a ≤ ~1 voxel), porque
// los voxeles de borde aportan justo esa capa de nodos.

/** Rejilla espacial (hash de celda → lista de índices de nodo) para vecindad. */
interface NodeGrid {
  cell: number;
  origin: [number, number, number];
  nx: number; ny: number; nz: number;
  buckets: Map<number, number[]>;
}

function buildNodeGrid(mesh: VolumeTetMesh): NodeGrid {
  const cell = Math.max(mesh.voxel, 1e-6);
  const { min, max } = mesh.aabb;
  const nx = Math.max(1, Math.ceil((max[0] - min[0]) / cell) + 1);
  const ny = Math.max(1, Math.ceil((max[1] - min[1]) / cell) + 1);
  const nz = Math.max(1, Math.ceil((max[2] - min[2]) / cell) + 1);
  const buckets = new Map<number, number[]>();
  const key = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  for (let n = 0; n < mesh.nNodes; n++) {
    const x = mesh.nodes[n * 3], y = mesh.nodes[n * 3 + 1], z = mesh.nodes[n * 3 + 2];
    const i = Math.min(nx - 1, Math.max(0, Math.floor((x - min[0]) / cell)));
    const j = Math.min(ny - 1, Math.max(0, Math.floor((y - min[1]) / cell)));
    const k = Math.min(nz - 1, Math.max(0, Math.floor((z - min[2]) / cell)));
    const g = key(i, j, k);
    const arr = buckets.get(g);
    if (arr) arr.push(n); else buckets.set(g, [n]);
  }
  return { cell, origin: [min[0], min[1], min[2]], nx, ny, nz, buckets };
}

/**
 * Interpola un campo nodal escalar (p.ej. von Mises por nodo, en Pa) a un punto
 * arbitrario p (mm) por distancia inversa al cuadrado sobre los nodos tet de la
 * celda de p y sus 26 vecinas. Si no hay ningún nodo cerca (no debería en la
 * superficie), devuelve 0.
 */
function sampleNodalField(
  grid: NodeGrid,
  mesh: VolumeTetMesh,
  field: Float64Array,
  p: [number, number, number],
): number {
  const { cell, origin, nx, ny, nz } = grid;
  const ci = Math.min(nx - 1, Math.max(0, Math.floor((p[0] - origin[0]) / cell)));
  const cj = Math.min(ny - 1, Math.max(0, Math.floor((p[1] - origin[1]) / cell)));
  const ck = Math.min(nz - 1, Math.max(0, Math.floor((p[2] - origin[2]) / cell)));
  let wsum = 0, vsum = 0;
  let nearestVal = 0, nearestD2 = Infinity;
  for (let dk = -1; dk <= 1; dk++) {
    const k = ck + dk; if (k < 0 || k >= nz) continue;
    for (let dj = -1; dj <= 1; dj++) {
      const j = cj + dj; if (j < 0 || j >= ny) continue;
      for (let di = -1; di <= 1; di++) {
        const i = ci + di; if (i < 0 || i >= nx) continue;
        const arr = grid.buckets.get((k * ny + j) * nx + i);
        if (!arr) continue;
        for (const n of arr) {
          const dx = mesh.nodes[n * 3] - p[0];
          const dy = mesh.nodes[n * 3 + 1] - p[1];
          const dz = mesh.nodes[n * 3 + 2] - p[2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < nearestD2) { nearestD2 = d2; nearestVal = field[n]; }
          const w = 1 / (d2 + 1e-6);
          wsum += w; vsum += w * field[n];
        }
      }
    }
  }
  if (wsum === 0) return nearestD2 < Infinity ? nearestVal : 0;
  return vsum / wsum;
}

/** Mapa de color TURBO (Mikhailov 2019): azul-marino→cian→verde→amarillo→naranja→rojo.
 *  Perceptualmente uniforme y con mucho más rango de matiz que el jet clásico, así
 *  el gradiente de esfuerzo se lee fino y el ojo distingue zonas vecinas. Acotado 0..1. */
export function jetColor(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  // Tipo Turbo pero con el extremo BAJO en azul profundo (estándar FEA azul→rojo),
  // NO en el púrpura del Turbo oficial (el púrpura sobre la pieza en reposo lee como
  // defecto, no como dato). Resto: cian→verde→amarillo→naranja→rojo oscuro.
  const stops: Array<[number, [number, number, number]]> = [
    [0.0, [0.12, 0.22, 0.62]],
    [0.125, [0.16, 0.50, 0.96]],
    [0.25, [0.128, 0.563, 0.989]],
    [0.375, [0.100, 0.780, 0.800]],
    [0.5, [0.420, 0.931, 0.392]],
    [0.625, [0.780, 0.945, 0.196]],
    [0.75, [0.980, 0.745, 0.149]],
    [0.875, [0.930, 0.398, 0.069]],
    [1.0, [0.480, 0.016, 0.011]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i];
    const [b, cb] = stops[i + 1];
    if (x >= a && x <= b) {
      const f = (x - a) / (b - a || 1);
      return [
        ca[0] + (cb[0] - ca[0]) * f,
        ca[1] + (cb[1] - ca[1]) * f,
        ca[2] + (cb[2] - ca[2]) * f,
      ];
    }
  }
  return stops[stops.length - 1][1];
}

/**
 * Construye los COLORES POR VÉRTICE (RGB en [0,1], 3·N) para una malla de
 * superficie `positions` (mm) a partir del campo nodal de von Mises del FEA.
 * Normaliza por `maxVonMises` (Pa); cada vértice se colorea con jet(σ_vm/σ_max).
 * Devuelve también el valor de von Mises (Pa) interpolado por vértice, por si la
 * UI quiere tooltips. Es la pieza que hace VISIBLE el análisis sobre la pieza.
 */
export function vonMisesVertexColors(
  result: FEAResult,
  positions: Float32Array,
): { colors: Float32Array; vmPerVertex: Float32Array } {
  const grid = buildNodeGrid(result.mesh);
  const nV = positions.length / 3;
  const colors = new Float32Array(nV * 3);
  const vmPerVertex = new Float32Array(nV);
  // PASO 1 — muestrear el campo de von Mises en cada vértice de la superficie.
  for (let v = 0; v < nV; v++) {
    vmPerVertex[v] = sampleNodalField(grid, result.mesh, result.vonMisesNodal, [
      positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2],
    ]);
  }
  // Normalización por PERCENTIL 98 (no por el máximo): un solo nodo singular en
  // un filete/esquina dispara maxVonMises y APLASTA todo el resto del campo al
  // extremo azul. Tomando P98 como tope, el 98% de la pieza usa TODO el rango
  // turbo cian→rojo y el hot-spot real se ve; los pocos nodos sobre P98 saturan
  // en rojo (jetColor ya acota a 1). Fallback al máximo si la malla es minúscula.
  let denom = result.maxVonMises > 0 ? result.maxVonMises : 1;
  if (nV >= 8) {
    const sorted = Float64Array.from(vmPerVertex).sort();
    const p98 = sorted[Math.min(nV - 1, Math.floor(0.98 * nV))];
    if (p98 > 0) denom = p98;
  }
  // PASO 2 — colorear con turbo(σ_vm / denom).
  for (let v = 0; v < nV; v++) {
    const [r, g, b] = jetColor(vmPerVertex[v] / denom);
    colors[v * 3] = r; colors[v * 3 + 1] = g; colors[v * 3 + 2] = b;
  }
  return { colors, vmPerVertex };
}

// Re-export de utilidades para overlay/inspección desde la UI.
export { principalStresses };
