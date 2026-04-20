/**
 * ══════════════════════════════════════════════════════════════════════
 *  quantum/molecular-orbitals — LCAO: átomos combinándose en moléculas
 * ══════════════════════════════════════════════════════════════════════
 *
 * Combinación Lineal de Orbitales Atómicos (LCAO):
 *
 *     ψ_MO = Σ cᵢ · φᵢ
 *
 * Cada orbital molecular (MO) es una suma ponderada de orbitales
 * atómicos centrados en distintos núcleos. Los coeficientes cᵢ son
 * positivos para "enlazante" (las ondas se suman en la región
 * internuclear — enlace) y opuestos en signo para "antienlazante"
 * (las ondas se cancelan en la mitad — nodo → antienlace).
 *
 * Para H₂ (ejemplo canónico):
 *     ψ_σ  = N_b · (1s_A + 1s_B)   bonding  → 2 e⁻
 *     ψ_σ* = N_a · (1s_A − 1s_B)   antibonding → 0 e⁻
 *
 * En esta capa NO resolvemos Hartree-Fock ni DFT — usamos coeficientes
 * precalculados o aproximación mínima de LCAO con Slater-Z efectiva.
 * Suficiente para visualización cualitativa y enseñanza; para energías
 * precisas se conecta después con un solver SCF.
 *
 * Ref [MO1] Coulson, C.A. "Valence", 2nd ed., Oxford UP, 1961 — LCAO fundacional.
 * Ref [MO2] Mulliken, R.S. "Electronic population analysis on LCAO-MO molecular
 *           wave functions", J. Chem. Phys. 23, 1833 (1955). Nobel 1966.
 * Ref [MO3] Szabo, A. & Ostlund, N.S. "Modern Quantum Chemistry: Introduction
 *           to Advanced Electronic Structure Theory", Dover, 1996.
 * Ref [MO4] Levine, I.N. "Quantum Chemistry", 7th ed., Pearson, 2014. Cap. 13.
 */

import { ORBITALS, sampleOrbital, type OrbitalKey, type SamplePoint } from './orbitals';

// ═══════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════

export interface AtomInMolecule {
  element: string;
  /** Número atómico para etiquetado visual */
  Z: number;
  /** Posición en bohrs (1 bohr ≈ 0.529 Å) */
  position: [number, number, number];
}

export interface LCAOCoefficient {
  /** Índice dentro de Molecule3D.atoms */
  atomIndex: number;
  /** Qué orbital atómico: '1s', '2px', etc. */
  orbitalKey: OrbitalKey;
  /** Z efectiva para ese orbital atómico (Slater-apantallada). Controla el tamaño. */
  Zeff: number;
  /** Coeficiente en la combinación lineal (puede ser negativo) */
  coefficient: number;
}

export type MOSymmetry = 'bonding' | 'antibonding' | 'nonbonding';

export interface MolecularOrbital {
  name: string;           // 'σ1s', 'σ*1s', 'π2p', 'n' (lone pair), ...
  occupancy: number;      // 0, 1, o 2
  symmetry: MOSymmetry;
  /** Energía relativa [eV] — para ordenar en diagrama de MOs */
  energy: number;
  coefficients: LCAOCoefficient[];
}

export interface Molecule3D {
  name: string;
  formula: string;        // 'H₂', 'HeH⁺', etc.
  atoms: AtomInMolecule[];
  mos: MolecularOrbital[];
  /** Longitud de enlace típica [bohr] — para referencia */
  bondLength?: number;
  /** Breve descripción */
  description?: string;
}

// ═══════════════════════════════════════════════════════════════
// EVALUACIÓN DE LA ONDA MOLECULAR
// ═══════════════════════════════════════════════════════════════

/**
 * ψ_MO(r) = Σ cᵢ · φᵢ(r − r_atom_i)
 *
 * Evalúa la función de onda del MO en un punto espacial (x, y, z) en bohrs.
 */
export function psiMO(
  x: number, y: number, z: number,
  mo: MolecularOrbital,
  atoms: AtomInMolecule[],
): number {
  let sum = 0;
  for (const coef of mo.coefficients) {
    const atom = atoms[coef.atomIndex];
    if (!atom) continue;
    const orbital = ORBITALS[coef.orbitalKey];
    if (!orbital) continue;
    const dx = x - atom.position[0];
    const dy = y - atom.position[1];
    const dz = z - atom.position[2];
    sum += coef.coefficient * orbital.psi(dx, dy, dz, coef.Zeff);
  }
  return sum;
}

/**
 * Densidad electrónica total ρ(r) = Σ n_i · |ψ_i|² (sobre MOs ocupados).
 * Lo que el observador "ve" — la nube electrónica completa de la molécula.
 */
export function electronDensity(
  x: number, y: number, z: number,
  molecule: Molecule3D,
): number {
  let rho = 0;
  for (const mo of molecule.mos) {
    if (mo.occupancy === 0) continue;
    const psi = psiMO(x, y, z, mo, molecule.atoms);
    rho += mo.occupancy * psi * psi;
  }
  return rho;
}

