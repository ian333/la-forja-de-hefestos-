/**
 * ══════════════════════════════════════════════════════════════════════
 *  quantum/canonical-molecules — Set de moléculas obligatorias
 * ══════════════════════════════════════════════════════════════════════
 *
 * Las moléculas que todo libro de química general cubre, con geometría
 * derivada de VSEPR + bond lengths/angles experimentales de NIST CCCBDB
 * (cccbdb.nist.gov). Cada definición está acompañada por su valor de
 * referencia para que el test `canonical-molecules.test.ts` pueda
 * comparar y fallar si algo se descalibra.
 *
 * Unidades: posiciones en BOHRS (1 Å = 1.8897 bohr). Coeficientes LCAO
 * normalizados aproximadamente para que ψ_MO² sea físicamente significativo
 * (no exactos como HF/DFT, pero correctos en simetría y orden de magnitud).
 *
 * Ref [CM1] NIST CCCBDB — experimental geometries (Comparison and
 *           Benchmark Database). https://cccbdb.nist.gov
 * Ref [CM2] CRC Handbook of Chemistry and Physics, 104th ed. (2023-24).
 * Ref [CM3] Hocking, W.H. & Gerry, M.C.L. "Microwave spectrum of HCl",
 *           J. Mol. Spectrosc. 90, 31 (1981).
 * Ref [CM4] Herzberg, G. "Molecular Spectra and Molecular Structure: I.
 *           Spectra of Diatomic Molecules", 2nd ed. (1950).
 * Ref [CM5] Honig, A. et al. "Microwave investigation of NaCl, NaBr, NaI",
 *           Phys. Rev. 96, 629 (1954).
 */

import type { Molecule3D, MolecularOrbital, AtomInMolecule } from './molecular-orbitals';
import { vsepr, placeAtoms, type Vec3 } from './vsepr';

/** Conversión Å → bohr. */
const A2B = 1.8897259886;

// ═══════════════════════════════════════════════════════════════
// Z efectivas de Slater para shells de valencia
// (Clementi-Raimondi 1963 + apantallamiento estándar)
// ═══════════════════════════════════════════════════════════════
const Z_EFF = {
  H_1s:  1.00,
  C_2sp: 3.25,  // ya en molecular-orbitals.ts
  N_2sp: 3.90,
  O_2sp: 4.55,
  F_2sp: 5.20,
  // 3p (Slater: Z* = Z - 10·0.85 - (n-1)·0.35 para misma shell)
  // Na 3s:  Z* = 11 - 10·0.85 - 0·0.35 = 2.50  (vs experimental ~2.84)
  Na_3s: 2.50,
  // Cl 3p:  Z* = 17 - 10·0.85 - 6·0.35 = 6.40
  Cl_3p: 6.40,
};

// ═══════════════════════════════════════════════════════════════
// Datos NIST CCCBDB experimentales (Å y grados)
// ═══════════════════════════════════════════════════════════════
export const CANONICAL_GEOMETRY = {
  H2O:  { OH:    0.9572, HOH: 104.52 },      // CCCBDB
  CH4:  { CH:    1.0870, HCH: 109.47 },
  NH3:  { NH:    1.0124, HNH: 106.7 },
  CO2:  { CO:    1.1621, OCO: 180 },
  C2H4: { CC:    1.3390, CH:  1.0870, HCH: 117.4 },
  C2H2: { CC:    1.2033, CH:  1.0626, CCH: 180 },
  HCl:  { HCl:   1.2746 },                   // Hocking & Gerry 1981
  NaCl: { NaCl:  2.3609 },                   // Honig 1954
  C6H6: { CC:    1.397,  CH:  1.084,  CCC: 120 },  // Stoicheff 1954
} as const;

// ═══════════════════════════════════════════════════════════════
// HELPERS — construcción de MOs aproximados
// ═══════════════════════════════════════════════════════════════

/**
 * Sigma bond simple entre el átomo central (atomIndex `centerIdx`) y un
 * periférico (atomIndex `periphIdx`). Mezcla 2p del centro con 1s del H
 * (o el orbital de valencia apropiado).
 */
