/**
 * Tests de elementos y masa molar.
 */
import { describe, it, expect } from 'vitest';
import { ELEMENTS, ELEMENT_LIST, CONSTANTS, molarMass } from '../elements';

describe('ELEMENTS dataset integrity', () => {
  it('contiene los elementos esenciales de química general', () => {
    const essentials = ['H', 'C', 'N', 'O', 'Na', 'Mg', 'Cl', 'S', 'P', 'K', 'Ca', 'Fe'];
    for (const sym of essentials) {
      expect(ELEMENTS[sym]).toBeDefined();
    }
  });

  it('cada elemento tiene todos los campos con valores sensatos', () => {
    for (const el of ELEMENT_LIST) {
      expect(el.Z).toBeGreaterThan(0);
      expect(el.Z).toBeLessThan(120);
      expect(el.symbol).toMatch(/^[A-Z][a-z]?$/);
      expect(el.name).toBeTruthy();
      expect(el.mass).toBeGreaterThan(0);
      expect(el.mass).toBeLessThan(300);
      expect(el.covalentRadius).toBeGreaterThan(20);
      expect(el.covalentRadius).toBeLessThan(250);
      expect(el.vdwRadius).toBeGreaterThan(el.covalentRadius);
      expect(el.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(el.electronegativity).toBeGreaterThanOrEqual(0);
      expect(el.electronegativity).toBeLessThan(5);
    }
  });

  it('números atómicos son únicos', () => {
    const zSet = new Set<number>();
    for (const el of ELEMENT_LIST) {
      expect(zSet.has(el.Z)).toBe(false);
      zSet.add(el.Z);
    }
  });

  it('símbolos son únicos y coinciden con la clave', () => {
    for (const [key, el] of Object.entries(ELEMENTS)) {
      expect(el.symbol).toBe(key);
    }
  });

  it('ELEMENT_LIST está ordenado por número atómico', () => {
    for (let i = 1; i < ELEMENT_LIST.length; i++) {
      expect(ELEMENT_LIST[i].Z).toBeGreaterThan(ELEMENT_LIST[i - 1].Z);
    }
  });

  it('F (flúor) es el más electronegativo en el set', () => {
    const maxEN = Math.max(...ELEMENT_LIST.map((e) => e.electronegativity));
    expect(ELEMENTS.F.electronegativity).toBe(maxEN);
  });
});

describe('CONSTANTS físicas', () => {
  it('R ≈ 8.314 J/(mol·K)', () => {
    expect(CONSTANTS.R).toBeCloseTo(8.314, 2);
  });
  it('NA ≈ 6.022e23', () => {
    expect(CONSTANTS.NA).toBeCloseTo(6.022e23, -20);
  });
  it('T0 = 273.15 K', () => {
    expect(CONSTANTS.T0).toBeCloseTo(273.15, 5);
  });
  it('kB·NA = R (relación termodinámica fundamental)', () => {
    expect(CONSTANTS.kB * CONSTANTS.NA).toBeCloseTo(CONSTANTS.R, 2);
  });
});

describe('molarMass', () => {
  it('H2O ≈ 18.015 g/mol', () => {
    expect(molarMass('H2O')).toBeCloseTo(18.015, 2);
  });

  it('CO2 ≈ 44.009 g/mol', () => {
    expect(molarMass('CO2')).toBeCloseTo(44.009, 2);
  });

  it('NH3 ≈ 17.031 g/mol', () => {
    expect(molarMass('NH3')).toBeCloseTo(17.031, 2);
  });

  it('NaCl ≈ 58.44 g/mol', () => {
    expect(molarMass('NaCl')).toBeCloseTo(58.44, 1);
  });

  it('CH4 ≈ 16.043 g/mol', () => {
    expect(molarMass('CH4')).toBeCloseTo(16.043, 2);
  });

  it('H2SO4 ≈ 98.08 g/mol', () => {
    expect(molarMass('H2SO4')).toBeCloseTo(98.08, 1);
  });

  it('maneja un átomo solo (Fe)', () => {
    expect(molarMass('Fe')).toBeCloseTo(55.845, 2);
  });

  it('maneja símbolos de dos letras (Cl, Br)', () => {
    expect(molarMass('HCl')).toBeCloseTo(36.46, 1);
    expect(molarMass('HBr')).toBeCloseTo(80.91, 1);
  });

  it('string vacía → 0', () => {
    expect(molarMass('')).toBe(0);
  });

  it('ignora elementos desconocidos sin throw', () => {
    expect(() => molarMass('Xx')).not.toThrow();
  });

  it('glucosa C6H12O6 ≈ 180.16 g/mol', () => {
    expect(molarMass('C6H12O6')).toBeCloseTo(180.16, 1);
  });

  it('etanol C2H5OH ≈ 46.07 g/mol (parser acumula átomos repetidos)', () => {
    expect(molarMass('C2H6O')).toBeCloseTo(46.07, 1);
  });
});