// ═══════════════════════════════════════════════════════════════
// MUESTREO POR REJECTION — análogo a sampleOrbital pero molecular
// ═══════════════════════════════════════════════════════════════

export interface MoleculeSample extends SamplePoint {
  /** Índice del MO que domina la densidad en este punto (para colorear) */
  dominantMOIndex: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Tamaño de la caja de muestreo: engloba a todos los átomos + margen.
 */
function samplingExtent(molecule: Molecule3D): number {
  let maxDist = 4;
  for (const a of molecule.atoms) {
    const d = Math.hypot(a.position[0], a.position[1], a.position[2]);
    if (d + 6 > maxDist) maxDist = d + 6;
  }
  return maxDist;
}

/**
 * Muestrea N puntos distribuidos según la densidad electrónica total.
 * Opcionalmente restringe a un subconjunto de MOs visibles.
 *
 * Cada punto incluye `dominantMOIndex` para que el renderer lo pueda
 * colorear por MO — ver lóbulos bonding vs antibonding en colores
 * distintos.
 */
export function sampleMolecule(
  molecule: Molecule3D,
  nPoints: number,
  seed = 42,
  visibleMOs?: number[],
): MoleculeSample[] {
  const moIndices = visibleMOs ??
    molecule.mos.map((_, i) => i).filter((i) => molecule.mos[i].occupancy > 0);
  if (moIndices.length === 0) return [];

  const L = samplingExtent(molecule);
  const rng = mulberry32(seed);

  // Estimar densidad máxima con muestreo aleatorio rápido
  let rhoMax = 0;
  for (let i = 0; i < 8000; i++) {
    const x = (rng() * 2 - 1) * L;
    const y = (rng() * 2 - 1) * L;
    const z = (rng() * 2 - 1) * L;
    let rho = 0;
    for (const mi of moIndices) {
      const mo = molecule.mos[mi];
      if (mo.occupancy === 0) continue;
      const psi = psiMO(x, y, z, mo, molecule.atoms);
      rho += mo.occupancy * psi * psi;
    }
    if (rho > rhoMax) rhoMax = rho;
  }
  if (rhoMax === 0) return [];

  const out: MoleculeSample[] = [];
  const maxAttempts = nPoints * 400;
  let attempts = 0;

  while (out.length < nPoints && attempts < maxAttempts) {
    const x = (rng() * 2 - 1) * L;
    const y = (rng() * 2 - 1) * L;
    const z = (rng() * 2 - 1) * L;

    // Computar contribución por MO; rastrear el dominante
    let totalRho = 0;
    let dominantMO = moIndices[0];
    let dominantRho = 0;
    let dominantPsi = 0;

    for (const mi of moIndices) {
      const mo = molecule.mos[mi];
      if (mo.occupancy === 0) continue;
      const psi = psiMO(x, y, z, mo, molecule.atoms);
      const rho = mo.occupancy * psi * psi;
      totalRho += rho;
      if (rho > dominantRho) {
        dominantRho = rho;
        dominantMO = mi;
        dominantPsi = psi;
      }
    }

    const prob = totalRho / rhoMax;
    if (prob > 1) {
      rhoMax = totalRho; // actualizar max si encontramos uno mayor
    }
    const probCapped = Math.min(1, prob);

    if (rng() < probCapped) {
      out.push({
        x, y, z,
        sign: dominantPsi >= 0 ? 1 : -1,
        density: probCapped,
        dominantMOIndex: dominantMO,
      });
    }
    attempts++;
  }

  return out;
}

// ═══════════════════════════════════════════════════════════════
// CONSTRUCCIÓN: diatómicas homonucleares y heteronucleares
// ═══════════════════════════════════════════════════════════════

/**
 * Construye una diatómica con MOs σ y σ* a partir de 1s.
 * Las posiciones se sitúan simétricamente sobre el eje X.
 *
 * Para H₂ (ambos Z=1): MO bonding normalizado ≈ 0.548·(1s_A + 1s_B)
 * usando S ≈ 0.753 en R=1.4 bohr. Antibonding ≈ 1.195·(1s_A - 1s_B).
 *
 * Para asimetría (p.ej. HeH⁺, Z_A ≠ Z_B): el átomo con mayor Z atrae
 * más al electrón, así que el MO bonding tiene mayor coeficiente en él.
 */
export function buildDiatomic1s(options: {
  name: string;
  formula: string;
  elementA: string; elementB: string;
  Za: number; Zb: number;
  valenceElectrons: number;   // 1 (H₂⁺), 2 (H₂, HeH⁺), 4 (He₂ hipotético)
  bondLength: number;          // bohr
  description?: string;
}): Molecule3D {
  const { name, formula, elementA, elementB, Za, Zb, valenceElectrons, bondLength } = options;
  const R = bondLength;
  const atoms: AtomInMolecule[] = [
    { element: elementA, Z: Za, position: [-R / 2, 0, 0] },
    { element: elementB, Z: Zb, position: [ R / 2, 0, 0] },
  ];

  // Para Za ≠ Zb: el MO bonding está polarizado hacia el átomo más electronegativo
  // Usamos aproximación empírica: c_A / c_B ≈ (Z_A / Z_B)^(1/2)
  const ratioAB = Math.sqrt(Za / Zb);
  // Normalización aprox (asumiendo S≈0.75 entre 1s's):
  // |c_A + c_B|² + 2·c_A·c_B·S = 1
  // Con c_A = α·ratio, c_B = α: α·(ratio² + 1 + 2·ratio·S) = 1
  const S = 0.75;
  const denom = Math.sqrt(1 + ratioAB * ratioAB + 2 * ratioAB * S);
  const cA_bond = ratioAB / denom;
  const cB_bond = 1 / denom;
  // Antibonding: signo opuesto, normalizado con overlap negativo
  const denomAnti = Math.sqrt(1 + ratioAB * ratioAB - 2 * ratioAB * S);
  const cA_anti =  ratioAB / denomAnti;
  const cB_anti = -1 / denomAnti;

  const mos: MolecularOrbital[] = [
    {
      name: 'σ1s',
      occupancy: Math.min(2, valenceElectrons),
      symmetry: 'bonding',
      energy: -16 * Math.max(Za, Zb) / 2,  // aprox: más profunda si Z mayor
      coefficients: [
        { atomIndex: 0, orbitalKey: '1s', Zeff: Za, coefficient: cA_bond },
        { atomIndex: 1, orbitalKey: '1s', Zeff: Zb, coefficient: cB_bond },
      ],
    },
    {
      name: 'σ*1s',
      occupancy: Math.max(0, Math.min(2, valenceElectrons - 2)),
      symmetry: 'antibonding',
      energy: -9 * Math.max(Za, Zb) / 2,
      coefficients: [
        { atomIndex: 0, orbitalKey: '1s', Zeff: Za, coefficient: cA_anti },
        { atomIndex: 1, orbitalKey: '1s', Zeff: Zb, coefficient: cB_anti },
      ],
    },
  ];

  return {
    name, formula, atoms, mos,
    bondLength,
    description: options.description,
  };
}

/**
 * Actualiza la longitud de enlace de una molécula existente
 * (reposiciona los dos átomos sobre el eje X simétricamente).
 */
export function setBondLength(mol: Molecule3D, R: number): Molecule3D {
  if (mol.atoms.length !== 2) return mol;
  return {
    ...mol,
    atoms: [
      { ...mol.atoms[0], position: [-R / 2, 0, 0] },
      { ...mol.atoms[1], position: [ R / 2, 0, 0] },
    ],
    bondLength: R,
  };
}

// ═══════════════════════════════════════════════════════════════
// CATÁLOGO DE MOLÉCULAS DIATÓMICAS EDUCATIVAS
// ═══════════════════════════════════════════════════════════════

export const H2: Molecule3D = buildDiatomic1s({
  name: 'Hidrógeno molecular',
  formula: 'H₂',
  elementA: 'H', elementB: 'H',
  Za: 1, Zb: 1,
  valenceElectrons: 2,
  bondLength: 1.4,           // valor experimental 0.74 Å = 1.40 bohr
  description:
    'La molécula diatómica más simple. Dos electrones ocupan el σ1s bonding. ' +
    'El σ* queda vacío — por eso el enlace es estable.',
});

export const H2_CATION: Molecule3D = buildDiatomic1s({
  name: 'Catión hidrógeno molecular',
  formula: 'H₂⁺',
  elementA: 'H', elementB: 'H',
  Za: 1, Zb: 1,
  valenceElectrons: 1,       // UN solo electrón
  bondLength: 2.00,          // más larga por enlace de medio orden
  description:
    'El sistema cuántico más simple con enlace químico: 2 protones + 1 electrón. ' +
    'Orden de enlace 1/2 — enlace más débil y más largo que H₂.',
});

export const HE_H_CATION: Molecule3D = buildDiatomic1s({
  name: 'Catión de hidruro de helio',
  formula: 'HeH⁺',
  elementA: 'He', elementB: 'H',
  Za: 2, Zb: 1,
  valenceElectrons: 2,
  bondLength: 1.46,
  description:
    'La primera molécula formada en el Universo (~380 000 años después del Big Bang). ' +
    'Asimétrica: el enlace σ está polarizado hacia el He. ' +
    'Detectada en espacio por Güsten et al. 2019, Nature 568, 357.',
});

export const HE2_HYPOTHETICAL: Molecule3D = buildDiatomic1s({
  name: 'Dihelio (hipotético)',
  formula: 'He₂',
  elementA: 'He', elementB: 'He',
  Za: 2, Zb: 2,
  valenceElectrons: 4,       // σ² σ*² → orden 0 → no existe como enlace covalente
  bondLength: 5.6,           // extremadamente laxo (van der Waals, no covalente)
  description:
    'Demostración de por qué He es inerte. Los 4 electrones llenan σ y σ*; el orden ' +
    'de enlace = (2-2)/2 = 0. No hay enlace covalente. Se "ve" la cancelación.',
});

/** Versión educativa del Li₂ — solo orbitales de valencia 2s */
export const LI2: Molecule3D = (() => {
  const R = 5.05;  // 2.67 Å experimental → 5.05 bohr
  return {
    name: 'Dilitio',
    formula: 'Li₂',
    atoms: [
      { element: 'Li', Z: 3, position: [-R / 2, 0, 0] },
      { element: 'Li', Z: 3, position: [ R / 2, 0, 0] },
    ],
    bondLength: R,
    description:
      'Primer ejemplo de enlace covalente con orbitales de valencia 2s. ' +
      'Los 4 electrones de core 1s² 1s² se consideran inertes. ' +
      'Los 2 electrones de valencia forman σ2s bonding.',
    mos: [
      {
        name: 'σ2s',
        occupancy: 2,
        symmetry: 'bonding',
        energy: -5.4,
        coefficients: [
          // Z_eff para 2s en Li ≈ 1.30 (Slater)
          { atomIndex: 0, orbitalKey: '2s', Zeff: 1.30, coefficient: 0.55 },
          { atomIndex: 1, orbitalKey: '2s', Zeff: 1.30, coefficient: 0.55 },
        ],
      },
      {
        name: 'σ*2s',
        occupancy: 0,
        symmetry: 'antibonding',
        energy: -3.0,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2s', Zeff: 1.30, coefficient:  0.85 },
          { atomIndex: 1, orbitalKey: '2s', Zeff: 1.30, coefficient: -0.85 },
        ],
      },
    ],
  };
})();

