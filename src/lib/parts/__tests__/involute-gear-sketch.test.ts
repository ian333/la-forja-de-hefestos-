/**
 * Invariants on the involute gear sketch (pure 2D).
 * Run with `npm test`.
 */
import { describe, it, expect } from 'vitest';
import {
  GEAR_SKETCH_DEFAULTS,
  buildGearSketch,
  deriveGearGeometry,
  sketchSignedArea,
  sketchRadialBounds,
  sketchRotationalSymmetryError,
  type GearSketchParams,
} from '../involute-gear-sketch';

const CASES: GearSketchParams[] = [
  { ...GEAR_SKETCH_DEFAULTS, teethCount: 20 },
  { ...GEAR_SKETCH_DEFAULTS, teethCount: 12 },       // will undercut — radial drop on
  { ...GEAR_SKETCH_DEFAULTS, teethCount: 40 },
  { ...GEAR_SKETCH_DEFAULTS, teethCount: 20, module: 2.5 },
  { ...GEAR_SKETCH_DEFAULTS, teethCount: 24, pressureAngle: (14.5 * Math.PI) / 180 },
  { ...GEAR_SKETCH_DEFAULTS, teethCount: 24, pressureAngle: (25 * Math.PI) / 180 },
];

describe('involute gear sketch', () => {
  for (const p of CASES) {
    const tag = `Z=${p.teethCount} m=${p.module} α=${Math.round((p.pressureAngle * 180) / Math.PI)}°`;

    describe(tag, () => {
      const g = deriveGearGeometry(p);
      const verts = buildGearSketch(p);

      it('generates a non-empty closed polyline', () => {
        expect(verts.length).toBeGreaterThan(p.teethCount * 4);
      });

      it('has positive (CCW) area', () => {
        expect(sketchSignedArea(verts)).toBeGreaterThan(0);
      });

      it('all vertices within [rf, ra] (± 1e-9)', () => {
        const { min, max } = sketchRadialBounds(verts);
        expect(min).toBeGreaterThanOrEqual(g.dedendumRadius - 1e-9);
        expect(max).toBeLessThanOrEqual(g.addendumRadius + 1e-9);
      });

      it('at least one vertex touches the addendum (within 1e-6)', () => {
        const { max } = sketchRadialBounds(verts);
        expect(Math.abs(max - g.addendumRadius)).toBeLessThan(1e-6);
      });

      it('at least one vertex touches the dedendum (within 1e-6)', () => {
        const { min } = sketchRadialBounds(verts);
        expect(Math.abs(min - g.dedendumRadius)).toBeLessThan(1e-6);
      });

      it('has Z-fold rotational symmetry (Hausdorff < 1e-6 · ra)', () => {
        const err = sketchRotationalSymmetryError(verts, p.teethCount);
        expect(err).toBeLessThan(1e-6 * g.addendumRadius);
      });

      it('no two consecutive vertices are coincident', () => {
        for (let i = 0; i < verts.length; i++) {
          const j = (i + 1) % verts.length;
          const d = Math.hypot(verts[i].x - verts[j].x, verts[i].y - verts[j].y);
          expect(d).toBeGreaterThan(1e-12);
        }
      });
    });
  }

  it('rotation param shifts geometry by exactly that angle', () => {
    const base = buildGearSketch(GEAR_SKETCH_DEFAULTS);
    const shifted = buildGearSketch({ ...GEAR_SKETCH_DEFAULTS, rotation: 0.37 });
    expect(base.length).toEqual(shifted.length);
    // Rotate base by 0.37 and compare pointwise.
    const c = Math.cos(0.37);
    const s = Math.sin(0.37);
    let maxErr = 0;
    for (let i = 0; i < base.length; i++) {
      const rx = c * base[i].x - s * base[i].y;
      const ry = s * base[i].x + c * base[i].y;
      const d = Math.hypot(rx - shifted[i].x, ry - shifted[i].y);
      if (d > maxErr) maxErr = d;
    }
    expect(maxErr).toBeLessThan(1e-9);
  });

  it('pitch radius = m·Z/2 (formula check)', () => {
    const g = deriveGearGeometry(GEAR_SKETCH_DEFAULTS);
    expect(g.pitchRadius).toBeCloseTo(
      (GEAR_SKETCH_DEFAULTS.module * GEAR_SKETCH_DEFAULTS.teethCount) / 2,
      12,
    );
  });
});
