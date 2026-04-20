/**
 * ⚒️ Slider-Crank — kinematic & geometric invariants
 * ===================================================
 *   1. Rigid-rod constraint:  |crankpin − (sliderX, e)| = L  ∀ θ.
 *   2. Stroke formula:  x_max − x_min = 2r   when e = 0.
 *   3. TDC and BDC are critical points of x(θ):  dx/dθ = 0.
 *   4. Max |β| = asin((r + |e|) / L).
 *   5. In-line symmetry:  x(θ) = x(−θ),  β(−θ) = −β(θ)   when e = 0.
 *   6. Numerical derivative of sliderX matches analytic velocityRatio.
 *   7. Feasibility:  L < r + |e|  throws.
 *   8. Scene build produces 3 modules + 4 joints with consistent positions.
 *   9. Rod ratio L/r reported correctly.
 *  10. Single revolution contains exactly one stroke in each direction.
 *  11. Monotone return:  for e = 0, dx/dθ > 0 on (π, 2π) and < 0 on (0, π).
 *  12. Offset kinematics: TDC/BDC angles shift off 0/π when e ≠ 0.
 */

import { describe, it, expect } from 'vitest';
import {
  SLIDER_CRANK_DEFAULTS,
  buildSliderCrank,
  sliderCrankGeometry,
  sliderCrankKinematics,
  type SliderCrankParams,
} from '../slider-crank';

function withParams(patch: Partial<SliderCrankParams> = {}): SliderCrankParams {
  return { ...SLIDER_CRANK_DEFAULTS, ...patch };
}

function xAt(p: SliderCrankParams, theta: number): number {
  return sliderCrankKinematics({ ...p, crankAngle: theta }).sliderX;
}

describe('Slider-crank — derived geometry', () => {
  it('reports rod ratio L/r', () => {
    const g = sliderCrankGeometry(SLIDER_CRANK_DEFAULTS);
    expect(g.rodRatio).toBeCloseTo(
      SLIDER_CRANK_DEFAULTS.rodLength / SLIDER_CRANK_DEFAULTS.crankRadius,
      12,
    );
  });

  it.each([
    [0.5, 1.6, 0],
    [0.4, 2.0, 0],
    [1.0, 3.0, 0],
    [0.3, 1.2, 0],
  ])('stroke = 2r when e = 0   (r=%s, L=%s)', (r, L, e) => {
    const g = sliderCrankGeometry(withParams({ crankRadius: r, rodLength: L, eccentricity: e }));
    expect(g.stroke).toBeCloseTo(2 * r, 10);
  });

  it('TDC angle is 0 when e = 0', () => {
    const g = sliderCrankGeometry(withParams({ eccentricity: 0 }));
    expect(g.tdcAngle).toBeCloseTo(0, 12);
  });

  it('BDC angle is π when e = 0', () => {
    const g = sliderCrankGeometry(withParams({ eccentricity: 0 }));
    expect(g.bdcAngle).toBeCloseTo(Math.PI, 12);
  });

  it('max rod angle = asin((r + |e|) / L)', () => {
    const p = withParams({ crankRadius: 0.5, rodLength: 1.6, eccentricity: 0.2 });
    const g = sliderCrankGeometry(p);
    expect(g.maxRodAngle).toBeCloseTo(Math.asin((0.5 + 0.2) / 1.6), 12);
  });

  it('offset eccentricity shifts TDC off 0', () => {
    const g = sliderCrankGeometry(withParams({ eccentricity: 0.1 }));
    expect(Math.abs(g.tdcAngle)).toBeGreaterThan(1e-6);
  });

  it('throws when L < r + |e|', () => {
    expect(() => sliderCrankGeometry(withParams({ crankRadius: 1, rodLength: 0.5, eccentricity: 0 }))).toThrow();
    expect(() => sliderCrankGeometry(withParams({ crankRadius: 0.5, rodLength: 1, eccentricity: 0.6 }))).toThrow();
  });
});