// ═══════════════════════════════════════════════════════════════
// MOLÉCULAS CON ORBITALES 2p — segunda fila de la tabla periódica
// ═══════════════════════════════════════════════════════════════
//
// Convención geométrica: eje de enlace = X. Átomo A en (-R/2, 0, 0),
// átomo B en (+R/2, 0, 0).
//
// Convención de signo para orbitales 2p (consecuencia del shader:
// psi_2px ∝ (x − atom_x)):
//   · En el punto medio (x=0), 2p_x_A > 0 (porque 0 - (-R/2) = +R/2),
//     2p_x_B < 0 (porque 0 - (+R/2) = -R/2).
//   · σ bonding desde 2p axiales: ψ = c·(2p_x_A − 2p_x_B) → constructivo.
//   · σ* antibonding: ψ = c·(2p_x_A + 2p_x_B).
//   · π bonding desde 2p perpendiculares (2p_y, 2p_z): ψ = c·(pA + pB).
//   · π* antibonding: ψ = c·(pA − pB).

// Slater Zeff para elementos 2ª fila (misma fórmula que en periodic-table):
//   Zeff(2s ó 2p) = Z − 2·0.85 − (n_2-1)·0.35   con n_2 = electrones valencia
const Z_EFF_N_2sp  = 3.90;   // N  (Z=7,  5 e⁻ en grupo 2sp)
const Z_EFF_O_2sp  = 4.55;   // O  (Z=8,  6 e⁻)
const Z_EFF_F_2sp  = 5.20;   // F  (Z=9,  7 e⁻)
const Z_EFF_C_2sp  = 3.25;   // C  (Z=6,  4 e⁻)

