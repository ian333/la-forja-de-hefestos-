/**
 * ⚒️ La Forja — Cuatro-Barras (four-bar linkage) · OPERADOR FORWARD
 * =============================================================================
 * Fase 0 del plan de SÍNTESIS DE MECANISMOS (LA-FORJA-GENERATIVO-MECANISMOS.md).
 * Generaliza el cierre de lazo de `slider-crank.ts` al four-bar planar de 4 R.
 *
 * GEOMETRÍA (convención estándar Norton, eslabón de tierra sobre +X):
 *   • O2 = tierra-pivote de la manivela, fijado por `ground` (default origen).
 *   • O4 = tierra-pivote del balancín, en O2 + a1·(cos γ, sin γ), γ = groundAngle.
 *   • A  = punta de la manivela  : A = O2 + a2·e^{iθ2}.
 *   • B  = punta del balancín    : B = O4 + a4·e^{iθ4}.
 *   • acoplador a3 conecta A→B   : |B − A| = a3 (restricción rígida).
 *
 *   Eslabones:  a1 = tierra (O2→O4),  a2 = manivela (entrada),
 *               a3 = acoplador,        a4 = balancín (salida).
 *
 * CIERRE DE LAZO (vectorial complejo, con la tierra a lo largo de γ):
 *   a2·e^{iθ2} + a3·e^{iθ3} = a1·e^{iγ} + a4·e^{iθ4}
 *
 * Eliminando θ3 → ecuación de FREUDENSTEIN (medida desde el eje de la tierra,
 * i.e. con θ2, θ4 relativos a la dirección O2→O4):
 *   K1·cos θ4 − K2·cos θ2 + K3 = cos(θ2 − θ4)
 *   K1 = a1/a2,   K2 = a1/a4,   K3 = (a2² − a3² + a4² + a1²) / (2·a2·a4)
 *
 * Resuelta por medio-tangente t = tan(θ4/2)  ⇒  A·t² + B·t + C = 0:
 *   A = cos θ2 − K1 − K2·cos θ2 + K3
 *   B = −2·sin θ2
 *   C = K1 − (K2+1)·cos θ2 + K3
 *   θ4 = 2·atan2(−B ± √(B²−4AC),  2A)        (DOS RAMAS: + abierto, − cruzado)
 *
 * El punto ACOPLADOR P (efector) se ubica por un parámetro local sobre el
 * eslabón acoplador A→B: una distancia `rp`·a3 a lo largo de A→B y una
 * perpendicular `sp`·a3 (offset del punto de seguimiento). Al barrer θ2 traza
 * la CURVA DEL ACOPLADOR — una séxtica (grado 6).
 *
 * Convención de marco: todos los ángulos θ2/θ4 reportados son ABSOLUTOS en el
 * marco mundo (ya rotados por γ). Internamente Freudenstein opera en el marco
 * de la tierra (θ2 − γ, θ4 − γ) y luego se re-suma γ.
 *
 * PURO y VERIFICABLE: cero estado, cero random, cero reloj. El invariante de
 * cierre de lazo (`loopResidual`) debe ser ~0 (< 1e-9) en cada θ2 evaluable.
 */

export interface FourBarParams {
  /** a1 — eslabón de tierra O2→O4. */
  ground: number;
  /** a2 — manivela / entrada (la que mueve el motor). */
  crank: number;
  /** a3 — acoplador. */
  coupler: number;
  /** a4 — balancín / salida. */
  rocker: number;
  /** Posición mundo del pivote de tierra O2 (default origen). */
  groundPos?: [number, number];
  /** Ángulo γ del eslabón de tierra O2→O4 respecto a +X (rad, default 0). */
  groundAngle?: number;
  /**
   * Punto acoplador P sobre el eslabón acoplador, en coordenadas
   * adimensionales relativas a A→B:
   *   rp = fracción a lo largo de A→B (0 = en A, 1 = en B).
   *   sp = offset perpendicular (a la izquierda de A→B), en fracciones de a3.
   * El punto físico es P = A + (rp·a3)·û + (sp·a3)·n̂, con û = (B−A)/a3 y n̂ = û⊥.
   */
  couplerRp?: number;
  couplerSp?: number;
}

/** Una rama del montaje: abierto (open, raíz +) o cruzado (crossed, raíz −). */
export type FourBarBranch = 'open' | 'crossed';

