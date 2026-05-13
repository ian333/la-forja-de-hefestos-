/**
 * Scoring simplificado estilo AutoDock Vina (Trott & Olson, 2010).
 *
 * Vina descompone la energía de binding en 5 términos que son funciones
 * explícitas de la distancia superficial `d` entre cada par de átomos:
 *
 *     d = r_real − (r_vdw(a) + r_vdw(b))     (Å, negativo = overlap)
 *
 *     gauss1       = exp(−(d / 0.5)²)                       (atractivo, peak d=0)
 *     gauss2       = exp(−((d − 3.0) / 2.0)²)               (atractivo, peak d=3)
 *     repulsion    = d² si d < 0, 0 si d ≥ 0                (penalización clash)
 *     hydrophobic  = rampa lineal 1→0 entre d=0.5 y d=1.5   (C–C)
 *     hbond        = rampa lineal 1→0 entre d=−0.7 y d=0    (donor/acceptor)
 *
 * Sumamos con los pesos publicados (kcal/mol ≈ -0.035*g1 -0.005*g2
 * +0.840*rep -0.035*hyd -0.587*hbond). El score global tiene unidades ≈
 * kcal/mol pero es aproximado — suficiente para enseñar la intuición.
 *
 * El ligando es rígido en este módulo (no hay penalización torsional),
 * así el usuario puede mover/rotar como una pieza.
 */

import type { Atom, Element } from './pdb';
import { VDW_RADIUS } from './pdb';

/** Elementos donantes / aceptores típicos de H-bond. */
const HBOND_DONOR = new Set<Element>(['N', 'O']);
const HBOND_ACCEPTOR = new Set<Element>(['N', 'O', 'F']);

export interface DockAtom {
  element: Element;
  /** Coordenadas en Å, LOCALES al centroide del ligando. */
  local: [number, number, number];
  isPolar: boolean;    // N, O — participa en H-bonds
  isHydrophobic: boolean; // C (sin polaridad vecinal obvia)
}

export interface ProteinAtom {
  element: Element;
  pos: [number, number, number];
  isPolar: boolean;
  isHydrophobic: boolean;
}

export interface ScoreBreakdown {
  gauss1: number;
  gauss2: number;
  repulsion: number;
  hydrophobic: number;
  hbond: number;
  total: number;
  nContacts: number;   // pares dentro de cutoff — solo informativo
  clashCount: number;  // pares con overlap > 1 Å
}

const W_G1 = -0.035579;
const W_G2 = -0.005156;
const W_REP = 0.840245;
const W_HYD = -0.035069;
const W_HB = -0.587439;
const CUTOFF = 8.0;

export function classifyAtom(a: { element: Element; name?: string }): {
  isPolar: boolean; isHydrophobic: boolean;
} {
  const e = a.element;
  if (HBOND_DONOR.has(e) || HBOND_ACCEPTOR.has(e) || e === 'S') {
    return { isPolar: true, isHydrophobic: false };
  }
  if (e === 'C') {
    // A strict classifier would check bonded neighbors; we approximate carbons
    // as hydrophobic by default. Polar carbons (C=O, C-N) will still contribute
    // to repulsion correctly through vdW; they just won't get the hydrophobic
    // bonus. For teaching the intuition this is fine.
    return { isPolar: false, isHydrophobic: true };
  }
  return { isPolar: false, isHydrophobic: false };
}

/** Build ligand atom set centered on its centroid (so the group can be placed anywhere). */
export function buildDockLigand(atoms: Atom[]): { atoms: DockAtom[]; centroid: [number, number, number] } {
  const n = atoms.length;
  if (n === 0) return { atoms: [], centroid: [0, 0, 0] };
  const c: [number, number, number] = [0, 0, 0];
  for (const a of atoms) { c[0] += a.pos[0]; c[1] += a.pos[1]; c[2] += a.pos[2]; }
  c[0] /= n; c[1] /= n; c[2] /= n;
  const out: DockAtom[] = atoms.map(a => {
    const cls = classifyAtom(a);
    return {
      element: a.element,
      local: [a.pos[0] - c[0], a.pos[1] - c[1], a.pos[2] - c[2]],
      isPolar: cls.isPolar,
      isHydrophobic: cls.isHydrophobic,
    };
  });
  return { atoms: out, centroid: c };
}

export function buildProteinAtoms(atoms: Atom[]): ProteinAtom[] {
  return atoms
    .filter(a => !a.hetero)
    .map(a => {
      const cls = classifyAtom(a);
      return {
        element: a.element,
        pos: a.pos,
        isPolar: cls.isPolar,
        isHydrophobic: cls.isHydrophobic,
      };
    });
}

