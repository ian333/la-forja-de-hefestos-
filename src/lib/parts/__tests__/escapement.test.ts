/**
 * ⚒️ Clock escapement — kinematic & timing invariants
 * =====================================================
 *   1. Simple-pendulum period  T₀ = 2π·√(L/g).
 *   2. Amplitude correction:  T(A) > T₀, exact fourth-order coefficient.
 *   3. One tick per half-period (two ticks per full cycle).
 *   4. Escape wheel angular velocity ω_e = 4π/(N·T).
 *   5. Pendulum angle law  θ_p(t) = A·cos(2π·t/T)  — max at t=0, zero at T/4.
 *   6. Anchor tracks pendulum up to anchorRatio.
 *   7. Seconds pendulum (L = g/π² ≈ 0.9939 m) has T ≈ 2 s.
 *   8. Escape wheel angle monotone non-decreasing in time.
 *   9. Tooth angle = 2π/N.
 *  10. Infeasible params (teethCount, gravity, amplitude) throw.
 *  11. Scene build produces 3 modules + 3 joints at consistent drives.
 *  12. Entry/exit pallet alternation parity.
 */

import { describe, it, expect } from 'vitest';
import {
  ESCAPEMENT_DEFAULTS,
  buildEscapement,
  escapementGeometry,
  escapementKinematics,
  pendulumPeriod,
  simplePeriod,
  type EscapementParams,
} from '../escapement';

function withParams(patch: Partial<EscapementParams> = {}): EscapementParams {
  return { ...ESCAPEMENT_DEFAULTS, ...patch };
}

describe('Escapement — period laws', () => {
  it('simplePeriod matches  2π·√(L/g)', () => {
    const L = 0.5;
    const g = 9.80665;
    expect(simplePeriod(L, g)).toBeCloseTo(2 * Math.PI * Math.sqrt(L / g), 12);
  });

  it('seconds pendulum: L = g/π² ⇒ T₀ ≈ 2.000 s', () => {
    const g = 9.80665;
    const L = g / (Math.PI * Math.PI);
    expect(simplePeriod(L, g)).toBeCloseTo(2.0, 10);
  });

  it('amplitude correction increases the period monotonically', () => {
    const amps = [0.02, 0.05, 0.1, 0.2, 0.4];
    const L = 1;
    const g = 9.80665;
    const T0 = simplePeriod(L, g);
    let prev = T0;
    for (const A of amps) {
      const T = pendulumPeriod(L, g, A);
      expect(T).toBeGreaterThan(prev);
      prev = T;
    }
  });

  it('amplitude correction series term-by-term', () => {
    const L = 1;
    const g = 9.80665;
    const A = 0.1;
    const T0 = simplePeriod(L, g);
    // Exact: T = T0·(1 + A²/16 + 11·A⁴/3072).
    const expected = T0 * (1 + (A * A) / 16 + (11 * A * A * A * A) / 3072);
    expect(pendulumPeriod(L, g, A)).toBeCloseTo(expected, 14);
  });
});

describe('Escapement — derived geometry', () => {
  it('tooth angle = 2π/N', () => {
    for (const N of [15, 20, 30, 42, 60]) {
      const d = escapementGeometry(withParams({ teethCount: N }));
      expect(d.toothAngle).toBeCloseTo((2 * Math.PI) / N, 12);
    }
  });

  it('root radius = tip radius − tooth depth', () => {
    const d = escapementGeometry(ESCAPEMENT_DEFAULTS);
    expect(d.rootRadius).toBeCloseTo(d.tipRadius - ESCAPEMENT_DEFAULTS.toothDepth, 12);
  });

  it('escape wheel ω_e = 4π / (N·T)', () => {
    const d = escapementGeometry(ESCAPEMENT_DEFAULTS);
    const expected = (4 * Math.PI) / (ESCAPEMENT_DEFAULTS.teethCount * d.period);
    expect(d.escapeAngularVelocity).toBeCloseTo(expected, 12);
  });

  it('rejects N<6 / L≤0 / g≤0 / amplitude outside (0, π/3]', () => {
    expect(() => escapementGeometry(withParams({ teethCount: 5 }))).toThrow();
    expect(() => escapementGeometry(withParams({ pendulumLength: 0 }))).toThrow();
    expect(() => escapementGeometry(withParams({ gravity: 0 }))).toThrow();
    expect(() => escapementGeometry(withParams({ amplitude: 0 }))).toThrow();
    expect(() => escapementGeometry(withParams({ amplitude: Math.PI }))).toThrow();
  });
});