/**
 * N₂ — nitrógeno molecular. Enlace triple (orden 3).
 * MOs de valencia: 2σg, 2σu*, 3σg (de 2p), 1πu (×2, de 2p perpendiculares).
 * 10 e⁻ de valencia (cores 1s ignorados — inertes).
 */
export const N2: Molecule3D = (() => {
  const R = 2.074;   // bohr (1.098 Å exp.)
  const c_s_b  = 0.55,  c_s_a  = 0.85;   // bonding / antibonding 2s
  const c_p_b  = 0.55,  c_p_a  = 0.85;   // σ / σ* desde 2p_x
  const c_pi_b = 0.65,  c_pi_a = 0.75;   // π / π* desde 2p_y, 2p_z
  return {
    name: 'Nitrógeno molecular',
    formula: 'N₂',
    atoms: [
      { element: 'N', Z: 7, position: [-R / 2, 0, 0] },
      { element: 'N', Z: 7, position: [ R / 2, 0, 0] },
    ],
    bondLength: R,
    description:
      'Enlace TRIPLE: σ(2s) + σ(2p_x) + 2×π (de 2p_y y 2p_z). ' +
      'Nube con un "puente" central y dos lóbulos transversales — ' +
      'por eso el N₂ es tan estable (Dₑ ≈ 9.8 eV).',
    mos: [
      {
        name: '2σg', occupancy: 2, symmetry: 'bonding', energy: -16,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2s', Zeff: Z_EFF_N_2sp, coefficient: c_s_b },
          { atomIndex: 1, orbitalKey: '2s', Zeff: Z_EFF_N_2sp, coefficient: c_s_b },
        ],
      },
      {
        name: '2σu*', occupancy: 2, symmetry: 'antibonding', energy: -13,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2s', Zeff: Z_EFF_N_2sp, coefficient:  c_s_a },
          { atomIndex: 1, orbitalKey: '2s', Zeff: Z_EFF_N_2sp, coefficient: -c_s_a },
        ],
      },
      {
        name: '3σg', occupancy: 2, symmetry: 'bonding', energy: -11,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2px', Zeff: Z_EFF_N_2sp, coefficient:  c_p_b },
          { atomIndex: 1, orbitalKey: '2px', Zeff: Z_EFF_N_2sp, coefficient: -c_p_b },
        ],
      },
      {
        name: '1πu_y', occupancy: 2, symmetry: 'bonding', energy: -10.5,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2py', Zeff: Z_EFF_N_2sp, coefficient: c_pi_b },
          { atomIndex: 1, orbitalKey: '2py', Zeff: Z_EFF_N_2sp, coefficient: c_pi_b },
        ],
      },
      {
        name: '1πu_z', occupancy: 2, symmetry: 'bonding', energy: -10.5,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2pz', Zeff: Z_EFF_N_2sp, coefficient: c_pi_b },
          { atomIndex: 1, orbitalKey: '2pz', Zeff: Z_EFF_N_2sp, coefficient: c_pi_b },
        ],
      },
      // π* y σ* superiores vacíos (no los cargamos para ahorrar slots)
      {
        name: '1πg_y*', occupancy: 0, symmetry: 'antibonding', energy: -6,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2py', Zeff: Z_EFF_N_2sp, coefficient:  c_pi_a },
          { atomIndex: 1, orbitalKey: '2py', Zeff: Z_EFF_N_2sp, coefficient: -c_pi_a },
        ],
      },
    ],
  };
})();