/**
 * Spatial hash grid over protein atoms. Each ligand atom only needs to query
 * its 27 neighboring cells (3x3x3) — O(k·n_lig) instead of O(n_lig·n_prot).
 * For 1HSG with ~1500 heavy protein atoms + 55 ligand atoms we save ~30x.
 */
export class ProteinGrid {
  readonly cellSize: number;
  readonly origin: [number, number, number];
  readonly atoms: ProteinAtom[];
  private readonly grid: Map<string, number[]>;

  constructor(atoms: ProteinAtom[], cellSize = CUTOFF) {
    this.atoms = atoms;
    this.cellSize = cellSize;
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    for (const a of atoms) {
      if (a.pos[0] < min[0]) min[0] = a.pos[0];
      if (a.pos[1] < min[1]) min[1] = a.pos[1];
      if (a.pos[2] < min[2]) min[2] = a.pos[2];
    }
    if (!isFinite(min[0])) min[0] = min[1] = min[2] = 0;
    this.origin = min;
    this.grid = new Map();
    for (let i = 0; i < atoms.length; i++) {
      const key = this.keyOf(atoms[i].pos);
      const bucket = this.grid.get(key);
      if (bucket) bucket.push(i);
      else this.grid.set(key, [i]);
    }
  }

  private idx(p: [number, number, number]): [number, number, number] {
    return [
      Math.floor((p[0] - this.origin[0]) / this.cellSize),
      Math.floor((p[1] - this.origin[1]) / this.cellSize),
      Math.floor((p[2] - this.origin[2]) / this.cellSize),
    ];
  }

  private keyOf(p: [number, number, number]): string {
    const [i, j, k] = this.idx(p);
    return `${i}|${j}|${k}`;
  }

  /** Yield indices of candidate protein atoms near the given point. */
  neighbors(p: [number, number, number], out: number[]): void {
    out.length = 0;
    const [i, j, k] = this.idx(p);
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        for (let dk = -1; dk <= 1; dk++) {
          const bucket = this.grid.get(`${i + di}|${j + dj}|${k + dk}`);
          if (bucket) for (const idx of bucket) out.push(idx);
        }
      }
    }
  }
}

/**
 * Apply a rigid transform (quaternion rotation + translation) to a local point.
 * Quaternion in (x, y, z, w) layout, same as THREE.Quaternion.
 */
function applyQuat(out: [number, number, number], local: [number, number, number], q: [number, number, number, number]): void {
  const [x, y, z] = local;
  const [qx, qy, qz, qw] = q;
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  out[0] = x + qw * tx + (qy * tz - qz * ty);
  out[1] = y + qw * ty + (qz * tx - qx * tz);
  out[2] = z + qw * tz + (qx * ty - qy * tx);
}

/**
 * Compute the full Vina-like score for a ligand placed at `pos` with rotation
 * `quat` (applied to the atoms' local coords). Returns a breakdown in ~kcal/mol.
 */
export function scoreDocking(
  ligAtoms: DockAtom[],
  grid: ProteinGrid,
  pos: [number, number, number],
  quat: [number, number, number, number],
): ScoreBreakdown {
  let g1 = 0, g2 = 0, rep = 0, hyd = 0, hb = 0;
  let nContacts = 0, clashCount = 0;
  const world: [number, number, number] = [0, 0, 0];
  const rotated: [number, number, number] = [0, 0, 0];
  const neighbors: number[] = [];
  const proteinAtoms = grid.atoms;

  for (const lig of ligAtoms) {
    applyQuat(rotated, lig.local, quat);
    world[0] = rotated[0] + pos[0];
    world[1] = rotated[1] + pos[1];
    world[2] = rotated[2] + pos[2];
    const rLig = VDW_RADIUS[lig.element] ?? 1.6;
    grid.neighbors(world, neighbors);
    for (const pi of neighbors) {
      const p = proteinAtoms[pi];
      const dx = world[0] - p.pos[0];
      const dy = world[1] - p.pos[1];
      const dz = world[2] - p.pos[2];
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (r > CUTOFF) continue;
      const rProt = VDW_RADIUS[p.element] ?? 1.6;
      const d = r - (rLig + rProt);
      nContacts++;
      // Attractive gaussians — centred at d=0 and d=3 Å.
      g1 += Math.exp(-((d / 0.5) ** 2));
      g2 += Math.exp(-(((d - 3.0) / 2.0) ** 2));
      // Repulsion: quadratic in overlap depth.
      if (d < 0) { rep += d * d; if (d < -1.0) clashCount++; }
      // Hydrophobic contact (both C): piecewise linear 1→0 between d=0.5 and d=1.5.
      if (lig.isHydrophobic && p.isHydrophobic) {
        if (d < 0.5) hyd += 1;
        else if (d < 1.5) hyd += (1.5 - d);
      }
      // H-bond: one polar + one polar close (d in [-0.7, 0]).
      if (lig.isPolar && p.isPolar) {
        if (d < -0.7) hb += 1;
        else if (d < 0) hb += (-d / 0.7);
      }
    }
  }

  const total = W_G1 * g1 + W_G2 * g2 + W_REP * rep + W_HYD * hyd + W_HB * hb;
  return { gauss1: g1, gauss2: g2, repulsion: rep, hydrophobic: hyd, hbond: hb, total, nContacts, clashCount };
}

