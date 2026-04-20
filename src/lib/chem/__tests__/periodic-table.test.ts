import { describe, it, expect } from 'vitest';
import {
  PERIODIC_TABLE, elementByZ, elementBySymbol,
  electronConfig, configString, configCompact,
  effectiveZ, valenceElectrons,
} from '../quantum/periodic-table';

describe('PERIODIC_TABLE — cobertura', () => {
  it('contiene 118 elementos', () => {
    expect(PERIODIC_TABLE).toHaveLength(118);
  });

  it('Z va de 1 a 118 sin huecos', () => {
    for (let i = 0; i < 118; i++) {
      expect(PERIODIC_TABLE[i].Z).toBe(i + 1);
    }
  });

  it('todos los símbolos son únicos', () => {
    const set = new Set(PERIODIC_TABLE.map((e) => e.symbol));
    expect(set.size).toBe(118);
  });

  it('todos los nombres existen y no están vacíos', () => {
    for (const e of PERIODIC_TABLE) {
      expect(e.name).toBeTruthy();
      expect(e.name.length).toBeGreaterThan(0);
    }
  });

  it('elementos canónicos por símbolo', () => {
    expect(elementBySymbol('H')?.Z).toBe(1);
    expect(elementBySymbol('He')?.Z).toBe(2);
    expect(elementBySymbol('C')?.Z).toBe(6);
    expect(elementBySymbol('Fe')?.Z).toBe(26);
    expect(elementBySymbol('Au')?.Z).toBe(79);
    expect(elementBySymbol('U')?.Z).toBe(92);
    expect(elementBySymbol('Og')?.Z).toBe(118);
  });

  it('elemento por Z funciona para casos clave', () => {
    expect(elementByZ(1)?.symbol).toBe('H');
    expect(elementByZ(79)?.symbol).toBe('Au');
    expect(elementByZ(118)?.symbol).toBe('Og');
  });
});

// ═══════════════════════════════════════════════════════════════
// Configuraciones electrónicas
// ═══════════════════════════════════════════════════════════════

describe('electronConfig — casos canónicos Madelung', () => {
  it('H: 1s¹', () => {
    const c = electronConfig(1);
    expect(c).toHaveLength(1);
    expect(c[0]).toEqual({ n: 1, l: 0, electrons: 1 });
  });

  it('He: 1s²', () => {
    expect(electronConfig(2)).toEqual([{ n: 1, l: 0, electrons: 2 }]);
  });

  it('C: 1s² 2s² 2p²', () => {
    const c = electronConfig(6);
    expect(c[0]).toEqual({ n: 1, l: 0, electrons: 2 });
    expect(c[1]).toEqual({ n: 2, l: 0, electrons: 2 });
    expect(c[2]).toEqual({ n: 2, l: 1, electrons: 2 });
  });

  it('Ne: 1s² 2s² 2p⁶', () => {
    const c = electronConfig(10);
    expect(c[c.length - 1]).toEqual({ n: 2, l: 1, electrons: 6 });
  });

  it('Ar: 1s² 2s² 2p⁶ 3s² 3p⁶', () => {
    const c = electronConfig(18);
    expect(c[c.length - 1]).toEqual({ n: 3, l: 1, electrons: 6 });
  });

  it('K: [Ar] 4s¹ (sin 3d primero)', () => {
    const c = electronConfig(19);
    const last = c[c.length - 1];
    expect(last).toEqual({ n: 4, l: 0, electrons: 1 });
  });

  it('la suma de electrones es igual a Z para todos los elementos', () => {
    for (let Z = 1; Z <= 118; Z++) {
      const c = electronConfig(Z);
      const total = c.reduce((s, sub) => s + sub.electrons, 0);
      expect(total).toBe(Z);
    }
  });

  it('ninguna subshell excede su capacidad 2(2l+1)', () => {
    for (let Z = 1; Z <= 118; Z++) {
      for (const sub of electronConfig(Z)) {
        const max = 2 * (2 * sub.l + 1);
        expect(sub.electrons).toBeLessThanOrEqual(max);
        expect(sub.electrons).toBeGreaterThan(0);
      }
    }
  });
});

describe('electronConfig — excepciones conocidas', () => {
  it('Cr (24): 3d⁵ 4s¹ (no 3d⁴ 4s²)', () => {
    const c = electronConfig(24);
    const d3 = c.find((s) => s.n === 3 && s.l === 2);
    const s4 = c.find((s) => s.n === 4 && s.l === 0);
    expect(d3?.electrons).toBe(5);
    expect(s4?.electrons).toBe(1);
  });

  it('Cu (29): 3d¹⁰ 4s¹', () => {
    const c = electronConfig(29);
    const d3 = c.find((s) => s.n === 3 && s.l === 2);
    const s4 = c.find((s) => s.n === 4 && s.l === 0);
    expect(d3?.electrons).toBe(10);
    expect(s4?.electrons).toBe(1);
  });

  it('Pd (46): 4d¹⁰ sin 5s', () => {
    const c = electronConfig(46);
    const d4 = c.find((s) => s.n === 4 && s.l === 2);
    const s5 = c.find((s) => s.n === 5 && s.l === 0);
    expect(d4?.electrons).toBe(10);
    expect(s5).toBeUndefined();
  });

  it('Au (79): [Xe] 4f¹⁴ 5d¹⁰ 6s¹', () => {
    const c = electronConfig(79);
    const s6 = c.find((s) => s.n === 6 && s.l === 0);
    const d5 = c.find((s) => s.n === 5 && s.l === 2);
    const f4 = c.find((s) => s.n === 4 && s.l === 3);
    expect(s6?.electrons).toBe(1);
    expect(d5?.electrons).toBe(10);
    expect(f4?.electrons).toBe(14);
  });

  it('U (92): [Rn] 5f³ 6d¹ 7s²', () => {
    const c = electronConfig(92);
    const f5 = c.find((s) => s.n === 5 && s.l === 3);
    const d6 = c.find((s) => s.n === 6 && s.l === 2);
    const s7 = c.find((s) => s.n === 7 && s.l === 0);
    expect(f5?.electrons).toBe(3);
    expect(d6?.electrons).toBe(1);
    expect(s7?.electrons).toBe(2);
  });
});

