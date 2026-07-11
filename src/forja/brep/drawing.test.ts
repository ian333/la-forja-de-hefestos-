/**
 * drawing.test.ts — motor de planos 2D (HLR real). PURO (sin OCCT/three).
 * Verifica: proyección ortográfica exacta (cotas = dimensiones reales),
 * separación líneas visibles/ocultas por raycast Möller–Trumbore, elección
 * de escala "bonita", y SVG bien formado con cajetín.
 */
import { describe, it, expect } from 'vitest';
import { generateDrawing, type DrawingInput } from './drawing';

// Caja axis-aligned: X=ancho(W), Y=fondo(D), Z=alto(H). Malla cerrada (12 tri) +
// las 12 aristas como polilíneas de 2 puntos.
function makeBox(W = 40, D = 20, H = 12): DrawingInput {
  const v: [number, number, number][] = [
    [0, 0, 0], [W, 0, 0], [W, D, 0], [0, D, 0],
    [0, 0, H], [W, 0, H], [W, D, H], [0, D, H],
  ];
  const positions = v.flat();
  const t = (a: number, b: number, c: number) => [a, b, c];
  const indices = [
    ...t(0, 1, 2), ...t(0, 2, 3),     // z=0
    ...t(4, 5, 6), ...t(4, 6, 7),     // z=H
    ...t(0, 1, 5), ...t(0, 5, 4),     // y=0
    ...t(3, 2, 6), ...t(3, 6, 7),     // y=D
    ...t(0, 3, 7), ...t(0, 7, 4),     // x=0
    ...t(1, 2, 6), ...t(1, 6, 5),     // x=W
  ];
  const E = (i: number, j: number) => ({ polyline: [v[i], v[j]] as [number, number, number][] });
  const edges = [
    E(0, 1), E(1, 2), E(2, 3), E(3, 0),
    E(4, 5), E(5, 6), E(6, 7), E(7, 4),
    E(0, 4), E(1, 5), E(2, 6), E(3, 7),
  ];
  return { positions, indices, edges };
}

describe('generateDrawing — proyección ortográfica exacta', () => {
  const r = generateDrawing(makeBox(40, 20, 12), { name: 'Caja', material: 'Aluminio 6061', massG: 23.4 });

  it('bbox = dimensiones reales del modelo', () => {
    expect(r.bbox.w).toBeCloseTo(40, 3); // X
    expect(r.bbox.h).toBeCloseTo(12, 3); // Z
    expect(r.bbox.d).toBeCloseTo(20, 3); // Y
  });

  it('tres vistas en tercer ángulo con los nombres correctos', () => {
    const labels = r.views.map((v) => v.label);
    expect(labels).toEqual(['ALZADO', 'PLANTA', 'LATERAL']);
  });

  it('ALZADO muestra ancho×alto = 40×12', () => {
    const front = r.views.find((v) => v.key === 'front')!;
    expect(front.wmm).toBeCloseTo(40, 1);
    expect(front.hmm).toBeCloseTo(12, 1);
  });

  it('PLANTA muestra ancho×fondo = 40×20', () => {
    const top = r.views.find((v) => v.key === 'top')!;
    expect(top.wmm).toBeCloseTo(40, 1);
    expect(top.hmm).toBeCloseTo(20, 1);
  });

  it('LATERAL muestra fondo×alto = 20×12', () => {
    const right = r.views.find((v) => v.key === 'right')!;
    expect(right.wmm).toBeCloseTo(20, 1);
    expect(right.hmm).toBeCloseTo(12, 1);
  });

  it('cada vista tiene líneas visibles y longitud > 0', () => {
    for (const v of r.views) {
      expect(v.nVisible).toBeGreaterThan(0);
      expect(v.visibleLen).toBeGreaterThan(0);
    }
  });
});

// Anillo (rim de un barreno) como polilínea cerrada en un plano z=const.
function ring(cx: number, cy: number, z: number, r: number, n = 48): { polyline: [number, number, number][] } {
  const pl: [number, number, number][] = [];
  for (let i = 0; i <= n; i++) { const t = (2 * Math.PI * i) / n; pl.push([cx + r * Math.cos(t), cy + r * Math.sin(t), z]); }
  return { polyline: pl };
}
// Caja 40×20×12 con barreno Ø8 (r=4) centrado en (12,10) a lo largo de Z.
function boxWithHole(): DrawingInput {
  const b = makeBox(40, 20, 12);
  return { ...b, edges: [...b.edges, ring(12, 10, 12, 4), ring(12, 10, 0, 4)] };
}

