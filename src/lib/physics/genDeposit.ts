/**
 * genDeposit — SIMULACION de deposición generativa de metal.
 *
 * (1) DISEÑO GENERATIVO real: optimización topológica SIMP de un voladizo
 *     (minimiza compliance con FE Q4 + CG) → campo de densidad ρ(x,y).
 * (2) VOXELIZACION con resolución VARIABLE: vóxel grande en el bulto, chico en
 *     el borde (donde importa el detalle).
 * (3) DEPOSICION: el cabezal recorre los vóxeles, dispara la gota (ordeño,
 *     tamaño = vóxel/1.7 por el mojado), balística (cae adelante: lead), y la
 *     huella moja → vóxel. Todo de números (mismo motor de la gota + balística).
 */

// ───────────────────── FE Q4 (plane stress) por integración de Gauss ─────────────────────
function elementK(): number[][] {
  const E = 1, nu = 0.3;
  const D = [[1, nu, 0], [nu, 1, 0], [0, 0, (1 - nu) / 2]].map(r => r.map(v => v * E / (1 - nu * nu)));
  // nodos locales orden [TL,TR,BR,BL] en (ξ,η)
  const xi = [-1, 1, 1, -1], et = [-1, -1, 1, 1];
  const KE = Array.from({ length: 8 }, () => new Array(8).fill(0));
  const g = 1 / Math.sqrt(3), gp = [-g, g];
  for (const s of gp) for (const t of gp) {
    // dN/dξ, dN/dη
    const dNx: number[] = [], dNe: number[] = [];
    for (let i = 0; i < 4; i++) { dNx.push(0.25 * xi[i] * (1 + et[i] * t)); dNe.push(0.25 * et[i] * (1 + xi[i] * s)); }
    // J = 0.5*I (elemento unitario) → dN/dx = 2 dN/dξ ; detJ = 0.25
    const B = [new Array(8).fill(0), new Array(8).fill(0), new Array(8).fill(0)];
    for (let i = 0; i < 4; i++) {
      const bx = 2 * dNx[i], by = 2 * dNe[i];
      B[0][2 * i] = bx; B[1][2 * i + 1] = by; B[2][2 * i] = by; B[2][2 * i + 1] = bx;
    }
    const detJ = 0.25;
    for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) {
      let v = 0;
      for (let k = 0; k < 3; k++) { let db = 0; for (let l = 0; l < 3; l++) db += D[k][l] * B[l][b]; v += B[k][a] * db; }
      KE[a][b] += v * detJ;
    }
  }
  return KE;
}
const KE0 = elementK();

export interface GenShape { nx: number; ny: number; rho: Float32Array; }

/** SIMP topología. loadCase: 'cantilever' (voladizo) | 'shelf' (repisa: pared
 *  empotrada izq + carga DISTRIBUIDA hacia abajo en la superficie superior, que
 *  se mantiene sólida = donde descansa el peso). ρ∈[0,1]. */
