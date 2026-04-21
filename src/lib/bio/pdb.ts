/**
 * Parser for Protein Data Bank (PDB) v3.3 fixed-width records.
 *
 * Format reference: https://www.wwpdb.org/documentation/file-format-content/format33/
 *
 * We parse ATOM, HETATM, HELIX, SHEET, CONECT. Everything else is ignored —
 * the PDB format has plenty of metadata we don't need for visualization.
 *
 * PDB columns are 1-indexed in the spec; JS substr is 0-indexed, so all
 * parsing offsets below have been converted. Ångström throughout.
 */

export type Element =
  | 'H' | 'C' | 'N' | 'O' | 'S' | 'P' | 'F' | 'CL' | 'BR' | 'I'
  | 'FE' | 'ZN' | 'MG' | 'CA' | 'NA' | 'K' | 'MN' | 'CU' | 'NI' | 'CO'
  | 'SE' | 'MO' | 'UNK';

export interface Atom {
  /** PDB serial number (sequential within the file). */
  serial: number;
  /** 4-character atom name, e.g. 'CA', 'CB', 'N', 'O' (stripped of padding). */
  name: string;
  /** Chemical element. */
  element: Element;
  /** 3-letter residue name, e.g. 'ALA', 'LEU'. */
  resName: string;
  /** Chain identifier, e.g. 'A'. */
  chainId: string;
  /** Author-assigned residue number (may have gaps/insertion codes). */
  resSeq: number;
  /** Position in Å. */
  pos: [number, number, number];
  /** B-factor (Å²). */
  bFactor: number;
  /** True for HETATM records (ligands, cofactors, waters). */
  hetero: boolean;
}

export interface Residue {
  chainId: string;
  resSeq: number;
  resName: string;
  /** One-letter amino-acid code, or 'X' if non-canonical. */
  oneLetter: string;
  atoms: Atom[];
  /** Secondary-structure class assigned from HELIX/SHEET records. 'L' = loop. */
  ss: 'H' | 'E' | 'L';
}

export interface Chain {
  id: string;
  residues: Residue[];
}

export interface Structure {
  atoms: Atom[];
  chains: Chain[];
  /** HETATM atoms grouped by residue (ligand/cofactor/water). */
  hetGroups: Residue[];
  /** Bounding box (Å). */
  bbox: { min: [number, number, number]; max: [number, number, number]; center: [number, number, number] };
  header?: string;
  title?: string;
}

const HELIX_AA = 'H';
const SHEET_AA = 'E';
const COIL     = 'L';

const CANONICAL_AA = new Set([
  'ALA','ARG','ASN','ASP','CYS','GLN','GLU','GLY','HIS','ILE',
  'LEU','LYS','MET','PHE','PRO','SER','THR','TRP','TYR','VAL',
  // non-standard tautomers / selenocys / pyrrolysine
  'SEC','PYL','MSE',
]);

const THREE_TO_ONE: Record<string, string> = {
  ALA:'A',ARG:'R',ASN:'N',ASP:'D',CYS:'C',GLN:'Q',GLU:'E',GLY:'G',HIS:'H',ILE:'I',
  LEU:'L',LYS:'K',MET:'M',PHE:'F',PRO:'P',SER:'S',THR:'T',TRP:'W',TYR:'Y',VAL:'V',
  SEC:'U',PYL:'O',MSE:'M',
};