describe('Slider-crank — rigid-rod invariant (|crankpin − wristpin| = L)', () => {
  const thetas = Array.from({ length: 24 }, (_, i) => (i * 2 * Math.PI) / 24);
  it.each(thetas.map((t) => [t]))('|P − Q| = L at θ = %s', (theta) => {
    const p = withParams({ crankAngle: theta });
    const k = sliderCrankKinematics(p);
    const dx = k.sliderX - k.crankpin[0];
    const dy = p.eccentricity - k.crankpin[1];
    expect(Math.hypot(dx, dy)).toBeCloseTo(p.rodLength, 10);
  });

  it('invariant also holds with eccentricity ≠ 0', () => {
    const p = withParams({ eccentricity: 0.15 });
    for (let i = 0; i < 32; i++) {
      const theta = (i * 2 * Math.PI) / 32;
      const k = sliderCrankKinematics({ ...p, crankAngle: theta });
      const dx = k.sliderX - k.crankpin[0];
      const dy = p.eccentricity - k.crankpin[1];
      expect(Math.hypot(dx, dy)).toBeCloseTo(p.rodLength, 10);
    }
  });
});

describe('Slider-crank — dead centres are critical points of x(θ)', () => {
  it('dx/dθ ≈ 0 at TDC and BDC (e = 0)', () => {
    const p = withParams({ eccentricity: 0 });
    const g = sliderCrankGeometry(p);
    const kTdc = sliderCrankKinematics({ ...p, crankAngle: g.tdcAngle });
    const kBdc = sliderCrankKinematics({ ...p, crankAngle: g.bdcAngle });
    expect(Math.abs(kTdc.velocityRatio)).toBeLessThan(1e-10);
    expect(Math.abs(kBdc.velocityRatio)).toBeLessThan(1e-10);
  });

  it('dx/dθ ≈ 0 at TDC and BDC (e ≠ 0)', () => {
    const p = withParams({ eccentricity: 0.12 });
    const g = sliderCrankGeometry(p);
    const kTdc = sliderCrankKinematics({ ...p, crankAngle: g.tdcAngle });
    const kBdc = sliderCrankKinematics({ ...p, crankAngle: g.bdcAngle });
    expect(Math.abs(kTdc.velocityRatio)).toBeLessThan(1e-10);
    expect(Math.abs(kBdc.velocityRatio)).toBeLessThan(1e-10);
  });

  it('x(TDC) is the max and x(BDC) is the min of x over one revolution', () => {
    const p = withParams({ eccentricity: 0.08 });
    const g = sliderCrankGeometry(p);
    let xMax = -Infinity;
    let xMin = +Infinity;
    for (let i = 0; i < 720; i++) {
      const t = (i * 2 * Math.PI) / 720;
      const x = xAt(p, t);
      if (x > xMax) xMax = x;
      if (x < xMin) xMin = x;
    }
    expect(g.xTdc).toBeCloseTo(xMax, 4);
    expect(g.xBdc).toBeCloseTo(xMin, 4);
    expect(g.stroke).toBeCloseTo(xMax - xMin, 4);
  });
});

describe('Slider-crank — symmetry when e = 0', () => {
  it('x(θ) = x(−θ)', () => {
    const p = withParams({ eccentricity: 0 });
    for (const t of [0.1, 0.7, 1.3, 2.0, 2.7]) {
      expect(xAt(p, t)).toBeCloseTo(xAt(p, -t), 12);
    }
  });

  it('β(−θ) = −β(θ)', () => {
    const p = withParams({ eccentricity: 0 });
    for (const t of [0.1, 0.7, 1.3, 2.0, 2.7]) {
      const a = sliderCrankKinematics({ ...p, crankAngle: t }).rodAngle;
      const b = sliderCrankKinematics({ ...p, crankAngle: -t }).rodAngle;
      expect(a).toBeCloseTo(-b, 12);
    }
  });

  it('dx/dθ > 0 on (π, 2π) and < 0 on (0, π)', () => {
    const p = withParams({ eccentricity: 0 });
    // Interior points only — dead centres themselves have dx/dθ = 0.
    for (const t of [0.5, 1.2, 2.5]) {
      expect(sliderCrankKinematics({ ...p, crankAngle: t }).velocityRatio).toBeLessThan(0);
    }
    for (const t of [3.6, 4.2, 5.5]) {
      expect(sliderCrankKinematics({ ...p, crankAngle: t }).velocityRatio).toBeGreaterThan(0);
    }
  });
});

