/**
 * topopt-am.test.ts — restricciones de manufactura del generativo (PURO).
 * Filtro de voladizo (auto-soporte) + regiones pasivas (keep-in/keep-out).
 */
import { describe, it, expect } from 'vitest';
import { amOverhangFilter, overhangReachFromAngle, passiveMask, applyPassive, type CellGrid } from './topopt-am';

// Rejilla "llena": cada posición es una celda; índice de celda = índice lineal.
function fullGrid(nx: number, ny: number, nz: number): CellGrid {
  const cellOf = new Int32Array(nx * ny * nz);
  const ijk = new Int32Array(nx * ny * nz * 3);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const e = i + nx * (j + ny * k);
    cellOf[e] = e; ijk[e * 3] = i; ijk[e * 3 + 1] = j; ijk[e * 3 + 2] = k;
  }
  return { nx, ny, nz, cellOf, ijk };
}
const lin = (g: CellGrid, i: number, j: number, k: number) => i + g.nx * (j + g.ny * k);

describe('overhangReachFromAngle', () => {
  it('45° desde la vertical → 1 celda/capa (auto-soporte clásico)', () => {
    expect(overhangReachFromAngle(45)).toBe(1);
  });
  it('más abierto permite más voladizo; nunca < 1', () => {
    expect(overhangReachFromAngle(64)).toBe(2);  // tan64≈2.05
    expect(overhangReachFromAngle(0)).toBe(1);   // clamp inferior
    expect(overhangReachFromAngle(30)).toBe(1);  // tan30≈0.58 → round 1
  });
});

describe('amOverhangFilter — auto-soporte', () => {
  it('la cama (k=0) imprime libre (no se toca)', () => {
    const g = fullGrid(4, 1, 3);
    const x = new Float64Array(g.nx * g.ny * g.nz);
    x[lin(g, 0, 0, 0)] = 1; x[lin(g, 3, 0, 0)] = 0.7;
    const out = amOverhangFilter(x, g, 1);
    expect(out[lin(g, 0, 0, 0)]).toBe(1);
    expect(out[lin(g, 3, 0, 0)]).toBeCloseTo(0.7, 6);
  });

  it('un PILAR vertical sobrevive (cada capa soportada por la de abajo)', () => {
    const g = fullGrid(5, 1, 4);
    const x = new Float64Array(g.nx * g.ny * g.nz);
    for (let k = 0; k < 4; k++) x[lin(g, 2, 0, k)] = 1;
    const out = amOverhangFilter(x, g, 1);
    for (let k = 0; k < 4; k++) expect(out[lin(g, 2, 0, k)]).toBe(1);
  });

  it('una ISLA FLOTANTE (sólida arriba, vacío abajo) se ELIMINA', () => {
    const g = fullGrid(5, 1, 3);
    const x = new Float64Array(g.nx * g.ny * g.nz);
    x[lin(g, 2, 0, 2)] = 1; // flotando en la capa superior, nada debajo
    const out = amOverhangFilter(x, g, 1);
    expect(out[lin(g, 2, 0, 2)]).toBe(0);
  });

  it('una ESCALERA a 45° (1 celda/capa) se MANTIENE entera', () => {
    const g = fullGrid(5, 1, 4);
    const x = new Float64Array(g.nx * g.ny * g.nz);
    x[lin(g, 0, 0, 0)] = 1; x[lin(g, 1, 0, 1)] = 1; x[lin(g, 2, 0, 2)] = 1; x[lin(g, 3, 0, 3)] = 1;
    const out = amOverhangFilter(x, g, 1);
    expect(out[lin(g, 0, 0, 0)]).toBe(1);
    expect(out[lin(g, 1, 0, 1)]).toBe(1);
    expect(out[lin(g, 2, 0, 2)]).toBe(1);
    expect(out[lin(g, 3, 0, 3)]).toBe(1);
  });

  it('un VOLADIZO mayor al alcance (salto de 2 celdas) se RECORTA', () => {
    const g = fullGrid(5, 1, 2);
    const x = new Float64Array(g.nx * g.ny * g.nz);
    x[lin(g, 0, 0, 0)] = 1;       // soporte en la cama, en i=0
    x[lin(g, 2, 0, 1)] = 1;       // capa de arriba en i=2 → huella i∈[1,3] no toca i=0
    const out = amOverhangFilter(x, g, 1);
    expect(out[lin(g, 2, 0, 1)]).toBe(0); // sin soporte → recortado
  });

  it('soporte PARCIAL limita la densidad imprimible al soporte disponible', () => {
    const g = fullGrid(3, 1, 2);
    const x = new Float64Array(g.nx * g.ny * g.nz);
    x[lin(g, 1, 0, 0)] = 0.4;     // soporte tenue abajo
    x[lin(g, 1, 0, 1)] = 1.0;     // quiere ser sólido arriba
    const out = amOverhangFilter(x, g, 1);
    expect(out[lin(g, 1, 0, 1)]).toBeCloseTo(0.4, 6); // limitado al soporte
  });
});

describe('passiveMask / applyPassive — regiones congeladas', () => {
  const cells = [
    { cx: 0, cy: 0, cz: 0 },  // diseño
    { cx: 10, cy: 0, cz: 0 }, // sólido fijo (keep-in)
    { cx: 0, cy: 10, cz: 0 }, // vacío fijo (keep-out)
  ];
  const region = (cx: number, cy: number): 'solid' | 'void' | 'design' => (cx >= 10 ? 'solid' : cy >= 10 ? 'void' : 'design');

  it('clasifica sólido/vacío/diseño y cuenta los de diseño', () => {
    const m = passiveMask(cells, region);
    expect(m.solid).toEqual([false, true, false]);
    expect(m.void).toEqual([false, false, true]);
    expect(m.nDesign).toBe(1);
  });

  it('applyPassive fuerza sólido→1 y vacío→0, deja el diseño intacto', () => {
    const m = passiveMask(cells, region);
    const x = Float64Array.from([0.5, 0.2, 0.9]);
    applyPassive(x, m);
    expect(x[0]).toBe(0.5); // diseño intacto
    expect(x[1]).toBe(1);   // keep-in
    expect(x[2]).toBe(0);   // keep-out
  });
});
