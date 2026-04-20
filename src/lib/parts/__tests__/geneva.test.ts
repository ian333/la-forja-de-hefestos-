/**
 * ⚒️ Geneva drive — kinematic & geometric invariants
 * ===================================================
 *   1. Geometric constraints:  sin(π/N) = a/C,  b = C·cos(π/N),  α = π/2 − π/N.
 *   2. Engagement / dwell fractions sum to 1; engagementFraction = 1/2 − 1/N.
 *   3. The driven angle advances by exactly −2π/N per completed engagement
 *      (one driver revolution = one slot advance, opposite direction).
 *   4. Kinematic law continuity at engagement boundaries (θ_D = ±α).
 *      At θ_D = ±α, φ_G = rest_before and rest_after respectively.
 *   5. At θ_D = 0 (pin dead-centre in the slot), φ_G = 0 (after engagement index 0).
 *   6. engaged flag matches |localPhase| < α exactly.
 *   7. Scene build: driver disc + pin + Geneva wheel all present with correct
 *      positions; joints exist; center-distance in the driven joint matches
 *      the derived geometry.
 *   8. Geneva wheel polygon has the expected vertex count (N slots × (arcSteps+3)).
 *   9. Symmetry: φ_G(−θ_D) = −φ_G(θ_D) around θ_D = 0.
 *  10. Monotonicity: during one engagement, φ_G is strictly monotone in θ_D.
 *  11. Non-positive slotCount throws; slotCount < 3 throws.
 */

import { describe, it, expect } from 'vitest';
import {
  GENEVA_DEFAULTS,
  buildGeneva,
  genevaGeometry,
  genevaKinematics,
  type GenevaParams,
} from '../geneva';

function withSlots(N: number, patch: Partial<GenevaParams> = {}): GenevaParams {
  return { ...GENEVA_DEFAULTS, slotCount: N, ...patch };
}

describe('Geneva — derived geometry', () => {
  it.each([3, 4, 5, 6, 8, 10, 12])(
    'sin(π/N) = a / C   (N=%i)',
    (N) => {
      const g = genevaGeometry(withSlots(N));
      expect(GENEVA_DEFAULTS.crankRadius / g.centerDistance).toBeCloseTo(
        Math.sin(Math.PI / N),
        12,
      );
    },
  );

  it.each([3, 4, 5, 6, 8, 10, 12])(
    'wheelRadius = C · cos(π/N)   (N=%i)',
    (N) => {
      const g = genevaGeometry(withSlots(N));
      expect(g.wheelRadius).toBeCloseTo(
        g.centerDistance * Math.cos(Math.PI / N),
        12,
      );
    },
  );

  it.each([3, 4, 5, 6, 8, 10, 12])(
    'α = π/2 − π/N   (N=%i)',
    (N) => {
      const g = genevaGeometry(withSlots(N));
      expect(g.engagementHalfAngle).toBeCloseTo(
        Math.PI / 2 - Math.PI / N,
        12,
      );
    },
  );

  it('engagementFraction + dwellFraction = 1', () => {
    for (const N of [3, 4, 6, 8, 12]) {
      const g = genevaGeometry(withSlots(N));
      expect(g.engagementFraction + g.dwellFraction).toBeCloseTo(1, 12);
    }
  });

  it('engagementFraction matches 1/2 − 1/N', () => {
    for (const N of [3, 4, 6, 8, 12]) {
      const g = genevaGeometry(withSlots(N));
      expect(g.engagementFraction).toBeCloseTo(0.5 - 1 / N, 12);
    }
  });

  it('Pythagorean identity a² + b² = C²', () => {
    for (const N of [3, 4, 6, 8, 12]) {
      const p = withSlots(N);
      const g = genevaGeometry(p);
      expect(p.crankRadius * p.crankRadius + g.wheelRadius * g.wheelRadius)
        .toBeCloseTo(g.centerDistance * g.centerDistance, 10);
    }
  });

  it('throws on slotCount < 3', () => {
    expect(() => genevaGeometry(withSlots(2))).toThrow();
    expect(() => genevaGeometry(withSlots(1))).toThrow();
    expect(() => genevaGeometry(withSlots(0))).toThrow();
  });
});

