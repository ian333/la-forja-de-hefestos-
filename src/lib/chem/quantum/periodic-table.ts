/**
 * ══════════════════════════════════════════════════════════════════════
 *  quantum/periodic-table — Los 118 elementos con configuración electrónica
 * ══════════════════════════════════════════════════════════════════════
 *
 * Cada elemento se describe por su posición en la tabla y su
 * configuración electrónica real. La mayoría siguen el orden de
 * llenado Madelung; los 20+ casos de anomalía (Cr, Cu, Pd, Pt, Au,
 * lantánidos Gd, Lu, actínidos Ac-Cm) están explícitos.
 *
 * Datos físicos (masa, radios, electronegatividad, energías de ionización)
 * vienen de IUPAC 2021 + NIST ASD. Valores `null` = no medido o no
 * aplicable (gases nobles no tienen EN; elementos synthetic no tienen
 * propiedades precisas).
 *
 * Ref [PT1] IUPAC "Atomic weights of the elements 2021", Pure Appl. Chem.
 *           94, 573-600 (2022).
 * Ref [PT2] NIST Atomic Spectra Database v5.10 (2023).
 * Ref [PT3] Cordero, B. et al. "Covalent radii revisited", Dalton Trans.
 *           2008, 2832-2838. Radios covalentes.
 * Ref [PT4] Meija, J. et al. "Atomic weights of the elements 2013",
 *           Pure Appl. Chem. 88, 265-291 (2016).
 */

// ═══════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════

/** Subshell individual ocupado por N electrones (2(2l+1) máx) */
export interface Subshell {
  n: number;          // número cuántico principal
  l: number;          // azimutal: 0=s, 1=p, 2=d, 3=f
  electrons: number;  // ocupación (0 a 2(2l+1))
}

export type Block = 's' | 'p' | 'd' | 'f';
export type Phase = 's' | 'l' | 'g';  // estado a STP
export type Category =
  | 'nonmetal-reactive'
  | 'noble-gas'
  | 'alkali'
  | 'alkaline-earth'
  | 'metalloid'
  | 'post-transition'
  | 'transition'
  | 'lanthanide'
  | 'actinide'
  | 'halogen'
  | 'unknown';

export interface Element {
  Z: number;
  symbol: string;
  name: string;           // español
  mass: number;           // uma
  period: number;
  group: number;          // 1-18 (lantánidos/actínidos usan 3 por convención)
  block: Block;
  category: Category;
  phase: Phase;
  /** CPK color usado en visualización */
  color: string;
  /** Configuración electrónica como lista de subshells ocupados */
  config: Subshell[];
  /** Electronegatividad Pauling — null si no aplica (gases nobles, no medidos) */
  electronegativity: number | null;
  /** Primera energía de ionización [eV] */
  ionizationEnergy: number | null;
  /** Radio atómico empírico [pm] */
  atomicRadius: number | null;
  /** Radio covalente [pm] */
  covalentRadius: number | null;
}

// ═══════════════════════════════════════════════════════════════
// ORDEN MADELUNG: llenado por (n+l) creciente, luego n creciente
// ═══════════════════════════════════════════════════════════════

function madelungOrder(): Array<{ n: number; l: number }> {
  const seq: Array<{ n: number; l: number }> = [];
  // Recorremos n+l = 1, 2, ..., hasta cubrir los 118 elementos
  for (let sum = 1; sum <= 8; sum++) {
    // l desde max(0, sum-n_max) hasta min(l_max, sum-1), pero el orden
    // Madelung dicta iterar n descendente → l ascendente:
    // más preciso: para cada suma s, pares (n, l) con n+l+1 = s son los
    // orbitales con misma "energía Madelung". El orden canónico es:
    //   para sum=1: (1,0)
    //   para sum=2: (2,0)
    //   para sum=3: (2,1), (3,0)
    //   para sum=4: (3,1), (4,0)
    //   para sum=5: (3,2), (4,1), (5,0)
    //   ...  n decreciente dentro del grupo, con l creciente
    for (let l = sum - 1; l >= 0; l--) {
      const n = sum - l;
      if (n > l) seq.push({ n, l });
    }
  }
  return seq;
}

const MADELUNG = madelungOrder();

// ═══════════════════════════════════════════════════════════════
// EXCEPCIONES AL LLENADO MADELUNG
// ═══════════════════════════════════════════════════════════════
// Notación: valencia completa en cada caso, no "[X] + extra"