function makeSigmaBond(
  centerIdx: number,
  centerOrb: '2s' | '2px' | '2py' | '2pz' | '3px' | '3py' | '3pz',
  centerZeff: number,
  periphIdx: number,
  periphOrb: '1s' | '2s' | '3px' | '3py' | '3pz',
  periphZeff: number,
  energy: number,
  cCenter = 0.6,
  cPeriph = 0.55,
): MolecularOrbital {
  return {
    name: `σ`, occupancy: 2, symmetry: 'bonding', energy,
    coefficients: [
      { atomIndex: centerIdx, orbitalKey: centerOrb, Zeff: centerZeff, coefficient: cCenter },
      { atomIndex: periphIdx, orbitalKey: periphOrb, Zeff: periphZeff, coefficient: cPeriph },
    ],
  };
}

/** Par libre (nonbonding) centrado en un átomo. */
function makeLonePair(
  atomIndex: number,
  orbitalKey: '2s' | '2px' | '2py' | '2pz' | '3s' | '3px' | '3py' | '3pz',
  Zeff: number,
  energy: number,
  name = 'lp',
): MolecularOrbital {
  return {
    name, occupancy: 2, symmetry: 'nonbonding', energy,
    coefficients: [{ atomIndex, orbitalKey, Zeff, coefficient: 1.0 }],
  };
}

// ═══════════════════════════════════════════════════════════════
// H₂O — bent, AX₂E₂, sp³ on O
// ═══════════════════════════════════════════════════════════════
/**
 * Posiciones desde VSEPR tetraédrico con compresión a 104.52° (NIST).
 * MOs: 2 σ (O-H) + 2 lone pairs (sp³-like hybrids) + 2s core.
 *
 * Visualmente lo que cuenta:
 *   - 2 σ bonds direccionales (lóbulos O→H)
 *   - 2 lone pairs en los otros dos vértices del tetraedro
 *   - Densidad muy asimétrica → dipolo grande (μ = 1.85 D experimental)
 */
export const H2O: Molecule3D = (() => {
  const R = CANONICAL_GEOMETRY.H2O.OH * A2B;
  const half = CANONICAL_GEOMETRY.H2O.HOH * 0.5 * Math.PI / 180;
  // Posicionamos en el plano XZ con O en origen y H's simétricos respecto a +Z.
  const sinH = Math.sin(half);
  const cosH = Math.cos(half);
  const atoms: AtomInMolecule[] = [
    { element: 'O', Z: 8, position: [0, 0, 0] },
    { element: 'H', Z: 1, position: [ R * sinH, 0, R * cosH] },
    { element: 'H', Z: 1, position: [-R * sinH, 0, R * cosH] },
  ];

  return {
    name: 'Agua',
    formula: 'H₂O',
    bondLength: R,
    atoms,
    description:
      'Bent (AX₂E₂). O sp³, ángulo 104.52° por compresión de pares libres. ' +
      'Polar (μ = 1.85 D). El protagonista de la química terrestre.',
    mos: [
      makeLonePair(0, '2s', Z_EFF.O_2sp, -32, 'O 2s'),
      // σ O–H usando 2pz + 2px del O (los dos lóbulos apuntan a los H's)
      makeSigmaBond(0, '2pz', Z_EFF.O_2sp, 1, '1s', Z_EFF.H_1s, -14, 0.50,  0.55),
      makeSigmaBond(0, '2px', Z_EFF.O_2sp, 1, '1s', Z_EFF.H_1s, -14, 0.50,  0.55),
      makeSigmaBond(0, '2pz', Z_EFF.O_2sp, 2, '1s', Z_EFF.H_1s, -14, 0.50,  0.55),
      makeSigmaBond(0, '2px', Z_EFF.O_2sp, 2, '1s', Z_EFF.H_1s, -14, -0.50, 0.55),
      // Lone pairs: 2py (perpendicular al plano molecular) + remanente
      makeLonePair(0, '2py', Z_EFF.O_2sp, -12, 'O lp (π-like)'),
    ],
  };
})();