export interface FourBarPose {
  /** Ángulo de entrada θ2 (rad, marco mundo). */
  theta2: number;
  /** Ángulo de salida θ4 (rad, marco mundo) resuelto por Freudenstein. */
  theta4: number;
  /** Ángulo del acoplador θ3 (rad, marco mundo). */
  theta3: number;
  /** Pivote de tierra de la manivela O2 (mundo). */
  O2: [number, number];
  /** Pivote de tierra del balancín O4 (mundo). */
  O4: [number, number];
  /** Punta de la manivela A (mundo). */
  A: [number, number];
  /** Punta del balancín B (mundo). */
  B: [number, number];
  /** Punto acoplador (efector) P (mundo). */
  P: [number, number];
  /**
   * Ángulo de transmisión μ — ángulo entre acoplador (a3) y balancín (a4) en B.
   * 0 < μ < π; ideal ~90°, gate duro 40°–140°.
   */
  mu: number;
  /** Rama usada para este pose. */
  branch: FourBarBranch;
  /**
   * Residual del cierre de lazo:  ‖a2·e^{iθ2}+a3·e^{iθ3} − a1·e^{iγ} − a4·e^{iθ4}‖.
   * INVARIANTE: debe ser ~0 (< 1e-9) en una solución válida.
   */
  loopResidual: number;
  /**
   * true si en este θ2 el mecanismo es ENSAMBLABLE (discriminante ≥ 0). Si es
   * false los demás campos repiten la última pose válida (no se inventan).
   */
  assembled: boolean;
}

const TAU = Math.PI * 2;

/** Discriminante de Freudenstein en θ2 (marco de la tierra). ≥0 ⇒ ensamblable. */
function freudensteinABC(p: FourBarParams, th2g: number): { A: number; B: number; C: number } {
  const { ground: a1, crank: a2, rocker: a4 } = p;
  const a3 = p.coupler;
  const K1 = a1 / a2;
  const K2 = a1 / a4;
  const K3 = (a2 * a2 - a3 * a3 + a4 * a4 + a1 * a1) / (2 * a2 * a4);
  const c2 = Math.cos(th2g);
  // A t² + B t + C = 0,  t = tan(θ4/2),  θ2/θ4 en marco de la tierra.
  const A = c2 - K1 - K2 * c2 + K3;
  const B = -2 * Math.sin(th2g);
  const C = K1 - (K2 + 1) * c2 + K3;
  return { A, B, C };
}

/**
 * OPERADOR FORWARD — dado {a1..a4, tierra} y θ2 (mundo), devuelve la pose
 * completa (4 juntas + punto acoplador) vía Freudenstein, eligiendo la rama
 * indicada. PURO.
 *
 * Si el mecanismo no ensambla en este θ2 (raíz compleja), `assembled=false` y
 * se devuelve un pose degenerado coherente (A bien colocado, B = A, μ = 0).
 */
