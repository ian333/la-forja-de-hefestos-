/**
 * Escalas jerárquicas de la biología molecular — de célula a átomo.
 *
 * Cada nivel guarda una dimensión lineal característica (en metros) y
 * una descripción de lo que vive a esa escala. Los valores son los
 * típicos citados en Alberts, "Molecular Biology of the Cell", 7ª ed.
 * (salvo donde indicamos otra fuente).
 *
 * La idea del módulo asociado es permitir al usuario "zoom-in" continuo
 * desde la célula entera (~20 µm) hasta un par de bases del DNA (~2 nm)
 * — 4 órdenes de magnitud linales (10⁴) = 10¹² en volumen. Es la misma
 * trayectoria del clásico "Powers of Ten" (Eames 1977) pero en el mundo
 * del interior celular.
 */

export interface BioScale {
  id: string;
  name: string;
  /** Dimensión lineal característica en metros. */
  sizeM: number;
  /** Dimensión también en ångström (conveniente para mostrar). */
  sizeA: number;
  /** Color de acento para el HUD de este nivel. */
  accent: string;
  /** Cuerpo pedagógico (3-5 líneas). */
  body: string;
  /** Nota técnica con números y fuente. */
  fact: string;
}

const nm = 1e-9;
const um = 1e-6;
const ang = 1e-10;

export const BIO_SCALES: BioScale[] = [
  {
    id: 'cell',
    name: 'Célula eucariota',
    sizeM: 20 * um,
    sizeA: 20 * um / ang,
    accent: '#64B5F6',
    body:
      'Una célula humana típica mide ~20 µm. Contiene un núcleo (DNA), ' +
      'mitocondrias (energía), retículo endoplásmico (síntesis de proteínas) ' +
      'y membrana plasmática (frontera con el exterior).',
    fact: '≈ 20 µm = 20 000 nm = 200 000 Å. Alberts §1.1.',
  },
  {
    id: 'nucleus',
    name: 'Núcleo celular',
    sizeM: 6 * um,
    sizeA: 6 * um / ang,
    accent: '#7E57C2',
    body:
      'El núcleo aloja los 46 cromosomas humanos. Está rodeado por una doble ' +
      'membrana perforada por poros nucleares que regulan qué entra y sale. ' +
      'Es donde ocurre la transcripción DNA → mRNA.',
    fact: '≈ 6 µm de diámetro. Membrana ~ 40 nm de espesor. Alberts §4.',
  },
  {
    id: 'chromosome',
    name: 'Cromosoma (metafase)',
    sizeM: 1.4 * um,
    sizeA: 1.4 * um / ang,
    accent: '#F48FB1',
    body:
      'En metafase el DNA está enrollado en su forma más compacta. Cada ' +
      'cromosoma tiene dos cromátidas hermanas unidas por el centrómero. ' +
      'Si desenrolláramos un cromosoma humano su DNA mediría ~2 m — aquí ' +
      'plegado a 1.4 µm.',
    fact:
      '≈ 1.4 µm × 0.8 µm en metafase. DNA lineal por cromosoma ≈ 50-250 Mbp ' +
      '≈ 1.7-8.5 cm. Factor compactación ~ 10⁴.',
  },
  {
    id: 'chromatin',
    name: 'Fibra de cromatina (30 nm)',
    sizeM: 30 * nm,
    sizeA: 30 * nm / ang,
    accent: '#FFCA28',
    body:
      'Antes de la metafase, la cromatina vive como "fibra de 30 nm" — ' +
      'los nucleosomas apilados en una estructura helicoidal irregular ' +
      '(modelo solenoide o zigzag de 2 partidas, aún discutido). Compactación ' +
      'adicional ~ 40× sobre DNA desnudo.',
    fact:
      '≈ 30 nm de diámetro. Woodcock & Ghosh 2010, Cold Spring Harb Perspect Biol 2:a000596.',
  },
  {
    id: 'nucleosome',
    name: 'Nucleosoma',
    sizeM: 11 * nm,
    sizeA: 11 * nm / ang,
    accent: '#81C784',
    body:
      'Unidad fundamental de empaquetamiento del DNA. 147 pb de DNA se ' +
      'enrollan 1.65 vueltas alrededor de un octámero de histonas ' +
      '(2× H2A/H2B/H3/H4). La histona H1 sella la vuelta en "linker DNA".',
    fact:
      '11 nm × 5.7 nm (disco). Estructura cristalográfica: Luger et al. 1997, ' +
      'Nature 389:251. PDB 1AOI.',
  },
  {
    id: 'helix',
    name: 'Doble hélice B',
    sizeM: 2 * nm,
    sizeA: 2 * nm / ang,
    accent: '#4FC3F7',
    body:
      'DNA en forma B — la geometría canónica Watson-Crick-Franklin ' +
      '(fibra diffraction, 1953). Dos cadenas antiparalelas enrolladas, ' +
      '10.5 pb/vuelta, rise 3.4 Å/pb. Los surcos mayor y menor son ' +
      'asimétricos por construcción.',
    fact:
      'Diámetro 2.0 nm = 20 Å. Arnott-Hukins 1972. Ver módulo "Doble hélice" ' +
      'para el modelo B-form completo.',
  },
  {
    id: 'basepair',
    name: 'Par de bases (átomos)',
    sizeM: 1 * nm,
    sizeA: 10,
    accent: '#E57373',
    body:
      'A nivel atómico: una timina y una adenina unidas por 2 puentes de ' +
      'hidrógeno (N-H…N, N-H…O). El par es prácticamente plano. Los átomos ' +
      'de carbono y nitrógeno tienen radios de van der Waals ~ 1.7 Å.',
    fact:
      'C: vdW 1.70 Å · N: 1.55 Å · O: 1.52 Å · H: 1.20 Å. Bondi 1964, J. Phys. Chem. 68:441.',
  },
];

/** Devuelve el nivel `i` con clamp seguro. */
export function getScale(i: number): BioScale {
  return BIO_SCALES[Math.max(0, Math.min(BIO_SCALES.length - 1, i))];
}

/**
 * Formato humano de una longitud en metros: elige la unidad (m, mm, µm, nm, Å)
 * según magnitud y da 2 cifras significativas.
 */
export function formatLength(m: number): string {
  const absM = Math.abs(m);
  if (absM >= 1) return `${m.toFixed(2)} m`;
  if (absM >= 1e-3) return `${(m * 1e3).toFixed(2)} mm`;
  if (absM >= 1e-6) return `${(m * 1e6).toFixed(2)} µm`;
  if (absM >= 1e-9) return `${(m * 1e9).toFixed(2)} nm`;
  return `${(m * 1e10).toFixed(2)} Å`;
}