// ═══════════════════════════════════════════════════════════════
// CH₄ — tetraédrico, AX₄
// ═══════════════════════════════════════════════════════════════
export const CH4: Molecule3D = (() => {
  const R = CANONICAL_GEOMETRY.CH4.CH * A2B;
  const v = vsepr(4, 0);
  const Hs = placeAtoms([0, 0, 0], v.bondDirections, [R, R, R, R]);
  const atoms: AtomInMolecule[] = [
    { element: 'C', Z: 6, position: [0, 0, 0] },
    ...Hs.map(p => ({ element: 'H', Z: 1, position: p })),
  ];

  // 4 σ bonds C-H usando 2s + 2px,2py,2pz del C (mezcla sp³).
  // Para cada bond, una combinación de orbitales atómicos del C dirige el lóbulo
  // hacia cada H. Aquí lo aproximamos con orbitales atómicos individuales.
  return {
    name: 'Metano',
    formula: 'CH₄',
    bondLength: R,
    atoms,
    description:
      'Tetraédrico (AX₄). C sp³, ángulo 109.47° exacto. Apolar. Modelo canónico ' +
      'del enlace sp³ y la primera molécula orgánica completa.',
    mos: [
      makeLonePair(0, '2s', Z_EFF.C_2sp, -25, 'C 2s'),
      makeSigmaBond(0, '2px', Z_EFF.C_2sp, 1, '1s', Z_EFF.H_1s, -14, 0.50, 0.55),
      makeSigmaBond(0, '2py', Z_EFF.C_2sp, 2, '1s', Z_EFF.H_1s, -14, 0.50, 0.55),
      makeSigmaBond(0, '2pz', Z_EFF.C_2sp, 3, '1s', Z_EFF.H_1s, -14, 0.50, 0.55),
      makeSigmaBond(0, '2px', Z_EFF.C_2sp, 4, '1s', Z_EFF.H_1s, -14, -0.50, 0.55),
    ],
  };
})();

// ═══════════════════════════════════════════════════════════════
// NH₃ — piramidal trigonal, AX₃E
// ═══════════════════════════════════════════════════════════════
export const NH3: Molecule3D = (() => {
  const R = CANONICAL_GEOMETRY.NH3.NH * A2B;
  const v = vsepr(3, 1);
  // VSEPR devuelve 3 vértices del tetraedro para bonds + 1 para LP.
  // Para que el LP apunte a +z (convención común) reorientamos.
  // El primero (1,1,1)/√3 es el LP; los 3 restantes apuntan más o menos
  // hacia abajo. Reflejamos en Y para tener H's bajo el plano XZ.
  const Hs = placeAtoms([0, 0, 0], v.bondDirections, [R, R, R]);
  const atoms: AtomInMolecule[] = [
    { element: 'N', Z: 7, position: [0, 0, 0] },
    ...Hs.map(p => ({ element: 'H', Z: 1, position: p })),
  ];

  return {
    name: 'Amoniaco',
    formula: 'NH₃',
    bondLength: R,
    atoms,
    description:
      'Piramidal trigonal (AX₃E). N sp³ con 1 par libre, ángulo 106.7° ' +
      '(comprimido desde 109.47°). El par libre hace de NH₃ una base de Lewis.',
    mos: [
      makeLonePair(0, '2s', Z_EFF.N_2sp, -28, 'N 2s'),
      // El LP "real" de NH₃ es la combinación 2s + algo de 2pz; aquí lo
      // representamos con 2pz puro pa la viz (apunta al ápice del piramidal).
      makeLonePair(0, '2pz', Z_EFF.N_2sp, -10, 'N lp'),
      makeSigmaBond(0, '2px', Z_EFF.N_2sp, 1, '1s', Z_EFF.H_1s, -15, 0.50, 0.55),
      makeSigmaBond(0, '2py', Z_EFF.N_2sp, 2, '1s', Z_EFF.H_1s, -15, 0.50, 0.55),
      makeSigmaBond(0, '2pz', Z_EFF.N_2sp, 3, '1s', Z_EFF.H_1s, -15, 0.30, 0.55),
    ],
  };
})();

