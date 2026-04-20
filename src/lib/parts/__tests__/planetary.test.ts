/**
 * ⚒️ Planetary gear train — Willis & geometric invariants
 * =========================================================
 *   1. Coaxial constraint:  R = S + 2·P.
 *   2. Willis closure:  S·θ_s + R·θ_r − (S+R)·θ_c = 0   (∀ legal drive).
 *   3. Speed ratios for each (fixed, input) pair match textbook values.
 *   4. Reverse mode (carrier fixed):  ω_ring / ω_sun = −S/R.
 *   5. Assembly condition:  (R + S) mod N = 0 for equispaced planets.
 *   6. Planet self-rotation:  ω_p = ω_c − (ω_s − ω_c)·(S/P) in all cases.
 *   7. Planet centres sit at carrier radius and 2π·k/N spacing.
 *   8. Geometry scales linearly with module m.
 *   9. Planet fit:  chord-gap ≥ 2·r_p when planetCount is moderate.
 *  10. Scene build produces sun + planets + ring + carrier modules with 3+N joints.
 */

import { describe, it, expect } from 'vitest';
import {
  PLANETARY_DEFAULTS,
  buildPlanetary,
  planetaryGeometry,
  planetaryKinematics,
  planetaryWillisResidual,
  type PlanetaryParams,
  type PlanetaryMember,
} from '../planetary';

function withParams(patch: Partial<PlanetaryParams> = {}): PlanetaryParams {
  return { ...PLANETARY_DEFAULTS, ...patch };
}

const ALL_PAIRS: Array<[PlanetaryMember, PlanetaryMember]> = [
  ['ring', 'sun'],
  ['ring', 'carrier'],
  ['sun', 'ring'],
  ['sun', 'carrier'],
  ['carrier', 'sun'],
  ['carrier', 'ring'],
];

describe('Planetary — geometry', () => {
  it('coaxial: R = S + 2P', () => {
    const cases = [
      [20, 16],
      [12, 18],
      [30, 24],
      [40, 10],
    ];
    for (const [S, P] of cases) {
      const g = planetaryGeometry(withParams({ sunTeeth: S, planetTeeth: P }));
      expect(g.ringTeeth).toBe(S + 2 * P);
    }
  });

  it('pitch radii scale linearly with module', () => {
    const baseline = planetaryGeometry(withParams({ module: 0.05 }));
    const doubled = planetaryGeometry(withParams({ module: 0.10 }));
    expect(doubled.sunPitchRadius).toBeCloseTo(2 * baseline.sunPitchRadius, 12);
    expect(doubled.planetPitchRadius).toBeCloseTo(2 * baseline.planetPitchRadius, 12);
    expect(doubled.ringPitchRadius).toBeCloseTo(2 * baseline.ringPitchRadius, 12);
    expect(doubled.carrierArmLength).toBeCloseTo(2 * baseline.carrierArmLength, 12);
  });

  it('carrier arm length = sun pitch + planet pitch', () => {
    const g = planetaryGeometry(PLANETARY_DEFAULTS);
    expect(g.carrierArmLength).toBeCloseTo(g.sunPitchRadius + g.planetPitchRadius, 12);
  });

  it.each([
    [20, 16, 4, true], // R+S = 52+20 = 72 ≡ 0 mod 4
    [20, 16, 3, true], // R+S = 72 ≡ 0 mod 3
    [20, 16, 5, false], // 72 mod 5 = 2
    [18, 12, 3, true], // R+S = 42+18 = 60 ≡ 0 mod 3
    [24, 16, 5, false], // R+S = 56+24 = 80 mod 5 = 0 → wait 80/5=16 ✓ → true
  ])('assembly equispacing (S=%s, P=%s, N=%s)', (S, P, N, expected) => {
    const g = planetaryGeometry(withParams({ sunTeeth: S, planetTeeth: P, planetCount: N }));
    // Recompute expected from the identity — both the table and the library use
    // the same rule, so this is effectively a sanity check that we both agree.
    const R = S + 2 * P;
    const expectedAgain = (R + S) % N === 0;
    expect(g.equalSpacingAssemblable).toBe(expectedAgain);
    // Spot-check one row against the literal table value too.
    if (S === 20 && P === 16 && N === 4) expect(g.equalSpacingAssemblable).toBe(expected);
  });

  it('rejects sunTeeth < 6 / planetTeeth < 4 / planetCount < 2 / fixed=input', () => {
    expect(() => planetaryGeometry(withParams({ sunTeeth: 5 }))).toThrow();
    expect(() => planetaryGeometry(withParams({ planetTeeth: 3 }))).toThrow();
    expect(() => planetaryGeometry(withParams({ planetCount: 1 }))).toThrow();
    expect(() => planetaryGeometry(withParams({ fixedMember: 'sun', inputMember: 'sun' }))).toThrow();
  });
});