export function optimizeTopology(nelx = 44, nely = 22, volfrac = 0.42, penal = 3, rmin = 1.6, iters = 34, loadCase = 'cantilever'): GenShape {
  const nny = nely + 1;
  const ndof = 2 * (nelx + 1) * nny;
  const node = (c: number, r: number) => c * nny + r;
  const edof = (ec: number, er: number) => {
    const tl = node(ec, er), tr = node(ec + 1, er), br = node(ec + 1, er + 1), bl = node(ec, er + 1);
    return [2 * tl, 2 * tl + 1, 2 * tr, 2 * tr + 1, 2 * br, 2 * br + 1, 2 * bl, 2 * bl + 1];
  };
  // BC: borde izquierdo empotrado
  const isFixed = new Uint8Array(ndof);
  for (let r = 0; r < nny; r++) { const n = node(0, r); isFixed[2 * n] = 1; isFixed[2 * n + 1] = 1; }
  // mapa free → compacto
  const cmap = new Int32Array(ndof).fill(-1); let nf = 0;
  for (let d = 0; d < ndof; d++) if (!isFixed[d]) cmap[d] = nf++;
  // carga
  const F = new Float64Array(nf);
  if (loadCase === 'shelf') {           // repisa: carga distribuida ↓ en el borde superior
    for (let c = 0; c <= nelx; c++) { const d = cmap[2 * node(c, 0) + 1]; if (d >= 0) F[d] = -1 / (nelx + 1); }
  } else {                              // voladizo: carga puntual ↓ en la punta derecha-medio
    const ln = node(nelx, Math.floor(nely / 2));
    if (cmap[2 * ln + 1] >= 0) F[cmap[2 * ln + 1]] = -1;
  }
  // región PASIVA (siempre sólida): la superficie de la repisa (fila superior de elementos)
  const passive = new Uint8Array(nelx * nely);
  if (loadCase === 'shelf') for (let ec = 0; ec < nelx; ec++) passive[ec * nely + 0] = 1;

  // filtro de sensibilidad (pesos rmin)
  const ne = nelx * nely;
  const fH: number[][] = [], fW: number[][] = [];
  const er2 = Math.ceil(rmin);
  for (let ec = 0; ec < nelx; ec++) for (let er = 0; er < nely; er++) {
    const idx: number[] = [], w: number[] = [];
    for (let jc = Math.max(0, ec - er2); jc <= Math.min(nelx - 1, ec + er2); jc++)
      for (let jr = Math.max(0, er - er2); jr <= Math.min(nely - 1, er + er2); jr++) {
        const d = Math.hypot(ec - jc, er - jr); if (d < rmin) { idx.push(jc * nely + jr); w.push(rmin - d); }
      }
    fH[ec * nely + er] = idx; fW[ec * nely + er] = w;
  }

  const x = new Float32Array(ne).fill(volfrac);
  for (let e = 0; e < ne; e++) if (passive[e]) x[e] = 1;   // la superficie de la repisa, sólida
  const edofs: number[][] = []; for (let ec = 0; ec < nelx; ec++) for (let er = 0; er < nely; er++) edofs[ec * nely + er] = edof(ec, er);
  const Emin = 1e-9;
  const U = new Float64Array(nf);

  // matvec K·p (ensamble matrix-free por elemento, espacio compacto free)
  const matvec = (p: Float64Array, out: Float64Array) => {
    out.fill(0);
    for (let e = 0; e < ne; e++) {
      const Ee = Emin + Math.pow(x[e], penal) * (1 - Emin);
      const ed = edofs[e];
      const pe = new Array(8);
      for (let a = 0; a < 8; a++) { const c = cmap[ed[a]]; pe[a] = c >= 0 ? p[c] : 0; }
      for (let a = 0; a < 8; a++) {
        const ca = cmap[ed[a]]; if (ca < 0) continue;
        let acc = 0; for (let b = 0; b < 8; b++) acc += KE0[a][b] * pe[b];
        out[ca] += Ee * acc;
      }
    }
  };
  // CG
  const cg = () => {
    U.fill(0);
    const r = Float64Array.from(F), p = Float64Array.from(F), Ap = new Float64Array(nf);
    let rs = 0; for (let i = 0; i < nf; i++) rs += r[i] * r[i];
    const tol = 1e-8 * rs;
    for (let it = 0; it < 4000 && rs > tol; it++) {
      matvec(p, Ap);
      let pAp = 0; for (let i = 0; i < nf; i++) pAp += p[i] * Ap[i];
      const al = rs / (pAp || 1e-30);
      for (let i = 0; i < nf; i++) { U[i] += al * p[i]; r[i] -= al * Ap[i]; }
      let rs2 = 0; for (let i = 0; i < nf; i++) rs2 += r[i] * r[i];
      const be = rs2 / (rs || 1e-30);
      for (let i = 0; i < nf; i++) p[i] = r[i] + be * p[i];
      rs = rs2;
    }
  };

  for (let it = 0; it < iters; it++) {
    cg();
    // compliance + sensibilidad
    const dc = new Float64Array(ne);
    for (let e = 0; e < ne; e++) {
      const ed = edofs[e]; const ue = new Array(8);
      for (let a = 0; a < 8; a++) { const c = cmap[ed[a]]; ue[a] = c >= 0 ? U[c] : 0; }
      let ce = 0; for (let a = 0; a < 8; a++) { let s = 0; for (let b = 0; b < 8; b++) s += KE0[a][b] * ue[b]; ce += ue[a] * s; }
      dc[e] = -penal * Math.pow(x[e], penal - 1) * (1 - Emin) * ce;
    }
    // filtrado
    const dcf = new Float64Array(ne);
    for (let e = 0; e < ne; e++) {
      let num = 0, den = 0; const H = fH[e], W = fW[e];
      for (let k = 0; k < H.length; k++) { num += W[k] * x[H[k]] * dc[H[k]]; den += W[k]; }
      dcf[e] = num / (Math.max(x[e], 1e-3) * den);
    }
    // OC update
    let l1 = 0, l2 = 1e9; const move = 0.2;
    while ((l2 - l1) / (l1 + l2) > 1e-3) {
      const lm = 0.5 * (l1 + l2); let vol = 0;
      for (let e = 0; e < ne; e++) {
        if (passive[e]) { vol += 1; continue; }
        const xe = x[e] * Math.sqrt(-dcf[e] / lm);
        const xn = Math.max(0.001, Math.max(x[e] - move, Math.min(1, Math.min(x[e] + move, xe))));
        vol += xn;
      }
      if (vol > volfrac * ne) l1 = lm; else l2 = lm;
    }
    const lm = 0.5 * (l1 + l2);
    for (let e = 0; e < ne; e++) {
      if (passive[e]) continue;                          // la superficie de la repisa queda sólida
      const xe = x[e] * Math.sqrt(-dcf[e] / lm);
      x[e] = Math.max(0.001, Math.max(x[e] - move, Math.min(1, Math.min(x[e] + move, xe))));
    }
  }
  // a row-major [y*nx+x]
  const rho = new Float32Array(nelx * nely);
  for (let ec = 0; ec < nelx; ec++) for (let er = 0; er < nely; er++) rho[er * nelx + ec] = x[ec * nely + er];
  return { nx: nelx, ny: nely, rho };
}