// ═══════════════════════════════════════════════════════════════
//   Vinardo: scoring alternativo (Quiroga & Villarreal, PLoS ONE 2016)
// ═══════════════════════════════════════════════════════════════
//
// Vinardo simplifica Vina:
//   - 1 sola gaussiana atractiva (en lugar de 2)
//   - Repulsión más empinada (potencia mayor)
//   - Mismos términos hidrofóbico y H-bond, pero pesos refittedos contra
//     CSAR-NRC benchmark (Quiroga & Villarreal 2016, doi:10.1371/journal.pone.0155183)
//
//   gauss        = exp(-(d / 0.8)²)          (ancho mayor, peak d=0)
//   repulsion'   = d² si d < 0 (mismo)
//   hydrophobic, hbond — iguales a Vina
//
// Pesos refittedos:  W_GAUSS = -0.045  W_REP = 0.800
//                    W_HYD   = -0.035  W_HB  = -0.600
//
// Vinardo da scores ~10% mejores que Vina en pose-ranking pero ~5% peores
// en affinity-prediction. Buena alternativa para enseñar la sensibilidad
// del scoring a la elección de funcional.

const W_VIN_GAUSS = -0.045;
const W_VIN_REP = 0.800;
const W_VIN_HYD = -0.035;
const W_VIN_HB = -0.600;

export interface VinardoBreakdown {
  gauss: number;
  repulsion: number;
  hydrophobic: number;
  hbond: number;
  total: number;
  nContacts: number;
  clashCount: number;
}

export function scoreDockingVinardo(
  ligAtoms: DockAtom[],
  grid: ProteinGrid,
  pos: [number, number, number],
  quat: [number, number, number, number],
): VinardoBreakdown {
  let g = 0, rep = 0, hyd = 0, hb = 0;
  let nContacts = 0, clashCount = 0;
  const world: [number, number, number] = [0, 0, 0];
  const rotated: [number, number, number] = [0, 0, 0];
  const neighbors: number[] = [];
  const proteinAtoms = grid.atoms;

  for (const lig of ligAtoms) {
    applyQuat(rotated, lig.local, quat);
    world[0] = rotated[0] + pos[0];
    world[1] = rotated[1] + pos[1];
    world[2] = rotated[2] + pos[2];
    const rLig = VDW_RADIUS[lig.element] ?? 1.6;
    grid.neighbors(world, neighbors);
    for (const pi of neighbors) {
      const p = proteinAtoms[pi];
      const dx = world[0] - p.pos[0];
      const dy = world[1] - p.pos[1];
      const dz = world[2] - p.pos[2];
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (r > CUTOFF) continue;
      const rProt = VDW_RADIUS[p.element] ?? 1.6;
      const d = r - (rLig + rProt);
      nContacts++;
      g += Math.exp(-((d / 0.8) ** 2));
      if (d < 0) { rep += d * d; if (d < -1.0) clashCount++; }
      if (lig.isHydrophobic && p.isHydrophobic) {
        if (d < 0.5) hyd += 1;
        else if (d < 1.5) hyd += (1.5 - d);
      }
      if (lig.isPolar && p.isPolar) {
        if (d < -0.7) hb += 1;
        else if (d < 0) hb += (-d / 0.7);
      }
    }
  }
  const total = W_VIN_GAUSS * g + W_VIN_REP * rep + W_VIN_HYD * hyd + W_VIN_HB * hb;
  return { gauss: g, repulsion: rep, hydrophobic: hyd, hbond: hb, total, nContacts, clashCount };
}

// ═══════════════════════════════════════════════════════════════
//   Conformational search — Metropolis Monte Carlo + greedy refine
// ═══════════════════════════════════════════════════════════════
//
// El espacio conformacional para un ligando rígido es ℝ³ × SO(3) =
// 6 dimensiones (3 trasl + 3 rotac). Para drug-discovery realista hace
// falta también optimizar torsiones, pero la versión rígida es suficiente
// para enseñar la mecánica del docking.
//
// Algoritmo:
//   1. Empezar en pose inicial.
//   2. Iterar:
//      - Proponer perturbación: Δpos ~ N(0, σ_t), Δq ~ rotación aleatoria pequeña.
//      - Aceptar si nuevo score < anterior (greedy), o con prob exp(-ΔE/T) (Metropolis).
//      - Temperatura T decae con un schedule exponencial.
//   3. Retornar mejor pose vista.
//
// Esto es similar al motor MC interno de Vina (Trott & Olson §2.4).
// No reemplaza un docking completo pero es honesto sobre lo que hace.

