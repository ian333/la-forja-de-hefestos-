/**
 * sketch-solver.test.ts — invariantes del solver de restricciones 2D (LM).
 * PURO: sin three.js ni OCCT. Promovido desde scripts/sketch-solver-test.ts y
 * expandido (parallel, equalLength, pointOnLine, tangentLC, concentric, DOF
 * por entidad). Cada caso comprueba GEOMETRÍA EXACTA, no "no crash".
 */
import { describe, it, expect } from 'vitest';
import { solveSketch, isFullyConstrained, type Sketch } from './sketch-solver';

describe('solveSketch — rectángulo', () => {
  it('totalmente restringido → DOF 0, esquinas exactas', () => {
    const s: Sketch = {
      points: [{ x: 0, y: 0 }, { x: 38, y: 3 }, { x: 42, y: 18 }, { x: 2, y: 21 }],
      lines: [{ a: 0, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 }, { a: 3, b: 0 }],
      circles: [],
      constraints: [
        { t: 'fix', p: 0 },
        { t: 'horizontal', a: 0, b: 1 }, { t: 'vertical', a: 1, b: 2 },
        { t: 'horizontal', a: 2, b: 3 }, { t: 'vertical', a: 3, b: 0 },
        { t: 'distance', p: 0, q: 1, d: 40 }, { t: 'distance', p: 1, q: 2, d: 20 },
      ],
    };
    const r = solveSketch(s);
    expect(r.converged).toBe(true);
    expect(r.dof).toBe(0);
    expect(r.status).toBe('full');
    expect(isFullyConstrained(r)).toBe(true);
    expect(s.points[1].x).toBeCloseTo(40, 2);
    expect(s.points[1].y).toBeCloseTo(0, 2);
    expect(s.points[2].x).toBeCloseTo(40, 2);
    expect(s.points[2].y).toBeCloseTo(20, 2);
    expect(s.points[3].x).toBeCloseTo(0, 2);
    expect(s.points[3].y).toBeCloseTo(20, 2);
  });

  it('sin la cota de altura → DOF 1 (sub-restringido, azul)', () => {
    const s: Sketch = {
      points: [{ x: 0, y: 0 }, { x: 38, y: 3 }, { x: 42, y: 18 }, { x: 2, y: 21 }],
      lines: [{ a: 0, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 }, { a: 3, b: 0 }],
      circles: [],
      constraints: [
        { t: 'fix', p: 0 },
        { t: 'horizontal', a: 0, b: 1 }, { t: 'vertical', a: 1, b: 2 },
        { t: 'horizontal', a: 2, b: 3 }, { t: 'vertical', a: 3, b: 0 },
        { t: 'distance', p: 0, q: 1, d: 40 },
      ],
    };
    const r = solveSketch(s);
    expect(r.dof).toBe(1);
    expect(r.status).toBe('under');
    expect(isFullyConstrained(r)).toBe(false);
    // el punto anclado NUNCA se reporta libre; algún otro SÍ.
    expect(r.free.points[0]).toBe(false);
    expect(r.free.points.some(Boolean)).toBe(true);
  });
});

describe('solveSketch — círculos y cotas', () => {
  it('radius → r exacto, DOF 0', () => {
    const s: Sketch = { points: [{ x: 5, y: 5, fixed: true }], lines: [], circles: [{ c: 0, r: 3 }], constraints: [{ t: 'radius', c: 0, r: 8 }] };
    const r = solveSketch(s);
    expect(s.circles[0].r).toBeCloseTo(8, 4);
    expect(r.dof).toBe(0);
    expect(r.status).toBe('full');
  });

  it('equalRadius + radius → ambos radios al valor cotado', () => {
    const s: Sketch = {
      points: [{ x: 0, y: 0, fixed: true }, { x: 20, y: 0, fixed: true }],
      lines: [], circles: [{ c: 0, r: 3 }, { c: 1, r: 7 }],
      constraints: [{ t: 'radius', c: 0, r: 5 }, { t: 'equalRadius', c1: 0, c2: 1 }],
    };
    const r = solveSketch(s);
    expect(r.converged).toBe(true);
    expect(s.circles[0].r).toBeCloseTo(5, 4);
    expect(s.circles[1].r).toBeCloseTo(5, 4);
  });

  it('concentric → centros coinciden', () => {
    const s: Sketch = {
      points: [{ x: 0, y: 0, fixed: true }, { x: 5, y: 2 }],
      lines: [], circles: [{ c: 0, r: 4 }, { c: 1, r: 9 }],
      constraints: [{ t: 'concentric', c1: 0, c2: 1 }],
    };
    const r = solveSketch(s);
    expect(r.converged).toBe(true);
    expect(s.points[1].x).toBeCloseTo(0, 3);
    expect(s.points[1].y).toBeCloseTo(0, 3);
  });
});

