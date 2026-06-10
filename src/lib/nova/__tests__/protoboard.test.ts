import { describe, it, expect } from 'vitest';
import {
  netKey, buildNetlist, ldrR, ntcR,
  type Placement, type Jumper, type Hole,
} from '../protoboard';
import { CATALOGO, RECETAS, recetaPrecio, recetaEntrega, skuById } from '../catalogo';
import { dcOperatingPoint } from '@/lib/circuitos/spice';

const m = (col: number, row: number): Hole => ({ kind: 'main', col, row });
const rail = (r: 0 | 1 | 2 | 3, col: number): Hole => ({ kind: 'rail', rail: r, col });

// ── La física de la protoboard ───────────────────────────────────────────

describe('protoboard — nets físicas de la 830', () => {
  it('5 hoyitos de la misma columna/mitad = la misma net', () => {
    expect(netKey(m(10, 0))).toBe(netKey(m(10, 4)));
  });
  it('el canal central SEPARA las mitades (ahí cabalga el DIP)', () => {
    expect(netKey(m(10, 4))).not.toBe(netKey(m(10, 5)));
  });
  it('columnas distintas = nets distintas', () => {
    expect(netKey(m(10, 0))).not.toBe(netKey(m(11, 0)));
  });
  it('el riel corre completo: col 1 y col 50 del mismo riel = una net', () => {
    expect(netKey(rail(0, 1))).toBe(netKey(rail(0, 50)));
  });
});

// ── Catálogo ─────────────────────────────────────────────────────────────

