/**
 * Kepler orbital elements — derived from state vectors (r, v) around a
 * central mass M_central. Pure math, no assumptions about units beyond
 * "consistent SI".
 *
 * Ref: Curtis, Orbital Mechanics for Engineering Students, 3rd ed., §4.
 */

import { G } from './constants';

export interface OrbitalElements {
  a: number;          // semi-major axis (m)
  e: number;          // eccentricity (dimensionless)
  i: number;          // inclination (rad)
  raan: number;       // longitude of ascending node (rad)
  argp: number;       // argument of periapsis (rad)
  nu: number;         // true anomaly (rad)
  period: number;     // orbital period T = 2π √(a³/μ) (s)
  energy: number;     // specific orbital energy ε = -μ/(2a) (m²/s²)
  h: number;          // specific angular momentum magnitude (m²/s)
}

function cross(a: number[], b: number[]): [number, number, number] {
  return [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
}
function dot(a: number[], b: number[]) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function norm(a: number[]) { return Math.sqrt(dot(a, a)); }

/**
 * Compute classical orbital elements of a body at (r, v) around a central
 * mass M_central (two-body approximation: ignores perturbations).
 */
export function stateToElements(
  r: [number, number, number],
  v: [number, number, number],
  M_central: number,
): OrbitalElements {
  const mu = G * M_central;
  const rMag = norm(r);
  const vMag = norm(v);

  // Specific angular momentum h = r × v
  const h = cross(r, v);
  const hMag = norm(h);

  // Eccentricity vector e = ((v² - μ/r) r - (r·v) v) / μ
  const rv = dot(r, v);
  const ex = ((vMag*vMag - mu/rMag) * r[0] - rv * v[0]) / mu;
  const ey = ((vMag*vMag - mu/rMag) * r[1] - rv * v[1]) / mu;
  const ez = ((vMag*vMag - mu/rMag) * r[2] - rv * v[2]) / mu;
  const eMag = Math.sqrt(ex*ex + ey*ey + ez*ez);

  // Specific energy ε = v²/2 - μ/r
  const energy = 0.5 * vMag * vMag - mu / rMag;

  // Semi-major axis a = -μ/(2ε) (for ε < 0 → bound orbit)
  const a = -mu / (2 * energy);

  // Inclination i = acos(h_z / |h|)
  const i = Math.acos(Math.max(-1, Math.min(1, h[2] / hMag)));

  // Node vector n = ẑ × h
  const n = cross([0, 0, 1], h);
  const nMag = norm(n);

  // RAAN (Ω): angle from x̂ to node
  let raan = nMag > 0 ? Math.acos(Math.max(-1, Math.min(1, n[0] / nMag))) : 0;
  if (nMag > 0 && n[1] < 0) raan = 2 * Math.PI - raan;

  // Argument of periapsis ω: angle from node to e
  let argp = 0;
  if (nMag > 0 && eMag > 0) {
    argp = Math.acos(Math.max(-1, Math.min(1, (n[0]*ex + n[1]*ey + n[2]*ez) / (nMag * eMag))));
    if (ez < 0) argp = 2 * Math.PI - argp;
  }

  // True anomaly ν: angle from e to r
  let nu = 0;
  if (eMag > 0) {
    nu = Math.acos(Math.max(-1, Math.min(1, (ex*r[0] + ey*r[1] + ez*r[2]) / (eMag * rMag))));
    if (rv < 0) nu = 2 * Math.PI - nu;
  }

  const period = 2 * Math.PI * Math.sqrt(a*a*a / mu);

  return { a, e: eMag, i, raan, argp, nu, period, energy, h: hMag };
}

/**
 * Generate initial conditions (r0, v0) for an elliptical orbit with given
 * semi-major axis `a` and eccentricity `e`. Starts at periapsis on the
 * +x axis, moving in +y direction (prograde, in xy-plane).
 *
 * This is what gives real orbits like Earth's — not approximate circles.
 */
export function periapsisState(
  a: number, e: number, M_central: number,
): { r: [number, number, number]; v: [number, number, number] } {
  const mu = G * M_central;
  const rp = a * (1 - e);                          // periapsis distance
  const vp = Math.sqrt(mu * (1 + e) / (a * (1 - e))); // speed at periapsis (vis-viva)
  return {
    r: [rp, 0, 0],
    v: [0, vp, 0],
  };
}

/**
 * Sample the full Keplerian ellipse as a closed polyline in the inertial frame,
 * relative to the central body. Returns `n` points covering the full orbit.
 * Bound orbits (e < 1) only; for hyperbolic/parabolic returns []. The output
 * is in meters — add the central body's position to place it in world frame.
 */
export function sampleOrbitPath(
  el: OrbitalElements, n = 256,
): [number, number, number][] {
  if (!isFinite(el.a) || el.e >= 1 || el.a <= 0) return [];
  const { a, e, i, raan, argp } = el;
  const p = a * (1 - e * e);
  // Rotation perifocal → inertial: Rz(raan) · Rx(i) · Rz(argp)
  const cO = Math.cos(raan), sO = Math.sin(raan);
  const cI = Math.cos(i),    sI = Math.sin(i);
  const cW = Math.cos(argp), sW = Math.sin(argp);
  // Row-major rotation matrix (applied to [xp, yp, 0])
  const m00 =  cO*cW - sO*sW*cI;
  const m01 = -cO*sW - sO*cW*cI;
  const m10 =  sO*cW + cO*sW*cI;
  const m11 = -sO*sW + cO*cW*cI;
  const m20 =  sW*sI;
  const m21 =  cW*sI;
  const out: [number, number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const nu = (2 * Math.PI * k) / n;
    const r = p / (1 + e * Math.cos(nu));
    const xp = r * Math.cos(nu);
    const yp = r * Math.sin(nu);
    out.push([m00*xp + m01*yp, m10*xp + m11*yp, m20*xp + m21*yp]);
  }
  return out;
}
