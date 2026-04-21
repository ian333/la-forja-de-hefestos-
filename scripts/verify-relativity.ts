/**
 * Tests:
 *  1. Precesión de Mercurio por siglo: sim vs teoría (43"/siglo).
 *  2. Sin GR (useGR=false): precesión = 0 (dentro de ruido numérico).
 *  3. Conservación energía péndulo doble sobre 100 s.
 *  4. Divergencia exponencial (Lyapunov) con Δθ=1e-6 inicial.
 *
 * Run: npx tsx --tsconfig tsconfig.lesson.json scripts/verify-relativity.ts
 */

import {
  integrateSchwarzschild, analyticPrecession, orbitalPeriod,
  RAD_TO_ARCSEC,
} from '../src/lib/physics/relativity';
import { SUN, PLANETS, YEAR } from '../src/lib/physics/constants';
import {
  dpStep, dpEnergy, type DoublePendulumParams, type DoublePendulumState,
} from '../src/lib/physics/mech';

const fmt = (x: number, d = 4) => isFinite(x) ? x.toExponential(d) : 'NaN';

console.log('━━━ Relatividad + mecánica — verificación ━━━\n');

// Test 1 — Mercurio
console.log('# Test 1 — Precesión GR de Mercurio (esperado ≈ 42.98"/siglo)');
{
  const merc = PLANETS.find(p => p.id === 'mercury')!;
  const sim = integrateSchwarzschild(
    { M: SUN.mass, a: merc.a!, e: merc.e! },
    5,              // integra 5 órbitas — suficiente para precesión estable
    1e-3,
    true,
  );
  const periodMerc = orbitalPeriod(SUN.mass, merc.a!) / YEAR;
  const orbitsPerCentury = 100 / periodMerc;
  const precArcsecPerOrbit = sim.precessionPerOrbitRad * RAD_TO_ARCSEC;
  const precArcsecPerCentury = precArcsecPerOrbit * orbitsPerCentury;
  const analyticRad = analyticPrecession(SUN.mass, merc.a!, merc.e!);
  const analyticArcsecCent = analyticRad * RAD_TO_ARCSEC * orbitsPerCentury;
  console.log(`  T_merc           = ${periodMerc.toFixed(4)} yr`);
  console.log(`  órbitas/siglo    = ${orbitsPerCentury.toFixed(2)}`);
  console.log(`  Δφ sim (rad/órb) = ${fmt(sim.precessionPerOrbitRad)}`);
  console.log(`  Δφ sim           = ${precArcsecPerOrbit.toFixed(5)} "/órbita`);
  console.log(`  Δφ sim           = ${precArcsecPerCentury.toFixed(3)} "/siglo`);
  console.log(`  Δφ teórico       = ${analyticArcsecCent.toFixed(3)} "/siglo`);
  const err = Math.abs(precArcsecPerCentury - analyticArcsecCent) / analyticArcsecCent;
  console.log(`  error relativo   = ${(err*100).toFixed(3)} %`);
}

// Test 2 — sin GR
console.log('\n# Test 2 — Sin corrección GR: precesión debe ser ~0');
{
  const merc = PLANETS.find(p => p.id === 'mercury')!;
  const sim = integrateSchwarzschild(
    { M: SUN.mass, a: merc.a!, e: merc.e! }, 5, 1e-3, false,
  );
  console.log(`  Δφ sim (rad/órb) = ${fmt(sim.precessionPerOrbitRad)}`);
  console.log(`  ruido numérico esperado ∼ 1e-6 rad/órb`);
}

// Test 3 — conservación energía péndulo doble
console.log('\n# Test 3 — Péndulo doble, conservación E (100 s)');
{
  const p: DoublePendulumParams = { m1: 1, m2: 1, L1: 1, L2: 1, g: 9.81 };
  let s: DoublePendulumState = { t: 0, th1: 2.0, th2: 2.5, w1: 0, w2: 0 };
  const E0 = dpEnergy(s, p);
  const dt = 1e-4;
  const N = Math.floor(100 / dt);
  const t0 = performance.now();
  for (let i = 0; i < N; i++) s = dpStep(s, p, dt);
  const ms = performance.now() - t0;
  const E1 = dpEnergy(s, p);
  const dE = Math.abs((E1 - E0) / E0);
  console.log(`  E0    = ${E0.toFixed(6)} J`);
  console.log(`  E(100)= ${E1.toFixed(6)} J`);
  console.log(`  ΔE/E  = ${fmt(dE)}`);
  console.log(`  wall  = ${ms.toFixed(0)} ms para ${N} pasos RK4`);
  if (dE > 1e-4) console.log('  ⚠ energía drifteando > 1e-4');
}

// Test 4 — Lyapunov
console.log('\n# Test 4 — Divergencia exponencial con Δθ=1e-6');
{
  const p: DoublePendulumParams = { m1: 1, m2: 1, L1: 1, L2: 1, g: 9.81 };
  let a: DoublePendulumState = { t: 0, th1: 2.0, th2: 2.5, w1: 0, w2: 0 };
  let b: DoublePendulumState = { t: 0, th1: 2.0 + 1e-6, th2: 2.5, w1: 0, w2: 0 };
  const dt = 1e-4;
  const stops = [0.5, 1, 2, 5, 10, 20];
  let tSoFar = 0;
  for (const tEnd of stops) {
    const N = Math.floor((tEnd - tSoFar) / dt);
    for (let i = 0; i < N; i++) {
      a = dpStep(a, p, dt);
      b = dpStep(b, p, dt);
    }
    tSoFar = tEnd;
    const d = Math.hypot(a.th1 - b.th1, a.th2 - b.th2, a.w1 - b.w1, a.w2 - b.w2);
    console.log(`  t=${tEnd.toFixed(1)} s  |Δ| = ${fmt(d)}`);
  }
}

console.log('\n━━━ done ━━━');
