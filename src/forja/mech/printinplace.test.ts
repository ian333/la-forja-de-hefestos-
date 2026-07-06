import { describe, it, expect } from 'vitest';
import { clearance, nestedBearing, journalBearing, tubeStack, GAP } from './printinplace';

const close = (a: number, b: number, e = 1e-9) => Math.abs(a - b) <= e;

describe('ventana de holgura (print-in-place)', () => {
  it('el sweet de PLA cae en la ventana', () => { expect(clearance(GAP.PLA.sweet, 'PLA').ok).toBe(true); });
  it('gap chico SUELDA (no se mueve)', () => { expect(clearance(0.10, 'PLA').reason).toBe('suelda'); });
  it('gap grande BAILA (sin precisión)', () => { expect(clearance(0.60, 'PLA').reason).toBe('baila'); });
  it('PETG tolera más gap que PLA', () => { expect(GAP.PETG.sweet).toBeGreaterThan(GAP.PLA.sweet); });
});

describe('balero de círculos anidados (el experimento del fundador)', () => {
  // 3 anillos, barreno r=4, pared 2, gap 0.3 (PLA sweet).
  const b = nestedBearing({ bore: 4, rings: 3, wall: 2, gap: 0.3, mat: 'PLA' });

  it('3 anillos con radios crecientes', () => {
    expect(b.rings.map((r) => r.inner)).toEqual([4, 6.3, 8.6]);
    expect(b.rings.map((r) => r.outer)).toEqual([6, 8.3, 10.6]);
  });
  it('el gap medido entre cada par ≡ gap (LA garantía del balero)', () => {
    for (const g of b.measuredGaps) expect(close(g, 0.3)).toBe(true);
  });
  it('outerR = bore + N·wall + (N−1)·gap', () => {
    expect(close(b.outerR, 4 + 3 * 2 + 2 * 0.3)).toBe(true); // 10.6
  });
  it('el gap cae en la ventana → SÍ gira', () => { expect(b.clearance.ok).toBe(true); });
  it('default usa el sweet del material', () => {
    const d = nestedBearing({ bore: 4, rings: 2, wall: 2 });
    expect(close(d.gap, GAP.PLA.sweet)).toBe(true);
  });
  it('gap fuera de ventana → marca que se suelda', () => {
    const welded = nestedBearing({ bore: 4, rings: 2, wall: 2, gap: 0.1, mat: 'PLA' });
    expect(welded.clearance.ok).toBe(false);
    expect(welded.clearance.reason).toBe('suelda');
  });
});

describe('pila de tubos: recto SE DESLIZA, joroba ATRAPA (el 1er sistema)', () => {
  const cfg = { tubes: 3, bore: 4, wall: 2, H: 20, layers: 10, gap: 0.3, mat: 'PLA' };
  const recto = tubeStack({ ...cfg, bulge: 0 });
  const jorobado = tubeStack({ ...cfg, bulge: 1.5 });

  it('recto: NO atrapado, desliza libre en Z (play ∞)', () => {
    expect(recto.captured).toBe(false);
    expect(recto.axialPlayMm).toBe(Infinity);
  });
  it('jorobado: ATRAPADO con play finito', () => {
    expect(jorobado.captured).toBe(true);
    expect(jorobado.axialPlayMm).toBeGreaterThan(0);
    expect(jorobado.axialPlayMm).toBeLessThan(3);
  });
  it('jorobado: IMPRIMIBLE (voladizo dentro del cono 45°)', () => {
    expect(jorobado.buildable).toBe(true);
    expect(jorobado.overhangDeg).toBeLessThan(45);
  });
  it('el GAP entre tubos se conserva en TODOS los niveles (no se sueldan al subir)', () => {
    for (const lvl of jorobado.levels) {
      // superficies: [t1in,t1out, t2in,t2out, t3in,t3out] → gaps en índices 1→2, 3→4
      expect(close(lvl.radii[2] - lvl.radii[1], 0.3, 1e-2)).toBe(true);
      expect(close(lvl.radii[4] - lvl.radii[3], 0.3, 1e-2)).toBe(true);
    }
  });
  it('en el centro (z=H/2) todo sube exactamente la amplitud de la joroba', () => {
    const mid = jorobado.levels.find((l) => close(l.z, 10))!;
    expect(close(mid.radii[0] - jorobado.baseRadii[0], 1.5, 1e-2)).toBe(true);
  });
});

describe('física del balero plano (journal)', () => {
  // eje r=4, largo 10, carga 50 N, PLA (μ=0.35, p_adm=5 MPa).
  const j = journalBearing({ boreR: 4, length: 10, loadN: 50, mat: 'PLA' });
  it('área proyectada = 2·r·L', () => { expect(close(j.projectedArea, 80)).toBe(true); });
  it('presión = W/área', () => { expect(close(j.pressureMPa, 50 / 80)).toBe(true); });
  it('50 N en este balero AGUANTA (p ≤ p_adm)', () => { expect(j.ok).toBe(true); });
  it('torque de fricción = μ·W·r', () => { expect(close(j.frictionTorqueNmm, 0.35 * 50 * 4)).toBe(true); }); // 70 N·mm
  it('carga absurda lo revienta (p > p_adm)', () => {
    expect(journalBearing({ boreR: 4, length: 10, loadN: 5000, mat: 'PLA' }).ok).toBe(false);
  });
});
