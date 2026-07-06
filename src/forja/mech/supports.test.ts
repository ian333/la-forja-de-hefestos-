import { describe, it, expect } from 'vitest';
import {
  GOLDEN_ANGLE_DEG, phyllotaxisField, phylloCountForSpacing,
  needsSupport, faceTiltDeg, maxSelfBridgeGap, breakForce, centeringSpokes,
} from './supports';

describe('flor de phi — filotaxis de los soportes', () => {
  it('el ángulo áureo es 137.5077…° = 360·(2−φ)', () => {
    expect(GOLDEN_ANGLE_DEG).toBeCloseTo(137.50776, 4);
  });

  it('todos los árboles caen DENTRO del anillo [rMin, rMax]', () => {
    const f = phyllotaxisField({ n: 60, rMin: 6, rMax: 18 });
    expect(f.points.length).toBe(60);
    for (const p of f.points) {
      expect(p.r).toBeGreaterThanOrEqual(6 - 1e-3);
      expect(p.r).toBeLessThanOrEqual(18 + 1e-3);
    }
  });

  it('NINGUNO estorba al otro: la separación mínima es sana (cuasi-uniforme)', () => {
    // con n elegido para ~7mm de separación, dos árboles nunca se enciman
    const n = phylloCountForSpacing(6, 18, 7);
    const f = phyllotaxisField({ n, rMin: 6, rMax: 18 });
    expect(f.count).toBeGreaterThan(5);
    // el ángulo áureo da empaque de Ridley → separación mínima cercana al objetivo
    expect(f.minSpacing).toBeGreaterThan(3);
  });

  it('los puntos consecutivos están a 137.5° exactos (nunca se alinean)', () => {
    const f = phyllotaxisField({ n: 10, rMin: 5, rMax: 15 });
    for (let i = 1; i < f.points.length; i++) {
      let d = ((f.points[i].theta - f.points[i - 1].theta) * 180) / Math.PI % 360;
      if (d < 0) d += 360;
      expect(d).toBeCloseTo(GOLDEN_ANGLE_DEG, 3);
    }
  });

  it('el keep-out descarta los árboles que caen sobre el eje y los pernos', () => {
    const keepOut = [
      { x: 0, y: 0, r: 6 },                       // eje
      { x: 10, y: 0, r: 3 }, { x: -10, y: 0, r: 3 }, // pernos de salida
    ];
    const f = phyllotaxisField({ n: 120, rMin: 6, rMax: 18, keepOut });
    for (const p of f.points)
      for (const o of keepOut)
        expect(Math.hypot(p.x - o.x, p.y - o.y)).toBeGreaterThanOrEqual(o.r - 1e-3);
    expect(f.count).toBeLessThan(120); // algunos se descartaron
  });

  it('es DETERMINISTA: misma entrada → misma flor (sin random)', () => {
    const a = phyllotaxisField({ n: 40, rMin: 6, rMax: 18 });
    const b = phyllotaxisField({ n: 40, rMin: 6, rMax: 18 });
    expect(b.points).toEqual(a.points);
  });
});

describe('soportes — la física que ya existía sigue verde', () => {
  it('una cara horizontal hacia abajo SÍ necesita soporte; una a 45° no', () => {
    expect(needsSupport(-1)).toBe(true);          // techo plano hacia abajo
    expect(needsSupport(-Math.SQRT1_2)).toBe(false); // 45° justo (auto-soporta)
    expect(faceTiltDeg(-Math.SQRT1_2)).toBeCloseTo(45, 1);
  });
  it('el auto-puente del PLA ronda ~0.9mm a capa 0.2', () => {
    expect(maxSelfBridgeGap('PLA', 0.2)).toBeCloseTo(0.9, 2);
  });
  it('el centrado frangible rompe al primer giro y aguanta la impresión', () => {
    const c = centeringSpokes({ outputTorqueNm: 40, ratio: 10, camRadius: 9.5, discMassG: 30, material: 'PLA' });
    expect(c.shearsOnFirstTurn).toBe(true);
    expect(c.holdsDuringPrint).toBe(true);
    expect(breakForce('PLA', 1)).toBeCloseTo(28, 5);
  });
});