export function fourBarPose(
  p: FourBarParams,
  theta2: number,
  branch: FourBarBranch = 'open',
): FourBarPose {
  const { ground: a1, crank: a2, coupler: a3, rocker: a4 } = p;
  const gp = p.groundPos ?? [0, 0];
  const gamma = p.groundAngle ?? 0;
  const rp = p.couplerRp ?? 0.5;
  const sp = p.couplerSp ?? 0.0;

  const O2: [number, number] = [gp[0], gp[1]];
  const O4: [number, number] = [gp[0] + a1 * Math.cos(gamma), gp[1] + a1 * Math.sin(gamma)];

  // Punta de la manivela A (mundo).
  const A: [number, number] = [O2[0] + a2 * Math.cos(theta2), O2[1] + a2 * Math.sin(theta2)];

  // Freudenstein en el marco de la TIERRA (restamos γ a θ2).
  const th2g = theta2 - gamma;
  const { A: fa, B: fb, C: fc } = freudensteinABC(p, th2g);

  const disc = fb * fb - 4 * fa * fc;
  if (disc < 0) {
    // No ensambla en este θ2 — pose degenerado honesto.
    return {
      theta2, theta4: theta2, theta3: theta2,
      O2, O4, A, B: [A[0], A[1]], P: [A[0], A[1]],
      mu: 0, branch, loopResidual: NaN, assembled: false,
    };
  }

  const sq = Math.sqrt(disc);
  // Manejo robusto de A≈0 (ecuación se vuelve lineal): t = −C/B.
  let t: number;
  if (Math.abs(fa) < 1e-12) {
    t = Math.abs(fb) > 1e-12 ? -fc / fb : 0;
  } else {
    t = branch === 'open' ? (-fb + sq) / (2 * fa) : (-fb - sq) / (2 * fa);
  }
  const th4g = 2 * Math.atan(t);
  const theta4 = th4g + gamma; // de vuelta al marco mundo.

  // Punta del balancín B (mundo).
  const B: [number, number] = [O4[0] + a4 * Math.cos(theta4), O4[1] + a4 * Math.sin(theta4)];

  // Ángulo del acoplador θ3 desde A→B (mundo).
  const theta3 = Math.atan2(B[1] - A[1], B[0] - A[0]);

  // Punto acoplador P: marco local del eslabón A→B.
  const ux = Math.cos(theta3), uy = Math.sin(theta3);      // û = (B−A)/a3
  const nx = -uy, ny = ux;                                  // n̂ = û⊥ (izquierda)
  const P: [number, number] = [
    A[0] + rp * a3 * ux + sp * a3 * nx,
    A[1] + rp * a3 * uy + sp * a3 * ny,
  ];

  // Ángulo de transmisión μ — entre acoplador (A→B) y balancín (O4→B), en B.
  // Ley de cosenos sobre el triángulo cerrado A-B-O4 no es directa; se mide el
  // ángulo entre los vectores (A−B) y (O4−B).
  const v1x = A[0] - B[0], v1y = A[1] - B[1];
  const v2x = O4[0] - B[0], v2y = O4[1] - B[1];
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.hypot(v1x, v1y), m2 = Math.hypot(v2x, v2y);
  let mu = Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2 + 1e-30))));
  // μ y su suplemento son equivalentes para el criterio (se toma el agudo-equiv).
  if (mu > Math.PI / 2) mu = Math.PI - mu;

  // INVARIANTE de cierre de lazo:
  //   a2·e^{iθ2} + a3·e^{iθ3} − a1·e^{iγ} − a4·e^{iθ4}  →  0
  const lx = a2 * Math.cos(theta2) + a3 * Math.cos(theta3) - a1 * Math.cos(gamma) - a4 * Math.cos(theta4);
  const ly = a2 * Math.sin(theta2) + a3 * Math.sin(theta3) - a1 * Math.sin(gamma) - a4 * Math.sin(theta4);
  const loopResidual = Math.hypot(lx, ly);

  return { theta2, theta4, theta3, O2, O4, A, B, P, mu, branch, loopResidual, assembled: true };
}

// ─────────────────────────────────────────────────────────────
// Grashof + clasificación (gate R3 del plan)
// ─────────────────────────────────────────────────────────────

export type GrashofClass =
  | 'crank-rocker'      // s+l<p+q, manivela = más corta, adyacente a tierra
  | 'double-crank'      // s+l<p+q, más corta = tierra
  | 'double-rocker'     // s+l<p+q, más corta = acoplador
  | 'change-point'      // s+l = p+q (igualdad)
  | 'triple-rocker';    // s+l>p+q (no-Grashof: ningún eslabón da vuelta completa)

export interface GrashofResult {
  /** s + l (más corto + más largo). */
  sPlusL: number;
  /** p + q (los otros dos). */
  pPlusQ: number;
  /** true si s+l ≤ p+q. */
  grashof: boolean;
  /** Índice 0..3 del eslabón más corto en orden [ground,crank,coupler,rocker]. */
  shortestIdx: number;
  /** Clasificación cinemática. */
  klass: GrashofClass;
  /** true si la manivela (a2) puede dar revolución COMPLETA (1 motor). */
  crankRotatesFully: boolean;
}

/** Clasificación de Grashof — gate R3. La manivela es el índice 1 (a2).
 *  Usa MAGNITUDES: una longitud signada negativa (de la síntesis) es físicamente
 *  una barra de la misma longitud apuntando al revés. */
export function grashof(p: FourBarParams): GrashofResult {
  const links = [Math.abs(p.ground), Math.abs(p.crank), Math.abs(p.coupler), Math.abs(p.rocker)];
  const sorted = [...links].sort((a, b) => a - b);
  const s = sorted[0], l = sorted[3];
  const p1 = sorted[1], q = sorted[2];
  const sPlusL = s + l;
  const pPlusQ = p1 + q;
  const grash = sPlusL <= pPlusQ + 1e-12;
  const shortestIdx = links.indexOf(s);
  const eq = Math.abs(sPlusL - pPlusQ) < 1e-9;

  let klass: GrashofClass;
  if (eq) klass = 'change-point';
  else if (!grash) klass = 'triple-rocker';
  else if (shortestIdx === 0) klass = 'double-crank';       // tierra = más corto
  else if (shortestIdx === 2) klass = 'double-rocker';      // acoplador = más corto
  else klass = 'crank-rocker';                              // manivela o balancín = más corto

  // La manivela a2 (idx 1) gira completo si es el eslabón más corto Y Grashof.
  const crankRotatesFully = grash && shortestIdx === 1;

  return { sPlusL, pPlusQ, grashof: grash, shortestIdx, klass, crankRotatesFully };
}