/**
 * O₂ — oxígeno molecular. Enlace DOBLE con 2 electrones desapareados
 * en orbitales π* (razón del PARAMAGNETISMO — atraído por imán).
 */
export const O2: Molecule3D = (() => {
  const R = 2.28;
  const c_s_b  = 0.55,  c_s_a  = 0.85;
  const c_p_b  = 0.55,  c_p_a  = 0.75;
  const c_pi_b = 0.60,  c_pi_a = 0.70;
  return {
    name: 'Oxígeno molecular',
    formula: 'O₂',
    atoms: [
      { element: 'O', Z: 8, position: [-R / 2, 0, 0] },
      { element: 'O', Z: 8, position: [ R / 2, 0, 0] },
    ],
    bondLength: R,
    description:
      'Enlace DOBLE. Lo curioso: 2 electrones en orbitales π* con spin paralelo ' +
      '(regla de Hund) → paramagnético. Lo demostró Pauling con un imán sobre O₂ líquido.',
    mos: [
      { name: '2σg', occupancy: 2, symmetry: 'bonding', energy: -16,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2s', Zeff: Z_EFF_O_2sp, coefficient: c_s_b },
          { atomIndex: 1, orbitalKey: '2s', Zeff: Z_EFF_O_2sp, coefficient: c_s_b },
        ],
      },
      { name: '2σu*', occupancy: 2, symmetry: 'antibonding', energy: -13,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2s', Zeff: Z_EFF_O_2sp, coefficient:  c_s_a },
          { atomIndex: 1, orbitalKey: '2s', Zeff: Z_EFF_O_2sp, coefficient: -c_s_a },
        ],
      },
      { name: '3σg', occupancy: 2, symmetry: 'bonding', energy: -11,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2px', Zeff: Z_EFF_O_2sp, coefficient:  c_p_b },
          { atomIndex: 1, orbitalKey: '2px', Zeff: Z_EFF_O_2sp, coefficient: -c_p_b },
        ],
      },
      { name: '1πu_y', occupancy: 2, symmetry: 'bonding', energy: -10.5,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2py', Zeff: Z_EFF_O_2sp, coefficient: c_pi_b },
          { atomIndex: 1, orbitalKey: '2py', Zeff: Z_EFF_O_2sp, coefficient: c_pi_b },
        ],
      },
      { name: '1πu_z', occupancy: 2, symmetry: 'bonding', energy: -10.5,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2pz', Zeff: Z_EFF_O_2sp, coefficient: c_pi_b },
          { atomIndex: 1, orbitalKey: '2pz', Zeff: Z_EFF_O_2sp, coefficient: c_pi_b },
        ],
      },
      // DOS orbitales π* CON 1 ELECTRÓN CADA UNO — Hund + paramagnetismo
      { name: '1πg_y*', occupancy: 1, symmetry: 'antibonding', energy: -6,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2py', Zeff: Z_EFF_O_2sp, coefficient:  c_pi_a },
          { atomIndex: 1, orbitalKey: '2py', Zeff: Z_EFF_O_2sp, coefficient: -c_pi_a },
        ],
      },
      { name: '1πg_z*', occupancy: 1, symmetry: 'antibonding', energy: -6,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2pz', Zeff: Z_EFF_O_2sp, coefficient:  c_pi_a },
          { atomIndex: 1, orbitalKey: '2pz', Zeff: Z_EFF_O_2sp, coefficient: -c_pi_a },
        ],
      },
    ],
  };
})();

