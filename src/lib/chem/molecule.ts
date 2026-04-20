/**
 * ══════════════════════════════════════════════════════════════════════
 * ⚗️  ChemLab — Moléculas (estructura + catálogo)
 * ══════════════════════════════════════════════════════════════════════
 *
 * Estructura de datos de molécula: átomos posicionados en 3D + enlaces.
 * Geometrías aproximadas (no FF relajado) pero visualmente correctas —
 * suficientes para educación y demostración. Para geometría rigurosa
 * habría que acoplar un campo de fuerzas (UFF/MMFF) — pendiente.
 *
 * Ángulos y distancias de referencia:
 *   [M1] NIST Computational Chemistry Comparison and Benchmark Database.
 *   [M2] Lide, D.R. (ed.). "CRC Handbook of Chemistry and Physics", 97th ed.
 *   [M3] Allen, F.H. et al. "Tables of bond lengths determined by X-ray..."
 *        J. Chem. Soc. Perkin Trans. 2, S1–S19 (1987).
 */

import { ELEMENTS, molarMass } from './elements';

export interface Atom {
  element: string;              // "H", "C"...
  position: [number, number, number]; // Å (angstroms)
}

export interface Bond {
  a: number;   // índice del átomo a
  b: number;   // índice del átomo b
  order: 1 | 2 | 3; // orden de enlace: sencillo, doble, triple
}

export interface Molecule {
  name: string;        // "agua", "dióxido de carbono"
  formula: string;     // "H2O"
  atoms: Atom[];
  bonds: Bond[];
}

/** Masa molar de la molécula [g/mol] */
export function moleculeMass(m: Molecule): number {
  return molarMass(m.formula);
}

/** Bounding sphere aproximado en Å — útil para layout de escena */
export function boundingRadius(m: Molecule): number {
  let maxR = 0;
  for (const a of m.atoms) {
    const r = Math.hypot(a.position[0], a.position[1], a.position[2]);
    maxR = Math.max(maxR, r);
  }
  const el = m.atoms[0] ? ELEMENTS[m.atoms[0].element] : undefined;
  return maxR + (el ? el.vdwRadius / 100 : 1.5);
}

/** Centrar molécula en origen (útil antes de colocar en escena) */
export function recenter(m: Molecule): Molecule {
  const n = m.atoms.length;
  if (n === 0) return m;
  let cx = 0, cy = 0, cz = 0;
  for (const a of m.atoms) {
    cx += a.position[0];
    cy += a.position[1];
    cz += a.position[2];
  }
  cx /= n; cy /= n; cz /= n;
  return {
    ...m,
    atoms: m.atoms.map((a) => ({
      element: a.element,
      position: [a.position[0] - cx, a.position[1] - cy, a.position[2] - cz] as [number, number, number],
    })),
  };
}

// ═══════════════════════════════════════════════════════════════
// CATÁLOGO DE MOLÉCULAS PRECARGADAS
// ═══════════════════════════════════════════════════════════════
//
// Geometrías extraídas de datos experimentales (distancias en Å,
// ángulos en grados). Las posiciones se computan analíticamente aquí
// para que queden claras y modificables sin archivos externos.

// --- helpers de construcción de geometría ---------------------------------

const DEG = Math.PI / 180;

function rotY(p: [number, number, number], angle: number): [number, number, number] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
}

// --- moléculas básicas ----------------------------------------------------

/** H₂ — enlace covalente simple, d=0.74 Å. Ref [M2] */
export const H2: Molecule = {
  name: 'Hidrógeno',
  formula: 'H2',
  atoms: [
    { element: 'H', position: [-0.37, 0, 0] },
    { element: 'H', position: [ 0.37, 0, 0] },
  ],
  bonds: [{ a: 0, b: 1, order: 1 }],
};

/** O₂ — doble enlace, d=1.21 Å. Ref [M2] */
export const O2: Molecule = {
  name: 'Oxígeno',
  formula: 'O2',
  atoms: [
    { element: 'O', position: [-0.605, 0, 0] },
    { element: 'O', position: [ 0.605, 0, 0] },
  ],
  bonds: [{ a: 0, b: 1, order: 2 }],
};

/** N₂ — triple enlace, d=1.10 Å. Ref [M2] */
export const N2: Molecule = {
  name: 'Nitrógeno',
  formula: 'N2',
  atoms: [
    { element: 'N', position: [-0.549, 0, 0] },
    { element: 'N', position: [ 0.549, 0, 0] },
  ],
  bonds: [{ a: 0, b: 1, order: 3 }],
};

