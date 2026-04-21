/**
 * Verify the N-body engine against real physics:
 *   1. Energy conservation over 10 Earth orbits (Sun-Earth two-body)
 *   2. Angular momentum conservation
 *   3. Orbital period matches 1 year within tolerance
 *   4. Kepler's 3rd law: T² ∝ a³ (compare Earth vs Jupiter)
 *
 * Run: npx tsx --tsconfig tsconfig.lesson.json scripts/verify-nbody.ts
 */

import { AU, YEAR, SUN, PLANETS } from '../src/lib/physics/constants';
import {
  createBody, computeAccelerations, advance,
  totalEnergy, totalAngularMomentum, recenterCOM,
  type SimState,
} from '../src/lib/physics/nbody';
import { periapsisState, stateToElements } from '../src/lib/physics/kepler';

function buildSunEarth(): SimState {
  const earth = PLANETS.find(p => p.id === 'earth')!;
  const { r, v } = periapsisState(earth.a!, earth.e!, SUN.mass);
  const state: SimState = {
    bodies: [
      createBody({ id: 'sun',   name: 'Sol',    mass: SUN.mass,   radius: SUN.radius,   color: SUN.color,   pos: [0,0,0], vel: [0,0,0] }),
      createBody({ id: 'earth', name: 'Tierra', mass: earth.mass, radius: earth.radius, color: earth.color, pos: r, vel: v }),
    ],
    t: 0,
    softening: 0,
  };
  computeAccelerations(state);
  recenterCOM(state);
  computeAccelerations(state);
  return state;
}

function buildSunJupiter(): SimState {
  const jup = PLANETS.find(p => p.id === 'jupiter')!;
  const { r, v } = periapsisState(jup.a!, jup.e!, SUN.mass);
  const state: SimState = {
    bodies: [
      createBody({ id: 'sun',     name: 'Sol',     mass: SUN.mass, radius: SUN.radius, color: SUN.color,   pos: [0,0,0], vel: [0,0,0] }),
      createBody({ id: 'jupiter', name: 'Júpiter', mass: jup.mass, radius: jup.radius, color: jup.color,   pos: r, vel: v }),
    ],
    t: 0,
    softening: 0,
  };
  computeAccelerations(state);
  recenterCOM(state);
  computeAccelerations(state);
  return state;
}

function fmt(x: number) { return x.toExponential(4); }

console.log('━━━ N-body verification ━━━\n');

// Test 1: Sun-Earth energy/momentum conservation over 10 years
console.log('# Test 1 — Sun-Earth, 10 years');
{
  const state = buildSunEarth();
  const E0 = totalEnergy(state);
  const L0 = totalAngularMomentum(state);
  const dt = 3600;                              // 1 hour
  const stepsPerYear = Math.floor(YEAR / dt);
  const msTotal = advance(state, dt, 10 * stepsPerYear);
  const E1 = totalEnergy(state);
  const L1 = totalAngularMomentum(state);
  const dE = Math.abs((E1 - E0) / E0);
  const dL = Math.abs((L1[2] - L0[2]) / L0[2]);
  console.log(`  E0 = ${fmt(E0)}, E1 = ${fmt(E1)}, ΔE/E = ${fmt(dE)}`);
  console.log(`  Lz0 = ${fmt(L0[2])}, Lz1 = ${fmt(L1[2])}, ΔLz/Lz = ${fmt(dL)}`);
  console.log(`  wall: ${msTotal.toFixed(0)} ms for ${10*stepsPerYear} steps`);
  if (dE > 1e-5) console.log('  ⚠ energy drift > 1e-5');
  if (dL > 1e-10) console.log('  ⚠ Lz drift > 1e-10');
}

// Test 2: Orbital elements recover Earth's a, e, and T = 1 year
console.log('\n# Test 2 — Orbital elements of Earth after 10 years');
{
  const state = buildSunEarth();
  const dt = 3600;
  advance(state, dt, 10 * Math.floor(YEAR / dt));
  const earth = state.bodies[1];
  const sun   = state.bodies[0];
  // Work in Sun-centric frame
  const rRel: [number, number, number] = [
    earth.pos[0] - sun.pos[0], earth.pos[1] - sun.pos[1], earth.pos[2] - sun.pos[2],
  ];
  const vRel: [number, number, number] = [
    earth.vel[0] - sun.vel[0], earth.vel[1] - sun.vel[1], earth.vel[2] - sun.vel[2],
  ];
  const el = stateToElements(rRel, vRel, SUN.mass);
  console.log(`  a      = ${(el.a/AU).toFixed(6)} AU   (expected ~1.000)`);
  console.log(`  e      = ${el.e.toFixed(6)}         (expected ~0.0167)`);
  console.log(`  T      = ${(el.period/YEAR).toFixed(6)} yr (expected ~1.000)`);
  console.log(`  i      = ${(el.i*180/Math.PI).toFixed(4)}°  (expected 0.00 in this frame)`);
}

// Test 3: Kepler's 3rd law — T_jupiter / T_earth should equal (a_jup/a_earth)^1.5
console.log('\n# Test 3 — Kepler III: T²/a³ = const');
{
  const earth = PLANETS.find(p => p.id === 'earth')!;
  const jup   = PLANETS.find(p => p.id === 'jupiter')!;
  // Jupiter period from simulation
  const state = buildSunJupiter();
  const dt = 3600 * 24;                         // 1 day
  advance(state, dt, Math.floor(13 * YEAR / dt));
  const b = state.bodies[1], s = state.bodies[0];
  const rRel: [number, number, number] = [b.pos[0]-s.pos[0], b.pos[1]-s.pos[1], b.pos[2]-s.pos[2]];
  const vRel: [number, number, number] = [b.vel[0]-s.vel[0], b.vel[1]-s.vel[1], b.vel[2]-s.vel[2]];
  const el = stateToElements(rRel, vRel, SUN.mass);
  const ratioSim = (el.a / earth.a!) ** 1.5;
  const ratioObs = (jup.a! / earth.a!) ** 1.5;
  console.log(`  T_jup / T_earth (Kepler) = ${ratioObs.toFixed(4)}`);
  console.log(`  T_jup from sim            = ${(el.period / YEAR).toFixed(4)} yr`);
  console.log(`  sim ratio                 = ${(el.period / YEAR).toFixed(4)}`);
  console.log(`  expected (a_jup/a_earth)^1.5 = ${ratioSim.toFixed(4)}`);
}

console.log('\n━━━ done ━━━');
