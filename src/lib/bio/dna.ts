/**
 * Canonical B-form DNA geometry.
 *
 * Parameters are the standard fiber-diffraction values from
 *   Arnott, S. & Hukins, D.W.L. (1972) "Optimised parameters for A-DNA and
 *   B-DNA", Biochem. Biophys. Res. Commun. 47, 1504-1509
 * with cross-checks against
 *   Olson et al. (2001) "A standard reference frame for the description of
 *   nucleic acid base-pair geometry", J. Mol. Biol. 313, 229-237
 *
 * Units are ångström (1 Å = 0.1 nm). Everything downstream stays in Å so
 * callers can render in Å directly — at 80 bp the duplex is 272 Å long,
 * comfortably inside a typical camera frustum.
 *
 * The helical axis is +z. Phosphate positions on strand 1 follow a right-handed
 * helix starting at θ = 0. Strand 2 (antiparallel) is rotated by +155° around
 * the axis so that the **minor** groove sits between the two backbones on
 * that side and the 205° gap on the opposite side is the **major** groove.
 */

export const B_DNA = {
  /** Rise per base pair (Å). */
  rise: 3.40,
  /** Helical twist per base pair (°). 10.5 bp/turn → 360/10.5 ≈ 34.29°. */
  twistDeg: 34.29,
  /** Phosphate radial distance from the helical axis (Å). */
  rPhosphate: 9.4,
  /** C1' (sugar) radial distance from the helical axis (Å). */
  rSugar: 5.9,
  /** Base N1/N9 (glycosidic nitrogen) radial distance from axis (Å). */
  rBaseEdge: 3.5,
  /**
   * Angular offset of strand 2's phosphates relative to strand 1's (°).
   * 155° is the minor-groove-side separation; the remaining 205° is the
   * major-groove side. This asymmetry is the visual signature of B-DNA.
   */
  grooveOffsetDeg: 155,
  /** Published groove widths (Å), phosphate-to-phosphate across the groove. */
  minorGrooveWidth: 11.7,
  majorGrooveWidth: 22.7,
  /** Published groove depths (Å) from van der Waals surface to center. */
  minorGrooveDepth: 7.5,
  majorGrooveDepth: 8.5,
} as const;

export type Base = 'A' | 'T' | 'G' | 'C';

export const COMPLEMENT: Record<Base, Base> = { A: 'T', T: 'A', G: 'C', C: 'G' };

/**
 * Colors follow a pragmatic extension of the ChemDraw base palette: each
 * base has a distinct hue so the viewer can read A-T vs G-C pairs at a
 * glance. Purines (A, G) are warm; pyrimidines (T, C) are cool.
 */
export const BASE_COLOR: Record<Base, string> = {
  A: '#4CAF50', // green   — adenine   (purine)
  T: '#E53935', // red     — thymine   (pyrimidine)
  G: '#FFB300', // amber   — guanine   (purine)
  C: '#29B6F6', // cyan    — cytosine  (pyrimidine)
};

/** Watson-Crick H-bond counts: A-T = 2, G-C = 3. */
export function hbondsFor(base: Base): number {
  return base === 'A' || base === 'T' ? 2 : 3;
}

export function isPurine(base: Base): boolean {
  return base === 'A' || base === 'G';
}

/** Complement of a 5'→3' sequence, returned 3'→5' (as read on the other strand). */
export function complement(seq: string): string {
  let out = '';
  for (const c of seq.toUpperCase()) {
    if (c === 'A' || c === 'T' || c === 'G' || c === 'C') out += COMPLEMENT[c as Base];
    else out += 'N';
  }
  return out;
}

/** Reverse-complement (reads 5'→3' on the antisense strand). */
export function reverseComplement(seq: string): string {
  return complement(seq).split('').reverse().join('');
}

/** GC content as a fraction ∈ [0, 1]. */
export function gcContent(seq: string): number {
  const s = seq.toUpperCase();
  let gc = 0, n = 0;
  for (const c of s) {
    if (c === 'G' || c === 'C') { gc++; n++; }
    else if (c === 'A' || c === 'T') { n++; }
  }
  return n === 0 ? 0 : gc / n;
}

/**
 * Wallace rule melting temperature (°C), valid for short oligos (< 14 bp).
 *   Tm = 2(A+T) + 4(G+C)
 * For longer sequences, nearest-neighbor thermodynamics (SantaLucia 1998)
 * would be more accurate — left as a future enhancement.
 */
