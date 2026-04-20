import { describe, it, expect } from 'vitest';
import {
  psi_1s, psi_2s, psi_2pz, psi_2px, psi_2py,
  psi_3s, psi_3dz2,
  ORBITALS, sampleOrbital, orbitalEnergy, HARTREE_TO_EV,
} from '../quantum/orbitals';

describe('ψ_{1s}', () => {
  it('en r=0 y Z=1 vale 1/√π', () => {
    expect(psi_1s(0, 1)).toBeCloseTo(1 / Math.sqrt(Math.PI), 6);
  });

  it('decae exponencialmente', () => {
    expect(psi_1s(0, 1)).toBeGreaterThan(psi_1s(1, 1));
    expect(psi_1s(1, 1)).toBeGreaterThan(psi_1s(5, 1));
  });

  it('siempre positivo (sin nodos)', () => {
    for (const r of [0, 0.5, 1, 2, 5, 10]) {
      expect(psi_1s(r, 1)).toBeGreaterThan(0);
    }
  });

  it('normalización aproximada por integración radial ∫|ψ|²·4πr²dr ≈ 1', () => {
    let integral = 0;
    const dr = 0.01;
    for (let r = 0; r < 20; r += dr) {
      const p = psi_1s(r, 1);
      integral += p * p * 4 * Math.PI * r * r * dr;
    }
    expect(integral).toBeCloseTo(1, 2);
  });
});

describe('ψ_{2s}', () => {
  it('tiene nodo radial en r=2/Z bohrs', () => {
    // ψ(r=2, Z=1) = 0 porque (2 - Zr) = 0
    expect(Math.abs(psi_2s(2, 1))).toBeLessThan(1e-10);
  });

  it('cambia de signo cruzando el nodo', () => {
    expect(psi_2s(1, 1)).toBeGreaterThan(0);
    expect(psi_2s(3, 1)).toBeLessThan(0);
  });

  it('normalización aproximada ≈ 1', () => {
    let integral = 0;
    const dr = 0.02;
    for (let r = 0; r < 40; r += dr) {
      const p = psi_2s(r, 1);
      integral += p * p * 4 * Math.PI * r * r * dr;
    }
    expect(integral).toBeCloseTo(1, 1);
  });
});

describe('ψ_{2pz}', () => {
  it('tiene nodo en θ = π/2 (plano xy)', () => {
    expect(Math.abs(psi_2pz(2, Math.PI / 2, 1))).toBeLessThan(1e-12);
  });

  it('máximo en θ = 0 (eje +z)', () => {
    const up    = psi_2pz(2, 0, 1);
    const eq    = psi_2pz(2, Math.PI / 4, 1);
    const down  = psi_2pz(2, Math.PI, 1);
    expect(Math.abs(up)).toBeGreaterThan(Math.abs(eq));
    // Nodo angular opuesto: signo cambia pero |ψ| mismo
    expect(up).toBeCloseTo(-down, 10);
  });

  it('vale cero en r=0', () => {
    expect(psi_2pz(0, 0, 1)).toBe(0);
  });
});

describe('ψ_{2px}, ψ_{2py}', () => {
  it('2px tiene nodo en plano yz (θ=π/2, φ=π/2)', () => {
    expect(Math.abs(psi_2px(2, Math.PI / 2, Math.PI / 2, 1))).toBeLessThan(1e-12);
  });

  it('2py tiene nodo en plano xz (θ=π/2, φ=0)', () => {
    expect(Math.abs(psi_2py(2, Math.PI / 2, 0, 1))).toBeLessThan(1e-12);
  });

  it('rotación 90° convierte px en py', () => {
    const px0 = psi_2px(2, Math.PI / 2, 0, 1);
    const py90 = psi_2py(2, Math.PI / 2, Math.PI / 2, 1);
    expect(px0).toBeCloseTo(py90, 8);
  });
});

describe('ψ_{3s}', () => {
  it('tiene dos nodos radiales', () => {
    // Raíces de 27 - 18Zr + 2Zr² = 0 cuando Z=1: r = (18 ± √(324-216))/4 = (18 ± 10.39)/4
    const r1 = (18 - Math.sqrt(324 - 216)) / 4;  // ≈ 1.90
    const r2 = (18 + Math.sqrt(324 - 216)) / 4;  // ≈ 7.10
    expect(Math.abs(psi_3s(r1, 1))).toBeLessThan(1e-8);
    expect(Math.abs(psi_3s(r2, 1))).toBeLessThan(1e-8);
  });
});

