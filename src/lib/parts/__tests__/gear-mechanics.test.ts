/**
 * ⚒️ Gear mechanics — Lewis stress, mass, optimization invariants
 * =================================================================
 *   1. Lewis form factor matches table references (within 3% at Z=20,40,100).
 *   2. Tangential force F_t = T/r_p is exact.
 *   3. Bending stress scales inversely with thickness, linearly with torque.
 *   4. Safety factor monotone: halving torque doubles SF.
 *   5. Mass formula is linear in thickness, quadratic in pitch radius.
 *   6. Lightening optimizer finds N holes that reduce mass, preserves SF_min.
 *   7. Optimizer is a no-op when SF already below SF_min (can't lighten a
 *      gear that's already failing).
 *   8. Optimizer respects annulus geometry (holes fit between bore & dedendum).
 */
import { describe, it, expect } from 'vitest';
import {
  lewisFormFactor,
  analyzeGearLoad,
  analyzeGearMass,
  optimizeLightening,
  DEFAULT_LIGHTENING,
  type GearLoadParams,
} from '../gear-mechanics';

const STEEL: GearLoadParams = {
  module: 2.0,
  teethCount: 20,
  thickness: 10,
  pressureAngle: (20 * Math.PI) / 180,
  // 30 N·m — chosen so the baseline SF (≈2.27) has headroom above SF_min=1.5
  // so the lightening optimizer has room to explore, while not being absurdly
  // light (tests "finds a config that reduces mass" as a real result).
  torque: 30_000,
  materialKey: 'acero_1045',
  boreDiameter: 8,
  dedendumCoef: 1.25,
};

describe('Lewis form factor', () => {
  it('matches Shigley table within 3% at Z=20', () => {
    // Shigley table: Y(20) = 0.322
    expect(lewisFormFactor(20)).toBeCloseTo(0.322, 2);
  });
  it('matches table at Z=40 within 2%', () => {
    const Y = lewisFormFactor(40);
    expect(Math.abs(Y - 0.389) / 0.389).toBeLessThan(0.02);
  });
  it('approaches 0.485 asymptote as Z → ∞', () => {
    expect(lewisFormFactor(10_000)).toBeCloseTo(0.485, 3);
  });
  it('monotone increasing with Z', () => {
    for (let z = 10; z < 200; z += 5) {
      expect(lewisFormFactor(z + 1)).toBeGreaterThan(lewisFormFactor(z));
    }
  });
});

describe('Force & stress', () => {
  it('tangential force = torque / pitch radius exactly', () => {
    const r = analyzeGearLoad(STEEL);
    const rp = (STEEL.module * STEEL.teethCount) / 2; // 20 mm
    expect(r.tangentialForce).toBeCloseTo(STEEL.torque / rp, 6);
  });

  it('radial force = F_t · tan(α)', () => {
    const r = analyzeGearLoad(STEEL);
    expect(r.radialForce).toBeCloseTo(
      r.tangentialForce * Math.tan(STEEL.pressureAngle),
      6,
    );
  });

  it('doubling torque doubles bending stress', () => {
    const a = analyzeGearLoad(STEEL);
    const b = analyzeGearLoad({ ...STEEL, torque: STEEL.torque * 2 });
    expect(b.bendingStress).toBeCloseTo(a.bendingStress * 2, 6);
  });

  it('doubling thickness halves bending stress', () => {
    const a = analyzeGearLoad(STEEL);
    const b = analyzeGearLoad({ ...STEEL, thickness: STEEL.thickness * 2 });
    expect(b.bendingStress).toBeCloseTo(a.bendingStress / 2, 6);
  });

  it('safety factor monotone with torque', () => {
    const a = analyzeGearLoad(STEEL);
    const b = analyzeGearLoad({ ...STEEL, torque: STEEL.torque / 2 });
    expect(b.safetyFactor).toBeCloseTo(a.safetyFactor * 2, 6);
  });

  it('default steel gear with 30 N·m torque has SF > 2 (design reasonable)', () => {
    const r = analyzeGearLoad(STEEL);
    expect(r.safetyFactor).toBeGreaterThan(2.0);
  });
});

