import { describe, it, expect } from 'vitest';
import {
  mobility, driftSpeed, conductivity, joulePowerDensity,
  makeRng, stepDrude, type DrudeElectron,
  helixSegments, biotSavart, solenoidBCenter, loopBOnAxis,
  bandgapToWavelengthNm, wavelengthToRGB, ledForwardVoltage,
  MU0,
} from '../microfisica';

// ── Drude ────────────────────────────────────────────────────────────────

describe('Drude — corriente y conductividad', () => {
  it('v_drift = μ·E y σ = n·q²·τ/m son consistentes (J = σE = n q v_d)', () => {
    const n = 8.5e28, tau = 2.5e-14, E = 1; // cobre aprox
    const sigma = conductivity(n, tau);
    const vd = driftSpeed(E, tau);
    const J1 = sigma * E;
    const J2 = n * 1.602176634e-19 * vd;
    expect(J1 / J2).toBeCloseTo(1, 6);
  });

  it('movilidad positiva y drift ∝ E', () => {
    expect(mobility(1e-14)).toBeGreaterThan(0);
    expect(driftSpeed(2, 1e-14)).toBeCloseTo(2 * driftSpeed(1, 1e-14), 9);
  });

  it('la potencia disipada va como E² (el corazón de I²R)', () => {
    const sigma = 1;
    expect(joulePowerDensity(sigma, 2) / joulePowerDensity(sigma, 1)).toBeCloseTo(4, 9);
  });

  it('el stepper estocástico promedia v_x ≈ accel·τ (drift de relajación)', () => {
    const accel = 0.5, dt = 0.01, tau = 1.0, vth = 1.0;
    const rng = makeRng(12345);
    const e: DrudeElectron = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
    let sum = 0, count = 0;
    for (let i = 0; i < 200000; i++) {
      stepDrude(e, accel, dt, tau, vth, rng);
      if (i > 1000) { sum += e.vx; count++; } // descartar transitorio
    }
    const meanVx = sum / count;
    expect(meanVx).toBeCloseTo(accel * tau, 1); // v_d = a·τ = 0.5
  });

  it('el calor de Joule (trabajo del campo) crece ~4× al duplicar el campo (E²)', () => {
    const dt = 0.01, tau = 1.0, vth = 1.0;
    const run = (accel: number) => {
      const rng = makeRng(999);
      const e: DrudeElectron = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
      let work = 0;
      for (let i = 0; i < 200000; i++) {
        const r = stepDrude(e, accel, dt, tau, vth, rng);
        if (i > 1000) work += r.work; // descartar transitorio
      }
      return work;
    };
    const ratio = run(1.0) / run(0.5);
    expect(ratio).toBeCloseTo(4, 0); // ⟨work⟩ = a²τ → ratio exacto = 4 (esto ES I²R)
  });
});

// ── Biot-Savart ────────────────────────────────────────────────────────────

describe('Biot-Savart — campo de bobina', () => {
  it('en el centro de una espira: B = μ0·I/(2R)', () => {
    const R = 0.05, I = 3;
    // espira circular (perímetro discretizado) en el plano YZ, centrada en origen
    const N = 720;
    const segs: Array<{ a: [number, number, number]; b: [number, number, number] }> = [];
    for (let i = 0; i < N; i++) {
      const a1 = (i / N) * Math.PI * 2, a2 = ((i + 1) / N) * Math.PI * 2;
      segs.push({ a: [0, R * Math.cos(a1), R * Math.sin(a1)] as [number, number, number],
                  b: [0, R * Math.cos(a2), R * Math.sin(a2)] as [number, number, number] });
    }
    const B = biotSavart([0, 0, 0], segs, I);
    const Bx = Math.abs(B[0]); // el campo apunta en el eje (x)
    expect(Bx).toBeCloseTo(loopBOnAxis(I, R, 0), 8);
    expect(loopBOnAxis(I, R, 0)).toBeCloseTo((MU0 * I) / (2 * R), 12);
  });

  it('solenoide largo en el centro → μ0·n·I (límite infinito)', () => {
    const n = 1000, I = 2; // n por metro
    const corto = solenoidBCenter(n, I, 0.1, 0.05);
    const largo = solenoidBCenter(n, I, 100, 0.05); // L≫R
    expect(largo).toBeCloseTo(MU0 * n * I, 6);
    expect(largo).toBeGreaterThan(corto); // más largo = más cerca del ideal
  });

  it('helixSegments genera una hélice cerrada del largo pedido', () => {
    const segs = helixSegments(5, 0.05, 0.2, 24);
    expect(segs.length).toBeGreaterThan(100);
    const xs = segs.flatMap((s) => [s.a[0], s.b[0]]);
    expect(Math.min(...xs)).toBeCloseTo(-0.1, 2);
    expect(Math.max(...xs)).toBeCloseTo(0.1, 2);
  });
});