/** H₂O — ángulo HOH=104.5°, d(OH)=0.96 Å. Ref [M1] */
export const H2O: Molecule = (() => {
  const d = 0.96;
  const half = 104.5 / 2 * DEG;
  return {
    name: 'Agua',
    formula: 'H2O',
    atoms: [
      { element: 'O', position: [0, 0, 0] },
      { element: 'H', position: [d * Math.sin(half), -d * Math.cos(half), 0] },
      { element: 'H', position: [-d * Math.sin(half), -d * Math.cos(half), 0] },
    ],
    bonds: [
      { a: 0, b: 1, order: 1 },
      { a: 0, b: 2, order: 1 },
    ],
  };
})();

/** H₂O₂ — peróxido, torsión diedro ≈111°, d(OO)=1.47 Å, d(OH)=0.97 Å */
export const H2O2: Molecule = (() => {
  const dOO = 1.47;
  const dOH = 0.97;
  const angOOH = 100 * DEG;
  const dihedral = 111 * DEG;
  const O1: [number, number, number] = [-dOO / 2, 0, 0];
  const O2a: [number, number, number] = [ dOO / 2, 0, 0];
  const H1: [number, number, number] = [
    O1[0] - dOH * Math.cos(angOOH),
    dOH * Math.sin(angOOH) * Math.cos(dihedral / 2),
    dOH * Math.sin(angOOH) * Math.sin(dihedral / 2),
  ];
  const H2b: [number, number, number] = [
    O2a[0] + dOH * Math.cos(angOOH),
    dOH * Math.sin(angOOH) * Math.cos(-dihedral / 2),
    dOH * Math.sin(angOOH) * Math.sin(-dihedral / 2),
  ];
  return {
    name: 'Peróxido de hidrógeno',
    formula: 'H2O2',
    atoms: [
      { element: 'O', position: O1 },
      { element: 'O', position: O2a },
      { element: 'H', position: H1 },
      { element: 'H', position: H2b },
    ],
    bonds: [
      { a: 0, b: 1, order: 1 },
      { a: 0, b: 2, order: 1 },
      { a: 1, b: 3, order: 1 },
    ],
  };
})();

/** NH₃ — pirámide trigonal, HNH=107°, d(NH)=1.01 Å. Ref [M1]
 *
 * Derivación del ángulo axial θ (ángulo de cada N-H con el eje de simetría):
 *   cos(H-N-H) = (3·cos²θ − 1) / 2     (geometría piramidal con 3 H equivalentes)
 *   ⇒  cos²θ = (2·cos(α_HNH) + 1) / 3
 * Para α=107°:  cosθ ≈ 0.372, θ ≈ 68.2° — da los 107° observados.
 */
export const NH3: Molecule = (() => {
  const d = 1.01;
  const alpha = 107 * DEG;
  const cosTheta = Math.sqrt((2 * Math.cos(alpha) + 1) / 3);
  const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
  const atoms: Atom[] = [{ element: 'N', position: [0, 0, 0] }];
  for (let i = 0; i < 3; i++) {
    const phi = (i / 3) * 2 * Math.PI;
    atoms.push({
      element: 'H',
      position: [d * sinTheta * Math.cos(phi), -d * cosTheta, d * sinTheta * Math.sin(phi)],
    });
  }
  return {
    name: 'Amoníaco',
    formula: 'NH3',
    atoms,
    bonds: [
      { a: 0, b: 1, order: 1 },
      { a: 0, b: 2, order: 1 },
      { a: 0, b: 3, order: 1 },
    ],
  };
})();

/** CO₂ — lineal, d(CO)=1.16 Å */
export const CO2: Molecule = {
  name: 'Dióxido de carbono',
  formula: 'CO2',
  atoms: [
    { element: 'C', position: [0, 0, 0] },
    { element: 'O', position: [-1.16, 0, 0] },
    { element: 'O', position: [ 1.16, 0, 0] },
  ],
  bonds: [
    { a: 0, b: 1, order: 2 },
    { a: 0, b: 2, order: 2 },
  ],
};

