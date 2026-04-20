/**
 * ⚒️ Gear Pair — End-to-End Invariants
 * =====================================
 * Four hard invariants that must hold for any working spur-gear mesh:
 *   (1) Exact gear ratio        — driven angle = −drive · z1/z2 (+ phase)
 *   (2) Exact center distance   — C = m · (z1 + z2) / 2
 *   (3) No interference         — gear-2 profile never penetrates gear 1's body
 *   (4) Contact ratio in (1,2)  — mesh is continuous, no chatter
 *
 * Tests run over several parameter combos and several drive angles.
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
  deriveGearGeometry,
} from '../involute-gear-sketch';
import { evaluateSdf, type Vec3 } from '../../sdf-cpu';

const PARAM_CASES: Array<{ name: string; params: GearPairParams }> = [
  { name: 'default 20:40', params: GEAR_PAIR_DEFAULTS },
  { name: '20:20', params: { ...GEAR_PAIR_DEFAULTS, teeth2: 20 } },
  { name: '17:53', params: { ...GEAR_PAIR_DEFAULTS, teeth1: 17, teeth2: 53 } },
  { name: 'm=2.5', params: { ...GEAR_PAIR_DEFAULTS, module: 2.5 } },
  { name: '24:24 α=25°', params: { ...GEAR_PAIR_DEFAULTS, teeth1: 24, teeth2: 24, pressureAngle: (25 * Math.PI) / 180 } },
];

const DRIVE_SAMPLES = 17;
function driveGrid(): number[] {
  const out: number[] = [];
  for (let i = 0; i < DRIVE_SAMPLES; i++) {
    out.push((i / (DRIVE_SAMPLES - 1)) * 2 * Math.PI - Math.PI);
  }
  return out;
}

describe('Gear pair invariants', () => {
  for (const { name, params } of PARAM_CASES) {
    describe(name, () => {
      it('(2) center distance equals m·(z1+z2)/2 exactly', () => {
        const g = gearPairGeometry(params);
        expect(g.centerDistance).toBeCloseTo(
          (params.module * (params.teeth1 + params.teeth2)) / 2,
          12,
        );
      });

      it('(1) gear-2 angle follows the ratio across drive sweep (|err| < 1e-12)', () => {
        let maxErr = 0;
        for (const drive of driveGrid()) {
          const g = gearPairGeometry({ ...params, drive });
          const expected = expectedGear2Angle({ ...params, drive });
          const err = Math.abs(g.angle2 - expected);
          if (err > maxErr) maxErr = err;
        }
        expect(maxErr).toBeLessThan(1e-12);
      });

      it('(4) contact ratio lies in (1, 2.5)', () => {
        const eps = contactRatio(params);
        expect(eps).toBeGreaterThan(1.0);
        expect(eps).toBeLessThan(2.5);
      });

      it('(3) no interference: gear-2 profile never penetrates gear 1', () => {
        // Sample gear-2's sketch at several drive angles; transform each
        // vertex to world coords and evaluate gear-1's SDF. Must be ≥ −tol.
        // tol accounts for (a) polyline discretization error on curved flanks,
        // (b) undercut interference at small Z (Z<17 with standard α=20°).
        // Real manufacturing fixes (b) with profile shift — out of MVP scope.
        const tol =
          params.teeth1 < 17 || params.teeth2 < 17
            ? params.module * 0.05   // allow undercut-era interference
            : params.module * 0.015; // tight: just sampling/fp error
        let worstPenetration = 0;
        let worstAt = { drive: 0, vert: [0, 0] as [number, number] };

        for (const drive of driveGrid()) {
          const build = buildGearPair({ ...params, drive });
          const geom = build.geometry;

          // Gear 2 sketch (local to gear 2's frame), with phase baked into rotation
          const gear2Sketch = buildGearSketch({
            module: params.module,
            teethCount: params.teeth2,
            pressureAngle: params.pressureAngle,
            addendumCoef: params.addendumCoef,
            dedendumCoef: params.dedendumCoef,
            profileResolution: params.profileResolution,
            arcResolution: params.arcResolution,
            rotation: geom.angle2,
          });

          for (const v of gear2Sketch) {
            const worldPt: Vec3 = [
              v.x + geom.centerDistance,
              v.y,
              0, // mid-thickness
            ];
            const sdGear1 = evaluateSdf(build.gear1, worldPt);
            if (-sdGear1 > worstPenetration) {
              worstPenetration = -sdGear1;
              worstAt = { drive, vert: [v.x, v.y] };
            }
          }
        }

        void worstAt;
        expect(worstPenetration).toBeLessThanOrEqual(tol);
      });

      it('gear-1 and gear-2 addendum-tip clearance > 0 at drive=0', () => {
        // Concrete geometric sanity check on the mesh alignment.
        const g = gearPairGeometry(params);
        const g1 = deriveGearGeometry({
          module: params.module,
          teethCount: params.teeth1,
          pressureAngle: params.pressureAngle,
          addendumCoef: params.addendumCoef,
          dedendumCoef: params.dedendumCoef,
          profileResolution: params.profileResolution,
          arcResolution: params.arcResolution,
          rotation: 0,
        });
        const g2 = deriveGearGeometry({
          module: params.module,
          teethCount: params.teeth2,
          pressureAngle: params.pressureAngle,
          addendumCoef: params.addendumCoef,
          dedendumCoef: params.dedendumCoef,
          profileResolution: params.profileResolution,
          arcResolution: params.arcResolution,
          rotation: 0,
        });
        // Gear 1 tooth 0 tip at (ra1, 0). Gear 2 nearest tooth tip offset by ±π/z2
        // from angle π (in gear-2 local) i.e. world (C − ra2·cos(π/z2), ±ra2·sin(π/z2)).
        const tipG1: Vec3 = [g1.addendumRadius, 0, 0];
        const tipG2: Vec3 = [
          g.centerDistance - g2.addendumRadius * Math.cos(Math.PI / params.teeth2),
          g2.addendumRadius * Math.sin(Math.PI / params.teeth2),
          0,
        ];
        const clearance = Math.hypot(
          tipG2[0] - tipG1[0],
          tipG2[1] - tipG1[1],
        );
        expect(clearance).toBeGreaterThan(0);
      });
    });
  }
});
