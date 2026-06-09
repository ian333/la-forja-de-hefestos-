import { describe, it, expect } from 'vitest';
import { PRESETS } from '../presets';
import { dcOperatingPoint, transient, maxNode } from '@/lib/circuitos/spice';

const finite = (xs: number[]) => xs.every((x) => Number.isFinite(x));

describe('presets — integración motor + datos', () => {
  it('hay presets y todos tienen lo necesario', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(4);
    for (const p of PRESETS) {
      expect(p.id).toBeTruthy();
      expect(p.sliders.length).toBeGreaterThan(0);
      expect(p.probes.length).toBeGreaterThan(0);
      expect(p.lesson.steps.length).toBeGreaterThan(0);
    }
  });

  it('cada preset construye un circuito coherente con sus defaults', () => {
    for (const p of PRESETS) {
      const c = p.build(p.defaults);
      expect(c.nodeCount).toBe(maxNode(c.elements));
      expect(c.elements.length).toBeGreaterThan(1);
      // todo elemento referencia nodos válidos (0..nodeCount)
      for (const e of c.elements) {
        expect(e.a).toBeGreaterThanOrEqual(0);
        expect(e.b).toBeGreaterThanOrEqual(0);
        expect(e.a).toBeLessThanOrEqual(c.nodeCount);
        expect(e.b).toBeLessThanOrEqual(c.nodeCount);
      }
    }
  });

  it('cada preset corre (DC o transitorio) sin NaN/Inf', () => {
    for (const p of PRESETS) {
      const c = p.build(p.defaults);
      if (p.mode === 'dc') {
        const op = dcOperatingPoint(c);
        expect(op).not.toBeNull();
        expect(finite(op!.v)).toBe(true);
      } else {
        const res = transient(c, { dt: p.sim!.dt, tStop: p.sim!.tStop });
        expect(res.v.length).toBeGreaterThan(10);
        // ningún voltaje de nodo explota
        for (const row of res.v) expect(finite(row)).toBe(true);
        // las sondas de nodo apuntan a nodos que existen
        for (const probe of p.probes) {
          if (probe.node != null) expect(probe.node).toBeLessThanOrEqual(c.nodeCount);
        }
      }
    }
  });

  it('el divisor cumple la fórmula V_out = Vin·R2/(R1+R2)', () => {
    const div = PRESETS.find((p) => p.id === 'divider')!;
    const params = { Vin: 12, R1: 1, R2: 3 };
    const c = div.build(params);
    const op = dcOperatingPoint(c)!;
    expect(op.v[2]).toBeCloseTo(12 * 3 / (1 + 3), 6); // 9 V
  });

  it('el rectificador entrega DC positiva mayor que su rizo', () => {
    const rec = PRESETS.find((p) => p.id === 'rectifier')!;
    const c = rec.build(rec.defaults);
    const res = transient(c, { dt: rec.sim!.dt, tStop: rec.sim!.tStop });
    // tomar la segunda mitad (ya cargado)
    const tail = res.v.slice(Math.floor(res.v.length / 2)).map((r) => r[2]);
    const min = Math.min(...tail), max = Math.max(...tail);
    expect(min).toBeGreaterThan(0);        // nunca negativa (el diodo bloquea)
    expect(max).toBeGreaterThan(2);         // sí hay DC
    expect(max - min).toBeLessThan(max);    // el rizo es menor que el nivel DC
  });
});