export function tmWallace(seq: string): number {
  const s = seq.toUpperCase();
  let at = 0, gc = 0;
  for (const c of s) {
    if (c === 'A' || c === 'T') at++;
    else if (c === 'G' || c === 'C') gc++;
  }
  return 2 * at + 4 * gc;
}

export interface HelixAtom {
  /** Base pair index, 0-based, 5'→3' on strand 1. */
  i: number;
  /** Base identity on this strand. */
  base: Base;
  /** Which strand (1 = sense, 2 = antisense). */
  strand: 1 | 2;
  /** Phosphate position in Å. */
  p: [number, number, number];
  /** Sugar (C1') position in Å. */
  c1: [number, number, number];
  /** Base edge (N1/N9) position in Å. */
  baseEdge: [number, number, number];
}

export interface BasePairFrame {
  i: number;
  z: number;
  /** Angular position of strand 1's phosphate (rad). */
  theta: number;
  base1: Base;
  base2: Base;
}

/**
 * Build atom positions for the full duplex given a 5'→3' sequence.
 *
 * Strand 1 runs 5'→3' from z=0 up to z=(N-1)·rise.
 * Strand 2 is antiparallel — it runs 3'→5' on the same z-range when indexed
 * by base-pair i; the base at bp i on strand 2 is `complement(seq[i])`.
 */
export function buildDuplex(seq: string): {
  atoms: HelixAtom[];
  frames: BasePairFrame[];
  lengthA: number;
  turns: number;
} {
  const s = seq.toUpperCase().replace(/[^ATGC]/g, '');
  const N = s.length;
  const atoms: HelixAtom[] = [];
  const frames: BasePairFrame[] = [];
  const twistRad = (B_DNA.twistDeg * Math.PI) / 180;
  const offsetRad = (B_DNA.grooveOffsetDeg * Math.PI) / 180;
  for (let i = 0; i < N; i++) {
    const theta = i * twistRad;
    const z = i * B_DNA.rise;
    const base1 = s[i] as Base;
    const base2 = COMPLEMENT[base1];

    // Strand 1 (sense)
    const p1: [number, number, number] = [
      B_DNA.rPhosphate * Math.cos(theta),
      B_DNA.rPhosphate * Math.sin(theta),
      z,
    ];
    const c1_1: [number, number, number] = [
      B_DNA.rSugar * Math.cos(theta),
      B_DNA.rSugar * Math.sin(theta),
      z,
    ];
    const be_1: [number, number, number] = [
      B_DNA.rBaseEdge * Math.cos(theta),
      B_DNA.rBaseEdge * Math.sin(theta),
      z,
    ];
    atoms.push({ i, base: base1, strand: 1, p: p1, c1: c1_1, baseEdge: be_1 });

    // Strand 2 (antisense), rotated by +grooveOffset
    const theta2 = theta + offsetRad;
    const p2: [number, number, number] = [
      B_DNA.rPhosphate * Math.cos(theta2),
      B_DNA.rPhosphate * Math.sin(theta2),
      z,
    ];
    const c1_2: [number, number, number] = [
      B_DNA.rSugar * Math.cos(theta2),
      B_DNA.rSugar * Math.sin(theta2),
      z,
    ];
    const be_2: [number, number, number] = [
      B_DNA.rBaseEdge * Math.cos(theta2),
      B_DNA.rBaseEdge * Math.sin(theta2),
      z,
    ];
    atoms.push({ i, base: base2, strand: 2, p: p2, c1: c1_2, baseEdge: be_2 });

    frames.push({ i, z, theta, base1, base2 });
  }
  return {
    atoms,
    frames,
    lengthA: N * B_DNA.rise,
    turns: (N * B_DNA.twistDeg) / 360,
  };
}

/**
 * Human telomeric repeat on the leading strand (Blackburn 1978):
 *   5'-TTAGGG-3' (sense) / 3'-AATCCC-5' (antisense)
 */
export const HUMAN_TELOMERE_REPEAT = 'TTAGGG';

/**
 * TATA box consensus (Goldberg-Hogness; core eukaryotic promoter).
 * Context bases added on either side so the helix has enough length
 * to show a full turn.
 */
export const TATA_CONTEXT = 'CGGATATAAAACGGCTAG';

/**
 * Fragment of the human BRCA1 gene's coding sequence near exon 11.
 * Taken from GenBank NM_007294 (the canonical BRCA1 mRNA) for
 * demonstration — this is a real human sequence, not synthetic.
 */
export const BRCA1_FRAGMENT =
  'ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAGAAA';