export function parsePDB(text: string): Structure {
  const atoms: Atom[] = [];
  const helixRanges: { chainId: string; start: number; end: number }[] = [];
  const sheetRanges: { chainId: string; start: number; end: number }[] = [];
  let header: string | undefined;
  let title: string | undefined;

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const tag = line.substring(0, 6);
    if (tag === 'HEADER') {
      header = line.substring(10, 50).trim();
    } else if (tag === 'TITLE ') {
      title = (title ? title + ' ' : '') + line.substring(10, 80).trim();
    } else if (tag === 'ATOM  ' || tag === 'HETATM') {
      const serial = parseInt(line.substring(6, 11).trim(), 10);
      const name   = line.substring(12, 16).trim();
      const resName = line.substring(17, 20).trim();
      const chainId = line.substring(21, 22).trim() || ' ';
      const resSeq  = parseInt(line.substring(22, 26).trim(), 10);
      const x = parseFloat(line.substring(30, 38));
      const y = parseFloat(line.substring(38, 46));
      const z = parseFloat(line.substring(46, 54));
      const bFactor = parseFloat(line.substring(60, 66)) || 0;
      let element = (line.substring(76, 78).trim() || guessElement(name)).toUpperCase();
      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;
      atoms.push({
        serial, name, element: (element as Element),
        resName, chainId, resSeq,
        pos: [x, y, z], bFactor, hetero: tag === 'HETATM',
      });
    } else if (tag === 'HELIX ') {
      const chainId = line.substring(19, 20).trim() || ' ';
      const start   = parseInt(line.substring(21, 25).trim(), 10);
      const end     = parseInt(line.substring(33, 37).trim(), 10);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        helixRanges.push({ chainId, start, end });
      }
    } else if (tag === 'SHEET ') {
      const chainId = line.substring(21, 22).trim() || ' ';
      const start   = parseInt(line.substring(22, 26).trim(), 10);
      const end     = parseInt(line.substring(33, 37).trim(), 10);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        sheetRanges.push({ chainId, start, end });
      }
    } else if (tag === 'ENDMDL') {
      // Multi-model files (NMR) — take only the first model for viz.
      break;
    }
  }

  // Group atoms into residues per chain.
  const chainsMap = new Map<string, Map<string, Residue>>();
  const hetGroupsMap = new Map<string, Residue>();
  for (const a of atoms) {
    const resKey = `${a.chainId}|${a.resSeq}|${a.resName}`;
    if (a.hetero && !CANONICAL_AA.has(a.resName)) {
      let r = hetGroupsMap.get(resKey);
      if (!r) {
        r = {
          chainId: a.chainId, resSeq: a.resSeq, resName: a.resName,
          oneLetter: 'X', atoms: [], ss: COIL,
        };
        hetGroupsMap.set(resKey, r);
      }
      r.atoms.push(a);
    } else {
      let chain = chainsMap.get(a.chainId);
      if (!chain) { chain = new Map(); chainsMap.set(a.chainId, chain); }
      let r = chain.get(resKey);
      if (!r) {
        r = {
          chainId: a.chainId, resSeq: a.resSeq, resName: a.resName,
          oneLetter: THREE_TO_ONE[a.resName] ?? 'X',
          atoms: [], ss: COIL,
        };
        chain.set(resKey, r);
      }
      r.atoms.push(a);
    }
  }

  // Apply secondary-structure assignment from HELIX / SHEET ranges.
  for (const h of helixRanges) {
    const chain = chainsMap.get(h.chainId);
    if (!chain) continue;
    for (const r of chain.values()) {
      if (r.resSeq >= h.start && r.resSeq <= h.end) r.ss = HELIX_AA as 'H';
    }
  }
  for (const s of sheetRanges) {
    const chain = chainsMap.get(s.chainId);
    if (!chain) continue;
    for (const r of chain.values()) {
      if (r.resSeq >= s.start && r.resSeq <= s.end) r.ss = SHEET_AA as 'E';
    }
  }

  const chains: Chain[] = [];
  for (const [id, resMap] of chainsMap) {
    const residues = Array.from(resMap.values()).sort((a, b) => a.resSeq - b.resSeq);
    chains.push({ id, residues });
  }
  chains.sort((a, b) => a.id.localeCompare(b.id));

  // Bounding box over all ATOM records (ignore waters in bbox to keep focus
  // on the macromolecule).
  let xmin = +Infinity, ymin = +Infinity, zmin = +Infinity;
  let xmax = -Infinity, ymax = -Infinity, zmax = -Infinity;
  for (const a of atoms) {
    if (a.hetero && a.resName === 'HOH') continue;
    if (a.pos[0] < xmin) xmin = a.pos[0]; if (a.pos[0] > xmax) xmax = a.pos[0];
    if (a.pos[1] < ymin) ymin = a.pos[1]; if (a.pos[1] > ymax) ymax = a.pos[1];
    if (a.pos[2] < zmin) zmin = a.pos[2]; if (a.pos[2] > zmax) zmax = a.pos[2];
  }
  if (!isFinite(xmin)) { xmin = ymin = zmin = 0; xmax = ymax = zmax = 0; }

  return {
    atoms,
    chains,
    hetGroups: Array.from(hetGroupsMap.values()),
    bbox: {
      min: [xmin, ymin, zmin],
      max: [xmax, ymax, zmax],
      center: [(xmin + xmax) / 2, (ymin + ymax) / 2, (zmin + zmax) / 2],
    },
    header,
    title,
  };
}

