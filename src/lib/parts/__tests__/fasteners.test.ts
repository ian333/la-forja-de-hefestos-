/**
 * ⚒️ Tornillería Weston — invariantes (pruebas, no "no truena")
 * =============================================================
 *   1. Cotas DIN/ISO = valores de norma conocidos (M8 hex s=13, etc.).
 *   2. hexagonVerts: ancho entre caras reconstruido = s; circunradio = s/√3.
 *   3. Geometría: el bounding de cada pieza coincide con sus cotas
 *      (largo del tornillo = k + L; tuerca/rondana = barreno < cuerpo).
 *   4. El hueco Allen y el barreno son RESTAS (subtract), no unión.
 *   5. Dispatch + escena raíz.
 *   6. Catálogo: SKUs únicos con patrón, cada entrada construye sin lanzar,
 *      masa estimada > 0 y monótona con la medida, largos coherentes.
 *   7. Sin NaN en ninguna primitiva.
 */
import { describe, it, expect } from 'vitest';
import type { SdfNode, SdfPrimitive } from '../../sdf-engine';
import {
  THREAD, HEX_HEAD, HEX_NUT, FLAT_WASHER, SOCKET_CAP, SPRING_WASHER,
  hexagonVerts, hexCircumradius,
} from '../fasteners/din';
import {
  buildHexBolt, buildSocketCap, buildHexNut, buildFlatWasher,
  buildSpringWasher, buildFastener, buildFastenerScene,
} from '../fasteners/geometry';
import {
  buildWestonCatalog, catalogStats, approxVolume, approxMassGrams,
  CATEGORIES,
} from '../fasteners/catalog';

// ── helpers de bounding sobre el árbol SDF ───────────────────────────
interface B { ymin: number; ymax: number; rmax: number; }
function primYExtent(p: SdfPrimitive): [number, number] {
  const h = p.params.height ?? 0;
  return [p.position[1] - h / 2, p.position[1] + h / 2];
}
function primRadius(p: SdfPrimitive): number {
  if (p.type === 'cylinder') return Math.hypot(p.position[0], p.position[2]) + (p.params.radius ?? 0);
  if (p.type === 'polygon') return Math.max(...(p.polyVerts ?? [[0, 0]]).map(([x, y]) => Math.hypot(x, y)));
  return 0;
}
/** Bounding positivo: en una resta, solo el primer hijo (el sólido) cuenta. */
function bounds(node: SdfNode): B {
  if (node.kind === 'primitive') {
    const [ymin, ymax] = primYExtent(node);
    return { ymin, ymax, rmax: primRadius(node) };
  }
  const kids = node.kind === 'operation' && node.type === 'subtract'
    ? [node.children[0]] : node.children;
  const bs = kids.map(bounds);
  return {
    ymin: Math.min(...bs.map((b) => b.ymin)),
    ymax: Math.max(...bs.map((b) => b.ymax)),
    rmax: Math.max(...bs.map((b) => b.rmax)),
  };
}
function eachPrimitive(node: SdfNode, fn: (p: SdfPrimitive) => void): void {
  if (node.kind === 'primitive') return fn(node);
  for (const c of node.children) eachPrimitive(c, fn);
}
function hasSubtract(node: SdfNode): boolean {
  if (node.kind === 'primitive') return false;
  if (node.kind === 'operation' && node.type === 'subtract') return true;
  return node.children.some(hasSubtract);
}

