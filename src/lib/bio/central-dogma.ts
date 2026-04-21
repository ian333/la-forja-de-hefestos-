/**
 * Dogma central de la biología molecular: DNA → mRNA → proteína.
 *
 * Máquina de estados que avanza la transcripción y la traducción en
 * tiempo físico. La geometría espacial se calcula aquí (posición del RNAP
 * sobre el template strand, camino del mRNA hacia el ribosoma, longitud
 * de la cadena polipeptídica) para que el render sea puramente visual.
 *
 *   Template strand (3'→5'):   ...complemento del coding strand...
 *   Coding/sense strand (5'→3'): A C G T → T se convierte en U al
 *   transcribirse. El mRNA es una copia del coding strand (con U).
 *
 * Velocidades físicas reales (referencia, no usadas directamente en el
 * playback del simulador — el usuario ajusta con un slider):
 *   RNAP II eucariota:  ~30 nt/s  (Ardehali & Lis 2009)
 *   Ribosoma eucariota: ~6 aa/s   (Ingolia et al. 2011)
 */

import { GENETIC_CODE, type AACode } from './aminoacids';
import { complement, type Base } from './dna';

export type Phase =
  | 'transcribing'  // RNAP moviéndose sobre la plantilla, mRNA creciendo
  | 'transport'     // mRNA viajando del núcleo al ribosoma
  | 'translating'   // ribosoma leyendo codones, cadena creciendo
  | 'done';

export interface Codon {
  i: number;              // índice de codón 0..N
  rna: string;            // 3 letras RNA (AUGC)
  aa: AACode | '*';       // amino ácido codificado o stop
}

export interface CentralDogmaPreset {
  id: string;
  name: string;
  /** Coding/sense strand en DNA (A,T,G,C). Debe empezar con ATG y terminar con stop. */
  codingDna: string;
  note: string;
  /** Etiqueta para el paso biológico (gen, producto). */
  gene: string;
  product: string;
}

export interface CentralDogmaState {
  phase: Phase;
  /** Nucleótido actual del RNAP sobre la plantilla (0..N). */
  rnapIndex: number;
  /** Longitud del mRNA transcrita hasta ahora (nt). */
  mrnaLength: number;
  /** Índice de codón actualmente en el sitio A del ribosoma (0..totalCodons-1). */
  ribosomeCodon: number;
  /** Longitud de la cadena polipeptídica (aa, sin incluir el AA pendiente). */
  proteinLength: number;
  /** Progreso del transporte núcleo→ribosoma (0..1). */
  transportT: number;
  /** Tiempo total del simulador (s). */
  elapsed: number;
}

/**
 * Preprocesamiento: deriva template strand, mRNA completo, codones y
 * traducción de la secuencia coding. La traducción para en el primer stop.
 */
export interface CentralDogmaData {
  coding: string;        // coding strand 5'→3' (ATGC)
  template: string;      // template strand 3'→5' (ATGC, complementaria)
  mrna: string;          // mRNA completo 5'→3' (AUGC)
  codons: Codon[];       // todos los codones hasta el stop (inclusive)
  protein: string;       // secuencia de aminoácidos (1-letter)
  stopIndex: number;     // índice del codón stop en `codons` (codons[stopIndex].aa === '*')
}

export function buildCentralDogma(coding: string): CentralDogmaData {
  const c = coding.toUpperCase().replace(/[^ATGC]/g, '');
  const template = complement(c); // antiparalelo, pero letras invertidas posicionalmente
  const mrna = c.replace(/T/g, 'U');
  const codons: Codon[] = [];
  let protein = '';
  let stopIndex = -1;
  for (let i = 0; i * 3 + 3 <= mrna.length; i++) {
    const rna = mrna.substr(i * 3, 3);
    const aa = GENETIC_CODE[rna];
    if (!aa) break;
    codons.push({ i, rna, aa });
    if (aa === '*') { stopIndex = i; break; }
    protein += aa;
  }
  return { coding: c, template, mrna, codons, protein, stopIndex };
}

export interface DogmaRates {
  /** Nucleótidos por segundo transcritos por el RNAP. */
  ntPerSecond: number;
  /** Duración del transporte núcleo→ribosoma (s). */
  transportSeconds: number;
  /** Aminoácidos por segundo traducidos por el ribosoma. */
  aaPerSecond: number;
}

export const DEFAULT_RATES: DogmaRates = {
  ntPerSecond: 30,
  transportSeconds: 1.0,
  aaPerSecond: 8,
};

export function initialState(): CentralDogmaState {
  return {
    phase: 'transcribing',
    rnapIndex: 0,
    mrnaLength: 0,
    ribosomeCodon: 0,
    proteinLength: 0,
    transportT: 0,
    elapsed: 0,
  };
}

/**
 * Avanza el estado en `dt` segundos.
 * Pure function: devuelve nuevo estado, no muta.
 */