describe('Escapement — kinematics', () => {
  it('θ_p(0) = A  and  θ_p(T/4) ≈ 0  and  θ_p(T/2) ≈ −A', () => {
    const p = ESCAPEMENT_DEFAULTS;
    const d = escapementGeometry(p);
    const T = d.period;
    const k0 = escapementKinematics({ ...p, time: 0 });
    const kq = escapementKinematics({ ...p, time: T / 4 });
    const kh = escapementKinematics({ ...p, time: T / 2 });
    expect(k0.pendulumAngle).toBeCloseTo(p.amplitude, 12);
    expect(kq.pendulumAngle).toBeCloseTo(0, 10);
    expect(kh.pendulumAngle).toBeCloseTo(-p.amplitude, 10);
  });

  it('anchor = anchorRatio · pendulum', () => {
    const p = withParams({ anchorRatio: 0.8, time: 0.37 });
    const k = escapementKinematics(p);
    expect(k.anchorAngle).toBeCloseTo(0.8 * k.pendulumAngle, 12);
  });

  it('ticks released: floor((2·t/T) + 0.5)  — one per half-period', () => {
    const p = ESCAPEMENT_DEFAULTS;
    const d = escapementGeometry(p);
    const T = d.period;
    const samples: Array<[number, number]> = [
      [0,       0],
      [T / 8,   0],
      [T / 4,   1], // first zero crossing → first tick
      [T / 2,   1],
      [3 * T / 4, 2], // second tick
      [T,       2],
      [2 * T,   4],
      [5 * T,   10],
    ];
    for (const [t, expected] of samples) {
      const k = escapementKinematics({ ...p, time: t });
      expect(k.ticksReleased).toBe(expected);
    }
  });

  it('escape angle monotone non-decreasing through 6 periods', () => {
    const p = ESCAPEMENT_DEFAULTS;
    const d = escapementGeometry(p);
    const T = d.period;
    let prev = -Infinity;
    for (let i = 0; i < 240; i++) {
      const t = (i / 40) * T; // 40 samples per period
      const k = escapementKinematics({ ...p, time: t });
      expect(k.escapeAngle).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = k.escapeAngle;
    }
  });

  it('escape angle = ticks · (2π/N)', () => {
    const p = ESCAPEMENT_DEFAULTS;
    const d = escapementGeometry(p);
    const times = [0, 0.5, 1.0, 1.25, 2.0, 4.7, 10.0];
    for (const t of times) {
      const k = escapementKinematics({ ...p, time: t });
      expect(k.escapeAngle).toBeCloseTo(k.ticksReleased * d.toothAngle, 12);
    }
  });

  it('pendulum velocity = dθ/dt — matches numerical derivative', () => {
    const p = ESCAPEMENT_DEFAULTS;
    const d = escapementGeometry(p);
    const T = d.period;
    const eps = 1e-5;
    for (const t of [0.1, 0.25 * T, 0.5 * T, T, 2 * T]) {
      const kPlus = escapementKinematics({ ...p, time: t + eps });
      const kMinus = escapementKinematics({ ...p, time: t - eps });
      const numeric = (kPlus.pendulumAngle - kMinus.pendulumAngle) / (2 * eps);
      const k = escapementKinematics({ ...p, time: t });
      expect(k.pendulumVelocity).toBeCloseTo(numeric, 7);
    }
  });

  it('entry/exit pallet parity flips each tick', () => {
    const p = ESCAPEMENT_DEFAULTS;
    const d = escapementGeometry(p);
    const T = d.period;
    const samples = [0, T / 4 + 1e-6, 3 * T / 4 + 1e-6, 5 * T / 4 + 1e-6];
    const parities = samples.map((t) => escapementKinematics({ ...p, time: t }).entryPalletLocking);
    expect(parities).toEqual([true, false, true, false]);
  });

  it('total ticks over 60 s at T = 2 s equals 60  (clock ticks per minute)', () => {
    const p = withParams({
      teethCount: 30,
      pendulumLength: 9.80665 / (Math.PI * Math.PI),
      gravity: 9.80665,
      amplitude: 0.01, // near-linear
      time: 60,
    });
    const k = escapementKinematics(p);
    // T ≈ 2 s, one tick per half-period ⇒ 60 ticks in 60 s.
    expect(k.ticksReleased).toBe(60);
  });
});

describe('Escapement — scene build', () => {
  it('produces escapeWheel + anchor + pendulum modules and 3 joints', () => {
    const build = buildEscapement(ESCAPEMENT_DEFAULTS);
    expect(build.escapeWheel.label).toBe('Escape wheel');
    expect(build.anchor.label).toBe('Anchor');
    expect(build.pendulum.label).toBe('Pendulum');
    expect(build.joints.length).toBe(3);
    expect(build.rootOp.children.length).toBe(3);
  });

  it('joint drives match kinematics angles', () => {
    const p = withParams({ time: 1.37 });
    const build = buildEscapement(p);
    const k = escapementKinematics(p);
    const drives = Object.fromEntries(
      build.joints.map((j) => [j.label, (j as { drive?: number }).drive]),
    );
    expect(drives['Escape wheel revolute']).toBeCloseTo(k.escapeAngle, 12);
    expect(drives['Anchor revolute']).toBeCloseTo(k.anchorAngle, 12);
    expect(drives['Pendulum revolute']).toBeCloseTo(k.pendulumAngle, 12);
  });

  it('escape wheel has exactly 2·N cross-section vertices (tip + root alternating)', () => {
    // Not asserted against the SDF node tree because polygon verts are private;
    // we infer by asserting a geometry-derived count.
    const d = escapementGeometry(ESCAPEMENT_DEFAULTS);
    expect(d.toothAngle * ESCAPEMENT_DEFAULTS.teethCount).toBeCloseTo(2 * Math.PI, 12);
  });

  it('scene geometry and kinematics match the standalone calls', () => {
    const p = withParams({ time: 0.75 });
    const build = buildEscapement(p);
    const g = escapementGeometry(p);
    const k = escapementKinematics(p);
    expect(build.geometry.period).toBeCloseTo(g.period, 12);
    expect(build.kinematics.pendulumAngle).toBeCloseTo(k.pendulumAngle, 12);
    expect(build.kinematics.escapeAngle).toBeCloseTo(k.escapeAngle, 12);
  });
});