// ── LED ──────────────────────────────────────────────────────────────────

describe('LED — el color sale del band gap', () => {
  it('Eg = 1.9 eV → ~653 nm (rojo)', () => {
    expect(bandgapToWavelengthNm(1.9)).toBeCloseTo(652.6, 0);
  });

  it('Eg = 2.6 eV → ~477 nm (azul)', () => {
    const nm = bandgapToWavelengthNm(2.6);
    expect(nm).toBeGreaterThan(460);
    expect(nm).toBeLessThan(490);
  });

  it('V_f ≈ Eg en volts', () => {
    expect(ledForwardVoltage(2.0)).toBeCloseTo(2.0, 9);
  });

  it('650 nm es rojo (R domina), 470 nm es azul (B domina)', () => {
    const [r1, g1, b1] = wavelengthToRGB(650);
    expect(r1).toBeGreaterThan(g1);
    expect(r1).toBeGreaterThan(b1);
    const [r2, g2, b2] = wavelengthToRGB(470);
    expect(b2).toBeGreaterThan(r2);
    expect(b2).toBeGreaterThanOrEqual(g2 * 0.5); // azul presente
  });
});

// ── capacitor + canal MOSFET (añadidos 2026-06-09 noche) ──
import {
  capCharge, capElectrons, capEnergy, capField,
  channelV, channelThickness,
} from '../microfisica';

describe('capacitor — el tanque de carga', () => {
  it('Q = C·V: 10µF a 5V = 50µC', () => {
    expect(capCharge(10e-6, 5)).toBeCloseTo(50e-6, 9);
  });
  it('los electrones desplazados son DESCOMUNALES: ~3.1e14 en 10µF/5V', () => {
    const n = capElectrons(10e-6, 5);
    expect(n).toBeGreaterThan(3e14);
    expect(n).toBeLessThan(3.3e14);
  });
  it('energía ½CV²: la presa del v2 (6600µF a 120V) guarda 47.5J', () => {
    expect(capEnergy(6600e-6, 120)).toBeCloseTo(47.52, 1);
  });
  it('E = V/d crece con V y cae con d', () => {
    expect(capField(10, 1e-3)).toBeCloseTo(1e4, 6);
    expect(capField(10, 2e-3)).toBeLessThan(capField(10, 1e-3));
  });
});

describe('canal MOSFET — gradual channel (la cuña)', () => {
  it('V(0)=0 en el source y V(1)=Vds en triodo', () => {
    expect(channelV(6, 2, 0)).toBeCloseTo(0, 9);
    expect(channelV(6, 2, 1)).toBeCloseTo(2, 6);
  });
  it('en saturación V(1) se recorta a Vov (pinch-off)', () => {
    expect(channelV(6, 15, 1)).toBeCloseTo(6, 6);
  });
  it('grosor: pleno en source, monótono decreciente hacia drain', () => {
    const t0 = channelThickness(10, 4, 3, 0);
    const tm = channelThickness(10, 4, 3, 0.5);
    const t1 = channelThickness(10, 4, 3, 1);
    expect(t0).toBeCloseTo(1, 9);
    expect(tm).toBeLessThan(t0);
    expect(t1).toBeLessThan(tm);
  });
  it('pinch-off: en saturación el grosor en el drain es 0', () => {
    expect(channelThickness(10, 4, 12, 1)).toBeCloseTo(0, 6);
  });
  it('corte: sin overdrive no hay canal en ningún punto', () => {
    expect(channelThickness(2, 4, 5, 0)).toBe(0);
    expect(channelThickness(2, 4, 5, 0.5)).toBe(0);
  });
});