describe('Geneva — kinematic law', () => {
  it('at θ_D = 0 the Geneva is at its index-0 engagement centre (φ_G = 0)', () => {
    for (const N of [3, 4, 6, 8]) {
      const k = genevaKinematics(withSlots(N, { drive: 0 }));
      expect(k.engaged).toBe(true);
      expect(k.cycleIndex).toBe(0);
      expect(k.drivenAngle).toBeCloseTo(0, 12);
    }
  });

  it('engaged ⇔ |localPhase| < α', () => {
    for (const N of [3, 4, 6, 8]) {
      const g = genevaGeometry(withSlots(N));
      const alpha = g.engagementHalfAngle;
      // just inside engagement
      const inside = genevaKinematics(withSlots(N, { drive: 0.99 * alpha }));
      expect(inside.engaged).toBe(true);
      // just outside engagement
      const outside = genevaKinematics(withSlots(N, { drive: 1.01 * alpha }));
      expect(outside.engaged).toBe(false);
    }
  });

  it('continuity at engagement boundary: φ_G → rest position', () => {
    for (const N of [3, 4, 6, 8]) {
      const g = genevaGeometry(withSlots(N));
      const alpha = g.engagementHalfAngle;
      const eps = 1e-6;

      // Just before engagement exit (θ_D = α − ε): φ_G close to −slot/2
      const endOfEngagement = genevaKinematics(withSlots(N, { drive: alpha - eps }));
      expect(endOfEngagement.drivenAngle).toBeCloseTo(-g.slotAngle / 2, 5);

      // Just after (θ_D = α + ε): dwell at rest_after_0 = −slot/2
      const justAfter = genevaKinematics(withSlots(N, { drive: alpha + eps }));
      expect(justAfter.engaged).toBe(false);
      expect(justAfter.drivenAngle).toBeCloseTo(-g.slotAngle / 2, 12);
    }
  });

  it('one full driver revolution advances Geneva by exactly −2π/N', () => {
    for (const N of [3, 4, 6, 8]) {
      const g = genevaGeometry(withSlots(N));
      const at0 = genevaKinematics(withSlots(N, { drive: 0 }));
      const at2pi = genevaKinematics(withSlots(N, { drive: 2 * Math.PI }));
      expect(at2pi.drivenAngle - at0.drivenAngle).toBeCloseTo(
        -g.slotAngle,
        10,
      );
    }
  });

  it('N full driver revolutions advance Geneva by exactly −2π', () => {
    for (const N of [3, 4, 6, 8]) {
      const at0 = genevaKinematics(withSlots(N, { drive: 0 }));
      const atN = genevaKinematics(withSlots(N, { drive: N * 2 * Math.PI }));
      expect(atN.drivenAngle - at0.drivenAngle).toBeCloseTo(-2 * Math.PI, 10);
    }
  });

  it('symmetry φ_G(−θ) = −φ_G(θ) within engagement', () => {
    for (const N of [3, 4, 6, 8]) {
      const g = genevaGeometry(withSlots(N));
      for (const frac of [0.1, 0.25, 0.5, 0.75, 0.95]) {
        const t = frac * g.engagementHalfAngle;
        const pos = genevaKinematics(withSlots(N, { drive: t }));
        const neg = genevaKinematics(withSlots(N, { drive: -t }));
        expect(pos.drivenAngle).toBeCloseTo(-neg.drivenAngle, 10);
      }
    }
  });

  it('monotone: φ_G is strictly decreasing across one engagement window', () => {
    for (const N of [4, 6, 8]) {
      const g = genevaGeometry(withSlots(N));
      const steps = 40;
      let prev = Infinity;
      for (let i = 0; i <= steps; i++) {
        const t = -g.engagementHalfAngle + (2 * g.engagementHalfAngle * i) / steps;
        const k = genevaKinematics(withSlots(N, { drive: t }));
        expect(k.drivenAngle).toBeLessThan(prev);
        prev = k.drivenAngle;
      }
    }
  });

  it('cycleIndex increments every driver revolution', () => {
    for (const M of [0, 1, 2, 5, -1, -3]) {
      const k = genevaKinematics(withSlots(4, { drive: 2 * Math.PI * M }));
      expect(k.cycleIndex).toBe(M);
      expect(k.engaged).toBe(true);
      expect(k.localPhase).toBeCloseTo(0, 10);
    }
  });

  it('cycle wrap: θ_D just past 2π is engagement index 1 (small negative phase) — still engaged', () => {
    const g = genevaGeometry(withSlots(4));
    const k = genevaKinematics(withSlots(4, { drive: 2 * Math.PI - 0.5 * g.engagementHalfAngle }));
    // Distance from nearest engagement center (2π): 0.5·α → engaged at k=1
    expect(k.cycleIndex).toBe(1);
    expect(k.engaged).toBe(true);
  });
});