// ═══════════════════════════════════════════════════════════════
// CO₂ — lineal, O=C=O, C sp
// ═══════════════════════════════════════════════════════════════
export const CO2: Molecule3D = (() => {
  const R = CANONICAL_GEOMETRY.CO2.CO * A2B;
  const atoms: AtomInMolecule[] = [
    { element: 'O', Z: 8, position: [-R, 0, 0] },
    { element: 'C', Z: 6, position: [0,  0, 0] },
    { element: 'O', Z: 8, position: [R,  0, 0] },
  ];

  return {
    name: 'Dióxido de carbono',
    formula: 'CO₂',
    bondLength: R,
    atoms,
    description:
      'Lineal (AX₂). C sp con 2 enlaces dobles (σ + π) hacia cada O. ' +
      'Apolar a pesar de los dipolos C=O por simetría. Cada O tiene 2 lone pairs.',
    mos: [
      // σ bonds C-O (2s + 2px del C ↔ 2px del O)
      {
        name: 'σ_g (O-C-O)', occupancy: 2, symmetry: 'bonding', energy: -22,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2px', Zeff: Z_EFF.O_2sp, coefficient:  0.50 },
          { atomIndex: 1, orbitalKey: '2px', Zeff: Z_EFF.C_2sp, coefficient:  0.60 },
          { atomIndex: 2, orbitalKey: '2px', Zeff: Z_EFF.O_2sp, coefficient: -0.50 },
        ],
      },
      // π bonds (uno en y, uno en z)
      {
        name: 'π_y', occupancy: 2, symmetry: 'bonding', energy: -18,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2py', Zeff: Z_EFF.O_2sp, coefficient: 0.55 },
          { atomIndex: 1, orbitalKey: '2py', Zeff: Z_EFF.C_2sp, coefficient: 0.55 },
          { atomIndex: 2, orbitalKey: '2py', Zeff: Z_EFF.O_2sp, coefficient: 0.55 },
        ],
      },
      {
        name: 'π_z', occupancy: 2, symmetry: 'bonding', energy: -18,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2pz', Zeff: Z_EFF.O_2sp, coefficient: 0.55 },
          { atomIndex: 1, orbitalKey: '2pz', Zeff: Z_EFF.C_2sp, coefficient: 0.55 },
          { atomIndex: 2, orbitalKey: '2pz', Zeff: Z_EFF.O_2sp, coefficient: 0.55 },
        ],
      },
      // Lone pairs en los O's
      makeLonePair(0, '2s', Z_EFF.O_2sp, -32, 'O₁ 2s'),
      makeLonePair(2, '2s', Z_EFF.O_2sp, -32, 'O₂ 2s'),
    ],
  };
})();

// ═══════════════════════════════════════════════════════════════
// C₂H₄ (eteno) — trigonal plana en cada C, sp², doble enlace
// ═══════════════════════════════════════════════════════════════
export const C2H4: Molecule3D = (() => {
  const Rcc = CANONICAL_GEOMETRY.C2H4.CC * A2B;
  const Rch = CANONICAL_GEOMETRY.C2H4.CH * A2B;
  // Ángulo H-C-H = 117.4° (experimental); H-C-C = (360-117.4)/2 = 121.3°
  const hch = CANONICAL_GEOMETRY.C2H4.HCH * Math.PI / 180;
  const hcc = (Math.PI - hch / 2);                // dirección de cada H
  const xC = Rcc / 2;
  const dx = Rch * Math.cos(Math.PI - hcc);       // proyección X (lejos del otro C)
  const dy = Rch * Math.sin(Math.PI - hcc);
  const atoms: AtomInMolecule[] = [
    { element: 'C', Z: 6, position: [-xC, 0, 0] },
    { element: 'C', Z: 6, position: [ xC, 0, 0] },
    { element: 'H', Z: 1, position: [-xC - dx,  dy, 0] },
    { element: 'H', Z: 1, position: [-xC - dx, -dy, 0] },
    { element: 'H', Z: 1, position: [ xC + dx,  dy, 0] },
    { element: 'H', Z: 1, position: [ xC + dx, -dy, 0] },
  ];
  return {
    name: 'Eteno',
    formula: 'C₂H₄',
    bondLength: Rcc,
    atoms,
    description:
      'Plano (C sp²). Enlace C=C doble: σ (2px-2px) + π (2pz-2pz). ' +
      'Rotación restringida → isomería cis/trans en sustituidos. ' +
      'H-C-H = 117.4° (experimental, plano XY).',
    mos: [
      // σ C-C
      {
        name: 'σ C=C', occupancy: 2, symmetry: 'bonding', energy: -16,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2px', Zeff: Z_EFF.C_2sp, coefficient:  0.55 },
          { atomIndex: 1, orbitalKey: '2px', Zeff: Z_EFF.C_2sp, coefficient: -0.55 },
        ],
      },
      // π C=C
      {
        name: 'π C=C', occupancy: 2, symmetry: 'bonding', energy: -10,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2pz', Zeff: Z_EFF.C_2sp, coefficient: 0.55 },
          { atomIndex: 1, orbitalKey: '2pz', Zeff: Z_EFF.C_2sp, coefficient: 0.55 },
        ],
      },
      // 4 σ C-H (representados con 2py del C + 1s del H)
      makeSigmaBond(0, '2py', Z_EFF.C_2sp, 2, '1s', Z_EFF.H_1s, -14, 0.45, 0.55),
      makeSigmaBond(0, '2py', Z_EFF.C_2sp, 3, '1s', Z_EFF.H_1s, -14, -0.45, 0.55),
      makeSigmaBond(1, '2py', Z_EFF.C_2sp, 4, '1s', Z_EFF.H_1s, -14, 0.45, 0.55),
      makeSigmaBond(1, '2py', Z_EFF.C_2sp, 5, '1s', Z_EFF.H_1s, -14, -0.45, 0.55),
    ],
  };
})();