describe('generateDrawing — agujeros (cota Ø + eje de centro)', () => {
  const r = generateDrawing(boxWithHole(), { name: 'Caja barreno', material: 'Aluminio 6061', massG: 20 });

  it('detecta el barreno en PLANTA con Ø y centro correctos', () => {
    const top = r.views.find((v) => v.key === 'top')!;
    expect(top.circles.length).toBe(1); // los dos rims (arriba/abajo) deduplican a uno
    expect(top.circles[0].dia).toBeCloseTo(8, 1);
    expect(top.circles[0].cu).toBeCloseTo(12, 1);
    expect(top.circles[0].cv).toBeCloseTo(10, 1);
  });

  it('NO confunde el círculo de canto (ALZADO/LATERAL) con un agujero', () => {
    expect(r.views.find((v) => v.key === 'front')!.circles.length).toBe(0);
    expect(r.views.find((v) => v.key === 'right')!.circles.length).toBe(0);
  });

  it('una caja SIN agujeros no detecta círculos', () => {
    const plain = generateDrawing(makeBox(40, 20, 12));
    expect(plain.views.every((v) => v.circles.length === 0)).toBe(true);
  });

  it('el SVG dibuja la cota Ø y el eje en cruz del agujero', () => {
    expect(r.svg).toContain('⌀8');
    expect(r.svg).toContain('data-dim="diameter"');
    expect(r.svg).toContain('data-line="center"');
  });
});

// Caja 40×20×12 con DOS barrenos (Ø8 en (12,10) y Ø6 en (30,14)) a lo largo de Z.
function boxWith2Holes(): DrawingInput {
  const b = makeBox(40, 20, 12);
  return { ...b, edges: [...b.edges, ring(12, 10, 12, 4), ring(12, 10, 0, 4), ring(30, 14, 12, 3), ring(30, 14, 0, 3)] };
}

describe('generateDrawing — acotación BASELINE multi-barreno (U7 §7-9)', () => {
  const r = generateDrawing(boxWith2Holes(), { name: '2 barrenos' });

  it('la PLANTA detecta los DOS círculos', () => {
    const top = r.views.find((v) => v.key === 'top')!;
    expect(top.circles.length).toBe(2);
  });

  it('cada barreno lleva posición X y Y desde el MISMO datum (baseline)', () => {
    expect((r.svg.match(/data-dim="pos-x"/g) || []).length).toBe(2);
    expect((r.svg.match(/data-dim="pos-y"/g) || []).length).toBe(2);
    // valores = posición REAL medida desde la esquina inf-izq de la vista
    expect(r.svg).toContain('>12.0<');   // cx barreno 1
    expect(r.svg).toContain('>30.0<');   // cx barreno 2
    expect(r.svg).toContain('>10.0<');   // cy barreno 1
    expect(r.svg).toContain('>14.0<');   // cy barreno 2
  });

  it('el caso de UN barreno conserva sus cotas de posición (compat)', () => {
    const one = generateDrawing(boxWithHole());
    expect((one.svg.match(/data-dim="pos-x"/g) || []).length).toBe(1);
    expect((one.svg.match(/data-dim="pos-y"/g) || []).length).toBe(1);
  });
});

describe('generateDrawing — profundidad + nota de tolerancia', () => {
  it('la PLANTA acota la PROFUNDIDAD del modelo (el trío w/h/d completo)', () => {
    const r = generateDrawing(makeBox(40, 20, 12));
    expect(r.svg).toContain('data-dim="depth"');
    expect(r.svg).toContain('>20.0<');   // d = 20 real
  });

  it('meta.tolNote rotula la tolerancia general sobre el cajetín', () => {
    const r = generateDrawing(makeBox(40, 20, 12), { tolNote: '±0.1 · ISO 2768-m' });
    expect(r.svg).toContain('data-note="tol"');
    expect(r.svg).toContain('TOL. GRAL. ±0.1 · ISO 2768-m SALVO INDICACIÓN');
  });

  it('sin tolNote NO aparece la nota (aditivo, no rompe moldes)', () => {
    expect(generateDrawing(makeBox(40, 20, 12)).svg).not.toContain('data-note="tol"');
  });

  it('meta.raNote rotula el acabado general (ISO 1302); sin él, nada', () => {
    const r = generateDrawing(makeBox(40, 20, 12), { raNote: 'Ra 3.2', tolNote: '±0.1' });
    expect(r.svg).toContain('data-note="ra"');
    expect(r.svg).toContain('ACABADO Ra 3.2 SALVO INDICACIÓN');
    expect(generateDrawing(makeBox(40, 20, 12)).svg).not.toContain('data-note="ra"');
  });
});