// ───────────────────── voxelización con resolución variable ─────────────────────
export interface Voxel { gx: number; gy: number; D: number; dDrop: number; edge: boolean; }
const SOLID = 0.5, XI = 1.7; // umbral sólido · D_huella/d_gota (mojado θ≈50°)

/** Plan de deposición: vóxel grande en el bulto, chico en el borde. adaptive=false → todo fino. */
export function planDeposition(s: GenShape, adaptive = true): Voxel[] {
  const { nx, ny, rho } = s;
  const solid = (x: number, y: number) => x >= 0 && x < nx && y >= 0 && y < ny && rho[y * nx + x] >= SOLID;
  const out: Voxel[] = [];
  // serpentina por filas (orden natural del cabezal)
  for (let y = 0; y < ny; y++) {
    const cols = y % 2 === 0 ? [...Array(nx).keys()] : [...Array(nx).keys()].reverse();
    for (const x of cols) {
      if (!solid(x, y)) continue;
      const edge = !(solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1));
      // vóxel grande (1 celda) en bulto, chico (sub-celda) en borde si adaptive
      const D = adaptive ? (edge ? 0.5 : 1.0) : 0.5;   // en unidades de celda
      out.push({ gx: x, gy: y, D, dDrop: D / XI, edge });
    }
  }
  return out;
}