/** CH₄ — tetraedro, d(CH)=1.09 Å, ángulos 109.5° */
export const CH4: Molecule = (() => {
  const d = 1.09;
  // Vértices de tetraedro regular
  const base: [number, number, number][] = [
    [ 1,  1,  1],
    [ 1, -1, -1],
    [-1,  1, -1],
    [-1, -1,  1],
  ];
  const norm = Math.sqrt(3);
  const atoms: Atom[] = [{ element: 'C', position: [0, 0, 0] }];
  for (const v of base) {
    atoms.push({
      element: 'H',
      position: [v[0] / norm * d, v[1] / norm * d, v[2] / norm * d],
    });
  }
  return {
    name: 'Metano',
    formula: 'CH4',
    atoms,
    bonds: [
      { a: 0, b: 1, order: 1 },
      { a: 0, b: 2, order: 1 },
      { a: 0, b: 3, order: 1 },
      { a: 0, b: 4, order: 1 },
    ],
  };
})();

/** HCl — diatómica, d=1.27 Å */
export const HCl: Molecule = {
  name: 'Ácido clorhídrico',
  formula: 'HCl',
  atoms: [
    { element: 'H',  position: [-0.635, 0, 0] },
    { element: 'Cl', position: [ 0.635, 0, 0] },
  ],
  bonds: [{ a: 0, b: 1, order: 1 }],
};

/** NaOH — iónica representada covalente para visualización */
export const NaOH: Molecule = {
  name: 'Hidróxido de sodio',
  formula: 'NaOH',
  atoms: [
    { element: 'Na', position: [-1.05, 0, 0] },
    { element: 'O',  position: [ 0.90, 0, 0] },
    { element: 'H',  position: [ 1.86, 0, 0] },
  ],
  bonds: [
    { a: 0, b: 1, order: 1 },
    { a: 1, b: 2, order: 1 },
  ],
};

/** NaCl — iónica, d≈2.36 Å en gas */
export const NaCl: Molecule = {
  name: 'Cloruro de sodio',
  formula: 'NaCl',
  atoms: [
    { element: 'Na', position: [-1.18, 0, 0] },
    { element: 'Cl', position: [ 1.18, 0, 0] },
  ],
  bonds: [{ a: 0, b: 1, order: 1 }],
};

/** NO₂ — angular, ONO=134°, d(NO)=1.20 Å */
export const NO2: Molecule = (() => {
  const d = 1.20;
  const half = 134 / 2 * DEG;
  return {
    name: 'Dióxido de nitrógeno',
    formula: 'NO2',
    atoms: [
      { element: 'N', position: [0, 0, 0] },
      { element: 'O', position: [ d * Math.sin(half), -d * Math.cos(half), 0] },
      { element: 'O', position: [-d * Math.sin(half), -d * Math.cos(half), 0] },
    ],
    bonds: [
      { a: 0, b: 1, order: 2 },
      { a: 0, b: 2, order: 1 },
    ],
  };
})();

/** N₂O₅ — pentóxido de dinitrógeno (simplificado como O₂N-O-NO₂ lineal) */
export const N2O5: Molecule = (() => {
  const dNO = 1.19;
  const dNObridge = 1.49;
  return {
    name: 'Pentóxido de dinitrógeno',
    formula: 'N2O5',
    atoms: [
      { element: 'O', position: [0, 0, 0] },                    // puente
      { element: 'N', position: [-dNObridge, 0, 0] },
      { element: 'N', position: [ dNObridge, 0, 0] },
      { element: 'O', position: [-dNObridge - dNO * 0.5, -dNO * 0.87, 0] },
      { element: 'O', position: [-dNObridge - dNO * 0.5,  dNO * 0.87, 0] },
      { element: 'O', position: [ dNObridge + dNO * 0.5, -dNO * 0.87, 0] },
      { element: 'O', position: [ dNObridge + dNO * 0.5,  dNO * 0.87, 0] },
    ],
    bonds: [
      { a: 0, b: 1, order: 1 },
      { a: 0, b: 2, order: 1 },
      { a: 1, b: 3, order: 2 },
      { a: 1, b: 4, order: 1 },
      { a: 2, b: 5, order: 2 },
      { a: 2, b: 6, order: 1 },
    ],
  };
})();

// Evitar uso de la variable no usada en validación TS estricta
void rotY;

/** Diccionario global para búsqueda rápida por fórmula */
export const MOLECULES: Record<string, Molecule> = {
  H2, O2, N2, H2O, H2O2, NH3, CO2, CH4, HCl, NaOH, NaCl, NO2, N2O5,
};

/** Obtener molécula por fórmula, o null si no existe */
export function getMolecule(formula: string): Molecule | null {
  return MOLECULES[formula] ?? null;
}