// ─────────────────────────────────────────────────────────────
// SÍNTESIS EXACTA — FREUDENSTEIN (generación de función, 3 puntos)
// Fase 2 / Ruta A del plan: dados 3 pares (θ2_i, θ4_i) el sistema es
// LINEAL en (K1,K2,K3) → 3×3 → se invierte y se leen las longitudes.
// EXACTO: el four-bar sintetizado clava los 3 puntos al evaluar el forward.
// ─────────────────────────────────────────────────────────────

export interface PrecisionPoint {
  /** Ángulo de entrada θ2_i (rad, marco de la tierra). */
  theta2: number;
  /** Ángulo de salida deseado θ4_i (rad, marco de la tierra). */
  theta4: number;
}

export interface FreudensteinSynthesis {
  /** true si el sistema 3×3 se resolvió y existe un four-bar real (a3² > 0). */
  ok: boolean;
  /** Coeficientes de Freudenstein recuperados. */
  K1: number;
  K2: number;
  K3: number;
  /**
   * Longitudes recuperadas (a1 = ground se fija como escala libre).
   * IMPORTANTE: crank (a2) y rocker (a4) pueden salir NEGATIVAS — eso es físico:
   * la longitud negativa equivale a la barra apuntando en sentido opuesto (offset
   * de fase π). El operador forward `fourBarPose` consume estas longitudes
   * SIGNADAS y produce el cierre de lazo EXACTO; no se debe tomar valor absoluto
   * o la síntesis deja de clavar los puntos. Para mostrar al usuario se reporta
   * la magnitud (|a2|, |a4|) y, si hubo signo negativo, se anota.
   */
  ground: number;   // a1
  crank: number;    // a2 (signada)
  coupler: number;  // a3 (siempre > 0)
  rocker: number;   // a4 (signada)
  /** Parámetros del four-bar sintetizado (longitudes SIGNADAS), para fourBarPose. */
  params: FourBarParams | null;
  /** Diagnóstico legible si ok=false. */
  reason?: string;
}

/**
 * SÍNTESIS DE FREUDENSTEIN — generación de función con 3 puntos de precisión.
 *
 * La ecuación de Freudenstein (misma convención que `fourBarPose`):
 *   K1·cos θ4 − K2·cos θ2 + K3 = cos(θ2 − θ4)
 * es LINEAL en (K1, K2, K3). Con 3 pares (θ2_i, θ4_i) se arma el sistema 3×3:
 *
 *   [ cos θ4_1  −cos θ2_1   1 ] [K1]   [ cos(θ2_1 − θ4_1) ]
 *   [ cos θ4_2  −cos θ2_2   1 ] [K2] = [ cos(θ2_2 − θ4_2) ]
 *   [ cos θ4_3  −cos θ2_3   1 ] [K3]   [ cos(θ2_3 − θ4_3) ]
 *
 * Se resuelve con `solveLinearSystem` (eliminación gaussiana de formulas.ts) y se
 * recuperan las longitudes (a1 = ground es escala libre, default 1):
 *   K2 = a1/a2  ⇒  a2 = a1/K2          (manivela)
 *   K1 = a1/a4  ⇒  a4 = a1/K1          (balancín)
 *   K3 = (a2² − a3² + a4² + a1²)/(2·a2·a4)
 *        ⇒  a3² = a2² + a4² + a1² − 2·a2·a4·K3   (acoplador)
 *
 * EXACTO: al evaluar `fourBarPose` del four-bar sintetizado en cada θ2_i se
 * recupera θ4_i con error ~1e-9 (Freudenstein es lineal, no aproximado).
 *
 * @param pts        3 puntos de precisión (θ2_i, θ4_i) en RADIANES (marco tierra).
 * @param groundSize a1 (escala libre); el four-bar es invariante a escala. Default 1.
 * @param solver     inyecta solveLinearSystem (reusa el de formulas.ts).
 */
