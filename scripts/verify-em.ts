/**
 * EM verification:
 *   1. E from 1 C at 1 m = kCoulomb = 8.9875e9 N/C (exact)
 *   2. Gauss's law: ∮ E·dA over sphere around +1 C = q/ε₀
 *   3. Ampère's law: ∮ B·dl around a long straight wire = μ₀ I
 *
 * Run: npx tsx --tsconfig tsconfig.lesson.json scripts/verify-em.ts
 */

import { kCoulomb, eps0, mu0 } from '../src/lib/physics/constants';
import { fieldE, fieldB, type PointCharge, type CurrentSegment } from '../src/lib/physics/em';

function fmt(x: number) { return x.toExponential(4); }

console.log('━━━ EM verification ━━━\n');

// Test 1: point charge E at 1 m
console.log('# Test 1 — E from 1 C at 1 m');
{
  const q: PointCharge = { id: 'q', q: 1, pos: [0,0,0] };
  const E = fieldE([1,0,0], [q], 0);
  const Emag = Math.hypot(E[0], E[1], E[2]);
  console.log(`  E = ${fmt(Emag)} N/C   (expected ${fmt(kCoulomb)})`);
  const err = Math.abs(Emag - kCoulomb) / kCoulomb;
  console.log(`  err = ${fmt(err)}`);
}

// Test 2: Gauss flux around +1 C sphere of R=2 m (Monte Carlo integration)
console.log('\n# Test 2 — Gauss flux ∮E·dA = q/ε₀');
{
  const q: PointCharge = { id: 'q', q: 1, pos: [0, 0, 0] };
  const expected = 1 / eps0;
  const N = 40000;
  const R = 2.0;
  let flux = 0;
  for (let i = 0; i < N; i++) {
    // Uniform sphere sample
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * 2 * Math.PI;
    const s = Math.sqrt(1 - u*u);
    const n: [number,number,number] = [s*Math.cos(phi), s*Math.sin(phi), u];
    const p: [number,number,number] = [R*n[0], R*n[1], R*n[2]];
    const E = fieldE(p, [q], 0);
    flux += E[0]*n[0] + E[1]*n[1] + E[2]*n[2];
  }
  flux *= 4 * Math.PI * R * R / N;
  console.log(`  ∮E·dA  = ${fmt(flux)}`);
  console.log(`  q/ε₀   = ${fmt(expected)}`);
  console.log(`  err    = ${fmt(Math.abs(flux - expected) / expected)}  (MC, ~1%)`);
}

// Test 3: Ampère's law — circulation of B around a long straight wire.
// Use a segment long enough to approximate infinite.
console.log('\n# Test 3 — Ampère ∮B·dl = μ₀ I around straight wire');
{
  const I = 1;                        // 1 A
  const L = 1000;                     // 1 km segment
  const seg: CurrentSegment = { id: 'w', I, r1: [0,0,-L/2], r2: [0,0,L/2] };
  const rLoop = 0.1;                  // 10 cm from wire
  const N = 720;
  let circ = 0;
  for (let i = 0; i < N; i++) {
    const theta = 2 * Math.PI * i / N;
    const nextTheta = 2 * Math.PI * (i + 0.5) / N;
    const p: [number,number,number] = [rLoop * Math.cos(nextTheta), rLoop * Math.sin(nextTheta), 0];
    const B = fieldB(p, [seg]);
    // tangent direction = (-sin θ, cos θ, 0)
    const t: [number,number,number] = [-Math.sin(nextTheta), Math.cos(nextTheta), 0];
    const dl = 2 * Math.PI * rLoop / N;
    circ += (B[0]*t[0] + B[1]*t[1] + B[2]*t[2]) * dl;
  }
  const expected = mu0 * I;
  console.log(`  ∮B·dl  = ${fmt(circ)}`);
  console.log(`  μ₀ I   = ${fmt(expected)}`);
  console.log(`  err    = ${fmt(Math.abs(circ - expected) / expected)}`);
}

console.log('\n━━━ done ━━━');