describe('cotas DIN/ISO = norma', () => {
  it('cabeza hexagonal DIN 933 / ISO 4017', () => {
    expect(HEX_HEAD.M8.s).toBe(13);
    expect(HEX_HEAD.M10.s).toBe(17);  // ISO 4017
    expect(HEX_HEAD.M12.s).toBe(19);
    expect(HEX_HEAD.M6.k).toBe(4.0);
  });
  it('tuerca DIN 934 y rosca', () => {
    expect(HEX_NUT.M12.s).toBe(19);
    expect(HEX_NUT.M8.m).toBe(6.8);
    expect(THREAD.M8.pitch).toBe(1.25);
    expect(THREAD.M10.pitch).toBe(1.5);
  });
  it('rondana plana DIN 125 y Allen DIN 912', () => {
    expect(FLAT_WASHER.M8.d2).toBe(16);
    expect(FLAT_WASHER.M10.d1).toBe(10.5);
    expect(SOCKET_CAP.M6.sw).toBe(5);
    expect(SOCKET_CAP.M8.dk).toBe(13);
  });
});

describe('hexágono: ancho entre caras', () => {
  it('reconstruye s y circunradio s/√3', () => {
    const s = 13;
    const v = hexagonVerts(s);
    expect(v).toHaveLength(6);
    // circunradio
    for (const [x, y] of v) expect(Math.hypot(x, y)).toBeCloseTo(s / Math.sqrt(3), 6);
    expect(hexCircumradius(s)).toBeCloseTo(s / Math.sqrt(3), 6);
    // apotema = distancia centro→punto medio de arista; entre-caras = 2·apotema = s
    let apothem = Infinity;
    for (let i = 0; i < 6; i++) {
      const a = v[i], b = v[(i + 1) % 6];
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      apothem = Math.min(apothem, Math.hypot(mid[0], mid[1]));
    }
    expect(2 * apothem).toBeCloseTo(s, 6);
  });
});

describe('geometría: bounding = cotas', () => {
  it('tornillo hex M8×30: largo = k + L, ancho = cabeza', () => {
    const b = bounds(buildHexBolt('M8', 30));
    expect(b.ymin).toBeCloseTo(-HEX_HEAD.M8.k, 5);   // cabeza bajo Y=0
    expect(b.ymax).toBeCloseTo(30, 5);               // vástago +Y
    expect(b.rmax).toBeCloseTo(hexCircumradius(HEX_HEAD.M8.s), 4);
  });
  it('tornillo Allen M8×30: hueco Allen es una resta', () => {
    const mod = buildSocketCap('M8', 30);
    const b = bounds(mod);
    expect(b.ymin).toBeCloseTo(-SOCKET_CAP.M8.k, 5);
    expect(b.ymax).toBeCloseTo(30, 5);
    expect(b.rmax).toBeCloseTo(SOCKET_CAP.M8.dk / 2, 5);
    expect(hasSubtract(mod)).toBe(true);
  });
  it('tuerca M8: barreno (resta) cabe dentro del entre-caras', () => {
    const mod = buildHexNut('M8');
    expect(hasSubtract(mod)).toBe(true);
    const b = bounds(mod);
    expect(b.ymax - b.ymin).toBeCloseTo(HEX_NUT.M8.m, 5);
    // barreno Ø=d ⇒ radio d/2 menor que la apotema s/2
    expect(THREAD.M8.d / 2).toBeLessThan(HEX_NUT.M8.s / 2);
  });
  it('rondana plana M8: exterior > barreno, espesor = h', () => {
    const mod = buildFlatWasher('M8');
    expect(hasSubtract(mod)).toBe(true);
    const b = bounds(mod);
    expect(b.rmax).toBeCloseTo(FLAT_WASHER.M8.d2 / 2, 5);
    expect(b.ymax - b.ymin).toBeCloseTo(FLAT_WASHER.M8.h, 5);
    expect(FLAT_WASHER.M8.d2).toBeGreaterThan(FLAT_WASHER.M8.d1);
  });
  it('rondana de presión: M16 ok, M20 sin datos lanza', () => {
    expect(() => buildSpringWasher('M16')).not.toThrow();
    expect(SPRING_WASHER.M20).toBeUndefined();
    expect(() => buildSpringWasher('M20')).toThrow();
  });
});

