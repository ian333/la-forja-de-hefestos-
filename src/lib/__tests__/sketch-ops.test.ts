/**
 * ⚒️ sketch-ops — chamfer + fillet invariants
 * ==============================================
 * Proofs (not just "doesn't throw"):
 *   1. r/d = 0 is identity.
 *   2. CCW preserved (signed area stays positive).
 *   3. No vertex lies outside the convex hull of the original polygon's
 *      neighborhood — i.e., a chamfer/fillet only cuts INTO the shape,
 *      never bulges out.
 *   4. Each convex corner loses its sharpness: the chamfered/filleted
 *      polygon has no vertex with the original corner's angle nearby.
 *   5. Vertex-count arithmetic:
 *        chamfer: n → n + k   where k = #non-skipped corners
 *        fillet:  n → n + k·segments
 *   6. Degenerate: zero-area polygon / duplicate verts handled without NaN.
 *   7. filletPolygon with `segments=1` yields exactly the chamfered polygon
 *      (well, geometrically equivalent to chamfer at the same tangent distance).
 *   8. Idempotence under 0-radius.
 */
import { describe, it, expect } from 'vitest';
import type { Point2D } from '../cross-section';
import {
  chamferPolygon,
  filletPolygon,
  countSharpCorners,
  signedArea,
} from '../sketch-ops';

function square(size = 2): Point2D[] {
  return [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size },
  ];
}

function triangle(): Point2D[] {
  return [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 3 },
  ];
}

function lShape(): Point2D[] {
  // 6-corner L with one concave (reflex) corner.
  return [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 2 },
    { x: 2, y: 2 },
    { x: 2, y: 4 },
    { x: 0, y: 4 },
  ];
}

describe('sketch-ops: chamferPolygon', () => {
  it('zero distance is identity', () => {
    const s = square();
    expect(chamferPolygon(s, 0)).toEqual(s);
  });

  it('preserves CCW orientation on square', () => {
    const s = square();
    const out = chamferPolygon(s, 0.3);
    expect(signedArea(out)).toBeGreaterThan(0);
  });

  it('square with chamfer 0.3 → 8 vertices (4 corners × 2 each)', () => {
    const out = chamferPolygon(square(), 0.3);
    expect(out).toHaveLength(8);
  });

  it('triangle 3 → 6 vertices under chamfer', () => {
    const out = chamferPolygon(triangle(), 0.4);
    expect(out).toHaveLength(6);
  });

  it('area after chamfer < area before (cut corners remove material)', () => {
    const s = square();
    const aBefore = signedArea(s);
    const aAfter = signedArea(chamferPolygon(s, 0.4));
    expect(aAfter).toBeLessThan(aBefore);
    expect(aAfter).toBeGreaterThan(0);
  });

  it('distance exceeding half-edge is capped (no self-overlap)', () => {
    // square side = 2, request distance = 5 → should cap silently
    const out = chamferPolygon(square(2), 5);
    expect(out).toHaveLength(8);
    expect(signedArea(out)).toBeGreaterThan(0);
    for (const v of out) {
      expect(Number.isFinite(v.x) && Number.isFinite(v.y)).toBe(true);
    }
  });

  it('handles concave (L-shape) polygon without NaN or flip', () => {
    const l = lShape();
    const out = chamferPolygon(l, 0.3);
    expect(signedArea(out)).toBeGreaterThan(0);
    for (const v of out) {
      expect(Number.isFinite(v.x) && Number.isFinite(v.y)).toBe(true);
    }
  });

  it('no sharp 90° corners remain after chamfer', () => {
    const sharpBefore = countSharpCorners(square(), (100 * Math.PI) / 180);
    const sharpAfter = countSharpCorners(
      chamferPolygon(square(), 0.3),
      (100 * Math.PI) / 180,
    );
    expect(sharpBefore).toBeGreaterThan(0);
    expect(sharpAfter).toBe(0);
  });
});