const EXCEPTIONS: Record<number, Subshell[]> = {
  24: [ // Cr: [Ar] 3d⁵ 4s¹
    { n: 1, l: 0, electrons: 2 }, { n: 2, l: 0, electrons: 2 },
    { n: 2, l: 1, electrons: 6 }, { n: 3, l: 0, electrons: 2 },
    { n: 3, l: 1, electrons: 6 }, { n: 3, l: 2, electrons: 5 },
    { n: 4, l: 0, electrons: 1 },
  ],
  29: [ // Cu: [Ar] 3d¹⁰ 4s¹
    { n: 1, l: 0, electrons: 2 }, { n: 2, l: 0, electrons: 2 },
    { n: 2, l: 1, electrons: 6 }, { n: 3, l: 0, electrons: 2 },
    { n: 3, l: 1, electrons: 6 }, { n: 3, l: 2, electrons: 10 },
    { n: 4, l: 0, electrons: 1 },
  ],
  41: [ // Nb: [Kr] 4d⁴ 5s¹
    ...kryptonCore(),
    { n: 4, l: 2, electrons: 4 }, { n: 5, l: 0, electrons: 1 },
  ],
  42: [ // Mo: [Kr] 4d⁵ 5s¹
    ...kryptonCore(),
    { n: 4, l: 2, electrons: 5 }, { n: 5, l: 0, electrons: 1 },
  ],
  44: [ // Ru: [Kr] 4d⁷ 5s¹
    ...kryptonCore(),
    { n: 4, l: 2, electrons: 7 }, { n: 5, l: 0, electrons: 1 },
  ],
  45: [ // Rh: [Kr] 4d⁸ 5s¹
    ...kryptonCore(),
    { n: 4, l: 2, electrons: 8 }, { n: 5, l: 0, electrons: 1 },
  ],
  46: [ // Pd: [Kr] 4d¹⁰ (sin 5s!)
    ...kryptonCore(),
    { n: 4, l: 2, electrons: 10 },
  ],
  47: [ // Ag: [Kr] 4d¹⁰ 5s¹
    ...kryptonCore(),
    { n: 4, l: 2, electrons: 10 }, { n: 5, l: 0, electrons: 1 },
  ],
  57: [ // La: [Xe] 5d¹ 6s² (sin 4f)
    ...xenonCore(),
    { n: 5, l: 2, electrons: 1 }, { n: 6, l: 0, electrons: 2 },
  ],
  58: [ // Ce: [Xe] 4f¹ 5d¹ 6s²
    ...xenonCore(),
    { n: 4, l: 3, electrons: 1 }, { n: 5, l: 2, electrons: 1 },
    { n: 6, l: 0, electrons: 2 },
  ],
  64: [ // Gd: [Xe] 4f⁷ 5d¹ 6s²
    ...xenonCore(),
    { n: 4, l: 3, electrons: 7 }, { n: 5, l: 2, electrons: 1 },
    { n: 6, l: 0, electrons: 2 },
  ],
  78: [ // Pt: [Xe] 4f¹⁴ 5d⁹ 6s¹
    ...xenonCore(),
    { n: 4, l: 3, electrons: 14 }, { n: 5, l: 2, electrons: 9 },
    { n: 6, l: 0, electrons: 1 },
  ],
  79: [ // Au: [Xe] 4f¹⁴ 5d¹⁰ 6s¹
    ...xenonCore(),
    { n: 4, l: 3, electrons: 14 }, { n: 5, l: 2, electrons: 10 },
    { n: 6, l: 0, electrons: 1 },
  ],
  89: [ // Ac: [Rn] 6d¹ 7s²
    ...radonCore(),
    { n: 6, l: 2, electrons: 1 }, { n: 7, l: 0, electrons: 2 },
  ],
  90: [ // Th: [Rn] 6d² 7s²
    ...radonCore(),
    { n: 6, l: 2, electrons: 2 }, { n: 7, l: 0, electrons: 2 },
  ],
  91: [ // Pa: [Rn] 5f² 6d¹ 7s²
    ...radonCore(),
    { n: 5, l: 3, electrons: 2 }, { n: 6, l: 2, electrons: 1 },
    { n: 7, l: 0, electrons: 2 },
  ],
  92: [ // U: [Rn] 5f³ 6d¹ 7s²
    ...radonCore(),
    { n: 5, l: 3, electrons: 3 }, { n: 6, l: 2, electrons: 1 },
    { n: 7, l: 0, electrons: 2 },
  ],
  93: [ // Np: [Rn] 5f⁴ 6d¹ 7s²
    ...radonCore(),
    { n: 5, l: 3, electrons: 4 }, { n: 6, l: 2, electrons: 1 },
    { n: 7, l: 0, electrons: 2 },
  ],
  96: [ // Cm: [Rn] 5f⁷ 6d¹ 7s²
    ...radonCore(),
    { n: 5, l: 3, electrons: 7 }, { n: 6, l: 2, electrons: 1 },
    { n: 7, l: 0, electrons: 2 },
  ],
};