/**
 * HF — ácido fluorhídrico. Ejemplo clásico de enlace covalente polar.
 * La nube bonding está fuertemente polarizada hacia F (mayor EN).
 * Además F tiene 3 pares libres (lone pairs) de 2s, 2p_y, 2p_z.
 */
export const HF: Molecule3D = (() => {
  const R = 1.733;   // bohr (0.917 Å experimental)
  return {
    name: 'Fluoruro de hidrógeno',
    formula: 'HF',
    atoms: [
      { element: 'H', Z: 1, position: [-R / 2, 0, 0] },
      { element: 'F', Z: 9, position: [ R / 2, 0, 0] },
    ],
    bondLength: R,
    description:
      'Covalente polar: 4 pares electrónicos en F (σ bonding con H, y 3 pares libres ' +
      'de 2s, 2p_y, 2p_z) → dipolo fuerte (μ = 1.82 D). El enlace σ está polarizado ' +
      'hacia el átomo más electronegativo (F, EN=3.98).',
    mos: [
      // Par libre 2s del F
      { name: 'F 2s (lp)', occupancy: 2, symmetry: 'nonbonding', energy: -40,
        coefficients: [
          { atomIndex: 1, orbitalKey: '2s', Zeff: Z_EFF_F_2sp, coefficient: 1.0 },
        ],
      },
      // σ bonding: H 1s + F 2p_x (polarizado; c_F > c_H). Coef negativo en
      // F 2p_x por convención de signo (lóbulo que apunta a H es el −x).
      { name: 'σ (bond)', occupancy: 2, symmetry: 'bonding', energy: -19,
        coefficients: [
          { atomIndex: 0, orbitalKey: '1s',  Zeff: 1.0,           coefficient:  0.40 },
          { atomIndex: 1, orbitalKey: '2px', Zeff: Z_EFF_F_2sp,   coefficient: -0.95 },
        ],
      },
      // Pares libres perpendiculares al eje de enlace (2p_y y 2p_z del F)
      { name: 'F 2p_y (lp)', occupancy: 2, symmetry: 'nonbonding', energy: -18,
        coefficients: [
          { atomIndex: 1, orbitalKey: '2py', Zeff: Z_EFF_F_2sp, coefficient: 1.0 },
        ],
      },
      { name: 'F 2p_z (lp)', occupancy: 2, symmetry: 'nonbonding', energy: -18,
        coefficients: [
          { atomIndex: 1, orbitalKey: '2pz', Zeff: Z_EFF_F_2sp, coefficient: 1.0 },
        ],
      },
      // σ* antibonding (vacío)
      { name: 'σ*', occupancy: 0, symmetry: 'antibonding', energy: -5,
        coefficients: [
          { atomIndex: 0, orbitalKey: '1s',  Zeff: 1.0,           coefficient:  0.95 },
          { atomIndex: 1, orbitalKey: '2px', Zeff: Z_EFF_F_2sp,   coefficient:  0.40 },
        ],
      },
    ],
  };
})();

/**
 * CO — monóxido de carbono. Enlace triple como N₂ pero asimétrico.
 * Es isoelectrónico con N₂ (mismo número de e⁻ de valencia = 10).
 */
export const CO: Molecule3D = (() => {
  const R = 2.132;  // bohr (1.128 Å experimental)
  // Polarización hacia O en orbitales σ; hacia C en HOMO (mix peculiar)
  return {
    name: 'Monóxido de carbono',
    formula: 'CO',
    atoms: [
      { element: 'C', Z: 6, position: [-R / 2, 0, 0] },
      { element: 'O', Z: 8, position: [ R / 2, 0, 0] },
    ],
    bondLength: R,
    description:
      'Isoelectrónico con N₂ — también triple enlace, pero asimétrico. ' +
      'El momento dipolar es pequeño (0.11 D) y EN reverso (polo − en C!) por ' +
      'mezcla de los orbitales σ en la cima. Se forma en combustión incompleta.',
    mos: [
      { name: '3σ (2s)',  occupancy: 2, symmetry: 'bonding', energy: -20,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2s', Zeff: Z_EFF_C_2sp, coefficient: 0.40 },
          { atomIndex: 1, orbitalKey: '2s', Zeff: Z_EFF_O_2sp, coefficient: 0.70 },
        ],
      },
      { name: '4σ* (2s)', occupancy: 2, symmetry: 'antibonding', energy: -15,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2s', Zeff: Z_EFF_C_2sp, coefficient:  0.75 },
          { atomIndex: 1, orbitalKey: '2s', Zeff: Z_EFF_O_2sp, coefficient: -0.55 },
        ],
      },
      { name: '1π_y', occupancy: 2, symmetry: 'bonding', energy: -12,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2py', Zeff: Z_EFF_C_2sp, coefficient: 0.50 },
          { atomIndex: 1, orbitalKey: '2py', Zeff: Z_EFF_O_2sp, coefficient: 0.70 },
        ],
      },
      { name: '1π_z', occupancy: 2, symmetry: 'bonding', energy: -12,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2pz', Zeff: Z_EFF_C_2sp, coefficient: 0.50 },
          { atomIndex: 1, orbitalKey: '2pz', Zeff: Z_EFF_O_2sp, coefficient: 0.70 },
        ],
      },
      // 5σ — HOMO de CO, con carácter de "par libre en C" peculiar
      { name: '5σ (HOMO)', occupancy: 2, symmetry: 'bonding', energy: -11,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2px', Zeff: Z_EFF_C_2sp, coefficient:  0.70 },
          { atomIndex: 1, orbitalKey: '2px', Zeff: Z_EFF_O_2sp, coefficient: -0.45 },
        ],
      },
    ],
  };
})();