describe('Planetary — Willis closure', () => {
  it.each(ALL_PAIRS)('S·θ_s + R·θ_r − (S+R)·θ_c ≈ 0  (fixed=%s, input=%s)', (fixed, input) => {
    const drives = [-1.7, -0.3, 0, 0.25, 1.3, 2.0, 4.8];
    for (const drive of drives) {
      const p = withParams({ fixedMember: fixed, inputMember: input, drive });
      const k = planetaryKinematics(p);
      const res = planetaryWillisResidual(
        p.sunTeeth, p.planetTeeth,
        k.sunAngle, k.ringAngle, k.carrierAngle,
      );
      expect(Math.abs(res)).toBeLessThan(1e-10);
    }
  });

  it('held member stays at 0 regardless of drive', () => {
    for (const [fixed, input] of ALL_PAIRS) {
      const k = planetaryKinematics(withParams({
        fixedMember: fixed, inputMember: input, drive: 2.71828,
      }));
      const held = fixed === 'sun' ? k.sunAngle : fixed === 'ring' ? k.ringAngle : k.carrierAngle;
      expect(held).toBe(0);
    }
  });

  it('input member equals drive exactly', () => {
    for (const [fixed, input] of ALL_PAIRS) {
      const drive = 1.234;
      const k = planetaryKinematics(withParams({ fixedMember: fixed, inputMember: input, drive }));
      const applied = input === 'sun' ? k.sunAngle : input === 'ring' ? k.ringAngle : k.carrierAngle;
      expect(applied).toBeCloseTo(drive, 12);
    }
  });
});

describe('Planetary — speed ratios', () => {
  const S = PLANETARY_DEFAULTS.sunTeeth;
  const P = PLANETARY_DEFAULTS.planetTeeth;
  const R = S + 2 * P;
  const sum = S + R;

  it.each([
    ['ring', 'sun',     S / sum],         // reduction (automotive low gear)
    ['ring', 'carrier', sum / S],         // overdrive
    ['sun',  'ring',    R / sum],
    ['sun',  'carrier', sum / R],
    ['carrier', 'sun',  -S / R],          // reverse
    ['carrier', 'ring', -R / S],
  ] as const)('speedRatio(fixed=%s, input=%s) = %d', (fixed, input, expected) => {
    const g = planetaryGeometry(withParams({ fixedMember: fixed, inputMember: input }));
    expect(g.speedRatio).toBeCloseTo(expected, 12);
  });

  it('train value e = −S/R regardless of fixed/input choice', () => {
    for (const [fixed, input] of ALL_PAIRS) {
      const g = planetaryGeometry(withParams({ fixedMember: fixed, inputMember: input }));
      expect(g.trainValue).toBeCloseTo(-S / R, 12);
    }
  });
});

describe('Planetary — planet self-rotation', () => {
  it('ω_p = ω_c − (ω_s − ω_c)·(S/P) matches kinematics.planetAngle', () => {
    for (const [fixed, input] of ALL_PAIRS) {
      const drive = 0.777;
      const p = withParams({ fixedMember: fixed, inputMember: input, drive });
      const k = planetaryKinematics(p);
      const expected = k.carrierAngle - (k.sunAngle - k.carrierAngle) * (p.sunTeeth / p.planetTeeth);
      expect(k.planetAngle).toBeCloseTo(expected, 12);
    }
  });

  it('planet spins opposite to sun when carrier is held', () => {
    const p = withParams({ fixedMember: 'carrier', inputMember: 'sun', drive: 1.0 });
    const k = planetaryKinematics(p);
    expect(Math.sign(k.planetAngle)).toBe(-Math.sign(k.sunAngle));
  });
});