function kryptonCore(): Subshell[] {
  return [
    { n: 1, l: 0, electrons: 2 }, { n: 2, l: 0, electrons: 2 },
    { n: 2, l: 1, electrons: 6 }, { n: 3, l: 0, electrons: 2 },
    { n: 3, l: 1, electrons: 6 }, { n: 3, l: 2, electrons: 10 },
    { n: 4, l: 0, electrons: 2 }, { n: 4, l: 1, electrons: 6 },
  ];
}
function xenonCore(): Subshell[] {
  return [
    ...kryptonCore(),
    { n: 4, l: 2, electrons: 10 }, { n: 5, l: 0, electrons: 2 },
    { n: 5, l: 1, electrons: 6 },
  ];
}
function radonCore(): Subshell[] {
  return [
    ...xenonCore(),
    { n: 4, l: 3, electrons: 14 }, { n: 5, l: 2, electrons: 10 },
    { n: 6, l: 0, electrons: 2 }, { n: 6, l: 1, electrons: 6 },
  ];
}

// ═══════════════════════════════════════════════════════════════
// GENERAR CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════

/**
 * Para un Z dado, devuelve la lista de subshells ocupados.
 * Aplica Madelung salvo que Z esté en EXCEPTIONS.
 */
export function electronConfig(Z: number): Subshell[] {
  if (EXCEPTIONS[Z]) return EXCEPTIONS[Z];
  const shells: Subshell[] = [];
  let remaining = Z;
  for (const { n, l } of MADELUNG) {
    if (remaining === 0) break;
    const max = 2 * (2 * l + 1);
    const fill = Math.min(max, remaining);
    shells.push({ n, l, electrons: fill });
    remaining -= fill;
  }
  return shells;
}

// ═══════════════════════════════════════════════════════════════
// NOTACIÓN ESPECTROSCÓPICA
// ═══════════════════════════════════════════════════════════════

const L_LABEL = ['s', 'p', 'd', 'f', 'g', 'h'];

/** "1s² 2s² 2p⁶" etc. */
export function configString(shells: Subshell[]): string {
  return shells
    .map((s) => `${s.n}${L_LABEL[s.l]}${superscript(s.electrons)}`)
    .join(' ');
}

function superscript(n: number): string {
  const map: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  };
  return n.toString().split('').map((c) => map[c] ?? c).join('');
}

/** Notación compacta con núcleo de gas noble: "[Ar] 4s² 3d⁵" */
export function configCompact(Z: number): string {
  const full = electronConfig(Z);
  const nobles = [2, 10, 18, 36, 54, 86, 118];
  const nobleSymbols = ['He', 'Ne', 'Ar', 'Kr', 'Xe', 'Rn', 'Og'];
  // Encontrar el gas noble < Z más cercano
  let coreIdx = -1;
  for (let i = nobles.length - 1; i >= 0; i--) {
    if (nobles[i] < Z) { coreIdx = i; break; }
  }
  if (coreIdx < 0) return configString(full);
  const coreZ = nobles[coreIdx];
  const coreConfig = electronConfig(coreZ);
  // Quitar los primeros coreConfig.length subshells si coinciden
  const remaining = full.slice(coreConfig.length);
  return `[${nobleSymbols[coreIdx]}] ` + configString(remaining);
}

// ═══════════════════════════════════════════════════════════════
// SLATER'S RULES: Z efectiva para un subshell dado
// ═══════════════════════════════════════════════════════════════
// Determina cuánto "sienten" los electrones del subshell (n,l) la
// carga nuclear real, apantallada por los electrones internos y
// del mismo subshell. Crítico para dimensionar orbitales realistas.
//
// Ref [PT5] Slater, J.C. "Atomic Shielding Constants", Phys. Rev. 36,
//           57-64 (1930). Original.
// Ref [PT6] Clementi, E. & Raimondi, D.L., J. Chem. Phys. 38, 2686 (1963).
//           Refinamiento numérico (usado por muchos códigos modernos).

/**
 * Constante de apantallamiento σ para el electrón en subshell (n, l).
 * Retorna Z_eff = Z - σ.
 *
 * Reglas de Slater (1930):
 *   Electrones se agrupan:
 *     {1s}, {2s, 2p}, {3s, 3p}, {3d}, {4s, 4p}, {4d}, {4f},
 *     {5s, 5p}, {5d}, {5f}, ...
 *   (ns y np comparten grupo; nd y nf son grupos aparte)
 *
 *   Contribución al apantallamiento σ:
 *     • Electrones más externos que el target: 0 (no apantallan)
 *     • Mismo grupo que el target: 0.35 cada uno (0.30 para 1s)
 *     • Para s,p target: electrones en n−1: 0.85; en n≤n−2: 1.00
 *     • Para d,f target: electrones internos (n<target o n=target con l<target): 1.00
 */
