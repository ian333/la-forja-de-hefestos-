import { describe, it, expect } from 'vitest';
import { vehicleDynamics, armStatics, G } from './dinamica';

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

describe('dinámica de vehículo (carro/rover)', () => {
  // Rover 5 kg, 4 ruedas todas motrices, r=0.04 m, μ=0.7, Crr=0.015, g=9.81.
  const d = vehicleDynamics({ massKg: 5, wheels: 4, wheelRadiusM: 0.04, mu: 0.7, crr: 0.015 });

  it('peso W = m·g', () => { expect(close(d.weightN, 5 * G)).toBe(true); });
  it('carga por rueda = W/4', () => { expect(close(d.perWheelN, 5 * G / 4)).toBe(true); });
  it('tracción máx = μ·W (todas motrices)', () => { expect(close(d.tractionMaxN, 0.7 * 5 * G)).toBe(true); });
  it('rodadura = Crr·W', () => { expect(close(d.rollingResistN, 0.015 * 5 * G)).toBe(true); });
  it('fuerza neta = tracción − rodadura', () => { expect(close(d.netForceN, 0.7 * 5 * G - 0.015 * 5 * G)).toBe(true); });
  it('pendiente máx = atan(μ) (AWD)', () => { expect(close(d.maxGradeDeg, Math.atan(0.7) * 180 / Math.PI, 1e-9)).toBe(true); });
  it('torque por rueda = (tracción/4)·r', () => { expect(close(d.motorTorquePerWheelNm, (0.7 * 5 * G / 4) * 0.04)).toBe(true); });
  it('sube 30° pero no 40°', () => { expect(d.canClimbDeg(30)).toBe(true); expect(d.canClimbDeg(40)).toBe(false); });

  it('tracción parcial: 2 de 4 motrices = mitad', () => {
    const d2 = vehicleDynamics({ massKg: 5, wheels: 4, driven: 2, wheelRadiusM: 0.04, mu: 0.7 });
    expect(close(d2.tractionMaxN, 0.7 * 5 * G * 0.5)).toBe(true);
    expect(close(d2.maxGradeDeg, Math.atan(0.7 * 0.5) * 180 / Math.PI, 1e-9)).toBe(true);
  });
});

describe('estática de brazo robótico (torque de sostén)', () => {
  // 2 eslabones + carga 0.2 kg en la punta, brazo horizontal (peor caso).
  const a = armStatics({ links: [{ lengthM: 0.3, massKg: 0.5 }, { lengthM: 0.25, massKg: 0.3 }], payloadKg: 0.2 });

  it('alcance = Σ largos', () => { expect(close(a.reachM, 0.55)).toBe(true); });
  it('masa total = eslabones + carga', () => { expect(close(a.totalMassKg, 1.0)).toBe(true); });
  it('torque de carga = g·m·alcance', () => { expect(close(a.payloadTorqueNm, G * 0.2 * 0.55)).toBe(true); });
  it('torque base (momento de TODO sobre el hombro)', () => {
    const want = G * (0.5 * 0.15 + 0.3 * 0.425 + 0.2 * 0.55);
    expect(close(a.baseTorqueNm, want)).toBe(true);
  });
  it('torque del codo < torque del hombro (menos cuelga)', () => {
    expect(a.jointTorquesNm[1]).toBeLessThan(a.jointTorquesNm[0]);
    const wantElbow = G * (0.3 * 0.125 + 0.2 * 0.25);
    expect(close(a.jointTorquesNm[1], wantElbow)).toBe(true);
  });
});