describe('catálogo NOVA', () => {
  it('~40 SKUs curados, todos con precio y utilidad', () => {
    expect(CATALOGO.length).toBeGreaterThanOrEqual(35);
    expect(CATALOGO.length).toBeLessThanOrEqual(50);
    for (const s of CATALOGO) {
      expect(s.precio).toBeGreaterThan(0);
      expect(s.util.length).toBeGreaterThan(10);
    }
  });
  it('ids únicos', () => {
    const ids = CATALOGO.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('toda receta usa SKUs existentes y tiene precio razonable', () => {
    for (const r of RECETAS) {
      for (const it of r.items) expect(skuById(it.skuId), `${r.id}: ${it.skuId}`).toBeDefined();
      const precio = recetaPrecio(r);
      expect(precio).toBeGreaterThan(5);
      expect(precio).toBeLessThan(200); // accesible: ese es el punto
    }
  });
  it('hay recetas de entrega local 24-48h (el gancho)', () => {
    expect(RECETAS.some((r) => recetaEntrega(r) === 'local')).toBe(true);
  });
});

// ── Netlist: divisor en protoboard real ──────────────────────────────────

describe('buildNetlist — circuitos armados hoyito por hoyito', () => {
  it('divisor de voltaje en la protoboard mide lo que dice la fórmula', () => {
    // 9V: + al riel0, − al riel1. R10k de riel0 a col10. R10k de col10 a riel1.
    const placements: Placement[] = [
      { id: 'bat', skuId: 'p-9v', pins: [rail(0, 1), rail(1, 1)] },
      { id: 'r1', skuId: 'r-10000', pins: [rail(0, 5), m(10, 0)] },
      { id: 'r2', skuId: 'r-10000', pins: [m(10, 1), rail(1, 8)] },
    ];
    const net = buildNetlist(placements, []);
    expect(net.warnings).toHaveLength(0);
    const op = dcOperatingPoint(net.circuit)!;
    // el punto medio (col10 mitad A) debe estar a 4.5 V sobre tierra
    const midNode = net.nodePin.get('r1')![1];
    expect(op.v[midNode]).toBeCloseTo(4.5, 6);
  });

  it('los jumpers FUSIONAN nets (col5 ↔ col20 se vuelven el mismo nodo)', () => {
    const placements: Placement[] = [
      { id: 'bat', skuId: 'p-9v', pins: [m(5, 0), m(40, 0)] },
      { id: 'r1', skuId: 'r-1000', pins: [m(20, 0), m(40, 1)] },
    ];
    const jumpers: Jumper[] = [{ id: 'j1', a: m(5, 1), b: m(20, 1) }];
    const net = buildNetlist(placements, jumpers);
    const op = dcOperatingPoint(net.circuit)!;
    // toda la corriente pasa por r1: V/R = 9/1000 = 9 mA
    expect(Math.abs(op.vsrcI.get('bat')!)).toBeCloseTo(0.009, 6);
  });

  it('LED + resistencia: prende con ~2 V de caída y corriente sana', () => {
    const placements: Placement[] = [
      { id: 'bat', skuId: 'p-9v', pins: [rail(0, 1), rail(1, 1)] },
      { id: 'r', skuId: 'r-330', pins: [rail(0, 3), m(8, 0)] },
      { id: 'led', skuId: 'led-rojo', pins: [m(8, 1), rail(1, 6)] },
    ];
    const net = buildNetlist(placements, []);
    const op = dcOperatingPoint(net.circuit)!;
    const anodo = net.nodePin.get('led')![0];
    const vLed = op.v[anodo]; // cátodo en tierra
    expect(vLed).toBeGreaterThan(1.5); // LED rojo real: ~1.8-2 V
    expect(vLed).toBeLessThan(2.4);
    const iLed = (9 - vLed) / 330;
    expect(iLed).toBeGreaterThan(0.015); // ~21 mA: brillante y a salvo
    expect(iLed).toBeLessThan(0.03);
  });

  it('la LUZ NOCTURNA (receta estrella): LDR oscura sube el nodo, con luz lo baja', () => {
    // divisor LDR(arriba)/10k(abajo): a oscuras la LDR es 200k → nodo BAJO;
    // espera... LDR arriba: oscuro→R alta→nodo bajo. Queremos nodo que SUBE
    // a oscuras para encender: LDR abajo, R arriba.
    const build = (luz: number) => {
      const placements: Placement[] = [
        { id: 'bat', skuId: 'p-9v', pins: [rail(0, 1), rail(1, 1)] },
        { id: 'r', skuId: 'r-10000', pins: [rail(0, 4), m(12, 0)] },
        { id: 'ldr', skuId: 's-ldr', pins: [m(12, 1), rail(1, 7)], state: { luz } },
      ];
      const net = buildNetlist(placements, []);
      const op = dcOperatingPoint(net.circuit)!;
      return op.v[net.nodePin.get('r')![1]];
    };
    const vOscuro = build(0);   // LDR = 200k → casi todo el voltaje en la LDR
    const vConLuz = build(1);   // LDR = 1k → el nodo cae
    expect(vOscuro).toBeGreaterThan(8);   // 9·200k/210k ≈ 8.57 V
    expect(vConLuz).toBeLessThan(1);      // 9·1k/11k ≈ 0.82 V
  });

  it('potenciómetro: la perilla mueve el voltaje del cursor', () => {
    const build = (frac: number) => {
      const placements: Placement[] = [
        { id: 'bat', skuId: 'p-9v', pins: [rail(0, 1), rail(1, 1)] },
        { id: 'pot', skuId: 'e-pot10k', pins: [rail(0, 5), m(15, 0), rail(1, 5)], state: { frac } },
      ];
      const net = buildNetlist(placements, []);
      const op = dcOperatingPoint(net.circuit)!;
      return op.v[net.nodePin.get('pot')![1]];
    };
    // frac mide la R del lado +: frac alto → cursor lejos del + → voltaje bajo
    expect(build(0.1)).toBeGreaterThan(build(0.9));
    expect(build(0.5)).toBeCloseTo(4.5, 1);
  });

  it('sin fuente → warning honesto', () => {
    const net = buildNetlist([{ id: 'r', skuId: 'r-1000', pins: [m(1, 0), m(2, 0)] }], []);
    expect(net.warnings.some((w) => w.includes('fuente'))).toBe(true);
  });

  it('pieza sin modelo (555) avisa pero no rompe', () => {
    const placements: Placement[] = [
      { id: 'bat', skuId: 'p-9v', pins: [rail(0, 1), rail(1, 1)] },
      { id: 'timer', skuId: 'ic-555', pins: [m(30, 0), m(30, 5)] },
      { id: 'r', skuId: 'r-1000', pins: [rail(0, 4), rail(1, 9)] },
    ];
    const net = buildNetlist(placements, []);
    expect(net.warnings.some((w) => w.includes('555') || w.includes('NE555'))).toBe(true);
    expect(dcOperatingPoint(net.circuit)).not.toBeNull();
  });
});

// ── Sensores: las curvas reales ──────────────────────────────────────────

describe('sensores', () => {
  it('LDR: 200k a oscuras, 1k a plena luz, log entre medio', () => {
    expect(ldrR(200000, 1000, 0)).toBeCloseTo(200000, 0);
    expect(ldrR(200000, 1000, 1)).toBeCloseTo(1000, 0);
    const mid = ldrR(200000, 1000, 0.5);
    expect(mid).toBeGreaterThan(5000);
    expect(mid).toBeLessThan(50000); // geométrico ~14k, no aritmético 100k
  });
  it('NTC 10k β3950: 10k a 25°C, baja al calentar', () => {
    expect(ntcR(10000, 3950, 25)).toBeCloseTo(10000, 0);
    expect(ntcR(10000, 3950, 50)).toBeLessThan(4500);  // ~3.6k
    expect(ntcR(10000, 3950, 0)).toBeGreaterThan(25000); // ~32k
  });
});