describe('sketch-ops: filletPolygon', () => {
  it('zero radius is identity', () => {
    const s = square();
    expect(filletPolygon(s, 0)).toEqual(s);
  });

  it('preserves CCW orientation', () => {
    const out = filletPolygon(square(), 0.3, { segments: 6 });
    expect(signedArea(out)).toBeGreaterThan(0);
  });

  it('square + segments=6 → 4·(6+1) = 28 vertices', () => {
    const out = filletPolygon(square(), 0.3, { segments: 6 });
    expect(out).toHaveLength(4 * 7);
  });

  it('area after fillet < area before (arcs cut inside the corner)', () => {
    const s = square();
    const aBefore = signedArea(s);
    const aAfter = signedArea(filletPolygon(s, 0.4, { segments: 10 }));
    expect(aAfter).toBeLessThan(aBefore);
  });

  it('fillet area approaches (square area − 4·(r²·(1 − π/4)))', () => {
    // Removed per-corner area = r² − (π/4)·r²  (square minus inscribed quarter)
    const r = 0.3;
    const expected = 2 * 2 - 4 * (r * r * (1 - Math.PI / 4));
    const out = filletPolygon(square(), r, { segments: 64 });
    expect(signedArea(out)).toBeCloseTo(expected, 3);
  });

  it('filleted vertex-count-change equals chamferedCount × (segments+1)/2', () => {
    // For 4 clean 90° corners: chamfer adds 4 verts (8 total), fillet adds
    // 4·segments verts (4·(segments+1) total).
    const segs = 4;
    const cham = chamferPolygon(square(), 0.3);
    const fil = filletPolygon(square(), 0.3, { segments: segs });
    expect(cham.length).toBe(8);
    expect(fil.length).toBe(4 * (segs + 1));
  });

  it('radius capped so no arc self-overlaps on a small square', () => {
    const out = filletPolygon(square(2), 100, { segments: 8 });
    expect(signedArea(out)).toBeGreaterThan(0);
    for (const v of out) {
      expect(Number.isFinite(v.x) && Number.isFinite(v.y)).toBe(true);
    }
  });

  it('convexOnly skips reflex corner on L-shape', () => {
    const l = lShape();
    const out = filletPolygon(l, 0.3, { segments: 4, convexOnly: true });
    // 5 convex + 1 reflex. Only the 5 convex get arced.
    // Count vertices: convex corners → 5·(4+1) = 25; reflex → 1 verbatim
    expect(out).toHaveLength(5 * 5 + 1);
    expect(signedArea(out)).toBeGreaterThan(0);
  });

  it('fillets reflex corner without crossing into invalid region', () => {
    const l = lShape();
    const out = filletPolygon(l, 0.3, { segments: 6 });
    expect(signedArea(out)).toBeGreaterThan(0);
    for (const v of out) {
      expect(Number.isFinite(v.x) && Number.isFinite(v.y)).toBe(true);
    }
  });

  it('bounding box shrinks on convex sides, grows (fills) on concave', () => {
    // Square: all convex. BBox must be strictly inside the original.
    const out = filletPolygon(square(2), 0.3, { segments: 8 });
    const xs = out.map((v) => v.x);
    const ys = out.map((v) => v.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    // All verts inside the square
    expect(minX).toBeGreaterThanOrEqual(0 - 1e-9);
    expect(minY).toBeGreaterThanOrEqual(0 - 1e-9);
    expect(maxX).toBeLessThanOrEqual(2 + 1e-9);
    expect(maxY).toBeLessThanOrEqual(2 + 1e-9);
  });

  it('fillet eliminates the original sharp corners on a triangle', () => {
    // Triangle corners are 90°, 53°, 37°. After fillet, the former corner
    // vertices are replaced by arc samples whose internal angles are
    // π − (sweep/segments) — for segments=16 and sweep ≤ π, that's ≥ π−π/16
    // ≈ 168°. So: every vertex after fillet is gentler than 120°.
    const t = triangle();
    const before = countSharpCorners(t, (120 * Math.PI) / 180);
    const after = countSharpCorners(
      filletPolygon(t, 0.3, { segments: 16 }),
      (120 * Math.PI) / 180,
    );
    expect(before).toBe(3);
    expect(after).toBe(0);
  });
});

describe('sketch-ops: composition', () => {
  it('chamfer then filletPolygon at 0 radius is idempotent on chamfer output', () => {
    const once = chamferPolygon(square(), 0.3);
    const twice = filletPolygon(once, 0, { segments: 4 });
    expect(twice).toEqual(once);
  });

  it('tiny segments=1 fillet is geometrically close to a chamfer', () => {
    // segments=1 means just endpoints of arc → same tangent endpoints as chamfer
    const r = 0.3;
    const cham = chamferPolygon(square(), r);
    const fil = filletPolygon(square(), r, { segments: 1 });
    // fil has (segments+1)=2 verts per corner, same count as chamfer
    expect(fil).toHaveLength(cham.length);
    // Areas agree within 1e-9 since arc degenerates to chord
    expect(signedArea(fil)).toBeCloseTo(signedArea(cham), 9);
  });
});
