/**
 * ══════════════════════════════════════════════════════════════════════
 * ⚗️  ChemLab — Tabla Periódica (datos físicos)
 * ══════════════════════════════════════════════════════════════════════
 *
 * Datos de los ~30 elementos más comunes en química general y orgánica.
 * Fuentes:
 *   [1] Cordero et al. "Covalent radii revisited", Dalton Trans., 2008.
 *   [2] IUPAC 2021 Atomic Weights.
 *   [3] CPK coloring — Jmol/PyMOL convention (RasMol extended).
 */

export interface Element {
  Z: number;              // Número atómico
  symbol: string;         // "H", "He", "C"...
  name: string;           // nombre en español
  mass: number;           // masa atómica [g/mol]
  covalentRadius: number; // radio covalente [pm] — Cordero 2008
  vdwRadius: number;      // radio de van der Waals [pm] — Bondi 1964
  color: string;          // color CPK [hex]
  valence: number;        // valencia típica
  electronegativity: number; // Pauling
}

export const ELEMENTS: Record<string, Element> = {
  H:  { Z: 1,  symbol: 'H',  name: 'Hidrógeno',  mass: 1.008,   covalentRadius: 31,  vdwRadius: 120, color: '#FFFFFF', valence: 1, electronegativity: 2.20 },
  He: { Z: 2,  symbol: 'He', name: 'Helio',      mass: 4.0026,  covalentRadius: 28,  vdwRadius: 140, color: '#D9FFFF', valence: 0, electronegativity: 0    },
  Li: { Z: 3,  symbol: 'Li', name: 'Litio',      mass: 6.94,    covalentRadius: 128, vdwRadius: 182, color: '#CC80FF', valence: 1, electronegativity: 0.98 },
  Be: { Z: 4,  symbol: 'Be', name: 'Berilio',    mass: 9.0122,  covalentRadius: 96,  vdwRadius: 153, color: '#C2FF00', valence: 2, electronegativity: 1.57 },
  B:  { Z: 5,  symbol: 'B',  name: 'Boro',       mass: 10.81,   covalentRadius: 84,  vdwRadius: 192, color: '#FFB5B5', valence: 3, electronegativity: 2.04 },
  C:  { Z: 6,  symbol: 'C',  name: 'Carbono',    mass: 12.011,  covalentRadius: 76,  vdwRadius: 170, color: '#505050', valence: 4, electronegativity: 2.55 },
  N:  { Z: 7,  symbol: 'N',  name: 'Nitrógeno',  mass: 14.007,  covalentRadius: 71,  vdwRadius: 155, color: '#3050F8', valence: 3, electronegativity: 3.04 },
  O:  { Z: 8,  symbol: 'O',  name: 'Oxígeno',    mass: 15.999,  covalentRadius: 66,  vdwRadius: 152, color: '#FF0D0D', valence: 2, electronegativity: 3.44 },
  F:  { Z: 9,  symbol: 'F',  name: 'Flúor',      mass: 18.998,  covalentRadius: 57,  vdwRadius: 147, color: '#90E050', valence: 1, electronegativity: 3.98 },
  Ne: { Z: 10, symbol: 'Ne', name: 'Neón',       mass: 20.180,  covalentRadius: 58,  vdwRadius: 154, color: '#B3E3F5', valence: 0, electronegativity: 0    },
  Na: { Z: 11, symbol: 'Na', name: 'Sodio',      mass: 22.990,  covalentRadius: 166, vdwRadius: 227, color: '#AB5CF2', valence: 1, electronegativity: 0.93 },
  Mg: { Z: 12, symbol: 'Mg', name: 'Magnesio',   mass: 24.305,  covalentRadius: 141, vdwRadius: 173, color: '#8AFF00', valence: 2, electronegativity: 1.31 },
  Al: { Z: 13, symbol: 'Al', name: 'Aluminio',   mass: 26.982,  covalentRadius: 121, vdwRadius: 184, color: '#BFA6A6', valence: 3, electronegativity: 1.61 },
  Si: { Z: 14, symbol: 'Si', name: 'Silicio',    mass: 28.085,  covalentRadius: 111, vdwRadius: 210, color: '#F0C8A0', valence: 4, electronegativity: 1.90 },
  P:  { Z: 15, symbol: 'P',  name: 'Fósforo',    mass: 30.974,  covalentRadius: 107, vdwRadius: 180, color: '#FF8000', valence: 5, electronegativity: 2.19 },
  S:  { Z: 16, symbol: 'S',  name: 'Azufre',     mass: 32.06,   covalentRadius: 105, vdwRadius: 180, color: '#FFFF30', valence: 2, electronegativity: 2.58 },
  Cl: { Z: 17, symbol: 'Cl', name: 'Cloro',      mass: 35.45,   covalentRadius: 102, vdwRadius: 175, color: '#1FF01F', valence: 1, electronegativity: 3.16 },
  Ar: { Z: 18, symbol: 'Ar', name: 'Argón',      mass: 39.948,  covalentRadius: 106, vdwRadius: 188, color: '#80D1E3', valence: 0, electronegativity: 0    },
  K:  { Z: 19, symbol: 'K',  name: 'Potasio',    mass: 39.098,  covalentRadius: 203, vdwRadius: 275, color: '#8F40D4', valence: 1, electronegativity: 0.82 },
  Ca: { Z: 20, symbol: 'Ca', name: 'Calcio',     mass: 40.078,  covalentRadius: 176, vdwRadius: 231, color: '#3DFF00', valence: 2, electronegativity: 1.00 },
  Fe: { Z: 26, symbol: 'Fe', name: 'Hierro',     mass: 55.845,  covalentRadius: 132, vdwRadius: 194, color: '#E06633', valence: 3, electronegativity: 1.83 },
  Cu: { Z: 29, symbol: 'Cu', name: 'Cobre',      mass: 63.546,  covalentRadius: 132, vdwRadius: 140, color: '#C88033', valence: 2, electronegativity: 1.90 },
  Zn: { Z: 30, symbol: 'Zn', name: 'Zinc',       mass: 65.38,   covalentRadius: 122, vdwRadius: 139, color: '#7D80B0', valence: 2, electronegativity: 1.65 },
  Br: { Z: 35, symbol: 'Br', name: 'Bromo',      mass: 79.904,  covalentRadius: 120, vdwRadius: 185, color: '#A62929', valence: 1, electronegativity: 2.96 },
  I:  { Z: 53, symbol: 'I',  name: 'Yodo',       mass: 126.90,  covalentRadius: 139, vdwRadius: 198, color: '#940094', valence: 1, electronegativity: 2.66 },
};

export const ELEMENT_LIST: Element[] = Object.values(ELEMENTS).sort((a, b) => a.Z - b.Z);

/** Constantes físicas útiles en química */
export const CONSTANTS = {
  R:  8.314462618,   // Constante de gas [J/(mol·K)]
  NA: 6.02214076e23, // Avogadro [1/mol]
  kB: 1.380649e-23,  // Boltzmann [J/K]
  h:  6.62607015e-34,// Planck [J·s]
  F:  96485.33212,   // Faraday [C/mol]
  T0: 273.15,        // 0 °C en Kelvin
};

/** Masa molar de una fórmula — ej. mass("H2O") = 18.015 */
export function molarMass(formula: string): number {
  const tokens = formula.match(/([A-Z][a-z]?)(\d*)/g) ?? [];
  let sum = 0;
  for (const tok of tokens) {
    if (!tok) continue;
    const m = tok.match(/([A-Z][a-z]?)(\d*)/);
    if (!m) continue;
    const sym = m[1];
    const n = m[2] ? parseInt(m[2], 10) : 1;
    const el = ELEMENTS[sym];
    if (!el) continue;
    sum += el.mass * n;
  }
  return sum;
}