describe('solveSketch — restricciones geométricas', () => {
  it('coincident → el punto libre cae sobre el fijo', () => {
    const s: Sketch = { points: [{ x: 0, y: 0, fixed: true }, { x: 5, y: 7 }], lines: [], circles: [], constraints: [{ t: 'coincident', p: 0, q: 1 }] };
    const r = solveSketch(s);
    expect(s.points[1].x).toBeCloseTo(0, 3);
    expect(s.points[1].y).toBeCloseTo(0, 3);
    expect(r.dof).toBe(0);
  });

  it('perpendicular + cotas → escuadra exacta', () => {
    const s: Sketch = {
      points: [{ x: 0, y: 0, fixed: true }, { x: 10, y: 0 }, { x: 9, y: 8 }],
      lines: [{ a: 0, b: 1 }, { a: 1, b: 2 }],
      circles: [],
      constraints: [
        { t: 'horizontal', a: 0, b: 1 }, { t: 'distance', p: 0, q: 1, d: 10 },
        { t: 'perpendicular', l1: 0, l2: 1 }, { t: 'distance', p: 1, q: 2, d: 8 },
      ],
    };
    const r = solveSketch(s);
    expect(s.points[1].x).toBeCloseTo(10, 2);
    expect(s.points[1].y).toBeCloseTo(0, 2);
    expect(s.points[2].x).toBeCloseTo(10, 2);
    expect(s.points[2].y).toBeCloseTo(8, 2);
    expect(r.dof).toBe(0);
    expect(r.status).toBe('full');
  });

  it('parallel → la segunda línea queda paralela a la primera', () => {
    const s: Sketch = {
      points: [{ x: 0, y: 0, fixed: true }, { x: 10, y: 0, fixed: true }, { x: 0, y: 5, fixed: true }, { x: 8, y: 9 }],
      lines: [{ a: 0, b: 1 }, { a: 2, b: 3 }],
      circles: [],
      constraints: [{ t: 'parallel', l1: 0, l2: 1 }],
    };
    const r = solveSketch(s);
    expect(r.converged).toBe(true);
    // dir1 = (10,0) horizontal ⇒ dir2 debe ser horizontal ⇒ p3.y → 5
    expect(s.points[3].y).toBeCloseTo(5, 3);
  });

  it('equalLength + vertical → segundo segmento igual de largo', () => {
    const s: Sketch = {
      points: [{ x: 0, y: 0, fixed: true }, { x: 10, y: 0, fixed: true }, { x: 0, y: 5, fixed: true }, { x: 0, y: 12 }],
      lines: [{ a: 0, b: 1 }, { a: 2, b: 3 }],
      circles: [],
      constraints: [{ t: 'vertical', a: 2, b: 3 }, { t: 'equalLength', l1: 0, l2: 1 }],
    };
    const r = solveSketch(s);
    expect(r.converged).toBe(true);
    const len2 = Math.hypot(s.points[3].x - s.points[2].x, s.points[3].y - s.points[2].y);
    expect(len2).toBeCloseTo(10, 2);
    expect(s.points[3].y).toBeCloseTo(15, 2); // arranca arriba (12) → sube a 15
  });

  it('pointOnLine → el punto cae sobre la recta (colineal)', () => {
    const s: Sketch = {
      points: [{ x: 0, y: 0, fixed: true }, { x: 10, y: 0, fixed: true }, { x: 5, y: 3 }],
      lines: [{ a: 0, b: 1 }],
      circles: [],
      constraints: [{ t: 'pointOnLine', p: 2, l: 0 }],
    };
    const r = solveSketch(s);
    expect(s.points[2].y).toBeCloseTo(0, 4); // recta es y=0
    expect(r.dof).toBe(1); // x del punto queda libre sobre la recta
    expect(r.status).toBe('under');
  });

  it('tangentLC → radio = distancia centro↔recta', () => {
    const s: Sketch = {
      points: [{ x: 0, y: 0, fixed: true }, { x: 10, y: 0, fixed: true }, { x: 5, y: 5, fixed: true }],
      lines: [{ a: 0, b: 1 }],
      circles: [{ c: 2, r: 1 }],
      constraints: [{ t: 'tangentLC', l: 0, c: 0 }],
    };
    const r = solveSketch(s);
    expect(s.circles[0].r).toBeCloseTo(5, 3); // recta y=0, centro y=5 ⇒ r=5
    expect(r.dof).toBe(0);
  });
});

