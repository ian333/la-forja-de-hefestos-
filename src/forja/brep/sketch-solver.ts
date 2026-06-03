/**
 * ⚒️ La Forja — SOLVER DE RESTRICCIONES GEOMÉTRICAS 2D
 * =====================================================
 * El corazón de un croquis paramétrico de verdad (lo que Fusion/SolidWorks/FreeCAD
 * tienen y nuestras "plantillas" NO). Las variables son las coordenadas de los
 * PUNTOS (más el radio de cada círculo); las restricciones son ECUACIONES. Un
 * solver de Gauss–Newton amortiguado (Levenberg–Marquardt) mueve la geometría
 * hasta satisfacerlas todas. El número de GRADOS DE LIBERTAD (DOF) sale del rango
 * del Jacobiano: DOF = nVars − rank(J).
 *   DOF > 0  → sub-restringido  (azul: aún se puede mover)
 *   DOF = 0  → totalmente def.  (negro: clavado, como Fusion)
 *   no converge → sobre/conflicto (rojo)
 *
 * Es matemática pura, sin three.js ni OCCT: se prueba con asserts (ver
 * scripts/sketch-solver-test.ts). El UI interactivo se construye encima.
 */

export interface SkPoint { x: number; y: number; fixed?: boolean }
export interface SkLine { a: number; b: number }        // índices a points
export interface SkCircle { c: number; r: number }      // centro (índice a points) + radio

export type Constraint =
  | { t: 'fix'; p: number }                              // ancla un punto donde está
  | { t: 'coincident'; p: number; q: number }            // dos puntos iguales
  | { t: 'horizontal'; a: number; b: number }            // segmento a-b horizontal
  | { t: 'vertical'; a: number; b: number }              // segmento a-b vertical
  | { t: 'distance'; p: number; q: number; d: number }   // |pq| = d  (cota)
  | { t: 'parallel'; l1: number; l2: number }            // líneas paralelas
  | { t: 'perpendicular'; l1: number; l2: number }       // líneas perpendiculares
  | { t: 'equalLength'; l1: number; l2: number }         // |l1| = |l2|
  | { t: 'pointOnLine'; p: number; l: number }           // punto sobre la recta de l
  | { t: 'radius'; c: number; r: number }                // radio de círculo = r (cota)
  | { t: 'equalRadius'; c1: number; c2: number }
  | { t: 'concentric'; c1: number; c2: number }
  | { t: 'tangentLC'; l: number; c: number };            // línea tangente a círculo

export interface Sketch {
  points: SkPoint[];
  lines: SkLine[];
  circles: SkCircle[];
  constraints: Constraint[];
}

export interface SolveResult {
  converged: boolean;
  residual: number;       // ‖r‖∞ final
  dof: number;            // grados de libertad (nVars − rank J)
  status: 'full' | 'under' | 'over';
  iters: number;
}

// ── Mapa de variables ───────────────────────────────────────────────
// Las incógnitas son: (x,y) de cada punto NO fijo + r de cada círculo.
interface VarMap { n: number; pxy: number[][]; cr: number[] }
function buildVarMap(s: Sketch): VarMap {
  const pxy: number[][] = s.points.map(() => [-1, -1]);
  const cr: number[] = s.circles.map(() => -1);
  let n = 0;
  for (let i = 0; i < s.points.length; i++) {
    if (s.points[i].fixed) continue;
    pxy[i] = [n++, n++];
  }
  for (let j = 0; j < s.circles.length; j++) cr[j] = n++;
  return { n, pxy, cr };
}
function pack(s: Sketch, vm: VarMap): number[] {
  const v = new Array(vm.n).fill(0);
  for (let i = 0; i < s.points.length; i++) {
    if (vm.pxy[i][0] >= 0) { v[vm.pxy[i][0]] = s.points[i].x; v[vm.pxy[i][1]] = s.points[i].y; }
  }
  for (let j = 0; j < s.circles.length; j++) v[vm.cr[j]] = s.circles[j].r;
  return v;
}
function unpack(v: number[], s: Sketch, vm: VarMap): void {
  for (let i = 0; i < s.points.length; i++) {
    if (vm.pxy[i][0] >= 0) { s.points[i].x = v[vm.pxy[i][0]]; s.points[i].y = v[vm.pxy[i][1]]; }
  }
  for (let j = 0; j < s.circles.length; j++) s.circles[j].r = v[vm.cr[j]];
}