export function synthesizeFreudenstein(
  pts: PrecisionPoint[],
  groundSize: number,
  solver: (K: number[][], f: number[]) => number[],
): FreudensteinSynthesis {
  if (pts.length !== 3) {
    return blankSynth(`se requieren exactamente 3 puntos de precisión (se dieron ${pts.length})`);
  }

  // Armar el sistema 3×3:  fila_i = [cos θ4_i, −cos θ2_i, 1],  rhs_i = cos(θ2_i − θ4_i).
  const M: number[][] = pts.map((q) => [Math.cos(q.theta4), -Math.cos(q.theta2), 1]);
  const rhs: number[] = pts.map((q) => Math.cos(q.theta2 - q.theta4));

  let K: number[];
  try {
    K = solver(M, rhs);
  } catch (e) {
    return blankSynth(`sistema 3×3 singular (puntos colineales/degenerados): ${(e as Error).message}`);
  }
  const [K1, K2, K3] = K;

  if (!Number.isFinite(K1) || !Number.isFinite(K2) || !Number.isFinite(K3)) {
    return blankSynth('solución no finita (puntos degenerados)');
  }
  if (Math.abs(K1) < 1e-12 || Math.abs(K2) < 1e-12) {
    return blankSynth('K1 o K2 ≈ 0 → longitud infinita (mecanismo degenerado)');
  }

  // Recuperación de longitudes (convención EXACTA del forward de fourBarPose):
  //   K1 = a1/a2 ⇒ a2 = a1/K1   (manivela, SIGNADA)
  //   K2 = a1/a4 ⇒ a4 = a1/K2   (balancín, SIGNADA)
  //   K3 = (a2²−a3²+a4²+a1²)/(2 a2 a4) ⇒ a3² = a2²+a4²+a1² − 2 a2 a4 K3
  const a1 = groundSize;
  const a2 = a1 / K1;
  const a4 = a1 / K2;
  const a3sq = a2 * a2 + a4 * a4 + a1 * a1 - 2 * a2 * a4 * K3;

  if (a3sq <= 0) {
    return blankSynth(`acoplador imaginario (a3² = ${a3sq.toExponential(2)} ≤ 0): no existe four-bar real para esos puntos`);
  }
  const a3 = Math.sqrt(a3sq);

  if (Math.abs(a2) < 1e-9 || Math.abs(a4) < 1e-9 || a3 < 1e-9) {
    return blankSynth('longitud ≈ 0 → mecanismo degenerado');
  }

  // Longitudes SIGNADAS: el forward las consume tal cual (a2/a4 negativas =
  // barra invertida de fase π). NO tomar valor absoluto — rompería la exactitud.
  const params: FourBarParams = {
    ground: a1, crank: a2, coupler: a3, rocker: a4,
    groundPos: [0, 0], groundAngle: 0, couplerRp: 0.5, couplerSp: 0.6,
  };

  return { ok: true, K1, K2, K3, ground: a1, crank: a2, coupler: a3, rocker: a4, params };
}

function blankSynth(reason: string): FreudensteinSynthesis {
  return {
    ok: false, K1: NaN, K2: NaN, K3: NaN,
    ground: NaN, crank: NaN, coupler: NaN, rocker: NaN, params: null, reason,
  };
}

/**
 * VERIFICACIÓN DE EXACTITUD — corre el FORWARD del four-bar sintetizado en cada
 * θ2_i y mide el error angular |θ4_calculado − θ4_objetivo| (envuelto a (−π,π]).
 * Devuelve el error máximo sobre los 3 puntos. Freudenstein EXACTO ⇒ < 1e-9.
 *
 * Prueba AMBAS ramas por punto y toma la menor (Freudenstein no fija rama; el
 * four-bar pasa por θ4_i en una de las dos ramas de montaje).
 */
export function freudensteinSynthesisError(
  params: FourBarParams,
  pts: PrecisionPoint[],
): { maxError: number; errors: number[] } {
  const errors = pts.map((q) => {
    const open = fourBarPose(params, q.theta2, 'open');
    const crossed = fourBarPose(params, q.theta2, 'crossed');
    const candidates: number[] = [];
    if (open.assembled) candidates.push(Math.abs(angleDelta(open.theta4, q.theta4)));
    if (crossed.assembled) candidates.push(Math.abs(angleDelta(crossed.theta4, q.theta4)));
    return candidates.length ? Math.min(...candidates) : Infinity;
  });
  return { maxError: Math.max(...errors), errors };
}

// ─────────────────────────────────────────────────────────────
// BARRIDO θ2 ∈ [0, 2π) → CURVA DEL ACOPLADOR + invariantes
// ─────────────────────────────────────────────────────────────

