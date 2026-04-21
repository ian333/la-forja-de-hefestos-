/**
 * 20 standard amino acids + canonical genetic code.
 *
 * One-letter / three-letter codes follow IUPAC. Property classification
 * matches textbook biochemistry (Lehninger, 7th ed.).
 */

export type AACode = 'A'|'R'|'N'|'D'|'C'|'E'|'Q'|'G'|'H'|'I'|'L'|'K'|'M'|'F'|'P'|'S'|'T'|'W'|'Y'|'V';

export type AAProperty =
  | 'hydrophobic'
  | 'polar'
  | 'acidic'     // negatively charged at pH 7
  | 'basic'      // positively charged at pH 7
  | 'special';   // G (flexible), P (rigid), C (disulfide)

export interface AAInfo {
  code: AACode;
  three: string;
  name: string;
  property: AAProperty;
  color: string;       // color by property (PyMOL / Shapely compromise)
  mass: number;        // Da, residue monoisotopic
}

export const AMINO_ACIDS: Record<AACode, AAInfo> = {
  A: { code: 'A', three: 'ALA', name: 'Alanina',       property: 'hydrophobic', color: '#9E9E9E', mass: 71.04 },
  V: { code: 'V', three: 'VAL', name: 'Valina',        property: 'hydrophobic', color: '#90A4AE', mass: 99.07 },
  L: { code: 'L', three: 'LEU', name: 'Leucina',       property: 'hydrophobic', color: '#78909C', mass: 113.08 },
  I: { code: 'I', three: 'ILE', name: 'Isoleucina',    property: 'hydrophobic', color: '#607D8B', mass: 113.08 },
  M: { code: 'M', three: 'MET', name: 'Metionina',     property: 'hydrophobic', color: '#B0BEC5', mass: 131.04 },
  F: { code: 'F', three: 'PHE', name: 'Fenilalanina',  property: 'hydrophobic', color: '#455A64', mass: 147.07 },
  W: { code: 'W', three: 'TRP', name: 'Triptófano',    property: 'hydrophobic', color: '#37474F', mass: 186.08 },
  P: { code: 'P', three: 'PRO', name: 'Prolina',       property: 'special',     color: '#FFA726', mass: 97.05 },
  G: { code: 'G', three: 'GLY', name: 'Glicina',       property: 'special',     color: '#FFCC80', mass: 57.02 },
  S: { code: 'S', three: 'SER', name: 'Serina',        property: 'polar',       color: '#81D4FA', mass: 87.03 },
  T: { code: 'T', three: 'THR', name: 'Treonina',      property: 'polar',       color: '#4FC3F7', mass: 101.05 },
  C: { code: 'C', three: 'CYS', name: 'Cisteína',      property: 'special',     color: '#FFEE58', mass: 103.01 },
  Y: { code: 'Y', three: 'TYR', name: 'Tirosina',      property: 'polar',       color: '#29B6F6', mass: 163.06 },
  N: { code: 'N', three: 'ASN', name: 'Asparagina',    property: 'polar',       color: '#4DD0E1', mass: 114.04 },
  Q: { code: 'Q', three: 'GLN', name: 'Glutamina',     property: 'polar',       color: '#26C6DA', mass: 128.06 },
  D: { code: 'D', three: 'ASP', name: 'Aspartato',     property: 'acidic',      color: '#EF5350', mass: 115.03 },
  E: { code: 'E', three: 'GLU', name: 'Glutamato',     property: 'acidic',      color: '#E53935', mass: 129.04 },
  K: { code: 'K', three: 'LYS', name: 'Lisina',        property: 'basic',       color: '#42A5F5', mass: 128.09 },
  R: { code: 'R', three: 'ARG', name: 'Arginina',      property: 'basic',       color: '#1E88E5', mass: 156.10 },
  H: { code: 'H', three: 'HIS', name: 'Histidina',     property: 'basic',       color: '#7E57C2', mass: 137.06 },
};

/** Map from 3-letter code → 1-letter code. Unknown residues → 'X'. */
export function threeToOne(three: string): AACode | 'X' {
  const t = three.toUpperCase();
  for (const a of Object.values(AMINO_ACIDS)) if (a.three === t) return a.code;
  return 'X';
}

/**
 * Standard genetic code (NCBI table 1). Codons are RNA (U, not T).
 * Stop codons (UAA, UAG, UGA) mapped to '*'.
 */
export const GENETIC_CODE: Record<string, AACode | '*'> = {
  UUU: 'F', UUC: 'F', UUA: 'L', UUG: 'L',
  CUU: 'L', CUC: 'L', CUA: 'L', CUG: 'L',
  AUU: 'I', AUC: 'I', AUA: 'I', AUG: 'M',
  GUU: 'V', GUC: 'V', GUA: 'V', GUG: 'V',
  UCU: 'S', UCC: 'S', UCA: 'S', UCG: 'S',
  CCU: 'P', CCC: 'P', CCA: 'P', CCG: 'P',
  ACU: 'T', ACC: 'T', ACA: 'T', ACG: 'T',
  GCU: 'A', GCC: 'A', GCA: 'A', GCG: 'A',
  UAU: 'Y', UAC: 'Y', UAA: '*', UAG: '*',
  CAU: 'H', CAC: 'H', CAA: 'Q', CAG: 'Q',
  AAU: 'N', AAC: 'N', AAA: 'K', AAG: 'K',
  GAU: 'D', GAC: 'D', GAA: 'E', GAG: 'E',
  UGU: 'C', UGC: 'C', UGA: '*', UGG: 'W',
  CGU: 'R', CGC: 'R', CGA: 'R', CGG: 'R',
  AGU: 'S', AGC: 'S', AGA: 'R', AGG: 'R',
  GGU: 'G', GGC: 'G', GGA: 'G', GGG: 'G',
};

/** Translate an mRNA sequence (U not T) to single-letter protein. Stop → end. */
export function translate(rna: string): string {
  const r = rna.toUpperCase().replace(/T/g, 'U').replace(/[^AUGC]/g, '');
  let out = '';
  for (let i = 0; i + 3 <= r.length; i += 3) {
    const aa = GENETIC_CODE[r.substr(i, 3)];
    if (!aa) break;
    if (aa === '*') break;
    out += aa;
  }
  return out;
}
