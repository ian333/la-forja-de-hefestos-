/**
 * Tests de moléculas: geometría, enlaces, catálogo.
 */
import { describe, it, expect } from 'vitest';
import {
  MOLECULES,
  H2, O2, N2, H2O, H2O2, NH3, CO2, CH4, HCl, NaOH, NaCl, NO2, N2O5,
  moleculeMass,
  boundingRadius,
  recenter,
  getMolecule,
  type Molecule,
} from '../molecule';
import { ELEMENTS } from '../elements';

function distance(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function angle(
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
): number {
  // ángulo en radianes entre vectores b→a y b→c
  const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const nu = Math.hypot(u[0], u[1], u[2]);
  const nv = Math.hypot(v[0], v[1], v[2]);
  return Math.acos(dot / (nu * nv));
}

const RAD2DEG = 180 / Math.PI;

// ═══════════════════════════════════════════════════════════════
// Invariantes generales del catálogo
// ═══════════════════════════════════════════════════════════════

describe('catálogo de moléculas — invariantes', () => {
  const all: [string, Molecule][] = Object.entries(MOLECULES);

  it('cada molécula tiene al menos un átomo', () => {
    for (const [name, m] of all) {
      expect(m.atoms.length).toBeGreaterThan(0);
    }
  });

  it('cada átomo referencia un elemento válido', () => {
    for (const [name, m] of all) {
      for (const atom of m.atoms) {
        expect(ELEMENTS[atom.element]).toBeDefined();
      }
    }
  });

  it('cada átomo tiene coordenadas finitas', () => {
    for (const [name, m] of all) {
      for (const atom of m.atoms) {
        expect(atom.position).toHaveLength(3);
        for (const c of atom.position) {
          expect(Number.isFinite(c)).toBe(true);
        }
      }
    }
  });

  it('cada bond referencia índices válidos (0 ≤ a,b < atoms.length, a≠b)', () => {
    for (const [name, m] of all) {
      for (const bond of m.bonds) {
        expect(bond.a).toBeGreaterThanOrEqual(0);
        expect(bond.b).toBeGreaterThanOrEqual(0);
        expect(bond.a).toBeLessThan(m.atoms.length);
        expect(bond.b).toBeLessThan(m.atoms.length);
        expect(bond.a).not.toBe(bond.b);
      }
    }
  });

  it('bond.order ∈ {1, 2, 3}', () => {
    for (const [name, m] of all) {
      for (const bond of m.bonds) {
        expect([1, 2, 3]).toContain(bond.order);
      }
    }
  });

  it('no hay enlaces duplicados (a,b) ni (b,a) en la misma molécula', () => {
    for (const [name, m] of all) {
      const seen = new Set<string>();
      for (const bond of m.bonds) {
        const key = [bond.a, bond.b].sort().join('-');
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  it('distancia interatómica en cada bond es razonable (0.5–3.5 Å)', () => {
    for (const [name, m] of all) {
      for (const bond of m.bonds) {
        const d = distance(m.atoms[bond.a].position, m.atoms[bond.b].position);
        expect(d).toBeGreaterThan(0.5);
        expect(d).toBeLessThan(3.5);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Geometrías específicas — validación contra literatura
// ═══════════════════════════════════════════════════════════════

describe('H₂ — geometría', () => {
  it('distancia H-H ≈ 0.74 Å', () => {
    const d = distance(H2.atoms[0].position, H2.atoms[1].position);
    expect(d).toBeCloseTo(0.74, 2);
  });
  it('es diatómica con un enlace simple', () => {
    expect(H2.atoms).toHaveLength(2);
    expect(H2.bonds).toHaveLength(1);
    expect(H2.bonds[0].order).toBe(1);
  });
});

describe('O₂ — geometría', () => {
  it('distancia O=O ≈ 1.21 Å', () => {
    const d = distance(O2.atoms[0].position, O2.atoms[1].position);
    expect(d).toBeCloseTo(1.21, 2);
  });
  it('tiene doble enlace', () => {
    expect(O2.bonds[0].order).toBe(2);
  });
});

describe('N₂ — geometría', () => {
  it('distancia N≡N ≈ 1.10 Å', () => {
    const d = distance(N2.atoms[0].position, N2.atoms[1].position);
    expect(d).toBeCloseTo(1.10, 2);
  });
  it('tiene triple enlace', () => {
    expect(N2.bonds[0].order).toBe(3);
  });
});

describe('H₂O — geometría', () => {
  it('distancia O-H ≈ 0.96 Å para ambos hidrógenos', () => {
    const d1 = distance(H2O.atoms[0].position, H2O.atoms[1].position);
    const d2 = distance(H2O.atoms[0].position, H2O.atoms[2].position);
    expect(d1).toBeCloseTo(0.96, 2);
    expect(d2).toBeCloseTo(0.96, 2);
  });

  it('ángulo H-O-H ≈ 104.5°', () => {
    const a = angle(
      H2O.atoms[1].position,
      H2O.atoms[0].position,
      H2O.atoms[2].position,
    ) * RAD2DEG;
    expect(a).toBeCloseTo(104.5, 1);
  });

  it('el oxígeno es el átomo central (mayor número de enlaces)', () => {
    const count: number[] = new Array(H2O.atoms.length).fill(0);
    for (const b of H2O.bonds) {
      count[b.a]++;
      count[b.b]++;
    }
    const maxIdx = count.indexOf(Math.max(...count));
    expect(H2O.atoms[maxIdx].element).toBe('O');
  });
});

describe('CH₄ — geometría tetraédrica', () => {
  it('4 enlaces C-H con distancia ≈ 1.09 Å', () => {
    expect(CH4.bonds).toHaveLength(4);
    for (const b of CH4.bonds) {
      const d = distance(CH4.atoms[b.a].position, CH4.atoms[b.b].position);
      expect(d).toBeCloseTo(1.09, 2);
    }
  });

  it('ángulos H-C-H ≈ 109.47° (tetraedro regular)', () => {
    // Tomar pares de H
    for (let i = 1; i < 4; i++) {
      for (let j = i + 1; j < 5; j++) {
        const a = angle(
          CH4.atoms[i].position,
          CH4.atoms[0].position,
          CH4.atoms[j].position,
        ) * RAD2DEG;
        expect(a).toBeCloseTo(109.47, 1);
      }
    }
  });
});

describe('CO₂ — geometría lineal', () => {
  it('ángulo O=C=O ≈ 180°', () => {
    const a = angle(
      CO2.atoms[1].position,
      CO2.atoms[0].position,
      CO2.atoms[2].position,
    ) * RAD2DEG;
    expect(a).toBeCloseTo(180, 1);
  });
  it('ambos enlaces son dobles', () => {
    for (const b of CO2.bonds) expect(b.order).toBe(2);
  });
});

describe('NH₃ — geometría piramidal', () => {
  it('3 enlaces N-H con distancia ≈ 1.01 Å', () => {
    expect(NH3.bonds).toHaveLength(3);
    for (const b of NH3.bonds) {
      const d = distance(NH3.atoms[b.a].position, NH3.atoms[b.b].position);
      expect(d).toBeCloseTo(1.01, 2);
    }
  });

  it('ángulo H-N-H ≈ 107°', () => {
    for (let i = 1; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const a = angle(
          NH3.atoms[i].position,
          NH3.atoms[0].position,
          NH3.atoms[j].position,
        ) * RAD2DEG;
        expect(a).toBeCloseTo(107, 2);
      }
    }
  });

  it('NO es plana (no todos los H en el mismo plano que N)', () => {
    // Verificar que z de al menos un H sea distinto de otro (sale del plano de N)
    const zs = NH3.atoms.slice(1).map((a) => a.position[1]); // eje Y es "vertical" en mi construcción
    const allSame = zs.every((z) => Math.abs(z - zs[0]) < 1e-6);
    expect(allSame).toBe(true); // todos los H al mismo y < 0 → piramidal si N está en y=0
    // pero el N está en origen (y=0), los H están todos a y<0 → confirma pirámide
    expect(NH3.atoms[0].position[1]).toBe(0);
    expect(NH3.atoms[1].position[1]).toBeLessThan(0);
  });
});

describe('HCl — diatómica simple', () => {
  it('distancia H-Cl ≈ 1.27 Å', () => {
    const d = distance(HCl.atoms[0].position, HCl.atoms[1].position);
    expect(d).toBeCloseTo(1.27, 2);
  });
});

describe('H₂O₂ — peróxido', () => {
  it('tiene puente O-O', () => {
    const oxygens = H2O2.atoms
      .map((a, i) => (a.element === 'O' ? i : -1))
      .filter((i) => i >= 0);
    expect(oxygens).toHaveLength(2);
    // Debe existir un bond entre los dos oxígenos
    const hasOOBond = H2O2.bonds.some(
      (b) =>
        (b.a === oxygens[0] && b.b === oxygens[1]) ||
        (b.a === oxygens[1] && b.b === oxygens[0]),
    );
    expect(hasOOBond).toBe(true);
  });

  it('distancia O-O ≈ 1.47 Å', () => {
    const oxIndices = H2O2.atoms
      .map((a, i) => (a.element === 'O' ? i : -1))
      .filter((i) => i >= 0);
    const d = distance(H2O2.atoms[oxIndices[0]].position, H2O2.atoms[oxIndices[1]].position);
    expect(d).toBeCloseTo(1.47, 2);
  });
});

// ═══════════════════════════════════════════════════════════════
// Funciones utilitarias
// ═══════════════════════════════════════════════════════════════

describe('moleculeMass', () => {
  it('H2O ≈ 18.015 g/mol', () => {
    expect(moleculeMass(H2O)).toBeCloseTo(18.015, 2);
  });
  it('NH3 ≈ 17.031 g/mol', () => {
    expect(moleculeMass(NH3)).toBeCloseTo(17.031, 2);
  });
  it('N2O5 ≈ 108.01 g/mol', () => {
    expect(moleculeMass(N2O5)).toBeCloseTo(108.01, 1);
  });
  it('NaCl ≈ 58.44 g/mol', () => {
    expect(moleculeMass(NaCl)).toBeCloseTo(58.44, 1);
  });
});

describe('boundingRadius', () => {
  it('siempre positivo', () => {
    for (const m of Object.values(MOLECULES)) {
      expect(boundingRadius(m)).toBeGreaterThan(0);
    }
  });
  it('H₂ es más pequeño que N₂O₅', () => {
    expect(boundingRadius(H2)).toBeLessThan(boundingRadius(N2O5));
  });
});

describe('recenter', () => {
  it('coloca el centroide en el origen', () => {
    const r = recenter(CH4);
    let cx = 0, cy = 0, cz = 0;
    for (const a of r.atoms) {
      cx += a.position[0];
      cy += a.position[1];
      cz += a.position[2];
    }
    cx /= r.atoms.length;
    cy /= r.atoms.length;
    cz /= r.atoms.length;
    expect(cx).toBeCloseTo(0, 10);
    expect(cy).toBeCloseTo(0, 10);
    expect(cz).toBeCloseTo(0, 10);
  });

  it('preserva distancias interatómicas', () => {
    const r = recenter(H2O);
    const origD = distance(H2O.atoms[0].position, H2O.atoms[1].position);
    const newD = distance(r.atoms[0].position, r.atoms[1].position);
    expect(newD).toBeCloseTo(origD, 10);
  });

  it('preserva enlaces', () => {
    const r = recenter(CH4);
    expect(r.bonds).toEqual(CH4.bonds);
  });
});

describe('getMolecule', () => {
  it('encuentra H2O por fórmula', () => {
    expect(getMolecule('H2O')).toBe(H2O);
  });
  it('retorna null para fórmula desconocida', () => {
    expect(getMolecule('XYZ')).toBeNull();
  });
});