describe('Mass', () => {
  it('solid mass matches rho · π · r² · b', () => {
    const r = analyzeGearMass({
      module: STEEL.module,
      teethCount: STEEL.teethCount,
      thickness: STEEL.thickness,
      boreDiameter: 0,
      materialKey: 'acero_1045',
    });
    const rp = (STEEL.module * STEEL.teethCount) / 2;
    const vol_mm3 = Math.PI * rp * rp * STEEL.thickness;
    const expected_kg = 7870 * vol_mm3 * 1e-9;
    expect(r.solidMass).toBeCloseTo(expected_kg, 9);
    expect(r.boreMass).toBe(0);
    expect(r.netMass).toBeCloseTo(expected_kg, 9);
  });

  it('linear in thickness', () => {
    const a = analyzeGearMass({
      module: STEEL.module,
      teethCount: STEEL.teethCount,
      thickness: 10,
      boreDiameter: 0,
      materialKey: 'acero_1045',
    });
    const b = analyzeGearMass({
      module: STEEL.module,
      teethCount: STEEL.teethCount,
      thickness: 20,
      boreDiameter: 0,
      materialKey: 'acero_1045',
    });
    expect(b.netMass).toBeCloseTo(a.netMass * 2, 9);
  });

  it('quadratic in pitch radius via teethCount', () => {
    const a = analyzeGearMass({
      module: STEEL.module,
      teethCount: 20,
      thickness: STEEL.thickness,
      boreDiameter: 0,
      materialKey: 'acero_1045',
    });
    const b = analyzeGearMass({
      module: STEEL.module,
      teethCount: 40,
      thickness: STEEL.thickness,
      boreDiameter: 0,
      materialKey: 'acero_1045',
    });
    // r doubles → mass 4×
    expect(b.netMass).toBeCloseTo(a.netMass * 4, 3);
  });

  it('bore subtracts mass, lightening holes further subtract', () => {
    const solid = analyzeGearMass({
      module: STEEL.module,
      teethCount: STEEL.teethCount,
      thickness: STEEL.thickness,
      boreDiameter: 0,
      materialKey: 'acero_1045',
    });
    const withBore = analyzeGearMass({
      module: STEEL.module,
      teethCount: STEEL.teethCount,
      thickness: STEEL.thickness,
      boreDiameter: 8,
      materialKey: 'acero_1045',
    });
    const withHoles = analyzeGearMass({
      module: STEEL.module,
      teethCount: STEEL.teethCount,
      thickness: STEEL.thickness,
      boreDiameter: 8,
      materialKey: 'acero_1045',
      lighteningHoles: 6,
      lighteningHoleRadius: 2,
    });
    expect(withBore.netMass).toBeLessThan(solid.netMass);
    expect(withHoles.netMass).toBeLessThan(withBore.netMass);
    expect(withHoles.savingsFraction).toBeGreaterThan(0);
    expect(withHoles.savingsFraction).toBeLessThan(1);
  });
});

describe('Lightening optimizer', () => {
  it('finds a config that reduces mass (ductile steel gear, 30 N·m)', () => {
    const opt = optimizeLightening(STEEL, DEFAULT_LIGHTENING);
    expect(opt.feasible).toBe(true);
    expect(opt.holes).toBeGreaterThanOrEqual(3);
    expect(opt.savingsFraction).toBeGreaterThan(0);
    expect(opt.netMass).toBeGreaterThan(0);
  });

  it('preserves safety factor above SF_min', () => {
    const opt = optimizeLightening(STEEL, DEFAULT_LIGHTENING);
    expect(opt.safetyFactor).toBeGreaterThanOrEqual(DEFAULT_LIGHTENING.safetyFactorMin);
  });

  it('refuses to lighten when tooth root already fails', () => {
    // Crank torque up until SF drops below SF_min
    const overloaded: GearLoadParams = { ...STEEL, torque: 5_000_000 };
    const opt = optimizeLightening(overloaded, DEFAULT_LIGHTENING);
    expect(opt.holes).toBe(0);
    expect(opt.savingsFraction).toBe(0);
    expect(opt.feasible).toBe(false);
  });

  it('returns no-holes when annulus is too narrow', () => {
    // Tiny gear with no room for holes
    const tight: GearLoadParams = {
      ...STEEL,
      module: 0.5,
      teethCount: 20,
      boreDiameter: 4.5, // bore ≈ pitch diameter → no annulus
    };
    const opt = optimizeLightening(tight, DEFAULT_LIGHTENING);
    expect(opt.holes).toBe(0);
  });

  it('picks more holes for a bigger gear', () => {
    const small = optimizeLightening(STEEL, DEFAULT_LIGHTENING);
    const big = optimizeLightening({ ...STEEL, teethCount: 80 }, DEFAULT_LIGHTENING);
    // Larger radius → bigger annulus → fits more, more efficient packing
    expect(big.savingsFraction).toBeGreaterThan(small.savingsFraction);
  });
});