// ───────────────────── forma generativa PRECALCULADA (SIMP 40×20, ρ·9) ─────────────────────
// Generada por optimizeTopology(40,20,...) — ver scripts/test-gendeposit.ts. Embebida para
// carga instantánea (el SIMP tarda ~12s; el resultado es determinista).
export const GEN_NX = 40, GEN_NY = 20;
const GEN_PACKED =
  "99999999999999999999999997310000000000009999999999999999999999999985210000000000999999764444444444445578799984200000000013589998421000000001257633699973100000000012479997410000000037741013799963100000000012489997310000026841000024899852100000000012589997321015861000000125999842100000000012589997424872000000000136999741000000000012589997883100000000000137999800000000000013699995100000000000000258990000000000001369999510000000000000025899000000000012589997883100000000000137999800000000125899974248720000000001369997410000001258999732101586100000012599984210000012489997310000026841000024899852100000124799974100000000377410137999631000001358999842100000000125763369997310000000999999764444444444445578799984200000000099999999999999999999999999852100000000009999999999999999999999999731000000000000";
export function getGenShape(): GenShape {
  const rho = new Float32Array(GEN_NX * GEN_NY);
  for (let i = 0; i < rho.length; i++) rho[i] = (GEN_PACKED.charCodeAt(i) - 48) / 9;
  return { nx: GEN_NX, ny: GEN_NY, rho };
}

// REPISA optimizada (SIMP loadCase='shelf', 40×20): superficie sólida arriba +
// ménsula orgánica a la pared. Generada en La Forja — ver scripts/test-shelf.ts.
const SHELF_PACKED =
  "99999999999999999999999999999999999999999999999999999999999998877666554455566531999986677777766667644566555543345676531068999643222222467741123455654346886420001259997421000147852000124664457874210000001489997321126962000002565568963100000000012599997434883100000366789852000000000000013589998895100000158999731000000000000000013689998310000149998420000000000000000000136999841000159996310000000000000000000026999876411269995100000000000000000000138998545764369994100000000000000000000259997311357789994100000000000000000001369995211246899983100000000000000000001489984334689999983100000000000000000013699985578999999952000000000000000000007999998999999986421000000000000000000000999999999997532100000000000000000000000099999998643210000000000000000000000000009999964311000000000000000000000000000000";
export function getShelfShape(): GenShape {
  const rho = new Float32Array(GEN_NX * GEN_NY);
  for (let i = 0; i < rho.length; i++) rho[i] = (SHELF_PACKED.charCodeAt(i) - 48) / 9;
  return { nx: GEN_NX, ny: GEN_NY, rho };
}

// ───────────────────── régimen por GAP (contacto vs vuelo) ─────────────────────
const AW = Math.PI / 4 * 0.8e-3 * 0.8e-3, RHOL = 7000, GAMMA = 1.5, VIMP = 0.34;
/** tamaño de gota del ordeño en vuelo libre [m]. */
export function dOrdeno(f = 600, vf = 4e-3) { return Math.cbrt(6 * AW * vf / (Math.PI * f)); }
export const CRIT_GAP_MM = dOrdeno() * 1e3;        // gap crítico = tamaño de ordeño
export function regimeOf(gapMm: number): 'contacto' | 'vuelo' { return gapMm < CRIT_GAP_MM ? 'contacto' : 'vuelo'; }
/** tamaño de gota: en CONTACTO lo fija el gap; en VUELO, el ordeño. [mm] */
export function dGotaMm(gapMm: number) { return regimeOf(gapMm) === 'contacto' ? gapMm : CRIT_GAP_MM; }
export function weOf(dMm: number) { return RHOL * VIMP * VIMP * (dMm * 1e-3) / GAMMA; }

