/**
 * N-body gravitational simulation — real Newtonian physics, SI units.
 *
 * Integrator: Velocity-Verlet (symplectic, 2nd order, conserves energy
 * over long runs much better than Euler / RK4 for orbital problems).
 *
 * No softening by default — collisions are real. Set softening > 0 if
 * the user wants to avoid numerical blow-up when bodies come close.
 */

import { G } from './constants';

export interface Body {
  id: string;
  name: string;
  mass: number;       // kg
  radius: number;     // m (visual)
  color: string;
  pos: [number, number, number];   // m
  vel: [number, number, number];   // m/s
  // Internal accumulators (not part of state the caller manages):
  acc: [number, number, number];
}

export interface SimState {
  bodies: Body[];
  t: number;                       // s
  softening: number;               // m, plummer softening length
}

export function createBody(init: Omit<Body, 'acc'>): Body {
  return { ...init, acc: [0, 0, 0] };
}

/** Compute accelerations a_i = -G Σ_{j≠i} m_j (r_i - r_j) / |r_i - r_j|^3. */
export function computeAccelerations(state: SimState): void {
  const { bodies, softening } = state;
  const eps2 = softening * softening;
  for (let i = 0; i < bodies.length; i++) {
    bodies[i].acc[0] = 0;
    bodies[i].acc[1] = 0;
    bodies[i].acc[2] = 0;
  }
  for (let i = 0; i < bodies.length; i++) {
    const bi = bodies[i];
    for (let j = i + 1; j < bodies.length; j++) {
      const bj = bodies[j];
      const dx = bj.pos[0] - bi.pos[0];
      const dy = bj.pos[1] - bi.pos[1];
      const dz = bj.pos[2] - bi.pos[2];
      const r2 = dx * dx + dy * dy + dz * dz + eps2;
      const invR = 1 / Math.sqrt(r2);
      const invR3 = invR * invR * invR;
      // Force on i toward j: a_i += G m_j / r^2 * (r_hat)
      const fi = G * bj.mass * invR3;
      const fj = G * bi.mass * invR3;
      bi.acc[0] += fi * dx; bi.acc[1] += fi * dy; bi.acc[2] += fi * dz;
      bj.acc[0] -= fj * dx; bj.acc[1] -= fj * dy; bj.acc[2] -= fj * dz;
    }
  }
}

/**
 * Advance by one Velocity-Verlet step:
 *   x(t+dt) = x + v dt + ½ a dt²
 *   v(t+dt) = v + ½ (a + a(t+dt)) dt
 */
export function stepVerlet(state: SimState, dt: number): void {
  const { bodies } = state;
  // Phase 1: x += v dt + ½ a dt², v += ½ a dt   (using current a)
  for (const b of bodies) {
    b.pos[0] += b.vel[0] * dt + 0.5 * b.acc[0] * dt * dt;
    b.pos[1] += b.vel[1] * dt + 0.5 * b.acc[1] * dt * dt;
    b.pos[2] += b.vel[2] * dt + 0.5 * b.acc[2] * dt * dt;
    b.vel[0] += 0.5 * b.acc[0] * dt;
    b.vel[1] += 0.5 * b.acc[1] * dt;
    b.vel[2] += 0.5 * b.acc[2] * dt;
  }
  // Recompute acceleration at new position
  computeAccelerations(state);
  // Phase 2: v += ½ a_new dt
  for (const b of bodies) {
    b.vel[0] += 0.5 * b.acc[0] * dt;
    b.vel[1] += 0.5 * b.acc[1] * dt;
    b.vel[2] += 0.5 * b.acc[2] * dt;
  }
  state.t += dt;
}

/** Advance `steps` substeps of size `dt`. Returns ms wall time spent. */
export function advance(state: SimState, dt: number, steps: number): number {
  const t0 = performance.now();
  for (let i = 0; i < steps; i++) stepVerlet(state, dt);
  return performance.now() - t0;
}

// ─── Invariants for verification (user rule: compiles ≠ works) ─────────

export function totalKineticEnergy(state: SimState): number {
  let K = 0;
  for (const b of state.bodies) {
    const v2 = b.vel[0]*b.vel[0] + b.vel[1]*b.vel[1] + b.vel[2]*b.vel[2];
    K += 0.5 * b.mass * v2;
  }
  return K;
}

export function totalPotentialEnergy(state: SimState): number {
  let U = 0;
  const { bodies, softening } = state;
  const eps2 = softening * softening;
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const dx = bodies[j].pos[0] - bodies[i].pos[0];
      const dy = bodies[j].pos[1] - bodies[i].pos[1];
      const dz = bodies[j].pos[2] - bodies[i].pos[2];
      const r = Math.sqrt(dx*dx + dy*dy + dz*dz + eps2);
      U -= G * bodies[i].mass * bodies[j].mass / r;
    }
  }
  return U;
}

export function totalEnergy(state: SimState): number {
  return totalKineticEnergy(state) + totalPotentialEnergy(state);
}

/** Total angular momentum about origin, L = Σ m (r × v). */
export function totalAngularMomentum(state: SimState): [number, number, number] {
  let lx = 0, ly = 0, lz = 0;
  for (const b of state.bodies) {
    lx += b.mass * (b.pos[1] * b.vel[2] - b.pos[2] * b.vel[1]);
    ly += b.mass * (b.pos[2] * b.vel[0] - b.pos[0] * b.vel[2]);
    lz += b.mass * (b.pos[0] * b.vel[1] - b.pos[1] * b.vel[0]);
  }
  return [lx, ly, lz];
}

/** Center of mass position. */
export function centerOfMass(state: SimState): [number, number, number] {
  let mx = 0, my = 0, mz = 0, M = 0;
  for (const b of state.bodies) {
    mx += b.mass * b.pos[0];
    my += b.mass * b.pos[1];
    mz += b.mass * b.pos[2];
    M  += b.mass;
  }
  return [mx / M, my / M, mz / M];
}

/** Shift state so COM is at rest at origin — removes any drift. */
export function recenterCOM(state: SimState): void {
  const [cx, cy, cz] = centerOfMass(state);
  let px = 0, py = 0, pz = 0, M = 0;
  for (const b of state.bodies) {
    px += b.mass * b.vel[0];
    py += b.mass * b.vel[1];
    pz += b.mass * b.vel[2];
    M  += b.mass;
  }
  const vx = px / M, vy = py / M, vz = pz / M;
  for (const b of state.bodies) {
    b.pos[0] -= cx; b.pos[1] -= cy; b.pos[2] -= cz;
    b.vel[0] -= vx; b.vel[1] -= vy; b.vel[2] -= vz;
  }
}