describe('generateDrawing — primer ángulo (ISO europeo, U4-L5)', () => {
  // Extrae la Y de hoja del label de una vista (menor y = más arriba en la hoja)
  const labelY = (svg: string, label: string) => {
    const m = svg.match(new RegExp(`<text x="[\\d.]+" y="([\\d.]+)"[^>]*>${label}</text>`));
    return m ? parseFloat(m[1]) : NaN;
  };
  it('tercer ángulo (default): PLANTA ARRIBA del alzado', () => {
    const svg = generateDrawing(makeBox(40, 20, 12)).svg;
    expect(labelY(svg, 'PLANTA')).toBeLessThan(labelY(svg, 'ALZADO'));
    expect(svg).toContain('3er áng');
  });
  it("projection:'first': PLANTA ABAJO del alzado y cajetín '1er áng'", () => {
    const svg = generateDrawing(makeBox(40, 20, 12), { projection: 'first' }).svg;
    expect(labelY(svg, 'PLANTA')).toBeGreaterThan(labelY(svg, 'ALZADO'));
    expect(svg).toContain('1er áng');
  });
  it('las dimensiones reales de las vistas NO cambian con el sistema', () => {
    const a = generateDrawing(makeBox(40, 20, 12));
    const b = generateDrawing(makeBox(40, 20, 12), { projection: 'first' });
    for (const k of ['front', 'top', 'right'] as const) {
      const va = a.views.find((v) => v.key === k)!, vb = b.views.find((v) => v.key === k)!;
      expect(vb.wmm).toBeCloseTo(va.wmm, 3);
      expect(vb.hmm).toBeCloseTo(va.hmm, 3);
    }
  });
});

describe('generateDrawing — oclusión HLR (Möller–Trumbore)', () => {
  it('una arista DETRÁS de una pared sale oculta; una DELANTE, visible', () => {
    // Pared grande en y=0 (ocluye en el ALZADO, eye = -Y).
    const wall: [number, number, number][] = [[-50, 0, -50], [50, 0, -50], [50, 0, 50], [-50, 0, 50]];
    const input: DrawingInput = {
      positions: wall.flat(),
      indices: [0, 1, 2, 0, 2, 3],
      edges: [
        { polyline: [[-10, 10, 5], [10, 10, 5]] },   // detrás (y=+10) → oculta en ALZADO
        { polyline: [[-10, -10, 8], [10, -10, 8]] },  // delante (y=-10) → visible en ALZADO
      ],
    };
    const front = generateDrawing(input).views.find((v) => v.key === 'front')!;
    expect(front.nHidden).toBeGreaterThanOrEqual(1);
    expect(front.nVisible).toBeGreaterThanOrEqual(1);
  });
});

describe('generateDrawing — escala "bonita"', () => {
  it('caja chica (40mm) en A4 → 2:1', () => {
    expect(generateDrawing(makeBox(40, 20, 12)).scale).toBe('2:1');
  });

  it('caja grande (400mm) en A4 → reducción 1:N', () => {
    expect(generateDrawing(makeBox(400, 200, 120)).scale).toMatch(/^1:\d/);
  });
});

describe('generateDrawing — SVG y cajetín', () => {
  const r = generateDrawing(makeBox(40, 20, 12), { name: 'Pieza La Forja', material: 'Aluminio 6061', massG: 23.4 });

  it('SVG A4 apaisado bien formado', () => {
    expect(r.svg.startsWith('<svg')).toBe(true);
    expect(r.svg).toContain('width="297mm"');
    expect(r.svg).toContain('height="210mm"');
    expect(r.svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('incluye las tres etiquetas de vista', () => {
    expect(r.svg).toContain('ALZADO');
    expect(r.svg).toContain('PLANTA');
    expect(r.svg).toContain('LATERAL');
  });

  it('cajetín con material, masa, escala y marca', () => {
    expect(r.svg).toContain('title-block');
    expect(r.svg).toContain('Aluminio 6061');
    expect(r.svg).toContain('23.4 g');
    expect(r.svg).toContain('2:1');
    expect(r.svg).toContain('La Forja');
  });

  it('emite líneas visibles (sólidas) y, con oclusión, ocultas (punteadas)', () => {
    expect(r.svg).toContain('data-line="visible"');
  });
});