export const MOLECULE_CATALOG: Molecule3D[] = [
  H2, H2_CATION, HE_H_CATION, HE2_HYPOTHETICAL, LI2,
  N2, O2, HF, CO,
];

export function moleculeByFormula(formula: string): Molecule3D | undefined {
  return MOLECULE_CATALOG.find((m) => m.formula === formula);
}

// ═══════════════════════════════════════════════════════════════
// MÉTRICAS
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// RIG SAMPLING — puntos atados a átomos, O(N) por frame
// ═══════════════════════════════════════════════════════════════
//
// El rejection sampling molecular es O(N·400) y se recomputa cuando
// la geometría cambia (mover un átomo = cambio de geometría). Eso
// mata la fluidez en animaciones.
//
// Solución: "rig". Muestreamos UNA SOLA VEZ cada orbital atómico en
// coordenadas relativas al átomo al que pertenece. Cuando el átomo
// se mueva, solo recomputamos posiciones absolutas sumando el offset:
// posición_world = posición_átomo + offset_relativo.
// Costo por frame: O(N). Totalmente fluido aun con miles de puntos.
//
// Trade-off: el rig pierde la densidad ADICIONAL del solapamiento
// bonding en el punto medio (emerge del producto cruzado 2·c_A·c_B·φ_A·φ_B).
// Para animación es aceptable — al soltar el slider/animación volvemos
// al sampling LCAO completo (sampleMolecule) que sí captura el overlap.
// Esta dualidad es clave para reutilizar el motor en simulaciones MD
// con docenas/cientos de átomos en movimiento.

export interface RigSample extends MoleculeSample {
  /** Átomo al que este punto pertenece (quien lo arrastra al moverse) */
  atomIndex: number;
  /** Offset desde el átomo en bohrs (constante durante la animación) */
  offsetX: number;
  offsetY: number;
  offsetZ: number;
}

/**
 * Muestrea orbitales atómicos individuales (ΣᵢAᵢ|φᵢ|² por átomo),
 * NO la densidad molecular total. Cada punto queda atado a su átomo.
 *
 * El peso de cada orbital atómico por átomo i es |cᵢ|²·nₒcc para cada MO
 * ocupado — aproxima bien la "densidad atómica" sin contribuciones cruzadas.
 *
 * Esta función NO depende de las posiciones de los átomos: la nube se
 * expresa en coordenadas relativas. Llamar UNA sola vez por molécula
 * (incluso durante animación, los offsets no cambian).
 */
