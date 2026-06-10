/**
 * Tests del MOSFET (Shichman-Hodges con parámetros de DATASHEET).
 * Anclas: Rds(on) publicado del IRF640N (0.15Ω@Vgs10V), corte, saturación,
 * diodo de cuerpo, y el CROSS-CHECK contra boostV2 (dos motores independientes
 * deben dar el mismo Ipk de la rampa del boost: ~12.3A).
 */
import { describe, it, expect } from 'vitest';
import {
  mosChannel, MOSFETS, dcOperatingPoint, transient,
  type Circuit,
} from '../spice';

const M640 = MOSFETS.IRF640N;

describe('mosChannel — el modelo puro vs datasheet', () => {
  it('corte: Vgs < Vth → Id = 0', () => {
    expect(mosChannel(M640, 2.0, 10).id).toBe(0);
    expect(mosChannel(M640, 0, 1).id).toBe(0);
  });

  it('Rds(on) del datasheet: Vgs=10V, Vds chico → R ≈ 0.15Ω ±15%', () => {
    const { id } = mosChannel(M640, 10, 0.1);
    const r = 0.1 / id;
    expect(r).toBeGreaterThan(0.125);
    expect(r).toBeLessThan(0.175);
  });

  it('continuidad triodo↔saturación en Vds = Vgs−Vth', () => {
    const vov = 10 - M640.Vth;
    const tri = mosChannel(M640, 10, vov - 1e-6).id;
    const sat = mosChannel(M640, 10, vov + 1e-6).id;
    expect(Math.abs(tri - sat) / sat).toBeLessThan(1e-3);
  });

  it('saturación: Id = Kp·(Vgs−Vth)²·(1+λVds)', () => {
    const { id } = mosChannel(M640, 6, 10);
    expect(id).toBeCloseTo(0.54 * 2.2 * 2.2 * (1 + 0.01 * 10), 2);
  });
});

describe('MOSFET en el motor MNA (DC)', () => {
  it('fuente de corriente saturada: 24V→R4.7Ω→drain, gate 6V → Id≈2.9A', () => {
    const c: Circuit = {
      nodeCount: 3,
      elements: [
        { kind: 'V', id: 'V1', a: 1, b: 0, value: 24 },
        { kind: 'R', id: 'R1', a: 1, b: 2, value: 4.7 },
        { kind: 'V', id: 'Vg', a: 3, b: 0, value: 6 },
        { kind: 'M', id: 'Q1', d: 2, g: 3, s: 0, params: M640 },
      ],
    };
    const op = dcOperatingPoint(c)!;
    expect(op).not.toBeNull();
    const Id = (op.v[1] - op.v[2]) / 4.7;
    expect(Id).toBeGreaterThan(2.7);
    expect(Id).toBeLessThan(3.05);
    expect(op.v[2]).toBeGreaterThan(8);     // Vds en saturación
  });

  it('switch cerrado (triodo): gate 10V → cae casi todo en la R externa', () => {
    const c: Circuit = {
      nodeCount: 3,
      elements: [
        { kind: 'V', id: 'V1', a: 1, b: 0, value: 12 },
        { kind: 'R', id: 'R1', a: 1, b: 2, value: 10 },
        { kind: 'V', id: 'Vg', a: 3, b: 0, value: 10 },
        { kind: 'M', id: 'Q1', d: 2, g: 3, s: 0, params: M640 },
      ],
    };
    const op = dcOperatingPoint(c)!;
    // Vds = divisor 0.149/(10+0.149) ≈ 0.18V
    expect(op.v[2]).toBeLessThan(0.3);
    expect(op.v[2]).toBeGreaterThan(0.05);
  });

  it('gate abierto (0V) → no conduce (solo Gmin)', () => {
    const c: Circuit = {
      nodeCount: 2,
      elements: [
        { kind: 'V', id: 'V1', a: 1, b: 0, value: 24 },
        { kind: 'R', id: 'R1', a: 1, b: 2, value: 100 },
        { kind: 'M', id: 'Q1', d: 2, g: 0, s: 0, params: M640 },
      ],
    };
    const op = dcOperatingPoint(c)!;
    expect(op.v[2]).toBeGreaterThan(23.5);  // drain flota al riel: no hay corriente
  });

  it('diodo de cuerpo: drain jalado bajo tierra → conduce s→d con caída ~0.6-0.75V', () => {
    const c: Circuit = {
      nodeCount: 2,
      elements: [
        { kind: 'V', id: 'V1', a: 1, b: 0, value: -1 },
        { kind: 'R', id: 'R1', a: 1, b: 2, value: 10 },
        { kind: 'M', id: 'Q1', d: 2, g: 0, s: 0, params: M640 },
      ],
    };
    const op = dcOperatingPoint(c)!;
    expect(op.v[2]).toBeLessThan(-0.5);     // clavado a −Vf del cuerpo
    expect(op.v[2]).toBeGreaterThan(-0.85);
  });
});

describe('CROSS-CHECK contra boostV2 (dos motores, un número)', () => {
  it('rampa ON del boost v2: 24V→L10µH→IRF640N(+shunt 0.1Ω) a 5.5µs → Ipk ≈ 12.3A', () => {
    // El mismo circuito que boostV2.ipkReal() modela analíticamente (sin Rcoil):
    // Ron = Rds(0.149) + Rsh(0.1) = 0.249 → Ipk = (24/0.249)(1−e^(−5.5µ/(L/Ron))) ≈ 12.4
    const c: Circuit = {
      nodeCount: 4,
      elements: [
        { kind: 'V', id: 'Vin', a: 1, b: 0, value: 24 },
        { kind: 'L', id: 'L1', a: 1, b: 2, value: 10e-6 },
        { kind: 'M', id: 'Q1', d: 2, g: 3, s: 4, params: M640 },
        { kind: 'R', id: 'Rsh', a: 4, b: 0, value: 0.1 },
        { kind: 'V', id: 'Vg', a: 3, b: 0, value: 10 },
      ],
    };
    const r = transient(c, { dt: 10e-9, tStop: 5.5e-6, probeCurrents: ['L1'] });
    const iL = r.current['L1'];
    const ipk = iL[iL.length - 1];
    expect(ipk).toBeGreaterThan(11.6);
    expect(ipk).toBeLessThan(13.0);
    // y la rampa es RL (cóncava), no recta: el punto medio va ARRIBA de la mitad del pico
    const mid = iL[Math.floor(iL.length / 2)];
    expect(mid).toBeGreaterThan(ipk / 2);
  });
});