describe('Geneva — scene build', () => {
  it('rootOp unions driver + Geneva modules with stable ids', () => {
    const b = buildGeneva();
    expect(b.rootOp.type).toBe('union');
    expect(b.rootOp.children.length).toBe(2);
    expect(b.driver.kind).toBe('module');
    expect(b.geneva.kind).toBe('module');
    expect(b.joints).toHaveLength(2);
  });

  it('joints place the driver at origin and Geneva at (C, 0, 0)', () => {
    const b = buildGeneva();
    const drJoint = b.joints.find((j) => j.label === 'Driver revolute');
    const gvJoint = b.joints.find((j) => j.label === 'Geneva revolute');
    expect(drJoint).toBeDefined();
    expect(gvJoint).toBeDefined();
    expect(drJoint!.origin).toEqual([0, 0, 0]);
    expect(gvJoint!.origin[0]).toBeCloseTo(b.geometry.centerDistance, 10);
    expect(gvJoint!.origin[1]).toBeCloseTo(0, 10);
  });

  it('driver has a disc + a pin; pin position = (a·cos θ_D, a·sin θ_D)', () => {
    const theta = 0.3;
    const b = buildGeneva({ ...GENEVA_DEFAULTS, drive: theta });
    // Module wraps a union; union's children are [disc, pin].
    const union = b.driver.children[0] as { children: Array<{ label?: string; position: [number, number, number] }> };
    expect(union.children.length).toBe(2);
    const pin = union.children.find((c) => c.label === 'Driver — pin');
    expect(pin).toBeDefined();
    expect(pin!.position[0]).toBeCloseTo(GENEVA_DEFAULTS.crankRadius * Math.cos(theta), 10);
    expect(pin!.position[1]).toBeCloseTo(GENEVA_DEFAULTS.crankRadius * Math.sin(theta), 10);
  });

  it('Geneva wheel is positioned at (C, 0, 0) with rotation = drivenAngle', () => {
    const b = buildGeneva({ ...GENEVA_DEFAULTS, drive: 0.2 });
    const union = b.geneva.children[0] as { children: Array<{ position: [number, number, number]; rotation: [number, number, number] }> };
    const body = union.children[0];
    expect(body.position[0]).toBeCloseTo(b.geometry.centerDistance, 10);
    expect(body.rotation[2]).toBeCloseTo(b.kinematics.drivenAngle, 10);
  });

  it('Geneva polygon has a reasonable vertex count (slots embedded in the rim)', () => {
    const b = buildGeneva({ ...GENEVA_DEFAULTS, slotCount: 4, circleResolution: 48 });
    const union = b.geneva.children[0] as { children: Array<{ polyVerts?: [number, number][] }> };
    const body = union.children[0];
    expect(body.polyVerts).toBeDefined();
    // N slots × (arcSteps + 3 vertex slot rectangle punch) ≈ 4 × (12 + 1 + 2) vertices
    expect(body.polyVerts!.length).toBeGreaterThan(30);
    expect(body.polyVerts!.length).toBeLessThan(120);
  });
});
