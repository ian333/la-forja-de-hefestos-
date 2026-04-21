/**
 * Physics constants in SI units — no approximations, no rounding for UI.
 * CODATA 2018 where applicable.
 */

// ── Fundamental ──
export const G          = 6.67430e-11;        // m^3 kg^-1 s^-2
export const c          = 2.99792458e8;       // m/s
export const h          = 6.62607015e-34;     // J·s
export const hbar       = h / (2 * Math.PI);
export const kB         = 1.380649e-23;       // J/K
export const eCharge    = 1.602176634e-19;    // C
export const eMass      = 9.1093837015e-31;   // kg
export const pMass      = 1.67262192369e-27;  // kg
export const NA         = 6.02214076e23;      // 1/mol
export const eps0       = 8.8541878128e-12;   // F/m
export const mu0        = 1.25663706212e-6;   // N/A^2
export const kCoulomb   = 1 / (4 * Math.PI * eps0); // 8.9875e9 N·m²/C²

// ── Scales for UI (not physics) ──
export const AU         = 1.49597870700e11;   // m
export const LY         = 9.4607e15;          // m
export const pc         = 3.0857e16;          // m
export const DAY        = 86400;              // s
export const YEAR       = 365.25 * DAY;       // s

// ── Solar system (masses in kg, distances in m, velocities in m/s at aphelion/reference epoch J2000) ──
// Sources: NASA JPL fact sheet (2024). Round only where source rounds.
export interface BodyRef {
  id: string;
  name: string;
  mass: number;           // kg
  radius: number;         // m (visual only)
  color: string;
  // Keplerian-derived initial conditions for a circular-ish orbit around Sun at epoch t=0:
  //   x = semiMajorAxis * (1 - e), y = 0, z = 0
  //   vy = sqrt(G * M_sun * (1 + e) / (a * (1 - e)))  — periapsis speed
  a?: number;             // semi-major axis (m)
  e?: number;             // eccentricity
}

export const SUN: BodyRef = {
  id: 'sun',  name: 'Sol',      mass: 1.98892e30, radius: 6.9634e8,  color: '#FDB813',
};

export const PLANETS: BodyRef[] = [
  { id: 'mercury', name: 'Mercurio', mass: 3.3011e23,  radius: 2.4397e6,  color: '#A9A9A9', a: 5.7909e10,  e: 0.2056 },
  { id: 'venus',   name: 'Venus',    mass: 4.8675e24,  radius: 6.0518e6,  color: '#E6B87A', a: 1.08209e11, e: 0.0068 },
  { id: 'earth',   name: 'Tierra',   mass: 5.97219e24, radius: 6.3710e6,  color: '#4FC3F7', a: 1.49598e11, e: 0.0167 },
  { id: 'mars',    name: 'Marte',    mass: 6.4171e23,  radius: 3.3895e6,  color: '#E27B58', a: 2.27944e11, e: 0.0934 },
  { id: 'jupiter', name: 'Júpiter',  mass: 1.89813e27, radius: 6.9911e7,  color: '#C99F65', a: 7.78479e11, e: 0.0484 },
  { id: 'saturn',  name: 'Saturno',  mass: 5.6834e26,  radius: 5.8232e7,  color: '#E8D9A6', a: 1.43353e12, e: 0.0539 },
  { id: 'uranus',  name: 'Urano',    mass: 8.6813e25,  radius: 2.5362e7,  color: '#A4DCE5', a: 2.87246e12, e: 0.0473 },
  { id: 'neptune', name: 'Neptuno',  mass: 1.02413e26, radius: 2.4622e7,  color: '#4062BB', a: 4.49506e12, e: 0.0086 },
];

// Earth-Moon reference (geocentric)
export const MOON: BodyRef = {
  id: 'moon', name: 'Luna', mass: 7.342e22, radius: 1.7374e6, color: '#CCCCCC',
  a: 3.844e8, e: 0.0549,
};
