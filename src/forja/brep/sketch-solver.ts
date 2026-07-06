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
export interface SkLine { a: number; b: number; constr?: boolean }  // índices a points. constr = línea de CONSTRUCCIÓN (eje/referencia, NO se extruye)
export interface SkCircle { c: number; r: number }      // centro (índice a points) + radio
export interface SkArc { c: number; p0: number; p1: number }  // arco: centro + 2 extremos (índices a points). r = |c−p0| = |c−p1|, barre p0→p1 CCW

export type Constraint =
  | { t: 'fix'; p: number }                              // ancla un punto donde está
  | { t: 'coincident'; p: number; q: number }            // dos puntos iguales
  | { t: 'horizontal'; a: number; b: number }            // segmento a-b horizontal
  | { t: 'vertical'; a: number; b: number }              // segmento a-b vertical
  | { t: 'distance'; p: number; q: number; d: number }   // |pq| = d  (cota alineada/euclidiana)
  | { t: 'distX'; p: number; q: number; d: number }      // distancia HORIZONTAL |px−qx| = d (cota H)
  | { t: 'distY'; p: number; q: number; d: number }      // distancia VERTICAL |py−qy| = d (cota V)
  | { t: 'parallel'; l1: number; l2: number }            // líneas paralelas
  | { t: 'perpendicular'; l1: number; l2: number }       // líneas perpendiculares
  | { t: 'equalLength'; l1: number; l2: number }         // |l1| = |l2|
  | { t: 'pointOnLine'; p: number; l: number }           // punto sobre la recta de l
  | { t: 'radius'; c: number; r: number }                // radio de círculo = r (cota)
  | { t: 'diameter'; c: number; d: number }              // diámetro de círculo = d (se rotula Ø)
  | { t: 'arcRadius'; a: number; r: number }             // radio de ARCO a = r (|centro−p0|; se rotula R)
  | { t: 'equalRadius'; c1: number; c2: number }
  | { t: 'concentric'; c1: number; c2: number }
  | { t: 'tangentLC'; l: number; c: number }             // línea tangente a círculo
  | { t: 'symmetric'; p: number; q: number; l: number }  // p,q simétricos respecto al eje (línea l)
  | { t: 'angle'; l1: number; l2: number; deg: number; sign?: number }  // ÁNGULO entre dos líneas = deg; sign fija la RAMA (evita 135↔-45)
  | { t: 'tangentLArc'; l: number; a: number; side?: number } // línea tangente a ARCO a; side fija el LADO del trazo (evita flip)
  | { t: 'equalArcRadius'; a1: number; a2: number };      // dos arcos con el MISMO radio

export interface Sketch {
  points: SkPoint[];
  lines: SkLine[];
  circles: SkCircle[];
  arcs?: SkArc[];
  /** Elipses (AutoCAD Workbook L5): centro + semiejes. Fuera del solver por ahora
   *  (sin restricciones sobre rx/ry) — se dibujan y se teselan al exportar. */
  ellipses?: Array<{ c: number; rx: number; ry: number }>;
  /** Achurado (Workbook L15): segmentos calculados al crear (clip por paridad). */
  hatches?: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }>;
  constraints: Constraint[];
}