describe('dispatch + escena', () => {
  it('buildFastener cubre los 5 tipos', () => {
    expect(buildFastener({ type: 'hex-bolt', size: 'M6', length: 20 }).kind).toBe('module');
    expect(buildFastener({ type: 'socket-cap', size: 'M6', length: 20 }).kind).toBe('module');
    expect(buildFastener({ type: 'hex-nut', size: 'M6' }).kind).toBe('module');
    expect(buildFastener({ type: 'flat-washer', size: 'M6' }).kind).toBe('module');
    expect(buildFastener({ type: 'spring-washer', size: 'M6' }).kind).toBe('module');
  });
  it('tornillo sin largo lanza; escena raíz es union', () => {
    expect(() => buildFastener({ type: 'hex-bolt', size: 'M6' })).toThrow();
    const scene = buildFastenerScene({ type: 'hex-nut', size: 'M6' });
    expect(scene.kind).toBe('operation');
    expect(scene.type).toBe('union');
  });
});

describe('volumen y masa', () => {
  it('volúmenes positivos; tuerca = prisma − barreno', () => {
    expect(approxVolume({ type: 'hex-bolt', size: 'M8', length: 30 })).toBeGreaterThan(0);
    expect(approxVolume({ type: 'hex-nut', size: 'M8' })).toBeGreaterThan(0);
    expect(approxVolume({ type: 'flat-washer', size: 'M8' })).toBeGreaterThan(0);
  });
  it('masa crece con la medida (mismo largo)', () => {
    const m6 = approxMassGrams({ type: 'hex-bolt', size: 'M6', length: 30, material: 'acero', finish: 'zinc' });
    const m10 = approxMassGrams({ type: 'hex-bolt', size: 'M10', length: 30, material: 'acero', finish: 'zinc' });
    expect(m10).toBeGreaterThan(m6);
    expect(m6).toBeGreaterThan(0);
  });
});

describe('catálogo Weston', () => {
  const cat = buildWestonCatalog();

  it('tiene contenido y estadística coherente', () => {
    expect(cat.length).toBeGreaterThan(100);
    const stats = catalogStats(cat);
    expect(stats.total).toBe(cat.length);
    expect(Object.keys(stats.byCategory).length).toBe(CATEGORIES.length);
  });
  it('SKUs únicos con patrón WST-...', () => {
    const skus = new Set(cat.map((e) => e.sku));
    expect(skus.size).toBe(cat.length);
    for (const e of cat) expect(e.sku).toMatch(/^WST-[A-Z]{2}-M\d+(X\d+)?-[A-Z]{2}-[A-Z]{2}$/);
  });
  it('largos coherentes: tornillos con largo, tuercas/rondanas sin', () => {
    for (const e of cat) {
      if (e.type === 'hex-bolt' || e.type === 'socket-cap') {
        expect(e.length).toBeGreaterThan(0);
        expect(e.sku).toContain('X');
      } else {
        expect(e.length).toBeUndefined();
      }
    }
  });
  it('cada entrada construye geometría y tiene masa > 0', () => {
    for (const e of cat) {
      expect(() => buildFastener(e.spec)).not.toThrow();
      expect(e.massGrams).toBeGreaterThan(0);
    }
  });
});

describe('integridad numérica', () => {
  it('ninguna primitiva tiene NaN/Inf', () => {
    const specs = [
      buildHexBolt('M12', 60), buildSocketCap('M10', 40), buildHexNut('M16'),
      buildFlatWasher('M20'), buildSpringWasher('M8'),
    ];
    for (const mod of specs) {
      eachPrimitive(mod, (p) => {
        for (const v of p.position) expect(Number.isFinite(v)).toBe(true);
        for (const v of Object.values(p.params)) expect(Number.isFinite(v)).toBe(true);
        for (const vp of p.polyVerts ?? []) for (const v of vp) expect(Number.isFinite(v)).toBe(true);
      });
    }
  });
});
