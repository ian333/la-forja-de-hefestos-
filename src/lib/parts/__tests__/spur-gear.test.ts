/**
 * CPU SDF invariants for the spur-gear module.
 * Sanity checks that the extruded polygon + bore behaves as a gear.
 */
import { describe, it, expect } from 'vitest';
import {
  SPUR_GEAR_DEFAULTS,
  buildSpurGear,
  spurGearGeometry,
  type SpurGearParams,
} from '../spur-gear';
import { evaluateSdf, type Vec3 } from '../../sdf-cpu';

function pointAtAngleRadius(angle: number, r: number, z = 0): Vec3 {
  return [r * Math.cos(angle), r * Math.sin(angle), z];
}

describe('spur gear SdfModule', () => {
  const p: SpurGearParams = { ...SPUR_GEAR_DEFAULTS, teethCount: 20 };
  const g = spurGearGeometry(p);
  const mod = buildSpurGear(p);

  it('has 1 top-level child (solid = body − bore)', () => {
    expect(mod.children.length).toBe(1);
  });

  it('material exists on pitch circle at tooth center (SDF < 0)', () => {
    // tooth 0 center is at angle 0
    const pt = pointAtAngleRadius(0, g.pitchRadius, 0);
    expect(evaluateSdf(mod, pt)).toBeLessThan(0);
  });

  it('empty on pitch circle between teeth (SDF > 0)', () => {
    // Midpoint between tooth 0 and tooth 1 is at angle = π/Z
    const pt = pointAtAngleRadius(Math.PI / p.teethCount, g.pitchRadius, 0);
    expect(evaluateSdf(mod, pt)).toBeGreaterThan(0);
  });

  it('empty beyond addendum circle (SDF > 0)', () => {
    const pt = pointAtAngleRadius(0, g.addendumRadius + 0.2, 0);
    expect(evaluateSdf(mod, pt)).toBeGreaterThan(0);
  });

  it('empty inside bore (SDF > 0)', () => {
    const pt: Vec3 = [0, 0, 0];
    expect(evaluateSdf(mod, pt)).toBeGreaterThan(0);
  });

  it('material between bore and dedendum (SDF < 0)', () => {
    const rMid = (p.boreDiameter / 2 + g.dedendumRadius) / 2;
    const pt = pointAtAngleRadius(0, rMid, 0);
    expect(evaluateSdf(mod, pt)).toBeLessThan(0);
  });

  it('empty above/below axial thickness (SDF > 0)', () => {
    const pt = pointAtAngleRadius(0, g.pitchRadius, p.thickness);
    expect(evaluateSdf(mod, pt)).toBeGreaterThan(0);
  });

  it('centerX/centerY offset translates the gear', () => {
    const offset: SpurGearParams = { ...p, centerX: 5, centerY: 3 };
    const modOff = buildSpurGear(offset);
    // Point that was inside the centered gear, offset by the translation
    const pt: Vec3 = [5 + g.pitchRadius * Math.cos(0), 3 + g.pitchRadius * Math.sin(0), 0];
    expect(evaluateSdf(modOff, pt)).toBeLessThan(0);
    // Same point in world but gear not translated → should be outside
    const modAtOrigin = buildSpurGear(p);
    expect(evaluateSdf(modAtOrigin, pt)).toBeGreaterThan(0);
  });

  it('phase rotates the tooth centers', () => {
    const phased: SpurGearParams = { ...p, phase: Math.PI / p.teethCount };
    const modPhased = buildSpurGear(phased);
    // What used to be "between teeth" is now "tooth center"
    const pt = pointAtAngleRadius(Math.PI / p.teethCount, g.pitchRadius, 0);
    expect(evaluateSdf(modPhased, pt)).toBeLessThan(0);
  });
});