// ── Residuales ───────────────────────────────────────────────────────
// Cada restricción aporta una o dos ecuaciones que deben valer 0.
function residuals(s: Sketch): number[] {
  const P = s.points, L = s.lines, C = s.circles;
  const r: number[] = [];
  const dir = (l: SkLine) => [P[l.b].x - P[l.a].x, P[l.b].y - P[l.a].y] as const;
  for (const c of s.constraints) {
    switch (c.t) {
      case 'fix': break; // se maneja marcando el punto fijo (sin variable)
      case 'coincident': r.push(P[c.p].x - P[c.q].x, P[c.p].y - P[c.q].y); break;
      case 'horizontal': r.push(P[c.a].y - P[c.b].y); break;
      case 'vertical': r.push(P[c.a].x - P[c.b].x); break;
      case 'distance': {
        const dx = P[c.p].x - P[c.q].x, dy = P[c.p].y - P[c.q].y;
        r.push(Math.hypot(dx, dy) - c.d); break;
      }
      case 'parallel': { const [ux, uy] = dir(L[c.l1]); const [vx, vy] = dir(L[c.l2]); r.push(ux * vy - uy * vx); break; }
      case 'perpendicular': { const [ux, uy] = dir(L[c.l1]); const [vx, vy] = dir(L[c.l2]); r.push(ux * vx + uy * vy); break; }
      case 'equalLength': { const [ux, uy] = dir(L[c.l1]); const [vx, vy] = dir(L[c.l2]); r.push(Math.hypot(ux, uy) - Math.hypot(vx, vy)); break; }
      case 'pointOnLine': { const l = L[c.l]; const [ux, uy] = dir(l); const wx = P[c.p].x - P[l.a].x, wy = P[c.p].y - P[l.a].y; r.push(ux * wy - uy * wx); break; }
      case 'radius': r.push(C[c.c].r - c.r); break;
      case 'equalRadius': r.push(C[c.c1].r - C[c.c2].r); break;
      case 'concentric': { const a = C[c.c1].c, b = C[c.c2].c; r.push(P[a].x - P[b].x, P[a].y - P[b].y); break; }
      case 'tangentLC': {
        const l = L[c.l], ci = C[c.c]; const [ux, uy] = dir(l); const len = Math.hypot(ux, uy) || 1e-12;
        const wx = P[ci.c].x - P[l.a].x, wy = P[ci.c].y - P[l.a].y;
        r.push((ux * wy - uy * wx) / len - ci.r); break; // distancia con signo centro↔recta − radio
      }
    }
  }
  return r;
}

// ── Jacobiano numérico (diferencias centradas) ───────────────────────
function jacobian(s: Sketch, vm: VarMap, v: number[], r0: number[]): number[][] {
  const m = r0.length, n = vm.n;
  const J: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  const h = 1e-6;
  for (let j = 0; j < n; j++) {
    const sv = v[j];
    v[j] = sv + h; unpack(v, s, vm); const rp = residuals(s);
    v[j] = sv - h; unpack(v, s, vm); const rm = residuals(s);
    v[j] = sv;
    for (let i = 0; i < m; i++) J[i][j] = (rp[i] - rm[i]) / (2 * h);
  }
  unpack(v, s, vm);
  return J;
}

// ── Álgebra lineal mínima ────────────────────────────────────────────
function solveDense(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-14) continue;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

