/**
 * ══════════════════════════════════════════════════════════════════════
 *  quantum/md — Dinámica molecular clásica con Lennard-Jones
 * ══════════════════════════════════════════════════════════════════════
 *
 * Motor de MD simple pero físicamente correcto:
 *   - Integrador Velocity Verlet (simpléctico, preserva energía en NVE)
 *   - Potencial de Lennard-Jones V(r) = 4ε[(σ/r)¹² - (σ/r)⁶]
 *   - Coulomb opcional (partículas cargadas)
 *   - Condiciones de frontera periódicas (PBC)
 *   - Termostato Berendsen para NVT
 *   - Reacciones por colisiones con barrera de activación (Arrhenius)
 *
 * El objetivo: dar a los estudiantes una "caja" donde vean cientos de
 * moléculas moviéndose, chocando, agregándose, reaccionando — en tiempo
 * real. La temperatura es LITERAL: velocidad cuadrática media. La
 * presión emerge de los choques contra las paredes virtuales.
 *
 * Ref [M1] Verlet, L. "Computer experiments on classical fluids",
 *          Phys. Rev. 159, 98 (1967). Integrador original.
 * Ref [M2] Swope, W.C. et al. "A computer simulation method for the
 *          calculation of equilibrium constants...", J. Chem. Phys. 76,
 *          637-649 (1982). Velocity Verlet.
 * Ref [M3] Berendsen, H.J.C. et al. "Molecular dynamics with coupling to
 *          an external bath", J. Chem. Phys. 81, 3684 (1984). Termostato.
 * Ref [M4] Allen, M.P. & Tildesley, D.J. "Computer Simulation of Liquids",
 *          2nd ed., Oxford UP, 2017.
 */

// ═══════════════════════════════════════════════════════════════
// CONSTANTES (unidades reducidas LJ)
// ═══════════════════════════════════════════════════════════════
// En unidades LJ: σ=1, ε=1, m=1. Tiempo reducido τ = σ√(m/ε).
// Para Argón: σ=3.4 Å, ε/k_B=120 K, m=6.63·10⁻²⁶ kg → τ ≈ 2.16 ps.

export const KB_REDUCED = 1.0;  // k_B en unidades reducidas

// ═══════════════════════════════════════════════════════════════
// TIPOS DE PARTÍCULA
// ═══════════════════════════════════════════════════════════════

export interface ParticleType {
  id: number;
  name: string;       // "A", "H2", etc.
  color: string;      // hex color for viz
  sigma: number;      // diámetro LJ [unidades reducidas]
  epsilon: number;    // profundidad del pozo [unidades reducidas]
  mass: number;       // masa [unidades reducidas]
  charge: number;     // carga [e] para Coulomb opcional
}

// ═══════════════════════════════════════════════════════════════
// ESTADO DEL SISTEMA
// ═══════════════════════════════════════════════════════════════