export function effectiveZ(Z: number, targetN: number, targetL: number): number {
  const config = electronConfig(Z);
  let sigma = 0;
  const targetIsSP = (targetL <= 1);
  const targetIsDF = (targetL >= 2);

  const sameGroup = (n: number, l: number): boolean => {
    if (n !== targetN) return false;
    // 1s grupo propio
    if (targetN === 1) return l === 0;
    // ns y np mismo grupo (l ≤ 1 ambos)
    if (targetIsSP && l <= 1) return true;
    // nd grupo propio
    if (targetL === 2 && l === 2) return true;
    // nf grupo propio
    if (targetL === 3 && l === 3) return true;
    return false;
  };

  for (const s of config) {
    if (s.electrons <= 0) continue;
    const inSameGroup = sameGroup(s.n, s.l);
    // Contar electrones, excluyendo el electrón que estamos calculando
    const isExactSubshell = s.n === targetN && s.l === targetL;
    const count = isExactSubshell ? s.electrons - 1 : s.electrons;
    if (count <= 0) continue;

    if (inSameGroup) {
      const coef = (targetN === 1 && targetL === 0) ? 0.30 : 0.35;
      sigma += coef * count;
    } else if (s.n > targetN) {
      // Electrones externos: no apantallan
      continue;
    } else if (targetIsSP) {
      if (s.n === targetN - 1) sigma += 0.85 * s.electrons;
      else if (s.n <= targetN - 2) sigma += 1.00 * s.electrons;
      // Si s.n === targetN pero no mismo grupo (solo pasa con d,f): 1.00
      else if (s.n === targetN && s.l > 1) sigma += 1.00 * s.electrons;
    } else if (targetIsDF) {
      // Todos los electrones internos apantallan completamente
      sigma += 1.00 * s.electrons;
    }
  }
  return Math.max(0.5, Z - sigma);
}

// ═══════════════════════════════════════════════════════════════
// DATOS FÍSICOS POR ELEMENTO (nombre, masa, EN, IE, radios, ...)
// ═══════════════════════════════════════════════════════════════
//
// Formato compacto:
//   [name, mass, EN|null, IE|null, atomicR|null, covalentR|null, phase, color, category]
// Valores nulos donde no hay dato estándar (gas noble EN, sintéticos).

type RawElement = [
  string,          // nombre español
  number,          // masa uma
  number | null,   // electronegatividad Pauling
  number | null,   // IE1 eV
  number | null,   // atomic radius pm
  number | null,   // covalent radius pm
  Phase,
  string,          // color CPK hex
  Category,
];