export function sampleMoleculeRig(
  molecule: Molecule3D,
  nPoints: number,
  seed = 42,
  visibleMOs?: number[],
): RigSample[] {
  const moIndices = visibleMOs ??
    molecule.mos.map((_, i) => i).filter((i) => molecule.mos[i].occupancy > 0);
  if (moIndices.length === 0) return [];

  // Agregamos contribuciones por (átomo, orbital atómico)
  // clave: atomIndex << 16 | orbitalKeyIdx
  interface Contrib {
    atomIndex: number;
    orbitalKey: OrbitalKey;
    Zeff: number;
    weight: number;        // |c|² · ocupación sumado sobre MOs relevantes
    domMOIndex: number;    // MO que más contribuye a este término
  }
  const contribs: Contrib[] = [];
  const keyToIdx = new Map<string, number>();

  for (const mi of moIndices) {
    const mo = molecule.mos[mi];
    if (mo.occupancy === 0) continue;
    for (const c of mo.coefficients) {
      const key = `${c.atomIndex}/${c.orbitalKey}`;
      const weight = c.coefficient * c.coefficient * mo.occupancy;
      const existingIdx = keyToIdx.get(key);
      if (existingIdx !== undefined) {
        const e = contribs[existingIdx];
        if (weight > (e.weight - contribs[existingIdx].weight) * 0.5) {
          e.domMOIndex = mi;
        }
        e.weight += weight;
      } else {
        keyToIdx.set(key, contribs.length);
        contribs.push({
          atomIndex: c.atomIndex,
          orbitalKey: c.orbitalKey,
          Zeff: c.Zeff,
          weight,
          domMOIndex: mi,
        });
      }
    }
  }
  if (contribs.length === 0) return [];

  const totalWeight = contribs.reduce((s, c) => s + c.weight, 0);
  const out: RigSample[] = [];

  for (let ci = 0; ci < contribs.length; ci++) {
    const c = contribs[ci];
    const n = ci === contribs.length - 1
      ? nPoints - out.length
      : Math.round((c.weight / totalWeight) * nPoints);
    if (n <= 0) continue;

    const orbital = ORBITALS[c.orbitalKey];
    if (!orbital) continue;

    const atomSamples = sampleOrbital(orbital, n, c.Zeff, seed + ci * 53);
    for (const s of atomSamples) {
      out.push({
        x: 0, y: 0, z: 0,  // placeholder — el consumer computa world pos desde offset
        sign: s.sign,
        density: s.density,
        dominantMOIndex: c.domMOIndex,
        atomIndex: c.atomIndex,
        offsetX: s.x,
        offsetY: s.y,
        offsetZ: s.z,
      });
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
// SAMPLING RÁPIDO PARA ANIMACIÓN — importance per-átomo + LCAO completo
// ═══════════════════════════════════════════════════════════════
//
// El rejection sampling "ingenuo" (sampleMolecule) se degrada cuando
// los átomos se separan: la caja crece cúbicamente mientras las nubes
// son compactas → acceptance rate → 0 → la nube "desaparece".
//
// sampleMoleculeFast usa importance sampling: cada átomo genera su
// propia sub-caja de tamaño constante (~5 bohr), y la densidad total
// se evalúa como LCAO FULL (incluido el término cruzado de solapamiento
// 2·cₐ·c_b·φₐ·φ_b). Así:
//   • captura el bonding overlap (lo que hace visible el σ/π emergiendo)
//   • se mantiene rápida a cualquier separación (acceptance ~constante)
//   • escala linealmente con nAtomos, apta para polyatómicos
//
// Úsalo en el loop de animación. Para análisis estático de alta
// resolución, sampleMolecule sigue disponible.

function mulberry32Fast(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleMoleculeFast(
  molecule: Molecule3D,
  nPoints: number,
  seed = 42,
  visibleMOs?: number[],
  subBoxSize = 5,
): MoleculeSample[] {
  const atoms = molecule.atoms;
  if (atoms.length === 0) return [];

  const moIndices = visibleMOs ??
    molecule.mos.map((_, i) => i).filter((i) => molecule.mos[i].occupancy > 0);
  if (moIndices.length === 0) return [];

  const rng = mulberry32Fast(seed);

  // Estima rho máximo con unos 2000 muestreos dentro de las sub-cajas
  let rhoMax = 0;
  for (let i = 0; i < 2000; i++) {
    const ai = Math.floor(rng() * atoms.length);
    const atom = atoms[ai];
    const x = atom.position[0] + (rng() * 2 - 1) * subBoxSize;
    const y = atom.position[1] + (rng() * 2 - 1) * subBoxSize;
    const z = atom.position[2] + (rng() * 2 - 1) * subBoxSize;
    let rho = 0;
    for (const mi of moIndices) {
      const mo = molecule.mos[mi];
      if (mo.occupancy === 0) continue;
      const psi = psiMO(x, y, z, mo, atoms);
      rho += mo.occupancy * psi * psi;
    }
    if (rho > rhoMax) rhoMax = rho;
  }
  if (rhoMax === 0) return [];

  const out: MoleculeSample[] = [];
  const maxAttempts = nPoints * 200;
  let attempts = 0;

  while (out.length < nPoints && attempts < maxAttempts) {
    // Elegir átomo aleatorio y muestrear en su sub-caja
    const ai = Math.floor(rng() * atoms.length);
    const atom = atoms[ai];
    const x = atom.position[0] + (rng() * 2 - 1) * subBoxSize;
    const y = atom.position[1] + (rng() * 2 - 1) * subBoxSize;
    const z = atom.position[2] + (rng() * 2 - 1) * subBoxSize;

    let totalRho = 0;
    let domMO = moIndices[0];
    let domRho = 0;
    let domPsi = 0;

    for (const mi of moIndices) {
      const mo = molecule.mos[mi];
      if (mo.occupancy === 0) continue;
      const psi = psiMO(x, y, z, mo, atoms);
      const moRho = mo.occupancy * psi * psi;
      totalRho += moRho;
      if (moRho > domRho) {
        domRho = moRho;
        domMO = mi;
        domPsi = psi;
      }
    }

    const prob = totalRho / rhoMax;
    if (prob > 1) rhoMax = totalRho;  // re-ajusta si encontramos un pico mayor
    const probCap = Math.min(1, prob);

    if (rng() < probCap) {
      out.push({
        x, y, z,
        sign: domPsi >= 0 ? 1 : -1,
        density: probCap,
        dominantMOIndex: domMO,
      });
    }
    attempts++;
  }
  return out;
}

/** Orden de enlace = (e⁻ en bonding - e⁻ en antibonding) / 2 */
export function bondOrder(mol: Molecule3D): number {
  let bonding = 0, antibonding = 0;
  for (const mo of mol.mos) {
    if (mo.symmetry === 'bonding') bonding += mo.occupancy;
    if (mo.symmetry === 'antibonding') antibonding += mo.occupancy;
  }
  return (bonding - antibonding) / 2;
}

/** Total de electrones en la molécula */
export function totalElectrons(mol: Molecule3D): number {
  return mol.mos.reduce((s, mo) => s + mo.occupancy, 0);
}