describe('Slider-crank — analytic derivative matches numeric', () => {
  it.each([0, 0.4, 1.1, 1.9, 2.6, 3.4, 4.8, 5.7])('at θ = %s', (theta) => {
    const p = withParams({ eccentricity: 0.06 });
    const k = sliderCrankKinematics({ ...p, crankAngle: theta });
    const h = 1e-5;
    const xP = xAt(p, theta + h);
    const xM = xAt(p, theta - h);
    const numeric = (xP - xM) / (2 * h);
    expect(k.velocityRatio).toBeCloseTo(numeric, 6);
  });
});

describe('Slider-crank — max rod angle is actually attained', () => {
  it('sweeping θ finds |β| up to maxRodAngle', () => {
    const p = withParams({ eccentricity: 0.05 });
    const g = sliderCrankGeometry(p);
    let maxBeta = 0;
    for (let i = 0; i < 720; i++) {
      const t = (i * 2 * Math.PI) / 720;
      const b = Math.abs(sliderCrankKinematics({ ...p, crankAngle: t }).rodAngle);
      if (b > maxBeta) maxBeta = b;
    }
    expect(maxBeta).toBeCloseTo(g.maxRodAngle, 4);
  });
});

describe('Slider-crank — scene build', () => {
  it('produces 3 modules (crank / rod / slider) and 4 joints', () => {
    const b = buildSliderCrank();
    expect(b.rootOp.children).toHaveLength(3);
    expect(b.rootOp.children[0].label).toBe('Crank');
    expect(b.rootOp.children[1].label).toBe('Connecting rod');
    expect(b.rootOp.children[2].label).toBe('Slider');
    expect(b.joints).toHaveLength(4);
  });

  it('slider joint origin matches eccentricity axis', () => {
    const e = 0.12;
    const b = buildSliderCrank(withParams({ eccentricity: e }));
    const jSlider = b.joints.find((j) => j.label === 'Slider prismatic');
    expect(jSlider).toBeDefined();
    expect(jSlider!.origin[1]).toBeCloseTo(e, 12);
  });

  it('slider joint drive equals sliderX', () => {
    const b = buildSliderCrank(withParams({ crankAngle: 0.7 }));
    const jSlider = b.joints.find((j) => j.label === 'Slider prismatic');
    expect((jSlider as { drive?: number } | undefined)?.drive).toBeCloseTo(b.kinematics.sliderX, 10);
  });

  it('build exposes geometry and kinematics consistent with the standalone functions', () => {
    const p = withParams({ crankAngle: 1.2, eccentricity: 0.08 });
    const b = buildSliderCrank(p);
    const g = sliderCrankGeometry(p);
    const k = sliderCrankKinematics(p);
    expect(b.geometry.stroke).toBeCloseTo(g.stroke, 12);
    expect(b.kinematics.sliderX).toBeCloseTo(k.sliderX, 12);
  });
});

describe('Slider-crank — single-revolution structure', () => {
  it('sliderX at θ = 2π matches θ = 0 (periodicity)', () => {
    const p = withParams({ eccentricity: 0.05 });
    expect(xAt(p, 0)).toBeCloseTo(xAt(p, 2 * Math.PI), 10);
  });

  it('rodAngle is bounded by maxRodAngle across a revolution', () => {
    const p = withParams({ eccentricity: 0.07 });
    const g = sliderCrankGeometry(p);
    for (let i = 0; i < 360; i++) {
      const t = (i * 2 * Math.PI) / 360;
      const b = Math.abs(sliderCrankKinematics({ ...p, crankAngle: t }).rodAngle);
      expect(b).toBeLessThanOrEqual(g.maxRodAngle + 1e-9);
    }
  });
});