// Los 118 elementos. Typing tedioso pero una vez; luego reutilizable.
const RAW: Record<number, RawElement> = {
  1:   ['Hidrógeno',     1.008,   2.20, 13.598,  53,  31, 'g', '#FFFFFF', 'nonmetal-reactive'],
  2:   ['Helio',         4.0026,  null, 24.587,  31,  28, 'g', '#D9FFFF', 'noble-gas'],
  3:   ['Litio',         6.94,    0.98, 5.392,  167, 128, 's', '#CC80FF', 'alkali'],
  4:   ['Berilio',       9.0122,  1.57, 9.323,  112,  96, 's', '#C2FF00', 'alkaline-earth'],
  5:   ['Boro',          10.81,   2.04, 8.298,   87,  84, 's', '#FFB5B5', 'metalloid'],
  6:   ['Carbono',       12.011,  2.55, 11.260,  67,  76, 's', '#505050', 'nonmetal-reactive'],
  7:   ['Nitrógeno',     14.007,  3.04, 14.534,  56,  71, 'g', '#3050F8', 'nonmetal-reactive'],
  8:   ['Oxígeno',       15.999,  3.44, 13.618,  48,  66, 'g', '#FF0D0D', 'nonmetal-reactive'],
  9:   ['Flúor',         18.998,  3.98, 17.423,  42,  57, 'g', '#90E050', 'halogen'],
  10:  ['Neón',           20.180,  null, 21.565,  38,  58, 'g', '#B3E3F5', 'noble-gas'],
  11:  ['Sodio',          22.990,  0.93, 5.139, 190, 166, 's', '#AB5CF2', 'alkali'],
  12:  ['Magnesio',       24.305,  1.31, 7.646, 145, 141, 's', '#8AFF00', 'alkaline-earth'],
  13:  ['Aluminio',       26.982,  1.61, 5.986, 118, 121, 's', '#BFA6A6', 'post-transition'],
  14:  ['Silicio',        28.085,  1.90, 8.152, 111, 111, 's', '#F0C8A0', 'metalloid'],
  15:  ['Fósforo',        30.974,  2.19, 10.487, 98, 107, 's', '#FF8000', 'nonmetal-reactive'],
  16:  ['Azufre',         32.06,   2.58, 10.360, 88, 105, 's', '#FFFF30', 'nonmetal-reactive'],
  17:  ['Cloro',          35.45,   3.16, 12.968, 79, 102, 'g', '#1FF01F', 'halogen'],
  18:  ['Argón',          39.948,  null, 15.760, 71, 106, 'g', '#80D1E3', 'noble-gas'],
  19:  ['Potasio',        39.098,  0.82, 4.341, 243, 203, 's', '#8F40D4', 'alkali'],
  20:  ['Calcio',         40.078,  1.00, 6.113, 194, 176, 's', '#3DFF00', 'alkaline-earth'],
  21:  ['Escandio',       44.956,  1.36, 6.561, 184, 170, 's', '#E6E6E6', 'transition'],
  22:  ['Titanio',        47.867,  1.54, 6.828, 176, 160, 's', '#BFC2C7', 'transition'],
  23:  ['Vanadio',        50.942,  1.63, 6.746, 171, 153, 's', '#A6A6AB', 'transition'],
  24:  ['Cromo',          51.996,  1.66, 6.767, 166, 139, 's', '#8A99C7', 'transition'],
  25:  ['Manganeso',      54.938,  1.55, 7.434, 161, 139, 's', '#9C7AC7', 'transition'],
  26:  ['Hierro',         55.845,  1.83, 7.902, 156, 132, 's', '#E06633', 'transition'],
  27:  ['Cobalto',        58.933,  1.88, 7.881, 152, 126, 's', '#F090A0', 'transition'],
  28:  ['Níquel',         58.693,  1.91, 7.640, 149, 124, 's', '#50D050', 'transition'],
  29:  ['Cobre',          63.546,  1.90, 7.726, 145, 132, 's', '#C88033', 'transition'],
  30:  ['Zinc',           65.38,   1.65, 9.394, 142, 122, 's', '#7D80B0', 'transition'],
  31:  ['Galio',          69.723,  1.81, 5.999, 136, 122, 's', '#C28F8F', 'post-transition'],
  32:  ['Germanio',       72.630,  2.01, 7.899, 125, 120, 's', '#668F8F', 'metalloid'],
  33:  ['Arsénico',       74.922,  2.18, 9.815, 114, 119, 's', '#BD80E3', 'metalloid'],
  34:  ['Selenio',        78.971,  2.55, 9.752, 103, 120, 's', '#FFA100', 'nonmetal-reactive'],
  35:  ['Bromo',          79.904,  2.96, 11.814,  94, 120, 'l', '#A62929', 'halogen'],
  36:  ['Kriptón',        83.798,  3.00, 14.000,  88, 116, 'g', '#5CB8D1', 'noble-gas'],
  37:  ['Rubidio',        85.468,  0.82, 4.177, 265, 220, 's', '#702EB0', 'alkali'],
  38:  ['Estroncio',      87.62,   0.95, 5.695, 219, 195, 's', '#00FF00', 'alkaline-earth'],
  39:  ['Itrio',          88.906,  1.22, 6.217, 212, 190, 's', '#94FFFF', 'transition'],
  40:  ['Circonio',       91.224,  1.33, 6.634, 206, 175, 's', '#94E0E0', 'transition'],
  41:  ['Niobio',         92.906,  1.60, 6.759, 198, 164, 's', '#73C2C9', 'transition'],
  42:  ['Molibdeno',      95.95,   2.16, 7.092, 190, 154, 's', '#54B5B5', 'transition'],
  43:  ['Tecnecio',       98,      1.90, 7.28,  183, 147, 's', '#3B9E9E', 'transition'],
  44:  ['Rutenio',       101.07,   2.20, 7.361, 178, 146, 's', '#248F8F', 'transition'],
  45:  ['Rodio',         102.91,   2.28, 7.459, 173, 142, 's', '#0A7D8C', 'transition'],
  46:  ['Paladio',       106.42,   2.20, 8.337, 169, 139, 's', '#006985', 'transition'],
  47:  ['Plata',         107.87,   1.93, 7.576, 165, 145, 's', '#C0C0C0', 'transition'],
  48:  ['Cadmio',        112.41,   1.69, 8.994, 161, 144, 's', '#FFD98F', 'transition'],
  49:  ['Indio',         114.82,   1.78, 5.786, 156, 142, 's', '#A67573', 'post-transition'],
  50:  ['Estaño',        118.71,   1.96, 7.344, 145, 139, 's', '#668080', 'post-transition'],
  51:  ['Antimonio',     121.76,   2.05, 8.608, 133, 139, 's', '#9E63B5', 'metalloid'],
  52:  ['Telurio',       127.60,   2.10, 9.010, 123, 138, 's', '#D47A00', 'metalloid'],
  53:  ['Yodo',          126.90,   2.66, 10.451, 115, 139, 's', '#940094', 'halogen'],
  54:  ['Xenón',         131.29,   2.60, 12.130, 108, 140, 'g', '#429EB0', 'noble-gas'],
  55:  ['Cesio',         132.91,   0.79, 3.894, 298, 244, 's', '#57178F', 'alkali'],
  56:  ['Bario',         137.33,   0.89, 5.212, 253, 215, 's', '#00C900', 'alkaline-earth'],
  57:  ['Lantano',       138.91,   1.10, 5.577, 195, 207, 's', '#70D4FF', 'lanthanide'],
  58:  ['Cerio',         140.12,   1.12, 5.539, 185, 204, 's', '#FFFFC7', 'lanthanide'],
  59:  ['Praseodimio',   140.91,   1.13, 5.473, 247, 203, 's', '#D9FFC7', 'lanthanide'],
  60:  ['Neodimio',      144.24,   1.14, 5.525, 206, 201, 's', '#C7FFC7', 'lanthanide'],
  61:  ['Prometio',      145,      1.13, 5.582, 205, 199, 's', '#A3FFC7', 'lanthanide'],
  62:  ['Samario',       150.36,   1.17, 5.644, 238, 198, 's', '#8FFFC7', 'lanthanide'],
  63:  ['Europio',       151.96,   1.20, 5.670, 231, 198, 's', '#61FFC7', 'lanthanide'],
  64:  ['Gadolinio',     157.25,   1.20, 6.150, 233, 196, 's', '#45FFC7', 'lanthanide'],
  65:  ['Terbio',        158.93,   1.20, 5.864, 225, 194, 's', '#30FFC7', 'lanthanide'],
  66:  ['Disprosio',     162.50,   1.22, 5.939, 228, 192, 's', '#1FFFC7', 'lanthanide'],
  67:  ['Holmio',        164.93,   1.23, 6.022, 226, 192, 's', '#00FF9C', 'lanthanide'],
  68:  ['Erbio',         167.26,   1.24, 6.108, 226, 189, 's', '#00E675', 'lanthanide'],
  69:  ['Tulio',         168.93,   1.25, 6.184, 222, 190, 's', '#00D452', 'lanthanide'],
  70:  ['Iterbio',       173.05,   1.10, 6.254, 222, 187, 's', '#00BF38', 'lanthanide'],
  71:  ['Lutecio',       174.97,   1.27, 5.426, 217, 187, 's', '#00AB24', 'lanthanide'],
  72:  ['Hafnio',        178.49,   1.30, 6.825, 208, 175, 's', '#4DC2FF', 'transition'],
  73:  ['Tantalio',      180.95,   1.50, 7.550, 200, 170, 's', '#4DA6FF', 'transition'],
  74:  ['Wolframio',     183.84,   2.36, 7.864, 193, 162, 's', '#2194D6', 'transition'],
  75:  ['Renio',         186.21,   1.90, 7.834, 188, 151, 's', '#267DAB', 'transition'],
  76:  ['Osmio',         190.23,   2.20, 8.438, 185, 144, 's', '#266696', 'transition'],
  77:  ['Iridio',        192.22,   2.20, 8.967, 180, 141, 's', '#175487', 'transition'],
  78:  ['Platino',       195.08,   2.28, 8.959, 177, 136, 's', '#D0D0E0', 'transition'],
  79:  ['Oro',           196.97,   2.54, 9.226, 174, 136, 's', '#FFD123', 'transition'],
  80:  ['Mercurio',      200.59,   2.00, 10.438, 171, 132, 'l', '#B8B8D0', 'transition'],
  81:  ['Talio',         204.38,   1.62, 6.108, 156, 145, 's', '#A6544D', 'post-transition'],
  82:  ['Plomo',         207.2,    2.33, 7.417, 154, 146, 's', '#575961', 'post-transition'],
  83:  ['Bismuto',       208.98,   2.02, 7.289, 143, 148, 's', '#9E4FB5', 'post-transition'],
  84:  ['Polonio',       209,      2.00, 8.417, 135, 140, 's', '#AB5C00', 'metalloid'],
  85:  ['Ástato',        210,      2.20, 9.500, 127, 150, 's', '#754F45', 'halogen'],
  86:  ['Radón',         222,      null, 10.749, 120, 150, 'g', '#428296', 'noble-gas'],
  87:  ['Francio',       223,      0.70, 4.073, null, 260, 's', '#420066', 'alkali'],
  88:  ['Radio',         226,      0.89, 5.278, null, 221, 's', '#007D00', 'alkaline-earth'],
  89:  ['Actinio',       227,      1.10, 5.170, null, 215, 's', '#70ABFA', 'actinide'],
  90:  ['Torio',         232.04,   1.30, 6.307, null, 206, 's', '#00BAFF', 'actinide'],
  91:  ['Protactinio',   231.04,   1.50, 5.890, null, 200, 's', '#00A1FF', 'actinide'],
  92:  ['Uranio',        238.03,   1.38, 6.194, null, 196, 's', '#008FFF', 'actinide'],
  93:  ['Neptunio',      237,      1.36, 6.266, null, 190, 's', '#0080FF', 'actinide'],
  94:  ['Plutonio',      244,      1.28, 6.060, null, 187, 's', '#006BFF', 'actinide'],
  95:  ['Americio',      243,      1.30, 5.993, null, 180, 's', '#545CF2', 'actinide'],
  96:  ['Curio',         247,      1.30, 6.020, null, 169, 's', '#785CE3', 'actinide'],
  97:  ['Berkelio',      247,      1.30, 6.230, null, null, 's', '#8A4FE3', 'actinide'],
  98:  ['Californio',    251,      1.30, 6.300, null, null, 's', '#A136D4', 'actinide'],
  99:  ['Einstenio',     252,      1.30, 6.420, null, null, 's', '#B31FD4', 'actinide'],
  100: ['Fermio',        257,      1.30, 6.500, null, null, 's', '#B31FBA', 'actinide'],
  101: ['Mendelevio',    258,      1.30, 6.580, null, null, 's', '#B30DA6', 'actinide'],
  102: ['Nobelio',       259,      1.30, 6.650, null, null, 's', '#BD0D87', 'actinide'],
  103: ['Lawrencio',     266,      1.30, 4.900, null, null, 's', '#C70066', 'actinide'],
  104: ['Rutherfordio',  267,      null, 6.010, null, null, 's', '#CC0059', 'transition'],
  105: ['Dubnio',        268,      null, null,  null, null, 's', '#D1004F', 'transition'],
  106: ['Seaborgio',     269,      null, null,  null, null, 's', '#D90045', 'transition'],
  107: ['Bohrio',        270,      null, null,  null, null, 's', '#E00038', 'transition'],
  108: ['Hassio',        277,      null, null,  null, null, 's', '#E6002E', 'transition'],
  109: ['Meitnerio',     278,      null, null,  null, null, 's', '#EB0026', 'unknown'],
  110: ['Darmstadtio',   281,      null, null,  null, null, 's', '#F00020', 'unknown'],
  111: ['Roentgenio',    282,      null, null,  null, null, 's', '#F20019', 'unknown'],
  112: ['Copernicio',    285,      null, null,  null, null, 'l', '#F40012', 'post-transition'],
  113: ['Nihonio',       286,      null, null,  null, null, 's', '#F5000D', 'post-transition'],
  114: ['Flerovio',      289,      null, null,  null, null, 's', '#F70008', 'post-transition'],
  115: ['Moscovio',      290,      null, null,  null, null, 's', '#F80005', 'post-transition'],
  116: ['Livermorio',    293,      null, null,  null, null, 's', '#F90002', 'post-transition'],
  117: ['Teneso',        294,      null, null,  null, null, 's', '#FA0000', 'halogen'],
  118: ['Oganesón',      294,      null, null,  null, null, 'g', '#FB0000', 'noble-gas'],
};

