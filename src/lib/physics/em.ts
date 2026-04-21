/**
 * Electromagnetism — static & quasi-static fields from point charges and
 * straight current segments. Real SI units, real Coulomb / Biot-Savart.
 *
 * No shortcuts: a 1 C charge produces ~9e9 V/m at 1 m, and that's what
 * the functions return. The UI rescales for visuals.
 */

import { kCoulomb, eps0, mu0 } from './constants';

export type Vec3 = [number, number, number];

export interface PointCharge {
  id: string;
  q: number;              // C
  pos: Vec3;              // m
  color?: string;
}

export interface CurrentSegment {
  id: string;
  I: number;              // A (positive = direction r1 → r2)
  r1: Vec3;
  r2: Vec3;
  color?: string;
}

function sub(a: Vec3, b: Vec3): Vec3 { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function add(a: Vec3, b: Vec3): Vec3 { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
function cross(a: Vec3, b: Vec3): Vec3 { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function scale(a: Vec3, s: number): Vec3 { return [a[0]*s, a[1]*s, a[2]*s]; }
function norm(a: Vec3): number { return Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]); }

/** E field at point r from a set of point charges: E = k Σ q_i (r - r_i)/|r - r_i|³ */
export function fieldE(r: Vec3, charges: PointCharge[], eps = 1e-6): Vec3 {
  let ex = 0, ey = 0, ez = 0;
  for (const c of charges) {
    const dx = r[0] - c.pos[0];
    const dy = r[1] - c.pos[1];
    const dz = r[2] - c.pos[2];
    const r2 = dx*dx + dy*dy + dz*dz + eps*eps;
    const invR3 = 1 / (r2 * Math.sqrt(r2));
    const k = kCoulomb * c.q * invR3;
    ex += k * dx; ey += k * dy; ez += k * dz;
  }
  return [ex, ey, ez];
}

/** Electric potential V (scalar) at point r from charges: V = k Σ q_i / |r - r_i| */
export function potentialV(r: Vec3, charges: PointCharge[], eps = 1e-6): number {
  let V = 0;
  for (const c of charges) {
    const dx = r[0] - c.pos[0];
    const dy = r[1] - c.pos[1];
    const dz = r[2] - c.pos[2];
    const R = Math.sqrt(dx*dx + dy*dy + dz*dz + eps*eps);
    V += kCoulomb * c.q / R;
  }
  return V;
}

/**
 * B field from a finite straight current segment (Biot-Savart, closed form):
 *   B = (μ₀ I / 4π) * (sin θ₂ - sin θ₁) / d  in azimuthal direction around wire
 * where d is perpendicular distance from r to the infinite line extending the segment,
 * and θ₁, θ₂ are angles from r's foot to the segment endpoints.
 *
 * Ref: Griffiths, Intro to Electrodynamics, 4th ed., Eq. 5.36.
 */
export function fieldBFromSegment(r: Vec3, seg: CurrentSegment, eps = 1e-6): Vec3 {
  const L = sub(seg.r2, seg.r1);
  const Llen = norm(L);
  if (Llen < eps) return [0, 0, 0];
  const Lhat: Vec3 = [L[0]/Llen, L[1]/Llen, L[2]/Llen];
  const a = sub(r, seg.r1);
  // Foot of perpendicular: t_foot = a · Lhat
  const tFoot = a[0]*Lhat[0] + a[1]*Lhat[1] + a[2]*Lhat[2];
  const foot: Vec3 = [seg.r1[0] + tFoot*Lhat[0], seg.r1[1] + tFoot*Lhat[1], seg.r1[2] + tFoot*Lhat[2]];
  const perp = sub(r, foot);
  const d = Math.sqrt(perp[0]*perp[0] + perp[1]*perp[1] + perp[2]*perp[2] + eps*eps);
  const sinT1 = (-tFoot)        / Math.sqrt(tFoot*tFoot + d*d + eps*eps);
  const sinT2 = (Llen - tFoot)  / Math.sqrt((Llen - tFoot)*(Llen - tFoot) + d*d + eps*eps);
  const Bmag = (mu0 * seg.I / (4 * Math.PI * d)) * (sinT2 - sinT1);
  // Direction: L̂ × r̂_perp (azimuthal)
  const perpHat = scale(perp, 1 / d);
  const dir = cross(Lhat, perpHat);
  return scale(dir, Bmag);
}

/** Total B from all segments. */
export function fieldB(r: Vec3, segs: CurrentSegment[], eps = 1e-6): Vec3 {
  let b: Vec3 = [0, 0, 0];
  for (const s of segs) b = add(b, fieldBFromSegment(r, s, eps));
  return b;
}

/**
 * Trace a field line through the E field, walking with adaptive steps.
 * Forward and backward integrate so the line passes through the seed.
 */
export function traceFieldLine(
  seed: Vec3,
  charges: PointCharge[],
  opts: { stepLen?: number; maxSteps?: number; stopRadius?: number } = {},
): Vec3[] {
  const stepLen = opts.stepLen ?? 0.05;
  const maxSteps = opts.maxSteps ?? 400;
  const stopR    = opts.stopRadius ?? 0.02;
  const points: Vec3[] = [seed];
  // Walk in both +E and -E directions
  for (const sign of [1, -1] as const) {
    let p = seed;
    for (let i = 0; i < maxSteps; i++) {
      const E = fieldE(p, charges);
      const e = norm(E);
      if (e < 1e-10) break;
      p = [
        p[0] + sign * stepLen * E[0] / e,
        p[1] + sign * stepLen * E[1] / e,
        p[2] + sign * stepLen * E[2] / e,
      ];
      let tooClose = false;
      for (const c of charges) {
        if (norm(sub(p, c.pos)) < stopR) { tooClose = true; break; }
      }
      if (sign === 1) points.push(p);
      else points.unshift(p);
      if (tooClose) break;
    }
  }
  return points;
}

/** Lorentz force F = q(E + v × B) → advance a test particle with RK4 sub-steps. */
export interface TestParticle {
  q: number;            // C
  m: number;            // kg
  pos: Vec3;
  vel: Vec3;
}

export function lorentzStep(
  p: TestParticle,
  charges: PointCharge[],
  segs: CurrentSegment[],
  dt: number,
  bgB: Vec3 = [0, 0, 0],
): void {
  // Leapfrog/Boris would be ideal; RK4 is adequate for short demos.
  const accel = (pos: Vec3, vel: Vec3): Vec3 => {
    const E = fieldE(pos, charges);
    const Bseg = fieldB(pos, segs);
    const B: Vec3 = [Bseg[0] + bgB[0], Bseg[1] + bgB[1], Bseg[2] + bgB[2]];
    const vxB = cross(vel, B);
    return [
      (p.q / p.m) * (E[0] + vxB[0]),
      (p.q / p.m) * (E[1] + vxB[1]),
      (p.q / p.m) * (E[2] + vxB[2]),
    ];
  };
  const x0 = p.pos, v0 = p.vel;
  const a1 = accel(x0, v0);
  const x1 = add(x0, scale(v0, dt/2));
  const v1 = add(v0, scale(a1, dt/2));
  const a2 = accel(x1, v1);
  const x2 = add(x0, scale(v1, dt/2));
  const v2 = add(v0, scale(a2, dt/2));
  const a3 = accel(x2, v2);
  const x3 = add(x0, scale(v2, dt));
  const v3 = add(v0, scale(a3, dt));
  const a4 = accel(x3, v3);

  p.pos = [
    x0[0] + dt * (v0[0] + 2*v1[0] + 2*v2[0] + v3[0]) / 6,
    x0[1] + dt * (v0[1] + 2*v1[1] + 2*v2[1] + v3[1]) / 6,
    x0[2] + dt * (v0[2] + 2*v1[2] + 2*v2[2] + v3[2]) / 6,
  ];
  p.vel = [
    v0[0] + dt * (a1[0] + 2*a2[0] + 2*a3[0] + a4[0]) / 6,
    v0[1] + dt * (a1[1] + 2*a2[1] + 2*a3[1] + a4[1]) / 6,
    v0[2] + dt * (a1[2] + 2*a2[2] + 2*a3[2] + a4[2]) / 6,
  ];
}