// Rango numérico por eliminación de Gauss con tolerancia (para contar DOF).
function matrixRank(A: number[][], tol = 1e-7): number {
  const m = A.length; if (m === 0) return 0;
  const n = A[0].length; const M = A.map((row) => [...row]);
  let rank = 0;
  const scale = Math.max(1e-12, ...M.flat().map(Math.abs));
  for (let col = 0; col < n && rank < m; col++) {
    let piv = rank;
    for (let r = rank + 1; r < m; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < tol * scale) continue;
    [M[rank], M[piv]] = [M[piv], M[rank]];
    const d = M[rank][col];
    for (let c = col; c < n; c++) M[rank][c] /= d;
    for (let r = 0; r < m; r++) {
      if (r === rank) continue;
      const f = M[r][col];
      for (let c = col; c < n; c++) M[r][c] -= f * M[rank][c];
    }
    rank++;
  }
  return rank;
}

const norm2 = (a: number[]) => Math.sqrt(a.reduce((s, x) => s + x * x, 0));
const normInf = (a: number[]) => a.reduce((s, x) => Math.max(s, Math.abs(x)), 0);

/**
 * Resuelve el croquis: mueve los puntos (mutando `sketch.points`/`circles`) hasta
 * satisfacer las restricciones, por Levenberg–Marquardt sobre J. Devuelve estado +
 * DOF. Las restricciones `fix` se aplican marcando el punto como fijo (preproceso).
 */
export function solveSketch(sketch: Sketch, opts: { maxIters?: number; tol?: number } = {}): SolveResult {
  const maxIters = opts.maxIters ?? 80;
  const tol = opts.tol ?? 1e-9;

  // Preproceso: las restricciones 'fix' marcan puntos fijos.
  for (const c of sketch.constraints) if (c.t === 'fix') sketch.points[c.p].fixed = true;

  const vm = buildVarMap(sketch);
  if (vm.n === 0) {
    const r = residuals(sketch);
    return { converged: normInf(r) < 1e-6, residual: normInf(r), dof: 0, status: 'full', iters: 0 };
  }

  let v = pack(sketch, vm);
  let lambda = 1e-3;
  let r = (unpack(v, sketch, vm), residuals(sketch));
  let cost = norm2(r);
  let iter = 0;

  for (; iter < maxIters; iter++) {
    if (normInf(r) < tol) break;
    const J = jacobian(sketch, vm, v, r);
    const m = r.length, n = vm.n;
    // Ecuaciones normales: (JᵀJ + λ·diag(JᵀJ)) Δ = −Jᵀr
    const JtJ: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    const Jtr: number[] = new Array(n).fill(0);
    for (let a = 0; a < n; a++) {
      for (let b = a; b < n; b++) {
        let s = 0; for (let i = 0; i < m; i++) s += J[i][a] * J[i][b];
        JtJ[a][b] = s; JtJ[b][a] = s;
      }
      let s = 0; for (let i = 0; i < m; i++) s += J[i][a] * r[i];
      Jtr[a] = s;
    }
    let applied = false;
    for (let tries = 0; tries < 8 && !applied; tries++) {
      const A = JtJ.map((row, i) => row.map((x, j) => (i === j ? x * (1 + lambda) + 1e-12 : x)));
      const delta = solveDense(A, Jtr.map((x) => -x));
      const vNew = v.map((x, i) => x + delta[i]);
      unpack(vNew, sketch, vm);
      const rNew = residuals(sketch);
      const costNew = norm2(rNew);
      if (costNew < cost) { v = vNew; r = rNew; cost = costNew; lambda = Math.max(1e-9, lambda / 3); applied = true; }
      else { lambda = Math.min(1e9, lambda * 4); }
    }
    unpack(v, sketch, vm);
    if (!applied) break; // no se pudo mejorar (mínimo local o conflicto)
  }

  const converged = normInf(r) < 1e-6;
  // DOF en la solución: nVars − rank(J).
  const Jfin = jacobian(sketch, vm, v, r);
  const rank = matrixRank(Jfin);
  const dof = Math.max(0, vm.n - rank);
  const status: SolveResult['status'] = !converged ? 'over' : dof > 0 ? 'under' : 'full';
  return { converged, residual: normInf(r), dof, status, iters: iter };
}

/** Conveniencia: ¿el croquis quedó totalmente restringido (negro, como Fusion)? */
export function isFullyConstrained(res: SolveResult): boolean {
  return res.converged && res.dof === 0;
}