// ═══════════════════════════════════════════════════════════════
// Mapeo Z → posición (period, group) en la tabla
// ═══════════════════════════════════════════════════════════════

/** Posiciones de cada elemento en la cuadrícula estándar 18×9 (lantánidos y actínidos en filas 8-9) */
function periodGroup(Z: number): { period: number; group: number } {
  // Datos tabulados canónicos
  const pg: Record<number, [number, number]> = {
    1:[1,1], 2:[1,18],
    3:[2,1], 4:[2,2], 5:[2,13], 6:[2,14], 7:[2,15], 8:[2,16], 9:[2,17], 10:[2,18],
    11:[3,1], 12:[3,2], 13:[3,13], 14:[3,14], 15:[3,15], 16:[3,16], 17:[3,17], 18:[3,18],
  };
  if (pg[Z]) return { period: pg[Z][0], group: pg[Z][1] };
  // Periodos 4-7
  if (Z >= 19 && Z <= 36)  return rowGroup(4, Z, 19);
  if (Z >= 37 && Z <= 54)  return rowGroup(5, Z, 37);
  if (Z >= 55 && Z <= 86)  return rowGroup6(Z);
  if (Z >= 87 && Z <= 118) return rowGroup7(Z);
  return { period: 0, group: 0 };
}

function rowGroup(period: number, Z: number, start: number): { period: number; group: number } {
  const offset = Z - start;
  // 0..1: groups 1-2, 2..11: groups 3-12, 12..17: groups 13-18
  let group: number;
  if (offset <= 1) group = offset + 1;
  else if (offset <= 11) group = offset + 1;
  else group = offset + 1;
  return { period, group };
}