// ───────────────────── plan de relleno (serpentina, vóxel variable) ─────────────────────
export interface FillVoxel { cx: number; cy: number; edge: boolean; size: number; }
/** Ordena los vóxeles a depositar (serpentina). adaptive: bulto grande, borde chico. */
export function planFill(s: GenShape, adaptive = true): FillVoxel[] {
  const { nx, ny, rho } = s;
  const solid = (x: number, y: number) => x >= 0 && x < nx && y >= 0 && y < ny && rho[y * nx + x] >= SOLID;
  const out: FillVoxel[] = [];
  for (let y = 0; y < ny; y++) {
    const cols = y % 2 === 0 ? [...Array(nx).keys()] : [...Array(nx).keys()].reverse();
    for (const x of cols) {
      if (!solid(x, y)) continue;
      const edge = !(solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1));
      out.push({ cx: x, cy: y, edge, size: adaptive ? (edge ? 0.62 : 1.0) : 0.72 });
    }
  }
  return out;
}

// ───────────────────── FIGURAS GENERATIVAS 3D (xyz) ─────────────────────
// Diseño generativo real para manufactura aditiva: topología (ménsula) + TPMS
// (giroide, Schwarz-P, diamante = superficies mínimas triplemente periódicas,
// las celosías clásicas de aligeramiento) + celosía de struts. Analíticas (rápidas).
export const FIGURES = [
  { id: 'repisa', name: 'Repisa optimizada (topología)' },
  { id: 'giroide', name: 'Giroide (TPMS)' },
  { id: 'diamante', name: 'Diamante (TPMS)' },
  { id: 'schwarzp', name: 'Schwarz-P (TPMS)' },
  { id: 'lattice', name: 'Celosía cúbica (struts)' },
  { id: 'mensula', name: 'Ménsula (topología)' },
];

export interface Voxel3D { cx: number; cy: number; cz: number; edge: boolean; size: number; type: 'part' | 'support'; }

/** Campo de ocupación 3D (n³) de una figura generativa. */
export function figure3D(kind: string, n = 18, periods = 2): Uint8Array {
  const occ = new Uint8Array(n * n * n);
  const a = 2 * Math.PI * periods / n;
  const rho2 = kind === 'mensula' ? getGenShape() : kind === 'repisa' ? getShelfShape() : null;
  const ix = (x: number, y: number, z: number) => (z * n + y) * n + x;
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const nx = x / (n - 1) * 2 - 1, ny = y / (n - 1) * 2 - 1, nz = z / (n - 1) * 2 - 1;
    let solid = false;
    if (kind === 'mensula' && rho2) {
      const gx = Math.min(rho2.nx - 1, Math.floor(x / n * rho2.nx));
      const gy = Math.min(rho2.ny - 1, Math.floor(y / n * rho2.ny));
      solid = rho2.rho[gy * rho2.nx + gx] >= 0.5 && z >= n * 0.34 && z <= n * 0.66;   // placa gruesa
    } else if (kind === 'repisa' && rho2) {
      // perfil 2D PARADO: x=fondo de la repisa, z=ALTURA (superficie arriba), y=profundidad
      const gx = Math.min(rho2.nx - 1, Math.floor(x / n * rho2.nx));
      const gy = Math.min(rho2.ny - 1, Math.floor((n - 1 - z) / n * rho2.ny));
      solid = rho2.rho[gy * rho2.nx + gx] >= 0.5 && y >= n * 0.3 && y <= n * 0.7;       // profundidad del estante
    } else if (kind === 'lattice') {
      const f = (v: number) => { const t = (v / n * periods) % 1; return Math.min(t, 1 - t); };
      const c = (f(x) < 0.13 ? 1 : 0) + (f(y) < 0.13 ? 1 : 0) + (f(z) < 0.13 ? 1 : 0);
      solid = c >= 2 && (nx * nx + ny * ny + nz * nz) < 0.95;        // struts en aristas, clip esfera
    } else {
      const X = a * x, Y = a * y, Z = a * z; let g = 0;
      if (kind === 'giroide') g = Math.sin(X) * Math.cos(Y) + Math.sin(Y) * Math.cos(Z) + Math.sin(Z) * Math.cos(X);
      else if (kind === 'schwarzp') g = Math.cos(X) + Math.cos(Y) + Math.cos(Z);
      else if (kind === 'diamante') g = Math.sin(X) * Math.sin(Y) * Math.sin(Z) + Math.sin(X) * Math.cos(Y) * Math.cos(Z) + Math.cos(X) * Math.sin(Y) * Math.cos(Z) + Math.cos(X) * Math.cos(Y) * Math.sin(Z);
      const t = kind === 'schwarzp' ? 0.85 : 0.62;
      solid = Math.abs(g) < t && (nx * nx + ny * ny + nz * nz) < 0.92;  // cáscara TPMS, clip esfera
    }
    if (solid) occ[ix(x, y, z)] = 1;
  }
  return occ;
}