export interface SearchOptions {
  /** Iteraciones totales. Default 500. */
  iterations?: number;
  /** Desviación trasl. por paso [Å]. Default 0.5. */
  sigmaT?: number;
  /** Desviación rotación por paso [rad]. Default 0.2 (~11°). */
  sigmaR?: number;
  /** Temperatura inicial (Metropolis). Default 2.0 (~kcal/mol). */
  T0?: number;
  /** Factor de enfriamiento por iteración. Default 0.995. */
  cooling?: number;
  /** Semilla para reproducibilidad. */
  seed?: number;
  /** Si se da, optimiza Vinardo en lugar de Vina. */
  useVinardo?: boolean;
}

export interface SearchResult {
  /** Mejor pose vista. */
  bestPos: [number, number, number];
  bestQuat: [number, number, number, number];
  /** Score de la mejor pose. */
  bestScore: number;
  /** Trayectoria de scores [iteración → score]. */
  trace: number[];
  /** Aceptaciones / propuestas. */
  acceptanceRate: number;
}

// Mulberry32 PRNG para reproducibilidad — no usa Math.random() para no contaminar el estado global.
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  // Box-Muller
  const u = Math.max(rng(), 1e-10);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function multiplyQuat(
  a: readonly [number, number, number, number],
  b: readonly [number, number, number, number],
): [number, number, number, number] {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function normalizeQuat(q: [number, number, number, number]): [number, number, number, number] {
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/**
 * Búsqueda Monte Carlo + Metropolis para minimizar el score de docking.
 *
 * Determinístico cuando `seed` está fijo. Reporta trayectoria completa para
 * permitir graficar la convergencia.
 */
export function searchPose(
  ligAtoms: DockAtom[],
  grid: ProteinGrid,
  initialPos: [number, number, number],
  initialQuat: [number, number, number, number],
  opts: SearchOptions = {},
): SearchResult {
  const iterations = opts.iterations ?? 500;
  const sigmaT = opts.sigmaT ?? 0.5;
  const sigmaR = opts.sigmaR ?? 0.2;
  const T0 = opts.T0 ?? 2.0;
  const cooling = opts.cooling ?? 0.995;
  const seed = opts.seed ?? 1;
  const useVinardo = opts.useVinardo ?? false;
  const rng = makeRng(seed);

  const scoreFn = (p: [number, number, number], q: [number, number, number, number]) =>
    useVinardo
      ? scoreDockingVinardo(ligAtoms, grid, p, q).total
      : scoreDocking(ligAtoms, grid, p, q).total;

  let curPos: [number, number, number] = [...initialPos];
  let curQuat: [number, number, number, number] = [...initialQuat];
  let curScore = scoreFn(curPos, curQuat);
  let bestPos = curPos;
  let bestQuat = curQuat;
  let bestScore = curScore;
  const trace: number[] = [curScore];
  let accepts = 0;
  let proposals = 0;
  let T = T0;

  for (let it = 0; it < iterations; it++) {
    const dx = gaussian(rng) * sigmaT;
    const dy = gaussian(rng) * sigmaT;
    const dz = gaussian(rng) * sigmaT;
    // Rotación pequeña por eje aleatorio.
    const ax = gaussian(rng);
    const ay = gaussian(rng);
    const az = gaussian(rng);
    const nrm = Math.hypot(ax, ay, az) || 1;
    const angle = gaussian(rng) * sigmaR;
    const s = Math.sin(angle / 2);
    const c = Math.cos(angle / 2);
    const dq: [number, number, number, number] = [
      (ax / nrm) * s,
      (ay / nrm) * s,
      (az / nrm) * s,
      c,
    ];

    const newPos: [number, number, number] = [curPos[0] + dx, curPos[1] + dy, curPos[2] + dz];
    const newQuat = normalizeQuat(multiplyQuat(curQuat, dq));
    const newScore = scoreFn(newPos, newQuat);
    proposals++;

    // Metropolis
    const dE = newScore - curScore;
    if (dE < 0 || rng() < Math.exp(-dE / T)) {
      curPos = newPos;
      curQuat = newQuat;
      curScore = newScore;
      accepts++;
      if (curScore < bestScore) {
        bestScore = curScore;
        bestPos = curPos;
        bestQuat = curQuat;
      }
    }
    T *= cooling;
    trace.push(curScore);
  }

  return {
    bestPos,
    bestQuat,
    bestScore,
    trace,
    acceptanceRate: accepts / proposals,
  };
}
