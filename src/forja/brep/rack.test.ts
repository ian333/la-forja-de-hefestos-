/**
 * rack.test.ts — la cremallera como involuta límite. PURO (sin OCCT).
 * El área analítica (banda + trapecios) debe coincidir EXACTO con el shoelace
 * del polígono — dos derivaciones independientes de la misma geometría ISO 53.
 */
import { describe, it, expect } from 'vitest';
import { rackProfile, rackArea, shoelace } from './rack';

describe('rackProfile — geometría ISO 53', () => {
  it('área analítica == shoelace del polígono (m=2, Z=8)', () => {
    expect(shoelace(rackProfile(2, 8))).toBeCloseTo(rackArea(2, 8), 9);
  });
  it('escala con m² (m=3 vs m=1.5 a Z fijo: ×4)', () => {
    expect(rackArea(3, 6) / rackArea(1.5, 6)).toBeCloseTo(4, 9);
  });
  it('el paso manda: largo total = Z·π·m', () => {
    const pts = rackProfile(2.5, 10);
    const xs = pts.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(10 * Math.PI * 2.5, 9);
  });
  it('cresta más angosta que raíz (flancos a 20°) y ambas positivas', () => {
    const m = 2, p = Math.PI * m, t = Math.tan((20 * Math.PI) / 180);
    const wTop = p / 2 - 2 * m * t, wRoot = p / 2 + 2 * 1.25 * m * t;
    expect(wTop).toBeGreaterThan(0);
    expect(wRoot).toBeGreaterThan(wTop);
    expect(wRoot).toBeLessThan(p); // los dientes no se tocan en la raíz
  });
  it('polígono válido: ≥3+4Z puntos, cierra en x=0', () => {
    const pts = rackProfile(2, 5);
    expect(pts.length).toBe(4 + 4 * 5);
    expect(pts[pts.length - 1].x).toBe(0);
  });
});