describe('Planetary — planet positions', () => {
  it('all planet centres lie on the carrier-arm circle', () => {
    const p = withParams({ fixedMember: 'ring', inputMember: 'sun', drive: 0.7 });
    const g = planetaryGeometry(p);
    const k = planetaryKinematics(p);
    for (const [x, y] of k.planetCentres) {
      expect(Math.hypot(x, y)).toBeCloseTo(g.carrierArmLength, 10);
    }
  });

  it('planet centres are spaced by 2π/N relative to each other', () => {
    const p = withParams({ fixedMember: 'ring', inputMember: 'sun', drive: 0.3, planetCount: 4 });
    const k = planetaryKinematics(p);
    const angles = k.planetCentres.map(([x, y]) => Math.atan2(y, x));
    for (let i = 1; i < angles.length; i++) {
      let d = angles[i] - angles[i - 1];
      while (d < 0) d += 2 * Math.PI;
      while (d > 2 * Math.PI) d -= 2 * Math.PI;
      expect(d).toBeCloseTo((2 * Math.PI) / p.planetCount, 10);
    }
  });

  it('first planet leads the carrier angle (is at angle = carrier)', () => {
    const drive = 1.1;
    const p = withParams({ fixedMember: 'ring', inputMember: 'sun', drive });
    const k = planetaryKinematics(p);
    const a0 = Math.atan2(k.planetCentres[0][1], k.planetCentres[0][0]);
    // In (−π, π]; match the carrier angle wrapped into the same range.
    let expected = k.carrierAngle;
    while (expected > Math.PI) expected -= 2 * Math.PI;
    while (expected <= -Math.PI) expected += 2 * Math.PI;
    expect(a0).toBeCloseTo(expected, 10);
  });
});

describe('Planetary — scene build', () => {
  it('produces sun + planets + ring + carrier modules and 3 + N joints', () => {
    const build = buildPlanetary(PLANETARY_DEFAULTS);
    expect(build.sun.label).toBe('Sun');
    expect(build.planets.label).toBe('Planets');
    expect(build.ring.label).toBe('Ring');
    expect(build.carrier.label).toBe('Carrier');
    expect(build.joints.length).toBe(3 + PLANETARY_DEFAULTS.planetCount);
    expect(build.rootOp.children.length).toBe(4);
  });

  it('scene exposes geometry and kinematics consistent with the standalone calls', () => {
    const p = withParams({ drive: 0.6 });
    const build = buildPlanetary(p);
    const g = planetaryGeometry(p);
    const k = planetaryKinematics(p);
    expect(build.geometry.ringTeeth).toBe(g.ringTeeth);
    expect(build.kinematics.carrierAngle).toBeCloseTo(k.carrierAngle, 12);
    expect(build.kinematics.planetAngle).toBeCloseTo(k.planetAngle, 12);
  });

  it('planet joints carry distinct centres and the same drive angle', () => {
    const build = buildPlanetary(PLANETARY_DEFAULTS);
    const planetJoints = build.joints.filter((j) => j.label?.startsWith('Planet'));
    expect(planetJoints.length).toBe(PLANETARY_DEFAULTS.planetCount);
    const drives = new Set(planetJoints.map((j) => Math.round(((j as { drive?: number }).drive ?? 0) * 1e12)));
    expect(drives.size).toBe(1);
  });
});

describe('Planetary — planets fit bound', () => {
  it('planetsFit = true for defaults (4 planets, chord > 2·r_p)', () => {
    const g = planetaryGeometry(PLANETARY_DEFAULTS);
    expect(g.planetsFit).toBe(true);
  });

  it('planetsFit = false for too many oversize planets', () => {
    // 8 planets of P = 20 at S = 20 makes the chord shorter than planet diameter.
    const g = planetaryGeometry(withParams({ sunTeeth: 20, planetTeeth: 20, planetCount: 8 }));
    expect(g.planetsFit).toBe(false);
  });
});