/**
 * Plan de deposición 3D que MODELA LA UNIÓN: nada se imprime en el aire.
 * Cada vóxel se funde a algo ya presente (sustrato / vóxel previo). Regla: un
 * vóxel de la PIEZA es autoportante si tiene sólido DEBAJO (z-1) o un vecino
 * lateral con sólido debajo (voladizo de 1 vóxel ≈45°). Si no, se genera una
 * COLUMNA DE SOPORTE hacia abajo (material extra removible) para sostenerlo.
 * Orden: capa por capa de abajo arriba → cada gota cae sobre algo bonded.
 */
export function planFill3D(occ: Uint8Array, n: number, adaptive = true): Voxel3D[] {
  const ix = (x: number, y: number, z: number) => (z * n + y) * n + x;
  const inb = (x: number, y: number, z: number) => x >= 0 && x < n && y >= 0 && y < n && z >= 0 && z < n;
  const part = (x: number, y: number, z: number) => inb(x, y, z) && occ[ix(x, y, z)] === 1;
  const sup = new Uint8Array(n * n * n);
  const belowSolid = (x: number, y: number, z: number) => z === 0 || part(x, y, z - 1) || sup[ix(x, y, z - 1)] === 1;

  // PASS 1 — generar soportes (abajo→arriba). Modela que nada flota.
  for (let z = 1; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!part(x, y, z)) continue;
    const selfOk = belowSolid(x, y, z) ||
      ((part(x - 1, y, z) && belowSolid(x - 1, y, z)) || (part(x + 1, y, z) && belowSolid(x + 1, y, z)) ||
       (part(x, y - 1, z) && belowSolid(x, y - 1, z)) || (part(x, y + 1, z) && belowSolid(x, y + 1, z)));
    if (!selfOk) for (let zz = z - 1; zz >= 0; zz--) { if (part(x, y, zz) || sup[ix(x, y, zz)] === 1) break; sup[ix(x, y, zz)] = 1; }
  }

  // PASS 2 — orden de deposición: capa por capa, soporte+pieza, cada vóxel BONDED.
  const isSolid = (x: number, y: number, z: number) => part(x, y, z) || (inb(x, y, z) && sup[ix(x, y, z)] === 1);
  const out: Voxel3D[] = [];
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) {
    const xs = [...Array(n).keys()]; if (y % 2 === 1) xs.reverse();
    for (const x of xs) {
      const isPart = part(x, y, z), isSup = sup[ix(x, y, z)] === 1;
      if (!isPart && !isSup) continue;
      const edge = !(isSolid(x - 1, y, z) && isSolid(x + 1, y, z) && isSolid(x, y - 1, z) && isSolid(x, y + 1, z) && isSolid(x, y, z - 1) && isSolid(x, y, z + 1));
      out.push({ cx: x, cy: y, cz: z, edge, type: isPart ? 'part' : 'support', size: adaptive ? (edge ? 0.7 : 1.0) : 0.8 });
    }
  }
  return out;
}