export interface SolveResult {
  converged: boolean;
  residual: number;       // ‖r‖∞ final
  dof: number;            // grados de libertad (nVars − rank J)
  status: 'full' | 'under' | 'over';
  iters: number;
  // DOF POR-ENTIDAD: qué puntos/círculos AÚN se pueden mover (tienen componente en
  // el espacio nulo de J). Lo usa el UI para pintar de azul solo lo sub-restringido.
  free: { points: boolean[]; circles: boolean[] };
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
      case 'distX': r.push(Math.abs(P[c.p].x - P[c.q].x) - c.d); break;  // cota horizontal
      case 'distY': r.push(Math.abs(P[c.p].y - P[c.q].y) - c.d); break;  // cota vertical
      case 'parallel': { const [ux, uy] = dir(L[c.l1]); const [vx, vy] = dir(L[c.l2]); r.push(ux * vy - uy * vx); break; }
      case 'perpendicular': { const [ux, uy] = dir(L[c.l1]); const [vx, vy] = dir(L[c.l2]); r.push(ux * vx + uy * vy); break; }
      case 'equalLength': { const [ux, uy] = dir(L[c.l1]); const [vx, vy] = dir(L[c.l2]); r.push(Math.hypot(ux, uy) - Math.hypot(vx, vy)); break; }
      case 'pointOnLine': { const l = L[c.l]; const [ux, uy] = dir(l); const wx = P[c.p].x - P[l.a].x, wy = P[c.p].y - P[l.a].y; r.push(ux * wy - uy * wx); break; }
      case 'radius': r.push(C[c.c].r - c.r); break;
      case 'diameter': r.push(C[c.c].r - c.d / 2); break;
      case 'arcRadius': { const ar = (s.arcs ?? [])[c.a]; if (ar) r.push(Math.hypot(P[ar.p0].x - P[ar.c].x, P[ar.p0].y - P[ar.c].y) - c.r); break; }
      case 'equalRadius': r.push(C[c.c1].r - C[c.c2].r); break;
      case 'concentric': { const a = C[c.c1].c, b = C[c.c2].c; r.push(P[a].x - P[b].x, P[a].y - P[b].y); break; }
      case 'tangentLC': {
        const l = L[c.l], ci = C[c.c]; const [ux, uy] = dir(l); const len = Math.hypot(ux, uy) || 1e-12;
        const wx = P[ci.c].x - P[l.a].x, wy = P[ci.c].y - P[l.a].y;
        r.push((ux * wy - uy * wx) / len - ci.r); break; // distancia con signo centro↔recta − radio
      }
      case 'symmetric': {
        // p,q simétricos respecto al eje (línea l): el punto medio cae sobre el eje
        // Y el segmento p→q es perpendicular al eje. 2 ecuaciones → quita 2 GDL al par.
        const l = L[c.l]; const [ux, uy] = dir(l);
        const mx = (P[c.p].x + P[c.q].x) / 2, my = (P[c.p].y + P[c.q].y) / 2;
        r.push(ux * (my - P[l.a].y) - uy * (mx - P[l.a].x));            // punto medio sobre el eje
        r.push(ux * (P[c.q].x - P[c.p].x) + uy * (P[c.q].y - P[c.p].y)); // p→q ⟂ eje
        break;
      }
      case 'angle': {
        // Ángulo INTERIOR en el vértice compartido (como Fusion): si las dos líneas
        // comparten un punto, se miden los RAYOS que salen de ese vértice (así 135°
        // es el ángulo real del croquis, no el agudo entre direcciones a→b, que haría
        // girar el brazo al lado equivocado). Residual suave = sin(θ − t) → 0 en θ=t.
        const L1 = L[c.l1], L2 = L[c.l2];
        let sv = -1, o1 = -1, o2 = -1;
        if (L1.a === L2.a) { sv = L1.a; o1 = L1.b; o2 = L2.b; }
        else if (L1.a === L2.b) { sv = L1.a; o1 = L1.b; o2 = L2.a; }
        else if (L1.b === L2.a) { sv = L1.b; o1 = L1.a; o2 = L2.b; }
        else if (L1.b === L2.b) { sv = L1.b; o1 = L1.a; o2 = L2.a; }
        let ux, uy, vx, vy;
        if (sv >= 0) { ux = P[o1].x - P[sv].x; uy = P[o1].y - P[sv].y; vx = P[o2].x - P[sv].x; vy = P[o2].y - P[sv].y; }
        else { [ux, uy] = dir(L1); [vx, vy] = dir(L2); }
        const cross = ux * vy - uy * vx, dot = ux * vx + uy * vy;
        const theta = Math.atan2(cross, dot);            // ángulo con SIGNO actual (−π..π]
        const target = (c.sign ?? 1) * c.deg * Math.PI / 180;
        const d = Math.atan2(Math.sin(theta - target), Math.cos(theta - target)); // diferencia ENVUELTA → cero SOLO en la rama del trazo
        r.push(d);
        break;
      }
      case 'tangentLArc': {
        // Línea L tangente al ARCO a: distancia(centro, recta) = radio(arco)=|centro−p0|.
        // Distancia CON SIGNO × side (fijado al lado del trazo) para NO flipear al otro
        // lado tangente (el error que volaba el cuello del croquis).
        const l = L[c.l]; const arc = (s.arcs ?? [])[c.a]; if (!arc) break;
        const [ux, uy] = dir(l); const len = Math.hypot(ux, uy) || 1e-12;
        const cen = P[arc.c];
        const dist = (ux * (cen.y - P[l.a].y) - uy * (cen.x - P[l.a].x)) / len;
        const rad = Math.hypot(P[arc.p0].x - cen.x, P[arc.p0].y - cen.y);
        r.push((c.side ?? 1) * dist - rad);
        break;
      }
      case 'equalArcRadius': {
        const a1 = (s.arcs ?? [])[c.a1], a2 = (s.arcs ?? [])[c.a2]; if (!a1 || !a2) break;
        const r1 = Math.hypot(P[a1.p0].x - P[a1.c].x, P[a1.p0].y - P[a1.c].y);
        const r2 = Math.hypot(P[a2.p0].x - P[a2.c].x, P[a2.p0].y - P[a2.c].y);
        r.push(r1 - r2);
        break;
      }
    }
  }
  // ARCOS: cada arco impone que sus dos extremos estén al MISMO radio del centro
  // (así sigue siendo un arco circular aunque arrastres los extremos). 1 ecuación/arco.
  for (const a of (s.arcs ?? [])) {
    const c = P[a.c], q0 = P[a.p0], q1 = P[a.p1];
    r.push(Math.hypot(q0.x - c.x, q0.y - c.y) - Math.hypot(q1.x - c.x, q1.y - c.y));
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

// Rango numérico + VARIABLES MÓVILES por eliminación de Gauss-Jordan (RREF) con
// tolerancia. Una columna sin pivote es una variable LIBRE (parámetro del espacio
// nulo); un pivote que depende (RREF≠0) de una columna libre TAMBIÉN se mueve. El
// conjunto `movable` = variables con componente no nula en el espacio nulo de J.
function rankAndMovable(A: number[][], n: number, tol = 1e-7): { rank: number; movable: boolean[] } {
  const movable = new Array(n).fill(false);
  const m = A.length;
  if (m === 0) { movable.fill(true); return { rank: 0, movable }; }
  const M = A.map((row) => [...row]);
  const scale = Math.max(1e-12, ...M.flat().map(Math.abs));
  const colIsPivot = new Array(n).fill(false);
  const pivotColOfRow: number[] = [];
  let rank = 0;
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
    colIsPivot[col] = true; pivotColOfRow[rank] = col; rank++;
  }
  for (let col = 0; col < n; col++) {
    if (colIsPivot[col]) continue;
    movable[col] = true; // variable libre
    for (let pr = 0; pr < rank; pr++) if (Math.abs(M[pr][col]) > tol) movable[pivotColOfRow[pr]] = true;
  }
  return { rank, movable };
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
    return { converged: normInf(r) < 1e-6, residual: normInf(r), dof: 0, status: 'full', iters: 0,
      free: { points: sketch.points.map(() => false), circles: sketch.circles.map(() => false) } };
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
  // DOF en la solución: nVars − rank(J), y qué entidades aún se mueven.
  const Jfin = jacobian(sketch, vm, v, r);
  const { rank, movable } = rankAndMovable(Jfin, vm.n);
  const dof = Math.max(0, vm.n - rank);
  const freePoints = sketch.points.map((p, i) => {
    if (p.fixed) return false;
    const [ix, iy] = vm.pxy[i];
    return (ix >= 0 && movable[ix]) || (iy >= 0 && movable[iy]);
  });
  const freeCircles = sketch.circles.map((c, j) => (vm.cr[j] >= 0 && movable[vm.cr[j]]) || freePoints[c.c]);
  const status: SolveResult['status'] = !converged ? 'over' : dof > 0 ? 'under' : 'full';
  return { converged, residual: normInf(r), dof, status, iters: iter, free: { points: freePoints, circles: freeCircles } };
}

/** Conveniencia: ¿el croquis quedó totalmente restringido (negro, como Fusion)? */
export function isFullyConstrained(res: SolveResult): boolean {
  return res.converged && res.dof === 0;
}