/**
 * Element guess from atom name for files missing the element column (77-78).
 * PDB atom names are left-aligned for 1-char elements (e.g. ' CA ') and
 * 2-char ones fill the first two columns (e.g. 'FE  ', 'MG  ').
 */
function guessElement(name: string): string {
  const n = name.trim().toUpperCase();
  if (n.startsWith('HE') || n.startsWith('HG') || n.startsWith('HF')) return n.substring(0, 2);
  if (['FE','MG','ZN','MN','CU','NI','CO','SE','MO','CL','BR','NA','CA'].includes(n)) return n;
  if (n.length >= 2 && 'FCNOSPI'.includes(n[0])) return n[0];
  // Greek-letter atoms like CA, CB, CG are all carbon except CA for calcium
  // (which only appears outside amino acids). Inside an amino acid 'CA' means
  // alpha carbon. guess_element is a fallback — the PDB element column is
  // preferred when present.
  return n[0] || 'UNK';
}

/** Van der Waals radii (Å) for the common elements. */
export const VDW_RADIUS: Partial<Record<Element, number>> = {
  H: 1.20, C: 1.70, N: 1.55, O: 1.52, S: 1.80, P: 1.80,
  F: 1.47, CL: 1.75, BR: 1.85, I: 1.98,
  FE: 1.94, ZN: 1.39, MG: 1.73, CA: 1.97, NA: 2.27, K: 2.75,
  MN: 1.73, CU: 1.40, NI: 1.63, CO: 1.80, SE: 1.90, MO: 2.10,
  UNK: 1.60,
};

/** CPK-style element colors (Corey-Pauling-Koltun convention, as used by PyMOL). */
export const ELEMENT_COLOR: Partial<Record<Element, string>> = {
  H:  '#FFFFFF',
  C:  '#8A8A8A',
  N:  '#3050F8',
  O:  '#FF0D0D',
  S:  '#FFFF30',
  P:  '#FF8000',
  F:  '#90E050',
  CL: '#1FF01F',
  BR: '#A62929',
  I:  '#940094',
  FE: '#E06633',
  ZN: '#7D80B0',
  MG: '#8AFF00',
  CA: '#3DFF00',
  NA: '#AB5CF2',
  K:  '#8F40D4',
  MN: '#9C7AC7',
  CU: '#C88033',
  NI: '#50D050',
  CO: '#F090A0',
  SE: '#FFA100',
  MO: '#54B5B5',
  UNK:'#AAAAAA',
};

/** Coarse covalent radii (Å) — used to infer bonds by distance when CONECT is absent. */
export const COVALENT_RADIUS: Partial<Record<Element, number>> = {
  H: 0.31, C: 0.76, N: 0.71, O: 0.66, S: 1.05, P: 1.07,
  F: 0.57, CL: 1.02, BR: 1.20, I: 1.39,
  FE: 1.32, ZN: 1.22, MG: 1.41, CA: 1.76, NA: 1.66, K: 2.03,
  MN: 1.39, CU: 1.32, NI: 1.24, CO: 1.26, SE: 1.20, MO: 1.54,
  UNK: 1.00,
};

/** Return atom by name within a residue, or null. */
export function atomByName(res: Residue, name: string): Atom | null {
  for (const a of res.atoms) if (a.name === name) return a;
  return null;
}