describe('solveSketch — casos límite', () => {
  it('cotas en conflicto (mismo par, dos distancias) → over, no converge', () => {
    const s: Sketch = {
      points: [{ x: 0, y: 0, fixed: true }, { x: 10, y: 0 }],
      lines: [], circles: [],
      constraints: [{ t: 'distance', p: 0, q: 1, d: 10 }, { t: 'distance', p: 0, q: 1, d: 15 }],
    };
    const r = solveSketch(s);
    expect(r.converged).toBe(false);
    expect(r.status).toBe('over');
  });

  it('sin variables (todo fijo) y restricción satisfecha → DOF 0, converge', () => {
    const s: Sketch = {
      points: [{ x: 0, y: 0, fixed: true }, { x: 10, y: 0, fixed: true }],
      lines: [], circles: [],
      constraints: [{ t: 'distance', p: 0, q: 1, d: 10 }],
    };
    const r = solveSketch(s);
    expect(r.converged).toBe(true);
    expect(r.dof).toBe(0);
    expect(r.iters).toBe(0);
  });

  it('determinismo: misma entrada → mismo resultado', () => {
    const make = (): Sketch => ({
      points: [{ x: 0, y: 0 }, { x: 7, y: 1 }, { x: 6, y: 9 }],
      lines: [{ a: 0, b: 1 }, { a: 1, b: 2 }],
      circles: [],
      constraints: [
        { t: 'fix', p: 0 }, { t: 'horizontal', a: 0, b: 1 },
        { t: 'distance', p: 0, q: 1, d: 8 }, { t: 'perpendicular', l1: 0, l2: 1 },
        { t: 'distance', p: 1, q: 2, d: 6 },
      ],
    });
    const a = make(), b = make();
    const ra = solveSketch(a), rb = solveSketch(b);
    expect(ra.residual).toBe(rb.residual);
    expect(a.points[2].x).toBe(b.points[2].x);
    expect(a.points[2].y).toBe(b.points[2].y);
  });
});

/**
 * REGRESIÓN — la cota alineada en geometría CASI-HORIZONTAL.
 *
 * El caso real que lo destapó: la CUERDA de un perfil alar. Un perfil es casi
 * plano, así que ∂(distancia)/∂y → 0 y la diagonal de JtJ para esa restricción
 * se hace ~0. Con el amortiguamiento ABSOLUTO que tenía el LM (`+1e-12`), el
 * paso se dividía entre ~1e-12 y explotaba: los 8 reintentos se rechazaban, el
 * solver salía con `iters=0` y el croquis se quedaba ROJO. Fallaba ya con 4
 * puntos. Bloqueaba la primera lección de aerodinámica dentro del CAD.
 */
describe('solveSketch — geometría casi-horizontal (la cuerda del perfil)', () => {
  const perfilAplanado = (): Sketch => ({
    // silueta de extradós: casi plana, como cualquier perfil alar real
    points: [{ x: 0, y: 0 }, { x: 30, y: 1.5 }, { x: 70, y: 1.2 }, { x: 100, y: 0.02 }],
    lines: [{ a: 0, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 }],
    circles: [],
    constraints: [
      { t: 'fix', p: 0 },
      { t: 'distance', p: 0, q: 3, d: 120 },   // ACOTAR la cuerda
    ],
  });

  it('converge, itera, y la cuerda queda en la cota pedida', () => {
    const s = perfilAplanado();
    const r = solveSketch(s);
    expect(r.converged).toBe(true);
    expect(r.iters).toBeGreaterThan(0);        // iters=0 era la firma del bug
    const d = Math.hypot(s.points[3].x - s.points[0].x, s.points[3].y - s.points[0].y);
    expect(d).toBeCloseTo(120, 4);
  });

  it('aguanta el caso degenerado: EXACTAMENTE horizontal (∂/∂y = 0 justo)', () => {
    const s: Sketch = {
      points: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 80, y: 0 }],
      lines: [{ a: 0, b: 1 }, { a: 1, b: 2 }],
      circles: [],
      constraints: [{ t: 'fix', p: 0 }, { t: 'distance', p: 0, q: 2, d: 100 }],
    };
    const r = solveSketch(s);
    expect(r.converged).toBe(true);
    expect(Math.hypot(s.points[2].x, s.points[2].y)).toBeCloseTo(100, 4);
  });

  it('escala invariante: en metros (cuerda 0.1) converge igual que en mm', () => {
    // con tolerancia ABSOLUTA, una matriz legítimamente pequeña se descartaba
    const s: Sketch = {
      points: [{ x: 0, y: 0 }, { x: 0.03, y: 0.0015 }, { x: 0.1, y: 0.00002 }],
      lines: [{ a: 0, b: 1 }, { a: 1, b: 2 }],
      circles: [],
      constraints: [{ t: 'fix', p: 0 }, { t: 'distance', p: 0, q: 2, d: 0.12 }],
    };
    const r = solveSketch(s);
    expect(r.converged).toBe(true);
    expect(Math.hypot(s.points[2].x, s.points[2].y)).toBeCloseTo(0.12, 6);
  });

  it('16 puntos casi-horizontales (densidad de un perfil real) también converge', () => {
    const pts = Array.from({ length: 16 }, (_, i) => ({
      x: (i / 15) * 100,
      y: 12 * Math.sin(Math.PI * (i / 15)) * 0.08,   // comba de ~1% de la cuerda
    }));
    const s: Sketch = {
      points: pts,
      lines: pts.slice(1).map((_, i) => ({ a: i, b: i + 1 })),
      circles: [],
      constraints: [{ t: 'fix', p: 0 }, { t: 'distance', p: 0, q: 15, d: 150 }],
    };
    const r = solveSketch(s);
    expect(r.converged).toBe(true);
    expect(Math.hypot(s.points[15].x - s.points[0].x, s.points[15].y - s.points[0].y)).toBeCloseTo(150, 3);
  });
});