export interface FourBarSweep {
  /** Poses muestreadas (las assembled=true en orden de θ2). */
  poses: FourBarPose[];
  /** Polilínea cerrada del punto acoplador P (solo poses ensamblables). */
  couplerCurve: [number, number][];
  /** Máximo residual de cierre de lazo sobre el barrido (INVARIANTE ≈ 0). */
  maxLoopResidual: number;
  /** Mínimo / máximo ángulo de transmisión μ (rad) sobre el barrido. */
  muMin: number;
  muMax: number;
  /** true si TODO θ2∈[0,2π) ensambla (rama válida en todo el ciclo). */
  fullCircleAssembles: boolean;
  /** Fracción del ciclo que ensambla (0..1). */
  assembledFraction: number;
}

/**
 * Barre θ2 ∈ [0, 2π) en `samples` pasos eligiendo la rama por CONTINUIDAD:
 * arranca con la rama pedida y, en cada paso, escoge la raíz (open/crossed)
 * cuyo θ4 sea más cercano al θ4 previo — evita el salto de rama.
 */
export function fourBarSweep(
  p: FourBarParams,
  samples = 240,
  startBranch: FourBarBranch = 'open',
): FourBarSweep {
  const poses: FourBarPose[] = [];
  const couplerCurve: [number, number][] = [];
  let maxLoopResidual = 0;
  let muMin = Infinity, muMax = -Infinity;
  let assembledCount = 0;
  let prevTheta4: number | null = null;

  for (let i = 0; i < samples; i++) {
    const theta2 = (TAU * i) / samples;

    const open = fourBarPose(p, theta2, 'open');
    const crossed = fourBarPose(p, theta2, 'crossed');

    let chosen: FourBarPose;
    if (!open.assembled && !crossed.assembled) {
      poses.push(open); // degenerado honesto
      continue;
    } else if (open.assembled && !crossed.assembled) {
      chosen = open;
    } else if (!open.assembled && crossed.assembled) {
      chosen = crossed;
    } else if (prevTheta4 === null) {
      chosen = startBranch === 'open' ? open : crossed;
    } else {
      // Continuidad: la rama cuyo θ4 esté más cerca del previo.
      const dOpen = Math.abs(angleDelta(open.theta4, prevTheta4));
      const dCrossed = Math.abs(angleDelta(crossed.theta4, prevTheta4));
      chosen = dOpen <= dCrossed ? open : crossed;
    }

    prevTheta4 = chosen.theta4;
    poses.push(chosen);
    couplerCurve.push(chosen.P);
    assembledCount++;
    if (Number.isFinite(chosen.loopResidual)) {
      maxLoopResidual = Math.max(maxLoopResidual, chosen.loopResidual);
    }
    muMin = Math.min(muMin, chosen.mu);
    muMax = Math.max(muMax, chosen.mu);
  }

  return {
    poses,
    couplerCurve,
    maxLoopResidual,
    muMin: Number.isFinite(muMin) ? muMin : 0,
    muMax: Number.isFinite(muMax) ? muMax : 0,
    fullCircleAssembles: assembledCount === samples,
    assembledFraction: assembledCount / samples,
  };
}

/** Diferencia angular mínima a − b normalizada a (−π, π]. */
function angleDelta(a: number, b: number): number {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// ─────────────────────────────────────────────────────────────
// Presets canónicos
// ─────────────────────────────────────────────────────────────

export const FOURBAR_PRESETS: Record<string, FourBarParams> = {
  // Crank-rocker clásico (Grashof, manivela = más corta). a2 da vuelta completa.
  'crank-rocker': {
    ground: 4.0, crank: 1.0, coupler: 3.5, rocker: 3.0,
    groundPos: [0, 0], groundAngle: 0, couplerRp: 0.55, couplerSp: 0.9,
  },
  // Doble-balancín (no-Grashof): ningún eslabón rota completo.
  'double-rocker': {
    ground: 2.0, crank: 3.0, coupler: 2.0, rocker: 3.0,
    groundPos: [0, 0], groundAngle: 0, couplerRp: 0.5, couplerSp: 0.7,
  },
  // Curva acopladora con forma de "riñón" (típica para didáctica).
  'kidney': {
    ground: 2.5, crank: 1.0, coupler: 2.5, rocker: 2.2,
    groundPos: [0, 0], groundAngle: 0, couplerRp: 0.5, couplerSp: 1.2,
  },
};