// ═══════════════════════════════════════════════════════════════
// C₂H₂ (etino) — lineal, sp, triple enlace
// ═══════════════════════════════════════════════════════════════
export const C2H2: Molecule3D = (() => {
  const Rcc = CANONICAL_GEOMETRY.C2H2.CC * A2B;
  const Rch = CANONICAL_GEOMETRY.C2H2.CH * A2B;
  const atoms: AtomInMolecule[] = [
    { element: 'C', Z: 6, position: [-Rcc / 2, 0, 0] },
    { element: 'C', Z: 6, position: [ Rcc / 2, 0, 0] },
    { element: 'H', Z: 1, position: [-Rcc / 2 - Rch, 0, 0] },
    { element: 'H', Z: 1, position: [ Rcc / 2 + Rch, 0, 0] },
  ];
  return {
    name: 'Etino (acetileno)',
    formula: 'C₂H₂',
    bondLength: Rcc,
    atoms,
    description:
      'Lineal (C sp). Enlace C≡C TRIPLE: σ + 2 π. La molécula más rígida ' +
      'que puedes hacer con 2 carbonos. Combustión muy energética → soplete oxiacetilénico.',
    mos: [
      {
        name: 'σ C≡C', occupancy: 2, symmetry: 'bonding', energy: -17,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2px', Zeff: Z_EFF.C_2sp, coefficient:  0.55 },
          { atomIndex: 1, orbitalKey: '2px', Zeff: Z_EFF.C_2sp, coefficient: -0.55 },
        ],
      },
      {
        name: 'π_y C≡C', occupancy: 2, symmetry: 'bonding', energy: -11,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2py', Zeff: Z_EFF.C_2sp, coefficient: 0.55 },
          { atomIndex: 1, orbitalKey: '2py', Zeff: Z_EFF.C_2sp, coefficient: 0.55 },
        ],
      },
      {
        name: 'π_z C≡C', occupancy: 2, symmetry: 'bonding', energy: -11,
        coefficients: [
          { atomIndex: 0, orbitalKey: '2pz', Zeff: Z_EFF.C_2sp, coefficient: 0.55 },
          { atomIndex: 1, orbitalKey: '2pz', Zeff: Z_EFF.C_2sp, coefficient: 0.55 },
        ],
      },
      // σ C-H usando 2s del C (sp hybrid termina apuntando hacia afuera)
      makeSigmaBond(0, '2s', Z_EFF.C_2sp, 2, '1s', Z_EFF.H_1s, -16, -0.40, 0.55),
      makeSigmaBond(1, '2s', Z_EFF.C_2sp, 3, '1s', Z_EFF.H_1s, -16,  0.40, 0.55),
    ],
  };
})();