describe('ψ_{3d_{z²}}', () => {
  it('tiene nodo cónico en cos²θ = 1/3', () => {
    // 3cos²θ - 1 = 0 → θ = arccos(1/√3) ≈ 54.7°
    const thetaNode = Math.acos(1 / Math.sqrt(3));
    expect(Math.abs(psi_3dz2(2, thetaNode, 1))).toBeLessThan(1e-10);
  });

  it('máximo en eje z, lóbulo torus en plano xy', () => {
    const zAxis   = psi_3dz2(2, 0, 1);              // 3·1 - 1 = 2
    const xyPlane = psi_3dz2(2, Math.PI / 2, 1);    // 3·0 - 1 = -1
    // En eje z: |ψ| ~ 2, en plano xy: |ψ| ~ 1. Signo opuesto.
    expect(Math.abs(zAxis) / Math.abs(xyPlane)).toBeCloseTo(2, 2);
    expect(zAxis * xyPlane).toBeLessThan(0);
  });
});

describe('ORBITALES catálogo', () => {
  it('contiene al menos los 5 hidrogenoides esenciales', () => {
    expect(ORBITALS['1s']).toBeDefined();
    expect(ORBITALS['2s']).toBeDefined();
    expect(ORBITALS['2px']).toBeDefined();
    expect(ORBITALS['2py']).toBeDefined();
    expect(ORBITALS['2pz']).toBeDefined();
  });

  it('cada orbital tiene psi evaluable y extensión positiva', () => {
    for (const [, orb] of Object.entries(ORBITALS)) {
      const v = orb.psi(0.5, 0.3, 0.1, 1);
      expect(Number.isFinite(v)).toBe(true);
      expect(orb.extent).toBeGreaterThan(0);
    }
  });

  it('numbers cuánticos n, l coherentes', () => {
    expect(ORBITALS['1s'].n).toBe(1);
    expect(ORBITALS['1s'].l).toBe(0);
    expect(ORBITALS['2s'].n).toBe(2);
    expect(ORBITALS['2s'].l).toBe(0);
    expect(ORBITALS['2px'].n).toBe(2);
    expect(ORBITALS['2px'].l).toBe(1);
    expect(ORBITALS['3dz2'].n).toBe(3);
    expect(ORBITALS['3dz2'].l).toBe(2);
  });
});

describe('sampleOrbital', () => {
  it('1s genera puntos con densidad mayor cerca del origen', () => {
    const pts = sampleOrbital(ORBITALS['1s'], 2000, 1, 123);
    expect(pts.length).toBeGreaterThan(500);
    const meanR = pts.reduce((s, p) => s + Math.hypot(p.x, p.y, p.z), 0) / pts.length;
    // <r> del 1s = 1.5 bohrs (hidrógeno)
    expect(meanR).toBeGreaterThan(0.7);
    expect(meanR).toBeLessThan(3);
  });

  it('2pz genera puntos concentrados cerca del eje z (|z| grande)', () => {
    const pts = sampleOrbital(ORBITALS['2pz'], 2000, 1, 456);
    const meanAbsZ = pts.reduce((s, p) => s + Math.abs(p.z), 0) / pts.length;
    const meanAbsXY = pts.reduce((s, p) => s + Math.hypot(p.x, p.y), 0) / pts.length;
    expect(meanAbsZ).toBeGreaterThan(meanAbsXY * 0.8);
  });

  it('2pz devuelve puntos con signos + y − en lóbulos opuestos', () => {
    const pts = sampleOrbital(ORBITALS['2pz'], 2000, 1, 789);
    const posPts = pts.filter((p) => p.sign > 0);
    const negPts = pts.filter((p) => p.sign < 0);
    // Lóbulo + en z>0, lóbulo − en z<0
    const meanZPos = posPts.reduce((s, p) => s + p.z, 0) / Math.max(1, posPts.length);
    const meanZNeg = negPts.reduce((s, p) => s + p.z, 0) / Math.max(1, negPts.length);
    expect(meanZPos).toBeGreaterThan(0);
    expect(meanZNeg).toBeLessThan(0);
  });

  it('la densidad reportada está en [0, 1]', () => {
    const pts = sampleOrbital(ORBITALS['2s'], 1000, 1, 1);
    for (const p of pts) {
      expect(p.density).toBeGreaterThanOrEqual(0);
      expect(p.density).toBeLessThanOrEqual(1);
    }
  });
});

describe('orbitalEnergy', () => {
  it('1s hidrógeno = -0.5 Ha = -13.606 eV (energía de ionización)', () => {
    const E = orbitalEnergy(1, 1);
    expect(E).toBeCloseTo(-0.5, 6);
    expect(E * HARTREE_TO_EV).toBeCloseTo(-13.606, 2);
  });

  it('escala con Z² (hidrogenoides)', () => {
    expect(orbitalEnergy(1, 2) / orbitalEnergy(1, 1)).toBe(4);  // He⁺
    expect(orbitalEnergy(1, 3) / orbitalEnergy(1, 1)).toBe(9);  // Li²⁺
  });

  it('más profunda para n menor', () => {
    expect(orbitalEnergy(1, 1)).toBeLessThan(orbitalEnergy(2, 1));
    expect(orbitalEnergy(2, 1)).toBeLessThan(orbitalEnergy(3, 1));
  });
});