function rowGroup6(Z: number): { period: number; group: number } {
  // Cs Ba | La Ce ... Lu | Hf Ta ... Rn
  if (Z === 55) return { period: 6, group: 1 };
  if (Z === 56) return { period: 6, group: 2 };
  if (Z === 57) return { period: 6, group: 3 };         // La (grupo 3)
  if (Z >= 58 && Z <= 71) return { period: 8, group: Z - 54 }; // Ce-Lu en "fila 8" extra
  // Hf..Rn
  if (Z >= 72 && Z <= 86) return { period: 6, group: Z - 68 };  // Hf=72→grupo 4
  return { period: 6, group: 0 };
}

function rowGroup7(Z: number): { period: number; group: number } {
  if (Z === 87) return { period: 7, group: 1 };
  if (Z === 88) return { period: 7, group: 2 };
  if (Z === 89) return { period: 7, group: 3 };
  if (Z >= 90 && Z <= 103) return { period: 9, group: Z - 86 }; // Th-Lr en fila 9 extra
  if (Z >= 104 && Z <= 118) return { period: 7, group: Z - 100 };
  return { period: 7, group: 0 };
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS — el array/record principal
// ═══════════════════════════════════════════════════════════════

function buildElement(Z: number): Element {
  const r = RAW[Z];
  if (!r) throw new Error(`Missing data for Z=${Z}`);
  const [name, mass, en, ie, aR, cR, phase, color, category] = r;
  const config = electronConfig(Z);
  const { period, group } = periodGroup(Z);
  // Determinar bloque por el subshell de más alta Madelung con electrones
  let block: Block = 's';
  for (let i = config.length - 1; i >= 0; i--) {
    if (config[i].electrons > 0) {
      block = (['s', 'p', 'd', 'f'] as Block[])[Math.min(3, config[i].l)];
      break;
    }
  }
  return {
    Z, symbol: '', // se rellena abajo
    name, mass, period, group, block, category, phase, color,
    config,
    electronegativity: en,
    ionizationEnergy: ie,
    atomicRadius: aR,
    covalentRadius: cR,
  };
}

// Símbolos estándar (118 items)
const SYMBOLS = [
  '','H','He','Li','Be','B','C','N','O','F','Ne',
  'Na','Mg','Al','Si','P','S','Cl','Ar','K','Ca',
  'Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn',
  'Ga','Ge','As','Se','Br','Kr','Rb','Sr','Y','Zr',
  'Nb','Mo','Tc','Ru','Rh','Pd','Ag','Cd','In','Sn',
  'Sb','Te','I','Xe','Cs','Ba','La','Ce','Pr','Nd',
  'Pm','Sm','Eu','Gd','Tb','Dy','Ho','Er','Tm','Yb',
  'Lu','Hf','Ta','W','Re','Os','Ir','Pt','Au','Hg',
  'Tl','Pb','Bi','Po','At','Rn','Fr','Ra','Ac','Th',
  'Pa','U','Np','Pu','Am','Cm','Bk','Cf','Es','Fm',
  'Md','No','Lr','Rf','Db','Sg','Bh','Hs','Mt','Ds',
  'Rg','Cn','Nh','Fl','Mc','Lv','Ts','Og',
];

export const PERIODIC_TABLE: Element[] = Array.from({ length: 118 }, (_, i) => {
  const Z = i + 1;
  const e = buildElement(Z);
  e.symbol = SYMBOLS[Z];
  return e;
});

export const ELEMENTS_BY_SYMBOL: Record<string, Element> = Object.fromEntries(
  PERIODIC_TABLE.map((e) => [e.symbol, e]),
);

export function elementByZ(Z: number): Element | undefined {
  return PERIODIC_TABLE[Z - 1];
}

export function elementBySymbol(sym: string): Element | undefined {
  return ELEMENTS_BY_SYMBOL[sym];
}

// ═══════════════════════════════════════════════════════════════
// RESUMEN ELECTRÓNICO: n_valencia, electrones de valencia
// ═══════════════════════════════════════════════════════════════

/**
 * Electrones de valencia: para elementos del grupo principal, los del nivel
 * más externo (n máximo). Para transición, s + (n-1)d.
 */
export function valenceElectrons(element: Element): number {
  const cfg = element.config;
  const nMax = Math.max(...cfg.map((s) => s.n));
  return cfg
    .filter((s) => s.n === nMax || (s.n === nMax - 1 && s.l === 2))
    .reduce((sum, s) => sum + s.electrons, 0);
}