describe('configString y configCompact', () => {
  it('configString C → 1s² 2s² 2p²', () => {
    expect(configString(electronConfig(6))).toBe('1s² 2s² 2p²');
  });

  it('configCompact Fe → [Ar] 3d⁶ 4s²', () => {
    expect(configCompact(26)).toMatch(/\[Ar\]/);
  });

  it('configCompact Au → [Xe] ...', () => {
    expect(configCompact(79)).toMatch(/\[Xe\]/);
  });

  it('configCompact H → sin gas noble', () => {
    expect(configCompact(1)).toBe('1s¹');
  });
});

// ═══════════════════════════════════════════════════════════════
// Slater's effective Z
// ═══════════════════════════════════════════════════════════════

describe('effectiveZ — Slater', () => {
  it('H 1s: Z_eff = 1 (electrón solo, sin apantallamiento)', () => {
    expect(effectiveZ(1, 1, 0)).toBeCloseTo(1, 3);
  });

  it('He 1s: Z_eff = 1.70 (σ=0.30 del otro 1s)', () => {
    expect(effectiveZ(2, 1, 0)).toBeCloseTo(1.70, 2);
  });

  it('Li 2s: Z_eff ≈ 1.30 (1.00+1.00+0.00 shielding — realmente σ=2·0.85=1.70)', () => {
    // Slater: dos 1s apantallan 0.85 cada uno. Z=3. σ=1.7. Z_eff=1.3
    expect(effectiveZ(3, 2, 0)).toBeCloseTo(1.30, 2);
  });

  it('C 2s: Slater da Z_eff ≈ 3.25', () => {
    // C: 1s² 2s² 2p². Para 2s: otros 2s (1)·0.35 + 2p (2)·0.35 + 1s (2)·0.85 = 0.35+0.70+1.70 = 2.75
    // Z_eff = 6 - 2.75 = 3.25
    expect(effectiveZ(6, 2, 0)).toBeCloseTo(3.25, 2);
  });

  it('Z_eff crece con Z para mismos orbitales', () => {
    const h1s = effectiveZ(1, 1, 0);
    const he1s = effectiveZ(2, 1, 0);
    const li1s = effectiveZ(3, 1, 0);
    expect(he1s).toBeGreaterThan(h1s);
    expect(li1s).toBeGreaterThan(he1s);
  });

  it('nunca devuelve Z_eff ≤ 0', () => {
    for (let Z = 1; Z <= 118; Z++) {
      const c = electronConfig(Z);
      for (const sub of c) {
        const zeff = effectiveZ(Z, sub.n, sub.l);
        expect(zeff).toBeGreaterThan(0);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Valencia
// ═══════════════════════════════════════════════════════════════

describe('valenceElectrons', () => {
  it('H: 1', () => {
    expect(valenceElectrons(elementByZ(1)!)).toBe(1);
  });

  it('He: 2', () => {
    expect(valenceElectrons(elementByZ(2)!)).toBe(2);
  });

  it('Na: 1 (alcalino)', () => {
    expect(valenceElectrons(elementByZ(11)!)).toBe(1);
  });

  it('C: 4', () => {
    expect(valenceElectrons(elementByZ(6)!)).toBe(4);
  });

  it('O: 6', () => {
    expect(valenceElectrons(elementByZ(8)!)).toBe(6);
  });

  it('Fe: incluye 3d⁶ 4s² → 8', () => {
    expect(valenceElectrons(elementByZ(26)!)).toBe(8);
  });
});

// ═══════════════════════════════════════════════════════════════
// Sanity: datos físicos coherentes
// ═══════════════════════════════════════════════════════════════

describe('datos físicos', () => {
  it('masas atómicas positivas y en rango [1, 300]', () => {
    for (const e of PERIODIC_TABLE) {
      expect(e.mass).toBeGreaterThan(0);
      expect(e.mass).toBeLessThan(300);
    }
  });

  it('electronegatividad cuando está definida está en [0.5, 4.0]', () => {
    for (const e of PERIODIC_TABLE) {
      if (e.electronegativity !== null) {
        expect(e.electronegativity).toBeGreaterThan(0.5);
        expect(e.electronegativity).toBeLessThanOrEqual(4.0);
      }
    }
  });

  it('F es el más electronegativo (≈3.98)', () => {
    const f = elementByZ(9)!;
    const maxEN = PERIODIC_TABLE.reduce((m, e) =>
      (e.electronegativity !== null && e.electronegativity > m ? e.electronegativity : m), 0);
    expect(f.electronegativity).toBe(maxEN);
  });

  it('colores CPK en formato #RRGGBB', () => {
    for (const e of PERIODIC_TABLE) {
      expect(e.color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});
