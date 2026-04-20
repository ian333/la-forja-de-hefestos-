/**
 * ⚒️ Gear fillet — Invariants under fillet radius sweep
 * =======================================================
 * Adding a fillet to the tooth profile must preserve the kinematic invariants
 * (ratio, center distance, contact ratio stays valid) and must not introduce
 * new interference.
 */
import { describe, it, expect } from 'vitest';
import {
  GEAR_PAIR_DEFAULTS,
  buildGearPair,
  gearPairGeometry,
  expectedGear2Angle,
  contactRatio,
  type GearPairParams,
} from '../gear-pair';
import {
  buildGearSketch,
  GEAR_SKETCH_DEFAULTS,
  type GearSketchParams,
} from '../involute-gear-sketch';
import { signedArea, countSharpCorners } from '../../sketch-ops';
import { evaluateSdf, type Vec3 } from '../../sdf-cpu';

/** Convert pair params → sketch params for gear 1. */
function sketch1(p: GearPairParams, extras: Partial<GearSketchParams> = {}): GearSketchParams {
  return {
    ...GEAR_SKETCH_DEFAULTS,
    module: p.module,
    teethCount: p.teeth1,
    pressureAngle: p.pressureAngle,
    addendumCoef: p.addendumCoef,
    dedendumCoef: p.dedendumCoef,
    profileResolution: p.profileResolution,
    arcResolution: p.arcResolution,
    rotation: 0,
    filletRadius: p.filletRadius ?? 0,
    filletSegments: p.filletSegments ?? 4,
    ...extras,
  };
}

const FILLETS = [0, 0.05, 0.1, 0.2];

describe('Gear fillet — kinematic invariants unchanged', () => {
  for (const r of FILLETS) {
    describe(`filletRadius = ${r}`, () => {
      const params: GearPairParams = { ...GEAR_PAIR_DEFAULTS, filletRadius: r };

      it('center distance unchanged', () => {
        const g = gearPairGeometry(params);
        expect(g.centerDistance).toBeCloseTo(
          (params.module * (params.teeth1 + params.teeth2)) / 2,
          12,
        );
      });

      it('gear ratio still exact across drive sweep', () => {
        let maxErr = 0;
        for (let i = 0; i < 9; i++) {
          const drive = (i / 8) * 2 * Math.PI - Math.PI;
          const g = gearPairGeometry({ ...params, drive });
          const err = Math.abs(g.angle2 - expectedGear2Angle({ ...params, drive }));
          if (err > maxErr) maxErr = err;
        }
        expect(maxErr).toBeLessThan(1e-12);
      });

      it('contact ratio still in (1, 2.5)', () => {
        // contactRatio uses the analytical formula — not the sketch samples —
        // so it must be ε-independent of fillet radius. This documents that.
        const eps = contactRatio(params);
        expect(eps).toBeGreaterThan(1.0);
        expect(eps).toBeLessThan(2.5);
      });
    });
  }
});

describe('Gear fillet — sketch-level effects', () => {
  it('vertex count grows with filletRadius', () => {
    const sharp = buildGearSketch(sketch1(GEAR_PAIR_DEFAULTS));
    const rounded = buildGearSketch(sketch1({ ...GEAR_PAIR_DEFAULTS, filletRadius: 0.2 }));
    expect(rounded.length).toBeGreaterThan(sharp.length);
  });

  it('signed area slightly decreases (fillet cuts material from tips)', () => {
    const sharp = buildGearSketch(sketch1(GEAR_PAIR_DEFAULTS));
    const rounded = buildGearSketch(sketch1({ ...GEAR_PAIR_DEFAULTS, filletRadius: 0.15 }));
    expect(signedArea(rounded)).toBeLessThan(signedArea(sharp));
    // but within 5% — fillet should be a finishing touch, not a major volume change
    expect(signedArea(rounded)).toBeGreaterThan(signedArea(sharp) * 0.95);
  });

  it('fewer sharp corners (< 120°) after fillet', () => {
    const sharp = buildGearSketch(sketch1(GEAR_PAIR_DEFAULTS));
    const rounded = buildGearSketch(
      sketch1({ ...GEAR_PAIR_DEFAULTS, filletRadius: 0.15, filletSegments: 6 }),
    );
    const sharpBefore = countSharpCorners(sharp, (120 * Math.PI) / 180);
    const sharpAfter = countSharpCorners(rounded, (120 * Math.PI) / 180);
    expect(sharpBefore).toBeGreaterThan(0);
    expect(sharpAfter).toBeLessThan(sharpBefore);
  });

  it('CCW orientation preserved after fillet', () => {
    const rounded = buildGearSketch(sketch1({ ...GEAR_PAIR_DEFAULTS, filletRadius: 0.2 }));
    expect(signedArea(rounded)).toBeGreaterThan(0);
  });
});

describe('Gear fillet — no new interference', () => {
  it('filletted gear 2 does not penetrate gear 1 beyond sharp baseline', () => {
    const sharpParams = { ...GEAR_PAIR_DEFAULTS, filletRadius: 0 };
    const roundedParams = { ...GEAR_PAIR_DEFAULTS, filletRadius: 0.15 };

    function worstPenetration(p: GearPairParams): number {
      let worst = 0;
      for (let i = 0; i < 9; i++) {
        const drive = (i / 8) * 2 * Math.PI - Math.PI;
        const build = buildGearPair({ ...p, drive });
        const g2sketch = buildGearSketch({
          ...GEAR_SKETCH_DEFAULTS,
          module: p.module,
          teethCount: p.teeth2,
          pressureAngle: p.pressureAngle,
          addendumCoef: p.addendumCoef,
          dedendumCoef: p.dedendumCoef,
          profileResolution: p.profileResolution,
          arcResolution: p.arcResolution,
          rotation: build.geometry.angle2,
          filletRadius: p.filletRadius ?? 0,
          filletSegments: p.filletSegments ?? 4,
        });
        for (const v of g2sketch) {
          const pt: Vec3 = [v.x + build.geometry.centerDistance, v.y, 0];
          const sd = evaluateSdf(build.gear1, pt);
          if (-sd > worst) worst = -sd;
        }
      }
      return worst;
    }

    const sharpPen = worstPenetration(sharpParams);
    const roundedPen = worstPenetration(roundedParams);
    // Fillet rounds off tooth tips → should REDUCE tip penetration.
    // Accept anything ≤ sharp + a tiny tolerance (the arc adds sample points
    // to already-clearing flanks, never tips that were clearing).
    expect(roundedPen).toBeLessThanOrEqual(sharpPen + GEAR_PAIR_DEFAULTS.module * 0.001);
  });
});