export interface MdState {
  /** Número de partículas */
  N: number;
  /** Posiciones aplanadas [x1,y1,z1, x2,y2,z2, ...] */
  positions: Float32Array;
  /** Velocidades aplanadas */
  velocities: Float32Array;
  /** Fuerzas aplanadas (buffer reutilizado) */
  forces: Float32Array;
  /** Tipo por partícula (índice en types[]) */
  typeIdx: Int32Array;
  /** Catálogo de tipos */
  types: ParticleType[];
  /** Tamaño de caja (cúbica) [unidades reducidas] */
  boxSize: number;
  /** Tiempo acumulado [τ] */
  time: number;
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════

/**
 * Crear estado inicial con partículas distribuidas aleatoriamente en
 * posición y con velocidades Maxwell-Boltzmann a temperatura T.
 */
export function createState(
  counts: Map<ParticleType, number>,
  boxSize: number,
  temperature: number,
  seed = 42,
): MdState {
  const types = Array.from(counts.keys());
  let N = 0;
  for (const n of counts.values()) N += n;

  const state: MdState = {
    N,
    positions: new Float32Array(N * 3),
    velocities: new Float32Array(N * 3),
    forces: new Float32Array(N * 3),
    typeIdx: new Int32Array(N),
    types,
    boxSize,
    time: 0,
  };

  const rng = mulberry32(seed);
  // Placement con rechazo de overlap: evita fuerzas astronómicas
  // al arranque. Si no puede colocar tras muchos intentos, acepta
  // el último punto (raro en densidades <0.1).
  const minDist = 1.0;     // en unidades σ
  const minDist2 = minDist * minDist;
  const placed: number[] = [];  // [x0,y0,z0, x1,y1,z1, ...]
  let p = 0;
  let tIdx = 0;
  const halfBox = boxSize / 2;
  for (const [_type, count] of counts) {
    for (let i = 0; i < count; i++) {
      let x = 0, y = 0, z = 0;
      for (let attempt = 0; attempt < 200; attempt++) {
        x = rng() * boxSize;
        y = rng() * boxSize;
        z = rng() * boxSize;
        let ok = true;
        for (let k = 0; k < placed.length; k += 3) {
          let dx = x - placed[k];
          let dy = y - placed[k + 1];
          let dz = z - placed[k + 2];
          if (dx >  halfBox) dx -= boxSize;
          if (dx < -halfBox) dx += boxSize;
          if (dy >  halfBox) dy -= boxSize;
          if (dy < -halfBox) dy += boxSize;
          if (dz >  halfBox) dz -= boxSize;
          if (dz < -halfBox) dz += boxSize;
          if (dx * dx + dy * dy + dz * dz < minDist2) { ok = false; break; }
        }
        if (ok) break;
      }
      state.positions[p * 3 + 0] = x;
      state.positions[p * 3 + 1] = y;
      state.positions[p * 3 + 2] = z;
      placed.push(x, y, z);
      state.typeIdx[p] = tIdx;
      p++;
    }
    tIdx++;
  }

  // Velocidades Maxwell-Boltzmann: cada componente ~ N(0, sqrt(kT/m))
  let vxMean = 0, vyMean = 0, vzMean = 0;
  for (let i = 0; i < N; i++) {
    const mass = types[state.typeIdx[i]].mass;
    const sigma = Math.sqrt(KB_REDUCED * temperature / mass);
    const vx = gaussian(rng) * sigma;
    const vy = gaussian(rng) * sigma;
    const vz = gaussian(rng) * sigma;
    state.velocities[i * 3 + 0] = vx;
    state.velocities[i * 3 + 1] = vy;
    state.velocities[i * 3 + 2] = vz;
    vxMean += vx;
    vyMean += vy;
    vzMean += vz;
  }
  // Remover velocidad del centro de masa (evita deriva numérica)
  vxMean /= N; vyMean /= N; vzMean /= N;
  for (let i = 0; i < N; i++) {
    state.velocities[i * 3 + 0] -= vxMean;
    state.velocities[i * 3 + 1] -= vyMean;
    state.velocities[i * 3 + 2] -= vzMean;
  }

  return state;
}

// ═══════════════════════════════════════════════════════════════
// FUERZAS (Lennard-Jones + Coulomb opcional)
// ═══════════════════════════════════════════════════════════════

/** Regla de mezcla de Lorentz-Berthelot: σ_AB = (σ_A+σ_B)/2, ε_AB = √(ε_A·ε_B) */
function ljPair(a: ParticleType, b: ParticleType): { sigma: number; epsilon: number } {
  return {
    sigma: (a.sigma + b.sigma) / 2,
    epsilon: Math.sqrt(a.epsilon * b.epsilon),
  };
}

/**
 * Calcula fuerzas O(N²) pair-wise con PBC (minimum image convention).
 * Para N>1000 convendría implementar cell lists; para la demo basta N².
 */
export function computeForces(state: MdState): number {
  const { N, positions, forces, typeIdx, types, boxSize } = state;
  forces.fill(0);
  const rCut = 2.5;               // cortar LJ a 2.5σ
  const rCut2 = rCut * rCut;
  const halfBox = boxSize / 2;

  let energy = 0;

  for (let i = 0; i < N; i++) {
    const ti = types[typeIdx[i]];
    for (let j = i + 1; j < N; j++) {
      const tj = types[typeIdx[j]];
      const { sigma, epsilon } = ljPair(ti, tj);

      let dx = positions[i * 3 + 0] - positions[j * 3 + 0];
      let dy = positions[i * 3 + 1] - positions[j * 3 + 1];
      let dz = positions[i * 3 + 2] - positions[j * 3 + 2];
      // Minimum image
      if (dx >  halfBox) dx -= boxSize;
      if (dx < -halfBox) dx += boxSize;
      if (dy >  halfBox) dy -= boxSize;
      if (dy < -halfBox) dy += boxSize;
      if (dz >  halfBox) dz -= boxSize;
      if (dz < -halfBox) dz += boxSize;

      const r2 = dx * dx + dy * dy + dz * dz;
      const sigma2 = sigma * sigma;
      if (r2 > rCut2 * sigma2 || r2 < 1e-6) continue;

      const inv2 = sigma2 / r2;
      const inv6 = inv2 * inv2 * inv2;
      const inv12 = inv6 * inv6;

      // V(r) = 4ε(inv12 - inv6)
      energy += 4 * epsilon * (inv12 - inv6);

      // F(r) = 24ε/r² · (2·inv12 - inv6)  (vector ij)
      const f = 24 * epsilon * (2 * inv12 - inv6) / r2;
      const fx = f * dx;
      const fy = f * dy;
      const fz = f * dz;

      forces[i * 3 + 0] += fx;
      forces[i * 3 + 1] += fy;
      forces[i * 3 + 2] += fz;
      forces[j * 3 + 0] -= fx;
      forces[j * 3 + 1] -= fy;
      forces[j * 3 + 2] -= fz;

      // Coulomb (si ambas cargas ≠ 0)
      if (ti.charge !== 0 && tj.charge !== 0) {
        const r = Math.sqrt(r2);
        const fc = ti.charge * tj.charge / (r2 * r);
        energy += ti.charge * tj.charge / r;
        forces[i * 3 + 0] += fc * dx;
        forces[i * 3 + 1] += fc * dy;
        forces[i * 3 + 2] += fc * dz;
        forces[j * 3 + 0] -= fc * dx;
        forces[j * 3 + 1] -= fc * dy;
        forces[j * 3 + 2] -= fc * dz;
      }
    }
  }
  return energy;
}

// ═══════════════════════════════════════════════════════════════
// INTEGRADOR VELOCITY VERLET
// ═══════════════════════════════════════════════════════════════

/**
 * Un paso de integración:
 *   v(t+dt/2) = v(t) + a(t)·dt/2
 *   r(t+dt)   = r(t) + v(t+dt/2)·dt   (aplicar PBC)
 *   a(t+dt)   = f(r(t+dt)) / m
 *   v(t+dt)   = v(t+dt/2) + a(t+dt)·dt/2
 */
export function stepVerlet(state: MdState, dt: number): void {
  const { N, positions, velocities, forces, typeIdx, types, boxSize } = state;
  const L = boxSize;

  // Kick (primera mitad)
  for (let i = 0; i < N; i++) {
    const m = types[typeIdx[i]].mass;
    const fac = dt / (2 * m);
    velocities[i * 3 + 0] += forces[i * 3 + 0] * fac;
    velocities[i * 3 + 1] += forces[i * 3 + 1] * fac;
    velocities[i * 3 + 2] += forces[i * 3 + 2] * fac;
  }

  // Drift: mover + PBC wrap
  for (let i = 0; i < N; i++) {
    positions[i * 3 + 0] = mod(positions[i * 3 + 0] + velocities[i * 3 + 0] * dt, L);
    positions[i * 3 + 1] = mod(positions[i * 3 + 1] + velocities[i * 3 + 1] * dt, L);
    positions[i * 3 + 2] = mod(positions[i * 3 + 2] + velocities[i * 3 + 2] * dt, L);
  }

  // Re-calcular fuerzas
  computeForces(state);

  // Kick (segunda mitad)
  for (let i = 0; i < N; i++) {
    const m = types[typeIdx[i]].mass;
    const fac = dt / (2 * m);
    velocities[i * 3 + 0] += forces[i * 3 + 0] * fac;
    velocities[i * 3 + 1] += forces[i * 3 + 1] * fac;
    velocities[i * 3 + 2] += forces[i * 3 + 2] * fac;
  }

  state.time += dt;
}

// ═══════════════════════════════════════════════════════════════
// TERMODINÁMICA INSTANTÁNEA
// ═══════════════════════════════════════════════════════════════

/** Temperatura instantánea desde energía cinética media (equipartición 3D). */
export function instantaneousTemperature(state: MdState): number {
  const { N, velocities, typeIdx, types } = state;
  let ke = 0;
  for (let i = 0; i < N; i++) {
    const m = types[typeIdx[i]].mass;
    const vx = velocities[i * 3 + 0];
    const vy = velocities[i * 3 + 1];
    const vz = velocities[i * 3 + 2];
    ke += 0.5 * m * (vx * vx + vy * vy + vz * vz);
  }
  // (3/2) N k_B T = KE  →  T = (2/3) · KE / (N·k_B)
  return (2 * ke) / (3 * N * KB_REDUCED);
}

export function kineticEnergy(state: MdState): number {
  const { N, velocities, typeIdx, types } = state;
  let ke = 0;
  for (let i = 0; i < N; i++) {
    const m = types[typeIdx[i]].mass;
    const vx = velocities[i * 3 + 0];
    const vy = velocities[i * 3 + 1];
    const vz = velocities[i * 3 + 2];
    ke += 0.5 * m * (vx * vx + vy * vy + vz * vz);
  }
  return ke;
}

// ═══════════════════════════════════════════════════════════════
// TERMOSTATO BERENDSEN
// ═══════════════════════════════════════════════════════════════

/**
 * Berendsen: v_i ← v_i · λ  con λ = sqrt(1 + (dt/τ)·(T_target/T - 1)).
 * Simple y estable. No reproduce el ensamble canónico exacto pero
 * funciona de maravilla para equilibración y demos.
 */
export function berendsenThermostat(
  state: MdState,
  targetT: number,
  dt: number,
  tau = 1.0,
): void {
  const T = instantaneousTemperature(state);
  if (T <= 0 || targetT <= 0) return;
  const lambda = Math.sqrt(1 + (dt / tau) * (targetT / T - 1));
  for (let i = 0; i < state.velocities.length; i++) {
    state.velocities[i] *= lambda;
  }
}

// ═══════════════════════════════════════════════════════════════
// REACCIONES POR COLISIÓN
// ═══════════════════════════════════════════════════════════════

export interface ReactionRule {
  reactantA: number;   // índice de tipo
  reactantB: number;
  productA: number;
  productB: number;
  /** Distancia máxima para considerar colisión */
  rCollision: number;
  /** Energía de activación (en unidades reducidas kT-like) */
  Ea: number;
  /** Probabilidad base de reacción (0..1) si E_rel > Ea */
  probability: number;
}

/**
 * Aplica reglas de reacción: itera sobre pares cercanos, si energía
 * cinética relativa supera barrera Ea, con probabilidad p cambia
 * los tipos.
 */
export function applyReactions(
  state: MdState,
  rules: ReactionRule[],
  seed?: number,
): number {
  const { N, positions, velocities, typeIdx, types, boxSize } = state;
  const halfBox = boxSize / 2;
  let nReactions = 0;
  const rng = mulberry32((seed ?? Math.random() * 1e9) | 0);

  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const tIdxI = typeIdx[i];
      const tIdxJ = typeIdx[j];
      for (const rule of rules) {
        const match =
          (tIdxI === rule.reactantA && tIdxJ === rule.reactantB) ||
          (tIdxI === rule.reactantB && tIdxJ === rule.reactantA);
        if (!match) continue;

        let dx = positions[i * 3 + 0] - positions[j * 3 + 0];
        let dy = positions[i * 3 + 1] - positions[j * 3 + 1];
        let dz = positions[i * 3 + 2] - positions[j * 3 + 2];
        if (dx >  halfBox) dx -= boxSize;
        if (dx < -halfBox) dx += boxSize;
        if (dy >  halfBox) dy -= boxSize;
        if (dy < -halfBox) dy += boxSize;
        if (dz >  halfBox) dz -= boxSize;
        if (dz < -halfBox) dz += boxSize;
        const r2 = dx * dx + dy * dy + dz * dz;
        if (r2 > rule.rCollision * rule.rCollision) continue;

        // Energía cinética relativa (por masa reducida)
        const mi = types[tIdxI].mass;
        const mj = types[tIdxJ].mass;
        const mu = (mi * mj) / (mi + mj);
        const dvx = velocities[i * 3 + 0] - velocities[j * 3 + 0];
        const dvy = velocities[i * 3 + 1] - velocities[j * 3 + 1];
        const dvz = velocities[i * 3 + 2] - velocities[j * 3 + 2];
        const Erel = 0.5 * mu * (dvx * dvx + dvy * dvy + dvz * dvz);

        if (Erel < rule.Ea) continue;
        if (rng() > rule.probability) continue;

        // Reacción: swap types preservando roles ↔ roles
        if (tIdxI === rule.reactantA) {
          typeIdx[i] = rule.productA;
          typeIdx[j] = rule.productB;
        } else {
          typeIdx[i] = rule.productB;
          typeIdx[j] = rule.productA;
        }
        nReactions++;
        break; // solo una regla por par por step
      }
    }
  }
  return nReactions;
}

// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════

function mod(x: number, L: number): number {
  let r = x % L;
  if (r < 0) r += L;
  return r;
}

/** Gaussiana por Box-Muller */
function gaussian(rng: () => number): number {
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ═══════════════════════════════════════════════════════════════
// CATÁLOGO DE TIPOS DE EJEMPLO
// ═══════════════════════════════════════════════════════════════

export const TYPE_PRESETS: Record<string, ParticleType> = {
  A: { id: 0, name: 'A', color: '#0696D7', sigma: 1.0, epsilon: 1.0, mass: 1.0, charge: 0 },
  B: { id: 1, name: 'B', color: '#E8A417', sigma: 1.0, epsilon: 1.0, mass: 1.0, charge: 0 },
  C: { id: 2, name: 'C', color: '#22C55E', sigma: 1.2, epsilon: 1.2, mass: 2.0, charge: 0 },
  D: { id: 3, name: 'D', color: '#EF4444', sigma: 0.8, epsilon: 0.8, mass: 0.5, charge: 0 },
  E: { id: 4, name: 'E', color: '#A855F7', sigma: 1.0, epsilon: 1.5, mass: 1.5, charge: 0 },
};

export function countByType(state: MdState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of state.types) out[t.name] = 0;
  for (let i = 0; i < state.N; i++) {
    out[state.types[state.typeIdx[i]].name]++;
  }
  return out;
}