// ═══════════════════════════════════════════════════════════════
// HCl — diatómica polar
// ═══════════════════════════════════════════════════════════════
export const HCl: Molecule3D = (() => {
  const R = CANONICAL_GEOMETRY.HCl.HCl * A2B;
  return {
    name: 'Cloruro de hidrógeno',
    formula: 'HCl',
    bondLength: R,
    atoms: [
      { element: 'H',  Z: 1,  position: [-R / 2, 0, 0] },
      { element: 'Cl', Z: 17, position: [ R / 2, 0, 0] },
    ],
    description:
      'Polar (μ = 1.08 D). σ bonding: 1s del H + 3p_x del Cl, polarizado hacia Cl. ' +
      '3 pares libres en el Cl (3s + 3p_y + 3p_z).',
    mos: [
      // Cl 3s par libre
      makeLonePair(1, '3s', Z_EFF.Cl_3p, -28, 'Cl 3s'),
      // σ bonding H-Cl (1s + 3px, polarizado hacia Cl)
      {
        name: 'σ H-Cl', occupancy: 2, symmetry: 'bonding', energy: -14,
        coefficients: [
          { atomIndex: 0, orbitalKey: '1s',  Zeff: Z_EFF.H_1s, coefficient:  0.40 },
          { atomIndex: 1, orbitalKey: '3px', Zeff: Z_EFF.Cl_3p, coefficient: -0.85 },
        ],
      },
      // 2 lone pairs perpendiculares (3py, 3pz)
      makeLonePair(1, '3py', Z_EFF.Cl_3p, -13, 'Cl 3py lp'),
      makeLonePair(1, '3pz', Z_EFF.Cl_3p, -13, 'Cl 3pz lp'),
    ],
  };
})();

// ═══════════════════════════════════════════════════════════════
// NaCl (gas) — iónico, dipolo enorme
// ═══════════════════════════════════════════════════════════════
export const NaCl: Molecule3D = (() => {
  const R = CANONICAL_GEOMETRY.NaCl.NaCl * A2B;
  return {
    name: 'Cloruro de sodio (g)',
    formula: 'NaCl',
    bondLength: R,
    atoms: [
      { element: 'Na', Z: 11, position: [-R / 2, 0, 0] },
      { element: 'Cl', Z: 17, position: [ R / 2, 0, 0] },
    ],
    description:
      'Iónico (μ = 9.0 D experimental, casi 100% transferencia electrónica). ' +
      'El electrón 3s del Na se va al 3p del Cl → Na⁺ con configuración de Ne, Cl⁻ con configuración de Ar.',
    mos: [
      // Transferencia electrónica: el "σ bonding" tiene casi todo el peso en Cl
      {
        name: 'σ (Na→Cl, iónico)', occupancy: 2, symmetry: 'bonding', energy: -12,
        coefficients: [
          { atomIndex: 0, orbitalKey: '3s',  Zeff: Z_EFF.Na_3s, coefficient:  0.10 },
          { atomIndex: 1, orbitalKey: '3px', Zeff: Z_EFF.Cl_3p, coefficient: -0.99 },
        ],
      },
      makeLonePair(1, '3s', Z_EFF.Cl_3p, -28, 'Cl 3s'),
      makeLonePair(1, '3py', Z_EFF.Cl_3p, -13, 'Cl 3py'),
      makeLonePair(1, '3pz', Z_EFF.Cl_3p, -13, 'Cl 3pz'),
    ],
  };
})();

