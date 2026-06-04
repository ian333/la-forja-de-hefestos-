/**
 * GENERADOR DE MECANISMOS — síntesis paramétrica de un brazo robótico planar
 * (cadena serial de N juntas de revoluta) + receta imprimible de cada eslabón.
 *
 * Es la base del "diseño generativo de mecanismos": la matemática REAL del
 * mecanismo (movilidad, cinemática directa, alcance, espacio de trabajo,
 * condición de Grashof) genera las dimensiones; cada eslabón sale como una pieza
 * imprimible (barra plana con dos barrenos de junta). Puro (sin WASM) → testeable.
 *
 * Refs: Grübler–Kutzbach (movilidad), cinemática directa planar, Grashof.
 */

export interface ArmParams {
  segLengths: number[];   // longitud centro-a-centro de cada eslabón (mm)
  width: number;          // ancho de la barra (mm)
  thickness: number;      // espesor (mm) — imprimible plano
  boreD: number;          // ⌀ del barreno de junta (perno/balero) (mm)
}
export interface Vec2 { x: number; y: number; }

/** Movilidad planar (Grübler–Kutzbach): M = 3(n−1) − 2·j1 − j2.
 *  Para una cadena serial de N juntas de revoluta: n = N+1 eslabones (incl.
 *  tierra), j1 = N juntas inferiores → M = N (N grados de libertad). */
export function grublerMobility(nLinks: number, nLowerJoints: number, nHigherJoints = 0): number {
  return 3 * (nLinks - 1) - 2 * nLowerJoints - nHigherJoints;
}

/** Cinemática directa planar: posiciones de las juntas + efector final.
 *  `angles` son ángulos RELATIVOS de cada junta (rad); el ángulo absoluto del
 *  eslabón i es la suma acumulada. Junta 0 en el origen. */
export function forwardKinematics(segLengths: number[], angles: number[]): { joints: Vec2[]; end: Vec2; endAngle: number } {
  const joints: Vec2[] = [{ x: 0, y: 0 }];
  let phi = 0, x = 0, y = 0;
  for (let i = 0; i < segLengths.length; i++) {
    phi += angles[i] ?? 0;
    x += segLengths[i] * Math.cos(phi);
    y += segLengths[i] * Math.sin(phi);
    joints.push({ x, y });
  }
  return { joints, end: { x, y }, endAngle: phi };
}

/** Alcance máximo (todo extendido) = Σ longitudes. */
export function reach(segLengths: number[]): number {
  return segLengths.reduce((s, l) => s + l, 0);
}

/** Espacio de trabajo planar (anillo): radio máx = ΣL; radio mín = max(0,
 *  2·Lmax − ΣL) (si un eslabón domina, hay hueco central). */
export function workspace(segLengths: number[]): { rMax: number; rMin: number } {
  const total = reach(segLengths);
  const lMax = Math.max(...segLengths, 0);
  return { rMax: total, rMin: Math.max(0, 2 * lMax - total) };
}

/** Condición de Grashof para un cuatro-barras (s≤l, p,q los otros dos):
 *  s+l ≤ p+q ⇒ al menos un eslabón da vuelta completa. Clasifica el tipo. */
export function grashof(a: number, b: number, c: number, d: number): { isGrashof: boolean; type: string } {
  const L = [a, b, c, d].slice().sort((x, y) => x - y);
  const [s, , , l] = L;
  const sumSL = s + l, sumPQ = L[1] + L[2];
  const isGrashof = sumSL <= sumPQ;
  let type: string;
  if (sumSL < sumPQ) type = 'Grashof (manivela-balancín / doble manivela según base)';
  else if (sumSL === sumPQ) type = 'cambio de punto (folding)';
  else type = 'no-Grashof (triple balancín)';
  return { isGrashof, type };
}

/** RECETA imprimible de UN eslabón: barra plana (largo L centro-a-centro, ancho
 *  W, espesor T) con extremos redondeados y un barreno ⌀D en cada junta.
 *  Devuelve las dimensiones del sketch+ops para construirlo en La Forja. */
export interface LinkRecipe {
  index: number; length: number;
  sketch: { width: number; height: number };   // bounding del rect base (L+W × W)
  thickness: number;
  filletR: number;                              // redondeo de extremos (W/2)
  bores: Array<{ x: number; y: number; d: number }>;  // 2 barrenos en ±L/2
  volumeApprox: number;                         // mm³ aprox (placa − barrenos)
}
export function linkRecipe(index: number, length: number, p: ArmParams): LinkRecipe {
  const W = p.width, T = p.thickness, D = p.boreD;
  const bbW = length + W;   // la barra sobra W/2 por cada extremo (los cubos)
  const plate = bbW * W * T;
  const holes = 2 * (Math.PI * (D / 2) ** 2 * T);
  return {
    index, length,
    sketch: { width: bbW, height: W },
    thickness: T, filletR: W / 2,
    bores: [{ x: -length / 2, y: 0, d: D }, { x: length / 2, y: 0, d: D }],
    volumeApprox: plate - holes,
  };
}

/** Genera el brazo completo: receta de cada eslabón + cinemática en una pose. */
export function generateArm(p: ArmParams, pose?: number[]): {
  links: LinkRecipe[]; mobility: number; reach: number;
  workspace: { rMax: number; rMin: number };
  fk: ReturnType<typeof forwardKinematics>;
} {
  const N = p.segLengths.length;
  const angles = pose ?? new Array(N).fill(0);
  return {
    links: p.segLengths.map((L, i) => linkRecipe(i, L, p)),
    mobility: grublerMobility(N + 1, N),   // N+1 eslabones (incl. base), N juntas
    reach: reach(p.segLengths),
    workspace: workspace(p.segLengths),
    fk: forwardKinematics(p.segLengths, angles),
  };
}