export function stepDogma(
  state: CentralDogmaState,
  data: CentralDogmaData,
  rates: DogmaRates,
  dt: number,
): CentralDogmaState {
  const s = { ...state, elapsed: state.elapsed + dt };
  const N = data.coding.length;
  const nCodons = data.codons.length; // incluye stop

  if (s.phase === 'transcribing') {
    const newIdx = Math.min(N, s.rnapIndex + rates.ntPerSecond * dt);
    s.rnapIndex = newIdx;
    s.mrnaLength = newIdx;
    if (newIdx >= N) s.phase = 'transport';
  } else if (s.phase === 'transport') {
    s.transportT = Math.min(1, s.transportT + dt / rates.transportSeconds);
    if (s.transportT >= 1) s.phase = 'translating';
  } else if (s.phase === 'translating') {
    const newCodon = Math.min(nCodons - 1, s.ribosomeCodon + rates.aaPerSecond * dt);
    s.ribosomeCodon = newCodon;
    // Cada codón leído (excepto el stop) añade un AA.
    const idx = Math.floor(newCodon);
    // AA count = codones leídos completamente que no son el stop.
    const stopIdx = data.stopIndex >= 0 ? data.stopIndex : nCodons;
    s.proteinLength = Math.min(stopIdx, idx);
    if (idx >= stopIdx) {
      s.ribosomeCodon = stopIdx;
      s.proteinLength = stopIdx;
      s.phase = 'done';
    }
  }

  return s;
}

/** Fuerza el estado al "done" final (todos los codones traducidos). */
export function finishedState(data: CentralDogmaData): CentralDogmaState {
  const stopIdx = data.stopIndex >= 0 ? data.stopIndex : data.codons.length;
  return {
    phase: 'done',
    rnapIndex: data.coding.length,
    mrnaLength: data.coding.length,
    ribosomeCodon: stopIdx,
    proteinLength: stopIdx,
    transportT: 1,
    elapsed: 0,
  };
}

/**
 * Secuencias reales (humanas) para los presets.
 *
 * - INS_B_CHAIN: región que codifica la cadena B de la insulina humana
 *   (30 aa). Extraída del CDS de INS (RefSeq NM_000207). Añadimos codon
 *   stop (UAA) para que el simulador termine.
 *
 * - TP53_DBD_FRAGMENT: 15 codones (45 nt) alrededor del hotspot R175
 *   del dominio de unión a DNA de p53 — el residuo mutado más
 *   frecuentemente en cáncer humano (IARC TP53 database).
 *
 * - BRCA1_FRAGMENT_START: primeros 60 nt (20 codones) del CDS de BRCA1
 *   (NM_007294), arrancando en el Met iniciador.
 */

const INS_B_CHAIN_CODING =
  'TTTGTGAACCAACACCTGTGCGGCTCACACCTGGTGGAAGCTCTCTACCTAGTGTGCGGG' +
  'GAACGAGGCTTCTTCTACACACCCAAGACC' + 'TAA';

const TP53_R175_CONTEXT_CODING =
  'ATGCCCCAGCATGCCTACATCGTCCGGCGCTGCCCCCACCATGAGCGCTGC' + 'TAA';

const BRCA1_START_CODING =
  'ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAG' + 'TAA';

const SYNTH_SHORT_CODING = 'ATGGCCAAGTTGATCGGAAGCGAATAA';

export const CENTRAL_DOGMA_PRESETS: CentralDogmaPreset[] = [
  {
    id: 'synth',
    name: 'Sintético corto (8 aa)',
    codingDna: SYNTH_SHORT_CODING,
    gene: 'sintético',
    product: 'MAKLIGSE*',
    note:
      '8 codones + stop. Útil para seguir cada paso sin que la pantalla se llene — inicia ATG, termina TAA.',
  },
  {
    id: 'insulin-b',
    name: 'Insulina humana (cadena B)',
    codingDna: INS_B_CHAIN_CODING,
    gene: 'INS (11p15.5)',
    product: 'FVNQHLCGSHLVEALYLVCGERGFFYTPKT',
    note:
      '30 aa de la cadena B de la insulina madura (RefSeq NM_000207). Descubierta por Banting & Best (1921); primera proteína recombinante aprobada (Humulin, 1982).',
  },
  {
    id: 'tp53-r175',
    name: 'p53 — hotspot R175',
    codingDna: TP53_R175_CONTEXT_CODING,
    gene: 'TP53 (17p13.1)',
    product: 'MPQHAYIVRRCPHHERC',
    note:
      '17 aa alrededor del residuo 175 del dominio de unión a DNA de p53. R175H es la mutación más frecuente en cáncer humano (IARC TP53 DB). El cambio A→G en el nt 524 convierte CGC (Arg) en CAC (His), destruyendo la estructura del DBD.',
  },
  {
    id: 'brca1',
    name: 'BRCA1 (N-terminal)',
    codingDna: BRCA1_START_CODING,
    gene: 'BRCA1 (17q21.31)',
    product: 'MDLSALRVEEVQNVINAMQ',
    note:
      '19 aa del extremo N-terminal de BRCA1 (NM_007294). Gen supresor tumoral — mutaciones de pérdida de función elevan riesgo de cáncer de mama / ovario 50-80%.',
  },
];