// ═══════════════════════════════════════════════════════════════
// C₆H₆ (benceno) — hexágono plano aromático, sp²
// ═══════════════════════════════════════════════════════════════
export const C6H6: Molecule3D = (() => {
  const Rcc = CANONICAL_GEOMETRY.C6H6.CC * A2B;
  const Rch = CANONICAL_GEOMETRY.C6H6.CH * A2B;
  // 6 C en hexágono regular, radio Rcc (distancia centro-vértice).
  const atoms: AtomInMolecule[] = [];
  for (let i = 0; i < 6; i++) {
    const θ = (i * Math.PI) / 3;
    atoms.push({ element: 'C', Z: 6, position: [Rcc * Math.cos(θ), Rcc * Math.sin(θ), 0] });
  }
  for (let i = 0; i < 6; i++) {
    const θ = (i * Math.PI) / 3;
    const rH = Rcc + Rch;
    atoms.push({ element: 'H', Z: 1, position: [rH * Math.cos(θ), rH * Math.sin(θ), 0] });
  }

  // Para el viz: 6 σ C-C + 6 σ C-H + el sistema π aromático (6 MOs, 3 ocupados)
  const mos: MolecularOrbital[] = [];
  // σ C-C (entre carbonos consecutivos)
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    mos.push({
      name: `σ C${i + 1}-C${j + 1}`, occupancy: 2, symmetry: 'bonding', energy: -16,
      coefficients: [
        { atomIndex: i, orbitalKey: '2px', Zeff: Z_EFF.C_2sp, coefficient: 0.50 },
        { atomIndex: j, orbitalKey: '2px', Zeff: Z_EFF.C_2sp, coefficient: 0.50 },
      ],
    });
  }
  // σ C-H
  for (let i = 0; i < 6; i++) {
    mos.push(makeSigmaBond(i, '2py', Z_EFF.C_2sp, 6 + i, '1s', Z_EFF.H_1s, -15, 0.50, 0.55));
  }
  // π aromático: 3 MOs bonding, todos ocupados con 2 e⁻ (sextet aromático).
  // Coeficientes simétricos para el π_1 (bonding total) — todos los 2pz suman en fase.
  mos.push({
    name: 'π₁ (sextet)', occupancy: 2, symmetry: 'bonding', energy: -12,
    coefficients: Array.from({ length: 6 }, (_, i) => ({
      atomIndex: i, orbitalKey: '2pz' as const, Zeff: Z_EFF.C_2sp, coefficient: 0.41,
    })),
  });
  // π₂ y π₃ son degenerados (nodos a través de carbonos opuestos)
  mos.push({
    name: 'π₂', occupancy: 2, symmetry: 'bonding', energy: -10,
    coefficients: [
      { atomIndex: 0, orbitalKey: '2pz', Zeff: Z_EFF.C_2sp, coefficient:  0.50 },
      { atomIndex: 1, orbitalKey: '2pz', Zeff: Z_EFF.C_2sp, coefficient:  0.25 },
      { atomIndex: 2, orbitalKey: '2pz', Zeff: Z_EFF.C_2sp, coefficient: -0.25 },
      { atomIndex: 3, orbitalKey: '2pz', Zeff: Z_EFF.C_2sp, coefficient: -0.50 },
      { atomIndex: 4, orbitalKey: '2pz', Zeff: Z_EFF.C_2sp, coefficient: -0.25 },
      { atomIndex: 5, orbitalKey: '2pz', Zeff: Z_EFF.C_2sp, coefficient:  0.25 },
    ],
  });
  mos.push({
    name: 'π₃', occupancy: 2, symmetry: 'bonding', energy: -10,
    coefficients: [
      { atomIndex: 0, orbitalKey: '2pz', Zeff: Z_EFF.C_2sp, coefficient:  0.00 },
      { atomIndex: 1, orbitalKey: '2pz', Zeff: Z_EFF.C_2sp, coefficient:  0.43 },
      { atomIndex: 2, orbitalKey: '2pz', Zeff: Z_EFF.C_2sp, coefficient:  0.43 },
      { atomIndex: 3, orbitalKey: '2pz', Zeff: Z_EFF.C_2sp, coefficient:  0.00 },
      { atomIndex: 4, orbitalKey: '2pz', Zeff: Z_EFF.C_2sp, coefficient: -0.43 },
      { atomIndex: 5, orbitalKey: '2pz', Zeff: Z_EFF.C_2sp, coefficient: -0.43 },
    ],
  });

  return {
    name: 'Benceno',
    formula: 'C₆H₆',
    bondLength: Rcc,
    atoms,
    description:
      'Hexágono plano aromático. 6 σ C-C (1.397 Å, intermedio entre simple y doble) + ' +
      '6 σ C-H. El sextet π deslocalizado en los 6 anillos 2pz hace al benceno excepcionalmente estable ' +
      '(energía de resonancia ~150 kJ/mol). Hückel (1931): aromático si 4n+2 e⁻ π.',
    mos,
  };
})();

/** Catálogo completo de moléculas canónicas del set obligatorio. */
export const CANONICAL_CATALOG: Molecule3D[] = [
  H2O, CH4, NH3, CO2, C2H4, C2H2, HCl, NaCl, C6H6,
];
